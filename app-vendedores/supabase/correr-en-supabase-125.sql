-- ═══ SQL 125 (15/10/2026) · Equipo VDH: el degradé según el lado del local, y los módulos de liquidación ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · La IA va a saber de qué lado del local está cada módulo (sale del croquis): en la pared izquierda el degradé
--     arranca con el más claro a la izquierda; en la derecha, a la derecha (como lo ve el cliente que entra).
--     En el fondo, el frente, el centro y la vidriera puede arrancar de cualquier lado.
--   · Un módulo se puede marcar "de liquidación" (va por talle): ahí la IA no pide degradé.
--   · Se cancelan las tareas de degradé que la IA le creó hoy a Nano por error en la pared derecha
--     (módulos 15 a 18; si a Seba le salió alguna igual en el 11 a 14, también).
--   · Hasta que suba la IA nueva, esto no cambia nada de lo que ves: la IA de hoy ignora los datos nuevos.
--   · Reversible (el detalle está abajo). Las tareas canceladas, no hace falta volverlas: estaban mal.

-- =====================================================================
-- Módulo VDH · Migración 34 (SQL 125), 15/10/2026: el sentido del degradé
-- según el lado del local, y los módulos de liquidación (van por talle).
--
-- Salió de la primera prueba real de fotos en Rivadavia (Nano y Seba).
-- Mauricio: "como ese lado arranca del derecho, el más claro, al último el
-- negro… lo que estamos mirando es el lado derecho del local. Del lado
-- izquierdo va para el izquierdo el degradé… porque es como lo ve el
-- cliente". La IA pedía siempre el claro a la izquierda de la foto y en la
-- pared derecha marcaba "corregir" percheros que estaban bien.
-- Y: "hay percheros que están por talla… eso es liquidación. Habría que
-- tener la opción de aclarar que si es liquidación va por talla, entonces
-- no pida el degradé".
--
-- 1. orden_modulos.liquidacion: el módulo es de liquidación (lo colgado va
--    por talle, no por color). Lo marca quien escribe "qué hay" (el
--    responsable o el suplente del sector, o el supervisor del local).
-- 2. orden_modulo_liquidacion(p_modulo, p_valor): marcarlo o desmarcarlo.
-- 3. orden_lado_modulo(p_modulo): en qué pared está ('izquierda', 'fondo',
--    'derecha', 'frente'), o 'centro', 'vidriera', 'deposito'. Sale del
--    croquis con el mismo recorrido que numera los módulos en la app
--    (ordenCroquis: izquierda → fondo → derecha → frente, arrancando en la
--    puerta). Sin croquis, de la cantidad por pared (el 1 en la izquierda).
-- 4. orden_preparar_analisis: le pasa a la IA el lado y si es liquidación
--    (todo lo demás, igual que en la migración 32).
--
-- Se puede correr más de una vez.
-- Reversible:
--   volver orden_preparar_analisis a la de la migración 32;
--   drop function orden_lado_modulo(uuid); drop function orden_modulo_liquidacion(uuid, boolean);
--   alter table orden_modulos drop column liquidacion;
-- =====================================================================

-- 1. El módulo de liquidación
alter table orden_modulos add column if not exists liquidacion boolean not null default false;
comment on column orden_modulos.liquidacion is 'true: es de liquidación (lo colgado va por talle, no por color): la IA no pide degradé';

