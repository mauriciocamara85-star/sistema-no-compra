-- =====================================================================
-- Módulo VDH · Migración 27 (SQL 117), 14/10/2026: las ESTADÍSTICAS de
-- los productos testigo (pedido de Mauricio: "qué locales tienen más
-- productos que les faltan y cuáles no, en un porcentaje, por mes").
--
-- Dos vistas de sólo lectura, con la seguridad de quien mira (el
-- administrador y la gerencia ven todos los locales; el encargado, el suyo):
--   · testigo_v_mes: por local y mes, cuántos controles hubo, cuántos se
--     mandaron y cuántos no, cuántos productos se contaron, cuántos con
--     faltante (el stock del sistema es más que lo contado) o con sobrante,
--     y las unidades.
--   · testigo_v_productos: lo mismo por producto (y color): cuáles faltan
--     más seguido.
-- El mes es el del día en que se cuenta (o el de la semana, si no tiene día).
-- Un producto cuenta cuando tiene el stock del sistema y la cantidad real.
-- Reversible: drop view testigo_v_productos; drop view testigo_v_mes;
-- No toca ninguna tabla ni función.
-- =====================================================================

create or replace view testigo_v_mes with (security_invoker = true) as
select s.local_id, l.nombre as local_nombre,
       to_char(coalesce(s.fecha, s.semana), 'YYYY-MM') as mes,
       count(distinct s.id) as controles,
       count(distinct s.id) filter (where s.cargada_en is not null) as mandados,
       count(distinct s.id) filter (where s.cargada_en is null
                                      and coalesce(s.fecha, s.semana) < (now() at time zone 'America/Argentina/Buenos_Aires')::date) as sin_mandar,
       count(i.id) filter (where i.stock_sistema is not null and i.cantidad_real is not null) as productos,
       count(i.id) filter (where i.stock_sistema > i.cantidad_real) as con_faltante,
       count(i.id) filter (where i.stock_sistema < i.cantidad_real) as con_sobrante,
       coalesce(sum(i.stock_sistema - i.cantidad_real) filter (where i.stock_sistema > i.cantidad_real), 0) as unidades_faltan,
       coalesce(sum(i.cantidad_real - i.stock_sistema) filter (where i.stock_sistema < i.cantidad_real), 0) as unidades_sobran,
       coalesce(sum(i.enviada) filter (where i.stock_sistema is not null and i.cantidad_real is not null), 0) as enviadas
from testigo_semanas s
join orden_locales l on l.id = s.local_id
left join testigo_items i on i.semana_id = s.id
group by s.local_id, l.nombre, to_char(coalesce(s.fecha, s.semana), 'YYYY-MM');

create or replace view testigo_v_productos with (security_invoker = true) as
select s.local_id,
       to_char(coalesce(s.fecha, s.semana), 'YYYY-MM') as mes,
       min(trim(i.producto)) as producto,
       nullif(min(trim(coalesce(i.color, ''))), '') as color,
       count(*) as veces,
       count(*) filter (where i.stock_sistema > i.cantidad_real) as con_faltante,
       count(*) filter (where i.stock_sistema < i.cantidad_real) as con_sobrante,
       coalesce(sum(i.stock_sistema - i.cantidad_real) filter (where i.stock_sistema > i.cantidad_real), 0) as unidades_faltan
from testigo_items i
join testigo_semanas s on s.id = i.semana_id
where i.stock_sistema is not null and i.cantidad_real is not null
group by s.local_id, to_char(coalesce(s.fecha, s.semana), 'YYYY-MM'), lower(trim(i.producto)), lower(trim(coalesce(i.color, '')));

do $$
begin
  revoke all on table testigo_v_mes from anon;
  revoke all on table testigo_v_productos from anon;
  grant select on table testigo_v_mes to authenticated;
  grant select on table testigo_v_productos to authenticated;
end $$;
