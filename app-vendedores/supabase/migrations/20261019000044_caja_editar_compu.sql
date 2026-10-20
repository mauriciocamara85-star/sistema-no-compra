-- =====================================================================
-- Módulo VDH · Migración 44 (SQL 142), 19/10/2026: editar los números de
-- la caja desde la compu.
--
-- Pedido de Mauricio (19/10, en Cajas de la compu): "está bueno que se
-- pueda editar cualquier dato. Que aparezca editar y listo" (la IA quedó
-- apagada unos días, un cierre no se leyó, y el "Leer de nuevo" no le
-- completó Mercado Pago: por cualquier caso así, se corrige a mano).
--
-- Guardar la caja ya existe (orden_caja_guardar) y el supervisor y el
-- administrador ya pueden tocar la caja de cualquier día de su local, con
-- historial de quién cambió qué. Lo ÚNICO que frenaba a la compu era la
-- obligación de mandar el efectivo contado: al corregir un número suelto
-- (por ejemplo, sólo el cierre de Mercado Pago) en un día que no tiene el
-- efectivo cargado, la función tiraba "Falta el efectivo que contaste".
--
-- Cambio: esa obligación queda sólo para la gente del local (que carga el
-- cierre completo). El supervisor y el administrador pueden guardar un
-- número suelto, y también dejar un casillero vacío a propósito.
--
-- Todo lo demás sigue igual: historial, alertas recalculadas, el aviso a
-- los responsables, lo que escribe una persona deja de ser "de la IA"
-- (ia_campos), y el candado del mes cerrado sigue frenando por su cuenta.
--
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

create or replace function orden_caja_guardar(p_caja uuid, p_valores jsonb, p_observaciones text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare
  c orden_cajas; v_alertas jsonb;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Esta caja ya fue controlada: solo el supervisor puede cambiarla';
  end if;
  -- (SQL 142) El efectivo contado es obligatorio para la gente del local, que carga el cierre
  -- entero. El supervisor y el administrador corrigen un número suelto desde la compu (también
  -- en un día sin cargar): a ellos no se les exige.
  if orden_num(p_valores ->> 'real_efectivo') is null and (p_valores ? 'real_efectivo' or c.real_efectivo is null)
     and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Falta el efectivo que contaste';
  end if;
  -- Si ya estaba cargada, se guarda cómo estaba antes del cambio
  if c.estado <> 'pendiente' then
    update orden_cajas set historial = historial || jsonb_build_object(
      'por', (select nombre from orden_personas where id = orden_yo_id()), 'en', now(),
      'antes', jsonb_strip_nulls(jsonb_build_object(
        'sis_tarjeta', c.sis_tarjeta, 'sis_mp', c.sis_mp, 'sis_gocuotas', c.sis_gocuotas,
        'sis_saldo_final_efvo', c.sis_saldo_final_efvo, 'real_lote', c.real_lote, 'real_mp', c.real_mp,
        'real_gocuotas', c.real_gocuotas, 'real_efectivo', c.real_efectivo)))
    where id = c.id;
  end if;

  update orden_cajas set
    sis_saldo_inicial    = coalesce(orden_num(p_valores ->> 'sis_saldo_inicial'), sis_saldo_inicial),
    sis_tarjeta          = case when p_valores ? 'sis_tarjeta' then orden_num(p_valores ->> 'sis_tarjeta') else sis_tarjeta end,
    sis_efectivo         = coalesce(orden_num(p_valores ->> 'sis_efectivo'), sis_efectivo),
    sis_mp               = case when p_valores ? 'sis_mp' then orden_num(p_valores ->> 'sis_mp') else sis_mp end,
    sis_gocuotas         = case when p_valores ? 'sis_gocuotas' then orden_num(p_valores ->> 'sis_gocuotas') else sis_gocuotas end,
    sis_cuenta_corriente = coalesce(orden_num(p_valores ->> 'sis_cuenta_corriente'), sis_cuenta_corriente),
    sis_deposito         = coalesce(orden_num(p_valores ->> 'sis_deposito'), sis_deposito),
    sis_total            = coalesce(orden_num(p_valores ->> 'sis_total'), sis_total),
    sis_gastos           = coalesce(orden_num(p_valores ->> 'sis_gastos'), sis_gastos),
    sis_otras_salidas    = coalesce(orden_num(p_valores ->> 'sis_otras_salidas'), sis_otras_salidas),
    sis_descuentos       = coalesce(orden_num(p_valores ->> 'sis_descuentos'), sis_descuentos),
    sis_saldo_final_efvo = case when p_valores ? 'sis_saldo_final_efvo' then orden_num(p_valores ->> 'sis_saldo_final_efvo') else sis_saldo_final_efvo end,
    real_lote            = case when p_valores ? 'real_lote' then orden_num(p_valores ->> 'real_lote') else real_lote end,
    real_mp              = case when p_valores ? 'real_mp' then orden_num(p_valores ->> 'real_mp') else real_mp end,
    real_gocuotas        = case when p_valores ? 'real_gocuotas' then orden_num(p_valores ->> 'real_gocuotas') else real_gocuotas end,
    real_efectivo        = case when p_valores ? 'real_efectivo' then orden_num(p_valores ->> 'real_efectivo') else real_efectivo end,
    observaciones        = coalesce(nullif(trim(p_observaciones), ''), observaciones),
    -- (SQL 122) Lo que guarda la persona es suyo: deja de ser "de la IA".
    ia_campos            = array(select x from unnest(ia_campos) x where not p_valores ? x)
  where id = c.id;

  -- (SQL 122) Lo que quedó vacío y la IA leyó bien, se completa.
  perform orden_caja_completar_con_ia(c.id);
  v_alertas := orden_caja_alertas(c.id);

  update orden_cajas
     set alertas = v_alertas,
         estado = case when estado = 'pendiente' then 'cargada' else estado end,
         cargada_por = coalesce(cargada_por, orden_yo_id()),
         cargada_en = coalesce(cargada_en, now())
   where id = c.id returning * into c;

  perform orden_caja_avisar_alertas(c.id);
  return c;
end $$;

-- Chequeo: tiene que decir t (la función quedó con el permiso del supervisor).
select position('(SQL 142)' in prosrc) > 0 as funcion_actualizada
  from pg_proc where proname = 'orden_caja_guardar';

-- ---------------------------------------------------------------------
-- Vuelta atrás: volver a correr esta misma función con el chequeo del
-- efectivo como estaba (SQL 122/133), sin la condición del supervisor:
--
--   if orden_num(p_valores ->> 'real_efectivo') is null and (p_valores ? 'real_efectivo' or c.real_efectivo is null) then
--     raise exception 'Falta el efectivo que contaste';
--   end if;
-- ---------------------------------------------------------------------
