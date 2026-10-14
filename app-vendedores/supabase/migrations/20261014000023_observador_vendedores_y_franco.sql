-- =====================================================================
-- Módulo VDH · Migración 23 (SQL 113), 14/10/2026. Dos pedidos de Mauricio:
--
-- (1) "Los vendedores también lo pueden ver": el modo observador del croquis
--     muestra la foto, el nivel y lo que vio la IA de cada módulo del local.
--     Hoy un vendedor sólo ve los controles que sacó él (la regla de
--     orden_controles), así que los de sus compañeros le aparecerían "sin foto".
--     Dos funciones para mirar el local entero, sólo para quien es del local
--     (o administración y gerencia): orden_visor_estado y orden_visor_historia.
--     No cambian ninguna regla de las tablas.
--
-- (2) "Si está de franco, que le llegue al otro día cuando esté en el trabajo":
--     el aviso de una tarea nueva (las que manda el supervisor o el
--     administrador, también las sugerencias del croquis) a alguien que hoy no
--     trabaja, o fuera del horario del local, queda "programado" para la hora
--     de apertura de su próximo día de trabajo. Cada 10 minutos la base pasa a
--     "pendiente" los que ya llegaron a su hora, y el reloj (tick) los manda
--     como siempre. El vencimiento de la tarea ya salteaba los francos.
--
-- Reversible: (1) borrar las 2 funciones. (2) volver orden_crear_tarea a como
-- estaba (está en la migración 1), sacar el trabajo del reloj
-- (select cron.unschedule('orden-avisos-programados')) y pasar a 'pendiente'
-- los que hayan quedado 'programado'. La columna enviar_desde y el valor
-- 'programado' pueden quedar (no molestan).
-- =====================================================================

-- ---------- (1) Mirar el local entero ----------

