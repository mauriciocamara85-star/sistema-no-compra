/* Arma correr-en-supabase-110.sql (el PIN de 6 números para la
   administración, Atención y gerencia) y lo deja también en el Escritorio,
   en "App Orden".
   Uso: node armar-sql-110.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-110.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000021_pin_seis.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 110 (13/10/2026) · Equipo VDH: el PIN de 6 números para la administración, Atención y gerencia ═══
-- Va después del 111 (ya corrido). Lo esperan los SQL 107 a 109 de los
-- usuarios del No Compra: su apagado del PIN compartido va después de éste.
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Admin, Atención y gerencia: PIN de 6 números. Vendedores y
--     supervisores siguen con 4.
--   · No se borra ningún PIN: la próxima vez que entres con tu PIN de 4, la
--     app te pide uno de 6 en el momento (no queda un rato en que otro pueda
--     crearlo en tu nombre).
--   · Freno más duro para esos roles: 5 mal → 5 min; 5 más → 30 min; después
--     24 h y aviso a los administradores.
--   · orden_pin_reiniciar: una sola función para dejar a alguien sin PIN
--     (la usa también Config → Usuarios, desde el SQL 109).
--   · Reversible: agrega 2 columnas y funciones; no borra datos ni PINs.

` + cuerpo + `
select 'listo: el PIN de 6 números para la administración, Atención y gerencia' as "SQL 110";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-110.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
