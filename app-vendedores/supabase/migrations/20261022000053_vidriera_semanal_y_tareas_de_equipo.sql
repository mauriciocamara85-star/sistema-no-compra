-- ════════════════════════════════════════════════════════════════════════
-- Migración 53 (SQL 159, 22/10/2026, pedido de Mauricio):
--   · La vidriera, una vez por semana: se manda el día del salón (el primero
--     de dias_control; si ese día el local no abre, el siguiente que abra).
--     La primera foto de cada vidriera vale para todo el local esa semana: a
--     los demás les dice quién la mandó, y no se puede mandar otra. Antes de
--     ese día no se manda; si ese día nadie la manda, se puede hasta el
--     domingo y queda como mandada tarde (vence a la hora límite del día).
--   · Tareas de foto para todo el equipo: desde la compu, una tarea con un
--     módulo (la vidriera o cualquiera) le llega a cada vendedor del local
--     (grupo = el mismo para todos). El aviso, a los que trabajan ese día. La
--     primera foto la cierra para todos: a los demás les queda "La hizo X",
--     sin nada en contra.
--   · La noche descarta la vidriera que se sacó y no se mandó cuando termina
--     el día en que se sacó (antes, a su vencimiento: ahora puede vencer antes,
--     si se manda tarde).
-- ════════════════════════════════════════════════════════════════════════

-- 1. El día de la semana en que se manda la vidriera, y su nombre
create or replace function orden_vidriera_dia_(p_local uuid, p_fecha date)
returns date language plpgsql stable set search_path = public as $$
declare v_lunes date := p_fecha - (extract(isodow from p_fecha)::int - 1); v_dia date; d date;
begin
  select v_lunes + (min(x) - 1) into v_dia from orden_config c, unnest(c.dias_control) x where c.local_id = p_local;
  v_dia := coalesce(v_dia, v_lunes);
  -- Si ese día el local no abre, el siguiente que abra en esa semana.
  for d in select g::date from generate_series(v_dia, v_lunes + 6, interval '1 day') g order by g loop
    if orden_local_abre(p_local, d) then return d; end if;
  end loop;
  return v_dia;
end $$;
revoke all on function orden_vidriera_dia_(uuid, date) from public, anon, authenticated;

