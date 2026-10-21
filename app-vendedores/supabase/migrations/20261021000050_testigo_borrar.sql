-- =====================================================================
-- Módulo VDH · Migración 50 (SQL 155), 21/10/2026: borrar un control del
-- producto testigo. Pedido de Mauricio, después de programar sin querer los
-- 5 productos de Rivadavia en los 14 locales (se arregló a mano con el SQL 153):
--   · En la compu (Supervisión → Productos testigo), "Borrar el control de X":
--     saca el control de ese local esa semana, con sus productos, y los
--     avisos que tuviera encolados. Le desaparece de la app.
--   · Lo puede borrar quien lo puede programar (el administrador, o el
--     supervisor en sus locales), y sólo mientras el local no haya cargado
--     nada: ni un número, ni una observación, ni un video. Si ya empezó, se
--     corrige casillero por casillero, como siempre.
-- No toca nada de lo que ya existe. Reversible: deshacer-155.sql.
-- =====================================================================

create or replace function testigo_borrar(p_semana uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_sem testigo_semanas; v_local text; v_n int;
begin
  select * into v_sem from testigo_semanas where id = p_semana for update;
  if not found then raise exception 'Ese control ya no está (puede que alguien lo haya borrado)'; end if;
  select nombre into v_local from orden_locales where id = v_sem.local_id;
  if not orden_es_supervisor_de(v_sem.local_id) or orden_es_gerencia() then
    raise exception 'No podés borrar el control de %', v_local;
  end if;
  if v_sem.cerrada then raise exception 'En % esa semana ya está cerrada: no se puede borrar', v_local; end if;
  if v_sem.cargada_en is not null then
    raise exception '% ya lo mandó: no se puede borrar (si hay algo mal, corregí los casilleros)', v_local;
  end if;
  if exists (select 1 from testigo_items where semana_id = p_semana
              and (stock_sistema is not null or cantidad_real is not null or enviada is not null or vendida is not null
                   or coalesce(dev_fabrica, 0) <> 0 or coalesce(salieron, 0) <> 0 or coalesce(entraron, 0) <> 0
                   or video_path is not null or nullif(trim(observacion), '') is not null or cargado_en is not null)) then
    raise exception '% ya empezó a cargarlo: no se puede borrar (si hay algo mal, corregí los casilleros)', v_local;
  end if;
  select count(*) into v_n from testigo_items where semana_id = p_semana;
  -- Los avisos de este control que estén por salir (o sin leer): ya no corresponden.
  delete from orden_avisos where tipo = 'testigo' and clave like 'testigo-%:' || p_semana::text || ':%';
  -- Los productos se borran solos con su control.
  delete from testigo_semanas where id = p_semana;
  return jsonb_build_object('ok', true, 'local', v_local, 'productos', v_n);
end $$;

do $$
begin
  revoke all on function testigo_borrar(uuid) from public, anon;
  grant execute on function testigo_borrar(uuid) to authenticated, service_role;
end $$;
