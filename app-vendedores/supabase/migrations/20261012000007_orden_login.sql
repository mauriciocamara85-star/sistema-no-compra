-- =====================================================================
-- Módulo VDH · Migración 7: el login de la app
--
-- Cada persona elige su local (o "Oficina", si no es de un local), elige su
-- nombre y pone su PIN de 4 números UNA vez por celular: después la sesión
-- queda guardada. "No soy yo" cierra la sesión y vuelve a la lista.
--
-- Lo interno:
--   · El PIN se guarda cifrado, en una tabla que nadie lee desde afuera
--     (ni los compañeros del local ni el propio vendedor).
--   · El PIN NO es la contraseña de la cuenta de Supabase. Si lo fuera, se
--     podrían probar PIN directo contra Supabase sin pasar por el freno.
--     La Edge Function "entrar" revisa acá el freno y el PIN, y recién ahí
--     abre la sesión con una contraseña larga que arma ella y nadie ve.
--     El mail de la cuenta también lo arma el sistema.
--   · Freno: 5 PIN mal seguidos y espera 5 minutos, por persona.
--     Con un PIN malo NO se tira un error: un error deshace todo, también
--     el intento anotado, y el freno no correría nunca.
--   · El PIN lo cambia el administrador desde Configuración en No Compra.
-- =====================================================================

create table orden_pins (
  persona_id       uuid primary key references orden_personas(id) on delete cascade,
  hash             text not null,
  fallos           smallint not null default 0,  -- PIN mal seguidos
  bloqueado_hasta  timestamptz,
  clave_cuenta     text,                         -- contraseña de la cuenta de Supabase: solo la usa "entrar"
  cambiado_en      timestamptz not null default now()
);
alter table orden_pins enable row level security;  -- sin políticas: desde afuera no se ve nada
revoke all on table orden_pins from public, anon, authenticated;
grant all on table orden_pins to service_role;

-- "Lautaro G." (sin inicial cargada: "Lautaro")
create or replace function orden_nombre_lista(p_nombre text, p_inicial text) returns text
language sql immutable as $$
  select p_nombre || coalesce(' ' || nullif(upper(left(trim(p_inicial), 1)), '') || '.', '')
$$;

-- El mail interno de la cuenta: lo arma el sistema y nadie lo ve
create or replace function orden_mail_cuenta(p_persona uuid) returns text
language sql immutable as $$
  select 'p-' || p_persona || '@cuentas.vdh.com.ar'
$$;

-- ---------- La lista del login (antes de entrar: sin sesión) ----------

-- Los locales que tienen gente con PIN, y "Oficina" si hay alguien sin local
create or replace function orden_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  with gente as (
    select distinct p.local_id from orden_personas p join orden_pins k on k.persona_id = p.id where p.activo)
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre)
                   from orden_locales l
                   where l.activo and l.id in (select local_id from gente where local_id is not null)), '[]'::jsonb)
      || case when exists (select 1 from gente where local_id is null)
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Oficina')) else '[]'::jsonb end
$$;

-- Las personas de un local (sin local = "Oficina"): solo id y "Nombre I."
create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial))
                            order by p.nombre), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

-- ---------- Las que usa la Edge Function "entrar" (solo el servidor) ----------

-- Revisa el freno y el PIN. Con el PIN bien devuelve lo que hace falta para abrir la sesión.
create or replace function orden_login_probar(p_persona uuid, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  select * into k from orden_pins where persona_id = p.id for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Todavía no tenés PIN. Pedíselo a Mauricio.'); end if;

  if k.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from k.bloqueado_hasta - now()))::int,
                              'porque', 'Pusiste mal el PIN 5 veces. Esperá unos minutos y probá de nuevo.');
  end if;

  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and crypt(p_pin, k.hash) = k.hash then
    update orden_pins set fallos = 0, bloqueado_hasta = null where persona_id = p.id;
    return jsonb_build_object('ok', true, 'persona_id', p.id, 'auth_user_id', p.auth_user_id,
                              'mail', orden_mail_cuenta(p.id), 'clave', k.clave_cuenta,
                              'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id);
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
end $$;

-- La primera vez que entra, "entrar" le crea la cuenta y la deja anotada acá
create or replace function orden_login_vincular(p_persona uuid, p_auth uuid, p_clave text)
returns void language sql volatile security definer set search_path = public as $$
  update orden_personas set auth_user_id = p_auth where id = p_persona;
  update orden_pins set clave_cuenta = p_clave where persona_id = p_persona;
$$;

-- ---------- PIN: lo cambia el administrador ----------

-- Desde Configuración en No Compra (con la sesión de Mauricio)
create or replace function orden_pin_cambiar(p_persona uuid, p_pin text)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not orden_es_admin() then raise exception 'Solo el administrador puede cambiar los PIN'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'El PIN tiene que tener 4 números'; end if;
  if not exists (select 1 from orden_personas where id = p_persona) then raise exception 'No encontramos a esa persona'; end if;
  insert into orden_pins (persona_id, hash) values (p_persona, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (persona_id) do update
    set hash = excluded.hash, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
end $$;

-- Desde el editor SQL de Supabase (mientras no esté la pantalla de Configuración):
--   select nombre, orden_pin_sortear(id) as pin from orden_personas where nombre = 'Lautaro';
-- Sortea un PIN nuevo, lo guarda cifrado y lo muestra UNA vez.
create or replace function orden_pin_sortear(p_persona uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare b bytea := gen_random_bytes(2); v_pin text;
begin
  v_pin := lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0');
  insert into orden_pins (persona_id, hash) values (p_persona, crypt(v_pin, gen_salt('bf', 8)))
  on conflict (persona_id) do update
    set hash = excluded.hash, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
  return v_pin;
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array['orden_nombre_lista(text,text)', 'orden_mail_cuenta(uuid)',
                           'orden_login_locales()', 'orden_login_personas(uuid)',
                           'orden_login_probar(uuid,text)', 'orden_login_vincular(uuid,uuid,text)',
                           'orden_pin_cambiar(uuid,text)', 'orden_pin_sortear(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- La lista del login se ve antes de entrar
  grant execute on function orden_login_locales() to anon, authenticated, service_role;
  grant execute on function orden_login_personas(uuid) to anon, authenticated, service_role;
  -- Solo la Edge Function "entrar"
  grant execute on function orden_login_probar(uuid, text) to service_role;
  grant execute on function orden_login_vincular(uuid, uuid, text) to service_role;
  -- El administrador, desde No Compra
  grant execute on function orden_pin_cambiar(uuid, text) to authenticated, service_role;
  -- orden_pin_sortear: solo desde el editor SQL (el dueño de la base)
end $$;

-- ---------- Los PIN del arranque ----------
-- Uno sorteado para cada persona. Se muestran UNA vez, al final del SQL:
-- anotalos y pasáselos a cada uno. No quedan escritos en ningún lado.
create temp table orden_pins_iniciales (local text, nombre text, pin text);
insert into orden_pins_iniciales
select coalesce(l.nombre, 'Oficina'), orden_nombre_lista(p.nombre, p.inicial), orden_pin_sortear(p.id)
from orden_personas p left join orden_locales l on l.id = p.local_id
where p.activo;
