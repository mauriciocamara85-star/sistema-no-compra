/* Arma correr-en-supabase-102.sql (Productos testigo desde los locales) y lo
   deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-102.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-102.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000014_testigo.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 102 (13/10/2026) · Impecable: Productos testigo desde los locales, y nombres y reparto parejo en el mapa ═══
-- Va después del 99 (el 100 y el 101 son de los usuarios del No Compra: no
-- dependen de este ni este de ellos). Pegalo entero en el editor SQL de
-- Supabase: corre como un solo bloque. Se puede correr más de una vez.
--   · Desde la computadora (No Compra → Impecable → Productos testigo →
--     "Programar un control") elegís el día, los productos y los locales.
--   · El local llena la planilla en Impecable (PC o celular) y graba un video
--     cortito de cada producto. La cantidad vendida se escribe; la diferencia
--     y el desvío se calculan solos.
--   · Avisos: "Mañana tienen producto testigo" al local, y al supervisor y a
--     vos si falta algo (salen cuando esté subido el reloj de avisos).
--   · El mapa: ponerle nombre a un módulo ("Vidriera") y "Repartir parejo"
--     (22 entre 3: 7, 7 y 8), en Por local → "Repartir y ponerles nombre".
--   · No toca nada de No Compra. Reversible: agrega columnas, una tabla
--     chica, un bucket para los videos y funciones; la "Cantidad enviada"
--     deja de arrancar en 0 (queda vacía hasta que la carguen). No borra datos.

` + cuerpo + `
select 'listo: Productos testigo desde los locales' as "SQL 102";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-102.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
