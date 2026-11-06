/* ─── SQL 257 (6/11/2026) · LA GENTE DE LA FÁBRICA ───
   Mauricio (6/11): la persona de la fábrica (trabaja en el depósito, no en un local) necesita su usuario. "En vez de
   local, pueda elegir fábrica"; ve Fábrica y el Asistente ("después vemos si le agregamos algo más").
   1. Config → Usuarios: al crear (o cambiar) un Vendedor, el local puede ser «Fábrica». Queda vendedor SIN local y con
      «Entra a Fábrica» prendida (SQL 256). Lo hace sólo el administrador. La pantalla manda el rol 'fabrica'.
   2. Para entrar, «Fábrica» es un grupo como E-commerce y Administración (nc_login_locales / nc_login_personas); la
      compu de la fábrica: index.html?inicio-compu=fabrica. Ya no aparece entre los de Administración, ni entre los
      «Administrador» de Equipo VDH.
   3. Lo que ve (sólo Fábrica y el Asistente) lo decide la pantalla (persona.js, no-compra-v388). Lo que puede hacer en
      la base es lo de «Entra a Fábrica» (SQL 256): no tiene el POS, ni ventas, ni caja, ni plata.
   Cambia 6 funciones (create or replace: los permisos de cada una quedan como estaban). No toca datos.
   Para deshacer: deshacer-257.sql. */

CREATE OR REPLACE FUNCTION public.nc_usuario_crear(p_nombre text, p_apellido text, p_rol text, p_local uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo orden_personas := nc_quien_maneja();
        v_nom text := orden_nombre_prolijo(p_nombre); v_ap text := orden_nombre_prolijo(p_apellido);
        v_local uuid := p_local; v_rol orden_rol; v_id uuid;
        v_fab boolean := false;   -- SQL 257: de la Fábrica
begin
  if yo.id is null then return jsonb_build_object('ok', false, 'porque', 'Tu usuario no puede crear usuarios.'); end if;
  /* SQL 257 (6/11/2026): «Fábrica» en vez de un local, para la gente de la fábrica (Mauricio: "en vez de local, pueda
     elegir fábrica"). Es un vendedor sin local, con «Entra a Fábrica» prendida: ve sólo Fábrica y el Asistente. */
  if p_rol = 'fabrica' then
    if yo.rol <> 'admin' then
      return jsonb_build_object('ok', false, 'porque', 'A la gente de la Fábrica la crea el administrador.');
    end if;
    v_fab := true; p_rol := 'vendedor'; v_local := null;
  end if;
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
  if v_rol = 'vendedor' and v_local is null and not v_fab then
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
  /* SQL 257: la de la Fábrica arranca con «Entra a Fábrica» prendida (se puede apagar en Cambiar). */
  if v_fab then
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en)
    values (v_id, '{"fabrica": true}'::jsonb, yo.id, now())
    on conflict (persona_id) do update
      set cambios = pos_permisos.cambios || '{"fabrica": true}'::jsonb, cambiado_por = yo.id, cambiado_en = now();
  end if;
  /* SQL 183: ya en "Lo atendió" de su local (sin local, no hace nada). */
  perform nc_equipo_poner(v_id);
  return jsonb_build_object('ok', true, 'id', v_id, 'lista', orden_nombre_lista(v_nom, left(v_ap, 1)), 'fabrica', v_fab);
end $function$;

CREATE OR REPLACE FUNCTION public.nc_usuario_cambiar(p_persona uuid, p_rol text, p_local uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo orden_personas := nc_quien_maneja(); p orden_personas; v_rol orden_rol; v_local uuid := p_local;
        v_fab boolean := false; v_era_fab boolean;   -- SQL 257: de la Fábrica
begin
  if yo.id is null or yo.rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'El rol y el local los cambia el administrador.');
  end if;
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  /* SQL 257: «Fábrica» en vez de un local = vendedor sin local (la gente de la fábrica). */
  v_era_fab := p.rol = 'vendedor' and p.local_id is null;
  if p_rol = 'fabrica' then v_fab := true; p_rol := 'vendedor'; v_local := null; end if;
  if coalesce(p_rol, '') not in ('vendedor', 'supervisor', 'atencion', 'admin', 'gerencia') then
    return jsonb_build_object('ok', false, 'porque', 'Elegí el rol.');
  end if;
  v_rol := p_rol::orden_rol;
  if p.id = yo.id and v_rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'No podés sacarte a vos mismo el rol de administrador: pedíselo a otro administrador.');
  end if;
  if p_rol in ('atencion', 'admin') then v_local := null; end if;
  /* SQL 141: el supervisor sin local es el de varios locales (los suyos van con nc_usuario_locales). */
  if v_rol = 'vendedor' and v_local is null and not v_fab then
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
  /* SQL 257: al pasar a la Fábrica, «Entra a Fábrica» prendida. */
  if v_fab and not v_era_fab then
    insert into pos_permisos (persona_id, cambios, cambiado_por, cambiado_en)
    values (p.id, '{"fabrica": true}'::jsonb, yo.id, now())
    on conflict (persona_id) do update
      set cambios = pos_permisos.cambios || '{"fabrica": true}'::jsonb, cambiado_por = yo.id, cambiado_en = now();
  end if;
  /* SQL 141: si deja de ser supervisor de varios locales, sus locales se borran. */
  if not (p.rol = 'supervisor' and p.local_id is null) then
    delete from orden_supervision where persona_id = p.id;
  end if;
  if p.rol = 'vendedor' and p.local_id is not null and p.aprobado and p.activo and p.equipo_id is null then
    perform nc_equipo_poner(p.id);
  end if;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.nc_usuarios()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo orden_personas := nc_quien_maneja(); v_admin boolean;
