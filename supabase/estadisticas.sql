-- VDH · Sistema No Compra — las dos pantallas que se miran sin identificarse.
--
-- Correr DESPUÉS de funciones.sql.
--
-- ── Por qué son funciones y no vistas ─────────────────────────────────────
-- Las vistas del esquema (v_motivos, v_resultados) cuentan bien, pero cada
-- pantalla necesita CINCO cosas distintas de la misma porción de registros:
-- el ranking, lo que faltó adentro del motivo elegido, el detalle por local,
-- los totales y la lista de locales del selector. Con vistas eso son cinco
-- viajes que tienen que coincidir entre sí.
--
-- Acá es uno, y devuelve exactamente el objeto que la pantalla ya sabía leer
-- cuando esto lo contestaba Apps Script. Por eso el HTML no cambia.
--
-- ── Y siguen sin dejar leer un registro ───────────────────────────────────
-- Son SECURITY DEFINER, así que ven la tabla, pero **sólo devuelven cuentas**:
-- ni un nombre, ni un teléfono, ni una fila. Es lo que permite que Motivos y
-- Resultados se abran sin pedir nada, que fue la decisión de diseño: una
-- estadística que hay que desbloquear no la mira nadie.


-- ════════════════════════════════════════════════════════════════════════
-- LOCALES · los catorce
--
-- Hasta ahora esta lista vivía en dos lados a la vez (LOCALES en la pantalla
-- de carga y LOCALES_BASE en el backend) y había que acordarse de tocar los
-- dos. Acá es una tabla: abrir un local nuevo es un INSERT.
--
-- La pantalla de Carga conserva la suya igual, a propósito: tiene que poder
-- mostrar el selector la primera vez que se abre la app, sin señal, antes de
-- que haya nada que consultar.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists locales (
  codigo text primary key,
  nombre text not null,
  activo boolean not null default true
);

insert into locales (codigo, nombre) values
  ('CASEROS',            'Caseros'),
  ('DOT',                'DOT'),
  ('FLORES',             'Flores'),
  ('GRAND BOURG',        'Grand Bourg'),
  ('ITUZAINGÓ',          'Ituzaingó'),
  ('LOMAS DE ZAMORA',    'Lomas de Zamora'),
  ('MAR DEL PLATA',      'Mar del Plata'),
  ('MORÓN',              'Morón'),
  ('PACHECO',            'Pacheco'),
  ('PARQUE BROWN',       'Parque Brown'),
  ('SAN JUSTO',          'San Justo'),
  ('SAN JUSTO SHOPPING', 'San Justo Shopping'),
  ('UNICENTER',          'Unicenter'),
  ('VILLA DEL PARQUE',   'Villa del Parque')
on conflict (codigo) do nothing;

alter table locales enable row level security;

-- Saber qué locales hay no es un dato de nadie: es el selector de la pantalla.
-- El drop es para poder volver a correr este archivo entero sin que explote.
drop policy if exists locales_lee_cualquiera on locales;
create policy locales_lee_cualquiera on locales for select to anon, authenticated using (true);

-- Y el permiso de tabla, que es otra cosa: sin esto PostgREST contesta 401
-- aunque la política diga que sí. Son dos puertas y hay que abrir las dos.
grant select on locales to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- MOTIVOS · por qué se va la gente
--
-- @param p_local   vacío = toda la cadena
-- @param p_motivo  vacío = todos; si viene, filtra productos y talles
--
-- El ranking de motivos se calcula SIEMPRE sobre el local entero, aunque
-- venga un motivo filtrado: es la lista desde la que se elige, y si se
-- filtrara a sí misma quedaría una sola fila y no habría cómo volver.
-- ════════════════════════════════════════════════════════════════════════

create or replace function resumen_motivos(p_local text default '', p_motivo text default '')
returns json
language sql
stable
security definer
set search_path = public
as $$
with
-- La porción que se está mirando. Un local vacío es toda la cadena.
porcion as (
  select id, sucursal, motivo::text as motivo, producto, talle
  from registros
  where coalesce(nullif(trim(p_local), ''), '') = ''
     or lower(trim(sucursal)) = lower(trim(p_local))
),

/* Sin motivo no se descarta en silencio: se cuenta aparte y la pantalla lo
   dice. Un porcentaje calculado sobre la mitad de los registros, sin avisar
   de qué mitad, es peor que no tener el número. */
