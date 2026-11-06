-- =====================================================================
-- Módulo VDH · Migración 81 (SQL 253), 6/11/2026: la DOTACIÓN de los
-- locales, adentro del sistema (Supervisión → Dotación).
--
-- Pedido de Mauricio (6/11): la planilla de Google «Dotación Locales»
-- adentro del sistema, "con todas las pestañas que tiene la planilla…
-- que esté todo dentro del sistema y que no haya más planillas por ahí
-- dando vueltas"; "que quede lo más parecido a la planilla, por ahora,
-- después le vamos haciendo modificaciones".
--
-- Por eso esto es una planilla, no un modelo de personal:
-- 1. dotacion_hojas: cada pestaña (01 Local-Empleado, 02 Cajas Navideñas,
--    las zonas, Apercibimientos y Suspensiones, Rotaciones), con sus
--    columnas (nombre, ancho, tipo: texto, casilla, lista con sus
--    opciones y colores, plata) y los títulos de sus bloques.
-- 2. dotacion_filas: cada renglón, con sus celdas por letra de columna
--    ({"b":"A","c":"Flores",…}), igual que en la planilla. parte dice si
--    es de la tabla, de la lista de «Observaciones» (marca + texto) o del
--    pie («Responsables»). Borrar = queda marcado y no se ve más.
-- 3. dotacion_cambios: cada cambio (quién, cuándo, qué decía antes y qué
--    dice ahora). Sin pantalla por ahora; sirve para volver atrás algo.
--
-- Hay sueldos, «A o X» y apercibimientos: la ve y la cambia SÓLO la
-- administración (orden_es_admin). Las tablas no se leen directo: todo
-- pasa por las funciones, que lo controlan.
--
-- Los DATOS de la planilla NO están en este archivo (el repo es público):
-- se cargan aparte, con el correr-en-supabase-253.sql de App Orden.
--
-- No cambia nada de lo que ya existe. Reversible: deshacer-253.sql (se
-- niega si alguien ya cambió algo desde el sistema).
-- =====================================================================

select set_config('lock_timeout', '5s', true);

create table if not exists dotacion_hojas (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  nombre text not null,                             -- el nombre de la pestaña, como en la planilla
  orden int not null,
  titulo text,                                      -- «Personal Definitivo Fiestas»
  columnas jsonb not null default '[]'::jsonb check (jsonb_typeof(columnas) = 'array'),
  notas_titulo text,                                -- «Observaciones» (null: sin ese bloque)
  pie_titulo text,                                  -- «Responsables»
  cambiado_en timestamptz,
  cambiado_por uuid
);

create table if not exists dotacion_filas (
  id uuid primary key default gen_random_uuid(),
  hoja text not null references dotacion_hojas(id) on delete cascade,
  parte text not null default 'tabla' check (parte in ('tabla', 'notas', 'pie')),
  orden numeric not null,
  celdas jsonb not null default '{}'::jsonb check (jsonb_typeof(celdas) = 'object'),
  color text check (color in ('rojo')),             -- la fila pintada (en la 01, la de una baja)
  creado_en timestamptz not null default now(),
  creado_por uuid,
  cambiado_en timestamptz,
  cambiado_por uuid,
  borrado_en timestamptz,
  borrado_por uuid
);
create index if not exists dotacion_filas_hoja on dotacion_filas (hoja, parte, orden) where borrado_en is null;

create table if not exists dotacion_cambios (
  id bigint generated always as identity primary key,
  fila uuid not null references dotacion_filas(id) on delete cascade,
  que text not null,                                -- la letra de la columna, 'nueva' o 'borrada'
  antes text,
  despues text,
  quien uuid,
  cuando timestamptz not null default now()
);
create index if not exists dotacion_cambios_fila on dotacion_cambios (fila, cuando);

alter table dotacion_hojas enable row level security;
alter table dotacion_filas enable row level security;
alter table dotacion_cambios enable row level security;
/* Sin políticas: nadie las lee ni las escribe directo. Las funciones (security definer) controlan quién. */
revoke all on dotacion_hojas, dotacion_filas, dotacion_cambios from anon, authenticated;
/* En esta base el rol de servicio no hereda permisos (SQL 220): se le dan acá. */
grant all on dotacion_hojas, dotacion_filas, dotacion_cambios to service_role;

