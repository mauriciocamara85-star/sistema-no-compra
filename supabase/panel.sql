-- VDH · Sistema No Compra — el panel de seguimiento.
--
-- Correr DESPUÉS de estadisticas.sql.
--
-- Esta es la ÚNICA pantalla que ve datos de clientes: nombres, teléfonos y
-- mails. Por eso es la única que pide identificarse, y por eso todo lo de
-- acá se otorga a `authenticated` y a nadie más.
--
-- ── Lo que NO hace falta ──────────────────────────────────────────────────
-- La lista de registros no necesita una función: quien entró puede leer y
-- escribir `registros` directamente, con sus políticas puestas. Acá está sólo
-- lo que una consulta sola no da: los conteos de los filtros, los totales del
-- tablero, y el vocabulario.


-- ════════════════════════════════════════════════════════════════════════
-- EL VOCABULARIO SALE DE LOS PROPIOS TIPOS
--
-- Antes era una constante en el backend (VOCAB) que había que mantener igual
-- que la validación de datos de la planilla. Cuando se desfasaban, la
-- pantalla ofrecía una opción que el servidor después rechazaba.
--
-- Acá los desplegables se arman con las etiquetas del enum, que es lo mismo
-- que la base acepta al escribir. No se pueden desfasar: son el mismo dato.
-- ════════════════════════════════════════════════════════════════════════

create or replace function etiquetas_de(tipo text)
returns json
language sql
stable
as $$
  select coalesce(json_agg(e.enumlabel::text order by e.enumsortorder), '[]'::json)
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = tipo
$$;


-- ════════════════════════════════════════════════════════════════════════
-- EL RESUMEN DEL PANEL
--
-- Los números de arriba, cuántos hay en cada filtro y el vocabulario, en un
-- solo viaje.
--
-- SECURITY INVOKER a propósito, al revés que los resúmenes públicos: acá NO
-- hay que saltearse las políticas. Quien la llama tiene que poder leer
-- `registros` por sus propios medios, y si no puede, no hay resumen.
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
  'arranque', null

  -- `crm` y `respaldo` todavía no están: los va a contestar la Edge Function
  -- del puente con Kommo cuando exista. La pantalla ya sabe esconder el aviso
  -- cuando no vienen, así que no hay nada que tocar de este lado ese día.
)
$$;


-- ════════════════════════════════════════════════════════════════════════
-- QUIÉN PUEDE
--
-- Sólo quien entró. `etiquetas_de` se otorga también a anon porque no lee
-- ningún dato —son los nombres de los tipos, que están en el código de la
-- app igual— y alguna pantalla pública puede querer armar un selector.
-- ════════════════════════════════════════════════════════════════════════

grant execute on function etiquetas_de(text)  to anon, authenticated;
grant execute on function resumen_panel()     to authenticated;

-- Y que NO se pueda llamar sin entrar, aunque alguien lo intente a mano.
revoke execute on function resumen_panel() from anon, public;
