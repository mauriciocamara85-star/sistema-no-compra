-- SQL 241 (migración 69): varias fotos por medio en la caja (4/11/2026).
-- Mauricio, con la caja de Parque Brown del 4/11 (dos posnet, Payway y Getnet, en una misma foto: la IA leyó uno y
-- quedó un desvío falso de $ 564.500 en tarjeta): "cuando detecta así dos post-nets, sumar los dos, porque ahí lo que
-- faltó fue sumar el otro post-net o la posibilidad de mandar otra foto. Mercado Pago, hay locales que venden mucho y
-- tal vez tengan que mandar dos fotos también".
--   1) orden_caja_fotos.parte: el posnet 2, la segunda foto de Mercado Pago (1 = la de siempre). Sacarla de nuevo
--      reemplaza la de esa parte; «+ Otro posnet» / «+ Otra foto» suma una parte.
--   2) orden_caja_registrar_foto con p_parte (sólo el lote y Mercado Pago, hasta 6).
--   3) orden_caja_lecturas: lo que leyó la IA de cada medio, con las partes sumadas. La usan completar_con_ia y
--      alertas (antes tomaban la última foto de cada tipo).
--   4) orden_v_cajas.fotos: la última de cada parte ("lote", "lote:2"…); con una sola parte, igual que antes.
-- Con una sola foto por medio todo da igual que antes, y la app vieja (sin p_parte) sigue andando: todo es la parte 1.
-- Las funciones salen de pg_get_functiondef de la base del 4/11 (no de las migraciones viejas). Vuelta atrás: deshacer-241.

alter table orden_caja_fotos add column if not exists parte smallint not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orden_caja_fotos_parte') then
    alter table orden_caja_fotos add constraint orden_caja_fotos_parte check (parte between 1 and 6);
  end if;
end $$;

-- 2) Registrar la foto, con su parte. La de 3 argumentos se saca: con las dos, PostgREST no sabría a cuál llamar.
drop function if exists orden_caja_registrar_foto(uuid, text, text);
create or replace function orden_caja_registrar_foto(p_caja uuid, p_tipo text, p_foto_path text, p_parte integer default 1)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare c orden_cajas; v_id uuid; v_parte integer := coalesce(p_parte, 1);
begin
  select * into c from orden_cajas where id = p_caja;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' then raise exception 'Esta caja ya fue controlada'; end if;
  if p_foto_path not like c.local_id::text || '/cajas/%' then raise exception 'Ruta de foto inválida'; end if;
  -- (SQL 241) Otra foto del mismo medio: el segundo posnet, la segunda pantalla de Mercado Pago.
  if v_parte < 1 or v_parte > 6 or (v_parte > 1 and p_tipo not in ('lote', 'mp')) then
    raise exception 'Esa foto no lleva una segunda parte';
  end if;
  insert into orden_caja_fotos (caja_id, tipo, foto_path, persona_id, parte) values (c.id, p_tipo, p_foto_path, orden_yo_id(), v_parte)
  returning id into v_id;
  return v_id;
end $function$;
revoke all on function orden_caja_registrar_foto(uuid, text, text, integer) from public, anon;
grant execute on function orden_caja_registrar_foto(uuid, text, text, integer) to authenticated, service_role;

