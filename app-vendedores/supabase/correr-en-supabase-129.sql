-- ═══ SQL 129 (15/10/2026) · Equipo VDH: las 4 preguntas según el tipo de mueble ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Las preguntas del control dependen del mueble: la pared con estantes sigue con Frontales;
--     las mesas preguntan Exhibición (por color y bien cargada) en vez de Frontales; los
--     percheros, Colgado y Exhibición; las vidrieras, Armado, Carteles, Limpieza y Luces.
--     El depósito, igual que antes.
--   · Correlo DESPUÉS de que esté subida la IA nueva (analizar-foto): desde ahí la IA mira lo
--     de cada mueble (en una mesa no busca frontales). Los chicos ven las preguntas nuevas
--     cuando se publique la app; hasta entonces responden las de antes y se aceptan igual.
--   · Si a un módulo le cambia el mueble (lo elige el supervisor, lo renombran o lo mueven en
--     el croquis), se cancelan solas las tareas de la IA de puntos que ese mueble ya no tiene
--     (por ejemplo, "Frontales" en un perchero).
--   · Suma reglas para los puntos nuevos (perchas, maniquíes, carteles, luces, el vidrio):
--     las podés cambiar en Ajustes → Reglas de orden.
--   · Al final te muestra cada local con sus tipos de mueble y las preguntas de cada uno.
--   · Reversible (el detalle está abajo).

