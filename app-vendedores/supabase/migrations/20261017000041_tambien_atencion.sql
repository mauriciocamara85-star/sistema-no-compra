-- =====================================================================
-- Módulo VDH · Migración 41 (SQL 135), 17/10/2026: un vendedor (o un
-- encargado) que además atiende clientes.
--
-- Pedido de Mauricio (17/10): "puede ser que Lautaro Ruibal y Nahuel Arto
-- sean de atención al cliente y vendedores… tendría que poder tener los
-- permisos de vendedores y de atención".
--
-- Una sola persona con una casilla extra, en vez de dos usuarios:
-- 1. orden_personas.tambien_atencion: apagada para todos. La prende el
--    administrador (Ajustes → Personas, o Usuarios en la compu).
-- 2. Con la casilla, cuenta como de la oficina (CRM, Socios, el Club, Gift
--    Cards) igual que Atención al cliente, y su PIN pasa a ser de 6 números:
--    con el de 4 de antes, lo de la oficina no abre hasta cambiarlo (la
--    próxima vez que entre se lo pide, como en el SQL 110).
-- 3. Ventas: las planillas de todos los locales, como Atención (SQL 127).
-- 4. Entra por su local, como siempre, y también por "Atención y
--    administración" en la compu.
-- 5. Lo de su local (Equipo VDH, tareas, fotos, la caja) no cambia.
--
-- Funciones que se rehacen (iguales a las de hoy, más la casilla):
-- nc_persona_oficina, nc_yo, nc_login_personas, orden_login_personas,
-- orden_login_probar, orden_pin_cambiar, orden_pin_estado, ventas_acceso y
-- nc_usuarios. Nuevas: orden_pin_digitos(rol, casilla) y
-- nc_usuario_atencion (la casilla, sólo el administrador).
--
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

alter table orden_personas add column if not exists tambien_atencion boolean not null default false;
comment on column orden_personas.tambien_atencion is 'Vendedor o encargado que además es de Atención al cliente: entra a lo de la oficina con PIN de 6 (SQL 135).';

/** Cuántos números pide el PIN (SQL 110), contando la casilla de Atención (SQL 135). */
create or replace function orden_pin_digitos(p_rol orden_rol, p_atencion boolean)
returns integer language sql immutable set search_path = public as $$
  select case when coalesce(p_atencion, false) or p_rol::text in ('admin', 'atencion', 'gerencia') then 6 else 4 end
$$;
revoke all on function orden_pin_digitos(orden_rol, boolean) from public, anon;
grant execute on function orden_pin_digitos(orden_rol, boolean) to authenticated, service_role;

/** De la oficina: Administración, Atención, Gerencia, o un vendedor con la casilla (SQL 135); con el PIN de 6. */
create or replace function nc_persona_oficina(p_persona uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                  where p.id = p_persona and p.activo and p.aprobado
                    and (p.rol::text in ('admin', 'atencion', 'gerencia') or p.tambien_atencion)
                    and k.hash is not null and coalesce(k.digitos, 4) >= orden_pin_digitos(p.rol, p.tambien_atencion))
$$;

create or replace function nc_yo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado,
           /* SQL 135: además atiende clientes (lo de la oficina, como Atención). */
           'tambien_atencion', p.tambien_atencion,
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

create or replace function nc_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol, p.tambien_atencion) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and (p.local_id is not distinct from p_local
     -- SQL 121: en un local, también sus supervisores de varios locales (aprobados para ese local).
     or (p_local is not null and p.local_id is null and p.rol = 'supervisor' and p.aprobado
         and exists (select 1 from orden_supervision s where s.persona_id = p.id and s.local_id = p_local and s.aprobado))
     -- SQL 135: en "Atención y administración", también el vendedor que atiende clientes.
     or (p_local is null and p.local_id is not null and p.tambien_atencion and p.aprobado))
$$;

create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               /* El que ya tiene PIN, con los números con que lo creó; el que lo va a crear, los de su rol. */
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol, p.tambien_atencion) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local and p.rol::text <> 'atencion'
$$;

