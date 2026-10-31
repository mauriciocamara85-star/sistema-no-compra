-- =====================================================================
-- Módulo VDH · Migración 61 (SQL 209), 31/10/2026: los PAPELES de cada
-- persona — las ausencias (con o sin certificado médico) y los
-- apercibimientos.
--
-- Pedido de Mauricio (31/10): "cuando uno falta y tenemos que poner ahí el
-- certificado… una estadística de cuánto falta cada vendedor… si alguien
-- falta, se podría agregar aunque no entreguen el certificado… ver si se
-- descuenta o no esa plata". El certificado y el apercibimiento se cargan
-- desde la app (Equipo VDH → Papeles), escaneados con la cámara; el
-- vendedor manda su propio certificado desde su celular. El descuento lo
-- deciden la administración y el supervisor.
--
-- OJO con los nombres: orden_ausencias YA EXISTE y son las vacaciones y
-- licencias (SQL 181); orden_faltas son las faltas del orden (advertencia,
-- apercibimiento, suspensión: las sugiere el sistema). Esto es otra cosa:
-- orden_legajo, un renglón por papel.
--
-- 1. orden_legajo (nueva): tipo 'ausencia' (del desde al hasta, con sus
--    fotos = el certificado, y "¿se descuenta?") o 'apercibimiento' (la
--    fecha, el motivo, las fotos del papel firmado y el descargo).
--    La ve la persona (lo suyo) y quien ve el equipo del local
--    (supervisor de ese local, administración, gerencia). Se escribe sólo
--    con las funciones. Borrar = queda marcado y no se ve más.
-- 2. El lugar de las fotos: el bucket privado "legajos", aparte de
--    orden-fotos (ahí cualquiera del local ve las fotos del local, y la
--    limpieza de fotos viejas no tiene que tocar un certificado).
--    Carpeta {local}/{persona}/archivo.jpg. Sube quien supervisa el
--    local, y la persona a la suya. Las ve quien ve el equipo del local, y
--    la persona las suyas.
-- 3. Funciones: orden_legajo_cargar (el supervisor, cualquiera de los
--    dos; el vendedor, SU ausencia con el certificado, sin esperar a que
--    se la anoten), orden_legajo_fotos (sumar hojas; el vendedor, a su
--    ausencia), orden_legajo_descuento, orden_legajo_borrar y
--    orden_legajo_descargo (el vendedor, a su apercibimiento).
-- 4. Avisos: a la persona cuando le cargan algo; a los supervisores del
--    local (o la administración) cuando el vendedor manda su certificado.
--
-- No cambia nada de lo que ya existe. Reversible: deshacer-209.sql (se
-- niega si ya hay papeles cargados de verdad).
-- =====================================================================

/* Si en 5 segundos no consigue la tabla de la gente o la de las fotos (alguien las está usando), falla entero y no
   cambia nada, en vez de quedarse esperando con la app frenada atrás. */
select set_config('lock_timeout', '5s', true);

create table orden_legajo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ausencia', 'apercibimiento')),
  persona_id uuid not null references orden_personas(id),
  local_id uuid references orden_locales(id),      -- el local de la persona cuando se cargó
  desde date not null,
  hasta date not null,                              -- en el apercibimiento, igual a desde
  motivo text,
  fotos text[] not null default '{}',               -- rutas en el bucket legajos (las hojas, en orden)
  fotos_en timestamptz,                             -- cuándo llegó la última hoja
  fotos_de uuid references orden_personas(id),      -- quién subió la última hoja
  descuento text check (descuento in ('a_definir', 'si', 'no')),   -- sólo las ausencias
  descuento_por uuid references orden_personas(id),
  descuento_en timestamptz,
  descargo text,                                    -- sólo los apercibimientos
  descargo_en timestamptz,
  cargado_por uuid references orden_personas(id),
  creado_en timestamptz not null default now(),
  borrado_en timestamptz,
  borrado_por uuid references orden_personas(id),
  check (hasta >= desde),
  check ((tipo = 'ausencia') = (descuento is not null))
);
create index orden_legajo_local on orden_legajo (local_id, desde);
create index orden_legajo_persona on orden_legajo (persona_id, desde);

alter table orden_legajo enable row level security;
create policy "ver" on orden_legajo for select to authenticated
  using (borrado_en is null and (persona_id = orden_yo_id() or orden_ve_equipo(local_id)));
revoke all on orden_legajo from anon, authenticated;
grant select on orden_legajo to authenticated;

