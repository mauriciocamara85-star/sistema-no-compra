-- ═══ SQL 94 (12/10/2026) · Impecable: PRENDER EL RELOJ ═══
-- ⚠ Correrlo recién EL DÍA QUE LOS VENDEDORES EMPIEZAN a usar la app, y
--   después de subir las Edge Functions tick, resumen-cajas y resumen-semanal.
--   Desde ese momento se generan los controles y salen los avisos solos.
-- Va después del 93. Pegalo entero en el editor SQL de Supabase. Se puede
-- correr más de una vez. Para apagarlo, ver "PARA APAGARLO" más abajo.

-- =====================================================================
-- Módulo VDH · Migración 10 (SQL 94): PRENDER EL RELOJ de Impecable
--
-- Reemplaza a la migración 3 del paquete. Correrlo EL DÍA QUE LOS VENDEDORES
-- EMPIEZAN: desde ese momento, cada 15 minutos se generan los controles, salen
-- los avisos, vencen las tareas atrasadas, etc. Antes de correrlo tienen que
-- estar subidas las Edge Functions tick, resumen-cajas y resumen-semanal.
--
--   · Guarda en el Vault la dirección de las funciones y una clave al azar para
--     el reloj (nadie tiene que copiarla: las funciones la comparan acá, con
--     orden_cron_ok).
--   · orden_telegram_token(): las funciones leen el token del bot del No Compra
--     (Vault, TELEGRAM_TOKEN) para mandar los resúmenes y avisos por Telegram.
--   · Tres relojes con pg_cron (pg_cron corre en UTC; Argentina es UTC-3):
--       orden-tick              cada 15 minutos
--       orden-resumen-cajas     23:30 de Argentina (02:30 UTC)
--       orden-resumen-semanal   lunes 08:30 de Argentina (11:30 UTC)
--
-- Se puede correr más de una vez (no duplica relojes ni claves).
-- PARA APAGARLO (deshacer):
--   select cron.unschedule(jobname) from cron.job where jobname like 'orden-%';
-- y si además se quiere borrar todo:
--   delete from vault.secrets where name in ('orden_functions_url', 'orden_cron_secret');
--   drop function orden_cron_ok(text); drop function orden_telegram_token();
-- =====================================================================

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'orden_functions_url') then
    perform vault.create_secret('https://gfjdjupuwxohkgchqykx.supabase.co/functions/v1', 'orden_functions_url',
                                'Impecable: dirección de las Edge Functions');
  end if;
  if not exists (select 1 from vault.secrets where name = 'orden_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'orden_cron_secret',
                                'Impecable: clave que manda el reloj a las Edge Functions');
  end if;
end $$;

-- ¿Es la clave del reloj? (la usan las Edge Functions con la clave de servicio)
create or replace function orden_cron_ok(p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_clave, '') <> ''
     and exists (select 1 from vault.decrypted_secrets where name = 'orden_cron_secret' and decrypted_secret = p_clave)
$$;

-- El token del bot de Telegram del No Compra (sólo para las Edge Functions)
create or replace function orden_telegram_token() returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'TELEGRAM_TOKEN' limit 1
$$;

do $$
begin
  revoke all on function orden_cron_ok(text) from public, anon, authenticated;
  revoke all on function orden_telegram_token() from public, anon, authenticated;
  grant execute on function orden_cron_ok(text) to service_role;
  grant execute on function orden_telegram_token() to service_role;
end $$;

-- Los relojes: si ya estaban, se reemplazan (no quedan dos).
select cron.unschedule(jobid) from cron.job where jobname in ('orden-tick', 'orden-resumen-cajas', 'orden-resumen-semanal');

select cron.schedule('orden-tick', '*/15 * * * *', $c$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/tick',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$c$);

select cron.schedule('orden-resumen-cajas', '30 2 * * *', $c$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/resumen-cajas',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$c$);

select cron.schedule('orden-resumen-semanal', '30 11 * * 1', $c$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/resumen-semanal',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$c$);

select 'listo: el reloj de Impecable está prendido' as "SQL 94";
