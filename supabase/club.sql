-- VDH · Club de Clientes.
--
-- Correr DESPUÉS de panel-pin.sql. Es lo último.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LA PRIMERA VERSIÓN ES UNA SOLA REGLA
-- ══════════════════════════════════════════════════════════════════════════
--
--   Una compra confirmada = un sello. Sin monto mínimo. Sin puntos.
--
-- No hay nada más, y es a propósito. Las reglas comerciales —cuántos sellos,
-- qué premio, si vencen— todavía no están definidas, y escribir una máquina
-- de reglas antes de que existan las reglas es adivinar. Lo que sí queda es
-- el lugar donde van a entrar cuando se definan: la tabla `club_reglas`.
--
-- ══════════════════════════════════════════════════════════════════════════
-- EL SALDO NO SE GUARDA: SE CUENTA
-- ══════════════════════════════════════════════════════════════════════════
--
-- No hay una columna `sellos` en el cliente. Los sellos son las filas de
-- `club_movimientos` que no están anuladas.
--
-- Es la misma decisión que el estado de un beneficio, por la misma razón: un
-- contador guardado y un historial son dos fuentes de la misma verdad, y el
-- día que no coinciden no hay forma de saber cuál miente. Y acá encima la
-- regla VA A CAMBIAR —Mauricio ya dijo que quiere evaluar puntos por monto—:
-- con un contador guardado, ese cambio es recalcular y reconciliar todo lo
-- pasado; contando, es cambiar una función.
--
-- Guardar el importe igual, aunque hoy no lo use nadie, es lo que va a hacer
-- posible esa evaluación sin tener que empezar a medir desde cero.
--
-- ══════════════════════════════════════════════════════════════════════════
-- UNA TARJETA PARA LOS 14 LOCALES
-- ══════════════════════════════════════════════════════════════════════════
--
-- El cliente junta y canjea en cualquiera. Es lo mejor para el cliente y es
-- lo que se decidió, pero tiene una consecuencia que conviene tener anotada:
-- **es la decisión más cara de revertir de todas.** Compartida → separada no
-- se puede, porque los sellos ya están mezclados; al revés sí.
--
-- Y va a aparecer una pregunta de negocio el primer mes: si el cliente juntó
-- los sellos en Rivadavia y canjea el premio en Flores, ¿quién se come el
-- costo? Por eso **cada movimiento guarda el local que lo generó**. No
-- contesta la pregunta —esa es de Mauricio— pero deja el dato para poder
-- contestarla, también para atrás.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE ESTO NO ES
-- ══════════════════════════════════════════════════════════════════════════
--
-- No reemplaza la caja. BlueSoft sigue siendo el sistema de facturación y
-- cobro; acá se anota que esa compra existió, con la referencia del ticket
-- para poder ir a buscarla. Un movimiento del club **no es un comprobante de
-- pago**, igual que el registro de una Gift Card no acredita su venta.


-- ════════════════════════════════════════════════════════════════════════
-- LOS CLIENTES
-- ════════════════════════════════════════════════════════════════════════

create table if not exists club_clientes (
  id bigint generated always as identity primary key,

  /* La llave que el cliente muestra en el mostrador. Doce dígitos al azar,
     no correlativos y sin nada adentro: **el código ES la credencial**, y
     quien lo tenga ve la tarjeta. Por eso no puede ser el id ni el teléfono.

     Doce dígitos son 10¹² combinaciones, lo mismo que el código de cupón.
     Y son DÍGITOS y no letras porque así se dibuja como código de barras
     común (Code 128, juego C) en la mitad de ancho: una pistola láser de las
     que ya hay en los locales lo lee, y un lector 2D también. Un QR lo leen
     sólo los 2D. */
  codigo text not null,

  nombre   text not null,
  telefono text not null,
  /* Opcional y hoy no lo usa nadie. Se pide en el alta porque preguntarlo
     después cuesta mucho más que preguntarlo ahora. */
  cumple   date,

  /* De qué local es el QR por el que entró. Es el dato que después dice qué
     local trae más socios. */
  local_alta text,
  creado     timestamptz not null default now(),

  /* ── El consentimiento, como un HECHO y no como un sí/no ──
     Un booleano no alcanza: si mañana alguien pregunta cuándo y cómo aceptó,
     no hay con qué contestar. Son datos personales de consumidores y la ley
     25.326 pide poder demostrarlo. Se puede revocar sin perder que un día
     aceptó, que es justamente lo que hay que poder demostrar. */
  acepta_promos      boolean not null default false,
  consentimiento     timestamptz,
  consentimiento_via text,
  revocado           timestamptz,

  /* Darse de baja del club entero, distinto de revocar las promociones. */
  baja timestamptz
);

/* Un código no se puede repetir: es la llave de la tarjeta. */
create unique index if not exists club_clientes_codigo on club_clientes (codigo);

