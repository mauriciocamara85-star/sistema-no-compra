-- Migración 72 (SQL 244, 5/11/2026): la caja cargada a mano queda a la vista.
--   En Equipo VDH los números de la caja se cargan solos con las fotos del cierre; escribirlos a mano sigue siendo
--   posible (la foto no se lee, la IA leyó mal, no se puede sacar), pero desde ahora:
--   1) Un número que ninguna foto leída de ese día respalda es "a mano": la alerta nueva `a_mano` (con los campos y el
--      motivo que eligieron al tocar «Editar a mano»). Con alertas la caja nunca sale «Dio bien», no se guarda sola y le
--      llega al supervisor.
--        - Lo del sistema y el efectivo contado salen de la foto del cierre del sistema: sin ninguna foto del sistema
--          leída, todo lo escrito ahí es a mano (también un 0); con alguna leída, un 0 no cuenta.
--        - El posnet, Mercado Pago y Go Cuotas, de su foto (la suma de las partes o una foto sola); un 0 no cuenta (es
--          «No hace falta»).
--        - Respaldado = alguna foto leída de ese tipo y de ese día muestra ese número (± $ 1), o la suma de sus partes.
--          Si lo escrito no coincide con lo leído, ya estaba la alerta "no coincide con la foto".
--        - Sólo si la IA de la caja está prendida en el local (Ajustes → El local → La caja).
--        - Cuando guarda el administrador o un supervisor de zona (los que controlan), la caja entera queda "vista"
--          (orden_cajas.mano_ok): nada salta «a mano». Si después la gente del local escribe un número, ése vuelve a contar.
--   2) orden_caja_guardar recibe el motivo en p_valores.motivo_mano (la firma no cambia: la app vieja sigue andando). El
--      motivo se borra cuando ya no queda nada a mano.
--   3) El aviso al supervisor dice "cargado a mano sin foto".
--   Hasta ahora «Guardar» mandaba los 8 números y la base no distinguía lo escrito de lo leído: la regla de arriba no
--   depende de eso, así que anda igual con la app vieja que todavía no se actualizó.
-- Pedido de Mauricio (5/11): "un chico antes de cargar la foto editó manualmente los números… ¿un botoncito chiquito
-- 'edición manual'?" → "dale, hagamos eso" (y que sea simple, paso a paso).

alter table public.orden_cajas add column if not exists mano_motivo text;
alter table public.orden_cajas add column if not exists mano_ok text[] not null default '{}';

-- ¿Alguna foto leída de ese tipo, de ese día, muestra ese número? (o la suma de las partes, para el posnet y MP)
create or replace function public.orden_caja_respaldado(p_caja uuid, p_campo text, p_valor numeric)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with c as (select fecha from orden_cajas where id = p_caja),
  q as (select t.key as tipo, t.value ->> p_campo as clave
          from jsonb_each(orden_caja_mapa_ia()) t
         where t.value ? p_campo)
  select p_valor is not null and (
    exists (select 1 from orden_caja_fotos f cross join c join q on q.tipo = f.tipo
             where f.caja_id = p_caja and f.borrada_en is null and f.ia_estado = 'ok'
               and (f.ia_resultado ->> 'fecha' is null or orden_fecha_segura(f.ia_resultado ->> 'fecha') is not distinct from c.fecha)
               and abs(orden_num(f.ia_resultado ->> q.clave) - p_valor) <= 1)
    or exists (select 1 from orden_caja_lecturas(p_caja) l join q on q.tipo = l.tipo
                where abs(orden_num(l.resultado ->> q.clave) - p_valor) <= 1))
