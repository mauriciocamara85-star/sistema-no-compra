-- Migración 75 (SQL 247, 5/11/2026): el cierre de caja con fecha, como BlueSoft. Es una copia de App Orden/correr-en-supabase-247.sql.
--   Pedido de Mauricio (3/11 y 5/11): en BlueSoft se pone la fecha (el 2 trae las ventas del 2), y "no tendría que dejar
--   guardar una venta que esté mal… antes de cerrar que se controle todo y, si no se encuentra la solución, que no se cierre
--   la caja, que se cierre al otro día".
--   Lo que cambia:
--     - Cada cierre es de UN día: trae sólo lo de ese día (ventas, cambios, gastos, pases a la caja fuerte, retiros).
--       El día de la caja va de las 5 de la mañana a las 5 de la mañana (una venta a las 00:30 es del día anterior).
--     - Los días en orden: si un día quedó sin cerrar, el próximo cierre es el de ese día (no se cierra el 6 con el 5
--       abierto). Lo que llega tarde de un día ya cerrado (una venta sin internet que se mandó después) entra en el
--       próximo cierre, como hasta hoy.
--     - Cada conteo queda anotado con su día. Un día que quedó abierto se cierra al otro día con lo que contaron esa noche;
--       si nadie lo contó, se cuenta ahora (si hoy todavía no se movió efectivo) o se cierra «sin contar» (queda lo que
--       tendría que haber y, si faltaba o sobraba, sale en el cierre siguiente).
--     - Lo de hoy, igual que siempre: se cuenta, se ve la cuenta y se cierra (o se deja abierta para mañana: lo hace la
--       pantalla, sin tocar la base).
--     - La Disponibilidad (Gestión → Caja) pone un cierre hecho al otro día en el momento en que se contó la caja, para
--       que el saldo de la caja chica dé bien.
--   No cambia ningún dato que ya esté: agrega la columna «dia» a los conteos (los de antes, con el día en que se
--   hicieron) y «sin_contar» y «contado_en» a los cierres. Ningún permiso cambia.
--   Se deshace con deshacer-247.sql (las funciones vuelven a como estaban; las columnas nuevas quedan, no molestan).

-- 1) Las columnas.
ALTER TABLE public.pos_caja_conteos ADD COLUMN IF NOT EXISTS dia date;
ALTER TABLE public.pos_cierres ADD COLUMN IF NOT EXISTS sin_contar boolean NOT NULL DEFAULT false;
ALTER TABLE public.pos_cierres ADD COLUMN IF NOT EXISTS contado_en timestamptz;
COMMENT ON COLUMN public.pos_caja_conteos.dia IS 'SQL 247: el día de la caja que se contó (de 5 a 5).';
COMMENT ON COLUMN public.pos_cierres.sin_contar IS 'SQL 247: un día que quedó abierto y se cerró al otro día sin poder contarlo: contado = esperado.';
COMMENT ON COLUMN public.pos_cierres.contado_en IS 'SQL 247: cuándo se contó el efectivo de este cierre (el conteo que usó).';

-- 2) El día de la caja: de 5 de la mañana a 5 de la mañana, en la hora del local.
CREATE OR REPLACE FUNCTION public.pos_caja_dia_de(p_local uuid, p_ts timestamp with time zone DEFAULT now())
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select ((p_ts at time zone l.zona_horaria) - interval '5 hours')::date from orden_locales l where l.id = p_local
$function$;

/* Hasta cuándo es un día de la caja: las 5 de la mañana del día siguiente. */
CREATE OR REPLACE FUNCTION public.pos_caja_dia_fin(p_local uuid, p_dia date)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select orden_en_hora(p_local, p_dia + 1, '05:00')
$function$;

/* Un día en palabras, para los mensajes: «jueves 5/11». */
CREATE OR REPLACE FUNCTION public.pos_dia_texto(p_dia date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from p_dia)::int + 1]
         || ' ' || extract(day from p_dia)::int || '/' || extract(month from p_dia)::int
$function$;

UPDATE public.pos_caja_conteos SET dia = pos_caja_dia_de(local_id, fecha) WHERE dia IS NULL;

