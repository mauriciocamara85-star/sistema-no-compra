-- =====================================================================
-- Módulo VDH · Migración 59 (SQL 181), 26/10/2026: las vacaciones de
-- cada persona, en Config → Usuarios.
--
-- Pedido de Mauricio (26/10), con Mel de vacaciones las semanas 4 y 5 de
-- octubre: "a ella en los días le tendría que aparecer como los francos,
-- sin posibilidad de cargar la venta".
--
-- Van a orden_ausencias, la tabla que Equipo VDH tiene desde el arranque
-- para esto ("Vacaciones, licencias o francos sueltos. Mientras dure, la
-- persona no recibe controles") y que hasta hoy no se cargaba desde
-- ninguna pantalla. Con eso, unas vacaciones sirven para todo:
--   - Ventas: esos días salen rayados con una "V" y no se cargan
--     (ventas_mes_datos y ventas_guardar, en supabase/ventas.sql).
--   - Equipo VDH: orden_trabaja ya las mira; esos días la persona no
--     recibe controles ni tareas, como en su franco.
--
-- 1. nc_vacaciones (nueva): las de la gente que maneja quien pregunta,
--    desde el 1 del mes pasado (lo que Ventas todavía deja corregir).
-- 2. nc_vacacion_guardar (nueva): carga unas. Las mismas reglas que los
--    francos (nc_puede_tocar): el administrador a cualquiera; el
--    encargado, a los vendedores de su local.
-- 3. nc_vacacion_borrar (nueva): las saca.
--
-- No borra datos. Reversible: deshacer-181.sql.
-- =====================================================================

/** Las vacaciones de la gente que maneja quien pregunta (las que terminan desde el 1 del mes pasado). */
create or replace function nc_vacaciones()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); v_admin boolean;
begin
  if yo.id is null then
    return jsonb_build_object('error', 'permiso', 'porque', 'Tu usuario no maneja usuarios: lo hacen el administrador y los encargados.');
  end if;
  v_admin := yo.rol = 'admin';
  return jsonb_build_object('vacaciones', (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'persona', a.persona_id, 'desde', a.desde, 'hasta', a.hasta, 'motivo', a.motivo)
                              order by a.desde), '[]'::jsonb)
      from orden_ausencias a join orden_personas p on p.id = a.persona_id
     where a.hasta >= (date_trunc('month', ventas_hoy()) - interval '1 month')::date
       and (v_admin or p.id = yo.id or (p.local_id = yo.local_id and p.rol = 'vendedor'))));
end $$;
revoke all on function nc_vacaciones() from public, anon;
grant execute on function nc_vacaciones() to authenticated;

/** Unas vacaciones (o una licencia): del p_desde al p_hasta, los dos incluidos. */
create or replace function nc_vacacion_guardar(p_persona uuid, p_desde date, p_hasta date, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas; v_otra orden_ausencias; v_id uuid;
begin
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if not coalesce(nc_puede_tocar(yo, p), false) then
    return jsonb_build_object('ok', false, 'porque', 'No podés cargarle vacaciones a esta persona.');
  end if;
  if p_desde is null or p_hasta is null then
    return jsonb_build_object('ok', false, 'porque', 'Poné desde qué día y hasta qué día.');
  end if;
  if p_hasta < p_desde then
    return jsonb_build_object('ok', false, 'porque', 'El "hasta" no puede ser antes del "desde".');
  end if;
  /* Más atrás, Ventas ya cerró ese mes y Equipo VDH ya cerró esos controles. */
  if p_desde < (date_trunc('month', ventas_hoy()) - interval '1 month')::date then
    return jsonb_build_object('ok', false, 'porque', 'Se cargan desde el 1 del mes pasado en adelante.');
  end if;
  if p_hasta - p_desde > 120 then
    return jsonb_build_object('ok', false, 'porque', 'Son más de 4 meses: revisá las fechas.');
  end if;
  select * into v_otra from orden_ausencias
   where persona_id = p.id and desde <= p_hasta and hasta >= p_desde order by desde limit 1;
  if found then
    return jsonb_build_object('ok', false, 'porque', 'Se pisa con las que ya tiene, del ' || to_char(v_otra.desde, 'DD/MM') ||
                              ' al ' || to_char(v_otra.hasta, 'DD/MM') || ': sacá esas primero.');
  end if;
  insert into orden_ausencias (persona_id, desde, hasta, motivo)
  values (p.id, p_desde, p_hasta, nullif(left(btrim(coalesce(p_motivo, '')), 80), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function nc_vacacion_guardar(uuid, date, date, text) from public, anon;
grant execute on function nc_vacacion_guardar(uuid, date, date, text) to authenticated;

/** Saca unas vacaciones (las mismas reglas que para cargarlas). */
create or replace function nc_vacacion_borrar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas;
begin
  select pe.* into p from orden_ausencias a join orden_personas pe on pe.id = a.persona_id where a.id = p_id;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Esas vacaciones ya no están.'); end if;
  if not coalesce(nc_puede_tocar(yo, p), false) then
    return jsonb_build_object('ok', false, 'porque', 'No podés sacarle las vacaciones a esta persona.');
  end if;
  delete from orden_ausencias where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function nc_vacacion_borrar(uuid) from public, anon;
grant execute on function nc_vacacion_borrar(uuid) to authenticated;
