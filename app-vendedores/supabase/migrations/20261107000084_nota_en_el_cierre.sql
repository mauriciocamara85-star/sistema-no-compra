-- SQL 260 (7/11/2026, migración 84): la nota de crédito se ve en el Cierre de caja y en Tickets, como en BlueSoft.
--   Pedido de Mauricio (7/11), sobre la NC-1 de Rivadavia del 6/11 (anuló el B-10, MODO $89.000): en BlueSoft, al tocar
--   «Ventas MODO» aparece la venta y abajo la misma venta restando (la nota de crédito), y en Tickets la nota es un
--   renglón propio. "dale, hagámoslo así".
--   SÓLO AGREGA LECTURA: no cambia ningún dato, ninguna cuenta ni ningún permiso. Las anuladas siguen sin sumar.
--     - pos_caja_detalle (el detalle de cada renglón del cierre, SQL 246 y 247) manda además 'anuladas': las ventas que se
--       anularon antes de entrar en un cierre (la A y la B con su nota de crédito, la X con «Anular la venta»), con su nota,
--       quién la hizo y el motivo. La pantalla las muestra de a dos, la venta (+) y la nota (−), que suman $0.
--       El cierre marca todas las ventas de su día, también las anuladas: cada una va en el cierre que la marcó (si se
--       anuló antes de cerrarlo; si se anuló después, sigue como hasta ahora entre las ventas) y, mientras el día no se
--       cerró, en la caja abierta.
--     - pos_tickets manda además 'notas': las notas de crédito del período (por su día), con los mismos filtros que la venta
--       que anulan; con «Cobradas», ninguna. Los totales no cambian.
--   Antes de correr: si alguna de las dos cambió después del 7/11, frena sin tocar nada.
--   Se deshace con deshacer-260.sql (las dos funciones vuelven a como estaban el 7/11). Sin el 260, la pantalla nueva
--   hace lo de siempre.

-- Si alguien cambió alguna de las dos funciones después del 7/11 (otro SQL), frena sin tocar nada.
do $$
declare
  d1 text := pg_get_functiondef('public.pos_caja_detalle(uuid, boolean, uuid, date)'::regprocedure);
  d2 text := pg_get_functiondef('public.pos_tickets(date, date, uuid, text, text, text, text, boolean)'::regprocedure);
