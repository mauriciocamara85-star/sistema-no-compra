-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL STOCK PARA EL NO COMPRA (Y PARA HERMES)
--
-- Correr en el editor SQL de Supabase, DESPUÉS del 55. No toca la llave de
-- Hermes: la que ya tenés sigue valiendo.
--
-- Pedido de Mauricio (07/10/2026): cuando entra un No Compra, fijarse si lo
-- que buscaba el cliente está en la tienda online o en la fábrica, para
-- avisar y cerrar la venta.
--
-- De dónde sale el stock (lo trae el robot de cada hora, stock.js):
--   · la TIENDA ONLINE (Tienda Nube): cada hora, las variantes con stock;
--   · la FÁBRICA: el Excel "Stock Actual D-M" más nuevo de la carpeta
--     "Stock fabrica" del Drive, que suben una vez por día.
--
-- El cruce es EXACTO por código + talle + color (la fábrica escribe la
-- sigla "NE" y el No Compra el nombre "NEGRO": la traducción sale del
-- catálogo de la Carga). Si no se escaneó la etiqueta y no hay código, en
-- la tienda se busca por el nombre; en la fábrica, sin código, no.
-- También dice qué OTROS talles hay del mismo color.
--
--   stock_fabrica / stock_tienda / stock_estado   el stock y de cuándo es
--   stock_fabrica_cargar / stock_tienda_cargar    sólo el robot
--   stock_de                                      el cruce de una prenda
--   hermes_no_compra                              + el cruce de cada uno
--   crm_stock                                     el cruce para el Panel
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists stock_fabrica (
  codigo       text not null,
  talle        text not null,
  color        text not null,          -- la sigla de BlueSoft: "NE"
  color_nombre text,                   -- "NEGRO", del catálogo
  descripcion  text,
  rubro        text,
  familia      text,
  cantidad     integer not null,
  primary key (codigo, talle, color)
);
create table if not exists stock_tienda (
  id       bigserial primary key,
  codigo   text not null default '',   -- el SKU de la tienda = el código de BlueSoft
  producto text,
  talle    text not null default '',
  color    text not null default '',   -- como lo escribe la tienda: "Negro"
  stock    integer,                    -- null: la tienda no lleva la cuenta (hay)
  url      text
);
create index if not exists stock_tienda_codigo on stock_tienda (codigo);
create table if not exists stock_estado (
  id                 smallint primary key default 1 check (id = 1),
  fabrica_archivo    text,
  fabrica_archivo_id text,
  fabrica_fecha      date,
  fabrica_cargado    timestamptz,
  fabrica_filas      integer,
  tienda_cargado     timestamptz,
  tienda_filas       integer
);
insert into stock_estado (id) values (1) on conflict (id) do nothing;
alter table stock_fabrica enable row level security;
alter table stock_tienda enable row level security;
alter table stock_estado enable row level security;
revoke all on table stock_fabrica, stock_tienda, stock_estado from anon, authenticated;

/* Para comparar textos: minúsculas, sin acentos, sin espacios de más. */
create or replace function stock_norma(p text)
returns text language sql immutable as $$
  select regexp_replace(translate(lower(trim(coalesce(p, ''))), 'áéíóúüñ', 'aeiouun'), '\s+', ' ', 'g')
$$;

/* La fábrica: se reemplaza entera con el Excel nuevo. Se guarda sólo lo que
   tiene stock (las filas en 0 o en negativo no sirven para vender). */
