-- ═══ SQL 130 (15/10/2026) · Equipo VDH: la foto se manda siempre, sin las 4 preguntas ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Correlo DESPUÉS del SQL 129. Si el 129 no está, corta enseguida con "Primero corré el
--     SQL 129" y no cambia nada.
--   · Al mandar la foto ya no se piden las 4 preguntas (Sí/No): en la app quedan como un
--     recordatorio chiquito abajo. Si llegan igual (la app de antes, hasta que se actualiza),
--     se guardan como siempre.
--   · Sin respuestas, el nivel lo pone la IA (aunque llegue después de mandarla) o el
--     supervisor al revisarla.
--   · Si el vendedor saca otra foto mientras la IA revisa la anterior, lo de la anterior ya no
--     le deja tareas.
--   · Que la IA no frene el envío es de la app nueva, no de este SQL.
--   · Al final te muestra dos "true" si quedó todo.
--   · Reversible (el detalle está abajo): primero hay que volver la app.

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
-- 0. Si falta el SQL 129, corta acá sin cambiar nada (sin él, mandar una foto
--    falla con "column m.mueble does not exist"; árbitro, ronda 1).
-- 1. orden_enviar_control: ya no pide las respuestas. Si llegan las 4 de un
--    juego que vale (la app de antes, que sigue en los teléfonos hasta que se
--    actualiza), se guardan como antes. Si no, el control queda sin respuestas:
--    respuestas y nivel_declarado en null y discrepancia en false. El nivel lo
--    pone la IA (orden_aplicar_resultado_ia lo completa aunque la foto ya esté
--    mandada) o el supervisor al revisarla; mientras no tenga ninguno de los
--    dos, ese control no cuenta en el promedio de la semana (antes contaba lo
--    que había respondido).
--    Lo demás, igual que en la migración 36 (mandarla de nuevo, la hora límite).
-- 2. orden_aplicar_resultado_ia (igual que en la migración 1, más dos cosas):
--    - la IA de una foto que ya no es la del control (sacó otra mientras la IA
--      la revisaba) guarda su resultado, pero no crea ni cierra tareas: si no,
--      la de una foto descartada quedaba pendiente;
--    - si la foto ya estaba mandada (ahora se manda sin esperar a la IA),
--      completa "enviado con problemas" con el nivel que llega.
--
-- Se puede correr más de una vez.
-- Reversible, en este orden:
--   PRIMERO volver la app de los vendedores a la de antes (la nueva no tiene
--   preguntas: contra la función de antes, los vendedores no pueden mandar);
--   después pegar de nuevo orden_enviar_control de la migración 36 y
--   orden_aplicar_resultado_ia de la migración 1. Los controles que se mandaron
--   sin respuestas quedan así (no se preguntó nada: no hay qué recuperar).
-- =====================================================================

-- 0. El SQL 129 tiene que estar corrido antes
do $$
begin
  if to_regprocedure('orden_checks_mueble(text)') is null or to_regprocedure('orden_mueble(text,boolean,text,orden_sector_tipo)') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orden_modulos' and column_name = 'mueble') then
    raise exception 'Primero corré el SQL 129 (las preguntas según el mueble). Éste, el 130, va después: no se cambió nada.';
  end if;
end $$;

-- 1. Enviar (igual que en la migración 36, sin pedir las respuestas)
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

