-- =====================================================================
-- Módulo VDH · Migración 37 (SQL 130), 15/10/2026: la foto se manda
-- siempre, sin las 4 preguntas.
--
-- Salió de la prueba de fotos en Rivadavia: Seba sacó dos fotos (módulos 8
-- y 9), la IA marcó cosas "a corregir" y la app no lo dejó mandarlas hasta
-- corregir; además tenía que responder las 4 preguntas (Sí/No) antes de
-- enviar. Quedaron las dos vencidas sin mandar. Mauricio: "la foto la tiene
-- que dejar mandar igual, esté como esté… la sugerencia va después de que
-- la subió"; "las cuatro preguntas, sacalas y dejalas como recordatorio,
-- chiquito abajo… mientras menos fricción tenga, mejor".
--
-- 1. orden_enviar_control: ya no pide las respuestas. Si llegan las 4 de un
--    juego que vale (la app de antes, que sigue en los teléfonos hasta que se
--    actualiza), se guardan como antes. Si no, el control queda sin respuestas:
--    respuestas y nivel_declarado en null y discrepancia en false. El nivel lo
--    pone la IA (orden_aplicar_resultado_ia lo completa aunque la foto ya esté
--    mandada) o el supervisor al revisarla; mientras no tenga ninguno de los
--    dos, ese control no cuenta en el promedio de la semana (antes contaba lo
--    que había respondido).
--    Lo demás, igual que en la migración 36 (mandarla de nuevo, la hora límite,
--    "con problemas").
--
-- Se puede correr más de una vez. Va DESPUÉS del SQL 129 (usa
-- orden_mueble y orden_checks_mueble, que crea ese).
-- Reversible: volver orden_enviar_control a la de la migración 36 (pegar de
-- nuevo esa función). Los controles que se mandaron sin respuestas quedan así
-- (no hay qué recuperar: no se preguntó nada).
-- =====================================================================

create or replace function orden_enviar_control(p_control uuid, p_respuestas jsonb)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; v_tipo orden_sector_tipo; v_mueble text; v_croquis text; v_checks text[]; v_resp jsonb := '{}';
  v_ia_checks jsonb; v_nivel_ia orden_nivel; v_decl orden_nivel; v_disc boolean := false; v_problemas boolean; k text;
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

  select s.tipo, orden_mueble(m.mueble, m.isla, m.nombre, s.tipo), orden_mueble(null, m.isla, m.nombre, s.tipo)
    into v_tipo, v_mueble, v_croquis
    from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = c.modulo_id;
  -- Las respuestas ya no se piden. Si vienen las 4 de un juego que vale (las del mueble, las del
  -- mueble del croquis o las del sector, como en la migración 36), se guardan; si no, ninguna.
  if jsonb_typeof(p_respuestas) = 'object' then
    select j.checks into v_checks
      from unnest(array[v_mueble, v_croquis, case when v_tipo = 'deposito' then 'deposito' else 'estantes' end]) with ordinality t(mueble, n)
      cross join lateral (select orden_checks_mueble(t.mueble) checks) j
     where not exists (select 1 from unnest(j.checks) x where jsonb_typeof(p_respuestas -> x) is distinct from 'boolean')
     order by t.n limit 1;
    if v_checks is not null then
      foreach k in array v_checks loop
        v_resp := v_resp || jsonb_build_object(k, p_respuestas -> k);
      end loop;
    end if;
  end if;

  select ia_resultado -> 'checks', ia_nivel into v_ia_checks, v_nivel_ia
  from orden_fotos where id = c.ultimo_intento_id;

  if v_resp <> '{}'::jsonb then
    v_decl := orden_nivel_desde_respuestas(v_resp);
    v_disc := (v_nivel_ia is not null and abs(orden_puntos(v_decl) - orden_puntos(v_nivel_ia)) >= 2)
           or exists (select 1 from unnest(v_checks) x
                      where v_resp ->> x = 'true' and v_ia_checks ->> x = 'mal');
  end if;
  v_problemas := (v_nivel_ia is not null and v_nivel_ia <= 'a_mejorar')
         or exists (select 1 from orden_tareas
                    where modulo_id = c.modulo_id and origen = 'ia' and estado = 'pendiente');

  -- Al mandarla de nuevo, enviado_en queda el de la primera vez (la cola de Revisar no se reordena).
  update orden_controles
     set estado = 'enviado', respuestas = nullif(v_resp, '{}'::jsonb), nivel_declarado = v_decl, nivel_ia = v_nivel_ia,
         discrepancia = coalesce(v_disc, false), enviado_en = case when v_reenvio then enviado_en else now() end,
         enviado_con_problemas = v_problemas, ultimo_intento_id = c.ultimo_intento_id,
         reenvios = reenvios + case when v_reenvio then 1 else 0 end
   where id = c.id
  returning * into c;
  return c;
end $$;
