-- VDH · Sistema No Compra — sin el PIN compartido (13/10/2026).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CADA UNO CON SU USUARIO, Y EL PIN COMPARTIDO SE APAGA
-- ══════════════════════════════════════════════════════════════════════════
--
-- Hasta acá el CRM, Socios, el Club y la lista de gift cards pedían un PIN
-- compartido (pin_ok, pin.sql): uno solo para todos, que viajaba de mano en
-- mano. Desde los usuarios por persona (personas.sql) cada uno entra con el
-- suyo, y Mauricio pidió que ese PIN no esté más en ningún lado.
--
-- No se reescriben las ~116 funciones que lo piden: todas pasan por pin_ok
-- (o por club_caja_acceso, que lo llama). pin_ok aprende a aceptar a la
-- PERSONA que entró:
--
--   · 'sesion' — la pantalla manda esto en lugar del PIN, con la sesión de la
--     persona. Vale si es Administración, Atención o Gerencia, activa y
--     aprobada. Si no, se rechaza SIN gastar intentos del PIN compartido:
--     un vendedor con la pantalla abierta no puede trabar a todos.
--   · 'sesion:<id>' — sólo desde las Edge Functions (service_role), que ya
--     revisaron la sesión de la persona y le pasan su id a las funciones que
--     corren con la service role (ahí no hay auth.uid()).
--
-- El PIN compartido sigue andando hasta el SQL 109, que lo apaga con un
-- ajuste (pin_compartido = 'no'). Se vuelve a prender poniéndolo en 'si'.
--
-- El 107 va DESPUÉS del SQL 110 de Equipo VDH (el PIN de 6 números para
-- Administración, Atención y Gerencia): usa su orden_pin_digitos y la
-- columna orden_pins.digitos.


-- ─────────────────────────── PARTE 107 (13/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LA PERSONA EN LUGAR DEL PIN
--
--   1. pin_ok acepta la sesión de una persona de la oficina (Administración,
--      Atención o Gerencia, activa y aprobada), y se puede apagar el PIN
--      compartido con el ajuste pin_compartido (lo apaga el SQL 109).
--   2. soy_de_adentro (el nombre del cliente al buscar un cupón o una gift
--      card): sólo una persona activa y aprobada —cualquier rol— o una cuenta
--      de la oficina (usuarios). Antes alcanzaba cualquier sesión, también la
--      de alguien que se anotó solo y todavía no está aprobado.
--   3. nc_yo devuelve también el nombre de pila: es el "¿Quién sos?" del CRM
--      ("Ale", "Lau"), igual que el de la lista de Atención, para que sus
--      números sigan. Que esté 'pila' es también la señal para las pantallas
--      de que este SQL ya corrió (recién ahí mandan la marca 'sesion').
--   4. La lista para entrar dice cuántos números tiene el PIN de cada uno
--      ('digitos', SQL 110): 6 para la oficina, 4 para los locales; el que
--      todavía tiene uno de 4 de antes, 4 (y al entrar lo cambia).
--
-- Para deshacerlo: pin_ok y soy_de_adentro vuelven con su versión de antes
-- (pin.sql y beneficios-acciones.sql); nc_yo, con la de personas.sql.
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. Quién es de la oficina ══════════════════════════════════════════ */
create or replace function nc_es_oficina()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas
                  where auth_user_id = auth.uid() and auth.uid() is not null
                    and activo and aprobado and rol::text in ('admin', 'atencion', 'gerencia'))
$$;

/* La misma pregunta por id, para lo que llega de una Edge Function. */
create or replace function nc_persona_oficina(p_persona uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas
                  where id = p_persona and activo and aprobado and rol::text in ('admin', 'atencion', 'gerencia'))
$$;

/* ═══ 2. pin_ok ════════════════════════════════════════════════════════════
   Lo nuevo va ANTES del PIN compartido y nunca toca su contador: ni la marca
   'sesion' ni el apagado gastan intentos. Lo de abajo es el pin_ok de
   siempre (pin.sql), sin cambios. */