create or replace function stock_fabrica_cargar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  delete from stock_fabrica;
  insert into stock_fabrica (codigo, talle, color, color_nombre, descripcion, rubro, familia, cantidad)
  select cod, tal, col, max(nom), max(des), max(rub), max(fam), sum(cant)::integer
    from (select upper(trim(x->>'codigo')) as cod, upper(trim(coalesce(x->>'talle', ''))) as tal,
                 upper(trim(coalesce(x->>'color', ''))) as col, nullif(upper(trim(x->>'color_nombre')), '') as nom,
                 nullif(trim(x->>'descripcion'), '') as des, nullif(trim(x->>'rubro'), '') as rub,
                 nullif(trim(x->>'familia'), '') as fam, coalesce(nullif(x->>'cantidad', '')::numeric, 0) as cant
            from jsonb_array_elements(coalesce(p->'filas', '[]'::jsonb)) x) t
   where cod <> ''
   group by cod, tal, col
  having sum(cant) > 0;
  get diagnostics n = row_count;
  update stock_estado
     set fabrica_archivo = p->>'archivo', fabrica_archivo_id = p->>'archivo_id',
         fabrica_fecha = nullif(p->>'fecha', '')::date, fabrica_cargado = now(), fabrica_filas = n
   where id = 1;
  return jsonb_build_object('filas', jsonb_array_length(coalesce(p->'filas', '[]'::jsonb)), 'con_stock', n);
end;
$$;
revoke all on function stock_fabrica_cargar(jsonb) from public, anon, authenticated;

/* La tienda: se reemplaza entera cada hora (sólo variantes con stock). */
create or replace function stock_tienda_cargar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  delete from stock_tienda;
  insert into stock_tienda (codigo, producto, talle, color, stock, url)
  select upper(trim(coalesce(x->>'codigo', ''))), nullif(trim(x->>'producto'), ''), upper(trim(coalesce(x->>'talle', ''))),
         trim(coalesce(x->>'color', '')), case when x->>'stock' is null then null else (x->>'stock')::numeric::integer end,
         nullif(x->>'url', '')
    from jsonb_array_elements(coalesce(p->'filas', '[]'::jsonb)) x;
  get diagnostics n = row_count;
  update stock_estado set tienda_cargado = now(), tienda_filas = n where id = 1;
  return jsonb_build_object('filas', n);
end;
$$;
revoke all on function stock_tienda_cargar(jsonb) from public, anon, authenticated;

/* El cruce de una prenda. Sin talle o sin color, vale cualquiera. En la
   tienda, el color se compara por nombre ("NEGRO" = "Negro"; "GRIS" con
   "Gris acero" también). Sin código, en la tienda se busca por el nombre
   del producto; en la fábrica no (el Excel no trae nombres comerciales). */
