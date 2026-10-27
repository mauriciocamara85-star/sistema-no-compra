-- =====================================================================
-- Módulo VDH · Migración 60 (SQL 183), 27/10/2026: cada vendedor elige
-- su franco la primera vez que entra.
--
-- Pedido de Mauricio (27/10), el día que se crearon los 41 usuarios de
-- los 13 locales: "que cuando crean el PIN aparezca para que cada
-- vendedor pueda elegir su franco. Así ya también nos sacamos eso de
-- encima". Lo acordado:
--   - Se pregunta UNA vez, y sólo a quien es de un local (vendedor o
--     encargado), está aprobado y todavía no tiene francos cargados.
--     "Varía" (no tiene uno fijo) también vale como respuesta: queda sin
--     días, igual que "sin franco fijo" en Config → Usuarios.
--   - Después lo cambia sólo el encargado o la oficina (Config →
--     Usuarios, como hasta hoy): el franco le saca los controles de ese
--     día en Equipo VDH (orden_trabaja).
--   - En Ventas, desde noviembre: los renglones de vendedores que se
--     crean sin persona (al abrir el mes, al importar una planilla, al
--     sumar uno escribiendo el nombre) se vinculan solos con su usuario
--     si el nombre y el apellido coinciden con uno solo. Con eso, sus
--     francos y vacaciones de Config → Usuarios llegan a la planilla.
--     Octubre no se toca.
--
-- 1. orden_personas.franco_elegido (nueva): cuándo eligió su franco la
--    persona misma. Con eso no se le vuelve a preguntar.
-- 2. orden_falta_franco (nueva): la regla de a quién se le pregunta.
-- 3. nc_franco_pendiente / nc_franco_elegir (nuevas): las usan Equipo
--    VDH y la compu (persona.js) apenas entra alguien.
-- 4. nc_usuarios: suma 'falta_franco', para que Config → Usuarios diga
--    "falta que elija su franco" en vez de "sin franco fijo".
-- 5. nc_usuario_crear: el que se crea en Config → Usuarios entra ya a
--    "Lo atendió" de su local (nc_equipo_poner, como al cambiarlo o
--    reactivarlo). El manual lo prometía y no pasaba: aparecía recién
--    con su primer registro.
-- 6. ventas_vendedores: el vínculo de Ventas (trigger, desde noviembre).
--
-- No borra datos. Reversible: deshacer-183.sql.
-- =====================================================================

-- 1. La marca de "ya lo eligió".
alter table orden_personas add column if not exists franco_elegido timestamptz;
comment on column orden_personas.franco_elegido is
  'SQL 183: cuándo eligió su franco la persona misma (al entrar). Con esto no se le vuelve a preguntar; después lo cambian el encargado o la oficina.';

-- 2. A quién se le pregunta: es de un local, vendedor o encargado, activo y aprobado, sin francos y sin haber contestado.
create or replace function orden_falta_franco(p orden_personas)
returns boolean language sql stable set search_path = public as $$
  select coalesce(p.id is not null and p.activo and p.aprobado and p.local_id is not null
                  and p.rol in ('vendedor', 'supervisor')
                  and cardinality(p.dias_libres) = 0 and p.franco_elegido is null, false)
$$;
revoke all on function orden_falta_franco(orden_personas) from public, anon, authenticated;

-- 3a. ¿Me falta elegir el franco? (quien entró con su PIN)
create or replace function nc_franco_pendiente()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select orden_falta_franco(p) from orden_personas p
                    where p.auth_user_id = auth.uid() and auth.uid() is not null), false)
$$;
revoke all on function nc_franco_pendiente() from public, anon;
grant execute on function nc_franco_pendiente() to authenticated;

