-- ═══ SQL 120 (14/10/2026) · Equipo VDH: supervisores de varios locales ═══
-- Va después del 118. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Los supervisores entran por "Supervisores y administración", eligen sus locales en la app y vos los aprobás
--     en Equipo ("Supervisores: esperan tu OK"). Ven lo mismo que vos, pero sólo de sus locales.
--   · Carga a Franco Ortiz, Nicolás Segovia, Brenda Núñez y Cintia (supervisores) y a Antonella (administradora).
--     Cuando cada uno cree su PIN, te llega para aprobarlo, como siempre.
--   · El encargado de un local (supervisor con local fijo) sigue igual.
--   · Reversible: borrar la tabla orden_supervision y las funciones nuevas, y volver las 3 de antes (detalle abajo).

-- =====================================================================
-- Módulo VDH · Migración 29 (SQL 120), 14/10/2026: supervisores de varios
-- locales, que eligen los suyos y el administrador aprueba.
--
-- Pedido de Mauricio: "los supervisores tengan lo mismo que administrador,
-- pero sólo sus locales" y "que ellos elijan sus locales, que no quede fijo".
-- Recomendación aceptada ("dale"): eligen ellos y el administrador lo aprueba,
-- como hoy aprueba a los vendedores.
--
-- El rol sigue siendo 'supervisor':
-- - con un local fijo (local_id) es el encargado de ese local, como hasta ahora;
-- - sin local fijo (local_id null) es supervisor de los locales que eligió y le
--   aprobaron (orden_supervision).
-- Todo lo que hoy pregunta "¿es supervisor de este local?"
-- (orden_es_supervisor_de, unas 24 funciones y las políticas) pasa a mirar
-- también esa lista. Lo mismo "¿ve este local?" (orden_ve_local) y a quién le
-- llegan los avisos de los supervisores (orden_avisar_responsables).
--
-- Reversible: borrar la tabla orden_supervision y las 6 funciones nuevas
-- (orden_supervisa, orden_supervisores_de, orden_supervision_pedir,
-- orden_supervision_aprobar, orden_supervision_mia, orden_supervision_lista,
-- orden_mis_locales), y volver orden_es_supervisor_de, orden_ve_local y
-- orden_avisar_responsables a como estaban (sin la lista).
-- =====================================================================

create table if not exists orden_supervision (
  persona_id   uuid not null references orden_personas(id) on delete cascade,
  local_id     uuid not null references orden_locales(id) on delete cascade,
  aprobado     boolean not null default false,
  pedido_en    timestamptz not null default now(),
  aprobado_en  timestamptz,
  aprobado_por uuid references orden_personas(id) on delete set null,
  primary key (persona_id, local_id)
);
alter table orden_supervision enable row level security;
drop policy if exists ver on orden_supervision;
-- Cada uno ve lo suyo (también antes de que lo aprueben); el administrador, todo. Se escribe sólo con las funciones.
create policy ver on orden_supervision for select to authenticated
  using (persona_id in (select id from orden_personas where auth_user_id = auth.uid()) or orden_es_admin());
revoke all on orden_supervision from public, anon, authenticated;
grant select on orden_supervision to authenticated;
grant all on orden_supervision to service_role;

/** ¿Quien entró es supervisor (sin local fijo) de este local, aprobado? */
create or replace function orden_supervisa(p_local uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orden_supervision s join orden_personas p on p.id = s.persona_id
     where p.auth_user_id = auth.uid() and p.activo and p.aprobado and p.rol = 'supervisor' and p.local_id is null
       and s.local_id = p_local and s.aprobado)
$$;

create or replace function orden_es_supervisor_de(p_local uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo and aprobado
      and (rol = 'admin' or (rol = 'supervisor' and local_id = p_local)))
    or orden_supervisa(p_local)
$$;

create or replace function orden_ve_local(p_local uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo and aprobado
      and (rol in ('admin', 'gerencia') or local_id = p_local))
    or orden_supervisa(p_local)
$$;

