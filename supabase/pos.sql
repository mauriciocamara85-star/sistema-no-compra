-- ═══════════════════════════════════════════════════════════════════════════
--  VDH · POS propio — la base de la venta (SQL 146, 20/10/2026).
--
--  Pedido de Mauricio (20/10): "armá la sección POS", con Tango y Dragonfish
--  de referencia (14 sucursales) y después nuestro toque. Esta es la primera
--  base: sucursales, listas de precios, promociones y la venta con sus
--  renglones, descuentos y pagos. Todavía SIN factura de ARCA (falta el
--  certificado): la venta queda registrada y la factura la sigue haciendo
--  BlueSoft.
--
--  Sólo crea cosas nuevas (tablas y funciones pos_*): no toca nada de lo que
--  ya anda. Se deshace con deshacer-146.sql.
--
--  Quién lo usa: por ahora SÓLO Administración (orden_es_admin). Las tablas
--  no tienen permisos directos: todo pasa por las funciones de abajo.
--
--  SQL 147 (20/10/2026, Mauricio: "una base de prueba… una parte de las X,
--  en efectivo… se pueden anular, así lo tiene BlueSoft"):
--    · la letra X: el comprobante interno de BlueSoft ("X: en efectivo, sin
--      factura"). No es factura y no va a ARCA; va sólo con efectivo.
--    · el modo prueba: la venta hace el mismo camino que una de verdad, pero
--      queda marcada, numera aparte (P-1, P-2…), no suma en ningún total y
--      se borra con pos_pruebas_borrar.
--    · cada local numera por separado sus facturas (A y B), sus X y sus
--      pruebas (la "serie"), como en BlueSoft cada letra con su numeración.
--  Este archivo queda como está después del 147; el cambio en sí (los alter)
--  está en App Orden/correr-en-supabase-147.sql.
--
--  SQL 149 (21/10/2026): el cierre de caja, con los gastos de la caja chica
--  y el pase a la caja fuerte. Está después de las funciones de la venta.
--
--  SQL 151 (21/10/2026): los cambios (el "Ticket de cambio" de BlueSoft).
--  Está al final del archivo; también toca la caja abierta, el cierre y
--  borrar las pruebas, que están acá arriba con la nota "SQL 151".
--
--  SQL 160 (22/10/2026): el stock de cada local y los remitos (de la fábrica
--  o entre locales), con el conteo a ciegas al recibir, los ajustes y la
--  carga de inventario. Está al final del archivo; la venta, el cambio y sus
--  anulaciones mueven el stock (la nota "SQL 160" en cada una).
--
--  SQL 167 (24/10/2026): las diferencias de los remitos. Lo que no coincide
--  al recibir queda anotado solo (la planilla de errores, sin papel), con
--  quién lo recibió y qué pasó; la oficina lo resuelve (mandar lo que faltó,
--  el remito estaba mal, que lo devuelvan a la fábrica) y ve las
--  estadísticas. Está al final del archivo; los remitos de arriba tienen la
--  nota "SQL 167" donde cambiaron.
--
--  SQL 171 (24/10/2026): la venta fallida propia (aparte del No Compra: el
--  cliente que no deja su WhatsApp), la conversión en Tickets (tráfico =
--  ventas + ventas fallidas + No Compras) y el socio del Club en la venta
--  (sus puntos se anotan siempre y se suman sólo con la regla del Club
--  pos_suma_puntos = 'si', apagada hasta que el POS reemplace a BlueSoft).
--  Está al final del archivo; la venta, los tickets, anular y borrar las
--  pruebas tienen la nota "SQL 171" donde cambiaron.
--
--  La cuenta de una venta (la misma que BlueSoft: Neto, Descuentos, Total):
--    renglón:   total = precio × cantidad
--    neto       = suma de los renglones
--    descuentos = suma de los descuentos (promos y manuales)
--    total      = neto − descuentos  =  suma de los pagos
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Las listas de precios ────────────────────────────────────────────────
-- Como en Tango: una lista tiene sus precios, o se calcula de otra con un
-- porcentaje ("los locales de calle, 15 % menos que la 100"). Un precio
-- propio en una lista calculada pisa al calculado.
create table pos_listas (
  id         serial primary key,
  nombre     text not null unique,
  base_id    int references pos_listas(id),
  ajuste     numeric(6,2) not null default 0,      -- −15 = 15 % menos que la base
  redondeo   int not null default 1 check (redondeo between 1 and 10000),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  check (base_id is null or base_id <> id)
);

create table pos_precios (
  lista_id        int not null references pos_listas(id) on delete cascade,
  codigo          text not null check (length(codigo) between 1 and 30),
  precio          numeric(12,2) not null check (precio >= 0 and precio < 100000000),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid,
  primary key (lista_id, codigo)
);

-- ── Las sucursales ───────────────────────────────────────────────────────
-- Qué lista usa cada local, y (más adelante) su punto de venta de ARCA y si
-- ya vende con el POS (el piloto).
create table pos_sucursales (
  local_id        uuid primary key references orden_locales(id),
  lista_id        int not null references pos_listas(id),
  punto_venta     int check (punto_venta between 1 and 99999),
  habilitada      boolean not null default false,
  actualizado_en  timestamptz not null default now()
);

-- ── Las promociones ──────────────────────────────────────────────────────
-- Se aplican solas al armar el ticket y se pueden sacar (Mauricio, 05/10).
--   lleva_paga  lleva N, paga M (3x2): las más baratas, gratis
--   segunda     la segunda prenda al X % (de a pares, la más barata)
--   medio_pago  X % pagando todo con un medio (10 % en efectivo)
-- Entre las que NO son combinables se aplica la que más le conviene al
-- cliente; las combinables se suman después, sobre lo que queda.
-- rubros: vacío, vale para todo; si no, sólo para esos rubros del catálogo
-- ("3x2 en remeras").
create table pos_promos (
  id          serial primary key,
  nombre      text not null check (length(trim(nombre)) between 1 and 60),
  tipo        text not null check (tipo in ('lleva_paga', 'segunda', 'medio_pago')),
  lleva       int,
  paga        int,
  porcentaje  numeric(5,2),
  medio       text,
  rubros      text[],
  combinable  boolean not null default false,
  desde       date,
  hasta       date,
  activo      boolean not null default true,
  orden       int not null default 0,
  creado_en   timestamptz not null default now(),
  check (tipo <> 'lleva_paga' or (lleva between 2 and 10 and paga between 1 and lleva - 1)),
  check (tipo = 'lleva_paga' or (porcentaje > 0 and porcentaje <= 100)),
  check (tipo <> 'medio_pago' or medio is not null),
  check (desde is null or hasta is null or desde <= hasta)
);

-- ── La venta ─────────────────────────────────────────────────────────────
-- El número de ticket es correlativo POR SUCURSAL Y POR SERIE (como la
-- "Referencia" de BlueSoft, donde cada letra tiene la suya): 'factura' (A y
-- B), 'x' (el comprobante interno) y 'prueba' (el modo prueba, P-1, P-2…).
-- Cuando se conecte ARCA, la factura va en `factura`.
create table pos_numeros (
  local_id  uuid not null references orden_locales(id),
  serie     text not null default 'factura' check (serie in ('factura', 'x', 'prueba')),
  ultimo    bigint not null default 0,
  primary key (local_id, serie)
);

create table pos_ventas (
  id                 uuid primary key default gen_random_uuid(),
  local_id           uuid not null references orden_locales(id),
  numero             bigint not null,
  fecha              timestamptz not null default now(),
  dia                date not null,
  letra              text not null check (letra in ('A', 'B', 'X')),   -- X: comprobante interno (SQL 147)
  prueba             boolean not null default false,                   -- modo prueba: no cuenta (SQL 147)
  serie              text not null default 'factura',
  cliente_nombre     text,
  cliente_doc        text,
  cliente_condicion  text not null default 'consumidor_final'
                     check (cliente_condicion in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento')),
  cliente_email      text,
  cliente_tel        text,
  envio              text check (envio in ('mail', 'whatsapp', 'impresa')),
  vendedor           text not null,
  cargado_por        uuid,
  lista_id           int references pos_listas(id),
  caja               text not null default 'chica',
  neto               numeric(12,2) not null,
  descuentos         numeric(12,2) not null default 0,
  total              numeric(12,2) not null,
  cantidad           int not null,
  estado             text not null default 'cobrada' check (estado in ('cobrada', 'anulada')),
  anulada_en         timestamptz,
  anulada_por        uuid,
  anulada_motivo     text,
  factura            jsonb,
  observaciones      text,
  clave              text unique,
  socio              text,                                             -- SQL 171: la tarjeta del socio del Club
  socio_puntos       int,                                              -- SQL 171: los puntos que le da la venta
  club_mov           bigint,                                           -- SQL 171: el movimiento del Club, si se sumaron
  constraint pos_ventas_serie_check check (serie = case when prueba then 'prueba' when letra = 'X' then 'x' else 'factura' end),
  constraint pos_ventas_local_serie_numero_key unique (local_id, serie, numero)
);
create index pos_ventas_dia on pos_ventas (dia, local_id);

create table pos_venta_items (
  venta_id     uuid not null references pos_ventas(id) on delete cascade,
  item         int not null,
  codigo       text,
  descripcion  text not null,
  talle        text,
  color        text,
  cantidad     int not null check (cantidad between 1 and 999),
  precio       numeric(12,2) not null check (precio >= 0),
  total        numeric(12,2) not null,
  primary key (venta_id, item)
);

create table pos_venta_descuentos (
  venta_id     uuid not null references pos_ventas(id) on delete cascade,
  orden        int not null,
  tipo         text not null check (tipo in ('promo', 'manual')),
  promo_id     int,
  descripcion  text not null,
  monto        numeric(12,2) not null check (monto > 0),
  primary key (venta_id, orden)
);

create table pos_venta_pagos (
  venta_id      uuid not null references pos_ventas(id) on delete cascade,
  orden         int not null,
  medio         text not null check (medio in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia')),
  monto         numeric(12,2) not null check (monto > 0),
  tarjeta       text,
  tipo_tarjeta  text check (tipo_tarjeta in ('credito', 'debito')),
  cuotas        int check (cuotas between 1 and 24),
  cupon         text,
  lote          text,
  ultimos4      text check (ultimos4 ~ '^[0-9]{4}$'),
  recibido      numeric(12,2),
  vuelto        numeric(12,2),
  primary key (venta_id, orden)
);

-- Sin permisos directos: todo pasa por las funciones (security definer).
alter table pos_listas            enable row level security;
alter table pos_precios           enable row level security;
alter table pos_sucursales        enable row level security;
alter table pos_promos            enable row level security;
alter table pos_numeros           enable row level security;
alter table pos_ventas            enable row level security;
alter table pos_venta_items       enable row level security;
alter table pos_venta_descuentos  enable row level security;
alter table pos_venta_pagos       enable row level security;
revoke all on pos_listas, pos_precios, pos_sucursales, pos_promos, pos_numeros, pos_ventas,
              pos_venta_items, pos_venta_descuentos, pos_venta_pagos from anon, authenticated;
revoke all on sequence pos_listas_id_seq, pos_promos_id_seq from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  LAS FUNCIONES
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pos_permiso() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not orden_es_admin() then
    raise exception 'El POS todavía está en construcción: por ahora lo usa sólo Administración.' using errcode = '42501';
  end if;
end $$;

create or replace function pos_hoy() returns date
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

/* Todo lo que la pantalla necesita para arrancar. */
create or replace function pos_inicio() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  return jsonb_build_object(
    'yo', (select jsonb_build_object('id', p.id, 'nombre', p.nombre) from orden_personas p where p.id = orden_yo_id()),
    'hoy', pos_hoy(),
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo,
                                          'lista_id', s.lista_id, 'habilitada', coalesce(s.habilitada, false),
                                          'punto_venta', s.punto_venta) order by l.nombre)
        from orden_locales l left join pos_sucursales s on s.local_id = l.id
       where l.activo), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'base_id', x.base_id, 'ajuste', x.ajuste,
                                          'redondeo', x.redondeo,
                                          'propios', (select count(*) from pos_precios p where p.lista_id = x.id)) order by x.id)
        from pos_listas x where x.activo), '[]'::jsonb),
    'promos', coalesce((select jsonb_agg(to_jsonb(pr) - 'creado_en' order by pr.orden, pr.id) from pos_promos pr), '[]'::jsonb),
    /* SQL 171: el Club en la venta. "suma": si el POS suma los puntos (la regla pos_suma_puntos). */
    'club', jsonb_build_object(
      'suma', coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si',
      'pesos_por_punto', coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100)),
    /* Los vendedores de cada local: el equipo del No Compra (los mismos nombres que la Carga). */
    'vendedores', coalesce((
      select jsonb_object_agg(l.id, coalesce(v.nombres, '[]'::jsonb))
        from orden_locales l
        left join lateral (
          select jsonb_agg(q.n order by q.n) nombres
            from (select distinct trim(e.vendedor) n from equipo e
                   where e.activo and lower(trim(e.local)) = lower(trim(l.codigo)) and trim(e.vendedor) <> '') q
        ) v on true
       where l.activo), '{}'::jsonb)
  );
end $$;

/* Los precios de una lista: [código, precio, propio]. En una lista calculada,
   "propio" = false es el que sale de la base con el porcentaje. */
create or replace function pos_precios(p_lista int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l pos_listas;
begin
  perform pos_permiso();
  select * into l from pos_listas where id = p_lista;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(x.codigo, x.precio, x.propio) order by x.codigo)
      from (
        select coalesce(p.codigo, b.codigo) codigo,
               coalesce(p.precio, round(b.precio * (1 + l.ajuste / 100) / l.redondeo) * l.redondeo) precio,
               p.codigo is not null propio
          from (select codigo, precio from pos_precios where lista_id = p_lista) p
          full join (select codigo, precio from pos_precios where lista_id = l.base_id) b on b.codigo = p.codigo
      ) x
     where x.precio is not null), '[]'::jsonb);
end $$;

/* Cambiar un precio. Sin precio (null): en una lista calculada vuelve al calculado; en una propia, se borra.
   Las que guardan devuelven true y no void: una función void contesta sin cuerpo y datos.js
   (funcion) espera un JSON. */
create or replace function pos_precio_guardar(p_lista int, p_codigo text, p_precio numeric) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_codigo, '')));
begin
  perform pos_permiso();
  if not exists (select 1 from pos_listas where id = p_lista) then raise exception 'No existe esa lista de precios.'; end if;
  if c = '' or length(c) > 30 then raise exception 'Falta el código del producto.'; end if;
  if p_precio is null then
    delete from pos_precios where lista_id = p_lista and codigo = c;
    return true;
  end if;
  if p_precio < 0 or p_precio >= 100000000 then raise exception 'El precio no es válido.'; end if;
  insert into pos_precios (lista_id, codigo, precio, actualizado_por)
  values (p_lista, c, round(p_precio, 2), orden_yo_id())
  on conflict (lista_id, codigo) do update set precio = excluded.precio, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
  return true;
end $$;

