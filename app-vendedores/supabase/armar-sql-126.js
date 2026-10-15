/* Arma correr-en-supabase-126.sql: la cabecera para Mauricio + la migración 35. */
const fs = require('fs');
const path = require('path');
const mig = fs.readFileSync(path.join(__dirname, 'migrations/20261015000035_rehacer_foto_enviada.sql'), 'utf8').replace(/\r\n/g, '\n');

const cabecera = `-- ═══ SQL 126 (15/10/2026) · Equipo VDH: sacar de nuevo una foto ya mandada ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Mientras el supervisor no la revisó, el vendedor puede sacar de nuevo una foto que ya mandó:
--     sólo el mismo día y antes de la hora límite. Si ya la revisaste, queda como está.
--   · Hasta que mande la nueva, en Revisar se sigue viendo la que mandó. Si se arrepiente, queda esa.
--   · Hasta que se publique la app nueva, esto no cambia nada de lo que ven: la app de hoy no lo ofrece.
--   · Reversible (el detalle está abajo).

`;

const fin = `

-- Lo que quedó: los controles de hoy que se pueden sacar de nuevo
select l.nombre as local, pe.nombre as vendedor, m.nombre as modulo, c.estado, orden_se_puede_rehacer(c) as se_puede_rehacer
from orden_controles c join orden_modulos m on m.id = c.modulo_id join orden_locales l on l.id = c.local_id
left join orden_personas pe on pe.id = c.persona_id
where c.estado = 'enviado' and c.fecha = orden_fecha_local(c.local_id)
order by 1, 2, m.numero;
`;

const salida = cabecera + mig.trimEnd() + fin;
fs.writeFileSync(path.join(__dirname, 'correr-en-supabase-126.sql'), salida);
console.log('correr-en-supabase-126.sql: ' + salida.length + ' caracteres');
