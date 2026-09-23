-- VDH · Sistema No Compra — los beneficios.
--
-- Correr DESPUÉS de sincronia.sql.
--
-- Reemplaza a la planilla "VDH cupones", que tenía dos solapas de 355 y 310
-- filas prenumeradas y, en meses de uso, **una sola fila escrita en cupones y
-- tres en gift cards**. Eso no es un sistema: es un cuaderno que casi nadie
-- abrió, y la razón es la fricción —había que buscar la planilla, encontrar
-- la fila libre, y acordarse de volver a tacharla al canjear—.
--
-- ══════════════════════════════════════════════════════════════════════════
-- SON DOS COSAS DISTINTAS, Y ESO ES TODO EL DISEÑO
-- ══════════════════════════════════════════════════════════════════════════
--
--   DESCUENTO                        GIFT CARD
--   Se REGALA para recuperar         Se VENDE: el cliente paga
--   una venta que se perdió
--   Vale para el cliente que se fue  Vale para EL QUE LA TENGA EN LA MANO
--   La llave es su TELÉFONO          La llave es el NÚMERO DE LA TARJETA
--   Es un porcentaje                 Es plata ya cobrada
--
-- **La gift card casi siempre es un regalo para otra persona.** Por eso NO se
-- puede atar al teléfono de quien la compró: el que la recibe no podría
-- usarla. Su llave es el número impreso en la tarjeta física, que es lo único
-- que el portador puede presentar en el mostrador.
--
-- Y por eso la app NO genera el número: lo lee de la tarjeta que el vendedor
-- tiene en la mano. El talonario existe en papel; acá se registra cuál se
-- vendió, por cuánto y a quién.
--
-- ══════════════════════════════════════════════════════════════════════════
-- DOS MONTOS, NO UNO
-- ══════════════════════════════════════════════════════════════════════════
-- Pagando en efectivo hay 10% de descuento: una gift card de $100.000 le sale
-- $90.000 al cliente y se canjea por $100.000. Guardar un solo número obliga
-- a elegir cuál de los dos se pierde, y los dos hacen falta: `valor` es lo que
-- el local le debe al portador, `cobrado` es lo que entró a la caja.


-- ════════════════════════════════════════════════════════════════════════
-- LO QUE ESTO JUBILA
--
-- El beneficio vivía como cinco columnas sobre `registros`. Se van, y no se
-- dejan "por las dudas": una columna muerta que parece viva es una invitación
-- a escribir ahí, y entonces la app dice una cosa y la tabla otra.
--
-- Lo que SÍ se queda es la venta recuperada —`compro`, `monto`,
-- `producto_final`—, que es el desenlace del no-compra y no del beneficio.
-- ════════════════════════════════════════════════════════════════════════

/* La política de carga miraba `beneficio_dado is null` para que nadie
   pudiera insertar un registro con un beneficio ya puesto. Esa condición se
   queda sin objeto —el beneficio ya no vive acá— y además impide borrar la
   columna. Se rehace sin ella; todo lo demás que revisaba sigue igual. */
drop policy if exists "cargar un no-compra" on registros;

alter table registros
  drop column if exists beneficio_pct,
  drop column if exists beneficio_dado,
  drop column if exists beneficio_usado,
  drop column if exists beneficio_local,
  drop column if exists beneficio_vendedor;


/* Postgres no tiene "create type if not exists". Este archivo se corre
   entero cada vez que se toca algo de acá, y un error en la primera línea
   deja todo lo de abajo sin aplicar. */
do $tipos$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_beneficio') then
    create type tipo_beneficio as enum ('descuento', 'giftcard');
  end if;
  -- Las formas de pago de la gift card, tal como están en el instructivo.
  if not exists (select 1 from pg_type where typname = 'forma_pago') then
    create type forma_pago as enum ('efectivo', 'tarjeta', '3 cuotas', '6 cuotas', 'otro');
  end if;
