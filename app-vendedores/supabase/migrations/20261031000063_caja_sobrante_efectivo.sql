-- =====================================================================
-- Módulo VDH · Migración 63 (SQL 213), 31/10/2026: los totales del mes
-- de Cajas cuentan sólo las diferencias que no tienen explicación abajo.
--
-- Pedidos de Mauricio (31/10, en Supervisión → Cajas, mirando octubre de
-- Rivadavia):
--   - El efectivo que sobra: "si sobra plata se ingresa a la caja inicial
--     del otro día. Así que no pondría ese desvío en la parte mensual"
--     (el 10/10 sobraron $ 11.035). Y que quede anotado, como las
--     diferencias a cargo.
--   - La diferencia a cargo: "en el total tampoco pondría los 78 de SEBA
--     porque, en realidad, el sistema da bien. Fue un error de SEBA, pero
--     mientras esté el detalle del error ahí abajo, en los totales
--     mensuales tendría que dar bien eso" (el 14/10, tarjeta $ 78.000 y
--     Go Cuotas -$ 78.000, a cargo de Seba).
--
-- Cambio, sólo en orden_v_cajas_mes (los totales del mes: la fila Total,
-- el resumen por mes, Todos los locales y lo que se guarda al cerrar el
-- mes):
--   - Los desvíos de un día con la diferencia a cargo de alguien
--     (diferencia_persona) no suman: ese día ya figura en "Diferencias a
--     cargo".
--   - desvio_efectivo suma sólo lo que FALTÓ (los días con desvío
--     positivo). El día que sobró cuenta como $ 0.
--   - sobrante_efectivo (nueva, al final): cuánto sobró en el mes, en
--     positivo. La pantalla lo muestra aparte ("Efectivo que sobró").
-- Lo de cierre y lo real del mes siguen sumando todos los días. Los días
-- no cambian: cada caja sigue con su desvío y su alerta.
--
-- Reversible: la vuelta atrás está en deshacer-213.sql.
-- =====================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'orden_v_cajas_mes' and column_name = 'sobrante_efectivo') then
    raise exception 'El SQL 213 ya está corrido: no hace falta correrlo de nuevo';
  end if;
end $$;

-- Igual a la que está andando, salvo los cuatro desvíos y la columna nueva del final.
-- El "with (security_invoker = true)" va sí o sí: create or replace view sin él se lo saca.
create or replace view orden_v_cajas_mes with (security_invoker = true) as
 with dias as (
         select l.id as local_id,
            l.nombre as local_nombre,
            g.g::date as fecha
           from orden_locales l
             join lateral ( select min(c_1.fecha) as desde
                   from orden_cajas c_1
                  where c_1.local_id = l.id) ini on ini.desde is not null
             cross join lateral generate_series(ini.desde::timestamp with time zone, orden_dia_caja(l.id)::timestamp with time zone, '1 day'::interval) g(g)
          where l.activo and orden_local_abre(l.id, g.g::date)
        )
 select d.local_id,
    d.local_nombre,
    to_char(d.fecha::timestamp with time zone, 'YYYY-MM'::text) as mes,
    sum(c.sis_mp) as sis_mp,
    sum(c.real_mp) as real_mp,
    -- (SQL 213) El día con la diferencia a cargo de alguien no suma: figura en "Diferencias a cargo".
    sum(case when c.diferencia_persona is null then c.desvio_mp else 0 end) filter (where c.id is not null) as desvio_mp,
    sum(c.sis_tarjeta) as sis_tarjeta,
    sum(c.real_lote) as real_lote,
    sum(case when c.diferencia_persona is null then c.desvio_tarjeta else 0 end) filter (where c.id is not null) as desvio_tarjeta,
    sum(c.sis_gocuotas) as sis_gocuotas,
    sum(c.real_gocuotas) as real_gocuotas,
    sum(case when c.diferencia_persona is null then c.desvio_gocuotas else 0 end) filter (where c.id is not null) as desvio_gocuotas,
    sum(c.sis_saldo_final_efvo) as sis_efectivo,
    sum(c.real_efectivo) as real_efectivo,
    -- (SQL 213) Sólo lo que faltó: lo que sobra pasa a la caja inicial del día siguiente.
    sum(case when c.diferencia_persona is null then greatest(c.desvio_efectivo, 0) else 0 end) filter (where c.id is not null) as desvio_efectivo,
    count(*) filter (where c.id is null or c.estado = 'pendiente'::text) as dias_sin_cargar,
    count(*) filter (where c.estado = 'cargada'::text) as dias_sin_controlar,
    count(*) filter (where jsonb_array_length(coalesce(c.alertas, '[]'::jsonb)) > 0) as dias_con_alertas,
    -- (SQL 213) Lo que sobró, en positivo (todos los días: figura en "Efectivo que sobró").
    sum(greatest(- c.desvio_efectivo, 0)) filter (where c.id is not null) as sobrante_efectivo
   from dias d
     left join orden_cajas c on c.local_id = d.local_id and c.fecha = d.fecha
  group by d.local_id, d.local_nombre, (to_char(d.fecha::timestamp with time zone, 'YYYY-MM'::text));

-- Chequeo: tiene que decir t y t (la columna nueva y la vista sigue con los permisos de quien la mira).
select exists (select 1 from information_schema.columns where table_name = 'orden_v_cajas_mes' and column_name = 'sobrante_efectivo') as columna_nueva,
       (select 'security_invoker=true' = any(reloptions) from pg_class where relname = 'orden_v_cajas_mes') as permisos_bien;
