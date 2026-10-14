-- ═══ SQL 117 (14/10/2026) · Equipo VDH → Productos testigo: las estadísticas ═══
-- Va después del 116. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Agrega la función testigo_estadisticas: las cuentas de los productos testigo por local y mes
--     (% con faltante, sobrante, controles sin mandar) y los productos que más faltan.
--   · Sólo lee: no cambia ninguna tabla ni función. Se puede correr antes de publicar la pantalla.
--   · Reversible: drop function testigo_estadisticas(text[], text[], uuid); drop function testigo_clave_(text);

-- =====================================================================
-- Módulo VDH · Migración 27 (SQL 117), 14/10/2026: las ESTADÍSTICAS de
-- los productos testigo (pedido de Mauricio: "qué locales tienen más
-- productos que les faltan y cuáles no, en un porcentaje, por mes").
--
-- testigo_estadisticas(meses, período, local): las cuentas las hace la base
-- y devuelve sólo el resultado (para que no se corte ni se ponga lenta
-- cuando se acumulen meses y locales):
--   · "meses": por local y mes (los meses pedidos), los controles
--     programados, mandados y sin mandar, los productos contados, con
--     faltante (el stock del sistema es más que lo contado) y con sobrante,
--     y las unidades.
--   · "productos": los 10 que más faltaron en el período, ya ordenados.
-- Cuenta un producto con los dos números cargados, de un control mandado
-- (o de una planilla vieja, sin día): un borrador sin mandar no cuenta.
-- El mismo producto escrito distinto (mayúsculas, espacios, tildes, el
-- espacio que queda al pegar de Excel) es uno solo.
-- Quién ve qué: el administrador y la gerencia, todos los locales; el
-- encargado y los vendedores, el suyo (como la planilla).
-- Reversible: drop function testigo_estadisticas(text[], text[], uuid);
-- No toca ninguna tabla ni función.
-- =====================================================================

/* Una primera versión de este SQL traía dos vistas: ya no se usan. */
drop view if exists testigo_v_productos;
drop view if exists testigo_v_mes;

/* El nombre de un producto o un color, para comparar. */
create or replace function testigo_clave_(p text)
returns text language sql immutable as $$
  select lower(trim(regexp_replace(translate(replace(coalesce(p, ''), chr(160), ' '), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'), '\s+', ' ', 'g')))
$$;

create or replace function testigo_estadisticas(p_meses text[], p_periodo text[], p_local uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_todos text[] := coalesce(p_meses, '{}') || coalesce(p_periodo, '{}');
  v_servicio boolean := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
  v_locales uuid[]; v_desde date; v_hasta date;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_res jsonb;
begin
  if not v_servicio and orden_yo_id() is null then raise exception 'Entrá con tu usuario'; end if;
  if coalesce(array_length(v_todos, 1), 0) = 0 or array_length(v_todos, 1) > 36 then raise exception 'Pedí entre 1 y 36 meses'; end if;
  if exists (select 1 from unnest(v_todos) m where m is null or m !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then raise exception 'Hay un mes que no es válido'; end if;
  /* Los locales que puede ver quien pregunta (una vez por local, no por fila). */
  select coalesce(array_agg(l.id), '{}') into v_locales
    from orden_locales l
   where (p_local is null or l.id = p_local)
     and (v_servicio or orden_ve_equipo(l.id) or orden_es_del_local(l.id));
  v_desde := (select min(m) from unnest(v_todos) m) || '-01';
  v_hasta := ((select max(m) from unnest(v_todos) m) || '-01')::date + interval '1 month';

  with sem as (
    select s.id, s.local_id, to_char(coalesce(s.fecha, s.semana), 'YYYY-MM') as mes, coalesce(s.fecha, s.semana) as dia, s.fecha, s.cargada_en,
           (s.cargada_en is not null or s.fecha is null) as cuenta
      from testigo_semanas s
     where s.local_id = any(v_locales) and coalesce(s.fecha, s.semana) >= v_desde and coalesce(s.fecha, s.semana) < v_hasta
  ), it as (
    select sem.local_id, sem.mes, i.semana_id, i.producto, i.color, i.stock_sistema, i.cantidad_real
      from sem join testigo_items i on i.semana_id = sem.id
     where sem.cuenta and i.stock_sistema is not null and i.cantidad_real is not null
  ), ctl as (
    select local_id, mes, count(*) as controles, count(*) filter (where cargada_en is not null) as mandados,
           count(*) filter (where cargada_en is null and fecha_pasada) as sin_mandar
      /* "Sin mandar": con día, y pasada una semana (el local lo puede mandar hasta 6 días después). */
      from (select sem.*, sem.fecha is not null and sem.fecha + 6 < v_hoy as fecha_pasada from sem) x
     group by local_id, mes
  ), prd as (
    select local_id, mes, count(distinct semana_id) as con_datos, count(*) as productos,
           count(*) filter (where stock_sistema > cantidad_real) as con_faltante,
           count(*) filter (where stock_sistema < cantidad_real) as con_sobrante,
           coalesce(sum(stock_sistema - cantidad_real) filter (where stock_sistema > cantidad_real), 0) as unidades_faltan,
           coalesce(sum(cantidad_real - stock_sistema) filter (where stock_sistema < cantidad_real), 0) as unidades_sobran
      from it group by local_id, mes
  ), top as (
    /* El nombre que más se usó (con sus mayúsculas y tildes), no el primero por orden alfabético. */
    select coalesce(nullif(mode() within group (order by trim(regexp_replace(replace(producto, chr(160), ' '), '\s+', ' ', 'g'))), ''), '(sin nombre)') as producto,
           nullif(mode() within group (order by trim(regexp_replace(replace(coalesce(color, ''), chr(160), ' '), '\s+', ' ', 'g'))), '') as color, count(*) as veces,
           count(*) filter (where stock_sistema > cantidad_real) as con_faltante,
           coalesce(sum(stock_sistema - cantidad_real) filter (where stock_sistema > cantidad_real), 0) as unidades_faltan
      from it where mes = any(p_periodo)
     group by testigo_clave_(producto), testigo_clave_(color)
    having count(*) filter (where stock_sistema > cantidad_real) > 0
     order by 4 desc, 5 desc, 1
     limit 10
  )
  select jsonb_build_object(
    'meses', coalesce((select jsonb_agg(jsonb_build_object(
        'local_id', c.local_id, 'local_nombre', l.nombre, 'activo', l.activo, 'mes', c.mes,
        'controles', c.controles, 'mandados', c.mandados, 'sin_mandar', c.sin_mandar,
        'con_datos', coalesce(p.con_datos, 0), 'productos', coalesce(p.productos, 0),
        'con_faltante', coalesce(p.con_faltante, 0), 'con_sobrante', coalesce(p.con_sobrante, 0),
        'unidades_faltan', coalesce(p.unidades_faltan, 0), 'unidades_sobran', coalesce(p.unidades_sobran, 0)) order by l.nombre, c.mes)
      from ctl c join orden_locales l on l.id = c.local_id left join prd p on p.local_id = c.local_id and p.mes = c.mes
      where c.mes = any(v_todos)), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(to_jsonb(t) order by t.con_faltante desc, t.unidades_faltan desc, t.producto) from top t), '[]'::jsonb))
  into v_res;
  return v_res;
end $$;

do $$
begin
  revoke all on function testigo_clave_(text) from public, anon;
  grant execute on function testigo_clave_(text) to authenticated, service_role;
  revoke all on function testigo_estadisticas(text[], text[], uuid) from public, anon;
  grant execute on function testigo_estadisticas(text[], text[], uuid) to authenticated, service_role;
end $$;
