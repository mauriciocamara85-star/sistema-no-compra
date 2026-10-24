-- ════════════════════════════════════════════════════════════════════════
-- Migración 57 (SQL 170, 24/10/2026, pedido de Mauricio): la IA de las fotos
-- en "modo práctica", y lo que le enseña el supervisor.
--   · Mauricio: a la IA hay que entrenarla antes de que le hable al
--     vendedor ("había muchos fallos": un perchero armado por conjuntos,
--     pantalón, remera, pantalón, remera, lo tomaba como un degradé mal
--     hecho). Lo importante es que controle el supervisor.
--   · Modo práctica (orden_config.ia_practica): la IA mira cada foto y la
--     anota, pero al vendedor no le llega nada: ni sugerencias, ni nivel, ni
--     tareas. Arranca prendido en todos los locales.
--   · El supervisor, al revisar, marca cada comentario de la IA ("Acertó" /
--     "Se equivocó", con un por qué): orden_ia_opiniones. Los errores se le
--     pasan a la IA con las fotos que vienen (orden_preparar_analisis →
--     lecciones): "esto ya lo marcaste mal, no lo repitas".
-- No cambia nada de lo de antes mientras la IA esté apagada (hoy, Rivadavia).
-- Se puede correr más de una vez.
-- Reversible: deshacer-170.sql (vuelve las dos funciones a como estaban,
--   borra la función nueva y la tabla, y saca la columna).
-- ════════════════════════════════════════════════════════════════════════

-- 1. El modo práctica, por local (prendido: el vendedor no ve nada de la IA)
alter table orden_config add column if not exists ia_practica boolean not null default true;
comment on column orden_config.ia_practica is 'Modo práctica de la IA de las fotos: la IA revisa y anota, pero al vendedor no le llega nada (ni sugerencias, ni nivel, ni tareas); el supervisor marca si acertó';

-- 2. Lo que dice el supervisor de cada comentario de la IA (uno por comentario de cada foto)
create table if not exists orden_ia_opiniones (
  foto_id     uuid not null references orden_fotos(id) on delete cascade,
  indice      smallint not null check (indice between 0 and 9),
  local_id    uuid not null references orden_locales(id) on delete cascade,
  modulo_id   uuid references orden_modulos(id) on delete set null,
  check_clave text,
  titulo      text not null,
  detalle     text,
  acerto      boolean not null,
  motivo      text check (motivo is null or length(motivo) <= 300),
  persona_id  uuid references orden_personas(id) on delete set null,
  marcado_en  timestamptz not null default now(),
  primary key (foto_id, indice)
);
comment on table orden_ia_opiniones is 'El supervisor dice si cada comentario de la IA de las fotos acertó; los errores (con su por qué) se le pasan a la IA con las fotos que vienen';
create index if not exists orden_ia_opiniones_errores on orden_ia_opiniones (marcado_en desc) where not acerto;
create index if not exists orden_ia_opiniones_local on orden_ia_opiniones (local_id, marcado_en desc);
alter table orden_ia_opiniones enable row level security;
drop policy if exists ver on orden_ia_opiniones;
create policy ver on orden_ia_opiniones for select to authenticated using (orden_es_supervisor_de(local_id));

