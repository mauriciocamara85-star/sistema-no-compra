-- =====================================================================
-- Módulo VDH · Migración 26 (SQL 116), 14/10/2026: la vidriera, por turnos.
--
-- Pedido de Mauricio: "la vidriera es una tarea de todos", "los mismos días
-- que los módulos" (no todos los días). Recomendación aceptada: por turnos.
--
-- La vidriera son los módulos del medio que se llaman "Vidriera",
-- "Vidriera izq." o "Vidriera der." (los arma "Armar el croquis"). Los días de
-- control (los mismos que los módulos), su foto le toca a uno de los que
-- tienen sectores del salón (en Rivadavia: Lautaro, Seba, Nano): al que la
-- tuvo menos veces en las últimas 8 semanas, entre los que trabajan ese día
-- (así queda parejo aunque alguien tenga franco justo un día de control). Si
-- hay dos paneles, los dos le tocan al mismo ese día. No entra en las
-- sorpresas, ni en "Repartir parejo", ni cambia de mano cuando se cambia el
-- responsable de un sector.
--
-- Se cambian frases exactas de las funciones como están hoy en la base (así
-- no se pisa nada de lo que les cambiaron otros SQL). Si alguna frase no
-- está, avisa con un error y no cambia nada.
-- Reversible: volver a reemplazar las frases al revés y borrar las dos
-- funciones nuevas (la vidriera vuelve a ser del responsable de su sector).
-- =====================================================================

create or replace function orden_es_vidriera(p_isla boolean, p_nombre text)
returns boolean language sql immutable as $$
  select coalesce(p_isla, false) and lower(trim(coalesce(p_nombre, ''))) ~ '^vidriera( izq\.| der\.)?$'
$$;

/** A quién le toca la vidriera de un local ese día: entre los que trabajan ese día (los responsables de los sectores
    del salón), al que la tuvo menos veces en las últimas 8 semanas; si empatan, al que la tuvo hace más tiempo; si
    siguen empatados, en el orden de los sectores. Así queda parejo aunque alguien tenga franco justo un día de control. */
create or replace function orden_turno_vidriera(p_local uuid, p_fecha date)
returns uuid language sql stable security definer set search_path = public as $$
  with gente as (
    select responsable_id as p, min(numero) as orden from orden_sectores
     where local_id = p_local and tipo = 'salon' and activo and responsable_id is not null
     group by responsable_id
  ), antes as (
    select c.persona_id as p, c.fecha from orden_controles c join orden_modulos m on m.id = c.modulo_id
     where c.local_id = p_local and c.tipo = 'programado' and c.fecha < p_fecha and orden_es_vidriera(m.isla, m.nombre)
     group by c.persona_id, c.fecha
  )
  select g.p from gente g
   where orden_trabaja(g.p, p_fecha)
   order by (select count(*) from antes a where a.p = g.p and a.fecha >= p_fecha - 56),
            (select max(a.fecha) from antes a where a.p = g.p) nulls first,
            g.orden
   limit 1
$$;

do $$
begin
  revoke all on function orden_turno_vidriera(uuid, date) from public, anon;
  grant execute on function orden_turno_vidriera(uuid, date) to authenticated, service_role;
end $$;

