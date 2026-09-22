-- VDH · Sistema No Compra — la bandeja de salida.
--
-- Correr DESPUÉS de panel.sql.
--
-- Todo lo que el sistema le tiene que contar a alguien de afuera —Kommo,
-- Telegram— pasa por acá.
--
-- ── Por qué una bandeja y no una llamada directa ──────────────────────────
-- La regla de oro no cambió: **nada de afuera puede tumbar la carga de un
-- registro.** En la versión de Apps Script eso se resolvía con un try/catch:
-- se intentaba mandar a Kommo en el momento y, si fallaba, se anotaba el
-- error y se seguía.
--
-- Eso tiene un agujero que sólo se ve el día que pasa: **si Kommo está caído,
-- ese cliente no entra al CRM nunca más.** No hay reintento. El registro
-- quedó en la planilla y nadie se entera de que el lead no existe hasta que
-- alguien lo busca.
--
-- Acá el registro deja un PENDIENTE y un trabajo que corre cada minuto lo
-- despacha. Si falla, sigue pendiente y se reintenta. La carga del vendedor
-- no espera a nadie, y el precio es que el lead aparece en Kommo hasta un
-- minuto después: para un seguimiento que se trabaja por horas, es nada.
--
-- ── Por qué `http` y no `pg_net` ──────────────────────────────────────────
-- pg_net manda el pedido y la respuesta llega después, por separado. El
-- puente con Kommo son CINCO llamadas encadenadas —descubrir los campos,
-- buscar el contacto, crear el lead, anotarle la nota— donde cada una
-- necesita la respuesta de la anterior. Encadenar eso sobre respuestas
-- asincrónicas es una máquina de estados entera.
--
-- `http` es sincrónico y se lee como el código que reemplaza. Bloquea, sí,
-- pero bloquea al trabajador de la bandeja, que no tiene a nadie esperándolo.


create extension if not exists http with schema extensions;
create extension if not exists pg_cron;


-- ════════════════════════════════════════════════════════════════════════
-- LOS SECRETOS
--
-- Los tokens de Kommo y de Telegram dan acceso de escritura al CRM y al bot.
-- Van al vault, que los guarda cifrados: ni siquiera aparecen en un dump de
-- la base. Es el mismo criterio por el que hoy viven en las propiedades del
-- script y no en el repo.
--
-- Se leen SÓLO desde adentro de estas funciones, que son SECURITY DEFINER:
-- ni anon ni authenticated pueden mirar el vault.
-- ════════════════════════════════════════════════════════════════════════

create or replace function secreto(nombre text)
returns text
language sql
stable
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = nombre limit 1
$$;

revoke execute on function secreto(text) from anon, authenticated, public;

/* Guarda o pisa un secreto por su nombre. El vault deja tener dos secretos
   con el mismo nombre, y ahí `secreto()` devolvería cualquiera de los dos:
   por eso se borra antes en vez de insertar y confiar. */
create or replace function guardar_secreto(nombre text, valor text)
returns void
language plpgsql
security definer
set search_path = vault, public
as $$
begin
  delete from vault.secrets where name = nombre;
  if valor is not null and length(trim(valor)) > 0 then
    perform vault.create_secret(valor, nombre, 'VDH No Compra');
  end if;
end;
$$;

revoke execute on function guardar_secreto(text, text) from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- LA BANDEJA
-- ════════════════════════════════════════════════════════════════════════

create type destino_salida as enum ('kommo', 'telegram');
create type estado_salida  as enum ('pendiente', 'hecho', 'fallado');

create table salidas (
  id        bigint generated always as identity primary key,
  registro  bigint not null references registros(id) on delete cascade,
  destino   destino_salida not null,
  estado    estado_salida not null default 'pendiente',

  -- Cuántas veces se intentó. Es lo que separa "todavía no salió" de "esto
  -- no va a salir nunca y alguien tiene que mirarlo".
  intentos  smallint not null default 0,
  creado    timestamptz not null default now(),
  ultimo    timestamptz,
  error     text,

  -- Lo que devolvió el destino: el id del lead de Kommo, por ejemplo. Sirve
  -- para cruzar un registro con lo que se creó allá cuando algo no cuadra.
  resultado jsonb,

  -- Un registro no puede tener dos pendientes para el mismo destino: el
  -- trigger se dispara una vez, pero un reproceso a mano no puede duplicar
  -- el lead en el CRM.
  unique (registro, destino)
);

-- Lo que el trabajador busca cada minuto: lo que falta mandar, lo más viejo
-- primero. Parcial, porque lo ya hecho no se consulta nunca más.
create index salidas_pendientes on salidas (creado)
  where estado = 'pendiente';

-- Y lo que mira el panel para avisar que el puente se rompió.
create index salidas_falladas on salidas (ultimo desc)
  where estado = 'fallado';


-- ════════════════════════════════════════════════════════════════════════
-- CADA REGISTRO DEJA SUS PENDIENTES
--
-- El trigger no manda nada: sólo anota que hay que mandarlo. Es lo que hace
-- que la carga del vendedor no dependa de que Kommo conteste.
--
-- Un destino sin token configurado no deja pendiente: así el sistema anda
-- igual antes de configurar nada, que es el mismo criterio que tenía
-- kommoActivo_ en Apps Script.
-- ════════════════════════════════════════════════════════════════════════

