-- ═══ SQL 105 (13/10/2026) · Equipo VDH: el Test de conocimiento ═══
-- Va después del 103 (y del 104, si ya lo corriste; si no, no importa).
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · El "desafío de la semana" pasa a llamarse "Test de conocimiento".
--   · "Mandar un test ahora" desde la administración (Ajustes → Preguntas de
--     los tests): título, preguntas (de un grupo o de un tema) y locales. Les
--     llega "Tenés un test de conocimiento: …".
--   · Los avisos dicen "Equipo VDH" en vez de "Impecable" (el nivel
--     "Impecable" de las fotos queda igual).
--   · Reversible: agrega columnas y una función, y cambia textos. No borra datos.

-- =====================================================================
-- Módulo VDH · Migración 17 (SQL 105): el Test de conocimiento y el nombre
-- nuevo de la app, "Equipo VDH".
--
-- Pedido de Mauricio (13/10/2026):
--   · El "desafío de la semana" pasa a llamarse "Test de conocimiento"
--     (opción múltiple; si le erran, la app explica la correcta).
--   · "Mandar un test ahora" desde la administración: un título ("Colección
--     verano"), las preguntas (de un grupo cargado para eso, o de un tema) y
--     los locales. A cada vendedor aprobado le llega "Tenés un test de
--     conocimiento: Colección verano". Se suma al de la semana (no lo pisa).
--   · La app se llama "Equipo VDH": se cambian los textos de los avisos que
--     decían "Impecable" (el NIVEL "Impecable" de las fotos no se toca).
-- Se puede correr más de una vez. No borra datos.
-- =====================================================================

-- ---------- Columnas ----------
alter table orden_preguntas add column if not exists grupo text;          -- para un test especial: "Colección verano"
alter table orden_desafios add column if not exists titulo text;          -- null = el test de la semana
alter table orden_desafios add column if not exists enviado_por uuid references orden_personas(id) on delete set null;
-- Uno por semana es sólo el semanal: los que se mandan a mano se suman.
alter table orden_desafios drop constraint if exists orden_desafios_persona_id_semana_key;
create unique index if not exists orden_desafios_semanal on orden_desafios (persona_id, semana) where titulo is null;
alter table orden_desafios drop constraint if exists orden_desafios_categoria_check;
alter table orden_desafios add constraint orden_desafios_categoria_check check (categoria in ('producto', 'retail', 'todo', 'grupo'));

-- ---------- Las estadísticas por semana cuentan sólo el test semanal ----------
-- (Si no, con dos tests en la semana se duplicarían los controles de esa persona.)
create or replace view orden_v_persona_semana with (security_invoker = true) as
with ctl as (
  select c.persona_id, c.local_id, (c.fecha - (extract(isodow from c.fecha)::int - 1)) as semana,
         count(*) as controles,
         count(*) filter (where c.enviado_en <= c.vence_en) as controles_a_tiempo,
         count(*) filter (where c.enviado_en > c.vence_en) as controles_tarde,
         count(*) filter (where c.estado = 'vencido') as controles_vencidos,
         avg(case when c.estado = 'vencido' then 1
                  when c.estado in ('enviado', 'revisado')
                    then orden_puntos(coalesce(c.nivel_final, c.nivel_ia, c.nivel_declarado)) end) as puntos,
         count(*) filter (where c.estado = 'vencido'
                             or coalesce(c.nivel_final, c.nivel_ia, c.nivel_declarado) = 'fuera_de_estandar') as fuera_de_estandar
  from orden_controles c
  where c.persona_id is not null and c.tipo <> 'correccion'
  group by 1, 2, 3
), tar as (
  select t.persona_id, t.local_id,
         ((t.vence_en at time zone l.zona_horaria)::date - (extract(isodow from (t.vence_en at time zone l.zona_horaria))::int - 1)) as semana,
         count(*) filter (where t.estado <> 'cancelada') as tareas,
         count(*) filter (where t.estado = 'hecha') as tareas_hechas,
         count(*) filter (where t.estado = 'hecha' and t.completada_a_tiempo) as tareas_a_tiempo,
         count(*) filter (where t.estado = 'vencida' or (t.estado = 'hecha' and t.completada_a_tiempo = false)) as tareas_fuera_de_plazo,
         count(*) filter (where t.estado = 'no_pude') as tareas_no_pude,
         count(*) filter (where t.estado = 'pendiente') as tareas_pendientes,
         count(*) filter (where t.origen = 'ia') as tareas_de_ia
  from orden_tareas t join orden_locales l on l.id = t.local_id
  where t.persona_id is not null
  group by 1, 2, 3
)
select coalesce(ctl.persona_id, tar.persona_id) as persona_id,
       coalesce(ctl.local_id, tar.local_id)     as local_id,
       coalesce(ctl.semana, tar.semana)         as semana,
       pe.nombre as persona_nombre,
       coalesce(ctl.controles, 0)          as controles,
       coalesce(ctl.controles_a_tiempo, 0) as controles_a_tiempo,
       coalesce(ctl.controles_tarde, 0)    as controles_tarde,
       coalesce(ctl.controles_vencidos, 0) as controles_vencidos,
       round(ctl.puntos, 2)                as puntos,
       case when coalesce(ctl.fuera_de_estandar, 0) > 0
            then least(orden_nivel_desde_puntos(ctl.puntos), 'bien'::orden_nivel)
            else orden_nivel_desde_puntos(ctl.puntos) end as nivel_semana,
       coalesce(tar.tareas, 0)                as tareas,
       coalesce(tar.tareas_hechas, 0)         as tareas_hechas,
       coalesce(tar.tareas_a_tiempo, 0)       as tareas_a_tiempo,
       coalesce(tar.tareas_fuera_de_plazo, 0) as tareas_fuera_de_plazo,
       coalesce(tar.tareas_no_pude, 0)        as tareas_no_pude,
       coalesce(tar.tareas_pendientes, 0)     as tareas_pendientes,
       coalesce(tar.tareas_de_ia, 0)          as tareas_de_ia,
       de.puntaje                             as desafio_puntaje,  -- null = no tenía test esa semana
       de.total                               as desafio_total,
       (de.terminado_en is not null)          as desafio_terminado
from ctl
full join tar on tar.persona_id = ctl.persona_id and tar.semana = ctl.semana
left join orden_personas pe on pe.id = coalesce(ctl.persona_id, tar.persona_id)
left join orden_desafios de on de.persona_id = coalesce(ctl.persona_id, tar.persona_id)
                           and de.semana = coalesce(ctl.semana, tar.semana)
                           and de.titulo is null;

-- ---------- El test que ve el vendedor: primero el que tiene abierto ----------
create or replace function orden_desafio_mio()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d orden_desafios; v_yo uuid := orden_yo_id();
begin
  select * into d from orden_desafios where persona_id = v_yo
   order by (terminado_en is null and vence_en > now()) desc, creado_en desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', d.id, 'semana', d.semana, 'categoria', d.categoria, 'dificultad', d.dificultad, 'titulo', d.titulo,
    'vence_en', d.vence_en, 'terminado_en', d.terminado_en,
    'puntaje', d.puntaje, 'total', d.total,
    'abiertos', (select count(*)::int from orden_desafios o where o.persona_id = v_yo and o.terminado_en is null and o.vence_en > now()),
    'preguntas', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'tema', q.tema, 'pregunta', q.pregunta, 'imagen_path', q.imagen_path, 'opciones', to_jsonb(q.opciones),
        'respondida', d.respuestas ? q.id::text,
        'elegida', (d.respuestas ->> q.id::text)::int,
        'correcta', case when d.respuestas ? q.id::text then q.correcta end,
        'explicacion', case when d.respuestas ? q.id::text then q.explicacion end)
        order by x.pos)
      from unnest(d.preguntas) with ordinality x(pid, pos) join orden_preguntas q on q.id = x.pid));
