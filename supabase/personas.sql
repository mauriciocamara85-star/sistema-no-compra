-- VDH · Sistema No Compra — un usuario por persona (13/10/2026).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LA MISMA GENTE QUE IMPECABLE
-- ══════════════════════════════════════════════════════════════════════════
--
-- Cada persona entra con su local, su nombre y su PIN, como en BlueSoft. No
-- es una lista nueva: es la de Impecable (orden_personas, con su PIN en
-- orden_pins y su cuenta interna), así que quien entra en una entra en las
-- dos. Los roles del No Compra son los mismos con otro nombre:
--
--   vendedor   → Vendedor          supervisor → Encargado
--   atencion   → Atención al cliente (nuevo, SQL 100)
--   admin      → Administrador     gerencia   → Gerencia (ve como el admin)
--
-- Crear usuarios: el administrador, a cualquiera; el encargado, sólo
-- vendedores de su local. Quien recibe un usuario nuevo crea su PIN la
-- primera vez que entra, y ahí queda esperando el OK (lo pone la función de
-- Impecable, orden_login_probar): es lo que impide que alguien con el enlace
-- cree el PIN de otro. Aprobar o no es la misma orden_aprobar_persona.
--
-- Mientras dure la transición, el PIN compartido sigue cuidando el CRM,
-- Socios y el Club: entrar con el usuario identifica a la persona y le arma
-- la barra, pero no lo reemplaza (eso es la parte 3).
--
-- Correr el 100 y DESPUÉS el 101: un valor nuevo de un enum no se puede usar
-- en el mismo bloque en que se agrega.


-- ─────────────────────────── PARTE 100 (13/10/2026) ───────────────────────────
alter type orden_rol add value if not exists 'atencion';

select 'listo: el rol Atención al cliente (SQL 100)' as "SQL 100";


-- ─────────────────────────── PARTE 101 (13/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · USUARIOS POR PERSONA
--
--   1. Cada No Compra guarda quién lo cargó (cargado_por), además del
--      vendedor que atendió. Lo pone la base con la sesión de quien entró,
--      nunca la pantalla. Sin sesión (o con alguien todavía sin aprobar)
--      queda vacío, como hasta hoy: la carga no se frena por eso.
--   2. La lista para entrar: los locales y la gente de cada uno, también
--      Atención (que no entra a Impecable, pero sí acá).
--   3. Quién soy: rol, local y el nombre con que figura en la Carga.
--   4. Usuarios: verlos, crearlos, cambiarles rol o local, borrarles el PIN
--      y desactivarlos. El administrador, a todos; el encargado, sólo a los
--      vendedores de su local, y sin tocar rol ni local.
--
-- Para deshacerlo: cargar_registro vuelve a la versión de antes con la de
-- supabase/funciones.sql; las funciones nc_* se pueden borrar (drop
-- function) y la columna cargado_por puede quedar (vacía no molesta).
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. Quién cargó cada No Compra ═════════════════════════════════════ */
alter table registros add column if not exists cargado_por uuid references orden_personas(id) on delete set null;

create or replace function cargar_registro(p_sucursal text, p_vendedor text, p_whatsapp text,
  p_nombre text default null, p_mail text default null, p_producto text default null,
  p_talle text default null, p_obs text default null, p_motivo text default null,
  p_producto_codigo text default null, p_color text default null)
returns table(id bigint, creado timestamp with time zone)
language plpgsql security definer set search_path to 'public' as $function$
declare
  nuevo_id bigint;
  cuando   timestamptz;
begin
  /* La validación vive acá y no en la política de la tabla porque una
     función SECURITY DEFINER se saltea las políticas por definición. La
     política sigue puesta igual, para el caso de que algún día algo inserte
     directo. */
  if length(trim(coalesce(p_sucursal, ''))) = 0 then
    raise exception 'Falta la sucursal.';
  end if;
  if length(trim(coalesce(p_vendedor, ''))) = 0 then
    raise exception 'Falta el vendedor.';
  end if;
  if length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')) < 8 then
    raise exception 'Falta el WhatsApp del cliente.';
  end if;

  /* SQL 101: quién lo cargó sale de la sesión (orden_yo_id: activo y
     aprobado). Sin sesión, o de alguien sin aprobar, queda vacío y se
     guarda igual: mientras dure la transición la Carga anda sin usuario, y
     frenarla acá sólo haría perder el cliente. */
  insert into registros (sucursal, vendedor, whatsapp, nombre, mail, producto,
                         talle, obs, motivo, producto_codigo, color, cargado_por)
  values (trim(p_sucursal), trim(p_vendedor), p_whatsapp, p_nombre, p_mail,
          p_producto, p_talle, p_obs,
          nullif(p_motivo, '')::motivo_no_compra,
          nullif(trim(coalesce(p_producto_codigo, '')), ''),
          nullif(trim(coalesce(p_color, '')), ''),
          orden_yo_id())
  returning registros.id, registros.creado into nuevo_id, cuando;

  /* El nombre entra en la lista del local. Si ya estaba —activo o no— no se
     toca: reactivar en silencio a alguien que el encargado desactivó a
     propósito sería deshacerle la decisión sin avisarle. */
  insert into equipo (local, vendedor, por)
  values (trim(p_sucursal), trim(p_vendedor), trim(p_vendedor) || ' (desde la carga)')
  on conflict do nothing;

  return query select nuevo_id, cuando;
end;
$function$;

/* ═══ 2. La lista para entrar (sin sesión) ═══════════════════════════════
   Las mismas que las de Impecable, pero propias: Impecable va a esconder a
   Atención de la suya, y acá tiene que estar. Devuelven lo mismo que las de
   Impecable y nada más (ni el PIN ni la cuenta: es una lista pública). Los
   locales suman su código, el del No Compra ('MAR DEL PLATA'), para abrir
   directo en el local de este aparato. */
create or replace function nc_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo) order by l.nombre)
                     from orden_locales l where l.activo), '[]'::jsonb)
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and p.local_id is null)
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Administración', 'codigo', null)) else '[]'::jsonb end
$$;

