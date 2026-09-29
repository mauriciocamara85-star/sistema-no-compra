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


-- ─────────────────────────── ESTADÍSTICAS (correr-en-supabase-30, 29/09/2026) ───────────────────────────
-- Reemplaza a Motivos y Resultados en la pantalla. Las dos funciones de arriba
-- quedan: no molestan y una página vieja guardada en un celular las sigue usando.

-- ══════════════════════════════════════════════════════════════════════════
-- VDH No Compra · ESTADÍSTICAS
--
-- Correr entero en el editor SQL de Supabase, después del 29.
--
-- Pedido de Mauricio (29/09/2026): que las estadísticas del No Compra se
-- armen como las del Club. Hasta acá Motivos y Resultados contaban todo
-- "desde siempre", sin período ni comparación, así que no se podía
-- contestar "¿este mes recuperamos más que el anterior?".
--
-- Una sola función, nc_estadisticas, con período, local y motivo:
--
--   · Cuentan los registros CARGADOS en el período, cada uno con lo que
--     pasó después (si se lo contactó, si compró, cuánto). Es la misma
--     regla que Resultados: "contactado" = se lo marcó como contactado o
--     tiene un estado de seguimiento.
--   · El período anterior del mismo largo, para comparar. Ojo al leerlo:
--     los cargados hace poco tuvieron menos tiempo para volver.
--   · Los 14 locales más "Sin local" suman el total.
--   · "Pendientes" es HOY, no depende del período: los que nadie tocó.
--
-- No pide PIN, igual que Motivos y Resultados: son números sin datos de
-- clientes (el único nombre que aparece es el del vendedor).
-- ══════════════════════════════════════════════════════════════════════════


/* Si un registro entra en el filtro de local. '__SIN__' es "Sin local":
   vacío, o un nombre que no es ninguno de los 14. */
create or replace function nc_est_local_ok(p_suc text, p_filtro text)
returns boolean
language sql
stable
security definer
set search_path = public
as $lo$
  select case
    when p_filtro is null then true
    when p_filtro = '__SIN__' then
      nullif(trim(coalesce(p_suc, '')), '') is null
      or not exists (select 1 from locales l where l.activo and lower(trim(l.codigo)) = lower(trim(p_suc)))
    else lower(trim(coalesce(p_suc, ''))) = lower(p_filtro)
  end
$lo$;

revoke all on function nc_est_local_ok(text, text) from public, anon, authenticated;


/* Los números de arriba para un rango y un local: se piden para el
   período, el anterior y cada local. */