-- 3) La caja de un día: lo mismo que pos_caja_abierta, pero sólo hasta el fin de ese día (p_dia null = todo lo abierto).
--    Sin ningún cierre en el local, desde lo primero que haya (antes: desde hoy, y lo de un día anterior no entraba nunca).
CREATE OR REPLACE FUNCTION public.pos_caja_dia(p_local uuid, p_prueba boolean, p_dia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u        pos_cierres;
  v_dia    date := coalesce(p_dia, orden_dia_caja(p_local));
  v_corte  timestamptz;
  v_hasta  timestamptz := case when p_dia is null then 'infinity'::timestamptz else pos_caja_dia_fin(p_local, p_dia) end;
  r        jsonb;
begin
  select * into u from pos_cierres c
   where c.local_id = p_local and c.prueba = p_prueba and c.estado = 'cerrada'
   order by c.fecha desc limit 1;
  v_corte := coalesce((select min(c.desde) from pos_cierres c
                        where c.local_id = p_local and c.prueba = p_prueba and c.estado = 'cerrada'),
                      '-infinity'::timestamptz);
  with v as (
    select x.* from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada'
       and x.fecha >= v_corte and x.fecha < v_hasta
  ), cb as (
    select x.* from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho'
       and x.fecha >= v_corte and x.fecha < v_hasta
  ), g as (
    select z.medio, sum(z.monto) monto from (
      select pg.medio, pg.monto from pos_venta_pagos pg join v on v.id = pg.venta_id
      union all
      select pc.medio, pc.monto from pos_cambio_pagos pc join cb on cb.id = pc.cambio_id) z
     group by z.medio
  ), m as (
    select x.* from pos_caja_movimientos x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'ok'
       and coalesce(x.caja, 'chica') = 'chica' and x.fecha < v_hasta
  )
  select jsonb_build_object(
    'dia', v_dia,
    'desde', coalesce(u.fecha, orden_en_hora(p_local, v_dia, '00:00')),
    'primer', u.id is null,
    'ultimo', case when u.id is null then null
                   else jsonb_build_object('id', u.id, 'numero', u.numero, 'fecha', u.fecha, 'queda', u.queda, 'dia', u.dia) end,
    'saldo_inicial', u.queda,
    'tickets', (select count(*) from v),
    'ventas', jsonb_build_object(
      'efectivo',      coalesce((select g.monto from g where g.medio = 'efectivo'), 0),
      'tarjeta',       coalesce((select g.monto from g where g.medio = 'tarjeta'), 0),
      'mercadopago',   coalesce((select g.monto from g where g.medio = 'mercadopago'), 0),
      'modo',          coalesce((select g.monto from g where g.medio = 'modo'), 0),
      'go_cuotas',     coalesce((select g.monto from g where g.medio = 'go_cuotas'), 0),
      'transferencia', coalesce((select g.monto from g where g.medio = 'transferencia'), 0),
      'giftcard',      coalesce((select g.monto from g where g.medio = 'giftcard'), 0)),
    'ventas_total', coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    'descuentos', coalesce((select sum(v.descuentos) from v), 0),
    'cambios', (select count(*) from cb),
    'cambios_diferencia', coalesce((select sum(cb.diferencia) from cb), 0),
    'gastos', coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    'otras_salidas', coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    'otros_ingresos', coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    'a_caja_fuerte', coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),
    'retiros_fondos', coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0),
    'conteos', (select count(*) from pos_caja_conteos k
                 where k.local_id = p_local and k.prueba = p_prueba and k.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
                   and (p_dia is null or k.dia = p_dia)),
    'tolerancia', coalesce((select o.caja_tolerancia_pesos from orden_config o where o.local_id = p_local), 100)
  ) into r;
  return r;
end $function$;

-- 4) Qué día se cierra ahora: el más viejo que tenga algo abierto (nunca antes del último cierre ni después de hoy);
--    si no hay nada abierto, hoy.
CREATE OR REPLACE FUNCTION public.pos_caja_a_cerrar(p_local uuid, p_prueba boolean)
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy    date := pos_caja_dia_de(p_local);
  v_ult    date;
  v_corte  timestamptz;
  v_min    timestamptz;
begin
  select max(c.dia), min(c.desde) into v_ult, v_corte from pos_cierres c
   where c.local_id = p_local and c.prueba = p_prueba and c.estado = 'cerrada';
  v_corte := coalesce(v_corte, '-infinity'::timestamptz);
  select min(t.f) into v_min from (
    select min(x.fecha) f from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada' and x.fecha >= v_corte
    union all
    select min(x.fecha) from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho' and x.fecha >= v_corte
    union all
    select min(x.fecha) from pos_caja_movimientos x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'ok'
       and coalesce(x.caja, 'chica') = 'chica') t;
  if v_min is null then return v_hoy; end if;
  return least(v_hoy, greatest(pos_caja_dia_de(p_local, v_min), coalesce(v_ult, '-infinity'::date)));
end $function$;

