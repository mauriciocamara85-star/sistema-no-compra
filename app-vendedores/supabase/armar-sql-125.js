/* Arma correr-en-supabase-125.sql: la cabecera para Mauricio + la migración 34 + el arreglo de hoy en Rivadavia. */
const fs = require('fs');
const path = require('path');
const mig = fs.readFileSync(path.join(__dirname, 'migrations/20261015000034_ia_lado_y_liquidacion.sql'), 'utf8').replace(/\r\n/g, '\n');

const cabecera = `-- ═══ SQL 125 (15/10/2026) · Equipo VDH: el degradé según el lado del local, y los módulos de liquidación ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · La IA va a saber de qué lado del local está cada módulo (sale del croquis): en la pared izquierda el degradé
--     arranca con el más claro a la izquierda; en la derecha, a la derecha (como lo ve el cliente que entra).
--     En el fondo, el frente, el centro y la vidriera puede arrancar de cualquier lado.
--   · Un módulo se puede marcar "de liquidación" (va por talle): ahí la IA no pide degradé.
--   · Se cancelan las tareas de degradé que la IA le creó hoy a Nano por error en la pared derecha
--     (módulos 15 a 18; si a Seba le salió alguna igual en el 11 a 14, también).
--   · Hasta que suba la IA nueva, esto no cambia nada de lo que ves: la IA de hoy ignora los datos nuevos.
--   · Reversible (el detalle está abajo). Las tareas canceladas, no hace falta volverlas: estaban mal.

`;

const hoy = `

-- 5. Sólo hoy, en Rivadavia: las tareas de degradé que la IA creó mal en la pared derecha, canceladas.
update orden_tareas t set estado = 'cancelada'
from orden_modulos m, orden_locales l
where m.id = t.modulo_id and l.id = t.local_id and l.nombre = 'Rivadavia'
  and t.origen = 'ia' and t.estado = 'pendiente'
  and t.creado_en >= timestamptz '2026-10-15 00:00-03' and t.creado_en < timestamptz '2026-10-16 00:00-03'
  and t.titulo ~* '(degrad|claro a oscuro|claro al m[aá]s oscuro)'
  and orden_lado_modulo(m.id) = 'derecha';

-- Lo que quedó: de qué lado está cada módulo de Rivadavia
select m.numero, m.nombre, orden_lado_modulo(m.id) as lado, m.liquidacion
from orden_modulos m join orden_sectores s on s.id = m.sector_id join orden_locales l on l.id = s.local_id
where l.nombre = 'Rivadavia' and s.tipo = 'salon' and m.activo
order by m.numero;
`;

const salida = cabecera + mig.trimEnd() + hoy;
fs.writeFileSync(path.join(__dirname, 'correr-en-supabase-125.sql'), salida);
console.log('correr-en-supabase-125.sql: ' + salida.length + ' caracteres');
