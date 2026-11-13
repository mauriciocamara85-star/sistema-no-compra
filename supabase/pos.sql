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
--  SQL 179 (26/10/2026, Mauricio: "el gasto tendría que tener un número"):
--  cada gasto de la caja (y cada otra salida u otro ingreso) lleva un número
--  seguido por local, G-1, G-2… (las pruebas GP-1…), como el comprobante de
--  "Gastos del Local" de BlueSoft. La nota "SQL 179" está en la tabla y en
--  las cuatro funciones que lo mandan.
--
--  SQL 180 (26/10/2026, Mauricio: "en BlueSoft tenemos una sección de
--  movimientos, se llama «movimientos de salida», y ahí agregamos los
--  movimientos de caja chica a caja fuerte"): el pase a la caja fuerte sale
--  del cierre (era su Paso 2) y es un movimiento más de la caja chica, tipo
--  'caja_fuerte', con su propio número: MS-1, MS-2… (las pruebas MSP-1…).
--  Entra en el próximo cierre como los gastos y se resta de lo que tendría
--  que haber (pos_cierres.a_caja_fuerte). El cierre ya no pide cuánto pasa
--  (retiro queda en 0; se sigue aceptando, para la pantalla de antes), y no
--  se cierra si la caja cambió después de contar.
--
--  SQL 189 (28/10/2026, Mauricio: "si tenemos que devolver algo a fábrica,
--  tenemos que hacer una devolución… la pestaña se tiene que llamar
--  devolución a fábrica"): el local arma su devolución en el mostrador, como
--  la "Devolución de Mercadería" de BlueSoft. Es un remito sin destino (eso
--  ya estaba desde el SQL 167: sale del stock al guardarlo y la oficina lo da
--  por recibido). Lo nuevo: cada renglón guarda su precio (el de la lista del
--  local que lo manda, al guardarlo: el total no cambia si después cambian los
--  precios) y su razón ("fallada"), y quien la mandó la ve entera (no es a
--  ciegas: nadie la cuenta al recibirla). La nota "SQL 189" está en la tabla
--  de los renglones y en pos_remito_guardar, pos_remitos y pos_remito.
--
--  SQL 191 (29/10/2026, Mauricio: "retiro de fondos… lo que va a hacer es
--  sacar de la caja fuerte o chica del local plata para darle a la fábrica"):
--  los "Retiros de Fondos" de BlueSoft. Es un movimiento más, tipo 'retiro',
--  con su propio número por local: RF-1, RF-2… (las pruebas RFP-1…). Dice de
--  qué caja sale (la chica o la fuerte) y quién se lleva la plata. El de la
--  caja chica entra en el próximo cierre como un gasto y se resta de lo que
--  tendría que haber (pos_cierres.retiros_fondos); el de la caja fuerte no
--  toca el cierre. Y el tilde «Controlado» de la oficina, en los retiros y en
--  los movimientos de salida ("veo los montos que los chicos agregaron a la
--  caja fuerte y tienen que coincidir con lo que hay en el sistema"):
--  pos_caja_mov_controlar, sólo Administración. La nota "SQL 191" está en las
--  dos tablas y en las funciones de la caja.
--
--  SQL 192 (29/10/2026, Mauricio: "seguí con otra función"): las "Ventas por
--  Vendedor" de BlueSoft, en POS → Ventas y en Gestión → Clientes y reportes.
--  pos_ventas_vendedor (nueva, sólo lee): lo que vendió cada vendedor en el
--  período (neto, descuentos, total, productos y ventas) y lo mismo repartido
--  por hora, por día, por semana y por mes. Cuenta las ventas cobradas, como
--  los totales de Tickets: las anuladas no, y los cambios tampoco (no son
--  ventas). Los mismos permisos que Tickets (su local y, sin «Ver otros
--  días», hoy).
--
--  SQL 193 (29/10/2026, Mauricio: "en envíos internos lo usamos para cuando
--  tenemos que hacer un stock de todo el local… creamos un depósito nuevo en
--  depósitos… Una vez cargado, en Tickets se cambia el depósito a nuevo y
--  listo"): los "Depósitos" de BlueSoft. Cada local tiene los suyos (de
--  temporada, "Verano 2027", u otros, "Fallas"); el stock es por depósito.
--  Uno es el predeterminado: de ahí descuentan las ventas y los cambios, ahí
--  entran los remitos y de ahí salen los envíos y las devoluciones. Cada local
--  arranca con uno, "Principal", con todo lo que tiene hoy. El stock de cada
--  seis meses: un depósito nuevo, un envío interno por módulo del depósito de
--  antes al nuevo (pasa en el momento; en Observaciones, el módulo y el
--  responsable), dos productos testigo por módulo (si no coincide, se rehace)
--  y «Predeterminar» el nuevo. Lo que quedó en el de antes es lo que no se
--  encontró. Tablas nuevas pos_depositos y pos_remito_testigos; pos_stock,
--  pos_stock_movs, pos_remitos y pos_inventarios con el depósito.
--
--  SQL 202 (30/10/2026, Mauricio: "descargué todos [los productos], así los
--  juntamos con la lista de precios… sí, daleee"): pos_articulos, todos los
--  productos de BlueSoft con sus talles y colores, para que la venta los
--  encuentre a todos (no sólo los 576 de catalogo.js) y para el alta y la
--  edición en Gestión → Productos. Está al final del archivo.
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

/* ─── SQL 190 (28/10/2026) · LOS PERMISOS DEL POS ───
   Mauricio (28/10): "dentro del sistema ya tenemos una parte de usuarios… tiene
   que servir la que tenemos y, de ahí, poder poner los permisos para el POS".
   En Config → Usuarios, a cada persona: «Usa el POS» y seis casillas (como la
   pestaña Permisos de BlueSoft). Cada rol arranca con lo suyo; pos_permisos
   guarda sólo lo que la oficina le cambió a una persona. El administrador puede
   todo, y la Gestión (la oficina) es sólo suya. */
create table if not exists pos_permisos (
  persona_id   uuid primary key references orden_personas(id) on delete cascade,
  cambios      jsonb not null default '{}'::jsonb,   -- {"usa": true, "dias": false}: sólo lo distinto de su rol
  cambiado_por uuid references orden_personas(id) on delete set null,
  cambiado_en  timestamptz not null default now()
);
alter table pos_permisos enable row level security;
revoke all on pos_permisos from anon, authenticated;

/* Lo que trae cada rol. El vendedor: vender, cambiar, la venta fallida, recibir y el stock (lo
   de siempre). El encargado, además: anular ventas, los envíos y las devoluciones, la caja, otros
   días y los precios de los remitos. El supervisor de varios locales, también otros locales.
   Usar el POS lo prende la oficina a cada uno. */
create or replace function pos_permiso_del_rol(p_rol text, p_con_local boolean, p_que text) returns boolean
language sql immutable as $$
  select case
    when p_rol = 'admin' then true
    when p_que in ('usa', 'gestion') then false
    when p_rol = 'supervisor' then p_que <> 'locales' or not coalesce(p_con_local, false)
    else false end
$$;

/* ¿Esta persona puede esto? Lo de su rol, salvo lo que la oficina le cambió. */
create or replace function pos_puede_persona(p orden_personas, p_que text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p.id is null or not coalesce(p.activo, false) or not coalesce(p.aprobado, false) then false
    when p.rol = 'admin' then true
    when p_que = 'gestion' then false
    else coalesce((select (x.cambios ->> p_que)::boolean from pos_permisos x where x.persona_id = p.id),
                  pos_permiso_del_rol(p.rol::text, p.local_id is not null, p_que)) end
$$;

/* Y la persona que entró. */
create or replace function pos_puede(p_que text) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_admin() or coalesce((select pos_puede_persona(p, p_que) from orden_personas p where p.id = orden_yo_id()), false)
$$;

create or replace function pos_permiso() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not pos_puede('usa') then
    raise exception 'Todavía no tenés el POS: lo prende la oficina en Config → Usuarios.' using errcode = '42501';
  end if;
end $$;

/* Lo que pide un permiso, además de usar el POS. */
create or replace function pos_permiso(p_que text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if not pos_puede(p_que) then
    raise exception '%', case p_que
      when 'gestion' then 'Esto es de la oficina: lo hace Administración.'
      when 'anular'  then 'No tenés permiso para anular ventas ni cambios. Lo da la oficina en Config → Usuarios.'
      when 'envios'  then 'No tenés permiso para los envíos internos ni las devoluciones a fábrica. Lo da la oficina en Config → Usuarios.'
      when 'caja'    then 'No tenés permiso para la caja (gastos, movimientos de salida, retiros y cierre). Lo da la oficina en Config → Usuarios.'   -- SQL 191: retiros
      when 'dias'    then 'Sólo podés ver lo de hoy. Para otros días, el permiso lo da la oficina en Config → Usuarios.'
      when 'locales' then 'Sólo podés usar el POS de tu local. Para otros, el permiso lo da la oficina en Config → Usuarios.'
      else 'No tenés permiso para esto en el POS.' end using errcode = '42501';
  end if;
end $$;

/* ¿Puede trabajar con ese local? El suyo y los que supervisa; con «Ver otros locales», todos. */
create or replace function pos_local_mio(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_local is not null and (pos_puede('locales') or exists (
    select 1 from orden_personas p
     where p.id = orden_yo_id()
       and (p.local_id = p_local or exists (select 1 from orden_supervision s where s.persona_id = p.id and s.local_id = p_local and s.aprobado))))
$$;

/* El local de una pantalla o de lo que se toca. null = todos los locales: sólo con «Ver otros locales». */
create or replace function pos_local_ok(p_local uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (pos_local_mio(p_local) or (p_local is null and pos_puede('locales'))) then
    raise exception 'Sólo podés usar el POS de tu local. Para otros, el permiso lo da la oficina en Config → Usuarios.' using errcode = '42501';
  end if;
end $$;

/* Sin «Ver otros días», las listas son sólo de hoy. */
create or replace function pos_dias_ok(p_desde date) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if (p_desde is null or p_desde < pos_hoy()) and not pos_puede('dias') then
    raise exception 'Sólo podés ver lo de hoy. Para otros días, el permiso lo da la oficina en Config → Usuarios.' using errcode = '42501';
  end if;
end $$;

/* Todo lo que puede la persona que entró, para la pantalla (pos_inicio), y sus locales. */
create or replace function pos_mis_permisos() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('usa', pos_puede('usa'), 'anular', pos_puede('anular'), 'envios', pos_puede('envios'),
           'caja', pos_puede('caja'), 'dias', pos_puede('dias'), 'locales', pos_puede('locales'), 'precios', pos_puede('precios'),
           'gestion', pos_puede('gestion'),
           'mios', coalesce((select jsonb_agg(l.id) from orden_locales l where l.activo and pos_local_mio(l.id)), '[]'::jsonb))
$$;

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
    /* SQL 190: su local y lo que puede en el POS (las casillas de Config → Usuarios). */
    'yo', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'local_id', p.local_id) from orden_personas p where p.id = orden_yo_id()),
    'puede', pos_mis_permisos(),
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_local_ok(v_local);   -- SQL 190

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
  perform pos_local_ok((r->>'local_id')::uuid);   -- SQL 190
  return r;
end $$;

/* Anular una venta (queda en la lista, tachada, con quién y por qué).
   SQL 160: lo que salió del stock con la venta, vuelve. */
create or replace function pos_venta_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare v pos_ventas; m pos_stock_movs;
begin
  perform pos_permiso('anular');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
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
  perform pos_local_ok(p_local);   -- SQL 190: las de su local
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
  a_caja_fuerte         numeric(14,2) not null default 0,   -- SQL 180: los movimientos de salida a la caja fuerte de este cierre
  retiros_fondos        numeric(14,2) not null default 0,   -- SQL 191: los retiros de fondos de la caja chica de este cierre
  esperado              numeric(14,2) not null default 0,   -- el "Saldo final en efectivo"
  contado               numeric(14,2) not null check (contado >= 0),
  desvio                numeric(14,2) generated always as (esperado - contado) stored,
  conteos               int not null default 1,
  primer_conteo         numeric(14,2),
  retiro                numeric(14,2) not null default 0,   -- a la caja fuerte desde el cierre (su Paso 2, hasta el SQL 180)
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
-- SQL 180: también lo que pasa a la caja fuerte (los "Movimientos de salida" de BlueSoft).
-- SQL 191: y los retiros de fondos, de la caja chica o de la caja fuerte (los "Retiros de Fondos" de BlueSoft).
create table pos_caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references orden_locales(id),
  prueba          boolean not null default false,
  fecha           timestamptz not null default clock_timestamp(),
  dia             date not null,
  tipo            text not null check (tipo in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro')),   -- SQL 191: 'retiro'
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
  numero          int not null,         -- SQL 179: G-1, G-2… seguido por local (las pruebas aparte, GP-1…); SQL 180: los de la caja fuerte, MS-1… aparte
  /* SQL 191: el retiro (RF-1…, otro talonario) dice de qué caja sale la plata y quién se la lleva (el
     «Socio» de BlueSoft). El tilde «Controlado» lo pone la oficina en los movimientos de salida y en los retiros. */
  caja            text check (caja in ('chica', 'fuerte')),
  retira          text,
  controlado_en   timestamptz,
  controlado_por  uuid,
  check (tipo <> 'gasto' or rubro is not null),
  constraint pos_caja_movimientos_retiro_check check ((tipo = 'retiro') = (caja is not null) and (tipo <> 'retiro' or retira is not null)
                                                     and (controlado_en is null or tipo in ('caja_fuerte', 'retiro')))
);
-- SQL 180: dos talonarios por local, los gastos (G-) y los pases a la caja fuerte (MS-). Hasta el 180, la restricción pos_caja_movimientos_numero_key.
-- SQL 191: tres talonarios, con los retiros de fondos (RF-). Hasta el 191, (tipo = 'caja_fuerte') en vez del case.
create unique index pos_caja_movimientos_numero on pos_caja_movimientos
  (local_id, prueba, (case tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end), numero);
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
   desde el último cierre. Es para las otras funciones (desde el SQL 175,
   pos_caja la devuelve entera: el efectivo ya no se esconde).
   SQL 151: también lo que se cobró en los cambios (la diferencia), en cada
   forma de pago y en el total, como una venta más.
   SQL 191: y los retiros de fondos de la caja chica. Los de la caja fuerte no
   son de esta caja: no entran. */
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
       and coalesce(x.caja, 'chica') = 'chica'   -- SQL 191
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
    'a_caja_fuerte', coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),   -- SQL 180
    'retiros_fondos', coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0),   -- SQL 191
    'conteos', (select count(*) from pos_caja_conteos k
                 where k.local_id = p_local and k.prueba = p_prueba and k.fecha > coalesce(u.fecha, '-infinity'::timestamptz)),
    'tolerancia', coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = p_local), 100)
  ) into r;
  return r;
end $$;

/* La caja de hoy para la pantalla del cierre.
   SQL 175 (Mauricio, 25/10: "vemos ahí qué importe nos da todo para poder
   controlar las tarjetas, el efectivo"): todo a la vista, como en BlueSoft,
   también el efectivo y lo cobrado en los cambios. Hasta el 175 el efectivo
   se veía recién después de contar (el conteo a ciegas del SQL 149); cada
   conteo sigue quedando anotado (pos_caja_contar). Así se hace el arqueo del
   cambio de turno: se abre el cierre y se mira, sin cerrar. */
create or replace function pos_caja(p_local uuid, p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
         and coalesce(m.caja, 'chica') = 'chica'), '[]'::jsonb));   -- SQL 191: sin los retiros de la caja fuerte
end $$;

/* Paso 1: el efectivo que contaron. Queda anotado (cada vez que cuentan) y
   devuelve cuánto tendría que haber y la diferencia (hasta el SQL 175, lo que
   tendría que haber se veía recién acá). En el primer cierre del local
   también dicen con cuánto arrancó la caja. */
create or replace function pos_caja_contar(p_local uuid, p_prueba boolean, p_contado numeric, p_saldo_inicial numeric default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a         jsonb;
  v_prueba  boolean := coalesce(p_prueba, false);
  v_cont    numeric := round(p_contado, 2);
  v_saldo   numeric;
  v_esp     numeric;
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(p_local);
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
         - (a->>'gastos')::numeric - (a->>'otras_salidas')::numeric - (a->>'a_caja_fuerte')::numeric   -- SQL 180
         - (a->>'retiros_fondos')::numeric;   -- SQL 191
  insert into pos_caja_conteos (local_id, prueba, persona, saldo_inicial, contado, esperado)
  values (p_local, v_prueba, orden_yo_id(), v_saldo, v_cont, v_esp);
  return a || jsonb_build_object('saldo_inicial', v_saldo, 'esperado', v_esp, 'contado', v_cont,
                                 'desvio', v_esp - v_cont, 'conteos', (a->>'conteos')::int + 1);
end $$;

/* Cerrar. La cuenta se vuelve a hacer acá, con lo que haya en ese momento;
   el efectivo tiene que ser el último que contaron (Paso 1). Con la misma
   `clave` dos veces (se cortó internet después de cerrar) devuelve el mismo
   cierre, no lo duplica.
   SQL 151: los cambios entran en el cierre como las ventas.
   SQL 180: lo que pasa a la caja fuerte ya no se escribe acá (era el Paso 2):
   son los movimientos de salida, que entran como los gastos (a_caja_fuerte).
   `retiro` se sigue aceptando, para la pantalla de antes. Y si la caja cambió
   después de contar (una venta en efectivo, un gasto, un pase a la caja
   fuerte), no cierra: hay que contar de nuevo.
   SQL 191: los retiros de fondos de la caja chica entran como los gastos
   (retiros_fondos); los de la caja fuerte, no. */
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
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(v_local);

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
   where local_id = v_local and prueba = v_prueba and cierre_id is null
     and coalesce(caja, 'chica') = 'chica';   -- SQL 191: el retiro de la caja fuerte no es de esta caja
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
    otros_ingresos       = coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    a_caja_fuerte        = coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),   -- SQL 180
    retiros_fondos       = coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0)   -- SQL 191
  where id = v_id;
  update pos_cierres set esperado = saldo_inicial + ventas_efectivo + otros_ingresos - gastos - otras_salidas - a_caja_fuerte
                                  - retiros_fondos   -- SQL 191
   where id = v_id
  returning * into c;
  /* SQL 180: lo que tendría que haber es lo mismo que cuando contaron; si no, algo entró o salió en el medio. */
  if c.esperado <> k.esperado then
    raise exception 'La caja cambió después de contar (una venta en efectivo, un gasto, un pase a la caja fuerte o un retiro): contá de nuevo y tocá «Ver la cuenta».';
  end if;

  return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                            'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'ya', false);
end $$;

/* Un gasto del local, otra salida u otro ingreso de la caja chica. Entra en
   el próximo cierre. Con la misma `clave` dos veces no se duplica.
   SQL 179: cada uno con su número, seguido por local (G-1, G-2…; las
   pruebas aparte, GP-1…). Lo devuelve, para el "Anotado: gasto G-12".
   SQL 180: también lo que pasa a la caja fuerte (tipo 'caja_fuerte', los
   "Movimientos de salida" de BlueSoft), con su propio número: MS-1…
   SQL 191: y los retiros de fondos (tipo 'retiro', RF-1…), de la caja chica o
   de la caja fuerte (caja), con quién se lleva la plata (retira). */
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
  v_caja    text := nullif(trim(coalesce(p->>'caja', '')), '');     -- SQL 191
  v_retira  text := nullif(trim(coalesce(p->>'retira', '')), '');   -- SQL 191
  v_id      uuid;
  v_num     int;
  v_ya      pos_caja_movimientos;
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(v_local);
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then
    raise exception 'El movimiento tiene que ser un gasto, otra salida, otro ingreso, un pase a la caja fuerte o un retiro de fondos.';
  end if;
  /* SQL 191: el retiro dice de qué caja sale la plata y quién se la lleva. */
  if v_tipo = 'retiro' then
    if v_caja is null or v_caja not in ('chica', 'fuerte') then raise exception 'Elegí de qué caja sale la plata.'; end if;
    if v_retira is null then raise exception 'Elegí quién retira la plata.'; end if;
    if length(v_retira) > 80 then raise exception 'El nombre de quien retira es demasiado largo.'; end if;
  end if;
  if v_tipo = 'gasto' and v_rubro is null then raise exception 'Elegí el tipo de gasto.'; end if;
  if v_tipo in ('salida', 'ingreso') and v_desc is null then raise exception 'Escribí de qué es.'; end if;
  if length(v_rubro) > 60 or length(v_desc) > 200 then raise exception 'El texto es demasiado largo.'; end if;
  if v_monto is null or v_monto <= 0 or v_monto >= 100000000 then raise exception 'Escribí el monto.'; end if;
  /* SQL 179: un número por vez en cada local: si dos guardan al mismo tiempo, el segundo espera (como los cambios). */
  perform pg_advisory_xact_lock(hashtext('pos_gasto:' || v_local::text || ':' || v_prueba::text));
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  select coalesce(max(m.numero), 0) + 1 into v_num from pos_caja_movimientos m
   where m.local_id = v_local and m.prueba = v_prueba   -- SQL 180: dos talonarios; SQL 191: tres
     and (case m.tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end) = (case v_tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end);
  insert into pos_caja_movimientos (local_id, prueba, dia, tipo, rubro, descripcion, monto, persona, persona_nombre, clave, numero, caja, retira)
  values (v_local, v_prueba, orden_dia_caja(v_local), v_tipo, case when v_tipo = 'gasto' then v_rubro end, v_desc, v_monto,
          orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_clave, v_num,
          case when v_tipo = 'retiro' then v_caja end, case when v_tipo = 'retiro' then v_retira end)   -- SQL 191
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v_prueba, 'ya', false);
end $$;

/* Anular un gasto (queda en la lista, tachado, con quién y por qué). Sólo
   mientras la caja está abierta: si ya entró en un cierre, se anula el cierre.
   SQL 191: el retiro de la caja fuerte no entra en ningún cierre: se anula
   cuando sea. Y lo que la oficina ya controló, no: primero se le saca el tilde. */
create or replace function pos_caja_mov_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare m pos_caja_movimientos;
begin
  perform pos_permiso('caja');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into m from pos_caja_movimientos where id = p_id for update;
  if not found then raise exception 'No existe ese movimiento.'; end if;
  perform pos_local_ok(m.local_id);
  if m.estado = 'anulado' then raise exception 'Ese movimiento ya está anulado.'; end if;
  if m.controlado_en is not null then   -- SQL 191
    raise exception 'Ese movimiento ya lo controló la oficina: para anularlo, primero hay que sacarle el tilde de «Controlado».';
  end if;
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
                    'retiro',      coalesce(sum(retiro + a_caja_fuerte) filter (where estado = 'cerrada'), 0),   -- SQL 180
                    'retiros_fondos', coalesce(sum(retiros_fondos) filter (where estado = 'cerrada'), 0),   -- SQL 191
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
                  where k.local_id = c.local_id and k.prueba = c.prueba and k.fecha > c.desde and k.fecha <= c.fecha), '[]'::jsonb))
    into r
    from pos_cierres c join orden_locales l on l.id = c.local_id
   where c.id = p_id;
  if r is null then raise exception 'No existe ese cierre.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);
  return r;
end $$;

/* Anular un cierre: sólo el último de la sucursal. Queda en la lista,
   tachado, y lo que tenía (ventas y gastos; desde el SQL 151, también los
   cambios) vuelve a la caja abierta, para cerrarla de nuevo. */
create or replace function pos_cierre_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare c pos_cierres; d pos_cierres;
begin
  perform pos_permiso('caja');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into c from pos_cierres where id = p_id;
  if not found then raise exception 'No existe ese cierre.'; end if;
  perform pos_local_ok(c.local_id);
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
   de BlueSoft).
   SQL 191: también los retiros de fondos (de las dos cajas), con de qué caja,
   quién se llevó la plata y el tilde «Controlado» de la oficina. */
create or replace function pos_caja_movimientos(p_desde date, p_hasta date, p_local uuid default null, p_tipo text default null,
                                                p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(p_local);
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_tipo is not null and p_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then raise exception 'Ese tipo de movimiento no existe.'; end if;
  return (
    with t as (
      select m.id, 'mov'::text as origen, m.fecha, m.local_id, m.tipo, m.rubro, m.descripcion, m.monto, m.persona_nombre as persona,
             m.estado = 'ok' as vale, m.estado, m.cierre_id, m.anulado_motivo, m.numero,   -- SQL 179: el número del gasto
             m.caja, m.retira, m.controlado_en, m.controlado_por   -- SQL 191
        from pos_caja_movimientos m
       where m.dia between p_desde and p_hasta and m.prueba = coalesce(p_prueba, false) and (p_local is null or m.local_id = p_local)
      union all
      select c.id, 'cierre', c.fecha, c.local_id, 'caja_fuerte', null, null, c.retiro, c.responsable_nombre,
             c.estado = 'cerrada', case when c.estado = 'cerrada' then 'ok' else 'anulado' end, c.id, c.anulado_motivo, null::int,
             null::text, null::text, null::timestamptz, null::uuid
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
                 'motivo', z.anulado_motivo, 'numero', z.numero,
                 'caja', z.caja, 'retira', z.retira, 'controlado', z.controlado_en is not null, 'controlado_en', z.controlado_en,   -- SQL 191
                 'controlado_por', (select pe.nombre from orden_personas pe where pe.id = z.controlado_por),
                 'cierre', (select jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'estado', c.estado)
                              from pos_cierres c where c.id = z.cierre_id)) order by z.fecha desc)
          from (select * from f order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'gasto',       coalesce(sum(monto) filter (where vale and tipo = 'gasto'), 0),
                    'salida',      coalesce(sum(monto) filter (where vale and tipo = 'salida'), 0),
                    'ingreso',     coalesce(sum(monto) filter (where vale and tipo = 'ingreso'), 0),
                    'caja_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'caja_fuerte'), 0),
                    'retiro',      coalesce(sum(monto) filter (where vale and tipo = 'retiro'), 0),   -- SQL 191
                    'controlado',  coalesce(sum(monto) filter (where vale and controlado_en is not null), 0),
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

/* ─── SQL 191 (29/10/2026) · LOS RETIROS DE FONDOS ───
   Quiénes se pueden llevar la plata de un retiro (el «Socio» de BlueSoft): la
   gente de la oficina. En la pantalla también se puede escribir otro nombre. */
create or replace function pos_retiran() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('caja');
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial)) order by p.nombre, p.inicial)
                     from orden_personas p where p.rol = 'admin' and p.activo and p.aprobado), '[]'::jsonb);
end $$;

/* El tilde «Controlado» de la oficina, en los movimientos de salida y en los
   retiros. Mauricio (29/10): "yo después voy a caja fuerte, veo los montos que
   los chicos agregaron a la caja fuerte y tienen que coincidir con lo que hay
   en el sistema". p_si = false lo saca. Sólo Administración. */
create or replace function pos_caja_mov_controlar(p_id uuid, p_si boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare m pos_caja_movimientos;
begin
  perform pos_permiso('gestion');
  select * into m from pos_caja_movimientos where id = p_id for update;
  if not found then raise exception 'No existe ese movimiento.'; end if;
  if m.tipo not in ('caja_fuerte', 'retiro') then raise exception 'Sólo se controlan los movimientos de salida y los retiros de fondos.'; end if;
  if coalesce(p_si, false) then
    if m.estado = 'anulado' then raise exception 'Ese movimiento está anulado: no hay nada que controlar.'; end if;
    if m.controlado_en is null then
      update pos_caja_movimientos set controlado_en = now(), controlado_por = orden_yo_id() where id = p_id returning * into m;
    end if;
  elsif m.controlado_en is not null then
    update pos_caja_movimientos set controlado_en = null, controlado_por = null where id = p_id returning * into m;
  end if;
  return jsonb_build_object('id', m.id, 'controlado', m.controlado_en is not null, 'controlado_en', m.controlado_en,
                            'controlado_por', (select pe.nombre from orden_personas pe where pe.id = m.controlado_por));
end $$;

revoke all on function pos_retiran(), pos_caja_mov_controlar(uuid, boolean) from public, anon;
grant execute on function pos_retiran(), pos_caja_mov_controlar(uuid, boolean) to authenticated;

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
--  SQL 263 (7/11): lo que se lleva ya PUEDE ir más barato que la lista
--  ("eso se puede editar"); el cambio igual no puede dar negativo.
--
--  La cuenta (la de BlueSoft: Neto, Descuentos, Total a pagar):
--    vuelve      = suma de lo que vuelve
--    se_lleva    = suma de lo que se lleva
--    diferencia  = se_lleva − vuelve  (nunca negativa)  =  suma de los pagos
--  SQL 266 (7/11): con los descuentos del cambio (las promos 3x2, 2.ª al 50 %
--  y los a mano, sobre lo que se lleva, como en la venta):
--    diferencia  = se_lleva − descuentos − vuelve  (nunca negativa)
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
  descuentos       numeric(12,2) not null default 0,   -- SQL 266: las promos y los a mano (pos_cambio_descuentos)
  diferencia       numeric(12,2) generated always as (se_lleva - descuentos - vuelve) stored,   -- SQL 266: menos los descuentos
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
  constraint pos_cambios_descuentos_check check (descuentos >= 0),   -- SQL 266
  constraint pos_cambios_check check (se_lleva - descuentos >= vuelve)   -- SQL 266 (antes: se_lleva >= vuelve)
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

-- SQL 266: cada descuento del cambio (como pos_venta_descuentos).
create table pos_cambio_descuentos (
  cambio_id    uuid not null references pos_cambios(id) on delete cascade,
  orden        int not null,
  tipo         text not null check (tipo in ('promo', 'manual')),
  promo_id     int,
  descripcion  text not null,
  monto        numeric(12,2) not null check (monto > 0),
  primary key (cambio_id, orden)
);

-- Cuántos cambios entraron en cada cierre y cuánto se cobró en ellos (ya está sumado en las ventas).
alter table pos_cierres add column cambios int not null default 0;
alter table pos_cierres add column cambios_diferencia numeric(14,2) not null default 0;

alter table pos_cambios       enable row level security;
alter table pos_cambio_items  enable row level security;
alter table pos_cambio_pagos  enable row level security;
alter table pos_cambio_descuentos enable row level security;   -- SQL 266
revoke all on pos_cambios, pos_cambio_items, pos_cambio_pagos, pos_cambio_descuentos from anon, authenticated;

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
  v_descs   jsonb := coalesce(p->'descuentos', '[]'::jsonb);   -- SQL 266: las promos y los descuentos a mano
  v_desc    numeric := 0;
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
  perform pos_local_ok(v_local);   -- SQL 190

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
      -- SQL 263 (7/11): lo que se lleva puede ir más barato que la lista (el vendedor lo cambia en «Precio unit.»).
      -- El cambio igual no puede dar negativo: no se devuelve plata.
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

  /* SQL 266 (7/11): los descuentos del cambio, como en la venta: las promos de Gestión → Promociones (3x2, 2.ª al 50 %)
     y los descuentos a mano, sobre lo que se lleva. La pantalla hace la cuenta; acá se revisa que cada uno tenga monto y
     que entre todos no pasen lo que queda por cobrar (el cambio no da negativo: no se devuelve plata). El cupón, el
     regalo de cumpleaños y el premio del Club van en la venta (necesitan su lógica). */
  if jsonb_typeof(v_descs) <> 'array' then raise exception 'Los descuentos no son válidos.'; end if;
  if jsonb_array_length(v_descs) > 20 then raise exception 'Son demasiados descuentos para un cambio.'; end if;
  for x in select * from jsonb_array_elements(v_descs) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un descuento que no es válido.'; end if;
    if coalesce(x->>'tipo', '') not in ('promo', 'manual') then
      raise exception 'En un cambio van las promos y los descuentos a mano (el cupón y los beneficios del Club, en la venta).';
    end if;
    v_desc := v_desc + m;
  end loop;
  if v_desc > v_dif then
    raise exception 'Los descuentos ($%) son más de lo que queda por cobrar ($%): el cambio no puede dar negativo.',
      to_char(v_desc, 'FM999G999G990D00'), to_char(v_dif, 'FM999G999G990D00');
  end if;
  v_dif := v_dif - v_desc;

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
                           cantidad_vuelve, cantidad_sale, observaciones, clave, descuentos)
  values (v_local, v_num, v_prueba, pos_hoy(), v_vend, orden_yo_id(), v_lista, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
          v_vuelve, v_sale, v_cv, v_cs, v_obs, v_clave, v_desc)
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

  /* SQL 266: cada descuento, con su promo si es una (como pos_venta_descuentos). */
  i := 0;
  for x in select * from jsonb_array_elements(v_descs) loop
    i := i + 1;
    insert into pos_cambio_descuentos (cambio_id, orden, tipo, promo_id, descripcion, monto)
    values (v_id, i, x->>'tipo', nullif(x->>'promo_id', '')::int,
            left(coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), 120), round((x->>'monto')::numeric, 2));
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
  perform pos_local_ok(p_local);   -- SQL 190
  perform pos_dias_ok(p_desde);
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
                 'vuelve', z.vuelve, 'se_lleva', z.se_lleva, 'diferencia', z.diferencia, 'estado', z.estado,
                 -- SQL 266: los descuentos y cuántas prendas vuelven y salen (la «Cant.» del cambio en Tickets)
                 'descuentos', z.descuentos, 'cantidad_vuelve', z.cantidad_vuelve, 'cantidad_sale', z.cantidad_sale) order by z.fecha desc)
          from (select * from c order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'cambios',    count(*) filter (where estado = 'hecho'),
                    'anulados',   count(*) filter (where estado = 'anulado'),
                    'vuelven',    coalesce(sum(cantidad_vuelve) filter (where estado = 'hecho'), 0),
                    'salen',      coalesce(sum(cantidad_sale) filter (where estado = 'hecho'), 0),
                    'descuentos', coalesce(sum(descuentos) filter (where estado = 'hecho'), 0),   -- SQL 266
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
              -- SQL 266: los descuentos, con el mismo nombre que en pos_venta
              'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'cambio_id' order by d.orden) from pos_cambio_descuentos d where d.cambio_id = c.id), '[]'::jsonb),
              'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'cambio_id' order by g.orden) from pos_cambio_pagos g where g.cambio_id = c.id), '[]'::jsonb))
    into r
    from pos_cambios c join orden_locales l on l.id = c.local_id
   where c.id = p_id;
  if r is null then raise exception 'No existe ese cambio.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);   -- SQL 190
  return r;
end $$;

/* Anular un cambio (queda en la lista, tachado, con quién y por qué). Sólo
   mientras la caja está abierta: si ya entró en un cierre, se anula el cierre.
   SQL 160: el stock vuelve a como estaba antes del cambio. */
create or replace function pos_cambio_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare c pos_cambios; m pos_stock_movs;
begin
  perform pos_permiso('anular');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into c from pos_cambios where id = p_id for update;
  if not found then raise exception 'No existe ese cambio.'; end if;
  perform pos_local_ok(c.local_id);
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
-- SQL 189: precio y razón. El precio es el de la lista del local que lo manda
-- (un envío o una devolución), al guardarlo; null si sale de la fábrica o si el
-- producto no tiene precio. La razón, la de BlueSoft en cada renglón ("fallada").
create table pos_remito_items (
  remito_id    uuid not null references pos_remitos(id) on delete cascade,
  codigo       text not null,
  talle        text not null default '',
  color        text not null default '',
  descripcion  text,
  cantidad     int not null check (cantidad between 0 and 9999),
  contado      int check (contado between 0 and 9999),
  orden        int not null default 0,
  precio       numeric(12,2),
  razon        text check (length(razon) <= 60),
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
   no suma en las entradas.
   SQL 193: en un depósito del local; sin depósito, el predeterminado (el de las
   ventas). Cambió la firma: la vieja se borra. */
drop function if exists pos_stock_mover(uuid, text, text, text, int, text, uuid, text, text, text, text);
create or replace function pos_stock_mover(p_local uuid, p_codigo text, p_talle text, p_color text, p_cantidad int,
                                           p_tipo text, p_ref_id uuid, p_ref text, p_descripcion text default null,
                                           p_detalle text default null, p_clave text default null, p_deposito uuid default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
  v_an  boolean := p_tipo like '%anulad%';
  v_dep uuid := p_deposito;
  v_e   int;
  v_s   int;
begin
  if v_c = '' or length(v_c) > 30 or coalesce(p_cantidad, 0) = 0 then return; end if;
  if v_dep is null then
    v_dep := pos_deposito_de(p_local);   -- SQL 193
  elsif not exists (select 1 from pos_depositos where id = v_dep and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  v_e := case when not v_an and p_cantidad > 0 then p_cantidad when v_an and p_cantidad < 0 then p_cantidad else 0 end;
  v_s := case when not v_an and p_cantidad < 0 then -p_cantidad when v_an and p_cantidad > 0 then -p_cantidad else 0 end;
  insert into pos_stock_movs (local_id, deposito_id, codigo, talle, color, cantidad, tipo, ref_id, ref, detalle, persona, clave)
  values (p_local, v_dep, v_c, v_t, v_co, p_cantidad, p_tipo, p_ref_id, p_ref, nullif(trim(coalesce(p_detalle, '')), ''), orden_yo_id(), p_clave);
  insert into pos_stock as st (local_id, deposito_id, codigo, talle, color, cantidad, entradas, salidas, descripcion)
  values (p_local, v_dep, v_c, v_t, v_co, p_cantidad, v_e, v_s, nullif(trim(coalesce(p_descripcion, '')), ''))
  on conflict (deposito_id, codigo, talle, color) do update
     set cantidad = st.cantidad + excluded.cantidad, entradas = st.entradas + excluded.entradas, salidas = st.salidas + excluded.salidas,
         descripcion = coalesce(excluded.descripcion, st.descripcion), actualizado_en = now();
end $$;

/* El stock de un local para la venta y el cambio: avisan si se vende algo que
   según el sistema no hay. con_stock: el local ya tiene stock cargado (si no,
   no se avisa nada). Sólo las variantes que no están en cero.
   SQL 193: la suma de los depósitos que cuentan para la consulta de stock (así,
   mientras se pasa la ropa al depósito nuevo, no avisa de más); con p_deposito,
   lo de ése (el envío entre depósitos). Cambió la firma: la vieja se borra. */
drop function if exists pos_stock_local(uuid);
create or replace function pos_stock_local(p_local uuid, p_deposito uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- SQL 190
  if p_deposito is not null and not exists (select 1 from pos_depositos where id = p_deposito and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  return (
    with s as (
      select x.codigo, x.talle, x.color, sum(x.cantidad)::int cantidad
        from pos_stock x join pos_depositos d on d.id = x.deposito_id
       where x.local_id = p_local and case when p_deposito is null then d.consulta and d.activo else d.id = p_deposito end
       group by x.codigo, x.talle, x.color
    )
    select jsonb_build_object(
      'con_stock', exists (select 1 from pos_stock y where y.local_id = p_local and y.cantidad > 0),
      'filas', coalesce((select jsonb_agg(jsonb_build_array(s.codigo, s.talle, s.color, s.cantidad)) from s where s.cantidad <> 0), '[]'::jsonb))
  );
end $$;

/* La consulta de stock (como la de BlueSoft). p_codigos: los que encontró la
   pantalla en el catálogo (por nombre o por rubro); p_buscar: el texto, para
   los que no están en el catálogo. Sin ninguno de los dos, todo.
   SQL 172 (Mauricio, 25/10: "mostraba todo el stock que teníamos"): de a tandas
   de productos (p_desde, p_productos), así la pantalla muestra todo y sigue
   cargando al bajar; sin p_productos, todo junto (el Excel y la comparación del
   inventario), hasta 60.000 renglones (antes cortaba en 3.000: con el
   inventario de un local entero no alcanzaba). p_resumen: un renglón por
   producto, para la vista "Por rubro". Cambió la firma: la vieja se borra.
   SQL 193: sin p_deposito, por local, la suma de sus depósitos que cuentan para
   la consulta de stock (los activos con «Considerar para consulta de stock»);
   con p_deposito, sólo ése. Cambió la firma otra vez. */
drop function if exists pos_stock_consulta(uuid, text[], text, boolean, boolean);
drop function if exists pos_stock_consulta(uuid, text[], text, boolean, boolean, int, int, boolean);
create or replace function pos_stock_consulta(p_local uuid default null, p_codigos text[] default null, p_buscar text default null,
                                              p_ocultar_sin boolean default true, p_negativos boolean default false,
                                              p_desde int default 0, p_productos int default null, p_resumen boolean default false,
                                              p_deposito uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q     text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  v_desde int := greatest(coalesce(p_desde, 0), 0);
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- SQL 190
  if p_productos is not null and (p_productos < 0 or p_productos > 2000) then
    raise exception 'Se piden de 0 a 2000 productos por vez.';
  end if;
  if p_deposito is not null and not exists (select 1 from pos_depositos where id = p_deposito and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  return (
    /* SQL 193: un renglón por local, producto, talle y color (lo de sus depósitos, sumado). */
    with b as (
      select x.local_id, x.codigo, x.talle, x.color, sum(x.cantidad)::int cantidad, sum(x.entradas)::int entradas, sum(x.salidas)::int salidas,
             max(x.descripcion) descripcion
        from pos_stock x join pos_depositos d on d.id = x.deposito_id
       where (p_local is null or x.local_id = p_local)
         and case when p_deposito is null then d.consulta and d.activo else d.id = p_deposito end
       group by x.local_id, x.codigo, x.talle, x.color
    ),
    s as (
      select x.* from b x
       where ((p_codigos is null and v_q is null)
              or x.codigo = any(coalesce(p_codigos, '{}'::text[]))
              or (v_q is not null and (lower(x.codigo) like v_q || '%' or lower(coalesce(x.descripcion, '')) like '%' || v_q || '%')))
         and (not coalesce(p_ocultar_sin, true) or x.cantidad <> 0)
         and (not coalesce(p_negativos, false) or x.cantidad < 0)
    ),
    /* SQL 172: los productos en orden de código, numerados desde 0, para pedirlos de a tandas. */
    p as (select d.codigo, (row_number() over (order by d.codigo) - 1)::int n from (select distinct codigo from s) d),
    f as (select s.* from s join p on p.codigo = s.codigo
           where p_productos is null or (p.n >= v_desde and p.n < v_desde + p_productos))
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(jsonb_build_array(z.local_id, z.codigo, z.talle, z.color, z.cantidad, z.entradas, z.salidas, z.descripcion)
                                          order by z.codigo, z.color, z.talle, z.local_id)
                           from (select * from f order by codigo, color, talle, local_id limit 60000) z), '[]'::jsonb),
      'totales', (select jsonb_build_object('cantidad', coalesce(sum(cantidad), 0), 'entradas', coalesce(sum(entradas), 0),
                                            'salidas', coalesce(sum(salidas), 0), 'lineas', count(*),
                                            'negativos', count(*) filter (where cantidad < 0),
                                            'productos', count(distinct codigo)) from s),
      /* SQL 172: un renglón por producto [código, descripción, cantidad, entradas, salidas, renglones, en negativo]. */
      'resumen', case when coalesce(p_resumen, false) then coalesce((
                   select jsonb_agg(jsonb_build_array(g.codigo, g.descripcion, g.cantidad, g.entradas, g.salidas, g.lineas, g.negativos) order by g.codigo)
                     from (select codigo, max(descripcion) descripcion, sum(cantidad) cantidad, sum(entradas) entradas, sum(salidas) salidas,
                                  count(*) lineas, count(*) filter (where cantidad < 0) negativos
                             from s group by codigo) g), '[]'::jsonb) end,
      /* SQL 193: con un depósito, si ése ya tuvo algo. */
      'cargado', exists (select 1 from pos_stock y where (p_local is null or y.local_id = p_local) and (p_deposito is null or y.deposito_id = p_deposito)),
      /* Con tandas: si quedan productos después de ésta. Sin tandas: si pasó de 60.000 renglones. */
      'mas', case when p_productos is null then (select count(*) > 60000 from f)
                  else (select count(*) > v_desde + p_productos from p) end
    )
  );
end $$;

/* Una variante en un local: cuánto hay y sus últimos movimientos ("Ver detalle de movimientos").
   SQL 193: cuánto hay en cada depósito del local y el depósito de cada movimiento.
   Sin p_deposito, "hay" es la suma de los de la consulta de stock y van los
   movimientos de todos; con p_deposito, los de ése. Cambió la firma: la vieja se borra. */
drop function if exists pos_stock_variante(uuid, text, text, text);
create or replace function pos_stock_variante(p_local uuid, p_codigo text, p_talle text, p_color text, p_deposito uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- SQL 190
  if p_deposito is not null and not exists (select 1 from pos_depositos where id = p_deposito and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  return jsonb_build_object(
    'local', (select l.nombre from orden_locales l where l.id = p_local),
    'deposito', (select d.nombre from pos_depositos d where d.id = p_deposito),
    'stock', (select jsonb_build_object('cantidad', sum(s.cantidad), 'entradas', sum(s.entradas), 'salidas', sum(s.salidas), 'descripcion', max(s.descripcion))
                from pos_stock s join pos_depositos d on d.id = s.deposito_id
               where s.local_id = p_local and s.codigo = v_c and s.talle = v_t and s.color = v_co
                 and case when p_deposito is null then d.consulta and d.activo else d.id = p_deposito end
              having count(*) > 0),
    'depositos', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'cantidad', s.cantidad, 'predeterminado', d.predeterminado,
                                          'consulta', d.consulta and d.activo) order by d.predeterminado desc, d.numero)
        from pos_stock s join pos_depositos d on d.id = s.deposito_id
       where s.local_id = p_local and s.codigo = v_c and s.talle = v_t and s.color = v_co), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', m.fecha, 'tipo', m.tipo, 'cantidad', m.cantidad, 'ref', m.ref, 'ref_id', m.ref_id,
                                          'detalle', m.detalle, 'persona', pe.nombre, 'deposito', dm.nombre,
                                          /* SQL 172: quién vendió o atendió (en las ventas y los cambios), para el Detalle. */
                                          'vendedor', case when m.tipo in ('venta', 'venta_anulada') then (select v.vendedor from pos_ventas v where v.id = m.ref_id)
                                                           when m.tipo in ('cambio', 'cambio_anulado') then (select k.vendedor from pos_cambios k where k.id = m.ref_id) end)
               order by m.fecha desc, m.id desc)
        from (select * from pos_stock_movs x
               where x.local_id = p_local and x.codigo = v_c and x.talle = v_t and x.color = v_co
                 and (p_deposito is null or x.deposito_id = p_deposito)
               order by x.fecha desc, x.id desc limit 200) m
        left join orden_personas pe on pe.id = m.persona
        left join pos_depositos dm on dm.id = m.deposito_id), '[]'::jsonb));
end $$;

/* El ajuste de stock de BlueSoft: "hay en realidad N", con el motivo. Con la
   misma clave dos veces no ajusta dos veces. SQL 193: en un depósito (sin
   deposito_id, el predeterminado). */
create or replace function pos_stock_ajustar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local    uuid := nullif(p->>'local_id', '')::uuid;
  v_dep      uuid := nullif(p->>'deposito_id', '')::uuid;
  v_c        text := upper(trim(coalesce(p->>'codigo', '')));
  v_t        text := upper(trim(coalesce(p->>'talle', '')));
  v_co       text := upper(trim(coalesce(p->>'color', '')));
  v_motivo   text := trim(coalesce(p->>'motivo', ''));
  v_detalle  text := nullif(trim(coalesce(p->>'detalle', '')), '');
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_nueva    int;
  v_actual   int;
begin
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  /* SQL 193: el depósito (sin él, el predeterminado). */
  if v_dep is null then v_dep := pos_deposito_de(v_local);
  elsif not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local) then raise exception 'Ese depósito no es de la sucursal.';
  end if;
  /* Un ajuste por vez en cada local, y el renglón bloqueado (si justo entra
     una venta, espera): así "hay N" es contra lo que hay de verdad. */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || v_local::text));
  select s.cantidad into v_actual from pos_stock s
   where s.deposito_id = v_dep and s.codigo = v_c and s.talle = v_t and s.color = v_co for update;
  v_actual := coalesce(v_actual, 0);
  if v_nueva = v_actual then raise exception 'El sistema ya dice %: no hay nada que ajustar.', v_actual; end if;
  perform pos_stock_mover(v_local, v_c, v_t, v_co, v_nueva - v_actual, 'ajuste', null, 'Ajuste',
                          nullif(trim(coalesce(p->>'descripcion', '')), ''), v_motivo || coalesce(': ' || v_detalle, ''), v_clave, v_dep);
  return jsonb_build_object('antes', v_actual, 'ahora', v_nueva, 'ya', false, 'deposito', (select nombre from pos_depositos where id = v_dep));
end $$;

/* Cargar un inventario: lo que dice la lista reemplaza lo que dice el sistema
   (la carga inicial desde el Excel de BlueSoft, o el inventario de cada seis
   meses). Con resto_a_cero, lo que no está en la lista queda en 0: es el
   inventario completo del local. Con la misma clave dos veces, no lo carga dos
   veces. SQL 193: en un depósito (sin deposito_id, el predeterminado); "el
   resto en 0" es lo de ese depósito. */
create or replace function pos_inventario_cargar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_dep     uuid := nullif(p->>'deposito_id', '')::uuid;
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  /* SQL 193: el depósito (sin él, el predeterminado). */
  if v_dep is null then v_dep := pos_deposito_de(v_local);
  elsif not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local) then raise exception 'Ese depósito no es de la sucursal.';
  end if;

  /* Uno por vez en cada local: los ajustes y las otras cargas esperan, y el
     stock del depósito queda bloqueado (las ventas de ese momento esperan). */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || v_local::text));
  perform 1 from pos_stock where deposito_id = v_dep for update;
  insert into pos_inventarios (local_id, deposito_id, persona, persona_nombre, origen, resto_a_cero, observaciones, clave)
  values (v_local, v_dep, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_origen, v_cero, v_obs, v_clave)
  returning id into v_id;

  /* Lo de la lista (los repetidos se suman), contra lo que dice el sistema. */
  for x in
    select z.c, z.t, z.co, z.n, z.d, coalesce(s.cantidad, 0) actual
      from (select upper(trim(e2->>'codigo')) c, upper(trim(coalesce(e2->>'talle', ''))) t, upper(trim(coalesce(e2->>'color', ''))) co,
                   sum((e2->>'cantidad')::int)::int n, max(nullif(trim(coalesce(e2->>'descripcion', '')), '')) d
              from jsonb_array_elements(v_items) e2 group by 1, 2, 3) z
      left join pos_stock s on s.deposito_id = v_dep and s.codigo = z.c and s.talle = z.t and s.color = z.co
  loop
    v_l := v_l + 1;
    v_u := v_u + greatest(x.n, 0);
    if x.n <> x.actual then
      perform pos_stock_mover(v_local, x.c, x.t, x.co, x.n - x.actual, 'inventario', v_id, 'Inventario', x.d, null, null, v_dep);
      v_c := v_c + 1;
    elsif x.d is not null then
      update pos_stock set descripcion = x.d where deposito_id = v_dep and codigo = x.c and talle = x.t and color = x.co and descripcion is null;
    end if;
  end loop;

  /* Lo que no está en la lista, en 0 (es el inventario completo del depósito). */
  if v_cero then
    for x in
      select s.codigo, s.talle, s.color, s.cantidad
        from pos_stock s
        left join (select distinct upper(trim(e3->>'codigo')) c, upper(trim(coalesce(e3->>'talle', ''))) t, upper(trim(coalesce(e3->>'color', ''))) co
                     from jsonb_array_elements(v_items) e3) z on z.c = s.codigo and z.t = s.talle and z.co = s.color
       where s.deposito_id = v_dep and s.cantidad <> 0 and z.c is null
    loop
      perform pos_stock_mover(v_local, x.codigo, x.talle, x.color, -x.cantidad, 'inventario', v_id, 'Inventario', null, 'No estaba en la lista', null, v_dep);
      v_c := v_c + 1;
    end loop;
  end if;

  update pos_inventarios set lineas = v_l, unidades = v_u, cambiaron = v_c where id = v_id;
  return jsonb_build_object('id', v_id, 'lineas', v_l, 'unidades', v_u, 'cambiaron', v_c, 'ya', false,
                            'deposito', (select nombre from pos_depositos where id = v_dep));
end $$;

/* Las cargas de inventario anteriores (las últimas 50). SQL 193: con el depósito. */
create or replace function pos_inventarios(p_local uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'fecha', i.fecha, 'local', l.nombre, 'local_id', i.local_id, 'persona', i.persona_nombre,
                                        'origen', i.origen, 'lineas', i.lineas, 'unidades', i.unidades, 'cambiaron', i.cambiaron,
                                        'resto_a_cero', i.resto_a_cero, 'observaciones', i.observaciones,
                                        'deposito', (select d.nombre from pos_depositos d where d.id = i.deposito_id)) order by i.fecha desc)
      from (select * from pos_inventarios x where p_local is null or x.local_id = p_local order by x.fecha desc limit 50) i
      join orden_locales l on l.id = i.local_id), '[]'::jsonb);
end $$;

/* Un remito nuevo: de la fábrica (sin origen) o de otro local (un envío), a
   un local. Los renglones repetidos (el mismo código, talle y color) se suman.
   Si sale de un local, a ése se le saca del stock ahora. Con la misma clave
   dos veces devuelve el que ya estaba.
   SQL 167: con a_fabrica, de un local a la fábrica (una devolución, "que lo
   devuelvan"): sale del stock del local ahora y la oficina lo da por recibido.
   SQL 193: sale del depósito origen_deposito_id (sin él, del predeterminado).
   Con destino_deposito_id, es un pase entre dos depósitos del mismo local (el
   stock de cada seis meses, un módulo por vez, con el módulo y el responsable):
   sale de uno y entra al otro en el acto, y queda recibido.
   SQL 222: el pase de un módulo al stock general en curso (al depósito de la
   temporada nueva) lo hace cualquiera del local que use el POS, sin el permiso
   de los envíos; con modulo_id, el módulo del croquis del local (de ahí sale su
   nombre), y cada módulo se pasa una vez (para pasarlo de nuevo, se rehace). */
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
  v_dep_o    uuid := nullif(p->>'origen_deposito_id', '')::uuid;    -- SQL 193
  v_dep_d    uuid := nullif(p->>'destino_deposito_id', '')::uuid;
  v_modulo   text := nullif(upper(trim(coalesce(p->>'modulo', ''))), '');
  v_resp     text := nullif(trim(coalesce(p->>'responsable', '')), '');
  v_entre    boolean := nullif(p->>'destino_deposito_id', '') is not null;
  v_mod_id   uuid := nullif(p->>'modulo_id', '')::uuid;               -- SQL 222
  v_mod_nom  text;
  v_nom_o    text;
  v_nom_d    text;
  v_ya       pos_remitos;
  v_id       uuid;
  v_num      int;
  v_lista    int;
  x          jsonb;
  m          record;
begin
  perform pos_permiso();
  /* SQL 190: lo que viene de la fábrica lo arma la oficina; los envíos y las devoluciones salen del local, con su permiso. */
  if v_origen is null then perform pos_permiso('gestion');
  else
    /* SQL 222: el pase de un módulo al stock general lo hace cualquiera del local (lo hacen ellos). */
    if not (v_entre and pos_stock_general_es_(v_origen, v_dep_d)) then perform pos_permiso('envios'); end if;
    perform pos_local_ok(v_origen);
  end if;
  if v_clave is not null then
    select * into v_ya from pos_remitos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'ya', true); end if;
  end if;
  /* SQL 193: entre dos depósitos de la sucursal. */
  if v_entre then
    if v_origen is null then raise exception 'Elegí la sucursal.'; end if;
    v_destino := v_origen;
    v_fabrica := false;
    if v_dep_o is null then raise exception 'Elegí de qué depósito sale.'; end if;
    if v_dep_o = v_dep_d then raise exception 'Sale y llega al mismo depósito: elegí otro.'; end if;
    select nombre into v_nom_o from pos_depositos where id = v_dep_o and local_id = v_origen and activo;
    select nombre into v_nom_d from pos_depositos where id = v_dep_d and local_id = v_origen and activo;
    if v_nom_o is null or v_nom_d is null then raise exception 'Los dos depósitos tienen que ser de la sucursal y estar activos.'; end if;
    if length(v_modulo) > 20 then raise exception 'El módulo es demasiado largo (hasta 20 letras).'; end if;
    if length(v_resp) > 60 then raise exception 'El nombre del responsable es demasiado largo.'; end if;
    /* SQL 222: el módulo del croquis del local (el stock general): de ahí sale su nombre. */
    if v_mod_id is not null then
      select om.nombre into v_mod_nom from orden_modulos om join orden_sectores os on os.id = om.sector_id
       where om.id = v_mod_id and os.local_id = v_origen and om.activo and os.activo;
      if v_mod_nom is null then raise exception 'Ese módulo no es de la sucursal (o ya no está en el croquis).'; end if;
      v_modulo := coalesce(v_modulo, left(upper(v_mod_nom), 20));
    end if;
  elsif v_dep_o is not null and (v_origen is null or not exists (select 1 from pos_depositos where id = v_dep_o and local_id = v_origen and activo)) then
    raise exception 'Ese depósito no es de la sucursal de donde sale.';
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
  if v_origen = v_destino and not v_entre then raise exception 'Sale y llega al mismo local: elegí otro.'; end if;
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
    if length(trim(coalesce(x->>'razon', ''))) > 60 then   -- SQL 189
      raise exception 'La razón de % es demasiado larga (hasta 60 letras).', trim(x->>'codigo');
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
  /* SQL 222: un módulo del stock general se pasa una vez (para pasarlo de nuevo, primero se rehace). */
  if v_entre and v_mod_id is not null then
    select * into v_ya from pos_remitos where destino_deposito_id = v_dep_d and modulo_id = v_mod_id and estado <> 'anulado' order by numero desc limit 1;
    if found then raise exception '«%» ya se pasó (R-%): para pasarlo de nuevo, primero rehacelo.', v_mod_nom, v_ya.numero; end if;
  end if;
  select coalesce(max(numero), 0) + 1 into v_num from pos_remitos;
  /* SQL 193: si sale de un local, de qué depósito (sin elegirlo, del predeterminado). */
  if v_origen is not null and v_dep_o is null then v_dep_o := pos_deposito_de(v_origen); end if;

  insert into pos_remitos (numero, origen_local_id, destino_local_id, referencia, dia, creado_por, creado_nombre, observaciones, clave,
                           origen_deposito_id, destino_deposito_id, modulo, responsable, estado, recibido_en, modulo_id)
  values (v_num, v_origen, v_destino, v_ref, pos_hoy(), orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_obs, v_clave,
          v_dep_o, v_dep_d, case when v_entre then v_modulo end, case when v_entre then v_resp end,
          case when v_entre then 'recibido' else 'pendiente' end, case when v_entre then clock_timestamp() end,
          case when v_entre then v_mod_id end)   -- SQL 222
  returning id into v_id;

  /* SQL 189: si sale de un local, cada renglón con el precio de la lista de ese local (el de hoy) y su razón. */
  if v_origen is not null then
    select s.lista_id into v_lista from pos_sucursales s where s.local_id = v_origen;
  end if;
  insert into pos_remito_items (remito_id, codigo, talle, color, descripcion, cantidad, orden, precio, razon, contado)
  select v_id, z.c, z.t, z.co, max(z.d), sum(z.n), min(z.o), case when v_lista is not null then pos_precio_de(v_lista, z.c) end, max(z.r),
         case when v_entre then sum(z.n) end   -- SQL 193: el pase entre depósitos llega entero
    from (select upper(trim(e.v->>'codigo')) c, upper(trim(coalesce(e.v->>'talle', ''))) t, upper(trim(coalesce(e.v->>'color', ''))) co,
                 nullif(trim(coalesce(e.v->>'descripcion', '')), '') d, (e.v->>'cantidad')::int n, e.o::int o,
                 nullif(trim(coalesce(e.v->>'razon', '')), '') r
            from jsonb_array_elements(v_items) with ordinality e(v, o)) z
   group by z.c, z.t, z.co;

  /* Un envío entre locales (o una devolución a la fábrica): sale ahora del stock del que lo manda.
     SQL 193: entre depósitos, sale de uno y entra al otro. */
  if v_origen is not null then
    for m in select * from pos_remito_items where remito_id = v_id loop
      perform pos_stock_mover(v_origen, m.codigo, m.talle, m.color, -m.cantidad, 'envio', v_id,
                              case when v_destino is null then 'Devolución R-' else 'Envío R-' end || v_num, m.descripcion,
                              case when v_entre then 'Al depósito ' || v_nom_d end, null, v_dep_o);
      if v_entre then
        perform pos_stock_mover(v_origen, m.codigo, m.talle, m.color, m.cantidad, 'remito', v_id, 'Envío R-' || v_num, m.descripcion,
                                'Del depósito ' || v_nom_o, null, v_dep_d);
      end if;
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'ya', false, 'entre_depositos', v_entre,
                            'productos', (select count(distinct codigo) from pos_remito_items where remito_id = v_id),
                            'unidades', (select sum(cantidad) from pos_remito_items where remito_id = v_id),
                            'total', (select sum(cantidad * precio) from pos_remito_items where remito_id = v_id));
end $$;

/* El listado de remitos. p_local: los que llegan a ese local o salen de él.
   "pendiente" trae todos los que faltan recibir, de cualquier día; los demás
   estados, los del período. SQL 167: los que vuelven a la fábrica (sin
   destino) y las diferencias que faltan resolver de cada uno. SQL 189: el
   total en pesos de cada uno (con el precio de cada renglón), cuántos
   productos no tienen precio y el monto de todos (sin los anulados), como el
   pie de "Devoluciones a Fábrica" de BlueSoft. SQL 193: los depósitos, el
   módulo, el responsable y los testigos (cuántos productos coincidieron y
   cuántos no, con lo último que se contó de cada uno); el pase entre depósitos
   del local (entre_depositos) va en las filas pero no en los totales. */
create or replace function pos_remitos(p_desde date, p_hasta date, p_local uuid default null, p_estado text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- SQL 190
  if p_estado is distinct from 'pendiente' then perform pos_dias_ok(p_desde); end if;
  if p_estado is not null and p_estado not in ('pendiente', 'recibido', 'con_diferencias', 'anulado') then
    raise exception 'Ese estado no existe.';
  end if;
  if p_estado is distinct from 'pendiente' then
    if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
    if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  end if;
  v_res := (
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
                 'anulado_motivo', z.anulado_motivo,
                 'total', (select sum(i.cantidad * i.precio) from pos_remito_items i where i.remito_id = z.id),
                 'sin_precio', (select count(distinct i.codigo) from pos_remito_items i where i.remito_id = z.id and i.precio is null),
                 /* SQL 193 */
                 'entre_depositos', coalesce(z.origen_local_id = z.destino_local_id, false),
                 'origen_deposito_id', z.origen_deposito_id, 'origen_deposito', dpo.nombre,
                 'destino_deposito_id', z.destino_deposito_id, 'destino_deposito', dpd.nombre,
                 'modulo', z.modulo, 'responsable', z.responsable,
                 'testigos_ok', (select count(*) from (select distinct on (t.codigo) t.coincide from pos_remito_testigos t
                                                        where t.remito_id = z.id order by t.codigo, t.id desc) u where u.coincide),
                 'testigos_mal', (select count(*) from (select distinct on (t.codigo) t.coincide from pos_remito_testigos t
                                                         where t.remito_id = z.id order by t.codigo, t.id desc) u where not u.coincide)) order by z.fecha desc)
          from (select * from r order by fecha desc limit 500) z
          left join orden_locales ld on ld.id = z.destino_local_id
          left join orden_locales lo on lo.id = z.origen_local_id
          left join pos_depositos dpo on dpo.id = z.origen_deposito_id
          left join pos_depositos dpd on dpd.id = z.destino_deposito_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'remitos', count(*) filter (where r.estado <> 'anulado'),
                    'pendientes', count(*) filter (where r.estado = 'pendiente'),
                    'con_diferencias', count(*) filter (where r.estado = 'con_diferencias'),
                    'anulados', count(*) filter (where r.estado = 'anulado'),
                    'unidades', coalesce((select sum(i.cantidad) from pos_remito_items i join r y on y.id = i.remito_id
                                           where y.estado <> 'anulado' and y.origen_local_id is distinct from y.destino_local_id), 0),
                    'monto', coalesce((select sum(i.cantidad * i.precio) from pos_remito_items i join r y on y.id = i.remito_id
                                        where y.estado <> 'anulado' and y.origen_local_id is distinct from y.destino_local_id), 0))
                    from r where r.origen_local_id is distinct from r.destino_local_id),
      'mas', (select count(*) > 500 from r)
    )
  );
  /* SQL 190: sin «Ver precios», sin montos; el que recibe no ve cuántas unidades vienen hasta contarlas. */
  if not pos_puede('precios') then
    v_res := jsonb_set(v_res, '{filas}', coalesce((select jsonb_agg(e || jsonb_build_object('total', null, 'sin_precio', null) order by o)
                                                     from jsonb_array_elements(v_res->'filas') with ordinality t(e, o)), '[]'::jsonb));
    v_res := jsonb_set(v_res, '{totales,monto}', 'null'::jsonb);
  end if;
  if not pos_puede('gestion') then
    v_res := jsonb_set(v_res, '{filas}', coalesce((select jsonb_agg(case when e->>'estado' = 'pendiente' and e->>'destino_local_id' is not null
                                                                      and not pos_local_mio((e->>'origen_local_id')::uuid)
                                                                 then e || jsonb_build_object('unidades', null, 'contadas', null, 'total', null) else e end order by o)
                                                     from jsonb_array_elements(v_res->'filas') with ordinality t(e, o)), '[]'::jsonb));
    v_res := jsonb_set(v_res, '{totales,unidades}', 'null'::jsonb);
  end if;
  return v_res;
end $$;

/* Un remito, producto por producto. A CIEGAS: de lo que todavía no se recibió
   van el talle y el color, pero no cuántas mandaron (se ve al comparar). Con
   p_completo (Gestión, la oficina), todo. SQL 167: quién lo recibió, qué pasó
   y cada diferencia con cómo se resolvió. SQL 189: el precio y la razón de
   cada producto y el total; y una devolución a la fábrica (sin destino) va
   siempre entera: nadie la cuenta a ciegas, y el local que la mandó la ve.
   SQL 193: los nombres de los depósitos y los testigos; el pase entre
   depósitos del local también va entero (nadie lo recibe a ciegas). */
create or replace function pos_remito(p_id uuid, p_completo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_o uuid; v_d uuid; v_completo boolean := coalesce(p_completo, false);
begin
  perform pos_permiso();
  /* SQL 190: de un local suyo; las cantidades, al que lo manda (el que lo recibe, a ciegas). */
  if not pos_puede('gestion') then
    select x.origen_local_id, x.destino_local_id into v_o, v_d from pos_remitos x where x.id = p_id;
    if found and not (pos_local_mio(v_o) or pos_local_mio(v_d)) then perform pos_local_ok(coalesce(v_d, v_o)); end if;
    v_completo := v_completo and pos_local_mio(v_o);
  end if;
  select to_jsonb(x) - 'clave' || jsonb_build_object(
           'origen', coalesce(lo.nombre, 'Fábrica'), 'destino', coalesce(ld.nombre, 'Fábrica'),
           'anulado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = x.anulado_por),
           /* SQL 193 */
           'entre_depositos', coalesce(x.origen_local_id = x.destino_local_id, false),
           'origen_deposito', (select d.nombre from pos_depositos d where d.id = x.origen_deposito_id),
           'destino_deposito', (select d.nombre from pos_depositos d where d.id = x.destino_deposito_id),
           'testigos', coalesce((select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'contado', t.contado, 'en_envio', t.en_envio, 'coincide', t.coincide,
                                                                     'fecha', t.fecha, 'quien', coalesce(t.quien, t.persona_nombre)) order by t.id)
                                   from pos_remito_testigos t where t.remito_id = x.id), '[]'::jsonb),
           'total', (select sum(i.cantidad * i.precio) from pos_remito_items i where i.remito_id = x.id),
           'productos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'codigo', g.codigo, 'descripcion', g.descripcion, 'precio', g.precio, 'razon', g.razon,
                      'estado', k.estado, 'recibido_en', k.recibido_en, 'recibido_nombre', coalesce(k.recibio, k.recibido_nombre),
                      'observaciones', k.observaciones, 'motivo', k.motivo,
                      'diferencias', (select jsonb_agg(jsonb_build_object('id', d.id, 'talle', d.talle, 'color', d.color, 'cantidad', d.cantidad,
                                                                          'contado', d.contado, 'estado', d.estado, 'resolucion', d.resolucion, 'nota', d.nota,
                                                                          'resuelta_en', d.resuelta_en, 'resuelta_nombre', d.resuelta_nombre,
                                                                          'remito_nuevo_numero', rn.numero) order by d.color, d.talle)
                                        from pos_remito_diferencias d left join pos_remitos rn on rn.id = d.remito_nuevo_id
                                       where d.remito_id = x.id and d.codigo = g.codigo),
                      'conteos', (select count(*) from pos_remito_conteos c where c.remito_id = x.id and c.codigo = g.codigo),
                      'celdas', (select jsonb_agg(case when k.codigo is not null or x.estado = 'anulado' or v_completo
                                                            or x.destino_local_id is null or x.origen_local_id = x.destino_local_id
                                                       then jsonb_build_object('talle', i.talle, 'color', i.color, 'cantidad', i.cantidad, 'contado', i.contado)
                                                       else jsonb_build_object('talle', i.talle, 'color', i.color) end
                                                  order by i.color, i.talle)
                                   from pos_remito_items i where i.remito_id = x.id and i.codigo = g.codigo))
                    order by g.orden, g.codigo)
               from (select i.codigo, max(i.descripcion) descripcion, min(i.orden) orden, max(i.precio) precio, max(i.razon) razon
                       from pos_remito_items i where i.remito_id = x.id group by i.codigo) g
               left join pos_remito_productos k on k.remito_id = x.id and k.codigo = g.codigo), '[]'::jsonb))
    into r
    from pos_remitos x
    left join orden_locales ld on ld.id = x.destino_local_id
    left join orden_locales lo on lo.id = x.origen_local_id
   where x.id = p_id;
  if r is null then raise exception 'No existe ese remito.'; end if;
  if not pos_puede('precios') then
    r := r || jsonb_build_object('total', null, 'productos', coalesce((select jsonb_agg(e || jsonb_build_object('precio', null) order by o)
                                                                          from jsonb_array_elements(r->'productos') with ordinality t(e, o)), '[]'::jsonb));
  end if;
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
  perform pos_local_ok(r.destino_local_id);   -- SQL 190
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
  perform pos_local_ok(r.destino_local_id);   -- SQL 190
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
   las diferencias del remito anulado dejan de contar.
   SQL 193: cada cosa vuelve al depósito de donde salió (o sale del que entró).
   Un pase entre depósitos del local lo anula el local con su permiso aunque
   esté recibido: es para rehacer el módulo. SQL 222: el del stock general en
   curso lo anula (lo rehace) cualquiera del local. */
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
  /* SQL 190: en el local, sólo sus envíos y devoluciones, con el permiso, mientras nadie empezó a recibirlos. Lo demás, la oficina. */
  if not pos_puede('gestion') then
    /* SQL 222: rehacer un módulo del stock general en curso lo hace cualquiera del local. */
    if not (r.origen_local_id = r.destino_local_id and pos_stock_general_es_(r.origen_local_id, r.destino_deposito_id)) then perform pos_permiso('envios'); end if;
    if r.origen_local_id is null then raise exception 'Los remitos de la fábrica los anula la oficina.' using errcode = '42501'; end if;
    perform pos_local_ok(r.origen_local_id);
    if r.origen_local_id is distinct from r.destino_local_id   -- SQL 193
       and (r.estado <> 'pendiente' or exists (select 1 from pos_remito_productos k where k.remito_id = p_id)
            or exists (select 1 from pos_remito_conteos k where k.remito_id = p_id)) then
      raise exception 'Ya lo empezaron a recibir: ahora lo anula la oficina.' using errcode = '42501';
    end if;
  end if;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo in ('remito', 'envio') order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, m.tipo || '_anulado', p_id, m.ref || ' (anulado)',
                            null, null, null, m.deposito_id);   -- SQL 193
  end loop;
  update pos_remitos set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  update pos_remito_diferencias
     set estado = 'pendiente', resolucion = null, nota = null, resuelta_en = null, resuelta_por = null, resuelta_nombre = null, remito_nuevo_id = null
   where remito_nuevo_id = p_id;
  return true;
end $$;

revoke all on function pos_stock_mover(uuid, text, text, text, int, text, uuid, text, text, text, text, uuid),   -- SQL 193: con el depósito
                       pos_remito_conteo_limpio(jsonb),
                       pos_remito_entrar(pos_remitos, text, jsonb, text, text, text, text, text)
       from public, anon, authenticated;
revoke all on function pos_stock_local(uuid, uuid), pos_stock_consulta(uuid, text[], text, boolean, boolean, int, int, boolean, uuid),
                       pos_stock_variante(uuid, text, text, text, uuid), pos_stock_ajustar(jsonb), pos_inventario_cargar(jsonb),
                       pos_inventarios(uuid), pos_remito_guardar(jsonb), pos_remitos(date, date, uuid, text), pos_remito(uuid, boolean),
                       pos_remito_contar(uuid, text, jsonb, text), pos_remito_recibir(uuid, text, jsonb, text, text, text, text), pos_remito_anular(uuid, text)
       from public, anon;
grant execute on function pos_stock_local(uuid, uuid), pos_stock_consulta(uuid, text[], text, boolean, boolean, int, int, boolean, uuid),
                          pos_stock_variante(uuid, text, text, text, uuid), pos_stock_ajustar(jsonb), pos_inventario_cargar(jsonb),
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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
  perform pos_local_ok(v_local);   -- SQL 190
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
  perform pos_local_ok(p_local);   -- SQL 190
  perform pos_dias_ok(p_desde);
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
  perform pos_permiso('anular');   -- SQL 190
  perform pos_local_ok(f.local_id) from pos_fallidas f where f.id = p_id;
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

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 190 (28/10/2026) · LOS PERMISOS DEL POS EN CONFIG → USUARIOS
--  (pos_permiso y los ayudantes están arriba, donde estaba pos_permiso)
-- ═══════════════════════════════════════════════════════════════════════════

/* Config → Usuarios: lo que puede cada persona en el POS y lo que trae cada rol. Sólo Administración. */
create or replace function pos_permisos_lista() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios'];
begin
  if not orden_es_admin() then raise exception 'Los permisos del POS los maneja Administración.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then true
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $$;

/* Guarda las casillas de una persona. Se guarda sólo lo distinto de lo de su rol: si después le
   cambian el rol, lo demás sigue al rol nuevo. Al administrador no se le cambia nada (tiene todo). */
create or replace function pos_permisos_guardar(p_persona uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios'];
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() then raise exception 'Los permisos del POS los maneja Administración.' using errcode = '42501'; end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if q.rol = 'admin' then raise exception 'El administrador tiene todo el POS: no se le cambia nada.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $$;

/* La persona que entró (la de la base: SQL 135 y 141), más 'pos' (SQL 190): si usa el POS, la barra lo muestra. */
create or replace function nc_yo() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 190: si usa el POS (lo prende la oficina en Config → Usuarios). */
           'pos', pos_puede_persona(p, 'usa'),
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$$;

revoke all on function pos_permiso_del_rol(text, boolean, text), pos_puede_persona(orden_personas, text), pos_puede(text),
                       pos_permiso(text), pos_local_mio(uuid), pos_local_ok(uuid), pos_dias_ok(date), pos_mis_permisos()
       from public, anon, authenticated;
revoke all on function pos_permisos_lista(), pos_permisos_guardar(uuid, jsonb) from public, anon;
grant execute on function pos_permisos_lista(), pos_permisos_guardar(uuid, jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 192 (29/10/2026) · LAS VENTAS POR VENDEDOR
-- ═══════════════════════════════════════════════════════════════════════════

/* Las "Ventas por Vendedor" de BlueSoft: por vendedor (Neto, Descuentos, Total, productos y ventas; los promedios los
   saca la pantalla) y, en 'por', lo mismo repartido por hora ('09'), por día ('2026-10-29'), por semana (el lunes) y por
   mes ('2026-10'). Sólo las ventas cobradas, como los totales de Tickets. Las de verdad y las de prueba no se mezclan
   nunca: p_prueba elige cuáles. */
create or replace function pos_ventas_vendedor(p_desde date, p_hasta date, p_local uuid default null, p_vendedor text default null,
                                               p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with v as (
      select x.vendedor, x.neto, x.descuentos, x.total, x.cantidad,
             lpad(extract(hour from x.fecha at time zone 'America/Argentina/Buenos_Aires')::int::text, 2, '0') hora,
             x.dia::text dia,
             (x.dia - (extract(isodow from x.dia)::int - 1))::text semana,
             to_char(x.dia, 'YYYY-MM') mes
        from pos_ventas x
       where x.dia between p_desde and p_hasta
         and x.prueba = coalesce(p_prueba, false)
         and x.estado = 'cobrada'
         and (p_local is null or x.local_id = p_local)
         and (p_vendedor is null or lower(x.vendedor) = lower(p_vendedor))
    ),
    b as (
      select v.vendedor, k.por, k.k, v.total, v.cantidad
        from v cross join lateral (values ('hora', v.hora), ('dia', v.dia), ('semana', v.semana), ('mes', v.mes)) k(por, k)
    )
    select jsonb_build_object(
      'vendedores', coalesce((
        select jsonb_agg(jsonb_build_object('vendedor', z.vendedor, 'neto', z.neto, 'descuentos', z.descuentos, 'total', z.total,
                                            'productos', z.productos, 'ventas', z.ventas) order by z.total desc, z.vendedor)
          from (select vendedor, sum(neto) neto, sum(descuentos) descuentos, sum(total) total, sum(cantidad) productos, count(*) ventas
                  from v group by vendedor) z), '[]'::jsonb),
      'por', coalesce((
        select jsonb_object_agg(y.por, y.filas)
          from (select z.por, jsonb_agg(jsonb_build_object('vendedor', z.vendedor, 'k', z.k, 'total', z.total, 'productos', z.productos,
                                                           'ventas', z.ventas) order by z.k, z.vendedor) filas
                  from (select por, vendedor, k, sum(total) total, sum(cantidad) productos, count(*) ventas from b group by por, vendedor, k) z
                 group by z.por) y), '{}'::jsonb),
      'totales', (select jsonb_build_object('ventas', count(*), 'productos', coalesce(sum(cantidad), 0), 'neto', coalesce(sum(neto), 0),
                                            'descuentos', coalesce(sum(descuentos), 0), 'total', coalesce(sum(total), 0)) from v)
    )
  );
end $$;

revoke all on function pos_ventas_vendedor(date, date, uuid, text, boolean) from public, anon;
grant execute on function pos_ventas_vendedor(date, date, uuid, text, boolean) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 193 (29/10/2026) · LOS DEPÓSITOS
--
--  Mauricio (29/10): "en envíos internos lo usamos para cuando tenemos que
--  hacer un stock de todo el local. Lo hacemos cada seis meses, creamos un
--  depósito nuevo en depósitos… Depósito origen es el depósito de la
--  temporada anterior y el depósito actual es el nuevo que creamos. Lo
--  identificamos por temporada y por año… Una vez cargado, en Tickets se
--  cambia el depósito a nuevo y listo. Cada ticket, cada venta, se empieza a
--  descontar del nuevo." Y el instructivo "Proceso de inventario" (el manual
--  del sistema): un envío interno por módulo, con el módulo y el responsable
--  en Observaciones; dos productos testigo por módulo con el supervisor (si
--  no coincide, se rehace el módulo); el depósito nuevo, predeterminado.
--
--  · pos_depositos: los de cada local, como la pantalla "Depósitos" de
--    BlueSoft (Código, Descripción, Sucursal, «Considerar para consulta de
--    stock», «Activo» y «Predeterminar»). Lo de BlueSoft para la tienda
--    online ("Subir stock") y los rollos de tela no van.
--  · El stock (pos_stock) y sus movimientos (pos_stock_movs) pasan a ser por
--    depósito. Cada local arranca con "Principal", predeterminado, con todo
--    lo que tiene hoy: para el que no hace nada, todo sigue igual.
--  · El predeterminado es uno por local (no por usuario, como en BlueSoft):
--    al predeterminar el nuevo, toda la sucursal vende de ahí.
--  · El pase entre depósitos es un remito de la sucursal a sí misma, con los
--    dos depósitos (pos_remitos.origen_deposito_id y destino_deposito_id), el
--    módulo y el responsable. Pasa en el momento y queda recibido.
--  · pos_remito_testigos: cada producto testigo que se contó en un módulo,
--    contra lo que dice su envío.
--  Vender mientras se pasa la ropa: la venta descuenta del predeterminado (el
--  de antes) hasta que se predetermina el nuevo, como en BlueSoft.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists pos_depositos (
  id                 uuid primary key default gen_random_uuid(),
  numero             int not null unique,                 -- el "Código" de BlueSoft: correlativo, de todos los locales juntos
  local_id           uuid not null references orden_locales(id),
  nombre             text not null check (length(nombre) between 1 and 40),
  temporada          text check (temporada in ('Verano', 'Invierno')),
  anio               int check (anio between 2000 and 2100),
  consulta           boolean not null default true,        -- «Considerar para consulta de stock»
  activo             boolean not null default true,
  predeterminado     boolean not null default false,       -- de acá descuentan las ventas (uno por local)
  predeterminado_en  timestamptz,
  creado_en          timestamptz not null default now(),
  creado_por         uuid,
  creado_nombre      text,
  unique (id, local_id),
  check (not predeterminado or activo),
  check ((temporada is null) = (anio is null))
);
create unique index if not exists pos_depositos_nombre on pos_depositos (local_id, lower(nombre));
create unique index if not exists pos_depositos_uno on pos_depositos (local_id) where predeterminado;
alter table pos_depositos enable row level security;
revoke all on pos_depositos from anon, authenticated;

/* Cada local arranca con uno, "Principal", predeterminado: ahí queda todo lo que tiene hoy. */
insert into pos_depositos (numero, local_id, nombre, predeterminado, predeterminado_en)
select coalesce((select max(numero) from pos_depositos), 0) + row_number() over (order by l.nombre, l.id), l.id, 'Principal', true, now()
  from orden_locales l
 where not exists (select 1 from pos_depositos d where d.local_id = l.id);

/* El stock, por depósito: la clave pasa a ser el depósito (antes, el local). */
alter table pos_stock add column if not exists deposito_id uuid;
update pos_stock s set deposito_id = d.id from pos_depositos d where d.local_id = s.local_id and d.predeterminado and s.deposito_id is null;
alter table pos_stock alter column deposito_id set not null;
alter table pos_stock_movs add column if not exists deposito_id uuid;
update pos_stock_movs m set deposito_id = d.id from pos_depositos d where d.local_id = m.local_id and d.predeterminado and m.deposito_id is null;
alter table pos_stock_movs alter column deposito_id set not null;
do $$
begin
  if pg_get_constraintdef((select c.oid from pg_constraint c where c.conname = 'pos_stock_pkey' and c.conrelid = 'pos_stock'::regclass)) not like '%deposito_id%' then
    alter table pos_stock drop constraint pos_stock_pkey;
    alter table pos_stock add constraint pos_stock_pkey primary key (deposito_id, codigo, talle, color);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pos_stock_deposito_fkey') then
    alter table pos_stock add constraint pos_stock_deposito_fkey foreign key (deposito_id, local_id) references pos_depositos (id, local_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pos_stock_movs_deposito_fkey') then
    alter table pos_stock_movs add constraint pos_stock_movs_deposito_fkey foreign key (deposito_id, local_id) references pos_depositos (id, local_id);
  end if;
end $$;
create index if not exists pos_stock_local on pos_stock (local_id, codigo);
create index if not exists pos_stock_movs_deposito on pos_stock_movs (deposito_id, codigo, talle, color, fecha desc);

/* Los remitos: de qué depósito sale y, entre depósitos del local, a cuál llega, con el módulo y el responsable.
   Un remito de la sucursal a sí misma sólo si es entre dos depósitos distintos. */
alter table pos_remitos add column if not exists origen_deposito_id uuid references pos_depositos(id);
alter table pos_remitos add column if not exists destino_deposito_id uuid references pos_depositos(id);
alter table pos_remitos add column if not exists modulo text check (length(modulo) <= 20);
alter table pos_remitos add column if not exists responsable text check (length(responsable) <= 60);
alter table pos_remitos drop constraint if exists pos_remitos_check;
alter table pos_remitos add constraint pos_remitos_check
  check (origen_local_id is null or origen_local_id <> destino_local_id
         or (origen_deposito_id is not null and destino_deposito_id is not null and origen_deposito_id <> destino_deposito_id));

/* El inventario: en qué depósito se cargó. */
alter table pos_inventarios add column if not exists deposito_id uuid references pos_depositos(id);
update pos_inventarios i set deposito_id = d.id from pos_depositos d where d.local_id = i.local_id and d.predeterminado and i.deposito_id is null;

/* Los productos testigo de cada módulo: lo que contó el supervisor contra lo que dice el envío de ese módulo. */
create table if not exists pos_remito_testigos (
  id              bigserial primary key,
  remito_id       uuid not null references pos_remitos(id) on delete cascade,
  codigo          text not null,
  contado         int not null check (contado between 0 and 9999),
  en_envio        int not null,
  coincide        boolean not null,
  fecha           timestamptz not null default clock_timestamp(),
  persona         uuid,
  persona_nombre  text,
  quien           text                                  -- quién lo controló (la compu es compartida)
);
create index if not exists pos_remito_testigos_remito on pos_remito_testigos (remito_id, codigo, id);
alter table pos_remito_testigos enable row level security;
revoke all on pos_remito_testigos from anon, authenticated;
revoke all on sequence pos_remito_testigos_id_seq from anon, authenticated;

/* El depósito predeterminado de un local (de ahí descuentan las ventas). Un
   local nuevo, sin ninguno, estrena "Principal". Es para las otras funciones. */
create or replace function pos_deposito_de(p_local uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v uuid;
begin
  if p_local is null then return null; end if;
  select id into v from pos_depositos where local_id = p_local and predeterminado;
  if v is null then
    perform pg_advisory_xact_lock(hashtext('pos_deposito'));
    select id into v from pos_depositos where local_id = p_local and predeterminado;
    if v is null then
      if exists (select 1 from pos_depositos where local_id = p_local) then
        raise exception 'La sucursal no tiene depósito predeterminado: elegilo en Depósitos.';
      end if;
      insert into pos_depositos (numero, local_id, nombre, predeterminado, predeterminado_en)
      values ((select coalesce(max(numero), 0) + 1 from pos_depositos), p_local, 'Principal', true, now())
      returning id into v;
    end if;
  end if;
  return v;
end $$;

/* Los depósitos (la lista de BlueSoft): los de una sucursal o, sin ella, los
   de todas las que puede ver. Con cuántas unidades tiene cada uno y si ya se
   usó (el que nunca se usó se puede borrar). */
create or replace function pos_depositos(p_local uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_local is not null then perform pos_local_ok(p_local); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'numero', d.numero, 'local_id', d.local_id, 'local', l.nombre, 'nombre', d.nombre,
             'temporada', d.temporada, 'anio', d.anio, 'consulta', d.consulta, 'activo', d.activo,
             'predeterminado', d.predeterminado, 'predeterminado_en', d.predeterminado_en,
             'creado_en', d.creado_en, 'creado_nombre', d.creado_nombre,
             'unidades', coalesce(t.unidades, 0), 'renglones', coalesce(t.renglones, 0), 'negativos', coalesce(t.negativos, 0),
             'usado', exists (select 1 from pos_stock_movs m where m.deposito_id = d.id)
                      or exists (select 1 from pos_remitos r where r.origen_deposito_id = d.id or r.destino_deposito_id = d.id)
                      or exists (select 1 from pos_inventarios i where i.deposito_id = d.id))
           order by l.nombre, d.predeterminado desc, d.activo desc, d.numero)
      from pos_depositos d
      join orden_locales l on l.id = d.local_id
      left join lateral (select sum(s.cantidad)::int unidades, (count(*) filter (where s.cantidad <> 0))::int renglones,
                                (count(*) filter (where s.cantidad < 0))::int negativos
                           from pos_stock s where s.deposito_id = d.id) t on true
     where case when p_local is null then pos_local_mio(d.local_id) else d.local_id = p_local end), '[]'::jsonb);
end $$;

/* Uno nuevo o cambiar uno. De temporada: la temporada (Verano o Invierno) y el
   año arman el nombre ("Verano 2027"); si no, el nombre ("Fallas"). La
   sucursal no se cambia. El predeterminado no se desactiva. Con el permiso de
   los envíos internos (encargados y supervisores). */
create or replace function pos_deposito_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id      uuid := nullif(p->>'id', '')::uuid;
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_temp    text := nullif(trim(coalesce(p->>'temporada', '')), '');
  v_anio    int;
  v_nombre  text := nullif(regexp_replace(trim(coalesce(p->>'nombre', '')), '\s+', ' ', 'g'), '');
  v_cons    boolean := coalesce(nullif(p->>'consulta', '')::boolean, true);
  v_activo  boolean := coalesce(nullif(p->>'activo', '')::boolean, true);
  d         pos_depositos;
begin
  perform pos_permiso('envios');
  if v_id is not null then
    select * into d from pos_depositos where id = v_id for update;
    if not found then raise exception 'No existe ese depósito.'; end if;
    v_local := d.local_id;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then raise exception 'Elegí la sucursal.'; end if;
  perform pos_local_ok(v_local);
  if v_temp is not null then
    if v_temp not in ('Verano', 'Invierno') then raise exception 'La temporada es Verano o Invierno.'; end if;
    if coalesce(p->>'anio', '') !~ '^[0-9]{4}$' or (p->>'anio')::int not between 2000 and 2100 then
      raise exception 'Escribí el año (por ejemplo, 2027).';
    end if;
    v_anio := (p->>'anio')::int;
    v_nombre := v_temp || ' ' || v_anio;
  end if;
  if v_nombre is null then raise exception 'Escribí el nombre del depósito.'; end if;
  if length(v_nombre) > 40 then raise exception 'El nombre es demasiado largo (hasta 40 letras).'; end if;
  if exists (select 1 from pos_depositos x where x.local_id = v_local and lower(x.nombre) = lower(v_nombre) and x.id is distinct from v_id) then
    raise exception '% ya tiene el depósito «%».', (select l.nombre from orden_locales l where l.id = v_local), v_nombre;
  end if;
  if v_id is not null and d.predeterminado and not v_activo then
    raise exception 'Es el depósito predeterminado: para desactivarlo, primero predeterminá otro.';
  end if;
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('pos_deposito'));
    insert into pos_depositos (numero, local_id, nombre, temporada, anio, consulta, activo, creado_por, creado_nombre)
    values ((select coalesce(max(numero), 0) + 1 from pos_depositos), v_local, v_nombre, v_temp, v_anio, v_cons, v_activo,
            orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
    returning * into d;
  else
    update pos_depositos set nombre = v_nombre, temporada = v_temp, anio = v_anio, consulta = v_cons or predeterminado, activo = v_activo
     where id = v_id returning * into d;
  end if;
  return jsonb_build_object('id', d.id, 'numero', d.numero, 'nombre', d.nombre, 'nuevo', v_id is null);
end $$;

/* «Predeterminar»: desde ahora la sucursal vende de este depósito (las ventas y
   los cambios), y ahí entran los remitos. p_sacar_viejo: el de antes deja de
   contar para la consulta de stock (lo que quedó ahí es lo que no se encontró). */
create or replace function pos_deposito_predeterminar(p_id uuid, p_sacar_viejo boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare d pos_depositos; v pos_depositos;
begin
  perform pos_permiso('envios');
  select * into d from pos_depositos where id = p_id for update;
  if not found then raise exception 'No existe ese depósito.'; end if;
  perform pos_local_ok(d.local_id);
  if not d.activo then raise exception 'El depósito está inactivo: activalo primero.'; end if;
  if d.predeterminado then raise exception 'Ya es el predeterminado.'; end if;
  select * into v from pos_depositos where local_id = d.local_id and predeterminado for update;
  update pos_depositos set predeterminado = false, consulta = consulta and not coalesce(p_sacar_viejo, false) where id = v.id;
  update pos_depositos set predeterminado = true, predeterminado_en = now(), consulta = true where id = d.id;
  return jsonb_build_object('nombre', d.nombre, 'anterior', v.nombre,
                            'quedaron', (select coalesce(sum(s.cantidad), 0) from pos_stock s where s.deposito_id = v.id));
end $$;

/* Borrar un depósito que nunca se usó (si ya tuvo algo, se desactiva). */
create or replace function pos_deposito_borrar(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare d pos_depositos;
begin
  perform pos_permiso('envios');
  select * into d from pos_depositos where id = p_id for update;
  if not found then raise exception 'No existe ese depósito.'; end if;
  perform pos_local_ok(d.local_id);
  if d.predeterminado then raise exception 'Es el depósito predeterminado: no se puede borrar.'; end if;
  if exists (select 1 from pos_stock where deposito_id = p_id) or exists (select 1 from pos_stock_movs where deposito_id = p_id)
     or exists (select 1 from pos_remitos where origen_deposito_id = p_id or destino_deposito_id = p_id)
     or exists (select 1 from pos_inventarios where deposito_id = p_id) then
    raise exception 'Ya tuvo mercadería: no se puede borrar. Si no se usa más, sacale «Activo».';
  end if;
  delete from pos_depositos where id = p_id;
  return true;
end $$;

/* Un producto testigo de un módulo: cuántas prendas de ese producto hay en el
   módulo (contadas por el supervisor) contra las que dice el envío del
   módulo. Si no coincide, el módulo se rehace (se anula el envío y se hace de
   nuevo). Cada vez queda anotada. SQL 222: los del stock general en curso los
   cuenta cualquiera del local; los demás, con el permiso de los envíos. */
create or replace function pos_remito_testigo(p_remito uuid, p_codigo text, p_contado int, p_quien text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r     pos_remitos;
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_q   text := nullif(trim(coalesce(p_quien, '')), '');
  v_en  int;
begin
  perform pos_permiso();   -- SQL 222: el de los envíos, más abajo (el stock general no lo pide)
  if v_c = '' or length(v_c) > 30 then raise exception 'Falta el producto testigo.'; end if;
  if p_contado is null or p_contado < 0 or p_contado > 9999 then raise exception 'Escribí cuántas contaste (de 0 a 9999).'; end if;
  if length(v_q) > 60 then raise exception 'El nombre es demasiado largo.'; end if;
  select * into r from pos_remitos where id = p_remito;
  if not found then raise exception 'No existe ese envío.'; end if;
  if r.origen_local_id is distinct from r.destino_local_id then raise exception 'Los testigos son para los envíos entre depósitos de la sucursal.'; end if;
  perform pos_local_ok(r.origen_local_id);
  if not pos_stock_general_es_(r.origen_local_id, r.destino_deposito_id) then perform pos_permiso('envios'); end if;   -- SQL 222
  if r.estado = 'anulado' then raise exception 'Ese envío está anulado.'; end if;
  select coalesce(sum(cantidad), 0)::int into v_en from pos_remito_items where remito_id = p_remito and codigo = v_c;
  if v_en = 0 and p_contado = 0 then raise exception 'Ese producto no está en el envío. Si está en el módulo, escribí cuántas hay.'; end if;
  insert into pos_remito_testigos (remito_id, codigo, contado, en_envio, coincide, persona, persona_nombre, quien)
  values (p_remito, v_c, p_contado, v_en, v_en = p_contado, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_q);
  return jsonb_build_object('codigo', v_c, 'contado', p_contado, 'en_envio', v_en, 'coincide', v_en = p_contado,
                            'testigos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'contado', t.contado, 'en_envio', t.en_envio,
                                                                             'coincide', t.coincide, 'fecha', t.fecha, 'quien', coalesce(t.quien, t.persona_nombre)) order by t.id)
                                           from pos_remito_testigos t where t.remito_id = p_remito));
end $$;

revoke all on function pos_deposito_de(uuid) from public, anon, authenticated;
revoke all on function pos_depositos(uuid), pos_deposito_guardar(jsonb), pos_deposito_predeterminar(uuid, boolean), pos_deposito_borrar(uuid),
                       pos_remito_testigo(uuid, text, int, text)
       from public, anon;
grant execute on function pos_depositos(uuid), pos_deposito_guardar(jsonb), pos_deposito_predeterminar(uuid, boolean), pos_deposito_borrar(uuid),
                          pos_remito_testigo(uuid, text, int, text)
       to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 195 (29/10/2026) · LA DISPONIBILIDAD DE LAS CAJAS
--
--  La "Disponibilidad de Cajas" de BlueSoft y, al tocar una caja, su
--  "Consulta de Valores" (Mauricio, 29/10: "cuando apretamos en una de las
--  cajas, nos despliega los movimientos que se hicieron… caja fuerte y caja
--  chica… se me despliega los movimientos de entradas y salidas").
--
--  Cada local tiene dos cajas:
--    · la chica: arranca con el saldo inicial del primer cierre; suma el
--      efectivo de las ventas y de los cambios y los otros ingresos; resta
--      los gastos, las otras salidas, lo que pasa a la caja fuerte y los
--      retiros de la caja chica. Cada cierre la deja en lo que contaron
--      (menos lo que pasaba a la caja fuerte al cerrar, hasta el SQL 180).
--      Es la misma cuenta del cierre de caja (pos_caja_abierta).
--    · la fuerte: suma lo que pasa de la caja chica (los movimientos de
--      salida, MS-) y resta los retiros de fondos de la caja fuerte (RF-).
--      Hasta que alguien la cuenta, arranca en $0: el «Ajustar» de BlueSoft
--      (pos_caja_ajustes, nueva) la deja en lo que contaron, y desde ahí
--      sigue sumando y restando.
--  Lo anulado no cuenta. Lo de prueba, tampoco: es sólo de verdad.
--  Todo esto es de la oficina (pos_permiso('gestion')).
-- ═══════════════════════════════════════════════════════════════════════════

/* Cada vez que la oficina cuenta la caja fuerte de un local: desde ahí, el saldo es lo que contaron.
   esperado = lo que decía el sistema en ese momento; diferencia = lo que se ajustó (positiva: sobraba). */
create table pos_caja_ajustes (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references orden_locales(id),
  caja            text not null default 'fuerte' check (caja = 'fuerte'),
  numero          int not null,
  fecha           timestamptz not null default clock_timestamp(),
  dia             date not null,
  esperado        numeric(14,2) not null,
  contado         numeric(14,2) not null check (contado >= 0 and contado < 1000000000),
  diferencia      numeric(14,2) generated always as (contado - esperado) stored,
  persona         uuid,
  persona_nombre  text,
  observaciones   text,
  estado          text not null default 'ok' check (estado in ('ok', 'anulado')),
  anulado_en      timestamptz,
  anulado_por     uuid,
  anulado_motivo  text,
  clave           text unique,
  unique (local_id, caja, numero)
);
create index pos_caja_ajustes_local on pos_caja_ajustes (local_id, caja, fecha);
alter table pos_caja_ajustes enable row level security;
revoke all on pos_caja_ajustes from anon, authenticated;

/* Todo lo que movió la plata de una caja, en orden. `control` (un cierre, un ajuste, el saldo inicial) deja el
   saldo en ese número; lo demás suma o resta `importe`. Es para las otras funciones. */
create or replace function pos_caja_eventos(p_local uuid, p_caja text)
returns table (fecha timestamptz, orden int, dia date, tipo text, ref text, detalle text, persona text, importe numeric, control numeric, ref_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_primero  pos_cierres;
  v_corte    timestamptz;
begin
  if p_caja = 'chica' then
    select * into v_primero from pos_cierres c
     where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' order by c.fecha limit 1;
    /* Las ventas cuentan desde el primer cierre, como en pos_caja_abierta (las de antes del POS no entran nunca). */
    v_corte := coalesce((select min(c.desde) from pos_cierres c where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'),
                        orden_en_hora(p_local, orden_dia_caja(p_local), '00:00'));
    if v_primero.id is not null then
      /* El saldo inicial del primer cierre, antes que todo (orden 0 gana los empates): un gasto cargado antes de ese día
         también entró en él. */
      return query select least(v_primero.desde, coalesce((select min(m.fecha) from pos_caja_movimientos m
                                                             where m.local_id = p_local and not m.prueba and coalesce(m.caja, 'chica') = 'chica'),
                                                          v_primero.desde)),
                          0, v_primero.dia, 'inicial'::text, 'Saldo inicial'::text,
                          ('Con lo que arrancó la caja en el cierre Nº ' || v_primero.numero)::text, v_primero.responsable_nombre,
                          null::numeric, v_primero.saldo_inicial, v_primero.id;
    end if;
    return query
      select x.fecha, 1, x.dia, 'venta'::text, case when x.letra = 'X' then 'X-' || x.numero else 'Nº ' || x.numero end,
             ('Venta · ' || x.vendedor)::text, null::text, sum(pg.monto), null::numeric, x.id
        from pos_ventas x join pos_venta_pagos pg on pg.venta_id = x.id and pg.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'cobrada' and x.fecha >= v_corte
       group by x.id
      union all
      select x.fecha, 1, x.dia, 'cambio'::text, 'C-' || x.numero, ('Cambio · ' || x.vendedor)::text, null::text, sum(pc.monto), null::numeric, x.id
        from pos_cambios x join pos_cambio_pagos pc on pc.cambio_id = x.id and pc.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'hecho' and x.fecha >= v_corte
       group by x.id
      union all
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' when 'retiro' then 'RF-' else 'G-' end || m.numero,
             case m.tipo when 'gasto' then 'Gasto · ' || coalesce(m.rubro, '')
                         when 'salida' then 'Otra salida' when 'ingreso' then 'Otro ingreso'
                         when 'caja_fuerte' then 'A la caja fuerte'
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end
               || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'ingreso' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok' and coalesce(m.caja, 'chica') = 'chica'
      union all
      select c.fecha, 2, c.dia, 'cierre'::text, 'Cierre Nº ' || c.numero, 'Cierre de caja'::text,
             c.responsable_nombre, null::numeric, c.contado, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'
      union all
      /* Hasta el SQL 180, lo de la caja fuerte se pasaba al cerrar. */
      select c.fecha, 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'A la caja fuerte, al cerrar'::text,
             c.responsable_nombre, -c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0;
  elsif p_caja = 'fuerte' then
    return query
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' else 'RF-' end || m.numero,
             case m.tipo when 'caja_fuerte' then 'De la caja chica'
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'caja_fuerte' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok'
         and (m.tipo = 'caja_fuerte' or (m.tipo = 'retiro' and m.caja = 'fuerte'))
      union all
      select c.fecha, 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'De la caja chica, al cerrar'::text,
             c.responsable_nombre, c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0
      union all
      select a.fecha, 2, a.dia, 'ajuste'::text, 'Ajuste Nº ' || a.numero, ('Ajuste' || coalesce(' · ' || a.observaciones, ''))::text,
             a.persona_nombre, null::numeric, a.contado, a.id
        from pos_caja_ajustes a
       where a.local_id = p_local and a.caja = 'fuerte' and a.estado = 'ok';
  else
    raise exception 'La caja tiene que ser la chica o la fuerte.';
  end if;
end $$;

/* Los movimientos con el saldo después de cada uno (el más viejo primero). En un control, `importe` es lo que
   cambió el saldo (lo contado menos lo que decía el sistema): así cada renglón es el anterior más su importe. */
create or replace function pos_caja_con_saldo(p_local uuid, p_caja text)
returns table (n bigint, fecha timestamptz, dia date, tipo text, ref text, detalle text, persona text, importe numeric, saldo numeric,
               es_control boolean, contado numeric, ref_id uuid)
language sql stable security definer set search_path = public as $$
  with e as (
    select x.*, row_number() over (order by x.fecha, x.orden, x.ref) n from pos_caja_eventos(p_local, p_caja) x
  ), g as (
    select e.*, count(e.control) over (order by e.n) grp from e
  ), s as (
    select g.*, coalesce(first_value(g.control) over (partition by g.grp order by g.n), 0)
                + coalesce(sum(g.importe) over (partition by g.grp order by g.n), 0) saldo
      from g
  )
  select s.n, s.fecha, s.dia, s.tipo, s.ref, s.detalle, s.persona,
         case when s.control is not null then s.control - coalesce(lag(s.saldo) over (order by s.n), 0) else s.importe end,
         s.saldo, s.control is not null, s.control, s.ref_id
    from s
$$;

/* El saldo de hoy de una caja y su último control (el último cierre de la chica, el último ajuste de la fuerte). */
create or replace function pos_caja_saldo(p_local uuid, p_caja text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'saldo', coalesce((select x.saldo from pos_caja_con_saldo(p_local, p_caja) x order by x.n desc limit 1), 0),
    'movimientos', (select count(*) from pos_caja_eventos(p_local, p_caja) x where x.tipo <> 'inicial'),
    'ultimo', case when p_caja = 'chica' then
                (select jsonb_build_object('tipo', 'cierre', 'id', c.id, 'numero', c.numero, 'fecha', c.fecha, 'contado', c.contado,
                                           'diferencia', -c.desvio, 'persona', c.responsable_nombre)
                   from pos_cierres c where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' order by c.fecha desc limit 1)
              else
                (select jsonb_build_object('tipo', 'ajuste', 'id', a.id, 'numero', a.numero, 'fecha', a.fecha, 'contado', a.contado,
                                           'diferencia', a.diferencia, 'persona', a.persona_nombre)
                   from pos_caja_ajustes a where a.local_id = p_local and a.caja = 'fuerte' and a.estado = 'ok' order by a.fecha desc limit 1)
              end)
$$;

/* La "Disponibilidad de Cajas" de BlueSoft: la caja chica y la caja fuerte de cada local que ya usa el POS (el que
   vendió, cerró, cargó un movimiento o tiene la caja fuerte contada), con lo que hay hoy según el sistema. */
create or replace function pos_disponibilidad() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  return (
    with l as (
      select o.id, o.nombre from orden_locales o
       where o.activo and o.id in (select x.local_id from pos_cierres x where not x.prueba
                                   union select x.local_id from pos_ventas x where not x.prueba
                                   union select x.local_id from pos_cambios x where not x.prueba
                                   union select x.local_id from pos_caja_movimientos x where not x.prueba
                                   union select x.local_id from pos_caja_ajustes x)
    ), c as (
      select l.id, l.nombre, k.caja, pos_caja_saldo(l.id, k.caja) d
        from l cross join (values ('chica'), ('fuerte')) k(caja)
    )
    select jsonb_build_object(
      'cajas', coalesce((select jsonb_agg(jsonb_build_object('local_id', c.id, 'local', c.nombre, 'caja', c.caja) || c.d
                                          order by c.nombre, c.caja) from c), '[]'::jsonb),
      'totales', jsonb_build_object(
        'chica', coalesce((select sum((c.d->>'saldo')::numeric) from c where c.caja = 'chica'), 0),
        'fuerte', coalesce((select sum((c.d->>'saldo')::numeric) from c where c.caja = 'fuerte'), 0)))
  );
end $$;

/* La "Consulta de Valores" de una caja: sus movimientos del período (el más nuevo primero) con el saldo después de
   cada uno, lo que entró y salió en el período, el saldo de hoy y el último control. */
create or replace function pos_caja_valores(p_local uuid, p_caja text, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  if p_local is null or not exists (select 1 from orden_locales where id = p_local) then raise exception 'Elegí la sucursal.'; end if;
  if p_caja is null or p_caja not in ('chica', 'fuerte') then raise exception 'La caja tiene que ser la chica o la fuerte.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with t as (select * from pos_caja_con_saldo(p_local, p_caja)),
    f as (select * from t where t.dia between p_desde and p_hasta)
    select pos_caja_saldo(p_local, p_caja) || jsonb_build_object(
      'local', (select o.nombre from orden_locales o where o.id = p_local),
      'filas', coalesce((select jsonb_agg(jsonb_build_object('fecha', z.fecha, 'tipo', z.tipo, 'ref', z.ref, 'detalle', z.detalle,
                                                             'persona', z.persona, 'importe', z.importe, 'saldo', z.saldo,
                                                             'control', z.es_control, 'contado', z.contado, 'id', z.ref_id) order by z.n desc)
                           from (select * from f order by n desc limit 1000) z), '[]'::jsonb),
      'mas', (select count(*) > 1000 from f),
      'entro', coalesce((select sum(f.importe) from f where not f.es_control and f.importe > 0), 0),
      'salio', coalesce((select -sum(f.importe) from f where not f.es_control and f.importe < 0), 0),
      'ajustado', coalesce((select sum(f.importe) from f where f.es_control and f.tipo <> 'inicial'), 0),
      'antes', coalesce((select t.saldo from t where t.dia < p_desde order by t.n desc limit 1), 0))
  );
end $$;

/* «Ajustar» la caja fuerte: la oficina la cuenta y escribe cuánto hay. Queda anotado lo que decía el sistema y la
   diferencia; desde ahí, el saldo es lo contado. Con la misma `clave` dos veces no se duplica. */
create or replace function pos_caja_ajustar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_local  uuid := nullif(p->>'local_id', '')::uuid;
  v_cont   numeric := round(nullif(p->>'contado', '')::numeric, 2);
  v_obs    text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_clave  text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_esp    numeric;
  v_num    int;
  a        pos_caja_ajustes;
begin
  perform pos_permiso('gestion');
  if v_clave is not null then
    select * into a from pos_caja_ajustes where clave = v_clave;
    if found then return jsonb_build_object('id', a.id, 'numero', a.numero, 'esperado', a.esperado, 'contado', a.contado, 'diferencia', a.diferencia, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then raise exception 'Elegí la sucursal.'; end if;
  if v_cont is null or v_cont < 0 or v_cont >= 1000000000 then raise exception 'Escribí cuánta plata hay en la caja fuerte.'; end if;
  if length(v_obs) > 200 then raise exception 'Las observaciones son demasiado largas.'; end if;
  /* Uno por vez en cada local: el número y lo que decía el sistema no se pisan. */
  perform pg_advisory_xact_lock(hashtext('pos_ajuste:' || v_local::text));
  if v_clave is not null then
    select * into a from pos_caja_ajustes where clave = v_clave;
    if found then return jsonb_build_object('id', a.id, 'numero', a.numero, 'esperado', a.esperado, 'contado', a.contado, 'diferencia', a.diferencia, 'ya', true); end if;
  end if;
  v_esp := (pos_caja_saldo(v_local, 'fuerte')->>'saldo')::numeric;
  select coalesce(max(x.numero), 0) + 1 into v_num from pos_caja_ajustes x where x.local_id = v_local and x.caja = 'fuerte';
  insert into pos_caja_ajustes (local_id, caja, numero, dia, esperado, contado, persona, persona_nombre, observaciones, clave)
  values (v_local, 'fuerte', v_num, orden_dia_caja(v_local), v_esp, v_cont, orden_yo_id(),
          (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_obs, v_clave)
  returning * into a;
  return jsonb_build_object('id', a.id, 'numero', a.numero, 'esperado', a.esperado, 'contado', a.contado, 'diferencia', a.diferencia, 'ya', false);
end $$;

/* Anular un ajuste (se cargó mal): sólo el último de esa caja. Queda anotado, con quién y por qué, y el saldo vuelve
   a contarse desde el ajuste anterior (o desde $0). */
create or replace function pos_caja_ajuste_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare a pos_caja_ajustes; d pos_caja_ajustes;
begin
  perform pos_permiso('gestion');
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into a from pos_caja_ajustes where id = p_id;
  if not found then raise exception 'No existe ese ajuste.'; end if;
  perform pg_advisory_xact_lock(hashtext('pos_ajuste:' || a.local_id::text));
  select * into a from pos_caja_ajustes where id = p_id for update;
  if a.estado = 'anulado' then raise exception 'Ese ajuste ya está anulado.'; end if;
  select * into d from pos_caja_ajustes y
   where y.local_id = a.local_id and y.caja = a.caja and y.estado = 'ok' and y.fecha > a.fecha order by y.fecha limit 1;
  if found then raise exception 'Sólo se puede anular el último ajuste de la caja: después vino el Nº %.', d.numero; end if;
  update pos_caja_ajustes set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  return true;
end $$;

revoke all on function pos_caja_eventos(uuid, text), pos_caja_con_saldo(uuid, text), pos_caja_saldo(uuid, text)
       from public, anon, authenticated;
revoke all on function pos_disponibilidad(), pos_caja_valores(uuid, text, date, date), pos_caja_ajustar(jsonb),
                       pos_caja_ajuste_anular(uuid, text) from public, anon;
grant execute on function pos_disponibilidad(), pos_caja_valores(uuid, text, date, date), pos_caja_ajustar(jsonb),
                          pos_caja_ajuste_anular(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 196 (29/10/2026) · LAS VENTAS POR PRODUCTOS
--
--  Las "Ventas por Productos" de BlueSoft, el "resumen de ventas" de los
--  locales (Mauricio, 29/10: "cuando hay producto testigo, vamos a resumen de
--  ventas, buscamos un producto y ahí me dice las ventas totales de ese
--  producto, qué día fue, de qué ticket fue, cuántas ventas, qué colores").
--  · pos_ventas_productos: cada producto vendido en el período, con la
--    cantidad, el total y en cuántas ventas; y lo mismo por talle y color
--    (el «Mostrar Talle/Color» de BlueSoft).
--  · pos_ventas_de_producto: las ventas de un producto, una por una (el día,
--    la sucursal, el ticket, el vendedor, el talle, el color y la cantidad),
--    y cuánto se vendió de cada talle y color.
--  Como Ventas por vendedor (SQL 192): sólo las ventas cobradas (las anuladas
--  y los cambios no cuentan), las de verdad y las de prueba nunca juntas, el
--  mostrador ve su local (y sin «Ver otros días», sólo hoy) y la oficina
--  todas. El total de cada renglón lleva su parte de los descuentos de la
--  venta: así los totales dan lo mismo que Tickets y Ventas por vendedor.
--  Un producto es su código; uno escrito a mano, sin código, va por su nombre.
-- ═══════════════════════════════════════════════════════════════════════════

/* Los renglones vendidos del período, con lo que cobró cada uno (su parte de los descuentos de la venta). p_buscar: el
   código empieza así, o el nombre tiene todas esas palabras (sin mirar acentos ni mayúsculas). Sin permiso de afuera:
   lo llaman las dos de abajo, después de mirar los permisos. */
create function pos_vp_renglones(p_desde date, p_hasta date, p_local uuid, p_vendedor text, p_buscar text, p_prueba boolean)
returns table (venta_id uuid, fecha timestamptz, dia date, local_id uuid, serie text, numero bigint, letra text, vendedor text,
               cliente text, socio text, clave text, codigo text, descripcion text, talle text, color text, cantidad int,
               precio numeric, cobrado numeric)
language sql stable security definer set search_path = public as $$
  with q as (select translate(lower(btrim(coalesce(p_buscar, ''))), 'áéíóúü', 'aeiouu') t)
  select v.id, v.fecha, v.dia, v.local_id, v.serie, v.numero, v.letra, v.vendedor, v.cliente_nombre, v.socio,
         coalesce(upper(nullif(btrim(i.codigo), '')), '~' || lower(btrim(i.descripcion))),
         upper(nullif(btrim(i.codigo), '')), i.descripcion, nullif(btrim(i.talle), ''), nullif(btrim(i.color), ''), i.cantidad, i.precio,
         case when v.neto > 0 then i.total * v.total / v.neto else 0 end
    from pos_ventas v
    join pos_venta_items i on i.venta_id = v.id
    cross join q
   where v.dia between p_desde and p_hasta
     and v.prueba = coalesce(p_prueba, false)
     and v.estado = 'cobrada'
     and (p_local is null or v.local_id = p_local)
     and (p_vendedor is null or lower(v.vendedor) = lower(p_vendedor))
     and (q.t = ''
          or position(q.t in lower(coalesce(i.codigo, ''))) = 1
          or not exists (select 1 from regexp_split_to_table(q.t, '\s+') w
                          where position(w in translate(lower(i.descripcion), 'áéíóúü', 'aeiouu')) = 0))
$$;

/* La lista: los productos (de más a menos vendidos), y por talle y color. Hasta 3.000 productos y 6.000 talles y colores
   ('mas' avisa que hay más: se achica con el período, la sucursal o el producto). */
create function pos_ventas_productos(p_desde date, p_hasta date, p_local uuid default null, p_vendedor text default null,
                                     p_buscar text default null, p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with r as (select * from pos_vp_renglones(p_desde, p_hasta, p_local, p_vendedor, p_buscar, p_prueba)),
    p as (select r.clave, max(r.codigo) codigo, max(r.descripcion) descripcion, sum(r.cantidad) cantidad, round(sum(r.cobrado), 2) total,
                 count(distinct r.venta_id) ventas, count(distinct r.local_id) sucursales, max(r.fecha) ultima
            from r group by r.clave),
    t as (select r.clave, max(r.codigo) codigo, max(r.descripcion) descripcion, r.talle, r.color, sum(r.cantidad) cantidad,
                 round(sum(r.cobrado), 2) total, count(distinct r.venta_id) ventas
            from r group by r.clave, r.talle, r.color)
    select jsonb_build_object(
      'productos', coalesce((select jsonb_agg(jsonb_build_object('clave', z.clave, 'codigo', z.codigo, 'descripcion', z.descripcion,
                                                                 'cantidad', z.cantidad, 'total', z.total, 'ventas', z.ventas,
                                                                 'sucursales', z.sucursales, 'ultima', z.ultima)
                                              order by z.cantidad desc, z.total desc, z.descripcion)
                               from (select * from p order by cantidad desc, total desc, descripcion limit 3000) z), '[]'::jsonb),
      'variantes', coalesce((select jsonb_agg(jsonb_build_object('clave', z.clave, 'codigo', z.codigo, 'descripcion', z.descripcion,
                                                                 'talle', z.talle, 'color', z.color, 'cantidad', z.cantidad,
                                                                 'total', z.total, 'ventas', z.ventas)
                                              order by z.cantidad desc, z.total desc, z.descripcion, z.talle, z.color)
                               from (select * from t order by cantidad desc, total desc, descripcion, talle, color limit 6000) z), '[]'::jsonb),
      'mas', (select count(*) > 3000 from p) or (select count(*) > 6000 from t),
      'totales', (select jsonb_build_object('cantidad', coalesce(sum(r.cantidad), 0), 'total', coalesce(round(sum(r.cobrado), 2), 0),
                                            'productos', count(distinct r.clave), 'ventas', count(distinct r.venta_id)) from r)
    )
  );
end $$;

/* Un producto (su clave, la de la lista): sus ventas una por una, de la más nueva a la más vieja (hasta 2.000), cuánto se
   vendió de cada talle y color, y en cada sucursal. */
create function pos_ventas_de_producto(p_clave text, p_desde date, p_hasta date, p_local uuid default null,
                                       p_vendedor text default null, p_prueba boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);
  perform pos_dias_ok(p_desde);
  if p_clave is null or btrim(p_clave) = '' then raise exception 'Elegí el producto.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with r as (select * from pos_vp_renglones(p_desde, p_hasta, p_local, p_vendedor, null, p_prueba) x where x.clave = p_clave)
    select jsonb_build_object(
      'producto', (select jsonb_build_object('clave', p_clave, 'codigo', max(r.codigo), 'descripcion', max(r.descripcion)) from r),
      'renglones', coalesce((select jsonb_agg(jsonb_build_object('venta_id', z.venta_id, 'fecha', z.fecha, 'dia', z.dia,
                                                                 'local_id', z.local_id, 'local', (select o.nombre from orden_locales o where o.id = z.local_id),
                                                                 'serie', z.serie, 'numero', z.numero, 'letra', z.letra, 'vendedor', z.vendedor,
                                                                 'cliente', z.cliente, 'socio', z.socio, 'talle', z.talle, 'color', z.color,
                                                                 'cantidad', z.cantidad, 'precio', z.precio, 'total', round(z.cobrado, 2))
                                              order by z.fecha desc, z.numero desc)
                               from (select * from r order by fecha desc, numero desc limit 2000) z), '[]'::jsonb),
      'mas', (select count(*) > 2000 from r),
      'variantes', coalesce((select jsonb_agg(jsonb_build_object('talle', z.talle, 'color', z.color, 'cantidad', z.cantidad, 'total', z.total)
                                              order by z.cantidad desc, z.talle, z.color)
                               from (select r.talle, r.color, sum(r.cantidad) cantidad, round(sum(r.cobrado), 2) total
                                       from r group by r.talle, r.color) z), '[]'::jsonb),
      'sucursales', coalesce((select jsonb_agg(jsonb_build_object('local_id', z.local_id, 'local', (select o.nombre from orden_locales o where o.id = z.local_id),
                                                                  'cantidad', z.cantidad, 'total', z.total, 'ventas', z.ventas)
                                               order by z.cantidad desc)
                                from (select r.local_id, sum(r.cantidad) cantidad, round(sum(r.cobrado), 2) total, count(distinct r.venta_id) ventas
                                        from r group by r.local_id) z), '[]'::jsonb),
      'totales', (select jsonb_build_object('cantidad', coalesce(sum(r.cantidad), 0), 'total', coalesce(round(sum(r.cobrado), 2), 0),
                                            'ventas', count(distinct r.venta_id), 'ultima', max(r.fecha)) from r)
    )
  );
end $$;

revoke all on function pos_vp_renglones(date, date, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function pos_ventas_productos(date, date, uuid, text, text, boolean),
                       pos_ventas_de_producto(text, date, date, uuid, text, boolean) from public, anon;
grant execute on function pos_ventas_productos(date, date, uuid, text, text, boolean),
                          pos_ventas_de_producto(text, date, date, uuid, text, boolean) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 197 (29/10/2026) · LOS CLIENTES
--
--  La «Administración de clientes» de BlueSoft, como la pidió Mauricio
--  (29/10): "para poder crear clientes y también para ver los clientes y
--  también desde tickets de venta, cuando buscamos un cliente en la lupita,
--  también ahí tiene que estar la opción de crear cliente con todos los datos
--  y también los datos para hacer factura".
--  · UNA SOLA LISTA con los socios del Club (lo eligió él): el socio que
--    necesita factura tiene su ficha de cliente atada a él (socio_id), así
--    nadie se carga dos veces; los socios sin ficha aparecen igual.
--  · La ficha, con las 4 pestañas de una persona (lo eligió él): Datos
--    generales (documento, IVA, mail, observaciones), Direcciones, Teléfonos
--    y Datos persona (cumpleaños y talles). Lo de venta mayorista de BlueSoft
--    (condiciones comerciales, acciones, descuentos) queda afuera.
--  · La condición de IVA es una de las 4 que acepta la venta.
--  · El mostrador busca (al menos 3 letras o números; hasta 50); la lista
--    entera es de la oficina. La tarjeta del Club es la credencial del socio:
--    la lista y la ficha no la traen (sólo la búsqueda de la venta, como
--    pos_club_buscar, para cargarle los puntos).
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_clientes (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint not null unique,                       -- el «Código» de la ficha: 1, 2, 3…
  socio_id          bigint unique references club_clientes (id) on delete set null,
  nombre            text not null check (length(btrim(nombre)) between 1 and 120),
  doc_tipo          text not null default 'dni' check (doc_tipo in ('cuit', 'dni', 'pasaporte', 'libreta', 'otro')),
  doc               text check (doc is null or length(doc) between 3 and 20),
  condicion         text not null default 'consumidor_final'
                    check (condicion in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento')),
  mail              text check (mail is null or length(mail) <= 120),
  observaciones     text check (observaciones is null or length(observaciones) <= 1000),
  cumple            date,
  talle_pantalon    text check (talle_pantalon is null or length(talle_pantalon) <= 10),
  talle_remera      text check (talle_remera is null or length(talle_remera) <= 10),
  calzado           text check (calzado is null or length(calzado) <= 10),
  direcciones       jsonb not null default '[]'::jsonb check (jsonb_typeof(direcciones) = 'array'),
  telefonos         jsonb not null default '[]'::jsonb check (jsonb_typeof(telefonos) = 'array'),
  activo            boolean not null default true,
  local_id          uuid references orden_locales (id) on delete set null,   -- dónde se creó
  creado            timestamptz not null default now(),
  creado_por        uuid,
  creado_nombre     text,
  modificado        timestamptz,
  modificado_por    uuid,
  modificado_nombre text
);
/* Un documento, un cliente. */
create unique index pos_clientes_doc on pos_clientes (doc_tipo, doc) where doc is not null;
alter table pos_clientes enable row level security;
revoke all on pos_clientes from anon, authenticated;

/* El dígito verificador del CUIT (el último): 11 menos el resto de dividir por 11 la suma pesada; 11 da 0. Un CUIT que
   da 10 no existe (ARCA le cambia el prefijo a 23 o 33), y igual se acepta con 9, como los validadores de siempre. */
create function pos_cuit_ok(p text) returns boolean
language sql immutable set search_path = public as $$
  select case when coalesce(p, '') !~ '^[0-9]{11}$' then false else (
    select case t.r when 11 then 0 when 10 then 9 else t.r end = substr(p, 11, 1)::int
      from (select 11 - (sum(substr(p, i, 1)::int * (array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2])[i]) % 11)::int r
              from generate_series(1, 10) i) t) end
$$;

/* Lo del socio que se muestra en la ficha y en la lista (sin la tarjeta, que es su credencial). */
create function pos_cli_socio(p_socio bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'nombre', s.nombre, 'nivel', s.nivel, 'puntos', s.puntos, 'whatsapp', s.telefono,
                            'mail', s.mail, 'cumple', s.cumple, 'compras', s.compras)
    from v_club_clientes s where s.id = p_socio and s.baja is null
$$;

/* Un cliente, como lo ven la ficha y la venta: lo guardado, el teléfono predeterminado, la dirección para las facturas
   (escrita en una línea) y su socio. */
create function pos_cli_json(c pos_clientes) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'numero', c.numero, 'nombre', c.nombre, 'doc_tipo', c.doc_tipo, 'doc', c.doc, 'condicion', c.condicion,
    'mail', c.mail, 'observaciones', c.observaciones, 'cumple', c.cumple, 'talle_pantalon', c.talle_pantalon,
    'talle_remera', c.talle_remera, 'calzado', c.calzado, 'direcciones', c.direcciones, 'telefonos', c.telefonos,
    'activo', c.activo, 'local_id', c.local_id, 'local', (select l.nombre from orden_locales l where l.id = c.local_id),
    'creado', c.creado, 'creado_nombre', c.creado_nombre, 'modificado', c.modificado, 'modificado_nombre', c.modificado_nombre,
    'telefono', (select x->>'numero' from jsonb_array_elements(c.telefonos) x where coalesce((x->>'predeterminado')::boolean, false) limit 1),
    'direccion', (select concat_ws(', ', nullif(btrim(concat_ws(' ', x->>'calle', x->>'numero')), ''),
                                   nullif(btrim(concat_ws(' ', nullif(x->>'piso', '') || 'º', x->>'depto')), ''),
                                   nullif(btrim(concat_ws(' ', x->>'localidad', '(' || nullif(x->>'cp', '') || ')')), ''),
                                   nullif(x->>'provincia', ''))
                    from jsonb_array_elements(c.direcciones) x where coalesce((x->>'factura')::boolean, false) limit 1),
    'socio', case when c.socio_id is not null then pos_cli_socio(c.socio_id) end)
$$;

/* Los que coinciden con lo buscado: los clientes (con su socio, si tienen) y los socios del Club sin ficha. Vacío = todos.
   Números: el Nº de cliente, el documento (también adentro del CUIT), un teléfono o la tarjeta del Club. Con @: el mail.
   Con letras: el nombre con todas esas palabras (sin mirar acentos ni mayúsculas), o el pasaporte. */
create function pos_cli_filas(p_buscar text) returns table (cliente_id uuid, socio_id bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select btrim(coalesce(p_buscar, '')) t,
           regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g') dig,
           btrim(coalesce(p_buscar, '')) ~ '^[0-9\s.()+/-]+$' numeros,
           translate(lower(btrim(coalesce(p_buscar, ''))), 'áéíóúüñ', 'aeiouun') txt
  ),
  todos as (
    select c.id cliente_id, c.socio_id from pos_clientes c
    union all
    select null::uuid, s.id from club_clientes s
     where s.baja is null and not exists (select 1 from pos_clientes c where c.socio_id = s.id)
  )
  select t.cliente_id, t.socio_id
    from todos t
    cross join b
    left join pos_clientes c on c.id = t.cliente_id
    left join club_clientes s on s.id = t.socio_id and s.baja is null
   where b.t = ''
      or (b.numeros and b.dig <> '' and (
             c.numero::text = b.dig
          or (length(b.dig) >= 3 and position(b.dig in coalesce(c.doc, '')) > 0)
          or (length(b.dig) >= 8 and club_tel(s.telefono) = club_tel(b.dig))
          or (length(b.dig) >= 6 and exists (select 1 from jsonb_array_elements(c.telefonos) x
                                              where position(b.dig in regexp_replace(coalesce(x->>'numero', ''), '[^0-9]', '', 'g')) > 0
                                                 or (length(b.dig) >= 8 and club_tel(x->>'numero') = club_tel(b.dig))))
          or (length(b.dig) = 12 and s.codigo = b.dig)))
      or (position('@' in b.txt) > 1 and (position(b.txt in lower(coalesce(c.mail, ''))) > 0 or position(b.txt in lower(coalesce(s.mail, ''))) > 0))
      or (not b.numeros and length(b.t) >= 3 and upper(regexp_replace(b.t, '\s', '', 'g')) = c.doc)
      or (not b.numeros and b.txt ~ '[a-zñ]' and (
             not exists (select 1 from regexp_split_to_table(b.txt, '\s+') w
                          where w <> '' and position(w in translate(lower(coalesce(c.nombre, '')), 'áéíóúüñ', 'aeiouun')) = 0)
          or not exists (select 1 from regexp_split_to_table(b.txt, '\s+') w
                          where w <> '' and position(w in translate(lower(coalesce(s.nombre, '')), 'áéíóúüñ', 'aeiouun')) = 0)))
$$;

/* La lista de Gestión → Clientes (y la del mostrador). p_mostrar: activos, inactivos o todos; p_club: todos, socios
   (los del Club) o sin (los que no son socios). La oficina ve la lista entera (hasta 1.000; 'mas' avisa que hay más);
   el mostrador, sólo lo que busca (al menos 3 letras o números; hasta 50). */
create function pos_clientes_lista(p_buscar text default null, p_mostrar text default 'activos', p_club text default 'todos')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t   text := btrim(coalesce(p_buscar, ''));
  v_ofi boolean;
  v_max int;
begin
  perform pos_permiso();
  if coalesce(p_mostrar, '') not in ('activos', 'inactivos', 'todos') then raise exception 'Elegí cuáles mostrar.'; end if;
  if coalesce(p_club, '') not in ('todos', 'socios', 'sin') then raise exception 'Elegí si son socios del Club.'; end if;
  v_ofi := pos_puede('gestion');
  if not v_ofi and length(v_t) < 3 then
    return jsonb_build_object('corto', true, 'oficina', false,
                              'porque', 'Buscá al cliente por su nombre, DNI o CUIT, teléfono o mail (al menos 3 letras o números).');
  end if;
  v_max := case when v_ofi then 1000 else 50 end;
  return (
    with r as (
      select c.id, c.numero, coalesce(c.nombre, s.nombre) nombre, c.doc_tipo, c.doc, c.condicion, coalesce(c.mail, s.mail) mail,
             (select x->>'numero' from jsonb_array_elements(c.telefonos) x where coalesce((x->>'predeterminado')::boolean, false) limit 1) telefono,
             (select x->>'localidad' from jsonb_array_elements(c.direcciones) x where coalesce((x->>'factura')::boolean, false) limit 1) localidad,
             s.id socio_id, s.telefono whatsapp, s.nivel, s.puntos, coalesce(c.activo, true) activo, coalesce(c.creado, s.creado) creado,
             translate(lower(coalesce(c.nombre, s.nombre)), 'áéíóúüñ', 'aeiouun') orden
        from pos_cli_filas(v_t) f
        left join pos_clientes c on c.id = f.cliente_id
        left join v_club_clientes s on s.id = coalesce(c.socio_id, f.socio_id) and s.baja is null
       where (c.id is not null or s.id is not null)
         and (p_mostrar = 'todos' or (p_mostrar = 'inactivos') = not coalesce(c.activo, true))
         and (p_club = 'todos' or (p_club = 'socios') = (s.id is not null))
    )
    select jsonb_build_object(
      'clientes', coalesce((select jsonb_agg(to_jsonb(z) - 'orden' order by z.orden, z.numero)
                              from (select * from r order by orden, numero limit v_max) z), '[]'::jsonb),
      'total', (select count(*) from r),
      'mas', (select count(*) > v_max from r),
      'oficina', v_ofi)
  );
end $$;

/* La ficha: un cliente (p_id), o un socio (p_socio, su id del Club): si ya tiene ficha, ésa; si no, una nueva con lo del
   Club (el nombre, el mail y el cumpleaños) para completar y guardar atada a él. */
create function pos_cliente(p_id uuid default null, p_socio bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c pos_clientes;
  so jsonb;
begin
  perform pos_permiso();
  if p_id is not null then
    select * into c from pos_clientes where id = p_id;
    if not found then raise exception 'Ese cliente no existe.'; end if;
    return pos_cli_json(c);
  end if;
  if p_socio is null then raise exception 'Elegí el cliente.'; end if;
  select * into c from pos_clientes where socio_id = p_socio;
  if found then return pos_cli_json(c); end if;
  so := pos_cli_socio(p_socio);
  if so is null then raise exception 'Ese socio no está en el Club (o se dio de baja).'; end if;
  return jsonb_build_object('id', null, 'numero', null, 'nombre', so->>'nombre', 'doc_tipo', 'dni', 'doc', null,
                            'condicion', 'consumidor_final', 'mail', so->>'mail', 'cumple', so->>'cumple', 'direcciones', '[]'::jsonb,
                            'telefonos', '[]'::jsonb, 'activo', true, 'socio', so);
end $$;

/* Crear o cambiar un cliente (sin id, uno nuevo). Lo hace cualquiera que use el POS: en la venta, con la lupita, o en
   Clientes. El socio (socio_id, o socio = su tarjeta, desde la venta) se ata sólo al crearlo. Devuelve el cliente. */
create function pos_cliente_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id     uuid;
  v_nom    text := nullif(btrim(coalesce(p->>'nombre', '')), '');
  v_tipo   text := coalesce(nullif(p->>'doc_tipo', ''), 'dni');
  v_doc    text := nullif(btrim(coalesce(p->>'doc', '')), '');
  v_cond   text := coalesce(nullif(p->>'condicion', ''), 'consumidor_final');
  v_mail   text := nullif(lower(btrim(coalesce(p->>'mail', ''))), '');
  v_obs    text := nullif(btrim(coalesce(p->>'observaciones', '')), '');
  v_tp     text := nullif(upper(btrim(coalesce(p->>'talle_pantalon', ''))), '');
  v_tr     text := nullif(upper(btrim(coalesce(p->>'talle_remera', ''))), '');
  v_cz     text := nullif(upper(btrim(coalesce(p->>'calzado', ''))), '');
  v_activo boolean;
  v_cumple date;
  v_soc    bigint;
  v_loc    uuid;
  v_dirs   jsonb := '[]'::jsonb;
  v_tels   jsonb := '[]'::jsonb;
  v_fac    boolean := false;
  v_pre    boolean := false;
  v_yo     uuid := orden_yo_id();
  v_yon    text := (select pe.nombre from orden_personas pe where pe.id = orden_yo_id());
  v_hoy    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  x        jsonb;
  y        jsonb;
  o        pos_clientes;
  c        pos_clientes;
begin
  perform pos_permiso();
  begin
    v_id := nullif(p->>'id', '')::uuid;
    v_activo := coalesce(nullif(p->>'activo', '')::boolean, true);
  exception when others then raise exception 'Los datos del cliente no son válidos.';
  end;

  if v_nom is null then raise exception 'Falta el nombre (o la razón social).'; end if;
  if length(v_nom) > 120 then raise exception 'El nombre es muy largo (hasta 120 letras).'; end if;

  /* El documento: el CUIT, el DNI y la libreta, sólo los números; el pasaporte y otro, sin espacios y en mayúsculas. */
  if v_tipo not in ('cuit', 'dni', 'pasaporte', 'libreta', 'otro') then raise exception 'El tipo de documento no es válido.'; end if;
  if v_doc is not null then
    v_doc := case when v_tipo in ('cuit', 'dni', 'libreta') then regexp_replace(v_doc, '[^0-9]', '', 'g')
                  else upper(regexp_replace(v_doc, '\s', '', 'g')) end;
    v_doc := nullif(v_doc, '');
  end if;
  if v_doc is not null then
    if v_tipo = 'cuit' and length(v_doc) <> 11 then raise exception 'El CUIT tiene 11 números.'; end if;
    if v_tipo = 'cuit' and not pos_cuit_ok(v_doc) then
      raise exception 'Ese CUIT no es válido: revisá los números (el último es el dígito verificador).';
    end if;
    if v_tipo = 'dni' and length(v_doc) not between 7 and 8 then raise exception 'El DNI tiene 7 u 8 números.'; end if;
    if v_tipo = 'libreta' and length(v_doc) not between 6 and 8 then raise exception 'La libreta tiene de 6 a 8 números.'; end if;
    if v_tipo = 'pasaporte' and v_doc !~ '^[A-Z0-9]{6,12}$' then raise exception 'El pasaporte tiene de 6 a 12 letras y números.'; end if;
    if v_tipo = 'otro' and length(v_doc) not between 3 and 20 then raise exception 'El documento tiene de 3 a 20 letras y números.'; end if;
  end if;

  if v_cond not in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento') then
    raise exception 'La condición frente al IVA no es válida.';
  end if;
  if v_cond <> 'consumidor_final' and (v_tipo <> 'cuit' or v_doc is null) then
    raise exception 'Para responsable inscripto, monotributo o exento hace falta el CUIT.';
  end if;
  if v_mail is not null and (length(v_mail) > 120 or v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'El mail no está bien escrito.';
  end if;
  if length(coalesce(v_obs, '')) > 1000 then raise exception 'Las observaciones son muy largas (hasta 1.000 letras).'; end if;
  if length(coalesce(v_tp, '')) > 10 or length(coalesce(v_tr, '')) > 10 or length(coalesce(v_cz, '')) > 10 then
    raise exception 'Los talles son de hasta 10 letras.';
  end if;
  begin
    v_cumple := nullif(p->>'cumple', '')::date;
  exception when others then raise exception 'La fecha de cumpleaños no es válida.';
  end;
  if v_cumple is not null and (v_cumple > v_hoy or v_cumple < date '1900-01-01') then
    raise exception 'La fecha de cumpleaños no es válida.';
  end if;

  /* Las direcciones (hasta 10): la calle es lo único obligatorio; una sola es la de las facturas (si ninguna, la primera). */
  if p ? 'direcciones' and jsonb_typeof(p->'direcciones') = 'array' then
    if jsonb_array_length(p->'direcciones') > 10 then raise exception 'Hasta 10 direcciones.'; end if;
    for x in select * from jsonb_array_elements(p->'direcciones') loop
      if jsonb_typeof(x) <> 'object' then raise exception 'Una dirección no es válida.'; end if;
      y := jsonb_build_object(
        'calle', nullif(btrim(coalesce(x->>'calle', '')), ''), 'numero', nullif(btrim(coalesce(x->>'numero', '')), ''),
        'piso', nullif(btrim(coalesce(x->>'piso', '')), ''), 'depto', nullif(upper(btrim(coalesce(x->>'depto', ''))), ''),
        'localidad', nullif(btrim(coalesce(x->>'localidad', '')), ''), 'cp', nullif(upper(btrim(coalesce(x->>'cp', ''))), ''),
        'provincia', nullif(btrim(coalesce(x->>'provincia', '')), ''),
        'factura', not v_fac and coalesce((x->>'factura')::boolean, false));
      if y->>'calle' is null then raise exception 'En cada dirección falta la calle.'; end if;
      if length(y->>'calle') > 80 or length(coalesce(y->>'numero', '')) > 10 or length(coalesce(y->>'piso', '')) > 5
         or length(coalesce(y->>'depto', '')) > 5 or length(coalesce(y->>'localidad', '')) > 60 or length(coalesce(y->>'cp', '')) > 10
         or length(coalesce(y->>'provincia', '')) > 60 then
        raise exception 'Una dirección tiene algo muy largo.';
      end if;
      if (y->>'factura')::boolean then v_fac := true; end if;
      v_dirs := v_dirs || jsonb_build_array(y);
    end loop;
    if not v_fac and jsonb_array_length(v_dirs) > 0 then v_dirs := jsonb_set(v_dirs, '{0,factura}', 'true'::jsonb); end if;
  end if;

  /* Los teléfonos (hasta 10): el número, con al menos 6 dígitos; uno es el predeterminado (si ninguno, el primero). */
  if p ? 'telefonos' and jsonb_typeof(p->'telefonos') = 'array' then
    if jsonb_array_length(p->'telefonos') > 10 then raise exception 'Hasta 10 teléfonos.'; end if;
    for x in select * from jsonb_array_elements(p->'telefonos') loop
      if jsonb_typeof(x) <> 'object' then raise exception 'Un teléfono no es válido.'; end if;
      y := jsonb_build_object(
        'numero', nullif(btrim(coalesce(x->>'numero', '')), ''), 'contacto', nullif(btrim(coalesce(x->>'contacto', '')), ''),
        'horario', nullif(btrim(coalesce(x->>'horario', '')), ''),
        'predeterminado', not v_pre and coalesce((x->>'predeterminado')::boolean, false));
      if length(regexp_replace(coalesce(y->>'numero', ''), '[^0-9]', '', 'g')) < 6 or length(y->>'numero') > 25 then
        raise exception 'Cada teléfono necesita el número (con la característica).';
      end if;
      if length(coalesce(y->>'contacto', '')) > 60 or length(coalesce(y->>'horario', '')) > 40 then
        raise exception 'Un teléfono tiene algo muy largo.';
      end if;
      if (y->>'predeterminado')::boolean then v_pre := true; end if;
      v_tels := v_tels || jsonb_build_array(y);
    end loop;
    if not v_pre and jsonb_array_length(v_tels) > 0 then v_tels := jsonb_set(v_tels, '{0,predeterminado}', 'true'::jsonb); end if;
  end if;

  if v_id is not null then
    select * into o from pos_clientes where id = v_id for update;
    if not found then raise exception 'Ese cliente no existe.'; end if;
  end if;

  /* Un documento, un cliente. */
  if v_doc is not null then
    select * into c from pos_clientes where doc_tipo = v_tipo and doc = v_doc and id is distinct from v_id;
    if found then
      raise exception 'Ya hay un cliente con ese %: Nº % · %.',
        case v_tipo when 'cuit' then 'CUIT' when 'dni' then 'DNI' when 'libreta' then 'documento' when 'pasaporte' then 'pasaporte' else 'documento' end,
        c.numero, c.nombre;
    end if;
  end if;

  if v_id is null then
    /* El socio, sólo al crearlo: por su id (la ficha) o por su tarjeta (la venta). */
    if nullif(p->>'socio_id', '') is not null or nullif(p->>'socio', '') is not null then
      select s.id into v_soc from club_clientes s
       where s.baja is null
         and (s.id::text = nullif(p->>'socio_id', '') or s.codigo = nullif(p->>'socio', ''));
      if v_soc is null then raise exception 'Ese socio no está en el Club (o se dio de baja).'; end if;
      select * into c from pos_clientes where socio_id = v_soc;
      if found then raise exception 'Ese socio ya tiene su ficha de cliente: Nº % · %.', c.numero, c.nombre; end if;
    end if;
    v_loc := (select l.id from orden_locales l where l.id::text = nullif(p->>'local_id', ''));
    perform pg_advisory_xact_lock(hashtext('pos_cliente'));
    insert into pos_clientes (numero, socio_id, nombre, doc_tipo, doc, condicion, mail, observaciones, cumple, talle_pantalon,
                              talle_remera, calzado, direcciones, telefonos, activo, local_id, creado_por, creado_nombre)
    values ((select coalesce(max(numero), 0) + 1 from pos_clientes), v_soc, v_nom, v_tipo, v_doc, v_cond, v_mail, v_obs, v_cumple,
            v_tp, v_tr, v_cz, v_dirs, v_tels, v_activo, v_loc, v_yo, v_yon)
    returning * into c;
  else
    update pos_clientes set nombre = v_nom, doc_tipo = v_tipo, doc = v_doc, condicion = v_cond, mail = v_mail, observaciones = v_obs,
                            cumple = v_cumple, talle_pantalon = v_tp, talle_remera = v_tr, calzado = v_cz,
                            direcciones = case when p ? 'direcciones' then v_dirs else direcciones end,
                            telefonos = case when p ? 'telefonos' then v_tels else telefonos end,
                            activo = v_activo, modificado = now(), modificado_por = v_yo, modificado_nombre = v_yon
     where id = v_id
    returning * into c;
  end if;
  return pos_cli_json(c);
exception when unique_violation then
  raise exception 'Ya hay un cliente con ese documento (o ese socio ya tiene su ficha). Buscalo en Clientes.';
end $$;

/* La lupita de la venta: los clientes y los socios del Club juntos (hasta 12, por nombre). Del socio trae lo de
   pos_club_buscar (la tarjeta y el multiplicador de hoy, para cargarle los puntos); del cliente, sus datos para la
   factura. */
create function pos_clientes_buscar(p_texto text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t text := btrim(coalesce(p_texto, ''));
begin
  perform pos_permiso();
  if length(v_t) < 3 then
    return jsonb_build_object('corto', true, 'porque', 'Escribí al menos 3 letras del nombre, o el DNI, el CUIT, el teléfono o la tarjeta.');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'cliente', case when z.cid is not null then (select pos_cli_json(c) from pos_clientes c where c.id = z.cid) end,
             'socio', case when z.sid is not null then (
                 select jsonb_build_object('codigo', s.codigo, 'nombre', s.nombre, 'telefono', s.telefono, 'mail', s.mail,
                                           'puntos', s.puntos, 'nivel', s.nivel, 'compras', s.compras, 'confirmado', s.confirmado,
                                           'factor', (club_factor(s.id)->>'total')::numeric)
                   from v_club_clientes s where s.id = z.sid) end)
           order by z.orden, z.numero)
      from (
        select c.id cid, s.id sid, c.numero, translate(lower(coalesce(c.nombre, s.nombre)), 'áéíóúüñ', 'aeiouun') orden
          from pos_cli_filas(v_t) f
          left join pos_clientes c on c.id = f.cliente_id and c.activo
          left join club_clientes s on s.id = coalesce(c.socio_id, f.socio_id) and s.baja is null
         where c.id is not null or s.id is not null
         order by orden, c.numero
         limit 12
      ) z
  ), '[]'::jsonb);
end $$;

revoke all on function pos_cuit_ok(text), pos_cli_socio(bigint), pos_cli_json(pos_clientes), pos_cli_filas(text)
  from public, anon, authenticated;
revoke all on function pos_clientes_lista(text, text, text), pos_cliente(uuid, bigint), pos_cliente_guardar(jsonb),
                       pos_clientes_buscar(text) from public, anon;
grant execute on function pos_clientes_lista(text, text, text), pos_cliente(uuid, bigint), pos_cliente_guardar(jsonb),
                          pos_clientes_buscar(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 200 (30/10/2026) · LAS GIFT CARDS EN EL POS
--
--  Mauricio (30/10): "la gift card, sí, ponerla como forma de pago tendría
--  que estar. También para vender una… sii hacelo… pero que todavía se pueda
--  cobrar de la otra manera hasta que demos el alta todo el pos".
--  · VENDERLA: la tarjeta impresa (Black o Gold, los 14 números que lee la
--    pistola) entra a la venta como un renglón, con el valor que se escriba.
--    Al guardar queda vendida igual que desde Gift Cards (en beneficios,
--    vence a los 30 días), a nombre del cliente de la venta si lo hay.
--  · COBRAR CON ELLA: «Gift card» es una forma de pago más (sola o en el pago
--    múltiple). Se usa entera, como en Cobrar: queda usada con el local, el
--    vendedor y el total de la compra. Si vale más de lo que paga, la
--    diferencia se pierde (la pantalla lo avisa antes).
--  · Gift Cards y Cobrar siguen como siempre: la vendida en el POS se canjea
--    en Cobrar y la vendida en Gift Cards paga en el POS.
--  · Una gift card no se compra con otra, no sale del stock y no da puntos
--    del Club (los da lo que se compra con ella).
--  · Anular la venta: la tarjeta que se vendió vuelve a estar sin vender (si
--    ya se usó, la venta no se anula) y la que pagó vuelve a estar disponible.
--  · La caja: lo pagado con gift card va aparte (no es efectivo).
--  · En modo prueba se revisa todo, pero no se vende ni se usa ninguna.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pos_venta_items add column beneficio bigint references beneficios (id) on delete set null;
alter table pos_venta_pagos add column beneficio bigint references beneficios (id) on delete set null;
create index pos_venta_items_beneficio on pos_venta_items (beneficio) where beneficio is not null;
create index pos_venta_pagos_beneficio on pos_venta_pagos (beneficio) where beneficio is not null;
alter table pos_venta_pagos drop constraint pos_venta_pagos_medio_check;
alter table pos_venta_pagos add constraint pos_venta_pagos_medio_check
  check (medio in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard'));
alter table pos_cierres add column ventas_giftcard numeric not null default 0;

/* El nombre de una gift card para los mensajes y el ticket: «Black Nº 001». Nunca sus 14 números: con
   ellos se cobra (una vieja, sin tarjeta impresa, va con su número corto). */
create function pos_gc_nombre(p_serie text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select g.color || ' Nº ' || lpad(g.nro::text, 3, '0') from giftcard_tarjetas g where g.codigo = p_serie),
                  'Nº ' || p_serie)
$$;

/* La tarjeta que pasan por la pistola: si es una de las impresas, si se vendió y cómo está. La venta la
   pide para venderla (tiene que estar sin vender) y para cobrar con ella (tiene que estar disponible). */
create function pos_giftcard(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cod  text := regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g');
  t      giftcard_tarjetas%rowtype;
  b      v_beneficios%rowtype;
begin
  perform pos_permiso();
  if v_cod !~ '^99[0-9]{12}$' then return jsonb_build_object('existe', false, 'formato', false); end if;
  select * into t from giftcard_tarjetas g where g.codigo = v_cod;
  if not found then return jsonb_build_object('existe', false, 'formato', true); end if;
  select * into b from v_beneficios x where x.tipo = 'giftcard' and upper(trim(x.serie)) = v_cod;
  return jsonb_build_object('existe', true, 'formato', true, 'nro', lpad(t.nro::text, 3, '0'), 'color', t.color,
                            'vendida', b.id is not null, 'estado', b.estado, 'valor', b.valor, 'vence', b.vence,
                            'local', b.local, 'vendida_el', b.creado, 'usada_el', b.usado, 'local_canje', b.local_canje);
end $$;

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
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
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);

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
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * v_total / v_neto, 2) else 0 end,
                v_pago, pos_hoy() + 30, v_locod, v_vend,
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio)
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid);
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
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
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). */
    v_gana := floor((greatest(v_total - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', now(), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_venta_anular(p_id uuid, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v pos_ventas; m pos_stock_movs; v_usadas text;
begin
  perform pos_permiso('anular');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.factura is not null then raise exception 'Esa venta tiene factura de ARCA: se anula con una nota de crédito.'; end if;
  /* SQL 200: la gift card que se vendió en esta venta no tiene que estar usada. */
  select string_agg(pos_gc_nombre(b.serie), ', ' order by i.item) into v_usadas
    from pos_venta_items i join beneficios b on b.id = i.beneficio
   where i.venta_id = p_id and b.usado is not null;
  if v_usadas is not null then
    raise exception 'La Gift Card % de esta venta ya se usó: la venta no se puede anular.', v_usadas;
  end if;
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
  /* SQL 200: la gift card que se vendió vuelve a estar sin vender (se puede vender de nuevo: la venta anulada
     guarda cuál era y por cuánto) y la que pagó vuelve a estar disponible. */
  delete from beneficios b using pos_venta_items i where i.venta_id = p_id and i.beneficio = b.id;
  update beneficios b set usado = null, local_canje = null, vendedor_canje = null, monto_compra = null, canal_canje = null
    from pos_venta_pagos g
   where g.venta_id = p_id and g.medio = 'giftcard' and g.beneficio = b.id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_abierta(p_local uuid, p_prueba boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and coalesce(x.caja, 'chica') = 'chica'   -- SQL 191
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
      'transferencia', coalesce((select g.monto from g where g.medio = 'transferencia'), 0),
      'giftcard',      coalesce((select g.monto from g where g.medio = 'giftcard'), 0)),   -- SQL 200
    'ventas_total', coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    'descuentos', coalesce((select sum(v.descuentos) from v), 0),
    'cambios', (select count(*) from cb),
    'cambios_diferencia', coalesce((select sum(cb.diferencia) from cb), 0),
    'gastos', coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    'otras_salidas', coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    'otros_ingresos', coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    'a_caja_fuerte', coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),   -- SQL 180
    'retiros_fondos', coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0),   -- SQL 191
    'conteos', (select count(*) from pos_caja_conteos k
                 where k.local_id = p_local and k.prueba = p_prueba and k.fecha > coalesce(u.fecha, '-infinity'::timestamptz)),
    'tolerancia', coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = p_local), 100)
  ) into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_cerrar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(v_local);

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
   where local_id = v_local and prueba = v_prueba and cierre_id is null
     and coalesce(caja, 'chica') = 'chica';   -- SQL 191: el retiro de la caja fuerte no es de esta caja
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
    ventas_giftcard      = coalesce((select g.monto from g where g.medio = 'giftcard'), 0),   -- SQL 200
    ventas_total         = coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    descuentos           = coalesce((select sum(v.descuentos) from v), 0),
    cambios              = (select count(*) from cb),
    cambios_diferencia   = coalesce((select sum(cb.diferencia) from cb), 0),
    gastos               = coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    otras_salidas        = coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    otros_ingresos       = coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    a_caja_fuerte        = coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),   -- SQL 180
    retiros_fondos       = coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0)   -- SQL 191
  where id = v_id;
  update pos_cierres set esperado = saldo_inicial + ventas_efectivo + otros_ingresos - gastos - otras_salidas - a_caja_fuerte
                                  - retiros_fondos   -- SQL 191
   where id = v_id
  returning * into c;
  /* SQL 180: lo que tendría que haber es lo mismo que cuando contaron; si no, algo entró o salió en el medio. */
  if c.esperado <> k.esperado then
    raise exception 'La caja cambió después de contar (una venta en efectivo, un gasto, un pase a la caja fuerte o un retiro): contá de nuevo y tocá «Ver la cuenta».';
  end if;

  return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                            'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'ya', false);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_cierres(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso('gestion');   -- SQL 190: es de la oficina
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

revoke all on function pos_gc_nombre(text) from public, anon, authenticated;
revoke all on function pos_giftcard(text) from public, anon;
grant execute on function pos_giftcard(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 201 (30/10/2026) · SUBIR Y AUMENTAR LAS LISTAS DE PRECIOS
--
--  Mauricio (30/10), mirando «Importar productos desde la web» en los
--  Remitos de BlueSoft: "si de la fábrica actualizamos precios, ¿impactan
--  directamente en el POS?". No: los precios del POS son la lista de BlueSoft
--  del 29/10 (SQL 194). Lo que pidió ("sí, dale"):
--  · «Subir lista de BlueSoft»: el mismo Excel «Lista de Precios» que se baja
--    de BlueSoft (o cualquiera con Código y Precio). La pantalla muestra antes
--    qué cambia; al aplicarlo, los 14 locales cobran el precio nuevo desde la
--    próxima venta. Lo que no viene en el Excel queda como está.
--  · «Aumentar precios»: "que tengan la opción de incrementar la lista de
--    precio con un porcentaje… todo o por rubro y familias". Con su
--    redondeo; con el signo menos, baja.
--  · Cada cambio en bloque queda anotado con los precios de antes y se puede
--    deshacer (el último de la lista primero), sin pisar lo que se cambió a
--    mano después.
--  pos_articulos guarda el nombre, el rubro, la familia y la temporada de
--  cada código como vienen en la lista de BlueSoft (catalogo.js no tiene la
--  familia, y tiene sólo 576 de los 6.534 códigos con precio). La primera
--  carga (la lista del 29/10) va sólo en el SQL de App Orden; cada Excel que
--  se sube la pone al día (sólo nombre, rubro, familia y temporada).
--  pos_articulos es LA tabla de productos del POS, la misma del SQL 202
--  (pos-catalogo: talles, colores, activo y marca, con su pantalla de
--  Productos): los dos la crean igual, si no existe, así no importa cuál se
--  corre primero.
--  Sólo en las listas con precios propios: las calculadas (los locales de
--  calle) siguen solas a su base.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists pos_articulos (
  codigo           text primary key check (length(codigo) between 1 and 30),
  nombre           text not null check (length(nombre) between 1 and 120),
  rubro            text check (length(rubro) <= 60),
  familia          text check (length(familia) <= 60),
  temporada        text check (length(temporada) <= 60),
  talles           text,                                -- "S,M,L" (SQL 202)
  colores          text,                                -- "NE:NEGRO|BL:BLANCO" (SQL 202)
  activo           boolean not null default true,       -- (SQL 202)
  marca            text,                                -- (SQL 202)
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid                                 -- (SQL 202)
);
alter table pos_articulos add column if not exists rubro text check (length(rubro) <= 60);
alter table pos_articulos add column if not exists familia text check (length(familia) <= 60);
alter table pos_articulos add column if not exists temporada text check (length(temporada) <= 60);
alter table pos_articulos add column if not exists talles text;
alter table pos_articulos add column if not exists colores text;
alter table pos_articulos add column if not exists activo boolean not null default true;
alter table pos_articulos add column if not exists marca text;
alter table pos_articulos add column if not exists actualizado_por uuid;
create index if not exists pos_articulos_rubro on pos_articulos (rubro, familia);

/* Cada cambio en bloque de una lista: "antes" guarda, de cada precio que cambió, [código, precio de antes
   (null si era nuevo), cuándo se había cambiado], para poder deshacerlo. */
create table pos_precios_cambios (
  id               serial primary key,
  lista_id         int not null references pos_listas(id) on delete cascade,
  tipo             text not null check (tipo in ('subir', 'aumentar')),
  detalle          text not null check (length(detalle) <= 300),
  cambiaron        int not null,
  antes            jsonb not null check (jsonb_typeof(antes) = 'array'),
  clave            text unique check (length(clave) <= 60),   -- una por botón: dos clics no lo aplican dos veces
  creado_en        timestamptz not null default now(),
  creado_por       uuid,
  creado_nombre    text,
  deshecho_en      timestamptz,
  deshecho_por     uuid,
  deshecho_nombre  text,
  volvieron        int
);
create index pos_precios_cambios_lista on pos_precios_cambios (lista_id, id desc);

alter table pos_articulos enable row level security;
alter table pos_precios_cambios enable row level security;
revoke all on pos_articulos, pos_precios_cambios from anon, authenticated;
revoke all on sequence pos_precios_cambios_id_seq from anon, authenticated;

/* Una lista con precios propios (las calculadas no se suben ni se aumentan: siguen a su base). */
create function pos_lista_propia(p_lista int) returns pos_listas
language plpgsql stable security definer set search_path = public as $$
declare l pos_listas; b text;
begin
  select * into l from pos_listas where id = p_lista and activo;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  if l.base_id is not null then
    select nombre into b from pos_listas where id = l.base_id;
    raise exception '«%» se calcula sola de «%»: cambiá esa.', l.nombre, b;
  end if;
  return l;
end $$;

/* Los rubros y las familias de los productos con precio en una lista, con cuántos hay de cada uno
   (para elegir qué aumentar). */
create function pos_lista_rubros(p_lista int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  perform pos_lista_propia(p_lista);
  return jsonb_build_object(
    'rubros', coalesce((
      select jsonb_agg(jsonb_build_array(z.rubro, z.familia, z.n) order by z.rubro, z.familia nulls last)
        from (select a.rubro, a.familia, count(*)::int n
                from pos_precios p join pos_articulos a on a.codigo = p.codigo
               where p.lista_id = p_lista and a.rubro is not null
               group by 1, 2) z), '[]'::jsonb),
    'total', (select count(*)::int from pos_precios where lista_id = p_lista),
    'sin_rubro', (select count(*)::int from pos_precios p left join pos_articulos a on a.codigo = p.codigo
                   where p.lista_id = p_lista and a.rubro is null));
end $$;

/* Aumentar (o bajar, con el signo menos) los precios de una lista: toda, un rubro o una familia de un
   rubro, redondeando al múltiplo elegido. Sin p_aplicar, sólo dice qué cambiaría (hasta 300 renglones). */
create function pos_lista_aumentar(p_lista int, p_porcentaje numeric, p_rubro text, p_familia text, p_redondeo int,
                                   p_aplicar boolean, p_clave text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_rubro  text := nullif(btrim(coalesce(p_rubro, '')), '');
  v_fam    text := nullif(btrim(coalesce(p_familia, '')), '');
  v_clave  text := nullif(btrim(coalesce(p_clave, '')), '');
  v_cuantos int;
  v_camb   jsonb;
  v_n      int;
  v_pct    text;
  v_id     int;
  c        pos_precios_cambios;
begin
  perform pos_permiso('gestion');
  perform pos_lista_propia(p_lista);
  if p_porcentaje is null or p_porcentaje = 0 or p_porcentaje <= -90 or p_porcentaje > 200 then
    raise exception 'El porcentaje va de −89 a 200, sin el 0 (para bajar, con el signo menos: −10).';
  end if;
  if p_redondeo is null or p_redondeo not in (1, 10, 50, 100, 500, 1000) then raise exception 'El redondeo no es válido.'; end if;
  if v_fam is not null and v_rubro is null then raise exception 'Para elegir una familia, elegí primero el rubro.'; end if;
  if coalesce(p_aplicar, false) then
    if v_clave is null then raise exception 'Falta la clave del cambio.'; end if;
    select * into c from pos_precios_cambios where clave = v_clave;
    if found then return jsonb_build_object('ya', true, 'id', c.id, 'cambiaron', c.cambiaron); end if;
  end if;

  /* [código, precio de antes, precio nuevo, cuándo se había cambiado] de los que cambian. Si con el redondeo
     quedara en $0, queda como está. */
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_array(z.codigo, z.antes, z.despues, z.cuando) order by z.codigo)
                    filter (where z.despues <> z.antes), '[]'::jsonb)
    into v_cuantos, v_camb
    from (select p.codigo, p.precio antes, p.actualizado_en cuando,
                 case when y.r > 0 then least(y.r, 99999999) else p.precio end despues
            from pos_precios p
            left join pos_articulos a on a.codigo = p.codigo
            cross join lateral (select round(p.precio * (1 + p_porcentaje / 100) / p_redondeo) * p_redondeo r) y
           where p.lista_id = p_lista
             and (v_rubro is null or a.rubro = v_rubro)
             and (v_fam is null or a.familia = v_fam)) z;
  v_n := jsonb_array_length(v_camb);

  if not coalesce(p_aplicar, false) then
    return jsonb_build_object(
      'cuantos', v_cuantos,
      'cambian', v_n,
      'suma_antes', (select coalesce(sum((e->>1)::numeric), 0) from jsonb_array_elements(v_camb) e),
      'suma_despues', (select coalesce(sum((e->>2)::numeric), 0) from jsonb_array_elements(v_camb) e),
      'filas', coalesce((
        select jsonb_agg(jsonb_build_array(q.e->>0, a.nombre, (q.e->>1)::numeric, (q.e->>2)::numeric) order by q.i)
          from (select e, i from jsonb_array_elements(v_camb) with ordinality x(e, i) order by i limit 300) q
          left join pos_articulos a on a.codigo = q.e->>0), '[]'::jsonb));
  end if;

  if v_n = 0 then raise exception 'Con ese porcentaje y ese redondeo no cambia ningún precio.'; end if;
  v_pct := abs(p_porcentaje)::text;
  if position('.' in v_pct) > 0 then v_pct := rtrim(rtrim(v_pct, '0'), '.'); end if;
  insert into pos_precios_cambios (lista_id, tipo, detalle, cambiaron, antes, clave, creado_por, creado_nombre)
  values (p_lista, 'aumentar',
          case when p_porcentaje > 0 then 'Aumento del ' else 'Baja del ' end || replace(v_pct, '.', ',') || ' %' ||
            case when v_rubro is null then ' · toda la lista' else ' · ' || v_rubro || coalesce(' · ' || v_fam, '') end ||
            case p_redondeo when 1 then ' · sin redondear' when 1000 then ' · redondeo $1.000' else ' · redondeo $' || p_redondeo end,
          v_n,
          (select jsonb_agg(jsonb_build_array(e->0, e->1, e->3)) from jsonb_array_elements(v_camb) e),
          v_clave, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
  returning id into v_id;
  update pos_precios p set precio = (e->>2)::numeric, actualizado_en = now(), actualizado_por = orden_yo_id()
    from jsonb_array_elements(v_camb) e
   where p.lista_id = p_lista and p.codigo = e->>0;
  return jsonb_build_object('id', v_id, 'cambiaron', v_n);
end $$;

/* Subir una lista (el Excel «Lista de Precios» de BlueSoft, leído en la pantalla): p_filas es
   [[código, precio, nombre, rubro, familia, temporada], …], con precio mayor que 0. Pone los precios que
   cambian (y los nuevos); lo que no viene queda como está. El nombre, el rubro, la familia y la temporada
   que vengan ponen al día pos_articulos. */
create function pos_lista_subir(p_lista int, p_filas jsonb, p_origen text, p_clave text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_clave  text := nullif(btrim(coalesce(p_clave, '')), '');
  v_origen text := left(nullif(btrim(coalesce(p_origen, '')), ''), 120);
  v_f      jsonb;
  v_camb   jsonb;
  v_mal    text;
  v_n      int;
  v_art    int;
  v_id     int;
  c        pos_precios_cambios;
begin
  perform pos_permiso('gestion');
  perform pos_lista_propia(p_lista);
  if v_clave is null then raise exception 'Falta la clave del cambio.'; end if;
  select * into c from pos_precios_cambios where clave = v_clave;
  if found then return jsonb_build_object('ya', true, 'id', c.id, 'cambiaron', c.cambiaron); end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then raise exception 'La lista está vacía.'; end if;
  if jsonb_array_length(p_filas) > 30000 then raise exception 'La lista tiene demasiados renglones (hasta 30.000).'; end if;

  begin
    select jsonb_agg(jsonb_build_array(z.c, z.p, z.n, z.r, z.f, z.t) order by z.c) into v_f
      from (select upper(btrim(coalesce(e->>0, ''))) c, round((e->>1)::numeric, 2) p,
                   /* Los espacios de más, juntados en uno (como los guarda el SQL 202). */
                   left(nullif(btrim(regexp_replace(coalesce(e->>2, ''), '\s+', ' ', 'g')), ''), 120) n, left(nullif(btrim(regexp_replace(coalesce(e->>3, ''), '\s+', ' ', 'g')), ''), 60) r,
                   left(nullif(btrim(regexp_replace(coalesce(e->>4, ''), '\s+', ' ', 'g')), ''), 60) f, left(nullif(btrim(regexp_replace(coalesce(e->>5, ''), '\s+', ' ', 'g')), ''), 60) t
              from jsonb_array_elements(p_filas) e) z;
  exception when others then raise exception 'Hay un precio que no es un número.';
  end;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e where length(e->>0) not between 1 and 30 limit 1;
  if found then raise exception 'Hay un código vacío o demasiado largo: «%».', left(v_mal, 40); end if;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e where (e->>1) is null or (e->>1)::numeric <= 0 or (e->>1)::numeric >= 100000000 limit 1;
  if found then raise exception 'El precio de % no es válido.', v_mal; end if;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e group by e->>0 having count(*) > 1 limit 1;
  if found then raise exception 'El código % está dos veces.', v_mal; end if;

  /* Los productos: sólo el nombre, el rubro, la familia y la temporada que trae el Excel (los talles, los
     colores y si está activo son de Gestión → Productos, SQL 202). Los nuevos entran si traen el nombre. */
  update pos_articulos a
     set nombre = coalesce(z.n, a.nombre), rubro = coalesce(z.r, a.rubro), familia = coalesce(z.f, a.familia),
         temporada = coalesce(z.t, a.temporada), actualizado_en = now()
    from (select e->>0 c, e->>2 n, e->>3 r, e->>4 f, e->>5 t from jsonb_array_elements(v_f) e) z
   where a.codigo = z.c
     and (a.nombre, a.rubro, a.familia, a.temporada) is distinct from
         (coalesce(z.n, a.nombre), coalesce(z.r, a.rubro), coalesce(z.f, a.familia), coalesce(z.t, a.temporada));
  get diagnostics v_art = row_count;
  insert into pos_articulos (codigo, nombre, rubro, familia, temporada)
  select e->>0, e->>2, e->>3, e->>4, e->>5 from jsonb_array_elements(v_f) e
   where e->>2 is not null and not exists (select 1 from pos_articulos a where a.codigo = e->>0);
  get diagnostics v_n = row_count;
  v_art := v_art + v_n;

  /* [código, precio de antes (null si es nuevo), precio nuevo, cuándo se había cambiado] de los que cambian. */
  select coalesce(jsonb_agg(jsonb_build_array(e->>0, p.precio, (e->>1)::numeric, p.actualizado_en) order by e->>0), '[]'::jsonb)
    into v_camb
    from jsonb_array_elements(v_f) e
    left join pos_precios p on p.lista_id = p_lista and p.codigo = e->>0
   where p.precio is distinct from (e->>1)::numeric;
  v_n := jsonb_array_length(v_camb);
  if v_n > 0 then
    insert into pos_precios_cambios (lista_id, tipo, detalle, cambiaron, antes, clave, creado_por, creado_nombre)
    values (p_lista, 'subir', 'Lista subida' || coalesce(' · ' || v_origen, ''), v_n,
            (select jsonb_agg(jsonb_build_array(e->0, e->1, e->3)) from jsonb_array_elements(v_camb) e),
            v_clave, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
    returning id into v_id;
    insert into pos_precios (lista_id, codigo, precio, actualizado_por)
    select p_lista, e->>0, (e->>2)::numeric, orden_yo_id() from jsonb_array_elements(v_camb) e
    on conflict (lista_id, codigo) do update set precio = excluded.precio, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
  end if;
  return jsonb_build_object('id', v_id, 'cambiaron', v_n,
                            'nuevos', (select count(*)::int from jsonb_array_elements(v_camb) e where e->1 = 'null'::jsonb),
                            'iguales', jsonb_array_length(v_f) - v_n, 'articulos', v_art);
end $$;

/* Los últimos cambios en bloque de una lista. "se_deshace": el último sin deshacer (el único que se puede). */
create function pos_lista_cambios(p_lista int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.creado_en, 'tipo', c.tipo, 'detalle', c.detalle,
                                        'cambiaron', c.cambiaron, 'persona', c.creado_nombre, 'deshecho', c.deshecho_en,
                                        'deshizo', c.deshecho_nombre, 'volvieron', c.volvieron,
                                        'se_deshace', c.deshecho_en is null and not exists (
                                          select 1 from pos_precios_cambios x where x.lista_id = c.lista_id and x.id > c.id and x.deshecho_en is null))
                     order by c.id desc)
      from (select * from pos_precios_cambios where lista_id = p_lista order by id desc limit 15) c), '[]'::jsonb);
end $$;

/* Deshacer un cambio en bloque (el último de su lista): cada precio vuelve a como estaba, y los que eran
   nuevos se sacan. Los que alguien cambió a mano después quedan como están. */
create function pos_lista_deshacer(p_id int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c    pos_precios_cambios;
  v_n  int := 0;
  v_b  int;
begin
  perform pos_permiso('gestion');
  select * into c from pos_precios_cambios where id = p_id for update;
  if not found then raise exception 'Ese cambio no existe.'; end if;
  if c.deshecho_en is not null then raise exception 'Ese cambio ya se deshizo.'; end if;
  if exists (select 1 from pos_precios_cambios x where x.lista_id = c.lista_id and x.id > c.id and x.deshecho_en is null) then
    raise exception 'Primero hay que deshacer los cambios que se hicieron después.';
  end if;
  /* Sólo los que siguen como los dejó el cambio (actualizado_en es el del cambio). */
  delete from pos_precios p
   using jsonb_array_elements(c.antes) e
   where p.lista_id = c.lista_id and p.codigo = e->>0 and e->1 = 'null'::jsonb and p.actualizado_en <= c.creado_en;
  get diagnostics v_b = row_count;
  update pos_precios p set precio = (e->>1)::numeric, actualizado_en = coalesce((e->>2)::timestamptz, p.actualizado_en),
                           actualizado_por = orden_yo_id()
    from jsonb_array_elements(c.antes) e
   where p.lista_id = c.lista_id and p.codigo = e->>0 and e->1 <> 'null'::jsonb and p.actualizado_en <= c.creado_en;
  get diagnostics v_n = row_count;
  update pos_precios_cambios set deshecho_en = now(), deshecho_por = orden_yo_id(), volvieron = v_n + v_b,
         deshecho_nombre = (select pe.nombre from orden_personas pe where pe.id = orden_yo_id())
   where id = c.id;
  return jsonb_build_object('volvieron', v_n + v_b, 'quedaron', c.cambiaron - v_n - v_b);
end $$;

/* La "versión" de los precios de una lista (y de su base, si se calcula de otra): cambia con cualquier precio
   cambiado, sacado, subido, aumentado o deshecho, y con el porcentaje de la calculada. La venta la pregunta al
   empezar y vuelve a traer la lista sólo si cambió: una caja abierta todo el día cobra igual el precio nuevo. */
create function pos_precios_version(p_lista int) returns text
language plpgsql stable security definer set search_path = public as $$
declare l pos_listas;
begin
  perform pos_permiso();
  select * into l from pos_listas where id = p_lista;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  return concat_ws('|', l.ajuste, l.redondeo, l.base_id,
           (select count(*) || '/' || coalesce(sum(precio), 0) || '/' || coalesce(max(actualizado_en)::text, '')
              from pos_precios where lista_id in (l.id, l.base_id)));
end $$;

revoke all on function pos_lista_propia(int) from public, anon, authenticated;
revoke all on function pos_lista_rubros(int), pos_lista_aumentar(int, numeric, text, text, int, boolean, text),
                       pos_lista_subir(int, jsonb, text, text), pos_lista_cambios(int), pos_lista_deshacer(int),
                       pos_precios_version(int) from public, anon;
grant execute on function pos_lista_rubros(int), pos_lista_aumentar(int, numeric, text, text, int, boolean, text),
                          pos_lista_subir(int, jsonb, text, text), pos_lista_cambios(int), pos_lista_deshacer(int),
                          pos_precios_version(int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 202 (30/10/2026) · LOS ARTÍCULOS: todos los productos de BlueSoft
--
--  Mauricio (30/10): "descargué todos [los productos], así los juntamos con
--  la lista de precios"; y a la propuesta de que la venta los conozca a
--  todos: "sí, daleee". Hasta acá la venta buscaba sólo en catalogo.js (576,
--  las temporadas 39 a 41): una prenda de Verano 2025, de Continuidad (Vander
--  Blue, Homos…), de Promo o de Segunda no se podía vender.
--
--  pos_articulos es el maestro de productos del POS: uno por código, con lo
--  de BlueSoft (nombre, rubro, familia, temporada, marca), los talles y los
--  colores que existen y si está activo (inactivo = no aparece al buscar por
--  nombre; por el código, la pistola lo encuentra igual). La comparte el SQL
--  201 (las listas de precios, de la otra sesión): por eso el create y cada
--  columna van con "if not exists" y da lo mismo cuál se corre primero.
--  Los precios siguen en pos_precios: acá no hay plata.
--
--  La pantalla guarda una copia en la compu (anda sin internet) y la baja de
--  nuevo sólo si cambió algo (pos_articulos_version). El alta y la edición
--  (Gestión → Productos) son de la oficina.
--
--  Los 7.072 de «Productos 30 oct.xlsx» se cargan en App Orden/
--  correr-en-supabase-202.sql (los datos nunca van al repo).
-- ═══════════════════════════════════════════════════════════════════════════

/* La misma definición que el SQL 201, letra por letra: la que se corra primero la crea. */
create table if not exists pos_articulos (
  codigo           text primary key check (length(codigo) between 1 and 30),
  nombre           text not null check (length(nombre) between 1 and 120),
  rubro            text check (length(rubro) <= 60),
  familia          text check (length(familia) <= 60),
  temporada        text check (length(temporada) <= 60),
  talles           text,                            -- "S,M,L,XL"
  colores          text,                            -- "NE:NEGRO|BL:BLANCO", como catalogo.js
  activo           boolean not null default true,   -- inactivo: no sale al buscar por nombre
  marca            text,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid
);
alter table pos_articulos add column if not exists rubro text check (length(rubro) <= 60);
alter table pos_articulos add column if not exists familia text check (length(familia) <= 60);
alter table pos_articulos add column if not exists temporada text check (length(temporada) <= 60);
alter table pos_articulos add column if not exists talles text;
alter table pos_articulos add column if not exists colores text;
alter table pos_articulos add column if not exists activo boolean not null default true;
alter table pos_articulos add column if not exists marca text;
alter table pos_articulos add column if not exists actualizado_por uuid;
create index if not exists pos_articulos_rubro on pos_articulos (rubro, familia);
alter table pos_articulos enable row level security;
revoke all on pos_articulos from anon, authenticated;

/* Si cambió algo desde la copia de la compu: cuántos son y el último cambio. Liviana: la pide cada vez que abre. */
create or replace function pos_articulos_version() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  return (select jsonb_build_object('n', count(*), 'v', max(actualizado_en)) from pos_articulos);
end $$;

/* Todos, para el buscador y Gestión → Productos:
   [código, nombre, rubro, talles, colores, temporada, activo, familia, marca]. */
create or replace function pos_art_fila(a pos_articulos) returns jsonb
language sql immutable as $$
  select jsonb_build_array(a.codigo, a.nombre, coalesce(a.rubro, ''), coalesce(a.talles, ''), coalesce(a.colores, ''),
                           coalesce(a.temporada, ''), a.activo, coalesce(a.familia, ''), coalesce(a.marca, ''))
$$;

create or replace function pos_articulos_todos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  return (select jsonb_build_object('n', count(*), 'v', max(a.actualizado_en),
                                    'filas', coalesce(jsonb_agg(pos_art_fila(a) order by a.codigo), '[]'::jsonb))
            from pos_articulos a);
end $$;

/* El alta y la edición (Gestión → Productos), sólo la oficina.
   p: {nuevo, codigo, nombre, rubro, familia, temporada, marca, talles: "S,M,L", colores: [{cod, nom}], activo}.
   El código no se cambia (lo usan los precios, el stock y las ventas) y va en mayúsculas, como en ellos.
   Devuelve la fila, como pos_articulos_todos. */
create or replace function pos_articulo_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_nuevo   boolean := coalesce((p->>'nuevo')::boolean, false);
  v_cod     text := btrim(coalesce(p->>'codigo', ''));
  v_nom     text := nullif(regexp_replace(btrim(coalesce(p->>'nombre', '')), '\s+', ' ', 'g'), '');
  v_rubro   text := nullif(regexp_replace(btrim(coalesce(p->>'rubro', '')), '\s+', ' ', 'g'), '');
  v_familia text := nullif(regexp_replace(btrim(coalesce(p->>'familia', '')), '\s+', ' ', 'g'), '');
  v_temp    text := nullif(regexp_replace(btrim(coalesce(p->>'temporada', '')), '\s+', ' ', 'g'), '');
  v_marca   text := nullif(regexp_replace(btrim(coalesce(p->>'marca', '')), '\s+', ' ', 'g'), '');
  v_activo  boolean := coalesce((p->>'activo')::boolean, true);
  v_talles  text;
  v_colores text;
  r         pos_articulos;
begin
  perform pos_permiso('gestion');
  v_cod := upper(v_cod);
  if v_cod = '' or length(v_cod) > 30 or v_cod !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' then
    raise exception 'El código va con letras y números, sin espacios (hasta 30).';
  end if;
  if v_nom is null or length(v_nom) > 120 then raise exception 'Falta el nombre del producto (hasta 120 letras).'; end if;
  if length(coalesce(v_rubro, '')) > 60 or length(coalesce(v_familia, '')) > 60 or length(coalesce(v_temp, '')) > 60 or length(coalesce(v_marca, '')) > 60 then
    raise exception 'El rubro, la familia, la temporada y la marca van con hasta 60 letras.';
  end if;

  /* Los talles: "s, M ,m,L" → "S,M,L" (en mayúsculas, sin repetidos, en el orden en que los escribieron). */
  select string_agg(t, ',' order by o) into v_talles
    from (select upper(btrim(x)) t, min(n) o
            from unnest(string_to_array(coalesce(p->>'talles', ''), ',')) with ordinality u(x, n)
           where btrim(x) <> '' group by upper(btrim(x))) z;
  if exists (select 1 from unnest(string_to_array(coalesce(v_talles, ''), ',')) t where length(t) > 10) then
    raise exception 'Cada talle va con hasta 10 letras.';
  end if;

  /* Los colores: [{cod: "ne", nom: "negro"}] → "NE:NEGRO" (el primero de cada código). */
  if jsonb_typeof(coalesce(p->'colores', '[]'::jsonb)) <> 'array' then raise exception 'Los colores no se entienden.'; end if;
  select string_agg(c || ':' || coalesce(nullif(n, ''), c), '|' order by o) into v_colores
    from (select distinct on (c) c, n, o
            from (select upper(btrim(coalesce(e->>'cod', ''))) c, upper(regexp_replace(btrim(coalesce(e->>'nom', '')), '\s+', ' ', 'g')) n, o
                    from jsonb_array_elements(coalesce(p->'colores', '[]'::jsonb)) with ordinality a(e, o)) y
           where c <> '' order by c, o) z;
  if exists (select 1 from unnest(string_to_array(coalesce(v_colores, ''), '|')) x
              where split_part(x, ':', 1) !~ '^[A-Z0-9]{1,6}$' or length(substr(x, length(split_part(x, ':', 1)) + 2)) > 40
                 or substr(x, length(split_part(x, ':', 1)) + 2) ~ '[:|]') then
    raise exception 'Cada color va con un código de hasta 6 letras o números y un nombre de hasta 40.';
  end if;

  if v_nuevo then
    if exists (select 1 from pos_articulos where codigo = v_cod) then
      raise exception 'Ya hay un producto con el código %.', v_cod;
    end if;
    insert into pos_articulos (codigo, nombre, rubro, familia, temporada, marca, talles, colores, activo, actualizado_en, actualizado_por)
    values (v_cod, v_nom, v_rubro, v_familia, v_temp, v_marca, v_talles, v_colores, v_activo, now(), orden_yo_id())
    returning * into r;
  else
    update pos_articulos
       set nombre = v_nom, rubro = v_rubro, familia = v_familia, temporada = v_temp, marca = v_marca,
           talles = v_talles, colores = v_colores, activo = v_activo, actualizado_en = now(), actualizado_por = orden_yo_id()
     where codigo = v_cod
    returning * into r;
    if not found then raise exception 'No existe el producto %.', v_cod; end if;
  end if;
  return pos_art_fila(r);
end $$;

revoke all on function pos_art_fila(pos_articulos) from public, anon, authenticated;
revoke all on function pos_articulos_version(), pos_articulos_todos(), pos_articulo_guardar(jsonb) from public, anon;
grant execute on function pos_articulos_version(), pos_articulos_todos(), pos_articulo_guardar(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 204 (30/10/2026) · BUSCAR UN PRODUCTO EN LOS REMITOS
--
--  Mauricio (30/10): "en remitos tenemos un buscador que podemos poner el
--  producto y nos encuentra el remito de ese producto. Entonces podemos
--  saber cuánto entra, cuánto entró de ese producto" (para el producto
--  testigo), como en BlueSoft. "Hagamos eso en la parte de remitos, el
--  buscador."
--  En Remitos (el del local y el de Gestión), «Producto»: el código, el
--  nombre o la etiqueta escaneada. Sale cada remito que lo trae, con cuántas
--  mandaron y cuántas contaron de ese producto (todos sus talles y colores).
--  Los mismos permisos que la lista de remitos (SQL 190): cada uno ve sus
--  locales; el que recibe no ve cuántas vienen hasta que las cuenta. Los
--  pases entre depósitos del mismo local no salen (no entra nada al local).
--  Sólo lee: no cambia nada.
-- ═══════════════════════════════════════════════════════════════════════════

/* p_buscar: el código empieza así, o el nombre (el del remito o el de Productos, SQL 202) tiene todas esas palabras (sin mirar acentos ni mayúsculas), como
   Ventas por productos. Un renglón por remito y producto; "mandaron" va en null mientras el que recibe cuenta a ciegas. */
create function pos_remitos_producto(p_buscar text, p_desde date, p_hasta date, p_local uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q   text := translate(lower(btrim(coalesce(p_buscar, ''))), 'áéíóúü', 'aeiouu');
  v_ges boolean;
  v_res jsonb;
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);
  perform pos_dias_ok(p_desde);
  if length(v_q) < 2 then raise exception 'Escribí al menos 2 letras del código o del nombre.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  v_ges := pos_puede('gestion');
  with g as (
    select x.id, x.numero, x.referencia, x.fecha, x.estado, x.origen_local_id, x.destino_local_id, x.observaciones,
           i.codigo, coalesce(max(i.descripcion), max(a.nombre)) descripcion, sum(i.cantidad)::int mandaron, sum(i.contado)::int llegaron,
           bool_or(k.codigo is not null) recibido
      from pos_remitos x
      join pos_remito_items i on i.remito_id = x.id
      left join pos_remito_productos k on k.remito_id = x.id and k.codigo = i.codigo
      left join pos_articulos a on a.codigo = i.codigo
     where x.dia between p_desde and p_hasta
       and x.origen_local_id is distinct from x.destino_local_id
       and (p_local is null or x.destino_local_id = p_local or x.origen_local_id = p_local)
       and (position(v_q in lower(i.codigo)) = 1
            or not exists (select 1 from regexp_split_to_table(v_q, '\s+') w
                            where position(w in translate(lower(coalesce(i.descripcion, '') || ' ' || coalesce(a.nombre, '')), 'áéíóúü', 'aeiouu')) = 0))
     group by x.id, i.codigo
  )
  select jsonb_build_object(
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', z.id, 'numero', z.numero, 'referencia', z.referencia, 'fecha', z.fecha, 'estado', z.estado,
               'origen_local_id', z.origen_local_id, 'origen', coalesce(lo.nombre, 'Fábrica'),
               'destino_local_id', z.destino_local_id, 'destino', coalesce(ld.nombre, 'Fábrica'),
               'observaciones', z.observaciones, 'codigo', z.codigo, 'descripcion', z.descripcion, 'recibido', z.recibido,
               'mandaron', case when v_ges or z.recibido or z.estado = 'anulado' or z.destino_local_id is null
                                     or pos_local_mio(z.origen_local_id) then z.mandaron end,
               'llegaron', z.llegaron) order by z.fecha desc, z.codigo)
        from (select * from g order by fecha desc, codigo limit 1000) z
        left join orden_locales ld on ld.id = z.destino_local_id
        left join orden_locales lo on lo.id = z.origen_local_id), '[]'::jsonb),
    'mas', (select count(*) > 1000 from g))
    into v_res;
  return v_res;
end $$;

revoke all on function pos_remitos_producto(text, date, date, uuid) from public, anon;
grant execute on function pos_remitos_producto(text, date, date, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 205 (30/10/2026) · LAS NOTAS DE CRÉDITO
--
--  Mauricio (30/10): "La nota de crédito la hacen para cancelar un ticket en
--  B. Guardo en el sistema un ticket en B que está mal, me olvidé de hacer
--  un descuento, le erré en algo. Entonces, para anular eso se hace una nota
--  de crédito." En BlueSoft (sus fotos del 30/10): en Tickets se abre el
--  ticket, «Generar nota crédito», se abre la nota con todo el ticket y
--  «Guardar». La venta queda anulada, se descuenta en el cierre de caja, en
--  el posnet se anula la operación y se hace una venta nueva bien hecha.
--  Los cambios siguen igual (sin nota de crédito).
--
--  · Las facturas A y B se anulan SÓLO con una nota de crédito (la X, con
--    «Anular la venta», como siempre). La nota anula el ticket entero: lo
--    vendido vuelve al stock, al socio se le descuentan los puntos y la
--    gift card vuelve a como estaba, igual que la anulación de siempre.
--  · Cada local numera sus notas aparte: NC-1, NC-2… (las de prueba, NCP-).
--  · ARCA: si el ticket tiene factura de ARCA, la nota queda «pendiente» y
--    se le va a pedir el CAE cuando el POS facture. Hoy ningún ticket tiene
--    factura (la hace BlueSoft): la nota queda «sin_factura», como el
--    ticket. Las de prueba no van.
--  · La caja: mientras la venta no entró en un cierre, al anularla sale de
--    la caja abierta. Si ya entró en un cierre, primero hay que anular ese
--    cierre (como los cambios).
--  Cambia pos_venta_anular (frena las A y B), pos_venta (trae la nota y el
--  cierre) y pos_tickets (el número de la nota en cada renglón).
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_notas_credito (
  id           uuid primary key default gen_random_uuid(),
  venta_id     uuid not null unique references pos_ventas(id) on delete cascade,   -- «Borrar las pruebas» se las lleva con su venta
  local_id     uuid not null references orden_locales(id),
  numero       int not null,
  prueba       boolean not null default false,
  letra        text not null check (letra in ('A', 'B')),
  fecha        timestamptz not null default clock_timestamp(),
  dia          date not null,
  hizo         uuid,                    -- quién la hizo (orden_personas)
  motivo       text not null,
  arca         text not null check (arca in ('pendiente', 'autorizada', 'sin_factura', 'no_va')),
  cae          text,
  cae_vence    date,
  arca_numero  bigint,
  unique (local_id, prueba, numero)
);
create index pos_notas_credito_dia on pos_notas_credito (dia);
alter table pos_notas_credito enable row level security;
revoke all on pos_notas_credito from anon, authenticated;

/* Lo que deshace una venta (era el cuerpo de pos_venta_anular): la marca anulada, devuelve lo vendido al stock, le
   descuenta los puntos al socio y deja la gift card como estaba. La usan la anulación (p_nc null) y la nota de crédito
   (p_nc = 'NC-3'). Quien la llama ya tiene la venta bloqueada y ya miró los permisos: por eso no se publica. */
create function pos_venta_deshacer(p_id uuid, p_motivo text, p_nc text) returns void
language plpgsql security definer set search_path = public as $$
declare v pos_ventas; m pos_stock_movs; v_usadas text;
begin
  select * into v from pos_ventas where id = p_id;
  /* SQL 200: la gift card que se vendió en esta venta no tiene que estar usada. */
  select string_agg(pos_gc_nombre(b.serie), ', ' order by i.item) into v_usadas
    from pos_venta_items i join beneficios b on b.id = i.beneficio
   where i.venta_id = p_id and b.usado is not null;
  if v_usadas is not null then
    raise exception 'La Gift Card % de esta venta ya se usó: la venta no se puede anular.', v_usadas;
  end if;
  update pos_ventas set estado = 'anulada', anulada_en = now(), anulada_por = orden_yo_id(), anulada_motivo = trim(p_motivo)
   where id = p_id;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo = 'venta' order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, 'venta_anulada', p_id,
                            m.ref || ' (' || coalesce('nota de crédito ' || p_nc, 'anulada') || ')');
  end loop;
  /* SQL 171: si la venta le sumó puntos a un socio, se le descuentan: el movimiento del Club queda anulado,
     como cuando se anula una carga en Cobrar. */
  if v.club_mov is not null then
    update club_movimientos
       set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS'),
           motivo_anul = coalesce('Nota de crédito ' || p_nc || ' en el POS: ', 'Venta anulada en el POS: ') || trim(p_motivo)
     where id = v.club_mov and anulado is null;
  end if;
  /* SQL 200: la gift card que se vendió vuelve a estar sin vender (se puede vender de nuevo: la venta anulada
     guarda cuál era y por cuánto) y la que pagó vuelve a estar disponible. */
  delete from beneficios b using pos_venta_items i where i.venta_id = p_id and i.beneficio = b.id;
  update beneficios b set usado = null, local_canje = null, vendedor_canje = null, monto_compra = null, canal_canje = null
    from pos_venta_pagos g
   where g.venta_id = p_id and g.medio = 'giftcard' and g.beneficio = b.id;
end $$;
revoke all on function pos_venta_deshacer(uuid, text, text) from public, anon, authenticated;

/* Anular la venta: ahora sólo la X (y la prueba X). Las A y B, con la nota de crédito. */
create or replace function pos_venta_anular(p_id uuid, p_motivo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v pos_ventas;
begin
  perform pos_permiso('anular');   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.factura is not null then raise exception 'Esa venta tiene factura de ARCA: se anula con una nota de crédito.'; end if;
  if v.letra <> 'X' then raise exception 'Las facturas A y B se anulan con una nota de crédito: en el ticket, «Nota de crédito».'; end if;
  perform pos_venta_deshacer(p_id, p_motivo, null);
  return true;
end $$;

/* La nota de crédito de una factura A o B: anula la venta entera y le da su número. */
create function pos_nc_hacer(p_venta uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pos_ventas; n pos_notas_credito; k pos_cierres; v_num int; v_id uuid; v_ref text;
begin
  perform pos_permiso('anular');
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se hace la nota de crédito.'; end if;
  select * into v from pos_ventas where id = p_venta;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  /* Un número por vez en cada local: si dos la hacen al mismo tiempo, el segundo espera (primero el candado, después la venta). */
  perform pg_advisory_xact_lock(hashtext('pos_nc:' || v.local_id::text || ':' || v.prueba::text));
  select * into v from pos_ventas where id = p_venta for update;
  select * into n from pos_notas_credito where venta_id = p_venta;
  if found then raise exception 'Esa venta ya tiene la nota de crédito %.', case when n.prueba then 'NCP-' else 'NC-' end || n.numero; end if;
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.letra = 'X' then raise exception 'La X es un comprobante interno: no lleva nota de crédito. Se anula con «Anular la venta».'; end if;
  if v.cierre_id is not null then
    select * into k from pos_cierres where id = v.cierre_id;
    raise exception 'Esa venta ya entró en el cierre de caja %: para hacerle la nota de crédito, primero hay que anular ese cierre.',
      case when k.prueba then 'P-' else 'Nº ' end || k.numero;
  end if;
  select coalesce(max(x.numero), 0) + 1 into v_num from pos_notas_credito x where x.local_id = v.local_id and x.prueba = v.prueba;
  v_ref := case when v.prueba then 'NCP-' else 'NC-' end || v_num;
  insert into pos_notas_credito (venta_id, local_id, numero, prueba, letra, dia, hizo, motivo, arca)
  values (v.id, v.local_id, v_num, v.prueba, v.letra, pos_hoy(), orden_yo_id(), trim(p_motivo),
          case when v.prueba then 'no_va' when v.factura is not null then 'pendiente' else 'sin_factura' end)
  returning id into v_id;
  perform pos_venta_deshacer(v.id, p_motivo, v_ref);
  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v.prueba, 'venta_id', v.id);
end $$;

/* Las notas de crédito del período, como el listado de BlueSoft: con el ticket que anula y lo que valía. */
create function pos_notas_credito(p_desde date, p_hasta date, p_local uuid default null, p_letra text default null, p_prueba boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with z as (
      select n.*, v.numero venta_numero, v.serie venta_serie, v.fecha venta_fecha, v.vendedor, v.cliente_nombre, v.cliente_doc,
             v.neto, v.descuentos, v.total, v.cantidad
        from pos_notas_credito n join pos_ventas v on v.id = n.venta_id
       where n.dia between p_desde and p_hasta
         and n.prueba = coalesce(p_prueba, false)
         and (p_local is null or n.local_id = p_local)
         and (p_letra is null or n.letra = p_letra)
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'venta_id', z.venta_id, 'numero', z.numero, 'prueba', z.prueba, 'letra', z.letra, 'fecha', z.fecha,
                 'local', l.nombre, 'local_id', z.local_id, 'motivo', z.motivo, 'arca', z.arca, 'cae', z.cae, 'arca_numero', z.arca_numero,
                 'hizo', (select p.nombre from orden_personas p where p.id = z.hizo),
                 'venta_numero', z.venta_numero, 'venta_serie', z.venta_serie, 'venta_fecha', z.venta_fecha,
                 'vendedor', z.vendedor, 'cliente', coalesce(z.cliente_nombre, 'Consumidor final'), 'cliente_doc', z.cliente_doc,
                 'medios', (select jsonb_agg(g.medio order by g.orden) from pos_venta_pagos g where g.venta_id = z.venta_id),
                 'neto', z.neto, 'descuentos', z.descuentos, 'total', z.total, 'cantidad', z.cantidad) order by z.fecha desc)
          from (select * from z order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object('notas', count(*), 'productos', coalesce(sum(cantidad), 0), 'neto', coalesce(sum(neto), 0),
                                            'descuentos', coalesce(sum(descuentos), 0), 'total', coalesce(sum(total), 0)) from z),
      'mas', (select count(*) > 500 from z)
    )
  );
end $$;

revoke all on function pos_nc_hacer(uuid, text), pos_notas_credito(date, date, uuid, text, boolean) from public, anon;
grant execute on function pos_nc_hacer(uuid, text), pos_notas_credito(date, date, uuid, text, boolean) to authenticated;

/* SQL 205: la venta trae su nota de crédito y su cierre (lo demás, igual). */
CREATE OR REPLACE FUNCTION public.pos_venta(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
              'puntos_sumados', exists (select 1 from club_movimientos m where m.id = v.club_mov and m.anulado is null),
              /* SQL 205: la nota de crédito que la anuló (con quién la hizo) y el cierre de caja en el que entró. */
              'nota_credito', (select to_jsonb(n) || jsonb_build_object('hizo_nombre', (select p.nombre from orden_personas p where p.id = n.hizo))
                                 from pos_notas_credito n where n.venta_id = v.id),
              'cierre', (select jsonb_build_object('id', k.id, 'numero', k.numero, 'prueba', k.prueba, 'estado', k.estado)
                           from pos_cierres k where k.id = v.cierre_id))
    into r
    from pos_ventas v join orden_locales l on l.id = v.local_id
   where v.id = p_id;
  if r is null then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);   -- SQL 190
  return r;
end $function$;

/* SQL 205: cada renglón de Tickets trae el número de su nota de crédito (lo demás, igual). */
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
      'mas', (select count(*) > 500 from v)
    )
  );
end $function$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 206 (31/10/2026) · EL REGISTRO DE TIEMPOS
--
--  Mauricio (31/10): el "Registro de tiempos" de BlueSoft, el de la huella:
--  "cada vendedor o encargado, cuando llega al local… pone su huella y le
--  detecta la hora". Sólo Entrada y Salida ("sólo aparece entrada y salida,
--  usamos eso"), y hay horarios cortados ("de 9 a 1 y de 5 a 9"): un día
--  puede tener dos turnos.
--  Gestión → Personal → Registro de tiempos. Por ahora los registros entran
--  a mano («Nuevo registro») o del Excel de BlueSoft («Subir de BlueSoft»);
--  la huella viene después (origen 'huella', con su terminal).
--  · pos_tiempos: cada entrada o salida de una persona, con su sucursal, de
--    dónde vino (huella, a mano o BlueSoft), quién la cargó y, si se anuló,
--    por qué. Lo anulado queda (tachado) y no cuenta.
--  · pos_tiempos_bluesoft: quién es quién en el Excel de BlueSoft (su
--    «Código Persona» en cada sucursal), para no elegirlo cada vez.
--  Lo que sube de BlueSoft no se repite (el ID de BlueSoft de esa sucursal)
--  y cada subida se puede deshacer entera (su lote).
--  Todo es de la oficina (pos_permiso('gestion')).
-- ═══════════════════════════════════════════════════════════════════════════

create table pos_tiempos (
  id              bigint generated always as identity primary key,
  persona_id      uuid not null references orden_personas(id),
  local_id        uuid references orden_locales(id),
  momento         timestamptz not null,
  dia             date not null,                       -- el día en Argentina
  tipo            text not null check (tipo in ('entrada', 'salida')),
  origen          text not null check (origen in ('huella', 'manual', 'bluesoft')),
  terminal        text,
  observaciones   text,
  cargado_por     uuid,
  cargado_en      timestamptz not null default clock_timestamp(),
  estado          text not null default 'ok' check (estado in ('ok', 'anulado')),
  anulado_en      timestamptz,
  anulado_por     uuid,
  anulado_motivo  text,
  externo         text unique,                         -- 'bluesoft:<sucursal>:<ID de BlueSoft>': no se sube dos veces
  lote            uuid,                                -- la subida de BlueSoft: se deshace entera
  clave           text unique                          -- la del «Nuevo registro»: tocar dos veces Guardar no lo repite
);
create index pos_tiempos_dia on pos_tiempos (dia, local_id);
create index pos_tiempos_persona on pos_tiempos (persona_id, momento);
create index pos_tiempos_lote on pos_tiempos (lote) where lote is not null;
alter table pos_tiempos enable row level security;
revoke all on pos_tiempos from anon, authenticated;

/* En el Excel de BlueSoft cada persona tiene su «Código Persona» (00001109) y su nombre corto (Lau). Se elige una vez
   quién es en el sistema y queda para la próxima subida de esa sucursal. persona_id null = no se sube. */
create table pos_tiempos_bluesoft (
  local_id     uuid not null references orden_locales(id),
  codigo       text not null,
  nombre       text,
  persona_id   uuid references orden_personas(id),
  cambiado_en  timestamptz not null default now(),
  primary key (local_id, codigo)
);
alter table pos_tiempos_bluesoft enable row level security;
revoke all on pos_tiempos_bluesoft from anon, authenticated;

/* Los registros del período (todas las sucursales o una), los más nuevos primero, como listas cortas para que viaje
   poco: [id, persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, estado]. Los turnos y las
   horas los arma la pantalla. Con las personas: las activas y las que tienen registros en el período (con sus
   francos, ISO 1..7). */
create function pos_tiempos(p_desde date, p_hasta date, p_local uuid default null, p_persona uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with t as (
      select x.* from pos_tiempos x
       where x.dia between p_desde and p_hasta
         and (p_local is null or x.local_id = p_local)
         and (p_persona is null or x.persona_id = p_persona)
    )
    select jsonb_build_object(
      'hoy', pos_hoy(),
      'filas', coalesce((
        select jsonb_agg(jsonb_build_array(z.id, z.persona_id, z.local_id, z.momento, z.dia, z.tipo, z.origen, z.terminal,
                                           z.observaciones, z.estado) order by z.momento desc, z.id desc)
          from (select * from t order by momento desc, id desc limit 20000) z), '[]'::jsonb),
      'mas', (select count(*) > 20000 from t),
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial), 'apellido', p.apellido,
                                            'local_id', p.local_id, 'rol', p.rol, 'activo', p.activo and p.aprobado,
                                            'francos', to_jsonb(p.dias_libres)) order by p.nombre, p.apellido)
          from orden_personas p
         where (p.activo and p.aprobado) or exists (select 1 from t where t.persona_id = p.id)), '[]'::jsonb)
    ));
end $$;

/* Un registro entero, para su ventana: quién lo cargó, de qué subida vino y, si se anuló, quién y por qué. */
create function pos_tiempo(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform pos_permiso('gestion');
  select jsonb_build_object(
           'id', x.id, 'persona_id', x.persona_id, 'persona', orden_nombre_lista(p.nombre, p.inicial), 'apellido', p.apellido,
           'local_id', x.local_id, 'local', l.nombre, 'momento', x.momento, 'dia', x.dia, 'tipo', x.tipo, 'origen', x.origen,
           'terminal', x.terminal, 'observaciones', x.observaciones, 'externo', x.externo, 'lote', x.lote,
           'cargado_en', x.cargado_en,
           'cargado_por', (select orden_nombre_lista(c.nombre, c.inicial) from orden_personas c where c.id = x.cargado_por),
           'estado', x.estado, 'anulado_en', x.anulado_en, 'anulado_motivo', x.anulado_motivo,
           'anulado_por', (select orden_nombre_lista(c.nombre, c.inicial) from orden_personas c where c.id = x.anulado_por))
    into v
    from pos_tiempos x
    join orden_personas p on p.id = x.persona_id
    left join orden_locales l on l.id = x.local_id
   where x.id = p_id;
  if v is null then raise exception 'Ese registro ya no está.'; end if;
  return v;
end $$;

/* «Nuevo registro»: una entrada o una salida, o el día entero (corrido: entrada y salida; cortado: dos de cada una),
   de una persona en un día. Va todo o nada. Con la hora de Argentina; nada que todavía no pasó; las horas en orden;
   sin repetir una que ya está (la misma persona, el mismo tipo, en el mismo minuto). Se dice por qué se carga a mano.
   p: {clave, persona_id, local_id, dia, observaciones, registros: [{tipo, hora: 'HH:MM'}, …]} (de 1 a 4). */
create function pos_tiempo_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_clave   text := nullif(btrim(coalesce(p->>'clave', '')), '');
  v_persona uuid;
  v_local   uuid;
  v_dia     date;
  v_nombre  text;
  v_obs     text := left(btrim(coalesce(p->>'observaciones', '')), 200);
  v_r       record;
  v_tipo    text;
  v_hora    text;
  v_mom     timestamptz;
  v_ant     timestamptz;
  v_id      bigint;
  v_ids     bigint[] := '{}';
begin
  perform pos_permiso('gestion');
  /* Tocaron dos veces Guardar: lo que ya se guardó con esa clave. */
  if v_clave is not null and exists (select 1 from pos_tiempos where clave = v_clave || ':1') then
    return jsonb_build_object('ids', (select jsonb_agg(id order by id) from pos_tiempos where clave like v_clave || ':_'), 'repetido', true);
  end if;
  begin
    v_persona := nullif(p->>'persona_id', '')::uuid;
    v_local := nullif(p->>'local_id', '')::uuid;
    v_dia := nullif(p->>'dia', '')::date;
  exception when others then
    raise exception 'Faltan datos: la sucursal, la persona o la fecha no se entienden.';
  end;
  select orden_nombre_lista(x.nombre, x.inicial) into v_nombre from orden_personas x where x.id = v_persona;
  if v_nombre is null then raise exception 'Elegí la persona.'; end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local) then raise exception 'Elegí la sucursal.'; end if;
  if v_dia is null then raise exception 'Elegí la fecha.'; end if;
  if v_dia > pos_hoy() then raise exception 'No se puede cargar un día que todavía no llegó.'; end if;
  if v_dia < pos_hoy() - 400 then raise exception 'Esa fecha es de hace más de un año.'; end if;
  if length(v_obs) < 3 then raise exception 'Escribí por qué se carga a mano (por ejemplo: se olvidó de poner la huella).'; end if;
  if jsonb_typeof(p->'registros') is distinct from 'array' or jsonb_array_length(p->'registros') not between 1 and 4 then
    raise exception 'No hay nada para guardar.';
  end if;
  for v_r in select e.x, e.n from jsonb_array_elements(p->'registros') with ordinality e(x, n) order by e.n loop
    v_tipo := v_r.x->>'tipo';
    v_hora := btrim(coalesce(v_r.x->>'hora', ''));
    if v_tipo is null or v_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es una entrada o una salida.'; end if;
    if v_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'La hora «%» no se entiende: escribila como 09:00.', v_hora; end if;
    v_mom := (v_dia + v_hora::time) at time zone 'America/Argentina/Buenos_Aires';
    if v_mom > now() + interval '5 minutes' then raise exception 'Las % todavía no pasaron: se carga cuando pase.', v_hora; end if;
    if v_ant is not null and v_mom <= v_ant then raise exception 'Las horas tienen que ir en orden: las % van después de la anterior.', v_hora; end if;
    v_ant := v_mom;
    if exists (select 1 from pos_tiempos x where x.persona_id = v_persona and x.tipo = v_tipo and x.estado = 'ok'
                and x.momento > v_mom - interval '1 minute' and x.momento < v_mom + interval '1 minute') then
      raise exception 'Ya está cargada la % de las % de %.', v_tipo, v_hora, rtrim(v_nombre, '.');   -- "de Nano M." sin otro punto
    end if;
    insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, observaciones, cargado_por, clave)
    values (v_persona, v_local, v_mom, v_dia, v_tipo, 'manual', v_obs, orden_yo_id(),
            case when v_clave is not null then v_clave || ':' || v_r.n end)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('ids', to_jsonb(v_ids), 'persona', v_nombre);
end $$;

/* Anular un registro (cargado mal, repetido…): queda tachado, con quién y por qué, y deja de contar. */
create function pos_tiempo_anular(p_id bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pos_tiempos;
begin
  perform pos_permiso('gestion');
  if length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_tiempos where id = p_id for update;
  if v.id is null then raise exception 'Ese registro ya no está.'; end if;
  if v.estado = 'anulado' then raise exception 'Ese registro ya estaba anulado.'; end if;
  update pos_tiempos set estado = 'anulado', anulado_en = clock_timestamp(), anulado_por = orden_yo_id(), anulado_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
  return jsonb_build_object('id', p_id);
end $$;

/* Quién es quién en el Excel de BlueSoft de esa sucursal, según la última subida: {"00001109": {nombre, persona_id}}. */
create function pos_tiempos_bluesoft(p_local uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  return coalesce((select jsonb_object_agg(b.codigo, jsonb_build_object('nombre', b.nombre, 'persona_id', b.persona_id))
                     from pos_tiempos_bluesoft b where b.local_id = p_local), '{}'::jsonb);
end $$;

/* «Subir de BlueSoft»: el Excel del Registro de tiempos de BlueSoft de una sucursal (lo lee la pantalla).
   p_mapa: [{codigo, nombre, persona_id|null}] (queda guardado para la próxima); p_filas: [{id, codigo, fecha
   'AAAA-MM-DD', hora 'HH:MM[:SS]', tipo entrada|salida, terminal, observaciones}]. Se sube lo de las personas
   elegidas; lo que ya estaba (el mismo ID de BlueSoft en esa sucursal) no se repite. Todo en un lote, que se
   deshace con pos_tiempos_deshacer. */
create function pos_tiempos_subir(p_local uuid, p_mapa jsonb, p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lote  uuid := gen_random_uuid();
  v_total int;
  v_con   int;
  v_subidos int;
  v_mal   text;
begin
  perform pos_permiso('gestion');
  if p_local is null or not exists (select 1 from orden_locales where id = p_local) then raise exception 'Elegí la sucursal.'; end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then raise exception 'El archivo no trae registros.'; end if;
  v_total := jsonb_array_length(p_filas);
  if v_total > 20000 then raise exception 'Son demasiados registros juntos (máximo 20.000): exportalo de BlueSoft con menos fechas.'; end if;
  /* Lo que no se entiende frena todo, antes de guardar nada. */
  select coalesce(nullif(x->>'id', ''), '(sin ID)') into v_mal
    from jsonb_array_elements(p_filas) x
   where coalesce(x->>'fecha', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(x->>'hora', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      or coalesce(x->>'tipo', '') not in ('entrada', 'salida')
      or btrim(coalesce(x->>'codigo', '')) = ''
   limit 1;
  if v_mal is not null then raise exception 'El registro % de BlueSoft no se entiende (la fecha, la hora, el tipo o la persona).', v_mal; end if;
  select coalesce(x->>'id', '') into v_mal
    from jsonb_array_elements(p_filas) x
   where (x->>'fecha')::date > pos_hoy() or (x->>'fecha')::date < date '2015-01-01'
   limit 1;
  if found then raise exception 'El registro % de BlueSoft tiene una fecha que no puede ser.', v_mal; end if;

  insert into pos_tiempos_bluesoft (local_id, codigo, nombre, persona_id, cambiado_en)
  select distinct on (left(btrim(m->>'codigo'), 40)) p_local, left(btrim(m->>'codigo'), 40), left(btrim(coalesce(m->>'nombre', '')), 80),
         (select o.id from orden_personas o where o.id::text = m->>'persona_id'), now()
    from jsonb_array_elements(coalesce(p_mapa, '[]'::jsonb)) m
   where btrim(coalesce(m->>'codigo', '')) <> ''
  on conflict (local_id, codigo) do update set nombre = excluded.nombre, persona_id = excluded.persona_id, cambiado_en = excluded.cambiado_en;

  with f as (
    select left(btrim(coalesce(x->>'id', '')), 40) bid, left(btrim(x->>'codigo'), 40) codigo, (x->>'fecha')::date dia, (x->>'hora')::time hora,
           x->>'tipo' tipo, nullif(left(btrim(coalesce(x->>'terminal', '')), 60), '') terminal,
           nullif(left(btrim(coalesce(x->>'observaciones', '')), 200), '') obs
      from jsonb_array_elements(p_filas) x
  ), v as (
    select f.*, b.persona_id,
           'bluesoft:' || p_local || ':' || case when f.bid <> '' then f.bid else f.codigo || '|' || f.dia || '|' || f.hora || '|' || f.tipo end externo
      from f join pos_tiempos_bluesoft b on b.local_id = p_local and b.codigo = f.codigo
     where b.persona_id is not null
  ), ins as (
    insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, cargado_por, externo, lote)
    select v.persona_id, p_local, (v.dia + v.hora) at time zone 'America/Argentina/Buenos_Aires', v.dia, v.tipo, 'bluesoft', v.terminal, v.obs,
           orden_yo_id(), v.externo, v_lote
      from v
    on conflict (externo) do nothing
    returning 1
  )
  select (select count(*) from v), (select count(*) from ins) into v_con, v_subidos;
  return jsonb_build_object('lote', case when v_subidos > 0 then v_lote end, 'total', v_total, 'subidos', v_subidos,
                            'ya_estaban', v_con - v_subidos, 'sin_persona', v_total - v_con);
end $$;

/* Deshacer una subida de BlueSoft entera (se eligió mal la sucursal o una persona): borra lo que subió ese lote. */
create function pos_tiempos_deshacer(p_lote uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pos_permiso('gestion');
  if p_lote is null then raise exception 'No hay nada para deshacer.'; end if;
  delete from pos_tiempos where lote = p_lote and origen = 'bluesoft';
  get diagnostics n = row_count;
  return jsonb_build_object('borrados', n);
end $$;

revoke all on function pos_tiempos(date, date, uuid, uuid) from public, anon;
revoke all on function pos_tiempo(bigint) from public, anon;
revoke all on function pos_tiempo_guardar(jsonb) from public, anon;
revoke all on function pos_tiempo_anular(bigint, text) from public, anon;
revoke all on function pos_tiempos_bluesoft(uuid) from public, anon;
revoke all on function pos_tiempos_subir(uuid, jsonb, jsonb) from public, anon;
revoke all on function pos_tiempos_deshacer(uuid) from public, anon;
grant execute on function pos_tiempos(date, date, uuid, uuid) to authenticated;
grant execute on function pos_tiempo(bigint) to authenticated;
grant execute on function pos_tiempo_guardar(jsonb) to authenticated;
grant execute on function pos_tiempo_anular(bigint, text) to authenticated;
grant execute on function pos_tiempos_bluesoft(uuid) to authenticated;
grant execute on function pos_tiempos_subir(uuid, jsonb, jsonb) to authenticated;
grant execute on function pos_tiempos_deshacer(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 208 (31/10/2026) · LAS LLEGADAS (Supervisión → Llegadas)
--
--  Mauricio (31/10), con la foto de la planilla que manda Anto, la gerente,
--  a los supervisores ("09 RDT Septiembre 2026": una solapa por zona, Calle,
--  Shopping y Mdq; cada empleado con su local, la hora a la que llegó cada
--  día en verde o en rojo, las llegadas tarde, el «Check» y el «Descuento»):
--  "así se tendría que ver dentro de supervisión … estaría bueno verlo día
--  a día".
--  La regla (31/10): "si se pasa 10 minutos, ya es un apercibimiento por
--  llegada tarde … si llega antes, no pasa nada … lo único que se puede
--  poner tarde es … la mañana; en el cortado no manejamos todavía". La hora
--  es la de apertura de cada local (Ajustes → El local) y, los domingos, la
--  suya si es otra ("Rivadavia abre a las 9, pero los domingos abrimos a las
--  10"); los días que el local no abre no cuentan ("hay locales que cierran
--  los domingos"). Las cuentas las hace la pantalla.
--  · pos_tiempos_locales: la zona de cada local y, si los domingos abre a
--    otra hora, cuál.
--  · pos_tiempos_control: el «Check» y el «Descuento» (una nota libre) de
--    cada persona, por mes.
--  Lee el registro de tiempos del SQL 206. Lo ven la supervisión de cada
--  local, la gerencia y la administración (orden_ve_equipo); el «Check» y el
--  «Descuento» los anotan el supervisor del local y la administración; la
--  zona y el domingo, la administración.
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 206 las funciones se crearían igual y fallarían al usarlas: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regclass('public.pos_tiempos') is null then
    raise exception 'Primero hay que correr el SQL 206 (el registro de tiempos): está en App Orden.';
  end if;
end $$;

create table pos_tiempos_locales (
  local_id          uuid primary key references orden_locales(id),
  zona              text not null check (zona in ('calle', 'shopping', 'mdq')),
  apertura_domingo  time,                                  -- null: los domingos abre a la hora de siempre
  cambiado_por      uuid,
  cambiado_en       timestamptz not null default now()
);
alter table pos_tiempos_locales enable row level security;
revoke all on pos_tiempos_locales from anon, authenticated;

/* Las solapas de la planilla de Anto. Rivadavia (el local de Mar del Plata) los domingos abre a las 10. */
insert into pos_tiempos_locales (local_id, zona, apertura_domingo)
select l.id,
       case when l.codigo in ('DOT', 'PARQUE BROWN', 'SAN JUSTO SHOPPING', 'UNICENTER') then 'shopping'
            when l.codigo = 'MAR DEL PLATA' then 'mdq'
            else 'calle' end,
       case when l.codigo = 'MAR DEL PLATA' then time '10:00' end
  from orden_locales l;

create table pos_tiempos_control (
  persona_id      uuid not null references orden_personas(id),
  mes             date not null check (mes = date_trunc('month', mes)::date),
  controlado      boolean not null default false,
  controlado_por  uuid,
  controlado_en   timestamptz,
  descuento       text,
  descuento_por   uuid,
  descuento_en    timestamptz,
  primary key (persona_id, mes)
);
alter table pos_tiempos_control enable row level security;
revoke all on pos_tiempos_control from anon, authenticated;

/* El «Check» y el «Descuento» de una fila, como los devuelven las dos funciones. */
create function pos_llegadas_control_json(c pos_tiempos_control) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'persona_id', c.persona_id, 'mes', c.mes, 'controlado', c.controlado, 'controlado_en', c.controlado_en,
    'controlado_por', (select orden_nombre_lista(q.nombre, q.inicial) from orden_personas q where q.id = c.controlado_por),
    'descuento', c.descuento, 'descuento_en', c.descuento_en,
    'descuento_por', (select orden_nombre_lista(q.nombre, q.inicial) from orden_personas q where q.id = c.descuento_por))
$$;

/* Las llegadas del período en los locales que ve quien entró: los locales (con su zona, los días que abre, la hora y la
   de los domingos, y si puede anotar), las personas (las activas de esos locales y las que marcaron ahí, con sus
   francos, ISO 1..7), las marcas que valen como listas cortas [id, persona_id, local_id, momento, dia, tipo, origen,
   observaciones] y el «Check» y el «Descuento» de los meses del período. Una marca sin local cuenta en el de la
   persona; un local nuevo, sin zona todavía, va con los de la calle. */
create function pos_llegadas(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_locales uuid[];
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 92 then raise exception 'El período es demasiado largo (máximo, tres meses).'; end if;
  select coalesce(array_agg(l.id), '{}') into v_locales from orden_locales l where l.activo and orden_ve_equipo(l.id);
  if cardinality(v_locales) = 0 then raise exception 'Las llegadas son para la supervisión de los locales.'; end if;
  return (
    with t as (
      select x.id, x.persona_id, coalesce(x.local_id, p.local_id) local_id, x.momento, x.dia, x.tipo, x.origen, x.observaciones
        from pos_tiempos x
        join orden_personas p on p.id = x.persona_id
       where x.dia between p_desde and p_hasta and x.estado = 'ok'
         and coalesce(x.local_id, p.local_id) = any (v_locales)
    ), ps as (
      select p.* from orden_personas p
       where (p.activo and p.aprobado and p.local_id = any (v_locales) and p.rol in ('vendedor', 'supervisor'))
          or exists (select 1 from t where t.persona_id = p.id)
    )
    select jsonb_build_object(
      'hoy', pos_hoy(),
      'locales', coalesce((
        select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'zona', coalesce(z.zona, 'calle'), 'dias', to_jsonb(l.dias_abiertos),
                                            'abre', left(l.hora_apertura::text, 5), 'abre_domingo', left(z.apertura_domingo::text, 5),
                                            'editar', orden_es_supervisor_de(l.id)) order by l.nombre)
          from orden_locales l left join pos_tiempos_locales z on z.local_id = l.id
         where l.id = any (v_locales)), '[]'::jsonb),
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial), 'apellido', p.apellido,
                                            'local_id', p.local_id, 'rol', p.rol, 'activo', p.activo and p.aprobado,
                                            'francos', to_jsonb(p.dias_libres)) order by p.nombre, p.apellido)
          from ps p), '[]'::jsonb),
      'filas', coalesce((
        select jsonb_agg(jsonb_build_array(t.id, t.persona_id, t.local_id, t.momento, t.dia, t.tipo, t.origen, t.observaciones)
                         order by t.momento, t.id)
          from t), '[]'::jsonb),
      'control', coalesce((
        select jsonb_agg(pos_llegadas_control_json(c))
          from pos_tiempos_control c
         where c.mes between date_trunc('month', p_desde)::date and p_hasta
           and c.persona_id in (select id from ps)), '[]'::jsonb)
    ));
end $$;

/* El «Check» (p_controlado) o el «Descuento» (p_descuento; '' lo borra) de una persona en un mes: lo que viene en null
   no se toca. Lo anotan el supervisor de su local y la administración; lo de cada uno, otro. */
create function pos_llegadas_control(p_persona uuid, p_mes date, p_controlado boolean default null, p_descuento text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_yo    uuid := orden_yo_id();
  v_mes   date := date_trunc('month', p_mes)::date;
  v_desc  text := nullif(left(btrim(coalesce(p_descuento, '')), 300), '');
  v_c     pos_tiempos_control;
begin
  if p_persona is null or p_mes is null then raise exception 'Falta la persona o el mes.'; end if;
  if p_controlado is null and p_descuento is null then raise exception 'No hay nada para anotar.'; end if;
  select local_id into v_local from orden_personas where id = p_persona;
  if not found then raise exception 'Esa persona ya no está.'; end if;
  if not orden_es_supervisor_de(v_local) then raise exception 'Lo anotan el supervisor de su local o la administración.'; end if;
  if p_persona = v_yo and not orden_es_admin() then raise exception 'Lo tuyo lo anota otro.'; end if;
  if v_mes > date_trunc('month', pos_hoy())::date then raise exception 'Ese mes todavía no empezó.'; end if;
  insert into pos_tiempos_control as c (persona_id, mes, controlado, controlado_por, controlado_en, descuento, descuento_por, descuento_en)
  values (p_persona, v_mes, coalesce(p_controlado, false),
          case when p_controlado is not null then v_yo end, case when p_controlado is not null then now() end,
          v_desc, case when p_descuento is not null then v_yo end, case when p_descuento is not null then now() end)
  on conflict (persona_id, mes) do update set
    controlado     = coalesce(p_controlado, c.controlado),
    controlado_por = case when p_controlado is not null then v_yo else c.controlado_por end,
    controlado_en  = case when p_controlado is not null then now() else c.controlado_en end,
    descuento      = case when p_descuento is not null then v_desc else c.descuento end,
    descuento_por  = case when p_descuento is not null then v_yo else c.descuento_por end,
    descuento_en   = case when p_descuento is not null then now() else c.descuento_en end
  returning * into v_c;
  return pos_llegadas_control_json(v_c);
end $$;

/* La zona de un local y la hora a la que abre los domingos (null: la de siempre). Sólo la administración. */
create function pos_llegadas_local(p_local uuid, p_zona text, p_apertura_domingo time default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not orden_es_admin() then raise exception 'La zona y el horario de los domingos los cambia la administración.'; end if;
  if p_zona is null or p_zona not in ('calle', 'shopping', 'mdq') then raise exception 'Elegí la zona del local.'; end if;
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'Ese local no está.'; end if;
  insert into pos_tiempos_locales as z (local_id, zona, apertura_domingo, cambiado_por, cambiado_en)
  values (p_local, p_zona, p_apertura_domingo, orden_yo_id(), now())
  on conflict (local_id) do update set zona = excluded.zona, apertura_domingo = excluded.apertura_domingo,
                                       cambiado_por = excluded.cambiado_por, cambiado_en = excluded.cambiado_en;
  return jsonb_build_object('local_id', p_local, 'zona', p_zona, 'abre_domingo', left(p_apertura_domingo::text, 5));
end $$;

revoke all on function pos_llegadas_control_json(pos_tiempos_control) from public, anon, authenticated;
revoke all on function pos_llegadas(date, date) from public, anon;
revoke all on function pos_llegadas_control(uuid, date, boolean, text) from public, anon;
revoke all on function pos_llegadas_local(uuid, text, time) from public, anon;
grant execute on function pos_llegadas(date, date) to authenticated;
grant execute on function pos_llegadas_control(uuid, date, boolean, text) to authenticated;
grant execute on function pos_llegadas_local(uuid, text, time) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 212 (31/10/2026) · VENDER SIN INTERNET
--
--  Mauricio (31/10): "vender sin internet, sí, eso lo podés empezar a hacer
--  ahora". Antes, si se cortaba internet, la venta no se guardaba ("No se pudo
--  guardar: sin conexión") y el cliente esperaba. Ahora la pantalla la guarda
--  en la compu y la manda sola, en orden, cuando vuelve internet (pos.js: la
--  "fila" pos_cola). La base le da el número recién cuando llega.
--
--  · pos_ventas.sin_internet: a qué hora llegó la venta que se hizo sin
--    internet (vacío en las de siempre).
--  · pos_venta_guardar: la venta de la fila trae "hecha", la hora de la compu
--    cuando se hizo. Vale ésa para la fecha y el día (con tope: no después de
--    ahora ni antes de 3 días), así queda en su día aunque llegue mañana. Lo
--    demás, igual. Sin "hecha", como siempre.
--  · La caja la toma igual que a cualquier venta sin cierre (cierre_id vacío):
--    entra en la caja abierta. Por eso el cierre de la pantalla no deja cerrar
--    mientras en esa compu queden ventas sin mandar.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pos_ventas add column if not exists sin_internet timestamptz;
comment on column pos_ventas.sin_internet is
  'SQL 212: la venta se hizo sin internet y llegó a la base a esta hora (fecha es cuando se hizo). Vacío en las de siempre.';

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
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
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet)   -- SQL 212: fecha y sin_internet
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * v_total / v_neto, 2) else 0 end,
                v_pago, pos_hoy() + 30, v_locod, v_vend,
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio)
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid);
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
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
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). */
    v_gana := floor((greatest(v_total - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $function$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 215 (31/10/2026) · EL INTERÉS DE LAS CUOTAS EN LA VENTA
--
--  Mauricio (31/10): "En tickets tenemos interés a partir de 80 mil pesos en
--  tres cuotas, un 8 %, y en seis cuotas a partir de 150 mil, sin interés;
--  menos de eso es un 17 %. Esto predefinido tiene que venir así, pero podemos
--  tener la opción de destildar el interés." O sea: 3 cuotas sin interés desde
--  $80.000 (con menos, 8 %) y 6 cuotas sin interés desde $150.000 (con menos,
--  17 %). A veces se hace una excepción y se cobra sin interés igual.
--
--  · La pantalla (pos.js) calcula el interés sobre lo que se paga en esas
--    cuotas (la regla mira el total del ticket) y lo trae ya puesto; con el
--    tilde sacado, es la excepción.
--  · pos_ventas.interes: lo que se sumó por las cuotas (va en el total, que es
--    lo que se cobra en la tarjeta). interes_nota: el renglón del ticket
--    («Interés 3 cuotas (8 %)»). sin_interes: se hizo sin interés aunque
--    correspondía (la excepción, para poder verlas).
--  · pos_venta_guardar: suma el interés al total y mira que tenga sentido (no
--    negativo, no más que la venta, con una tarjeta en cuotas). Los puntos del
--    Club y la gift card que se vende van sin el interés. Lo demás, igual al
--    SQL 212.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pos_ventas add column if not exists interes numeric(12,2) not null default 0;
alter table pos_ventas add column if not exists interes_nota text;
alter table pos_ventas add column if not exists sin_interes boolean not null default false;
comment on column pos_ventas.interes is 'SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 con menos de $150.000, 17 %). Va en el total.';
comment on column pos_ventas.interes_nota is 'SQL 215: el renglón del interés en el ticket («Interés 3 cuotas (8 %)», o la excepción).';
comment on column pos_ventas.sin_interes is 'SQL 215: se cobró sin interés aunque la regla lo pedía (la excepción, con el tilde sacado).';

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
  /* SQL 215: el interés de las cuotas (lo calcula la pantalla) y la excepción sin interés. */
  v_interes numeric := round(coalesce(nullif(p->>'interes', '')::numeric, 0), 2);
  v_intnota text := nullif(trim(coalesce(p->>'interes_nota', '')), '');
  v_sinint  boolean := coalesce(nullif(p->>'sin_interes', '')::boolean, false);
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
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
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;
  /* SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 cuotas con menos de $150.000, 17 %) se
     suma al total: es lo que se cobra en la tarjeta. Lo calcula la pantalla; acá, que tenga sentido. */
  if v_interes is null or v_interes < 0 then raise exception 'El interés de las cuotas no es válido.'; end if;
  if v_interes > v_total then raise exception 'El interés de las cuotas es más que la venta.'; end if;
  v_total := v_total + v_interes;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  /* SQL 215 */
  if (v_interes > 0 or v_sinint)
     and not exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1) then
    raise exception 'El interés de las cuotas va sólo pagando con tarjeta en cuotas.';
  end if;
  if v_interes = 0 and not v_sinint then v_intnota := null; end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet,   -- SQL 212: fecha y sin_internet
                          interes, interes_nota, sin_interes)                   -- SQL 215
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end,
          v_interes, v_intnota, v_sinint)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * (v_total - v_interes) / v_neto, 2) else 0 end,   -- SQL 215: sin el interés
                v_pago, pos_hoy() + 30, v_locod, v_vend,
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio)
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid);
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
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
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). SQL 215: el interés tampoco. */
    v_gana := floor((greatest(v_total - v_interes - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_interes - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $function$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 218 (31/10/2026) · EL FICHERO CON QR (Ingreso y egreso)
--
--  Mauricio (31/10): "sería como un fichero de los viejos que vos fichabas,
--  pero ahora con el QR fichás. Entrá y salí." En la compu de cada local
--  (fichero.html) se ve un QR que cambia cada 30 segundos; el vendedor lo
--  escanea desde Equipo VDH (la camarita → Papeles → Fichar) y queda su
--  entrada o su salida en el registro de tiempos (SQL 206), con la hora en
--  que lo escaneó y el origen 'celular'. Sin selfie ("con selfie no te
--  falta") y sin la huella.
--  · El QR no es un enlace: lo lee sólo la app, con la persona adentro con
--    su usuario. Cada QR vale un minuto, a lo sumo: una foto pasada por
--    WhatsApp llega vencida.
--  · Un celular por persona: el primero desde el que ficha cada uno queda
--    como el suyo (un número al azar que guarda la app). Si ficha desde
--    otro, o desde un celular fichan dos personas el mismo día, la marca
--    queda igual pero con un aviso, que la supervisión ve en Llegadas (y
--    ahí, «Es su celular nuevo»).
--  · pos_fichero: el secreto con el que se firman los QR (uno solo; nunca
--    sale de la base).
--  · pos_fichero_celulares: el celular de cada persona.
--  Escribe en el registro de tiempos del SQL 206.
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 206 no hay dónde anotar: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regclass('public.pos_tiempos') is null then
    raise exception 'Primero hay que correr el SQL 206 (el registro de tiempos): está en App Orden.';
  end if;
end $$;

create table pos_fichero (
  id       int primary key default 1 check (id = 1),
  secreto  bytea not null default extensions.gen_random_bytes(32),
  creado   timestamptz not null default now()
);
insert into pos_fichero default values;
alter table pos_fichero enable row level security;
revoke all on pos_fichero from anon, authenticated;

create table pos_fichero_celulares (
  persona_id    uuid primary key references orden_personas(id),
  celular       text not null unique,                    -- el número al azar que guarda la app en ese celular
  desde         timestamptz not null default now(),
  cambiado_por  uuid                                     -- null: quedó solo, la primera vez que fichó
);
alter table pos_fichero_celulares enable row level security;
revoke all on pos_fichero_celulares from anon, authenticated;

alter table pos_tiempos drop constraint pos_tiempos_origen_check;
alter table pos_tiempos add constraint pos_tiempos_origen_check check (origen in ('huella', 'manual', 'bluesoft', 'celular'));
alter table pos_tiempos add column celular text;          -- SQL 218: desde qué celular fichó (origen 'celular')

/* La firma de un QR: la compu y la ventana de 30 segundos, con el secreto. 16 letras alcanzan (nadie las adivina). */
create function pos_fichero_firma(p_caja bigint, p_ventana bigint) returns text
language sql stable security definer set search_path = public as $$
  select left(encode(extensions.hmac(convert_to('VDHF1.' || p_caja || '.' || p_ventana, 'UTF8'), f.secreto, 'sha256'), 'hex'), 16)
    from pos_fichero f where f.id = 1
$$;

/* La compu del local (fichero.html) pide sus QR: el de ahora y los de los próximos dos minutos (uno cada 30 segundos),
   con la hora de la base, para que la pantalla los cambie a tiempo aunque el reloj de la compu ande mal. Y las
   últimas marcas de hoy en ese local. Hace falta la llave de la compu habilitada (la de Cobrar); anda sin nadie
   adentro. */
create function pos_fichero_qr(p_caja text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_cod   text := club_caja_local(p_caja);
  v_caja  bigint;
  v_loc   orden_locales;
  v_ahora timestamptz := clock_timestamp();
  v_w     bigint;
begin
  if v_cod is null then
    raise exception 'Esta compu no está habilitada como la de un local: se habilita en Config → General → Las compus de los locales.';
  end if;
  select id into v_caja from club_cajas where llave_hash = club_caja_hash(p_caja) and baja is null;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_cod)) limit 1;
  if v_loc.id is null then raise exception 'El local de esta compu (%) no está en el sistema.', v_cod; end if;
  v_w := floor(extract(epoch from v_ahora) / 30)::bigint;
  return jsonb_build_object(
    'local_id', v_loc.id,
    'local', v_loc.nombre,
    'ahora_ms', floor(extract(epoch from v_ahora) * 1000)::bigint,
    'codigos', (select jsonb_agg(jsonb_build_array(w, 'VDHF1.' || v_caja || '.' || w || '.' || pos_fichero_firma(v_caja, w)) order by w)
                  from generate_series(v_w, v_w + 4) w),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_array(u.nombre, u.tipo, u.hora) order by u.momento desc)
        from (select orden_nombre_lista(p.nombre, p.inicial) nombre, x.tipo, x.momento,
                     to_char(x.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') hora
                from pos_tiempos x join orden_personas p on p.id = x.persona_id
               where x.local_id = v_loc.id and x.dia = pos_hoy() and x.estado = 'ok'
               order by x.momento desc limit 8) u), '[]'::jsonb));
end $$;

/* Fichar desde Equipo VDH: quien entró con su usuario escaneó el QR de la compu de un local. Queda su entrada o su
   salida en ese local, con la hora de ahora. El QR vale en su ventana y en la de al lado (un minuto, a lo sumo);
   escanear dos veces seguidas no la repite (10 minutos). p_celular: el número al azar que guarda la app en ese
   celular; el primero desde el que ficha cada uno queda como el suyo, y si no, la marca lleva un aviso. */
create function pos_fichar(p_codigo text, p_tipo text, p_celular text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_yo     uuid := orden_yo_id();
  v_p      orden_personas;
  v_m      text[];
  v_caja   club_cajas;
  v_ahora  timestamptz := clock_timestamp();
  v_w      bigint;
  v_loc    orden_locales;
  v_cel    text := btrim(coalesce(p_celular, ''));
  v_suyo   text;
  v_duenio uuid;
  v_otro   text;
  v_aviso  text[] := '{}';
  v_ya     pos_tiempos;
  v_id     bigint;
begin
  if v_yo is null then raise exception 'Entrá con tu usuario para fichar.'; end if;
  select * into v_p from orden_personas where id = v_yo;
  if not coalesce(v_p.activo and v_p.aprobado, false) then raise exception 'Tu usuario no está activo: hablá con tu supervisor.'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es tu entrada o tu salida.'; end if;
  if v_cel !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'A este celular le falta su número: actualizá la app y probá de nuevo.'; end if;
  v_m := regexp_match(btrim(coalesce(p_codigo, '')), '^VDHF1\.([0-9]{1,12})\.([0-9]{1,12})\.([0-9a-f]{16})$');
  if v_m is null then raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.'; end if;
  select * into v_caja from club_cajas where id = v_m[1]::bigint;
  if v_caja.id is null or pos_fichero_firma(v_caja.id, v_m[2]::bigint) is distinct from v_m[3] then
    raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.';
  end if;
  if v_caja.baja is not null then raise exception 'Esa compu ya no está habilitada: avisale a tu supervisor.'; end if;
  v_w := floor(extract(epoch from v_ahora) / 30)::bigint;
  if v_m[2]::bigint < v_w - 1 or v_m[2]::bigint > v_w + 1 then
    raise exception 'Ese QR ya cambió: escaneá el que se ve ahora en la compu del local.';
  end if;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_caja.local)) limit 1;
  if v_loc.id is null then raise exception 'El local de esa compu no está en el sistema.'; end if;

  /* Dos toques a la vez, o escanear dos veces seguidas: una sola marca. */
  perform pg_advisory_xact_lock(hashtext('pos_fichar:' || v_yo));
  select * into v_ya from pos_tiempos x
   where x.persona_id = v_yo and x.tipo = p_tipo and x.estado = 'ok' and x.momento > v_ahora - interval '10 minutes'
   order by x.momento desc limit 1;
  if v_ya.id is not null then
    return jsonb_build_object('ya', true, 'id', v_ya.id, 'tipo', p_tipo, 'local', v_loc.nombre,
                              'hora', to_char(v_ya.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                              'aviso', case when v_ya.origen = 'celular' then v_ya.observaciones end);
  end if;

  /* Un celular por persona. Desde el suyo, nada que avisar. */
  select celular into v_suyo from pos_fichero_celulares where persona_id = v_yo;
  select c.persona_id into v_duenio from pos_fichero_celulares c where c.celular = v_cel and c.persona_id <> v_yo;
  if v_duenio is not null then
    v_aviso := v_aviso || ('Fichó desde el celular de ' || (select orden_nombre_lista(p.nombre, p.inicial) from orden_personas p where p.id = v_duenio) || '.');
  elsif v_suyo is distinct from v_cel then
    select string_agg(distinct orden_nombre_lista(p.nombre, p.inicial), ', ') into v_otro
      from pos_tiempos x join orden_personas p on p.id = x.persona_id
     where x.celular = v_cel and x.persona_id <> v_yo and x.dia = pos_hoy() and x.estado = 'ok';
    if v_suyo is not null then v_aviso := v_aviso || 'No es su celular de siempre.'::text; end if;
    if v_otro is not null then v_aviso := v_aviso || ('Desde ese celular también fichó hoy ' || v_otro || '.'); end if;
    if v_suyo is null and v_otro is null then   -- el primero: queda como el suyo
      insert into pos_fichero_celulares (persona_id, celular) values (v_yo, v_cel);
    end if;
  end if;

  insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, cargado_por, celular)
  values (v_yo, v_loc.id, v_ahora, (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date, p_tipo, 'celular',
          left('Fichero QR · ' || coalesce(nullif(btrim(v_caja.nombre), ''), 'compu ' || v_caja.id), 80),
          nullif(array_to_string(v_aviso, ' '), ''), v_yo, v_cel)
  returning id into v_id;
  return jsonb_build_object('ya', false, 'id', v_id, 'tipo', p_tipo, 'local', v_loc.nombre,
                            'hora', to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                            'aviso', nullif(array_to_string(v_aviso, ' '), ''));
end $$;

/* Lo de hoy de quien entró (Equipo VDH → Papeles → Fichar): sus marcas de hoy, de cualquier origen, en orden. El
   aviso, sólo en las del fichero (las observaciones de las cargadas a mano son de la oficina). */
create function pos_fichero_mio() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_yo uuid := orden_yo_id();
begin
  if v_yo is null then raise exception 'Entrá con tu usuario para fichar.'; end if;
  return jsonb_build_object('hoy', pos_hoy(), 'marcas', coalesce((
    select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'local', l.nombre, 'origen', x.origen,
                                        'hora', to_char(x.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                                        'aviso', case when x.origen = 'celular' then x.observaciones end) order by x.momento)
      from pos_tiempos x left join orden_locales l on l.id = x.local_id
     where x.persona_id = v_yo and x.dia = pos_hoy() and x.estado = 'ok'), '[]'::jsonb));
end $$;

/* «Es su celular nuevo» (Supervisión → Llegadas, en una marca del fichero con aviso): desde ahora ese celular es el de
   esa persona (y deja de ser de quien lo tenía). Lo hacen el supervisor de su local, o el del local donde fichó, y la
   administración; lo propio, otro. */
create function pos_fichero_celular_nuevo(p_marca bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v     pos_tiempos;
  v_yo  uuid := orden_yo_id();
  v_obs text;
begin
  select * into v from pos_tiempos where id = p_marca for update;
  if v.id is null or v.origen <> 'celular' or v.celular is null then raise exception 'Esa marca no es del fichero.'; end if;
  if not (orden_es_supervisor_de(v.local_id) or orden_es_supervisor_de((select local_id from orden_personas where id = v.persona_id))) then
    raise exception 'Lo hacen el supervisor de su local o la administración.';
  end if;
  if v.persona_id = v_yo and not orden_es_admin() then raise exception 'Lo tuyo lo hace otro.'; end if;
  delete from pos_fichero_celulares where celular = v.celular and persona_id <> v.persona_id;
  insert into pos_fichero_celulares as c (persona_id, celular, desde, cambiado_por) values (v.persona_id, v.celular, now(), v_yo)
  on conflict (persona_id) do update set celular = excluded.celular, desde = excluded.desde, cambiado_por = excluded.cambiado_por;
  v_obs := btrim(coalesce(v.observaciones, '') || ' Ya es su celular (lo dijo '
                 || coalesce((select orden_nombre_lista(p.nombre, p.inicial) from orden_personas p where p.id = v_yo), 'la oficina') || ').');
  update pos_tiempos set observaciones = v_obs where id = p_marca;
  return jsonb_build_object('id', p_marca, 'aviso', v_obs);
end $$;

revoke all on function pos_fichero_firma(bigint, bigint) from public, anon, authenticated;
revoke all on function pos_fichero_qr(text) from public;
revoke all on function pos_fichar(text, text, text) from public, anon;
revoke all on function pos_fichero_mio() from public, anon;
revoke all on function pos_fichero_celular_nuevo(bigint) from public, anon;
grant execute on function pos_fichero_qr(text) to anon, authenticated;
grant execute on function pos_fichar(text, text, text) to authenticated;
grant execute on function pos_fichero_mio() to authenticated;
grant execute on function pos_fichero_celular_nuevo(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 222 (31/10/2026) · EL STOCK GENERAL
--
--  Mauricio (31/10): una sola pantalla para el stock de todo el local, "en
--  base a los módulos: módulo 1, y ahí cargamos todo; después ellos
--  controlan", y que entren "todos en el local, porque lo hacen ellos". Hasta
--  ahora estaba en tres lugares (el depósito nuevo en Depósitos, los módulos
--  escritos a mano en Envíos internos → Entre depósitos del local, y
--  «Predeterminar» de vuelta en Depósitos), con el permiso de los envíos.
--
--  · El stock general en curso de un local: el depósito de temporada (Verano
--    o Invierno + año) activo y todavía no predeterminado, creado DESDE que
--    se predeterminó el actual (así el de la temporada de antes, que queda
--    activo con lo que no se encontró, no vuelve a contar). Si hay dos, el más
--    nuevo. Se empieza creando ese depósito y se termina predeterminándolo
--    (las dos cosas, con el permiso de los envíos: encargado o supervisor).
--  · Los módulos son los del croquis de Equipo VDH (orden_modulos de los
--    sectores del local: las paredes, el centro y el depósito). Cada pase
--    guarda el suyo en pos_remitos.modulo_id; se pasa una vez (para pasarlo de
--    nuevo, se rehace: se anula el pase y las prendas vuelven).
--  · Pasar un módulo, contar sus testigos y rehacerlo lo hace cualquiera del
--    local que use el POS (pos_remito_guardar, pos_remito_testigo y
--    pos_remito_anular, sólo para el stock general en curso).
--  · pos_stock_general: lo que ve la pantalla (Mercadería → Stock general y
--    Gestión → Stock → Stock general), un local o todos los que puede ver.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pos_remitos add column if not exists modulo_id uuid references orden_modulos(id) on delete set null;
create index if not exists pos_remitos_modulo on pos_remitos (destino_deposito_id, modulo_id) where modulo_id is not null;

/* El depósito del stock general en curso de un local (null si no hay). */
create or replace function pos_stock_general_dep_(p_local uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select n.id
    from pos_depositos n
    join pos_depositos v on v.local_id = n.local_id and v.predeterminado
   where n.local_id = p_local and n.temporada is not null and n.activo and not n.predeterminado
     and n.creado_en >= coalesce(v.predeterminado_en, '-infinity'::timestamptz)
   order by n.numero desc
   limit 1
$$;

/* ¿Ese depósito es el del stock general en curso del local? */
create or replace function pos_stock_general_es_(p_local uuid, p_deposito uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_deposito is not null and p_deposito is not distinct from pos_stock_general_dep_(p_local)
$$;

/* Un pase del stock general: cuánto se pasó, quién, y sus testigos (vale lo último de cada producto).
   mismo: lo controló el mismo que lo pasó (por el nombre: la compu del local es compartida). */
create or replace function pos_stock_general_pase_(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (select distinct on (t.codigo) t.codigo, t.coincide, nullif(trim(coalesce(t.quien, t.persona_nombre)), '') quien
               from pos_remito_testigos t where t.remito_id = p_id order by t.codigo, t.id desc)
  select jsonb_build_object(
           'id', r.id, 'numero', r.numero, 'fecha', r.fecha, 'modulo', r.modulo, 'modulo_id', r.modulo_id,
           'responsable', r.responsable, 'creado_nombre', r.creado_nombre,
           'unidades', (select coalesce(sum(i.cantidad), 0) from pos_remito_items i where i.remito_id = r.id),
           'productos', (select count(distinct i.codigo) from pos_remito_items i where i.remito_id = r.id),
           'testigos_ok', (select count(*) from u where u.coincide),
           'testigos_mal', (select count(*) from u where not u.coincide),
           'controlo', (select string_agg(distinct u.quien, ', ') from u),
           'mismo', exists (select 1 from u where lower(u.quien) = lower(trim(coalesce(nullif(trim(r.responsable), ''), r.creado_nombre, '')))))
    from pos_remitos r
   where r.id = p_id
$$;

/* El stock general de un local: el depósito de antes y el nuevo, cada módulo del croquis con su pase (si ya se
   pasó), lo que se pasó sin módulo del croquis (otros lugares) y lo que queda en el de antes (lo que no se
   encontró; la plata, sólo con «Ver los precios»). nombres: los depósitos que ya tiene (para proponer el próximo). */
create or replace function pos_stock_general_local_(p_local uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v       pos_depositos;   -- el predeterminado: de ahí sale todo
  n       pos_depositos;   -- el de la temporada nueva, si hay un stock general en curso
  v_lista int := (select s.lista_id from pos_sucursales s where s.local_id = p_local);
begin
  select * into v from pos_depositos where local_id = p_local and predeterminado;
  select * into n from pos_depositos where id = pos_stock_general_dep_(p_local);
  return jsonb_build_object(
    'local_id', p_local,
    'local', (select l.nombre from orden_locales l where l.id = p_local),
    'viejo', case when v.id is not null then jsonb_build_object('id', v.id, 'nombre', v.nombre, 'predeterminado_en', v.predeterminado_en) end,
    'nuevo', case when n.id is not null then jsonb_build_object('id', n.id, 'nombre', n.nombre, 'temporada', n.temporada, 'anio', n.anio,
                                                                'creado_en', n.creado_en, 'creado_nombre', n.creado_nombre,
                                                                'unidades', (select coalesce(sum(s.cantidad), 0) from pos_stock s where s.deposito_id = n.id)) end,
    'modulos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'numero', m.numero, 'nombre', m.nombre,
               'lugar', case when s.tipo = 'deposito' then 'deposito' when m.isla then 'centro' else 'pared' end,
               'pase', (select pos_stock_general_pase_(r.id) from pos_remitos r
                         where n.id is not null and r.destino_deposito_id = n.id and r.modulo_id = m.id and r.estado <> 'anulado'
                         order by r.numero desc limit 1),
               'rehechos', (select count(*) from pos_remitos r
                             where n.id is not null and r.destino_deposito_id = n.id and r.modulo_id = m.id and r.estado = 'anulado'))
             order by case when s.tipo = 'deposito' then 1 else 0 end, m.isla, m.numero)
        from orden_modulos m join orden_sectores s on s.id = m.sector_id
       where s.local_id = p_local and s.activo and m.activo), '[]'::jsonb),
    'otros', coalesce((
      select jsonb_agg(pos_stock_general_pase_(r.id) order by r.numero)
        from pos_remitos r
       where n.id is not null and r.destino_deposito_id = n.id and r.estado <> 'anulado'
         and not exists (select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
                          where m.id = r.modulo_id and s.local_id = p_local and s.activo and m.activo)), '[]'::jsonb),
    'queda', case when v.id is not null then (
      select jsonb_build_object('unidades', coalesce(sum(x.n) filter (where x.n > 0), 0),
                                'productos', count(*) filter (where x.n > 0),
                                'negativos', count(*) filter (where x.n < 0),
                                'monto', case when pos_puede('precios') then coalesce(sum(x.n * pos_precio_de(v_lista, x.codigo)) filter (where x.n > 0), 0) end)
        from (select st.codigo, sum(st.cantidad) n from pos_stock st where st.deposito_id = v.id group by st.codigo) x) end,
    'nombres', coalesce((select jsonb_agg(d.nombre order by d.numero) from pos_depositos d where d.local_id = p_local), '[]'::jsonb));
end $$;

/* Lo que ve la pantalla: un local (el suyo o uno de los que supervisa) o, sin local, todos los que puede ver. */
create or replace function pos_stock_general(p_local uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  if p_local is not null then
    perform pos_local_ok(p_local);
    return pos_stock_general_local_(p_local);
  end if;
  return coalesce((select jsonb_agg(pos_stock_general_local_(l.id) order by l.nombre)
                     from orden_locales l where l.activo and pos_local_mio(l.id)), '[]'::jsonb);
end $$;

revoke all on function pos_stock_general_dep_(uuid), pos_stock_general_es_(uuid, uuid), pos_stock_general_pase_(uuid), pos_stock_general_local_(uuid)
       from public, anon, authenticated;
revoke all on function pos_stock_general(uuid) from public, anon;
grant execute on function pos_stock_general(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 223 (31/10/2026) · LAS LLEGADAS TARDE, AL FICHAR
--
--  Mauricio (31/10): "Cuando sume tres llegadas tarde, estaría bueno que meta
--  un aviso … aunque vayan diciendo 'ya acumulás dos, ya acumulás tres', en la
--  cuarta, obvio que corrés el riesgo de suspensión."
--  Al fichar la entrada con el QR (pos_fichar, SQL 218), si es la primera del
--  día en ese local y llegó tarde, la respuesta trae cuántos minutos y cuántas
--  llegadas tarde lleva en el mes, y la app se lo dice. La regla es la de
--  Llegadas: la primera entrada del día, más de 10 minutos después de que abre
--  el local (los domingos, su hora si tiene otra) y hasta 3 horas (más tarde
--  es otro turno); los días que el local no abre no cuentan. Se cuentan las de
--  todo el mes, de cualquier origen (QR, huella o a mano) y en cualquier local.
--  A la tercera del mes le llega un aviso a él y a quien supervisa el local;
--  desde la cuarta, "corrés riesgo de suspensión", y el aviso a quien
--  supervisa, cada vez.
--  · pos_minutos_tarde_: cuántos minutos después de que abre (en horas y
--    minutos, como Llegadas); null si ese día el local no abre.
--  · pos_tardes_del_mes_: las llegadas tarde de una persona en el mes, hasta
--    ese día.
--  · pos_tarde_avisar_sup_: el aviso a quienes supervisan el local (como el de
--    los legajos: sin la persona misma; si ninguno entró nunca a la app, a la
--    administración).
--  Reemplaza pos_fichar: lo mismo del 218, más lo de la llegada tarde.
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 218 no hay fichero: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regprocedure('public.pos_fichar(text, text, text)') is null then
    raise exception 'Primero hay que correr el SQL 218 (el fichero con QR): está en App Orden.';
  end if;
end $$;

/* Cuántos minutos después de que abre el local ese día llegó (en horas y minutos, como Llegadas: las 9:10:59 son las
   9:10). null si ese día no abre. */
create or replace function pos_minutos_tarde_(p_local uuid, p_dia date, p_entrada timestamptz)
returns integer language sql stable security definer set search_path = public as $$
  select ((extract(hour from x.h) * 60 + extract(minute from x.h)) - (extract(hour from x.a) * 60 + extract(minute from x.a)))::int
    from (select (p_entrada at time zone 'America/Argentina/Buenos_Aires')::time h,
                 case when extract(isodow from p_dia) = 7 and z.apertura_domingo is not null then z.apertura_domingo
                      else l.hora_apertura end a
            from orden_locales l
            left join pos_tiempos_locales z on z.local_id = l.id
           where l.id = p_local and extract(isodow from p_dia)::smallint = any (l.dias_abiertos)) x
   where x.a is not null
$$;
revoke all on function pos_minutos_tarde_(uuid, date, timestamptz) from public, anon, authenticated;

/* Las llegadas tarde de una persona en el mes de p_dia, hasta ese día: los días (en cada local) en que la primera
   entrada fue más de 10 minutos y hasta 3 horas después de que abría. Como la columna de Llegadas. */
create or replace function pos_tardes_del_mes_(p_persona uuid, p_dia date)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
    from (select coalesce(x.local_id, p.local_id) local_id, x.dia, min(x.momento) entrada
            from pos_tiempos x
            join orden_personas p on p.id = x.persona_id
           where x.persona_id = p_persona and x.estado = 'ok' and x.tipo = 'entrada'
             and x.dia between date_trunc('month', p_dia)::date and p_dia
           group by 1, 2) e
   where pos_minutos_tarde_(e.local_id, e.dia, e.entrada) between 11 and 180
$$;
revoke all on function pos_tardes_del_mes_(uuid, date) from public, anon, authenticated;

/* El aviso a quienes supervisan el local (sin la persona misma, si es la encargada); si ninguno entró nunca a la app,
   a la administración. Como orden_legajo_avisar_sup_. */
create or replace function pos_tarde_avisar_sup_(p_persona uuid, p_local uuid, p_titulo text, p_cuerpo text, p_clave text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0; v_hay boolean;
begin
  select exists (select 1 from orden_personas where id in (select orden_supervisores_de(p_local))
                   and id <> p_persona and aprobado and auth_user_id is not null) into v_hay;
  for r in
    select id from orden_personas
     where activo and id <> p_persona
       and (id in (select orden_supervisores_de(p_local)) or (rol = 'admin' and not v_hay))
  loop
    if orden_encolar_aviso(r.id, 'llegadas', p_titulo, p_cuerpo, '/equipo', p_clave || ':' || r.id, 2::smallint) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function pos_tarde_avisar_sup_(uuid, uuid, text, text, text) from public, anon, authenticated;

/* Lo mismo del 218; lo nuevo es lo de la llegada tarde, al final. */
create or replace function pos_fichar(p_codigo text, p_tipo text, p_celular text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_yo     uuid := orden_yo_id();
  v_p      orden_personas;
  v_m      text[];
  v_caja   club_cajas;
  v_ahora  timestamptz := clock_timestamp();
  v_w      bigint;
  v_loc    orden_locales;
  v_cel    text := btrim(coalesce(p_celular, ''));
  v_suyo   text;
  v_duenio uuid;
  v_otro   text;
  v_aviso  text[] := '{}';
  v_ya     pos_tiempos;
  v_id     bigint;
  v_dia    date;
  v_min    int;
  v_n      int;
  v_mes    text;
  v_abre   text;
  v_hora   text;
  v_quien  text;
  v_clave  text;
  v_tarde  jsonb;
begin
  if v_yo is null then raise exception 'Entrá con tu usuario para fichar.'; end if;
  select * into v_p from orden_personas where id = v_yo;
  if not coalesce(v_p.activo and v_p.aprobado, false) then raise exception 'Tu usuario no está activo: hablá con tu supervisor.'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es tu entrada o tu salida.'; end if;
  if v_cel !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'A este celular le falta su número: actualizá la app y probá de nuevo.'; end if;
  v_m := regexp_match(btrim(coalesce(p_codigo, '')), '^VDHF1\.([0-9]{1,12})\.([0-9]{1,12})\.([0-9a-f]{16})$');
  if v_m is null then raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.'; end if;
  select * into v_caja from club_cajas where id = v_m[1]::bigint;
  if v_caja.id is null or pos_fichero_firma(v_caja.id, v_m[2]::bigint) is distinct from v_m[3] then
    raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.';
  end if;
  if v_caja.baja is not null then raise exception 'Esa compu ya no está habilitada: avisale a tu supervisor.'; end if;
  v_w := floor(extract(epoch from v_ahora) / 30)::bigint;
  if v_m[2]::bigint < v_w - 1 or v_m[2]::bigint > v_w + 1 then
    raise exception 'Ese QR ya cambió: escaneá el que se ve ahora en la compu del local.';
  end if;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_caja.local)) limit 1;
  if v_loc.id is null then raise exception 'El local de esa compu no está en el sistema.'; end if;

  /* Dos toques a la vez, o escanear dos veces seguidas: una sola marca. */
  perform pg_advisory_xact_lock(hashtext('pos_fichar:' || v_yo));
  select * into v_ya from pos_tiempos x
   where x.persona_id = v_yo and x.tipo = p_tipo and x.estado = 'ok' and x.momento > v_ahora - interval '10 minutes'
   order by x.momento desc limit 1;
  if v_ya.id is not null then
    return jsonb_build_object('ya', true, 'id', v_ya.id, 'tipo', p_tipo, 'local', v_loc.nombre,
                              'hora', to_char(v_ya.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                              'aviso', case when v_ya.origen = 'celular' then v_ya.observaciones end);
  end if;

  /* Un celular por persona. Desde el suyo, nada que avisar. */
  select celular into v_suyo from pos_fichero_celulares where persona_id = v_yo;
  select c.persona_id into v_duenio from pos_fichero_celulares c where c.celular = v_cel and c.persona_id <> v_yo;
  if v_duenio is not null then
    v_aviso := v_aviso || ('Fichó desde el celular de ' || (select orden_nombre_lista(p.nombre, p.inicial) from orden_personas p where p.id = v_duenio) || '.');
  elsif v_suyo is distinct from v_cel then
    select string_agg(distinct orden_nombre_lista(p.nombre, p.inicial), ', ') into v_otro
      from pos_tiempos x join orden_personas p on p.id = x.persona_id
     where x.celular = v_cel and x.persona_id <> v_yo and x.dia = pos_hoy() and x.estado = 'ok';
    if v_suyo is not null then v_aviso := v_aviso || 'No es su celular de siempre.'::text; end if;
    if v_otro is not null then v_aviso := v_aviso || ('Desde ese celular también fichó hoy ' || v_otro || '.'); end if;
    if v_suyo is null and v_otro is null then   -- el primero: queda como el suyo
      insert into pos_fichero_celulares (persona_id, celular) values (v_yo, v_cel);
    end if;
  end if;

  v_dia := (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date;
  insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, cargado_por, celular)
  values (v_yo, v_loc.id, v_ahora, v_dia, p_tipo, 'celular',
          left('Fichero QR · ' || coalesce(nullif(btrim(v_caja.nombre), ''), 'compu ' || v_caja.id), 80),
          nullif(array_to_string(v_aviso, ' '), ''), v_yo, v_cel)
  returning id into v_id;

  /* SQL 223: la llegada tarde. Sólo la primera entrada del día en ese local (la que mira Llegadas). */
  if p_tipo = 'entrada' and not exists (
       select 1 from pos_tiempos x join orden_personas p on p.id = x.persona_id
        where x.persona_id = v_yo and x.estado = 'ok' and x.tipo = 'entrada' and x.dia = v_dia and x.id <> v_id
          and x.momento < v_ahora and coalesce(x.local_id, p.local_id) = v_loc.id) then
    v_min := pos_minutos_tarde_(v_loc.id, v_dia, v_ahora);
    if v_min between 11 and 180 then
      v_n := pos_tardes_del_mes_(v_yo, v_dia);
      v_mes := (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
                      'noviembre', 'diciembre'])[extract(month from v_dia)::int];
      v_abre := (select to_char(case when extract(isodow from v_dia) = 7 and z.apertura_domingo is not null then z.apertura_domingo
                                     else l.hora_apertura end, 'FMHH24:MI')
                   from orden_locales l left join pos_tiempos_locales z on z.local_id = l.id where l.id = v_loc.id);
      v_hora := to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'FMHH24:MI');
      v_quien := orden_nombre_lista(v_p.nombre, v_p.inicial);
      v_clave := 'tarde:' || v_yo || ':' || to_char(v_dia, 'YYYY-MM') || ':' || v_n;
      if v_n = 3 then
        perform orden_encolar_aviso(v_yo, 'llegadas', 'Ya acumulás 3 llegadas tarde en ' || v_mes,
          'Ojo: a la cuarta corrés riesgo de suspensión.', '/fichar', v_clave, 2::smallint);
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula 3 llegadas tarde en ' || v_mes,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). A la cuarta corre riesgo de suspensión.', v_clave);
      elsif v_n >= 4 then
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula ' || v_n || ' llegadas tarde en ' || v_mes,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). Corre riesgo de suspensión.', v_clave);
      end if;
      v_tarde := jsonb_build_object('min', v_min, 'abre', v_abre, 'n', v_n, 'mes', v_mes);
    end if;
  end if;

  return jsonb_build_object('ya', false, 'id', v_id, 'tipo', p_tipo, 'local', v_loc.nombre,
                            'hora', to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                            'aviso', nullif(array_to_string(v_aviso, ' '), ''), 'tarde', v_tarde);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 224 (31/10/2026) · LAS LLEGADAS TARDE, EN PERÍODOS DE 90 DÍAS
--
--  Mauricio (31/10): "Cada llegada tarde es un apercibimiento … Al cuarto
--  apercibimiento se suspende y no se reinicia todos los meses … Podríamos
--  poner que se renueva cada 90 días … Desde el primer procedimiento tiene 90
--  días."
--  En el 223 la cuenta era por mes (volvía a cero el 1.º). Ahora va por
--  períodos de 90 días: la primera llegada tarde abre un período (ese día y
--  los 89 siguientes) y las que caen adentro se suman, aunque cambie el mes; la
--  primera llegada tarde después de que el período se cierra abre otro, desde
--  1. Qué es llegar tarde no cambia (la regla de Llegadas), ni a quién le
--  llegan los avisos (a la tercera, a él y a la supervisión; desde la cuarta,
--  a la supervisión, cada vez): cambian los textos, "desde el 1/11" en vez de
--  "en noviembre", y "hasta el …" cuándo se cierra el período.
--  · pos_tardes_periodo_: el período abierto de una persona en p_dia (n,
--    desde, hasta); nada si no tiene uno abierto.
--  · Saca pos_tardes_del_mes_ (la usaba sólo pos_fichar).
--  Reemplaza pos_fichar: lo mismo del 223, con la cuenta nueva. La respuesta
--  trae también 'desde' y 'hasta' (D/M), y 'mes' = 'estos 90 días' para la app
--  de antes (impecable-v77), que arma «… en {mes}».
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 223 no hay llegadas tarde: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regprocedure('public.pos_minutos_tarde_(uuid, date, timestamptz)') is null then
    raise exception 'Primero hay que correr el SQL 223 (las llegadas tarde al fichar): está en App Orden.';
  end if;
end $$;

/* El período de llegadas tarde de una persona en p_dia: recorre sus llegadas tarde (la regla de Llegadas: la primera
   entrada del día en cada local, más de 10 minutos y hasta 3 horas después de que abría) en orden; la primera abre un
   período de 90 días (ese día y los 89 siguientes), las de adentro suman, y la primera después de que se cierra abre
   otro. Devuelve el período abierto en p_dia (cuántas lleva, desde y hasta qué día); nada si no tiene uno abierto. */
create or replace function pos_tardes_periodo_(p_persona uuid, p_dia date)
returns table (n integer, desde date, hasta date) language plpgsql stable security definer set search_path = public as $$
declare r record; v_desde date; v_n int := 0;
begin
  for r in
    select e.dia
      from (select coalesce(x.local_id, p.local_id) local_id, x.dia, min(x.momento) entrada
              from pos_tiempos x
              join orden_personas p on p.id = x.persona_id
             where x.persona_id = p_persona and x.estado = 'ok' and x.tipo = 'entrada' and x.dia <= p_dia
             group by 1, 2) e
     where pos_minutos_tarde_(e.local_id, e.dia, e.entrada) between 11 and 180
     order by e.dia
  loop
    if v_desde is null or r.dia >= v_desde + 90 then
      v_desde := r.dia;
      v_n := 0;
    end if;
    v_n := v_n + 1;
  end loop;
  if v_desde is not null and p_dia < v_desde + 90 then
    n := v_n; desde := v_desde; hasta := v_desde + 89;
    return next;
  end if;
end $$;
revoke all on function pos_tardes_periodo_(uuid, date) from public, anon, authenticated;

/* Lo mismo del 223; lo nuevo es la cuenta en períodos de 90 días (SQL 224). */
create or replace function pos_fichar(p_codigo text, p_tipo text, p_celular text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_yo     uuid := orden_yo_id();
  v_p      orden_personas;
  v_m      text[];
  v_caja   club_cajas;
  v_ahora  timestamptz := clock_timestamp();
  v_w      bigint;
  v_loc    orden_locales;
  v_cel    text := btrim(coalesce(p_celular, ''));
  v_suyo   text;
  v_duenio uuid;
  v_otro   text;
  v_aviso  text[] := '{}';
  v_ya     pos_tiempos;
  v_id     bigint;
  v_dia    date;
  v_min    int;
  v_n      int;
  v_mes    text;
  v_desde  date;
  v_hasta  date;
  v_de     text;
  v_al     text;
  v_abre   text;
  v_hora   text;
  v_quien  text;
  v_clave  text;
  v_tarde  jsonb;
begin
  if v_yo is null then raise exception 'Entrá con tu usuario para fichar.'; end if;
  select * into v_p from orden_personas where id = v_yo;
  if not coalesce(v_p.activo and v_p.aprobado, false) then raise exception 'Tu usuario no está activo: hablá con tu supervisor.'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es tu entrada o tu salida.'; end if;
  if v_cel !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'A este celular le falta su número: actualizá la app y probá de nuevo.'; end if;
  v_m := regexp_match(btrim(coalesce(p_codigo, '')), '^VDHF1\.([0-9]{1,12})\.([0-9]{1,12})\.([0-9a-f]{16})$');
  if v_m is null then raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.'; end if;
  select * into v_caja from club_cajas where id = v_m[1]::bigint;
  if v_caja.id is null or pos_fichero_firma(v_caja.id, v_m[2]::bigint) is distinct from v_m[3] then
    raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.';
  end if;
  if v_caja.baja is not null then raise exception 'Esa compu ya no está habilitada: avisale a tu supervisor.'; end if;
  v_w := floor(extract(epoch from v_ahora) / 30)::bigint;
  if v_m[2]::bigint < v_w - 1 or v_m[2]::bigint > v_w + 1 then
    raise exception 'Ese QR ya cambió: escaneá el que se ve ahora en la compu del local.';
  end if;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_caja.local)) limit 1;
  if v_loc.id is null then raise exception 'El local de esa compu no está en el sistema.'; end if;

  /* Dos toques a la vez, o escanear dos veces seguidas: una sola marca. */
  perform pg_advisory_xact_lock(hashtext('pos_fichar:' || v_yo));
  select * into v_ya from pos_tiempos x
   where x.persona_id = v_yo and x.tipo = p_tipo and x.estado = 'ok' and x.momento > v_ahora - interval '10 minutes'
   order by x.momento desc limit 1;
  if v_ya.id is not null then
    return jsonb_build_object('ya', true, 'id', v_ya.id, 'tipo', p_tipo, 'local', v_loc.nombre,
                              'hora', to_char(v_ya.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                              'aviso', case when v_ya.origen = 'celular' then v_ya.observaciones end);
  end if;

  /* Un celular por persona. Desde el suyo, nada que avisar. */
  select celular into v_suyo from pos_fichero_celulares where persona_id = v_yo;
  select c.persona_id into v_duenio from pos_fichero_celulares c where c.celular = v_cel and c.persona_id <> v_yo;
  if v_duenio is not null then
    v_aviso := v_aviso || ('Fichó desde el celular de ' || (select orden_nombre_lista(p.nombre, p.inicial) from orden_personas p where p.id = v_duenio) || '.');
  elsif v_suyo is distinct from v_cel then
    select string_agg(distinct orden_nombre_lista(p.nombre, p.inicial), ', ') into v_otro
      from pos_tiempos x join orden_personas p on p.id = x.persona_id
     where x.celular = v_cel and x.persona_id <> v_yo and x.dia = pos_hoy() and x.estado = 'ok';
    if v_suyo is not null then v_aviso := v_aviso || 'No es su celular de siempre.'::text; end if;
    if v_otro is not null then v_aviso := v_aviso || ('Desde ese celular también fichó hoy ' || v_otro || '.'); end if;
    if v_suyo is null and v_otro is null then   -- el primero: queda como el suyo
      insert into pos_fichero_celulares (persona_id, celular) values (v_yo, v_cel);
    end if;
  end if;

  v_dia := (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date;
  insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, cargado_por, celular)
  values (v_yo, v_loc.id, v_ahora, v_dia, p_tipo, 'celular',
          left('Fichero QR · ' || coalesce(nullif(btrim(v_caja.nombre), ''), 'compu ' || v_caja.id), 80),
          nullif(array_to_string(v_aviso, ' '), ''), v_yo, v_cel)
  returning id into v_id;

  /* SQL 223: la llegada tarde. Sólo la primera entrada del día en ese local (la que mira Llegadas).
     SQL 224: cuántas lleva en su período de 90 días (pos_tardes_periodo_), ya no en el mes. */
  if p_tipo = 'entrada' and not exists (
       select 1 from pos_tiempos x join orden_personas p on p.id = x.persona_id
        where x.persona_id = v_yo and x.estado = 'ok' and x.tipo = 'entrada' and x.dia = v_dia and x.id <> v_id
          and x.momento < v_ahora and coalesce(x.local_id, p.local_id) = v_loc.id) then
    v_min := pos_minutos_tarde_(v_loc.id, v_dia, v_ahora);
    if v_min between 11 and 180 then
      select t.n, t.desde, t.hasta into v_n, v_desde, v_hasta from pos_tardes_periodo_(v_yo, v_dia) t;
      v_de := to_char(v_desde, 'FMDD/FMMM');
      v_al := to_char(v_hasta, 'FMDD/FMMM');
      v_mes := 'estos 90 días';   -- para la app de antes (impecable-v77), que arma «… en {mes}»
      v_abre := (select to_char(case when extract(isodow from v_dia) = 7 and z.apertura_domingo is not null then z.apertura_domingo
                                     else l.hora_apertura end, 'FMHH24:MI')
                   from orden_locales l left join pos_tiempos_locales z on z.local_id = l.id where l.id = v_loc.id);
      v_hora := to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'FMHH24:MI');
      v_quien := orden_nombre_lista(v_p.nombre, v_p.inicial);
      v_clave := 'tarde:' || v_yo || ':' || v_desde || ':' || v_n;
      if v_n = 3 then
        perform orden_encolar_aviso(v_yo, 'llegadas', 'Ya acumulás 3 llegadas tarde desde el ' || v_de,
          'Ojo: si llegás tarde otra vez hasta el ' || v_al || ', corrés riesgo de suspensión.', '/fichar', v_clave, 2::smallint);
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula 3 llegadas tarde desde el ' || v_de,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). Si llega tarde otra vez hasta el ' || v_al || ', corre riesgo de suspensión.', v_clave);
      elsif v_n >= 4 then
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula ' || v_n || ' llegadas tarde desde el ' || v_de,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). Corre riesgo de suspensión.', v_clave);
      end if;
      v_tarde := jsonb_build_object('min', v_min, 'abre', v_abre, 'n', v_n, 'mes', v_mes, 'desde', v_de, 'hasta', v_al);
    end if;
  end if;

  return jsonb_build_object('ya', false, 'id', v_id, 'tipo', p_tipo, 'local', v_loc.nombre,
                            'hora', to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                            'aviso', nullif(array_to_string(v_aviso, ' '), ''), 'tarde', v_tarde);
end $$;

drop function if exists pos_tardes_del_mes_(uuid, date);

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 225 (01/11/2026) · EL QR EN MOVIMIENTO
--
--  Mauricio (01/11): "a ver qué podemos implementar para que no se pueda
--  sacar la foto … tenemos la aplicación, una cámara; hay que aprovechar."
--  Hasta el 224 el QR cambiaba cada 30 segundos y valía hasta un minuto: un
--  compañero le sacaba una foto, la mandaba por WhatsApp y el que no había
--  llegado fichaba desde su casa. Ahora:
--  · La compu (fichero.html) muestra un QR distinto cada medio segundo:
--    pos_fichero_qr2 le da los de los próximos 30 segundos, firmados con el
--    mismo secreto del 218 (pos_fichero_firma2, con otro prefijo: VDHF2).
--  · La app (Equipo VDH → Trámites → Fichar) apunta la cámara y lee tres
--    distintos; pos_fichar los recibe juntos y pide tres de la misma compu,
--    en menos de 5 segundos, y el último de hace 10 segundos a lo sumo.
--    Una foto tiene uno solo; un video grabado y reenviado llega vencido.
--  · El QR de antes (VDHF1) ya no vale. Una compu que quedó con la página
--    de antes abierta (pos_fichero_qr) dice que aprieten F5.
--  · pos_fichero_qr2 trae también el id de las últimas marcas: la compu
--    muestra un cartel grande cuando alguien ficha (sin sonido).
--  Lo demás de pos_fichar (un celular por persona, las llegadas tarde en
--  períodos de 90 días, los avisos) queda igual que en el 224.
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 224 (y el 218 debajo) no hay fichero que cambiar: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regprocedure('public.pos_tardes_periodo_(uuid, date)') is null then
    raise exception 'Primero hay que correr el SQL 224 (las llegadas tarde en períodos de 90 días): está en App Orden.';
  end if;
end $$;

/* La firma de un QR en movimiento: la compu y el medio segundo, con el secreto del 218. 16 letras alcanzan. */
create or replace function pos_fichero_firma2(p_caja bigint, p_paso bigint) returns text
language sql stable security definer set search_path = public as $$
  select left(encode(extensions.hmac(convert_to('VDHF2.' || p_caja || '.' || p_paso, 'UTF8'), f.secreto, 'sha256'), 'hex'), 16)
    from pos_fichero f where f.id = 1
$$;
revoke all on function pos_fichero_firma2(bigint, bigint) from public, anon, authenticated;

/* La compu del local (fichero.html) pide sus QR: uno por cada medio segundo de los próximos 30, con la hora de la base,
   para que la pantalla los cambie a tiempo aunque el reloj de la compu ande mal. Y las últimas marcas de hoy en ese
   local, con su id (para el cartel de "fichó"). Hace falta la llave de la compu habilitada; anda sin nadie adentro. */
create or replace function pos_fichero_qr2(p_caja text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_cod   text := club_caja_local(p_caja);
  v_caja  bigint;
  v_loc   orden_locales;
  v_ahora timestamptz := clock_timestamp();
  v_p     bigint;
begin
  if v_cod is null then
    raise exception 'Esta compu no está habilitada como la de un local: se habilita en Config → General → Las compus de los locales.';
  end if;
  select id into v_caja from club_cajas where llave_hash = club_caja_hash(p_caja) and baja is null;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_cod)) limit 1;
  if v_loc.id is null then raise exception 'El local de esta compu (%) no está en el sistema.', v_cod; end if;
  v_p := floor(extract(epoch from v_ahora) * 2)::bigint;   -- el medio segundo de ahora
  return jsonb_build_object(
    'local_id', v_loc.id,
    'local', v_loc.nombre,
    'ahora_ms', floor(extract(epoch from v_ahora) * 1000)::bigint,
    'paso_ms', 500,
    'codigos', (select jsonb_agg(jsonb_build_array(k, 'VDHF2.' || v_caja || '.' || k || '.' || pos_fichero_firma2(v_caja, k)) order by k)
                  from generate_series(v_p, v_p + 59) k),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_array(u.nombre, u.tipo, u.hora, u.id) order by u.momento desc)
        from (select x.id, orden_nombre_lista(p.nombre, p.inicial) nombre, x.tipo, x.momento,
                     to_char(x.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') hora
                from pos_tiempos x join orden_personas p on p.id = x.persona_id
               where x.local_id = v_loc.id and x.dia = pos_hoy() and x.estado = 'ok'
               order by x.momento desc limit 8) u), '[]'::jsonb));
end $$;

revoke all on function pos_fichero_qr2(text) from public;
grant execute on function pos_fichero_qr2(text) to anon, authenticated;

/* La página de antes (la del QR de 30 segundos) pide con esta función: desde el 225 le dice que aprieten F5. El texto
   lleva "ya no está habilitada" porque así la página de antes lo muestra entero, en lugar del QR. */
create or replace function pos_fichero_qr(p_caja text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  raise exception 'Hay una versión nueva del fichero: apretá F5 para verla (la de esta pantalla ya no está habilitada).';
end $$;

/* Lo mismo del 224; lo nuevo es la lectura del QR en movimiento (SQL 225). */
create or replace function pos_fichar(p_codigo text, p_tipo text, p_celular text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_yo     uuid := orden_yo_id();
  v_p      orden_personas;
  v_m      text[];
  v_caja   club_cajas;
  v_ahora  timestamptz := clock_timestamp();
  v_txt    text := btrim(coalesce(p_codigo, ''));
  v_parte  text;
  v_cid    bigint;
  v_pasos  bigint[] := '{}';
  v_cuant  int;
  v_pmin   bigint;
  v_pmax   bigint;
  v_pahora bigint;
  v_loc    orden_locales;
  v_cel    text := btrim(coalesce(p_celular, ''));
  v_suyo   text;
  v_duenio uuid;
  v_otro   text;
  v_aviso  text[] := '{}';
  v_ya     pos_tiempos;
  v_id     bigint;
  v_dia    date;
  v_min    int;
  v_n      int;
  v_mes    text;
  v_desde  date;
  v_hasta  date;
  v_de     text;
  v_al     text;
  v_abre   text;
  v_hora   text;
  v_quien  text;
  v_clave  text;
  v_tarde  jsonb;
begin
  if v_yo is null then raise exception 'Entrá con tu usuario para fichar.'; end if;
  select * into v_p from orden_personas where id = v_yo;
  if not coalesce(v_p.activo and v_p.aprobado, false) then raise exception 'Tu usuario no está activo: hablá con tu supervisor.'; end if;
  if p_tipo is null or p_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es tu entrada o tu salida.'; end if;
  if v_cel !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'A este celular le falta su número: actualizá la app y probá de nuevo.'; end if;
  /* SQL 225: el QR en movimiento. La compu muestra uno nuevo cada medio segundo y la app manda los que leyó en vivo,
     separados por espacios: hacen falta tres distintos, de la misma compu, en menos de 5 segundos, y el último de hace
     10 segundos a lo sumo. Una foto (uno solo) o un video grabado y reenviado (llega vencido) no alcanzan. El QR de
     antes (VDHF1, uno cada 30 segundos) ya no vale. */
  if v_txt ~ '^VDHF1\.' then
    raise exception 'La compu del local tiene el fichero de antes: que aprieten F5 en la compu y escaneá de nuevo.';
  end if;
  if length(v_txt) > 800 then raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.'; end if;
  foreach v_parte in array regexp_split_to_array(v_txt, '\s+') loop
    v_m := regexp_match(v_parte, '^VDHF2\.([0-9]{1,12})\.([0-9]{1,15})\.([0-9a-f]{16})$');
    if v_m is null or v_m[1]::bigint is distinct from coalesce(v_cid, v_m[1]::bigint)
       or pos_fichero_firma2(v_m[1]::bigint, v_m[2]::bigint) is distinct from v_m[3] then
      raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.';
    end if;
    v_cid := v_m[1]::bigint;
    v_pasos := v_pasos || v_m[2]::bigint;
  end loop;
  select count(distinct x)::int, min(x), max(x) into v_cuant, v_pmin, v_pmax from unnest(v_pasos) x;
  if v_cuant < 3 or v_pmax - v_pmin > 10 then
    raise exception 'El QR no se leyó en vivo: apuntá la cámara al QR de la compu del local, sin moverla, hasta que se cierre.';
  end if;
  select * into v_caja from club_cajas where id = v_cid;
  if v_caja.id is null then raise exception 'Ese QR no es el del fichero: escaneá el que está en la compu del local.'; end if;
  if v_caja.baja is not null then raise exception 'Esa compu ya no está habilitada: avisale a tu supervisor.'; end if;
  v_pahora := floor(extract(epoch from v_ahora) * 2)::bigint;
  if v_pmax < v_pahora - 20 or v_pmax > v_pahora + 4 then
    raise exception 'Ese QR ya cambió: escaneá el que se ve ahora en la compu del local.';
  end if;
  select * into v_loc from orden_locales l where l.activo and upper(btrim(l.codigo)) = upper(btrim(v_caja.local)) limit 1;
  if v_loc.id is null then raise exception 'El local de esa compu no está en el sistema.'; end if;

  /* Dos toques a la vez, o escanear dos veces seguidas: una sola marca. */
  perform pg_advisory_xact_lock(hashtext('pos_fichar:' || v_yo));
  select * into v_ya from pos_tiempos x
   where x.persona_id = v_yo and x.tipo = p_tipo and x.estado = 'ok' and x.momento > v_ahora - interval '10 minutes'
   order by x.momento desc limit 1;
  if v_ya.id is not null then
    return jsonb_build_object('ya', true, 'id', v_ya.id, 'tipo', p_tipo, 'local', v_loc.nombre,
                              'hora', to_char(v_ya.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                              'aviso', case when v_ya.origen = 'celular' then v_ya.observaciones end);
  end if;

  /* Un celular por persona. Desde el suyo, nada que avisar. */
  select celular into v_suyo from pos_fichero_celulares where persona_id = v_yo;
  select c.persona_id into v_duenio from pos_fichero_celulares c where c.celular = v_cel and c.persona_id <> v_yo;
  if v_duenio is not null then
    v_aviso := v_aviso || ('Fichó desde el celular de ' || (select orden_nombre_lista(p.nombre, p.inicial) from orden_personas p where p.id = v_duenio) || '.');
  elsif v_suyo is distinct from v_cel then
    select string_agg(distinct orden_nombre_lista(p.nombre, p.inicial), ', ') into v_otro
      from pos_tiempos x join orden_personas p on p.id = x.persona_id
     where x.celular = v_cel and x.persona_id <> v_yo and x.dia = pos_hoy() and x.estado = 'ok';
    if v_suyo is not null then v_aviso := v_aviso || 'No es su celular de siempre.'::text; end if;
    if v_otro is not null then v_aviso := v_aviso || ('Desde ese celular también fichó hoy ' || v_otro || '.'); end if;
    if v_suyo is null and v_otro is null then   -- el primero: queda como el suyo
      insert into pos_fichero_celulares (persona_id, celular) values (v_yo, v_cel);
    end if;
  end if;

  v_dia := (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date;
  insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, terminal, observaciones, cargado_por, celular)
  values (v_yo, v_loc.id, v_ahora, v_dia, p_tipo, 'celular',
          left('Fichero QR · ' || coalesce(nullif(btrim(v_caja.nombre), ''), 'compu ' || v_caja.id), 80),
          nullif(array_to_string(v_aviso, ' '), ''), v_yo, v_cel)
  returning id into v_id;

  /* SQL 225: la lectura del QR es nueva (arriba); lo de abajo es lo mismo del 224.
     SQL 223: la llegada tarde. Sólo la primera entrada del día en ese local (la que mira Llegadas).
     SQL 224: cuántas lleva en su período de 90 días (pos_tardes_periodo_), ya no en el mes. */
  if p_tipo = 'entrada' and not exists (
       select 1 from pos_tiempos x join orden_personas p on p.id = x.persona_id
        where x.persona_id = v_yo and x.estado = 'ok' and x.tipo = 'entrada' and x.dia = v_dia and x.id <> v_id
          and x.momento < v_ahora and coalesce(x.local_id, p.local_id) = v_loc.id) then
    v_min := pos_minutos_tarde_(v_loc.id, v_dia, v_ahora);
    if v_min between 11 and 180 then
      select t.n, t.desde, t.hasta into v_n, v_desde, v_hasta from pos_tardes_periodo_(v_yo, v_dia) t;
      v_de := to_char(v_desde, 'FMDD/FMMM');
      v_al := to_char(v_hasta, 'FMDD/FMMM');
      v_mes := 'estos 90 días';   -- para la app de antes (impecable-v77), que arma «… en {mes}»
      v_abre := (select to_char(case when extract(isodow from v_dia) = 7 and z.apertura_domingo is not null then z.apertura_domingo
                                     else l.hora_apertura end, 'FMHH24:MI')
                   from orden_locales l left join pos_tiempos_locales z on z.local_id = l.id where l.id = v_loc.id);
      v_hora := to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'FMHH24:MI');
      v_quien := orden_nombre_lista(v_p.nombre, v_p.inicial);
      v_clave := 'tarde:' || v_yo || ':' || v_desde || ':' || v_n;
      if v_n = 3 then
        perform orden_encolar_aviso(v_yo, 'llegadas', 'Ya acumulás 3 llegadas tarde desde el ' || v_de,
          'Ojo: si llegás tarde otra vez hasta el ' || v_al || ', corrés riesgo de suspensión.', '/fichar', v_clave, 2::smallint);
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula 3 llegadas tarde desde el ' || v_de,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). Si llega tarde otra vez hasta el ' || v_al || ', corre riesgo de suspensión.', v_clave);
      elsif v_n >= 4 then
        perform pos_tarde_avisar_sup_(v_yo, v_loc.id, v_quien || ' ya acumula ' || v_n || ' llegadas tarde desde el ' || v_de,
          'Hoy llegó a las ' || v_hora || ' a ' || v_loc.nombre || ' (abre a las ' || v_abre || '). Corre riesgo de suspensión.', v_clave);
      end if;
      v_tarde := jsonb_build_object('min', v_min, 'abre', v_abre, 'n', v_n, 'mes', v_mes, 'desde', v_de, 'hasta', v_al);
    end if;
  end if;

  return jsonb_build_object('ya', false, 'id', v_id, 'tipo', p_tipo, 'local', v_loc.nombre,
                            'hora', to_char(v_ahora at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                            'aviso', nullif(array_to_string(v_aviso, ' '), ''), 'tarde', v_tarde);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 227 (01/11/2026) · EL FICHERO EN LA OFICINA
--
--  Mauricio (01/11): "Necesito que esté en mi sistema … si lo quiero mostrar
--  al dueño mañana, no lo voy a tener." Hasta acá el QR salía sólo en la
--  compu habilitada de cada local (pos_fichero_qr2 pide su llave).
--  · pos_fichero_qr2_oficina(p_local): lo mismo que pos_fichero_qr2 (los QR
--    del próximo medio minuto, la hora de la base y quién fichó hoy), pero
--    para un administrador con su sesión, eligiendo el local. Usa la compu
--    habilitada de ese local: el QR es el mismo que se ve en el local, y
--    fichar con él es fichar en ese local.
--  · Trae también la lista de los locales que tienen compu habilitada, para
--    el desplegable.
--  No afloja nada: un administrador ya puede cargar marcas a mano (Gestión
--  → Personal → Registro de tiempos).
-- ═══════════════════════════════════════════════════════════════════════════

/* Sin el 225 no hay QR en movimiento: se frena acá, sin cambiar nada. */
do $$
begin
  if to_regprocedure('public.pos_fichero_firma2(bigint, bigint)') is null then
    raise exception 'Primero hay que correr el SQL 225 (el fichero con el QR en movimiento): está en App Orden.';
  end if;
end $$;

create or replace function pos_fichero_qr2_oficina(p_local uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_locales jsonb;
  v_loc     orden_locales;
  v_caja    bigint;
  v_ahora   timestamptz := clock_timestamp();
  v_p       bigint;
begin
  if not orden_es_admin() then
    raise exception 'El fichero de la oficina es sólo para los administradores: el de cada local está en su compu.';
  end if;
  /* Los locales con su compu habilitada (sin ella no hay QR que mostrar). */
  select coalesce(jsonb_agg(jsonb_build_array(l.id, l.nombre) order by l.nombre), '[]'::jsonb) into v_locales
    from orden_locales l
   where l.activo and exists (select 1 from club_cajas c where c.baja is null and upper(btrim(c.local)) = upper(btrim(l.codigo)));
  select * into v_loc from orden_locales l where l.activo and l.id = p_local;
  if v_loc.id is null and jsonb_array_length(v_locales) > 0 then   -- sin elegir (o uno que ya no está): el primero
    select * into v_loc from orden_locales l where l.id = (v_locales -> 0 ->> 0)::uuid;
  end if;
  if v_loc.id is null then
    raise exception 'Ningún local tiene su compu habilitada: se habilita en Config → General → Las compus de los locales.';
  end if;
  select c.id into v_caja from club_cajas c
   where c.baja is null and upper(btrim(c.local)) = upper(btrim(v_loc.codigo)) order by c.id desc limit 1;
  if v_caja is null then
    raise exception '% no tiene su compu habilitada: se habilita en Config → General → Las compus de los locales.', v_loc.nombre;
  end if;
  v_p := floor(extract(epoch from v_ahora) * 2)::bigint;   -- el medio segundo de ahora
  return jsonb_build_object(
    'local_id', v_loc.id,
    'local', v_loc.nombre,
    'locales', v_locales,
    'ahora_ms', floor(extract(epoch from v_ahora) * 1000)::bigint,
    'paso_ms', 500,
    'codigos', (select jsonb_agg(jsonb_build_array(k, 'VDHF2.' || v_caja || '.' || k || '.' || pos_fichero_firma2(v_caja, k)) order by k)
                  from generate_series(v_p, v_p + 59) k),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_array(u.nombre, u.tipo, u.hora, u.id) order by u.momento desc)
        from (select x.id, orden_nombre_lista(p.nombre, p.inicial) nombre, x.tipo, x.momento,
                     to_char(x.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') hora
                from pos_tiempos x join orden_personas p on p.id = x.persona_id
               where x.local_id = v_loc.id and x.dia = pos_hoy() and x.estado = 'ok'
               order by x.momento desc limit 8) u), '[]'::jsonb));
end $$;

revoke all on function pos_fichero_qr2_oficina(uuid) from public, anon;
grant execute on function pos_fichero_qr2_oficina(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 226 (01/11/2026) · CREAR, RENOMBRAR Y DAR DE BAJA LAS LISTAS DE PRECIOS
--
--  Mauricio (1/11), en Gestión → Listas de precios: "Tendríamos que tener acá
--  una sección para crear lista de precios, ¿no? Si quiero modificar una,
--  cambiarle el nombre, crear una." Hasta acá las dos listas (la 100 y la de
--  los locales de calle) se habían creado desde la base.
--  · Una lista nueva sale de una de tres maneras: calculada de otra con un
--    porcentaje y un redondeo (como los locales de calle), copia de otra
--    (arranca con los mismos precios y después va por su cuenta; de una
--    calculada se copian los precios calculados) o vacía (se llena con
--    «Subir lista de BlueSoft» o a mano). La base de una calculada es siempre
--    una lista con precios propios: pos_precios calcula un solo nivel.
--  · Dar de baja no borra: las ventas, los cambios y los cambios en bloque
--    guardan con qué lista se hicieron. No se puede mientras una sucursal la
--    use u otra lista se calcule de ella, ni dejar sin listas. Se vuelve a
--    usar con pos_lista_reactivar.
--  · El nombre no se repite (sin importar mayúsculas), tampoco con las dadas
--    de baja.
-- ═══════════════════════════════════════════════════════════════════════════

/* El nombre de una lista, sin espacios de más: de 1 a 60 letras y que no lo tenga otra (ni una dada de baja). */
create or replace function pos_lista_nombre_(p_nombre text, p_lista int) returns text
language plpgsql stable security definer set search_path = public as $$
declare n text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'); o pos_listas;
begin
  if n = '' then raise exception 'Escribí el nombre de la lista.'; end if;
  if length(n) > 60 then raise exception 'El nombre es demasiado largo (hasta 60 letras).'; end if;
  select * into o from pos_listas where lower(nombre) = lower(n) and id is distinct from p_lista limit 1;
  if found then
    raise exception 'Ya hay una lista que se llama «%»%.', o.nombre,
      case when o.activo then '' else ' (está dada de baja: se puede volver a usar)' end;
  end if;
  return n;
end $$;

/* Una lista nueva. p_tipo: 'calculada' (de p_de, que tiene que tener precios propios, con p_ajuste % y
   p_redondeo), 'copia' (los precios de p_de; si p_de se calcula de otra, los calculados) o 'vacia'.
   Devuelve su id, el nombre como quedó y cuántos precios copió. */
create or replace function pos_lista_crear(p_nombre text, p_tipo text, p_de int, p_ajuste numeric, p_redondeo int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text; d pos_listas; v_id int; v_n int := 0;
begin
  perform pos_permiso('gestion');
  n := pos_lista_nombre_(p_nombre, null);
  if p_tipo is null or p_tipo not in ('calculada', 'copia', 'vacia') then raise exception 'Elegí de dónde salen los precios.'; end if;
  if p_tipo <> 'vacia' then
    select * into d from pos_listas where id = p_de and activo;
    if not found then raise exception 'Elegí de qué lista salen los precios.'; end if;
  end if;
  if p_tipo = 'calculada' then
    if d.base_id is not null then raise exception '«%» ya se calcula de otra: elegí una lista con precios propios.', d.nombre; end if;
    if p_ajuste is null or p_ajuste <= -100 or p_ajuste > 300 then raise exception 'El porcentaje no es válido.'; end if;
    if p_redondeo is null or p_redondeo < 1 or p_redondeo > 10000 then raise exception 'El redondeo no es válido.'; end if;
  end if;
  insert into pos_listas (nombre, base_id, ajuste, redondeo)
  values (n, case when p_tipo = 'calculada' then d.id end,
          case when p_tipo = 'calculada' then round(p_ajuste, 2) else 0 end,
          case when p_tipo = 'calculada' then p_redondeo else 1 end)
  returning id into v_id;
  if p_tipo = 'copia' then
    /* Los mismos precios que ve la venta en p_de (la cuenta de pos_precios). */
    insert into pos_precios (lista_id, codigo, precio, actualizado_por)
    select v_id, x.codigo, x.precio, orden_yo_id()
      from (select coalesce(p.codigo, b.codigo) codigo,
                   coalesce(p.precio, round(b.precio * (1 + d.ajuste / 100) / d.redondeo) * d.redondeo) precio
              from (select codigo, precio from pos_precios where lista_id = d.id) p
              full join (select codigo, precio from pos_precios where lista_id = d.base_id) b on b.codigo = p.codigo) x
     where x.precio is not null;
    get diagnostics v_n = row_count;
  end if;
  return jsonb_build_object('id', v_id, 'nombre', n, 'copiados', v_n);
end $$;

/* Cambiarle el nombre a una lista. Devuelve el nombre como quedó. */
create or replace function pos_lista_renombrar(p_lista int, p_nombre text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare n text;
begin
  perform pos_permiso('gestion');
  if not exists (select 1 from pos_listas where id = p_lista and activo) then raise exception 'No existe esa lista de precios.'; end if;
  n := pos_lista_nombre_(p_nombre, p_lista);
  update pos_listas set nombre = n where id = p_lista;
  return n;
end $$;

/* Dar de baja una lista: deja de aparecer en Listas de precios y en Sucursales. No se borra nada. */
create or replace function pos_lista_baja(p_lista int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare l pos_listas; v text; k int;
begin
  perform pos_permiso('gestion');
  select * into l from pos_listas where id = p_lista and activo for update;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  select string_agg(o.nombre, ', ' order by o.nombre) into v
    from pos_sucursales s join orden_locales o on o.id = s.local_id
   where s.lista_id = p_lista;
  if v is not null then raise exception 'La usan: %. Primero pasá esas sucursales a otra lista (en Sucursales).', v; end if;
  select string_agg('«' || nombre || '»', ' y ' order by id), count(*) into v, k from pos_listas where base_id = p_lista and activo;
  if k > 0 then
    raise exception '% se calcula% de esta: primero da% de baja.', v, case when k > 1 then 'n' else '' end,
      case when k > 1 then 'las' else 'la' end;
  end if;
  if not exists (select 1 from pos_listas where activo and id <> p_lista) then raise exception 'Tiene que quedar al menos una lista.'; end if;
  update pos_listas set activo = false where id = p_lista;
  return true;
end $$;

/* Volver a usar una lista dada de baja. */
create or replace function pos_lista_reactivar(p_lista int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare l pos_listas; b pos_listas;
begin
  perform pos_permiso('gestion');
  select * into l from pos_listas where id = p_lista and not activo for update;
  if not found then raise exception 'Esa lista no está dada de baja.'; end if;
  if l.base_id is not null then
    select * into b from pos_listas where id = l.base_id;
    if not b.activo then
      raise exception '«%» se calcula de «%», que está dada de baja: primero volvé a usar esa.', l.nombre, b.nombre;
    end if;
  end if;
  update pos_listas set activo = true where id = p_lista;
  return true;
end $$;

/* Las listas dadas de baja (pos_inicio trae sólo las que se usan). */
create or replace function pos_listas_bajas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso('gestion');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'base_id', x.base_id,
                                        'propios', (select count(*) from pos_precios p where p.lista_id = x.id)) order by x.nombre)
      from pos_listas x where not x.activo), '[]'::jsonb);
end $$;

revoke all on function pos_lista_nombre_(text, int) from public, anon, authenticated;
revoke all on function pos_lista_crear(text, text, int, numeric, int), pos_lista_renombrar(int, text), pos_lista_baja(int),
                       pos_lista_reactivar(int), pos_listas_bajas() from public, anon;
grant execute on function pos_lista_crear(text, text, int, numeric, int), pos_lista_renombrar(int, text), pos_lista_baja(int),
                          pos_lista_reactivar(int), pos_listas_bajas() to authenticated;

/* ─── SQL 229 (2/11/2026) · LA GESTIÓN POR PERSONA ───
   Mauricio (2/11): "Sí, gestión, dáselo también; no van a tocar nada, tranqui." La Gestión del POS deja
   de ser sólo de Administración: la oficina la prende a una persona con «Entra a Gestión» en Config →
   Usuarios (pos_permisos, clave 'gestion'); por rol sigue apagada. nc_yo trae 'gestion' para la barra.
   En el registro de tiempos, lo de uno lo carga a mano y lo anula otro (con la Gestión abierta, nadie tapa
   su propia llegada tarde).
   (El mismo SQL les prendió todo el POS y la Gestión a los de Rivadavia: eso son datos y no va acá.) */
CREATE OR REPLACE FUNCTION public.pos_puede_persona(p orden_personas, p_que text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p.id is null or not coalesce(p.activo, false) or not coalesce(p.aprobado, false) then false
    when p.rol = 'admin' then true
    /* SQL 229: la Gestión ya no es sólo de Administración: la prende la oficina a una persona (pos_permisos). */
    else coalesce((select (x.cambios ->> p_que)::boolean from pos_permisos x where x.persona_id = p.id),
                  pos_permiso_del_rol(p.rol::text, p.local_id is not null, p_que)) end
$function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_lista()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion'];
begin
  if not orden_es_admin() then raise exception 'Los permisos del POS los maneja Administración.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then true
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_guardar(p_persona uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion'];
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() then raise exception 'Los permisos del POS los maneja Administración.' using errcode = '42501'; end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if q.rol = 'admin' then raise exception 'El administrador tiene todo el POS: no se le cambia nada.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $function$;

CREATE OR REPLACE FUNCTION public.nc_yo()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 190: si usa el POS (lo prende la oficina en Config → Usuarios). */
           'pos', pos_puede_persona(p, 'usa'),
           /* SQL 229: si entra a la Gestión del POS (la prende la oficina en Config → Usuarios; pide también el POS). */
           'gestion', pos_puede_persona(p, 'usa') and pos_puede_persona(p, 'gestion'),
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$function$;

CREATE OR REPLACE FUNCTION public.pos_tiempo_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clave   text := nullif(btrim(coalesce(p->>'clave', '')), '');
  v_persona uuid;
  v_local   uuid;
  v_dia     date;
  v_nombre  text;
  v_obs     text := left(btrim(coalesce(p->>'observaciones', '')), 200);
  v_r       record;
  v_tipo    text;
  v_hora    text;
  v_mom     timestamptz;
  v_ant     timestamptz;
  v_id      bigint;
  v_ids     bigint[] := '{}';
begin
  perform pos_permiso('gestion');
  /* Tocaron dos veces Guardar: lo que ya se guardó con esa clave. */
  if v_clave is not null and exists (select 1 from pos_tiempos where clave = v_clave || ':1') then
    return jsonb_build_object('ids', (select jsonb_agg(id order by id) from pos_tiempos where clave like v_clave || ':_'), 'repetido', true);
  end if;
  begin
    v_persona := nullif(p->>'persona_id', '')::uuid;
    v_local := nullif(p->>'local_id', '')::uuid;
    v_dia := nullif(p->>'dia', '')::date;
  exception when others then
    raise exception 'Faltan datos: la sucursal, la persona o la fecha no se entienden.';
  end;
  select orden_nombre_lista(x.nombre, x.inicial) into v_nombre from orden_personas x where x.id = v_persona;
  if v_nombre is null then raise exception 'Elegí la persona.'; end if;
  /* SQL 229: con la Gestión abierta a los locales, lo tuyo lo carga otro (como el control del mes). */
  if v_persona = orden_yo_id() and not orden_es_admin() then raise exception 'Lo tuyo lo carga otro: tu supervisor o la oficina.'; end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local) then raise exception 'Elegí la sucursal.'; end if;
  if v_dia is null then raise exception 'Elegí la fecha.'; end if;
  if v_dia > pos_hoy() then raise exception 'No se puede cargar un día que todavía no llegó.'; end if;
  if v_dia < pos_hoy() - 400 then raise exception 'Esa fecha es de hace más de un año.'; end if;
  if length(v_obs) < 3 then raise exception 'Escribí por qué se carga a mano (por ejemplo: se olvidó de poner la huella).'; end if;
  if jsonb_typeof(p->'registros') is distinct from 'array' or jsonb_array_length(p->'registros') not between 1 and 4 then
    raise exception 'No hay nada para guardar.';
  end if;
  for v_r in select e.x, e.n from jsonb_array_elements(p->'registros') with ordinality e(x, n) order by e.n loop
    v_tipo := v_r.x->>'tipo';
    v_hora := btrim(coalesce(v_r.x->>'hora', ''));
    if v_tipo is null or v_tipo not in ('entrada', 'salida') then raise exception 'Elegí si es una entrada o una salida.'; end if;
    if v_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'La hora «%» no se entiende: escribila como 09:00.', v_hora; end if;
    v_mom := (v_dia + v_hora::time) at time zone 'America/Argentina/Buenos_Aires';
    if v_mom > now() + interval '5 minutes' then raise exception 'Las % todavía no pasaron: se carga cuando pase.', v_hora; end if;
    if v_ant is not null and v_mom <= v_ant then raise exception 'Las horas tienen que ir en orden: las % van después de la anterior.', v_hora; end if;
    v_ant := v_mom;
    if exists (select 1 from pos_tiempos x where x.persona_id = v_persona and x.tipo = v_tipo and x.estado = 'ok'
                and x.momento > v_mom - interval '1 minute' and x.momento < v_mom + interval '1 minute') then
      raise exception 'Ya está cargada la % de las % de %.', v_tipo, v_hora, rtrim(v_nombre, '.');   -- "de Nano M." sin otro punto
    end if;
    insert into pos_tiempos (persona_id, local_id, momento, dia, tipo, origen, observaciones, cargado_por, clave)
    values (v_persona, v_local, v_mom, v_dia, v_tipo, 'manual', v_obs, orden_yo_id(),
            case when v_clave is not null then v_clave || ':' || v_r.n end)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('ids', to_jsonb(v_ids), 'persona', v_nombre);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_tiempo_anular(p_id bigint, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v pos_tiempos;
begin
  perform pos_permiso('gestion');
  if length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into v from pos_tiempos where id = p_id for update;
  if v.id is null then raise exception 'Ese registro ya no está.'; end if;
  if v.estado = 'anulado' then raise exception 'Ese registro ya estaba anulado.'; end if;
  /* SQL 229: lo mismo para anular. */
  if v.persona_id = orden_yo_id() and not orden_es_admin() then raise exception 'Lo tuyo lo anula otro: tu supervisor o la oficina.'; end if;
  update pos_tiempos set estado = 'anulado', anulado_en = clock_timestamp(), anulado_por = orden_yo_id(), anulado_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
  return jsonb_build_object('id', p_id);
end $function$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 230 (02/11/2026) · EL FICHERO DE PRUEBA EN RIVADAVIA, CON EL USUARIO
--
--  Mauricio (2/11): "rivadavia tendria que tener para fichar asi lo probamos".
--  La compu de Rivadavia había perdido su llave (la caja 14, sin uso desde el
--  27/10) y para el fichero hacía falta abrir allá el enlace de Config. Él:
--  "agregame la seccion, es de prueba".
--  · pos_fichero_prueba: los locales donde, DE PRUEBA, quien es del local
--    (vendedor o encargado, activo y aprobado) ve «Fichero» con su usuario,
--    en cualquier compu y sin el enlace: el mismo QR que daría la compu del
--    local (el de su caja habilitada más nueva). Va Rivadavia.
--  · OJO: así no hay compu que ate el fichero al local; con el usuario abierto
--    en otra compu se podría fichar desde ahí. Por eso es de prueba: se saca
--    borrando el local de pos_fichero_prueba (o con deshacer-230.sql).
--  · nc_yo suma 'fichero' (la barra y fichero.html lo leen), y
--    pos_fichero_qr2_oficina, que era sólo de los administradores, deja pasar
--    a esas personas, sólo con el QR de su local.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists pos_fichero_prueba (
  local_id uuid primary key references orden_locales(id),
  desde    timestamptz not null default now()
);
alter table pos_fichero_prueba enable row level security;
revoke all on pos_fichero_prueba from anon, authenticated;

/* El local de quien entró, si ese local tiene el fichero de prueba y es suyo (vendedor o encargado). */
create or replace function pos_fichero_prueba_local_() returns uuid
language sql stable security definer set search_path = public as $$
  select p.local_id
    from orden_personas p join pos_fichero_prueba f on f.local_id = p.local_id
   where p.id = orden_yo_id() and p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
$$;
revoke all on function pos_fichero_prueba_local_() from public, anon, authenticated;

create or replace function nc_yo() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 190: si usa el POS (lo prende la oficina en Config → Usuarios). */
           'pos', pos_puede_persona(p, 'usa'),
           /* SQL 229: si entra a la Gestión del POS (la prende la oficina en Config → Usuarios; pide también el POS). */
           'gestion', pos_puede_persona(p, 'usa') and pos_puede_persona(p, 'gestion'),
           /* SQL 230: el fichero de prueba de su local, con su usuario (pos_fichero_prueba). */
           'fichero', p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
                      and exists (select 1 from pos_fichero_prueba f where f.local_id = p.local_id),
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$$;

create or replace function pos_fichero_qr2_oficina(p_local uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_locales jsonb;
  v_loc     orden_locales;
  v_caja    bigint;
  v_ahora   timestamptz := clock_timestamp();
  v_p       bigint;
  v_prueba  uuid;
begin
  /* SQL 230: además del administrador, quien es de un local con el fichero de prueba: sólo el de su local. */
  if not orden_es_admin() then
    v_prueba := pos_fichero_prueba_local_();
    if v_prueba is null then
      raise exception 'El fichero de la oficina es sólo para los administradores: el de cada local está en su compu.';
    end if;
  end if;
  /* Los locales con su compu habilitada (sin ella no hay QR que mostrar). */
  select coalesce(jsonb_agg(jsonb_build_array(l.id, l.nombre) order by l.nombre), '[]'::jsonb) into v_locales
    from orden_locales l
   where l.activo and (v_prueba is null or l.id = v_prueba)
     and exists (select 1 from club_cajas c where c.baja is null and upper(btrim(c.local)) = upper(btrim(l.codigo)));
  select * into v_loc from orden_locales l where l.activo and l.id = coalesce(v_prueba, p_local);
  if v_loc.id is null and jsonb_array_length(v_locales) > 0 then   -- sin elegir (o uno que ya no está): el primero
    select * into v_loc from orden_locales l where l.id = (v_locales -> 0 ->> 0)::uuid;
  end if;
  if v_loc.id is null then
    raise exception 'Ningún local tiene su compu habilitada: se habilita en Config → General → Las compus de los locales.';
  end if;
  select c.id into v_caja from club_cajas c
   where c.baja is null and upper(btrim(c.local)) = upper(btrim(v_loc.codigo)) order by c.id desc limit 1;
  if v_caja is null then
    raise exception '% no tiene su compu habilitada: se habilita en Config → General → Las compus de los locales.', v_loc.nombre;
  end if;
  v_p := floor(extract(epoch from v_ahora) * 2)::bigint;   -- el medio segundo de ahora
  return jsonb_build_object(
    'local_id', v_loc.id,
    'local', v_loc.nombre,
    'locales', v_locales,
    'ahora_ms', floor(extract(epoch from v_ahora) * 1000)::bigint,
    'paso_ms', 500,
    'codigos', (select jsonb_agg(jsonb_build_array(k, 'VDHF2.' || v_caja || '.' || k || '.' || pos_fichero_firma2(v_caja, k)) order by k)
                  from generate_series(v_p, v_p + 59) k),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_array(u.nombre, u.tipo, u.hora, u.id) order by u.momento desc)
        from (select x.id, orden_nombre_lista(p.nombre, p.inicial) nombre, x.tipo, x.momento,
                     to_char(x.momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') hora
                from pos_tiempos x join orden_personas p on p.id = x.persona_id
               where x.local_id = v_loc.id and x.dia = pos_hoy() and x.estado = 'ok'
               order by x.momento desc limit 8) u), '[]'::jsonb));
end $$;

revoke all on function pos_fichero_qr2_oficina(uuid) from public, anon;
grant execute on function pos_fichero_qr2_oficina(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 231 (02/11/2026) · IVA VENTAS
--
--  Mauricio (2/11), con dos fotos del «Reporte IVA Ventas» de BlueSoft: "esta
--  es la sección de consulta de IVA, es algo que usamos, todos los primeros de
--  cada mes mandamos IVA por mail a la fábrica del mes anterior".
--  · Un renglón por comprobante: las facturas A y B (las X son internas y no
--    van) y las notas de crédito (SQL 205), en negativo, el día que se
--    hicieron. El ticket anulado con una nota sigue en su día: los dos
--    comprobantes existen. Una A o B anulada sin nota (de antes del 205) no va.
--  · Base imponible = total ÷ 1,21 redondeado al centavo, e IVA 21 % = total −
--    base, comprobante por comprobante, como BlueSoft (61.350 → 50.702,48 +
--    10.647,52). El total ya trae el interés de las cuotas (SQL 215).
--  · El CAE: el de la factura de ARCA cuando el POS facture (factura->>'cae';
--    en la nota, el suyo). Hoy la factura la hace BlueSoft: va vacío.
--  · Las de prueba no van nunca. Sólo lee.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pos_iva_ventas(p_desde date, p_hasta date, p_local uuid default null, p_letra text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_letra is not null and p_letra not in ('A', 'B') then raise exception 'En el IVA van sólo las facturas A y B.'; end if;
  return (
    with z as (
      select 'ticket'::text tipo, v.id venta_id, v.local_id, v.fecha, v.dia, v.letra, v.numero, null::int nc,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, v.total, nullif(v.factura->>'cae', '') cae
        from pos_ventas v
       where v.dia between p_desde and p_hasta
         and not v.prueba
         and v.letra in ('A', 'B')
         and (v.estado = 'cobrada' or exists (select 1 from pos_notas_credito n where n.venta_id = v.id))
         and (p_local is null or v.local_id = p_local)
         and (p_letra is null or v.letra = p_letra)
      union all
      select 'nc', v.id, n.local_id, n.fecha, n.dia, n.letra, v.numero, n.numero,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, -v.total, n.cae
        from pos_notas_credito n join pos_ventas v on v.id = n.venta_id
       where n.dia between p_desde and p_hasta
         and not n.prueba
         and (p_local is null or n.local_id = p_local)
         and (p_letra is null or n.letra = p_letra)
    ),
    y as (select z.*, round(z.total / 1.21, 2) base from z)
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'tipo', y.tipo, 'venta_id', y.venta_id, 'fecha', y.fecha, 'dia', y.dia, 'letra', y.letra, 'numero', y.numero, 'nc', y.nc,
                 'local', l.nombre, 'local_id', y.local_id, 'cliente', coalesce(y.cliente_nombre, 'Consumidor final'), 'doc', y.cliente_doc,
                 'condicion', y.cliente_condicion, 'base', y.base, 'iva', y.total - y.base, 'total', y.total, 'cae', y.cae)
                 order by y.fecha, y.tipo desc)
          from (select * from y order by fecha, tipo desc limit 20000) y join orden_locales l on l.id = y.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object('tickets', count(*) filter (where tipo = 'ticket'), 'notas', count(*) filter (where tipo = 'nc'),
                                            'base', coalesce(sum(base), 0), 'iva', coalesce(sum(total - base), 0), 'total', coalesce(sum(total), 0))
                    from y),
      'mas', (select count(*) > 20000 from y)
    )
  );
end $$;

revoke all on function pos_iva_ventas(date, date, uuid, text) from public, anon;
grant execute on function pos_iva_ventas(date, date, uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 236 (04/11/2026) · EL POS Y LA GESTIÓN, SÓLO PARA LOS ADMINISTRADORES
--  QUE ELIJA LA OFICINA
--
--  Mauricio (3/11), después de juntarse con el dueño (el POS va a tener las
--  ventas y la caja, y más adelante la fábrica): "sólo los administradores:
--  Anto, Daky y yo". Hasta acá todo administrador tenía el POS y la Gestión
--  por serlo.
--  · El administrador tiene el POS sólo si se lo prenden en Config → Usuarios
--    («Usa el POS y la Gestión»); con eso tiene todo, como antes. Sin eso, nada
--    del POS ni de la Gestión. Un administrador nuevo arranca sin el POS.
--  · pos_puede ya no deja pasar a todo administrador: sólo al servicio (los
--    avisos de cada hora, Hermes) y a quien lo tiene.
--  · Los permisos del POS los maneja un administrador que tiene el POS; el
--    suyo no se lo saca él mismo (así nunca queda nadie sin poder prenderlo).
--  · El cartel de las diferencias de remitos, sólo a quien tiene la Gestión.
--  (A quién se lo prendió este SQL son datos y no van acá.)
-- ═══════════════════════════════════════════════════════════════════════════

/* Lo que trae cada rol. SQL 236: el administrador, todo menos usar el POS (lo prende la oficina). */
create or replace function pos_permiso_del_rol(p_rol text, p_con_local boolean, p_que text) returns boolean
language sql immutable as $$
  select case
    when p_rol = 'admin' then p_que not in ('usa', 'gestion')
    when p_que in ('usa', 'gestion') then false
    when p_rol = 'supervisor' then p_que <> 'locales' or not coalesce(p_con_local, false)
    else false end
$$;

/* ¿Esta persona puede esto? SQL 236: el administrador, todo si tiene «Usa el POS»; si no, nada. */
create or replace function pos_puede_persona(p orden_personas, p_que text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p.id is null or not coalesce(p.activo, false) or not coalesce(p.aprobado, false) then false
    when p.rol = 'admin' then coalesce((select (x.cambios ->> 'usa')::boolean from pos_permisos x where x.persona_id = p.id), false)
    else coalesce((select (x.cambios ->> p_que)::boolean from pos_permisos x where x.persona_id = p.id),
                  pos_permiso_del_rol(p.rol::text, p.local_id is not null, p_que)) end
$$;

/* Y la persona que entró. SQL 236: sin la puerta del administrador; el servicio sigue pasando. */
create or replace function pos_puede(p_que text) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or coalesce((select pos_puede_persona(p, p_que) from orden_personas p where p.id = orden_yo_id()), false)
$$;

/* Config → Usuarios. SQL 236: la abre un administrador con el POS; 'admin_elige' le dice a la pantalla que al
   administrador también se le prende o se le apaga. */
create or replace function pos_permisos_lista() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion'];
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'admin_elige', true,
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then coalesce((x.cambios ->> 'usa')::boolean, false)
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $$;

create or replace function pos_permisos_guardar(p_persona uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion'];
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  /* SQL 236: al administrador, sólo «Usa el POS» (con eso tiene todo, también la Gestión). El suyo no se lo saca él. */
  if q.rol = 'admin' then
    if jsonb_typeof(p->'usa') is distinct from 'boolean' then raise exception 'Falta si usa el POS.'; end if;
    if q.id = orden_yo_id() and not (p->>'usa')::boolean then
      raise exception 'Tu POS no te lo podés sacar vos: te lo saca otro administrador.';
    end if;
    p := jsonb_build_object('usa', p->'usa');
  end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $$;

/* El aviso al abrir el sistema (SQL 236: con la Gestión). */
CREATE OR REPLACE FUNCTION public.pos_diferencias_aviso()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /* SQL 236: sólo a quien tiene la Gestión (el administrador, si tiene el POS). */
  if not orden_es_admin() or not pos_puede('gestion') then return jsonb_build_object('pendientes', 0, 'ultimo', 0, 'productos', '[]'::jsonb); end if;
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
end $function$;


/* ═══════════════════════════════════════════════════════════════════════════
   ─── SQL 256 (6/11/2026) · «ENTRA A FÁBRICA» EN CONFIG → USUARIOS ───
   Mauricio (6/11): la sección Fábrica (fabrica.html) para la gente de la fábrica (Lucas), sin darle Administración.
   1. Una casilla nueva por persona, «Entra a Fábrica» (clave 'fabrica' en pos_permisos), apagada para todos. Al
      administrador le viene con el POS, como hasta ahora.
   2. Con ella se entra a Fábrica → Remitos y Diferencias aunque no use el POS: ve los remitos de todos los locales y de
      todos los días, arma los que salen de la fábrica (y anula ésos), da por recibidas las devoluciones y resuelve las
      diferencias. No ve ventas, caja ni plata (los precios siguen con «Ver los precios…» del POS).
   3. Nada cambia para los demás: quien tenía algo lo sigue teniendo igual.
   Son 18 funciones (sin tablas nuevas). Se puede correr dos veces. Se deshace con deshacer-256.sql. ═══════════════════════════════════════════════════════════════════════════ */

CREATE OR REPLACE FUNCTION public.pos_permiso_del_rol(p_rol text, p_con_local boolean, p_que text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_rol = 'admin' then p_que not in ('usa', 'gestion')
    when p_que in ('usa', 'gestion', 'fabrica') then false   -- SQL 256: «Entra a Fábrica», apagada para todos
    when p_rol = 'supervisor' then p_que <> 'locales' or not coalesce(p_con_local, false)
    else false end
$function$;

CREATE OR REPLACE FUNCTION public.pos_mis_permisos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('usa', pos_puede('usa'), 'anular', pos_puede('anular'), 'envios', pos_puede('envios'),
           'caja', pos_puede('caja'), 'dias', pos_puede('dias'), 'locales', pos_puede('locales'), 'precios', pos_puede('precios'),
           'gestion', pos_puede('gestion'),
           'fabrica', pos_puede('fabrica'),   -- SQL 256
           'mios', coalesce((select jsonb_agg(l.id) from orden_locales l where l.activo and pos_local_mio(l.id)), '[]'::jsonb))
$function$;

CREATE OR REPLACE FUNCTION public.nc_yo()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 190: si usa el POS (lo prende la oficina en Config → Usuarios). */
           'pos', pos_puede_persona(p, 'usa'),
           /* SQL 229: si entra a la Gestión del POS (la prende la oficina en Config → Usuarios; pide también el POS). */
           'gestion', pos_puede_persona(p, 'usa') and pos_puede_persona(p, 'gestion'),
           /* SQL 256: si entra a la Fábrica (los remitos de la fábrica a los locales y sus diferencias), aunque no use el
              POS. Al administrador le viene con el POS. */
           'fabrica', pos_puede_persona(p, 'fabrica'),
           /* SQL 230: el fichero de prueba de su local, con su usuario (pos_fichero_prueba). */
           'fichero', p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
                      and exists (select 1 from pos_fichero_prueba f where f.local_id = p.local_id),
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_lista()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion', 'fabrica'];   -- SQL 256: «Entra a Fábrica»
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'admin_elige', true,
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then coalesce((x.cambios ->> 'usa')::boolean, false)
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_guardar(p_persona uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios', 'gestion', 'fabrica'];   -- SQL 256: «Entra a Fábrica»
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  /* SQL 236: al administrador, sólo «Usa el POS» (con eso tiene todo, también la Gestión). El suyo no se lo saca él. */
  if q.rol = 'admin' then
    if jsonb_typeof(p->'usa') is distinct from 'boolean' then raise exception 'Falta si usa el POS.'; end if;
    if q.id = orden_yo_id() and not (p->>'usa')::boolean then
      raise exception 'Tu POS no te lo podés sacar vos: te lo saca otro administrador.';
    end if;
    p := jsonb_build_object('usa', p->'usa');
  end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_inicio()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica
  return jsonb_build_object(
    /* SQL 190: su local y lo que puede en el POS (las casillas de Config → Usuarios). */
    'yo', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'local_id', p.local_id) from orden_personas p where p.id = orden_yo_id()),
    'puede', pos_mis_permisos(),
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_articulos_version()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica
  return (select jsonb_build_object('n', count(*), 'v', max(actualizado_en)) from pos_articulos);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_articulos_todos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica
  return (select jsonb_build_object('n', count(*), 'v', max(a.actualizado_en),
                                    'filas', coalesce(jsonb_agg(pos_art_fila(a) order by a.codigo), '[]'::jsonb))
            from pos_articulos a);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remitos(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_estado text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_res jsonb;
begin
  /* SQL 256: la Fábrica ve los remitos de todos los locales y de todos los días, aunque no use el POS. */
  if not pos_puede('fabrica') then
    perform pos_permiso();
    perform pos_local_ok(p_local);   -- SQL 190
    if p_estado is distinct from 'pendiente' then perform pos_dias_ok(p_desde); end if;
  end if;
  if p_estado is not null and p_estado not in ('pendiente', 'recibido', 'con_diferencias', 'anulado') then
    raise exception 'Ese estado no existe.';
  end if;
  if p_estado is distinct from 'pendiente' then
    if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
    if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  end if;
  v_res := (
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
                 'anulado_motivo', z.anulado_motivo,
                 'total', (select sum(i.cantidad * i.precio) from pos_remito_items i where i.remito_id = z.id),
                 'sin_precio', (select count(distinct i.codigo) from pos_remito_items i where i.remito_id = z.id and i.precio is null),
                 /* SQL 193 */
                 'entre_depositos', coalesce(z.origen_local_id = z.destino_local_id, false),
                 'origen_deposito_id', z.origen_deposito_id, 'origen_deposito', dpo.nombre,
                 'destino_deposito_id', z.destino_deposito_id, 'destino_deposito', dpd.nombre,
                 'modulo', z.modulo, 'responsable', z.responsable,
                 'testigos_ok', (select count(*) from (select distinct on (t.codigo) t.coincide from pos_remito_testigos t
                                                        where t.remito_id = z.id order by t.codigo, t.id desc) u where u.coincide),
                 'testigos_mal', (select count(*) from (select distinct on (t.codigo) t.coincide from pos_remito_testigos t
                                                         where t.remito_id = z.id order by t.codigo, t.id desc) u where not u.coincide)) order by z.fecha desc)
          from (select * from r order by fecha desc limit 500) z
          left join orden_locales ld on ld.id = z.destino_local_id
          left join orden_locales lo on lo.id = z.origen_local_id
          left join pos_depositos dpo on dpo.id = z.origen_deposito_id
          left join pos_depositos dpd on dpd.id = z.destino_deposito_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'remitos', count(*) filter (where r.estado <> 'anulado'),
                    'pendientes', count(*) filter (where r.estado = 'pendiente'),
                    'con_diferencias', count(*) filter (where r.estado = 'con_diferencias'),
                    'anulados', count(*) filter (where r.estado = 'anulado'),
                    'unidades', coalesce((select sum(i.cantidad) from pos_remito_items i join r y on y.id = i.remito_id
                                           where y.estado <> 'anulado' and y.origen_local_id is distinct from y.destino_local_id), 0),
                    'monto', coalesce((select sum(i.cantidad * i.precio) from pos_remito_items i join r y on y.id = i.remito_id
                                        where y.estado <> 'anulado' and y.origen_local_id is distinct from y.destino_local_id), 0))
                    from r where r.origen_local_id is distinct from r.destino_local_id),
      'mas', (select count(*) > 500 from r)
    )
  );
  /* SQL 190: sin «Ver precios», sin montos; el que recibe no ve cuántas unidades vienen hasta contarlas. */
  if not pos_puede('precios') then
    v_res := jsonb_set(v_res, '{filas}', coalesce((select jsonb_agg(e || jsonb_build_object('total', null, 'sin_precio', null) order by o)
                                                     from jsonb_array_elements(v_res->'filas') with ordinality t(e, o)), '[]'::jsonb));
    v_res := jsonb_set(v_res, '{totales,monto}', 'null'::jsonb);
  end if;
  if not (pos_puede('gestion') or pos_puede('fabrica')) then   -- SQL 256
    v_res := jsonb_set(v_res, '{filas}', coalesce((select jsonb_agg(case when e->>'estado' = 'pendiente' and e->>'destino_local_id' is not null
                                                                      and not pos_local_mio((e->>'origen_local_id')::uuid)
                                                                 then e || jsonb_build_object('unidades', null, 'contadas', null, 'total', null) else e end order by o)
                                                     from jsonb_array_elements(v_res->'filas') with ordinality t(e, o)), '[]'::jsonb));
    v_res := jsonb_set(v_res, '{totales,unidades}', 'null'::jsonb);
  end if;
  return v_res;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remito(p_id uuid, p_completo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; v_o uuid; v_d uuid; v_completo boolean := coalesce(p_completo, false);
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: la Fábrica abre cualquiera, aunque no use el POS
  /* SQL 190: de un local suyo; las cantidades, al que lo manda (el que lo recibe, a ciegas). */
  if not (pos_puede('gestion') or pos_puede('fabrica')) then   -- SQL 256
    select x.origen_local_id, x.destino_local_id into v_o, v_d from pos_remitos x where x.id = p_id;
    if found and not (pos_local_mio(v_o) or pos_local_mio(v_d)) then perform pos_local_ok(coalesce(v_d, v_o)); end if;
    v_completo := v_completo and pos_local_mio(v_o);
  end if;
  select to_jsonb(x) - 'clave' || jsonb_build_object(
           'origen', coalesce(lo.nombre, 'Fábrica'), 'destino', coalesce(ld.nombre, 'Fábrica'),
           'anulado_por_nombre', (select pe.nombre from orden_personas pe where pe.id = x.anulado_por),
           /* SQL 193 */
           'entre_depositos', coalesce(x.origen_local_id = x.destino_local_id, false),
           'origen_deposito', (select d.nombre from pos_depositos d where d.id = x.origen_deposito_id),
           'destino_deposito', (select d.nombre from pos_depositos d where d.id = x.destino_deposito_id),
           'testigos', coalesce((select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'contado', t.contado, 'en_envio', t.en_envio, 'coincide', t.coincide,
                                                                     'fecha', t.fecha, 'quien', coalesce(t.quien, t.persona_nombre)) order by t.id)
                                   from pos_remito_testigos t where t.remito_id = x.id), '[]'::jsonb),
           'total', (select sum(i.cantidad * i.precio) from pos_remito_items i where i.remito_id = x.id),
           'productos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'codigo', g.codigo, 'descripcion', g.descripcion, 'precio', g.precio, 'razon', g.razon,
                      'estado', k.estado, 'recibido_en', k.recibido_en, 'recibido_nombre', coalesce(k.recibio, k.recibido_nombre),
                      'observaciones', k.observaciones, 'motivo', k.motivo,
                      'diferencias', (select jsonb_agg(jsonb_build_object('id', d.id, 'talle', d.talle, 'color', d.color, 'cantidad', d.cantidad,
                                                                          'contado', d.contado, 'estado', d.estado, 'resolucion', d.resolucion, 'nota', d.nota,
                                                                          'resuelta_en', d.resuelta_en, 'resuelta_nombre', d.resuelta_nombre,
                                                                          'remito_nuevo_numero', rn.numero) order by d.color, d.talle)
                                        from pos_remito_diferencias d left join pos_remitos rn on rn.id = d.remito_nuevo_id
                                       where d.remito_id = x.id and d.codigo = g.codigo),
                      'conteos', (select count(*) from pos_remito_conteos c where c.remito_id = x.id and c.codigo = g.codigo),
                      'celdas', (select jsonb_agg(case when k.codigo is not null or x.estado = 'anulado' or v_completo
                                                            or x.destino_local_id is null or x.origen_local_id = x.destino_local_id
                                                       then jsonb_build_object('talle', i.talle, 'color', i.color, 'cantidad', i.cantidad, 'contado', i.contado)
                                                       else jsonb_build_object('talle', i.talle, 'color', i.color) end
                                                  order by i.color, i.talle)
                                   from pos_remito_items i where i.remito_id = x.id and i.codigo = g.codigo))
                    order by g.orden, g.codigo)
               from (select i.codigo, max(i.descripcion) descripcion, min(i.orden) orden, max(i.precio) precio, max(i.razon) razon
                       from pos_remito_items i where i.remito_id = x.id group by i.codigo) g
               left join pos_remito_productos k on k.remito_id = x.id and k.codigo = g.codigo), '[]'::jsonb))
    into r
    from pos_remitos x
    left join orden_locales ld on ld.id = x.destino_local_id
    left join orden_locales lo on lo.id = x.origen_local_id
   where x.id = p_id;
  if r is null then raise exception 'No existe ese remito.'; end if;
  if not pos_puede('precios') then
    r := r || jsonb_build_object('total', null, 'productos', coalesce((select jsonb_agg(e || jsonb_build_object('precio', null) order by o)
                                                                          from jsonb_array_elements(r->'productos') with ordinality t(e, o)), '[]'::jsonb));
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remitos_producto(p_buscar text, p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q   text := translate(lower(btrim(coalesce(p_buscar, ''))), 'áéíóúü', 'aeiouu');
  v_ges boolean;
  v_res jsonb;
begin
  if not pos_puede('fabrica') then   -- SQL 256: la Fábrica busca en todos los locales y todos los días
    perform pos_permiso();
    perform pos_local_ok(p_local);
    perform pos_dias_ok(p_desde);
  end if;
  if length(v_q) < 2 then raise exception 'Escribí al menos 2 letras del código o del nombre.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  v_ges := pos_puede('gestion') or pos_puede('fabrica');   -- SQL 256
  with g as (
    select x.id, x.numero, x.referencia, x.fecha, x.estado, x.origen_local_id, x.destino_local_id, x.observaciones,
           i.codigo, coalesce(max(i.descripcion), max(a.nombre)) descripcion, sum(i.cantidad)::int mandaron, sum(i.contado)::int llegaron,
           bool_or(k.codigo is not null) recibido
      from pos_remitos x
      join pos_remito_items i on i.remito_id = x.id
      left join pos_remito_productos k on k.remito_id = x.id and k.codigo = i.codigo
      left join pos_articulos a on a.codigo = i.codigo
     where x.dia between p_desde and p_hasta
       and x.origen_local_id is distinct from x.destino_local_id
       and (p_local is null or x.destino_local_id = p_local or x.origen_local_id = p_local)
       and (position(v_q in lower(i.codigo)) = 1
            or not exists (select 1 from regexp_split_to_table(v_q, '\s+') w
                            where position(w in translate(lower(coalesce(i.descripcion, '') || ' ' || coalesce(a.nombre, '')), 'áéíóúü', 'aeiouu')) = 0))
     group by x.id, i.codigo
  )
  select jsonb_build_object(
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', z.id, 'numero', z.numero, 'referencia', z.referencia, 'fecha', z.fecha, 'estado', z.estado,
               'origen_local_id', z.origen_local_id, 'origen', coalesce(lo.nombre, 'Fábrica'),
               'destino_local_id', z.destino_local_id, 'destino', coalesce(ld.nombre, 'Fábrica'),
               'observaciones', z.observaciones, 'codigo', z.codigo, 'descripcion', z.descripcion, 'recibido', z.recibido,
               'mandaron', case when v_ges or z.recibido or z.estado = 'anulado' or z.destino_local_id is null
                                     or pos_local_mio(z.origen_local_id) then z.mandaron end,
               'llegaron', z.llegaron) order by z.fecha desc, z.codigo)
        from (select * from g order by fecha desc, codigo limit 1000) z
        left join orden_locales ld on ld.id = z.destino_local_id
        left join orden_locales lo on lo.id = z.origen_local_id), '[]'::jsonb),
    'mas', (select count(*) > 1000 from g))
    into v_res;
  return v_res;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remito_anular(p_id uuid, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r pos_remitos; m pos_stock_movs;
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  perform pg_advisory_xact_lock(hashtext('pos_remito:' || coalesce(p_id::text, '')));
  select * into r from pos_remitos where id = p_id for update;
  if not found then raise exception 'No existe ese remito.'; end if;
  if r.estado = 'anulado' then raise exception 'Ese remito ya está anulado.'; end if;
  /* SQL 190: en el local, sólo sus envíos y devoluciones, con el permiso, mientras nadie empezó a recibirlos. Lo demás, la oficina. */
  /* SQL 256: quien tiene la Fábrica anula los remitos que salen de la fábrica; lo demás, como antes. */
  if not pos_puede('gestion') and not (pos_puede('fabrica') and r.origen_local_id is null) then
    perform pos_permiso();   -- SQL 256: quien tiene sólo la Fábrica, nada más que lo de la fábrica
    /* SQL 222: rehacer un módulo del stock general en curso lo hace cualquiera del local. */
    if not (r.origen_local_id = r.destino_local_id and pos_stock_general_es_(r.origen_local_id, r.destino_deposito_id)) then perform pos_permiso('envios'); end if;
    if r.origen_local_id is null then raise exception 'Los remitos de la fábrica los anula la oficina.' using errcode = '42501'; end if;
    perform pos_local_ok(r.origen_local_id);
    if r.origen_local_id is distinct from r.destino_local_id   -- SQL 193
       and (r.estado <> 'pendiente' or exists (select 1 from pos_remito_productos k where k.remito_id = p_id)
            or exists (select 1 from pos_remito_conteos k where k.remito_id = p_id)) then
      raise exception 'Ya lo empezaron a recibir: ahora lo anula la oficina.' using errcode = '42501';
    end if;
  end if;
  for m in select * from pos_stock_movs where ref_id = p_id and tipo in ('remito', 'envio') order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, m.tipo || '_anulado', p_id, m.ref || ' (anulado)',
                            null, null, null, m.deposito_id);   -- SQL 193
  end loop;
  update pos_remitos set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  update pos_remito_diferencias
     set estado = 'pendiente', resolucion = null, nota = null, resuelta_en = null, resuelta_por = null, resuelta_nombre = null, remito_nuevo_id = null
   where remito_nuevo_id = p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remito_fabrica_recibir(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r pos_remitos;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 190: es de la oficina; SQL 256: y de la Fábrica
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_remito_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_origen   uuid := nullif(p->>'origen_local_id', '')::uuid;
  v_destino  uuid := nullif(p->>'destino_local_id', '')::uuid;
  v_fabrica  boolean := coalesce(p->>'a_fabrica', '') = 'true';
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_obs      text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_ref      text := nullif(trim(coalesce(p->>'referencia', '')), '');
  v_items    jsonb := coalesce(p->'items', '[]'::jsonb);
  v_dep_o    uuid := nullif(p->>'origen_deposito_id', '')::uuid;    -- SQL 193
  v_dep_d    uuid := nullif(p->>'destino_deposito_id', '')::uuid;
  v_modulo   text := nullif(upper(trim(coalesce(p->>'modulo', ''))), '');
  v_resp     text := nullif(trim(coalesce(p->>'responsable', '')), '');
  v_entre    boolean := nullif(p->>'destino_deposito_id', '') is not null;
  v_mod_id   uuid := nullif(p->>'modulo_id', '')::uuid;               -- SQL 222
  v_mod_nom  text;
  v_nom_o    text;
  v_nom_d    text;
  v_ya       pos_remitos;
  v_id       uuid;
  v_num      int;
  v_lista    int;
  x          jsonb;
  m          record;
begin
  /* SQL 256: lo que sale de la fábrica, y lo que arma Fábrica → Diferencias (pos_diferencia_resolver ya miró el permiso y
     lo marca en pos.dif_fabrica), lo hace quien tiene la Fábrica, aunque no use el POS. */
  if not (pos_puede('fabrica') and (v_origen is null or coalesce(current_setting('pos.dif_fabrica', true), '') = 'si')) then
    perform pos_permiso();
    /* SQL 190: lo que viene de la fábrica lo arma la oficina; los envíos y las devoluciones salen del local, con su permiso. */
    if v_origen is null then perform pos_permiso('gestion');
    else
      /* SQL 222: el pase de un módulo al stock general lo hace cualquiera del local (lo hacen ellos). */
      if not (v_entre and pos_stock_general_es_(v_origen, v_dep_d)) then perform pos_permiso('envios'); end if;
      perform pos_local_ok(v_origen);
    end if;
  end if;
  if v_clave is not null then
    select * into v_ya from pos_remitos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'ya', true); end if;
  end if;
  /* SQL 193: entre dos depósitos de la sucursal. */
  if v_entre then
    if v_origen is null then raise exception 'Elegí la sucursal.'; end if;
    v_destino := v_origen;
    v_fabrica := false;
    if v_dep_o is null then raise exception 'Elegí de qué depósito sale.'; end if;
    if v_dep_o = v_dep_d then raise exception 'Sale y llega al mismo depósito: elegí otro.'; end if;
    select nombre into v_nom_o from pos_depositos where id = v_dep_o and local_id = v_origen and activo;
    select nombre into v_nom_d from pos_depositos where id = v_dep_d and local_id = v_origen and activo;
    if v_nom_o is null or v_nom_d is null then raise exception 'Los dos depósitos tienen que ser de la sucursal y estar activos.'; end if;
    if length(v_modulo) > 20 then raise exception 'El módulo es demasiado largo (hasta 20 letras).'; end if;
    if length(v_resp) > 60 then raise exception 'El nombre del responsable es demasiado largo.'; end if;
    /* SQL 222: el módulo del croquis del local (el stock general): de ahí sale su nombre. */
    if v_mod_id is not null then
      select om.nombre into v_mod_nom from orden_modulos om join orden_sectores os on os.id = om.sector_id
       where om.id = v_mod_id and os.local_id = v_origen and om.activo and os.activo;
      if v_mod_nom is null then raise exception 'Ese módulo no es de la sucursal (o ya no está en el croquis).'; end if;
      v_modulo := coalesce(v_modulo, left(upper(v_mod_nom), 20));
    end if;
  elsif v_dep_o is not null and (v_origen is null or not exists (select 1 from pos_depositos where id = v_dep_o and local_id = v_origen and activo)) then
    raise exception 'Ese depósito no es de la sucursal de donde sale.';
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
  if v_origen = v_destino and not v_entre then raise exception 'Sale y llega al mismo local: elegí otro.'; end if;
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
    if length(trim(coalesce(x->>'razon', ''))) > 60 then   -- SQL 189
      raise exception 'La razón de % es demasiado larga (hasta 60 letras).', trim(x->>'codigo');
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
  /* SQL 222: un módulo del stock general se pasa una vez (para pasarlo de nuevo, primero se rehace). */
  if v_entre and v_mod_id is not null then
    select * into v_ya from pos_remitos where destino_deposito_id = v_dep_d and modulo_id = v_mod_id and estado <> 'anulado' order by numero desc limit 1;
    if found then raise exception '«%» ya se pasó (R-%): para pasarlo de nuevo, primero rehacelo.', v_mod_nom, v_ya.numero; end if;
  end if;
  select coalesce(max(numero), 0) + 1 into v_num from pos_remitos;
  /* SQL 193: si sale de un local, de qué depósito (sin elegirlo, del predeterminado). */
  if v_origen is not null and v_dep_o is null then v_dep_o := pos_deposito_de(v_origen); end if;

  insert into pos_remitos (numero, origen_local_id, destino_local_id, referencia, dia, creado_por, creado_nombre, observaciones, clave,
                           origen_deposito_id, destino_deposito_id, modulo, responsable, estado, recibido_en, modulo_id)
  values (v_num, v_origen, v_destino, v_ref, pos_hoy(), orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_obs, v_clave,
          v_dep_o, v_dep_d, case when v_entre then v_modulo end, case when v_entre then v_resp end,
          case when v_entre then 'recibido' else 'pendiente' end, case when v_entre then clock_timestamp() end,
          case when v_entre then v_mod_id end)   -- SQL 222
  returning id into v_id;

  /* SQL 189: si sale de un local, cada renglón con el precio de la lista de ese local (el de hoy) y su razón. */
  if v_origen is not null then
    select s.lista_id into v_lista from pos_sucursales s where s.local_id = v_origen;
  end if;
  insert into pos_remito_items (remito_id, codigo, talle, color, descripcion, cantidad, orden, precio, razon, contado)
  select v_id, z.c, z.t, z.co, max(z.d), sum(z.n), min(z.o), case when v_lista is not null then pos_precio_de(v_lista, z.c) end, max(z.r),
         case when v_entre then sum(z.n) end   -- SQL 193: el pase entre depósitos llega entero
    from (select upper(trim(e.v->>'codigo')) c, upper(trim(coalesce(e.v->>'talle', ''))) t, upper(trim(coalesce(e.v->>'color', ''))) co,
                 nullif(trim(coalesce(e.v->>'descripcion', '')), '') d, (e.v->>'cantidad')::int n, e.o::int o,
                 nullif(trim(coalesce(e.v->>'razon', '')), '') r
            from jsonb_array_elements(v_items) with ordinality e(v, o)) z
   group by z.c, z.t, z.co;

  /* Un envío entre locales (o una devolución a la fábrica): sale ahora del stock del que lo manda.
     SQL 193: entre depósitos, sale de uno y entra al otro. */
  if v_origen is not null then
    for m in select * from pos_remito_items where remito_id = v_id loop
      perform pos_stock_mover(v_origen, m.codigo, m.talle, m.color, -m.cantidad, 'envio', v_id,
                              case when v_destino is null then 'Devolución R-' else 'Envío R-' end || v_num, m.descripcion,
                              case when v_entre then 'Al depósito ' || v_nom_d end, null, v_dep_o);
      if v_entre then
        perform pos_stock_mover(v_origen, m.codigo, m.talle, m.color, m.cantidad, 'remito', v_id, 'Envío R-' || v_num, m.descripcion,
                                'Del depósito ' || v_nom_o, null, v_dep_d);
      end if;
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'ya', false, 'entre_depositos', v_entre,
                            'productos', (select count(distinct codigo) from pos_remito_items where remito_id = v_id),
                            'unidades', (select sum(cantidad) from pos_remito_items where remito_id = v_id),
                            'total', (select sum(cantidad * precio) from pos_remito_items where remito_id = v_id));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_diferencias(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_estado text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 190: es de la oficina; SQL 256: y de la Fábrica
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_diferencia_reabrir(p jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ids bigint[]; v_ref int; v_n int;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 190: es de la oficina; SQL 256: y de la Fábrica
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_diferencia_resolver(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 190: es de la oficina; SQL 256: y de la Fábrica
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
    /* SQL 256: «Que lo devuelvan» arma la devolución desde el local: con la Fábrica, sin pedir el POS (ver pos_remito_guardar). */
    perform set_config('pos.dif_fabrica', case when pos_puede('fabrica') then 'si' else '' end, true);
    v_rem := pos_remito_guardar(jsonb_build_object(
      'clave', v_clave,
      'origen_local_id', case when v_res = 'devolver' then v_loc end,
      'destino_local_id', case when v_res = 'mandar' then v_loc end,
      'a_fabrica', v_res = 'devolver',
      'referencia', left('Por ' || v_refs, 40),
      'observaciones', left((case when v_res = 'mandar' then 'Lo que faltó en ' else 'Lo que sobró en ' end) || v_refs || coalesce('. ' || v_nota, ''), 300),
      'items', v_items));
    perform set_config('pos.dif_fabrica', '', true);
  end if;

  update pos_remito_diferencias
     set estado = 'resuelta', resolucion = v_res, nota = v_nota, resuelta_en = clock_timestamp(), resuelta_por = orden_yo_id(),
         resuelta_nombre = (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()),
         remito_nuevo_id = nullif(v_rem->>'id', '')::uuid
   where id = any(v_ids);
  return jsonb_build_object('ya', false, 'resueltas', cardinality(v_ids), 'remito', v_rem);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_diferencias_aviso()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /* SQL 236: sólo a quien tiene la Gestión (el administrador, si tiene el POS). SQL 256: a quien tiene la Fábrica
     (el administrador con el POS, o quien tiene «Entra a Fábrica»). */
  if not pos_puede('fabrica') then return jsonb_build_object('pendientes', 0, 'ultimo', 0, 'productos', '[]'::jsonb); end if;
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
end $function$;


/* ═══════════════════════════════════════════════════════════════════════════
   ─── SQL 262 (7/11/2026) · PRODUCTOS Y LISTAS DE PRECIOS EN FÁBRICA · «RETIROS DE FONDOS» CON SU CASILLA ───
   Mauricio (7/11): Gestión sin lo repetido con el POS; Productos y Listas de precios pasan a Fábrica ("ellos se encargan de
   subir el precio, de cargar los precios y que lo reciban los locales"; los precios los cambia Lucas). Y los retiros de fondos
   aparte de la caja ("el fondo no es para cualquiera").
   1. Productos y Listas de precios (crear, cambiar, subir la lista, aumentar, deshacer, dar de baja): también quien tiene
      «Entra a Fábrica», aunque no use el POS. En la base, quien tenía la Gestión sigue pudiendo (las pantallas están
      ahora en Fábrica: necesita «Entra a Fábrica»). (15 funciones)
   2. Una casilla nueva por persona, «Retiros de fondos» (clave 'retiros'), aparte de «Caja». Arranca como la caja de cada
      uno: por rol, la misma regla; a quien ya le cambiaron la caja (Lautaro, Nano y Seba), se le copia. Nadie pierde nada.
      El retiro (guardarlo, anularlo, su lista, quién retira) pide esa casilla; sin ella, la lista de todos los movimientos
      no trae los retiros. Lo que hay en la caja y el cierre siguen pidiendo la caja. (8 funciones)
   Sin tablas nuevas. Se puede correr dos veces. Se deshace con deshacer-262.sql. ═══════════════════════════════════════════════════════════════════════════ */

CREATE OR REPLACE FUNCTION public.pos_lista_aumentar(p_lista integer, p_porcentaje numeric, p_rubro text, p_familia text, p_redondeo integer, p_aplicar boolean, p_clave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rubro  text := nullif(btrim(coalesce(p_rubro, '')), '');
  v_fam    text := nullif(btrim(coalesce(p_familia, '')), '');
  v_clave  text := nullif(btrim(coalesce(p_clave, '')), '');
  v_cuantos int;
  v_camb   jsonb;
  v_n      int;
  v_pct    text;
  v_id     int;
  c        pos_precios_cambios;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  perform pos_lista_propia(p_lista);
  if p_porcentaje is null or p_porcentaje = 0 or p_porcentaje <= -90 or p_porcentaje > 200 then
    raise exception 'El porcentaje va de −89 a 200, sin el 0 (para bajar, con el signo menos: −10).';
  end if;
  if p_redondeo is null or p_redondeo not in (1, 10, 50, 100, 500, 1000) then raise exception 'El redondeo no es válido.'; end if;
  if v_fam is not null and v_rubro is null then raise exception 'Para elegir una familia, elegí primero el rubro.'; end if;
  if coalesce(p_aplicar, false) then
    if v_clave is null then raise exception 'Falta la clave del cambio.'; end if;
    select * into c from pos_precios_cambios where clave = v_clave;
    if found then return jsonb_build_object('ya', true, 'id', c.id, 'cambiaron', c.cambiaron); end if;
  end if;

  /* [código, precio de antes, precio nuevo, cuándo se había cambiado] de los que cambian. Si con el redondeo
     quedara en $0, queda como está. */
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_array(z.codigo, z.antes, z.despues, z.cuando) order by z.codigo)
                    filter (where z.despues <> z.antes), '[]'::jsonb)
    into v_cuantos, v_camb
    from (select p.codigo, p.precio antes, p.actualizado_en cuando,
                 case when y.r > 0 then least(y.r, 99999999) else p.precio end despues
            from pos_precios p
            left join pos_articulos a on a.codigo = p.codigo
            cross join lateral (select round(p.precio * (1 + p_porcentaje / 100) / p_redondeo) * p_redondeo r) y
           where p.lista_id = p_lista
             and (v_rubro is null or a.rubro = v_rubro)
             and (v_fam is null or a.familia = v_fam)) z;
  v_n := jsonb_array_length(v_camb);

  if not coalesce(p_aplicar, false) then
    return jsonb_build_object(
      'cuantos', v_cuantos,
      'cambian', v_n,
      'suma_antes', (select coalesce(sum((e->>1)::numeric), 0) from jsonb_array_elements(v_camb) e),
      'suma_despues', (select coalesce(sum((e->>2)::numeric), 0) from jsonb_array_elements(v_camb) e),
      'filas', coalesce((
        select jsonb_agg(jsonb_build_array(q.e->>0, a.nombre, (q.e->>1)::numeric, (q.e->>2)::numeric) order by q.i)
          from (select e, i from jsonb_array_elements(v_camb) with ordinality x(e, i) order by i limit 300) q
          left join pos_articulos a on a.codigo = q.e->>0), '[]'::jsonb));
  end if;

  if v_n = 0 then raise exception 'Con ese porcentaje y ese redondeo no cambia ningún precio.'; end if;
  v_pct := abs(p_porcentaje)::text;
  if position('.' in v_pct) > 0 then v_pct := rtrim(rtrim(v_pct, '0'), '.'); end if;
  insert into pos_precios_cambios (lista_id, tipo, detalle, cambiaron, antes, clave, creado_por, creado_nombre)
  values (p_lista, 'aumentar',
          case when p_porcentaje > 0 then 'Aumento del ' else 'Baja del ' end || replace(v_pct, '.', ',') || ' %' ||
            case when v_rubro is null then ' · toda la lista' else ' · ' || v_rubro || coalesce(' · ' || v_fam, '') end ||
            case p_redondeo when 1 then ' · sin redondear' when 1000 then ' · redondeo $1.000' else ' · redondeo $' || p_redondeo end,
          v_n,
          (select jsonb_agg(jsonb_build_array(e->0, e->1, e->3)) from jsonb_array_elements(v_camb) e),
          v_clave, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
  returning id into v_id;
  update pos_precios p set precio = (e->>2)::numeric, actualizado_en = now(), actualizado_por = orden_yo_id()
    from jsonb_array_elements(v_camb) e
   where p.lista_id = p_lista and p.codigo = e->>0;
  return jsonb_build_object('id', v_id, 'cambiaron', v_n);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_baja(p_lista integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l pos_listas; v text; k int;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  select * into l from pos_listas where id = p_lista and activo for update;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  select string_agg(o.nombre, ', ' order by o.nombre) into v
    from pos_sucursales s join orden_locales o on o.id = s.local_id
   where s.lista_id = p_lista;
  if v is not null then raise exception 'La usan: %. Primero pasá esas sucursales a otra lista (en Sucursales).', v; end if;
  select string_agg('«' || nombre || '»', ' y ' order by id), count(*) into v, k from pos_listas where base_id = p_lista and activo;
  if k > 0 then
    raise exception '% se calcula% de esta: primero da% de baja.', v, case when k > 1 then 'n' else '' end,
      case when k > 1 then 'las' else 'la' end;
  end if;
  if not exists (select 1 from pos_listas where activo and id <> p_lista) then raise exception 'Tiene que quedar al menos una lista.'; end if;
  update pos_listas set activo = false where id = p_lista;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_cambios(p_lista integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.creado_en, 'tipo', c.tipo, 'detalle', c.detalle,
                                        'cambiaron', c.cambiaron, 'persona', c.creado_nombre, 'deshecho', c.deshecho_en,
                                        'deshizo', c.deshecho_nombre, 'volvieron', c.volvieron,
                                        'se_deshace', c.deshecho_en is null and not exists (
                                          select 1 from pos_precios_cambios x where x.lista_id = c.lista_id and x.id > c.id and x.deshecho_en is null))
                     order by c.id desc)
      from (select * from pos_precios_cambios where lista_id = p_lista order by id desc limit 15) c), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_crear(p_nombre text, p_tipo text, p_de integer, p_ajuste numeric, p_redondeo integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text; d pos_listas; v_id int; v_n int := 0;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  n := pos_lista_nombre_(p_nombre, null);
  if p_tipo is null or p_tipo not in ('calculada', 'copia', 'vacia') then raise exception 'Elegí de dónde salen los precios.'; end if;
  if p_tipo <> 'vacia' then
    select * into d from pos_listas where id = p_de and activo;
    if not found then raise exception 'Elegí de qué lista salen los precios.'; end if;
  end if;
  if p_tipo = 'calculada' then
    if d.base_id is not null then raise exception '«%» ya se calcula de otra: elegí una lista con precios propios.', d.nombre; end if;
    if p_ajuste is null or p_ajuste <= -100 or p_ajuste > 300 then raise exception 'El porcentaje no es válido.'; end if;
    if p_redondeo is null or p_redondeo < 1 or p_redondeo > 10000 then raise exception 'El redondeo no es válido.'; end if;
  end if;
  insert into pos_listas (nombre, base_id, ajuste, redondeo)
  values (n, case when p_tipo = 'calculada' then d.id end,
          case when p_tipo = 'calculada' then round(p_ajuste, 2) else 0 end,
          case when p_tipo = 'calculada' then p_redondeo else 1 end)
  returning id into v_id;
  if p_tipo = 'copia' then
    /* Los mismos precios que ve la venta en p_de (la cuenta de pos_precios). */
    insert into pos_precios (lista_id, codigo, precio, actualizado_por)
    select v_id, x.codigo, x.precio, orden_yo_id()
      from (select coalesce(p.codigo, b.codigo) codigo,
                   coalesce(p.precio, round(b.precio * (1 + d.ajuste / 100) / d.redondeo) * d.redondeo) precio
              from (select codigo, precio from pos_precios where lista_id = d.id) p
              full join (select codigo, precio from pos_precios where lista_id = d.base_id) b on b.codigo = p.codigo) x
     where x.precio is not null;
    get diagnostics v_n = row_count;
  end if;
  return jsonb_build_object('id', v_id, 'nombre', n, 'copiados', v_n);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_deshacer(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c    pos_precios_cambios;
  v_n  int := 0;
  v_b  int;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  select * into c from pos_precios_cambios where id = p_id for update;
  if not found then raise exception 'Ese cambio no existe.'; end if;
  if c.deshecho_en is not null then raise exception 'Ese cambio ya se deshizo.'; end if;
  if exists (select 1 from pos_precios_cambios x where x.lista_id = c.lista_id and x.id > c.id and x.deshecho_en is null) then
    raise exception 'Primero hay que deshacer los cambios que se hicieron después.';
  end if;
  /* Sólo los que siguen como los dejó el cambio (actualizado_en es el del cambio). */
  delete from pos_precios p
   using jsonb_array_elements(c.antes) e
   where p.lista_id = c.lista_id and p.codigo = e->>0 and e->1 = 'null'::jsonb and p.actualizado_en <= c.creado_en;
  get diagnostics v_b = row_count;
  update pos_precios p set precio = (e->>1)::numeric, actualizado_en = coalesce((e->>2)::timestamptz, p.actualizado_en),
                           actualizado_por = orden_yo_id()
    from jsonb_array_elements(c.antes) e
   where p.lista_id = c.lista_id and p.codigo = e->>0 and e->1 <> 'null'::jsonb and p.actualizado_en <= c.creado_en;
  get diagnostics v_n = row_count;
  update pos_precios_cambios set deshecho_en = now(), deshecho_por = orden_yo_id(), volvieron = v_n + v_b,
         deshecho_nombre = (select pe.nombre from orden_personas pe where pe.id = orden_yo_id())
   where id = c.id;
  return jsonb_build_object('volvieron', v_n + v_b, 'quedaron', c.cambiaron - v_n - v_b);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_reactivar(p_lista integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l pos_listas; b pos_listas;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  select * into l from pos_listas where id = p_lista and not activo for update;
  if not found then raise exception 'Esa lista no está dada de baja.'; end if;
  if l.base_id is not null then
    select * into b from pos_listas where id = l.base_id;
    if not b.activo then
      raise exception '«%» se calcula de «%», que está dada de baja: primero volvé a usar esa.', l.nombre, b.nombre;
    end if;
  end if;
  update pos_listas set activo = true where id = p_lista;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_renombrar(p_lista integer, p_nombre text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  if not exists (select 1 from pos_listas where id = p_lista and activo) then raise exception 'No existe esa lista de precios.'; end if;
  n := pos_lista_nombre_(p_nombre, p_lista);
  update pos_listas set nombre = n where id = p_lista;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_rubros(p_lista integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  perform pos_lista_propia(p_lista);
  return jsonb_build_object(
    'rubros', coalesce((
      select jsonb_agg(jsonb_build_array(z.rubro, z.familia, z.n) order by z.rubro, z.familia nulls last)
        from (select a.rubro, a.familia, count(*)::int n
                from pos_precios p join pos_articulos a on a.codigo = p.codigo
               where p.lista_id = p_lista and a.rubro is not null
               group by 1, 2) z), '[]'::jsonb),
    'total', (select count(*)::int from pos_precios where lista_id = p_lista),
    'sin_rubro', (select count(*)::int from pos_precios p left join pos_articulos a on a.codigo = p.codigo
                   where p.lista_id = p_lista and a.rubro is null));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_subir(p_lista integer, p_filas jsonb, p_origen text, p_clave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clave  text := nullif(btrim(coalesce(p_clave, '')), '');
  v_origen text := left(nullif(btrim(coalesce(p_origen, '')), ''), 120);
  v_f      jsonb;
  v_camb   jsonb;
  v_mal    text;
  v_n      int;
  v_art    int;
  v_id     int;
  c        pos_precios_cambios;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  perform pos_lista_propia(p_lista);
  if v_clave is null then raise exception 'Falta la clave del cambio.'; end if;
  select * into c from pos_precios_cambios where clave = v_clave;
  if found then return jsonb_build_object('ya', true, 'id', c.id, 'cambiaron', c.cambiaron); end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then raise exception 'La lista está vacía.'; end if;
  if jsonb_array_length(p_filas) > 30000 then raise exception 'La lista tiene demasiados renglones (hasta 30.000).'; end if;

  begin
    select jsonb_agg(jsonb_build_array(z.c, z.p, z.n, z.r, z.f, z.t) order by z.c) into v_f
      from (select upper(btrim(coalesce(e->>0, ''))) c, round((e->>1)::numeric, 2) p,
                   /* Los espacios de más, juntados en uno (como los guarda el SQL 202). */
                   left(nullif(btrim(regexp_replace(coalesce(e->>2, ''), '\s+', ' ', 'g')), ''), 120) n, left(nullif(btrim(regexp_replace(coalesce(e->>3, ''), '\s+', ' ', 'g')), ''), 60) r,
                   left(nullif(btrim(regexp_replace(coalesce(e->>4, ''), '\s+', ' ', 'g')), ''), 60) f, left(nullif(btrim(regexp_replace(coalesce(e->>5, ''), '\s+', ' ', 'g')), ''), 60) t
              from jsonb_array_elements(p_filas) e) z;
  exception when others then raise exception 'Hay un precio que no es un número.';
  end;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e where length(e->>0) not between 1 and 30 limit 1;
  if found then raise exception 'Hay un código vacío o demasiado largo: «%».', left(v_mal, 40); end if;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e where (e->>1) is null or (e->>1)::numeric <= 0 or (e->>1)::numeric >= 100000000 limit 1;
  if found then raise exception 'El precio de % no es válido.', v_mal; end if;
  select e->>0 into v_mal from jsonb_array_elements(v_f) e group by e->>0 having count(*) > 1 limit 1;
  if found then raise exception 'El código % está dos veces.', v_mal; end if;

  /* Los productos: sólo el nombre, el rubro, la familia y la temporada que trae el Excel (los talles, los
     colores y si está activo son de Gestión → Productos, SQL 202). Los nuevos entran si traen el nombre. */
  update pos_articulos a
     set nombre = coalesce(z.n, a.nombre), rubro = coalesce(z.r, a.rubro), familia = coalesce(z.f, a.familia),
         temporada = coalesce(z.t, a.temporada), actualizado_en = now()
    from (select e->>0 c, e->>2 n, e->>3 r, e->>4 f, e->>5 t from jsonb_array_elements(v_f) e) z
   where a.codigo = z.c
     and (a.nombre, a.rubro, a.familia, a.temporada) is distinct from
         (coalesce(z.n, a.nombre), coalesce(z.r, a.rubro), coalesce(z.f, a.familia), coalesce(z.t, a.temporada));
  get diagnostics v_art = row_count;
  insert into pos_articulos (codigo, nombre, rubro, familia, temporada)
  select e->>0, e->>2, e->>3, e->>4, e->>5 from jsonb_array_elements(v_f) e
   where e->>2 is not null and not exists (select 1 from pos_articulos a where a.codigo = e->>0);
  get diagnostics v_n = row_count;
  v_art := v_art + v_n;

  /* [código, precio de antes (null si es nuevo), precio nuevo, cuándo se había cambiado] de los que cambian. */
  select coalesce(jsonb_agg(jsonb_build_array(e->>0, p.precio, (e->>1)::numeric, p.actualizado_en) order by e->>0), '[]'::jsonb)
    into v_camb
    from jsonb_array_elements(v_f) e
    left join pos_precios p on p.lista_id = p_lista and p.codigo = e->>0
   where p.precio is distinct from (e->>1)::numeric;
  v_n := jsonb_array_length(v_camb);
  if v_n > 0 then
    insert into pos_precios_cambios (lista_id, tipo, detalle, cambiaron, antes, clave, creado_por, creado_nombre)
    values (p_lista, 'subir', 'Lista subida' || coalesce(' · ' || v_origen, ''), v_n,
            (select jsonb_agg(jsonb_build_array(e->0, e->1, e->3)) from jsonb_array_elements(v_camb) e),
            v_clave, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
    returning id into v_id;
    insert into pos_precios (lista_id, codigo, precio, actualizado_por)
    select p_lista, e->>0, (e->>2)::numeric, orden_yo_id() from jsonb_array_elements(v_camb) e
    on conflict (lista_id, codigo) do update set precio = excluded.precio, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
  end if;
  return jsonb_build_object('id', v_id, 'cambiaron', v_n,
                            'nuevos', (select count(*)::int from jsonb_array_elements(v_camb) e where e->1 = 'null'::jsonb),
                            'iguales', jsonb_array_length(v_f) - v_n, 'articulos', v_art);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_listas_bajas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'base_id', x.base_id,
                                        'propios', (select count(*) from pos_precios p where p.lista_id = x.id)) order by x.nombre)
      from pos_listas x where not x.activo), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_articulo_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nuevo   boolean := coalesce((p->>'nuevo')::boolean, false);
  v_cod     text := btrim(coalesce(p->>'codigo', ''));
  v_nom     text := nullif(regexp_replace(btrim(coalesce(p->>'nombre', '')), '\s+', ' ', 'g'), '');
  v_rubro   text := nullif(regexp_replace(btrim(coalesce(p->>'rubro', '')), '\s+', ' ', 'g'), '');
  v_familia text := nullif(regexp_replace(btrim(coalesce(p->>'familia', '')), '\s+', ' ', 'g'), '');
  v_temp    text := nullif(regexp_replace(btrim(coalesce(p->>'temporada', '')), '\s+', ' ', 'g'), '');
  v_marca   text := nullif(regexp_replace(btrim(coalesce(p->>'marca', '')), '\s+', ' ', 'g'), '');
  v_activo  boolean := coalesce((p->>'activo')::boolean, true);
  v_talles  text;
  v_colores text;
  r         pos_articulos;
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  v_cod := upper(v_cod);
  if v_cod = '' or length(v_cod) > 30 or v_cod !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' then
    raise exception 'El código va con letras y números, sin espacios (hasta 30).';
  end if;
  if v_nom is null or length(v_nom) > 120 then raise exception 'Falta el nombre del producto (hasta 120 letras).'; end if;
  if length(coalesce(v_rubro, '')) > 60 or length(coalesce(v_familia, '')) > 60 or length(coalesce(v_temp, '')) > 60 or length(coalesce(v_marca, '')) > 60 then
    raise exception 'El rubro, la familia, la temporada y la marca van con hasta 60 letras.';
  end if;

  /* Los talles: "s, M ,m,L" → "S,M,L" (en mayúsculas, sin repetidos, en el orden en que los escribieron). */
  select string_agg(t, ',' order by o) into v_talles
    from (select upper(btrim(x)) t, min(n) o
            from unnest(string_to_array(coalesce(p->>'talles', ''), ',')) with ordinality u(x, n)
           where btrim(x) <> '' group by upper(btrim(x))) z;
  if exists (select 1 from unnest(string_to_array(coalesce(v_talles, ''), ',')) t where length(t) > 10) then
    raise exception 'Cada talle va con hasta 10 letras.';
  end if;

  /* Los colores: [{cod: "ne", nom: "negro"}] → "NE:NEGRO" (el primero de cada código). */
  if jsonb_typeof(coalesce(p->'colores', '[]'::jsonb)) <> 'array' then raise exception 'Los colores no se entienden.'; end if;
  select string_agg(c || ':' || coalesce(nullif(n, ''), c), '|' order by o) into v_colores
    from (select distinct on (c) c, n, o
            from (select upper(btrim(coalesce(e->>'cod', ''))) c, upper(regexp_replace(btrim(coalesce(e->>'nom', '')), '\s+', ' ', 'g')) n, o
                    from jsonb_array_elements(coalesce(p->'colores', '[]'::jsonb)) with ordinality a(e, o)) y
           where c <> '' order by c, o) z;
  if exists (select 1 from unnest(string_to_array(coalesce(v_colores, ''), '|')) x
              where split_part(x, ':', 1) !~ '^[A-Z0-9]{1,6}$' or length(substr(x, length(split_part(x, ':', 1)) + 2)) > 40
                 or substr(x, length(split_part(x, ':', 1)) + 2) ~ '[:|]') then
    raise exception 'Cada color va con un código de hasta 6 letras o números y un nombre de hasta 40.';
  end if;

  if v_nuevo then
    if exists (select 1 from pos_articulos where codigo = v_cod) then
      raise exception 'Ya hay un producto con el código %.', v_cod;
    end if;
    insert into pos_articulos (codigo, nombre, rubro, familia, temporada, marca, talles, colores, activo, actualizado_en, actualizado_por)
    values (v_cod, v_nom, v_rubro, v_familia, v_temp, v_marca, v_talles, v_colores, v_activo, now(), orden_yo_id())
    returning * into r;
  else
    update pos_articulos
       set nombre = v_nom, rubro = v_rubro, familia = v_familia, temporada = v_temp, marca = v_marca,
           talles = v_talles, colores = v_colores, activo = v_activo, actualizado_en = now(), actualizado_por = orden_yo_id()
     where codigo = v_cod
    returning * into r;
    if not found then raise exception 'No existe el producto %.', v_cod; end if;
  end if;
  return pos_art_fila(r);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_lista_guardar(p_lista integer, p_ajuste numeric, p_redondeo integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
  if p_ajuste is null or p_ajuste <= -100 or p_ajuste > 300 then raise exception 'El porcentaje no es válido.'; end if;
  if p_redondeo is null or p_redondeo < 1 or p_redondeo > 10000 then raise exception 'El redondeo no es válido.'; end if;
  update pos_listas set ajuste = p_ajuste, redondeo = p_redondeo where id = p_lista and base_id is not null;
  if not found then raise exception 'Esa lista no se calcula de otra.'; end if;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_precio_guardar(p_lista integer, p_codigo text, p_precio numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text := upper(trim(coalesce(p_codigo, '')));
begin
  if not pos_puede('fabrica') then perform pos_permiso('gestion'); end if;   -- SQL 262: también la Fábrica (Productos y Listas de precios)
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_precios(p_lista integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l pos_listas;
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 262: también quien tiene sólo la Fábrica (Listas de precios)
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_precios_version(p_lista integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l pos_listas;
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 262: también quien tiene sólo la Fábrica (Listas de precios)
  select * into l from pos_listas where id = p_lista;
  if not found then raise exception 'No existe esa lista de precios.'; end if;
  return concat_ws('|', l.ajuste, l.redondeo, l.base_id,
           (select count(*) || '/' || coalesce(sum(precio), 0) || '/' || coalesce(max(actualizado_en)::text, '')
              from pos_precios where lista_id in (l.id, l.base_id)));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_mis_permisos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('usa', pos_puede('usa'), 'anular', pos_puede('anular'), 'envios', pos_puede('envios'),
           'caja', pos_puede('caja'), 'retiros', pos_puede('retiros'), 'dias', pos_puede('dias'), 'locales', pos_puede('locales'), 'precios', pos_puede('precios'),
           'gestion', pos_puede('gestion'),
           'fabrica', pos_puede('fabrica'),   -- SQL 256
           'mios', coalesce((select jsonb_agg(l.id) from orden_locales l where l.activo and pos_local_mio(l.id)), '[]'::jsonb))
$function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_lista()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'retiros', 'dias', 'locales', 'precios', 'gestion', 'fabrica'];   -- SQL 256: «Entra a Fábrica»; SQL 262: «Retiros de fondos»
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'admin_elige', true,
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then coalesce((x.cambios ->> 'usa')::boolean, false)
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_guardar(p_persona uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'retiros', 'dias', 'locales', 'precios', 'gestion', 'fabrica'];   -- SQL 256: «Entra a Fábrica»; SQL 262: «Retiros de fondos»
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  /* SQL 236: al administrador, sólo «Usa el POS» (con eso tiene todo, también la Gestión). El suyo no se lo saca él. */
  if q.rol = 'admin' then
    if jsonb_typeof(p->'usa') is distinct from 'boolean' then raise exception 'Falta si usa el POS.'; end if;
    if q.id = orden_yo_id() and not (p->>'usa')::boolean then
      raise exception 'Tu POS no te lo podés sacar vos: te lo saca otro administrador.';
    end if;
    p := jsonb_build_object('usa', p->'usa');
  end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_permiso(p_que text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso();
  if not pos_puede(p_que) then
    raise exception '%', case p_que
      when 'gestion' then 'Esto es de la oficina: lo hace Administración.'
      when 'anular'  then 'No tenés permiso para anular ventas ni cambios. Lo da la oficina en Config → Usuarios.'
      when 'envios'  then 'No tenés permiso para los envíos internos ni las devoluciones a fábrica. Lo da la oficina en Config → Usuarios.'
      when 'caja'    then 'No tenés permiso para la caja (gastos, movimientos de salida y cierre). Lo da la oficina en Config → Usuarios.'
      when 'retiros' then 'No tenés permiso para los retiros de fondos. Lo da la oficina en Config → Usuarios.'   -- SQL 262
      when 'dias'    then 'Sólo podés ver lo de hoy. Para otros días, el permiso lo da la oficina en Config → Usuarios.'
      when 'locales' then 'Sólo podés usar el POS de tu local. Para otros, el permiso lo da la oficina en Config → Usuarios.'
      else 'No tenés permiso para esto en el POS.' end using errcode = '42501';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_mov_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_tipo    text := coalesce(p->>'tipo', '');
  v_rubro   text := nullif(trim(coalesce(p->>'rubro', '')), '');
  v_desc    text := nullif(trim(coalesce(p->>'descripcion', '')), '');
  v_monto   numeric := round(nullif(p->>'monto', '')::numeric, 2);
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_caja    text := nullif(trim(coalesce(p->>'caja', '')), '');     -- SQL 191
  v_retira  text := nullif(trim(coalesce(p->>'retira', '')), '');   -- SQL 191
  v_id      uuid;
  v_num     int;
  v_ya      pos_caja_movimientos;
begin
  perform pos_permiso(case when v_tipo = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190; SQL 262: el retiro, con su casilla
  perform pos_local_ok(v_local);
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then
    raise exception 'El movimiento tiene que ser un gasto, otra salida, otro ingreso, un pase a la caja fuerte o un retiro de fondos.';
  end if;
  /* SQL 191: el retiro dice de qué caja sale la plata y quién se la lleva. */
  if v_tipo = 'retiro' then
    if v_caja is null or v_caja not in ('chica', 'fuerte') then raise exception 'Elegí de qué caja sale la plata.'; end if;
    if v_retira is null then raise exception 'Elegí quién retira la plata.'; end if;
    if length(v_retira) > 80 then raise exception 'El nombre de quien retira es demasiado largo.'; end if;
  end if;
  if v_tipo = 'gasto' and v_rubro is null then raise exception 'Elegí el tipo de gasto.'; end if;
  if v_tipo in ('salida', 'ingreso') and v_desc is null then raise exception 'Escribí de qué es.'; end if;
  if length(v_rubro) > 60 or length(v_desc) > 200 then raise exception 'El texto es demasiado largo.'; end if;
  if v_monto is null or v_monto <= 0 or v_monto >= 100000000 then raise exception 'Escribí el monto.'; end if;
  /* SQL 179: un número por vez en cada local: si dos guardan al mismo tiempo, el segundo espera (como los cambios). */
  perform pg_advisory_xact_lock(hashtext('pos_gasto:' || v_local::text || ':' || v_prueba::text));
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  select coalesce(max(m.numero), 0) + 1 into v_num from pos_caja_movimientos m
   where m.local_id = v_local and m.prueba = v_prueba   -- SQL 180: dos talonarios; SQL 191: tres
     and (case m.tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end) = (case v_tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end);
  insert into pos_caja_movimientos (local_id, prueba, dia, tipo, rubro, descripcion, monto, persona, persona_nombre, clave, numero, caja, retira)
  values (v_local, v_prueba, orden_dia_caja(v_local), v_tipo, case when v_tipo = 'gasto' then v_rubro end, v_desc, v_monto,
          orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_clave, v_num,
          case when v_tipo = 'retiro' then v_caja end, case when v_tipo = 'retiro' then v_retira end)   -- SQL 191
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v_prueba, 'ya', false);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_mov_anular(p_id uuid, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m pos_caja_movimientos;
begin
  /* SQL 262: el retiro de fondos se anula con su casilla; lo demás, con la de la caja. */
  perform pos_permiso(case when (select x.tipo from pos_caja_movimientos x where x.id = p_id) = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se anula.'; end if;
  select * into m from pos_caja_movimientos where id = p_id for update;
  if not found then raise exception 'No existe ese movimiento.'; end if;
  perform pos_local_ok(m.local_id);
  if m.estado = 'anulado' then raise exception 'Ese movimiento ya está anulado.'; end if;
  if m.controlado_en is not null then   -- SQL 191
    raise exception 'Ese movimiento ya lo controló la oficina: para anularlo, primero hay que sacarle el tilde de «Controlado».';
  end if;
  if m.cierre_id is not null then
    raise exception 'Ese movimiento ya entró en el cierre %: para cambiarlo, hay que anular el cierre.',
      (select case when c.prueba then 'P-' else 'Nº ' end || c.numero from pos_cierres c where c.id = m.cierre_id);
  end if;
  update pos_caja_movimientos set estado = 'anulado', anulado_en = now(), anulado_por = orden_yo_id(), anulado_motivo = trim(p_motivo)
   where id = p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_movimientos(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_tipo text DEFAULT NULL::text, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_retiros boolean;   -- SQL 262
begin
  perform pos_permiso(case when p_tipo = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190; SQL 262: la lista de los retiros, con su casilla
  v_retiros := pos_puede('retiros');   -- SQL 262: sin la casilla, «Todos» no trae los retiros
  perform pos_local_ok(p_local);
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_tipo is not null and p_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then raise exception 'Ese tipo de movimiento no existe.'; end if;
  return (
    with t as (
      select m.id, 'mov'::text as origen, m.fecha, m.local_id, m.tipo, m.rubro, m.descripcion, m.monto, m.persona_nombre as persona,
             m.estado = 'ok' as vale, m.estado, m.cierre_id, m.anulado_motivo, m.numero,   -- SQL 179: el número del gasto
             m.caja, m.retira, m.controlado_en, m.controlado_por   -- SQL 191
        from pos_caja_movimientos m
       where m.dia between p_desde and p_hasta and m.prueba = coalesce(p_prueba, false) and (p_local is null or m.local_id = p_local)
      union all
      select c.id, 'cierre', c.fecha, c.local_id, 'caja_fuerte', null, null, c.retiro, c.responsable_nombre,
             c.estado = 'cerrada', case when c.estado = 'cerrada' then 'ok' else 'anulado' end, c.id, c.anulado_motivo, null::int,
             null::text, null::text, null::timestamptz, null::uuid
        from pos_cierres c
       where c.retiro > 0 and c.dia between p_desde and p_hasta and c.prueba = coalesce(p_prueba, false)
         and (p_local is null or c.local_id = p_local)
    ), f as (
      select * from t where (p_tipo is null or t.tipo = p_tipo) and (t.tipo <> 'retiro' or v_retiros)   -- SQL 262
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'origen', z.origen, 'fecha', z.fecha, 'local', l.nombre, 'local_id', z.local_id, 'tipo', z.tipo,
                 'rubro', z.rubro, 'descripcion', z.descripcion, 'monto', z.monto, 'persona', z.persona, 'estado', z.estado,
                 'motivo', z.anulado_motivo, 'numero', z.numero,
                 'caja', z.caja, 'retira', z.retira, 'controlado', z.controlado_en is not null, 'controlado_en', z.controlado_en,   -- SQL 191
                 'controlado_por', (select pe.nombre from orden_personas pe where pe.id = z.controlado_por),
                 'cierre', (select jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'estado', c.estado)
                              from pos_cierres c where c.id = z.cierre_id)) order by z.fecha desc)
          from (select * from f order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'gasto',       coalesce(sum(monto) filter (where vale and tipo = 'gasto'), 0),
                    'salida',      coalesce(sum(monto) filter (where vale and tipo = 'salida'), 0),
                    'ingreso',     coalesce(sum(monto) filter (where vale and tipo = 'ingreso'), 0),
                    'caja_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'caja_fuerte'), 0),
                    'retiro',      coalesce(sum(monto) filter (where vale and tipo = 'retiro'), 0),   -- SQL 191
                    'controlado',  coalesce(sum(monto) filter (where vale and controlado_en is not null), 0),
                    'cantidad',    count(*) filter (where vale)) from f),
      'mas', (select count(*) > 500 from f)
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_retiran()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso('retiros');   -- SQL 262
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial)) order by p.nombre, p.inicial)
                     from orden_personas p where p.rol = 'admin' and p.activo and p.aprobado), '[]'::jsonb);
end $function$;

/* La casilla nueva arranca como la caja de cada uno: a quien le cambiaron la caja, se le copia. */
update pos_permisos set cambios = cambios || jsonb_build_object('retiros', cambios -> 'caja')
 where cambios ? 'caja' and not cambios ? 'retiros';

/* ═══════════════════════════════════════════════════════════════════════════
   ─── SQL 264 (7/11/2026) · LA GIFT CARD COMPLETA EN EL POS (RIVADAVIA) ───
   Mauricio (7/11): "si vendemos una gift card, lo hacemos desde el POS, y para cobrar también… por ahora sólo para
   Rivadavia"; "cargarla como un producto dentro del stock".
   1. La Gift Card es un artículo («GIFTCARD», talle UNI, color NE) y las 20 de Rivadavia (las impresas para Mar del
      Plata, Nº 131 a 150) entran a su stock. Al venderla sale una del depósito donde están; anular la venta la devuelve.
   2. Al venderla se elige cuándo vence: a los 30 (como antes), 60 o 90 días, o al año (como en Gift Cards).
   3. La gift card que se vende no cuenta en Ventas por vendedor ni en Ventas por productos: cuenta lo que se compra con
      ella, el día que la usan. Tickets y el cierre de caja no cambian (la plata de la tarjeta sí entra en la caja).
   4. Nuevas: pos_giftcards (la lista de Ventas → Gift cards) y pos_giftcard_extender (extenderla, con el permiso de anular).
   Cambian pos_venta_guardar, pos_vp_renglones, pos_ventas_vendedor y pos_giftcard. Sin tablas nuevas.
   No se puede correr dos veces (frena). Se deshace con deshacer-264.sql mientras no se haya vendido una gift card con el 264.
   */

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
  /* SQL 215: el interés de las cuotas (lo calcula la pantalla) y la excepción sin interés. */
  v_interes numeric := round(coalesce(nullif(p->>'interes', '')::numeric, 0), 2);
  v_intnota text := nullif(trim(coalesce(p->>'interes_nota', '')), '');
  v_sinint  boolean := coalesce(nullif(p->>'sin_interes', '')::boolean, false);
  v_dep     uuid;             -- SQL 252: el depósito del que sale lo vendido (sin elegir: el predeterminado)
  /* SQL 264: la gift card con su vencimiento (30, 60, 90 días o un año) y como artículo del stock. */
  v_dias    int;
  v_dep_gc  uuid;             -- el depósito donde están las tarjetas (el que más tiene); si no hay, el de la venta
  v_gc_col  text;
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

  /* SQL 171: el socio del Club (el número de su tarjeta), si lo eligieron. */
  if v_socio is not null then
    select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
    if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  /* SQL 252: el depósito que eligieron en la venta, de la sucursal y activo. Sin elegir, el predeterminado (como
     antes). La venta hecha sin internet que llega cuando ese depósito ya no está sale del predeterminado: la venta
     ya se hizo y no se puede rechazar por eso. */
  begin
    v_dep := nullif(p->>'deposito_id', '')::uuid;
  exception when others then
    raise exception 'El depósito de la venta no es válido.';
  end;
  if v_dep is not null and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local and activo) then
    if v_hecha is null then raise exception 'Ese depósito no es de la sucursal o está dado de baja: elegí otro.'; end if;
    v_dep := null;
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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      /* SQL 264: el vencimiento, de los de Gift Cards (sin decir, 30 días como antes). */
      if coalesce(nullif(x->>'vence_dias', '')::int, 30) not in (30, 60, 90, 365) then
        raise exception 'La Gift Card vence a los 30, 60 o 90 días, o al año.';
      end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
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
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;
  /* SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 cuotas con menos de $150.000, 17 %) se
     suma al total: es lo que se cobra en la tarjeta. Lo calcula la pantalla; acá, que tenga sentido. */
  if v_interes is null or v_interes < 0 then raise exception 'El interés de las cuotas no es válido.'; end if;
  if v_interes > v_total then raise exception 'El interés de las cuotas es más que la venta.'; end if;
  v_total := v_total + v_interes;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  /* SQL 215 */
  if (v_interes > 0 or v_sinint)
     and not exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1) then
    raise exception 'El interés de las cuotas va sólo pagando con tarjeta en cuotas.';
  end if;
  if v_interes = 0 and not v_sinint then v_intnota := null; end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);
  /* SQL 264: las tarjetas salen del depósito de la sucursal donde están (el que más tiene); si no hay ninguna cargada,
     del depósito de la venta (queda en negativo, como cualquier prenda). */
  if array_length(v_gcs, 1) > 0 then
    v_dep_gc := (select s.deposito_id from pos_stock s join pos_depositos d on d.id = s.deposito_id
                  where s.local_id = v_local and s.codigo = 'GIFTCARD' and d.activo
                  order by s.cantidad desc, d.predeterminado desc limit 1);
    v_dep_gc := coalesce(v_dep_gc, v_dep);
  end if;

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet,   -- SQL 212: fecha y sin_internet
                          interes, interes_nota, sin_interes)                   -- SQL 215
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end,
          v_interes, v_intnota, v_sinint)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * (v_total - v_interes) / v_neto, 2) else 0 end,   -- SQL 215: sin el interés
                v_pago, pos_hoy() + coalesce(nullif(x->>'vence_dias', '')::int, 30), v_locod, v_vend,   -- SQL 264: su vencimiento
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio)
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid);
    /* SQL 264: la tarjeta es un artículo del stock («GIFTCARD», talle UNI, color de la tarjeta): sale una. En una prueba, no. */
    if gc is not null and not v_prueba then
      v_gc_col := (select case when lower(t.color) = 'black' then 'NE' else upper(left(t.color, 2)) end from giftcard_tarjetas t where t.codigo = gc);
      perform pos_stock_mover(v_local, 'GIFTCARD', 'UNI', coalesce(v_gc_col, 'NE'), -1, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, 'Gift Card', 'Gift Card ' || pos_gc_nombre(gc), null, v_dep_gc);
    end if;
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color, -it.cantidad, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, it.descripcion, null, null, v_dep);   -- SQL 252: del depósito elegido
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
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). SQL 215: el interés tampoco. */
    v_gana := floor((greatest(v_total - v_interes - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_interes - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_vp_renglones(p_desde date, p_hasta date, p_local uuid, p_vendedor text, p_buscar text, p_prueba boolean)
 RETURNS TABLE(venta_id uuid, fecha timestamp with time zone, dia date, local_id uuid, serie text, numero bigint, letra text, vendedor text, cliente text, socio text, clave text, codigo text, descripcion text, talle text, color text, cantidad integer, precio numeric, cobrado numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with q as (select translate(lower(btrim(coalesce(p_buscar, ''))), 'áéíóúü', 'aeiouu') t)
  select v.id, v.fecha, v.dia, v.local_id, v.serie, v.numero, v.letra, v.vendedor, v.cliente_nombre, v.socio,
         coalesce(upper(nullif(btrim(i.codigo), '')), '~' || lower(btrim(i.descripcion))),
         upper(nullif(btrim(i.codigo), '')), i.descripcion, nullif(btrim(i.talle), ''), nullif(btrim(i.color), ''), i.cantidad, i.precio,
         case when v.neto > 0 then i.total * v.total / v.neto else 0 end
    from pos_ventas v
    join pos_venta_items i on i.venta_id = v.id
    cross join q
   where v.dia between p_desde and p_hasta
     and v.prueba = coalesce(p_prueba, false)
     and v.estado = 'cobrada'
     and coalesce(i.codigo, '') <> 'GIFTCARD'   -- SQL 264: la gift card que se vende no es una venta: cuenta lo que se compra con ella
     and (p_local is null or v.local_id = p_local)
     and (p_vendedor is null or lower(v.vendedor) = lower(p_vendedor))
     and (q.t = ''
          or position(q.t in lower(coalesce(i.codigo, ''))) = 1
          or not exists (select 1 from regexp_split_to_table(q.t, '\s+') w
                          where position(w in translate(lower(i.descripcion), 'áéíóúü', 'aeiouu')) = 0))
$function$;

CREATE OR REPLACE FUNCTION public.pos_ventas_vendedor(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_vendedor text DEFAULT NULL::text, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    /* SQL 264: la gift card que se vende no cuenta (cuenta el día que la usan, con lo que se compra): se le saca a cada
       venta lo de sus gift cards (su parte de los descuentos y del total, como en Ventas por productos) y la venta que
       es sólo una gift card no cuenta como venta. */
    with g as (
      select i.venta_id, sum(i.total) neto, sum(i.cantidad)::int cantidad
        from pos_venta_items i where i.codigo = 'GIFTCARD' group by i.venta_id
    ),
    v as (
      select x.vendedor, x.neto - coalesce(g.neto, 0) neto,
             x.descuentos - case when g.neto is not null and x.neto > 0 then round(g.neto * x.descuentos / x.neto, 2) else 0 end descuentos,
             x.total - case when g.neto is not null and x.neto > 0 then round(g.neto * x.total / x.neto, 2) else 0 end total,
             x.cantidad - coalesce(g.cantidad, 0) cantidad,
             lpad(extract(hour from x.fecha at time zone 'America/Argentina/Buenos_Aires')::int::text, 2, '0') hora,
             x.dia::text dia,
             (x.dia - (extract(isodow from x.dia)::int - 1))::text semana,
             to_char(x.dia, 'YYYY-MM') mes
        from pos_ventas x
        left join g on g.venta_id = x.id
       where x.dia between p_desde and p_hasta
         and x.cantidad > coalesce(g.cantidad, 0)
         and x.prueba = coalesce(p_prueba, false)
         and x.estado = 'cobrada'
         and (p_local is null or x.local_id = p_local)
         and (p_vendedor is null or lower(x.vendedor) = lower(p_vendedor))
    ),
    b as (
      select v.vendedor, k.por, k.k, v.total, v.cantidad
        from v cross join lateral (values ('hora', v.hora), ('dia', v.dia), ('semana', v.semana), ('mes', v.mes)) k(por, k)
    )
    select jsonb_build_object(
      'vendedores', coalesce((
        select jsonb_agg(jsonb_build_object('vendedor', z.vendedor, 'neto', z.neto, 'descuentos', z.descuentos, 'total', z.total,
                                            'productos', z.productos, 'ventas', z.ventas) order by z.total desc, z.vendedor)
          from (select vendedor, sum(neto) neto, sum(descuentos) descuentos, sum(total) total, sum(cantidad) productos, count(*) ventas
                  from v group by vendedor) z), '[]'::jsonb),
      'por', coalesce((
        select jsonb_object_agg(y.por, y.filas)
          from (select z.por, jsonb_agg(jsonb_build_object('vendedor', z.vendedor, 'k', z.k, 'total', z.total, 'productos', z.productos,
                                                           'ventas', z.ventas) order by z.k, z.vendedor) filas
                  from (select por, vendedor, k, sum(total) total, sum(cantidad) productos, count(*) ventas from b group by por, vendedor, k) z
                 group by z.por) y), '{}'::jsonb),
      'totales', (select jsonb_build_object('ventas', count(*), 'productos', coalesce(sum(cantidad), 0), 'neto', coalesce(sum(neto), 0),
                                            'descuentos', coalesce(sum(descuentos), 0), 'total', coalesce(sum(total), 0)) from v)
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_giftcard(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cod  text := regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g');
  t      giftcard_tarjetas%rowtype;
  b      v_beneficios%rowtype;
begin
  perform pos_permiso();
  if v_cod !~ '^99[0-9]{12}$' then return jsonb_build_object('existe', false, 'formato', false); end if;
  select * into t from giftcard_tarjetas g where g.codigo = v_cod;
  if not found then return jsonb_build_object('existe', false, 'formato', true); end if;
  select * into b from v_beneficios x where x.tipo = 'giftcard' and upper(trim(x.serie)) = v_cod;
  return jsonb_build_object('existe', true, 'formato', true, 'nro', lpad(t.nro::text, 3, '0'), 'color', t.color,
                            'vendida', b.id is not null, 'estado', b.estado, 'valor', b.valor, 'vence', b.vence,
                            'local', b.local, 'vendida_el', b.creado, 'usada_el', b.usado, 'local_canje', b.local_canje,
                            'vence_dias', true);   -- SQL 264: la venta acepta el vencimiento
end $function$;

/* SQL 264: la lista de las gift cards del POS (Ventas → Gift cards): las vendidas en la sucursal o usadas en ella (sin
   sucursal, todas las de las sucursales que puede ver), con lo que vale, lo que se cobró, cuándo vence, si se usó y dónde,
   y la venta del POS en que se vendió o se usó. Arriba, lo que queda en el stock (las tarjetas sin vender). */
create or replace function pos_giftcards(p_local uuid default null, p_estado text default null, p_buscar text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cods text[];
  v_q    text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);
  if p_estado is not null and p_estado not in ('disponible', 'usado', 'vencido', 'anulado') then raise exception 'Ese estado no existe.'; end if;
  v_cods := array(select l.codigo from orden_locales l
                   where (p_local is null and pos_local_mio(l.id)) or l.id = p_local);
  return (
    with b as (
      select z.*, t.nro, t.color, t.lote
        from v_beneficios z join giftcard_tarjetas t on t.codigo = upper(trim(z.serie))
       where z.tipo = 'giftcard'
         and (z.local = any (v_cods) or z.local_canje = any (v_cods))
    ),
    f as (
      select b.*,
             (select jsonb_build_object('id', v.id, 'serie', v.serie, 'numero', v.numero, 'letra', v.letra)
                from pos_venta_items i join pos_ventas v on v.id = i.venta_id where i.beneficio = b.id limit 1) venta,
             (select jsonb_build_object('id', v.id, 'serie', v.serie, 'numero', v.numero, 'letra', v.letra)
                from pos_venta_pagos g join pos_ventas v on v.id = g.venta_id where g.beneficio = b.id and v.estado <> 'anulada' limit 1) uso
        from b
       where (p_estado is null or b.estado = p_estado)
         and (v_q is null or lpad(b.nro::text, 3, '0') like '%' || v_q || '%' or b.serie like '%' || v_q)
    )
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', f.id, 'nro', lpad(f.nro::text, 3, '0'), 'color', f.color, 'estado', f.estado,
                  'valor', f.valor, 'cobrado', f.cobrado, 'pago', f.pago::text, 'vence', f.vence, 'dias', f.dias,
                  'local', f.local, 'vendedor', f.vendedor, 'creado', f.creado,
                  'usado', f.usado, 'local_canje', f.local_canje, 'vendedor_canje', f.vendedor_canje, 'monto_compra', f.monto_compra,
                  'anulado', f.anulado, 'anulado_por', f.anulado_por, 'motivo_anul', f.motivo_anul, 'obs', f.obs,
                  'venta', f.venta, 'uso', f.uso) order by f.creado desc, f.id desc)
                from (select * from f order by creado desc, id desc limit 1000) f), '[]'::jsonb),
      'mas', (select count(*) > 1000 from f),
      'totales', (select jsonb_build_object(
                    'disponible', count(*) filter (where estado = 'disponible'),
                    'disponible_valor', coalesce(sum(valor) filter (where estado = 'disponible'), 0),
                    'usado', count(*) filter (where estado = 'usado'),
                    'usado_valor', coalesce(sum(valor) filter (where estado = 'usado'), 0),
                    'vencido', count(*) filter (where estado = 'vencido'),
                    'vencido_valor', coalesce(sum(valor) filter (where estado = 'vencido'), 0),
                    'anulado', count(*) filter (where estado = 'anulado'),
                    'vencen_7', count(*) filter (where estado = 'disponible' and vence <= pos_hoy() + 7)) from b),
      'stock', (select coalesce(sum(s.cantidad), 0) from pos_stock s join pos_depositos d on d.id = s.deposito_id
                 where s.codigo = 'GIFTCARD' and d.activo and ((p_local is null and pos_local_mio(s.local_id)) or s.local_id = p_local))
    )
  );
end $$;
revoke all on function pos_giftcards(uuid, text, text) from public, anon;
grant execute on function pos_giftcards(uuid, text, text) to authenticated;

/* SQL 264: extender una gift card sin usar (lo de «Extender» de Gift Cards), con el permiso de anular (el encargado). Si
   ya venció, cuenta desde hoy. Queda dicho en las observaciones, con quién y cuándo. */
create or replace function pos_giftcard_extender(p_id bigint, p_dias int)
returns date language plpgsql security definer set search_path = public as $$
declare
  b     beneficios;
  v_loc uuid;
  v_hoy date := pos_hoy();
  v_n   date;
  v_yo  text := (select pe.nombre from orden_personas pe where pe.id = orden_yo_id());
begin
  perform pos_permiso('anular');
  if coalesce(p_dias, 0) not in (7, 15, 30, 60) then raise exception 'Se extiende 7, 15, 30 o 60 días.'; end if;
  select * into b from beneficios where id = p_id and tipo = 'giftcard' for update;
  if not found then raise exception 'No existe esa Gift Card.'; end if;
  v_loc := (select l.id from orden_locales l where l.codigo = b.local);
  if v_loc is null then raise exception 'Esa Gift Card no es de una sucursal del POS.'; end if;
  perform pos_local_ok(v_loc);
  if b.anulado is not null then raise exception 'Esa Gift Card está anulada.'; end if;
  if b.usado is not null then raise exception 'Esa Gift Card ya se usó.'; end if;
  update beneficios
     set vence = greatest(coalesce(vence, v_hoy), v_hoy) + p_dias,
         obs = trim(both E'\n' from coalesce(obs, '') || E'\n' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ': ' ||
               coalesce(v_yo, 'alguien') ||
               case when vence < v_hoy then ' la volvió a dar por ' || p_dias || ' días (había vencido el ' || to_char(vence, 'DD/MM') || ') en el POS.'
                    else ' la extendió ' || p_dias || ' días en el POS.' end)
   where id = p_id
  returning vence into v_n;
  return v_n;
end $$;
revoke all on function pos_giftcard_extender(bigint, int) from public, anon;
grant execute on function pos_giftcard_extender(bigint, int) to authenticated;

/* SQL 264: la Gift Card, un artículo del stock (Mauricio, 7/11: "cargarla como un producto dentro del stock"). Se vende
   igual que antes: pasando la tarjeta por la pistola (cada una con su código y su valor); el stock baja de a una. */
insert into pos_articulos (codigo, nombre, rubro, talles, colores, activo)
values ('GIFTCARD', 'Gift Card', 'Gift Card', 'UNI', 'NE', true)
on conflict (codigo) do nothing;

/* Las 20 de Rivadavia (las impresas para Mar del Plata, Nº 131 a 150, sin vender), en su depósito predeterminado. */
do $$
declare
  v_loc uuid := (select id from orden_locales where codigo = 'MAR DEL PLATA');
  v_dep uuid;
  v_n   int;
begin
  if v_loc is null then raise exception 'No encontré Rivadavia (MAR DEL PLATA) en los locales.'; end if;
  v_dep := pos_deposito_de(v_loc);
  v_n := (select count(*) from giftcard_tarjetas t where t.lote = 'Mar del Plata'
           and not exists (select 1 from beneficios b where upper(trim(b.serie)) = t.codigo));
  if v_n > 0 then
    perform pos_stock_mover(v_loc, 'GIFTCARD', 'UNI', 'NE', v_n, 'ajuste', null, 'SQL 264', 'Gift Card',
                            'Las gift cards de Rivadavia (las impresas para Mar del Plata, sin vender): ' || v_n, 'sql-264-giftcards-rivadavia', v_dep);
  end if;
end $$;

/* ═══════════════════════════════════════════════════════════════════════════
   ─── SQL 265 (7/11/2026) · EL CLUB EN LA VENTA DEL POS (ADIÓS A COBRAR) ───
   Mauricio (7/11): "sacá lo de Cobrar y la de Gift Card y pongamos todo en el POS… en los 14 puntos";
   "hagamos como que ya estaría funcionando el POS".
   1. Los puntos: la regla pos_suma_puntos pasa a 'si' (el POS ya los calculaba; ahora los suma).
   2. El cupón (del CRM o de campaña) entra como un descuento de la venta, con sus condiciones (compra mínima, locales,
      tope, uno por persona) y se usa al guardar, como en Cobrar (canjear_beneficio).
   3. El regalo de cumpleaños (el % de su nivel) es otro descuento, con el socio y en su semana.
   4. El premio del Club es un renglón a $ 0: la prenda sale del stock y al socio se le descuentan los puntos (con el
      límite de N cada M meses).
   Anular la venta (o la nota de crédito) devuelve todo: el cupón, el regalo, los puntos del premio y la prenda.
   Cambian pos_venta_guardar y pos_venta_deshacer. Columnas nuevas en pos_venta_descuentos y pos_venta_items. Nuevas:
   pos_club_beneficios y pos_cupon.
   No se puede correr dos veces (frena). Se deshace con deshacer-265.sql mientras no haya ventas con cupón, cumple o premio.
   */

/* SQL 265: la venta guarda con qué cupón (el de una persona: beneficio; el de campaña: su uso) y con qué regalo de
   cumpleaños (el movimiento del Club); el renglón, qué premio es y su movimiento. Sin claves foráneas a propósito: así
   no se traban beneficios ni club_movimientos mientras se corre. */
alter table pos_venta_descuentos add column if not exists beneficio bigint, add column if not exists uso bigint, add column if not exists club_mov bigint;
alter table pos_venta_descuentos drop constraint if exists pos_venta_descuentos_tipo_check;
alter table pos_venta_descuentos add constraint pos_venta_descuentos_tipo_check check (tipo = any (array['promo', 'manual', 'cupon', 'cumple']));
alter table pos_venta_items add column if not exists premio smallint, add column if not exists club_mov bigint;
comment on column pos_venta_descuentos.beneficio is 'SQL 265: el cupón de una persona que se usó (beneficios.id)';
comment on column pos_venta_descuentos.uso is 'SQL 265: el uso del cupón de campaña (beneficio_usos.id)';
comment on column pos_venta_descuentos.club_mov is 'SQL 265: el regalo de cumpleaños entregado (club_movimientos.id)';
comment on column pos_venta_items.premio is 'SQL 265: el premio del Club que se llevó (club_premios.id), a $ 0';
comment on column pos_venta_items.club_mov is 'SQL 265: el canje del premio (club_movimientos.id, con los puntos en negativo)';

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
  /* SQL 215: el interés de las cuotas (lo calcula la pantalla) y la excepción sin interés. */
  v_interes numeric := round(coalesce(nullif(p->>'interes', '')::numeric, 0), 2);
  v_intnota text := nullif(trim(coalesce(p->>'interes_nota', '')), '');
  v_sinint  boolean := coalesce(nullif(p->>'sin_interes', '')::boolean, false);
  v_dep     uuid;             -- SQL 252: el depósito del que sale lo vendido (sin elegir: el predeterminado)
  /* SQL 264: la gift card con su vencimiento (30, 60, 90 días o un año) y como artículo del stock. */
  v_dias    int;
  v_dep_gc  uuid;             -- el depósito donde están las tarjetas (el que más tiene); si no hay, el de la venta
  v_gc_col  text;
  /* SQL 265: el Club en la venta: el cupón, el regalo de cumpleaños y los premios (lo que antes se hacía en Cobrar). */
  v_base    numeric := 0;     -- las prendas después de las promos y los descuentos a mano: sobre esto van el cupón y el cumple
  v_otros   int := 0;         -- cuántos descuentos no son del Club (promos y a mano)
  v_otros_m numeric := 0;
  v_cupx    jsonb;            -- el descuento del cupón, como llegó
  v_cup     v_beneficios%rowtype;
  v_cup_m   numeric := 0;
  v_cumx    jsonb;            -- el del regalo de cumpleaños
  v_cumr    jsonb;
  v_cum_m   numeric := 0;
  v_prem    club_premios%rowtype;
  v_ptsprem int := 0;         -- los puntos de los premios que se lleva
  v_cj      jsonb;
  v_tel     text;
  v_uso     bigint;
  v_cmov    bigint;
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

  /* SQL 171: el socio del Club (el número de su tarjeta), si lo eligieron. */
  if v_socio is not null then
    select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
    if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  /* SQL 252: el depósito que eligieron en la venta, de la sucursal y activo. Sin elegir, el predeterminado (como
     antes). La venta hecha sin internet que llega cuando ese depósito ya no está sale del predeterminado: la venta
     ya se hizo y no se puede rechazar por eso. */
  begin
    v_dep := nullif(p->>'deposito_id', '')::uuid;
  exception when others then
    raise exception 'El depósito de la venta no es válido.';
  end;
  if v_dep is not null and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local and activo) then
    if v_hecha is null then raise exception 'Ese depósito no es de la sucursal o está dado de baja: elegí otro.'; end if;
    v_dep := null;
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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      /* SQL 264: el vencimiento, de los de Gift Cards (sin decir, 30 días como antes). */
      if coalesce(nullif(x->>'vence_dias', '')::int, 30) not in (30, 60, 90, 365) then
        raise exception 'La Gift Card vence a los 30, 60 o 90 días, o al año.';
      end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
    /* SQL 265: el premio del Club: la prenda (o algo sin código) que se lleva a $ 0 con los puntos del socio, de a una. */
    if nullif(x->>'premio', '') is not null then
      if v_socio is null then raise exception 'El premio del Club va con el socio: elegilo en «Socio».'; end if;
      if nullif(x->>'giftcard', '') is not null then raise exception 'Una Gift Card no puede ser un premio del Club.'; end if;
      if n <> 1 or pr <> 0 then raise exception 'El premio del Club va de a uno y a $ 0.'; end if;
      select * into v_prem from club_premios where id = (x->>'premio')::smallint and activo;
      if not found then raise exception 'Ese premio del Club ya no está.'; end if;
      v_ptsprem := v_ptsprem + v_prem.puntos;
    end if;
    v_neto := v_neto + pr * n;
    v_cant := v_cant + n;
  end loop;

  if jsonb_typeof(v_descs) <> 'array' then raise exception 'Los descuentos no son válidos.'; end if;
  for x in select * from jsonb_array_elements(v_descs) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un descuento que no es válido.'; end if;
    if coalesce(x->>'tipo', '') not in ('promo', 'manual', 'cupon', 'cumple') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;   -- SQL 265: cupon y cumple
    /* SQL 265: un cupón y un regalo de cumpleaños por venta, como mucho. */
    if x->>'tipo' = 'cupon' then
      if v_cupx is not null then raise exception 'Va un solo cupón por venta.'; end if;
      v_cupx := x;
      v_cup_m := m;
    elsif x->>'tipo' = 'cumple' then
      if v_cumx is not null then raise exception 'El regalo de cumpleaños va una sola vez.'; end if;
      v_cumx := x;
      v_cum_m := m;
    else
      v_otros := v_otros + 1;
      v_otros_m := v_otros_m + m;
    end if;
    v_desc := v_desc + m;
  end loop;
  if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;

  /* SQL 265: el Club en la venta, con las mismas reglas que Cobrar. El cupón y el regalo de cumpleaños van sobre las
     prendas después de las promos y los descuentos a mano (primero el cupón; el cumple, sobre lo que queda). Los
     premios, con los puntos que el socio ya tiene. */
  v_locod := (select codigo from orden_locales where id = v_local);
  if v_cupx is not null or v_cumx is not null then
    if v_gc_neto > 0 then
      raise exception 'El cupón y el regalo de cumpleaños no van en una venta con una Gift Card: la Gift Card, en otra venta.';
    end if;
    v_base := v_neto - v_otros_m;
  end if;
  if v_ptsprem > 0 or v_cumx is not null then
    if v_socio is null then raise exception 'El regalo de cumpleaños va con el socio: elegilo en «Socio».'; end if;
    /* El socio queda trabado hasta que termina la venta: dos cajas a la vez no le gastan dos veces los mismos puntos ni
       le dan dos regalos (como en Cobrar). */
    perform 1 from club_clientes where id = v_cli.id for update;
    select * into v_cli from v_club_clientes where id = v_cli.id;
  end if;
  if v_ptsprem > 0 then
    if v_cli.puntos < v_ptsprem then
      raise exception 'Al socio no le alcanzan los puntos para el premio: tiene % y hacen falta %.', v_cli.puntos, v_ptsprem;
    end if;
    /* El límite de cada premio (N cada M meses), contando los de esta venta. */
    for v_prem in select z.* from club_premios z
                   where z.limite_anual is not null
                     and z.id in (select (y->>'premio')::smallint from jsonb_array_elements(v_items) y where nullif(y->>'premio', '') is not null) loop
      if (select count(*) from club_movimientos mm
           where mm.cliente = v_cli.id and mm.tipo = 'canje' and mm.premio = v_prem.id and mm.anulado is null
             and mm.creado > now() - make_interval(months => v_prem.limite_meses))
         + (select count(*) from jsonb_array_elements(v_items) y where nullif(y->>'premio', '')::smallint = v_prem.id) > v_prem.limite_anual then
        raise exception 'El premio «%» se lleva % cada % meses y ya se lo llevó.', v_prem.nombre,
          case when v_prem.limite_anual = 1 then 'una vez' else v_prem.limite_anual || ' veces' end, v_prem.limite_meses;
      end if;
    end loop;
  end if;
  if v_cupx is not null then
    select * into v_cup from v_beneficios where id = nullif(v_cupx->>'beneficio', '')::bigint;
    if not found or v_cup.tipo::text <> 'descuento' then raise exception 'Ese cupón no existe.'; end if;
    if v_cup.estado <> 'disponible' then
      raise exception 'El cupón está %: no se puede usar.',
        case v_cup.estado when 'usado' then 'usado' when 'vencido' then 'vencido' when 'anulado' then 'anulado' else v_cup.estado end;
    end if;
    if v_cup.desde is not null and v_cup.desde > pos_hoy() then
      raise exception 'El cupón empieza a valer el %.', to_char(v_cup.desde, 'DD/MM');
    end if;
    if v_cup.locales is not null and upper(trim(v_locod)) <> all (select upper(trim(z)) from unnest(v_cup.locales) z) then
      raise exception 'Ese cupón no vale en esta sucursal.';
    end if;
    if v_cup.compra_minima is not null and v_base < v_cup.compra_minima then
      raise exception 'El cupón es para compras desde $ %.', replace(to_char(v_cup.compra_minima, 'FM999G999G990'), ',', '.');
    end if;
    if v_cup.codigo is not null and not coalesce(v_cup.acumulable, false) and (v_otros > 0 or v_cumx is not null) then
      raise exception 'Ese cupón no se combina con otras promociones: sacá los otros descuentos o no uses el cupón.';
    end if;
    if v_cup.codigo is null and nullif(trim(coalesce(v_cupx->>'clave', '')), '') is null and v_socio is null then
      raise exception 'Ese cupón es de una persona: elegí al socio o buscalo con su WhatsApp.';
    end if;
    if v_cup_m > least(case when v_cup.pct is not null then round(v_base * v_cup.pct / 100, 2) else coalesce(v_cup.valor, 0) end,
                       coalesce(v_cup.tope, v_base), v_base) + 0.01 then
      raise exception 'El descuento del cupón es más de lo que da (%).',
        case when v_cup.pct is not null then v_cup.pct || ' %' else '$ ' || replace(to_char(coalesce(v_cup.valor, 0), 'FM999G999G990'), ',', '.') end
        || case when v_cup.tope is not null then ', con un tope de $ ' || replace(to_char(v_cup.tope, 'FM999G999G990'), ',', '.') else '' end;
    end if;
  end if;
  if v_cumx is not null then
    v_cumr := club_regalo_cumple(v_cli.id);
    if not coalesce((v_cumr->>'vale')::boolean, false) then
      raise exception 'El socio no está en su semana de cumpleaños (o no tiene el cumpleaños cargado).';
    end if;
    if coalesce((v_cumr->>'usado')::boolean, false) then raise exception 'El socio ya usó el regalo de este cumpleaños.'; end if;
    if coalesce(v_cumr->>'tipo', '') <> 'descuento' or nullif(v_cumr->>'porcentaje', '') is null then
      raise exception 'El regalo de cumpleaños de su nivel no es un descuento: se entrega aparte.';
    end if;
    if v_cum_m > round((v_base - v_cup_m) * (v_cumr->>'porcentaje')::numeric / 100, 2) + 0.01 then
      raise exception 'El regalo de cumpleaños es el % %% de la compra: el descuento es más que eso.', v_cumr->>'porcentaje';
    end if;
  end if;
  v_total := v_neto - v_desc;
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;
  /* SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 cuotas con menos de $150.000, 17 %) se
     suma al total: es lo que se cobra en la tarjeta. Lo calcula la pantalla; acá, que tenga sentido. */
  if v_interes is null or v_interes < 0 then raise exception 'El interés de las cuotas no es válido.'; end if;
  if v_interes > v_total then raise exception 'El interés de las cuotas es más que la venta.'; end if;
  v_total := v_total + v_interes;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  /* SQL 215 */
  if (v_interes > 0 or v_sinint)
     and not exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1) then
    raise exception 'El interés de las cuotas va sólo pagando con tarjeta en cuotas.';
  end if;
  if v_interes = 0 and not v_sinint then v_intnota := null; end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);
  /* SQL 264: las tarjetas salen del depósito de la sucursal donde están (el que más tiene); si no hay ninguna cargada,
     del depósito de la venta (queda en negativo, como cualquier prenda). */
  if array_length(v_gcs, 1) > 0 then
    v_dep_gc := (select s.deposito_id from pos_stock s join pos_depositos d on d.id = s.deposito_id
                  where s.local_id = v_local and s.codigo = 'GIFTCARD' and d.activo
                  order by s.cantidad desc, d.predeterminado desc limit 1);
    v_dep_gc := coalesce(v_dep_gc, v_dep);
  end if;

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet,   -- SQL 212: fecha y sin_internet
                          interes, interes_nota, sin_interes)                   -- SQL 215
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end,
          v_interes, v_intnota, v_sinint)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * (v_total - v_interes) / v_neto, 2) else 0 end,   -- SQL 215: sin el interés
                v_pago, pos_hoy() + coalesce(nullif(x->>'vence_dias', '')::int, 30), v_locod, v_vend,   -- SQL 264: su vencimiento
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio, premio)   -- SQL 265: premio
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid,
            nullif(x->>'premio', '')::smallint);
    /* SQL 264: la tarjeta es un artículo del stock («GIFTCARD», talle UNI, color de la tarjeta): sale una. En una prueba, no. */
    if gc is not null and not v_prueba then
      v_gc_col := (select case when lower(t.color) = 'black' then 'NE' else upper(left(t.color, 2)) end from giftcard_tarjetas t where t.codigo = gc);
      perform pos_stock_mover(v_local, 'GIFTCARD', 'UNI', coalesce(v_gc_col, 'NE'), -1, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, 'Gift Card', 'Gift Card ' || pos_gc_nombre(gc), null, v_dep_gc);
    end if;
    /* SQL 265: el premio del Club le descuenta los puntos al socio, como el canje de Cobrar. La prenda sale del stock con
       las demás. En una prueba, no. */
    if nullif(x->>'premio', '') is not null and not v_prueba then
      select * into v_prem from club_premios where id = (x->>'premio')::smallint;
      insert into club_movimientos (cliente, tipo, puntos, premio, local, vendedor, ticket, obs)
      values (v_cli.id, 'canje', -v_prem.puntos, v_prem.id, v_locod, v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, v_prem.nombre)
      returning id into v_cmov;
      update pos_venta_items set club_mov = v_cmov where venta_id = v_id and item = i;
    end if;
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color, -it.cantidad, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, it.descripcion, null, null, v_dep);   -- SQL 252: del depósito elegido
    end loop;
  end if;

  i := 0;
  for x in select * from jsonb_array_elements(v_descs) loop
    i := i + 1;
    v_bid := null;
    v_uso := null;
    v_cmov := null;
    /* SQL 265: el cupón se usa como en Cobrar (canjear_beneficio: el de una persona queda usado; el de campaña suma un
       uso, con el WhatsApp si es «uno por persona») y el regalo de cumpleaños queda entregado. En una prueba, nada. */
    if x->>'tipo' = 'cupon' and not v_prueba then
      v_tel := coalesce(tel_cliente(nullif(x->>'telefono', '')), tel_cliente(v_cli.telefono), tel_cliente(nullif(p->>'cliente_tel', '')));
      v_cj := canjear_beneficio(v_cup.id, coalesce(nullif(trim(coalesce(x->>'clave', '')), ''), v_cli.telefono), v_locod, v_vend, v_base,
                                (select trim(y->>'descripcion') from jsonb_array_elements(v_items) y limit 1), v_tel,
                                coalesce(nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_cli.nombre));
      if not coalesce((v_cj->>'canjeado')::boolean, false) then
        raise exception 'El cupón no se pudo usar: %.', coalesce(v_cj->>'porque', 'no sé por qué');
      end if;
      if v_cup.multiuso then
        v_uso := (select max(u.id) from beneficio_usos u where u.beneficio = v_cup.id);   -- el que acaba de anotar (con el candado del cupón)
      else
        v_bid := v_cup.id;
      end if;
    elsif x->>'tipo' = 'cumple' and not v_prueba then
      insert into club_movimientos (cliente, tipo, concepto, puntos, local, vendedor, ticket, obs, costo)
      values (v_cli.id, 'canje', 'regalo_cumple', 0, v_locod, v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, v_cumr->>'texto', round((x->>'monto')::numeric, 2))
      returning id into v_cmov;
    end if;
    insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto, beneficio, uso, club_mov)   -- SQL 265: con qué cupón o regalo
    values (v_id, i, x->>'tipo', nullif(x->>'promo_id', '')::int,
            coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2), v_bid, v_uso, v_cmov);
  end loop;

  i := 0;
  for x in select * from jsonb_array_elements(v_pagos) loop
    i := i + 1;
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 265: desde el 265 la regla pos_suma_puntos está en 'si': el POS suma los puntos y Cobrar ya no se usa en los locales.
     SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). SQL 215: el interés tampoco. */
    v_gana := floor((greatest(v_total - v_interes - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_interes - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null,
                            'premio_puntos', v_ptsprem);   -- SQL 265
end $function$;

CREATE OR REPLACE FUNCTION public.pos_venta_deshacer(p_id uuid, p_motivo text, p_nc text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v pos_ventas; m pos_stock_movs; v_usadas text;
begin
  select * into v from pos_ventas where id = p_id;
  /* SQL 200: la gift card que se vendió en esta venta no tiene que estar usada. */
  select string_agg(pos_gc_nombre(b.serie), ', ' order by i.item) into v_usadas
    from pos_venta_items i join beneficios b on b.id = i.beneficio
   where i.venta_id = p_id and b.usado is not null;
  if v_usadas is not null then
    raise exception 'La Gift Card % de esta venta ya se usó: la venta no se puede anular.', v_usadas;
  end if;
  update pos_ventas set estado = 'anulada', anulada_en = now(), anulada_por = orden_yo_id(), anulada_motivo = trim(p_motivo)
   where id = p_id;
  /* SQL 252: lo vendido vuelve al depósito del que salió, si sigue activo en la sucursal (si no, al predeterminado). */
  for m in select * from pos_stock_movs where ref_id = p_id and tipo = 'venta' order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, 'venta_anulada', p_id,
                            m.ref || ' (' || coalesce('nota de crédito ' || p_nc, 'anulada') || ')', null, null, null,
                            (select x.id from pos_depositos x where x.id = m.deposito_id and x.local_id = m.local_id and x.activo));
  end loop;
  /* SQL 171: si la venta le sumó puntos a un socio, se le descuentan: el movimiento del Club queda anulado,
     como cuando se anula una carga en Cobrar. */
  if v.club_mov is not null then
    update club_movimientos
       set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS'),
           motivo_anul = coalesce('Nota de crédito ' || p_nc || ' en el POS: ', 'Venta anulada en el POS: ') || trim(p_motivo)
     where id = v.club_mov and anulado is null;
  end if;
  /* SQL 200: la gift card que se vendió vuelve a estar sin vender (se puede vender de nuevo: la venta anulada
     guarda cuál era y por cuánto) y la que pagó vuelve a estar disponible. */
  delete from beneficios b using pos_venta_items i where i.venta_id = p_id and i.beneficio = b.id;
  update beneficios b set usado = null, local_canje = null, vendedor_canje = null, monto_compra = null, canal_canje = null
    from pos_venta_pagos g
   where g.venta_id = p_id and g.medio = 'giftcard' and g.beneficio = b.id;
  /* SQL 265: lo del Club que usó la venta vuelve atrás: el cupón de una persona vuelve a estar sin usar, el uso del cupón
     de campaña queda anulado, y el regalo de cumpleaños y los premios se anulan (el socio recupera los puntos; la prenda
     del premio vuelve al stock con las demás). */
  update beneficios b set usado = null, local_canje = null, vendedor_canje = null, monto_compra = null, canal_canje = null
    from pos_venta_descuentos d
   where d.venta_id = p_id and d.tipo = 'cupon' and d.beneficio = b.id and b.usado is not null;
  update beneficio_usos u set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS')
    from pos_venta_descuentos d
   where d.venta_id = p_id and d.tipo = 'cupon' and d.uso = u.id and u.anulado is null;
  update club_movimientos
     set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS'),
         motivo_anul = coalesce('Nota de crédito ' || p_nc || ' en el POS: ', 'Venta anulada en el POS: ') || trim(p_motivo)
   where anulado is null
     and id in (select d.club_mov from pos_venta_descuentos d where d.venta_id = p_id and d.club_mov is not null
                union all
                select i.club_mov from pos_venta_items i where i.venta_id = p_id and i.club_mov is not null);
end $function$;

/* SQL 265: lo que el socio puede usar en la venta: su cumpleaños, los premios (si le alcanzan los puntos y desde cuándo
   puede volver a llevarse uno con límite) y los cupones de su WhatsApp. Como Cobrar, pero sin el PIN de la caja: con el
   permiso del POS. */
create or replace function pos_club_beneficios(p_socio text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  c v_club_clientes%rowtype;
  r jsonb;
begin
  perform pos_permiso();
  select * into c from v_club_clientes where codigo = regexp_replace(coalesce(p_socio, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  r := club_regalo_cumple(c.id);
  return jsonb_build_object(
    'puntos', c.puntos,
    'nivel', c.nivel,
    'cumple', case when coalesce((r->>'vale')::boolean, false) then
                jsonb_build_object('usado', coalesce((r->>'usado')::boolean, false), 'tipo', r->>'tipo',
                                   'porcentaje', nullif(r->>'porcentaje', '')::numeric, 'texto', r->>'texto', 'hasta', r->>'hasta')
              end,
    'premios', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.nombre, 'detalle', z.detalle, 'puntos', z.puntos,
                                          'alcanza', c.puntos >= z.puntos, 'vuelve', z.vuelve) order by z.orden, z.puntos)
        from (select pr.*,
                     case when pr.limite_anual is not null then
                       (select ((m.creado + make_interval(months => pr.limite_meses)) at time zone 'America/Argentina/Buenos_Aires')::date
                          from club_movimientos m
                         where m.cliente = c.id and m.tipo = 'canje' and m.premio = pr.id and m.anulado is null
                           and m.creado > now() - make_interval(months => pr.limite_meses)
                         order by m.creado desc offset pr.limite_anual - 1 limit 1)
                     end as vuelve
                from club_premios pr where pr.activo) z), '[]'::jsonb),
    'cupones', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'pct', b.pct, 'valor', b.valor, 'tope', b.tope, 'compra_minima', b.compra_minima,
                                          'locales', b.locales, 'acumulable', b.acumulable, 'al_portador', b.codigo is not null,
                                          'multiuso', b.multiuso, 'por_cliente', b.por_cliente, 'desde', b.desde, 'vence', b.vence,
                                          'buscaba', g.producto) order by b.vence nulls last, b.id)
        from v_beneficios b left join registros g on g.id = b.registro
       where b.tipo = 'descuento' and b.estado = 'disponible' and not b.multiuso
         and c.telefono is not null and tel_cliente(b.telefono) = tel_cliente(c.telefono)), '[]'::jsonb));
end $function$;
revoke all on function pos_club_beneficios(text) from public, anon;
grant execute on function pos_club_beneficios(text) to authenticated;

/* SQL 265: el cupón que pasan en la venta (por su código, o por el WhatsApp de la persona), como lo busca Cobrar
   (beneficio_buscar), sin las gift cards y sin devolver el código. */
create or replace function pos_cupon(p_clave text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
  perform pos_permiso();
  if length(regexp_replace(coalesce(p_clave, ''), '[^A-Za-z0-9]', '', 'g')) < 4 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'estado', b.estado, 'pct', b.pct, 'valor', b.valor, 'tope', b.tope,
                                        'compra_minima', b.compra_minima, 'locales', b.locales, 'acumulable', b.acumulable,
                                        'al_portador', b.al_portador, 'multiuso', b.multiuso, 'por_cliente', b.por_cliente,
                                        'desde', b.desde, 'vence', b.vence, 'buscaba', b.buscaba, 'nombre', b.nombre))
      from beneficio_buscar(p_clave) b where b.tipo = 'descuento'), '[]'::jsonb);
end $function$;
revoke all on function pos_cupon(text) from public, anon;
grant execute on function pos_cupon(text) to authenticated;

/* SQL 265: el POS suma los puntos del Club (hasta acá se cargaban en Cobrar, que deja de usarse en los locales). */
update club_reglas set valor = 'si' where clave = 'pos_suma_puntos';

-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 272 (11/11/2026) · LOS GASTOS TAMBIÉN PUEDEN SALIR DE LA CAJA FUERTE
--
--  Mauricio (11/11, con la foto del «Nuevo gasto»): «En gastos de local tengo el
--  desplegable con la descripción del gasto y la forma de pago: efectivo, caja
--  chica o caja fuerte. Si es de caja chica lo descuenta Caja Chica; si es de
--  caja fuerte lo descuenta la caja fuerte. Las comisiones, por ejemplo, las
--  pago de caja fuerte.»
--    · El gasto guarda de qué caja salió: caja vacía = la chica (como siempre);
--      caja = 'fuerte' = la fuerte.
--    · El de la caja chica entra solo en el próximo cierre; el de la fuerte no
--      entra en ningún cierre (todas las cuentas del cierre ya miran sólo lo de
--      la caja chica) y resta en la caja fuerte de Disponibilidad. Se anula
--      cuando sea, como el retiro de la caja fuerte.
--    · El listado trae la caja de cada gasto y el total de los de la fuerte
--      (totales.gasto_fuerte): con eso la pantalla sabe que puede dejar elegir.
--  Ese mismo día salieron de la pantalla «Otra salida» y «Otro ingreso» («nunca
--  lo usamos»); la base los sigue aceptando.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pos_caja_movimientos drop constraint if exists pos_caja_movimientos_retiro_check;
alter table pos_caja_movimientos add constraint pos_caja_movimientos_retiro_check check (
      (case tipo when 'retiro' then caja is not null
                 when 'gasto'  then caja is null or caja = 'fuerte'   -- SQL 272: el gasto de la caja chica (vacía) o de la fuerte
                 else caja is null end)
  and (tipo <> 'retiro' or retira is not null)
  and (controlado_en is null or tipo in ('caja_fuerte', 'retiro')));

CREATE OR REPLACE FUNCTION public.pos_caja_mov_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_tipo    text := coalesce(p->>'tipo', '');
  v_rubro   text := nullif(trim(coalesce(p->>'rubro', '')), '');
  v_desc    text := nullif(trim(coalesce(p->>'descripcion', '')), '');
  v_monto   numeric := round(nullif(p->>'monto', '')::numeric, 2);
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_caja    text := nullif(trim(coalesce(p->>'caja', '')), '');     -- SQL 191
  v_retira  text := nullif(trim(coalesce(p->>'retira', '')), '');   -- SQL 191
  v_id      uuid;
  v_num     int;
  v_ya      pos_caja_movimientos;
begin
  perform pos_permiso(case when v_tipo = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190; SQL 262: el retiro, con su casilla
  perform pos_local_ok(v_local);
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then
    raise exception 'El movimiento tiene que ser un gasto, otra salida, otro ingreso, un pase a la caja fuerte o un retiro de fondos.';
  end if;
  /* SQL 191: el retiro dice de qué caja sale la plata y quién se la lleva. */
  if v_tipo = 'retiro' then
    if v_caja is null or v_caja not in ('chica', 'fuerte') then raise exception 'Elegí de qué caja sale la plata.'; end if;
    if v_retira is null then raise exception 'Elegí quién retira la plata.'; end if;
    if length(v_retira) > 80 then raise exception 'El nombre de quien retira es demasiado largo.'; end if;
  end if;
  if v_tipo = 'gasto' and v_rubro is null then raise exception 'Elegí el tipo de gasto.'; end if;
  /* SQL 272: el gasto también dice de qué caja sale la plata. Sin decirlo, de la caja chica, como siempre. El de la caja
     fuerte se guarda con caja = 'fuerte'; el de la chica queda como hasta ahora (caja vacía). */
  if v_tipo = 'gasto' then
    if v_caja is not null and v_caja not in ('chica', 'fuerte') then raise exception 'Elegí de qué caja sale la plata.'; end if;
    v_caja := case when v_caja = 'fuerte' then 'fuerte' end;
  end if;
  if v_tipo in ('salida', 'ingreso') and v_desc is null then raise exception 'Escribí de qué es.'; end if;
  if length(v_rubro) > 60 or length(v_desc) > 200 then raise exception 'El texto es demasiado largo.'; end if;
  if v_monto is null or v_monto <= 0 or v_monto >= 100000000 then raise exception 'Escribí el monto.'; end if;
  /* SQL 179: un número por vez en cada local: si dos guardan al mismo tiempo, el segundo espera (como los cambios). */
  perform pg_advisory_xact_lock(hashtext('pos_gasto:' || v_local::text || ':' || v_prueba::text));
  if v_clave is not null then
    select * into v_ya from pos_caja_movimientos where clave = v_clave;
    if found then return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'prueba', v_ya.prueba, 'ya', true); end if;
  end if;
  select coalesce(max(m.numero), 0) + 1 into v_num from pos_caja_movimientos m
   where m.local_id = v_local and m.prueba = v_prueba   -- SQL 180: dos talonarios; SQL 191: tres
     and (case m.tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end) = (case v_tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end);
  insert into pos_caja_movimientos (local_id, prueba, dia, tipo, rubro, descripcion, monto, persona, persona_nombre, clave, numero, caja, retira)
  values (v_local, v_prueba, orden_dia_caja(v_local), v_tipo, case when v_tipo = 'gasto' then v_rubro end, v_desc, v_monto,
          orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_clave, v_num,
          case when v_tipo in ('retiro', 'gasto') then v_caja end, case when v_tipo = 'retiro' then v_retira end)   -- SQL 191; SQL 272: el gasto de la caja fuerte
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v_prueba, 'ya', false);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_movimientos(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_tipo text DEFAULT NULL::text, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_retiros boolean;   -- SQL 262
begin
  perform pos_permiso(case when p_tipo = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190; SQL 262: la lista de los retiros, con su casilla
  v_retiros := pos_puede('retiros');   -- SQL 262: sin la casilla, «Todos» no trae los retiros
  perform pos_local_ok(p_local);
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_tipo is not null and p_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then raise exception 'Ese tipo de movimiento no existe.'; end if;
  return (
    with t as (
      select m.id, 'mov'::text as origen, m.fecha, m.local_id, m.tipo, m.rubro, m.descripcion, m.monto, m.persona_nombre as persona,
             m.estado = 'ok' as vale, m.estado, m.cierre_id, m.anulado_motivo, m.numero,   -- SQL 179: el número del gasto
             m.caja, m.retira, m.controlado_en, m.controlado_por   -- SQL 191
        from pos_caja_movimientos m
       where m.dia between p_desde and p_hasta and m.prueba = coalesce(p_prueba, false) and (p_local is null or m.local_id = p_local)
      union all
      select c.id, 'cierre', c.fecha, c.local_id, 'caja_fuerte', null, null, c.retiro, c.responsable_nombre,
             c.estado = 'cerrada', case when c.estado = 'cerrada' then 'ok' else 'anulado' end, c.id, c.anulado_motivo, null::int,
             null::text, null::text, null::timestamptz, null::uuid
        from pos_cierres c
       where c.retiro > 0 and c.dia between p_desde and p_hasta and c.prueba = coalesce(p_prueba, false)
         and (p_local is null or c.local_id = p_local)
    ), f as (
      select * from t where (p_tipo is null or t.tipo = p_tipo) and (t.tipo <> 'retiro' or v_retiros)   -- SQL 262
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'origen', z.origen, 'fecha', z.fecha, 'local', l.nombre, 'local_id', z.local_id, 'tipo', z.tipo,
                 'rubro', z.rubro, 'descripcion', z.descripcion, 'monto', z.monto, 'persona', z.persona, 'estado', z.estado,
                 'motivo', z.anulado_motivo, 'numero', z.numero,
                 'caja', case when z.tipo = 'gasto' then coalesce(z.caja, 'chica') else z.caja end,   -- SQL 272: el gasto, de la chica o de la fuerte
                 'retira', z.retira, 'controlado', z.controlado_en is not null, 'controlado_en', z.controlado_en,   -- SQL 191
                 'controlado_por', (select pe.nombre from orden_personas pe where pe.id = z.controlado_por),
                 'cierre', (select jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'estado', c.estado)
                              from pos_cierres c where c.id = z.cierre_id)) order by z.fecha desc)
          from (select * from f order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'gasto',       coalesce(sum(monto) filter (where vale and tipo = 'gasto'), 0),
                    'gasto_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'gasto' and caja = 'fuerte'), 0),   -- SQL 272
                    'salida',      coalesce(sum(monto) filter (where vale and tipo = 'salida'), 0),
                    'ingreso',     coalesce(sum(monto) filter (where vale and tipo = 'ingreso'), 0),
                    'caja_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'caja_fuerte'), 0),
                    'retiro',      coalesce(sum(monto) filter (where vale and tipo = 'retiro'), 0),   -- SQL 191
                    'controlado',  coalesce(sum(monto) filter (where vale and controlado_en is not null), 0),
                    'cantidad',    count(*) filter (where vale)) from f),
      'mas', (select count(*) > 500 from f)
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_eventos(p_local uuid, p_caja text)
 RETURNS TABLE(fecha timestamp with time zone, orden integer, dia date, tipo text, ref text, detalle text, persona text, importe numeric, control numeric, ref_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_primero  pos_cierres;
  v_corte    timestamptz;
begin
  if p_caja = 'chica' then
    select * into v_primero from pos_cierres c
     where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' order by c.fecha limit 1;
    /* Las ventas cuentan desde el primer cierre, como en pos_caja_abierta (las de antes del POS no entran nunca). */
    v_corte := coalesce((select min(c.desde) from pos_cierres c where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'),
                        orden_en_hora(p_local, orden_dia_caja(p_local), '00:00'));
    if v_primero.id is not null then
      /* El saldo inicial del primer cierre, antes que todo (orden 0 gana los empates): un gasto cargado antes de ese día
         también entró en él. */
      return query select least(v_primero.desde, coalesce((select min(m.fecha) from pos_caja_movimientos m
                                                             where m.local_id = p_local and not m.prueba and coalesce(m.caja, 'chica') = 'chica'),
                                                          v_primero.desde)),
                          0, v_primero.dia, 'inicial'::text, 'Saldo inicial'::text,
                          ('Con lo que arrancó la caja en el cierre Nº ' || v_primero.numero)::text, v_primero.responsable_nombre,
                          null::numeric, v_primero.saldo_inicial, v_primero.id;
    end if;
    return query
      select x.fecha, 1, x.dia, 'venta'::text, case when x.letra = 'X' then 'X-' || x.numero else 'Nº ' || x.numero end,
             ('Venta · ' || x.vendedor)::text, null::text, sum(pg.monto), null::numeric, x.id
        from pos_ventas x join pos_venta_pagos pg on pg.venta_id = x.id and pg.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'cobrada' and x.fecha >= v_corte
       group by x.id
      union all
      select x.fecha, 1, x.dia, 'cambio'::text, 'C-' || x.numero, ('Cambio · ' || x.vendedor)::text, null::text, sum(pc.monto), null::numeric, x.id
        from pos_cambios x join pos_cambio_pagos pc on pc.cambio_id = x.id and pc.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'hecho' and x.fecha >= v_corte
       group by x.id
      union all
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' when 'retiro' then 'RF-' else 'G-' end || m.numero,
             case m.tipo when 'gasto' then 'Gasto · ' || coalesce(m.rubro, '')
                         when 'salida' then 'Otra salida' when 'ingreso' then 'Otro ingreso'
                         when 'caja_fuerte' then 'A la caja fuerte'
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end
               || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'ingreso' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok' and coalesce(m.caja, 'chica') = 'chica'
      union all
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 2, c.dia, 'cierre'::text, 'Cierre Nº ' || c.numero,
             (case when c.sin_contar then 'Cierre de caja, sin contar' else 'Cierre de caja' end)::text,   -- SQL 247
             c.responsable_nombre, null::numeric, c.contado, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'
      union all
      /* Hasta el SQL 180, lo de la caja fuerte se pasaba al cerrar. */
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'A la caja fuerte, al cerrar'::text,
             c.responsable_nombre, -c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0;
  elsif p_caja = 'fuerte' then
    return query
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' when 'gasto' then 'G-' else 'RF-' end || m.numero,
             case m.tipo when 'caja_fuerte' then 'De la caja chica'
                         when 'gasto' then 'Gasto · ' || coalesce(m.rubro, '')   -- SQL 272
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'caja_fuerte' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok'
         and (m.tipo = 'caja_fuerte' or (m.tipo in ('retiro', 'gasto') and m.caja = 'fuerte'))   -- SQL 272: y los gastos de la caja fuerte
      union all
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'De la caja chica, al cerrar'::text,
             c.responsable_nombre, c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0
      union all
      select a.fecha, 2, a.dia, 'ajuste'::text, 'Ajuste Nº ' || a.numero, ('Ajuste' || coalesce(' · ' || a.observaciones, ''))::text,
             a.persona_nombre, null::numeric, a.contado, a.id
        from pos_caja_ajustes a
       where a.local_id = p_local and a.caja = 'fuerte' and a.estado = 'ok';
  else
    raise exception 'La caja tiene que ser la chica o la fuerte.';
  end if;
end $function$;


-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 277 (12/11/2026): «EDITAR» EL TICKET (App Orden: correr-en-supabase-277.sql)
-- ═══════════════════════════════════════════════════════════════════════════
-- SQL 277 (12/11/2026): «Editar» el ticket del POS.
--   Pedido de Mauricio (12/11, con la foto del Ticket X-5 de Rivadavia): «En tickets, en X necesito la opción de poder
--   editar el ticket. En X se puede editar el total, la cantidad y todo. En B lo único que se puede editar es la parte de
--   tarjetas y cuotas sin interés, pero no se puede modificar el total, porque ya está facturada. En efectivo se tiene
--   que poder editar.»
--   Las reglas:
--     - La X (el comprobante interno, en efectivo): se edita TODO —los productos, las cantidades, los precios, los
--       descuentos (promos y a mano), el vendedor, el cliente, el socio del Club y las observaciones—. El ticket sigue
--       siendo el mismo (mismo número, misma fecha, mismo día de la caja). Lo que cambia en las prendas se mueve en el
--       stock (sólo la diferencia, del depósito del que salió). Los puntos del socio se vuelven a sacar si cambió el
--       total o el socio. El permiso es el de anular (hoy se anula y se duplica: el mismo poder).
--       No se edita la X que vendió o se pagó con una Gift Card, ni la que tiene un premio, un cupón o el regalo de
--       cumpleaños del Club: esa se anula y se hace de nuevo (lo del Club y la Gift Card lo confirma la base al vender).
--     - La A y la B (facturas): sólo con qué se pagó —el medio, qué tarjeta (Visa, Master…), las cuotas SIN interés (3
--       desde $80.000, 6 desde $150.000, la regla de la venta) y el número de operación—. NO los montos: cada pago queda
--       con su monto, no se agregan ni se juntan pagos (Mauricio, 12/11, con la foto de «Corregir el pago»: «En B no te
--       tiene que dejar corregir el monto… solamente la parte del medio de pago»). Si un monto estaba mal: nota de
--       crédito y la venta de nuevo. El total no cambia. Si la venta tiene el interés de las cuotas, ese
--       pago queda como está. Con o sin factura de ARCA: la forma de pago no va en la factura electrónica. Queda
--       anotada como las de «Corregir el pago» (pos_venta_correcciones) y el permiso es el de la caja, como ahí.
--     - Las dos: sólo una venta cobrada que todavía no entró en un cierre de caja (si entró, primero se anula ese cierre,
--       y sólo se puede el último). Pide el motivo. La misma clave dos veces edita una sola vez.
--     - La edición de la X queda anotada (pos_venta_ediciones): quién, cuándo, por qué y cómo estaba antes. El ticket lo
--       muestra.
--   Cómo se lleva con el cierre: la venta sigue en su día, así que el cierre la trae editada. Si ya habían contado la caja
--   de hoy y cambió el efectivo, la base pide contar de nuevo (como con «Corregir el pago»).
--   No cambia ningún dato que ya esté. Cambia pos_venta (el ticket trae «ediciones»). Se deshace con deshacer-277.sql
--   (la función se va y el ticket vuelve a como estaba; las ediciones hechas quedan hechas y anotadas).

-- 1) Lo que queda anotado de cada edición de una X. Sin clave foránea a pos_ventas a propósito (como el 248): crearla
--    traba las ventas de todos los locales mientras corre el SQL.
CREATE TABLE IF NOT EXISTS public.pos_venta_ediciones (
  id              bigserial PRIMARY KEY,
  venta_id        uuid NOT NULL,
  fecha           timestamptz NOT NULL DEFAULT now(),
  persona         uuid,
  persona_nombre  text,
  motivo          text NOT NULL,
  antes           jsonb NOT NULL,
  despues         jsonb NOT NULL,
  clave           text UNIQUE
);
CREATE INDEX IF NOT EXISTS pos_venta_ediciones_venta ON public.pos_venta_ediciones (venta_id, fecha);
COMMENT ON TABLE public.pos_venta_ediciones IS 'SQL 277: cada «Editar» de un ticket X del POS: quién, cuándo, por qué y cómo estaba antes y cómo quedó.';
ALTER TABLE public.pos_venta_ediciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_venta_ediciones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pos_venta_ediciones_id_seq FROM PUBLIC, anon, authenticated;

-- 2) Editar un ticket. p: {venta_id, motivo, clave, pagos: [...]} y, en la X, además {vendedor, lista_id, cliente_nombre,
--    cliente_doc, cliente_condicion, cliente_email, cliente_tel, envio, observaciones, socio, items: [{codigo, descripcion,
--    talle, color, cantidad, precio}], descuentos: [{tipo: promo|manual, promo_id, descripcion, monto}]}.
CREATE OR REPLACE FUNCTION public.pos_venta_editar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_motivo  text := nullif(trim(coalesce(p->>'motivo', '')), '');
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_descs   jsonb := coalesce(p->'descuentos', '[]'::jsonb);
  v         pos_ventas;
  k         pos_cierres;
  e         pos_venta_ediciones;
  c         pos_venta_correcciones;
  x         jsonb;
  it        record;
  v_pr      record;
  m         numeric;
  n         int;
  pr        numeric;
  v_i       int;
  v_suma    numeric := 0;
  v_neto    numeric := 0;
  v_desc    numeric := 0;
  v_total   numeric;
  v_cant    int := 0;
  v_vend    text;
  v_cond    text;
  v_doc     text;
  v_socio   text;
  v_cli     v_club_clientes%rowtype;
  v_factor  jsonb;
  v_gana    int;
  v_mov     bigint;
  v_dep     uuid;
  v_ref     text;
  v_nom     text;
  v_gc      numeric;
  v_viejas  text;
  v_nuevas  text;
  v_antes   jsonb;
  v_despues jsonb;
  v_pago    forma_pago;
  v_eid     bigint;
begin
  perform pos_permiso();
  begin
    v_id := nullif(p->>'venta_id', '')::uuid;
  exception when others then
    v_id := null;
  end;

  /* La misma edición dos veces (se cortó internet y la mandaron de nuevo): no se hace otra vez. */
  if v_clave is not null then
    select * into e from pos_venta_ediciones where clave = v_clave;
    if found then return jsonb_build_object('id', e.venta_id, 'edicion', e.id, 'ya', true); end if;
    select * into c from pos_venta_correcciones where clave = v_clave;
    if found then return jsonb_build_object('id', c.venta_id, 'correccion', c.id, 'ya', true); end if;
  end if;

  select * into v from pos_ventas where id = v_id;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  /* Con la caja de esa sucursal: si justo la están cerrando, espera (y abajo ve si la venta ya entró en el cierre). */
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || v.local_id::text || ':' || v.prueba::text));
  select * into v from pos_ventas where id = v_id for update;

  if v.estado <> 'cobrada' then raise exception 'Esa venta está anulada: no se edita.'; end if;
  if v.cierre_id is not null then
    select * into k from pos_cierres where id = v.cierre_id;
    raise exception 'Esa venta ya entró en el cierre de caja % (del %): para editarla, primero hay que anular ese cierre (se puede sólo el último).',
      case when k.prueba then 'P-' else 'Nº ' end || k.numero, pos_dia_texto(k.dia);
  end if;
  if v.letra = 'X' then perform pos_permiso('anular'); else perform pos_permiso('caja'); end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'Escribí por qué se edita.'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es demasiado largo (hasta 300 letras).'; end if;
  v_nom := (select pe.nombre from orden_personas pe where pe.id = orden_yo_id());
  v_ref := case when v.serie = 'x' then 'X-' else 'Nº ' end || v.numero;   -- como lo anota la venta (stock y Club)

  /* Los pagos, en las dos. */
  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if jsonb_array_length(v_pagos) > 10 then raise exception 'Son demasiados pagos para una venta.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round(nullif(x->>'monto', '')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if x->>'medio' = 'giftcard' then
      raise exception 'La gift card no se agrega ni se cambia acá: el pago con gift card queda como está.';
    end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia') then
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if v.letra = 'X' and x->>'medio' <> 'efectivo' then
      raise exception 'La X (el comprobante interno) va sólo con efectivo. Si se cobró con otra cosa, se anula y se hace de nuevo como B.';
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
    v_suma := v_suma + m;
  end loop;

  if v.letra = 'X' then
    /* ═══ La X: todo ═══ */
    if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null) then
      raise exception 'Esta venta vendió una Gift Card: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.premio is not null) then
      raise exception 'Esta venta tiene un premio del Club: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_descuentos d where d.venta_id = v.id and d.tipo in ('cupon', 'cumple')) then
      raise exception 'Esta venta usó un cupón o el regalo de cumpleaños del Club: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'giftcard') then
      raise exception 'Esta venta se pagó con una Gift Card: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;

    v_vend  := nullif(trim(coalesce(p->>'vendedor', '')), '');
    v_cond  := coalesce(nullif(p->>'cliente_condicion', ''), 'consumidor_final');
    v_doc   := nullif(regexp_replace(coalesce(p->>'cliente_doc', ''), '[^0-9]', '', 'g'), '');
    v_socio := nullif(regexp_replace(coalesce(p->>'socio', ''), '[^0-9]', '', 'g'), '');
    if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
    if v_cond not in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento') then
      raise exception 'La condición de IVA del cliente no es válida.';
    end if;
    if v_socio is not null then
      select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
      if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
    end if;

    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La venta no tiene productos.'; end if;
    if jsonb_array_length(v_items) > 200 then raise exception 'Son demasiados renglones para una venta.'; end if;
    for x in select * from jsonb_array_elements(v_items) loop
      if nullif(x->>'giftcard', '') is not null then raise exception 'En la edición no se agregan Gift Cards: van en una venta nueva.'; end if;
      if nullif(x->>'premio', '') is not null then raise exception 'En la edición no se agregan premios del Club: van en una venta nueva.'; end if;
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
      if x->>'tipo' in ('cupon', 'cumple') then
        raise exception 'En la edición no van cupones ni el regalo de cumpleaños del Club: van en una venta nueva.';
      end if;
      if coalesce(x->>'tipo', '') not in ('promo', 'manual') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;
      v_desc := v_desc + m;
    end loop;
    if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;
    v_total := v_neto - v_desc;
    if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
    if v_suma <> v_total then
      raise exception 'Los pagos ($%) no suman el total ($%).',
        replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v_total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
    end if;

    /* Cómo estaba (lo que se anota y lo que muestra el ticket). */
    v_antes := jsonb_build_object(
      'vendedor', v.vendedor, 'lista_id', v.lista_id, 'cliente_nombre', v.cliente_nombre, 'cliente_doc', v.cliente_doc,
      'cliente_condicion', v.cliente_condicion, 'cliente_email', v.cliente_email, 'cliente_tel', v.cliente_tel, 'envio', v.envio,
      'observaciones', v.observaciones, 'socio', v.socio, 'socio_puntos', v.socio_puntos,
      'neto', v.neto, 'descuentos', v.descuentos, 'total', v.total, 'cantidad', v.cantidad,
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
      'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
      'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb));

    /* El depósito del que salió lo vendido (si sigue activo en la sucursal; si no, el predeterminado). */
    if not v.prueba then
      v_dep := (select s.deposito_id from pos_stock_movs s join pos_depositos d on d.id = s.deposito_id and d.local_id = v.local_id and d.activo
                 where s.ref_id = v.id and s.tipo = 'venta' order by s.id limit 1);
    end if;

    /* Los renglones, los descuentos y el pago, nuevos. */
    delete from pos_venta_items where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_items) loop
      v_i := v_i + 1;
      insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total)
      values (v.id, v_i, nullif(upper(trim(coalesce(x->>'codigo', ''))), ''), trim(x->>'descripcion'),
              nullif(trim(coalesce(x->>'talle', '')), ''), nullif(trim(coalesce(x->>'color', '')), ''),
              (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int);
    end loop;
    delete from pos_venta_descuentos where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_descs) loop
      v_i := v_i + 1;
      insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto)
      values (v.id, v_i, x->>'tipo', case when x->>'tipo' = 'promo' then nullif(x->>'promo_id', '')::int end,
              coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2));
    end loop;
    delete from pos_venta_pagos where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_pagos) loop
      v_i := v_i + 1;
      insert into pos_venta_pagos (venta_id, orden, medio, monto, recibido, vuelto)
      values (v.id, v_i, 'efectivo', round((x->>'monto')::numeric, 2), nullif(x->>'recibido', '')::numeric,
              case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
    end loop;

    /* El stock: sólo la diferencia entre lo que había salido y lo que sale ahora, como «venta» del mismo ticket (así,
       si después se anula, vuelve todo lo que salió). Una prueba no lo toca. */
    if not v.prueba then
      for it in
        with antes as (
          select s.codigo, s.talle, s.color, sum(s.cantidad) c
            from pos_stock_movs s where s.ref_id = v.id and s.tipo = 'venta'
           group by 1, 2, 3),
        ahora as (
          select upper(trim(i.codigo)) codigo, upper(trim(coalesce(i.talle, ''))) talle, upper(trim(coalesce(i.color, ''))) color,
                 -sum(i.cantidad)::int c, min(i.descripcion) descripcion
            from pos_venta_items i
           where i.venta_id = v.id and i.beneficio is null and nullif(trim(coalesce(i.codigo, '')), '') is not null
           group by 1, 2, 3)
        select coalesce(b.codigo, a.codigo) codigo, coalesce(b.talle, a.talle) talle, coalesce(b.color, a.color) color,
               (coalesce(b.c, 0) - coalesce(a.c, 0))::int delta, b.descripcion
          from antes a full join ahora b on b.codigo = a.codigo and b.talle = a.talle and b.color = a.color
         where coalesce(b.c, 0) <> coalesce(a.c, 0)
         order by 1, 2, 3
      loop
        perform pos_stock_mover(v.local_id, it.codigo, it.talle, it.color, it.delta, 'venta', v.id,
                                'Venta ' || v_ref || ' (editada)', it.descripcion, null, null, v_dep);
      end loop;
    end if;

    update pos_ventas
       set vendedor = v_vend, lista_id = coalesce(nullif(p->>'lista_id', '')::int, v.lista_id),
           cliente_nombre = nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), cliente_doc = v_doc, cliente_condicion = v_cond,
           cliente_email = nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), cliente_tel = nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
           envio = nullif(p->>'envio', ''), observaciones = nullif(trim(coalesce(p->>'observaciones', '')), ''), socio = v_socio,
           neto = v_neto, descuentos = v_desc, total = v_total, cantidad = v_cant
     where id = v.id;

    /* Los puntos del socio: si cambió el socio o el total, el movimiento de antes se anula y se suma el nuevo, con la misma
       cuenta que la venta (pos_venta_guardar). Si no cambió nada de eso, quedan como estaban. */
    if v_socio is distinct from v.socio or v_total <> v.total then
      if v.club_mov is not null then
        update club_movimientos
           set anulado = now(), anulado_por = coalesce(v_nom, 'POS'), motivo_anul = 'Venta ' || v_ref || ' editada en el POS: ' || v_motivo
         where id = v.club_mov and anulado is null;
      end if;
      v_gana := null;
      v_mov := null;
      if v_socio is not null then
        v_factor := club_factor(v_cli.id);
        v_gana := floor((greatest(v_total, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                        * (v_factor->>'total')::numeric);
        if not v.prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
          insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
          values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v.local_id), v_vend, 'POS ' || v_ref, greatest(v_total, 0),
                  case when (v_factor->>'extra')::numeric > 1 then
                    (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
                  end)
          returning id into v_mov;
        end if;
      end if;
      update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v.id;
    end if;

    select * into v from pos_ventas where id = v.id;
    v_despues := jsonb_build_object(
      'vendedor', v.vendedor, 'lista_id', v.lista_id, 'cliente_nombre', v.cliente_nombre, 'cliente_doc', v.cliente_doc,
      'cliente_condicion', v.cliente_condicion, 'cliente_email', v.cliente_email, 'cliente_tel', v.cliente_tel, 'envio', v.envio,
      'observaciones', v.observaciones, 'socio', v.socio, 'socio_puntos', v.socio_puntos,
      'neto', v.neto, 'descuentos', v.descuentos, 'total', v.total, 'cantidad', v.cantidad,
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
      'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
      'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb));
    if v_despues = v_antes then raise exception 'No cambiaste nada: el ticket ya está así.'; end if;

    insert into pos_venta_ediciones (venta_id, persona, persona_nombre, motivo, antes, despues, clave)
    values (v.id, orden_yo_id(), v_nom, v_motivo, v_antes, v_despues, v_clave)
    returning id into v_eid;

    return jsonb_build_object('id', v.id, 'numero', v.numero, 'serie', v.serie, 'prueba', v.prueba, 'edicion', v_eid, 'ya', false,
                              'total', v.total, 'total_antes', v_antes->'total', 'socio_puntos', v.socio_puntos,
                              'puntos_sumados', v.club_mov is not null);
  end if;

  /* ═══ La A y la B: sólo los pagos; el total no cambia ═══ */
  if jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  /* Mauricio (12/11, con la foto de «Corregir el pago»): «En B no te tiene que dejar corregir el monto… solamente la parte
     del medio de pago». Cada pago queda con su monto (los mismos montos, los mismos pagos): cambian el medio, la tarjeta,
     las cuotas sin interés y el número de operación. */
  if (select coalesce(string_agg(round(g.monto, 2)::text, ',' order by round(g.monto, 2)), '')
        from pos_venta_pagos g where g.venta_id = v.id and g.medio <> 'giftcard')
     is distinct from
     (select coalesce(string_agg(round((g->>'monto')::numeric, 2)::text, ',' order by round((g->>'monto')::numeric, 2)), '')
        from jsonb_array_elements(v_pagos) g) then
    raise exception 'En una factura cada pago queda con su monto: sólo cambian el medio, la tarjeta y las cuotas sin interés. Si un monto estaba mal, se hace una nota de crédito y la venta de nuevo.';
  end if;
  v_gc := coalesce((select sum(g.monto) from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'giftcard'), 0);
  if v_suma + v_gc <> v.total then
    if v_gc > 0 then
      raise exception 'Los pagos ($%) y la gift card ($%) no suman el total de la venta ($%). En una factura el total no cambia: si estaba mal, se hace una nota de crédito y la venta de nuevo.',
        replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v_gc, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
    end if;
    raise exception 'Los pagos ($%) no suman el total de la venta ($%). En una factura el total no cambia: si estaba mal, se hace una nota de crédito y la venta de nuevo.',
      replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
      replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
  end if;

  /* Las cuotas: con el interés de las cuotas (SQL 215), el pago en cuotas queda como está (el interés está en el total).
     Sin interés, van las cuotas sin interés de la venta: 3 desde $80.000 y 6 desde $150.000 (INTERES de pos.js), sobre
     el total del ticket. Lo que ya estaba en cuotas con su monto (la excepción sin interés) puede quedar igual. */
  select string_agg(coalesce(g.cuotas, 1) || ':' || round(g.monto, 2)::text, ',' order by coalesce(g.cuotas, 1), g.monto) into v_viejas
    from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'tarjeta' and coalesce(g.cuotas, 1) > 1;
  select string_agg(coalesce(nullif(g->>'cuotas', '')::int, 1) || ':' || round((g->>'monto')::numeric, 2)::text, ','
                    order by coalesce(nullif(g->>'cuotas', '')::int, 1), round((g->>'monto')::numeric, 2)) into v_nuevas
    from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1;
  if v_viejas is distinct from v_nuevas then
    if coalesce(v.interes, 0) > 0 then
      raise exception 'Esta venta tiene el interés de las cuotas: el pago en cuotas no se cambia (cambiaría el total de la factura). Si estaba mal, se hace una nota de crédito y la venta de nuevo.';
    end if;
    for x in select * from jsonb_array_elements(v_pagos) g
              where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1 loop
      n := coalesce(nullif(x->>'cuotas', '')::int, 1);
      if not ((n = 3 and v.total >= 80000) or (n = 6 and v.total >= 150000)
              or exists (select 1 from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'tarjeta' and g.cuotas = n
                                                           and round(g.monto, 2) = round((x->>'monto')::numeric, 2))) then
        raise exception 'En % cuotas, con $%, va con interés y el total de la factura no cambia: sin interés son 3 cuotas desde $80.000 y 6 desde $150.000.',
          n, replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
      end if;
    end loop;
  end if;

  /* La promo «pagando todo con …»: con otro medio, no va. */
  for v_pr in select pr.nombre, pr.medio from pos_venta_descuentos d join pos_promos pr on pr.id = d.promo_id
               where d.venta_id = v.id and pr.tipo = 'medio_pago' loop
    if v_gc > 0 or exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' <> v_pr.medio) then
      raise exception 'Esta venta tiene la promo «%» (pagando todo %): con otro medio, la promo no va. Si se pagó con otra cosa, se hace una nota de crédito y la venta de nuevo.',
        v_pr.nombre, case v_pr.medio when 'efectivo' then 'en efectivo' when 'tarjeta' then 'con tarjeta' when 'mercadopago' then 'con Mercado Pago'
                          when 'modo' then 'con MODO' when 'go_cuotas' then 'con Go Cuotas' when 'transferencia' then 'con transferencia' else 'con ' || v_pr.medio end;
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_antes from pos_venta_pagos g where g.venta_id = v.id;

  /* Los pagos de antes (menos la gift card) se van y entran los nuevos, después de los que quedan. */
  delete from pos_venta_pagos where venta_id = v.id and medio <> 'giftcard';
  select coalesce(max(orden), 0) into v_i from pos_venta_pagos where venta_id = v.id;
  for x in select * from jsonb_array_elements(v_pagos) loop
    v_i := v_i + 1;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto)
    values (v.id, v_i, x->>'medio', round((x->>'monto')::numeric, 2),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'tarjeta', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'tipo_tarjeta', '') end,
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            nullif(trim(coalesce(x->>'cupon', '')), ''),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'lote', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'ultimos4', '') end,
            case when x->>'medio' = 'efectivo' then nullif(x->>'recibido', '')::numeric end,
            case when x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_despues from pos_venta_pagos g where g.venta_id = v.id;
  if v_despues = v_antes then raise exception 'No cambiaste nada: los pagos ya están así.'; end if;

  /* La excepción «sin interés» (SQL 215) era de las cuotas de antes: si cambiaron, ya no va. */
  if v.sin_interes and v_viejas is distinct from v_nuevas then
    update pos_ventas set sin_interes = false, interes_nota = null where id = v.id;
  end if;

  insert into pos_venta_correcciones (venta_id, persona, persona_nombre, motivo, antes, despues, clave)
  values (v.id, orden_yo_id(), v_nom, v_motivo, v_antes, v_despues, v_clave)
  returning id into v_eid;

  /* SQL 200: la gift card que se vendió en esta venta anota cómo se pagó (la sección Gift Cards): la misma cuenta que al vender. */
  if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null) then
    if jsonb_array_length(v_pagos) = 1 then
      v_pago := (case v_pagos->0->>'medio'
                   when 'efectivo' then 'efectivo'
                   when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                   else 'otro' end)::forma_pago;
    else
      v_pago := 'otro';
    end if;
    update beneficios set pago = v_pago where id in (select i.beneficio from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null);
  end if;

  return jsonb_build_object('id', v.id, 'numero', v.numero, 'serie', v.serie, 'prueba', v.prueba, 'correccion', v_eid, 'ya', false,
                            'total', v.total, 'pagos', v_despues);
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_editar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_editar(jsonb) TO authenticated;

-- 3) El ticket trae las ediciones (de la más vieja a la última), con cómo estaba antes. Todo lo demás, igual.
CREATE OR REPLACE FUNCTION public.pos_venta(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
              'puntos_sumados', exists (select 1 from club_movimientos m where m.id = v.club_mov and m.anulado is null),
              /* SQL 205: la nota de crédito que la anuló (con quién la hizo) y el cierre de caja en el que entró. */
              'nota_credito', (select to_jsonb(n) || jsonb_build_object('hizo_nombre', (select p.nombre from orden_personas p where p.id = n.hizo))
                                 from pos_notas_credito n where n.venta_id = v.id),
              'cierre', (select jsonb_build_object('id', k.id, 'numero', k.numero, 'prueba', k.prueba, 'estado', k.estado)
                           from pos_cierres k where k.id = v.cierre_id),
              /* SQL 248: las correcciones del medio de pago, de la más vieja a la última; y la promo «pagando todo con …». */
              'correcciones', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.fecha, 'persona', c.persona_nombre,
                                                                            'motivo', c.motivo, 'antes', c.antes) order by c.fecha, c.id)
                                          from pos_venta_correcciones c where c.venta_id = v.id), '[]'::jsonb),
              'promo_medio', (select pr.medio from pos_venta_descuentos d join pos_promos pr on pr.id = d.promo_id
                               where d.venta_id = v.id and pr.tipo = 'medio_pago' limit 1),
              /* SQL 277: las ediciones de la X, de la más vieja a la última, con cómo estaba antes. */
              'ediciones', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'fecha', e.fecha, 'persona', e.persona_nombre,
                                                                         'motivo', e.motivo, 'antes', e.antes) order by e.fecha, e.id)
                                       from pos_venta_ediciones e where e.venta_id = v.id), '[]'::jsonb))
    into r
    from pos_ventas v join orden_locales l on l.id = v.local_id
   where v.id = p_id;
  if r is null then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);   -- SQL 190
  return r;
end $function$;

NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 280 (12/11/2026): EDITAR EL PAGO, 3, 6 Y 12 CUOTAS SIEMPRE (App Orden: correr-en-supabase-280.sql)
-- ═══════════════════════════════════════════════════════════════════════════
-- SQL 280 (12/11/2026): en «Editar el pago» de una factura, 3, 6 y 12 cuotas siempre.
--   Pedido de Mauricio (12/11, probando el SQL 277 con una B de $65.000): «las cuotas me dejan sólo poner una, claro,
--   porque es un monto de menos de 80. Pero a veces puede pasar que cobramos en tres cuotas y es menos de 80. Tenemos
--   esa opción también. Así que pongan la opción de 3 y 6 en la edición: 3, 6 y 12 cuotas.»
--   Qué cambia (sólo la función pos_venta_editar, en la parte de la A y la B):
--     - Antes, las cuotas que por la regla llevan interés se rechazaban («En 3 cuotas, con $65.000, va con interés…»).
--       Ahora se aceptan y la venta queda con la excepción «sin interés» (la misma marca y la misma nota que pone la
--       venta cuando le sacan el tilde al interés: «3 cuotas sin interés: excepción (con menos de $80.000 lleva 8 %)»).
--       El ticket la muestra. La regla: 3 con menos de $80.000, 6 con menos de $150.000 y 12 siempre.
--     - El total de la factura no cambia y los montos tampoco (como en el 277).
--     - Si la venta ya tiene el interés de las cuotas cobrado, ese pago sigue sin poder cambiarse.
--     - La pantalla le pregunta a la función si ya sabe esto ({"que":"version"} → {"sql":280}); no toca nada.
--   No cambia ningún dato ni ninguna otra función. Se deshace con deshacer-280.sql (vuelve la función del 277).

CREATE OR REPLACE FUNCTION public.pos_venta_editar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_motivo  text := nullif(trim(coalesce(p->>'motivo', '')), '');
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_descs   jsonb := coalesce(p->'descuentos', '[]'::jsonb);
  v         pos_ventas;
  k         pos_cierres;
  e         pos_venta_ediciones;
  c         pos_venta_correcciones;
  x         jsonb;
  it        record;
  v_pr      record;
  m         numeric;
  n         int;
  pr        numeric;
  v_i       int;
  v_suma    numeric := 0;
  v_neto    numeric := 0;
  v_desc    numeric := 0;
  v_total   numeric;
  v_cant    int := 0;
  v_vend    text;
  v_cond    text;
  v_doc     text;
  v_socio   text;
  v_cli     v_club_clientes%rowtype;
  v_factor  jsonb;
  v_gana    int;
  v_mov     bigint;
  v_dep     uuid;
  v_ref     text;
  v_nom     text;
  v_gc      numeric;
  v_viejas  text;
  v_nuevas  text;
  v_nota    text;   -- SQL 280: la excepción «sin interés» de las cuotas nuevas
  v_antes   jsonb;
  v_despues jsonb;
  v_pago    forma_pago;
  v_eid     bigint;
begin
  perform pos_permiso();
  /* SQL 280: la pantalla pregunta qué sabe hacer la base (no toca nada). */
  if p->>'que' = 'version' then return jsonb_build_object('sql', 280); end if;
  begin
    v_id := nullif(p->>'venta_id', '')::uuid;
  exception when others then
    v_id := null;
  end;

  /* La misma edición dos veces (se cortó internet y la mandaron de nuevo): no se hace otra vez. */
  if v_clave is not null then
    select * into e from pos_venta_ediciones where clave = v_clave;
    if found then return jsonb_build_object('id', e.venta_id, 'edicion', e.id, 'ya', true); end if;
    select * into c from pos_venta_correcciones where clave = v_clave;
    if found then return jsonb_build_object('id', c.venta_id, 'correccion', c.id, 'ya', true); end if;
  end if;

  select * into v from pos_ventas where id = v_id;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  /* Con la caja de esa sucursal: si justo la están cerrando, espera (y abajo ve si la venta ya entró en el cierre). */
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || v.local_id::text || ':' || v.prueba::text));
  select * into v from pos_ventas where id = v_id for update;

  if v.estado <> 'cobrada' then raise exception 'Esa venta está anulada: no se edita.'; end if;
  if v.cierre_id is not null then
    select * into k from pos_cierres where id = v.cierre_id;
    raise exception 'Esa venta ya entró en el cierre de caja % (del %): para editarla, primero hay que anular ese cierre (se puede sólo el último).',
      case when k.prueba then 'P-' else 'Nº ' end || k.numero, pos_dia_texto(k.dia);
  end if;
  if v.letra = 'X' then perform pos_permiso('anular'); else perform pos_permiso('caja'); end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'Escribí por qué se edita.'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es demasiado largo (hasta 300 letras).'; end if;
  v_nom := (select pe.nombre from orden_personas pe where pe.id = orden_yo_id());
  v_ref := case when v.serie = 'x' then 'X-' else 'Nº ' end || v.numero;   -- como lo anota la venta (stock y Club)

  /* Los pagos, en las dos. */
  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if jsonb_array_length(v_pagos) > 10 then raise exception 'Son demasiados pagos para una venta.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round(nullif(x->>'monto', '')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if x->>'medio' = 'giftcard' then
      raise exception 'La gift card no se agrega ni se cambia acá: el pago con gift card queda como está.';
    end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia') then
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if v.letra = 'X' and x->>'medio' <> 'efectivo' then
      raise exception 'La X (el comprobante interno) va sólo con efectivo. Si se cobró con otra cosa, se anula y se hace de nuevo como B.';
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
    v_suma := v_suma + m;
  end loop;

  if v.letra = 'X' then
    /* ═══ La X: todo ═══ */
    if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null) then
      raise exception 'Esta venta vendió una Gift Card: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.premio is not null) then
      raise exception 'Esta venta tiene un premio del Club: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_descuentos d where d.venta_id = v.id and d.tipo in ('cupon', 'cumple')) then
      raise exception 'Esta venta usó un cupón o el regalo de cumpleaños del Club: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;
    if exists (select 1 from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'giftcard') then
      raise exception 'Esta venta se pagó con una Gift Card: no se edita. Si está mal, se anula y se hace de nuevo.';
    end if;

    v_vend  := nullif(trim(coalesce(p->>'vendedor', '')), '');
    v_cond  := coalesce(nullif(p->>'cliente_condicion', ''), 'consumidor_final');
    v_doc   := nullif(regexp_replace(coalesce(p->>'cliente_doc', ''), '[^0-9]', '', 'g'), '');
    v_socio := nullif(regexp_replace(coalesce(p->>'socio', ''), '[^0-9]', '', 'g'), '');
    if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
    if v_cond not in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento') then
      raise exception 'La condición de IVA del cliente no es válida.';
    end if;
    if v_socio is not null then
      select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
      if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
    end if;

    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La venta no tiene productos.'; end if;
    if jsonb_array_length(v_items) > 200 then raise exception 'Son demasiados renglones para una venta.'; end if;
    for x in select * from jsonb_array_elements(v_items) loop
      if nullif(x->>'giftcard', '') is not null then raise exception 'En la edición no se agregan Gift Cards: van en una venta nueva.'; end if;
      if nullif(x->>'premio', '') is not null then raise exception 'En la edición no se agregan premios del Club: van en una venta nueva.'; end if;
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
      if x->>'tipo' in ('cupon', 'cumple') then
        raise exception 'En la edición no van cupones ni el regalo de cumpleaños del Club: van en una venta nueva.';
      end if;
      if coalesce(x->>'tipo', '') not in ('promo', 'manual') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;
      v_desc := v_desc + m;
    end loop;
    if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;
    v_total := v_neto - v_desc;
    if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
    if v_suma <> v_total then
      raise exception 'Los pagos ($%) no suman el total ($%).',
        replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v_total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
    end if;

    /* Cómo estaba (lo que se anota y lo que muestra el ticket). */
    v_antes := jsonb_build_object(
      'vendedor', v.vendedor, 'lista_id', v.lista_id, 'cliente_nombre', v.cliente_nombre, 'cliente_doc', v.cliente_doc,
      'cliente_condicion', v.cliente_condicion, 'cliente_email', v.cliente_email, 'cliente_tel', v.cliente_tel, 'envio', v.envio,
      'observaciones', v.observaciones, 'socio', v.socio, 'socio_puntos', v.socio_puntos,
      'neto', v.neto, 'descuentos', v.descuentos, 'total', v.total, 'cantidad', v.cantidad,
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
      'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
      'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb));

    /* El depósito del que salió lo vendido (si sigue activo en la sucursal; si no, el predeterminado). */
    if not v.prueba then
      v_dep := (select s.deposito_id from pos_stock_movs s join pos_depositos d on d.id = s.deposito_id and d.local_id = v.local_id and d.activo
                 where s.ref_id = v.id and s.tipo = 'venta' order by s.id limit 1);
    end if;

    /* Los renglones, los descuentos y el pago, nuevos. */
    delete from pos_venta_items where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_items) loop
      v_i := v_i + 1;
      insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total)
      values (v.id, v_i, nullif(upper(trim(coalesce(x->>'codigo', ''))), ''), trim(x->>'descripcion'),
              nullif(trim(coalesce(x->>'talle', '')), ''), nullif(trim(coalesce(x->>'color', '')), ''),
              (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int);
    end loop;
    delete from pos_venta_descuentos where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_descs) loop
      v_i := v_i + 1;
      insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto)
      values (v.id, v_i, x->>'tipo', case when x->>'tipo' = 'promo' then nullif(x->>'promo_id', '')::int end,
              coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2));
    end loop;
    delete from pos_venta_pagos where venta_id = v.id;
    v_i := 0;
    for x in select * from jsonb_array_elements(v_pagos) loop
      v_i := v_i + 1;
      insert into pos_venta_pagos (venta_id, orden, medio, monto, recibido, vuelto)
      values (v.id, v_i, 'efectivo', round((x->>'monto')::numeric, 2), nullif(x->>'recibido', '')::numeric,
              case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
    end loop;

    /* El stock: sólo la diferencia entre lo que había salido y lo que sale ahora, como «venta» del mismo ticket (así,
       si después se anula, vuelve todo lo que salió). Una prueba no lo toca. */
    if not v.prueba then
      for it in
        with antes as (
          select s.codigo, s.talle, s.color, sum(s.cantidad) c
            from pos_stock_movs s where s.ref_id = v.id and s.tipo = 'venta'
           group by 1, 2, 3),
        ahora as (
          select upper(trim(i.codigo)) codigo, upper(trim(coalesce(i.talle, ''))) talle, upper(trim(coalesce(i.color, ''))) color,
                 -sum(i.cantidad)::int c, min(i.descripcion) descripcion
            from pos_venta_items i
           where i.venta_id = v.id and i.beneficio is null and nullif(trim(coalesce(i.codigo, '')), '') is not null
           group by 1, 2, 3)
        select coalesce(b.codigo, a.codigo) codigo, coalesce(b.talle, a.talle) talle, coalesce(b.color, a.color) color,
               (coalesce(b.c, 0) - coalesce(a.c, 0))::int delta, b.descripcion
          from antes a full join ahora b on b.codigo = a.codigo and b.talle = a.talle and b.color = a.color
         where coalesce(b.c, 0) <> coalesce(a.c, 0)
         order by 1, 2, 3
      loop
        perform pos_stock_mover(v.local_id, it.codigo, it.talle, it.color, it.delta, 'venta', v.id,
                                'Venta ' || v_ref || ' (editada)', it.descripcion, null, null, v_dep);
      end loop;
    end if;

    update pos_ventas
       set vendedor = v_vend, lista_id = coalesce(nullif(p->>'lista_id', '')::int, v.lista_id),
           cliente_nombre = nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), cliente_doc = v_doc, cliente_condicion = v_cond,
           cliente_email = nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), cliente_tel = nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
           envio = nullif(p->>'envio', ''), observaciones = nullif(trim(coalesce(p->>'observaciones', '')), ''), socio = v_socio,
           neto = v_neto, descuentos = v_desc, total = v_total, cantidad = v_cant
     where id = v.id;

    /* Los puntos del socio: si cambió el socio o el total, el movimiento de antes se anula y se suma el nuevo, con la misma
       cuenta que la venta (pos_venta_guardar). Si no cambió nada de eso, quedan como estaban. */
    if v_socio is distinct from v.socio or v_total <> v.total then
      if v.club_mov is not null then
        update club_movimientos
           set anulado = now(), anulado_por = coalesce(v_nom, 'POS'), motivo_anul = 'Venta ' || v_ref || ' editada en el POS: ' || v_motivo
         where id = v.club_mov and anulado is null;
      end if;
      v_gana := null;
      v_mov := null;
      if v_socio is not null then
        v_factor := club_factor(v_cli.id);
        v_gana := floor((greatest(v_total, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                        * (v_factor->>'total')::numeric);
        if not v.prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
          insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
          values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v.local_id), v_vend, 'POS ' || v_ref, greatest(v_total, 0),
                  case when (v_factor->>'extra')::numeric > 1 then
                    (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
                  end)
          returning id into v_mov;
        end if;
      end if;
      update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v.id;
    end if;

    select * into v from pos_ventas where id = v.id;
    v_despues := jsonb_build_object(
      'vendedor', v.vendedor, 'lista_id', v.lista_id, 'cliente_nombre', v.cliente_nombre, 'cliente_doc', v.cliente_doc,
      'cliente_condicion', v.cliente_condicion, 'cliente_email', v.cliente_email, 'cliente_tel', v.cliente_tel, 'envio', v.envio,
      'observaciones', v.observaciones, 'socio', v.socio, 'socio_puntos', v.socio_puntos,
      'neto', v.neto, 'descuentos', v.descuentos, 'total', v.total, 'cantidad', v.cantidad,
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
      'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
      'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb));
    if v_despues = v_antes then raise exception 'No cambiaste nada: el ticket ya está así.'; end if;

    insert into pos_venta_ediciones (venta_id, persona, persona_nombre, motivo, antes, despues, clave)
    values (v.id, orden_yo_id(), v_nom, v_motivo, v_antes, v_despues, v_clave)
    returning id into v_eid;

    return jsonb_build_object('id', v.id, 'numero', v.numero, 'serie', v.serie, 'prueba', v.prueba, 'edicion', v_eid, 'ya', false,
                              'total', v.total, 'total_antes', v_antes->'total', 'socio_puntos', v.socio_puntos,
                              'puntos_sumados', v.club_mov is not null);
  end if;

  /* ═══ La A y la B: sólo los pagos; el total no cambia ═══ */
  if jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  /* Mauricio (12/11, con la foto de «Corregir el pago»): «En B no te tiene que dejar corregir el monto… solamente la parte
     del medio de pago». Cada pago queda con su monto (los mismos montos, los mismos pagos): cambian el medio, la tarjeta,
     las cuotas sin interés y el número de operación. */
  if (select coalesce(string_agg(round(g.monto, 2)::text, ',' order by round(g.monto, 2)), '')
        from pos_venta_pagos g where g.venta_id = v.id and g.medio <> 'giftcard')
     is distinct from
     (select coalesce(string_agg(round((g->>'monto')::numeric, 2)::text, ',' order by round((g->>'monto')::numeric, 2)), '')
        from jsonb_array_elements(v_pagos) g) then
    raise exception 'En una factura cada pago queda con su monto: sólo cambian el medio, la tarjeta y las cuotas sin interés. Si un monto estaba mal, se hace una nota de crédito y la venta de nuevo.';
  end if;
  v_gc := coalesce((select sum(g.monto) from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'giftcard'), 0);
  if v_suma + v_gc <> v.total then
    if v_gc > 0 then
      raise exception 'Los pagos ($%) y la gift card ($%) no suman el total de la venta ($%). En una factura el total no cambia: si estaba mal, se hace una nota de crédito y la venta de nuevo.',
        replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v_gc, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
    end if;
    raise exception 'Los pagos ($%) no suman el total de la venta ($%). En una factura el total no cambia: si estaba mal, se hace una nota de crédito y la venta de nuevo.',
      replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
      replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
  end if;

  /* Las cuotas: con el interés de las cuotas (SQL 215), el pago en cuotas queda como está (el interés está en el total).
     Sin interés, van las cuotas sin interés de la venta: 3 desde $80.000 y 6 desde $150.000 (INTERES de pos.js), sobre
     el total del ticket. Lo que ya estaba en cuotas con su monto (la excepción sin interés) puede quedar igual. */
  select string_agg(coalesce(g.cuotas, 1) || ':' || round(g.monto, 2)::text, ',' order by coalesce(g.cuotas, 1), g.monto) into v_viejas
    from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'tarjeta' and coalesce(g.cuotas, 1) > 1;
  select string_agg(coalesce(nullif(g->>'cuotas', '')::int, 1) || ':' || round((g->>'monto')::numeric, 2)::text, ','
                    order by coalesce(nullif(g->>'cuotas', '')::int, 1), round((g->>'monto')::numeric, 2)) into v_nuevas
    from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1;
  if v_viejas is distinct from v_nuevas then
    if coalesce(v.interes, 0) > 0 then
      raise exception 'Esta venta tiene el interés de las cuotas: el pago en cuotas no se cambia (cambiaría el total de la factura). Si estaba mal, se hace una nota de crédito y la venta de nuevo.';
    end if;
    /* SQL 280 (Mauricio, 12/11: «a veces cobramos en tres cuotas y es menos de 80… pongan la opción de 3, 6 y 12
       cuotas»): se puede cualquier cuota. Las que por la regla de la venta llevarían interés (3 con menos de $80.000,
       6 con menos de $150.000 y 12 siempre: INTERES de pos.js) quedan como la excepción «sin interés» (SQL 215), con
       la misma nota que pone la venta cuando le sacan el tilde. El total de la factura no cambia. */
    select string_agg(t.nota, ' · ' order by t.orden) into v_nota
      from (select case q.n when 3 then '3 cuotas sin interés: excepción (con menos de $80.000 lleva 8 %)'
                            when 6 then '6 cuotas sin interés: excepción (con menos de $150.000 lleva 17 %)'
                            else '12 cuotas sin interés: excepción (lleva 25 %)' end nota, min(q.orden) orden
              from (select coalesce(nullif(g.value->>'cuotas', '')::int, 1) n, g.ordinality orden
                      from jsonb_array_elements(v_pagos) with ordinality g
                     where g.value->>'medio' = 'tarjeta') q
             where (q.n = 3 and v.total < 80000) or (q.n = 6 and v.total < 150000) or q.n = 12
             group by q.n) t;
  end if;

  /* La promo «pagando todo con …»: con otro medio, no va. */
  for v_pr in select pr.nombre, pr.medio from pos_venta_descuentos d join pos_promos pr on pr.id = d.promo_id
               where d.venta_id = v.id and pr.tipo = 'medio_pago' loop
    if v_gc > 0 or exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' <> v_pr.medio) then
      raise exception 'Esta venta tiene la promo «%» (pagando todo %): con otro medio, la promo no va. Si se pagó con otra cosa, se hace una nota de crédito y la venta de nuevo.',
        v_pr.nombre, case v_pr.medio when 'efectivo' then 'en efectivo' when 'tarjeta' then 'con tarjeta' when 'mercadopago' then 'con Mercado Pago'
                          when 'modo' then 'con MODO' when 'go_cuotas' then 'con Go Cuotas' when 'transferencia' then 'con transferencia' else 'con ' || v_pr.medio end;
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_antes from pos_venta_pagos g where g.venta_id = v.id;

  /* Los pagos de antes (menos la gift card) se van y entran los nuevos, después de los que quedan. */
  delete from pos_venta_pagos where venta_id = v.id and medio <> 'giftcard';
  select coalesce(max(orden), 0) into v_i from pos_venta_pagos where venta_id = v.id;
  for x in select * from jsonb_array_elements(v_pagos) loop
    v_i := v_i + 1;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto)
    values (v.id, v_i, x->>'medio', round((x->>'monto')::numeric, 2),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'tarjeta', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'tipo_tarjeta', '') end,
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            nullif(trim(coalesce(x->>'cupon', '')), ''),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'lote', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'ultimos4', '') end,
            case when x->>'medio' = 'efectivo' then nullif(x->>'recibido', '')::numeric end,
            case when x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_despues from pos_venta_pagos g where g.venta_id = v.id;
  if v_despues = v_antes then raise exception 'No cambiaste nada: los pagos ya están así.'; end if;

  /* La excepción «sin interés» (SQL 215) era de las cuotas de antes: si cambiaron, queda la de las nuevas (SQL 280) o ninguna. */
  if v_viejas is distinct from v_nuevas and (v.sin_interes or v_nota is not null) then
    update pos_ventas set sin_interes = (v_nota is not null), interes_nota = v_nota where id = v.id;
  end if;

  insert into pos_venta_correcciones (venta_id, persona, persona_nombre, motivo, antes, despues, clave)
  values (v.id, orden_yo_id(), v_nom, v_motivo, v_antes, v_despues, v_clave)
  returning id into v_eid;

  /* SQL 200: la gift card que se vendió en esta venta anota cómo se pagó (la sección Gift Cards): la misma cuenta que al vender. */
  if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null) then
    if jsonb_array_length(v_pagos) = 1 then
      v_pago := (case v_pagos->0->>'medio'
                   when 'efectivo' then 'efectivo'
                   when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                   else 'otro' end)::forma_pago;
    else
      v_pago := 'otro';
    end if;
    update beneficios set pago = v_pago where id in (select i.beneficio from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null);
  end if;

  return jsonb_build_object('id', v.id, 'numero', v.numero, 'serie', v.serie, 'prueba', v.prueba, 'correccion', v_eid, 'ya', false,
                            'total', v.total, 'pagos', v_despues, 'interes_nota', v_nota);   -- SQL 280
end $function$;

NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 281 (12/11/2026): LA FACTURA POR MAIL (App Orden: correr-en-supabase-281.sql)
-- ═══════════════════════════════════════════════════════════════════════════
-- SQL 281 (12/11/2026): mandar la factura por mail desde el ticket del POS.
--   Pedido de Mauricio (12/11, con la foto del Ticket B-00000002 de Rivadavia): «No le mandé el ticket, me olvidé.
--   Estaría bueno que haya la opción de mandarlo. Pongamos el mail y se mande.» En los locales no hay impresora: la
--   factura se le entrega al cliente por mail, como hace BlueSoft.
--   Cómo es:
--     - En el ticket con factura electrónica (A o B, con su CAE) aparece «Mandar por mail»: se escribe el mail (viene
--       cargado si el cliente lo tiene) y sale la factura en PDF, la misma hoja de «Exportar PDF».
--     - El mail lo arma y lo manda el servidor (la función «mail»), desde la casilla del sistema. La base sólo dice si
--       se puede (pos_venta_mail_preparar) y anota cada envío (pos_venta_mail_anotar).
--     - Queda anotado a quién se mandó, cuándo y quién lo mandó (pos_venta_mails): el ticket lo muestra, y se puede
--       mandar de nuevo. Si un envío falla, también queda anotado, con el porqué (no se muestra: es para revisar).
--     - Lo puede mandar quien puede ver ese ticket (el permiso del POS y que sea de un local suyo).
--     - Dos frenos: el mismo mail a la misma dirección, una vez por minuto (los dos clics seguidos); y 400 mails por
--       día entre todos los locales (la casilla de Gmail deja unos 500 por día).
--   No cambia ningún dato que ya esté ni ninguna función que ya exista: son una tabla y tres funciones nuevas. Con este
--   SQL corrido, el botón aparece solo en el ticket. Se deshace con deshacer-281.sql.

-- 1) Cada mail que se mandó (o que se quiso mandar y falló). Sin clave foránea a pos_ventas a propósito (como el 248 y
--    el 277): crearla traba las ventas de todos los locales mientras corre el SQL.
CREATE TABLE IF NOT EXISTS public.pos_venta_mails (
  id              bigserial PRIMARY KEY,
  venta_id        uuid NOT NULL,
  fecha           timestamptz NOT NULL DEFAULT now(),
  mail            text NOT NULL,
  comprobante     text,
  persona         uuid,
  persona_nombre  text,
  estado          text NOT NULL DEFAULT 'enviado' CHECK (estado IN ('enviado', 'fallo')),
  error           text
);
CREATE INDEX IF NOT EXISTS pos_venta_mails_venta ON public.pos_venta_mails (venta_id, fecha);
CREATE INDEX IF NOT EXISTS pos_venta_mails_fecha ON public.pos_venta_mails (fecha);
COMMENT ON TABLE public.pos_venta_mails IS 'SQL 281: cada factura del POS que se mandó por mail: a quién, cuándo, quién la mandó y, si falló, por qué.';
ALTER TABLE public.pos_venta_mails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_venta_mails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pos_venta_mails_id_seq FROM PUBLIC, anon, authenticated;

-- 2) ¿Se puede mandar? Lo pregunta el servidor con la sesión de la persona, antes de armar el mail. Devuelve la venta
--    entera (lo mismo que ve el ticket: con eso se arma el PDF) y quién la manda.
CREATE OR REPLACE FUNCTION public.pos_venta_mail_preparar(p_venta uuid, p_mail text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t      jsonb;
  v_mail text := lower(trim(coalesce(p_mail, '')));
  v_hoy  int;
begin
  t := pos_venta(p_venta);   -- mira el permiso del POS y que la venta sea de un local de la persona
  if coalesce(t->'factura'->>'cae', '') = '' then
    raise exception 'Esta venta no tiene factura electrónica: no hay nada para mandar.';
  end if;
  /* Sólo letras sin acento, números y . _ % + - : lo que entiende cualquier servidor de mails. */
  if length(v_mail) > 120 or v_mail !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'El mail no está bien escrito.';
  end if;
  /* Los dos clics seguidos: la misma factura a la misma dirección, una vez por minuto. */
  if exists (select 1 from pos_venta_mails m
              where m.venta_id = p_venta and m.mail = v_mail and m.estado = 'enviado' and m.fecha > now() - interval '1 minute') then
    raise exception 'Esa factura se le acaba de mandar a %. Si no le llegó, que mire en «Spam». En un minuto se puede mandar de nuevo.', v_mail;
  end if;
  /* El tope de la casilla: Gmail deja unos 500 por día. Se frena antes, en 400 (el día es el de Argentina). */
  select count(*) into v_hoy from pos_venta_mails m
   where m.estado = 'enviado' and m.fecha >= (pos_hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires');
  if v_hoy >= 400 then
    raise exception 'Hoy ya salieron % mails y la casilla tiene un tope por día. Mañana se puede de nuevo.', v_hoy;
  end if;
  return jsonb_build_object('venta', t, 'mail', v_mail, 'persona', orden_yo_id(),
                            'persona_nombre', (select p.nombre from orden_personas p where p.id = orden_yo_id()));
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_mail_preparar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_mail_preparar(uuid, text) TO authenticated;

-- 3) Anotar el envío (o que falló). Sólo el servidor, después de entregarle el mail a la casilla.
CREATE OR REPLACE FUNCTION public.pos_venta_mail_anotar(p_venta uuid, p_mail text, p_persona uuid, p_estado text, p_error text, p_comprobante text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r pos_venta_mails;
begin
  if not exists (select 1 from pos_ventas v where v.id = p_venta) then raise exception 'No existe esa venta.'; end if;
  if p_estado is null or p_estado not in ('enviado', 'fallo') then raise exception 'El estado es «enviado» o «fallo».'; end if;
  if nullif(trim(coalesce(p_mail, '')), '') is null then raise exception 'Falta el mail.'; end if;
  insert into pos_venta_mails (venta_id, mail, comprobante, persona, persona_nombre, estado, error)
  values (p_venta, lower(trim(p_mail)), nullif(trim(coalesce(p_comprobante, '')), ''), p_persona,
          (select p.nombre from orden_personas p where p.id = p_persona), p_estado, nullif(left(trim(coalesce(p_error, '')), 500), ''))
  returning * into r;
  return jsonb_build_object('id', r.id, 'fecha', r.fecha, 'mail', r.mail, 'persona', r.persona_nombre, 'estado', r.estado);
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_mail_anotar(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_venta_mail_anotar(uuid, text, uuid, text, text, text) TO service_role;

-- 4) Lo que muestra el ticket: a quién se le mandó, cuándo y quién, del más viejo al último. Sólo los que salieron.
CREATE OR REPLACE FUNCTION public.pos_venta_mails_lista(p_venta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_local uuid;
begin
  perform pos_permiso();
  select v.local_id into v_local from pos_ventas v where v.id = p_venta;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v_local);   -- SQL 190
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'mail', m.mail, 'persona', m.persona_nombre) order by m.fecha, m.id)
                     from pos_venta_mails m where m.venta_id = p_venta and m.estado = 'enviado'), '[]'::jsonb);
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_mails_lista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_mails_lista(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
--  SQL 282 (12/11/2026): LA VENTA QUE SE PAGA CON UNA GIFT CARD PUEDE IR EN X (App Orden: correr-en-supabase-282.sql)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- ═══ SQL 282 · La venta que se paga con una Gift Card puede ir en X (12/11/2026) ═══
-- Pedido de Mauricio (12/11, hablando de ARCA): «No se tendría que facturar dos veces; eso debería facturarse cuando
-- vendés la gift card… Cuando te devuelven la gift card eso tendría que ir en X». Y: «Si es múltiple la venta y hace una
-- parte en tarjeta… Mercado Pago, Go cuotas… ahí es B. Por más que te haya pagado 10 pesos en tarjeta y el 90 % en
-- efectivo, tiene que ser B».
--
-- Qué hace: cambia UN renglón de pos_venta_guardar. Hasta hoy la X (el comprobante interno, que no va a ARCA) se guardaba
-- sólo si todo se pagaba en efectivo. Ahora también si se paga con una Gift Card, o con Gift Card y efectivo. Con una
-- parte en tarjeta, Mercado Pago, MODO, Go Cuotas o transferencia sigue sin dejar: esa venta es Factura B (o A).
--
-- No cambia ninguna tabla ni ningún dato, y no cambia nada más de la función (se arma con la función como está hoy en la
-- base). El POS viejo no manda nunca una X con Gift Card, así que se puede correr antes de publicar el POS nuevo.
-- Se puede correr más de una vez. Se deshace con deshacer-282.sql. Corre entero o nada.

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
  /* SQL 215: el interés de las cuotas (lo calcula la pantalla) y la excepción sin interés. */
  v_interes numeric := round(coalesce(nullif(p->>'interes', '')::numeric, 0), 2);
  v_intnota text := nullif(trim(coalesce(p->>'interes_nota', '')), '');
  v_sinint  boolean := coalesce(nullif(p->>'sin_interes', '')::boolean, false);
  v_dep     uuid;             -- SQL 252: el depósito del que sale lo vendido (sin elegir: el predeterminado)
  /* SQL 264: la gift card con su vencimiento (30, 60, 90 días o un año) y como artículo del stock. */
  v_dias    int;
  v_dep_gc  uuid;             -- el depósito donde están las tarjetas (el que más tiene); si no hay, el de la venta
  v_gc_col  text;
  /* SQL 265: el Club en la venta: el cupón, el regalo de cumpleaños y los premios (lo que antes se hacía en Cobrar). */
  v_base    numeric := 0;     -- las prendas después de las promos y los descuentos a mano: sobre esto van el cupón y el cumple
  v_otros   int := 0;         -- cuántos descuentos no son del Club (promos y a mano)
  v_otros_m numeric := 0;
  v_cupx    jsonb;            -- el descuento del cupón, como llegó
  v_cup     v_beneficios%rowtype;
  v_cup_m   numeric := 0;
  v_cumx    jsonb;            -- el del regalo de cumpleaños
  v_cumr    jsonb;
  v_cum_m   numeric := 0;
  v_prem    club_premios%rowtype;
  v_ptsprem int := 0;         -- los puntos de los premios que se lleva
  v_cj      jsonb;
  v_tel     text;
  v_uso     bigint;
  v_cmov    bigint;
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

  /* SQL 171: el socio del Club (el número de su tarjeta), si lo eligieron. */
  if v_socio is not null then
    select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
    if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  /* SQL 252: el depósito que eligieron en la venta, de la sucursal y activo. Sin elegir, el predeterminado (como
     antes). La venta hecha sin internet que llega cuando ese depósito ya no está sale del predeterminado: la venta
     ya se hizo y no se puede rechazar por eso. */
  begin
    v_dep := nullif(p->>'deposito_id', '')::uuid;
  exception when others then
    raise exception 'El depósito de la venta no es válido.';
  end;
  if v_dep is not null and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local and activo) then
    if v_hecha is null then raise exception 'Ese depósito no es de la sucursal o está dado de baja: elegí otro.'; end if;
    v_dep := null;
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
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      /* SQL 264: el vencimiento, de los de Gift Cards (sin decir, 30 días como antes). */
      if coalesce(nullif(x->>'vence_dias', '')::int, 30) not in (30, 60, 90, 365) then
        raise exception 'La Gift Card vence a los 30, 60 o 90 días, o al año.';
      end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
    /* SQL 265: el premio del Club: la prenda (o algo sin código) que se lleva a $ 0 con los puntos del socio, de a una. */
    if nullif(x->>'premio', '') is not null then
      if v_socio is null then raise exception 'El premio del Club va con el socio: elegilo en «Socio».'; end if;
      if nullif(x->>'giftcard', '') is not null then raise exception 'Una Gift Card no puede ser un premio del Club.'; end if;
      if n <> 1 or pr <> 0 then raise exception 'El premio del Club va de a uno y a $ 0.'; end if;
      select * into v_prem from club_premios where id = (x->>'premio')::smallint and activo;
      if not found then raise exception 'Ese premio del Club ya no está.'; end if;
      v_ptsprem := v_ptsprem + v_prem.puntos;
    end if;
    v_neto := v_neto + pr * n;
    v_cant := v_cant + n;
  end loop;

  if jsonb_typeof(v_descs) <> 'array' then raise exception 'Los descuentos no son válidos.'; end if;
  for x in select * from jsonb_array_elements(v_descs) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un descuento que no es válido.'; end if;
    if coalesce(x->>'tipo', '') not in ('promo', 'manual', 'cupon', 'cumple') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;   -- SQL 265: cupon y cumple
    /* SQL 265: un cupón y un regalo de cumpleaños por venta, como mucho. */
    if x->>'tipo' = 'cupon' then
      if v_cupx is not null then raise exception 'Va un solo cupón por venta.'; end if;
      v_cupx := x;
      v_cup_m := m;
    elsif x->>'tipo' = 'cumple' then
      if v_cumx is not null then raise exception 'El regalo de cumpleaños va una sola vez.'; end if;
      v_cumx := x;
      v_cum_m := m;
    else
      v_otros := v_otros + 1;
      v_otros_m := v_otros_m + m;
    end if;
    v_desc := v_desc + m;
  end loop;
  if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;

  /* SQL 265: el Club en la venta, con las mismas reglas que Cobrar. El cupón y el regalo de cumpleaños van sobre las
     prendas después de las promos y los descuentos a mano (primero el cupón; el cumple, sobre lo que queda). Los
     premios, con los puntos que el socio ya tiene. */
  v_locod := (select codigo from orden_locales where id = v_local);
  if v_cupx is not null or v_cumx is not null then
    if v_gc_neto > 0 then
      raise exception 'El cupón y el regalo de cumpleaños no van en una venta con una Gift Card: la Gift Card, en otra venta.';
    end if;
    v_base := v_neto - v_otros_m;
  end if;
  if v_ptsprem > 0 or v_cumx is not null then
    if v_socio is null then raise exception 'El regalo de cumpleaños va con el socio: elegilo en «Socio».'; end if;
    /* El socio queda trabado hasta que termina la venta: dos cajas a la vez no le gastan dos veces los mismos puntos ni
       le dan dos regalos (como en Cobrar). */
    perform 1 from club_clientes where id = v_cli.id for update;
    select * into v_cli from v_club_clientes where id = v_cli.id;
  end if;
  if v_ptsprem > 0 then
    if v_cli.puntos < v_ptsprem then
      raise exception 'Al socio no le alcanzan los puntos para el premio: tiene % y hacen falta %.', v_cli.puntos, v_ptsprem;
    end if;
    /* El límite de cada premio (N cada M meses), contando los de esta venta. */
    for v_prem in select z.* from club_premios z
                   where z.limite_anual is not null
                     and z.id in (select (y->>'premio')::smallint from jsonb_array_elements(v_items) y where nullif(y->>'premio', '') is not null) loop
      if (select count(*) from club_movimientos mm
           where mm.cliente = v_cli.id and mm.tipo = 'canje' and mm.premio = v_prem.id and mm.anulado is null
             and mm.creado > now() - make_interval(months => v_prem.limite_meses))
         + (select count(*) from jsonb_array_elements(v_items) y where nullif(y->>'premio', '')::smallint = v_prem.id) > v_prem.limite_anual then
        raise exception 'El premio «%» se lleva % cada % meses y ya se lo llevó.', v_prem.nombre,
          case when v_prem.limite_anual = 1 then 'una vez' else v_prem.limite_anual || ' veces' end, v_prem.limite_meses;
      end if;
    end loop;
  end if;
  if v_cupx is not null then
    select * into v_cup from v_beneficios where id = nullif(v_cupx->>'beneficio', '')::bigint;
    if not found or v_cup.tipo::text <> 'descuento' then raise exception 'Ese cupón no existe.'; end if;
    if v_cup.estado <> 'disponible' then
      raise exception 'El cupón está %: no se puede usar.',
        case v_cup.estado when 'usado' then 'usado' when 'vencido' then 'vencido' when 'anulado' then 'anulado' else v_cup.estado end;
    end if;
    if v_cup.desde is not null and v_cup.desde > pos_hoy() then
      raise exception 'El cupón empieza a valer el %.', to_char(v_cup.desde, 'DD/MM');
    end if;
    if v_cup.locales is not null and upper(trim(v_locod)) <> all (select upper(trim(z)) from unnest(v_cup.locales) z) then
      raise exception 'Ese cupón no vale en esta sucursal.';
    end if;
    if v_cup.compra_minima is not null and v_base < v_cup.compra_minima then
      raise exception 'El cupón es para compras desde $ %.', replace(to_char(v_cup.compra_minima, 'FM999G999G990'), ',', '.');
    end if;
    if v_cup.codigo is not null and not coalesce(v_cup.acumulable, false) and (v_otros > 0 or v_cumx is not null) then
      raise exception 'Ese cupón no se combina con otras promociones: sacá los otros descuentos o no uses el cupón.';
    end if;
    if v_cup.codigo is null and nullif(trim(coalesce(v_cupx->>'clave', '')), '') is null and v_socio is null then
      raise exception 'Ese cupón es de una persona: elegí al socio o buscalo con su WhatsApp.';
    end if;
    if v_cup_m > least(case when v_cup.pct is not null then round(v_base * v_cup.pct / 100, 2) else coalesce(v_cup.valor, 0) end,
                       coalesce(v_cup.tope, v_base), v_base) + 0.01 then
      raise exception 'El descuento del cupón es más de lo que da (%).',
        case when v_cup.pct is not null then v_cup.pct || ' %' else '$ ' || replace(to_char(coalesce(v_cup.valor, 0), 'FM999G999G990'), ',', '.') end
        || case when v_cup.tope is not null then ', con un tope de $ ' || replace(to_char(v_cup.tope, 'FM999G999G990'), ',', '.') else '' end;
    end if;
  end if;
  if v_cumx is not null then
    v_cumr := club_regalo_cumple(v_cli.id);
    if not coalesce((v_cumr->>'vale')::boolean, false) then
      raise exception 'El socio no está en su semana de cumpleaños (o no tiene el cumpleaños cargado).';
    end if;
    if coalesce((v_cumr->>'usado')::boolean, false) then raise exception 'El socio ya usó el regalo de este cumpleaños.'; end if;
    if coalesce(v_cumr->>'tipo', '') <> 'descuento' or nullif(v_cumr->>'porcentaje', '') is null then
      raise exception 'El regalo de cumpleaños de su nivel no es un descuento: se entrega aparte.';
    end if;
    if v_cum_m > round((v_base - v_cup_m) * (v_cumr->>'porcentaje')::numeric / 100, 2) + 0.01 then
      raise exception 'El regalo de cumpleaños es el % %% de la compra: el descuento es más que eso.', v_cumr->>'porcentaje';
    end if;
  end if;
  v_total := v_neto - v_desc;
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;
  /* SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 cuotas con menos de $150.000, 17 %) se
     suma al total: es lo que se cobra en la tarjeta. Lo calcula la pantalla; acá, que tenga sentido. */
  if v_interes is null or v_interes < 0 then raise exception 'El interés de las cuotas no es válido.'; end if;
  if v_interes > v_total then raise exception 'El interés de las cuotas es más que la venta.'; end if;
  v_total := v_total + v_interes;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    /* SQL 282 (Mauricio, 12/11, hablando de ARCA): la Gift Card no se factura dos veces. Se factura cuando se vende; la venta
       que se PAGA con ella va en X. Con una parte en tarjeta, Mercado Pago, MODO, Go Cuotas o transferencia, la venta entera
       es B («por más que te haya pagado 10 pesos en tarjeta y el 90 % en efectivo»). */
    if v_letra = 'X' and x->>'medio' not in ('efectivo', 'giftcard') then
      raise exception 'La X (el comprobante interno) va sólo con efectivo o con una Gift Card: con tarjeta, Mercado Pago, Go Cuotas o transferencia es Factura B.';
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  /* SQL 215 */
  if (v_interes > 0 or v_sinint)
     and not exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1) then
    raise exception 'El interés de las cuotas va sólo pagando con tarjeta en cuotas.';
  end if;
  if v_interes = 0 and not v_sinint then v_intnota := null; end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);
  /* SQL 264: las tarjetas salen del depósito de la sucursal donde están (el que más tiene); si no hay ninguna cargada,
     del depósito de la venta (queda en negativo, como cualquier prenda). */
  if array_length(v_gcs, 1) > 0 then
    v_dep_gc := (select s.deposito_id from pos_stock s join pos_depositos d on d.id = s.deposito_id
                  where s.local_id = v_local and s.codigo = 'GIFTCARD' and d.activo
                  order by s.cantidad desc, d.predeterminado desc limit 1);
    v_dep_gc := coalesce(v_dep_gc, v_dep);
  end if;

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet,   -- SQL 212: fecha y sin_internet
                          interes, interes_nota, sin_interes)                   -- SQL 215
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end,
          v_interes, v_intnota, v_sinint)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * (v_total - v_interes) / v_neto, 2) else 0 end,   -- SQL 215: sin el interés
                v_pago, pos_hoy() + coalesce(nullif(x->>'vence_dias', '')::int, 30), v_locod, v_vend,   -- SQL 264: su vencimiento
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio, premio)   -- SQL 265: premio
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid,
            nullif(x->>'premio', '')::smallint);
    /* SQL 264: la tarjeta es un artículo del stock («GIFTCARD», talle UNI, color de la tarjeta): sale una. En una prueba, no. */
    if gc is not null and not v_prueba then
      v_gc_col := (select case when lower(t.color) = 'black' then 'NE' else upper(left(t.color, 2)) end from giftcard_tarjetas t where t.codigo = gc);
      perform pos_stock_mover(v_local, 'GIFTCARD', 'UNI', coalesce(v_gc_col, 'NE'), -1, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, 'Gift Card', 'Gift Card ' || pos_gc_nombre(gc), null, v_dep_gc);
    end if;
    /* SQL 265: el premio del Club le descuenta los puntos al socio, como el canje de Cobrar. La prenda sale del stock con
       las demás. En una prueba, no. */
    if nullif(x->>'premio', '') is not null and not v_prueba then
      select * into v_prem from club_premios where id = (x->>'premio')::smallint;
      insert into club_movimientos (cliente, tipo, puntos, premio, local, vendedor, ticket, obs)
      values (v_cli.id, 'canje', -v_prem.puntos, v_prem.id, v_locod, v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, v_prem.nombre)
      returning id into v_cmov;
      update pos_venta_items set club_mov = v_cmov where venta_id = v_id and item = i;
    end if;
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color, -it.cantidad, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, it.descripcion, null, null, v_dep);   -- SQL 252: del depósito elegido
    end loop;
  end if;

  i := 0;
  for x in select * from jsonb_array_elements(v_descs) loop
    i := i + 1;
    v_bid := null;
    v_uso := null;
    v_cmov := null;
    /* SQL 265: el cupón se usa como en Cobrar (canjear_beneficio: el de una persona queda usado; el de campaña suma un
       uso, con el WhatsApp si es «uno por persona») y el regalo de cumpleaños queda entregado. En una prueba, nada. */
    if x->>'tipo' = 'cupon' and not v_prueba then
      v_tel := coalesce(tel_cliente(nullif(x->>'telefono', '')), tel_cliente(v_cli.telefono), tel_cliente(nullif(p->>'cliente_tel', '')));
      v_cj := canjear_beneficio(v_cup.id, coalesce(nullif(trim(coalesce(x->>'clave', '')), ''), v_cli.telefono), v_locod, v_vend, v_base,
                                (select trim(y->>'descripcion') from jsonb_array_elements(v_items) y limit 1), v_tel,
                                coalesce(nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_cli.nombre));
      if not coalesce((v_cj->>'canjeado')::boolean, false) then
        raise exception 'El cupón no se pudo usar: %.', coalesce(v_cj->>'porque', 'no sé por qué');
      end if;
      if v_cup.multiuso then
        v_uso := (select max(u.id) from beneficio_usos u where u.beneficio = v_cup.id);   -- el que acaba de anotar (con el candado del cupón)
      else
        v_bid := v_cup.id;
      end if;
    elsif x->>'tipo' = 'cumple' and not v_prueba then
      insert into club_movimientos (cliente, tipo, concepto, puntos, local, vendedor, ticket, obs, costo)
      values (v_cli.id, 'canje', 'regalo_cumple', 0, v_locod, v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, v_cumr->>'texto', round((x->>'monto')::numeric, 2))
      returning id into v_cmov;
    end if;
    insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto, beneficio, uso, club_mov)   -- SQL 265: con qué cupón o regalo
    values (v_id, i, x->>'tipo', nullif(x->>'promo_id', '')::int,
            coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2), v_bid, v_uso, v_cmov);
  end loop;

  i := 0;
  for x in select * from jsonb_array_elements(v_pagos) loop
    i := i + 1;
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 265: desde el 265 la regla pos_suma_puntos está en 'si': el POS suma los puntos y Cobrar ya no se usa en los locales.
     SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). SQL 215: el interés tampoco. */
    v_gana := floor((greatest(v_total - v_interes - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_interes - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null,
                            'premio_puntos', v_ptsprem);   -- SQL 265
end $function$;

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
--  SQL 284 (12/11/2026): LA FACTURA POR WHATSAPP (App Orden: correr-en-supabase-284.sql)
-- ═══════════════════════════════════════════════════════════════════════════
-- SQL 284 (12/11/2026): mandar la factura por WhatsApp desde el ticket del POS.
--   Pedido de Mauricio (12/11, después de probar el mail del SQL 281): «yo quiero que nuestros sistemas sean los mejores,
--   así que me gustaría armar esto de WhatsApp también para tenerlo».
--   Cómo es:
--     - «Mandar la factura» (en el ticket y al guardar la venta) deja elegir: por mail o por WhatsApp. Por WhatsApp se
--       escribe el celular del cliente (viene cargado si lo tiene) y le llega el PDF con un mensaje corto.
--     - Lo manda el servidor (la función «mail») desde el WhatsApp del sistema, con una plantilla que aprueba Meta
--       («factura_vdh»): a un cliente que no nos escribió sólo se le puede mandar una plantilla aprobada. Mientras Meta no
--       la aprueba, la opción de WhatsApp no aparece y todo sigue por mail.
--     - Queda anotado igual que el mail (pos_venta_mails, ahora con «canal»): a qué número, cuándo y quién. Además se
--       guarda el identificador del mensaje: con eso el ticket dice si se entregó, si lo leyó o si no llegó (lo avisa
--       WhatsApp después, y lo deja en wa_mensajes la función «whatsapp»). Y queda en el CRM: si el cliente contesta,
--       ahí se ve qué se le mandó.
--     - Sólo celulares de Argentina (la característica y el número, 10 cifras; se sacan solos el +54, el 9, el 0 y el
--       15). Al que tiene la etiqueta «No escribir» en el CRM no se le manda.
--     - Dos frenos, como en el mail: la misma factura al mismo número, una vez por minuto; y 200 por día entre todos los
--       locales (el número del sistema tiene un tope de 250 personas nuevas por día).
--   Necesita el SQL 281 corrido. No cambia ningún dato: le agrega dos columnas a pos_venta_mails (que es del 281), crea
--   tres funciones y reemplaza dos del 281 (pos_venta_mail_preparar y pos_venta_mails_lista). Se puede correr más de
--   una vez. Se deshace con deshacer-284.sql.

-- 1) Cada envío dice por dónde salió. En «mail» queda a dónde: la dirección o el celular (549 + las 10 cifras).
ALTER TABLE public.pos_venta_mails ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'mail';
ALTER TABLE public.pos_venta_mails ADD COLUMN IF NOT EXISTS wamid text;
DO $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pos_venta_mails_canal_ok' and conrelid = 'public.pos_venta_mails'::regclass) then
    alter table public.pos_venta_mails add constraint pos_venta_mails_canal_ok check (canal in ('mail', 'whatsapp'));
  end if;
end $$;
COMMENT ON COLUMN public.pos_venta_mails.canal IS 'SQL 284: por dónde se mandó la factura: mail o whatsapp.';
COMMENT ON COLUMN public.pos_venta_mails.mail IS 'A dónde se mandó: la dirección de mail o, por WhatsApp, el celular (549 + las 10 cifras).';
COMMENT ON COLUMN public.pos_venta_mails.wamid IS 'SQL 284: el identificador del mensaje de WhatsApp (con él, wa_mensajes dice si se entregó o se leyó).';

-- 2) ¿Se puede mandar por mail? Igual que en el 281; los frenos ahora cuentan sólo los mails.
CREATE OR REPLACE FUNCTION public.pos_venta_mail_preparar(p_venta uuid, p_mail text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t      jsonb;
  v_mail text := lower(trim(coalesce(p_mail, '')));
  v_hoy  int;
begin
  t := pos_venta(p_venta);   -- mira el permiso del POS y que la venta sea de un local de la persona
  if coalesce(t->'factura'->>'cae', '') = '' then
    raise exception 'Esta venta no tiene factura electrónica: no hay nada para mandar.';
  end if;
  /* Sólo letras sin acento, números y . _ % + - : lo que entiende cualquier servidor de mails. */
  if length(v_mail) > 120 or v_mail !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'El mail no está bien escrito.';
  end if;
  /* Los dos clics seguidos: la misma factura a la misma dirección, una vez por minuto. */
  if exists (select 1 from pos_venta_mails m
              where m.venta_id = p_venta and m.canal = 'mail' and m.mail = v_mail and m.estado = 'enviado' and m.fecha > now() - interval '1 minute') then
    raise exception 'Esa factura se le acaba de mandar a %. Si no le llegó, que mire en «Spam». En un minuto se puede mandar de nuevo.', v_mail;
  end if;
  /* El tope de la casilla: Gmail deja unos 500 por día. Se frena antes, en 400 (el día es el de Argentina). */
  select count(*) into v_hoy from pos_venta_mails m
   where m.canal = 'mail' and m.estado = 'enviado' and m.fecha >= (pos_hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires');
  if v_hoy >= 400 then
    raise exception 'Hoy ya salieron % mails y la casilla tiene un tope por día. Mañana se puede de nuevo.', v_hoy;
  end if;
  return jsonb_build_object('venta', t, 'mail', v_mail, 'persona', orden_yo_id(),
                            'persona_nombre', (select p.nombre from orden_personas p where p.id = orden_yo_id()));
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_mail_preparar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_mail_preparar(uuid, text) TO authenticated;

-- 3) ¿Se puede mandar por WhatsApp? Lo pregunta el servidor con la sesión de la persona. Devuelve la venta entera (con
--    eso se arma el PDF), el celular como lo quiere WhatsApp y cómo se lee.
CREATE OR REPLACE FUNCTION public.pos_venta_wa_preparar(p_venta uuid, p_tel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t     jsonb;
  v_n   text;
  v_tel text;
  v_hoy int;
  v_no  boolean;
begin
  t := pos_venta(p_venta);   -- mira el permiso del POS y que la venta sea de un local de la persona
  if coalesce(t->'factura'->>'cae', '') = '' then
    raise exception 'Esta venta no tiene factura electrónica: no hay nada para mandar.';
  end if;
  /* El celular: la característica y el número, 10 cifras. club_tel (la regla del Club) saca el +54, el 9, el 0 de
     adelante y el 15. Las características de acá empiezan con 1, 2 o 3. */
  v_n := club_tel(p_tel);
  if v_n is null or v_n !~ '^[1-3][0-9]{9}$' then
    raise exception 'Ese número no parece un celular de Argentina. Va con la característica y el número, como 223 584-5942 (sin el 0 y sin el 15).';
  end if;
  v_tel := '549' || v_n;
  /* Al que alguien le puso «No escribir» en el CRM no se le manda nada por WhatsApp. */
  select bool_or(exists (select 1 from unnest(b.etiquetas) e where lower(trim(e)) = 'no escribir')) into v_no
    from crm_contactos_base() b where b.clave = v_n;
  if coalesce(v_no, false) then
    raise exception 'Esa persona tiene la etiqueta «No escribir» en el CRM: no se le manda nada por WhatsApp. Mandásela por mail.';
  end if;
  /* Los dos clics seguidos: la misma factura al mismo número, una vez por minuto. */
  if exists (select 1 from pos_venta_mails m
              where m.venta_id = p_venta and m.canal = 'whatsapp' and m.mail = v_tel and m.estado = 'enviado' and m.fecha > now() - interval '1 minute') then
    raise exception 'Esa factura se le acaba de mandar a ese número. En un minuto se puede mandar de nuevo.';
  end if;
  /* El tope: el número del sistema puede escribirle a 250 personas nuevas por día. Se frena antes, en 200. */
  select count(*) into v_hoy from pos_venta_mails m
   where m.canal = 'whatsapp' and m.estado = 'enviado' and m.fecha >= (pos_hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires');
  if v_hoy >= 200 then
    raise exception 'Hoy ya salieron % facturas por WhatsApp y el número tiene un tope por día. Mandala por mail; mañana se puede de nuevo.', v_hoy;
  end if;
  return jsonb_build_object('venta', t, 'tel', v_tel,
                            'tel_lindo', case when v_n like '11%' then '11 ' || substr(v_n, 3, 4) || '-' || substr(v_n, 7)
                                              else substr(v_n, 1, 3) || ' ' || substr(v_n, 4, 3) || '-' || substr(v_n, 7) end,
                            'persona', orden_yo_id(), 'persona_nombre', (select p.nombre from orden_personas p where p.id = orden_yo_id()));
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_wa_preparar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_wa_preparar(uuid, text) TO authenticated;

-- 4) Anotar un envío por cualquier canal (o que falló). Sólo el servidor. La del 281 (pos_venta_mail_anotar) sigue
--    estando: la usa la versión de la función que anota sólo mails.
CREATE OR REPLACE FUNCTION public.pos_venta_envio_anotar(p_venta uuid, p_canal text, p_destino text, p_persona uuid, p_estado text, p_error text,
                                                         p_comprobante text, p_wamid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r pos_venta_mails;
begin
  if not exists (select 1 from pos_ventas v where v.id = p_venta) then raise exception 'No existe esa venta.'; end if;
  if p_canal is null or p_canal not in ('mail', 'whatsapp') then raise exception 'El canal es «mail» o «whatsapp».'; end if;
  if p_estado is null or p_estado not in ('enviado', 'fallo') then raise exception 'El estado es «enviado» o «fallo».'; end if;
  if nullif(trim(coalesce(p_destino, '')), '') is null then raise exception 'Falta a dónde se mandó.'; end if;
  insert into pos_venta_mails (venta_id, canal, mail, comprobante, persona, persona_nombre, estado, error, wamid)
  values (p_venta, p_canal, lower(trim(p_destino)), nullif(trim(coalesce(p_comprobante, '')), ''), p_persona,
          (select p.nombre from orden_personas p where p.id = p_persona), p_estado, nullif(left(trim(coalesce(p_error, '')), 500), ''),
          nullif(trim(coalesce(p_wamid, '')), ''))
  returning * into r;
  return jsonb_build_object('id', r.id, 'fecha', r.fecha, 'canal', r.canal, 'destino', r.mail, 'persona', r.persona_nombre, 'estado', r.estado);
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_envio_anotar(uuid, text, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_venta_envio_anotar(uuid, text, text, uuid, text, text, text, text) TO service_role;

-- 5) Lo que muestra el ticket, ahora con el canal. Por WhatsApp trae además cómo va el mensaje según WhatsApp
--    (sent = salió, delivered = entregado, read = leído, failed = no llegó): lo deja en wa_mensajes la función «whatsapp».
CREATE OR REPLACE FUNCTION public.pos_venta_mails_lista(p_venta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_local uuid;
begin
  perform pos_permiso();
  select v.local_id into v_local from pos_ventas v where v.id = p_venta;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v_local);   -- SQL 190
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'mail', m.mail, 'persona', m.persona_nombre, 'canal', m.canal,
                                                       'wa', case when m.wamid is not null then (select w.estado from wa_mensajes w where w.wamid = m.wamid) end)
                                    order by m.fecha, m.id)
                     from pos_venta_mails m where m.venta_id = p_venta and m.estado = 'enviado'), '[]'::jsonb);
end $function$;

REVOKE ALL ON FUNCTION public.pos_venta_mails_lista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_mails_lista(uuid) TO authenticated;

-- 6) ¿La base ya sabe mandar por WhatsApp? Lo pregunta el servidor antes de ofrecer la opción (si esta función no está,
--    falta este SQL y sólo se ofrece el mail).
CREATE OR REPLACE FUNCTION public.pos_envio_canales()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso();
  return jsonb_build_object('mail', true, 'whatsapp', true);
end $function$;

REVOKE ALL ON FUNCTION public.pos_envio_canales() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_envio_canales() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
--  SQL 285 (13/11/2026): FÁBRICA → CONTABLE (App Orden: correr-en-supabase-285.sql)
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- ═══ SQL 285 · Fábrica → «Contable»: la disponibilidad, los movimientos y el IVA Ventas de todos los locales (13/11/2026) ═══
-- Pedido de Mauricio (12/11): «en la parte de fábrica necesito que haya una sección que diga "disponibilidad"… para que el
-- contador de la empresa pueda ver la disponibilidad de cada local… una sección aparte para la fábrica… que tenga la parte
-- de disponibilidad y también la parte de movimientos… También tienen que tener una parte de IVA ventas de cada local.»
-- Y: «Acá me aparece solo la de Rivadavia. El resto de locales no aparece.»
--
-- Qué hace (10 funciones, armadas con cada una como está hoy en la base; ninguna tabla ni ningún dato cambia):
--   1. Una casilla nueva por persona, «Ve lo contable» (clave 'contable'), APARTE de «Usa el POS» y de «Entra a Fábrica».
--      Arranca apagada en todos; al administrador le viene con el POS (Antonella, Daniel y Mauricio ya la tienen).
--      (pos_permiso_del_rol, pos_mis_permisos, nc_yo, pos_permisos_lista, pos_permisos_guardar, pos_inicio)
--   2. Con esa casilla, sin usar el POS: la Disponibilidad de las cajas y sus movimientos (pos_disponibilidad,
--      pos_caja_valores), los Movimientos de caja (pos_caja_movimientos: gastos, pases a la caja fuerte y retiros) y el IVA
--      Ventas (pos_iva_ventas), de TODOS los locales y de cualquier día. Sólo mira: no carga, no anula, no ajusta, no tilda.
--   3. La Disponibilidad trae TODAS las sucursales (hoy, sólo las que ya movieron algo en el POS): las que todavía no lo
--      usan vienen con con_pos = false y $0, después de las que sí.
-- Quien ya veía estas pantallas las sigue viendo igual (la Gestión, la caja, el POS): nadie pierde nada.
-- El sistema publicado de antes sigue andando igual con esto corrido (la Disponibilidad de Gestión muestra los 14 locales).
-- Se puede correr más de una vez. Se deshace con deshacer-285.sql. Corre entero o nada.

CREATE OR REPLACE FUNCTION public.pos_permiso_del_rol(p_rol text, p_con_local boolean, p_que text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_rol = 'admin' then p_que not in ('usa', 'gestion')
    when p_que in ('usa', 'gestion', 'fabrica', 'contable') then false   -- SQL 256: «Entra a Fábrica», apagada para todos; SQL 285: lo contable, igual
    when p_rol = 'supervisor' then p_que <> 'locales' or not coalesce(p_con_local, false)
    else false end
$function$;

CREATE OR REPLACE FUNCTION public.pos_mis_permisos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('usa', pos_puede('usa'), 'anular', pos_puede('anular'), 'envios', pos_puede('envios'),
           'caja', pos_puede('caja'), 'retiros', pos_puede('retiros'), 'dias', pos_puede('dias'), 'locales', pos_puede('locales'), 'precios', pos_puede('precios'),
           'gestion', pos_puede('gestion'),
           'fabrica', pos_puede('fabrica'),   -- SQL 256
           'contable', pos_puede('contable'),   -- SQL 285
           'mios', coalesce((select jsonb_agg(l.id) from orden_locales l where l.activo and pos_local_mio(l.id)), '[]'::jsonb))
$function$;

CREATE OR REPLACE FUNCTION public.nc_yo()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 190: si usa el POS (lo prende la oficina en Config → Usuarios). */
           'pos', pos_puede_persona(p, 'usa'),
           /* SQL 229: si entra a la Gestión del POS (la prende la oficina en Config → Usuarios; pide también el POS). */
           'gestion', pos_puede_persona(p, 'usa') and pos_puede_persona(p, 'gestion'),
           /* SQL 256: si entra a la Fábrica (los remitos de la fábrica a los locales y sus diferencias), aunque no use el
              POS. Al administrador le viene con el POS. */
           'fabrica', pos_puede_persona(p, 'fabrica'),
           /* SQL 285: si ve lo contable de la Fábrica (la disponibilidad de las cajas, los movimientos y el IVA Ventas de
              todos los locales), aunque no use el POS ni entre al resto de la Fábrica. Al administrador le viene con el POS. */
           'contable', pos_puede_persona(p, 'contable'),
           /* SQL 230: el fichero de prueba de su local, con su usuario (pos_fichero_prueba). */
           'fichero', p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
                      and exists (select 1 from pos_fichero_prueba f where f.local_id = p.local_id),
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_lista()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text[] := array['usa', 'anular', 'envios', 'caja', 'retiros', 'dias', 'locales', 'precios', 'gestion', 'fabrica', 'contable'];   -- SQL 256: «Entra a Fábrica»; SQL 262: «Retiros de fondos»; SQL 285: lo contable
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'admin_elige', true,
    'roles', (select jsonb_object_agg(r.ed, (select jsonb_object_agg(c, pos_permiso_del_rol(r.rol, r.con_local, c)) from unnest(k) c))
                from (values ('vendedor', 'vendedor', true), ('supervisor', 'supervisor', true), ('zona', 'supervisor', false),
                             ('atencion', 'atencion', false), ('admin', 'admin', false)) r(ed, rol, con_local)),
    'personas', coalesce((
      select jsonb_object_agg(p.id, (select jsonb_object_agg(c, case when p.rol = 'admin' then coalesce((x.cambios ->> 'usa')::boolean, false)
                                                                     else coalesce((x.cambios ->> c)::boolean, pos_permiso_del_rol(p.rol::text, p.local_id is not null, c)) end)
                                       from unnest(k) c) || jsonb_build_object('propios', coalesce(x.cambios, '{}'::jsonb)))
        from orden_personas p left join pos_permisos x on x.persona_id = p.id), '{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_permisos_guardar(p_persona uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k text[] := array['usa', 'anular', 'envios', 'caja', 'retiros', 'dias', 'locales', 'precios', 'gestion', 'fabrica', 'contable'];   -- SQL 256: «Entra a Fábrica»; SQL 262: «Retiros de fondos»; SQL 285: lo contable
  q orden_personas;
  c text;
  v_cambios jsonb;
begin
  if not orden_es_admin() or not pos_puede('usa') then
    raise exception 'Los permisos del POS los maneja un administrador que tiene el POS.' using errcode = '42501';
  end if;
  select * into q from orden_personas where id = p_persona;
  if not found then raise exception 'No existe esa persona.'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Faltan los permisos.'; end if;
  /* SQL 236: al administrador, sólo «Usa el POS» (con eso tiene todo, también la Gestión). El suyo no se lo saca él. */
  if q.rol = 'admin' then
    if jsonb_typeof(p->'usa') is distinct from 'boolean' then raise exception 'Falta si usa el POS.'; end if;
    if q.id = orden_yo_id() and not (p->>'usa')::boolean then
      raise exception 'Tu POS no te lo podés sacar vos: te lo saca otro administrador.';
    end if;
    p := jsonb_build_object('usa', p->'usa');
  end if;
  select x.cambios into v_cambios from pos_permisos x where x.persona_id = p_persona for update;
  v_cambios := coalesce(v_cambios, '{}'::jsonb);
  foreach c in array k loop
    if p ? c then
      if jsonb_typeof(p->c) is distinct from 'boolean' then raise exception 'El permiso % no es válido.', c; end if;
      if (p->>c)::boolean = pos_permiso_del_rol(q.rol::text, q.local_id is not null, c) then v_cambios := v_cambios - c;
      else v_cambios := v_cambios || jsonb_build_object(c, (p->>c)::boolean); end if;
    end if;
  end loop;
  if v_cambios = '{}'::jsonb then
    delete from pos_permisos where persona_id = p_persona;
  else
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en) values (p_persona, v_cambios, orden_yo_id(), now())
    on conflict (persona_id) do update set cambios = excluded.cambios, cambiado_por = excluded.cambiado_por, cambiado_en = now();
  end if;
  return (select jsonb_object_agg(c2, pos_puede_persona(q, c2)) from unnest(k) c2) || jsonb_build_object('propios', v_cambios);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_inicio()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (pos_puede('fabrica') or pos_puede('contable')) then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica; SQL 285: o sólo lo contable
  return jsonb_build_object(
    /* SQL 190: su local y lo que puede en el POS (las casillas de Config → Usuarios). */
    'yo', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'local_id', p.local_id) from orden_personas p where p.id = orden_yo_id()),
    'puede', pos_mis_permisos(),
    'hoy', pos_hoy(),
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo,
                                          'lista_id', s.lista_id, 'habilitada', coalesce(s.habilitada, false),
                                          'punto_venta', s.punto_venta,
                                          'arca', s.arca, 'arca_desde', s.arca_desde) order by l.nombre)   -- SQL 276
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
end $function$;

CREATE OR REPLACE FUNCTION public.pos_disponibilidad()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('contable') then perform pos_permiso('gestion'); end if;   -- SQL 285: también lo contable de la Fábrica
  return (
    /* SQL 285 (Mauricio, 12/11: "me aparece sólo la de Rivadavia… lo importante es que pueda haber la disponibilidad de todos
       los locales"): todas las sucursales; la que todavía no usa el POS de verdad va con con_pos = false (y $0). */
    with l as (
      select o.id, o.nombre, o.id in (select x.local_id from pos_cierres x where not x.prueba
                                   union select x.local_id from pos_ventas x where not x.prueba
                                   union select x.local_id from pos_cambios x where not x.prueba
                                   union select x.local_id from pos_caja_movimientos x where not x.prueba
                                   union select x.local_id from pos_caja_ajustes x) as con_pos
        from orden_locales o
       where o.activo
    ), c as (
      select l.id, l.nombre, l.con_pos, k.caja, pos_caja_saldo(l.id, k.caja) d
        from l cross join (values ('chica'), ('fuerte')) k(caja)
    )
    select jsonb_build_object(
      'cajas', coalesce((select jsonb_agg(jsonb_build_object('local_id', c.id, 'local', c.nombre, 'caja', c.caja, 'con_pos', c.con_pos) || c.d
                                          order by not c.con_pos, c.nombre, c.caja) from c), '[]'::jsonb),
      'totales', jsonb_build_object(
        'chica', coalesce((select sum((c.d->>'saldo')::numeric) from c where c.caja = 'chica'), 0),
        'fuerte', coalesce((select sum((c.d->>'saldo')::numeric) from c where c.caja = 'fuerte'), 0)))
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_valores(p_local uuid, p_caja text, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('contable') then perform pos_permiso('gestion'); end if;   -- SQL 285: también lo contable de la Fábrica
  if p_local is null or not exists (select 1 from orden_locales where id = p_local) then raise exception 'Elegí la sucursal.'; end if;
  if p_caja is null or p_caja not in ('chica', 'fuerte') then raise exception 'La caja tiene que ser la chica o la fuerte.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  return (
    with t as (select * from pos_caja_con_saldo(p_local, p_caja)),
    f as (select * from t where t.dia between p_desde and p_hasta)
    select pos_caja_saldo(p_local, p_caja) || jsonb_build_object(
      'local', (select o.nombre from orden_locales o where o.id = p_local),
      'filas', coalesce((select jsonb_agg(jsonb_build_object('fecha', z.fecha, 'tipo', z.tipo, 'ref', z.ref, 'detalle', z.detalle,
                                                             'persona', z.persona, 'importe', z.importe, 'saldo', z.saldo,
                                                             'control', z.es_control, 'contado', z.contado, 'id', z.ref_id) order by z.n desc)
                           from (select * from f order by n desc limit 1000) z), '[]'::jsonb),
      'mas', (select count(*) > 1000 from f),
      'entro', coalesce((select sum(f.importe) from f where not f.es_control and f.importe > 0), 0),
      'salio', coalesce((select -sum(f.importe) from f where not f.es_control and f.importe < 0), 0),
      'ajustado', coalesce((select sum(f.importe) from f where f.es_control and f.tipo <> 'inicial'), 0),
      'antes', coalesce((select t.saldo from t where t.dia < p_desde order by t.n desc limit 1), 0))
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_caja_movimientos(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_tipo text DEFAULT NULL::text, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_retiros boolean;   -- SQL 262
  v_contable boolean := pos_puede('contable');   -- SQL 285: lo contable de la Fábrica ve todos los locales, todos los días y los retiros
begin
  if not v_contable then
    perform pos_permiso(case when p_tipo = 'retiro' then 'retiros' else 'caja' end);   -- SQL 190; SQL 262: la lista de los retiros, con su casilla
    perform pos_local_ok(p_local);
    perform pos_dias_ok(p_desde);
  end if;
  v_retiros := v_contable or pos_puede('retiros');   -- SQL 262: sin la casilla, «Todos» no trae los retiros
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_tipo is not null and p_tipo not in ('gasto', 'salida', 'ingreso', 'caja_fuerte', 'retiro') then raise exception 'Ese tipo de movimiento no existe.'; end if;
  return (
    with t as (
      select m.id, 'mov'::text as origen, m.fecha, m.local_id, m.tipo, m.rubro, m.descripcion, m.monto, m.persona_nombre as persona,
             m.estado = 'ok' as vale, m.estado, m.cierre_id, m.anulado_motivo, m.numero,   -- SQL 179: el número del gasto
             m.caja, m.retira, m.controlado_en, m.controlado_por   -- SQL 191
        from pos_caja_movimientos m
       where m.dia between p_desde and p_hasta and m.prueba = coalesce(p_prueba, false) and (p_local is null or m.local_id = p_local)
      union all
      select c.id, 'cierre', c.fecha, c.local_id, 'caja_fuerte', null, null, c.retiro, c.responsable_nombre,
             c.estado = 'cerrada', case when c.estado = 'cerrada' then 'ok' else 'anulado' end, c.id, c.anulado_motivo, null::int,
             null::text, null::text, null::timestamptz, null::uuid
        from pos_cierres c
       where c.retiro > 0 and c.dia between p_desde and p_hasta and c.prueba = coalesce(p_prueba, false)
         and (p_local is null or c.local_id = p_local)
    ), f as (
      select * from t where (p_tipo is null or t.tipo = p_tipo) and (t.tipo <> 'retiro' or v_retiros)   -- SQL 262
    )
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', z.id, 'origen', z.origen, 'fecha', z.fecha, 'local', l.nombre, 'local_id', z.local_id, 'tipo', z.tipo,
                 'rubro', z.rubro, 'descripcion', z.descripcion, 'monto', z.monto, 'persona', z.persona, 'estado', z.estado,
                 'motivo', z.anulado_motivo, 'numero', z.numero,
                 'caja', case when z.tipo = 'gasto' then coalesce(z.caja, 'chica') else z.caja end,   -- SQL 272: el gasto, de la chica o de la fuerte
                 'retira', z.retira, 'controlado', z.controlado_en is not null, 'controlado_en', z.controlado_en,   -- SQL 191
                 'controlado_por', (select pe.nombre from orden_personas pe where pe.id = z.controlado_por),
                 'cierre', (select jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'estado', c.estado)
                              from pos_cierres c where c.id = z.cierre_id)) order by z.fecha desc)
          from (select * from f order by fecha desc limit 500) z join orden_locales l on l.id = z.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object(
                    'gasto',       coalesce(sum(monto) filter (where vale and tipo = 'gasto'), 0),
                    'gasto_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'gasto' and caja = 'fuerte'), 0),   -- SQL 272
                    'salida',      coalesce(sum(monto) filter (where vale and tipo = 'salida'), 0),
                    'ingreso',     coalesce(sum(monto) filter (where vale and tipo = 'ingreso'), 0),
                    'caja_fuerte', coalesce(sum(monto) filter (where vale and tipo = 'caja_fuerte'), 0),
                    'retiro',      coalesce(sum(monto) filter (where vale and tipo = 'retiro'), 0),   -- SQL 191
                    'controlado',  coalesce(sum(monto) filter (where vale and controlado_en is not null), 0),
                    'cantidad',    count(*) filter (where vale)) from f),
      'mas', (select count(*) > 500 from f)
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_iva_ventas(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_letra text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('contable') then   -- SQL 285: lo contable de la Fábrica ve el IVA de todos los locales, sin usar el POS
    perform pos_permiso();
    perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
    perform pos_dias_ok(p_desde);
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_letra is not null and p_letra not in ('A', 'B') then raise exception 'En el IVA van sólo las facturas A y B.'; end if;
  return (
    with z as (
      select 'ticket'::text tipo, v.id venta_id, v.local_id, v.fecha, v.dia, v.letra, v.numero, null::int nc,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, v.total,
             /* SQL 276: el CAE del ARCA de prueba no es una factura: no va en el IVA. */
             case when v.factura->>'ambiente' = 'homologacion' then null else nullif(v.factura->>'cae', '') end cae
        from pos_ventas v
       where v.dia between p_desde and p_hasta
         and not v.prueba
         and v.letra in ('A', 'B')
         and (v.estado = 'cobrada' or exists (select 1 from pos_notas_credito n where n.venta_id = v.id))
         and (p_local is null or v.local_id = p_local)
         and (p_letra is null or v.letra = p_letra)
      union all
      select 'nc', v.id, n.local_id, n.fecha, n.dia, n.letra, v.numero, n.numero,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, -v.total, n.cae
        from pos_notas_credito n join pos_ventas v on v.id = n.venta_id
       where n.dia between p_desde and p_hasta
         and not n.prueba
         and (p_local is null or n.local_id = p_local)
         and (p_letra is null or n.letra = p_letra)
    ),
    y as (select z.*, round(z.total / 1.21, 2) base from z)
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'tipo', y.tipo, 'venta_id', y.venta_id, 'fecha', y.fecha, 'dia', y.dia, 'letra', y.letra, 'numero', y.numero, 'nc', y.nc,
                 'local', l.nombre, 'local_id', y.local_id, 'cliente', coalesce(y.cliente_nombre, 'Consumidor final'), 'doc', y.cliente_doc,
                 'condicion', y.cliente_condicion, 'base', y.base, 'iva', y.total - y.base, 'total', y.total, 'cae', y.cae)
                 order by y.fecha, y.tipo desc)
          from (select * from y order by fecha, tipo desc limit 20000) y join orden_locales l on l.id = y.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object('tickets', count(*) filter (where tipo = 'ticket'), 'notas', count(*) filter (where tipo = 'nc'),
                                            'base', coalesce(sum(base), 0), 'iva', coalesce(sum(total - base), 0), 'total', coalesce(sum(total), 0))
                    from y),
      'mas', (select count(*) > 20000 from y)
    )
  );
end $function$;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
--  SQL 286 (13/11/2026): EL IVA VENTAS POR MAIL, EL 1.º DE CADA MES (App Orden: correr-en-supabase-286.sql)
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- ═══ SQL 286 · El IVA Ventas del mes, por mail, solo, el 1.º de cada mes (13/11/2026) ═══
-- Pedido de Mauricio (12/11): «Automáticamente a todos los primeros se les tiene que mandar un mail… Ahora que tenemos
-- marketing VDH lo podemos mandar. Todos los primeros automáticamente reciben un mail con la consulta de IVA de todo el mes».
--
-- VA DESPUÉS DEL SQL 285 (Fábrica → Contable): si el 285 no está corrido, éste se frena solo y no cambia nada.
--
-- Qué hace:
--   1. Dos tablas nuevas: pos_iva_mail (un solo renglón: si está prendido y a quién se manda) y pos_iva_mail_envios (cada
--      envío: de qué mes, a quién, cuándo, y si salió o por qué no).
--   2. pos_iva_mail_ver (lo que muestra la pantalla del IVA Ventas) y pos_iva_mail_guardar (prenderlo, apagarlo y cambiar a
--      quién se manda: sólo un administrador con el POS).
--   3. pos_iva_mail_preparar y pos_iva_mail_anotar: las usa la función «mail» del servidor para armar el mail y dejar
--      anotado cómo le fue. Un administrador con el POS también puede mandarlo a mano (una prueba, o el de otro mes).
--   4. Una tarea programada (pos-iva-mensual): los días 1, 2 y 3 de cada mes a las 9 de la mañana le pide a la función «mail»
--      el IVA Ventas del mes anterior. Si ya salió, o está apagado, no hace nada (el 2 y el 3 son el reintento).
-- ARRANCA APAGADO Y SIN DESTINATARIOS: no sale ningún mail hasta que un administrador lo prenda y cargue a quién mandarlo
-- (en la pantalla del IVA Ventas). No cambia ninguna función ni ningún dato de los que ya están.
-- Se puede correr más de una vez (no pisa lo ya cargado). Se deshace con deshacer-286.sql. Corre entero o nada.

DO $$
BEGIN
  IF public.pos_permiso_del_rol('supervisor', false, 'contable') THEN
    RAISE EXCEPTION 'Primero hay que correr el SQL 285 (Fábrica → Contable): el 286 va después.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pos_iva_mail (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  activo        boolean NOT NULL DEFAULT false,
  destinatarios text[]  NOT NULL DEFAULT '{}',
  llave         text    NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  cambiado_por  uuid REFERENCES public.orden_personas(id),
  cambiado_en   timestamptz
);
COMMENT ON TABLE public.pos_iva_mail IS 'SQL 286: el mail automático del IVA Ventas (un solo renglón): si está prendido, a quién se manda y la llave de la tarea programada.';
INSERT INTO public.pos_iva_mail (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.pos_iva_mail ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_iva_mail FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pos_iva_mail_envios (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mes            date NOT NULL,
  automatico     boolean NOT NULL,
  destinatarios  text[] NOT NULL,
  estado         text NOT NULL CHECK (estado IN ('enviado', 'fallo')),
  error          text,
  comprobantes   integer NOT NULL DEFAULT 0,
  total          numeric NOT NULL DEFAULT 0,
  persona_id     uuid REFERENCES public.orden_personas(id),
  persona_nombre text,
  creado_en      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pos_iva_mail_envios IS 'SQL 286: cada vez que se mandó (o se quiso mandar) el IVA Ventas por mail: de qué mes, a quién, cuándo y cómo le fue.';
CREATE INDEX IF NOT EXISTS pos_iva_mail_envios_mes ON public.pos_iva_mail_envios (mes, creado_en DESC);
ALTER TABLE public.pos_iva_mail_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_iva_mail_envios FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pos_iva_mail_envios_id_seq FROM PUBLIC, anon, authenticated;

/* Un mail bien escrito, en minúsculas y sin espacios; null si no lo es. Lo mismo que pide la factura por mail (SQL 281):
   letras sin acento, números y . _ % + - */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_dir(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when x.d ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' and length(x.d) <= 120 then x.d end
    from (select lower(btrim(coalesce(p, ''))) d) x
$function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_dir(text) FROM PUBLIC, anon, authenticated;

/* Lo que muestra la pantalla del IVA Ventas (Gestión y Fábrica → Contable): si sale solo, a quién y los últimos envíos. */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_ver()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c pos_iva_mail;
begin
  if not pos_puede('contable') then perform pos_permiso('gestion'); end if;
  select * into c from pos_iva_mail where id;
  return jsonb_build_object(
    'activo', coalesce(c.activo, false),
    'destinatarios', to_jsonb(coalesce(c.destinatarios, '{}'::text[])),
    'puede_cambiar', orden_es_admin() and pos_puede('usa') and not orden_es_servicio(),
    'mes_pasado', (date_trunc('month', pos_hoy()::timestamp) - interval '1 month')::date,
    'envios', coalesce((
      select jsonb_agg(jsonb_build_object('mes', e.mes, 'automatico', e.automatico, 'destinatarios', to_jsonb(e.destinatarios),
                                          'estado', e.estado, 'error', e.error, 'comprobantes', e.comprobantes, 'total', e.total,
                                          'persona', e.persona_nombre, 'fecha', e.creado_en) order by e.creado_en desc, e.id desc)
        from (select * from pos_iva_mail_envios order by creado_en desc, id desc limit 6) e), '[]'::jsonb));
end $function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_ver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_iva_mail_ver() TO authenticated;

/* Prenderlo, apagarlo y cambiar a quién se manda: p = { activo, destinatarios: ["a@b.com", …] }. Sólo un administrador con el POS. */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_act boolean;
  v_dir text[] := '{}';
  x     text;
  d     text;
begin
  if orden_es_servicio() or not orden_es_admin() or not pos_puede('usa') then
    raise exception 'El mail del IVA Ventas lo configura un administrador que tiene el POS.' using errcode = '42501';
  end if;
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'activo') is distinct from 'boolean'
     or jsonb_typeof(p->'destinatarios') is distinct from 'array' then
    raise exception 'Faltan datos: si se manda solo y a quién.';
  end if;
  for x in select jsonb_array_elements_text(p->'destinatarios') loop
    if btrim(coalesce(x, '')) = '' then continue; end if;
    d := pos_iva_mail_dir(x);
    if d is null then raise exception 'Este mail no está bien escrito: %', left(btrim(x), 80); end if;
    if not (d = any(v_dir)) then v_dir := v_dir || d; end if;
  end loop;
  if cardinality(v_dir) > 8 then raise exception 'Son demasiados mails: como mucho, 8.'; end if;
  v_act := (p->>'activo')::boolean;
  if v_act and cardinality(v_dir) = 0 then raise exception 'Para prenderlo, cargá al menos un mail.'; end if;
  update pos_iva_mail set activo = v_act, destinatarios = v_dir, cambiado_por = orden_yo_id(), cambiado_en = now() where id;
  return pos_iva_mail_ver();
end $function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_guardar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_iva_mail_guardar(jsonb) TO authenticated;

/* Lo que necesita la función «mail» para armar el mail: el mes, a quién y el IVA Ventas de todos los locales.
   - La tarea programada (el servidor, con la llave que sólo tiene la base): el mes pasado, a los destinatarios cargados; si
     está apagado, si ya salió o si no es principio de mes, contesta { saltear } y no se manda nada.
   - Un administrador con el POS (a mano): el mes que elija, a los destinatarios cargados o a la dirección que escriba. */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_preparar(p_mes date DEFAULT NULL::date, p_a text DEFAULT NULL::text, p_llave text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c       pos_iva_mail;
  v_auto  boolean := orden_es_servicio();
  v_hoy   date := pos_hoy();
  v_este  date := date_trunc('month', pos_hoy()::timestamp)::date;
  v_mes   date;
  v_hasta date;
  v_dir   text[];
  v_yo    orden_personas;
begin
  select * into c from pos_iva_mail where id;
  if not found then raise exception 'Falta la configuración del mail del IVA Ventas.'; end if;
  if v_auto then
    if p_llave is null or p_llave is distinct from c.llave then
      raise exception 'Este pedido no viene de la tarea programada.' using errcode = '42501';
    end if;
    v_mes := (v_este - interval '1 month')::date;
    if not c.activo then return jsonb_build_object('saltear', 'apagado'); end if;
    if cardinality(c.destinatarios) = 0 then return jsonb_build_object('saltear', 'sin_destinatarios'); end if;
    if extract(day from v_hoy) > 5 then return jsonb_build_object('saltear', 'fuera_de_fecha'); end if;
    if exists (select 1 from pos_iva_mail_envios e where e.mes = v_mes and e.automatico and e.estado = 'enviado') then
      return jsonb_build_object('saltear', 'ya_enviado');
    end if;
    if (select count(*) from pos_iva_mail_envios e where e.automatico and e.creado_en > now() - interval '1 day') >= 6 then
      return jsonb_build_object('saltear', 'demasiados_intentos');
    end if;
    v_dir := c.destinatarios;
  else
    if not orden_es_admin() or not pos_puede('usa') then
      raise exception 'El IVA Ventas por mail lo manda un administrador que tiene el POS.' using errcode = '42501';
    end if;
    v_mes := date_trunc('month', coalesce(p_mes, (v_este - interval '1 month')::date)::timestamp)::date;
    if v_mes > v_este or v_mes < (v_este - interval '24 months')::date then raise exception 'Ese mes no se puede mandar.'; end if;
    if btrim(coalesce(p_a, '')) <> '' then
      if pos_iva_mail_dir(p_a) is null then raise exception 'El mail no está bien escrito.'; end if;
      v_dir := array[pos_iva_mail_dir(p_a)];
    else
      v_dir := c.destinatarios;
    end if;
    if cardinality(v_dir) = 0 then raise exception 'No hay a quién mandarlo: escribí un mail.'; end if;
    if (select count(*) from pos_iva_mail_envios e where not e.automatico and e.creado_en > now() - interval '1 hour') >= 10 then
      raise exception 'Ya se mandó muchas veces en la última hora: esperá un rato.';
    end if;
    select * into v_yo from orden_personas where id = orden_yo_id();
  end if;
  v_hasta := (v_mes + interval '1 month' - interval '1 day')::date;
  return jsonb_build_object(
    'mes', v_mes, 'desde', v_mes, 'hasta', v_hasta, 'hoy', v_hoy, 'automatico', v_auto,
    'destinatarios', to_jsonb(v_dir),
    'persona', case when v_auto then null else jsonb_build_object('id', v_yo.id, 'nombre', orden_nombre_lista(v_yo.nombre, v_yo.inicial)) end,
    'iva', pos_iva_ventas(v_mes, v_hasta, null, null));
end $function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_preparar(date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_iva_mail_preparar(date, text, text) TO authenticated, service_role;

/* Cómo le fue a un envío: lo anota la función «mail» (sólo el servidor). */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_anotar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
begin
  if not orden_es_servicio() then raise exception 'Esto lo anota el servidor.' using errcode = '42501'; end if;
  insert into pos_iva_mail_envios (mes, automatico, destinatarios, estado, error, comprobantes, total, persona_id, persona_nombre)
  values ((p->>'mes')::date, coalesce((p->>'automatico')::boolean, false),
          array(select jsonb_array_elements_text(case when jsonb_typeof(p->'destinatarios') = 'array' then p->'destinatarios' else '[]'::jsonb end)),
          case when p->>'estado' = 'enviado' then 'enviado' else 'fallo' end, nullif(left(coalesce(p->>'error', ''), 500), ''),
          coalesce((p->>'comprobantes')::int, 0), coalesce((p->>'total')::numeric, 0),
          (select q.id from orden_personas q where q.id = nullif(p->>'persona_id', '')::uuid), nullif(p->>'persona_nombre', ''))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_anotar(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_iva_mail_anotar(jsonb) TO service_role;

/* Lo que corre la tarea programada: si está prendido y el del mes pasado todavía no salió, le pide el envío a la función
   «mail» (va con la llave; la función se la devuelve a la base, que la revisa). */
CREATE OR REPLACE FUNCTION public.pos_iva_mail_disparar()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c     pos_iva_mail;
  v_mes date := (date_trunc('month', pos_hoy()::timestamp) - interval '1 month')::date;
begin
  select * into c from pos_iva_mail where id;
  if not found or not c.activo or cardinality(c.destinatarios) = 0 then return 'apagado'; end if;
  if exists (select 1 from pos_iva_mail_envios e where e.mes = v_mes and e.automatico and e.estado = 'enviado') then return 'ya_enviado'; end if;
  perform net.http_post(
    url := 'https://gfjdjupuwxohkgchqykx.supabase.co/functions/v1/mail',
    body := jsonb_build_object('accion', 'iva_mensual', 'llave', c.llave),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 120000);
  return 'pedido';
end $function$;
REVOKE ALL ON FUNCTION public.pos_iva_mail_disparar() FROM PUBLIC, anon, authenticated;

/* Los días 1, 2 y 3 de cada mes a las 12:00 UTC (las 9 de la mañana en la Argentina). */
SELECT cron.schedule('pos-iva-mensual', '0 12 1-3 * *', 'select public.pos_iva_mail_disparar()');

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════
--  SQL 292 (13/11/2026): REPARTIR UN PRODUCTO, LA PLANILLA Y EL HISTORIAL (App Orden: correr-en-supabase-292.sql)
-- ════════════════════════════════════════════════════════════════════
-- ═══ SQL 292 · Repartir un producto: la planilla en el sistema y el registro de cada reparto (13/11/2026) ═══
-- Pedido de Mauricio (13/11), sobre «Repartir un producto» de la Fábrica: «dale» a dos mejoras que necesitan la base:
--   · la planilla de ventas y stock, que hoy cada compu carga por su lado, la carga una persona y la ven todas las compus;
--   · cada vez que se arman los remitos queda anotado qué proponía cada forma de repartir y qué se mandó al final, para
--     decidir con números cuál forma funciona mejor («vemos qué funciona mejor»).
--
-- Qué hace:
--   1. Dos tablas nuevas: pos_reparto_planilla (un solo renglón: la planilla que está cargada, quién la cargó y cuándo) y
--      pos_repartos (un renglón por reparto guardado: los productos, lo que proponía cada forma y lo que se mandó).
--   2. Cuatro funciones, para quien tiene «Entra a Fábrica»: pos_reparto_planilla (leerla), pos_reparto_planilla_guardar
--      (cargar otra), pos_reparto_anotar (anotar un reparto) y pos_repartos_ver (el historial).
-- Las tablas no se leen ni se escriben desde afuera: sólo por esas funciones.
-- No cambia ninguna función, ninguna tabla ni ningún dato de los que ya están. Sin este SQL la pantalla sigue como hoy
-- (la planilla en cada compu y sin historial).
-- Se puede correr más de una vez (no pisa lo ya cargado). Se deshace con deshacer-292.sql. Corre entero o nada.

CREATE TABLE IF NOT EXISTS public.pos_reparto_planilla (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  de             text        NOT NULL DEFAULT '',
  datos          jsonb       NOT NULL,
  cargada_en     timestamptz NOT NULL DEFAULT now(),
  cargada_por    uuid,
  cargada_nombre text
);
COMMENT ON TABLE public.pos_reparto_planilla IS 'SQL 292: la planilla de ventas y stock de «Repartir un producto» (un solo renglón): lo que vendió y lo que tiene cada local por rubro y familia, ya leída por la pantalla.';
ALTER TABLE public.pos_reparto_planilla ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_reparto_planilla FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pos_repartos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave         text        NOT NULL UNIQUE,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  dia           date        NOT NULL DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
  creado_por    uuid,
  creado_nombre text,
  forma         text        NOT NULL,
  prendas       integer     NOT NULL DEFAULT 0,
  datos         jsonb       NOT NULL
);
COMMENT ON TABLE public.pos_repartos IS 'SQL 292: cada reparto de «Repartir un producto» que terminó en remitos: los productos, lo que proponía cada forma de repartir y lo que se mandó a cada local.';
CREATE INDEX IF NOT EXISTS pos_repartos_dia ON public.pos_repartos (dia DESC, id DESC);
ALTER TABLE public.pos_repartos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_repartos FROM PUBLIC, anon, authenticated;

/* La planilla que está cargada (o null si todavía no cargaron ninguna). */
CREATE OR REPLACE FUNCTION public.pos_reparto_planilla()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_fabrica_ok();
  return (select jsonb_build_object('de', p.de, 'cargada_en', p.cargada_en, 'cargada_nombre', p.cargada_nombre, 'pl', p.datos)
            from pos_reparto_planilla p where p.id);
end $function$;
REVOKE ALL ON FUNCTION public.pos_reparto_planilla() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_reparto_planilla() TO authenticated;

/* Cargar otra planilla: p = { de: «el nombre del archivo», pl: lo que leyó la pantalla (con «locales») }. Pisa la anterior. */
CREATE OR REPLACE FUNCTION public.pos_reparto_planilla_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_de  text := left(btrim(coalesce(p->>'de', '')), 200);
  v_pl  jsonb := p->'pl';
  v_yo  uuid := orden_yo_id();
  v_nom text;
  v_en  timestamptz := now();
begin
  perform pos_fabrica_ok();
  if v_pl is null or jsonb_typeof(v_pl) <> 'object' or jsonb_typeof(v_pl->'locales') <> 'array' or jsonb_array_length(v_pl->'locales') = 0 then
    raise exception 'La planilla no tiene locales: no se guardó.';
  end if;
  if length(v_pl::text) > 3000000 then raise exception 'La planilla es demasiado grande para guardarla.'; end if;
  select pe.nombre into v_nom from orden_personas pe where pe.id = v_yo;
  insert into pos_reparto_planilla (id, de, datos, cargada_en, cargada_por, cargada_nombre)
  values (true, v_de, v_pl, v_en, v_yo, v_nom)
  on conflict (id) do update set de = excluded.de, datos = excluded.datos, cargada_en = excluded.cargada_en,
                                 cargada_por = excluded.cargada_por, cargada_nombre = excluded.cargada_nombre;
  return jsonb_build_object('cargada_en', v_en, 'cargada_nombre', v_nom);
end $function$;
REVOKE ALL ON FUNCTION public.pos_reparto_planilla_guardar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_reparto_planilla_guardar(jsonb) TO authenticated;

/* Anotar un reparto que terminó en remitos: p = { clave, forma, prendas, productos: [ … ], … }. Con la misma clave no se repite. */
CREATE OR REPLACE FUNCTION public.pos_reparto_anotar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clave text := nullif(btrim(coalesce(p->>'clave', '')), '');
  v_forma text := coalesce(p->>'forma', '');
  v_yo    uuid := orden_yo_id();
  v_id    bigint;
begin
  perform pos_fabrica_ok();
  if v_clave is null or length(v_clave) > 80 then raise exception 'Falta la clave del reparto.'; end if;
  if v_forma not in ('fam', 'rub', 'gen', 'mix', 'nec', 'par') then raise exception 'No conozco esa forma de repartir.'; end if;
  if jsonb_typeof(p->'productos') <> 'array' or jsonb_array_length(p->'productos') = 0 then raise exception 'El reparto no tiene productos.'; end if;
  if length(p::text) > 2000000 then raise exception 'El reparto es demasiado grande para anotarlo.'; end if;
  select r.id into v_id from pos_repartos r where r.clave = v_clave;
  if found then return jsonb_build_object('id', v_id, 'ya', true); end if;
  insert into pos_repartos (clave, creado_por, creado_nombre, forma, prendas, datos)
  values (v_clave, v_yo, (select pe.nombre from orden_personas pe where pe.id = v_yo), v_forma,
          greatest(coalesce(nullif(p->>'prendas', '')::integer, 0), 0), p - 'clave')
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ya', false);
end $function$;
REVOKE ALL ON FUNCTION public.pos_reparto_anotar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_reparto_anotar(jsonb) TO authenticated;

/* El historial: los repartos de un período (los últimos 300), del más nuevo al más viejo. */
CREATE OR REPLACE FUNCTION public.pos_repartos_ver(p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_fabrica_ok();
  return jsonb_build_object('filas', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'creado_en', x.creado_en, 'dia', x.dia, 'creado_nombre', x.creado_nombre,
                                        'forma', x.forma, 'prendas', x.prendas, 'datos', x.datos) order by x.id desc)
      from (select r.* from pos_repartos r where r.dia between p_desde and p_hasta order by r.id desc limit 300) x), '[]'::jsonb));
end $function$;
REVOKE ALL ON FUNCTION public.pos_repartos_ver(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_repartos_ver(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