/* Y un teléfono es un cliente. Sobre el número pelado, porque nadie lo dicta
   dos veces igual — la misma regla que usa el resto del sistema. */
create unique index if not exists club_clientes_telefono on club_clientes
  (regexp_replace(telefono, '[^0-9]', '', 'g'));

comment on table club_clientes is
  'Socios del club. El código es la credencial: quien lo tiene, ve la tarjeta.';


-- ════════════════════════════════════════════════════════════════════════
-- LOS MOVIMIENTOS
--
-- Todo lo que le pasa a una tarjeta es una fila acá: la compra que suma, el
-- ajuste a mano, el canje que resta. **Nada se borra nunca.** Una carga
-- equivocada se anula, y la anulación deja la fila original en su lugar con
-- el motivo al lado — que es lo que permite explicar, tres meses después,
-- por qué el saldo de alguien cambió.
-- ════════════════════════════════════════════════════════════════════════

do $t$
begin
  if not exists (select 1 from pg_type where typname = 'club_tipo_mov') then
    create type club_tipo_mov as enum ('compra', 'ajuste', 'canje');
  end if;
end
$t$;

create table if not exists club_movimientos (
  id      bigint generated always as identity primary key,
  cliente bigint not null references club_clientes(id) on delete cascade,
  tipo    club_tipo_mov not null default 'compra',
  creado  timestamptz not null default now(),

  /* Cuántos sellos suma (o resta, si es un canje). Hoy toda compra vale 1 y
     nada más; la columna existe para que el día que la regla cambie no haya
     que migrar, no porque hoy se use con otro valor. */
  sellos smallint not null default 1,

  -- ── Dónde y quién ──
  -- Salen del dispositivo, como en la Carga. El local es EL QUE GENERÓ el
  -- sello, y es el dato que va a hacer falta el día que haya que decidir
  -- quién paga el premio.
  local    text,
  vendedor text,

  -- ── La referencia a BlueSoft ──
  /* Para poder ir a buscar la compra cuando haya una duda o un duplicado.
     **No hay índice único todavía, a propósito**: todavía no sabemos si
     BlueSoft repite la numeración entre cajas y entre locales, y poner una
     restricción sobre un dato que no comprobamos es garantizar que el día
     del piloto el vendedor no pueda cargar una compra legítima. Las columnas
     de caja y fecha están para cuando se vea un ticket de verdad; ese día se
     agrega el índice y listo. */
  ticket       text,
  ticket_caja  text,
  ticket_fecha date,

  /* Se guarda aunque la regla de hoy no lo mire: es lo único que va a
     permitir evaluar "puntos por monto" con datos de verdad en vez de
     empezar a medir desde cero el día que se decida. */
  importe numeric(12,2) check (importe is null or importe >= 0),

  -- ── Si fue un error ──
  anulado     timestamptz,
  anulado_por text,
  motivo_anul text,

  obs text,

  constraint anulado_con_quien check (anulado is null or anulado_por is not null)
);

create index if not exists club_mov_cliente on club_movimientos (cliente, creado desc);
create index if not exists club_mov_vivos on club_movimientos (creado desc) where anulado is null;
/* Para encontrar un ticket repetido a mano mientras no haya índice único. */
create index if not exists club_mov_ticket on club_movimientos
  (upper(trim(ticket))) where ticket is not null and anulado is null;

comment on table club_movimientos is
  'Una fila por compra, ajuste o canje. El saldo de sellos se cuenta de acá.';


-- ════════════════════════════════════════════════════════════════════════
-- LAS REGLAS, TODAVÍA SIN DEFINIR
--
-- Arranca VACÍA y eso es correcto, no un olvido. Mientras no haya meta, la
-- tarjeta le muestra al cliente cuántas compras lleva y no le promete
-- ningún premio. Prometer algo que todavía no se decidió es peor que no
-- prometer nada.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists club_reglas (
  clave text primary key,
  valor text
);

insert into club_reglas (clave, valor) values
  ('meta_sellos', null),      -- cuántos sellos para el premio
  ('premio',      null),      -- qué se lleva, escrito como se le dice al cliente
  ('vence_dias',  null)       -- null = no vencen
on conflict (clave) do nothing;


-- ════════════════════════════════════════════════════════════════════════
-- LA TARJETA, CALCULADA
--
-- `confirmado` es lo que separa un alta pública de un cliente de verdad: es
-- tener al menos una compra sin anular. Un alta sin compras no suma sellos y
-- no entra en las métricas, así que alguien cargando socios falsos desde
-- afuera no ensucia nada ni cuesta plata. Y NO se borra sola: la regla de
-- limpieza todavía no está definida y borrar por las dudas es la forma de
-- perder a alguien que se anotó y todavía no volvió.
-- ════════════════════════════════════════════════════════════════════════

