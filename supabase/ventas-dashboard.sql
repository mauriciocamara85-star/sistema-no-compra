-- ═══ Sistema VDH · Ventas → el dashboard (se corre recién el día que se conecta) ═══
-- Va DESPUÉS de ventas.sql. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Le abre al consolidador (el Apps Script de la planilla CONSOLIDADORA) lo que se carga en la pantalla
--     Ventas, de los locales que ya pasaron (ventas_fuente), y los pedidos pagados de la tienda, para que el
--     e-commerce se cargue solo. Entra con su propia llave.
--   · Correrlo no cambia nada: mientras no se cree la llave (select ventas_dashboard_llave_nueva();) y no
--     haya filas en ventas_fuente, el dashboard sigue leyendo las planillas.
--   · Reversible: la lista está al final.

-- ---------- Desde qué mes manda el sistema en cada local ----------
-- El consolidador sigue leyendo la planilla de Google de los meses anteriores; de este mes en
-- adelante, lo lee de acá. Sin fila, el local sigue entero con su planilla. Se llena el día del cambio.
create table if not exists ventas_fuente (
  local_id  uuid primary key references orden_locales(id) on delete cascade,
  desde     date not null check (extract(day from desde) = 1)
);

-- ---------- La llave del consolidador (sólo su huella; como la de Hermes) ----------
create table if not exists ventas_dashboard_llave (
  id         smallint primary key default 1 check (id = 1),
  huella     text not null,
  creada     timestamptz not null default now(),
  ultima_vez timestamptz
);

alter table ventas_fuente          enable row level security;
alter table ventas_dashboard_llave enable row level security;
revoke all on ventas_fuente, ventas_dashboard_llave from public, anon, authenticated;
grant all on ventas_fuente to service_role;

/* Una llave nueva para el consolidador: la devuelve UNA vez y guarda sólo su huella.
   Se corre a mano en el editor SQL: select ventas_dashboard_llave_nueva();
   La anterior deja de servir. Para cortarle el acceso: delete from ventas_dashboard_llave; */
create or replace function ventas_dashboard_llave_nueva()
returns text language plpgsql volatile security definer set search_path = public as $$
declare llave text := 'vdh_ventas_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into ventas_dashboard_llave (id, huella)
  values (1, encode(extensions.digest(llave, 'sha256'), 'hex'))
  on conflict (id) do update set huella = excluded.huella, creada = now(), ultima_vez = null;
  return llave;
end $$;

/** Lo que lee el consolidador cada hora: los meses de los locales que ya pasaron al sistema
    (ventas_fuente), desde el mes del cambio hasta el actual, con el mismo formato de
    ventas_mes_leer. Las cuentas las hace el consolidador con ventas-calc.js, igual que la pantalla.
    p_desde (opcional) acota: sólo de ese mes en adelante.
    También el e-commerce: los pedidos PAGADOS de vdh.com.ar (tienda_pedidos, los trae el robot de
    cada hora), por día de creación en hora de Argentina, desde el 1.º del mes anterior (un pedido
    del 31 pagado el 2 cambia el mes anterior). Con eso el consolidador escribe la venta y la
    cantidad de ventas de cada día en la planilla del e-commerce, que es como coincide con lo que se
    cargaba a mano: [día, suma de los totales, cantidad de pedidos]. */
create or replace function ventas_dashboard(p_llave text, p_desde date default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  h      ventas_dashboard_llave%rowtype;
  v_hoy  date := ventas_mes_de(ventas_hoy());
  v_eco  date := (ventas_mes_de(ventas_hoy()) - interval '1 month')::date;
  r      jsonb;
begin
  select * into h from ventas_dashboard_llave where id = 1;
  if not found or h.huella <> encode(extensions.digest(coalesce(p_llave, ''), 'sha256'), 'hex') then
    raise exception 'ventas: llave incorrecta' using errcode = '28000';
  end if;
  update ventas_dashboard_llave set ultima_vez = now() where id = 1;
  select jsonb_build_object(
    'hoy', ventas_hoy(),
    'fuente', coalesce((select jsonb_agg(jsonb_build_object('local', f.local_id, 'desde', f.desde) order by f.local_id)
                          from ventas_fuente f), '[]'::jsonb),
    'meses', coalesce((
      select jsonb_agg(ventas_mes_datos(m.local_id, m.mes, '{"puede": "ver", "quien": "Dashboard"}'::jsonb)
                       order by m.local_id, m.mes)
        from ventas_mes m join ventas_fuente f on f.local_id = m.local_id
       where m.mes >= f.desde and m.mes >= coalesce(ventas_mes_de(p_desde), f.desde) and m.mes <= v_hoy), '[]'::jsonb),
    'ecommerce', jsonb_build_object(
      'desde', v_eco,
      'dias', coalesce((
        select jsonb_agg(jsonb_build_array(x.dia, x.venta, x.n) order by x.dia)
          from (select (p.creado at time zone 'America/Argentina/Buenos_Aires')::date as dia,
                       sum(p.total) as venta, count(*) as n
                  from tienda_pedidos p
                 where p.pago = 'paid' and p.estado is distinct from 'cancelled'
                   and p.creado >= (v_eco::timestamp at time zone 'America/Argentina/Buenos_Aires')
                 group by 1) x), '[]'::jsonb))
  ) into r;
  return r;
end $$;

revoke all on function ventas_dashboard_llave_nueva() from public, anon, authenticated;
/* El consolidador entra sin usuario, con su llave (la revisa ventas_dashboard). */
revoke all on function ventas_dashboard(text, date) from public;
grant execute on function ventas_dashboard(text, date) to anon, service_role;

-- Para deshacer (antes que ventas.sql, si se deshace todo):
--   drop function if exists ventas_dashboard(text, date), ventas_dashboard_llave_nueva();
--   drop table if exists ventas_fuente, ventas_dashboard_llave;
