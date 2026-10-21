-- =====================================================================
-- Módulo VDH · Migración 48 (SQL 152), 21/10/2026: el producto testigo con
-- fecha límite, rubro y locales por producto. Pedido de Mauricio, con su
-- planilla "Productos a controlar" (Rubro, Producto, Color, Fecha Límite):
--   · El "Día" del control pasa a ser la FECHA LÍMITE: el local lo ve apenas
--     se programa y lo puede contar cualquier día hasta esa fecha, inclusive.
--     Pasada la fecha todavía lo puede mandar seis días más (queda "sin
--     mandar, venció el…" en rojo); después lo corrige el supervisor, como antes.
--   · Cada producto con su rubro (Remeras, Pantalones…).
--   · Cada producto con sus locales: todos los marcados, o sacarle alguno
--     (si a un local no le llegó, o le llegó en otro color: se le saca y se
--     agrega otra fila con ese color sólo para ese local).
--   · Los avisos: "Tienen producto testigo hasta el…" apenas está (si falta
--     más de un día), "Mañana vence…" y "Hoy vence…". Siempre de 10 a 20 h.
-- La firma de testigo_programar no cambia: la compu de antes sigue andando
-- (su "Día" se toma como fecha límite; sin rubro ni locales por producto).
-- No borra datos. Reversible: deshacer-152.sql.
-- =====================================================================

-- ---------- El rubro de cada producto ----------
alter table testigo_items add column if not exists rubro text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'testigo_items_rubro_largo') then
    alter table testigo_items add constraint testigo_items_rubro_largo check (length(rubro) <= 40);
  end if;
end $$;
comment on column testigo_items.rubro is 'Remeras, Pantalones… (SQL 152)';
comment on column testigo_semanas.fecha is 'La fecha límite del control (SQL 152; antes, el día que se contaba)';

-- ---------- La planilla con las cuentas: lo mismo, y el rubro al final ----------
create or replace view testigo_v_items with (security_invoker = true) as
 SELECT i.id,
    i.semana_id,
    i.item,
    i.producto,
    i.color,
    i.enviada,
    i.stock_sistema,
    i.cantidad_real,
    i.dev_fabrica,
    i.salieron,
    i.entraron,
    i.observacion,
    i.vendida,
    i.video_path,
    i.video_subido_en,
    i.video_borrado,
    i.cargado_en,
    i.cargado_por,
    s.local_id,
    s.semana,
    s.fecha,
    s.cargada_en,
    i.stock_sistema - i.cantidad_real AS diferencia,
        CASE
            WHEN COALESCE(i.enviada, 0) > 0 AND i.stock_sistema IS NOT NULL AND i.cantidad_real IS NOT NULL THEN round(100.0 * (i.stock_sistema - i.cantidad_real)::numeric / i.enviada::numeric, 1)
            ELSE NULL::numeric
        END AS desvio,
    i.rubro
   FROM testigo_items i
     JOIN testigo_semanas s ON s.id = i.semana_id;

-- ---------- ¿Este producto va a este local? Sin "locales", a todos (ya validados como uuid) ----------
create or replace function testigo_le_toca_(p jsonb, p_local uuid)
returns boolean language sql immutable set search_path = public as $$
  select not (p ? 'locales') or jsonb_typeof(p->'locales') = 'null'
      or exists (select 1 from jsonb_array_elements_text(p->'locales') x where x::uuid = p_local)
$$;

