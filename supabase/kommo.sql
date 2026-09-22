-- VDH · Sistema No Compra — el puente con Kommo.
--
-- Correr DESPUÉS de salidas.sql.
--
-- Cada cliente que se va del local sin comprar entra a Kommo como lead con su
-- contacto, para poder trabajarlo desde el CRM y meterlo en campañas.
--
-- Es el port de src/Kommo.gs. La lógica es la misma, línea por línea; lo que
-- cambia es que ya no corre en el momento de la carga sino desde la bandeja
-- de salida, que le da reintentos.
--
-- ── Qué hace falta configurar ─────────────────────────────────────────────
--   KOMMO_SUBDOMAIN   el pedacito de la dirección: en vdh.kommo.com es "vdh"
--   KOMMO_TOKEN       el token de larga duración
--   KOMMO_PIPELINE_ID opcional: a qué embudo entran. Vacío = el principal
--   KOMMO_STATUS_ID   opcional: a qué etapa. Vacío = la primera
--
-- Todo va al vault: ver guardar_secreto() en salidas.sql. Sin KOMMO_TOKEN el
-- puente está apagado y nadie se entera, igual que antes.


-- ════════════════════════════════════════════════════════════════════════
-- UNA SOLA PUERTA PARA HABLARLE A KOMMO
--
-- Devuelve el cuerpo ya parseado, o tira con un mensaje que se entienda. El
-- 401 se distingue del resto a propósito: es el error que de verdad va a
-- pasar —el token vence— y el que tiene una solución concreta.
-- ════════════════════════════════════════════════════════════════════════