-- 2. Lo que llega de la IA (igual que en la migración 1, más las dos cosas de arriba)
create or replace function orden_aplicar_resultado_ia(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; cfg orden_config;
  v_valida boolean; v_nivel orden_nivel; h jsonb; v_clave text; v_claves text[] := '{}';
  v_tarea uuid; v_creadas jsonb := '[]'; v_resueltas int := 0; v_titulo text; v_descartada boolean;
begin
  select * into f from orden_fotos where id = p_foto for update;
  if not found then raise exception 'No encontramos esa foto'; end if;
  -- Una foto se analiza una sola vez: para volver a revisar, hay que sacar otra.
  if f.ia_estado in ('ok', 'invalida') then raise exception 'Esta foto ya fue analizada'; end if;
  select * into c from orden_controles where id = f.control_id;
  select * into m from orden_modulos where id = c.modulo_id;
  select * into cfg from orden_config where local_id = c.local_id;

  v_valida := coalesce((p_resultado ->> 'foto_valida')::boolean, true);
  v_nivel  := case when v_valida then (p_resultado ->> 'nivel_sugerido')::orden_nivel end;

  update orden_fotos
     set ia_estado = case when v_valida then 'ok' else 'invalida' end,
         ia_resultado = p_resultado, ia_nivel = v_nivel, ia_modelo = p_modelo, ia_error = null, analizada_en = now()
   where id = f.id;

  if not v_valida then
    return jsonb_build_object('foto_valida', false, 'motivo', p_resultado ->> 'motivo_foto_invalida',
                              'tareas_creadas', '[]'::jsonb, 'tareas_resueltas', 0);
  end if;

  if c.ultimo_intento_id = f.id then
    -- Mandada antes de que llegara la IA (SQL 130): "con problemas" se completa con este nivel.
    update orden_controles
       set nivel_ia = v_nivel,
           enviado_con_problemas = enviado_con_problemas or coalesce(estado in ('enviado', 'revisado') and v_nivel <= 'a_mejorar', false)
     where id = c.id;
  end if;

  -- Sacó otra foto mientras la IA revisaba ésta: queda su resultado, pero no crea ni cierra tareas.
  v_descartada := c.ultimo_intento_id is distinct from f.id
    and exists (select 1 from orden_fotos x where x.control_id = f.control_id and x.id <> f.id
                   and x.borrada_en is null and x.tomada_en > f.tomada_en);

  if not v_descartada and coalesce(cfg.ia_crea_tareas, true) and c.persona_id is not null then
    for h in select * from jsonb_array_elements(coalesce(p_resultado -> 'hallazgos', '[]'::jsonb)) loop
      continue when coalesce(h ->> 'gravedad', '') <> 'corregir';
      v_clave := 'ia:' || m.id || ':' || coalesce(nullif(h ->> 'check', ''), 'general');
      v_claves := v_claves || v_clave;
      v_titulo := left(m.nombre || ': ' || coalesce(h ->> 'titulo', 'corregir'), 140);

      v_tarea := null;
      insert into orden_tareas (local_id, persona_id, modulo_id, control_id, foto_origen_id, origen,
                                titulo, detalle, requiere_foto, plazo, vence_en, clave)
      values (c.local_id, c.persona_id, m.id, c.id, f.id, 'ia', v_titulo, h ->> 'detalle', true, 'hoy',
              orden_calcular_vencimiento(c.persona_id, 'hoy'), v_clave)
      on conflict (persona_id, clave) where estado = 'pendiente' and clave is not null do nothing
      returning id into v_tarea;

      if v_tarea is not null then
        v_creadas := v_creadas || jsonb_build_object('id', v_tarea, 'titulo', v_titulo);
      end if;
    end loop;

    -- Lo que la IA había marcado antes y ahora se ve BIEN: se cierra solo.
    -- Solo si la IA está segura y ese punto quedó "ok" (una foto oscura o un "no_se_ve" no cierra nada).
    if coalesce(p_resultado ->> 'confianza', 'media') <> 'baja' then
      update orden_tareas t
         set estado = 'hecha', completada_en = now(), completada_a_tiempo = now() <= t.vence_en, foto_path = f.foto_path
       where t.modulo_id = m.id and t.origen = 'ia' and t.estado = 'pendiente'
         and not (t.clave = any(v_claves))
         and p_resultado -> 'checks' ->> split_part(t.clave, ':', 3) = 'ok';
      get diagnostics v_resueltas = row_count;
    end if;
  end if;

  return jsonb_build_object(
    'foto_valida', true,
    'nivel', v_nivel,
    'nivel_texto', orden_nivel_texto(v_nivel),
    'checks', p_resultado -> 'checks',
    'hallazgos', p_resultado -> 'hallazgos',
    'comentario', p_resultado -> 'comentario',
    'tareas_creadas', v_creadas,
    'tareas_resueltas', v_resueltas);
end $$;

-- Lo que quedó: los dos en true
select pg_get_functiondef('orden_enviar_control(uuid, jsonb)'::regprocedure) like '%Las respuestas ya no se piden%' as ya_no_pide_respuestas,
       pg_get_functiondef('orden_aplicar_resultado_ia(uuid, jsonb, text)'::regprocedure) like '%v_descartada%' as foto_descartada_sin_tareas;
