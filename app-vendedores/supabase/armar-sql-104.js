/* Arma correr-en-supabase-104.sql (Atención al cliente fuera de la lista de
   la entrada de Impecable) y lo deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-104.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-104.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000016_atencion_fuera.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 104 (13/10/2026) · Impecable: Atención al cliente fuera de la entrada ═══
-- Va después del 100 (el rol "Atención al cliente") y del 103. No es urgente:
-- todavía no hay nadie de Atención cargado. Pegalo entero en el editor SQL de
-- Supabase. Se puede correr más de una vez. Reversible (ver abajo).

` + cuerpo + `
select 'listo: Atención al cliente fuera de la entrada de Impecable' as "SQL 104";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-104.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
