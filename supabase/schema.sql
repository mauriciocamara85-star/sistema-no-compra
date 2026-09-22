-- VDH · Sistema No Compra — el esquema.
--
-- Arranca VACÍO. No se migran los 139 registros de la etapa vieja: casi
-- ninguno tiene motivo cargado, los nombres de los locales son los anteriores
-- y sólo 8 tuvieron seguimiento. Quedan en la planilla, que se conserva para
-- consultarla.
--
-- Por eso acá NO existe la "línea de arranque" que tiene la versión de Sheets:
-- esa función nació para tapar datos viejos y en una base nueva no hay nada
-- que tapar.
--
-- ── Cómo se lee esto ──────────────────────────────────────────────────────
-- Las columnas A–AA de la planilla se vuelven campos con tipo. Donde la
-- planilla guardaba texto que había que parsear —montos con puntos y comas,
-- fechas escritas a mano como "23/4"— acá hay numeric y date, y el parseo
-- deja de existir.

-- ════════════════════════════════════════════════════════════════════════
-- VOCABULARIO
-- Los mismos valores que hoy valida VOCAB en Codigo.gs, pero como tipos: la
-- base rechaza lo que no corresponde en vez de confiar en que el backend lo
-- haya revisado.
-- ════════════════════════════════════════════════════════════════════════

create type motivo_no_compra as enum (
  'Sin talle', 'Sin stock', 'Precio', 'No le gustó', 'Fue a comparar', 'Otro'
);

create type estado_seguimiento as enum (
  'En seguimiento', 'Esperando respuesta',
  'Cerrado - compró', 'Cerrado - no compró', 'Descartado'
);

create type resultado_contacto as enum (
  'Respondió - interesado', 'Respondió - no interesado', 'No respondió'
);

-- La planilla guarda "Sí - local" / "Sí - online" / "No" en una sola celda.
-- Separado en dos campos —si compró, y por dónde— se puede preguntar cada
-- cosa por su lado sin buscar texto adentro de un string.
create type canal_venta as enum ('local', 'online');

create type periodo_objetivo as enum ('dia', 'semana', 'mes');


-- ════════════════════════════════════════════════════════════════════════
-- REGISTROS · el no-compra
-- ════════════════════════════════════════════════════════════════════════

create table registros (
  id          bigint generated always as identity primary key,
  creado      timestamptz not null default now(),

  -- ── Lo que carga el vendedor (A–I y Z en la planilla) ──
  sucursal    text not null,
  vendedor    text not null,
  nombre      text,
  whatsapp    text not null,
  mail        text,
  producto    text,
  talle       text,
  obs         text,
  motivo      motivo_no_compra,

  -- ── Lo que completa el seguimiento (J–V) ──
  -- Hoy el seguimiento se trabaja en Kommo; esto es el registro del
  -- desenlace, no la herramienta para llegar a él.
  contactado       boolean not null default false,
  responsable      text,
  contacto1_fecha  date,
  contacto1_result resultado_contacto,

  -- El segundo contacto queda listo aunque el Panel todavía no lo muestre:
  -- una columna que no existe obliga a una migración; una columna vacía, no.
  contacto2_fecha  date,
  contacto2_canal  text,
  contacto2_result resultado_contacto,

  estado           estado_seguimiento,
  obs_seguimiento  text,

  -- ── El desenlace ──
  compro           boolean not null default false,
  compro_canal     canal_venta,
  producto_final   text,
  monto            numeric(12,2),

  -- ── Del sistema ──
  lead_kommo       text,

  -- Un monto sin venta, o una venta sin canal, son datos rotos: que no
  -- entren es más barato que descubrirlos tres meses después en un informe.
  constraint monto_solo_si_compro check (monto is null or compro),
  constraint canal_solo_si_compro check (compro_canal is null or compro)
);

-- "Pendiente" no es un estado guardado: es no haber sido tocado. Igual que
-- hoy en el panel. Este índice es el que hace barata esa consulta, que es la
-- que corre el recordatorio de la mañana todos los días.
create index registros_pendientes on registros (creado)
  where not contactado and estado is null;

