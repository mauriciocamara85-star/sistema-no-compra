/* Arma correr-en-supabase-111.sql (los tableros de Ideas no guardan el
   enlace para invitar a editarlos) y lo deja también en el Escritorio, en
   "App Orden".
   Uso: node armar-sql-111.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-111.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000019_tableros_sin_invitacion.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 111 (13/10/2026) · Equipo VDH: los tableros de Ideas sin enlaces de invitación ═══
-- Va después del 106 (el 107, el 108 y el 109 son de los usuarios del No
-- Compra; el 110 es el PIN de 6 números: no dependen de este). Pegalo entero
-- en el editor SQL de Supabase. Se puede correr más de una vez.
--   · El enlace de "Compartir" de Pinterest (pin.it o con invite_code) deja
--     sumarse a editar el tablero: la base ya no lo guarda (al de invitación
--     le saca el código; un pin.it lo rechaza).
--   · Reversible: agrega un trigger. No borra datos.

` + cuerpo + `
select 'listo: los tableros de Ideas sin enlaces de invitación' as "SQL 111";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-111.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