create or replace function pin_ok(p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  e       pin_estado%rowtype;
  espera  integer;
  v_id    uuid;
begin
  /* SQL 107: la persona que entró con su usuario. */
  if p_pin = 'sesion' then
    if nc_es_oficina() then return jsonb_build_object('ok', true, 'persona', true); end if;
    return jsonb_build_object('ok', false, 'sin_permiso', true,
      'porque', 'Tu usuario no tiene acceso a esto: entrá con uno de Administración o de Atención al cliente.');
  end if;
  /* Desde una Edge Function, que ya revisó la sesión: sólo con la service role. */
  if p_pin like 'sesion:%' then
    begin
      v_id := substr(p_pin, 8)::uuid;
    exception when others then
      v_id := null;
    end;
    if v_id is not null
       and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
       and nc_persona_oficina(v_id) then
      return jsonb_build_object('ok', true, 'persona', true);
    end if;
    return jsonb_build_object('ok', false, 'sin_permiso', true, 'porque', 'Tu usuario no tiene acceso a esto.');
  end if;
  /* El PIN compartido, mientras siga prendido (el SQL 109 lo apaga). */
  if coalesce((select valor from ajustes where clave = 'pin_compartido'), 'si') = 'no' then
    return jsonb_build_object('ok', false, 'sin_permiso', true,
      'porque', 'El PIN compartido ya no se usa: entrá con tu usuario.');
  end if;

  select * into e from pin_estado where id = 1 for update;

  -- Bloqueado: se contesta cuánto falta, sin gastar un intento.
  if e.bloqueado_hasta is not null and e.bloqueado_hasta > now() then
    espera := ceil(extract(epoch from (e.bloqueado_hasta - now())))::integer;
    return jsonb_build_object('ok', false, 'espera', espera,
      'porque', 'Demasiados intentos. Probá de nuevo en ' ||
                 greatest(1, round(espera / 60.0))::text || ' minuto(s).');
  end if;

  if e.hash is not null and p_pin is not null and e.hash = crypt(p_pin, e.hash) then
    update pin_estado
       set fallos = 0, bloqueado_hasta = null, ultimo_ok = now()
     where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  /* Falló. El contador sube y, pasados los tres, empieza la espera. */
  update pin_estado
     set fallos = fallos + 1,
         bloqueado_hasta = case
           when pin_espera(fallos + 1) > interval '0' then now() + pin_espera(fallos + 1)
           else null end
   where id = 1
   returning * into e;

  espera := case when e.bloqueado_hasta is null then 0
                 else ceil(extract(epoch from (e.bloqueado_hasta - now())))::integer end;

  return jsonb_build_object(
    'ok', false,
    'espera', espera,
    'restantes', greatest(0, 3 - e.fallos),
    'porque', case
      when espera > 0 then 'Demasiados intentos. Probá de nuevo en ' ||
                            greatest(1, round(espera / 60.0))::text || ' minuto(s).'
      else 'PIN incorrecto. Te queda' ||
           case when 3 - e.fallos = 1 then ' 1 intento.' else 'n ' || (3 - e.fallos)::text || ' intentos.' end
    end);
end;
$function$;

/* ═══ 3. soy_de_adentro ═══════════════════════════════════════════════════
   El nombre del cliente al buscar un cupón o una gift card (beneficio_buscar).
   Cualquier persona activa y aprobada (también vendedores y encargados, lo
   pidió Mauricio el 13/10) o una cuenta de la oficina. Queda afuera quien se
   anotó solo y todavía no está aprobado, y quien está desactivado. */
create or replace function soy_de_adentro()
returns boolean language sql stable security definer set search_path = public as $$
  select mi_rol() is not null or orden_yo_id() is not null
$$;

/* ═══ 4. nc_yo, con el nombre de pila ═════════════════════════════════════ */
create or replace function nc_yo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
           'pila', p.nombre,
           'rol', p.rol, 'local_id', p.local_id, 'local', l.codigo, 'local_nombre', l.nombre,
           'vendedor', coalesce(e.vendedor, orden_nombre_lista(p.nombre, p.inicial)),
           'activo', p.activo, 'aprobado', p.aprobado)
    from orden_personas p
    left join orden_locales l on l.id = p.local_id
    left join equipo e on e.id = p.equipo_id
   where p.auth_user_id = auth.uid() and auth.uid() is not null
   limit 1
