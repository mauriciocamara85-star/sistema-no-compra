-- ════════════════════════════════════════════════════════════════════════
-- Migración 46 (SQL 145, 20/10/2026, pedido de Mauricio):
--   · El salón se controla los martes y el depósito los jueves (los días son
--     de Ajustes: dias_control y deposito_dia_vence). Al que tiene franco ese
--     día le toca el día anterior que trabaja (en esa semana); si no trabaja
--     ningún día antes, el primero después.
--   · Si un día de control se pasó sin generarse (se arrancó a mitad de
--     semana, o el reloj no anduvo), va el primer día que trabaje, hasta dos
--     días después.
--   · La vidriera es de todos y siempre: cualquiera del local le saca foto,
--     cualquier día (sin turnos). El control nace con la foto (libre = true);
--     si la sacó y no la mandó, a la noche se descarta sin aviso ni falta.
--   · Los archivos que quedan sueltos (la vidriera sin mandar, el arranque de
--     cero) van a una lista que vacía el reloj a las 03:00 (la base no puede
--     borrar archivos de Storage: eso lo hace la función tick).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Las columnas nuevas de los controles
alter table orden_controles add column if not exists libre boolean not null default false;
alter table orden_controles add column if not exists dia_control date;
comment on column orden_controles.libre is 'Foto libre de la vidriera (SQL 145): la mandó alguien sin que le tocara; no vence ni cuenta como atrasada.';
comment on column orden_controles.dia_control is 'El día de control al que corresponde (SQL 145): el martes del salón aunque se mande el lunes por un franco.';

-- Un mismo módulo, día y tipo, una vez; la vidriera libre puede tener varias (una por persona).
drop index if exists orden_controles_unico;
create unique index orden_controles_unico on orden_controles (modulo_id, fecha, tipo)
  where tipo <> 'correccion' and not libre;

-- 2. La lista de archivos para borrar (la vacía el reloj, ver orden_fotos_para_borrar)
create table if not exists orden_archivos_para_borrar (
  path      text primary key,
  motivo    text,
  creado_en timestamptz not null default now()
);
alter table orden_archivos_para_borrar enable row level security;
revoke all on orden_archivos_para_borrar from anon, authenticated;

-- 3. Qué día le toca a una persona el control del día p_dia: el último que trabaja desde el lunes
--    de esa semana hasta ese día; si no hay, el primero que trabaja después, hasta el domingo.
create or replace function orden_dia_que_le_toca(p_persona uuid, p_dia date)
returns date language sql stable set search_path = public as $$
  select coalesce(
    (select g::date from generate_series(p_dia - (extract(isodow from p_dia)::int - 1), p_dia, interval '1 day') g
      where orden_trabaja(p_persona, g::date) order by g desc limit 1),
    (select g::date from generate_series(p_dia + 1, p_dia + (7 - extract(isodow from p_dia)::int), interval '1 day') g
      where orden_trabaja(p_persona, g::date) order by g limit 1))
$$;

-- 4. A quién hay que generarle hoy los controles de un sector, y de qué día de control.
--    El responsable, el día que le toca (o hasta 2 días después, si ese día pasó sin generarse y hoy
--    trabaja). Si el responsable no trabaja en toda la semana (o no hay), el suplente el mismo día.
create or replace function orden_le_toca_hoy(p_sector uuid, p_hoy date, p_dias smallint[], p_tipo orden_control_tipo)
returns table (persona uuid, dia_control date)
language plpgsql stable set search_path = public as $$
declare s orden_sectores; d date; v_dia date; v_p uuid; v_lunes date := p_hoy - (extract(isodow from p_hoy)::int - 1);
begin
  select * into s from orden_sectores where id = p_sector;
  if not found then return; end if;
  for d in select g::date from generate_series(v_lunes, v_lunes + 6, interval '1 day') g
           where extract(isodow from g)::smallint = any(p_dias) order by g loop
    -- ese día de control ya está generado para este sector
    continue when exists (select 1 from orden_controles c join orden_modulos m on m.id = c.modulo_id
                          where m.sector_id = p_sector and c.tipo = p_tipo and not c.libre and c.dia_control = d);
    v_dia := case when s.responsable_id is not null then orden_dia_que_le_toca(s.responsable_id, d) end;
    if v_dia is not null then
      if v_dia = p_hoy or (v_dia < p_hoy and p_hoy <= d + 2 and orden_trabaja(s.responsable_id, p_hoy)) then
        persona := s.responsable_id; dia_control := d; return next;
      end if;
    elsif d = p_hoy then
      v_p := orden_asignado(p_sector, d);
      if v_p is not null then persona := v_p; dia_control := d; return next; end if;
    end if;
  end loop;
