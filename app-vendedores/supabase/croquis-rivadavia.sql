-- ═══ El croquis de Rivadavia, armado (14/10/2026) · Equipo VDH ═══
-- Pegalo entero en el editor SQL de Supabase. Hace lo mismo que "Armar el croquis" → Guardar, y después reparte.
-- Lo que pidió Mauricio:
--   · Paredes: izquierda 8, fondo 1 ("Atrás de caja"), derecha 9, frente 2 (atrás de la vidriera) = 20.
--   · La entrada en el medio del frente: el 1 es el módulo de la izquierda de la puerta, y sigue por la pared izquierda.
--   · Arriba de la pared izquierda, los 3 probadores (iguales, la pared llega hasta la esquina).
--   · El medio, desde la puerta hacia el fondo, todo vertical: exhibidor (21), mesa lisa, exhibidor (22), mesa lisa,
--     exhibidor (23) y el banco.
--   · La vidriera: dos paneles, delante de los módulos del frente (con foto, sin número).
--   · Reparto: paredes 1 a 7 Lautaro, 8 a 14 Seba, 15 a 20 Nano; del medio, el 21 Lautaro, el 22 Seba, el 23 Nano.
--     Depósito: 1 y 5 Lautaro, 2, 3 y 4 Seba, 6 y 7 Nano. Mel cubre a todos.
-- Cada módulo que ya estaba sigue con sus fotos y su historia (cambia su número). Se crean 3 en las paredes
-- (2 en la izquierda y el de atrás de la caja), 2 en el medio y los 2 paneles de la vidriera.
-- Si el croquis no está como lo dejó Mauricio (17 en las paredes y 1 en el medio), no hace nada y avisa.
-- Reversible: se vuelve a armar en "Armar el croquis" (los módulos nunca se borran: se apagan).

do $$
declare
  v_riv uuid; v_lau uuid; v_seb uuid; v_nan uuid; s1 uuid; s2 uuid; s3 uuid; d1 uuid; d2 uuid; d3 uuid;
  v_viejos uuid[]; v_dep uuid[]; v_isla uuid; v_orden uuid[]; v_croquis jsonb; v_r jsonb; v_movidos int; v_dep_mov int;