begin
  -- (sin los retornos de carro: pegado desde Windows, el deshacer los deja adentro y la función es la misma)
  if (md5(replace(d1, chr(13), '')) <> '275dee595ebaddb46bdc28a2c4cf46aa' and position('SQL 260' in d1) = 0)
     or (md5(replace(d2, chr(13), '')) <> '8865cb71cd4a2a529e1df2839ea2e96f' and position('SQL 260' in d2) = 0) then
    raise exception 'pos_caja_detalle o pos_tickets cambiaron después del 7/11: no se corrió nada. Avisale a Claude.';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.pos_caja_detalle(p_local uuid, p_prueba boolean, p_cierre uuid DEFAULT NULL::uuid, p_dia date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c        pos_cierres;
  v_corte  timestamptz;
  v_hasta  timestamptz;
  v_ventas uuid[];
  v_cambios uuid[];
  v_anuladas uuid[];   -- SQL 260: las anuladas antes de cerrar
begin
  if p_cierre is not null then
    select * into c from pos_cierres where id = p_cierre;
    if not found or c.estado <> 'cerrada' then return null; end if;
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.cierre_id = c.id and (x.estado = 'cobrada' or x.anulada_en > c.fecha);
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.cierre_id = c.id and (x.estado = 'hecho' or x.anulado_en > c.fecha);
    /* SQL 260: el cierre marca todas las ventas de su día, también las anuladas. Las que se anularon antes de cerrar
       (la A y la B con su nota de crédito, la X con «Anular la venta») van aparte; las anuladas después siguen arriba. */
    select coalesce(array_agg(x.id), '{}') into v_anuladas from pos_ventas x
     where x.cierre_id = c.id and x.estado <> 'cobrada' and not coalesce(x.anulada_en > c.fecha, false);
  else
    /* La misma regla que pos_caja_dia (SQL 247): desde el primer cierre del local, hasta el fin del día que se cierra. */
    v_corte := coalesce((select min(x.desde) from pos_cierres x
                          where x.local_id = p_local and x.prueba = p_prueba and x.estado = 'cerrada'),
                        '-infinity'::timestamptz);
    v_hasta := case when p_dia is null then 'infinity'::timestamptz else pos_caja_dia_fin(p_local, p_dia) end;
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada'
       and x.fecha >= v_corte and x.fecha < v_hasta;
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho'
       and x.fecha >= v_corte and x.fecha < v_hasta;
    /* SQL 260: las anuladas de ese día, que el cierre va a marcar junto con las cobradas. */
    select coalesce(array_agg(x.id), '{}') into v_anuladas from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado <> 'cobrada'
       and x.fecha >= v_corte and x.fecha < v_hasta;
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
        from pos_cambios x where x.id = any(v_cambios)), '[]'::jsonb),
    /* SQL 260: cada anulada con su nota de crédito (la A o la B) o con quién la anuló (la X). No suman: la pantalla las
       muestra de a dos, la venta (+) y la nota (−), como BlueSoft. */
    'anuladas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'letra', x.letra, 'numero', x.numero, 'serie', x.serie, 'prueba', x.prueba, 'fecha', x.fecha,
               'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
               'total', x.total, 'descuentos', x.descuentos,
               'anulada_en', x.anulada_en, 'motivo', x.anulada_motivo,
               'anulada_por', (select pe.nombre from orden_personas pe where pe.id = x.anulada_por),
               'nc', (select jsonb_build_object('numero', n.numero, 'prueba', n.prueba, 'letra', n.letra, 'fecha', n.fecha, 'motivo', n.motivo,
                                                'hizo', (select pe.nombre from orden_personas pe where pe.id = n.hizo))
                        from pos_notas_credito n where n.venta_id = x.id),
               'pagos', coalesce((
                 select jsonb_agg(jsonb_build_object('medio', g.medio, 'monto', g.monto, 'tarjeta', g.tarjeta, 'tipo_tarjeta', g.tipo_tarjeta,
                                                     'cuotas', g.cuotas, 'cupon', g.cupon, 'ultimos4', g.ultimos4,
                                                     'recibido', g.recibido, 'vuelto', g.vuelto) order by g.orden)
                   from pos_venta_pagos g where g.venta_id = x.id), '[]'::jsonb)) order by x.fecha, x.numero)
        from pos_ventas x where x.id = any(v_anuladas)), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_tickets(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_vendedor text DEFAULT NULL::text, p_medio text DEFAULT NULL::text, p_estado text DEFAULT NULL::text, p_letra text DEFAULT NULL::text, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- SQL 190: su local y, sin «Ver otros días», hoy
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with v as (
      select x.* from pos_ventas x
       where x.dia between p_desde and p_hasta
         and x.prueba = coalesce(p_prueba, false)
         and (p_local is null or x.local_id = p_local)
         and (p_vendedor is null or lower(x.vendedor) = lower(p_vendedor))
         and (p_estado is null or x.estado = p_estado)
         and (p_letra is null or x.letra = p_letra)
         and (p_medio is null or exists (select 1 from pos_venta_pagos g where g.venta_id = x.id and g.medio = p_medio))
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', v.id, 'numero', v.numero, 'serie', v.serie, 'prueba', v.prueba, 'fecha', v.fecha, 'local', l.nombre, 'local_id', v.local_id,
                 'vendedor', v.vendedor, 'cliente', coalesce(v.cliente_nombre, 'Consumidor final'), 'letra', v.letra,
                 'medios', (select jsonb_agg(g.medio order by g.orden) from pos_venta_pagos g where g.venta_id = v.id),
                 'estado', v.estado, 'neto', v.neto, 'descuentos', v.descuentos, 'total', v.total, 'cantidad', v.cantidad,
                 'factura', v.factura, 'socio', v.socio is not null,
                 'nc', (select n.numero from pos_notas_credito n where n.venta_id = v.id)) order by v.fecha desc)   -- SQL 205
          from (select * from v order by fecha desc limit 500) v join orden_locales l on l.id = v.local_id), '[]'::jsonb),
      /* SQL 171: el panel de la derecha de BlueSoft. Tráfico = ventas + ventas fallidas + No Compras (Mauricio,
         24/10: los que entraron y no compraron son las dos cosas, separadas) del período, de la sucursal y del
         vendedor elegidos; los demás filtros (comprobante, forma de pago, estado) no cambian a quién entró.
         Conversión = ventas ÷ tráfico. Las pruebas cuentan sólo con las pruebas (los No Compra no tienen). */
      'trafico', (
        select jsonb_build_object('ventas', t.ventas, 'fallidas', f.n, 'perdido', f.perdido, 'no_compras', nc.n,
                                  'trafico', t.ventas + f.n + nc.n,
                                  'conversion', case when t.ventas + f.n + nc.n > 0 then round(t.ventas::numeric / (t.ventas + f.n + nc.n), 4) end)
          from (select count(*) ventas from pos_ventas x
                 where x.dia between p_desde and p_hasta and x.prueba = coalesce(p_prueba, false) and x.estado = 'cobrada'
                   and (p_local is null or x.local_id = p_local)
                   and (p_vendedor is null or lower(x.vendedor) = lower(p_vendedor))) t,
               (select count(*) n, coalesce(sum(y.monto), 0) perdido from pos_fallidas y
                 where y.dia between p_desde and p_hasta and y.prueba = coalesce(p_prueba, false)
                   and (p_local is null or y.local_id = p_local)
                   and (p_vendedor is null or lower(y.vendedor) = lower(p_vendedor))) f,
               (select count(*) n from registros r
                 where not coalesce(p_prueba, false)
                   and r.creado >= (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires')
                   and r.creado < ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
                   and (p_local is null or lower(trim(r.sucursal)) = (select lower(trim(l.codigo)) from orden_locales l where l.id = p_local))
                   and (p_vendedor is null or lower(trim(r.vendedor)) = lower(trim(p_vendedor)))) nc),
      'totales', (select jsonb_build_object(
                    'tickets', count(*) filter (where estado = 'cobrada'),
                    'anulados', count(*) filter (where estado = 'anulada'),
                    'productos', coalesce(sum(cantidad) filter (where estado = 'cobrada'), 0),
                    'neto', coalesce(sum(neto) filter (where estado = 'cobrada'), 0),
                    'descuentos', coalesce(sum(descuentos) filter (where estado = 'cobrada'), 0),
                    'total', coalesce(sum(total) filter (where estado = 'cobrada'), 0)) from v),
      /* Lo cobrado por comprobante: {"A": …, "B": …, "X": …}. */
      'por_letra', (select coalesce(jsonb_object_agg(z.letra, z.total), '{}'::jsonb)
                      from (select letra, sum(total) total from v where estado = 'cobrada' group by letra) z),
      'mas', (select count(*) > 500 from v),
      /* SQL 260: las notas de crédito del período (por su día) como renglones propios, como en BlueSoft. Con los mismos
         filtros que la venta que anulan (sucursal, vendedor, comprobante, forma de pago); con «Cobradas», ninguna.
         No cambian ningún total: la venta anulada ya no suma. */
      'notas', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'venta_id', z.venta_id, 'numero', z.numero, 'prueba', z.prueba, 'letra', z.letra, 'fecha', z.fecha,
                 'local', l.nombre, 'local_id', z.local_id, 'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
                 'socio', x.socio is not null,
                 'medios', (select jsonb_agg(g.medio order by g.orden) from pos_venta_pagos g where g.venta_id = x.id),
                 'total', x.total, 'cantidad', x.cantidad, 'venta_numero', x.numero, 'venta_serie', x.serie,
                 'arca', z.arca, 'cae', z.cae) order by z.fecha desc), '[]'::jsonb)
          from (select n.* from pos_notas_credito n join pos_ventas y on y.id = n.venta_id
                 where n.dia between p_desde and p_hasta
                   and n.prueba = coalesce(p_prueba, false)
                   and (p_local is null or n.local_id = p_local)
                   and (p_vendedor is null or lower(y.vendedor) = lower(p_vendedor))
                   and (p_estado is null or p_estado = 'anulada')
                   and (p_letra is null or n.letra = p_letra)
                   and (p_medio is null or exists (select 1 from pos_venta_pagos g where g.venta_id = y.id and g.medio = p_medio))
                 order by n.fecha desc limit 500) z
          join pos_ventas x on x.id = z.venta_id
          join orden_locales l on l.id = z.local_id)
    )
  );
end $function$;
