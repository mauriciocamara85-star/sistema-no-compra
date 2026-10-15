-- ═══ SQL 122 (14/10/2026) · Cajas: lo que la IA lee de las fotos del cierre pasa solo a la caja ═══
-- Va después del 121. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Los números que la IA lee bien (cierre del sistema, lote, Mercado Pago, Go Cuotas) se cargan solos en los
--     campos vacíos de la caja, con los desvíos y las alertas. Nunca pisa lo que escribió una persona ni el efectivo contado.
--   · Alerta nueva "Falta cargar" (un lado tiene número y el otro está vacío).
--   · Si una foto no se lee, le avisa a quien la sacó (desde el 15/10).
--   · Al correrlo, completa las cajas de la última semana con fotos ya leídas, sin avisos.
--     Rivadavia 14/10: tarjeta 285.750 (sistema) contra 207.750 (lote) = desvío 78.000; falta Mercado Pago.

-- =====================================================================
-- Módulo VDH · Migración 31 (SQL 122), 14/10/2026: lo que la IA lee de las
-- fotos del cierre pasa solo a la caja.
--
-- Pedido de Mauricio (Rivadavia, 14/10): "esos datos se tienen que cargar
-- automáticamente en la planilla, esa que vemos. Así vemos esa diferencia de
-- una. Después corroboramos con las fotos nosotros". Y que el panel avise qué
-- falta cargar, y que al que cerró le llegue un aviso cuando una foto no se lee
-- (de acá en adelante; por lo de hoy, no).
--
-- 1. orden_caja_completar_con_ia: cuando la IA lee bien una foto (al sacarla o
--    con "Leer de nuevo"), los números que leyó van a los campos VACÍOS de esa
--    caja (y a los que ya había puesto la IA antes). Nunca pisa lo que escribió
--    una persona, nunca toca el efectivo contado, no usa una foto de otro día,
--    y no toca una caja controlada ni un mes cerrado. Lo que puso la IA queda
--    anotado en orden_cajas.ia_campos.
-- 2. orden_caja_alertas: las alertas de una caja, en un solo lugar (las de
--    siempre: desvío, no coincide con la foto, foto de otro día) y una nueva,
--    "falta": un lado tiene un número y el otro está vacío (por ejemplo, el
--    sistema dice Mercado Pago 127.500 y la app de Mercado Pago no se leyó).
--    En ese caso es "falta cargar", no un desvío.
-- 3. orden_caja_guardar usa las dos (y lo que guarda la persona deja de ser
--    "de la IA"). orden_caja_aplicar_lectura completa la caja y, si ya estaba
--    cargada, recalcula las alertas y avisa como al guardar.
-- 4. Si la IA dice que una foto no se lee, le avisa a quien la sacó, con el
--    motivo. Sólo para fotos sacadas desde el 15/10 (por lo de hoy, no).
-- 5. Las cajas de la última semana con fotos ya leídas se completan ahora, sin
--    avisos (Rivadavia del 14/10: tarjeta 285.750 del sistema contra 207.750 del
--    lote).
--
-- Reversible: volver orden_caja_guardar y orden_caja_aplicar_lectura a como
-- estaban, borrar orden_caja_alertas, orden_caja_completar_con_ia y
-- orden_caja_avisar_alertas, y la columna ia_campos (los números que ya
-- completó quedan).
-- =====================================================================

alter table orden_cajas add column if not exists ia_campos text[] not null default '{}';

/** De qué foto sale cada campo de la caja, y con qué nombre lo devuelve la IA. El efectivo contado, nunca. */
create or replace function orden_caja_mapa_ia()
returns jsonb language sql immutable as $$
  select '{
    "sistema":  {"sis_saldo_inicial":"saldo_inicial","sis_tarjeta":"ventas_tarjeta","sis_efectivo":"ventas_efectivo",
                 "sis_mp":"ventas_mercado_pago","sis_gocuotas":"ventas_debito_go","sis_cuenta_corriente":"ventas_cuenta_corriente",
                 "sis_deposito":"ventas_deposito_bancario","sis_total":"ventas_totales","sis_gastos":"gastos_efectivo",
                 "sis_otras_salidas":"otras_salidas","sis_descuentos":"descuentos","sis_saldo_final_efvo":"saldo_final_efectivo"},
    "lote":     {"real_lote":"total"},
    "mp":       {"real_mp":"total"},
    "gocuotas": {"real_gocuotas":"total"}}'::jsonb
