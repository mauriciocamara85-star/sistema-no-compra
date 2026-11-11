-- ═══ SQL 273 · ARCA: dónde se guarda el permiso para facturar (11/11/2026) ═══
-- Pedido de Mauricio (11/11): empezar a probar la factura electrónica de ARCA desde el POS. Este es el paso 1: el
-- puente entre el servidor y ARCA. Todavía no cambia nada en ninguna pantalla.
--
-- Qué hace:
--  · Crea la tabla arca_tickets. Ahí el servidor guarda el «ticket de acceso» que le da ARCA para poder facturar.
--    El ticket dura 12 horas y ARCA no da otro mientras haya uno vigente: por eso hay que guardarlo y reusarlo.
--    Hay un renglón por ambiente (el de prueba y el de verdad).
--  · Crea dos funciones que usa SÓLO el servidor (la función «arca»):
--      arca_ticket_pedir   → devuelve el ticket vigente; si no hay, deja pasar UN solo pedido a ARCA por vez
--                            (si dos cajas facturan en el mismo segundo, la segunda espera) y, si ARCA falló hace
--                            menos de un minuto, devuelve ese error sin volver a molestarla.
--      arca_ticket_guardar → guarda el ticket nuevo, o el error si ARCA no lo dio.
--  · Ninguna pantalla puede leer ni tocar la tabla ni llamar a las funciones: sólo el servidor.
--
-- NO toca ninguna tabla ni función que ya exista y NO cambia ningún dato. Se puede correr más de una vez.
-- Se deshace con deshacer-273.sql. Corre entero o nada.

create table if not exists arca_tickets (
  ambiente        text not null check (ambiente in ('homologacion', 'produccion')),
  servicio        text not null check (servicio <> ''),
  token           text,
  sign            text,
  vence           timestamptz,
  pidiendo_desde  timestamptz,   -- alguien le está pidiendo el ticket a ARCA desde esta hora
  error           text,          -- por qué ARCA no lo dio la última vez
  error_en        timestamptz,
  actualizado     timestamptz not null default now(),
  primary key (ambiente, servicio),
  constraint arca_tickets_entero check ((token is null) = (sign is null) and (token is null) = (vence is null))
);
comment on table arca_tickets is 'El ticket de acceso de ARCA (WSAA) de cada ambiente, para reusarlo hasta que vence. Sólo el servidor. SQL 273.';

alter table arca_tickets enable row level security;
revoke all on table arca_tickets from public, anon, authenticated;

