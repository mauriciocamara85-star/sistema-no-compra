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