begin
  if yo.id is null then
    return jsonb_build_object('error', 'permiso', 'porque', 'Tu usuario no maneja usuarios: lo hacen el administrador y los encargados.');
  end if;
  v_admin := yo.rol = 'admin';
  return jsonb_build_object(
    'yo', jsonb_build_object('id', yo.id, 'rol', yo.rol, 'local_id', yo.local_id),
    /* SQL 257: se puede elegir «Fábrica» en vez de un local (la gente de la fábrica). */
    'fabrica', true,
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
end $function$;

CREATE OR REPLACE FUNCTION public.nc_login_personas(p_local uuid DEFAULT NULL::uuid, p_grupo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol, p.tambien_atencion) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and case
    when p_local is not null then
      p.local_id = p_local
      -- SQL 121: en un local, también sus supervisores de varios locales (aprobados para ese local).
      or (p.local_id is null and p.rol = 'supervisor' and p.aprobado
          and exists (select 1 from orden_supervision s where s.persona_id = p.id and s.local_id = p_local and s.aprobado))
    -- SQL 148: "E-commerce" = Atención al cliente, y el vendedor con la casilla (SQL 135).
    when p_grupo = 'atencion' then
      (p.local_id is null and p.rol = 'atencion') or (p.local_id is not null and p.tambien_atencion and p.aprobado)
    -- SQL 257: "Fábrica" = la gente de la fábrica (vendedor sin local).
    when p_grupo = 'fabrica' then
      p.local_id is null and p.rol = 'vendedor'
    -- SQL 148: "Administración" = los demás sin local (administradores, Gerencia, supervisores de varios locales).
    when p_grupo = 'oficina' then
      p.local_id is null and p.rol not in ('atencion', 'vendedor')   -- SQL 257: sin la gente de la Fábrica
    -- Sin grupo (la pantalla de antes del 148): todos los sin local, y el vendedor con la casilla.
    else
      p.local_id is null or (p.tambien_atencion and p.aprobado)
  end
$function$;

CREATE OR REPLACE FUNCTION public.nc_login_locales()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo) order by l.nombre)
                     from orden_locales l where l.activo), '[]'::jsonb)
      -- SQL 148: Atención al cliente entra por "E-commerce", como si fuera un local.
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and ((p.local_id is null and p.rol = 'atencion')
                                                or (p.local_id is not null and p.tambien_atencion and p.aprobado)))
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'E-commerce', 'codigo', 'ECOMMERCE', 'grupo', 'atencion'))
              else '[]'::jsonb end
      /* SQL 257: "Fábrica", la gente de la fábrica (vendedor sin local); su compu: index.html?inicio-compu=fabrica. */
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and p.local_id is null and p.rol = 'vendedor')
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Fábrica', 'codigo', 'FABRICA', 'grupo', 'fabrica'))
              else '[]'::jsonb end
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and p.local_id is null and p.rol not in ('atencion', 'vendedor'))
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Administración', 'codigo', null, 'grupo', 'oficina'))
              else '[]'::jsonb end
$function$;

CREATE OR REPLACE FUNCTION public.orden_login_personas(p_local uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               /* El que ya tiene PIN, con los números con que lo creó; el que lo va a crear, los de su rol. */
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol, p.tambien_atencion) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local and p.rol::text <> 'atencion'
    -- SQL 257: la gente de la Fábrica (vendedor sin local) no usa Equipo VDH: no sale con los «Administrador».
    and not (p.local_id is null and p.rol = 'vendedor')
$function$;

/* Quedó así: las entradas que no son locales, y quién es de la Fábrica. */
select x->>'nombre' entrada, x->>'grupo' grupo from jsonb_array_elements(nc_login_locales()) x where x->>'id' is null;
select orden_nombre_lista(p.nombre, p.inicial) persona, pos_puede_persona(p, 'fabrica') entra_a_fabrica
  from orden_personas p where p.activo and p.rol = 'vendedor' and p.local_id is null order by 1;
