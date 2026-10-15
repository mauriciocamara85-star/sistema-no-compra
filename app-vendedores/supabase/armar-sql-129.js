/* Arma correr-en-supabase-129.sql: la cabecera para Mauricio + la migración 36. */
const fs = require('fs');
const path = require('path');
const mig = fs.readFileSync(path.join(__dirname, 'migrations/20261015000036_preguntas_por_mueble.sql'), 'utf8').replace(/\r\n/g, '\n');

const cabecera = `-- ═══ SQL 129 (15/10/2026) · Equipo VDH: las 4 preguntas según el tipo de mueble ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Las preguntas del control dependen del mueble: la pared con estantes sigue con Frontales;
--     las mesas preguntan Exhibición (por color y bien cargada) en vez de Frontales; los
--     percheros, Colgado y Exhibición; las vidrieras, Armado, Carteles, Limpieza y Luces.
--     El depósito, igual que antes.
--   · Correlo DESPUÉS de que esté subida la IA nueva (analizar-foto): desde ahí la IA mira lo
--     de cada mueble (en una mesa no busca frontales). Los chicos ven las preguntas nuevas
--     cuando se publique la app; hasta entonces responden las de antes y se aceptan igual.
--   · Si a un módulo le cambia el mueble (lo elige el supervisor, lo renombran o lo mueven en
--     el croquis), se cancelan solas las tareas de la IA de puntos que ese mueble ya no tiene
--     (por ejemplo, "Frontales" en un perchero).
--   · Suma reglas para los puntos nuevos (perchas, maniquíes, carteles, luces, el vidrio):
--     las podés cambiar en Ajustes → Reglas de orden.
--   · Al final te muestra cada local con sus tipos de mueble y las preguntas de cada uno.
--   · Reversible (el detalle está abajo).

`;

const fin = `

-- Lo que quedó: cada local con sus tipos de mueble y las preguntas de cada uno
select l.nombre as local, orden_mueble(m.mueble, m.isla, m.nombre, s.tipo) as mueble, count(*) as modulos,
       array_to_string(orden_checks_mueble(orden_mueble(m.mueble, m.isla, m.nombre, s.tipo)), ' · ') as preguntas
from orden_modulos m join orden_sectores s on s.id = m.sector_id join orden_locales l on l.id = s.local_id
where m.activo and s.activo and l.activo
group by 1, 2, 4
order by 1, 2;
`;

const salida = cabecera + mig.trimEnd() + fin;
fs.writeFileSync(path.join(__dirname, 'correr-en-supabase-129.sql'), salida);
console.log('correr-en-supabase-129.sql: ' + salida.length + ' caracteres');
