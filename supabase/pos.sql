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
-- El número de ticket es correlativo POR SUCURSAL (como la "Referencia" de
-- BlueSoft). Cuando se conecte ARCA, la factura va en `factura`.
create table pos_numeros (
  local_id  uuid primary key references orden_locales(id),
  ultimo    bigint not null default 0
);

create table pos_ventas (
  id                 uuid primary key default gen_random_uuid(),
  local_id           uuid not null references orden_locales(id),
  numero             bigint not null,
  fecha              timestamptz not null default now(),
  dia                date not null,
  letra              text not null check (letra in ('A', 'B')),
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
  unique (local_id, numero)
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
   cuentas cierren al centavo y se le da el número de la sucursal. Con la
   misma `clave` dos veces (se cortó internet después de guardar) devuelve
   la que ya estaba, no la duplica. */
create or replace function pos_venta_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_letra   text := coalesce(nullif(p->>'letra', ''), 'B');
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
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'fecha', v_ya.fecha, 'ya', true);
    end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
  if v_letra not in ('A', 'B') then raise exception 'El comprobante tiene que ser A o B.'; end if;
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

  insert into pos_numeros (local_id, ultimo) values (v_local, 1)
  on conflict (local_id) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave)
  values (v_local, v_num, pos_hoy(), v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
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

  return jsonb_build_object('id', v_id, 'numero', v_num, 'fecha', now(), 'ya', false);
end $$;

/* El listado de tickets (como "Tickets de venta" de BlueSoft), con los totales. */
create or replace function pos_tickets(p_desde date, p_hasta date, p_local uuid default null, p_vendedor text default null,
                                       p_medio text default null, p_estado text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with v as (
      select x.* from pos_ventas x
       where x.dia between p_desde and p_hasta
         and (p_local is null or x.local_id = p_local)
         and (p_vendedor is null or lower(x.vendedor) = lower(p_vendedor))
         and (p_estado is null or x.estado = p_estado)
         and (p_medio is null or exists (select 1 from pos_venta_pagos g where g.venta_id = x.id and g.medio = p_medio))
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', v.id, 'numero', v.numero, 'fecha', v.fecha, 'local', l.nombre, 'local_id', v.local_id,
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

revoke all on function pos_permiso(), pos_inicio(), pos_precios(int), pos_precio_guardar(int, text, numeric),
                       pos_lista_guardar(int, numeric, int), pos_sucursal_guardar(uuid, int, int, boolean),
                       pos_promo_guardar(jsonb), pos_venta_guardar(jsonb),
                       pos_tickets(date, date, uuid, text, text, text), pos_venta(uuid), pos_venta_anular(uuid, text)
       from public, anon;
grant execute on function pos_inicio(), pos_precios(int), pos_precio_guardar(int, text, numeric),
                          pos_lista_guardar(int, numeric, int), pos_sucursal_guardar(uuid, int, int, boolean),
                          pos_promo_guardar(jsonb), pos_venta_guardar(jsonb),
                          pos_tickets(date, date, uuid, text, text, text), pos_venta(uuid), pos_venta_anular(uuid, text)
       to authenticated;
revoke all on function pos_permiso() from authenticated;
