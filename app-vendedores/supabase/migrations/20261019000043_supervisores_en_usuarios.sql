-- =====================================================================
-- Módulo VDH · Migración 43 (SQL 141), 19/10/2026: el supervisor de
-- varios locales, desde Usuarios.
--
-- Pedido de Mauricio (19/10): "si son supervisores, está bueno que cada
-- uno pueda ver sus locales… Brenda Núñez es supervisora, y que tenga para
-- elegir varios locales… le van a aparecer las planillas de sus tres
-- locales".
--
-- El supervisor de varios locales ya existe (SQL 120): rol 'supervisor'
-- sin local fijo, con sus locales en orden_supervision. Hasta ahora los
-- elegía él desde la app y Mauricio los aprobaba; en Usuarios de la compu
-- no aparecía (decía "Encargado" y pedía un local). Ahora:
-- 1. nc_usuario_crear y nc_usuario_cambiar dejan un supervisor sin local
--    (el encargado sigue con su local). Si alguien deja de ser supervisor
--    de varios locales, sus locales se borran.
-- 2. nc_usuario_locales (nueva, sólo el administrador): le pone los locales
--    al supervisor, ya aprobados. Si ya entró a la app, le llega el aviso.
-- 3. nc_usuarios: trae los locales de cada supervisor, para la lista.
-- 4. nc_yo: trae los locales del supervisor ('zona'), para que Estadísticas
--    le muestre sólo los suyos.
-- 5. Los locales que dictó Mauricio, ya aprobados:
--    Franco: Unicenter, Grand Bourg y Pacheco. Nico: Parque Brown y Lomas
--    de Zamora. Brenda: Flores, Morón e Ituzaingó. Cintia: San Justo
--    Shopping y San Justo.
--
-- Con eso, cada uno ve en Ventas las planillas de sus locales (ventas_acceso
-- ya miraba orden_supervision) y en Equipo VDH sus locales.
--
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

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
  return jsonb_build_object('ok', true, 'id', v_id, 'lista', orden_nombre_lista(v_nom, left(v_ap, 1)));
end $$;

create or replace function nc_usuario_cambiar(p_persona uuid, p_rol text, p_local uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas; v_rol orden_rol; v_local uuid := p_local;
begin
  if yo.id is null or yo.rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'El rol y el local los cambia el administrador.');
  end if;
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if coalesce(p_rol, '') not in ('vendedor', 'supervisor', 'atencion', 'admin', 'gerencia') then
    return jsonb_build_object('ok', false, 'porque', 'Elegí el rol.');
  end if;
  v_rol := p_rol::orden_rol;
  if p.id = yo.id and v_rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'No podés sacarte a vos mismo el rol de administrador: pedíselo a otro administrador.');
  end if;
  if p_rol in ('atencion', 'admin') then v_local := null; end if;
  /* SQL 141: el supervisor sin local es el de varios locales (los suyos van con nc_usuario_locales). */
  if v_rol = 'vendedor' and v_local is null then
    return jsonb_build_object('ok', false, 'porque', 'Elegí el local.');
  end if;
  if v_local is not null and not exists (select 1 from orden_locales where id = v_local and activo) then
    return jsonb_build_object('ok', false, 'porque', 'Ese local no está en la lista.');
  end if;

  /* Si se muda de local, su fila de la Carga se va con él: la vieja deja
     de aparecer en el otro local y la nueva se crea (o se reactiva). */
  if v_local is distinct from p.local_id and p.equipo_id is not null then
    update equipo set activo = false where id = p.equipo_id;
    update orden_personas set equipo_id = null where id = p.id;
  end if;
  update orden_personas set rol = v_rol, local_id = v_local where id = p.id returning * into p;
  /* SQL 141: si deja de ser supervisor de varios locales, sus locales se borran. */
  if not (p.rol = 'supervisor' and p.local_id is null) then
    delete from orden_supervision where persona_id = p.id;
  end if;
  if p.rol = 'vendedor' and p.local_id is not null and p.aprobado and p.activo and p.equipo_id is null then
    perform nc_equipo_poner(p.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Los locales de un supervisor de varios locales (SQL 141): los pone el administrador, ya aprobados. */
create or replace function nc_usuario_locales(p_persona uuid, p_locales uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas; v_lista uuid[]; v_nuevos text; v_todos text;
begin
  if yo.id is null or yo.rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'Los locales de un supervisor los elige el administrador.');
  end if;
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if p.rol <> 'supervisor' or p.local_id is not null then
    return jsonb_build_object('ok', false, 'porque', 'Los locales se eligen para un supervisor de varios locales (sin local fijo).');
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_lista from unnest(coalesce(p_locales, '{}'::uuid[])) x;
  if exists (select 1 from unnest(v_lista) x where not exists (select 1 from orden_locales l where l.id = x and l.activo)) then
    return jsonb_build_object('ok', false, 'porque', 'Uno de esos locales no está en la lista.');
  end if;
  delete from orden_supervision where persona_id = p.id and not (local_id = any (v_lista));
  with n as (
    insert into orden_supervision (persona_id, local_id, aprobado, aprobado_en, aprobado_por)
    select p.id, x, true, now(), yo.id from unnest(v_lista) x
    on conflict (persona_id, local_id) do update set aprobado = true, aprobado_en = now(), aprobado_por = yo.id
     where not orden_supervision.aprobado
    returning local_id)
  select string_agg(l.nombre, ', ' order by l.nombre) into v_nuevos from n join orden_locales l on l.id = n.local_id;
  /* Si ya usa la app, le avisa (como cuando se aprueba lo que pidió). */
  if v_nuevos is not null and p.auth_user_id is not null and p.activo then
    perform orden_encolar_aviso(p.id, 'supervision_aprobada', 'Ya podés ver ' || v_nuevos,
      'Entrá a Equipo VDH: el local se elige arriba de cada pantalla.', '/revisar',
      'supervision-ok:' || p.id || ':' || md5(v_nuevos) || ':' || floor(extract(epoch from now())), 2::smallint);
  end if;
  select string_agg(l.nombre, ', ' order by l.nombre) into v_todos
    from orden_supervision s join orden_locales l on l.id = s.local_id where s.persona_id = p.id;
  return jsonb_build_object('ok', true, 'locales', coalesce(v_todos, ''));
end $$;
revoke all on function nc_usuario_locales(uuid, uuid[]) from public, anon;
grant execute on function nc_usuario_locales(uuid, uuid[]) to authenticated;

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

create or replace function nc_yo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
           /* SQL 141: los locales del supervisor de varios locales (los aprobados). */
           'zona', case when p.rol = 'supervisor' and p.local_id is null then
                     coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'codigo', z.codigo, 'nombre', z.nombre) order by z.nombre)
                                 from orden_supervision s join orden_locales z on z.id = s.local_id
                                where s.persona_id = p.id and s.aprobado and z.activo), '[]'::jsonb) end,
           /* Su PIN tiene menos números de los que pide su rol (SQL 110): lo
              de la oficina no abre hasta cambiarlo. */
           'pin_corto', k.hash is not null and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
    left join orden_pins k on k.persona_id = p.id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$$;