-- =====================================================================
-- Módulo VDH · Migración 36 (SQL 129), 15/10/2026: las 4 preguntas del
-- control según el tipo de mueble.
--
-- Salió de la prueba de fotos en Rivadavia: el Exhibidor 3 (una mesa del
-- medio con perchero abajo) preguntaba "Frontales", la IA decía "no se ve"
-- y Revisar lo marcaba como que no coincidía. Mauricio: "dependiendo el
-- módulo tendría que haber cosas diferentes"; "que la IA marque lo esencial,
-- después igual lo tiene que ver el supervisor".
--
-- Las preguntas (siguen siendo 4: el nivel sale de cuántas dice que sí):
--   Pared con estantes: Doblado · Frontales · Etiquetas · Limpieza (como antes)
--   Mesa o exhibidor:   Doblado · Exhibición (por color y bien cargada) · Etiquetas · Limpieza
--   Perchero:           Colgado · Exhibición (por color, o por talle) · Etiquetas · Limpieza
--   Vidriera:           Armado · Carteles · Limpieza · Luces
--   Depósito:           Doblado · Rotulado · Segmento y talle · Limpieza (como antes)
-- La mesa no pregunta "Colgado" porque no todas tienen perchero (ronda 1 del
-- árbitro): la IA sí lo mira, y si no hay nada colgado dice "no se ve".
-- La IA mira las mismas, más "Exhibición" (colores y cantidades) en la pared
-- y "Colgado" en las mesas.
--
-- El tipo de mueble sale del croquis (orden_tipo_mueble: isla, o el nombre
-- dice vidriera o perchero), y desde ahora el supervisor lo puede elegir a
-- mano en la ficha del módulo (orden_modulos.mueble; null = el del croquis).
--
-- 1. orden_modulos.mueble: el elegido a mano.
-- 2. orden_mueble(): el elegido o el del croquis.
-- 3. orden_checks_mueble() y orden_checks_ia_mueble(): las preguntas.
-- 4. orden_modulo_mueble(): lo elige el supervisor del local o Administración.
--    Cancela las tareas pendientes de la IA de puntos que el mueble ya no tiene
--    (si no, no se cerrarían nunca solas). También al renombrarlo o moverlo en el
--    croquis (un disparador en orden_modulos).
-- 5. orden_enviar_control: las preguntas del mueble. También acepta las del
--    mueble del croquis (si se lo cambiaron mientras respondía) y las del sector
--    (la app de antes, que sigue en los teléfonos hasta que se actualiza).
-- 6. orden_preparar_analisis: a la IA le llegan las del mueble.
-- 7. orden_v_controles y orden_v_por_revisar: suman la columna mueble.
-- 8. Reglas para los puntos nuevos (se editan en Ajustes → Reglas de orden).
--
-- Se puede correr más de una vez.
-- Reversible:
--   volver orden_enviar_control a la de la migración 35 y orden_preparar_analisis
--   a la de la migración 34;
--   volver orden_v_por_revisar y orden_v_controles a las de antes (sin mueble:
--   drop view orden_v_por_revisar; create or replace view orden_v_controles …;
--   create view orden_v_por_revisar …, las dos con security_invoker y sus grants);
--   drop trigger orden_modulos_cambio_mueble on orden_modulos;
--   drop function orden_modulos_cambio_mueble_(), orden_modulo_mueble(uuid, text), orden_cancelar_tareas_otro_mueble_(uuid, uuid),
--   orden_checks_ia_mueble(text), orden_checks_mueble(text),
--   orden_mueble(text, boolean, text, orden_sector_tipo);
--   alter table orden_modulos drop column mueble;
--   delete from orden_reglas where check_clave in ('colgado', 'armado', 'carteles', 'luces')
--     or texto like 'En la vidriera:%';
--   (las tareas canceladas por cambio de mueble dicen "el módulo cambió de tipo de
--   mueble" en motivo_no_pude: se pueden volver a 'pendiente' si hiciera falta)
-- =====================================================================

-- 1. El tipo de mueble elegido a mano (null = el del croquis)
alter table orden_modulos add column if not exists mueble text;
alter table orden_modulos drop constraint if exists orden_modulos_mueble_check;
alter table orden_modulos add constraint orden_modulos_mueble_check
  check (mueble in ('estantes', 'mesa', 'perchero', 'vidriera'));
comment on column orden_modulos.mueble is 'Tipo de mueble elegido a mano (estantes, mesa, perchero, vidriera). null = el que sale del croquis (orden_tipo_mueble)';

-- 2. El mueble de un módulo: el elegido o el del croquis (el depósito es siempre depósito)
create or replace function orden_mueble(p_mueble text, p_isla boolean, p_nombre text, p_sector orden_sector_tipo)
returns text language sql immutable set search_path = public as $$
  select case when p_sector = 'deposito' then 'deposito'
              else coalesce(p_mueble, orden_tipo_mueble(p_isla, p_nombre, p_sector)) end
$$;
revoke all on function orden_mueble(text, boolean, text, orden_sector_tipo) from public, anon;
grant execute on function orden_mueble(text, boolean, text, orden_sector_tipo) to authenticated, service_role;

-- 3. Las 4 preguntas del vendedor según el mueble, y lo que mira la IA
create or replace function orden_checks_mueble(p_mueble text) returns text[]
language sql immutable set search_path = public as $$
  select case p_mueble
    when 'mesa'     then array['dobladas', 'exhibicion', 'etiquetas', 'limpieza']
    when 'perchero' then array['colgado', 'exhibicion', 'etiquetas', 'limpieza']
    when 'vidriera' then array['armado', 'carteles', 'limpieza', 'luces']
    when 'deposito' then orden_checks('deposito')
    else orden_checks('salon') end
$$;
-- La IA: las mismas, más "exhibicion" (colores y cantidades) en la pared y "colgado" en la mesa
-- (si no tiene nada colgado, la IA dice "no se ve", que nunca es un error).
create or replace function orden_checks_ia_mueble(p_mueble text) returns text[]
language sql immutable set search_path = public as $$
  select orden_checks_mueble(p_mueble) || case p_mueble
    when 'mesa' then array['colgado']
    when 'perchero' then '{}'::text[]
    when 'vidriera' then '{}'::text[]
    when 'deposito' then '{}'::text[]
    else array['exhibicion'] end
$$;
-- Las tareas pendientes de la IA de puntos que el mueble ya no tiene: la IA no los mira más,
-- así que no se cerrarían nunca solas (y el módulo seguiría diciendo "Corregir").
create or replace function orden_cancelar_tareas_otro_mueble_(p_modulo uuid, p_por uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_checks text[]; n integer;
begin
  select orden_checks_ia_mueble(orden_mueble(m.mueble, m.isla, m.nombre, s.tipo)) into v_checks
    from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = p_modulo;
  update orden_tareas t
     set estado = 'cancelada', motivo_no_pude = 'Cancelada: el módulo cambió de tipo de mueble y ese punto ya no se revisa',
         completada_en = now(), prorroga_respondida_por = p_por
   where t.modulo_id = p_modulo and t.origen = 'ia' and t.estado = 'pendiente'
     and split_part(t.clave, ':', 3) not in ('', 'general')
     and not (split_part(t.clave, ':', 3) = any (v_checks));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function orden_cancelar_tareas_otro_mueble_(uuid, uuid) from public, anon, authenticated;
grant execute on function orden_cancelar_tareas_otro_mueble_(uuid, uuid) to service_role;
-- El mueble también cambia al renombrar el módulo ("Perchero de jeans") o al moverlo en el croquis
-- (al centro, a otra pared): un disparador cancela ahí las mismas tareas (ronda 2 del árbitro).
-- Lleva la cuenta en orden.tareas_canceladas, para que orden_modulo_mueble la pueda avisar.
create or replace function orden_modulos_cambio_mueble_() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_antes text; v_ahora text; n integer;
begin
  select orden_mueble(old.mueble, old.isla, old.nombre, s.tipo) into v_antes from orden_sectores s where s.id = old.sector_id;
  select orden_mueble(new.mueble, new.isla, new.nombre, s.tipo) into v_ahora from orden_sectores s where s.id = new.sector_id;
  if v_antes is distinct from v_ahora then
    n := orden_cancelar_tareas_otro_mueble_(new.id, orden_yo_id());
    perform set_config('orden.tareas_canceladas',
      (coalesce(nullif(current_setting('orden.tareas_canceladas', true), ''), '0')::integer + n)::text, true);
  end if;
  return null;
end $$;
revoke all on function orden_modulos_cambio_mueble_() from public, anon, authenticated;
drop trigger if exists orden_modulos_cambio_mueble on orden_modulos;
create trigger orden_modulos_cambio_mueble
  after update of mueble, isla, nombre, sector_id on orden_modulos
  for each row
  when (old.mueble is distinct from new.mueble or old.isla is distinct from new.isla
        or old.nombre is distinct from new.nombre or old.sector_id is distinct from new.sector_id)
  execute function orden_modulos_cambio_mueble_();
revoke all on function orden_checks_mueble(text) from public, anon;
revoke all on function orden_checks_ia_mueble(text) from public, anon;
grant execute on function orden_checks_mueble(text) to authenticated, service_role;
grant execute on function orden_checks_ia_mueble(text) to authenticated, service_role;

-- 4. Elegir el mueble a mano (null vuelve al del croquis). Devuelve el que queda y cuántas
--    tareas de la IA se cancelaron por ser de puntos que ya no tiene (las cancela el disparador).
--    Se borra antes: una versión de prueba devolvía text, y create or replace no cambia el tipo.
drop function if exists orden_modulo_mueble(uuid, text);
create function orden_modulo_mueble(p_modulo uuid, p_mueble text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m orden_modulos; s orden_sectores; v_mueble text := nullif(trim(p_mueble), ''); n integer;
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  select * into s from orden_sectores where id = m.sector_id;
  if not orden_es_supervisor_de(s.local_id) then
    raise exception 'El tipo de mueble lo cambia el supervisor del local o Administración';
  end if;
  if s.tipo = 'deposito' then raise exception 'En el depósito las preguntas son siempre las del depósito'; end if;
  if v_mueble is not null and v_mueble not in ('estantes', 'mesa', 'perchero', 'vidriera') then
    raise exception 'Ese tipo de mueble no existe';
  end if;
  perform set_config('orden.tareas_canceladas', '0', true);
  update orden_modulos set mueble = v_mueble where id = m.id;
  n := coalesce(nullif(current_setting('orden.tareas_canceladas', true), ''), '0')::integer;
  return jsonb_build_object('mueble', orden_mueble(v_mueble, m.isla, m.nombre, s.tipo), 'tareas_canceladas', n);
end $$;
revoke all on function orden_modulo_mueble(uuid, text) from public, anon;
grant execute on function orden_modulo_mueble(uuid, text) to authenticated, service_role;

-- 5. Enviar (igual que en la migración 35, con las preguntas del mueble)
create or replace function orden_enviar_control(p_control uuid, p_respuestas jsonb)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; v_tipo orden_sector_tipo; v_mueble text; v_croquis text; v_checks text[]; v_otro text[]; v_resp jsonb := '{}';
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

  select s.tipo, orden_mueble(m.mueble, m.isla, m.nombre, s.tipo), orden_mueble(null, m.isla, m.nombre, s.tipo)
    into v_tipo, v_mueble, v_croquis
    from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = c.modulo_id;
  v_checks := orden_checks_mueble(v_mueble);
  -- Si no respondió las del mueble, valen también: las del mueble del croquis (se lo eligieron a
  -- mano mientras respondía) y las del sector (la app de antes). Nada más: así la comparación
  -- punto a punto con la IA sigue valiendo.
  if exists (select 1 from unnest(v_checks) x where jsonb_typeof(p_respuestas -> x) is distinct from 'boolean') then
    select j.checks into v_otro
      from unnest(array[v_croquis, case when v_tipo = 'deposito' then 'deposito' else 'estantes' end]) with ordinality t(mueble, n)
      cross join lateral (select orden_checks_mueble(t.mueble) checks) j
     where not exists (select 1 from unnest(j.checks) x where jsonb_typeof(p_respuestas -> x) is distinct from 'boolean')
     order by t.n limit 1;
    if v_otro is not null then v_checks := v_otro; end if;
  end if;
  foreach k in array v_checks loop
    if jsonb_typeof(p_respuestas -> k) is distinct from 'boolean' then
      -- Respondió 4, pero de otro mueble: se lo cambiaron mientras respondía (ronda 2 del árbitro).
      if (case when jsonb_typeof(p_respuestas) = 'object'
               then (select count(*) from jsonb_each(p_respuestas) e where jsonb_typeof(e.value) = 'boolean') else 0 end) >= 4 then
        raise exception 'Cambiaron las preguntas de este módulo: volvé a Fotos y respondelas de nuevo';
      end if;
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

-- 6. Lo que recibe la IA con cada foto (igual que en la migración 34, con el mueble elegido
--    y las preguntas de ese mueble)
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
    'ia_sugerencias', coalesce(cfg.ia_sugerencias, false)
  );
end $$;

-- 7. Las vistas de los controles: suman el mueble (al final; security_invoker se repite:
--    create or replace view lo borraría)
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
    ((c.enviado_en IS NOT NULL) AND (c.enviado_en <= c.vence_en)) AS a_tiempo,
    orden_mueble(m.mueble, m.isla, m.nombre, s.tipo) AS mueble
   FROM ((((orden_controles c
     JOIN orden_modulos m ON ((m.id = c.modulo_id)))
     JOIN orden_sectores s ON ((s.id = m.sector_id)))
     LEFT JOIN orden_personas pe ON ((pe.id = c.persona_id)))
     LEFT JOIN orden_fotos f ON ((f.id = c.ultimo_intento_id)));

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
    mueble
   FROM orden_v_controles
  WHERE (estado = 'enviado'::orden_control_estado)
  ORDER BY discrepancia DESC, (orden_puntos(nivel)) NULLS FIRST, enviado_en;

-- 8. Reglas para los puntos nuevos: para todos los locales, se editan en Ajustes → Reglas de orden.
--    Sólo la primera vez: si ese punto ya tiene alguna regla (aunque la hayan cambiado o apagado),
--    no se vuelven a agregar.
insert into orden_reglas (sector_tipo, check_clave, texto, orden)
select 'salon', x.clave, x.texto, x.orden
  from (values
    ('colgado',  'Perchas iguales, todas mirando para el mismo lado.', 1),
    ('colgado',  'Prendas colgadas derechas y acomodadas: sin caídas, torcidas ni amontonadas.', 2),
    ('armado',   'Maniquíes vestidos completos y prolijos: prendas derechas, sin arrugas ni etiquetas a la vista.', 1),
    ('armado',   'La vidriera se ve completa y ordenada, sin huecos ni cosas fuera de lugar.', 2),
    ('carteles', 'Carteles y precios derechos, limpios y a la vista, sin cintas ni papeles sueltos.', 1),
    ('luces',    'Todas las luces de la vidriera prendidas, ninguna quemada.', 1)
  ) as x(clave, texto, orden)
 where not exists (select 1 from orden_reglas r where r.check_clave = x.clave);
insert into orden_reglas (sector_tipo, check_clave, texto, orden)
select 'salon', 'limpieza', 'En la vidriera: el vidrio sin marcas ni huellas y el piso limpio.', 9
 where not exists (select 1 from orden_reglas r where r.check_clave = 'limpieza' and r.texto like 'En la vidriera:%');

-- 9. Por si ya hay tareas de la IA de puntos que el mueble de su módulo no tiene (hoy no hay):
--    se cancelan como al cambiar el mueble.
select orden_cancelar_tareas_otro_mueble_(t.modulo_id, null)
  from (select distinct modulo_id from orden_tareas where origen = 'ia' and estado = 'pendiente' and modulo_id is not null) t;

-- Lo que quedó: cada local con sus tipos de mueble y las preguntas de cada uno
select l.nombre as local, orden_mueble(m.mueble, m.isla, m.nombre, s.tipo) as mueble, count(*) as modulos,
       array_to_string(orden_checks_mueble(orden_mueble(m.mueble, m.isla, m.nombre, s.tipo)), ' · ') as preguntas
from orden_modulos m join orden_sectores s on s.id = m.sector_id join orden_locales l on l.id = s.local_id
where m.activo and s.activo and l.activo
group by 1, 2, 4
order by 1, 2;