do $$
declare
  v_def text; v_nuevo text;
  /* Las frases, sin los retornos de carro que agrega pegar el texto desde Windows (la base tampoco los tiene en cuenta). */
  a1 text := replace('          from orden_modulos m where m.sector_id = s.id and m.activo
          on conflict do nothing;
          get diagnostics v_n = row_count; v_generados := v_generados + v_n;
        end loop;
      end if;', chr(13), '');
  b1 text := replace('          from orden_modulos m where m.sector_id = s.id and m.activo and not orden_es_vidriera(m.isla, m.nombre)
          on conflict do nothing;
          get diagnostics v_n = row_count; v_generados := v_generados + v_n;
        end loop;
        -- La vidriera (SQL 116): es de todos, por turnos (un día de control a cada uno).
        v_persona := orden_turno_vidriera(l.id, v_hoy);
        if v_persona is not null then
          insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en)
          select l.id, m.id, v_persona, v_hoy, ''programado'', orden_en_hora(l.id, v_hoy, cfg.hora_limite)
          from orden_modulos m join orden_sectores sv on sv.id = m.sector_id
          where sv.local_id = l.id and sv.tipo = ''salon'' and sv.activo and m.activo and orden_es_vidriera(m.isla, m.nombre)
          on conflict do nothing;
          get diagnostics v_n = row_count; v_generados := v_generados + v_n;
        end if;
      end if;', chr(13), '');
  a2 text := 'select array_agg(m.id order by m.numero) into v_mods from orden_modulos m where m.sector_id = s.id and m.activo;';
  b2 text := 'select array_agg(m.id order by m.numero) into v_mods from orden_modulos m where m.sector_id = s.id and m.activo and not orden_es_vidriera(m.isla, m.nombre);';
  a3 text := replace('   where s.local_id = p_local and s.tipo = v_tipo and s.activo and m.activo;
  v_n := coalesce(array_length(v_ids, 1), 0);', chr(13), '');
  b3 text := replace('   where s.local_id = p_local and s.tipo = v_tipo and s.activo and m.activo and not orden_es_vidriera(m.isla, m.nombre);
  v_n := coalesce(array_length(v_ids, 1), 0);', chr(13), '');
  a4 text := '   where m.id = c.modulo_id and m.sector_id = p_sector';
  b4 text := '   where m.id = c.modulo_id and m.sector_id = p_sector and not orden_es_vidriera(m.isla, m.nombre)';
begin
  /* 1. El reloj: la vidriera fuera del control de cada sector y de las sorpresas; aparte, por turnos. */
  v_def := replace(pg_get_functiondef('orden_tick(timestamptz)'::regprocedure), chr(13), '');
  if position('orden_turno_vidriera' in v_def) = 0 then
    if position(a1 in v_def) = 0 or position(a2 in v_def) = 0 then
      raise exception 'SQL 116: orden_tick no tiene lo que se esperaba; no se cambió nada. Avisale a Claude.';
    end if;
    execute replace(replace(v_def, a1, b1), a2, b2);
  end if;
  v_def := replace(pg_get_functiondef('orden_tick(timestamptz)'::regprocedure), chr(13), '');
  if position(b1 in v_def) = 0 or position(b2 in v_def) = 0 then
    raise exception 'SQL 116: orden_tick no quedó como se esperaba; no se cambió nada. Avisale a Claude.';
  end if;

  /* 2. "Repartir parejo": sin la vidriera. */
  v_def := replace(pg_get_functiondef('orden_mapa_repartir(uuid, text)'::regprocedure), chr(13), '');
  if position('orden_es_vidriera' in v_def) = 0 then
    if position(a3 in v_def) = 0 then raise exception 'SQL 116: orden_mapa_repartir no tiene lo que se esperaba; no se cambió nada. Avisale a Claude.'; end if;
    execute replace(v_def, a3, b3);
  end if;
  if position(b3 in replace(pg_get_functiondef('orden_mapa_repartir(uuid, text)'::regprocedure), chr(13), '')) = 0 then
    raise exception 'SQL 116: orden_mapa_repartir no quedó como se esperaba; no se cambió nada. Avisale a Claude.';
  end if;

  /* 3. Cambiar el responsable de un sector no le pasa la vidriera (es por turnos). */
  v_def := replace(pg_get_functiondef('orden_controles_reasignar(uuid)'::regprocedure), chr(13), '');
  if position('orden_es_vidriera' in v_def) = 0 then
    if position(a4 in v_def) = 0 then raise exception 'SQL 116: orden_controles_reasignar no tiene lo que se esperaba; no se cambió nada. Avisale a Claude.'; end if;
    execute replace(v_def, a4, b4);
  end if;
  if position(b4 in replace(pg_get_functiondef('orden_controles_reasignar(uuid)'::regprocedure), chr(13), '')) = 0 then
    raise exception 'SQL 116: orden_controles_reasignar no quedó como se esperaba; no se cambió nada. Avisale a Claude.';
  end if;
end $$;
