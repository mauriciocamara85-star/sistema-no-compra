-- Migración 79 (SQL 251, 6/11/2026): la misma venta de Mercado Pago en dos fotos, aunque la IA lea distinto la hora, el
-- número o el monto; y el posnet en dos fotos, a centavos.
--
-- Lo encontró el árbitro (rondas 1 y 2, 6/11):
-- 1) Mercado Pago en dos fotos: la misma venta se reconoce por la hora y el monto (SQL 242), y la IA a veces lee la hora
--    distinta en dos fotos de la misma pantalla. En Parque Brown, el 5/11, la misma venta (operación 188001606784,
--    $ 97.500) salió «19:15» en una foto y «19:16» en otra: con las dos fotos como partes 1 y 2 daba $ 950.500 en vez de
--    $ 853.000. Y con el SQL 250 la app pide justo esa segunda foto cuando la lista no alcanza: una venta contada dos
--    veces puede tapar un faltante y la caja se guardaba sola con «Dio bien».
--    Ahora, si la venta tiene número de operación, vale la hora de la primera foto donde sale ese número y el monto menor
--    con que sale; después se junta como antes, por la hora y el monto. Así no la cuenta dos veces ni la hora mal leída,
--    ni un dígito del número mal leído (Unicenter 1/11: 186243283807 y 188243283807), ni el monto mal leído (Unicenter
--    1/11: $ 65.000 y $ 85.000). Si se equivoca, cuenta de menos (se ve el faltante y se pide otra foto), nunca de más.
-- 2) El posnet en dos fotos sigue juntándose por el total (no por el nombre: la IA a veces lo lee mal, Grand Bourg 2/11
--    «Sistema POS», y contaría dos veces el mismo ticket), ahora a centavos, como en la app.
-- La misma regla está en impecable-comun.js (ventasSinRepetir, posnetsSinRepetir): la app muestra lo que guarda la base.
--
-- Al final (datos): las cajas de noviembre sin controlar se completan con la regla nueva y las ya guardadas recalculan
-- sus alertas, como en el SQL 250.
-- Se puede correr dos veces. Se deshace con deshacer-251 (vuelve la función del SQL 250).
-- Pedido de Mauricio (6/11): "lo del árbitro me parece bien, lanzalo y ya queda todo bien"; y a la ronda 2, "dale".

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
  -- (SQL 242) Si no, las ventas de las listas: la misma venta cuenta una vez aunque esté en las dos fotos, y dos ventas
  -- iguales en una misma foto, dos (de cada una, las veces de la foto que más tiene). Sólo si todas las fotos traen su
  -- lista leída entera (las de antes del 242 no la traen).
  listas as (
    -- (coalesce: una foto sin la lista da null, y bool_and saltea los null)
    select bool_and(coalesce(jsonb_typeof(b.r -> 'operaciones') = 'array' and jsonb_array_length(b.r -> 'operaciones') > 0
                             and orden_num(b.r ->> 'suma_operaciones') is not null, false)) as todas
      from buenas b where b.tipo = 'mp'),
  ventas0 as (
    select b.parte, x.i, orden_num(o ->> 'monto') as monto,
           nullif(o ->> 'hora', '') as hora,
           nullif(regexp_replace(coalesce(o ->> 'numero', ''), '[^0-9]', '', 'g'), '') as numero
      from buenas b cross join lateral jsonb_array_elements(b.r -> 'operaciones') with ordinality as x(o, i)
     where b.tipo = 'mp' and jsonb_typeof(b.r -> 'operaciones') = 'array'),
  -- (SQL 251) Con número de operación: la hora de la primera foto donde sale ese número (con hora) y el monto menor con
  -- que sale. Así la hora, un dígito del número o el monto mal leídos en una foto no cuentan dos veces la misma venta.
  por_numero as (
    select v.numero,
           (select w.hora from ventas0 w where w.numero = v.numero and w.hora is not null order by w.parte, w.i limit 1) as hora,
           min(v.monto) as monto
      from ventas0 v where v.numero is not null group by v.numero),
  ventas as (
    select v.parte, coalesce(n.monto, v.monto) as monto,
           case when coalesce(n.hora, v.hora) is not null
                  then 'h:' || coalesce(n.hora, v.hora) || '|' || coalesce(round(coalesce(n.monto, v.monto), 2), 0.00)::text
                when v.numero is not null then 'n:' || v.numero || '|' || coalesce(round(coalesce(n.monto, v.monto), 2), 0.00)::text
                else 'u:' || v.parte || ':' || v.i end as clave
      from ventas0 v left join por_numero n on n.numero = v.numero),
  sin_repetir as (
    -- Sin ningún monto leído, queda sin leer.
    select case when count(v.monto) = 0 then null else round(sum(v.veces * v.monto), 2) end as t
      from (select z.clave, min(z.monto) as monto, max(z.veces) as veces
              from (select w.parte, w.clave, min(w.monto) as monto, count(*) as veces from ventas w group by w.parte, w.clave) z
             group by z.clave) v),
  -- (SQL 250) El posnet en varias fotos: cada posnet una vez aunque esté en dos fotos, y dos iguales en una misma foto,
  -- dos (de cada uno, las veces de la foto que más tiene). Sólo si todas las fotos traen la lista de sus posnet (las de
  -- antes del 241 no la traen: entonces se suman las fotos, como antes).
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
  -- (SQL 251) Por el total a centavos, como la app (sólo por el total, no por el nombre: la IA a veces lo lee mal).
  lote_sin_repetir as (
    -- Un posnet que sigue sin leer deja el posnet sin leer (bool_or de un total null).
    select case when bool_or(z.total is null) then null else round(sum(z.total * z.veces), 2) end as t
      from (select y.total, max(y.veces) as veces
              from (select w.parte, round(w.total, 2) as total, count(*) as veces from posnets_ok w group by w.parte, round(w.total, 2)) y
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

-- Chequeo: Grand Bourg y Parque Brown del 5/11 (Mercado Pago, el posnet y las alertas): tienen que seguir igual.
select l.nombre as local, c.fecha, c.sis_mp, c.real_mp, c.sis_tarjeta, c.real_lote, c.alertas
  from orden_cajas c join orden_locales l on l.id = c.local_id
 where c.fecha = date '2026-11-05' and l.nombre in ('Grand Bourg', 'Parque Brown')
 order by l.nombre;