end $$;

-- ---------- Mandar un test ahora (el administrador, o el supervisor en su local) ----------
-- p_grupo: las preguntas de ese grupo ("Colección verano"); si no, p_tema:
-- 'producto' (telas y molderías), 'retail' (cómo trabajamos) o 'todo'.
-- Las mismas preguntas para todos (así se puede comparar). Vence en p_dias.
create or replace function orden_test_mandar(p_locales uuid[], p_titulo text, p_grupo text, p_tema text, p_cantidad int, p_dias int default 2)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_titulo text := nullif(trim(coalesce(p_titulo, '')), ''); v_grupo text := nullif(trim(coalesce(p_grupo, '')), '');
  v_tema text := case when p_tema in ('producto', 'retail') then p_tema else 'todo' end;
  v_preg uuid[]; v_loc uuid; p record; v_id uuid; v_n int := 0;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_titulo is null then raise exception 'Ponele un título al test (por ejemplo: Colección verano)'; end if;
  if length(v_titulo) > 60 then raise exception 'El título es muy largo (hasta 60 letras)'; end if;
  if coalesce(array_length(p_locales, 1), 0) = 0 then raise exception 'Elegí al menos un local'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 20 then raise exception 'De 1 a 20 preguntas'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 14 then raise exception 'Que venza en 1 a 14 días'; end if;
  foreach v_loc in array p_locales loop
    if not orden_es_supervisor_de(v_loc) or orden_es_gerencia() then
      raise exception 'No podés mandar el test en %', coalesce((select nombre from orden_locales where id = v_loc), 'ese local');
    end if;
  end loop;
  select array_agg(id) into v_preg from (
    select q.id from orden_preguntas q
     where q.activo
       and case when v_grupo is not null then lower(trim(q.grupo)) = lower(v_grupo)
                when v_tema = 'producto' then q.tema in ('tela', 'molderia')
                when v_tema = 'retail' then q.tema = 'retail'
                else true end
     order by random() limit p_cantidad) x;
  if v_preg is null then
    raise exception 'No hay preguntas activas %', case when v_grupo is not null then 'del grupo "' || v_grupo || '"' else 'de ese tema' end;
  end if;
  for p in select pe.id, pe.local_id from orden_personas pe
            where pe.local_id = any (p_locales) and pe.activo and pe.aprobado and pe.rol = 'vendedor' loop
    insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, titulo, enviado_por)
    values (p.local_id, p.id, v_hoy - (extract(isodow from v_hoy)::int - 1), case when v_grupo is not null then 'grupo' else v_tema end, 1,
            v_preg, array_length(v_preg, 1), now() + make_interval(days => p_dias), v_titulo, orden_yo_id())
    returning id into v_id;
    perform orden_encolar_aviso(p.id, 'desafio', 'Tenés un test de conocimiento: ' || v_titulo,
      array_length(v_preg, 1) || ' preguntas de opción múltiple. Si le errás, no pasa nada: es para aprender.',
      '/desafio', 'test:' || v_id, 2::smallint);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'personas', v_n, 'preguntas', array_length(v_preg, 1));