/** Los supervisores de un local: el encargado (local fijo) y los que lo tienen aprobado en su lista. */
create or replace function orden_supervisores_de(p_local uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from orden_personas where activo and rol = 'supervisor' and local_id = p_local
  union
  select p.id from orden_supervision s join orden_personas p on p.id = s.persona_id
   where s.local_id = p_local and s.aprobado and p.activo and p.rol = 'supervisor' and p.local_id is null
$$;

create or replace function orden_avisar_responsables(p_local uuid, p_destino text, p_tipo text, p_titulo text, p_cuerpo text,
                                                     p_url text, p_clave text, p_prioridad smallint default 2)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_hay_sup boolean;
begin
  select exists (select 1 from orden_personas where id in (select orden_supervisores_de(p_local))
                   and aprobado and auth_user_id is not null)
  into v_hay_sup;
  for r in
    select id from orden_personas
    where activo and (
      (p_destino in ('supervisores', 'ambos') and id in (select orden_supervisores_de(p_local)))
      or (rol = 'admin' and (p_destino in ('admins', 'ambos') or not v_hay_sup)))
  loop
    if orden_encolar_aviso(r.id, p_tipo, p_titulo, p_cuerpo, p_url,
                           p_clave || ':' || r.id, p_prioridad) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

/** El supervisor elige sus locales: los nuevos quedan esperando el OK del administrador (que recibe el aviso); los que
    saca, se van. También antes de que lo aprueben a él: así el administrador aprueba todo junto. */
create or replace function orden_supervision_pedir(p_locales uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare yo orden_personas; v_lista uuid[]; n_nuevos int := 0; n_quitados int := 0; v_nombres text;
begin
  select * into yo from orden_personas where auth_user_id = auth.uid() and activo;
  if not found or yo.rol <> 'supervisor' or yo.local_id is not null then
    raise exception 'Los locales los elige un supervisor (sin local fijo)';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_lista from unnest(coalesce(p_locales, '{}'::uuid[])) x;
  if exists (select 1 from unnest(v_lista) x where not exists (select 1 from orden_locales l where l.id = x and l.activo)) then
    raise exception 'Uno de esos locales no está en la lista';
  end if;
  delete from orden_supervision where persona_id = yo.id and not (local_id = any (v_lista));
  get diagnostics n_quitados = row_count;
  with nuevos as (
    insert into orden_supervision (persona_id, local_id)
    select yo.id, x from unnest(v_lista) x
    on conflict (persona_id, local_id) do nothing
    returning local_id)
  select count(*), string_agg(l.nombre, ', ' order by l.nombre) into n_nuevos, v_nombres
    from nuevos join orden_locales l on l.id = nuevos.local_id;
  if n_nuevos > 0 then
    perform orden_avisar_responsables(null, 'admins', 'supervision_pedida',
      orden_nombre_lista(yo.nombre, yo.inicial) || ' pide ver ' || v_nombres,
      'Es supervisor: si son sus locales, aprobalo en Equipo VDH → Equipo.',
      '/equipo', 'supervision:' || yo.id || ':' || md5(v_nombres) || ':' || floor(extract(epoch from now())), 2::smallint);
  end if;
  return jsonb_build_object('ok', true, 'pedidos', n_nuevos, 'quitados', n_quitados);
end $$;

/** El administrador aprueba (o no) lo que pidió un supervisor: un local, o todo lo pendiente si p_local es null.
    "No" también sirve para sacarle un local que ya tenía. */
create or replace function orden_supervision_aprobar(p_persona uuid, p_local uuid, p_aprobar boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n int := 0; v_nombres text;
begin
  if not orden_es_admin() then raise exception 'Los locales de un supervisor los aprueba el administrador'; end if;
  if not exists (select 1 from orden_personas where id = p_persona) then raise exception 'No encontramos a esa persona'; end if;
  if p_aprobar then
    with a as (
      update orden_supervision set aprobado = true, aprobado_en = now(), aprobado_por = orden_yo_id()
       where persona_id = p_persona and (p_local is null or local_id = p_local) and not aprobado
      returning local_id)
    select count(*), string_agg(l.nombre, ', ' order by l.nombre) into n, v_nombres from a join orden_locales l on l.id = a.local_id;
    if n > 0 then
      perform orden_encolar_aviso(p_persona, 'supervision_aprobada', 'Ya podés ver ' || v_nombres,
        'Entrá a Equipo VDH: el local se elige arriba de cada pantalla.', '/revisar',
        'supervision-ok:' || p_persona || ':' || md5(v_nombres) || ':' || floor(extract(epoch from now())), 2::smallint);
    end if;
  else
    delete from orden_supervision where persona_id = p_persona and (p_local is null or local_id = p_local);
    get diagnostics n = row_count;
  end if;
  return jsonb_build_object('ok', true, 'cambiados', n);
end $$;

/** Para la pantalla "Mis locales": todos los locales, con cuáles ya ve ('si') y cuáles pidió ('pedido'). */
create or replace function orden_supervision_mia()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'puede_elegir', coalesce((select p.rol = 'supervisor' and p.local_id is null from orden_personas p
                               where p.auth_user_id = auth.uid() and p.activo), false),
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre,
                                          'estado', case when s.aprobado then 'si' when s.local_id is not null then 'pedido' end)
                       order by l.nombre)
        from orden_locales l
        left join orden_supervision s on s.local_id = l.id
              and s.persona_id = (select id from orden_personas where auth_user_id = auth.uid() and activo)
       where l.activo), '[]'::jsonb))
