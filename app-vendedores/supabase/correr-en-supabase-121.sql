-- ═══ SQL 121 (14/10/2026) · Los supervisores de varios locales: el aviso del producto testigo y la compu ═══
-- Va después del 120. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · El aviso "Mañana / Hoy tienen producto testigo" les llega también a los supervisores de varios locales
--     (de cada local que tienen aprobado), con el nombre del local en el título.
--   · En la compu, el "¿Quién sos?" de un local muestra también a sus supervisores de varios locales.
--   · Reversible: volver testigo_tick y nc_login_personas a como estaban.

-- =====================================================================
-- Módulo VDH · Migración 30 (SQL 121), 14/10/2026: los supervisores de
-- varios locales (SQL 120) en dos lugares que faltaban.
--
-- 1. El aviso del producto testigo ("Mañana tienen…" / "Hoy tienen…") les
--    llega también a ellos, de cada local que tienen aprobado (antes: sólo a
--    los vendedores y al encargado del local). A ellos el título les dice de
--    qué local es, porque tienen varios.
-- 2. En la compu, la lista "¿Quién sos?" de un local suma a sus supervisores
--    de varios locales (aprobados para ese local). Antes aparecían sólo en
--    "Atención y administración", y en la compu de un local había que ir a
--    "Otro local" para encontrarlos.
--
-- Va después del 120 (usa orden_supervisores_de y orden_supervision).
-- Reversible: volver testigo_tick y nc_login_personas a como estaban
-- (migración 14 y supabase/sin-pin.sql).
-- =====================================================================

create or replace function testigo_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hoy date := v_ahora::date; r record; v_n int := 0; v_lista text;
begin
  -- Sólo de 10 a 20 h: nada de avisos a la noche.
  if extract(hour from v_ahora) < 10 or extract(hour from v_ahora) >= 20 then return jsonb_build_object('avisos', 0); end if;
  for r in
    select s.id, s.local_id, s.fecha, p.id as persona_id, p.rol, p.local_id is null as de_varios, l.nombre as local_nombre
      from testigo_semanas s
      join orden_locales l on l.id = s.local_id
      -- Los vendedores y el encargado del local, y (SQL 121) sus supervisores de varios locales.
      join orden_personas p on p.activo and p.aprobado
                           and ((p.local_id = s.local_id and p.rol in ('vendedor', 'supervisor'))
                                or p.id in (select orden_supervisores_de(s.local_id)))
     where s.fecha in (v_hoy, v_hoy + 1) and s.cargada_en is null and not s.cerrada
       and exists (select 1 from testigo_items i where i.semana_id = s.id)
  loop
    select string_agg(producto || coalesce(' ' || color, ''), ', ' order by item) into v_lista from testigo_items where semana_id = r.id;
    if orden_encolar_aviso(r.persona_id, 'testigo',
         case when r.fecha = v_hoy then 'Hoy tienen producto testigo' else 'Mañana tienen producto testigo' end
           || case when r.de_varios then ' en ' || r.local_nombre else '' end,
         left('Se cuentan: ' || v_lista || '. Cargalo en la app y grabá el video de cada uno.', 300),
         case when r.rol = 'supervisor' then '/admin-testigo' else '/testigo' end,
         'testigo-' || case when r.fecha = v_hoy then 'hoy' else 'manana' end || ':' || r.id || ':' || r.fecha || ':' || r.persona_id,
         2::smallint) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('avisos', v_n);
end $$;

create or replace function nc_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and (p.local_id is not distinct from p_local
     -- SQL 121: en un local, también sus supervisores de varios locales (aprobados para ese local).
     or (p_local is not null and p.local_id is null and p.rol = 'supervisor' and p.aprobado
         and exists (select 1 from orden_supervision s where s.persona_id = p.id and s.local_id = p_local and s.aprobado)))
$$;

do $$
begin
  revoke all on function testigo_tick() from public, anon, authenticated;
  grant execute on function testigo_tick() to service_role;
  revoke all on function nc_login_personas(uuid) from public;
  grant execute on function nc_login_personas(uuid) to anon, authenticated;
end $$;
