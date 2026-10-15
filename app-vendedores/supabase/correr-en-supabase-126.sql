-- ═══ SQL 126 (15/10/2026) · Equipo VDH: sacar de nuevo una foto ya mandada ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Mientras el supervisor no la revisó, el vendedor puede sacar de nuevo una foto que ya mandó:
--     sólo el mismo día que la mandó y antes de la hora límite. Si ya la revisaste, queda como está.
--   · Hasta que mande la nueva, en Revisar se sigue viendo la que mandó (y el observador también).
--     Si se arrepiente, queda esa.
--   · Si la cambia justo mientras la estás mirando en Revisar, no te deja ponerle el nivel a la vieja:
--     te pide mirarla de nuevo (con la app nueva).
--   · Hasta que se publique la app nueva, esto no cambia nada de lo que ven: la app de hoy no lo ofrece.
--   · Reversible (el detalle está abajo).

-- =====================================================================
-- Módulo VDH · Migración 35 (SQL 126), 15/10/2026: sacar de nuevo una
-- foto que ya se mandó, mientras el supervisor no la revisó.
--
-- Salió de la primera prueba real de fotos en Rivadavia: uno de los chicos
-- la sacó con el teléfono acostado y quedó de costado, y ya no se podía
-- cambiar. Mauricio: "que tenga la posibilidad de sacar la foto de nuevo en
-- un lapso corto… durante el día la podés sacar de vuelta", "solo mientras
-- no la revisé… si ya la revisé, ya está".
--
-- Cuándo se puede: el control está 'enviado' (no 'revisado'), se mandó hoy
-- y todavía no pasó su vence_en. No vale para los de corrección (se cierran
-- solos al completar la tarea).
--
-- Cómo: la foto nueva se registra aparte y NO toca ultimo_intento_id: el
-- supervisor sigue viendo la que se mandó (orden_v_controles y Revisar la
-- leen de ahí). Recién cuando el vendedor la manda, orden_enviar_control la
-- pone como la del control y recalcula todo (nivel de la IA, discrepancia,
-- con problemas). Si se arrepiente y no la manda, queda la que había.
-- enviado_en queda el de la primera vez: la cola de Revisar y el aviso de
-- "sin revisar" no vuelven a empezar.
--
-- 1. orden_controles.reenvios: cuántas veces se cambió la foto mandada.
-- 2. orden_se_puede_rehacer(control): la regla de arriba, en un solo lugar.
-- 3. orden_registrar_foto: acepta fotos nuevas en un 'enviado' que se puede rehacer.
-- 4. orden_enviar_control: manda de nuevo con la foto más nueva que la mandada.
-- 5. orden_revisar_control: con p_foto (la que el supervisor está mirando),
--    si el vendedor la cambió mientras tanto, no deja ponerle el nivel.
-- 6. orden_v_estado_local (el observador): de un control mandado muestra la
--    foto mandada, no la que el vendedor sacó de nuevo y no mandó.
--
-- Se puede correr más de una vez.
-- Reversible:
--   volver orden_registrar_foto y orden_enviar_control a las de la migración 1
--   (rechazan todo 'enviado' o 'revisado');
--   drop function orden_revisar_control(uuid, orden_nivel, text, uuid) y volver
--   a crear la de la migración 1 (sin p_foto), con sus grants;
--   volver orden_v_estado_local a la de antes (sin la condición del paso 6);
--   drop function orden_se_puede_rehacer(orden_controles);
--   alter table orden_controles drop column reenvios;
-- =====================================================================

-- 1. Cuántas veces se cambió la foto mandada
alter table orden_controles add column if not exists reenvios smallint not null default 0;
comment on column orden_controles.reenvios is 'Cuántas veces el vendedor cambió la foto ya mandada (antes de que la revisen)';

-- 2. ¿Se puede sacar de nuevo? Mandado hoy, sin revisar y antes de que venza.
create or replace function orden_se_puede_rehacer(c orden_controles)
returns boolean language sql stable security definer set search_path = public as $$
  select c.estado = 'enviado' and c.tipo <> 'correccion' and c.enviado_en is not null
     and now() < c.vence_en
     and orden_fecha_local(c.local_id, c.enviado_en) = orden_fecha_local(c.local_id);
$$;
revoke all on function orden_se_puede_rehacer(orden_controles) from public, anon;
grant execute on function orden_se_puede_rehacer(orden_controles) to authenticated, service_role;

