-- =====================================================================
-- Módulo VDH · Migración 51 (SQL 156), 22/10/2026: en el producto testigo,
-- el stock del sistema puede ser negativo. Pedido de Mauricio después del
-- primer control de Rivadavia (Cactus Over daba -5 y la app no lo dejaba
-- poner): "suele pasar, eso indica que hay algún error en el stock".
--   · Sólo el stock del sistema. Los demás números (enviada, cantidad real,
--     vendida, dev. a fábrica, salieron y entraron) siguen sin negativos.
--   · La diferencia y el desvío se calculan igual: stock − real. Con -5 en el
--     sistema y 12 contadas, sobran 17.
-- Reversible: deshacer-156.sql (frena si ya hay algún stock negativo cargado).
-- =====================================================================

-- La regla de la tabla (la compu escribe directo en ella): todo sin negativos, menos el stock.
alter table testigo_items drop constraint if exists testigo_items_no_negativos;
alter table testigo_items add constraint testigo_items_no_negativos check (coalesce(enviada, 0) >= 0
  and coalesce(cantidad_real, 0) >= 0 and coalesce(vendida, 0) >= 0 and dev_fabrica >= 0 and salieron >= 0 and entraron >= 0);

-- Como testigo_entero_, pero con signo ("-5"). Vacío es null.
create or replace function testigo_entero_signo_(p jsonb, k text) returns integer
language plpgsql immutable as $$
declare v text := nullif(trim(coalesce(p->>k, '')), '');
begin
  if v is null then return null; end if;
  if v !~ '^-?\d{1,5}$' then raise exception 'Revisá "%": tiene que ser un número entero', replace(k, '_', ' '); end if;
  return v::integer;
end $$;

-- La app carga con esta: igual que antes, salvo el stock del sistema.
create or replace function testigo_cargar(p_item uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i testigo_items; s testigo_semanas; r jsonb;
begin
  select * into i from testigo_items where id = p_item for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  select * into s from testigo_semanas where id = i.semana_id;
  perform testigo_abierto_(s);
  update testigo_items set
    enviada       = testigo_entero_(p_datos, 'enviada', true),
    stock_sistema = testigo_entero_signo_(p_datos, 'stock_sistema'),
    cantidad_real = testigo_entero_(p_datos, 'cantidad_real', true),
    vendida       = testigo_entero_(p_datos, 'vendida', true),
    dev_fabrica   = testigo_entero_(p_datos, 'dev_fabrica', false),
    salieron      = testigo_entero_(p_datos, 'salieron', false),
    entraron      = testigo_entero_(p_datos, 'entraron', false),
    observacion   = nullif(left(trim(coalesce(p_datos->>'observacion', '')), 300), ''),
    cargado_en    = now(),
    cargado_por   = orden_yo_id()
  where id = i.id;
  select to_jsonb(v) into r from testigo_v_items v where v.id = i.id;
  return r;
end $$;

do $$
begin
  revoke all on function testigo_entero_signo_(jsonb, text) from public, anon, authenticated;
  grant execute on function testigo_entero_signo_(jsonb, text) to service_role;
end $$;
