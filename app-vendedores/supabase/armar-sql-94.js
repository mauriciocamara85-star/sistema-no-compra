/* Arma correr-en-supabase-94.sql (prender el reloj de Impecable) y lo deja
   también en el Escritorio.
   Uso: node armar-sql-94.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-94.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261012000010_orden_reloj.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 94 (12/10/2026) · Impecable: PRENDER EL RELOJ ═══
-- ⚠ Correrlo recién EL DÍA QUE LOS VENDEDORES EMPIEZAN a usar la app, y
--   después de subir las Edge Functions tick, resumen-cajas y resumen-semanal.
--   Desde ese momento se generan los controles y salen los avisos solos.
-- Va después del 95, 96 y 97 (no pisa nada de ellos). Pegalo entero en el
-- editor SQL de Supabase. Se puede correr más de una vez. Para apagarlo, ver "PARA APAGARLO" más abajo.

` + cuerpo + `
select 'listo: el reloj de Impecable está prendido' as "SQL 94";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'correr-en-supabase-94.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
