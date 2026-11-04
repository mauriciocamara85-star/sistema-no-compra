-- ════════════════════════════════════════════════════════════════════════
-- SQL 238 (4/11/2026) · Migración 67 · Fuera de Rivadavia, sólo la caja
--
-- Pedido de Mauricio en la capacitación de los locales: "para los demás
-- locales excepto Rivadavia, que sólo esté habilitada la sección de cierre
-- de caja, que es por ahora lo único que van a usar"; "no pongas llaves,
-- hagámoslo simple, la semana que viene te digo qué activar".
--
-- La app ya les muestra sólo la caja (vendedores.js, soloCaja). Esto frena
-- en la base lo que el reloj genera solo en los otros locales: los controles
-- del salón y del depósito, los sorpresa, el cambio de imagen, el test de la
-- semana y los avisos de "Hoy: N controles". Hoy el único que los recibía
-- era Lomas (tiene el croquis y los sectores repartidos desde el 3/11).
--
-- La caja sigue igual en todos (orden_tick_cajas no se toca), y no se borra
-- nada: el croquis, los sectores, los módulos y las fotos de Lomas quedan.
-- Lo que ya estaba generado (los 12 controles vencidos de Lomas del 3/11)
-- queda como está.
--
-- Para sumar un local a todo Equipo VDH: agregar su código en
-- orden_local_completo (abajo) y su id en LOCALES_CON_TODO de vendedores.js.
-- Si ya está corrido, no repite nada. Correrlo entero.
-- Para deshacerlo: deshacer-238.sql.
-- ════════════════════════════════════════════════════════════════════════

create or replace function orden_local_completo(p_local uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from orden_locales where id = p_local and codigo in ('MAR DEL PLATA'))
$$;
revoke all on function orden_local_completo(uuid) from public, anon;
grant execute on function orden_local_completo(uuid) to authenticated, service_role;

-- El reloj: el bloque de lo que se genera con el local abierto (puntos 1 a 6)
-- corre sólo en los locales completos. Lo de después (vencidos, tareas
-- vencidas, fotos sin revisar, faltas) sigue en todos: sin controles nuevos
-- no tiene nada que hacer.
do $$
declare v_def text; v_nueva text;
  v_antes   text := '    if orden_local_abre(l.id, v_hoy) then';
  v_despues text := '    if orden_local_abre(l.id, v_hoy) and orden_local_completo(l.id) then  -- SQL 238: fuera de Rivadavia, sólo la caja';
begin
  v_def := pg_get_functiondef('public.orden_tick(timestamptz)'::regprocedure);
  if position('orden_local_completo(l.id)' in v_def) > 0 then
    raise notice 'SQL 238: orden_tick ya tenía el cambio, no se tocó.';
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_antes, ''))) / length(v_antes) <> 1 then
    raise exception 'SQL 238: en orden_tick no está una sola vez la frase a cambiar. No se cambió nada: avisale a Claude.';
  end if;
  v_nueva := replace(v_def, v_antes, v_despues);
  execute v_nueva;
end $$;
