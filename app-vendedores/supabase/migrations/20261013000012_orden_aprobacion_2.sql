-- =====================================================================
-- Módulo VDH · Migración 12 (SQL 97): la aprobación, segunda vuelta
--
-- Va DESPUÉS de la 11 (SQL 95). Revisión del árbitro, ronda 2 (13/10/2026):
--   · Un PIN creado en nombre de alguien que ya estaba (Nano, Lautaro…) no se
--     distingue del de verdad. Ahora el aviso pide confirmarlo en persona, y
--     "No fue" ya no desactiva a la persona real: borra ese PIN, la cuenta y
--     la sesión del que lo creó (y el apellido que haya puesto), y la persona
--     vuelve a la lista para crear el suyo. "No lo conozco" (desactivar)
--     queda sólo para quien se anotó solo.
--   · "Borrar PIN" también borra la cuenta y cierra las sesiones: si no, quien
--     había creado el PIN volvía a entrar cuando aprobaban al de verdad.
--   · Un administrador nuevo también espera aprobación (de otro administrador);
--     sólo el primero, si no hay otro, entra directo.
--   · Aprobar o rechazar sirve sólo para quien está esperando: un supervisor
--     ya no puede desactivar ni reactivar vendedores por ahí. Aprobar dos
--     veces no manda dos avisos.
--   · Al aprobar a un vendedor que se une a una fila inactiva de la Carga, la
--     fila se reactiva (si no, no aparecía en No Compra).
--   · Los avisos de altas: si el supervisor del local todavía no entró a la
--     app, le llegan también al administrador; a supervisores y gerencia se los
--     aprueba en la administración, y el aviso lo dice.
--   · El vendedor ve sólo las fotos de caja de hoy y ayer (como las cajas).
--   · La gerencia con un local asignado tampoco cambia cajas.
--   · Sin aprobar no se ven las fotos del desafío ni quién tiene avisos.
-- Se puede correr más de una vez. No borra datos de nadie (sólo las cuentas
-- internas de Impecable cuando se rechaza un PIN o se lo borra).
-- =====================================================================

alter table orden_personas add column if not exists alta_propia boolean not null default false;
alter table orden_personas add column if not exists apellido_por_pin boolean not null default false;