drop view if exists v_club_clientes;
create view v_club_clientes as
  select c.*,
         coalesce(m.sellos, 0)::integer as sellos,
         coalesce(m.compras, 0)::integer as compras,
         m.ultima_compra,
         (coalesce(m.compras, 0) > 0) as confirmado
    from club_clientes c
    left join lateral (
      select sum(sellos) as sellos,
             count(*) filter (where tipo = 'compra') as compras,
             max(creado) filter (where tipo = 'compra') as ultima_compra
        from club_movimientos
       where cliente = c.id and anulado is null
    ) m on true;


-- ════════════════════════════════════════════════════════════════════════
-- EL CÓDIGO DE LA TARJETA
--
-- Doce dígitos del generador criptográfico. No es un número de socio: es una
-- credencial, y quien la tiene ve la tarjeta. Por eso no es correlativo —un
-- correlativo se recorre— y por eso sale de gen_random_uuid() y no de
-- random(), que es predecible conociendo algunos valores anteriores.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_codigo()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $cc$
declare
  crudo   bytea;
  salida  text;
  i       integer;
  intento integer := 0;
begin
  loop
    intento := intento + 1;
    crudo := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    salida := '';
    for i in 0..11 loop
      salida := salida || (get_byte(crudo, i) % 10)::text;
    end loop;

    exit when not exists (select 1 from club_clientes where codigo = salida);
    if intento >= 20 then
      raise exception 'No pude generar un código libre en 20 intentos.';
    end if;
  end loop;
  return salida;
end;
$cc$;

revoke execute on function club_codigo() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- ANOTARSE
--
-- Lo llama la página pública, sin sesión y sin PIN: es un cliente parado en
-- el local con el celular en la mano.
--
-- **Si el teléfono ya está anotado, NO devuelve la tarjeta.** Es la regla que
-- parece un detalle y es lo único que separa esto de un buscador de personas:
-- si la devolviera, cualquiera tipeando un número ajeno se llevaría la
-- tarjeta de otro. Quien perdió el enlace lo recupera en el local, que es
-- donde alguien puede mirarle la cara.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_alta(
  p_nombre   text,
  p_telefono text,
  p_local    text default null,
  p_cumple   date default null,
  p_acepta   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ca$
declare
  tel   text;
  nom   text;
  cod   text;
  nid   bigint;
begin
  nom := nullif(trim(coalesce(p_nombre, '')), '');
  tel := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');

  if nom is null then raise exception 'Falta el nombre.'; end if;
  if length(tel) < 8 then raise exception 'Ese WhatsApp no parece completo.'; end if;

  if exists (select 1 from club_clientes
              where regexp_replace(telefono, '[^0-9]', '', 'g') = tel) then
    /* Sin código y sin nombre. La tarjeta NO se devuelve acá: quien se
       está anotando escribió un nombre que puede no ser el suyo. Lo que
       hace la pantalla con esto es pedir club_recuperar con el mismo
       teléfono, que es la puerta pensada para esto. */
    return jsonb_build_object('alta', false, 'ya_estaba', true,
      'porque', 'Ese número ya tiene tarjeta. Te la abrimos.');
  end if;

  cod := club_codigo();

  insert into club_clientes (
    codigo, nombre, telefono, cumple, local_alta,
    acepta_promos, consentimiento, consentimiento_via
  ) values (
    cod, nom, trim(p_telefono), p_cumple, nullif(trim(coalesce(p_local, '')), ''),
    coalesce(p_acepta, false),
    case when coalesce(p_acepta, false) then now() else null end,
    case when coalesce(p_acepta, false)
         then 'alta web' || coalesce(' · ' || nullif(trim(coalesce(p_local, '')), ''), '')
         else null end
  )
  returning id into nid;

  return jsonb_build_object('alta', true, 'codigo', cod, 'nombre', nom);
end;
$ca$;

grant execute on function club_alta(text, text, text, date, boolean) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- LA TARJETA
--
-- Por CÓDIGO y sólo por código. Es lo que abre el enlace que el cliente se
-- guardó, y lo que ve el vendedor cuando escanea.
--
-- No devuelve el teléfono: la tarjeta la abre cualquiera que tenga el enlace
-- —el cliente se lo puede haber mandado a alguien— y el teléfono no hace
-- falta para nada de lo que esta pantalla muestra.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  select case when c.id is null then jsonb_build_object('hay', false)
         else jsonb_build_object(
           'hay', true,
           'codigo', c.codigo,
           'nombre', c.nombre,
           'sellos', c.sellos,
           'compras', c.compras,
           'confirmado', c.confirmado,
           'desde', c.creado,
           'ultima_compra', c.ultima_compra,
           'meta', (select valor::integer from club_reglas where clave = 'meta_sellos'),
           'premio', (select valor from club_reglas where clave = 'premio'),
           /* Las últimas compras, para que el cliente pueda reconocerlas. Sin
              el ticket ni el importe: no es un resumen de cuenta, es "tu
              sello del martes en Rivadavia". */
           'ultimas', coalesce((
              select jsonb_agg(jsonb_build_object('cuando', m.creado, 'local', m.local)
                               order by m.creado desc)
                from (select creado, local from club_movimientos
                       where cliente = c.id and anulado is null and tipo = 'compra'
                       order by creado desc limit 5) m), '[]'::jsonb)
         ) end
    from (select * from v_club_clientes
           where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
             and baja is null) c
   right join (select 1) z on true
   limit 1
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


/* Las reglas, para que la página pública sepa si hay meta que mostrar. No
   son un secreto: es lo que dice el cartel del local. */
create or replace function club_reglas_ver()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(clave, valor), '{}'::jsonb) from club_reglas
$$;