/* Una lista calculada: su porcentaje y su redondeo. */
create or replace function pos_lista_guardar(p_lista int, p_ajuste numeric, p_redondeo int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_ajuste is null or p_ajuste <= -100 or p_ajuste > 300 then raise exception 'El porcentaje no es válido.'; end if;
  if p_redondeo is null or p_redondeo < 1 or p_redondeo > 10000 then raise exception 'El redondeo no es válido.'; end if;
  update pos_listas set ajuste = p_ajuste, redondeo = p_redondeo where id = p_lista and base_id is not null;
  if not found then raise exception 'Esa lista no se calcula de otra.'; end if;
  return true;
end $$;

/* La lista de precios de una sucursal, su punto de venta y si ya vende con el POS. */
create or replace function pos_sucursal_guardar(p_local uuid, p_lista int, p_punto_venta int, p_habilitada boolean) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  perform pos_permiso();
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'No existe ese local.'; end if;
  if not exists (select 1 from pos_listas where id = p_lista and activo) then raise exception 'No existe esa lista de precios.'; end if;
  if p_punto_venta is not null and (p_punto_venta < 1 or p_punto_venta > 99999) then raise exception 'El punto de venta va del 1 al 99999.'; end if;
  insert into pos_sucursales (local_id, lista_id, punto_venta, habilitada)
  values (p_local, p_lista, p_punto_venta, coalesce(p_habilitada, false))
  on conflict (local_id) do update set lista_id = excluded.lista_id, punto_venta = excluded.punto_venta,
                                       habilitada = excluded.habilitada, actualizado_en = now();
  return true;
end $$;

/* Crear o cambiar una promoción. Sin id, es nueva. */
create or replace function pos_promo_guardar(p jsonb) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id     int := nullif(p->>'id', '')::int;
  v_rubros text[];
begin
  perform pos_permiso();
  /* Los rubros llegan como lista; vacía (o sin mandar) es "para todo". */
  if jsonb_typeof(p->'rubros') = 'array' then
    select array_agg(distinct trim(r)) into v_rubros from jsonb_array_elements_text(p->'rubros') r where trim(r) <> '';
  end if;
  if v_id is null then
    insert into pos_promos (nombre, tipo, lleva, paga, porcentaje, medio, rubros, combinable, desde, hasta, activo, orden)
    values (trim(p->>'nombre'), p->>'tipo', nullif(p->>'lleva', '')::int, nullif(p->>'paga', '')::int,
            nullif(p->>'porcentaje', '')::numeric, nullif(p->>'medio', ''), v_rubros, coalesce((p->>'combinable')::boolean, false),
            nullif(p->>'desde', '')::date, nullif(p->>'hasta', '')::date, coalesce((p->>'activo')::boolean, true),
            coalesce(nullif(p->>'orden', '')::int, 0))
    returning id into v_id;
  else
    update pos_promos set nombre = trim(p->>'nombre'), tipo = p->>'tipo',
           lleva = nullif(p->>'lleva', '')::int, paga = nullif(p->>'paga', '')::int,
           porcentaje = nullif(p->>'porcentaje', '')::numeric, medio = nullif(p->>'medio', ''), rubros = v_rubros,
           combinable = coalesce((p->>'combinable')::boolean, false),
           desde = nullif(p->>'desde', '')::date, hasta = nullif(p->>'hasta', '')::date,
           activo = coalesce((p->>'activo')::boolean, true), orden = coalesce(nullif(p->>'orden', '')::int, orden)
     where id = v_id;
    if not found then raise exception 'No existe esa promoción.'; end if;
  end if;
  return v_id;
end $$;

/* Guardar una venta. La pantalla manda todo armado; acá se revisa que las
   cuentas cierren al centavo y se le da el número de la sucursal (de su
   serie: facturas, X o pruebas). Con la misma `clave` dos veces (se cortó
   internet después de guardar) devuelve la que ya estaba, no la duplica.
   SQL 160: lo vendido sale del stock del local (las pruebas no lo tocan). */
create or replace function pos_venta_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_letra   text := coalesce(nullif(p->>'letra', ''), 'B');
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_serie   text;
  v_cond    text := coalesce(nullif(p->>'cliente_condicion', ''), 'consumidor_final');
  v_doc     text := nullif(regexp_replace(coalesce(p->>'cliente_doc', ''), '[^0-9]', '', 'g'), '');
  v_vend    text := nullif(trim(coalesce(p->>'vendedor', '')), '');
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_descs   jsonb := coalesce(p->'descuentos', '[]'::jsonb);
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_neto    numeric := 0;
  v_desc    numeric := 0;
  v_pagado  numeric := 0;
  v_cant    int := 0;
  v_total   numeric;
  v_num     bigint;
  v_id      uuid;
  v_ya      pos_ventas;
  x         jsonb;
  it        record;
  i         int;
  n         int;
  pr        numeric;
  m         numeric;
  v_socio   text := nullif(regexp_replace(coalesce(p->>'socio', ''), '[^0-9]', '', 'g'), '');   -- SQL 171
  v_cli     v_club_clientes%rowtype;
  v_factor  jsonb;
  v_gana    int;
  v_mov     bigint;
begin
  perform pos_permiso();

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 171: el socio del Club (el número de su tarjeta), si lo eligieron. */
  if v_socio is not null then
    select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
    if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
  if v_letra not in ('A', 'B', 'X') then raise exception 'El comprobante tiene que ser A, B o X.'; end if;
  if v_cond not in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento') then
    raise exception 'La condición de IVA del cliente no es válida.';
  end if;
  if v_letra = 'A' and (v_doc is null or length(v_doc) <> 11) then
    raise exception 'La factura A necesita el CUIT del cliente (11 números).';
  end if;
  if v_letra = 'A' and v_cond = 'consumidor_final' then
    raise exception 'A un consumidor final se le hace factura B.';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La venta no tiene productos.'; end if;
  if jsonb_array_length(v_items) > 200 then raise exception 'Son demasiados renglones para una venta.'; end if;
  for x in select * from jsonb_array_elements(v_items) loop
    n := (x->>'cantidad')::int;
    pr := round((x->>'precio')::numeric, 2);
    if n is null or n < 1 or n > 999 then raise exception 'Hay una cantidad que no es válida.'; end if;
    if pr is null or pr < 0 or pr >= 100000000 then raise exception 'Hay un precio que no es válido.'; end if;
    if nullif(trim(coalesce(x->>'descripcion', '')), '') is null then raise exception 'Hay un renglón sin descripción.'; end if;
    v_neto := v_neto + pr * n;
    v_cant := v_cant + n;
  end loop;

  if jsonb_typeof(v_descs) <> 'array' then raise exception 'Los descuentos no son válidos.'; end if;
  for x in select * from jsonb_array_elements(v_descs) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un descuento que no es válido.'; end if;
    if coalesce(x->>'tipo', '') not in ('promo', 'manual') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;
    v_desc := v_desc + m;
  end loop;
  if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;
  v_total := v_neto - v_desc;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia') then
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if v_letra = 'X' and x->>'medio' <> 'efectivo' then
      raise exception 'La X (el comprobante interno) va sólo con efectivo.';
    end if;
    if x->>'medio' = 'tarjeta' then
      if nullif(trim(coalesce(x->>'tarjeta', '')), '') is null then raise exception 'Falta qué tarjeta es.'; end if;
      if coalesce(x->>'tipo_tarjeta', '') not in ('credito', 'debito') then raise exception 'Falta si la tarjeta es de crédito o de débito.'; end if;
      if coalesce(nullif(x->>'cuotas', '')::int, 1) not between 1 and 24 then raise exception 'Las cuotas van de 1 a 24.'; end if;
      if nullif(x->>'ultimos4', '') is not null and (x->>'ultimos4') !~ '^[0-9]{4}$' then raise exception 'Los últimos 4 números de la tarjeta son 4 números.'; end if;
    end if;
    if x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null and (x->>'recibido')::numeric < m then
      raise exception 'Lo que recibiste en efectivo es menos que lo que se cobra.';
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio)
  values (v_local, v_num, v_serie, v_prueba, pos_hoy(), v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total)
    values (v_id, i, nullif(upper(trim(coalesce(x->>'codigo', ''))), ''), trim(x->>'descripcion'),
            nullif(trim(coalesce(x->>'talle', '')), ''), nullif(trim(coalesce(x->>'color', '')), ''),
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int);
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id order by item loop
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color, -it.cantidad, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, it.descripcion);
    end loop;
  end if;

  i := 0;
  for x in select * from jsonb_array_elements(v_descs) loop
    i := i + 1;
    insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto)
    values (v_id, i, x->>'tipo', nullif(x->>'promo_id', '')::int,
            coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2));
  end loop;

  i := 0;
  for x in select * from jsonb_array_elements(v_pagos) loop
    i := i + 1;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            nullif(trim(coalesce(x->>'cupon', '')), ''), nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    v_gana := floor((v_total / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, v_total,
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', now(), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $$;

/* El listado de tickets (como "Tickets de venta" de BlueSoft), con los totales.
   Las de verdad y las de prueba no se mezclan nunca: p_prueba elige cuáles. */
create or replace function pos_tickets(p_desde date, p_hasta date, p_local uuid default null, p_vendedor text default null,
                                       p_medio text default null, p_estado text default null, p_letra text default null,
                                       p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
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
                 'factura', v.factura, 'socio', v.socio is not null) order by v.fecha desc)
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
      'mas', (select count(*) > 500 from v)
    )
  );
end $$;

/* Una venta completa, para verla o reimprimirla. */
create or replace function pos_venta(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform pos_permiso();
  select to_jsonb(v) - 'clave'
         || jsonb_build_object(
              'local', l.nombre,
              'cargado_por_nombre', (select p.nombre from orden_personas p where p.id = v.cargado_por),
              'anulada_por_nombre', (select p.nombre from orden_personas p where p.id = v.anulada_por),
              'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
              'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
              'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb),
              /* SQL 171: el socio, con su nivel de hoy, y si los puntos están sumados (y no se anularon). */
              'socio_nivel', (select c.nivel from v_club_clientes c where c.codigo = v.socio),
              'puntos_sumados', exists (select 1 from club_movimientos m where m.id = v.club_mov and m.anulado is null))
    into r
    from pos_ventas v join orden_locales l on l.id = v.local_id
   where v.id = p_id;
  if r is null then raise exception 'No existe esa venta.'; end if;
  return r;
end $$;

/* Anular una venta (queda en la lista, tachada, con quién y por qué).
   SQL 160: lo que salió del stock con la venta, vuelve. */
create or replace function pos_venta_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare v pos_ventas; m pos_stock_movs;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.factura is not null then raise exception 'Esa venta tiene factura de ARCA: se anula con una nota de crédito.'; end if;
  update pos_ventas set estado = 'anulada', anulada_en = now(), anulada_por = orden_yo_id(), anulada_motivo = trim(p_motivo)
   where id = p_id;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo = 'venta' order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, 'venta_anulada', p_id, m.ref || ' (anulada)');
  end loop;
  /* SQL 171: si la venta le sumó puntos a un socio, se le descuentan: el movimiento del Club queda anulado,
     como cuando se anula una carga en Cobrar. */
  if v.club_mov is not null then
    update club_movimientos
       set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS'),
           motivo_anul = 'Venta anulada en el POS: ' || trim(p_motivo)
     where id = v.club_mov and anulado is null;
  end if;
  return true;
end $$;

/* Borrar las ventas de prueba (todas, o las de un local). Las de verdad no
   se tocan nunca: ésas se anulan. Las pruebas vuelven a empezar en la P-1.
   SQL 149: también la caja de prueba (sus cierres, sus gastos y sus conteos).
   SQL 151: también los cambios de prueba (vuelven a la CP-1); cuenta los dos.
   SQL 171: también las ventas fallidas de prueba; cuenta las tres. */
create or replace function pos_pruebas_borrar(p_local uuid default null) returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int; nc int;
begin
  perform pos_permiso();
  delete from pos_ventas where prueba and (p_local is null or local_id = p_local);
  get diagnostics n = row_count;
  delete from pos_cambios where prueba and (p_local is null or local_id = p_local);
  get diagnostics nc = row_count;
  n := n + nc;
  /* SQL 171: también las ventas fallidas de prueba. */
  delete from pos_fallidas where prueba and (p_local is null or local_id = p_local);
  get diagnostics nc = row_count;
  n := n + nc;
  delete from pos_numeros where serie = 'prueba' and (p_local is null or local_id = p_local);
  delete from pos_caja_movimientos where prueba and (p_local is null or local_id = p_local);
  delete from pos_caja_conteos where prueba and (p_local is null or local_id = p_local);
  delete from pos_cierres where prueba and (p_local is null or local_id = p_local);
  return n;
end $$;

revoke all on function pos_permiso(), pos_inicio(), pos_precios(int), pos_precio_guardar(int, text, numeric),
                       pos_lista_guardar(int, numeric, int), pos_sucursal_guardar(uuid, int, int, boolean),
                       pos_promo_guardar(jsonb), pos_venta_guardar(jsonb),
                       pos_tickets(date, date, uuid, text, text, text, text, boolean), pos_venta(uuid), pos_venta_anular(uuid, text),
                       pos_pruebas_borrar(uuid)
       from public, anon;
grant execute on function pos_inicio(), pos_precios(int), pos_precio_guardar(int, text, numeric),
                          pos_lista_guardar(int, numeric, int), pos_sucursal_guardar(uuid, int, int, boolean),
                          pos_promo_guardar(jsonb), pos_venta_guardar(jsonb),
                          pos_tickets(date, date, uuid, text, text, text, text, boolean), pos_venta(uuid), pos_venta_anular(uuid, text),
                          pos_pruebas_borrar(uuid)
       to authenticated;
revoke all on function pos_permiso() from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 149 (21/10/2026) · EL CIERRE DE CAJA
--
--  Mauricio (21/10, "dalee"): el cierre de caja de BlueSoft (las fotos de
--  03 Caja), con lo que ya habíamos hablado:
--    · Primero se cuenta el efectivo y recién después se ve cuánto tendría
--      que haber (en BlueSoft se ve mientras se cuenta). Cada vez que se
--      cuenta queda anotado: si contaron dos veces, se ve.
--    · El pase a la caja fuerte es parte del cierre ("¿cuánto pasás a la
--      caja fuerte?"). En BlueSoft es otra pantalla, que se hace todas las
--      noches con el cierre.
--    · Los gastos del local salen de la caja chica (limpieza, bidones…),
--      con los tipos de gasto de BlueSoft.
--
--  La caja de cada local queda "abierta" desde el cierre anterior: entran
--  todas las ventas y todos los gastos que todavía no tienen cierre. El
--  primer cierre de un local toma las ventas desde el comienzo de ese día.
--
--  La cuenta (el "Saldo final en efectivo" de BlueSoft):
--    esperado = saldo inicial + ventas en efectivo + otros ingresos
--               − gastos − otras salidas
--    desvío   = esperado − contado   (positivo: falta plata, como en
--               Supervisión → Cajas)
--    queda    = contado − lo que pasa a la caja fuerte (es el saldo
--               inicial del cierre que sigue)
--
--  Las pruebas (el modo prueba) tienen su propia caja: cuentan sólo las
--  ventas de prueba, numeran aparte (P-1…) y se borran con
--  pos_pruebas_borrar.
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_cierres (
  id                    uuid primary key default gen_random_uuid(),
  local_id              uuid not null references orden_locales(id),
  numero                int not null,
  prueba                boolean not null default false,
  dia                   date not null,             -- el día de trabajo (orden_dia_caja: a las 00:30 sigue siendo el que cerró)
  fecha                 timestamptz not null default clock_timestamp(),
  desde                 timestamptz not null,      -- el cierre anterior; en el primero, el comienzo del día
  responsable           uuid,
  responsable_nombre    text,
  caja                  text not null default 'chica',
  saldo_inicial         numeric(14,2) not null default 0,
  tickets               int not null default 0,
  ventas_efectivo       numeric(14,2) not null default 0,
  ventas_tarjeta        numeric(14,2) not null default 0,
  ventas_mercadopago    numeric(14,2) not null default 0,
  ventas_modo           numeric(14,2) not null default 0,
  ventas_go_cuotas      numeric(14,2) not null default 0,
  ventas_transferencia  numeric(14,2) not null default 0,
  ventas_total          numeric(14,2) not null default 0,
  descuentos            numeric(14,2) not null default 0,
  gastos                numeric(14,2) not null default 0,
  otras_salidas         numeric(14,2) not null default 0,
  otros_ingresos        numeric(14,2) not null default 0,
  esperado              numeric(14,2) not null default 0,   -- el "Saldo final en efectivo"
  contado               numeric(14,2) not null check (contado >= 0),
  desvio                numeric(14,2) generated always as (esperado - contado) stored,
  conteos               int not null default 1,
  primer_conteo         numeric(14,2),
  retiro                numeric(14,2) not null default 0,   -- a la caja fuerte
  queda                 numeric(14,2) generated always as (contado - retiro) stored,
  observaciones         text,
  estado                text not null default 'cerrada' check (estado in ('cerrada', 'anulada')),
  anulado_en            timestamptz,
  anulado_por           uuid,
  anulado_motivo        text,
  clave                 text unique,
  unique (local_id, prueba, numero),
  check (retiro >= 0 and retiro <= contado)
);
create index pos_cierres_dia on pos_cierres (dia, local_id);

-- Cada vez que cuentan el efectivo (el Paso 1), con lo que tendría que haber en ese momento.
create table pos_caja_conteos (
  id             bigserial primary key,
  local_id       uuid not null references orden_locales(id),
  prueba         boolean not null default false,
  fecha          timestamptz not null default clock_timestamp(),
  persona        uuid,
  saldo_inicial  numeric(14,2) not null,
  contado        numeric(14,2) not null,
  esperado       numeric(14,2) not null
);
create index pos_caja_conteos_local on pos_caja_conteos (local_id, prueba, fecha);

-- Los gastos del local y las otras entradas y salidas de la caja chica.
create table pos_caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references orden_locales(id),
  prueba          boolean not null default false,
  fecha           timestamptz not null default clock_timestamp(),
  dia             date not null,
  tipo            text not null check (tipo in ('gasto', 'salida', 'ingreso')),
  rubro           text,                 -- el tipo de gasto de BlueSoft (bidones de agua, limpieza…)
  descripcion     text,
  monto           numeric(14,2) not null check (monto > 0 and monto < 100000000),
  persona         uuid,
  persona_nombre  text,
  cierre_id       uuid references pos_cierres(id) on delete set null,
  estado          text not null default 'ok' check (estado in ('ok', 'anulado')),
  anulado_en      timestamptz,
  anulado_por     uuid,
  anulado_motivo  text,
  clave           text unique,
  check (tipo <> 'gasto' or rubro is not null)
);
create index pos_caja_movimientos_abiertos on pos_caja_movimientos (local_id, prueba) where cierre_id is null;
create index pos_caja_movimientos_dia on pos_caja_movimientos (dia, local_id);

-- Cada venta, en qué cierre entró.
alter table pos_ventas add column cierre_id uuid references pos_cierres(id) on delete set null;
create index pos_ventas_sin_cierre on pos_ventas (local_id, prueba) where cierre_id is null;

alter table pos_cierres           enable row level security;
alter table pos_caja_conteos      enable row level security;
alter table pos_caja_movimientos  enable row level security;
revoke all on pos_cierres, pos_caja_conteos, pos_caja_movimientos from anon, authenticated;
revoke all on sequence pos_caja_conteos_id_seq from anon, authenticated;

/* La caja abierta de un local (la de verdad o la de prueba): lo que entró
   desde el último cierre. Es para las otras funciones: trae también el
   efectivo, que la pantalla ve recién después de contar.
   SQL 151: también lo que se cobró en los cambios (la diferencia), en cada
   forma de pago y en el total, como una venta más. */
create or replace function pos_caja_abierta(p_local uuid, p_prueba boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  u        pos_cierres;
  v_dia    date := orden_dia_caja(p_local);
  v_corte  timestamptz;
  r        jsonb;
begin
  select * into u from pos_cierres c
   where c.local_id = p_local and c.prueba = p_prueba and c.estado = 'cerrada'
   order by c.fecha desc limit 1;
  /* Desde dónde se toman las ventas: desde el primer cierre del local (así las de antes del
     POS no entran nunca) o, si todavía no cerró ninguno, desde el comienzo de hoy. */
  v_corte := coalesce((select min(c.desde) from pos_cierres c
                        where c.local_id = p_local and c.prueba = p_prueba and c.estado = 'cerrada'),
                      orden_en_hora(p_local, v_dia, '00:00'));
  with v as (
    select x.* from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada'
       and x.fecha >= v_corte
  ), cb as (
    select x.* from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho'
       and x.fecha >= v_corte
  ), g as (
    select z.medio, sum(z.monto) monto from (
      select pg.medio, pg.monto from pos_venta_pagos pg join v on v.id = pg.venta_id
      union all
      select pc.medio, pc.monto from pos_cambio_pagos pc join cb on cb.id = pc.cambio_id) z
     group by z.medio
  ), m as (
    select x.* from pos_caja_movimientos x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'ok'
  )
  select jsonb_build_object(
    'dia', v_dia,
    'desde', coalesce(u.fecha, v_corte),
    'primer', u.id is null,
    'ultimo', case when u.id is null then null
                   else jsonb_build_object('id', u.id, 'numero', u.numero, 'fecha', u.fecha, 'queda', u.queda) end,
    'saldo_inicial', u.queda,
    'tickets', (select count(*) from v),
    'ventas', jsonb_build_object(
      'efectivo',      coalesce((select g.monto from g where g.medio = 'efectivo'), 0),
      'tarjeta',       coalesce((select g.monto from g where g.medio = 'tarjeta'), 0),
      'mercadopago',   coalesce((select g.monto from g where g.medio = 'mercadopago'), 0),
      'modo',          coalesce((select g.monto from g where g.medio = 'modo'), 0),
      'go_cuotas',     coalesce((select g.monto from g where g.medio = 'go_cuotas'), 0),
      'transferencia', coalesce((select g.monto from g where g.medio = 'transferencia'), 0)),
    'ventas_total', coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    'descuentos', coalesce((select sum(v.descuentos) from v), 0),
    'cambios', (select count(*) from cb),
    'cambios_diferencia', coalesce((select sum(cb.diferencia) from cb), 0),
    'gastos', coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    'otras_salidas', coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    'otros_ingresos', coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    'conteos', (select count(*) from pos_caja_conteos k
                 where k.local_id = p_local and k.prueba = p_prueba and k.fecha > coalesce(u.fecha, '-infinity'::timestamptz)),
    'tolerancia', coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = p_local), 100)
  ) into r;
  return r;