create or replace function nc_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

/* ═══ 3. Quién soy ════════════════════════════════════════════════════════
   Lo pide cada pantalla al abrir: el rol pudo cambiar desde que entró.
   "vendedor" es el nombre con que figura en la Carga (su fila de equipo),
   o el de la lista si todavía no tiene una. Null si la sesión no es de
   nadie de la lista. */
create or replace function nc_yo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado)
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$$;

/* ═══ 4. Usuarios ═════════════════════════════════════════════════════════
   Quién puede: el administrador (a todos) y el encargado (a los vendedores
   de su local). Activo y aprobado, siempre: un PIN recién creado no manda. */
create or replace function nc_quien_maneja()
returns orden_personas language sql stable security definer set search_path = public as $$
  select * from orden_personas
   where auth_user_id = auth.uid() and auth.uid() is not null and activo and aprobado
     and (rol = 'admin' or (rol = 'supervisor' and local_id is not null))
   limit 1
$$;

/* ¿Puede "yo" tocar a "p"? El admin a cualquiera; el encargado, a los
   vendedores de su local. */
create or replace function nc_puede_tocar(yo orden_personas, p orden_personas)
returns boolean language sql immutable as $$
  select yo.id is not null and (yo.rol = 'admin' or (yo.rol = 'supervisor' and p.rol = 'vendedor' and p.local_id = yo.local_id))
$$;

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
                    /* El estado del PIN, sin el PIN: si está en la lista para entrar,
                       si ya lo creó y si ya entró alguna vez. */
                    'en_lista', k.persona_id is not null, 'pin', k.hash is not null,
                    'entro', p.auth_user_id is not null,
                    'creado', p.creado_en, 'soy', p.id = yo.id)
                  order by p.activo desc, p.nombre, p.apellido), '[]'::jsonb)
                   from orden_personas p left join orden_pins k on k.persona_id = p.id
                  where v_admin or p.id = yo.id or (p.local_id = yo.local_id and p.rol = 'vendedor')));
end $$;

