-- ═══ SQL 96 (13/10/2026) · No Compra: el historial y los ajustes, sólo para los de adentro ═══
-- Va después del 95. Pegalo entero en el editor SQL de Supabase: corre como un
-- solo bloque. Se puede correr más de una vez.
--
-- Por qué: las reglas de `log` (el historial) y `ajustes` (el mail de avisos y
-- el grupo de Telegram) dejaban leer, y en ajustes también escribir, a
-- CUALQUIER sesión de Supabase. Cuando se escribieron, la única cuenta eras
-- vos. Desde Impecable cada vendedor tiene su cuenta (la crea la función
-- "entrar"), y cualquiera que se anote con el enlace, aunque esté sin aprobar,
-- recibe una sesión: con eso leía el historial del No Compra (con datos
-- personales de socios del club) y podía cambiar los ajustes. Lo encontró el
-- árbitro en la ronda 2 y lo comprobó contra la base real (sólo leyendo).
--
-- Qué cambia: leer el historial y leer o cambiar los ajustes queda para la
-- gente de la tabla `usuarios` (hoy, sólo vos), con la misma pregunta que ya
-- usa el sistema: mi_rol(). Dejar constancia en el historial sigue abierto
-- para todos, como antes. El panel del No Compra no lee estas tablas con la
-- sesión (escribe en log y los ajustes van por funciones con PIN): no cambia
-- nada de lo que ves.
--
-- Reversible: volver a crear las 4 reglas con "using (true)" (están en
-- supabase/politicas.sql de antes).

drop policy if exists "leer el historial" on log;
create policy "leer el historial" on log
  for select to authenticated using (mi_rol() is not null);

drop policy if exists "ver los ajustes" on ajustes;
create policy "ver los ajustes" on ajustes
  for select to authenticated using (mi_rol() is not null);

drop policy if exists "cambiar los ajustes" on ajustes;
create policy "cambiar los ajustes" on ajustes
  for insert to authenticated with check (mi_rol() is not null);

drop policy if exists "corregir un ajuste" on ajustes;
create policy "corregir un ajuste" on ajustes
  for update to authenticated using (mi_rol() is not null) with check (mi_rol() is not null);

select 'listo: el historial y los ajustes, sólo para los de adentro' as "SQL 96";
