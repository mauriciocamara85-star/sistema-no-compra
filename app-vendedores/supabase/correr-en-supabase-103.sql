-- ═══ SQL 103 (13/10/2026) · Impecable: activar la prueba ═══
-- Va DESPUÉS del 102 (si no corriste el 102, primero ése). Pegalo entero en el
-- editor SQL de Supabase. Se puede correr más de una vez.
--   · Sólo trabaja (le tocan controles, desafío y avisos) quien ya está
--     aprobado en la app. Así Lautaro, Nano, Seba y Mel no se llenan de
--     controles vencidos hasta que entren.
--   · Deja Rivadavia listo para probar hoy con "Prueba": su sector, el
--     producto testigo de hoy, un recordatorio, una tarea, el desafío y los
--     controles de hoy (hasta las 20:30). Ver el detalle abajo.
--   · Reversible: lo de "Prueba" se vuelve a Lautaro desde Por local →
--     "Repartir y ponerles nombre"; la hora límite, en Ajustes. No borra nada
--     tuyo (sólo 3 controles viejos de prueba y la planilla vacía de esta semana).

-- =====================================================================
-- Módulo VDH · Migración 15 (SQL 103, primera parte): sólo trabaja quien ya
-- está aprobado en la app.
--
-- Por qué (13/10/2026, al prender el reloj para probar): orden_trabaja decide
-- a quién le tocan los controles del día, el desafío y los avisos. Miraba si
-- la persona está activa, si el local abre y sus francos, pero no si ya usa la
-- app: Lautaro, Nano, Seba y Mel (cargados, sin entrar todavía) se iban a
-- llenar de controles vencidos y de avisos de "no mandó". Ahora, quien todavía
-- no está aprobado no "trabaja" para Impecable: su sector pasa al que cubre
-- (si él sí está aprobado) o no genera nada. El día que entran y los aprueban,
-- empiezan a recibir sus controles.
-- Reversible: volver a crear la función sin "and p.aprobado".
-- =====================================================================

create or replace function orden_trabaja(p_persona uuid, p_fecha date) returns boolean
language sql stable as $$
  select coalesce((
    select p.activo
       and p.aprobado
       and p.local_id is not null
       and orden_local_abre(p.local_id, p_fecha)
       and not (extract(isodow from p_fecha)::smallint = any(p.dias_libres))
       and not exists (select 1 from orden_ausencias a
                       where a.persona_id = p.id and p_fecha between a.desde and a.hasta)
    from orden_personas p where p.id = p_persona), false)
$$;

