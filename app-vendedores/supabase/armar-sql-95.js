/* Arma correr-en-supabase-95.sql (la aprobación y los arreglos de la revisión)
   y lo deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-95.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-95.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000011_orden_aprobacion.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 95 (13/10/2026) · Impecable: nadie entra al local sin que lo aprueben ═══
-- Va después del 93 (ya corrido). Correlo antes de que alguien empiece a usar
-- la app: con el 93 solo, cualquiera que sepa llamar a la función "entrar"
-- puede anotarse en un local y ver o cambiar la caja. Pegalo entero en el
-- editor SQL de Supabase: corre como un solo bloque (si algo falla, no cambia
-- nada). Se puede correr más de una vez.
--   · Quien se da de alta, o crea su PIN por primera vez, espera la aprobación
--     de su supervisor (o la tuya) y hasta entonces no ve nada del local.
--     Lautaro, Nano, Seba y Mel quedan esperando (todavía no crearon el PIN);
--     vos y "Prueba", no.
--   · Al aprobar a un vendedor, se suma al equipo de la Carga de No Compra (si
--     el nombre ya estaba, no lo toca). Es lo único que toca de No Compra.
--   · Los arreglos de la revisión: la gerencia ya no cambia cajas, la caja
--     apagada queda cerrada, "avisos activos" se ve bien, la IA no cobra dos
--     veces la misma foto y una foto reintentada no se registra dos veces.
--   · Reversible: agrega una columna (aprobado) y reemplaza funciones,
--     permisos y una vista; no borra datos.

` + cuerpo + `
select 'listo: la aprobación y los arreglos de la revisión' as "SQL 95";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-95.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
