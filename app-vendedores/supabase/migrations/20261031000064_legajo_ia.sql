-- =====================================================================
-- Módulo VDH · Migración 64 (SQL 219), 31/10/2026: la IA lee el papel.
--
-- Pedido de Mauricio (31/10, mirando Supervisión → Papeles): "está bien
-- que se pueda anotar manualmente, pero si un vendedor sube su certificado
-- o su apercibimiento, que la IA lo lea y complete todo sola."
--
-- Cómo anda: al sacarle la foto a la hoja, la app se la manda a la función
-- leer-papel, que la lee con la IA (de quién es, las fechas, el médico, el
-- motivo) y completa el formulario; la persona revisa y manda. Lo que leyó
-- queda guardado con el papel, así el supervisor ve si alguien cambió las
-- fechas que decía el certificado.
--
-- 1. orden_legajo.ia_lectura (nueva columna): lo que leyó la IA, tal cual.
-- 2. orden_legajo_lecturas (nueva): cada lectura que hizo la función. La
--    escribe sólo la función (con la llave de servicio); nadie la lee
--    directo. Sirve para unir la lectura al papel sin que el teléfono pueda
--    inventarla, y de registro de lo que falló.
-- 3. orden_legajo_con_lectura(papel, lectura): pega la lectura al papel
--    (quien la pidió, la persona del papel o su supervisor). Si el papel no
--    tenía motivo, le pone el que leyó la IA.
-- 4. orden_legajo_fechas(papel, desde, hasta): el supervisor corrige las
--    fechas de una ausencia ("Usar las fechas del certificado"), con los
--    mismos controles que al anotarla.
--
-- No cambia ningún dato ni ninguna función que ya existe. Sin esto, la app
-- completa el formulario igual; sólo no queda guardado lo que leyó.
-- Reversible: deshacer-219.sql (se niega si ya hay lecturas pegadas a un
-- papel).
-- =====================================================================

/* Si en 5 segundos no consigue la tabla de los papeles (alguien la está usando), falla entero y no cambia nada. */
select set_config('lock_timeout', '5s', true);

/* Si ya se corrió, esto falla y no cambia nada. */
alter table orden_legajo add column ia_lectura jsonb;

create table orden_legajo_lecturas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ausencia', 'apercibimiento')),
  pedido_por uuid not null references orden_personas(id),
  persona_id uuid references orden_personas(id),     -- de quién dijo la IA que es el papel (si lo encontró)
  lectura jsonb,                                       -- lo que leyó (null si falló)
  error text,                                          -- por qué falló
  modelo text,
  legajo_id uuid references orden_legajo(id),          -- el papel al que se pegó
  creado_en timestamptz not null default now()
);
create index orden_legajo_lecturas_legajo on orden_legajo_lecturas (legajo_id);
alter table orden_legajo_lecturas enable row level security;
revoke all on orden_legajo_lecturas from anon, authenticated;

/**
 * Pega una lectura de la IA a un papel: la pide quien hizo leer la hoja (hasta un día después), y tiene que ser la
 * persona del papel o quien supervisa su local. Si el papel no tenía motivo, queda el que leyó la IA.
 */
create or replace function orden_legajo_con_lectura(p_id uuid, p_lectura uuid)
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; l orden_legajo_lecturas; yo uuid := orden_yo_id();
begin
  if yo is null then raise exception 'Entrá de nuevo a la app.'; end if;
  select * into l from orden_legajo_lecturas
   where id = p_lectura and pedido_por = yo and lectura is not null and error is null
     and (legajo_id is null or legajo_id = p_id) and creado_en > now() - interval '1 day'
   for update;
  if not found then raise exception 'Esa lectura ya no sirve: leé la hoja de nuevo.'; end if;
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Ese papel ya no está.'; end if;
  if v.tipo <> l.tipo then raise exception 'La lectura es de otro tipo de papel.'; end if;
  if not (v.persona_id = yo or (v.local_id is not null and orden_es_supervisor_de(v.local_id))) then
    raise exception 'No podés cambiar este papel.';
  end if;
  update orden_legajo
     set ia_lectura = l.lectura || jsonb_build_object('leido_en', l.creado_en, 'modelo', l.modelo),
         motivo = coalesce(motivo, nullif(left(btrim(regexp_replace(coalesce(l.lectura ->> 'motivo', ''), '\s+', ' ', 'g')), 300), ''))
   where id = v.id
  returning * into v;
  update orden_legajo_lecturas set legajo_id = v.id where id = l.id;
  return v;
end $$;
revoke all on function orden_legajo_con_lectura(uuid, uuid) from public, anon;
grant execute on function orden_legajo_con_lectura(uuid, uuid) to authenticated;

/**
 * Cambia las fechas de una ausencia (el certificado dice otros días que los que se anotaron). La administración y el
 * supervisor del local; los mismos controles que al anotarla, y que no se pise con otra ausencia de la misma persona.
 */
create or replace function orden_legajo_fechas(p_id uuid, p_desde date, p_hasta date)
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare
  v orden_legajo; v_otra orden_legajo; yo uuid := orden_yo_id();
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Esa ausencia ya no está.'; end if;
  if v.tipo <> 'ausencia' then raise exception 'Sólo se cambian las fechas de una ausencia.'; end if;
  if yo is null or v.local_id is null or not orden_es_supervisor_de(v.local_id) or v.persona_id = yo then
    raise exception 'Las fechas las cambian su supervisor o la administración.';
  end if;
  if p_desde is null or p_hasta is null then raise exception 'Poné las dos fechas.'; end if;
  if p_hasta < p_desde then raise exception 'El "hasta" no puede ser antes del "desde".'; end if;
  if p_desde < v_hoy - 120 then raise exception 'Es de hace más de 4 meses: revisá la fecha.'; end if;
  if p_desde > v_hoy + 7 then raise exception 'Se anota cuando falta (o, con el certificado, hasta una semana antes).'; end if;
  if p_hasta - p_desde > 60 then raise exception 'Son más de 60 días: revisá las fechas (unas vacaciones van en Config → Usuarios).'; end if;
  select * into v_otra from orden_legajo
   where persona_id = v.persona_id and tipo = 'ausencia' and borrado_en is null and id <> v.id
     and desde <= p_hasta and hasta >= p_desde
   order by desde limit 1;
  if found then
    raise exception 'Ya tiene otra ausencia anotada %: revisá las fechas o borrá una de las dos.', orden_legajo_dias_(v_otra.desde, v_otra.hasta);
  end if;
  update orden_legajo set desde = p_desde, hasta = p_hasta where id = v.id returning * into v;
  return v;
end $$;
revoke all on function orden_legajo_fechas(uuid, date, date) from public, anon;
grant execute on function orden_legajo_fechas(uuid, date, date) to authenticated;