create or replace function orden_login_probar(p_persona uuid, p_pin text, p_apellido text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false; v_ap text; v_vend boolean;
        v_rol int; v_dig int; v_espera interval;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  -- SQL 135: con la casilla de Atención, 6 números.
  v_rol := orden_pin_digitos(p.rol, p.tambien_atencion);
  select * into k from orden_pins where persona_id = p.id for update;
  if not found then
    insert into orden_pins (persona_id, hash) values (p.id, null) returning * into k;
  end if;
  /* Con cuántos números se prueba: el que ya tiene PIN, con los de su PIN (los de antes, 4); el que lo crea, con los de su rol. */
  v_dig := case when k.hash is null then v_rol else coalesce(k.digitos, 4) end;

  if k.hash is null then
    if coalesce(p_pin, '') !~ ('^[0-9]{' || v_rol || '}$') then
      return jsonb_build_object('ok', false, 'crear', true, 'digitos', v_rol, 'porque', 'El PIN tiene que tener ' || v_rol || ' números.');
    end if;
    /* Al crear su PIN, el que no tenía apellido lo deja (si lo mandó y sirve).
       Se anota que lo puso al crear el PIN: si después resulta que no era él,
       se lo saca. */
    if nullif(trim(coalesce(p.apellido, '')), '') is null and p_apellido is not null then
      v_ap := orden_nombre_prolijo(p_apellido);
      if v_ap is null then
        return jsonb_build_object('ok', false, 'crear', true, 'porque', 'Revisá el apellido: sólo letras, de 2 a 30.');
      end if;
      update orden_personas set apellido = v_ap, inicial = left(v_ap, 1), apellido_por_pin = true where id = p.id returning * into p;
    end if;
    update orden_pins set hash = crypt(p_pin, gen_salt('bf', 8)), digitos = v_rol, fallos = 0, bloqueado_hasta = null,
                          nivel_freno = 0, cambiado_en = now()
     where persona_id = p.id returning * into k;
    v_dig := v_rol;
    v_creado := true;
    /* Crear el PIN no alcanza para entrar: cualquiera con el enlace podría
       crearlo en nombre de otro. Espera el OK de su supervisor o de un
       administrador. Un administrador también, salvo que no haya otro. */
    if p.rol <> 'admin'
       or exists (select 1 from orden_personas o where o.rol = 'admin' and o.activo and o.aprobado
                    and o.auth_user_id is not null and o.id <> p.id) then
      update orden_personas set aprobado = false where id = p.id returning * into p;
      v_vend := p.rol = 'vendedor';
      perform orden_avisar_responsables(p.local_id, case when v_vend then 'supervisores' else 'admins' end, 'alta_pendiente',
        orden_nombre_lista(p.nombre, p.inicial) || ' creó su PIN en ' || coalesce((select nombre from orden_locales where id = p.local_id), 'Equipo VDH'),
        case when v_vend
             then 'Confirmá en persona que fue quien lo creó y aprobalo en Equipo. Si no fue, tocá "No fue": se borra ese PIN.'
             else 'Confirmá en persona que fue quien lo creó y aprobalo en la administración (Ajustes → Personas). Si no fue, tocá "Borrar PIN".' end,
        case when v_vend then '/equipo' else '/perfil' end,
        'aprobar:' || p.id || ':' || floor(extract(epoch from now())), 2::smallint);
    else
      update orden_personas set aprobado = true where id = p.id returning * into p;
    end if;
  elsif k.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from k.bloqueado_hasta - now()))::int,
                              'porque', 'Pusiste mal el PIN muchas veces. Esperá ' || orden_texto_espera(k.bloqueado_hasta - now()) || ' y probá de nuevo.');
  elsif not (coalesce(p_pin, '') ~ ('^[0-9]{' || v_dig || '}$') and crypt(p_pin, k.hash) = k.hash) then
    if v_rol = 6 then
      /* Admin, Atención y gerencia (y el vendedor que atiende clientes): cada
         5 mal seguidos, más espera (5 min, 30 min, 24 h). A las 24 h se avisa
         a los administradores. */
      if k.fallos + 1 >= 5 then
        v_espera := case when k.nivel_freno = 0 then interval '5 minutes' when k.nivel_freno = 1 then interval '30 minutes' else interval '24 hours' end;
        update orden_pins set fallos = 0, nivel_freno = least(nivel_freno + 1, 3), bloqueado_hasta = now() + v_espera
         where persona_id = p.id returning * into k;
        if k.nivel_freno >= 3 then
          perform orden_avisar_responsables(null, 'admins', 'pin_probando',
            'Alguien está probando PINs de ' || orden_nombre_lista(p.nombre, p.inicial),
            'Pusieron mal su PIN muchas veces seguidas: quedó trabado 24 horas. Si no fue esa persona, borrale el PIN y que cree uno nuevo.',
            '/perfil', 'pin-probando:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24'), 2::smallint);
        end if;
        return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from v_espera))::int,
                                  'porque', 'Pusiste mal el PIN 5 veces. Esperá ' || orden_texto_espera(v_espera) || ' y probá de nuevo.');
      end if;
      update orden_pins set fallos = fallos + 1 where persona_id = p.id returning * into k;
      return jsonb_build_object('ok', false, 'restantes', 5 - k.fallos, 'porque', 'PIN incorrecto.');
    end if;
    -- PIN mal: se anota. Al 5.º seguido, 5 minutos de espera (y vuelve a contar de cero).
    update orden_pins
       set fallos = case when fallos + 1 >= 5 then 0 else fallos + 1 end,
           bloqueado_hasta = case when fallos + 1 >= 5 then now() + interval '5 minutes' end
     where persona_id = p.id
    returning * into k;
    if k.bloqueado_hasta is not null then
      return jsonb_build_object('ok', false, 'espera', 300,
                                'porque', 'Pusiste mal el PIN 5 veces. Esperá 5 minutos y probá de nuevo.');
    end if;
    return jsonb_build_object('ok', false, 'restantes', 5 - k.fallos, 'porque', 'PIN incorrecto.');
  end if;

  if not v_creado then
    update orden_pins set fallos = 0, bloqueado_hasta = null, nivel_freno = 0 where persona_id = p.id;
  end if;
  return jsonb_build_object('ok', true, 'creado', v_creado, 'persona_id', p.id, 'auth_user_id', p.auth_user_id,
                            'mail', orden_mail_cuenta(p.id), 'clave', k.clave_cuenta,
                            'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id, 'aprobado', p.aprobado,
                            /* Su PIN tiene menos números de los que pide su rol: la app le pide uno nuevo ya. */
                            'cambiar_pin', v_dig < v_rol, 'digitos', v_rol);
