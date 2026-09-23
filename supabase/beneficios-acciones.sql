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
  serie text, vence date, dias integer, buscaba text,
  local text, vendedor text, obs text
)
language sql
stable
security definer
set search_path = public
as $$
  with pelado as (
    select regexp_replace(coalesce(clave, ''), '[^0-9]', '', 'g') as digitos,
           upper(trim(coalesce(clave, ''))) as texto
  )
  select b.id,
         b.tipo::text,
         b.estado,
         b.nombre,
         b.pct,
         b.valor,
         /* El saldo, para el día que un canje pueda ser parcial. Hoy el uso
            es total, así que es el valor entero o nada; la cuenta ya está
            hecha para no tener que migrar después. */
         case when b.usado is null then b.valor else 0 end as saldo,
         b.serie,
         b.vence,
         b.dias::integer,
         r.producto,
         b.local,
         b.vendedor,
         b.obs
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
begin
  select * into b from v_beneficios where id = p_id;
  if not found then return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio no existe'); end if;
  if b.estado <> 'disponible' then
    return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio está ' || b.estado);
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local del canje.'; end if;

  /* Las condiciones se repiten en el UPDATE, no alcanza con haberlas mirado
     arriba: entre el select y el update puede entrar otro canje del mismo
     beneficio desde otro local. Acá es donde se gana esa carrera. */
  update beneficios
     set usado = now(), local_canje = trim(p_local),
         vendedor_canje = nullif(trim(coalesce(p_vendedor, '')), ''),
         monto_compra = p_monto
   where id = p_id and usado is null and anulado is null;

  get diagnostics tocadas = row_count;
  if tocadas = 0 then
    return jsonb_build_object('canjeado', false, 'porque', 'lo acaban de usar en otro lado');
  end if;

  /* El descuento cierra el círculo del no-compra. La gift card no: esa venta
     ya se cobró el día que se vendió la tarjeta, y contarla otra vez al
     canjearla inflaría el recuperado con plata que no volvió por esto. */
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

  return jsonb_build_object('canjeado', true, 'tipo', b.tipo::text);
end;
$$;

grant execute on function canjear_beneficio(bigint, text, text, numeric, text) to anon, authenticated;


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
   así las pestañas muestran su número sin traerse las filas. */
create or replace function resumen_beneficios()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'disponible', count(*) filter (where estado = 'disponible'),
    'usado',      count(*) filter (where estado = 'usado'),
    'vencido',    count(*) filter (where estado = 'vencido'),
    'anulado',    count(*) filter (where estado = 'anulado'),
    -- Plata comprometida: lo que el local le debe a quien tenga una tarjeta
    -- sin canjear. Es el número que a nadie le gusta descubrir de golpe.
    'comprometido', coalesce(sum(valor) filter (
        where tipo = 'giftcard' and estado = 'disponible'), 0)
  )
  from v_beneficios
$$;

grant execute on function resumen_beneficios() to authenticated;
revoke execute on function resumen_beneficios() from anon, public;
