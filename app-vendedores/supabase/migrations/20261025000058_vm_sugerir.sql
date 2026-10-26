-- ════════════════════════════════════════════════════════════════════════
-- Migración 58 (SQL 173, 25/10/2026, pedido de Mauricio): la IA sugiere cómo
-- distribuir el salón, con las reglas de visual merchandising de VDH.
--   · Mauricio: "como hacen las grandes marcas, armar una base, con
--     supervisores o alguien que pueda contar con la ayuda de la IA, y
--     ponerla para que impacte en todos los locales". Las reglas VDH quedan
--     en la base (orden_vm_reglas): son una sola para todos los locales, las
--     cambian los supervisores y Administración desde el croquis, y cada
--     cambio queda como una versión nueva (se puede ver quién y cuándo).
--   · La colección sale sola del final del código (los dos últimos números:
--     el más alto es la nueva, el anterior es la que va a liquidación, los
--     impares son primavera-verano y los pares otoño-invierno, 99 son los
--     básicos). Se puede fijar a mano.
--   · "Sugerir distribución" (croquis, vista Zonas): la IA propone qué
--     cambiar en los módulos (como mucho el 30 %). Es para el supervisor: la
--     manda al responsable como tarea con foto, o la descarta con su por qué
--     (la IA lo lee la próxima vez). Al vendedor no le llega nada de la IA.
-- Las reglas en sí no van acá: las carga el SQL 173.
-- Se puede correr más de una vez.
-- Reversible: deshacer-173.sql (borra las funciones y las dos tablas; las
--   tareas que ya se mandaron quedan).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Las reglas VDH: cada vez que se guardan queda una fila nueva; la vigente es la última.
create table if not exists orden_vm_reglas (
  id              bigint generated always as identity primary key,
  texto           text not null check (char_length(texto) between 1 and 40000),
  coleccion_nueva smallint check (coleccion_nueva between 1 and 98),   -- vacía: la saca sola del código
  momento         text not null default 'cambio'
                  check (momento in ('lanzamiento', 'cambio', 'mitad', 'liquidacion_parcial', 'liquidacion_total', 'fecha_clave')),
  fecha_clave     text check (char_length(fecha_clave) <= 80),
  creado_en       timestamptz not null default now(),
  creado_por      uuid references orden_personas(id) on delete set null,
  creado_nombre   text
);
alter table orden_vm_reglas enable row level security;
comment on table orden_vm_reglas is 'Las reglas de visual merchandising de VDH para la IA que sugiere la distribución del salón (una versión por cada vez que se guardan; la vigente es la de id más alto)';

-- 2. Cada pedido de "Sugerir distribución", con lo que propuso la IA y qué hizo el supervisor con cada propuesta
create table if not exists orden_vm_sugerencias (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references orden_locales(id) on delete cascade,
  estado        text not null default 'pensando' check (estado in ('pensando', 'lista', 'error')),
  creada_en     timestamptz not null default clock_timestamp(),   -- la hora de verdad: el orden de "la última"
  terminada_en  timestamptz,
  creada_por    uuid references orden_personas(id) on delete set null,
  creada_nombre text,
  reglas_id     bigint references orden_vm_reglas(id) on delete set null,
  coleccion     smallint,
  momento       text,
  modulos       jsonb not null default '[]'::jsonb,   -- lo que vio la IA de cada módulo
  resumen       text,
  falta         text,                                 -- lo que la IA dice que le faltó saber
  propuestas    jsonb not null default '[]'::jsonb,   -- [{ref, modulo_id, hoy, propone, mover, porque, prioridad, estado…}]
  modelo        text,
  error         text
);
create index if not exists orden_vm_sugerencias_local on orden_vm_sugerencias (local_id, creada_en desc);
alter table orden_vm_sugerencias enable row level security;
comment on table orden_vm_sugerencias is 'Las sugerencias de distribución del salón de la IA (visual merchandising): cada propuesta queda pendiente, mandada (tarea con foto al responsable) o descartada (con su por qué)';

-- 3. La colección por el código
create or replace function orden_vm_temporada(p_n int)
returns text language sql immutable set search_path = public as $$
  select case when p_n is null then null when p_n = 99 then 'básicos'
              when p_n % 2 = 1 then 'primavera-verano' else 'otoño-invierno' end
$$;

