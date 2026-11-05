-- SQL 248 (5/11/2026, migración 76): «Corregir el medio de pago» de una venta del POS.
--   Pedido de Mauricio (5/11, con el cierre con fecha): si una venta se cobró con un medio y se cargó con otro (era
--   efectivo y se puso tarjeta, era Mercado Pago y se puso transferencia, otra tarjeta), se corrige sin anularla y la
--   corrección queda en su día (la venta no se mueve: sigue en el día en que se hizo).
--   Las reglas:
--     - Sólo una venta cobrada, B o A, que todavía no entró en un cierre de caja (si ya entró, primero se anula ese
--       cierre, y sólo se puede el último). La X va sólo con efectivo: no hay nada que corregir. Con factura de ARCA, no.
--     - Los pagos nuevos suman lo mismo que antes (el total de la venta no cambia).
--     - Lo que no se toca: la gift card con la que pagó (queda como está), los pagos en cuotas (de 2 o más: el interés
--       depende de las cuotas) y la promo «pagando todo con …» (con otro medio, la promo no va).
--     - Queda anotado: quién, cuándo, por qué, y los pagos de antes y de ahora (pos_venta_correcciones). El ticket lo muestra.
--     - El permiso es el de la caja (el mismo que el cierre). Hoy lo tienen todos los que usan el POS.
--   Cómo se lleva con el cierre: la venta sigue en su día, así que el cierre de ese día ya la trae corregida. Si ya habían
--   contado la caja de hoy, hay que contar de nuevo (la base lo pide sola: lo que tendría que haber cambió). Un día
--   anterior que quedó abierto conserva lo que contaron esa noche (la plata del cajón no cambió) y la diferencia se
--   recalcula con la venta corregida.
--   No cambia ningún dato que ya esté. Se deshace con deshacer-248.sql (la función se va y el ticket vuelve a como
--   estaba; las correcciones que se hayan hecho quedan hechas y anotadas).

-- 1) Lo que queda anotado de cada corrección. Sin clave foránea a pos_ventas a propósito: crearla traba las ventas de
--    todos los locales mientras corre el SQL. Si se borra una venta de prueba, su anotación queda suelta (no molesta).
CREATE TABLE IF NOT EXISTS public.pos_venta_correcciones (
  id              bigserial PRIMARY KEY,
  venta_id        uuid NOT NULL,
  fecha           timestamptz NOT NULL DEFAULT now(),
  persona         uuid,
  persona_nombre  text,
  motivo          text NOT NULL,
  antes           jsonb NOT NULL,
  despues         jsonb NOT NULL,
  clave           text UNIQUE
);
CREATE INDEX IF NOT EXISTS pos_venta_correcciones_venta ON public.pos_venta_correcciones (venta_id, fecha);
COMMENT ON TABLE public.pos_venta_correcciones IS 'SQL 248: cada «Corregir el medio de pago» de una venta del POS: quién, cuándo, por qué y los pagos de antes y de ahora.';
ALTER TABLE public.pos_venta_correcciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_venta_correcciones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pos_venta_correcciones_id_seq FROM PUBLIC, anon, authenticated;