end $$;

/* La caja de hoy para la pantalla del cierre: todo menos el efectivo, que se
   ve recién después de contar (pos_caja_contar). SQL 151: tampoco lo que se
   cobró en los cambios (puede ser en efectivo); cuántos cambios hubo, sí. */
create or replace function pos_caja(p_local uuid, p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a         jsonb;
  v_prueba  boolean := coalesce(p_prueba, false);
begin
  perform pos_permiso();
  if p_local is null or not exists (select 1 from orden_locales where id = p_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  a := pos_caja_abierta(p_local, v_prueba);
  return ((a #- '{ventas,efectivo}') - 'ventas_total' - 'cambios_diferencia') || jsonb_build_object(
    'numero', (select coalesce(max(c.numero), 0) + 1 from pos_cierres c where c.local_id = p_local and c.prueba = v_prueba),
    'responsable', (select p.nombre from orden_personas p where p.id = orden_yo_id()),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'rubro', m.rubro,
                                          'descripcion', m.descripcion, 'monto', m.monto, 'persona', m.persona_nombre) order by m.fecha)
        from pos_caja_movimientos m
       where m.local_id = p_local and m.prueba = v_prueba and m.cierre_id is null and m.estado = 'ok'), '[]'::jsonb));
end $$;

/* Paso 1: el efectivo que contaron. Queda anotado (cada vez que cuentan) y
   recién ahí se devuelve cuánto tendría que haber y la diferencia. En el
   primer cierre del local también dicen con cuánto arrancó la caja. */
create or replace function pos_caja_contar(p_local uuid, p_prueba boolean, p_contado numeric, p_saldo_inicial numeric default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a         jsonb;
  v_prueba  boolean := coalesce(p_prueba, false);
  v_cont    numeric := round(p_contado, 2);
  v_saldo   numeric;
  v_esp     numeric;
begin
  perform pos_permiso();
  if p_local is null or not exists (select 1 from orden_locales where id = p_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_cont is null or v_cont < 0 or v_cont >= 1000000000 then raise exception 'Escribí cuánto efectivo hay en el local.'; end if;
  a := pos_caja_abierta(p_local, v_prueba);
  if (a->>'primer')::boolean then
    v_saldo := round(coalesce(p_saldo_inicial, 0), 2);
    if v_saldo < 0 or v_saldo >= 1000000000 then raise exception 'El saldo inicial no es válido.'; end if;
  else
    v_saldo := (a->>'saldo_inicial')::numeric;
  end if;
  v_esp := v_saldo + (a->'ventas'->>'efectivo')::numeric + (a->>'otros_ingresos')::numeric
         - (a->>'gastos')::numeric - (a->>'otras_salidas')::numeric;
  insert into pos_caja_conteos (local_id, prueba, persona, saldo_inicial, contado, esperado)
  values (p_local, v_prueba, orden_yo_id(), v_saldo, v_cont, v_esp);
  return a || jsonb_build_object('saldo_inicial', v_saldo, 'esperado', v_esp, 'contado', v_cont,
                                 'desvio', v_esp - v_cont, 'conteos', (a->>'conteos')::int + 1);
end $$;

/* Pasos 2 y 3: lo que pasa a la caja fuerte, y cerrar. La cuenta se vuelve a
   hacer acá, con lo que haya en ese momento; el efectivo tiene que ser el
   último que contaron (Paso 1). Con la misma `clave` dos veces (se cortó
   internet después de cerrar) devuelve el mismo cierre, no lo duplica.
   SQL 151: los cambios entran en el cierre como las ventas. */
create or replace function pos_caja_cerrar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local    uuid := nullif(p->>'local_id', '')::uuid;
  v_prueba   boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_cont     numeric := round(nullif(p->>'contado', '')::numeric, 2);
  v_retiro   numeric := round(coalesce(nullif(p->>'retiro', '')::numeric, 0), 2);
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_obs      text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  u          pos_cierres;
  c          pos_cierres;
  k          pos_caja_conteos;
  v_dia      date;
  v_corte    timestamptz;
  v_id       uuid;
  v_num      int;
  v_n        int;
  v_primero  numeric;
begin
  perform pos_permiso();

  if v_clave is not null then
    select * into c from pos_cierres where clave = v_clave;
    if found then
      return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                                'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'ya', true);
    end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_cont is null or v_cont < 0 then raise exception 'Falta el efectivo que contaste (Paso 1).'; end if;
  if v_retiro < 0 then raise exception 'Lo que pasa a la caja fuerte no puede ser negativo.'; end if;
  if v_retiro > v_cont then
    raise exception 'No se puede pasar a la caja fuerte más de lo que hay ($%).', to_char(v_cont, 'FM999G999G990D00');
  end if;
  if length(v_obs) > 500 then raise exception 'Las observaciones son demasiado largas.'; end if;

  /* Un cierre por vez en cada caja: si dos la cierran al mismo tiempo, el segundo espera y frena abajo. */
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || v_local::text || ':' || v_prueba::text));

  select * into u from pos_cierres x
   where x.local_id = v_local and x.prueba = v_prueba and x.estado = 'cerrada'
   order by x.fecha desc limit 1;
  select * into k from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
   order by x.fecha desc, x.id desc limit 1;
  if not found then raise exception 'Primero contá el efectivo y tocá «Ver la cuenta» (Paso 1).'; end if;
  if k.contado <> v_cont then raise exception 'El efectivo no es el que contaste: tocá «Ver la cuenta» de nuevo.'; end if;
  select count(*) into v_n from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz);
  select x.contado into v_primero from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
   order by x.fecha, x.id limit 1;

  v_dia := orden_dia_caja(v_local);
  v_corte := coalesce((select min(x.desde) from pos_cierres x
                        where x.local_id = v_local and x.prueba = v_prueba and x.estado = 'cerrada'),
                      orden_en_hora(v_local, v_dia, '00:00'));
  select coalesce(max(x.numero), 0) + 1 into v_num from pos_cierres x where x.local_id = v_local and x.prueba = v_prueba;

  insert into pos_cierres (local_id, numero, prueba, dia, desde, responsable, responsable_nombre, saldo_inicial,
                           contado, retiro, conteos, primer_conteo, observaciones, clave)
  values (v_local, v_num, v_prueba, v_dia, coalesce(u.fecha, v_corte), orden_yo_id(),
          (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()),
          case when u.id is null then k.saldo_inicial else u.queda end,
          v_cont, v_retiro, v_n, v_primero, v_obs, v_clave)
  returning id into v_id;

  /* Lo que entra en este cierre: todo lo que no tenía (también lo anulado, que no suma). */
  update pos_ventas set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null and fecha >= v_corte;
  update pos_caja_movimientos set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null;
  update pos_cambios set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null and fecha >= v_corte;

  with v as (select * from pos_ventas where cierre_id = v_id and estado = 'cobrada'),
       cb as (select * from pos_cambios where cierre_id = v_id and estado = 'hecho'),
       g as (select z.medio, sum(z.monto) monto from (
               select pg.medio, pg.monto from pos_venta_pagos pg join v on v.id = pg.venta_id
               union all
               select pc.medio, pc.monto from pos_cambio_pagos pc join cb on cb.id = pc.cambio_id) z
              group by z.medio),
       m as (select * from pos_caja_movimientos where cierre_id = v_id and estado = 'ok')
  update pos_cierres set
    tickets              = (select count(*) from v),
    ventas_efectivo      = coalesce((select g.monto from g where g.medio = 'efectivo'), 0),
    ventas_tarjeta       = coalesce((select g.monto from g where g.medio = 'tarjeta'), 0),
    ventas_mercadopago   = coalesce((select g.monto from g where g.medio = 'mercadopago'), 0),
    ventas_modo          = coalesce((select g.monto from g where g.medio = 'modo'), 0),
    ventas_go_cuotas     = coalesce((select g.monto from g where g.medio = 'go_cuotas'), 0),
    ventas_transferencia = coalesce((select g.monto from g where g.medio = 'transferencia'), 0),
    ventas_total         = coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    descuentos           = coalesce((select sum(v.descuentos) from v), 0),
    cambios              = (select count(*) from cb),
    cambios_diferencia   = coalesce((select sum(cb.diferencia) from cb), 0),
    gastos               = coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    otras_salidas        = coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    otros_ingresos       = coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0)
  where id = v_id;
  update pos_cierres set esperado = saldo_inicial + ventas_efectivo + otros_ingresos - gastos - otras_salidas
   where id = v_id
  returning * into c;

  return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                            'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'ya', false);
end $$;

/* Un gasto del local, otra salida u otro ingreso de la caja chica. Entra en
   el próximo cierre. Con la misma `clave` dos veces no se duplica. */
create or replace function pos_caja_mov_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_tipo    text := coalesce(p->>'tipo', '');
  v_rubro   text := nullif(trim(coalesce(p->>'rubro', '')), '');
  v_desc    text := nullif(trim(coalesce(p->>'descripcion', '')), '');
  v_monto   numeric := round(nullif(p->>'monto', '')::numeric, 2);
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_id      uuid;
begin
  perform pos_permiso();
  if v_clave is not null then
    select id into v_id from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_id, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_tipo not in ('gasto', 'salida', 'ingreso') then raise exception 'El movimiento tiene que ser un gasto, otra salida u otro ingreso.'; end if;
  if v_tipo = 'gasto' and v_rubro is null then raise exception 'Elegí el tipo de gasto.'; end if;
  if v_tipo <> 'gasto' and v_desc is null then raise exception 'Escribí de qué es.'; end if;
  if length(v_rubro) > 60 or length(v_desc) > 200 then raise exception 'El texto es demasiado largo.'; end if;
  if v_monto is null or v_monto <= 0 or v_monto >= 100000000 then raise exception 'Escribí el monto.'; end if;
  insert into pos_caja_movimientos (local_id, prueba, dia, tipo, rubro, descripcion, monto, persona, persona_nombre, clave)
  values (v_local, v_prueba, orden_dia_caja(v_local), v_tipo, case when v_tipo = 'gasto' then v_rubro end, v_desc, v_monto,
          orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_clave)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ya', false);
end $$;

/* Anular un gasto (queda en la lista, tachado, con quién y por qué). Sólo
   mientras la caja está abierta: si ya entró en un cierre, se anula el cierre. */
create or replace function pos_caja_mov_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare m pos_caja_movimientos;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into m from pos_caja_movimientos where id = p_id for update;
  if not found then raise exception 'No existe ese movimiento.'; end if;
  if m.estado = 'anulado' then raise exception 'Ese movimiento ya está anulado.'; end if;
  if m.cierre_id is not null then
    raise exception 'Ese movimiento ya entró en el cierre %: para cambiarlo, hay que anular el cierre.',
      (select case when c.prueba then 'P-' else 'Nº ' end || c.numero from pos_cierres c where c.id = m.cierre_id);
  end if;
  update pos_caja_movimientos set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  return true;
end $$;

/* El listado de cierres (como "Cierres de caja" de BlueSoft), con los totales del período. */
create or replace function pos_cierres(p_desde date, p_hasta date, p_local uuid default null, p_prueba boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
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
                    'gastos',      coalesce(sum(gastos + otras_salidas) filter (where estado = 'cerrada'), 0),
                    'retiro',      coalesce(sum(retiro) filter (where estado = 'cerrada'), 0),
                    'desvio',      coalesce(sum(desvio) filter (where estado = 'cerrada'), 0),
                    'faltas',      count(*) filter (where estado = 'cerrada' and desvio > tolerancia),
                    'sobras',      count(*) filter (where estado = 'cerrada' and -desvio > tolerancia)) from c),
      'mas', (select count(*) > 500 from c)
    )
  );
end $$;

/* Un cierre completo: sus números, sus gastos y cada vez que contaron. */
create or replace function pos_cierre(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform pos_permiso();
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
                                                     'monto', m.monto, 'persona', m.persona_nombre, 'estado', m.estado) order by m.fecha)
                   from pos_caja_movimientos m where m.cierre_id = c.id), '[]'::jsonb),
              'conteos_detalle', coalesce((
                 select jsonb_agg(jsonb_build_object('fecha', k.fecha, 'contado', k.contado, 'esperado', k.esperado, 'persona', pe.nombre) order by k.fecha, k.id)
                   from pos_caja_conteos k left join orden_personas pe on pe.id = k.persona
                  where k.local_id = c.local_id and k.prueba = c.prueba and k.fecha > c.desde and k.fecha <= c.fecha), '[]'::jsonb))
    into r
    from pos_cierres c join orden_locales l on l.id = c.local_id
   where c.id = p_id;
  if r is null then raise exception 'No existe ese cierre.'; end if;
  return r;
end $$;

/* Anular un cierre: sólo el último de la sucursal. Queda en la lista,
   tachado, y lo que tenía (ventas y gastos; desde el SQL 151, también los
   cambios) vuelve a la caja abierta, para cerrarla de nuevo. */
create or replace function pos_cierre_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare c pos_cierres; d pos_cierres;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into c from pos_cierres where id = p_id;
  if not found then raise exception 'No existe ese cierre.'; end if;
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || c.local_id::text || ':' || c.prueba::text));
  select * into c from pos_cierres where id = p_id for update;
  if c.estado = 'anulada' then raise exception 'Ese cierre ya está anulado.'; end if;
  select * into d from pos_cierres y
   where y.local_id = c.local_id and y.prueba = c.prueba and y.estado = 'cerrada' and y.fecha > c.fecha
   order by y.fecha limit 1;
  if found then
    raise exception 'Sólo se puede anular el último cierre de la sucursal: después vino el %.',
      case when d.prueba then 'P-' else 'Nº ' end || d.numero;
  end if;
  update pos_cierres set estado = 'anulada', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  update pos_ventas set cierre_id = null where cierre_id = p_id;
  update pos_caja_movimientos set cierre_id = null where cierre_id = p_id;
  update pos_cambios set cierre_id = null where cierre_id = p_id;
  return true;
end $$;

/* Los movimientos de la caja chica: los gastos, las otras salidas y entradas,
   y lo que pasó a la caja fuerte en cada cierre (la "Transferencia de fondos"
   de BlueSoft). */
create or replace function pos_caja_movimientos(p_desde date, p_hasta date, p_local uuid default null, p_tipo text default null,
                                                p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_tipo is not null and p_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte') then raise exception 'Ese tipo de movimiento no existe.'; end if;
  return (
    with t as (
      select m.id, 'mov'::text as origen, m.fecha, m.local_id, m.tipo, m.rubro, m.descripcion, m.monto, m.persona_nombre as persona,
             m.estado = 'ok' as vale, m.estado, m.cierre_id, m.anulado_motivo
        from pos_caja_movimientos m
       where m.dia between p_desde and p_hasta and m.prueba = coalesce(p_prueba, false) and (p_local is null or m.local_id = p_local)
      union all
      select c.id, 'cierre', c.fecha, c.local_id, 'caja_fuerte', null, null, c.retiro, c.responsable_nombre,
             c.estado = 'cerrada', case when c.estado = 'cerrada' then 'ok' else 'anulado' end, c.id, c.anulado_motivo
        from pos_cierres c
       where c.retiro > 0 and c.dia between p_desde and p_hasta and c.prueba = coalesce(p_prueba, false)
         and (p_local is null or c.local_id = p_local)
    ), f as (
      select * from t where p_tipo is null or t.tipo = p_tipo
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'origen', z.origen, 'fecha', z.fecha, 'local', l.nombre, 'local_id', z.local_id, 'tipo', z.tipo,
                 'rubro', z.rubro, 'descripcion', z.descripcion, 'monto', z.monto, 'persona', z.persona, 'estado', z.estado,
                 'motivo', z.anulado_motivo,
                 'cierre', (select jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'estado', c.estado)
                              from pos_cierres c where c.id = z.cierre_id)) order by z.fecha desc)
          from (select * from f order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'gasto',       coalesce(sum(monto) filter (where vale and tipo = 'gasto'), 0),
                    'salida',      coalesce(sum(monto) filter (where vale and tipo = 'salida'), 0),
                    'ingreso',     coalesce(sum(monto) filter (where vale and tipo = 'ingreso'), 0),
                    'caja_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'caja_fuerte'), 0),
                    'cantidad',    count(*) filter (where vale)) from f),
      'mas', (select count(*) > 500 from f)
    )
  );
end $$;

revoke all on function pos_caja_abierta(uuid, boolean) from public, anon, authenticated;
revoke all on function pos_caja(uuid, boolean), pos_caja_contar(uuid, boolean, numeric, numeric), pos_caja_cerrar(jsonb),
                       pos_caja_mov_guardar(jsonb), pos_caja_mov_anular(uuid, text), pos_cierres(date, date, uuid, boolean),
                       pos_cierre(uuid), pos_cierre_anular(uuid, text), pos_caja_movimientos(date, date, uuid, text, boolean)
       from public, anon;
grant execute on function pos_caja(uuid, boolean), pos_caja_contar(uuid, boolean, numeric, numeric), pos_caja_cerrar(jsonb),
                          pos_caja_mov_guardar(jsonb), pos_caja_mov_anular(uuid, text), pos_cierres(date, date, uuid, boolean),
                          pos_cierre(uuid), pos_cierre_anular(uuid, text), pos_caja_movimientos(date, date, uuid, text, boolean)
       to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 151 (21/10/2026) · LOS CAMBIOS
