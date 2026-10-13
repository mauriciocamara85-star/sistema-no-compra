-- =====================================================================
-- Módulo VDH · Migración 11 (SQL 95): la aprobación y los arreglos de la revisión
--
-- Va DESPUÉS de la 9 (SQL 93), que ya está corrida. Revisión del árbitro
-- (13/10/2026):
--   · BLOQUEANTE: quien crea su PIN o se da de alta no ve NI TOCA nada del
--     local (cajas, fotos, compañeros) hasta que su supervisor (o el
--     administrador) lo aprueba. Cualquiera con el enlace podía anotarse, o
--     crear el PIN de otro, y quedar adentro. El administrador no espera.
--   · Al equipo de la Carga de No Compra se suma recién quien lo aprueba (antes,
--     al darse de alta).
--   · Gerencia mira y no cambia cajas; con el control de caja apagado, el local
--     no la abre ni la toca; "avisos activos" se ve desde supervisión; un
--     segundo análisis de la IA no pisa uno bueno; una foto reintentada no se
--     registra dos veces; sólo el administrador sube fotos de referencia; el
--     vendedor puede ver (y así subir) las fotos de caja de su local.
--   · "entrar" puede recuperar una cuenta que creó y no llegó a anotar.
-- Se puede correr más de una vez. No borra datos.
-- =====================================================================

-- Aprobación: quien entra por primera vez espera el OK de una persona.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orden_personas' and column_name = 'aprobado') then
    alter table orden_personas add column aprobado boolean not null default true;
    -- Los que todavía no crearon su PIN (cualquiera podría crearlo en su nombre)
    -- quedan esperando aprobación. El administrador, no: si no, nadie aprueba.
    update orden_personas p set aprobado = false
     where p.rol <> 'admin'
       and not exists (select 1 from orden_pins k where k.persona_id = p.id and k.hash is not null);
  end if;
end $$;

-- ---------- El PIN, con el apellido de los que ya estaban ----------
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
    /* Crear el PIN no alcanza para entrar al local: cualquiera con el enlace
       podría crearlo en nombre de otro. Espera el OK de su supervisor (o del
       administrador). Al administrador no se le pide: no habría quién. */
    if p.rol <> 'admin' then
      update orden_personas set aprobado = false where id = p.id returning * into p;
      perform orden_avisar_responsables(p.local_id, case when p.rol = 'vendedor' then 'supervisores' else 'admins' end, 'alta_pendiente',
        orden_nombre_lista(p.nombre, p.inicial) || ' entró a ' || coalesce((select nombre from orden_locales where id = p.local_id), 'Impecable'),
        'Si es de tu equipo, aprobalo en Equipo. Si no lo conocés, tocá "No lo conozco".', '/equipo',
        'aprobar:' || p.id || ':' || floor(extract(epoch from now())), 2::smallint);
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

-- ---------- El alta propia (la usa la Edge Function "entrar") ----------
-- Crea al vendedor con su PIN, ESPERANDO APROBACIÓN, y les avisa a sus
-- supervisores. Al equipo de la Carga lo suma recién quien lo aprueba.
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
  insert into orden_personas (nombre, apellido, inicial, rol, local_id, aprobado)
  values (v_nom, v_ap, left(v_ap, 1), 'vendedor', l.id, false)
  returning id into v_id;
  insert into orden_pins (persona_id, hash) values (v_id, crypt(p_pin, gen_salt('bf', 8)));
  perform orden_avisar_responsables(l.id, 'supervisores', 'alta_pendiente', v_lista || ' se anotó en ' || l.nombre,
    'Si trabaja ahí, aprobalo en Equipo. Si no lo conocés, tocá "No lo conozco".', '/equipo', 'alta:' || v_id, 2::smallint);

  /* Lo mismo que devuelve un PIN bien: con eso "entrar" le crea la cuenta. */
  return orden_login_probar(v_id, p_pin) || jsonb_build_object('alta', true);
end $$;

-- =====================================================================
-- APROBACIÓN Y LO QUE LA RESPALDA (revisión del árbitro, 13/10/2026)
-- =====================================================================

-- Quién soy y qué puedo ver: sólo cuenta quien está activo Y aprobado.
create or replace function orden_yo_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from orden_personas where auth_user_id = auth.uid() and activo and aprobado limit 1
$$;
create or replace function orden_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas where auth_user_id = auth.uid() and activo and aprobado and rol = 'admin')
$$;
create or replace function orden_es_supervisor_de(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo and aprobado
      and (rol = 'admin' or (rol = 'supervisor' and local_id = p_local)))