grant execute on function club_reglas_ver() to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- LA PANTALLA DEL VENDEDOR
--
-- Todo lo de acá abajo pide el PIN: el mismo que abre el Panel y Beneficios.
-- Nada de esto se puede hacer desde la página del cliente.
--
-- ── Cómo se identifica al cliente: las DOS formas, siempre ──
--
--   1. Escaneando el código de barras de la tarjeta.
--   2. Buscando por teléfono o por nombre.
--
-- Las dos están porque todavía no sabemos si la primera funciona. Las
-- pistolas que hay en los locales son láser: leen códigos de barras comunes
-- —por eso el código de la tarjeta es un Code 128 y no un QR, que un láser
-- no puede leer nunca— pero las pistolas láser casi no leen de la pantalla
-- de un celular. Eso se comprueba con una prueba de dos minutos en un local,
-- no discutiéndolo.
--
-- Y aunque la pistola lea, la búsqueda por teléfono tiene que quedar igual:
-- el cliente va a llegar alguna vez con el celular sin batería, y **el
-- teléfono se lo sabe de memoria**.
--
-- Para esta función las dos formas son la misma: el lector escribe los doce
-- dígitos en el campo como si los tipeara alguien. No hay nada que detectar.
-- ════════════════════════════════════════════════════════════════════════

/* Buscar al cliente en el mostrador: por teléfono, por nombre o por código.

   Esto SÍ es un buscador de personas, y por eso está detrás del PIN y no en
   la página pública: es la diferencia entre que lo use el vendedor con el
   cliente adelante y que lo use cualquiera desde internet. */
create or replace function club_buscar(p_pin text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cb$
declare
  dig text;
  txt text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  dig := regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g');
  txt := lower(trim(coalesce(p_texto, '')));
  if length(txt) < 3 then
    return jsonb_build_object('corto', true,
      'porque', 'Escribí el teléfono entero o al menos 3 letras del nombre.');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', codigo, 'nombre', nombre, 'telefono', telefono,
             'sellos', sellos, 'compras', compras, 'confirmado', confirmado)
           order by confirmado desc, creado desc)
      from (
        select * from v_club_clientes
         where baja is null
           and ( (length(dig) >= 8 and regexp_replace(telefono, '[^0-9]', '', 'g') = dig)
              or (length(dig) = 12 and codigo = dig)
              or (length(txt) >= 3 and lower(nombre) like '%' || txt || '%') )
         order by creado desc
         limit 10
      ) t
  ), '[]'::jsonb);
end;
$cb$;