$$;

/* ═══ 5. La lista para entrar, con el largo del PIN (SQL 110) ═════════════
   La misma regla que orden_login_personas: el que ya tiene PIN, con los
   números de su PIN (los de antes, 4); el que lo crea, con los de su rol. */
create or replace function nc_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

/* ═══ Permisos ═══════════════════════════════════════════════════════════ */
do $$
begin
  revoke all on function nc_login_personas(uuid) from public;
  grant execute on function nc_login_personas(uuid) to anon, authenticated;
  revoke all on function nc_es_oficina() from public, anon, authenticated;
  revoke all on function nc_persona_oficina(uuid) from public, anon, authenticated;
  grant execute on function nc_es_oficina() to service_role;
  grant execute on function nc_persona_oficina(uuid) to service_role;
  /* pin_ok, como siempre: la pantalla (anon o con sesión) y las Edge Functions. */
  grant execute on function pin_ok(text) to anon, authenticated, service_role;
  /* soy_de_adentro la llaman otras funciones (definer): desde afuera no hace falta. */
  revoke all on function soy_de_adentro() from public, anon, authenticated;
  revoke all on function nc_yo() from public, anon;
  grant execute on function nc_yo() to authenticated, service_role;
end $$;

select 'listo: la persona en lugar del PIN (SQL 107)' as "SQL 107";


-- ─────────────────────────── PARTE 109 (13/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · SE APAGA EL PIN COMPARTIDO
--
-- Va DESPUÉS del SQL 110 (Equipo VDH: el PIN de 6 números para
-- Administración, Atención y Gerencia, y orden_pin_reiniciar) y cuando la
-- gente de la oficina ya tiene su usuario (Mauricio, Ale y Lau).
--
--   1. El PIN compartido deja de abrir nada: pin_ok contesta "ya no se usa"
--      (sin gastar intentos). La persona que entró con su usuario sigue.
--   2. Borrar el PIN de alguien (Usuarios) usa orden_pin_reiniciar de
--      Equipo VDH, que también pone en cero su freno nuevo.
--
-- Cambiar a alguien de rol NO le borra el PIN (como el 110: no se borra
-- ningún PIN). Si el rol nuevo pide 6 números y el suyo es de 4, al entrar
-- se lo piden cambiar en el momento.
--
-- Para deshacerlo (volver a prender el PIN compartido):
--   update ajustes set valor = 'si' where clave = 'pin_compartido';
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. El apagado ═══════════════════════════════════════════════════════ */
insert into ajustes (clave, valor) values ('pin_compartido', 'no')
on conflict (clave) do update set valor = 'no';

/* ═══ 2. Borrar el PIN, con lo de Equipo VDH ══════════════════════════════ */
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
  /* Si no estaba en la lista para entrar, queda; y el PIN, la cuenta, la
     sesión y el freno se reinician (SQL 110). */
  insert into orden_pins (persona_id, hash) values (p.id, null) on conflict (persona_id) do nothing;
  perform orden_pin_reiniciar(p.id);
  return jsonb_build_object('ok', true);
end $$;

do $$
begin
  revoke all on function nc_usuario_pin_borrar(uuid) from public, anon;
  grant execute on function nc_usuario_pin_borrar(uuid) to authenticated;
end $$;

select 'listo: el PIN compartido apagado (SQL 109)' as "SQL 109";
