-- =====================================================================
-- Módulo VDH · Migración 62 (SQL 210), 31/10/2026: el test semanal sale
-- un día y una hora fijos, iguales para todos.
--
-- Pedido de Mauricio (31/10, con la captura de Ajustes → Tests): "que el
-- martes salga el test para todos, y dependiendo del franco de cada uno
-- salga un día antes. Lo puede contestar aunque se haya vencido. Quiero
-- que esté para todos los lugares el mismo día para que podamos
-- controlar. Necesito saber en qué día va a llegar para ver si el
-- miércoles todo lo hicieron. Martes a las 2 de la tarde. Y la opción
-- aparte, que sea aleatoria, para más adelante."
--
-- 1. orden_config: desafio_cuando ('fijo' | 'azar'), desafio_dia (1-7)
--    y desafio_hora. Todos los locales arrancan en fijo, martes, 14 h
--    (Ajustes → Tests los cambia para todos juntos).
-- 2. orden_tick, bloque 4b: con 'fijo', a cada vendedor le llega el día
--    fijo a esa hora; al que tiene franco, el día anterior que trabaja
--    (orden_dia_que_le_toca, la misma regla del salón). Vence ese día a
--    las 23:59. Sin "ponerse al día": si el local se prende a mitad de
--    semana, el primero sale la semana siguiente. 'azar' queda igual que
--    antes. De paso: un test especial (con título) ya no le saca a nadie
--    el de la semana (antes, si le llegaba uno especial primero, esa
--    semana se quedaba sin el suyo). El recordatorio "Hoy vence tu test"
--    no sale si el test llegó hace menos de una hora.
-- 3. orden_desafio_responder: un test vencido se puede contestar igual
--    (queda como tarde) hasta una semana después de que le llegó, cuando
--    le llega el siguiente.
-- 4. orden_desafio_mio: el mismo criterio para "abierto", y devuelve
--    'cierra_en' (hasta cuándo se puede contestar).
--
-- No borra datos. Reversible: deshacer-210.sql.
-- =====================================================================

-- 1. Cuándo sale: por defecto, el martes a las 14 en todos los locales.
alter table orden_config add column if not exists desafio_cuando text not null default 'fijo';
alter table orden_config add column if not exists desafio_dia smallint not null default 2;
alter table orden_config add column if not exists desafio_hora time not null default '14:00';
alter table orden_config drop constraint if exists orden_config_desafio_cuando_ck;
alter table orden_config add constraint orden_config_desafio_cuando_ck check (desafio_cuando in ('fijo', 'azar'));
alter table orden_config drop constraint if exists orden_config_desafio_dia_ck;
alter table orden_config add constraint orden_config_desafio_dia_ck check (desafio_dia between 1 and 7);
comment on column orden_config.desafio_cuando is
  'SQL 210: cuándo sale el test semanal. fijo = el mismo día (desafio_dia) y hora (desafio_hora) para todos, y al que tiene franco el día anterior que trabaja; azar = un día y una hora distintos para cada uno, como antes.';
comment on column orden_config.desafio_dia is 'SQL 210: el día fijo del test semanal (ISO: 1 lunes … 7 domingo). Por defecto, el martes.';
comment on column orden_config.desafio_hora is 'SQL 210: la hora fija del test semanal, de la Argentina. Por defecto, las 14.';