--
--  Mauricio (21/10, sobre las fotos del "Ticket de cambio" de BlueSoft):
--  "Hagámoslo igual… bien básico ahora, después podemos agregar mejoras."
--    · Arriba lo que vuelve ("Productos entrantes") y abajo lo que se lleva
--      ("Productos salientes"), como en BlueSoft. No se pide el ticket de la
--      compra.
--    · Lo que vuelve entra al precio de la lista de hoy, "aunque lo haya
--      comprado con promo".
--    · Si se lleva algo más caro, se cobra la diferencia y entra en el
--      cierre de caja, como una venta.
--    · Si se lleva algo más barato, NO se guarda: no se devuelve plata ni se
--      hace nota de crédito. "Si hay una diferencia mínima, ajustamos el
--      ticket para que dé cero y se guarda. Y pierde la plata."
--
--  Los precios: lo que vuelve va a precio de lista o menos, y lo que se
--  lleva, a precio de lista o más. Así el ajuste para que dé cero sube lo
--  que se lleva (lo que vuelve sigue figurando a precio de lista), y nunca
--  se puede inventar plata a favor del cliente.
--
--  La cuenta (la de BlueSoft: Neto, Descuentos, Total a pagar):
--    vuelve      = suma de lo que vuelve
--    se_lleva    = suma de lo que se lleva
--    diferencia  = se_lleva − vuelve  (nunca negativa)  =  suma de los pagos
--
--  Cada local numera sus cambios aparte de las ventas (C-1, C-2…) y sus
--  pruebas aparte (CP-1…). Todavía sin stock y sin factura.
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_cambios (
  id               uuid primary key default gen_random_uuid(),
  local_id         uuid not null references orden_locales(id),
  numero           int not null,
  prueba           boolean not null default false,
  fecha            timestamptz not null default clock_timestamp(),
  dia              date not null,
  vendedor         text not null,
  cargado_por      uuid,
  lista_id         int references pos_listas(id),
  cliente_nombre   text,
  vuelve           numeric(12,2) not null check (vuelve >= 0),
  se_lleva         numeric(12,2) not null check (se_lleva >= 0),
  diferencia       numeric(12,2) generated always as (se_lleva - vuelve) stored,
  cantidad_vuelve  int not null,
  cantidad_sale    int not null,
  observaciones    text,
  estado           text not null default 'hecho' check (estado in ('hecho', 'anulado')),
  anulado_en       timestamptz,
  anulado_por      uuid,
  anulado_motivo   text,
  cierre_id        uuid references pos_cierres(id) on delete set null,
  clave            text unique,
  unique (local_id, prueba, numero),
  check (se_lleva >= vuelve)
);
create index pos_cambios_dia on pos_cambios (dia, local_id);
create index pos_cambios_sin_cierre on pos_cambios (local_id, prueba) where cierre_id is null;

create table pos_cambio_items (
  cambio_id     uuid not null references pos_cambios(id) on delete cascade,
  item          int not null,
  sentido       text not null check (sentido in ('vuelve', 'sale')),
  codigo        text,
  descripcion   text not null,
  talle         text,
  color         text,
  cantidad      int not null check (cantidad between 1 and 999),
  precio        numeric(12,2) not null check (precio >= 0),
  precio_lista  numeric(12,2),            -- el de la lista ese día, si tenía: se ve si lo cambiaron a mano
  total         numeric(12,2) not null,
  primary key (cambio_id, item)
);

create table pos_cambio_pagos (
  cambio_id     uuid not null references pos_cambios(id) on delete cascade,
  orden         int not null,
  medio         text not null check (medio in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia')),
  monto         numeric(12,2) not null check (monto > 0),
  tarjeta       text,
  tipo_tarjeta  text check (tipo_tarjeta in ('credito', 'debito')),
  cuotas        int check (cuotas between 1 and 24),
  cupon         text,
  lote          text,
  ultimos4      text check (ultimos4 ~ '^[0-9]{4}$'),
  recibido      numeric(12,2),
  vuelto        numeric(12,2),
  primary key (cambio_id, orden)
);

-- Cuántos cambios entraron en cada cierre y cuánto se cobró en ellos (ya está sumado en las ventas).
alter table pos_cierres add column cambios int not null default 0;
alter table pos_cierres add column cambios_diferencia numeric(14,2) not null default 0;

alter table pos_cambios       enable row level security;
alter table pos_cambio_items  enable row level security;
alter table pos_cambio_pagos  enable row level security;
revoke all on pos_cambios, pos_cambio_items, pos_cambio_pagos from anon, authenticated;

/* El precio de un producto en una lista (el mismo que trae pos_precios), o
   null si no tiene. Es para las otras funciones. */
create or replace function pos_precio_de(p_lista int, p_codigo text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.precio from pos_precios p where p.lista_id = p_lista and p.codigo = upper(trim(p_codigo))),
    (select round(b.precio * (1 + l.ajuste / 100) / l.redondeo) * l.redondeo
       from pos_listas l join pos_precios b on b.lista_id = l.base_id and b.codigo = upper(trim(p_codigo))
      where l.id = p_lista))
$$;

/* Guardar un cambio. La pantalla manda lo que vuelve y lo que se lleva; acá
   se revisan los precios contra la lista, que no dé negativo y que los pagos
   sumen la diferencia. Con la misma `clave` dos veces (se cortó internet
   después de guardar) devuelve el que ya estaba, no lo duplica.
   SQL 160: lo que vuelve entra al stock del local y lo que se lleva sale. */
create or replace function pos_cambio_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_vend    text := nullif(trim(coalesce(p->>'vendedor', '')), '');
  v_lista   int := nullif(p->>'lista_id', '')::int;
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_obs     text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_vuelve  numeric := 0;
  v_sale    numeric := 0;
  v_cv      int := 0;
  v_cs      int := 0;
  v_pagado  numeric := 0;
  v_dif     numeric;
  v_num     int;
  v_id      uuid;
  v_ya      pos_cambios;
  x         jsonb;
  it        record;
  i         int;
  n         int;
  pr        numeric;
  pl        numeric;
  m         numeric;
begin
  perform pos_permiso();

  if v_clave is not null then
    select * into v_ya from pos_cambios where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'diferencia', v_ya.diferencia,
                                'fecha', v_ya.fecha, 'ya', true);
    end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
  if v_lista is null or not exists (select 1 from pos_listas where id = v_lista and activo) then
    raise exception 'Elegí la lista de precios.';
  end if;
  if length(v_obs) > 500 then raise exception 'Las observaciones son demasiado largas.'; end if;

  if jsonb_typeof(v_items) <> 'array' then raise exception 'Los productos no son válidos.'; end if;
  if jsonb_array_length(v_items) > 200 then raise exception 'Son demasiados renglones para un cambio.'; end if;
  for x in select * from jsonb_array_elements(v_items) loop
    n := (x->>'cantidad')::int;
    pr := round((x->>'precio')::numeric, 2);
    if coalesce(x->>'sentido', '') not in ('vuelve', 'sale') then raise exception 'Hay un renglón que no dice si vuelve o se lo lleva.'; end if;
    if n is null or n < 1 or n > 999 then raise exception 'Hay una cantidad que no es válida.'; end if;
    if pr is null or pr < 0 or pr >= 100000000 then raise exception 'Hay un precio que no es válido.'; end if;
    if nullif(trim(coalesce(x->>'descripcion', '')), '') is null then raise exception 'Hay un renglón sin descripción.'; end if;
    pl := pos_precio_de(v_lista, x->>'codigo');
    if x->>'sentido' = 'vuelve' then
      if pl is not null and pr > pl then
        raise exception 'Lo que vuelve entra al precio de lista (o menos): % está a $%.', trim(x->>'descripcion'), to_char(pl, 'FM999G999G990D00');
      end if;
      v_vuelve := v_vuelve + pr * n;
      v_cv := v_cv + n;
    else
      if pl is not null and pr < pl then
        raise exception 'Lo que se lleva no puede ir más barato que la lista: % está a $%.', trim(x->>'descripcion'), to_char(pl, 'FM999G999G990D00');
      end if;
      if pr = 0 then raise exception 'Hay una prenda que se lleva sin precio.'; end if;
      v_sale := v_sale + pr * n;
      v_cs := v_cs + n;
    end if;
  end loop;
  if v_cv = 0 then raise exception 'Falta lo que vuelve (los productos entrantes).'; end if;
  if v_cs = 0 then raise exception 'Falta lo que se lleva: en un cambio no se devuelve plata.'; end if;
  v_dif := v_sale - v_vuelve;
  if v_dif < 0 then
    raise exception 'Lo que se lleva ($%) vale menos que lo que vuelve ($%): así no se guarda, porque no se devuelve plata. Que se lleve algo más, o ajustá el precio para que dé $0.',
      to_char(v_sale, 'FM999G999G990D00'), to_char(v_vuelve, 'FM999G999G990D00');
  end if;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_dif = 0 and jsonb_array_length(v_pagos) > 0 then raise exception 'Sale lo mismo: no hay nada que cobrar.'; end if;
  if v_dif > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago de la diferencia.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia') then
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if x->>'medio' = 'tarjeta' then
      if nullif(trim(coalesce(x->>'tarjeta', '')), '') is null then raise exception 'Falta qué tarjeta es.'; end if;
      if coalesce(x->>'tipo_tarjeta', '') not in ('credito', 'debito') then raise exception 'Falta si la tarjeta es de crédito o de débito.'; end if;
      if coalesce(nullif(x->>'cuotas', '')::int, 1) not between 1 and 24 then raise exception 'Las cuotas van de 1 a 24.'; end if;
    end if;
    if x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null and (x->>'recibido')::numeric < m then
      raise exception 'Lo que recibiste en efectivo es menos que lo que se cobra.';
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_dif then
    raise exception 'Los pagos ($%) no suman la diferencia ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_dif, 'FM999G999G990D00');
  end if;

  /* Un número por vez en cada local: si dos guardan al mismo tiempo, el segundo espera. */
  perform pg_advisory_xact_lock(hashtext('pos_cambio:' || v_local::text || ':' || v_prueba::text));
  if v_clave is not null then
    select * into v_ya from pos_cambios where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'diferencia', v_ya.diferencia,
                                'fecha', v_ya.fecha, 'ya', true);
    end if;
  end if;
  select coalesce(max(c.numero), 0) + 1 into v_num from pos_cambios c where c.local_id = v_local and c.prueba = v_prueba;

  insert into pos_cambios (local_id, numero, prueba, dia, vendedor, cargado_por, lista_id, cliente_nombre, vuelve, se_lleva,
                           cantidad_vuelve, cantidad_sale, observaciones, clave)
  values (v_local, v_num, v_prueba, pos_hoy(), v_vend, orden_yo_id(), v_lista, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
          v_vuelve, v_sale, v_cv, v_cs, v_obs, v_clave)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    insert into pos_cambio_items (cambio_id, item, sentido, codigo, descripcion, talle, color, cantidad, precio, precio_lista, total)
    values (v_id, i, x->>'sentido', nullif(upper(trim(coalesce(x->>'codigo', ''))), ''), trim(x->>'descripcion'),
            nullif(trim(coalesce(x->>'talle', '')), ''), nullif(trim(coalesce(x->>'color', '')), ''),
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), pos_precio_de(v_lista, x->>'codigo'),
            round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int);
  end loop;

  /* SQL 160: lo que vuelve entra al stock del local y lo que se lleva sale.
     Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_cambio_items where cambio_id = v_id order by item loop
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color,
                              case when it.sentido = 'vuelve' then it.cantidad else -it.cantidad end,
                              'cambio', v_id, 'Cambio C-' || v_num, it.descripcion);
    end loop;
  end if;

  i := 0;
  for x in select * from jsonb_array_elements(v_pagos) loop
    i := i + 1;
    insert into pos_cambio_pagos (cambio_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            nullif(trim(coalesce(x->>'cupon', '')), ''), nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
  end loop;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v_prueba, 'diferencia', v_dif, 'fecha', now(), 'ya', false);
end $$;

/* El listado de cambios, con los totales. Los de verdad y los de prueba no se mezclan. */
create or replace function pos_cambios(p_desde date, p_hasta date, p_local uuid default null, p_prueba boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with c as (
      select x.* from pos_cambios x
       where x.dia between p_desde and p_hasta and x.prueba = coalesce(p_prueba, false)
         and (p_local is null or x.local_id = p_local)
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'numero', z.numero, 'prueba', z.prueba, 'fecha', z.fecha, 'local', l.nombre, 'local_id', z.local_id,
                 'vendedor', z.vendedor, 'cliente', coalesce(z.cliente_nombre, 'Consumidor final'),
                 'vuelven', (select string_agg(i.descripcion || coalesce(' ' || i.talle, '') || case when i.cantidad > 1 then ' ×' || i.cantidad else '' end, ', ' order by i.item)
                               from pos_cambio_items i where i.cambio_id = z.id and i.sentido = 'vuelve'),
                 'salen', (select string_agg(i.descripcion || coalesce(' ' || i.talle, '') || case when i.cantidad > 1 then ' ×' || i.cantidad else '' end, ', ' order by i.item)
                             from pos_cambio_items i where i.cambio_id = z.id and i.sentido = 'sale'),
                 'medios', (select jsonb_agg(g.medio order by g.orden) from pos_cambio_pagos g where g.cambio_id = z.id),
                 'vuelve', z.vuelve, 'se_lleva', z.se_lleva, 'diferencia', z.diferencia, 'estado', z.estado) order by z.fecha desc)
          from (select * from c order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'cambios',    count(*) filter (where estado = 'hecho'),
                    'anulados',   count(*) filter (where estado = 'anulado'),
                    'vuelven',    coalesce(sum(cantidad_vuelve) filter (where estado = 'hecho'), 0),
                    'salen',      coalesce(sum(cantidad_sale) filter (where estado = 'hecho'), 0),
                    'diferencia', coalesce(sum(diferencia) filter (where estado = 'hecho'), 0)) from c),
      'mas', (select count(*) > 500 from c)
    )
  );
end $$;

