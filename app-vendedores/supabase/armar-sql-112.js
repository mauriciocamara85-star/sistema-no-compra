/* Arma correr-en-supabase-112.sql (el croquis del local: la puerta, los
   huecos, los módulos dobles, lo fijo y lo del centro donde está) y lo deja
   también en el Escritorio, en "App Orden".
   Uso: node armar-sql-112.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-112.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000022_croquis.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 112 (13/10/2026) · Equipo VDH: el croquis del local ═══
-- Va después del 110 y el 111. Pegalo entero en el editor SQL de Supabase. Se
-- puede correr más de una vez.
--   · La puerta (en el salón y en el depósito): el 1 arranca al lado,
--     hacia la izquierda. Huecos, módulos dobles, cosas fijas y lo del centro
--     donde está.
--   · Al mover la puerta o un lugar, cada módulo queda donde está (con su
--     historia): cambia su número.
--   · Reversible: agrega 2 funciones. No borra datos.

` + cuerpo + `
select 'listo: el croquis del local' as "SQL 112";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-112.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