-- 3b. Elige su franco (una sola vez). p_dias vacío = "Varía": no tiene uno fijo.
create or replace function nc_franco_elegir(p_dias smallint[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p orden_personas; v_dias smallint[];
begin
  select * into p from orden_personas where auth_user_id = auth.uid() and auth.uid() is not null for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Entrá con tu PIN para elegir tu franco.'); end if;
  if not orden_falta_franco(p) then
    return jsonb_build_object('ok', false, 'ya', true, 'porque', 'Tu franco ya está cargado. Si cambió, pedíselo a tu encargado.');
  end if;
  if exists (select 1 from unnest(coalesce(p_dias, '{}'::smallint[])) d where d is null or d not between 1 and 7) then
    return jsonb_build_object('ok', false, 'porque', 'Los días van del lunes (1) al domingo (7).');
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_dias from unnest(coalesce(p_dias, '{}'::smallint[])) d;
  if cardinality(v_dias) = 7 then
    return jsonb_build_object('ok', false, 'porque', 'Con los 7 días de franco no trabajarías nunca: dejá al menos uno.');
  end if;
  update orden_personas set dias_libres = v_dias, franco_elegido = now() where id = p.id;
  return jsonb_build_object('ok', true, 'francos', to_jsonb(v_dias));
end $$;
revoke all on function nc_franco_elegir(smallint[]) from public, anon;
grant execute on function nc_franco_elegir(smallint[]) to authenticated;

-- 4. Config → Usuarios: igual que la 49, más 'falta_franco'.
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
                    /* SQL 183: todavía no eligió su franco (se lo pregunta la app al entrar). */
                    'falta_franco', orden_falta_franco(p),
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

-- 5. El alta, igual que la 43, más "Lo atendió" de su local.
create or replace function nc_usuario_crear(p_nombre text, p_apellido text, p_rol text, p_local uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja();
        v_nom text := orden_nombre_prolijo(p_nombre); v_ap text := orden_nombre_prolijo(p_apellido);
        v_local uuid := p_local; v_rol orden_rol; v_id uuid;
begin
  if yo.id is null then return jsonb_build_object('ok', false, 'porque', 'Tu usuario no puede crear usuarios.'); end if;
  if coalesce(p_rol, '') not in ('vendedor', 'supervisor', 'atencion', 'admin', 'gerencia') then
    return jsonb_build_object('ok', false, 'porque', 'Elegí el rol.');
  end if;
  v_rol := p_rol::orden_rol;
  if yo.rol = 'supervisor' then
    if v_rol <> 'vendedor' then
      return jsonb_build_object('ok', false, 'porque', 'Como encargado podés crear vendedores de tu local. Los otros roles los crea el administrador.');
    end if;
    v_local := yo.local_id;
  end if;
  /* Atención y Administración no son de un local. La gerencia puede tenerlo o no.
     SQL 141: el supervisor tampoco, si es de varios locales (el encargado sí tiene el suyo). */
  if p_rol in ('atencion', 'admin') then v_local := null; end if;
  if v_rol = 'vendedor' and v_local is null then
    return jsonb_build_object('ok', false, 'porque', 'Elegí el local.');
  end if;
  if v_local is not null and not exists (select 1 from orden_locales where id = v_local and activo) then
    return jsonb_build_object('ok', false, 'porque', 'Ese local no está en la lista.');
  end if;
  if v_nom is null then return jsonb_build_object('ok', false, 'porque', 'Revisá el nombre: sólo letras, de 2 a 30.'); end if;
  if v_ap is null then return jsonb_build_object('ok', false, 'porque', 'Revisá el apellido: sólo letras, de 2 a 30.'); end if;
  if exists (select 1 from orden_personas where local_id is not distinct from v_local
              and lower(nombre) = lower(v_nom) and lower(coalesce(apellido, '')) = lower(v_ap)) then
    return jsonb_build_object('ok', false, 'porque',
      case when exists (select 1 from orden_personas where local_id is not distinct from v_local and not activo
                          and lower(nombre) = lower(v_nom) and lower(coalesce(apellido, '')) = lower(v_ap))
           then v_nom || ' ' || v_ap || ' ya está, desactivado: ' ||
                case when yo.rol = 'admin' then 'buscalo en la lista (Ver desactivados) y reactivalo.'
                     else 'pedile al administrador que lo reactive.' end
           else v_nom || ' ' || v_ap || ' ya está en la lista.' end);
  end if;

  /* Aprobado de entrada (no espera nada todavía): cuando cree su PIN,
     orden_login_probar lo pasa a "esperando" y le avisa a quien lo aprueba. */
  insert into orden_personas (nombre, apellido, inicial, rol, local_id, aprobado, alta_propia)
  values (v_nom, v_ap, left(v_ap, 1), v_rol, v_local, true, false)
  returning id into v_id;
  /* Sin PIN todavía: con la fila vacía aparece en la lista para crearlo. */
  insert into orden_pins (persona_id, hash) values (v_id, null) on conflict (persona_id) do nothing;
  /* SQL 183: ya en "Lo atendió" de su local (sin local, no hace nada). */
  perform nc_equipo_poner(v_id);
  return jsonb_build_object('ok', true, 'id', v_id, 'lista', orden_nombre_lista(v_nom, left(v_ap, 1)));
end $$;

-- 6. Ventas, desde noviembre: el renglón que entra sin persona se vincula con su usuario.
/** "Sole  Lescano" = "sole lescano"; "Núñez" = "nunez". */
create or replace function orden_nombre_comparable(t text)
returns text language sql immutable as $$
  select lower(regexp_replace(translate(btrim(coalesce(t, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '\s+', ' ', 'g'))
$$;

create or replace function ventas_vendedor_vincular()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nom text := orden_nombre_comparable(new.nombre); v_ids uuid[];
begin
  if new.persona_id is not null or new.mes < date '2026-11-01' or v_nom = '' then return new; end if;
  /* Primero, uno solo de ese local con ese nombre y apellido. */
  select array_agg(p.id) into v_ids from orden_personas p
   where p.activo and p.local_id = new.local_id and p.rol in ('vendedor', 'supervisor')
     and orden_nombre_comparable(p.nombre || ' ' || coalesce(p.apellido, '')) = v_nom;
  /* Si no hay, el que cubre: uno solo en toda la empresa (Sole de Flores en Villa del Parque). */
  if coalesce(cardinality(v_ids), 0) = 0 then
    select array_agg(p.id) into v_ids from orden_personas p
     where p.activo and p.local_id is not null and p.rol in ('vendedor', 'supervisor')
       and orden_nombre_comparable(p.nombre || ' ' || coalesce(p.apellido, '')) = v_nom;
  end if;
  if cardinality(v_ids) = 1 and not exists (select 1 from ventas_vendedores v
                                              where v.local_id = new.local_id and v.mes = new.mes and v.persona_id = v_ids[1]) then
    new.persona_id := v_ids[1];
  end if;
  return new;
end $$;
revoke all on function ventas_vendedor_vincular() from public, anon, authenticated;

drop trigger if exists ventas_vendedores_vincular on ventas_vendedores;
create trigger ventas_vendedores_vincular before insert on ventas_vendedores
  for each row execute function ventas_vendedor_vincular();