create or replace function orden_visor_estado(p_local uuid)
returns table (modulo_id uuid, foto_path text, tomada_en timestamptz, nivel text, foto_de text,
               sin_foto_reciente boolean, tareas_abiertas bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_local is null or not orden_ve_local(p_local) then raise exception 'No podés ver este local'; end if;
  return query
    select e.modulo_id, e.foto_path, e.tomada_en, e.nivel::text, e.foto_de::text, e.sin_foto_reciente, e.tareas_abiertas::bigint
      from orden_v_estado_local e
     where e.local_id = p_local;
end $$;

create or replace function orden_visor_historia(p_modulo uuid)
returns table (id uuid, foto_path text, tomada_en timestamptz, nivel text, nivel_ia text, nivel_final text,
               persona_nombre text, ia_resultado jsonb, comentario text)
language plpgsql stable security definer set search_path = public as $$
declare v_local uuid;
begin
  select s.local_id into v_local from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = p_modulo;
  if v_local is null or not orden_ve_local(v_local) then raise exception 'No podés ver este módulo'; end if;
  return query
    select c.id, c.foto_path, c.tomada_en, c.nivel::text, c.nivel_ia::text, c.nivel_final::text, c.persona_nombre::text,
           c.ia_resultado, c.comentario::text
      from orden_v_controles c
     where c.modulo_id = p_modulo and c.foto_path is not null
     order by c.tomada_en desc
     limit 12;
end $$;

-- ---------- (2) Los avisos de tareas, cuando esté en el trabajo ----------

alter type orden_aviso_estado add value if not exists 'programado';
alter table orden_avisos add column if not exists enviar_desde timestamptz;
create index if not exists orden_avisos_programados on orden_avisos (enviar_desde) where enviar_desde is not null;

-- Si la persona hoy no trabaja (franco, ausencia, local cerrado) o el local ya cerró, el aviso queda programado para
-- la apertura de su próximo día de trabajo; si todavía no abrió, para la apertura de hoy. Si está en horario, sale ya.
create or replace function orden_programar_aviso_(p_aviso uuid, p_persona uuid, p_ahora timestamptz default now())
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_local uuid; v_hoy date; v_hora time; v_abre time; v_cierra time; v_dia date;
begin
  if p_aviso is null or p_persona is null then return; end if;
  select local_id into v_local from orden_personas where id = p_persona;
  if v_local is null then return; end if;
  select coalesce(hora_apertura, '10:00'::time), coalesce(hora_cierre, '20:00'::time) into v_abre, v_cierra
    from orden_locales where id = v_local;
  v_hoy := orden_fecha_local(v_local, p_ahora);
  v_hora := orden_hora_local(v_local, p_ahora);
  v_dia := case when orden_trabaja(p_persona, v_hoy) and v_hora < v_cierra then v_hoy
                else orden_proximo_dia_laboral(p_persona, v_hoy) end;
  if v_dia = v_hoy and v_hora >= v_abre then return; end if;
  update orden_avisos set estado = 'programado', enviar_desde = orden_en_hora(v_local, v_dia, v_abre)
   where id = p_aviso and estado = 'pendiente';
end $$;

-- Los programados que ya llegaron a su hora pasan a pendientes (con la hora de ahora, así se ven como nuevos).
create or replace function orden_avisos_liberar_()
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_n int;
begin
  update orden_avisos set estado = 'pendiente', creado_en = now()
   where estado = 'programado' and enviar_desde <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- orden_crear_tarea, igual que antes pero programando el aviso. Si la función de la base no es la que se espera
-- (alguien la cambió), se frena sin tocar nada.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'orden_crear_tarea';
  if position('orden_programar_aviso_' in d) = 0 and position($q$perform orden_encolar_aviso(v_persona, 'tarea_nueva'$q$ in d) = 0 then
    raise exception 'orden_crear_tarea no es la que se esperaba: no se cambió nada';
  end if;
end $$;

create or replace function orden_crear_tarea(
  p_personas uuid[], p_titulo text, p_detalle text default null, p_modulo uuid default null,
  p_plazo orden_plazo default null, p_requiere_foto boolean default false)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_persona uuid; v_local uuid; v_plazo orden_plazo; v_id uuid; v_yo uuid := orden_yo_id();
  v_origen orden_tarea_origen; v_aviso uuid;
begin
  if coalesce(trim(p_titulo), '') = '' then raise exception 'La tarea necesita un título'; end if;
  v_origen := case when orden_es_servicio() or exists (select 1 from orden_personas where id = v_yo and rol = 'admin')
                   then 'admin' else 'supervisor' end;

  foreach v_persona in array p_personas loop
    select local_id into v_local from orden_personas where id = v_persona and activo;
    if v_local is null then raise exception 'Persona no encontrada o sin local'; end if;
    if not orden_es_supervisor_de(v_local) then raise exception 'No podés asignar tareas en ese local'; end if;

    select coalesce(p_plazo, c.plazo_tarea_default, 'manana') into v_plazo
    from orden_locales l left join orden_config c on c.local_id = l.id where l.id = v_local;

    insert into orden_tareas (local_id, persona_id, modulo_id, origen, titulo, detalle, requiere_foto,
                              plazo, vence_en, creada_por)
    values (v_local, v_persona, p_modulo, v_origen, trim(p_titulo), nullif(trim(p_detalle), ''),
            coalesce(p_requiere_foto, false), v_plazo, orden_calcular_vencimiento(v_persona, v_plazo), v_yo)
    returning id into v_id;

    v_aviso := orden_encolar_aviso(v_persona, 'tarea_nueva', 'Nueva tarea: ' || trim(p_titulo),
      'Vence ' || to_char((select vence_en from orden_tareas where id = v_id)
                 at time zone (select zona_horaria from orden_locales where id = v_local), 'DD/MM HH24:MI'),
      '/tareas', 'tarea:' || v_id, 2::smallint);
    -- De franco o fuera de horario: el aviso sale cuando esté en el trabajo.
    perform orden_programar_aviso_(v_aviso, v_persona);
    return next v_id;
  end loop;
end $$;

-- El reloj: cada 10 minutos, los programados que ya llegaron a su hora.
do $$
begin
  perform cron.schedule('orden-avisos-programados', '*/10 * * * *', 'select orden_avisos_liberar_()');
end $$;

do $$
begin
  revoke all on function orden_visor_estado(uuid) from public, anon;
  grant execute on function orden_visor_estado(uuid) to authenticated, service_role;
  revoke all on function orden_visor_historia(uuid) from public, anon;
  grant execute on function orden_visor_historia(uuid) to authenticated, service_role;
  revoke all on function orden_programar_aviso_(uuid, uuid, timestamptz) from public, anon, authenticated;
  grant execute on function orden_programar_aviso_(uuid, uuid, timestamptz) to service_role;
  revoke all on function orden_avisos_liberar_() from public, anon, authenticated;
  grant execute on function orden_avisos_liberar_() to service_role;
  revoke all on function orden_crear_tarea(uuid[], text, text, uuid, orden_plazo, boolean) from public, anon;
  grant execute on function orden_crear_tarea(uuid[], text, text, uuid, orden_plazo, boolean) to authenticated, service_role;
end $$;
