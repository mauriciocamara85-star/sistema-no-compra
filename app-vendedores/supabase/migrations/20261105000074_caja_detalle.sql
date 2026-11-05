-- Migración 74 (SQL 246, 5/11/2026): el detalle de cada renglón del Cierre de caja.
--   Pedido de Mauricio (5/11): "si aprieto en «Ventas Tarjeta» dentro del cierre de cajas, se me va a desplegar todo el
--   detalle de cada venta que hice en tarjeta, lo mismo con las demás secciones".
--   SÓLO AGREGA LECTURA: pos_caja (la caja abierta, en POS → Cierre de caja) y pos_cierre (un cierre ya hecho) mandan
--   además 'detalle': cada venta y cada cambio que entra en esa caja, con sus pagos. La pantalla arma con eso la lista de
--   cada renglón (las de tarjeta, las de efectivo, las de Mercado Pago…), que suma lo mismo que el renglón.
--   No cambia ningún dato, ninguna cuenta ni ningún permiso: las mismas ventas que ya cuenta el cierre, con la misma regla.
--     - Caja abierta: lo mismo que pos_caja_abierta (sin cierre, cobradas / hechos, desde el primer cierre del local).
--     - Cierre hecho: lo que entró en ese cierre y contó al cerrarlo (lo cobrado, y una X anulada después del cierre,
--       que el cierre ya había sumado; la pantalla la muestra tachada). Un cierre anulado no tiene detalle (sus ventas
--       volvieron a la caja abierta).
--   Se deshace con deshacer-246.sql (pos_caja y pos_cierre vuelven a como estaban y se borra pos_caja_detalle).

-- El ayudante: no se llama desde la pantalla, sólo desde pos_caja y pos_cierre (que ya controlan el permiso y el local).
CREATE OR REPLACE FUNCTION public.pos_caja_detalle(p_local uuid, p_prueba boolean, p_cierre uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c        pos_cierres;
  v_corte  timestamptz;
  v_ventas uuid[];
  v_cambios uuid[];
begin
  if p_cierre is not null then
    select * into c from pos_cierres where id = p_cierre;
    if not found or c.estado <> 'cerrada' then return null; end if;
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.cierre_id = c.id and (x.estado = 'cobrada' or x.anulada_en > c.fecha);
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.cierre_id = c.id and (x.estado = 'hecho' or x.anulado_en > c.fecha);
  else
    /* La misma regla que pos_caja_abierta: desde el primer cierre del local o, sin cierres, desde el comienzo de hoy. */
    v_corte := coalesce((select min(x.desde) from pos_cierres x
                          where x.local_id = p_local and x.prueba = p_prueba and x.estado = 'cerrada'),
                        orden_en_hora(p_local, orden_dia_caja(p_local), '00:00'));
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada' and x.fecha >= v_corte;
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho' and x.fecha >= v_corte;
  end if;
  return jsonb_build_object(
    'ventas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'letra', x.letra, 'numero', x.numero, 'serie', x.serie, 'prueba', x.prueba, 'fecha', x.fecha,
               'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
               'total', x.total, 'descuentos', x.descuentos, 'anulada', x.estado <> 'cobrada',
               'pagos', coalesce((
                 select jsonb_agg(jsonb_build_object('medio', g.medio, 'monto', g.monto, 'tarjeta', g.tarjeta, 'tipo_tarjeta', g.tipo_tarjeta,
                                                     'cuotas', g.cuotas, 'cupon', g.cupon, 'ultimos4', g.ultimos4,
                                                     'recibido', g.recibido, 'vuelto', g.vuelto) order by g.orden)
                   from pos_venta_pagos g where g.venta_id = x.id), '[]'::jsonb)) order by x.fecha, x.numero)
        from pos_ventas x where x.id = any(v_ventas)), '[]'::jsonb),
    'cambios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'numero', x.numero, 'prueba', x.prueba, 'fecha', x.fecha,
               'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
               'diferencia', x.diferencia, 'anulado', x.estado <> 'hecho',
               'pagos', coalesce((
                 select jsonb_agg(jsonb_build_object('medio', g.medio, 'monto', g.monto, 'tarjeta', g.tarjeta, 'tipo_tarjeta', g.tipo_tarjeta,
                                                     'cuotas', g.cuotas, 'cupon', g.cupon, 'ultimos4', g.ultimos4,
                                                     'recibido', g.recibido, 'vuelto', g.vuelto) order by g.orden)
                   from pos_cambio_pagos g where g.cambio_id = x.id), '[]'::jsonb)) order by x.fecha, x.numero)
        from pos_cambios x where x.id = any(v_cambios)), '[]'::jsonb));
