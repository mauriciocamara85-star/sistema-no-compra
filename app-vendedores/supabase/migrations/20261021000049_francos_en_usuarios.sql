-- =====================================================================
-- Módulo VDH · Migración 49 (SQL 154), 21/10/2026: los francos de cada
-- persona, en Config → Usuarios.
--
-- Pedido de Mauricio (21/10): Supervisión → Ajustes → "Personas" repetía
-- lo de Config → Usuarios ("todo esto no sería mejor que esté en usuarios.
-- Lo de los francos, por ejemplo. De cada persona"). La pestaña se va y los
-- francos pasan a Usuarios. Hasta ahora sólo los cambiaba el administrador,
-- desde esa pestaña, escribiendo directo en orden_personas.
--
-- 1. nc_usuarios: trae los francos de cada uno (dias_libres, ISO 1..7).
-- 2. nc_usuario_francos (nueva): los cambia. Las mismas reglas que el resto
--    de Usuarios (nc_puede_tocar): el administrador a cualquiera; el
--    encargado, a los vendedores de su local. Al menos un día de trabajo.
--
-- Los francos los usan los vencimientos de Equipo VDH (el día anterior que
-- trabaja), los avisos y la planilla de Ventas: no cambia nada de eso, sólo
-- desde dónde se cargan. Los que ya están cargados no se tocan.
--
-- No borra datos. Reversible: deshacer-154.sql.
-- =====================================================================

create or replace function nc_usuarios()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); v_admin boolean;
begin
  if yo.id is null then
    return jsonb_build_object('error', 'permiso', 'porque', 'Tu usuario no maneja usuarios: lo hacen el administrador y los encargados.');
  end if;
  v_admin := yo.rol = 'admin';
  return jsonb_build_object(
    'yo', jsonb_build_object('id', yo.id, 'rol', yo.rol, 'local_id', yo.local_id),
    'locales', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre), '[]'::jsonb)
                  from orden_locales l where l.activo and (v_admin or l.id = yo.local_id)),
    'personas', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido,
                    'lista', orden_nombre_lista(p.nombre, p.inicial),
                    'rol', p.rol, 'local_id', p.local_id, 'activo', p.activo, 'aprobado', p.aprobado,
                    'alta_propia', p.alta_propia,
                    /* SQL 135: además atiende clientes. */
                    'tambien_atencion', p.tambien_atencion,
                    /* SQL 154: sus francos (ISO 1..7: 1 = lunes). */
                    'francos', to_jsonb(p.dias_libres),
                    /* SQL 141: los locales del supervisor de varios locales (los que pidió, sin aprobar). */
                    'supervisa', (select coalesce(jsonb_agg(jsonb_build_object('id', s.local_id, 'aprobado', s.aprobado)), '[]'::jsonb)
                                    from orden_supervision s where s.persona_id = p.id),
                    /* El estado del PIN, sin el PIN: si está en la lista para entrar,
                       si ya lo creó y si ya entró alguna vez. */
                    'en_lista', k.persona_id is not null, 'pin', k.hash is not null,
                    'entro', p.auth_user_id is not null,
                    'creado', p.creado_en, 'soy', p.id = yo.id)
                  order by p.activo desc, p.nombre, p.apellido), '[]'::jsonb)
                   from orden_personas p left join orden_pins k on k.persona_id = p.id
                  where v_admin or p.id = yo.id or (p.local_id = yo.local_id and p.rol = 'vendedor')));
end $$;

/** Los francos de una persona (SQL 154): los días de la semana que no trabaja, ISO 1..7 (1 = lunes). */
create or replace function nc_usuario_francos(p_persona uuid, p_dias smallint[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas; v_dias smallint[];
begin
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if not coalesce(nc_puede_tocar(yo, p), false) then
    return jsonb_build_object('ok', false, 'porque', 'No podés cambiarle los francos a esta persona.');
  end if;
  if exists (select 1 from unnest(coalesce(p_dias, '{}'::smallint[])) d where d is null or d not between 1 and 7) then
    return jsonb_build_object('ok', false, 'porque', 'Los días van del lunes (1) al domingo (7).');
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_dias from unnest(coalesce(p_dias, '{}'::smallint[])) d;
  if cardinality(v_dias) = 7 then
    return jsonb_build_object('ok', false, 'porque', 'Con los 7 días de franco no trabajaría nunca: dejale al menos uno.');
  end if;
  update orden_personas set dias_libres = v_dias where id = p.id;
  return jsonb_build_object('ok', true, 'francos', to_jsonb(v_dias));
end $$;
revoke all on function nc_usuario_francos(uuid, smallint[]) from public, anon;
grant execute on function nc_usuario_francos(uuid, smallint[]) to authenticated;