create or replace function nc_usuario_crear(p_nombre text, p_apellido text, p_rol text, p_local uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
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
  /* Atención y Administración no son de un local. La gerencia puede tenerlo o no. */
  if p_rol in ('atencion', 'admin') then v_local := null; end if;
  if v_rol in ('vendedor', 'supervisor') and v_local is null then
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
           then v_nom || ' ' || v_ap || ' ya está, desactivado: buscalo en la lista y reactivalo.'
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

/* La fila de la Carga de un vendedor con local: la suya, o una nueva (como
   cuando lo aprueban). Activa, porque si no, no aparece en el desplegable. */
create or replace function nc_equipo_poner(p_persona uuid)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare p orden_personas; l orden_locales; v_lista text; v_eq bigint;
begin
  select * into p from orden_personas where id = p_persona;
  select * into l from orden_locales where id = p.local_id;
  if l.codigo is null then return null; end if;
  v_lista := orden_nombre_lista(p.nombre, p.inicial);
  insert into equipo (local, vendedor, por) values (l.codigo, v_lista, v_lista || ' (desde Usuarios)')
  on conflict do nothing;
  select id into v_eq from equipo where lower(trim(local)) = lower(l.codigo) and lower(trim(vendedor)) = lower(v_lista)
   order by activo desc, id limit 1;
  if v_eq is not null then
    update equipo set activo = true where id = v_eq and not activo;
    update orden_personas set equipo_id = v_eq where id = p.id;
  end if;
  return v_eq;
end $$;

/* Cambiar el rol o el local: sólo el administrador. */
create or replace function nc_usuario_cambiar(p_persona uuid, p_rol text, p_local uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
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
  if v_rol in ('vendedor', 'supervisor') and v_local is null then
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
  if p.rol = 'vendedor' and p.local_id is not null and p.aprobado and p.activo and p.equipo_id is null then
    perform nc_equipo_poner(p.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

/* Desactivar o reactivar. Desactivado no entra ni en el No Compra ni en
   Impecable, sale del desplegable de la Carga y se le cierran las sesiones
   abiertas. Reactivado entra con el mismo PIN. */
create or replace function nc_usuario_activar(p_persona uuid, p_activo boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas;
begin
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if not coalesce(nc_puede_tocar(yo, p), false) then
    return jsonb_build_object('ok', false, 'porque', 'No podés cambiar a esta persona.');
  end if;
  if p.id = yo.id then return jsonb_build_object('ok', false, 'porque', 'No podés desactivarte a vos mismo.'); end if;
  if p_activo is null or p.activo = p_activo then return jsonb_build_object('ok', true); end if;

  update orden_personas set activo = p_activo where id = p.id;
  if p.equipo_id is not null then
    update equipo set activo = p_activo where id = p.equipo_id;
  elsif p_activo and p.rol = 'vendedor' and p.aprobado then
    perform nc_equipo_poner(p.id);
  end if;
  if not p_activo then perform orden_borrar_cuenta_interna(p.id); end if;
  return jsonb_build_object('ok', true);
end $$;

/* Borrar el PIN: la próxima vez que entre crea uno nuevo (y hay que volver
   a aprobarlo). Lo mismo que orden_pin_borrar (SQL 97), pero también para
   el encargado con los vendedores de su local. */
create or replace function nc_usuario_pin_borrar(p_persona uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas;
begin
  select * into p from orden_personas where id = p_persona;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if not coalesce(nc_puede_tocar(yo, p), false) then
    return jsonb_build_object('ok', false, 'porque', 'No podés borrarle el PIN a esta persona.');
  end if;
  if p.id = yo.id then
    return jsonb_build_object('ok', false, 'porque', 'Tu propio PIN te lo borra otro administrador.');
  end if;
  insert into orden_pins (persona_id, hash) values (p.id, null)
  on conflict (persona_id) do update set hash = null, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
  /* Y la cuenta: si no, quien había creado ese PIN seguía con su sesión. */
  perform orden_borrar_cuenta_interna(p.id);
  return jsonb_build_object('ok', true);
end $$;

/* ═══ Permisos ═══════════════════════════════════════════════════════════ */
do $$
begin
  revoke all on function nc_login_locales() from public;
  revoke all on function nc_login_personas(uuid) from public;
  revoke all on function nc_yo() from public, anon;
  revoke all on function nc_quien_maneja() from public, anon, authenticated;
  revoke all on function nc_puede_tocar(orden_personas, orden_personas) from public, anon, authenticated;
  revoke all on function nc_usuarios() from public, anon;
  revoke all on function nc_usuario_crear(text, text, text, uuid) from public, anon;
  revoke all on function nc_equipo_poner(uuid) from public, anon, authenticated;
  revoke all on function nc_usuario_cambiar(uuid, text, uuid) from public, anon;
  revoke all on function nc_usuario_activar(uuid, boolean) from public, anon;
  revoke all on function nc_usuario_pin_borrar(uuid) from public, anon;
  grant execute on function nc_login_locales() to anon, authenticated;
  grant execute on function nc_login_personas(uuid) to anon, authenticated;
  grant execute on function nc_yo() to authenticated;
  grant execute on function nc_usuarios() to authenticated;
  grant execute on function nc_usuario_crear(text, text, text, uuid) to authenticated;
  grant execute on function nc_usuario_cambiar(uuid, text, uuid) to authenticated;
  grant execute on function nc_usuario_activar(uuid, boolean) to authenticated;
  grant execute on function nc_usuario_pin_borrar(uuid) to authenticated;
end $$;

select 'listo: usuarios por persona (SQL 101)' as "SQL 101";