-- 2) Corregir los pagos de una venta. p: {venta_id, pagos: [{medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote,
--    ultimos4, recibido}], motivo, clave}. Los pagos con gift card no van en la lista: quedan como están.
CREATE OR REPLACE FUNCTION public.pos_venta_pagos_corregir(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_motivo  text := nullif(trim(coalesce(p->>'motivo', '')), '');
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v         pos_ventas;
  k         pos_cierres;
  r         pos_venta_correcciones;
  x         jsonb;
  m         numeric;
  v_suma    numeric := 0;
  v_gc      numeric;
  v_viejas  text;
  v_nuevas  text;
  v_antes   jsonb;
  v_despues jsonb;
  v_i       int;
  v_pr      record;
  v_pago    forma_pago;
  v_cid     bigint;
begin
  perform pos_permiso('caja');
  begin
    v_id := nullif(p->>'venta_id', '')::uuid;
  exception when others then
    v_id := null;
  end;

  /* La misma corrección dos veces (se cortó internet y la mandaron de nuevo): no se hace otra vez. */
  if v_clave is not null then
    select * into r from pos_venta_correcciones where clave = v_clave;
    if found then
      return jsonb_build_object('id', r.id, 'venta_id', r.venta_id, 'pagos', r.despues, 'ya', true);
    end if;
  end if;

  select * into v from pos_ventas where id = v_id;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  /* Con la caja de esa sucursal: si justo la están cerrando, espera (y abajo ve si la venta ya entró en el cierre). */
  perform pg_advisory_xact_lock(hashtext('pos_caja:' || v.local_id::text || ':' || v.prueba::text));
  select * into v from pos_ventas where id = v_id for update;

  if v.estado <> 'cobrada' then raise exception 'Esa venta está anulada: no se corrige.'; end if;
  if v.factura is not null then raise exception 'Esa venta tiene factura de ARCA: el medio de pago no se corrige acá.'; end if;
  if v.letra = 'X' then
    raise exception 'La X va sólo con efectivo: no hay medio de pago para corregir. Si se cobró con otra cosa, se anula y se hace de nuevo como B.';
  end if;
  if v.cierre_id is not null then
    select * into k from pos_cierres where id = v.cierre_id;
    raise exception 'Esa venta ya entró en el cierre de caja % (del %): para corregirla, primero hay que anular ese cierre (se puede sólo el último).',
      case when k.prueba then 'P-' else 'Nº ' end || k.numero, pos_dia_texto(k.dia);
  end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'Escribí por qué se corrige.'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es demasiado largo (hasta 300 letras).'; end if;

  if jsonb_typeof(v_pagos) <> 'array' or jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  if jsonb_array_length(v_pagos) > 10 then raise exception 'Son demasiados pagos para una venta.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round(nullif(x->>'monto', '')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if x->>'medio' = 'giftcard' then
      raise exception 'La gift card no se agrega ni se cambia acá: el pago con gift card queda como está.';
    end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia') then
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if x->>'medio' = 'tarjeta' then
      if nullif(trim(coalesce(x->>'tarjeta', '')), '') is null then raise exception 'Falta qué tarjeta es.'; end if;
      if coalesce(x->>'tipo_tarjeta', '') not in ('credito', 'debito') then raise exception 'Falta si la tarjeta es de crédito o de débito.'; end if;
      if coalesce(nullif(x->>'cuotas', '')::int, 1) not between 1 and 24 then raise exception 'Las cuotas van de 1 a 24.'; end if;
      if nullif(x->>'ultimos4', '') is not null and (x->>'ultimos4') !~ '^[0-9]{4}$' then raise exception 'Los últimos 4 números de la tarjeta son 4 números.'; end if;
    end if;
    if x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null and (x->>'recibido')::numeric < m then
      raise exception 'Lo que recibiste en efectivo es menos que lo que se cobra.';
    end if;
    v_suma := v_suma + m;
  end loop;

  v_gc := coalesce((select sum(g.monto) from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'giftcard'), 0);
  if v_suma + v_gc <> v.total then
    /* Los montos como se escriben acá: $10.000 o $9.999,50 (la base sola los escribe en inglés). */
    if v_gc > 0 then
      raise exception 'Los pagos ($%) y la gift card ($%) no suman el total de la venta ($%).',
        replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v_gc, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
        replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
    end if;
    raise exception 'Los pagos ($%) no suman el total de la venta ($%).',
      replace(translate(to_char(v_suma, 'FM999G999G990D00'), ',.', '.,'), ',00', ''),
      replace(translate(to_char(v.total, 'FM999G999G990D00'), ',.', '.,'), ',00', '');
  end if;

  /* Las cuotas (2 o más) no se tocan: el interés (SQL 215) depende de ellas. Los mismos pagos en cuotas, con el mismo monto. */
  select string_agg(coalesce(g.cuotas, 1) || ':' || round(g.monto, 2)::text, ',' order by coalesce(g.cuotas, 1), g.monto) into v_viejas
    from pos_venta_pagos g where g.venta_id = v.id and g.medio = 'tarjeta' and coalesce(g.cuotas, 1) > 1;
  select string_agg(coalesce(nullif(g->>'cuotas', '')::int, 1) || ':' || round((g->>'monto')::numeric, 2)::text, ','
                    order by coalesce(nullif(g->>'cuotas', '')::int, 1), round((g->>'monto')::numeric, 2)) into v_nuevas
    from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1;
  if v_viejas is distinct from v_nuevas then
    if v_viejas is null then
      raise exception 'Las cuotas no se agregan acá (pueden llevar interés): la tarjeta va en 1 cuota. Si fue en cuotas, se hace una nota de crédito y la venta de nuevo.';
    end if;
    raise exception 'El pago en cuotas no se cambia acá (el interés depende de las cuotas): dejalo como estaba. Si estaba mal, se hace una nota de crédito y la venta de nuevo.';
  end if;

  /* La promo «pagando todo con …»: con otro medio, no va. */
  for v_pr in select pr.nombre, pr.medio from pos_venta_descuentos d join pos_promos pr on pr.id = d.promo_id
               where d.venta_id = v.id and pr.tipo = 'medio_pago' loop
    if v_gc > 0 or exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' <> v_pr.medio) then
      raise exception 'Esta venta tiene la promo «%» (pagando todo %): con otro medio, la promo no va. Si se pagó con otra cosa, se hace una nota de crédito y la venta de nuevo.',
        v_pr.nombre, case v_pr.medio when 'efectivo' then 'en efectivo' when 'tarjeta' then 'con tarjeta' when 'mercadopago' then 'con Mercado Pago'
                          when 'modo' then 'con MODO' when 'go_cuotas' then 'con Go Cuotas' when 'transferencia' then 'con transferencia' else 'con ' || v_pr.medio end;
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_antes from pos_venta_pagos g where g.venta_id = v.id;

  /* Los pagos de antes (menos la gift card) se van y entran los nuevos, después de los que quedan. */
  delete from pos_venta_pagos where venta_id = v.id and medio <> 'giftcard';
  select coalesce(max(orden), 0) into v_i from pos_venta_pagos where venta_id = v.id;
  for x in select * from jsonb_array_elements(v_pagos) loop
    v_i := v_i + 1;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto)
    values (v.id, v_i, x->>'medio', round((x->>'monto')::numeric, 2),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'tarjeta', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'tipo_tarjeta', '') end,
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            nullif(trim(coalesce(x->>'cupon', '')), ''),
            case when x->>'medio' = 'tarjeta' then nullif(trim(coalesce(x->>'lote', '')), '') end,
            case when x->>'medio' = 'tarjeta' then nullif(x->>'ultimos4', '') end,
            case when x->>'medio' = 'efectivo' then nullif(x->>'recibido', '')::numeric end,
            case when x->>'medio' = 'efectivo' and nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden), '[]'::jsonb) into v_despues from pos_venta_pagos g where g.venta_id = v.id;
  if v_despues = v_antes then raise exception 'No cambiaste nada: los pagos ya están así.'; end if;

  insert into pos_venta_correcciones (venta_id, persona, persona_nombre, motivo, antes, despues, clave)
  values (v.id, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_motivo, v_antes, v_despues, v_clave)
  returning id into v_cid;

  /* SQL 200: la gift card que se vendió en esta venta anota cómo se pagó (la sección Gift Cards): la misma cuenta que al vender. */
  if exists (select 1 from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null) then
    if jsonb_array_length(v_pagos) = 1 then
      v_pago := (case v_pagos->0->>'medio'
                   when 'efectivo' then 'efectivo'
                   when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                   else 'otro' end)::forma_pago;
    else
      v_pago := 'otro';
    end if;
    update beneficios set pago = v_pago where id in (select i.beneficio from pos_venta_items i where i.venta_id = v.id and i.beneficio is not null);
  end if;

  return jsonb_build_object('id', v_cid, 'venta_id', v.id, 'numero', v.numero, 'serie', v.serie, 'pagos', v_despues, 'ya', false);
