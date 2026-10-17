-- =====================================================================
-- Módulo VDH · Migración 40 (SQL 134), 17/10/2026: la IA de la caja se
-- puede apagar por local.
--
-- Pedido de Mauricio (17/10, en Ajustes): "una parte de caja, poder
-- desactivar la IA o no".
--
-- 1. orden_config.caja_ia: prendida en los 14 locales, como hasta ahora. Se
--    cambia en Ajustes → El local → La caja (y se copia a los otros locales).
-- 2. orden_caja_preparar_lectura: con la IA apagada no deja leer la foto. La
--    app nueva ni la manda a leer; esto frena a una app vieja y al "Leer de
--    nuevo" de la compu, con un mensaje claro.
-- 3. orden_caja_completar_con_ia: con la IA apagada no completa nada, tampoco
--    con fotos leídas antes de apagarla.
--
-- La pestaña nueva "Crear tarea" no necesita nada en la base: usa
-- orden_crear_tarea, la misma que usa el supervisor en la app.
--
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

alter table orden_config add column if not exists caja_ia boolean not null default true;
comment on column orden_config.caja_ia is 'La IA lee las fotos del cierre y completa la caja (SQL 134). Apagada, se cargan a mano.';

/** Lo que necesita leer-caja para leer una foto. (SQL 134) Con la IA de la caja apagada, no se lee. */
create or replace function orden_caja_preparar_lectura(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f orden_caja_fotos; c orden_cajas; l orden_locales;
begin
  select * into f from orden_caja_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_cajas where id = f.caja_id;
  if not orden_ve_local(c.local_id) then raise exception 'Sin acceso'; end if;
  if not coalesce((select caja_ia from orden_config where local_id = c.local_id), true) then
    raise exception 'La lectura con IA de la caja está apagada en este local (Ajustes → El local → La caja): cargá los números a mano.';
  end if;
  select * into l from orden_locales where id = c.local_id;
  return jsonb_build_object('foto_id', f.id, 'foto_path', f.foto_path, 'tipo', f.tipo,
                            'fecha', c.fecha, 'local', l.nombre);
end $$;

/** Completa la caja con lo que leyó la IA. Devuelve true si cambió algo. (SQL 133: también el efectivo contado;
    SQL 134: nada si la IA de la caja está apagada en el local.) */
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
  -- (SQL 134) Con la IA de la caja apagada en el local, se carga a mano.
  if not coalesce((select caja_ia from orden_config where local_id = c.local_id), true) then return false; end if;
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

-- Chequeo: tiene que decir 14 locales, todos con la IA prendida.
select count(*) as locales, count(*) filter (where caja_ia) as con_la_ia_prendida from orden_config;

-- ---------------------------------------------------------------------
-- Vuelta atrás: prender la IA en todos alcanza (las dos funciones, con
-- caja_ia en true, hacen lo mismo que antes):
--
-- update orden_config set caja_ia = true;
--
-- Y para sacar la columna del todo, primero volver a correr las dos
-- funciones del SQL 133 / 122 sin la línea de caja_ia, y después:
-- alter table orden_config drop column caja_ia;
-- ---------------------------------------------------------------------
