-- SQL 132 (migración 38): tareas con foto para mirar y corregir, y el frontal nuevo adentro del control.
--   1. Tareas: el supervisor mira la foto de la tarea hecha y la da por buena o la manda a corregir con un
--      mensaje ("corregí esto"); le vuelve a la persona como pendiente, con aviso, hasta que manda otra foto.
--   2. Frontal nuevo: cada N semanas (se elige en Ajustes, arranca apagado), el control del día es con el
--      frontal nuevo: una foto por módulo sirve de control y de prueba del cambio. La tarea suelta de los
--      jueves ("Cambio de imagen: renovar los frontales") se apaga en todos los locales.
--   3. Los supervisores de varios locales (sin local fijo) pueden ver las fotos y los videos de sus locales.
-- Se puede correr dos veces. Reversible: la vuelta atrás está al final.

-- 1. Tareas: revisión y corrección
alter table orden_tareas
  add column if not exists correccion text,
  add column if not exists correccion_en timestamptz,
  add column if not exists correcciones jsonb not null default '[]'::jsonb,
  add column if not exists revisada_en timestamptz,
  add column if not exists revisada_por uuid references orden_personas(id);

-- 2. Frontal nuevo
alter table orden_config
  add column if not exists frontal_cada_semanas smallint,
  add column if not exists frontal_desde date;
alter table orden_controles add column if not exists frontal boolean not null default false;

-- Las vistas: las mismas columnas de antes y las nuevas al final
create or replace view orden_v_tareas with (security_invoker = true) as
 SELECT t.id, t.local_id, t.persona_id, t.modulo_id, t.control_id, t.foto_origen_id, t.origen, t.titulo, t.detalle,
    t.requiere_foto, t.estado, t.plazo, t.vence_en, t.vence_original, t.completada_en, t.completada_a_tiempo, t.foto_path,
    t.motivo_no_pude, t.prorroga_estado, t.prorroga_motivo, t.prorroga_pedida_en, t.prorroga_respondida_por, t.creada_por,
    t.clave, t.creado_en,
    pe.nombre AS persona_nombre,
    m.nombre AS modulo_nombre,
    t.estado = 'vencida'::orden_tarea_estado OR t.estado = 'hecha'::orden_tarea_estado AND t.completada_a_tiempo = false AS fuera_de_plazo,
    t.correccion, t.correccion_en, t.correcciones, t.revisada_en
   FROM orden_tareas t
     LEFT JOIN orden_personas pe ON pe.id = t.persona_id
     LEFT JOIN orden_modulos m ON m.id = t.modulo_id;

create or replace view orden_v_controles with (security_invoker = true) as
 SELECT c.id, c.local_id, c.modulo_id, c.persona_id, c.fecha, c.tipo, c.estado, c.vence_en, c.ultimo_intento_id,
    c.respuestas, c.nivel_declarado, c.nivel_ia, c.discrepancia, c.enviado_en, c.enviado_con_problemas, c.nivel_final,
    c.revisado_por, c.revisado_en, c.comentario, c.creado_en,
    m.numero AS modulo_numero,
    m.nombre AS modulo_nombre,
    m.foto_referencia_path,
    s.tipo AS sector_tipo,
    s.numero AS sector_numero,
    pe.nombre AS persona_nombre,
    f.foto_path, f.ia_estado, f.ia_resultado, f.tomada_en,
    COALESCE(c.nivel_final, c.nivel_ia, c.nivel_declarado) AS nivel,
    c.enviado_en IS NOT NULL AND c.enviado_en <= c.vence_en AS a_tiempo,
    orden_mueble(m.mueble, m.isla, m.nombre, s.tipo) AS mueble,
    c.frontal
   FROM orden_controles c
     JOIN orden_modulos m ON m.id = c.modulo_id
     JOIN orden_sectores s ON s.id = m.sector_id
     LEFT JOIN orden_personas pe ON pe.id = c.persona_id
     LEFT JOIN orden_fotos f ON f.id = c.ultimo_intento_id;