$function$;
revoke all on function public.orden_caja_respaldado(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.orden_caja_respaldado(uuid, text, numeric) to service_role;

create or replace function public.orden_caja_alertas(p_caja uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c orden_cajas; v_alertas jsonb := '[]'; v_tol numeric; f record; k text; v_leido numeric; v_tipeado numeric;
  par record; v_motivo text; v_hay_sistema boolean; v_mano text[] := '{}';
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

  -- 4) (SQL 244) Lo escrito a mano: un número que ninguna foto leída de ese día respalda (con la IA de la caja prendida).
  if coalesce((select caja_ia from orden_config where local_id = c.local_id), true) then
    v_hay_sistema := exists (select 1 from orden_caja_fotos x
                              where x.caja_id = c.id and x.tipo = 'sistema' and x.ia_estado = 'ok' and x.borrada_en is null
                                and (x.ia_resultado ->> 'fecha' is null
                                     or orden_fecha_segura(x.ia_resultado ->> 'fecha') is not distinct from c.fecha));
    for par in select * from (values
        ('sis_tarjeta', true), ('sis_mp', true), ('sis_gocuotas', true), ('sis_saldo_final_efvo', true),
        ('real_lote', false), ('real_mp', false), ('real_gocuotas', false), ('real_efectivo', true)) as t(campo, del_sistema) loop
      v_tipeado := orden_num(to_jsonb(c) ->> par.campo);
      continue when v_tipeado is null or par.campo = any(coalesce(c.mano_ok, '{}'));
      -- Un 0 no cuenta, salvo lo del sistema cuando no hay ninguna foto del sistema leída.
      continue when v_tipeado = 0 and (not par.del_sistema or v_hay_sistema);
      continue when orden_caja_respaldado(c.id, par.campo, v_tipeado);
      v_mano := v_mano || par.campo;
    end loop;
    if cardinality(v_mano) > 0 then
      v_alertas := v_alertas || jsonb_strip_nulls(jsonb_build_object('tipo', 'a_mano', 'campos', to_jsonb(v_mano),
                                                                     'motivo', nullif(trim(c.mano_motivo), '')));
    end if;
  end if;
  return v_alertas;
end $function$;

create or replace function public.orden_caja_guardar(p_caja uuid, p_valores jsonb, p_observaciones text default null::text)
 returns orden_cajas
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c orden_cajas; v_alertas jsonb;
  -- (SQL 244) El administrador y el supervisor de zona controlan: lo que ellos corrigen a mano no es una alerta.
  v_controla boolean;
  v_campos text[] := array['sis_tarjeta', 'sis_mp', 'sis_gocuotas', 'sis_saldo_final_efvo', 'real_lote', 'real_mp', 'real_gocuotas', 'real_efectivo'];
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Esta caja ya fue controlada: solo el supervisor puede cambiarla';
  end if;
  -- (SQL 142) El efectivo contado es obligatorio para la gente del local, que carga el cierre
  -- entero. El supervisor y el administrador corrigen un número suelto desde la compu (también
  -- en un día sin cargar): a ellos no se les exige.
  if orden_num(p_valores ->> 'real_efectivo') is null and (p_valores ? 'real_efectivo' or c.real_efectivo is null)
     and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Falta el efectivo que contaste';
  end if;
  v_controla := orden_es_admin() or orden_supervisa(c.local_id);
  -- Si ya estaba cargada, se guarda cómo estaba antes del cambio
  if c.estado <> 'pendiente' then
    update orden_cajas set historial = historial || jsonb_build_object(
      'por', (select nombre from orden_personas where id = orden_yo_id()), 'en', now(),
      'antes', jsonb_strip_nulls(jsonb_build_object(
        'sis_tarjeta', c.sis_tarjeta, 'sis_mp', c.sis_mp, 'sis_gocuotas', c.sis_gocuotas,
        'sis_saldo_final_efvo', c.sis_saldo_final_efvo, 'real_lote', c.real_lote, 'real_mp', c.real_mp,
        'real_gocuotas', c.real_gocuotas, 'real_efectivo', c.real_efectivo)))
    where id = c.id;
  end if;

  update orden_cajas set
    sis_saldo_inicial    = coalesce(orden_num(p_valores ->> 'sis_saldo_inicial'), sis_saldo_inicial),
    sis_tarjeta          = case when p_valores ? 'sis_tarjeta' then orden_num(p_valores ->> 'sis_tarjeta') else sis_tarjeta end,
    sis_efectivo         = coalesce(orden_num(p_valores ->> 'sis_efectivo'), sis_efectivo),
    sis_mp               = case when p_valores ? 'sis_mp' then orden_num(p_valores ->> 'sis_mp') else sis_mp end,
    sis_gocuotas         = case when p_valores ? 'sis_gocuotas' then orden_num(p_valores ->> 'sis_gocuotas') else sis_gocuotas end,
    sis_cuenta_corriente = coalesce(orden_num(p_valores ->> 'sis_cuenta_corriente'), sis_cuenta_corriente),
    sis_deposito         = coalesce(orden_num(p_valores ->> 'sis_deposito'), sis_deposito),
    sis_total            = coalesce(orden_num(p_valores ->> 'sis_total'), sis_total),
    sis_gastos           = coalesce(orden_num(p_valores ->> 'sis_gastos'), sis_gastos),
    sis_otras_salidas    = coalesce(orden_num(p_valores ->> 'sis_otras_salidas'), sis_otras_salidas),
    sis_descuentos       = coalesce(orden_num(p_valores ->> 'sis_descuentos'), sis_descuentos),
    sis_saldo_final_efvo = case when p_valores ? 'sis_saldo_final_efvo' then orden_num(p_valores ->> 'sis_saldo_final_efvo') else sis_saldo_final_efvo end,
    real_lote            = case when p_valores ? 'real_lote' then orden_num(p_valores ->> 'real_lote') else real_lote end,
    real_mp              = case when p_valores ? 'real_mp' then orden_num(p_valores ->> 'real_mp') else real_mp end,
    real_gocuotas        = case when p_valores ? 'real_gocuotas' then orden_num(p_valores ->> 'real_gocuotas') else real_gocuotas end,
    real_efectivo        = case when p_valores ? 'real_efectivo' then orden_num(p_valores ->> 'real_efectivo') else real_efectivo end,
    observaciones        = coalesce(nullif(trim(p_observaciones), ''), observaciones),
    -- (SQL 122) Lo que guarda la persona es suyo: deja de ser "de la IA".
    ia_campos            = array(select x from unnest(ia_campos) x where not p_valores ? x),
    -- (SQL 244) Cuando guarda quien controla, la caja entera queda "vista" (nada salta «a mano», ni lo que no tocó);
    -- si después la gente del local escribe un número, ése vuelve a contar.
    mano_ok              = case when v_controla then v_campos
                                else array(select x from unnest(mano_ok) x where not p_valores ? x) end,
    -- (SQL 244) Por qué lo cargaron a mano (lo eligen en la app al tocar «Editar a mano»).
    mano_motivo          = coalesce(left(nullif(trim(p_valores ->> 'motivo_mano'), ''), 120), mano_motivo)
  where id = c.id;

  -- (SQL 122) Lo que quedó vacío y la IA leyó bien, se completa.
  perform orden_caja_completar_con_ia(c.id);
  v_alertas := orden_caja_alertas(c.id);

  update orden_cajas
     set alertas = v_alertas,
         -- (SQL 244) El porqué vive mientras quede algo a mano (si no, una alerta de otro día saldría con un porqué viejo).
         mano_motivo = case when v_alertas @> '[{"tipo": "a_mano"}]'::jsonb then mano_motivo end,
         estado = case when estado = 'pendiente' then 'cargada' else estado end,
         cargada_por = coalesce(cargada_por, orden_yo_id()),
         cargada_en = coalesce(cargada_en, now())
   where id = c.id returning * into c;

  perform orden_caja_avisar_alertas(c.id);
  return c;
end $function$;

create or replace function public.orden_caja_avisar_alertas(p_caja uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare c orden_cajas; v_nombre text;
begin
  select * into c from orden_cajas where id = p_caja;
  if not found or jsonb_array_length(coalesce(c.alertas, '[]')) = 0 then return; end if;
  select nombre into v_nombre from orden_locales where id = c.local_id;
  perform orden_avisar_responsables(c.local_id, 'ambos', 'caja_alerta',
    'Caja ' || v_nombre || ' ' || to_char(c.fecha, 'DD/MM') || ': revisar',
    (select string_agg(case a ->> 'tipo'
                         when 'desvio' then (a ->> 'campo') || ' $' || to_char((a ->> 'monto')::numeric, 'FM999G999G990')
                         when 'falta' then 'falta cargar ' || (a ->> 'campo')
                         when 'no_coincide_foto' then 'un monto no coincide con la foto'
                         -- (SQL 244)
                         when 'a_mano' then 'cargado a mano sin foto'
                         else 'foto de otro día' end, ' · ')
     from jsonb_array_elements(c.alertas) a),
    '/cajas', 'caja-alerta:' || c.id || ':' || md5(c.alertas::text), 2::smallint);
end $function$;

notify pgrst, 'reload schema';