end $$;
revoke all on function orden_dia_que_le_toca(uuid, date) from public, anon, authenticated;
revoke all on function orden_le_toca_hoy(uuid, date, smallint[], orden_control_tipo) from public, anon, authenticated;

-- 5. El frontal nuevo no marca la foto libre de la vidriera
create or replace function orden_controles_frontal_()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.tipo = 'programado' and not new.libre and not new.frontal and orden_es_dia_frontal(new.local_id, new.fecha) then
    new.frontal := true;
  end if;
  return new;
end $function$;

-- 6. La foto de la vidriera: cualquiera del local, cualquier día. Crea (o retoma) su control de hoy
--    y registra la foto. Si ya la mandó hoy y todavía se puede cambiar, la nueva va a ese control
--    (reemplaza a la mandada sólo si la manda); si ya la revisaron, empieza otro.
create or replace function orden_vidriera_foto(p_modulo uuid, p_foto_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := orden_yo_id(); p orden_personas; m record; v_hoy date; c orden_controles; v_foto uuid;
begin
  if v_yo is null then raise exception 'Entrá de nuevo a la app'; end if;
  select mo.id, mo.isla, mo.nombre, mo.activo, s.local_id, s.activo as s_activo, s.tipo
    into m from orden_modulos mo join orden_sectores s on s.id = mo.sector_id
   where mo.id = p_modulo for update of mo;
  if not found or not m.activo or not m.s_activo or m.tipo <> 'salon' or not orden_es_vidriera(m.isla, m.nombre) then
    raise exception 'Esa no es la vidriera del local';
  end if;
  select * into p from orden_personas where id = v_yo;
  if not (p.activo and p.aprobado and p.local_id is not distinct from m.local_id) then
    raise exception 'La foto de la vidriera la manda alguien del local';
  end if;
  v_hoy := orden_fecha_local(m.local_id);
  select x.* into c from orden_controles x
   where x.modulo_id = p_modulo and x.persona_id = v_yo and x.libre and x.fecha = v_hoy
     and (x.estado = 'pendiente' or orden_se_puede_rehacer(x))
   order by x.creado_en desc limit 1;
  if not found then
    insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en, libre)
    values (m.local_id, p_modulo, v_yo, v_hoy, 'programado', orden_en_hora(m.local_id, v_hoy, time '23:59'), true)
    returning * into c;
  end if;
  v_foto := orden_registrar_foto(c.id, p_foto_path);
  return jsonb_build_object('control', c.id, 'foto', v_foto, 'estado', c.estado);
end $$;
revoke all on function orden_vidriera_foto(uuid, text) from public, anon;
grant execute on function orden_vidriera_foto(uuid, text) to authenticated;