create or replace function kommo(metodo text, ruta text, cuerpo jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sub  text := secreto('KOMMO_SUBDOMAIN');
  tok  text := secreto('KOMMO_TOKEN');
  res  extensions.http_response;
  url  text;
begin
  if sub is null or tok is null then
    raise exception 'Falta configurar KOMMO_SUBDOMAIN o KOMMO_TOKEN.';
  end if;

  url := 'https://' || sub || '.kommo.com/api/v4' || ruta;

  res := extensions.http((
    metodo,
    url,
    array[extensions.http_header('Authorization', 'Bearer ' || tok)],
    case when cuerpo is null then null else 'application/json' end,
    case when cuerpo is null then null else cuerpo::text end
  )::extensions.http_request);

  if res.status = 401 then
    raise exception 'Kommo rechazó el token (401). Venció o fue revocado: generá uno nuevo.';
  end if;
  if res.status >= 300 then
    raise exception 'Kommo respondió % · %', res.status, left(coalesce(res.content, ''), 300);
  end if;

  -- 204 sin cuerpo: Kommo contesta así cuando una búsqueda no encuentra nada.
  if res.content is null or length(trim(res.content)) = 0 then return null; end if;
  return res.content::jsonb;
end;
$$;

revoke execute on function kommo(text, text, jsonb) from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- LOS CAMPOS DE LA CUENTA
--
-- Los ids de los campos personalizados son distintos en cada cuenta de
-- Kommo. Escribirlos a mano significaría que esto anda en una sola cuenta y
-- se rompe en silencio el día que alguien recrea un campo: se descubren.
--
-- Se guardan en una tabla en vez de pedirlos en cada envío. Es lo mismo que
-- hacía el caché de seis horas de Apps Script, pero sobrevive al reinicio.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists kommo_campos (
  entidad text not null,          -- 'leads' | 'contacts'
  clave   text not null,          -- el nombre normalizado, o '#PHONE' por código
  campo   bigint not null,
  visto   timestamptz not null default now(),
  primary key (entidad, clave)
);

/* Para comparar nombres sin pelearse con tildes ni mayúsculas. `unaccent` no
   está instalado y no vale la pena por cinco nombres: se traducen las cinco
   vocales, que es lo único que aparece en "Producto buscado" y compañía. */
create or replace function kommo_clave(t text)
returns text
language sql
immutable
as $$
  select lower(trim(translate(coalesce(t, ''), 'áéíóúÁÉÍÓÚàèìòùÀÈÌÒÙ', 'aeiouAEIOUaeiouAEIOU')))
$$;

create or replace function kommo_refrescar_campos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  entidad text;
  r       jsonb;
  f       jsonb;
  n       integer := 0;
begin
  foreach entidad in array array['leads', 'contacts'] loop
    r := kommo('GET', '/' || entidad || '/custom_fields?limit=250');
    for f in select * from jsonb_array_elements(coalesce(r#>'{_embedded,custom_fields}', '[]'::jsonb)) loop
      -- Los campos de sistema se guardan por su CÓDIGO (PHONE, EMAIL), que
      -- sí es estable entre cuentas.
      if f->>'code' is not null then
        insert into kommo_campos (entidad, clave, campo)
        values (entidad, '#' || (f->>'code'), (f->>'id')::bigint)
        on conflict (entidad, clave) do update set campo = excluded.campo, visto = now();
      end if;
      insert into kommo_campos (entidad, clave, campo)
      values (entidad, kommo_clave(f->>'name'), (f->>'id')::bigint)
      on conflict (entidad, clave) do update set campo = excluded.campo, visto = now();
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

revoke execute on function kommo_refrescar_campos() from anon, authenticated, public;

/* El id de un campo. Si la tabla está vacía —primera vez, o alguien la
   limpió— se descubre sola: es lo que hace que el puente arranque sin que
   nadie tenga que acordarse de un paso previo. */
create or replace function kommo_campo(p_entidad text, p_nombre text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare id bigint;
begin
  select campo into id from kommo_campos
   where entidad = p_entidad and clave = kommo_clave(p_nombre);
  if id is null and not exists (select 1 from kommo_campos where entidad = p_entidad) then
    perform kommo_refrescar_campos();
    select campo into id from kommo_campos
     where entidad = p_entidad and clave = kommo_clave(p_nombre);
  end if;
  return id;
end;
$$;

revoke execute on function kommo_campo(text, text) from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- EL TELÉFONO EN FORMATO INTERNACIONAL
-- Así Kommo puede unificar duplicados. Es kommoTel_ de Kommo.gs.
-- ════════════════════════════════════════════════════════════════════════

create or replace function kommo_tel(tel text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(tel, ''), '[^0-9]', '', 'g')) = 0 then null
    else '+' || (
      select case when n like '54%' then n else '549' || n end
      from (select regexp_replace(
              regexp_replace(coalesce(tel, ''), '[^0-9]', '', 'g'), '^0', '') as n) x
    )
  end
$$;


-- ════════════════════════════════════════════════════════════════════════
-- BUSCAR AL CLIENTE QUE YA ESTÁ EN EL CRM
--
-- Existe porque el "Control de duplicados" de Kommo NO actúa sobre
-- /leads/complex: probado el 20/09/2026 contra la cuenta real, dos cargas con
-- el mismo teléfono crearon dos contactos distintos. Sin esto, un cliente que
-- pasa tres veces por el local queda como tres personas, y se rompe
-- justamente lo que hace útil el CRM.
--
-- La búsqueda de Kommo es difusa —matchea contra varios campos—, así que el
-- resultado se verifica comparando los dígitos del teléfono. Ante la duda
-- devuelve null y se crea el contacto: un duplicado es molesto, pero colgarle
-- el lead al cliente equivocado es bastante peor.
-- ════════════════════════════════════════════════════════════════════════

create or replace function kommo_buscar_contacto(tel text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r        jsonb;
  contacto jsonb;
  campo    jsonb;
  v        jsonb;
  buscado  text := regexp_replace(coalesce(tel, ''), '[^0-9]', '', 'g');
begin
  if buscado = '' then return null; end if;

  r := kommo('GET', '/contacts?limit=10&query=' || replace(tel, '+', '%2B'));
  if r is null then return null; end if;

  for contacto in select * from jsonb_array_elements(coalesce(r#>'{_embedded,contacts}', '[]'::jsonb)) loop
    for campo in select * from jsonb_array_elements(coalesce(contacto->'custom_fields_values', '[]'::jsonb)) loop
      if campo->>'field_code' = 'PHONE' then
        for v in select * from jsonb_array_elements(coalesce(campo->'values', '[]'::jsonb)) loop
          if regexp_replace(coalesce(v->>'value', ''), '[^0-9]', '', 'g') = buscado then
            return (contacto->>'id')::bigint;
          end if;
        end loop;
      end if;
    end loop;
  end loop;

  return null;
end;
$$;

revoke execute on function kommo_buscar_contacto(text) from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- MANDAR EL NO-COMPRA
--
-- Las etiquetas son a propósito la parte más importante para lo que sigue:
-- no necesitan ninguna configuración previa —Kommo las crea solas— y son lo
-- que después permite armar una campaña para "todos los que se fueron por
-- falta de talle en Unicenter". Los campos personalizados son más prolijos
-- pero hay que crearlos antes; las etiquetas andan desde el primer día.
-- ════════════════════════════════════════════════════════════════════════

create or replace function mandar_kommo(p_registro bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          registros%rowtype;
  tel        text;
  existente  bigint;
  contacto   jsonb;
  campos     jsonb := '[]'::jsonb;
  etiquetas  jsonb;
  lead       jsonb;
  res        jsonb;
  creado     jsonb;
  pipeline   text := secreto('KOMMO_PIPELINE_ID');
  etapa      text := secreto('KOMMO_STATUS_ID');
  nota       text[] := '{}';
  id_campo   bigint;
begin
  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  tel := kommo_tel(r.whatsapp);

  -- ── El contacto ──
  existente := kommo_buscar_contacto(tel);
  if existente is not null then
    /* Si el cliente ya está en el CRM, el lead se le cuelga al contacto que
       ya existe. No se le tocan los datos: si cambió de mail, eso se arregla
       en Kommo a mano — pisar un contacto bueno con lo que anotó un vendedor
       apurado sería peor que quedarse con el dato viejo. */
    contacto := jsonb_build_object('id', existente);
  else
    declare cc jsonb := '[]'::jsonb;
    begin
      id_campo := kommo_campo('contacts', '#PHONE');
      if tel is not null and id_campo is not null then
        cc := cc || jsonb_build_array(jsonb_build_object(
          'field_id', id_campo, 'values', jsonb_build_array(jsonb_build_object('value', tel))));
      end if;
      id_campo := kommo_campo('contacts', '#EMAIL');
      if r.mail is not null and id_campo is not null then
        cc := cc || jsonb_build_array(jsonb_build_object(
          'field_id', id_campo, 'values', jsonb_build_array(jsonb_build_object('value', r.mail))));
      end if;
      -- Kommo pide un nombre. Si el vendedor no lo anotó, el teléfono es
      -- mejor que dejarlo vacío: en la lista se distingue igual.
      contacto := jsonb_build_object(
        'first_name', coalesce(r.nombre, 'Cliente ' || coalesce(r.whatsapp, 's/d')),
        'custom_fields_values', cc);
    end;
  end if;

  -- ── Los campos del lead ──
  declare
    par text[][] := array[
      array['Sucursal', r.sucursal],
      array['Vendedor', r.vendedor],
      array['Producto buscado', r.producto],
      array['Talle', r.talle],
      array['Motivo', r.motivo::text]
    ];
    i integer;
  begin
    for i in 1 .. array_length(par, 1) loop
      if par[i][2] is not null and length(trim(par[i][2])) > 0 then
        id_campo := kommo_campo('leads', par[i][1]);
        -- Un campo que en esta cuenta no existe no rompe nada: ese dato viaja
        -- igual adentro de la nota, no se pierde, pero no queda filtrable.
        if id_campo is not null then
          campos := campos || jsonb_build_array(jsonb_build_object(
            'field_id', id_campo,
            'values', jsonb_build_array(jsonb_build_object('value', par[i][2]))));
        end if;
      end if;
    end loop;
  end;

  -- ── Las etiquetas ──
  etiquetas := jsonb_build_array(jsonb_build_object('name', 'No Compra'));
  if r.sucursal is not null then
    etiquetas := etiquetas || jsonb_build_array(jsonb_build_object('name', r.sucursal));
  end if;
  if r.motivo is not null then
    etiquetas := etiquetas || jsonb_build_array(jsonb_build_object('name', 'Motivo: ' || r.motivo::text));
  end if;

  -- ── El lead ──
  lead := jsonb_build_object(
    'name', 'No Compra · ' || coalesce(r.producto, 'sin producto especificado'),
    -- request_id vuelve en la respuesta: sirve para cruzar qué registro
    -- generó qué lead cuando algo no cuadra.
    'request_id', p_registro::text,
    '_embedded', jsonb_build_object('contacts', jsonb_build_array(contacto), 'tags', etiquetas)
  );
  if jsonb_array_length(campos) > 0 then
    lead := lead || jsonb_build_object('custom_fields_values', campos);
  end if;
  if pipeline is not null then lead := lead || jsonb_build_object('pipeline_id', pipeline::bigint); end if;
  /* Sin etapa explícita el lead cae en la primera del embudo, que en Kommo es
     "Leads Entrantes" (la bandeja de sin clasificar). Los no-compra no son
     dudosos: ya sabemos qué son y quién los cargó, así que entran derecho a
     "Sin contactar", que es donde Atención al Cliente los trabaja. */
  if etapa is not null then lead := lead || jsonb_build_object('status_id', etapa::bigint); end if;

  res := kommo('POST', '/leads/complex', jsonb_build_array(lead));
  creado := res->0;
  if creado is null or creado->>'id' is null then
    raise exception 'Kommo no devolvió el lead creado.';
  end if;

  -- El id del lead queda en el registro, que es lo que después permite que el
  -- webhook de Kommo encuentre de vuelta esta fila.
  update registros set lead_kommo = creado->>'id' where id = p_registro;

  -- ── La nota ──
  nota := array_append(nota, 'Se fue del local sin comprar.');
  nota := array_append(nota, '');
  if r.sucursal is not null then nota := array_append(nota, 'Local: ' || r.sucursal); end if;
  if r.vendedor is not null then nota := array_append(nota, 'Vendedor: ' || r.vendedor); end if;
  if r.producto is not null then nota := array_append(nota, 'Buscaba: ' || r.producto); end if;
  if r.talle    is not null then nota := array_append(nota, 'Talle: ' || r.talle); end if;
  if r.motivo   is not null then nota := array_append(nota, 'Motivo: ' || r.motivo::text); end if;
  if r.whatsapp is not null then nota := array_append(nota, 'WhatsApp: ' || r.whatsapp); end if;
  if r.mail     is not null then nota := array_append(nota, 'Mail: ' || r.mail); end if;
  if r.obs      is not null then
    nota := array_append(nota, '');
    nota := array_append(nota, 'Lo que anotó el vendedor:');
    nota := array_append(nota, r.obs);
  end if;

  /* La nota va aparte y su fallo NO tumba el envío: el lead ya está creado y
     con sus campos. Reintentar todo por una nota duplicaría el lead, que es
     bastante peor que un lead sin nota. */
  begin
    perform kommo('POST', '/leads/' || (creado->>'id') || '/notes',
      jsonb_build_array(jsonb_build_object(
        'note_type', 'common',
        'params', jsonb_build_object('text', array_to_string(nota, E'\n')))));
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'lead', creado->>'id',
    'contacto', case when existente is null then 'nuevo' else existente::text end);
end;
$$;

revoke execute on function mandar_kommo(bigint) from anon, authenticated, public;
