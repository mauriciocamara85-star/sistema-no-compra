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


-- ═══ SQL 276 · ARCA de prueba en las ventas NORMALES de Rivadavia (11/11/2026) ═══
-- Pedido de Mauricio (11/11): «habilitalo, que los chicos vayan cargando venta normal, y probemos a ver si funciona bien
-- lo de ARCA». Necesita los SQL 273 y 274 corridos antes.
--
-- Qué hace:
--  · A cada sucursal le agrega si hace la factura electrónica y contra qué ARCA (pos_sucursales.arca: vacío = no la hace,
--    'homologacion' = el ARCA de prueba, 'produccion' = el de verdad) y desde cuándo (arca_desde).
--  · RIVADAVIA: punto de venta 34 (el de BlueSoft, de su factura B del 11/11) y el ARCA DE PRUEBA desde que se corre este
--    SQL. Cada venta A o B que se guarde ahí le pide su factura al ARCA de prueba: SIN VALOR FISCAL. La factura que vale la
--    sigue haciendo BlueSoft. Las ventas de antes no se tocan.
--  · Cambia cinco funciones para que el CAE de prueba no trabe nada:
--      arca_factura_preparar     → las ventas normales de la sucursal habilitada, desde arca_desde (antes, sólo las de prueba).
--      pos_inicio                → el POS sabe qué sucursal factura y desde cuándo.
--      pos_iva_ventas            → el CAE de prueba NO aparece en el reporte IVA Ventas (no es una factura).
--      pos_venta_pagos_corregir  → «Corregir el pago» sigue andando en una venta con CAE de prueba.
--      pos_nc_hacer              → la nota de crédito de una venta con CAE de prueba sigue diciendo que la que vale se
--                                  hace en BlueSoft.
--
-- NO borra nada. Se puede correr más de una vez. Se deshace con deshacer-276.sql. Corre entero o nada.

do $$
begin
  if to_regclass('public.arca_comprobantes') is null then
    raise exception 'Primero hay que correr los SQL 273 y 274 (ARCA).';
  end if;
end $$;

alter table pos_sucursales add column if not exists arca text;
alter table pos_sucursales add column if not exists arca_desde timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pos_sucursales_arca_check') then
    alter table pos_sucursales add constraint pos_sucursales_arca_check check (arca in ('homologacion', 'produccion'));
  end if;
end $$;

update pos_sucursales
   set punto_venta = 34, arca = 'homologacion', arca_desde = coalesce(arca_desde, now()), actualizado_en = now()
 where local_id = '7ce69820-6c1b-48a2-bdaa-4a546f448522';