/* Un cambio completo, para verlo. */
create or replace function pos_cambio(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform pos_permiso();
  select to_jsonb(c) - 'clave'
         || jsonb_build_object(
              'local', l.nombre,
              'lista', (select x.nombre from pos_listas x where x.id = c.lista_id),
              'cargado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = c.cargado_por),
              'anulado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = c.anulado_por),
              'cierre', (select jsonb_build_object('id', k.id, 'numero', k.numero, 'prueba', k.prueba, 'estado', k.estado)
                           from pos_cierres k where k.id = c.cierre_id),
              'items', coalesce((select jsonb_agg(to_jsonb(i) - 'cambio_id' order by i.item) from pos_cambio_items i where i.cambio_id = c.id), '[]'::jsonb),
              'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'cambio_id' order by g.orden) from pos_cambio_pagos g where g.cambio_id = c.id), '[]'::jsonb))
    into r
    from pos_cambios c join orden_locales l on l.id = c.local_id
   where c.id = p_id;
  if r is null then raise exception 'No existe ese cambio.'; end if;
  return r;
end $$;

/* Anular un cambio (queda en la lista, tachado, con quién y por qué). Sólo
   mientras la caja está abierta: si ya entró en un cierre, se anula el cierre.
   SQL 160: el stock vuelve a como estaba antes del cambio. */
create or replace function pos_cambio_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare c pos_cambios; m pos_stock_movs;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into c from pos_cambios where id = p_id for update;
  if not found then raise exception 'No existe ese cambio.'; end if;
  if c.estado = 'anulado' then raise exception 'Ese cambio ya está anulado.'; end if;
  if c.cierre_id is not null then
    raise exception 'Ese cambio ya entró en el cierre %: para anularlo, hay que anular el cierre.',
      (select case when k.prueba then 'P-' else 'Nº ' end || k.numero from pos_cierres k where k.id = c.cierre_id);
  end if;
  update pos_cambios set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo = 'cambio' order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, 'cambio_anulado', p_id, m.ref || ' (anulado)');
  end loop;
  return true;
end $$;

revoke all on function pos_precio_de(int, text) from public, anon, authenticated;
revoke all on function pos_cambio_guardar(jsonb), pos_cambios(date, date, uuid, boolean), pos_cambio(uuid), pos_cambio_anular(uuid, text)
       from public, anon;
grant execute on function pos_cambio_guardar(jsonb), pos_cambios(date, date, uuid, boolean), pos_cambio(uuid), pos_cambio_anular(uuid, text)
       to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 160 (22/10/2026) · EL STOCK DE CADA LOCAL Y LOS REMITOS
--
--  Mauricio (22/10): "si me mandan un remito de fábrica, tendrían que poder
--  cargar un remito que me llega al local para yo poder verificar la ropa que
--  me entró y darlo por recibido, entonces el stock me ingresa al local".
--  Hoy, en BlueSoft, buscan cada producto del remito, cuentan por talle y
--  color, lo comparan con el sistema y, si coincide, ponen "Recibido"; además
--  lo anotan en una hoja de papel. Con dos mejoras ("las dos mejoras que
--  proponés… ya no tenemos que utilizar más papel"):
--    · se cuenta A CIEGAS, como el efectivo en el cierre de caja: primero se
--      escribe lo que llegó y recién después se compara con el remito;
--    · la hoja de papel la reemplaza el conteo guardado (quién, cuándo, qué).
--
--  El stock es por local, producto, talle y color (lo mismo que dice la
--  etiqueta). Cada movimiento queda anotado en pos_stock_movs:
--    · la venta saca; el cambio suma lo que vuelve y saca lo que se lleva;
--      anularlos lo devuelve. Las pruebas (el modo prueba) no tocan el stock.
--    · el remito suma en el local que lo recibe, producto por producto, al
--      recibirlo. Si sale de otro local (un envío entre locales), a ése se le
--      saca al mandarlo.
--    · el ajuste (falla, robo, error de carga) y el inventario (la carga desde
--      el Excel de "Consulta de stock" de BlueSoft, o el de cada seis meses)
--      dejan la cantidad que se contó.
--  Vender sin stock avisa pero no frena: queda en negativo, como en BlueSoft.
--
--  Lo que llega de la fábrica: la fábrica todavía no está en el sistema
--  (Mauricio: "vamos a tener que tener un sistema también para la fábrica…
--  primero arranquemos con lo básico"), así que el remito lo carga la oficina
--  y "Fábrica" no tiene stock acá.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── El stock de cada local (la "Consulta de stock" de BlueSoft) ──────────────
-- Sin talle o sin color (un accesorio), van vacíos ('').
create table pos_stock (
  local_id        uuid not null references orden_locales(id),
  codigo          text not null check (length(codigo) between 1 and 30),
  talle           text not null default '',
  color           text not null default '',
  cantidad        int not null default 0,
  entradas        int not null default 0,
  salidas         int not null default 0,
  descripcion     text,
  actualizado_en  timestamptz not null default now(),
  primary key (local_id, codigo, talle, color)
);

-- Cada movimiento, con lo que lo hizo (ref_id: la venta, el cambio, el remito o el inventario).
create table pos_stock_movs (
  id        bigserial primary key,
  local_id  uuid not null references orden_locales(id),
  codigo    text not null,
  talle     text not null default '',
  color     text not null default '',
  cantidad  int not null check (cantidad <> 0),          -- positivo entra, negativo sale
  tipo      text not null check (tipo in ('venta', 'venta_anulada', 'cambio', 'cambio_anulado', 'remito', 'remito_anulado',
                                          'envio', 'envio_anulado', 'ajuste', 'inventario')),
  ref_id    uuid,
  ref       text,                                        -- "Venta Nº 12", "Remito R-4"… para mostrar
  detalle   text,                                        -- el motivo del ajuste
  fecha     timestamptz not null default clock_timestamp(),
  persona   uuid,
  clave     text unique                                  -- el ajuste: dos veces la misma clave no ajusta dos veces
);
create index pos_stock_movs_variante on pos_stock_movs (local_id, codigo, talle, color, fecha desc);
create index pos_stock_movs_ref on pos_stock_movs (ref_id) where ref_id is not null;

-- ── Los remitos ("Remitos de compra" y "Envíos internos" de BlueSoft) ────────
-- Sin origen: viene de la fábrica. Sin destino: vuelve a la fábrica (SQL 167,
-- "que lo devuelvan"; la oficina lo da por recibido). Numeran todos juntos: R-1, R-2…
create table pos_remitos (
  id                uuid primary key default gen_random_uuid(),
  numero            int not null unique,
  origen_local_id   uuid references orden_locales(id),
  destino_local_id  uuid references orden_locales(id),
  referencia        text,                -- el número del remito de la fábrica (en BlueSoft, "X-0001234")
  fecha             timestamptz not null default clock_timestamp(),
  dia               date not null,
  creado_por        uuid,
  creado_nombre     text,
  observaciones     text,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'recibido', 'con_diferencias', 'anulado')),
  recibido_en       timestamptz,
  anulado_en        timestamptz,
  anulado_por       uuid,
  anulado_motivo    text,
  clave             text unique,
  check (origen_local_id is null or origen_local_id <> destino_local_id),
  constraint pos_remitos_con_destino check (origen_local_id is not null or destino_local_id is not null)
);
create index pos_remitos_destino on pos_remitos (destino_local_id, estado);
create index pos_remitos_dia on pos_remitos (dia);

-- Lo que mandaron (cantidad) y lo que llegó (contado; null mientras falta contar ese producto).
-- Lo que llegó sin estar en el remito entra con cantidad 0.
create table pos_remito_items (
  remito_id    uuid not null references pos_remitos(id) on delete cascade,
  codigo       text not null,
  talle        text not null default '',
  color        text not null default '',
  descripcion  text,
  cantidad     int not null check (cantidad between 0 and 9999),
  contado      int check (contado between 0 and 9999),
  orden        int not null default 0,
  primary key (remito_id, codigo, talle, color)
);

-- Cada producto recibido: si coincidió con el remito o se recibió con diferencias.
-- recibido_por/recibido_nombre: el usuario de la compu; recibio: quién del local lo
-- contó, elegido de la lista (SQL 167: la compu es compartida, como "Lo atendió").
create table pos_remito_productos (
  remito_id        uuid not null references pos_remitos(id) on delete cascade,
  codigo           text not null,
  estado           text not null check (estado in ('coincide', 'diferencias')),
  recibido_en      timestamptz not null default clock_timestamp(),
  recibido_por     uuid,
  recibido_nombre  text,
  observaciones    text,
  recibio          text,
  motivo           text check (motivo in ('Vino otro talle', 'Vino otro color', 'Vino fallada', 'Otro')),
  primary key (remito_id, codigo)
);

-- Cada vez que cuentan un producto (la hoja de papel de hoy): queda quién, cuándo y qué contó.
create table pos_remito_conteos (
  id         bigserial primary key,
  remito_id  uuid not null references pos_remitos(id) on delete cascade,
  codigo     text not null,
  fecha      timestamptz not null default clock_timestamp(),
  persona    uuid,
  conteo     jsonb not null,
  coincide   boolean not null,
  recibio    text
);
create index pos_remito_conteos_prod on pos_remito_conteos (remito_id, codigo, id);

-- ── Las cargas de inventario ─────────────────────────────────────────────────
create table pos_inventarios (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references orden_locales(id),
  fecha           timestamptz not null default clock_timestamp(),
  persona         uuid,
  persona_nombre  text,
  origen          text,                  -- el nombre del Excel, o "Pegado"
  lineas          int not null default 0,
  unidades        int not null default 0,
  cambiaron       int not null default 0,
  resto_a_cero    boolean not null default false,
  observaciones   text,
  clave           text unique
);
create index pos_inventarios_local on pos_inventarios (local_id, fecha desc);

alter table pos_stock             enable row level security;
alter table pos_stock_movs        enable row level security;
alter table pos_remitos           enable row level security;
alter table pos_remito_items      enable row level security;
alter table pos_remito_productos  enable row level security;
alter table pos_remito_conteos    enable row level security;
alter table pos_inventarios       enable row level security;
revoke all on pos_stock, pos_stock_movs, pos_remitos, pos_remito_items, pos_remito_productos, pos_remito_conteos, pos_inventarios
       from anon, authenticated;
revoke all on sequence pos_stock_movs_id_seq, pos_remito_conteos_id_seq from anon, authenticated;

/* Mover el stock de un local: anota el movimiento y lo suma en pos_stock. Es
   para las otras funciones. Sin código (un artículo suelto de "Nueva línea"),
   con un código de más de 30 letras o en cero, no hace nada. Las anulaciones
   restan de la columna de enfrente: anular una venta descuenta de las salidas,
   no suma en las entradas. */
create or replace function pos_stock_mover(p_local uuid, p_codigo text, p_talle text, p_color text, p_cantidad int,
                                           p_tipo text, p_ref_id uuid, p_ref text, p_descripcion text default null,
                                           p_detalle text default null, p_clave text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
  v_an  boolean := p_tipo like '%anulad%';
  v_e   int;
  v_s   int;
begin
  if v_c = '' or length(v_c) > 30 or coalesce(p_cantidad, 0) = 0 then return; end if;
  v_e := case when not v_an and p_cantidad > 0 then p_cantidad when v_an and p_cantidad < 0 then p_cantidad else 0 end;
  v_s := case when not v_an and p_cantidad < 0 then -p_cantidad when v_an and p_cantidad > 0 then -p_cantidad else 0 end;
  insert into pos_stock_movs (local_id, codigo, talle, color, cantidad, tipo, ref_id, ref, detalle, persona, clave)
  values (p_local, v_c, v_t, v_co, p_cantidad, p_tipo, p_ref_id, p_ref, nullif(trim(coalesce(p_detalle, '')), ''), orden_yo_id(), p_clave);
  insert into pos_stock as st (local_id, codigo, talle, color, cantidad, entradas, salidas, descripcion)
  values (p_local, v_c, v_t, v_co, p_cantidad, v_e, v_s, nullif(trim(coalesce(p_descripcion, '')), ''))
  on conflict (local_id, codigo, talle, color) do update
     set cantidad = st.cantidad + excluded.cantidad, entradas = st.entradas + excluded.entradas, salidas = st.salidas + excluded.salidas,
         descripcion = coalesce(excluded.descripcion, st.descripcion), actualizado_en = now();
end $$;

/* El stock de un local para la venta y el cambio: avisan si se vende algo que
   según el sistema no hay. con_stock: el local ya tiene stock cargado (si no,
   no se avisa nada). Sólo las variantes que no están en cero. */
create or replace function pos_stock_local(p_local uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  return jsonb_build_object(
    'con_stock', exists (select 1 from pos_stock s where s.local_id = p_local and s.cantidad > 0),
    'filas', coalesce((select jsonb_agg(jsonb_build_array(s.codigo, s.talle, s.color, s.cantidad))
                         from pos_stock s where s.local_id = p_local and s.cantidad <> 0), '[]'::jsonb));
end $$;

/* La consulta de stock (como la de BlueSoft). p_codigos: los que encontró la
   pantalla en el catálogo (por nombre o por rubro); p_buscar: el texto, para
   los que no están en el catálogo. Sin ninguno de los dos, todo. */
create or replace function pos_stock_consulta(p_local uuid default null, p_codigos text[] default null, p_buscar text default null,
                                              p_ocultar_sin boolean default true, p_negativos boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
begin
  perform pos_permiso();
  return (
    with s as (
      select x.* from pos_stock x
       where (p_local is null or x.local_id = p_local)
         and ((p_codigos is null and v_q is null)
              or x.codigo = any(coalesce(p_codigos, '{}'::text[]))
              or (v_q is not null and (lower(x.codigo) like v_q || '%' or lower(coalesce(x.descripcion, '')) like '%' || v_q || '%')))
         and (not coalesce(p_ocultar_sin, true) or x.cantidad <> 0)
         and (not coalesce(p_negativos, false) or x.cantidad < 0)
    )
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(jsonb_build_array(z.local_id, z.codigo, z.talle, z.color, z.cantidad, z.entradas, z.salidas, z.descripcion)
                                          order by z.codigo, z.color, z.talle, z.local_id)
                           from (select * from s order by codigo, color, talle, local_id limit 3000) z), '[]'::jsonb),
      'totales', (select jsonb_build_object('cantidad', coalesce(sum(cantidad), 0), 'entradas', coalesce(sum(entradas), 0),
                                            'salidas', coalesce(sum(salidas), 0), 'lineas', count(*),
                                            'negativos', count(*) filter (where cantidad < 0)) from s),
      'cargado', exists (select 1 from pos_stock y where p_local is null or y.local_id = p_local),
      'mas', (select count(*) > 3000 from s)
    )
  );
end $$;

/* Una variante en un local: cuánto hay y sus últimos movimientos ("Ver detalle de movimientos"). */
create or replace function pos_stock_variante(p_local uuid, p_codigo text, p_talle text, p_color text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
begin
  perform pos_permiso();
  return jsonb_build_object(
    'local', (select l.nombre from orden_locales l where l.id = p_local),
    'stock', (select jsonb_build_object('cantidad', s.cantidad, 'entradas', s.entradas, 'salidas', s.salidas, 'descripcion', s.descripcion)
                from pos_stock s where s.local_id = p_local and s.codigo = v_c and s.talle = v_t and s.color = v_co),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', m.fecha, 'tipo', m.tipo, 'cantidad', m.cantidad, 'ref', m.ref, 'ref_id', m.ref_id,
                                          'detalle', m.detalle, 'persona', pe.nombre) order by m.fecha desc, m.id desc)
        from (select * from pos_stock_movs x
               where x.local_id = p_local and x.codigo = v_c and x.talle = v_t and x.color = v_co
               order by x.fecha desc, x.id desc limit 200) m
        left join orden_personas pe on pe.id = m.persona), '[]'::jsonb));
end $$;

/* El ajuste de stock de BlueSoft: "hay en realidad N", con el motivo. Con la
   misma clave dos veces no ajusta dos veces. */
create or replace function pos_stock_ajustar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local    uuid := nullif(p->>'local_id', '')::uuid;
  v_c        text := upper(trim(coalesce(p->>'codigo', '')));
  v_t        text := upper(trim(coalesce(p->>'talle', '')));
  v_co       text := upper(trim(coalesce(p->>'color', '')));
  v_motivo   text := trim(coalesce(p->>'motivo', ''));
  v_detalle  text := nullif(trim(coalesce(p->>'detalle', '')), '');
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_nueva    int;
  v_actual   int;
begin
  perform pos_permiso();
  if v_clave is not null and exists (select 1 from pos_stock_movs where clave = v_clave) then
    return jsonb_build_object('ya', true);
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then raise exception 'Elegí la sucursal.'; end if;
  if v_c = '' or length(v_c) > 30 then raise exception 'Falta el código del producto.'; end if;
  if coalesce(p->>'cantidad', '') !~ '^[0-9]{1,5}$' then raise exception 'Escribí cuántas hay de verdad (de 0 a 99999).'; end if;
  v_nueva := (p->>'cantidad')::int;
  if v_motivo not in ('Falla', 'Robo o faltante', 'Error de carga', 'Apareció', 'Otro') then raise exception 'Elegí el motivo del ajuste.'; end if;
  if v_motivo = 'Otro' and v_detalle is null then raise exception 'Escribí el motivo.'; end if;
  if length(v_detalle) > 200 then raise exception 'El detalle es demasiado largo.'; end if;
  /* Un ajuste por vez en cada local, y el renglón bloqueado (si justo entra
     una venta, espera): así "hay N" es contra lo que hay de verdad. */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || v_local::text));
  select s.cantidad into v_actual from pos_stock s
   where s.local_id = v_local and s.codigo = v_c and s.talle = v_t and s.color = v_co for update;
  v_actual := coalesce(v_actual, 0);
  if v_nueva = v_actual then raise exception 'El sistema ya dice %: no hay nada que ajustar.', v_actual; end if;
  perform pos_stock_mover(v_local, v_c, v_t, v_co, v_nueva - v_actual, 'ajuste', null, 'Ajuste',
                          nullif(trim(coalesce(p->>'descripcion', '')), ''), v_motivo || coalesce(': ' || v_detalle, ''), v_clave);
  return jsonb_build_object('antes', v_actual, 'ahora', v_nueva, 'ya', false);
end $$;

/* Cargar un inventario: lo que dice la lista reemplaza lo que dice el sistema
   (la carga inicial desde el Excel de BlueSoft, o el inventario de cada seis
   meses). Con resto_a_cero, lo que no está en la lista queda en 0: es el
   inventario completo del local. Con la misma clave dos veces, no lo carga dos
   veces. */
create or replace function pos_inventario_cargar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_cero    boolean := coalesce(nullif(p->>'resto_a_cero', '')::boolean, false);
  v_obs     text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_origen  text := nullif(trim(coalesce(p->>'origen', '')), '');
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_ya      pos_inventarios;
  v_id      uuid;
  v_l       int := 0;
  v_u       int := 0;
  v_c       int := 0;
  x         record;
  e         jsonb;
begin
  perform pos_permiso();
  if v_clave is not null then
    select * into v_ya from pos_inventarios where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'lineas', v_ya.lineas, 'unidades', v_ya.unidades, 'cambiaron', v_ya.cambiaron, 'ya', true);
    end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then raise exception 'Elegí la sucursal.'; end if;
  if length(v_obs) > 300 or length(v_origen) > 120 then raise exception 'El texto es demasiado largo.'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La lista está vacía.'; end if;
  if jsonb_array_length(v_items) > 30000 then raise exception 'Son demasiados renglones (máximo, 30.000).'; end if;
  for e in select * from jsonb_array_elements(v_items) loop
    if nullif(trim(coalesce(e->>'codigo', '')), '') is null then raise exception 'Hay un renglón sin código.'; end if;
    if length(trim(e->>'codigo')) > 30 then raise exception 'El código % es demasiado largo.', left(trim(e->>'codigo'), 40); end if;
    if coalesce(e->>'cantidad', '') !~ '^-?[0-9]{1,5}$' then
      raise exception 'La cantidad de % no es un número entero.', trim(e->>'codigo');
    end if;
  end loop;

  /* Uno por vez en cada local: los ajustes y las otras cargas esperan, y el
     stock del local queda bloqueado (las ventas de ese momento esperan). */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || v_local::text));
  perform 1 from pos_stock where local_id = v_local for update;
  insert into pos_inventarios (local_id, persona, persona_nombre, origen, resto_a_cero, observaciones, clave)
  values (v_local, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_origen, v_cero, v_obs, v_clave)
  returning id into v_id;

  /* Lo de la lista (los repetidos se suman), contra lo que dice el sistema. */
  for x in
    select z.c, z.t, z.co, z.n, z.d, coalesce(s.cantidad, 0) actual
      from (select upper(trim(e2->>'codigo')) c, upper(trim(coalesce(e2->>'talle', ''))) t, upper(trim(coalesce(e2->>'color', ''))) co,
                   sum((e2->>'cantidad')::int)::int n, max(nullif(trim(coalesce(e2->>'descripcion', '')), '')) d
              from jsonb_array_elements(v_items) e2 group by 1, 2, 3) z
      left join pos_stock s on s.local_id = v_local and s.codigo = z.c and s.talle = z.t and s.color = z.co
  loop
    v_l := v_l + 1;
    v_u := v_u + greatest(x.n, 0);
    if x.n <> x.actual then
      perform pos_stock_mover(v_local, x.c, x.t, x.co, x.n - x.actual, 'inventario', v_id, 'Inventario', x.d);
      v_c := v_c + 1;
    elsif x.d is not null then
      update pos_stock set descripcion = x.d where local_id = v_local and codigo = x.c and talle = x.t and color = x.co and descripcion is null;
    end if;
  end loop;

  /* Lo que no está en la lista, en 0 (es el inventario completo del local). */
  if v_cero then
    for x in
      select s.codigo, s.talle, s.color, s.cantidad
        from pos_stock s
        left join (select distinct upper(trim(e3->>'codigo')) c, upper(trim(coalesce(e3->>'talle', ''))) t, upper(trim(coalesce(e3->>'color', ''))) co
                     from jsonb_array_elements(v_items) e3) z on z.c = s.codigo and z.t = s.talle and z.co = s.color
       where s.local_id = v_local and s.cantidad <> 0 and z.c is null
    loop
      perform pos_stock_mover(v_local, x.codigo, x.talle, x.color, -x.cantidad, 'inventario', v_id, 'Inventario', null, 'No estaba en la lista');
      v_c := v_c + 1;
    end loop;
  end if;

  update pos_inventarios set lineas = v_l, unidades = v_u, cambiaron = v_c where id = v_id;
  return jsonb_build_object('id', v_id, 'lineas', v_l, 'unidades', v_u, 'cambiaron', v_c, 'ya', false);
