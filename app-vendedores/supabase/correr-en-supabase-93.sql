-- ═══ SQL 93 (12/10/2026) · Impecable: los 14 locales, el alta propia y "Administrador" ═══
-- Va después del 91 (el 92 es de la otra parte del sistema: no importa el orden
-- entre esos dos). Pegalo entero en el editor SQL de Supabase: corre como un
-- solo bloque (si algo falla, no cambia nada). Se puede correr más de una vez.
--   · En la app aparecen los 14 locales.
--   · El vendedor que no está en la lista se da de alta solo (nombre, apellido
--     y PIN) y queda sumado al equipo de la Carga de su local.
--   · A Lautaro, Nano, Seba y Mel se les pide el apellido al crear el PIN.
--   · Lo único que toca de No Compra: suma a los vendedores nuevos a la tabla
--     equipo (si el nombre ya estaba, no lo toca).

-- =====================================================================
-- Módulo VDH · Migración 9 (SQL 93): los 14 locales, el alta propia y "Administrador"
--
-- Pedido de Mauricio (12/10/2026):
--   · En la lista del login aparecen TODOS los locales de No Compra.
--   · El vendedor que no está en la lista se da de alta solo: nombre,
--     apellido y PIN. Queda como vendedor de ese local (nunca supervisor ni
--     administrador) y se suma solo al equipo de la Carga de No Compra.
--     Arranca sin módulos: hasta que el administrador se los asigne, no
--     recibe controles. Si alguien se anota de mentira, no ve nada de nadie
--     y se lo desactiva.
--   · A los que ya estaban (Lautaro, Nano, Seba, Mel) se les pide el
--     apellido cuando crean su PIN.
--   · La gente sin local se llama "Administrador".
-- Se puede correr más de una vez.
-- =====================================================================

alter table orden_personas add column if not exists apellido text;

-- ---------- Los locales de No Compra que todavía no están ----------
-- Horarios (los de la lista de locales del 24/09/2026): los de calle, lunes a
-- sábado de 9 a 20:30; los de shopping, todos los días de 10 a 22. Se cambian
-- en los ajustes. Rivadavia (MAR DEL PLATA) ya estaba.
insert into orden_locales (nombre, codigo, dias_abiertos, hora_apertura, hora_cierre)
select l.nombre, l.codigo,
       case when l.codigo in ('DOT', 'PARQUE BROWN', 'SAN JUSTO SHOPPING', 'UNICENTER')
            then '{1,2,3,4,5,6,7}'::smallint[] else '{1,2,3,4,5,6}'::smallint[] end,
       case when l.codigo in ('DOT', 'PARQUE BROWN', 'SAN JUSTO SHOPPING', 'UNICENTER') then time '10:00' else time '09:00' end,
       case when l.codigo in ('DOT', 'PARQUE BROWN', 'SAN JUSTO SHOPPING', 'UNICENTER') then time '22:00' else time '20:30' end
  from locales l
 where l.activo
   and not exists (select 1 from orden_locales o where o.codigo = l.codigo)
   and not exists (select 1 from orden_locales o where o.nombre = l.nombre);

insert into orden_config (local_id)
select o.id from orden_locales o
 where not exists (select 1 from orden_config c where c.local_id = o.id);

-- ---------- La lista del login ----------

-- Todos los locales activos (para poder darse de alta en cualquiera) y
-- "Administrador" si hay alguien sin local.
create or replace function orden_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre)
                     from orden_locales l where l.activo), '[]'::jsonb)
      || case when exists (select 1 from orden_personas p where p.activo and p.local_id is null)
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Administrador')) else '[]'::jsonb end
$$;

-- Las personas de un local: "nuevo" si todavía no creó su PIN, y
-- "pide_apellido" si además le falta el apellido (se lo pide al crearlo).
create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