grant execute on function club_buscar(text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- SUMAR UNA COMPRA
--
-- Una compra confirmada = un sello. Sin monto mínimo, sin puntos, sin nada
-- más. Es toda la mecánica de la primera versión.
--
-- ── Sobre el ticket repetido: avisa, no impide ──
-- Todavía no sabemos si BlueSoft repite la numeración entre cajas y entre
-- locales. Si esto BLOQUEARA, el día del piloto un vendedor no podría cargar
-- una compra legítima y el club se caería en el mostrador con el cliente
-- adelante.
--
-- Así que la primera vez contesta "ese ticket ya está cargado" con los datos
-- del anterior, y el vendedor decide: si fue apretar dos veces, no insiste;
-- si de verdad es otra caja que repite numeración, vuelve a mandar con
-- `p_confirmar`. El día que se vea un ticket de verdad se sabrá si la llave
-- es (local, ticket, fecha) o hace falta la caja, y ahí sí puede pasar a ser
-- un índice único que no moleste a nadie.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_sumar_compra(
  p_pin       text,
  p_codigo    text,
  p_local     text,
  p_vendedor  text,
  p_ticket    text default null,
  p_importe   numeric default null,
  p_confirmar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cs$
declare
  c     v_club_clientes%rowtype;
  vieja club_movimientos%rowtype;
  nid   bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into c from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('sumado', false, 'porque', 'No encontré esa tarjeta.');
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then
    raise exception 'Falta el local.';
  end if;

  /* Mismo ticket y mismo local, sin anular: casi siempre es el mismo vendedor
     apretando dos veces. Se avisa con los datos del anterior para que se vea
     si fue eso o si de verdad es otra compra. */
  if p_ticket is not null and length(trim(p_ticket)) > 0 and not coalesce(p_confirmar, false) then
    select * into vieja from club_movimientos
     where anulado is null
       and upper(trim(ticket)) = upper(trim(p_ticket))
       and upper(trim(coalesce(local, ''))) = upper(trim(p_local))
     limit 1;
    if found then
      return jsonb_build_object('sumado', false, 'duplicado', true,
        'porque', 'Ese ticket ya está cargado en ' || trim(p_local) || '.',
        'anterior', jsonb_build_object('cuando', vieja.creado, 'vendedor', vieja.vendedor,
                                       'importe', vieja.importe));
    end if;
  end if;

  insert into club_movimientos (cliente, tipo, sellos, local, vendedor, ticket, importe)
  values (c.id, 'compra', 1, trim(p_local),
          nullif(trim(coalesce(p_vendedor, '')), ''),
          nullif(trim(coalesce(p_ticket, '')), ''),
          p_importe)
  returning id into nid;

  return jsonb_build_object('sumado', true, 'movimiento', nid,
    'nombre', c.nombre, 'sellos', c.sellos + 1,
    'meta', (select valor::integer from club_reglas where clave = 'meta_sellos'));
end;
$cs$;

grant execute on function club_sumar_compra(text, text, text, text, text, numeric, boolean)
  to anon, authenticated;


/* Anular una carga equivocada. NO borra: deja la fila con el motivo al lado,
   que es lo que permite explicar tres meses después por qué el saldo de
   alguien cambió. Mismo criterio que los beneficios. */
create or replace function club_anular_movimiento(
  p_pin text, p_id bigint, p_quien text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cn$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_quien, ''))) = 0 then raise exception 'Falta quién lo anula.'; end if;

  update club_movimientos
     set anulado = now(), anulado_por = trim(p_quien),
         motivo_anul = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p_id and anulado is null;

  get diagnostics tocadas = row_count;
  if tocadas = 0 then
    return jsonb_build_object('anulado', false, 'porque', 'ya estaba anulado o no existe');
  end if;
  return jsonb_build_object('anulado', true);
end;
$cn$;

grant execute on function club_anular_movimiento(text, bigint, text, text) to anon, authenticated;


/* Los últimos movimientos de una tarjeta, para poder anular el equivocado.
   Con el ticket y el importe, que la tarjeta del cliente no muestra. */
create or replace function club_movimientos_de(p_pin text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cm$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'cuando', m.creado, 'local', m.local, 'vendedor', m.vendedor,
             'ticket', m.ticket, 'importe', m.importe, 'sellos', m.sellos,
             'anulado', m.anulado, 'motivo', m.motivo_anul)
           order by m.creado desc)
      from (
        select * from club_movimientos
         where cliente = (select id from club_clientes
                           where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g'))
         order by creado desc limit 20
      ) m
  ), '[]'::jsonb);
end;
$cm$;

