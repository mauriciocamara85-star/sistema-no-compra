-- ═══ Sistema VDH · Ventas → el dashboard y el Ranking, directo (sin el consolidador) ═══
-- Va DESPUÉS de ventas.sql y ventas-ecom.sql. Pegalo entero en el editor SQL de Supabase. Se puede correr
-- más de una vez.
--   · Pedido de Mauricio (23/10/2026): que el dashboard lea directo del sistema, "sin Drive, sin un
--     consolidador de planilla, sin nada". Lo lee la función ventas-tablero (supabase/functions), que arma
--     con esto las mismas tablas que servía el consolidador, con las mismas columnas: el dashboard y el
--     Ranking sólo cambian el enlace.
--   · Correrlo no cambia nada: nadie la llama hasta que se publique la función y se cambien los enlaces.
--   · Reemplaza a ventas-dashboard.sql (el puente por el consolidador, que nunca se corrió).
--   · Para deshacer: drop function if exists ventas_tablero();

/** Todo lo cargado en Ventas, para el tablero: cada mes de cada local (el de hoy incluido; el que viene,
    no, como el consolidador, que no lo mostraba hasta que empezaba) y cada mes del e-commerce (los que
    existen, más el de hoy aunque nadie lo haya abierto: la venta de la tienda llega igual). Con el mismo
    formato de ventas_mes_leer y ventas_ecom_leer: las cuentas las hace la función con ventas-calc.js,
    igual que la pantalla. Sólo la llama la función (service_role); nadie de afuera. */
create or replace function ventas_tablero()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy  date  := ventas_mes_de(ventas_hoy());
  a      jsonb := '{"puede": "ver", "quien": "Tablero"}'::jsonb;
begin
  return jsonb_build_object(
    'hoy', ventas_hoy(),
    'meses', coalesce((
      select jsonb_agg(ventas_mes_datos(m.local_id, m.mes, a) order by m.local_id, m.mes)
        from ventas_mes m join orden_locales l on l.id = m.local_id
       where l.activo and m.mes <= v_hoy), '[]'::jsonb),
    'ecom', coalesce((
      select jsonb_agg(ventas_ecom_datos(x.mes, a) order by x.mes)
        from (select mes from ventas_ecom_mes union select v_hoy) x), '[]'::jsonb));
end $$;

revoke all on function ventas_tablero() from public, anon, authenticated;
grant execute on function ventas_tablero() to service_role;