-- 7. El reloj borra también los archivos de la lista (una vez por día, con las fotos viejas)
create or replace function orden_fotos_para_borrar(p_limite integer default 500)
 returns table(origen text, id uuid, foto_path text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  (select 'modulo', f.id, f.foto_path
   from orden_fotos f
   join orden_controles c on c.id = f.control_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null
     -- solo fotos ya controladas por el supervisor (las que esperan revisión se guardan, con tope de 90 días)
     and (c.estado = 'revisado' or c.tipo = 'correccion'
          or f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_problemas))
     and f.tomada_en < now() - make_interval(days => case
           when coalesce(c.nivel_final, c.nivel_ia) <= 'a_mejorar' then cfg.dias_guardar_fotos_problemas
           else cfg.dias_guardar_fotos end)
     -- la última foto de cada módulo no se borra nunca: es la que se ve en "Cómo está el local"
     and f.id is distinct from (
           select f2.id from orden_fotos f2 join orden_controles c2 on c2.id = f2.control_id
           where c2.modulo_id = c.modulo_id and f2.borrada_en is null
           order by f2.tomada_en desc limit 1)
   limit p_limite)
  union all
  (select 'caja', f.id, f.foto_path
   from orden_caja_fotos f
   join orden_cajas c on c.id = f.caja_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null and f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_caja)
   limit p_limite)
  union all
  -- SQL 145: los archivos sueltos de la lista (mientras sigan en Storage; borrados, salen solos)
  (select 'archivo', null::uuid, q.path
   from orden_archivos_para_borrar q
   where exists (select 1 from storage.objects o where o.bucket_id = 'orden-fotos' and o.name = q.path)
   limit p_limite)
$function$;