-- 3. Registrar la foto (igual que en la migración 1, más el 'enviado' que se puede rehacer)
create or replace function orden_registrar_foto(p_control uuid, p_foto_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c orden_controles; v_yo uuid := orden_yo_id(); v_id uuid; v_ia boolean; v_rehacer boolean;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if c.persona_id is distinct from v_yo then raise exception 'Este control no es tuyo'; end if;
  if c.estado = 'revisado' then raise exception 'Tu supervisor ya revisó este control: queda la foto que mandaste'; end if;
  v_rehacer := c.estado = 'enviado';
  if v_rehacer and not orden_se_puede_rehacer(c) then
    raise exception 'Ya no se puede cambiar la foto (se cambia sólo el día que la mandaste y antes de la hora límite): queda la que mandaste';
  end if;
  if p_foto_path not like c.local_id::text || '/%' then raise exception 'Ruta de foto inválida'; end if;

  select id into v_id from orden_fotos where control_id = c.id and foto_path = p_foto_path;
  if v_id is not null then return v_id; end if;

  select coalesce(ia_activa, true) into v_ia from orden_config where local_id = c.local_id;
  insert into orden_fotos (control_id, persona_id, foto_path, ia_estado)
  values (c.id, v_yo, p_foto_path, case when coalesce(v_ia, true) then 'pendiente' else 'omitida' end)
  returning id into v_id;
  -- Rehaciendo una ya mandada, la del control sigue siendo la mandada hasta que mande esta.
  if not v_rehacer then
    update orden_controles set ultimo_intento_id = v_id, nivel_ia = null where id = c.id;
  end if;
  return v_id;
end $$;

-- 4. Enviar (igual que en la migración 1, más mandar de nuevo uno que se puede rehacer)
create or replace function orden_enviar_control(p_control uuid, p_respuestas jsonb)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; v_tipo orden_sector_tipo; v_checks text[]; v_resp jsonb := '{}';
  v_ia_checks jsonb; v_nivel_ia orden_nivel; v_decl orden_nivel; v_disc boolean; v_problemas boolean; k text;
  v_nueva uuid; v_reenvio boolean := false;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if c.persona_id is distinct from orden_yo_id() then raise exception 'Este control no es tuyo'; end if;
  if c.estado = 'revisado' then raise exception 'Tu supervisor ya revisó este control: queda la foto que mandaste'; end if;
  if c.estado = 'enviado' then
    -- Mandar de nuevo: con la foto más nueva que la mandada. Sin una (tocó dos veces,
    -- o se cortó la señal después de que llegara) es "ya fue enviado".
    select f.id into v_nueva from orden_fotos f
     where f.control_id = c.id and f.borrada_en is null
       and f.tomada_en > (select x.tomada_en from orden_fotos x where x.id = c.ultimo_intento_id)
     order by f.tomada_en desc limit 1;
    if v_nueva is null then raise exception 'Este control ya fue enviado'; end if;
    -- La sacó a tiempo pero la manda tarde (pasó la hora límite en el medio).
    if not orden_se_puede_rehacer(c) then
      raise exception 'Ya no se puede cambiar la foto (se cambia sólo el día que la mandaste y antes de la hora límite): queda la que mandaste';
    end if;
    c.ultimo_intento_id := v_nueva;
    v_reenvio := true;
  end if;
  if c.ultimo_intento_id is null then raise exception 'Primero sacá la foto'; end if;

  select s.tipo into v_tipo from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = c.modulo_id;
  v_checks := orden_checks(v_tipo);
  foreach k in array v_checks loop
    if jsonb_typeof(p_respuestas -> k) is distinct from 'boolean' then
      raise exception 'Respondé las 4 preguntas antes de enviar';
    end if;
    v_resp := v_resp || jsonb_build_object(k, p_respuestas -> k);
  end loop;

  select ia_resultado -> 'checks', ia_nivel into v_ia_checks, v_nivel_ia
  from orden_fotos where id = c.ultimo_intento_id;

  v_decl := orden_nivel_desde_respuestas(v_resp);
  v_disc := (v_nivel_ia is not null and abs(orden_puntos(v_decl) - orden_puntos(v_nivel_ia)) >= 2)
         or exists (select 1 from unnest(v_checks) x
                    where v_resp ->> x = 'true' and v_ia_checks ->> x = 'mal');
  v_problemas := (v_nivel_ia is not null and v_nivel_ia <= 'a_mejorar')
         or exists (select 1 from orden_tareas
                    where modulo_id = c.modulo_id and origen = 'ia' and estado = 'pendiente');

  -- Al mandarla de nuevo, enviado_en queda el de la primera vez (la cola de Revisar no se reordena).
  update orden_controles
     set estado = 'enviado', respuestas = v_resp, nivel_declarado = v_decl, nivel_ia = v_nivel_ia,
         discrepancia = v_disc, enviado_en = case when v_reenvio then enviado_en else now() end,
         enviado_con_problemas = v_problemas, ultimo_intento_id = c.ultimo_intento_id,
         reenvios = reenvios + case when v_reenvio then 1 else 0 end
   where id = c.id
  returning * into c;
  return c;
end $$;

-- 5. Revisar (igual que en la migración 1, más p_foto: la foto que el supervisor está mirando).
--    Sin p_foto (la app de antes) anda como siempre.
drop function if exists orden_revisar_control(uuid, orden_nivel, text);
create or replace function orden_revisar_control(p_control uuid, p_nivel orden_nivel, p_comentario text default null, p_foto uuid default null)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; m orden_modulos; v_base orden_nivel; v_coment text := nullif(trim(p_comentario), '');
  v_plazo orden_plazo;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if not orden_es_supervisor_de(c.local_id) then raise exception 'Solo el supervisor del local puede revisar'; end if;
  if c.estado not in ('enviado', 'revisado') then raise exception 'Este control todavía no fue enviado'; end if;
  if p_foto is not null and p_foto is distinct from c.ultimo_intento_id then
    raise exception 'Cambió la foto mientras la mirabas: mirala de nuevo';
  end if;

  v_base := coalesce(c.nivel_ia, c.nivel_declarado);
  if v_base is not null and abs(orden_puntos(p_nivel) - orden_puntos(v_base)) > 1 and v_coment is null then
    raise exception 'Para cambiar más de un nivel, dejá un comentario';
  end if;

  update orden_controles
     set nivel_final = p_nivel, revisado_por = orden_yo_id(), revisado_en = now(),
         comentario = v_coment, estado = 'revisado'
   where id = c.id
  returning * into c;

  select * into m from orden_modulos where id = c.modulo_id;

  -- A mejorar o peor: tarea para el vendedor, si no tiene ya una abierta de ese módulo
  if p_nivel <= 'a_mejorar' and c.persona_id is not null and not exists (
       select 1 from orden_tareas where modulo_id = c.modulo_id and persona_id = c.persona_id and estado = 'pendiente') then
    select coalesce(plazo_tarea_default, 'manana') into v_plazo from orden_config where local_id = c.local_id;
    insert into orden_tareas (local_id, persona_id, modulo_id, control_id, origen, titulo, detalle,
                              requiere_foto, plazo, vence_en, creada_por, clave)
    values (c.local_id, c.persona_id, c.modulo_id, c.id, 'supervisor',
            m.nombre || ': ' || coalesce(v_coment, 'mejorar el orden'), v_coment, true,
            coalesce(v_plazo, 'manana'), orden_calcular_vencimiento(c.persona_id, coalesce(v_plazo, 'manana')),
            orden_yo_id(), 'rev:' || c.id);
  end if;

  perform orden_encolar_aviso(c.persona_id, 'revisado',
    m.nombre || ': ' || orden_nivel_texto(p_nivel), v_coment, '/historial', 'revisado:' || c.id, 1::smallint);
  return c;
end $$;
revoke all on function orden_revisar_control(uuid, orden_nivel, text, uuid) from public, anon;
grant execute on function orden_revisar_control(uuid, orden_nivel, text, uuid) to authenticated, service_role;

-- 6. El observador: de un control mandado, la foto mandada (igual que antes, más esa condición).
--    security_invoker se repite: create or replace view lo borraría.
create or replace view orden_v_estado_local with (security_invoker = true) as
 SELECT m.id AS modulo_id,
    m.numero AS modulo_numero,
    m.nombre AS modulo_nombre,
    s.local_id,
    l.nombre AS local_nombre,
    s.tipo AS sector_tipo,
    s.numero AS sector_numero,
    resp.nombre AS responsable,
    u.foto_path,
    u.tomada_en,
    u.control_id,
    u.control_tipo,
    u.nivel,
    u.foto_de,
    ((u.tomada_en IS NULL) OR (u.tomada_en < (now() - '7 days'::interval))) AS sin_foto_reciente,
    ( SELECT count(*) AS count
           FROM orden_tareas t
          WHERE ((t.modulo_id = m.id) AND (t.estado = ANY (ARRAY['pendiente'::orden_tarea_estado, 'vencida'::orden_tarea_estado])))) AS tareas_abiertas
   FROM ((((orden_modulos m
     JOIN orden_sectores s ON ((s.id = m.sector_id)))
     JOIN orden_locales l ON ((l.id = s.local_id)))
     LEFT JOIN orden_personas resp ON ((resp.id = s.responsable_id)))
     LEFT JOIN LATERAL ( SELECT f.foto_path,
            f.tomada_en,
            c.id AS control_id,
            c.tipo AS control_tipo,
            COALESCE(c.nivel_final, f.ia_nivel, c.nivel_declarado) AS nivel,
            pe.nombre AS foto_de
           FROM ((orden_fotos f
             JOIN orden_controles c ON ((c.id = f.control_id)))
             LEFT JOIN orden_personas pe ON ((pe.id = f.persona_id)))
          WHERE ((c.modulo_id = m.id) AND (f.borrada_en IS NULL)
                 AND (c.estado NOT IN ('enviado', 'revisado') OR f.id = c.ultimo_intento_id))
          ORDER BY f.tomada_en DESC
         LIMIT 1) u ON (true))
  WHERE (m.activo AND s.activo AND l.activo);

-- Lo que quedó: los controles de hoy que se pueden sacar de nuevo
select l.nombre as local, pe.nombre as vendedor, m.nombre as modulo, c.estado, orden_se_puede_rehacer(c) as se_puede_rehacer
from orden_controles c join orden_modulos m on m.id = c.modulo_id join orden_locales l on l.id = c.local_id
left join orden_personas pe on pe.id = c.persona_id
where c.estado = 'enviado' and c.fecha = orden_fecha_local(c.local_id)
order by 1, 2, m.numero;
