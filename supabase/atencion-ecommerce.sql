-- =====================================================================
-- Sistema VDH · SQL 148, 21/10/2026: Atención al cliente entra por
-- "E-commerce", y en Ventas ve sólo el E-commerce.
--
-- Pedido de Mauricio: "si sos de atención al cliente, que puedas elegir
-- como local el e-commerce… y que a ellos nada más se les vea la parte del
-- e-commerce en la planilla de ventas".
--
-- 1. La entrada ("Entrá con tu usuario"): el último botón, "Administración",
--    se parte en dos.
--    - "E-commerce": Atención al cliente, y el vendedor que tiene la casilla
--      "También atiende clientes" (SQL 135).
--    - "Administración": administradores, Gerencia y supervisores de varios
--      locales.
--    nc_login_personas suma p_grupo ('atencion' u 'oficina'). Sin p_grupo
--    devuelve lo mismo que hoy, así que la pantalla de antes sigue andando
--    antes y después del push.
-- 2. Ventas: Atención al cliente deja de ver y cargar las planillas de los
--    14 locales. Le queda la hoja E-commerce (ventas_ecom_acceso, que no
--    cambia). El vendedor con la casilla sigue con la planilla de su local.
--
-- Se puede correr más de una vez. No lleva begin/commit: pegado entero
-- corre como un solo bloque. Para volver atrás: deshacer-148.sql.
-- =====================================================================

/* ═══ 1. La entrada ═══════════════════════════════════════════════════ */

create or replace function nc_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo) order by l.nombre)
                     from orden_locales l where l.activo), '[]'::jsonb)
      -- SQL 148: Atención al cliente entra por "E-commerce", como si fuera un local.
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and ((p.local_id is null and p.rol = 'atencion')
                                                or (p.local_id is not null and p.tambien_atencion and p.aprobado)))
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'E-commerce', 'codigo', 'ECOMMERCE', 'grupo', 'atencion'))
              else '[]'::jsonb end
      || case when exists (select 1 from orden_personas p join orden_pins k on k.persona_id = p.id
                            where p.activo and p.local_id is null and p.rol <> 'atencion')
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Administración', 'codigo', null, 'grupo', 'oficina'))
              else '[]'::jsonb end
$$;

/* La de un solo argumento se va: con las dos, PostgREST no sabría cuál
   llamar cuando la pantalla manda sólo p_local. */
drop function if exists nc_login_personas(uuid);

create or replace function nc_login_personas(p_local uuid default null, p_grupo text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial),
                                               'nuevo', k.hash is null,
                                               'pide_apellido', k.hash is null and nullif(trim(coalesce(p.apellido, '')), '') is null,
                                               'digitos', case when k.hash is null then orden_pin_digitos(p.rol, p.tambien_atencion) else coalesce(k.digitos, 4) end)
                            order by p.nombre, p.apellido), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and case
    when p_local is not null then
      p.local_id = p_local
      -- SQL 121: en un local, también sus supervisores de varios locales (aprobados para ese local).
      or (p.local_id is null and p.rol = 'supervisor' and p.aprobado
          and exists (select 1 from orden_supervision s where s.persona_id = p.id and s.local_id = p_local and s.aprobado))
    -- SQL 148: "E-commerce" = Atención al cliente, y el vendedor con la casilla (SQL 135).
    when p_grupo = 'atencion' then
      (p.local_id is null and p.rol = 'atencion') or (p.local_id is not null and p.tambien_atencion and p.aprobado)
    -- SQL 148: "Administración" = los demás sin local (administradores, Gerencia, supervisores de varios locales).
    when p_grupo = 'oficina' then
      p.local_id is null and p.rol <> 'atencion'
    -- Sin grupo (la pantalla de antes del 148): todos los sin local, y el vendedor con la casilla.
    else
      p.local_id is null or (p.tambien_atencion and p.aprobado)
  end
$$;

revoke all on function nc_login_personas(uuid, text) from public;
grant execute on function nc_login_personas(uuid, text) to anon, authenticated;

/* ═══ 2. Ventas: Atención al cliente, sólo el E-commerce ═════════════ */

create or replace function ventas_acceso(p_local uuid, p_caja text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_yo     uuid;
  v_nombre text;
  v_local  text;
begin
  select codigo into v_codigo from orden_locales where id = p_local and activo;
  if not found then return jsonb_build_object('puede', null); end if;
  if orden_es_servicio() then
    return jsonb_build_object('puede', 'escribir', 'quien', 'Sistema', 'supervisa', true);
  end if;
  v_yo := orden_yo_id();
  if v_yo is not null then
    select nombre into v_nombre from orden_personas where id = v_yo;
    if orden_es_supervisor_de(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', true);
    end if;
    if orden_es_del_local(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
    /* SQL 148: Atención al cliente ya no entra a las planillas de los locales (Mauricio, 21/10: "que a ellos
       nada más se les vea la parte del e-commerce"). La hoja E-commerce la abre ventas_ecom_acceso. */
    if orden_ve_local(p_local) then
      return jsonb_build_object('puede', 'ver', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
  end if;
  if p_caja like 'caja\_%' then
    v_local := club_caja_local(p_caja);
    if v_local is not null and upper(btrim(v_local)) = upper(btrim(coalesce(v_codigo, ''))) then
      return jsonb_build_object('puede', 'escribir', 'quien', 'Compu del local', 'supervisa', false);
    end if;
  end if;
  return jsonb_build_object('puede', null);
end $$;

/* ═══ Chequeo: tiene que decir "E-commerce · Administración" ═════════ */
select (select string_agg(x->>'nombre', ' · ') from jsonb_array_elements(nc_login_locales()) x where x->>'id' is null)
         as al_final_de_la_entrada,
       (select string_agg(x->>'nombre', ', ') from jsonb_array_elements(nc_login_personas(null, 'atencion')) x)
         as entran_por_ecommerce;