/** Sólo la administración. */
create or replace function dotacion_control_()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not orden_es_admin() then
    raise exception 'La Dotación es sólo para la administración.' using errcode = '42501';
  end if;
  return orden_yo_id();
end $$;
revoke all on function dotacion_control_() from public, anon, authenticated;

/** Una fila como la ve la pantalla. */
create or replace function dotacion_fila_json_(f dotacion_filas)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', f.id, 'parte', f.parte, 'orden', f.orden, 'celdas', f.celdas, 'color', f.color)
$$;
revoke all on function dotacion_fila_json_(dotacion_filas) from public, anon, authenticated;

/** Todas las pestañas con sus filas (las borradas no). */
create or replace function dotacion_leer()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform dotacion_control_();
  return jsonb_build_object('hojas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', h.id, 'nombre', h.nombre, 'titulo', h.titulo, 'columnas', h.columnas,
             'notas_titulo', h.notas_titulo, 'pie_titulo', h.pie_titulo, 'cambiado_en', h.cambiado_en,
             'filas', coalesce((select jsonb_agg(dotacion_fila_json_(f) order by f.parte, f.orden)
                                  from dotacion_filas f where f.hoja = h.id and f.borrado_en is null), '[]'::jsonb))
           order by h.orden)
      from dotacion_hojas h), '[]'::jsonb));
end $$;
revoke all on function dotacion_leer() from public, anon;
grant execute on function dotacion_leer() to authenticated;