begin
  select id into v_riv from orden_locales where nombre = 'Rivadavia';
  if v_riv is null then raise exception 'No encontramos Rivadavia'; end if;

  -- Cómo está hoy: los 17 de las paredes (1 a 17), el del medio que se llama "1" y los 7 del depósito.
  select array_agg(m.id order by m.numero) into v_viejos
    from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = v_riv and s.tipo = 'salon' and m.activo and not m.isla;
  if coalesce(array_length(v_viejos, 1), 0) <> 17 or exists (
       select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
        where s.local_id = v_riv and s.tipo = 'salon' and m.activo and not m.isla and m.numero > 17) then
    raise exception 'El croquis de Rivadavia ya cambió (no son los 17 de antes): no se toca nada. Avisale a Claude.';
  end if;
  select m.id into v_isla from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = v_riv and s.tipo = 'salon' and m.activo and m.isla and trim(m.nombre) = '1';
  if v_isla is null or (select count(*) from orden_modulos m join orden_sectores s on s.id = m.sector_id
                         where s.local_id = v_riv and s.tipo = 'salon' and m.activo and m.isla) <> 1 then
    raise exception 'Lo del medio de Rivadavia ya cambió: no se toca nada. Avisale a Claude.';
  end if;
  select array_agg(m.id order by m.numero) into v_dep
    from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = v_riv and s.tipo = 'deposito' and m.activo and not m.isla;
  if coalesce(array_length(v_dep, 1), 0) <> 7 then raise exception 'El depósito de Rivadavia no tiene 7 módulos: no se toca nada. Avisale a Claude.'; end if;

  -- El del medio que se llamaba "1" pasa a ser el primer exhibidor (el de al lado de la puerta), con su historia.
  update orden_modulos set nombre = 'Exhibidor 1' where id = v_isla;

  -- El orden nuevo, desde la puerta hacia la izquierda: el del frente a la izquierda de la puerta (hoy el 17) es el 1;
  -- la pared izquierda de abajo hacia arriba (hoy del 1 al 6, y dos nuevos); el de atrás de la caja (nuevo); la pared
  -- derecha de arriba hacia abajo (hoy del 7 al 15); el del frente a la derecha de la puerta (hoy el 16). null = nuevo.
  v_orden := array[v_viejos[17], v_viejos[1], v_viejos[2], v_viejos[3], v_viejos[4], v_viejos[5], v_viejos[6], null, null, null,
                   v_viejos[7], v_viejos[8], v_viejos[9], v_viejos[10], v_viejos[11], v_viejos[12], v_viejos[13], v_viejos[14], v_viejos[15],
                   v_viejos[16]]::uuid[];

  v_croquis := jsonb_build_object('v', 1,
    'salon', jsonb_build_object(
      'paredes', jsonb_build_object(
        'izquierda', '["m","m","m","m","m","m","m","m",{"h":"Probadores","k":"probador"},{"h":"Probadores","k":"probador"},{"h":"Probadores","k":"probador"}]'::jsonb,
        'fondo', '[{"h":""},{"h":"Mesa"},"d",{"h":"Puerta del depósito","k":"deposito"}]'::jsonb,
        'derecha', '["m","m","m","m","m","m","m","m","m"]'::jsonb,
        'frente', '["m","m"]'::jsonb),
      'puerta', '{"pared":"frente","pos":1}'::jsonb,
      'esquinas', '{"ai":"izquierda"}'::jsonb,
      'frente', 'calle',
      'centro', '{"exhibidor 1":{"x":0.5,"y":0.914},"exhibidor 2":{"x":0.5,"y":0.578},"exhibidor 3":{"x":0.5,"y":0.242}}'::jsonb,
      'fijos', '[{"nombre":"","tipo":"caja","x":0.85,"y":0.04,"vertical":false},{"nombre":"","tipo":"mesalisa","x":0.5,"y":0.746,"vertical":true},{"nombre":"","tipo":"mesalisa","x":0.5,"y":0.41,"vertical":true},{"nombre":"","tipo":"banco","x":0.5,"y":0.086,"vertical":true}]'::jsonb),
    'deposito', (select mapa->'croquis'->'deposito' from orden_config where local_id = v_riv));

  -- Guardar como lo hace la pantalla (la misma función), con permiso de administrador sólo para esto.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_r := orden_croquis_guardar(v_riv,
    '{"forma":"rectangulo","izquierda":8,"fondo":1,"derecha":9,"frente":2,"deposito":7,"forma_deposito":"rectangulo"}'::jsonb,
    array['Exhibidor 1', 'Exhibidor 2', 'Exhibidor 3', 'Vidriera izq.', 'Vidriera der.'],
    v_orden, v_dep, v_croquis);
  perform set_config('request.jwt.claims', '', true);

  -- El de atrás de la caja, con su nombre.
  update orden_modulos m set nombre = 'Atrás de caja'
    from orden_sectores s where s.id = m.sector_id and s.local_id = v_riv and s.tipo = 'salon' and m.activo and not m.isla and m.numero = 10;

  -- El reparto.
  select id into v_lau from orden_personas where local_id = v_riv and activo and nombre = 'Lautaro';
  select id into v_seb from orden_personas where local_id = v_riv and activo and nombre = 'Seba';
  select id into v_nan from orden_personas where local_id = v_riv and activo and nombre = 'Nano';
  select id into s1 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 1 and activo;
  select id into s2 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 2 and activo;
  select id into s3 from orden_sectores where local_id = v_riv and tipo = 'salon' and numero = 3 and activo;
  select id into d1 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 1 and activo;
  select id into d2 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 2 and activo;
  select id into d3 from orden_sectores where local_id = v_riv and tipo = 'deposito' and numero = 3 and activo;
  if v_lau is null or v_seb is null or v_nan is null or s1 is null or s2 is null or s3 is null or d1 is null or d2 is null or d3 is null then
    raise exception 'Faltan Lautaro, Seba o Nano, o los sectores: no se toca nada. Avisale a Claude.';
  end if;
  update orden_sectores set responsable_id = v_lau where id in (s1, d2);
  update orden_sectores set responsable_id = v_seb where id in (s2, d3);
  update orden_sectores set responsable_id = v_nan where id in (s3, d1);
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
  with destino as (
    select m.id, case when m.numero in (1, 5) then d2 when m.numero in (2, 3, 4) then d3 else d1 end as sector
      from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = v_riv and s.tipo = 'deposito' and m.activo and not m.isla and m.numero between 1 and 7
  )
  update orden_modulos m set sector_id = d.sector from destino d where d.id = m.id and m.sector_id is distinct from d.sector;
  get diagnostics v_dep_mov = row_count;
  perform orden_controles_reasignar(s1); perform orden_controles_reasignar(s2); perform orden_controles_reasignar(s3);
  perform orden_controles_reasignar(d1); perform orden_controles_reasignar(d2); perform orden_controles_reasignar(d3);

  raise notice 'Listo: el croquis de Rivadavia armado (% módulos nuevos) y repartido.', coalesce(v_r->>'creados', '0');
end $$;

-- Cómo quedó (para mirar):
select s.tipo, s.numero as sector, r.nombre as lo_tiene,
       string_agg(case when m.isla then m.nombre else m.numero::text end, ', ' order by m.isla, m.numero) as modulos
  from orden_sectores s
  join orden_locales l on l.id = s.local_id and l.nombre = 'Rivadavia'
  left join orden_personas r on r.id = s.responsable_id
  left join orden_modulos m on m.sector_id = s.id and m.activo
 where s.activo
 group by s.tipo, s.numero, r.nombre
 order by s.tipo desc, s.numero;