create or replace function encolar_salidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if secreto('KOMMO_TOKEN') is not null then
    insert into salidas (registro, destino) values (new.id, 'kommo')
    on conflict do nothing;
  end if;

  if secreto('TELEGRAM_TOKEN') is not null and secreto('TELEGRAM_CHAT') is not null then
    insert into salidas (registro, destino) values (new.id, 'telegram')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists registros_encolar on registros;
create trigger registros_encolar
  after insert on registros
  for each row execute function encolar_salidas();


-- ════════════════════════════════════════════════════════════════════════
-- EL TELÉFONO, COMO LO QUIERE WHATSAPP
--
-- Se carga como característica + número, sin el 0 y sin el 15. wa.me lo
-- quiere con el país adelante y el 9 de celular. Es linkWhatsapp_ de
-- Codigo.gs, igual.
-- ════════════════════════════════════════════════════════════════════════

create or replace function link_whatsapp(tel text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(tel, ''), '[^0-9]', '', 'g')) = 0 then null
    else 'https://wa.me/' || (
      select case when n like '54%' then n else '549' || n end
      from (select regexp_replace(
              regexp_replace(coalesce(tel, ''), '[^0-9]', '', 'g'),
              '^0', '') as n) x
    )
  end
$$;


-- ════════════════════════════════════════════════════════════════════════
-- TELEGRAM
--
-- El mail del local no lo mira nadie; esto suena en el celular en el momento,
-- que es cuando el cliente todavía está a tiro de un WhatsApp.
--
-- **El botón es la razón de ser de todo esto:** un toque y se abre el chat
-- con el cliente. Sin número no hay botón, pero el aviso sale igual: que
-- falte el teléfono no puede hacer que nadie se entere.
-- ════════════════════════════════════════════════════════════════════════

/* Telegram interpreta el texto como HTML, así que lo que escribió el vendedor
   hay que escaparlo: un talle escrito "<38" cortaría el mensaje entero. */
create or replace function esc_html(t text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function mandar_telegram(p_registro bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r        registros%rowtype;
  token    text := secreto('TELEGRAM_TOKEN');
  chat     text := secreto('TELEGRAM_CHAT');
  lineas   text[] := '{}';
  cuerpo   jsonb;
  link     text;
  respuesta extensions.http_response;
  salida   jsonb;
begin
  if token is null or chat is null then
    raise exception 'Telegram no está configurado.';
  end if;

  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  lineas := array_append(lineas, '<b>Nuevo no-compra · ' || esc_html(r.sucursal) || '</b>');
  lineas := array_append(lineas, '');

  if r.nombre   is not null then lineas := array_append(lineas, '<b>Cliente:</b> ' || esc_html(r.nombre)); end if;
  if r.whatsapp is not null then lineas := array_append(lineas, '<b>WhatsApp:</b> ' || esc_html(r.whatsapp)); end if;
  if r.mail     is not null then lineas := array_append(lineas, '<b>Mail:</b> ' || esc_html(r.mail)); end if;
  if r.producto is not null then lineas := array_append(lineas, '<b>Buscaba:</b> ' || esc_html(r.producto)); end if;
  if r.talle    is not null then lineas := array_append(lineas, '<b>Talle:</b> ' || esc_html(r.talle)); end if;
  if r.motivo   is not null then lineas := array_append(lineas, '<b>Por qué se fue:</b> ' || esc_html(r.motivo::text)); end if;
  if r.vendedor is not null then lineas := array_append(lineas, '<b>Vendedor:</b> ' || esc_html(r.vendedor)); end if;
  if r.obs      is not null then
    lineas := array_append(lineas, '');
    lineas := array_append(lineas, '<i>' || esc_html(r.obs) || '</i>');
  end if;

  cuerpo := jsonb_build_object(
    'chat_id', chat,
    'text', array_to_string(lineas, E'\n'),
    'parse_mode', 'HTML',
    'disable_web_page_preview', true
  );

  /* Se mira el TELÉFONO y no el link: si el número está vacío no hay botón.
     Preguntarle al link daría siempre que sí, porque con la cadena vacía
     armaba 'wa.me/549', y el botón llevaría a un chat que no existe. */
  link := link_whatsapp(r.whatsapp);
  if link is not null then
    cuerpo := cuerpo || jsonb_build_object('reply_markup', jsonb_build_object(
      'inline_keyboard', jsonb_build_array(jsonb_build_array(
        jsonb_build_object('text', 'Escribirle por WhatsApp', 'url', link)))));
  end if;

  respuesta := extensions.http_post(
    'https://api.telegram.org/bot' || token || '/sendMessage',
    cuerpo::text, 'application/json');

  begin salida := respuesta.content::jsonb; exception when others then salida := null; end;

  if respuesta.status >= 300 or coalesce((salida->>'ok')::boolean, false) = false then
    raise exception 'Telegram respondió % · %', respuesta.status,
      left(coalesce(salida->>'description', respuesta.content, ''), 200);
  end if;

  return jsonb_build_object('mensaje', salida->'result'->>'message_id');
end;
$$;

revoke execute on function mandar_telegram(bigint) from anon, authenticated, public;
