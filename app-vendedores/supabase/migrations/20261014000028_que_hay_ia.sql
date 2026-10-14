-- =====================================================================
-- Módulo VDH · Migración 28 (SQL 118), 14/10/2026: "qué hay" lo pone la IA, y
-- también lo pueden escribir los vendedores en sus módulos.
--
-- Pedido de Mauricio ("sí, hacé las dos cosas"):
-- 1. La IA, al revisar la foto de un módulo, dice qué ropa ve ("Remeras",
--    "Buzos y camperas", "Accesorios"). Si el módulo no dice qué hay, o lo
--    había puesto la IA, lo pone ella (así se actualiza solo cuando cambia la
--    temporada). Si lo escribió una persona, no lo pisa: deja la sugerencia
--    ("La IA ve: Buzos") para que alguien la acepte con un toque.
-- 2. Lo pueden escribir el supervisor y el administrador (como antes) y,
--    ahora, el vendedor que tiene el módulo (o lo cubre). La vidriera, que es
--    de todos, la puede escribir cualquiera del local.
--
-- Lo que ya estaba escrito (antes de esto) cuenta como escrito por una persona.
-- También cierra a quien no entró la función del SQL 116 que reconoce la vidriera.
-- Reversible: borrar las 3 funciones nuevas y las 3 columnas, y volver
-- orden_modulo_contenido a la del SQL 114 (sólo el supervisor).
-- =====================================================================

alter table orden_modulos add column if not exists contenido_origen text;
alter table orden_modulos add column if not exists contenido_ia text;
alter table orden_modulos add column if not exists contenido_ia_en timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orden_modulos_contenido_origen_ok') then
    alter table orden_modulos add constraint orden_modulos_contenido_origen_ok check (contenido_origen is null or contenido_origen in ('persona', 'ia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orden_modulos_contenido_ia_largo') then
    alter table orden_modulos add constraint orden_modulos_contenido_ia_largo check (contenido_ia is null or length(contenido_ia) <= 60);
  end if;
end $$;
-- Lo que ya estaba escrito, por una persona.
update orden_modulos set contenido_origen = 'persona' where contenido is not null and contenido_origen is null;

/** ¿Puede escribir qué hay en este módulo? El supervisor del local o el administrador; el vendedor que lo tiene o lo
    cubre; la vidriera, cualquiera del local. */
create or replace function orden_puede_que_hay(p_modulo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select orden_es_supervisor_de(s.local_id)
        or orden_yo_id() in (s.responsable_id, s.suplente_id)
        or (orden_es_vidriera(m.isla, m.nombre) and orden_es_del_local(s.local_id))
      from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where m.id = p_modulo), false)
$$;

create or replace function orden_modulo_contenido(p_modulo uuid, p_contenido text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; v text := nullif(regexp_replace(trim(coalesce(p_contenido, '')), '\s+', ' ', 'g'), '');
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  if not orden_puede_que_hay(m.id) then raise exception 'Qué hay lo escribe quien tiene el módulo o el supervisor del local'; end if;
  if length(v) > 60 then raise exception 'Es muy largo (hasta 60 letras)'; end if;
  update orden_modulos set contenido = v, contenido_origen = case when v is null then null else 'persona' end,
                           contenido_ia = null, contenido_ia_en = null
   where id = m.id;
end $$;

/** "Usar esto": lo que vio la IA pasa a ser qué hay (y desde ahí lo sigue actualizando la IA). */
create or replace function orden_modulo_contenido_aceptar(p_modulo uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos;
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  if not orden_puede_que_hay(m.id) then raise exception 'Qué hay lo escribe quien tiene el módulo o el supervisor del local'; end if;
  if m.contenido_ia is null then return; end if;
  update orden_modulos set contenido = m.contenido_ia, contenido_origen = 'ia', contenido_ia = null, contenido_ia_en = null where id = m.id;
end $$;

/** Lo que vio la IA en la foto (la llama la función analizar-foto, con la llave del servidor). */
create or replace function orden_modulo_contenido_ia(p_foto uuid, p_contenido text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; v text := left(nullif(regexp_replace(trim(coalesce(p_contenido, '')), '\s+', ' ', 'g'), ''), 60);
begin
  if v is null then return 'nada'; end if;
  select mo.* into m from orden_fotos f join orden_controles c on c.id = f.control_id join orden_modulos mo on mo.id = c.modulo_id
   where f.id = p_foto for update of mo;
  if not found then return 'sin módulo'; end if;
  if m.contenido is null or m.contenido_origen = 'ia' then
    update orden_modulos set contenido = v, contenido_origen = 'ia', contenido_ia = null, contenido_ia_en = null where id = m.id;
    return 'puesto';
  elsif lower(m.contenido) <> lower(v) then
    update orden_modulos set contenido_ia = v, contenido_ia_en = now() where id = m.id;
    return 'sugerido';
  end if;
  update orden_modulos set contenido_ia = null, contenido_ia_en = null where id = m.id and contenido_ia is not null;
  return 'igual';
end $$;

do $$
begin
  revoke all on function orden_puede_que_hay(uuid) from public, anon;
  grant execute on function orden_puede_que_hay(uuid) to authenticated, service_role;
  revoke all on function orden_modulo_contenido(uuid, text) from public, anon;
  grant execute on function orden_modulo_contenido(uuid, text) to authenticated, service_role;
  revoke all on function orden_modulo_contenido_aceptar(uuid) from public, anon;
  grant execute on function orden_modulo_contenido_aceptar(uuid) to authenticated, service_role;
  revoke all on function orden_modulo_contenido_ia(uuid, text) from public, anon, authenticated;
  grant execute on function orden_modulo_contenido_ia(uuid, text) to service_role;
  -- La del SQL 116 (reconocer la vidriera) quedó abierta a cualquiera: sin sesión, nada.
  revoke all on function orden_es_vidriera(boolean, text) from public, anon;
  grant execute on function orden_es_vidriera(boolean, text) to authenticated, service_role;
end $$;
