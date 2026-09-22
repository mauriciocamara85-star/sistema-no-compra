-- VDH · Sistema No Compra — que el panel avise cuando algo de fondo se rompió.
--
-- Correr DESPUÉS de reloj.sql.
--
-- El panel es la única pantalla que Atención al Cliente mira todos los días.
-- Si el puente con Kommo dejó de andar —el token vence, es lo que pasa—, eso
-- tiene que decirse ahí y no en un log que no lee nadie.
--
-- El mismo criterio que tenía estadoCrm_() en Apps Script.


-- ════════════════════════════════════════════════════════════════════════
-- LAS TABLAS DE ADENTRO NO SE ASOMAN
--
-- `salidas` y `kommo_campos` no tienen ningún GRANT, así que PostgREST no
-- las toca. Se les prende RLS igual, por si algún día alguien otorga un
-- permiso sin pensarlo: dos candados en vez de uno, y ninguno cuesta nada.
-- ════════════════════════════════════════════════════════════════════════

alter table salidas      enable row level security;
alter table kommo_campos enable row level security;
-- Sin políticas: nadie entra, salvo las funciones SECURITY DEFINER de acá.


-- ════════════════════════════════════════════════════════════════════════
-- CÓMO ANDA EL PUENTE
--
-- Devuelve lo que el panel ya sabía leer:
--   activo  si hay un token puesto. Sin token no hay nada roto que avisar.
--   ok      si NO hay envíos que se rindieron en las últimas 24 horas.
--   msg     el último error, tal cual, que es lo que dice qué arreglar.
--   cuando  cuándo fue.
--
-- Se mira sólo lo de las últimas 24 horas a propósito: un fallo de hace tres
-- semanas que ya se arregló no puede dejar el cartel puesto para siempre.
-- ════════════════════════════════════════════════════════════════════════

create or replace function estado_kommo()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'activo', secreto('KOMMO_TOKEN') is not null,
    'ok',     not exists (
                select 1 from salidas
                 where destino = 'kommo' and estado = 'fallado'
                   and ultimo > now() - interval '24 hours'),
    'msg',    (select error from salidas
                where destino = 'kommo' and estado = 'fallado'
                  and ultimo > now() - interval '24 hours'
                order by ultimo desc limit 1),
    'cuando', (select to_char(ultimo at time zone 'America/Argentina/Buenos_Aires',
                              'DD/MM HH24:MI')
                 from salidas
                where destino = 'kommo' and estado = 'fallado'
                  and ultimo > now() - interval '24 hours'
                order by ultimo desc limit 1)
  )
$$;

grant execute on function estado_kommo() to authenticated;
revoke execute on function estado_kommo() from anon, public;


-- ════════════════════════════════════════════════════════════════════════
-- Y EL RESUMEN DEL PANEL LO LLEVA
--
-- Se rehace entero porque `create or replace function` no deja cambiarle la
-- forma de a pedazos. Es el mismo de panel.sql más las dos últimas líneas.
-- ════════════════════════════════════════════════════════════════════════

create or replace function resumen_panel()
returns json
language sql
stable
security invoker
set search_path = public
as $$
with
base as (
  select estado, contactado, compro, compro_canal, motivo,
         coalesce(monto, 0) as monto
  from registros
),

/* "Pendiente" no es un estado guardado: es no haber sido tocado. Es el mismo
   criterio que usa la lista, y tiene que serlo, o el número del filtro no
   coincidiría con la cantidad de fichas que abre. */
totales as (
  select count(*)                                                    as total,
         count(*) filter (where not contactado and estado is null)   as pendiente
  from base
),

por_estado as (
  select estado::text as e, count(*) as n
  from base where estado is not null group by estado
),

/* La plata va partida en LOCAL y ONLINE a propósito. Un no-compra se resuelve
   de dos maneras: que el producto llegue al local y el cliente vuelva, o que
   se lo venda la tienda online. Sumarlas esconde justamente lo que hay que
   ver, que es cuánta venta le está empujando esto al ecommerce.

   Lo que no diga "online" cuenta como local: ante un valor raro es preferible
   no inflar el número del ecommerce, que es el que estamos tratando de mover. */
plata as (
  select
    count(*) filter (where compro)                                          as c_total,
    count(*) filter (where compro and compro_canal = 'online')              as c_online,
    count(*) filter (where compro and compro_canal is distinct from 'online') as c_local,
    coalesce(sum(monto) filter (where compro), 0)                             as r_total,
    coalesce(sum(monto) filter (where compro and compro_canal = 'online'), 0) as r_online,
    coalesce(sum(monto) filter (where compro and compro_canal is distinct from 'online'), 0) as r_local
  from base
),

por_motivo as (
  select motivo::text as m, count(*) as n
  from base where motivo is not null group by motivo
)

select json_build_object(
  'status', 'ok',

  -- Total y Pendiente siempre; los estados, sólo los que tengan alguno. La
  -- pantalla ya trata como cero al que no venga.
  'conteo', (
    jsonb_build_object('Total', (select total from totales),
                       'Pendiente', (select pendiente from totales))
    || coalesce((select jsonb_object_agg(e, n) from por_estado), '{}'::jsonb)
  )::json,

  'vocab', json_build_object(
    'CONTACTAMOS', json_build_array('si', 'no'),
    'RESULTADO_1', etiquetas_de('resultado_contacto'),
    'ESTADO',      etiquetas_de('estado_seguimiento'),
    -- El único que no es un enum: en la base son DOS campos (si compró y por
    -- dónde) y en la pantalla es un solo desplegable de tres opciones. La
    -- traducción la hace el cliente; acá van los textos que él entiende.
    'COMPRO',      json_build_array('Sí - local', 'Sí - online', 'No'),
    'MOTIVO',      etiquetas_de('motivo_no_compra')
  ),

  'recuperado', (select json_build_object('local', r_local, 'online', r_online,
                                          'total', r_total) from plata),
  'compraron',  (select json_build_object('local', c_local, 'online', c_online,
                                          'total', c_total) from plata),
  'porMotivo',  coalesce((select json_object_agg(m, n) from por_motivo), '{}'::json),

  -- Sin línea de arranque: la base arrancó vacía y no hay nada viejo que tapar.
  'arranque', null,

  -- Si el puente con Kommo se rompió, el panel lo tiene que decir: es la
  -- única pantalla que Atención al Cliente mira todos los días.
  'crm', estado_kommo()
)
$$;

grant execute on function resumen_panel() to authenticated;
revoke execute on function resumen_panel() from anon, public;