create or replace view orden_v_por_revisar with (security_invoker = true) as
 SELECT id, local_id, modulo_id, persona_id, fecha, tipo, estado, vence_en, ultimo_intento_id, respuestas, nivel_declarado,
    nivel_ia, discrepancia, enviado_en, enviado_con_problemas, nivel_final, revisado_por, revisado_en, comentario, creado_en,
    modulo_numero, modulo_nombre, foto_referencia_path, sector_tipo, sector_numero, persona_nombre, foto_path, ia_estado,
    ia_resultado, tomada_en, nivel, a_tiempo, mueble, frontal
   FROM orden_v_controles
  WHERE estado = 'enviado'::orden_control_estado
  ORDER BY discrepancia DESC, (orden_puntos(nivel)) NULLS FIRST, enviado_en;

-- El supervisor (o el admin) mira la tarea hecha: bien, o a corregir con un mensaje
create or replace function orden_tarea_revisar(p_tarea uuid, p_bien boolean, p_mensaje text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t orden_tareas; v_yo uuid := orden_yo_id(); v_msg text := left(nullif(trim(coalesce(p_mensaje, '')), ''), 500);
  v_vence timestamptz; v_aviso uuid; v_n int;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if not orden_es_supervisor_de(t.local_id) then raise exception 'No podés revisar tareas de ese local'; end if;
  if t.estado <> 'hecha' then raise exception 'Esa tarea ya no está hecha: la están corrigiendo o se cerró'; end if;

  if p_bien then
    update orden_tareas set revisada_en = now(), revisada_por = v_yo where id = t.id;
    return jsonb_build_object('tarea_id', t.id, 'bien', true);
  end if;

  if v_msg is null then raise exception 'Escribí qué hay que corregir'; end if;
  v_vence := orden_calcular_vencimiento(t.persona_id, 'hoy', now());
  update orden_tareas
     set estado = 'pendiente', requiere_foto = true, correccion = v_msg, correccion_en = now(),
         correcciones = correcciones || jsonb_build_array(jsonb_build_object(
           'mensaje', v_msg, 'en', now(), 'por', v_yo, 'foto_path', t.foto_path,
           'completada_en', t.completada_en, 'a_tiempo', t.completada_a_tiempo)),
         revisada_en = now(), revisada_por = v_yo, completada_en = null, completada_a_tiempo = null, vence_en = v_vence
   where id = t.id
  returning jsonb_array_length(correcciones) into v_n;

  v_aviso := orden_encolar_aviso(t.persona_id, 'tarea_corregir', 'Corregí: ' || t.titulo, v_msg, '/tareas',
                                 'corr:' || t.id || ':' || v_n, 2::smallint);
  -- De franco o fuera de horario: el aviso sale cuando esté en el trabajo.
  perform orden_programar_aviso_(v_aviso, t.persona_id);
  return jsonb_build_object('tarea_id', t.id, 'bien', false, 'vence_en', v_vence);
end $$;
revoke all on function orden_tarea_revisar(uuid, boolean, text) from public, anon;
grant execute on function orden_tarea_revisar(uuid, boolean, text) to authenticated;

-- ¿Ese día el control es con el frontal nuevo? El primer día de control de la semana, cada N semanas desde la elegida.
create or replace function orden_es_dia_frontal(p_local uuid, p_fecha date)
returns boolean language sql stable set search_path = public as $$
  select coalesce((
    select c.frontal_cada_semanas between 1 and 8 and c.frontal_desde is not null
       and p_fecha >= c.frontal_desde - (extract(isodow from c.frontal_desde)::int - 1)
       and ((p_fecha - (extract(isodow from p_fecha)::int - 1))
            - (c.frontal_desde - (extract(isodow from c.frontal_desde)::int - 1))) / 7 % c.frontal_cada_semanas = 0
       and extract(isodow from p_fecha)::int = (select min(d) from unnest(c.dias_control) d)
      from orden_config c where c.local_id = p_local), false)
$$;
revoke all on function orden_es_dia_frontal(uuid, date) from public, anon;
grant execute on function orden_es_dia_frontal(uuid, date) to authenticated;

-- Los controles del día se marcan solos al nacer (los arma orden_tick)
create or replace function orden_controles_frontal_()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipo = 'programado' and not new.frontal and orden_es_dia_frontal(new.local_id, new.fecha) then
    new.frontal := true;
  end if;
  return new;
end $$;
revoke all on function orden_controles_frontal_() from public, anon, authenticated;
drop trigger if exists orden_controles_frontal on orden_controles;
create trigger orden_controles_frontal before insert on orden_controles
  for each row execute function orden_controles_frontal_();

-- Se apaga la tarea suelta de los jueves (antes: el 4, en los 14 locales)
update orden_config set cambio_imagen_dia = null where cambio_imagen_dia is not null;
alter table orden_config alter column cambio_imagen_dia set default null;

-- 3. Supervisores de varios locales: las fotos y los videos de sus locales
create or replace function orden_supervisa_carpeta(p_carpeta text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_carpeta ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              then orden_supervisa(p_carpeta::uuid) else false end
$$;
revoke all on function orden_supervisa_carpeta(text) from public, anon;
grant execute on function orden_supervisa_carpeta(text) to authenticated;

alter policy "orden: ver fotos de mi local" on storage.objects using (
  (bucket_id = 'orden-fotos'::text) AND (orden_es_admin() OR orden_es_gerencia()
    OR (((storage.foldername(name))[1] = 'preguntas'::text) AND (orden_yo_id() IS NOT NULL))
    OR (EXISTS ( SELECT 1 FROM orden_personas p
          WHERE ((p.auth_user_id = auth.uid()) AND p.activo AND p.aprobado
            AND ((p.local_id)::text = (storage.foldername(objects.name))[1])
            AND (((storage.foldername(objects.name))[2] IS DISTINCT FROM 'cajas'::text) OR orden_es_supervisor_de(p.local_id)
                 OR ((storage.foldername(objects.name))[3] >= ((orden_dia_caja(p.local_id) - 1))::text)))))
    OR orden_supervisa_carpeta((storage.foldername(name))[1])));

alter policy "testigo: ver videos de mi local" on storage.objects using (
  (bucket_id = 'testigo-videos'::text) AND (orden_es_admin() OR orden_es_gerencia()
    OR (EXISTS ( SELECT 1 FROM orden_personas p
          WHERE ((p.auth_user_id = auth.uid()) AND p.activo AND p.aprobado
            AND (p.rol = ANY (ARRAY['vendedor'::orden_rol, 'supervisor'::orden_rol]))
            AND ((p.local_id)::text = (storage.foldername(objects.name))[1]))))
    OR orden_supervisa_carpeta((storage.foldername(name))[1])));

-- Cómo quedó
select (select count(*) from information_schema.columns where table_name = 'orden_v_tareas' and column_name in ('correccion', 'correcciones', 'revisada_en')) as tareas_ok,
       (select count(*) from information_schema.columns where table_name = 'orden_v_por_revisar' and column_name = 'frontal') as frontal_ok,
       (select count(*) from orden_config where cambio_imagen_dia is not null) as jueves_prendidos,
       (select count(*) from pg_trigger where tgname = 'orden_controles_frontal') as marca_frontal;

-- Vuelta atrás (sólo si hiciera falta):
-- update orden_config set cambio_imagen_dia = 4; alter table orden_config alter column cambio_imagen_dia set default 4;
-- drop trigger if exists orden_controles_frontal on orden_controles;
-- (las columnas nuevas y orden_tarea_revisar pueden quedar: no molestan; las políticas vuelven sacando la última línea "OR orden_supervisa_carpeta(...)")
