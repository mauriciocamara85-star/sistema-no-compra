-- SQL 271 (11/11/2026, migración 85): Cajas sabe qué días no abre cada local mirando la planilla de Ventas.
-- Pedido de Mauricio (11/11), con la foto de «Todos los locales» en rojo por el feriado del lunes 9/11: «¿No se puede
-- tomar los datos del sistema de ventas de las planillas, digamos, si sabe automáticamente qué día no abre?».
--
-- Qué hace:
-- orden_local_abre(local, día) mira primero el peso del día en la planilla de Ventas (ventas_dias):
--   · peso mayor que 0 → ese día el local abre;
--   · peso 0           → ese día no abre (un feriado, un día que se cerró);
--   · sin renglón (un mes que todavía no se armó en Ventas) → los «Días que abre» del local, como hasta hoy.
-- Es la misma regla que ya usa el control de carga de Ventas (ventas_control).
--
-- Qué cambia con eso (todo lo de Cajas pregunta por esta función):
--   · «Todos los locales» y el mes de cada local dejan de contar como «sin cargar» un día que el local no abrió;
--   · esa noche no sale el aviso «Falta cargar la caja de hoy», ni a la mañana el de «no cargó la caja de ayer»;
--   · el resumen diario de cajas no nombra a ese local.
-- Y en Rivadavia, que usa Equipo VDH entero: un día con peso 0 tampoco genera las tareas ni cuenta como día de trabajo.
--
-- Lleva «security definer» porque la pantalla no tiene permiso para leer ventas_dias: sin eso, «Todos los locales»
-- falla con «permission denied for table ventas_dias». Lo único que deja saber es si un local abre un día.
--
-- No toca ningún dato. Se deshace con deshacer-271.sql. Corre entero o nada.

create or replace function public.orden_local_abre(p_local uuid, p_fecha date)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select l.activo and coalesce(
             -- (SQL 271) Ventas manda: el peso del día en la planilla.
             (select d.peso > 0 from ventas_dias d where d.local_id = l.id and d.fecha = p_fecha),
             extract(isodow from p_fecha)::smallint = any(l.dias_abiertos))
      from orden_locales l where l.id = p_local), false)
$function$;