end
$tipos$;


create policy "cargar un no-compra"
  on registros for insert
  to anon
  with check (
    /* Que no puedan escribir un registro ya resuelto: el vendedor carga un
       cliente que se va, no una venta cerrada ni un seguimiento hecho. */
    not compro
    and estado is null
    and not contactado
    and length(trim(sucursal)) > 0
    and length(trim(vendedor)) > 0
    and length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) >= 8
  );



-- ════════════════════════════════════════════════════════════════════════
-- LA TABLA
--
-- Antes el beneficio eran cinco columnas sobre `registros`. Eso alcanzaba
-- para el descuento —el cliente YA es un registro— pero no para la gift
-- card: **nadie se fue sin comprar, alguien compró.** No hay registro al
-- que colgarla.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists beneficios (
  id      bigint generated always as identity primary key,
  tipo    tipo_beneficio not null,
  creado  timestamptz not null default now(),

  -- ── De quién es ──
  -- El descuento nace de un no-compra: de ahí salen el nombre y el teléfono.
  -- La gift card puede no tener ninguno de los dos, y está bien.
  registro bigint references registros(id) on delete set null,
  telefono text,
  nombre   text,

  -- ── La llave de la gift card ──
  -- El número impreso en la tarjeta física. No se genera acá.
  serie text,

  -- ── Cuánto ──
  pct     smallint check (pct between 1 and 100),   -- descuento
  valor   numeric(12,2) check (valor > 0),          -- gift card: lo que se puede canjear
  cobrado numeric(12,2) check (cobrado >= 0),       -- gift card: lo que entró a la caja
  pago    forma_pago,

  -- ── Hasta cuándo ──
  -- 30 días desde la compra, y se puede extender si el cliente lo necesita.
  vence date,

  -- ── Quién lo dio o lo vendió ──
  local    text,
  vendedor text,

  -- ── El canje ──
  usado          timestamptz,
  local_canje    text,
  vendedor_canje text,
  monto_compra   numeric(12,2),   -- cuánto se llevó el cliente al canjearlo

  -- ── Y si se anula ──
  anulado     timestamptz,
  anulado_por text,
  motivo_anul text,

  obs text,

  /* Un descuento sin porcentaje, o una gift card sin número o sin valor, son
     estados imposibles. Que no entren es más barato que descubrirlos tres
     meses después en un arqueo. */
  constraint descuento_bien_formado check (
    tipo <> 'descuento' or (pct is not null and serie is null)),
  constraint giftcard_bien_formada check (
    tipo <> 'giftcard' or (serie is not null and valor is not null and pct is null)),

  -- Canjear sin decir dónde deja un agujero en el arqueo del local.
  constraint canje_con_local check (usado is null or local_canje is not null),
  constraint anulado_con_quien check (anulado is null or anulado_por is not null)
);

/* Una serie no se puede vender dos veces. Es EL control que la planilla no
   tenía: ahí la fila 00003 aparece escrita en las dos solapas, cupones y
   gift cards, con los mismos datos. Nadie lo impedía. */
create unique index if not exists beneficios_serie on beneficios (upper(trim(serie)))
  where serie is not null;

/* Y un cliente no puede tener DOS descuentos sin usar a la vez. El de papel
   no podía evitarlo —se le daban dos cupones y listo—; acá sí. */
create unique index if not exists beneficios_un_descuento_vivo on beneficios
  (regexp_replace(telefono, '[^0-9]', '', 'g'))
  where tipo = 'descuento' and usado is null and anulado is null;