-- 3) Lo que leyó la IA de cada medio. Valen la última foto leída bien de cada parte y del día de la caja (una de otro
--    día no carga nada: sale como alerta). El sistema es una sola foto; el posnet y Mercado Pago suman sus partes. En
--    Mercado Pago con más de una foto, si alguna muestra el total del día vale ese; si no, cada foto vale la suma de
--    las operaciones que se ven (la lista partida en dos fotos).
create or replace function orden_caja_lecturas(p_caja uuid)
 returns table (tipo text, resultado jsonb, partes integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with c as (select fecha from orden_cajas where id = p_caja),
  ult as (
    select distinct on (f.tipo, f.parte) f.tipo, f.parte, f.ia_resultado as r
      from orden_caja_fotos f
     where f.caja_id = p_caja and f.ia_estado = 'ok' and f.borrada_en is null
     order by f.tipo, f.parte, f.tomada_en desc),
  buenas as (
    select u.* from ult u cross join c
     where u.r ->> 'fecha' is null or orden_fecha_segura(u.r ->> 'fecha') is not distinct from c.fecha),
  cuantas as (select b.tipo, count(*)::integer as n from buenas b group by b.tipo),
  -- Mercado Pago en varias fotos: si alguna muestra el total del día en la pantalla (no la suma de la lista), vale
  -- ese total, y cada monto distinto una sola vez (la misma pantalla en dos fotos no se cuenta dos veces).
  pantalla as (
    select b.tipo, sum(distinct orden_num(b.r ->> 'total')) as t
      from buenas b
     where b.tipo = 'mp' and orden_num(b.r ->> 'total') is not null and b.r ->> 'total_de_lista' is distinct from 'true'
     group by b.tipo)
  select b.tipo, b.r, 1 from buenas b where b.tipo = 'sistema' and b.parte = 1
  union all
  select b.tipo,
         jsonb_build_object('total', case when b.tipo = 'mp' and q.n > 1 and p.t is not null then p.t
                                          else sum(case when b.tipo = 'mp' and q.n > 1
                                                        then coalesce(orden_num(b.r ->> 'total'), orden_num(b.r ->> 'suma_operaciones'))
                                                        else orden_num(b.r ->> 'total') end) end),
         q.n
    from buenas b join cuantas q on q.tipo = b.tipo left join pantalla p on p.tipo = b.tipo
   where b.tipo <> 'sistema'
   group by b.tipo, q.n, p.t
$function$;
revoke all on function orden_caja_lecturas(uuid) from public, anon, authenticated;
grant execute on function orden_caja_lecturas(uuid) to service_role;

-- Completar la caja con lo que leyó la IA: igual que antes, pero con orden_caja_lecturas.
CREATE OR REPLACE FUNCTION public.orden_caja_completar_con_ia(p_caja uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c orden_cajas; f record; k text; v numeric; v_set jsonb := '{}'; v_actual jsonb;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or c.estado = 'controlada' then return false; end if;
  if exists (select 1 from orden_cajas_meses where local_id = c.local_id and mes = to_char(c.fecha, 'YYYY-MM') and estado = 'controlado') then
    return false;
  end if;
  -- (SQL 134) Con la IA de la caja apagada en el local, se carga a mano.
  if not coalesce((select caja_ia from orden_config where local_id = c.local_id), true) then return false; end if;
  v_actual := to_jsonb(c);
  -- (SQL 241) Lo leído de cada medio, con las partes sumadas (dos posnet, dos fotos de Mercado Pago). Las fotos de otro
  -- día ya quedan afuera ahí (salen como alerta).
  for f in select * from orden_caja_lecturas(c.id) loop
    for k in select jsonb_object_keys(orden_caja_mapa_ia() -> f.tipo) loop
      v := orden_num(f.resultado ->> (orden_caja_mapa_ia() -> f.tipo ->> k));
      continue when v is null;
      -- Vacío, o lo había puesto la IA: se completa. Lo que escribió una persona, no.
      if (v_actual ->> k) is null or (k = any(c.ia_campos) and orden_num(v_actual ->> k) is distinct from v) then
        v_set := v_set || jsonb_build_object(k, v);
      end if;
    end loop;
  end loop;
  if v_set = '{}'::jsonb then return false; end if;
  update orden_cajas set
    sis_saldo_inicial    = case when v_set ? 'sis_saldo_inicial'    then (v_set ->> 'sis_saldo_inicial')::numeric    else sis_saldo_inicial end,
    sis_tarjeta          = case when v_set ? 'sis_tarjeta'          then (v_set ->> 'sis_tarjeta')::numeric          else sis_tarjeta end,
    sis_efectivo         = case when v_set ? 'sis_efectivo'         then (v_set ->> 'sis_efectivo')::numeric         else sis_efectivo end,
    sis_mp               = case when v_set ? 'sis_mp'               then (v_set ->> 'sis_mp')::numeric               else sis_mp end,
    sis_gocuotas         = case when v_set ? 'sis_gocuotas'         then (v_set ->> 'sis_gocuotas')::numeric         else sis_gocuotas end,
    sis_cuenta_corriente = case when v_set ? 'sis_cuenta_corriente' then (v_set ->> 'sis_cuenta_corriente')::numeric else sis_cuenta_corriente end,
    sis_deposito         = case when v_set ? 'sis_deposito'         then (v_set ->> 'sis_deposito')::numeric         else sis_deposito end,
    sis_total            = case when v_set ? 'sis_total'            then (v_set ->> 'sis_total')::numeric            else sis_total end,
    sis_gastos           = case when v_set ? 'sis_gastos'           then (v_set ->> 'sis_gastos')::numeric           else sis_gastos end,
    sis_otras_salidas    = case when v_set ? 'sis_otras_salidas'    then (v_set ->> 'sis_otras_salidas')::numeric    else sis_otras_salidas end,
    sis_descuentos       = case when v_set ? 'sis_descuentos'       then (v_set ->> 'sis_descuentos')::numeric       else sis_descuentos end,
    sis_saldo_final_efvo = case when v_set ? 'sis_saldo_final_efvo' then (v_set ->> 'sis_saldo_final_efvo')::numeric else sis_saldo_final_efvo end,
    real_lote            = case when v_set ? 'real_lote'            then (v_set ->> 'real_lote')::numeric            else real_lote end,
    real_mp              = case when v_set ? 'real_mp'              then (v_set ->> 'real_mp')::numeric              else real_mp end,
    real_gocuotas        = case when v_set ? 'real_gocuotas'        then (v_set ->> 'real_gocuotas')::numeric        else real_gocuotas end,
    -- (SQL 133) El efectivo contado, del TOTAL EFECTIVO de la foto del sistema.
    real_efectivo        = case when v_set ? 'real_efectivo'        then (v_set ->> 'real_efectivo')::numeric        else real_efectivo end,
    ia_campos            = array(select distinct x from unnest(ia_campos || array(select jsonb_object_keys(v_set))) x order by x)
  where id = c.id;
  return true;
end $function$;

-- Las alertas: igual que antes; "no coincide con la foto" compara con lo sumado de las partes, y "foto de otro día"
-- mira la última de cada parte.
CREATE OR REPLACE FUNCTION public.orden_caja_alertas(p_caja uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c orden_cajas; v_alertas jsonb := '[]'; v_tol numeric; f record; k text; v_leido numeric; v_tipeado numeric;
  par record; v_motivo text;
begin
  select * into c from orden_cajas where id = p_caja;
  if not found then return '[]'::jsonb; end if;
  v_tol := coalesce((select caja_tolerancia_pesos from orden_config where local_id = c.local_id), 100);

  -- 1) Por cada medio: si un lado tiene número y el otro está vacío, falta cargar; si están los dos, el desvío.
  for par in select * from (values
      ('Mercado Pago', c.sis_mp, c.real_mp, c.desvio_mp, 'mp'),
      ('Tarjeta', c.sis_tarjeta, c.real_lote, c.desvio_tarjeta, 'lote'),
      ('Go Cuotas', c.sis_gocuotas, c.real_gocuotas, c.desvio_gocuotas, 'gocuotas'),
      ('Efectivo', c.sis_saldo_final_efvo, c.real_efectivo, c.desvio_efectivo, null)) as t(campo, sis, rea, desvio, foto) loop
    if (par.sis is null) <> (par.rea is null) and coalesce(par.sis, par.rea) <> 0 then
      -- Por qué falta: la foto de ese lado que la IA no pudo leer (si la hay).
      select ia_resultado ->> 'motivo' into v_motivo from orden_caja_fotos
       where caja_id = c.id and borrada_en is null and ia_estado = 'invalida'
         and tipo = case when par.sis is null then 'sistema' else par.foto end
       order by tomada_en desc limit 1;
      v_alertas := v_alertas || jsonb_strip_nulls(jsonb_build_object('tipo', 'falta', 'campo', par.campo,
        'falta', case when par.sis is null then 'sistema' else 'real' end, 'motivo', left(v_motivo, 300)));
      v_motivo := null;
    elsif abs(par.desvio) > v_tol then
      v_alertas := v_alertas || jsonb_build_object('tipo', 'desvio', 'campo', par.campo, 'monto', par.desvio);
    end if;
  end loop;

  -- 2) Lo que escribieron no coincide con lo que leyó la IA en la foto (SQL 241: con las partes sumadas)
  for f in select * from orden_caja_lecturas(c.id) loop
    for k in select jsonb_object_keys(orden_caja_mapa_ia() -> f.tipo) loop
      v_leido := orden_num(f.resultado ->> (orden_caja_mapa_ia() -> f.tipo ->> k));
      v_tipeado := orden_num(to_jsonb(c) ->> k);
      if v_leido is not null and v_tipeado is not null and abs(v_leido - v_tipeado) > 1 then
        v_alertas := v_alertas || jsonb_build_object('tipo', 'no_coincide_foto', 'campo', k,
                                                     'en_foto', v_leido, 'cargado', v_tipeado);
      end if;
    end loop;
  end loop;
  -- 3) La foto es de otro día (ej. un cierre de lote viejo): la última de cada parte
  for f in select distinct on (tipo, parte) * from orden_caja_fotos
           where caja_id = c.id and ia_estado = 'ok' and borrada_en is null order by tipo, parte, tomada_en desc loop
    if orden_fecha_segura(f.ia_resultado ->> 'fecha') <> c.fecha then
      v_alertas := v_alertas || jsonb_build_object('tipo', 'foto_otro_dia', 'foto', f.tipo, 'fecha_foto', f.ia_resultado ->> 'fecha');
    end if;
  end loop;
  return v_alertas;