$$;

/** Completa la caja con lo que leyó la IA. Devuelve true si cambió algo. */
create or replace function orden_caja_completar_con_ia(p_caja uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  c orden_cajas; f record; k text; v numeric; v_set jsonb := '{}'; v_actual jsonb;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or c.estado = 'controlada' then return false; end if;
  if exists (select 1 from orden_cajas_meses where local_id = c.local_id and mes = to_char(c.fecha, 'YYYY-MM') and estado = 'controlado') then
    return false;
  end if;
  v_actual := to_jsonb(c);
  for f in select distinct on (tipo) * from orden_caja_fotos
           where caja_id = c.id and ia_estado = 'ok' and borrada_en is null order by tipo, tomada_en desc loop
    -- Una foto de otro día no carga nada (ya sale como alerta).
    continue when orden_fecha_segura(f.ia_resultado ->> 'fecha') is distinct from c.fecha and f.ia_resultado ->> 'fecha' is not null;
    for k in select jsonb_object_keys(orden_caja_mapa_ia() -> f.tipo) loop
      v := orden_num(f.ia_resultado ->> (orden_caja_mapa_ia() -> f.tipo ->> k));
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
    ia_campos            = array(select distinct x from unnest(ia_campos || array(select jsonb_object_keys(v_set))) x order by x)
  where id = c.id;
  return true;
end $$;

/** Las alertas de una caja (las de siempre y "falta"). */
create or replace function orden_caja_alertas(p_caja uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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

  -- 2) Lo que escribieron no coincide con lo que leyó la IA en la foto
  -- 3) La foto es de otro día (ej. un cierre de lote viejo)
  for f in select distinct on (tipo) * from orden_caja_fotos
           where caja_id = c.id and ia_estado = 'ok' and borrada_en is null order by tipo, tomada_en desc loop
    for k in select jsonb_object_keys(orden_caja_mapa_ia() -> f.tipo) loop
      v_leido := orden_num(f.ia_resultado ->> (orden_caja_mapa_ia() -> f.tipo ->> k));
      v_tipeado := orden_num(to_jsonb(c) ->> k);
      if v_leido is not null and v_tipeado is not null and abs(v_leido - v_tipeado) > 1 then
        v_alertas := v_alertas || jsonb_build_object('tipo', 'no_coincide_foto', 'campo', k,
                                                     'en_foto', v_leido, 'cargado', v_tipeado);
      end if;
    end loop;
    if orden_fecha_segura(f.ia_resultado ->> 'fecha') <> c.fecha then
      v_alertas := v_alertas || jsonb_build_object('tipo', 'foto_otro_dia', 'foto', f.tipo, 'fecha_foto', f.ia_resultado ->> 'fecha');
    end if;
  end loop;
  return v_alertas;
end $$;

/** El aviso a los responsables cuando una caja tiene alertas (el mismo de siempre, ahora también con "falta"). */
create or replace function orden_caja_avisar_alertas(p_caja uuid)
returns void language plpgsql security definer set search_path = public as $$
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
                         else 'foto de otro día' end, ' · ')
     from jsonb_array_elements(c.alertas) a),
    '/cajas', 'caja-alerta:' || c.id || ':' || md5(c.alertas::text), 2::smallint);
end $$;