$$;
create or replace function orden_ve_local(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo and aprobado
      and (rol in ('admin', 'gerencia') or local_id = p_local))
$$;
create or replace function orden_es_gerencia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and aprobado and rol = 'gerencia')
$$;
/* ¿Es gente de ESE local? (no alcanza con "verlo": la gerencia ve todos). */
create or replace function orden_es_del_local(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and aprobado and local_id = p_local)
$$;

-- El banco de preguntas: sólo supervisores (aprobados) y el administrador.
drop policy if exists ver on orden_preguntas;
create policy ver on orden_preguntas for select to authenticated using (
  orden_es_admin() or exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and aprobado and rol = 'supervisor'));

-- Las fotos: lo mismo, y el vendedor puede ver las de caja de su local (las
-- saca él; sin poder verlas, la subida puede fallar). Sólo el administrador
-- sube fotos de referencia.
drop policy if exists "orden: subir fotos de mi local" on storage.objects;
create policy "orden: subir fotos de mi local" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or ((storage.foldername(name))[1] = (select local_id::text from orden_personas
                                            where auth_user_id = auth.uid() and activo and aprobado limit 1)
           and (storage.foldername(name))[2] is distinct from 'referencias'))
);
drop policy if exists "orden: ver fotos de mi local" on storage.objects;
create policy "orden: ver fotos de mi local" on storage.objects
for select to authenticated
using (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or orden_es_gerencia()
       or (storage.foldername(name))[1] = 'preguntas'
       or (storage.foldername(name))[1] = (select local_id::text from orden_personas
                                           where auth_user_id = auth.uid() and activo and aprobado limit 1))
);
drop policy if exists "orden: borrar fotos (supervisores)" on storage.objects;
create policy "orden: borrar fotos (supervisores)" on storage.objects
for delete to authenticated
using (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or exists (select 1 from orden_personas
                  where auth_user_id = auth.uid() and activo and aprobado and rol = 'supervisor'
                    and local_id::text = (storage.foldername(name))[1]))
);