/* ── Las fotos ─────────────────────────────────────────────────────── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legajos', 'legajos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;   -- un deshacer con fotos adentro lo deja

/** ¿Quien pregunta puede ver (p_subir false) o subir (true) en esta ruta del bucket legajos? {local}/{persona}/archivo. */
create or replace function orden_legajo_carpeta(p_ruta text, p_subir boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  u constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  v_local uuid; v_persona uuid; yo orden_personas;
begin
  if p_ruta is null or p_ruta !~ ('^' || u || '/' || u || '/[^/]+$') then return false; end if;
  v_local := split_part(p_ruta, '/', 1)::uuid;
  v_persona := split_part(p_ruta, '/', 2)::uuid;
  select * into yo from orden_personas where auth_user_id = auth.uid() and activo and aprobado limit 1;
  if not found then return false; end if;
  /* La persona, lo suyo: subir sólo a la carpeta de su local de hoy. */
  if yo.id = v_persona and (not p_subir or yo.local_id = v_local) then return true; end if;
  if p_subir then return orden_es_supervisor_de(v_local); end if;
  return orden_ve_equipo(v_local);
end $$;
revoke all on function orden_legajo_carpeta(text, boolean) from public, anon;
grant execute on function orden_legajo_carpeta(text, boolean) to authenticated;

create policy "legajos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'legajos' and orden_legajo_carpeta(name, true));
create policy "legajos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'legajos' and orden_legajo_carpeta(name, false));

/* ── Las funciones ─────────────────────────────────────────────────── */

/** Las rutas que llegan, limpias: de esa persona, sin repetir, hasta 8. Si alguna no sirve, frena. */
create or replace function orden_legajo_rutas_(p_persona uuid, p_fotos text[])
returns text[] language plpgsql immutable as $$
declare
  u constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  r text; v text[] := '{}';
begin
  foreach r in array coalesce(p_fotos, '{}') loop
    if r is null or r !~ ('^' || u || '/' || p_persona::text || '/[0-9A-Za-z._-]{1,80}$') then
      raise exception 'Una de las fotos no es de esta persona. Sacala de nuevo.';
    end if;
    if not r = any(v) then v := v || r; end if;
  end loop;
  if cardinality(v) > 8 then raise exception 'Son muchas hojas: como mucho 8.'; end if;
  return v;
end $$;
revoke all on function orden_legajo_rutas_(uuid, text[]) from public, anon, authenticated;

/** "30/10" o "del 30/10 al 1/11". */
create or replace function orden_legajo_dias_(p_desde date, p_hasta date)
returns text language sql immutable as $$
  select case when p_desde = p_hasta then 'del ' || to_char(p_desde, 'FMDD/FMMM')
              else 'del ' || to_char(p_desde, 'FMDD/FMMM') || ' al ' || to_char(p_hasta, 'FMDD/FMMM') end
$$;
revoke all on function orden_legajo_dias_(date, date) from public, anon, authenticated;

/** El aviso a quienes supervisan el local de un papel (sin la persona misma, si es la encargada); si nadie de ellos
    entró nunca a la app, a la administración. Como orden_avisar_responsables. */
create or replace function orden_legajo_avisar_sup_(v orden_legajo, p_titulo text, p_cuerpo text, p_clave text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0; v_hay boolean;
begin
  select exists (select 1 from orden_personas where id in (select orden_supervisores_de(v.local_id))
                   and id <> v.persona_id and aprobado and auth_user_id is not null) into v_hay;
  for r in
    select id from orden_personas
     where activo and id <> v.persona_id
       and (id in (select orden_supervisores_de(v.local_id)) or (rol = 'admin' and not v_hay))
  loop
    if orden_encolar_aviso(r.id, 'legajo', p_titulo, p_cuerpo, '/ausencias', p_clave || ':' || r.id, 2::smallint) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function orden_legajo_avisar_sup_(orden_legajo, text, text, text) from public, anon, authenticated;

/**
 * Carga una ausencia o un apercibimiento de alguien del local. Lo hace quien supervisa el local (el encargado, el
 * supervisor de zona, la administración); la gerencia mira. Con fotos, la ausencia arranca en "no se descuenta"
 * (trajo el certificado); sin fotos, "a definir".
 * La persona misma puede anotar SU ausencia mandando el certificado (enfermo en su casa, sin esperar al supervisor):
 * queda "a definir" y les llega el aviso a sus supervisores.
 */
create or replace function orden_legajo_cargar(p_tipo text, p_persona uuid, p_desde date, p_hasta date default null,
                                               p_motivo text default null, p_fotos text[] default '{}')
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare
  p orden_personas; yo uuid := orden_yo_id(); v orden_legajo; v_otra orden_legajo; v_propia boolean;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_motivo text := nullif(left(btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), 300), '');
  v_fotos text[]; v_hasta date := coalesce(p_hasta, p_desde);
begin
  if p_tipo not in ('ausencia', 'apercibimiento') then raise exception 'Elegí si es una ausencia o un apercibimiento.'; end if;
  select * into p from orden_personas where id = p_persona;
  if not found or not p.activo then raise exception 'No encontramos a esa persona.'; end if;
  v_propia := yo is not null and p.id = yo;
  if v_propia then
    if p_tipo <> 'ausencia' or p.local_id is null then raise exception 'Lo tuyo te lo carga tu supervisor o la administración.'; end if;
    if cardinality(coalesce(p_fotos, '{}')) = 0 then raise exception 'Falta la foto del certificado.'; end if;
  elsif p.local_id is null or not orden_es_supervisor_de(p.local_id) or yo is null then
    raise exception 'No podés cargarle papeles a esta persona: lo hacen su encargado, su supervisor o la administración.';
  end if;
  if p_desde is null then raise exception 'Poné la fecha.'; end if;
  if p_tipo = 'apercibimiento' then v_hasta := p_desde; end if;
  if v_hasta < p_desde then raise exception 'El "hasta" no puede ser antes del "desde".'; end if;
  if p_desde < v_hoy - 120 then raise exception 'Es de hace más de 4 meses: revisá la fecha.'; end if;
  if p_tipo = 'apercibimiento' and p_desde > v_hoy then raise exception 'El apercibimiento no puede tener una fecha que todavía no llegó.'; end if;
  if p_tipo = 'ausencia' and p_desde > v_hoy + 7 then raise exception 'Se anota cuando falta (o, con el certificado, hasta una semana antes).'; end if;
  if v_hasta - p_desde > 60 then raise exception 'Son más de 60 días: revisá las fechas (unas vacaciones van en Config → Usuarios).'; end if;
  if p_tipo = 'apercibimiento' and coalesce(length(v_motivo), 0) < 5 then raise exception 'Escribí el motivo del apercibimiento.'; end if;
  v_fotos := orden_legajo_rutas_(p.id, p_fotos);

  if p_tipo = 'ausencia' then
    select * into v_otra from orden_legajo
     where persona_id = p.id and tipo = 'ausencia' and borrado_en is null and desde <= v_hasta and hasta >= p_desde
     order by desde limit 1;
    if found then
      if v_propia then
        raise exception 'Ya tenés una ausencia anotada %: mandá el certificado ahí.', orden_legajo_dias_(v_otra.desde, v_otra.hasta);
      end if;
      raise exception 'Ya tiene una ausencia anotada %. Si falta un certificado, sumalo ahí.', orden_legajo_dias_(v_otra.desde, v_otra.hasta);
    end if;
  end if;

  insert into orden_legajo (tipo, persona_id, local_id, desde, hasta, motivo, fotos, fotos_en, fotos_de, descuento, cargado_por)
  values (p_tipo, p.id, p.local_id, p_desde, v_hasta, v_motivo, v_fotos,
          case when cardinality(v_fotos) > 0 then now() end, case when cardinality(v_fotos) > 0 then yo end,
          case when p_tipo = 'ausencia' then case when cardinality(v_fotos) > 0 and not v_propia then 'no' else 'a_definir' end end, yo)
  returning * into v;

  if v_propia then
    perform orden_legajo_avisar_sup_(v, p.nombre || coalesce(' ' || p.inicial || '.', '') || ' mandó un certificado médico',
      'Ausencia ' || orden_legajo_dias_(v.desde, v.hasta) || '. Mirá la foto y decidí si se descuenta.', 'legajo-cert:' || v.id || ':1');
  elsif p_tipo = 'ausencia' then
    perform orden_encolar_aviso(p.id, 'legajo', 'Se anotó tu ausencia ' || orden_legajo_dias_(v.desde, v.hasta),
      case when cardinality(v_fotos) > 0 then 'Con el certificado médico.'
           else 'Si tenés certificado médico, mandá la foto desde la app: tocá este aviso.' end,
      case when cardinality(v_fotos) > 0 then '/certificados' else '/certificado/' || v.id end,
      'legajo:' || v.id, 2::smallint);
  else
    perform orden_encolar_aviso(p.id, 'legajo', 'Se registró un apercibimiento', v_motivo, '/apercibimientos', 'legajo:' || v.id, 2::smallint);
  end if;
  return v;
end $$;
revoke all on function orden_legajo_cargar(text, uuid, date, date, text, text[]) from public, anon;
grant execute on function orden_legajo_cargar(text, uuid, date, date, text, text[]) to authenticated;

/**
 * Suma hojas (fotos) a un papel: el supervisor del local, a cualquiera; la persona, el certificado de su ausencia.
 * Cuando el que manda el certificado es la persona, les llega el aviso a sus supervisores (o a la administración).
 */
create or replace function orden_legajo_fotos(p_id uuid, p_fotos text[])
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; yo uuid := orden_yo_id(); v_nuevas text[]; v_todas text[]; p orden_personas; v_propia boolean;
begin
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Ese papel ya no está.'; end if;
  v_propia := yo is not null and v.persona_id = yo;
  if not (v_propia and v.tipo = 'ausencia') and not (v.local_id is not null and orden_es_supervisor_de(v.local_id) and yo is not null) then
    raise exception 'No podés sumarle fotos a este papel.';
  end if;
  v_nuevas := orden_legajo_rutas_(v.persona_id, p_fotos);
  if cardinality(v_nuevas) = 0 then raise exception 'Falta la foto.'; end if;
  v_todas := v.fotos;
  for i in 1 .. cardinality(v_nuevas) loop
    if not v_nuevas[i] = any(v_todas) then v_todas := v_todas || v_nuevas[i]; end if;
  end loop;
  if cardinality(v_todas) > 8 then raise exception 'Son muchas hojas: como mucho 8.'; end if;
  update orden_legajo set fotos = v_todas, fotos_en = now(), fotos_de = yo where id = v.id returning * into v;

  if v_propia then
    select * into p from orden_personas where id = v.persona_id;
    perform orden_legajo_avisar_sup_(v, p.nombre || coalesce(' ' || p.inicial || '.', '') || ' mandó su certificado',
      'Ausencia ' || orden_legajo_dias_(v.desde, v.hasta) || '. Mirá la foto y decidí si se descuenta.',
      'legajo-cert:' || v.id || ':' || cardinality(v_todas));
  end if;
  return v;
end $$;
revoke all on function orden_legajo_fotos(uuid, text[]) from public, anon;
grant execute on function orden_legajo_fotos(uuid, text[]) to authenticated;

/** ¿La ausencia se descuenta del sueldo? 'si', 'no' o 'a_definir'. La administración y el supervisor del local. */
create or replace function orden_legajo_descuento(p_id uuid, p_descuento text)
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; yo uuid := orden_yo_id();
begin
  if p_descuento not in ('si', 'no', 'a_definir') then raise exception 'Elegí Sí, No o A definir.'; end if;
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Esa ausencia ya no está.'; end if;
  if v.tipo <> 'ausencia' then raise exception 'Sólo las ausencias se descuentan.'; end if;
  if yo is null or not orden_es_supervisor_de(v.local_id) then raise exception 'Lo deciden la administración y el supervisor del local.'; end if;
  if v.persona_id = yo then raise exception 'Lo tuyo lo decide tu supervisor o la administración.'; end if;
  update orden_legajo set descuento = p_descuento, descuento_por = yo, descuento_en = now() where id = v.id returning * into v;
  return v;
end $$;
revoke all on function orden_legajo_descuento(uuid, text) from public, anon;
grant execute on function orden_legajo_descuento(uuid, text) to authenticated;

/** Saca un papel cargado por error: queda guardado y marcado, y no se ve más (ni cuenta). */
create or replace function orden_legajo_borrar(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; yo uuid := orden_yo_id();
begin
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Ese papel ya no está.'; end if;
  if yo is null or not orden_es_supervisor_de(v.local_id) or v.persona_id = yo then raise exception 'No podés borrar este papel.'; end if;
  update orden_legajo set borrado_en = now(), borrado_por = yo where id = v.id;
end $$;
revoke all on function orden_legajo_borrar(uuid) from public, anon;
grant execute on function orden_legajo_borrar(uuid) to authenticated;

/** El descargo de la persona a su apercibimiento (lo lee su supervisor). Se puede reescribir. */
create or replace function orden_legajo_descargo(p_id uuid, p_texto text)
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; t text := nullif(left(btrim(coalesce(p_texto, '')), 1000), '');
begin
  if t is null then raise exception 'Escribí tu descargo.'; end if;
  update orden_legajo set descargo = t, descargo_en = now()
   where id = p_id and borrado_en is null and tipo = 'apercibimiento' and persona_id = orden_yo_id()
  returning * into v;
  if not found then raise exception 'No encontramos ese apercibimiento.'; end if;
  return v;
end $$;
revoke all on function orden_legajo_descargo(uuid, text) from public, anon;
grant execute on function orden_legajo_descargo(uuid, text) to authenticated;
