/* ═══════════════════════════════════════════════════════════════════════════
   Los locales VDH, para la pantalla que ve el CLIENTE.

   ¿Por qué acá y no en la base, si existe la tabla `locales`?

   Porque esa tabla guarda el NOMBRE y nada más: es la lista del selector de
   la pantalla de Carga, no un directorio. Las direcciones no están ahí, así
   que no hay nada que duplicar.

   Y porque esto lo abre un cliente parado en la calle: un archivo que viaja
   con la página se ve al instante y sin señal, y no cuesta un viaje a la
   base para mostrar catorce direcciones que cambian una vez por año.

   **El `codigo` tiene que coincidir con la tabla `locales`.** Es lo único
   que ata este archivo al resto del sistema, y ya nos mordió una vez: el
   24/09/2026 hubo que renombrar dos locales en siete tablas porque el
   nombre viaja adentro de cada registro.

   El día que haya que editar esto desde Configuración, se muda a la base con
   dos columnas más. Hoy sería una cañería para nada.
   ═══════════════════════════════════════════════════════════════════════════ */

var LOCALES_VDH = [
  { codigo: 'CASEROS',            nombre: 'Caseros',
    dir: '3 de Febrero 2823',                             zona: 'Caseros',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'DOT',                nombre: 'DOT',
    dir: 'Vedia 3600, local 056',                         zona: 'Shopping DOT · CABA',
    hora: 'Todos los días de 10 a 22' },

  { codigo: 'FLORES',             nombre: 'Flores',
    dir: 'Av. Rivadavia 6757',                            zona: 'CABA',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'GRAND BOURG',        nombre: 'Grand Bourg',
    dir: 'Av. Eva Perón 1434',                            zona: 'Grand Bourg',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'ITUZAINGÓ',          nombre: 'Ituzaingó',
    dir: 'Coronel Pablo Zufriategui 940',                 zona: 'Ituzaingó',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'LOMAS DE ZAMORA',    nombre: 'Lomas de Zamora',
    dir: 'Laprida 380',                                   zona: 'Lomas de Zamora',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'MAR DEL PLATA',      nombre: 'Mar del Plata',
    dir: 'Rivadavia 2579',                                zona: 'Mar del Plata',
    hora: 'Lunes a sábados de 9 a 21 · domingos de 10 a 21' },

  { codigo: 'MORÓN',              nombre: 'Morón',
    dir: 'Av. Rivadavia 18290',                           zona: 'Morón',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'PACHECO',            nombre: 'Pacheco',
    dir: 'Av. Hipólito Yrigoyen 871',                     zona: 'General Pacheco',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'PARQUE BROWN',       nombre: 'Parque Brown',
    dir: 'Av. F. Fernández de la Cruz 4602, local 1038',  zona: 'Shopping Parque Brown · CABA',
    hora: 'Todos los días de 10 a 22' },

  { codigo: 'SAN JUSTO',          nombre: 'San Justo',
    dir: 'Av. Dr. Ignacio Arieta 3163',                   zona: 'San Justo',
    hora: 'Lunes a sábados de 9 a 20:30' },

  { codigo: 'SAN JUSTO SHOPPING', nombre: 'San Justo Shopping',
    dir: 'Av. Brig. J. M. de Rosas 3910, local 11',       zona: 'San Justo',
    hora: 'Todos los días de 10 a 22' },

  { codigo: 'UNICENTER',          nombre: 'Unicenter',
    dir: 'Paraná 3745, local 2152',                       zona: 'Unicenter · Martínez',
    hora: 'Todos los días de 10 a 22' },

  { codigo: 'VILLA DEL PARQUE',   nombre: 'Villa del Parque',
    dir: 'Cuenca 2889',                                   zona: 'CABA',
    hora: 'Lunes a sábados de 9 a 20:30' }
];

/**
 * El enlace para "cómo llegar".
 *
 * Se arma con la dirección en TEXTO y no con coordenadas, a propósito: sin
 * latitudes que mantener, y el buscador de Google resuelve bien una
 * dirección con la ciudad al lado. Con coordenadas habría que conseguir las
 * catorce y revisarlas una por una, y una coordenada mal puesta manda al
 * cliente a otro barrio sin que nadie se entere.
 *
 * `api=1` es la forma oficial y estable: abre la app de Maps en el celular
 * y el sitio en la computadora, sin necesitar ninguna clave.
 */
function comoLlegar(local) {
  var q = local.nombre + ', ' + local.dir + ', ' + local.zona + ', Argentina';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}
