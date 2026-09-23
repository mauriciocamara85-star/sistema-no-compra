-- VDH · Sistema No Compra — lo que se hace con un beneficio.
--
-- Correr DESPUÉS de beneficios.sql.
--
-- ── Quién puede qué ───────────────────────────────────────────────────────
-- El mostrador (sin sesión) BUSCA y CANJEA, y vende gift cards. No lista.
-- Atención al Cliente (con sesión) además DA descuentos, LISTA y ANULA.
--
-- La diferencia no es jerarquía: **buscar por teléfono completo es una llave;
-- un listado es un directorio.** Un listado de beneficios con nombres y
-- teléfonos abierto en los 14 locales es justo la lista de clientes que todo
-- este sistema evita repartir. Por eso el listado pide sesión y la búsqueda
-- no.


-- ════════════════════════════════════════════════════════════════════════
-- LO QUE ESTO REEMPLAZA
--
-- El beneficio vivía como cinco columnas sobre `registros`, con dos
-- funciones que las tocaban. Se dan de baja acá y no se dejan "por las
-- dudas": dos caminos para la misma cosa es cómo se llega a que la app
-- diga una cosa y la base otra.
--
-- `beneficio_buscar` cambia de forma —ahora devuelve también el tipo, la
-- serie y el vencimiento— y Postgres no deja cambiarle el tipo de retorno
-- a una función existente: hay que bajarla antes.
-- ════════════════════════════════════════════════════════════════════════

drop function if exists beneficio_buscar(text);
drop function if exists beneficio_usar(text, text, text, numeric, text);

/* `canjear_beneficio` cambia de firma: ahora, además del id, hay que
   presentar LA CLAVE. Postgres no reemplaza una función si le cambian los
   argumentos —crearía una segunda con el mismo nombre—, así que la vieja se
   baja. Dejarla viva sería dejar abierta justo la puerta que esto cierra. */
drop function if exists canjear_beneficio(bigint, text, text, numeric, text);


-- ════════════════════════════════════════════════════════════════════════
-- ¿QUIÉN ESTÁ LLAMANDO?
--
-- El mostrador trabaja SIN sesión: busca, vende gift cards y canjea como
-- anónimo, y es a propósito —ponerle un portón al que viene a canjear sería
-- fricción justo donde menos conviene—. Pero "sin sesión" no puede querer
-- decir "ve todo": hay datos que son del que está adentro.
--
-- No hace falta ninguna extensión. PostgREST deja las claims del token en
-- una variable de sesión; de ahí sale el rol, y si no hay token no hay
-- variable, que ya es la respuesta.
-- ════════════════════════════════════════════════════════════════════════

create or replace function soy_de_adentro()
returns boolean
language sql
stable
as $dentro$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  ) = 'authenticated'
$dentro$;


-- ════════════════════════════════════════════════════════════════════════
-- BUSCAR
--
-- Una sola puerta para las dos llaves: si lo que se escribió tiene pinta de
-- teléfono se busca un descuento, y si no, una gift card por su número.
--
-- Devuelve UNO o ninguno, nunca una lista. Un número mal escrito no puede
-- devolver medio padrón.
-- ════════════════════════════════════════════════════════════════════════