-- 5) Lo primero que movió efectivo de la caja chica entre dos momentos (una venta o un cambio con efectivo, un gasto,
--    un pase a la caja fuerte, un retiro), en palabras: «la venta B-7». Null si no hubo nada.
CREATE OR REPLACE FUNCTION public.pos_caja_efectivo_entre(p_local uuid, p_prueba boolean, p_desde timestamp with time zone, p_hasta timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.que from (
    select x.fecha, 'la venta ' || case when x.prueba then 'P-' else x.letra || '-' end || x.numero que
      from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada'
       and x.fecha > p_desde and x.fecha < p_hasta
       and exists (select 1 from pos_venta_pagos g where g.venta_id = x.id and g.medio = 'efectivo')
    union all
    select x.fecha, 'el cambio C-' || x.numero
      from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho'
       and x.fecha > p_desde and x.fecha < p_hasta
       and exists (select 1 from pos_cambio_pagos g where g.cambio_id = x.id and g.medio = 'efectivo')
    union all
    select m.fecha, case m.tipo when 'gasto' then 'el gasto ' when 'salida' then 'la salida ' when 'ingreso' then 'el ingreso '
                                when 'caja_fuerte' then 'el pase a la caja fuerte ' else 'el retiro ' end
                    || case m.tipo when 'caja_fuerte' then 'MS' when 'retiro' then 'RF' else 'G' end
                    || case when m.prueba then 'P-' else '-' end || m.numero
      from pos_caja_movimientos m
     where m.local_id = p_local and m.prueba = p_prueba and m.cierre_id is null and m.estado = 'ok'
       and coalesce(m.caja, 'chica') = 'chica' and m.fecha > p_desde and m.fecha < p_hasta
  ) t order by t.fecha limit 1
$function$;

-- 6) El detalle de cada renglón (SQL 246), ahora también de un día. Cambia la firma: se borra la de antes.
DROP FUNCTION IF EXISTS public.pos_caja_detalle(uuid, boolean, uuid);
CREATE OR REPLACE FUNCTION public.pos_caja_detalle(p_local uuid, p_prueba boolean, p_cierre uuid DEFAULT NULL::uuid, p_dia date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c        pos_cierres;
  v_corte  timestamptz;
  v_hasta  timestamptz;
  v_ventas uuid[];
  v_cambios uuid[];
begin
  if p_cierre is not null then
    select * into c from pos_cierres where id = p_cierre;
    if not found or c.estado <> 'cerrada' then return null; end if;
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.cierre_id = c.id and (x.estado = 'cobrada' or x.anulada_en > c.fecha);
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.cierre_id = c.id and (x.estado = 'hecho' or x.anulado_en > c.fecha);
  else
    /* La misma regla que pos_caja_dia (SQL 247): desde el primer cierre del local, hasta el fin del día que se cierra. */
    v_corte := coalesce((select min(x.desde) from pos_cierres x
                          where x.local_id = p_local and x.prueba = p_prueba and x.estado = 'cerrada'),
                        '-infinity'::timestamptz);
    v_hasta := case when p_dia is null then 'infinity'::timestamptz else pos_caja_dia_fin(p_local, p_dia) end;
    select coalesce(array_agg(x.id), '{}') into v_ventas from pos_ventas x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'cobrada'
       and x.fecha >= v_corte and x.fecha < v_hasta;
    select coalesce(array_agg(x.id), '{}') into v_cambios from pos_cambios x
     where x.local_id = p_local and x.prueba = p_prueba and x.cierre_id is null and x.estado = 'hecho'
       and x.fecha >= v_corte and x.fecha < v_hasta;
  end if;
  return jsonb_build_object(
    'ventas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'letra', x.letra, 'numero', x.numero, 'serie', x.serie, 'prueba', x.prueba, 'fecha', x.fecha,
               'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
               'total', x.total, 'descuentos', x.descuentos, 'anulada', x.estado <> 'cobrada',
               'pagos', coalesce((
                 select jsonb_agg(jsonb_build_object('medio', g.medio, 'monto', g.monto, 'tarjeta', g.tarjeta, 'tipo_tarjeta', g.tipo_tarjeta,
                                                     'cuotas', g.cuotas, 'cupon', g.cupon, 'ultimos4', g.ultimos4,
                                                     'recibido', g.recibido, 'vuelto', g.vuelto) order by g.orden)
                   from pos_venta_pagos g where g.venta_id = x.id), '[]'::jsonb)) order by x.fecha, x.numero)
        from pos_ventas x where x.id = any(v_ventas)), '[]'::jsonb),
    'cambios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'numero', x.numero, 'prueba', x.prueba, 'fecha', x.fecha,
               'vendedor', x.vendedor, 'cliente', coalesce(x.cliente_nombre, 'Consumidor final'),
               'diferencia', x.diferencia, 'anulado', x.estado <> 'hecho',
               'pagos', coalesce((
                 select jsonb_agg(jsonb_build_object('medio', g.medio, 'monto', g.monto, 'tarjeta', g.tarjeta, 'tipo_tarjeta', g.tipo_tarjeta,
                                                     'cuotas', g.cuotas, 'cupon', g.cupon, 'ultimos4', g.ultimos4,
                                                     'recibido', g.recibido, 'vuelto', g.vuelto) order by g.orden)
                   from pos_cambio_pagos g where g.cambio_id = x.id), '[]'::jsonb)) order by x.fecha, x.numero)
        from pos_cambios x where x.id = any(v_cambios)), '[]'::jsonb));
end $function$;