end $$;

/* Las cargas de inventario anteriores (las últimas 50). */
create or replace function pos_inventarios(p_local uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'fecha', i.fecha, 'local', l.nombre, 'local_id', i.local_id, 'persona', i.persona_nombre,
                                        'origen', i.origen, 'lineas', i.lineas, 'unidades', i.unidades, 'cambiaron', i.cambiaron,
                                        'resto_a_cero', i.resto_a_cero, 'observaciones', i.observaciones) order by i.fecha desc)
      from (select * from pos_inventarios x where p_local is null or x.local_id = p_local order by x.fecha desc limit 50) i
      join orden_locales l on l.id = i.local_id), '[]'::jsonb);
end $$;

/* Un remito nuevo: de la fábrica (sin origen) o de otro local (un envío), a
   un local. Los renglones repetidos (el mismo código, talle y color) se suman.
   Si sale de un local, a ése se le saca del stock ahora. Con la misma clave
   dos veces devuelve el que ya estaba.
   SQL 167: con a_fabrica, de un local a la fábrica (una devolución, "que lo
   devuelvan"): sale del stock del local ahora y la oficina lo da por recibido. */
create or replace function pos_remito_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_origen   uuid := nullif(p->>'origen_local_id', '')::uuid;
  v_destino  uuid := nullif(p->>'destino_local_id', '')::uuid;
  v_fabrica  boolean := coalesce(p->>'a_fabrica', '') = 'true';
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_obs      text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_ref      text := nullif(trim(coalesce(p->>'referencia', '')), '');
  v_items    jsonb := coalesce(p->'items', '[]'::jsonb);
  v_ya       pos_remitos;
  v_id       uuid;
  v_num      int;
  x          jsonb;
  m          record;
begin
  perform pos_permiso();
  if v_clave is not null then
    select * into v_ya from pos_remitos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'ya', true); end if;
  end if;
  if v_fabrica then
    v_destino := null;
    if v_origen is null then raise exception 'Para mandarlo a la fábrica, elegí de qué local sale.'; end if;
  elsif v_destino is null or not exists (select 1 from orden_locales where id = v_destino and activo) then
    raise exception 'Elegí a qué local va.';
  end if;
  if v_origen is not null and not exists (select 1 from orden_locales where id = v_origen and activo) then
    raise exception 'El local de donde sale no existe.';
  end if;
  if v_origen = v_destino then raise exception 'Sale y llega al mismo local: elegí otro.'; end if;
  if length(v_obs) > 300 then raise exception 'Las observaciones son demasiado largas.'; end if;
  if length(v_ref) > 40 then raise exception 'La referencia es demasiado larga.'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'El remito no tiene productos.'; end if;
  if jsonb_array_length(v_items) > 2000 then raise exception 'Son demasiados renglones para un remito.'; end if;
  for x in select * from jsonb_array_elements(v_items) loop
    if nullif(trim(coalesce(x->>'codigo', '')), '') is null then raise exception 'Hay un renglón sin código.'; end if;
    if length(trim(x->>'codigo')) > 30 then raise exception 'El código % es demasiado largo.', left(trim(x->>'codigo'), 40); end if;
    if length(trim(coalesce(x->>'talle', ''))) > 10 or length(trim(coalesce(x->>'color', ''))) > 20 then
      raise exception 'Hay un talle o un color demasiado largo.';
    end if;
    if coalesce(x->>'cantidad', '') !~ '^[0-9]{1,4}$' or (x->>'cantidad')::int < 1 then
      raise exception 'La cantidad de % no es válida (de 1 a 9999).', trim(x->>'codigo');
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(v_items) e
              group by upper(trim(e->>'codigo')), upper(trim(coalesce(e->>'talle', ''))), upper(trim(coalesce(e->>'color', '')))
             having sum((e->>'cantidad')::int) > 9999) then
    raise exception 'Hay un producto con más de 9999 unidades.';
  end if;

  /* Un número por vez: si dos guardan al mismo tiempo, el segundo espera. */
  perform pg_advisory_xact_lock(hashtext('pos_remito'));
  if v_clave is not null then
    select * into v_ya from pos_remitos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'ya', true); end if;
  end if;
  select coalesce(max(numero), 0) + 1 into v_num from pos_remitos;

  insert into pos_remitos (numero, origen_local_id, destino_local_id, referencia, dia, creado_por, creado_nombre, observaciones, clave)
  values (v_num, v_origen, v_destino, v_ref, pos_hoy(), orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_obs, v_clave)
  returning id into v_id;

  insert into pos_remito_items (remito_id, codigo, talle, color, descripcion, cantidad, orden)
  select v_id, z.c, z.t, z.co, max(z.d), sum(z.n), min(z.o)
    from (select upper(trim(e.v->>'codigo')) c, upper(trim(coalesce(e.v->>'talle', ''))) t, upper(trim(coalesce(e.v->>'color', ''))) co,
                 nullif(trim(coalesce(e.v->>'descripcion', '')), '') d, (e.v->>'cantidad')::int n, e.o::int o
            from jsonb_array_elements(v_items) with ordinality e(v, o)) z
   group by z.c, z.t, z.co;

  /* Un envío entre locales (o una devolución a la fábrica): sale ahora del stock del que lo manda. */
  if v_origen is not null then
    for m in select * from pos_remito_items where remito_id = v_id loop
      perform pos_stock_mover(v_origen, m.codigo, m.talle, m.color, -m.cantidad, 'envio', v_id,
                              case when v_destino is null then 'Devolución R-' else 'Envío R-' end || v_num, m.descripcion);
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'ya', false,
                            'productos', (select count(distinct codigo) from pos_remito_items where remito_id = v_id),
                            'unidades', (select sum(cantidad) from pos_remito_items where remito_id = v_id));
end $$;

/* El listado de remitos. p_local: los que llegan a ese local o salen de él.
   "pendiente" trae todos los que faltan recibir, de cualquier día; los demás
   estados, los del período. SQL 167: los que vuelven a la fábrica (sin
   destino) y las diferencias que faltan resolver de cada uno. */
create or replace function pos_remitos(p_desde date, p_hasta date, p_local uuid default null, p_estado text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_estado is not null and p_estado not in ('pendiente', 'recibido', 'con_diferencias', 'anulado') then
    raise exception 'Ese estado no existe.';
  end if;
  if p_estado is distinct from 'pendiente' then
    if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
    if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  end if;
  return (
    with r as (
      select x.* from pos_remitos x
       where (p_local is null or x.destino_local_id = p_local or x.origen_local_id = p_local)
         and case when p_estado = 'pendiente' then x.estado = 'pendiente'
                  else x.dia between p_desde and p_hasta
                       and (p_estado is null or x.estado = p_estado or (p_estado = 'recibido' and x.estado = 'con_diferencias')) end
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'numero', z.numero, 'referencia', z.referencia, 'fecha', z.fecha, 'estado', z.estado,
                 'origen_local_id', z.origen_local_id, 'origen', coalesce(lo.nombre, 'Fábrica'),
                 'destino_local_id', z.destino_local_id, 'destino', coalesce(ld.nombre, 'Fábrica'),
                 'productos', (select count(distinct i.codigo) from pos_remito_items i where i.remito_id = z.id),
                 'recibidos', (select count(*) from pos_remito_productos k where k.remito_id = z.id),
                 'unidades', (select coalesce(sum(i.cantidad), 0) from pos_remito_items i where i.remito_id = z.id),
                 'contadas', (select sum(i.contado) from pos_remito_items i where i.remito_id = z.id),
                 'dif_pendientes', (select count(*) from pos_remito_diferencias d where d.remito_id = z.id and d.estado = 'pendiente'),
                 'observaciones', z.observaciones, 'creado_nombre', z.creado_nombre, 'recibido_en', z.recibido_en,
                 'anulado_motivo', z.anulado_motivo) order by z.fecha desc)
          from (select * from r order by fecha desc limit 500) z
          left join orden_locales ld on ld.id = z.destino_local_id
          left join orden_locales lo on lo.id = z.origen_local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'remitos', count(*) filter (where r.estado <> 'anulado'),
                    'pendientes', count(*) filter (where r.estado = 'pendiente'),
                    'con_diferencias', count(*) filter (where r.estado = 'con_diferencias'),
                    'anulados', count(*) filter (where r.estado = 'anulado'),
                    'unidades', coalesce((select sum(i.cantidad) from pos_remito_items i join r y on y.id = i.remito_id where y.estado <> 'anulado'), 0))
                    from r),
      'mas', (select count(*) > 500 from r)
    )
  );
end $$;

/* Un remito, producto por producto. A CIEGAS: de lo que todavía no se recibió
   van el talle y el color, pero no cuántas mandaron (se ve al comparar). Con
   p_completo (Gestión, la oficina), todo. SQL 167: quién lo recibió, qué pasó
   y cada diferencia con cómo se resolvió. */
create or replace function pos_remito(p_id uuid, p_completo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform pos_permiso();
  select to_jsonb(x) - 'clave' || jsonb_build_object(
           'origen', coalesce(lo.nombre, 'Fábrica'), 'destino', coalesce(ld.nombre, 'Fábrica'),
           'anulado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = x.anulado_por),
           'productos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'codigo', g.codigo, 'descripcion', g.descripcion,
                      'estado', k.estado, 'recibido_en', k.recibido_en, 'recibido_nombre', coalesce(k.recibio, k.recibido_nombre),
                      'observaciones', k.observaciones, 'motivo', k.motivo,
                      'diferencias', (select jsonb_agg(jsonb_build_object('id', d.id, 'talle', d.talle, 'color', d.color, 'cantidad', d.cantidad,
                                                                          'contado', d.contado, 'estado', d.estado, 'resolucion', d.resolucion, 'nota', d.nota,
                                                                          'resuelta_en', d.resuelta_en, 'resuelta_nombre', d.resuelta_nombre,
                                                                          'remito_nuevo_numero', rn.numero) order by d.color, d.talle)
                                        from pos_remito_diferencias d left join pos_remitos rn on rn.id = d.remito_nuevo_id
                                       where d.remito_id = x.id and d.codigo = g.codigo),
                      'conteos', (select count(*) from pos_remito_conteos c where c.remito_id = x.id and c.codigo = g.codigo),
                      'celdas', (select jsonb_agg(case when k.codigo is not null or x.estado = 'anulado' or coalesce(p_completo, false)
                                                       then jsonb_build_object('talle', i.talle, 'color', i.color, 'cantidad', i.cantidad, 'contado', i.contado)
                                                       else jsonb_build_object('talle', i.talle, 'color', i.color) end
                                                  order by i.color, i.talle)
                                   from pos_remito_items i where i.remito_id = x.id and i.codigo = g.codigo))
                    order by g.orden, g.codigo)
               from (select i.codigo, max(i.descripcion) descripcion, min(i.orden) orden
                       from pos_remito_items i where i.remito_id = x.id group by i.codigo) g
               left join pos_remito_productos k on k.remito_id = x.id and k.codigo = g.codigo), '[]'::jsonb))
    into r
    from pos_remitos x
    left join orden_locales ld on ld.id = x.destino_local_id
    left join orden_locales lo on lo.id = x.origen_local_id
   where x.id = p_id;
  if r is null then raise exception 'No existe ese remito.'; end if;
  return r;
end $$;

/* Un conteo prolijo: [{talle, color, cantidad}] en mayúsculas, sin ceros, con
   los repetidos sumados y siempre en el mismo orden (así dos conteos iguales
   dan el mismo jsonb). Es para las otras funciones. */
create or replace function pos_remito_conteo_limpio(p jsonb) returns jsonb
language plpgsql immutable as $$
declare x jsonb; r jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then raise exception 'El conteo no es válido.'; end if;
  if jsonb_array_length(p) > 500 then raise exception 'Son demasiados talles y colores.'; end if;
  for x in select * from jsonb_array_elements(p) loop
    if coalesce(x->>'cantidad', '') !~ '^[0-9]{1,4}$' then raise exception 'Hay una cantidad que no es un número (de 0 a 9999).'; end if;
    if length(trim(coalesce(x->>'talle', ''))) > 10 or length(trim(coalesce(x->>'color', ''))) > 20 then
      raise exception 'Hay un talle o un color demasiado largo.';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('talle', z.t, 'color', z.c, 'cantidad', z.n) order by z.c, z.t), '[]'::jsonb) into r
    from (select upper(trim(coalesce(e->>'talle', ''))) t, upper(trim(coalesce(e->>'color', ''))) c, sum((e->>'cantidad')::int) n
            from jsonb_array_elements(p) e group by 1, 2) z
   where z.n > 0;
  if exists (select 1 from jsonb_array_elements(r) e where (e->>'cantidad')::int > 9999) then
    raise exception 'Hay una cantidad de más de 9999.';
  end if;
  return r;
end $$;

/* Recibir un producto con lo que se contó: lo anota en el remito, lo suma al
   stock del local que lo recibe y, si era el último, da el remito por
   recibido. Es para pos_remito_contar y pos_remito_recibir.
   SQL 167: quién lo recibió y qué pasó; si no coincidió, cada talle y color
   que no dio queda en pos_remito_diferencias (la planilla de errores). */
create or replace function pos_remito_entrar(r pos_remitos, p_codigo text, p_conteo jsonb, p_estado text, p_obs text, p_descripcion text,
                                             p_recibio text default null, p_motivo text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  m       record;
  v_desc  text;
  v_ord   int;
begin
  v_desc := coalesce((select max(descripcion) from pos_remito_items where remito_id = r.id and codigo = p_codigo),
                     nullif(trim(coalesce(p_descripcion, '')), ''));
  v_ord := coalesce((select min(orden) from pos_remito_items where remito_id = r.id and codigo = p_codigo),
                    (select coalesce(max(orden), 0) + 1 from pos_remito_items where remito_id = r.id));
  update pos_remito_items i
     set contado = coalesce((select (e->>'cantidad')::int from jsonb_array_elements(p_conteo) e
                              where e->>'talle' = i.talle and e->>'color' = i.color), 0),
         descripcion = coalesce(i.descripcion, v_desc)
   where i.remito_id = r.id and i.codigo = p_codigo;
  /* Lo que llegó sin estar en el remito: entra con cantidad 0 (mandaron 0). */
  insert into pos_remito_items (remito_id, codigo, talle, color, descripcion, cantidad, contado, orden)
  select r.id, p_codigo, e->>'talle', e->>'color', v_desc, 0, (e->>'cantidad')::int, v_ord
    from jsonb_array_elements(p_conteo) e
   where not exists (select 1 from pos_remito_items i
                      where i.remito_id = r.id and i.codigo = p_codigo and i.talle = e->>'talle' and i.color = e->>'color');
  insert into pos_remito_productos (remito_id, codigo, estado, recibido_por, recibido_nombre, observaciones, recibio, motivo)
  values (r.id, p_codigo, p_estado, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), p_obs,
          nullif(trim(coalesce(p_recibio, '')), ''), p_motivo);
  if p_estado = 'diferencias' then
    insert into pos_remito_diferencias (remito_id, local_id, codigo, talle, color, descripcion, cantidad, contado)
    select r.id, r.destino_local_id, i.codigo, i.talle, i.color, i.descripcion, i.cantidad, coalesce(i.contado, 0)
      from pos_remito_items i
     where i.remito_id = r.id and i.codigo = p_codigo and i.cantidad <> coalesce(i.contado, 0);
  end if;
  for m in select * from pos_remito_items where remito_id = r.id and codigo = p_codigo and contado > 0 loop
    perform pos_stock_mover(r.destino_local_id, m.codigo, m.talle, m.color, m.contado, 'remito', r.id, 'Remito R-' || r.numero, m.descripcion);
  end loop;
  if not exists (select 1 from pos_remito_items i
                  where i.remito_id = r.id
                    and not exists (select 1 from pos_remito_productos k where k.remito_id = r.id and k.codigo = i.codigo)) then
    update pos_remitos
       set estado = case when exists (select 1 from pos_remito_productos k where k.remito_id = r.id and k.estado = 'diferencias')
                         then 'con_diferencias' else 'recibido' end,
           recibido_en = clock_timestamp()
     where id = r.id;
  end if;
end $$;

/* Contar un producto del remito (a ciegas) y compararlo. Cada conteo queda
   anotado. Si coincide celda por celda, el producto entra al stock en el acto
   ("si coincide, ponemos recibido y pasamos a otro producto"). Si no, devuelve
   la comparación: se cuenta de nuevo o se recibe con lo contado
   (pos_remito_recibir). Un producto que no está en el remito también se puede
   contar: es lo que llegó de más. SQL 167: p_recibio, quién del local lo cuenta. */
create or replace function pos_remito_contar(p_remito uuid, p_codigo text, p_conteo jsonb, p_recibio text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r       pos_remitos;
  v_c     text := upper(trim(coalesce(p_codigo, '')));
  v_q     text := nullif(trim(coalesce(p_recibio, '')), '');
  v_cont  jsonb;
  v_cel   jsonb;
  v_ok    boolean;
begin
  perform pos_permiso();
  if v_c = '' or length(v_c) > 30 then raise exception 'Falta el producto.'; end if;
  if length(v_q) > 60 then raise exception 'El nombre de quién lo recibió es demasiado largo.'; end if;
  v_cont := pos_remito_conteo_limpio(p_conteo);
  /* Un producto por vez en cada remito: si dos lo cuentan al mismo tiempo, el segundo espera. */
  perform pg_advisory_xact_lock(hashtext('pos_remito:' || coalesce(p_remito::text, '')));
  select * into r from pos_remitos where id = p_remito for update;
  if not found then raise exception 'No existe ese remito.'; end if;
  if r.estado = 'anulado' then raise exception 'Ese remito está anulado.'; end if;
  if r.estado <> 'pendiente' then raise exception 'Ese remito ya está recibido.'; end if;
  if r.destino_local_id is null then raise exception 'Ese remito vuelve a la fábrica: se da por recibido en Gestión.'; end if;
  if exists (select 1 from pos_remito_productos where remito_id = p_remito and codigo = v_c) then
    raise exception 'Ese producto ya está recibido.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('talle', z.talle, 'color', z.color, 'cantidad', z.cantidad, 'contado', z.contado)
                            order by z.color, z.talle), '[]'::jsonb),
         coalesce(bool_and(z.cantidad = z.contado), true)
    into v_cel, v_ok
    from (select coalesce(i.talle, k.talle) talle, coalesce(i.color, k.color) color, coalesce(i.cantidad, 0) cantidad, coalesce(k.n, 0) contado
            from (select talle, color, cantidad from pos_remito_items where remito_id = p_remito and codigo = v_c) i
            full join (select e->>'talle' talle, e->>'color' color, (e->>'cantidad')::int n from jsonb_array_elements(v_cont) e) k
              on k.talle = i.talle and k.color = i.color) z
   where z.cantidad > 0 or z.contado > 0;
  if jsonb_array_length(v_cel) = 0 then
    raise exception 'Ese producto no está en el remito y no contaste nada.';
  end if;
  insert into pos_remito_conteos (remito_id, codigo, persona, conteo, coincide, recibio) values (p_remito, v_c, orden_yo_id(), v_cont, v_ok, v_q);
  if v_ok then
    perform pos_remito_entrar(r, v_c, v_cont, 'coincide', null, null, v_q, null);
  end if;
  return jsonb_build_object('coincide', v_ok, 'celdas', v_cel,
                            'conteos', (select count(*) from pos_remito_conteos where remito_id = p_remito and codigo = v_c),
                            'estado', (select estado from pos_remitos where id = p_remito));