do $$
begin
  if not exists (select 1 from pos_sucursales where local_id = '7ce69820-6c1b-48a2-bdaa-4a546f448522' and arca = 'homologacion' and punto_venta = 34) then
    raise exception 'No encontré la sucursal Rivadavia en Gestión → Sucursales.';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.arca_factura_preparar(p_venta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v       pos_ventas;
  c       arca_comprobantes;
  v_pv    int;
  v_amb   text;
  v_desde timestamptz;
  v_tipo  int;
  v_doc   text;
  v_dt    int;
  v_dn    text;
  v_cond  int;
  v_neto  numeric;
  v_iva   numeric;
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
  /* SQL 276: la sucursal dice si factura y contra qué ARCA (pos_sucursales.arca), y desde cuándo (arca_desde): lo de antes
     lo facturó BlueSoft y no se vuelve a facturar. La venta de prueba (Modo prueba), siempre contra el ARCA de prueba. */
  select s.punto_venta, s.arca, s.arca_desde into v_pv, v_amb, v_desde from pos_sucursales s where s.local_id = v.local_id;
  if v.prueba then
    v_amb := 'homologacion';
  elsif v_amb is null then
    return jsonb_build_object('no_va', 'Esta sucursal todavía no hace la factura electrónica: la hace BlueSoft.');
  elsif v_desde is not null and v.fecha < v_desde then
    return jsonb_build_object('no_va', 'Es de antes de que la sucursal empezara con la factura electrónica (' ||
      to_char(v_desde at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') || '): esa la hizo BlueSoft.');
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

  /* El punto de venta: el de la sucursal (Gestión → Configuración → Sucursales). En el ARCA de prueba, si no tiene, el 1;
     en el de verdad es obligatorio. */
  if v_pv is null and v_amb = 'produccion' then
    return jsonb_build_object('error', 'Falta el punto de venta de ARCA de la sucursal (Gestión → Configuración → Sucursales).');
  end if;
  v_pv := coalesce(v_pv, 1);
  /* Todo con IVA 21 % adentro: neto = total / 1,21. */
  v_neto := round(v.total / 1.21, 2);
  v_iva := v.total - v_neto;
  return jsonb_build_object(
    'venta_id', v.id, 'ambiente', v_amb, 'punto_venta', v_pv, 'tipo', v_tipo, 'persona', orden_yo_id(),
    'pedido', jsonb_build_object('doc_tipo', v_dt, 'doc_nro', v_dn, 'condicion_iva', v_cond,
                                 'total', v.total, 'neto', v_neto, 'iva', v_iva,
                                 'alicuotas', jsonb_build_array(jsonb_build_object('id', 5, 'base', v_neto, 'importe', v_iva))));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_inicio()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not pos_puede('fabrica') then perform pos_permiso(); end if;   -- SQL 256: también quien tiene sólo la Fábrica
  return jsonb_build_object(
    /* SQL 190: su local y lo que puede en el POS (las casillas de Config → Usuarios). */
    'yo', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'local_id', p.local_id) from orden_personas p where p.id = orden_yo_id()),
    'puede', pos_mis_permisos(),
    'hoy', pos_hoy(),
    'locales', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo,
                                          'lista_id', s.lista_id, 'habilitada', coalesce(s.habilitada, false),
                                          'punto_venta', s.punto_venta,
                                          'arca', s.arca, 'arca_desde', s.arca_desde) order by l.nombre)   -- SQL 276
        from orden_locales l left join pos_sucursales s on s.local_id = l.id
       where l.activo), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'base_id', x.base_id, 'ajuste', x.ajuste,
                                          'redondeo', x.redondeo,
                                          'propios', (select count(*) from pos_precios p where p.lista_id = x.id)) order by x.id)
        from pos_listas x where x.activo), '[]'::jsonb),
    'promos', coalesce((select jsonb_agg(to_jsonb(pr) - 'creado_en' order by pr.orden, pr.id) from pos_promos pr), '[]'::jsonb),
    /* SQL 171: el Club en la venta. "suma": si el POS suma los puntos (la regla pos_suma_puntos). */
    'club', jsonb_build_object(
      'suma', coalesce((select valor from club_reglas where clave = 'pos_suma_puntos'), 'no') = 'si',
      'pesos_por_punto', coalesce((select nullif(valor, '')::numeric from club_reglas where clave = 'pesos_por_punto'), 100)),
    /* Los vendedores de cada local: el equipo del No Compra (los mismos nombres que la Carga). */
    'vendedores', coalesce((
      select jsonb_object_agg(l.id, coalesce(v.nombres, '[]'::jsonb))
        from orden_locales l
        left join lateral (
          select jsonb_agg(q.n order by q.n) nombres
            from (select distinct trim(e.vendedor) n from equipo e
                   where e.activo and lower(trim(e.local)) = lower(trim(l.codigo)) and trim(e.vendedor) <> '') q
        ) v on true
       where l.activo), '{}'::jsonb)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_iva_ventas(p_desde date, p_hasta date, p_local uuid DEFAULT NULL::uuid, p_letra text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pos_permiso();
  perform pos_local_ok(p_local);   -- su local y, sin «Ver otros días», hoy (SQL 190)
  perform pos_dias_ok(p_desde);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El período no es válido.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'El período es demasiado largo (máximo, un año).'; end if;
  if p_letra is not null and p_letra not in ('A', 'B') then raise exception 'En el IVA van sólo las facturas A y B.'; end if;
  return (
    with z as (
      select 'ticket'::text tipo, v.id venta_id, v.local_id, v.fecha, v.dia, v.letra, v.numero, null::int nc,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, v.total,
             /* SQL 276: el CAE del ARCA de prueba no es una factura: no va en el IVA. */
             case when v.factura->>'ambiente' = 'homologacion' then null else nullif(v.factura->>'cae', '') end cae
        from pos_ventas v
       where v.dia between p_desde and p_hasta
         and not v.prueba
         and v.letra in ('A', 'B')
         and (v.estado = 'cobrada' or exists (select 1 from pos_notas_credito n where n.venta_id = v.id))
         and (p_local is null or v.local_id = p_local)
         and (p_letra is null or v.letra = p_letra)
      union all
      select 'nc', v.id, n.local_id, n.fecha, n.dia, n.letra, v.numero, n.numero,
             v.cliente_nombre, v.cliente_doc, v.cliente_condicion, -v.total, n.cae
        from pos_notas_credito n join pos_ventas v on v.id = n.venta_id
       where n.dia between p_desde and p_hasta
         and not n.prueba
         and (p_local is null or n.local_id = p_local)
         and (p_letra is null or n.letra = p_letra)
    ),
    y as (select z.*, round(z.total / 1.21, 2) base from z)
    select jsonb_build_object(
      'filas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'tipo', y.tipo, 'venta_id', y.venta_id, 'fecha', y.fecha, 'dia', y.dia, 'letra', y.letra, 'numero', y.numero, 'nc', y.nc,
                 'local', l.nombre, 'local_id', y.local_id, 'cliente', coalesce(y.cliente_nombre, 'Consumidor final'), 'doc', y.cliente_doc,
                 'condicion', y.cliente_condicion, 'base', y.base, 'iva', y.total - y.base, 'total', y.total, 'cae', y.cae)
                 order by y.fecha, y.tipo desc)
          from (select * from y order by fecha, tipo desc limit 20000) y join orden_locales l on l.id = y.local_id), '[]'::jsonb),
      'totales', (select jsonb_build_object('tickets', count(*) filter (where tipo = 'ticket'), 'notas', count(*) filter (where tipo = 'nc'),
                                            'base', coalesce(sum(base), 0), 'iva', coalesce(sum(total - base), 0), 'total', coalesce(sum(total), 0))
                    from y),
      'mas', (select count(*) > 20000 from y)
    )
  );