-- 7) La caja que se cierra (POS → Cierre de caja): la del día que toca, con lo que hace falta para cerrarla.
--    Además de lo de siempre: 'hoy', 'pendiente' (es un día anterior), 'esperado' (lo que tendría que haber, si se sabe
--    el saldo inicial), 'en_caja' (lo que tendría que haber en el cajón con todo lo abierto, para los pases y los retiros),
--    'conteo' (lo que contaron ese día, si todavía sirve), 'conteo_viejo' (si contaron pero después entró o salió efectivo
--    de ese día), 'efectivo_despues' (lo primero de hoy que movió efectivo: con eso ya no se puede contar el día anterior)
--    y 'dias_despues' / 'tickets_despues' (lo que queda abierto después).
CREATE OR REPLACE FUNCTION public.pos_caja(p_local uuid, p_prueba boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a          jsonb;
  t          jsonb;
  v_prueba   boolean := coalesce(p_prueba, false);
  v_hoy      date;
  v_dia      date;
  v_hasta    timestamptz;
  v_corte    timestamptz;
  u          pos_cierres;
  k          pos_caja_conteos;
  v_valido   boolean := false;
  v_por      text;
  v_saldo    numeric;
  v_esp      numeric;
  v_en_caja  numeric;
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(p_local);
  if p_local is null or not exists (select 1 from orden_locales where id = p_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  v_hoy := pos_caja_dia_de(p_local);
  v_dia := pos_caja_a_cerrar(p_local, v_prueba);
  v_hasta := pos_caja_dia_fin(p_local, v_dia);
  a := pos_caja_dia(p_local, v_prueba, v_dia);
  select * into u from pos_cierres c
   where c.local_id = p_local and c.prueba = v_prueba and c.estado = 'cerrada'
   order by c.fecha desc limit 1;
  v_corte := coalesce((select min(c.desde) from pos_cierres c
                        where c.local_id = p_local and c.prueba = v_prueba and c.estado = 'cerrada'), '-infinity'::timestamptz);
  if v_dia < v_hoy then
    /* Lo que contaron ese día sirve si después no entró ni salió efectivo de ese día. */
    select * into k from pos_caja_conteos x
     where x.local_id = p_local and x.prueba = v_prueba and x.dia = v_dia and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
     order by x.fecha desc, x.id desc limit 1;
    if k.id is not null then
      v_por := pos_caja_efectivo_entre(p_local, v_prueba, k.fecha, v_hasta);
      v_valido := v_por is null;
    end if;
  end if;
  v_saldo := case when u.id is not null then u.queda when v_valido then k.saldo_inicial end;
  v_esp := v_saldo + (a->'ventas'->>'efectivo')::numeric + (a->>'otros_ingresos')::numeric
         - (a->>'gastos')::numeric - (a->>'otras_salidas')::numeric - (a->>'a_caja_fuerte')::numeric
         - (a->>'retiros_fondos')::numeric;
  if v_dia < v_hoy then
    t := pos_caja_dia(p_local, v_prueba, null);
    v_en_caja := u.queda + (t->'ventas'->>'efectivo')::numeric + (t->>'otros_ingresos')::numeric
               - (t->>'gastos')::numeric - (t->>'otras_salidas')::numeric - (t->>'a_caja_fuerte')::numeric
               - (t->>'retiros_fondos')::numeric;
  else
    v_en_caja := v_esp;
  end if;
  return a || jsonb_build_object(
    'numero', (select coalesce(max(c.numero), 0) + 1 from pos_cierres c where c.local_id = p_local and c.prueba = v_prueba),
    'responsable', (select p.nombre from orden_personas p where p.id = orden_yo_id()),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'rubro', m.rubro,
                                          'descripcion', m.descripcion, 'monto', m.monto, 'persona', m.persona_nombre,
                                          'numero', m.numero,   -- SQL 179
                                          'retira', m.retira) order by m.fecha)   -- SQL 191
        from pos_caja_movimientos m
       where m.local_id = p_local and m.prueba = v_prueba and m.cierre_id is null and m.estado = 'ok'
         and coalesce(m.caja, 'chica') = 'chica'   -- SQL 191: sin los retiros de la caja fuerte
         and m.fecha < v_hasta), '[]'::jsonb),   -- SQL 247: los de ese día
    'detalle', pos_caja_detalle(p_local, v_prueba, null, v_dia),   -- SQL 246 (y 247: de ese día)
    'hoy', v_hoy,
    'pendiente', v_dia < v_hoy,
    'esperado', v_esp,
    'en_caja', v_en_caja,
    'conteo', case when v_valido then jsonb_build_object(
                'contado', k.contado, 'esperado', k.esperado, 'saldo_inicial', k.saldo_inicial, 'fecha', k.fecha,
                'persona', (select pe.nombre from orden_personas pe where pe.id = k.persona)) end,
    'conteo_viejo', case when k.id is not null and not v_valido then jsonb_build_object('fecha', k.fecha, 'contado', k.contado, 'por', v_por) end,
    'efectivo_despues', case when v_dia < v_hoy then pos_caja_efectivo_entre(p_local, v_prueba, v_hasta, 'infinity'::timestamptz) end,
    'dias_despues', case when v_dia < v_hoy then (
      select coalesce(jsonb_agg(z.d order by z.d), '[]'::jsonb) from (
        select distinct pos_caja_dia_de(p_local, w.fecha) d from (
          select x.fecha from pos_ventas x
           where x.local_id = p_local and x.prueba = v_prueba and x.cierre_id is null and x.estado = 'cobrada' and x.fecha >= v_hasta
          union all
          select x.fecha from pos_cambios x
           where x.local_id = p_local and x.prueba = v_prueba and x.cierre_id is null and x.estado = 'hecho' and x.fecha >= v_hasta
          union all
          select x.fecha from pos_caja_movimientos x
           where x.local_id = p_local and x.prueba = v_prueba and x.cierre_id is null and x.estado = 'ok'
             and coalesce(x.caja, 'chica') = 'chica' and x.fecha >= v_hasta) w) z) end,
    'tickets_despues', case when v_dia < v_hoy then (
      select count(*) from pos_ventas x
       where x.local_id = p_local and x.prueba = v_prueba and x.cierre_id is null and x.estado = 'cobrada'
         and x.fecha >= v_hasta and x.fecha >= v_corte) end);
