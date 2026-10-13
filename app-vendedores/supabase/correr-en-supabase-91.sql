-- ═══ SQL 91 (12/10/2026) · app de vendedores: cada uno crea su PIN, y "Supervisión" ═══
-- Va después del 90. Pegalo entero en el editor SQL de Supabase: corre como un
-- solo bloque (si algo falla, no cambia nada). Se puede correr más de una vez.
--   · La primera vez que alguien entra, la app le pide que CREE su PIN de 4
--     números (dos veces). Los PIN sorteados del SQL 90 dejan de valer.
--   · Si alguien se olvida el PIN:
--       select orden_pin_borrar(id) from orden_personas where nombre = 'Lautaro';
--     y la próxima vez que entre lo crea de nuevo.
--   · "Oficina" pasa a llamarse "Supervisión".

-- =====================================================================
-- Módulo VDH · Migración 8 (SQL 91): cada uno CREA su PIN, y "Supervisión"
--
-- Pedido de Mauricio al probar la app (12/10/2026):
--   · La primera vez, cada uno crea su propio PIN de 4 números (lo pone dos
--     veces). Desde ahí es su PIN. Si se lo olvida, Mauricio se lo borra y
--     lo vuelve a crear. Ya no se sortean.
--   · "Oficina" (la gente sin local: Mauricio, gerencia) se llama "Supervisión".
--
-- Lo que se sabe y se acepta: mientras alguien no creó su PIN, otro podría
-- crearlo antes en su nombre. El dueño se da cuenta (no puede entrar) y
-- Mauricio se lo borra. Seguridad básica, como pidió.
--
-- Los PIN sorteados del SQL 90 dejan de valer: la primera vez que se corre
-- esto se borran todos (todavía no entró nadie). Correrlo de nuevo no borra
-- los que la gente ya creó.
-- =====================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'orden_pins' and column_name = 'hash' and is_nullable = 'NO') then
    alter table orden_pins alter column hash drop not null;   -- null = todavía no creó su PIN
    update orden_pins set hash = null, fallos = 0, bloqueado_hasta = null;
  end if;
end $$;

-- Las personas de un local (sin local = "Supervisión"), con "nuevo" si todavía no creó su PIN
create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null)
                            order by p.nombre), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

-- Los locales con gente, y "Supervisión" si hay alguien sin local
create or replace function orden_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  with gente as (
    select distinct p.local_id from orden_personas p join orden_pins k on k.persona_id = p.id where p.activo)
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre)
                   from orden_locales l
                   where l.activo and l.id in (select local_id from gente where local_id is not null)), '[]'::jsonb)
      || case when exists (select 1 from gente where local_id is null)
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Supervisión')) else '[]'::jsonb end
$$;

-- El freno y el PIN. Si todavía no tiene PIN, el que llega se guarda como SU PIN
-- (crear no cuenta para el freno). Con un PIN malo no se tira un error: así el
-- intento queda anotado.
create or replace function orden_login_probar(p_persona uuid, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  select * into k from orden_pins where persona_id = p.id for update;
  if not found then
    insert into orden_pins (persona_id, hash) values (p.id, null) returning * into k;
  end if;

  if k.hash is null then
    if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
      return jsonb_build_object('ok', false, 'crear', true, 'porque', 'El PIN tiene que tener 4 números.');
    end if;
    update orden_pins set hash = crypt(p_pin, gen_salt('bf', 8)), fallos = 0, bloqueado_hasta = null, cambiado_en = now()
     where persona_id = p.id returning * into k;
    v_creado := true;
  elsif k.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from k.bloqueado_hasta - now()))::int,
                              'porque', 'Pusiste mal el PIN 5 veces. Esperá unos minutos y probá de nuevo.');
  elsif not (coalesce(p_pin, '') ~ '^[0-9]{4}$' and crypt(p_pin, k.hash) = k.hash) then
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
    update orden_pins set fallos = 0, bloqueado_hasta = null where persona_id = p.id;
  end if;
  return jsonb_build_object('ok', true, 'creado', v_creado, 'persona_id', p.id, 'auth_user_id', p.auth_user_id,
                            'mail', orden_mail_cuenta(p.id), 'clave', k.clave_cuenta,
                            'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id);
end $$;

-- "Se olvidó el PIN": el administrador lo borra y la próxima vez lo crea de nuevo.
-- Desde el editor SQL:  select orden_pin_borrar(id) from orden_personas where nombre = 'Lautaro';
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
  insert into orden_pins (persona_id, hash) values (p_persona, null)
  on conflict (persona_id) do update set hash = null, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
  return found;
end $$;

do $$
begin
  revoke all on function orden_login_personas(uuid) from public, anon, authenticated, service_role;
  revoke all on function orden_login_locales() from public, anon, authenticated, service_role;
  revoke all on function orden_login_probar(uuid, text) from public, anon, authenticated, service_role;
  revoke all on function orden_pin_borrar(uuid) from public, anon, authenticated, service_role;
  grant execute on function orden_login_personas(uuid) to anon, authenticated, service_role;
  grant execute on function orden_login_locales() to anon, authenticated, service_role;
  grant execute on function orden_login_probar(uuid, text) to service_role;
  grant execute on function orden_pin_borrar(uuid) to authenticated, service_role;
end $$;

select 'listo: cada uno crea su PIN la primera vez, y "Supervisión"' as "SQL 91";