grant execute on function club_movimientos_de(text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- LAS TABLAS QUEDAN CERRADAS
--
-- Nada se lee ni se escribe directo: todo pasa por las funciones de arriba,
-- que verifican el código o el PIN. Es lo mismo que se hizo con `registros`,
-- y por lo mismo: acá adentro hay nombres y teléfonos.
-- ════════════════════════════════════════════════════════════════════════

alter table club_clientes    enable row level security;
alter table club_movimientos enable row level security;
alter table club_reglas      enable row level security;

revoke all on club_clientes    from anon, authenticated;
revoke all on club_movimientos from anon, authenticated;
revoke all on club_reglas      from anon, authenticated;
revoke all on v_club_clientes  from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- LOS HITOS
--
-- La tarjeta no tiene un solo premio al final: tiene PARADAS en el camino.
-- Hoy son dos —a las 5 compras y a las 10— y son PROVISORIAS: están para
-- poder mostrar el recorrido, no porque estén decididas. Se cambian acá con
-- un update y la tarjeta se entera sola.
--
-- ── Lo que hace que esto no sea un "sello y volvé a empezar" ──
-- **Canjear el de 5 NO reinicia el avance hacia 10.** Es la regla que más
-- condiciona el modelo, y por eso un canje NO resta sellos: anota qué hito
-- se llevó y el contador sigue subiendo.
--
-- Si el canje restara —que es como funciona la tarjeta de sellos de toda la
-- vida— el cliente que se lleva el perfume a las 5 volvería a cero y tendría
-- que juntar 10 más para la remera. Sería otro programa, mucho menos
-- generoso, y no es el que se pidió.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists club_hitos (
  sellos smallint primary key check (sellos > 0),
  premio text not null,
  activo boolean not null default true
);

/* PROVISORIOS. Puestos para poder mostrar y probar el recorrido; se cambian
   con un update cuando se decidan de verdad. */
insert into club_hitos (sellos, premio) values
  (5,  'Un perfume'),
  (10, 'Una remera')
on conflict (sellos) do nothing;

update club_reglas set valor = '10' where clave = 'meta_sellos' and valor is null;

/* El premio suelto de club_reglas queda sin uso: los premios viven en
   club_hitos, que es donde pueden ser varios. Se deja la fila para no
   romper nada que la lea, en null. */


/* Qué hito se llevó un canje. Null en las compras y en los ajustes. */
alter table club_movimientos
  add column if not exists hito smallint;

/* Un hito se canjea UNA sola vez por cliente. Es la regla que impide que
   alguien se lleve dos perfumes con los mismos cinco sellos. */
create unique index if not exists club_mov_hito_unico on club_movimientos (cliente, hito)
  where tipo = 'canje' and hito is not null and anulado is null;

/* Un canje no mueve el contador: por eso sellos va en 0 y no en negativo. */
alter table club_movimientos drop constraint if exists canje_no_resta;
alter table club_movimientos add constraint canje_no_resta
  check (tipo <> 'canje' or sellos = 0);


-- ════════════════════════════════════════════════════════════════════════
-- LA TARJETA, AHORA CON LAS PARADAS
--
-- Devuelve los hitos con dos banderas por cada uno: si ya se llegó y si ya
-- se retiró. Son distintas —se puede haber llegado a las 5 y no haber ido a
-- buscar el perfume— y la pantalla las muestra distinto.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_tarjeta(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $ct$
  with c as (
    select * from v_club_clientes
     where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g')
       and baja is null
  )
  select case when not exists (select 1 from c) then jsonb_build_object('hay', false)
    else (
      select jsonb_build_object(
        'hay', true,
        'codigo', c.codigo,
        'nombre', c.nombre,
        'sellos', c.sellos,
        'compras', c.compras,
        'confirmado', c.confirmado,
        'desde', c.creado,
        'ultima_compra', c.ultima_compra,
        'meta', (select valor::integer from club_reglas where clave = 'meta_sellos'),

        'hitos', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'sellos', h.sellos,
                   'premio', h.premio,
                   'alcanzado', c.sellos >= h.sellos,
                   'canjeado', exists (
                     select 1 from club_movimientos m
                      where m.cliente = c.id and m.tipo = 'canje'
                        and m.hito = h.sellos and m.anulado is null))
                 order by h.sellos)
            from club_hitos h where h.activo), '[]'::jsonb),

        /* Las últimas compras, para que el cliente las reconozca. Sin el
           ticket ni el importe: no es un resumen de cuenta, es "tu sello del
           martes en Rivadavia". */
        'ultimas', coalesce((
          select jsonb_agg(jsonb_build_object('cuando', m.creado, 'local', m.local)
                           order by m.creado desc)
            from (select creado, local from club_movimientos
                   where cliente = c.id and anulado is null and tipo = 'compra'
                   order by creado desc limit 5) m), '[]'::jsonb)
      ) from c
    ) end
$ct$;