-- La nueva: el número más alto (del 1 al 98) al final de los códigos, si tiene al menos 3 artículos.
create or replace function orden_vm_coleccion_auto()
returns smallint language sql stable security definer set search_path = public as $$
  select max(n)::smallint from (
    select n from (select codigo, case when codigo ~ '[0-9]{2}$' then right(codigo, 2)::int end n from stock_fabrica) s
    where n between 1 and 98
    group by n having count(distinct codigo) >= 3) x
$$;

-- Qué trae cada colección en el stock de fábrica: la nueva, la anterior, las viejas y los básicos (rubros y colores).
create or replace function orden_vm_colecciones(p_nueva int)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select codigo, coalesce(nullif(trim(rubro), ''), 'Sin rubro') rubro, nullif(upper(trim(color_nombre)), '') color,
           greatest(coalesce(cantidad, 0), 0) cantidad,
           case when codigo ~ '[0-9]{2}$' then right(codigo, 2)::int end n
    from stock_fabrica),
  g as (
    select case when n = p_nueva then 'nueva' when n = p_nueva - 1 then 'anterior' when n = 99 then 'basicos' else 'viejas' end grupo,
           codigo, rubro, color, cantidad
    from s where n is not null),
  r as (select grupo, rubro, count(distinct codigo)::int articulos, sum(cantidad)::int unidades from g group by 1, 2),
  c as (select grupo, color, row_number() over (partition by grupo order by sum(cantidad) desc, color) k
        from g where color is not null group by 1, 2)
  select coalesce(jsonb_object_agg(x.grupo, x.dato), '{}'::jsonb) from (
    select r.grupo, jsonb_build_object(
      'numero', case r.grupo when 'nueva' then p_nueva when 'anterior' then p_nueva - 1 when 'basicos' then 99 end,
      'temporada', case r.grupo when 'nueva' then orden_vm_temporada(p_nueva) when 'anterior' then orden_vm_temporada(p_nueva - 1)
                                when 'basicos' then 'todo el año' end,
      'articulos', sum(r.articulos)::int,
      'unidades', sum(r.unidades)::int,
      'rubros', jsonb_agg(jsonb_build_object('rubro', r.rubro, 'articulos', r.articulos, 'unidades', r.unidades)
                          order by r.unidades desc, r.rubro),
      'colores', (select coalesce(jsonb_agg(initcap(lower(c.color)) order by c.k), '[]'::jsonb)
                    from c where c.grupo = r.grupo and c.k <= 6)) dato
    from r group by r.grupo) x
$$;

-- 4. Quién las cambia: los supervisores (de un local o de varios) y Administración. Gerencia sólo las lee.
create or replace function orden_vm_puede()
returns boolean language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo and aprobado and rol in ('admin', 'supervisor'))
$$;

create or replace function orden_vm_reglas_leer()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r orden_vm_reglas; v_auto smallint; v_col int;
begin
  if not (orden_vm_puede() or orden_es_gerencia()) then
    raise exception 'Las reglas de visual merchandising las ven los supervisores y Administración';
  end if;
  select * into r from orden_vm_reglas order by id desc limit 1;
  v_auto := orden_vm_coleccion_auto();
  v_col := coalesce(r.coleccion_nueva, v_auto);
  return jsonb_build_object(
    'id', r.id,
    'texto', coalesce(r.texto, ''),
    'coleccion_nueva', r.coleccion_nueva,
    'coleccion_auto', v_auto,
    'coleccion', v_col,
    'temporada', orden_vm_temporada(v_col),
    'momento', coalesce(r.momento, 'cambio'),
    'fecha_clave', r.fecha_clave,
    'actualizado_en', r.creado_en,
    'actualizado_nombre', r.creado_nombre,
    'versiones', (select count(*) from orden_vm_reglas)::int,
    'puede_editar', orden_vm_puede(),
    'colecciones', orden_vm_colecciones(v_col));
end $$;