create or replace function beneficio_buscar(clave text)
returns table (
  id bigint, tipo text, estado text,
  nombre text, pct smallint, valor numeric, saldo numeric,
  serie text, codigo text, vence date, dias integer, buscaba text,
  local text, vendedor text, obs text,
  compra_minima numeric, locales text[], acumulable boolean,
  al_portador boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with pelado as (
    select regexp_replace(coalesce(clave, ''), '[^0-9]', '', 'g') as digitos,
           upper(trim(coalesce(clave, '')))                       as texto,
           upper(regexp_replace(coalesce(clave, ''), '[^A-Za-z0-9]', '', 'g')) as alfanum
  )
  select b.id,
         b.tipo::text,
         b.estado,
         /* EL NOMBRE, SÓLO PARA EL QUE ESTÁ ADENTRO.
            La serie de la gift card es corta y correlativa a propósito —lo
            que autoriza el canje es la tarjeta de papel, el número sólo
            sirve para encontrarla—, pero eso significa que desde afuera se
            puede recorrer el talonario entero probando 1, 2, 3… Que eso
            devuelva además el nombre de cada cliente convierte un número
            adivinable en una lista de gente. Sin el nombre, lo que se ve es
            lo que igual dice la tarjeta que el cliente trae en la mano. */
         case when soy_de_adentro() then b.nombre else null end as nombre,
         b.pct,
         b.valor,
         /* El saldo, para el día que un canje pueda ser parcial. Hoy el uso
            es total, así que es el valor entero o nada; la cuenta ya está
            hecha para no tener que migrar después. */
         case when b.usado is null then b.valor else 0 end as saldo,
         b.serie,
         b.codigo,
         b.vence,
         b.dias::integer,
         r.producto,
         b.local,
         b.vendedor,
         b.obs,
         b.compra_minima,
         b.locales,
         b.acumulable,
         (b.codigo is not null) as al_portador
    from v_beneficios b
    left join registros r on r.id = b.registro
    cross join pelado p
   where
     /* Por TELÉFONO, y encuentra las dos cosas: el descuento del cliente que
        se fue, y la gift card que compró. En la gift card el teléfono no es
        la llave —la tarjeta es del que la tenga en la mano— pero sirve para
        encontrarla cuando el que la compró vuelve y no se acuerda del
        número. */
     (length(p.digitos) >= 8
      and regexp_replace(coalesce(b.telefono, ''), '[^0-9]', '', 'g') = p.digitos)
     or
     /* Por CÓDIGO DE CUPÓN. Acá no hay papel que respalde nada: el código ES
        la credencial, y por eso es largo. Se compara pelado —sin el "VDH",
        sin guiones y sin mayúsculas— porque el que lo dicta por teléfono y
        el que lo tipea nunca coinciden en la puntuación. */
     (b.codigo is not null and length(p.alfanum) >= 8
      and upper(regexp_replace(b.codigo, '[^A-Za-z0-9]', '', 'g')) = p.alfanum)
     or
     /* Por NÚMERO DE TARJETA. Se comparan los dígitos sin los ceros de
        adelante, porque en la tarjeta dice "00311" y el vendedor escribe
        "311". Y se piden menos de 8 dígitos para no confundir un número de
        tarjeta con medio teléfono. */
     (b.tipo = 'giftcard' and length(p.digitos) between 1 and 7
      and ltrim(regexp_replace(coalesce(b.serie, ''), '[^0-9]', '', 'g'), '0')
        = ltrim(p.digitos, '0'))
   /* Lo que está vivo primero, y de lo más nuevo a lo más viejo: el que
      atiende quiere ver lo que puede usar hoy, no el historial.

      Se devuelven varios pero NO es un listado: son los beneficios de UN
      número que el que busca ya tenía. La lista que no existe es la que se
      puede recorrer sin saber a quién buscar. */
   order by (b.estado = 'disponible') desc, b.creado desc
   limit 5;
$$;

grant execute on function beneficio_buscar(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- DAR UN DESCUENTO
--
-- Lo hace Atención al Cliente desde el Panel, sobre la ficha del cliente que
-- se fue. Ahí ya se sabe quién es, qué buscaba y por qué se fue.
--
-- **No hay un "dar descuento" suelto que pida el teléfono a mano**, y es a
-- propósito: tipear un número es la forma más fácil de darle el beneficio al
-- cliente equivocado.
-- ════════════════════════════════════════════════════════════════════════

create or replace function dar_descuento(
  p_registro bigint,
  p_pct      smallint,
  p_dias     integer default 30,
  p_quien    text default null,
  p_obs      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r   registros%rowtype;
  nid bigint;
begin
  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  /* Si ya tiene uno vivo, no se crea otro: se devuelve el que hay. Dos
     personas mirando el mismo panel no pueden dejar al cliente con dos
     descuentos, que es lo que pasaba repartiendo cupones de papel. */
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible'
     and regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g')
       = regexp_replace(coalesce(r.whatsapp, ''), '[^0-9]', '', 'g')
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;

  insert into beneficios (tipo, registro, telefono, nombre, pct, vence, local, vendedor, obs)
  values ('descuento', r.id, r.whatsapp, r.nombre, p_pct,
          ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
          r.sucursal, coalesce(p_quien, r.vendedor), p_obs)
  returning id into nid;

  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$$;

grant execute on function dar_descuento(bigint, smallint, integer, text, text) to authenticated;
revoke execute on function dar_descuento(bigint, smallint, integer, text, text) from anon, public;

-- ════════════════════════════════════════════════════════════════════════
-- EL CÓDIGO DEL CUPÓN
--
-- VDH-XXXX-XXXX sobre un alfabeto de 30 caracteres, sin 0, 1, I, L, O ni U:
-- los primeros cuatro se confunden entre sí al dictarlos por teléfono, y sin
-- la U no se arman palabras que después haya que explicar.
--
-- Ocho caracteres son 6,5 × 10¹¹ combinaciones. Con cuatro —como VDH20-A7K4—
-- serían un millón, y con mil cupones vivos uno de cada mil intentos
-- acertaría; mil intentos contra PostgREST es un minuto. La diferencia entre
-- cuatro y ocho caracteres es la que hay entre un adorno y una llave.
--
-- El azar sale de gen_random_uuid(), que desde Postgres 13 viene en el
-- núcleo y usa el generador criptográfico del sistema. random() NO sirve
-- acá: es predecible conociendo algunos valores anteriores, y acá los
-- valores anteriores se los mandamos a los clientes por WhatsApp.
-- ════════════════════════════════════════════════════════════════════════

create or replace function generar_codigo()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $gen$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';  -- 30
  crudo    bytea;
  cuerpo   text;
  salida   text;
  i        integer;
  intento  integer := 0;
begin
  loop
    intento := intento + 1;
    -- 16 bytes del generador criptográfico; se usan los primeros ocho.
    crudo := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    cuerpo := '';
    for i in 0..7 loop
      cuerpo := cuerpo || substr(alfabeto, 1 + (get_byte(crudo, i) % 30), 1);
    end loop;
    salida := 'VDH-' || substr(cuerpo, 1, 4) || '-' || substr(cuerpo, 5, 4);

    exit when not exists (
      select 1 from beneficios
       where upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'))
           = upper(regexp_replace(salida, '[^A-Za-z0-9]', '', 'g')));

    /* El índice único es el que impide el choque de verdad; esto es para no
       devolver un error feo por una casualidad entre 10¹¹. Si pasa veinte
       veces seguidas no es casualidad: algo anda mal y conviene que se note
       en vez de girar para siempre. */
    if intento >= 20 then
      raise exception 'No pude generar un código libre en 20 intentos.';
    end if;
  end loop;
  return salida;
end;
$gen$;

/* No se concede a nadie: la llama crear_cupon, que es security definer y
   corre como dueña. Abierta sería una fábrica de códigos para cualquiera. */
revoke execute on function generar_codigo() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- CREAR UN CUPÓN
--
-- Es un descuento al portador: la única diferencia con `dar_descuento` es
-- que no vale para un teléfono sino para el que tenga el código.
--
-- **La regla de quién puede vive ACÁ, no en la pantalla.** Esconder el botón
-- no protege nada: la clave publicable está en un repo público y cualquiera
-- puede llamarle a PostgREST con su propio token. Esta línea es la que
-- decide; el botón sólo evita ofrecer lo que después iba a fallar.
--
-- Se puede crear desde un no-compra —y entonces queda atado a ese cliente,
-- que es lo que después permite medir qué venta se recuperó— o suelto, para
-- una campaña. En el primer caso el teléfono queda como ORIGEN, no como
-- llave: el cupón lo sigue pudiendo usar cualquiera.
-- ════════════════════════════════════════════════════════════════════════

create or replace function crear_cupon(
  p_pct           smallint,
  p_dias          integer default 30,
  p_registro      bigint  default null,
  p_telefono      text    default null,
  p_nombre        text    default null,
  p_compra_minima numeric default null,
  p_locales       text[]  default null,
  p_acumulable    boolean default false,
  p_obs           text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cc$
declare
  r       registros%rowtype;
  tel     text;
  nom     text;
  cod     text;
  nid     bigint;
  sueltos text[];
begin
  if not puede_crear_cupones() then
    raise exception 'No tenés permiso para crear cupones.'
      using hint = 'Hace falta el rol atencion o admin.';
  end if;

  if p_pct is null or p_pct < 1 or p_pct > 100 then
    raise exception 'El descuento tiene que estar entre 1 y 100.';
  end if;
  if coalesce(p_dias, 0) < 1 then
    raise exception 'El cupón tiene que durar al menos un día.';
  end if;
  if p_compra_minima is not null and p_compra_minima <= 0 then
    raise exception 'La compra mínima tiene que ser mayor que cero.';
  end if;

  /* Un local mal escrito es un cupón que no se puede usar en ninguna parte,
     y eso no se descubre hasta que alguien lo intenta en el mostrador con el
     cliente adelante. */
  if p_locales is not null then
    if array_length(p_locales, 1) is null then
      raise exception 'La lista de locales está vacía. Para todos, dejala sin poner.';
    end if;
    select array_agg(x) into sueltos
      from unnest(p_locales) as x
     where upper(trim(x)) not in (select upper(codigo) from locales where activo);
    if sueltos is not null then
      raise exception 'Estos locales no existen o están inactivos: %.',
        array_to_string(sueltos, ', ');
    end if;
  end if;

  tel := nullif(trim(coalesce(p_telefono, '')), '');
  nom := nullif(trim(coalesce(p_nombre, '')), '');

  /* Desde un no-compra el teléfono y el nombre salen de ahí y no se tipean.
     Tipear un teléfono es la forma más fácil de darle el beneficio al
     cliente equivocado; es la misma razón por la que dar_descuento tampoco
     lo pide. */
  if p_registro is not null then
    select * into r from registros where id = p_registro;
    if not found then raise exception 'No existe el registro %.', p_registro; end if;
    tel := r.whatsapp;
    nom := coalesce(nom, r.nombre);
  end if;

  /* NO ACUMULABLE, la parte que sí se puede hacer cumplir: un cliente no
     puede tener dos beneficios vivos a la vez. La otra mitad —que no se
     junten dos promociones en el mismo ticket— la base no la puede saber,
     porque el monto lo tipea el vendedor; eso se muestra en el canje y nada
     más. Un cupón de campaña sin teléfono queda afuera de esta cuenta, y
     está bien: no es de nadie hasta que alguien lo usa. */
  if tel is not null then
    select id into nid from v_beneficios
     where tipo = 'descuento' and estado = 'disponible'
       and regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g')
         = regexp_replace(tel, '[^0-9]', '', 'g')
     limit 1;
    if nid is not null then
      return jsonb_build_object('creado', false,
        'porque', 'ese cliente ya tiene un beneficio sin usar', 'id', nid);
    end if;
  end if;

  cod := generar_codigo();

  insert into beneficios (
    tipo, registro, telefono, nombre, pct, codigo, vence,
    compra_minima, locales, acumulable, creado_por, obs
  ) values (
    'descuento', p_registro, tel, nom, p_pct, cod,
    ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
    p_compra_minima, p_locales, coalesce(p_acumulable, false), auth.uid(), p_obs
  )
  returning id into nid;

  return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct);
end;
$cc$;

/* Las dos cosas: el grant deja pasar a cualquiera que entró con su mail, y
   el rol de adentro decide quién puede de verdad. */
grant execute on function crear_cupon(smallint, integer, bigint, text, text, numeric, text[], boolean, text)
  to authenticated;
revoke execute on function crear_cupon(smallint, integer, bigint, text, text, numeric, text[], boolean, text)
  from anon, public;



-- ════════════════════════════════════════════════════════════════════════
-- EL NÚMERO DE LA TARJETA
--
-- Lo da la app, y el vendedor lo escribe en la tarjeta física. Es el mismo
-- gesto que ya hacían —tomar el próximo número libre de la planilla y
-- anotarlo en la tarjeta— sin el paso de ir a buscar cuál era.
--
-- Sigue la numeración que ya existe: la planilla llega hasta la 00310, así
-- que la próxima es la 00311. Eso importa porque el talonario de papel y
-- esto tienen que poder mirarse juntos.
--
-- **Es correlativo y no un código raro, a propósito.** En el mostrador se
-- dicta en voz alta y se tipea con una mano: "trescientos once" se acierta,
-- "K7M2-9XQ4" no. Lo que autoriza el canje no es el número: es la tarjeta
-- física que el cliente trae. El número sólo sirve para encontrarla.
-- ════════════════════════════════════════════════════════════════════════

create or replace function siguiente_serie()
returns text
language sql
stable
security definer
set search_path = public
as $sig$
  /* Se arranca en 311 aunque la tabla esté vacía: las 310 anteriores están
     en la planilla vieja y repetir un número haría que dos tarjetas
     distintas se llamen igual. */
  select lpad(
    greatest(
      311,
      coalesce(max(regexp_replace(serie, '[^0-9]', '', 'g')::bigint), 0) + 1
    )::text, 5, '0')
  from beneficios where tipo = 'giftcard'
$sig$;

grant execute on function siguiente_serie() to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- VENDER UNA GIFT CARD
--
-- Los dos montos van juntos porque son dos cosas: `valor` es lo que el local
-- le debe al portador, `cobrado` es lo que entró a la caja. Con el 10% de
-- efectivo no son iguales.
--
-- El teléfono y el nombre del que la compra son OPCIONALES y no son la
-- llave: sirven para encontrarla si vuelve sin el número. La tarjeta es del
-- que la tenga en la mano, que casi nunca es el que la pagó.
-- ════════════════════════════════════════════════════════════════════════

create or replace function vender_giftcard(
  p_valor    numeric,
  p_local    text,
  p_vendedor text,
  p_cobrado  numeric default null,
  p_pago     text default null,
  p_dias     integer default 30,
  p_telefono text default null,
  p_nombre   text default null,
  p_obs      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nid     bigint;
  intento integer;
  /* `nro` y no `serie`: la tabla tiene una columna que se llama así, y
     adentro del INSERT PL/pgSQL no sabe a cuál de las dos le hablan. */
  nro text;
begin
  if coalesce(p_valor, 0) <= 0 then raise exception 'Falta el valor de la Gift Card.'; end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local.'; end if;
  if length(trim(coalesce(p_vendedor, ''))) = 0 then raise exception 'Falta el vendedor.'; end if;

  /* El número se toma acá adentro y en la misma transacción que el insert.
     Dos ventas al mismo tiempo en dos locales distintos podrían pedir el
     mismo: el índice único sobre la serie es el que decide, y el que pierde
     reintenta con el siguiente. */
  for intento in 1 .. 5 loop
    nro := siguiente_serie();
    begin
      insert into beneficios (tipo, serie, valor, cobrado, pago, vence,
                              local, vendedor, telefono, nombre, obs)
      values ('giftcard', nro, p_valor,
              -- Sin decir cuánto se cobró, se asume que se cobró el valor.
              coalesce(p_cobrado, p_valor),
              nullif(p_pago, '')::forma_pago,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
              trim(p_local), trim(p_vendedor),
              nullif(trim(coalesce(p_telefono, '')), ''),
              nullif(trim(coalesce(p_nombre, '')), ''),
              p_obs)
      returning id into nid;

      return jsonb_build_object('vendida', true, 'id', nid, 'serie', nro);

    exception when unique_violation then
      -- Se la ganó otro local. Se prueba con la que sigue.
      null;
    end;
  end loop;

  raise exception 'No se pudo tomar un número de tarjeta. Probá de nuevo.';
end;
$$;

-- La firma cambió —ya no recibe el número— así que la vieja se da de baja.
drop function if exists vender_giftcard(text, numeric, text, text, numeric, text, integer, text, text, text);

grant execute on function vender_giftcard(numeric, text, text, numeric, text, integer, text, text, text)
  to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- CANJEAR
--
-- La acción que cierra el círculo. Para el descuento hace además algo que el
-- cupón de papel no podía: **deja el registro como venta recuperada**, con su
-- monto y su local, así el "Recuperado" del tablero sube solo cuando el
-- cliente vuelve.
--
-- Devuelve false —y no una excepción— cuando no se puede: ya se usó, venció
-- o está anulado. Es una respuesta, no un error.
-- ════════════════════════════════════════════════════════════════════════

create or replace function canjear_beneficio(
  p_id       bigint,
  p_clave    text,
  p_local    text,
  p_vendedor text,
  p_monto    numeric default null,
  p_producto text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b       v_beneficios%rowtype;
  tocadas integer;
  dig     text;
  alfa    text;
  coincide boolean;
begin
  select * into b from v_beneficios where id = p_id;
  if not found then return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio no existe'); end if;

  /* ── HAY QUE PRESENTAR LA CLAVE ──────────────────────────────────────
     Antes alcanzaba con el id, que es un entero correlativo, y esta
     función está abierta a `anon` porque el mostrador canjea sin sesión.
     Las dos cosas juntas querían decir que cualquiera, desde cualquier
     lado, podía quemar los beneficios probando 1, 2, 3…

     Ahora hay que traer la misma llave que se usó para encontrarlo: el
     teléfono, el número de la tarjeta o el código del cupón. El id deja de
     ser una credencial y pasa a ser lo que siempre fue, un número de fila.

     Sigue sin haber sesión, y está bien: lo que autoriza el canje es lo
     que el cliente tiene —la tarjeta en la mano o el código en el
     teléfono—, no quién está del otro lado del mostrador. */
  dig  := regexp_replace(coalesce(p_clave, ''), '[^0-9]', '', 'g');
  alfa := upper(regexp_replace(coalesce(p_clave, ''), '[^A-Za-z0-9]', '', 'g'));

  coincide :=
       (length(dig) >= 8
        and regexp_replace(coalesce(b.telefono, ''), '[^0-9]', '', 'g') = dig)
    or (b.codigo is not null and length(alfa) >= 8
        and upper(regexp_replace(b.codigo, '[^A-Za-z0-9]', '', 'g')) = alfa)
    or (b.serie is not null and length(dig) between 1 and 7
        and ltrim(regexp_replace(b.serie, '[^0-9]', '', 'g'), '0') = ltrim(dig, '0'));

  if not coincide then
    return jsonb_build_object('canjeado', false,
      'porque', 'la clave no corresponde a ese beneficio');
  end if;

  if b.estado <> 'disponible' then
    return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio está ' || b.estado);
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local del canje.'; end if;

  /* ── Dónde vale ──
     locales NULL quiere decir "en todos". Si tiene lista, el local del
     canje tiene que estar adentro; se compara en mayúsculas porque la
     tabla `locales` guarda el código así y la app manda el nombre. */
  if b.locales is not null
     and upper(trim(p_local)) <> all (select upper(trim(x)) from unnest(b.locales) as x) then
    return jsonb_build_object('canjeado', false,
      'porque', 'ese beneficio no vale en ' || trim(p_local),
      'locales', b.locales);
  end if;

  /* ── Compra mínima ──
     Es lo que se puede validar de una condición que, en el fondo, es de
     confianza: el monto lo tipea el vendedor. Sirve para que no se cuele
     por distracción, no para impedir que alguien mienta. */
  if b.compra_minima is not null and coalesce(p_monto, 0) < b.compra_minima then
    return jsonb_build_object('canjeado', false,
      'porque', 'la compra no llega al mínimo de ' || b.compra_minima::text,
      'compra_minima', b.compra_minima);
  end if;

  /* Las condiciones se repiten en el UPDATE, no alcanza con haberlas mirado
     arriba: entre el select y el update puede entrar otro canje del mismo
     beneficio desde otro local. Acá es donde se gana esa carrera. */
  update beneficios
     set usado = now(), local_canje = trim(p_local),
         vendedor_canje = nullif(trim(coalesce(p_vendedor, '')), ''),
         monto_compra = p_monto,
         /* Hoy siempre 'local'. El día que entre Tienda Nube, el webhook va
            a llamar a ESTA misma función con 'online', que es lo que evita
            que un cupón quede usado de un lado y disponible del otro. */
         canal_canje = 'local'
   where id = p_id and usado is null and anulado is null;

  get diagnostics tocadas = row_count;
  if tocadas = 0 then
    return jsonb_build_object('canjeado', false, 'porque', 'lo acaban de usar en otro lado');
  end if;

  /* El descuento cierra el círculo del no-compra. La gift card no: esa venta
     ya se cobró el día que se vendió la tarjeta, y contarla otra vez al
     canjearla inflaría el recuperado con plata que no volvió por esto.

     Un cupón de campaña sin registro tampoco cierra nada: no hay no-compra
     del que venga, y está bien. */
  if b.tipo = 'descuento' and b.registro is not null and coalesce(p_monto, 0) > 0 then
    update registros
       set compro = true,
           compro_canal = 'local',
           monto = p_monto,
           producto_final = coalesce(nullif(trim(coalesce(p_producto, '')), ''), producto_final),
           estado = coalesce(estado, 'Cerrado - compró'),
           contactado = true
     where id = b.registro;
  end if;

  return jsonb_build_object('canjeado', true, 'tipo', b.tipo::text,
                            'al_portador', (b.codigo is not null));
end;
$$;

grant execute on function canjear_beneficio(bigint, text, text, text, numeric, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- ANULAR Y EXTENDER
--
-- Anular pide sesión: es la única acción que le saca algo a un cliente.
-- Extender también, porque correr una fecha de vencimiento a mano desde el
-- mostrador es la forma de que ninguna venza nunca.
-- ════════════════════════════════════════════════════════════════════════

create or replace function anular_beneficio(p_id bigint, p_quien text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare tocadas integer;
begin
  if length(trim(coalesce(p_quien, ''))) = 0 then raise exception 'Falta quién lo anula.'; end if;
  update beneficios
     set anulado = now(), anulado_por = trim(p_quien), motivo_anul = p_motivo
   where id = p_id and anulado is null and usado is null;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

create or replace function extender_beneficio(p_id bigint, p_dias integer, p_quien text)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare nueva date;
begin
  if coalesce(p_dias, 0) <= 0 then raise exception 'Cuántos días hay que extenderlo.'; end if;
  update beneficios
     set vence = coalesce(vence, (now() at time zone 'America/Argentina/Buenos_Aires')::date) + p_dias,
         -- Queda dicho en las observaciones, que es donde alguien lo va a
         -- buscar cuando pregunte por qué esta tarjeta duró tres meses.
         obs = trim(both E'\n' from coalesce(obs, '') || E'\n' ||
               to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
               ': ' || coalesce(p_quien, 'alguien') || ' extendió ' || p_dias || ' días.')
   where id = p_id and usado is null and anulado is null
  returning vence into nueva;
  return nueva;
end;
$$;

grant execute on function anular_beneficio(bigint, text, text)   to authenticated;
grant execute on function extender_beneficio(bigint, integer, text) to authenticated;
revoke execute on function anular_beneficio(bigint, text, text)   from anon, public;
revoke execute on function extender_beneficio(bigint, integer, text) from anon, public;


-- ════════════════════════════════════════════════════════════════════════
-- EL LISTADO
--
-- Sólo con sesión. Un listado de beneficios con nombres y teléfonos abierto
-- en los 14 locales es exactamente la lista de clientes que este sistema
-- evita repartir; el mostrador se queda con el buscador, que devuelve uno.
-- ════════════════════════════════════════════════════════════════════════

-- El de la vista está en beneficios.sql, pegado a su creación: el drop que
-- hay ahí se lleva los permisos, y separarlos los rompe en silencio.
grant select on beneficios to authenticated;
alter table beneficios enable row level security;

-- El drop es para poder volver a correr este archivo entero sin que explote.
drop policy if exists "el equipo de adentro ve los beneficios" on beneficios;
create policy "el equipo de adentro ve los beneficios"
  on beneficios for select to authenticated using (true);

/* Y los conteos de cada filtro, que el listado necesita antes de pedir nada:
   así las pestañas muestran su número sin traerse las filas.

   Desde que existe el cupón esto además contesta cómo viene el programa:
   cuántos se dieron, cuántos volvieron y cuánto se vendió por eso. Son
   cuentas sobre una tabla de miles de filas, no millones; cuando deje de
   ser instantánea va a haber que pensarla de nuevo. */
create or replace function resumen_beneficios()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with b as (select * from v_beneficios),
  cupones as (select * from b where codigo is not null)
  select json_build_object(
    'disponible', (select count(*) from b where estado = 'disponible'),
    'usado',      (select count(*) from b where estado = 'usado'),
    'vencido',    (select count(*) from b where estado = 'vencido'),
    'anulado',    (select count(*) from b where estado = 'anulado'),
    -- Plata comprometida: lo que el local le debe a quien tenga una tarjeta
    -- sin canjear. Es el número que a nadie le gusta descubrir de golpe.
    'comprometido', (select coalesce(sum(valor), 0) from b
                      where tipo = 'giftcard' and estado = 'disponible'),

    /* ── El programa de cupones ──
       Se mide sobre los cupones al portador, no sobre todos los descuentos:
       el descuento atado al teléfono es otra cosa —se da en el panel, uno
       por cliente— y mezclarlos haría que la tasa de canje no signifique
       nada. */
    'cupones', json_build_object(
      'creados',  (select count(*) from cupones),
      'usados',   (select count(*) from cupones where estado = 'usado'),
      'vencidos', (select count(*) from cupones where estado = 'vencido'),
      'vivos',    (select count(*) from cupones where estado = 'disponible'),

      /* Tasa de canje: sobre los que ya NO pueden cambiar de estado. Contra
         el total, un cupón que se dio ayer cuenta como fracaso y la tasa
         baja sola cada vez que se crea uno. */
      'tasa', (select case when count(*) = 0 then null
                     else round(100.0 * count(*) filter (where estado = 'usado') / count(*), 1)
                     end
                from cupones where estado in ('usado', 'vencido')),

      -- Lo que se vendió gracias a un cupón, y lo que costó darlo.
      'vendido',   (select coalesce(sum(monto_compra), 0) from cupones where estado = 'usado'),
      'regalado',  (select coalesce(sum(round(monto_compra * pct / 100.0, 2)), 0)
                      from cupones where estado = 'usado' and monto_compra is not null),

      /* Cuánto tarda en volver el que se llevó un cupón. En días y con un
         decimal: "3,4 días" dice algo, "3 días" esconde la diferencia entre
         el que volvió a la tarde y el que volvió el jueves. */
      'dias_hasta_canje', (select round(avg(extract(epoch from (usado - creado)) / 86400.0)::numeric, 1)
                             from cupones where estado = 'usado'),

      'por_local', (select coalesce(json_agg(x order by x->>'local'), '[]'::json) from (
          select json_build_object('local', local_canje,
                                   'usados', count(*),
                                   'vendido', coalesce(sum(monto_compra), 0)) as x
            from cupones where estado = 'usado' and local_canje is not null
           group by local_canje) t),

      'por_vendedor', (select coalesce(json_agg(x order by x->>'vendedor'), '[]'::json) from (
          select json_build_object('vendedor', vendedor_canje,
                                   'usados', count(*),
                                   'vendido', coalesce(sum(monto_compra), 0)) as x
            from cupones where estado = 'usado' and vendedor_canje is not null
           group by vendedor_canje) t),

      /* Por quién lo creó. Se muestra el mail y no el uuid, que no le dice
         nada a nadie; sale de `usuarios` y no de auth.users para no depender
         de un esquema que conviene tocar lo menos posible. */
      'por_atencion', (select coalesce(json_agg(x order by x->>'quien'), '[]'::json) from (
          select json_build_object('quien', coalesce(u.mail, 'sin identificar'),
                                   'creados', count(*),
                                   'usados', count(*) filter (where c.estado = 'usado'),
                                   'vendido', coalesce(sum(c.monto_compra) filter (where c.estado = 'usado'), 0)) as x
            from cupones c
            left join usuarios u on u.uid = c.creado_por
           group by coalesce(u.mail, 'sin identificar')) t)
    )
  )
$$;

grant execute on function resumen_beneficios() to authenticated;
revoke execute on function resumen_beneficios() from anon, public;