-- =====================================================================
-- SQL 103, segunda parte: dejar Rivadavia listo para probar la app HOY con
-- el vendedor "Prueba" (pedido de Mauricio, 13/10/2026: "activá todo, me
-- pongo como un vendedor de prueba"). Sólo para la base real; no es parte de
-- la app. Si "Prueba" o Rivadavia no están, no hace nada.
--   1. "Prueba" queda a cargo del sector 1 del salón (módulos 1 a 5) y del
--      sector 2 del depósito, que eran de Lautaro. PARA VOLVER: Por local →
--      "Repartir y ponerles nombre" → tocar el sector → Lautaro.
--   2. Se borran los 3 controles viejos de "Prueba" (de una prueba del 12/10,
--      sin foto).
--   3. Hoy se puede mandar fotos hasta las 20:30 (estaba a las 18). Se vuelve
--      en Ajustes → Horarios y funciones → "Hora límite".
--   4. Producto testigo HOY en Rivadavia con los productos de la planilla
--      (Last Chance, Born Hi, Equitanti, Denim Vint, Chess Over). La planilla
--      de esta semana que estaba vacía ("Producto 1" y "Producto 2", sin nada
--      cargado) se reemplaza por estos.
--   5. Un recordatorio para hoy, una tarea para "Prueba" y su desafío de la
--      semana.
--   6. Se generan ya los controles de hoy (lo mismo que hace el reloj).
-- =====================================================================
do $$
declare
  v_riv uuid; v_pru uuid; v_cfg orden_config; v_sem uuid; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_n int := 0; v_preg uuid[]; v_cat text; v_des uuid; v_tarea uuid;
begin
  select id into v_riv from orden_locales where nombre = 'Rivadavia';
  select id into v_pru from orden_personas where nombre = 'Prueba' and local_id = v_riv and activo and aprobado;
  if v_riv is null or v_pru is null then raise notice 'No están Rivadavia o "Prueba": no se activa nada'; return; end if;

  -- 1. "Prueba" a cargo del sector 1 del salón y del 2 del depósito.
  update orden_sectores set responsable_id = v_pru
   where local_id = v_riv and ((tipo = 'salon' and numero = 1) or (tipo = 'deposito' and numero = 2));

  -- 2. Los controles viejos de "Prueba", sin foto.
  delete from orden_controles c
   where c.persona_id = v_pru and c.fecha < v_hoy and c.estado = 'pendiente'
     and not exists (select 1 from orden_fotos f where f.control_id = c.id);

  -- 3. Hasta las 20:30 para mandar las fotos.
  update orden_config set hora_limite = '20:30' where local_id = v_riv;

  -- 4. Producto testigo hoy.
  insert into testigo_semanas (local_id, semana, fecha, cargado_por)
  values (v_riv, v_hoy - (extract(isodow from v_hoy)::int - 1), v_hoy, (select id from orden_personas where rol = 'admin' and activo order by nombre limit 1))
  on conflict (local_id, semana) do update set fecha = excluded.fecha, cargada_en = null, cargada_por = null
  returning id into v_sem;
  delete from testigo_items
   where semana_id = v_sem and producto in ('Producto 1', 'Producto 2') and cargado_en is null
     and stock_sistema is null and cantidad_real is null and video_path is null;
  insert into testigo_items (semana_id, item, producto, color)
  select v_sem, (select coalesce(max(item), 0) from testigo_items where semana_id = v_sem) + x.n, x.producto, x.color
    from (values (1, 'Last Chance', 'NE'), (2, 'Born Hi', 'NE'), (3, 'Equitanti', 'NE'), (4, 'Denim Vint', 'AZ'), (5, 'Chess Over', 'BE')) x(n, producto, color)
   where not exists (select 1 from testigo_items i where i.semana_id = v_sem and lower(i.producto) = lower(x.producto) and lower(coalesce(i.color, '')) = lower(x.color));

  -- 5. Un recordatorio para hoy (si no hay uno), una tarea y el desafío de la semana.
  if not exists (select 1 from orden_recordatorios where local_id = v_riv and dia = extract(isodow from v_hoy) and activo) then
    insert into orden_recordatorios (local_id, dia, texto)
    values (v_riv, extract(isodow from v_hoy), 'Entra mercadería: la prioridad es ordenarla entre todos.');
  end if;
  insert into orden_tareas (local_id, persona_id, origen, titulo, detalle, requiere_foto, plazo, vence_en, clave, creado_en)
  values (v_riv, v_pru, 'admin', 'Ordenar el perchero de la entrada', 'Es una tarea de prueba: marcala como hecha con una foto.', true, 'hoy',
          orden_en_hora(v_riv, v_hoy, '20:30'), 'prueba-tarea:' || v_hoy, now())
  on conflict do nothing
  returning id into v_tarea;
  if v_tarea is not null then
    perform orden_encolar_aviso(v_pru, 'tarea', 'Nueva tarea: Ordenar el perchero de la entrada', 'Vence hoy a las 20:30.', '/tareas',
                                'tarea:' || v_tarea, 2::smallint);
  end if;
  select * into v_cfg from orden_config where local_id = v_riv;
  if v_cfg.desafio_activo and not exists (select 1 from orden_desafios where persona_id = v_pru and semana = v_hoy - (extract(isodow from v_hoy)::int - 1)) then
    v_cat := v_cfg.desafio_categorias[1 + (extract(week from v_hoy)::int % array_length(v_cfg.desafio_categorias, 1))];
    v_preg := orden_desafio_elegir(v_pru, v_cat, orden_desafio_dificultad(v_pru), v_cfg.desafio_preguntas);
    if v_preg is not null then
      insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, creado_en)
      values (v_riv, v_pru, v_hoy - (extract(isodow from v_hoy)::int - 1), v_cat, orden_desafio_dificultad(v_pru), v_preg, array_length(v_preg, 1),
              orden_calcular_vencimiento(v_pru, 'manana', now()), now())
      on conflict do nothing
      returning id into v_des;
      if v_des is not null then
        perform orden_encolar_aviso(v_pru, 'desafio', 'Llegó tu desafío de la semana', array_length(v_preg, 1) || ' preguntas rápidas. Si le errás, no pasa nada: es para aprender.',
                                    '/desafio', 'desafio:' || v_des, 2::smallint);
      end if;
    end if;
  end if;

  -- 6. Los controles de hoy, ya.
  perform orden_tick();
  raise notice 'Listo: Rivadavia activado para la prueba';
end $$;

select 'listo: sólo trabaja quien está aprobado, y Rivadavia activado para la prueba' as "SQL 103";