end $function$;

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
  /* SQL 276: con el CAE del ARCA de prueba (sin valor fiscal) sí se corrige: la factura que vale la hace BlueSoft. */
  if v.factura is not null and coalesce(v.factura->>'ambiente', '') <> 'homologacion' then
    raise exception 'Esa venta tiene factura de ARCA: el medio de pago no se corrige acá.';
  end if;
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

CREATE OR REPLACE FUNCTION public.pos_nc_hacer(p_venta uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v pos_ventas; n pos_notas_credito; k pos_cierres; v_num int; v_id uuid; v_ref text;
begin
  perform pos_permiso('anular');
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribí por qué se hace la nota de crédito.'; end if;
  select * into v from pos_ventas where id = p_venta;
  if not found then raise exception 'No existe esa venta.'; end if;
  perform pos_local_ok(v.local_id);
  /* Un número por vez en cada local: si dos la hacen al mismo tiempo, el segundo espera (primero el candado, después la venta). */
  perform pg_advisory_xact_lock(hashtext('pos_nc:' || v.local_id::text || ':' || v.prueba::text));
  select * into v from pos_ventas where id = p_venta for update;
  select * into n from pos_notas_credito where venta_id = p_venta;
  if found then raise exception 'Esa venta ya tiene la nota de crédito %.', case when n.prueba then 'NCP-' else 'NC-' end || n.numero; end if;
  if v.estado = 'anulada' then raise exception 'Esa venta ya está anulada.'; end if;
  if v.letra = 'X' then raise exception 'La X es un comprobante interno: no lleva nota de crédito. Se anula con «Anular la venta».'; end if;
  if v.cierre_id is not null then
    select * into k from pos_cierres where id = v.cierre_id;
    raise exception 'Esa venta ya entró en el cierre de caja %: para hacerle la nota de crédito, primero hay que anular ese cierre.',
      case when k.prueba then 'P-' else 'Nº ' end || k.numero;
  end if;
  select coalesce(max(x.numero), 0) + 1 into v_num from pos_notas_credito x where x.local_id = v.local_id and x.prueba = v.prueba;
  v_ref := case when v.prueba then 'NCP-' else 'NC-' end || v_num;
  insert into pos_notas_credito (venta_id, local_id, numero, prueba, letra, dia, hizo, motivo, arca)
  values (v.id, v.local_id, v_num, v.prueba, v.letra, pos_hoy(), orden_yo_id(), trim(p_motivo),
          /* SQL 276: con el CAE del ARCA de prueba, la nota que vale se hace en BlueSoft (como sin factura). */
          case when v.prueba then 'no_va'
               when v.factura is not null and coalesce(v.factura->>'ambiente', '') <> 'homologacion' then 'pendiente'
               else 'sin_factura' end)
  returning id into v_id;
  perform pos_venta_deshacer(v.id, p_motivo, v_ref);
  return jsonb_build_object('id', v_id, 'numero', v_num, 'prueba', v.prueba, 'venta_id', v.id);
end $function$;

notify pgrst, 'reload schema';