end $$;

/* Recibir un producto CON DIFERENCIAS: entra lo que contaron. Tiene que ser
   lo último que contaron (con «Comparar con el remito»), como el efectivo en
   el cierre de caja. SQL 167: quién lo recibió y qué pasó (p_motivo, de la
   lista; p_observaciones, el texto); cada diferencia queda para la oficina. */
create or replace function pos_remito_recibir(p_remito uuid, p_codigo text, p_conteo jsonb, p_observaciones text default null,
                                              p_descripcion text default null, p_recibio text default null, p_motivo text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r       pos_remitos;
  k       pos_remito_conteos;
  v_c     text := upper(trim(coalesce(p_codigo, '')));
  v_obs   text := nullif(trim(coalesce(p_observaciones, '')), '');
  v_q     text := nullif(trim(coalesce(p_recibio, '')), '');
  v_mot   text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cont  jsonb;
begin
  perform pos_permiso();
  if v_c = '' or length(v_c) > 30 then raise exception 'Falta el producto.'; end if;
  if length(v_obs) > 300 or length(p_descripcion) > 120 then raise exception 'El texto es demasiado largo.'; end if;
  if length(v_q) > 60 then raise exception 'El nombre de quién lo recibió es demasiado largo.'; end if;
  if v_mot is not null and v_mot not in ('Vino otro talle', 'Vino otro color', 'Vino fallada', 'Otro') then
    raise exception 'Elegí qué pasó de la lista.';
  end if;
  v_cont := pos_remito_conteo_limpio(p_conteo);
  perform pg_advisory_xact_lock(hashtext('pos_remito:' || coalesce(p_remito::text, '')));
  select * into r from pos_remitos where id = p_remito for update;
  if not found then raise exception 'No existe ese remito.'; end if;
  if r.estado = 'anulado' then raise exception 'Ese remito está anulado.'; end if;
  if r.estado <> 'pendiente' then raise exception 'Ese remito ya está recibido.'; end if;
  if r.destino_local_id is null then raise exception 'Ese remito vuelve a la fábrica: se da por recibido en Gestión.'; end if;
  if exists (select 1 from pos_remito_productos where remito_id = p_remito and codigo = v_c) then
    raise exception 'Ese producto ya está recibido.';
  end if;
  select * into k from pos_remito_conteos where remito_id = p_remito and codigo = v_c order by id desc limit 1;
  if not found then raise exception 'Primero contá el producto y tocá «Comparar con el remito».'; end if;
  if k.conteo <> v_cont then raise exception 'No es lo último que contaste: tocá «Comparar con el remito» de nuevo.'; end if;
  perform pos_remito_entrar(r, v_c, v_cont, 'diferencias', v_obs, p_descripcion, coalesce(v_q, k.recibio), v_mot);
  return jsonb_build_object('estado', (select estado from pos_remitos where id = p_remito));
end $$;

/* Anular un remito (queda en la lista, tachado, con quién y por qué). Lo que
   ya entró al stock vuelve a salir, y si era un envío, al local que lo mandó
   le vuelve lo que mandó. SQL 167: si era el que resolvía unas diferencias
   (lo que faltó, o lo que se devolvía), ésas vuelven a quedar sin resolver;
   las diferencias del remito anulado dejan de contar. */
create or replace function pos_remito_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare r pos_remitos; m pos_stock_movs;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  perform pg_advisory_xact_lock(hashtext('pos_remito:' || coalesce(p_id::text, '')));
  select * into r from pos_remitos where id = p_id for update;
  if not found then raise exception 'No existe ese remito.'; end if;
  if r.estado = 'anulado' then raise exception 'Ese remito ya está anulado.'; end if;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo in ('remito', 'envio') order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, m.tipo || '_anulado', p_id, m.ref || ' (anulado)');
  end loop;
  update pos_remitos set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  update pos_remito_diferencias
     set estado = 'pendiente', resolucion = null, nota = null, resuelta_en = null, resuelta_por = null, resuelta_nombre = null, remito_nuevo_id = null
   where remito_nuevo_id = p_id;
  return true;
end $$;

revoke all on function pos_stock_mover(uuid, text, text, text, int, text, uuid, text, text, text, text),
                       pos_remito_conteo_limpio(jsonb),
                       pos_remito_entrar(pos_remitos, text, jsonb, text, text, text, text, text)
       from public, anon, authenticated;
revoke all on function pos_stock_local(uuid), pos_stock_consulta(uuid, text[], text, boolean, boolean),
                       pos_stock_variante(uuid, text, text, text), pos_stock_ajustar(jsonb), pos_inventario_cargar(jsonb),
                       pos_inventarios(uuid), pos_remito_guardar(jsonb), pos_remitos(date, date, uuid, text), pos_remito(uuid, boolean),
                       pos_remito_contar(uuid, text, jsonb, text), pos_remito_recibir(uuid, text, jsonb, text, text, text, text), pos_remito_anular(uuid, text)
       from public, anon;
grant execute on function pos_stock_local(uuid), pos_stock_consulta(uuid, text[], text, boolean, boolean),
                          pos_stock_variante(uuid, text, text, text), pos_stock_ajustar(jsonb), pos_inventario_cargar(jsonb),
                          pos_inventarios(uuid), pos_remito_guardar(jsonb), pos_remitos(date, date, uuid, text), pos_remito(uuid, boolean),
                          pos_remito_contar(uuid, text, jsonb, text), pos_remito_recibir(uuid, text, jsonb, text, text, text, text), pos_remito_anular(uuid, text)
       to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 167 (24/10/2026) · LAS DIFERENCIAS DE LOS REMITOS
--
--  Mauricio (24/10): "si no da, nosotros tenemos una planilla de error donde
--  anotamos… para que después sepa la fábrica qué pasó. También estaría bueno
--  que tenga estadísticas de errores… que puedan editar desde gestión de la
--  fábrica esa prenda que nos mandaron mal". Y del aviso: "el mismo sistema
--  tendría que avisar. Cuando abra el sistema, le tendría que aparecer un
--  mensaje".
--
--  · La planilla se arma sola: cuando un local recibe un producto "con lo
--    contado", cada talle y color que no dio queda acá (pos_remito_entrar),
--    con quién lo recibió y qué pasó. Nadie carga nada aparte.
--  · La oficina (por ahora; después, la fábrica con su usuario) la resuelve:
--      mandar     arma un remito nuevo con lo que faltó, al mismo local;
--      devolver   arma uno del local a la fábrica con lo que sobró (sale de su
--                 stock al guardarlo, como un envío);
--      remito_mal el remito estaba mal: el stock ya está bien (entró lo
--                 contado) y no se mueve nada;
--      otra       otra solución, escrita.
--    El remito original no se toca: la corrección queda aparte, con quién y
--    cuándo, para que la estadística no se borre.
--  · Si se anula el remito que la resolvía, la diferencia vuelve a quedar sin
--    resolver (pos_remito_anular). Las de un remito anulado no cuentan.
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_remito_diferencias (
  id               bigserial primary key,
  remito_id        uuid not null references pos_remitos(id) on delete cascade,
  local_id         uuid not null references orden_locales(id),   -- el que lo recibió
  codigo           text not null,
  talle            text not null default '',
  color            text not null default '',
  descripcion      text,
  cantidad         int not null,                                  -- lo que decía el remito
  contado          int not null,                                  -- lo que llegó
  creado_en        timestamptz not null default clock_timestamp(),
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'resuelta')),
  resolucion       text check (resolucion in ('mandar', 'remito_mal', 'devolver', 'otra')),
  nota             text,
  resuelta_en      timestamptz,
  resuelta_por     uuid,
  resuelta_nombre  text,
  remito_nuevo_id  uuid references pos_remitos(id),               -- el que manda lo que faltó o devuelve lo que sobró
  unique (remito_id, codigo, talle, color),
  check (cantidad <> contado),
  check ((estado = 'pendiente') = (resolucion is null))
);
create index pos_remito_diferencias_estado on pos_remito_diferencias (estado, local_id);
create index pos_remito_diferencias_nuevo on pos_remito_diferencias (remito_nuevo_id) where remito_nuevo_id is not null;

alter table pos_remito_diferencias enable row level security;
revoke all on pos_remito_diferencias from anon, authenticated;
revoke all on sequence pos_remito_diferencias_id_seq from anon, authenticated;

/* La planilla de las diferencias y sus estadísticas. "pendiente" trae las que
   faltan resolver, de cualquier día; si no, las del período (por el día en que
   se recibió). Las estadísticas son siempre del período: los remitos que se
   recibieron, cuántos con diferencias, lo que faltó y sobró, por local, por
   producto y por qué pasó; y aparte, lo que el local tuvo que contar de nuevo
   (ésos no son errores de la fábrica: coincidieron al final). */
create or replace function pos_diferencias(p_desde date, p_hasta date, p_local uuid default null, p_estado text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_estado is not null and p_estado not in ('pendiente', 'resuelta') then raise exception 'Ese estado no existe.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with d as (
      select x.*, (x.creado_en at time zone 'America/Argentina/Buenos_Aires')::date dia,
             (x.resuelta_en at time zone 'America/Argentina/Buenos_Aires')::date dia_res
        from pos_remito_diferencias x join pos_remitos r on r.id = x.remito_id
       where r.estado <> 'anulado' and (p_local is null or x.local_id = p_local)
    ),
    f as (
      select * from d
       where case when p_estado = 'pendiente' then d.estado = 'pendiente'
                  else d.dia between p_desde and p_hasta and (p_estado is null or d.estado = p_estado) end
    ),
    dp as (select * from d where d.dia between p_desde and p_hasta),
    rr as (
      select r.* from pos_remitos r
       where r.estado in ('recibido', 'con_diferencias') and r.destino_local_id is not null
         and (r.recibido_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
         and (p_local is null or r.destino_local_id = p_local)
    ),
    -- Los productos que coincidieron recién después de contarlos más de una vez.
    rc as (
      select rr.destino_local_id local_id, k.remito_id, k.codigo
        from pos_remito_productos k join rr on rr.id = k.remito_id
       where k.estado = 'coincide'
         and (select count(*) from pos_remito_conteos c where c.remito_id = k.remito_id and c.codigo = k.codigo) > 1
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'remito_id', z.remito_id, 'numero', r.numero, 'referencia', r.referencia, 'cargo', r.creado_nombre,
                 'local_id', z.local_id, 'local', l.nombre, 'codigo', z.codigo, 'descripcion', z.descripcion, 'talle', z.talle, 'color', z.color,
                 'cantidad', z.cantidad, 'contado', z.contado, 'fecha', z.creado_en,
                 'recibio', coalesce(k.recibio, k.recibido_nombre), 'motivo', k.motivo, 'observaciones', k.observaciones,
                 'estado', z.estado, 'resolucion', z.resolucion, 'nota', z.nota, 'resuelta_en', z.resuelta_en, 'resuelta_nombre', z.resuelta_nombre,
                 'remito_nuevo_id', z.remito_nuevo_id, 'remito_nuevo_numero', rn.numero, 'remito_nuevo_estado', rn.estado)
               order by z.creado_en desc, z.codigo, z.color, z.talle)
          from (select * from f order by creado_en desc, id limit 1000) z
          join pos_remitos r on r.id = z.remito_id
          join orden_locales l on l.id = z.local_id
          left join pos_remito_productos k on k.remito_id = z.remito_id and k.codigo = z.codigo
          left join pos_remitos rn on rn.id = z.remito_nuevo_id), '[]'::jsonb),
      'mas', (select count(*) > 1000 from f),
      'totales', jsonb_build_object(
        'pendientes', (select count(*) from d where d.estado = 'pendiente'),
        'remitos', (select count(*) from rr),
        'con_diferencias', (select count(*) from rr where rr.estado = 'con_diferencias'),
        'unidades', (select coalesce(sum(i.cantidad), 0) from pos_remito_items i join rr on rr.id = i.remito_id),
        'faltaron', (select coalesce(sum(cantidad - contado), 0) from dp where contado < cantidad),
        'sobraron', (select coalesce(sum(contado - cantidad), 0) from dp where contado > cantidad),
        'resueltas', (select count(*) from d where d.estado = 'resuelta' and d.dia_res between p_desde and p_hasta),
        'horas_resolver', (select round((avg(extract(epoch from (d.resuelta_en - d.creado_en))) / 3600)::numeric, 1)
                             from d where d.estado = 'resuelta' and d.dia_res between p_desde and p_hasta),
        'recontados', (select count(*) from rc)),
      'por_local', coalesce((
        select jsonb_agg(jsonb_build_object('local_id', l.id, 'local', l.nombre, 'remitos', a.remitos, 'con_diferencias', a.cd,
                                            'faltaron', a.falt, 'sobraron', a.sobr, 'recontados', a.rec)
                         order by a.cd desc, a.falt + a.sobr desc, l.nombre)
          from orden_locales l
          cross join lateral (
            select (select count(*) from rr where rr.destino_local_id = l.id) remitos,
                   (select count(*) from rr where rr.destino_local_id = l.id and rr.estado = 'con_diferencias') cd,
                   (select coalesce(sum(cantidad - contado), 0) from dp where dp.local_id = l.id and contado < cantidad) falt,
                   (select coalesce(sum(contado - cantidad), 0) from dp where dp.local_id = l.id and contado > cantidad) sobr,
                   (select count(*) from rc where rc.local_id = l.id) rec) a
         where a.remitos > 0 or a.falt + a.sobr > 0 or a.rec > 0), '[]'::jsonb),
      'por_producto', coalesce((
        select jsonb_agg(jsonb_build_object('codigo', g.codigo, 'descripcion', g.descripcion, 'veces', g.veces, 'faltaron', g.falt, 'sobraron', g.sobr)
                         order by g.falt + g.sobr desc, g.veces desc, g.codigo)
          from (select * from (select dp.codigo, max(dp.descripcion) descripcion, count(distinct dp.remito_id) veces,
                                      coalesce(sum(cantidad - contado) filter (where contado < cantidad), 0) falt,
                                      coalesce(sum(contado - cantidad) filter (where contado > cantidad), 0) sobr
                                 from dp group by dp.codigo) g0
                 order by g0.falt + g0.sobr desc, g0.veces desc, g0.codigo limit 10) g), '[]'::jsonb),
      'por_motivo', coalesce((
        select jsonb_agg(jsonb_build_object('motivo', m.motivo, 'productos', m.n) order by m.n desc, m.motivo)
          from (select coalesce(k.motivo, 'Sin decir') motivo, count(*) n
                  from (select distinct remito_id, codigo from dp) q
                  join pos_remito_productos k on k.remito_id = q.remito_id and k.codigo = q.codigo
                 group by 1) m), '[]'::jsonb)
    )
  );
end $$;

/* Resolver diferencias (una o varias, de la planilla). Con «mandar» o
   «devolver» arma el remito (todas del mismo local); la clave es la de ese
   remito, así dos clics no arman dos. Si ya estaban todas resueltas, no hace
   nada (un reintento). */
