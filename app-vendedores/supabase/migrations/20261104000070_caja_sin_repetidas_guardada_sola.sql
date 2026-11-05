-- SQL 242 (4/11/2026): Mercado Pago en dos fotos sin sumar dos veces la misma venta, y la caja que da todo bien
-- queda guardada sola.
--   1) Con dos o más fotos de Mercado Pago, cada foto trae su lista de ventas (la IA anota la hora, el número si se ve y
--      el monto; la suma la hace el código). Una venta que aparece en las dos fotos cuenta una sola vez; dos ventas
--      iguales en la misma foto, dos. Si una foto muestra el total del día, sigue valiendo ese (como en el 241). Las
--      fotos leídas antes de esto no traen la lista: se suman como hasta ahora.
--   2) Una parte que no se leyó (el segundo posnet sin número) deja el medio sin leer, en vez de sumar sólo la otra.
--   3) Si con la última foto la caja quedó completa (el cierre del sistema, el efectivo contado y el comprobante de cada
--      medio que vendió) y no hay ninguna alerta, la caja queda guardada, como si hubieran tocado «Guardar». Pacheco
--      4/11: las fotos estaban y daba todo, pero nadie tocó «Guardar» y figuraba «Sin cargar».
-- Se puede correr dos veces. Se deshace con deshacer-242 (las cajas que ya quedaron guardadas siguen guardadas).
-- Pedido de Mauricio (4/11): "si en esas dos fotos hay ventas iguales, no sumarlas" y, con la foto de Pacheco,
-- "en realidad sí cargó… eso habría que cambiarlo también".

create or replace function public.orden_caja_lecturas(p_caja uuid)
 returns table(tipo text, resultado jsonb, partes integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with c as (select fecha from orden_cajas where id = p_caja),
  ult as (
    select distinct on (f.tipo, f.parte) f.tipo, f.parte, f.ia_resultado as r
      from orden_caja_fotos f
     where f.caja_id = p_caja and f.ia_estado = 'ok' and f.borrada_en is null
     order by f.tipo, f.parte, f.tomada_en desc),
  buenas as (
    select u.* from ult u cross join c
     where u.r ->> 'fecha' is null or orden_fecha_segura(u.r ->> 'fecha') is not distinct from c.fecha),
  cuantas as (select b.tipo, count(*)::integer as n from buenas b group by b.tipo),
  -- Mercado Pago en varias fotos: si alguna muestra el total del día en la pantalla (no la suma de la lista), vale
  -- ese total, y cada monto distinto una sola vez (la misma pantalla en dos fotos no se cuenta dos veces).
  pantalla as (
    select b.tipo, sum(distinct orden_num(b.r ->> 'total')) as t
      from buenas b
     where b.tipo = 'mp' and orden_num(b.r ->> 'total') is not null and b.r ->> 'total_de_lista' is distinct from 'true'
     group by b.tipo),
  -- (SQL 242) Si no, las ventas de las listas: la misma venta (hora y monto; sin hora, el número de operación) cuenta
  -- una vez aunque esté en las dos fotos, y dos ventas iguales en una misma foto, dos (de cada una, las veces de la foto
  -- que más tiene). Sólo si todas las fotos traen su lista leída entera (las de antes del 242 no la traen).
  listas as (
    -- (coalesce: una foto sin la lista da null, y bool_and saltea los null)
    select bool_and(coalesce(jsonb_typeof(b.r -> 'operaciones') = 'array' and jsonb_array_length(b.r -> 'operaciones') > 0
                             and orden_num(b.r ->> 'suma_operaciones') is not null, false)) as todas
      from buenas b where b.tipo = 'mp'),
  ventas as (
    select b.parte, orden_num(o ->> 'monto') as monto,
           case when coalesce(o ->> 'hora', '') <> '' then 'h:' || (o ->> 'hora') || '|' || round(orden_num(o ->> 'monto'), 2)
                when coalesce(o ->> 'numero', '') <> '' then 'n:' || (o ->> 'numero') || '|' || round(orden_num(o ->> 'monto'), 2)
                else 'u:' || b.parte || ':' || x.i end as clave
      from buenas b cross join lateral jsonb_array_elements(b.r -> 'operaciones') with ordinality as x(o, i)
     where b.tipo = 'mp' and jsonb_typeof(b.r -> 'operaciones') = 'array'),
  sin_repetir as (
    select sum(v.veces * v.monto) as t
      from (select z.clave, max(z.monto) as monto, max(z.veces) as veces
              from (select w.parte, w.clave, max(w.monto) as monto, count(*) as veces from ventas w group by w.parte, w.clave) z
             group by z.clave) v),
  valor as (
    select b.tipo,
           case when b.tipo = 'mp' and q.n > 1 then coalesce(orden_num(b.r ->> 'total'), orden_num(b.r ->> 'suma_operaciones'))
                else orden_num(b.r ->> 'total') end as v
      from buenas b join cuantas q on q.tipo = b.tipo
     where b.tipo <> 'sistema')
  select b.tipo, b.r, 1 from buenas b where b.tipo = 'sistema' and b.parte = 1
  union all
  select x.tipo,
         jsonb_build_object('total',
           case when x.tipo = 'mp' and q.n > 1 and p.t is not null then p.t
                when x.tipo = 'mp' and q.n > 1 and coalesce((select l.todas from listas l), false) then (select s.t from sin_repetir s)
                -- (SQL 242) Una parte sin leer deja el medio sin leer: mejor que lo carguen a mano que sumar un pedazo.
                when bool_or(x.v is null) then null
                else sum(x.v) end),
         q.n
    from valor x join cuantas q on q.tipo = x.tipo left join pantalla p on p.tipo = x.tipo
   group by x.tipo, q.n, p.t
$function$;

-- (SQL 242) La caja tiene todo y da: el cierre del sistema leído, el efectivo contado, el comprobante de cada medio que
-- vendió (el que dice $ 0 no lleva foto) y ninguna alerta. Sólo la usan las funciones de la caja.
create or replace function public.orden_caja_completa(p_caja uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select c.sis_tarjeta is not null and c.sis_mp is not null and c.sis_gocuotas is not null
       and c.sis_saldo_final_efvo is not null and c.real_efectivo is not null
       and (c.sis_tarjeta = 0 or c.real_lote is not null)
       and (c.sis_mp = 0 or c.real_mp is not null)
       and (c.sis_gocuotas = 0 or c.real_gocuotas is not null)
       and exists (select 1 from orden_caja_fotos f
                    where f.caja_id = c.id and f.tipo = 'sistema' and f.ia_estado = 'ok' and f.borrada_en is null)
       and jsonb_array_length(orden_caja_alertas(c.id)) = 0
      from orden_cajas c where c.id = p_caja), false)
