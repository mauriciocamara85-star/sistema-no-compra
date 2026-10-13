-- =====================================================================
-- Módulo VDH · Migración 3: el reloj automático (solo en Supabase)
--
-- ANTES de correr esto, guardar dos secretos en Vault (SQL Editor):
--   select vault.create_secret('https://<PROYECTO>.supabase.co/functions/v1', 'orden_functions_url');
--   select vault.create_secret('<UNA CLAVE LARGA INVENTADA>', 'orden_cron_secret');
-- La misma clave va como variable ORDEN_CRON_SECRET en las Edge Functions.
--
-- pg_cron corre en UTC. Argentina es UTC-3 (sin horario de verano).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cada 15 minutos: genera controles, avisos, vencimientos, escaladas y faltas sugeridas
select cron.schedule('orden-tick', '*/15 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/tick',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);

-- Todas las noches 23:30 de Argentina (02:30 UTC): cómo dieron las cajas, al grupo de Telegram
-- (solo manda si algún local tiene el control de caja prendido)
select cron.schedule('orden-resumen-cajas', '30 2 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/resumen-cajas',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);

-- Lunes 08:30 de Argentina (11:30 UTC): resumen de la semana anterior por Telegram
select cron.schedule('orden-resumen-semanal', '30 11 * * 1', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'orden_functions_url') || '/resumen-semanal',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-orden-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orden_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);
