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