end $function$;

-- 8) Contar la caja: el conteo queda anotado con el día que se cierra. Un día anterior se puede contar sólo si hoy todavía
--    no se movió efectivo (si no, la plata del cajón ya no es la de ese día).
CREATE OR REPLACE FUNCTION public.pos_caja_contar(p_local uuid, p_prueba boolean, p_contado numeric, p_saldo_inicial numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a         jsonb;
  v_prueba  boolean := coalesce(p_prueba, false);
  v_cont    numeric := round(p_contado, 2);
  v_saldo   numeric;
  v_esp     numeric;
  v_hoy     date;
  v_dia     date;
  v_por     text;
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(p_local);
  if p_local is null or not exists (select 1 from orden_locales where id = p_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_cont is null or v_cont < 0 or v_cont >= 1000000000 then raise exception 'Escribí cuánto efectivo hay en el local.'; end if;
  v_hoy := pos_caja_dia_de(p_local);
  v_dia := pos_caja_a_cerrar(p_local, v_prueba);   -- SQL 247
  if v_dia < v_hoy then
    v_por := pos_caja_efectivo_entre(p_local, v_prueba, pos_caja_dia_fin(p_local, v_dia), 'infinity'::timestamptz);
    if v_por is not null then
      raise exception 'La caja del % ya no se puede contar: hoy ya se movió efectivo (%). Se cierra con lo que contaron ese día o, si nadie la contó, sin contar.',
        pos_dia_texto(v_dia), v_por;
    end if;
  end if;
  a := pos_caja_dia(p_local, v_prueba, v_dia);
  if (a->>'primer')::boolean then
    v_saldo := round(coalesce(p_saldo_inicial, 0), 2);
    if v_saldo < 0 or v_saldo >= 1000000000 then raise exception 'El saldo inicial no es válido.'; end if;
  else
    v_saldo := (a->>'saldo_inicial')::numeric;
  end if;
  v_esp := v_saldo + (a->'ventas'->>'efectivo')::numeric + (a->>'otros_ingresos')::numeric
         - (a->>'gastos')::numeric - (a->>'otras_salidas')::numeric - (a->>'a_caja_fuerte')::numeric   -- SQL 180
         - (a->>'retiros_fondos')::numeric;   -- SQL 191
  insert into pos_caja_conteos (local_id, prueba, persona, saldo_inicial, contado, esperado, dia)
  values (p_local, v_prueba, orden_yo_id(), v_saldo, v_cont, v_esp, v_dia);
  return a || jsonb_build_object('saldo_inicial', v_saldo, 'esperado', v_esp, 'contado', v_cont,
                                 'desvio', v_esp - v_cont, 'conteos', (a->>'conteos')::int + 1,
                                 'hoy', v_hoy, 'pendiente', v_dia < v_hoy);
end $function$;

-- 9) Cerrar la caja: el cierre es del día que toca y se lleva sólo lo de ese día (y lo que llegó tarde de días ya
--    cerrados). Hoy: como siempre (contar, ver la cuenta, cerrar; si algo cambió después de contar, contar de nuevo).
--    Un día anterior: con lo que contaron (aunque después corrigieran algo de ese día) o, si nadie lo contó y ya no se
--    puede contar, «sin contar» (p->>'sin_contar' = true). La pantalla manda p->>'dia' para no cerrar otro día sin querer.
CREATE OR REPLACE FUNCTION public.pos_caja_cerrar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local    uuid := nullif(p->>'local_id', '')::uuid;
  v_prueba   boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_cont     numeric := round(nullif(p->>'contado', '')::numeric, 2);
  v_retiro   numeric := round(coalesce(nullif(p->>'retiro', '')::numeric, 0), 2);
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_obs      text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_sin      boolean := coalesce(nullif(p->>'sin_contar', '')::boolean, false);   -- SQL 247
  v_pide     date := nullif(p->>'dia', '')::date;   -- SQL 247
  v_ini      numeric := round(nullif(p->>'saldo_inicial', '')::numeric, 2);   -- SQL 247: el primer cierre, sin contar
  u          pos_cierres;
  c          pos_cierres;
  k          pos_caja_conteos;
  v_hoy      date;
  v_dia      date;
  v_hasta    timestamptz;
  v_corte    timestamptz;
  v_id       uuid;
  v_num      int;
  v_n        int;
  v_primero  numeric;
begin
  perform pos_permiso('caja');   -- SQL 190
  perform pos_local_ok(v_local);

  if v_clave is not null then
    select * into c from pos_cierres where clave = v_clave;
    if found then
      return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                                'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'dia', c.dia, 'sin_contar', c.sin_contar, 'ya', true);
    end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  if v_sin then
    if v_retiro <> 0 then raise exception 'Sin contar no se pasa nada a la caja fuerte.'; end if;
    v_cont := null;
  else
    if v_cont is null or v_cont < 0 then raise exception 'Falta el efectivo que contaste (Paso 1).'; end if;
    if v_retiro < 0 then raise exception 'Lo que pasa a la caja fuerte no puede ser negativo.'; end if;
    if v_retiro > v_cont then
      raise exception 'No se puede pasar a la caja fuerte más de lo que hay ($%).', to_char(v_cont, 'FM999G999G990D00');
    end if;
  end if;
  if length(v_obs) > 500 then raise exception 'Las observaciones son demasiado largas.'; end if;

  /* Un cierre por vez en cada caja: si dos la cierran al mismo tiempo, el segundo espera y frena abajo. */
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || v_local::text || ':' || v_prueba::text));

  v_hoy := pos_caja_dia_de(v_local);
  v_dia := pos_caja_a_cerrar(v_local, v_prueba);
  if v_pide is not null and v_pide <> v_dia then
    raise exception 'Ahora toca cerrar el %, no el %: tocá «Actualizar» (arriba a la derecha).', pos_dia_texto(v_dia), pos_dia_texto(v_pide);
  end if;
  v_hasta := pos_caja_dia_fin(v_local, v_dia);

  select * into u from pos_cierres x
   where x.local_id = v_local and x.prueba = v_prueba and x.estado = 'cerrada'
   order by x.fecha desc limit 1;
  select * into k from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.dia = v_dia and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
   order by x.fecha desc, x.id desc limit 1;
  if v_dia >= v_hoy then
    /* Hoy: como siempre. */
    if v_sin then raise exception 'La caja de hoy se cuenta: escribí el efectivo y tocá «Ver la cuenta» (Paso 1).'; end if;
    if k.id is null then raise exception 'Primero contá el efectivo y tocá «Ver la cuenta» (Paso 1).'; end if;
    if k.contado <> v_cont then raise exception 'El efectivo no es el que contaste: tocá «Ver la cuenta» de nuevo.'; end if;
  else
    /* Un día anterior. Si después de contar entró o salió efectivo de ese día, ese conteo ya no sirve. */
    if k.id is not null and pos_caja_efectivo_entre(v_local, v_prueba, k.fecha, v_hasta) is not null then
      k := null;
    end if;
    if k.id is not null then
      if v_sin then raise exception 'Ese día ya se contó: tocá «Actualizar» para cerrarlo con lo que contaron.'; end if;
      if k.contado <> v_cont then raise exception 'El efectivo no es el que contaron: tocá «Actualizar».'; end if;
    else
      if not v_sin then raise exception 'Ese día no tiene un conteo que sirva: tocá «Actualizar».'; end if;
      /* El primer cierre de la sucursal no tiene un cierre anterior: el saldo inicial lo escriben. */
      if u.id is null and (v_ini is null or v_ini < 0 or v_ini >= 1000000000) then
        raise exception 'Escribí el saldo inicial (con cuánto efectivo arrancó la caja).';
      end if;
    end if;
  end if;
  select count(*) into v_n from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.dia = v_dia and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz);
  select x.contado into v_primero from pos_caja_conteos x
   where x.local_id = v_local and x.prueba = v_prueba and x.dia = v_dia and x.fecha > coalesce(u.fecha, '-infinity'::timestamptz)
   order by x.fecha, x.id limit 1;

  v_corte := coalesce((select min(x.desde) from pos_cierres x
                        where x.local_id = v_local and x.prueba = v_prueba and x.estado = 'cerrada'),
                      '-infinity'::timestamptz);
  select coalesce(max(x.numero), 0) + 1 into v_num from pos_cierres x where x.local_id = v_local and x.prueba = v_prueba;

  insert into pos_cierres (local_id, numero, prueba, dia, desde, responsable, responsable_nombre, saldo_inicial,
                           contado, retiro, conteos, primer_conteo, observaciones, clave, sin_contar, contado_en)
  values (v_local, v_num, v_prueba, v_dia, coalesce(u.fecha, orden_en_hora(v_local, v_dia, '00:00')), orden_yo_id(),
          (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()),
          case when u.id is null then coalesce(k.saldo_inicial, v_ini) else u.queda end,
          coalesce(v_cont, 0), v_retiro, v_n, v_primero, v_obs, v_clave, v_sin, k.fecha)
  returning id into v_id;

  /* Lo que entra en este cierre: todo lo que no tenía hasta el fin de ese día (también lo anulado, que no suma). */
  update pos_ventas set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null and fecha >= v_corte and fecha < v_hasta;
  update pos_caja_movimientos set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null
     and coalesce(caja, 'chica') = 'chica'   -- SQL 191: el retiro de la caja fuerte no es de esta caja
     and fecha < v_hasta;
  update pos_cambios set cierre_id = v_id
   where local_id = v_local and prueba = v_prueba and cierre_id is null and fecha >= v_corte and fecha < v_hasta;

  with v as (select * from pos_ventas where cierre_id = v_id and estado = 'cobrada'),
       cb as (select * from pos_cambios where cierre_id = v_id and estado = 'hecho'),
       g as (select z.medio, sum(z.monto) monto from (
               select pg.medio, pg.monto from pos_venta_pagos pg join v on v.id = pg.venta_id
               union all
               select pc.medio, pc.monto from pos_cambio_pagos pc join cb on cb.id = pc.cambio_id) z
              group by z.medio),
       m as (select * from pos_caja_movimientos where cierre_id = v_id and estado = 'ok')
  update pos_cierres set
    tickets              = (select count(*) from v),
    ventas_efectivo      = coalesce((select g.monto from g where g.medio = 'efectivo'), 0),
    ventas_tarjeta       = coalesce((select g.monto from g where g.medio = 'tarjeta'), 0),
    ventas_mercadopago   = coalesce((select g.monto from g where g.medio = 'mercadopago'), 0),
    ventas_modo          = coalesce((select g.monto from g where g.medio = 'modo'), 0),
    ventas_go_cuotas     = coalesce((select g.monto from g where g.medio = 'go_cuotas'), 0),
    ventas_transferencia = coalesce((select g.monto from g where g.medio = 'transferencia'), 0),
    ventas_giftcard      = coalesce((select g.monto from g where g.medio = 'giftcard'), 0),   -- SQL 200
    ventas_total         = coalesce((select sum(v.total) from v), 0) + coalesce((select sum(cb.diferencia) from cb), 0),
    descuentos           = coalesce((select sum(v.descuentos) from v), 0),
    cambios              = (select count(*) from cb),
    cambios_diferencia   = coalesce((select sum(cb.diferencia) from cb), 0),
    gastos               = coalesce((select sum(m.monto) from m where m.tipo = 'gasto'), 0),
    otras_salidas        = coalesce((select sum(m.monto) from m where m.tipo = 'salida'), 0),
    otros_ingresos       = coalesce((select sum(m.monto) from m where m.tipo = 'ingreso'), 0),
    a_caja_fuerte        = coalesce((select sum(m.monto) from m where m.tipo = 'caja_fuerte'), 0),   -- SQL 180
    retiros_fondos       = coalesce((select sum(m.monto) from m where m.tipo = 'retiro'), 0)   -- SQL 191
  where id = v_id;
  update pos_cierres set esperado = saldo_inicial + ventas_efectivo + otros_ingresos - gastos - otras_salidas - a_caja_fuerte
                                  - retiros_fondos   -- SQL 191
   where id = v_id
  returning * into c;
  /* SQL 247: sin contar, queda lo que tendría que haber. */
  if v_sin then
    if c.esperado < 0 then
      raise exception 'Lo que tendría que haber da negativo ($%): así no se puede cerrar sin contar.', to_char(c.esperado, 'FM999G999G990D00');
    end if;
    update pos_cierres set contado = esperado where id = v_id returning * into c;
  end if;
  /* SQL 180: hoy, lo que tendría que haber es lo mismo que cuando contaron; si no, algo entró o salió en el medio. */
  if v_dia >= v_hoy and c.esperado <> k.esperado then
    raise exception 'La caja cambió después de contar (una venta en efectivo, un gasto, un pase a la caja fuerte o un retiro): contá de nuevo y tocá «Ver la cuenta».';
  end if;

  return jsonb_build_object('id', c.id, 'numero', c.numero, 'prueba', c.prueba, 'esperado', c.esperado, 'contado', c.contado,
                            'desvio', c.desvio, 'retiro', c.retiro, 'queda', c.queda, 'dia', c.dia, 'sin_contar', c.sin_contar, 'ya', false);