totales as (
  select count(*) filter (where motivo is not null) as total,
         count(*) filter (where motivo is null)     as sin_motivo
  from porcion
),

con as (select * from porcion where motivo is not null),

ranking as (
  select motivo as v,
         count(*) as n,
         case when (select total from totales) > 0
              then round(count(*) * 100.0 / (select total from totales))
              else 0 end as pct
  from con
  group by motivo
),

-- Cada local con su motivo más repetido. Al empatar gana el alfabético, para
-- que la lista no se mueva sola entre dos consultas iguales.
por_local as (
  select c.sucursal as local,
         count(*) as n,
         (select c2.motivo
            from con c2
           where lower(trim(c2.sucursal)) = lower(trim(c.sucursal))
           group by c2.motivo
           order by count(*) desc, c2.motivo
           limit 1) as top
  from con c
  group by c.sucursal
),

-- De acá para abajo, sólo lo del motivo que se está mirando.
filtrado as (
  select * from con
  where coalesce(nullif(trim(p_motivo), ''), '') = ''
     or lower(trim(motivo)) = lower(trim(p_motivo))
),

/* Se agrupa por el nombre en minúsculas: "campera negra" y "Campera Negra"
   son el mismo producto, y contarlos separados haría que ninguno de los dos
   llegue al top.

   Son DOS desempates distintos y conviene no confundirlos:

     · qué grafía se MUESTRA  → la más repetida, y al empatar la más vieja.
       Elegir la alfabética sonaba más simple, pero deja el informe escrito
       en minúscula cada vez que alguien tipeó el producto apurado una vez.

     · en qué orden va la LISTA → de más a menos, y al empatar alfabético,
       para que no se mueva sola entre dos consultas iguales. */
grafias as (
  select lower(trim(producto)) as k, trim(producto) as v,
         count(*) as n, min(id) as primero
  from filtrado
  where nullif(trim(producto), '') is not null
  group by lower(trim(producto)), trim(producto)
),
prods as (
  select v, n, row_number() over (order by n desc, v) as pos
  from (
    select (array_agg(v order by n desc, primero))[1] as v, sum(n) as n
    from grafias group by k
  ) g
  order by n desc, v
  limit 12
),

/* Los talles se cargan juntos: "42 / 44", o "s, m". Se parten en uno por fila
   antes de contarlos, o el talle que más faltó quedaría escondido adentro de
   una combinación. Lo de más de 12 caracteres no es un talle: es una
   observación que entró en el campo equivocado. */
talles_sueltos as (
  select trim(t) as t, f.id
  from filtrado f, regexp_split_to_table(coalesce(f.talle, ''), '\s*,\s*|\s+/\s+') as t
  where nullif(trim(t), '') is not null and length(trim(t)) <= 12
),

-- Misma regla que los productos: "L" y "l" son el mismo talle, y se muestra
-- como lo escribió el que lo cargó primero.
talles_grafias as (
  select lower(t) as k, t as v, count(*) as n, min(id) as primero
  from talles_sueltos
  group by lower(t), t
),

tall as (
  select v, n, row_number() over (order by n desc, v) as pos
  from (
    select (array_agg(v order by n desc, primero))[1] as v, sum(n) as n
    from talles_grafias group by k
  ) g
  order by n desc, v
  limit 12
),

/* El selector ofrece los catorce aunque todavía no hayan cargado nada: con la
   base recién arrancada no hay un solo registro, y un selector vacío parecería
   roto. Y suma los que aparezcan en los datos sin estar en la tabla, para que
   un local que cerró no se lleve sus registros de la vista. */
locales_lista as (
  select min(l) as l
  from (
    select codigo as l from locales where activo
    union all
    select distinct trim(sucursal) from registros where nullif(trim(sucursal), '') is not null
  ) x
  group by lower(l)
)

select json_build_object(
  'status',    'ok',
  'local',     coalesce(p_local, ''),
  'motivo',    coalesce(p_motivo, ''),
  -- La versión de Sheets tapaba los registros viejos con una "línea de
  -- arranque". Acá no hay nada viejo que tapar, y la pantalla ya sabe no
  -- decir nada cuando esto viene vacío.
  'arranque',  null,
  'total',     (select total from totales),
  'sinMotivo', (select sin_motivo from totales),
  'motivos',   (select coalesce(json_agg(json_build_object('v', v, 'n', n, 'pct', pct)
                                         order by n desc, v), '[]'::json) from ranking),
  'productos', (select coalesce(json_agg(json_build_object('v', v, 'n', n)
                                         order by pos), '[]'::json) from prods),
  'talles',    (select coalesce(json_agg(json_build_object('v', v, 'n', n)
                                         order by pos), '[]'::json) from tall),
  'porLocal',  (select coalesce(json_agg(json_build_object('local', local, 'n', n, 'top', top)
                                         order by n desc, local), '[]'::json) from por_local),
  'locales',   (select coalesce(json_agg(l order by l), '[]'::json) from locales_lista)
)
$$;