end $$;

-- ---------- Los textos de las funciones que ya existen ----------
-- "Desafío" → "Test de conocimiento" y la app "Impecable" → "Equipo VDH".
-- Se reemplazan frases exactas en el cuerpo de cada función (el nivel
-- "Impecable" de las fotos no aparece en ninguna de estas frases).
do $$
declare f record; v_def text; v_nuevo text;
  v_cambios text[][] := array[
    ['Llegó tu desafío de la semana', 'Llegó tu test de conocimiento'],
    ['Hoy cierra tu desafío', 'Hoy cierra tu test de conocimiento'],
    ['Este desafío no es tuyo', 'Este test no es tuyo'],
    ['Ya terminaste el desafío de esta semana', 'Ya terminaste este test'],
    ['El desafío de esta semana ya cerró', 'Este test ya cerró'],
    ['Esa pregunta no es de tu desafío', 'Esa pregunta no es de tu test'],
    ['Ya podés usar Impecable', 'Ya podés usar Equipo VDH'],
    ['Ya podés usar '' || ''Impecable''', 'Ya podés usar Equipo VDH'''],
    [', ''Impecable'')', ', ''Equipo VDH'')'],
    [' (desde Impecable)', ' (desde Equipo VDH)']];
  i int;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and (p.proname like 'orden%' or p.proname like 'testigo%')
              and (p.prosrc like '%desafío%' or p.prosrc like '%Impecable%') loop
    v_def := pg_get_functiondef(f.oid);
    v_nuevo := v_def;
    for i in 1..array_length(v_cambios, 1) loop
      v_nuevo := replace(v_nuevo, v_cambios[i][1], v_cambios[i][2]);
    end loop;
    if v_nuevo <> v_def then execute v_nuevo; end if;
  end loop;
end $$;

-- ---------- Permisos ----------
do $$
begin
  revoke all on function orden_test_mandar(uuid[], text, text, text, int, int) from public, anon;
  grant execute on function orden_test_mandar(uuid[], text, text, text, int, int) to authenticated, service_role;
end $$;

select 'listo: el Test de conocimiento y Equipo VDH' as "SQL 105";
