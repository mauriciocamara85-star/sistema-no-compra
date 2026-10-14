-- ═══ Arranque de Rivadavia (14/10/2026) · Equipo VDH: se termina la prueba y empiezan los chicos ═══
-- Pegalo entero en el editor SQL de Supabase. Sólo cambia datos de Rivadavia (no la app). Se puede correr más de una vez.
--   1. El reparto que pidió Mauricio. Salón, las paredes: 1 a 7 Lautaro, 8 a 14 Seba, del 15 en adelante Nano; los del
--      medio, uno para cada uno (el primero Lautaro, el segundo Seba, el tercero Nano). Depósito: 1 y 5 Lautaro,
--      2, 3 y 4 Seba, 6 y 7 Nano.
--      Mel sigue cubriendo.
--   ANTES DE CORRERLO: guardá el croquis como queda ("Armar el croquis", con los 7 del depósito), porque el reparto
--   va por número. Si el depósito todavía no tiene 7, reparte los que hay y avisa (corrélo de nuevo después).
--   2. La hora límite de las fotos vuelve a las 18:00 (para la prueba estaba a las 20:30).
--   3. Se borra el vendedor "Prueba" y lo suyo: PIN, cuenta interna, controles, su foto, su tarea, avisos y test.
--   4. Se borra lo que inventó la prueba: el recordatorio de los martes ("Entra mercadería…") y el producto testigo
--      de esta semana (sólo si nadie cargó nada).
-- Reversible: el reparto y la hora, sí (Por local → "Repartir y ponerles nombre"; Ajustes → Horarios). Lo borrado
-- de la prueba, no (eran datos de prueba). La foto de "Prueba" queda como un archivo suelto: Supabase no deja
-- borrar archivos desde SQL.

do $$
declare
  v_riv uuid; v_lau uuid; v_seb uuid; v_nan uuid; v_pru uuid;
  s1 uuid; s2 uuid; s3 uuid; d1 uuid; d2 uuid; d3 uuid; v_movidos int := 0; v_dep_mov int := 0; v_dep int; v_sem uuid; v_txt text := '';