create or replace function orden_caja_guardar(p_caja uuid, p_valores jsonb, p_observaciones text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare
  c orden_cajas; v_alertas jsonb;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Esta caja ya fue controlada: solo el supervisor puede cambiarla';
  end if;
  if orden_num(p_valores ->> 'real_efectivo') is null and (p_valores ? 'real_efectivo' or c.real_efectivo is null) then
    raise exception 'Falta el efectivo que contaste';
  end if;
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
    ia_campos            = array(select x from unnest(ia_campos) x where not p_valores ? x)
  where id = c.id;

  -- (SQL 122) Lo que quedó vacío y la IA leyó bien, se completa.
  perform orden_caja_completar_con_ia(c.id);
  v_alertas := orden_caja_alertas(c.id);

  update orden_cajas
     set alertas = v_alertas,
         estado = case when estado = 'pendiente' then 'cargada' else estado end,
         cargada_por = coalesce(cargada_por, orden_yo_id()),
         cargada_en = coalesce(cargada_en, now())
   where id = c.id returning * into c;

  perform orden_caja_avisar_alertas(c.id);
  return c;
end $$;

create or replace function orden_caja_aplicar_lectura(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f orden_caja_fotos; c orden_cajas; v_alertas jsonb; v_que text;
begin
  update orden_caja_fotos
     set ia_estado = case when coalesce((p_resultado ->> 'foto_valida')::boolean, true) then 'ok' else 'invalida' end,
         ia_resultado = p_resultado, ia_modelo = p_modelo
   where id = p_foto
  returning * into f;
  if not found then return p_resultado; end if;

  -- (SQL 122) Lo que leyó bien pasa a la caja.
  if f.ia_estado = 'ok' then perform orden_caja_completar_con_ia(f.caja_id); end if;
  -- Si la caja ya estaba guardada, las alertas se recalculan (también con una foto que no se lee: la
  -- alerta "falta" lleva su motivo). A los responsables se les avisa como al guardar, sólo si la lectura fue buena.
  select * into c from orden_cajas where id = f.caja_id;
  if found and c.estado = 'cargada' and not exists (select 1 from orden_cajas_meses
       where local_id = c.local_id and mes = to_char(c.fecha, 'YYYY-MM') and estado = 'controlado') then
    v_alertas := orden_caja_alertas(c.id);
    if v_alertas is distinct from c.alertas then
      update orden_cajas set alertas = v_alertas where id = c.id;
      if f.ia_estado = 'ok' then perform orden_caja_avisar_alertas(c.id); end if;
    end if;
  end if;

  if f.ia_estado = 'invalida' and f.persona_id is not null and f.tomada_en >= timestamptz '2026-10-15 00:00:00-03' and f.tomada_en > now() - interval '6 hours' then
    -- (SQL 122) La foto no se lee: se le avisa a quien la sacó, con el motivo (de acá en adelante).
    v_que := case f.tipo when 'sistema' then 'del cierre del sistema' when 'lote' then 'del cierre de lote (posnet)'
                         when 'mp' then 'de Mercado Pago' else 'de Go Cuotas' end;
    perform orden_encolar_aviso(f.persona_id, 'caja_foto', 'Caja: la foto ' || v_que || ' no se leía',
      left(coalesce(nullif(trim(p_resultado ->> 'motivo'), ''), 'No se ven bien los números.'), 220) ||
        ' Si todavía estás en el local, sacala de nuevo en Caja; si no, tenelo en cuenta para la próxima.',
      '/caja', 'caja-foto:' || f.id, 2::smallint);
  end if;
  return p_resultado;
end $$;

do $$
begin
  revoke all on function orden_caja_completar_con_ia(uuid) from public, anon, authenticated;
  revoke all on function orden_caja_alertas(uuid) from public, anon, authenticated;
  revoke all on function orden_caja_avisar_alertas(uuid) from public, anon, authenticated;
  grant execute on function orden_caja_completar_con_ia(uuid) to service_role;
  grant execute on function orden_caja_alertas(uuid) to service_role;
  grant execute on function orden_caja_avisar_alertas(uuid) to service_role;
  revoke all on function orden_caja_aplicar_lectura(uuid, jsonb, text) from public, anon, authenticated;
  grant execute on function orden_caja_aplicar_lectura(uuid, jsonb, text) to service_role;
end $$;

-- 5) Las cajas de la última semana con fotos ya leídas: se completan ahora, sin avisos.
do $$
declare r record; v_alertas jsonb;
begin
  for r in select distinct c.id, c.estado from orden_cajas c join orden_caja_fotos f on f.caja_id = c.id and f.ia_estado = 'ok'
            where c.fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date - 7 and c.estado <> 'controlada' loop
    if orden_caja_completar_con_ia(r.id) and r.estado = 'cargada' then
      v_alertas := orden_caja_alertas(r.id);
      update orden_cajas set alertas = v_alertas where id = r.id and alertas is distinct from v_alertas;
    end if;
  end loop;
end $$;
