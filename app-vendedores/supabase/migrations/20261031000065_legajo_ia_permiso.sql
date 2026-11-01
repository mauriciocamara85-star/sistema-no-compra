-- =====================================================================
-- Módulo VDH · Migración 65 (SQL 220), 31/10/2026: el permiso que le faltó
-- al 219.
--
-- La función leer-papel anota cada lectura de la IA en orden_legajo_lecturas
-- con el rol de servicio. En esta base el rol de servicio no recibe permisos
-- solo en las tablas nuevas (cada migración se los da, como el esquema y las
-- cajas), y el 219 no se lo dio: la IA completaba el formulario, pero lo
-- leído no quedaba guardado con el papel ("Lo que leyó la IA" no aparecía).
-- Lo encontró la prueba con la IA de verdad, después de correr el 219.
--
-- Sólo da ese permiso; la tabla sigue cerrada para la app (anon y
-- authenticated). No cambia ningún dato. Se puede correr dos veces.
-- Reversible: deshacer-220.sql.
-- =====================================================================

grant all on table orden_legajo_lecturas to service_role;
