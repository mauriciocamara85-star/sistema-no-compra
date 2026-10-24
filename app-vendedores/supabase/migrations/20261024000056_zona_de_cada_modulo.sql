-- ════════════════════════════════════════════════════════════════════════
-- Migración 56 (SQL 168, 24/10/2026, pedido de Mauricio): la zona de cada
-- módulo, el paso 2 del plan de visual merchandising (para que después la
-- IA sugiera qué va en cada módulo según dónde está).
--   · La zona sale sola del croquis, en la app (zonasDelPlano, en
--     impecable-comun.js): vidriera, entrada, zona caliente, zona media,
--     fondo, y caja y probadores.
--   · El supervisor del local (o Administración) la cambia en la ficha del
--     módulo, en el modo observador: queda en orden_modulos.zona. null es
--     la del croquis. La vidriera y el depósito no tienen zona para elegir.
--   · No cambia nada de lo de antes: la columna arranca vacía en todos los
--     módulos (todos con la del croquis).
-- Se puede correr más de una vez.
-- Reversible:
--   drop function orden_modulo_zona(uuid, text);
--   alter table orden_modulos drop column zona;
-- ════════════════════════════════════════════════════════════════════════

-- 1. La zona elegida a mano (null: la del croquis)
alter table orden_modulos add column if not exists zona text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orden_modulos_zona_check' and conrelid = 'orden_modulos'::regclass) then
    alter table orden_modulos add constraint orden_modulos_zona_check
      check (zona is null or zona in ('entrada', 'caliente', 'media', 'fondo', 'caja'));
  end if;
end $$;
comment on column orden_modulos.zona is 'La zona del salón que eligió el supervisor (entrada, caliente, media, fondo, caja); null: la que sale del croquis (zonasDelPlano, en la app)';

-- 2. Cambiarla: el supervisor del local o Administración, en el salón y fuera de la vidriera.
--    '' o 'auto' vuelven a la del croquis. Devuelve la que quedó (null: la del croquis).
create or replace function orden_modulo_zona(p_modulo uuid, p_zona text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; s orden_sectores; v_zona text := nullif(lower(trim(coalesce(p_zona, ''))), '');
begin
  if v_zona = 'auto' then v_zona := null; end if;
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  select * into s from orden_sectores where id = m.sector_id;
  if not orden_es_supervisor_de(s.local_id) then
    raise exception 'La zona la cambia el supervisor del local o Administración';
  end if;
  if s.tipo = 'deposito' then raise exception 'El depósito no tiene zonas: son del salón'; end if;
  if orden_lado_modulo(m.id) = 'vidriera' then raise exception 'La vidriera es siempre la vidriera: no tiene otra zona'; end if;
  if v_zona is not null and v_zona not in ('entrada', 'caliente', 'media', 'fondo', 'caja') then
    raise exception 'Esa zona no existe';
  end if;
  update orden_modulos set zona = v_zona where id = m.id;
  return v_zona;
end $$;
revoke all on function orden_modulo_zona(uuid, text) from public, anon;
grant execute on function orden_modulo_zona(uuid, text) to authenticated, service_role;