-- 2. Marcarlo (el mismo permiso que "qué hay")
create or replace function orden_modulo_liquidacion(p_modulo uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m orden_modulos;
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  if not orden_puede_que_hay(m.id) then
    raise exception 'Lo marca quien tiene el módulo o el supervisor del local';
  end if;
  update orden_modulos set liquidacion = coalesce(p_valor, false) where id = m.id;
end $$;
revoke all on function orden_modulo_liquidacion(uuid, boolean) from public, anon;
grant execute on function orden_modulo_liquidacion(uuid, boolean) to authenticated, service_role;

-- 3. En qué lado del local está el módulo
create or replace function orden_lado_modulo(p_modulo uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  m orden_modulos; s orden_sectores; v_mapa jsonb; v_cq jsonb; v_puerta jsonb; l jsonb;
  v_vuelta text[] := array['izquierda', 'fondo', 'derecha', 'frente'];
  v_pared text[] := '{}'; v_es boolean[] := '{}';
  w text; i int; k int; j int; v_len int; v_total int := 0; v_inicio int := 0; v_n int := 0; v_hasta int := 0;
begin
  select * into m from orden_modulos where id = p_modulo;
  if not found then return null; end if;
  select * into s from orden_sectores where id = m.sector_id;
  if s.tipo = 'deposito' then return 'deposito'; end if;
  if orden_es_vidriera(m.isla, m.nombre) then return 'vidriera'; end if;
  if m.isla then return 'centro'; end if;

  select c.mapa into v_mapa from orden_config c where c.local_id = s.local_id;
  v_cq := v_mapa #> '{croquis,salon}';

  if v_cq is not null and jsonb_typeof(v_cq -> 'paredes') = 'object' then
    -- Todos los lugares de la vuelta (módulos y no módulos); la numeración arranca en la puerta.
    v_puerta := v_cq -> 'puerta';
    foreach w in array v_vuelta loop
      v_len := case when jsonb_typeof(v_cq #> array['paredes', w]) = 'array'
                    then jsonb_array_length(v_cq #> array['paredes', w]) else 0 end;
      for i in 0 .. v_len - 1 loop
        if v_puerta ->> 'pared' = w and (v_puerta ->> 'pos')::int = i then v_inicio := v_total; end if;
        l := v_cq #> array['paredes', w, i::text];
        v_pared := v_pared || w;
        v_es := v_es || (jsonb_typeof(l) = 'string' and l #>> '{}' in ('m', 'd'));
        v_total := v_total + 1;
      end loop;
      if v_puerta ->> 'pared' = w and (v_puerta ->> 'pos')::int >= v_len then v_inicio := v_total; end if;
    end loop;
    for k in 0 .. v_total - 1 loop
      j := (v_inicio + k) % v_total;
      if v_es[j + 1] then
        v_n := v_n + 1;
        if v_n = m.numero then return v_pared[j + 1]; end if;
      end if;
    end loop;
    return null;   -- un módulo que no está en el croquis (por ejemplo, apagado)
  end if;

  -- Sin croquis: la cantidad por pared, numerada desde la izquierda
  foreach w in array v_vuelta loop
    v_hasta := v_hasta + greatest(coalesce((v_mapa ->> w)::int, 0), 0);
    if m.numero <= v_hasta then return w; end if;
  end loop;
  return null;
end $$;
revoke all on function orden_lado_modulo(uuid) from public, anon;
grant execute on function orden_lado_modulo(uuid) to authenticated, service_role;

-- 4. Lo que recibe la IA con cada foto (igual que en la migración 32, más 'lado' y 'liquidacion')
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
  v_tipo := orden_tipo_mueble(m.isla, m.nombre, s.tipo);
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
    'lado', orden_lado_modulo(m.id),
    'liquidacion', coalesce(m.liquidacion, false),
    'reglas_extra', m.reglas_extra,
    'exhibidor', null,
    'checks', to_jsonb(orden_checks_ia(s.tipo)),
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

-- 5. Sólo hoy, en Rivadavia: las tareas de degradé que la IA creó mal en la pared derecha, canceladas.
update orden_tareas t set estado = 'cancelada'
from orden_modulos m, orden_locales l
where m.id = t.modulo_id and l.id = t.local_id and l.nombre = 'Rivadavia'
  and t.origen = 'ia' and t.estado = 'pendiente'
  and t.creado_en >= timestamptz '2026-10-15 00:00-03' and t.creado_en < timestamptz '2026-10-16 00:00-03'
  and t.titulo ~* '(degrad|claro a oscuro|claro al m[aá]s oscuro)'
  and orden_lado_modulo(m.id) = 'derecha';

-- Lo que quedó: de qué lado está cada módulo de Rivadavia
select m.numero, m.nombre, orden_lado_modulo(m.id) as lado, m.liquidacion
from orden_modulos m join orden_sectores s on s.id = m.sector_id join orden_locales l on l.id = s.local_id
where l.nombre = 'Rivadavia' and s.tipo = 'salon' and m.activo
order by m.numero;
