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
--  y el pase a la caja fuerte. Está al final del archivo.
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
   internet después de guardar) devuelve la que ya estaba, no la duplica. */
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
  i         int;
  n         int;
  pr        numeric;
  m         numeric;
begin
  perform pos_permiso();

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true);
    end if;
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
                          observaciones, clave)
  values (v_local, v_num, v_serie, v_prueba, pos_hoy(), v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total)
    values (v_id, i, nullif(upper(trim(coalesce(x->>'codigo', ''))), ''), trim(x->>'descripcion'),
            nullif(trim(coalesce(x->>'talle', '')), ''), nullif(trim(coalesce(x->>'color', '')), ''),
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int);
  end loop;

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

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', now(), 'ya', false);
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
                 'factura', v.factura) order by v.fecha desc)
          from (select * from v order by fecha desc limit 500) v join orden_locales l on l.id = v.local_id), '[]'::jsonb),
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
              'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb))
    into r
    from pos_ventas v join orden_locales l on l.id = v.local_id
   where v.id = p_id;
  if r is null then raise exception 'No existe esa venta.'; end if;
  return r;
end $$;

/* Anular una venta (queda en la lista, tachada, con quién y por qué). */
create or replace function pos_venta_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare v pos_ventas;
begin
  perform pos_permiso();
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.factura is not null then raise exception 'Esa venta tiene factura de ARCA: se anula con una nota de crédito.'; end if;
  update pos_ventas set estado = 'anulada', anulada_en = now(), anulada_por = orden_yo_id(), anulada_motivo = trim(p_motivo)
   where id = p_id;
  return true;
end $$;

/* Borrar las ventas de prueba (todas, o las de un local). Las de verdad no
   se tocan nunca: ésas se anulan. Las pruebas vuelven a empezar en la P-1.
   SQL 149: también la caja de prueba (sus cierres, sus gastos y sus conteos). */
create or replace function pos_pruebas_borrar(p_local uuid default null) returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform pos_permiso();
  delete from pos_ventas where prueba and (p_local is null or local_id = p_local);
  get diagnostics n = row_count;
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
   efectivo, que la pantalla ve recién después de contar. */
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
  ), g as (
    select pg.medio, sum(pg.monto) monto from pos_venta_pagos pg join v on v.id = pg.venta_id group by pg.medio
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
    'ventas_total', coalesce((select sum(v.total) from v), 0),
    'descuentos', coalesce((select sum(v.descuentos) from v), 0),
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
   ve recién después de contar (pos_caja_contar). */
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
  return ((a #- '{ventas,efectivo}') - 'ventas_total') || jsonb_build_object(
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
   internet después de cerrar) devuelve el mismo cierre, no lo duplica. */
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

  with v as (select * from pos_ventas where cierre_id = v_id and estado = 'cobrada'),
       g as (select pg.medio, sum(pg.monto) monto from pos_venta_pagos pg join v on v.id = pg.venta_id group by pg.medio),
       m as (select * from pos_caja_movimientos where cierre_id = v_id and estado = 'ok')
  update pos_cierres set
    tickets              = (select count(*) from v),
    ventas_efectivo      = coalesce((select g.monto from g where g.medio = 'efectivo'), 0),
    ventas_tarjeta       = coalesce((select g.monto from g where g.medio = 'tarjeta'), 0),
    ventas_mercadopago   = coalesce((select g.monto from g where g.medio = 'mercadopago'), 0),
    ventas_modo          = coalesce((select g.monto from g where g.medio = 'modo'), 0),
    ventas_go_cuotas     = coalesce((select g.monto from g where g.medio = 'go_cuotas'), 0),
    ventas_transferencia = coalesce((select g.monto from g where g.medio = 'transferencia'), 0),
    ventas_total         = coalesce((select sum(v.total) from v), 0),
    descuentos           = coalesce((select sum(v.descuentos) from v), 0),
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
   tachado, y lo que tenía (ventas y gastos) vuelve a la caja abierta, para
   cerrarla de nuevo. */
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