begin
  select id into v_riv from orden_locales where nombre = 'Rivadavia';
  if v_riv is null then raise exception 'No encontramos Rivadavia'; end if;
  /* La gente: uno de cada uno (si hubiera dos con el mismo nombre, mejor parar). */
  if (select count(*) from orden_personas where local_id = v_riv and activo and nombre = 'Lautaro') <> 1
     or (select count(*) from orden_personas where local_id = v_riv and activo and nombre = 'Seba') <> 1
     or (select count(*) from orden_personas where local_id = v_riv and activo and nombre = 'Nano') <> 1 then
    raise exception 'En Rivadavia tiene que haber un Lautaro, un Seba y un Nano (activos): revisá Equipo';
  end if;
  select id into v_lau from orden_personas where local_id = v_riv and activo and nombre = 'Lautaro';
  select id into v_seb from orden_personas where local_id = v_riv and activo and nombre = 'Seba';
  select id into v_nan from orden_personas where local_id = v_riv and activo and nombre = 'Nano';
  select id into s1 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 1 and activo;
  select id into s2 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 2 and activo;
  select id into s3 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 3 and activo;
  select id into d1 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 1 and activo;
  select id into d2 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 2 and activo;
  select id into d3 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 3 and activo;
  if s1 is null or s2 is null or s3 is null then raise exception 'Faltan los sectores 1, 2 y 3 del salón de Rivadavia'; end if;
  if d1 is null or d2 is null or d3 is null then raise exception 'Faltan los sectores 1, 2 y 3 del depósito de Rivadavia'; end if;

  -- 1. Quién tiene cada sector (Mel sigue cubriendo: no se toca quién cubre).
  update orden_sectores set responsable_id = v_lau where id = s1;
  update orden_sectores set responsable_id = v_seb where id = s2;
  update orden_sectores set responsable_id = v_nan where id = s3;
  update orden_sectores set responsable_id = v_nan where id = d1;
  update orden_sectores set responsable_id = v_lau where id = d2;
  update orden_sectores set responsable_id = v_seb where id = d3;

  --    Las paredes, por su número: 1 a 7, 8 a 14, 15 en adelante. Los del medio (se ven numerados a continuación de
  --    las paredes, en orden), uno para cada uno: Lautaro, Seba, Nano (y si hubiera más, vuelve a empezar).
  with paredes as (
    select m.id, case when m.numero <= 7 then s1 when m.numero <= 14 then s2 else s3 end as sector
      from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = v_riv and s.tipo = 'salon' and m.activo and not m.isla
  ), medio as (
    select m.id, (array[s1, s2, s3])[((row_number() over (order by m.numero) - 1) % 3 + 1)::int] as sector
      from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = v_riv and s.tipo = 'salon' and m.activo and m.isla
       and lower(trim(m.nombre)) !~ '^vidriera( izq\.| der\.)?$'
  ), destino as (
    select id, sector from paredes union all select id, sector from medio
  )
  update orden_modulos m set sector_id = d.sector from destino d where d.id = m.id and m.sector_id is distinct from d.sector;
  get diagnostics v_movidos = row_count;

  --    El depósito, por número: 1 y 5 Lautaro, 2 a 4 Seba, 6 y 7 Nano (del 8 en adelante, si hubiera, no se tocan).
  with destino as (
    select m.id, case when m.numero in (1, 5) then d2 when m.numero in (2, 3, 4) then d3 else d1 end as sector
      from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = v_riv and s.tipo = 'deposito' and m.activo and not m.isla and m.numero between 1 and 7
  )
  update orden_modulos m set sector_id = d.sector from destino d where d.id = m.id and m.sector_id is distinct from d.sector;
  get diagnostics v_dep_mov = row_count;
  select count(*) into v_dep from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = v_riv and s.tipo = 'deposito' and m.activo and not m.isla;
  if v_dep < 7 then
    v_txt := v_txt || ' OJO: el depósito tiene ' || v_dep || ' módulos: armá los 7 en "Armar el croquis", guardá y corré esto de nuevo.';
  end if;

  --    Lo pendiente de hoy en adelante, a quien le toca ahora.
  perform orden_controles_reasignar(s1); perform orden_controles_reasignar(s2); perform orden_controles_reasignar(s3);
  perform orden_controles_reasignar(d1); perform orden_controles_reasignar(d2); perform orden_controles_reasignar(d3);

  -- 2. La hora límite de las fotos, a las 18:00.
  update orden_config set hora_limite = '18:00' where local_id = v_riv;

  -- 3. "Prueba" y lo suyo.
  select id into v_pru from orden_personas where nombre = 'Prueba' and local_id = v_riv;
  if v_pru is not null then
    update orden_sectores set responsable_id = null where responsable_id = v_pru;
    update orden_sectores set suplente_id = null where suplente_id = v_pru;
    delete from orden_tareas
     where persona_id = v_pru
        or control_id in (select id from orden_controles where persona_id = v_pru)
        or foto_origen_id in (select id from orden_fotos where persona_id = v_pru);
    update orden_controles set ultimo_intento_id = null where persona_id = v_pru;
    delete from orden_fotos where persona_id = v_pru;
    delete from orden_controles where persona_id = v_pru;
    perform orden_borrar_cuenta_interna(v_pru);       -- la cuenta interna (y sus sesiones)
    delete from orden_personas where id = v_pru;      -- avisos, test, PIN y avisos del celular se van con la persona
    v_txt := ' Se borró "Prueba".';
  end if;

  -- 4. Lo que inventó la prueba.
  delete from orden_recordatorios where local_id = v_riv and texto = 'Entra mercadería: la prioridad es ordenarla entre todos.';
  select id into v_sem from testigo_semanas where local_id = v_riv and semana = date '2026-10-12';
  if v_sem is not null and not exists (
      select 1 from testigo_items where semana_id = v_sem
         and (cargado_en is not null or video_path is not null or stock_sistema is not null or cantidad_real is not null or vendida is not null)) then
    delete from testigo_items where semana_id = v_sem;
    delete from testigo_semanas where id = v_sem;
    v_txt := v_txt || ' Se borró el producto testigo de prueba.';
  end if;

  raise notice 'Listo. Salón: 1-7 Lautaro, 8-14 Seba, 15 en adelante Nano, y los del medio uno para cada uno (% cambiaron de sector). Depósito: 1 y 5 Lautaro, 2-4 Seba, 6 y 7 Nano (% cambiaron). Hora límite 18:00.%', v_movidos, v_dep_mov, v_txt;
end $$;

-- Cómo quedó (para mirar):
select s.tipo, s.numero as sector, r.nombre as lo_tiene, c.nombre as lo_cubre,
       string_agg(m.numero::text, ', ' order by m.numero) filter (where m.id is not null) as modulos
  from orden_sectores s
  join orden_locales l on l.id = s.local_id and l.nombre = 'Rivadavia'
  left join orden_personas r on r.id = s.responsable_id
  left join orden_personas c on c.id = s.suplente_id
  left join orden_modulos m on m.sector_id = s.id and m.activo
 where s.activo
 group by s.tipo, s.numero, r.nombre, c.nombre
 order by s.tipo desc, s.numero;