-- 8. El reloj, entero (el salón y el depósito con la regla del franco, la vidriera libre y la lista de archivos)
create or replace function public.orden_tick(p_ahora timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l record; cfg orden_config; s record; mo record; p record; r record;
  v_hoy date; v_hora time; v_dow smallint; v_semana date; v_persona uuid;
  v_dias date[]; v_mods uuid[]; v_dia date; v_n int; v_desde timestamptz; v_ult timestamptz;
  v_tv int; v_cv int; v_fde int; v_tipo orden_falta_tipo; v_motivo text; v_falta uuid; v_preg uuid[];
  v_categoria text; v_dif smallint;
  v_generados int := 0; v_ctl_venc int := 0; v_tar_venc int := 0; v_faltas int := 0;
begin
  -- Los archivos de la lista que ya se borraron de Storage salen de la lista (SQL 145).
  delete from orden_archivos_para_borrar q
   where not exists (select 1 from storage.objects o where o.bucket_id = 'orden-fotos' and o.name = q.path);

  for l in select * from orden_locales where activo loop
    select * into cfg from orden_config where local_id = l.id;
    if not found then
      insert into orden_config (local_id) values (l.id) returning * into cfg;
    end if;

    v_hoy    := (p_ahora at time zone l.zona_horaria)::date;
    v_hora   := (p_ahora at time zone l.zona_horaria)::time;
    v_dow    := extract(isodow from v_hoy);
    v_semana := v_hoy - (v_dow - 1);

    if orden_local_abre(l.id, v_hoy) then

      -- 1. El salón (SQL 145): todos los módulos de cada sector, el día de control (el martes). Al que
      --    tiene franco ese día le toca el día anterior que trabaja (ver orden_le_toca_hoy). Sólo
      --    antes de la hora límite (después ya nacerían vencidos). La vidriera no va: es de todos y
      --    se manda cuando quieran (orden_vidriera_foto).
      if v_hora < cfg.hora_limite then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          for r in select * from orden_le_toca_hoy(s.id, v_hoy, cfg.dias_control, 'programado') loop
            insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en, dia_control)
            select l.id, m.id, r.persona, v_hoy, 'programado', orden_en_hora(l.id, v_hoy, cfg.hora_limite), r.dia_control
            from orden_modulos m where m.sector_id = s.id and m.activo and not orden_es_vidriera(m.isla, m.nombre)
            on conflict do nothing;
            get diagnostics v_n = row_count; v_generados := v_generados + v_n;
          end loop;
        end loop;
      end if;

      -- 2. Controles sorpresa (día y módulo elegidos al azar dentro de la semana)
      if cfg.sorpresas_por_semana > 0 then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          v_persona := orden_asignado(s.id, v_hoy);
          continue when v_persona is null;

          select array_agg(g::date order by g) into v_dias
          from generate_series(v_semana, v_semana + 6, interval '1 day') g
          where orden_local_abre(l.id, g::date)
            and not (extract(isodow from g)::smallint = any(cfg.dias_control))
            and orden_asignado(s.id, g::date) is not null;
          if v_dias is null then
            select array_agg(g::date order by g) into v_dias
            from generate_series(v_semana, v_semana + 6, interval '1 day') g
            where orden_local_abre(l.id, g::date) and orden_asignado(s.id, g::date) is not null;
          end if;
          select array_agg(m.id order by m.numero) into v_mods from orden_modulos m where m.sector_id = s.id and m.activo and not orden_es_vidriera(m.isla, m.nombre);
          continue when v_dias is null or v_mods is null;

          -- cuántas sorpresas ya tuvo este sector esta semana (nunca más de las configuradas)
          select count(*) into v_n from orden_controles c join orden_modulos m on m.id = c.modulo_id
          where m.sector_id = s.id and c.tipo = 'sorpresa' and c.fecha between v_semana and v_semana + 6;

          for k in (v_n + 1)..cfg.sorpresas_por_semana loop
            v_dia := v_dias[1 + (abs(hashtext(s.id::text || v_semana::text || 'd' || k)::bigint) % array_length(v_dias, 1))];
            -- si el día elegido ya pasó sin generarse (cambió un franco a mitad de semana), va hoy
            if v_dia <= v_hoy and v_hoy = any(v_dias) then
              insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en)
              values (l.id, v_mods[1 + (abs(hashtext(s.id::text || v_semana::text || 'm' || k)::bigint) % array_length(v_mods, 1))],
                      v_persona, v_hoy, 'sorpresa', orden_en_hora(l.id, v_hoy, cfg.hora_limite))
              on conflict do nothing;
              get diagnostics v_n = row_count; v_generados := v_generados + v_n;
            end if;
          end loop;
        end loop;
      end if;

      -- 3. El depósito (SQL 145): una vez por semana, el día de Ajustes (deposito_dia_vence: el jueves),
      --    con la misma regla del franco que el salón. Vence ese mismo día a la hora límite.
      if v_hora < cfg.hora_limite then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'deposito' and activo loop
          for r in select * from orden_le_toca_hoy(s.id, v_hoy, array[cfg.deposito_dia_vence]::smallint[], 'deposito') loop
            insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en, dia_control)
            select l.id, m.id, r.persona, v_hoy, 'deposito', orden_en_hora(l.id, v_hoy, cfg.hora_limite), r.dia_control
            from orden_modulos m where m.sector_id = s.id and m.activo
            on conflict do nothing;
            get diagnostics v_n = row_count; v_generados := v_generados + v_n;
          end loop;
        end loop;
      end if;

      -- 4. Cambio de imagen (por defecto, los jueves)
      if cfg.cambio_imagen_dia is not null and v_dow = cfg.cambio_imagen_dia
         and extract(week from v_hoy)::int % greatest(cfg.cambio_imagen_cada_semanas, 1) = 0 then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          v_persona := orden_asignado(s.id, v_hoy);
          continue when v_persona is null;
          -- una sola vez por sector y día, aunque ya se haya hecho o vencido
          continue when exists (select 1 from orden_tareas where clave = 'imagen:' || s.id || ':' || v_hoy);
          insert into orden_tareas (local_id, persona_id, origen, titulo, detalle, requiere_foto, plazo, vence_en, clave, creado_en)
          values (l.id, v_persona, 'sistema', 'Cambio de imagen: renovar los frontales del sector ' || s.numero,
                  'Mirá el tablero "Frontales de la semana" en Ideas.', false, 'hoy',
                  orden_en_hora(l.id, v_hoy, cfg.hora_limite), 'imagen:' || s.id || ':' || v_hoy, p_ahora)
          on conflict do nothing;
        end loop;
      end if;

      -- 4b. Desafío semanal: llega un día y una hora al azar (distintos para cada vendedor),
      --     alterna los temas semana a semana y no cuenta para faltas: es para aprender.
      if cfg.desafio_activo and v_hora >= cfg.hora_aviso_1 then
        for p in select pe.id from orden_personas pe
                 where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' and orden_trabaja(pe.id, v_hoy)
                   and not exists (select 1 from orden_desafios d where d.persona_id = pe.id and d.semana = v_semana)
        loop
          select array_agg(g::date order by g) into v_dias
          from generate_series(v_semana, v_semana + 6, interval '1 day') g
          where orden_trabaja(p.id, g::date);
          continue when v_dias is null;
          v_dia := v_dias[1 + (abs(hashtext(p.id::text || v_semana::text || 'desafio')::bigint) % array_length(v_dias, 1))];
          continue when v_dia > v_hoy;  -- si el día elegido ya pasó sin generarse, va hoy
          -- hora al azar entre el aviso de la mañana y el de la tarde
          continue when v_hora < cfg.hora_aviso_1 + make_interval(mins =>
            (abs(hashtext(p.id::text || v_semana::text || 'hora')::bigint)
             % greatest(1, (extract(epoch from (cfg.hora_aviso_2 - cfg.hora_aviso_1)) / 60)::int))::int);

          v_categoria := cfg.desafio_categorias[1 + (extract(week from v_hoy)::int % array_length(cfg.desafio_categorias, 1))];
          v_dif := orden_desafio_dificultad(p.id);
          v_preg := orden_desafio_elegir(p.id, v_categoria, v_dif, cfg.desafio_preguntas);
          continue when v_preg is null;

          insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, creado_en)
          values (l.id, p.id, v_semana, v_categoria, v_dif, v_preg, array_length(v_preg, 1),
                  orden_calcular_vencimiento(p.id, 'manana', p_ahora), p_ahora)
          on conflict do nothing
          returning id into v_falta;
          continue when v_falta is null;

          perform orden_encolar_aviso(p.id, 'desafio', 'Llegó tu test de conocimiento',
            array_length(v_preg, 1) || ' preguntas rápidas de '
              || case v_categoria when 'producto' then 'telas y molderías' else 'cómo trabajamos en el local' end
              || '. Si le errás, no pasa nada: es para aprender.',
            '/desafio', 'desafio:' || v_falta, 2::smallint);
        end loop;

        -- recordatorio el día que cierra
        if v_hora >= cfg.hora_aviso_2 then
          for r in select d.* from orden_desafios d
                   where d.local_id = l.id and d.terminado_en is null and d.vence_en > p_ahora
                     and (d.vence_en at time zone l.zona_horaria)::date = v_hoy loop
            perform orden_encolar_aviso(r.persona_id, 'desafio', 'Hoy cierra tu test de conocimiento',
              'Te quedan ' || (r.total - (select count(*) from jsonb_object_keys(r.respuestas)))::int || ' preguntas.',
              '/desafio', 'desafio-cierre:' || r.id, 1::smallint);
          end loop;
        end if;
      end if;

      -- 5. Aviso de la mañana y 6. recordatorio de la tarde
      if v_hora >= cfg.hora_aviso_1 then
        for p in
          select pe.id,
            (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'pendiente' and not c.libre
               and (c.vence_en at time zone l.zona_horaria)::date = v_hoy)::int as ctl,
            (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'pendiente'
               and c.tipo = 'sorpresa' and c.fecha = v_hoy)::int as sorpresa,
            (select count(*) from orden_tareas t where t.persona_id = pe.id and t.estado = 'pendiente'
               and (t.vence_en at time zone l.zona_horaria)::date = v_hoy)::int as tar
          from orden_personas pe
          where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' and orden_trabaja(pe.id, v_hoy)
        loop
          continue when p.ctl + p.tar = 0;
          if v_hora < cfg.hora_aviso_2 then
            perform orden_encolar_aviso(p.id, 'dia', 'Hoy: ' || orden_texto_conteo(p.ctl, p.tar),
              case when p.sorpresa > 0 then 'Incluye un control sorpresa. ' else '' end
                || 'Vence a las ' || to_char(cfg.hora_limite, 'HH24:MI') || '.',
              case when p.tar = 0 then '/fotos' else '/hoy' end, 'dia:' || p.id || ':' || v_hoy, 2::smallint);
          elsif v_hora < cfg.hora_limite then
            perform orden_encolar_aviso(p.id, 'recordatorio', 'Te falta: ' || orden_texto_conteo(p.ctl, p.tar),
              'Vence a las ' || to_char(cfg.hora_limite, 'HH24:MI') || '.',
              case when p.tar = 0 then '/fotos' else '/hoy' end, 'tarde:' || p.id || ':' || v_hoy, 2::smallint);
          end if;
        end loop;
      end if;
    end if; -- local abierto

    -- 7. Controles vencidos. La foto libre de la vidriera que se sacó y no se mandó no es un control
    --    atrasado: se descarta sin aviso (sus archivos, a la lista que vacía el reloj; SQL 145).
    insert into orden_archivos_para_borrar (path, motivo)
    select f.foto_path, 'vidriera sin mandar' from orden_fotos f join orden_controles c on c.id = f.control_id
     where c.local_id = l.id and c.libre and c.estado = 'pendiente' and c.vence_en <= p_ahora
    on conflict do nothing;
    delete from orden_controles c where c.local_id = l.id and c.libre and c.estado = 'pendiente' and c.vence_en <= p_ahora;

    for r in
      with v as (
        update orden_controles c set estado = 'vencido'
         where c.local_id = l.id and c.estado = 'pendiente' and c.vence_en <= p_ahora and not c.libre
        returning c.persona_id)
      select v.persona_id, pe.nombre, count(*)::int as n
      from v join orden_personas pe on pe.id = v.persona_id group by v.persona_id, pe.nombre
    loop
      v_ctl_venc := v_ctl_venc + r.n;
      perform orden_encolar_aviso(r.persona_id, 'control_vencido',
        case when r.n = 1 then 'No mandaste 1 control a tiempo' else 'No mandaste ' || r.n || ' controles a tiempo' end,
        'Queda registrado. Si podés, mandalo igual.', '/fotos', 'ctlv:' || r.persona_id || ':' || v_hoy, 1::smallint);
      perform orden_avisar_responsables(l.id, 'supervisores', 'control_vencido',
        r.nombre || ' no mandó ' || case when r.n = 1 then '1 control' else r.n || ' controles' end,
        null, '/equipo', 'ctlv-sup:' || r.persona_id || ':' || v_hoy, 2::smallint);
    end loop;

    -- 8. Tareas vencidas (si pidió más tiempo y no le respondieron, se espera)
    for r in
      with v as (
        update orden_tareas t set estado = 'vencida'
         where t.local_id = l.id and t.estado = 'pendiente' and t.vence_en <= p_ahora
           and t.prorroga_estado is distinct from 'pedida'
        returning t.persona_id)
      select v.persona_id, pe.nombre, count(*)::int as n
      from v join orden_personas pe on pe.id = v.persona_id group by v.persona_id, pe.nombre
    loop
      v_tar_venc := v_tar_venc + r.n;
      perform orden_encolar_aviso(r.persona_id, 'tarea_vencida',
        case when r.n = 1 then 'Se venció 1 tarea' else 'Se vencieron ' || r.n || ' tareas' end,
        'Queda registrado. Hacela igual y marcala como hecha.', '/tareas', 'tarv:' || r.persona_id || ':' || v_hoy, 1::smallint);
      perform orden_avisar_responsables(l.id, 'supervisores', 'tarea_vencida',
        r.nombre || ': ' || case when r.n = 1 then '1 tarea vencida' else r.n || ' tareas vencidas' end,
        null, '/equipo', 'tarv-sup:' || r.persona_id || ':' || v_hoy, 2::smallint);
    end loop;

    -- 9. Fotos que el supervisor no revisó a tiempo → aviso a los admins
    select count(*) into v_n from orden_controles
    where local_id = l.id and estado = 'enviado'
      and enviado_en <= p_ahora - make_interval(hours => cfg.horas_revision_supervisor);
    if v_n > 0 then
      perform orden_avisar_responsables(l.id, 'admins', 'sin_revisar',
        l.nombre || ': ' || v_n || ' foto' || case when v_n = 1 then '' else 's' end || ' sin revisar',
        'Hace más de ' || cfg.horas_revision_supervisor || ' h que esperan revisión.',
        '/revisar', 'rev:' || l.id || ':' || v_hoy, 2::smallint);
    end if;

    -- 10. Abandono: 3 o más controles vencidos en 3 días y ninguna foto
    for p in
      select pe.id, pe.nombre from orden_personas pe
      where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor'
        and (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'vencido'
               and c.vence_en > p_ahora - interval '3 days') >= 3
        and not exists (select 1 from orden_fotos f where f.persona_id = pe.id and f.tomada_en > p_ahora - interval '3 days')
    loop
      perform orden_avisar_responsables(l.id, 'ambos', 'abandono',
        p.nombre || ' no sube fotos hace 3 días', 'Conviene hablar con él hoy.',
        '/equipo', 'aband:' || p.id || ':' || v_semana, 2::smallint);
    end loop;

    -- 11. Faltas sugeridas (apagado en modo prueba). Decide siempre una persona.
    if not cfg.modo_prueba then
      for p in select pe.id, pe.nombre from orden_personas pe
               where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' loop
        select max(creado_en) into v_ult from orden_faltas where persona_id = p.id;
        v_desde := greatest(p_ahora - make_interval(days => cfg.ventana_faltas_dias), coalesce(v_ult, '-infinity'::timestamptz));

        -- Todo se cuenta en DÍAS: un día malo (5 módulos, o una foto que generó 4 tareas)
        -- cuenta como 1, no como 5.
        select count(distinct (t.vence_en at time zone l.zona_horaria)::date) into v_tv from orden_tareas t
        where t.persona_id = p.id and t.vence_en > v_desde and t.vence_en <= p_ahora
          and (t.estado = 'vencida' or (t.estado = 'hecha' and t.completada_a_tiempo = false));
        select count(distinct c.fecha) into v_cv from orden_controles c
        where c.persona_id = p.id and c.tipo <> 'correccion' and c.vence_en > v_desde and c.vence_en <= p_ahora
          and (c.estado = 'vencido' or c.enviado_en > c.vence_en);
        select count(distinct c.fecha) into v_fde from orden_controles c
        where c.persona_id = p.id and c.nivel_final = 'fuera_de_estandar' and c.revisado_en > v_desde;

        if v_tv >= cfg.umbral_tareas_vencidas or v_cv >= cfg.umbral_dias_sin_control
           or v_fde >= cfg.umbral_fuera_estandar then
          v_tipo := orden_siguiente_sancion(p.id);
          v_motivo := concat_ws(', ',
            case when v_tv  > 0 then v_tv  || ' día(s) con tareas fuera de plazo' end,
            case when v_cv  > 0 then v_cv  || ' día(s) con controles sin mandar a tiempo' end,
            case when v_fde > 0 then v_fde || ' día(s) con controles fuera de estándar' end)
            || ' desde el ' || to_char(v_desde at time zone l.zona_horaria, 'DD/MM');
          -- creado_en = momento evaluado: la próxima cuenta arranca desde acá (no se repite la evidencia)
          insert into orden_faltas (local_id, persona_id, tipo, estado, motivo, evidencia, creado_en)
          values (l.id, p.id, v_tipo, 'sugerida', v_motivo,
                  jsonb_build_object('desde', v_desde, 'hasta', p_ahora, 'dias_tareas_fuera_de_plazo', v_tv,
                                     'dias_sin_control', v_cv, 'dias_fuera_de_estandar', v_fde),
                  p_ahora)
          returning id into v_falta;
          v_faltas := v_faltas + 1;
          perform orden_avisar_responsables(l.id, 'ambos', 'falta_sugerida',
            p.nombre || ': sugerencia de ' || v_tipo::text, v_motivo, '/faltas', 'falta-sug:' || v_falta, 2::smallint);
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('controles_generados', v_generados, 'controles_vencidos', v_ctl_venc,
                            'tareas_vencidas', v_tar_venc, 'faltas_sugeridas', v_faltas);
end $function$;
