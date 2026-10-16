-- =====================================================================
-- Módulo VDH · Migración 39 (SQL 133), 16/10/2026: el efectivo contado
-- también lo carga la IA.
--
-- Pedido de Mauricio (16/10): "que la IA también detecte el efectivo real que
-- ahora sólo está manual: donde dice lo que contaste lo tiene que completar la
-- IA, desde la foto del cierre del sistema… donde dice TOTAL EFECTIVO y en
-- verde no hay sobrante ni faltante".
--
-- La función leer-caja (redesplegada con este cambio) ahora devuelve, de la
-- foto del sistema, total_efectivo (el recuadro TOTAL EFECTIVO) y
-- sobrante_faltante (el mensaje de abajo: 0 si está en verde).
--
-- 1. orden_caja_mapa_ia: el efectivo contado (real_efectivo) sale de
--    total_efectivo de la foto del sistema.
-- 2. orden_caja_completar_con_ia: completa también real_efectivo, con las
--    mismas reglas que los demás números: sólo si está vacío o lo había puesto
--    la IA; nunca lo que escribió una persona, nunca en una caja controlada ni
--    en un mes cerrado, nunca con una foto de otro día.
-- Si lo que escribieron no coincide con la foto, sale la alerta de siempre
-- ("un monto no coincide con la foto").
--
-- Las fotos leídas antes no traen total_efectivo: no cambia nada de lo que ya
-- está cargado. Se puede correr antes o después de desplegar leer-caja.
--
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

/** De qué foto sale cada campo de la caja, y con qué nombre lo devuelve la IA. (SQL 133) El efectivo contado, del TOTAL EFECTIVO. */
create or replace function orden_caja_mapa_ia()
returns jsonb language sql immutable as $$
  select '{
    "sistema":  {"sis_saldo_inicial":"saldo_inicial","sis_tarjeta":"ventas_tarjeta","sis_efectivo":"ventas_efectivo",
                 "sis_mp":"ventas_mercado_pago","sis_gocuotas":"ventas_debito_go","sis_cuenta_corriente":"ventas_cuenta_corriente",
                 "sis_deposito":"ventas_deposito_bancario","sis_total":"ventas_totales","sis_gastos":"gastos_efectivo",
                 "sis_otras_salidas":"otras_salidas","sis_descuentos":"descuentos","sis_saldo_final_efvo":"saldo_final_efectivo",
                 "real_efectivo":"total_efectivo"},
    "lote":     {"real_lote":"total"},
    "mp":       {"real_mp":"total"},
    "gocuotas": {"real_gocuotas":"total"}}'::jsonb
$$;

/** Completa la caja con lo que leyó la IA. Devuelve true si cambió algo. (SQL 133: también el efectivo contado.) */
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
    -- (SQL 133) El efectivo contado, del TOTAL EFECTIVO de la foto del sistema.
    real_efectivo        = case when v_set ? 'real_efectivo'        then (v_set ->> 'real_efectivo')::numeric        else real_efectivo end,
    ia_campos            = array(select distinct x from unnest(ia_campos || array(select jsonb_object_keys(v_set))) x order by x)
  where id = c.id;
  return true;
end $$;

-- Chequeo: tiene que decir total_efectivo y true.
select orden_caja_mapa_ia() -> 'sistema' ->> 'real_efectivo' as efectivo_de_la_foto,
       position('real_efectivo' in pg_get_functiondef('orden_caja_completar_con_ia(uuid)'::regprocedure)) > 0 as completa_el_efectivo;

-- ---------------------------------------------------------------------
-- Vuelta atrás: alcanza con sacar "real_efectivo" del mapa (sin eso, la
-- línea nueva de orden_caja_completar_con_ia no hace nada). Lo que ya
-- completó queda como está.
--
-- create or replace function orden_caja_mapa_ia()
-- returns jsonb language sql immutable as $$
--   select '{
--     "sistema":  {"sis_saldo_inicial":"saldo_inicial","sis_tarjeta":"ventas_tarjeta","sis_efectivo":"ventas_efectivo",
--                  "sis_mp":"ventas_mercado_pago","sis_gocuotas":"ventas_debito_go","sis_cuenta_corriente":"ventas_cuenta_corriente",
--                  "sis_deposito":"ventas_deposito_bancario","sis_total":"ventas_totales","sis_gastos":"gastos_efectivo",
--                  "sis_otras_salidas":"otras_salidas","sis_descuentos":"descuentos","sis_saldo_final_efvo":"saldo_final_efectivo"},
--     "lote":     {"real_lote":"total"},
--     "mp":       {"real_mp":"total"},
--     "gocuotas": {"real_gocuotas":"total"}}'::jsonb
-- $$;
-- ---------------------------------------------------------------------