-- Buscar por teléfono en el mostrador: sobre el número pelado, porque nadie
-- lo dicta dos veces igual.
create index if not exists beneficios_telefono on beneficios
  (regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'));

-- Lo que está vivo: es plata comprometida y lo que mira el listado.
create index if not exists beneficios_vivos on beneficios (creado desc)
  where usado is null and anulado is null;


-- ════════════════════════════════════════════════════════════════════════
-- EL CUPÓN AL PORTADOR
--
-- Un descuento tiene ahora DOS formas, y no son dos tipos: es el mismo
-- beneficio con distinta llave.
--
--   ATADO AL CLIENTE (lo de siempre)     AL PORTADOR (el cupón)
--   La llave es su TELÉFONO              La llave es un CÓDIGO
--   Lo usa el que se fue sin comprar     Lo usa EL QUE TENGA EL CÓDIGO
--   Nace de un no-compra                 Lo crea Atención al Cliente
--
-- Se resolvió así y no con un tercer tipo porque el cupón es, punto por
-- punto, un descuento que además se puede regalar: mismo estado calculado,
-- mismo canje atómico, misma anulación, mismas estadísticas. Un tipo nuevo
-- habría duplicado las cinco cosas para agregar una columna.
--
-- ── Por qué el código es largo ───────────────────────────────────────────
-- La serie de la gift card puede ser corta y correlativa porque **lo que
-- autoriza el canje es la tarjeta de papel**, no el número; el número sólo
-- sirve para encontrarla. Acá no hay papel: el código ES la credencial, y
-- quien lo adivine se lleva el descuento. Por eso son ocho caracteres al
-- azar y no cuatro: con cuatro son un millón de combinaciones y mil cupones
-- vivos hacen que uno de cada mil intentos acierte.
-- ════════════════════════════════════════════════════════════════════════

alter table beneficios
  -- VDH-XXXX-XXXX. Sólo lo tienen los descuentos al portador.
  add column if not exists codigo text,

  -- Quién lo creó, para poder medir por persona de Atención al Cliente. Va
  -- el uid y no el mail: el mail se puede cambiar desde la cuenta.
  add column if not exists creado_por uuid references auth.users(id) on delete set null,

  -- Condiciones que se muestran y se validan al canjear.
  add column if not exists compra_minima numeric(12,2) check (compra_minima > 0),

  /* En qué locales vale. NULL = en todos. Se guarda como arreglo y no como
     tabla aparte porque son cinco nombres y no se consultan al revés: nunca
     hace falta "qué cupones valen en Rivadavia". */
  add column if not exists locales text[],

  /* No acumulable por defecto: es la regla sana, y el que quiera lo
     contrario tiene que pedirlo a mano.

     OJO CON LO QUE ESTO ES Y LO QUE NO ES. El sistema no conoce la compra:
     el monto lo tipea el vendedor al canjear. Así que esto NO puede impedir
     que alguien aplique dos promociones sobre el mismo ticket. Lo que sí
     hace, y es lo que importa, es que el canje lo muestre en pantalla y que
     un cliente no pueda tener dos beneficios vivos al mismo tiempo (índice
     más abajo). Lo demás es condición declarada, como la compra mínima. */
  add column if not exists acumulable boolean not null default false,

  -- ── Preparado para Tienda Nube, sin implementar ──
  -- El id del cupón del otro lado. El CÓDIGO es el mismo string en los dos
  -- sistemas; esto es el identificador interno de allá, para poder pedirle
  -- que lo dé de baja cuando se canjea acá.
  add column if not exists externo_id text,
  -- Por dónde se canjeó. Hoy siempre 'local'; el día que entre la tienda,
  -- 'online'. Sale del canje, no se elige.
  add column if not exists canal_canje text
    check (canal_canje is null or canal_canje in ('local', 'online'));


/* Dos cupones no pueden llamarse igual. Sin mayúsculas ni guiones: el que
   lo dicta por teléfono dice "vdh a7k4 m2p9" y el que lo tipea puede poner
   cualquier cosa en el medio. */
create unique index if not exists beneficios_codigo on beneficios
  (upper(regexp_replace(codigo, '[^A-Za-z0-9]', '', 'g')))
  where codigo is not null;

/* El código es sólo de los descuentos: la gift card ya tiene su serie, y
   dos llaves para la misma cosa es cómo se llega a que una diga disponible
   y la otra usada. */
alter table beneficios drop constraint if exists codigo_solo_en_descuentos;
alter table beneficios add constraint codigo_solo_en_descuentos
  check (codigo is null or tipo = 'descuento');

/* Un descuento tiene que tener UNA llave. Sin teléfono y sin código no hay
   forma de encontrarlo en el mostrador: sería plata comprometida que nadie
   puede cobrar. */
alter table beneficios drop constraint if exists descuento_con_llave;
alter table beneficios add constraint descuento_con_llave
  check (tipo <> 'descuento' or telefono is not null or codigo is not null);

/* Y el canal sólo tiene sentido si se canjeó. */
alter table beneficios drop constraint if exists canal_solo_si_usado;
alter table beneficios add constraint canal_solo_si_usado
  check (canal_canje is null or usado is not null);


/* ── Un beneficio vivo por cliente ──────────────────────────────────────
   El índice de más arriba ya impedía dos descuentos sin usar para el mismo
   teléfono. Con el cupón al portador sigue sirviendo igual: si el cupón
   nace de un cliente, guarda su teléfono como ORIGEN y entra en la cuenta.

   Un cupón de campaña sin teléfono queda afuera, y está bien: no es de
   nadie hasta que alguien lo usa.

   Es la forma enforzable de "no acumulable": no se puede juntar lo que no
   se puede tener a la vez. */


-- ════════════════════════════════════════════════════════════════════════
-- BUSCAR POR CÓDIGO
--
-- Sobre el código pelado, por lo mismo que el teléfono: nadie lo dicta dos
-- veces igual y el guión del medio es decorativo.
-- ════════════════════════════════════════════════════════════════════════

create index if not exists beneficios_codigo_busqueda on beneficios
  (upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g')));


-- ════════════════════════════════════════════════════════════════════════
-- EL ESTADO NO SE GUARDA: SE CALCULA
--
-- "Vencido" como columna es una mentira esperando a pasar: el día que vence
-- nadie la actualiza y la fila sigue diciendo "disponible" para siempre. Es
-- exactamente lo que le pasa a la planilla, donde ESTADO y el tilde de
-- canjeado dicen cosas distintas sobre la misma tarjeta.
--
-- Acá el estado sale de los hechos —si se anuló, si se canjeó, si pasó la
-- fecha— y no puede contradecirlos.
-- ════════════════════════════════════════════════════════════════════════

/* STABLE y no IMMUTABLE: esta función mira la hora. Decirle a Postgres
   que es inmutable lo autoriza a calcularla una sola vez y reusar el
   resultado —una tarjeta quedaría "disponible" para siempre porque el
   planificador congeló el now() de la primera consulta del día—. */
create or replace function estado_de(b beneficios)
returns text
language sql
stable
as $$
  select case
    when b.anulado is not null then 'anulado'
    when b.usado   is not null then 'usado'
    when b.vence is not null and b.vence < (now() at time zone 'America/Argentina/Buenos_Aires')::date
         then 'vencido'
    else 'disponible'
  end
$$;

/* Se baja antes de crearla: si le cambian las columnas, "create or replace"
   no alcanza —Postgres no deja renombrar ni reordenar—. */
drop view if exists v_beneficios;
create view v_beneficios as
  select b.*,
         estado_de(b) as estado,
         -- Cuántos días le quedan. Negativo si ya venció.
         case when b.vence is null then null
              else b.vence - (now() at time zone 'America/Argentina/Buenos_Aires')::date
         end as dias
  from beneficios b;

/* El permiso va acá y no en el archivo de las acciones, y no es un detalle:
   el `drop view` de arriba se lleva puestos los grants. Separados, alcanza
   con volver a correr este archivo solo para que el listado del panel deje
   de andar, y el error —"permission denied for view"— no dice por qué. */
grant select on v_beneficios to authenticated;
