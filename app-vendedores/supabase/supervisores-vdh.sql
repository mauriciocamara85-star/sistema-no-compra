-- Supervisores y administración de VDH (lo que pasó Mauricio el 14/10/2026). Va después de la migración 29 (SQL 120).
-- Se puede correr más de una vez: si ya están, no los duplica.
--   · Supervisores sin local fijo (eligen sus locales en la app y Mauricio los aprueba):
--     Franco Ortiz (Unicenter, Grand Bourg, Pacheco), Nicolás Segovia (Parque Brown, Lomas de Zamora),
--     Brenda Núñez (Flores, Morón, Ituzaingó) y Cintia (el apellido lo pone ella al crear su PIN).
--   · Antonella, administradora como Mauricio (el apellido lo pone ella al crear su PIN).
--   · Cuando cada uno cree su PIN, espera el OK de Mauricio (como siempre con el PIN nuevo).
insert into orden_personas (nombre, apellido, inicial, rol, local_id, aprobado, alta_propia)
select v.nombre, v.apellido, left(v.apellido, 1), v.rol::orden_rol, null, true, false
  from (values ('Franco', 'Ortiz', 'supervisor'), ('Nicolás', 'Segovia', 'supervisor'), ('Brenda', 'Núñez', 'supervisor'),
               ('Cintia', null, 'supervisor'), ('Antonella', null, 'admin')) v(nombre, apellido, rol)
 where not exists (select 1 from orden_personas p where p.local_id is null and lower(p.nombre) = lower(v.nombre) and p.rol::text = v.rol);
-- Sin PIN todavía: con la fila vacía aparecen en la lista para crearlo.
insert into orden_pins (persona_id, hash)
select p.id, null from orden_personas p
 where p.local_id is null and p.activo and (p.nombre, p.rol::text) in (('Franco', 'supervisor'), ('Nicolás', 'supervisor'), ('Brenda', 'supervisor'),
                                                                        ('Cintia', 'supervisor'), ('Antonella', 'admin'))
on conflict (persona_id) do nothing;
