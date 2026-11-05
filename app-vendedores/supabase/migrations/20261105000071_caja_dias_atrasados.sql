-- SQL 243 (5/11/2026): días anteriores de la caja que el local puede cargar.
-- El control de caja arrancó el 4/11 en los 13 locales que no son Rivadavia: para que noviembre quede completo, la
-- gente de cada local (vendedores y encargado) puede cargar el 1, el 2 y el 3 desde la app, como la caja de hoy (con
-- las fotos de ese día o los números a mano). Hasta ahora el vendedor sólo podía tocar la caja de hoy y la de ayer.
--   1) orden_caja_dias_atrasados: qué días anteriores puede cargar cada local, y hasta qué día de caja (inclusive).
--   2) orden_puede_editar_caja: además de hoy y ayer, esos días, hasta la fecha tope (con la caja prendida). El
--      supervisor y el administrador, como siempre, cualquier día.
--   3) orden_cajas_atrasadas(): para la app, las cajas de esos días del local de quien pregunta que todavía se pueden
--      cargar o corregir (sin las controladas), con sus fotos: la lectura de orden_cajas no cambia (el vendedor sigue
--      sin ver las cajas de antes de ayer por la tabla).
-- Qué días y qué locales es un dato aparte (correr-en-supabase-243.sql): el 1/11 fue domingo y sólo abrieron los
-- shoppings. Se puede correr dos veces. Se deshace con deshacer-243 (las cajas que ya cargaron quedan cargadas).
-- Pedido de Mauricio (5/11): "como empezamos ayer 4 … habilitar para que puedan cargar el día 3, el día 2 y el día 1
-- manualmente; así queda el mes completo de noviembre".

create table if not exists public.orden_caja_dias_atrasados (
  local_id  uuid not null references public.orden_locales(id) on delete cascade,
  fecha     date not null,
  hasta     date not null,           -- el último día de caja en que se puede cargar (inclusive)
  motivo    text,
  creado_en timestamptz not null default now(),
  primary key (local_id, fecha),
  check (hasta >= fecha)
);
alter table public.orden_caja_dias_atrasados enable row level security;
-- Sin políticas: la leen sólo las funciones de abajo (security definer) y el servicio.
revoke all on table public.orden_caja_dias_atrasados from public, anon, authenticated;
grant all on table public.orden_caja_dias_atrasados to service_role;

-- La gente DEL local toca hoy y ayer y, además, los días anteriores habilitados (hasta su fecha tope), si el local usa el
-- control de caja; el supervisor del local y el administrador, cualquier día. (create or replace: los permisos quedan.)
create or replace function public.orden_puede_editar_caja(p_local uuid, p_fecha date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select orden_es_supervisor_de(p_local)
      or (orden_es_del_local(p_local)
          and coalesce((select caja_activa from orden_config where local_id = p_local), false)
          and (p_fecha >= orden_dia_caja(p_local) - 1
               or exists (select 1 from orden_caja_dias_atrasados a
                           where a.local_id = p_local and a.fecha = p_fecha and a.hasta >= orden_dia_caja(p_local))))
$function$;

-- Para la app: las cajas de los días anteriores habilitados del local de quien pregunta (no las de hoy), del más viejo al
-- más nuevo, sin las ya controladas. Cada una como la fila de orden_cajas + cargar_hasta + fotos_lista (lo mismo que la
-- app lee de orden_caja_fotos para la caja de hoy, de la más nueva a la más vieja). Sin local o sin días: [].
create or replace function public.orden_cajas_atrasadas()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
           'cargar_hasta', a.hasta,
           'fotos_lista', coalesce((select jsonb_agg(jsonb_build_object('tipo', f.tipo, 'parte', f.parte, 'ia_estado', f.ia_estado,
                                                                        'ia_resultado', f.ia_resultado) order by f.tomada_en desc)
                                      from orden_caja_fotos f where f.caja_id = c.id), '[]'::jsonb))
         order by c.fecha), '[]'::jsonb)
    from orden_personas p
    join orden_caja_dias_atrasados a on a.local_id = p.local_id
    join orden_cajas c on c.local_id = a.local_id and c.fecha = a.fecha
   where p.id = orden_yo_id()
     and a.fecha < orden_dia_caja(a.local_id)
     and a.hasta >= orden_dia_caja(a.local_id)
     and c.estado <> 'controlada'
     and orden_puede_editar_caja(a.local_id, a.fecha)
$function$;
revoke all on function public.orden_cajas_atrasadas() from public, anon;
grant execute on function public.orden_cajas_atrasadas() to authenticated, service_role;

notify pgrst, 'reload schema';

-- (La parte de datos —qué locales y qué días, y las cajas vacías de esos días— está en correr-en-supabase-243.sql.)
