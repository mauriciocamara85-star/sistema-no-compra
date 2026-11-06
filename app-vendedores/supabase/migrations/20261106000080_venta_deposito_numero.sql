-- SQL 252 (6/11/2026, migración 80): en Nueva venta, elegir el depósito y ver el número en «Referencia».
--   1) pos_venta_guardar: la venta puede traer deposito_id (un depósito activo de la sucursal) y lo vendido sale de
--      ése. Sin elegir, del predeterminado, como hasta ahora. Todo lo demás de la función queda igual (es la vigente
--      del 6/11 con tres agregados marcados «SQL 252»).
--   2) pos_venta_deshacer (anular y nota de crédito): lo vendido vuelve al depósito del que salió (antes volvía
--      siempre al predeterminado). Si ese depósito ya no está activo, al predeterminado.
--   3) pos_proximo_numero: el número que le toca a la próxima venta de la sucursal (uno seguido por sucursal; las X
--      y las pruebas aparte), para que «Referencia» diga «Nº 7» en vez de «Al guardar». Sólo lee.
-- Se puede correr dos veces. Se deshace con deshacer-252 (las dos funciones vuelven a como estaban y se va la tercera;
-- las ventas que ya salieron de otro depósito quedan como están).
-- Pedido de Mauricio (6/11): "en depósito te tendría que permitir cambiar el depósito... en referencia creo que tendría
-- que ir directamente el número"; "cada caja tiene un número, un número por sucursal... el predeterminado siempre;
-- cuando vaya otro, que esté la opción de cambiarlo... Así que, sí, dale".

CREATE OR REPLACE FUNCTION public.pos_venta_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_letra   text := coalesce(nullif(p->>'letra', ''), 'B');
  v_prueba  boolean := coalesce(nullif(p->>'prueba', '')::boolean, false);
  v_serie   text;
  v_cond    text := coalesce(nullif(p->>'cliente_condicion', ''), 'consumidor_final');
  v_doc     text := nullif(regexp_replace(coalesce(p->>'cliente_doc', ''), '[^0-9]', '', 'g'), '');
  v_vend    text := nullif(trim(coalesce(p->>'vendedor', '')), '');
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_descs   jsonb := coalesce(p->'descuentos', '[]'::jsonb);
  v_pagos   jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_neto    numeric := 0;
  v_desc    numeric := 0;
  v_pagado  numeric := 0;
  v_cant    int := 0;
  v_total   numeric;
  v_num     bigint;
  v_id      uuid;
  v_ya      pos_ventas;
  x         jsonb;
  it        record;
  i         int;
  n         int;
  pr        numeric;
  m         numeric;
  v_socio   text := nullif(regexp_replace(coalesce(p->>'socio', ''), '[^0-9]', '', 'g'), '');   -- SQL 171
  v_cli     v_club_clientes%rowtype;
  v_factor  jsonb;
  v_gana    int;
  v_mov     bigint;
  /* SQL 200: las gift cards. */
  gc        text;
  v_gcs     text[] := '{}';   -- las que se venden en esta venta
  v_gcp     text[] := '{}';   -- las que la pagan
  v_gc_neto numeric := 0;     -- lo que valen las que se venden
  v_gc_cob  numeric := 0;     -- lo que se cobra por ellas (con su parte de los descuentos)
  v_gb      v_beneficios%rowtype;
  v_locod   text;
  v_pago    forma_pago;
  v_bid     bigint;
  v_hecha   timestamptz;      -- SQL 212: cuándo se hizo la venta sin internet (la hora de la compu)
  /* SQL 215: el interés de las cuotas (lo calcula la pantalla) y la excepción sin interés. */
  v_interes numeric := round(coalesce(nullif(p->>'interes', '')::numeric, 0), 2);
  v_intnota text := nullif(trim(coalesce(p->>'interes_nota', '')), '');
  v_sinint  boolean := coalesce(nullif(p->>'sin_interes', '')::boolean, false);
  v_dep     uuid;             -- SQL 252: el depósito del que sale lo vendido (sin elegir: el predeterminado)