-- ---------- Programar un control (el administrador, o el supervisor en sus locales) ----------
-- p_fecha: la fecha límite. Cada producto: {rubro, producto, color, locales}. Sin "locales",
-- va a todos los de p_locales; con "locales", sólo a ésos (tienen que estar en p_locales).
-- Un local que se queda sin productos no recibe nada.
create or replace function testigo_programar(p_fecha date, p_locales uuid[], p_productos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_semana date; v_loc uuid; v_sem testigo_semanas; v_p jsonb; v_prod text; v_color text; v_rubro text;
  v_n_loc int := 0; v_nuevos int := 0; v_aca int; v_item int; v_tiene boolean;
begin
  if p_fecha is null or p_fecha < v_hoy - 7 or p_fecha > v_hoy + 60 then
    raise exception 'Elegí una fecha límite entre la semana pasada y los próximos dos meses';
  end if;
  if coalesce(array_length(p_locales, 1), 0) = 0 then raise exception 'Elegí al menos un local'; end if;
  if jsonb_typeof(p_productos) is distinct from 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'Agregá al menos un producto';
  end if;
  if jsonb_array_length(p_productos) > 30 then raise exception 'Como mucho 30 productos'; end if;
  for v_p in select * from jsonb_array_elements(p_productos) loop
    v_prod := nullif(trim(coalesce(v_p->>'producto', '')), '');
    if v_prod is null then raise exception 'Hay un producto sin nombre'; end if;
    if length(v_prod) > 80 then raise exception 'El nombre "%" es muy largo', left(v_prod, 40); end if;
    if length(coalesce(v_p->>'color', '')) > 30 then raise exception 'El color de "%" es muy largo', v_prod; end if;
    if length(coalesce(v_p->>'rubro', '')) > 40 then raise exception 'El rubro de "%" es muy largo', v_prod; end if;
    if v_p ? 'locales' and jsonb_typeof(v_p->'locales') <> 'null' then
      if jsonb_typeof(v_p->'locales') <> 'array' or jsonb_array_length(v_p->'locales') = 0 then
        raise exception '"%" no tiene ningún local', v_prod;
      end if;
      if exists (select 1 from jsonb_array_elements(v_p->'locales') x
                  where case when jsonb_typeof(x) = 'string' and x #>> '{}' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                             then not ((x #>> '{}')::uuid = any (p_locales)) else true end) then
        raise exception '"%" tiene un local que no está marcado', v_prod;
      end if;
    end if;
  end loop;
  v_semana := p_fecha - (extract(isodow from p_fecha)::int - 1);
  -- Todo o nada: primero se revisa que pueda en todos los locales que reciben algo.
  foreach v_loc in array p_locales loop
    if not exists (select 1 from orden_locales where id = v_loc) then raise exception 'No encontramos uno de los locales'; end if;
    if not orden_es_supervisor_de(v_loc) or orden_es_gerencia() then
      raise exception 'No podés programar el control en %', (select nombre from orden_locales where id = v_loc);
    end if;
    -- Es un control por semana y local: si esa semana ya tiene otra fecha límite, no se mueve.
    if exists (select 1 from testigo_semanas where local_id = v_loc and semana = v_semana and fecha is not null and fecha <> p_fecha) then
      raise exception 'En % ya hay un control esa semana, con fecha límite el %: sumá los productos con esa fecha o programalo en otra semana',
        (select nombre from orden_locales where id = v_loc),
        (select to_char(fecha, 'DD/MM') from testigo_semanas where local_id = v_loc and semana = v_semana);
    end if;
  end loop;

  foreach v_loc in array (select array_agg(distinct x) from unnest(p_locales) x) loop
    -- ¿Le toca algún producto a este local?
    select exists (select 1 from jsonb_array_elements(p_productos) p where testigo_le_toca_(p, v_loc)) into v_tiene;
    continue when not v_tiene;
    select * into v_sem from testigo_semanas where local_id = v_loc and semana = v_semana for update;
    if found and v_sem.cerrada then
      raise exception 'En % la semana del % ya está cerrada', (select nombre from orden_locales where id = v_loc), to_char(v_semana, 'DD/MM');
    end if;
    if not found then
      insert into testigo_semanas (local_id, semana, fecha, cargado_por) values (v_loc, v_semana, p_fecha, orden_yo_id())
      returning * into v_sem;
    elsif v_sem.fecha is null then
      update testigo_semanas set fecha = p_fecha where id = v_sem.id;   -- una planilla vieja (sin fecha)
    end if;
    v_n_loc := v_n_loc + 1;
    v_aca := 0;
    for v_p in select * from jsonb_array_elements(p_productos) loop
      continue when not testigo_le_toca_(v_p, v_loc);
      v_prod := trim(v_p->>'producto');
      v_color := nullif(trim(coalesce(v_p->>'color', '')), '');
      v_rubro := nullif(trim(coalesce(v_p->>'rubro', '')), '');
      if exists (select 1 from testigo_items where semana_id = v_sem.id
                   and lower(producto) = lower(v_prod) and lower(coalesce(color, '')) = lower(coalesce(v_color, ''))) then
        -- Ya estaba: si no tenía rubro, se lo pone.
        update testigo_items set rubro = v_rubro
         where semana_id = v_sem.id and rubro is null and v_rubro is not null
           and lower(producto) = lower(v_prod) and lower(coalesce(color, '')) = lower(coalesce(v_color, ''));
        continue;
      end if;
      select coalesce(max(item), 0) + 1 into v_item from testigo_items where semana_id = v_sem.id;
      insert into testigo_items (semana_id, item, producto, color, rubro) values (v_sem.id, v_item, v_prod, v_color, v_rubro);
      v_aca := v_aca + 1;
    end loop;
    -- Si ya la habían mandado y se suman productos, vuelve a quedar para cargar.
    if v_aca > 0 then update testigo_semanas set cargada_en = null, cargada_por = null where id = v_sem.id; end if;
    v_nuevos := v_nuevos + v_aca;
  end loop;
  return jsonb_build_object('ok', true, 'locales', v_n_loc, 'productos', jsonb_array_length(p_productos), 'nuevos', v_nuevos, 'semana', v_semana);
end $$;

-- ---------- ¿El vendedor puede cargar? (el supervisor y el administrador, siempre) ----------
-- Desde que se programa hasta seis días después de la fecha límite, hasta que lo manda.
-- Después lo corrige el supervisor o el administrador (así no se pisa lo que corrigieron).
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
  if s.cargada_en is not null then raise exception 'Ya lo mandaron: si hay que corregir algo, avisale a tu supervisor'; end if;
  if v_hoy > s.fecha + 6 then raise exception 'Este control ya cerró (la fecha límite era el %): avisale a tu supervisor', to_char(s.fecha, 'DD/MM'); end if;
end $$;

-- ---------- El reloj: "Tienen producto testigo hasta el…", "Mañana vence…" y "Hoy vence…" ----------
create or replace function testigo_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hoy date := v_ahora::date; r record; v_n int := 0; v_lista text; v_cual text;
begin
  -- Sólo de 10 a 20 h: nada de avisos a la noche.
  if extract(hour from v_ahora) < 10 or extract(hour from v_ahora) >= 20 then return jsonb_build_object('avisos', 0); end if;
  for r in
    select s.id, s.local_id, s.fecha, p.id as persona_id, p.rol, p.local_id is null as de_varios, l.nombre as local_nombre
      from testigo_semanas s
      join orden_locales l on l.id = s.local_id
      -- Los vendedores y el encargado del local, y (SQL 121) sus supervisores de varios locales.
      join orden_personas p on p.activo and p.aprobado
                           and ((p.local_id = s.local_id and p.rol in ('vendedor', 'supervisor'))
                                or p.id in (select orden_supervisores_de(s.local_id)))
     where s.fecha >= v_hoy and s.fecha <= v_hoy + 60 and s.cargada_en is null and not s.cerrada
       and exists (select 1 from testigo_items i where i.semana_id = s.id)
  loop
    v_cual := case when r.fecha = v_hoy then 'hoy' when r.fecha = v_hoy + 1 then 'manana' else 'nuevo' end;
    select string_agg(producto || coalesce(' ' || color, ''), ', ' order by item) into v_lista from testigo_items where semana_id = r.id;
    if orden_encolar_aviso(r.persona_id, 'testigo',
         case v_cual when 'hoy' then 'Hoy vence el producto testigo' when 'manana' then 'Mañana vence el producto testigo'
                     else 'Tienen producto testigo hasta el ' || to_char(r.fecha, 'DD/MM') end
           || case when r.de_varios then ' en ' || r.local_nombre else '' end,
         left('Se cuentan: ' || v_lista || '. Cargalo en la app y grabá el video de cada uno.', 300),
         case when r.rol = 'supervisor' then '/admin-testigo' else '/testigo' end,
         'testigo-' || v_cual || ':' || r.id || ':' || case when v_cual = 'nuevo' then '' else r.fecha || ':' end || r.persona_id,
         2::smallint) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('avisos', v_n);
end $$;

do $$
begin
  revoke all on function testigo_le_toca_(jsonb, uuid) from public, anon, authenticated;
  grant execute on function testigo_le_toca_(jsonb, uuid) to service_role;
  revoke all on function testigo_programar(date, uuid[], jsonb) from public, anon;
  grant execute on function testigo_programar(date, uuid[], jsonb) to authenticated, service_role;
  revoke all on function testigo_abierto_(testigo_semanas) from public, anon, authenticated;
  grant execute on function testigo_abierto_(testigo_semanas) to service_role;
  revoke all on function testigo_tick() from public, anon, authenticated;
  grant execute on function testigo_tick() to service_role;
end $$;
