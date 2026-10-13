-- =====================================================================
-- Módulo VDH · Migración 15 (SQL 103, primera parte): sólo trabaja quien ya
-- está aprobado en la app.
--
-- Por qué (13/10/2026, al prender el reloj para probar): orden_trabaja decide
-- a quién le tocan los controles del día, el desafío y los avisos. Miraba si
-- la persona está activa, si el local abre y sus francos, pero no si ya usa la
-- app: Lautaro, Nano, Seba y Mel (cargados, sin entrar todavía) se iban a
-- llenar de controles vencidos y de avisos de "no mandó". Ahora, quien todavía
-- no está aprobado no "trabaja" para Impecable: su sector pasa al que cubre
-- (si él sí está aprobado) o no genera nada. El día que entran y los aprueban,
-- empiezan a recibir sus controles.
-- Reversible: volver a crear la función sin "and p.aprobado".
-- =====================================================================

create or replace function orden_trabaja(p_persona uuid, p_fecha date) returns boolean
language sql stable as $$
  select coalesce((
    select p.activo
       and p.aprobado
       and p.local_id is not null
       and orden_local_abre(p.local_id, p_fecha)
       and not (extract(isodow from p_fecha)::smallint = any(p.dias_libres))
       and not exists (select 1 from orden_ausencias a
                       where a.persona_id = p.id and p_fecha between a.desde and a.hasta)
    from orden_personas p where p.id = p_persona), false)
$$;
