-- =====================================================================
-- Módulo VDH · Migración 19 (SQL 111): los tableros de Ideas no guardan
-- el enlace para invitar a editarlos.
--
-- Revisión 2 de la reorganización de Equipo VDH (13/10/2026): el enlace de
-- "Compartir" de Pinterest (pin.it, o con invite_code) deja sumarse a
-- editar el tablero, y la columna url de orden_tableros la puede leer
-- cualquiera con sesión. Así que ese enlace no se guarda nunca: al de
-- invitación se le saca lo que va después del "?" (queda la dirección del
-- tablero) y un pin.it se rechaza con un mensaje claro. Los que ya estaban
-- guardados se limpian igual; un pin.it se apaga y queda sin enlace.
-- (La administración y la app ya no los usan: esto es lo que lo asegura.)
-- Reversible: drop trigger orden_tableros_sin_invitacion on orden_tableros;
-- drop function orden_tableros_sin_invitacion(). No borra datos.
-- =====================================================================

create or replace function orden_tableros_sin_invitacion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.url ~* '^https?://(www\.)?pin\.it/' then
    raise exception 'Ese enlace es para invitar a editar el tablero: pegá la dirección del tablero (por ejemplo https://ar.pinterest.com/usuario/tablero/)';
  end if;
  if new.url ~* 'pinterest\.[a-z.]+/.*[?&](invite_code|invite|board_collab_inviter|inviter_user_id|sender)=' then
    new.url := regexp_replace(new.url, '[?#].*$', '');
  end if;
  return new;
end $$;
drop trigger if exists orden_tableros_sin_invitacion on orden_tableros;
create trigger orden_tableros_sin_invitacion before insert or update of url on orden_tableros
  for each row execute function orden_tableros_sin_invitacion();

-- Los que ya estaban guardados.
update orden_tableros set url = regexp_replace(url, '[?#].*$', '')
 where url ~* 'pinterest\.[a-z.]+/.*[?&](invite_code|invite|board_collab_inviter|inviter_user_id|sender)=';
update orden_tableros set url = 'https://www.pinterest.com/', activo = false where url ~* '^https?://(www\.)?pin\.it/';