create index registros_sucursal on registros (sucursal, creado desc);
create index registros_lead     on registros (lead_kommo) where lead_kommo is not null;


-- ════════════════════════════════════════════════════════════════════════
-- EQUIPO · quién carga en cada local
-- ════════════════════════════════════════════════════════════════════════

create table equipo (
  id       bigint generated always as identity primary key,
  local    text not null,
  vendedor text not null,
  -- Se desactiva, no se borra: borrar pierde quién lo agregó y cuándo, y deja
  -- los registros viejos de esa persona sin explicación.
  activo   boolean not null default true,
  agregado timestamptz not null default now(),
  por      text
);

-- Una persona por local, sin importar cómo se escribió. Es lo que hace que
-- "Lau", "lau" y " Lau " no sean tres vendedores distintos, que era la razón
-- de ser de clave_() en la versión de Sheets.
create unique index equipo_unico on equipo (lower(trim(local)), lower(trim(vendedor)));


-- ════════════════════════════════════════════════════════════════════════
-- OBJETIVOS · cuántos registros se esperan
-- ════════════════════════════════════════════════════════════════════════

create table objetivos (
  id      bigint generated always as identity primary key,
  -- NULL es el objetivo general: el que rige donde no hay uno propio. En la
  -- planilla esto era una fila con el local vacío, que es lo mismo dicho de
  -- una forma que la base no podía verificar.
  local   text,
  periodo periodo_objetivo not null,
  meta    integer not null check (meta > 0 and meta <= 100000)
);

create unique index objetivos_por_local on objetivos (lower(trim(local)));
create unique index objetivos_general   on objetivos ((true)) where local is null;


-- ════════════════════════════════════════════════════════════════════════
-- LOG · qué cambió, quién y cuándo
-- ════════════════════════════════════════════════════════════════════════

create table log (
  id      bigint generated always as identity primary key,
  cuando  timestamptz not null default now(),
  accion  text not null,
  local   text,
  detalle text,
  quien   text
);


-- ════════════════════════════════════════════════════════════════════════
-- AJUSTES · lo que hoy vive en las propiedades del script
--
-- Sólo lo que NO es secreto: el mail de avisos, el grupo de Telegram. Los
-- tokens de Kommo y de Telegram van a las variables de entorno de las Edge
-- Functions y no entran a la base, por lo mismo que hoy no entran al repo.
-- ════════════════════════════════════════════════════════════════════════

create table ajustes (
  clave text primary key,
  valor text
);


-- ════════════════════════════════════════════════════════════════════════
-- VISTAS
--
-- Acá es donde se paga solo el cambio: Motivos.gs y Resultados.gs recorrían
-- la planilla entera, columna por columna, para contar cuatro cosas. Son
-- estas tres consultas.
-- ════════════════════════════════════════════════════════════════════════

-- Por qué se va la gente. Reemplaza a getMotivos().
create view v_motivos as
  select sucursal, motivo, count(*) as veces
  from registros
  where motivo is not null
  group by sucursal, motivo;

-- El embudo. Reemplaza a getResultados().
create view v_resultados as
  select
    sucursal,
    count(*)                                             as cargados,
    count(*) filter (where contactado or estado is not null) as contactados,
    count(*) filter (where compro)                       as compraron,
    coalesce(sum(monto) filter (where compro), 0)        as recuperado,
    coalesce(sum(monto) filter (where compro and compro_canal = 'local'), 0)  as recuperado_local,
    coalesce(sum(monto) filter (where compro and compro_canal = 'online'), 0) as recuperado_online
  from registros
  group by sucursal;

-- El tablero de cada local. Reemplaza a getMetricas().
create view v_metricas as
  select
    sucursal,
    vendedor,
    count(*) filter (where creado >= date_trunc('day', now()))   as hoy,
    count(*) filter (where creado >= date_trunc('week', now()))  as semana,
    count(*) filter (where creado >= date_trunc('month', now())) as mes,
    count(*)                                                     as total,
    coalesce(sum(monto) filter (where compro and creado >= date_trunc('month', now())), 0) as recuperado_mes,
    coalesce(sum(monto) filter (where compro), 0)                as recuperado_total
  from registros
  group by sucursal, vendedor;