/** Cambiar una celda. p_antes es lo que la pantalla tenía: si alguien la cambió mientras tanto, no se pisa. '' = vacía. */
create or replace function dotacion_celda(p_fila uuid, p_col text, p_valor text, p_antes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := dotacion_control_();
  f dotacion_filas;
  v_hoja dotacion_hojas;
  v_valor text := coalesce(p_valor, '');
  v_ya text;
begin
  select * into f from dotacion_filas where id = p_fila and borrado_en is null for update;
  if not found then raise exception 'Esa fila ya no está (alguien la borró). Actualizá la pantalla.'; end if;
  select * into v_hoja from dotacion_hojas where id = f.hoja;
  if p_col is null or not (
       (f.parte = 'tabla' and exists (select 1 from jsonb_array_elements(v_hoja.columnas) c where c->>'k' = p_col))
    or (f.parte = 'notas' and p_col in ('marca', 'texto'))
    or (f.parte = 'pie' and p_col = 'texto')) then
    raise exception 'Esa columna no es de esta pestaña.';
  end if;
  if length(v_valor) > 2000 then raise exception 'Es muy largo: como mucho 2000 letras.'; end if;
  v_ya := coalesce(f.celdas->>p_col, '');
  if v_ya <> coalesce(p_antes, '') then
    raise exception 'Alguien la cambió recién: ahora dice «%». Fijate y, si hace falta, cambiala de nuevo.', left(v_ya, 80)
      using errcode = 'P0409';
  end if;
  if v_ya = v_valor then return dotacion_fila_json_(f); end if;
  update dotacion_filas
     set celdas = case when v_valor = '' then celdas - p_col else jsonb_set(celdas, array[p_col], to_jsonb(v_valor)) end,
         cambiado_en = now(), cambiado_por = v_yo
   where id = p_fila
  returning * into f;
  insert into dotacion_cambios (fila, que, antes, despues, quien) values (p_fila, p_col, nullif(v_ya, ''), nullif(v_valor, ''), v_yo);
  update dotacion_hojas set cambiado_en = now(), cambiado_por = v_yo where id = f.hoja;
  return dotacion_fila_json_(f);
end $$;
revoke all on function dotacion_celda(uuid, text, text, text) from public, anon;
grant execute on function dotacion_celda(uuid, text, text, text) to authenticated;

/** Una fila nueva, abajo de p_despues (o al final de esa parte). Las casillas de la tabla arrancan sin tildar. */
create or replace function dotacion_fila_nueva(p_hoja text, p_parte text, p_despues uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := dotacion_control_();
  v_hoja dotacion_hojas;
  v_parte text := coalesce(p_parte, 'tabla');
  v_desde numeric;
  v_hasta numeric;
  v_celdas jsonb := '{}'::jsonb;
  f dotacion_filas;
begin
  select * into v_hoja from dotacion_hojas where id = p_hoja for update;
  if not found then raise exception 'Esa pestaña no existe.'; end if;
  if v_parte not in ('tabla', 'notas', 'pie') then raise exception 'Esa parte no existe.'; end if;
  if (select count(*) from dotacion_filas where hoja = p_hoja and borrado_en is null) >= 2000 then
    raise exception 'La pestaña ya tiene 2000 filas.';
  end if;
  if p_despues is not null then
    select orden into v_desde from dotacion_filas where id = p_despues and hoja = p_hoja and parte = v_parte and borrado_en is null;
    if not found then raise exception 'La fila de arriba ya no está. Actualizá la pantalla.'; end if;
    select min(orden) into v_hasta from dotacion_filas where hoja = p_hoja and parte = v_parte and orden > v_desde;
  else
    select max(orden) into v_desde from dotacion_filas where hoja = p_hoja and parte = v_parte;
  end if;
  v_desde := coalesce(v_desde, 0);
  if v_parte = 'tabla' then
    select coalesce(jsonb_object_agg(c->>'k', 'FALSE'), '{}'::jsonb) into v_celdas
      from jsonb_array_elements(v_hoja.columnas) c where c->>'t' = 'casilla';
  elsif v_parte = 'notas' then
    v_celdas := '{"marca": "FALSE"}'::jsonb;
  end if;
  insert into dotacion_filas (hoja, parte, orden, celdas, creado_por)
  values (p_hoja, v_parte, case when v_hasta is null then v_desde + 1 else (v_desde + v_hasta) / 2 end, v_celdas, v_yo)
  returning * into f;
  insert into dotacion_cambios (fila, que, quien) values (f.id, 'nueva', v_yo);
  update dotacion_hojas set cambiado_en = now(), cambiado_por = v_yo where id = p_hoja;
  return dotacion_fila_json_(f);
end $$;
revoke all on function dotacion_fila_nueva(text, text, uuid) from public, anon;
grant execute on function dotacion_fila_nueva(text, text, uuid) to authenticated;

/** Borrar una fila: queda guardada (con quién y cuándo) y no se ve más. */
create or replace function dotacion_fila_borrar(p_fila uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := dotacion_control_();
  f dotacion_filas;
begin
  update dotacion_filas set borrado_en = now(), borrado_por = v_yo
   where id = p_fila and borrado_en is null
  returning * into f;
  if not found then return; end if;   -- ya estaba borrada: lo mismo
  insert into dotacion_cambios (fila, que, antes, quien) values (p_fila, 'borrada', f.celdas::text, v_yo);
  update dotacion_hojas set cambiado_en = now(), cambiado_por = v_yo where id = f.hoja;
end $$;
revoke all on function dotacion_fila_borrar(uuid) from public, anon;
grant execute on function dotacion_fila_borrar(uuid) to authenticated;

/** El título de arriba de la pestaña («Personal Definitivo Fiestas»). Vacío = sin título. */
create or replace function dotacion_titulo(p_hoja text, p_titulo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := dotacion_control_();
begin
  if length(coalesce(p_titulo, '')) > 200 then raise exception 'Es muy largo: como mucho 200 letras.'; end if;
  update dotacion_hojas set titulo = nullif(trim(coalesce(p_titulo, '')), ''), cambiado_en = now(), cambiado_por = v_yo
   where id = p_hoja;
  if not found then raise exception 'Esa pestaña no existe.'; end if;
end $$;
revoke all on function dotacion_titulo(text, text) from public, anon;
grant execute on function dotacion_titulo(text, text) to authenticated;