end $function$;

-- 4) La vista: la última foto de cada parte. La parte 1 sigue con la clave de siempre ("lote"); las otras, "lote:2".
--    El "with (security_invoker = true)" va sí o sí: create or replace view sin él se lo saca.
create or replace view orden_v_cajas with (security_invoker = true) as
SELECT c.id,
    c.local_id,
    c.fecha,
    c.sis_saldo_inicial,
    c.sis_tarjeta,
    c.sis_efectivo,
    c.sis_mp,
    c.sis_gocuotas,
    c.sis_cuenta_corriente,
    c.sis_deposito,
    c.sis_total,
    c.sis_gastos,
    c.sis_otras_salidas,
    c.sis_descuentos,
    c.sis_saldo_final_efvo,
    c.real_lote,
    c.real_mp,
    c.real_gocuotas,
    c.real_efectivo,
    c.desvio_mp,
    c.desvio_tarjeta,
    c.desvio_gocuotas,
    c.desvio_efectivo,
    c.estado,
    c.alertas,
    c.observaciones,
    c.cargada_por,
    c.cargada_en,
    c.controlada_por,
    c.controlada_en,
    c.nota_control,
    c.creado_en,
    c.historial,
    l.nombre AS local_nombre,
    to_char((c.fecha)::timestamp with time zone, 'YYYY-MM'::text) AS mes,
    (jsonb_array_length(c.alertas) > 0) AS con_alertas,
    pc.nombre AS cargada_por_nombre,
    ps.nombre AS controlada_por_nombre,
    ( SELECT jsonb_object_agg(CASE WHEN f.parte = 1 THEN f.tipo ELSE f.tipo || ':' || f.parte END, f.foto_path) AS jsonb_object_agg
           FROM ( SELECT DISTINCT ON (orden_caja_fotos.tipo, orden_caja_fotos.parte) orden_caja_fotos.tipo,
                    orden_caja_fotos.parte, orden_caja_fotos.foto_path
                   FROM orden_caja_fotos
                  WHERE ((orden_caja_fotos.caja_id = c.id) AND (orden_caja_fotos.borrada_en IS NULL))
                  ORDER BY orden_caja_fotos.tipo, orden_caja_fotos.parte, orden_caja_fotos.tomada_en DESC) f) AS fotos,
    c.ia_campos,
    c.diferencia_persona,
    c.diferencia_monto,
    pd.nombre AS diferencia_persona_nombre
   FROM ((((orden_cajas c
     JOIN orden_locales l ON ((l.id = c.local_id)))
     LEFT JOIN orden_personas pc ON ((pc.id = c.cargada_por)))
     LEFT JOIN orden_personas ps ON ((ps.id = c.controlada_por)))
     LEFT JOIN orden_personas pd ON ((pd.id = c.diferencia_persona)));

notify pgrst, 'reload schema';

-- Chequeo: tiene que decir t, t, t, t, t.
select exists (select 1 from information_schema.columns where table_name = 'orden_caja_fotos' and column_name = 'parte') as columna_parte,
       (select count(*) = 1 from pg_proc where proname = 'orden_caja_registrar_foto') as una_sola_registrar,
       has_function_privilege('authenticated', 'orden_caja_registrar_foto(uuid, text, text, integer)', 'execute') as registrar_para_usuarios,
       not has_function_privilege('anon', 'orden_caja_registrar_foto(uuid, text, text, integer)', 'execute')
         and not has_function_privilege('authenticated', 'orden_caja_lecturas(uuid)', 'execute') as cerradas_al_resto,
       (select 'security_invoker=true' = any(reloptions) from pg_class where relname = 'orden_v_cajas') as vista_con_permisos;
