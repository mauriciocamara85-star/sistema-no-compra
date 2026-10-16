/* Arma correr-en-supabase-130.sql: la cabecera para Mauricio + la migración 37. */
const fs = require('fs');
const path = require('path');
const mig = fs.readFileSync(path.join(__dirname, 'migrations/20261015000037_fotos_sin_freno.sql'), 'utf8').replace(/\r\n/g, '\n');

const cabecera = `-- ═══ SQL 130 (15/10/2026) · Equipo VDH: la foto se manda siempre, sin las 4 preguntas ═══
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Correlo DESPUÉS del SQL 129 (usa lo que crea ese).
--   · Al mandar la foto ya no se piden las 4 preguntas (Sí/No): en la app quedan como un
--     recordatorio chiquito abajo. Si llegan igual (la app de antes, hasta que se actualiza),
--     se guardan como siempre.
--   · Sin respuestas, el nivel lo pone la IA (aunque llegue después de mandarla) o el
--     supervisor al revisarla.
--   · Que la IA no frene el envío es de la app nueva, no de este SQL.
--   · Al final te muestra "true" si quedó la versión nueva.
--   · Reversible (el detalle está abajo).

`;

const fin = `

-- Lo que quedó: true = ya no pide las respuestas
select pg_get_functiondef('orden_enviar_control(uuid, jsonb)'::regprocedure) like '%Las respuestas ya no se piden%' as ya_no_pide_respuestas;
`;

const salida = cabecera + mig.trimEnd() + fin;
fs.writeFileSync(path.join(__dirname, 'correr-en-supabase-130.sql'), salida);
console.log('correr-en-supabase-130.sql: ' + salida.length + ' caracteres');