-- 2. El reloj (orden_tick): el bloque del test semanal; lo demás queda igual.
CREATE OR REPLACE FUNCTION public.orden_tick(p_ahora timestamp with time zone DEFAULT now())
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
  v_categoria text; v_dif smallint; v_vence timestamptz;
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

      -- 4b. El test de conocimiento de la semana. No cuenta para faltas: es para aprender.
      --     SQL 210 (Mauricio, 31/10): por defecto sale el mismo día y a la misma hora para todos (el
      --     martes a las 14 h, Ajustes → Tests), así al otro día se controla quién lo hizo. Al que tiene
      --     franco ese día le llega el día anterior que trabaja (la regla del salón). Vence ese mismo día a
      --     la noche y lo puede contestar igual hasta una semana después (orden_desafio_responder). Si un
      --     local se prende a mitad de semana, el primero sale el día fijo de la semana siguiente.
      --     "Al azar" sigue como antes: un día y una hora distintos para cada uno.
      if cfg.desafio_activo then
        if v_hora >= (case when cfg.desafio_cuando = 'fijo' then cfg.desafio_hora else cfg.hora_aviso_1 end) then
          for p in select pe.id from orden_personas pe
                   where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' and orden_trabaja(pe.id, v_hoy)
                     -- sólo el de la semana (sin título): uno especial se suma, no lo reemplaza (SQL 210)
                     and not exists (select 1 from orden_desafios d where d.persona_id = pe.id and d.semana = v_semana and d.titulo is null)
          loop
            if cfg.desafio_cuando = 'fijo' then
              continue when orden_dia_que_le_toca(p.id, v_semana + (cfg.desafio_dia - 1)::int) is distinct from v_hoy;
              v_vence := orden_en_hora(l.id, v_hoy, '23:59'::time);
            else
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
              v_vence := orden_calcular_vencimiento(p.id, 'manana', p_ahora);
            end if;

            v_categoria := cfg.desafio_categorias[1 + (extract(week from v_hoy)::int % array_length(cfg.desafio_categorias, 1))];
            v_dif := orden_desafio_dificultad(p.id);
            v_preg := orden_desafio_elegir(p.id, v_categoria, v_dif, cfg.desafio_preguntas);
            continue when v_preg is null;

            insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, creado_en)
            values (l.id, p.id, v_semana, v_categoria, v_dif, v_preg, array_length(v_preg, 1), v_vence, p_ahora)
            on conflict do nothing
            returning id into v_falta;
            continue when v_falta is null;

            perform orden_encolar_aviso(p.id, 'desafio', 'Llegó tu test de conocimiento',
              array_length(v_preg, 1) || ' preguntas rápidas de '
                || case v_categoria when 'producto' then 'telas y molderías' else 'cómo trabajamos en el local' end
                || '. Si le errás, no pasa nada: es para aprender.',
              '/desafio', 'desafio:' || v_falta, 2::smallint);
          end loop;
        end if;

        -- recordatorio el día que vence (no al rato de llegar: si salió hace menos de una hora, no)
        if v_hora >= cfg.hora_aviso_2 then
          for r in select d.* from orden_desafios d
                   where d.local_id = l.id and d.terminado_en is null and d.vence_en > p_ahora
                     and (d.vence_en at time zone l.zona_horaria)::date = v_hoy
                     and d.creado_en <= p_ahora - interval '1 hour' loop
            perform orden_encolar_aviso(r.persona_id, 'desafio', 'Hoy vence tu test de conocimiento',
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

-- 3. Contestar un test vencido.
CREATE OR REPLACE FUNCTION public.orden_desafio_responder(p_desafio uuid, p_pregunta uuid, p_opcion smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d orden_desafios; q orden_preguntas; v_ok boolean;
begin
  select * into d from orden_desafios where id = p_desafio for update;
  if not found or d.persona_id is distinct from orden_yo_id() then raise exception 'Este test no es tuyo'; end if;
  if d.terminado_en is not null then raise exception 'Ya terminaste este test'; end if;
  -- SQL 210: vencido también se contesta (queda como tarde), hasta una semana después de que le llegó.
  if now() > greatest(d.vence_en, d.creado_en + interval '7 days') then raise exception 'Este test ya cerró'; end if;
  if not (p_pregunta = any(d.preguntas)) then raise exception 'Esa pregunta no es de tu test'; end if;
  if d.respuestas ? p_pregunta::text then raise exception 'Ya respondiste esa pregunta'; end if;

  select * into q from orden_preguntas where id = p_pregunta;
  if p_opcion < 1 or p_opcion > array_length(q.opciones, 1) then raise exception 'Opción inválida'; end if;
  v_ok := p_opcion = q.correcta;

  update orden_desafios
     set respuestas = respuestas || jsonb_build_object(p_pregunta::text, p_opcion),
         puntaje = puntaje + case when v_ok then 1 else 0 end
   where id = d.id returning * into d;

  if (select count(*) from jsonb_object_keys(d.respuestas)) >= d.total then
    update orden_desafios set terminado_en = now() where id = d.id returning * into d;
  end if;

  return jsonb_build_object('acerto', v_ok, 'correcta', q.correcta, 'explicacion', q.explicacion,
                            'puntaje', d.puntaje, 'total', d.total, 'terminado', d.terminado_en is not null);
end $function$;

-- 4. El test de cada uno en Equipo VDH: el vencido sin terminar sigue abierto (una semana).
CREATE OR REPLACE FUNCTION public.orden_desafio_mio()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d orden_desafios; v_yo uuid := orden_yo_id();
begin
  select * into d from orden_desafios where persona_id = v_yo
   -- SQL 210: abierto = sin terminar y hasta una semana después de que le llegó, aunque haya vencido.
   order by (terminado_en is null and now() <= greatest(vence_en, creado_en + interval '7 days')) desc, creado_en desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', d.id, 'semana', d.semana, 'categoria', d.categoria, 'dificultad', d.dificultad, 'titulo', d.titulo,
    'vence_en', d.vence_en, 'terminado_en', d.terminado_en,
    'cierra_en', greatest(d.vence_en, d.creado_en + interval '7 days'),
    'puntaje', d.puntaje, 'total', d.total,
    'abiertos', (select count(*)::int from orden_desafios o where o.persona_id = v_yo and o.terminado_en is null and now() <= greatest(o.vence_en, o.creado_en + interval '7 days')),
    'preguntas', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'tema', q.tema, 'pregunta', q.pregunta, 'imagen_path', q.imagen_path, 'opciones', to_jsonb(q.opciones),
        'respondida', d.respuestas ? q.id::text,
        'elegida', (d.respuestas ->> q.id::text)::int,
        'correcta', case when d.respuestas ? q.id::text then q.correcta end,
        'explicacion', case when d.respuestas ? q.id::text then q.explicacion end)
        order by x.pos)
      from unnest(d.preguntas) with ordinality x(pid, pos) join orden_preguntas q on q.id = x.pid));
end $function$;
