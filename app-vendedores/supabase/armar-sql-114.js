/* Arma correr-en-supabase-114.sql ("qué hay en este módulo", separado del nombre) y lo deja también en el Escritorio,
   en "App Orden".
   Uso: node armar-sql-114.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-114.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261014000024_que_hay.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 114 (14/10/2026) · Equipo VDH: "qué hay en este módulo", separado del nombre ═══
-- Va después del 113. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Cada módulo tiene su nombre (dónde está: "Vidriera") y aparte qué hay ("Remeras").
--   · Reversible: borrar la función y la columna. No borra datos.

` + cuerpo + `
select 'listo: qué hay en cada módulo' as "SQL 114";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-114.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
