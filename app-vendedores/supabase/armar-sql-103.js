/* Arma correr-en-supabase-103.sql (sólo trabaja quien está aprobado + dejar
   Rivadavia listo para probar hoy con "Prueba") y lo deja también en el
   Escritorio, en "App Orden".
   Uso: node armar-sql-103.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-103.sql');
const leer = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 103 (13/10/2026) · Impecable: activar la prueba ═══
-- Va DESPUÉS del 102 (si no corriste el 102, primero ése). Pegalo entero en el
-- editor SQL de Supabase. Se puede correr más de una vez.
--   · Sólo trabaja (le tocan controles, desafío y avisos) quien ya está
--     aprobado en la app. Así Lautaro, Nano, Seba y Mel no se llenan de
--     controles vencidos hasta que entren.
--   · Deja Rivadavia listo para probar hoy con "Prueba": su sector, el
--     producto testigo de hoy, un recordatorio, una tarea, el desafío y los
--     controles de hoy (hasta las 20:30). Ver el detalle abajo.
--   · Reversible: lo de "Prueba" se vuelve a Lautaro desde Por local →
--     "Repartir y ponerles nombre"; la hora límite, en Ajustes. No borra nada
--     tuyo (sólo 3 controles viejos de prueba y la planilla vacía de esta semana).

` + leer('migrations/20261013000015_trabaja_aprobado.sql') + '\n' + leer('activar-prueba.sql') + `
select 'listo: sólo trabaja quien está aprobado, y Rivadavia activado para la prueba' as "SQL 103";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-103.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