end $function$;
REVOKE ALL ON FUNCTION public.pos_venta_pagos_corregir(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venta_pagos_corregir(jsonb) TO authenticated;

-- 3) El ticket trae sus correcciones (quién, cuándo, por qué y los pagos de antes). Lo demás, igual.
CREATE OR REPLACE FUNCTION public.pos_venta(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb;
begin
  perform pos_permiso();
  select to_jsonb(v) - 'clave'
         || jsonb_build_object(
              'local', l.nombre,
              'cargado_por_nombre', (select p.nombre from orden_personas p where p.id = v.cargado_por),
              'anulada_por_nombre', (select p.nombre from orden_personas p where p.id = v.anulada_por),
              'items', coalesce((select jsonb_agg(to_jsonb(i) - 'venta_id' order by i.item) from pos_venta_items i where i.venta_id = v.id), '[]'::jsonb),
              'descuentos_detalle', coalesce((select jsonb_agg(to_jsonb(d) - 'venta_id' order by d.orden) from pos_venta_descuentos d where d.venta_id = v.id), '[]'::jsonb),
              'pagos', coalesce((select jsonb_agg(to_jsonb(g) - 'venta_id' order by g.orden) from pos_venta_pagos g where g.venta_id = v.id), '[]'::jsonb),
              /* SQL 171: el socio, con su nivel de hoy, y si los puntos están sumados (y no se anularon). */
              'socio_nivel', (select c.nivel from v_club_clientes c where c.codigo = v.socio),
              'puntos_sumados', exists (select 1 from club_movimientos m where m.id = v.club_mov and m.anulado is null),
              /* SQL 205: la nota de crédito que la anuló (con quién la hizo) y el cierre de caja en el que entró. */
              'nota_credito', (select to_jsonb(n) || jsonb_build_object('hizo_nombre', (select p.nombre from orden_personas p where p.id = n.hizo))
                                 from pos_notas_credito n where n.venta_id = v.id),
              'cierre', (select jsonb_build_object('id', k.id, 'numero', k.numero, 'prueba', k.prueba, 'estado', k.estado)
                           from pos_cierres k where k.id = v.cierre_id),
              /* SQL 248: las correcciones del medio de pago, de la más vieja a la última; y la promo «pagando todo con …». */
              'correcciones', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.fecha, 'persona', c.persona_nombre,
                                                                            'motivo', c.motivo, 'antes', c.antes) order by c.fecha, c.id)
                                          from pos_venta_correcciones c where c.venta_id = v.id), '[]'::jsonb),
              'promo_medio', (select pr.medio from pos_venta_descuentos d join pos_promos pr on pr.id = d.promo_id
                               where d.venta_id = v.id and pr.tipo = 'medio_pago' limit 1))
    into r
    from pos_ventas v join orden_locales l on l.id = v.local_id
   where v.id = p_id;
  if r is null then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok((r->>'local_id')::uuid);   -- SQL 190
  return r;
end $function$;

NOTIFY pgrst, 'reload schema';