end $$;

create or replace function orden_pin_cambiar(p_actual text, p_nuevo text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p orden_personas; v_rol int; v_r jsonb;
begin
  select * into p from orden_personas where id = orden_yo_id();
  if not found then return jsonb_build_object('ok', false, 'porque', 'Entrá de nuevo con tu PIN.'); end if;
  if not exists (select 1 from orden_pins where persona_id = p.id and hash is not null) then
    return jsonb_build_object('ok', false, 'porque', 'No tenés PIN: entrá de nuevo y creá uno.');
  end if;
  v_rol := orden_pin_digitos(p.rol, p.tambien_atencion);
  if coalesce(p_nuevo, '') !~ ('^[0-9]{' || v_rol || '}$') then
    return jsonb_build_object('ok', false, 'porque', 'El PIN nuevo tiene que tener ' || v_rol || ' números.');
  end if;
  v_r := orden_login_probar(p.id, p_actual);
  if not coalesce((v_r ->> 'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'actual', true, 'espera', v_r -> 'espera', 'restantes', v_r -> 'restantes',
      'porque', case when coalesce((v_r ->> 'espera')::int, 0) > 0 then v_r ->> 'porque' else 'Tu PIN de ahora no es ése.' end);
  end if;
  update orden_pins set hash = crypt(p_nuevo, gen_salt('bf', 8)), digitos = v_rol, fallos = 0, bloqueado_hasta = null,
                        nivel_freno = 0, cambiado_en = now()
   where persona_id = p.id;
  return jsonb_build_object('ok', true, 'digitos', v_rol);
end $$;

create or replace function orden_pin_estado()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('digitos', coalesce(k.digitos, 4), 'pide', orden_pin_digitos(p.rol, p.tambien_atencion),
                            'cambiar', coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, p.tambien_atencion))
    from orden_personas p join orden_pins k on k.persona_id = p.id
   where p.id = orden_yo_id()
$$;

create or replace function ventas_acceso(p_local uuid, p_caja text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_yo     uuid;
  v_nombre text;
  v_local  text;
begin
  select codigo into v_codigo from orden_locales where id = p_local and activo;
  if not found then return jsonb_build_object('puede', null); end if;
  if orden_es_servicio() then
    return jsonb_build_object('puede', 'escribir', 'quien', 'Sistema', 'supervisa', true);
  end if;
  v_yo := orden_yo_id();
  if v_yo is not null then
    select nombre into v_nombre from orden_personas where id = v_yo;
    if orden_es_supervisor_de(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', true);
    end if;
    if orden_es_del_local(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
    /* Atención al cliente, en todos los locales: hay quien atiende y también vende en un local
       (Lautaro, Mauricio el 15/10: "tendría que tener acceso a las planillas y todo").
       SQL 135: también el vendedor con la casilla de Atención. */
    if exists (select 1 from orden_personas where id = v_yo and (rol = 'atencion' or tambien_atencion) and activo and aprobado) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
    if orden_ve_local(p_local) then
      return jsonb_build_object('puede', 'ver', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
  end if;
  if p_caja like 'caja\_%' then
    v_local := club_caja_local(p_caja);
    if v_local is not null and upper(btrim(v_local)) = upper(btrim(coalesce(v_codigo, ''))) then
      return jsonb_build_object('puede', 'escribir', 'quien', 'Compu del local', 'supervisa', false);
    end if;
  end if;
  return jsonb_build_object('puede', null);
end $$;

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
                    /* El estado del PIN, sin el PIN: si está en la lista para entrar,
                       si ya lo creó y si ya entró alguna vez. */
                    'en_lista', k.persona_id is not null, 'pin', k.hash is not null,
                    'entro', p.auth_user_id is not null,
                    'creado', p.creado_en, 'soy', p.id = yo.id)
                  order by p.activo desc, p.nombre, p.apellido), '[]'::jsonb)
                   from orden_personas p left join orden_pins k on k.persona_id = p.id
                  where v_admin or p.id = yo.id or (p.local_id = yo.local_id and p.rol = 'vendedor')));
