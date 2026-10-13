/* Arma correr-en-supabase-97.sql (la aprobación, segunda vuelta) y lo deja
   también en el Escritorio, en "App Orden".
   Uso: node armar-sql-97.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-97.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000012_orden_aprobacion_2.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 97 (13/10/2026) · Impecable: la aprobación, segunda vuelta ═══
-- Va después del 95 (y del 96). Pegalo entero en el editor SQL de Supabase:
-- corre como un solo bloque (si algo falla, no cambia nada). Se puede correr
-- más de una vez.
--   · Si alguien crea el PIN de Nano (o de cualquiera que ya estaba) y no era
--     Nano, "No fue" borra ese PIN y le cierra la sesión al que lo creó; Nano
--     sigue en la lista. "No lo conozco" (sacarlo) queda sólo para quien se
--     anotó solo.
--   · "Borrar PIN" también cierra la sesión de quien lo tenía.
--   · Un administrador nuevo también espera aprobación (tuya).
--   · El supervisor ya no puede desactivar ni reactivar vendedores aprobando.
--   · El vendedor ve sólo las fotos de caja de hoy y ayer; la gerencia con
--     local asignado tampoco toca cajas; los avisos de altas te llegan si el
--     supervisor del local todavía no entró a la app.
--   · Lo único que toca de No Compra: al aprobar a un vendedor que coincide
--     con una fila inactiva de la Carga, la reactiva.
--   · Reversible: agrega 2 columnas y reemplaza funciones y una regla de
--     fotos. Sólo borra las cuentas internas de Impecable de quien se rechaza.

` + cuerpo + `
select 'listo: la aprobación, segunda vuelta' as "SQL 97";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-97.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
