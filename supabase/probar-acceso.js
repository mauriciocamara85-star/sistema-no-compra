/* ¿El vendedor puede llegar a los teléfonos de los clientes?
 *
 * Se hace pasar por cada rol de verdad —anon es el celular del vendedor,
 * authenticated es quien entró con Google— y prueba una por una las cosas que
 * tienen que poder y las que no.
 *
 * Lo que importa no son los "sí": son los "no".
 */
/* La conexión sale de una variable de entorno: la contraseña de la base NO
   entra al repo, que es público.

     PGURL='postgresql://postgres:LACLAVE@db.REF.supabase.co:5432/postgres' \n       node supabase/probar-acceso.js
*/
const { Client } = require('pg');

async function conectar() {
  if (!process.env.PGURL) {
    console.error('Falta PGURL. Ver el comentario de arriba.');
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

let mal = 0;

async function probar(cliente, rol, que, sql, deberia) {
  await cliente.query('begin');
  try {
    await cliente.query('set local role ' + rol);
    await cliente.query(sql);
    await cliente.query('rollback');
    const bien = deberia === 'puede';
    if (!bien) mal++;
    console.log((bien ? '  ok  ' : ' MAL  ') + rol.padEnd(14) + que +
                (bien ? '' : '   ← PUDO Y NO DEBERÍA'));
  } catch (err) {
    await cliente.query('rollback');
    const bien = deberia === 'no puede';
    if (!bien) mal++;
    console.log((bien ? '  ok  ' : ' MAL  ') + rol.padEnd(14) + que +
                (bien ? '' : '   ← NO PUDO Y DEBERÍA: ' + err.message.split('\n')[0]));
  }
}

(async () => {
  const c = await conectar();

  console.log('\n═══ LO QUE EL VENDEDOR NO PUEDE (lo que de verdad importa) ═══');
  await probar(c, 'anon', 'leer los registros de clientes', 'select * from registros', 'no puede');
  await probar(c, 'anon', 'leer los teléfonos', 'select whatsapp from registros', 'no puede');
  await probar(c, 'anon', 'contar cuántos clientes hay', 'select count(*) from registros', 'no puede');
  await probar(c, 'anon', 'modificar un registro', "update registros set nombre = 'x'", 'no puede');
  await probar(c, 'anon', 'borrar registros', 'delete from registros', 'no puede');
  await probar(c, 'anon', 'leer los ajustes (mail, Telegram)', 'select * from ajustes', 'no puede');
  await probar(c, 'anon', 'leer el historial de cambios', 'select * from log', 'no puede');
  await probar(c, 'anon', 'cargar una venta ya cerrada',
    "insert into registros (sucursal, vendedor, whatsapp, compro) values ('X','Y','1122334455', true)", 'no puede');
  await probar(c, 'anon', 'cargar sin teléfono',
    "insert into registros (sucursal, vendedor, whatsapp) values ('X','Y','')", 'no puede');

  console.log('\n═══ LO QUE EL VENDEDOR SÍ TIENE QUE PODER ═══');
  await probar(c, 'anon', 'cargar un no-compra',
    "insert into registros (sucursal, vendedor, nombre, whatsapp, producto, motivo) " +
    "values ('RIVADAVIA','Mau','Prueba','1122334455','Campera','Sin talle')", 'puede');
  await probar(c, 'anon', 'ver los números de su local', 'select * from v_metricas', 'puede');
  await probar(c, 'anon', 'ver los motivos', 'select * from v_motivos', 'puede');
  await probar(c, 'anon', 'ver los resultados', 'select * from v_resultados', 'puede');
  await probar(c, 'anon', 'ver el equipo del local', 'select * from equipo', 'puede');
  await probar(c, 'anon', 'anotarse en el local',
    "insert into equipo (local, vendedor) values ('RIVADAVIA','Prueba')", 'puede');
  await probar(c, 'anon', 'ver los objetivos', 'select * from objetivos', 'puede');
  await probar(c, 'anon', 'dejar constancia en el log',
    "insert into log (accion) values ('prueba')", 'puede');
  await probar(c, 'anon', 'buscar un beneficio por teléfono',
    "select * from beneficio_buscar('1122334455')", 'puede');

  console.log('\n═══ CON SESIÓN INICIADA (Atención al Cliente) ═══');
  await probar(c, 'authenticated', 'leer los registros', 'select * from registros', 'puede');
  await probar(c, 'authenticated', 'completar el seguimiento',
    "update registros set contactado = true", 'puede');
  await probar(c, 'authenticated', 'leer los ajustes', 'select * from ajustes', 'puede');
  await probar(c, 'authenticated', 'leer el historial', 'select * from log', 'puede');
  await probar(c, 'authenticated', 'borrar un cliente', 'delete from registros', 'no puede');

  console.log('\n' + (mal ? '⚠ ' + mal + ' PRUEBAS MAL — revisar antes de seguir' : 'Todo como tiene que ser') + '\n');
  await c.end();
  process.exitCode = mal ? 1 : 0;
})();
