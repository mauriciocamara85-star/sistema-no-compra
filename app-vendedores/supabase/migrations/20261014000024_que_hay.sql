-- =====================================================================
-- Módulo VDH · Migración 24 (SQL 114), 14/10/2026: "qué hay en este módulo",
-- separado de su nombre (recomendación aceptada por Mauricio: "sí, sumalo").
--
-- El nombre dice DÓNDE está el módulo ("Vidriera", "Al lado de la caja") y casi
-- no cambia; "qué hay" dice QUÉ tiene ("Remeras", "Buzos de algodón") y cambia
-- con la temporada. Hasta ahora eran lo mismo: escribir "Remeras" en la
-- Vidriera borraba "Vidriera". En el croquis se lee "qué hay" arriba de cada
-- módulo (si no tiene, su nombre).
--
-- Lo escriben el supervisor del local y el administrador (como el nombre).
-- También en lo de adentro del local (la caja, las mesas): su nombre no cambia.
-- Reversible: borrar la función y la columna (se pierde lo que se haya escrito).
-- =====================================================================

alter table orden_modulos add column if not exists contenido text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orden_modulos_contenido_largo') then
    alter table orden_modulos add constraint orden_modulos_contenido_largo check (contenido is null or length(contenido) <= 60);
  end if;
end $$;

create or replace function orden_modulo_contenido(p_modulo uuid, p_contenido text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; v_local uuid; v text := nullif(regexp_replace(trim(coalesce(p_contenido, '')), '\s+', ' ', 'g'), '');
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  select local_id into v_local from orden_sectores where id = m.sector_id;
  if not orden_es_supervisor_de(v_local) then raise exception 'Sólo el supervisor del local escribe qué hay en un módulo'; end if;
  if length(v) > 60 then raise exception 'Es muy largo (hasta 60 letras)'; end if;
  update orden_modulos set contenido = v where id = m.id;
end $$;

do $$
begin
  revoke all on function orden_modulo_contenido(uuid, text) from public, anon;
  grant execute on function orden_modulo_contenido(uuid, text) to authenticated, service_role;
end $$;