create or replace function orden_vm_reglas_guardar(p_texto text, p_coleccion int default null,
                                                   p_momento text default 'cambio', p_fecha_clave text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r orden_vm_reglas; v_yo uuid := orden_yo_id();
  v_texto text := trim(replace(coalesce(p_texto, ''), E'\r', ''));
  v_momento text := coalesce(nullif(trim(p_momento), ''), 'cambio');
  v_fecha text := nullif(regexp_replace(trim(coalesce(p_fecha_clave, '')), '\s+', ' ', 'g'), '');
begin
  if not orden_vm_puede() then raise exception 'Las reglas las cambian los supervisores y Administración'; end if;
  if v_texto = '' then raise exception 'Las reglas no pueden quedar vacías'; end if;
  if char_length(v_texto) > 40000 then raise exception 'Las reglas son muy largas: como mucho 40.000 letras'; end if;
  if p_coleccion is not null and p_coleccion not between 1 and 98 then
    raise exception 'La colección es un número del 1 al 98 (99 son los básicos)';
  end if;
  if v_momento not in ('lanzamiento', 'cambio', 'mitad', 'liquidacion_parcial', 'liquidacion_total', 'fecha_clave') then
    raise exception 'Ese momento no existe';
  end if;
  if v_momento <> 'fecha_clave' then v_fecha := null; end if;
  if char_length(v_fecha) > 80 then raise exception 'La fecha clave, en pocas palabras (como mucho 80 letras)'; end if;

  perform pg_advisory_xact_lock(hashtext('orden_vm_reglas'));
  select * into r from orden_vm_reglas order by id desc limit 1;
  -- Si no cambió nada, no se crea otra versión
  if not found or r.texto is distinct from v_texto or r.coleccion_nueva is distinct from p_coleccion::smallint
     or r.momento is distinct from v_momento or r.fecha_clave is distinct from v_fecha then
    insert into orden_vm_reglas (texto, coleccion_nueva, momento, fecha_clave, creado_por, creado_nombre)
    values (v_texto, p_coleccion, v_momento, v_fecha, v_yo, (select nombre from orden_personas where id = v_yo));
  end if;
  return orden_vm_reglas_leer();
end $$;

-- 5. "Sugerir distribución": arma lo que lee la IA y deja la sugerencia "pensando" (la Edge Function sugerir-vm).
--    p_modulos: los del croquis, en su orden: [{id, ref (el número que se ve, o el nombre de la vidriera), nombre, zona}].
create or replace function orden_vm_preparar(p_local uuid, p_modulos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r orden_vm_reglas; v_local orden_locales; v_yo uuid := orden_yo_id(); v_id uuid; v_col int;
  v_tz text; v_hoy date; v_md text; v_estacion text; v_n int;
  v_mods jsonb; v_lecciones jsonb; v_recientes jsonb;
begin
  if p_local is null or not orden_es_supervisor_de(p_local) then
    raise exception 'La distribución la pide el supervisor del local o Administración';
  end if;
  select * into v_local from orden_locales where id = p_local;
  if not found then raise exception 'No encontramos ese local'; end if;
  if jsonb_typeof(p_modulos) is distinct from 'array' or jsonb_array_length(p_modulos) = 0 then
    raise exception 'El croquis no tiene módulos para mirar';
  end if;
  v_n := jsonb_array_length(p_modulos);
  if v_n > 120 then raise exception 'Son demasiados módulos'; end if;
  select * into r from orden_vm_reglas order by id desc limit 1;
  if not found then raise exception 'Faltan las reglas VDH: cargalas en "Reglas VDH"'; end if;

  -- De a una por local: si hay una pensando hace menos de 3 minutos, se espera; las más viejas se cortaron.
  perform pg_advisory_xact_lock(hashtext('orden_vm:' || p_local::text));
  if exists (select 1 from orden_vm_sugerencias
              where local_id = p_local and estado = 'pensando' and creada_en > now() - interval '3 minutes') then
    raise exception 'Ya hay una sugerencia en camino para este local: esperá un momento';
  end if;
  update orden_vm_sugerencias set estado = 'error', error = 'Se cortó mientras pensaba', terminada_en = now()
   where local_id = p_local and estado = 'pensando';

  v_tz := coalesce(nullif(v_local.zona_horaria, ''), 'America/Argentina/Buenos_Aires');
  v_hoy := (now() at time zone v_tz)::date;
  v_md := to_char(v_hoy, 'MMDD');
  v_estacion := case when v_md between '0321' and '0620' then 'otoño' when v_md between '0621' and '0920' then 'invierno'
                     when v_md between '0921' and '1220' then 'primavera' else 'verano' end;
  v_col := coalesce(r.coleccion_nueva, orden_vm_coleccion_auto());

  -- Cada módulo: lo del croquis, lo anotado y lo que vio la IA en la última foto
  select jsonb_agg(jsonb_build_object(
           'ref', l.ref,
           'id', m.id,
           'nombre', coalesce(nullif(l.nombre, ''), m.nombre, 'Módulo ' || m.numero),
           'zona', case when m.id is not null and orden_es_vidriera(m.isla, m.nombre) then 'vidriera' else l.zona end,
           'lugar', case when m.id is not null then orden_lado_modulo(m.id) end,
           'mueble', case when m.id is not null then orden_mueble(m.mueble, m.isla, m.nombre, sec.tipo) end,
           'liquidacion', coalesce(m.liquidacion, false),
           'contenido', nullif(trim(m.contenido), ''),
           'responsable', per.nombre,
           'foto', case when uf.tomada_en is not null then jsonb_build_object(
               'fecha', to_char(uf.tomada_en at time zone v_tz, 'DD/MM'),
               'dias', v_hoy - (uf.tomada_en at time zone v_tz)::date,
               'que_hay', nullif(uf.r ->> 'que_hay', ''),
               'rubros', coalesce(uf.r -> 'rubros', '[]'::jsonb),
               'colores', coalesce(uf.r -> 'colores', '[]'::jsonb),
               'look', uf.r -> 'look') end,
           'ok', m.id is not null and l.ref <> ''
                 and (l.zona is null or l.zona in ('vidriera', 'entrada', 'caliente', 'media', 'fondo', 'caja')))
         order by l.ord)
    into v_mods
  from (select case when (e ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e ->> 'id')::uuid end id,
               left(regexp_replace(trim(coalesce(e ->> 'ref', '')), '\s+', ' ', 'g'), 20) ref,
               left(regexp_replace(trim(coalesce(e ->> 'nombre', '')), '\s+', ' ', 'g'), 60) nombre,
               nullif(lower(trim(coalesce(e ->> 'zona', ''))), '') zona, ord
          from jsonb_array_elements(p_modulos) with ordinality t(e, ord)) l
  left join orden_modulos m on m.id = l.id and m.activo
        and exists (select 1 from orden_sectores s where s.id = m.sector_id and s.local_id = p_local and s.tipo = 'salon')
  left join orden_sectores sec on sec.id = m.sector_id
  left join orden_personas per on per.id = sec.responsable_id and per.activo
  left join lateral (
    select f.tomada_en, f.ia_resultado r
      from orden_fotos f join orden_controles c on c.id = f.control_id
     where c.modulo_id = m.id and f.ia_estado = 'ok' and f.ia_resultado is not null
       and coalesce(f.ia_resultado ->> 'foto_valida', 'true') <> 'false'
     order by f.tomada_en desc limit 1) uf on true;

  if exists (select 1 from jsonb_array_elements(v_mods) x where not (x ->> 'ok')::boolean) then
    raise exception 'Hay módulos que no son del salón de este local: volvé a abrir el croquis';
  end if;
  if (select count(distinct x ->> 'ref') from jsonb_array_elements(v_mods) x) <> v_n then
    raise exception 'Hay dos módulos con el mismo número en el croquis';
  end if;
  select jsonb_agg(x - 'ok') into v_mods from jsonb_array_elements(v_mods) x;

  -- Lo que el supervisor descartó (lo de este local primero, y lo que tiene un por qué): para que no lo repita
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_lecciones from (
    select jsonb_build_object('modulo', p ->> 'ref', 'propuso', p ->> 'propone', 'motivo', nullif(p ->> 'motivo', ''),
                              'local', case when s.local_id = p_local then 'este' else lo.nombre end) x
      from orden_vm_sugerencias s join orden_locales lo on lo.id = s.local_id
      cross join lateral jsonb_array_elements(s.propuestas) p
     where p ->> 'estado' = 'descartada' and s.creada_en > now() - interval '60 days'
     order by (s.local_id = p_local) desc, (coalesce(p ->> 'motivo', '') <> '') desc, p ->> 'descartada_en' desc
     limit 15) y;

  -- Lo que ya se mandó hace poco en este local: no pedirlo de nuevo si no cambió nada
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_recientes from (
    select jsonb_build_object('modulo', p ->> 'ref', 'pedido', coalesce(p ->> 'texto', p ->> 'propone'),
                              'fecha', to_char((p ->> 'mandada_en')::timestamptz at time zone v_tz, 'DD/MM')) x
      from orden_vm_sugerencias s cross join lateral jsonb_array_elements(s.propuestas) p
     where s.local_id = p_local and p ->> 'estado' = 'mandada'
       and (p ->> 'mandada_en')::timestamptz > now() - interval '21 days'
     order by p ->> 'mandada_en' desc
     limit 12) y;

  insert into orden_vm_sugerencias (local_id, creada_por, creada_nombre, reglas_id, coleccion, momento, modulos)
  values (p_local, v_yo, (select nombre from orden_personas where id = v_yo), r.id, v_col, r.momento, v_mods)
  returning id into v_id;

  return jsonb_build_object(
    'sugerencia_id', v_id,
    'local', v_local.nombre,
    'fecha', to_char(v_hoy, 'DD/MM/YYYY'),
    'estacion', v_estacion,
    'coleccion', v_col,
    'temporada', orden_vm_temporada(v_col),
    'momento', r.momento,
    'fecha_clave', r.fecha_clave,
    'reglas', r.texto,
    'colecciones', orden_vm_colecciones(v_col),
    'modulos', v_mods,
    'lecciones', v_lecciones,
    'recientes', v_recientes);
end $$;

-- Lo que contestó la IA (sólo la Edge Function): cada propuesta, con el id de su módulo y "pendiente".
create or replace function orden_vm_resultado(p_sugerencia uuid, p_resultado jsonb, p_modelo text default null, p_error text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s orden_vm_sugerencias; e jsonb; mo jsonb; v_props jsonb := '[]'::jsonb;
begin
  if not orden_es_servicio() then raise exception 'Esto lo hace sólo el sistema'; end if;
  select * into s from orden_vm_sugerencias where id = p_sugerencia for update;
  if not found then raise exception 'No encontramos esa sugerencia'; end if;
  if s.estado <> 'pensando' then return jsonb_build_object('estado', s.estado, 'tarde', true); end if;

  if p_error is not null or p_resultado is null then
    update orden_vm_sugerencias
       set estado = 'error', error = left(coalesce(p_error, 'La IA no contestó'), 500), modelo = p_modelo, terminada_en = now()
     where id = s.id;
    return jsonb_build_object('estado', 'error');
  end if;

  for e in select x from jsonb_array_elements(coalesce(p_resultado -> 'propuestas', '[]'::jsonb)) x loop
    select x into mo from jsonb_array_elements(s.modulos) x where x ->> 'ref' = e ->> 'modulo' limit 1;
    continue when mo is null or v_props @> jsonb_build_array(jsonb_build_object('ref', mo ->> 'ref'));
    v_props := v_props || jsonb_build_array(jsonb_build_object(
      'ref', mo ->> 'ref',
      'modulo_id', mo ->> 'id',
      'nombre', mo ->> 'nombre',
      'zona', mo ->> 'zona',
      'hoy', left(nullif(trim(e ->> 'hoy'), ''), 300),
      'propone', left(coalesce(nullif(trim(e ->> 'propone'), ''), '—'), 400),
      'mover', left(nullif(trim(e ->> 'mover'), ''), 300),
      'porque', left(nullif(trim(e ->> 'porque'), ''), 400),
      'prioridad', case when e ->> 'prioridad' in ('alta', 'media', 'baja') then e ->> 'prioridad' else 'media' end,
      'estado', 'pendiente'));
  end loop;

  update orden_vm_sugerencias
     set estado = 'lista', resumen = left(nullif(trim(p_resultado ->> 'resumen'), ''), 1200),
         falta = left(nullif(trim(p_resultado ->> 'falta'), ''), 800),
         propuestas = v_props, modelo = p_modelo, terminada_en = now()
   where id = s.id;
  return jsonb_build_object('estado', 'lista', 'propuestas', jsonb_array_length(v_props));
end $$;

-- 6. La última sugerencia del local, con el responsable de hoy de cada módulo
create or replace function orden_vm_ultima(p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s orden_vm_sugerencias; v_props jsonb; v_cortada boolean;
begin
  if p_local is null or not orden_ve_equipo(p_local) then raise exception 'No podés ver las sugerencias de ese local'; end if;
  select * into s from orden_vm_sugerencias where local_id = p_local order by creada_en desc limit 1;
  if not found then return null; end if;
  v_cortada := s.estado = 'pensando' and s.creada_en < now() - interval '4 minutes';

  select coalesce(jsonb_agg(p || jsonb_build_object(
           'indice', t.i - 1,
           'responsable_id', per.id,
           'responsable', per.nombre,
           'modulo_activo', coalesce(m.activo, false)) order by t.i), '[]'::jsonb)
    into v_props
  from jsonb_array_elements(s.propuestas) with ordinality t(p, i)
  left join orden_modulos m on m.id = (t.p ->> 'modulo_id')::uuid
  left join orden_sectores sec on sec.id = m.sector_id
  left join orden_personas per on per.id = sec.responsable_id and per.activo;

  return jsonb_build_object(
    'id', s.id,
    'estado', case when v_cortada then 'error' else s.estado end,
    'error', case when v_cortada then 'Se cortó mientras pensaba' else s.error end,
    'creada_en', s.creada_en,
    'terminada_en', s.terminada_en,
    'creada_nombre', s.creada_nombre,
    'coleccion', s.coleccion,
    'momento', s.momento,
    'resumen', s.resumen,
    'falta', s.falta,
    'propuestas', v_props,
    'puede_mandar', orden_es_supervisor_de(p_local));
end $$;

-- 7. Mandar una propuesta al responsable del módulo: una tarea con foto, que controla el supervisor (no la IA).
create or replace function orden_vm_mandar(p_sugerencia uuid, p_indice int, p_texto text, p_plazo orden_plazo default 'semana')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s orden_vm_sugerencias; p jsonb; m orden_modulos; v_resp uuid; v_tarea uuid; v_yo uuid := orden_yo_id();
  v_texto text := regexp_replace(trim(coalesce(p_texto, '')), '\s+', ' ', 'g'); v_titulo text; v_detalle text;
begin
  select * into s from orden_vm_sugerencias where id = p_sugerencia for update;
  if not found then raise exception 'No encontramos esa sugerencia'; end if;
  if not orden_es_supervisor_de(s.local_id) then
    raise exception 'Las sugerencias las manda el supervisor del local o Administración';
  end if;
  if s.estado <> 'lista' then raise exception 'Esa sugerencia todavía no está lista'; end if;
  if p_indice is null or p_indice < 0 or p_indice >= jsonb_array_length(s.propuestas) then
    raise exception 'No encontramos esa propuesta';
  end if;
  p := s.propuestas -> p_indice;
  if p ->> 'estado' = 'mandada' then   -- un reintento después de un corte: no se duplica
    return p || jsonb_build_object('indice', p_indice, 'ya_estaba', true);
  end if;
  if p ->> 'estado' = 'descartada' then raise exception 'Esa propuesta está descartada: deshacelo para mandarla'; end if;
  if char_length(v_texto) < 3 then raise exception 'Escribí qué tiene que hacer'; end if;
  if char_length(v_texto) > 1000 then raise exception 'Es muy largo: como mucho 1.000 letras'; end if;

  select * into m from orden_modulos where id = (p ->> 'modulo_id')::uuid;
  if not found or not m.activo then raise exception 'Ese módulo ya no está en el salón'; end if;
  select per.id into v_resp from orden_sectores sec join orden_personas per on per.id = sec.responsable_id and per.activo
   where sec.id = m.sector_id;
  if v_resp is null then
    raise exception '% no tiene responsable: asignáselo en Por local', coalesce(p ->> 'nombre', 'Ese módulo');
  end if;

  v_titulo := case when char_length(v_texto) > 140 then left(v_texto, 139) || '…' else v_texto end;
  v_detalle := 'Visual merchandising, desde el croquis (' || coalesce(p ->> 'nombre', 'módulo ' || (p ->> 'ref')) || ')'
               || case when char_length(v_texto) > 140 then ': ' || v_texto else '' end;
  select t.id into v_tarea
    from orden_crear_tarea(array[v_resp], v_titulo, v_detalle, m.id, coalesce(p_plazo, 'semana'), true) as t(id);

  p := p || jsonb_build_object('estado', 'mandada', 'tarea_id', v_tarea, 'texto', v_texto, 'plazo', coalesce(p_plazo, 'semana'),
                               'mandada_a', v_resp, 'mandada_en', now(), 'mandada_por', v_yo,
                               'mandada_nombre', (select nombre from orden_personas where id = v_yo));
  update orden_vm_sugerencias set propuestas = jsonb_set(propuestas, array[p_indice::text], p) where id = s.id;
  return p || jsonb_build_object('indice', p_indice);
end $$;

-- Descartar una propuesta (con su por qué, que la IA lee la próxima vez), o deshacer el descarte.
create or replace function orden_vm_descartar(p_sugerencia uuid, p_indice int, p_motivo text default null, p_deshacer boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s orden_vm_sugerencias; p jsonb; v_yo uuid := orden_yo_id();
  v_motivo text := nullif(regexp_replace(trim(coalesce(p_motivo, '')), '\s+', ' ', 'g'), '');
begin
  select * into s from orden_vm_sugerencias where id = p_sugerencia for update;
  if not found then raise exception 'No encontramos esa sugerencia'; end if;
  if not orden_es_supervisor_de(s.local_id) then
    raise exception 'Las sugerencias las maneja el supervisor del local o Administración';
  end if;
  if p_indice is null or p_indice < 0 or p_indice >= jsonb_array_length(s.propuestas) then
    raise exception 'No encontramos esa propuesta';
  end if;
  p := s.propuestas -> p_indice;
  if p ->> 'estado' = 'mandada' then
    raise exception 'Ésa ya se mandó como tarea: si no va más, cancelala en Tareas abiertas';
  end if;
  if char_length(v_motivo) > 300 then raise exception 'El por qué, más corto: como mucho 300 letras'; end if;
  if coalesce(p_deshacer, false) then
    p := (p - 'motivo' - 'descartada_en' - 'descartada_por' - 'descartada_nombre') || jsonb_build_object('estado', 'pendiente');
  else
    p := p || jsonb_build_object('estado', 'descartada', 'motivo', v_motivo, 'descartada_en', now(), 'descartada_por', v_yo,
                                 'descartada_nombre', (select nombre from orden_personas where id = v_yo));
  end if;
  update orden_vm_sugerencias set propuestas = jsonb_set(propuestas, array[p_indice::text], p) where id = s.id;
  return p || jsonb_build_object('indice', p_indice);
end $$;

-- 8. Permisos: las tablas, sólo por las funciones; lo de la IA y la colección, sólo el sistema.
do $$
begin
  revoke all on table orden_vm_reglas, orden_vm_sugerencias from anon, authenticated;
  grant all on table orden_vm_reglas, orden_vm_sugerencias to service_role;

  revoke all on function orden_vm_temporada(int) from public, anon;
  grant execute on function orden_vm_temporada(int) to authenticated, service_role;
  revoke all on function orden_vm_coleccion_auto() from public, anon, authenticated;
  grant execute on function orden_vm_coleccion_auto() to service_role;
  revoke all on function orden_vm_colecciones(int) from public, anon, authenticated;
  grant execute on function orden_vm_colecciones(int) to service_role;
  revoke all on function orden_vm_resultado(uuid, jsonb, text, text) from public, anon, authenticated;
  grant execute on function orden_vm_resultado(uuid, jsonb, text, text) to service_role;

  revoke all on function orden_vm_puede() from public, anon;
  grant execute on function orden_vm_puede() to authenticated, service_role;
  revoke all on function orden_vm_reglas_leer() from public, anon;
  grant execute on function orden_vm_reglas_leer() to authenticated, service_role;
  revoke all on function orden_vm_reglas_guardar(text, int, text, text) from public, anon;
  grant execute on function orden_vm_reglas_guardar(text, int, text, text) to authenticated, service_role;
  revoke all on function orden_vm_preparar(uuid, jsonb) from public, anon;
  grant execute on function orden_vm_preparar(uuid, jsonb) to authenticated, service_role;
  revoke all on function orden_vm_ultima(uuid) from public, anon;
  grant execute on function orden_vm_ultima(uuid) to authenticated, service_role;
  revoke all on function orden_vm_mandar(uuid, int, text, orden_plazo) from public, anon;
  grant execute on function orden_vm_mandar(uuid, int, text, orden_plazo) to authenticated, service_role;
  revoke all on function orden_vm_descartar(uuid, int, text, boolean) from public, anon;
  grant execute on function orden_vm_descartar(uuid, int, text, boolean) to authenticated, service_role;
end $$;