create or replace function nc_est_resumen(t0 timestamptz, t1 timestamptz, loc text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $er$
  with r as (
    select *, (contactado or estado is not null) as atendido
      from registros
     where creado >= t0 and creado < t1 and nc_est_local_ok(sucursal, loc)
  )
  select jsonb_build_object(
    'cargados',    count(*),
    'contactados', count(*) filter (where atendido),
    'compraron',   count(*) filter (where compro),
    'recuperado',  coalesce(sum(monto) filter (where compro), 0),
    'rec_local',   coalesce(sum(monto) filter (where compro and compro_canal is distinct from 'online'), 0),
    'rec_online',  coalesce(sum(monto) filter (where compro and compro_canal = 'online'), 0),
    'sin_motivo',  count(*) filter (where motivo is null),
    /* Días entre la carga y el primer contacto, de los que tienen fecha
       de contacto. Menos es mejor. */
    'dias_contacto', round(avg(greatest(0, contacto1_fecha - (creado at time zone 'America/Argentina/Buenos_Aires')::date))
                            filter (where contacto1_fecha is not null), 1),
    'contacto_casos', count(*) filter (where contacto1_fecha is not null))
    from r
$er$;

revoke all on function nc_est_resumen(timestamptz, timestamptz, text) from public, anon, authenticated;


create or replace function nc_estadisticas(
  p_desde date default null, p_hasta date default null,
  p_local text default null, p_motivo text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $ne$
declare
  tz  constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone tz)::date;
  d0  date := coalesce(p_desde, hoy - 29);
  d1  date := coalesce(p_hasta, hoy);
  aux date;
  dias integer;
  loc text := nullif(trim(coalesce(p_local, '')), '');
  motsel text := nullif(trim(coalesce(p_motivo, '')), '');
  t0 timestamptz; t1 timestamptz; a0 timestamptz;
  escala text;
  r jsonb;
begin
  if d1 < d0 then aux := d0; d0 := d1; d1 := aux; end if;
  if d1 - d0 > 1100 then d0 := d1 - 1100; end if;
  dias := d1 - d0 + 1;
  t0 := d0::timestamp at time zone tz;
  t1 := (d1 + 1)::timestamp at time zone tz;
  a0 := (d0 - dias)::timestamp at time zone tz;
  escala := case when dias <= 92 then 'day' when dias <= 400 then 'week' else 'month' end;

  with
  per as (
    select *, (contactado or estado is not null) as atendido,
           (creado at time zone tz) as local_ts, motivo::text as mot
      from registros
     where creado >= t0 and creado < t1 and nc_est_local_ok(sucursal, loc)
  ),
  /* Lo de "Qué faltó" mira sólo el motivo elegido, si hay uno. */
  falto as (select * from per where mot is not null and (motsel is null or lower(mot) = lower(motsel))),
  grafias as (
    select lower(trim(producto)) as k, trim(producto) as v, count(*) as n, min(id) as primero
      from falto
     where nullif(trim(producto), '') is not null
     group by 1, 2
  ),
  prods as (
    select (array_agg(v order by n desc, primero))[1] as v, sum(n)::int as n from grafias group by k
  ),
  talles_sueltos as (
    select trim(t) as t, f.id
      from falto f, regexp_split_to_table(coalesce(f.talle, ''), '\s*,\s*|\s+/\s+') as t
     where nullif(trim(t), '') is not null and length(trim(t)) <= 12
  ),
  talles as (
    select (array_agg(t order by n desc, primero))[1] as v, sum(n)::int as n
      from (select lower(t) as k, t, count(*) as n, min(id) as primero from talles_sueltos group by 1, 2) x
     group by k
  ),
  colores as (
    select (array_agg(v order by n desc, primero))[1] as v, sum(n)::int as n
      from (select lower(trim(color)) as k, trim(color) as v, count(*) as n, min(id) as primero
              from falto where nullif(trim(color), '') is not null group by 1, 2) x
     group by k
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', dias,
                                  'antes_desde', d0 - dias, 'antes_hasta', d0 - 1,
                                  'local', loc, 'motivo', motsel, 'escala', escala),
    'actual',   nc_est_resumen(t0, t1, loc),
    'anterior', nc_est_resumen(a0, t0, loc),

    /* Hoy, no en el período: los que nadie tocó todavía. Tres días es el
       umbral de "viejo" que ya usaba Resultados. */
    'pendientes', (
      select jsonb_build_object(
        'total', count(*),
        'viejos', count(*) filter (where creado <= now() - interval '3 days'),
        'dias', coalesce(max(floor(extract(epoch from now() - creado) / 86400))::int, 0))
        from registros
       where not (contactado or estado is not null)
         and coalesce(estado::text, '') not like 'Cerrado%' and estado is distinct from 'Descartado'
         and nc_est_local_ok(sucursal, loc)),

    'motivos', (
      select coalesce(jsonb_agg(jsonb_build_object('v', x.mot, 'n', x.n,
                                  'pct', round(x.n * 100.0 / nullif(x.tot, 0)),
                                  'compraron', x.c)
                                order by x.n desc, x.mot), '[]'::jsonb)
        from (select mot, count(*) as n, count(*) filter (where compro) as c,
                     sum(count(*)) over () as tot
                from per where mot is not null group by mot) x),

    'productos', (select coalesce(jsonb_agg(jsonb_build_object('v', v, 'n', n) order by n desc, v), '[]'::jsonb)
                    from (select * from prods order by n desc, v limit 12) z),
    'talles',    (select coalesce(jsonb_agg(jsonb_build_object('v', v, 'n', n) order by n desc, v), '[]'::jsonb)
                    from (select * from talles order by n desc, v limit 12) z),
    'colores',   (select coalesce(jsonb_agg(jsonb_build_object('v', v, 'n', n) order by n desc, v), '[]'::jsonb)
                    from (select * from colores order by n desc, v limit 8) z),

    /* Los 14, siempre todos, con su motivo más repetido. */
    'por_local', (
      select coalesce(jsonb_agg(
               nc_est_resumen(t0, t1, l.codigo) ||
               jsonb_build_object('local', l.codigo,
                                  'nombre', coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))),
                                  'top', (select p.mot from per p
                                           where lower(trim(p.sucursal)) = lower(trim(l.codigo)) and p.mot is not null
                                           group by p.mot order by count(*) desc, p.mot limit 1))
               order by l.codigo), '[]'::jsonb)
        from locales l where l.activo),
    'sin_local', nc_est_resumen(t0, t1, '__SIN__') ||
                 jsonb_build_object('local', '__SIN__', 'nombre', 'Sin local'),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('f', s.f, 'cargados', coalesce(x.n, 0),
                                                   'compraron', coalesce(x.c, 0)) order by s.f), '[]'::jsonb)
        from (select distinct date_trunc(escala, g)::date as f
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g) s
        left join (select date_trunc(escala, local_ts)::date as f, count(*) as n, count(*) filter (where compro) as c
                     from per group by 1) x on x.f = s.f),

    'por_semana', (
      select jsonb_agg(jsonb_build_object('d', w.d, 'veces', w.veces, 'cargados', coalesce(x.n, 0)) order by w.d)
        from (select extract(isodow from g)::int as d, count(*) as veces
                from generate_series(d0::timestamp, d1::timestamp, interval '1 day') g group by 1) w
        left join (select extract(isodow from local_ts)::int as d, count(*) as n from per group by 1) x on x.d = w.d),

    'por_hora', (
      select jsonb_agg(jsonb_build_object('h', h.h, 'cargados', coalesce(x.n, 0)) order by h.h)
        from generate_series(0, 23) h(h)
        left join (select extract(hour from local_ts)::int as h, count(*) as n from per group by 1) x on x.h = h.h),

    /* Quién carga y a quién le vuelven. Lo que compró se le cuenta al que
       lo cargó: es el que lo anotó bien para que se lo pudiera llamar. */
    'vendedores', (
      select coalesce(jsonb_agg(v order by (v->>'cargados')::int desc, v->>'vendedor'), '[]'::jsonb)
        from (select jsonb_build_object(
                       'vendedor', trim(vendedor),
                       'cargados', count(*),
                       'contactados', count(*) filter (where atendido),
                       'compraron', count(*) filter (where compro),
                       'recuperado', coalesce(sum(monto) filter (where compro), 0),
                       'con_producto', count(*) filter (where nullif(trim(producto), '') is not null)) as v
                from per
               where nullif(trim(vendedor), '') is not null
               group by trim(vendedor)
               order by count(*) desc
               limit 30) z)
  )
  into r;

  return r;
end;
$ne$;

revoke all on function nc_estadisticas(date, date, text, text) from public;
grant execute on function nc_estadisticas(date, date, text, text) to anon, authenticated;


select (nc_estadisticas()->'actual'->>'cargados') as "Cargados en los últimos 30 días";
