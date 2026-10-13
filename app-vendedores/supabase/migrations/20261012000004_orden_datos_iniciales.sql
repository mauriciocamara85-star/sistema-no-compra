-- =====================================================================
-- Módulo VDH · Migración 4: datos iniciales
--   · Reglas de orden (las que dio Mau, editables después desde No Compra)
--   · Regla de colores (PROPUESTA: Mau tiene que confirmar el orden)
--   · Tipos de exhibidor (falta cargar mínimo y máximo de prendas)
--   · Local piloto Rivadavia (en No Compra: MAR DEL PLATA) con su
--     equipo, sectores y módulos
-- Todo se puede cambiar después desde la configuración.
-- =====================================================================

-- ---------- Reglas de orden (todos los locales) ----------
insert into orden_reglas (sector_tipo, check_clave, texto, orden) values
  ('salon', 'frontales',  'Cada frontal lleva 4 prendas.', 1),
  ('salon', 'frontales',  'La prenda del frontal también tiene que estar doblada en un estante del mismo módulo (por ejemplo, del lado izquierdo, en el estante del medio).', 2),
  ('salon', 'frontales',  'Si no hay más stock para completar un frontal, se cambia por otro producto. Nunca se deja incompleto.', 3),
  ('salon', 'dobladas',   'Prendas dobladas prolijas, del mismo tamaño, en pilas parejas y derechas.', 1),
  ('salon', 'dobladas',   'Estantes sin huecos: no puede faltar mercadería en un estante.', 2),
  ('salon', 'etiquetas',  'Etiquetas adentro de la prenda, sin que cuelguen.', 1),
  ('salon', 'limpieza',   'Módulo limpio: sin polvo, bolsas, cajas, perchas sueltas, vasos ni cosas personales a la vista.', 1),
  ('salon', 'exhibicion', 'Percheros de colección nueva ordenados por color, en degradé del más claro al más oscuro (ver regla de colores).', 1),
  ('salon', 'exhibicion', 'En los estantes de arriba de un perchero van los mismos colores que las prendas colgadas.', 2),
  ('salon', 'exhibicion', 'Cada exhibidor tiene una cantidad ideal de prendas: ni muy lleno ni muy vacío.', 3),
  ('deposito', 'dobladas',  'Prendas dobladas en tamaño A4 parejo.', 1),
  ('deposito', 'talles',    'Separado por segmento (tipo de prenda) y por talle.', 1),
  ('deposito', 'rotulado',  'Estantes o cajas rotulados y que se lean bien.', 1),
  ('deposito', 'limpieza',  'Pasillos libres, sin cajas abiertas desordenadas y limpio.', 1);

-- ---------- Regla de colores (PROPUESTA, del más claro al más oscuro) ----------
insert into orden_colores (orden, nombre, hex) values
  (1,  'Blanco',               '#FFFFFF'),
  (2,  'Crudo / natural',      '#EFE8D8'),
  (3,  'Beige / arena',        '#D9C7A7'),
  (4,  'Gris claro / melange', '#C9CACC'),
  (5,  'Celeste',              '#A9C8E4'),
  (6,  'Camel',                '#B98A54'),
  (7,  'Gris topo',            '#7E7770'),
  (8,  'Verde oliva / militar','#6B6B3A'),
  (9,  'Azul',                 '#2F4F8F'),
  (10, 'Bordó',                '#6D1F2B'),
  (11, 'Marrón / chocolate',   '#4E3527'),
  (12, 'Gris oscuro / grafito','#3C3F44'),
  (13, 'Azul marino',          '#1F2A44'),
  (14, 'Negro',                '#111111');

-- ---------- Tipos de exhibidor (Mau pasa las cantidades) ----------
insert into orden_exhibidores (nombre, prendas_min, prendas_max, notas) values
  ('Módulo con estantes',          null, null, 'Frontales de 4 prendas.'),
  ('Perchero de colección nueva',  null, null, 'Por color, en degradé.'),
  ('Perchero de pared',            null, null, null),
  ('Mesa',                         null, null, null);

-- ---------- Local piloto: Rivadavia ----------
-- En la app se muestra "Rivadavia"; en No Compra es MAR DEL PLATA (codigo) desde el 24/09/2026.
-- Abre todos los días: lunes a sábado de 9 a 21 y domingo de 10 a 21
-- (acá va un solo horario: 9 a 21).
-- Francos (ISO: 1 = lunes ... 7 = domingo): Seba el martes, Nano el miércoles,
-- Lautaro el jueves. Mel es el franquero: trabaja solo martes, miércoles y
-- jueves, y cubre el sector del que tiene franco.
-- El supervisor del local es Mauricio (admin: ve y revisa todos los locales).
-- Las iniciales del apellido (para la lista del login) se cargan después.
do $$
declare
  v_local uuid; v_lautaro uuid; v_nano uuid; v_seba uuid; v_mel uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_d1 uuid; v_d2 uuid; v_d3 uuid; v_ex uuid; n int;
begin
  insert into orden_locales (nombre, codigo, dias_abiertos, hora_apertura, hora_cierre)
  values ('Rivadavia', 'MAR DEL PLATA', '{1,2,3,4,5,6,7}', '09:00', '21:00') returning id into v_local;
  insert into orden_config (local_id) values (v_local);

  -- equipo_id: la misma persona en el equipo de la Carga de No Compra
  insert into orden_personas (nombre, rol, local_id) values ('Mauricio', 'admin', null);
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Lautaro', 'vendedor', v_local, '{4}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) in ('lau', 'lautaro') order by id limit 1))
    returning id into v_lautaro;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Nano', 'vendedor', v_local, '{3}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'nano' order by id limit 1))
    returning id into v_nano;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Seba', 'vendedor', v_local, '{2}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'seba' order by id limit 1))
    returning id into v_seba;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Mel', 'vendedor', v_local, '{1,5,6,7}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'mel' order by id limit 1))
    returning id into v_mel;

  -- Salón: sector 1 Lautaro, 2 Nano, 3 Seba. Mel (franquero) cubre al que no está.
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 1, v_lautaro, v_mel) returning id into v_s1;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 2, v_nano, v_mel) returning id into v_s2;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 3, v_seba, v_mel) returning id into v_s3;

  -- Depósito: sector 1 Nano, 2 Lautaro, 3 Seba
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 1, v_nano, v_mel) returning id into v_d1;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 2, v_lautaro, v_mel) returning id into v_d2;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 3, v_seba, v_mel) returning id into v_d3;

  -- 15 módulos del salón (5 por sector), numerados 1 a 15 en el local
  select id into v_ex from orden_exhibidores where nombre = 'Módulo con estantes';
  for n in 1..15 loop
    insert into orden_modulos (sector_id, numero, nombre, exhibidor_id)
    values (case when n <= 5 then v_s1 when n <= 10 then v_s2 else v_s3 end, n, 'Módulo ' || n, v_ex);
  end loop;

  -- Un "módulo" por sector del depósito (una foto por semana)
  insert into orden_modulos (sector_id, numero, nombre) values (v_d1, 1, 'Depósito sector 1');
  insert into orden_modulos (sector_id, numero, nombre) values (v_d2, 1, 'Depósito sector 2');
  insert into orden_modulos (sector_id, numero, nombre) values (v_d3, 1, 'Depósito sector 3');
end $$;

-- La fila que quedó de cuando el local se llamaba RIVADAVIA: se desactiva, no se borra (pedido de Mauricio)
update equipo set activo = false where local = 'RIVADAVIA' and vendedor = 'Mau';
