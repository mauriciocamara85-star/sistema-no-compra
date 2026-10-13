-- ═══ SQL 102 (13/10/2026) · Impecable: Productos testigo desde los locales, y nombres y reparto parejo en el mapa ═══
-- Va después del 99 (el 100 y el 101 son de los usuarios del No Compra: no
-- dependen de este ni este de ellos). Pegalo entero en el editor SQL de
-- Supabase: corre como un solo bloque. Se puede correr más de una vez.
--   · Desde la computadora (No Compra → Impecable → Productos testigo →
--     "Programar un control") elegís el día, los productos y los locales.
--   · El local llena la planilla en Impecable (PC o celular) y graba un video
--     cortito de cada producto. La cantidad vendida se escribe; la diferencia
--     y el desvío se calculan solos.
--   · Avisos: "Mañana tienen producto testigo" al local, y al supervisor y a
--     vos si falta algo (salen cuando esté subido el reloj de avisos).
--   · El mapa: ponerle nombre a un módulo ("Vidriera") y "Repartir parejo"
--     (22 entre 3: 7, 7 y 8), en Por local → "Repartir y ponerles nombre".
--   · No toca nada de No Compra. Reversible: agrega columnas, una tabla
--     chica, un bucket para los videos y funciones; la "Cantidad enviada"
--     deja de arrancar en 0 (queda vacía hasta que la carguen). No borra datos.