create or replace function stock_de(p_codigo text, p_talle text, p_color text, p_producto text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cod  text := upper(trim(coalesce(p_codigo, '')));
  tal  text := upper(trim(coalesce(p_talle, '')));
  col  text := stock_norma(p_color);
  prod text := stock_norma(p_producto);
  fab integer; fab_otros text;
  tie_hay boolean; tie_sin_cuenta boolean; tie integer; tie_url text; tie_otros text;
begin
  if cod <> '' then
    select sum(f.cantidad) into fab from stock_fabrica f
     where f.codigo = cod and (tal = '' or f.talle = tal)
       and (col = '' or stock_norma(f.color_nombre) = col or stock_norma(f.color) = col);
    select string_agg(f.talle || ' (' || f.cantidad || ')', ', ' order by f.talle) into fab_otros
      from (select f.talle, sum(f.cantidad) as cantidad from stock_fabrica f
             where f.codigo = cod and tal <> '' and f.talle <> tal
               and (col = '' or stock_norma(f.color_nombre) = col or stock_norma(f.color) = col)
             group by f.talle) f;
  end if;
  with suyas as (
    select t.* from stock_tienda t
     where (cod <> '' and t.codigo = cod)
        or (cod = '' and length(prod) >= 4 and stock_norma(t.producto) like '%' || prod || '%')
  ), del_color as (
    select s.* from suyas s
     where col = '' or stock_norma(s.color) = col
        or stock_norma(s.color) like col || ' %' or col like stock_norma(s.color) || ' %'
  )
  select (select count(*) > 0 from del_color c where tal = '' or c.talle = tal),
         (select bool_or(c.stock is null) from del_color c where tal = '' or c.talle = tal),
         (select sum(c.stock) from del_color c where tal = '' or c.talle = tal),
         (select string_agg(distinct c.talle, ', ') from del_color c where tal <> '' and c.talle <> tal),
         (select max(s.url) from suyas s)
    into tie_hay, tie_sin_cuenta, tie, tie_otros, tie_url;
  return jsonb_build_object(
    'fabrica', case when cod = '' then null else coalesce(fab, 0) end,
    'fabrica_otros_talles', fab_otros,
    'tienda_hay', coalesce(tie_hay, false),
    'tienda', case when coalesce(tie_hay, false) and not coalesce(tie_sin_cuenta, false) then tie
                   when coalesce(tie_hay, false) then null else 0 end,
    'tienda_otros_talles', tie_otros,
    'tienda_url', tie_url,
    'hay', coalesce(fab, 0) > 0 or coalesce(tie_hay, false));
end;
$$;
revoke all on function stock_de(text, text, text, text) from public, anon, authenticated;

/* Hermes: lo mismo que en el 55, más el cruce de cada No Compra y de
   cuándo es el stock. La llave no cambia. */
create or replace function hermes_no_compra(p_llave text, p_desde timestamptz default null, p_limite integer default 50)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  h hermes_llave;
  filas jsonb;
  hasta bigint;
  e stock_estado;
begin
  select * into h from hermes_llave where id = 1;
  if not found or h.huella <> encode(extensions.digest(coalesce(p_llave, ''), 'sha256'), 'hex') then
    raise exception 'Llave incorrecta.' using errcode = '28000';
  end if;
  select coalesce(jsonb_agg(x.fila order by x.orden), '[]'::jsonb), max(x.orden)
    into filas, hasta
    from (
      select r.id as orden,
             jsonb_build_object(
               'id', r.id,
               'cuando', to_char(r.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
               'local', r.sucursal,
               'producto', nullif(trim(r.producto), ''),
               'codigo', nullif(trim(r.producto_codigo), ''),
               'talle', nullif(trim(r.talle), ''),
               'color', nullif(trim(r.color), ''),
               'motivo', r.motivo::text,
               'nota', nullif(trim(r.obs), '')
             ) || stock_de(r.producto_codigo, r.talle, r.color, r.producto) as fila
        from registros r
       where (p_desde is null and r.id > h.ultimo_id)
          or (p_desde is not null and r.creado >= p_desde)
       order by r.id
       limit greatest(1, least(coalesce(p_limite, 50), 200))
    ) x;
  update hermes_llave
     set ultima_vez = now(),
         ultimo_id = case when p_desde is null then greatest(ultimo_id, coalesce(hasta, ultimo_id)) else ultimo_id end
   where id = 1;
  select * into e from stock_estado where id = 1;
  return jsonb_build_object(
    'cuantos', jsonb_array_length(filas),
    'con_stock', (select count(*) from jsonb_array_elements(filas) f where (f->>'hay')::boolean),
    'fabrica_del', to_char(e.fabrica_fecha, 'DD/MM'),
    'tienda_al', to_char(e.tienda_cargado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'),
    'nuevos', filas);
end;
$$;
grant execute on function hermes_no_compra(text, timestamptz, integer) to anon, authenticated;

/* El Panel: el cruce de los No Compra abiertos (con el PIN). */
create or replace function crm_stock(p_pin text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare e stock_estado;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  select * into e from stock_estado where id = 1;
  return json_build_object(
    'fabrica_del', e.fabrica_fecha,
    'tienda_al', e.tienda_cargado,
    'registros', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id) || stock_de(r.producto_codigo, r.talle, r.color, r.producto))
        from registros r
       where crm_columna(r.estado, r.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado')
    ), '[]'::jsonb));
end;
$$;
grant execute on function crm_stock(text) to anon, authenticated;

select 'listo: el stock de la fábrica y de la tienda, cruzado con cada No Compra' as "SQL 56";


-- ─────────────────────────── PARTE 57 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL STOCK EN EL AVISO DEL BOT (SIN HERMES)
--
-- Correr en el editor SQL de Supabase, DESPUÉS del 56.
--
-- Decidido con Mauricio el 07/10/2026: sin Hermes. El bot del grupo "No
-- compra VDH" ya avisa cada No Compra al minuto; ahora ese mismo aviso dice
-- si lo tenemos, porque el cruce ya está en la base (SQL 56):
--
--     Buscaba: Kazan CP · Talle: M · Color: marino
--     ✅ Lo tenemos: 1 en fábrica · en la tienda online
--     [Escribirle por WhatsApp] [Ver en la tienda]
--
-- Y una vez por hora, de 10 a 21: si a un No Compra abierto que no se avisó
-- le apareció stock (llegó el Excel de fábrica o se repuso en la tienda),
-- un solo mensaje con todos: "📦 Ya tenemos lo que buscaban". Cada uno se
-- avisa UNA vez (registros.stock_avisado).
--
--   telegram_no_compra_cuerpo   el aviso de un No Compra (el de siempre,
--                               + color y stock), sin mandarlo
--   mandar_telegram             lo manda (como siempre)
--   avisar_stock_mensaje        el repaso de cada hora, sin mandarlo
--   avisar_stock_nuevo          lo manda (lo llama el robot de cada hora)
--
-- Y a Hermes se le corta la llave: no se usa.
-- ══════════════════════════════════════════════════════════════════════════

alter table registros add column if not exists stock_avisado timestamptz;

/* El aviso de un No Compra, armado: el de siempre, más el color y el stock.
   Aparte de mandar_telegram para poder probarlo sin mandar nada. */
create or replace function telegram_no_compra_cuerpo(p_registro bigint, p_chat text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r       registros%rowtype;
  lineas  text[] := '{}';
  st      jsonb;
  hay     boolean;
  fab     integer;
  botones jsonb := '[]'::jsonb;
  link    text;
begin
  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;
  st  := stock_de(r.producto_codigo, r.talle, r.color, r.producto);
  hay := coalesce((st->>'hay')::boolean, false);
  fab := coalesce((st->>'fabrica')::integer, 0);

  lineas := array_append(lineas, '<b>Nuevo no-compra · ' || esc_html(r.sucursal) || '</b>');
  lineas := array_append(lineas, '');
  if r.nombre   is not null then lineas := array_append(lineas, '<b>Cliente:</b> ' || esc_html(r.nombre)); end if;
  if r.whatsapp is not null then lineas := array_append(lineas, '<b>WhatsApp:</b> ' || esc_html(r.whatsapp)); end if;
  if r.mail     is not null then lineas := array_append(lineas, '<b>Mail:</b> ' || esc_html(r.mail)); end if;
  if r.producto is not null then lineas := array_append(lineas, '<b>Buscaba:</b> ' || esc_html(r.producto)); end if;
  if r.talle    is not null then lineas := array_append(lineas, '<b>Talle:</b> ' || esc_html(r.talle)); end if;
  if r.color    is not null then lineas := array_append(lineas, '<b>Color:</b> ' || esc_html(lower(r.color))); end if;
  if r.motivo   is not null then lineas := array_append(lineas, '<b>Por qué se fue:</b> ' || esc_html(r.motivo::text)); end if;
  if r.vendedor is not null then lineas := array_append(lineas, '<b>Vendedor:</b> ' || esc_html(r.vendedor)); end if;

  /* El stock (SQL 57): si está lo que buscaba; si no, otros talles. */
  if hay then
    lineas := array_append(lineas, '');
    lineas := array_append(lineas, '✅ <b>Lo tenemos:</b> ' || array_to_string(array_remove(array[
      case when fab > 0 then fab || ' en fábrica' end,
      case when coalesce((st->>'tienda_hay')::boolean, false)
           then 'en la tienda online' || coalesce(' (' || (st->>'tienda') || ')', '') end
    ], null), ' · '));
  elsif st->>'fabrica_otros_talles' is not null or st->>'tienda_otros_talles' is not null then
    lineas := array_append(lineas, '');
    lineas := array_append(lineas, '🔁 <b>En otro talle:</b> ' || array_to_string(array_remove(array[
      case when st->>'fabrica_otros_talles' is not null then esc_html(st->>'fabrica_otros_talles') || ' en fábrica' end,
      case when st->>'tienda_otros_talles' is not null then esc_html(st->>'tienda_otros_talles') || ' en la tienda' end
    ], null), ' · '));
  end if;

  if r.obs is not null then
    lineas := array_append(lineas, '');
    lineas := array_append(lineas, '<i>' || esc_html(r.obs) || '</i>');
  end if;

  /* Se mira el TELÉFONO y no el link: con el número vacío no hay botón. */
  link := link_whatsapp(r.whatsapp);
  if link is not null then
    botones := botones || jsonb_build_array(jsonb_build_object('text', 'Escribirle por WhatsApp', 'url', link));
  end if;
  if coalesce((st->>'tienda_hay')::boolean, false) and st->>'tienda_url' is not null then
    botones := botones || jsonb_build_array(jsonb_build_object('text', 'Ver en la tienda', 'url', st->>'tienda_url'));
  end if;

  return jsonb_build_object('chat_id', p_chat, 'text', array_to_string(lineas, E'\n'),
                            'parse_mode', 'HTML', 'disable_web_page_preview', true, '_hay', hay)
         || case when jsonb_array_length(botones) > 0
                 then jsonb_build_object('reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(botones)))
                 else '{}'::jsonb end;
end;
$$;
revoke all on function telegram_no_compra_cuerpo(bigint, text) from public, anon, authenticated;

/* Manda el aviso de un No Compra, como siempre. Si salió diciendo que lo
   tenemos, queda avisado: el repaso de cada hora no lo repite. */
create or replace function mandar_telegram(p_registro bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  token     text := secreto('TELEGRAM_TOKEN');
  chat      text := secreto('TELEGRAM_CHAT');
  cuerpo    jsonb;
  hay       boolean;
  respuesta extensions.http_response;
  salida    jsonb;
begin
  if token is null or chat is null then
    raise exception 'Telegram no está configurado.';
  end if;
  cuerpo := telegram_no_compra_cuerpo(p_registro, chat);
  hay := coalesce((cuerpo->>'_hay')::boolean, false);
  cuerpo := cuerpo - '_hay';

  perform paciencia();
  respuesta := extensions.http_post(
    'https://api.telegram.org/bot' || token || '/sendMessage',
    cuerpo::text, 'application/json');

  begin salida := respuesta.content::jsonb; exception when others then salida := null; end;

  if respuesta.status >= 300 or coalesce((salida->>'ok')::boolean, false) = false then
    raise exception 'Telegram respondió % · %', respuesta.status,
      left(coalesce(salida->>'description', respuesta.content, ''), 200);
  end if;

  if hay then update registros set stock_avisado = now() where id = p_registro; end if;
  return jsonb_build_object('mensaje', salida->'result'->>'message_id');
end;
$$;

/* El repaso: los No Compra abiertos (de los últimos 45 días) que no se
   avisaron y ahora tienen stock. Arma el mensaje, sin mandarlo. */
create or replace function avisar_stock_mensaje()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz     constant text := 'America/Argentina/Buenos_Aires';
  l      record;
  lineas text[] := '{}';
  ids    bigint[] := '{}';
  n      integer := 0;
  fab    integer;
  que    text;
begin
  for l in
    select r.id, r.sucursal, r.producto, r.talle, r.color, r.creado,
           stock_de(r.producto_codigo, r.talle, r.color, r.producto) as s
      from registros r
     where r.stock_avisado is null
       and r.creado > now() - interval '45 days'
       and crm_columna(r.estado, r.contactado) in ('Pendiente', 'En seguimiento', 'Esperando respuesta')
     order by r.creado
  loop
    continue when not coalesce((l.s->>'hay')::boolean, false);
    n := n + 1;
    ids := ids || l.id;
    if n <= 15 then
      fab := coalesce((l.s->>'fabrica')::integer, 0);
      que := array_to_string(array_remove(array[
        case when fab > 0 then fab || ' en fábrica' end,
        case when coalesce((l.s->>'tienda_hay')::boolean, false) then 'en la tienda' end], null), ' · ');
      lineas := lineas || ('• ' || esc_html(coalesce(l.sucursal, '')) || ' · ' || esc_html(coalesce(l.producto, 'sin producto'))
                || coalesce(' · ' || esc_html(l.talle), '') || coalesce(' · ' || esc_html(lower(l.color)), '')
                || ' — <b>' || que || '</b> <i>(vino el ' || to_char(l.creado at time zone tz, 'DD/MM') || ')</i>');
    end if;
  end loop;
  return jsonb_build_object('n', n, 'ids', to_jsonb(ids), 'texto', case when n = 0 then null else
    '📦 <b>Ya tenemos lo que buscaban</b> (' || n || ')' || E'\n\n' || array_to_string(lineas, E'\n')
    || case when n > 15 then E'\n…y ' || (n - 15) || ' más: están en el Panel.' else '' end
    || E'\n\nEn el Panel cada tarjeta dice qué hay: escribiles desde ahí.' end);
end;
$$;
revoke all on function avisar_stock_mensaje() from public, anon, authenticated;

/* Lo manda el robot de cada hora (stock.js), de 10 a 21. */
create or replace function avisar_stock_nuevo()
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  token     text := secreto('TELEGRAM_TOKEN');
  chat      text := secreto('TELEGRAM_CHAT');
  hora      integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  m         jsonb;
  cuerpo    jsonb;
  respuesta extensions.http_response;
  salida    jsonb;
begin
  if token is null or chat is null then return jsonb_build_object('avisados', 0, 'porque', 'Telegram no está configurado'); end if;
  if hora < 10 or hora >= 21 then return jsonb_build_object('avisados', 0, 'porque', 'fuera de horario'); end if;
  m := avisar_stock_mensaje();
  if (m->>'n')::integer = 0 then return jsonb_build_object('avisados', 0); end if;
  cuerpo := jsonb_build_object('chat_id', chat, 'text', m->>'texto', 'parse_mode', 'HTML', 'disable_web_page_preview', true,
    'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', 'Abrir el panel', 'url', coalesce(secreto('SITIO'), '') || 'panel.html')))));
  perform paciencia();
  respuesta := extensions.http_post('https://api.telegram.org/bot' || token || '/sendMessage', cuerpo::text, 'application/json');
  begin salida := respuesta.content::jsonb; exception when others then salida := null; end;
  if respuesta.status >= 300 or coalesce((salida->>'ok')::boolean, false) = false then
    raise exception 'Telegram respondió % · %', respuesta.status, left(coalesce(salida->>'description', respuesta.content, ''), 200);
  end if;
  update registros set stock_avisado = now()
   where id in (select (jsonb_array_elements_text(m->'ids'))::bigint);
  return jsonb_build_object('avisados', (m->>'n')::integer);
end;
$$;
revoke all on function avisar_stock_nuevo() from public, anon, authenticated;

/* Hermes no se usa: se le corta la llave (la función queda, sin llave no
   devuelve nada). Para volver a darle acceso: select hermes_llave_nueva(); */
delete from hermes_llave;

select 'listo: el stock en el aviso del bot y el repaso de cada hora' as "SQL 57";
