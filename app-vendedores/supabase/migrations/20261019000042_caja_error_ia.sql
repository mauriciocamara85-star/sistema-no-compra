-- =====================================================================
-- Módulo VDH · Migración 42 (SQL 139), 19/10/2026: por qué no se leyó una
-- foto del cierre de caja.
--
-- El 17/10 la foto del sistema de Rivadavia quedó "La IA no la pudo leer"
-- y no quedaba anotado por qué (hubo que deducirlo: el formato de la
-- respuesta tenía más campos de los que acepta la API). Las fotos de los
-- módulos ya guardan el motivo (orden_fotos.ia_error); ahora las de la caja
-- también:
-- 1. orden_caja_fotos.ia_error: el error de la última lectura que falló
--    (lo escribe leer-caja, hasta 1000 letras).
-- 2. orden_caja_aplicar_lectura: igual que hoy, y además borra ese error
--    cuando una lectura sale bien (por ejemplo, con "Leer de nuevo").
--
-- Después de correrlo hay que redesplegar leer-caja (Claude te pasa el
-- comando). Si se despliega antes, no se rompe nada: el error no se anota.
--
-- Reversible: con la columna vacía todo funciona como antes.
-- =====================================================================

alter table orden_caja_fotos add column if not exists ia_error text;
comment on column orden_caja_fotos.ia_error is 'Por qué falló la última lectura de la IA (leer-caja); se borra cuando una lectura sale bien (SQL 139).';

create or replace function orden_caja_aplicar_lectura(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f orden_caja_fotos; c orden_cajas; v_alertas jsonb; v_que text;
begin
  update orden_caja_fotos
     set ia_estado = case when coalesce((p_resultado ->> 'foto_valida')::boolean, true) then 'ok' else 'invalida' end,
         -- SQL 139: si antes había fallado, el error ya no corre.
         ia_resultado = p_resultado, ia_modelo = p_modelo, ia_error = null
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

-- Chequeo: tiene que decir "sí" y "sí".
select case when exists (select 1 from information_schema.columns where table_name = 'orden_caja_fotos' and column_name = 'ia_error') then 'sí' else 'NO' end as columna_del_error,
       case when pg_get_functiondef('orden_caja_aplicar_lectura'::regproc) like '%ia_error = null%' then 'sí' else 'NO' end as lectura_buena_borra_el_error;
