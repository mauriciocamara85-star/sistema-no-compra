-- SQL 250 (5/11/2026, migración 78): Mercado Pago sin «Hoy» y el mismo posnet en dos fotos.
--   Lo que se vio el 5/11 a la noche:
--   1) Grand Bourg y Parque Brown: la IA leyó todos los cobros de Mercado Pago (9 que suman $ 219.000 y 7 que suman
--      $ 853.000, justo lo que decía el sistema), pero en la foto no se veía «Hoy» ni la fecha arriba de la lista: la IA
--      la marca «cortada» (pueden faltar cobros del día) y con una sola foto la base no usaba la suma. Mercado Pago quedaba
--      vacío («Falta cargar Mercado Pago») y en Parque Brown lo escribieron a mano.
--      Desde ahora: con una sola foto de Mercado Pago sin el total, si lo que se ve de la lista ya da lo que dice el
--      sistema (o más, con la tolerancia del local), vale eso: así no puede faltar plata. Si da menos, sigue vacío y la
--      app pide otra foto de la lista.
--   2) Parque Brown: sacó los dos posnet juntos en una foto ($ 708.600) y otra vez los dos juntos como «otro posnet»:
--      la base sumaba las dos fotos y daba $ 1.417.200. Desde ahora, con varias fotos del posnet, cada posnet (su total)
--      cuenta una vez aunque esté en dos fotos (dos posnet con el mismo total en UNA foto, dos veces), como las ventas
--      de Mercado Pago (SQL 242). Y un posnet que en una foto no se leyó pero en otra sí (el mismo nombre) vale la otra.
--   Lo de antes no cambia: una foto sola del posnet vale su total; Mercado Pago con el total del día en la pantalla vale
--   ese; varias fotos de Mercado Pago, las ventas sin repetir.
--   Después: las cajas de noviembre sin controlar se completan con la regla nueva (sólo lo vacío o lo que había puesto la
--   IA: nunca lo que escribió una persona) y se recalculan sus alertas, sin avisos. Grand Bourg 5/11 queda con Mercado
--   Pago $ 219.000 y Parque Brown 5/11 sin alertas (el posnet da $ 708.600 y los $ 853.000 de Mercado Pago tienen foto).
-- Se puede correr dos veces. Se deshace con deshacer-250 (la función vuelve a como estaba; los números que completó
-- quedan, son los de las fotos).
-- Pedido de Mauricio (5/11): "Dale, haced los arreglos" (y lo de Parque Brown: "no me tomaba los datos del posnet y
-- después me lo sumaba de más, y Mercado Pago no me leía tampoco").

create or replace function public.orden_caja_lecturas(p_caja uuid)
 returns table(tipo text, resultado jsonb, partes integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with c as (select ca.fecha, ca.local_id, ca.sis_mp from orden_cajas ca where ca.id = p_caja),
  ult as (
    select distinct on (f.tipo, f.parte) f.tipo, f.parte, f.ia_resultado as r
      from orden_caja_fotos f
     where f.caja_id = p_caja and f.ia_estado = 'ok' and f.borrada_en is null
     order by f.tipo, f.parte, f.tomada_en desc),
  buenas as (
    select u.* from ult u cross join c
     where u.r ->> 'fecha' is null or orden_fecha_segura(u.r ->> 'fecha') is not distinct from c.fecha),
  cuantas as (select b.tipo, count(*)::integer as n from buenas b group by b.tipo),
  -- (SQL 250) Lo que dice el sistema de Mercado Pago (la foto del sistema leída; si no, lo cargado) y la tolerancia.
  sis as (
    select coalesce((select orden_num(b.r ->> 'ventas_mercado_pago') from buenas b where b.tipo = 'sistema' and b.parte = 1 limit 1),
                    (select c.sis_mp from c)) as mp,
           coalesce((select o.caja_tolerancia_pesos from orden_config o join c on o.local_id = c.local_id), 100) as tol),
  -- Mercado Pago en varias fotos: si alguna muestra el total del día en la pantalla (no la suma de la lista), vale
  -- ese total, y cada monto distinto una sola vez (la misma pantalla en dos fotos no se cuenta dos veces).
  pantalla as (
    select b.tipo, sum(distinct orden_num(b.r ->> 'total')) as t
      from buenas b
     where b.tipo = 'mp' and orden_num(b.r ->> 'total') is not null and b.r ->> 'total_de_lista' is distinct from 'true'
     group by b.tipo),
  -- (SQL 242) Si no, las ventas de las listas: la misma venta (hora y monto; sin hora, el número de operación) cuenta
  -- una vez aunque esté en las dos fotos, y dos ventas iguales en una misma foto, dos (de cada una, las veces de la foto
  -- que más tiene). Sólo si todas las fotos traen su lista leída entera (las de antes del 242 no la traen).
  listas as (
    -- (coalesce: una foto sin la lista da null, y bool_and saltea los null)
    select bool_and(coalesce(jsonb_typeof(b.r -> 'operaciones') = 'array' and jsonb_array_length(b.r -> 'operaciones') > 0
                             and orden_num(b.r ->> 'suma_operaciones') is not null, false)) as todas
      from buenas b where b.tipo = 'mp'),
  ventas as (
    select b.parte, orden_num(o ->> 'monto') as monto,
           case when coalesce(o ->> 'hora', '') <> '' then 'h:' || (o ->> 'hora') || '|' || round(orden_num(o ->> 'monto'), 2)
                when coalesce(o ->> 'numero', '') <> '' then 'n:' || (o ->> 'numero') || '|' || round(orden_num(o ->> 'monto'), 2)
                else 'u:' || b.parte || ':' || x.i end as clave
      from buenas b cross join lateral jsonb_array_elements(b.r -> 'operaciones') with ordinality as x(o, i)
     where b.tipo = 'mp' and jsonb_typeof(b.r -> 'operaciones') = 'array'),
  sin_repetir as (
    select sum(v.veces * v.monto) as t
      from (select z.clave, max(z.monto) as monto, max(z.veces) as veces
              from (select w.parte, w.clave, max(w.monto) as monto, count(*) as veces from ventas w group by w.parte, w.clave) z
             group by z.clave) v),
  -- (SQL 250) El posnet en varias fotos: cada posnet (por su total) una vez aunque esté en dos fotos, y dos con el mismo
  -- total en una misma foto, dos (de cada total, las veces de la foto que más tiene). Sólo si todas las fotos traen la
  -- lista de sus posnet (las de antes del 241 no la traen: entonces se suman las fotos, como antes).
  lote_listas as (
    select bool_and(coalesce(jsonb_typeof(b.r -> 'posnets') = 'array' and jsonb_array_length(b.r -> 'posnets') > 0, false)) as todas
      from buenas b where b.tipo = 'lote'),
  posnets as (
    select b.parte, nullif(regexp_replace(lower(coalesce(p ->> 'nombre', '')), '[^a-z0-9]', '', 'g'), '') as nombre,
           orden_num(p ->> 'total') as total
      from buenas b cross join lateral jsonb_array_elements(b.r -> 'posnets') as x(p)
     where b.tipo = 'lote' and jsonb_typeof(b.r -> 'posnets') = 'array'),
  -- Un posnet sin leer en una foto que en otra foto sí se leyó (el mismo nombre): vale el de la otra.
  posnets_ok as (
    select p.* from posnets p
     where p.total is not null
        or not exists (select 1 from posnets q where q.nombre = p.nombre and q.parte <> p.parte and q.total is not null)),
  lote_sin_repetir as (
    -- Un posnet que sigue sin leer deja el posnet sin leer (bool_or de un total null).
    select case when bool_or(z.total is null) then null else sum(z.total * z.veces) end as t
      from (select y.total, max(y.veces) as veces
              from (select w.parte, w.total, count(*) as veces from posnets_ok w group by w.parte, w.total) y
             group by y.total) z),
  valor as (
    select b.tipo,
           case when b.tipo = 'mp' and q.n > 1 then coalesce(orden_num(b.r ->> 'total'), orden_num(b.r ->> 'suma_operaciones'))
                else orden_num(b.r ->> 'total') end as v,
           orden_num(b.r ->> 'suma_operaciones') as s
      from buenas b join cuantas q on q.tipo = b.tipo
     where b.tipo <> 'sistema')
  select b.tipo, b.r, 1 from buenas b where b.tipo = 'sistema' and b.parte = 1
  union all
  select x.tipo,
         jsonb_build_object('total',
           case when x.tipo = 'mp' and q.n > 1 and p.t is not null then p.t
                when x.tipo = 'mp' and q.n > 1 and coalesce((select l.todas from listas l), false) then (select s.t from sin_repetir s)
                when x.tipo = 'lote' and q.n > 1 and coalesce((select l.todas from lote_listas l), false) then (select s.t from lote_sin_repetir s)
                -- (SQL 250) Una sola foto de Mercado Pago sin el total (la lista sin «Hoy»): si lo que se ve ya da lo que
                -- dice el sistema, vale la suma de la lista.
                when x.tipo = 'mp' and q.n = 1 and bool_or(x.v is null) and max(x.s) is not null
                     and (select y.mp from sis y) > 0 and max(x.s) >= (select y.mp - y.tol from sis y) then max(x.s)
                -- (SQL 242) Una parte sin leer deja el medio sin leer: mejor que lo carguen a mano que sumar un pedazo.
                when bool_or(x.v is null) then null
                else sum(x.v) end),
         q.n
    from valor x join cuantas q on q.tipo = x.tipo left join pantalla p on p.tipo = x.tipo
   group by x.tipo, q.n, p.t
$function$;

notify pgrst, 'reload schema';

-- (datos) Las cajas de noviembre sin controlar (y con el mes sin controlar): se completan con la regla nueva y, las ya
-- guardadas, recalculan sus alertas (sin avisos: las ven en Supervisión → Cajas).
do $$
declare v record;
begin
  for v in select c.id from orden_cajas c
            where c.fecha >= date '2026-11-01' and c.estado <> 'controlada'
              and not exists (select 1 from orden_cajas_meses m
                               where m.local_id = c.local_id and m.mes = to_char(c.fecha, 'YYYY-MM') and m.estado = 'controlado')
            order by c.fecha, c.id loop
    perform orden_caja_completar_con_ia(v.id);
  end loop;
end $$;

update orden_cajas c
   set alertas = orden_caja_alertas(c.id)
 where c.estado = 'cargada' and c.fecha >= date '2026-11-01'
   and not exists (select 1 from orden_cajas_meses m
                    where m.local_id = c.local_id and m.mes = to_char(c.fecha, 'YYYY-MM') and m.estado = 'controlado')
   and orden_caja_alertas(c.id) is distinct from c.alertas;

-- Chequeo: Grand Bourg y Parque Brown del 5/11 (Mercado Pago, el posnet y las alertas).
select l.nombre as local, c.fecha, c.sis_mp, c.real_mp, c.sis_tarjeta, c.real_lote, c.alertas
  from orden_cajas c join orden_locales l on l.id = c.local_id
 where c.fecha = date '2026-11-05' and l.nombre in ('Grand Bourg', 'Parque Brown')
 order by l.nombre;
