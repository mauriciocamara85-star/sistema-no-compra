/* Arma correr-en-supabase-111.sql (los tableros de Ideas sin enlaces de
   invitación, la caja que deja borrar un monto y los avisos de las fotos a
   la pestaña Fotos) y lo deja también en el Escritorio, en "App Orden".
   Uso: node armar-sql-111.js [carpeta de salida]                              */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-111.sql');
const cuerpo = ['20261013000019_tableros_sin_invitacion.sql', '20261013000020_caja_borrar_y_avisos_fotos.sql']
  .map((m) => fs.readFileSync(path.join(__dirname, 'migrations', m), 'utf8').replace(/\r/g, '')).join('\n');

const sql = `-- ═══ SQL 111 (13/10/2026) · Equipo VDH: tableros sin invitación, la caja deja borrar y los avisos de fotos a Fotos ═══
-- Va después del 106 (el 107, el 108 y el 109 son de los usuarios del No
-- Compra; el 110 es el PIN de 6 números: no dependen de este). Pegalo entero
-- en el editor SQL de Supabase. Se puede correr más de una vez.
--   · El enlace de "Compartir" de Pinterest (pin.it o con invite_code) deja
--     sumarse a editar el tablero: la base ya no lo guarda (al de invitación
--     le saca el código; un pin.it lo rechaza).
--   · La caja deja borrar un monto ya guardado (para corregirlo).
--   · Los avisos de las fotos llevan a la pestaña Fotos (si también hay
--     tareas, a Hoy).
--   · Reversible: agrega un trigger y cambia frases exactas de 3 funciones
--     (orden_caja_guardar, orden_tick, orden_recordar). No borra datos.

` + cuerpo + `
select 'listo: tableros sin invitación, caja que deja borrar y avisos a Fotos' as "SQL 111";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-111.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
