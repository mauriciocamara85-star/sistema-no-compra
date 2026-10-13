/* Arma correr-en-supabase-91.sql (cada uno crea su PIN, y "Supervisión") y lo
   deja también en el Escritorio, que es donde Mauricio lo busca.
   Uso: node armar-sql-91.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-91.sql');
const cuerpo = fs.readFileSync(path.join(__dirname, 'migrations', '20261012000008_orden_crear_pin.sql'), 'utf8').replace(/\r/g, '');

const sql = `-- ═══ SQL 91 (12/10/2026) · app de vendedores: cada uno crea su PIN, y "Supervisión" ═══
-- Va después del 90. Pegalo entero en el editor SQL de Supabase: corre como un
-- solo bloque (si algo falla, no cambia nada). Se puede correr más de una vez.
--   · La primera vez que alguien entra, la app le pide que CREE su PIN de 4
--     números (dos veces). Los PIN sorteados del SQL 90 dejan de valer.
--   · Si alguien se olvida el PIN:
--       select orden_pin_borrar(id) from orden_personas where nombre = 'Lautaro';
--     y la próxima vez que entre lo crea de nuevo.
--   · "Oficina" pasa a llamarse "Supervisión".

` + cuerpo + `
select 'listo: cada uno crea su PIN la primera vez, y "Supervisión"' as "SQL 91";
`;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida);
if (!process.argv[2]) {
  const escritorio = path.join(__dirname, '..', '..', '..', 'correr-en-supabase-91.sql');
  fs.writeFileSync(escritorio, sql);
  console.log('copiado: ' + escritorio);
}
