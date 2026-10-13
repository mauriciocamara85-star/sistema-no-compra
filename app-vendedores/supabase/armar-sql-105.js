/* Arma correr-en-supabase-105.sql (el Test de conocimiento, "Mandar un test
   ahora" y el nombre "Equipo VDH" en los avisos) y lo deja también en el
   Escritorio, en "App Orden".
   Uso: node armar-sql-105.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-105.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000017_test_conocimiento.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 105 (13/10/2026) · Equipo VDH: el Test de conocimiento ═══
-- Va después del 103 (y del 104, si ya lo corriste; si no, no importa).
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · El "desafío de la semana" pasa a llamarse "Test de conocimiento".
--   · "Mandar un test ahora" desde la administración (Ajustes → Preguntas de
--     los tests): título, preguntas (de un grupo o de un tema) y locales. Les
--     llega "Tenés un test de conocimiento: …".
--   · Los avisos dicen "Equipo VDH" en vez de "Impecable" (el nivel
--     "Impecable" de las fotos queda igual).
--   · Reversible: agrega columnas y una función, y cambia textos. No borra datos.

` + cuerpo + `
select 'listo: el Test de conocimiento y Equipo VDH' as "SQL 105";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-105.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