grant execute on function club_tarjeta(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- RETIRAR UN PREMIO
--
-- No resta sellos: anota que ese hito se retiró. El contador sigue subiendo
-- hacia el siguiente.
-- ════════════════════════════════════════════════════════════════════════

create or replace function club_canjear_hito(
  p_pin text, p_codigo text, p_hito smallint, p_local text, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ch$
declare
  c      v_club_clientes%rowtype;
  premio text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into c from v_club_clientes
   where codigo = regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') and baja is null;
  if not found then
    return jsonb_build_object('canjeado', false, 'porque', 'No encontré esa tarjeta.');
  end if;

  select h.premio into premio from club_hitos h where h.sellos = p_hito and h.activo;
  if premio is null then
    return jsonb_build_object('canjeado', false, 'porque', 'Ese premio no existe.');
  end if;

  if c.sellos < p_hito then
    return jsonb_build_object('canjeado', false,
      'porque', 'Todavía le faltan ' || (p_hito - c.sellos)::text || ' compras.');
  end if;

  if exists (select 1 from club_movimientos
              where cliente = c.id and tipo = 'canje' and hito = p_hito and anulado is null) then
    return jsonb_build_object('canjeado', false, 'porque', 'Ese premio ya se lo llevó.');
  end if;

  /* sellos en 0: el canje no mueve el contador. El índice único de
     (cliente, hito) es el que gana la carrera si dos locales lo intentan a
     la vez — el segundo choca y no entra. */
  begin
    insert into club_movimientos (cliente, tipo, sellos, hito, local, vendedor, obs)
    values (c.id, 'canje', 0, p_hito, nullif(trim(coalesce(p_local, '')), ''),
            nullif(trim(coalesce(p_vendedor, '')), ''), premio);
  exception when unique_violation then
    return jsonb_build_object('canjeado', false, 'porque', 'Se lo acaban de entregar en otro lado.');
  end;

  return jsonb_build_object('canjeado', true, 'premio', premio, 'sellos', c.sellos);
end;
$ch$;

grant execute on function club_canjear_hito(text, text, smallint, text, text) to anon, authenticated;

revoke all on club_hitos from anon, authenticated;
alter table club_hitos enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- RECUPERAR LA TARJETA CON EL TELÉFONO
--
-- Decisión de Mauricio, 24/09/2026, después de quedarse afuera de su propia
-- tarjeta y no poder volver a entrar sin ayuda de un vendedor.
--
-- Hasta acá el modelo era: el código de 12 dígitos ES la credencial, y el
-- alta con un teléfono ya anotado NO devolvía la tarjeta, porque tipear el
-- número de otro te la habría dado. Eso era correcto y era caro: el cliente
-- que perdía el enlace dependía de que alguien con el PIN se la mandara, y
-- eso en la práctica no pasa. El sistema de la Fuente de Oro —la referencia
-- que puso Mauricio— resuelve con el teléfono y nada más.
--
-- ASÍ QUE ESTO ES UN CAMBIO DE MODELO, NO UN AGREGADO. A partir de acá:
--
--   el teléfono también es una credencial.
--
-- Lo que eso cuesta, para que quede escrito y nadie lo "descubra" después:
-- cualquiera que tenga el teléfono de una persona puede ver su nombre, sus
-- sellos y en qué locales compró, y puede presentarse a retirar su premio.
-- Se aceptó a ojos abiertos: son sellos de una tienda de ropa, no una cuenta
-- bancaria, y el costo de NO poder recuperarla ya se midió en la práctica.
--
-- Lo único que sí había que frenar es el BARRIDO: sin freno, alguien recorre
-- números de a miles y se lleva la base de clientes entera. Por eso hay un
-- límite por origen, y por eso el límite cuenta los intentos FALLIDOS: el
-- dueño de un teléfono lo escribe bien a la primera, el que barre falla casi
-- siempre.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists club_recuperos (
  id       bigserial primary key,
  origen   text not null,
  encontro boolean not null,
  cuando   timestamptz not null default now()
);

-- El teléfono NO se guarda. El registro existe para contar intentos, no para
-- dejar anotado qué números probó alguien: eso sería exactamente la lista que
-- este freno está para que nadie arme.
create index if not exists ix_club_recuperos_origen
  on club_recuperos (origen, cuando desc);

alter table club_recuperos enable row level security;
-- Sin políticas: nadie la lee ni la escribe desde afuera. La escribe la
-- función, que es security definer.

/* De dónde vino el pedido. PostgREST deja los encabezados en
   request.headers; el primero de x-forwarded-for es el cliente y los que
   siguen son los proxies. Si no hay —una corrida a mano desde psql— queda
   'desconocido', que comparte cupo con cualquier otro sin encabezado y está
   bien que así sea. */
create or replace function club_origen()
returns text
language sql
stable
as $co$
  select coalesce(
    nullif(split_part(
      coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      ',', 1), ''),
    'desconocido')
$co$;


create or replace function club_recuperar(p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cr$
declare
  tel    text;
  org    text;
  fallos integer;
  c      v_club_clientes%rowtype;
  /* found lo pisa CUALQUIER sentencia, el insert de abajo incluido. Sin
     guardarlo antes, el 'if not found' del final estaría mirando si el
     insert insertó —siempre sí— y nunca contestaría que no hay tarjeta. */
  hallado boolean;
begin
  tel := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  org := club_origen();

  /* Ocho dígitos es el mismo piso que usa el alta. Un número corto no se
     cuenta como intento: es un error de tipeo, no una prueba. */
  if length(tel) < 8 then
    return jsonb_build_object('hay', false, 'corto', true,
      'porque', 'Escribí tu WhatsApp completo, con la característica y sin el 0.');
  end if;

  /* Diez fallos por origen cada quince minutos. Una persona escribe su
     número una vez; quien barre falla casi siempre, así que se queda sin
     cupo enseguida. El que YA encontró su tarjeta no gasta cupo. */
  select count(*) into fallos
    from club_recuperos
   where origen = org and not encontro and cuando > now() - interval '15 minutes';

  if fallos >= 10 then
    raise exception 'Probaste muchos números seguidos. Esperá un rato y volvé a intentar.'
      using errcode = '54000';
  end if;

  select * into c from v_club_clientes
   where regexp_replace(telefono, '[^0-9]', '', 'g') = tel
     and baja is null
   limit 1;

  hallado := found;
  insert into club_recuperos (origen, encontro) values (org, hallado);

  if not hallado then
    return jsonb_build_object('hay', false,
      'porque', 'No encontramos ninguna tarjeta con ese número.');
  end if;

  /* Devuelve el CÓDIGO y nada más. La tarjeta la arma club_tarjeta, que ya
     existe y es la única que sabe cómo se ve: dos funciones devolviendo la
     misma tarjeta se separan el día que alguien toca una sola. Y de paso la
     página termina con el código en la dirección, que es lo que hace que se
     pueda agregar a la pantalla del celular. */
  return jsonb_build_object('hay', true, 'codigo', c.codigo, 'nombre', c.nombre);
end;
$cr$;

grant execute on function club_recuperar(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- LA PROMO DEL CLUB
--
-- Un cartel que Mauricio escribe en Configuración y que ve todo el que abre
-- su tarjeta: "sólo por hoy, 30% off en remeras".
--
-- Es un DATO, no una versión de la app. No hay que publicar nada ni esperar
-- a que nadie actualice: la tarjeta lo lee cada vez que se abre.
--
-- Y NO es una notificación. El cliente lo ve cuando entra; a nadie le suena
-- el teléfono. Eso es otra cosa (push, o WhatsApp) y cuesta bastante más.
--
-- Lleva fecha de vencimiento y no es un lujo: un cartel que dice "sólo por
-- hoy" y sigue ahí en marzo es peor que no tener cartel. Vencido desaparece
-- solo, sin que nadie se tenga que acordar de bajarlo.
-- ══════════════════════════════════════════════════════════════════════════

insert into club_reglas (clave, valor) values
  ('aviso_texto', null),      -- qué dice el cartel
  ('aviso_hasta', null)       -- último día que se muestra (fecha, inclusive)
on conflict (clave) do nothing;


/* Lo que ve el cliente. Devuelve el cartel SÓLO si está vigente: la regla
   de si se muestra o no vive acá y no en la página, así no hay dos lugares
   donde arreglarla, y así una tarjeta abierta sin señal con la copia vieja
   tampoco puede mostrar una promo que ya venció.

   Sin PIN, como club_reglas_ver: es lo que dice el cartel del local. */
create or replace function club_aviso_ver()
returns jsonb
language sql
stable
security definer
set search_path = public
as $av$
  select case
    when t.valor is null or length(trim(t.valor)) = 0 then jsonb_build_object('hay', false)
    when h.valor is not null and h.valor::date < current_date then jsonb_build_object('hay', false)
    else jsonb_build_object('hay', true, 'texto', trim(t.valor), 'hasta', h.valor)
  end
  from (select valor from club_reglas where clave = 'aviso_texto') t
  cross join (select valor from club_reglas where clave = 'aviso_hasta') h
$av$;

grant execute on function club_aviso_ver() to anon, authenticated;


/* Escribirlo. Con el mismo PIN que el Panel, Beneficios y la caja: es lo
   que ven todos los clientes del club, no una preferencia del dispositivo.

   Vaciar el texto apaga el cartel, que es más fácil de explicar que un
   botón de "apagar" al lado de un texto que sigue escrito. */
create or replace function club_aviso_guardar(p_pin text, p_texto text, p_hasta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ag$
declare
  txt text;
  fec date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  txt := nullif(trim(coalesce(p_texto, '')), '');

  if txt is not null and length(txt) > 140 then
    raise exception 'El cartel es muy largo. Máximo 140 caracteres.';
  end if;

  /* La fecha se valida acá y no en la pantalla: si llega algo que no es una
     fecha, mejor que falle al guardar y no el día que un cliente abre la
     tarjeta y club_aviso_ver revienta al comparar. */
  begin
    fec := nullif(trim(coalesce(p_hasta, '')), '')::date;
  exception when others then
    raise exception 'Esa fecha no se entiende. Va como 2026-09-30.';
  end;

  if txt is not null and fec is not null and fec < current_date then
    raise exception 'Esa fecha ya pasó: el cartel no lo vería nadie.';
  end if;

  update club_reglas set valor = txt where clave = 'aviso_texto';
  update club_reglas set valor = to_char(fec, 'YYYY-MM-DD') where clave = 'aviso_hasta';

  return jsonb_build_object('ok', true, 'texto', txt,
                            'hasta', to_char(fec, 'YYYY-MM-DD'));
end;
$ag$;

grant execute on function club_aviso_guardar(text, text, text) to anon, authenticated;


/* Y leerlo para editarlo: la pantalla de Configuración tiene que poder
   mostrar lo que hay puesto AUNQUE esté vencido, que es lo que club_aviso_ver
   esconde a propósito. Pide PIN porque escribir lo pide, y porque ver el
   cartel vencido de la semana pasada no es asunto de un cliente. */
create or replace function club_aviso_editar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ae$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'texto', (select valor from club_reglas where clave = 'aviso_texto'),
    'hasta', (select valor from club_reglas where clave = 'aviso_hasta'));
end;
$ae$;

grant execute on function club_aviso_editar(text) to anon, authenticated;