end $function$;

REVOKE ALL ON FUNCTION public.pos_caja_detalle(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;

-- La caja abierta: la misma de antes (pg_get_functiondef del 5/11) + 'detalle'.
CREATE OR REPLACE FUNCTION public.pos_caja(p_local uuid, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a         jsonb;
  v_prueba  boolean := coalesce(p_prueba, false);
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(p_local);
  if p_local is null or not exists (select 1 from orden_locales where id = p_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  a := pos_caja_abierta(p_local, v_prueba);
  return a || jsonb_build_object(
    'numero', (select coalesce(max(c.numero), 0) + 1 from pos_cierres c where c.local_id = p_local and c.prueba = v_prueba),
    'responsable', (select p.nombre from orden_personas p where p.id = orden_yo_id()),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'rubro', m.rubro,
                                          'descripcion', m.descripcion, 'monto', m.monto, 'persona', m.persona_nombre,
                                          'numero', m.numero,   -- SQL 179
                                          'retira', m.retira) order by m.fecha)   -- SQL 191
        from pos_caja_movimientos m
       where m.local_id = p_local and m.prueba = v_prueba and m.cierre_id is null and m.estado = 'ok'
         and coalesce(m.caja, 'chica') = 'chica'), '[]'::jsonb),   -- SQL 191: sin los retiros de la caja fuerte
    'detalle', pos_caja_detalle(p_local, v_prueba, null));   -- SQL 246: cada venta y cada cambio, para el detalle de cada renglón
end $function$;

-- Un cierre hecho: el mismo de antes (pg_get_functiondef del 5/11) + 'detalle'.
CREATE OR REPLACE FUNCTION public.pos_cierre(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb;
begin
  perform pos_permiso('caja');   -- SQL 190
  select to_jsonb(c) - 'clave'
         || jsonb_build_object(
              'local', l.nombre,
              'anulado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = c.anulado_por),
              'tolerancia', coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = c.local_id), 100),
              'es_ultimo', c.estado = 'cerrada' and not exists (
                 select 1 from pos_cierres y
                  where y.local_id = c.local_id and y.prueba = c.prueba and y.estado = 'cerrada' and y.fecha > c.fecha),
              'movimientos', coalesce((
                 select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'rubro', m.rubro, 'descripcion', m.descripcion,
                                                     'monto', m.monto, 'persona', m.persona_nombre, 'estado', m.estado,
                                                     'numero', m.numero,   -- SQL 179
                                                     'retira', m.retira) order by m.fecha)   -- SQL 191
                   from pos_caja_movimientos m where m.cierre_id = c.id), '[]'::jsonb),
              'conteos_detalle', coalesce((
                 select jsonb_agg(jsonb_build_object('fecha', k.fecha, 'contado', k.contado, 'esperado', k.esperado, 'persona', pe.nombre) order by k.fecha, k.id)
                   from pos_caja_conteos k left join orden_personas pe on pe.id = k.persona
                  where k.local_id = c.local_id and k.prueba = c.prueba and k.fecha > c.desde and k.fecha <= c.fecha), '[]'::jsonb),
              'detalle', pos_caja_detalle(c.local_id, c.prueba, c.id))   -- SQL 246: lo que entró en el cierre (un cierre anulado, null)
    into r
    from pos_cierres c join orden_locales l on l.id = c.local_id
   where c.id = p_id;
  if r is null then raise exception 'No existe ese cierre.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);
  return r;
end $function$;

NOTIFY pgrst, 'reload schema';
