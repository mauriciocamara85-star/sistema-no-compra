-- =====================================================================
-- Módulo VDH · Migración 33 (SQL 124), 14/10/2026: corregir una caja y, si
-- no tiene arreglo, quién se hace cargo de la diferencia.
--
-- Pedido de Mauricio: "que lo pueda corregir el supervisor. Una vez que
-- comprobamos que es algo que se puede corregir, se corrige [con un cierre de
-- caja nuevo: volver a mandar la foto del cierre corregido]; y si no, va a
-- quedar esa diferencia y va a tener que pagar el responsable".
--
-- Corregir ya se puede en la base: el supervisor (y el administrador) puede
-- mandar fotos y guardar la caja de cualquier día de su local, y queda el
-- historial de quién cambió qué. Esto agrega lo segundo:
--   · orden_cajas.diferencia_persona / diferencia_monto: quién se hace cargo y
--     cuánto, al darla por controlada.
--   · orden_caja_controlar(p_caja, p_nota, p_persona, p_monto): los dos nuevos
--     son opcionales (la app de antes sigue andando).
--   · orden_v_cajas suma al final: ia_campos, diferencia_persona,
--     diferencia_monto y diferencia_persona_nombre.
--   · El candado del mes cerrado deja anotar quién se hace cargo (no cambia
--     ningún monto de la caja).
-- Reversible: volver orden_caja_controlar a (uuid, text), la vista y el
-- candado a como estaban, y borrar las dos columnas.
-- =====================================================================

alter table orden_cajas add column if not exists diferencia_persona uuid references orden_personas(id) on delete set null;
alter table orden_cajas add column if not exists diferencia_monto numeric;

drop function if exists orden_caja_controlar(uuid, text);
create or replace function orden_caja_controlar(p_caja uuid, p_nota text default null, p_persona uuid default null, p_monto numeric default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare c orden_cajas;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_es_supervisor_de(c.local_id) then raise exception 'Solo el supervisor puede controlar la caja'; end if;
  if c.estado = 'pendiente' then raise exception 'La caja todavía no fue cargada'; end if;
  if jsonb_array_length(c.alertas) > 0 and coalesce(trim(p_nota), '') = '' then
    raise exception 'Esta caja tiene alertas: escribí qué pasó antes de darla por controlada';
  end if;
  -- (SQL 124) Si la diferencia no tiene arreglo: quién se hace cargo y cuánto.
  if p_persona is not null then
    if not exists (select 1 from orden_personas where id = p_persona and activo) then raise exception 'No encontramos a esa persona'; end if;
    if p_monto is null or p_monto <= 0 then raise exception 'Escribí cuánto es la diferencia que queda a su cargo'; end if;
  end if;
  update orden_cajas set estado = 'controlada', controlada_por = orden_yo_id(), controlada_en = now(),
                         nota_control = nullif(trim(p_nota), ''),
                         diferencia_persona = p_persona,
                         diferencia_monto = case when p_persona is null then null else round(p_monto, 2) end
   where id = c.id returning * into c;
  return c;
end $$;

do $$
begin
  revoke all on function orden_caja_controlar(uuid, text, uuid, numeric) from public, anon;
  grant execute on function orden_caja_controlar(uuid, text, uuid, numeric) to authenticated, service_role;
end $$;

create or replace view orden_v_cajas with (security_invoker = true) as
 select c.id, c.local_id, c.fecha, c.sis_saldo_inicial, c.sis_tarjeta, c.sis_efectivo, c.sis_mp, c.sis_gocuotas,
    c.sis_cuenta_corriente, c.sis_deposito, c.sis_total, c.sis_gastos, c.sis_otras_salidas, c.sis_descuentos,
    c.sis_saldo_final_efvo, c.real_lote, c.real_mp, c.real_gocuotas, c.real_efectivo,
    c.desvio_mp, c.desvio_tarjeta, c.desvio_gocuotas, c.desvio_efectivo,
    c.estado, c.alertas, c.observaciones, c.cargada_por, c.cargada_en, c.controlada_por, c.controlada_en,
    c.nota_control, c.creado_en, c.historial,
    l.nombre as local_nombre,
    to_char(c.fecha::timestamp with time zone, 'YYYY-MM') as mes,
    jsonb_array_length(c.alertas) > 0 as con_alertas,
    pc.nombre as cargada_por_nombre,
    ps.nombre as controlada_por_nombre,
    (select jsonb_object_agg(f.tipo, f.foto_path)
       from (select distinct on (orden_caja_fotos.tipo) orden_caja_fotos.tipo, orden_caja_fotos.foto_path
               from orden_caja_fotos
              where orden_caja_fotos.caja_id = c.id and orden_caja_fotos.borrada_en is null
              order by orden_caja_fotos.tipo, orden_caja_fotos.tomada_en desc) f) as fotos,
    -- (SQL 124) Lo que cargó la IA y quién se hace cargo de la diferencia.
    c.ia_campos,
    c.diferencia_persona,
    c.diferencia_monto,
    pd.nombre as diferencia_persona_nombre
   from orden_cajas c
     join orden_locales l on l.id = c.local_id
     left join orden_personas pc on pc.id = c.cargada_por
     left join orden_personas ps on ps.id = c.controlada_por
     left join orden_personas pd on pd.id = c.diferencia_persona;

/* El candado del mes cerrado: anotar quién se hace cargo de la diferencia no cambia ningún monto. */
create or replace function orden_cajas_mes_trabado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fila orden_cajas := case when tg_op = 'DELETE' then old else new end;
  v_libres text[] := array['estado', 'controlada_por', 'controlada_en', 'nota_control',
                           'desvio_mp', 'desvio_tarjeta', 'desvio_gocuotas', 'desvio_efectivo',
                           'diferencia_persona', 'diferencia_monto'];
  v_n jsonb; v_o jsonb;
begin
  /* Se borra el local entero (en cascada): pasa. */
  if tg_op = 'DELETE' and not exists (select 1 from orden_locales where id = old.local_id) then return old; end if;
  if exists (select 1 from orden_cajas_meses
              where local_id = v_fila.local_id and mes = to_char(v_fila.fecha, 'YYYY-MM') and estado = 'controlado')
     or (tg_op = 'UPDATE' and exists (select 1 from orden_cajas_meses
              where local_id = old.local_id and mes = to_char(old.fecha, 'YYYY-MM') and estado = 'controlado')) then
    if tg_op = 'UPDATE' then
      v_n := to_jsonb(new) - v_libres; v_o := to_jsonb(old) - v_libres;
      /* Se borró la persona que la cargó (on delete set null): pasa. */
      if new.cargada_por is null then v_n := v_n - 'cargada_por'; v_o := v_o - 'cargada_por'; end if;
      if v_n is not distinct from v_o then return new; end if;
    end if;
    raise exception 'El mes de esta caja ya está cerrado por Administración: para cambiar algo, que lo reabra';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
