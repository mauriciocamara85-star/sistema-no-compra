/* Arma correr-en-supabase-106.sql (los módulos del centro en "Repartir
   parejo") y lo deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-106.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-106.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000018_medio_en_reparto.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 106 (13/10/2026) · Equipo VDH: los módulos del centro en el reparto ═══
-- Va después del 105. Pegalo entero en el editor SQL de Supabase. Se puede
-- correr más de una vez.
--   · Los módulos del centro (exhibidores, mesas, percheros) entran en
--     "Repartir parejo", al final de la numeración (con 22 en las paredes,
--     el primero del centro es el 23).
--   · Reversible: cambia una sola función. No borra datos.

` + cuerpo + `
select 'listo: los módulos del centro en el reparto' as "SQL 106";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-106.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