$function$;
revoke all on function public.orden_caja_completa(uuid) from public, anon, authenticated;
grant execute on function public.orden_caja_completa(uuid) to service_role;

create or replace function public.orden_caja_aplicar_lectura(p_foto uuid, p_resultado jsonb, p_modelo text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  f orden_caja_fotos; c orden_cajas; v_alertas jsonb; v_que text; v_guardada boolean := false;
begin
  update orden_caja_fotos
     set ia_estado = case when coalesce((p_resultado ->> 'foto_valida')::boolean, true) then 'ok' else 'invalida' end,
         -- SQL 139: si antes había fallado, el error ya no corre.
         ia_resultado = p_resultado, ia_modelo = p_modelo, ia_error = null
   where id = p_foto
  returning * into f;
  if not found then return p_resultado; end if;

  -- (SQL 122) Lo que leyó bien pasa a la caja.
  if f.ia_estado = 'ok' then perform orden_caja_completar_con_ia(f.caja_id); end if;
  -- Si la caja ya estaba guardada, las alertas se recalculan (también con una foto que no se lee: la
  -- alerta "falta" lleva su motivo). A los responsables se les avisa como al guardar, sólo si la lectura fue buena.
  select * into c from orden_cajas where id = f.caja_id;
  if found and c.estado = 'cargada' and not exists (select 1 from orden_cajas_meses
       where local_id = c.local_id and mes = to_char(c.fecha, 'YYYY-MM') and estado = 'controlado') then
    v_alertas := orden_caja_alertas(c.id);
    if v_alertas is distinct from c.alertas then
      update orden_cajas set alertas = v_alertas where id = c.id;
      if f.ia_estado = 'ok' then perform orden_caja_avisar_alertas(c.id); end if;
    end if;
  -- (SQL 242) Sin guardar, y con esta foto quedó todo y da: se guarda sola, como al tocar «Guardar» (sin alertas no hay
  -- nada que avisar). La cargó quien sacó la foto.
  elsif found and c.estado = 'pendiente' and f.ia_estado = 'ok' and not exists (select 1 from orden_cajas_meses
       where local_id = c.local_id and mes = to_char(c.fecha, 'YYYY-MM') and estado = 'controlado')
       and orden_caja_completa(c.id) then
    update orden_cajas
       set estado = 'cargada', alertas = '[]'::jsonb,
           cargada_por = coalesce(cargada_por, f.persona_id), cargada_en = coalesce(cargada_en, now())
     where id = c.id and estado = 'pendiente';
    v_guardada := found;
  end if;

  if f.ia_estado = 'invalida' and f.persona_id is not null and f.tomada_en >= timestamptz '2026-10-15 00:00:00-03' and f.tomada_en > now() - interval '6 hours' then
    -- (SQL 122) La foto no se lee: se le avisa a quien la sacó, con el motivo (de acá en adelante).
    v_que := case f.tipo when 'sistema' then 'del cierre del sistema' when 'lote' then 'del cierre de lote (posnet)'
                         when 'mp' then 'de Mercado Pago' else 'de Go Cuotas' end;
    perform orden_encolar_aviso(f.persona_id, 'caja_foto', 'Caja: la foto ' || v_que || ' no se leía',
      left(coalesce(nullif(trim(p_resultado ->> 'motivo'), ''), 'No se ven bien los números.'), 220) ||
        ' Si todavía estás en el local, sacala de nuevo en Caja; si no, tenelo en cuenta para la próxima.',
      '/caja', 'caja-foto:' || f.id, 2::smallint);
  end if;
  -- (SQL 242) Lo leído, y si la caja quedó guardada (leer-caja se lo cuenta a la app).
  return case when v_guardada then coalesce(p_resultado, '{}'::jsonb) || '{"caja_guardada": true}'::jsonb else p_resultado end;
end $function$;

notify pgrst, 'reload schema';

-- (La parte de datos, Pacheco 4/11, está en correr-en-supabase-242.sql: se corrió una vez.)