-- La caja: la toca la gente DEL local (hoy y ayer, y sólo si el local usa el
-- control de caja) o su supervisor. La gerencia mira y no cambia.
create or replace function orden_puede_editar_caja(p_local uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_supervisor_de(p_local)
      or (orden_es_del_local(p_local) and p_fecha >= orden_dia_caja(p_local) - 1
          and coalesce((select caja_activa from orden_config where local_id = p_local), false))
$$;
create or replace function orden_caja_hoy()
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare v_local uuid; c orden_cajas;
begin
  select local_id into v_local from orden_personas where id = orden_yo_id();
  if v_local is null then raise exception 'No tenés un local asignado'; end if;
  if not coalesce((select caja_activa from orden_config where local_id = v_local), false) and not orden_es_supervisor_de(v_local) then
    raise exception 'El control de caja está apagado en este local.';
  end if;
  insert into orden_cajas (local_id, fecha) values (v_local, orden_dia_caja(v_local))
  on conflict (local_id, fecha) do nothing;
  select * into c from orden_cajas where local_id = v_local and fecha = orden_dia_caja(v_local);
  return c;
end $$;

-- La IA: un segundo pedido que falla NO pisa un análisis que ya salió bien
-- (si no, la misma foto se podía volver a analizar y pagar dos veces).
create or replace function orden_marcar_error_ia(p_foto uuid, p_error text)
returns void language sql security definer set search_path = public as $$
  update orden_fotos set ia_estado = 'error', ia_error = left(p_error, 1000), analizada_en = now()
   where id = p_foto and ia_estado not in ('ok', 'invalida')
$$;

-- La foto: si se cortó la señal después de registrarla, el reintento con la
-- misma ruta devuelve la misma foto (no la registra dos veces).
create or replace function orden_registrar_foto(p_control uuid, p_foto_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c orden_controles; v_yo uuid := orden_yo_id(); v_id uuid; v_ia boolean;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if c.persona_id is distinct from v_yo then raise exception 'Este control no es tuyo'; end if;
  if c.estado in ('enviado', 'revisado') then raise exception 'Ya enviaste este control'; end if;
  if p_foto_path not like c.local_id::text || '/%' then raise exception 'Ruta de foto inválida'; end if;

  select id into v_id from orden_fotos where control_id = c.id and foto_path = p_foto_path;
  if v_id is not null then return v_id; end if;

  select coalesce(ia_activa, true) into v_ia from orden_config where local_id = c.local_id;
  insert into orden_fotos (control_id, persona_id, foto_path, ia_estado)
  values (c.id, v_yo, p_foto_path, case when coalesce(v_ia, true) then 'pendiente' else 'omitida' end)
  returning id into v_id;
  update orden_controles set ultimo_intento_id = v_id, nivel_ia = null where id = c.id;
  return v_id;
end $$;

-- "Avisos activos" que vea la supervisión (la tabla de suscripciones sólo deja
-- ver la propia, y la vista decía que nadie los tenía).
create or replace function orden_tiene_avisos(p_persona uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_push_subs s where s.persona_id = p_persona)
$$;
drop view if exists orden_v_personas;
create view orden_v_personas with (security_invoker = true) as
select p.*, l.nombre as local_nombre,
       orden_tiene_avisos(p.id) as avisos_activos,
       (select max(f.tomada_en) from orden_fotos f where f.persona_id = p.id) as ultima_foto
from orden_personas p left join orden_locales l on l.id = p.local_id;

-- Aprobar (o no) a quien entró por primera vez. El vendedor lo aprueba su
-- supervisor o el administrador; al resto, el administrador. Al aprobar a un
-- vendedor, se suma al equipo de la Carga de su local (si ya estaba, se lo une).
-- "No lo conozco" lo desactiva.
create or replace function orden_aprobar_persona(p_persona uuid, p_aprobar boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p orden_personas; l orden_locales; v_lista text; v_eq bigint;
begin
  select * into p from orden_personas where id = p_persona for update;
  if not found then raise exception 'No encontramos a esa persona'; end if;
  if not (case when p.rol = 'vendedor' then orden_es_supervisor_de(p.local_id) else orden_es_admin() end) then
    raise exception 'No podés aprobar a esta persona';
  end if;
  if not p_aprobar then
    update orden_personas set activo = false, aprobado = false where id = p.id;
    return jsonb_build_object('ok', true, 'aprobado', false);
  end if;
  v_eq := p.equipo_id;
  select * into l from orden_locales where id = p.local_id;
  if p.rol = 'vendedor' and l.codigo is not null and v_eq is null then
    v_lista := orden_nombre_lista(p.nombre, p.inicial);
    insert into equipo (local, vendedor, por) values (l.codigo, v_lista, v_lista || ' (desde Impecable)')
    on conflict do nothing;
    select id into v_eq from equipo where lower(trim(local)) = lower(l.codigo) and lower(trim(vendedor)) = lower(v_lista)
     order by activo desc, id limit 1;
  end if;
  update orden_personas set aprobado = true, activo = true, equipo_id = v_eq where id = p.id;
  perform orden_encolar_aviso(p.id, 'aprobado', 'Ya podés usar ' || 'Impecable', 'Tu supervisor te aprobó.', '/hoy',
                              'aprobado:' || p.id || ':' || floor(extract(epoch from now())), 2::smallint);
  return jsonb_build_object('ok', true, 'aprobado', true);
end $$;

-- La cuenta de Auth de una persona (por si "entrar" la creó y no llegó a anotarla).
create or replace function orden_cuenta_de(p_persona uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select u.id from auth.users u where lower(u.email) = lower(orden_mail_cuenta(p_persona)) limit 1
$$;

do $$
begin
  revoke all on function orden_es_del_local(uuid) from public, anon;
  revoke all on function orden_tiene_avisos(uuid) from public, anon;
  revoke all on function orden_aprobar_persona(uuid, boolean) from public, anon;
  revoke all on function orden_cuenta_de(uuid) from public, anon, authenticated;
  grant execute on function orden_es_del_local(uuid) to authenticated, service_role;
  grant execute on function orden_tiene_avisos(uuid) to authenticated, service_role;
  grant execute on function orden_aprobar_persona(uuid, boolean) to authenticated, service_role;
  grant execute on function orden_cuenta_de(uuid) to service_role;
  -- Las redefinidas conservan sus permisos (create or replace no los cambia). La vista se volvió a crear:
  revoke all on table orden_v_personas from anon;
  grant select on table orden_v_personas to authenticated;
  grant all on table orden_v_personas to service_role;
end $$;