create or replace function arca_ticket_pedir(p_ambiente text, p_servicio text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t arca_tickets;
begin
  if p_ambiente is null or p_ambiente not in ('homologacion', 'produccion') then
    raise exception 'El ambiente de ARCA es «homologacion» o «produccion».';
  end if;
  if coalesce(trim(p_servicio), '') = '' then raise exception 'Falta el servicio de ARCA.'; end if;
  insert into arca_tickets (ambiente, servicio) values (p_ambiente, p_servicio)
  on conflict (ambiente, servicio) do nothing;
  /* El renglón queda tomado hasta que termina esta función: dos pedidos juntos pasan de a uno. */
  select * into t from arca_tickets where ambiente = p_ambiente and servicio = p_servicio for update;
  /* Con menos de 10 minutos de vida ya no sirve: una factura puede tardar. */
  if t.token is not null and t.vence > now() + interval '10 minutes' then
    return jsonb_build_object('ticket', jsonb_build_object('token', t.token, 'sign', t.sign, 'vence', t.vence));
  end if;
  if t.pidiendo_desde is not null and t.pidiendo_desde > now() - interval '40 seconds' then
    return jsonb_build_object('esperar', true);
  end if;
  if t.error_en is not null and t.error_en > now() - interval '1 minute' then
    return jsonb_build_object('error', t.error);
  end if;
  update arca_tickets set pidiendo_desde = now(), actualizado = now()
   where ambiente = p_ambiente and servicio = p_servicio;
  return jsonb_build_object('pedir', true);
end $function$;

create or replace function arca_ticket_guardar(p_ambiente text, p_servicio text, p_token text, p_sign text, p_vence timestamptz, p_error text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_ambiente is null or p_ambiente not in ('homologacion', 'produccion') then
    raise exception 'El ambiente de ARCA es «homologacion» o «produccion».';
  end if;
  if coalesce(trim(p_servicio), '') = '' then raise exception 'Falta el servicio de ARCA.'; end if;
  if p_token is not null then
    if p_sign is null or p_vence is null then raise exception 'El ticket de ARCA vino incompleto.'; end if;
    insert into arca_tickets (ambiente, servicio, token, sign, vence)
    values (p_ambiente, p_servicio, p_token, p_sign, p_vence)
    on conflict (ambiente, servicio) do update
      set token = excluded.token, sign = excluded.sign, vence = excluded.vence,
          pidiendo_desde = null, error = null, error_en = null, actualizado = now();
  else
    /* ARCA no lo dio: se anota por qué y se suelta el pedido. El ticket de antes, si había, queda. */
    insert into arca_tickets (ambiente, servicio, error, error_en)
    values (p_ambiente, p_servicio, left(coalesce(nullif(trim(p_error), ''), 'No se pudo pedir el permiso de ARCA.'), 500), now())
    on conflict (ambiente, servicio) do update
      set pidiendo_desde = null, error = excluded.error, error_en = excluded.error_en, actualizado = now();
  end if;
  return true;
end $function$;

/* Sólo el servidor (las funciones de Supabase entran con la service role). */
revoke all on function arca_ticket_pedir(text, text) from public, anon, authenticated;
revoke all on function arca_ticket_guardar(text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function arca_ticket_pedir(text, text) to service_role;
grant execute on function arca_ticket_guardar(text, text, text, text, timestamptz, text) to service_role;

notify pgrst, 'reload schema';


-- ═══ SQL 274 · ARCA, paso 2: la venta de PRUEBA A o B pide su factura electrónica (11/11/2026) ═══
-- Pedido de Mauricio (11/11): probar la factura electrónica desde el POS. Necesita el SQL 273 corrido antes.
--
-- Qué hace:
--  · Crea la tabla arca_comprobantes: cada pedido de factura a ARCA, con su número, su CAE o por qué no salió.
--    Sirve para no pedir dos veces la misma factura y para recuperar una que ARCA aprobó si se cortó internet
--    justo en el medio.
--  · Crea cuatro funciones:
--      arca_factura_preparar → la llama el POS (por el servidor) con la persona que entró: mira que pueda ver esa
--                              venta y arma lo que se le pide a ARCA (tipo, importes, documento, condición de IVA).
--      arca_factura_turno, arca_factura_numero, arca_factura_resultado → sólo el servidor: un pedido a ARCA por
--                              vez en cada punto de venta, el número y lo que contestó ARCA. Con la factura
--                              aprobada, la guarda en la venta (pos_ventas.factura), como ya espera la pantalla.
--  · POR AHORA SÓLO LAS VENTAS DE PRUEBA (Modo prueba) y contra el ARCA de prueba (homologación, sin valor fiscal).
--    Las ventas de verdad siguen exactamente igual: sin factura de ARCA (la hace BlueSoft).
--
-- Cómo se calcula: el total de la venta (con el interés de las cuotas, si hay) con IVA 21 % adentro.
-- Factura B: consumidor final (con DNI o CUIT si los tiene) o exento. Factura A: responsable inscripto o monotributo.
--
-- NO cambia ninguna tabla ni función que ya exista y NO cambia ningún dato. Se puede correr más de una vez.
-- Se deshace con deshacer-274.sql. Corre entero o nada.

do $$
begin
  if to_regclass('public.arca_tickets') is null then
    raise exception 'Primero hay que correr el SQL 273 (dónde se guarda el permiso de ARCA).';
  end if;
end $$;

create table if not exists arca_comprobantes (
  id           bigserial primary key,
  venta_id     uuid not null,
  ambiente     text not null check (ambiente in ('homologacion', 'produccion')),
  punto_venta  int not null check (punto_venta between 1 and 99998),
  tipo         int not null check (tipo in (1, 6)),   -- 1 = Factura A, 6 = Factura B (las notas de crédito, más adelante)
  numero       bigint check (numero > 0),
  estado       text not null check (estado in ('pidiendo', 'sin_respuesta', 'aprobado', 'rechazado')),
  pedido       jsonb not null,   -- lo que se le pidió a ARCA: importes, documento y condición de IVA
  fecha        text,             -- la fecha del comprobante, como ARCA (AAAAMMDD)
  cae          text,
  cae_vence    date,
  observaciones jsonb,
  errores      jsonb,
  error        text,             -- por qué no salió, en palabras
  intentos     int not null default 0,
  persona      uuid,             -- quién la pidió la última vez
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  constraint arca_comprobantes_aprobado check (estado <> 'aprobado' or (numero is not null and cae is not null and cae_vence is not null))
);
comment on table arca_comprobantes is 'Cada factura que se le pidió a ARCA, con su número y su CAE. Sólo el servidor. SQL 274.';
create unique index if not exists arca_comprobantes_venta on arca_comprobantes (venta_id);
create unique index if not exists arca_comprobantes_numero on arca_comprobantes (ambiente, punto_venta, tipo, numero) where estado = 'aprobado';
create index if not exists arca_comprobantes_abiertos on arca_comprobantes (ambiente, punto_venta, tipo) where estado in ('pidiendo', 'sin_respuesta');

alter table arca_comprobantes enable row level security;
revoke all on table arca_comprobantes from public, anon, authenticated;
revoke all on sequence arca_comprobantes_id_seq from public, anon, authenticated;

/* ── 1. Lo que se le pide a ARCA por una venta (la llama el POS, por el servidor, con la persona que entró) ── */
create or replace function arca_factura_preparar(p_venta uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v      pos_ventas;
  c      arca_comprobantes;
  v_pv   int;
  v_tipo int;
  v_doc  text;
  v_dt   int;
  v_dn   text;
  v_cond int;
  v_neto numeric;
  v_iva  numeric;
begin
  perform pos_permiso();
  select * into v from pos_ventas where id = p_venta;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  select * into c from arca_comprobantes where venta_id = p_venta;
  if found and c.estado = 'aprobado' then
    return jsonb_build_object('ya', true, 'factura', v.factura);
  end if;
  if v.letra not in ('A', 'B') then return jsonb_build_object('no_va', 'La X es un comprobante interno: no lleva factura electrónica.'); end if;
  if not v.prueba then
    return jsonb_build_object('no_va', 'Por ahora sólo las ventas de prueba piden la factura electrónica: la de verdad la hace BlueSoft.');
  end if;
  if v.estado <> 'cobrada' then return jsonb_build_object('no_va', 'La venta está anulada.'); end if;
  if coalesce(v.total, 0) <= 0 then return jsonb_build_object('no_va', 'La venta no tiene importe.'); end if;

  v_tipo := case v.letra when 'A' then 1 else 6 end;
  v_cond := case v.cliente_condicion when 'responsable_inscripto' then 1 when 'monotributo' then 6 when 'exento' then 4 else 5 end;
  /* Lo que ARCA acepta (FEParamGetCondicionIvaReceptor, 11/11): la A, a inscriptos y monotributistas; la B, a consumidor final y exentos. */
  if v.letra = 'A' and v_cond not in (1, 6) then
    return jsonb_build_object('error', 'ARCA no acepta factura A a un cliente exento: se le hace factura B.');
  end if;
  if v.letra = 'B' and v_cond not in (4, 5) then
    return jsonb_build_object('error', 'ARCA no acepta factura B a un cliente ' ||
      case v_cond when 1 then 'responsable inscripto' else 'monotributista' end || ': se le hace factura A, con su CUIT.');
  end if;
  v_doc := nullif(regexp_replace(coalesce(v.cliente_doc, ''), '[^0-9]', '', 'g'), '');
  if v.letra = 'A' or v_cond = 4 then
    if v_doc is null or length(v_doc) <> 11 then
      return jsonb_build_object('error', 'Para la factura ' || v.letra || ' hace falta el CUIT del cliente (11 números).');
    end if;
    v_dt := 80; v_dn := v_doc;
  elsif v_doc is not null and length(v_doc) = 11 then v_dt := 80; v_dn := v_doc;   -- consumidor final con CUIT
  elsif v_doc is not null and length(v_doc) between 7 and 8 then v_dt := 96; v_dn := v_doc;   -- con DNI
  else v_dt := 99; v_dn := '0';   -- consumidor final sin identificar
  end if;

  /* El punto de venta: el de la sucursal (Gestión → Sucursales); en el ARCA de prueba, si no tiene, el 1. */
  select s.punto_venta into v_pv from pos_sucursales s where s.local_id = v.local_id;
  v_pv := coalesce(v_pv, 1);
  /* Todo con IVA 21 % adentro: neto = total / 1,21. */
  v_neto := round(v.total / 1.21, 2);
  v_iva := v.total - v_neto;
  return jsonb_build_object(
    'venta_id', v.id, 'ambiente', 'homologacion', 'punto_venta', v_pv, 'tipo', v_tipo, 'persona', orden_yo_id(),
    'pedido', jsonb_build_object('doc_tipo', v_dt, 'doc_nro', v_dn, 'condicion_iva', v_cond,
                                 'total', v.total, 'neto', v_neto, 'iva', v_iva,
                                 'alicuotas', jsonb_build_array(jsonb_build_object('id', 5, 'base', v_neto, 'importe', v_iva))));
end $function$;

/* ── 2. El turno: un pedido a ARCA por vez en cada punto de venta y tipo (sólo el servidor) ── */
create or replace function arca_factura_turno(p_venta uuid, p_ambiente text, p_punto_venta int, p_tipo int, p_pedido jsonb, p_persona uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c      arca_comprobantes;
  v_pend bigint;
begin
  perform pg_advisory_xact_lock(hashtext('arca_turno:' || p_ambiente || ':' || p_punto_venta || ':' || p_tipo));
  select * into c from arca_comprobantes where venta_id = p_venta for update;
  if found and c.estado = 'aprobado' then
    return jsonb_build_object('ya', true, 'factura', (select v.factura from pos_ventas v where v.id = p_venta));
  end if;
  /* Otro pedido está hablando con ARCA en el mismo punto de venta y tipo (o esta misma venta, desde otra pantalla). */
  if exists (select 1 from arca_comprobantes x
              where x.ambiente = p_ambiente and x.punto_venta = p_punto_venta and x.tipo = p_tipo
                and x.estado = 'pidiendo' and x.actualizado > now() - interval '45 seconds') then
    return jsonb_build_object('esperar', true);
  end if;
  /* Un pedido anterior de esta venta quedó sin saber si ARCA lo aprobó: el servidor se lo pregunta a ARCA antes de pedir otro. */
  if found and c.numero is not null and c.estado in ('pidiendo', 'sin_respuesta')
     and c.ambiente = p_ambiente and c.punto_venta = p_punto_venta and c.tipo = p_tipo then
    v_pend := c.numero;
  end if;
  insert into arca_comprobantes (venta_id, ambiente, punto_venta, tipo, numero, estado, pedido, intentos, persona)
  values (p_venta, p_ambiente, p_punto_venta, p_tipo, v_pend, 'pidiendo', p_pedido, 1, p_persona)
  on conflict (venta_id) do update
    set ambiente = excluded.ambiente, punto_venta = excluded.punto_venta, tipo = excluded.tipo, numero = v_pend,
        estado = 'pidiendo', pedido = excluded.pedido, intentos = arca_comprobantes.intentos + 1,
        persona = excluded.persona, error = null, actualizado = now();
  return jsonb_build_object('ok', true, 'pendiente', v_pend);
end $function$;

/* ── 3. El número que se va a pedir (el último de ARCA + 1), antes de pedirlo ── */
create or replace function arca_factura_numero(p_venta uuid, p_numero bigint)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c arca_comprobantes;
begin
  select * into c from arca_comprobantes where venta_id = p_venta for update;
  if not found or c.estado <> 'pidiendo' then raise exception 'Ese pedido a ARCA ya no está abierto.'; end if;
  if p_numero is null or p_numero < 1 then raise exception 'El número no es válido.'; end if;
  if exists (select 1 from arca_comprobantes x where x.ambiente = c.ambiente and x.punto_venta = c.punto_venta and x.tipo = c.tipo
                                                  and x.numero = p_numero and x.estado = 'aprobado') then
    raise exception 'El número % ya es de otra factura.', p_numero;
  end if;
  update arca_comprobantes set numero = p_numero, actualizado = now() where venta_id = p_venta;
  return true;
end $function$;

/* ── 4. Lo que contestó ARCA. Aprobada: queda en la venta (pos_ventas.factura), como la espera la pantalla ── */
create or replace function arca_factura_resultado(p_venta uuid, p_estado text, p_numero bigint, p_fecha text, p_cae text, p_cae_vence text,
                                                  p_observaciones jsonb, p_errores jsonb, p_error text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c   arca_comprobantes;
  v_f jsonb;
  v_vence date;
begin
  if p_estado not in ('aprobado', 'rechazado', 'sin_respuesta') then raise exception 'El resultado no es válido.'; end if;
  select * into c from arca_comprobantes where venta_id = p_venta for update;
  if not found then raise exception 'Ese pedido a ARCA no existe.'; end if;
  if c.estado = 'aprobado' then
    return jsonb_build_object('ya', true, 'factura', (select v.factura from pos_ventas v where v.id = p_venta));
  end if;
  if p_estado = 'aprobado' then
    if p_numero is null or coalesce(p_cae, '') !~ '^\d{14}$' or coalesce(p_cae_vence, '') !~ '^\d{8}$' then
      raise exception 'ARCA aprobó la factura pero faltan el número o el CAE.';
    end if;
    v_vence := to_date(p_cae_vence, 'YYYYMMDD');
    update arca_comprobantes
       set estado = 'aprobado', numero = p_numero, fecha = p_fecha, cae = p_cae, cae_vence = v_vence,
           observaciones = p_observaciones, errores = p_errores, error = null, actualizado = now()
     where venta_id = p_venta;
    v_f := jsonb_build_object('cae', p_cae, 'cae_vence', to_char(v_vence, 'YYYY-MM-DD'),
                              'tipo', case c.tipo when 1 then 'A' else 'B' end, 'punto_venta', c.punto_venta, 'numero', p_numero,
                              'fecha', p_fecha, 'ambiente', c.ambiente);
    update pos_ventas set factura = v_f where id = p_venta;
    return jsonb_build_object('ok', true, 'factura', v_f);
  end if;
  update arca_comprobantes
     set estado = p_estado,
         numero = case when p_estado = 'sin_respuesta' then coalesce(p_numero, c.numero) end,   -- rechazada: el número no se usó
         observaciones = p_observaciones, errores = p_errores,
         error = left(coalesce(nullif(trim(p_error), ''), 'ARCA no aprobó la factura.'), 500), actualizado = now()
   where venta_id = p_venta;
  return jsonb_build_object('ok', false);
end $function$;

/* La primera, la persona que entró (el servidor la llama con su sesión); las otras tres, sólo el servidor. */
revoke all on function arca_factura_preparar(uuid) from public, anon;
grant execute on function arca_factura_preparar(uuid) to authenticated, service_role;
revoke all on function arca_factura_turno(uuid, text, int, int, jsonb, uuid) from public, anon, authenticated;
revoke all on function arca_factura_numero(uuid, bigint) from public, anon, authenticated;
revoke all on function arca_factura_resultado(uuid, text, bigint, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function arca_factura_turno(uuid, text, int, int, jsonb, uuid) to service_role;
grant execute on function arca_factura_numero(uuid, bigint) to service_role;
grant execute on function arca_factura_resultado(uuid, text, bigint, text, text, text, jsonb, jsonb, text) to service_role;

notify pgrst, 'reload schema';
