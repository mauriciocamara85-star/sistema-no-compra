-- =====================================================================
-- Módulo VDH · Migración 45 (SQL 143), 19/10/2026: la sección de la compu
-- se llama "Supervisión".
--
-- Pedido de Mauricio (19/10): "en la parte del sistema, yo pondría
-- supervisión… es para supervisar los locales. Y en la aplicación, que
-- quede Equipo VDH".
--
-- De los avisos que manda la base, el único que habla de la compu es el
-- del cierre del mes de las cajas (el mes se da por controlado en la compu,
-- en Cajas): ahora dice "Supervisión → Cajas". Los otros avisos hablan de
-- la app del celular y siguen diciendo "Equipo VDH".
--
-- Sólo cambia ese texto; la función es la misma.
-- Reversible: la vuelta atrás está al final (comentada).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.orden_cajas_aviso_cierre(p_ahora timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mes text := to_char(((p_ahora at time zone 'America/Argentina/Buenos_Aires')::date - interval '1 month'), 'YYYY-MM');
  v_nombre_mes text;
  v_locales text; v_n int;
begin
  select string_agg(t.local_nombre, ', ' order by t.local_nombre), count(*)
    into v_locales, v_n
    from orden_v_cajas_mes t
    join orden_config c on c.local_id = t.local_id and c.caja_activa
   where t.mes = v_mes
     and not exists (select 1 from orden_cajas_meses m where m.local_id = t.local_id and m.mes = v_mes and m.estado = 'controlado');
  if coalesce(v_n, 0) = 0 then return 0; end if;
  v_nombre_mes := (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[substr(v_mes, 6, 2)::int];
  return orden_avisar_responsables(null, 'admins', 'cierre_cajas',
    'Cajas de ' || v_nombre_mes || ' para cerrar',
    case when v_n = 1 then v_locales || ': revisá el mes y dalo por controlado en Supervisión → Cajas.'
         else v_n || ' locales (' || v_locales || '): revisá cada mes y dalo por controlado en Supervisión → Cajas.' end,
    '/admin', 'cierre-cajas:' || v_mes, 2::smallint);
end $function$;

-- Chequeo: tiene que decir t (el aviso ya dice "Supervisión → Cajas").
select position('Supervisión → Cajas' in prosrc) > 0 and position('Equipo VDH' in prosrc) = 0 as aviso_actualizado
  from pg_proc where proname = 'orden_cajas_aviso_cierre';

-- ---------------------------------------------------------------------
-- Vuelta atrás: volver a correr esta misma función cambiando
-- "Supervisión → Cajas" por "Equipo VDH → Cajas" (las dos veces).
-- ---------------------------------------------------------------------