create or replace function pos_diferencia_resolver(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_res     text := coalesce(p->>'resolucion', '');
  v_nota    text := nullif(trim(coalesce(p->>'nota', '')), '');
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_ids     bigint[];
  v_n       int;
  v_loc     uuid;
  v_nloc    int;
  v_refs    text;
  v_items   jsonb;
  v_rem     jsonb;
begin
  perform pos_permiso();
  if v_res not in ('mandar', 'remito_mal', 'devolver', 'otra') then raise exception 'Elegí cómo se resuelve.'; end if;
  if v_res = 'otra' and v_nota is null then raise exception 'Escribí cómo se resolvió.'; end if;
  if length(v_nota) > 300 then raise exception 'La nota es demasiado larga.'; end if;
  if jsonb_typeof(p->'ids') is distinct from 'array' or jsonb_array_length(p->'ids') = 0 then raise exception 'Elegí qué diferencias se resuelven.'; end if;
  if jsonb_array_length(p->'ids') > 500 then raise exception 'Son demasiadas diferencias juntas.'; end if;
  if exists (select 1 from jsonb_array_elements_text(p->'ids') e where e !~ '^[0-9]{1,18}$') then raise exception 'Hay una diferencia que no existe.'; end if;
  select array_agg(distinct e::bigint) into v_ids from jsonb_array_elements_text(p->'ids') e;

  /* Una resolución por vez: si dos resuelven la misma al mismo tiempo, el segundo espera y ve que ya está. */
  perform pg_advisory_xact_lock(hashtext('pos_diferencias'));
  select count(*) into v_n from pos_remito_diferencias d join pos_remitos r on r.id = d.remito_id
   where d.id = any(v_ids) and r.estado <> 'anulado';
  if v_n <> cardinality(v_ids) then raise exception 'Alguna diferencia ya no está (o se anuló su remito): actualizá la lista.'; end if;
  if not exists (select 1 from pos_remito_diferencias where id = any(v_ids) and estado = 'pendiente') then
    return jsonb_build_object('ya', true, 'resueltas', 0);
  end if;
  if exists (select 1 from pos_remito_diferencias where id = any(v_ids) and estado <> 'pendiente') then
    raise exception 'Alguna ya estaba resuelta: actualizá la lista.';
  end if;
  perform 1 from pos_remito_diferencias where id = any(v_ids) for update;

  select count(distinct d.local_id), (array_agg(d.local_id))[1], string_agg(distinct 'R-' || r.numero, ', ')
    into v_nloc, v_loc, v_refs
    from pos_remito_diferencias d join pos_remitos r on r.id = d.remito_id where d.id = any(v_ids);
  if v_res in ('mandar', 'devolver') then
    if v_nloc > 1 then raise exception 'Para armar un remito, elegí diferencias de un solo local.'; end if;
    if v_res = 'mandar' and exists (select 1 from pos_remito_diferencias where id = any(v_ids) and contado > cantidad) then
      raise exception '«Mandar lo que faltó» es sólo para lo que faltó.';
    end if;
    if v_res = 'devolver' and exists (select 1 from pos_remito_diferencias where id = any(v_ids) and contado < cantidad) then
      raise exception '«Que lo devuelvan» es sólo para lo que sobró.';
    end if;
    select jsonb_agg(jsonb_build_object('codigo', codigo, 'talle', talle, 'color', color, 'descripcion', descripcion,
                                        'cantidad', abs(contado - cantidad)) order by codigo, color, talle)
      into v_items from pos_remito_diferencias where id = any(v_ids);
    v_rem := pos_remito_guardar(jsonb_build_object(
      'clave', v_clave,
      'origen_local_id', case when v_res = 'devolver' then v_loc end,
      'destino_local_id', case when v_res = 'mandar' then v_loc end,
      'a_fabrica', v_res = 'devolver',
      'referencia', left('Por ' || v_refs, 40),
      'observaciones', left((case when v_res = 'mandar' then 'Lo que faltó en ' else 'Lo que sobró en ' end) || v_refs || coalesce('. ' || v_nota, ''), 300),
      'items', v_items));
  end if;

  update pos_remito_diferencias
     set estado = 'resuelta', resolucion = v_res, nota = v_nota, resuelta_en = clock_timestamp(), resuelta_por = orden_yo_id(),
         resuelta_nombre = (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()),
         remito_nuevo_id = nullif(v_rem->>'id', '')::uuid
   where id = any(v_ids);
  return jsonb_build_object('ya', false, 'resueltas', cardinality(v_ids), 'remito', v_rem);
end $$;

/* Volver a dejar sin resolver (un clic equivocado). Las que se resolvieron con
   un remito no: para eso se anula ese remito, que las deja sin resolver solo. */
create or replace function pos_diferencia_reabrir(p jsonb) returns int
language plpgsql volatile security definer set search_path = public as $$
declare v_ids bigint[]; v_ref int; v_n int;
begin
  perform pos_permiso();
  if jsonb_typeof(p->'ids') is distinct from 'array' or jsonb_array_length(p->'ids') = 0 then raise exception 'Elegí qué diferencias.'; end if;
  if exists (select 1 from jsonb_array_elements_text(p->'ids') e where e !~ '^[0-9]{1,18}$') then raise exception 'Hay una diferencia que no existe.'; end if;
  select array_agg(distinct e::bigint) into v_ids from jsonb_array_elements_text(p->'ids') e;
  perform pg_advisory_xact_lock(hashtext('pos_diferencias'));
  select r.numero into v_ref from pos_remito_diferencias d join pos_remitos r on r.id = d.remito_nuevo_id
   where d.id = any(v_ids) and d.remito_nuevo_id is not null and r.estado <> 'anulado' limit 1;
  if v_ref is not null then raise exception 'Se resolvió con el remito R-%: para volver atrás, anulá ese remito.', v_ref; end if;
  update pos_remito_diferencias
     set estado = 'pendiente', resolucion = null, nota = null, resuelta_en = null, resuelta_por = null, resuelta_nombre = null, remito_nuevo_id = null
   where id = any(v_ids) and estado = 'resuelta';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/* Lo que vuelve a la fábrica ("que lo devuelvan"): como la fábrica todavía no
   está en el sistema, la oficina lo da por recibido cuando llega. El stock ya
   salió del local al mandarlo. */
create or replace function pos_remito_fabrica_recibir(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare r pos_remitos;
begin
  perform pos_permiso();
  perform pg_advisory_xact_lock(hashtext('pos_remito:' || coalesce(p_id::text, '')));
  select * into r from pos_remitos where id = p_id for update;
  if not found then raise exception 'No existe ese remito.'; end if;
  if r.destino_local_id is not null then raise exception 'Ese remito va a un local: lo recibe el local en el POS.'; end if;
  if r.estado = 'anulado' then raise exception 'Ese remito está anulado.'; end if;
  if r.estado <> 'pendiente' then return true; end if;
  update pos_remito_items set contado = cantidad where remito_id = p_id;
  insert into pos_remito_productos (remito_id, codigo, estado, recibido_por, recibido_nombre)
  select distinct p_id, i.codigo, 'coincide', orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id())
    from pos_remito_items i where i.remito_id = p_id
  on conflict (remito_id, codigo) do nothing;
  update pos_remitos set estado = 'recibido', recibido_en = clock_timestamp() where id = p_id;
  return true;
end $$;

/* El aviso al abrir el sistema ("cuando abra el sistema, le tendría que
   aparecer un mensaje"): cuántas faltan resolver y los últimos productos con
   diferencias. A quien no puede verlas le contesta vacío, sin error (lo pide
   cada pantalla del sistema). */
create or replace function pos_diferencias_aviso() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not orden_es_admin() then return jsonb_build_object('pendientes', 0, 'ultimo', 0, 'productos', '[]'::jsonb); end if;
  return (
    with d as (
      select x.* from pos_remito_diferencias x join pos_remitos r on r.id = x.remito_id
       where x.estado = 'pendiente' and r.estado <> 'anulado'
    )
    select jsonb_build_object(
      'pendientes', (select count(*) from d),
      'ultimo', coalesce((select max(id) from d), 0),
      'productos', coalesce((
        select jsonb_agg(jsonb_build_object('ultimo', z.ultimo, 'fecha', z.fecha, 'local', l.nombre, 'numero', r.numero, 'referencia', r.referencia,
                                            'codigo', z.codigo, 'descripcion', z.descripcion, 'faltan', z.faltan, 'sobran', z.sobran,
                                            'recibio', coalesce(k.recibio, k.recibido_nombre), 'celdas', z.celdas)
                         order by z.ultimo desc)
          from (select d.remito_id, d.codigo, d.local_id, max(d.id) ultimo, max(d.creado_en) fecha, max(d.descripcion) descripcion,
                       sum(greatest(d.cantidad - d.contado, 0)) faltan, sum(greatest(d.contado - d.cantidad, 0)) sobran,
                       jsonb_agg(jsonb_build_object('talle', d.talle, 'color', d.color, 'cantidad', d.cantidad, 'contado', d.contado) order by d.color, d.talle) celdas
                  from d group by d.remito_id, d.codigo, d.local_id order by max(d.id) desc limit 5) z
          join pos_remitos r on r.id = z.remito_id
          join orden_locales l on l.id = z.local_id
          left join pos_remito_productos k on k.remito_id = z.remito_id and k.codigo = z.codigo), '[]'::jsonb)
    )
  );
end $$;

revoke all on function pos_diferencias(date, date, uuid, text), pos_diferencia_resolver(jsonb), pos_diferencia_reabrir(jsonb),
                       pos_remito_fabrica_recibir(uuid), pos_diferencias_aviso()
       from public, anon;
grant execute on function pos_diferencias(date, date, uuid, text), pos_diferencia_resolver(jsonb), pos_diferencia_reabrir(jsonb),
                          pos_remito_fabrica_recibir(uuid), pos_diferencias_aviso()
       to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 171 (24/10/2026) · LA VENTA FALLIDA, LA CONVERSIÓN Y EL SOCIO EN LA VENTA
--
--  Mauricio (24/10), con las fotos de BlueSoft:
--  · "La venta fallida tiene que ser una cosa aparte del No Compra": un
--    cliente pide una campera en L, no hay, y no quiere dejar el teléfono.
--    Si deja su WhatsApp es un No Compra (el formulario de siempre); si no,
--    es una venta fallida. Como la ventana roja de BlueSoft: vendedor,
--    motivo (los ocho de BlueSoft), el detalle y el monto perdido estimado;
--    y además, si se sabe, el producto, el talle y el color.
--  · En Tickets, el panel de la derecha de BlueSoft: ventas fallidas, monto
--    perdido, tráfico y conversión (está en pos_tickets, con la nota SQL 171).
--    Tráfico = ventas + ventas fallidas + No Compras.
--  · El socio del Club en la venta: buscarlo (teléfono, nombre, mail o el
--    número de la tarjeta) o hacerlo socio ahí mismo. Los puntos se anotan en
--    la venta siempre y se suman sólo con la regla pos_suma_puntos = 'si'
--    ("los dejamos apagados hasta el lanzamiento"): hoy los puntos se cargan
--    en Cobrar con el ticket de BlueSoft y no se tienen que sumar dos veces.
--    Se prende el día que el POS reemplace a BlueSoft:
--      update club_reglas set valor = 'si' where clave = 'pos_suma_puntos';
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_fallidas (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references orden_locales(id),
  fecha        timestamptz not null default now(),
  dia          date not null,
  prueba       boolean not null default false,          -- modo prueba: no cuenta, se borra con las pruebas
  vendedor     text not null,
  motivo       text not null check (motivo in ('producto', 'talle', 'color', 'tipo', 'precio', 'gusto', 'mirar', 'otro')),
  detalle      text,
  monto        numeric(12,2) check (monto is null or monto >= 0),   -- el monto perdido estimado
  codigo       text,                                    -- el producto, si se sabe
  descripcion  text,
  talle        text,
  color        text,
  cargado_por  uuid,
  clave        text unique
);
create index pos_fallidas_dia on pos_fallidas (dia, local_id);

alter table pos_fallidas enable row level security;
revoke all on pos_fallidas from anon, authenticated;

/* El interruptor de los puntos del POS, en las reglas del Club (como el tope y el ticket obligatorio:
   se cambian en la base, a propósito). Apagado. */
insert into club_reglas (clave, valor)
select 'pos_suma_puntos', 'no'
 where not exists (select 1 from club_reglas where clave = 'pos_suma_puntos');

/* Guardar una venta fallida. Con la misma clave dos veces devuelve la que ya estaba (el botón tocado dos
   veces, o la red que se cortó a la vuelta). */
create or replace function pos_fallida_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_vend    text := nullif(trim(coalesce(p->>'vendedor', '')), '');
  v_motivo  text := coalesce(p->>'motivo', '');
  v_detalle text := nullif(trim(coalesce(p->>'detalle', '')), '');
  v_monto   numeric := round(nullif(p->>'monto', '')::numeric, 2);
  v_codigo  text := nullif(upper(trim(coalesce(p->>'codigo', ''))), '');
  v_id      uuid;
  v_ya      pos_fallidas;
begin
  perform pos_permiso();
  if v_clave is not null then
    select * into v_ya from pos_fallidas where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_vend is null then raise exception 'Elegí quién atendió.'; end if;
  if v_motivo not in ('producto', 'talle', 'color', 'tipo', 'precio', 'gusto', 'mirar', 'otro') then raise exception 'Elegí el motivo.'; end if;
  if v_motivo = 'otro' and length(coalesce(v_detalle, '')) < 3 then raise exception 'Con «Otro motivo», escribí qué pasó.'; end if;
  if length(coalesce(v_detalle, '')) > 500 then raise exception 'El detalle es muy largo (hasta 500 letras).'; end if;
  if v_monto is not null and (v_monto < 0 or v_monto >= 100000000) then raise exception 'El monto perdido no es válido.'; end if;
  insert into pos_fallidas (local_id, dia, prueba, vendedor, motivo, detalle, monto, codigo, descripcion, talle, color, cargado_por, clave)
  values (v_local, pos_hoy(), coalesce(nullif(p->>'prueba', '')::boolean, false), v_vend, v_motivo, v_detalle, v_monto, v_codigo,
          nullif(trim(coalesce(p->>'descripcion', '')), ''), nullif(upper(trim(coalesce(p->>'talle', ''))), ''),
          nullif(upper(trim(coalesce(p->>'color', ''))), ''), orden_yo_id(), v_clave)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ya', false);
end $$;

/* Las ventas fallidas de un período, con sus totales y cuántas por motivo. Las de verdad y las de prueba
   no se mezclan (p_prueba elige). */
create or replace function pos_fallidas(p_desde date, p_hasta date, p_local uuid default null, p_vendedor text default null,
                                        p_motivo text default null, p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with f as (
      select y.* from pos_fallidas y
       where y.dia between p_desde and p_hasta
         and y.prueba = coalesce(p_prueba, false)
         and (p_local is null or y.local_id = p_local)
         and (p_vendedor is null or lower(y.vendedor) = lower(p_vendedor))
         and (p_motivo is null or y.motivo = p_motivo)
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', f.id, 'fecha', f.fecha, 'local', l.nombre, 'local_id', f.local_id, 'vendedor', f.vendedor, 'motivo', f.motivo,
                 'detalle', f.detalle, 'monto', f.monto, 'codigo', f.codigo, 'descripcion', f.descripcion, 'talle', f.talle, 'color', f.color,
                 'prueba', f.prueba, 'cargado_por', (select p.nombre from orden_personas p where p.id = f.cargado_por)) order by f.fecha desc)
          from (select * from f order by fecha desc limit 500) f join orden_locales l on l.id = f.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object('cantidad', count(*), 'perdido', coalesce(sum(monto), 0)) from f),
      'por_motivo', (select coalesce(jsonb_object_agg(z.motivo, z.n), '{}'::jsonb) from (select motivo, count(*) n from f group by motivo) z),
      'mas', (select count(*) > 500 from f)
    )
  );
end $$;

/* Borrar una venta fallida cargada por error (no es plata: no se anula, se borra). */
create or replace function pos_fallida_borrar(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  perform pos_permiso();
  delete from pos_fallidas where id = p_id;
  if not found then raise exception 'Esa venta fallida ya no está.'; end if;
  return true;
end $$;

/* Buscar al socio desde la venta: la misma búsqueda que Cobrar (club_buscar), con el usuario del POS en
   vez del PIN. Trae también el multiplicador de hoy (el nivel y las promos del día), así la venta muestra
   cuántos puntos va a sumar; al guardar la base vuelve a hacer la cuenta. */
create or replace function pos_club_buscar(p_texto text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  dig text := regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g');
  txt text := lower(trim(coalesce(p_texto, '')));
  /* El nombre, sin acentos de los dos lados: "perez" encuentra a "Pérez" (la base no tiene unaccent). */
  bus text := translate(lower(trim(coalesce(p_texto, ''))), 'áéíóúüñ', 'aeiouun');
begin
  perform pos_permiso();
  if length(txt) < 3 then
    return jsonb_build_object('corto', true, 'porque', 'Escribí el teléfono entero o al menos 3 letras del nombre.');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', codigo, 'nombre', nombre, 'telefono', telefono, 'mail', mail, 'puntos', puntos, 'nivel', nivel,
             'compras', compras, 'confirmado', confirmado, 'factor', (club_factor(id)->>'total')::numeric)
           order by confirmado desc, creado desc)
      from (
        select * from v_club_clientes
         where baja is null
           and ( (length(dig) >= 8 and club_tel(telefono) = club_tel(dig))
              or (length(dig) = 12 and codigo = dig)
              or (length(bus) >= 3 and translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like '%' || bus || '%')
              or (position('@' in txt) > 1 and lower(coalesce(mail, '')) = txt) )
         order by creado desc
         limit 10
      ) t
  ), '[]'::jsonb);
end $$;

/* Hacerlo socio desde la venta: el alta de siempre (club_alta: la tarjeta, la bienvenida y Kommo), con el
   local de la venta. Si el número ya tenía tarjeta, devuelve ese socio para elegirlo. */
create or replace function pos_club_alta(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_nom  text := nullif(trim(coalesce(p->>'nombre', '')), '');
  v_ape  text := nullif(trim(coalesce(p->>'apellido', '')), '');
  v_tel  text := regexp_replace(coalesce(p->>'telefono', ''), '[^0-9]', '', 'g');
  v_loc  text := (select codigo from orden_locales where id = nullif(p->>'local_id', '')::uuid);
  v_acep boolean := coalesce(nullif(p->>'acepta', '')::boolean, false);
  r      jsonb;
  s      jsonb;
begin
  perform pos_permiso();
  if v_nom is null then raise exception 'Falta el nombre.'; end if;
  if v_ape is null then raise exception 'Falta el apellido.'; end if;
  if length(v_tel) < 8 then raise exception 'Falta el WhatsApp (con la característica).'; end if;
  r := club_alta(v_nom, p->>'telefono', v_loc, null, v_acep, nullif(trim(coalesce(p->>'mail', '')), ''), v_ape);
  if coalesce((r->>'alta')::boolean, false) and v_acep then
    update club_clientes set consentimiento_via = 'POS' || coalesce(' · ' || v_loc, '') where codigo = r->>'codigo';
  end if;
  select jsonb_build_object('codigo', c.codigo, 'nombre', c.nombre, 'telefono', c.telefono, 'mail', c.mail, 'puntos', c.puntos,
                            'nivel', c.nivel, 'compras', c.compras, 'confirmado', c.confirmado, 'factor', (club_factor(c.id)->>'total')::numeric)
    into s
    from v_club_clientes c
   where c.baja is null
     and (c.codigo = r->>'codigo' or (coalesce((r->>'ya_estaba')::boolean, false) and club_tel(c.telefono) = club_tel(v_tel)))
   order by c.creado desc
   limit 1;
  if s is null then raise exception 'Ese WhatsApp era de un socio que se dio de baja: hay que darlo de alta de nuevo desde Socios.'; end if;
  return jsonb_build_object('nuevo', coalesce((r->>'alta')::boolean, false), 'socio', s);
end $$;

revoke all on function pos_fallida_guardar(jsonb), pos_fallidas(date, date, uuid, text, text, boolean), pos_fallida_borrar(uuid),
                       pos_club_buscar(text), pos_club_alta(jsonb)
       from public, anon;
grant execute on function pos_fallida_guardar(jsonb), pos_fallidas(date, date, uuid, text, text, boolean), pos_fallida_borrar(uuid),
                          pos_club_buscar(text), pos_club_alta(jsonb)
       to authenticated;
