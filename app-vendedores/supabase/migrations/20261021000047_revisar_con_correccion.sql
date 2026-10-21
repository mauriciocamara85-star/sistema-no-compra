-- ════════════════════════════════════════════════════════════════════════
-- Migración 47 (SQL 150, 21/10/2026, pedido de Mauricio): revisar con corrección
--   · Al revisar una foto se puede dejar una sugerencia, marcar en la foto
--     dónde está lo que hay que corregir (círculos numerados) y pedirle que
--     lo corrija y mande otra foto aunque le pongas "Bien" ("le falta una
--     camisa a cada pila, que sean cuatro"). Con "A mejorar" o "Fuera de
--     estándar" se le pide siempre, como antes.
--   · El nivel NO cambia con la corrección: es cómo estaba el módulo el día
--     del control (si no, convendría dejarlo mal y arreglarlo después).
--   · La foto corregida vuelve al supervisor con la de antes al lado
--     (Antes | Ahora): "Quedó bien" o "Pedir otra corrección" (también con
--     marcas). Ya no entra en la cola de fotos para calificar.
--   · Se puede revisar desde la compu, y cambiar una revisión ya hecha.
-- Deshacer: deshacer-150.sql.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Las columnas nuevas
alter table orden_controles add column if not exists marcas jsonb;
alter table orden_controles add column if not exists correccion_pedida boolean not null default false;
alter table orden_controles add column if not exists tarea_id uuid references orden_tareas(id) on delete set null;
create index if not exists orden_controles_tarea on orden_controles (tarea_id) where tarea_id is not null;
comment on column orden_controles.marcas is 'Dónde marcó el supervisor en la foto (SQL 150): [{x, y}] de 0 a 1 sobre la foto, numeradas en ese orden';
comment on column orden_controles.correccion_pedida is 'Al revisarla, le pidió que la corrija y mande otra foto (SQL 150)';
comment on column orden_controles.tarea_id is 'Si es la foto de una corrección: de qué tarea (SQL 150)';

alter table orden_tareas add column if not exists foto_antes text;
alter table orden_tareas add column if not exists marcas jsonb;
comment on column orden_tareas.foto_antes is 'La foto sobre la que se pide la corrección (SQL 150): la del control, o la que mandó y se le pidió corregir de nuevo';
comment on column orden_tareas.marcas is 'Las marcas sobre foto_antes (SQL 150)';

-- 2. Las marcas, limpias: hasta 9, cada una con x e y entre 0 y 1. Sin marcas, null.
create or replace function orden_marcas_(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare r jsonb := '[]'; e jsonb;
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 9 then raise exception 'Las marcas de la foto no son válidas (como mucho 9)'; end if;
  for e in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'x') is distinct from 'number' or jsonb_typeof(e -> 'y') is distinct from 'number'
       or (e ->> 'x')::numeric not between 0 and 1 or (e ->> 'y')::numeric not between 0 and 1 then
      raise exception 'Las marcas de la foto no son válidas';
    end if;
    r := r || jsonb_build_array(jsonb_build_object('x', round((e ->> 'x')::numeric, 4), 'y', round((e ->> 'y')::numeric, 4)));
  end loop;
  return nullif(r, '[]'::jsonb);
end $$;
revoke all on function orden_marcas_(jsonb) from public, anon;
grant execute on function orden_marcas_(jsonb) to authenticated, service_role;

-- 3. Las vistas, con lo nuevo al final (security_invoker se repite: create or replace view lo borraría).
create or replace view orden_v_controles with (security_invoker = true) as
 SELECT c.id,
    c.local_id,
    c.modulo_id,
    c.persona_id,
    c.fecha,
    c.tipo,
    c.estado,
    c.vence_en,
    c.ultimo_intento_id,
    c.respuestas,
    c.nivel_declarado,
    c.nivel_ia,
    c.discrepancia,
    c.enviado_en,
    c.enviado_con_problemas,
    c.nivel_final,
    c.revisado_por,
    c.revisado_en,
    c.comentario,
    c.creado_en,
    m.numero AS modulo_numero,
    m.nombre AS modulo_nombre,
    m.foto_referencia_path,
    s.tipo AS sector_tipo,
    s.numero AS sector_numero,
    pe.nombre AS persona_nombre,
    f.foto_path,
    f.ia_estado,
    f.ia_resultado,
    f.tomada_en,
    COALESCE(c.nivel_final, c.nivel_ia, c.nivel_declarado) AS nivel,
    c.enviado_en IS NOT NULL AND c.enviado_en <= c.vence_en AS a_tiempo,
    orden_mueble(m.mueble, m.isla, m.nombre, s.tipo) AS mueble,
    c.frontal,
    c.marcas,
    c.correccion_pedida,
    c.tarea_id
   FROM orden_controles c
     JOIN orden_modulos m ON m.id = c.modulo_id
     JOIN orden_sectores s ON s.id = m.sector_id
     LEFT JOIN orden_personas pe ON pe.id = c.persona_id
     LEFT JOIN orden_fotos f ON f.id = c.ultimo_intento_id;

-- La cola para calificar: sin las fotos de las correcciones (ésas se miran con la tarea, Antes | Ahora).
create or replace view orden_v_por_revisar with (security_invoker = true) as
 SELECT id,
    local_id,
    modulo_id,
    persona_id,
    fecha,
    tipo,
    estado,
    vence_en,
    ultimo_intento_id,
    respuestas,
    nivel_declarado,
    nivel_ia,
    discrepancia,
    enviado_en,
    enviado_con_problemas,
    nivel_final,
    revisado_por,
    revisado_en,
    comentario,
    creado_en,
    modulo_numero,
    modulo_nombre,
    foto_referencia_path,
    sector_tipo,
    sector_numero,
    persona_nombre,
    foto_path,
    ia_estado,
    ia_resultado,
    tomada_en,
    nivel,
    a_tiempo,
    mueble,
    frontal
   FROM orden_v_controles
  WHERE estado = 'enviado'::orden_control_estado AND tipo <> 'correccion'::orden_control_tipo
  ORDER BY discrepancia DESC, (orden_puntos(nivel)) NULLS FIRST, enviado_en;

create or replace view orden_v_tareas with (security_invoker = true) as
 SELECT t.id,
    t.local_id,
    t.persona_id,
    t.modulo_id,
    t.control_id,
    t.foto_origen_id,
    t.origen,
    t.titulo,
    t.detalle,
    t.requiere_foto,
    t.estado,
    t.plazo,
    t.vence_en,
    t.vence_original,
    t.completada_en,
    t.completada_a_tiempo,
    t.foto_path,
    t.motivo_no_pude,
    t.prorroga_estado,
    t.prorroga_motivo,
    t.prorroga_pedida_en,
    t.prorroga_respondida_por,
    t.creada_por,
    t.clave,
    t.creado_en,
    pe.nombre AS persona_nombre,
    m.nombre AS modulo_nombre,
    t.estado = 'vencida'::orden_tarea_estado OR t.estado = 'hecha'::orden_tarea_estado AND t.completada_a_tiempo = false AS fuera_de_plazo,
    t.correccion,
    t.correccion_en,
    t.correcciones,
    t.revisada_en,
    t.foto_antes,
    t.marcas,
    m.foto_referencia_path AS modulo_referencia,
    COALESCE(c.nivel_final, c.nivel_ia, c.nivel_declarado) AS control_nivel,
    ( SELECT x.nivel_ia
           FROM orden_controles x
          WHERE x.tarea_id = t.id
          ORDER BY x.enviado_en DESC
         LIMIT 1) AS ia_correccion
   FROM orden_tareas t
     LEFT JOIN orden_personas pe ON pe.id = t.persona_id
     LEFT JOIN orden_modulos m ON m.id = t.modulo_id
     LEFT JOIN orden_controles c ON c.id = t.control_id;

-- 4. Revisar una foto: el nivel, la sugerencia, las marcas y si le pide la corrección.
--    p_corregir null (la app de antes): como antes, sólo con "A mejorar" o peor.
drop function if exists orden_revisar_control(uuid, orden_nivel, text, uuid);
create function orden_revisar_control(p_control uuid, p_nivel orden_nivel, p_comentario text default null, p_foto uuid default null,
                                      p_corregir boolean default null, p_marcas jsonb default null)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  a orden_controles; c orden_controles; m orden_modulos; t orden_tareas;
  v_base orden_nivel; v_coment text := left(nullif(trim(p_comentario), ''), 500); v_marcas jsonb := orden_marcas_(p_marcas);
  v_plazo orden_plazo; v_corr boolean; v_antes text; v_titulo text; v_clave text; v_aviso uuid;
begin
  select * into a from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if not orden_es_supervisor_de(a.local_id) then raise exception 'Solo el supervisor del local puede revisar'; end if;
  if a.estado not in ('enviado', 'revisado') then raise exception 'Este control todavía no fue enviado'; end if;
  if a.tarea_id is not null then
    raise exception 'Esta foto es la corrección de una tarea: se revisa con «Quedó bien» o «Pedir otra corrección»';
  end if;
  if p_foto is not null and p_foto is distinct from a.ultimo_intento_id then
    raise exception 'Cambió la foto mientras la mirabas: mirala de nuevo';
  end if;

  v_base := coalesce(a.nivel_ia, a.nivel_declarado);
  if v_base is not null and abs(orden_puntos(p_nivel) - orden_puntos(v_base)) > 1 and v_coment is null then
    raise exception 'Para cambiar más de un nivel, dejá un comentario';
  end if;

  -- Con "A mejorar" o peor se pide siempre; con "Bien" o "Impecable", si lo pidió (y diciendo qué).
  v_corr := (p_nivel <= 'a_mejorar' or coalesce(p_corregir, false)) and a.persona_id is not null;
  if v_corr and p_nivel > 'a_mejorar' and v_coment is null then raise exception 'Escribí qué tiene que corregir'; end if;

  select f.foto_path into v_antes from orden_fotos f where f.id = a.ultimo_intento_id;

  update orden_controles
     set nivel_final = p_nivel, revisado_por = orden_yo_id(), revisado_en = now(),
         comentario = v_coment, marcas = v_marcas, correccion_pedida = v_corr, estado = 'revisado'
   where id = a.id
  returning * into c;

  select * into m from orden_modulos where id = c.modulo_id;
  v_titulo := left(m.nombre || ': ' || coalesce(v_coment, 'mejorar el orden'), 140);

  -- La tarea de la corrección: una por foto revisada (clave rev:<control>).
  select * into t from orden_tareas where clave = 'rev:' || c.id and persona_id = c.persona_id order by creado_en desc limit 1;
  if v_corr then
    if t.id is not null and t.estado in ('pendiente', 'vencida') then
      -- Cambió la revisión: la misma tarea, con lo nuevo.
      update orden_tareas set titulo = v_titulo, detalle = v_coment, marcas = v_marcas, foto_antes = v_antes where id = t.id;
    elsif t.id is not null and t.estado = 'hecha' then
      null;   -- ya mandó la corrección: se mira con la tarea (Quedó bien / Pedir otra corrección)
    elsif p_corregir is not null or not exists (
        select 1 from orden_tareas where modulo_id = c.modulo_id and persona_id = c.persona_id and estado = 'pendiente') then
      select coalesce(plazo_tarea_default, 'manana') into v_plazo from orden_config where local_id = c.local_id;
      insert into orden_tareas (local_id, persona_id, modulo_id, control_id, origen, titulo, detalle,
                                requiere_foto, plazo, vence_en, creada_por, clave, foto_antes, marcas)
      values (c.local_id, c.persona_id, c.modulo_id, c.id, 'supervisor', v_titulo, v_coment, true,
              coalesce(v_plazo, 'manana'), orden_calcular_vencimiento(c.persona_id, coalesce(v_plazo, 'manana')),
              orden_yo_id(), 'rev:' || c.id, v_antes, v_marcas);
    end if;
  elsif t.id is not null and t.estado in ('pendiente', 'vencida') and t.foto_path is null
        and jsonb_array_length(coalesce(t.correcciones, '[]'::jsonb)) = 0 then
    -- Cambió la revisión y ya no le pide la corrección: la que todavía no hizo se cancela.
    update orden_tareas set estado = 'cancelada' where id = t.id;
  end if;

  -- El aviso. Si cambia una revisión ya hecha, otro aviso sólo si cambió algo.
  if a.revisado_en is null or a.nivel_final is distinct from c.nivel_final or a.comentario is distinct from c.comentario
     or a.marcas is distinct from c.marcas or a.correccion_pedida is distinct from c.correccion_pedida then
    v_clave := 'revisado:' || c.id || case when a.revisado_en is null then '' else ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') end;
    if v_corr then
      v_aviso := orden_encolar_aviso(c.persona_id, 'revisado',
        m.nombre || ': ' || orden_nivel_texto(p_nivel) || '. Corregilo y mandá otra foto', v_coment, '/tareas', v_clave, 2::smallint);
      -- De franco o fuera de horario: el aviso sale cuando esté en el trabajo.
      perform orden_programar_aviso_(v_aviso, c.persona_id);
    else
      perform orden_encolar_aviso(c.persona_id, 'revisado', m.nombre || ': ' || orden_nivel_texto(p_nivel), v_coment,
        case when v_coment is not null or v_marcas is not null then '/revision/' || c.id else '/historial' end, v_clave, 1::smallint);
    end if;
  end if;
  return c;
end $$;
revoke all on function orden_revisar_control(uuid, orden_nivel, text, uuid, boolean, jsonb) from public, anon;
grant execute on function orden_revisar_control(uuid, orden_nivel, text, uuid, boolean, jsonb) to authenticated, service_role;

-- 5. Mirar la foto de una tarea hecha: "Quedó bien" o "Pedir otra corrección", ahora también con marcas.
--    La foto de la corrección (el control 'correccion') queda revisada junto con la tarea.
drop function if exists orden_tarea_revisar(uuid, boolean, text);
create function orden_tarea_revisar(p_tarea uuid, p_bien boolean, p_mensaje text default null, p_marcas jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t orden_tareas; v_yo uuid := orden_yo_id(); v_msg text := left(nullif(trim(coalesce(p_mensaje, '')), ''), 500);
  v_marcas jsonb := orden_marcas_(p_marcas); v_vence timestamptz; v_aviso uuid; v_n int;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if not orden_es_supervisor_de(t.local_id) then raise exception 'No podés revisar tareas de ese local'; end if;
  if t.estado <> 'hecha' then raise exception 'Esa tarea ya no está hecha: la están corrigiendo o se cerró'; end if;
  if not p_bien and v_msg is null then raise exception 'Escribí qué hay que corregir'; end if;

  update orden_controles
     set estado = 'revisado', revisado_por = v_yo, revisado_en = now(),
         comentario = case when p_bien then null else v_msg end, marcas = case when p_bien then null else v_marcas end
   where tarea_id = t.id and estado = 'enviado';

  if p_bien then
    update orden_tareas set revisada_en = now(), revisada_por = v_yo where id = t.id;
    -- Si era una corrección que pidió el supervisor, que sepa que quedó bien.
    if t.clave like 'rev:%' or jsonb_array_length(coalesce(t.correcciones, '[]'::jsonb)) > 0 then
      perform orden_encolar_aviso(t.persona_id, 'tarea_bien', 'Tu corrección quedó bien', t.titulo, '/tareas',
                                  'bien:' || t.id || ':' || jsonb_array_length(coalesce(t.correcciones, '[]'::jsonb)), 1::smallint);
    end if;
    return jsonb_build_object('tarea_id', t.id, 'bien', true);
  end if;

  v_vence := orden_calcular_vencimiento(t.persona_id, 'hoy', now());
  update orden_tareas
     set estado = 'pendiente', requiere_foto = true, correccion = v_msg, correccion_en = now(),
         correcciones = correcciones || jsonb_build_array(jsonb_build_object(
           'mensaje', v_msg, 'en', now(), 'por', v_yo, 'foto_path', t.foto_path, 'marcas', v_marcas,
           'completada_en', t.completada_en, 'a_tiempo', t.completada_a_tiempo)),
         foto_antes = coalesce(t.foto_path, t.foto_antes), marcas = v_marcas,
         revisada_en = now(), revisada_por = v_yo, completada_en = null, completada_a_tiempo = null, vence_en = v_vence
   where id = t.id
  returning jsonb_array_length(correcciones) into v_n;

  v_aviso := orden_encolar_aviso(t.persona_id, 'tarea_corregir', 'Corregí: ' || t.titulo, v_msg, '/tareas',
                                 'corr:' || t.id || ':' || v_n, 2::smallint);
  -- De franco o fuera de horario: el aviso sale cuando esté en el trabajo.
  perform orden_programar_aviso_(v_aviso, t.persona_id);
  return jsonb_build_object('tarea_id', t.id, 'bien', false, 'vence_en', v_vence);
end $$;
revoke all on function orden_tarea_revisar(uuid, boolean, text, jsonb) from public, anon;
grant execute on function orden_tarea_revisar(uuid, boolean, text, jsonb) to authenticated, service_role;

-- 6. Hacer una tarea: igual que antes, y la foto del módulo queda unida a su tarea (tarea_id).
create or replace function orden_completar_tarea(p_tarea uuid, p_foto_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t orden_tareas; v_yo uuid := orden_yo_id(); v_control uuid; v_foto uuid;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if t.persona_id is distinct from v_yo then raise exception 'Esta tarea no es tuya'; end if;
  if t.estado not in ('pendiente', 'vencida') then raise exception 'Esta tarea ya está cerrada'; end if;
  if t.requiere_foto and p_foto_path is null then raise exception 'Esta tarea pide una foto'; end if;
  if p_foto_path is not null and p_foto_path not like t.local_id::text || '/%' then
    raise exception 'Ruta de foto inválida';
  end if;

  update orden_tareas
     set estado = 'hecha', completada_en = now(), completada_a_tiempo = now() <= vence_en, foto_path = p_foto_path
   where id = t.id;

  if p_foto_path is not null and t.modulo_id is not null then
    insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, estado, vence_en, enviado_en, tarea_id)
    values (t.local_id, t.modulo_id, v_yo, orden_fecha_local(t.local_id), 'correccion', 'enviado', now(), now(), t.id)
    returning id into v_control;

    insert into orden_fotos (control_id, persona_id, foto_path) values (v_control, v_yo, p_foto_path)
    returning id into v_foto;
    update orden_controles set ultimo_intento_id = v_foto where id = v_control;
  end if;

  return jsonb_build_object('tarea_id', t.id, 'control_id', v_control, 'foto_id', v_foto);
end $$;
