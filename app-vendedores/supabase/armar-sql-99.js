/* Arma correr-en-supabase-99.sql (el mapa del local, el reparto de los
   módulos y los recordatorios de cada día) y lo deja también en el
   Escritorio, en "App Orden".
   Uso: node armar-sql-99.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-99.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261013000013_orden_mapa.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 99 (13/10/2026) · Impecable: el mapa del local, el reparto y los recordatorios ═══
-- Va después del 97. Pegalo entero en el editor SQL de Supabase: corre como
-- un solo bloque (si algo falla, no cambia nada). Se puede correr más de una vez.
--   · El mapa: cuántos módulos hay en cada pared de cada local y las cosas de
--     adentro (la caja, los percheros). Se arma desde la computadora
--     (No Compra → Impecable → Por local → "Cambiar la forma y la cantidad").
--   · El reparto, ahí mismo ("Repartir los módulos"): qué módulos son de cada
--     sector, quién lo tiene y quién lo cubre. Lo hacen el supervisor del
--     local o vos. Los vendedores lo ven en la app, con lo suyo marcado.
--   · Los recordatorios de cada día (Ajustes → Recordatorios por día): ese
--     día aparecen arriba en "Hoy".
--   · Hasta que armes el mapa de un local, no cambia ningún módulo.
--   · No toca nada de No Compra. Reversible: agrega una tabla, dos columnas y
--     tres funciones; no borra datos.

` + cuerpo + `
select 'listo: el mapa del local, el reparto y los recordatorios' as "SQL 99";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'App Orden', 'correr-en-supabase-99.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
