/* Arma correr-en-supabase-113.sql (los vendedores también ven el observador del croquis, y el aviso de una tarea a
   alguien de franco sale cuando esté en el trabajo) y lo deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-113.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-113.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261014000023_observador_vendedores_y_franco.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 113 (14/10/2026) · Equipo VDH: el observador para los vendedores, y las tareas a quien está de franco ═══
-- Va después del 112. Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Los vendedores ven las fotos, el nivel y lo de la IA de todos los módulos de su local en el observador.
--   · El aviso de una tarea a alguien que hoy no trabaja (o fuera del horario del local) sale a la hora de
--     apertura de su próximo día de trabajo.
--   · Reversible (ver abajo). No borra datos.

` + cuerpo + `
select 'listo: el observador para los vendedores y los avisos cuando esté en el trabajo' as "SQL 113";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-113.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