/* Los locales que dictó Mauricio (14/10 y 19/10), ya aprobados por él. */
insert into orden_supervision (persona_id, local_id, aprobado, aprobado_en, aprobado_por)
select v.persona::uuid, l.id, true, now(), '71c210ff-2811-4f34-a2b7-2f4e85e77a77'::uuid
  from (values ('1075f317-c119-432d-a2a1-ae85fb3951a1', 'UNICENTER'),          -- Franco Ortiz
               ('1075f317-c119-432d-a2a1-ae85fb3951a1', 'GRAND BOURG'),
               ('1075f317-c119-432d-a2a1-ae85fb3951a1', 'PACHECO'),
               ('63861409-e838-4b43-9e7d-247e8466548f', 'PARQUE BROWN'),       -- Nicolás Segovia
               ('63861409-e838-4b43-9e7d-247e8466548f', 'LOMAS DE ZAMORA'),
               ('0ada5145-305c-4b1a-8a6b-a2e925cf7fc2', 'FLORES'),             -- Brenda Núñez
               ('0ada5145-305c-4b1a-8a6b-a2e925cf7fc2', 'MORÓN'),
               ('0ada5145-305c-4b1a-8a6b-a2e925cf7fc2', 'ITUZAINGÓ'),
               ('53166500-df75-44bc-91ef-3069075bf960', 'SAN JUSTO SHOPPING'), -- Cintia
               ('53166500-df75-44bc-91ef-3069075bf960', 'SAN JUSTO')) as v(persona, codigo)
  join orden_locales l on l.codigo = v.codigo and l.activo
  join orden_personas p on p.id = v.persona::uuid and p.rol = 'supervisor' and p.local_id is null
on conflict (persona_id, local_id) do update set aprobado = true, aprobado_en = now(), aprobado_por = excluded.aprobado_por
 where not orden_supervision.aprobado;

-- Chequeo: cada supervisor con sus locales (tienen que ser 4 renglones, como arriba).
select orden_nombre_lista(p.nombre, p.inicial) as supervisor,
       string_agg(l.nombre, ', ' order by l.nombre) as sus_locales
  from orden_personas p
  join orden_supervision s on s.persona_id = p.id and s.aprobado
  join orden_locales l on l.id = s.local_id
 where p.rol = 'supervisor' and p.local_id is null and p.activo
 group by p.id, p.nombre, p.inicial
 order by 1;

-- ---------------------------------------------------------------------
-- Vuelta atrás: sacarles los locales alcanza (las funciones nuevas no
-- cambian nada para los demás roles):
--
-- delete from orden_supervision where persona_id in ('1075f317-c119-432d-a2a1-ae85fb3951a1',
--   '63861409-e838-4b43-9e7d-247e8466548f', '0ada5145-305c-4b1a-8a6b-a2e925cf7fc2',
--   '53166500-df75-44bc-91ef-3069075bf960');
--
-- Para volver las funciones a como estaban, pedíselo a Claude, que arma
-- ese SQL aparte.
-- ---------------------------------------------------------------------