-- 3. Marcar un comentario: el supervisor del local o Administración. p_indice: su lugar en la lista de la foto.
--    p_acerto null lo desmarca. El por qué va sólo con "Se equivocó".
create or replace function orden_ia_opinar(p_foto uuid, p_indice int, p_acerto boolean, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; h jsonb;
  v_motivo text := case when p_acerto is false then left(nullif(trim(coalesce(p_motivo, '')), ''), 300) end;
begin
  select * into f from orden_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_controles where id = f.control_id;
  if not orden_es_supervisor_de(c.local_id) then
    raise exception 'Si la IA acertó lo marca el supervisor del local o Administración';
  end if;
  -- Un número negativo en -> agarra desde el final: se frena antes.
  if p_indice is null or p_indice < 0 or p_indice > 9 then raise exception 'Ese comentario de la IA no existe'; end if;
  h := f.ia_resultado -> 'hallazgos' -> p_indice;
  if f.ia_estado is distinct from 'ok' or h is null or jsonb_typeof(h) <> 'object' then
    raise exception 'Ese comentario de la IA ya no está';
  end if;
  if p_acerto is null then
    delete from orden_ia_opiniones where foto_id = f.id and indice = p_indice;
    return jsonb_build_object('acerto', null, 'motivo', null);
  end if;
  insert into orden_ia_opiniones (foto_id, indice, local_id, modulo_id, check_clave, titulo, detalle, acerto, motivo, persona_id)
  values (f.id, p_indice, c.local_id, c.modulo_id, nullif(h ->> 'check', ''),
          left(coalesce(nullif(trim(h ->> 'titulo'), ''), 'Sin título'), 140), left(nullif(trim(h ->> 'detalle'), ''), 300),
          p_acerto, v_motivo, orden_yo_id())
  on conflict (foto_id, indice) do update
    set acerto = excluded.acerto, motivo = excluded.motivo, persona_id = excluded.persona_id, marcado_en = now();
  return jsonb_build_object('acerto', p_acerto, 'motivo', v_motivo);
end $$;

-- 4. Lo que recibe la IA con cada foto: lo de antes, más el modo práctica y las lecciones (los últimos errores
--    marcados, de 90 días, de los puntos que mira este mueble: primero los de este módulo, sin repetir el título).
create or replace function orden_preparar_analisis(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; s orden_sectores; cfg orden_config;
  v_tipo text; v_ejemplo text;
begin
  select * into f from orden_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_controles where id = f.control_id;
  if c.persona_id is distinct from orden_yo_id() and not orden_es_supervisor_de(c.local_id) then
    raise exception 'No tenés acceso a esta foto';
  end if;
  select * into m from orden_modulos where id = c.modulo_id;
  select * into s from orden_sectores where id = m.sector_id;
  select * into cfg from orden_config where local_id = c.local_id;
  -- La foto modelo del módulo; si no tiene, la ejemplo de su tipo de mueble
  v_tipo := orden_mueble(m.mueble, m.isla, m.nombre, s.tipo);
  select fe.foto_path into v_ejemplo from orden_fotos_ejemplo fe where fe.tipo = v_tipo;

  return jsonb_build_object(
    'foto_id', f.id,
    'foto_path', f.foto_path,
    'ia_estado', f.ia_estado,
    'local_id', c.local_id,
    'control_tipo', c.tipo,
    'sector_tipo', s.tipo,
    'modulo_nombre', m.nombre,
    'referencia_path', coalesce(m.foto_referencia_path, v_ejemplo),
    'referencia_tipo', case when m.foto_referencia_path is not null then 'modulo'
                            when v_ejemplo is not null then 'ejemplo' end,
    'mueble', case v_tipo when 'estantes' then 'Módulo de pared con estantes'
                          when 'mesa' then 'Mesa o exhibidor del medio'
                          when 'perchero' then 'Perchero'
                          when 'vidriera' then 'Vidriera'
                          else 'Estantería del depósito' end,
    'mueble_elegido', m.mueble is not null and s.tipo <> 'deposito',
    'lado', orden_lado_modulo(m.id),
    'liquidacion', coalesce(m.liquidacion, false),
    'reglas_extra', m.reglas_extra,
    'exhibidor', null,
    'checks', to_jsonb(orden_checks_ia_mueble(v_tipo)),
    'reglas', coalesce((
       select jsonb_agg(jsonb_build_object('check', r.check_clave, 'texto', r.texto, 'sugerencia', r.sugerencia)
                        order by r.check_clave, r.orden)
       from orden_reglas r
       where r.activo and (r.local_id is null or r.local_id = c.local_id)
         and (r.sector_tipo is null or r.sector_tipo = s.tipo)), '[]'::jsonb),
    'colores', coalesce((
       select jsonb_agg(col.nombre order by col.orden) from orden_colores col where col.activo), '[]'::jsonb),
    'ia_activa', coalesce(cfg.ia_activa, true),
    'ia_sugerencias', coalesce(cfg.ia_sugerencias, false),
    'ia_practica', coalesce(cfg.ia_practica, true),
    'lecciones', coalesce((
       select jsonb_agg(jsonb_build_object('titulo', y.titulo, 'detalle', y.detalle, 'motivo', y.motivo,
                                           'modulo', y.modulo, 'este_modulo', y.este) order by y.este desc, y.marcado_en desc)
       from (select d.* from (
               select distinct on (lower(o.titulo)) o.titulo, o.detalle, o.motivo, mo.nombre as modulo,
                      coalesce(o.modulo_id = m.id, false) as este, o.marcado_en
                 from orden_ia_opiniones o left join orden_modulos mo on mo.id = o.modulo_id
                where not o.acerto and o.marcado_en > now() - interval '90 days'
                  and (o.check_clave is null or o.check_clave = any(orden_checks_ia_mueble(v_tipo)))
                order by lower(o.titulo), coalesce(o.modulo_id = m.id, false) desc, o.marcado_en desc) d
             order by d.este desc, d.marcado_en desc limit 12) y), '[]'::jsonb)
  );
end $$;

-- 5. Guardar lo que vio la IA. En modo práctica queda anotado (con "practica": true) pero sin nivel para el
--    control (orden_fotos.ia_nivel queda vacío: el vendedor no ve nada y no le cuenta), y no crea ni cierra tareas.
create or replace function orden_aplicar_resultado_ia(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; cfg orden_config;
  v_valida boolean; v_nivel orden_nivel; h jsonb; v_clave text; v_claves text[] := '{}';
  v_tarea uuid; v_creadas jsonb := '[]'; v_resueltas int := 0; v_titulo text; v_descartada boolean; v_practica boolean;
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
  v_practica := coalesce(cfg.ia_practica, true);

  update orden_fotos
     set ia_estado = case when v_valida then 'ok' else 'invalida' end,
         ia_resultado = case when v_practica then p_resultado || jsonb_build_object('practica', true) else p_resultado end,
         ia_nivel = case when v_practica then null else v_nivel end,
         ia_modelo = p_modelo, ia_error = null, analizada_en = now()
   where id = f.id;

  if not v_valida then
    return jsonb_build_object('foto_valida', false, 'motivo', p_resultado ->> 'motivo_foto_invalida',
                              'tareas_creadas', '[]'::jsonb, 'tareas_resueltas', 0, 'practica', v_practica);
  end if;

  -- Modo práctica: queda para que lo mire el supervisor, y nada más.
  if v_practica then
    return jsonb_build_object('foto_valida', true, 'practica', true, 'nivel', v_nivel,
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

-- 6. Permisos (las tablas nuevas no traen SELECT para authenticated: se da a mano)
do $$
begin
  revoke all on table orden_ia_opiniones from anon, authenticated;
  grant select on table orden_ia_opiniones to authenticated;
  grant all on table orden_ia_opiniones to service_role;
  revoke all on function orden_ia_opinar(uuid, int, boolean, text) from public, anon;
  grant execute on function orden_ia_opinar(uuid, int, boolean, text) to authenticated, service_role;
end $$;