-- Un nombre o un apellido prolijo: "  juan   pablo " → "Juan Pablo". Null si no sirve.
create or replace function orden_nombre_prolijo(p text) returns text
language sql immutable as $$
  select case when x ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'' -]{2,30}$' then initcap(lower(x)) end
    from (select regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g') as x) s
$$;

-- ---------- El PIN, con el apellido de los que ya estaban ----------
drop function if exists orden_login_probar(uuid, text);
create or replace function orden_login_probar(p_persona uuid, p_pin text, p_apellido text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false; v_ap text;
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
    /* Al crear su PIN, el que no tenía apellido lo deja (si lo mandó y sirve). */
    if nullif(trim(coalesce(p.apellido, '')), '') is null and p_apellido is not null then
      v_ap := orden_nombre_prolijo(p_apellido);
      if v_ap is null then
        return jsonb_build_object('ok', false, 'crear', true, 'porque', 'Revisá el apellido: sólo letras, de 2 a 30.');
      end if;
      update orden_personas set apellido = v_ap, inicial = left(v_ap, 1) where id = p.id returning * into p;
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

-- ---------- El alta propia (la usa la Edge Function "entrar") ----------
-- Crea al vendedor con su PIN y lo suma al equipo de la Carga de su local.
-- En el equipo, igual que en la Carga: si el nombre ya estaba (activo o no),
-- no se toca; sólo se los une.
create or replace function orden_alta_vendedor(p_local uuid, p_nombre text, p_apellido text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare l orden_locales; v_nom text := orden_nombre_prolijo(p_nombre); v_ap text := orden_nombre_prolijo(p_apellido);
        v_id uuid; v_lista text; v_eq bigint;
begin
  select * into l from orden_locales where id = p_local and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Elegí tu local de la lista.'); end if;
  if v_nom is null then return jsonb_build_object('ok', false, 'porque', 'Revisá el nombre: sólo letras, de 2 a 30.'); end if;
  if v_ap is null then return jsonb_build_object('ok', false, 'porque', 'Revisá el apellido: sólo letras, de 2 a 30.'); end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'porque', 'El PIN tiene que tener 4 números.'); end if;
  if exists (select 1 from orden_personas where local_id = l.id and activo
              and lower(nombre) = lower(v_nom) and lower(coalesce(apellido, '')) = lower(v_ap)) then
    return jsonb_build_object('ok', false, 'porque', 'Ya estás en la lista de ' || l.nombre || ': volvé y buscá tu nombre.');
  end if;
  /* Un freno simple contra que alguien llene la lista: 5 altas por local y por hora. */
  if (select count(*) from orden_personas where local_id = l.id and creado_en > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'porque', 'Se anotaron muchos seguidos en este local. Probá en un rato o avisale a tu supervisor.');
  end if;

  v_lista := orden_nombre_lista(v_nom, v_ap);
  if l.codigo is not null then
    insert into equipo (local, vendedor, por) values (l.codigo, v_lista, v_lista || ' (desde Impecable)')
    on conflict do nothing;
    select id into v_eq from equipo where lower(trim(local)) = lower(l.codigo) and lower(trim(vendedor)) = lower(v_lista)
     order by activo desc, id limit 1;
  end if;

  insert into orden_personas (nombre, apellido, inicial, rol, local_id, equipo_id)
  values (v_nom, v_ap, left(v_ap, 1), 'vendedor', l.id, v_eq)
  returning id into v_id;
  insert into orden_pins (persona_id, hash) values (v_id, crypt(p_pin, gen_salt('bf', 8)));

  /* Lo mismo que devuelve un PIN bien: con eso "entrar" le crea la cuenta. */
  return orden_login_probar(v_id, p_pin) || jsonb_build_object('alta', true);
end $$;

do $$
begin
  revoke all on function orden_login_locales() from public, anon, authenticated, service_role;
  revoke all on function orden_login_personas(uuid) from public, anon, authenticated, service_role;
  revoke all on function orden_nombre_prolijo(text) from public, anon, authenticated, service_role;
  revoke all on function orden_login_probar(uuid, text, text) from public, anon, authenticated, service_role;
  revoke all on function orden_alta_vendedor(uuid, text, text, text) from public, anon, authenticated, service_role;
  grant execute on function orden_login_locales() to anon, authenticated, service_role;
  grant execute on function orden_login_personas(uuid) to anon, authenticated, service_role;
  grant execute on function orden_nombre_prolijo(text) to service_role;
  grant execute on function orden_login_probar(uuid, text, text) to service_role;
  grant execute on function orden_alta_vendedor(uuid, text, text, text) to service_role;
end $$;

select 'listo: los 14 locales, el alta propia y "Administrador"' as "SQL 93";
