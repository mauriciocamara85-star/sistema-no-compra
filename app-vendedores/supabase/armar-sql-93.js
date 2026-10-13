/* Arma correr-en-supabase-93.sql (los 14 locales, el alta propia y "Administrador")
   y lo deja también en el Escritorio.
   Uso: node armar-sql-93.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-93.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261012000009_orden_alta.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 93 (12/10/2026) · Impecable: los 14 locales, el alta propia y "Administrador" ═══
-- Va después del 91 (el 92 es de la otra parte del sistema: no importa el orden
-- entre esos dos). Pegalo entero en el editor SQL de Supabase: corre como un
-- solo bloque (si algo falla, no cambia nada). Se puede correr más de una vez.
--   · En la app aparecen los 14 locales.
--   · El vendedor que no está en la lista se da de alta solo (nombre, apellido
--     y PIN) y queda sumado al equipo de la Carga de su local.
--   · A Lautaro, Nano, Seba y Mel se les pide el apellido al crear el PIN.
--   · Lo único que toca de No Compra: suma a los vendedores nuevos a la tabla
--     equipo (si el nombre ya estaba, no lo toca).

` + cuerpo + `
select 'listo: los 14 locales, el alta propia y "Administrador"' as "SQL 93";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(require('os').homedir(), 'OneDrive', 'Informes', 'Desktop', 'correr-en-supabase-93.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
