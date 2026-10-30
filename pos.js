/* ════════════════════════════════════════════════════════════════════════
   pos.js — el POS de los locales VDH (20/10/2026).

   Pedido de Mauricio (20/10): "armá la sección POS", con Tango y Dragonfish
   de referencia (14 sucursales), y después le damos nuestro toque. Esta
   primera versión tiene la venta de verdad contra la base (SQL 146), los
   tickets, las listas de precios, las promociones y las sucursales. El resto
   del menú dice qué va a tener.

   Lo que manda (decidido con él):
   · Adentro de cada pantalla, los mismos campos en los mismos lugares que
     BlueSoft (05/10: "si ven todo como BlueSoft, agarran confianza").
   · Las promos NO se aplican solas (29/10: "que no aparezca automático,
     por las dudas"): el vendedor las elige en «Descuentos +» y el sistema
     hace la cuenta. Además existe el descuento a mano, como en BlueSoft.
   · La factura de ARCA todavía NO: la venta queda registrada y la factura la
     sigue haciendo BlueSoft hasta que esté el certificado.
   · Por ahora lo usa sólo Administración: la barra lo esconde a los demás
     (persona.js) y la base lo frena (pos_permiso).

   Dos pantallas con el mismo código (Mauricio, 20/10: "que cuando se abra
   el POS, la barra del sistema no esté… y que el POS quede sólo con nueva
   venta, tickets, cambios, venta fallida"):
   · pos.html, el mostrador: a pantalla completa, sin la barra negra.
   · gestion.html, la parte de atrás (artículos, stock, caja, clientes y
     configuración), adentro del sistema, con los grupos que se despliegan.
   Y el SQL 147: la letra X (el comprobante interno de BlueSoft, sólo con
   efectivo) y el modo prueba (numera aparte y no cuenta para nada).
   El SQL 149 (21/10, "dalee"): el cierre de caja de BlueSoft en el
   mostrador, con el conteo a ciegas, el pase a la caja fuerte y los gastos
   de la caja chica; en Gestión, el listado de cierres y los movimientos.
   El SQL 151 (21/10, "hagámoslo igual… bien básico ahora"): el "Ticket de
   cambio" de BlueSoft, con lo que vuelve arriba y lo que se lleva abajo. Lo
   que vuelve entra al precio de lista; si sale más se cobra la diferencia,
   y si sale menos no se guarda (no se devuelve plata).
   El SQL 160 (22/10, "primero arranquemos con esto, con lo básico"): el
   stock de cada local y los remitos. La venta y el cambio lo mueven solos;
   la fábrica (por ahora, la oficina desde Gestión) carga el remito y el
   local lo cuenta a ciegas, producto por producto: recién ahí entra a su
   stock. La primera carga sale del Excel de "Consulta de stock" de BlueSoft.
   El SQL 167 (24/10, "si no da, tenemos una planilla de error donde
   anotamos"): las diferencias de los remitos se anotan solas, con quién lo
   recibió y qué pasó; en Gestión → Diferencias se ven con sus estadísticas
   y se resuelven (mandar lo que faltó, que devuelvan lo que sobró…), y el
   sistema avisa al abrirlo (persona.js).
   El SQL 171 (24/10, "el tráfico son las ventas que vendimos más las ventas
   fallidas" y los No Compra): la venta fallida propia, como la de BlueSoft
   (el cliente que se fue sin comprar y no dejó su WhatsApp; el que lo deja
   va al No Compra); Tickets con las ubicaciones de BlueSoft (a la derecha
   Nueva venta, Venta fallida, el tráfico y la conversión; abajo los
   totales, con el ticket promedio); y el socio del Club en "Cargar": se
   busca o se hace socio ahí, y la venta anota sus puntos. Los SUMA recién
   cuando se prenda la regla del Club pos_suma_puntos ("los dejamos apagados
   hasta el lanzamiento"): mientras tanto se cargan en Cobrar.
   El SQL 172 (25/10, "en Bluesoft… una que decía consulta de stock…
   mostraba todo el stock que teníamos"): Stock con las tres vistas de esa
   consulta (Por producto, Lista y Por rubro), todo el stock de a tandas al
   bajar, los totales abajo con el Excel, y quién vendió en los movimientos.
   Los gastos (26/10, "en BlueSoft los teníamos como una sección aparte"):
   salen del cierre de caja a su propia sección del mostrador, como el
   "Gastos del Local" de BlueSoft. El cierre los sigue sumando, pero ya no
   los carga. Sin SQL: usa las funciones del 149.
   Los movimientos de salida (SQL 180, 26/10, "en BlueSoft tenemos una
   sección… «movimientos de salida», y ahí agregamos los movimientos de caja
   chica a caja fuerte"): el pase a la caja fuerte sale del cierre (era su
   Paso 2) y se carga en su sección, con su número (MS-1…). El cierre lo
   resta de lo que tendría que haber, como a los gastos.

   La plata va en CENTAVOS (enteros) en toda la cuenta: la base vuelve a
   sumar y exige que los pagos den el total al centavo.

   Usa: comun.js (esc, avisar, leer, guardar…), datos.js (funcion),
   persona.js (la sesión), interfaz.js (el panel y el período) y catalogo.js.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var app = document.getElementById('app');
  function $(id) { return document.getElementById(id); }

  /* pos.html (el mostrador) o gestion.html (la parte de atrás): lo dice el <body>. */
  var MODO = document.body.getAttribute('data-pos') === 'gestion' ? 'gestion' : 'mostrador';
  var PAGINA = { mostrador: 'pos.html', gestion: 'gestion.html' };

  var K_MENU = MODO === 'gestion' ? 'nc_panel_gestion' : 'nc_panel_pos';   // el menú achicado (interfaz.js), menos en la venta
  var K_MENU_VENTA = 'nc_panel_pos_venta'; // en la venta arranca achicado: necesita el ancho, como el ticket de BlueSoft
  var K_GRUPOS = 'nc_gestion_grupos';      // los grupos de Gestión que se abrieron o se cerraron a mano
  var K_RECUERDO = 'pos_recuerdo';         // la sucursal y el vendedor de cada una
  var K_BORRADOR = 'pos_borrador';         // la venta a medio armar: si se cierra la pestaña, sigue ahí
  var K_CAMBIO = 'pos_borrador_cambio';    // el cambio a medio armar, igual
  var K_PRUEBA = 'pos_prueba';             // el modo prueba, en sessionStorage: se apaga solo al cerrar la ventana
  var K_REMITO = 'pos_borrador_remito';    // el remito nuevo a medio cargar (Gestión)
  var K_DEVOL = 'pos_borrador_devolucion'; // la devolución a fábrica a medio cargar (el mostrador, SQL 189)
  var K_ENVIO = 'pos_borrador_envio';      // el envío interno a medio cargar (el mostrador)
  var K_REMITO_VER = 'pos_remito';         // el remito que se está recibiendo, en sessionStorage
  var K_CONTEO = 'pos_conteo_remito';      // lo contado de cada remito: si se cierra la pestaña, sigue ahí

  /* ── Los menús: las secciones de Tango y Dragonfish, con los nombres de BlueSoft ── */
  var MENUS = {
    mostrador: [
      /* Las notas de crédito (SQL 205), después de los cambios, como en el menú de BlueSoft. */
      ['Ventas', [['venta', 'Nueva venta', 'venta'], ['tickets', 'Tickets', 'tickets'],
                  ['cambios', 'Cambios', 'cambio'], ['notas', 'Notas de crédito', 'nc'], ['fallida', 'Venta fallida', 'fallida'],
                  /* Los clientes (SQL 197), con los socios del Club: como la «Administración de clientes» de la PC del local. */
                  ['clientes', 'Clientes', 'clientes'],
                  /* Las ventas por vendedor (SQL 192) y por productos (SQL 196, el "resumen de ventas"), como en la PC del local de BlueSoft. */
                  ['vendedores', 'Ventas por vendedor', 'vendedores'], ['porproducto', 'Ventas por productos', 'vprod']]],
      /* El stock y los remitos (SQL 160): el local recibe la mercadería y mira lo que tiene.
         La devolución a fábrica (SQL 189): lo que el local le devuelve, como en BlueSoft.
         Los depósitos (SQL 193): el de cada temporada, para el stock de todo el local. */
      ['Mercadería', [['remitos', 'Remitos', 'recepcion'], ['envios', 'Envíos internos', 'envio'], ['devoluciones', 'Devolución a fábrica', 'devolucion'], ['stock', 'Stock', 'stock'],
                      ['depositos', 'Depósitos', 'deposito']]],
      /* Los gastos se cargan durante el día, lo de la caja fuerte se pasa antes de cerrar (SQL 180) y el cierre se hace a la noche (SQL 149);
         los retiros de fondos (SQL 191) sacan plata de la caja chica o de la fuerte. Los listados de todas las sucursales quedan en Gestión. */
      ['Caja', [['gastos', 'Gastos', 'gasto'], ['salidas', 'Movimientos de salida', 'fuerte'], ['retiros', 'Retiros de fondos', 'retiro'], ['cierre', 'Cierre de caja', 'caja']]]
    ],
    gestion: [
      ['Artículos', [['productos', 'Productos', 'producto'], ['listas', 'Listas de precios', 'lista'], ['promos', 'Promociones', 'promo']]],
      ['Stock', [['stock', 'Stock', 'stock'], ['depositos', 'Depósitos', 'deposito'], ['remitos', 'Remitos', 'envio'], ['diferencias', 'Diferencias', 'dif'], ['inventario', 'Inventario', 'inventario']]],
      /* La disponibilidad (SQL 195): cuánto hay en cada caja y, al tocarla, sus movimientos ("Consulta de Valores" de BlueSoft). */
      ['Caja', [['disponibilidad', 'Disponibilidad', 'disp'], ['cierres', 'Cierres de caja', 'caja'], ['movimientos', 'Movimientos', 'movs']]],
      ['Clientes y reportes', [['clientes', 'Clientes', 'clientes'], ['vendedores', 'Ventas por vendedor', 'vendedores'], ['porproducto', 'Ventas por productos', 'vprod'],
                                ['reportes', 'Reportes', 'reportes']]],
      ['Configuración', [['sucursales', 'Sucursales', 'sucursal'], ['medios', 'Medios de pago', 'medios'], ['arca', 'Facturación (ARCA)', 'arca']]]
    ]
  };
  var MENU = MENUS[MODO];
  /* Las pantallas que no están en el menú y se abren desde otra (en el menú queda marcada ésa). */
  var DENTRO = { mostrador: { cambio: 'cambios', remito: 'remitos', devolucion_nueva: 'devoluciones', envio_nuevo: 'envios' }, gestion: { remito_nuevo: 'remitos' } };
  var INICIO = { mostrador: 'venta', gestion: 'listas' };
  /* SQL 190: lo que pide cada pantalla del mostrador (las casillas de Config → Usuarios). Sin el permiso, no está en el menú. */
  var REQUIERE = { envios: 'envios', envio_nuevo: 'envios', depositos: 'envios', devoluciones: 'envios', devolucion_nueva: 'envios', gastos: 'caja', salidas: 'caja', retiros: 'caja', cierre: 'caja' };
  var SIN_PERMISO = { envios: 'No tenés permiso para los envíos internos ni las devoluciones a fábrica.',
                      caja: 'No tenés permiso para la caja (gastos, movimientos de salida, retiros y cierre).' };
  var HECHAS = { venta: 1, tickets: 1, cambios: 1, notas: 1, fallida: 1, clientes: 1, vendedores: 1, porproducto: 1, gastos: 1, salidas: 1, retiros: 1, cierre: 1, disponibilidad: 1, cierres: 1, movimientos: 1, productos: 1, listas: 1, promos: 1, sucursales: 1,
                 stock: 1, remitos: 1, diferencias: 1, inventario: 1, devoluciones: 1, envios: 1, depositos: 1 };
  var LETRAS = { A: 'Factura A', B: 'Factura B', X: 'X · interno' };

  /* Lo que va a tener cada sección que todavía no está (de la investigación del 20/10 y del mapa de BlueSoft). */
  var PRONTO = {
    reportes: ['Reportes', [
      'Ventas por sucursal y por medio de pago (las de por vendedor y por producto ya están, en «Ventas por vendedor» y «Ventas por productos»).',
      'Por día, por semana y por mes, comparado con el año pasado.',
      'La conversión por sucursal y por vendedor, día por día (la del período ya está en Tickets).',
      'Que alimente sola la planilla de Ventas, sin cargar nada a mano.'], 'Mientras tanto, los tickets del día y sus totales están en <a href="pos.html#tickets">POS → Tickets</a>.'],
    medios: ['Medios de pago', [
      'Las tarjetas y sus cuotas, con recargo o sin interés.',
      'Mercado Pago: probar el Point Smart conectado a la caja (es el único posnet que se puede integrar sin instalar nada).',
      'Payway, MODO, Go Cuotas y transferencias: el cupón se carga a mano y después se concilia.'], ''],
    arca: ['Facturación (ARCA)', [
      'Factura A y B electrónica, con el CAE en el momento.',
      'El comprobante al cliente por mail o WhatsApp (con su sí, que queda anotado) y una impresora de respaldo por local.',
      'Si ARCA no contesta, el CAEA (el de contingencia), como pide la RG 5782.',
      'Hace falta el certificado de Black Fish (primero el de prueba) y el punto de venta de cada local. La clave fiscal nunca va por el chat.'],
      'Mientras tanto, la factura la sigue haciendo BlueSoft.']
  };

  var MEDIOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', mercadopago: 'Mercado Pago', modo: 'MODO', go_cuotas: 'Go Cuotas', transferencia: 'Transferencia' };
  /* SQL 200: la venta también se cobra con una gift card (el cambio y las promos, no). */
  var MEDIOS_VENTA = Object.assign({}, MEDIOS, { giftcard: 'Gift card' });
  var TARJETAS = [['VISA', 'credito'], ['VISA Débito', 'debito'], ['Mastercard', 'credito'], ['Master Débito', 'debito'],
                  ['AMEX', 'credito'], ['Naranja', 'credito'], ['Cabal', 'credito'], ['Cabal Débito', 'debito'], ['Maestro', 'debito'],
                  ['Otra de crédito', 'credito'], ['Otra de débito', 'debito']];
  var CUOTAS = [1, 2, 3, 6, 9, 12, 18, 24];
  var CONDICION = { consumidor_final: 'Consumidor final', responsable_inscripto: 'Responsable inscripto', monotributo: 'Monotributo', exento: 'Exento' };
  /* La lista del "Agregar descuento" de BlueSoft. */
  var DESCUENTOS = [['Descuento 5 %', 5], ['Descuento 15 %', 15], ['Descuento 25 %', 25], ['Descuento 40 %', 40],
                    ['Por pronto pago 10 %', 10], ['Por pronto pago 20 %', 20], ['Por pronto pago 30 %', 30], ['Por pronto pago 35 %', 35],
                    ['Por pronto pago 50 %', 50], ['Por pronto pago 70 %', 70], ['Descuento de fábrica', 0], ['Cupón de descuento', 0],
                    ['Otros descuentos', 0], ['Redondeo negativo', 0]];
  var TIPOS_PROMO = { lleva_paga: 'Lleva y paga menos (3x2, 4x3…)', segunda: 'La segunda prenda con descuento', medio_pago: 'Pagando con un medio (10 % en efectivo…)' };
  /* Los motivos de la "Nueva venta fallida" de BlueSoft, en su orden (SQL 171). */
  var MOTIVOS = [['producto', 'No teníamos el producto'], ['talle', 'No teníamos el talle'], ['color', 'Falta de color'], ['tipo', 'Falta de tipo de producto'],
                 ['precio', 'Por precio'], ['gusto', 'No le gustaron los productos'], ['mirar', 'Entró a mirar'], ['otro', 'Otro motivo']];
  function nombreMotivo(m) { var x = MOTIVOS.filter(function (y) { return y[0] === m; })[0]; return x ? x[1] : m; }

  /* ── Íconos (trazos de 24×24) ── */
  var TRAZO = {
    venta: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M12 10v6M9 13h6"/>',
    tickets: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    cambio: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    nc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/>',
    fallida: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    caja: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    movs: '<path d="M7 3v18M3 7l4-4 4 4"/><path d="M17 21V3M13 17l4 4 4-4"/>',
    disp: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    gasto: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    fuerte: '<rect x="3" y="3" width="18" height="15" rx="2"/><circle cx="12" cy="10.5" r="3.5"/><path d="M12 10.5l2-2M7 18v3M17 18v3"/>',
    retiro: '<rect x="2" y="10" width="20" height="11" rx="2"/><circle cx="12" cy="15.5" r="2.5"/><path d="M12 7.5V2M9 4.5l3-3 3 3"/>',
    stock: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    deposito: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9"/><path d="M7 15h10M7 18h10"/>',
    envio: '<path d="M1 4h14v12H1z"/><path d="M15 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    recepcion: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    devolucion: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    inventario: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    dif: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    producto: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    promo: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    reportes: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/>',
    vprod: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 6h12M7 11h8M7 16h3"/>',
    vendedores: '<circle cx="8" cy="7" r="3.5"/><path d="M2 20v-1a6 6 0 0 1 9.5-4.9"/><path d="M15 20v-3M18.5 20v-6M22 20v-9"/>',
    sucursal: '<path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/>',
    medios: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    arca: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    volver: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    prueba: '<path d="M9 3h6M10 3v6l-5.4 9.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9V3"/><path d="M7.2 15h9.6"/>',
    yo: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    entra: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    sale: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>'
  };
  /* La bolsa de la marca, la misma del rail (en el mostrador no hay rail). */
  var BOLSA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<g stroke-width="1.55"><path d="M9.1 8.6V6.1a2.85 2.85 0 0 1 5.7 0v2.4"/><path d="M18.6 6.2 7.4 6.7Q6.2 6.75 6.35 7.95L8.05 19.6Q8.25 20.85 9.45 20.45L19.6 16.9"/>' +
    '<path d="M5.35 7.3 3.85 19.55Q3.75 20.45 4.65 20.15Q6.35 19.7 7.3 20.85"/></g>' +
    '<circle cx="9.1" cy="8.9" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.8" cy="8.8" r="1.15" fill="currentColor" stroke="none"/></svg>';
  function icono(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TRAZO[n] || '') + '</svg>';
  }

  /* ── La plata, en centavos ── */
  function cent(n) { return Math.round(Number(n) * 100); }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /** 2000000 → "$20.000"; 1633333 → "$16.333,33". */
  function plata(c) {
    c = Math.round(Number(c) || 0);
    var neg = c < 0, a = Math.abs(c), r = a % 100;
    return (neg ? '−' : '') + '$' + miles(Math.floor(a / 100)) + (r ? ',' + ('0' + r).slice(-2) : '');
  }
  function plataCampo(c) { return c ? plata(c).slice(1) : ''; }
  /** Lo que escriben: "20.000", "20000", "16.333,33", "$ 1500" → centavos (NaN si no es un número). */
  function leerPlata(s) {
    s = String(s == null ? '' : s).replace(/[$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  }
  function aPesos(c) { return Math.round(c) / 100; }
  /** 1.8333 → "1,8"; 0.375 (una proporción) → "37,5 %". */
  function decimal(n) { return String(Math.round(Number(n) * 10) / 10).replace('.', ','); }
  function porcentaje(x) { return decimal(Number(x) * 100) + ' %'; }

  function fechaCorta(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function fechaHora(ts) {
    try {
      return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        .format(new Date(ts)).replace(',', '');
    } catch (e) { return String(ts || '').slice(0, 16).replace('T', ' '); }
  }
  function cuit(d) { d = String(d || ''); return d.length === 11 ? d.slice(0, 2) + '-' + d.slice(2, 10) + '-' + d.slice(10) : d; }
  function nuevaClave() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  /* El número que se ve: cada serie numera aparte (SQL 147). Las facturas "Nº 12", las X "X-4" y las pruebas "P-3". */
  function refCorta(v) { return v.serie === 'prueba' ? 'P-' + v.numero : v.serie === 'x' ? 'X-' + v.numero : String(v.numero); }
  function ref(v) { return v.serie === 'prueba' || v.serie === 'x' ? refCorta(v) : 'Nº ' + v.numero; }
  function nombreVenta(v) { return (v.serie === 'prueba' ? 'Prueba ' : 'Venta ') + ref(v); }
  /* Los cambios numeran aparte de las ventas (SQL 151): "C-4", y las pruebas "CP-2". */
  function refCambio(c) { return (c.prueba ? 'CP-' : 'C-') + c.numero; }
  /* Las notas de crédito, también aparte (SQL 205): "NC-3", y las de prueba "NCP-1". */
  function refNota(n) { return (n.prueba ? 'NCP-' : 'NC-') + n.numero; }

  /* ── El modo prueba: la venta hace el mismo camino que una de verdad, pero no cuenta ──
     Vive en sessionStorage: al cerrar la ventana vuelve solo a lo de verdad, así no queda
     prendido de un día para el otro. */
  function enPrueba() {
    if (MODO !== 'mostrador') return false;
    try { return sessionStorage.getItem(K_PRUEBA) === '1'; } catch (e) { return false; }
  }
  function marcarPrueba() { document.documentElement.classList.toggle('pos-en-prueba', enPrueba()); }
  marcarPrueba();

  /* ── El catálogo: los artículos de la base (SQL 202) y, de respaldo, catalogo.js ──
     Cada producto: [código, nombre, rubro, "S,M,L", "NE:NEGRO|BL:BLANCO", orden de la temporada, activo,
     familia, temporada, marca]. catalogo.js trae sólo los cinco primeros (las temporadas 39 a 41, los 576 del
     No Compra). Los de la base (pos_articulos: los 7.072 de BlueSoft, con Verano 2025, Continuidad, Promo y
     Segunda) los pisan y quedan guardados en la compu (K_ART): sin internet la venta los sigue encontrando.
     El inactivo no sale al buscar por nombre; por el código (la pistola) sí.
     PROD también se encuentra en mayúsculas: la pistola escribe "BE40941" y en BlueSoft está "be40941". */
  var K_ART = 'pos_articulos';
  var PROD = {}, LISTA_PROD = [], BUSCA = [], RUBROS = [];
  /** "41 Verano 2027" → 4054, "40 Invierno 2026" → 4053: el más nuevo, más alto. Continuidad, arriba de todo. */
  function ordenTemporada(t) {
    t = String(t || '');
    if (/continuidad|exitos/i.test(t)) return 9000;
    var m = t.match(/(verano|invierno)\s*(\d{4})/i);
    if (m) return Number(m[2]) * 2 + (/invierno/i.test(m[1]) ? 1 : 0);
    return /promo|segunda/i.test(t) ? 4040 : 0;
  }
  function armarCatalogo(arts) {
    var m = {}, rs = {};
    /* Por el código en mayúsculas, como los precios y el stock: el be40941 de catalogo.js y el BE40941 de la base son uno. */
    (window.CATALOGO || []).forEach(function (p) { m[p[0].toUpperCase()] = [p[0], p[1], p[2] || '', p[3] || '', p[4] || '', 9999, true, '', '', '']; });
    (arts || []).forEach(function (a) { m[a[0].toUpperCase()] = [a[0], a[1], a[2] || '', a[3] || '', a[4] || '', ordenTemporada(a[5]), a[6] !== false, a[7] || '', a[5] || '', a[8] || '']; });
    PROD = {}; LISTA_PROD = []; BUSCA = [];
    Object.keys(m).forEach(function (k) {
      var p = m[k];
      PROD[k] = p;
      if (p[0] !== k) PROD[p[0]] = p;
      LISTA_PROD.push(p);
      BUSCA.push({ p: p, cod: k.toLowerCase(), nom: normal(p[1]) });
      if (p[6] && p[2]) rs[p[2]] = 1;
    });
    RUBROS = Object.keys(rs).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }
  var ART = leerJSON(K_ART, null);   // { n, v, filas }: la copia de la última vez
  if (!ART || !Array.isArray(ART.filas)) ART = null;
  armarCatalogo(ART && ART.filas);
  function titulo(s) { return String(s || '').toLowerCase().replace(/(^|[\s/-])\S/g, function (c) { return c.toUpperCase(); }); }
  function coloresDe(p) {
    return String((p && p[4]) || '').split('|').filter(Boolean).map(function (x) {
      var i = x.indexOf(':');
      return i < 0 ? { cod: x, nom: titulo(x) } : { cod: x.slice(0, i), nom: titulo(x.slice(i + 1)) };
    });
  }
  function tallesDe(p) { return String((p && p[3]) || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean); }
  function nombreColor(cod, codigo) {
    var c = coloresDe(PROD[codigo]).filter(function (x) { return x.cod === cod; })[0];
    return c ? c.nom : (cod || '');
  }

  /* ── La base ── */
  var S = { ini: null, precios: {}, preciosVer: {}, vista: 'venta', guardando: false, ultimo: null, listaSel: null, cajaLocal: null, cajaHecho: null,
            cambioHecho: null, cbFoco: null, cbPagoHay: null, stock: {}, dep: {} };
  var V = null;    // la venta que se está armando
  var CB = null;   // el cambio que se está armando

  function llamar(nombre, args) {
    return persona.token().then(function (t) { return funcion(nombre, args || {}, t); });
  }
  function esDeRed(e) { return !(e && (e.delServidor || e.sinSesion)); }
  function mensajeDe(e) {
    var m = String((e && e.message) || e || '');
    /* El 147 (pruebas y la X) cambia pos_tickets y suma pos_pruebas_borrar; con el 146 solo, la X no existe.
       El 149 suma la caja (pos_caja…, pos_cierre…). El 160, el stock y los remitos. El 167, las diferencias
       (y quién recibió: p_recibio). El 171, la venta fallida y el socio del Club. El 172, el stock de a tandas
       y por rubro (p_productos, p_resumen). */
    if (/Could not find the function|schema cache|PGRST202/.test(m)) {
      return 'Todavía falta correr el SQL ' + (/pos_nc_hacer|pos_notas_credito/.test(m) ? '205 (las notas de crédito)' :
                                             /pos_remitos_producto/.test(m) ? '204 (buscar un producto en los remitos)' :
                                             /pos_articul/.test(m) ? '202 (los productos)' :
                                             /pos_lista_(subir|aumentar|rubros|cambios|deshacer)/.test(m) ? '201 (subir y aumentar las listas de precios)' :
                                             /pos_giftcard/.test(m) ? '200 (las gift cards en el POS)' :
                                             /pos_client|pos_cli_/.test(m) ? '197 (los clientes)' :
                                             /pos_ventas_productos|pos_ventas_de_producto/.test(m) ? '196 (las ventas por productos)' :
                                             /pos_disponibilidad|pos_caja_valores|pos_caja_ajust/.test(m) ? '195 (la disponibilidad de las cajas)' :
                                             /pos_deposito|pos_remito_testigo|p_deposito/.test(m) ? '193 (los depósitos)' : /pos_ventas_vendedor/.test(m) ? '192 (las ventas por vendedor)' : /pos_retiran|pos_caja_mov_controlar/.test(m) ? '191 (los retiros de fondos)' : /p_productos|p_resumen/.test(m) ? '172 (el stock de a tandas y por rubro)' :
                                             /pos_fallida|pos_club/.test(m) ? '171 (la venta fallida y el socio del Club)' :
                                             /pos_diferencia|pos_remito_fabrica|p_recibio|p_motivo/.test(m) ? '167 (las diferencias de los remitos)' :
                                             /pos_stock|pos_remito|pos_inventario/.test(m) ? '160 (el stock y los remitos)' : /pos_cambio/.test(m) ? '151 (los cambios)' : /pos_caja|pos_cierre/.test(m) ? '149 (el cierre de caja)' : /pos_tickets|pos_pruebas_borrar/.test(m) ? '147 (el del POS)' : '146 (el del POS)') + ' en Supabase.';
    }
    if (/tiene que ser A o B/.test(m)) return 'Todavía falta correr el SQL 147 (el de la X) en Supabase.';
    if (esDeRed(e)) return 'Sin conexión: no se pudo hablar con la base.';
    return m.replace(/^La base respondió \d+: /, '');
  }

  function localDe(id) { return ((S.ini && S.ini.locales) || []).filter(function (l) { return l.id === id; })[0] || null; }
  function listaPorId(id) { return ((S.ini && S.ini.listas) || []).filter(function (l) { return l.id === id; })[0] || null; }
  function listaDe(l) { return (l && l.lista_id) || (S.ini.listas[0] && S.ini.listas[0].id) || null; }
  function nombreLocal(l) { return l ? bonito(l.nombre) : ''; }

  function asegurarPrecios(lista) {
    if (!lista) return Promise.resolve({});
    if (S.precios[lista]) return Promise.resolve(S.precios[lista]);
    /* SQL 201: primero la "versión" de la lista y después los precios (si algo cambia en el medio, la próxima
       vez la versión no coincide y se vuelven a traer). Sin el SQL 201, sin versión: como antes. */
    var ver = null;
    return llamar('pos_precios_version', { p_lista: lista }).then(function (v) { ver = v; }, function () {}).then(function () {
      return llamar('pos_precios', { p_lista: lista });
    }).then(function (filas) {
      var m = {};
      (filas || []).forEach(function (f) { m[f[0]] = { c: cent(f[1]), propio: !!f[2] }; });
      S.precios[lista] = m;
      S.preciosVer[lista] = ver;
      return m;
    });
  }
  /** Al empezar una venta o un cambio: si en la oficina subieron o aumentaron la lista desde que se trajo, se trae
      de nuevo (una caja abierta todo el día cobra igual el precio nuevo). Preguntar cuesta unas letras; la lista
      entera viaja sólo si cambió. Sin conexión, con la que ya estaba. */
  function preciosAlDia(lista) {
    if (!lista || !S.precios[lista] || !S.preciosVer[lista]) return asegurarPrecios(lista);
    return llamar('pos_precios_version', { p_lista: lista }).then(function (v) {
      if (v !== S.preciosVer[lista]) delete S.precios[lista];
      return asegurarPrecios(lista);
    }, function () { return S.precios[lista]; });
  }
  function precioDe(codigo, lista) {
    var m = S.precios[lista || (V && V.lista_id)], x = m && m[codigo];
    return x ? x.c : null;
  }
  /** Cambió un precio de una lista: también cambian las que se calculan de ella. */
  function olvidarPrecios(lista) {
    delete S.precios[lista];
    S.ini.listas.forEach(function (l) { if (l.base_id === lista) delete S.precios[l.id]; });
  }

  /* ── Los artículos de la base (SQL 202) ──
     Al abrir se pregunta si cambiaron (pos_articulos_version, liviana); recién ahí se bajan todos y se guardan
     en la compu. Nunca frena: sin el SQL 202 o sin conexión, sigue con la copia o con catalogo.js. */
  function traerArticulos(forzar) {
    if (S.sin202) return Promise.resolve(false);
    return llamar('pos_articulos_version').then(function (ver) {
      if (!forzar && ART && ver && ART.n === ver.n && ART.v === ver.v) return false;
      return llamar('pos_articulos_todos').then(function (d) { ponerArticulos(d); return true; });
    }).catch(function (e) { if (sinFuncion(e)) S.sin202 = true; return false; });
  }
  function ponerArticulos(d) {
    ART = d;
    try { localStorage.setItem(K_ART, JSON.stringify(d)); } catch (e) { /* sin lugar en la compu: queda en la memoria */ }
    armarCatalogo(d.filas);
  }
  /** Se guardó uno en Gestión → Productos: se cambia en la copia, y la próxima vez que abra se baja todo de nuevo. */
  function cambiarArticulo(fila) {
    if (!ART) return traerArticulos(true);
    var filas = ART.filas.filter(function (a) { return a[0] !== fila[0]; });
    filas.push(fila);
    ponerArticulos({ n: null, v: null, filas: filas });
  }

  /* ── El stock del local (SQL 160): para avisar en la venta y el cambio si una prenda no está ──
     S.stock[local] = { con: si ya tiene stock cargado, m: { "CÓDIGO|TALLE|COLOR": cantidad } }.
     Nunca frena: sin el SQL 160 o sin conexión, la venta sigue igual y sin el aviso. */
  function claveVar(cod, talle, color) { return [cod || '', talle || '', color || ''].join('|').toUpperCase(); }
  function traerStock(local, forzar) {
    if (!local) return Promise.resolve(null);
    if (S.stock[local] && !forzar) return Promise.resolve(S.stock[local]);
    return llamar('pos_stock_local', { p_local: local }).then(function (d) {
      var m = {};
      (d.filas || []).forEach(function (f) { m[claveVar(f[0], f[1], f[2])] = f[3]; });
      return (S.stock[local] = { con: !!d.con_stock, m: m });
    }, function () { return null; });
  }
  /* ── Los depósitos (SQL 193): cada sucursal tiene uno o más; las ventas, los cambios y los remitos van al predeterminado ──
     S.dep[local] = lo que devuelve pos_depositos de esa sucursal. Sin el SQL 193 (S.sin193): [] y todo sigue como antes,
     un stock por local. Las funciones viejas no tienen p_deposito: sólo se manda cuando se eligió un depósito. */
  function sinFuncion(e) { return /Could not find the function|schema cache|PGRST202/.test(String((e && e.message) || e || '')); }
  function traerDepositos(local, forzar) {
    if (!local || S.sin193) return Promise.resolve([]);
    if (S.dep[local] && !forzar) return Promise.resolve(S.dep[local]);
    return llamar('pos_depositos', { p_local: local }).then(function (d) { return (S.dep[local] = d || []); },
      function (e) { if (sinFuncion(e)) S.sin193 = true; return []; });
  }
  function depPredeterminado(ds) { return (ds || []).filter(function (d) { return d.predeterminado; })[0] || null; }
  function depDe(ds, id) { return (ds || []).filter(function (d) { return d.id === id; })[0] || null; }
  /** «Verano 2027 (predeterminado)», para los desplegables. */
  function nombreDep(d) { return d.nombre + (d.predeterminado ? ' (predeterminado)' : !d.activo ? ' (inactivo)' : !d.consulta ? ' (fuera de la consulta)' : ''); }
  function pillsDep(d) {
    return (d.predeterminado ? '<span class="pill pill-ok" title="Las ventas, los cambios y los remitos van a éste">Predeterminado</span>' : '') +
      (!d.activo ? '<span class="pill pill-bad">Inactivo</span>' : !d.consulta ? '<span class="pill" title="No suma en la consulta de stock">Fuera de la consulta</span>' : '');
  }
  /** La temporada del depósito nuevo: de julio a diciembre, el Verano del año que sigue; de enero a junio, el Invierno de ese año. */
  function temporadaNueva() {
    var p = String(S.ini.hoy || '').split('-'), a = Number(p[0]) || new Date().getFullYear(), m = Number(p[1]) || new Date().getMonth() + 1;
    return m >= 7 ? ['Verano', a + 1] : ['Invierno', a];
  }
  /** El campo «Depósito» de la venta y el cambio: el predeterminado de la sucursal (sin el SQL 193 sigue «Ventas»). */
  function ponerDeposito(id, local) {
    var i = $(id);
    if (i) i.setAttribute('data-l', local || '');
    traerDepositos(local).then(function (ds) {
      var x = $(id), d = depPredeterminado(ds);
      if (!x || !d || x.getAttribute('data-l') !== local) return;
      x.value = d.nombre;
      x.title = 'El depósito predeterminado de la sucursal: se cambia en Mercadería → Depósitos';
    });
  }
  /** Cuántas hay de una prenda en el local según el sistema; null si no se sabe (todavía no tiene stock cargado). */
  function hayEnLocal(local, cod, talle, color) {
    var x = S.stock[local];
    return x && x.con && cod ? x.m[claveVar(cod, talle, color)] || 0 : null;
  }
  /** En la grilla: "sin stock" o "hay 1" cuando lo que se lleva es más de lo que hay. */
  function pillStock(local, l) {
    var h = l.libre ? null : hayEnLocal(local, l.codigo, l.talle, l.color);
    if (h == null || h >= l.cantidad) return '';
    return '<span class="st-pill" title="Según el sistema hay ' + h + ' en la sucursal. Se vende igual y queda en negativo.">' + (h > 0 ? 'hay ' + h : 'sin stock') + '</span>';
  }
  /** Al agregar una prenda: si no tiene precio, y si el sistema dice que no está en la sucursal. */
  function avisarAlAgregar(p, local, talle, color, sinPrecio, lineas) {
    var a = [], cod = p[0];
    if (sinPrecio) a.push(p[1] + ' no tiene precio en esta lista: escribilo en «Precio unit.».');
    var h = hayEnLocal(local, cod, talle, color);
    var n = lineas.filter(function (l) { return !l.libre && l.codigo === cod && l.talle === (talle || '') && l.color === (color || ''); })
                  .reduce(function (t, l) { return t + l.cantidad; }, 0);
    if (h != null && h < n) {
      var nom = p[1] + (talle ? ' ' + talle : '') + (color ? ' ' + nombreColor(color, cod) : '');
      a.push((sinPrecio ? 'Y según' : 'Según') + ' el sistema ' + (h > 0 ? 'hay sólo ' + h : 'no hay') + (sinPrecio ? '' : ' ' + nom) + ' en la sucursal: se vende igual.');
    }
    if (a.length) avisar('info', a.join(' '));
  }

  /* ════════════════════════════════════════════════════════════════════
     ARRANQUE: quien tiene el POS (SQL 190: «Usa el POS» en Config → Usuarios)
     ════════════════════════════════════════════════════════════════════ */
  function arrancar() {
    var y = persona.yo();
    /* El mostrador, quien tenga «Usa el POS» (lo dice nc_yo); la Gestión, sólo Administración. La base lo vuelve a mirar. */
    if (!y || (persona.rol() !== 'admin' && (MODO === 'gestion' || y.pos !== true))) { pantallaPorton(y); return; }
    app.innerHTML = '<p class="cargando">Cargando…</p>';
    llamar('pos_inicio').then(function (ini) {
      S.ini = ini;
      if (!ini.locales || !ini.locales.length) { app.innerHTML = '<div class="pos-cartel">No hay sucursales cargadas.</div>'; return; }
      S.artPromesa = traerArticulos();   // SQL 202: todos los productos, sin esperarlos (la venta arranca con la copia)
      ir(vistaDelHash());
      cuentaDif();
    }).catch(function (e) {
      if (e && e.sinSesion) { pantallaPorton(null); return; }
      app.innerHTML = '<div class="pos-porton"><h2>' + (MODO === 'gestion' ? 'Gestión' : 'POS') + '</h2><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="reintentar">Probar de nuevo</button>' +
        (MODO === 'mostrador' ? '<a class="btn btn-sec btn-chico pos-porton-volver" href="index.html">‹ Volver al sistema</a>' : '') + '</div>';
      $('reintentar').onclick = arrancar;
    });
  }

  function pantallaPorton(y) {
    var titulo = MODO === 'gestion' ? 'Gestión' : 'POS';
    app.innerHTML = '<section class="pos-porton"><h2>' + titulo + '</h2>' +
      '<p>' + (MODO === 'gestion' ? 'La parte de atrás del POS: precios, promociones, stock y sucursales.' :
                                    'El punto de venta propio, para reemplazar a BlueSoft en las sucursales.') + ' Todavía está en construcción.</p>' +
      '<div id="posPorton"></div>' +
      /* En el mostrador no hay barra: el camino de vuelta va acá. */
      (MODO === 'mostrador' ? '<a class="btn btn-sec btn-chico pos-porton-volver" href="index.html">‹ Volver al sistema</a>' : '') + '</section>';
    var c = $('posPorton');
    if (y) {
      c.innerHTML = '<p class="ncp-porton-txt">Entraste como <b>' + esc(y.nombre) + '</b>. ' +
        (MODO === 'gestion' ? 'La Gestión del POS es de la oficina: la usa Administración.' : 'Todavía no tenés el POS: lo prende la oficina en Config → Usuarios.') + '</p>';
      return;
    }
    persona.porton(c, MODO === 'gestion' ? 'La usa Administración.' : 'Entrá con tu usuario: lo usa quien tiene el POS prendido.');
  }

  function vistaDelHash() { return String(location.hash || '').replace(/^#\/?/, '') || INICIO[MODO]; }
  function enMenu(menu, v) { return menu.some(function (g) { return g[1].some(function (it) { return it[0] === v && !it[3]; }); }); }

  function esDe(modo, v) { return enMenu(MENUS[modo], v) || !!DENTRO[modo][v]; }

  function ir(v) {
    /* Una dirección vieja (pos.html#listas) o un enlace a la otra pantalla: se va para allá. */
    var otro = MODO === 'gestion' ? 'mostrador' : 'gestion';
    if (!esDe(MODO, v) && esDe(otro, v)) { location.replace(PAGINA[otro] + '#' + v); return; }
    if (!esDe(MODO, v)) v = INICIO[MODO];
    S.vista = v;
    try { history.replaceState(null, '', location.pathname + location.search + '#' + v); } catch (e) {}
    cerrarVentana();
    app.innerHTML = marco();
    engancharMenu();
    if (REQUIERE[v] && !puede(REQUIERE[v])) {
      $('cuerpo').innerHTML = '<div class="pos-cartel">' + esc(SIN_PERMISO[REQUIERE[v]]) + ' Lo da la oficina en Config → Usuarios.</div>';
      return;
    }
    var ver = { venta: verVenta, tickets: verTickets, cambios: verCambios, cambio: verCambio, notas: verNotas, fallida: verFallidas, clientes: function () { verClientes(); }, vendedores: verVendedores, porproducto: function () { verPorProducto(); }, gastos: verGastos, salidas: verSalidas,
                retiros: verRetiros, cierre: verCierre, disponibilidad: verDisponibilidad, cierres: verCierres,
                movimientos: verMovimientos, productos: function () { verProductos(); }, listas: verListas, promos: verPromos, sucursales: verSucursales,
                stock: verStock, remitos: verRemitos, remito: verRemito, remito_nuevo: verRemitoNuevo, diferencias: verDiferencias, inventario: verInventario,
                devoluciones: verDevoluciones, devolucion_nueva: verDevolucionNueva, envios: verEnvios, envio_nuevo: verEnvioNuevo, depositos: verDepositos }[v];
    if (ver) ver(); else verPronto(v);
  }
  window.addEventListener('hashchange', function () { var v = vistaDelHash(); if (S.ini && v !== S.vista) ir(v); });

  function ponerPrueba(si) {
    try { if (si) sessionStorage.setItem(K_PRUEBA, '1'); else sessionStorage.removeItem(K_PRUEBA); } catch (e) {}
    /* El cartel de la última venta guardada (y el del último cierre y el del último cambio) es de la otra numeración: no se mezcla. */
    S.ultimo = null;
    S.cajaHecho = null;
    S.cambioHecho = null;
    marcarPrueba();
    ir(S.vista);
    avisar('info', si ? 'Modo prueba: lo que guardes numera aparte (P-1, P-2…) y no cuenta para nada.' : 'Listo: volviste a las ventas de verdad.');
  }

  /* ── El menú de la izquierda ── */
  /* La venta y el cambio necesitan el ancho (el ticket de BlueSoft): arrancan con el menú achicado. Tickets también
     (SQL 171): con el panel de la derecha, la lista entra entera en la PC del local. */
  function vistaAncha() { return S.vista === 'venta' || S.vista === 'cambio' || S.vista === 'tickets'; }
  function menuChico() { return vistaAncha() ? leer(K_MENU_VENTA) !== 'abierto' : Interfaz.panelChico(K_MENU); }
  function guardarMenu(ch) { if (vistaAncha()) guardar(K_MENU_VENTA, ch ? 'chico' : 'abierto'); else Interfaz.panelChico(K_MENU, ch); }

  function item(it) {
    var activa = it[0] === S.vista || it[0] === DENTRO[MODO][S.vista];
    var dentro = icono(it[2]) + '<span>' + esc(it[1]) + '</span>' + (HECHAS[it[0]] || it[3] ? '' : '<em class="pos-pronto">Pronto</em>') +
      (it[0] === 'diferencias' && S.difPend ? cuentaHtml(S.difPend) : '');
    if (it[3]) return '<a class="pos-item" href="' + it[3] + '" title="' + esc(it[1]) + ' (el No Compra)">' + dentro + '</a>';
    return '<button type="button" class="pos-item' + (activa ? ' activa' : '') + '" data-ir="' + it[0] + '" title="' + esc(it[1]) + '"' +
      (activa ? ' aria-current="page"' : '') + '>' + dentro + '</button>';
  }
  /* Las diferencias de los remitos sin resolver (SQL 167): el número al lado de "Diferencias", en Gestión. */
  function cuentaHtml(n) {
    return '<em class="pos-cuenta" title="' + n + (n === 1 ? ' diferencia sin resolver' : ' diferencias sin resolver') + '">' + (n > 99 ? '99+' : n) + '</em>';
  }
  function cuentaDif() {
    if (MODO !== 'gestion') return;
    llamar('pos_diferencias_aviso').then(function (a) { ponerCuentaDif(Number(a && a.pendientes) || 0); }, function () {});
  }
  function ponerCuentaDif(n) {
    S.difPend = n;
    var b = app.querySelector('.pos-item[data-ir="diferencias"]'), e = b && b.querySelector('.pos-cuenta');
    if (e) e.remove();
    if (b && n) b.insertAdjacentHTML('beforeend', cuentaHtml(n));
  }
  /** Cambió algo de las diferencias: se ponen al día el número del menú y el de la barra (persona.js). */
  function avisoAlDia() {
    cuentaDif();
    if (window.persona && persona.avisoDiferencias) persona.avisoDiferencias();
  }
  /* Gestión: cada grupo se despliega y se pliega (Mauricio, 20/10: "que se despliegue… si en algún
     momento tenemos más"). Arranca abierto el de la sección en la que está; lo demás, como lo dejó. */
  function grupoAbierto(g) {
    if (g[1].some(function (it) { return it[0] === S.vista || it[0] === DENTRO[MODO][S.vista]; })) return true;
    return (leerJSON(K_GRUPOS, {}) || {})[g[0]] === 1;
  }
  /** Adónde vuelve "‹ Sistema": a la pantalla de la que vino (si es del sistema), o a la Carga. */
  function volverAlSistema() {
    try {
      var r = new URL(document.referrer);
      var p = r.pathname.split('/').pop();
      if (r.origin === location.origin && /\.html$/.test(p) && p !== 'pos.html') return p + r.hash;
    } catch (e) {}
    return 'index.html';
  }

  /* SQL 190: el menú, sin lo que la persona no tiene (los envíos y las devoluciones, la caja). */
  function menuVisible() {
    return MENU.map(function (g) { return [g[0], g[1].filter(function (it) { return !REQUIERE[it[0]] || puede(REQUIERE[it[0]]); })]; })
               .filter(function (g) { return g[1].length; });
  }

  function marco() {
    var chico = menuChico(), y = persona.yo();
    var cab = MODO === 'gestion'
      ? '<div class="pos-menu-cab"><span>Gestión</span>' + Interfaz.botonPanel(chico, '', 'menuPos') + '</div>'
      : '<div class="pos-menu-cab"><span class="pos-marca" aria-hidden="true">' + BOLSA + '</span><span>POS</span>' + Interfaz.botonPanel(chico, '', 'menuPos') + '</div>' +
        '<a class="pos-item pos-volver" href="' + esc(volverAlSistema()) + '" title="Volver al sistema">' + icono('volver') + '<span>Sistema</span></a>';
    var cuerpo = MODO === 'gestion'
      ? menuVisible().map(function (g) {
          var ab = grupoAbierto(g);
          return '<button type="button" class="pos-grupo pos-grupo-btn" data-grupo="' + esc(g[0]) + '" aria-expanded="' + ab + '">' +
            '<span>' + esc(g[0]) + '</span>' + icono('abajo') + '</button>' +
            '<div class="pos-grupo-items' + (ab ? '' : ' cerrado') + '">' + g[1].map(item).join('') + '</div>';
        }).join('')
      : menuVisible().map(function (g) { return '<div class="pos-grupo" aria-hidden="true"></div>' + g[1].map(item).join(''); }).join('') +
        /* Abajo: el modo prueba y quién entró (en el mostrador no hay barra que lo diga). */
        '<div class="pos-menu-pie">' +
          '<label class="pos-item pos-modo" title="Modo prueba: lo que guardes no cuenta para nada">' + icono('prueba') + '<span>Modo prueba</span>' +
            '<span class="pos-switch chico"><input type="checkbox" id="posPrueba"' + (enPrueba() ? ' checked' : '') + ' aria-label="Modo prueba"><i></i></span></label>' +
          '<button type="button" class="pos-item pos-yo" id="posYo" title="' + esc(y ? y.nombre + ' · No soy yo' : 'Entrar') + '">' + icono('yo') +
            '<span>' + esc(y ? String(y.nombre || '').split(' ')[0] : 'Entrar') + '</span></button>' +
        '</div>';
    return '<div class="pos-grid' + (chico ? ' menu-chico' : '') + '">' +
      '<nav class="pos-menu" id="menuPos" aria-label="Secciones ' + (MODO === 'gestion' ? 'de Gestión' : 'del POS') + '">' + cab + cuerpo + '</nav>' +
      '<section class="pos-cuerpo" id="cuerpo"></section></div>';
  }

  /** El botón de achicar: se busca cada vez el que está (al tocarlo se rehace con el texto contrario). */
  function engancharMenu() {
    var pl = app.querySelector('.pos-menu .plegar-panel');
    if (pl) pl.onclick = function () {
      var g = app.querySelector('.pos-grid'), ch = !g.classList.contains('menu-chico');
      guardarMenu(ch);
      g.classList.toggle('menu-chico', ch);
      pl.outerHTML = Interfaz.botonPanel(ch, '', 'menuPos');
      engancharMenu();
      var nuevo = app.querySelector('.pos-menu .plegar-panel');
      if (nuevo) nuevo.focus();
    };
    app.querySelectorAll('.pos-menu [data-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; });
    app.querySelectorAll('.pos-menu [data-grupo]').forEach(function (b) {
      b.onclick = function () {
        var cont = b.nextElementSibling, ab = cont.classList.contains('cerrado');
        cont.classList.toggle('cerrado', !ab);
        b.setAttribute('aria-expanded', String(ab));
        var e = leerJSON(K_GRUPOS, {}) || {};
        e[b.getAttribute('data-grupo')] = ab ? 1 : 0;
        guardarJSON(K_GRUPOS, e);
      };
    });
    var pr = $('posPrueba');
    if (pr) pr.onchange = function () { ponerPrueba(pr.checked); };
    var yo = $('posYo');
    if (yo) yo.onclick = function () { persona.entrar(); };
    /* En el celular el menú es una tira: que se vea la sección abierta. */
    var m = app.querySelector('.pos-menu'), a = m && m.querySelector('.activa');
    if (m && a && m.scrollWidth > m.clientWidth + 1) m.scrollLeft = Math.max(0, a.offsetLeft - (m.clientWidth - a.offsetWidth) / 2);
  }

  function cabeza(titulo, sub, acciones) {
    return '<div class="pos-cab"><div><h2>' + titulo + '</h2>' + (sub ? '<span class="pos-sub">' + sub + '</span>' : '') + '</div>' +
      (acciones ? '<div class="pos-acciones">' + acciones + '</div>' : '') + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════════
     LAS VENTANAS
     ════════════════════════════════════════════════════════════════════ */
  var _velo = null, _alCerrar = null;
  function ventana(html, ancha) {
    cerrarVentana();
    _velo = document.createElement('div');
    _velo.className = 'pos-velo pos';   // "pos": los mismos campos compactos que la pantalla
    _velo.innerHTML = '<div class="pos-caja' + (ancha ? ' ancha' : '') + '" role="dialog" aria-modal="true" aria-labelledby="posVentTit" tabindex="-1">' +
      '<button type="button" class="pos-x" aria-label="Cerrar">' + icono('x') + '</button><div class="pos-caja-in">' + html + '</div></div>';
    document.body.appendChild(_velo);
    var caja = _velo.firstChild;
    _velo.addEventListener('mousedown', function (e) { if (e.target === _velo) cerrarVentana(); });
    caja.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); cerrarVentana(); } });
    caja.addEventListener('click', function (e) { if (e.target.closest('.pos-x, [data-cerrar]')) cerrarVentana(); });
    setTimeout(function () { var f = caja.querySelector('[autofocus]'); (f || caja).focus(); }, 0);
    return caja;
  }
  function cerrarVentana() {
    if (!_velo) return;
    _velo.remove();
    _velo = null;
    var f = _alCerrar; _alCerrar = null;
    if (f) f();
    var p = S.vista === 'venta' ? $('vProd') : S.vista === 'cambio' ? $(S.cbFoco || 'cbVuelve') : null;
    if (p) p.focus();
  }
  function errorEn(caja, id, txt) { var e = caja.querySelector('#' + id); if (e) e.textContent = txt || ''; return !txt; }

  /* ════════════════════════════════════════════════════════════════════
     LA VENTA
     ════════════════════════════════════════════════════════════════════ */
  function recuerdo() { return leerJSON(K_RECUERDO, {}) || {}; }
  /* Con cb, los del cambio (CB) en vez de los de la venta (V). */
  function recordar(cb) {
    var X = cb ? CB : V, r = recuerdo();
    r.local = X.local_id;
    r.vendedor = r.vendedor || {};
    if (X.vendedor) r.vendedor[X.local_id] = X.vendedor;
    guardarJSON(K_RECUERDO, r);
  }
  /* SQL 190: lo que puede la persona que entró. Sin el SQL 190 la base no lo manda: entonces es Administración y puede todo. */
  function puede(k) { var p = S.ini && S.ini.puede; return !p || p[k] !== false; }
  /* Los locales con los que trabaja: el suyo (y los que supervisa); con «Ver otros locales», todos. */
  function esMio(id) { var p = S.ini && S.ini.puede; return !!id && (!p || p.locales !== false || (p.mios || []).indexOf(id) >= 0); }
  function localesMios() { return S.ini.locales.filter(function (l) { return esMio(l.id); }); }
  function localMio(id) { return esMio(id) ? localDe(id) : null; }
  /** La opción "Todas" de las sucursales, sólo con «Ver otros locales». */
  function todasLasSucursales() { return puede('locales') ? '<option value="">Todas</option>' : ''; }
  /* Sin «Ver otros días», el período queda en hoy y no se mueve (la base tampoco deja ver otros días). */
  function periodoPos(host, op) {
    if (puede('dias')) return Interfaz.periodo(host, op);
    var sel = Interfaz.periodo(host, Object.assign({}, op, { inicial: 'hoy', guardar: null }));
    host.querySelectorAll('button').forEach(function (b) { b.disabled = true; b.title = 'Sólo hoy: para ver otros días, el permiso lo da la oficina en Config → Usuarios.'; });
    return sel;
  }
  function localInicial() {
    var r = recuerdo(), ls = localesMios();
    var x = localMio(r.local);
    if (!x) {
      var nc = String(leer('nc_local') || '').trim().toLowerCase();
      x = ls.filter(function (l) { return nc && (String(l.codigo || '').toLowerCase() === nc || String(l.nombre || '').toLowerCase() === nc); })[0];
    }
    if (!x && S.ini.yo) x = localMio(S.ini.yo.local_id);
    return x || ls[0] || S.ini.locales[0];
  }
  function vendedoresDe(localId) { return ((S.ini.vendedores || {})[localId] || []).slice(); }
  function vendedorInicial(l) {
    if (!l) return '';
    var r = recuerdo(), vs = vendedoresDe(l.id), nc = leer('nc_vendedor');
    if (r.vendedor && r.vendedor[l.id]) return r.vendedor[l.id];
    return vs.indexOf(nc) >= 0 ? nc : '';
  }
  function ventaNueva(antes) {
    var l = (antes && localMio(antes.local_id)) || localInicial();
    return { v: 1, clave: nuevaClave(), local_id: l ? l.id : null, vendedor: antes ? antes.vendedor : vendedorInicial(l),
             lista_id: listaDe(l), letra: 'B', cliente: null, socio: null, lineas: [], puestas: {}, manuales: [],
             forma: 'efectivo', pago: {}, multiples: null, observaciones: '' };
  }
  function cargarBorrador() {
    var b = leerJSON(K_BORRADOR, null);
    if (b && b.v === 1 && b.clave && Array.isArray(b.lineas) && localMio(b.local_id) && listaPorId(b.lista_id)) {
      /* Los borradores de antes del 29/10 traen "sacadas" (las promos iban solas): ahí ninguna está elegida. */
      b.puestas = b.puestas || {}; delete b.sacadas; b.manuales = b.manuales || []; b.pago = b.pago || {};
      if (!LETRAS[b.letra]) b.letra = 'B';
      if (b.letra === 'X' && b.forma !== 'efectivo') { b.forma = 'efectivo'; b.multiples = null; }
      return b;
    }
    return ventaNueva();
  }
  function guardarBorrador() { guardarJSON(K_BORRADOR, V); }

  /* ── La cuenta del ticket ──────────────────────────────────────────────
     Las promos NO se aplican solas (Mauricio, 29/10: "que no aparezca
     automático, por las dudas"): entran sólo las que el vendedor eligió en
     «Descuentos +» (v.puestas), y el sistema hace la cuenta.
     1. La que NO se combina (3x2, 2.ª al 50 %): una sola por ticket.
     2. Las que se combinan (10 % en efectivo), en su orden, sobre lo que queda.
     3. Los descuentos a mano, sobre el total del ticket (como en BlueSoft).
     El 3x2 regala la más barata de cada tres; la 2.ª al 50 % va de a pares,
     de la más cara a la más barata, y descuenta la segunda de cada par.
     Una elegida que con estas prendas no descuenta nada va en noAplican. */
  function cuenta(v) {
    var hoy = S.ini.hoy, neto = 0, cant = 0, unidades = [], puestas = v.puestas || {}, gcs = 0;
    v.lineas.forEach(function (l, i) {
      neto += l.precio * l.cantidad;
      cant += l.cantidad;
      /* SQL 200: la gift card no es una prenda: el 3x2 y la 2.ª al 50 % no la cuentan (el 10 % en efectivo sí, como en Gift Cards). */
      if (l.giftcard) { gcs += l.precio * l.cantidad; return; }
      for (var k = 0; k < l.cantidad; k++) unidades.push({ l: i, p: l.precio, rubro: l.rubro || '' });
    });
    var porLinea = v.lineas.map(function () { return 0; });
    var usadas = {}, desc = [], noAplican = [], resto = neto;
    var vigentes = promosVigentes(hoy).filter(function (p) { return puestas[p.id]; });
    function vale(p, rubro) { return !p.rubros || !p.rubros.length || p.rubros.indexOf(rubro) >= 0; }
    function calcular(p) {
      if (p.tipo === 'medio_pago') {
        if (v.forma !== p.medio) return { monto: 0 };
        var base = 0;
        v.lineas.forEach(function (l, i) { if (vale(p, l.rubro || '')) base += l.precio * l.cantidad - porLinea[i]; });
        return { monto: Math.round(Math.min(base, resto) * Number(p.porcentaje) / 100) };
      }
      var us = [], partes = [], i, j;
      unidades.forEach(function (u, k) { if (!usadas[k] && u.p > 0 && vale(p, u.rubro)) us.push({ k: k, l: u.l, p: u.p }); });
      us.sort(function (a, b) { return b.p - a.p || a.k - b.k; });
      if (p.tipo === 'lleva_paga') {
        var gratis = p.lleva - p.paga;
        for (i = 0; i + p.lleva <= us.length; i += p.lleva) {
          for (j = i + p.lleva - gratis; j < i + p.lleva; j++) partes.push({ k: us[j].k, l: us[j].l, monto: us[j].p });
        }
      } else if (p.tipo === 'segunda') {
        for (i = 1; i < us.length; i += 2) partes.push({ k: us[i].k, l: us[i].l, monto: Math.round(us[i].p * Number(p.porcentaje) / 100) });
      }
      return { monto: partes.reduce(function (s, x) { return s + x.monto; }, 0), partes: partes };
    }
    function texto(p, r) {
      var n = (r.partes || []).length;
      if (p.tipo === 'lleva_paga') return p.nombre + ' · ' + n + (n === 1 ? ' prenda de regalo' : ' prendas de regalo');
      if (p.tipo === 'segunda') return p.nombre + ' · en ' + n + (n === 1 ? ' prenda' : ' prendas');
      return p.nombre;
    }
    function aplicar(p, r) {
      var monto = Math.min(r.monto, resto);
      if (monto <= 0) return;
      (r.partes || []).forEach(function (x) { usadas[x.k] = true; porLinea[x.l] += x.monto; });
      resto -= monto;
      desc.push({ tipo: 'promo', promo_id: p.id, descripcion: texto(p, r), monto: monto });
    }
    var mejor = null;
    vigentes.filter(function (p) { return !p.combinable; }).forEach(function (p) {
      var r = calcular(p);
      if (r.monto <= 0) { noAplican.push(p); return; }
      if (!mejor || r.monto > mejor.r.monto) mejor = { p: p, r: r };
    });
    if (mejor) aplicar(mejor.p, mejor.r);
    vigentes.filter(function (p) { return p.combinable; }).forEach(function (p) {
      var r = calcular(p);
      if (r.monto <= 0) { noAplican.push(p); return; }
      aplicar(p, r);
    });
    v.manuales.forEach(function (m, i) {
      var monto = Math.min(m.pct ? Math.round(resto * m.pct / 100) : m.monto, resto);
      if (monto <= 0) return;
      resto -= monto;
      desc.push({ tipo: 'manual', idx: i, descripcion: m.descripcion + (m.pct ? ' (' + String(m.pct).replace('.', ',') + ' %)' : ''), monto: monto });
    });
    return { neto: neto, cantidad: cant, porLinea: porLinea, descuentos: desc, noAplican: noAplican, descuento: neto - resto, total: resto,
             gcCobro: neto ? Math.round(gcs * resto / neto) : 0 };   // SQL 200: lo que se cobra por las gift cards que se venden
  }

  /** Las promos que se ofrecen en la venta: las prendidas en Gestión → Promociones y dentro de sus fechas. */
  function promosVigentes(hoy) {
    hoy = hoy || S.ini.hoy;
    return (S.ini.promos || []).filter(function (p) { return p.activo && (!p.desde || p.desde <= hoy) && (!p.hasta || p.hasta >= hoy); });
  }
  /** Cómo quedarían las promos elegidas al sumar p (la que no se combina reemplaza a la otra que no se combina),
      y cuánto descontaría p en este ticket. */
  function conPromo(p) {
    var puestas = {};
    Object.keys(V.puestas || {}).forEach(function (id) {
      var q = promoDe(Number(id));
      if (q && (p.combinable || q.combinable)) puestas[id] = true;
    });
    puestas[p.id] = true;
    var d = cuenta(Object.assign({}, V, { puestas: puestas })).descuentos.filter(function (x) { return x.tipo === 'promo' && x.promo_id === p.id; })[0];
    var reemplaza = p.combinable ? null : promosVigentes().filter(function (q) { return !q.combinable && q.id !== p.id && V.puestas[q.id]; })[0] || null;
    return { puestas: puestas, monto: d ? d.monto : 0, reemplaza: reemplaza };
  }
  /** Qué hace una promo, corto, para el botón de «Descuentos +». */
  function queHacePromo(p) {
    var pct = String(Number(p.porcentaje)).replace('.', ',') + ' %';
    var que = p.tipo === 'lleva_paga' ? 'Lleva ' + p.lleva + ', paga ' + p.paga + ': ' + (p.lleva - p.paga === 1 ? 'la más barata, gratis' : 'las más baratas, gratis') :
              p.tipo === 'segunda' ? 'La segunda de cada par al ' + pct + ' (la más barata)' :
              pct + ' pagando todo ' + (p.medio === 'efectivo' ? 'en efectivo' : 'con ' + (MEDIOS[p.medio] || p.medio));
    return que + (p.rubros && p.rubros.length ? ' · sólo ' + p.rubros.join(', ') : '');
  }
  /** Por qué una promo no descuenta nada en esta venta (el botón apagado y el renglón gris de la grilla). */
  function porQueNoPromo(p, v) {
    var rub = p.rubros && p.rubros.length ? ' de ' + p.rubros.join(', ') : '';
    if (p.tipo === 'medio_pago') return v.forma !== p.medio ? 'es pagando todo ' + (p.medio === 'efectivo' ? 'en efectivo' : 'con ' + (MEDIOS[p.medio] || p.medio)) :
                                        rub ? 'es sólo para' + rub.slice(3) : 'con estas prendas no descuenta nada';
    return 'hacen falta ' + (p.tipo === 'lleva_paga' ? p.lleva : 2) + ' prendas' + rub;
  }

  /** Los pagos que se mandan a la base (en centavos). X: la venta (V) o el cambio (CB). */
  function pagosDe(total, X) {
    X = X || V;
    if (total <= 0) return [];
    if (X.forma === 'multiple') return (X.multiples || []).map(function (x) { return Object.assign({}, x); });
    var p = { medio: X.forma, monto: total };
    if (X.forma === 'efectivo' && X.pago.recibido) p.recibido = X.pago.recibido;
    if (X.forma === 'tarjeta') { p.tarjeta = X.pago.tarjeta || ''; p.tipo_tarjeta = tipoTarjeta(p.tarjeta); p.cuotas = Number(X.pago.cuotas) || 1; p.cupon = X.pago.cupon || ''; }
    else if (X.forma === 'giftcard') { p.giftcard = X.pago.gc ? X.pago.gc.codigo : ''; p.gc = X.pago.gc; }   // SQL 200 (gc es de la pantalla: no viaja)
    else if (X.forma !== 'efectivo') p.cupon = X.pago.operacion || '';
    return [p];
  }
  function tipoTarjeta(t) { var x = TARJETAS.filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : ''; }
  function sumaPagos(ps) { return (ps || []).reduce(function (s, x) { return s + (x.monto || 0); }, 0); }

  /* ── Las gift cards (SQL 200) ──────────────────────────────────────────
     Mauricio (30/10): "la gift card, sí, ponerla como forma de pago tendría
     que estar. También para vender una… pero que todavía se pueda cobrar de
     la otra manera hasta que demos el alta todo el pos". Se vende pasando la
     tarjeta impresa por la pistola en Producto (entra como un renglón con el
     valor que se escriba) y se cobra con ella eligiendo «Gift card» en Forma
     de pago (o en Múltiple). Se usa entera, como en Cobrar. Gift Cards y
     Cobrar siguen andando igual. */
  var ES_GC = /^99\d{12}$/;
  var ESTADO_GC = { usado: 'usada', vencido: 'vencida', anulado: 'anulada' };
  /** La sugerencia «Gift Card» del campo de producto (escribiendo "gift"). */
  var SUG_GC = ['GIFTCARD', 'Gift Card', 'Pasá la tarjeta por la pistola'];
  SUG_GC.gc = true;
  function nombreGc(r) { return 'Gift Card ' + r.color + ' Nº ' + r.nro; }
  /** El local de la tarjeta: en beneficios va el código (el de Rivadavia es «MAR DEL PLATA»). */
  function localDeCodigo(c) {
    var l = ((S.ini && S.ini.locales) || []).filter(function (x) { return String(x.codigo || '').toLowerCase() === String(c || '').toLowerCase(); })[0];
    return l ? nombreLocal(l) : bonito(String(c || ''));
  }
  /** Por qué no se puede vender (para = 'vender') o cobrar con ella ('pagar'); '' si se puede. */
  function motivoGc(r, para) {
    if (!r) return 'Pasá la tarjeta por la pistola.';
    if (r.error) return r.error;
    if (r.formato === false) return 'Ese código no es de una Gift Card VDH: pasá de nuevo la tarjeta.';
    if (!r.existe) return 'Esa tarjeta no está entre las Gift Cards impresas.';
    if (para === 'vender') {
      return r.vendida ? 'La ' + nombreGc(r) + ' ya se vendió' + (r.vendida_el ? ' (el ' + diaDe(r.vendida_el) + (r.local ? ' en ' + localDeCodigo(r.local) : '') + ')' : '') +
                         '. Para cobrar con ella, elegí «Gift card» en Forma de pago.' : '';
    }
    if (!r.vendida) return 'La ' + nombreGc(r) + ' no se vendió: no se puede cobrar con ella.';
    if (r.estado !== 'disponible') {
      return 'La ' + nombreGc(r) + ' está ' + (ESTADO_GC[r.estado] || r.estado) +
        (r.estado === 'usado' && r.usada_el ? ' (el ' + diaDe(r.usada_el) + (r.local_canje ? ' en ' + localDeCodigo(r.local_canje) : '') + ')' :
         r.estado === 'vencido' && r.vence ? ' (venció el ' + fechaCorta(r.vence) + ')' : '') + '.';
    }
    return '';
  }
  /** Lo que se ve abajo del campo de la tarjeta. */
  function textoGc(r, para) {
    if (!r) return '';
    var m = motivoGc(r, para);
    if (m) return '<span class="tk-gc-mal">' + esc(m) + '</span>';
    return '<b>' + esc(nombreGc(r)) + '</b> · ' + (para === 'vender' ? 'sin vender' :
      'vale ' + plata(cent(r.valor)) + (r.vence ? ' · vence el ' + esc(fechaCorta(r.vence)) : ''));
  }
  /** El campo de una tarjeta: con los 14 números (la pistola manda Enter o no) la busca en la base. alLeer(r): lo que
      encontró, con r.ok si se puede vender o cobrar con ella; null si el campo quedó vacío o a medias. Devuelve leer(). */
  function engancharGc(inp, para, alLeer) {
    var t = null, pedido = 0;
    function leer() {
      clearTimeout(t);
      var cod = inp.value.replace(/\D/g, ''), n = ++pedido;
      if (!ES_GC.test(cod)) { alLeer(cod ? { codigo: cod, formato: false } : null); return; }
      llamar('pos_giftcard', { p_codigo: cod }).then(function (r) {
        if (n !== pedido || !inp.isConnected) return;
        r = Object.assign({}, r, { codigo: cod });
        r.ok = !motivoGc(r, para);
        alLeer(r);
      }, function (e) {
        if (n === pedido && inp.isConnected) alLeer({ codigo: cod, error: mensajeDe(e) });
      });
    }
    inp.oninput = function () {
      clearTimeout(t);
      pedido++;
      if (ES_GC.test(inp.value.replace(/\D/g, ''))) t = setTimeout(leer, 150);
      else alLeer(null);
    };
    /* El Enter de la pistola busca la tarjeta; nunca guarda la venta. */
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); leer(); } };
    return leer;
  }
  /** «Vender una Gift Card»: la tarjeta (cod, si vino de la pistola en Producto) y su valor; entra a la venta como un renglón. */
  function abrirGiftcard(cod) {
    var caja = ventana('<h3 id="posVentTit">Vender una Gift Card</h3><p class="pos-bajada">Pasá la tarjeta por la pistola y escribí el valor. ' +
        'Al guardar la venta queda vendida, igual que desde Gift Cards, y vence a los 30 días.</p>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Tarjeta', '<input type="text" id="gcCod" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="Los 14 números de la tarjeta">') +
        '<p class="tk-gc ancho" id="gcInfo" role="status"></p>' +
        campo('', 'Valor', '<input type="text" inputmode="decimal" id="gcValor" placeholder="$">') +
      '</div><div class="pos-error" id="gcError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="gcOk">Agregar</button></div>');
    var leida = null, inp = caja.querySelector('#gcCod');
    var leer = engancharGc(inp, 'vender', function (r) {
      leida = r;
      caja.querySelector('#gcInfo').innerHTML = textoGc(r, 'vender');
      errorEn(caja, 'gcError', '');
      if (r && r.ok) caja.querySelector('#gcValor').focus();
    });
    function listo() {
      var v = leerPlata(caja.querySelector('#gcValor').value);
      var mal = !leida || !leida.ok ? motivoGc(leida, 'vender') :
        V.lineas.some(function (l) { return l.giftcard === leida.codigo; }) ? 'Esa Gift Card ya está en la venta.' :
        !(v > 0) ? 'Escribí el valor de la Gift Card.' :
        v >= 1000000000 ? 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).' : '';
      if (!errorEn(caja, 'gcError', mal)) return;
      cerrarVentana();
      V.lineas.push({ giftcard: leida.codigo, codigo: 'GIFTCARD', descripcion: nombreGc(leida), rubro: '', talle: '', color: '', color_nom: '',
                      cantidad: 1, precio: v, propio: true, libre: true });
      pintar();
      var p = $('vProd');
      if (p) { if (p.limpiar) p.limpiar(); p.focus(); }
    }
    caja.querySelector('#gcOk').onclick = listo;
    caja.querySelector('#gcValor').oninput = function () { errorEn(caja, 'gcError', ''); };
    caja.querySelector('#gcValor').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); listo(); } };
    if (cod) { inp.value = cod; leer(); }
    else setTimeout(function () { inp.focus(); }, 0);
  }
  /** El aviso abajo de «Gift card» en Forma de pago: si no alcanza, o si sobra (se usa entera: lo que sobra se pierde).
      Corto, en un renglón: lo que vale ya está al lado del campo y a 1366×657 dos renglones sacan el total de la pantalla. */
  function avisoGc(c) {
    var g = V.pago.gc;
    if (!g || !g.ok) return '';
    var val = cent(g.valor);
    return val < c.total ? 'No alcanza: el resto, en «Múltiple».' :
           val > c.total ? 'Se usa entera: se pierden ' + plata(val - c.total) + '.' : '';
  }
  /** Lo que sobra de las gift cards con las que paga (y se pierde), para preguntar antes de guardar. */
  function sobraGc(pagos) {
    return pagos.reduce(function (s, x) { return s + (x.medio === 'giftcard' && x.gc && x.gc.ok ? Math.max(cent(x.gc.valor) - x.monto, 0) : 0); }, 0);
  }

  function campo(cls, lbl, control, extra) {
    return '<label class="pos-f' + (cls ? ' ' + cls : '') + '"' + (extra || '') + '><span>' + lbl + '</span>' + control + '</label>';
  }
  function opciones(lista, actual) {
    return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(actual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  /* Los dos de BlueSoft (Mauricio, 24/10): "Guardar y nueva" deja otra venta vacía; "Guardar" lleva a Tickets. */
  function textoGuardar(nueva) { return (enPrueba() ? 'Guardar prueba' : 'Guardar') + (nueva ? ' y nueva <span class="pos-tecla">F9</span>' : ''); }

  function verVenta() {
    V = cargarBorrador();
    var c = $('cuerpo'), prueba = enPrueba();
    c.classList.add('lleno');
    c.innerHTML =
      /* El cartel de la venta guardada va en la cabecera: abajo empujaría la venta fuera de la pantalla del local. */
      cabeza('Nueva venta' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), '<span id="vSub"></span>',
        '<div id="vHecho"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vGuardarVer" title="Guardar la venta e ir a Tickets">' + textoGuardar(false) + '</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="vGuardar" title="Guardar la venta y empezar otra (F9)">' + textoGuardar(true) + '</button>') +
      '<div class="tk">' +
        '<section class="tk-izq" aria-label="Los datos del ticket"><div class="tk-datos">' +
          campo('c4', 'Fecha', '<input type="text" id="vFecha" readonly>') +
          campo('c4', 'Comprobante', '<select id="vLetra">' + opciones([['B', LETRAS.B], ['A', LETRAS.A], ['X', LETRAS.X]], V.letra) + '</select>') +
          campo('c4', 'Referencia', '<input type="text" id="vRef" readonly title="El número lo da la base al guardar (uno seguido por sucursal)">') +
          campo('c8', 'Vendedor', '<select id="vVend"></select>') +
          campo('c4', 'Estado', '<input type="text" value="Cobrada" readonly>') +
          '<div class="pos-f"><span>Cliente</span><div class="tk-cliente"><div class="tk-cliente-txt" id="vCliente"></div>' +
            '<button type="button" class="btn btn-sec btn-chico" id="vCargarCli">Cargar</button></div></div>' +
          campo('', 'Lista de precios', '<select id="vLista"></select>') +
          campo('', 'Forma de pago', '<select id="vForma">' + opciones(Object.keys(MEDIOS_VENTA).map(function (k) { return [k, MEDIOS_VENTA[k]]; }).concat([['multiple', 'Múltiple']]), '') + '</select>') +
          '<div class="tk-pagox" id="vPagoX"></div>' +
          campo('c6', 'Sucursal', '<select id="vLocal" class="desplegable"></select>') +
          campo('c3', 'Depósito', '<input type="text" id="vDep" value="Ventas" readonly title="Lo vendido sale del stock de la sucursal">') +
          campo('c3', 'Caja', '<input type="text" value="Chica" readonly title="La caja chica del local">') +
        '</div>' +
        '<div class="tk-tot">' +
          '<div class="tk-caja"><span>Neto</span><b id="tNeto">$0</b></div>' +
          '<button type="button" class="tk-caja" id="tDescBtn" title="Elegir una promo o agregar un descuento a mano"><span>Descuentos</span><b id="tDesc">$0</b></button>' +
          '<div class="tk-caja"><span>Productos</span><b id="tCant">0</b></div>' +
          '<div class="tk-caja gordo"><span>' + (prueba ? 'Total · prueba' : 'Total a pagar') + '</span><b id="tTotal">$0</b></div>' +
        '</div></section>' +
        '<section class="tk-der" aria-label="Los productos">' +
          '<div class="tk-prod">' + campo('', 'Producto', '<input type="search" id="vProd" autocomplete="off" spellcheck="false" placeholder="Escaneá la etiqueta, o buscá por código o nombre…" aria-controls="vSug" title="F2">') +
            '<button type="button" class="btn btn-sec btn-chico" id="vLinea" title="Un artículo que no está en el catálogo">Nueva línea</button>' +
            '<div class="tk-sug" id="vSug" role="listbox" aria-label="Productos" hidden></div></div>' +
          '<div class="tk-grilla"><table class="tk-tabla"><thead><tr><th>Ítem</th><th>Código</th><th>Descripción</th><th class="c">Talle</th><th>Color</th>' +
            '<th class="c">Cant.</th><th class="n">Precio unit.</th><th class="n">Desc.</th><th class="n">Total</th><th><span class="sr">Quitar</span></th></tr></thead>' +
            '<tbody id="vFilas"></tbody></table></div>' +
          '<div class="tk-pie">' + campo('', 'Observaciones', '<textarea id="vObs" maxlength="500"></textarea>') + '<p class="tk-nota" id="vNota"></p></div>' +
        '</section>' +
      '</div>';

    $('vFecha').value = fechaCorta(S.ini.hoy);
    $('vLocal').innerHTML = opcionesLocales(V.local_id);   // SQL 190: sus locales (con «Ver otros locales», todos)
    $('vLista').innerHTML = opciones(S.ini.listas.map(function (l) { return [l.id, l.nombre]; }), V.lista_id);
    $('vObs').value = V.observaciones || '';
    llenarVendedores();
    pintarHecho();

    $('vLetra').onchange = function () {
      if (this.value === 'A' && !clienteParaA(V.cliente)) { this.value = V.letra; abrirCliente(true); return; }
      V.letra = this.value;
      /* La X va sólo con efectivo (como en BlueSoft: "X: en efectivo, sin factura"). */
      if (V.letra === 'X' && V.forma !== 'efectivo') {
        V.forma = 'efectivo';
        V.multiples = null;
        pintarPago();
        avisar('info', 'La X va sólo con efectivo: la forma de pago pasó a Efectivo.');
      }
      pintar();
    };
    $('vVend').onchange = function () {
      if (this.value === '__otro') { this.value = V.vendedor; pedirVendedor(); return; }
      V.vendedor = this.value;
      recordar();
      pintar();
    };
    $('vCargarCli').onclick = abrirSocio;
    $('vLista').onchange = function () { cambiarLista(Number(this.value)); };
    $('vForma').onchange = function () {
      if (this.value === 'multiple') { this.value = V.forma; abrirMultiple(); return; }
      V.forma = this.value;
      V.multiples = null;
      pintarPago();
      pintar();
      if (V.forma === 'giftcard' && $('vGc')) $('vGc').focus();   // SQL 200: lista para la pistola
    };
    $('vLocal').onchange = function () {
      var l = localDe(this.value);
      V.local_id = l.id;
      V.vendedor = vendedorInicial(l);
      recordar();
      llenarVendedores();
      cambiarLista(listaDe(l));
      traerStock(l.id).then(function () { if (S.vista === 'venta' && V.local_id === l.id) pintar(); });
      ponerDeposito('vDep', l.id);
    };
    $('tDescBtn').onclick = abrirDescuento;
    $('vLinea').onclick = function () { abrirLineaLibre(); };
    $('vObs').oninput = function () { V.observaciones = this.value; guardarBorrador(); };
    $('vLimpiar').onclick = function () {
      if (V.lineas.length && !confirm('¿Borrar la venta que estás armando?')) return;
      V = ventaNueva(V);
      guardarBorrador();
      verVenta();
    };
    $('vGuardar').onclick = function () { guardarVenta(false); };
    $('vGuardarVer').onclick = function () { guardarVenta(true); };
    engancharProducto();
    engancharFilas();
    pintarPago();
    $('vFilas').innerHTML = '<tr class="tk-vacia"><td colspan="10">Cargando los precios…</td></tr>';
    /* Los precios y el stock del local (para avisar si una prenda no está) a la vez; el stock nunca falla. */
    ponerDeposito('vDep', V.local_id);
    Promise.all([preciosAlDia(V.lista_id), traerStock(V.local_id)]).then(function () { pintar(); }, function (e) { pintar(); avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); });
    /* En la compu, el foco en Producto: la pistola dispara sin tocar nada. En el celular no (abriría el teclado). */
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var p = $('vProd'); if (p) p.focus(); }, 0);
  }

  function llenarVendedores(cb) {
    var X = cb ? CB : V, vs = vendedoresDe(X.local_id);
    if (X.vendedor && vs.indexOf(X.vendedor) < 0) vs.push(X.vendedor);
    $(cb ? 'cbVend' : 'vVend').innerHTML = '<option value="">' + (cb ? 'Elegí quién hace el cambio…' : 'Elegí quién vende…') + '</option>' +
      opciones(vs.map(function (n) { return [n, n]; }), X.vendedor) + '<option value="__otro">Otro (escribirlo)…</option>';
  }
  function pedirVendedor(cb) {
    var caja = ventana('<h3 id="posVentTit">¿Quién vende?</h3><p class="pos-bajada">Si no está en la lista del local, escribí su nombre como lo usa en la Carga.</p>' +
      campo('', 'Nombre', '<input type="text" id="pvNombre" maxlength="40" autofocus>') + '<div class="pos-error" id="pvError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="pvOk">Listo</button></div>');
    function listo() {
      var n = caja.querySelector('#pvNombre').value.trim();
      if (!errorEn(caja, 'pvError', n.length < 2 ? 'Escribí el nombre.' : '')) return;
      (cb ? CB : V).vendedor = n;
      recordar(cb);
      llenarVendedores(cb);
      cerrarVentana();
      if (cb) pintarCambio(); else pintar();
    }
    caja.querySelector('#pvOk').onclick = listo;
    caja.querySelector('#pvNombre').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); listo(); } };
  }

  /** Otra lista: los renglones del catálogo toman su precio (los que se cambiaron a mano, no). */
  function cambiarLista(lista) {
    V.lista_id = lista;
    $('vLista').value = String(lista);
    asegurarPrecios(lista).then(function () {
      V.lineas.forEach(function (l) { if (!l.libre && !l.propio) l.precio = precioDe(l.codigo) || 0; });
      pintar();
    }, function (e) { avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); pintar(); });
  }

  function textoCliente(cl) {
    if (!cl) return 'Consumidor final';
    return (cl.nombre || 'Sin nombre') + (cl.doc ? ' · ' + (cl.doc.length === 11 ? 'CUIT ' + cuit(cl.doc) : 'DNI ' + miles(cl.doc)) : '');
  }
  function clienteParaA(cl) { return !!(cl && cl.doc && cl.doc.length === 11 && cl.condicion && cl.condicion !== 'consumidor_final' && cl.nombre); }

  /* ── El socio del Club (SQL 171) ── */
  function clubIni() { return (S.ini && S.ini.club) || { suma: false, pesos_por_punto: 100 }; }
  /** Los puntos de una venta (total en centavos), con la cuenta de Cobrar (club_sumar_compra): el total sobre los pesos
      por punto, por el multiplicador del socio (su nivel y las promos del día), redondeado una sola vez al final. */
  function puntosDe(total, factor) { return Math.floor(aPesos(total) / (Number(clubIni().pesos_por_punto) || 100) * (Number(factor) || 1) + 1e-9); }
  function telCorto(t) { var d = String(t || '').replace(/\D/g, ''); return d ? 'WhatsApp …' + d.slice(-4) : 'Sin WhatsApp'; }
  function marcaClub(so) { return '<span class="tk-club" title="Socio del Club">Club' + (so.nivel ? ' · ' + esc(so.nivel) : '') + '</span>'; }

  /* ── Lo que cambia cada vez ── */
  function pintar() {
    if (!$('vFilas')) return;
    var c = cuenta(V), l0 = localDe(V.local_id), li = listaPorId(V.lista_id);
    $('vSub').textContent = nombreLocal(l0) + ' · ' + (li ? li.nombre : '');
    $('vRef').value = 'Al guardar';
    $('vLetra').value = V.letra;
    $('vCliente').innerHTML = (V.socio ? marcaClub(V.socio) : '') + '<span>' + esc(textoCliente(V.cliente)) + '</span>';
    $('vCliente').title = (V.socio ? 'Socio del Club ' + V.socio.nivel + ' · ' : '') + textoCliente(V.cliente);
    $('vForma').value = V.forma;
    $('vForma').disabled = V.letra === 'X';
    $('vForma').title = V.letra === 'X' ? 'La X va sólo con efectivo' : '';
    $('tNeto').textContent = plata(c.neto);
    $('tDesc').textContent = c.descuento ? '−' + plata(c.descuento) : '$0';
    $('tCant').textContent = c.cantidad;
    $('tTotal').textContent = plata(c.total);

    var filas = V.lineas.map(function (l, i) {
      var d = c.porLinea[i];
      return '<tr data-i="' + i + '"><td class="pos-num">' + ('00' + (i + 1)).slice(-3) + '</td>' +
        '<td class="tk-cod">' + esc(l.codigo || '—') + '</td><td class="tk-desc">' + esc(l.descripcion) + pillStock(V.local_id, l) + '</td>' +
        '<td class="c">' + esc(l.talle || '') + '</td><td>' + esc(l.color_nom || l.color || '') + '</td>' +
        '<td class="c">' + (l.giftcard ? '<span title="Una Gift Card va de a una">1</span>' :   // SQL 200
          '<input type="number" class="tk-cant" min="1" max="999" value="' + l.cantidad + '" aria-label="Cantidad de ' + esc(l.descripcion) + '">') + '</td>' +
        '<td class="n"><input type="text" inputmode="decimal" class="tk-precio' + (l.precio ? '' : ' sin') + '" value="' + plataCampo(l.precio) + '"' +
          (l.precio ? '' : ' placeholder="Sin precio"') + ' aria-label="Precio unitario de ' + esc(l.descripcion) + '"></td>' +
        '<td class="n">' + (d ? '<span class="tk-desc-l">−' + plata(d) + '</span>' : '') + '</td>' +
        '<td class="n"><b>' + plata(l.precio * l.cantidad) + '</b></td>' +
        '<td><button type="button" class="tk-quitar" data-quitar="' + i + '" title="Quitar" aria-label="Quitar ' + esc(l.descripcion) + '">' + icono('x') + '</button></td></tr>';
    });
    c.descuentos.forEach(function (d) {
      filas.push('<tr class="tk-fila-d' + (d.tipo === 'manual' ? ' manual' : '') + '"><td></td><td colspan="7">' + esc(d.descripcion) + '</td>' +
        '<td class="n">−' + plata(d.monto) + '</td><td><button type="button" class="tk-quitar" ' +
        (d.tipo === 'promo' ? 'data-sacar="' + d.promo_id + '" title="Sacar la promo" aria-label="Sacar la promo ' + esc(d.descripcion) + '"'
                            : 'data-manual="' + d.idx + '" title="Sacar el descuento" aria-label="Sacar el descuento ' + esc(d.descripcion) + '"') + '>' + icono('x') + '</button></td></tr>');
    });
    c.noAplican.forEach(function (p) {
      filas.push('<tr class="tk-fila-sacada"><td></td><td colspan="9">Elegiste «' + esc(p.nombre) + '», pero ' + esc(porQueNoPromo(p, V)) + ': todavía no descuenta. ' +
        '<button type="button" data-sacar="' + p.id + '">Sacarla</button></td></tr>');
    });
    $('vFilas').innerHTML = filas.length ? filas.join('') :
      '<tr class="tk-vacia"><td colspan="10"><b>Todavía no hay productos</b>Dispará la pistola a la etiqueta o buscá el producto arriba.</td></tr>';

    /* El pago: el vuelto, y el aviso si el múltiple ya no da el total. */
    var vuelto = $('vVuelto');
    if (vuelto) vuelto.value = V.pago.recibido && V.pago.recibido >= c.total ? plata(V.pago.recibido - c.total) : '';
    var av = $('vPagoAviso');
    if (av) {
      var s = sumaPagos(V.multiples);
      av.textContent = V.forma === 'multiple' && s !== c.total ? 'Los pagos suman ' + plata(s) + ' y el total es ' + plata(c.total) + ': tocá «Cambiar».' :
                       V.forma === 'giftcard' ? avisoGc(c) :   // SQL 200
                       (V.forma === 'efectivo' && V.pago.recibido && V.pago.recibido < c.total ? 'Lo recibido es menos que el total.' : '');
    }
    var mt = $('vMultTxt');
    if (mt) mt.textContent = (V.multiples || []).map(function (x) { return MEDIOS_VENTA[x.medio] + (x.gc ? ' ' + x.gc.color + ' Nº ' + x.gc.nro : '') + ' ' + plata(x.monto); }).join(' + ') || '—';

    /* SQL 200: la gift card que se vende no da puntos (los da lo que se compre con ella). */
    var cl = V.cliente, so = V.socio, pts = so ? puntosDe(c.total - c.gcCobro, so.factor) : 0;
    /* Los puntos del socio: los anota la venta; los suma recién con la regla del Club prendida (SQL 171). */
    var club = !so ? '' : '<span class="tk-nota-club"><b>Club:</b> ' + (enPrueba() ? 'en modo prueba no se suman puntos.' :
      !c.total ? esc(String(so.nombre || '').split(' ')[0]) + ' suma puntos con lo que compre.' :
      'esta venta le da ' + miles(pts) + (pts === 1 ? ' punto' : ' puntos') + ' a ' + esc(String(so.nombre || '').split(' ')[0]) +
      (clubIni().suma ? ': se suman al guardar.' : '. Hasta el lanzamiento se cargan en Cobrar.')) + '</span> ';
    $('vNota').innerHTML = club + (enPrueba() ? '<b>Modo prueba:</b> lo que guardes numera aparte (P-1, P-2…), no cuenta para nada y se borra desde Tickets.' :
      V.letra === 'X' ? '<b>Comprobante X:</b> es interno, no es factura y no va a ARCA. Va sólo con efectivo.' :
      '<b>La factura de ARCA todavía no está conectada:</b> la venta queda registrada en el POS y la factura la sigue haciendo BlueSoft.' +
      (cl && cl.envio === 'mail' && cl.email ? ' Cuando esté, va por mail a ' + esc(cl.email) + '.' : '') +
      (cl && cl.envio === 'whatsapp' && cl.tel ? ' Cuando esté, va por WhatsApp al ' + esc(cl.tel) + '.' : ''));
    guardarBorrador();
  }

  function pintarHecho() {
    var u = S.ultimo, h = $('vHecho');
    if (!h) return;
    h.innerHTML = u ? '<div class="pos-hecho' + (u.serie === 'prueba' ? ' prueba' : '') + '" role="status">' + icono('ok') + '<span>' + esc(nombreVenta(u)) + ' guardada · ' + plata(u.total) +
      (u.ya ? ' (ya estaba guardada: no se duplicó)' : '') + '</span><button type="button" id="vVerUltimo">Ver el ticket</button></div>' : '';
    if (u) $('vVerUltimo').onclick = function () { abrirTicket(u.id); };
  }

  /* ── El pago (abajo de "Forma de pago"). Con cb, el del cambio (sus campos empiezan con "cb"). ── */
  function pintarPago(cb) {
    var X = cb ? CB : V, pre = cb ? 'cb' : 'v', repintar = cb ? pintarCambio : pintar, guardarB = cb ? guardarBorradorCb : guardarBorrador;
    var x = $(pre + 'PagoX'), p = X.pago;
    if (!x) return;
    if (X.forma === 'efectivo') {
      x.innerHTML = campo('c6', 'Recibido', '<input type="text" inputmode="decimal" id="' + pre + 'Recibido" placeholder="Opcional" value="' + plataCampo(p.recibido) + '">') +
        campo('c6 tk-vuelto', 'Vuelto', '<input type="text" id="' + pre + 'Vuelto" readonly>');
    } else if (X.forma === 'tarjeta') {
      x.innerHTML = campo('c5', 'Tarjeta', '<select id="' + pre + 'Tarjeta"><option value="">Elegí…</option>' + opciones(TARJETAS.map(function (t) { return [t[0], t[0]]; }), p.tarjeta) + '</select>') +
        campo('c3', 'Cuotas', '<select id="' + pre + 'Cuotas">' + opciones(CUOTAS.map(function (n) { return [n, n]; }), p.cuotas || 1) + '</select>') +
        campo('c4', 'Cupón', '<input type="text" id="' + pre + 'Cupon" inputmode="numeric" maxlength="20" placeholder="Del posnet" value="' + esc(p.cupon || '') + '">');
    } else if (X.forma === 'giftcard') {
      /* SQL 200: la gift card con la que paga, por la pistola. */
      x.innerHTML = campo('c5', 'Gift card', '<input type="text" id="' + pre + 'Gc" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="Pasala por la pistola" value="' + esc(p.gc ? p.gc.codigo : '') + '">') +
        '<p class="tk-gc c7" id="' + pre + 'GcInfo" role="status">' + textoGc(p.gc, 'pagar') + '</p>';
    } else if (X.forma === 'multiple') {
      x.innerHTML = '<div class="pos-f"><span>Pagos</span><div class="tk-cliente"><div class="tk-cliente-txt" id="vMultTxt"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vMultBtn">Cambiar</button></div></div>';
      $('vMultBtn').onclick = abrirMultiple;
    } else {
      x.innerHTML = campo('', 'Nº de operación', '<input type="text" id="' + pre + 'Oper" maxlength="30" placeholder="Opcional" value="' + esc(p.operacion || '') + '">');
    }
    x.insertAdjacentHTML('beforeend', '<div class="tk-aviso-pago" id="' + pre + 'PagoAviso" role="status"></div>');
    var r = $(pre + 'Recibido');
    if (r) r.oninput = function () { var v = leerPlata(r.value); X.pago.recibido = isNaN(v) ? 0 : v; repintar(); };
    [['Tarjeta', 'tarjeta'], ['Cuotas', 'cuotas'], ['Cupon', 'cupon'], ['Oper', 'operacion']].forEach(function (k) {
      var e = $(pre + k[0]);
      if (e) e[e.tagName === 'SELECT' ? 'onchange' : 'oninput'] = function () { X.pago[k[1]] = e.value; guardarB(); };
    });
    /* SQL 200: al leer la tarjeta, lo que vale y si alcanza; si ya había una (el borrador), se mira de nuevo cómo está. */
    var g = $(pre + 'Gc');
    if (g) {
      var leerGc = engancharGc(g, 'pagar', function (r) { X.pago.gc = r; var i = $(pre + 'GcInfo'); if (i) i.innerHTML = textoGc(r, 'pagar'); repintar(); });
      if (p.gc && p.gc.codigo) leerGc();
    }
  }

  /* ── El producto: un solo campo para buscar o dispararle a la etiqueta ──
     La pistola escribe "RM41641 S NE" (código, talle y color) y casi siempre
     un Enter. Se distingue por la FORMA, como en la Carga. Acá, a diferencia
     del No Compra, el talle y el color de la etiqueta SÍ son los buenos: es
     la prenda que se lleva. */
  var ESCANEO = /^([A-Za-z]{1,4}\d[A-Za-z0-9]*)\s+(\S+)\s+(\S+)$/;

  function leerEscaneo(txt) {
    var m = String(txt || '').trim().match(ESCANEO);
    return m ? { codigo: m[1].toUpperCase(), talle: m[2].toUpperCase(), color: m[3].toUpperCase() } : null;
  }
  /* SQL 202: entre todos los de BlueSoft. Primero el código entero (también un inactivo), después los que empiezan
     con lo escrito y después por el nombre; entre los del nombre, los de la temporada más nueva primero. */
  function buscarProductos(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    var pal = normal(q).split(' ').filter(Boolean), res = [];
    BUSCA.forEach(function (b) {
      var pts;
      if (b.cod === q) pts = 0;
      else if (!b.p[6]) return;
      else if (b.cod.indexOf(q) === 0) pts = 1;
      else if (pal.every(function (w) { return b.nom.indexOf(w) >= 0; })) pts = b.nom.indexOf(pal[0]) === 0 ? 2 : 3;
      else return;
      res.push([pts, b.p]);
    });
    res.sort(function (a, b) {
      return Math.min(a[0], 2) - Math.min(b[0], 2) || (b[1][5] || 0) - (a[1][5] || 0) || a[0] - b[0] ||
        String(a[1][1]).localeCompare(String(b[1][1]), 'es');
    });
    return res.slice(0, 8).map(function (x) { return x[1]; });
  }

  /** El campo de producto de la venta. El cambio tiene dos: lo que vuelve y lo que se lleva. */
  /* SQL 200: la venta además vende gift cards (los 14 números de la tarjeta, o escribiendo "gift"). */
  function prodVenta() {
    return { campo: 'vProd', sug: 'vSug', lista: function () { return V.lista_id; }, agregar: agregar, giftcard: abrirGiftcard,
             buscar: function (q) { var r = buscarProductos(q); return /^gif/i.test(String(q || '').trim()) ? [SUG_GC].concat(r).slice(0, 8) : r; },
             elegir: function (p) { if (p === SUG_GC) { $('vProd').limpiar(); abrirGiftcard(); } else abrirDetalle(p); } };
  }

  /* o: { campo, sug (los id), lista() y agregar(p, talle, color, cantidad) }. Cada campo con sus sugerencias.
     Los remitos (SQL 160) además le pasan: prod(código) y buscar(texto) en vez del catálogo solo, elegir(p)
     en vez de "Agregar detalle…", sinPrecio, sinLinea (no tienen «Nueva línea»), noEsta(código) y
     escaneoLibre (el disparo a una etiqueta que no está en el catálogo entra igual). */
  function engancharProducto(o) {
    o = o || prodVenta();
    var prodDe = o.prod || function (cod) { return PROD[cod]; }, buscar = o.buscar || buscarProductos;
    var campoP = $(o.campo), caja = $(o.sug), sug = [], mira = 0, tEsc = null;
    function cerrar() { caja.hidden = true; sug = []; campoP.removeAttribute('aria-activedescendant'); }
    function elegir(p) { if (o.elegir) o.elegir(p); else abrirDetalle(p, o); }
    function pintarSug() {
      if (!sug.length) { cerrar(); return; }
      caja.innerHTML = sug.map(function (p, i) {
        var pr = o.sinPrecio ? 0 : precioDe(p[0], o.lista());
        return '<button type="button" role="option" id="' + o.sug + i + '" data-sug="' + i + '" class="' + (i === mira ? 'on' : '') + '" aria-selected="' + (i === mira) + '">' +
          '<span>' + esc(p[1]) + ' <small>' + esc(p[2] || '') + '</small></span><small>' + esc(p[0]) + '</small>' +
          (o.sinPrecio || p.gc ? '' : pr ? '<span class="n">' + plata(pr) + '</span>' : '<span class="sin">Sin precio</span>') + '</button>';
      }).join('');
      caja.hidden = false;
      campoP.setAttribute('aria-activedescendant', o.sug + mira);
    }
    /* Después de agregar: el campo vacío y sin sugerencias, listo para el próximo disparo. */
    campoP.limpiar = function () { clearTimeout(tEsc); campoP.value = ''; cerrar(); };
    campoP.oninput = function () {
      clearTimeout(tEsc);
      /* SQL 200: los 14 números de una gift card impresa (la pistola que no manda Enter): a venderla. */
      var gcod = campoP.value.trim();
      if (o.giftcard && ES_GC.test(gcod)) {
        tEsc = setTimeout(function () { if (campoP.value.trim() === gcod) { campoP.limpiar(); o.giftcard(gcod); } }, 150);
        cerrar();
        return;
      }
      var d = leerEscaneo(campoP.value);
      /* Algunas pistolas no mandan Enter: si el texto ya es un disparo completo (el talle y el color
         existen en esa prenda), se agrega solo, cuando deja de escribir. */
      var pd = d && prodDe(d.codigo);
      if (pd && tallesDe(pd).indexOf(d.talle) >= 0 && coloresDe(pd).some(function (x) { return x.cod === d.color; })) {
        var antes = campoP.value;
        tEsc = setTimeout(function () { if (campoP.value === antes) agregarEscaneo(d, o); }, 150);
        cerrar();
        return;
      }
      sug = buscar(campoP.value);
      mira = 0;
      pintarSug();
    };
    campoP.onkeydown = function (e) {
      if (e.key === 'ArrowDown' && sug.length) { e.preventDefault(); mira = (mira + 1) % sug.length; pintarSug(); return; }
      if (e.key === 'ArrowUp' && sug.length) { e.preventDefault(); mira = (mira + sug.length - 1) % sug.length; pintarSug(); return; }
      if (e.key === 'Escape') { cerrar(); return; }
      if (e.key !== 'Enter') return;
      /* El Enter NUNCA guarda la venta: lo manda la pistola al final de cada disparo. */
      e.preventDefault();
      clearTimeout(tEsc);
      var d = leerEscaneo(campoP.value);
      if (d) { agregarEscaneo(d, o); return; }
      var cod = campoP.value.trim().toUpperCase(), pc = prodDe(cod);
      if (o.giftcard && ES_GC.test(cod)) { campoP.limpiar(); o.giftcard(cod); return; }   // SQL 200: una gift card impresa
      if (pc) { elegir(pc); return; }
      /* Si las sugerencias se cerraron (salió del campo y volvió), se buscan de nuevo. */
      if (!sug.length) { sug = buscar(campoP.value); mira = 0; }
      if (sug.length) { elegir(sug[mira]); return; }
      if (cod && o.noEsta) { o.noEsta(cod); return; }
      if (cod) {
        avisar('err', 'No encontré «' + campoP.value.trim() + '» en el catálogo.' + (o.sinLinea ? '' : ' Si es un artículo suelto, cargalo con «Nueva línea».'));
        campoP.select();   // el próximo disparo lo reemplaza
      }
    };
    caja.onmousedown = function (e) { e.preventDefault(); };   // que el campo no pierda el foco antes del click
    caja.onclick = function (e) { var b = e.target.closest('[data-sug]'); if (b) elegir(sug[Number(b.getAttribute('data-sug'))]); };
    campoP.onblur = function () { setTimeout(function () { if (document.activeElement !== campoP) cerrar(); }, 120); };
    campoP.onfocus = function () { if (!sug.length && !leerEscaneo(campoP.value)) { sug = buscar(campoP.value); mira = 0; pintarSug(); } };
  }

  function agregarEscaneo(d, o) {
    var p = o.prod ? o.prod(d.codigo) : PROD[d.codigo];
    if (!p && o.escaneoLibre) p = [d.codigo, d.codigo, '', d.talle, d.color];
    if (!p) {
      avisar('err', 'El código ' + d.codigo + ' no está en el catálogo.' + (o.sinLinea ? '' : ' Si es un artículo suelto, cargalo con «Nueva línea».'));
      var c = $(o.campo);
      if (c) c.select();   // el próximo disparo lo reemplaza
      return;
    }
    var col = coloresDe(p).filter(function (x) { return x.cod === d.color; })[0];
    o.agregar(p, d.talle, col ? col.cod : d.color, 1);
  }

  function agregar(p, talle, color, cant) {
    var cod = p[0];
    var ya = V.lineas.filter(function (l) { return !l.libre && l.codigo === cod && l.talle === talle && l.color === color; })[0];
    if (ya) ya.cantidad = Math.min(999, ya.cantidad + (cant || 1));
    else V.lineas.push({ codigo: cod, descripcion: p[1], rubro: p[2] || '', talle: talle || '', color: color || '', color_nom: nombreColor(color, cod),
                         cantidad: cant || 1, precio: precioDe(cod) || 0, propio: false });
    var campoP = $('vProd');
    campoP.limpiar();
    pintar();
    avisarAlAgregar(p, V.local_id, talle, color, !precioDe(cod), V.lineas);
    campoP.focus();
  }

  /* "Agregar detalle…" de BlueSoft: el talle y el color, con chips en vez de desplegables. */
  function abrirDetalle(p, o) {
    o = o || prodVenta();
    var talles = tallesDe(p), colores = coloresDe(p), pr = precioDe(p[0], o.lista());
    var sel = { talle: talles.length === 1 ? talles[0] : '', color: colores.length === 1 ? colores[0].cod : '' };
    var caja = ventana('<h3 id="posVentTit">' + esc(p[1]) + '</h3><p class="pos-bajada">' + esc(p[0]) + ' · ' + esc(p[2] || 'Sin rubro') + ' · ' +
        (pr ? plata(pr) : '<b>sin precio en esta lista</b> (se escribe en la grilla)') + '</p>' +
      '<div class="pos-campos">' +
        '<div class="pos-f ancho"><span>Talle</span><div class="chips" id="dtTalles">' + talles.map(function (t) {
          return '<button type="button" class="chip" data-talle="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
          '<input type="text" id="dtOtro" maxlength="10" placeholder="' + (talles.length ? 'O escribilo' : 'Escribilo (si tiene)') + '" style="margin-top:6px"></div>' +
        (colores.length ? '<div class="pos-f ancho"><span>Color</span><div class="chips" id="dtColores">' + colores.map(function (x) {
          return '<button type="button" class="chip" data-color="' + esc(x.cod) + '">' + esc(x.nom) + '</button>'; }).join('') + '</div></div>' : '') +
        campo('', 'Cantidad', '<input type="number" id="dtCant" min="1" max="999" value="1">') +
      '</div><div class="pos-error" id="dtError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="dtOk">Agregar</button></div>');
    function marcar() {
      caja.querySelectorAll('[data-talle]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-talle') === sel.talle); });
      caja.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-color') === sel.color); });
    }
    marcar();
    caja.onclick = function (e) {
      var b = e.target.closest('[data-talle], [data-color]');
      if (!b) return;
      if (b.hasAttribute('data-talle')) { sel.talle = b.getAttribute('data-talle'); caja.querySelector('#dtOtro').value = ''; }
      else sel.color = b.getAttribute('data-color');
      marcar();
    };
    function listo() {
      var otro = caja.querySelector('#dtOtro').value.trim().toUpperCase(), talle = otro || sel.talle;
      var n = parseInt(caja.querySelector('#dtCant').value, 10);
      if (!errorEn(caja, 'dtError', talles.length && !talle ? 'Elegí el talle.' : colores.length && !sel.color ? 'Elegí el color.' :
                                      !(n >= 1 && n <= 999) ? 'La cantidad va de 1 a 999.' : '')) return;
      cerrarVentana();
      o.agregar(p, talle, sel.color, n);
    }
    caja.querySelector('#dtOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); listo(); } });
    setTimeout(function () { var b = caja.querySelector(sel.talle ? (colores.length > 1 ? '[data-color]' : '#dtOk') : '[data-talle], #dtOtro'); if (b) b.focus(); }, 0);
  }

  /* "Nueva línea": un artículo que no está en el catálogo. alAgregar(línea): en el cambio, a la grilla que corresponde. */
  function abrirLineaLibre(alAgregar) {
    var caja = ventana('<h3 id="posVentTit">Nueva línea</h3><p class="pos-bajada">Un artículo que no está en el catálogo. Queda en el ticket con lo que escribas.</p>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Descripción', '<input type="text" id="llDesc" maxlength="80" autofocus>') +
        campo('', 'Código <span class="lbl-opc">(si tiene)</span>', '<input type="text" id="llCod" maxlength="30">') +
        campo('', 'Talle <span class="lbl-opc">(si tiene)</span>', '<input type="text" id="llTalle" maxlength="10">') +
        campo('', 'Cantidad', '<input type="number" id="llCant" min="1" max="999" value="1">') +
        campo('', 'Precio unitario', '<input type="text" inputmode="decimal" id="llPrecio" placeholder="$">') +
      '</div><div class="pos-error" id="llError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="llOk">Agregar</button></div>');
    function listo() {
      var d = caja.querySelector('#llDesc').value.trim(), n = parseInt(caja.querySelector('#llCant').value, 10), pr = leerPlata(caja.querySelector('#llPrecio').value);
      if (!errorEn(caja, 'llError', !d ? 'Escribí qué es.' : !(n >= 1 && n <= 999) ? 'La cantidad va de 1 a 999.' : !(pr > 0) ? 'Escribí el precio.' : '')) return;
      var l = { codigo: caja.querySelector('#llCod').value.trim().toUpperCase(), descripcion: d, rubro: '', talle: caja.querySelector('#llTalle').value.trim().toUpperCase(),
                color: '', color_nom: '', cantidad: n, precio: pr, propio: true, libre: true };
      cerrarVentana();
      if (alAgregar) { alAgregar(l); return; }
      V.lineas.push(l);
      pintar();
    }
    caja.querySelector('#llOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); listo(); } });
  }

  /* La grilla: cantidad y precio se cambian ahí mismo; la ✕ quita el renglón o saca la promo. */
  function engancharFilas() {
    var t = $('vFilas');
    t.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      var l = V.lineas[Number(tr.getAttribute('data-i'))];
      if (e.target.classList.contains('tk-cant')) {
        var n = parseInt(e.target.value, 10);
        if (n >= 1 && n <= 999) l.cantidad = n; else avisar('err', 'La cantidad va de 1 a 999.');
      } else if (e.target.classList.contains('tk-precio')) {
        var c = leerPlata(e.target.value);
        if (!isNaN(c) && c < 10000000000) { l.precio = c; l.propio = true; } else avisar('err', 'Ese precio no se entiende. Escribilo así: 20000 o 16.333,33');
      }
      pintar();
    });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('.tk-cant, .tk-precio')) { e.preventDefault(); e.target.blur(); $('vProd').focus(); }
    });
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-quitar')) V.lineas.splice(Number(b.getAttribute('data-quitar')), 1);
      else if (b.hasAttribute('data-sacar')) delete V.puestas[b.getAttribute('data-sacar')];
      else if (b.hasAttribute('data-manual')) V.manuales.splice(Number(b.getAttribute('data-manual')), 1);
      else return;
      pintar();
      $('vProd').focus();
    });
  }

  /* "Agregar descuento…" de BlueSoft. Arriba, las promos prendidas para elegir (Mauricio, 29/10: "que haya algún
     lado de aplicar el descuento en la prenda más barata, o en la segunda al 50 %… pero que no aparezca
     automático"): cada una dice cuánto descuenta en este ticket y, al tocarla, el sistema hace la cuenta.
     Abajo, el descuento a mano de siempre. */
  function abrirDescuento() {
    var c = cuenta(V);
    if (!c.neto) { avisar('info', 'Primero cargá los productos.'); return; }
    var ofrecidas = promosVigentes(), foco = false;
    var promos = ofrecidas.map(function (p) {
      var o = conPromo(p), puesta = !!V.puestas[p.id] && c.descuentos.some(function (d) { return d.promo_id === p.id; });
      var sirve = !puesta && o.monto > 0, auto = sirve && !foco ? (foco = true, ' autofocus') : '';
      return '<button type="button" class="pos-promo-op' + (puesta ? ' puesta' : '') + '" data-promo="' + p.id + '"' + (sirve ? '' : ' disabled') + auto + '>' +
        '<span class="pos-promo-op-txt"><b>' + esc(p.nombre) + '</b><small>' + esc(queHacePromo(p)) + '</small>' +
        (puesta ? '<em>Ya está en el ticket</em>' : !sirve ? '<em>No aplica: ' + esc(porQueNoPromo(p, V)) + '</em>' :
          o.reemplaza ? '<em>Reemplaza a «' + esc(o.reemplaza.nombre) + '» (no se suman)</em>' : '') + '</span>' +
        '<span class="pos-promo-op-monto">' + (puesta ? icono('ok') : sirve ? '−' + plata(o.monto) : '') + '</span></button>';
    }).join('');
    var caja = ventana('<h3 id="posVentTit">Agregar descuento</h3>' +
      (promos ? '<p class="pos-bajada">Las promos no se aplican solas: tocá la que corresponde y el sistema hace la cuenta. Se sacan con la ✕ de la grilla.</p>' +
          '<div class="pos-ds-titulo">Promociones</div><div class="pos-promos-elegir">' + promos + '</div>' +
          '<div class="pos-ds-titulo">O un descuento a mano</div><p class="pos-ayuda pos-ds-ayuda">Sobre el total del ticket (' + plata(c.total) + ').</p>'
        : '<p class="pos-bajada">Sobre el total del ticket, después de las promos (' + plata(c.total) + '). Se saca con la ✕ de la grilla.</p>') +
      '<div class="pos-campos">' +
        campo('ancho', 'Descuento', '<select id="dsTipo"' + (foco ? '' : ' autofocus') + '>' + DESCUENTOS.map(function (d, i) { return '<option value="' + i + '">' + esc(d[0]) + '</option>'; }).join('') + '</select>') +
        campo('', 'Porcentaje', '<input type="text" inputmode="decimal" id="dsPct" value="5">') +
        campo('', 'O un monto ($)', '<input type="text" inputmode="decimal" id="dsVal" placeholder="$">') +
      '</div><div class="pos-error" id="dsError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="dsOk">Agregar</button></div>');
    var tipo = caja.querySelector('#dsTipo'), pct = caja.querySelector('#dsPct'), val = caja.querySelector('#dsVal');
    tipo.onchange = function () { var d = DESCUENTOS[Number(tipo.value)]; pct.value = d[1] ? d[1] : ''; if (!d[1]) val.focus(); };
    val.oninput = function () { if (val.value.trim()) pct.value = ''; };
    pct.oninput = function () { if (pct.value.trim()) val.value = ''; };
    function listo() {
      var d = DESCUENTOS[Number(tipo.value)], p = parseFloat(String(pct.value).replace(',', '.')), m = leerPlata(val.value);
      var nombre = d[0].replace(/\s*\d+\s*%$/, '') || d[0];
      if (val.value.trim()) {
        if (!errorEn(caja, 'dsError', !(m > 0) ? 'El monto no se entiende.' : m > c.total ? 'Es más que el total del ticket.' : '')) return;
        V.manuales.push({ descripcion: nombre, monto: m });
      } else {
        if (!errorEn(caja, 'dsError', !(p > 0 && p <= 100) ? 'El porcentaje va de 0 a 100 (o escribí un monto).' : '')) return;
        V.manuales.push({ descripcion: nombre, pct: Math.round(p * 100) / 100 });
      }
      cerrarVentana();
      pintar();
    }
    caja.querySelector('#dsOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); listo(); } });
    caja.querySelectorAll('[data-promo]').forEach(function (b) {
      b.onclick = function () {
        var p = promoDe(Number(b.getAttribute('data-promo'))), o = p && conPromo(p);
        if (!o || !o.monto) return;
        V.puestas = o.puestas;
        cerrarVentana();
        pintar();
        avisar('ok', p.nombre + ': −' + plata(o.monto) + (o.reemplaza ? ' (en lugar de «' + o.reemplaza.nombre + '»)' : '') + '.');
        $('vProd').focus();
      };
    });
  }

  /* El cliente: para la factura A, o para mandarle la factura. */
  function abrirCliente(paraA) {
    var cl = V.cliente || {};
    var cond = cl.condicion || (paraA ? 'responsable_inscripto' : 'consumidor_final');
    var envio = cl.envio || '';
    var caja = ventana('<h3 id="posVentTit">Cliente</h3><p class="pos-bajada">' +
        (paraA ? 'La factura A necesita la razón social, el CUIT y la condición de IVA.' : 'Casi siempre es consumidor final. Cargalo para la factura A o para mandarle la factura por mail o WhatsApp.') + '</p>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Nombre o razón social', '<input type="text" id="clNombre" maxlength="120" autofocus value="' + esc(cl.nombre || '') + '">') +
        campo('', 'CUIT o DNI', '<input type="text" id="clDoc" inputmode="numeric" maxlength="13" value="' + esc(cl.doc ? (cl.doc.length === 11 ? cuit(cl.doc) : cl.doc) : '') + '">') +
        campo('', 'Condición frente al IVA', '<select id="clCond">' + opciones(Object.keys(CONDICION).map(function (k) { return [k, CONDICION[k]]; }), cond) + '</select>') +
        campo('', 'Mail', '<input type="email" id="clMail" maxlength="120" value="' + esc(cl.email || '') + '">') +
        campo('', 'WhatsApp', '<input type="tel" id="clTel" maxlength="20" value="' + esc(cl.tel || '') + '">') +
        '<div class="pos-f ancho"><span>La factura, cuando esté conectada</span><div class="chips" id="clEnvio">' +
          [['mail', 'Por mail'], ['whatsapp', 'Por WhatsApp'], ['impresa', 'Impresa']].map(function (o) {
            return '<button type="button" class="chip" data-envio="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<label class="pos-check ancho"><input type="checkbox" id="clAcepta"' + (cl.acepta ? ' checked' : '') + '> El cliente aceptó recibirla por mail o WhatsApp (lo pide ARCA)</label>' +
      '</div><div class="pos-error" id="clError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="clGenerico">Consumidor final</button>' +
        '<button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="clOk">Listo</button></div>');
    function marcar() { caja.querySelectorAll('[data-envio]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-envio') === envio); }); }
    marcar();
    caja.querySelector('#clEnvio').onclick = function (e) { var b = e.target.closest('[data-envio]'); if (b) { envio = envio === b.getAttribute('data-envio') ? '' : b.getAttribute('data-envio'); marcar(); } };
    caja.querySelector('#clGenerico').onclick = function () { V.cliente = null; V.socio = null; V.cliente_id = null; if (V.letra === 'A') V.letra = 'B'; cerrarVentana(); pintar(); };
    function listo() {
      var x = {
        nombre: caja.querySelector('#clNombre').value.trim(),
        doc: caja.querySelector('#clDoc').value.replace(/\D/g, ''),
        condicion: caja.querySelector('#clCond').value,
        email: caja.querySelector('#clMail').value.trim().toLowerCase(),
        tel: caja.querySelector('#clTel').value.trim(),
        envio: envio,
        acepta: caja.querySelector('#clAcepta').checked
      };
      /* Con la X elegida, un responsable inscripto no la pasa solo a factura A: la X la eligió el vendedor. */
      var quiereA = paraA || V.letra === 'A' || (V.letra !== 'X' && x.condicion === 'responsable_inscripto');
      var mal = '';
      if (x.doc && x.doc.length !== 11 && (x.doc.length < 7 || x.doc.length > 8)) mal = 'El CUIT tiene 11 números y el DNI, 7 u 8.';
      else if (quiereA && x.condicion === 'consumidor_final') mal = 'A un consumidor final se le hace factura B. Cambiá la condición o elegí Factura B.';
      else if (quiereA && x.doc.length !== 11) mal = 'La factura A necesita el CUIT (11 números).';
      else if ((quiereA || x.doc) && !x.nombre) mal = 'Falta el nombre o la razón social.';
      else if (x.envio === 'mail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) mal = 'Falta el mail (o no está bien escrito).';
      else if (x.envio === 'whatsapp' && x.tel.replace(/\D/g, '').length < 8) mal = 'Falta el WhatsApp.';
      else if ((x.envio === 'mail' || x.envio === 'whatsapp') && !x.acepta) mal = 'Para mandársela por mail o WhatsApp, el cliente tiene que aceptarlo (marcá la casilla).';
      if (!errorEn(caja, 'clError', mal)) return;
      V.cliente = x.nombre || x.doc || x.email || x.tel ? x : null;
      if (quiereA) V.letra = 'A';
      else if (V.letra === 'A' && !clienteParaA(V.cliente)) V.letra = 'B';
      cerrarVentana();
      pintar();
    }
    caja.querySelector('#clOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); listo(); } });
  }

  /* "Cargar" (SQL 171): la lupita del cliente. Con el SQL 197 busca los clientes y los socios del Club juntos (por el
     nombre, el DNI o el CUIT, el WhatsApp, el mail o la tarjeta) y tiene «Crear cliente» (Mauricio, 29/10: "cuando buscamos
     un cliente en la lupita, también ahí tiene que estar la opción de crear cliente con todos los datos"); sin el 197,
     sólo los socios, como antes. O se hace socio ahí mismo. Los datos para mandarle la factura siguen en la de siempre. */
  function abrirSocio() {
    var so = V.socio, prueba = enPrueba();
    var caja = ventana('<h3 id="posVentTit">Cliente</h3><p class="pos-bajada">Buscalo por su nombre, DNI o CUIT, WhatsApp, mail o la tarjeta del Club. ' +
        'Si no está, crealo; si quiere sumar puntos, hacelo socio.</p>' +
      (so ? '<div class="so-actual">' + marcaClub(so) + '<b>' + esc(so.nombre) + '</b><span>' + miles(so.puntos) + ' puntos</span>' +
            '<button type="button" class="pos-link" id="soSacar">Sacarlo de la venta</button></div>' : '') +
      campo('', 'Buscar cliente', '<input type="search" id="soBuscar" autocomplete="off" spellcheck="false" placeholder="Nombre, DNI o CUIT, WhatsApp, mail o tarjeta" autofocus>') +
      '<div class="so-lista" id="soLista"></div><div class="pos-error" id="soError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="soFinal">Consumidor final</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="soFactura" title="Para esta venta: la factura A, o mandarle la factura por mail o WhatsApp">Datos para la factura</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="soCrear" title="Con todos sus datos y los de la factura; queda en Clientes"' + (S.sin197 ? ' hidden' : '') + '>Crear cliente</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="soAlta"' + (prueba ? ' disabled title="En modo prueba no se hacen socios: el alta es de verdad"' : '') + '>Hacerlo socio</button></div>');
    var campoB = caja.querySelector('#soBuscar'), lista = caja.querySelector('#soLista'), espera = null, pedido = 0, hallados = [];
    function buscar() {
      var q = campoB.value.trim(), n = ++pedido;
      errorEn(caja, 'soError', '');
      if (q.length < 3) { hallados = []; lista.innerHTML = ''; return; }
      lista.innerHTML = '<p class="so-nada">Buscando…</p>';
      buscarClientes(q).then(function (r) {
        if (n !== pedido || !caja.isConnected) return;
        if (r && r.corto) { hallados = []; lista.innerHTML = '<p class="so-nada">' + esc(r.porque) + '</p>'; return; }
        if (S.sin197) caja.querySelector('#soCrear').hidden = true;
        hallados = r || [];
        lista.innerHTML = hallados.length ? hallados.map(function (h, i) {
          var s = h.socio, c = h.cliente;
          var datos = [c && docTexto(c), c && c.condicion && c.condicion !== 'consumidor_final' ? CONDICION[c.condicion] : '',
                       s ? telCorto(s.telefono) : c.telefono || '', (c && c.mail) || (s && s.mail) || ''].filter(Boolean).join(' · ');
          return '<button type="button" class="so-item" data-so="' + i + '"><span class="so-nom"><b>' + esc(c ? c.nombre : s.nombre) + '</b>' +
            '<small>' + esc(datos) + '</small></span>' +
            (s ? '<span class="so-niv">' + esc(s.nivel || '') + '</span><span class="so-pts">' + miles(Number(s.puntos) || 0) + ' puntos</span>'
               : '<span class="so-niv">Cliente Nº ' + c.numero + '</span><span class="so-pts"></span>') + '</button>';
        }).join('') : '<p class="so-nada">No hay ningún ' + (S.sin197 ? 'socio' : 'cliente ni socio') + ' con «' + esc(q) + '».' +
          (S.sin197 ? (prueba ? '' : ' Si quiere sumarse, tocá «Hacerlo socio».') : ' Tocá «Crear cliente»' + (prueba ? '.' : ' o, si quiere sumar puntos, «Hacerlo socio».')) + '</p>';
      }).catch(function (e) { if (n === pedido && caja.isConnected) { lista.innerHTML = ''; errorEn(caja, 'soError', mensajeDe(e)); } });
    }
    campoB.oninput = function () { clearTimeout(espera); espera = setTimeout(buscar, 300); };
    campoB.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(espera); buscar(); } };
    lista.onclick = function (e) {
      var b = e.target.closest('[data-so]');
      if (!b) return;
      var h = hallados[Number(b.getAttribute('data-so'))];
      if (h.cliente) elegirCliente(h.cliente, h.socio);
      else elegirSocio(h.socio);
      cerrarVentana();
      pintar();
    };
    var sacar = caja.querySelector('#soSacar');
    if (sacar) sacar.onclick = function () { V.socio = null; cerrarVentana(); pintar(); };
    caja.querySelector('#soFinal').onclick = function () { V.cliente = null; V.socio = null; V.cliente_id = null; if (V.letra === 'A') V.letra = 'B'; cerrarVentana(); pintar(); };
    caja.querySelector('#soFactura').onclick = function () { abrirCliente(false); };
    caja.querySelector('#soCrear').onclick = function () { abrirCrearCliente(campoB.value.trim()); };
    caja.querySelector('#soAlta').onclick = function () { abrirAltaSocio(campoB.value.trim()); };
  }
  /** La lupita: los clientes y los socios juntos (SQL 197), cada uno {cliente, socio}; sin el 197, sólo los socios
      (pos_club_buscar), como antes, y no lo vuelve a intentar hasta recargar. */
  function buscarClientes(q) {
    function aSocios(r) { return r && r.corto ? r : (r || []).map(function (s) { return { socio: s, cliente: null }; }); }
    if (S.sin197) return llamar('pos_club_buscar', { p_texto: q }).then(aSocios);
    return llamar('pos_clientes_buscar', { p_texto: q }).catch(function (e) {
      if (!/SQL 197/.test(mensajeDe(e))) throw e;
      S.sin197 = true;
      return llamar('pos_club_buscar', { p_texto: q }).then(aSocios);
    });
  }
  /** El socio elegido: su nombre va al ticket (menos en la factura A, que lleva la razón social) y su mail y su
      WhatsApp quedan a mano para mandarle la factura (con su sí, en «Datos para la factura»). */
  function elegirSocio(s) {
    V.socio = { codigo: s.codigo, nombre: s.nombre, nivel: s.nivel || '', puntos: Number(s.puntos) || 0, factor: Number(s.factor) || 1 };
    /* SQL 197: si antes estaba elegido un cliente de la lista, sus datos no pasan a este socio. */
    var cl = (!V.cliente_id && V.cliente) || { condicion: 'consumidor_final' };
    V.cliente_id = null;
    if (V.letra !== 'A') cl.nombre = s.nombre;
    if (!cl.email && s.mail) cl.email = String(s.mail).toLowerCase();
    if (!cl.tel && s.telefono) cl.tel = s.telefono;
    V.cliente = cl;
  }
  /* "Hacerlo socio": el alta de siempre del Club (club_alta: el bono de bienvenida), con el local de la venta.
     Es de verdad aunque se esté probando: por eso en modo prueba no se puede. */
  function abrirAltaSocio(texto) {
    if (enPrueba()) { avisar('info', 'En modo prueba no se hacen socios: el alta es de verdad.'); return; }
    var dig = String(texto || '').replace(/\D/g, ''), pal = dig ? [] : String(texto || '').trim().split(/\s+/).filter(Boolean);
    var caja = ventana('<h3 id="posVentTit">Hacerlo socio del Club</h3><p class="pos-bajada">El alta de siempre del Club: se lleva el bono de bienvenida ' +
        'y suma desde esta compra. Es de verdad, aunque estés probando el POS.</p>' +
      '<div class="pos-campos">' +
        campo('', 'Nombre', '<input type="text" id="saNombre" maxlength="40" autocomplete="off" value="' + esc(pal[0] || '') + '">') +
        campo('', 'Apellido', '<input type="text" id="saApellido" maxlength="40" autocomplete="off" value="' + esc(pal.slice(1).join(' ')) + '">') +
        campo('', 'WhatsApp', '<input type="tel" id="saTel" maxlength="20" placeholder="Con la característica" value="' + esc(dig.length >= 6 ? texto : '') + '">') +
        campo('', 'Mail <span class="lbl-opc">(si quiere)</span>', '<input type="email" id="saMail" maxlength="120">') +
        '<label class="pos-check ancho"><input type="checkbox" id="saAcepta"> Acepta que le escribamos por WhatsApp con promociones y novedades</label>' +
      '</div><div class="pos-error" id="saError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="saOk">Hacerlo socio</button></div>');
    /* Lo que ya escribió en el buscador pasa al alta: el foco va al primer campo que falta. */
    setTimeout(function () { var f = caja.querySelector(pal[1] ? '#saTel' : pal[0] ? '#saApellido' : '#saNombre'); if (f) f.focus(); }, 0);
    function listo() {
      var x = { nombre: caja.querySelector('#saNombre').value.trim(), apellido: caja.querySelector('#saApellido').value.trim(),
                telefono: caja.querySelector('#saTel').value.trim(), mail: caja.querySelector('#saMail').value.trim(),
                local_id: V.local_id, acepta: caja.querySelector('#saAcepta').checked };
      if (!errorEn(caja, 'saError', !x.nombre ? 'Falta el nombre.' : !x.apellido ? 'Falta el apellido.' :
                                    x.telefono.replace(/\D/g, '').length < 8 ? 'Falta el WhatsApp (con la característica).' :
                                    x.mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.mail) ? 'Ese mail no se entiende: dejalo vacío si no lo tiene a mano.' : '')) return;
      var bt = caja.querySelector('#saOk');
      bt.disabled = true;
      llamar('pos_club_alta', { p: x }).then(function (r) {
        elegirSocio(r.socio);
        cerrarVentana();
        pintar();
        avisar(r.nuevo ? 'ok' : 'info', r.nuevo ? 'Listo: ' + r.socio.nombre + ' ya es socio del Club.' : 'Ese WhatsApp ya era socio del Club (' + r.socio.nombre + '): quedó elegido.');
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'saError', mensajeDe(e)); });
    }
    caja.querySelector('#saOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); listo(); } });
  }

  /* "Pago múltiple" de BlueSoft: varios medios en el mismo ticket. */
  function abrirMultiple() {
    if (V.letra === 'X') { avisar('info', 'La X va sólo con efectivo.'); return; }
    /* Con varios medios no va la promo de un medio (el 10 % es pagando TODO en efectivo). */
    var c = cuenta(Object.assign({}, V, { forma: 'multiple' }));
    if (!c.total) { avisar('info', 'Primero cargá los productos.'); return; }
    /* SQL 200: si venía con una gift card que no alcanza, arranca con ella y el resto en efectivo. */
    var filas = (V.multiples && V.multiples.length ? V.multiples :
                 V.forma === 'giftcard' && V.pago.gc && V.pago.gc.ok ? [{ medio: 'giftcard', monto: Math.min(cent(V.pago.gc.valor), c.total), gc: V.pago.gc }, { medio: 'efectivo', monto: 0 }] :
                 [{ medio: 'efectivo', monto: 0 }, { medio: 'tarjeta', monto: 0, cuotas: 1 }])
      .map(function (x) { return Object.assign({}, x); });
    var caja = ventana('<h3 id="posVentTit">Pago múltiple</h3><p class="pos-bajada">El total es <b>' + plata(c.total) + '</b>. Si dejás un monto vacío, se completa con lo que falta.</p>' +
      '<div class="pos-pagos" id="pmFilas"></div>' +
      '<p><button type="button" class="pos-link" id="pmMas">+ Agregar otro pago</button></p>' +
      '<div class="pos-pago-cuenta" id="pmCuenta"></div><div class="pos-error" id="pmError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="pmOk">Aceptar</button></div>', true);
    function fila(x, i) {
      var mas = x.medio === 'tarjeta'
        ? '<div class="pos-pago-mas">' + campo('', 'Tarjeta', '<select data-k="tarjeta"><option value="">Elegí…</option>' + opciones(TARJETAS.map(function (t) { return [t[0], t[0]]; }), x.tarjeta) + '</select>') +
          campo('', 'Cuotas', '<select data-k="cuotas">' + opciones(CUOTAS.map(function (n) { return [n, n]; }), x.cuotas || 1) + '</select>') +
          campo('', 'Cupón', '<input type="text" data-k="cupon" inputmode="numeric" maxlength="20" value="' + esc(x.cupon || '') + '">') + '</div>'
        : x.medio === 'giftcard' ? '<div class="pos-pago-mas">' + campo('', 'Gift card', '<input type="text" data-k="gc" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="Pasala por la pistola" value="' +
            esc(x.gc ? x.gc.codigo : '') + '">') + '<p class="tk-gc" data-gc-info role="status">' + textoGc(x.gc, 'pagar') + '</p></div>'   // SQL 200
        : x.medio === 'efectivo' ? '<div class="pos-pago-mas"></div>'
        : '<div class="pos-pago-mas">' + campo('', 'Nº de operación', '<input type="text" data-k="cupon" maxlength="30" value="' + esc(x.cupon || '') + '">') + '</div>';
      return '<div class="pos-pago-fila" data-f="' + i + '">' +
        campo('', 'Medio', '<select data-k="medio">' + opciones(Object.keys(MEDIOS_VENTA).map(function (k) { return [k, MEDIOS_VENTA[k]]; }), x.medio) + '</select>') +
        campo('', 'Monto', '<input type="text" inputmode="decimal" data-k="monto" value="' + plataCampo(x.monto) + '">') + mas +
        '<button type="button" class="tk-quitar" data-quitar-pago="' + i + '" title="Quitar este pago" aria-label="Quitar este pago">' + icono('x') + '</button></div>';
    }
    function cuentaTxt() {
      var s = sumaPagos(filas), dif = c.total - s, e = caja.querySelector('#pmCuenta');
      e.className = 'pos-pago-cuenta ' + (dif === 0 ? 'ok' : 'mal');
      e.innerHTML = '<span>Pagos: ' + plata(s) + '</span><span>' + (dif === 0 ? 'Justo' : dif > 0 ? 'Falta ' + plata(dif) : 'Sobra ' + plata(-dif)) + '</span>';
    }
    function pintarFilas() { caja.querySelector('#pmFilas').innerHTML = filas.map(fila).join(''); cuentaTxt(); engancharGcs(); }
    /* SQL 200: cada renglón de gift card, con su tarjeta; al leerla, el monto es lo que falta (hasta lo que vale). */
    function engancharGcs() {
      caja.querySelectorAll('[data-k="gc"]').forEach(function (inp) {
        var f = inp.closest('[data-f]'), x = filas[Number(f.getAttribute('data-f'))];
        engancharGc(inp, 'pagar', function (r) {
          x.gc = r;
          f.querySelector('[data-gc-info]').innerHTML = textoGc(r, 'pagar');
          if (r && r.ok && !x.monto) {
            x.monto = Math.min(cent(r.valor), Math.max(c.total - sumaPagos(filas), 0));
            f.querySelector('[data-k="monto"]').value = plataCampo(x.monto);
            cuentaTxt();
          }
        });
      });
    }
    pintarFilas();
    var lista = caja.querySelector('#pmFilas');
    lista.addEventListener('input', function (e) {
      var f = e.target.closest('[data-f]'), k = e.target.getAttribute('data-k');
      if (!f || !k || k === 'medio' || k === 'gc') return;
      var x = filas[Number(f.getAttribute('data-f'))];
      if (k === 'monto') { var m = leerPlata(e.target.value); x.monto = isNaN(m) ? 0 : m; cuentaTxt(); }
      else x[k] = e.target.value;
    });
    lista.addEventListener('change', function (e) {
      var f = e.target.closest('[data-f]'), k = e.target.getAttribute('data-k');
      if (!f || !k) return;
      var x = filas[Number(f.getAttribute('data-f'))];
      if (k === 'medio') {
        x.medio = e.target.value; delete x.tarjeta; delete x.cupon; delete x.gc; x.cuotas = 1; pintarFilas();
        var q = x.medio === 'giftcard' && caja.querySelector('[data-f="' + f.getAttribute('data-f') + '"] [data-k="gc"]');
        if (q) q.focus();   // SQL 200: lista para la pistola
      }
      else if (k === 'tarjeta' || k === 'cuotas') x[k] = e.target.value;
    });
    lista.addEventListener('click', function (e) {
      var b = e.target.closest('[data-quitar-pago]');
      if (!b) return;
      filas.splice(Number(b.getAttribute('data-quitar-pago')), 1);
      pintarFilas();
    });
    caja.querySelector('#pmMas').onclick = function () { filas.push({ medio: 'mercadopago', monto: 0 }); pintarFilas(); };
    caja.querySelector('#pmOk').onclick = function () {
      var vacias = filas.filter(function (x) { return !x.monto; });
      if (vacias.length === 1) { vacias[0].monto = c.total - sumaPagos(filas); }
      var mal = '';
      filas = filas.filter(function (x) { return x.monto || x === vacias[0]; });
      if (filas.length < 2) mal = 'Un pago múltiple tiene por lo menos dos pagos (si es uno solo, elegilo en «Forma de pago»).';
      else if (filas.some(function (x) { return !(x.monto > 0); })) mal = 'Hay un pago sin monto.';
      else if (filas.some(function (x) { return x.medio === 'tarjeta' && !x.tarjeta; })) mal = 'Elegí qué tarjeta es.';
      /* SQL 200: la gift card leída, que esté para cobrar, que no pague más de lo que vale y una sola vez. */
      else if (filas.some(function (x) { return x.medio === 'giftcard' && !(x.gc && x.gc.ok); })) {
        var gm = filas.filter(function (x) { return x.medio === 'giftcard' && !(x.gc && x.gc.ok); })[0].gc;
        mal = gm && gm.codigo ? motivoGc(gm, 'pagar') : 'Pasá por la pistola la Gift Card (o elegí otro medio).';
      }
      else if (filas.some(function (x) { return x.medio === 'giftcard' && x.monto > cent(x.gc.valor); })) mal = 'Una Gift Card no paga más de lo que vale.';
      else if (filas.some(function (x, i) { return x.medio === 'giftcard' && filas.some(function (y, j) { return j < i && y.medio === 'giftcard' && y.gc.codigo === x.gc.codigo; }); })) mal = 'La misma Gift Card está dos veces.';
      else if (sumaPagos(filas) !== c.total) mal = 'Los pagos tienen que sumar ' + plata(c.total) + '.';
      if (mal) { pintarFilas(); errorEn(caja, 'pmError', mal); return; }
      V.multiples = filas.map(function (x) {
        var p = { medio: x.medio, monto: x.monto };
        if (x.medio === 'tarjeta') { p.tarjeta = x.tarjeta; p.tipo_tarjeta = tipoTarjeta(x.tarjeta); p.cuotas = Number(x.cuotas) || 1; }
        if (x.cupon) p.cupon = String(x.cupon).trim();
        if (x.medio === 'giftcard') { p.giftcard = x.gc.codigo; p.gc = x.gc; }   // SQL 200
        return p;
      });
      V.forma = 'multiple';
      cerrarVentana();
      pintarPago();
      pintar();
    };
  }

  /* ── Guardar ── (aTickets: el "Guardar" solo, que termina en Tickets con la venta marcada) */
  function guardarVenta(aTickets) {
    if (S.guardando || !V) return;
    var c = cuenta(V), cl = V.cliente || {};
    var pagos = pagosDe(c.total);
    var mal = !V.local_id ? 'Elegí la sucursal.' :
      !V.vendedor ? 'Elegí quién vende.' :
      !V.lineas.length ? 'La venta no tiene productos.' :
      V.lineas.some(function (l) { return !l.precio; }) ? 'Hay una prenda sin precio: escribilo en «Precio unit.».' :
      V.letra === 'A' && !clienteParaA(V.cliente) ? 'La factura A necesita el cliente con su CUIT: tocá «Cargar».' :
      V.letra === 'X' && V.forma !== 'efectivo' ? 'La X va sólo con efectivo.' :
      /* SQL 200 */
      pagos.some(function (x) { return x.medio === 'giftcard'; }) && V.lineas.some(function (l) { return l.giftcard; }) ? 'Una Gift Card no se compra con otra Gift Card.' :
      V.forma === 'giftcard' && !(V.pago.gc && V.pago.gc.ok) ? (V.pago.gc && V.pago.gc.codigo ? motivoGc(V.pago.gc, 'pagar') : 'Pasá por la pistola la Gift Card con la que paga.') :
      V.forma === 'giftcard' && cent(V.pago.gc.valor) < c.total ? 'La Gift Card no alcanza: el resto, con otro medio en «Múltiple».' :
      V.forma === 'tarjeta' && !V.pago.tarjeta ? 'Elegí qué tarjeta es.' :
      V.forma === 'efectivo' && V.pago.recibido && V.pago.recibido < c.total ? 'Lo recibido en efectivo es menos que el total.' :
      V.forma === 'multiple' && sumaPagos(V.multiples) !== c.total ? 'Los pagos no suman el total: tocá «Cambiar» en Pagos.' : '';
    if (mal) { avisar('err', mal); return; }
    /* SQL 200: la gift card se usa entera (como en Cobrar): si vale más que lo que paga, la diferencia se pierde. */
    var sobra = sobraGc(pagos);
    if (sobra && !confirm('La Gift Card se usa entera, como en Cobrar: los ' + plata(sobra) + ' que sobran se pierden. ¿Guardar igual?')) return;
    var l0 = localDe(V.local_id);
    var p = {
      clave: V.clave, prueba: enPrueba(), local_id: V.local_id, vendedor: V.vendedor, letra: V.letra, lista_id: V.lista_id,
      cliente_nombre: cl.nombre || '', cliente_doc: cl.doc || '', cliente_condicion: cl.condicion || 'consumidor_final',
      cliente_email: cl.email || '', cliente_tel: cl.tel || '', envio: cl.envio || '', observaciones: V.observaciones || '',
      socio: V.socio ? V.socio.codigo : '',
      items: V.lineas.map(function (l) {
        var it = { codigo: l.codigo || '', descripcion: l.descripcion, talle: l.talle || '', color: l.color || '', cantidad: l.cantidad, precio: aPesos(l.precio) };
        if (l.giftcard) it.giftcard = l.giftcard;   // SQL 200: la tarjeta que se vende
        return it;
      }),
      descuentos: c.descuentos.map(function (d) { return { tipo: d.tipo, promo_id: d.promo_id || '', descripcion: d.descripcion, monto: aPesos(d.monto) }; }),
      pagos: pagos.map(function (x) {
        var y = Object.assign({}, x, { monto: aPesos(x.monto) });
        delete y.gc;   // SQL 200: lo de la pantalla no viaja
        if (y.recibido) y.recibido = aPesos(y.recibido); else delete y.recibido;
        return y;
      })
    };
    S.guardando = true;
    var b = $('vGuardar'), bv = $('vGuardarVer'), bx = aTickets ? bv : b;
    if (b) b.disabled = true;
    if (bv) bv.disabled = true;
    if (bx) bx.textContent = 'Guardando…';
    var socio = V.socio;
    llamar('pos_venta_guardar', { p: p }).then(function (r) {
      S.ultimo = { id: r.id, numero: r.numero, serie: r.serie || 'factura', total: c.total, local: nombreLocal(l0), ya: !!r.ya };
      S.stock = {};   // lo vendido salió del stock: se vuelve a traer
      V = ventaNueva(V);
      guardarBorrador();
      S.guardando = false;
      /* Los puntos del socio (SQL 171): sumados, o anotados para cargarlos en Cobrar mientras la regla esté apagada. */
      var n = Number(r.socio_puntos) || 0, quien = socio ? String(socio.nombre || '').split(' ')[0] : '';
      avisar('ok', nombreVenta(S.ultimo) + ' guardada.' + (!socio || !n || p.prueba ? '' :
        r.puntos_sumados ? ' Le sumó ' + miles(n) + ' puntos a ' + quien + '.' : ' Los ' + miles(n) + ' puntos de ' + quien + ' se cargan en Cobrar.'));
      if (S.vista !== 'venta') return;
      if (!aTickets) { verVenta(); return; }
      /* A Tickets, en "Hoy" (la venta recién hecha tiene que estar en la lista), con la venta marcada arriba. */
      S.marcar = r.id;
      guardarJSON('pos_tickets_periodo', { atajo: 'hoy' });
      ir('tickets');
    }).catch(function (e) {
      S.guardando = false;
      if (b && b.isConnected) { b.disabled = false; b.innerHTML = textoGuardar(true); }
      if (bv && bv.isConnected) { bv.disabled = false; bv.innerHTML = textoGuardar(false); }
      if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo. La venta sigue armada.'); persona.entrar(); return; }
      avisar('err', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((S.vista !== 'venta' && S.vista !== 'cambio') || _velo || !S.ini) return;
    if (e.key === 'F9') { e.preventDefault(); if (S.vista === 'venta') guardarVenta(); else guardarCambio(); }
    else if (e.key === 'F2') {
      e.preventDefault();
      /* En el cambio, F2 pasa de un campo al otro (lo que vuelve ↔ lo que se lleva). */
      var p = S.vista === 'venta' ? $('vProd') : $(document.activeElement && document.activeElement.id === 'cbVuelve' ? 'cbSale' : 'cbVuelve');
      if (p) p.focus();
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     EL TICKET GUARDADO (verlo y anularlo)
     ════════════════════════════════════════════════════════════════════ */
  /** Los pagos de un ticket, uno por renglón. */
  function pagosTicket(t) {
    return (t.pagos || []).map(function (g) {
      var x = MEDIOS_VENTA[g.medio] || g.medio;
      if (g.medio === 'tarjeta') x += ' ' + (g.tarjeta || '') + (g.cuotas > 1 ? ' · ' + g.cuotas + ' cuotas' : '');
      if (g.cupon) x += (g.medio === 'giftcard' ? ' ' : ' · ' + (g.medio === 'tarjeta' ? 'cupón ' : 'op. ')) + g.cupon;   // SQL 200: «Gift card Black Nº 001»
      if (g.recibido) x += ' · recibido ' + plata(cent(g.recibido)) + ', vuelto ' + plata(cent(g.vuelto || 0));
      return '<li>' + esc(x) + ' — <b>' + plata(cent(g.monto)) + '</b></li>';
    }).join('');
  }
  /** Los productos de un ticket (y sus descuentos) y el total: el mismo cuadro en el ticket y en su nota de crédito. */
  function productosTicket(t) {
    return '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Ítem</th><th>Código</th><th>Descripción</th><th class="c">Talle</th><th>Color</th><th class="c">Cant.</th><th class="n">Precio unit.</th><th class="n">Total</th></tr></thead><tbody>' +
        (t.items || []).map(function (i) {
          return '<tr><td>' + ('00' + i.item).slice(-3) + '</td><td>' + esc(i.codigo || '—') + '</td><td>' + esc(i.descripcion) + '</td><td class="c">' + esc(i.talle || '') + '</td>' +
            '<td>' + esc(i.color ? nombreColor(i.color, i.codigo) : '') + '</td><td class="c">' + i.cantidad + '</td><td class="n">' + plata(cent(i.precio)) + '</td><td class="n">' + plata(cent(i.total)) + '</td></tr>';
        }).join('') +
        (t.descuentos_detalle || []).map(function (d) {
          return '<tr><td></td><td colspan="6">' + esc(d.descripcion) + '</td><td class="n">−' + plata(cent(d.monto)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
      '<div class="pos-ticket-tot"><span>Neto ' + plata(cent(t.neto)) + (Number(t.descuentos) ? ' · Descuentos −' + plata(cent(t.descuentos)) : '') +
        ' · ' + t.cantidad + (t.cantidad === 1 ? ' prenda' : ' prendas') + '</span><b>Total ' + plata(cent(t.total)) + '</b></div>';
  }

  function abrirTicket(id, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">Ticket</h3><p class="cargando">Cargando…</p>', true);
    var dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_venta', { p_id: id }).then(function (t) {
      if (!_velo || !caja.isConnected) return;
      var anulada = t.estado === 'anulada';
      var pagos = pagosTicket(t);
      /* SQL 205: las facturas A y B se anulan con una nota de crédito, como en BlueSoft; la X, con «Anular la venta».
         Sin el 205 (pos_venta no trae nota_credito), todo como antes. */
      var con205 = Object.prototype.hasOwnProperty.call(t, 'nota_credito'), nota = t.nota_credito || null;
      var conNota = con205 && t.letra !== 'X';
      var izq = anulada || !puede('anular') ? '' : !conNota ? '<button type="button" class="btn btn-sec btn-chico izq" id="tkAnularBtn">Anular la venta</button>' :
        t.cierre ? '' : '<button type="button" class="btn btn-sec btn-chico izq" id="tkNotaBtn" title="Anula el ticket entero, como «Generar nota crédito» de BlueSoft">Nota de crédito</button>';
      dentro.innerHTML = '<h3 id="posVentTit">Ticket ' + esc(ref(t)) + ' · ' + esc(LETRAS[t.letra] || t.letra) + ' ' +
          (anulada ? '<span class="pill pill-bad">' + (nota ? 'Anulada · ' + esc(refNota(nota)) : 'Anulada') + '</span>' : '<span class="pill pill-ok">Cobrada</span>') +
          (t.prueba ? ' <span class="pill pill-warn">Prueba</span>' : '') + '</h3>' +
        (t.prueba ? '<div class="pos-cartel prueba">Es una venta de prueba: no cuenta en ningún total y se borra con «Borrar las pruebas».</div>' : '') +
        '<div class="pos-ticket-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(t.fecha)) + '</div>' +
          '<div><span>Sucursal</span>' + esc(bonito(t.local)) + '</div>' +
          '<div><span>Vendedor</span>' + esc(t.vendedor) + '</div>' +
          '<div><span>Cargó</span>' + esc(t.cargado_por_nombre || '—') + '</div>' +
          '<div><span>Cliente</span>' + esc(t.cliente_nombre || 'Consumidor final') + (t.cliente_doc ? '<br>' + esc(t.cliente_doc.length === 11 ? 'CUIT ' + cuit(t.cliente_doc) : 'DNI ' + t.cliente_doc) : '') + '</div>' +
          '<div><span>Condición de IVA</span>' + esc(CONDICION[t.cliente_condicion] || '') + '</div>' +
          '<div><span>ARCA</span>' + (t.factura ? 'Con CAE' : t.letra === 'X' ? 'No va (comprobante interno)' : t.prueba ? 'No va (es una prueba)' : 'Sin factura (la hace BlueSoft)') + '</div>' +
          /* SQL 171: el socio del Club y sus puntos. */
          (t.socio ? '<div><span>Club</span>' + (t.socio_nivel ? esc(t.socio_nivel) + ' · ' : '') + 'tarjeta ' + esc(t.socio) + '<br>' + miles(Number(t.socio_puntos) || 0) + ' puntos ' +
            (t.puntos_sumados ? 'sumados' : t.prueba ? '(una prueba no suma)' : anulada ? '(la venta está anulada)' : 'sin sumar (se cargan en Cobrar)') + '</div>' : '') +
        '</div>' +
        productosTicket(t) +
        (pagos ? '<p class="pos-lbl" style="margin:10px 0 4px">Pagos</p><ul style="margin:0;padding-left:18px;font-size:14px;display:grid;gap:3px">' + pagos + '</ul>' : '') +
        (t.observaciones ? '<p style="font-size:14px;margin:10px 0 0"><b>Observaciones:</b> ' + esc(t.observaciones) + '</p>' : '') +
        (anulada && nota ? '<div class="pos-cartel mal" style="margin-top:12px">Anulada con la nota de crédito <b>' + esc(refNota(nota)) + '</b> el ' + esc(fechaHora(nota.fecha)) +
            (nota.hizo_nombre ? ' por ' + esc(nota.hizo_nombre) : '') + ': ' + esc(nota.motivo || '') +
            ' <button type="button" class="pos-link" id="tkVerNota">Ver la nota de crédito</button></div>' :
          anulada ? '<div class="pos-cartel mal" style="margin-top:12px">Anulada el ' + esc(fechaHora(t.anulada_en)) + (t.anulada_por_nombre ? ' por ' + esc(t.anulada_por_nombre) : '') + ': ' + esc(t.anulada_motivo || '') + '</div>' :
          conNota && t.cierre && puede('anular') ? '<div class="pos-cartel" style="margin-top:12px">Ya entró en el cierre de caja ' + esc(refCierre(t.cierre)) +
            ': para hacerle la nota de crédito, primero hay que anular ese cierre.</div>' : '') +
        '<div id="tkAnular"></div>' +
        '<div class="pos-pie">' + izq +
          /* «Duplicar» de BlueSoft: la venta de nuevo, para rehacer bien la que se anuló (sólo en el mostrador, donde está la Nueva venta). */
          (MODO === 'mostrador' ? '<button type="button" class="btn btn-sec btn-chico" id="tkDuplicar" title="Una venta nueva con los mismos productos, el vendedor y el cliente">Duplicar</button>' : '') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var vn = dentro.querySelector('#tkVerNota');
      if (vn) vn.onclick = function () { abrirNota(t.id, alCambiar); };
      var nb = dentro.querySelector('#tkNotaBtn');
      if (nb) nb.onclick = function () { hacerNota(t, alCambiar); };
      var du = dentro.querySelector('#tkDuplicar');
      if (du) du.onclick = function () { duplicarVenta(t); };
      var ab = dentro.querySelector('#tkAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        var z = dentro.querySelector('#tkAnular');
        z.innerHTML = '<div class="pos-cartel" style="margin-top:12px">La venta queda en la lista, tachada, con quién la anuló y por qué.' +
          (t.serie === 'prueba' ? '' : ' Lo vendido vuelve al stock de la sucursal.') +
          (t.puntos_sumados ? ' Al socio se le descuentan los ' + miles(Number(t.socio_puntos) || 0) + ' puntos.' : '') + ' No se puede deshacer.' +
          campo('', '¿Por qué se anula?', '<textarea id="tkMotivo" maxlength="300" rows="2"></textarea>') + '<div class="pos-error" id="tkError"></div>' +
          '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="tkConfirmar">Anular la venta ' + esc(ref(t)) + '</button></div></div>';
        var m = z.querySelector('#tkMotivo');
        m.focus();
        z.querySelector('#tkConfirmar').onclick = function () {
          var motivo = m.value.trim(), bt = this;
          if (!errorEn(dentro, 'tkError', motivo.length < 3 ? 'Escribí por qué se anula.' : '')) return;
          bt.disabled = true;
          llamar('pos_venta_anular', { p_id: t.id, p_motivo: motivo }).then(function () {
            S.stock = {};
            avisar('ok', 'La venta ' + ref(t) + ' quedó anulada.');
            if (alCambiar) alCambiar();
            abrirTicket(t.id, alCambiar);
          }).catch(function (e) { bt.disabled = false; errorEn(dentro, 'tkError', mensajeDe(e)); });
        };
      };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Ticket</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     LA NOTA DE CRÉDITO (SQL 205)
     Mauricio (30/10): "La nota de crédito la hacen para cancelar un ticket
     en B… me olvidé de hacer un descuento, le erré en algo." Como en
     BlueSoft (sus fotos): en el ticket, «Nota de crédito»; se abre la nota
     con el ticket entero y se guarda. La venta queda anulada (sale de la
     caja), en el posnet se anula la operación y se hace la venta de nuevo,
     bien («Duplicar»). Sólo A y B; la X se sigue anulando.
     ════════════════════════════════════════════════════════════════════ */
  /** Lo de ARCA de una nota: arca = pendiente | autorizada | sin_factura | no_va (con la nota todavía sin guardar, el que va a tener). */
  function arcaNota(arca, cae) {
    return arca === 'autorizada' ? 'Con CAE' + (cae ? ' ' + esc(cae) : '') :
      arca === 'pendiente' ? 'Pendiente: se le pide el CAE cuando el POS facture' :
      arca === 'no_va' ? 'No va (es una prueba)' : 'No va: el ticket no tiene factura de ARCA (la hace BlueSoft). La nota que vale, hacela también en BlueSoft.';
  }
  /** Los datos de la nota (n: la nota guardada, o null mientras se arma), el ticket que anula y sus productos, como la de BlueSoft. */
  function datosNota(t, n) {
    var pagos = (t.pagos || []).map(function (g) { return (MEDIOS_VENTA[g.medio] || g.medio) + (g.medio === 'tarjeta' && g.tarjeta ? ' ' + g.tarjeta : ''); }).join(' + ');
    return '<div class="pos-ticket-datos">' +
        '<div><span>Fecha</span>' + esc(n ? fechaHora(n.fecha) : fechaCorta(S.ini.hoy)) + '</div>' +
        '<div><span>Sucursal</span>' + esc(bonito(t.local)) + '</div>' +
        '<div><span>Número</span>' + (n ? '<b>' + esc(refNota(n)) + '</b>' : 'Lo da la base al guardar') + '</div>' +
        '<div><span>Vendedor</span>' + esc(t.vendedor) + '</div>' +
        (n ? '<div><span>La hizo</span>' + esc(n.hizo_nombre || '—') + '</div>' : '') +
        '<div><span>Cliente</span>' + esc(t.cliente_nombre || 'Consumidor final') + (t.cliente_doc ? '<br>' + esc(t.cliente_doc.length === 11 ? 'CUIT ' + cuit(t.cliente_doc) : 'DNI ' + t.cliente_doc) : '') + '</div>' +
        '<div><span>Condición de IVA</span>' + esc(CONDICION[t.cliente_condicion] || '') + '</div>' +
        '<div><span>Forma de pago</span>' + esc(pagos || '—') + '</div>' +
        '<div class="nc-anula"><span>Anula</span>Ticket ' + esc(ref(t)) + ' · ' + esc(LETRAS[t.letra] || t.letra) + ' del ' + esc(fechaHora(t.fecha)) + ' · ' + plata(cent(t.total)) + ' (100 %)</div>' +
        '<div class="nc-arca"><span>ARCA</span>' + arcaNota(n ? n.arca : t.prueba ? 'no_va' : t.factura ? 'pendiente' : 'sin_factura', n && n.cae) + '</div>' +
      '</div>' + productosTicket(t);
  }

  /* Hacer la nota de crédito de una venta A o B (t: lo que trajo pos_venta). */
  function hacerNota(t, alCambiar) {
    var tarjeta = (t.pagos || []).some(function (g) { return g.medio === 'tarjeta'; });
    /* En la PC del local (657 de alto) el ticket entero no entra: lo de abajo (qué pasa, el motivo y Guardar) queda fijo
       al pie de la ventana y el ticket se desplaza arriba, tenga los productos que tenga. */
    var caja = ventana('<h3 id="posVentTit">Nota de crédito · ' + esc(LETRAS[t.letra] || t.letra) + (t.prueba ? ' <span class="pill pill-warn">Prueba</span>' : '') + '</h3>' +
      datosNota(t, null) +
      '<div class="nc-accion">' +
        '<p class="nc-efecto">Al guardarla, el ticket ' + esc(ref(t)) + ' queda anulado entero: deja de contar en la caja' +
          (t.prueba ? '' : ' y lo vendido vuelve al stock') +
          (t.puntos_sumados ? '; al socio se le descuentan los ' + miles(Number(t.socio_puntos) || 0) + ' puntos' : '') + '. No se puede deshacer.' +
          (tarjeta ? ' <b>Anulá también la operación en el posnet.</b>' : '') + '</p>' +
        campo('ancho', '¿Por qué se hace?', '<textarea id="ncMotivo" maxlength="300" rows="2" placeholder="Por ejemplo: me olvidé del descuento" autofocus></textarea>') +
        '<div class="pos-error" id="ncError"></div>' +
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="ncVolver">Volver al ticket</button>' +
          '<button type="button" class="btn btn-pri btn-chico" id="ncGuardar">Guardar la nota de crédito</button></div>' +
      '</div>', true);
    caja.querySelector('#ncVolver').onclick = function () { abrirTicket(t.id, alCambiar); };
    var m = caja.querySelector('#ncMotivo');
    m.oninput = function () { errorEn(caja, 'ncError', ''); };
    caja.querySelector('#ncGuardar').onclick = function () {
      var motivo = m.value.trim(), bt = this;
      if (!errorEn(caja, 'ncError', motivo.length < 3 ? 'Escribí por qué se hace la nota de crédito.' : '')) { m.focus(); return; }
      bt.disabled = true;
      llamar('pos_nc_hacer', { p_venta: t.id, p_motivo: motivo }).then(function (r) {
        S.stock = {};
        avisar('ok', 'Listo: la nota de crédito ' + refNota(r) + ' anuló la venta ' + ref(t) + '.');
        if (alCambiar) alCambiar();
        abrirNota(t.id, alCambiar, true);
      }).catch(function (e) {
        bt.disabled = false;
        if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo.'); persona.entrar(); return; }
        errorEn(caja, 'ncError', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se hace dos veces.' : mensajeDe(e));
      });
    };
  }

  /* Una nota de crédito guardada (id: el de la venta que anula). recien: la que se acaba de hacer (lo que sigue es rehacer la venta). */
  function abrirNota(id, alCambiar, recien) {
    var caja = ventana('<h3 id="posVentTit">Nota de crédito</h3><p class="cargando">Cargando…</p>', true);
    var dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_venta', { p_id: id }).then(function (t) {
      if (!_velo || !caja.isConnected) return;
      var n = t.nota_credito;
      if (!n) { dentro.innerHTML = '<h3 id="posVentTit">Nota de crédito</h3><div class="pos-cartel mal">Esa venta no tiene nota de crédito.</div>'; return; }
      var dup = MODO === 'mostrador';
      dentro.innerHTML = '<h3 id="posVentTit">Nota de crédito ' + esc(refNota(n)) + ' · ' + esc(LETRAS[n.letra] || n.letra) + (n.prueba ? ' <span class="pill pill-warn">Prueba</span>' : '') + '</h3>' +
        (n.prueba ? '<div class="pos-cartel prueba">Es una nota de prueba: se borra con «Borrar las pruebas», junto con su venta.</div>' : '') +
        (recien ? '<div class="pos-cartel st-ok">Listo: la venta ' + esc(ref(t)) + ' quedó anulada.' + (dup ? ' Ahora hacé la venta de nuevo, bien: «Hacer la venta de nuevo» la arma con los mismos productos.' : '') + '</div>' : '') +
        datosNota(t, n) +
        '<p style="font-size:14px;margin:10px 0 0"><b>Motivo:</b> ' + esc(n.motivo) + '</p>' +
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="ncTicket">Ver el ticket ' + esc(ref(t)) + '</button>' +
          (dup ? '<button type="button" class="btn ' + (recien ? 'btn-pri' : 'btn-sec') + ' btn-chico" id="ncDuplicar">Hacer la venta de nuevo</button>' : '') +
          '<button type="button" class="btn ' + (recien && dup ? 'btn-sec' : 'btn-pri') + ' btn-chico" data-cerrar>Cerrar</button></div>';
      dentro.querySelector('#ncTicket').onclick = function () { abrirTicket(t.id, alCambiar); };
      var d = dentro.querySelector('#ncDuplicar');
      if (d) d.onclick = function () { duplicarVenta(t); };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Nota de crédito</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* «Duplicar» de BlueSoft: una venta nueva con los mismos productos (a su precio), el vendedor, el comprobante y el cliente,
     para rehacer bien la que se anuló. Los descuentos, el socio y la forma de pago se cargan de nuevo (casi siempre el error
     estaba ahí). Las gift cards que se vendieron no se copian: se pasan de nuevo por la pistola. */
  function duplicarVenta(t) {
    var l = localMio(t.local_id);
    if (!l) { avisar('err', 'Esa venta es de una sucursal que no es tuya: no la podés duplicar.'); return; }
    var antes = leerJSON(K_BORRADOR, null);
    if (antes && antes.lineas && antes.lineas.length && !confirm('Tenés una venta a medio armar. ¿La reemplazo por la copia del ticket ' + ref(t) + '?')) return;
    var b = ventaNueva();
    b.local_id = l.id;
    b.vendedor = t.vendedor || '';
    b.lista_id = listaPorId(t.lista_id) ? t.lista_id : listaDe(l);
    b.letra = LETRAS[t.letra] ? t.letra : 'B';
    if (t.cliente_nombre || t.cliente_doc || t.cliente_email || t.cliente_tel) {
      b.cliente = { nombre: t.cliente_nombre || '', doc: t.cliente_doc || '', condicion: t.cliente_condicion || 'consumidor_final',
                    email: t.cliente_email || '', tel: t.cliente_tel || '', envio: t.envio || '', acepta: !!t.envio };
    }
    if (b.letra === 'A' && !clienteParaA(b.cliente)) b.letra = 'B';
    var gcs = 0;
    (t.items || []).forEach(function (i) {
      if (i.beneficio || i.codigo === 'GIFTCARD') { gcs++; return; }
      var p = i.codigo ? PROD[i.codigo] : null, c = cent(i.precio);
      b.lineas.push({ codigo: i.codigo || '', descripcion: i.descripcion, rubro: p ? p[2] || '' : '', talle: i.talle || '', color: i.color || '',
                      color_nom: i.color ? nombreColor(i.color, i.codigo) : '', cantidad: i.cantidad, precio: c,
                      propio: !p || precioDe(i.codigo, b.lista_id) !== c, libre: !p });
    });
    V = b;
    guardarBorrador();
    var falta = (Number(t.descuentos) ? ['los descuentos'] : []).concat(t.socio ? ['el socio del Club'] : [], ['la forma de pago']);
    avisar('ok', 'Copié el ticket ' + ref(t) + (gcs ? ' (sin ' + (gcs === 1 ? 'la gift card: pasala' : 'las gift cards: pasalas') + ' de nuevo)' : '') + '. Cargá ' +
      (falta.length > 1 ? falta.slice(0, -1).join(', ') + ' y ' + falta[falta.length - 1] : falta[0]) + '.');
    ir('venta');
  }

  /* ════════════════════════════════════════════════════════════════════
     TICKETS (el listado de BlueSoft)
     ════════════════════════════════════════════════════════════════════ */
  /** "Borrar las pruebas" (en Tickets y en Cambios): las ventas y los cambios de prueba, con su caja de prueba. */
  function borrarPruebas(loc, bt, despues) {
    var l = loc && localDe(loc);
    if (!confirm('¿Borrar ' + (l ? 'las pruebas de ' + nombreLocal(l) : 'todas las pruebas') +
                 ' (ventas, cambios y ventas fallidas, de cualquier día), con su caja de prueba? Las de verdad no se tocan. No se puede deshacer.')) return;
    bt.disabled = true;
    llamar('pos_pruebas_borrar', { p_local: loc || null }).then(function (n) {
      bt.disabled = false;
      avisar('ok', n ? 'Listo: se ' + (n === 1 ? 'borró 1 prueba.' : 'borraron ' + n + ' pruebas.') : 'No había pruebas para borrar.');
      if (S.ultimo && S.ultimo.serie === 'prueba') S.ultimo = null;
      if (S.cambioHecho && S.cambioHecho.prueba) S.cambioHecho = null;
      despues();
    }).catch(function (e) { bt.disabled = false; avisar('err', mensajeDe(e)); });
  }

  function verTickets() {
    var c = $('cuerpo'), todos = {}, prueba = enPrueba();
    Object.keys(S.ini.vendedores || {}).forEach(function (k) { (S.ini.vendedores[k] || []).forEach(function (n) { todos[n] = 1; }); });
    c.classList.add('lleno');
    c.innerHTML = cabeza('Tickets' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), 'Las ventas del POS de todas las sucursales.',
        '<button type="button" class="btn btn-sec btn-chico" id="tkBorrar" hidden>Borrar las pruebas</button>' +
        '<button type="button" class="btn btn-sec btn-chico" data-ir="cambio" title="Ticket de cambio: lo que vuelve y lo que se lleva">Cambio</button>') +
      '<div class="pos-filtros"><div id="tkPer"></div>' +
        campo('', 'Sucursal', '<select id="tkLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Vendedor', '<select id="tkVend"><option value="">Todos</option>' + opciones(Object.keys(todos).sort().map(function (n) { return [n, n]; }), '') + '</select>') +
        campo('', 'Comprobante', '<select id="tkLetra"><option value="">Todos</option>' + opciones([['A', LETRAS.A], ['B', LETRAS.B], ['X', LETRAS.X]], '') + '</select>') +
        campo('', 'Forma de pago', '<select id="tkMedio"><option value="">Todas</option>' + opciones(Object.keys(MEDIOS_VENTA).map(function (k) { return [k, MEDIOS_VENTA[k]]; }), '') + '</select>') +
        campo('', 'Estado', '<select id="tkEstado"><option value="">Todos</option><option value="cobrada">Cobradas</option><option value="anulada">Anuladas</option></select>') +
        /* Las de verdad y las de prueba no se mezclan nunca; con el modo prueba prendido arranca en las de prueba. */
        campo('', 'Ventas', '<select id="tkPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div>' +
      /* Las ubicaciones de BlueSoft (Mauricio, 24/10: "parecido con nuestro estilo, pero con las ubicaciones iguales"): la
         lista al medio; a la derecha Nueva venta, Venta fallida, el tráfico y la conversión; abajo los totales. */
      '<div class="tkl">' +
        '<div class="tkl-lista" id="tkLista"><p class="cargando">Cargando…</p></div>' +
        '<aside class="tkl-panel" aria-label="Nueva venta, venta fallida y el tráfico">' +
          '<button type="button" class="tkl-nueva" data-ir="venta">Nueva venta</button>' +
          '<button type="button" class="tkl-fallida" id="tkFallida" title="El cliente se fue sin comprar y no dejó su WhatsApp">Venta fallida</button>' +
          '<div class="tkl-nums" id="tkNums"></div>' +
          '<button type="button" class="pos-link tkl-ver" data-ir="fallida">Ver las ventas fallidas</button>' +
        '</aside>' +
      '</div>' +
      '<div class="tkl-pie" id="tkPie"></div>';
    c.querySelectorAll('.pos-acciones [data-ir], .tkl-panel [data-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; });
    var per = periodoPos($('tkPer'), { inicial: 'hoy', guardar: 'pos_tickets_periodo', hastaHoy: true, alCambiar: cargar });
    ['tkLocal', 'tkVend', 'tkLetra', 'tkMedio', 'tkEstado', 'tkPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('tkBorrar').onclick = function () { borrarPruebas($('tkLocal').value, this, cargar); };
    $('tkFallida').onclick = function () { abrirFallida({ local: $('tkLocal').value, alGuardar: cargar }); };
    var pedido = 0;
    function deLaPrueba() { return $('tkPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('tkLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('tkBorrar').hidden = !deLaPrueba();
      llamar('pos_tickets', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('tkLocal').value || null, p_vendedor: $('tkVend').value || null,
                              p_medio: $('tkMedio').value || null, p_estado: $('tkEstado').value || null,
                              p_letra: $('tkLetra').value || null, p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('tkLista')) return;
        pintarTickets(d);
      }).catch(function (e) {
        if (!$('tkLista')) return;
        $('tkLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
        pintarTrafico(null);
        $('tkPie').innerHTML = '';
      });
    }
    /* El panel de la derecha (SQL 171): las ventas fallidas, el monto perdido, el tráfico (ventas + ventas fallidas +
       No Compra) y la conversión. Va con el período, la sucursal y el vendedor; los demás filtros no lo cambian. */
    function cifra(lbl, v) { return '<div class="tkl-num"><b>' + v + '</b><span>' + lbl + '</span></div>'; }
    function pintarTrafico(x) {
      var sin = '—';
      $('tkNums').innerHTML = cifra('Ventas fallidas', x ? miles(x.fallidas) : sin) + cifra('Monto perdido', x ? plata(cent(x.perdido)) : sin) +
        cifra('Tráfico', x ? miles(x.trafico) : sin) + cifra('Conversión', x && x.conversion != null ? porcentaje(x.conversion) : sin);
      $('tkNums').title = x ? 'Tráfico: ' + x.ventas + (x.ventas === 1 ? ' venta' : ' ventas') + ' + ' + x.fallidas + (x.fallidas === 1 ? ' venta fallida' : ' ventas fallidas') +
        ' + ' + x.no_compras + ' No Compra. Conversión: las ventas sobre el tráfico.' : '';
    }
    /* Abajo, la barra de totales de BlueSoft, con el ticket promedio y las prendas por ticket. */
    function caja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    function pintarTickets(d) {
      var t = d.totales || {}, pl = d.por_letra || {}, n = Number(t.tickets) || 0;
      var letras = ['A', 'B', 'X'].filter(function (l) { return pl[l] != null; });
      var porLetra = letras.length ? '<p class="pos-por-letra">' + letras.map(function (l) {
        return '<span>' + esc(LETRAS[l]) + ' <b>' + plata(cent(pl[l])) + '</b></span>'; }).join('') + '</p>' : '';
      pintarTrafico(d.trafico || null);
      $('tkPie').innerHTML = caja('Tickets', n) + caja('Productos', t.productos || 0) + caja('Neto', plata(cent(t.neto || 0))) +
        caja('Descuentos', plata(cent(t.descuentos || 0))) + caja('Total', plata(cent(t.total || 0)), 'fuerte') +
        caja('Ticket promedio', n ? plata(Math.round(cent(t.total) / n)) : '—') + caja('Prendas por ticket', n ? decimal(Number(t.productos) / n) : '—') +
        caja('Anulados', t.anulados || 0) + porLetra;
      var aviso = deLaPrueba() ? '<div class="pos-cartel prueba">Las ventas de <b>prueba</b>: no cuentan en ningún total de verdad. ' +
        '«Borrar las pruebas» las borra' + ($('tkLocal').value ? ' (las de esa sucursal)' : ' todas') + ', de cualquier día.</div>' : '';
      if (!d.filas || !d.filas.length) {
        $('tkLista').innerHTML = aviso + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay ventas de prueba en ese período con esos filtros.' : 'No hay ventas en ese período con esos filtros.') + '</div>';
        return;
      }
      $('tkLista').innerHTML = aviso + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th class="n">Referencia</th><th>Sucursal</th><th>Vendedor</th>' +
        '<th>Cliente</th><th>Comprobante</th><th>Forma de pago</th><th>Estado</th><th class="n">Cant.</th><th class="n">Total</th><th>ARCA</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var an = f.estado === 'anulada', clases = (an ? 'anulada ' : '') + (f.prueba ? 'prueba' : '');
          return '<tr data-ticket="' + esc(f.id) + '" tabindex="0"' + (clases.trim() ? ' class="' + clases.trim() + '"' : '') + '><td>' + esc(fechaHora(f.fecha)) + '</td><td class="n">' + esc(refCorta(f)) + '</td>' +
            '<td>' + esc(bonito(f.local)) + '</td><td>' + esc(f.vendedor) + '</td><td class="tk-cli">' + (f.socio ? '<span class="tk-club" title="Socio del Club">Club</span>' : '') +
              '<span class="tk-cli-n">' + esc(f.cliente) + '</span></td>' +
            '<td>' + esc(LETRAS[f.letra] || f.letra) + '</td>' +
            '<td>' + esc((f.medios || []).map(function (m) { return MEDIOS_VENTA[m] || m; }).join(' + ') || '—') + '</td>' +
            /* SQL 205: la anulada con una nota de crédito dice cuál. */
            '<td>' + (an && f.nc ? '<span class="pill pill-bad" title="Anulada con la nota de crédito ' + esc(refNota({ numero: f.nc, prueba: f.prueba })) + '">Anulada · ' +
                esc(refNota({ numero: f.nc, prueba: f.prueba })) + '</span>' : an ? '<span class="pill pill-bad">Anulada</span>' : '<span class="pill pill-ok">Cobrada</span>') + '</td>' +
            '<td class="n">' + f.cantidad + '</td><td class="n tachar"><b>' + plata(cent(f.total)) + '</b></td>' +
            (f.letra === 'X' || f.prueba ? '<td class="apagado" title="' + (f.prueba ? 'Es una prueba' : 'La X es un comprobante interno') + '">No va</td>'
              : '<td class="apagado" title="Por ahora la factura la hace BlueSoft">' + (f.factura ? 'Con CAE' : '—') + '</td>') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven las últimas 500. Achicá el período para ver el resto.</p>' : '');
      $('tkLista').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
        tr.onclick = function () { abrirTicket(tr.getAttribute('data-ticket'), cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      /* La venta que se acaba de guardar con "Guardar": marcada, para encontrarla de un vistazo. */
      var nueva = S.marcar && $('tkLista').querySelector('tr[data-ticket="' + S.marcar + '"]');
      S.marcar = null;
      if (nueva) { nueva.classList.add('recien'); nueva.scrollIntoView({ block: 'nearest' }); }
    }
    cargar();
  }

  /* ════════════════════════════════════════════════════════════════════
     NOTAS DE CRÉDITO (SQL 205): el listado «Notas de crédito de venta» de
     BlueSoft (sus fotos del 30/10). Cada una con el ticket que anula. Se
     hacen desde el ticket («Nota de crédito»), no desde acá.
     ════════════════════════════════════════════════════════════════════ */
  var ARCA_CORTO = { pendiente: 'Pendiente', autorizada: 'Con CAE', sin_factura: 'No va', no_va: 'No va' };
  function verNotas() {
    var c = $('cuerpo'), prueba = enPrueba(), ultima = null;
    c.innerHTML = cabeza('Notas de crédito' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Las facturas A y B anuladas. Se hacen desde el ticket: en Tickets, abrí la venta y tocá «Nota de crédito».',
        '<button type="button" class="btn btn-sec btn-chico" id="ncBajar" disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-sec btn-chico" data-ir="tickets">Ir a Tickets</button>') +
      '<div class="pos-filtros"><div id="ncPer"></div>' +
        campo('', 'Sucursal', '<select id="ncLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Comprobante', '<select id="ncLetra"><option value="">Todos</option>' + opciones([['A', LETRAS.A], ['B', LETRAS.B]], '') + '</select>') +
        /* Las de verdad y las de prueba no se mezclan nunca; con el modo prueba prendido arranca en las de prueba. */
        campo('', 'Notas', '<select id="ncPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="ncLista"><p class="cargando">Cargando…</p></div>';
    c.querySelector('[data-ir="tickets"]').onclick = function () { ir('tickets'); };
    var per = periodoPos($('ncPer'), { inicial: 'hoy', guardar: 'pos_notas_periodo', hastaHoy: true, alCambiar: cargar });
    ['ncLocal', 'ncLetra', 'ncPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('ncBajar').onclick = function () { if (ultima) bajarNotas(ultima.d, ultima.r); };
    var pedido = 0;
    function dePrueba() { return $('ncPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('ncLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('ncBajar').disabled = true;
      ultima = null;
      llamar('pos_notas_credito', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('ncLocal').value || null, p_letra: $('ncLetra').value || null, p_prueba: dePrueba() }).then(function (d) {
        if (n !== pedido || !$('ncLista')) return;
        pintarLista(d, r);
      }).catch(function (e) { if ($('ncLista')) $('ncLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarLista(d, r) {
      var t = d.totales || {};
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Notas de crédito</span><b>' + (t.notas || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Prendas</span><b>' + (t.productos || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Neto</span><b>' + plata(cent(t.neto || 0)) + '</b></div>' +
        '<div class="pos-kpi"><span>Descuentos</span><b>' + plata(cent(t.descuentos || 0)) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>Total</span><b>' + plata(cent(t.total || 0)) + '</b></div></div>' +
        (dePrueba() ? '<div class="pos-cartel prueba">Las notas de <b>prueba</b>: no cuentan para nada. Se borran con su venta, con «Borrar las pruebas» de Tickets.</div>' : '');
      if (!d.filas || !d.filas.length) {
        $('ncLista').innerHTML = kpis + '<div class="pos-cartel">' + (dePrueba() ? 'No hay notas de crédito de prueba en ese período.' : 'No hay notas de crédito en ese período.') + '</div>';
        return;
      }
      ultima = { d: d, r: r };
      $('ncBajar').disabled = false;
      $('ncLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla nc-lista"><thead><tr><th>Fecha</th><th class="n">Comprobante</th><th class="c">Letra</th><th class="n">Anula</th>' +
        '<th>Sucursal</th><th>Vendedor</th><th>Cliente</th><th>Motivo</th><th>La hizo</th><th>ARCA</th><th class="n">Cant.</th><th class="n">Total</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          return '<tr data-nota="' + esc(f.venta_id) + '" tabindex="0"' + (f.prueba ? ' class="prueba"' : '') + '><td>' + esc(fechaHora(f.fecha)) + '</td>' +
            '<td class="n"><b>' + esc(refNota(f)) + '</b></td><td class="c" title="' + esc(LETRAS[f.letra] || f.letra) + '">' + esc(f.letra) + '</td>' +
            '<td class="n" title="El ticket que anula, del ' + esc(fechaHora(f.venta_fecha)) + '">' + esc(refCorta({ serie: f.venta_serie, numero: f.venta_numero })) + '</td>' +
            '<td>' + esc(bonito(f.local)) + '</td><td>' + esc(f.vendedor) + '</td><td class="nc-cli">' + esc(f.cliente) + '</td>' +
            '<td class="nc-motivo">' + esc(f.motivo) + '</td><td>' + esc(f.hizo || '—') + '</td>' +
            '<td class="apagado" title="' + esc(arcaNota(f.arca, f.cae)) + '">' + esc(ARCA_CORTO[f.arca] || f.arca) + '</td>' +
            '<td class="n">' + f.cantidad + '</td><td class="n"><b>' + plata(cent(f.total)) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven las últimas 500. Achicá el período para ver el resto.</p>' : '');
      $('ncLista').querySelectorAll('tr[data-nota]').forEach(function (tr) {
        tr.onclick = function () { abrirNota(tr.getAttribute('data-nota'), cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }
  function bajarNotas(d, r) {
    var cab = ['Fecha', 'Comprobante', 'Letra', 'Anula el ticket', 'Fecha del ticket', 'Sucursal', 'Vendedor', 'Cliente', 'CUIT o DNI', 'Motivo', 'La hizo', 'ARCA', 'CAE',
               'Forma de pago', 'Cantidad', 'Neto', 'Descuentos', 'Total'];
    var filas = (d.filas || []).map(function (f) {
      return [fechaLarga(f.fecha), refNota(f), LETRAS[f.letra] || f.letra, refCorta({ serie: f.venta_serie, numero: f.venta_numero }), fechaLarga(f.venta_fecha),
              bonito(f.local), f.vendedor, f.cliente, f.cliente_doc || '', f.motivo, f.hizo || '', ARCA_CORTO[f.arca] || f.arca, f.cae || '',
              (f.medios || []).map(function (m) { return MEDIOS_VENTA[m] || m; }).join(' + '), f.cantidad, Number(f.neto), Number(f.descuentos), Number(f.total)];
    });
    bajarCsv('notas-de-credito-' + r.desde + '-al-' + r.hasta + '.csv', cab, filas);
  }

  /* ════════════════════════════════════════════════════════════════════
     VENTAS POR VENDEDOR (SQL 192)
     Mauricio (29/10): "seguí con otra función". Las "Ventas por Vendedor"
     de BlueSoft (sus fotos del 28/10): lo que vendió cada vendedor en el
     período, con sus promedios, y lo mismo por horario, por día, por
     semana y por mes. Cuentan las ventas cobradas, como los totales de
     Tickets. La torta de BlueSoft va como barras: con montos parecidos,
     en una torta no se ve quién vendió más.
     ════════════════════════════════════════════════════════════════════ */
  var VV_POR = [['vendedor', 'Por vendedor'], ['hora', 'Por horario'], ['dia', 'Por día'], ['semana', 'Por semana'], ['mes', 'Por mes']];
  var VV_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var VV_DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  /** El título de una columna: la hora ('09'), el día ('2026-10-29'), la semana (su lunes, recortada al período r) o el mes ('2026-10'). */
  function vvColumna(por, k, r) {
    var dos = function (n) { return (n < 10 ? '0' : '') + n; };
    var dm = function (s) { return Number(s.slice(8, 10)) + '/' + Number(s.slice(5, 7)); };
    if (por === 'hora') return dos(Number(k)) + ' a ' + dos(Number(k) + 1) + ' h';
    if (por === 'mes') return VV_MESES[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4);
    if (por === 'dia') return VV_DIAS[new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)))).getUTCDay()] + ' ' + dm(k);
    var a = r && k < r.desde ? r.desde : k, b = Interfaz.fecha.sumar(k, 6);
    if (r && b > r.hasta) b = r.hasta;
    return a === b ? dm(a) : dm(a) + ' al ' + dm(b);
  }

  function verVendedores() {
    var c = $('cuerpo'), prueba = enPrueba();
    /* En el mostrador arranca en su local; en Gestión, en todas. */
    var l = MODO === 'gestion' && puede('locales') ? null : localInicial();
    var por = leer('pos_vendedores_vista') || 'vendedor';
    if (!VV_POR.some(function (x) { return x[0] === por; })) por = 'vendedor';
    c.innerHTML = cabeza('Ventas por vendedor' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que vendió cada uno: las ventas cobradas, como los totales de Tickets (las anuladas y los cambios no cuentan).',
        '<button type="button" class="btn btn-sec btn-chico" id="vvBajar" disabled>Bajar para Excel</button>') +
      '<div class="pos-filtros"><div id="vvPer"></div>' +
        campo('', 'Sucursal', '<select id="vvLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(l ? l.id : '') + '</select>') +
        campo('', 'Vendedor', '<select id="vvVend"></select>') +
        campo('', 'Ventas', '<select id="vvPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div>' +
      /* Los botones de BlueSoft: Por vendedor, Por horario, Por día, Por semana y Por mes. */
      '<nav class="pestanas st-vistas vv-vistas" aria-label="Cómo verlas">' + VV_POR.map(function (x) {
        return '<button type="button" class="pestana" data-por="' + x[0] + '"' + (x[0] === por ? ' aria-current="page"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</nav>' +
      '<div id="vvLista"><p class="cargando">Cargando…</p></div>' +
      '<div class="tkl-pie" id="vvPie"></div>';
    /* Los vendedores de la sucursal elegida (con "Todas", los de todas); si el elegido sigue estando, queda. */
    function llenarVend() {
      var loc = $('vvLocal').value, antes = $('vvVend').value, ns = {};
      (loc ? [loc] : Object.keys(S.ini.vendedores || {})).forEach(function (k) { vendedoresDe(k).forEach(function (n) { ns[n] = 1; }); });
      var lista = Object.keys(ns).sort(function (a, b) { return a.localeCompare(b, 'es'); });
      $('vvVend').innerHTML = '<option value="">Todos</option>' + opciones(lista.map(function (n) { return [n, n]; }), lista.indexOf(antes) >= 0 ? antes : '');
    }
    llenarVend();
    var pedido = 0, ultimo = null, rango = null;
    var per = periodoPos($('vvPer'), { inicial: 'mes', guardar: 'pos_vendedores_periodo', hastaHoy: true, alCambiar: cargar });
    $('vvLocal').onchange = function () { llenarVend(); cargar(); };
    $('vvVend').onchange = cargar;
    $('vvPrueba').onchange = cargar;
    c.querySelectorAll('.vv-vistas .pestana').forEach(function (b) {
      b.onclick = function () {
        por = b.getAttribute('data-por');
        guardar('pos_vendedores_vista', por);
        c.querySelectorAll('.vv-vistas .pestana').forEach(function (x) { if (x === b) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
        if (ultimo) pintar();
      };
    });
    function deLaPrueba() { return $('vvPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('vvLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('vvBajar').disabled = true;
      llamar('pos_ventas_vendedor', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('vvLocal').value || null, p_vendedor: $('vvVend').value || null,
                                      p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('vvLista')) return;
        ultimo = d;
        rango = r;
        pintar();
      }).catch(function (e) {
        if (n !== pedido || !$('vvLista')) return;
        ultimo = null;
        $('vvLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
        $('vvPie').innerHTML = '';
      });
    }
    function p(x) { return plata(cent(x || 0)); }
    /** a ÷ b: en plata (el producto y la venta promedio) o con un decimal (las prendas por venta). */
    function prom(a, b, enPlata) { b = Number(b) || 0; return b ? (enPlata ? plata(Math.round(cent(a) / b)) : decimal(Number(a) / b)) : '—'; }
    /* Lo de cada uno, en el orden de BlueSoft: Total, Cantidad de productos, Producto promedio, Cantidad de ventas, Venta promedio, Cantidad promedio. */
    function resumen(x) {
      return '<td class="n vv-sep"><b>' + p(x.total) + '</b></td><td class="n">' + num(x.productos) + '</td><td class="n">' + prom(x.total, x.productos, true) + '</td>' +
        '<td class="n">' + num(x.ventas) + '</td><td class="n">' + prom(x.total, x.ventas, true) + '</td><td class="n">' + prom(x.productos, x.ventas) + '</td>';
    }
    var RESUMEN = '<th class="n vv-sep">Total</th><th class="n">Productos</th><th class="n">Producto promedio</th><th class="n">Ventas</th>' +
                  '<th class="n">Venta promedio</th><th class="n">Prendas por venta</th>';
    function caja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    /* Abajo, como "CANTIDAD" y "TOTAL" de BlueSoft, con lo demás de Tickets. */
    function pintarPie(t) {
      $('vvPie').innerHTML = caja('Ventas', num(t.ventas)) + caja('Productos', num(t.productos)) + caja('Neto', p(t.neto)) + caja('Descuentos', p(t.descuentos)) +
        caja('Total', p(t.total), 'fuerte') + caja('Venta promedio', prom(t.total, t.ventas, true)) + caja('Prendas por venta', prom(t.productos, t.ventas));
    }
    function pintar() {
      var d = ultimo, t = d.totales || {}, vs = d.vendedores || [];
      pintarPie(t);
      var aviso = deLaPrueba() ? '<div class="pos-cartel prueba">Las ventas de <b>prueba</b>: no cuentan en ningún total de verdad.</div>' : '';
      if (!vs.length) {
        $('vvLista').innerHTML = aviso + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay ventas de prueba' : 'No hay ventas') + ' en ese período con esos filtros.</div>';
        $('vvBajar').disabled = true;
        return;
      }
      $('vvLista').innerHTML = aviso + (por === 'vendedor' ? tablaVendedores(vs, t) : tablaCruce(vs, t));
      $('vvBajar').disabled = false;
    }
    /* Por vendedor: las columnas de BlueSoft y, a la derecha (donde estaba la torta), una barra por vendedor. */
    function tablaVendedores(vs, t) {
      var tot = Number(t.total) || 0, max = vs.reduce(function (m, x) { return Math.max(m, Number(x.total) || 0); }, 0);
      return '<div class="vv-dos"><div class="pos-marco-tabla"><table class="pos-tabla vv-tabla"><thead><tr><th>Vendedor</th><th class="n">Neto</th><th class="n">Descuentos</th>' + RESUMEN +
          '</tr></thead><tbody>' + vs.map(function (x) {
            return '<tr><td><b>' + esc(x.vendedor) + '</b></td><td class="n">' + p(x.neto) + '</td><td class="n">' + p(x.descuentos) + '</td>' + resumen(x) + '</tr>';
          }).join('') + '</tbody>' +
          (vs.length > 1 ? '<tfoot><tr><td>Total</td><td class="n">' + p(t.neto) + '</td><td class="n">' + p(t.descuentos) + '</td>' + resumen(t) + '</tr></tfoot>' : '') +
        '</table></div>' +
        '<section class="vv-barras" aria-label="El total de cada vendedor"><h3>Total por vendedor</h3><ul>' + vs.map(function (x) {
          var v = Number(x.total) || 0, pc = tot > 0 ? v / tot : 0, ancho = max > 0 ? Math.max(v / max * 100, v > 0 ? 1 : 0) : 0;
          return '<li title="' + esc(x.vendedor + ': ' + p(v) + ', el ' + porcentaje(pc) + ' del total, en ' + x.ventas + (x.ventas === 1 ? ' venta' : ' ventas')) + '">' +
            '<span class="vv-nom">' + esc(x.vendedor) + '</span><span class="vv-monto">' + p(v) + '</span>' +
            '<span class="vv-pista"><i style="width:' + ancho.toFixed(2) + '%"></i></span><span class="vv-pc">' + porcentaje(pc) + '</span></li>';
        }).join('') + '</ul></section></div>';
    }
    /* Por horario, día, semana o mes: un renglón por vendedor y una columna por hora (o día…) con ventas; al final, lo de cada uno. */
    function cruce() {
      var filas = (ultimo.por || {})[por] || [], ks = {}, m = {}, sumas = {};
      filas.forEach(function (f) {
        ks[f.k] = 1;
        (m[f.vendedor] = m[f.vendedor] || {})[f.k] = f;
        var s = sumas[f.k] = sumas[f.k] || { total: 0, ventas: 0, productos: 0 };
        s.total = Math.round((s.total + Number(f.total || 0)) * 100) / 100;
        s.ventas += Number(f.ventas) || 0;
        s.productos += Number(f.productos) || 0;
      });
      return { cols: Object.keys(ks).sort(), m: m, sumas: sumas };
    }
    function tablaCruce(vs, t) {
      var x = cruce();
      function celda(quien, k, f) {
        if (!f || !f.ventas) return '<td class="n apagado">—</td>';
        return '<td class="n" title="' + esc(quien + ' · ' + vvColumna(por, k, rango) + ': ' + f.ventas + (f.ventas === 1 ? ' venta, ' : ' ventas, ') +
          f.productos + (f.productos === 1 ? ' prenda' : ' prendas')) + '">' + p(f.total) + '</td>';
      }
      return '<div class="pos-marco-tabla"><table class="pos-tabla vv-tabla vv-cruce"><thead><tr><th class="vv-fijo">Vendedor</th>' +
          x.cols.map(function (k) { return '<th class="n">' + esc(vvColumna(por, k, rango)) + '</th>'; }).join('') + RESUMEN + '</tr></thead><tbody>' +
          vs.map(function (v) {
            return '<tr><td class="vv-fijo"><b>' + esc(v.vendedor) + '</b></td>' + x.cols.map(function (k) { return celda(v.vendedor, k, (x.m[v.vendedor] || {})[k]); }).join('') + resumen(v) + '</tr>';
          }).join('') + '</tbody>' +
          (vs.length > 1 ? '<tfoot><tr><td class="vv-fijo">Total</td>' + x.cols.map(function (k) { return celda('Todos', k, x.sumas[k]); }).join('') + resumen(t) + '</tr></tfoot>' : '') +
        '</table></div>';
    }
    /* El Excel de lo que se ve (la pestaña elegida), con la fila del total; la coma decimal, para el Excel en castellano. */
    $('vvBajar').onclick = function () {
      if (!ultimo) return;
      var lo = localDe($('vvLocal').value), vs = ultimo.vendedores || [], t = ultimo.totales || {};
      var nro = function (n) { return String(Math.round(Number(n || 0) * 100) / 100).replace('.', ','); };
      var div = function (a, b) { return Number(b) ? nro(Number(a) / Number(b)) : ''; };
      var res = function (y) { return [nro(y.total), Number(y.productos) || 0, div(y.total, y.productos), Number(y.ventas) || 0, div(y.total, y.ventas), div(y.productos, y.ventas)]; };
      var cab = ['Total', 'Productos', 'Producto promedio', 'Ventas', 'Venta promedio', 'Prendas por venta'];
      var nombre = 'Ventas por vendedor' + (por === 'vendedor' ? '' : ' ' + VV_POR.filter(function (y) { return y[0] === por; })[0][1].toLowerCase()) + ' ' +
        (lo ? nombreLocal(lo) : 'todas las sucursales') + ' ' + rango.desde + ' a ' + rango.hasta + '.csv';
      if (por === 'vendedor') {
        bajarCsv(nombre, ['Vendedor', 'Neto', 'Descuentos'].concat(cab), vs.concat([Object.assign({ vendedor: 'Total' }, t)]).map(function (y) {
          return [y.vendedor, nro(y.neto), nro(y.descuentos)].concat(res(y));
        }));
        return;
      }
      var x = cruce(), celdaX = function (f) { return f && f.ventas ? nro(f.total) : ''; };
      bajarCsv(nombre, ['Vendedor'].concat(x.cols.map(function (k) { return vvColumna(por, k, rango); }), cab),
        vs.map(function (y) { return [y.vendedor].concat(x.cols.map(function (k) { return celdaX((x.m[y.vendedor] || {})[k]); }), res(y)); })
          .concat([['Total'].concat(x.cols.map(function (k) { return celdaX(x.sumas[k]); }), res(t))]));
    };
    cargar();
  }

  /* ════════════════════════════════════════════════════════════════════
     LAS VENTAS POR PRODUCTOS (SQL 196)
     Las "Ventas por Productos" de BlueSoft, el "resumen de ventas" de los
     locales (Mauricio, 29/10: "cuando hay producto testigo, vamos a resumen
     de ventas, buscamos un producto y ahí me dice las ventas totales de ese
     producto, qué día fue, de qué ticket fue, cuántas ventas, qué
     colores"). La lista, de más a menos vendido, con el Top 10 y «Mostrar
     talle y color»; al tocar un producto, sus ventas una por una y cuánto
     se vendió de cada talle y color.
     ════════════════════════════════════════════════════════════════════ */
  function sin196(e) {
    var m = mensajeDe(e);
    return /SQL 196/.test(m) ? 'Las ventas por productos todavía no están en la base: falta correr el SQL 196.' : m;
  }
  /** El nombre del producto: el del catálogo o, si no está (o se escribió a mano), el del ticket. */
  function nombreVendido(x) { var p = x.codigo && PROD[x.codigo]; return p ? p[1] : x.descripcion || ''; }
  function rubroVendido(x) { var p = x.codigo && PROD[x.codigo]; return (p && p[2]) || ''; }
  function colorVendido(x) { return x.color ? nombreColor(x.color, x.codigo) : ''; }

  /* volver: desde «‹ Ventas por productos», con los filtros de antes; desde el menú, de cero. */
  function verPorProducto(volver) {
    var c = $('cuerpo'), prueba = enPrueba();
    S.vpVer = null;
    if (!volver) S.vpFiltro = null;
    var F = S.vpFiltro || {};
    /* En el mostrador arranca en su local; en Gestión, en todas (como Ventas por vendedor). */
    var l = MODO === 'gestion' && puede('locales') ? null : localInicial();
    var local = F.local !== undefined ? F.local : l ? l.id : '';
    c.innerHTML = cabeza('Ventas por productos' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Cuánto se vendió de cada producto (las ventas cobradas, como Tickets). Tocá uno para ver sus ventas una por una.',
        /* El «Mostrar Talle/Color» de BlueSoft: un renglón por talle y color. */
        '<label class="pos-check vp-tc"><input type="checkbox" id="vpTc"' + (leer('pos_productos_tc') === '1' ? ' checked' : '') + '> Mostrar talle y color</label>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vpBajar" disabled>Bajar para Excel</button>') +
      '<div class="pos-filtros"><div id="vpPer"></div>' +
        campo('', 'Sucursal', '<select id="vpLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(local) + '</select>') +
        campo('vp-buscar', 'Producto', '<input type="search" id="vpBuscar" autocomplete="off" spellcheck="false" placeholder="Código, nombre o etiqueta" title="El código o el nombre; o escaneá la etiqueta" value="' + esc(F.buscar || '') + '">') +
        campo('', 'Rubro', '<select id="vpRubro"><option value="">Todos</option>' + opciones(RUBROS.map(function (r) { return [r, r]; }), F.rubro || '') + '</select>') +
        campo('', 'Vendedor', '<select id="vpVend"></select>') +
        campo('', 'Ventas', '<select id="vpPrueba"><option value="">De verdad</option><option value="1"' + ((F.prueba !== undefined ? F.prueba : prueba) ? ' selected' : '') + '>De prueba</option></select>') +
      '</div>' +
      '<div id="vpLista"><p class="cargando">Cargando…</p></div>' +
      '<div class="tkl-pie" id="vpPie"></div>';
    function llenarVend() {
      var loc = $('vpLocal').value, antes = $('vpVend').value || F.vendedor || '', ns = {};
      (loc ? [loc] : Object.keys(S.ini.vendedores || {})).forEach(function (k) { vendedoresDe(k).forEach(function (n) { ns[n] = 1; }); });
      var lista = Object.keys(ns).sort(function (a, b) { return a.localeCompare(b, 'es'); });
      $('vpVend').innerHTML = '<option value="">Todos</option>' + opciones(lista.map(function (n) { return [n, n]; }), lista.indexOf(antes) >= 0 ? antes : '');
    }
    llenarVend();
    var pedido = 0, ultimo = null, rango = null, tBus = null;
    var per = periodoPos($('vpPer'), { inicial: 'mes', guardar: 'pos_productos_periodo', hastaHoy: true, alCambiar: cargar });
    $('vpLocal').onchange = function () { llenarVend(); cargar(); };
    $('vpVend').onchange = cargar;
    $('vpPrueba').onchange = cargar;
    $('vpRubro').onchange = function () { guardarFiltro(); if (ultimo) pintar(); };
    $('vpTc').onchange = function () { guardar('pos_productos_tc', this.checked ? '1' : ''); if (ultimo) pintar(); };
    /* Mientras escriben, busca solo; con la pistola (que termina en Enter), enseguida. */
    $('vpBuscar').oninput = function () { clearTimeout(tBus); tBus = setTimeout(cargar, 400); };
    $('vpBuscar').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tBus); cargar(); } };
    function deLaPrueba() { return $('vpPrueba').value === '1'; }
    /* De la etiqueta escaneada ("RM10299 L BL") se busca la prenda: las ventas de todos sus talles y colores. */
    function buscado() { var t = $('vpBuscar').value.trim(), s = leerEscaneo(t); return s ? s.codigo : t; }
    function guardarFiltro() {
      S.vpFiltro = { local: $('vpLocal').value, vendedor: $('vpVend').value, buscar: $('vpBuscar').value, rubro: $('vpRubro').value, prueba: deLaPrueba() };
    }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      clearTimeout(tBus);
      guardarFiltro();
      $('vpLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('vpBajar').disabled = true;
      llamar('pos_ventas_productos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('vpLocal').value || null, p_vendedor: $('vpVend').value || null,
                                       p_buscar: buscado() || null, p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('vpLista')) return;
        ultimo = d;
        rango = r;
        pintar();
      }).catch(function (e) {
        if (n !== pedido || !$('vpLista')) return;
        ultimo = null;
        $('vpLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin196(e)) + '</div>';
        $('vpPie').innerHTML = '';
      });
    }
    function p(x) { return plata(cent(x || 0)); }
    function prom(t, n) { n = Number(n) || 0; return n ? plata(Math.round(cent(t) / n)) : '—'; }
    function suma(xs, k) { return xs.reduce(function (s, x) { return s + Number(x[k] || 0); }, 0); }
    /* El rubro sale del catálogo: se filtra acá, sin volver a pedir. */
    function filtrar(xs) { var r = $('vpRubro').value; return r ? xs.filter(function (x) { return rubroVendido(x) === r; }) : xs; }
    function caja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    /* Abajo, como BlueSoft: TOTAL, CANTIDAD, PRECIO PROMEDIO y PRODUCTOS (y las ventas, menos con un rubro elegido). */
    function pintarPie(t) {
      $('vpPie').innerHTML = caja('Total', p(t.total), 'fuerte') + caja('Cantidad', num(t.cantidad)) + caja('Precio promedio', prom(t.total, t.cantidad)) +
        caja('Productos', num(t.productos)) + (t.ventas != null ? caja('Ventas', num(t.ventas)) : '');
    }
    function pintar() {
      var d = ultimo, tc = $('vpTc').checked, ps = filtrar(d.productos || []), vs = filtrar(d.variantes || []);
      var t = $('vpRubro').value ? { total: suma(ps, 'total'), cantidad: suma(ps, 'cantidad'), productos: ps.length, ventas: null } : d.totales || {};
      pintarPie(t);
      var aviso = deLaPrueba() ? '<div class="pos-cartel prueba">Las ventas de <b>prueba</b>: no cuentan en ningún total de verdad.</div>' : '';
      if (!ps.length) {
        $('vpLista').innerHTML = aviso + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay ventas de prueba' : 'No se vendió nada') + ' en ese período con esos filtros.</div>';
        $('vpBajar').disabled = true;
        return;
      }
      var filas = tc ? vs : ps;
      $('vpLista').innerHTML = aviso + '<div class="vv-dos"><div class="pos-marco-tabla"><table class="pos-tabla vv-tabla vp-tabla"><thead><tr><th>Código</th><th>Nombre</th>' +
            (tc ? '<th>Talle</th><th>Color</th>' : '<th>Rubro</th>') + '<th class="n">Cantidad</th><th class="n">Total</th><th class="n">Promedio</th>' + (tc ? '' : '<th class="n">Ventas</th>') +
          '</tr></thead><tbody>' + filas.map(function (x, i) {
            return '<tr data-vp="' + i + '" tabindex="0" title="Ver sus ventas una por una"><td>' + esc(x.codigo || '—') + '</td><td><b>' + esc(nombreVendido(x)) + '</b></td>' +
              (tc ? '<td>' + esc(x.talle || '—') + '</td><td>' + esc(colorVendido(x) || '—') + '</td>' : '<td>' + esc(rubroVendido(x) || '—') + '</td>') +
              '<td class="n"><b>' + num(x.cantidad) + '</b></td><td class="n">' + p(x.total) + '</td><td class="n">' + prom(x.total, x.cantidad) + '</td>' +
              (tc ? '' : '<td class="n">' + num(x.ventas) + '</td>') + '</tr>';
          }).join('') + '</tbody></table></div>' + top10(ps) + '</div>' +
        (d.mas ? '<p class="pos-mas">Son muchos: se ven los más vendidos. Achicá el período, elegí la sucursal o buscá el producto.</p>' : '');
      $('vpLista').querySelectorAll('tr[data-vp]').forEach(function (tr) {
        var x = filas[Number(tr.getAttribute('data-vp'))];
        tr.onclick = function () { S.vpVer = { clave: x.clave, codigo: x.codigo, descripcion: x.descripcion }; verProdVendido(); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      $('vpBajar').disabled = false;
    }
    /* A la derecha, el "Top 10 (cantidad)" de BlueSoft, con barras como las de Ventas por vendedor. */
    function top10(ps) {
      var top = ps.slice(0, 10), max = top.reduce(function (m, x) { return Math.max(m, x.cantidad); }, 0);
      return '<section class="vv-barras" aria-label="Los diez más vendidos"><h3>Top 10 (cantidad)</h3><ul>' + top.map(function (x) {
        var ancho = max > 0 ? Math.max(x.cantidad / max * 100, 1) : 0;
        return '<li title="' + esc(nombreVendido(x) + ': ' + x.cantidad + (x.cantidad === 1 ? ' prenda, ' : ' prendas, ') + p(x.total)) + '">' +
          '<span class="vv-nom">' + esc(nombreVendido(x)) + '</span><span class="vv-monto">' + num(x.cantidad) + '</span>' +
          '<span class="vv-pista"><i style="width:' + ancho.toFixed(2) + '%"></i></span><span class="vv-pc">' + p(x.total) + '</span></li>';
      }).join('') + '</ul></section>';
    }
    /* El Excel de lo que se ve (con talle y color, si está prendido); la coma decimal, para el Excel en castellano. */
    $('vpBajar').onclick = function () {
      if (!ultimo) return;
      var tc = $('vpTc').checked, xs = filtrar(tc ? ultimo.variantes || [] : ultimo.productos || []), lo = localDe($('vpLocal').value);
      var nro = function (n) { return String(Math.round(Number(n || 0) * 100) / 100).replace('.', ','); };
      bajarCsv('Ventas por productos ' + (lo ? nombreLocal(lo) : 'todas las sucursales') + ' ' + rango.desde + ' a ' + rango.hasta + '.csv',
        ['Código', 'Nombre', 'Rubro'].concat(tc ? ['Talle', 'Color'] : [], ['Cantidad', 'Total', 'Promedio'], tc ? [] : ['Ventas']),
        xs.map(function (x) {
          return [x.codigo || '', nombreVendido(x), rubroVendido(x)].concat(tc ? [x.talle || '', colorVendido(x)] : [],
            [x.cantidad, nro(x.total), x.cantidad ? nro(Number(x.total) / x.cantidad) : ''], tc ? [] : [x.ventas]);
        }));
    };
    cargar();
  }

  /* Un producto: sus ventas una por una (la más nueva primero), cuánto se vendió de cada talle y color y en cada
     sucursal. El período es el mismo de la lista; el vendedor y "de prueba", los que estaban elegidos. */
  function verProdVendido() {
    var c = $('cuerpo'), sel = S.vpVer, F = S.vpFiltro || {}, pedido = 0, ult = null;
    c.innerHTML = cabeza(esc(nombreVendido(sel)) + (sel.codigo ? '<span class="vd-cod">' + esc(sel.codigo) + '</span>' : ''),
        'Sus ventas una por una, de la más nueva a la más vieja' + (F.vendedor ? ', las de ' + esc(F.vendedor) : '') + (F.prueba ? ' (las de prueba)' : '') +
          '. Tocá una para ver el ticket.',
        '<button type="button" class="btn btn-sec btn-chico" id="vdVolver">‹ Ventas por productos</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vdExcel" disabled>Bajar para Excel</button>') +
      '<div class="pos-filtros"><div id="vdPer"></div>' +
        campo('', 'Sucursal', '<select id="vdLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(F.local || '') + '</select>') +
      '</div><div id="vdLista"><p class="cargando">Cargando…</p></div>';
    $('vdVolver').onclick = function () { verPorProducto(true); };
    var per = periodoPos($('vdPer'), { inicial: 'mes', guardar: 'pos_productos_periodo', hastaHoy: true, alCambiar: cargar });
    $('vdLocal').onchange = function () { F.local = this.value; S.vpFiltro = F; cargar(); };
    $('vdExcel').onclick = function () { if (ult) bajarProdVendido(sel, ult.d, ult.r); };
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('vdLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('vdExcel').disabled = true;
      llamar('pos_ventas_de_producto', { p_clave: sel.clave, p_desde: r.desde, p_hasta: r.hasta, p_local: $('vdLocal').value || null,
                                         p_vendedor: F.vendedor || null, p_prueba: !!F.prueba }).then(function (d) {
        if (n !== pedido || !$('vdLista')) return;
        ult = { d: d, r: r };
        pintar(d);
      }).catch(function (e) { if (n === pedido && $('vdLista')) $('vdLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin196(e)) + '</div>'; });
    }
    function p(x) { return plata(cent(x || 0)); }
    function kpi(lbl, v, cls) { return '<div class="pos-kpi' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    function pintar(d) {
      var t = d.totales || {}, rs = d.renglones || [];
      $('vdLista').innerHTML = '<div class="pos-totales">' + kpi('Vendidas', num(t.cantidad), 'fuerte') + kpi('Total', p(t.total)) + kpi('Ventas', num(t.ventas)) +
          kpi('Precio promedio', t.cantidad ? plata(Math.round(cent(t.total) / t.cantidad)) : '—') + kpi('Última venta', t.ultima ? esc(fechaHora(t.ultima)) : '—') + '</div>' +
        (!rs.length ? '<div class="pos-cartel">No se vendió en ese período' + ($('vdLocal').value ? ' en esa sucursal' : '') + '.</div>' :
          '<div class="vd-dos">' + matriz(d.variantes || []) + porSucursal(d.sucursales || []) + '</div>' +
          '<div class="pos-marco-tabla"><table class="pos-tabla vd-tabla"><thead><tr><th>Fecha</th><th>Sucursal</th><th class="n">Ticket</th><th>Vendedor</th><th>Cliente</th>' +
            '<th>Talle</th><th>Color</th><th class="n">Cant.</th><th class="n">Importe</th></tr></thead><tbody>' +
          rs.map(function (r, i) {
            return '<tr data-vd="' + i + '" tabindex="0" title="Ver el ticket"><td>' + esc(fechaHora(r.fecha)) + '</td><td>' + esc(bonito(r.local)) + '</td>' +
              '<td class="n"><b>' + esc(refCorta(r)) + '</b></td><td>' + esc(r.vendedor) + '</td><td>' + esc(r.cliente || '—') + '</td>' +
              '<td>' + esc(r.talle || '—') + '</td><td>' + esc(r.color ? nombreColor(r.color, sel.codigo) : '—') + '</td>' +
              '<td class="n">' + num(r.cantidad) + '</td><td class="n">' + p(r.total) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          (d.mas ? '<p class="pos-mas">Se ven las últimas 2000. Achicá el período para ver el resto.</p>' : ''));
      $('vdExcel').disabled = !rs.length;
      $('vdLista').querySelectorAll('tr[data-vd]').forEach(function (tr) {
        var r = rs[Number(tr.getAttribute('data-vd'))];
        tr.onclick = function () { abrirTicket(r.venta_id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    /* Un renglón por color y una columna por talle (en el orden del catálogo): lo que se vendió de cada uno. */
    function matriz(vs) {
      var orden = tallesDe(PROD[sel.codigo]), ts = {}, porColor = {}, m = {}, porTalle = {};
      vs.forEach(function (x) {
        var tl = x.talle || '', co = x.color || '';
        ts[tl] = 1;
        porColor[co] = (porColor[co] || 0) + x.cantidad;
        porTalle[tl] = (porTalle[tl] || 0) + x.cantidad;
        (m[co] = m[co] || {})[tl] = (m[co][tl] || 0) + x.cantidad;
      });
      var lugar = function (t) { var i = orden.indexOf(t); return i < 0 ? 999 : i; };
      var cols = Object.keys(ts).sort(function (a, b) { return lugar(a) - lugar(b) || a.localeCompare(b, 'es'); });
      var filas = Object.keys(porColor).sort(function (a, b) { return porColor[b] - porColor[a] || a.localeCompare(b, 'es'); });
      var celda = function (n) { return n ? '<td class="n">' + num(n) + '</td>' : '<td class="n apagado">—</td>'; };
      return '<section class="vd-bloque"><h3>Por talle y color</h3><div class="pos-marco-tabla"><table class="pos-tabla vv-tabla vd-matriz"><thead><tr><th>Color</th>' +
          cols.map(function (t) { return '<th class="n">' + esc(t || 'Sin talle') + '</th>'; }).join('') + '<th class="n vv-sep">Total</th></tr></thead><tbody>' +
          filas.map(function (co) {
            return '<tr><td><b>' + esc(co ? nombreColor(co, sel.codigo) : 'Sin color') + '</b></td>' + cols.map(function (t) { return celda(m[co][t]); }).join('') +
              '<td class="n vv-sep"><b>' + num(porColor[co]) + '</b></td></tr>';
          }).join('') + '</tbody>' +
          (filas.length > 1 ? '<tfoot><tr><td>Total</td>' + cols.map(function (t) { return '<td class="n">' + num(porTalle[t]) + '</td>'; }).join('') +
            '<td class="n vv-sep">' + num(vs.reduce(function (s, x) { return s + x.cantidad; }, 0)) + '</td></tr></tfoot>' : '') +
        '</table></div></section>';
    }
    function porSucursal(ss) {
      if (ss.length < 2) return '';
      return '<section class="vd-bloque"><h3>Por sucursal</h3><div class="pos-marco-tabla"><table class="pos-tabla vv-tabla"><thead><tr><th>Sucursal</th>' +
          '<th class="n">Cantidad</th><th class="n">Total</th></tr></thead><tbody>' + ss.map(function (s) {
            return '<tr><td><b>' + esc(bonito(s.local)) + '</b></td><td class="n">' + num(s.cantidad) + '</td><td class="n">' + p(s.total) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
    }
    cargar();
  }

  function bajarProdVendido(sel, d, r) {
    var nro = function (n) { return String(Math.round(Number(n || 0) * 100) / 100).replace('.', ','); };
    bajarCsv('Ventas de ' + nombreVendido(sel) + (sel.codigo ? ' ' + sel.codigo : '') + ' ' + r.desde + ' a ' + r.hasta + '.csv',
      ['Fecha', 'Sucursal', 'Ticket', 'Vendedor', 'Cliente', 'Talle', 'Color', 'Cantidad', 'Precio', 'Importe'],
      (d.renglones || []).map(function (x) {
        return [fechaLarga(x.fecha), bonito(x.local), refCorta(x), x.vendedor, x.cliente || '', x.talle || '', x.color ? nombreColor(x.color, sel.codigo) : '',
                x.cantidad, nro(x.precio), nro(x.total)];
      }));
  }

  /* ════════════════════════════════════════════════════════════════════
     LOS CLIENTES (SQL 197)
     La «Administración de clientes» de BlueSoft (Mauricio, 29/10: "para
     poder crear clientes y también para ver los clientes"), en UNA SOLA
     LISTA con los socios del Club (lo eligió él): el socio que necesita
     factura tiene su ficha atada a él. La ficha, con las 4 pestañas de una
     persona (también lo eligió él): Datos generales, Direcciones, Teléfonos
     y Datos persona. La lupita de la venta busca clientes y socios juntos
     y tiene «Crear cliente». El mostrador busca; la lista entera es de la
     oficina.
     ════════════════════════════════════════════════════════════════════ */
  /** Hoy, en Argentina (la fecha de la base). */
  function hoyCli() { return (S.ini && S.ini.hoy) || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
  /* El día de un momento guardado (creado, modificado), en la hora de Argentina: la base lo da en UTC. */
  function diaDe(ts) {
    try { return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts)); }
    catch (e) { return fechaCorta(ts); }
  }
  var DOC_TIPOS = [['dni', 'DNI'], ['cuit', 'CUIT'], ['pasaporte', 'Pasaporte'], ['libreta', 'Libreta cívica'], ['otro', 'Otro']];
  function sin197(e) {
    var m = mensajeDe(e);
    return /SQL 197/.test(m) ? 'Los clientes todavía no están en la base: falta correr el SQL 197.' : m;
  }
  /** "DNI 30.111.222", "CUIT 20-30111222-0", "Pasaporte AB123456". */
  function docTexto(x) {
    if (!x || !x.doc) return '';
    var t = (DOC_TIPOS.filter(function (d) { return d[0] === x.doc_tipo; })[0] || ['', 'Documento'])[1];
    return t + ' ' + (x.doc_tipo === 'cuit' ? cuit(x.doc) : x.doc_tipo === 'dni' || x.doc_tipo === 'libreta' ? miles(x.doc) : x.doc);
  }
  /** El dígito verificador del CUIT, la misma cuenta que la base (pos_cuit_ok): avisa antes de mandar. */
  function cuitOk(d) {
    if (!/^\d{11}$/.test(d)) return false;
    var w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2], s = 0;
    for (var i = 0; i < 10; i++) s += Number(d[i]) * w[i];
    var r = 11 - s % 11;
    return (r === 11 ? 0 : r === 10 ? 9 : r) === Number(d[10]);
  }
  /** Lo del socio en la ficha: su nivel, sus puntos y su WhatsApp (que se cambia en el Club). La oficina lo ve entero. */
  function socioDeFicha(so, oficina) {
    return '<div class="cli-socio">' + marcaClub(so) + '<span><b>Socio del Club</b> · ' + miles(Number(so.puntos) || 0) + ' puntos · ' +
      esc(so.whatsapp ? (oficina ? 'WhatsApp ' + so.whatsapp : telCorto(so.whatsapp)) : 'Sin WhatsApp') + '</span>' +
      '<small>El nombre del Club, el WhatsApp y los puntos se cambian en el Club.</small></div>';
  }

  /* La lista: buscar, Mostrar (activos, inactivos, todos) y Club (socios o no). Tocar uno abre su ficha. */
  function verClientes(volver) {
    var c = $('cuerpo');
    S.cliVer = null;
    if (!volver) S.cliFiltro = null;
    var F = S.cliFiltro || {};
    c.innerHTML = cabeza('Clientes', 'Los clientes y los socios del Club, en una sola lista. Tocá uno para ver o cambiar su ficha.',
        '<button type="button" class="btn btn-sec btn-chico" id="clBajar" hidden disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="clNuevo">Nuevo cliente</button>') +
      '<div class="pos-filtros">' +
        campo('cl-buscar', 'Buscar', '<input type="search" id="clBuscar" autocomplete="off" spellcheck="false" placeholder="Nombre, DNI o CUIT, teléfono o mail" ' +
              'title="El nombre, el DNI o el CUIT, el teléfono, el mail, el Nº de cliente o la tarjeta del Club" value="' + esc(F.buscar || '') + '">') +
        campo('', 'Mostrar', '<select id="clMostrar">' + opciones([['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']], F.mostrar || 'activos') + '</select>') +
        campo('', 'Club', '<select id="clClub">' + opciones([['todos', 'Todos'], ['socios', 'Socios del Club'], ['sin', 'Sin el Club']], F.club || 'todos') + '</select>') +
      '</div>' +
      '<div id="clLista"><p class="cargando">Cargando…</p></div>' +
      '<div class="tkl-pie" id="clPie"></div>';
    var pedido = 0, ultimo = null, tBus = null, miLista = $('clLista');
    $('clBuscar').oninput = function () { clearTimeout(tBus); tBus = setTimeout(cargar, 400); };
    $('clBuscar').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tBus); cargar(); } };
    $('clMostrar').onchange = cargar;
    $('clClub').onchange = cargar;
    $('clNuevo').onclick = function () { S.cliVer = { nuevo: $('clBuscar').value.trim() }; verCliente(); };
    function guardarFiltro() { S.cliFiltro = { buscar: $('clBuscar').value, mostrar: $('clMostrar').value, club: $('clClub').value }; }
    function cargar() {
      clearTimeout(tBus);
      if (!miLista.isConnected) return;
      var n = ++pedido;
      guardarFiltro();
      $('clLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('clBajar').disabled = true;
      llamar('pos_clientes_lista', { p_buscar: $('clBuscar').value.trim() || null, p_mostrar: $('clMostrar').value, p_club: $('clClub').value }).then(function (d) {
        if (n !== pedido || !miLista.isConnected) return;
        ultimo = d;
        pintar();
      }).catch(function (e) {
        if (n !== pedido || !miLista.isConnected) return;
        ultimo = null;
        $('clLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin197(e)) + '</div>';
        $('clPie').innerHTML = '';
      });
    }
    function caja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    function tel(x, ofi) { return x.telefono || (x.whatsapp ? (ofi ? x.whatsapp : telCorto(x.whatsapp)) : ''); }
    function pintar() {
      var d = ultimo, xs = d.clientes || [], q = $('clBuscar').value.trim();
      $('clBajar').hidden = !d.oficina;
      if (d.corto) {
        $('clLista').innerHTML = '<div class="pos-cartel">' + esc(d.porque) + ' Si no está, tocá «Nuevo cliente».</div>';
        $('clPie').innerHTML = '';
        return;
      }
      $('clPie').innerHTML = caja('Clientes', num(d.total), 'fuerte') + caja('Socios del Club', num(xs.filter(function (x) { return x.socio_id; }).length) + (d.mas ? '+' : ''));
      if (!xs.length) {
        $('clLista').innerHTML = '<div class="pos-cartel">No hay ningún cliente ' + (q ? 'con «' + esc(q) + '»' : 'con esos filtros') + '. Para cargarlo, tocá «Nuevo cliente».</div>';
        return;
      }
      $('clLista').innerHTML = '<div class="pos-marco-tabla"><table class="pos-tabla cl-tabla"><thead><tr><th class="n">Nº</th><th>Nombre</th><th>Club</th><th>Documento</th>' +
          '<th>Condición de IVA</th><th>Teléfono</th><th>Mail</th><th>Localidad</th></tr></thead><tbody>' + xs.map(function (x, i) {
          return '<tr data-cl="' + i + '" tabindex="0" title="Ver su ficha"' + (x.activo ? '' : ' class="cl-inactivo"') + '><td class="n">' + (x.numero || '—') + '</td>' +
            '<td><b>' + esc(x.nombre) + '</b>' + (x.activo ? '' : ' <span class="pos-tag">Inactivo</span>') + '</td>' +
            '<td>' + (x.socio_id ? marcaClub(x) : '') + '</td>' +
            '<td>' + esc(docTexto(x) || '—') + '</td><td>' + esc(x.condicion ? CONDICION[x.condicion] || '' : '—') + '</td>' +
            '<td>' + esc(tel(x, d.oficina) || '—') + '</td><td class="cl-mail"' + (x.mail ? ' title="' + esc(x.mail) + '"' : '') + '>' + esc(x.mail || '—') + '</td>' +
            '<td>' + esc(x.localidad || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Son muchos: se ven los primeros ' + num(xs.length) + '. Buscá para encontrar los demás.</p>' : '');
      $('clLista').querySelectorAll('tr[data-cl]').forEach(function (tr) {
        var x = xs[Number(tr.getAttribute('data-cl'))];
        tr.onclick = function () { S.cliVer = x.id ? { id: x.id } : { socio: x.socio_id }; verCliente(); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      $('clBajar').disabled = false;
    }
    /* El Excel de lo que se ve (sólo la oficina, que ve la lista entera). */
    $('clBajar').onclick = function () {
      if (!ultimo || !ultimo.oficina) return;
      bajarCsv('Clientes ' + hoyCli() + '.csv',
        ['Nº', 'Nombre', 'Tipo de documento', 'Documento', 'Condición de IVA', 'Teléfono', 'WhatsApp del Club', 'Mail', 'Localidad', 'Socio del Club', 'Nivel', 'Puntos', 'Activo'],
        (ultimo.clientes || []).map(function (x) {
          var t = (DOC_TIPOS.filter(function (d) { return d[0] === x.doc_tipo; })[0] || ['', ''])[1];
          return [x.numero || '', x.nombre, x.doc ? t : '', x.doc || '', x.condicion ? CONDICION[x.condicion] || '' : '', x.telefono || '', x.whatsapp || '',
                  x.mail || '', x.localidad || '', x.socio_id ? 'Sí' : 'No', x.nivel || '', x.socio_id ? Number(x.puntos) || 0 : '', x.activo ? 'Sí' : 'No'];
        }));
    };
    cargar();
    setTimeout(function () { var b = $('clBuscar'); if (b) b.focus(); }, 0);
  }

  /* La ficha: un cliente ({id}), un socio sin ficha ({socio}: lo del Club para completar) o uno nuevo ({nuevo: lo buscado}). */
  function verCliente() {
    var sel = S.cliVer || {}, c = $('cuerpo');
    c.innerHTML = cabeza(sel.id || sel.socio ? 'Cliente' : 'Nuevo cliente', sel.id || sel.socio ? 'Sus datos y los de la factura.' : 'Con los datos para la factura, si los tiene.',
        '<button type="button" class="btn btn-sec btn-chico" id="clVolver">‹ Clientes</button>') +
      '<div id="clFicha"><p class="cargando">Cargando…</p></div>';
    $('clVolver').onclick = function () { verClientes(true); };
    (sel.id || sel.socio ? llamar('pos_cliente', { p_id: sel.id || null, p_socio: sel.socio || null }) : Promise.resolve(clienteDeTexto(sel.nuevo))).then(function (d) {
      if (!$('clFicha')) return;
      var h = c.querySelector('.pos-cab h2');
      if (h && d.id) h.textContent = d.nombre;
      formCliente($('clFicha'), d, {
        oficina: MODO === 'gestion',
        alGuardar: function (x, otro) {
          avisar('ok', (d.id ? 'Listo: se guardó la ficha de ' : 'Listo: ') + x.nombre + (d.id ? '.' : ' quedó cargado (Nº ' + x.numero + ').'));
          S.cliVer = otro ? { nuevo: '' } : { id: x.id };
          verCliente();
        }
      });
    }).catch(function (e) { if ($('clFicha')) $('clFicha').innerHTML = '<div class="pos-cartel mal">' + esc(sin197(e)) + '</div>'; });
  }
  /** Lo que se escribió en el buscador pasa al cliente nuevo: el documento, el teléfono, el mail o el nombre. */
  function clienteDeTexto(t) {
    t = String(t || '').trim();
    var d = { doc_tipo: 'dni', condicion: 'consumidor_final', direcciones: [], telefonos: [], activo: true }, dig = t.replace(/\D/g, '');
    if (/^[\d\s.()+\/-]+$/.test(t) && dig) {
      if (dig.length === 11 && cuitOk(dig)) { d.doc_tipo = 'cuit'; d.doc = dig; }
      else if (dig.length >= 7 && dig.length <= 8) d.doc = dig;
      else if (dig.length >= 8) d.telefonos = [{ numero: t, predeterminado: true }];
    } else if (/@/.test(t)) d.mail = t.toLowerCase();
    else if (t) d.nombre = t;
    return d;
  }

  /* El formulario de la ficha (en Clientes y en la ventana de la venta): el nombre arriba y las 4 pestañas.
     op.alGuardar(cliente, otro) — otro: «Guardar y nuevo»; op.ventana: en la venta (con «Cancelar»); op.socio: la tarjeta
     del socio de la venta, para atarlo al crearlo; op.local: dónde se crea. */
  function formCliente(cont, d, op) {
    op = op || {};
    var dirs = (d.direcciones || []).map(function (x) { return Object.assign({}, x); });
    var tels = (d.telefonos || []).map(function (x) { return Object.assign({}, x); });
    var pest = 'generales', hoy = hoyCli();
    var info = d.id ? '<p class="cli-info">Cliente Nº <b>' + d.numero + '</b>' +
        (d.creado ? ' · lo cargó ' + esc(d.creado_nombre || 'la oficina') + ' el ' + diaDe(d.creado) + (d.local ? ' en ' + esc(bonito(d.local)) : '') : '') +
        (d.modificado ? ' · lo cambió ' + esc(d.modificado_nombre || 'la oficina') + ' el ' + diaDe(d.modificado) : '') + '</p>' : '';
    cont.innerHTML = info + (d.socio ? socioDeFicha(d.socio, op.oficina) : '') +
      '<div class="pos-campos cli-nombre">' + campo('ancho', 'Nombre o razón social', '<input type="text" id="cfNombre" maxlength="120" autocomplete="off" value="' + esc(d.nombre || '') + '">') + '</div>' +
      '<nav class="pestanas cli-pestanas" aria-label="La ficha">' + [['generales', 'Datos generales'], ['direcciones', 'Direcciones'], ['telefonos', 'Teléfonos'], ['persona', 'Datos persona']].map(function (p) {
        return '<button type="button" class="pestana" data-pest="' + p[0] + '">' + p[1] + '<span class="cli-cuantos" data-cuantos="' + p[0] + '"></span></button>';
      }).join('') + '</nav>' +
      '<div class="cli-panel" data-panel="generales"><div class="pos-campos">' +
        campo('', 'Tipo de documento', '<select id="cfTipo">' + opciones(DOC_TIPOS, d.doc_tipo || 'dni') + '</select>') +
        campo('', 'Número', '<input type="text" id="cfDoc" maxlength="20" autocomplete="off" value="' + esc(d.doc ? (d.doc_tipo === 'cuit' ? cuit(d.doc) : d.doc) : '') + '">') +
        campo('', 'Condición frente al IVA', '<select id="cfCond">' + opciones(Object.keys(CONDICION).map(function (k) { return [k, CONDICION[k]]; }), d.condicion || 'consumidor_final') + '</select>') +
        campo('', 'Mail', '<input type="email" id="cfMail" maxlength="120" autocomplete="off" value="' + esc(d.mail || '') + '">') +
        campo('ancho', 'Observaciones', '<textarea id="cfObs" rows="3" maxlength="1000">' + esc(d.observaciones || '') + '</textarea>') +
        (d.id ? '<label class="pos-check ancho"><input type="checkbox" id="cfActivo"' + (d.activo === false ? '' : ' checked') + '> Activo (si no, no aparece en la venta)</label>' : '') +
      '</div><p class="cli-ayuda" id="cfAyudaDoc"></p></div>' +
      '<div class="cli-panel" data-panel="direcciones" hidden><div id="cfDirs"></div><p><button type="button" class="pos-link" id="cfDirMas">+ Agregar dirección</button></p></div>' +
      '<div class="cli-panel" data-panel="telefonos" hidden><div id="cfTels"></div><p><button type="button" class="pos-link" id="cfTelMas">+ Agregar teléfono</button></p></div>' +
      '<div class="cli-panel" data-panel="persona" hidden><div class="pos-campos">' +
        campo('', 'Cumpleaños', '<input type="date" id="cfCumple" max="' + hoy + '" min="1900-01-01" value="' + esc(d.cumple || '') + '">') +
        campo('', 'Talle de pantalón', '<input type="text" id="cfTp" maxlength="10" autocomplete="off" value="' + esc(d.talle_pantalon || '') + '">') +
        campo('', 'Talle de remera', '<input type="text" id="cfTr" maxlength="10" autocomplete="off" value="' + esc(d.talle_remera || '') + '">') +
        campo('', 'Número de calzado', '<input type="text" id="cfCz" maxlength="10" autocomplete="off" value="' + esc(d.calzado || '') + '">') +
      '</div></div>' +
      '<div class="pos-error" id="cfError"></div>' +
      '<div class="pos-pie">' + (op.ventana ? '<button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' :
                                 '<button type="button" class="btn btn-sec btn-chico" id="cfOtro">Guardar y nuevo</button>') +
        '<button type="button" class="btn btn-pri btn-chico" id="cfGuardar">' + (op.ventana ? 'Guardar y elegirlo' : 'Guardar') + '</button></div>';
    var q = function (s) { return cont.querySelector(s); };

    function ponerPest(p) {
      pest = p;
      cont.querySelectorAll('.cli-pestanas .pestana').forEach(function (b) { if (b.getAttribute('data-pest') === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      cont.querySelectorAll('.cli-panel').forEach(function (x) { x.hidden = x.getAttribute('data-panel') !== p; });
    }
    cont.querySelectorAll('.cli-pestanas .pestana').forEach(function (b) { b.onclick = function () { leerListas(); ponerPest(b.getAttribute('data-pest')); }; });
    function cuantos() {
      q('[data-cuantos="direcciones"]').textContent = dirs.length ? ' (' + dirs.length + ')' : '';
      q('[data-cuantos="telefonos"]').textContent = tels.length ? ' (' + tels.length + ')' : '';
    }
    /* El documento: el teclado de números para el DNI y el CUIT, y la ayuda de la factura. */
    function ayudaDoc() {
      var t = q('#cfTipo').value, cond = q('#cfCond').value;
      q('#cfDoc').inputMode = t === 'pasaporte' || t === 'otro' ? 'text' : 'numeric';
      q('#cfDoc').placeholder = { dni: '7 u 8 números', cuit: '11 números', libreta: 'De 6 a 8 números', pasaporte: 'Letras y números', otro: '' }[t];
      q('#cfAyudaDoc').textContent = cond !== 'consumidor_final' ? 'Para la factura A va el CUIT con la condición de IVA.' :
        'Consumidor final: factura B. Para la A, el CUIT y la condición de IVA (responsable inscripto, monotributo o exento).';
    }
    q('#cfTipo').onchange = ayudaDoc;
    q('#cfCond').onchange = function () { if (this.value !== 'consumidor_final' && q('#cfTipo').value !== 'cuit') q('#cfTipo').value = 'cuit'; ayudaDoc(); };
    ayudaDoc();

    /* Las direcciones y los teléfonos: renglones que se agregan y se quitan; uno es el de las facturas / el predeterminado. */
    function pintarDirs() {
      q('#cfDirs').innerHTML = dirs.length ? dirs.map(function (x, i) {
        return '<div class="cli-renglon" data-dir="' + i + '"><div class="pos-campos">' +
          campo('cli-calle', 'Calle', '<input type="text" data-k="calle" maxlength="80" value="' + esc(x.calle || '') + '">') +
          campo('cli-corto', 'Número', '<input type="text" data-k="numero" maxlength="10" value="' + esc(x.numero || '') + '">') +
          campo('cli-corto', 'Piso', '<input type="text" data-k="piso" maxlength="5" value="' + esc(x.piso || '') + '">') +
          campo('cli-corto', 'Depto.', '<input type="text" data-k="depto" maxlength="5" value="' + esc(x.depto || '') + '">') +
          campo('', 'Localidad', '<input type="text" data-k="localidad" maxlength="60" value="' + esc(x.localidad || '') + '">') +
          campo('cli-corto', 'Código postal', '<input type="text" data-k="cp" maxlength="10" value="' + esc(x.cp || '') + '">') +
          campo('', 'Provincia', '<input type="text" data-k="provincia" maxlength="60" value="' + esc(x.provincia || '') + '">') +
          '<label class="pos-check"><input type="radio" name="cfDirFac" data-k="factura"' + (x.factura ? ' checked' : '') + '> Para las facturas</label>' +
          '</div><button type="button" class="tk-quitar" data-quitar-dir="' + i + '" title="Quitar esta dirección" aria-label="Quitar esta dirección">' + icono('x') + '</button></div>';
      }).join('') : '<p class="cli-vacio">Sin direcciones. La de las facturas va en la factura A.</p>';
      cont.querySelectorAll('[data-quitar-dir]').forEach(function (b) {
        b.onclick = function () { leerListas(); dirs.splice(Number(b.getAttribute('data-quitar-dir')), 1); pintarDirs(); cuantos(); };
      });
    }
    function pintarTels() {
      q('#cfTels').innerHTML = tels.length ? tels.map(function (x, i) {
        return '<div class="cli-renglon" data-tel="' + i + '"><div class="pos-campos">' +
          campo('', 'Número', '<input type="tel" data-k="numero" maxlength="25" placeholder="Con la característica" value="' + esc(x.numero || '') + '">') +
          campo('', 'Contacto', '<input type="text" data-k="contacto" maxlength="60" value="' + esc(x.contacto || '') + '">') +
          campo('', 'Horario', '<input type="text" data-k="horario" maxlength="40" value="' + esc(x.horario || '') + '">') +
          '<label class="pos-check"><input type="radio" name="cfTelPre" data-k="predeterminado"' + (x.predeterminado ? ' checked' : '') + '> Predeterminado</label>' +
          '</div><button type="button" class="tk-quitar" data-quitar-tel="' + i + '" title="Quitar este teléfono" aria-label="Quitar este teléfono">' + icono('x') + '</button></div>';
      }).join('') : '<p class="cli-vacio">Sin teléfonos.' + (d.socio ? ' El WhatsApp del Club no hace falta cargarlo acá.' : '') + '</p>';
      cont.querySelectorAll('[data-quitar-tel]').forEach(function (b) {
        b.onclick = function () { leerListas(); tels.splice(Number(b.getAttribute('data-quitar-tel')), 1); pintarTels(); cuantos(); };
      });
    }
    function leerRenglones(sel, xs) {
      cont.querySelectorAll(sel).forEach(function (r, i) {
        r.querySelectorAll('[data-k]').forEach(function (e) { xs[i][e.getAttribute('data-k')] = e.type === 'radio' ? e.checked : e.value.trim(); });
      });
    }
    function leerListas() { leerRenglones('[data-dir]', dirs); leerRenglones('[data-tel]', tels); }
    q('#cfDirMas').onclick = function () {
      leerListas();
      if (dirs.length >= 10) { errorEn(cont, 'cfError', 'Hasta 10 direcciones.'); return; }
      dirs.push({ factura: !dirs.length });
      pintarDirs(); cuantos();
      var r = cont.querySelectorAll('[data-dir]'); r[r.length - 1].querySelector('[data-k="calle"]').focus();
    };
    q('#cfTelMas').onclick = function () {
      leerListas();
      if (tels.length >= 10) { errorEn(cont, 'cfError', 'Hasta 10 teléfonos.'); return; }
      tels.push({ predeterminado: !tels.length });
      pintarTels(); cuantos();
      var r = cont.querySelectorAll('[data-tel]'); r[r.length - 1].querySelector('[data-k="numero"]').focus();
    };
    pintarDirs(); pintarTels(); cuantos(); ponerPest('generales');

    /* Revisar antes de mandar (la base revisa lo mismo): si algo falta, se abre la pestaña donde está. */
    function revisar(x) {
      var dig = x.doc.replace(/\D/g, '');
      if (!x.nombre) return ['generales', 'cfNombre', 'Falta el nombre (o la razón social).'];
      if (x.doc && x.doc_tipo === 'cuit' && dig.length !== 11) return ['generales', 'cfDoc', 'El CUIT tiene 11 números.'];
      if (x.doc && x.doc_tipo === 'cuit' && !cuitOk(dig)) return ['generales', 'cfDoc', 'Ese CUIT no es válido: revisá los números (el último es el dígito verificador).'];
      if (x.doc && x.doc_tipo === 'dni' && (dig.length < 7 || dig.length > 8)) return ['generales', 'cfDoc', 'El DNI tiene 7 u 8 números.'];
      if (x.doc && x.doc_tipo === 'libreta' && (dig.length < 6 || dig.length > 8)) return ['generales', 'cfDoc', 'La libreta tiene de 6 a 8 números.'];
      if (x.doc && x.doc_tipo === 'pasaporte' && !/^[A-Z0-9]{6,12}$/.test(x.doc.toUpperCase().replace(/\s/g, ''))) return ['generales', 'cfDoc', 'El pasaporte tiene de 6 a 12 letras y números.'];
      if (x.condicion !== 'consumidor_final' && (x.doc_tipo !== 'cuit' || !x.doc)) return ['generales', 'cfDoc', 'Para responsable inscripto, monotributo o exento hace falta el CUIT.'];
      if (x.mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.mail)) return ['generales', 'cfMail', 'El mail no está bien escrito.'];
      for (var i = 0; i < x.direcciones.length; i++) if (!x.direcciones[i].calle) return ['direcciones', null, 'En cada dirección falta la calle (o quitá la que sobra).'];
      for (var j = 0; j < x.telefonos.length; j++) if (String(x.telefonos[j].numero || '').replace(/\D/g, '').length < 6) return ['telefonos', null, 'Cada teléfono necesita el número, con la característica (o quitá el que sobra).'];
      if (x.cumple && (x.cumple > hoy || x.cumple < '1900-01-01')) return ['persona', 'cfCumple', 'La fecha de cumpleaños no es válida.'];
      return null;
    }
    function guardar(otro) {
      leerListas();
      var x = {
        id: d.id || null, nombre: q('#cfNombre').value.trim(), doc_tipo: q('#cfTipo').value, doc: q('#cfDoc').value.trim(), condicion: q('#cfCond').value,
        mail: q('#cfMail').value.trim().toLowerCase(), observaciones: q('#cfObs').value.trim(), cumple: q('#cfCumple').value || null,
        talle_pantalon: q('#cfTp').value.trim(), talle_remera: q('#cfTr').value.trim(), calzado: q('#cfCz').value.trim(),
        direcciones: dirs, telefonos: tels, activo: q('#cfActivo') ? q('#cfActivo').checked : true
      };
      if (!d.id) {
        x.local_id = op.local || (localInicial() || {}).id || null;
        if (d.socio && d.socio.id) x.socio_id = d.socio.id;
        else if (op.socio) x.socio = op.socio;
      }
      var mal = revisar(x);
      if (mal) {
        ponerPest(mal[0]);
        errorEn(cont, 'cfError', mal[2]);
        if (mal[1]) q('#' + mal[1]).focus();
        return;
      }
      errorEn(cont, 'cfError', '');
      var bts = cont.querySelectorAll('#cfGuardar, #cfOtro');
      bts.forEach(function (b) { b.disabled = true; });
      llamar('pos_cliente_guardar', { p: x }).then(function (r) {
        if (op.alGuardar) op.alGuardar(r, otro);
      }).catch(function (e) {
        bts.forEach(function (b) { b.disabled = false; });
        errorEn(cont, 'cfError', sin197(e));
      });
    }
    q('#cfGuardar').onclick = function () { guardar(false); };
    if (q('#cfOtro')) q('#cfOtro').onclick = function () { guardar(true); };
    cont.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') { e.preventDefault(); guardar(false); }
    });
    setTimeout(function () { var f = q(d.nombre ? (d.doc || d.socio ? '#cfNombre' : '#cfDoc') : '#cfNombre'); if (f && cont.isConnected) f.focus(); }, 0);
  }

  /* «Crear cliente» desde la lupita de la venta: la ficha entera en una ventana; al guardarlo queda elegido en la venta.
     Si la venta tiene un socio sin ficha, la ficha nueva es la suya (con su nombre y su mail) y queda atada a él. */
  function abrirCrearCliente(texto) {
    var so = V.socio && !V.cliente_id ? V.socio : null;
    var d = clienteDeTexto(so ? '' : texto);
    if (so) { d.nombre = so.nombre; d.mail = (V.cliente && V.cliente.email) || ''; }
    var caja = ventana('<h3 id="posVentTit">Crear cliente</h3><p class="pos-bajada">' +
        (so ? 'La ficha de <b>' + esc(so.nombre) + '</b>, atada a su tarjeta del Club: con los datos para la factura y lo que quieras sumar.' :
              'Queda en Clientes para la próxima vez. Para la factura A: el CUIT y la condición de IVA.') + '</p><div id="ccForm"></div>', true);
    formCliente(caja.querySelector('#ccForm'), d, {
      ventana: true, local: V.local_id, socio: so ? so.codigo : null,
      alGuardar: function (c) {
        elegirCliente(c, null);
        cerrarVentana();
        pintar();
        avisar('ok', 'Listo: ' + c.nombre + ' quedó cargado en Clientes (Nº ' + c.numero + ') y elegido en la venta.');
      }
    });
  }
  /** El cliente elegido en la venta: sus datos para la factura (el DNI o el CUIT, la condición, el mail y el teléfono).
      Con su socio (s, como lo trae la lupita), también el socio. Lo de mandarle la factura queda como estaba. */
  function elegirCliente(c, s) {
    if (s) elegirSocio(s);
    var antes = V.cliente || {};
    var doc = c.doc && (c.doc_tipo === 'cuit' || c.doc_tipo === 'dni') ? c.doc : '';
    V.cliente = { nombre: c.nombre, doc: doc, condicion: c.condicion || 'consumidor_final', email: c.mail || antes.email || '',
                  tel: c.telefono || antes.tel || '', envio: antes.envio || '', acepta: !!antes.acepta };
    V.cliente_id = c.id;
    if (V.letra === 'X') return;
    if (clienteParaA(V.cliente)) V.letra = 'A';
    else if (V.letra === 'A') V.letra = 'B';
  }

  /* ════════════════════════════════════════════════════════════════════
     LA VENTA FALLIDA (SQL 171)
     La "Nueva venta fallida" de BlueSoft: el cliente que se fue sin
     comprar y no dejó su WhatsApp (el que lo deja va al No Compra, que le
     escribe cuando entra lo que buscaba). El motivo, el producto si pidió
     uno, el detalle y el monto perdido. Suma al tráfico de Tickets.
     ════════════════════════════════════════════════════════════════════ */
  /* o: { local, vendedor (los de la anterior, con «Guardar y nueva»), alGuardar() }. */
  function abrirFallida(o) {
    o = o || {};
    var l = localMio(o.local) || localInicial(), prueba = enPrueba();
    var F = { clave: nuevaClave(), local: l ? l.id : null, vendedor: o.vendedor || vendedorInicial(l), motivo: '', prod: null, talle: '', color: '', montoAuto: '' };
    var caja = ventana('<h3 id="posVentTit">Nueva venta fallida' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : '') + '</h3>' +
        '<p class="pos-bajada">' + fechaCorta(S.ini.hoy) + ' · El cliente que se fue sin comprar y no dejó su WhatsApp.</p>' +
      '<div class="pos-campos">' +
        campo('', 'Sucursal', '<select id="vfLocal" class="desplegable">' + opcionesLocales(F.local) + '</select>') +
        campo('', 'Vendedor', '<select id="vfVend"></select>') +
        '<div class="pos-f ancho"><span>Motivo</span><div class="chips vf-motivos" id="vfMotivos">' + MOTIVOS.map(function (m) {
          return '<button type="button" class="chip" data-motivo="' + m[0] + '">' + esc(m[1]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="pos-f ancho"><span>Producto <span class="lbl-opc">(si buscaba uno)</span></span>' +
          '<div class="tk-prod"><input type="search" id="vfProd" autocomplete="off" spellcheck="false" placeholder="Escaneá la etiqueta, o buscá por código o nombre…" aria-controls="vfSug">' +
          '<div class="tk-sug" id="vfSug" role="listbox" aria-label="Productos" hidden></div></div>' +
          '<div id="vfElegido"></div></div>' +
        campo('', 'Detalle', '<textarea id="vfDetalle" maxlength="500" rows="2" placeholder="Qué buscaba, qué le ofrecimos…"></textarea>') +
        campo('', 'Monto perdido estimado', '<input type="text" inputmode="decimal" id="vfMonto" placeholder="$">') +
      '</div>' +
      '<div class="pos-error" id="vfError"></div>' +
      /* El aviso del No Compra va al lado de los botones: así la ventana entera entra en la PC del local. */
      '<div class="pos-pie"><p class="vf-nc izq" title="Así se le escribe cuando entra lo que buscaba.">¿Dejó su WhatsApp? Entonces es un <a href="index.html?volver=pos">No Compra</a>.</p>' +
        '<button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vfOtra">Guardar y nueva</button>' +
        '<button type="button" class="btn btn-chico btn-fallida" id="vfOk">' + (prueba ? 'Guardar prueba' : 'Guardar') + '</button></div>', true);
    caja.classList.add('vf');
    function lista() { return listaDe(localDe(F.local)); }
    function llenarVend() {
      var vs = vendedoresDe(F.local);
      if (F.vendedor && vs.indexOf(F.vendedor) < 0) vs.push(F.vendedor);
      caja.querySelector('#vfVend').innerHTML = '<option value="">Elegí quién atendió…</option>' + opciones(vs.map(function (n) { return [n, n]; }), F.vendedor);
    }
    function marcarMotivo() {
      caja.querySelectorAll('[data-motivo]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-motivo') === F.motivo); });
      caja.querySelector('#vfDetalle').placeholder = F.motivo === 'otro' ? 'Contá qué pasó (con «Otro motivo» hace falta)' : 'Qué buscaba, qué le ofrecimos…';
    }
    /* El producto que buscaba. Del disparo a la etiqueta se toma sólo la prenda: el talle y el color que buscaba son
       justamente los que no había, así que se eligen abajo (salvo que tenga uno solo). */
    function elegirProd(p) {
      var ts = tallesDe(p), cs = coloresDe(p);
      F.prod = p;
      F.talle = ts.length === 1 ? ts[0] : '';
      F.color = cs.length === 1 ? cs[0].cod : '';
      caja.querySelector('#vfProd').limpiar();
      pintarProd();
      /* El monto perdido: el precio de la prenda, si no escribieron otro. */
      var m = caja.querySelector('#vfMonto'), pr = precioDe(p[0], lista());
      if (pr && (!m.value.trim() || m.value === F.montoAuto)) m.value = F.montoAuto = plataCampo(pr);
    }
    function pintarProd() {
      var e = caja.querySelector('#vfElegido'), p = F.prod;
      if (!p) { e.innerHTML = ''; return; }
      var ts = tallesDe(p), cs = coloresDe(p);
      e.innerHTML = '<div class="vf-sel"><b>' + esc(p[1]) + '</b><small>' + esc(p[0]) + '</small>' +
          '<button type="button" class="tk-quitar" id="vfSacar" title="Sacar el producto" aria-label="Sacar el producto">' + icono('x') + '</button></div><div class="vf-vars">' +
        (ts.length > 1 ? '<div class="vf-var"><span>Talle que buscaba</span><div class="chips">' + ts.map(function (t) {
          return '<button type="button" class="chip' + (t === F.talle ? ' sel' : '') + '" data-vt="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' : '') +
        (cs.length > 1 ? '<div class="vf-var"><span>Color que buscaba</span><div class="chips">' + cs.map(function (x) {
          return '<button type="button" class="chip' + (x.cod === F.color ? ' sel' : '') + '" data-vc="' + esc(x.cod) + '">' + esc(x.nom) + '</button>'; }).join('') + '</div></div>' : '') + '</div>';
    }
    llenarVend();
    engancharProducto({ campo: 'vfProd', sug: 'vfSug', lista: lista, agregar: elegirProd, elegir: elegirProd, sinLinea: true,
      noEsta: function () {
        var d = caja.querySelector('#vfDetalle'), t = caja.querySelector('#vfProd').value.trim();
        if (!d.value.trim()) d.value = t;
        caja.querySelector('#vfProd').limpiar();
        avisar('info', 'No está en el catálogo: quedó escrito en «Detalle».');
        d.focus();
      } });
    asegurarPrecios(lista()).catch(function () {});
    caja.querySelector('#vfLocal').onchange = function () {
      var x = localDe(this.value);
      F.local = x.id;
      F.vendedor = vendedorInicial(x);
      llenarVend();
      asegurarPrecios(lista()).catch(function () {});
    };
    caja.querySelector('#vfVend').onchange = function () { F.vendedor = this.value; };
    caja.querySelector('#vfMotivos').onclick = function (e) {
      var b = e.target.closest('[data-motivo]');
      if (!b) return;
      F.motivo = b.getAttribute('data-motivo');
      marcarMotivo();
      errorEn(caja, 'vfError', '');
    };
    caja.querySelector('#vfElegido').onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'vfSacar') {
        var m = caja.querySelector('#vfMonto');
        if (m.value === F.montoAuto) m.value = F.montoAuto = '';
        F.prod = null; F.talle = ''; F.color = '';
        caja.querySelector('#vfProd').focus();
      } else if (b.hasAttribute('data-vt')) F.talle = F.talle === b.getAttribute('data-vt') ? '' : b.getAttribute('data-vt');
      else if (b.hasAttribute('data-vc')) F.color = F.color === b.getAttribute('data-vc') ? '' : b.getAttribute('data-vc');
      pintarProd();
    };
    function guardarF(otra) {
      var det = caja.querySelector('#vfDetalle').value.trim(), mt = caja.querySelector('#vfMonto').value.trim(), m = mt ? leerPlata(mt) : null;
      if (!errorEn(caja, 'vfError', !F.local ? 'Elegí la sucursal.' : !F.vendedor ? 'Elegí quién atendió.' : !F.motivo ? 'Elegí el motivo.' :
                                     F.motivo === 'otro' && det.length < 3 ? 'Con «Otro motivo», escribí qué pasó en «Detalle».' :
                                     mt && !(m >= 0) ? 'El monto perdido no se entiende. Escribilo así: 20000 o 16.333,33' : '')) return;
      var p = { clave: F.clave, prueba: prueba, local_id: F.local, vendedor: F.vendedor, motivo: F.motivo, detalle: det, monto: m == null ? null : aPesos(m),
                codigo: F.prod ? F.prod[0] : '', descripcion: F.prod ? F.prod[1] : '', talle: F.talle, color: F.color };
      var b1 = caja.querySelector('#vfOk'), b2 = caja.querySelector('#vfOtra');
      b1.disabled = b2.disabled = true;
      llamar('pos_fallida_guardar', { p: p }).then(function (r) {
        var rc = recuerdo();
        rc.local = F.local;
        rc.vendedor = rc.vendedor || {};
        rc.vendedor[F.local] = F.vendedor;
        guardarJSON(K_RECUERDO, rc);
        avisar('ok', (prueba ? 'Venta fallida de prueba guardada' : 'Venta fallida guardada') + (r && r.ya ? ' (ya estaba guardada: no se duplicó).' : '.'));
        if (otra) abrirFallida({ local: F.local, vendedor: F.vendedor, alGuardar: o.alGuardar }); else cerrarVentana();
        if (o.alGuardar) o.alGuardar();
      }).catch(function (e) {
        if (!caja.isConnected) return;
        b1.disabled = b2.disabled = false;
        errorEn(caja, 'vfError', e && e.sinSesion ? 'Se cerró tu sesión: entrá de nuevo.' : mensajeDe(e));
      });
    }
    caja.querySelector('#vfOk').onclick = function () { guardarF(false); };
    caja.querySelector('#vfOtra').onclick = function () { guardarF(true); };
    setTimeout(function () { var f = caja.querySelector(F.vendedor ? '[data-motivo]' : '#vfVend'); if (f) f.focus(); }, 0);
  }

  /* La lista de las ventas fallidas: con qué motivo se fueron y cuánta plata se perdió. Se borra la que se cargó mal. */
  function verFallidas() {
    var c = $('cuerpo'), prueba = enPrueba(), todos = {};
    Object.keys(S.ini.vendedores || {}).forEach(function (k) { (S.ini.vendedores[k] || []).forEach(function (n) { todos[n] = 1; }); });
    c.innerHTML = cabeza('Ventas fallidas' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Los clientes que se fueron sin comprar y no dejaron su WhatsApp. Los que lo dejan van al No Compra.',
        '<a class="btn btn-sec btn-chico" href="index.html?volver=pos" title="El cliente dejó su WhatsApp">No Compra</a>' +
        '<button type="button" class="btn btn-chico btn-fallida" id="vfNueva">Nueva venta fallida</button>') +
      '<div class="pos-filtros"><div id="vfPer"></div>' +
        campo('', 'Sucursal', '<select id="vfFLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Vendedor', '<select id="vfFVend"><option value="">Todos</option>' + opciones(Object.keys(todos).sort().map(function (n) { return [n, n]; }), '') + '</select>') +
        campo('', 'Motivo', '<select id="vfFMotivo"><option value="">Todos</option>' + opciones(MOTIVOS, '') + '</select>') +
        campo('', 'Ventas fallidas', '<select id="vfFPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="vfLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('vfPer'), { inicial: 'hoy', guardar: 'pos_fallidas_periodo', hastaHoy: true, alCambiar: cargar });
    ['vfFLocal', 'vfFVend', 'vfFMotivo', 'vfFPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('vfNueva').onclick = function () { abrirFallida({ local: $('vfFLocal').value, alGuardar: cargar }); };
    var pedido = 0;
    function deLaPrueba() { return $('vfFPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('vfLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_fallidas', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('vfFLocal').value || null, p_vendedor: $('vfFVend').value || null,
                               p_motivo: $('vfFMotivo').value || null, p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('vfLista')) return;
        pintarF(d);
      }).catch(function (e) { if ($('vfLista')) $('vfLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarF(d) {
      var t = d.totales || {}, pm = d.por_motivo || {};
      var arriba = '<div class="pos-totales"><div class="pos-kpi"><span>Ventas fallidas</span><b>' + miles(Number(t.cantidad) || 0) + '</b></div>' +
          '<div class="pos-kpi"><span>Monto perdido</span><b>' + plata(cent(t.perdido || 0)) + '</b></div></div>' +
        (Object.keys(pm).length ? '<p class="pos-por-letra">' + MOTIVOS.filter(function (m) { return pm[m[0]]; }).map(function (m) {
          return '<span>' + esc(m[1]) + ' <b>' + pm[m[0]] + '</b></span>'; }).join('') + '</p>' : '') +
        (deLaPrueba() ? '<div class="pos-cartel prueba">Las ventas fallidas de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en Tickets.</div>' : '');
      if (!d.filas || !d.filas.length) {
        $('vfLista').innerHTML = arriba + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay ventas fallidas de prueba en ese período con esos filtros.' : 'No hay ventas fallidas en ese período con esos filtros.') + '</div>';
        return;
      }
      $('vfLista').innerHTML = arriba + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th>Sucursal</th><th>Vendedor</th><th>Motivo</th>' +
        '<th>Producto</th><th>Detalle</th><th class="n">Monto perdido</th><th>Cargó</th><th><span class="sr">Borrar</span></th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var prod = f.descripcion ? esc(f.descripcion) + (f.talle ? ' · ' + esc(f.talle) : '') + (f.color ? ' · ' + esc(nombreColor(f.color, f.codigo)) : '') : '<span class="apagado">—</span>';
          return '<tr data-fallida="' + esc(f.id) + '"' + (f.prueba ? ' class="prueba"' : '') + '><td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(bonito(f.local)) + '</td>' +
            '<td>' + esc(f.vendedor) + '</td><td>' + esc(nombreMotivo(f.motivo)) + '</td><td>' + prod + '</td>' +
            '<td class="vf-det">' + (f.detalle ? esc(f.detalle) : '<span class="apagado">—</span>') + '</td>' +
            '<td class="n">' + (f.monto != null ? plata(cent(f.monto)) : '<span class="apagado">—</span>') + '</td><td>' + esc(f.cargado_por || '—') + '</td>' +
            '<td>' + (puede('anular') ? '<button type="button" class="tk-quitar" data-borrar="' + esc(f.id) + '" title="Borrar (si se cargó por error)" aria-label="Borrar esta venta fallida">' + icono('x') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven las últimas 500. Achicá el período para ver el resto.</p>' : '');
      $('vfLista').querySelectorAll('[data-borrar]').forEach(function (b) {
        b.onclick = function () {
          var f = d.filas.filter(function (x) { return x.id === b.getAttribute('data-borrar'); })[0];
          if (!confirm('¿Borrar la venta fallida de ' + f.vendedor + ' (' + fechaHora(f.fecha) + ', ' + nombreMotivo(f.motivo) + ')? Es para una que se cargó por error. No se puede deshacer.')) return;
          b.disabled = true;
          llamar('pos_fallida_borrar', { p_id: f.id }).then(function () { avisar('ok', 'Listo: se borró la venta fallida.'); cargar(); })
            .catch(function (e) { b.disabled = false; avisar('err', mensajeDe(e)); });
        };
      });
    }
    cargar();
  }

  /* ════════════════════════════════════════════════════════════════════
     LOS CAMBIOS (SQL 151)
     El "Ticket de cambio" de BlueSoft: arriba lo que vuelve (productos
     entrantes) y abajo lo que se lleva (productos salientes). Mauricio
     (21/10): "hagámoslo igual… bien básico". Lo que vuelve entra al precio
     de lista; si sale más, se cobra la diferencia; si sale menos, no se
     guarda: se sube el precio de lo que se lleva hasta que da $0 ("y
     pierde la plata").
     ════════════════════════════════════════════════════════════════════ */
  var SENTIDO = {
    vuelve: { campo: 'cbVuelve', sug: 'cbSugV', filas: 'cbFilasV', sub: 'cbSubV', icono: 'entra', titulo: 'Productos entrantes', ayuda: 'lo que vuelve',
              vacia: '<b>Todavía no vuelve nada</b>Dispará la pistola a la etiqueta de la prenda que trae el cliente.' },
    sale: { campo: 'cbSale', sug: 'cbSugS', filas: 'cbFilasS', sub: 'cbSubS', icono: 'sale', titulo: 'Productos salientes', ayuda: 'lo que se lleva',
            vacia: '<b>Todavía no se lleva nada</b>Dispará la pistola a la prenda nueva.' }
  };

  function cambioNuevo(antes) {
    var l = (antes && localMio(antes.local_id)) || localInicial();
    return { v: 1, clave: nuevaClave(), local_id: l ? l.id : null, vendedor: antes ? antes.vendedor : vendedorInicial(l),
             lista_id: listaDe(l), cliente: '', vuelve: [], sale: [], forma: 'efectivo', pago: {}, observaciones: '' };
  }
  function cargarCambio() {
    var b = leerJSON(K_CAMBIO, null);
    if (b && b.v === 1 && b.clave && Array.isArray(b.vuelve) && Array.isArray(b.sale) && localMio(b.local_id) && listaPorId(b.lista_id)) {
      b.pago = b.pago || {};
      if (!MEDIOS[b.forma]) b.forma = 'efectivo';
      return b;
    }
    return cambioNuevo();
  }
  function guardarBorradorCb() { guardarJSON(K_CAMBIO, CB); }

  /** La cuenta del cambio, en centavos. dif = lo que se lleva − lo que vuelve: lo que se cobra (negativa, no se guarda). */
  function cuentaCambio(cb) {
    var r = { vuelve: 0, sale: 0, cv: 0, cs: 0 };
    cb.vuelve.forEach(function (l) { r.vuelve += l.precio * l.cantidad; r.cv += l.cantidad; });
    cb.sale.forEach(function (l) { r.sale += l.precio * l.cantidad; r.cs += l.cantidad; });
    r.dif = r.sale - r.vuelve;
    return r;
  }
  /** Las reglas del precio (las mismas de la base): lo que vuelve, a lista o menos; lo que se lleva, a lista o más. */
  function precioMal(s, l, c) {
    if (l.lista == null) return '';
    if (s === 'vuelve' && c > l.lista) return 'Lo que vuelve entra al precio de lista (' + plata(l.lista) + ') o menos.';
    if (s === 'sale' && c < l.lista) return 'Lo que se lleva no puede ir más barato que la lista (' + plata(l.lista) + ').';
    return '';
  }
  function conSigno(c) { return (c < 0 ? '−' : '') + plata(Math.abs(c)); }
  function textoGuardarCb() { return (enPrueba() ? 'Guardar prueba' : 'Guardar cambio') + ' <span class="pos-tecla">F9</span>'; }

  function verCambio() {
    CB = cargarCambio();
    S.cbFoco = 'cbVuelve';
    var c = $('cuerpo'), prueba = enPrueba();
    c.classList.add('lleno');
    function bloque(s) {
      var x = SENTIDO[s];
      return '<div class="tk-prod cb-prod">' +
          '<span class="cb-icono ' + s + '" aria-hidden="true">' + icono(x.icono) + '</span>' +
          campo('', x.titulo + ' <span class="lbl-opc">· ' + x.ayuda + '</span>', '<input type="search" id="' + x.campo + '" autocomplete="off" spellcheck="false" ' +
            'placeholder="Escaneá la etiqueta, o buscá por código o nombre…" aria-controls="' + x.sug + '" title="F2: el otro campo">') +
          '<span class="cb-subtot" id="' + x.sub + '"></span>' +
          '<button type="button" class="btn btn-sec btn-chico" data-linea="' + s + '" title="Un artículo que no está en el catálogo">Nueva línea</button>' +
          '<div class="tk-sug" id="' + x.sug + '" role="listbox" aria-label="Productos" hidden></div></div>' +
        '<div class="tk-grilla"><table class="tk-tabla"><thead><tr><th>Ítem</th><th>Código</th><th>Descripción</th><th class="c">Talle</th><th>Color</th>' +
          '<th class="c">Cant.</th><th class="n">Precio unit.</th><th class="n">Total</th><th><span class="sr">Quitar</span></th></tr></thead>' +
          '<tbody id="' + x.filas + '"></tbody></table></div>';
    }
    c.innerHTML =
      cabeza('Ticket de cambio' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), '<span id="cbSubt"></span>',
        '<div id="cbHecho"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="cbLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="cbGuardar" title="Guardar el cambio y empezar otro (F9)">' + textoGuardarCb() + '</button>') +
      '<div class="tk cb">' +
        '<section class="tk-izq" aria-label="Los datos del cambio"><div class="tk-datos">' +
          campo('c4', 'Fecha', '<input type="text" id="cbFecha" readonly>') +
          campo('c4', 'Comprobante', '<input type="text" value="Cambio" readonly title="Comprobante interno: el cambio no es una factura y no va a ARCA">') +
          campo('c4', 'Referencia', '<input type="text" id="cbRef" readonly title="El número lo da la base al guardar (C-1, C-2… por sucursal)">') +
          campo('c8', 'Vendedor', '<select id="cbVend"></select>') +
          campo('c4', 'Estado', '<input type="text" value="Cobrada" readonly>') +
          campo('', 'Cliente', '<input type="text" id="cbCliente" maxlength="120" placeholder="Consumidor final" autocomplete="off">') +
          campo('', 'Lista de precios', '<select id="cbLista"></select>') +
          campo('', 'Forma de pago', '<select id="cbForma">' + opciones(Object.keys(MEDIOS).map(function (k) { return [k, MEDIOS[k]]; }), CB.forma) + '</select>') +
          '<div class="tk-pagox" id="cbPagoX"></div>' +
          campo('c6', 'Sucursal', '<select id="cbLocal" class="desplegable"></select>') +
          campo('c3', 'Depósito', '<input type="text" id="cbDep" value="Ventas" readonly title="Lo que vuelve entra al stock de la sucursal y lo que se lleva sale">') +
          campo('c3', 'Caja', '<input type="text" value="Chica" readonly title="La caja chica del local">') +
        '</div>' +
        '<div class="tk-tot">' +
          '<div class="tk-caja"><span>Neto</span><b id="cbNeto">$0</b></div>' +
          '<div class="tk-caja"><span>Descuentos</span><b>$0</b></div>' +
          '<div class="tk-caja"><span>Productos</span><b id="cbCant">0</b></div>' +
          '<div class="tk-caja gordo" id="cbTotCaja"><span>' + (prueba ? 'Total · prueba' : 'Total a pagar') + '</span><b id="cbTotal">$0</b></div>' +
        '</div></section>' +
        '<section class="tk-der" aria-label="Los productos">' + bloque('vuelve') + bloque('sale') +
          '<div class="tk-pie">' + campo('', 'Observaciones', '<textarea id="cbObs" maxlength="500"></textarea>') + '<div class="tk-nota" id="cbNota" role="status"></div></div>' +
        '</section>' +
      '</div>';

    $('cbFecha').value = fechaCorta(S.ini.hoy);
    $('cbLocal').innerHTML = opcionesLocales(CB.local_id);
    $('cbLista').innerHTML = opciones(S.ini.listas.map(function (l) { return [l.id, l.nombre]; }), CB.lista_id);
    $('cbCliente').value = CB.cliente || '';
    $('cbObs').value = CB.observaciones || '';
    llenarVendedores(true);
    pintarHechoCb();

    $('cbVend').onchange = function () {
      if (this.value === '__otro') { this.value = CB.vendedor; pedirVendedor(true); return; }
      CB.vendedor = this.value;
      recordar(true);
      pintarCambio();
    };
    $('cbCliente').oninput = function () { CB.cliente = this.value; guardarBorradorCb(); };
    $('cbLista').onchange = function () { cambiarListaCb(Number(this.value)); };
    $('cbForma').onchange = function () { CB.forma = this.value; pintarPago(true); pintarCambio(); };
    $('cbLocal').onchange = function () {
      var l = localDe(this.value);
      CB.local_id = l.id;
      CB.vendedor = vendedorInicial(l);
      recordar(true);
      llenarVendedores(true);
      cambiarListaCb(listaDe(l));
      traerStock(l.id).then(function () { if (S.vista === 'cambio' && CB.local_id === l.id) pintarCambio(); });
      ponerDeposito('cbDep', l.id);
    };
    $('cbObs').oninput = function () { CB.observaciones = this.value; guardarBorradorCb(); };
    $('cbLimpiar').onclick = function () {
      if ((CB.vuelve.length || CB.sale.length) && !confirm('¿Borrar el cambio que estás armando?')) return;
      CB = cambioNuevo(CB);
      guardarBorradorCb();
      verCambio();
    };
    $('cbGuardar').onclick = guardarCambio;
    ['vuelve', 'sale'].forEach(function (s) {
      var x = SENTIDO[s];
      engancharProducto({ campo: x.campo, sug: x.sug, lista: function () { return CB.lista_id; }, agregar: agregarCb(s) });
      $(x.campo).addEventListener('focus', function () { S.cbFoco = x.campo; });
      engancharFilasCb(s);
    });
    c.querySelectorAll('[data-linea]').forEach(function (b) {
      b.onclick = function () {
        var s = b.getAttribute('data-linea');
        S.cbFoco = SENTIDO[s].campo;
        abrirLineaLibre(function (l) {
          /* Si escribieron un código de la lista, valen las mismas reglas del precio. */
          l.lista = l.codigo ? precioDe(l.codigo, CB.lista_id) : null;
          var mal = precioMal(s, l, l.precio);
          if (mal) { l.precio = l.lista; avisar('info', mal + ' Quedó a ' + plata(l.lista) + '.'); }
          l.propio = l.precio !== l.lista;
          CB[s].push(l);
          pintarCambio();
        });
      };
    });
    pintarPago(true);
    $('cbFilasV').innerHTML = $('cbFilasS').innerHTML = '<tr class="tk-vacia"><td colspan="9">Cargando los precios…</td></tr>';
    ponerDeposito('cbDep', CB.local_id);
    Promise.all([preciosAlDia(CB.lista_id), traerStock(CB.local_id)]).then(function () { pintarCambio(); }, function (e) { pintarCambio(); avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); });
    /* En la compu, el foco en lo que vuelve: la pistola dispara sin tocar nada. En el celular no (abriría el teclado). */
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var p = $('cbVuelve'); if (p) p.focus(); }, 0);
  }

  function agregarCb(s) {
    return function (p, talle, color, cant) {
      var cod = p[0], pl = precioDe(cod, CB.lista_id), ls = CB[s];
      var ya = ls.filter(function (l) { return !l.libre && !l.propio && l.codigo === cod && l.talle === talle && l.color === color; })[0];
      if (ya) ya.cantidad = Math.min(999, ya.cantidad + (cant || 1));
      else ls.push({ codigo: cod, descripcion: p[1], rubro: p[2] || '', talle: talle || '', color: color || '', color_nom: nombreColor(color, cod),
                     cantidad: cant || 1, precio: pl || 0, lista: pl, propio: false });
      var campoP = $(SENTIDO[s].campo);
      campoP.limpiar();
      pintarCambio();
      /* Lo que se lleva sale del stock: si no está, que lo sepa (lo que vuelve, entra). */
      if (s === 'sale') avisarAlAgregar(p, CB.local_id, talle, color, !pl, CB.sale);
      else if (!pl) avisar('info', p[1] + ' no tiene precio en esta lista: escribilo en «Precio unit.».');
      campoP.focus();
    };
  }

  /** Otra lista: todo lo del catálogo pasa al precio de esa lista (también lo que se había ajustado). */
  function cambiarListaCb(lista) {
    CB.lista_id = lista;
    $('cbLista').value = String(lista);
    asegurarPrecios(lista).then(function () {
      CB.vuelve.concat(CB.sale).forEach(function (l) {
        if (l.libre) return;
        l.lista = precioDe(l.codigo, lista);
        l.precio = l.lista || 0;
        l.propio = false;
      });
      pintarCambio();
    }, function (e) { avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); pintarCambio(); });
  }

  /* Cada grilla: cantidad y precio se cambian ahí mismo (con las reglas del precio); la ✕ quita el renglón. */
  function engancharFilasCb(s) {
    var t = $(SENTIDO[s].filas);
    t.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      var l = CB[s][Number(tr.getAttribute('data-i'))];
      if (e.target.classList.contains('tk-cant')) {
        var n = parseInt(e.target.value, 10);
        if (n >= 1 && n <= 999) l.cantidad = n; else avisar('err', 'La cantidad va de 1 a 999.');
      } else if (e.target.classList.contains('tk-precio')) {
        var c = leerPlata(e.target.value);
        var mal = isNaN(c) || c >= 10000000000 ? 'Ese precio no se entiende. Escribilo así: 20000 o 16.333,33' : precioMal(s, l, c);
        if (mal) avisar('err', mal);
        else { l.precio = c; l.propio = c !== l.lista; }
      }
      pintarCambio();
    });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('.tk-cant, .tk-precio')) { e.preventDefault(); e.target.blur(); $(SENTIDO[s].campo).focus(); }
    });
    t.addEventListener('click', function (e) {
      var b = e.target.closest('[data-quitar]');
      if (!b) return;
      CB[s].splice(Number(b.getAttribute('data-quitar')), 1);
      pintarCambio();
      $(SENTIDO[s].campo).focus();
    });
  }

  /* ── Lo que cambia cada vez ── */
  function pintarCambio() {
    if (!$('cbFilasV')) return;
    var k = cuentaCambio(CB), l0 = localDe(CB.local_id), li = listaPorId(CB.lista_id), n = 0, cobra = k.dif > 0;
    $('cbSubt').textContent = nombreLocal(l0) + ' · ' + (li ? li.nombre : '');
    $('cbRef').value = 'Al guardar';
    $('cbNeto').textContent = conSigno(k.dif);
    $('cbCant').textContent = k.cs - k.cv;
    $('cbTotal').textContent = conSigno(k.dif);
    $('cbTotCaja').classList.toggle('neg', k.dif < 0);
    /* La forma de pago, sólo si hay diferencia para cobrar. */
    $('cbForma').value = CB.forma;
    $('cbForma').disabled = !cobra;
    $('cbForma').title = cobra ? '' : 'Sin diferencia no se cobra nada';
    $('cbPagoX').querySelectorAll('input:not([readonly]), select').forEach(function (e) { e.disabled = !cobra; });
    var vuelto = $('cbVuelto');
    if (vuelto) vuelto.value = cobra && CB.pago.recibido && CB.pago.recibido >= k.dif ? plata(CB.pago.recibido - k.dif) : '';
    var av = $('cbPagoAviso');
    if (av) av.textContent = cobra && CB.forma === 'efectivo' && CB.pago.recibido && CB.pago.recibido < k.dif ? 'Lo recibido es menos que la diferencia.' : '';

    ['vuelve', 'sale'].forEach(function (s) {
      var x = SENTIDO[s], ls = CB[s], cant = 0, tot = 0;
      $(x.filas).innerHTML = ls.length ? ls.map(function (l, i) {
        n++;
        cant += l.cantidad;
        tot += l.precio * l.cantidad;
        var aj = l.lista != null && l.precio !== l.lista;
        return '<tr data-i="' + i + '"><td class="pos-num">' + ('00' + n).slice(-3) + '</td>' +
          '<td class="tk-cod">' + esc(l.codigo || '—') + '</td><td class="tk-desc">' + esc(l.descripcion) + (s === 'sale' ? pillStock(CB.local_id, l) : '') + '</td>' +
          '<td class="c">' + esc(l.talle || '') + '</td><td>' + esc(l.color_nom || l.color || '') + '</td>' +
          '<td class="c"><input type="number" class="tk-cant" min="1" max="999" value="' + l.cantidad + '" aria-label="Cantidad de ' + esc(l.descripcion) + '"></td>' +
          '<td class="n"><input type="text" inputmode="decimal" class="tk-precio' + (l.precio ? '' : ' sin') + '" value="' + plataCampo(l.precio) + '"' +
            (l.precio ? '' : ' placeholder="Sin precio"') + ' aria-label="Precio unitario de ' + esc(l.descripcion) + '">' +
            (aj ? '<small class="cb-lista">lista ' + plata(l.lista) + '</small>' : '') + '</td>' +
          '<td class="n"><b>' + plata(l.precio * l.cantidad) + '</b></td>' +
          '<td><button type="button" class="tk-quitar" data-quitar="' + i + '" title="Quitar" aria-label="Quitar ' + esc(l.descripcion) + '">' + icono('x') + '</button></td></tr>';
      }).join('') : '<tr class="tk-vacia"><td colspan="9">' + x.vacia + '</td></tr>';
      $(x.sub).innerHTML = ls.length ? cant + (cant === 1 ? ' prenda' : ' prendas') + ' · <b>' + plata(tot) + '</b>' : '';
    });

    /* Abajo a la derecha: si da negativo, por qué no se guarda y el botón para dejarlo en $0. */
    var nota = $('cbNota');
    if (k.dif < 0 && CB.sale.length) {
      nota.className = 'tk-nota cb-mal';
      nota.innerHTML = '<b>Lo que se lleva vale ' + plata(-k.dif) + ' menos que lo que vuelve.</b> Así no se guarda: no se devuelve plata. ' +
        'Que se lleve algo más, o dejalo en $0 (el cliente pierde la diferencia).' +
        '<button type="button" class="btn btn-sec btn-chico" id="cbCero" title="Sube el precio de lo que se lleva hasta que el cambio da $0">Dejar en $0</button>';
      $('cbCero').onclick = dejarEnCero;
    } else {
      nota.className = 'tk-nota';
      nota.innerHTML = enPrueba() ? '<b>Modo prueba:</b> el cambio numera aparte (CP-1, CP-2…), no cuenta para nada y se borra desde Cambios.' :
        CB.vuelve.length && !CB.sale.length ? '<b>Ahora, lo que se lleva:</b> dispará la pistola en «Productos salientes» (F2 pasa de un campo al otro).' :
        '<b>Como en BlueSoft:</b> lo que vuelve entra al precio de la lista de hoy, aunque lo haya comprado con promo. Si se lleva algo más caro, se cobra la diferencia y entra en el cierre de caja.';
    }
    guardarBorradorCb();
  }

  /* "Ajustamos el ticket para que dé cero" (Mauricio): sube el precio de lo que se lleva; lo que vuelve sigue a precio de lista. */
  function dejarEnCero() {
    var falta = -cuentaCambio(CB).dif, ls = CB.sale, l = null, i;
    if (falta <= 0 || !ls.length) return;
    for (i = ls.length - 1; i >= 0 && !l; i--) if (ls[i].cantidad === 1) l = ls[i];
    for (i = ls.length - 1; i >= 0 && !l; i--) if (falta % ls[i].cantidad === 0) l = ls[i];
    if (!l) { avisar('err', 'No se puede repartir justo entre las prendas: cambiá a mano el precio de lo que se lleva.'); return; }
    l.precio += falta / l.cantidad;
    l.propio = true;
    pintarCambio();
    avisar('ok', l.descripcion + ' quedó a ' + plata(l.precio) + ': el cambio da $0.');
  }

  function pintarHechoCb() {
    var u = S.cambioHecho, h = $('cbHecho');
    if (!h) return;
    h.innerHTML = u ? '<div class="pos-hecho' + (u.prueba ? ' prueba' : '') + '" role="status">' + icono('ok') + '<span>Cambio ' + esc(refCambio(u)) + ' guardado · ' +
      (u.diferencia ? 'se cobró ' + plata(u.diferencia) : 'sin diferencia') + (u.ya ? ' (ya estaba guardado: no se duplicó)' : '') +
      '</span><button type="button" id="cbVerUltimo">Ver</button></div>' : '';
    if (u) $('cbVerUltimo').onclick = function () { abrirCambio(u.id); };
  }

  /* ── Guardar ── */
  function itemCb(s, l) {
    return { sentido: s, codigo: l.codigo || '', descripcion: l.descripcion, talle: l.talle || '', color: l.color || '', cantidad: l.cantidad, precio: aPesos(l.precio) };
  }
  function guardarCambio() {
    if (S.guardando || !CB) return;
    var k = cuentaCambio(CB), cobra = k.dif > 0;
    var mal = !CB.local_id ? 'Elegí la sucursal.' :
      !CB.vendedor ? 'Elegí quién hace el cambio.' :
      !CB.vuelve.length ? 'Falta lo que vuelve: escaneá la prenda que trae el cliente (arriba).' :
      !CB.sale.length ? 'Falta lo que se lleva (abajo): en un cambio no se devuelve plata.' :
      CB.vuelve.concat(CB.sale).some(function (l) { return !l.precio; }) ? 'Hay una prenda sin precio: escribilo en «Precio unit.».' :
      k.dif < 0 ? 'Lo que se lleva vale ' + plata(-k.dif) + ' menos que lo que vuelve: así no se guarda. Que se lleve algo más, o tocá «Dejar en $0».' :
      cobra && CB.forma === 'tarjeta' && !CB.pago.tarjeta ? 'Elegí qué tarjeta es.' :
      cobra && CB.forma === 'efectivo' && CB.pago.recibido && CB.pago.recibido < k.dif ? 'Lo recibido en efectivo es menos que la diferencia.' : '';
    if (mal) { avisar('err', mal); return; }
    var p = {
      clave: CB.clave, prueba: enPrueba(), local_id: CB.local_id, vendedor: CB.vendedor, lista_id: CB.lista_id,
      cliente_nombre: String(CB.cliente || '').trim(), observaciones: CB.observaciones || '',
      items: CB.vuelve.map(function (l) { return itemCb('vuelve', l); }).concat(CB.sale.map(function (l) { return itemCb('sale', l); })),
      pagos: pagosDe(k.dif, CB).map(function (x) {
        var y = Object.assign({}, x, { monto: aPesos(x.monto) });
        if (y.recibido) y.recibido = aPesos(y.recibido); else delete y.recibido;
        return y;
      })
    };
    S.guardando = true;
    var b = $('cbGuardar');
    if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
    llamar('pos_cambio_guardar', { p: p }).then(function (r) {
      S.cambioHecho = { id: r.id, numero: r.numero, prueba: !!r.prueba, diferencia: cent(r.diferencia), ya: !!r.ya };
      S.stock = {};
      CB = cambioNuevo(CB);
      guardarBorradorCb();
      S.guardando = false;
      avisar('ok', 'Cambio ' + refCambio(S.cambioHecho) + ' guardado.');
      if (S.vista === 'cambio') verCambio();
    }).catch(function (e) {
      S.guardando = false;
      if (b && b.isConnected) { b.disabled = false; b.innerHTML = textoGuardarCb(); }
      if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo. El cambio sigue armado.'); persona.entrar(); return; }
      avisar('err', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
    });
  }

  /* ── El listado de cambios ── */
  function verCambios() {
    var c = $('cuerpo'), prueba = enPrueba();
    c.innerHTML = cabeza('Cambios' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), 'Los cambios de todas las sucursales: lo que vuelve y lo que se lleva.',
        '<button type="button" class="btn btn-sec btn-chico" id="cmBorrar" hidden>Borrar las pruebas</button>' +
        '<button type="button" class="btn btn-pri btn-chico" data-ir="cambio">Nuevo cambio</button>') +
      '<div class="pos-filtros"><div id="cmPer"></div>' +
        campo('', 'Sucursal', '<select id="cmLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        /* Los de verdad y los de prueba no se mezclan nunca; con el modo prueba prendido arranca en los de prueba. */
        campo('', 'Cambios', '<select id="cmPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="cmLista"><p class="cargando">Cargando…</p></div>';
    c.querySelector('[data-ir="cambio"]').onclick = function () { ir('cambio'); };
    var per = periodoPos($('cmPer'), { inicial: 'hoy', guardar: 'pos_cambios_periodo', hastaHoy: true, alCambiar: cargar });
    ['cmLocal', 'cmPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('cmBorrar').onclick = function () { borrarPruebas($('cmLocal').value, this, cargar); };
    var pedido = 0;
    function dePrueba() { return $('cmPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('cmLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('cmBorrar').hidden = !dePrueba();
      llamar('pos_cambios', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('cmLocal').value || null, p_prueba: dePrueba() }).then(function (d) {
        if (n !== pedido || !$('cmLista')) return;
        pintarLista(d);
      }).catch(function (e) { if ($('cmLista')) $('cmLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarLista(d) {
      var t = d.totales || {};
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Cambios</span><b>' + (t.cambios || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Prendas que volvieron</span><b>' + (t.vuelven || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Prendas que salieron</span><b>' + (t.salen || 0) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>Diferencia cobrada</span><b>' + plata(cent(t.diferencia || 0)) + '</b></div>' +
        (t.anulados ? '<div class="pos-kpi"><span>Anulados</span><b>' + t.anulados + '</b></div>' : '') + '</div>' +
        (dePrueba() ? '<div class="pos-cartel prueba">Los cambios de <b>prueba</b>: no cuentan para nada. «Borrar las pruebas» los borra' +
          ($('cmLocal').value ? ' (los de esa sucursal)' : ' todos') + ', con las ventas de prueba.</div>' : '');
      if (!d.filas || !d.filas.length) {
        $('cmLista').innerHTML = kpis + '<div class="pos-cartel">' + (dePrueba() ? 'No hay cambios de prueba en ese período.' : 'No hay cambios en ese período.') + '</div>';
        return;
      }
      $('cmLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th class="n">Referencia</th><th>Sucursal</th><th>Vendedor</th>' +
        '<th>Cliente</th><th>Vuelve</th><th>Se lleva</th><th>Forma de pago</th><th>Estado</th><th class="n">Diferencia</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var an = f.estado === 'anulado', clases = (an ? 'anulada ' : '') + (f.prueba ? 'prueba' : '');
          return '<tr data-cambio="' + esc(f.id) + '" tabindex="0"' + (clases.trim() ? ' class="' + clases.trim() + '"' : '') + '><td>' + esc(fechaHora(f.fecha)) + '</td>' +
            '<td class="n">' + esc(refCambio(f)) + '</td><td>' + esc(bonito(f.local)) + '</td><td>' + esc(f.vendedor) + '</td><td>' + esc(f.cliente) + '</td>' +
            '<td class="cb-que">' + esc(f.vuelven || '') + '</td><td class="cb-que">' + esc(f.salen || '') + '</td>' +
            '<td>' + esc((f.medios || []).map(function (m) { return MEDIOS_VENTA[m] || m; }).join(' + ') || '—') + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Hecho</span>') + '</td>' +
            '<td class="n tachar"><b>' + plata(cent(f.diferencia)) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
      $('cmLista').querySelectorAll('tr[data-cambio]').forEach(function (tr) {
        tr.onclick = function () { abrirCambio(tr.getAttribute('data-cambio'), cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /* ── Un cambio guardado: verlo y anularlo (sólo mientras la caja está abierta) ── */
  function abrirCambio(id, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">Cambio</h3><p class="cargando">Cargando…</p>', true);
    var dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_cambio', { p_id: id }).then(function (t) {
      if (!_velo || !caja.isConnected) return;
      var an = t.estado === 'anulado', p = function (n) { return plata(cent(n || 0)); };
      var pagos = (t.pagos || []).map(function (g) {
        var x = MEDIOS[g.medio] || g.medio;
        if (g.medio === 'tarjeta') x += ' ' + (g.tarjeta || '') + (g.cuotas > 1 ? ' · ' + g.cuotas + ' cuotas' : '');
        if (g.cupon) x += ' · ' + (g.medio === 'tarjeta' ? 'cupón ' : 'op. ') + g.cupon;
        if (g.recibido) x += ' · recibido ' + p(g.recibido) + ', vuelto ' + p(g.vuelto);
        return '<li>' + esc(x) + ' — <b>' + p(g.monto) + '</b></li>';
      }).join('');
      function filas(s, titulo) {
        return '<tr class="cb-sep"><td colspan="8">' + titulo + '</td></tr>' + (t.items || []).filter(function (i) { return i.sentido === s; }).map(function (i) {
          var aj = i.precio_lista != null && Number(i.precio_lista) !== Number(i.precio);
          return '<tr><td>' + ('00' + i.item).slice(-3) + '</td><td>' + esc(i.codigo || '—') + '</td><td>' + esc(i.descripcion) + '</td><td class="c">' + esc(i.talle || '') + '</td>' +
            '<td>' + esc(i.color ? nombreColor(i.color, i.codigo) : '') + '</td><td class="c">' + i.cantidad + '</td>' +
            '<td class="n">' + p(i.precio) + (aj ? '<small class="cb-lista">lista ' + p(i.precio_lista) + '</small>' : '') + '</td><td class="n">' + p(i.total) + '</td></tr>';
        }).join('');
      }
      dentro.innerHTML = '<h3 id="posVentTit">Cambio ' + esc(refCambio(t)) + ' ' +
          (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Hecho</span>') +
          (t.prueba ? ' <span class="pill pill-warn">Prueba</span>' : '') + '</h3>' +
        (t.prueba ? '<div class="pos-cartel prueba">Es un cambio de prueba: no cuenta para nada y se borra con «Borrar las pruebas».</div>' : '') +
        '<div class="pos-ticket-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(t.fecha)) + '</div>' +
          '<div><span>Sucursal</span>' + esc(bonito(t.local)) + '</div>' +
          '<div><span>Vendedor</span>' + esc(t.vendedor) + '</div>' +
          '<div><span>Cargó</span>' + esc(t.cargado_por_nombre || '—') + '</div>' +
          '<div><span>Cliente</span>' + esc(t.cliente_nombre || 'Consumidor final') + '</div>' +
          '<div><span>Lista de precios</span>' + esc(t.lista || '—') + '</div>' +
          '<div><span>Caja</span>' + (t.cierre ? 'Entró en el cierre ' + esc(refCierre(t.cierre)) : 'Abierta (todavía no se cerró)') + '</div>' +
        '</div>' +
        '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Ítem</th><th>Código</th><th>Descripción</th><th class="c">Talle</th><th>Color</th><th class="c">Cant.</th>' +
          '<th class="n">Precio unit.</th><th class="n">Total</th></tr></thead><tbody>' +
          filas('vuelve', 'Vuelve (productos entrantes)') + filas('sale', 'Se lleva (productos salientes)') + '</tbody></table></div>' +
        '<div class="pos-ticket-tot"><span>Vuelve ' + p(t.vuelve) + ' · Se lleva ' + p(t.se_lleva) + '</span><b>Diferencia ' + p(t.diferencia) + '</b></div>' +
        (pagos ? '<p class="pos-lbl" style="margin:10px 0 4px">Se cobró</p><ul style="margin:0;padding-left:18px;font-size:14px;display:grid;gap:3px">' + pagos + '</ul>' : '') +
        (t.observaciones ? '<p style="font-size:14px;margin:10px 0 0"><b>Observaciones:</b> ' + esc(t.observaciones) + '</p>' : '') +
        (an ? '<div class="pos-cartel mal" style="margin-top:12px">Anulado el ' + esc(fechaHora(t.anulado_en)) + (t.anulado_por_nombre ? ' por ' + esc(t.anulado_por_nombre) : '') + ': ' + esc(t.anulado_motivo || '') + '</div>' :
          t.cierre ? '<div class="pos-cartel" style="margin-top:12px">Ya entró en el cierre ' + esc(refCierre(t.cierre)) + ': para anularlo, hay que anular el cierre.</div>' : '') +
        '<div id="cbAnular"></div>' +
        '<div class="pos-pie">' + (an || t.cierre || !puede('anular') ? '' : '<button type="button" class="btn btn-sec btn-chico izq" id="cbAnularBtn">Anular el cambio</button>') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var ab = dentro.querySelector('#cbAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        pedirMotivo(dentro.querySelector('#cbAnular'), 'El cambio queda en la lista, tachado, con quién lo anuló y por qué' +
            (Number(t.diferencia) ? ', y lo que se cobró sale de la caja' : '') + '.' +
            (t.prueba ? '' : ' El stock vuelve a como estaba: lo que volvió sale y lo que se llevó vuelve.') + ' No se puede deshacer.', 'Anular el cambio ' + refCambio(t), function (motivo) {
          return llamar('pos_cambio_anular', { p_id: t.id, p_motivo: motivo }).then(function () {
            S.stock = {};
            avisar('ok', 'El cambio ' + refCambio(t) + ' quedó anulado.');
            if (alCambiar) alCambiar();
            abrirCambio(t.id, alCambiar);
          });
        });
      };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Cambio</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     EL CIERRE DE CAJA (SQL 149)
     Mauricio (21/10, "dalee"): los pasos de BlueSoft, pero primero se cuenta
     y recién después se ve cuánto tendría que haber; el pase a la caja
     fuerte va adentro del cierre, y los gastos de la caja chica se cargan
     ahí mismo. "Resultados del día" a la derecha, como en BlueSoft.
     SQL 175 (25/10): todo A LA VISTA, como en BlueSoft. Él: "usamos el
     cierre de caja para hacer un arqueo… a las 5 cambia… vemos ahí qué
     importe nos da todo para poder controlar las tarjetas, el efectivo".
     El arqueo es abrir el cierre y mirar; contar sigue quedando anotado. Y a
     todo el alto ("que ocupen toda la pantalla, bien distribuido"): los
     pasos a lo largo de la columna y los resultados hasta abajo. Sin el 175
     corrido, la base no manda el efectivo y queda como antes (a ciegas).
     26/10: los gastos ya no se cargan acá sino en su sección (verGastos), como
     en BlueSoft. "Gastos en efectivo" muestra cuáles entran en este cierre.
     26/10 (SQL 180): sin el Paso 2 de BlueSoft ("Ingresá el efectivo que pasa
     a la caja fuerte"), que no usaban: eso se pasa antes, en Movimientos de
     salida (verSalidas), y se cuenta lo que queda. Los pasos son dos: contar
     y cerrar. "A la caja fuerte" muestra los pases que entran en este cierre.
     29/10 (SQL 191): los retiros de fondos de la caja chica también se restan,
     con su renglón (sólo si hay, para que el cierre siga entrando en la PC del
     local); los de la caja fuerte no son de esta caja.
     ════════════════════════════════════════════════════════════════════ */
  var TIPOS_MOV = { gasto: 'Gasto del local', salida: 'Otra salida', ingreso: 'Otro ingreso', caja_fuerte: 'A la caja fuerte', retiro: 'Retiro de fondos' };
  var CAJAS = { chica: 'Caja chica', fuerte: 'Caja fuerte' };
  /* Los tipos de gasto de BlueSoft ("Gasto nuevo" → Tipo de gasto). */
  var RUBROS_GASTO = [
    ['Del local', ['Artículos de limpieza', 'Bidones de agua', 'Cámara de seguridad', 'Gas', 'Internet', 'Limpieza', 'Llave locales', 'Luz',
                   'Mantenimiento del local', 'Municipal o ABL', 'Rentas', 'Seguridad e higiene', 'Teléfono', 'Vidrierista', 'Alarma y monitoreo']],
    ['Empleados', ['Cargas sociales', 'Comida por horas extras', 'Sueldo básico', 'Sueldo comisiones', 'Vales para empleados']],
    ['Comercialización y otros', ['Gestor', 'Imprenta', 'Impuesto de publicidad y propaganda', 'Informática', 'Publicidad',
                                  'Repartidor de volantes', 'Software', 'Otros artículos', 'Varios de comercialización']]
  ];
  var OCULTO = '<i class="cj-oculto" title="Se ve después de contar el efectivo (Paso 1)">' + icono('candado') + 'al contar</i>';

  function refCierre(c) { return (c.prueba ? 'P-' : 'Nº ') + c.numero; }
  /** El número del movimiento, para escribirlo en el ticket que se guarda con la caja (SQL 179): G-12 el gasto, o GP-3 el de prueba;
      MS-4 lo que pasó a la caja fuerte, o MSP-1 (SQL 180, otro talonario); RF-2 el retiro de fondos, o RFP-1 (SQL 191, otro más). Sin el 179, nada. */
  function refGasto(m, prueba) {
    if (!m || !m.numero) return '';
    return (m.tipo === 'caja_fuerte' ? 'MS' : m.tipo === 'retiro' ? 'RF' : 'G') + ((prueba != null ? prueba : m.prueba) ? 'P-' : '-') + m.numero;
  }
  /** Lo que tendría que haber en la caja chica, en centavos: la misma cuenta que pos_caja_contar (sin el 180, a_caja_fuerte no viene; sin el 191, retiros_fondos). */
  function esperadoCaja(d, saldo) {
    return saldo + cent(d.ventas.efectivo) + cent(d.otros_ingresos) - cent(d.gastos) - cent(d.otras_salidas) - cent(d.a_caja_fuerte || 0) - cent(d.retiros_fondos || 0);
  }
  /** Sin el SQL 191 la base no conoce los retiros ni el tilde: lo dice así, y no con el mensaje de la base. */
  function sin191(e) {
    var m = mensajeDe(e);
    return /Ese tipo de movimiento no existe|otro ingreso o un pase a la caja fuerte\.|SQL 191/.test(m) ?'Los retiros de fondos todavía no están en la base: falta correr el SQL 191.' : m;
  }
  /* SQL 191: el tilde «Controlado» de la oficina, en los movimientos de salida y en los retiros. Mauricio (29/10): "yo después voy a
     caja fuerte, veo los montos que los chicos agregaron a la caja fuerte y tienen que coincidir con lo que hay en el sistema".
     Lo tilda sólo Administración; los demás lo ven. Los pases del Paso 2 de los cierres de antes no tienen tilde. */
  function celdaControlado(f) {
    if (f.origen === 'cierre' || (f.tipo !== 'caja_fuerte' && f.tipo !== 'retiro')) return '<td></td>';
    var t = f.controlado ? 'Controlado' + (f.controlado_por ? ' por ' + f.controlado_por : '') + (f.controlado_en ? ', ' + fechaHora(f.controlado_en) : '') : 'Sin controlar';
    return '<td class="c"><input type="checkbox" class="mv-ctl" data-ctl="' + esc(f.id) + '"' + (f.controlado ? ' checked' : '') +
      (puede('gestion') && f.estado === 'ok' ? '' : ' disabled') + ' title="' + esc(t) + '" aria-label="Controlado"></td>';
  }
  /** Los tildes de una lista: tildar o sacar el tilde, y volver a cargarla (cambia el total controlado). */
  function tildesControlado(host, alCambiar) {
    host.querySelectorAll('input.mv-ctl').forEach(function (cb) {
      cb.onclick = function (e) { e.stopPropagation(); };
      cb.onkeydown = function (e) { e.stopPropagation(); };
      cb.onchange = function () {
        var si = cb.checked;
        cb.disabled = true;
        llamar('pos_caja_mov_controlar', { p_id: cb.getAttribute('data-ctl'), p_si: si }).then(function () {
          avisar('ok', si ? 'Listo: quedó controlado.' : 'Listo: le sacaste el tilde.');
          alCambiar();
        }).catch(function (e) { cb.checked = !si; cb.disabled = false; avisar('err', sin191(e)); });
      };
    });
  }
  /** El desvío en palabras. En centavos; positivo = falta plata (como en Supervisión → Cajas). */
  function desvioDe(dv, tol) {
    var a = Math.abs(dv);
    if (!dv) return { cls: 'ok', txt: 'Cuadra justo', corto: 'Cuadra' };
    if (a <= tol) return { cls: 'ok', txt: 'Cuadra (' + (dv > 0 ? 'faltan ' : 'sobran ') + plata(a) + ')', corto: (dv > 0 ? '−' : '+') + plata(a) };
    return dv > 0 ? { cls: 'mal', txt: 'Faltan ' + plata(a), corto: 'Faltan ' + plata(a) } : { cls: 'warn', txt: 'Sobran ' + plata(a), corto: 'Sobran ' + plata(a) };
  }
  function recordarLocal(id) { var r = recuerdo(); r.local = id; guardarJSON(K_RECUERDO, r); }
  function filaRes(lbl, valor, cls) { return '<div class="cj-r' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + valor + '</b></div>'; }
  function opcionesLocales(actual) { return opciones(localesMios().map(function (l) { return [l.id, nombreLocal(l)]; }), actual); }
  /** Todos los locales, aunque no sean suyos: a dónde va un envío. */
  function opcionesTodos(actual) { return opciones(S.ini.locales.map(function (l) { return [l.id, nombreLocal(l)]; }), actual); }

  /** El "¿por qué se anula?" adentro de una ventana: hacer(motivo) devuelve la promesa del pedido. */
  function pedirMotivo(z, aviso, textoBoton, hacer) {
    z.innerHTML = '<div class="pos-cartel" style="margin-top:12px">' + aviso +
      campo('', '¿Por qué se anula?', '<textarea id="pmMotivo" maxlength="300" rows="2"></textarea>') + '<div class="pos-error" id="pmError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="pmConfirmar">' + esc(textoBoton) + '</button></div></div>';
    var m = z.querySelector('#pmMotivo');
    m.focus();
    z.querySelector('#pmConfirmar').onclick = function () {
      var motivo = m.value.trim(), bt = this;
      if (!errorEn(z, 'pmError', motivo.length < 3 ? 'Escribí por qué se anula.' : '')) return;
      bt.disabled = true;
      hacer(motivo).catch(function (e) { bt.disabled = false; errorEn(z, 'pmError', mensajeDe(e)); });
    };
  }

  function verCierre() {
    var c = $('cuerpo'), prueba = enPrueba();
    var l = localMio(S.cajaLocal) || localInicial();
    S.cajaLocal = l.id;
    /* d: la caja abierta (con el efectivo desde el SQL 175); k: lo que devolvió el conteo (con lo que tendría que haber y la diferencia). */
    var K = { d: null, k: null, clave: nuevaClave() }, pedido = 0;
    c.classList.add('lleno');
    c.innerHTML = cabeza('Cierre de caja' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), '<span id="cjSub">Cargando…</span>',
        '<div id="cjHecho"></div>' +
        (puede('gestion') ? '<a class="btn btn-sec btn-chico" href="gestion.html#cierres" title="Los cierres anteriores, en Gestión">Ver los cierres</a>' : '')) +
      '<div class="cj">' +
        '<section class="cj-izq" aria-label="Los pasos del cierre">' +
          '<div class="tk-datos cj-datos">' +
            campo('c3', 'Fecha', '<input type="text" id="cjFecha" readonly>') +
            campo('c5', 'Sucursal', '<select id="cjLocal" class="desplegable">' + opcionesLocales(l.id) + '</select>') +
            campo('c4', 'Número', '<input type="text" id="cjNum" readonly title="Uno seguido por sucursal">') +
            campo('c4', 'Caja', '<input type="text" value="Caja chica" readonly>') +
            campo('c8', 'Responsable', '<input type="text" id="cjResp" readonly title="Quien entró al POS">') +
          '</div>' +
          '<div class="cj-paso" id="cjPaso1"><div class="cj-paso-cab"><b>Paso 1</b><span>Ingresá el total de efectivo que hay en el local</span></div>' +
            '<div class="cj-fila"><div class="cj-saldo" id="cjSaldoIni"></div>' +
              campo('cj-monto', 'Total efectivo', '<input type="text" inputmode="decimal" id="cjContado" autocomplete="off" placeholder="$0">') +
              '<button type="button" class="btn btn-pri btn-chico" id="cjContar">Ver la cuenta</button></div>' +
            '<div class="cj-cuenta" id="cjCuenta" aria-live="polite"></div></div>' +
          '<div class="cj-paso" id="cjPaso2"><div class="cj-paso-cab"><b>Paso 2</b><span id="cjPaso2Txt"></span></div>' +
            campo('', 'Observaciones', '<textarea id="cjObs" maxlength="500" rows="2"></textarea>', ' id="cjObsL"') +
            '<div class="cj-fin"><p class="cj-queda" id="cjQueda"></p>' +
              '<div class="cj-botones"><button type="button" class="btn btn-sec btn-chico" id="cjCancelar">Cancelar</button>' +
                '<button type="button" class="btn btn-pri btn-chico" id="cjCerrar">Cerrar caja</button></div></div></div>' +
        '</section>' +
        '<aside class="cj-res" id="cjRes" aria-label="Resultados del día"><p class="cargando">Cargando…</p></aside>' +
      '</div>';

    function cargar() {
      var n = ++pedido;
      K.k = null;
      pintarPasos();
      llamar('pos_caja', { p_local: S.cajaLocal, p_prueba: prueba }).then(function (d) {
        if (n !== pedido || !$('cjRes')) return;
        K.d = d;
        pintarTodo();
      }).catch(function (e) {
        if (n !== pedido || !$('cjRes')) return;
        $('cjRes').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
        $('cjSub').textContent = '';
      });
    }
    function pintarTodo() {
      var d = K.d, saldo = $('cjSaldo') ? $('cjSaldo').value : '';
      $('cjFecha').value = fechaCorta(d.dia);
      $('cjNum').value = (prueba ? 'P-' : '') + d.numero;
      $('cjResp').value = d.responsable || '';
      /* En el modo prueba lo dice acá y no en un cartel: con el cartel, el cierre no entra en la PC del local. */
      $('cjSub').textContent = (prueba ? 'Caja de prueba: sólo las ventas de prueba. ' : '') + (d.primer
        ? 'El primer cierre de ' + nombreLocal(localDe(S.cajaLocal)) + ' en el POS: toma las ventas de hoy.'
        : 'La caja está abierta desde el cierre ' + refCierre({ prueba: prueba, numero: d.ultimo.numero }) + ' (' + fechaHora(d.ultimo.fecha) + ').');
      /* El primer cierre no tiene de dónde sacar el saldo inicial: lo escriben (con cuánto arrancó la caja). */
      $('cjSaldoIni').innerHTML = d.primer ? campo('cj-monto', 'Saldo inicial', '<input type="text" inputmode="decimal" id="cjSaldo" autocomplete="off" placeholder="$0" title="Con cuánto efectivo arrancó la caja (el cambio)">') : '';
      /* Lo que tendría que haber cambia mientras escriben el saldo inicial. */
      if ($('cjSaldo')) { $('cjSaldo').value = saldo; $('cjSaldo').oninput = function () { if (K.k) olvidarCuenta(); else pintarPasos(); }; }
      pintarHecho();
      pintarPasos();
    }
    function pintarHecho() {
      var h = S.cajaHecho, z = $('cjHecho');
      if (!h || h.local !== S.cajaLocal || h.prueba !== prueba) { z.innerHTML = ''; return; }
      var dv = desvioDe(h.desvio, h.tol);
      z.innerHTML = '<div class="pos-hecho' + (h.prueba ? ' prueba' : '') + '">' + icono('ok') + '<span>Cierre ' + esc(refCierre(h)) + ' guardado · ' + esc(dv.corto) +
        ' · quedan ' + plata(h.queda) + '</span><button type="button" id="cjVerHecho">Ver</button></div>';
      $('cjVerHecho').onclick = function () { abrirCierre(h.id, function () { S.cajaHecho = null; if (S.vista === 'cierre') verCierre(); }); };
    }
    /* SQL 175: la base manda el efectivo desde que se abre el cierre. Sin el 175, recién al contar (como antes). */
    function aLaVista() { return !!K.d && K.d.ventas.efectivo != null; }
    /** El saldo inicial escrito en el Paso 1 (el primer cierre del local), en centavos; vacío = 0, mal escrito = NaN. */
    function saldoEscrito() { var t = $('cjSaldo') ? $('cjSaldo').value.trim() : ''; return t ? leerPlata(t) : 0; }
    /** Lo que tendría que haber en efectivo, en centavos: la misma cuenta que pos_caja_contar. */
    function esperadoHoy() {
      var d = K.d, s = d.primer ? saldoEscrito() : cent(d.saldo_inicial || 0);
      return esperadoCaja(d, isNaN(s) ? 0 : s);
    }
    /** Los gastos (false), los pases a la caja fuerte (true) o los retiros de la caja chica ('retiros', SQL 191) de esta caja, cada uno con su botón en los resultados. */
    function movsDe(que) {
      var k = que === true ? 'caja_fuerte' : que === 'retiros' ? 'retiro' : '';
      return ((K.d && K.d.movimientos) || []).filter(function (m) { return k ? m.tipo === k : m.tipo !== 'caja_fuerte' && m.tipo !== 'retiro'; });
    }
    /* Los resultados: con todo a la vista (SQL 175); sin el 175, el efectivo recién después de contar. */
    function pintarRes() {
      var d = K.d, k = K.k;
      if (!d) return;
      var x = k || d, v = x.ventas, p = function (n) { return plata(cent(n || 0)); }, vista = aLaVista();
      var nm = movsDe(false).length, nf = movsDe(true).length, nr = movsDe('retiros').length, nc = Number(x.cambios) || 0;
      /* SQL 191: el renglón de los retiros sólo si hay; entonces los descuentos pasan al pie (con un renglón más, el cierre no entra en la PC del local). */
      var conRet = !!(nr || cent(x.retiros_fondos || 0));
      var saldo = !d.primer ? p(d.saldo_inicial) : k ? p(k.saldo_inicial) :
        vista && $('cjSaldo') && $('cjSaldo').value.trim() && !isNaN(saldoEscrito()) ? plata(saldoEscrito()) : '<i class="cj-oculto">en el Paso 1</i>';
      $('cjRes').innerHTML = '<h3 class="cj-res-tit">Resultados del día</h3>' +
        filaRes('Saldo inicial', saldo, 'fuerte') +
        filaRes('Ventas Tarjeta', p(v.tarjeta)) +
        filaRes('Ventas Transferencia', p(v.transferencia)) +
        filaRes('Ventas Efectivo', k || vista ? p(v.efectivo) : OCULTO) +
        filaRes('Ventas Mercado Pago', p(v.mercadopago)) +
        filaRes('Ventas MODO', p(v.modo)) +
        filaRes('Ventas Go Cuotas', p(v.go_cuotas)) +
        filaRes('Ventas totales del día', k || vista ? p(x.ventas_total) : OCULTO, 'barra') +
        '<button type="button" class="cj-r cj-r-btn" id="cjMovs" title="Ver los gastos que entran en este cierre"><span>Gastos en efectivo' +
          (nm ? ' (' + nm + ')' : '') + '</span><b>' + p(x.gastos) + '</b></button>' +
        filaRes('Otras salidas', p(x.otras_salidas)) +
        '<button type="button" class="cj-r cj-r-btn" id="cjFuerte" title="Ver lo que pasó a la caja fuerte desde el último cierre"><span>A la caja fuerte' +
          (nf ? ' (' + nf + ')' : '') + '</span><b>' + p(x.a_caja_fuerte) + '</b></button>' +
        (conRet ? '<button type="button" class="cj-r cj-r-btn" id="cjRetiros" title="Ver los retiros de fondos de la caja chica desde el último cierre"><span>Retiros de fondos' +
          (nr ? ' (' + nr + ')' : '') + '</span><b>' + p(x.retiros_fondos) + '</b></button>' : filaRes('Descuentos', p(x.descuentos), 'info')) +
        filaRes('Otros ingresos', p(x.otros_ingresos)) +
        filaRes('Saldo final en efectivo', k ? p(k.esperado) : vista ? plata(esperadoHoy()) : OCULTO, 'barra') +
        /* Los cambios van en el pie y no en un renglón: con uno más, el cierre no entra en la PC del local. */
        '<p class="cj-res-pie">' + x.tickets + (Number(x.tickets) === 1 ? ' ticket' : ' tickets') +
          (nc ? ' y ' + nc + (nc === 1 ? ' cambio' : ' cambios') + (k || vista ? ' (se cobró ' + p(x.cambios_diferencia) + ', ya sumado en las ventas)' : '') : '') +
          (cent((d.ventas || {}).giftcard || 0) ? '. Pagado con gift card: ' + p(d.ventas.giftcard) + ', ya sumado en las ventas' : '') +   // SQL 200: no es efectivo
          (conRet ? '. Descuentos: ' + p(x.descuentos) + ', ya restados de las ventas.</p>' : '. Los descuentos ya están restados de las ventas.</p>');
      $('cjMovs').onclick = function () { abrirMovsCaja(false); };
      $('cjFuerte').onclick = function () { abrirMovsCaja(true); };
      if ($('cjRetiros')) $('cjRetiros').onclick = function () { abrirMovsCaja('retiros'); };
    }
    /* Lo que tendría que haber, grande en el Paso 1 (el número del arqueo), con de dónde sale. */
    function tendria() {
      var d = K.d, s = d.primer ? saldoEscrito() : cent(d.saldo_inicial || 0);
      var partes = ['Saldo inicial ' + plata(isNaN(s) ? 0 : s), '+ ventas en efectivo ' + plata(cent(d.ventas.efectivo))];
      if (cent(d.otros_ingresos)) partes.push('+ otros ingresos ' + plata(cent(d.otros_ingresos)));
      if (cent(d.gastos)) partes.push('− gastos ' + plata(cent(d.gastos)));
      if (cent(d.otras_salidas)) partes.push('− otras salidas ' + plata(cent(d.otras_salidas)));
      if (cent(d.a_caja_fuerte || 0)) partes.push('− a la caja fuerte ' + plata(cent(d.a_caja_fuerte)));
      if (cent(d.retiros_fondos || 0)) partes.push('− retiros de fondos ' + plata(cent(d.retiros_fondos)));
      return '<div class="cj-tendria"><span>Tendría que haber en efectivo</span><b>' + plata(esperadoHoy()) + '</b>' +
        '<small>' + esc(partes.join(' ')) + '</small></div>';
    }
    function pintarPasos() {
      var k = K.k, hay = !!k;
      $('cjPaso2').classList.toggle('apagado', !hay);
      $('cjObs').disabled = !hay;
      $('cjCerrar').disabled = !hay;
      /* El arqueo del cambio de turno se cuenta igual, pero no se cierra: «Cancelar». */
      $('cjPaso2Txt').textContent = hay ? 'Cerrá la caja (si era un arqueo, «Cancelar»)' : 'Primero contá el efectivo (Paso 1)';
      var obsL = $('cjObsL').firstChild;
      if (!hay) {
        var n = K.d ? Number(K.d.conteos) : 0, ya = n ? 'Esta caja ya se contó ' + (n === 1 ? 'una vez' : n + ' veces') + ': cada conteo queda anotado.' : '';
        /* Lo de la caja fuerte se pasa antes de contar (SQL 180): si todavía no pasaron nada, se lo recuerda. */
        var antes = movsDe(true).length ? '' : 'Lo de la caja fuerte se pasa antes, en <a href="#salidas">Movimientos de salida</a>. ';
        $('cjCuenta').innerHTML = aLaVista()
          ? '<p class="pos-ayuda">Contá la plata del cajón, escribila y tocá «Ver la cuenta»: te dice si cuadra. ' + antes + (ya || 'Cada conteo queda anotado.') + '</p>' + tendria()
          : '<p class="pos-ayuda">' + (ya || 'Contá la plata del cajón y escribila. Recién ahí se ve cuánto tendría que haber.') + '</p>';
        obsL.textContent = 'Observaciones';
        $('cjQueda').innerHTML = '';
      } else {
        var dv = desvioDe(cent(k.desvio), cent(k.tolerancia));
        $('cjCuenta').innerHTML = '<div class="cj-dif ' + dv.cls + '"><b>' + esc(dv.txt) + '</b><span>Tendría que haber ' + plata(cent(k.esperado)) +
          ' y contaste ' + plata(cent(k.contado)) + '.' + (k.conteos > 1 ? ' Se contó ' + k.conteos + ' veces.' : '') + '</span></div>';
        obsL.textContent = dv.cls === 'ok' ? 'Observaciones' : 'Observaciones: ¿por qué ' + (cent(k.desvio) > 0 ? 'falta' : 'sobra') + '?';
        /* Lo que contaron queda en la caja chica: lo de la caja fuerte ya salió antes. */
        $('cjQueda').innerHTML = 'Queda en la caja chica: <b>' + plata(cent(k.contado)) + '</b><small>Es el saldo inicial del próximo cierre.</small>';
      }
      pintarRes();
    }
    /* Si cambian lo contado (o el saldo inicial) después de ver la cuenta, hay que volver a contar. */
    function olvidarCuenta() { if (K.k) { K.k = null; pintarPasos(); } }

    function contar() {
      if (!K.d) return;
      var cont = leerPlata($('cjContado').value);
      if (isNaN(cont)) { avisar('err', 'Escribí cuánto efectivo hay en el local.'); $('cjContado').focus(); return; }
      var saldo = null;
      if (K.d.primer) {
        var st = $('cjSaldo').value.trim();
        saldo = st ? leerPlata(st) : 0;
        if (isNaN(saldo)) { avisar('err', 'El saldo inicial no es un número.'); $('cjSaldo').focus(); return; }
      }
      var b = $('cjContar');
      b.disabled = true;
      llamar('pos_caja_contar', { p_local: S.cajaLocal, p_prueba: prueba, p_contado: aPesos(cont), p_saldo_inicial: saldo === null ? null : aPesos(saldo) }).then(function (k) {
        b.disabled = false;
        if (!$('cjRes')) return;
        K.k = k;
        K.d.conteos = k.conteos;
        pintarPasos();
        /* Si cuadra, queda a un Enter de cerrar; si no, en Observaciones, para escribir por qué. */
        (desvioDe(cent(k.desvio), cent(k.tolerancia)).cls === 'ok' ? $('cjCerrar') : $('cjObs')).focus();
      }).catch(function (e) { b.disabled = false; avisar('err', mensajeDe(e)); });
    }

    function cerrar() {
      var k = K.k;
      if (!k || S.guardando) return;
      var obs = $('cjObs').value.trim(), dv = desvioDe(cent(k.desvio), cent(k.tolerancia));
      if (dv.cls !== 'ok' && !obs && !confirm(dv.txt + ' y no escribiste nada en Observaciones. ¿Cerrar la caja igual?')) { $('cjObs').focus(); return; }
      S.guardando = true;
      var b = $('cjCerrar');
      b.disabled = true;
      b.textContent = 'Cerrando…';
      /* Sin retiro: lo de la caja fuerte ya salió en Movimientos de salida (SQL 180). */
      llamar('pos_caja_cerrar', { p: { clave: K.clave, local_id: S.cajaLocal, prueba: prueba, contado: k.contado, observaciones: obs } }).then(function (x) {
        S.guardando = false;
        S.cajaHecho = { id: x.id, numero: x.numero, prueba: !!x.prueba, desvio: cent(x.desvio), queda: cent(x.queda), local: S.cajaLocal, tol: cent(k.tolerancia) };
        avisar('ok', 'Caja cerrada: cierre ' + refCierre(x) + '.');
        if (S.vista === 'cierre') verCierre();
      }).catch(function (e) {
        S.guardando = false;
        if (b.isConnected) { b.disabled = false; b.textContent = 'Cerrar caja'; }
        if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo.'); persona.entrar(); return; }
        avisar('err', esDeRed(e) ? 'No se pudo cerrar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
        /* SQL 180: entró o salió plata después de contar (una venta, un gasto, un pase a la caja fuerte): la cuenta nueva, y a contar de nuevo. */
        if (!esDeRed(e) && /contá de nuevo/.test(mensajeDe(e)) && $('cjRes')) { $('cjContado').value = ''; cargar(); $('cjContado').focus(); }
      });
    }

    /* Los gastos (o los pases a la caja fuerte, o los retiros de la caja chica) que entran en este cierre, para mirarlos. Se cargan
       y se anulan en Gastos, en Movimientos de salida (26/10) y en Retiros de fondos (SQL 191). */
    function abrirMovsCaja(que) {
      var fuerte = que === true, ret = que === 'retiros', ms = movsDe(que), de = esc(nombreLocal(localDe(S.cajaLocal)));
      ventana('<h3 id="posVentTit">' + (fuerte ? 'A la caja fuerte' : ret ? 'Retiros de fondos' : 'Gastos de la caja') + '</h3><p class="pos-bajada">' + (fuerte
          ? 'Lo que pasó de la caja chica a la caja fuerte de ' + de + ' desde el último cierre: se resta en este. Se carga y se anula en «Movimientos de salida».'
          : ret ? 'Lo que se retiró de la caja chica de ' + de + ' desde el último cierre: se resta en este. Se carga y se anula en «Retiros de fondos».'
          : 'Los de ' + de + ' desde el último cierre: entran en este. Se cargan y se anulan en «Gastos».') + '</p>' +
        (ms.length ? '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Hora</th>' + (fuerte ? '' : ret ? '<th>Lo retiró</th>' : '<th>Qué es</th>') +
          '<th>' + (fuerte || ret ? 'Observaciones' : 'Detalle') + '</th><th>Cargó</th><th class="n">Monto</th></tr></thead><tbody>' +
          ms.map(function (x) {
            return '<tr><td><b>' + esc(refGasto(x, prueba) || '—') + '</b></td><td>' + esc(fechaHora(x.fecha)) + '</td>' +
              (fuerte ? '' : '<td>' + esc(ret ? x.retira || '—' : TIPOS_MOV[x.tipo] || x.tipo) + '</td>') +
              '<td>' + esc([x.rubro, x.descripcion].filter(Boolean).join(' · ')) + '</td>' +
              '<td>' + esc(x.persona || '') + '</td><td class="n">' + (x.tipo === 'ingreso' ? '+' : '−') + plata(cent(x.monto)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' :
          '<div class="pos-cartel">' + (fuerte ? 'Todavía no pasó nada a la caja fuerte en esta caja.' : ret ? 'Todavía no se retiró nada de esta caja.' : 'Todavía no hay gastos en esta caja.') + '</div>') +
        '<div class="pos-pie">' + (fuerte ? '<a class="btn btn-sec btn-chico izq" href="#salidas" id="cjIrSalidas">Ir a Movimientos de salida</a>'
                                   : ret ? '<a class="btn btn-sec btn-chico izq" href="#retiros" id="cjIrRetiros">Ir a Retiros de fondos</a>'
                                          : '<a class="btn btn-sec btn-chico izq" href="#gastos" id="cjIrGastos">Ir a Gastos</a>') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Listo</button></div>', true);
    }

    $('cjLocal').onchange = function () { S.cajaLocal = this.value; recordarLocal(this.value); $('cjContado').value = ''; cargar(); };
    $('cjContado').oninput = olvidarCuenta;
    $('cjContado').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); contar(); } };
    $('cjContar').onclick = contar;
    $('cjCancelar').onclick = function () {
      K.k = null;
      $('cjContado').value = '';
      $('cjObs').value = '';
      pintarPasos();
      $('cjContado').focus();
    };
    $('cjCerrar').onclick = cerrar;
    cargar();
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var x = $('cjContado'); if (x) x.focus(); }, 0);
  }

  /* ════════════════════════════════════════════════════════════════════
     LOS GASTOS (26/10)
     Mauricio (26/10), al ver "Agregar gasto…" en el cierre: en BlueSoft
     "los teníamos como una sección aparte". Es su "Gastos del Local": la
     lista con el período y la sucursal, y «Nuevo gasto». Cada gasto entra
     solo en el próximo cierre de caja, que los suma pero ya no los carga.
     ════════════════════════════════════════════════════════════════════ */
  function diaSemana(ts) {
    try { return titulo(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long' }).format(new Date(ts))); } catch (e) { return ''; }
  }

  function verGastos() {
    var c = $('cuerpo'), prueba = enPrueba();
    var l = localMio(S.cajaLocal) || localInicial();
    c.innerHTML = cabeza('Gastos' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Los gastos del local y las otras salidas y entradas de la caja chica. Cada uno entra solo en el próximo cierre de caja.',
        '<button type="button" class="btn btn-pri btn-chico" id="gsNuevo">Nuevo gasto</button>') +
      '<div class="pos-filtros"><div id="gsPer"></div>' +
        campo('', 'Sucursal', '<select id="gsLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(l ? l.id : '') + '</select>') +
        campo('', 'Tipo', '<select id="gsTipo"><option value="">Todos</option>' + opciones(['gasto', 'salida', 'ingreso'].map(function (k) { return [k, TIPOS_MOV[k]]; }), '') + '</select>') +
        campo('', 'Gastos', '<select id="gsPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="gsLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('gsPer'), { inicial: 'mes', guardar: 'pos_gastos_periodo', hastaHoy: true, alCambiar: cargar });
    /* La sucursal es la misma del cierre: al volver al cierre, queda la que se eligió acá. */
    $('gsLocal').onchange = function () { if (this.value) { S.cajaLocal = this.value; recordarLocal(this.value); } cargar(); };
    ['gsTipo', 'gsPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('gsNuevo').onclick = function () { abrirMovimiento($('gsLocal').value || (localMio(S.cajaLocal) || localInicial()).id, prueba, cargar); };
    var pedido = 0;
    function deLaPrueba() { return $('gsPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('gsLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_caja_movimientos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('gsLocal').value || null, p_tipo: $('gsTipo').value || null,
                                       p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('gsLista')) return;
        pintarGastos(d);
      }).catch(function (e) { if ($('gsLista')) $('gsLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarGastos(d) {
      /* Lo que pasó a la caja fuerte no es un gasto: tiene su sección, Movimientos de salida; los retiros, la suya (SQL 191). Todo se ve en Gestión → Movimientos. */
      var filas = (d.filas || []).filter(function (f) { return f.origen !== 'cierre' && f.tipo !== 'caja_fuerte' && f.tipo !== 'retiro'; });
      filas.forEach(function (f) { f.prueba = deLaPrueba(); });
      var t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); }, todas = !$('gsLocal').value;
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Gastos del local</span><b>' + p(t.gasto) + '</b></div>' +
        '<div class="pos-kpi"><span>Otras salidas</span><b>' + p(t.salida) + '</b></div>' +
        '<div class="pos-kpi"><span>Otros ingresos</span><b>' + p(t.ingreso) + '</b></div>' +
        '<div class="pos-kpi"><span>Cantidad</span><b>' + miles(filas.filter(function (f) { return f.estado === 'ok'; }).length) + '</b></div></div>' +
        (deLaPrueba() ? '<div class="pos-cartel prueba">Los gastos de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en Tickets.</div>' : '');
      if (!filas.length) {
        $('gsLista').innerHTML = kpis + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay gastos de prueba' : 'No hay gastos') + ' en ese período con esos filtros. Se cargan con «Nuevo gasto».</div>';
        return;
      }
      /* Las columnas de "Gastos del Local" de BlueSoft (Comprobante, Fecha, Día, Total, Observaciones), con el tipo de gasto y en qué cierre entró. */
      $('gsLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Día</th>' + (todas ? '<th>Sucursal</th>' : '') +
        '<th>Tipo</th><th>Descripción</th><th>Cargó</th><th>Cierre</th><th class="n">Total</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          var an = f.estado !== 'ok';
          return '<tr data-gasto="' + i + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (deLaPrueba() ? 'prueba' : '') + '">' +
            '<td><b>' + esc(refGasto(f) || '—') + '</b></td><td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(diaSemana(f.fecha)) + '</td>' + (todas ? '<td>' + esc(bonito(f.local)) + '</td>' : '') +
            '<td>' + esc(f.tipo === 'gasto' ? f.rubro || TIPOS_MOV.gasto : TIPOS_MOV[f.tipo] || f.tipo) + '</td>' +
            '<td class="vf-det">' + (f.descripcion ? esc(f.descripcion) : '<span class="apagado">—</span>') + '</td>' +
            '<td>' + esc(f.persona || '—') + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : f.cierre ? esc(refCierre(f.cierre)) + (f.cierre.estado === 'anulada' ? ' (anulado)' : '') :
              '<span class="pill pill-ok">Caja abierta</span>') + '</td>' +
            '<td class="n tachar"><b>' + (f.tipo === 'ingreso' ? '+' : '') + p(f.monto) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
      $('gsLista').querySelectorAll('tr[data-gasto]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-gasto'))];
        tr.onclick = function () { abrirMovDetalle(f, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /* Un gasto del local, otra salida u otro ingreso de la caja chica ("Agregar gasto…" de BlueSoft).
     Se carga desde Gastos (el mostrador) y desde Gestión → Movimientos, eligiendo la sucursal. */
  function abrirMovimiento(localId, prueba, alGuardar) {
    var clave = nuevaClave(), tipo = 'gasto';
    var caja = ventana('<h3 id="posVentTit">' + (prueba ? 'Gasto de prueba' : 'Agregar gasto') + '</h3>' +
      '<p class="pos-bajada">En efectivo, de la caja chica: entra solo en el próximo cierre de caja.</p>' +
      '<div class="chips" id="gmTipo" role="group" aria-label="Qué es">' + ['gasto', 'salida', 'ingreso'].map(function (t) {
        return '<button type="button" class="chip" data-tipo="' + t + '">' + TIPOS_MOV[t] + '</button>'; }).join('') + '</div>' +
      '<div class="pos-campos" style="margin-top:10px">' +
        campo('ancho', 'Sucursal', '<select id="gmLocal" class="desplegable">' + opcionesLocales(localId) + '</select>') +
        campo('ancho', 'Tipo de gasto', '<select id="gmRubro"><option value="">Elegí…</option>' + RUBROS_GASTO.map(function (g) {
          return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>', ' id="gmRubroL"') +
        campo('ancho', 'Descripción', '<input type="text" id="gmDesc" maxlength="200" autocomplete="off">', ' id="gmDescL"') +
        campo('', 'Total', '<input type="text" inputmode="decimal" id="gmMonto" autocomplete="off" placeholder="$0">') +
      '</div><div class="pos-error" id="gmError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="gmGuardar">Guardar</button></div>');
    function marcar() {
      caja.querySelectorAll('[data-tipo]').forEach(function (b) {
        var si = b.getAttribute('data-tipo') === tipo;
        b.classList.toggle('sel', si);
        b.setAttribute('aria-pressed', String(si));
      });
      caja.querySelector('#gmRubroL').hidden = tipo !== 'gasto';
      caja.querySelector('#gmDescL').firstChild.textContent = tipo === 'gasto' ? 'Descripción (si hace falta)' : '¿De qué es?';
    }
    marcar();
    caja.querySelector('#gmTipo').onclick = function (e) { var b = e.target.closest('[data-tipo]'); if (b) { tipo = b.getAttribute('data-tipo'); marcar(); } };
    setTimeout(function () { caja.querySelector('#gmRubro').focus(); }, 0);
    function guardarMov() {
      var bt = caja.querySelector('#gmGuardar');
      var loc = caja.querySelector('#gmLocal').value, rubro = caja.querySelector('#gmRubro').value;
      var desc = caja.querySelector('#gmDesc').value.trim(), monto = leerPlata(caja.querySelector('#gmMonto').value);
      var mal = tipo === 'gasto' && !rubro ? 'Elegí el tipo de gasto.' :
        tipo !== 'gasto' && !desc ? 'Escribí de qué es.' :
        isNaN(monto) || monto <= 0 ? 'Escribí el total.' : '';
      if (!errorEn(caja, 'gmError', mal) || bt.disabled) return;
      bt.disabled = true;
      llamar('pos_caja_mov_guardar', { p: { clave: clave, local_id: loc, prueba: !!prueba, tipo: tipo, rubro: tipo === 'gasto' ? rubro : '', descripcion: desc, monto: aPesos(monto) } }).then(function (r) {
        var num = refGasto(r, !!prueba);
        avisar('ok', 'Anotado: ' + TIPOS_MOV[tipo].toLowerCase() + (num ? ' ' + num : '') + ', ' + plata(monto) + '.' + (num ? ' Escribile el ' + num + ' al ticket.' : ''));
        cerrarVentana();
        if (alGuardar) alGuardar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'gmError', mensajeDe(e)); });
    }
    caja.querySelector('#gmGuardar').onclick = guardarMov;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardarMov(); } });
  }

  /* ════════════════════════════════════════════════════════════════════
     LOS MOVIMIENTOS DE SALIDA (SQL 180, 26/10)
     Mauricio (26/10): "en BlueSoft tenemos una sección de movimientos, se
     llama «movimientos de salida», y ahí agregamos los movimientos de caja
     chica a caja fuerte". Es su "Transferencia de fondos": de la caja chica
     a la caja fuerte, antes de cerrar. Cada una tiene su número (MS-1…) y el
     próximo cierre la resta de lo que tendría que haber, como a un gasto.
     ════════════════════════════════════════════════════════════════════ */
  function verSalidas() {
    var c = $('cuerpo'), prueba = enPrueba();
    var l = localMio(S.cajaLocal) || localInicial();
    c.innerHTML = cabeza('Movimientos de salida' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que pasa de la caja chica a la caja fuerte. Se hace antes de cerrar la caja: el cierre lo resta de lo que tendría que haber.',
        '<button type="button" class="btn btn-pri btn-chico" id="msNueva">Nueva transferencia</button>') +
      '<div class="pos-filtros"><div id="msPer"></div>' +
        campo('', 'Sucursal', '<select id="msLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(l ? l.id : '') + '</select>') +
        campo('', 'Movimientos', '<select id="msPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="msLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('msPer'), { inicial: 'mes', guardar: 'pos_salidas_periodo', hastaHoy: true, alCambiar: cargar });
    /* La sucursal es la misma del cierre y de Gastos. */
    $('msLocal').onchange = function () { if (this.value) { S.cajaLocal = this.value; recordarLocal(this.value); } cargar(); };
    $('msPrueba').onchange = cargar;
    $('msNueva').onclick = function () { abrirSalida($('msLocal').value || (localMio(S.cajaLocal) || localInicial()).id, prueba, cargar); };
    var pedido = 0;
    function deLaPrueba() { return $('msPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('msLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_caja_movimientos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('msLocal').value || null, p_tipo: 'caja_fuerte',
                                       p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('msLista')) return;
        pintarSalidas(d);
      }).catch(function (e) { if ($('msLista')) $('msLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarSalidas(d) {
      var filas = d.filas || [], t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); }, todas = !$('msLocal').value;
      var ctl = t.controlado !== undefined;   // SQL 191: el tilde «Controlado»
      filas.forEach(function (f) { if (f.origen !== 'cierre') f.prueba = deLaPrueba(); });
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi fuerte"><span>A la caja fuerte</span><b>' + p(t.caja_fuerte) + '</b></div>' +
        (ctl ? '<div class="pos-kpi"><span>Total controlado</span><b>' + p(t.controlado) + '</b></div>' : '') +
        '<div class="pos-kpi"><span>Cantidad</span><b>' + miles(Number(t.cantidad) || 0) + '</b></div></div>' +
        (deLaPrueba() ? '<div class="pos-cartel prueba">Los movimientos de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en Tickets.</div>' : '');
      if (!filas.length) {
        $('msLista').innerHTML = kpis + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay movimientos de salida de prueba' : 'No hay movimientos de salida') +
          ' en ese período. Se cargan con «Nueva transferencia».</div>';
        return;
      }
      /* Hasta el SQL 180 se pasaba en el Paso 2 del cierre: esos salen con el cierre, y al tocarlos se abre el cierre. */
      $('msLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Día</th>' + (todas ? '<th>Sucursal</th>' : '') +
        '<th>Cargó</th><th>Observaciones</th><th>Cierre</th>' + (ctl ? '<th class="c">Controlado</th>' : '') + '<th class="n">Total</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          var an = f.estado !== 'ok', delCierre = f.origen === 'cierre';
          return '<tr data-salida="' + i + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (deLaPrueba() ? 'prueba' : '') + '">' +
            '<td><b>' + esc(refGasto(f) || '—') + '</b></td><td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(diaSemana(f.fecha)) + '</td>' + (todas ? '<td>' + esc(bonito(f.local)) + '</td>' : '') +
            '<td>' + esc(f.persona || '—') + '</td>' +
            '<td class="vf-det">' + (delCierre ? 'En el cierre (su Paso 2)' : f.descripcion ? esc(f.descripcion) : '<span class="apagado">—</span>') + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : f.cierre ? esc(refCierre(f.cierre)) + (f.cierre.estado === 'anulada' ? ' (anulado)' : '') :
              '<span class="pill pill-ok">Caja abierta</span>') + '</td>' + (ctl ? celdaControlado(f) : '') +
            '<td class="n tachar"><b>' + p(f.monto) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '') +
        (ctl && puede('gestion') ? '<p class="pos-ayuda">«Controlado»: tildalo cuando veas esa plata en la caja fuerte. Lo tilda sólo la oficina.</p>' : '');
      if (ctl) tildesControlado($('msLista'), cargar);
      $('msLista').querySelectorAll('tr[data-salida]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-salida'))];
        tr.onclick = function () { if (f.origen === 'cierre') abrirCierre(f.id, cargar); else abrirMovDetalle(f, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /* La "Transferencia de fondos" de BlueSoft: de la caja chica a la caja fuerte, en efectivo. Dice cuánto
     tendría que haber en la caja chica, y pregunta si pasan más que eso (un cero de más). */
  function abrirSalida(localId, prueba, alGuardar) {
    var clave = nuevaClave(), hay = null, pedido = 0;
    var caja = ventana('<h3 id="posVentTit">' + (prueba ? 'Transferencia de prueba' : 'Transferencia de fondos') + '</h3>' +
      '<p class="pos-bajada">De la caja chica a la caja fuerte. Hacela antes de cerrar la caja: el cierre la resta de lo que tendría que haber.</p>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Sucursal', '<select id="tfLocal" class="desplegable">' + opcionesLocales(localId) + '</select>') +
        campo('', 'Desde', '<input type="text" value="Caja chica" readonly>') +
        campo('', 'Hacia', '<input type="text" value="Caja fuerte" readonly>') +
        campo('', 'Importe en efectivo', '<input type="text" inputmode="decimal" id="tfMonto" autocomplete="off" placeholder="$0">') +
        campo('ancho', 'Observaciones', '<input type="text" id="tfObs" maxlength="200" autocomplete="off">') +
      '</div><p class="pos-ayuda" id="tfHay"></p><div class="pos-error" id="tfError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="tfGuardar">Guardar</button></div>');
    /* Lo que tendría que haber en la caja chica de esa sucursal (sin el saldo inicial del primer cierre, no se sabe). */
    function verHay() {
      var n = ++pedido, z = caja.querySelector('#tfHay');
      hay = null;
      z.textContent = '';
      llamar('pos_caja', { p_local: caja.querySelector('#tfLocal').value, p_prueba: !!prueba }).then(function (d) {
        if (n !== pedido || !caja.isConnected || d.primer || d.ventas.efectivo == null) return;
        hay = esperadoCaja(d, cent(d.saldo_inicial || 0));
        z.innerHTML = 'En la caja chica tendría que haber <b>' + plata(hay) + '</b>.';
      }).catch(function () { /* sin ese dato, se puede guardar igual */ });
    }
    verHay();
    caja.querySelector('#tfLocal').onchange = verHay;
    caja.querySelector('#tfMonto').oninput = function () { errorEn(caja, 'tfError', ''); };
    setTimeout(function () { caja.querySelector('#tfMonto').focus(); }, 0);
    function guardarSalida() {
      var bt = caja.querySelector('#tfGuardar');
      var loc = caja.querySelector('#tfLocal').value, obs = caja.querySelector('#tfObs').value.trim();
      var monto = leerPlata(caja.querySelector('#tfMonto').value);
      if (!errorEn(caja, 'tfError', isNaN(monto) || monto <= 0 ? 'Escribí el importe.' : '') || bt.disabled) return;
      if (hay != null && monto > hay && !confirm('Es más de lo que tendría que haber en la caja chica (' + plata(hay) + '). ¿Guardarla igual?')) return;
      bt.disabled = true;
      llamar('pos_caja_mov_guardar', { p: { clave: clave, local_id: loc, prueba: !!prueba, tipo: 'caja_fuerte', rubro: '', descripcion: obs, monto: aPesos(monto) } }).then(function (r) {
        var num = refGasto({ tipo: 'caja_fuerte', numero: r.numero }, !!prueba);
        avisar('ok', 'Anotado' + (num ? ': ' + num : '') + ', ' + plata(monto) + ' a la caja fuerte.');
        cerrarVentana();
        if (alGuardar) alGuardar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'tfError', mensajeDe(e)); });
    }
    caja.querySelector('#tfGuardar').onclick = guardarSalida;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardarSalida(); } });
  }

  /* ════════════════════════════════════════════════════════════════════
     LOS RETIROS DE FONDOS (SQL 191, 29/10)
     Mauricio (29/10): "retiro de fondos… lo que va a hacer es sacar de la
     caja fuerte o chica del local plata para darle a la fábrica". Son los
     "Retiros de Fondos" de BlueSoft: la lista con el período, la sucursal y
     el estado, y «Nuevo retiro». Cada uno con su número (RF-1…), de qué caja
     sale y quién se lleva la plata (el «Socio» de BlueSoft). El de la caja
     chica lo resta el próximo cierre, como un gasto; el de la caja fuerte no
     toca el cierre. El tilde «Controlado» lo pone la oficina ("la verdad
     nunca la usé… agrégalo por las dudas").
     ════════════════════════════════════════════════════════════════════ */
  function verRetiros() {
    var c = $('cuerpo'), prueba = enPrueba();
    var l = localMio(S.cajaLocal) || localInicial();
    c.innerHTML = cabeza('Retiros de fondos' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'La plata que sale de la caja chica o de la caja fuerte del local: para la fábrica, un depósito, un pago. El de la caja chica lo resta el próximo cierre.',
        '<button type="button" class="btn btn-pri btn-chico" id="rfNuevo">Nuevo retiro</button>') +
      '<div class="pos-filtros"><div id="rfPer"></div>' +
        campo('', 'Sucursal', '<select id="rfLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(l ? l.id : '') + '</select>') +
        campo('', 'Estado', '<select id="rfEstado"><option value="">Todos</option><option value="ok">Realizados</option><option value="anulado">Anulados</option></select>') +
        campo('', 'Retiros', '<select id="rfPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="rfLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('rfPer'), { inicial: 'mes', guardar: 'pos_retiros_periodo', hastaHoy: true, alCambiar: cargar });
    /* La sucursal es la misma del cierre, de Gastos y de Movimientos de salida. */
    $('rfLocal').onchange = function () { if (this.value) { S.cajaLocal = this.value; recordarLocal(this.value); } cargar(); };
    $('rfPrueba').onchange = cargar;
    $('rfEstado').onchange = function () { if (ultimo) pintarRetiros(ultimo); };
    $('rfNuevo').onclick = function () { abrirRetiro($('rfLocal').value || (localMio(S.cajaLocal) || localInicial()).id, prueba, cargar); };
    var pedido = 0, ultimo = null;
    function deLaPrueba() { return $('rfPrueba').value === '1'; }
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('rfLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_caja_movimientos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('rfLocal').value || null, p_tipo: 'retiro',
                                       p_prueba: deLaPrueba() }).then(function (d) {
        if (n !== pedido || !$('rfLista')) return;
        ultimo = d;
        pintarRetiros(d);
      }).catch(function (e) { if ($('rfLista')) $('rfLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin191(e)) + '</div>'; });
    }
    function pintarRetiros(d) {
      var est = $('rfEstado').value, t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); }, todas = !$('rfLocal').value;
      var filas = (d.filas || []).filter(function (f) { return !est || f.estado === est; });
      filas.forEach(function (f) { f.prueba = deLaPrueba(); });
      /* Abajo, como en BlueSoft: el monto total y el total controlado (de los realizados del período). */
      var pie = est === 'anulado' ? '' : '<div class="pos-totales abajo">' +
        '<div class="pos-kpi fuerte"><span>Monto total</span><b>' + p(t.retiro) + '</b></div>' +
        '<div class="pos-kpi"><span>Total controlado</span><b>' + p(t.controlado) + '</b></div>' +
        '<div class="pos-kpi"><span>Cantidad</span><b>' + miles(Number(t.cantidad) || 0) + '</b></div></div>' +
        (puede('gestion') ? '<p class="pos-ayuda">«Controlado»: tildalo cuando veas que la plata llegó. Lo tilda sólo la oficina.</p>' : '');
      var aviso = deLaPrueba() ? '<div class="pos-cartel prueba">Los retiros de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en Tickets.</div>' : '';
      if (!filas.length) {
        $('rfLista').innerHTML = aviso + '<div class="pos-cartel">' + (est === 'anulado' ? 'No hay retiros anulados' : deLaPrueba() ? 'No hay retiros de prueba' : 'No hay retiros de fondos') +
          ' en ese período. Se cargan con «Nuevo retiro».</div>' + pie;
        return;
      }
      /* Las columnas de "Retiros de Fondos" de BlueSoft (Fecha, Comprobante, Socio que retiró, Estado, Controlado, Total, Observaciones), con de qué caja salió. */
      $('rfLista').innerHTML = aviso + '<div class="pos-marco-tabla"><table class="pos-tabla rf-tabla"><thead><tr><th>Número</th><th>Fecha</th>' + (todas ? '<th>Sucursal</th>' : '') +
        '<th>De qué caja</th><th>Lo retiró</th><th>Observaciones</th><th>Cargó</th><th>Estado</th><th class="c">Controlado</th><th class="n">Total</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          var an = f.estado !== 'ok';
          return '<tr data-retiro="' + i + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (deLaPrueba() ? 'prueba' : '') + '">' +
            '<td><b>' + esc(refGasto(f) || '—') + '</b></td><td>' + esc(fechaHora(f.fecha)) + '</td>' + (todas ? '<td>' + esc(bonito(f.local)) + '</td>' : '') +
            '<td>' + esc(CAJAS[f.caja] || '—') + (f.caja === 'chica' && !an ? '<small>' + (f.cierre ? 'En el cierre ' + esc(refCierre(f.cierre)) : 'Entra en el próximo cierre') + '</small>' : '') + '</td>' +
            '<td>' + esc(f.retira || '—') + '</td>' +
            '<td class="vf-det">' + (f.descripcion ? esc(f.descripcion) : '<span class="apagado">—</span>') + '</td>' +
            '<td>' + esc(f.persona || '—') + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Realizado</span>') + '</td>' +
            celdaControlado(f) +
            '<td class="n tachar"><b>' + p(f.monto) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '') + pie;
      tildesControlado($('rfLista'), cargar);
      $('rfLista').querySelectorAll('tr[data-retiro]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-retiro'))];
        tr.onclick = function () { abrirMovDetalle(f, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /* El "Retiro de Fondos" de BlueSoft: de qué caja sale (la chica o la fuerte), quién se lleva la plata y cuánto, en efectivo.
     La caja no viene elegida (cambia el cierre). Del de la caja chica dice cuánto tendría que haber y pregunta si sacan más
     (un cero de más); el de la caja fuerte no toca el cierre (cuánto hay en la caja fuerte lo va a decir Disponibilidad). */
  function abrirRetiro(localId, prueba, alGuardar) {
    var clave = nuevaClave(), hay = null, pedido = 0, deCaja = '';
    var caja = ventana('<h3 id="posVentTit">' + (prueba ? 'Retiro de prueba' : 'Retiro de fondos') + '</h3>' +
      '<p class="pos-bajada">Plata que sale del local, en efectivo: para la fábrica, un depósito o un pago.</p>' +
      '<div class="pos-campos">' +
        campo('', 'Fecha', '<input type="text" value="' + esc(fechaCorta(S.ini.hoy)) + '" readonly>') +
        campo('ancho', 'Sucursal', '<select id="rtLocal" class="desplegable">' + opcionesLocales(localId) + '</select>') +
      '</div>' +
      '<p class="pos-lbl rt-lbl">¿De qué caja sale?</p>' +
      '<div class="chips" id="rtCaja" role="group" aria-label="De qué caja sale">' +
        '<button type="button" class="chip" data-caja="chica">Caja chica</button><button type="button" class="chip" data-caja="fuerte">Caja fuerte</button></div>' +
      '<div class="pos-campos" style="margin-top:10px">' +
        campo('ancho', 'Lo retira', '<select id="rtQuien" class="desplegable"><option value="">Cargando…</option></select>') +
        campo('ancho', 'Nombre de quien lo retira', '<input type="text" id="rtOtro" maxlength="80" autocomplete="off">', ' id="rtOtroL" hidden') +
        campo('', 'Importe en efectivo', '<input type="text" inputmode="decimal" id="rtMonto" autocomplete="off" placeholder="$0">') +
        campo('ancho', 'Observaciones', '<input type="text" id="rtObs" maxlength="200" autocomplete="off" placeholder="Para qué es: un depósito, un pago…">') +
      '</div><p class="pos-ayuda" id="rtHay">El de la caja chica lo resta el próximo cierre; el de la caja fuerte no toca el cierre.</p><div class="pos-error" id="rtError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="rtGuardar">Guardar</button></div>');
    /* Quién se lleva la plata: la gente de la oficina (arranca con quien entró, si es de la oficina) u "Otro…", escrito a mano. */
    function pintarQuien(lista) {
      var yo = S.ini.yo && S.ini.yo.id;
      caja.querySelector('#rtQuien').innerHTML = '<option value="">Elegí…</option>' + lista.map(function (x) {
        return '<option value="' + esc(x.nombre) + '"' + (x.id === yo ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') +
        '<option value="*">Otro…</option>';
    }
    function marcarOtro() {
      var otro = caja.querySelector('#rtQuien').value === '*';
      caja.querySelector('#rtOtroL').hidden = !otro;
      if (otro) caja.querySelector('#rtOtro').focus();
    }
    (S.retiran ? Promise.resolve(S.retiran) : llamar('pos_retiran', {})).then(function (ls) {
      S.retiran = Array.isArray(ls) ? ls : [];
      if (caja.isConnected) pintarQuien(S.retiran);
    }).catch(function () { if (caja.isConnected) pintarQuien([]); });
    caja.querySelector('#rtQuien').onchange = function () { errorEn(caja, 'rtError', ''); marcarOtro(); };
    /* Lo que tendría que haber en la caja chica de esa sucursal (sin el saldo inicial del primer cierre, no se sabe). */
    function verHay() {
      var n = ++pedido, z = caja.querySelector('#rtHay');
      hay = null;
      if (deCaja !== 'chica') {
        z.textContent = deCaja === 'fuerte' ? 'Sale de la caja fuerte: no toca el cierre de caja.' : 'El de la caja chica lo resta el próximo cierre; el de la caja fuerte no toca el cierre.';
        return;
      }
      z.textContent = 'Sale de la caja chica: lo resta el próximo cierre.';
      llamar('pos_caja', { p_local: caja.querySelector('#rtLocal').value, p_prueba: !!prueba }).then(function (d) {
        if (n !== pedido || !caja.isConnected || d.primer || d.ventas.efectivo == null) return;
        hay = esperadoCaja(d, cent(d.saldo_inicial || 0));
        z.innerHTML = 'Sale de la caja chica: lo resta el próximo cierre. Tendría que haber <b>' + plata(hay) + '</b>.';
      }).catch(function () { /* sin ese dato, se puede guardar igual */ });
    }
    caja.querySelector('#rtCaja').onclick = function (e) {
      var b = e.target.closest('[data-caja]');
      if (!b) return;
      deCaja = b.getAttribute('data-caja');
      caja.querySelectorAll('[data-caja]').forEach(function (x) { var si = x === b; x.classList.toggle('sel', si); x.setAttribute('aria-pressed', String(si)); });
      errorEn(caja, 'rtError', '');
      verHay();
    };
    caja.querySelector('#rtLocal').onchange = verHay;
    caja.querySelector('#rtMonto').oninput = function () { errorEn(caja, 'rtError', ''); };
    setTimeout(function () { var b = caja.querySelector('[data-caja]'); if (b) b.focus(); }, 0);
    function guardarRetiro() {
      var bt = caja.querySelector('#rtGuardar');
      var loc = caja.querySelector('#rtLocal').value, q = caja.querySelector('#rtQuien').value;
      var quien = q === '*' ? caja.querySelector('#rtOtro').value.trim() : q;
      var obs = caja.querySelector('#rtObs').value.trim(), monto = leerPlata(caja.querySelector('#rtMonto').value);
      var mal = !deCaja ? 'Elegí de qué caja sale la plata.' : !quien ? (q === '*' ? 'Escribí quién se lleva la plata.' : 'Elegí quién retira la plata.') :
        isNaN(monto) || monto <= 0 ? 'Escribí el importe.' : '';
      if (!errorEn(caja, 'rtError', mal) || bt.disabled) return;
      if (deCaja === 'chica' && hay != null && monto > hay && !confirm('Es más de lo que tendría que haber en la caja chica (' + plata(hay) + '). ¿Guardarlo igual?')) return;
      bt.disabled = true;
      llamar('pos_caja_mov_guardar', { p: { clave: clave, local_id: loc, prueba: !!prueba, tipo: 'retiro', caja: deCaja, retira: quien, rubro: '', descripcion: obs,
                                            monto: aPesos(monto) } }).then(function (r) {
        var num = refGasto({ tipo: 'retiro', numero: r.numero }, !!prueba);
        avisar('ok', 'Anotado' + (num ? ': ' + num : '') + ', ' + plata(monto) + ' de la ' + CAJAS[deCaja].toLowerCase() + '. Lo retiró ' + quien + '.');
        cerrarVentana();
        if (alGuardar) alGuardar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'rtError', sin191(e)); });
    }
    caja.querySelector('#rtGuardar').onclick = guardarRetiro;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardarRetiro(); } });
  }

  /* Un cierre guardado: todos sus números, sus gastos, cada vez que contaron, y anularlo (sólo el último). */
  function abrirCierre(id, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">Cierre de caja</h3><p class="cargando">Cargando…</p>', true);
    var dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_cierre', { p_id: id }).then(function (c) {
      if (!_velo || !caja.isConnected) return;
      var an = c.estado === 'anulada', p = function (n) { return plata(cent(n || 0)); };
      var dv = desvioDe(cent(c.desvio), cent(c.tolerancia));
      var movs = c.movimientos || [], conteos = c.conteos_detalle || [];
      dentro.innerHTML = '<h3 id="posVentTit">Cierre ' + esc(refCierre(c)) + ' · ' + esc(bonito(c.local)) + ' ' +
          (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Cerrado</span>') +
          (c.prueba ? ' <span class="pill pill-warn">Prueba</span>' : '') + '</h3>' +
        (c.prueba ? '<div class="pos-cartel prueba">Es un cierre de prueba: cuenta sólo las ventas de prueba y se borra con «Borrar las pruebas».</div>' : '') +
        '<div class="pos-ticket-datos cj-det-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(c.fecha)) + '</div>' +
          '<div><span>Día</span>' + esc(fechaCorta(c.dia)) + '</div>' +
          '<div><span>Responsable</span>' + esc(c.responsable_nombre || '—') + '</div>' +
          '<div><span>Caja</span>Caja chica</div>' +
          '<div><span>Desde</span>' + esc(fechaHora(c.desde)) + '</div>' +
          '<div><span>Tickets</span>' + c.tickets + (c.cambios ? ' y ' + c.cambios + (c.cambios === 1 ? ' cambio' : ' cambios') : '') + '</div>' +
        '</div>' +
        '<div class="cj-det">' +
          '<div class="cj-res"><h3 class="cj-res-tit">Resultados del día</h3>' +
            filaRes('Saldo inicial', p(c.saldo_inicial), 'fuerte') +
            filaRes('Ventas Tarjeta', p(c.ventas_tarjeta)) + filaRes('Ventas Transferencia', p(c.ventas_transferencia)) +
            filaRes('Ventas Efectivo', p(c.ventas_efectivo)) + filaRes('Ventas Mercado Pago', p(c.ventas_mercadopago)) +
            filaRes('Ventas MODO', p(c.ventas_modo)) + filaRes('Ventas Go Cuotas', p(c.ventas_go_cuotas)) +
            (Number(c.ventas_giftcard) ? filaRes('Ventas Gift card', p(c.ventas_giftcard)) : '') +   // SQL 200
            filaRes('Ventas totales del día', p(c.ventas_total), 'barra') +
            filaRes('Gastos en efectivo', p(c.gastos)) + filaRes('Otras salidas', p(c.otras_salidas)) +
            (c.a_caja_fuerte != null ? filaRes('A la caja fuerte', p(c.a_caja_fuerte)) : '') +   // SQL 180: los movimientos de salida
            (Number(c.retiros_fondos) ? filaRes('Retiros de fondos', p(c.retiros_fondos)) : '') +   // SQL 191: los de la caja chica
            filaRes('Descuentos', p(c.descuentos), 'info') +
            (c.cambios ? filaRes('Cobrado en cambios (' + c.cambios + ')', p(c.cambios_diferencia), 'info') : '') +
            filaRes('Otros ingresos', p(c.otros_ingresos)) +
            filaRes('Saldo final en efectivo', p(c.esperado), 'barra') + '</div>' +
          '<div class="cj-det-der">' +
            '<div class="cj-dif ' + dv.cls + '"><b>' + esc(dv.txt) + '</b><span>Tendría que haber ' + p(c.esperado) + ' y contaron ' + p(c.contado) + '.</span></div>' +
            /* Lo que pasaba a la caja fuerte al cerrar (el Paso 2, hasta el SQL 180): sólo en los cierres de antes. */
            '<div class="cj-res">' + filaRes('Contado', p(c.contado)) + (Number(c.retiro) || c.a_caja_fuerte == null ? filaRes('A la caja fuerte al cerrar', p(c.retiro)) : '') +
              filaRes('Queda en la caja chica', p(c.queda), 'barra') + '</div>' +
            (conteos.length > 1 ? '<p class="pos-lbl">Se contó ' + conteos.length + ' veces</p><ul class="cj-lista">' + conteos.map(function (k) {
              return '<li>' + esc(fechaHora(k.fecha)) + ' — ' + p(k.contado) + (k.persona ? ' (' + esc(k.persona) + ')' : '') + '</li>'; }).join('') + '</ul>' : '') +
            (movs.length ? '<p class="pos-lbl">Gastos y movimientos</p><ul class="cj-lista">' + movs.map(function (m) {
              var num = refGasto(m, c.prueba), det = [m.rubro, m.retira ? 'lo retiró ' + m.retira : '', m.descripcion].filter(Boolean).join(' · ');
              return '<li' + (m.estado === 'anulado' ? ' class="tachado"' : '') + '>' + (num ? '<b>' + esc(num) + '</b> ' : '') + esc(TIPOS_MOV[m.tipo] || m.tipo) + (det ? ': ' + esc(det) : '') +
                ' — ' + (m.tipo === 'ingreso' ? '+' : '−') + p(m.monto) + (m.estado === 'anulado' ? ' (anulado)' : '') + '</li>'; }).join('') + '</ul>' : '') +
            (c.observaciones ? '<p class="cj-obs"><b>Observaciones:</b> ' + esc(c.observaciones) + '</p>' : '') +
          '</div>' +
        '</div>' +
        (an ? '<div class="pos-cartel mal" style="margin-top:12px">Anulado el ' + esc(fechaHora(c.anulado_en)) + (c.anulado_por_nombre ? ' por ' + esc(c.anulado_por_nombre) : '') + ': ' + esc(c.anulado_motivo || '') + '</div>' : '') +
        '<div id="ciAnular"></div>' +
        '<div class="pos-pie">' + (c.es_ultimo ? '<button type="button" class="btn btn-sec btn-chico izq" id="ciAnularBtn">Anular el cierre</button>' : '') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var ab = dentro.querySelector('#ciAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        pedirMotivo(dentro.querySelector('#ciAnular'), 'El cierre queda en la lista, tachado. Sus ventas, sus cambios, sus gastos y lo que pasó a la caja fuerte vuelven a la caja abierta, para cerrarla de nuevo.',
          'Anular el cierre ' + refCierre(c), function (motivo) {
            return llamar('pos_cierre_anular', { p_id: c.id, p_motivo: motivo }).then(function () {
              avisar('ok', 'El cierre ' + refCierre(c) + ' quedó anulado.');
              if (alCambiar) alCambiar();
              abrirCierre(c.id, alCambiar);
            });
          });
      };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Cierre de caja</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     GESTIÓN → CIERRES DE CAJA (el listado de BlueSoft) Y MOVIMIENTOS
     ════════════════════════════════════════════════════════════════════ */
  function verCierres() {
    var c = $('cuerpo');
    c.innerHTML = cabeza('Cierres de caja', 'Los cierres de todas las sucursales. Se hacen en el mostrador, en POS → Cierre de caja.',
        '<a class="btn btn-pri btn-chico" href="pos.html#cierre">Cerrar una caja</a>') +
      '<div class="pos-filtros"><div id="ciPer"></div>' +
        campo('', 'Sucursal', '<select id="ciLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Cierres', '<select id="ciPrueba"><option value="">De verdad</option><option value="1">De prueba</option></select>') +
      '</div><div id="ciLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('ciPer'), { inicial: 'mes', guardar: 'pos_cierres_periodo', hastaHoy: true, alCambiar: cargar });
    ['ciLocal', 'ciPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    var pedido = 0;
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('ciLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_cierres', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('ciLocal').value || null, p_prueba: $('ciPrueba').value === '1' }).then(function (d) {
        if (n !== pedido || !$('ciLista')) return;
        pintarCierres(d);
      }).catch(function (e) { if ($('ciLista')) $('ciLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarCierres(d) {
      var t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); };
      var dif = t.faltas || t.sobras ? [t.faltas ? t.faltas + ' con falta' : '', t.sobras ? t.sobras + ' con sobra' : ''].filter(Boolean).join(' · ') : 'Todos cuadran';
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Cierres</span><b>' + (t.cierres || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Ventas</span><b>' + p(t.ventas) + '</b></div>' +
        '<div class="pos-kpi"><span>En efectivo</span><b>' + p(t.efectivo) + '</b></div>' +
        '<div class="pos-kpi"><span>En tarjeta</span><b>' + p(t.tarjeta) + '</b></div>' +
        '<div class="pos-kpi"><span>Mercado Pago</span><b>' + p(t.mercadopago) + '</b></div>' +
        '<div class="pos-kpi"><span>Gastos</span><b>' + p(t.gastos) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>A la caja fuerte</span><b>' + p(t.retiro) + '</b></div>' +
        (Number(t.retiros_fondos) ? '<div class="pos-kpi"><span>Retiros de la caja chica</span><b>' + p(t.retiros_fondos) + '</b></div>' : '') +   // SQL 191
        (t.cierres ? '<div class="pos-kpi"><span>Diferencias</span><b class="cj-kpi-dif">' + esc(dif) + '</b></div>' : '') + '</div>' +
        ($('ciPrueba').value === '1' ? '<div class="pos-cartel prueba">Los cierres de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en POS → Tickets.</div>' : '');
      if (!d.filas || !d.filas.length) { $('ciLista').innerHTML = kpis + '<div class="pos-cartel">No hay cierres en ese período.</div>'; return; }
      /* Las columnas de BlueSoft, apretadas para que entren en 1366: el número con la fecha, la sucursal
         con quién cerró, y "Anulado" en la diferencia. Lo que queda en la caja chica está en el detalle. */
      $('ciLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla cj-tabla"><thead><tr><th>Cierre</th><th>Sucursal</th>' +
        '<th class="n">Inicial</th><th class="n">Ventas</th><th class="n">Efectivo</th><th class="n">Tarjeta</th><th class="n">Mercado Pago</th>' +
        '<th class="n" title="MODO, Go Cuotas, transferencias y gift cards">Otros</th><th class="n" title="Gastos, otras salidas y retiros de fondos de la caja chica">Gastos</th><th class="n">Contado</th><th>Diferencia</th><th class="n">Caja fuerte</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var an = f.estado === 'anulada', dv = desvioDe(cent(f.desvio), cent(f.tolerancia));
          return '<tr data-cierre="' + esc(f.id) + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (f.prueba ? 'prueba' : '') + '">' +
            '<td><b>' + esc(refCierre(f)) + '</b><small>' + esc(fechaHora(f.fecha)) + '</small></td>' +
            '<td>' + esc(bonito(f.local)) + '<small>' + esc(f.responsable_nombre || '—') + '</small></td>' +
            '<td class="n">' + p(f.saldo_inicial) + '</td><td class="n tachar"><b>' + p(f.ventas_total) + '</b></td><td class="n">' + p(f.ventas_efectivo) + '</td>' +
            '<td class="n">' + p(f.ventas_tarjeta) + '</td><td class="n">' + p(f.ventas_mercadopago) + '</td>' +
            '<td class="n">' + p(Number(f.ventas_modo) + Number(f.ventas_go_cuotas) + Number(f.ventas_transferencia) + Number(f.ventas_giftcard || 0)) + '</td>' +
            '<td class="n">' + p(Number(f.gastos) + Number(f.otras_salidas) + Number(f.retiros_fondos || 0)) + '</td><td class="n">' + p(f.contado) + '</td>' +   // SQL 191
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="cj-dv ' + dv.cls + '">' + esc(dv.corto) + '</span>' +
              (f.conteos > 1 ? ' <small class="cj-veces" title="Contaron ' + f.conteos + ' veces">×' + f.conteos + '</small>' : '')) + '</td>' +
            '<td class="n tachar">' + p(Number(f.retiro) + Number(f.a_caja_fuerte || 0)) + '</td></tr>';   // SQL 180: el Paso 2 de antes y los movimientos de salida
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
      $('ciLista').querySelectorAll('tr[data-cierre]').forEach(function (tr) {
        tr.onclick = function () { abrirCierre(tr.getAttribute('data-cierre'), cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  function verMovimientos() {
    var c = $('cuerpo');
    c.innerHTML = cabeza('Movimientos de caja', 'Los gastos de cada local, las otras entradas y salidas de la caja chica, lo que pasó a la caja fuerte (Movimientos de salida) y los retiros de fondos.',
        '<button type="button" class="btn btn-pri btn-chico" id="mvNuevo">Agregar gasto…</button>') +
      '<div class="pos-filtros"><div id="mvPer"></div>' +
        campo('', 'Sucursal', '<select id="mvLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Tipo', '<select id="mvTipo"><option value="">Todos</option>' + opciones(Object.keys(TIPOS_MOV).map(function (k) { return [k, TIPOS_MOV[k]]; }), '') + '</select>') +
        campo('', 'Movimientos', '<select id="mvPrueba"><option value="">De verdad</option><option value="1">De prueba</option></select>') +
      '</div><div id="mvLista"><p class="cargando">Cargando…</p></div>';
    var per = periodoPos($('mvPer'), { inicial: 'mes', guardar: 'pos_movimientos_periodo', hastaHoy: true, alCambiar: cargar });
    ['mvLocal', 'mvTipo', 'mvPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('mvNuevo').onclick = function () { abrirMovimiento($('mvLocal').value || localInicial().id, false, cargar); };
    var pedido = 0;
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('mvLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_caja_movimientos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('mvLocal').value || null, p_tipo: $('mvTipo').value || null,
                                       p_prueba: $('mvPrueba').value === '1' }).then(function (d) {
        if (n !== pedido || !$('mvLista')) return;
        pintarMovs(d);
      }).catch(function (e) { if ($('mvLista')) $('mvLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarMovs(d) {
      var t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); };
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Gastos del local</span><b>' + p(t.gasto) + '</b></div>' +
        '<div class="pos-kpi"><span>Otras salidas</span><b>' + p(t.salida) + '</b></div>' +
        '<div class="pos-kpi"><span>Otros ingresos</span><b>' + p(t.ingreso) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>A la caja fuerte</span><b>' + p(t.caja_fuerte) + '</b></div>' +
        (t.retiro !== undefined ? '<div class="pos-kpi"><span>Retiros de fondos</span><b>' + p(t.retiro) + '</b></div>' : '') + '</div>' +   // SQL 191
        ($('mvPrueba').value === '1' ? '<div class="pos-cartel prueba">Los movimientos de <b>prueba</b>: no cuentan para nada.</div>' : '');
      if (!d.filas || !d.filas.length) { $('mvLista').innerHTML = kpis + '<div class="pos-cartel">No hay movimientos en ese período con esos filtros.</div>'; return; }
      var prueba = $('mvPrueba').value === '1', ctl = t.controlado !== undefined;   // SQL 191: el tilde «Controlado»
      d.filas.forEach(function (f) { if (f.origen !== 'cierre') f.prueba = prueba; });
      $('mvLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Sucursal</th><th>Tipo</th><th>Detalle</th>' +
        '<th>Cargó</th><th>Cierre</th><th>Estado</th>' + (ctl ? '<th class="c">Controlado</th>' : '') + '<th class="n">Monto</th></tr></thead><tbody>' +
        d.filas.map(function (f, i) {
          var an = f.estado !== 'ok', cierre = f.cierre ? refCierre(f.cierre) + (f.cierre.estado === 'anulada' ? ' (anulado)' : '') :
            f.tipo === 'retiro' && f.caja === 'fuerte' ? 'No entra (caja fuerte)' : 'Caja abierta';
          var det = f.tipo === 'retiro' ? [CAJAS[f.caja], f.retira ? 'lo retiró ' + f.retira : '', f.descripcion] : [f.rubro, f.descripcion];
          return '<tr data-mov="' + i + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (prueba ? 'prueba' : '') + '">' +
            '<td><b>' + esc(f.origen === 'cierre' ? '' : refGasto(f) || '—') + '</b></td><td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(bonito(f.local)) + '</td><td>' + esc(TIPOS_MOV[f.tipo] || f.tipo) + '</td>' +
            '<td>' + esc(f.origen === 'cierre' ? 'Del cierre ' + refCierre(f.cierre) : det.filter(Boolean).join(' · ')) + '</td>' +
            '<td>' + esc(f.persona || '—') + '</td><td>' + esc(f.origen === 'cierre' ? '—' : cierre) + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Vale</span>') + '</td>' + (ctl ? celdaControlado(f) : '') +
            '<td class="n tachar"><b>' + (f.tipo === 'ingreso' ? '+' : '−') + p(f.monto) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
      if (ctl) tildesControlado($('mvLista'), cargar);
      $('mvLista').querySelectorAll('tr[data-mov]').forEach(function (tr) {
        var f = d.filas[Number(tr.getAttribute('data-mov'))];
        tr.onclick = function () { if (f.origen === 'cierre') abrirCierre(f.id, cargar); else abrirMovDetalle(f, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /** Un gasto del listado: se ve, y se anula mientras su caja sigue abierta. SQL 191: el retiro de la caja fuerte no entra en ningún
      cierre (se anula cuando sea), y lo que la oficina tildó como controlado no se anula sin sacarle el tilde. */
  function abrirMovDetalle(f, alCambiar) {
    var an = f.estado !== 'ok', abierto = !f.cierre, deFuerte = f.tipo === 'retiro' && f.caja === 'fuerte';
    var ctl = (f.tipo === 'caja_fuerte' || f.tipo === 'retiro') && f.origen !== 'cierre' && f.controlado !== undefined;
    var num = refGasto(f);
    var caja = ventana('<h3 id="posVentTit">' + (num ? esc(num) + ' · ' : '') + esc(TIPOS_MOV[f.tipo] || f.tipo) + ' · ' + plata(cent(f.monto)) + ' ' +
        (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Vale</span>') + '</h3>' +
      '<div class="pos-ticket-datos">' +
        '<div><span>Fecha</span>' + esc(fechaHora(f.fecha)) + '</div>' +
        '<div><span>Sucursal</span>' + esc(bonito(f.local)) + '</div>' +
        '<div><span>Cargó</span>' + esc(f.persona || '—') + '</div>' +
        '<div><span>Cierre</span>' + esc(deFuerte ? 'No entra (sale de la caja fuerte)' : abierto ? 'Todavía en la caja abierta' : refCierre(f.cierre)) + '</div>' +
        (f.tipo === 'retiro' ? '<div><span>De qué caja</span>' + esc(CAJAS[f.caja] || '—') + '</div><div><span>Lo retiró</span>' + esc(f.retira || '—') + '</div>' : '') +
        (f.rubro ? '<div><span>Tipo de gasto</span>' + esc(f.rubro) + '</div>' : '') +
        (f.descripcion ? '<div><span>' + (f.tipo === 'caja_fuerte' || f.tipo === 'retiro' ? 'Observaciones' : 'Descripción') + '</span>' + esc(f.descripcion) + '</div>' : '') +
        (ctl ? '<div><span>Controlado</span>' + (f.controlado ? 'Sí' + (f.controlado_por ? ', ' + esc(f.controlado_por) : '') +
          (f.controlado_en ? ' (' + esc(fechaHora(f.controlado_en)) + ')' : '') : 'Todavía no') + '</div>' : '') +
      '</div>' +
      (an ? '<div class="pos-cartel mal">Anulado' + (f.motivo ? ': ' + esc(f.motivo) : '') + '</div>' : '') +
      (!an && !abierto ? '<p class="pos-ayuda">Ya entró en el cierre ' + esc(refCierre(f.cierre)) + ': para cambiarlo, hay que anular ese cierre.</p>' : '') +
      (!an && abierto && f.controlado ? '<p class="pos-ayuda">Ya lo controló la oficina: para anularlo, primero hay que sacarle el tilde de «Controlado».</p>' : '') +
      '<div id="mdAnular"></div><div class="pos-pie">' + (!an && abierto && !f.controlado ? '<button type="button" class="btn btn-sec btn-chico izq" id="mdAnularBtn">Anular</button>' : '') +
        (ctl && puede('gestion') && !an ? '<button type="button" class="btn btn-sec btn-chico" id="mdCtlBtn">' + (f.controlado ? 'Sacarle el tilde' : 'Marcar como controlado') + '</button>' : '') +
        '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>');
    var cb = caja.querySelector('#mdCtlBtn');
    if (cb) cb.onclick = function () {
      cb.disabled = true;
      llamar('pos_caja_mov_controlar', { p_id: f.id, p_si: !f.controlado }).then(function () {
        avisar('ok', f.controlado ? 'Listo: le sacaste el tilde.' : 'Listo: quedó controlado.');
        cerrarVentana();
        if (alCambiar) alCambiar();
      }).catch(function (e) { cb.disabled = false; avisar('err', sin191(e)); });
    };
    var ab = caja.querySelector('#mdAnularBtn');
    if (ab) ab.onclick = function () {
      ab.remove();
      pedirMotivo(caja.querySelector('#mdAnular'), 'Queda en la lista, tachado, con quién lo anuló y por qué.', 'Anular', function (motivo) {
        return llamar('pos_caja_mov_anular', { p_id: f.id, p_motivo: motivo }).then(function () {
          avisar('ok', 'Listo: quedó anulado.');
          cerrarVentana();
          if (alCambiar) alCambiar();
        });
      });
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     GESTIÓN → DISPONIBILIDAD (SQL 195, 29/10)
     La "Disponibilidad de Cajas" de BlueSoft: la caja chica y la caja
     fuerte de cada sucursal con cuánto hay hoy según el sistema. Mauricio:
     "cuando apretamos en una de las cajas, nos despliega los movimientos
     que se hicieron… de entradas y salidas": al tocar una se abre su
     "Consulta de Valores", con el saldo después de cada movimiento. La
     caja chica la deja en lo contado cada cierre; la caja fuerte arranca
     en $0 hasta que la oficina la cuenta con «Ajustar» (su "Ajustar/Cerrar
     Caja"). Sólo lo de verdad: las pruebas no son plata.
     ════════════════════════════════════════════════════════════════════ */
  function sin195(e) {
    var m = mensajeDe(e);
    return /SQL 195/.test(m) ? 'La disponibilidad de las cajas todavía no está en la base: falta correr el SQL 195.' : m;
  }
  /** El importe de un movimiento, con su signo: "+$180.000" o "−$32.000". */
  function importeConSigno(n) { var c = cent(n || 0); return (c > 0 ? '+' : '') + plata(c); }
  function nombreCaja(c) { return c.caja === 'chica' ? 'Caja chica' : 'Caja fuerte'; }
  /** Lo que dice el último control de una caja: el cierre de la chica o el ajuste de la fuerte. */
  function ultimoControl(c) {
    var u = c.ultimo;
    if (!u) return c.caja === 'chica' ? 'Todavía no cerró la caja' : 'Nunca se contó: arranca en $0';
    return (u.tipo === 'cierre' ? 'Cierre Nº ' : 'Ajuste Nº ') + u.numero + ' · ' + fechaHora(u.fecha);
  }

  function verDisponibilidad() {
    var c = $('cuerpo'), pedido = 0;
    S.dispVer = null;   // desde el menú, siempre la lista
    c.innerHTML = cabeza('Disponibilidad de cajas', 'Cuánta plata hay hoy en la caja chica y en la caja fuerte de cada sucursal, según el sistema. Tocá una caja para ver sus movimientos.',
        '<button type="button" class="btn btn-sec btn-chico" id="dpActualizar">Actualizar</button>') +
      '<div id="dpLista"><p class="cargando">Cargando…</p></div>';
    $('dpActualizar').onclick = cargar;
    function cargar() {
      var n = ++pedido;
      $('dpLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_disponibilidad').then(function (d) {
        if (n !== pedido || !$('dpLista')) return;
        S.dispCajas = d.cajas || [];
        pintar(d);
      }).catch(function (e) { if ($('dpLista')) $('dpLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin195(e)) + '</div>'; });
    }
    function pintar(d) {
      var t = d.totales || {}, p = function (n) { return plata(cent(n || 0)); }, cajas = d.cajas || [];
      if (!cajas.length) {
        $('dpLista').innerHTML = '<div class="pos-cartel">Todavía ninguna sucursal usa el POS de verdad. Cuando una venda, cargue un movimiento o cierre la caja, aparece acá.</div>';
        return;
      }
      var sinContar = cajas.some(function (x) { return x.caja === 'fuerte' && !x.ultimo; });
      /* Como el "Resumen" de BlueSoft: el total y lo de cada tipo de caja (sin cheques: no se usan). */
      $('dpLista').innerHTML = '<div class="pos-totales">' +
          '<div class="pos-kpi fuerte"><span>Total</span><b>' + p(Number(t.chica) + Number(t.fuerte)) + '</b></div>' +
          '<div class="pos-kpi"><span>En las cajas chicas</span><b>' + p(t.chica) + '</b></div>' +
          '<div class="pos-kpi"><span>En las cajas fuertes</span><b>' + p(t.fuerte) + '</b></div></div>' +
        '<div class="pos-marco-tabla"><table class="pos-tabla dp-tabla"><thead><tr><th>Sucursal</th><th>Caja</th><th>Último control</th><th class="n">Hay</th></tr></thead><tbody>' +
        cajas.map(function (x, i) {
          return '<tr data-caja="' + i + '" tabindex="0" title="Ver los movimientos de esta caja">' +
            '<td>' + esc(bonito(x.local)) + '</td><td><b>' + esc(nombreCaja(x)) + '</b></td>' +
            '<td class="' + (x.ultimo ? '' : 'dp-nunca') + '">' + esc(ultimoControl(x)) + '</td>' +
            '<td class="n"><b>' + p(x.saldo) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (sinContar ? '<p class="pos-ayuda">La caja fuerte arranca en $0 hasta que alguien la cuenta: tocala y usá «Ajustar» con lo que hay de verdad.</p>' : '');
      $('dpLista').querySelectorAll('tr[data-caja]').forEach(function (tr) {
        var x = cajas[Number(tr.getAttribute('data-caja'))];
        tr.onclick = function () { S.dispVer = { local: x.local_id, caja: x.caja }; verValores(); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /* La "Consulta de Valores de Caja" de BlueSoft: los movimientos de una caja en el período, del más nuevo al más viejo,
     con el saldo después de cada uno. En un cierre o un ajuste, el importe es la diferencia (lo contado menos lo que
     decía el sistema), así cada renglón es el de abajo más su importe. */
  function verValores() {
    var c = $('cuerpo'), sel = S.dispVer, pedido = 0, ult = null;
    var cajas = S.dispCajas || [];
    var opcs = cajas.map(function (x) { return [x.local_id + '|' + x.caja, bonito(x.local) + ' · ' + nombreCaja(x)]; });
    if (!opcs.some(function (o) { return o[0] === sel.local + '|' + sel.caja; })) opcs.unshift([sel.local + '|' + sel.caja, nombreCaja(sel)]);
    c.innerHTML = cabeza('<span id="vlTit">' + esc(nombreCaja(sel)) + '</span>', 'Los movimientos de la caja, con lo que había después de cada uno.',
        '<button type="button" class="btn btn-sec btn-chico" id="vlVolver">‹ Disponibilidad</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vlExcel" disabled>Bajar para Excel</button>' +
        '<span id="vlAccion"></span>') +
      '<div class="pos-filtros"><div id="vlPer"></div>' +
        campo('', 'Caja', '<select id="vlCaja" class="desplegable">' + opciones(opcs, sel.local + '|' + sel.caja) + '</select>') +
      '</div><div id="vlLista"><p class="cargando">Cargando…</p></div>';
    $('vlVolver').onclick = function () { S.dispVer = null; verDisponibilidad(); };
    var per = periodoPos($('vlPer'), { inicial: 'mes', guardar: 'pos_valores_periodo', hastaHoy: true, alCambiar: cargar });
    $('vlCaja').onchange = function () {
      var v = $('vlCaja').value.split('|');
      sel = S.dispVer = { local: v[0], caja: v[1] };
      cargar();
    };
    $('vlExcel').onclick = function () { if (ult) bajarValores(ult.d, ult.r); };
    function cargar() {
      var r = per.rango(), n = ++pedido;
      $('vlLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('vlExcel').disabled = true;
      $('vlAccion').innerHTML = '';
      llamar('pos_caja_valores', { p_local: sel.local, p_caja: sel.caja, p_desde: r.desde, p_hasta: r.hasta }).then(function (d) {
        if (n !== pedido || !$('vlLista')) return;
        ult = { d: d, r: r };
        pintar(d);
      }).catch(function (e) { if ($('vlLista')) $('vlLista').innerHTML = '<div class="pos-cartel mal">' + esc(sin195(e)) + '</div>'; });
    }
    function pintar(d) {
      var p = function (n) { return plata(cent(n || 0)); }, chica = sel.caja === 'chica', filas = d.filas || [];
      $('vlTit').textContent = nombreCaja(sel) + ' · ' + bonito(d.local);
      /* Su "Ajustar/Cerrar Caja": la chica se cierra en el mostrador; la fuerte la cuenta la oficina acá. */
      $('vlAccion').innerHTML = chica ? '<a class="btn btn-pri btn-chico" href="pos.html#cierre">Cerrar la caja</a>'
                                      : '<button type="button" class="btn btn-pri btn-chico" id="vlAjustar">Ajustar…</button>';
      if (!chica) $('vlAjustar').onclick = function () { abrirAjuste(sel.local, d, cargar); };
      $('vlExcel').disabled = !filas.length;
      var u = d.ultimo;
      $('vlLista').innerHTML = '<div class="pos-totales">' +
          '<div class="pos-kpi fuerte"><span>Hoy hay</span><b>' + p(d.saldo) + '</b></div>' +
          '<div class="pos-kpi"><span>Al empezar el período</span><b>' + p(d.antes) + '</b></div>' +
          '<div class="pos-kpi"><span>Entró</span><b>' + p(d.entro) + '</b></div>' +
          '<div class="pos-kpi"><span>Salió</span><b>' + p(d.salio) + '</b></div>' +
          (Number(d.ajustado) ? '<div class="pos-kpi"><span>' + (chica ? 'Diferencias de los cierres' : 'Ajustes') + '</span><b>' + esc(importeConSigno(d.ajustado)) + '</b></div>' : '') +
        '</div>' +
        (!filas.length ? '<div class="pos-cartel">No hubo movimientos en esta caja en ese período.</div>' :
          '<div class="pos-marco-tabla"><table class="pos-tabla dp-tabla"><thead><tr><th>Fecha</th><th>Comprobante</th><th>Detalle</th><th>Cargó</th>' +
            '<th class="n">Importe</th><th class="n">Saldo</th></tr></thead><tbody>' +
          filas.map(function (f, i) {
            /* El cierre (y lo que pasaba a la caja fuerte al cerrar, hasta el SQL 180) abre el cierre; el ajuste, el suyo. */
            var abre = f.tipo === 'cierre' || f.tipo === 'pase' || f.tipo === 'ajuste';
            var det = f.control && f.tipo !== 'inicial' ? f.detalle + ' · contaron ' + p(f.contado) : f.detalle;
            var imp = f.control && f.tipo !== 'inicial' && !cent(f.importe) ? '<small class="dp-cero">sin diferencia</small>' : esc(importeConSigno(f.importe));
            return '<tr class="' + (f.control ? 'dp-control' : '') + '"' + (abre ? ' data-fila="' + i + '" tabindex="0" title="Ver el ' + (f.tipo === 'ajuste' ? 'ajuste' : 'cierre') + '"' : '') + '>' +
              '<td>' + esc(fechaHora(f.fecha)) + '</td><td><b>' + esc(f.ref) + '</b></td><td>' + esc(det) + '</td><td>' + esc(f.persona || '—') + '</td>' +
              '<td class="n">' + imp + '</td><td class="n"><b>' + p(f.saldo) + '</b></td></tr>';
          }).join('') + '</tbody></table></div>' +
          (d.mas ? '<p class="pos-mas">Se ven los últimos 1000. Achicá el período para ver el resto.</p>' : '')) +
        /* Como el pie de BlueSoft ("Último ajuste de Caja" / "No hubo Ajustes de esta Caja"). */
        '<p class="pos-ayuda">' + (u ? (chica ? 'Último cierre: Nº ' : 'Último ajuste: Nº ') + u.numero + ', el ' + esc(fechaHora(u.fecha)) +
            (u.persona ? ', ' + esc(u.persona) : '') + '. Contaron ' + p(u.contado) + '.' :
          chica ? 'Esta caja todavía no se cerró nunca: el saldo es lo de hoy desde $0.' :
                  'No hubo ajustes de esta caja: el saldo arranca en $0 con el primer movimiento. Contala y usá «Ajustar» para que dé lo de verdad.') + '</p>';
      $('vlLista').querySelectorAll('tr[data-fila]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-fila'))];
        tr.onclick = function () { if (f.tipo === 'ajuste') abrirAjusteHecho(f, d, cargar); else abrirCierre(f.id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  function bajarValores(d, r) {
    var cab = ['Fecha', 'Comprobante', 'Detalle', 'Cargó', 'Contaron', 'Importe', 'Saldo'];
    var filas = (d.filas || []).map(function (f) {
      return [fechaLarga(f.fecha), f.ref, f.detalle, f.persona || '', f.control && f.tipo !== 'inicial' ? Number(f.contado) : '', Number(f.importe), Number(f.saldo)];
    });
    var caja = S.dispVer && S.dispVer.caja === 'chica' ? 'caja-chica' : 'caja-fuerte';
    bajarCsv(caja + '-' + String(bonito(d.local)).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + r.desde + '-al-' + r.hasta + '.csv', cab, filas);
  }

  /* El «Ajustar» de la caja fuerte: la oficina la cuenta y escribe cuánto hay. Muestra lo que dice el sistema y,
     mientras escriben, cuánto sobra o falta. */
  function abrirAjuste(localId, d, alGuardar) {
    var clave = nuevaClave(), hay = cent(d.saldo || 0);
    var caja = ventana('<h3 id="posVentTit">Ajustar la caja fuerte · ' + esc(bonito(d.local)) + '</h3>' +
      '<p class="pos-bajada">Contá la plata de la caja fuerte y escribí cuánto hay. Desde ahora, el saldo arranca de ese número.</p>' +
      '<div class="pos-ticket-datos"><div><span>Según el sistema</span>' + plata(hay) + '</div></div>' +
      '<div class="pos-campos">' +
        campo('', 'Hay en la caja fuerte', '<input type="text" inputmode="decimal" id="ajMonto" autocomplete="off" placeholder="$0">') +
        campo('ancho', 'Observaciones', '<input type="text" id="ajObs" maxlength="200" autocomplete="off">') +
      '</div><p class="pos-ayuda" id="ajDif"></p><div class="pos-error" id="ajError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="ajGuardar">Ajustar</button></div>');
    var m = caja.querySelector('#ajMonto');
    setTimeout(function () { m.focus(); }, 0);
    m.oninput = function () {
      errorEn(caja, 'ajError', '');
      var v = leerPlata(m.value), z = caja.querySelector('#ajDif');
      z.textContent = isNaN(v) ? '' : v === hay ? 'Coincide con el sistema.' : v > hay ? 'Sobran ' + plata(v - hay) + ' contra el sistema.' : 'Faltan ' + plata(hay - v) + ' contra el sistema.';
    };
    function guardar() {
      var bt = caja.querySelector('#ajGuardar'), v = leerPlata(m.value);
      if (!errorEn(caja, 'ajError', isNaN(v) || v < 0 ? 'Escribí cuánta plata hay en la caja fuerte.' : '') || bt.disabled) return;
      bt.disabled = true;
      llamar('pos_caja_ajustar', { p: { clave: clave, local_id: localId, contado: aPesos(v), observaciones: caja.querySelector('#ajObs').value.trim() } }).then(function (r) {
        avisar('ok', 'Listo: Ajuste Nº ' + r.numero + '. La caja fuerte de ' + bonito(d.local) + ' quedó en ' + plata(cent(r.contado)) + '.');
        cerrarVentana();
        if (alGuardar) alGuardar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'ajError', sin195(e)); });
    }
    caja.querySelector('#ajGuardar').onclick = guardar;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } });
  }

  /** Un ajuste de la lista: lo que decía el sistema, lo contado y la diferencia. El último se puede anular (se cargó mal). */
  function abrirAjusteHecho(f, d, alCambiar) {
    var ultimo = d.ultimo && d.ultimo.id === f.id, dif = cent(f.importe);
    var caja = ventana('<h3 id="posVentTit">' + esc(f.ref) + ' · Caja fuerte · ' + esc(bonito(d.local)) + '</h3>' +
      '<div class="pos-ticket-datos">' +
        '<div><span>Fecha</span>' + esc(fechaHora(f.fecha)) + '</div>' +
        '<div><span>La contó</span>' + esc(f.persona || '—') + '</div>' +
        '<div><span>Según el sistema</span>' + plata(cent(f.contado) - dif) + '</div>' +
        '<div><span>Contaron</span>' + plata(cent(f.contado)) + '</div>' +
        '<div><span>Diferencia</span>' + (dif ? (dif > 0 ? 'Sobraban ' : 'Faltaban ') + plata(Math.abs(dif)) : 'Ninguna') + '</div>' +
        (f.detalle !== 'Ajuste' ? '<div><span>Observaciones</span>' + esc(f.detalle.replace(/^Ajuste · /, '')) + '</div>' : '') +
      '</div>' +
      (ultimo ? '' : '<p class="pos-ayuda">Después vino otro ajuste: sólo se puede anular el último.</p>') +
      '<div id="ahAnular"></div><div class="pos-pie">' + (ultimo ? '<button type="button" class="btn btn-sec btn-chico izq" id="ahAnularBtn">Anular</button>' : '') +
        '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>');
    var ab = caja.querySelector('#ahAnularBtn');
    if (ab) ab.onclick = function () {
      ab.remove();
      pedirMotivo(caja.querySelector('#ahAnular'), 'El saldo vuelve a contarse desde el ajuste anterior (o desde $0, si no hubo otro).', 'Anular', function (motivo) {
        return llamar('pos_caja_ajuste_anular', { p_id: f.id, p_motivo: motivo }).then(function () {
          avisar('ok', 'Listo: el ' + f.ref + ' quedó anulado.');
          cerrarVentana();
          if (alCambiar) alCambiar();
        });
      });
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     PRODUCTOS (SQL 202): todos los de BlueSoft, con sus talles y colores
     La lista sale de la copia de la compu (los 7.072 entran enteros y se
     filtran al toque, sin ir a la base). Tocar uno abre su ficha; «Nuevo
     producto», una vacía. De la plata, la ficha muestra y cambia sólo el de
     la lista principal; lo demás sigue en Listas de precios.
     ════════════════════════════════════════════════════════════════════ */
  var PD_TANDA = 200;
  /** La lista que no se calcula de otra (la Lista 100). */
  function listaPrincipal() { var ls = (S.ini && S.ini.listas) || []; return ls.filter(function (l) { return !l.base_id; })[0] || ls[0] || null; }
  /** Los valores distintos de una columna del producto (2 rubro, 7 familia, 8 temporada, 9 marca). */
  function valoresDe(i) {
    var m = {};
    LISTA_PROD.forEach(function (p) { if (p[i]) m[p[i]] = 1; });
    return Object.keys(m).sort(function (a, b) { return i === 8 ? ordenTemporada(b) - ordenTemporada(a) || a.localeCompare(b, 'es') : a.localeCompare(b, 'es'); });
  }
  function nombresColores(p) { return coloresDe(p).map(function (x) { return x.nom; }).join(', '); }
  function totalCaja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
  function sin202Cartel() {
    return S.sin202 ? '<div class="pos-cartel mal">Todavía falta correr el SQL 202 (los productos) en Supabase: se ven sólo los ' + num(LISTA_PROD.length) +
      ' de catalogo.js y no se pueden cambiar.</div>' : '';
  }

  function verProductos(volver) {
    var c = $('cuerpo'), li = listaPrincipal();
    S.prodVer = null;
    if (!volver) S.prodFiltro = null;
    var F = S.prodFiltro || { buscar: '', rubro: '', temporada: '', mostrar: 'activos', precio: '' };
    c.innerHTML = cabeza('Productos', 'Todos los de BlueSoft, con sus talles y colores. Los inactivos no salen al buscar en la venta; la pistola los encuentra igual. Tocá uno para cambiarlo.',
        '<button type="button" class="btn btn-sec btn-chico" id="pdBajar" disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="pdNuevo">Nuevo producto</button>') +
      '<div class="pos-filtros">' +
        campo('cl-buscar', 'Buscar', '<input type="search" id="pdBuscar" autocomplete="off" spellcheck="false" placeholder="Código o nombre" value="' + esc(F.buscar) + '">') +
        campo('', 'Rubro', '<select id="pdRubro"></select>') +
        campo('', 'Temporada', '<select id="pdTemp"></select>') +
        campo('', 'Mostrar', '<select id="pdMostrar">' + opciones([['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']], F.mostrar) + '</select>') +
        campo('', 'Precio', '<select id="pdPrecio">' + opciones([['', 'Todos'], ['con', 'Con precio'], ['sin', 'Sin precio']], F.precio) + '</select>') +
      '</div>' +
      '<div id="pdAviso"></div><div id="pdLista"><p class="cargando">Cargando…</p></div><div class="tkl-pie" id="pdPie"></div>';
    var miLista = $('pdLista'), t = null, vistas = [], hasta = PD_TANDA;
    function llenarSelects() {
      $('pdRubro').innerHTML = '<option value="">Todos</option>' + opciones(valoresDe(2).map(function (r) { return [r, r]; }), F.rubro);
      $('pdTemp').innerHTML = '<option value="">Todas</option>' + opciones(valoresDe(8).map(function (r) { return [r, r]; }), F.temporada);
    }
    function leerF() {
      F = { buscar: $('pdBuscar').value, rubro: $('pdRubro').value, temporada: $('pdTemp').value, mostrar: $('pdMostrar').value, precio: $('pdPrecio').value };
      S.prodFiltro = F;
    }
    function precios() { return (li && S.precios[li.id]) || {}; }
    function filtrar() {
      var m = precios(), qc = F.buscar.trim().toLowerCase(), pal = normal(F.buscar).split(' ').filter(Boolean);
      return LISTA_PROD.filter(function (p) {
        if (F.mostrar === 'activos' ? !p[6] : F.mostrar === 'inactivos' ? p[6] : false) return false;
        if (F.rubro && p[2] !== F.rubro) return false;
        if (F.temporada && p[8] !== F.temporada) return false;
        if (F.precio && (F.precio === 'con') !== !!m[p[0]]) return false;
        if (!qc) return true;
        var n = normal(p[1]);
        return p[0].toLowerCase().indexOf(qc) === 0 || pal.every(function (w) { return n.indexOf(w) >= 0; });
      }).sort(function (a, b) { return (b[5] || 0) - (a[5] || 0) || a[0].localeCompare(b[0], 'es'); });
    }
    function pintar() {
      if (!miLista.isConnected) return;
      leerF();
      vistas = filtrar();
      var m = precios(), total = vistas.length;
      $('pdPie').innerHTML = totalCaja('Productos', num(total), 'fuerte') + totalCaja('Activos', num(vistas.filter(function (p) { return p[6]; }).length)) +
        (li ? totalCaja('Sin precio', num(vistas.filter(function (p) { return !m[p[0]]; }).length)) : '');
      $('pdBajar').disabled = !total;
      if (!total) {
        $('pdLista').innerHTML = '<div class="pos-cartel">No hay productos ' + (F.buscar.trim() ? 'con «' + esc(F.buscar.trim()) + '»' : 'con esos filtros') + '. Para cargar uno, tocá «Nuevo producto».</div>';
        return;
      }
      var xs = vistas.slice(0, hasta);
      /* El precio al lado del nombre: en una pantalla de 1366, lo de la derecha queda para correr. */
      $('pdLista').innerHTML = '<div class="pos-marco-tabla"><table class="pos-tabla pd-tabla"><thead><tr><th>Código</th><th>Nombre</th>' + (li ? '<th class="n">Precio</th>' : '') +
          '<th>Rubro</th><th>Familia</th><th>Temporada</th><th>Talles</th><th>Colores</th></tr></thead><tbody>' + xs.map(function (p, i) {
          var x = m[p[0]], cs = nombresColores(p), ts = tallesDe(p).join(' ');
          return '<tr data-pd="' + i + '" tabindex="0" title="Ver su ficha"' + (p[6] ? '' : ' class="cl-inactivo"') + '><td><b>' + esc(p[0]) + '</b></td>' +
            '<td>' + esc(p[1]) + (p[6] ? '' : ' <span class="pos-tag">Inactivo</span>') + '</td>' +
            (li ? '<td class="n">' + (x ? plata(x.c) : '<span class="apagado">Sin precio</span>') + '</td>' : '') +
            '<td>' + esc(p[2] || '—') + '</td><td>' + esc(p[7] || '—') + '</td>' +
            '<td class="pd-largo" title="' + esc(p[8]) + '">' + esc(p[8] || '—') + '</td><td class="pd-largo" title="' + esc(ts) + '">' + esc(ts || '—') + '</td>' +
            '<td class="pd-largo" title="' + esc(cs) + '">' + esc(cs || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (total > xs.length ? '<p class="pos-mas">Se ven ' + num(xs.length) + ' de ' + num(total) + '. <button type="button" class="pos-link" id="pdMas">Ver ' +
          num(Math.min(PD_TANDA, total - xs.length)) + ' más</button> o buscá para encontrar el resto.</p>' : '');
      if ($('pdMas')) $('pdMas').onclick = function () { hasta += PD_TANDA; pintar(); };
      $('pdLista').querySelectorAll('tr[data-pd]').forEach(function (tr) {
        var p = xs[Number(tr.getAttribute('data-pd'))];
        tr.onclick = function () { S.prodVer = { codigo: p[0] }; verProducto(); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    $('pdBuscar').oninput = function () { clearTimeout(t); t = setTimeout(function () { hasta = PD_TANDA; pintar(); }, 150); };
    ['pdRubro', 'pdTemp', 'pdMostrar', 'pdPrecio'].forEach(function (id) { $(id).onchange = function () { hasta = PD_TANDA; pintar(); }; });
    $('pdNuevo').onclick = function () {
      var q = $('pdBuscar').value.trim();
      S.prodVer = { nuevo: true, codigo: /^[A-Za-z]{1,4}\d[A-Za-z0-9]*$/.test(q) ? q.toUpperCase() : '' };
      verProducto();
    };
    /* El Excel de lo que se ve (todo lo filtrado, no sólo la primera tanda). */
    $('pdBajar').onclick = function () {
      var m = precios();
      bajarCsv('Productos ' + hoyCli() + '.csv',
        ['Código', 'Nombre', 'Rubro', 'Familia', 'Temporada', 'Marca', 'Talles', 'Colores'].concat(li ? ['Precio (' + li.nombre + ')'] : []).concat(['Activo']),
        vistas.map(function (p) {
          var x = m[p[0]];
          return [p[0], p[1], p[2], p[7], p[8], p[9], tallesDe(p).join(', '), nombresColores(p)]
            .concat(li ? [x ? String(aPesos(x.c)).replace('.', ',') : ''] : []).concat([p[6] ? 'Sí' : 'No']);
        }));
    };
    llenarSelects();
    Promise.all([S.artPromesa || Promise.resolve(false), li ? asegurarPrecios(li.id).catch(function () { return {}; }) : null]).then(function () {
      if (!miLista.isConnected) return;
      $('pdAviso').innerHTML = sin202Cartel();
      llenarSelects();
      pintar();
    });
    setTimeout(function () { var b = $('pdBuscar'); if (b) b.focus(); }, 0);
  }

  /* La ficha: un producto ({codigo}) o uno nuevo ({nuevo, codigo: lo que buscaban}). El código no se cambia:
     lo usan los precios, el stock y las ventas. */
  function verProducto() {
    var sel = S.prodVer || {}, p = sel.nuevo ? null : PROD[sel.codigo], c = $('cuerpo'), li = listaPrincipal(), nuevo = !p;
    c.innerHTML = cabeza(nuevo ? 'Nuevo producto' : esc(p[1]), nuevo ? 'Con el código de la etiqueta y los talles y colores que existen.' : esc(p[0]) + (p[8] ? ' · ' + esc(p[8]) : ''),
        '<button type="button" class="btn btn-sec btn-chico" id="pdVolver">‹ Productos</button>') +
      sin202Cartel() + '<div id="pdFicha"><p class="cargando">Cargando…</p></div>';
    $('pdVolver').onclick = function () { verProductos(true); };
    if (!sel.nuevo && !p) { $('pdFicha').innerHTML = '<div class="pos-cartel mal">No encontré el producto ' + esc(sel.codigo || '') + '.</div>'; return; }
    (li ? asegurarPrecios(li.id).catch(function () { return {}; }) : Promise.resolve()).then(function () { if ($('pdFicha')) formProducto(); });

    function formProducto() {
      var f = $('pdFicha'), x = li && p ? (S.precios[li.id] || {})[p[0].toUpperCase()] : null;
      var cols = coloresDe(p).map(function (k) { return { cod: k.cod, nom: k.nom }; });
      var calc = li ? S.ini.listas.filter(function (l) { return l.base_id === li.id; }).map(function (l) { return l.nombre; }) : [];
      /* Los colores que ya existen en otros productos: al escribir el código, el nombre sale solo. */
      var conocidos = {};
      LISTA_PROD.forEach(function (q) { coloresDe(q).forEach(function (k) { if (!conocidos[k.cod]) conocidos[k.cod] = k.nom; }); });
      function lista(id, i) { return '<datalist id="' + id + '">' + valoresDe(i).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; }
      function texto(id, lbl, max, v, extra, cls) {
        return campo(cls || '', lbl, '<input type="text" id="' + id + '" maxlength="' + max + '" autocomplete="off" value="' + esc(v || '') + '"' + (extra || '') + '>');
      }
      f.innerHTML = '<div class="pos-campos pd-campos">' +
          texto('pfCod', 'Código', 30, p ? p[0] : sel.codigo, ' spellcheck="false"' + (p ? ' readonly title="El código no se cambia: lo usan los precios, el stock y las ventas"' : '')) +
          texto('pfNom', 'Nombre', 120, p && p[1], '', 'pd-nombre') +
          texto('pfRubro', 'Rubro', 60, p && p[2], ' list="pfRubros"') +
          texto('pfFam', 'Familia', 60, p && p[7], ' list="pfFamilias"') +
          texto('pfTemp', 'Temporada', 60, p && p[8], ' list="pfTemps"') +
          texto('pfMarca', 'Marca', 60, p && p[9], ' list="pfMarcas"') +
          campo('ancho', 'Talles <span class="lbl-opc">(separados por comas, como en la etiqueta)</span>',
                '<input type="text" id="pfTalles" maxlength="400" autocomplete="off" spellcheck="false" placeholder="S, M, L, XL" value="' + esc(p ? tallesDe(p).join(', ') : '') + '">') +
          (li ? campo('', 'Precio', '<input type="text" inputmode="decimal" id="pfPrecio" placeholder="Sin precio"' +
                      ' value="' + esc(x ? plataCampo(x.c) : '') + '">') : '') +
          '<label class="pos-check pd-activo"><input type="checkbox" id="pfActivo"' + (!p || p[6] ? ' checked' : '') + '> Activo (si no, no sale al buscar en la venta)</label>' +
        '</div>' +
        (li ? '<p class="cli-ayuda">El precio es el de «' + esc(li.nombre) + '»' + (calc.length ? '; ' + esc(calc.join(', ')) +
                (calc.length > 1 ? ' se calculan solas' : ' se calcula sola') + ' de ésta' : '') + '.</p>' : '') +
        '<h3 class="pd-sub">Colores</h3><div id="pfColores"></div><p><button type="button" class="pos-link" id="pfColMas">+ Agregar color</button></p>' +
        lista('pfRubros', 2) + lista('pfFamilias', 7) + lista('pfTemps', 8) + lista('pfMarcas', 9) +
        '<datalist id="pfColCods">' + Object.keys(conocidos).sort().map(function (k) { return '<option value="' + esc(k) + '" label="' + esc(conocidos[k]) + '">'; }).join('') + '</datalist>' +
        '<div class="pos-error" id="pfError"></div>' +
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" id="pfOtro">Guardar y nuevo</button>' +
          '<button type="button" class="btn btn-pri btn-chico" id="pfGuardar">Guardar</button></div>';
      function leerCols() {
        f.querySelectorAll('[data-col]').forEach(function (r) {
          var k = cols[Number(r.getAttribute('data-col'))];
          if (k) { k.cod = r.querySelector('[data-k="cod"]').value.trim().toUpperCase(); k.nom = r.querySelector('[data-k="nom"]').value.trim(); }
        });
      }
      function pintarCols() {
        $('pfColores').innerHTML = cols.length ? cols.map(function (k, i) {
          return '<div class="cli-renglon pd-color" data-col="' + i + '"><div class="pos-campos">' +
            campo('', 'Código', '<input type="text" data-k="cod" maxlength="6" list="pfColCods" autocomplete="off" spellcheck="false" value="' + esc(k.cod) + '">') +
            campo('', 'Nombre', '<input type="text" data-k="nom" maxlength="40" autocomplete="off" value="' + esc(k.nom) + '">') +
            '</div><button type="button" class="tk-quitar" data-quitar-col="' + i + '" title="Quitar este color" aria-label="Quitar este color">' + icono('x') + '</button></div>';
        }).join('') : '<p class="cli-vacio">Sin colores: en la venta no se pide el color.</p>';
        $('pfColores').querySelectorAll('[data-k="cod"]').forEach(function (inp) {
          inp.onchange = function () {
            var nom = inp.closest('[data-col]').querySelector('[data-k="nom"]'), k = inp.value.trim().toUpperCase();
            inp.value = k;
            if (!nom.value.trim() && conocidos[k]) nom.value = conocidos[k];
          };
        });
        $('pfColores').querySelectorAll('[data-quitar-col]').forEach(function (b) {
          b.onclick = function () { leerCols(); cols.splice(Number(b.getAttribute('data-quitar-col')), 1); pintarCols(); };
        });
      }
      pintarCols();
      $('pfColMas').onclick = function () {
        leerCols();
        cols.push({ cod: '', nom: '' });
        pintarCols();
        var r = $('pfColores').querySelector('[data-col="' + (cols.length - 1) + '"] [data-k="cod"]');
        if (r) r.focus();
      };
      function guardarProd(otro) {
        leerCols();
        var v = function (id) { return $(id).value.trim(); };
        var cod = (nuevo ? v('pfCod') : p[0]).toUpperCase(), nom = v('pfNom');
        var inP = li && $('pfPrecio'), pr = inP ? v('pfPrecio') : null, precio = pr ? leerPlata(pr) : null, antes = x ? x.c : null;
        var err = !cod ? 'Falta el código (el de la etiqueta).' :
                  nuevo && !/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(cod) ? 'El código va con letras y números, sin espacios.' :
                  nuevo && LISTA_PROD.some(function (q) { return q[0].toUpperCase() === cod; }) ? 'Ya hay un producto con el código ' + cod + '.' :
                  !nom ? 'Falta el nombre.' :
                  pr && !(precio > 0) ? 'Ese precio no se entiende. Escribilo así: 20000 o 16.333,33 (para sacarlo, dejalo vacío).' :
                  cols.some(function (k) { return k.cod && !/^[A-Z0-9]{1,6}$/.test(k.cod); }) ? 'Cada color va con un código de hasta 6 letras o números, como en la etiqueta.' :
                  cols.some(function (k) { return !k.cod && k.nom; }) ? 'A un color le falta el código.' : '';
        if (!errorEn(f, 'pfError', err)) return;
        if (pr === '' && antes != null && !confirm('¿Sacarle el precio a ' + cod + '? En la venta va a salir «Sin precio».')) return;
        var bs = [$('pfGuardar'), $('pfOtro')];
        bs.forEach(function (b) { b.disabled = true; });
        llamar('pos_articulo_guardar', { p: { nuevo: nuevo, codigo: cod, nombre: nom, rubro: v('pfRubro'), familia: v('pfFam'), temporada: v('pfTemp'), marca: v('pfMarca'),
                                              talles: v('pfTalles'), colores: cols.filter(function (k) { return k.cod; }), activo: $('pfActivo').checked } }).then(function (fila) {
          cambiarArticulo(fila);
          var cambia = pr !== null && (pr === '' ? antes != null : precio !== antes);
          var dePrecio = cambia ? llamar('pos_precio_guardar', { p_lista: li.id, p_codigo: fila[0], p_precio: pr === '' ? null : aPesos(precio) })
            .then(function () { olvidarPrecios(li.id); return asegurarPrecios(li.id); }) : Promise.resolve();
          return dePrecio.then(function () {
            avisar('ok', 'Listo: ' + fila[1] + ' (' + fila[0] + ') ' + (nuevo ? 'quedó cargado.' : 'se guardó.'));
            S.prodVer = otro ? { nuevo: true } : { codigo: fila[0] };
            verProducto();
          }, function (e) {
            avisar('err', 'El producto se guardó, pero el precio no: ' + mensajeDe(e));
            S.prodVer = { codigo: fila[0] };
            verProducto();
          });
        }).catch(function (e) {
          bs.forEach(function (b) { b.disabled = false; });
          errorEn(f, 'pfError', mensajeDe(e));
        });
      }
      $('pfGuardar').onclick = function () { guardarProd(false); };
      $('pfOtro').onclick = function () { guardarProd(true); };
      setTimeout(function () { var e = $(nuevo ? 'pfCod' : 'pfNom'); if (e) e.focus(); }, 0);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     LISTAS DE PRECIOS
     SQL 201 (30/10, Mauricio, mirando «Importar productos desde la web» de
     BlueSoft): en una lista con precios propios, «Subir lista de BlueSoft»
     (el Excel «Lista de Precios»: se ve antes qué cambia) y «Aumentar
     precios» con un porcentaje, para toda la lista, un rubro o una familia de
     un rubro ("por si quieren aumentar la lista de un rubro y familia
     aparte"). Cada cambio en bloque queda anotado y se puede deshacer.
     ════════════════════════════════════════════════════════════════════ */
  var REDONDEOS = [[1, 'Sin redondear'], [10, 'A $10'], [50, 'A $50'], [100, 'A $100'], [500, 'A $500'], [1000, 'A $1.000']];
  /** Dónde vale una lista: las sucursales que la usan y las de las listas que se calculan de ella. */
  function dondeValeLista(li) {
    var hijas = S.ini.listas.filter(function (l) { return l.base_id === li.id; });
    var ids = [li.id].concat(hijas.map(function (l) { return l.id; }));
    var n = S.ini.locales.filter(function (l) { return ids.indexOf(listaDe(l)) >= 0; }).length;
    if (!n) return 'Ninguna sucursal la usa todavía.';
    return 'Valen desde la próxima venta en ' + (n === 1 ? 'la sucursal que la usa' : 'las ' + n + ' sucursales que la usan') +
      (hijas.length ? ' (con «' + hijas.map(function (l) { return l.nombre; }).join('» y «') + '», que se calcula de esta)' : '') + '.';
  }
  /** "10", "12,5", "-10", "−10", "10 %" → el número (NaN si no es uno). */
  function leerPorcentaje(s) {
    s = String(s == null ? '' : s).replace(/[%\s]/g, '').replace(/[−–]/g, '-').replace(',', '.');
    return /^-?\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN;
  }
  function textoPorcentaje(p) { return String(Math.abs(p)).replace('.', ','); }
  /** Cuánto cambió un precio: "+10 %", "−3,5 %". */
  function difPrecio(antes, ahora) {
    var d = Math.round((ahora / antes - 1) * 1000) / 10;
    return (d > 0 ? '+' : d < 0 ? '−' : '') + String(Math.abs(d)).replace('.', ',') + ' %';
  }

  /** El Excel de precios → {items, ceros, errores, listas}. Busca la fila de los títulos con Código y el precio:
      en la «Lista de Precios» de BlueSoft, «PrecioFinal» (con IVA; «ProductoPrecio» es sin IVA y no se usa).
      Si trae la columna Lista, cada renglón dice de cuál es. Los precios, en centavos. */
  function leerPrecios(filas, deExcel) {
    var esCod = /^(codigo|cod\.?|articulo|sku)$/, iCab = -1, i;
    for (i = 0; i < Math.min(filas.length, 30); i++) {
      if ((filas[i] || []).some(function (c) { return esCod.test(normal(c)); })) { iCab = i; break; }
    }
    if (iCab < 0) return { error: 'No encontré la fila de los títulos: el Excel tiene que tener una columna Código y otra con el precio (PrecioFinal o Precio).' };
    var cab = filas[iCab].map(normal);
    var busca = function (re) { for (var j = 0; j < cab.length; j++) if (re.test(cab[j] || '')) return j; return -1; };
    var ic = { codigo: busca(esCod), precio: busca(/^precio ?final$/), nombre: busca(/^(nombre|descripcion|producto)$/), rubro: busca(/^rubro$/),
               familia: busca(/^familia$/), temporada: busca(/^temporada$/), lista: busca(/^lista$/), listaDesc: busca(/^lista ?descripcion$/) };
    if (ic.precio < 0) ic.precio = busca(/^(precio|precio de venta|precio con iva|pvp)$/);
    if (ic.precio < 0) return { error: 'No encontré la columna del precio: tiene que decir PrecioFinal (como la «Lista de Precios» de BlueSoft) o Precio.' };
    var items = [], errores = [], ceros = 0, listas = {};
    var celda = function (f, k) { return ic[k] >= 0 ? String(f[ic[k]] == null ? '' : f[ic[k]]).trim() : ''; };
    filas.slice(iCab + 1).forEach(function (f, j) {
      if (!f) return;
      var cod = celda(f, 'codigo').toUpperCase(), fila = iCab + 2 + j, txt = celda(f, 'precio');
      if (!cod || /^total/i.test(cod)) return;
      if (cod.length > 30) { errores.push('Fila ' + fila + ': el código «' + cod.slice(0, 40) + '» es demasiado largo.'); return; }
      /* En el .xlsx el número viene crudo (16333.3333); escrito o en un CSV, como lo escribimos ("41.000", "16.333,33").
         Sin precio, en $0 o negativo (en la de BlueSoft, los avíos y los costos): no se carga, se vendería mal. */
      var neg = /^[-−]/.test(txt);
      var p = deExcel && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(txt) ? Math.round(Number(txt) * 100) : leerPlata(txt.replace(/^[-−]/, ''));
      if (txt === '' || p === 0 || neg || p < 0) { ceros++; return; }
      if (!(p > 0)) { errores.push('Fila ' + fila + ': el precio de ' + cod + ' («' + txt.slice(0, 20) + '») no se entiende.'); return; }
      if (p >= 10000000000) { errores.push('Fila ' + fila + ': el precio de ' + cod + ' es demasiado grande.'); return; }
      var lista = celda(f, 'lista');
      if (ic.lista >= 0) {
        var x = listas[lista] = listas[lista] || { nombre: celda(f, 'listaDesc') || 'Lista ' + lista, n: 0 };
        x.n++;
      }
      items.push({ fila: fila, codigo: cod, precio: p, lista: lista, nombre: celda(f, 'nombre').slice(0, 120), rubro: celda(f, 'rubro').slice(0, 60),
                   familia: celda(f, 'familia').slice(0, 60), temporada: celda(f, 'temporada').slice(0, 60) });
    });
    if (!items.length && !errores.length) return { error: 'El Excel no trae ningún precio.' };
    return { items: items, ceros: ceros, errores: errores, listas: listas };
  }
  /** Si el Excel trae varias listas, la que dice el número de la nuestra («Lista 100 · …» ↔ 100); si no se sabe, null (que elija). */
  function listaDelExcel(r, li) {
    var ks = Object.keys(r.listas);
    if (ks.length < 2) return ks[0] || '';
    var m = ks.filter(function (k) { return /^\d+$/.test(k) && new RegExp('(^|\\D)' + k + '(\\D|$)').test(li.nombre); });
    return m.length === 1 ? m[0] : null;
  }

  function verListas() {
    var c = $('cuerpo');
    if (!listaPorId(S.listaSel)) S.listaSel = S.ini.listas[0] && S.ini.listas[0].id;
    var li = listaPorId(S.listaSel);
    if (!li) { c.innerHTML = cabeza('Listas de precios', '') + '<div class="pos-cartel">No hay listas de precios.</div>'; return; }
    var base = li.base_id ? listaPorId(li.base_id) : null;
    var usan = S.ini.locales.filter(function (l) { return l.lista_id === li.id; }).map(nombreLocal);
    if (S.subida && S.subida.li !== li.id) S.subida = null;
    c.innerHTML = cabeza('Listas de precios', 'Cada sucursal usa una (se elige en Sucursales). Un precio cambiado acá vale desde la próxima venta.',
        base ? '' : '<label class="btn btn-sec btn-chico">Subir lista de BlueSoft…<input type="file" id="lsArchivo" accept=".xlsx,.csv,.txt" hidden></label>' +
                    '<button type="button" class="btn btn-sec btn-chico" id="lsAumentar">Aumentar precios…</button>') +
      '<div class="pos-listas-elegir" role="group" aria-label="Lista">' + S.ini.listas.map(function (l) {
        return '<button type="button" class="chip' + (l.id === li.id ? ' sel' : '') + '" data-lista="' + l.id + '">' + esc(l.nombre) + '</button>'; }).join('') + '</div>' +
      (base ? '<div class="pos-calc"><p>Se calcula sola de <b>' + esc(base.nombre) + '</b>: ' + (Number(li.ajuste) < 0 ? String(-li.ajuste).replace('.', ',') + ' % menos' : String(li.ajuste).replace('.', ',') + ' % más') +
          ', redondeado a $' + miles(li.redondeo) + '. Un precio cambiado a mano en esta lista pisa al calculado.' + (usan.length ? ' La usan: ' + esc(usan.join(', ')) + '.' : '') + '</p>' +
          campo('', 'Porcentaje', '<input type="text" inputmode="decimal" id="lsAjuste" value="' + String(li.ajuste).replace('.', ',') + '">') +
          campo('', 'Redondeo ($)', '<input type="number" id="lsRedondeo" min="1" max="10000" value="' + li.redondeo + '">') +
          '<button type="button" class="btn btn-sec btn-chico" id="lsGuardar">Guardar</button></div>'
        : '<div class="pos-calc"><p>Los precios propios de esta lista' + (usan.length ? '. La usan: ' + esc(usan.join(', ')) : '') + '.</p></div>' +
          '<div id="lsSubida"></div><div id="lsCambios"></div>') +
      '<div class="pos-filtros">' + campo('ancho', 'Buscar', '<input type="search" id="lsBuscar" placeholder="Código o nombre" autocomplete="off">') +
        '<label class="pos-check"><input type="checkbox" id="lsSolo" checked> Sólo los que tienen precio</label></div>' +
      '<div id="lsTabla"><p class="cargando">Cargando…</p></div>';
    c.querySelectorAll('[data-lista]').forEach(function (b) { b.onclick = function () { S.listaSel = Number(b.getAttribute('data-lista')); verListas(); }; });
    if (!base) {
      $('lsArchivo').onchange = function () {
        var f = this.files && this.files[0];
        this.value = '';
        if (f) subirLista(li, f);
      };
      $('lsAumentar').onclick = function () { aumentarLista(li); };
      if (S.subida) previaSubida(li);
      cambiosDeLista(li);
    }
    if ($('lsGuardar')) $('lsGuardar').onclick = function () {
      var aj = parseFloat(String($('lsAjuste').value).replace(',', '.')), red = parseInt($('lsRedondeo').value, 10), bt = this;
      if (!(aj > -100 && aj <= 300)) { avisar('err', 'El porcentaje va de −99 a 300 (para menos, con el signo menos: −15).'); return; }
      if (!(red >= 1 && red <= 10000)) { avisar('err', 'El redondeo va de $1 a $10.000.'); return; }
      bt.disabled = true;
      llamar('pos_lista_guardar', { p_lista: li.id, p_ajuste: aj, p_redondeo: red }).then(function () {
        li.ajuste = aj; li.redondeo = red;
        delete S.precios[li.id];
        avisar('ok', 'Listo: la lista se recalculó.');
        verListas();
      }).catch(function (e) { bt.disabled = false; avisar('err', mensajeDe(e)); });
    };
    var t = null;
    $('lsBuscar').oninput = function () { clearTimeout(t); t = setTimeout(pintarTabla, 150); };
    $('lsSolo').onchange = pintarTabla;
    asegurarPrecios(li.id).then(pintarTabla, function (e) { $('lsTabla').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });

    function pintarTabla() {
      var m = S.precios[li.id] || {}, q = $('lsBuscar').value.trim().toLowerCase(), solo = $('lsSolo').checked;
      var filas = LISTA_PROD.map(function (p) { return { cod: p[0], nom: p[1], rubro: p[2] || '' }; });   // SQL 202: todos, no sólo catalogo.js
      Object.keys(m).forEach(function (k) { if (!PROD[k]) filas.push({ cod: k, nom: '(no está en el catálogo)', rubro: '' }); });
      filas = filas.filter(function (f) {
        if (solo && !m[f.cod]) return false;
        return !q || f.cod.toLowerCase().indexOf(q) >= 0 || String(f.nom).toLowerCase().indexOf(q) >= 0;
      });
      var total = filas.length;
      filas = filas.slice(0, 300);
      $('lsTabla').innerHTML = !total ? '<div class="pos-cartel">' + (q ? 'No hay productos con «' + esc(q) + '».' : 'Esta lista no tiene precios todavía.') + '</div>' :
        '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Código</th><th>Producto</th><th>Rubro</th><th class="n">Precio</th>' + (base ? '<th>De dónde sale</th>' : '') + '<th></th></tr></thead><tbody>' +
        filas.map(function (f) {
          var x = m[f.cod];
          return '<tr data-cod="' + esc(f.cod) + '"><td><b>' + esc(f.cod) + '</b></td><td>' + esc(f.nom) + '</td><td>' + esc(f.rubro) + '</td>' +
            '<td class="n pos-precio-celda">' + (x ? plata(x.c) : '<span class="apagado">Sin precio</span>') + '</td>' +
            (base ? '<td>' + (x ? (x.propio ? '<span class="pill pill-warn">Cambiado a mano</span>' : '<span class="apagado">Calculado</span>') : '') + '</td>' : '') +
            '<td class="pos-acc"><button type="button" class="pos-link" data-editar>Cambiar</button>' +
              (x && x.propio ? '<button type="button" class="pos-link" data-borrar>' + (base ? 'Volver al calculado' : 'Sacar') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (total > 300 ? '<p class="pos-mas">Se ven 300 de ' + total + '. Buscá para encontrar el resto.</p>' : '');
    }
    $('lsTabla').onclick = function (e) {
      var b = e.target.closest('button'), tr = b && b.closest('tr[data-cod]');
      if (!tr) return;
      var cod = tr.getAttribute('data-cod');
      if (b.hasAttribute('data-editar')) editarPrecio(tr, cod);
      else if (b.hasAttribute('data-borrar')) {
        if (!confirm(base ? '¿Volver al precio calculado de ' + cod + '?' : '¿Sacar el precio de ' + cod + ' de esta lista?')) return;
        guardarPrecio(cod, null);
      }
    };
    function editarPrecio(tr, cod) {
      var celda = tr.querySelector('.pos-precio-celda'), x = (S.precios[li.id] || {})[cod];
      celda.innerHTML = '<input type="text" inputmode="decimal" class="pos-precio-in" value="' + (x ? plataCampo(x.c) : '') + '" aria-label="Precio de ' + esc(cod) + '">';
      tr.querySelector('.pos-acc').innerHTML = '<button type="button" class="pos-link" data-ok>Guardar</button><button type="button" class="pos-link" data-no>Cancelar</button>';
      var inp = celda.querySelector('input');
      inp.focus(); inp.select();
      function ok() {
        var v = leerPlata(inp.value);
        if (!(v >= 0) || v >= 10000000000) { avisar('err', 'Ese precio no se entiende. Escribilo así: 20000 o 16.333,33'); inp.focus(); return; }
        guardarPrecio(cod, v);
      }
      inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') pintarTabla(); };
      tr.querySelector('[data-ok]').onclick = ok;
      tr.querySelector('[data-no]').onclick = pintarTabla;
    }
    function guardarPrecio(cod, centavos) {
      llamar('pos_precio_guardar', { p_lista: li.id, p_codigo: cod, p_precio: centavos == null ? null : aPesos(centavos) }).then(function () {
        olvidarPrecios(li.id);
        avisar('ok', centavos == null ? 'Listo.' : cod + ': ' + plata(centavos) + '.');
        return asegurarPrecios(li.id).then(pintarTabla);
      }).catch(function (e) { avisar('err', mensajeDe(e)); });
    }
  }

  /* ── Subir la lista de BlueSoft: leer el Excel, mostrar qué cambia y aplicarlo ── */
  function subirLista(li, f) {
    function poner(h) { var z = $('lsSubida'); if (z) z.innerHTML = h; }
    S.subida = null;
    poner('<p class="cargando">Leyendo ' + esc(f.name) + '…</p>');
    leerArchivo(f).then(function (filas) {
      var r = leerPrecios(filas, /\.xlsx$/i.test(f.name));
      if (r.error) { poner('<div class="pos-cartel mal">' + esc(r.error) + '</div>'); return; }
      return asegurarPrecios(li.id).then(function () {
        S.subida = { li: li.id, origen: f.name, r: r, lista: listaDelExcel(r, li), clave: nuevaClave() };
        if (S.listaSel === li.id) previaSubida(li);
      }, function (e) { poner('<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'); });
    }, function (e) { poner('<div class="pos-cartel mal">' + esc(e.message || String(e)) + '</div>'); });
  }
  function previaSubida(li) {
    var U = S.subida, z = $('lsSubida');
    if (!U || !z) return;
    var r = U.r, m = S.precios[li.id] || {}, ks = Object.keys(r.listas);
    var items = [], errores = r.errores.slice(), cambios = [], vistos = {}, suben = 0, bajan = 0, nuevos = 0, grandes = 0, noVienen = 0;
    if (U.lista != null) {
      r.items.forEach(function (x) {
        if (ks.length > 1 && x.lista !== U.lista) return;
        var y = vistos[x.codigo];
        if (y) { if (y.precio !== x.precio) errores.push('Fila ' + x.fila + ': ' + x.codigo + ' está dos veces con precios distintos (vale el de la fila ' + y.fila + ').'); return; }
        vistos[x.codigo] = x;
        items.push(x);
      });
      items.forEach(function (x) {
        var a = m[x.codigo] ? m[x.codigo].c : null;
        if (a === x.precio) return;
        /* Más de la mitad, para arriba o para abajo: puede ser un error del Excel (un "41.000" leído como 41). */
        var g = a != null && (x.precio > a * 1.5 || x.precio < a * 0.5);
        if (a == null) nuevos++; else if (x.precio > a) suben++; else bajan++;
        if (g) grandes++;
        cambios.push({ x: x, antes: a, grande: g });
      });
      cambios.sort(function (p, q) { return (q.grande - p.grande) || (p.x.codigo < q.x.codigo ? -1 : p.x.codigo > q.x.codigo ? 1 : 0); });
      noVienen = Object.keys(m).filter(function (k) { return !vistos[k]; }).length;
    }
    var info = (r.ceros ? num(r.ceros) + (r.ceros === 1 ? ' renglón sin precio (vacío, en $0 o negativo) no se carga. ' : ' renglones sin precio (vacíos, en $0 o negativos) no se cargan. ') : '') +
               (noVienen ? num(noVienen) + (noVienen === 1 ? ' producto de la lista no viene' : ' productos de la lista no vienen') + ' en el Excel: quedan con el precio de ahora. ' : '') +
               dondeValeLista(li);
    z.innerHTML = '<div class="cj-paso ls-subida"><div class="cj-paso-cab"><b>Lista subida</b><span>' + esc(U.origen) + '</span></div>' +
      (ks.length > 1 ? '<p class="ls-preg">El Excel trae ' + ks.length + ' listas: ¿cuál va en «' + esc(li.nombre) + '»?</p>' +
        '<div class="pos-listas-elegir" role="group" aria-label="Lista del Excel">' + ks.map(function (k) {
          return '<button type="button" class="chip' + (U.lista === k ? ' sel' : '') + '" data-lx="' + esc(k) + '">' + esc(r.listas[k].nombre) + ' (' + num(r.listas[k].n) + ')</button>';
        }).join('') + '</div>' : '') +
      (U.lista == null ? '' :
        '<div class="pos-totales">' +
          '<div class="pos-kpi"><span>En el Excel</span><b>' + num(items.length) + '</b></div>' +
          '<div class="pos-kpi fuerte"><span>Cambian</span><b>' + num(cambios.length) + '</b></div>' +
          '<div class="pos-kpi"><span>Suben</span><b>' + num(suben) + '</b></div>' +
          '<div class="pos-kpi"><span>Bajan</span><b>' + num(bajan) + '</b></div>' +
          '<div class="pos-kpi"><span>Nuevos</span><b>' + num(nuevos) + '</b></div></div>' +
        (grandes ? '<div class="pos-cartel st-dif"><b>Ojo:</b> ' + (grandes === 1 ? '1 precio cambia' : num(grandes) + ' precios cambian') +
          ' más de la mitad (están arriba de todo, en naranja). Revisalos antes de aplicar.</div>' : '') +
        (errores.length ? '<div class="pos-cartel mal">' + (errores.length === 1 ? 'No se carga 1 renglón' : 'No se cargan ' + num(errores.length) + ' renglones') + ': ' +
          esc(errores.slice(0, 6).join(' ')) + (errores.length > 6 ? '…' : '') + '</div>' : '') +
        (cambios.length ? '' : '<div class="pos-cartel st-ok">Todo coincide con la lista: no cambia ningún precio.</div>') +
        '<p class="pos-ayuda ls-info">' + esc(info) + '</p>' +
        (cambios.length ? '<div class="pos-marco-tabla ls-previa"><table class="pos-tabla"><thead><tr><th>Código</th><th>Producto</th><th>Rubro</th>' +
            '<th class="n">Antes</th><th class="n">Ahora</th><th class="n">Cambio</th></tr></thead><tbody>' +
          cambios.slice(0, 200).map(function (k) {
            var x = k.x, rubro = x.rubro || (PROD[x.codigo] && PROD[x.codigo][2]) || '';
            return '<tr><td><b>' + esc(x.codigo) + '</b></td><td>' + esc(nombreProd(x.codigo, x.nombre)) + '</td><td>' + esc(rubro + (x.familia ? ' · ' + x.familia : '')) + '</td>' +
              '<td class="n">' + (k.antes == null ? '<span class="apagado">—</span>' : plata(k.antes)) + '</td><td class="n"><b>' + plata(x.precio) + '</b></td>' +
              '<td class="n">' + (k.antes == null ? '<span class="pill pill-info">Nuevo</span>' :
                k.grande ? '<span class="pill pill-warn">' + difPrecio(k.antes, x.precio) + '</span>' : difPrecio(k.antes, x.precio)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (cambios.length > 200 ? '<p class="pos-mas">Se ven 200 de ' + num(cambios.length) + ' cambios.</p>' : '') : '')) +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" id="lsSubNo">Cancelar</button>' +
        (U.lista == null || !cambios.length ? '' : '<button type="button" class="btn btn-pri btn-chico" id="lsSubSi">Aplicar ' +
          (cambios.length === 1 ? '1 precio' : num(cambios.length) + ' precios') + '</button>') + '</div></div>';
    z.querySelectorAll('[data-lx]').forEach(function (b) { b.onclick = function () { U.lista = b.getAttribute('data-lx'); previaSubida(li); }; });
    $('lsSubNo').onclick = function () { S.subida = null; z.innerHTML = ''; };
    if ($('lsSubSi')) $('lsSubSi').onclick = function () { aplicarSubida(li, items, cambios.length, nuevos, this); };
  }
  function aplicarSubida(li, items, n, nuevos, bt) {
    var U = S.subida;
    if (!confirm('¿Aplicar los precios del Excel a «' + li.nombre + '»? Cambian ' + num(n) + (nuevos ? ' (' + num(nuevos) + (nuevos === 1 ? ' es nuevo)' : ' son nuevos)') : '') +
                 '. ' + dondeValeLista(li) + ' Si hace falta, se deshace desde «Cambios en bloque».')) return;
    var txt = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Aplicando…';
    llamar('pos_lista_subir', { p_lista: li.id, p_origen: U.origen, p_clave: U.clave, p_filas: items.map(function (x) {
      return [x.codigo, aPesos(x.precio), x.nombre || null, x.rubro || null, x.familia || null, x.temporada || null];
    }) }).then(function (r) {
      if (S.subida === U) S.subida = null;
      olvidarPrecios(li.id);
      avisar('ok', r.ya ? 'Esa lista ya estaba aplicada: no se repitió.' : 'Listo: ' + (r.cambiaron === 1 ? 'cambió 1 precio' : 'cambiaron ' + num(r.cambiaron) + ' precios') +
                   (r.nuevos ? ' (' + num(r.nuevos) + (r.nuevos === 1 ? ' nuevo)' : ' nuevos)') : '') + '. Valen desde la próxima venta.');
      if ($('lsTabla') && S.listaSel === li.id) verListas();
    }).catch(function (e) {
      bt.disabled = false;
      bt.textContent = txt;
      avisar('err', esDeRed(e) ? 'No se pudo aplicar: sin conexión. Probá de nuevo; no se aplica dos veces.' : mensajeDe(e));
    });
  }

  /* ── Aumentar (o bajar) con un porcentaje: toda la lista, un rubro o una familia de un rubro ── */
  function aumentarLista(li) {
    var A = { previa: null, rubros: {} };
    var caja = ventana('<h3 id="posVentTit">Aumentar precios</h3>' +
      '<p class="pos-bajada">De «' + esc(li.nombre) + '». ' + esc(dondeValeLista(li)) + '</p>' +
      '<div class="ls-aum">' +
        campo('ls-pct', 'Porcentaje', '<input type="text" inputmode="decimal" id="laPct" placeholder="10" autocomplete="off" autofocus>') +
        campo('', 'Rubro', '<select id="laRubro" disabled><option value="">Cargando…</option></select>') +
        campo('', 'Familia', '<select id="laFam" disabled><option value="">Todas las familias</option></select>') +
        campo('', 'Redondeo', '<select id="laRed">' + opciones(REDONDEOS, 100) + '</select>') +
        '<button type="button" class="btn btn-sec btn-chico" id="laVer">Ver qué cambia</button></div>' +
      '<p class="pos-ayuda">Para bajar, con el signo menos: −10. Redondea al más cercano: con «A $100», $45.130 queda en $45.100.<span id="laSinRubro"></span></p>' +
      '<div id="laPrevia"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="laAplicar" disabled>Aplicar</button></div>', true);
    function q(id) { return caja.querySelector('#' + id); }
    function olvidar() {
      A.previa = null;
      q('laPrevia').innerHTML = '';
      q('laAplicar').disabled = true;
      q('laAplicar').textContent = 'Aplicar';
    }
    llamar('pos_lista_rubros', { p_lista: li.id }).then(function (d) {
      (d.rubros || []).forEach(function (x) {
        var r = A.rubros[x[0]] = A.rubros[x[0]] || { n: 0, fams: [] };
        r.n += x[2];
        if (x[1]) r.fams.push([x[1], x[1] + ' (' + num(x[2]) + ')']);
      });
      var rs = Object.keys(A.rubros).sort(function (a, b) { return a.localeCompare(b, 'es'); });
      q('laRubro').innerHTML = opciones([['', 'Todos los rubros (' + num(d.total) + ')']].concat(rs.map(function (r) { return [r, r + ' (' + num(A.rubros[r].n) + ')']; })), '');
      q('laRubro').disabled = false;
      if (d.sin_rubro) q('laSinRubro').textContent = ' ' + (d.sin_rubro === 1 ? '1 producto no tiene rubro: sólo cambia' : num(d.sin_rubro) + ' productos no tienen rubro: sólo cambian') + ' con «Todos los rubros».';
    }).catch(function (e) { q('laRubro').innerHTML = '<option value="">Todos los rubros</option>'; q('laRubro').disabled = false; avisar('err', mensajeDe(e)); });
    q('laRubro').onchange = function () {
      var r = A.rubros[this.value], f = q('laFam');
      f.innerHTML = opciones([['', 'Todas las familias']].concat(r ? r.fams.slice().sort(function (a, b) { return a[0].localeCompare(b[0], 'es'); }) : []), '');
      f.disabled = !r || !r.fams.length;
      olvidar();
    };
    q('laFam').onchange = olvidar;
    q('laRed').onchange = olvidar;
    q('laPct').oninput = olvidar;
    q('laPct').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); ver(); } };
    q('laVer').onclick = ver;
    function pedido() {
      return { p_lista: li.id, p_porcentaje: leerPorcentaje(q('laPct').value), p_rubro: q('laRubro').value || null,
               p_familia: q('laFam').value || null, p_redondeo: Number(q('laRed').value) };
    }
    function ver() {
      var p = pedido(), bt = q('laVer');
      if (!(p.p_porcentaje > -90 && p.p_porcentaje <= 200) || p.p_porcentaje === 0) {
        avisar('err', 'Escribí el porcentaje: de −89 a 200, sin el 0 (para bajar, con el signo menos: −10).');
        q('laPct').focus();
        return;
      }
      olvidar();
      bt.disabled = true;
      q('laPrevia').innerHTML = '<p class="cargando">Calculando…</p>';
      llamar('pos_lista_aumentar', Object.assign({ p_aplicar: false, p_clave: null }, p)).then(function (d) {
        bt.disabled = false;
        if (!_velo || !caja.isConnected) return;
        var dif = d.suma_antes > 0 ? difPrecio(Number(d.suma_antes), Number(d.suma_despues)) : '';
        q('laPrevia').innerHTML = !d.cambian ? '<div class="pos-cartel">' + (d.cuantos ? 'Con ese porcentaje y ese redondeo no cambia ningún precio.' : 'No hay productos con precio en lo que elegiste.') + '</div>' :
          '<div class="pos-totales"><div class="pos-kpi"><span>Productos</span><b>' + num(d.cuantos) + '</b></div>' +
            '<div class="pos-kpi fuerte"><span>Cambian</span><b>' + num(d.cambian) + '</b></div>' +
            '<div class="pos-kpi"><span>En total</span><b>' + esc(dif) + '</b></div></div>' +
          '<div class="pos-marco-tabla ls-previa"><table class="pos-tabla"><thead><tr><th>Código</th><th>Producto</th><th class="n">Antes</th><th class="n">Ahora</th></tr></thead><tbody>' +
            d.filas.map(function (f) {
              return '<tr><td><b>' + esc(f[0]) + '</b></td><td>' + esc(nombreProd(f[0], f[1])) + '</td><td class="n">' + plata(cent(f[2])) + '</td><td class="n"><b>' + plata(cent(f[3])) + '</b></td></tr>';
            }).join('') + '</tbody></table></div>' +
          (d.cambian > d.filas.length ? '<p class="pos-mas">Se ven ' + num(d.filas.length) + ' de ' + num(d.cambian) + '.</p>' : '');
        if (!d.cambian) return;
        A.previa = { p: p, n: d.cambian, clave: nuevaClave() };
        q('laAplicar').disabled = false;
        q('laAplicar').textContent = (p.p_porcentaje > 0 ? 'Aumentar ' : 'Bajar ') + (d.cambian === 1 ? '1 precio' : num(d.cambian) + ' precios');
      }).catch(function (e) { bt.disabled = false; q('laPrevia').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    q('laAplicar').onclick = function () {
      var P = A.previa, bt = this;
      if (!P) return;
      var que = P.p.p_rubro ? ' de ' + P.p.p_rubro + (P.p.p_familia ? ' · ' + P.p.p_familia : '') : '';
      if (!confirm('¿' + (P.p.p_porcentaje > 0 ? 'Aumentar' : 'Bajar') + ' un ' + textoPorcentaje(P.p.p_porcentaje) + ' % ' + (P.n === 1 ? '1 precio' : num(P.n) + ' precios') + que +
                   ' en «' + li.nombre + '»? ' + dondeValeLista(li) + ' Si hace falta, se deshace desde «Cambios en bloque».')) return;
      bt.disabled = true;
      bt.textContent = 'Aplicando…';
      llamar('pos_lista_aumentar', Object.assign({ p_aplicar: true, p_clave: P.clave }, P.p)).then(function (r) {
        cerrarVentana();
        olvidarPrecios(li.id);
        avisar('ok', r.ya ? 'Ese cambio ya estaba aplicado: no se repitió.' : 'Listo: ' + (r.cambiaron === 1 ? 'cambió 1 precio' : 'cambiaron ' + num(r.cambiaron) + ' precios') + '. Valen desde la próxima venta.');
        if ($('lsTabla') && S.listaSel === li.id) verListas();
      }).catch(function (e) {
        bt.disabled = false;
        bt.textContent = (P.p.p_porcentaje > 0 ? 'Aumentar ' : 'Bajar ') + (P.n === 1 ? '1 precio' : num(P.n) + ' precios');
        avisar('err', esDeRed(e) ? 'No se pudo aplicar: sin conexión. Probá de nuevo; no se aplica dos veces.' : mensajeDe(e));
      });
    };
  }

  /* ── Los cambios en bloque de una lista (subidas y aumentos), con «Deshacer» en el último ── */
  function cambiosDeLista(li) {
    llamar('pos_lista_cambios', { p_lista: li.id }).then(function (h) {
      var z = $('lsCambios');
      if (!z || S.listaSel !== li.id) return;
      if (!h.length) { z.innerHTML = ''; return; }
      var ver = S.lsTodos ? h : h.slice(0, 3);
      z.innerHTML = '<div class="st-tit-fila"><h3 class="st-tit">Cambios en bloque</h3>' +
          (h.length > 3 ? '<div><button type="button" class="pos-link" id="lsTodos">' + (S.lsTodos ? 'Ver menos' : 'Ver los ' + h.length) + '</button></div>' : '') + '</div>' +
        '<div class="pos-marco-tabla ls-cambios"><table class="pos-tabla"><thead><tr><th>Fecha</th><th>Quién</th><th>Qué</th><th class="n">Precios</th><th></th></tr></thead><tbody>' +
        ver.map(function (x) {
          return '<tr' + (x.deshecho ? ' class="anulada"' : '') + '><td>' + esc(fechaHora(x.fecha)) + '</td><td>' + esc(x.persona || '—') + '</td><td>' + esc(x.detalle) + '</td>' +
            '<td class="n">' + num(x.cambiaron) + '</td><td class="pos-acc">' +
            (x.deshecho ? 'Deshecho el ' + esc(fechaHora(x.deshecho)) + (x.deshizo ? ' por ' + esc(x.deshizo) : '') :
             x.se_deshace ? '<button type="button" class="pos-link" data-deshacer="' + x.id + '">Deshacer</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      if ($('lsTodos')) $('lsTodos').onclick = function () { S.lsTodos = !S.lsTodos; cambiosDeLista(li); };
      z.querySelectorAll('[data-deshacer]').forEach(function (b) {
        b.onclick = function () {
          var x = h.filter(function (y) { return String(y.id) === b.getAttribute('data-deshacer'); })[0];
          if (!x || !confirm('¿Deshacer «' + x.detalle + '»? ' + (x.cambiaron === 1 ? 'El precio vuelve' : 'Los ' + num(x.cambiaron) + ' precios vuelven') +
                             ' a como estaban antes (los nuevos se sacan). Los que alguien cambió a mano después quedan como están.')) return;
          b.disabled = true;
          llamar('pos_lista_deshacer', { p_id: x.id }).then(function (r) {
            olvidarPrecios(li.id);
            avisar('ok', 'Listo: ' + (r.volvieron === 1 ? 'volvió 1 precio' : 'volvieron ' + num(r.volvieron) + ' precios') + '.' +
                         (r.quedaron ? ' ' + (r.quedaron === 1 ? '1 quedó como estaba porque se cambió' : num(r.quedaron) + ' quedaron como estaban porque se cambiaron') + ' a mano después.' : ''));
            if ($('lsTabla') && S.listaSel === li.id) verListas();
          }).catch(function (e) { b.disabled = false; avisar('err', mensajeDe(e)); });
        };
      });
    }).catch(function (e) {
      var z = $('lsCambios');
      if (z && S.listaSel === li.id) z.innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     PROMOCIONES
     ════════════════════════════════════════════════════════════════════ */
  function describirPromo(p) {
    var que = p.tipo === 'lleva_paga' ? 'Lleva ' + p.lleva + ', paga ' + p.paga + ' (las más baratas, gratis)' :
              p.tipo === 'segunda' ? 'La segunda prenda al ' + String(Number(p.porcentaje)).replace('.', ',') + ' % (de a pares, la más barata)' :
              String(Number(p.porcentaje)).replace('.', ',') + ' % pagando todo con ' + (MEDIOS[p.medio] || p.medio);
    var para = p.rubros && p.rubros.length ? 'Sólo ' + p.rubros.join(', ') : 'Para todo';
    var cuando = p.desde || p.hasta ? (p.desde ? 'Desde el ' + fechaCorta(p.desde) : '') + (p.hasta ? (p.desde ? ' hasta el ' : 'Hasta el ') + fechaCorta(p.hasta) : '') : 'Siempre';
    return que + ' · ' + para + ' · ' + (p.combinable ? 'se suma a las otras' : 'no se suma a otras') + ' · ' + cuando;
  }
  function verPromos() {
    var c = $('cuerpo');
    c.innerHTML = cabeza('Promociones', 'No se aplican solas: en la venta, el vendedor elige la que corresponde en «Descuentos +» y el sistema hace la cuenta. Sólo se ofrecen las prendidas.',
        '<button type="button" class="btn btn-pri btn-chico" id="prNueva">Nueva promoción</button>') +
      '<div class="pos-promos">' + ((S.ini.promos || []).length ? S.ini.promos.map(function (p) {
        return '<div class="pos-promo' + (p.activo ? '' : ' apagada') + '"><label class="pos-switch" title="' + (p.activo ? 'Prendida: se ofrece en la venta' : 'Apagada: no se ofrece') + '"><input type="checkbox" data-activa="' + p.id + '"' + (p.activo ? ' checked' : '') +
          ' aria-label="' + esc(p.nombre) + ' activa"><i></i></label><div><b>' + esc(p.nombre) + '</b><small>' + esc(describirPromo(p)) + '</small></div>' +
          '<button type="button" class="btn btn-sec btn-chico" data-editar="' + p.id + '">Editar</button></div>';
      }).join('') : '<div class="pos-cartel">Todavía no hay promociones.</div>') + '</div>';
    $('prNueva').onclick = function () { editarPromo(null); };
    c.querySelectorAll('[data-editar]').forEach(function (b) { b.onclick = function () { editarPromo(promoDe(Number(b.getAttribute('data-editar')))); }; });
    c.querySelectorAll('[data-activa]').forEach(function (i) {
      i.onchange = function () {
        var p = Object.assign({}, promoDe(Number(i.getAttribute('data-activa'))), { activo: i.checked });
        guardarPromo(p).then(function () { avisar('ok', p.nombre + (p.activo ? ': activa.' : ': apagada.')); }, function () { i.checked = !i.checked; });
      };
    });
  }
  function promoDe(id) { return (S.ini.promos || []).filter(function (p) { return p.id === id; })[0]; }
  function guardarPromo(p) {
    return llamar('pos_promo_guardar', { p: p }).then(function () { return llamar('pos_inicio'); }).then(function (ini) {
      S.ini = ini;
      if (S.vista === 'promos') verPromos();
    }).catch(function (e) { avisar('err', mensajeDe(e)); throw e; });
  }
  function editarPromo(p) {
    var x = p ? Object.assign({}, p) : { nombre: '', tipo: 'lleva_paga', lleva: 3, paga: 2, porcentaje: null, medio: 'efectivo', rubros: null, combinable: false, desde: null, hasta: null, activo: true };
    var rub = {};
    (x.rubros || []).forEach(function (r) { rub[r] = 1; });
    var caja = ventana('<h3 id="posVentTit">' + (p ? 'Editar la promoción' : 'Nueva promoción') + '</h3>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Nombre', '<input type="text" id="prNombre" maxlength="60" autofocus value="' + esc(x.nombre) + '" placeholder="3x2 en remeras">') +
        campo('ancho', 'Tipo', '<select id="prTipo">' + opciones(Object.keys(TIPOS_PROMO).map(function (k) { return [k, TIPOS_PROMO[k]]; }), x.tipo) + '</select>') +
        campo('', 'Lleva', '<input type="number" id="prLleva" min="2" max="10" value="' + (x.lleva || 3) + '">', ' data-solo="lleva_paga"') +
        campo('', 'Paga', '<input type="number" id="prPaga" min="1" max="9" value="' + (x.paga || 2) + '">', ' data-solo="lleva_paga"') +
        campo('', 'Porcentaje', '<input type="text" inputmode="decimal" id="prPct" value="' + (x.porcentaje ? String(Number(x.porcentaje)).replace('.', ',') : '') + '">', ' data-solo="segunda medio_pago"') +
        campo('', 'Pagando con', '<select id="prMedio">' + opciones(Object.keys(MEDIOS).map(function (k) { return [k, MEDIOS[k]]; }), x.medio || 'efectivo') + '</select>', ' data-solo="medio_pago"') +
        '<div class="pos-f ancho"><span>Para qué rubros (ninguno marcado: para todo)</span><div class="chips" id="prRubros">' +
          RUBROS.map(function (r) { return '<button type="button" class="chip' + (rub[r] ? ' sel' : '') + '" data-rubro="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '</div></div>' +
        campo('', 'Desde <span class="lbl-opc">(opcional)</span>', '<input type="date" id="prDesde" value="' + esc(x.desde || '') + '">') +
        campo('', 'Hasta <span class="lbl-opc">(opcional)</span>', '<input type="date" id="prHasta" value="' + esc(x.hasta || '') + '">') +
        '<label class="pos-check ancho"><input type="checkbox" id="prComb"' + (x.combinable ? ' checked' : '') + '> Se suma a las otras promos (como el 10 % en efectivo)</label>' +
        '<label class="pos-check ancho"><input type="checkbox" id="prActiva"' + (x.activo ? ' checked' : '') + '> Activa</label>' +
      '</div><div class="pos-error" id="prError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="prOk">Guardar</button></div>');
    function mostrar() {
      var t = caja.querySelector('#prTipo').value;
      caja.querySelectorAll('[data-solo]').forEach(function (e) { e.hidden = e.getAttribute('data-solo').split(' ').indexOf(t) < 0; });
    }
    mostrar();
    caja.querySelector('#prTipo').onchange = mostrar;
    caja.querySelector('#prRubros').onclick = function (e) {
      var b = e.target.closest('[data-rubro]');
      if (!b) return;
      var r = b.getAttribute('data-rubro');
      if (rub[r]) delete rub[r]; else rub[r] = 1;
      b.classList.toggle('sel', !!rub[r]);
    };
    caja.querySelector('#prOk').onclick = function () {
      var t = caja.querySelector('#prTipo').value, bt = this;
      var y = { nombre: caja.querySelector('#prNombre').value.trim(), tipo: t, activo: caja.querySelector('#prActiva').checked,
                combinable: caja.querySelector('#prComb').checked, desde: caja.querySelector('#prDesde').value || null,
                hasta: caja.querySelector('#prHasta').value || null, rubros: Object.keys(rub).sort() };
      if (p) { y.id = p.id; y.orden = p.orden; }
      var lleva = parseInt(caja.querySelector('#prLleva').value, 10), paga = parseInt(caja.querySelector('#prPaga').value, 10);
      var pct = parseFloat(String(caja.querySelector('#prPct').value).replace(',', '.'));
      if (t === 'lleva_paga') { y.lleva = lleva; y.paga = paga; } else { y.porcentaje = pct; }
      if (t === 'medio_pago') y.medio = caja.querySelector('#prMedio').value;
      var mal = !y.nombre ? 'Ponele un nombre.' :
        t === 'lleva_paga' && !(lleva >= 2 && lleva <= 10 && paga >= 1 && paga < lleva) ? 'Lleva va de 2 a 10, y paga tiene que ser menos que lleva.' :
        t !== 'lleva_paga' && !(pct > 0 && pct <= 100) ? 'El porcentaje va de 0 a 100.' :
        y.desde && y.hasta && y.desde > y.hasta ? '"Desde" tiene que ser antes que "hasta".' : '';
      if (!errorEn(caja, 'prError', mal)) return;
      bt.disabled = true;
      guardarPromo(y).then(function () { cerrarVentana(); avisar('ok', 'Promoción guardada.'); }, function () { bt.disabled = false; });
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     SUCURSALES
     ════════════════════════════════════════════════════════════════════ */
  function verSucursales() {
    var c = $('cuerpo');
    c.innerHTML = cabeza('Sucursales', 'Qué lista de precios usa cada una, su punto de venta de ARCA y si ya vende con el POS (el piloto). Se guarda solo.') +
      '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Sucursal</th><th>Lista de precios</th><th>Punto de venta (ARCA)</th><th>Vende con el POS</th></tr></thead><tbody>' +
      S.ini.locales.map(function (l) {
        return '<tr data-local="' + esc(l.id) + '"><td><b>' + esc(nombreLocal(l)) + '</b></td>' +
          '<td><select data-k="lista" aria-label="Lista de ' + esc(nombreLocal(l)) + '">' + opciones(S.ini.listas.map(function (x) { return [x.id, x.nombre]; }), l.lista_id) + '</select></td>' +
          '<td><input type="number" data-k="pv" min="1" max="99999" value="' + (l.punto_venta || '') + '" placeholder="Falta" style="width:110px" aria-label="Punto de venta de ' + esc(nombreLocal(l)) + '"></td>' +
          '<td><label class="pos-check"><input type="checkbox" data-k="hab"' + (l.habilitada ? ' checked' : '') + '> Piloto</label></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="pos-mas">El punto de venta lo da ARCA para cada local (se puede seguir usando el de BlueSoft: lo confirma el contador). "Piloto" todavía no cambia nada: por ahora el POS lo usa sólo Administración.</p>';
    c.querySelector('tbody').addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-local]');
      if (!tr) return;
      var l = localDe(tr.getAttribute('data-local'));
      var lista = Number(tr.querySelector('[data-k="lista"]').value), pvTxt = tr.querySelector('[data-k="pv"]').value, hab = tr.querySelector('[data-k="hab"]').checked;
      var pv = pvTxt ? parseInt(pvTxt, 10) : null;
      if (pvTxt && !(pv >= 1 && pv <= 99999)) { avisar('err', 'El punto de venta va del 1 al 99999.'); return; }
      llamar('pos_sucursal_guardar', { p_local: l.id, p_lista: lista, p_punto_venta: pv, p_habilitada: hab }).then(function () {
        l.lista_id = lista; l.punto_venta = pv; l.habilitada = hab;
        avisar('ok', nombreLocal(l) + ': guardado.');
      }).catch(function (er) { avisar('err', mensajeDe(er)); verSucursales(); });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     EL STOCK Y LOS REMITOS (SQL 160)
     Mauricio (22/10): "si me mandan un remito de fábrica… que me llega al
     local para yo poder verificar la ropa que me entró y darlo por
     recibido, entonces el stock me ingresa al local". Como hoy en BlueSoft:
     se busca cada producto del remito, se cuenta por talle y color y, si
     coincide, queda recibido. Con las dos mejoras que aprobó ("las dos
     mejoras que proponés… ya no tenemos que utilizar más papel"):
     · se cuenta A CIEGAS: primero lo que llegó y recién después se compara
       con el remito, como el efectivo en el cierre de caja;
     · la hoja de papel la reemplaza el conteo guardado (quién, cuándo, qué).
     En el mostrador: Remitos (recibir) y Stock (mirar). En Gestión: Stock
     (con los ajustes), Remitos (cargarlos, verlos y anularlos) e Inventario
     (la carga desde el Excel de "Consulta de stock" de BlueSoft).
     Las pruebas no tocan el stock: con el modo prueba no se reciben remitos.
     ════════════════════════════════════════════════════════════════════ */
  var ESTADO_REMITO = { pendiente: ['Por recibir', 'pill-warn'], recibido: ['Recibido', 'pill-ok'],
                        con_diferencias: ['Con diferencias', 'pill-bad'], anulado: ['Anulado', 'pill-bad'] };
  var MOTIVOS_AJUSTE = ['Falla', 'Robo o faltante', 'Error de carga', 'Apareció', 'Otro'];
  /* Qué pasó cuando un producto llega distinto del remito (SQL 167: la misma lista que la base), y cómo se resolvió. */
  var MOTIVOS_REM = ['Vino otro talle', 'Vino otro color', 'Vino fallada', 'Otro'];
  var RESOLUCION = { mandar: 'Mandan lo que faltó', devolver: 'Lo devuelven a la fábrica', remito_mal: 'El remito estaba mal', otra: 'Otra solución' };
  var RESOLUCION_CORTA = { mandar: 'Lo mandan', devolver: 'Lo devuelven', remito_mal: 'Remito mal', otra: 'Otra solución' };   // en la tabla, para que entre
  var ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'U', 'UNICO', 'ÚNICO'];

  function refRemito(r) { return 'R-' + r.numero; }
  function pillRemito(e) { var x = ESTADO_REMITO[e] || [e, '']; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function normal(s) { return sinTildes(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function unicos(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  /** Con el signo menos de verdad y los miles con punto: −3, 1.250. */
  function num(n) { n = Number(n) || 0; return (n < 0 ? '−' : '') + miles(Math.abs(n)); }
  function nombreProd(cod, desc) { return PROD[cod] ? PROD[cod][1] : (desc || cod); }
  function nombreTalle(t) { return t || 'Único'; }
  function nombreCol(c, cod) { return c ? nombreColor(c, cod) : 'Sin color'; }
  function engancharIr(z) { z.querySelectorAll('.pos-acciones [data-ir], [data-ir].pos-link').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; }); }
  /** La sucursal del stock y los remitos (la última que eligió, o la del local). */
  function localStock() { var l = localMio(S.stLocal) || localInicial(); S.stLocal = l.id; return l; }

  /* Los talles en el orden del catálogo; si no están, el de siempre (XS, S, M…), y los números de menor a mayor. */
  function ordenarTalles(ts, cod) {
    var cat = tallesDe(PROD[cod]);
    function pos(t) {
      var i = cat.indexOf(t);
      if (i >= 0) return [0, i];
      i = ORDEN_TALLES.indexOf(t);
      if (i >= 0) return [1, i];
      return isNaN(parseFloat(t)) ? [3, 0] : [2, parseFloat(t)];
    }
    return ts.slice().sort(function (a, b) {
      var x = pos(a), y = pos(b);
      return x[0] - y[0] || x[1] - y[1] || String(a).localeCompare(String(b), 'es');
    });
  }
  function ordenarColores(cs, cod) {
    var cat = coloresDe(PROD[cod]).map(function (x) { return x.cod; });
    return cs.slice().sort(function (a, b) {
      var i = cat.indexOf(a), j = cat.indexOf(b);
      if (i >= 0 || j >= 0) return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
      return nombreCol(a, cod).localeCompare(nombreCol(b, cod), 'es');
    });
  }
  /** El color como lo guarda el POS (la sigla del catálogo, "NE"): si viene el nombre ("Negro"), se traduce. */
  function siglaColor(cod, color) {
    color = String(color == null ? '' : color).trim().toUpperCase();
    if (!color) return '';
    var cs = coloresDe(PROD[cod]);
    if (cs.some(function (x) { return x.cod === color; })) return color;
    var n = cs.filter(function (x) { return sinTildes(x.nom).toUpperCase() === sinTildes(color); })[0];
    return n ? n.cod : color;
  }

  /* ── Leer un Excel o lo que pegan ─────────────────────────────────────
     Un .xlsx es un zip con XML adentro: se lee sin librerías, como el
     respaldo del stock de la fábrica (el navegador descomprime). */
  function leerExcel(archivo) {
    if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('Este navegador no puede abrir el Excel: copiá las columnas y usá «Pegar».'));
    return archivo.arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab), dv = new DataView(ab), fin = -1, td = new TextDecoder('utf-8'), i;
      for (i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
      if (fin < 0) throw new Error('El archivo no es un Excel (.xlsx). Si es un .xls viejo, abrilo y guardalo como .xlsx.');
      var total = dv.getUint16(fin + 10, true), p = dv.getUint32(fin + 16, true), arch = {};
      for (var k = 0; k < total && p + 46 <= u.length && dv.getUint32(p, true) === 0x02014b50; k++) {
        var ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
        arch[td.decode(u.subarray(p + 46, p + 46 + ln))] = { metodo: dv.getUint16(p + 10, true), comp: dv.getUint32(p + 20, true), local: dv.getUint32(p + 42, true) };
        p += 46 + ln + le + lc;
      }
      function leer(n) {
        var a = arch[n];
        if (!a) return Promise.resolve(null);
        var ini = a.local + 30 + dv.getUint16(a.local + 26, true) + dv.getUint16(a.local + 28, true), datos = u.subarray(ini, ini + a.comp);
        if (a.metodo !== 8) return Promise.resolve(td.decode(datos));
        return new Response(new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      }
      var hojas = Object.keys(arch).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
        .sort(function (a, b) { return parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10); });
      var hoja = arch['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : hojas[0];
      if (!hoja) throw new Error('El Excel no tiene hojas.');
      return Promise.all([leer('xl/sharedStrings.xml'), leer(hoja)]).then(function (x) { return filasDeXml(x[0], x[1]); });
    });
  }
  function textoXml(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  /* Las filas de la hoja, como listas de textos (cada celda en su columna: A es 0, B es 1…). */
  function filasDeXml(ss, hoja) {
    var comp = [];
    if (ss) ss.split('<si>').slice(1).forEach(function (t) { comp.push(textoXml(t.slice(0, t.indexOf('</si>')))); });
    return String(hoja || '').split('<row').slice(1).map(function (r) {
      var fila = [], cierre = r.indexOf('</row>');
      r.slice(0, cierre > -1 ? cierre : undefined).split('<c ').slice(1).forEach(function (c) {
        var ref = (/r="([A-Z]+)\d+"/.exec(c) || [])[1];
        if (!ref) return;
        var cab = c.slice(0, c.indexOf('>')), tipo = (/\st="([^"]+)"/.exec(' ' + cab) || [])[1];
        var v = (/<v>([\s\S]*?)<\/v>/.exec(c) || [])[1];
        if (tipo === 's') v = comp[Number(v)];
        else if (tipo === 'inlineStr') v = textoXml((/<is>([\s\S]*?)<\/is>/.exec(c) || [])[1] || '');
        else if (v !== undefined) v = textoXml(v);
        var col = 0;
        for (var i = 0; i < ref.length; i++) col = col * 26 + ref.charCodeAt(i) - 64;
        fila[col - 1] = v === undefined ? '' : String(v).trim();
      });
      return fila;
    });
  }
  /** Lo que pegan desde Excel (con tabulaciones), o un CSV, o renglones como los de la pistola ("RM41641 S NE 2"). */
  function filasDeTexto(t) {
    var lineas = String(t || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    var sep = lineas.some(function (l) { return l.indexOf('\t') >= 0; }) ? '\t' : lineas.some(function (l) { return l.indexOf(';') >= 0; }) ? ';' :
              lineas.some(function (l) { return l.indexOf(',') >= 0; }) ? ',' : /\s+/;
    /* Con tabulaciones (o ; o ,) el renglón no se recorta: si la primera celda está vacía (el rubro), las columnas se correrían. */
    return lineas.map(function (l) { return (typeof sep === 'string' ? l : l.trim()).split(sep).map(function (c) { return c.trim().replace(/^"(.*)"$/, '$1'); }); });
  }
  /** Las filas → los renglones {codigo, descripcion, talle, color, cantidad}, y los que no se entienden.
      Busca la fila de los títulos (la que dice "Código", como la "Consulta de stock" de BlueSoft); sin
      títulos: Código · Talle · Color · Cantidad (o Código · Cantidad). Con negativos (el inventario), valen. */
  function leerTabla(filas, negativos) {
    var iCab = -1, ic = null, i;
    var esCod = /^(codigo|cod\.?|articulo|sku)$/;
    for (i = 0; i < Math.min(filas.length, 20); i++) {
      if ((filas[i] || []).some(function (c) { return esCod.test(normal(c)); })) { iCab = i; break; }
    }
    if (iCab >= 0) {
      var cab = filas[iCab].map(normal);
      var busca = function (re) { for (var j = 0; j < cab.length; j++) if (re.test(cab[j] || '')) return j; return -1; };
      ic = { codigo: busca(esCod), desc: busca(/^(descripcion|producto|nombre)$/), talle: busca(/^(talle|talla|tal\.?)$/),
             color: busca(/^(color|col\.?)$/), cant: busca(/^(cantidad|cant\.?|stock|unidades|existencia|saldo)$/) };
      if (ic.cant < 0) return { error: 'No encontré la columna Cantidad.', items: [], errores: [] };
    } else {
      var ancho = filas.reduce(function (m, f) { return Math.max(m, (f || []).filter(function (c) { return String(c || '').trim(); }).length); }, 0);
      if (ancho >= 4) ic = { codigo: 0, talle: 1, color: 2, cant: 3, desc: -1 };
      else if (ancho === 2) ic = { codigo: 0, talle: -1, color: -1, cant: 1, desc: -1 };
      else return { error: 'No encontré la fila de los títulos: que la primera diga Código, Talle, Color y Cantidad.', items: [], errores: [] };
    }
    var items = [], errores = [];
    filas.slice(iCab + 1).forEach(function (f, j) {
      if (!f) return;
      var cod = String(f[ic.codigo] == null ? '' : f[ic.codigo]).trim().toUpperCase(), fila = iCab + 2 + j;
      if (!cod || /^total/i.test(cod)) return;
      var txt = String(f[ic.cant] == null ? '' : f[ic.cant]).trim(), n = Number(txt.replace(',', '.'));
      if (cod.length > 30) { errores.push('Fila ' + fila + ': el código «' + cod.slice(0, 40) + '» es demasiado largo.'); return; }
      if (txt === '' || !isFinite(n) || Math.round(n) !== n) { errores.push('Fila ' + fila + ': la cantidad de ' + cod + ' («' + txt + '») no es un número entero.'); return; }
      if (n < 0 && !negativos) { errores.push('Fila ' + fila + ': la cantidad de ' + cod + ' es negativa.'); return; }
      if (Math.abs(n) > 99999) { errores.push('Fila ' + fila + ': la cantidad de ' + cod + ' es demasiado grande.'); return; }
      items.push({ codigo: cod, descripcion: ic.desc >= 0 ? String(f[ic.desc] || '').trim().slice(0, 120) : '',
                   talle: ic.talle >= 0 ? String(f[ic.talle] == null ? '' : f[ic.talle]).trim().toUpperCase().slice(0, 10) : '',
                   color: ic.color >= 0 ? siglaColor(cod, f[ic.color]).slice(0, 20) : '', cantidad: n });
    });
    return { items: items, errores: errores };
  }
  /** Un archivo elegido: el .xlsx con su lector; un .csv o .txt, como texto. */
  function leerArchivo(f) {
    if (/\.xlsx$/i.test(f.name)) return leerExcel(f);
    if (/\.(csv|txt|tsv)$/i.test(f.name)) return f.text().then(filasDeTexto);
    return Promise.reject(new Error('Tiene que ser un Excel (.xlsx) o un .csv.'));
  }

  /* ── La grilla de un producto: un renglón por color y una columna por talle ── */
  function cabGrilla(ts, total) {
    return '<thead><tr><th><span class="sr">Color</span></th>' + ts.map(function (t) { return '<th class="c">' + esc(nombreTalle(t)) + '</th>'; }).join('') +
      (total ? '<th class="n">Total</th>' : '') + '</tr></thead>';
  }
  /** Para mirar un producto de un remito: en cada casilla lo que llegó y, abajo, lo que mandaron (en verde si coincide). */
  function grillaRemito(cod, celdas) {
    var ts = ordenarTalles(unicos(celdas.map(function (x) { return x.talle; })), cod);
    var cs = ordenarColores(unicos(celdas.map(function (x) { return x.color; })), cod), m = {};
    celdas.forEach(function (x) { m[x.talle + '|' + x.color] = x; });
    return '<div class="st-scroll"><table class="st-grilla">' + cabGrilla(ts) + '<tbody>' + cs.map(function (c) {
      return '<tr><th>' + esc(nombreCol(c, cod)) + '</th>' + ts.map(function (t) {
        var x = m[t + '|' + c];
        if (!x) return '<td class="c st-nada">·</td>';
        if (x.contado == null) return '<td class="c"><span class="rc-c"><b>' + x.cantidad + '</b></span></td>';
        var bien = x.contado === x.cantidad;
        return '<td class="c"><span class="rc-c ' + (bien ? 'ok' : 'mal') + '" title="Llegaron ' + x.contado + '; el remito dice ' + x.cantidad + '"><b>' + x.contado + '</b>' +
          '<small>de ' + x.cantidad + '</small></span></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  /** Para escribir cantidades: valor(talle, color) es lo que ya hay en cada casilla; ojo(talle, color) la marca. */
  function grillaCarga(cod, ts, cs, valor, ojo) {
    return '<div class="st-scroll"><table class="st-grilla rc-grilla">' + cabGrilla(ts, true) + '<tbody>' + cs.map(function (c) {
      return '<tr><th>' + esc(nombreCol(c, cod)) + '</th>' + ts.map(function (t) {
        var v = valor(t, c), k = t + '|' + c;
        return '<td class="c"><input type="number" class="rc-in' + (ojo && ojo(t, c) ? ' rc-ojo' : '') + '" min="0" max="9999" inputmode="numeric" data-k="' + esc(k) + '" value="' + (v || '') + '"' +
          ' aria-label="' + esc(nombreCol(c, cod) + ', talle ' + nombreTalle(t)) + '"></td>';
      }).join('') + '<td class="n rc-tot" data-tc="' + esc(c) + '"></td></tr>';
    }).join('') + '</tbody><tfoot><tr><th>Total</th>' + ts.map(function (t) { return '<td class="c rc-tot" data-tt="' + esc(t) + '"></td>'; }).join('') +
      '<td class="n"><b class="rc-total"></b></td></tr></tfoot></table></div>';
  }
  /** Las sumas de una grilla de carga, y el Enter que pasa a la casilla siguiente (al final, a fin()). */
  function engancharGrilla(z, alCambiar, fin) {
    var ins = [].slice.call(z.querySelectorAll('.rc-in'));
    function sumar() {
      var porC = {}, porT = {}, tot = 0;
      ins.forEach(function (i) {
        var n = parseInt(i.value, 10) || 0, k = i.getAttribute('data-k').split('|');
        porT[k[0]] = (porT[k[0]] || 0) + n; porC[k[1]] = (porC[k[1]] || 0) + n; tot += n;
      });
      z.querySelectorAll('[data-tc]').forEach(function (e) { e.textContent = porC[e.getAttribute('data-tc')] || ''; });
      z.querySelectorAll('[data-tt]').forEach(function (e) { e.textContent = porT[e.getAttribute('data-tt')] || ''; });
      var t = z.querySelector('.rc-total');
      if (t) t.textContent = tot;
      return tot;
    }
    ins.forEach(function (inp, i) {
      inp.oninput = function () {
        var n = parseInt(inp.value, 10);
        if (inp.value !== '' && !(n >= 0 && n <= 9999)) inp.value = '';
        sumar();
        if (alCambiar) alCambiar(inp.getAttribute('data-k'), parseInt(inp.value, 10) || 0);
      };
      inp.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (ins[i + 1]) { ins[i + 1].focus(); ins[i + 1].select(); } else if (fin) fin();
      };
      inp.onfocus = function () { inp.select(); };
    });
    sumar();
    return { sumar: sumar, valores: function () {
      var m = {};
      ins.forEach(function (i) { var n = parseInt(i.value, 10) || 0; if (n > 0) m[i.getAttribute('data-k')] = n; });
      return m;
    } };
  }

  /* ════════════════════════════════════════════════════════════════════
     STOCK (la "Consulta de stock" de BlueSoft)
     ════════════════════════════════════════════════════════════════════ */
  /** Los códigos del catálogo que coinciden con lo buscado (código, palabras del nombre) y con el rubro. */
  function codigosDe(q, rubro) {
    var pal = normal(q).split(' ').filter(Boolean), todo = pal.join(' '), cods = [];
    LISTA_PROD.forEach(function (p) {   // SQL 202: todos los de BlueSoft, también los inactivos (pueden tener stock)
      if (rubro && p[2] !== rubro) return;
      var cod = String(p[0]).toLowerCase(), nom = normal(p[1]);
      if (!pal.length || cod.indexOf(todo) === 0 || pal.every(function (w) { return nom.indexOf(w) >= 0 || cod.indexOf(w) === 0; })) cods.push(p[0]);
    });
    return cods.slice(0, 2000);
  }

  /* Las tres vistas de la "Consulta de stock" de BlueSoft (SQL 172; Mauricio, 25/10: "mostraba todo el stock que
     teníamos"): Por producto (la grilla de talle por color de cada uno), Lista (un renglón por talle y color, con lo
     que entró y salió) y Por rubro (tocás uno y ves sus productos). Los productos llegan de a tandas al bajar; abajo,
     los totales de todo lo filtrado (no sólo de lo que se ve) y el Excel. */
  var ST_VISTAS = [['producto', 'Por producto'], ['lista', 'Lista'], ['rubro', 'Por rubro']], ST_TANDA = 40;

  function verStock() {
    var c = $('cuerpo'), gestion = MODO === 'gestion', l = localStock();
    var F = S.stF = S.stF || { local: gestion ? '' : l.id, q: '', rubro: '', cero: false, neg: false, dep: '' };
    if (!gestion && !localDe(F.local)) F.local = l.id;
    var vista = leerJSON('pos_stock_vista', 'producto');
    if (!ST_VISTAS.some(function (v) { return v[0] === vista; })) vista = 'producto';
    c.classList.add('lleno');
    c.innerHTML = cabeza('Stock', gestion ? 'Lo que hay en cada sucursal, por talle y color. Se mueve solo con las ventas, los cambios y los remitos. Tocá un número para ver sus movimientos o ajustarlo.'
                                          : 'Lo que hay en la sucursal según el sistema, por talle y color. Tocá un número para ver de dónde sale.',
        gestion ? '<button type="button" class="btn btn-sec btn-chico" data-ir="inventario">Cargar un inventario</button>'
                : '<button type="button" class="btn btn-sec btn-chico" data-ir="remitos">Remitos</button>') +
      '<div class="pos-filtros">' +
        campo('', 'Sucursal', '<select id="stLocal" class="desplegable">' + (gestion ? '<option value="">Todas</option>' : '') + opcionesLocales(F.local) + '</select>') +
        '<div id="stDepZona" class="st-dep-zona"></div>' +
        campo('ancho', 'Buscar', '<input type="search" id="stBuscar" placeholder="Código o nombre del producto" autocomplete="off" spellcheck="false">') +
        campo('', 'Rubro', '<select id="stRubro"><option value="">Todos</option>' + opciones(RUBROS.map(function (r) { return [r, r]; }), F.rubro) + '</select>') +
        '<label class="pos-check"><input type="checkbox" id="stCero"' + (F.cero ? ' checked' : '') + '> Con los que están en 0</label>' +
        '<label class="pos-check"><input type="checkbox" id="stNeg"' + (F.neg ? ' checked' : '') + '> Sólo los negativos</label>' +
      '</div>' +
      '<nav class="pestanas st-vistas" aria-label="Cómo ver el stock">' + ST_VISTAS.map(function (v) {
        return '<button type="button" class="pestana" data-vista="' + v[0] + '"' + (v[0] === vista ? ' aria-current="page"' : '') + '>' + v[1] + '</button>';
      }).join('') + '</nav>' +
      /* En el celular los totales van arriba de la lista (pos.css): abajo no se llegaría nunca, porque sigue cargando al bajar. */
      '<div class="st-zona"><div id="stLista" class="st-lista"><p class="cargando">Cargando…</p></div><div class="tkl-pie st-pie" id="stPie"></div></div>';
    engancharIr(c);
    $('stBuscar').value = F.q;
    var t = null, pedido = 0, P = {}, orden = [], mirando = null;
    $('stLocal').onchange = function () { F.local = this.value; F.dep = ''; if (F.local) S.stLocal = F.local; pintarDep(); cargar(); };
    $('stBuscar').oninput = function () { clearTimeout(t); t = setTimeout(function () { F.q = $('stBuscar').value; cargar(); }, 250); };
    $('stRubro').onchange = function () { F.rubro = this.value; cargar(); };
    $('stCero').onchange = function () { F.cero = this.checked; cargar(); };
    $('stNeg').onchange = function () { F.neg = this.checked; cargar(); };
    c.querySelectorAll('.st-vistas .pestana').forEach(function (b) { b.onclick = function () { ponerVista(b.getAttribute('data-vista')); }; });
    /* Un solo oyente para toda la lista, porque los productos se van agregando. */
    $('stLista').onclick = function (e) {
      var b = e.target.closest('.st-n, tr[data-var], tr[data-rubro], #stMas');
      if (!b) return;
      if (b.id === 'stMas') { masProductos(); return; }
      if (b.hasAttribute('data-rubro')) { F.rubro = b.getAttribute('data-rubro'); $('stRubro').value = F.rubro; ponerVista('producto'); return; }
      var cod = b.getAttribute('data-cod'), tl = b.getAttribute('data-t'), col = b.getAttribute('data-c'), lo = b.getAttribute('data-l') || F.local;
      if (lo) abrirVariante(lo, cod, tl, col, recargar, F.local && F.dep || null);
      else abrirVarianteLocales(cod, tl, col, P[cod].celdas[tl + '|' + col].locales, P[cod].desc, recargar);
    };
    $('stLista').onkeydown = function (e) {
      var tr = e.key === 'Enter' && e.target.closest('tr[data-var], tr[data-rubro]');
      if (tr) { e.preventDefault(); tr.click(); }
    };
    function ponerVista(v) {
      vista = v;
      guardarJSON('pos_stock_vista', v);
      c.querySelectorAll('.st-vistas .pestana').forEach(function (b) {
        if (b.getAttribute('data-vista') === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      cargar();
    }
    /* Lo que piden los filtros, sin la tanda (la pantalla y el Excel). */
    function filtros() {
      var q = F.q.trim();
      /* Con un rubro, sólo los del catálogo; sin rubro, también lo que no está en el catálogo (por código o descripción). */
      var p = { p_local: F.local || null, p_codigos: q || F.rubro ? codigosDe(q, F.rubro) : null, p_buscar: q && !F.rubro ? q : null,
                p_ocultar_sin: !F.cero, p_negativos: F.neg };
      if (F.local && F.dep) p.p_deposito = F.dep;   // SQL 193: un depósito solo
      return p;
    }
    /* SQL 193: con una sucursal que tiene más de un depósito, cuál mirar (sin elegir, la suma de los que cuentan para la consulta). */
    function pintarDep() {
      var loc = F.local;
      $('stDepZona').innerHTML = '';
      if (!loc) return;
      traerDepositos(loc).then(function (ds) {
        var z = $('stDepZona');
        if (F.local !== loc || !z) return;
        if (F.dep && !depDe(ds, F.dep)) { F.dep = ''; cargar(); }
        if (ds.length < 2) return;
        z.innerHTML = campo('', 'Depósito', '<select id="stDep"><option value="">Todos los de la consulta</option>' + opciones(ds.map(function (d) { return [d.id, nombreDep(d)]; }), F.dep) + '</select>');
        $('stDep').onchange = function () { F.dep = this.value; cargar(); };
      });
    }
    /* mantener: después de un ajuste vuelve a traer lo que ya se veía y deja la lista donde estaba. */
    function cargar(mantener) {
      var n = ++pedido, z = $('stLista'), donde = [z.scrollTop, window.scrollY], p = filtros();
      if (mirando) { mirando.disconnect(); mirando = null; }
      if (vista === 'rubro') { p.p_productos = 0; p.p_resumen = true; }
      else { p.p_desde = 0; p.p_productos = mantener ? Math.min(Math.max(orden.length, ST_TANDA), 2000) : ST_TANDA; }
      if (!mantener) { z.innerHTML = '<p class="cargando">Cargando…</p>'; z.scrollTop = 0; }
      llamar('pos_stock_consulta', p).then(function (d) {
        if (n !== pedido || !z.isConnected) return;
        pintar(d);
        if (mantener) { z.scrollTop = donde[0]; window.scrollTo(0, donde[1]); }
      }).catch(function (e) {
        if (n !== pedido || !z.isConnected) return;
        z.innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
        $('stPie').innerHTML = '';
      });
    }
    function recargar() { cargar(true); }
    function pintar(d) {
      var z = $('stLista'), lo = localDe(F.local);
      P = {};
      orden = [];
      if (!d.cargado && F.local && F.dep) {   // SQL 193: un depósito nuevo, todavía vacío
        $('stPie').innerHTML = '';
        z.innerHTML = '<div class="pos-cartel"><b>Ese depósito todavía no tuvo mercadería.</b> Se llena con Envíos internos → Nuevo envío → Entre depósitos.</div>';
        return;
      }
      if (!d.cargado) {
        $('stPie').innerHTML = '';
        z.innerHTML = '<div class="pos-cartel"><b>Todavía no hay stock cargado' + (lo ? ' en ' + esc(nombreLocal(lo)) : '') + '.</b> Se carga una vez con un inventario ' +
          '(Gestión → Inventario: el Excel de «Consulta de stock» de BlueSoft) y desde ahí se mueve solo: las ventas y los cambios lo descuentan, y los remitos lo suman al recibirlos.' +
          (gestion ? ' <button type="button" class="pos-link" data-ir="inventario">Cargar un inventario</button>' : '') + '</div>';
        engancharIr(z);
        return;
      }
      pintarPie(d.totales || {});
      if (vista === 'rubro') { pintarRubros(d.resumen || []); return; }
      if (!(d.filas || []).length) { z.innerHTML = vacio(); return; }
      z.innerHTML = vista === 'lista'
        ? '<div class="pos-marco-tabla"><table class="pos-tabla st-tabla"><thead><tr>' + (F.local ? '' : '<th>Sucursal</th>') +
            '<th>Código</th><th>Producto</th><th>Rubro</th><th class="c">Talle</th><th>Color</th><th class="n">Hay</th><th class="n">Entraron</th><th class="n">Salieron</th>' +
            '</tr></thead><tbody></tbody></table></div>'
        : '<div class="st-prods"></div>';
      agregar(d);
    }
    function vacio() {
      return '<div class="pos-cartel">' + (F.neg ? 'No hay nada en negativo' : 'No hay stock') + (F.q.trim() ? ' de «' + esc(F.q.trim()) + '»' : '') +
        (F.rubro ? ' en ' + esc(F.rubro) : '') + (F.cero || F.neg ? '' : '. Para ver también los que están en 0, marcá «Con los que están en 0».') + '</div>';
    }
    /* Una tanda: cada producto llega entero (todos sus talles, colores y sucursales en la misma tanda). */
    function agregar(d) {
      var z = $('stLista'), nuevos = [], deEsta = {};
      (d.filas || []).forEach(function (f) {   // [local, código, talle, color, cantidad, entradas, salidas, descripción]
        var p = P[f[1]];
        if (!p) { p = P[f[1]] = { cod: f[1], desc: f[7], talles: [], colores: [], celdas: {}, filas: [], total: 0 }; orden.push(f[1]); nuevos.push(f[1]); deEsta[f[1]] = 1; }
        else if (!deEsta[f[1]]) return;   // ya vino en la tanda anterior (el stock cambió en el medio)
        if (p.talles.indexOf(f[2]) < 0) p.talles.push(f[2]);
        if (p.colores.indexOf(f[3]) < 0) p.colores.push(f[3]);
        var x = p.celdas[f[2] + '|' + f[3]] || (p.celdas[f[2] + '|' + f[3]] = { n: 0, locales: [] });
        x.n += f[4];
        x.locales.push([f[0], f[4]]);
        p.filas.push(f);
        p.total += f[4];
        if (!p.desc && f[7]) p.desc = f[7];
      });
      var html = nuevos.map(vista === 'lista' ? renglones : tarjeta).join('');
      z.querySelector(vista === 'lista' ? 'tbody' : '.st-prods').insertAdjacentHTML('beforeend', html);
      var m = $('stMas');
      if (m) m.remove();
      if (d.mas) {
        z.insertAdjacentHTML('beforeend', '<button type="button" class="st-mas" id="stMas">Ver más productos <small>(se ven ' + num(orden.length) +
          ' de ' + num((d.totales || {}).productos) + ')</small></button>');
        mirar();
      }
    }
    /* Cerca del final de la lista trae la tanda que sigue (el botón queda por si el navegador no avisa). */
    function mirar() {
      if (mirando) mirando.disconnect();
      mirando = null;
      if (!window.IntersectionObserver) return;
      var z = $('stLista'), propia = getComputedStyle(z).overflowY !== 'visible';
      mirando = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) masProductos(); },
                                         { root: propia ? z : null, rootMargin: '0px 0px 600px 0px' });
      mirando.observe($('stMas'));
    }
    function masProductos() {
      var m = $('stMas'), n = pedido;
      if (!m || m.disabled) return;
      var antes = m.innerHTML, p = filtros();
      m.disabled = true;
      m.textContent = 'Cargando…';
      p.p_desde = orden.length;
      p.p_productos = ST_TANDA;
      llamar('pos_stock_consulta', p).then(function (d) {
        if (n === pedido && m.isConnected) agregar(d);
      }).catch(function (e) {
        if (n !== pedido || !m.isConnected) return;
        m.disabled = false;
        m.innerHTML = antes;
        avisar('err', mensajeDe(e));
      });
    }
    /* Por color y talle en el orden del catálogo, y por sucursal. */
    function enOrden(cod, filas) {
      var ts = ordenarTalles(unicos(filas.map(function (f) { return f[2]; })), cod), cs = ordenarColores(unicos(filas.map(function (f) { return f[3]; })), cod);
      return filas.slice().sort(function (a, b) {
        return cs.indexOf(a[3]) - cs.indexOf(b[3]) || ts.indexOf(a[2]) - ts.indexOf(b[2]) || nombreLocal(localDe(a[0])).localeCompare(nombreLocal(localDe(b[0])));
      });
    }
    /* Por producto: la grilla de talle por color. */
    function tarjeta(cod) {
      var p = P[cod], ts = ordenarTalles(p.talles, cod), cs = ordenarColores(p.colores, cod);
      return '<div class="st-prod"><div class="st-prod-cab"><b>' + esc(cod) + '</b><span>' + esc(nombreProd(cod, p.desc)) + '</span>' +
          (PROD[cod] && PROD[cod][2] ? '<small>' + esc(PROD[cod][2]) + '</small>' : '') + '<em>' + num(p.total) + (Math.abs(p.total) === 1 ? ' unidad' : ' unidades') + '</em></div>' +
        '<div class="st-scroll"><table class="st-grilla">' + cabGrilla(ts) + '<tbody>' + cs.map(function (col) {
          return '<tr><th>' + esc(nombreCol(col, cod)) + '</th>' + ts.map(function (tl) {
            var x = p.celdas[tl + '|' + col];
            if (!x) return '<td class="c st-nada">·</td>';
            return '<td class="c"><button type="button" class="st-n' + (x.n < 0 ? ' neg' : x.n === 0 ? ' cero' : '') + '" data-cod="' + esc(cod) + '" data-t="' + esc(tl) + '" data-c="' + esc(col) + '"' +
              ' aria-label="' + esc(cod + ' ' + nombreTalle(tl) + ' ' + nombreCol(col, cod) + ': ' + x.n) + '">' + num(x.n) + '</button></td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    /* Lista: los renglones de un producto (con «Todas», uno por sucursal); la raya de arriba separa los productos. */
    function renglones(cod) {
      var p = P[cod], rubro = PROD[cod] && PROD[cod][2] || '';
      return enOrden(cod, p.filas).map(function (f, i) {
        return '<tr data-var tabindex="0" data-l="' + esc(f[0]) + '" data-cod="' + esc(cod) + '" data-t="' + esc(f[2]) + '" data-c="' + esc(f[3]) + '"' + (i ? '' : ' class="st-primero"') + '>' +
          (F.local ? '' : '<td>' + esc(nombreLocal(localDe(f[0]))) + '</td>') +
          '<td><b>' + esc(cod) + '</b></td><td class="st-desc">' + esc(nombreProd(cod, p.desc)) + '</td><td>' + esc(rubro) + '</td>' +
          '<td class="c">' + esc(nombreTalle(f[2])) + '</td><td>' + esc(nombreCol(f[3], cod)) + '</td>' +
          '<td class="n"><b class="' + (f[4] < 0 ? 'st-sale' : f[4] === 0 ? 'st-cero' : '') + '">' + num(f[4]) + '</b></td><td class="n">' + num(f[5]) + '</td><td class="n">' + num(f[6]) + '</td></tr>';
      }).join('');
    }
    /* Por rubro: las unidades de cada uno; tocar uno muestra sus productos. Lo que no está en el catálogo no tiene rubro. */
    function pintarRubros(res) {
      var z = $('stLista'), R = {}, todo = 0;
      res.forEach(function (x) {   // [código, descripción, cantidad, entradas, salidas, renglones, en negativo]
        var r = PROD[x[0]] && PROD[x[0]][2] || '', g = R[r] || (R[r] = { r: r, prods: 0, n: 0, e: 0, s: 0, neg: 0 });
        g.prods++; g.n += x[2]; g.e += x[3]; g.s += x[4]; g.neg += x[6];
      });
      var gs = Object.keys(R).map(function (k) { return R[k]; });
      if (!gs.length) { z.innerHTML = vacio(); return; }
      gs.forEach(function (g) { todo += Math.max(0, g.n); });
      gs.sort(function (a, b) { return (a.r ? 0 : 1) - (b.r ? 0 : 1) || b.n - a.n || a.r.localeCompare(b.r); });
      z.innerHTML = '<div class="pos-marco-tabla"><table class="pos-tabla st-tabla st-rubros"><thead><tr><th>Rubro</th><th class="n">Productos</th><th class="n">Hay</th>' +
          '<th>Del total</th><th class="n">Entraron</th><th class="n">Salieron</th><th class="n">En negativo</th></tr></thead><tbody>' +
        gs.map(function (g) {
          var parte = todo ? Math.max(0, g.n) / todo : 0;
          return '<tr' + (g.r ? ' data-rubro="' + esc(g.r) + '" tabindex="0" title="Ver los productos de ' + esc(g.r) + '"'
                              : ' class="st-fuera" title="Los códigos que no están en el catálogo no tienen rubro: se buscan por código."') + '>' +
            '<td><b>' + esc(g.r || 'Fuera del catálogo') + '</b></td><td class="n">' + num(g.prods) + '</td>' +
            '<td class="n"><b class="' + (g.n < 0 ? 'st-sale' : '') + '">' + num(g.n) + '</b></td>' +
            '<td class="st-parte"><span class="st-barra"><i style="width:' + Math.round(parte * 1000) / 10 + '%"></i></span>' + porcentaje(parte) + '</td>' +
            '<td class="n">' + num(g.e) + '</td><td class="n">' + num(g.s) + '</td>' +
            '<td class="n">' + (g.neg ? '<b class="st-sale">' + num(g.neg) + '</b>' : '0') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    /* Abajo, como en Tickets: los totales de todo lo filtrado y el Excel. */
    function caja(lbl, v, cls) { return '<div class="tk-caja' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + v + '</b></div>'; }
    function pintarPie(tt) {
      $('stPie').innerHTML = caja('Unidades', num(tt.cantidad), 'fuerte') + caja('Entraron', num(tt.entradas)) + caja('Salieron', num(tt.salidas)) +
        caja('Productos', num(tt.productos)) + caja('Renglones', num(tt.lineas)) +
        '<button type="button" class="tk-caja' + (tt.negativos ? ' mal' : '') + '" id="stVerNeg" aria-pressed="' + (F.neg ? 'true' : 'false') + '" title="' +
          (F.neg ? 'Volver a ver todo' : 'Ver sólo los negativos') + '"><span>En negativo</span><b>' + num(tt.negativos) + '</b></button>' +
        '<button type="button" class="btn btn-sec btn-chico st-excel" id="stExcel">Bajar para Excel</button>';
      $('stVerNeg').onclick = verNeg;
      $('stExcel').onclick = bajarStock;
    }
    function verNeg() { F.neg = !F.neg; $('stNeg').checked = F.neg; cargar(); }
    /* El Excel: todo lo filtrado (no sólo lo que se ve), un renglón por talle y color como la Lista. */
    function bajarStock() {
      var b = $('stExcel'), lo = localDe(F.local);
      b.disabled = true;
      b.textContent = 'Preparando…';
      llamar('pos_stock_consulta', filtros()).then(function (d) {
        var por = {}, cods = [], filas = [];
        (d.filas || []).forEach(function (f) { if (!por[f[1]]) { por[f[1]] = []; cods.push(f[1]); } por[f[1]].push(f); });
        cods.forEach(function (cod) {
          enOrden(cod, por[cod]).forEach(function (f) {
            filas.push([nombreLocal(localDe(f[0])), cod, nombreProd(cod, f[7]), PROD[cod] && PROD[cod][2] || '', nombreTalle(f[2]), nombreCol(f[3], cod), f[4], f[5], f[6]]);
          });
        });
        if (!filas.length) { avisar('err', 'No hay nada para bajar con esos filtros.'); return; }
        var dp = F.local && F.dep ? depDe(S.dep[F.local], F.dep) : null;
        bajarCsv('stock-' + (lo ? normal(nombreLocal(lo)).split(/[^a-z0-9]+/).filter(Boolean).join('-') : 'todas-las-sucursales') +
                 (dp ? '-' + normal(dp.nombre).split(/[^a-z0-9]+/).filter(Boolean).join('-') : '') + '-' + Interfaz.fecha.hoy() + '.csv',
                 ['Sucursal', 'Código', 'Producto', 'Rubro', 'Talle', 'Color', 'Hay', 'Entraron', 'Salieron'], filas);
        if (d.mas) avisar('err', 'Son más de 60.000 renglones: el Excel trae los primeros. Elegí una sucursal o un rubro para bajar el resto.');
      }).catch(function (e) { avisar('err', mensajeDe(e)); }).then(function () {
        if (!b.isConnected) return;
        b.disabled = false;
        b.textContent = 'Bajar para Excel';
      });
    }
    cargar();
    pintarDep();
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var b = $('stBuscar'); if (b) b.focus(); }, 0);
  }

  /** Con "Todas": cuánto hay en cada sucursal de una variante; cada una abre sus movimientos. */
  function abrirVarianteLocales(cod, t, col, locales, desc, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">' + esc(cod) + ' · ' + esc(nombreTalle(t)) + ' · ' + esc(nombreCol(col, cod)) + '</h3>' +
      '<p class="pos-bajada">' + esc(nombreProd(cod, desc)) + ' · en cada sucursal. Tocá una para ver sus movimientos.</p>' +
      '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Sucursal</th><th class="n">Hay</th></tr></thead><tbody>' +
        locales.slice().sort(function (a, b) { return b[1] - a[1]; }).map(function (x) {
          return '<tr data-ticket="' + esc(x[0]) + '" tabindex="0"><td>' + esc(nombreLocal(localDe(x[0]))) + '</td><td class="n"><b class="' + (x[1] < 0 ? 'st-sale' : '') + '">' + num(x[1]) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>');
    caja.querySelectorAll('tr[data-ticket]').forEach(function (tr) {
      tr.onclick = function () { abrirVariante(tr.getAttribute('data-ticket'), cod, t, col, alCambiar); };
      tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
    });
  }

  /** El Detalle de un movimiento: el motivo de un ajuste o, en las ventas y los cambios, quién vendió o atendió (SQL 172). */
  function detalleMov(m) {
    var quien = m.vendedor ? (/^cambio/.test(m.tipo) ? 'Atendió ' : 'Vendió ') + m.vendedor : '';
    return [m.detalle, quien].filter(Boolean).join(' · ');
  }

  /** Una variante en una sucursal: cuánto hay, de dónde sale ("Ver detalle de movimientos") y, en Gestión, el ajuste.
      SQL 193: dep, la de un depósito solo; sin dep, la suma de los que cuentan para la consulta y cuánto hay en cada depósito.
      El ajuste va al depósito elegido o, sin elegir, al predeterminado: "hay en realidad" es contra lo que tiene ése. */
  function abrirVariante(localId, cod, talle, color, alCambiar, dep) {
    var tit = esc(cod) + ' · ' + esc(nombreTalle(talle)) + ' · ' + esc(nombreCol(color, cod));
    var caja = ventana('<h3 id="posVentTit">' + tit + '</h3><p class="cargando">Cargando…</p>', true), dentro = caja.querySelector('.pos-caja-in');
    var pv = { p_local: localId, p_codigo: cod, p_talle: talle, p_color: color };
    if (dep) pv.p_deposito = dep;
    Promise.all([llamar('pos_stock_variante', pv), traerDepositos(localId)]).then(function (rs) {
      if (!caja.isConnected) return;
      var v = rs[0], ds = rs[1], s = v.stock || { cantidad: 0, entradas: 0, salidas: 0 }, movs = v.movimientos || [];
      var varios = ds.length > 1, pred = depPredeterminado(ds), cuanto = {};
      (v.depositos || []).forEach(function (x) { cuanto[x.id] = Number(x.cantidad) || 0; });
      var base = !varios ? Number(s.cantidad) || 0 : cuanto[dep || (pred && pred.id)] || 0, depAj = dep ? v.deposito : varios && pred ? pred.nombre : null;
      var enDeps = ds.filter(function (d) { return cuanto[d.id] || d.predeterminado || d.id === dep; });
      dentro.innerHTML = '<h3 id="posVentTit">' + tit + '</h3><p class="pos-bajada">' + esc(nombreProd(cod, s.descripcion)) + ' · ' + esc(bonito(v.local || '')) +
          (v.deposito ? ' · <b>' + esc(v.deposito) + '</b>' : varios ? ' · los depósitos de la consulta' : '') + '</p>' +
        '<div class="pos-totales"><div class="pos-kpi fuerte"><span>Hay</span><b>' + num(s.cantidad) + '</b></div>' +
          '<div class="pos-kpi"><span>Entraron</span><b>' + num(s.entradas) + '</b></div><div class="pos-kpi"><span>Salieron</span><b>' + num(s.salidas) + '</b></div></div>' +
        (varios ? '<p class="pos-lbl rm-leyenda">En cada depósito</p><div class="pos-marco-tabla va-deps"><table class="pos-tabla"><thead><tr><th>Depósito</th><th class="n">Hay</th></tr></thead><tbody>' +
            enDeps.map(function (d) {
              var n = cuanto[d.id] || 0;
              return '<tr data-dep="' + esc(d.id) + '" tabindex="0"' + (d.id === dep ? ' class="rn-marca"' : '') + ' title="Ver sólo ' + esc(d.nombre) + '"><td>' + esc(d.nombre) + ' ' + pillsDep(d) + '</td>' +
                '<td class="n"><b class="' + (n < 0 ? 'st-sale' : '') + '">' + num(n) + '</b></td></tr>';
            }).join('') + '</tbody></table></div>' +
            (dep ? '<p class="pos-ayuda"><button type="button" class="pos-link" id="vaTodos">Ver la suma de los de la consulta</button></p>' : '') : '') +
        (movs.length ? '<div class="pos-marco-tabla st-movs"><table class="pos-tabla"><thead><tr><th>Fecha</th><th>Qué</th>' + (varios ? '<th>Depósito</th>' : '') +
            '<th>Detalle</th><th>Quién</th><th class="n">Cant.</th></tr></thead><tbody>' +
            movs.map(function (m) {
              return '<tr><td>' + esc(fechaHora(m.fecha)) + '</td><td>' + esc(m.ref || m.tipo) + '</td>' + (varios ? '<td>' + esc(m.deposito || '') + '</td>' : '') +
                '<td>' + esc(detalleMov(m)) + '</td><td>' + esc(m.persona || '—') + '</td>' +
                '<td class="n"><b class="' + (m.cantidad < 0 ? 'st-sale' : 'st-entra') + '">' + (m.cantidad > 0 ? '+' : '−') + miles(Math.abs(m.cantidad)) + '</b></td></tr>';
            }).join('') + '</tbody></table></div>' + (movs.length >= 200 ? '<p class="pos-mas">Se ven los últimos 200 movimientos.</p>' : '')
          : '<div class="pos-cartel">Todavía no tuvo movimientos ' + (dep ? 'en este depósito.' : 'en esta sucursal.') + '</div>') +
        '<div id="vaAjuste"></div><div class="pos-pie">' +
          (MODO === 'gestion' ? '<button type="button" class="btn btn-sec btn-chico izq" id="vaAjustar">Ajustar…</button>' : '<span class="pos-ayuda izq">Los ajustes (falla, robo, error de carga) se hacen en Gestión → Stock.</span>') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      dentro.querySelectorAll('.va-deps tr[data-dep]').forEach(function (tr) {
        tr.onclick = function () { abrirVariante(localId, cod, talle, color, alCambiar, tr.getAttribute('data-dep')); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      var vt = dentro.querySelector('#vaTodos');
      if (vt) vt.onclick = function () { abrirVariante(localId, cod, talle, color, alCambiar, null); };
      var aj = dentro.querySelector('#vaAjustar');
      if (aj) aj.onclick = function () {
        aj.remove();
        var z = dentro.querySelector('#vaAjuste'), clave = nuevaClave();
        z.innerHTML = '<div class="pos-cartel st-ajuste"><p class="pos-ayuda">Escribí cuántas hay de verdad' + (depAj ? ' en <b>«' + esc(depAj) + '»</b>' : '') +
            ': el sistema pasa a decir eso y queda anotado con el motivo.</p><div class="pos-campos">' +
            campo('', 'Hay en realidad', '<input type="number" id="vaHay" min="0" max="99999" value="' + Math.max(0, base) + '">') +
            campo('', 'Motivo', '<select id="vaMotivo"><option value="">Elegí…</option>' + opciones(MOTIVOS_AJUSTE.map(function (m) { return [m, m]; }), '') + '</select>') +
            campo('ancho', 'Detalle <span class="lbl-opc">(con «Otro», contá cuál)</span>', '<input type="text" id="vaDetalle" maxlength="200">') +
          '</div><div class="pos-error" id="vaError"></div><div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="vaOk">Guardar el ajuste</button></div></div>';
        var hay = z.querySelector('#vaHay');
        hay.focus(); hay.select();
        z.querySelector('#vaOk').onclick = function () {
          var n = hay.value.trim(), mot = z.querySelector('#vaMotivo').value, det = z.querySelector('#vaDetalle').value.trim(), bt = this;
          if (!errorEn(z, 'vaError', !/^\d{1,5}$/.test(n) ? 'Escribí cuántas hay (de 0 a 99999).' : Number(n) === base ? 'El sistema ya dice ' + base + ': no hay nada que ajustar.' :
                                     !mot ? 'Elegí el motivo.' : mot === 'Otro' && !det ? 'Escribí el motivo.' : '')) return;
          bt.disabled = true;
          var pa = { local_id: localId, codigo: cod, talle: talle, color: color, cantidad: Number(n), motivo: mot, detalle: det,
                     descripcion: PROD[cod] ? PROD[cod][1] : (s.descripcion || ''), clave: clave };
          if (dep) pa.deposito_id = dep;   // SQL 193 (sin elegir, la base usa el predeterminado)
          llamar('pos_stock_ajustar', { p: pa }).then(function (r) {
            avisar('ok', cod + ' ' + nombreTalle(talle) + ' ' + nombreCol(color, cod) + (r.deposito && varios ? ' en «' + r.deposito + '»' : '') + ': ' + (r.ya ? 'ya estaba ajustado.' : 'de ' + r.antes + ' a ' + r.ahora + '.'));
            delete S.stock[localId];
            delete S.dep[localId];
            if (alCambiar) alCambiar();
            abrirVariante(localId, cod, talle, color, alCambiar, dep);
          }).catch(function (e) { bt.disabled = false; errorEn(z, 'vaError', mensajeDe(e)); });
        };
      };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">' + tit + '</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     DEPÓSITOS (SQL 193): los "Depósitos" de BlueSoft
     Cada sucursal arranca con uno, «Principal», con todo su stock. Para el
     stock de todo el local (cada seis meses): un depósito nuevo con la
     temporada y el año («Verano 2027»), los envíos entre depósitos módulo
     por módulo (Envíos internos), el control de cada módulo con productos
     testigo y «Predeterminar» el nuevo: desde ahí las ventas, los cambios y
     los remitos van a él. Lo que quedó en el de antes es lo que no se
     encontró (con el tilde, deja de contar para la consulta de stock).
     ════════════════════════════════════════════════════════════════════ */
  function verDepositos() {
    var c = $('cuerpo'), gestion = MODO === 'gestion', l = localStock();
    var F = S.dpF = S.dpF || { local: gestion && puede('locales') ? '' : l.id, q: '', activos: true };
    if (F.local && !localMio(F.local)) F.local = l.id;
    c.innerHTML = cabeza('Depósitos', 'Dónde está la mercadería de cada sucursal. Las ventas, los cambios y los remitos van al predeterminado. Tocá uno para verlo o cambiarlo.',
        '<button type="button" class="btn btn-sec btn-chico" id="depBajar" disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="depNuevo">Nuevo depósito</button>') +
      '<div class="pos-filtros">' +
        campo('', 'Sucursal', '<select id="depLocal" class="desplegable">' + (gestion ? todasLasSucursales() : '') + opcionesLocales(F.local) + '</select>') +
        campo('ancho', 'Filtrar', '<input type="search" id="depBuscar" placeholder="Nombre o código" autocomplete="off" spellcheck="false">') +
        '<label class="pos-check"><input type="checkbox" id="depActivos"' + (F.activos ? ' checked' : '') + '> Activos</label>' +
      '</div>' +
      '<details class="dep-pasos"' + (leerJSON('pos_dep_pasos', 'abierto') !== 'cerrado' ? ' open' : '') + '><summary>El stock de todo el local, paso a paso</summary><ol>' +
        '<li><b>Nuevo depósito</b>, con la temporada y el año (por ejemplo, Verano 2027).</li>' +
        '<li>En <b>Envíos internos → Nuevo envío → Entre depósitos del local</b>, un envío por módulo: del depósito de antes al nuevo, con todas las prendas del módulo.</li>' +
        '<li>Cada módulo se controla con dos productos testigo (en el envío, <b>Controlar con testigos</b>). Si no coincide, se anula el envío y se pasa de nuevo.</li>' +
        '<li>Con todo pasado, el nuevo → <b>Predeterminar</b>: desde ahí cada venta descuenta de él. Lo que quedó en el de antes es lo que no se encontró.</li>' +
      '</ol></details>' +
      '<div id="depLista"><p class="cargando">Cargando…</p></div>';
    F.local = $('depLocal').value;
    $('depBuscar').value = F.q;
    c.querySelector('.dep-pasos').addEventListener('toggle', function () { guardarJSON('pos_dep_pasos', this.open ? 'abierto' : 'cerrado'); });
    var todos = [], filas = [], pedido = 0, t = null;
    $('depLocal').onchange = function () { F.local = this.value; if (F.local) { S.stLocal = F.local; recordarLocal(F.local); } cargar(); };
    $('depBuscar').oninput = function () { clearTimeout(t); t = setTimeout(function () { F.q = $('depBuscar').value; pintar(); }, 150); };
    $('depActivos').onchange = function () { F.activos = this.checked; pintar(); };
    $('depNuevo').onclick = function () { abrirDeposito(null, F.local || l.id, cargar); };
    function cargar() {
      var n = ++pedido;
      $('depLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('depBajar').disabled = true;
      llamar('pos_depositos', { p_local: F.local || null }).then(function (d) {
        if (n !== pedido || !$('depLista')) return;
        todos = d || [];
        if (F.local) S.dep[F.local] = todos;
        pintar();
      }).catch(function (e) {
        if (n !== pedido || !$('depLista')) return;
        if (sinFuncion(e)) S.sin193 = true;
        $('depLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
      });
    }
    function pintar() {
      var q = normal(F.q);
      filas = todos.filter(function (d) { return (!F.activos || d.activo) && (!q || normal(d.nombre).indexOf(q) >= 0 || String(d.numero) === q); });
      $('depBajar').disabled = !filas.length;
      if (!filas.length) {
        $('depLista').innerHTML = '<div class="pos-cartel">' + (todos.length ? 'Ningún depósito con ese filtro.' : 'Esta sucursal todavía no tiene depósitos.') + '</div>';
        return;
      }
      $('depLista').innerHTML = '<div class="pos-marco-tabla"><table class="pos-tabla dep-tabla"><thead><tr><th>Código</th><th>Descripción</th>' + (F.local ? '' : '<th>Sucursal</th>') +
          '<th class="n">Unidades</th><th>Estado</th><th>Se creó</th></tr></thead><tbody>' +
        filas.map(function (d, i) {
          var cl = [d.activo ? '' : 'dep-inactivo', d.id === S.dpMarcar ? 'recien' : ''].filter(Boolean).join(' ');
          return '<tr data-dep="' + i + '" tabindex="0"' + (cl ? ' class="' + cl + '"' : '') + '><td><b>' + esc(d.numero) + '</b></td><td><b>' + esc(d.nombre) + '</b></td>' +
            (F.local ? '' : '<td>' + esc(bonito(d.local)) + '</td>') +
            '<td class="n">' + num(d.unidades) + (d.negativos ? '<small class="st-chico st-sale">' + num(d.negativos) + (d.negativos === 1 ? ' renglón' : ' renglones') + ' en negativo</small>' : '') + '</td>' +
            '<td class="dep-est">' + pillsDep(d) + '</td><td>' + esc(fechaHora(d.creado_en)) + (d.creado_nombre ? '<small class="st-chico">' + esc(d.creado_nombre) + '</small>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      $('depLista').querySelectorAll('tr[data-dep]').forEach(function (tr) {
        var d = filas[Number(tr.getAttribute('data-dep'))];
        tr.onclick = function () { abrirDeposito(d, d.local_id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      var m = $('depLista').querySelector('tr.recien');
      if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
      S.dpMarcar = null;
    }
    $('depBajar').onclick = function () {
      var lo = localDe(F.local);
      bajarCsv('Depósitos ' + (lo ? nombreLocal(lo) : 'todas las sucursales') + ' ' + Interfaz.fecha.hoy() + '.csv',
        ['Código', 'Descripción', 'Sucursal', 'Temporada', 'Año', 'Unidades', 'Renglones', 'En negativo', 'Predeterminado', 'Para la consulta de stock', 'Activo', 'Se creó', 'Lo creó'],
        filas.map(function (d) {
          return [d.numero, d.nombre, bonito(d.local), d.temporada || '', d.anio || '', Number(d.unidades) || 0, Number(d.renglones) || 0, Number(d.negativos) || 0,
                  d.predeterminado ? 'Sí' : 'No', d.consulta ? 'Sí' : 'No', d.activo ? 'Sí' : 'No', fechaHora(d.creado_en), d.creado_nombre || ''];
        }));
    };
    cargar();
  }

  /** La ficha de un depósito, como la de BlueSoft (d null: uno nuevo en la sucursal localId): Guardar, Predeterminar y Eliminar. */
  function abrirDeposito(d, localId, alCambiar) {
    var nuevo = !d, tn = temporadaNueva(), temp = d ? !!d.temporada : true;
    var caja = ventana('<h3 id="posVentTit">' + (nuevo ? 'Nuevo depósito' : esc(d.nombre) + ' ' + pillsDep(d)) + '</h3>' +
      (nuevo ? '<p class="pos-bajada">El de la temporada nueva, para el stock de todo el local. Después se pasa la ropa con Envíos internos → Nuevo envío → Entre depósitos del local.</p>' :
       '<p class="pos-bajada">' + num(d.unidades) + (Math.abs(d.unidades) === 1 ? ' unidad' : ' unidades') + ' · se creó el ' + esc(fechaHora(d.creado_en)) + (d.creado_nombre ? ' (' + esc(d.creado_nombre) + ')' : '') +
         (d.predeterminado && d.predeterminado_en ? ' · predeterminado desde el ' + esc(fechaHora(d.predeterminado_en)) : '') + '</p>') +
      '<div class="pos-campos dep-campos">' +
        campo('', 'Código', '<input type="text" value="' + (nuevo ? 'Nuevo' : esc(d.numero)) + '" readonly tabindex="-1">') +
        campo('', 'Sucursal', nuevo ? '<select id="dfLocal" class="desplegable">' + opcionesLocales(localId) + '</select>' : '<input type="text" value="' + esc(bonito(d.local)) + '" readonly tabindex="-1">') +
        campo('', 'Tipo', '<select id="dfTipo">' + opciones([['temporada', 'De temporada'], ['otro', 'Otro (fallas…)']], temp ? 'temporada' : 'otro') + '</select>') +
        campo('dep-temp', 'Temporada', '<select id="dfTemp">' + opciones([['Verano', 'Verano'], ['Invierno', 'Invierno']], d && d.temporada || tn[0]) + '</select>') +
        campo('dep-temp', 'Año', '<input type="number" id="dfAnio" min="2000" max="2100" value="' + esc(d && d.anio || tn[1]) + '">') +
        campo('dep-otro', 'Descripción', '<input type="text" id="dfNombre" maxlength="40" autocomplete="off" placeholder="Ej.: Depósito de fallas" value="' + esc(d && !d.temporada ? d.nombre : '') + '">') +
      '</div>' +
      '<div class="dep-checks"><label class="pos-check"><input type="checkbox" id="dfConsulta"' + (!d || d.consulta ? ' checked' : '') + (d && d.predeterminado ? ' disabled' : '') + '> Considerar para la consulta de stock</label>' +
      '<label class="pos-check"><input type="checkbox" id="dfActivo"' + (!d || d.activo ? ' checked' : '') + (d && d.predeterminado ? ' disabled' : '') + '> Activo</label></div>' +
      (d && d.predeterminado ? '<p class="pos-ayuda">Es el predeterminado: cuenta siempre para la consulta y no se desactiva.</p>' : '') +
      '<div class="pos-error" id="dfError"></div><div id="dfZona"></div>' +
      '<div class="pos-pie">' +
        (d && !d.predeterminado && !d.usado ? '<button type="button" class="btn btn-sec btn-chico izq" id="dfBorrar">Eliminar</button>' : '') +
        (d && !d.predeterminado && d.activo ? '<button type="button" class="btn btn-sec btn-chico' + (d.usado ? ' izq' : '') + '" id="dfPred">Predeterminar</button>' : '') +
        '<button type="button" class="btn btn-sec btn-chico" data-cerrar>Cerrar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="dfGuardar">Guardar</button></div>');
    var tipo = caja.querySelector('#dfTipo');
    function verTipo() {
      var t = tipo.value === 'temporada';
      caja.querySelectorAll('.dep-temp').forEach(function (x) { x.style.display = t ? '' : 'none'; });
      caja.querySelectorAll('.dep-otro').forEach(function (x) { x.style.display = t ? 'none' : ''; });
    }
    tipo.onchange = function () { verTipo(); (tipo.value === 'temporada' ? caja.querySelector('#dfAnio') : caja.querySelector('#dfNombre')).focus(); };
    verTipo();
    caja.querySelector('#dfGuardar').onclick = function () {
      var bt = this, t = tipo.value === 'temporada', anio = caja.querySelector('#dfAnio').value.trim(), nom = caja.querySelector('#dfNombre').value.trim();
      if (!errorEn(caja, 'dfError', t && !/^\d{4}$/.test(anio) ? 'Escribí el año (por ejemplo, ' + tn[1] + ').' : !t && !nom ? 'Escribí la descripción del depósito.' : '')) return;
      var loc = nuevo ? caja.querySelector('#dfLocal').value : d.local_id;
      bt.disabled = true;
      llamar('pos_deposito_guardar', { p: { id: d ? d.id : null, local_id: loc, temporada: t ? caja.querySelector('#dfTemp').value : null, anio: t ? Number(anio) : null,
                                            nombre: t ? null : nom, consulta: caja.querySelector('#dfConsulta').checked, activo: caja.querySelector('#dfActivo').checked } }).then(function (r) {
        avisar('ok', r.nuevo ? 'Depósito «' + r.nombre + '» creado (código ' + r.numero + '). Ahora pasá la ropa con Envíos internos → Nuevo envío → Entre depósitos del local.'
                             : 'Depósito «' + r.nombre + '» guardado.');
        delete S.dep[loc];
        delete S.stock[loc];
        S.dpMarcar = r.id;
        cerrarVentana();
        if (alCambiar) alCambiar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'dfError', mensajeDe(e)); });
    };
    /* «Predeterminar»: lo que hace en una frase, lo que quedó en el de antes y si ése deja de contar para la consulta. */
    var pd = caja.querySelector('#dfPred');
    if (pd) pd.onclick = function () {
      pd.disabled = true;
      traerDepositos(d.local_id, true).then(function (ds) {
        var v = depPredeterminado(ds), z = caja.querySelector('#dfZona');
        pd.remove();
        z.innerHTML = '<div class="pos-cartel st-dif dep-pred">Desde ahora las ventas, los cambios y los remitos de ' + esc(bonito(d.local)) + ' van a <b>«' + esc(d.nombre) + '»</b>.' +
          (v ? ' En «' + esc(v.nombre) + '» quedan <b>' + num(v.unidades) + (Math.abs(v.unidades) === 1 ? ' prenda' : ' prendas') + '</b>: si ya pasaste todos los módulos, es lo que no se encontró.' +
               '<label class="pos-check"><input type="checkbox" id="dfSacar" checked> Que «' + esc(v.nombre) + '» deje de contar para la consulta de stock</label>' : '') +
          '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="dfPredOk">Predeterminar «' + esc(d.nombre) + '»</button></div></div>';
        var ok = z.querySelector('#dfPredOk'), sc = z.querySelector('#dfSacar');
        ok.focus();
        ok.onclick = function () {
          ok.disabled = true;
          llamar('pos_deposito_predeterminar', { p_id: d.id, p_sacar_viejo: !!(sc && sc.checked) }).then(function (r) {
            avisar('ok', 'Listo: ' + bonito(d.local) + ' vende de «' + r.nombre + '».' +
                         (r.anterior ? ' En «' + r.anterior + '» quedaron ' + num(r.quedaron) + (Math.abs(r.quedaron) === 1 ? ' prenda.' : ' prendas.') : ''));
            delete S.dep[d.local_id];
            delete S.stock[d.local_id];
            S.dpMarcar = d.id;
            cerrarVentana();
            if (alCambiar) alCambiar();
          }).catch(function (e) { ok.disabled = false; errorEn(caja, 'dfError', mensajeDe(e)); });
        };
      });
    };
    var bo = caja.querySelector('#dfBorrar');
    if (bo) bo.onclick = function () {
      if (!confirm('¿Eliminar el depósito «' + d.nombre + '»? Nunca tuvo mercadería.')) return;
      bo.disabled = true;
      llamar('pos_deposito_borrar', { p_id: d.id }).then(function () {
        avisar('ok', 'Depósito «' + d.nombre + '» eliminado.');
        delete S.dep[d.local_id];
        cerrarVentana();
        if (alCambiar) alCambiar();
      }).catch(function (e) { bo.disabled = false; errorEn(caja, 'dfError', mensajeDe(e)); });
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     REMITOS: el listado (el mostrador recibe; Gestión los carga y los anula)
     ════════════════════════════════════════════════════════════════════ */
  function verRemitos() { if (MODO === 'gestion') verRemitosGestion(); else verRemitosLocal(); }

  function abrirRecepcion(id) {
    try { sessionStorage.setItem(K_REMITO_VER, id); } catch (e) {}
    S.recId = id;
    ir('remito');
  }

  function verRemitosLocal() {
    var c = $('cuerpo'), l = localStock(), prueba = enPrueba();
    c.innerHTML = cabeza('Remitos' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que llega de la fábrica o de otro local. Se cuenta producto por producto y, si coincide con el remito, entra al stock.',
        '<button type="button" class="btn btn-sec btn-chico" data-ir="stock">Ver el stock</button>') +
      '<div class="pos-filtros">' + campo('', 'Sucursal', '<select id="rmLocal" class="desplegable">' + opcionesLocales(l.id) + '</select>') +
        campo('rm-buscar', 'Producto', '<input type="search" id="rmBuscar" autocomplete="off" spellcheck="false" placeholder="Código, nombre o etiqueta" ' +
              'title="En qué remitos vino un producto y cuántas llegaron. El código o el nombre; o escaneá la etiqueta">') + '</div>' +
      (prueba ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se reciben remitos: el stock es de verdad. Apagalo (abajo, en el menú) para recibir.</div>' : '') +
      '<div id="rmPendSec"><h3 class="st-tit">Por recibir</h3><div id="rmPend"><p class="cargando">Cargando…</p></div></div>' +
      '<div class="st-tit-fila"><h3 class="st-tit" id="rmTitH">Recibidos</h3><div id="rmPer"></div></div><div id="rmHechos"><p class="cargando">Cargando…</p></div>';
    engancharIr(c);
    var per = periodoPos($('rmPer'), { inicial: 'mes', guardar: 'pos_remitos_periodo', hastaHoy: true,
                                       alCambiar: function () { if (buscado()) buscar(); else cargarHechos(); } });
    $('rmLocal').onchange = function () { S.stLocal = this.value; recordarLocal(this.value); cargar(); };
    /* SQL 204: con «Producto», en vez de las dos listas, los remitos que lo trajeron. Mientras escriben busca solo; con la pistola, enseguida. */
    var tBus = null;
    $('rmBuscar').oninput = function () { clearTimeout(tBus); tBus = setTimeout(cargar, 400); };
    $('rmBuscar').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tBus); cargar(); } };
    function buscado() { return productoBuscado($('rmBuscar').value); }
    var pedido = 0, pedidoH = 0;
    function cargar() {
      clearTimeout(tBus);
      var q = buscado();
      $('rmPendSec').hidden = !!q;
      $('rmTitH').textContent = q ? 'Remitos con «' + q + '»' : 'Recibidos';
      if (q) { buscar(); return; }
      cargarPend(); cargarHechos();
    }
    var pedidoB = 0;
    function buscar() {
      var r = per.rango(), n = ++pedidoB, loc = $('rmLocal').value, q = buscado();
      ++pedido; ++pedidoH;   // lo que estaba cargando de las otras dos listas ya no se pinta
      $('rmHechos').innerHTML = '<p class="cargando">Buscando…</p>';
      llamar('pos_remitos_producto', { p_buscar: q, p_desde: r.desde, p_hasta: r.hasta, p_local: loc }).then(function (d) {
        if (n !== pedidoB || !$('rmHechos') || buscado() !== q) return;
        /* Lo que llegó a este local (lo que salió de acá está en Envíos internos y Devolución a fábrica). */
        var fs = (d.filas || []).filter(function (f) { return f.destino_local_id === loc; });
        $('rmHechos').innerHTML = tablaRemitosProducto(fs, d.mas, q, false);
        $('rmHechos').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
          var id = tr.getAttribute('data-ticket');
          tr.onclick = function () { if (tr.getAttribute('data-pend') && !prueba) abrirRecepcion(id); else abrirRemito(id, cargar); };
          tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
        });
      }).catch(function (e) { if (n === pedidoB && $('rmHechos')) $('rmHechos').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function cargarPend() {
      var n = ++pedido, loc = $('rmLocal').value;
      llamar('pos_remitos', { p_desde: null, p_hasta: null, p_local: loc, p_estado: 'pendiente' }).then(function (d) {
        if (n !== pedido || !$('rmPend')) return;
        var fs = (d.filas || []).filter(function (f) { return f.destino_local_id === loc && !f.entre_depositos; });
        $('rmPend').innerHTML = !fs.length ? '<div class="pos-cartel">No hay remitos por recibir en ' + esc(nombreLocal(localDe(loc))) + '.</div>' :
          '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Remito</th><th>Referencia</th><th>Viene de</th><th>Observaciones</th><th>Productos</th><th></th></tr></thead><tbody>' +
          fs.map(function (f) {
            return '<tr data-rec="' + esc(f.id) + '" tabindex="0"><td><b>' + esc(refRemito(f)) + '</b><small class="st-chico">' + esc(fechaHora(f.fecha)) + '</small></td>' +
              '<td>' + esc(f.referencia || '—') + '</td><td>' + esc(bonito(f.origen)) + '</td><td class="cb-que">' + esc(f.observaciones || '') + '</td>' +
              '<td>' + (f.recibidos ? f.recibidos + ' de ' + f.productos + ' recibidos' : f.productos + (f.productos === 1 ? ' producto' : ' productos')) + '</td>' +
              '<td class="pos-acc"><button type="button" class="btn btn-pri btn-chico" data-recibir="' + esc(f.id) + '"' + (prueba ? ' disabled title="Con el modo prueba no se reciben remitos"' : '') + '>' +
                (f.recibidos ? 'Seguir' : 'Recibir') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>';
        $('rmPend').querySelectorAll('tr[data-rec]').forEach(function (tr) {
          var id = tr.getAttribute('data-rec');
          tr.onclick = function () { if (prueba) abrirRemito(id, cargar); else abrirRecepcion(id); };
          tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
        });
      }).catch(function (e) { if ($('rmPend')) $('rmPend').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function cargarHechos() {
      var r = per.rango(), n = ++pedidoH, loc = $('rmLocal').value;
      $('rmHechos').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_remitos', { p_desde: r.desde, p_hasta: r.hasta, p_local: loc, p_estado: null }).then(function (d) {
        if (n !== pedidoH || !$('rmHechos')) return;
        var fs = (d.filas || []).filter(function (f) { return f.destino_local_id === loc && f.estado !== 'pendiente' && !f.entre_depositos; });
        $('rmHechos').innerHTML = !fs.length ? '<div class="pos-cartel">No hay remitos recibidos en ese período.</div>' :
          '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Remito</th><th>Referencia</th><th>Viene de</th><th>Observaciones</th><th>Recibido</th>' +
            '<th class="n">Llegaron</th><th>Estado</th></tr></thead><tbody>' +
          fs.map(function (f) {
            return '<tr data-ticket="' + esc(f.id) + '" tabindex="0"' + (f.estado === 'anulado' ? ' class="anulada"' : '') + '><td><b>' + esc(refRemito(f)) + '</b><small class="st-chico">' + esc(fechaHora(f.fecha)) + '</small></td>' +
              '<td>' + esc(f.referencia || '—') + '</td><td>' + esc(bonito(f.origen)) + '</td><td class="cb-que">' + esc(f.observaciones || '') + '</td>' +
              '<td>' + esc(f.recibido_en ? fechaHora(f.recibido_en) : '—') + '</td><td class="n tachar">' + (f.contadas == null ? '—' : num(f.contadas)) + '</td><td>' + pillRemito(f.estado) + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
        $('rmHechos').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
          tr.onclick = function () { abrirRemito(tr.getAttribute('data-ticket'), cargar); };
          tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
        });
      }).catch(function (e) { if ($('rmHechos')) $('rmHechos').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    cargar();
  }

  function verRemitosGestion() {
    var c = $('cuerpo');
    c.innerHTML = cabeza('Remitos', 'Lo que la fábrica manda a cada local, los envíos entre locales y lo que vuelve a la fábrica. El local los cuenta a ciegas al recibirlos, en POS → Remitos.',
        '<button type="button" class="btn btn-pri btn-chico" data-ir="remito_nuevo">Nuevo remito</button>') +
      '<div class="pos-filtros"><div id="rgPer"></div>' +
        campo('', 'Sucursal', '<select id="rgLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales('') + '</select>') +
        campo('', 'Estado', '<select id="rgEstado"><option value="">Todos</option>' + opciones([['pendiente', 'Por recibir (de cualquier día)'], ['recibido', 'Recibidos'],
                                                                                              ['con_diferencias', 'Con diferencias'], ['anulado', 'Anulados']], '') + '</select>') +
        campo('rm-buscar', 'Producto', '<input type="search" id="rgBuscar" autocomplete="off" spellcheck="false" placeholder="Código, nombre o etiqueta" ' +
              'title="En qué remitos va un producto y cuántas llegaron. El código o el nombre; o escaneá la etiqueta">') +
      '</div><div id="rgLista"><p class="cargando">Cargando…</p></div>';
    engancharIr(c);
    var per = periodoPos($('rgPer'), { inicial: 'mes', guardar: 'pos_remitos_gestion_periodo', hastaHoy: true, alCambiar: cargar });
    ['rgLocal', 'rgEstado'].forEach(function (id) { $(id).onchange = cargar; });
    var tBus = null;
    $('rgBuscar').oninput = function () { clearTimeout(tBus); tBus = setTimeout(cargar, 400); };
    $('rgBuscar').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tBus); cargar(); } };
    var pedido = 0;
    function cargar() {
      clearTimeout(tBus);
      var q = productoBuscado($('rgBuscar').value);
      if (q) { buscar(q); return; }
      var r = per.rango(), n = ++pedido;
      $('rgLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_remitos', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('rgLocal').value || null, p_estado: $('rgEstado').value || null }).then(function (d) {
        if (n !== pedido || !$('rgLista')) return;
        var t = d.totales || {};
        var kpis = '<div class="pos-totales">' +
          '<div class="pos-kpi"><span>Remitos</span><b>' + num(t.remitos) + '</b></div>' +
          '<div class="pos-kpi"><span>Por recibir</span><b>' + num(t.pendientes) + '</b></div>' +
          '<div class="pos-kpi"><span>Con diferencias</span><b class="' + (t.con_diferencias ? 'st-sale' : '') + '">' + num(t.con_diferencias) + '</b></div>' +
          '<div class="pos-kpi fuerte"><span>Unidades mandadas</span><b>' + num(t.unidades) + '</b></div></div>';
        d.filas = (d.filas || []).filter(function (f) { return !f.entre_depositos; });   // SQL 193: los pases entre depósitos están en Envíos internos
        if (!d.filas || !d.filas.length) { $('rgLista').innerHTML = kpis + '<div class="pos-cartel">No hay remitos en ese período con esos filtros.</div>'; return; }
        $('rgLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla cj-tabla"><thead><tr><th>Remito</th><th>Referencia</th><th>Sale de</th><th>Llega a</th>' +
            '<th>Observaciones</th><th>Productos</th><th class="n">Mandaron</th><th class="n">Llegaron</th><th>Estado</th></tr></thead><tbody>' +
          d.filas.map(function (f) {
            var dif = f.contadas != null && f.estado !== 'pendiente' && Number(f.contadas) !== Number(f.unidades);
            return '<tr data-ticket="' + esc(f.id) + '" tabindex="0"' + (f.estado === 'anulado' ? ' class="anulada"' : '') + '><td><b>' + esc(refRemito(f)) + '</b><small>' + esc(fechaHora(f.fecha)) + '</small></td>' +
              '<td>' + esc(f.referencia || '—') + '</td><td>' + esc(bonito(f.origen)) + '</td><td>' + esc(bonito(f.destino)) + '<small>' + esc(f.creado_nombre || '') + '</small></td>' +
              '<td class="cb-que">' + esc(f.observaciones || '') + '</td>' +
              '<td>' + (f.estado === 'pendiente' && f.recibidos ? f.recibidos + ' de ' + f.productos : num(f.productos)) + '</td>' +
              '<td class="n tachar">' + num(f.unidades) + '</td><td class="n' + (dif ? ' st-sale' : '') + '">' + (f.contadas == null ? '—' : num(f.contadas)) + '</td>' +
              '<td>' + pillRemito(f.estado) + (f.dif_pendientes > 0 && f.estado !== 'anulado' ? '<small class="df-pend">' + f.dif_pendientes + ' sin resolver</small>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
        $('rgLista').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
          tr.onclick = function () { abrirRemito(tr.getAttribute('data-ticket'), cargar); };
          tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
        });
      }).catch(function (e) { if ($('rgLista')) $('rgLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    /* SQL 204: con «Producto», un renglón por remito con lo que vino de ese producto. El estado se filtra acá. */
    function buscar(q) {
      var r = per.rango(), n = ++pedido, est = $('rgEstado').value;
      $('rgLista').innerHTML = '<p class="cargando">Buscando…</p>';
      llamar('pos_remitos_producto', { p_buscar: q, p_desde: r.desde, p_hasta: r.hasta, p_local: $('rgLocal').value || null }).then(function (d) {
        if (n !== pedido || !$('rgLista')) return;
        var fs = (d.filas || []).filter(function (f) {
          return !est || f.estado === est || (est === 'recibido' && f.estado === 'con_diferencias');
        });
        $('rgLista').innerHTML = tablaRemitosProducto(fs, d.mas, q, true);
        $('rgLista').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
          tr.onclick = function () { abrirRemito(tr.getAttribute('data-ticket'), cargar); };
          tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
        });
      }).catch(function (e) { if (n === pedido && $('rgLista')) $('rgLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    cargar();
  }

  /* SQL 204: lo que se busca en «Producto» de Remitos. De la etiqueta escaneada ("RM10299 L BL"), la prenda: todos sus
     talles y colores. Con menos de 2 letras, nada (se ven las listas de siempre). */
  function productoBuscado(txt) {
    var t = String(txt || '').trim(), s = leerEscaneo(t);
    t = s ? s.codigo : t;
    return t.length >= 2 ? t : '';
  }
  /** Los remitos de un producto (SQL 204): un renglón por remito y producto. En el local, sólo lo que llegó; mientras se
      cuenta a ciegas, «Mandaron» no se ve. Los anulados se ven tachados y no suman. */
  function tablaRemitosProducto(fs, mas, q, gestion) {
    if (!fs.length) return '<div class="pos-cartel">No hay remitos con «' + esc(q) + '» en ese período' + (gestion ? ' con esos filtros' : '') + '.</div>';
    var vale = fs.filter(function (f) { return f.estado !== 'anulado'; }), ids = {}, pend = {}, cods = {}, mand = 0, lleg = 0, ciegas = false;
    vale.forEach(function (f) {
      ids[f.id] = 1; cods[f.codigo] = 1;
      if (f.estado === 'pendiente') pend[f.id] = 1;
      if (f.mandaron == null) ciegas = true; else mand += f.mandaron;
      lleg += f.llegaron || 0;
    });
    var nCods = Object.keys(cods).length;
    var kpis = '<div class="pos-totales">' +
      '<div class="pos-kpi"><span>Remitos</span><b>' + num(Object.keys(ids).length) + '</b></div>' +
      (nCods > 1 ? '<div class="pos-kpi"><span>Productos</span><b>' + num(nCods) + '</b></div>' : '') +
      '<div class="pos-kpi"><span>Por recibir</span><b>' + num(Object.keys(pend).length) + '</b></div>' +
      (ciegas ? '' : '<div class="pos-kpi"><span>Mandaron</span><b>' + num(mand) + '</b></div>') +
      '<div class="pos-kpi fuerte"><span>Llegaron</span><b>' + num(lleg) + '</b></div></div>';
    return kpis + '<div class="pos-marco-tabla"><table class="pos-tabla cj-tabla"><thead><tr><th>Remito</th>' +
        (gestion ? '<th>Sale de</th><th>Llega a</th>' : '<th>Viene de</th>') + '<th>Producto</th><th class="n">Mandaron</th><th class="n">Llegaron</th><th>Estado</th></tr></thead><tbody>' +
      fs.map(function (f) {
        var dif = f.llegaron != null && f.mandaron != null && f.estado !== 'pendiente' && f.llegaron !== f.mandaron;
        return '<tr data-ticket="' + esc(f.id) + '"' + (f.estado === 'pendiente' ? ' data-pend="1"' : '') + ' tabindex="0"' + (f.estado === 'anulado' ? ' class="anulada"' : '') + '>' +
          '<td><b>' + esc(refRemito(f)) + '</b><small' + (gestion ? '' : ' class="st-chico"') + '>' + esc(fechaHora(f.fecha)) + '</small></td>' +
          (gestion ? '<td>' + esc(bonito(f.origen)) + '</td><td>' + esc(bonito(f.destino)) + '</td>' : '<td>' + esc(bonito(f.origen)) + '</td>') +
          '<td><b>' + esc(f.codigo) + '</b><small>' + esc(f.descripcion || '') + '</small></td>' +
          '<td class="n tachar">' + (f.mandaron == null ? '<span class="rm-ciegas" title="Se ve al contarlo">—</span>' : num(f.mandaron)) + '</td>' +
          '<td class="n tachar' + (dif ? ' st-sale' : '') + '">' + (f.llegaron == null ? '—' : num(f.llegaron)) + '</td>' +
          '<td>' + pillRemito(f.estado) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (mas ? '<p class="pos-mas">Se ven los últimos 1.000. Achicá el período para ver el resto.</p>' : '');
  }

  /* ════════════════════════════════════════════════════════════════════
     DEVOLUCIÓN A FÁBRICA (el mostrador, SQL 189, 28/10)
     Mauricio (28/10): "si tenemos que devolver algo a fábrica, tenemos que
     hacer una devolución… la pestaña se tiene que llamar devolución a
     fábrica". Es "Devoluciones a Fábrica y Proveedores" de BlueSoft: la
     lista de lo que el local devolvió, con el período y la sucursal, y
     «Nueva devolución». En la base es un remito sin destino (SQL 167): sale
     del stock al guardarlo y la oficina lo da por recibido cuando llega
     (Gestión → Remitos, «Llegó a la fábrica»).
     ════════════════════════════════════════════════════════════════════ */
  /* Los estados de BlueSoft: "Enviado" mientras viaja; "Recibido" cuando la oficina dice que llegó. */
  var ESTADO_DEV = { pendiente: ['Enviado', ''], recibido: ['Recibido en la fábrica', 'pill-ok'], con_diferencias: ['Recibido en la fábrica', 'pill-ok'],
                     anulado: ['Anulada', 'pill-bad'] };
  function pillDev(e) { var x = ESTADO_DEV[e] || [e, '']; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  /** El total de una devolución: sin el SQL 189 no hay precios ("—"). */
  function totalDev(f) { return f.sin_precio === undefined ? '—' : plata(cent(f.total || 0)); }

  function verDevoluciones() {
    var c = $('cuerpo'), l = localStock(), prueba = enPrueba();
    c.innerHTML = cabeza('Devolución a fábrica' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que el local le devuelve a la fábrica (fallados, sobrantes). Sale del stock al guardarla; cuando llega, la oficina la da por recibida.',
        '<button type="button" class="btn btn-sec btn-chico" id="dvBajar" disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-pri btn-chico" data-ir="devolucion_nueva">Nueva devolución</button>') +
      '<div class="pos-filtros"><div id="dvPer"></div>' + campo('', 'Sucursal', '<select id="dvLocal" class="desplegable">' + opcionesLocales(l.id) + '</select>') + '</div>' +
      (prueba ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se guardan devoluciones: el stock es de verdad. Apagalo (abajo, en el menú) para hacer una.</div>' : '') +
      '<div id="dvLista"><p class="cargando">Cargando…</p></div>';
    engancharIr(c);
    var per = periodoPos($('dvPer'), { inicial: 'mes', guardar: 'pos_devoluciones_periodo', hastaHoy: true, alCambiar: cargar });
    $('dvLocal').onchange = function () { S.stLocal = this.value; recordarLocal(this.value); cargar(); };
    var pedido = 0, filas = [];
    function cargar() {
      var r = per.rango(), n = ++pedido, loc = $('dvLocal').value;
      $('dvLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('dvBajar').disabled = true;
      llamar('pos_remitos', { p_desde: r.desde, p_hasta: r.hasta, p_local: loc, p_estado: null }).then(function (d) {
        if (n !== pedido || !$('dvLista')) return;
        /* De todos los remitos del local, los que salen de él y vuelven a la fábrica. */
        filas = (d.filas || []).filter(function (f) { return f.origen_local_id === loc && !f.destino_local_id; });
        pintar(d.mas);
      }).catch(function (e) { if ($('dvLista')) $('dvLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintar(mas) {
      var vivas = filas.filter(function (f) { return f.estado !== 'anulado'; });
      var con189 = !filas.length || filas[0].sin_precio !== undefined, vp = puede('precios');   // SQL 190: sin «Ver precios», sin el monto
      /* Los totales de abajo de BlueSoft: cantidad de devoluciones, de productos (unidades) y el monto. */
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Devoluciones</span><b>' + miles(vivas.length) + '</b></div>' +
        '<div class="pos-kpi"><span>Enviadas, sin llegar</span><b>' + miles(vivas.filter(function (f) { return f.estado === 'pendiente'; }).length) + '</b></div>' +
        '<div class="pos-kpi"><span>Unidades</span><b>' + num(vivas.reduce(function (s, f) { return s + Number(f.unidades || 0); }, 0)) + '</b></div>' +
        (vp ? '<div class="pos-kpi fuerte"><span>Monto total</span><b>' + (con189 ? plata(cent(vivas.reduce(function (s, f) { return s + Number(f.total || 0); }, 0))) : '—') + '</b></div>' : '') + '</div>';
      if (!filas.length) {
        $('dvLista').innerHTML = kpis + '<div class="pos-cartel">No hay devoluciones de ' + esc(nombreLocal(localDe($('dvLocal').value))) + ' en ese período. Se hacen con «Nueva devolución».</div>';
        return;
      }
      /* Las columnas de BlueSoft (Fecha, Comprobante, Estado, Cantidad, Total, Observaciones), con quién la cargó. */
      $('dvLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Estado</th><th>Cargó</th>' +
          '<th class="n">Unidades</th>' + (vp ? '<th class="n">Total</th>' : '') + '<th>Observaciones</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          return '<tr data-dev="' + i + '" tabindex="0" class="' + (f.estado === 'anulado' ? 'anulada ' : '') + (f.id === S.dvMarcar ? 'recien' : '') + '">' +
            '<td><b>' + esc(refRemito(f)) + '</b></td><td>' + esc(fechaHora(f.fecha)) + '<small class="st-chico">' + esc(diaSemana(f.fecha)) + '</small></td>' +
            '<td>' + pillDev(f.estado) + (f.recibido_en ? '<small class="st-chico">' + esc(fechaHora(f.recibido_en)) + '</small>' : '') + '</td>' +
            '<td>' + esc(f.creado_nombre || '—') + '</td><td class="n tachar">' + num(f.unidades) + '</td>' +
            (vp ? '<td class="n tachar"><b>' + totalDev(f) + '</b>' + (f.sin_precio ? '<small class="st-chico">' + f.sin_precio + ' sin precio</small>' : '') + '</td>' : '') +
            '<td class="cb-que">' + esc(f.observaciones || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (mas ? '<p class="pos-mas">Se ven los últimos 500 remitos. Achicá el período para ver el resto.</p>' : '');
      $('dvLista').querySelectorAll('tr[data-dev]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-dev'))];
        tr.onclick = function () { abrirRemito(f.id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      var m = $('dvLista').querySelector('tr.recien');
      if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
      S.dvMarcar = null;
      $('dvBajar').disabled = false;
    }
    $('dvBajar').onclick = function () {
      var loc = nombreLocal(localDe($('dvLocal').value)), r = per.rango();
      var vp = puede('precios');
      bajarCsv('Devoluciones a fábrica ' + loc + ' ' + r.desde + ' a ' + r.hasta + '.csv', ['Número', 'Fecha', 'Sucursal', 'Estado', 'Cargó', 'Unidades'].concat(vp ? ['Total'] : [], ['Observaciones']),
        filas.map(function (f) {
          return [refRemito(f), fechaHora(f.fecha), loc, (ESTADO_DEV[f.estado] || [f.estado])[0], f.creado_nombre || '', Number(f.unidades || 0)]
            .concat(vp ? [f.total == null ? '' : String(Number(f.total)).replace('.', ',')] : [], [f.observaciones || '']);   // la coma decimal, para el Excel en castellano
        }));
    };
    cargar();
  }

  /* ════════════════════════════════════════════════════════════════════
     ENVÍOS INTERNOS (el mostrador, 28/10)
     Mauricio (28/10): "sigamos con envíos internos" (las fotos de "Envíos
     de Mercadería Internos" de BlueSoft). La lista de lo que el local le
     mandó a otros locales y de lo que otros le mandaron, con el período,
     la sucursal y qué mostrar, y «Nuevo envío». Lo que llega se recibe
     contándolo en POS → Remitos, como lo de la fábrica.
     ════════════════════════════════════════════════════════════════════ */
  function verEnvios() {
    var c = $('cuerpo'), l = localStock(), prueba = enPrueba();
    c.innerHTML = cabeza('Envíos internos' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que el local le manda a otro local, y lo que otros le mandan. Sale del stock al guardarlo; el otro local lo recibe contándolo en POS → Remitos.',
        '<button type="button" class="btn btn-sec btn-chico" id="evBajar" disabled>Bajar para Excel</button>' +
        '<button type="button" class="btn btn-pri btn-chico" data-ir="envio_nuevo">Nuevo envío</button>') +
      '<div class="pos-filtros"><div id="evPer"></div>' + campo('', 'Sucursal', '<select id="evLocal" class="desplegable">' + opcionesLocales(l.id) + '</select>') +
        campo('', 'Mostrar', '<select id="evVer">' + opciones([['', 'Los que salen y los que llegan'], ['salen', 'Los que salen'], ['llegan', 'Los que llegan'],
                                             ['depositos', 'Entre depósitos (el stock del local)']], S.evVer || '') + '</select>') +
      '</div>' +
      (prueba ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se guardan envíos: el stock es de verdad. Apagalo (abajo, en el menú) para hacer uno.</div>' : '') +
      '<div id="evLista"><p class="cargando">Cargando…</p></div>';
    engancharIr(c);
    /* SQL 193: desde «Entre depósitos», el envío nuevo arranca en ése. */
    c.querySelector('.pos-acciones [data-ir="envio_nuevo"]').onclick = function () { S.evTipo = $('evVer').value === 'depositos' ? 'entre' : null; ir('envio_nuevo'); };
    var per = periodoPos($('evPer'), { inicial: 'mes', guardar: 'pos_envios_periodo', hastaHoy: true, alCambiar: cargar });
    $('evLocal').onchange = function () { S.stLocal = this.value; recordarLocal(this.value); cargar(); };
    $('evVer').onchange = function () { S.evVer = this.value; pintar(); };
    var pedido = 0, todas = [], filas = [], mas = false;
    function cargar() {
      var r = per.rango(), n = ++pedido, loc = $('evLocal').value;
      $('evLista').innerHTML = '<p class="cargando">Cargando…</p>';
      $('evBajar').disabled = true;
      llamar('pos_remitos', { p_desde: r.desde, p_hasta: r.hasta, p_local: loc, p_estado: null }).then(function (d) {
        if (n !== pedido || !$('evLista')) return;
        /* Entre locales: sale de uno y llega a otro (lo de la fábrica son los Remitos; lo que vuelve a la fábrica, las devoluciones). */
        todas = (d.filas || []).filter(function (f) { return f.origen_local_id && f.destino_local_id && (f.origen_local_id === loc || f.destino_local_id === loc); });
        mas = d.mas;
        pintar();
      }).catch(function (e) { if ($('evLista')) $('evLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintar() {
      var loc = $('evLocal').value, v = $('evVer').value, nom = nombreLocal(localDe(loc));
      if (v === 'depositos') { pintarPases(); return; }
      filas = todas.filter(function (f) { return !f.entre_depositos && (!v || (v === 'salen' ? f.origen_local_id === loc : f.destino_local_id === loc)); });
      var vivas = filas.filter(function (f) { return f.estado !== 'anulado'; });
      var con189 = !filas.length || filas[0].sin_precio !== undefined, vp = puede('precios');   // SQL 190: sin «Ver precios», sin el monto
      /* Los totales de abajo de BlueSoft: cantidad de envíos, unidades y monto; y cuántos faltan recibir. */
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Envíos</span><b>' + miles(vivas.length) + '</b></div>' +
        '<div class="pos-kpi"><span>Por recibir</span><b>' + miles(vivas.filter(function (f) { return f.estado === 'pendiente'; }).length) + '</b></div>' +
        '<div class="pos-kpi"><span>Unidades</span><b>' + num(vivas.reduce(function (s, f) { return s + Number(f.unidades || 0); }, 0)) + '</b></div>' +
        (vp ? '<div class="pos-kpi fuerte"><span>Monto total</span><b>' + (con189 ? plata(cent(vivas.reduce(function (s, f) { return s + Number(f.total || 0); }, 0))) : '—') + '</b></div>' : '') + '</div>';
      if (!filas.length) {
        $('evLista').innerHTML = kpis + '<div class="pos-cartel">' + (v === 'llegan' ? 'Ningún local le mandó nada a ' + esc(nom) + ' en ese período.' :
          v === 'salen' ? esc(nom) + ' no mandó nada en ese período. Se hace con «Nuevo envío».' :
          'No hay envíos de ' + esc(nom) + ' ni a ' + esc(nom) + ' en ese período. Se hacen con «Nuevo envío».') + '</div>';
        $('evBajar').disabled = true;
        return;
      }
      /* Las columnas de BlueSoft (Fecha, Referencia, Origen, Destino, Cantidad, Total, Observaciones), con el estado y quién lo cargó.
         El otro local, en negrita. */
      $('evLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Sale de</th><th>Llega a</th>' +
          '<th>Estado</th><th>Cargó</th><th class="n">Unidades</th>' + (vp ? '<th class="n">Total</th>' : '') + '<th>Observaciones</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          var sale = f.origen_local_id === loc;
          return '<tr data-env="' + i + '" tabindex="0" class="' + (f.estado === 'anulado' ? 'anulada ' : '') + (f.id === S.evMarcar ? 'recien' : '') + '">' +
            '<td><b>' + esc(refRemito(f)) + '</b></td><td>' + esc(fechaHora(f.fecha)) + '<small class="st-chico">' + esc(diaSemana(f.fecha)) + '</small></td>' +
            '<td>' + (sale ? esc(bonito(f.origen)) : '<b>' + esc(bonito(f.origen)) + '</b>') + '</td>' +
            '<td>' + (sale ? '<b>' + esc(bonito(f.destino)) + '</b>' : esc(bonito(f.destino))) + '</td>' +
            '<td>' + pillRemito(f.estado) + (f.recibido_en ? '<small class="st-chico">' + esc(fechaHora(f.recibido_en)) + '</small>' :
                     !sale && f.estado === 'pendiente' ? '<small class="st-chico">Se recibe en Remitos</small>' : '') + '</td>' +
            '<td>' + esc(f.creado_nombre || '—') + '</td><td class="n tachar">' + (f.unidades == null ? '<span class="apagado" title="Se ven al contarlo">—</span>' : num(f.unidades)) + '</td>' +
            (vp ? '<td class="n tachar"><b>' + (f.total == null && !sale ? '<span class="apagado">—</span>' : totalDev(f)) + '</b>' + (f.sin_precio ? '<small class="st-chico">' + f.sin_precio + ' sin precio</small>' : '') + '</td>' : '') +
            '<td class="cb-que">' + esc(f.observaciones || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (mas ? '<p class="pos-mas">Se ven los últimos 500 remitos. Achicá el período para ver el resto.</p>' : '');
      $('evLista').querySelectorAll('tr[data-env]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-env'))];
        /* El que lo mandó lo ve entero; el que lo recibe, a ciegas hasta contarlo (con «Recibirlo»). */
        tr.onclick = function () { abrirRemito(f.id, cargar, { salida: f.origen_local_id === loc }); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      var m = $('evLista').querySelector('tr.recien');
      if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
      S.evMarcar = null;
      $('evBajar').disabled = false;
    }
    /* SQL 193: los envíos entre depósitos de la sucursal (el stock de todo el local), con su módulo y cómo quedó el control con testigos. */
    function pintarPases() {
      var loc = $('evLocal').value, nom = nombreLocal(localDe(loc));
      filas = todas.filter(function (f) { return f.entre_depositos; });
      var vivas = filas.filter(function (f) { return f.estado !== 'anulado'; }), est = vivas.map(estadoTestigos);
      function cuantos(e) { return est.filter(function (x) { return e.indexOf(x) >= 0; }).length; }
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Módulos</span><b>' + miles(vivas.length) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>Unidades</span><b>' + num(vivas.reduce(function (s, f) { return s + Number(f.unidades || 0); }, 0)) + '</b></div>' +
        '<div class="pos-kpi"><span>Controlados</span><b>' + miles(cuantos(['ok'])) + '</b></div>' +
        '<div class="pos-kpi"><span>Sin controlar</span><b>' + miles(cuantos(['sin', 'uno'])) + '</b></div>' +
        '<div class="pos-kpi"><span>Para rehacer</span><b class="' + (cuantos(['mal']) ? 'st-sale' : '') + '">' + miles(cuantos(['mal'])) + '</b></div></div>';
      if (!filas.length) {
        $('evLista').innerHTML = kpis + '<div class="pos-cartel">No hay envíos entre depósitos de ' + esc(nom) + ' en ese período. Para el stock de todo el local: «Nuevo envío» → «Entre depósitos del local», un envío por módulo.</div>';
        $('evBajar').disabled = true;
        return;
      }
      $('evLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Número</th><th>Fecha</th><th>Módulo</th><th>Responsable</th><th>Sale de</th><th>Llega a</th>' +
          '<th class="n">Unidades</th><th>Testigos</th><th>Cargó</th><th>Observaciones</th></tr></thead><tbody>' +
        filas.map(function (f, i) {
          return '<tr data-env="' + i + '" tabindex="0" class="' + (f.estado === 'anulado' ? 'anulada ' : '') + (f.id === S.evMarcar ? 'recien' : '') + '">' +
            '<td><b>' + esc(refRemito(f)) + '</b></td><td>' + esc(fechaHora(f.fecha)) + '<small class="st-chico">' + esc(diaSemana(f.fecha)) + '</small></td>' +
            '<td><b>' + esc(f.modulo || '—') + '</b></td><td>' + esc(f.responsable || '—') + '</td>' +
            '<td>' + esc(f.origen_deposito || '—') + '</td><td><b>' + esc(f.destino_deposito || '—') + '</b></td>' +
            '<td class="n tachar">' + num(f.unidades) + '</td><td>' + (f.estado === 'anulado' ? pillRemito('anulado') : pillTestigos(f)) + '</td>' +
            '<td>' + esc(f.creado_nombre || '—') + '</td><td class="cb-que">' + esc(f.observaciones || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (mas ? '<p class="pos-mas">Se ven los últimos 500 remitos. Achicá el período para ver el resto.</p>' : '');
      $('evLista').querySelectorAll('tr[data-env]').forEach(function (tr) {
        var f = filas[Number(tr.getAttribute('data-env'))];
        tr.onclick = function () { abrirPase(f.id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
      var m = $('evLista').querySelector('tr.recien');
      if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
      S.evMarcar = null;
      $('evBajar').disabled = false;
    }
    $('evBajar').onclick = function () {
      var loc = nombreLocal(localDe($('evLocal').value)), r = per.rango();
      if ($('evVer').value === 'depositos') {
        bajarCsv('Envíos entre depósitos ' + loc + ' ' + r.desde + ' a ' + r.hasta + '.csv',
          ['Número', 'Fecha', 'Módulo', 'Responsable', 'Sale de', 'Llega a', 'Estado', 'Unidades', 'Testigos', 'Cargó', 'Observaciones'],
          filas.map(function (f) {
            return [refRemito(f), fechaHora(f.fecha), f.modulo || '', f.responsable || '', f.origen_deposito || '', f.destino_deposito || '', f.estado === 'anulado' ? 'Anulado' : 'Pasado',
                    Number(f.unidades || 0), f.estado === 'anulado' ? '' : TESTIGOS[estadoTestigos(f)], f.creado_nombre || '', f.observaciones || ''];
          }));
        return;
      }
      var vp = puede('precios');
      bajarCsv('Envíos internos ' + loc + ' ' + r.desde + ' a ' + r.hasta + '.csv', ['Número', 'Fecha', 'Sale de', 'Llega a', 'Estado', 'Cargó', 'Unidades'].concat(vp ? ['Total'] : [], ['Observaciones']),
        filas.map(function (f) {
          return [refRemito(f), fechaHora(f.fecha), bonito(f.origen), bonito(f.destino), (ESTADO_REMITO[f.estado] || [f.estado])[0], f.creado_nombre || '',
                  f.unidades == null ? '' : Number(f.unidades)].concat(vp ? [f.total == null ? '' : String(Number(f.total)).replace('.', ',')] : [], [f.observaciones || '']);   // la coma decimal, para el Excel en castellano
        }));
    };
    cargar();
  }

  /* ── SQL 193: el envío entre depósitos de la sucursal (un módulo del stock de todo el local) ──
     El control con testigos: alguien elige dos productos del módulo, cuenta todas sus prendas ahí (todos
     los talles y colores) y lo anota a ciegas; la base dice si coincide con el envío (vale lo último de
     cada producto). Si no coincide, el módulo se rehace: se anula el envío y se pasa de nuevo. */
  var TESTIGOS = { mal: 'Rehacer', ok: 'Controlado', uno: 'Falta un testigo', sin: 'Sin controlar' };
  function estadoTestigos(f) { var ok = Number(f.testigos_ok) || 0; return Number(f.testigos_mal) > 0 ? 'mal' : ok >= 2 ? 'ok' : ok === 1 ? 'uno' : 'sin'; }
  function pillTestigos(f) {
    var e = estadoTestigos(f);
    return '<span class="pill' + (e === 'mal' ? ' pill-bad" title="Un testigo no coincide: anulá el envío y pasá el módulo de nuevo"' : e === 'ok' ? ' pill-ok"' : e === 'uno' ? ' pill-warn"' : '"') + '>' + TESTIGOS[e] + '</span>';
  }
  function ultimosTestigos(ts) { var m = {}; (ts || []).forEach(function (t) { m[t.codigo] = t; }); return Object.keys(m).map(function (k) { return m[k]; }); }
  function contarTestigos(ts) { var u = ultimosTestigos(ts), mal = u.filter(function (t) { return !t.coincide; }).length; return { testigos_ok: u.length - mal, testigos_mal: mal }; }

  function abrirPase(id, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">Envío entre depósitos</h3><p class="cargando">Cargando…</p>', true), dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_remito', { p_id: id, p_completo: true }).then(function (r) {
      if (!caja.isConnected) return;
      var an = r.estado === 'anulado', ts = r.testigos || [], ult = ultimosTestigos(ts), ct = contarTestigos(ts), est = estadoTestigos(ct), unid = 0;
      var prods = (r.productos || []).map(function (p) {
        var cel = (p.celdas || []).map(function (x) { unid += Number(x.cantidad || 0); return { talle: x.talle, color: x.color, cantidad: x.cantidad }; });
        return '<div class="st-prod"><div class="st-prod-cab"><b>' + esc(p.codigo) + '</b><span>' + esc(nombreProd(p.codigo, p.descripcion)) + '</span></div>' + grillaRemito(p.codigo, cel) + '</div>';
      }).join('');
      var np = (r.productos || []).length, deDonde = esc(r.origen_deposito || '');
      dentro.innerHTML = '<h3 id="posVentTit">Envío entre depósitos ' + esc(refRemito(r)) + ' ' + (an ? pillRemito('anulado') : pillTestigos(ct)) + '</h3>' +
        '<div class="pos-ticket-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(r.fecha)) + '</div>' +
          '<div><span>Sucursal</span>' + esc(bonito(r.origen)) + '</div>' +
          '<div><span>Sale de</span>' + deDonde + '</div>' +
          '<div><span>Llega a</span><b>' + esc(r.destino_deposito || '') + '</b></div>' +
          '<div><span>Módulo</span><b>' + esc(r.modulo || '—') + '</b></div>' +
          '<div><span>Responsable</span>' + esc(r.responsable || '—') + '</div>' +
          '<div><span>Lo cargó</span>' + esc(r.creado_nombre || '—') + '</div>' +
        '</div>' +
        (r.observaciones ? '<p class="cj-obs"><b>Observaciones:</b> ' + esc(r.observaciones) + '</p>' : '') +
        (an ? '<div class="pos-cartel mal">Anulado el ' + esc(fechaHora(r.anulado_en)) + (r.anulado_por_nombre ? ' por ' + esc(r.anulado_por_nombre) : '') + ': ' + esc(r.anulado_motivo || '') +
              '. Las prendas volvieron a «' + deDonde + '».</div>' :
         est === 'mal' ? '<div class="pos-cartel mal">Un testigo no coincide con el envío. Contalo de nuevo; si sigue sin coincidir, rehacé el módulo: anulá este envío (las prendas vuelven a «' + deDonde + '») y pasalo de nuevo.</div>' :
         est === 'ok' ? '<div class="pos-cartel st-ok">Controlado: los testigos coinciden con el envío.</div>' :
         '<div class="pos-cartel">' + (est === 'uno' ? 'Falta un testigo. ' : 'Todavía no se controló. ') + 'Elegí dos productos del módulo, contá todas sus prendas y anotalas con «Controlar con testigos»: el sistema te dice si coinciden con el envío.</div>') +
        (ts.length ? '<p class="pos-lbl rm-leyenda">Testigos</p><div class="pos-marco-tabla"><table class="pos-tabla tg-tabla"><thead><tr><th>Producto</th><th class="n">Contaron</th><th>Resultado</th><th>Quién</th><th>Cuándo</th></tr></thead><tbody>' +
            ts.slice().reverse().map(function (t) {
              var vale = ult.indexOf(t) >= 0;
              return '<tr' + (vale ? '' : ' class="tg-vieja" title="Lo contaron de nuevo después: vale lo último"') + '><td><b>' + esc(t.codigo) + '</b> ' + esc(PROD[t.codigo] ? PROD[t.codigo][1] : '') + '</td>' +
                '<td class="n">' + num(t.contado) + '</td><td>' + (t.coincide ? '<span class="pill pill-ok">Coincide</span>' : '<span class="pill pill-bad">No coincide</span>') + '</td>' +
                '<td>' + esc(t.quien || '—') + '</td><td>' + esc(fechaHora(t.fecha)) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '') +
        '<details class="pa-prods"><summary>Lo que se pasó: ' + np + (np === 1 ? ' producto, ' : ' productos, ') + num(unid) + (unid === 1 ? ' unidad' : ' unidades') + '</summary>' +
          '<div class="st-prods">' + prods + '</div></details>' +
        '<div id="paAnular"></div><div class="pos-pie">' +
          (!an && puede('envios') ? '<button type="button" class="btn btn-sec btn-chico izq" id="paAnularBtn">Anular el envío</button>' +
                                    '<button type="button" class="btn btn-sec btn-chico" id="paControlar">Controlar con testigos</button>' : '') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var ab = dentro.querySelector('#paAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        pedirMotivo(dentro.querySelector('#paAnular'), 'El envío queda en la lista, tachado, con quién lo anuló y por qué. ' +
            (unid === 1 ? 'La prenda vuelve' : 'Las ' + num(unid) + ' prendas vuelven') + ' a «' + deDonde + '». Para rehacer el módulo, después hacé un envío nuevo. No se puede deshacer.',
          'Anular el envío ' + refRemito(r), function (motivo) {
          return llamar('pos_remito_anular', { p_id: r.id, p_motivo: motivo }).then(function () {
            avisar('ok', 'El envío ' + refRemito(r) + ' quedó anulado: las prendas volvieron a «' + (r.origen_deposito || '') + '».');
            S.stock = {};
            S.dep = {};
            if (alCambiar) alCambiar();
            abrirPase(r.id, alCambiar);
          });
        });
      };
      var co = dentro.querySelector('#paControlar');
      if (co) co.onclick = function () { abrirTestigos(r, alCambiar); };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Envío entre depósitos</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /** El control de un módulo con productos testigo, a ciegas: no se ve lo que dice el envío. */
  function abrirTestigos(r, alCambiar) {
    var enEnvio = {}, elegido = null;
    (r.productos || []).forEach(function (p) { enEnvio[p.codigo] = p.descripcion || ''; });
    var caja = ventana('<h3 id="posVentTit">Controlar ' + esc(refRemito(r)) + ' con testigos</h3>' +
      '<p class="pos-bajada">Módulo ' + esc(r.modulo || '—') + ' · de «' + esc(r.origen_deposito || '') + '» a «' + esc(r.destino_deposito || '') + '». ' +
        'Elegí un producto del módulo, contá todas sus prendas ahí (todos los talles y colores) y escribí cuántas hay. El sistema te dice si coincide con el envío.</p>' +
      '<div class="tk-prod tg-prod">' + campo('', 'Producto testigo', '<input type="search" id="tgProd" autocomplete="off" spellcheck="false" placeholder="Escaneá la etiqueta, o buscá por código o nombre…" aria-controls="tgSug">') +
        '<div class="tk-sug" id="tgSug" role="listbox" aria-label="Productos" hidden></div></div>' +
      '<div id="tgElegido" class="tg-elegido"></div>' +
      '<div class="pos-campos">' +
        campo('', 'Cuántas hay en el módulo', '<input type="number" id="tgN" min="0" max="9999" inputmode="numeric">') +
        campo('', 'Quién controla <span class="lbl-opc">(opcional)</span>', '<input type="text" id="tgQuien" maxlength="60" list="tgVend" autocomplete="off"><datalist id="tgVend">' +
          vendedoresDe(r.origen_local_id).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>') +
      '</div><div class="pos-error" id="tgError"></div><div id="tgRes" role="status"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="tgVolver">‹ Volver al envío</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="tgOk">Anotar el testigo</button></div>');
    var n = caja.querySelector('#tgN'), quien = caja.querySelector('#tgQuien'), el = caja.querySelector('#tgElegido');
    quien.value = S.tgQuien || '';
    function elegir(cod) {
      elegido = cod;
      $('tgProd').limpiar();
      el.innerHTML = '<b>' + esc(cod) + '</b> ' + esc(PROD[cod] ? PROD[cod][1] : enEnvio[cod] || '') + ' <button type="button" class="pos-link" id="tgOtro">Elegir otro</button>';
      el.querySelector('#tgOtro').onclick = function () { elegido = null; el.innerHTML = ''; $('tgProd').focus(); };
      errorEn(caja, 'tgError', '');
      n.value = '';
      n.focus();
    }
    engancharProducto({ campo: 'tgProd', sug: 'tgSug', lista: function () { return null; }, sinPrecio: true, sinLinea: true, escaneoLibre: true,
      prod: function (cod) { return PROD[cod] || (cod in enEnvio ? [cod, enEnvio[cod] || cod, '', '', ''] : null); },
      elegir: function (p) { elegir(p[0]); },
      agregar: function (p) { elegir(p[0]); },
      noEsta: function (cod) { avisar('err', 'No encontré «' + cod + '» en el catálogo.'); } });
    n.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); caja.querySelector('#tgOk').click(); } };
    caja.querySelector('#tgOk').onclick = function () {
      var bt = this, v = n.value.trim();
      if (!errorEn(caja, 'tgError', !elegido ? 'Elegí el producto testigo.' : !/^\d{1,4}$/.test(v) ? 'Escribí cuántas contaste (de 0 a 9999).' : '')) return;
      bt.disabled = true;
      S.tgQuien = quien.value.trim();
      llamar('pos_remito_testigo', { p_remito: r.id, p_codigo: elegido, p_contado: Number(v), p_quien: S.tgQuien || null }).then(function (x) {
        bt.disabled = false;
        var ct = contarTestigos(x.testigos), e = estadoTestigos(ct);
        caja.querySelector('#tgRes').innerHTML = '<div class="pos-cartel ' + (x.coincide ? 'st-ok' : 'mal') + '">' +
          (x.coincide ? '<b>' + esc(x.codigo) + ': coincide.</b> ' : '<b>' + esc(x.codigo) + ': no coincide con el envío.</b> Contalo de nuevo; si sigue sin coincidir, hay que rehacer el módulo (anulá el envío y pasalo de nuevo). ') +
          (e === 'ok' ? 'El módulo quedó controlado.' : e === 'uno' ? 'Falta otro testigo.' : x.coincide ? 'Ojo: otro testigo no coincide.' : '') + '</div>';
        r.testigos = x.testigos;
        elegido = null;
        el.innerHTML = '';
        n.value = '';
        if (alCambiar) alCambiar();
        $('tgProd').focus();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'tgError', mensajeDe(e)); });
    };
    caja.querySelector('#tgVolver').onclick = function () { abrirPase(r.id, alCambiar); };
    setTimeout(function () { var p = $('tgProd'); if (p) p.focus(); }, 0);
  }

  /** Un remito entero, para verlo. En Gestión, con lo que mandaron aunque falte recibir, y para anularlo.
      op.salida: lo abrió el local que lo mandó (Envíos internos): lo ve entero, no a ciegas, y lo anula mientras nadie recibió nada. */
  function abrirRemito(id, alCambiar, op) {
    var gestion = MODO === 'gestion', salida = !gestion && !!(op && op.salida);
    var caja = ventana('<h3 id="posVentTit">Remito</h3><p class="cargando">Cargando…</p>', true), dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_remito', { p_id: id, p_completo: gestion || salida }).then(function (r) {
      if (!caja.isConnected) return;
      var an = r.estado === 'anulado', pend = r.estado === 'pendiente', aFabrica = !r.destino_local_id, sinResolver = 0;
      /* Una devolución a la fábrica (SQL 189): nadie la cuenta a ciegas; cada producto con su precio y su razón, y el total. */
      var con189 = 'total' in r, unidadesDev = 0, sinPrecio = 0, vePrecio = con189 && puede('precios');   // SQL 190: los precios, con «Ver precios»
      /* Un envío entre locales, visto por el que lo mandó: con el precio y el total, como la devolución. */
      var envio = salida && !aFabrica && !!r.origen_local_id, recibioAlgo = (r.productos || []).some(function (p) { return p.estado; });
      var prods = (r.productos || []).map(function (p) {
        var est = aFabrica ? (p.estado ? '<span class="pill pill-ok">Llegó</span>' : '') :
                  p.estado === 'coincide' ? '<span class="pill pill-ok">Coincidió</span>' : p.estado === 'diferencias' ? '<span class="pill pill-bad">Con diferencias</span>' :
                  '<span class="pill">Falta recibir</span>';
        var ves = p.celdas && p.celdas.length && 'cantidad' in p.celdas[0];
        var unid = ves ? p.celdas.reduce(function (s, x) { return s + Number(x.cantidad || 0); }, 0) : 0;
        if (aFabrica || envio) { unidadesDev += unid; if (con189 && p.precio == null) sinPrecio++; }
        var precio = (aFabrica || envio) && con189 && ves && vePrecio ? '<p class="pos-ayuda dv-prec">' + (p.precio == null ? num(unid) + (unid === 1 ? ' unidad' : ' unidades') + ' · <span class="apagado">sin precio en la lista</span>' :
            num(unid) + ' × ' + plata(cent(p.precio)) + ' = <b>' + plata(cent(p.precio) * unid) + '</b>') + (p.razon ? ' · Razón: <b>' + esc(p.razon) + '</b>' : '') + '</p>' :
          p.razon && (aFabrica || envio) ? '<p class="pos-ayuda dv-prec">Razón: <b>' + esc(p.razon) + '</b></p>' : '';
        /* SQL 167: cada diferencia, con cómo se resolvió (o que falta). */
        var difs = (p.diferencias || []).map(function (d) {
          var n = d.contado - d.cantidad, pendiente = d.estado === 'pendiente';
          if (pendiente && !an) sinResolver++;
          return '<li><span class="rm-dif-que"><b class="' + (n < 0 ? 'st-sale' : 'df-sobro') + '">' + (n < 0 ? 'Faltó ' + -n : 'Sobró ' + n) + '</b> · ' +
              esc([d.talle ? 'talle ' + d.talle : '', d.color ? nombreCol(d.color, p.codigo) : ''].filter(Boolean).join(', ') || 'sin talle ni color') + '</span>' +
            (an ? '' : pendiente ? '<span class="pill pill-warn">Sin resolver</span>' :
              '<span class="rm-dif-res"><span class="pill pill-ok">' + esc(RESOLUCION[d.resolucion] || d.resolucion) + '</span>' +
                (d.remito_nuevo_numero ? ' R-' + d.remito_nuevo_numero : '') + '<small>' + esc([d.resuelta_nombre, d.resuelta_en ? fechaHora(d.resuelta_en) : ''].filter(Boolean).join(' · ')) +
                (d.nota ? ' · «' + esc(d.nota) + '»' : '') + '</small></span>') + '</li>';
        }).join('');
        return '<div class="st-prod"><div class="st-prod-cab"><b>' + esc(p.codigo) + '</b><span>' + esc(nombreProd(p.codigo, p.descripcion)) + '</span>' + est +
            (p.conteos > 1 ? '<small title="Las veces que lo contaron">contado ' + p.conteos + ' veces</small>' : '') + '</div>' +
          (ves ? grillaRemito(p.codigo, p.celdas) : '<p class="pos-ayuda">Se ve cuando lo reciban.</p>') + precio +
          (p.estado && !aFabrica ? '<p class="pos-ayuda">' + (p.recibido_nombre ? 'Lo recibió ' + esc(p.recibido_nombre) + ', ' : 'Recibido ') + esc(fechaHora(p.recibido_en)) + '.' +
                      (p.motivo ? ' Qué pasó: ' + esc(p.motivo) + '.' : '') + (p.observaciones ? ' <b>' + esc(p.observaciones) + '</b>' : '') + '</p>' : '') +
          (difs ? '<ul class="rm-difs">' + difs + '</ul>' : '') + '</div>';
      }).join('');
      var queEs = aFabrica ? 'la devolución ' : envio ? 'el envío ' : 'el remito ';
      dentro.innerHTML = (aFabrica ? '<h3 id="posVentTit">Devolución a fábrica ' + esc(refRemito(r)) + ' ' + pillDev(r.estado) + '</h3>' :
                       envio ? '<h3 id="posVentTit">Envío interno ' + esc(refRemito(r)) + ' ' + pillRemito(r.estado) + '</h3>' :
                                     '<h3 id="posVentTit">Remito ' + esc(refRemito(r)) + ' ' + pillRemito(r.estado) + '</h3>') +
        (aFabrica ? '<div class="pos-ticket-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(r.fecha)) + '</div>' +
          '<div><span>Sucursal</span>' + esc(bonito(r.origen)) + '</div>' +
          '<div><span>Proveedor</span>Fábrica</div>' +
          '<div><span>Lo cargó</span>' + esc(r.creado_nombre || '—') + '</div>' +
          '<div><span>Llegó a la fábrica</span>' + esc(r.recibido_en ? fechaHora(r.recibido_en) : pend ? 'Todavía no' : '—') + '</div>' +
          (puede('precios') ? '<div><span>Total</span>' + (con189 ? '<b>' + plata(cent(r.total || 0)) + '</b>' : '—') + '</div>' : '') +
          (r.referencia ? '<div><span>Referencia</span>' + esc(r.referencia) + '</div>' : '') +
        '</div>' : '<div class="pos-ticket-datos">' +
          '<div><span>Fecha</span>' + esc(fechaHora(r.fecha)) + '</div>' +
          '<div><span>Referencia</span>' + esc(r.referencia || '—') + '</div>' +
          '<div><span>Sale de</span>' + esc(bonito(r.origen)) + '</div>' +
          '<div><span>Llega a</span>' + esc(bonito(r.destino)) + '</div>' +
          '<div><span>Lo cargó</span>' + esc(r.creado_nombre || '—') + '</div>' +
          '<div><span>Recibido</span>' + esc(r.recibido_en ? fechaHora(r.recibido_en) : pend ? 'Todavía no' : '—') + '</div>' +
          (envio && puede('precios') ? '<div><span>Total</span>' + (con189 ? '<b>' + plata(cent(r.total || 0)) + '</b>' : '—') + '</div>' : '') +
        '</div>') +
        (r.observaciones ? '<p class="cj-obs"><b>Observaciones:</b> ' + esc(r.observaciones) + '</p>' : '') +
        (gestion && pend && aFabrica ? '<div class="pos-cartel">Vuelve a la fábrica: del stock de ' + esc(bonito(r.origen)) + ' ya salió al mandarlo. Cuando llegue, tocá «Llegó a la fábrica».</div>' :
         gestion && pend ? '<div class="pos-cartel">Lo recibe el local en el mostrador (POS → Remitos), contando a ciegas: hasta que no lo reciban, no entra a su stock.' +
                           (r.origen_local_id ? ' Del stock de ' + esc(bonito(r.origen)) + ' ya salió al mandarlo.' : '') + '</div>' : '') +
        (gestion && sinResolver ? '<div class="pos-cartel st-dif">' + (sinResolver === 1 ? 'Hay una diferencia sin resolver.' : 'Hay ' + sinResolver + ' diferencias sin resolver.') +
                                  ' <button type="button" class="pos-link" id="rmDifs">' + (sinResolver === 1 ? 'Resolverla' : 'Resolverlas') + ' en Diferencias</button></div>' : '') +
        (!gestion && pend && aFabrica ? '<div class="pos-cartel">Ya salió del stock de ' + esc(bonito(r.origen)) + '. Cuando llegue a la fábrica, la oficina la da por recibida.</div>' :
         envio && pend ? '<div class="pos-cartel">Ya salió del stock de ' + esc(bonito(r.origen)) + '. ' + esc(bonito(r.destino)) +
                         ' lo recibe contándolo en POS → Remitos: hasta entonces no entra a su stock.</div>' :
         !gestion && pend ? '<div class="pos-cartel">Todavía falta recibirlo: lo que mandaron se ve recién al contar.</div>' : '') +
        '<p class="pos-lbl rm-leyenda">' + (aFabrica ? (pend || an ? 'Lo que se devolvió' : 'En cada casilla, lo que llegó a la fábrica; abajo, lo que se devolvió') :
                                           gestion && pend ? 'Lo que mandaron' : envio && pend && !recibioAlgo ? 'Lo que mandaste' :
                                           envio ? 'En cada casilla, lo que llegó; abajo, lo que dice el envío' : 'En cada casilla, lo que llegó; abajo, lo que dice el remito') + '</p>' +
        '<div class="st-prods">' + prods + '</div>' +
        ((aFabrica || envio) && con189 ? '<p class="rn-tot"><b>' + num(unidadesDev) + (unidadesDev === 1 ? ' unidad' : ' unidades') + (vePrecio ? ' · Total ' + plata(cent(r.total || 0)) : '') + '</b>' +
                              (sinPrecio && vePrecio ? ' (' + (sinPrecio === 1 ? 'uno no tiene precio: no suma' : sinPrecio + ' no tienen precio: no suman') + ')' : '') + '</p>' : '') +
        (an ? '<div class="pos-cartel mal" style="margin-top:12px">Anulad' + (aFabrica ? 'a' : 'o') + ' el ' + esc(fechaHora(r.anulado_en)) + (r.anulado_por_nombre ? ' por ' + esc(r.anulado_por_nombre) : '') + ': ' + esc(r.anulado_motivo || '') + '</div>' : '') +
        '<div id="rmAnular"></div><div class="pos-pie">' +
          /* En el local, la devolución y el envío se anulan mientras nadie recibió nada (si se armaron mal); lo demás, desde Gestión. */
          ((gestion || (puede('envios') && (aFabrica || envio) && pend && !recibioAlgo)) && !an ? '<button type="button" class="btn btn-sec btn-chico izq" id="rmAnularBtn">Anular ' + queEs.trim() + '</button>' : '') +
          (!gestion && pend && !enPrueba() && !aFabrica && !envio ? '<button type="button" class="btn btn-sec btn-chico izq" id="rmRecibir">Recibirlo</button>' : '') +
          (gestion && pend && aFabrica ? '<button type="button" class="btn btn-pri btn-chico" id="rmFabrica">Llegó a la fábrica</button>' : '') +
          '<button type="button" class="btn ' + (gestion && pend && aFabrica ? 'btn-sec' : 'btn-pri') + ' btn-chico" data-cerrar>Cerrar</button></div>';
      var rc = dentro.querySelector('#rmRecibir');
      if (rc) rc.onclick = function () { cerrarVentana(); abrirRecepcion(r.id); };
      var rd = dentro.querySelector('#rmDifs');
      if (rd) rd.onclick = function () { cerrarVentana(); ir('diferencias'); };
      var rf = dentro.querySelector('#rmFabrica');
      if (rf) rf.onclick = function () {
        if (!confirm('¿Llegó a la fábrica ' + queEs + refRemito(r) + '? Queda recibida (el stock de ' + bonito(r.origen) + ' ya la había descontado).')) return;
        rf.disabled = true;
        llamar('pos_remito_fabrica_recibir', { p_id: r.id }).then(function () {
          avisar('ok', 'La devolución ' + refRemito(r) + ' quedó recibida en la fábrica.');
          if (alCambiar) alCambiar();
          abrirRemito(r.id, alCambiar, op);
        }).catch(function (e) { rf.disabled = false; avisar('err', mensajeDe(e)); });
      };
      var ab = dentro.querySelector('#rmAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        /* Lo que se deshace: lo que entró al local que lo recibió, y lo que salió del que lo mandó. */
        var entro = (r.productos || []).some(function (p) { return p.estado; });
        var vuelve = [r.destino_local_id && entro ? 'lo que ya entró al stock de ' + esc(bonito(r.destino)) + ' vuelve a salir' : '',
                      r.origen_local_id ? 'a ' + esc(bonito(r.origen)) + ' le vuelve lo que ' + (aFabrica ? 'devolvió' : 'mandó') : ''].filter(Boolean).join(', y ');
        pedirMotivo(dentro.querySelector('#rmAnular'), (aFabrica ? 'La devolución queda en la lista, tachada, con quién la anuló y por qué. ' :
                                                                   envio ? 'El envío queda en la lista, tachado, con quién lo anuló y por qué. ' :
                                                                   'El remito queda en la lista, tachado, con quién lo anuló y por qué. ') +
          (vuelve ? vuelve.charAt(0).toUpperCase() + vuelve.slice(1) + '. ' : '') +
          (/^Lo que (faltó|sobró) en R-/.test(r.observaciones || '') ? 'Las diferencias que resolvía vuelven a quedar sin resolver. ' : '') + 'No se puede deshacer.',
          'Anular ' + queEs + refRemito(r), function (motivo) {
          return llamar('pos_remito_anular', { p_id: r.id, p_motivo: motivo }).then(function () {
            avisar('ok', (aFabrica ? 'La devolución ' + refRemito(r) + ' quedó anulada.' : (envio ? 'El envío ' : 'El remito ') + refRemito(r) + ' quedó anulado.'));
            S.stock = {};
            avisoAlDia();
            if (alCambiar) alCambiar();
            abrirRemito(r.id, alCambiar, op);
          });
        });
      };
    }).catch(function (e) {
      if (caja.isConnected) dentro.innerHTML = '<h3 id="posVentTit">Remito</h3><div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     DIFERENCIAS (Gestión, SQL 167): la planilla de errores de los remitos
     Mauricio (24/10): "nosotros tenemos una planilla de error donde
     anotamos… también estaría bueno que tenga estadísticas de errores,
     porque las estadísticas te sirven para mejorar… y ver qué solución nos
     dan". Nadie la carga: cada producto que un local recibe con diferencias
     deja acá un renglón por talle y color, con quién lo recibió y qué pasó.
     Por ahora la resuelve la oficina; cuando la fábrica tenga su usuario,
     ella. Arriba, lo que falta resolver; abajo, las estadísticas del período.
     ════════════════════════════════════════════════════════════════════ */
  function verDiferencias() {
    var c = $('cuerpo'), est = S.dfEstado == null ? 'pendiente' : S.dfEstado;
    c.innerHTML = cabeza('Diferencias', 'Lo que llegó distinto de lo que decía el remito. Se anota solo cuando un local recibe con diferencias; acá se resuelve.',
        '<button type="button" class="btn btn-sec btn-chico" id="dfBajar" disabled>Bajar para Excel</button>') +
      '<div class="pos-filtros"><div id="dfPer"></div>' +
        campo('', 'Sucursal', '<select id="dfLocal" class="desplegable">' + todasLasSucursales() + opcionesLocales(S.dfLocal || '') + '</select>') +
        campo('', 'Mostrar', '<select id="dfEstado">' + opciones([['pendiente', 'Sin resolver (de cualquier día)'], ['resuelta', 'Resueltas'], ['', 'Todas']], est) + '</select>') +
      '</div><div id="dfLista"><p class="cargando">Cargando…</p></div>';
    /* Ya las vio: el aviso de la barra no vuelve a salir por éstas (persona.js). */
    if (window.persona && persona.difVistas) persona.difVistas();
    var per = periodoPos($('dfPer'), { inicial: 'mes', guardar: 'pos_diferencias_periodo', hastaHoy: true, alCambiar: cargar });
    $('dfLocal').onchange = function () { S.dfLocal = this.value; cargar(); };
    $('dfEstado').onchange = function () { S.dfEstado = this.value; cargar(); };
    var pedido = 0, D = null, elegidas = {};
    $('dfBajar').onclick = function () { if (D) bajarDiferencias(D, per.rango(), $('dfEstado').value); };

    function cargar() {
      var r = per.rango(), n = ++pedido;
      elegidas = {};
      $('dfLista').innerHTML = '<p class="cargando">Cargando…</p>';
      llamar('pos_diferencias', { p_desde: r.desde, p_hasta: r.hasta, p_local: $('dfLocal').value || null, p_estado: $('dfEstado').value || null }).then(function (d) {
        if (n !== pedido || !$('dfLista')) return;
        D = d;
        $('dfBajar').disabled = !(d.filas || []).length;
        if (!$('dfLocal').value) ponerCuentaDif(Number(d.totales.pendientes) || 0);
        pintar();
      }).catch(function (e) { if ($('dfLista')) $('dfLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }

    function pintar() {
      var t = D.totales || {}, filas = D.filas || [], estado = $('dfEstado').value, z = $('dfLista');
      var pendientes = filas.filter(function (f) { return f.estado === 'pendiente'; });
      var pct = t.remitos ? Math.round(100 * t.con_diferencias / t.remitos) : 0;
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi' + (t.pendientes ? ' mal' : '') + '" title="De cualquier día"><span>Sin resolver</span><b>' + num(t.pendientes) + '</b></div>' +
        '<div class="pos-kpi"><span>Remitos recibidos</span><b>' + num(t.remitos) + '</b></div>' +
        '<div class="pos-kpi" title="Los remitos que llegaron con alguna diferencia"><span>Con diferencias</span><b>' + num(t.con_diferencias) +
          (t.remitos ? ' <small>(' + pct + ' %)</small>' : '') + '</b></div>' +
        '<div class="pos-kpi"><span>Faltaron</span><b class="' + (t.faltaron ? 'st-sale' : '') + '">' + num(t.faltaron) + ' u.</b></div>' +
        '<div class="pos-kpi"><span>Sobraron</span><b>' + num(t.sobraron) + ' u.</b></div>' +
        '<div class="pos-kpi" title="Desde que el local lo recibió hasta que se resolvió (las resueltas en el período)"><span>Se resuelven en</span><b>' + tiempoRes(t.horas_resolver) + '</b></div>' +
      '</div>';
      var tabla = !filas.length ? '<div class="pos-cartel">' + (estado === 'pendiente' ? '<b>No hay diferencias sin resolver.</b> Cuando un local reciba un remito con diferencias, aparecen acá solas.' :
                                                                'No hay diferencias en ese período con esos filtros.') + '</div>' :
        '<div class="df-barra" id="dfBarra" hidden></div>' +
        '<div class="pos-marco-tabla"><table class="pos-tabla df-tabla"><thead><tr>' +
          '<th class="df-chk">' + (pendientes.length ? '<input type="checkbox" id="dfTodas" aria-label="Elegir todas las sin resolver">' : '<span class="sr">Elegir</span>') + '</th>' +
          '<th>Recibido</th><th>Sucursal</th><th>Remito</th><th>Producto</th><th>Talle y color</th>' +
          '<th class="n">Decía</th><th class="n">Llegaron</th><th class="n">Diferencia</th><th>Lo recibió</th><th>Qué pasó</th><th>Estado</th></tr></thead><tbody>' +
          filas.map(fila).join('') + '</tbody></table></div>' +
        (D.mas ? '<p class="pos-mas">Se ven las últimas 1000. Achicá el período para ver el resto.</p>' : '');
      z.innerHTML = kpis + tabla + estadisticasDif(D, per.rango());
      var todas = $('dfTodas');
      if (todas) todas.onchange = function () {
        elegidas = {};
        if (todas.checked) pendientes.forEach(function (f) { elegidas[f.id] = 1; });
        z.querySelectorAll('[data-elegir]').forEach(function (cb) { cb.checked = todas.checked; cb.closest('tr').classList.toggle('sel', todas.checked); });
        barra();
      };
      z.querySelectorAll('[data-elegir]').forEach(function (cb) {
        cb.onchange = function () {
          var id = cb.getAttribute('data-elegir');
          if (cb.checked) elegidas[id] = 1; else delete elegidas[id];
          cb.closest('tr').classList.toggle('sel', cb.checked);
          if (todas) todas.checked = Object.keys(elegidas).length === pendientes.length;
          barra();
        };
      });
      z.querySelectorAll('[data-reabrir]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('¿Volver a dejarla sin resolver?')) return;
          b.disabled = true;
          llamar('pos_diferencia_reabrir', { p: { ids: [Number(b.getAttribute('data-reabrir'))] } }).then(function () {
            avisar('ok', 'Volvió a quedar sin resolver.');
            avisoAlDia();
            cargar();
          }).catch(function (e) { b.disabled = false; avisar('err', mensajeDe(e)); });
        };
      });
      /* Tocar el renglón abre su remito (la casilla y los botones hacen lo suyo). */
      z.querySelectorAll('tr[data-dif]').forEach(function (tr) {
        var f = filas.filter(function (x) { return String(x.id) === tr.getAttribute('data-dif'); })[0];
        tr.onclick = function (e) { if (!e.target.closest('input, button, a, label')) abrirRemito(f.remito_id, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter' && e.target === tr) { e.preventDefault(); abrirRemito(f.remito_id, cargar); } };
      });
    }
    function fila(f) {
      var n = f.contado - f.cantidad, pend = f.estado === 'pendiente';
      return '<tr data-dif="' + f.id + '" tabindex="0"' + (elegidas[f.id] ? ' class="sel"' : '') + '>' +
        '<td class="df-chk">' + (pend ? '<input type="checkbox" data-elegir="' + f.id + '" aria-label="Elegir ' + esc(f.codigo + ' ' + f.talle + ' ' + f.color) + '"' + (elegidas[f.id] ? ' checked' : '') + '>' : '') + '</td>' +
        '<td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(bonito(f.local)) + '</td>' +
        '<td class="df-rem"><b>R-' + f.numero + '</b>' + (f.referencia ? '<small>' + esc(f.referencia) + '</small>' : '') + '</td>' +
        '<td class="df-prod"><b>' + esc(f.codigo) + '</b><small>' + esc(nombreProd(f.codigo, f.descripcion)) + '</small></td>' +
        '<td>' + ([f.talle ? nombreTalle(f.talle) : '', f.color ? nombreCol(f.color, f.codigo) : ''].filter(Boolean).map(esc).join('<br>') || '—') + '</td>' +
        '<td class="n">' + num(f.cantidad) + '</td><td class="n">' + num(f.contado) + '</td>' +
        '<td class="n"><b class="' + (n < 0 ? 'st-sale' : 'df-sobro') + '">' + (n < 0 ? 'Faltó ' + -n : 'Sobró ' + n) + '</b></td>' +
        '<td>' + esc(f.recibio || '—') + '</td>' +
        '<td class="cb-que">' + esc(f.motivo || '') + (f.observaciones ? '<small>«' + esc(f.observaciones) + '»</small>' : '') + '</td>' +
        '<td class="df-est">' + (pend ? '<span class="pill pill-warn">Sin resolver</span>' :
          '<span class="pill pill-ok" title="' + esc(RESOLUCION[f.resolucion] || f.resolucion) + '">' + esc(RESOLUCION_CORTA[f.resolucion] || f.resolucion) + '</span>' +
          '<small>' + (f.remito_nuevo_numero ? 'R-' + f.remito_nuevo_numero + ' · ' : '') + esc([f.resuelta_nombre, f.resuelta_en ? fechaHora(f.resuelta_en) : ''].filter(Boolean).join(' · ')) + '</small>' +
          (f.nota ? '<small>«' + esc(f.nota) + '»</small>' : '') +
          /* Con un remito no: para volver atrás se anula ese remito (y vuelve sola a sin resolver). */
          (f.remito_nuevo_id ? '' : '<button type="button" class="pos-link" data-reabrir="' + f.id + '">Volver atrás</button>')) + '</td></tr>';
    }
    /** Lo elegido, arriba de la tabla: cuántas y el botón para resolverlas. */
    function barra() {
      var b = $('dfBarra'), fs = (D.filas || []).filter(function (f) { return elegidas[f.id]; });
      if (!b) return;
      b.hidden = !fs.length;
      if (!fs.length) { b.innerHTML = ''; return; }
      var falt = fs.reduce(function (s, f) { return s + Math.max(f.cantidad - f.contado, 0); }, 0);
      var sobr = fs.reduce(function (s, f) { return s + Math.max(f.contado - f.cantidad, 0); }, 0);
      b.innerHTML = '<b>' + fs.length + (fs.length === 1 ? ' elegida' : ' elegidas') + '</b><span>' + [falt ? 'faltaron ' + falt : '', sobr ? 'sobraron ' + sobr : ''].filter(Boolean).join(' · ') + '</span>' +
        '<button type="button" class="btn btn-sec btn-chico" id="dfNinguna">Desmarcar</button><button type="button" class="btn btn-pri btn-chico" id="dfResolver">Resolver…</button>';
      $('dfNinguna').onclick = function () {
        elegidas = {};
        $('dfLista').querySelectorAll('[data-elegir], #dfTodas').forEach(function (cb) { cb.checked = false; var tr = cb.closest('tr[data-dif]'); if (tr) tr.classList.remove('sel'); });
        barra();
      };
      $('dfResolver').onclick = function () { resolverDiferencias(fs, cargar); };
    }
    cargar();
  }

  /** Cuánto tardan en resolverse: en horas, o en días si pasan de dos. */
  function tiempoRes(h) {
    if (h == null) return '—';
    h = Number(h);
    if (h < 1) return 'menos de 1 h';
    if (h < 48) return Math.round(h) + ' h';
    return Math.round(h / 24) + ' días';
  }

  /** Las estadísticas del período: por sucursal, los productos con más diferencias y qué pasó. */
  function estadisticasDif(d, r) {
    var pl = d.por_local || [], pp = d.por_producto || [], pm = d.por_motivo || [];
    var maxM = pm.reduce(function (m, x) { return Math.max(m, x.productos); }, 0);
    return '<h3 class="st-tit">Las estadísticas · ' + esc(r.texto) + '</h3><div class="df-stats">' +
      '<section class="df-st"><h4>Por sucursal</h4>' + (!pl.length ? '<p class="pos-ayuda">En el período no se recibieron remitos.</p>' :
        '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Sucursal</th><th class="n">Recibidos</th><th class="n">Con diferencias</th>' +
          '<th class="n">Faltaron</th><th class="n">Sobraron</th>' +
          '<th class="n" title="Coincidieron recién al contarlos otra vez: no son errores de la fábrica, pero muestran dónde se cuenta apurado">Contados de nuevo</th></tr></thead><tbody>' +
        pl.map(function (l) {
          var p = l.remitos ? Math.round(100 * l.con_diferencias / l.remitos) : 0;
          return '<tr><td>' + esc(bonito(l.local)) + '</td><td class="n">' + num(l.remitos) + '</td>' +
            '<td class="n">' + num(l.con_diferencias) + (l.remitos ? ' <small class="df-pct">' + p + ' %</small>' : '') + '</td>' +
            '<td class="n' + (l.faltaron ? ' st-sale' : '') + '">' + num(l.faltaron) + '</td><td class="n">' + num(l.sobraron) + '</td><td class="n">' + num(l.recontados) + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</section>' +
      '<section class="df-st"><h4>Los productos con más diferencias</h4>' + (!pp.length ? '<p class="pos-ayuda">Ninguno en el período.</p>' :
        '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Producto</th><th class="n">Remitos</th><th class="n">Faltaron</th><th class="n">Sobraron</th></tr></thead><tbody>' +
        pp.map(function (x) {
          return '<tr><td><b>' + esc(x.codigo) + '</b><small>' + esc(nombreProd(x.codigo, x.descripcion)) + '</small></td><td class="n">' + num(x.veces) + '</td>' +
            '<td class="n' + (x.faltaron ? ' st-sale' : '') + '">' + num(x.faltaron) + '</td><td class="n">' + num(x.sobraron) + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</section>' +
      '<section class="df-st"><h4>Qué pasó</h4>' + (!pm.length ? '<p class="pos-ayuda">Nada en el período.</p>' :
        '<ul class="df-barras">' + pm.map(function (x) {
          return '<li><span>' + esc(x.motivo) + '</span><i style="--w:' + Math.max(4, Math.round(100 * x.productos / (maxM || 1))) + '%"></i><b>' + num(x.productos) + '</b></li>';
        }).join('') + '</ul><p class="pos-ayuda">En productos recibidos con diferencias. «Sin decir»: no eligieron qué pasó al recibirlo.</p>') + '</section>' +
    '</div>';
  }

  /** Resolver las diferencias elegidas: cómo, y una nota. Con «mandar» o «devolver» la base arma el remito. */
  function resolverDiferencias(fs, alListo) {
    var falt = fs.every(function (f) { return f.contado < f.cantidad; }), sobr = fs.every(function (f) { return f.contado > f.cantidad; });
    var unLocal = unicos(fs.map(function (f) { return f.local_id; })).length === 1, loc = bonito(fs[0].local);
    var uFalt = fs.reduce(function (s, f) { return s + Math.max(f.cantidad - f.contado, 0); }, 0);
    var uSobr = fs.reduce(function (s, f) { return s + Math.max(f.contado - f.cantidad, 0); }, 0);
    function u(n) { return n + (n === 1 ? ' unidad' : ' unidades'); }
    var OPS = [
      ['mandar', 'Mandar lo que faltó', falt && unLocal ? 'Arma un remito de la fábrica a ' + loc + ' con ' + u(uFalt) + '. El local lo recibe contándolo, como siempre.' :
                                        !falt ? 'Es sólo para lo que faltó.' : 'Elegí diferencias de un solo local.', falt && unLocal],
      ['devolver', 'Que lo devuelvan', sobr && unLocal ? 'Arma un remito de ' + loc + ' a la fábrica con ' + u(uSobr) + ': sale de su stock ahora y, cuando llegue, se da por recibido en Remitos.' :
                                       !sobr ? 'Es sólo para lo que sobró.' : 'Elegí diferencias de un solo local.', sobr && unLocal],
      ['remito_mal', 'El remito estaba mal', 'Llegó bien y el remito decía otra cosa: el stock ya quedó con lo que se contó y no se mueve nada.', true],
      ['otra', 'Otra solución', 'Escribila en la nota (por ejemplo: «lo llevó el supervisor»).', true]
    ];
    var primera = OPS.filter(function (o) { return o[3] && (o[0] === 'mandar' || o[0] === 'devolver'); })[0];
    var resumen = fs.length <= 4 ? fs.map(function (f) {
      var n = f.contado - f.cantidad;
      return '<li>R-' + f.numero + ' · ' + esc(bonito(f.local)) + ' · <b>' + esc(f.codigo) + '</b> ' + esc([f.talle, f.color ? nombreCol(f.color, f.codigo) : ''].filter(Boolean).join(' ')) +
        ': ' + (n < 0 ? 'faltó ' + -n : 'sobró ' + n) + '</li>';
    }).join('') : '<li>' + fs.length + ' diferencias' + (unLocal ? ' de ' + esc(loc) : '') + (uFalt ? ' · faltaron ' + uFalt : '') + (uSobr ? ' · sobraron ' + uSobr : '') + '</li>';
    var clave = nuevaClave();
    var caja = ventana('<h3 id="posVentTit">Resolver ' + (fs.length === 1 ? 'la diferencia' : 'las ' + fs.length + ' diferencias') + '</h3>' +
      '<ul class="df-resumen">' + resumen + '</ul>' +
      '<div class="df-ops" role="radiogroup" aria-label="Cómo se resuelve">' + OPS.map(function (o) {
        return '<label class="df-op' + (o[3] ? '' : ' apagada') + '"><input type="radio" name="dfOp" value="' + o[0] + '"' + (o[3] ? '' : ' disabled') +
          (primera && primera[0] === o[0] ? ' checked' : '') + '><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></label>';
      }).join('') + '</div>' +
      campo('ancho', 'Nota <span class="lbl-opc" id="dfNotaOpc">(opcional)</span>', '<textarea id="dfNota" maxlength="300" rows="2" placeholder="Lo que haga falta saber después"></textarea>') +
      '<div class="pos-error" id="dfError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="dfOk">Resolver</button></div>');
    caja.querySelectorAll('input[name="dfOp"]').forEach(function (x) {
      x.onchange = function () { caja.querySelector('#dfNotaOpc').textContent = x.value === 'otra' ? '(contá qué se hizo)' : '(opcional)'; };
    });
    caja.querySelector('#dfOk').onclick = function () {
      var bt = this, op = (caja.querySelector('input[name="dfOp"]:checked') || {}).value, nota = caja.querySelector('#dfNota').value.trim();
      if (!errorEn(caja, 'dfError', !op ? 'Elegí cómo se resuelve.' : op === 'otra' && !nota ? 'Escribí en la nota cómo se resolvió.' : '')) return;
      bt.disabled = true;
      llamar('pos_diferencia_resolver', { p: { resolucion: op, ids: fs.map(function (f) { return f.id; }), nota: nota, clave: clave } }).then(function (res) {
        cerrarVentana();
        avisar('ok', res.ya ? 'Ya estaban resueltas.' :
                     res.remito ? 'Listo: se armó el remito R-' + res.remito.numero + (op === 'mandar' ? ' de la fábrica a ' + loc + '.' : ' de ' + loc + ' a la fábrica.') :
                     res.resueltas === 1 ? 'Listo: quedó resuelta.' : 'Listo: quedaron resueltas.');
        if (op === 'devolver') S.stock = {};
        avisoAlDia();
        alListo();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'dfError', mensajeDe(e)); });
    };
  }

  /* Bajar la planilla para Excel: un .csv con punto y coma (el Excel en castellano lo abre en columnas) y con la
     marca de UTF-8 (si no, las tildes salen mal). */
  function fechaLarga(ts) {
    try {
      return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
        .format(new Date(ts)).replace(',', '');
    } catch (e) { return String(ts || '').slice(0, 16).replace('T', ' '); }
  }
  function celdaCsv(v) {
    var s = String(v == null ? '' : v);
    /* Un texto que empieza con = + - @ sería una fórmula para Excel: va como texto. */
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function bajarDiferencias(d, r, estado) {
    var cab = ['Recibido', 'Sucursal', 'Remito', 'Referencia', 'Código', 'Producto', 'Talle', 'Color', 'Decía el remito', 'Llegaron', 'Diferencia',
               'Lo recibió', 'Qué pasó', 'Observaciones', 'Estado', 'Resolución', 'Resuelta por', 'Resuelta el', 'Remito nuevo', 'Nota'];
    var filas = (d.filas || []).map(function (f) {
      return [fechaLarga(f.fecha), bonito(f.local), 'R-' + f.numero, f.referencia || '', f.codigo, nombreProd(f.codigo, f.descripcion), f.talle,
              f.color ? nombreCol(f.color, f.codigo) : '', f.cantidad, f.contado, f.contado - f.cantidad, f.recibio || '', f.motivo || '', f.observaciones || '',
              f.estado === 'pendiente' ? 'Sin resolver' : 'Resuelta', RESOLUCION[f.resolucion] || '', f.resuelta_nombre || '',
              f.resuelta_en ? fechaLarga(f.resuelta_en) : '', f.remito_nuevo_numero ? 'R-' + f.remito_nuevo_numero : '', f.nota || ''];
    });
    bajarCsv('diferencias-remitos-' + (estado === 'pendiente' ? 'sin-resolver-' + Interfaz.fecha.hoy() : r.desde + '-al-' + r.hasta) + '.csv', cab, filas);
  }
  /** Una tabla como CSV para Excel: con BOM (los acentos) y separada con «;» (el Excel en castellano). */
  function bajarCsv(nombre, cab, filas) {
    var csv = '\uFEFF' + [cab].concat(filas).map(function (x) { return x.map(celdaCsv).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ════════════════════════════════════════════════════════════════════
     RECIBIR UN REMITO (el mostrador): producto por producto, a ciegas
     A la izquierda, los productos del remito; a la derecha, el que se está
     contando: un renglón por color y una columna por talle. Lo que mandaron
     se ve recién al tocar «Comparar con el remito». Si coincide, entra al
     stock en el acto y pasa al siguiente; si no, se cuenta de nuevo o se
     recibe con lo contado. Lo que van escribiendo queda guardado en la
     compu (si se cierra la pestaña, sigue ahí).
     ════════════════════════════════════════════════════════════════════ */
  function verRemito() {
    var c = $('cuerpo'), id = S.recId;
    if (!id) { try { id = sessionStorage.getItem(K_REMITO_VER); } catch (e) {} }
    if (!id) { ir('remitos'); return; }
    var g = conteosGuardados()[id] || {};
    /* quien: quién del local lo cuenta (SQL 167; la compu es compartida, como "Lo atendió"); mot: qué pasó, por producto. */
    S.rec = { id: id, r: null, sel: null, conteo: g.conteo || {}, extras: g.extras || [], colores: g.colores || {}, comp: {}, ojo: {},
              quien: g.quien || '', mot: {} };
    c.innerHTML = cabeza('Remito', '', '<button type="button" class="btn btn-sec btn-chico" data-ir="remitos">‹ Remitos</button>') + '<p class="cargando">Cargando…</p>';
    engancharIr(c);
    cargarRecepcion();
  }
  /* Lo contado queda en la compu, uno por remito (los últimos cinco): si se cierra la pestaña, sigue ahí. */
  function conteosGuardados() { var x = leerJSON(K_CONTEO, {}); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  function guardarConteo(borrar) {
    var R = S.rec, todos = conteosGuardados();
    if (borrar) delete todos[R.id];
    else todos[R.id] = { conteo: R.conteo, extras: R.extras, colores: R.colores, quien: R.quien, t: Date.now() };
    Object.keys(todos).sort(function (a, b) { return (todos[b].t || 0) - (todos[a].t || 0); }).slice(5).forEach(function (k) { delete todos[k]; });
    guardarJSON(K_CONTEO, todos);
  }
  function cargarRecepcion() {
    var R = S.rec;
    return llamar('pos_remito', { p_id: R.id }).then(function (r) {
      if (S.vista !== 'remito' || S.rec !== R) return;
      R.r = r;
      if (r.estado !== 'pendiente') guardarConteo(true);
      R.extras = R.extras.filter(function (x) { return !r.productos.some(function (p) { return p.codigo === x.codigo; }); });
      var sel = productoRec(R.sel);
      if (!sel || sel.estado) R.sel = (productosRec().filter(function (p) { return !p.estado; })[0] || productosRec()[0] || {}).codigo || null;
      pintarRecepcion();
    }).catch(function (e) {
      if (S.vista === 'remito' && $('cuerpo')) {
        $('cuerpo').innerHTML = cabeza('Remito', '', '<button type="button" class="btn btn-sec btn-chico" data-ir="remitos">‹ Remitos</button>') +
          '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>';
        engancharIr($('cuerpo'));
      }
    });
  }
  function productosRec() { var R = S.rec; return R.r ? R.r.productos.concat(R.extras) : []; }
  function productoRec(cod) { return productosRec().filter(function (p) { return p.codigo === cod; })[0] || null; }
  function conteoDe(cod) { return S.rec.conteo[cod] || (S.rec.conteo[cod] = {}); }
  function contando(cod) { var m = S.rec.conteo[cod]; return !!m && Object.keys(m).some(function (k) { return m[k] > 0; }); }
  /** Los talles y los colores de la grilla: los del remito, los del catálogo (talles), los agregados y lo ya contado. */
  function ejesRec(p) {
    var cod = p.codigo, ts = [], cs = [];
    (p.celdas || []).forEach(function (x) { ts.push(x.talle); cs.push(x.color); });
    if (!ts.length || ts.some(Boolean)) ts = ts.concat(tallesDe(PROD[cod]));
    (S.rec.colores[cod] || []).forEach(function (x) { cs.push(x); });
    Object.keys(S.rec.conteo[cod] || {}).forEach(function (k) { var a = k.split('|'); ts.push(a[0]); cs.push(a[1]); });
    if (p.extra && !cs.length) cs = coloresDe(PROD[cod]).map(function (x) { return x.cod; });
    ts = unicos(ts); cs = unicos(cs);
    if (!ts.length) ts = [''];
    if (!cs.length) cs = [''];
    return { ts: ordenarTalles(ts, cod), cs: ordenarColores(cs, cod) };
  }
  function conteoLista(cod) {
    var m = S.rec.conteo[cod] || {};
    return Object.keys(m).filter(function (k) { return m[k] > 0; }).map(function (k) { var a = k.split('|'); return { talle: a[0], color: a[1], cantidad: m[k] }; });
  }
  /** El producto que buscan o escanean: el del remito (aunque no esté en el catálogo) o el del catálogo. */
  function prodRec(cod) {
    if (PROD[cod]) return PROD[cod];
    var p = productoRec(cod);
    if (!p) return null;
    var ts = unicos((p.celdas || []).map(function (x) { return x.talle; }).filter(Boolean)), cs = unicos((p.celdas || []).map(function (x) { return x.color; }).filter(Boolean));
    return [cod, p.descripcion || cod, '', ts.join(','), cs.join('|')];
  }
  function buscarRec(q) {
    var w = normal(q), pal = w.split(' ').filter(Boolean);
    if (w.length < 2) return [];
    var deRemito = productosRec().filter(function (p) {
      var cod = p.codigo.toLowerCase(), nom = normal(nombreProd(p.codigo, p.descripcion));
      return cod.indexOf(w) === 0 || pal.every(function (x) { return nom.indexOf(x) >= 0; });
    }).map(function (p) { return prodRec(p.codigo); });
    var ya = deRemito.map(function (p) { return p[0]; });
    return deRemito.concat(buscarProductos(q).filter(function (p) { return ya.indexOf(p[0]) < 0; })).slice(0, 8);
  }
  /** Elegir un producto para contarlo. Si no está en el remito, se pregunta: es lo que vino de más. */
  function elegirRec(p, sinPreguntar) {
    var R = S.rec, cod = p[0];
    if (!productoRec(cod)) {
      if (!sinPreguntar && !confirm('«' + p[1] + '» (' + cod + ') no está en este remito. ¿Llegó igual? Contalo y queda anotado como que vino de más.')) return false;
      R.extras.push({ codigo: cod, descripcion: p[1], estado: null, celdas: [], extra: true });
      guardarConteo();
    }
    R.sel = cod;
    pintarRecepcion();
    return true;
  }
  /** La pistola en la recepción: suma una prenda en su casilla (contar con la pistola es opcional). */
  function sumarRec(p, talle, color, n) {
    var R = S.rec, cod = p[0], x = productoRec(cod);
    if (x && x.estado) { avisar('info', cod + ' ya está recibido.'); return; }
    if (R.comp[cod]) { avisar('info', 'Para volver a contar ' + cod + ', tocá «Contar de nuevo».'); return; }
    if (!x && !elegirRec(p)) return;
    var m = conteoDe(cod), k = (talle || '') + '|' + (color || '');
    m[k] = Math.min(9999, (m[k] || 0) + (n || 1));
    guardarConteo();
    R.sel = cod;
    pintarRecepcion();
    var inp = document.querySelector('.rc-in[data-k="' + k.replace(/"/g, '\\"') + '"]');
    if (inp) { inp.classList.add('rc-sumo'); setTimeout(function () { inp.classList.remove('rc-sumo'); }, 600); }
    var campoP = $('rcProd');
    if (campoP) campoP.focus();
  }

  /* "Lo recibe" (SQL 167): la gente del local, como "Lo atendió" en la venta. Queda en cada diferencia: Mauricio,
     24/10: "el nombre del vendedor tiene que estar, quien recibió el producto y encontró ese error". */
  function opcionesQuien() {
    var R = S.rec, vs = vendedoresDe(R.r.destino_local_id);
    if (R.quien && vs.indexOf(R.quien) < 0) vs.push(R.quien);
    return '<option value="">Elegí quién lo recibe…</option>' + opciones(vs.map(function (n) { return [n, n]; }), R.quien) +
      '<option value="__otro">Otro (escribirlo)…</option>';
  }
  function pedirQuien() {
    var R = S.rec;
    var caja = ventana('<h3 id="posVentTit">¿Quién lo recibe?</h3><p class="pos-bajada">Si no está en la lista del local, escribí su nombre.</p>' +
      campo('', 'Nombre', '<input type="text" id="pqNombre" maxlength="60" autofocus>') + '<div class="pos-error" id="pqError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="pqOk">Listo</button></div>');
    /* Si cancela, el desplegable vuelve a quien estaba (no queda en "Otro…"). */
    _alCerrar = function () { var s = $('rcQuien'); if (s && S.rec === R) s.value = R.quien || ''; };
    function listo() {
      var n = caja.querySelector('#pqNombre').value.trim();
      if (!errorEn(caja, 'pqError', n.length < 2 ? 'Escribí el nombre.' : '')) return;
      R.quien = n;
      guardarConteo();
      cerrarVentana();
      if (S.rec === R && R.r) pintarRecepcion();
    }
    caja.querySelector('#pqOk').onclick = listo;
    caja.querySelector('#pqNombre').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); listo(); } };
  }
  /** Falta elegir quién lo recibe: lo dice y lleva al desplegable. */
  function faltaQuien() {
    if (S.rec.quien) return false;
    avisar('err', 'Elegí quién lo recibe (arriba de la lista, «Lo recibe»).');
    var q = $('rcQuien');
    if (q) q.focus();
    return true;
  }

  function pintarRecepcion() {
    var R = S.rec, r = R.r, c = $('cuerpo'), prueba = enPrueba(), lista = productosRec(), cerrado = r.estado !== 'pendiente';
    var hechos = lista.filter(function (p) { return p.estado; }).length;
    var sub = [r.referencia ? 'Ref. ' + r.referencia : '', 'De ' + bonito(r.origen) + ' a ' + bonito(r.destino), fechaHora(r.fecha), r.observaciones || ''].filter(Boolean).join(' · ');
    c.innerHTML = cabeza('Remito ' + esc(refRemito(r)) + ' ' + pillRemito(r.estado), esc(sub), '<button type="button" class="btn btn-sec btn-chico" data-ir="remitos">‹ Remitos</button>') +
      (prueba && !cerrado ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se reciben remitos: el stock es de verdad. Podés contar, pero para comparar y recibir, apagalo.</div>' : '') +
      (r.estado === 'anulado' ? '<div class="pos-cartel mal">Este remito está anulado' + (r.anulado_motivo ? ': ' + esc(r.anulado_motivo) : '') + '.</div>' : '') +
      (r.estado === 'recibido' ? '<div class="pos-cartel st-ok"><b>Remito recibido:</b> todo coincidió y ya está en el stock de ' + esc(bonito(r.destino)) + '.</div>' : '') +
      (r.estado === 'con_diferencias' ? '<div class="pos-cartel st-dif"><b>Recibido con diferencias:</b> entró lo que se contó, y las diferencias quedaron anotadas solas para la oficina.</div>' : '') +
      '<div class="rc">' +
        '<section class="rc-izq" aria-label="Los productos del remito">' +
          (!cerrado ? campo('rc-quien', 'Lo recibe', '<select id="rcQuien" class="desplegable">' + opcionesQuien() + '</select>') : '') +
          (!cerrado ? '<div class="tk-prod">' + campo('', 'Producto', '<input type="search" id="rcProd" autocomplete="off" spellcheck="false" placeholder="Escaneá o buscá el producto…" aria-controls="rcSug">') +
            '<div class="tk-sug" id="rcSug" role="listbox" aria-label="Productos" hidden></div></div>' : '') +
          '<p class="rc-avance"><b>' + hechos + ' de ' + lista.length + '</b> ' + (lista.length === 1 ? 'producto recibido' : 'productos recibidos') + '</p>' +
          '<div class="rc-lista">' + lista.map(function (p) {
            var e = p.estado === 'coincide' ? ['ok', 'Coincidió'] : p.estado === 'diferencias' ? ['dif', 'Con diferencias'] : R.comp[p.codigo] ? ['nc', 'No coincide'] :
                    contando(p.codigo) ? ['cont', 'Contando…'] : ['', cerrado ? 'Sin recibir' : 'Falta contar'];
            return '<button type="button" class="rc-prod' + (p.codigo === R.sel ? ' sel' : '') + '" data-prod="' + esc(p.codigo) + '"' + (p.codigo === R.sel ? ' aria-current="true"' : '') + '>' +
              '<span class="rc-punto ' + e[0] + '" aria-hidden="true"></span><span class="rc-prod-txt"><b>' + esc(p.codigo) + '</b> ' + esc(nombreProd(p.codigo, p.descripcion)) +
              '<small><span class="rc-est">' + e[1] + '</span>' + (p.extra || (p.celdas || []).every(function (x) { return x.cantidad === 0; }) && p.celdas && p.celdas.length ? ' · no estaba en el remito' : '') + '</small></span></button>';
          }).join('') + '</div>' +
        '</section>' +
        '<section class="rc-der" id="rcDer" aria-live="polite"></section>' +
      '</div>';
    engancharIr(c);
    var sq = $('rcQuien');
    if (sq) sq.onchange = function () {
      if (sq.value === '__otro') { pedirQuien(); return; }
      R.quien = sq.value;
      guardarConteo();
    };
    c.querySelectorAll('[data-prod]').forEach(function (b) { b.onclick = function () { R.sel = b.getAttribute('data-prod'); pintarRecepcion(); }; });
    if ($('rcProd')) engancharProducto({ campo: 'rcProd', sug: 'rcSug', lista: function () { return null; }, sinPrecio: true, sinLinea: true, prod: prodRec, buscar: buscarRec,
      elegir: function (p) { $('rcProd').limpiar(); elegirRec(p); },
      agregar: function (p, talle, color, n) { $('rcProd').limpiar(); sumarRec(p, talle, color, n); } });
    pintarProductoRec();
  }

  function pintarProductoRec() {
    var R = S.rec, der = $('rcDer'), p = productoRec(R.sel), cerrado = R.r.estado !== 'pendiente';
    if (!p) { der.innerHTML = '<div class="pos-cartel">Elegí un producto de la lista.</div>'; return; }
    var cod = p.codigo, comp = R.comp[cod];
    var cab = '<div class="rc-cab"><h3>' + esc(cod) + ' · ' + esc(nombreProd(cod, p.descripcion)) + '</h3>' + (PROD[cod] && PROD[cod][2] ? '<small>' + esc(PROD[cod][2]) + '</small>' : '') + '</div>';
    if (p.estado) {
      der.innerHTML = cab + '<div class="pos-cartel ' + (p.estado === 'coincide' ? 'st-ok' : 'st-dif') + '">' +
          (p.estado === 'coincide' ? '<b>Coincidió con el remito</b> y entró al stock.' : '<b>Recibido con diferencias:</b> entró lo que se contó.') +
          (p.recibido_nombre ? ' Lo recibió ' + esc(p.recibido_nombre) + ', ' + esc(fechaHora(p.recibido_en)) + '.' : '') +
          (p.motivo ? ' Qué pasó: ' + esc(p.motivo) + '.' : '') + (p.observaciones ? ' «' + esc(p.observaciones) + '»' : '') + '</div>' +
        '<p class="pos-lbl rm-leyenda">En cada casilla, lo que llegó; abajo, lo que dice el remito</p>' + grillaRemito(cod, p.celdas || []) + siguienteRec();
      engancharSiguiente();
      return;
    }
    if (cerrado) { der.innerHTML = cab + '<div class="pos-cartel">Este producto no se recibió.</div>'; return; }
    if (comp) {
      der.innerHTML = cab + '<div class="pos-cartel mal">No coincide con el remito. Contá de nuevo las casillas en rojo; si está bien contado, recibilo con lo que contaste.</div>' +
        '<p class="pos-lbl rm-leyenda">En cada casilla, lo que contaste; abajo, lo que dice el remito' + (comp.conteos > 1 ? ' · lo contaron ' + comp.conteos + ' veces' : '') + '</p>' +
        grillaRemito(cod, comp.celdas) +
        /* SQL 167: qué pasó, de una lista (para las estadísticas), y lo que quieran agregar. */
        '<div class="pos-f ancho rc-que"><span>Qué pasó <span class="lbl-opc">(si se sabe)</span></span><div class="chips" id="rcMot" role="group" aria-label="Qué pasó">' +
          MOTIVOS_REM.map(function (x) {
            var s = R.mot[cod] === x;
            return '<button type="button" class="chip' + (s ? ' sel' : '') + '" data-mot="' + esc(x) + '" aria-pressed="' + s + '">' + esc(x) + '</button>';
          }).join('') + '</div></div>' +
        campo('rc-obs', 'Observaciones <span class="lbl-opc">(opcional)</span>', '<input type="text" id="rcObs" maxlength="300" placeholder="Por ejemplo: vino una M en vez de una L">') +
        /* Lo destacado es volver a contar: recibir con diferencias es el último recurso. */
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" id="rcRecibir">Recibir con lo contado</button>' +
          '<button type="button" class="btn btn-pri btn-chico" id="rcOtraVez">Contar de nuevo</button></div>';
      der.querySelectorAll('[data-mot]').forEach(function (b) {
        b.onclick = function () {
          var x = b.getAttribute('data-mot');
          R.mot[cod] = R.mot[cod] === x ? '' : x;
          der.querySelectorAll('[data-mot]').forEach(function (o) {
            var s = o.getAttribute('data-mot') === R.mot[cod];
            o.classList.toggle('sel', s);
            o.setAttribute('aria-pressed', String(s));
          });
        };
      });
      $('rcOtraVez').onclick = function () {
        R.ojo[cod] = {};
        comp.celdas.forEach(function (x) { if (x.contado !== x.cantidad) R.ojo[cod][x.talle + '|' + x.color] = 1; });
        delete R.comp[cod];
        pintarRecepcion();
        var i = document.querySelector('.rc-in.rc-ojo') || document.querySelector('.rc-in');
        if (i) i.focus();
      };
      $('rcRecibir').onclick = function () { recibirRec(cod, this); };
      return;
    }
    var ej = ejesRec(p), m = conteoDe(cod), ojo = R.ojo[cod] || {};
    var faltan = coloresDe(PROD[cod]).filter(function (x) { return ej.cs.indexOf(x.cod) < 0; });
    der.innerHTML = cab + '<p class="pos-ayuda rc-ayuda">Contá cuántas llegaron de cada talle y color y escribilo (o dispará la pistola a cada prenda: suma de a una). ' +
        'Lo que dice el remito se ve después de comparar' + (Object.keys(ojo).length ? '; las marcadas son las que no coincidieron.' : '.') + '</p>' +
      grillaCarga(cod, ej.ts, ej.cs, function (t, c) { return m[t + '|' + c]; }, function (t, c) { return ojo[t + '|' + c]; }) +
      '<div class="pos-pie">' +
        (faltan.length ? '<select id="rcColor" class="rc-color" aria-label="Agregar otro color"><option value="">＋ Otro color…</option>' +
          opciones(faltan.map(function (x) { return [x.cod, x.nom]; }), '') + '</select>' : '') +
        '<button type="button" class="btn btn-sec btn-chico izq" id="rcBorrar">Borrar lo contado</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="rcComparar"' + (enPrueba() ? ' disabled title="Con el modo prueba no se reciben remitos"' : '') + '>Comparar con el remito</button></div>';
    engancharGrilla(der, function (k, n) {
      if (n > 0) m[k] = n; else delete m[k];
      guardarConteo();
      var b = document.querySelector('.rc-prod.sel .rc-est'), pt = document.querySelector('.rc-prod.sel .rc-punto');
      if (b) b.textContent = contando(cod) ? 'Contando…' : 'Falta contar';
      if (pt) pt.className = 'rc-punto' + (contando(cod) ? ' cont' : '');
    }, function () { var b = $('rcComparar'); if (b && !b.disabled) b.focus(); });
    var sc = $('rcColor');
    if (sc) sc.onchange = function () {
      if (!sc.value) return;
      (R.colores[cod] = R.colores[cod] || []).push(sc.value);
      guardarConteo();
      pintarRecepcion();
    };
    $('rcBorrar').onclick = function () {
      if (contando(cod) && !confirm('¿Borrar lo que contaste de ' + cod + '?')) return;
      R.conteo[cod] = {};
      guardarConteo();
      pintarRecepcion();
    };
    $('rcComparar').onclick = function () { compararRec(cod, this); };
  }
  function siguienteRec() {
    var sig = productosRec().filter(function (p) { return !p.estado; })[0];
    return sig && S.rec.r.estado === 'pendiente' ? '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="rcSig">Seguir con ' + esc(sig.codigo) + '</button></div>' : '';
  }
  function engancharSiguiente() {
    var b = $('rcSig');
    if (b) b.onclick = function () { S.rec.sel = productosRec().filter(function (p) { return !p.estado; })[0].codigo; pintarRecepcion(); };
  }

  function compararRec(cod, bt) {
    var R = S.rec, cont = conteoLista(cod), p = productoRec(cod);
    if (enPrueba()) { avisar('err', 'Con el modo prueba prendido no se reciben remitos (el stock es de verdad).'); return; }
    if (faltaQuien()) return;
    if (!cont.length && !confirm('No contaste nada de ' + cod + '. ¿No llegó ninguna?')) return;
    bt.disabled = true;
    bt.textContent = 'Comparando…';
    llamar('pos_remito_contar', { p_remito: R.id, p_codigo: cod, p_conteo: cont, p_recibio: R.quien }).then(function (res) {
      if (S.rec !== R) return;
      delete S.stock[R.r.destino_local_id];
      delete R.ojo[cod];
      if (res.coincide) {
        delete R.conteo[cod];
        guardarConteo();
        avisar('ok', cod + ': coincide con el remito. Entró al stock.' + (res.estado !== 'pendiente' ? ' Remito ' + refRemito(R.r) + ' recibido.' : ''));
        R.sel = null;
        cargarRecepcion();
      } else {
        R.comp[cod] = { celdas: res.celdas, conteo: cont, conteos: res.conteos, extra: !!(p && p.extra) };
        pintarRecepcion();
      }
    }).catch(function (e) {
      if (bt.isConnected) { bt.disabled = false; bt.textContent = 'Comparar con el remito'; }
      avisar('err', esDeRed(e) ? 'No se pudo comparar: sin conexión. Lo contado sigue ahí; probá de nuevo.' : mensajeDe(e));
    });
  }
  function recibirRec(cod, bt) {
    var R = S.rec, comp = R.comp[cod], p = productoRec(cod), obs = ($('rcObs') || {}).value || '';
    if (faltaQuien()) return;
    if (!confirm('¿Recibir ' + cod + ' con lo que contaste? Entra al stock lo contado, y la diferencia con el remito queda anotada para la oficina.')) return;
    bt.disabled = true;
    llamar('pos_remito_recibir', { p_remito: R.id, p_codigo: cod, p_conteo: comp.conteo, p_observaciones: obs.trim() || null,
                                   p_descripcion: p && p.extra ? nombreProd(cod, p.descripcion) : null, p_recibio: R.quien, p_motivo: R.mot[cod] || null }).then(function (res) {
      if (S.rec !== R) return;
      delete R.comp[cod];
      delete R.conteo[cod];
      delete R.mot[cod];
      delete S.stock[R.r.destino_local_id];
      guardarConteo();
      avisar('ok', cod + ': recibido con lo que contaste.' + (res.estado !== 'pendiente' ? ' Remito ' + refRemito(R.r) + ' recibido.' : ''));
      R.sel = null;
      cargarRecepcion();
    }).catch(function (e) { bt.disabled = false; avisar('err', mensajeDe(e)); });
  }

  /* ════════════════════════════════════════════════════════════════════
     NUEVO REMITO (Gestión): lo que manda la fábrica, o un envío entre locales
     ════════════════════════════════════════════════════════════════════ */
  var RN = null;   // el remito que se está cargando
  /* La devolución a fábrica del mostrador (SQL 189) es este mismo remito, siempre del local a la fábrica,
     con su borrador aparte y, en cada producto, el precio y la razón. */
  var RN_DEV = false;
  /* El envío interno del mostrador: el mismo remito, de un local a otro, con su borrador aparte y el precio de cada producto (sin razón). */
  var RN_ENV = false;
  function claveBorradorRn() { return RN_DEV ? K_DEVOL : RN_ENV ? K_ENVIO : K_REMITO; }
  var A_FABRICA = 'fabrica';   // "Llega a: Fábrica" (SQL 167): una devolución de un local a la fábrica
  function remitoNuevo(antes) {
    return { v: 1, clave: nuevaClave(), origen: antes ? antes.origen : '', destino: antes ? antes.destino : '', referencia: '', observaciones: '', lineas: [], razon: {},
             /* SQL 193: el envío entre depósitos sigue en los mismos depósitos y con el mismo responsable (el módulo, no). */
             tipo: antes && antes.tipo || '', dep_o: antes && antes.dep_o || '', dep_d: antes && antes.dep_d || '', modulo: '', responsable: antes && antes.responsable || '' };
  }
  function cargarRemitoNuevo() {
    var b = leerJSON(claveBorradorRn(), null);
    if (!(b && b.v === 1 && b.clave && Array.isArray(b.lineas))) b = remitoNuevo();
    if (b.origen && !localDe(b.origen)) b.origen = '';
    if ((RN_DEV || RN_ENV) && b.origen && !esMio(b.origen)) b.origen = '';
    if (b.destino && b.destino !== A_FABRICA && !localDe(b.destino)) b.destino = '';
    if (!b.razon || typeof b.razon !== 'object') b.razon = {};
    if (RN_DEV) { b.origen = b.origen || localStock().id; b.destino = A_FABRICA; }
    if (RN_ENV) {
      b.origen = b.origen || localStock().id;
      if (b.destino === A_FABRICA || b.destino === b.origen) b.destino = '';
      /* SQL 193: a otro local o entre depósitos del local (desde «Entre depósitos» de la lista arranca en ése, si está vacío). */
      b.tipo = (S.evTipo && !b.lineas.length ? S.evTipo : b.tipo) === 'entre' ? 'entre' : 'local';
      S.evTipo = null;
    }
    return b;
  }
  function guardarBorradorRn() { guardarJSON(claveBorradorRn(), RN); }
  function claveRn(l) { return [l.codigo, l.talle || '', l.color || ''].join('|'); }
  /** Suma renglones al remito (los iguales se juntan). */
  function sumarRn(items) {
    items.forEach(function (x) {
      var ya = RN.lineas.filter(function (l) { return claveRn(l) === claveRn(x); })[0];
      if (ya) ya.cantidad = Math.min(9999, ya.cantidad + x.cantidad);
      else RN.lineas.push({ codigo: x.codigo, descripcion: x.descripcion || '', talle: x.talle || '', color: x.color || '', cantidad: Math.min(9999, x.cantidad) });
    });
  }
  function productoRn(cod) {
    if (PROD[cod]) return PROD[cod];
    var ls = RN.lineas.filter(function (l) { return l.codigo === cod; });
    return [cod, (ls[0] && ls[0].descripcion) || cod, '', unicos(ls.map(function (l) { return l.talle; }).filter(Boolean)).join(','),
            unicos(ls.map(function (l) { return l.color; }).filter(Boolean)).join('|')];
  }

  function verRemitoNuevo() {
    RN_DEV = false; RN_ENV = false;
    RN = cargarRemitoNuevo();
    var c = $('cuerpo');
    c.innerHTML = cabeza('Nuevo remito', 'Lo que manda la fábrica (o un local) a un local, o lo que un local le devuelve a la fábrica. Al guardarlo, el local lo ve en POS → Remitos para contarlo y recibirlo.',
        '<button type="button" class="btn btn-sec btn-chico" data-ir="remitos">‹ Remitos</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="rnLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="rnGuardar">Guardar el remito</button>') +
      '<div class="tk-datos rn-datos">' +
        campo('', 'Sale de', '<select id="rnOrigen" class="desplegable"><option value="">Fábrica</option>' + opcionesLocales(RN.origen) + '</select>') +
        campo('', 'Llega a', '<select id="rnDestino" class="desplegable"><option value="">Elegí el local…</option>' + opcionesTodos(RN.destino) +
          '<option value="' + A_FABRICA + '"' + (RN.destino === A_FABRICA ? ' selected' : '') + '>Fábrica (una devolución)</option></select>') +
        campo('', 'Referencia <span class="lbl-opc">(el número de la fábrica)</span>', '<input type="text" id="rnRef" maxlength="40" placeholder="X-0001234" autocomplete="off">') +
        campo('', 'Observaciones', '<input type="text" id="rnObs" maxlength="300" placeholder="Lo que diga el remito de la fábrica" autocomplete="off">') +
      '</div>' + htmlProdRn();
    engancharIr(c);
    $('rnRef').value = RN.referencia || '';
    $('rnObs').value = RN.observaciones || '';
    $('rnOrigen').onchange = function () { RN.origen = this.value; guardarBorradorRn(); pintarRn(); };
    $('rnDestino').onchange = function () { RN.destino = this.value; guardarBorradorRn(); pintarRn(); };
    $('rnRef').oninput = function () { RN.referencia = this.value; guardarBorradorRn(); };
    $('rnObs').oninput = function () { RN.observaciones = this.value; guardarBorradorRn(); };
    engancharRn(verRemitoNuevo);
  }

  /* ════════════════════════════════════════════════════════════════════
     NUEVA DEVOLUCIÓN A FÁBRICA (el mostrador, SQL 189)
     La "Devolución de Mercadería" de BlueSoft, con sus campos arriba
     (Fecha, Letra X, Estado "Enviado", Proveedor, Sucursal) y los productos
     abajo, con su precio y su razón. Es el mismo remito de Gestión, siempre
     del local a la fábrica: sale del stock al guardarla (del depósito
     predeterminado, SQL 193).
     ════════════════════════════════════════════════════════════════════ */
  function verDevolucionNueva() {
    RN_DEV = true; RN_ENV = false;
    RN = cargarRemitoNuevo();
    var c = $('cuerpo'), prueba = enPrueba();
    c.innerHTML = cabeza('Nueva devolución a fábrica' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        'Lo que el local le devuelve a la fábrica. Al guardarla sale del stock; cuando llega, la oficina la da por recibida.',
        '<button type="button" class="btn btn-sec btn-chico" data-ir="devoluciones">‹ Devoluciones</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="rnLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="rnGuardar"' + (prueba ? ' disabled' : '') + '>Guardar la devolución</button>') +
      (prueba ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se guardan devoluciones: el stock es de verdad. Apagalo (abajo, en el menú) para guardarla.</div>' : '') +
      '<div class="tk-datos rn-datos dv-datos">' +
        campo('', 'Sucursal', '<select id="rnOrigen" class="desplegable">' + opcionesLocales(RN.origen) + '</select>') +
        campo('', 'Fecha', '<input type="text" value="' + esc(fechaCorta(S.ini.hoy)) + '" readonly tabindex="-1">') +
        campo('', 'Letra', '<input type="text" value="X" readonly tabindex="-1">') +
        campo('', 'Estado', '<input type="text" value="Enviado" readonly tabindex="-1">') +
        campo('', 'Proveedor', '<input type="text" value="Fábrica" readonly tabindex="-1">') +
        campo('', 'Observaciones', '<input type="text" id="rnObs" maxlength="300" placeholder="Ej.: fallas, la retira Daki" autocomplete="off">') +
      '</div>' + htmlProdRn();
    engancharIr(c);
    $('rnObs').value = RN.observaciones || '';
    $('rnOrigen').onchange = function () { RN.origen = this.value; S.stLocal = this.value; recordarLocal(this.value); guardarBorradorRn(); preciosRn(); };
    $('rnObs').oninput = function () { RN.observaciones = this.value; guardarBorradorRn(); };
    engancharRn(verDevolucionNueva);
    preciosRn();
  }
  /* ════════════════════════════════════════════════════════════════════
     NUEVO ENVÍO INTERNO (el mostrador, 28/10)
     El "Envío Interno de Mercadería" de BlueSoft. Allá el local pasa la
     mercadería de su depósito al "Depósito entre Locales" ("sale") y el
     otro la pasa a su depósito ("entra"). Acá es un remito de un local a
     otro (del depósito predeterminado de cada uno). Sale del stock al
     guardarlo y el otro local lo recibe contándolo a ciegas en POS → Remitos.
     SQL 193: «Entre depósitos del local», para el stock de todo el local: un
     envío por módulo, de un depósito de la sucursal a otro, en el momento;
     después se controla con productos testigo.
     ════════════════════════════════════════════════════════════════════ */
  function verEnvioNuevo() {
    RN_DEV = false; RN_ENV = true;
    RN = cargarRemitoNuevo();
    var c = $('cuerpo'), prueba = enPrueba(), entre = RN.tipo === 'entre', hecho = entre ? S.paseHecho : null;
    S.paseHecho = null;
    c.innerHTML = cabeza('Nuevo envío interno' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''),
        entre ? 'De un depósito a otro de la sucursal, para el stock de todo el local: un envío por módulo. Se pasa al guardarlo; después se controla con dos productos testigo.'
              : 'Lo que el local le manda a otro local. Al guardarlo sale del stock; el otro local lo recibe contándolo en POS → Remitos.',
        '<button type="button" class="btn btn-sec btn-chico" data-ir="envios">‹ Envíos</button>' +
        '<button type="button" class="btn btn-sec btn-chico" id="rnLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="rnGuardar"' + (prueba ? ' disabled' : '') + '>Guardar el envío</button>') +
      /* SQL 193: el «Envío Interno» de BlueSoft también pasa de un depósito a otro del local. */
      '<nav class="pestanas ev-tipos" aria-label="Qué envío">' +
        '<button type="button" class="pestana" data-tipo="local"' + (entre ? '' : ' aria-current="page"') + '>A otro local</button>' +
        '<button type="button" class="pestana" data-tipo="entre"' + (entre ? ' aria-current="page"' : '') + '>Entre depósitos del local</button></nav>' +
      (prueba ? '<div class="pos-cartel prueba">Con el <b>modo prueba</b> prendido no se guardan envíos: el stock es de verdad. Apagalo (abajo, en el menú) para guardarlo.</div>' : '') +
      (hecho ? '<div class="pos-cartel st-ok">Envío <b>R-' + esc(hecho.numero) + '</b> guardado: el módulo ' + esc(hecho.modulo) + ' (' + num(hecho.unidades) + (hecho.unidades === 1 ? ' unidad' : ' unidades') +
               ') ya está en «' + esc(hecho.destino) + '». Seguí con el próximo módulo. <button type="button" class="pos-link" id="rnVerPases">Ver los envíos entre depósitos</button></div>' : '') +
      (entre ? '<div class="tk-datos rn-datos ed-datos">' +
          campo('', 'Sucursal', '<select id="rnOrigen" class="desplegable">' + opcionesLocales(RN.origen) + '</select>') +
          campo('', 'Depósito origen', '<select id="rnDepO"><option value="">Cargando…</option></select>') +
          campo('', 'Depósito destino', '<select id="rnDepD"><option value="">Cargando…</option></select>') +
          campo('', 'Módulo', '<input type="text" id="rnModulo" maxlength="20" placeholder="Ej.: 12" autocomplete="off">') +
          campo('', 'Responsable <span class="lbl-opc">(opcional)</span>', '<input type="text" id="rnResp" maxlength="60" list="rnVend" autocomplete="off" placeholder="Quién lo pasa"><datalist id="rnVend"></datalist>') +
          campo('', 'Observaciones', '<input type="text" id="rnObs" maxlength="300" placeholder="Ej.: la pared del fondo" autocomplete="off">') +
        '</div><div id="rnDepAviso"></div>'
      : '<div class="tk-datos rn-datos ev-datos">' +
          campo('', 'Sale de', '<select id="rnOrigen" class="desplegable">' + opcionesLocales(RN.origen) + '</select>') +
          campo('', 'Llega a', '<select id="rnDestino" class="desplegable"><option value="">Elegí el local…</option>' + opcionesTodos(RN.destino) + '</select>') +
          campo('', 'Fecha', '<input type="text" value="' + esc(fechaCorta(S.ini.hoy)) + '" readonly tabindex="-1">') +
          campo('', 'Letra', '<input type="text" value="X" readonly tabindex="-1">') +
          campo('', 'Estado', '<input type="text" value="Enviado" readonly tabindex="-1">') +
          campo('', 'Observaciones', '<input type="text" id="rnObs" maxlength="300" placeholder="Ej.: se lo pidió una clienta" autocomplete="off">') +
        '</div>') + htmlProdRn();
    engancharIr(c);
    c.querySelectorAll('.ev-tipos .pestana').forEach(function (b) {
      b.onclick = function () { var t = b.getAttribute('data-tipo'); if (t === RN.tipo) return; RN.tipo = t; guardarBorradorRn(); verEnvioNuevo(); };
    });
    var vp = $('rnVerPases');
    if (vp) vp.onclick = function () { S.evVer = 'depositos'; S.evMarcar = hecho.id; ir('envios'); };
    $('rnObs').value = RN.observaciones || '';
    $('rnOrigen').onchange = function () {
      RN.origen = this.value; S.stLocal = this.value; recordarLocal(this.value);
      if (entre) { RN.dep_o = ''; RN.dep_d = ''; depositosRn(); }
      guardarBorradorRn(); preciosRn();
    };
    $('rnObs').oninput = function () { RN.observaciones = this.value; guardarBorradorRn(); };
    if (entre) {
      $('rnModulo').value = RN.modulo || '';
      $('rnResp').value = RN.responsable || '';
      $('rnModulo').oninput = function () { RN.modulo = this.value; guardarBorradorRn(); };
      $('rnResp').oninput = function () { RN.responsable = this.value; guardarBorradorRn(); };
      $('rnDepO').onchange = function () { RN.dep_o = this.value; guardarBorradorRn(); pintarRn(); };
      $('rnDepD').onchange = function () { RN.dep_d = this.value; guardarBorradorRn(); pintarRn(); };
      depositosRn();
    } else $('rnDestino').onchange = function () { RN.destino = this.value; guardarBorradorRn(); pintarRn(); };
    engancharRn(verEnvioNuevo);
    preciosRn();
  }
  /** SQL 193: los depósitos de la sucursal del envío entre depósitos. Sin elegir, sale del predeterminado y va al más nuevo de los otros. */
  function depositosRn() {
    var loc = RN.origen;
    traerDepositos(loc, true).then(function (ds) {
      var o = $('rnDepO'), d = $('rnDepD'), av = $('rnDepAviso'), dl = $('rnVend');
      if (!o || !RN || RN.origen !== loc || RN.tipo !== 'entre') return;
      var act = ds.filter(function (x) { return x.activo; });
      if (!depDe(act, RN.dep_o)) RN.dep_o = (depPredeterminado(act) || act[0] || {}).id || '';
      if (!depDe(act, RN.dep_d) || RN.dep_d === RN.dep_o) {
        RN.dep_d = (act.filter(function (x) { return x.id !== RN.dep_o && !x.predeterminado; }).sort(function (a, b) { return b.numero - a.numero; })[0] || {}).id || '';
      }
      var ops = act.map(function (x) { return [x.id, nombreDep(x)]; });
      o.innerHTML = '<option value="">Elegí…</option>' + opciones(ops, RN.dep_o);
      d.innerHTML = '<option value="">Elegí…</option>' + opciones(ops, RN.dep_d);
      if (dl) dl.innerHTML = vendedoresDe(loc).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
      av.innerHTML = S.sin193 ? '<div class="pos-cartel mal">Todavía falta correr el SQL 193 (los depósitos) en Supabase.</div>' :
        !ds.length ? '<div class="pos-cartel mal">No se pudieron traer los depósitos de ' + esc(nombreLocal(localDe(loc))) + '. Probá de nuevo.</div>' :
        act.length < 2 ? '<div class="pos-cartel">' + esc(nombreLocal(localDe(loc))) + ' tiene un solo depósito. Para el stock de todo el local, primero creá el de la temporada nueva en ' +
                         '<button type="button" class="pos-link" data-ir="depositos">Mercadería → Depósitos</button>.</div>' : '';
      engancharIr(av);
      guardarBorradorRn();
      pintarRn();
    });
  }
  function textoDepsRn() {
    var ds = S.dep[RN.origen] || [], o = depDe(ds, RN.dep_o), d = depDe(ds, RN.dep_d);
    return o && d ? ' · pasan de «' + esc(o.nombre) + '» a «' + esc(d.nombre) + '» al guardar' : '';
  }
  /** Los precios de la lista de la sucursal (la devolución y el envío los muestran; la base guarda los suyos al guardarlos). */
  function preciosRn() {
    asegurarPrecios(listaDe(localDe(RN.origen))).then(function () { pintarRn(); }, function () { pintarRn(); });
  }

  /* El campo del producto y la lista: los mismos en el remito de Gestión y en la devolución. */
  function htmlProdRn() {
    return '<div class="tk-prod rn-prod">' + campo('', 'Producto', '<input type="search" id="rnProd" autocomplete="off" spellcheck="false" placeholder="Escaneá la etiqueta, o buscá por código o nombre…" aria-controls="rnSug">') +
        '<button type="button" class="btn btn-sec btn-chico" id="rnPegar" title="Desde un Excel: Código, Talle, Color y Cantidad">Pegar o subir un Excel…</button>' +
        '<div class="tk-sug" id="rnSug" role="listbox" aria-label="Productos" hidden></div></div>' +
      '<div id="rnLista"></div>';
  }
  /** Limpiar, Guardar, el Excel y la pistola. volver: la pantalla, para dibujarla de nuevo al limpiar. */
  function engancharRn(volver) {
    var que = RN_DEV ? 'la devolución' : RN_ENV ? 'el envío' : 'el remito';
    $('rnLimpiar').onclick = function () {
      if (RN.lineas.length && !confirm('¿Borrar ' + que + ' que estás cargando?')) return;
      RN = remitoNuevo(RN);
      guardarBorradorRn();
      volver();
    };
    $('rnGuardar').onclick = guardarRemito;
    $('rnPegar').onclick = function () { abrirImportar(function (items) { sumarRn(items); guardarBorradorRn(); pintarRn(); }); };
    /* Un producto nuevo de la fábrica puede no estar todavía en el catálogo: el disparo a su etiqueta entra igual. */
    engancharProducto({ campo: 'rnProd', sug: 'rnSug', lista: function () { return null; }, sinPrecio: true, sinLinea: true, escaneoLibre: true,
      prod: function (cod) { return PROD[cod] || (RN.lineas.some(function (l) { return l.codigo === cod; }) ? productoRn(cod) : null); },
      elegir: function (p) { $('rnProd').limpiar(); editarProductoRn(p); },
      agregar: function (p, talle, color, n) {
        $('rnProd').limpiar();
        sumarRn([{ codigo: p[0], descripcion: p[1], talle: talle, color: color, cantidad: n || 1 }]);
        guardarBorradorRn();
        pintarRn(p[0]);
        $('rnProd').focus();
      },
      noEsta: function (cod) {
        /* Un código (letras y números, sin espacios): si es un nombre que no aparece, no es un producto nuevo. */
        if (cod.length > 30 || !/^[A-Z0-9][A-Z0-9._\/-]*$/.test(cod) || !/\d/.test(cod)) { avisar('err', 'No encontré «' + cod + '» en el catálogo.'); return; }
        if (!confirm(cod + ' no está en el catálogo. ¿Agregarlo igual ' + (RN_DEV ? 'a la devolución' : RN_ENV ? 'al envío' : 'al remito') + '?')) return;
        $('rnProd').limpiar();
        editarProductoRn([cod, cod, '', '', '']);
      } });
    pintarRn();
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var p = $('rnProd'); if (p) p.focus(); }, 0);
  }

  /** Las cantidades de un producto en el remito, todas juntas en su grilla. */
  function editarProductoRn(p) {
    var cod = p[0], ya = {}, ts = tallesDe(p), cs = coloresDe(p).map(function (x) { return x.cod; });
    RN.lineas.forEach(function (l) { if (l.codigo === cod) { ya[l.talle + '|' + l.color] = l.cantidad; ts.push(l.talle); cs.push(l.color); } });
    ts = unicos(ts); cs = unicos(cs);
    if (!ts.length) ts = [''];
    if (!cs.length) cs = [''];
    ts = ordenarTalles(ts, cod); cs = ordenarColores(cs, cod);
    var caja = ventana('<h3 id="posVentTit">' + esc(p[1]) + '</h3><p class="pos-bajada">' + esc(cod) + (p[2] ? ' · ' + esc(p[2]) : '') + ' · cuántas van de cada talle y color.</p>' +
      grillaCarga(cod, ts, cs, function (t, c) { return ya[t + '|' + c]; }) + '<div class="pos-error" id="gcError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="gcOk">Listo</button></div>', ts.length > 5);
    var g = engancharGrilla(caja, null, function () { caja.querySelector('#gcOk').focus(); });
    caja.querySelector('#gcOk').onclick = function () {
      var m = g.valores();
      RN.lineas = RN.lineas.filter(function (l) { return l.codigo !== cod; });
      sumarRn(Object.keys(m).map(function (k) { var a = k.split('|'); return { codigo: cod, descripcion: PROD[cod] ? '' : p[1], talle: a[0], color: a[1], cantidad: m[k] }; }));
      guardarBorradorRn();
      cerrarVentana();
      pintarRn(cod);
    };
    setTimeout(function () { var i = caja.querySelector('.rc-in'); if (i) i.focus(); }, 0);
  }

  function pintarRn(marcar) {
    var z = $('rnLista');
    if (!z) return;
    /* La devolución (SQL 189): cada producto con el precio de la lista de la sucursal, el total y la razón, como en BlueSoft. */
    /* SQL 190: los precios, con «Ver precios en remitos y envíos»; la razón de la devolución, siempre. */
    var dev = (RN_DEV || (RN_ENV && RN.tipo !== 'entre')) && puede('precios'), lista = dev ? listaDe(localDe(RN.origen)) : null, plataTot = 0, sinPrecio = 0;   // el envío, con precio y sin razón
    var prods = [], porCod = {}, total = 0;
    RN.lineas.forEach(function (l) {
      var p = porCod[l.codigo];
      if (!p) { p = porCod[l.codigo] = { cod: l.codigo, desc: l.descripcion, lineas: [], total: 0 }; prods.push(p); }
      p.lineas.push(l); p.total += l.cantidad; total += l.cantidad;
    });
    if (!prods.length) {
      z.innerHTML = '<div class="pos-cartel"><b>Todavía no hay productos.</b> Buscá cada producto y escribí cuántas van de cada talle y color, dispará la pistola a las etiquetas (suma de a una), ' +
        'o pegá las columnas de un Excel (Código, Talle, Color y Cantidad).</div>';
      return;
    }
    z.innerHTML = '<div class="pos-marco-tabla"><table class="pos-tabla rn-tabla"><thead><tr><th>Código</th><th>Producto</th><th>Talles y colores</th><th class="n">Unidades</th>' +
        (dev ? '<th class="n">Precio unitario</th><th class="n">Precio total</th>' : '') + (RN_DEV ? '<th>Razón</th>' : '') + '<th></th></tr></thead><tbody>' +
      prods.map(function (p) {
        var pr = dev ? precioDe(p.cod, lista) : null;
        if (dev && pr == null) sinPrecio++;
        else if (dev) plataTot += pr * p.total;
        var porColor = {};
        p.lineas.forEach(function (l) { (porColor[l.color] = porColor[l.color] || []).push(l); });
        var det = ordenarColores(Object.keys(porColor), p.cod).map(function (c) {
          var ls = porColor[c], ts = ordenarTalles(ls.map(function (l) { return l.talle; }), p.cod);
          return '<span>' + (c || ts.some(Boolean) ? '<b>' + esc(nombreCol(c, p.cod)) + ':</b> ' : '') + ts.map(function (t) {
            var l = ls.filter(function (x) { return x.talle === t; })[0];
            return (t ? esc(t) + ' ' : '') + l.cantidad;
          }).join(' · ') + '</span>';
        }).join('');
        return '<tr data-cod="' + esc(p.cod) + '"' + (p.cod === marcar ? ' class="rn-marca"' : '') + '><td><b>' + esc(p.cod) + '</b></td><td>' + esc(nombreProd(p.cod, p.desc)) +
          (PROD[p.cod] ? '' : ' <span class="pill pill-warn" title="No está en el catálogo">Fuera del catálogo</span>') + '</td>' +
          '<td class="rn-det">' + det + '</td><td class="n"><b>' + num(p.total) + '</b></td>' +
          (dev ? '<td class="n">' + (pr == null ? '<span class="apagado" title="No tiene precio en la lista de la sucursal">—</span>' : plata(pr)) + '</td>' +
                 '<td class="n">' + (pr == null ? '<span class="apagado">—</span>' : '<b>' + plata(pr * p.total) + '</b>') + '</td>' : '') + (!RN_DEV ? '' :
                 '<td><input type="text" class="dv-razon" data-razon="' + esc(p.cod) + '" maxlength="60" placeholder="Ej.: fallada" autocomplete="off" value="' + esc(RN.razon[p.cod] || '') + '"' +
                   ' aria-label="' + esc('Razón de ' + p.cod) + '"></td>') +
          '<td class="pos-acc"><button type="button" class="pos-link" data-editar>Cambiar</button><button type="button" class="pos-link" data-quitar>Quitar</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="rn-tot"><b>' + prods.length + (prods.length === 1 ? ' producto' : ' productos') + ' · ' + num(total) + (total === 1 ? ' unidad' : ' unidades') +
        (dev ? ' · Total ' + plata(plataTot) : '') + '</b>' +
        (dev && sinPrecio ? ' (' + (sinPrecio === 1 ? 'uno no tiene precio: no suma' : sinPrecio + ' no tienen precio: no suman') + ')' : '') +
        (RN_ENV && RN.tipo === 'entre' ? textoDepsRn() :
         (RN.origen ? ' · salen del stock de ' + esc(nombreLocal(localDe(RN.origen))) + ' al guardar' : '') +
         (RN.destino === A_FABRICA ? ' y vuelven a la fábrica' : RN_ENV && localDe(RN.destino) ? ' y van a ' + esc(nombreLocal(localDe(RN.destino))) : '')) + '</p>';
    z.querySelectorAll('.dv-razon').forEach(function (i) {
      i.oninput = function () { RN.razon[i.getAttribute('data-razon')] = i.value; guardarBorradorRn(); };
    });
    z.querySelector('tbody').onclick = function (e) {
      var b = e.target.closest('button'), tr = b && b.closest('tr[data-cod]');
      if (!tr) return;
      var cod = tr.getAttribute('data-cod');
      if (b.hasAttribute('data-editar')) editarProductoRn(productoRn(cod));
      else if (b.hasAttribute('data-quitar')) {
        RN.lineas = RN.lineas.filter(function (l) { return l.codigo !== cod; });
        delete RN.razon[cod];
        guardarBorradorRn();
        pintarRn();
      }
    };
    var m = z.querySelector('.rn-marca');
    if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
  }

  /** SQL 193: el envío entre depósitos de la sucursal (un módulo): pasa en el momento, del depósito origen al destino. Después, el mismo envío nuevo para el próximo módulo. */
  function guardarPase() {
    var ds = S.dep[RN.origen] || [], o = depDe(ds, RN.dep_o), d = depDe(ds, RN.dep_d), lo = localMio(RN.origen);
    var unidades = RN.lineas.reduce(function (s, l) { return s + l.cantidad; }, 0), mod = String(RN.modulo || '').trim();
    var mal = enPrueba() ? 'Con el modo prueba prendido no se guardan envíos: el stock es de verdad.' : !lo ? 'Elegí la sucursal.' :
              S.sin193 ? 'Todavía falta correr el SQL 193 (los depósitos) en Supabase.' :
              !o ? 'Elegí de qué depósito sale.' : !d ? 'Elegí a qué depósito va.' : o.id === d.id ? 'Sale y llega al mismo depósito: elegí otro.' :
              !mod ? 'Escribí el módulo (el número o la pared).' : !RN.lineas.length ? 'El envío no tiene productos.' : '';
    if (mal) { avisar('err', mal); return; }
    /* Si el depósito de donde sale no tiene todo según el sistema, que lo sepa (no frena). */
    llamar('pos_stock_local', { p_local: lo.id, p_deposito: o.id }).then(function (x) {
      var m = {};
      (x.filas || []).forEach(function (f) { m[claveVar(f[0], f[1], f[2])] = f[3]; });
      var faltan = RN.lineas.filter(function (l) { return (m[claveVar(l.codigo, l.talle, l.color)] || 0) < l.cantidad; });
      return faltan.length ? '\n\nOjo: según el sistema, «' + o.nombre + '» no tiene todo (' + faltan.slice(0, 4).map(function (l) {
        return l.codigo + ' ' + [l.talle, l.color].filter(Boolean).join(' ') + ': hay ' + (m[claveVar(l.codigo, l.talle, l.color)] || 0) + ', pasás ' + l.cantidad; }).join('; ') +
        (faltan.length > 4 ? '…' : '') + '). Si lo pasás igual, ahí queda en negativo.' : '';
    }, function () { return ''; }).then(function (extra) {
      if (!confirm('¿Pasar el módulo ' + mod + ' de «' + o.nombre + '» a «' + d.nombre + '» (' + nombreLocal(lo) + ') con ' + num(unidades) + (unidades === 1 ? ' unidad' : ' unidades') + '?' +
                   ' Se pasan ahora; después controlalo con dos productos testigo.' + extra)) return;
      S.guardando = true;
      var b = $('rnGuardar');
      if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
      llamar('pos_remito_guardar', { p: { clave: RN.clave, origen_local_id: lo.id, destino_local_id: lo.id, origen_deposito_id: o.id, destino_deposito_id: d.id,
                                          modulo: mod, responsable: String(RN.responsable || '').trim(), referencia: '', observaciones: RN.observaciones || '', items: RN.lineas } }).then(function (r) {
        S.guardando = false;
        delete S.stock[lo.id];
        delete S.dep[lo.id];
        avisar('ok', 'Envío R-' + r.numero + ' guardado' + (r.ya ? ' (ya estaba: no se duplicó)' : '') + ': el módulo ' + mod + ' pasó de «' + o.nombre + '» a «' + d.nombre + '».');
        S.paseHecho = { id: r.id, numero: r.numero, modulo: mod, unidades: unidades, destino: d.nombre };
        RN = remitoNuevo(RN);
        guardarBorradorRn();
        if (S.vista === 'envio_nuevo') verEnvioNuevo();
      }).catch(function (e) {
        S.guardando = false;
        if (b && b.isConnected) { b.disabled = false; b.textContent = 'Guardar el envío'; }
        avisar('err', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
      });
    });
  }

  function guardarRemito() {
    if (S.guardando || !RN) return;
    if (RN_ENV && RN.tipo === 'entre') { guardarPase(); return; }
    var fab = RN.destino === A_FABRICA, dev = RN_DEV, env = RN_ENV, txt = dev ? 'Guardar la devolución' : env ? 'Guardar el envío' : 'Guardar el remito';
    /* La devolución sale del stock de verdad: con el modo prueba no se guarda (como los remitos, que no se reciben). */
    var mal = env && enPrueba() ? 'Con el modo prueba prendido no se guardan envíos: el stock es de verdad.' : env && !RN.origen ? 'Elegí de qué sucursal sale.' :
              dev && enPrueba() ? 'Con el modo prueba prendido no se guardan devoluciones: el stock es de verdad.' :
              dev && !RN.origen ? 'Elegí de qué sucursal sale.' : dev && !RN.lineas.length ? 'La devolución no tiene productos.' :
              !RN.destino ? 'Elegí a qué local va.' : fab && !RN.origen ? 'Para mandarlo a la fábrica, elegí de qué local sale.' :
              RN.origen === RN.destino ? 'Sale y llega al mismo local: elegí otro.' : !RN.lineas.length ? (env ? 'El envío no tiene productos.' : 'El remito no tiene productos.') : '';
    if (mal) { avisar('err', mal); return; }
    var lo = localDe(RN.origen), ld = localDe(RN.destino), unidades = RN.lineas.reduce(function (s, l) { return s + l.cantidad; }, 0);
    var aDonde = fab ? 'la fábrica' : nombreLocal(ld);
    var aviso = Promise.resolve('');
    /* Un envío entre locales: si el que lo manda no tiene todo según el sistema, que lo sepa (no frena). */
    if (lo) aviso = traerStock(lo.id, true).then(function (x) {
      if (!x || !x.con) return '';
      var faltan = RN.lineas.filter(function (l) { return (x.m[claveVar(l.codigo, l.talle, l.color)] || 0) < l.cantidad; });
      return faltan.length ? '\n\nOjo: según el sistema, ' + nombreLocal(lo) + ' no tiene todo (' + faltan.slice(0, 4).map(function (l) {
        return l.codigo + ' ' + [l.talle, l.color].filter(Boolean).join(' ') + ': hay ' + (x.m[claveVar(l.codigo, l.talle, l.color)] || 0) + (dev ? ', devolvés ' : ', mandás ') + l.cantidad; }).join('; ') +
        (faltan.length > 4 ? '…' : '') + (dev ? '). Si la guardás igual, queda en negativo.' : '). Si lo mandás igual, queda en negativo.') : '';
    });
    aviso.then(function (extra) {
      if (!confirm((env ? '¿Guardar el envío de ' + nombreLocal(lo) + ' a ' + aDonde + ' con ' + num(unidades) + (unidades === 1 ? ' unidad' : ' unidades') + '?' +
                          ' Salen del stock ahora. ' + aDonde + ' lo recibe contándolo en POS → Remitos.' :
                    dev ? '¿Guardar la devolución a la fábrica de ' + nombreLocal(lo) + ' con ' + num(unidades) + (unidades === 1 ? ' unidad' : ' unidades') + '?' +
                          ' Salen del stock ahora. Cuando llegue, la oficina la da por recibida.' :
                   '¿Guardar el remito de ' + (lo ? nombreLocal(lo) : 'la fábrica') + ' a ' + aDonde + ' con ' + num(unidades) + (unidades === 1 ? ' unidad' : ' unidades') + '?' +
                   (lo ? ' Salen del stock de ' + nombreLocal(lo) + ' ahora.' : '') +
                   (fab ? ' Cuando llegue, se da por recibido en Gestión → Remitos.' : ' ' + nombreLocal(ld) + ' lo recibe contándolo.')) + extra)) return;
      S.guardando = true;
      var b = $('rnGuardar');
      if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
      /* SQL 189: la razón de cada producto va en cada uno de sus renglones. */
      var items = !dev ? RN.lineas : RN.lineas.map(function (l) { return Object.assign({}, l, { razon: String(RN.razon[l.codigo] || '').trim() }); });
      llamar('pos_remito_guardar', { p: { clave: RN.clave, origen_local_id: RN.origen || null, destino_local_id: fab ? null : RN.destino, a_fabrica: fab,
                                          referencia: RN.referencia || '', observaciones: RN.observaciones || '', items: items } }).then(function (r) {
        S.guardando = false;
        if (lo) delete S.stock[lo.id];
        if (env) avisar('ok', 'Envío R-' + r.numero + ' guardado' + (r.ya ? ' (ya estaba: no se duplicó)' : '') + ': salió del stock de ' + nombreLocal(lo) +
                              (r.total != null ? ', ' + plata(cent(r.total)) : '') + '. ' + nombreLocal(ld) + ' ya lo ve para recibirlo.');
        else if (dev) avisar('ok', 'Devolución R-' + r.numero + ' guardada' + (r.ya ? ' (ya estaba: no se duplicó)' : '') + ': salió del stock de ' + nombreLocal(lo) +
                              (r.total != null ? ', ' + plata(cent(r.total)) : '') + '.');
        else avisar('ok', 'Remito R-' + r.numero + ' guardado' + (r.ya ? ' (ya estaba: no se duplicó)' : '') + ': ' +
                     (fab ? 'cuando llegue a la fábrica, abrilo y tocá «Llegó a la fábrica».' : nombreLocal(ld) + ' ya lo ve para recibirlo.'));
        RN = remitoNuevo(RN);
        guardarBorradorRn();
        if (S.vista === 'remito_nuevo') ir('remitos');
        if (S.vista === 'devolucion_nueva') { S.dvMarcar = r.id; ir('devoluciones'); }
        if (S.vista === 'envio_nuevo') { S.evMarcar = r.id; S.evVer = ''; ir('envios'); }
      }).catch(function (e) {
        S.guardando = false;
        if (b && b.isConnected) { b.disabled = false; b.textContent = txt; }
        avisar('err', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
      });
    });
  }

  /** Pegar las columnas de un Excel (o subir el archivo): Código, Talle, Color y Cantidad. alListo(items). */
  function abrirImportar(alListo) {
    var caja = ventana('<h3 id="posVentTit">Pegar o subir un Excel</h3>' +
      '<p class="pos-bajada">Copiá las columnas del Excel (con la fila de títulos: Código, Talle, Color y Cantidad) y pegalas acá, o elegí el archivo. Los colores van con la sigla (NE) o el nombre (Negro).</p>' +
      campo('', 'Lo pegado', '<textarea id="imTexto" rows="7" spellcheck="false" placeholder="Código&#9;Talle&#9;Color&#9;Cantidad&#10;RM41641&#9;S&#9;NE&#9;2"></textarea>') +
      '<div class="pos-pie rn-imp"><label class="btn btn-sec btn-chico izq">Elegir el archivo…<input type="file" id="imArchivo" accept=".xlsx,.csv,.txt" hidden></label>' +
        '<span class="pos-ayuda" id="imNombre"></span></div>' +
      '<div id="imPrevia" role="status"></div><div class="pos-error" id="imError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="imOk" disabled>Agregar</button></div>', true);
    var res = null;
    function ver(filas) {
      res = leerTabla(filas, false);
      var it = res.items, u = it.reduce(function (s, x) { return s + x.cantidad; }, 0), fuera = unicos(it.map(function (x) { return x.codigo; }).filter(function (c) { return !PROD[c]; }));
      var np = unicos(it.map(function (x) { return x.codigo; })).length;
      errorEn(caja, 'imError', res.error || '');
      caja.querySelector('#imPrevia').innerHTML = res.error ? '' : '<div class="pos-cartel' + (it.length ? '' : ' mal') + '">' +
        (it.length ? '<b>' + it.length + (it.length === 1 ? ' renglón' : ' renglones') + ' · ' + num(u) + (u === 1 ? ' unidad' : ' unidades') + '</b> de ' +
          np + (np === 1 ? ' producto.' : ' productos.') + (fuera.length ? ' ' + fuera.length + ' no están en el catálogo (' + esc(fuera.slice(0, 5).join(', ')) + (fuera.length > 5 ? '…' : '') + '): van igual.' : '')
          : 'No encontré renglones para agregar.') +
        (res.errores.length ? '<br><b>' + (res.errores.length === 1 ? 'No se agrega 1 renglón' : 'No se agregan ' + res.errores.length + ' renglones') + ':</b> ' + esc(res.errores.slice(0, 4).join(' ')) + (res.errores.length > 4 ? '…' : '') : '') + '</div>';
      caja.querySelector('#imOk').disabled = !(it.length && !res.error);
    }
    var t = null;
    caja.querySelector('#imTexto').oninput = function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { ver(filasDeTexto(v)); }, 200); };
    caja.querySelector('#imArchivo').onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      caja.querySelector('#imNombre').textContent = f.name;
      leerArchivo(f).then(ver, function (e) { errorEn(caja, 'imError', e.message || String(e)); });
    };
    caja.querySelector('#imOk').onclick = function () {
      if (!res || !res.items.length) return;
      cerrarVentana();
      alListo(res.items);
      avisar('ok', 'Se agregaron ' + res.items.length + (res.items.length === 1 ? ' renglón.' : ' renglones.'));
    };
    setTimeout(function () { caja.querySelector('#imTexto').focus(); }, 0);
  }

  /* ════════════════════════════════════════════════════════════════════
     INVENTARIO (Gestión): lo que hay en un local, contado
     La primera vez, el Excel de "Consulta de stock" de BlueSoft (una
     sucursal por vez); después, el inventario de cada seis meses. Lo de la
     lista reemplaza lo que dice el sistema y queda anotado.
     ════════════════════════════════════════════════════════════════════ */
  function verInventario() {
    var c = $('cuerpo'), l = localMio(S.invLocal) || localInicial();
    S.invLocal = l.id;
    c.innerHTML = cabeza('Inventario', 'Lo que hay en una sucursal, contado. La primera vez, el Excel de «Consulta de stock» de BlueSoft; después, el inventario de cada seis meses. Lo de la lista reemplaza lo que dice el sistema.',
        '<button type="button" class="btn btn-sec btn-chico" data-ir="stock">Ver el stock</button>') +
      '<div class="cj-paso"><div class="cj-paso-cab"><b>Paso 1</b><span>La sucursal y la lista</span></div>' +
        '<div class="cj-fila">' + campo('', 'Sucursal', '<select id="invLocal" class="desplegable">' + opcionesLocales(l.id) + '</select>') +
          '<div id="invDepZona" class="st-dep-zona"></div>' +
          '<label class="btn btn-sec btn-chico">Elegir el Excel…<input type="file" id="invArchivo" accept=".xlsx,.csv,.txt" hidden></label>' +
          '<button type="button" class="btn btn-sec btn-chico" id="invPegar">Pegar las columnas…</button>' +
          '<span class="pos-ayuda" id="invNombre"></span></div>' +
        '<p class="pos-ayuda">Con las columnas Código, Talle, Color y Cantidad, como «Consulta de stock» de BlueSoft exportada de una sola sucursal. Los colores, con la sigla (NE) o el nombre (Negro).</p></div>' +
      '<div id="invPrevia"></div>' +
      '<h3 class="st-tit">Cargas anteriores</h3><div id="invHist"><p class="cargando">Cargando…</p></div>';
    engancharIr(c);
    $('invLocal').onchange = function () { S.invLocal = this.value; S.invDep = ''; depInv().then(function () { if (S.inv) previa(); }); };
    /* SQL 193: el depósito donde va el inventario (sin elegir, el predeterminado). Con uno solo, no se pregunta. */
    function depInv() {
      var loc = $('invLocal').value;
      return traerDepositos(loc).then(function (ds) {
        var z = $('invDepZona');
        if (!z || $('invLocal').value !== loc) return;
        var act = ds.filter(function (d) { return d.activo; });
        if (act.length < 2) { z.innerHTML = ''; S.invDep = ''; return; }
        if (!depDe(act, S.invDep)) S.invDep = (depPredeterminado(act) || act[0]).id;
        z.innerHTML = campo('', 'Depósito', '<select id="invDep">' + opciones(act.map(function (d) { return [d.id, nombreDep(d)]; }), S.invDep) + '</select>');
        $('invDep').onchange = function () { S.invDep = this.value; if (S.inv) previa(); };
      });
    }
    function nombreDepInv() { var d = S.invDep && depDe(S.dep[$('invLocal').value], S.invDep); return d ? ' · «' + d.nombre + '»' : ''; }
    $('invArchivo').onchange = function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      $('invNombre').textContent = 'Leyendo ' + f.name + '…';
      leerArchivo(f).then(function (filas) { tomar(filas, f.name); }, function (e) { $('invNombre').textContent = ''; avisar('err', e.message || String(e)); });
    };
    $('invPegar').onclick = function () {
      var caja = ventana('<h3 id="posVentTit">Pegar las columnas</h3><p class="pos-bajada">Copiá del Excel las columnas con su fila de títulos (Código, Talle, Color y Cantidad) y pegalas acá.</p>' +
        campo('', 'Lo pegado', '<textarea id="ipTexto" rows="9" spellcheck="false"></textarea>') +
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="ipOk">Revisar</button></div>', true);
      caja.querySelector('#ipOk').onclick = function () { var v = caja.querySelector('#ipTexto').value; cerrarVentana(); tomar(filasDeTexto(v), 'Pegado'); };
      setTimeout(function () { caja.querySelector('#ipTexto').focus(); }, 0);
    };
    function tomar(filas, origen) {
      var res = leerTabla(filas, true);
      $('invNombre').textContent = origen === 'Pegado' ? 'Lo pegado' : origen;
      if (res.error) { S.inv = null; $('invPrevia').innerHTML = '<div class="pos-cartel mal">' + esc(res.error) + '</div>'; return; }
      S.inv = { origen: origen, items: res.items, errores: res.errores, resto: false, clave: nuevaClave() };
      previa();
    }
    function previa() {
      var I = S.inv, loc = $('invLocal').value, z = $('invPrevia');
      z.innerHTML = '<p class="cargando">Comparando con lo que dice el sistema…</p>';
      llamar('pos_stock_consulta', Object.assign({ p_local: loc, p_ocultar_sin: false }, S.invDep ? { p_deposito: S.invDep } : {})).then(function (d) {
        if (S.inv !== I || !$('invPrevia')) return;
        var ahora = {}, nuevo = {}, desc = {}, filas = [];
        (d.filas || []).forEach(function (f) { ahora[claveVar(f[1], f[2], f[3])] = f[4]; desc[f[1]] = desc[f[1]] || f[7]; });
        I.items.forEach(function (x) { var k = claveVar(x.codigo, x.talle, x.color); nuevo[k] = (nuevo[k] || 0) + x.cantidad; if (x.descripcion) desc[x.codigo] = desc[x.codigo] || x.descripcion; });
        Object.keys(nuevo).forEach(function (k) { if (nuevo[k] !== (ahora[k] || 0)) filas.push([k, ahora[k] || 0, nuevo[k], false]); });
        var aCero = Object.keys(ahora).filter(function (k) { return !(k in nuevo) && ahora[k] !== 0; });
        if (I.resto) aCero.forEach(function (k) { filas.push([k, ahora[k], 0, true]); });
        filas.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
        var unidades = Object.keys(nuevo).reduce(function (s, k) { return s + Math.max(0, nuevo[k]); }, 0);
        var fuera = unicos(I.items.map(function (x) { return x.codigo; }).filter(function (c) { return !PROD[c]; }));
        z.innerHTML = '<div class="cj-paso"><div class="cj-paso-cab"><b>Paso 2</b><span>Revisá y cargá</span></div>' +
          '<div class="pos-totales">' +
            '<div class="pos-kpi"><span>Renglones</span><b>' + num(Object.keys(nuevo).length) + '</b></div>' +
            '<div class="pos-kpi fuerte"><span>Unidades</span><b>' + num(unidades) + '</b></div>' +
            '<div class="pos-kpi"><span>Cambian</span><b>' + num(filas.length) + '</b></div>' +
            '<div class="pos-kpi"><span>Fuera del catálogo</span><b>' + num(fuera.length) + '</b></div></div>' +
          (I.errores.length ? '<div class="pos-cartel mal">' + (I.errores.length === 1 ? 'No se carga 1 renglón' : 'No se cargan ' + num(I.errores.length) + ' renglones') + ': ' + esc(I.errores.slice(0, 6).join(' ')) + (I.errores.length > 6 ? '…' : '') + '</div>' : '') +
          (!d.cargado ? '<div class="pos-cartel">' + esc(nombreLocal(localDe(loc))) + ' todavía no tiene stock: ésta es la carga inicial.</div>' : '') +
          (aCero.length ? '<label class="pos-check"><input type="checkbox" id="invResto"' + (I.resto ? ' checked' : '') + '> Es el inventario completo de la sucursal: lo que no está en la lista queda en 0 (' +
            num(aCero.length) + (aCero.length === 1 ? ' variante' : ' variantes') + ')</label>' : '') +
          (filas.length ? '<div class="pos-marco-tabla inv-tabla"><table class="pos-tabla"><thead><tr><th>Código</th><th>Producto</th><th class="c">Talle</th><th>Color</th>' +
              '<th class="n">Dice el sistema</th><th class="n">Inventario</th><th class="n">Diferencia</th></tr></thead><tbody>' +
            filas.slice(0, 200).map(function (f) {
              var a = f[0].split('|'), dif = f[2] - f[1];
              return '<tr' + (f[3] ? ' class="anulada"' : '') + '><td><b>' + esc(a[0]) + '</b></td><td>' + esc(nombreProd(a[0], desc[a[0]])) + (f[3] ? ' <small class="st-chico">no está en la lista</small>' : '') + '</td>' +
                '<td class="c">' + esc(a[1]) + '</td><td>' + esc(a[2] ? nombreColor(a[2], a[0]) : '') + '</td><td class="n">' + num(f[1]) + '</td><td class="n"><b>' + num(f[2]) + '</b></td>' +
                '<td class="n"><b class="' + (dif < 0 ? 'st-sale' : 'st-entra') + '">' + (dif > 0 ? '+' : '−') + miles(Math.abs(dif)) + '</b></td></tr>';
            }).join('') + '</tbody></table></div>' + (filas.length > 200 ? '<p class="pos-mas">Se ven 200 de ' + num(filas.length) + ' cambios.</p>' : '')
            : '<div class="pos-cartel">Todo coincide con lo que dice el sistema: no cambia nada.</div>') +
          (d.mas ? '<p class="pos-mas">La sucursal tiene más de 60.000 renglones: la comparación de arriba es parcial (la carga, no).</p>' : '') +
          '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" id="invOtro">Elegir otro</button>' +
            '<button type="button" class="btn btn-pri btn-chico" id="invCargar"' + (filas.length ? '' : ' disabled') + '>Cargar el inventario en ' + esc(nombreLocal(localDe(loc)) + nombreDepInv()) + '</button></div></div>';
        var rs = $('invResto');
        if (rs) rs.onchange = function () { I.resto = rs.checked; previa(); };
        $('invOtro').onclick = function () { S.inv = null; $('invPrevia').innerHTML = ''; $('invNombre').textContent = ''; };
        $('invCargar').onclick = function () { cargarInv(loc, nuevo, this); };
      }).catch(function (e) { if ($('invPrevia')) $('invPrevia').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function cargarInv(loc, nuevo, bt) {
      var I = S.inv, ln = localDe(loc);
      if (!confirm('¿Cargar el inventario en ' + nombreLocal(ln) + nombreDepInv() + '? Lo de la lista reemplaza lo que dice el sistema' + (I.resto ? ' y lo que no está queda en 0' : '') +
                   '. Queda anotado quién lo cargó; no se deshace solo.')) return;
      var desc = {};
      I.items.forEach(function (x) { if (x.descripcion) desc[x.codigo] = x.descripcion; });
      var items = Object.keys(nuevo).map(function (k) { var a = k.split('|'); return { codigo: a[0], talle: a[1], color: a[2], cantidad: nuevo[k], descripcion: desc[a[0]] || '' }; });
      var txt = bt.textContent;
      bt.disabled = true;
      bt.textContent = 'Cargando…';
      var pi = { local_id: loc, items: items, resto_a_cero: I.resto, origen: I.origen, clave: I.clave };
      if (S.invDep) pi.deposito_id = S.invDep;   // SQL 193 (sin elegir, la base usa el predeterminado)
      llamar('pos_inventario_cargar', { p: pi }).then(function (r) {
        delete S.stock[loc];
        delete S.dep[loc];
        S.inv = null;
        avisar('ok', 'Inventario cargado en ' + nombreLocal(ln) + ': ' + num(r.lineas) + (r.lineas === 1 ? ' renglón, ' : ' renglones, ') + num(r.cambiaron) +
                     (r.cambiaron === 1 ? ' cambió.' : ' cambiaron.') + (r.ya ? ' (Ya estaba cargado: no se duplicó.)' : ''));
        if (!$('invPrevia')) return;
        $('invPrevia').innerHTML = '';
        $('invNombre').textContent = '';
        historial();
      }).catch(function (e) { bt.disabled = false; bt.textContent = txt; avisar('err', esDeRed(e) ? 'No se pudo cargar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e)); });
    }
    function historial() {
      llamar('pos_inventarios', { p_local: null }).then(function (h) {
        if (!$('invHist')) return;
        var conDep = h.some(function (x) { return x.deposito; });   // SQL 193
        $('invHist').innerHTML = !h.length ? '<div class="pos-cartel">Todavía no se cargó ningún inventario.</div>' :
          '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th>Sucursal</th>' + (conDep ? '<th>Depósito</th>' : '') + '<th>Quién</th><th>De dónde</th><th class="n">Renglones</th>' +
            '<th class="n">Unidades</th><th class="n">Cambiaron</th><th>Completo</th></tr></thead><tbody>' +
          h.map(function (x) {
            return '<tr><td>' + esc(fechaHora(x.fecha)) + '</td><td>' + esc(bonito(x.local)) + '</td>' + (conDep ? '<td>' + esc(x.deposito || '—') + '</td>' : '') + '<td>' + esc(x.persona || '—') + '</td><td>' + esc(x.origen || '—') + '</td>' +
              '<td class="n">' + num(x.lineas) + '</td><td class="n">' + num(x.unidades) + '</td><td class="n">' + num(x.cambiaron) + '</td><td>' + (x.resto_a_cero ? 'Sí (el resto a 0)' : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).catch(function (e) { if ($('invHist')) $('invHist').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    historial();
    depInv().then(function () { if (S.inv) previa(); });
  }

  /* ════════════════════════════════════════════════════════════════════
     LO QUE TODAVÍA NO ESTÁ
     ════════════════════════════════════════════════════════════════════ */
  function verPronto(v) {
    var p = PRONTO[v] || ['En construcción', [], ''];
    $('cuerpo').innerHTML = cabeza(esc(p[0]) + '<span class="pos-tag">En construcción</span>', 'Todavía no está. Esto es lo que va a tener:') +
      '<div class="pos-pronto-caja"><ul>' + p[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (p[2] ? '<p>' + p[2] + '</p>' : '') + '</div>';
  }

  if (typeof iniciarPWA === 'function') iniciarPWA();
  persona.listo.then(arrancar);

  /* Para las pruebas: la cuenta del ticket, sin la pantalla. */
  window.__pos = { cuenta: function (v, ini) { var antes = S.ini; S.ini = ini; try { return cuenta(v); } finally { S.ini = antes; } }, leerPlata: leerPlata, plata: plata,
                  leerTabla: leerTabla, filasDeTexto: filasDeTexto, filasDeXml: filasDeXml, siglaColor: siglaColor, ordenarTalles: ordenarTalles,
                  celdaCsv: celdaCsv, tiempoRes: tiempoRes,
                  puntosDe: function (total, factor, ini) { var antes = S.ini; S.ini = ini; try { return puntosDe(total, factor); } finally { S.ini = antes; } } };
})();
