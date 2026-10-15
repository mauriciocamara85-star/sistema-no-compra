-- ═══ SQL 126 (15/10/2026) · Equipo VDH: sacar de nuevo una foto ya mandada ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Mientras el supervisor no la revisó, el vendedor puede sacar de nuevo una foto que ya mandó:
--     sólo el mismo día y antes de la hora límite. Si ya la revisaste, queda como está.
--   · Hasta que mande la nueva, en Revisar se sigue viendo la que mandó. Si se arrepiente, queda esa.
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
-- Cuándo se puede: el control está 'enviado' (no 'revisado'), es del día
-- (se mandó hoy) y todavía no pasó su vence_en. No vale para los de
-- corrección (se cierran solos al completar la tarea).
--
-- Cómo: la foto nueva se registra aparte y NO toca ultimo_intento_id: el
-- supervisor sigue viendo la que se mandó (orden_v_controles y Revisar la
-- leen de ahí). Recién cuando el vendedor la manda, orden_enviar_control la
-- pone como la del control y recalcula todo (nivel de la IA, discrepancia,
-- con problemas). Si se arrepiente y no la manda, queda la que había.
--
-- 1. orden_controles.reenvios: cuántas veces se cambió la foto mandada.
-- 2. orden_se_puede_rehacer(control): la regla de arriba, en un solo lugar.
-- 3. orden_registrar_foto: acepta fotos nuevas en un 'enviado' que se puede rehacer.
-- 4. orden_enviar_control: manda de nuevo con la última foto sacada después de mandarla.
--
-- Se puede correr más de una vez.
-- Reversible:
--   volver orden_registrar_foto y orden_enviar_control a las de la migración 1
--   (rechazan todo 'enviado' o 'revisado');
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
  if v_rehacer and not orden_se_puede_rehacer(c) then raise exception 'Ya enviaste este control'; end if;
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
    -- Mandar de nuevo: con la última foto que sacó después de mandarlo. Sin foto nueva
    -- (tocó dos veces, o se cortó la señal después de que llegara) es "ya fue enviado".
    if orden_se_puede_rehacer(c) then
      select f.id into v_nueva from orden_fotos f
       where f.control_id = c.id and f.tomada_en > c.enviado_en and f.borrada_en is null
       order by f.tomada_en desc limit 1;
    end if;
    if v_nueva is null then raise exception 'Este control ya fue enviado'; end if;
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

  update orden_controles
     set estado = 'enviado', respuestas = v_resp, nivel_declarado = v_decl, nivel_ia = v_nivel_ia,
         discrepancia = v_disc, enviado_en = now(), enviado_con_problemas = v_problemas,
         ultimo_intento_id = c.ultimo_intento_id,
         reenvios = reenvios + case when v_reenvio then 1 else 0 end
   where id = c.id
  returning * into c;
  return c;
end $$;

-- Lo que quedó: los controles de hoy que se pueden sacar de nuevo
select l.nombre as local, pe.nombre as vendedor, m.nombre as modulo, c.estado, orden_se_puede_rehacer(c) as se_puede_rehacer
from orden_controles c join orden_modulos m on m.id = c.modulo_id join orden_locales l on l.id = c.local_id
left join orden_personas pe on pe.id = c.persona_id
where c.estado = 'enviado' and c.fecha = orden_fecha_local(c.local_id)
order by 1, 2, m.numero;