end $$;

/** La casilla "También atiende clientes" (SQL 135): sólo el administrador, y sólo a un vendedor o un encargado. */
create or replace function nc_usuario_atencion(p_persona uuid, p_si boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare yo orden_personas := nc_quien_maneja(); p orden_personas;
begin
  if yo.id is null or yo.rol <> 'admin' then
    return jsonb_build_object('ok', false, 'porque', 'Atención al cliente la da el administrador.');
  end if;
  select * into p from orden_personas where id = p_persona for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  if coalesce(p_si, false) and p.rol::text not in ('vendedor', 'supervisor') then
    return jsonb_build_object('ok', false, 'porque',
      case when p.rol::text = 'atencion' then p.nombre || ' ya es de Atención al cliente.'
           else 'Administración y Gerencia ya entran a lo de Atención.' end);
  end if;
  update orden_personas set tambien_atencion = coalesce(p_si, false) where id = p.id returning * into p;
  return jsonb_build_object('ok', true, 'tambien_atencion', p.tambien_atencion,
    /* Su PIN es de 4: lo de la oficina le abre recién cuando lo cambie (se lo pide al entrar). */
    'pin_corto', p.tambien_atencion and exists (select 1 from orden_pins k where k.persona_id = p.id and k.hash is not null
                                                  and coalesce(k.digitos, 4) < orden_pin_digitos(p.rol, true)));
end $$;
revoke all on function nc_usuario_atencion(uuid, boolean) from public, anon;
grant execute on function nc_usuario_atencion(uuid, boolean) to authenticated;

-- Chequeo: tiene que decir que nadie tiene la casilla todavía (0), y "sí" en las otras dos.
select (select count(*) from orden_personas where tambien_atencion) as con_la_casilla,
       case when pg_get_functiondef('nc_persona_oficina'::regproc) like '%tambien_atencion%' then 'sí' else 'NO' end as oficina_con_la_casilla,
       case when pg_get_functiondef('ventas_acceso'::regproc) like '%tambien_atencion%' then 'sí' else 'NO' end as ventas_con_la_casilla;

-- ---------------------------------------------------------------------
-- Vuelta atrás: apagar la casilla a todos alcanza (con la casilla apagada,
-- las funciones hacen lo mismo que antes):
--
-- update orden_personas set tambien_atencion = false;
--
-- Para sacar la columna y las dos funciones nuevas del todo, hay que
-- volver a correr antes las funciones como estaban (SQL 110, 121, 127 y
-- 107): pedíselo a Claude, que arma ese SQL aparte.
-- ---------------------------------------------------------------------
