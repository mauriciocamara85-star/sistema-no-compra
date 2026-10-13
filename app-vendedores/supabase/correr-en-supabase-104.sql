-- ═══ SQL 104 (13/10/2026) · Impecable: Atención al cliente fuera de la entrada ═══
-- Va después del 100 (el rol "Atención al cliente") y del 103. No es urgente:
-- todavía no hay nadie de Atención cargado. Pegalo entero en el editor SQL de
-- Supabase. Se puede correr más de una vez. Reversible (ver abajo).

-- =====================================================================
-- Módulo VDH · Migración 16 (SQL 104): Atención al cliente no aparece en la
-- lista de la entrada de Impecable.
--
-- El No Compra pasó a usar la misma gente (orden_personas) con el rol nuevo
-- 'atencion' (SQL 100, de la otra sesión). Esas personas no tienen local, así
-- que aparecían en "Administrador" de la entrada de Impecable. Si igual entran
-- (la sesión es la misma que la del No Compra), la app les dice "Sin acceso a
-- Impecable". El No Compra tiene su propia lista (nc_login_personas).
-- Reversible: volver a crear la función sin la condición del rol.
-- =====================================================================

create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local and p.rol::text <> 'atencion'
$$;

select 'listo: Atención al cliente fuera de la entrada de Impecable' as "SQL 104";