$$;

/** Para el administrador: los supervisores sin local fijo, si ya entraron o esperan su OK, y sus locales. También
    los otros sin local (administración, gerencia) mientras esperan su OK, para aprobarlos desde la app. */
create or replace function orden_supervision_lista()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not orden_es_admin() then raise exception 'Esto lo ve el administrador'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'rol', p.rol, 'aprobado', p.aprobado,
             'entro', p.auth_user_id is not null, 'alta_propia', p.alta_propia,
             'locales', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'aprobado', s.aprobado)
                                                   order by s.aprobado desc, l.nombre)
                                    from orden_supervision s join orden_locales l on l.id = s.local_id
                                   where s.persona_id = p.id), '[]'::jsonb))
           order by p.nombre, p.apellido)
      from orden_personas p
     where p.activo and p.local_id is null
       and (p.rol = 'supervisor' or (p.rol in ('admin', 'gerencia') and not p.aprobado and p.auth_user_id is not null))), '[]'::jsonb);
end $$;

/** Los locales que quien entró supervisa (para elegir arriba de Revisar, Equipo y Cajas): el administrador y la
    gerencia, todos; el supervisor sin local fijo, los aprobados. */
create or replace function orden_mis_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre), '[]'::jsonb)
    from orden_locales l
   where l.activo and (orden_es_supervisor_de(l.id) or orden_es_gerencia())
$$;

do $$
begin
  revoke all on function orden_supervisa(uuid) from public, anon;
  grant execute on function orden_supervisa(uuid) to authenticated, service_role;
  revoke all on function orden_supervisores_de(uuid) from public, anon, authenticated;
  grant execute on function orden_supervisores_de(uuid) to service_role;
  revoke all on function orden_supervision_pedir(uuid[]) from public, anon;
  grant execute on function orden_supervision_pedir(uuid[]) to authenticated, service_role;
  revoke all on function orden_supervision_aprobar(uuid, uuid, boolean) from public, anon;
  grant execute on function orden_supervision_aprobar(uuid, uuid, boolean) to authenticated, service_role;
  revoke all on function orden_supervision_mia() from public, anon;
  grant execute on function orden_supervision_mia() to authenticated, service_role;
  revoke all on function orden_supervision_lista() from public, anon;
  grant execute on function orden_supervision_lista() to authenticated, service_role;
  revoke all on function orden_mis_locales() from public, anon;
  grant execute on function orden_mis_locales() to authenticated, service_role;
end $$;

-- Supervisores y administración de VDH (lo que pasó Mauricio el 14/10/2026). Va después de la migración 29 (SQL 120).
-- Se puede correr más de una vez: si ya están, no los duplica.
--   · Supervisores sin local fijo (eligen sus locales en la app y Mauricio los aprueba):
--     Franco Ortiz (Unicenter, Grand Bourg, Pacheco), Nicolás Segovia (Parque Brown, Lomas de Zamora),
--     Brenda Núñez (Flores, Morón, Ituzaingó) y Cintia (el apellido lo pone ella al crear su PIN).
--   · Antonella, administradora como Mauricio (el apellido lo pone ella al crear su PIN).
--   · Cuando cada uno cree su PIN, espera el OK de Mauricio (como siempre con el PIN nuevo).
insert into orden_personas (nombre, apellido, inicial, rol, local_id, aprobado, alta_propia)
select v.nombre, v.apellido, left(v.apellido, 1), v.rol::orden_rol, null, true, false
  from (values ('Franco', 'Ortiz', 'supervisor'), ('Nicolás', 'Segovia', 'supervisor'), ('Brenda', 'Núñez', 'supervisor'),
               ('Cintia', null, 'supervisor'), ('Antonella', null, 'admin')) v(nombre, apellido, rol)
 where not exists (select 1 from orden_personas p where p.local_id is null and lower(p.nombre) = lower(v.nombre) and p.rol::text = v.rol);
-- Sin PIN todavía: con la fila vacía aparecen en la lista para crearlo.
insert into orden_pins (persona_id, hash)
select p.id, null from orden_personas p
 where p.local_id is null and p.activo and (p.nombre, p.rol::text) in (('Franco', 'supervisor'), ('Nicolás', 'supervisor'), ('Brenda', 'supervisor'),
                                                                        ('Cintia', 'supervisor'), ('Antonella', 'admin'))
on conflict (persona_id) do nothing;
