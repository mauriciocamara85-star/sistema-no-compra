-- =====================================================================
-- Módulo VDH · Migración 21 (SQL 110): el PIN de 6 números para la
-- administración, Atención al cliente y gerencia.
--
-- Pedido de Mauricio (13/10/2026, coordinado con la sesión de los usuarios
-- del No Compra): cuando se saque el PIN compartido, el PIN de cada persona
-- es la única llave al CRM, Socios, el Club y las gift cards. Con 4 números
-- y 5 intentos cada 5 minutos se adivina en unos 3 días; con 6, en un año.
--
--   · El largo sale del rol: 6 números para admin, atencion y gerencia; 4
--     para vendedor y supervisor (orden_pin_digitos). Cada PIN guarda con
--     cuántos números se creó (orden_pins.digitos; vacío = 4, los de antes).
--   · NO se borra ningún PIN. Quien tiene uno de 4 y su rol pide 6 entra con
--     el de 4 una última vez y la app le pide en el momento uno de 6
--     (orden_pin_cambiar, con su sesión). Así no queda un rato en que
--     cualquiera pueda crearle el PIN al administrador (que entra sin esperar
--     aprobación).
--   · El freno de esos tres roles es escalonado: 5 mal → 5 minutos; otros 5
--     mal sin acertar → 30 minutos; después → 24 horas y aviso a los
--     administradores ("alguien está probando PINs de …"). Acertar lo
--     vuelve a cero. Vendedores y supervisores, como hasta hoy.
--   · La lista para entrar dice cuántos números tiene el PIN de cada uno
--     ('digitos'), para que la pantalla dibuje los puntos.
--   · orden_pin_reiniciar(persona): una sola función que deja a alguien sin
--     PIN (y sin cuenta ni sesión) con todo el freno en cero. La usan
--     orden_pin_borrar, el "No fue" de la aprobación y (desde el SQL 109 de
--     la otra sesión) Config → Usuarios.
-- Reversible: volver a crear las funciones de antes (SQL 97 y 104) y borrar
-- las columnas digitos y nivel_freno. No borra datos.
-- =====================================================================

alter table orden_pins add column if not exists digitos smallint;
alter table orden_pins add column if not exists nivel_freno smallint not null default 0;

/** Cuántos números tiene que tener el PIN de un rol. */
create or replace function orden_pin_digitos(p_rol orden_rol) returns int
language sql immutable set search_path = public as $$
  select case when p_rol::text in ('admin', 'atencion', 'gerencia') then 6 else 4 end
$$;

/** "5 minutos", "30 minutos", "24 horas", "un minuto". */
create or replace function orden_texto_espera(p interval) returns text
language sql immutable as $$
  select case when p <= interval '1 minute' then 'un minuto'
              when p < interval '1 hour' then ceil(extract(epoch from p) / 60)::int || ' minutos'
              when p <= interval '1 hour' then 'una hora'
              else ceil(extract(epoch from p) / 3600)::int || ' horas' end
$$;

/* Deja a alguien sin PIN, sin cuenta y sin sesión, con todo el freno en
   cero: la próxima vez crea uno nuevo (y espera el OK, salvo el único
   administrador). Sin control de permisos adentro: lo controla quien la
   llama (no la puede llamar nadie desde afuera). */
create or replace function orden_pin_reiniciar(p_persona uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from orden_personas where id = p_persona) then return; end if;
  insert into orden_pins (persona_id, hash) values (p_persona, null)
  on conflict (persona_id) do update
     set hash = null, digitos = null, fallos = 0, bloqueado_hasta = null, nivel_freno = 0, cambiado_en = now();
  perform orden_borrar_cuenta_interna(p_persona);
end $$;