end $function$;

-- 10) La Disponibilidad: un cierre hecho al otro día cuenta en el momento en que se contó la caja (o, sin contar, al fin
--     de su día), así lo que se vendió hoy antes de cerrar el día anterior no se pierde del saldo. Lo demás, igual.
CREATE OR REPLACE FUNCTION public.pos_caja_momento(p_local uuid, p_dia date, p_fecha timestamp with time zone, p_contado_en timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case when p_dia < pos_caja_dia_de(p_local, p_fecha) then coalesce(p_contado_en, pos_caja_dia_fin(p_local, p_dia)) else p_fecha end
$function$;

CREATE OR REPLACE FUNCTION public.pos_caja_eventos(p_local uuid, p_caja text)
 RETURNS TABLE(fecha timestamp with time zone, orden integer, dia date, tipo text, ref text, detalle text, persona text, importe numeric, control numeric, ref_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_primero  pos_cierres;
  v_corte    timestamptz;
begin
  if p_caja = 'chica' then
    select * into v_primero from pos_cierres c
     where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' order by c.fecha limit 1;
    /* Las ventas cuentan desde el primer cierre, como en pos_caja_abierta (las de antes del POS no entran nunca). */
    v_corte := coalesce((select min(c.desde) from pos_cierres c where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'),
                        orden_en_hora(p_local, orden_dia_caja(p_local), '00:00'));
    if v_primero.id is not null then
      /* El saldo inicial del primer cierre, antes que todo (orden 0 gana los empates): un gasto cargado antes de ese día
         también entró en él. */
      return query select least(v_primero.desde, coalesce((select min(m.fecha) from pos_caja_movimientos m
                                                             where m.local_id = p_local and not m.prueba and coalesce(m.caja, 'chica') = 'chica'),
                                                          v_primero.desde)),
                          0, v_primero.dia, 'inicial'::text, 'Saldo inicial'::text,
                          ('Con lo que arrancó la caja en el cierre Nº ' || v_primero.numero)::text, v_primero.responsable_nombre,
                          null::numeric, v_primero.saldo_inicial, v_primero.id;
    end if;
    return query
      select x.fecha, 1, x.dia, 'venta'::text, case when x.letra = 'X' then 'X-' || x.numero else 'Nº ' || x.numero end,
             ('Venta · ' || x.vendedor)::text, null::text, sum(pg.monto), null::numeric, x.id
        from pos_ventas x join pos_venta_pagos pg on pg.venta_id = x.id and pg.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'cobrada' and x.fecha >= v_corte
       group by x.id
      union all
      select x.fecha, 1, x.dia, 'cambio'::text, 'C-' || x.numero, ('Cambio · ' || x.vendedor)::text, null::text, sum(pc.monto), null::numeric, x.id
        from pos_cambios x join pos_cambio_pagos pc on pc.cambio_id = x.id and pc.medio = 'efectivo'
       where x.local_id = p_local and not x.prueba and x.estado = 'hecho' and x.fecha >= v_corte
       group by x.id
      union all
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' when 'retiro' then 'RF-' else 'G-' end || m.numero,
             case m.tipo when 'gasto' then 'Gasto · ' || coalesce(m.rubro, '')
                         when 'salida' then 'Otra salida' when 'ingreso' then 'Otro ingreso'
                         when 'caja_fuerte' then 'A la caja fuerte'
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end
               || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'ingreso' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok' and coalesce(m.caja, 'chica') = 'chica'
      union all
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 2, c.dia, 'cierre'::text, 'Cierre Nº ' || c.numero,
             (case when c.sin_contar then 'Cierre de caja, sin contar' else 'Cierre de caja' end)::text,   -- SQL 247
             c.responsable_nombre, null::numeric, c.contado, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada'
      union all
      /* Hasta el SQL 180, lo de la caja fuerte se pasaba al cerrar. */
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'A la caja fuerte, al cerrar'::text,
             c.responsable_nombre, -c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0;
  elsif p_caja = 'fuerte' then
    return query
      select m.fecha, 1, m.dia, m.tipo,
             case m.tipo when 'caja_fuerte' then 'MS-' else 'RF-' end || m.numero,
             case m.tipo when 'caja_fuerte' then 'De la caja chica'
                         else 'Retiro de fondos' || coalesce(' · lo retiró ' || m.retira, '') end || coalesce(' · ' || m.descripcion, ''),
             m.persona_nombre, case when m.tipo = 'caja_fuerte' then m.monto else -m.monto end, null::numeric, m.id
        from pos_caja_movimientos m
       where m.local_id = p_local and not m.prueba and m.estado = 'ok'
         and (m.tipo = 'caja_fuerte' or (m.tipo = 'retiro' and m.caja = 'fuerte'))
      union all
      select pos_caja_momento(c.local_id, c.dia, c.fecha, c.contado_en), 3, c.dia, 'pase'::text, 'Cierre Nº ' || c.numero, 'De la caja chica, al cerrar'::text,
             c.responsable_nombre, c.retiro, null::numeric, c.id
        from pos_cierres c
       where c.local_id = p_local and not c.prueba and c.estado = 'cerrada' and c.retiro > 0
      union all
      select a.fecha, 2, a.dia, 'ajuste'::text, 'Ajuste Nº ' || a.numero, ('Ajuste' || coalesce(' · ' || a.observaciones, ''))::text,
             a.persona_nombre, null::numeric, a.contado, a.id
        from pos_caja_ajustes a
       where a.local_id = p_local and a.caja = 'fuerte' and a.estado = 'ok';
  else
    raise exception 'La caja tiene que ser la chica o la fuerte.';
  end if;
end $function$;

-- 11) Los ayudantes nuevos no se llaman desde afuera: sólo desde las funciones del POS (que ya controlan el permiso y el local).
REVOKE ALL ON FUNCTION public.pos_caja_dia_de(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_dia_fin(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_dia_texto(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_dia(uuid, boolean, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_a_cerrar(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_efectivo_entre(uuid, boolean, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_detalle(uuid, boolean, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_caja_momento(uuid, date, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