-- ---------- La cuenta interna de Impecable ----------
-- Borra la cuenta de Auth de una persona (y con ella sus sesiones). Sólo las
-- cuentas internas de Impecable (p-<id>@cuentas.vdh.com.ar): nunca una cuenta
-- del No Compra (tabla usuarios). La próxima vez que entre, "entrar" crea otra.
create or replace function orden_borrar_cuenta_interna(p_persona uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid;
begin
  select auth_user_id into v_uid from orden_personas where id = p_persona;
  update orden_personas set auth_user_id = null where id = p_persona;
  update orden_pins set clave_cuenta = null where persona_id = p_persona;
  if v_uid is not null and not exists (select 1 from usuarios u where u.uid = v_uid) then
    delete from auth.users where id = v_uid and lower(email) = lower(orden_mail_cuenta(p_persona));
  end if;
end $$;

-- ---------- El PIN ----------
create or replace function orden_login_probar(p_persona uuid, p_pin text, p_apellido text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins; v_creado boolean := false; v_ap text; v_vend boolean;
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
    update orden_pins set hash = crypt(p_pin, gen_salt('bf', 8)), fallos = 0, bloqueado_hasta = null, cambiado_en = now()
     where persona_id = p.id returning * into k;
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
        orden_nombre_lista(p.nombre, p.inicial) || ' creó su PIN en ' || coalesce((select nombre from orden_locales where id = p.local_id), 'Impecable'),
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
                            'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id, 'aprobado', p.aprobado);
end $$;

-- ---------- El alta propia: se anota que se anotó solo ----------
create or replace function orden_alta_vendedor(p_local uuid, p_nombre text, p_apellido text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare l orden_locales; v_nom text := orden_nombre_prolijo(p_nombre); v_ap text := orden_nombre_prolijo(p_apellido);
        v_id uuid; v_lista text;
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
  /* Un freno simple contra que alguien llene la lista: 5 altas por local y por hora
     (sólo cuentan las que esperan aprobación: no la gente que carga el administrador). */
  if (select count(*) from orden_personas where local_id = l.id and not aprobado and creado_en > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'porque', 'Se anotaron muchos seguidos en este local. Probá en un rato o avisale a tu supervisor.');
  end if;

  v_lista := orden_nombre_lista(v_nom, v_ap);
  insert into orden_personas (nombre, apellido, inicial, rol, local_id, aprobado, alta_propia)
  values (v_nom, v_ap, left(v_ap, 1), 'vendedor', l.id, false, true)
  returning id into v_id;
  insert into orden_pins (persona_id, hash) values (v_id, crypt(p_pin, gen_salt('bf', 8)));
  perform orden_avisar_responsables(l.id, 'supervisores', 'alta_pendiente', v_lista || ' se anotó en ' || l.nombre,
    'Si trabaja ahí, aprobalo en Equipo. Si no lo conocés, tocá "No lo conozco".', '/equipo', 'alta:' || v_id, 2::smallint);

  /* Lo mismo que devuelve un PIN bien: con eso "entrar" le crea la cuenta. */
  return orden_login_probar(v_id, p_pin) || jsonb_build_object('alta', true);
end $$;

-- ---------- Aprobar o no: sólo a quien está esperando ----------
create or replace function orden_aprobar_persona(p_persona uuid, p_aprobar boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p orden_personas; l orden_locales; v_lista text; v_eq bigint; v_nuevo_eq boolean := false;
begin
  select * into p from orden_personas where id = p_persona for update;
  if not found then raise exception 'No encontramos a esa persona'; end if;
  if not (case when p.rol = 'vendedor' then orden_es_supervisor_de(p.local_id) else orden_es_admin() end) then
    raise exception 'No podés aprobar a esta persona';
  end if;
  if not p.activo then raise exception 'Está desactivado: lo reactiva el administrador en Ajustes'; end if;
  if p.aprobado then raise exception 'Ya estaba aprobado'; end if;

  if not p_aprobar then
    if p.alta_propia then
      /* Se anotó solo y nadie lo conoce: afuera (y se le cierra la sesión). */
      update orden_personas set activo = false where id = p.id;
      perform orden_borrar_cuenta_interna(p.id);
      return jsonb_build_object('ok', true, 'aprobado', false, 'desactivado', true);
    end if;
    /* Alguien que ya estaba, pero el PIN no lo creó él: se borra ese PIN, la
       cuenta y la sesión del que lo creó (y el apellido que haya puesto). La
       persona sigue en la lista para crear el suyo. */
    update orden_pins set hash = null, fallos = 0, bloqueado_hasta = null, cambiado_en = now() where persona_id = p.id;
    if p.apellido_por_pin then
      update orden_personas set apellido = null, inicial = null, apellido_por_pin = false where id = p.id;
    end if;
    perform orden_borrar_cuenta_interna(p.id);
    return jsonb_build_object('ok', true, 'aprobado', false, 'pin_borrado', true);
  end if;

  v_eq := p.equipo_id;
  select * into l from orden_locales where id = p.local_id;
  if p.rol = 'vendedor' and l.codigo is not null and v_eq is null then
    v_lista := orden_nombre_lista(p.nombre, p.inicial);
    insert into equipo (local, vendedor, por) values (l.codigo, v_lista, v_lista || ' (desde Impecable)')
    on conflict do nothing;
    select id into v_eq from equipo where lower(trim(local)) = lower(l.codigo) and lower(trim(vendedor)) = lower(v_lista)
     order by activo desc, id limit 1;
    v_nuevo_eq := true;
  end if;
  /* Si se une a una fila de la Carga que estaba inactiva, vuelve a estar
     activa: si no, no aparece en No Compra. */
  if v_nuevo_eq and v_eq is not null then
    update equipo set activo = true where id = v_eq and not activo;
  end if;
  update orden_personas set aprobado = true, apellido_por_pin = false, equipo_id = v_eq where id = p.id;
  perform orden_encolar_aviso(p.id, 'aprobado', 'Ya podés usar Impecable', 'Ya te aprobaron: entrá a la app.', '/hoy',
                              'aprobado:' || p.id || ':' || floor(extract(epoch from now())), 2::smallint);
  return jsonb_build_object('ok', true, 'aprobado', true);
end $$;

-- ---------- "Borrar PIN" también cierra la cuenta ----------
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
  /* Y la cuenta: si no, quien había creado ese PIN seguía con su sesión y
     volvía a entrar cuando aprobaban al de verdad. */
  perform orden_borrar_cuenta_interna(p_persona);
  return true;
end $$;

-- ---------- Los avisos de los responsables ----------
-- Si el supervisor del local todavía no entró a la app (o no está aprobado),
-- el aviso les llega también a los administradores.
create or replace function orden_avisar_responsables(
  p_local uuid, p_destino text, p_tipo text, p_titulo text, p_cuerpo text,
  p_url text, p_clave text, p_prioridad smallint default 2)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_hay_sup boolean;
begin
  select exists (select 1 from orden_personas where rol = 'supervisor' and local_id = p_local and activo
                   and aprobado and auth_user_id is not null)
  into v_hay_sup;

  for r in
    select id from orden_personas
    where activo and (
      (p_destino in ('supervisores', 'ambos') and rol = 'supervisor' and local_id = p_local)
      or (rol = 'admin' and (p_destino in ('admins', 'ambos') or not v_hay_sup)))
  loop
    if orden_encolar_aviso(r.id, p_tipo, p_titulo, p_cuerpo, p_url,
                           p_clave || ':' || r.id, p_prioridad) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------- Gente DEL local: vendedores y supervisores (no la gerencia) ----------
create or replace function orden_es_del_local(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and aprobado
                   and local_id = p_local and rol in ('vendedor', 'supervisor'))
$$;

-- ---------- Quién tiene avisos: sólo para gente aprobada ----------
create or replace function orden_tiene_avisos(p_persona uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (orden_es_servicio() or orden_yo_id() is not null)
     and exists (select 1 from orden_push_subs s where s.persona_id = p_persona)
$$;

-- ---------- Las fotos que se ven ----------
-- Las del desafío, sólo con la app aprobada. Las de caja, el vendedor ve las de
-- hoy y ayer (como las cajas); el supervisor del local, todas.
drop policy if exists "orden: ver fotos de mi local" on storage.objects;
create policy "orden: ver fotos de mi local" on storage.objects
for select to authenticated
using (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or orden_es_gerencia()
       or ((storage.foldername(name))[1] = 'preguntas' and orden_yo_id() is not null)
       or exists (select 1 from orden_personas p
                   where p.auth_user_id = auth.uid() and p.activo and p.aprobado
                     and p.local_id::text = (storage.foldername(name))[1]
                     and ((storage.foldername(name))[2] is distinct from 'cajas'
                          or orden_es_supervisor_de(p.local_id)
                          or (storage.foldername(name))[3] >= (orden_dia_caja(p.local_id) - 1)::text)))
);

do $$
begin
  revoke all on function orden_borrar_cuenta_interna(uuid) from public, anon, authenticated;
  grant execute on function orden_borrar_cuenta_interna(uuid) to service_role;
end $$;