create or replace function orden_pin_borrar(p_persona uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  /* session_user y no current_user: adentro de una función security definer,
     current_user es siempre el dueño (postgres) y dejaría pasar a cualquiera.
     session_user es quien se conectó: el editor SQL entra como postgres y la
     app (PostgREST) como authenticator. */
  if session_user not in ('postgres', 'supabase_admin') and not orden_es_admin() then
    raise exception 'Solo el administrador puede borrar un PIN';
  end if;
  /* Y la cuenta: si no, quien había creado ese PIN seguía con su sesión. */
  perform orden_pin_reiniciar(p_persona);
  return true;
end $$;

-- ---------- La lista para entrar: con cuántos números es el PIN ----------
create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               /* El que ya tiene PIN, con los números con que lo creó; el que lo va a crear, los de su rol. */
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local and p.rol::text <> 'atencion'
$$;

-- ---------- El PIN ----------
create or replace function orden_login_probar(p_persona uuid, p_pin text, p_apellido text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false; v_ap text; v_vend boolean;
        v_rol int; v_dig int; v_espera interval;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  v_rol := orden_pin_digitos(p.rol);
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
      /* Admin, Atención y gerencia: cada 5 mal seguidos, más espera (5 min,
         30 min, 24 h). A las 24 h se avisa a los administradores. */
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

-- ---------- Cambiar el PIN, con la sesión (el de 4 de antes por uno de 6) ----------
create or replace function orden_pin_cambiar(p_nuevo text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; v_rol int;
begin
  select * into p from orden_personas where id = orden_yo_id();
  if not found then return jsonb_build_object('ok', false, 'porque', 'Entrá de nuevo con tu PIN.'); end if;
  v_rol := orden_pin_digitos(p.rol);
  if coalesce(p_nuevo, '') !~ ('^[0-9]{' || v_rol || '}$') then
    return jsonb_build_object('ok', false, 'porque', 'El PIN tiene que tener ' || v_rol || ' números.');
  end if;
  update orden_pins set hash = crypt(p_nuevo, gen_salt('bf', 8)), digitos = v_rol, fallos = 0, bloqueado_hasta = null,
                        nivel_freno = 0, cambiado_en = now()
   where persona_id = p.id;
  return jsonb_build_object('ok', true, 'digitos', v_rol);
end $$;

/** ¿El PIN de quien entró tiene los números que pide su rol? (la app lo mira al abrir) */
create or replace function orden_pin_estado()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('digitos', coalesce(k.digitos, 4), 'pide', orden_pin_digitos(p.rol),
                            'cambiar', coalesce(k.digitos, 4) < orden_pin_digitos(p.rol))
    from orden_personas p join orden_pins k on k.persona_id = p.id
   where p.id = orden_yo_id()
$$;

-- ---------- El "No fue" de la aprobación también usa orden_pin_reiniciar ----------
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('orden_aprobar_persona(uuid, boolean)'::regprocedure);
  v_nuevo := replace(v_def,
    'update orden_pins set hash = null, fallos = 0, bloqueado_hasta = null, cambiado_en = now() where persona_id = p.id;',
    'perform orden_pin_reiniciar(p.id);');
  if v_nuevo <> v_def then execute v_nuevo; end if;
  if position('perform orden_pin_reiniciar(p.id);' in pg_get_functiondef('orden_aprobar_persona(uuid, boolean)'::regprocedure)) = 0 then
    raise exception 'SQL 110: orden_aprobar_persona no tiene lo que se esperaba; no se cambió. Avisale a Claude.';
  end if;
end $$;

-- ---------- Permisos ----------
do $$
begin
  revoke all on function orden_pin_digitos(orden_rol) from public, anon;
  grant execute on function orden_pin_digitos(orden_rol) to authenticated, service_role;
  revoke all on function orden_texto_espera(interval) from public, anon;
  grant execute on function orden_texto_espera(interval) to authenticated, service_role;
  revoke all on function orden_pin_reiniciar(uuid) from public, anon, authenticated;
  grant execute on function orden_pin_reiniciar(uuid) to service_role;
  revoke all on function orden_pin_cambiar(text) from public, anon;
  grant execute on function orden_pin_cambiar(text) to authenticated, service_role;
  revoke all on function orden_pin_estado() from public, anon;
  grant execute on function orden_pin_estado() to authenticated, service_role;
  /* La función del trigger de los tableros (SQL 111) quedó abierta para quien
     no tiene sesión: no sirve llamarla, pero se cierra igual. */
  if to_regprocedure('orden_tableros_sin_invitacion()') is not null then
    revoke all on function orden_tableros_sin_invitacion() from public, anon;
  end if;
end $$;
