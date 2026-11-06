-- SQL 249 (5/11/2026, migración 77): la lista de los cierres de caja, también en el mostrador.
--   Pedido de Mauricio (5/11): "cuando seleccionás «Cierres de caja» te tiene que llevar a la lista de todos los cierres,
--   como si fuera un ticket. Elegís «Nuevo cierre de caja» y se te abre la ventana con los datos para cerrar."
--   La pantalla (no-compra-v366) ya lo hace; hasta este SQL la lista (pos_cierres) era sólo de quien tiene «Entra a
--   Gestión». Hoy los que usan el POS la tienen todos, así que sin este SQL anda igual; hace falta para los locales que
--   pasen al POS con la caja y sin la Gestión.
--   QUÉ CAMBIA: sólo el permiso de pos_cierres. La oficina (con la Gestión) ve todo, como siempre. Quien tiene el permiso
--   de la caja ve los cierres de su local y de hoy; con «Ver otros locales» y «Ver otros días», como en Tickets.
--   No toca ningún dato ni ninguna otra función. Lo demás de pos_cierres queda igual (copiado de la base del 5/11).
--   Se deshace con deshacer-249.sql (vuelve a ser sólo de la oficina).

CREATE OR REPLACE FUNCTION public.pos_cierres(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /* SQL 249: la oficina (con la Gestión) ve todo, como siempre. En el mostrador, quien tiene la caja ve los cierres de su
     local (con «Ver otros locales», de todos) y de hoy (con «Ver otros días», de cualquier día): las reglas de Tickets. */
  if pos_puede('gestion') then
    perform pos_permiso('gestion');   -- SQL 190
  else
    perform pos_permiso('caja');
    perform pos_local_ok(p_local);
    perform pos_dias_ok(p_desde);
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with c as (
      select x.*, l.nombre as local,
             coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = x.local_id), 100) as tolerancia,
             (x.estado = 'cerrada' and not exists (
                select 1 from pos_cierres y
                 where y.local_id = x.local_id and y.prueba = x.prueba and y.estado = 'cerrada' and y.fecha > x.fecha)) as es_ultimo
        from pos_cierres x join orden_locales l on l.id = x.local_id
       where x.dia between p_desde and p_hasta and x.prueba = coalesce(p_prueba, false)
         and (p_local is null or x.local_id = p_local)
    )
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(to_jsonb(z) - 'clave' order by z.fecha desc)
                           from (select * from c order by fecha desc limit 500) z), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'cierres',     count(*) filter (where estado = 'cerrada'),
                    'anulados',    count(*) filter (where estado = 'anulada'),
                    'ventas',      coalesce(sum(ventas_total) filter (where estado = 'cerrada'), 0),
                    'efectivo',    coalesce(sum(ventas_efectivo) filter (where estado = 'cerrada'), 0),
                    'tarjeta',     coalesce(sum(ventas_tarjeta) filter (where estado = 'cerrada'), 0),
                    'mercadopago', coalesce(sum(ventas_mercadopago) filter (where estado = 'cerrada'), 0),
                    'otros',       coalesce(sum(ventas_modo + ventas_go_cuotas + ventas_transferencia) filter (where estado = 'cerrada'), 0),
                    'giftcard',    coalesce(sum(ventas_giftcard) filter (where estado = 'cerrada'), 0),   -- SQL 200
                    'gastos',      coalesce(sum(gastos + otras_salidas) filter (where estado = 'cerrada'), 0),
                    'retiro',      coalesce(sum(retiro + a_caja_fuerte) filter (where estado = 'cerrada'), 0),   -- SQL 180
                    'retiros_fondos', coalesce(sum(retiros_fondos) filter (where estado = 'cerrada'), 0),   -- SQL 191
                    'desvio',      coalesce(sum(desvio) filter (where estado = 'cerrada'), 0),
                    'faltas',      count(*) filter (where estado = 'cerrada' and desvio > tolerancia),
                    'sobras',      count(*) filter (where estado = 'cerrada' and -desvio > tolerancia)) from c),
      'mas', (select count(*) > 500 from c)
    )
  );
end $function$;