begin
  perform pos_permiso();
  perform pos_local_ok(v_local);   -- SQL 190

  if v_clave is not null then
    select * into v_ya from pos_ventas where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'numero', v_ya.numero, 'serie', v_ya.serie, 'prueba', v_ya.prueba,
                                'fecha', v_ya.fecha, 'ya', true, 'socio_puntos', v_ya.socio_puntos, 'puntos_sumados', v_ya.club_mov is not null);
    end if;
  end if;

  /* SQL 212: la venta hecha sin internet quedó guardada en la compu y llega más tarde, cuando vuelve internet.
     Trae la hora en que se hizo (hecha): vale ésa, con tope (no después de ahora ni antes de 3 días), para
     que quede en su día. Sin hecha, como siempre: ahora. */
  begin
    v_hecha := nullif(p->>'hecha', '')::timestamptz;
  exception when others then
    v_hecha := null;
  end;
  if v_hecha is not null then v_hecha := least(now(), greatest(v_hecha, now() - interval '3 days')); end if;

  /* SQL 171: el socio del Club (el número de su tarjeta), si lo eligieron. */
  if v_socio is not null then
    select * into v_cli from v_club_clientes where codigo = v_socio and baja is null;
    if not found then raise exception 'Ese socio del Club no existe o se dio de baja.'; end if;
  end if;

  if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then
    raise exception 'Elegí la sucursal.';
  end if;
  /* SQL 252: el depósito que eligieron en la venta, de la sucursal y activo. Sin elegir, el predeterminado (como
     antes). La venta hecha sin internet que llega cuando ese depósito ya no está sale del predeterminado: la venta
     ya se hizo y no se puede rechazar por eso. */
  begin
    v_dep := nullif(p->>'deposito_id', '')::uuid;
  exception when others then
    raise exception 'El depósito de la venta no es válido.';
  end;
  if v_dep is not null and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local and activo) then
    if v_hecha is null then raise exception 'Ese depósito no es de la sucursal o está dado de baja: elegí otro.'; end if;
    v_dep := null;
  end if;
  if v_vend is null then raise exception 'Elegí el vendedor.'; end if;
  if v_letra not in ('A', 'B', 'X') then raise exception 'El comprobante tiene que ser A, B o X.'; end if;
  if v_cond not in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento') then
    raise exception 'La condición de IVA del cliente no es válida.';
  end if;
  if v_letra = 'A' and (v_doc is null or length(v_doc) <> 11) then
    raise exception 'La factura A necesita el CUIT del cliente (11 números).';
  end if;
  if v_letra = 'A' and v_cond = 'consumidor_final' then
    raise exception 'A un consumidor final se le hace factura B.';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La venta no tiene productos.'; end if;
  if jsonb_array_length(v_items) > 200 then raise exception 'Son demasiados renglones para una venta.'; end if;
  for x in select * from jsonb_array_elements(v_items) loop
    n := (x->>'cantidad')::int;
    pr := round((x->>'precio')::numeric, 2);
    if n is null or n < 1 or n > 999 then raise exception 'Hay una cantidad que no es válida.'; end if;
    if pr is null or pr < 0 or pr >= 100000000 then raise exception 'Hay un precio que no es válido.'; end if;
    if nullif(trim(coalesce(x->>'descripcion', '')), '') is null then raise exception 'Hay un renglón sin descripción.'; end if;
    /* SQL 200: la gift card que se vende: una de las impresas, sin vender, de a una y con su valor. */
    if nullif(x->>'giftcard', '') is not null then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if gc !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
      if not exists (select 1 from giftcard_tarjetas g where g.codigo = gc) then
        raise exception 'Esa tarjeta no está entre las Gift Cards impresas.';
      end if;
      if exists (select 1 from beneficios z where upper(trim(z.serie)) = gc) then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end if;
      if gc = any (v_gcs) then raise exception 'La Gift Card % está dos veces en la venta.', pos_gc_nombre(gc); end if;
      if n <> 1 then raise exception 'Cada Gift Card va en su renglón, de a una.'; end if;
      if pr <= 0 then raise exception 'Falta el valor de la Gift Card %.', pos_gc_nombre(gc); end if;
      if pr >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
      v_gcs := v_gcs || gc;
      v_gc_neto := v_gc_neto + pr;
    end if;
    v_neto := v_neto + pr * n;
    v_cant := v_cant + n;
  end loop;

  if jsonb_typeof(v_descs) <> 'array' then raise exception 'Los descuentos no son válidos.'; end if;
  for x in select * from jsonb_array_elements(v_descs) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un descuento que no es válido.'; end if;
    if coalesce(x->>'tipo', '') not in ('promo', 'manual') then raise exception 'Hay un descuento de un tipo que no existe.'; end if;
    v_desc := v_desc + m;
  end loop;
  if v_desc > v_neto then raise exception 'Los descuentos son más que la venta.'; end if;
  v_total := v_neto - v_desc;
  /* SQL 200: lo que se cobra por las gift cards que se venden: su valor, con su parte de los descuentos. */
  if v_neto > 0 then v_gc_cob := round(v_gc_neto * v_total / v_neto, 2); end if;
  /* SQL 215: el interés de las cuotas (3 cuotas con menos de $80.000, 8 %; 6 cuotas con menos de $150.000, 17 %) se
     suma al total: es lo que se cobra en la tarjeta. Lo calcula la pantalla; acá, que tenga sentido. */
  if v_interes is null or v_interes < 0 then raise exception 'El interés de las cuotas no es válido.'; end if;
  if v_interes > v_total then raise exception 'El interés de las cuotas es más que la venta.'; end if;
  v_total := v_total + v_interes;

  if jsonb_typeof(v_pagos) <> 'array' then raise exception 'Los pagos no son válidos.'; end if;
  if v_total > 0 and jsonb_array_length(v_pagos) = 0 then raise exception 'Falta la forma de pago.'; end if;
  for x in select * from jsonb_array_elements(v_pagos) loop
    m := round((x->>'monto')::numeric, 2);
    if m is null or m <= 0 then raise exception 'Hay un pago sin monto.'; end if;
    if coalesce(x->>'medio', '') not in ('efectivo', 'tarjeta', 'mercadopago', 'modo', 'go_cuotas', 'transferencia', 'giftcard') then   -- SQL 200: giftcard
      raise exception 'Hay una forma de pago que no existe.';
    end if;
    if v_letra = 'X' and x->>'medio' <> 'efectivo' then
      raise exception 'La X (el comprobante interno) va sólo con efectivo.';
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
    /* SQL 200: la gift card con la que paga: vendida, disponible y que alcance. Se usa entera, como en Cobrar. */
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g');
      if gc = '' then raise exception 'Falta pasar la Gift Card con la que paga.'; end if;
      if v_gc_neto > 0 then raise exception 'Una Gift Card no se compra con otra Gift Card.'; end if;
      if gc = any (v_gcp) then raise exception 'La Gift Card % está dos veces en los pagos.', pos_gc_nombre(gc); end if;
      select * into v_gb from v_beneficios z where z.tipo = 'giftcard' and upper(trim(z.serie)) = gc;
      if not found then raise exception 'La Gift Card % no se vendió: no se puede cobrar con ella.', pos_gc_nombre(gc); end if;
      if v_gb.estado <> 'disponible' then
        raise exception 'La Gift Card % está %: no se puede cobrar con ella.', pos_gc_nombre(gc),
          case v_gb.estado when 'usado' then 'usada' when 'vencido' then 'vencida' when 'anulado' then 'anulada' else v_gb.estado end;
      end if;
      if m > v_gb.valor then
        raise exception 'La Gift Card % vale $%: con ella no se pagan $%.', pos_gc_nombre(gc),
          to_char(v_gb.valor, 'FM999G999G990D00'), to_char(m, 'FM999G999G990D00');
      end if;
      v_gcp := v_gcp || gc;
    end if;
    v_pagado := v_pagado + m;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no suman el total ($%).', to_char(v_pagado, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  /* SQL 215 */
  if (v_interes > 0 or v_sinint)
     and not exists (select 1 from jsonb_array_elements(v_pagos) g where g->>'medio' = 'tarjeta' and coalesce(nullif(g->>'cuotas', '')::int, 1) > 1) then
    raise exception 'El interés de las cuotas va sólo pagando con tarjeta en cuotas.';
  end if;
  if v_interes = 0 and not v_sinint then v_intnota := null; end if;

  /* SQL 200: cómo se pagó, para la gift card que se vende (el «pago» de la sección Gift Cards). */
  if jsonb_array_length(v_pagos) = 1 then
    v_pago := (case v_pagos->0->>'medio'
                 when 'efectivo' then 'efectivo'
                 when 'tarjeta' then case coalesce(nullif(v_pagos->0->>'cuotas', '')::int, 1) when 3 then '3 cuotas' when 6 then '6 cuotas' else 'tarjeta' end
                 else 'otro' end)::forma_pago;
  elsif jsonb_array_length(v_pagos) > 1 then
    v_pago := 'otro';
  end if;
  v_locod := (select codigo from orden_locales where id = v_local);

  /* Cada serie con su número: las pruebas (de cualquier letra) aparte, las X aparte, y A y B juntas. */
  v_serie := case when v_prueba then 'prueba' when v_letra = 'X' then 'x' else 'factura' end;
  insert into pos_numeros (local_id, serie, ultimo) values (v_local, v_serie, 1)
  on conflict (local_id, serie) do update set ultimo = pos_numeros.ultimo + 1
  returning ultimo into v_num;

  insert into pos_ventas (local_id, numero, serie, prueba, dia, letra, cliente_nombre, cliente_doc, cliente_condicion, cliente_email,
                          cliente_tel, envio, vendedor, cargado_por, lista_id, neto, descuentos, total, cantidad,
                          observaciones, clave, socio, fecha, sin_internet,   -- SQL 212: fecha y sin_internet
                          interes, interes_nota, sin_interes)                   -- SQL 215
  values (v_local, v_num, v_serie, v_prueba,
          case when v_hecha is null then pos_hoy() else (v_hecha at time zone 'America/Argentina/Buenos_Aires')::date end, v_letra, nullif(trim(coalesce(p->>'cliente_nombre', '')), ''), v_doc, v_cond,
          nullif(lower(trim(coalesce(p->>'cliente_email', ''))), ''), nullif(trim(coalesce(p->>'cliente_tel', '')), ''),
          nullif(p->>'envio', ''), v_vend, orden_yo_id(), nullif(p->>'lista_id', '')::int, v_neto, v_desc, v_total, v_cant,
          nullif(trim(coalesce(p->>'observaciones', '')), ''), v_clave, v_socio,
          coalesce(v_hecha, now()), case when v_hecha is not null then now() end,
          v_interes, v_intnota, v_sinint)
  returning id into v_id;

  i := 0;
  for x in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    gc := nullif(regexp_replace(coalesce(x->>'giftcard', ''), '[^0-9]', '', 'g'), '');
    v_bid := null;
    /* SQL 200: la gift card que se vende queda vendida como desde Gift Cards (vender_giftcard), con lo que
       se cobró por ella y a nombre del cliente de la venta. En una prueba, no. */
    if gc is not null and not v_prueba then
      begin
        insert into beneficios (tipo, serie, valor, cobrado, pago, vence, local, vendedor, telefono, nombre, obs, creado_por, creado_por_nombre)
        values ('giftcard', gc, round((x->>'precio')::numeric, 2),
                case when v_neto > 0 then round(round((x->>'precio')::numeric, 2) * (v_total - v_interes) / v_neto, 2) else 0 end,   -- SQL 215: sin el interés
                v_pago, pos_hoy() + 30, v_locod, v_vend,
                coalesce(tel_cliente(p->>'cliente_tel'), nullif(regexp_replace(coalesce(p->>'cliente_tel', ''), '[^0-9]', '', 'g'), '')),
                nullif(trim(coalesce(p->>'cliente_nombre', '')), ''),
                'Vendida en el POS: venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num,
                auth.uid(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
        returning id into v_bid;
      exception when unique_violation then
        raise exception 'La Gift Card % ya se vendió.', pos_gc_nombre(gc);
      end;
    end if;
    insert into pos_venta_items (venta_id, item, codigo, descripcion, talle, color, cantidad, precio, total, beneficio)
    values (v_id, i, case when gc is not null then 'GIFTCARD' else nullif(upper(trim(coalesce(x->>'codigo', ''))), '') end,
            case when gc is not null then 'Gift Card ' || pos_gc_nombre(gc) else trim(x->>'descripcion') end,
            case when gc is null then nullif(trim(coalesce(x->>'talle', '')), '') end,
            case when gc is null then nullif(trim(coalesce(x->>'color', '')), '') end,
            (x->>'cantidad')::int, round((x->>'precio')::numeric, 2), round((x->>'precio')::numeric, 2) * (x->>'cantidad')::int, v_bid);
  end loop;

  /* SQL 160: lo vendido sale del stock del local. Si no hay, igual se vende
     (queda en negativo, como en BlueSoft). Las pruebas no lo tocan. */
  if not v_prueba then
    for it in select * from pos_venta_items where venta_id = v_id and beneficio is null order by item loop   -- SQL 200: la gift card no es stock
      perform pos_stock_mover(v_local, it.codigo, it.talle, it.color, -it.cantidad, 'venta', v_id,
                              'Venta ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, it.descripcion, null, null, v_dep);   -- SQL 252: del depósito elegido
    end loop;
  end if;

  i := 0;
  for x in select * from jsonb_array_elements(v_descs) loop
    i := i + 1;
    insert into pos_venta_descuentos (venta_id, orden, tipo, promo_id, descripcion, monto)
    values (v_id, i, x->>'tipo', nullif(x->>'promo_id', '')::int,
            coalesce(nullif(trim(coalesce(x->>'descripcion', '')), ''), 'Descuento'), round((x->>'monto')::numeric, 2));
  end loop;

  i := 0;
  for x in select * from jsonb_array_elements(v_pagos) loop
    i := i + 1;
    /* SQL 200: la gift card que paga queda usada, como en Cobrar (canjear_beneficio): con el local, el vendedor
       y el total de la compra. En una prueba, no (y la venta no queda atada a ella). */
    v_bid := null;
    gc := null;
    if x->>'medio' = 'giftcard' then
      gc := regexp_replace(x->>'giftcard', '[^0-9]', '', 'g');
      if not v_prueba then
        update beneficios set usado = now(), local_canje = v_locod, vendedor_canje = v_vend, monto_compra = v_total, canal_canje = 'local'
         where tipo = 'giftcard' and upper(trim(serie)) = gc and usado is null and anulado is null
        returning id into v_bid;
        if v_bid is null then raise exception 'La Gift Card % la acaban de usar en otro lado.', pos_gc_nombre(gc); end if;
      end if;
    end if;
    insert into pos_venta_pagos (venta_id, orden, medio, monto, tarjeta, tipo_tarjeta, cuotas, cupon, lote, ultimos4, recibido, vuelto, beneficio)
    values (v_id, i, x->>'medio', round((x->>'monto')::numeric, 2),
            nullif(trim(coalesce(x->>'tarjeta', '')), ''), nullif(x->>'tipo_tarjeta', ''),
            case when x->>'medio' = 'tarjeta' then coalesce(nullif(x->>'cuotas', '')::int, 1) end,
            case when gc is not null then pos_gc_nombre(gc) else nullif(trim(coalesce(x->>'cupon', '')), '') end,
            nullif(trim(coalesce(x->>'lote', '')), ''), nullif(x->>'ultimos4', ''),
            nullif(x->>'recibido', '')::numeric,
            case when nullif(x->>'recibido', '') is not null then (x->>'recibido')::numeric - round((x->>'monto')::numeric, 2) end, v_bid);
  end loop;

  /* SQL 171: los puntos del socio, con la misma cuenta que Cobrar (club_sumar_compra): el total sobre los
     pesos por punto, por el multiplicador de su nivel y las promos del día, redondeado una vez al final. Se
     anotan siempre en la venta; se SUMAN sólo con la regla pos_suma_puntos = 'si' (apagada hasta que el POS
     reemplace a BlueSoft: mientras tanto se cargan en Cobrar, y así no se suman dos veces) y nunca en una prueba. */
  if v_socio is not null then
    v_factor := club_factor(v_cli.id);
    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). SQL 215: el interés tampoco. */
    v_gana := floor((greatest(v_total - v_interes - v_gc_cob, 0) / coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100))
                    * (v_factor->>'total')::numeric);
    if not v_prueba and v_gana > 0 and coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si' then
      insert into club_movimientos (cliente, tipo, puntos, local, vendedor, ticket, importe, obs)
      values (v_cli.id, 'compra', v_gana, (select codigo from orden_locales where id = v_local), v_vend,
              'POS ' || case when v_serie = 'x' then 'X-' else 'Nº ' end || v_num, greatest(v_total - v_interes - v_gc_cob, 0),
              case when (v_factor->>'extra')::numeric > 1 then
                (v_factor->>'motivo') || ' ' || replace(trim_scale((v_factor->>'extra')::numeric)::text, '.', ',') || 'x'
              end)
      returning id into v_mov;
    end if;
    update pos_ventas set socio_puntos = v_gana, club_mov = v_mov where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num, 'serie', v_serie, 'prueba', v_prueba, 'fecha', coalesce(v_hecha, now()), 'ya', false,
                            'socio_puntos', v_gana, 'puntos_sumados', v_mov is not null);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_venta_deshacer(p_id uuid, p_motivo text, p_nc text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v pos_ventas; m pos_stock_movs; v_usadas text;
begin
  select * into v from pos_ventas where id = p_id;
  /* SQL 200: la gift card que se vendió en esta venta no tiene que estar usada. */
  select string_agg(pos_gc_nombre(b.serie), ', ' order by i.item) into v_usadas
    from pos_venta_items i join beneficios b on b.id = i.beneficio
   where i.venta_id = p_id and b.usado is not null;
  if v_usadas is not null then
    raise exception 'La Gift Card % de esta venta ya se usó: la venta no se puede anular.', v_usadas;
  end if;
  update pos_ventas set estado = 'anulada', anulada_en = now(), anulada_por = orden_yo_id(), anulada_motivo = trim(p_motivo)
   where id = p_id;
  /* SQL 252: lo vendido vuelve al depósito del que salió, si sigue activo en la sucursal (si no, al predeterminado). */
  for m in select * from pos_stock_movs where ref_id = p_id and tipo = 'venta' order by id loop
    perform pos_stock_mover(m.local_id, m.codigo, m.talle, m.color, -m.cantidad, 'venta_anulada', p_id,
                            m.ref || ' (' || coalesce('nota de crédito ' || p_nc, 'anulada') || ')', null, null, null,
                            (select x.id from pos_depositos x where x.id = m.deposito_id and x.local_id = m.local_id and x.activo));
  end loop;
  /* SQL 171: si la venta le sumó puntos a un socio, se le descuentan: el movimiento del Club queda anulado,
     como cuando se anula una carga en Cobrar. */
  if v.club_mov is not null then
    update club_movimientos
       set anulado = now(), anulado_por = coalesce((select p.nombre from orden_personas p where p.id = orden_yo_id()), 'POS'),
           motivo_anul = coalesce('Nota de crédito ' || p_nc || ' en el POS: ', 'Venta anulada en el POS: ') || trim(p_motivo)
     where id = v.club_mov and anulado is null;
  end if;
  /* SQL 200: la gift card que se vendió vuelve a estar sin vender (se puede vender de nuevo: la venta anulada
     guarda cuál era y por cuánto) y la que pagó vuelve a estar disponible. */
  delete from beneficios b using pos_venta_items i where i.venta_id = p_id and i.beneficio = b.id;
  update beneficios b set usado = null, local_canje = null, vendedor_canje = null, monto_compra = null, canal_canje = null
    from pos_venta_pagos g
   where g.venta_id = p_id and g.medio = 'giftcard' and g.beneficio = b.id;
end $function$;

create or replace function public.pos_proximo_numero(p_local uuid, p_letra text default 'B', p_prueba boolean default false)
 returns bigint
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
/* SQL 252: el número que le toca a la próxima venta de la sucursal, para mostrarlo en «Referencia». Lo da la base
   al guardar (pos_numeros): si otra caja guarda antes, ésta toma el que sigue. La misma serie que pos_venta_guardar:
   las pruebas aparte, las X aparte, y A y B juntas. */
begin
  perform pos_permiso();
  if p_local is null then return null; end if;
  perform pos_local_ok(p_local);
  return coalesce((select n.ultimo from pos_numeros n
                    where n.local_id = p_local
                      and n.serie = case when coalesce(p_prueba, false) then 'prueba'
                                         when upper(coalesce(p_letra, 'B')) = 'X' then 'x' else 'factura' end), 0) + 1;
end $function$;

revoke all on function public.pos_proximo_numero(uuid, text, boolean) from public, anon;
grant execute on function public.pos_proximo_numero(uuid, text, boolean) to authenticated;