-- ════════════════════════════════════════════════════════════════════════
-- RESULTADOS · el embudo
--
-- Cuántos se cargaron, a cuántos alguien trabajó, cuántos volvieron a
-- comprar y cuánta plata entró por eso.
--
-- "Contactado" es lo mismo que NO estar pendiente: alguien le puso un estado
-- o marcó que lo contactó. Da igual cómo haya terminado; lo que se mide acá
-- es si alguien lo trabajó.
-- ════════════════════════════════════════════════════════════════════════

create or replace function resumen_resultados(p_local text default '')
returns json
language sql
stable
security definer
set search_path = public
as $$
with
porcion as (
  select sucursal, creado, contactado, estado, compro, compro_canal,
         coalesce(monto, 0) as monto
  from registros
  where coalesce(nullif(trim(p_local), ''), '') = ''
     or lower(trim(sucursal)) = lower(trim(p_local))
),

trabajados as (
  select *, (contactado or estado is not null) as atendido from porcion
),

totales as (
  select count(*)                            as cargados,
         count(*) filter (where atendido)    as contactados,
         count(*) filter (where compro)      as compraron
  from trabajados
),

recuperado as (
  select coalesce(sum(monto) filter (where compro), 0)                             as total,
         -- Lo que no diga "online" cuenta como local, igual que en el panel.
         coalesce(sum(monto) filter (where compro and compro_canal = 'online'), 0) as online,
         coalesce(sum(monto) filter (where compro and compro_canal is distinct from 'online'), 0) as local
  from trabajados
),

/* Los que nadie tocó todavía, y hace cuánto. El "más viejo" es el número que
   dice qué tan atrás viene el seguimiento: un pendiente de ayer es trabajo
   normal, uno de hace tres semanas es un cliente perdido. */
pend as (
  select count(*) as total,
         -- Tres días es el umbral que ya usaba el backend viejo (DIAS_VIEJO).
         count(*) filter (where creado <= now() - interval '3 days') as viejos,
         coalesce(max(floor(extract(epoch from now() - creado) / 86400))::int, 0) as dias
  from trabajados
  where not atendido
),

/* Ordenados por lo que volvió y después por cuántos cargaron: el local que
   más recuperó primero, que es el que está haciendo funcionar esto. */
por_local as (
  select sucursal as local,
         count(*)                                       as cargados,
         count(*) filter (where atendido)               as contactados,
         count(*) filter (where compro)                 as compraron,
         coalesce(sum(monto) filter (where compro), 0)  as recuperado
  from trabajados
  where nullif(trim(sucursal), '') is not null
  group by sucursal
),

locales_lista as (
  select min(l) as l
  from (
    select codigo as l from locales where activo
    union all
    select distinct trim(sucursal) from registros where nullif(trim(sucursal), '') is not null
  ) x
  group by lower(l)
)

select json_build_object(
  'status',     'ok',
  'local',      coalesce(p_local, ''),
  'arranque',   null,
  'total',      (select json_build_object('cargados', cargados, 'contactados', contactados,
                                          'compraron', compraron) from totales),
  'recuperado', (select json_build_object('total', total, 'local', local, 'online', online)
                   from recuperado),
  'pendientes', (select json_build_object('total', total, 'viejos', viejos, 'dias', dias) from pend),
  'porLocal',   (select coalesce(json_agg(json_build_object(
                          'local', local, 'cargados', cargados, 'contactados', contactados,
                          'compraron', compraron, 'recuperado', recuperado)
                        order by recuperado desc, cargados desc, local), '[]'::json) from por_local),
  'locales',    (select coalesce(json_agg(l order by l), '[]'::json) from locales_lista)
)
$$;


grant execute on function resumen_motivos(text, text)  to anon, authenticated;
grant execute on function resumen_resultados(text)     to anon, authenticated;