-- =====================================================================
-- Módulo VDH · Migración 14 (SQL 102): Productos testigo desde los locales
--
-- Pedido de Mauricio (13/10/2026), con la planilla "Producto Testigo
-- Rivadavia" (Ítem, Producto, Color, Cantidad enviada, Stock sistema,
-- Cantidad real, Dev. a fábrica, Salieron, Entraron, Cantidad vendida,
-- Diferencia, Desvío, Observaciones):
--   · Desde la administración se programa el control: "este jueves se
--     controlan estos productos", para todos los locales o los elegidos (a
--     Granbur, por ejemplo, se lo destilda si no le llegó, y se le cambia el
--     producto en su planilla). El local no tiene que cargar los productos.
--   · El local llena los números en la app (en la PC del local o en el
--     celular): todo sale del sistema, salvo la cantidad real, que se cuenta.
--     La cantidad vendida se escribe (no se calcula: "si da mal es porque hay
--     algo que está mal"). Y por cada producto, un video cortito contando.
--   · Diferencia = Stock sistema − Cantidad real (positivo: falta).
--     Desvío = la diferencia sobre lo enviado, en % (lo único calculado).
--   · El día antes les llega "Mañana tienen producto testigo"; al mandarla,
--     si falta algo, le llega al supervisor y al administrador.
--   · La planilla se sigue pudiendo corregir desde la administración.
-- Y dos cosas del mapa (al final): ponerle nombre a un módulo ("Vidriera") y
-- repartir parejo (22 entre 3: 7, 7 y 8).
-- Se puede correr más de una vez. No borra datos.
-- =====================================================================

-- ---------- Columnas nuevas ----------
alter table testigo_semanas add column if not exists fecha       date;          -- el día que se cuenta
alter table testigo_semanas add column if not exists cargada_en  timestamptz;   -- cuando el local la mandó
alter table testigo_semanas add column if not exists cargada_por uuid references orden_personas(id) on delete set null;
alter table testigo_items add column if not exists vendida         integer;      -- sale del sistema (antes se calculaba)
alter table testigo_items add column if not exists video_path      text;         -- en el bucket testigo-videos
alter table testigo_items add column if not exists video_subido_en timestamptz;
alter table testigo_items add column if not exists video_borrado   boolean not null default false;
alter table testigo_items add column if not exists cargado_en      timestamptz;
alter table testigo_items add column if not exists cargado_por     uuid references orden_personas(id) on delete set null;
-- La enviada también la carga el local (sale del sistema): vacía hasta que la escriban.
alter table testigo_items alter column enviada drop not null;
alter table testigo_items alter column enviada drop default;
-- Los videos ocupan lugar: se guardan menos días que las fotos (los que dieron diferencia, como las fotos con problemas).
alter table orden_config add column if not exists dias_guardar_videos smallint not null default 14;
do $$ begin
  alter table orden_config add constraint orden_config_dias_guardar_videos_check check (dias_guardar_videos >= 7);
exception when duplicate_object then null; end $$;

-- Los números de la planilla, nunca negativos (la administración escribe directo en la tabla).
do $$ begin
  alter table testigo_items add constraint testigo_items_no_negativos check (coalesce(enviada, 0) >= 0 and coalesce(stock_sistema, 0) >= 0
    and coalesce(cantidad_real, 0) >= 0 and coalesce(vendida, 0) >= 0 and dev_fabrica >= 0 and salieron >= 0 and entraron >= 0);
exception when duplicate_object then null; end $$;

-- Videos reemplazados ("grabar de nuevo"): el reloj los borra del bucket.
create table if not exists testigo_videos_viejos (
  path   text primary key,
  desde  timestamptz not null default now()
);
alter table testigo_videos_viejos enable row level security;   -- sin reglas: sólo el reloj (service_role)

-- ---------- La planilla con las cuentas ----------
drop view if exists testigo_v_items;
create view testigo_v_items with (security_invoker = true) as
select i.*, s.local_id, s.semana, s.fecha, s.cargada_en,
       (i.stock_sistema - i.cantidad_real) as diferencia,
       case when coalesce(i.enviada, 0) > 0 and i.stock_sistema is not null and i.cantidad_real is not null
            then round(100.0 * (i.stock_sistema - i.cantidad_real) / i.enviada, 1) end as desvio
from testigo_items i join testigo_semanas s on s.id = i.semana_id;

-- ---------- Quién ve: también la gente del local (vendedores y su supervisor) ----------
drop policy if exists ver_local on testigo_semanas;
create policy ver_local on testigo_semanas for select to authenticated using (orden_es_del_local(local_id));
drop policy if exists ver_local on testigo_items;
create policy ver_local on testigo_items for select to authenticated
  using (exists (select 1 from testigo_semanas s where s.id = semana_id and orden_es_del_local(s.local_id)));
-- (Cambiar directo en las tablas sigue siendo del supervisor y del administrador; los vendedores
--  cargan sólo los números, por testigo_cargar.)

-- ---------- Programar un control (el administrador, o el supervisor en su local) ----------
create or replace function testigo_programar(p_fecha date, p_locales uuid[], p_productos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_semana date; v_loc uuid; v_sem testigo_semanas; v_p jsonb; v_prod text; v_color text;
  v_n_loc int := 0; v_nuevos int := 0; v_aca int; v_item int;
begin
  if p_fecha is null or p_fecha < v_hoy - 7 or p_fecha > v_hoy + 60 then
    raise exception 'Elegí un día entre la semana pasada y los próximos dos meses';
  end if;
  if coalesce(array_length(p_locales, 1), 0) = 0 then raise exception 'Elegí al menos un local'; end if;
  if jsonb_typeof(p_productos) is distinct from 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'Agregá al menos un producto';
  end if;
  if jsonb_array_length(p_productos) > 30 then raise exception 'Como mucho 30 productos'; end if;
  -- Todo o nada: primero se revisa que pueda en todos los locales.
  foreach v_loc in array p_locales loop
    if not exists (select 1 from orden_locales where id = v_loc) then raise exception 'No encontramos uno de los locales'; end if;
    if not orden_es_supervisor_de(v_loc) or orden_es_gerencia() then
      raise exception 'No podés programar el control en %', (select nombre from orden_locales where id = v_loc);
    end if;
    -- Es un control por semana y local: si esa semana ya tiene otro día, no se mueve (lo de ese día quedaría trabado).
    if exists (select 1 from testigo_semanas where local_id = v_loc and semana = p_fecha - (extract(isodow from p_fecha)::int - 1)
                 and fecha is not null and fecha <> p_fecha) then
      raise exception 'En % ya hay un control esa semana, el %: sumá los productos a ese día o programalo en otra semana',
        (select nombre from orden_locales where id = v_loc),
        (select to_char(fecha, 'DD/MM') from testigo_semanas where local_id = v_loc and semana = p_fecha - (extract(isodow from p_fecha)::int - 1));
    end if;
  end loop;
  for v_p in select * from jsonb_array_elements(p_productos) loop
    v_prod := nullif(trim(coalesce(v_p->>'producto', '')), '');
    if v_prod is null then raise exception 'Hay un producto sin nombre'; end if;
    if length(v_prod) > 80 then raise exception 'El nombre "%" es muy largo', left(v_prod, 40); end if;
    if length(coalesce(v_p->>'color', '')) > 30 then raise exception 'El color de "%" es muy largo', v_prod; end if;
  end loop;

  v_semana := p_fecha - (extract(isodow from p_fecha)::int - 1);
  foreach v_loc in array (select array_agg(distinct x) from unnest(p_locales) x) loop
    select * into v_sem from testigo_semanas where local_id = v_loc and semana = v_semana for update;
    if found and v_sem.cerrada then
      raise exception 'En % la semana del % ya está cerrada', (select nombre from orden_locales where id = v_loc), to_char(v_semana, 'DD/MM');
    end if;
    if not found then
      insert into testigo_semanas (local_id, semana, fecha, cargado_por) values (v_loc, v_semana, p_fecha, orden_yo_id())
      returning * into v_sem;
    elsif v_sem.fecha is null then
      update testigo_semanas set fecha = p_fecha where id = v_sem.id;   -- una planilla vieja (sin día)
    end if;
    v_n_loc := v_n_loc + 1;
    v_aca := 0;
    for v_p in select * from jsonb_array_elements(p_productos) loop
      v_prod := trim(v_p->>'producto');
      v_color := nullif(trim(coalesce(v_p->>'color', '')), '');
      continue when exists (select 1 from testigo_items where semana_id = v_sem.id
                              and lower(producto) = lower(v_prod) and lower(coalesce(color, '')) = lower(coalesce(v_color, '')));
      select coalesce(max(item), 0) + 1 into v_item from testigo_items where semana_id = v_sem.id;
      insert into testigo_items (semana_id, item, producto, color) values (v_sem.id, v_item, v_prod, v_color);
      v_aca := v_aca + 1;
    end loop;
    -- Si ya la habían mandado y se suman productos, vuelve a quedar para cargar.
    if v_aca > 0 then update testigo_semanas set cargada_en = null, cargada_por = null where id = v_sem.id; end if;
    v_nuevos := v_nuevos + v_aca;
  end loop;
  return jsonb_build_object('ok', true, 'locales', v_n_loc, 'productos', jsonb_array_length(p_productos), 'nuevos', v_nuevos, 'semana', v_semana);
end $$;

-- ---------- ¿El vendedor puede cargar? (el supervisor y el administrador, siempre) ----------
-- Desde el día del control y durante una semana, hasta que la manda. Después,
-- lo corrige el supervisor o el administrador (así no se pisa lo que corrigieron).
create or replace function testigo_abierto_(s testigo_semanas)
returns void language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (orden_es_del_local(s.local_id) or orden_es_supervisor_de(s.local_id)) or orden_es_gerencia() then
    raise exception 'Este control no es de tu local';
  end if;
  if s.cerrada then raise exception 'Esta semana ya está cerrada'; end if;
  if orden_es_supervisor_de(s.local_id) then return; end if;
  if s.fecha is null then raise exception 'Este control lo carga el supervisor'; end if;
  if s.fecha > v_hoy then raise exception 'Se carga el día del control (el %)', to_char(s.fecha, 'DD/MM'); end if;
  if s.cargada_en is not null then raise exception 'Ya lo mandaron: si hay que corregir algo, avisale a tu supervisor'; end if;
  if v_hoy > s.fecha + 6 then raise exception 'Este control ya cerró (era del %): avisale a tu supervisor', to_char(s.fecha, 'DD/MM'); end if;
end $$;

-- ---------- El local carga los números de un producto ----------
create or replace function testigo_entero_(p jsonb, k text, p_nulo boolean) returns integer
language plpgsql immutable as $$
declare v text := nullif(trim(coalesce(p->>k, '')), ''); n integer;
begin
  if v is null then return case when p_nulo then null else 0 end; end if;
  if v !~ '^\d{1,5}$' then raise exception 'Revisá "%": tiene que ser un número entero', replace(k, '_', ' '); end if;
  return v::integer;
end $$;

create or replace function testigo_cargar(p_item uuid, p_datos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare i testigo_items; s testigo_semanas; r jsonb;
begin
  select * into i from testigo_items where id = p_item for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  select * into s from testigo_semanas where id = i.semana_id;
  perform testigo_abierto_(s);
  update testigo_items set
    enviada       = testigo_entero_(p_datos, 'enviada', true),
    stock_sistema = testigo_entero_(p_datos, 'stock_sistema', true),
    cantidad_real = testigo_entero_(p_datos, 'cantidad_real', true),
    vendida       = testigo_entero_(p_datos, 'vendida', true),
    dev_fabrica   = testigo_entero_(p_datos, 'dev_fabrica', false),
    salieron      = testigo_entero_(p_datos, 'salieron', false),
    entraron      = testigo_entero_(p_datos, 'entraron', false),
    observacion   = nullif(left(trim(coalesce(p_datos->>'observacion', '')), 300), ''),
    cargado_en    = now(),
    cargado_por   = orden_yo_id()
  where id = i.id;
  select to_jsonb(v) into r from testigo_v_items v where v.id = i.id;
  return r;
end $$;

-- ---------- El video de un producto (ya subido al bucket) ----------
create or replace function testigo_video_guardar(p_item uuid, p_path text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare i testigo_items; s testigo_semanas;
begin
  select * into i from testigo_items where id = p_item for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  select * into s from testigo_semanas where id = i.semana_id;
  perform testigo_abierto_(s);
  if p_path is null or p_path not like s.local_id::text || '/' || s.id::text || '/' || i.id::text || '-%' or p_path like '%..%' then
    raise exception 'Ese video no es de este producto';
  end if;
  if i.video_path is not null and i.video_path <> p_path and not i.video_borrado and i.video_path like s.local_id::text || '/%' then
    insert into testigo_videos_viejos (path) values (i.video_path) on conflict do nothing;
  end if;
  update testigo_items set video_path = p_path, video_subido_en = now(), video_borrado = false where id = i.id;
end $$;

-- ---------- El local la manda: si falta algo, se avisa ----------
create or replace function testigo_terminar(p_semana uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s testigo_semanas; v_falta int; v_texto text; v_dif int; v_local text;
begin
  select * into s from testigo_semanas where id = p_semana for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  perform testigo_abierto_(s);
  select count(*) into v_falta from testigo_items where semana_id = s.id and (stock_sistema is null or cantidad_real is null);
  if v_falta > 0 then
    raise exception 'Falta cargar el stock del sistema o la cantidad real de % producto%', v_falta, case when v_falta = 1 then '' else 's' end;
  end if;
  update testigo_semanas set cargada_en = now(), cargada_por = orden_yo_id() where id = s.id;
  select count(*) filter (where stock_sistema <> cantidad_real),
         string_agg(producto || coalesce(' ' || color, '') || ': ' ||
                    case when stock_sistema > cantidad_real then 'falta' || case when stock_sistema - cantidad_real > 1 then 'n ' else ' ' end || (stock_sistema - cantidad_real)
                         else 'sobra' || case when cantidad_real - stock_sistema > 1 then 'n ' else ' ' end || (cantidad_real - stock_sistema) end,
                    ' · ' order by item) filter (where stock_sistema <> cantidad_real)
    into v_dif, v_texto
    from testigo_items where semana_id = s.id;
  if v_dif > 0 then
    select nombre into v_local from orden_locales where id = s.local_id;
    perform orden_avisar_responsables(s.local_id, 'ambos', 'testigo_diferencia',
      'Producto testigo en ' || v_local || ': ' || v_dif || case when v_dif = 1 then ' producto con diferencia' else ' productos con diferencia' end,
      left(v_texto, 400), '/admin-testigo', 'testigo-fin:' || s.id || ':' || md5(v_texto), 2::smallint);
  end if;
  return jsonb_build_object('ok', true, 'con_diferencia', v_dif);
end $$;

-- ---------- El reloj: "Mañana tienen producto testigo" y "Hoy…" (lo llama tick) ----------
create or replace function testigo_tick()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hoy date := v_ahora::date; r record; v_n int := 0; v_lista text;
begin
  -- Sólo de 10 a 20 h: nada de avisos a la noche.
  if extract(hour from v_ahora) < 10 or extract(hour from v_ahora) >= 20 then return jsonb_build_object('avisos', 0); end if;
  for r in
    select s.id, s.local_id, s.fecha, p.id as persona_id, p.rol
      from testigo_semanas s
      join orden_personas p on p.local_id = s.local_id and p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
     where s.fecha in (v_hoy, v_hoy + 1) and s.cargada_en is null and not s.cerrada
       and exists (select 1 from testigo_items i where i.semana_id = s.id)
  loop
    select string_agg(producto || coalesce(' ' || color, ''), ', ' order by item) into v_lista from testigo_items where semana_id = r.id;
    if orden_encolar_aviso(r.persona_id, 'testigo',
         case when r.fecha = v_hoy then 'Hoy tienen producto testigo' else 'Mañana tienen producto testigo' end,
         left('Se cuentan: ' || v_lista || '. Cargalo en la app y grabá el video de cada uno.', 300),
         case when r.rol = 'supervisor' then '/admin-testigo' else '/testigo' end,
         'testigo-' || case when r.fecha = v_hoy then 'hoy' else 'manana' end || ':' || r.id || ':' || r.fecha || ':' || r.persona_id,
         2::smallint) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('avisos', v_n);
end $$;

-- ---------- Los videos viejos (los borra el reloj del bucket) ----------
create or replace function testigo_videos_para_borrar(p_limite integer default 200)
returns table (item_id uuid, path text) language sql stable security definer set search_path = public as $$
  (select null::uuid, v.path from testigo_videos_viejos v order by v.desde limit p_limite)
  union all
  (select i.id, i.video_path
     from testigo_items i join testigo_semanas s on s.id = i.semana_id
     left join orden_config c on c.local_id = s.local_id
    where i.video_path is not null and not i.video_borrado
      and i.video_subido_en < now() - make_interval(days =>
            case when i.stock_sistema is distinct from i.cantidad_real
                 then coalesce(c.dias_guardar_fotos_problemas, 90) else coalesce(c.dias_guardar_videos, 14) end)
    order by i.video_subido_en limit p_limite)
$$;

create or replace function testigo_marcar_videos_borrados(p_items uuid[], p_paths text[])
returns void language sql volatile security definer set search_path = public as $$
  update testigo_items set video_borrado = true where id = any (coalesce(p_items, '{}'));
  delete from testigo_videos_viejos where path = any (coalesce(p_paths, '{}'));
$$;

-- ---------- El bucket de los videos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('testigo-videos', 'testigo-videos', false, 20971520, array['video/webm', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
-- Carpetas: {local_id}/{semana_id}/{item_id}-{archivo}
drop policy if exists "testigo: subir videos de mi local" on storage.objects;
create policy "testigo: subir videos de mi local" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'testigo-videos'
  and (orden_es_admin()
       or exists (select 1 from orden_personas p
                   where p.auth_user_id = auth.uid() and p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
                     and p.local_id::text = (storage.foldername(name))[1]))
  and exists (select 1 from testigo_semanas t where t.id::text = (storage.foldername(name))[2] and t.local_id::text = (storage.foldername(name))[1])
);
drop policy if exists "testigo: ver videos de mi local" on storage.objects;
create policy "testigo: ver videos de mi local" on storage.objects
for select to authenticated
using (
  bucket_id = 'testigo-videos'
  and (orden_es_admin()
       or orden_es_gerencia()
       or exists (select 1 from orden_personas p
                   where p.auth_user_id = auth.uid() and p.activo and p.aprobado and p.rol in ('vendedor', 'supervisor')
                     and p.local_id::text = (storage.foldername(name))[1]))
);
drop policy if exists "testigo: borrar videos (supervisores)" on storage.objects;
create policy "testigo: borrar videos (supervisores)" on storage.objects
for delete to authenticated
using (
  bucket_id = 'testigo-videos'
  and (orden_es_admin()
       or exists (select 1 from orden_personas p
                   where p.auth_user_id = auth.uid() and p.activo and p.aprobado and p.rol = 'supervisor'
                     and p.local_id::text = (storage.foldername(name))[1]))
);

-- =====================================================================
-- El mapa (pedido de Mauricio, 13/10, ya con Rivadavia armado en 22):
--   · ponerle nombre a un módulo ("Vidriera", "Caja"…) para identificarlo;
--   · repartir parejo: 22 módulos entre 3 → 7, 7 y 8, en bloques seguidos;
--   · el depósito también en módulos (cada uno entra en una foto), con su
--     forma (largo o cuadrado), numerados 1, 2, 3… y repartidos igual.
-- Lo hacen el supervisor del local o el administrador.
-- =====================================================================

-- Armar el mapa, ahora también con el depósito: p_mapa puede traer
-- "deposito" (cuántos módulos) y "forma_deposito". Si no los trae (una
-- pantalla vieja), el depósito no se toca.
create or replace function orden_mapa_guardar(p_local uuid, p_mapa jsonb, p_islas text[] default '{}')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_iz int := coalesce(nullif(p_mapa->>'izquierda', '')::int, 0);
  v_fo int := coalesce(nullif(p_mapa->>'fondo', '')::int, 0);
  v_de int := coalesce(nullif(p_mapa->>'derecha', '')::int, 0);
  v_fr int := coalesce(nullif(p_mapa->>'frente', '')::int, 0);
  v_forma text := case when p_mapa->>'forma' = 'cuadrado' then 'cuadrado' else 'rectangulo' end;
  v_dep int := nullif(p_mapa->>'deposito', '')::int;
  v_forma_dep text := case when p_mapa->>'forma_deposito' = 'cuadrado' then 'cuadrado' else 'rectangulo' end;
  v_total int; v_sec uuid; v_sec_dep uuid; v_n int; v_isla text; v_islas int := 0; v_creados int := 0; v_id uuid; v_num int;
  v_activo boolean; v_dest uuid; v_vistas text[] := '{}'; v_viejo jsonb;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not orden_es_supervisor_de(p_local) then raise exception 'Sólo el supervisor del local arma el mapa'; end if;
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'No encontramos ese local'; end if;
  if least(v_iz, v_fo, v_de, v_fr) < 0 or greatest(v_iz, v_fo, v_de, v_fr) > 40 then
    raise exception 'Cada pared va de 0 a 40 módulos';
  end if;
  if v_dep is not null and (v_dep < 0 or v_dep > 40) then raise exception 'El depósito va de 0 a 40 módulos'; end if;
  v_total := v_iz + v_fo + v_de + v_fr;
  -- Las de adentro van del 101 en adelante: las paredes no pueden pasar de 100.
  if v_total > 100 then raise exception 'Entre todas las paredes, como mucho 100 módulos'; end if;
  if coalesce(array_length(p_islas, 1), 0) > 30 then raise exception 'Como mucho 30 cosas adentro del local'; end if;

  insert into orden_config (local_id) values (p_local) on conflict do nothing;
  select mapa into v_viejo from orden_config where local_id = p_local for update;
  update orden_config set mapa = coalesce(v_viejo, '{}'::jsonb)
                                 || jsonb_build_object('forma', v_forma, 'izquierda', v_iz, 'fondo', v_fo, 'derecha', v_de, 'frente', v_fr)
                                 || case when v_dep is null then '{}'::jsonb else jsonb_build_object('deposito', v_dep, 'forma_deposito', v_forma_dep) end,
                         actualizado_en = now()
   where local_id = p_local;

  -- Si el local todavía no tiene ningún sector de salón, se arma el primero.
  select id into v_sec from orden_sectores where local_id = p_local and tipo = 'salon' and activo order by numero limit 1;
  if v_sec is null then
    insert into orden_sectores (local_id, tipo, numero)
    values (p_local, 'salon', coalesce((select max(numero) from orden_sectores where local_id = p_local and tipo = 'salon'), 0) + 1)
    returning id into v_sec;
  end if;

  -- Los de las paredes, del 1 al total. Uno nuevo va al sector del anterior
  -- (así quedan en bloque); si no hay anterior, al primer sector. Si el que
  -- tiene ese número quedó en un sector apagado, vuelve a la pared en uno
  -- activo (el mismo módulo, con su historia: nunca dos con el mismo número).
  for v_n in 1..v_total loop
    v_id := null;
    select m.id, s.activo into v_id, v_activo from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = p_local and s.tipo = 'salon' and not m.isla and m.numero = v_n
     order by s.activo desc, m.activo desc, s.numero limit 1;
    v_dest := coalesce((select m.sector_id from orden_modulos m join orden_sectores s on s.id = m.sector_id
                         where s.local_id = p_local and s.tipo = 'salon' and s.activo and not m.isla and m.numero < v_n
                         order by m.numero desc limit 1), v_sec);
    if v_id is null then
      insert into orden_modulos (sector_id, numero, nombre) values (v_dest, v_n, 'Módulo ' || v_n);
      v_creados := v_creados + 1;
    else
      update orden_modulos set activo = true, sector_id = case when v_activo then sector_id else v_dest end
       where id = v_id and (not activo or not v_activo);
    end if;
  end loop;
  -- Los que sobran se apagan (no se borran: sus fotos y su historia quedan).
  update orden_modulos m set activo = false
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and s.tipo = 'salon' and not m.isla and m.numero > v_total and m.activo;

  -- Las islas, por nombre: las que ya no están se apagan; las nuevas van al
  -- primer sector (el supervisor las reparte) con un número de 101 en adelante.
  update orden_modulos m set activo = false
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and m.isla and m.activo
     and not (lower(trim(m.nombre)) = any (select lower(trim(x)) from unnest(coalesce(p_islas, '{}'::text[])) x));
  foreach v_isla in array coalesce(p_islas, '{}'::text[]) loop
    v_isla := nullif(trim(v_isla), '');
    continue when v_isla is null or lower(v_isla) = any (v_vistas);
    if length(v_isla) > 40 then raise exception 'El nombre "%" es muy largo', left(v_isla, 40); end if;
    v_vistas := v_vistas || lower(v_isla);
    v_islas := v_islas + 1;
    v_id := null;
    select m.id, s.activo into v_id, v_activo from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = p_local and s.tipo = 'salon' and m.isla and lower(trim(m.nombre)) = lower(v_isla)
     order by s.activo desc, m.activo desc limit 1;
    if v_id is not null then
      update orden_modulos set activo = true, sector_id = case when v_activo then sector_id else v_sec end
       where id = v_id and (not activo or not v_activo);
    else
      select greatest(100, coalesce(max(m.numero), 0)) + 1 into v_num
        from orden_modulos m join orden_sectores s on s.id = m.sector_id where s.local_id = p_local and s.tipo = 'salon';
      insert into orden_modulos (sector_id, numero, nombre, isla) values (v_sec, v_num, v_isla, true);
      v_creados := v_creados + 1;
    end if;
  end loop;

  -- El depósito: módulos numerados 1, 2, 3… en todo el local (como las
  -- paredes). La primera vez, los que había (uno por sector, todos "1") se
  -- numeran seguidos por sector, con su historia.
  if v_dep is not null then
    select id into v_sec_dep from orden_sectores where local_id = p_local and tipo = 'deposito' and activo order by numero limit 1;
    if v_sec_dep is null and v_dep > 0 then
      insert into orden_sectores (local_id, tipo, numero)
      values (p_local, 'deposito', coalesce((select max(numero) from orden_sectores where local_id = p_local and tipo = 'deposito'), 0) + 1)
      returning id into v_sec_dep;
    end if;
    if exists (select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
                where s.local_id = p_local and s.tipo = 'deposito' and s.activo and m.activo and not m.isla
                group by m.numero having count(*) > 1) then
      update orden_modulos m set numero = m.numero + 1000
        from orden_sectores s where s.id = m.sector_id and s.local_id = p_local and s.tipo = 'deposito';
      update orden_modulos m set numero = x.n,
             nombre = case when m.nombre ~* '^dep[oó]sito( sector)? \d+$' then 'Depósito ' || x.n else m.nombre end
        from (select m2.id, row_number() over (order by s2.numero, m2.numero) as n
                from orden_modulos m2 join orden_sectores s2 on s2.id = m2.sector_id
               where s2.local_id = p_local and s2.tipo = 'deposito' and s2.activo and m2.activo and not m2.isla) x
       where x.id = m.id;
    end if;
    for v_n in 1..v_dep loop
      v_id := null;
      select m.id, s.activo into v_id, v_activo from orden_modulos m join orden_sectores s on s.id = m.sector_id
       where s.local_id = p_local and s.tipo = 'deposito' and not m.isla and m.numero = v_n
       order by s.activo desc, m.activo desc, s.numero limit 1;
      v_dest := coalesce((select m.sector_id from orden_modulos m join orden_sectores s on s.id = m.sector_id
                           where s.local_id = p_local and s.tipo = 'deposito' and s.activo and not m.isla and m.numero < v_n
                           order by m.numero desc limit 1), v_sec_dep);
      if v_id is null then
        insert into orden_modulos (sector_id, numero, nombre) values (v_dest, v_n, 'Depósito ' || v_n);
        v_creados := v_creados + 1;
      else
        update orden_modulos set activo = true, sector_id = case when v_activo then sector_id else v_dest end
         where id = v_id and (not activo or not v_activo);
      end if;
    end loop;
    update orden_modulos m set activo = false
      from orden_sectores s
     where s.id = m.sector_id and s.local_id = p_local and s.tipo = 'deposito' and not m.isla and m.numero > v_dep and m.activo;
  end if;

  -- Lo que quedó apagado ya no pide foto: se sacan sus controles de hoy en
  -- adelante que todavía no tienen ninguna (los que tienen foto quedan).
  delete from orden_controles c
   using orden_modulos m, orden_sectores s
   where m.id = c.modulo_id and s.id = m.sector_id and s.local_id = p_local and not m.activo
     and c.estado = 'pendiente' and c.enviado_en is null and (c.fecha >= v_hoy or c.vence_en > now())
     and not exists (select 1 from orden_fotos f where f.control_id = c.id);

  return jsonb_build_object('ok', true, 'modulos', v_total, 'islas', v_islas, 'deposito', v_dep, 'creados', v_creados);
end $$;
create or replace function orden_modulo_nombre(p_modulo uuid, p_nombre text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; s orden_sectores; v text := nullif(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), '');
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  select * into s from orden_sectores where id = m.sector_id;
  if not orden_es_supervisor_de(s.local_id) then raise exception 'Sólo el supervisor del local le pone nombre'; end if;
  if length(v) > 40 then raise exception 'El nombre es muy largo (hasta 40 letras)'; end if;
  -- Vacío vuelve al de siempre ("Módulo 7", "Depósito 3"). Lo de adentro siempre tiene nombre.
  if v is null and m.isla then raise exception 'Lo de adentro del local tiene que tener nombre'; end if;
  update orden_modulos set nombre = coalesce(v, case when s.tipo = 'deposito' then 'Depósito ' else 'Módulo ' end || m.numero) where id = m.id;
end $$;

-- Reparte los módulos de las paredes (o los del depósito, con p_tipo =
-- 'deposito') entre los sectores que tienen responsable (si ninguno tiene,
-- entre todos), en bloques seguidos y en orden: el sector 1 se lleva los
-- primeros. Si no da justo, los últimos sectores llevan uno más (22 entre 3:
-- 7, 7 y 8). Lo de adentro del salón no se toca.
create or replace function orden_mapa_repartir(p_local uuid, p_tipo text default 'salon')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_secs uuid[]; v_k int; v_n int; v_base int; v_extra int; v_i int := 0; v_desde int := 1; v_cant int;
  v_sec uuid; v_res jsonb := '[]'::jsonb; v_ids uuid[];
  v_tipo orden_sector_tipo := case when p_tipo = 'deposito' then 'deposito' else 'salon' end;
begin
  if not orden_es_supervisor_de(p_local) then raise exception 'Sólo el supervisor del local reparte los módulos'; end if;
  select array_agg(id order by numero) into v_secs from orden_sectores
   where local_id = p_local and tipo = v_tipo and activo and responsable_id is not null;
  if v_secs is null then
    select array_agg(id order by numero) into v_secs from orden_sectores where local_id = p_local and tipo = v_tipo and activo;
  end if;
  if v_secs is null then raise exception 'El local no tiene sectores en %', case when v_tipo = 'salon' then 'el salón' else 'el depósito' end; end if;
  select array_agg(m.id order by m.numero) into v_ids
    from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = p_local and s.tipo = v_tipo and s.activo and m.activo and not m.isla;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then raise exception 'No hay módulos para repartir'; end if;
  select m.numero into v_cant from orden_modulos m where m.id = any (v_ids) group by m.numero having count(*) > 1 limit 1;
  if v_cant is not null then
    raise exception 'Hay dos módulos con el número %: así no se puede repartir solo. Repartilos a mano, tocando cada módulo%.', v_cant,
      case when v_tipo = 'deposito' then ' (o guardá el mapa con el depósito: los numera seguidos)' else '' end;
  end if;
  v_k := array_length(v_secs, 1);
  v_base := v_n / v_k;
  v_extra := v_n % v_k;
  foreach v_sec in array v_secs loop
    v_i := v_i + 1;
    v_cant := v_base + case when v_i > v_k - v_extra then 1 else 0 end;
    if v_cant > 0 then
      -- Si en el sector de destino hay otro módulo (apagado) con el mismo número, se corre a un número libre del 201 en adelante.
      update orden_modulos o set numero = 200 + o.numero
        from orden_modulos m
       where m.id = any (v_ids[v_desde:v_desde + v_cant - 1]) and o.sector_id = v_sec and o.numero = m.numero and o.id <> m.id and not o.activo;
      update orden_modulos set sector_id = v_sec where id = any (v_ids[v_desde:v_desde + v_cant - 1]) and sector_id <> v_sec;
      perform orden_controles_reasignar(v_sec);
      v_res := v_res || jsonb_build_object('sector', v_sec, 'cantidad', v_cant,
        'desde', (select numero from orden_modulos where id = v_ids[v_desde]),
        'hasta', (select numero from orden_modulos where id = v_ids[v_desde + v_cant - 1]));
    end if;
    v_desde := v_desde + v_cant;
  end loop;
  return jsonb_build_object('ok', true, 'modulos', v_n, 'sectores', v_k, 'reparto', v_res);
end $$;

-- Los controles que siguen abiertos (los de hoy en adelante y los del depósito
-- de la semana, que vencen el viernes) pasan a quien le toca ahora. (Reemplaza la del SQL 99.)
create or replace function orden_controles_reasignar(p_sector uuid)
returns void language sql volatile security definer set search_path = public as $$
  update orden_controles c set persona_id = orden_asignado(m.sector_id, greatest(c.fecha, (now() at time zone 'America/Argentina/Buenos_Aires')::date))
    from orden_modulos m
   where m.id = c.modulo_id and m.sector_id = p_sector
     and c.estado = 'pendiente' and c.enviado_en is null
     and (c.fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date or c.vence_en > now())
     and not exists (select 1 from orden_fotos f where f.control_id = c.id)
     and c.persona_id is distinct from orden_asignado(m.sector_id, greatest(c.fecha, (now() at time zone 'America/Argentina/Buenos_Aires')::date))
$$;

-- ---------- Permisos ----------
do $$
begin
  revoke all on function orden_controles_reasignar(uuid) from public, anon, authenticated;
  grant execute on function orden_controles_reasignar(uuid) to service_role;
  revoke all on function testigo_abierto_(testigo_semanas) from public, anon, authenticated;
  grant execute on function testigo_abierto_(testigo_semanas) to service_role;
  revoke all on function orden_modulo_nombre(uuid, text) from public, anon;
  revoke all on function orden_mapa_repartir(uuid, text) from public, anon;
  grant execute on function orden_modulo_nombre(uuid, text) to authenticated, service_role;
  grant execute on function orden_mapa_repartir(uuid, text) to authenticated, service_role;
  revoke all on table testigo_v_items from anon;
  grant select on table testigo_v_items to authenticated;
  grant all on table testigo_v_items to service_role;
  revoke all on table testigo_videos_viejos from anon, authenticated;
  grant all on table testigo_videos_viejos to service_role;
  revoke all on function testigo_programar(date, uuid[], jsonb) from public, anon;
  revoke all on function testigo_entero_(jsonb, text, boolean) from public, anon, authenticated;
  revoke all on function testigo_cargar(uuid, jsonb) from public, anon;
  revoke all on function testigo_video_guardar(uuid, text) from public, anon;
  revoke all on function testigo_terminar(uuid) from public, anon;
  revoke all on function testigo_tick() from public, anon, authenticated;
  revoke all on function testigo_videos_para_borrar(integer) from public, anon, authenticated;
  revoke all on function testigo_marcar_videos_borrados(uuid[], text[]) from public, anon, authenticated;
  grant execute on function testigo_programar(date, uuid[], jsonb) to authenticated, service_role;
  grant execute on function testigo_entero_(jsonb, text, boolean) to service_role;
  grant execute on function testigo_cargar(uuid, jsonb) to authenticated, service_role;
  grant execute on function testigo_video_guardar(uuid, text) to authenticated, service_role;
  grant execute on function testigo_terminar(uuid) to authenticated, service_role;
  grant execute on function testigo_tick() to service_role;
  grant execute on function testigo_videos_para_borrar(integer) to service_role;
  grant execute on function testigo_marcar_videos_borrados(uuid[], text[]) to service_role;
end $$;

select 'listo: Productos testigo desde los locales' as "SQL 102";