create or replace function orden_dia_nombre_(p_fecha date)
returns text language sql immutable as $$
  select (array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'])[extract(isodow from p_fecha)::int]
$$;
revoke all on function orden_dia_nombre_(date) from public, anon, authenticated;

-- 2. La primera foto mandada de un módulo en la semana de p_fecha (la de la vidriera o la de una tarea);
--    p_sin: un control que no cuenta (el que se está mandando).
create or replace function orden_vidriera_mandada_(p_modulo uuid, p_fecha date, p_sin uuid default null)
returns table (control uuid, persona uuid, por_nombre text, mandada_en timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.persona_id, pe.nombre, c.enviado_en
    from orden_controles c left join orden_personas pe on pe.id = c.persona_id
   where c.modulo_id = p_modulo and c.estado in ('enviado', 'revisado') and c.enviado_en is not null
     and c.fecha between p_fecha - (extract(isodow from p_fecha)::int - 1) and p_fecha - (extract(isodow from p_fecha)::int - 1) + 6
     and c.id is distinct from p_sin
   order by c.enviado_en
   limit 1
$$;
revoke all on function orden_vidriera_mandada_(uuid, date, uuid) from public, anon, authenticated;

-- 3. La vidriera de esta semana, para la app: qué día se manda, si ya se puede, si ya es tarde
--    y quién mandó cada una. La ve la gente del local y su supervisión.
create or replace function orden_vidriera_semana(p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoy date; v_dia date; v_limite timestamptz; v jsonb;
begin
  if not (orden_ve_equipo(p_local) or exists (select 1 from orden_personas
           where id = orden_yo_id() and activo and aprobado and local_id = p_local)) then
    raise exception 'No podés ver la vidriera de ese local';
  end if;
  v_hoy := orden_fecha_local(p_local);
  v_dia := orden_vidriera_dia_(p_local, v_hoy);
  v_limite := orden_en_hora(p_local, v_dia, coalesce((select c.hora_limite from orden_config c where c.local_id = p_local), '18:00'::time));
  select coalesce(jsonb_agg(jsonb_build_object('modulo', m.id, 'nombre', m.nombre, 'control', x.control, 'por', x.persona,
                                               'por_nombre', x.por_nombre, 'mandada_en', x.mandada_en) order by m.numero), '[]'::jsonb)
    into v
    from orden_modulos m join orden_sectores s on s.id = m.sector_id
    left join lateral orden_vidriera_mandada_(m.id, v_hoy) x on true
   where s.local_id = p_local and s.activo and s.tipo = 'salon' and m.activo and orden_es_vidriera(m.isla, m.nombre);
  return jsonb_build_object('hoy', v_hoy, 'dia', v_dia, 'dia_nombre', orden_dia_nombre_(v_dia), 'limite', v_limite,
                            'abierta', v_hoy >= v_dia, 'tarde', now() > v_limite, 'vidrieras', v);
end $$;
revoke all on function orden_vidriera_semana(uuid) from public, anon;
grant execute on function orden_vidriera_semana(uuid) to authenticated;

-- 4. La foto de la vidriera: desde el día del salón, y si nadie la mandó esta semana. Retoma su control
--    de hoy (si todavía no lo mandó, o si lo mandó y todavía se puede cambiar); si no, empieza otro, que
--    vence a la hora límite del día del salón (mandado después, queda tarde).
create or replace function orden_vidriera_foto(p_modulo uuid, p_foto_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := orden_yo_id(); p orden_personas; m record; v_hoy date; v_dia date; c orden_controles; v_foto uuid; v_ya record;
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
  v_dia := orden_vidriera_dia_(m.local_id, v_hoy);
  if v_hoy < v_dia then
    raise exception 'La foto de la vidriera se manda el %: ese día te aparece para mandar', orden_dia_nombre_(v_dia);
  end if;
  select x.* into c from orden_controles x
   where x.modulo_id = p_modulo and x.persona_id = v_yo and x.libre and x.fecha = v_hoy
     and (x.estado = 'pendiente' or orden_se_puede_rehacer(x))
   order by x.creado_en desc limit 1;
  -- Salvo que esté cambiando la que mandó, si otro ya la mandó esta semana no va otra.
  if c.id is null or c.estado = 'pendiente' then
    select * into v_ya from orden_vidriera_mandada_(p_modulo, v_hoy, c.id);
    if found then
      raise exception 'La vidriera de esta semana ya la % (el % a las %): queda esa',
        case when v_ya.persona = v_yo then 'mandaste vos' else 'mandó ' || coalesce(v_ya.por_nombre, 'otro del local') end,
        orden_dia_nombre_(orden_fecha_local(m.local_id, v_ya.mandada_en)), left(orden_hora_local(m.local_id, v_ya.mandada_en)::text, 5);
    end if;
  end if;
  if c.id is null then
    insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en, libre)
    values (m.local_id, p_modulo, v_yo, v_hoy, 'programado',
            orden_en_hora(m.local_id, v_dia, coalesce((select hora_limite from orden_config where local_id = m.local_id), '18:00'::time)),
            true)
    returning * into c;
  end if;
  v_foto := orden_registrar_foto(c.id, p_foto_path);
  return jsonb_build_object('control', c.id, 'foto', v_foto, 'estado', c.estado);
end $$;
revoke all on function orden_vidriera_foto(uuid, text) from public, anon;
grant execute on function orden_vidriera_foto(uuid, text) to authenticated;

-- 5. Si dos le sacan foto a la vez, la manda el primero: al segundo se le frena al mandarla.
create or replace function orden_controles_vidriera_()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ya record;
begin
  if new.libre and new.estado = 'enviado' and old.estado is distinct from 'enviado' then
    perform 1 from orden_modulos where id = new.modulo_id for update;
    select * into v_ya from orden_vidriera_mandada_(new.modulo_id, new.fecha, new.id);
    if found then
      raise exception 'La vidriera de esta semana ya la % (a las %): queda esa',
        case when v_ya.persona = new.persona_id then 'mandaste vos' else 'mandó ' || coalesce(v_ya.por_nombre, 'otro del local') end,
        left(orden_hora_local(new.local_id, v_ya.mandada_en)::text, 5);
    end if;
  end if;
  return new;
end $$;
revoke all on function orden_controles_vidriera_() from public, anon, authenticated;
drop trigger if exists orden_controles_vidriera on orden_controles;
create trigger orden_controles_vidriera before update of estado on orden_controles
  for each row execute function orden_controles_vidriera_();

-- 6. El reloj, entero (como en la migración 46; cambia cuándo se descarta la vidriera sin mandar)
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
      --    se manda una vez por semana, el día del salón (orden_vidriera_foto, SQL 159).
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
    --    atrasado: se descarta sin aviso cuando termina el día en que se sacó (sus archivos, a la lista
    --    que vacía el reloj; SQL 145). SQL 159: no a su vencimiento, que puede ser antes (mandada tarde).
    insert into orden_archivos_para_borrar (path, motivo)
    select f.foto_path, 'vidriera sin mandar' from orden_fotos f join orden_controles c on c.id = f.control_id
     where c.local_id = l.id and c.libre and c.estado = 'pendiente' and c.fecha < v_hoy
    on conflict do nothing;
    delete from orden_controles c where c.local_id = l.id and c.libre and c.estado = 'pendiente' and c.fecha < v_hoy;

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

-- 7. Las tareas de todo el equipo
alter table orden_tareas add column if not exists grupo uuid;
comment on column orden_tareas.grupo is 'Tarea de foto para todo el equipo (SQL 159): una por vendedor, con el mismo grupo; la primera foto la cierra para todos.';
create index if not exists orden_tareas_grupo on orden_tareas (grupo) where grupo is not null;

-- La vista, con el grupo al final (security_invoker, como estaba).
create or replace view orden_v_tareas with (security_invoker = true) as
 SELECT t.id,
    t.local_id,
    t.persona_id,
    t.modulo_id,
    t.control_id,
    t.foto_origen_id,
    t.origen,
    t.titulo,
    t.detalle,
    t.requiere_foto,
    t.estado,
    t.plazo,
    t.vence_en,
    t.vence_original,
    t.completada_en,
    t.completada_a_tiempo,
    t.foto_path,
    t.motivo_no_pude,
    t.prorroga_estado,
    t.prorroga_motivo,
    t.prorroga_pedida_en,
    t.prorroga_respondida_por,
    t.creada_por,
    t.clave,
    t.creado_en,
    pe.nombre AS persona_nombre,
    m.nombre AS modulo_nombre,
    t.estado = 'vencida'::orden_tarea_estado OR t.estado = 'hecha'::orden_tarea_estado AND t.completada_a_tiempo = false AS fuera_de_plazo,
    t.correccion,
    t.correccion_en,
    t.correcciones,
    t.revisada_en,
    t.foto_antes,
    t.marcas,
    m.foto_referencia_path AS modulo_referencia,
    COALESCE(c.nivel_final, c.nivel_ia, c.nivel_declarado) AS control_nivel,
    ( SELECT x.nivel_ia
           FROM orden_controles x
          WHERE x.tarea_id = t.id
          ORDER BY x.enviado_en DESC
         LIMIT 1) AS ia_correccion,
    t.grupo
   FROM orden_tareas t
     LEFT JOIN orden_personas pe ON pe.id = t.persona_id
     LEFT JOIN orden_modulos m ON m.id = t.modulo_id
     LEFT JOIN orden_controles c ON c.id = t.control_id;

-- 8. Crear la tarea de foto de un módulo para todo el equipo de un local (la compu, Ajustes → Crear tarea).
--    Pide foto siempre. El aviso, a los que trabajan hoy; si hoy no trabaja nadie, a todos (les llega
--    el día que vuelven). Los de franco la ven en la app cuando vuelven, si nadie la hizo.
create or replace function orden_crear_tarea_equipo(p_local uuid, p_modulo uuid, p_titulo text,
                                                    p_detalle text default null, p_plazo orden_plazo default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := orden_yo_id(); v_origen orden_tarea_origen; v_grupo uuid := gen_random_uuid(); v_hoy date;
  v_plazo orden_plazo; v_zona text; v_trabajan int; p record; v_id uuid; v_vence timestamptz; v_aviso uuid;
begin
  if coalesce(trim(p_titulo), '') = '' then raise exception 'La tarea necesita un título'; end if;
  if not orden_es_supervisor_de(p_local) then raise exception 'No podés asignar tareas en ese local'; end if;
  if not exists (select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
                  where m.id = p_modulo and s.local_id = p_local and m.activo and s.activo) then
    raise exception 'Ese módulo no es de ese local';
  end if;
  if not exists (select 1 from orden_personas where local_id = p_local and rol = 'vendedor' and activo and aprobado) then
    raise exception 'En ese local todavía no hay nadie aprobado en la app';
  end if;
  v_origen := case when orden_es_servicio() or exists (select 1 from orden_personas where id = v_yo and rol = 'admin')
                   then 'admin' else 'supervisor' end;
  select coalesce(p_plazo, c.plazo_tarea_default, 'manana'), l.zona_horaria into v_plazo, v_zona
    from orden_locales l left join orden_config c on c.local_id = l.id where l.id = p_local;
  v_hoy := orden_fecha_local(p_local);
  select count(*) into v_trabajan from orden_personas
   where local_id = p_local and rol = 'vendedor' and activo and aprobado and orden_trabaja(id, v_hoy);

  for p in select id from orden_personas where local_id = p_local and rol = 'vendedor' and activo and aprobado order by nombre loop
    v_vence := orden_calcular_vencimiento(p.id, v_plazo);
    insert into orden_tareas (local_id, persona_id, modulo_id, origen, titulo, detalle, requiere_foto,
                              plazo, vence_en, creada_por, grupo)
    values (p_local, p.id, p_modulo, v_origen, trim(p_titulo), nullif(trim(p_detalle), ''),
            true, v_plazo, v_vence, v_yo, v_grupo)
    returning id into v_id;
    if v_trabajan = 0 or orden_trabaja(p.id, v_hoy) then
      v_aviso := orden_encolar_aviso(p.id, 'tarea_nueva', 'Nueva tarea: ' || trim(p_titulo),
        'Es de todo el equipo: con que uno mande la foto, alcanza. Vence ' || to_char(v_vence at time zone v_zona, 'DD/MM HH24:MI') || '.',
        '/tareas', 'tarea:' || v_id, 2::smallint);
      -- Fuera de horario: el aviso sale cuando esté en el trabajo.
      perform orden_programar_aviso_(v_aviso, p.id);
    end if;
    return next v_id;
  end loop;
end $$;
revoke all on function orden_crear_tarea_equipo(uuid, uuid, text, text, orden_plazo) from public, anon;
grant execute on function orden_crear_tarea_equipo(uuid, uuid, text, text, orden_plazo) to authenticated;

-- 9. Completar una tarea: la de todo el equipo, la primera foto la cierra para todos ("La hizo X", y sus
--    avisos que todavía no salieron, no salen). Las de todo el grupo se traban juntas y en el mismo orden:
--    si dos la mandan a la vez, la hace uno solo.
create or replace function orden_completar_tarea(p_tarea uuid, p_foto_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t orden_tareas; v_yo uuid := orden_yo_id(); v_control uuid; v_foto uuid; v_grupo uuid; v_quien text;
begin
  select grupo into v_grupo from orden_tareas where id = p_tarea;
  if v_grupo is not null then
    perform 1 from orden_tareas where grupo = v_grupo order by id for update;
  end if;
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if t.persona_id is distinct from v_yo then raise exception 'Esta tarea no es tuya'; end if;
  if t.grupo is not null and t.estado = 'cancelada' and t.motivo_no_pude like 'La hizo %' then
    raise exception '%: queda hecha para todo el equipo', t.motivo_no_pude;
  end if;
  if t.estado not in ('pendiente', 'vencida') then raise exception 'Esta tarea ya está cerrada'; end if;
  if t.requiere_foto and p_foto_path is null then raise exception 'Esta tarea pide una foto'; end if;
  if p_foto_path is not null and p_foto_path not like t.local_id::text || '/%' then
    raise exception 'Ruta de foto inválida';
  end if;

  update orden_tareas
     set estado = 'hecha', completada_en = now(), completada_a_tiempo = now() <= vence_en, foto_path = p_foto_path
   where id = t.id;

  if p_foto_path is not null and t.modulo_id is not null then
    insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, estado, vence_en, enviado_en, tarea_id)
    values (t.local_id, t.modulo_id, v_yo, orden_fecha_local(t.local_id), 'correccion', 'enviado', now(), now(), t.id)
    returning id into v_control;

    insert into orden_fotos (control_id, persona_id, foto_path) values (v_control, v_yo, p_foto_path)
    returning id into v_foto;
    update orden_controles set ultimo_intento_id = v_foto where id = v_control;
  end if;

  if t.grupo is not null then
    select nombre into v_quien from orden_personas where id = v_yo;
    with x as (
      update orden_tareas
         set estado = 'cancelada', motivo_no_pude = 'La hizo ' || coalesce(v_quien, 'otro del equipo'), completada_en = now()
       where grupo = t.grupo and id <> t.id and estado in ('pendiente', 'vencida')
      returning id)
    delete from orden_avisos a using x where a.clave = 'tarea:' || x.id and a.estado in ('pendiente', 'programado');
  end if;

  return jsonb_build_object('tarea_id', t.id, 'control_id', v_control, 'foto_id', v_foto);
end $$;
