/* Arma correr-en-supabase-90.sql (el que se pega en el editor SQL de Supabase)
   juntando las migraciones de la app de vendedores, en un solo bloque que
   corre entero o no hace nada.
   La migración 3 (el reloj con pg_cron) NO va acá: se prende cuando estén
   subidas las Edge Functions, si no el reloj llama a funciones que no existen.
   Uso: node armar-sql-90.js [carpeta de salida]                               */
const fs = require('fs');
const path = require('path');

const M = path.join(__dirname, 'migrations');
const salida = path.join(process.argv[2] || __dirname, 'correr-en-supabase-90.sql');
const partes = [
  '20261012000001_orden_esquema.sql',
  '20261012000002_orden_storage.sql',
  '20261012000004_orden_datos_iniciales.sql',
  '20261012000005_orden_preguntas.sql',
  '20261012000006_orden_cajas.sql',
  '20261012000007_orden_login.sql',
];

const cabeza = `-- ═══ SQL 90 (12/10/2026) · la app de los vendedores: la base y el login ═══
-- Control de orden de los módulos con fotos e IA, tareas, avisos, desafío y
-- control de caja (estos dos, apagados). Todo con prefijo orden_ y testigo_:
-- no toca nada de lo que ya existe, salvo DESACTIVAR (no borrar) la fila
-- suelta "RIVADAVIA / Mau" del equipo (pedido de Mauricio).
--   · El local piloto se muestra como "Rivadavia" (en No Compra es
--     MAR DEL PLATA): Lautaro, Nano, Seba y Mel, con sus francos.
--     Mauricio, administrador y supervisor, sin módulos.
--   · El login: local → nombre → PIN de 4 números, una vez por celular.
--     Freno: 5 PIN mal seguidos y espera 5 minutos, por persona.
--   · AL FINAL MUESTRA EL PIN DE CADA UNO, UNA SOLA VEZ: anotalos.
--     Si se pierde uno: select nombre, orden_pin_sortear(id) as pin
--                       from orden_personas where nombre = 'Lautaro';
-- Corre entero o no hace nada: pegado entero en el editor, Postgres lo corre
-- como un solo bloque y, si algo falla, lo deshace todo y no deja nada tomado.
-- (Sin "begin;" a mano a propósito: con un begin, un error deja la conexión
-- trabada en una transacción fallida, con tablas tomadas, hasta que se cierra.)
-- Si ya se corrió, avisa y no cambia nada.
-- El reloj automático (pg_cron) va en otro SQL, con las funciones del servidor.

do $$
begin
  if to_regclass('public.orden_personas') is not null then
    raise exception 'El SQL 90 ya está corrido: no hace falta correrlo de nuevo (no se cambió nada).';
  end if;
  if not exists (select 1 from locales where codigo = 'MAR DEL PLATA') then
    raise exception 'No encuentro el local MAR DEL PLATA en la tabla locales (no se cambió nada).';
  end if;
end $$;
`;

const pie = `

-- Los PIN del arranque (se ven una sola vez)
select local, nombre, pin from orden_pins_iniciales order by local, nombre;
`;

let sql = cabeza;
for (const p of partes) {
  sql += `\n\n-- ████████ ${p} ████████\n\n` + fs.readFileSync(path.join(M, p), 'utf8').replace(/\r/g, '');
}
sql += pie;
fs.writeFileSync(salida, sql);
console.log('escrito: ' + salida + ' (' + sql.split('\n').length + ' renglones)');
