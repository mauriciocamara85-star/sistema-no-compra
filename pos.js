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
   · Las promos se aplican solas y se pueden sacar; además existe el
     descuento a mano, como en BlueSoft (05/10).
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

  /* ── Los menús: las secciones de Tango y Dragonfish, con los nombres de BlueSoft ── */
  var MENUS = {
    mostrador: [
      ['Ventas', [['venta', 'Nueva venta', 'venta'], ['tickets', 'Tickets', 'tickets'],
                  ['cambios', 'Cambios', 'cambio'], ['fallida', 'Venta fallida', 'fallida', 'index.html?volver=pos']]],
      /* El cierre se hace en el mostrador, a la noche (SQL 149); los listados quedan en Gestión. */
      ['Caja', [['cierre', 'Cierre de caja', 'caja']]]
    ],
    gestion: [
      ['Artículos', [['productos', 'Productos', 'producto'], ['listas', 'Listas de precios', 'lista'], ['promos', 'Promociones', 'promo']]],
      ['Stock', [['stock', 'Stock', 'stock'], ['envios', 'Envíos', 'envio'],
                 ['recepcion', 'Recepción', 'recepcion'], ['inventario', 'Inventario', 'inventario']]],
      ['Caja', [['cierres', 'Cierres de caja', 'caja'], ['movimientos', 'Movimientos', 'movs']]],
      ['Clientes y reportes', [['clientes', 'Clientes', 'clientes'], ['reportes', 'Reportes', 'reportes']]],
      ['Configuración', [['sucursales', 'Sucursales', 'sucursal'], ['medios', 'Medios de pago', 'medios'], ['arca', 'Facturación (ARCA)', 'arca']]]
    ]
  };
  var MENU = MENUS[MODO];
  /* Las pantallas que no están en el menú y se abren desde otra (en el menú queda marcada ésa). */
  var DENTRO = { mostrador: { cambio: 'cambios' }, gestion: {} };
  var INICIO = { mostrador: 'venta', gestion: 'listas' };
  var HECHAS = { venta: 1, tickets: 1, cambios: 1, cierre: 1, cierres: 1, movimientos: 1, listas: 1, promos: 1, sucursales: 1 };
  var LETRAS = { A: 'Factura A', B: 'Factura B', X: 'X · interno' };

  /* Lo que va a tener cada sección que todavía no está (de la investigación del 20/10 y del mapa de BlueSoft). */
  var PRONTO = {
    stock: ['Consulta de stock', [
      'El stock de cada sucursal por producto, talle y color.',
      'Cada local ve el suyo; la oficina, todos.',
      'Vender sin stock avisa pero no frena, y queda la lista de los negativos para corregir.',
      'El cruce con el stock de la fábrica que ya avisa el bot.'], ''],
    envios: ['Envíos entre sucursales', [
      'Un local le manda prendas a otro: salen de uno y quedan "en camino".',
      'El que recibe escanea y confirma; recién ahí entran a su stock.',
      'Lo que no llegó queda a la vista.'], ''],
    recepcion: ['Recepción de mercadería', [
      'La fábrica carga el envío y el local lo ve "por recibir" (hoy son los remitos de compra de BlueSoft).',
      'Se escanea o se confirma, y entra al stock.',
      'Las diferencias (vino de menos o de más) quedan anotadas.'], ''],
    inventario: ['Inventario y ajustes', [
      'El inventario general de cada seis meses, con la pistola.',
      'Los ajustes con su motivo (falla, robo, error de carga).',
      'La temporada nueva sin tener que crear un depósito nuevo cada vez.'], ''],
    productos: ['Productos', [
      'El catálogo que ya está en el sistema (' + (window.CATALOGO ? window.CATALOGO.length : 576) + ' productos), con rubro, talles y colores.',
      'Alta y edición de productos, con varios códigos de barras por artículo.',
      'La etiqueta con el código, el talle y el color.'], 'Los precios ya se cambian en <a href="#listas">Listas de precios</a>.'],
    clientes: ['Clientes', [
      'Buscar por nombre, DNI, CUIT, mail o teléfono.',
      'El socio del Club adentro de la venta: suma puntos y usa sus beneficios.',
      'Lo que compró cada uno, para el CRM.',
      'La condición de IVA guardada, para la factura A.'], ''],
    reportes: ['Reportes', [
      'Ventas por sucursal, por vendedor, por producto y por medio de pago.',
      'Por día, por semana y por mes, comparado con el año pasado.',
      'La conversión con el No Compra (los que compraron sobre los que entraron).',
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

  /* ── Íconos (trazos de 24×24) ── */
  var TRAZO = {
    venta: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M12 10v6M9 13h6"/>',
    tickets: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    cambio: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    fallida: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    caja: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    movs: '<path d="M7 3v18M3 7l4-4 4 4"/><path d="M17 21V3M13 17l4 4 4-4"/>',
    stock: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    envio: '<path d="M1 4h14v12H1z"/><path d="M15 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    recepcion: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    inventario: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    producto: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    promo: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    reportes: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/>',
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

  /* ── El modo prueba: la venta hace el mismo camino que una de verdad, pero no cuenta ──
     Vive en sessionStorage: al cerrar la ventana vuelve solo a lo de verdad, así no queda
     prendido de un día para el otro. */
  function enPrueba() {
    if (MODO !== 'mostrador') return false;
    try { return sessionStorage.getItem(K_PRUEBA) === '1'; } catch (e) { return false; }
  }
  function marcarPrueba() { document.documentElement.classList.toggle('pos-en-prueba', enPrueba()); }
  marcarPrueba();

  /* ── El catálogo (catalogo.js: [código, nombre, rubro, "S,M,L", "NE:NEGRO|BL:BLANCO"]) ── */
  var PROD = {};
  (window.CATALOGO || []).forEach(function (p) { PROD[p[0]] = p; });
  var RUBROS = Object.keys((window.CATALOGO || []).reduce(function (m, p) { if (p[2]) m[p[2]] = 1; return m; }, {})).sort();
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
  var S = { ini: null, precios: {}, vista: 'venta', guardando: false, ultimo: null, listaSel: null, cajaLocal: null, cajaHecho: null,
            cambioHecho: null, cbFoco: null, cbPagoHay: null };
  var V = null;    // la venta que se está armando
  var CB = null;   // el cambio que se está armando

  function llamar(nombre, args) {
    return persona.token().then(function (t) { return funcion(nombre, args || {}, t); });
  }
  function esDeRed(e) { return !(e && (e.delServidor || e.sinSesion)); }
  function mensajeDe(e) {
    var m = String((e && e.message) || e || '');
    /* El 147 (pruebas y la X) cambia pos_tickets y suma pos_pruebas_borrar; con el 146 solo, la X no existe.
       El 149 suma la caja (pos_caja…, pos_cierre…). */
    if (/Could not find the function|schema cache|PGRST202/.test(m)) {
      return 'Todavía falta correr el SQL ' + (/pos_cambio/.test(m) ? '151 (los cambios)' : /pos_caja|pos_cierre/.test(m) ? '149 (el cierre de caja)' : /pos_tickets|pos_pruebas_borrar/.test(m) ? '147 (el del POS)' : '146 (el del POS)') + ' en Supabase.';
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
    return llamar('pos_precios', { p_lista: lista }).then(function (filas) {
      var m = {};
      (filas || []).forEach(function (f) { m[f[0]] = { c: cent(f[1]), propio: !!f[2] }; });
      S.precios[lista] = m;
      return m;
    });
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

  /* ════════════════════════════════════════════════════════════════════
     ARRANQUE: sólo Administración, por ahora
     ════════════════════════════════════════════════════════════════════ */
  function arrancar() {
    var y = persona.yo();
    if (!y || persona.rol() !== 'admin') { pantallaPorton(y); return; }
    app.innerHTML = '<p class="cargando">Cargando…</p>';
    llamar('pos_inicio').then(function (ini) {
      S.ini = ini;
      if (!ini.locales || !ini.locales.length) { app.innerHTML = '<div class="pos-cartel">No hay sucursales cargadas.</div>'; return; }
      ir(vistaDelHash());
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
      c.innerHTML = '<p class="ncp-porton-txt">Entraste como <b>' + esc(y.nombre) + '</b>. Por ahora lo usa sólo Administración: cuando se pruebe en tu local, va a aparecer en la barra.</p>';
      return;
    }
    persona.porton(c, 'Por ahora lo usa sólo Administración.');
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
    var ver = { venta: verVenta, tickets: verTickets, cambios: verCambios, cambio: verCambio, cierre: verCierre, cierres: verCierres,
                movimientos: verMovimientos, listas: verListas, promos: verPromos, sucursales: verSucursales }[v];
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
  /* La venta y el cambio necesitan el ancho (el ticket de BlueSoft): arrancan con el menú achicado. */
  function vistaAncha() { return S.vista === 'venta' || S.vista === 'cambio'; }
  function menuChico() { return vistaAncha() ? leer(K_MENU_VENTA) !== 'abierto' : Interfaz.panelChico(K_MENU); }
  function guardarMenu(ch) { if (vistaAncha()) guardar(K_MENU_VENTA, ch ? 'chico' : 'abierto'); else Interfaz.panelChico(K_MENU, ch); }

  function item(it) {
    var activa = it[0] === S.vista || it[0] === DENTRO[MODO][S.vista];
    var dentro = icono(it[2]) + '<span>' + esc(it[1]) + '</span>' + (HECHAS[it[0]] || it[3] ? '' : '<em class="pos-pronto">Pronto</em>');
    if (it[3]) return '<a class="pos-item" href="' + it[3] + '" title="' + esc(it[1]) + ' (el No Compra)">' + dentro + '</a>';
    return '<button type="button" class="pos-item' + (activa ? ' activa' : '') + '" data-ir="' + it[0] + '" title="' + esc(it[1]) + '"' +
      (activa ? ' aria-current="page"' : '') + '>' + dentro + '</button>';
  }
  /* Gestión: cada grupo se despliega y se pliega (Mauricio, 20/10: "que se despliegue… si en algún
     momento tenemos más"). Arranca abierto el de la sección en la que está; lo demás, como lo dejó. */
  function grupoAbierto(g) {
    if (g[1].some(function (it) { return it[0] === S.vista; })) return true;
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

  function marco() {
    var chico = menuChico(), y = persona.yo();
    var cab = MODO === 'gestion'
      ? '<div class="pos-menu-cab"><span>Gestión</span>' + Interfaz.botonPanel(chico, '', 'menuPos') + '</div>'
      : '<div class="pos-menu-cab"><span class="pos-marca" aria-hidden="true">' + BOLSA + '</span><span>POS</span>' + Interfaz.botonPanel(chico, '', 'menuPos') + '</div>' +
        '<a class="pos-item pos-volver" href="' + esc(volverAlSistema()) + '" title="Volver al sistema">' + icono('volver') + '<span>Sistema</span></a>';
    var cuerpo = MODO === 'gestion'
      ? MENU.map(function (g) {
          var ab = grupoAbierto(g);
          return '<button type="button" class="pos-grupo pos-grupo-btn" data-grupo="' + esc(g[0]) + '" aria-expanded="' + ab + '">' +
            '<span>' + esc(g[0]) + '</span>' + icono('abajo') + '</button>' +
            '<div class="pos-grupo-items' + (ab ? '' : ' cerrado') + '">' + g[1].map(item).join('') + '</div>';
        }).join('')
      : MENU.map(function (g) { return '<div class="pos-grupo" aria-hidden="true"></div>' + g[1].map(item).join(''); }).join('') +
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
  function localInicial() {
    var r = recuerdo(), ls = S.ini.locales;
    var x = localDe(r.local);
    if (!x) {
      var nc = String(leer('nc_local') || '').trim().toLowerCase();
      x = ls.filter(function (l) { return nc && (String(l.codigo || '').toLowerCase() === nc || String(l.nombre || '').toLowerCase() === nc); })[0];
    }
    return x || ls[0];
  }
  function vendedoresDe(localId) { return ((S.ini.vendedores || {})[localId] || []).slice(); }
  function vendedorInicial(l) {
    if (!l) return '';
    var r = recuerdo(), vs = vendedoresDe(l.id), nc = leer('nc_vendedor');
    if (r.vendedor && r.vendedor[l.id]) return r.vendedor[l.id];
    return vs.indexOf(nc) >= 0 ? nc : '';
  }
  function ventaNueva(antes) {
    var l = (antes && localDe(antes.local_id)) || localInicial();
    return { v: 1, clave: nuevaClave(), local_id: l ? l.id : null, vendedor: antes ? antes.vendedor : vendedorInicial(l),
             lista_id: listaDe(l), letra: 'B', cliente: null, lineas: [], sacadas: {}, manuales: [],
             forma: 'efectivo', pago: {}, multiples: null, observaciones: '' };
  }
  function cargarBorrador() {
    var b = leerJSON(K_BORRADOR, null);
    if (b && b.v === 1 && b.clave && Array.isArray(b.lineas) && localDe(b.local_id) && listaPorId(b.lista_id)) {
      b.sacadas = b.sacadas || {}; b.manuales = b.manuales || []; b.pago = b.pago || {};
      if (!LETRAS[b.letra]) b.letra = 'B';
      if (b.letra === 'X' && b.forma !== 'efectivo') { b.forma = 'efectivo'; b.multiples = null; }
      return b;
    }
    return ventaNueva();
  }
  function guardarBorrador() { guardarJSON(K_BORRADOR, V); }

  /* ── La cuenta del ticket ──────────────────────────────────────────────
     1. Las promos que NO se combinan: se aplica la que más le conviene al
        cliente (si la sacan, entra la que sigue).
     2. Las que se combinan (10 % en efectivo), en su orden, sobre lo que queda.
     3. Los descuentos a mano, sobre el total del ticket (como en BlueSoft).
     El 3x2 regala la más barata de cada tres; la 2.ª al 50 % va de a pares,
     de la más cara a la más barata, y descuenta la segunda de cada par. */
  function cuenta(v) {
    var hoy = S.ini.hoy, neto = 0, cant = 0, unidades = [];
    v.lineas.forEach(function (l, i) {
      neto += l.precio * l.cantidad;
      cant += l.cantidad;
      for (var k = 0; k < l.cantidad; k++) unidades.push({ l: i, p: l.precio, rubro: l.rubro || '' });
    });
    var porLinea = v.lineas.map(function () { return 0; });
    var usadas = {}, desc = [], sacadas = [], resto = neto;
    var vigentes = (S.ini.promos || []).filter(function (p) {
      return p.activo && (!p.desde || p.desde <= hoy) && (!p.hasta || p.hasta >= hoy);
    });
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
      if (r.monto <= 0) return;
      if (v.sacadas[p.id]) { sacadas.push(p); return; }
      if (!mejor || r.monto > mejor.r.monto) mejor = { p: p, r: r };
    });
    if (mejor) aplicar(mejor.p, mejor.r);
    vigentes.filter(function (p) { return p.combinable; }).forEach(function (p) {
      var r = calcular(p);
      if (r.monto <= 0) return;
      if (v.sacadas[p.id]) { sacadas.push(p); return; }
      aplicar(p, r);
    });
    v.manuales.forEach(function (m, i) {
      var monto = Math.min(m.pct ? Math.round(resto * m.pct / 100) : m.monto, resto);
      if (monto <= 0) return;
      resto -= monto;
      desc.push({ tipo: 'manual', idx: i, descripcion: m.descripcion + (m.pct ? ' (' + String(m.pct).replace('.', ',') + ' %)' : ''), monto: monto });
    });
    return { neto: neto, cantidad: cant, porLinea: porLinea, descuentos: desc, sacadas: sacadas, descuento: neto - resto, total: resto };
  }

  /** Los pagos que se mandan a la base (en centavos). X: la venta (V) o el cambio (CB). */
  function pagosDe(total, X) {
    X = X || V;
    if (total <= 0) return [];
    if (X.forma === 'multiple') return (X.multiples || []).map(function (x) { return Object.assign({}, x); });
    var p = { medio: X.forma, monto: total };
    if (X.forma === 'efectivo' && X.pago.recibido) p.recibido = X.pago.recibido;
    if (X.forma === 'tarjeta') { p.tarjeta = X.pago.tarjeta || ''; p.tipo_tarjeta = tipoTarjeta(p.tarjeta); p.cuotas = Number(X.pago.cuotas) || 1; p.cupon = X.pago.cupon || ''; }
    else if (X.forma !== 'efectivo') p.cupon = X.pago.operacion || '';
    return [p];
  }
  function tipoTarjeta(t) { var x = TARJETAS.filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : ''; }
  function sumaPagos(ps) { return (ps || []).reduce(function (s, x) { return s + (x.monto || 0); }, 0); }

  function campo(cls, lbl, control, extra) {
    return '<label class="pos-f' + (cls ? ' ' + cls : '') + '"' + (extra || '') + '><span>' + lbl + '</span>' + control + '</label>';
  }
  function opciones(lista, actual) {
    return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(actual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function textoGuardar() { return (enPrueba() ? 'Guardar prueba' : 'Guardar y nueva') + ' <span class="pos-tecla">F9</span>'; }

  function verVenta() {
    V = cargarBorrador();
    var c = $('cuerpo'), prueba = enPrueba();
    c.innerHTML =
      /* El cartel de la venta guardada va en la cabecera: abajo empujaría la venta fuera de la pantalla del local. */
      cabeza('Nueva venta' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), '<span id="vSub"></span>',
        '<div id="vHecho"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vLimpiar">Limpiar</button>' +
        '<button type="button" class="btn btn-pri btn-chico" id="vGuardar" title="Guardar la venta y empezar otra (F9)">' + textoGuardar() + '</button>') +
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
          campo('', 'Forma de pago', '<select id="vForma">' + opciones(Object.keys(MEDIOS).map(function (k) { return [k, MEDIOS[k]]; }).concat([['multiple', 'Múltiple']]), '') + '</select>') +
          '<div class="tk-pagox" id="vPagoX"></div>' +
          campo('c6', 'Sucursal', '<select id="vLocal"></select>') +
          campo('c3', 'Depósito', '<input type="text" value="Ventas" readonly title="El stock todavía no está en el POS">') +
          campo('c3', 'Caja', '<input type="text" value="Chica" readonly title="La caja chica del local">') +
        '</div>' +
        '<div class="tk-tot">' +
          '<div class="tk-caja"><span>Neto</span><b id="tNeto">$0</b></div>' +
          '<button type="button" class="tk-caja" id="tDescBtn" title="Agregar un descuento a mano"><span>Descuentos</span><b id="tDesc">$0</b></button>' +
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
    $('vLocal').innerHTML = opciones(S.ini.locales.map(function (l) { return [l.id, nombreLocal(l)]; }), V.local_id);
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
    $('vCargarCli').onclick = function () { abrirCliente(false); };
    $('vLista').onchange = function () { cambiarLista(Number(this.value)); };
    $('vForma').onchange = function () {
      if (this.value === 'multiple') { this.value = V.forma; abrirMultiple(); return; }
      V.forma = this.value;
      V.multiples = null;
      pintarPago();
      pintar();
    };
    $('vLocal').onchange = function () {
      var l = localDe(this.value);
      V.local_id = l.id;
      V.vendedor = vendedorInicial(l);
      recordar();
      llenarVendedores();
      cambiarLista(listaDe(l));
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
    $('vGuardar').onclick = guardarVenta;
    engancharProducto();
    engancharFilas();
    pintarPago();
    $('vFilas').innerHTML = '<tr class="tk-vacia"><td colspan="10">Cargando los precios…</td></tr>';
    asegurarPrecios(V.lista_id).then(function () { pintar(); }, function (e) { pintar(); avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); });
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

  /* ── Lo que cambia cada vez ── */
  function pintar() {
    if (!$('vFilas')) return;
    var c = cuenta(V), l0 = localDe(V.local_id), li = listaPorId(V.lista_id);
    $('vSub').textContent = nombreLocal(l0) + ' · ' + (li ? li.nombre : '');
    $('vRef').value = 'Al guardar';
    $('vLetra').value = V.letra;
    $('vCliente').textContent = textoCliente(V.cliente);
    $('vCliente').title = $('vCliente').textContent;
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
        '<td class="tk-cod">' + esc(l.codigo || '—') + '</td><td class="tk-desc">' + esc(l.descripcion) + '</td>' +
        '<td class="c">' + esc(l.talle || '') + '</td><td>' + esc(l.color_nom || l.color || '') + '</td>' +
        '<td class="c"><input type="number" class="tk-cant" min="1" max="999" value="' + l.cantidad + '" aria-label="Cantidad de ' + esc(l.descripcion) + '"></td>' +
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
    c.sacadas.forEach(function (p) {
      filas.push('<tr class="tk-fila-sacada"><td></td><td colspan="9">Sacaste «' + esc(p.nombre) + '». <button type="button" data-volver="' + p.id + '">Volver a aplicarla</button></td></tr>');
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
                       (V.forma === 'efectivo' && V.pago.recibido && V.pago.recibido < c.total ? 'Lo recibido es menos que el total.' : '');
    }
    var mt = $('vMultTxt');
    if (mt) mt.textContent = (V.multiples || []).map(function (x) { return MEDIOS[x.medio] + ' ' + plata(x.monto); }).join(' + ') || '—';

    var cl = V.cliente;
    $('vNota').innerHTML = enPrueba() ? '<b>Modo prueba:</b> lo que guardes numera aparte (P-1, P-2…), no cuenta para nada y se borra desde Tickets.' :
      V.letra === 'X' ? '<b>Comprobante X:</b> es interno, no es factura y no va a ARCA. Va sólo con efectivo.' :
      '<b>La factura de ARCA todavía no está conectada:</b> la venta queda registrada en el POS y la factura la sigue haciendo BlueSoft.' +
      (cl && cl.envio === 'mail' && cl.email ? ' Cuando esté, va por mail a ' + esc(cl.email) + '.' : '') +
      (cl && cl.envio === 'whatsapp' && cl.tel ? ' Cuando esté, va por WhatsApp al ' + esc(cl.tel) + '.' : '');
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
  function buscarProductos(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    var pal = q.split(/\s+/), res = [];
    (window.CATALOGO || []).forEach(function (p) {
      var cod = p[0].toLowerCase(), nom = String(p[1]).toLowerCase(), pts;
      if (cod === q) pts = 0;
      else if (cod.indexOf(q) === 0) pts = 1;
      else if (pal.every(function (w) { return nom.indexOf(w) >= 0; })) pts = nom.indexOf(pal[0]) === 0 ? 2 : 3;
      else return;
      res.push([pts, p]);
    });
    res.sort(function (a, b) { return a[0] - b[0] || String(a[1][1]).localeCompare(String(b[1][1]), 'es'); });
    return res.slice(0, 8).map(function (x) { return x[1]; });
  }

  /** El campo de producto de la venta. El cambio tiene dos: lo que vuelve y lo que se lleva. */
  function prodVenta() { return { campo: 'vProd', sug: 'vSug', lista: function () { return V.lista_id; }, agregar: agregar }; }

  /* o: { campo, sug (los id), lista() y agregar(p, talle, color, cantidad) }. Cada campo con sus sugerencias. */
  function engancharProducto(o) {
    o = o || prodVenta();
    var campoP = $(o.campo), caja = $(o.sug), sug = [], mira = 0, tEsc = null;
    function cerrar() { caja.hidden = true; sug = []; campoP.removeAttribute('aria-activedescendant'); }
    function elegir(p) { abrirDetalle(p, o); }
    function pintarSug() {
      if (!sug.length) { cerrar(); return; }
      caja.innerHTML = sug.map(function (p, i) {
        var pr = precioDe(p[0], o.lista());
        return '<button type="button" role="option" id="' + o.sug + i + '" data-sug="' + i + '" class="' + (i === mira ? 'on' : '') + '" aria-selected="' + (i === mira) + '">' +
          '<span>' + esc(p[1]) + ' <small>' + esc(p[2] || '') + '</small></span><small>' + esc(p[0]) + '</small>' +
          (pr ? '<span class="n">' + plata(pr) + '</span>' : '<span class="sin">Sin precio</span>') + '</button>';
      }).join('');
      caja.hidden = false;
      campoP.setAttribute('aria-activedescendant', o.sug + mira);
    }
    /* Después de agregar: el campo vacío y sin sugerencias, listo para el próximo disparo. */
    campoP.limpiar = function () { clearTimeout(tEsc); campoP.value = ''; cerrar(); };
    campoP.oninput = function () {
      clearTimeout(tEsc);
      var d = leerEscaneo(campoP.value);
      /* Algunas pistolas no mandan Enter: si el texto ya es un disparo completo (el talle y el color
         existen en esa prenda), se agrega solo, cuando deja de escribir. */
      if (d && PROD[d.codigo] && tallesDe(PROD[d.codigo]).indexOf(d.talle) >= 0 &&
          coloresDe(PROD[d.codigo]).some(function (x) { return x.cod === d.color; })) {
        var antes = campoP.value;
        tEsc = setTimeout(function () { if (campoP.value === antes) agregarEscaneo(d, o); }, 150);
        cerrar();
        return;
      }
      sug = buscarProductos(campoP.value);
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
      var cod = campoP.value.trim().toUpperCase();
      if (PROD[cod]) { elegir(PROD[cod]); return; }
      /* Si las sugerencias se cerraron (salió del campo y volvió), se buscan de nuevo. */
      if (!sug.length) { sug = buscarProductos(campoP.value); mira = 0; }
      if (sug.length) { elegir(sug[mira]); return; }
      if (cod) {
        avisar('err', 'No encontré «' + campoP.value.trim() + '» en el catálogo. Si es un artículo suelto, cargalo con «Nueva línea».');
        campoP.select();   // el próximo disparo lo reemplaza
      }
    };
    caja.onmousedown = function (e) { e.preventDefault(); };   // que el campo no pierda el foco antes del click
    caja.onclick = function (e) { var b = e.target.closest('[data-sug]'); if (b) elegir(sug[Number(b.getAttribute('data-sug'))]); };
    campoP.onblur = function () { setTimeout(function () { if (document.activeElement !== campoP) cerrar(); }, 120); };
    campoP.onfocus = function () { if (!sug.length && !leerEscaneo(campoP.value)) { sug = buscarProductos(campoP.value); mira = 0; pintarSug(); } };
  }

  function agregarEscaneo(d, o) {
    var p = PROD[d.codigo];
    if (!p) {
      avisar('err', 'El código ' + d.codigo + ' no está en el catálogo. Si es un artículo suelto, cargalo con «Nueva línea».');
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
    if (!precioDe(cod)) avisar('info', p[1] + ' no tiene precio en esta lista: escribilo en «Precio unit.».');
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
      else if (b.hasAttribute('data-sacar')) V.sacadas[b.getAttribute('data-sacar')] = true;
      else if (b.hasAttribute('data-volver')) delete V.sacadas[b.getAttribute('data-volver')];
      else if (b.hasAttribute('data-manual')) V.manuales.splice(Number(b.getAttribute('data-manual')), 1);
      else return;
      pintar();
      $('vProd').focus();
    });
  }

  /* "Agregar descuento…" de BlueSoft. */
  function abrirDescuento() {
    var c = cuenta(V);
    if (!c.neto) { avisar('info', 'Primero cargá los productos.'); return; }
    var caja = ventana('<h3 id="posVentTit">Agregar descuento</h3><p class="pos-bajada">Sobre el total del ticket, después de las promos (' + plata(c.total) + '). Se saca con la ✕ de la grilla.</p>' +
      '<div class="pos-campos">' +
        campo('ancho', 'Descuento', '<select id="dsTipo" autofocus>' + DESCUENTOS.map(function (d, i) { return '<option value="' + i + '">' + esc(d[0]) + '</option>'; }).join('') + '</select>') +
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
    caja.querySelector('#clGenerico').onclick = function () { V.cliente = null; if (V.letra === 'A') V.letra = 'B'; cerrarVentana(); pintar(); };
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

  /* "Pago múltiple" de BlueSoft: varios medios en el mismo ticket. */
  function abrirMultiple() {
    if (V.letra === 'X') { avisar('info', 'La X va sólo con efectivo.'); return; }
    /* Con varios medios no va la promo de un medio (el 10 % es pagando TODO en efectivo). */
    var c = cuenta(Object.assign({}, V, { forma: 'multiple' }));
    if (!c.total) { avisar('info', 'Primero cargá los productos.'); return; }
    var filas = (V.multiples && V.multiples.length ? V.multiples : [{ medio: 'efectivo', monto: 0 }, { medio: 'tarjeta', monto: 0, cuotas: 1 }])
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
        : x.medio === 'efectivo' ? '<div class="pos-pago-mas"></div>'
        : '<div class="pos-pago-mas">' + campo('', 'Nº de operación', '<input type="text" data-k="cupon" maxlength="30" value="' + esc(x.cupon || '') + '">') + '</div>';
      return '<div class="pos-pago-fila" data-f="' + i + '">' +
        campo('', 'Medio', '<select data-k="medio">' + opciones(Object.keys(MEDIOS).map(function (k) { return [k, MEDIOS[k]]; }), x.medio) + '</select>') +
        campo('', 'Monto', '<input type="text" inputmode="decimal" data-k="monto" value="' + plataCampo(x.monto) + '">') + mas +
        '<button type="button" class="tk-quitar" data-quitar-pago="' + i + '" title="Quitar este pago" aria-label="Quitar este pago">' + icono('x') + '</button></div>';
    }
    function cuentaTxt() {
      var s = sumaPagos(filas), dif = c.total - s, e = caja.querySelector('#pmCuenta');
      e.className = 'pos-pago-cuenta ' + (dif === 0 ? 'ok' : 'mal');
      e.innerHTML = '<span>Pagos: ' + plata(s) + '</span><span>' + (dif === 0 ? 'Justo' : dif > 0 ? 'Falta ' + plata(dif) : 'Sobra ' + plata(-dif)) + '</span>';
    }
    function pintarFilas() { caja.querySelector('#pmFilas').innerHTML = filas.map(fila).join(''); cuentaTxt(); }
    pintarFilas();
    var lista = caja.querySelector('#pmFilas');
    lista.addEventListener('input', function (e) {
      var f = e.target.closest('[data-f]'), k = e.target.getAttribute('data-k');
      if (!f || !k || k === 'medio') return;
      var x = filas[Number(f.getAttribute('data-f'))];
      if (k === 'monto') { var m = leerPlata(e.target.value); x.monto = isNaN(m) ? 0 : m; cuentaTxt(); }
      else x[k] = e.target.value;
    });
    lista.addEventListener('change', function (e) {
      var f = e.target.closest('[data-f]'), k = e.target.getAttribute('data-k');
      if (!f || !k) return;
      var x = filas[Number(f.getAttribute('data-f'))];
      if (k === 'medio') { x.medio = e.target.value; delete x.tarjeta; delete x.cupon; x.cuotas = 1; pintarFilas(); }
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
      else if (sumaPagos(filas) !== c.total) mal = 'Los pagos tienen que sumar ' + plata(c.total) + '.';
      if (mal) { pintarFilas(); errorEn(caja, 'pmError', mal); return; }
      V.multiples = filas.map(function (x) {
        var p = { medio: x.medio, monto: x.monto };
        if (x.medio === 'tarjeta') { p.tarjeta = x.tarjeta; p.tipo_tarjeta = tipoTarjeta(x.tarjeta); p.cuotas = Number(x.cuotas) || 1; }
        if (x.cupon) p.cupon = String(x.cupon).trim();
        return p;
      });
      V.forma = 'multiple';
      cerrarVentana();
      pintarPago();
      pintar();
    };
  }

  /* ── Guardar ── */
  function guardarVenta() {
    if (S.guardando || !V) return;
    var c = cuenta(V), cl = V.cliente || {};
    var pagos = pagosDe(c.total);
    var mal = !V.local_id ? 'Elegí la sucursal.' :
      !V.vendedor ? 'Elegí quién vende.' :
      !V.lineas.length ? 'La venta no tiene productos.' :
      V.lineas.some(function (l) { return !l.precio; }) ? 'Hay una prenda sin precio: escribilo en «Precio unit.».' :
      V.letra === 'A' && !clienteParaA(V.cliente) ? 'La factura A necesita el cliente con su CUIT: tocá «Cargar».' :
      V.letra === 'X' && V.forma !== 'efectivo' ? 'La X va sólo con efectivo.' :
      V.forma === 'tarjeta' && !V.pago.tarjeta ? 'Elegí qué tarjeta es.' :
      V.forma === 'efectivo' && V.pago.recibido && V.pago.recibido < c.total ? 'Lo recibido en efectivo es menos que el total.' :
      V.forma === 'multiple' && sumaPagos(V.multiples) !== c.total ? 'Los pagos no suman el total: tocá «Cambiar» en Pagos.' : '';
    if (mal) { avisar('err', mal); return; }
    var l0 = localDe(V.local_id);
    var p = {
      clave: V.clave, prueba: enPrueba(), local_id: V.local_id, vendedor: V.vendedor, letra: V.letra, lista_id: V.lista_id,
      cliente_nombre: cl.nombre || '', cliente_doc: cl.doc || '', cliente_condicion: cl.condicion || 'consumidor_final',
      cliente_email: cl.email || '', cliente_tel: cl.tel || '', envio: cl.envio || '', observaciones: V.observaciones || '',
      items: V.lineas.map(function (l) {
        return { codigo: l.codigo || '', descripcion: l.descripcion, talle: l.talle || '', color: l.color || '', cantidad: l.cantidad, precio: aPesos(l.precio) };
      }),
      descuentos: c.descuentos.map(function (d) { return { tipo: d.tipo, promo_id: d.promo_id || '', descripcion: d.descripcion, monto: aPesos(d.monto) }; }),
      pagos: pagos.map(function (x) {
        var y = Object.assign({}, x, { monto: aPesos(x.monto) });
        if (y.recibido) y.recibido = aPesos(y.recibido); else delete y.recibido;
        return y;
      })
    };
    S.guardando = true;
    var b = $('vGuardar');
    if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
    llamar('pos_venta_guardar', { p: p }).then(function (r) {
      S.ultimo = { id: r.id, numero: r.numero, serie: r.serie || 'factura', total: c.total, local: nombreLocal(l0), ya: !!r.ya };
      V = ventaNueva(V);
      guardarBorrador();
      S.guardando = false;
      avisar('ok', nombreVenta(S.ultimo) + ' guardada.');
      if (S.vista === 'venta') verVenta();
    }).catch(function (e) {
      S.guardando = false;
      if (b && b.isConnected) { b.disabled = false; b.innerHTML = textoGuardar(); }
      if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo. La venta sigue armada.'); persona.entrar(); return; }
      avisar('err', esDeRed(e) ? 'No se pudo guardar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!vistaAncha() || _velo || !S.ini) return;
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
  function abrirTicket(id, alCambiar) {
    var caja = ventana('<h3 id="posVentTit">Ticket</h3><p class="cargando">Cargando…</p>', true);
    var dentro = caja.querySelector('.pos-caja-in');
    llamar('pos_venta', { p_id: id }).then(function (t) {
      if (!_velo || !caja.isConnected) return;
      var anulada = t.estado === 'anulada';
      var pagos = (t.pagos || []).map(function (g) {
        var x = MEDIOS[g.medio] || g.medio;
        if (g.medio === 'tarjeta') x += ' ' + (g.tarjeta || '') + (g.cuotas > 1 ? ' · ' + g.cuotas + ' cuotas' : '');
        if (g.cupon) x += ' · ' + (g.medio === 'tarjeta' ? 'cupón ' : 'op. ') + g.cupon;
        if (g.recibido) x += ' · recibido ' + plata(cent(g.recibido)) + ', vuelto ' + plata(cent(g.vuelto || 0));
        return '<li>' + esc(x) + ' — <b>' + plata(cent(g.monto)) + '</b></li>';
      }).join('');
      dentro.innerHTML = '<h3 id="posVentTit">Ticket ' + esc(ref(t)) + ' · ' + esc(LETRAS[t.letra] || t.letra) + ' ' +
          (anulada ? '<span class="pill pill-bad">Anulada</span>' : '<span class="pill pill-ok">Cobrada</span>') +
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
        '</div>' +
        '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Ítem</th><th>Código</th><th>Descripción</th><th class="c">Talle</th><th>Color</th><th class="c">Cant.</th><th class="n">Precio unit.</th><th class="n">Total</th></tr></thead><tbody>' +
          (t.items || []).map(function (i) {
            return '<tr><td>' + ('00' + i.item).slice(-3) + '</td><td>' + esc(i.codigo || '—') + '</td><td>' + esc(i.descripcion) + '</td><td class="c">' + esc(i.talle || '') + '</td>' +
              '<td>' + esc(i.color ? nombreColor(i.color, i.codigo) : '') + '</td><td class="c">' + i.cantidad + '</td><td class="n">' + plata(cent(i.precio)) + '</td><td class="n">' + plata(cent(i.total)) + '</td></tr>';
          }).join('') +
          (t.descuentos_detalle || []).map(function (d) {
            return '<tr><td></td><td colspan="6">' + esc(d.descripcion) + '</td><td class="n">−' + plata(cent(d.monto)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        '<div class="pos-ticket-tot"><span>Neto ' + plata(cent(t.neto)) + (Number(t.descuentos) ? ' · Descuentos −' + plata(cent(t.descuentos)) : '') + '</span><b>Total ' + plata(cent(t.total)) + '</b></div>' +
        (pagos ? '<p class="pos-lbl" style="margin:10px 0 4px">Pagos</p><ul style="margin:0;padding-left:18px;font-size:14px;display:grid;gap:3px">' + pagos + '</ul>' : '') +
        (t.observaciones ? '<p style="font-size:14px;margin:10px 0 0"><b>Observaciones:</b> ' + esc(t.observaciones) + '</p>' : '') +
        (anulada ? '<div class="pos-cartel mal" style="margin-top:12px">Anulada el ' + esc(fechaHora(t.anulada_en)) + (t.anulada_por_nombre ? ' por ' + esc(t.anulada_por_nombre) : '') + ': ' + esc(t.anulada_motivo || '') + '</div>' : '') +
        '<div id="tkAnular"></div>' +
        '<div class="pos-pie">' + (anulada ? '' : '<button type="button" class="btn btn-sec btn-chico izq" id="tkAnularBtn">Anular la venta</button>') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var ab = dentro.querySelector('#tkAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        var z = dentro.querySelector('#tkAnular');
        z.innerHTML = '<div class="pos-cartel" style="margin-top:12px">La venta queda en la lista, tachada, con quién la anuló y por qué. No se puede deshacer.' +
          campo('', '¿Por qué se anula?', '<textarea id="tkMotivo" maxlength="300" rows="2"></textarea>') + '<div class="pos-error" id="tkError"></div>' +
          '<div class="pos-pie"><button type="button" class="btn btn-pri btn-chico" id="tkConfirmar">Anular la venta ' + esc(ref(t)) + '</button></div></div>';
        var m = z.querySelector('#tkMotivo');
        m.focus();
        z.querySelector('#tkConfirmar').onclick = function () {
          var motivo = m.value.trim(), bt = this;
          if (!errorEn(dentro, 'tkError', motivo.length < 3 ? 'Escribí por qué se anula.' : '')) return;
          bt.disabled = true;
          llamar('pos_venta_anular', { p_id: t.id, p_motivo: motivo }).then(function () {
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
     TICKETS (el listado de BlueSoft)
     ════════════════════════════════════════════════════════════════════ */
  /** "Borrar las pruebas" (en Tickets y en Cambios): las ventas y los cambios de prueba, con su caja de prueba. */
  function borrarPruebas(loc, bt, despues) {
    var l = loc && localDe(loc);
    if (!confirm('¿Borrar ' + (l ? 'las pruebas de ' + nombreLocal(l) : 'todas las pruebas') +
                 ' (ventas y cambios, de cualquier día), con su caja de prueba? Las de verdad no se tocan. No se puede deshacer.')) return;
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
    c.innerHTML = cabeza('Tickets' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), 'Las ventas del POS de todas las sucursales.',
        '<button type="button" class="btn btn-sec btn-chico" id="tkBorrar" hidden>Borrar las pruebas</button>' +
        '<button type="button" class="btn btn-pri btn-chico" data-ir="venta">Nueva venta</button>' +
        '<button type="button" class="btn btn-sec btn-chico" data-ir="cambio" title="Ticket de cambio: lo que vuelve y lo que se lleva">Cambio</button>' +
        '<a class="btn btn-sec btn-chico" href="index.html?volver=pos" title="El No Compra">Venta fallida</a>') +
      '<div class="pos-filtros"><div id="tkPer"></div>' +
        campo('', 'Sucursal', '<select id="tkLocal"><option value="">Todas</option>' + opciones(S.ini.locales.map(function (l) { return [l.id, nombreLocal(l)]; }), '') + '</select>') +
        campo('', 'Vendedor', '<select id="tkVend"><option value="">Todos</option>' + opciones(Object.keys(todos).sort().map(function (n) { return [n, n]; }), '') + '</select>') +
        campo('', 'Comprobante', '<select id="tkLetra"><option value="">Todos</option>' + opciones([['A', LETRAS.A], ['B', LETRAS.B], ['X', LETRAS.X]], '') + '</select>') +
        campo('', 'Forma de pago', '<select id="tkMedio"><option value="">Todas</option>' + opciones(Object.keys(MEDIOS).map(function (k) { return [k, MEDIOS[k]]; }), '') + '</select>') +
        campo('', 'Estado', '<select id="tkEstado"><option value="">Todos</option><option value="cobrada">Cobradas</option><option value="anulada">Anuladas</option></select>') +
        /* Las de verdad y las de prueba no se mezclan nunca; con el modo prueba prendido arranca en las de prueba. */
        campo('', 'Ventas', '<select id="tkPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="tkLista"><p class="cargando">Cargando…</p></div>';
    c.querySelectorAll('.pos-acciones [data-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; });
    var per = Interfaz.periodo($('tkPer'), { inicial: 'hoy', guardar: 'pos_tickets_periodo', hastaHoy: true, alCambiar: cargar });
    ['tkLocal', 'tkVend', 'tkLetra', 'tkMedio', 'tkEstado', 'tkPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('tkBorrar').onclick = function () { borrarPruebas($('tkLocal').value, this, cargar); };
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
      }).catch(function (e) { if ($('tkLista')) $('tkLista').innerHTML = '<div class="pos-cartel mal">' + esc(mensajeDe(e)) + '</div>'; });
    }
    function pintarTickets(d) {
      var t = d.totales || {}, pl = d.por_letra || {};
      var letras = ['A', 'B', 'X'].filter(function (l) { return pl[l] != null; });
      var porLetra = letras.length ? '<p class="pos-por-letra">' + letras.map(function (l) {
        return '<span>' + esc(LETRAS[l]) + ' <b>' + plata(cent(pl[l])) + '</b></span>'; }).join('') + '</p>' : '';
      var aviso = deLaPrueba() ? '<div class="pos-cartel prueba">Las ventas de <b>prueba</b>: no cuentan en ningún total de verdad. ' +
        '«Borrar las pruebas» las borra' + ($('tkLocal').value ? ' (las de esa sucursal)' : ' todas') + ', de cualquier día.</div>' : '';
      var kpis = '<div class="pos-totales">' +
        '<div class="pos-kpi"><span>Tickets</span><b>' + (t.tickets || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Productos</span><b>' + (t.productos || 0) + '</b></div>' +
        '<div class="pos-kpi"><span>Neto</span><b>' + plata(cent(t.neto || 0)) + '</b></div>' +
        '<div class="pos-kpi"><span>Descuentos</span><b>' + plata(cent(t.descuentos || 0)) + '</b></div>' +
        '<div class="pos-kpi fuerte"><span>Total</span><b>' + plata(cent(t.total || 0)) + '</b></div>' +
        (t.anulados ? '<div class="pos-kpi"><span>Anulados</span><b>' + t.anulados + '</b></div>' : '') + '</div>' + porLetra + aviso;
      if (!d.filas || !d.filas.length) {
        $('tkLista').innerHTML = kpis + '<div class="pos-cartel">' + (deLaPrueba() ? 'No hay ventas de prueba en ese período con esos filtros.' : 'No hay ventas en ese período con esos filtros.') + '</div>';
        return;
      }
      $('tkLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th class="n">Referencia</th><th>Sucursal</th><th>Vendedor</th>' +
        '<th>Cliente</th><th>Comprobante</th><th>Forma de pago</th><th>Estado</th><th class="n">Cant.</th><th class="n">Total</th><th>ARCA</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var an = f.estado === 'anulada', clases = (an ? 'anulada ' : '') + (f.prueba ? 'prueba' : '');
          return '<tr data-ticket="' + esc(f.id) + '" tabindex="0"' + (clases.trim() ? ' class="' + clases.trim() + '"' : '') + '><td>' + esc(fechaHora(f.fecha)) + '</td><td class="n">' + esc(refCorta(f)) + '</td>' +
            '<td>' + esc(bonito(f.local)) + '</td><td>' + esc(f.vendedor) + '</td><td>' + esc(f.cliente) + '</td><td>' + esc(LETRAS[f.letra] || f.letra) + '</td>' +
            '<td>' + esc((f.medios || []).map(function (m) { return MEDIOS[m] || m; }).join(' + ') || '—') + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulada</span>' : '<span class="pill pill-ok">Cobrada</span>') + '</td>' +
            '<td class="n">' + f.cantidad + '</td><td class="n tachar"><b>' + plata(cent(f.total)) + '</b></td>' +
            (f.letra === 'X' || f.prueba ? '<td class="apagado" title="' + (f.prueba ? 'Es una prueba' : 'La X es un comprobante interno') + '">No va</td>'
              : '<td class="apagado" title="Por ahora la factura la hace BlueSoft">' + (f.factura ? 'Con CAE' : '—') + '</td>') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven las últimas 500. Achicá el período para ver el resto.</p>' : '');
      $('tkLista').querySelectorAll('tr[data-ticket]').forEach(function (tr) {
        tr.onclick = function () { abrirTicket(tr.getAttribute('data-ticket'), cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
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
    var l = (antes && localDe(antes.local_id)) || localInicial();
    return { v: 1, clave: nuevaClave(), local_id: l ? l.id : null, vendedor: antes ? antes.vendedor : vendedorInicial(l),
             lista_id: listaDe(l), cliente: '', vuelve: [], sale: [], forma: 'efectivo', pago: {}, observaciones: '' };
  }
  function cargarCambio() {
    var b = leerJSON(K_CAMBIO, null);
    if (b && b.v === 1 && b.clave && Array.isArray(b.vuelve) && Array.isArray(b.sale) && localDe(b.local_id) && listaPorId(b.lista_id)) {
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
          campo('c6', 'Sucursal', '<select id="cbLocal"></select>') +
          campo('c3', 'Depósito', '<input type="text" value="Ventas" readonly title="El stock todavía no está en el POS">') +
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
    asegurarPrecios(CB.lista_id).then(function () { pintarCambio(); }, function (e) { pintarCambio(); avisar('err', 'No se pudieron traer los precios: ' + mensajeDe(e)); });
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
      if (!pl) avisar('info', p[1] + ' no tiene precio en esta lista: escribilo en «Precio unit.».');
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
          '<td class="tk-cod">' + esc(l.codigo || '—') + '</td><td class="tk-desc">' + esc(l.descripcion) + '</td>' +
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
        campo('', 'Sucursal', '<select id="cmLocal"><option value="">Todas</option>' + opcionesLocales('') + '</select>') +
        /* Los de verdad y los de prueba no se mezclan nunca; con el modo prueba prendido arranca en los de prueba. */
        campo('', 'Cambios', '<select id="cmPrueba"><option value="">De verdad</option><option value="1"' + (prueba ? ' selected' : '') + '>De prueba</option></select>') +
      '</div><div id="cmLista"><p class="cargando">Cargando…</p></div>';
    c.querySelector('[data-ir="cambio"]').onclick = function () { ir('cambio'); };
    var per = Interfaz.periodo($('cmPer'), { inicial: 'hoy', guardar: 'pos_cambios_periodo', hastaHoy: true, alCambiar: cargar });
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
            '<td>' + esc((f.medios || []).map(function (m) { return MEDIOS[m] || m; }).join(' + ') || '—') + '</td>' +
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
        '<div class="pos-pie">' + (an || t.cierre ? '' : '<button type="button" class="btn btn-sec btn-chico izq" id="cbAnularBtn">Anular el cambio</button>') +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>';
      var ab = dentro.querySelector('#cbAnularBtn');
      if (ab) ab.onclick = function () {
        ab.remove();
        pedirMotivo(dentro.querySelector('#cbAnular'), 'El cambio queda en la lista, tachado, con quién lo anuló y por qué' +
            (Number(t.diferencia) ? ', y lo que se cobró sale de la caja' : '') + '. No se puede deshacer.', 'Anular el cambio ' + refCambio(t), function (motivo) {
          return llamar('pos_cambio_anular', { p_id: t.id, p_motivo: motivo }).then(function () {
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
     ════════════════════════════════════════════════════════════════════ */
  var TIPOS_MOV = { gasto: 'Gasto del local', salida: 'Otra salida', ingreso: 'Otro ingreso', caja_fuerte: 'A la caja fuerte' };
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
  /** El desvío en palabras. En centavos; positivo = falta plata (como en Supervisión → Cajas). */
  function desvioDe(dv, tol) {
    var a = Math.abs(dv);
    if (!dv) return { cls: 'ok', txt: 'Cuadra justo', corto: 'Cuadra' };
    if (a <= tol) return { cls: 'ok', txt: 'Cuadra (' + (dv > 0 ? 'faltan ' : 'sobran ') + plata(a) + ')', corto: (dv > 0 ? '−' : '+') + plata(a) };
    return dv > 0 ? { cls: 'mal', txt: 'Faltan ' + plata(a), corto: 'Faltan ' + plata(a) } : { cls: 'warn', txt: 'Sobran ' + plata(a), corto: 'Sobran ' + plata(a) };
  }
  function recordarLocal(id) { var r = recuerdo(); r.local = id; guardarJSON(K_RECUERDO, r); }
  function filaRes(lbl, valor, cls) { return '<div class="cj-r' + (cls ? ' ' + cls : '') + '"><span>' + lbl + '</span><b>' + valor + '</b></div>'; }
  function opcionesLocales(actual) { return opciones(S.ini.locales.map(function (l) { return [l.id, nombreLocal(l)]; }), actual); }

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
    var l = localDe(S.cajaLocal) || localInicial();
    S.cajaLocal = l.id;
    /* d: la caja abierta (sin el efectivo); k: lo que devolvió el conteo (con el efectivo). */
    var K = { d: null, k: null, clave: nuevaClave() }, pedido = 0;
    c.innerHTML = cabeza('Cierre de caja' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), '<span id="cjSub">Cargando…</span>',
        '<div id="cjHecho"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="cjGasto">Agregar gasto…</button>' +
        '<a class="btn btn-sec btn-chico" href="gestion.html#cierres" title="Los cierres anteriores, en Gestión">Ver los cierres</a>') +
      '<div class="cj">' +
        '<section class="cj-izq" aria-label="Los pasos del cierre">' +
          '<div class="tk-datos cj-datos">' +
            campo('c3', 'Fecha', '<input type="text" id="cjFecha" readonly>') +
            campo('c5', 'Sucursal', '<select id="cjLocal">' + opcionesLocales(l.id) + '</select>') +
            campo('c4', 'Número', '<input type="text" id="cjNum" readonly title="Uno seguido por sucursal">') +
            campo('c4', 'Caja', '<input type="text" value="Caja chica" readonly>') +
            campo('c8', 'Responsable', '<input type="text" id="cjResp" readonly title="Quien entró al POS">') +
          '</div>' +
          '<div class="cj-paso" id="cjPaso1"><div class="cj-paso-cab"><b>Paso 1</b><span>Ingresá el total de efectivo que hay en el local</span></div>' +
            '<div class="cj-fila"><div class="cj-saldo" id="cjSaldoIni"></div>' +
              campo('cj-monto', 'Total efectivo', '<input type="text" inputmode="decimal" id="cjContado" autocomplete="off" placeholder="$0">') +
              '<button type="button" class="btn btn-pri btn-chico" id="cjContar">Ver la cuenta</button></div>' +
            '<div class="cj-cuenta" id="cjCuenta" aria-live="polite"></div></div>' +
          '<div class="cj-paso" id="cjPaso2"><div class="cj-paso-cab"><b>Paso 2</b><span>Ingresá el efectivo que pasa a la caja fuerte</span></div>' +
            '<div class="cj-fila">' + campo('cj-monto', 'A la caja fuerte', '<input type="text" inputmode="decimal" id="cjRetiro" autocomplete="off" placeholder="$0">') +
              '<p class="cj-queda" id="cjQueda"></p></div>' +
            campo('', 'Observaciones', '<textarea id="cjObs" maxlength="500" rows="2"></textarea>', ' id="cjObsL"') + '</div>' +
          '<div class="cj-paso cj-paso-fin" id="cjPaso3"><div class="cj-paso-cab"><b>Paso 3</b><span id="cjPaso3Txt"></span></div>' +
            '<div class="cj-botones"><button type="button" class="btn btn-sec btn-chico" id="cjCancelar">Cancelar</button>' +
              '<button type="button" class="btn btn-pri btn-chico" id="cjCerrar">Cerrar caja</button></div></div>' +
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
      if ($('cjSaldo')) { $('cjSaldo').value = saldo; $('cjSaldo').oninput = olvidarCuenta; }
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
    /* Los resultados: antes de contar, sin el efectivo; después, con todo (lo que devolvió el conteo, más nuevo). */
    function pintarRes() {
      var d = K.d, k = K.k;
      if (!d) return;
      var x = k || d, v = x.ventas, p = function (n) { return plata(cent(n || 0)); };
      var nm = (d.movimientos || []).length, nc = Number(x.cambios) || 0;
      $('cjRes').innerHTML = '<h3 class="cj-res-tit">Resultados del día</h3>' +
        filaRes('Saldo inicial', d.primer ? (k ? p(k.saldo_inicial) : '<i class="cj-oculto">en el Paso 1</i>') : p(d.saldo_inicial), 'fuerte') +
        filaRes('Ventas Tarjeta', p(v.tarjeta)) +
        filaRes('Ventas Transferencia', p(v.transferencia)) +
        filaRes('Ventas Efectivo', k ? p(v.efectivo) : OCULTO) +
        filaRes('Ventas Mercado Pago', p(v.mercadopago)) +
        filaRes('Ventas MODO', p(v.modo)) +
        filaRes('Ventas Go Cuotas', p(v.go_cuotas)) +
        filaRes('Ventas totales del día', k ? p(k.ventas_total) : OCULTO, 'barra') +
        '<button type="button" class="cj-r cj-r-btn" id="cjMovs" title="Ver, agregar o anular los gastos de esta caja"><span>Gastos en efectivo' +
          (nm ? ' (' + nm + ')' : '') + '</span><b>' + p(x.gastos) + '</b></button>' +
        filaRes('Otras salidas', p(x.otras_salidas)) +
        filaRes('Descuentos', p(x.descuentos), 'info') +
        filaRes('Otros ingresos', p(x.otros_ingresos)) +
        filaRes('Saldo final en efectivo', k ? p(k.esperado) : OCULTO, 'barra') +
        /* Los cambios van en el pie y no en un renglón: con uno más, el cierre no entra en la PC del local. Lo cobrado, recién al contar. */
        '<p class="cj-res-pie">' + x.tickets + (Number(x.tickets) === 1 ? ' ticket' : ' tickets') +
          (nc ? ' y ' + nc + (nc === 1 ? ' cambio' : ' cambios') + (k ? ' (se cobró ' + p(k.cambios_diferencia) + ', ya sumado en las ventas)' : '') : '') +
          '. Los descuentos ya están restados de las ventas.</p>';
      $('cjMovs').onclick = abrirMovsCaja;
    }
    function pintarPasos() {
      var k = K.k, hay = !!k;
      $('cjPaso2').classList.toggle('apagado', !hay);
      $('cjPaso3').classList.toggle('apagado', !hay);
      $('cjRetiro').disabled = !hay;
      $('cjObs').disabled = !hay;
      $('cjCerrar').disabled = !hay;
      $('cjPaso3Txt').textContent = hay ? 'Cerrá la caja' : 'Primero contá el efectivo (Paso 1)';
      var obsL = $('cjObsL').firstChild;
      if (!hay) {
        var n = K.d ? Number(K.d.conteos) : 0;
        $('cjCuenta').innerHTML = '<p class="pos-ayuda">' + (n ? 'Esta caja ya se contó ' + (n === 1 ? 'una vez' : n + ' veces') + ': cada conteo queda anotado.'
          : 'Contá la plata del cajón y escribila. Recién ahí se ve cuánto tendría que haber.') + '</p>';
        obsL.textContent = 'Observaciones';
      } else {
        var dv = desvioDe(cent(k.desvio), cent(k.tolerancia));
        $('cjCuenta').innerHTML = '<div class="cj-dif ' + dv.cls + '"><b>' + esc(dv.txt) + '</b><span>Tendría que haber ' + plata(cent(k.esperado)) +
          ' y contaste ' + plata(cent(k.contado)) + '.' + (k.conteos > 1 ? ' Se contó ' + k.conteos + ' veces.' : '') + '</span></div>';
        obsL.textContent = dv.cls === 'ok' ? 'Observaciones' : 'Observaciones: ¿por qué ' + (cent(k.desvio) > 0 ? 'falta' : 'sobra') + '?';
      }
      pintarRes();
      pintarQueda();
    }
    function pintarQueda() {
      var q = $('cjQueda'), k = K.k;
      if (!k) { q.className = 'cj-queda'; q.innerHTML = ''; return; }
      var t = $('cjRetiro').value.trim(), r = t ? leerPlata(t) : 0, cont = cent(k.contado);
      if (isNaN(r)) { q.className = 'cj-queda mal'; q.textContent = 'Escribí un número.'; return; }
      if (r > cont) { q.className = 'cj-queda mal'; q.textContent = 'Es más de lo que hay (' + plata(cont) + ').'; return; }
      q.className = 'cj-queda';
      q.innerHTML = 'Queda en la caja chica: <b>' + plata(cont - r) + '</b><small>Es el saldo inicial del próximo cierre.</small>';
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
        $('cjRetiro').focus();
      }).catch(function (e) { b.disabled = false; avisar('err', mensajeDe(e)); });
    }

    function cerrar() {
      var k = K.k;
      if (!k || S.guardando) return;
      var t = $('cjRetiro').value.trim(), r = t ? leerPlata(t) : 0;
      if (isNaN(r)) { avisar('err', 'Lo que pasa a la caja fuerte no es un número.'); $('cjRetiro').focus(); return; }
      if (r > cent(k.contado)) { avisar('err', 'No se puede pasar a la caja fuerte más de lo que hay.'); $('cjRetiro').focus(); return; }
      var obs = $('cjObs').value.trim(), dv = desvioDe(cent(k.desvio), cent(k.tolerancia));
      if (dv.cls !== 'ok' && !obs && !confirm(dv.txt + ' y no escribiste nada en Observaciones. ¿Cerrar la caja igual?')) { $('cjObs').focus(); return; }
      S.guardando = true;
      var b = $('cjCerrar');
      b.disabled = true;
      b.textContent = 'Cerrando…';
      llamar('pos_caja_cerrar', { p: { clave: K.clave, local_id: S.cajaLocal, prueba: prueba, contado: k.contado, retiro: aPesos(r), observaciones: obs } }).then(function (x) {
        S.guardando = false;
        S.cajaHecho = { id: x.id, numero: x.numero, prueba: !!x.prueba, desvio: cent(x.desvio), queda: cent(x.queda), local: S.cajaLocal, tol: cent(k.tolerancia) };
        avisar('ok', 'Caja cerrada: cierre ' + refCierre(x) + '.');
        if (S.vista === 'cierre') verCierre();
      }).catch(function (e) {
        S.guardando = false;
        if (b.isConnected) { b.disabled = false; b.textContent = 'Cerrar caja'; }
        if (e && e.sinSesion) { avisar('err', 'Se cerró tu sesión: entrá de nuevo.'); persona.entrar(); return; }
        avisar('err', esDeRed(e) ? 'No se pudo cerrar: sin conexión. Probá de nuevo; no se duplica.' : mensajeDe(e));
      });
    }

    /* Los gastos de la caja abierta: verlos, agregar y anular. */
    function abrirMovsCaja() {
      var ms = (K.d && K.d.movimientos) || [];
      var caja = ventana('<h3 id="posVentTit">Gastos de la caja</h3><p class="pos-bajada">Los de ' + esc(nombreLocal(localDe(S.cajaLocal))) +
          ' desde el último cierre: entran en este.</p>' +
        (ms.length ? '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Hora</th><th>Qué es</th><th>Detalle</th><th>Cargó</th><th class="n">Monto</th><th><span class="sr">Anular</span></th></tr></thead><tbody>' +
          ms.map(function (x) {
            return '<tr><td>' + esc(fechaHora(x.fecha)) + '</td><td>' + esc(TIPOS_MOV[x.tipo] || x.tipo) + '</td><td>' + esc([x.rubro, x.descripcion].filter(Boolean).join(' · ')) + '</td>' +
              '<td>' + esc(x.persona || '') + '</td><td class="n">' + (x.tipo === 'ingreso' ? '+' : '−') + plata(cent(x.monto)) + '</td>' +
              '<td class="pos-acc"><button type="button" class="pos-link" data-anular="' + esc(x.id) + '">Anular</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="pos-cartel">Todavía no hay gastos en esta caja.</div>') +
        '<div id="cjAnular"></div>' +
        '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico izq" id="cjNuevoGasto">Agregar gasto…</button>' +
          '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Listo</button></div>', true);
      caja.querySelector('#cjNuevoGasto').onclick = function () { abrirMovimiento(S.cajaLocal, prueba, cargar); };
      caja.querySelectorAll('[data-anular]').forEach(function (b) {
        b.onclick = function () {
          var x = ms.filter(function (y) { return y.id === b.getAttribute('data-anular'); })[0];
          pedirMotivo(caja.querySelector('#cjAnular'), 'Anular «' + esc([x.rubro, x.descripcion].filter(Boolean).join(' · ')) + '» de ' + plata(cent(x.monto)) +
              ': queda en la lista, tachado, con quién lo anuló y por qué.', 'Anular', function (motivo) {
            return llamar('pos_caja_mov_anular', { p_id: x.id, p_motivo: motivo }).then(function () {
              avisar('ok', 'Listo: quedó anulado.');
              cerrarVentana();
              cargar();
            });
          });
        };
      });
    }

    $('cjLocal').onchange = function () { S.cajaLocal = this.value; recordarLocal(this.value); $('cjContado').value = ''; $('cjRetiro').value = ''; cargar(); };
    $('cjContado').oninput = olvidarCuenta;
    $('cjContado').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); contar(); } };
    $('cjContar').onclick = contar;
    $('cjRetiro').oninput = pintarQueda;
    $('cjCancelar').onclick = function () {
      K.k = null;
      $('cjContado').value = '';
      $('cjRetiro').value = '';
      $('cjObs').value = '';
      pintarPasos();
      $('cjContado').focus();
    };
    $('cjCerrar').onclick = cerrar;
    $('cjGasto').onclick = function () { abrirMovimiento(S.cajaLocal, prueba, cargar); };
    cargar();
    if (window.matchMedia && matchMedia('(min-width: 1000px)').matches) setTimeout(function () { var x = $('cjContado'); if (x) x.focus(); }, 0);
  }

  /* Un gasto del local, otra salida u otro ingreso de la caja chica ("Agregar gasto…" de BlueSoft). */
  function abrirMovimiento(localId, prueba, alGuardar) {
    var clave = nuevaClave(), tipo = 'gasto', enGestion = MODO === 'gestion';
    var caja = ventana('<h3 id="posVentTit">' + (prueba ? 'Gasto de prueba' : 'Agregar gasto') + '</h3>' +
      '<p class="pos-bajada">Sale de la caja chica, en efectivo, y entra en el próximo cierre.</p>' +
      '<div class="chips" id="gmTipo" role="group" aria-label="Qué es">' + ['gasto', 'salida', 'ingreso'].map(function (t) {
        return '<button type="button" class="chip" data-tipo="' + t + '">' + TIPOS_MOV[t] + '</button>'; }).join('') + '</div>' +
      '<div class="pos-campos" style="margin-top:10px">' +
        campo('ancho', 'Sucursal', '<select id="gmLocal"' + (enGestion ? '' : ' disabled title="La de la caja que estás cerrando"') + '>' + opcionesLocales(localId) + '</select>') +
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
      llamar('pos_caja_mov_guardar', { p: { clave: clave, local_id: loc, prueba: !!prueba, tipo: tipo, rubro: tipo === 'gasto' ? rubro : '', descripcion: desc, monto: aPesos(monto) } }).then(function () {
        avisar('ok', 'Anotado: ' + TIPOS_MOV[tipo].toLowerCase() + ', ' + plata(monto) + '.');
        cerrarVentana();
        if (alGuardar) alGuardar();
      }).catch(function (e) { bt.disabled = false; errorEn(caja, 'gmError', mensajeDe(e)); });
    }
    caja.querySelector('#gmGuardar').onclick = guardarMov;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardarMov(); } });
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
            filaRes('Ventas totales del día', p(c.ventas_total), 'barra') +
            filaRes('Gastos en efectivo', p(c.gastos)) + filaRes('Otras salidas', p(c.otras_salidas)) +
            filaRes('Descuentos', p(c.descuentos), 'info') +
            (c.cambios ? filaRes('Cobrado en cambios (' + c.cambios + ')', p(c.cambios_diferencia), 'info') : '') +
            filaRes('Otros ingresos', p(c.otros_ingresos)) +
            filaRes('Saldo final en efectivo', p(c.esperado), 'barra') + '</div>' +
          '<div class="cj-det-der">' +
            '<div class="cj-dif ' + dv.cls + '"><b>' + esc(dv.txt) + '</b><span>Tendría que haber ' + p(c.esperado) + ' y contaron ' + p(c.contado) + '.</span></div>' +
            '<div class="cj-res">' + filaRes('Contado', p(c.contado)) + filaRes('A la caja fuerte', p(c.retiro)) +
              filaRes('Queda en la caja chica', p(c.queda), 'barra') + '</div>' +
            (conteos.length > 1 ? '<p class="pos-lbl">Se contó ' + conteos.length + ' veces</p><ul class="cj-lista">' + conteos.map(function (k) {
              return '<li>' + esc(fechaHora(k.fecha)) + ' — ' + p(k.contado) + (k.persona ? ' (' + esc(k.persona) + ')' : '') + '</li>'; }).join('') + '</ul>' : '') +
            (movs.length ? '<p class="pos-lbl">Gastos y movimientos</p><ul class="cj-lista">' + movs.map(function (m) {
              return '<li' + (m.estado === 'anulado' ? ' class="tachado"' : '') + '>' + esc(TIPOS_MOV[m.tipo] || m.tipo) + ': ' + esc([m.rubro, m.descripcion].filter(Boolean).join(' · ')) +
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
        pedirMotivo(dentro.querySelector('#ciAnular'), 'El cierre queda en la lista, tachado. Sus ventas, sus cambios y sus gastos vuelven a la caja abierta, para cerrarla de nuevo.',
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
        campo('', 'Sucursal', '<select id="ciLocal"><option value="">Todas</option>' + opcionesLocales('') + '</select>') +
        campo('', 'Cierres', '<select id="ciPrueba"><option value="">De verdad</option><option value="1">De prueba</option></select>') +
      '</div><div id="ciLista"><p class="cargando">Cargando…</p></div>';
    var per = Interfaz.periodo($('ciPer'), { inicial: 'mes', guardar: 'pos_cierres_periodo', hastaHoy: true, alCambiar: cargar });
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
        (t.cierres ? '<div class="pos-kpi"><span>Diferencias</span><b class="cj-kpi-dif">' + esc(dif) + '</b></div>' : '') + '</div>' +
        ($('ciPrueba').value === '1' ? '<div class="pos-cartel prueba">Los cierres de <b>prueba</b>: no cuentan para nada. Se borran con «Borrar las pruebas», en POS → Tickets.</div>' : '');
      if (!d.filas || !d.filas.length) { $('ciLista').innerHTML = kpis + '<div class="pos-cartel">No hay cierres en ese período.</div>'; return; }
      /* Las columnas de BlueSoft, apretadas para que entren en 1366: el número con la fecha, la sucursal
         con quién cerró, y "Anulado" en la diferencia. Lo que queda en la caja chica está en el detalle. */
      $('ciLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla cj-tabla"><thead><tr><th>Cierre</th><th>Sucursal</th>' +
        '<th class="n">Inicial</th><th class="n">Ventas</th><th class="n">Efectivo</th><th class="n">Tarjeta</th><th class="n">Mercado Pago</th>' +
        '<th class="n" title="MODO, Go Cuotas y transferencias">Otros</th><th class="n" title="Gastos y otras salidas">Gastos</th><th class="n">Contado</th><th>Diferencia</th><th class="n">Caja fuerte</th></tr></thead><tbody>' +
        d.filas.map(function (f) {
          var an = f.estado === 'anulada', dv = desvioDe(cent(f.desvio), cent(f.tolerancia));
          return '<tr data-cierre="' + esc(f.id) + '" tabindex="0" class="' + (an ? 'anulada ' : '') + (f.prueba ? 'prueba' : '') + '">' +
            '<td><b>' + esc(refCierre(f)) + '</b><small>' + esc(fechaHora(f.fecha)) + '</small></td>' +
            '<td>' + esc(bonito(f.local)) + '<small>' + esc(f.responsable_nombre || '—') + '</small></td>' +
            '<td class="n">' + p(f.saldo_inicial) + '</td><td class="n tachar"><b>' + p(f.ventas_total) + '</b></td><td class="n">' + p(f.ventas_efectivo) + '</td>' +
            '<td class="n">' + p(f.ventas_tarjeta) + '</td><td class="n">' + p(f.ventas_mercadopago) + '</td>' +
            '<td class="n">' + p(Number(f.ventas_modo) + Number(f.ventas_go_cuotas) + Number(f.ventas_transferencia)) + '</td>' +
            '<td class="n">' + p(Number(f.gastos) + Number(f.otras_salidas)) + '</td><td class="n">' + p(f.contado) + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="cj-dv ' + dv.cls + '">' + esc(dv.corto) + '</span>' +
              (f.conteos > 1 ? ' <small class="cj-veces" title="Contaron ' + f.conteos + ' veces">×' + f.conteos + '</small>' : '')) + '</td>' +
            '<td class="n tachar">' + p(f.retiro) + '</td></tr>';
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
    c.innerHTML = cabeza('Movimientos de caja', 'Los gastos de cada local, las otras entradas y salidas de la caja chica, y lo que pasó a la caja fuerte en cada cierre.',
        '<button type="button" class="btn btn-pri btn-chico" id="mvNuevo">Agregar gasto…</button>') +
      '<div class="pos-filtros"><div id="mvPer"></div>' +
        campo('', 'Sucursal', '<select id="mvLocal"><option value="">Todas</option>' + opcionesLocales('') + '</select>') +
        campo('', 'Tipo', '<select id="mvTipo"><option value="">Todos</option>' + opciones(Object.keys(TIPOS_MOV).map(function (k) { return [k, TIPOS_MOV[k]]; }), '') + '</select>') +
        campo('', 'Movimientos', '<select id="mvPrueba"><option value="">De verdad</option><option value="1">De prueba</option></select>') +
      '</div><div id="mvLista"><p class="cargando">Cargando…</p></div>';
    var per = Interfaz.periodo($('mvPer'), { inicial: 'mes', guardar: 'pos_movimientos_periodo', hastaHoy: true, alCambiar: cargar });
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
        '<div class="pos-kpi fuerte"><span>A la caja fuerte</span><b>' + p(t.caja_fuerte) + '</b></div></div>' +
        ($('mvPrueba').value === '1' ? '<div class="pos-cartel prueba">Los movimientos de <b>prueba</b>: no cuentan para nada.</div>' : '');
      if (!d.filas || !d.filas.length) { $('mvLista').innerHTML = kpis + '<div class="pos-cartel">No hay movimientos en ese período con esos filtros.</div>'; return; }
      $('mvLista').innerHTML = kpis + '<div class="pos-marco-tabla"><table class="pos-tabla"><thead><tr><th>Fecha</th><th>Sucursal</th><th>Tipo</th><th>Detalle</th>' +
        '<th>Cargó</th><th>Cierre</th><th>Estado</th><th class="n">Monto</th></tr></thead><tbody>' +
        d.filas.map(function (f, i) {
          var an = f.estado !== 'ok', cierre = f.cierre ? refCierre(f.cierre) + (f.cierre.estado === 'anulada' ? ' (anulado)' : '') : 'Caja abierta';
          return '<tr data-mov="' + i + '" tabindex="0" class="' + (an ? 'anulada ' : '') + ($('mvPrueba').value === '1' ? 'prueba' : '') + '">' +
            '<td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(bonito(f.local)) + '</td><td>' + esc(TIPOS_MOV[f.tipo] || f.tipo) + '</td>' +
            '<td>' + esc(f.origen === 'cierre' ? 'Del cierre ' + refCierre(f.cierre) : [f.rubro, f.descripcion].filter(Boolean).join(' · ')) + '</td>' +
            '<td>' + esc(f.persona || '—') + '</td><td>' + esc(f.origen === 'cierre' ? '—' : cierre) + '</td>' +
            '<td>' + (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Vale</span>') + '</td>' +
            '<td class="n tachar"><b>' + (f.tipo === 'ingreso' ? '+' : '−') + p(f.monto) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.mas ? '<p class="pos-mas">Se ven los últimos 500. Achicá el período para ver el resto.</p>' : '');
      $('mvLista').querySelectorAll('tr[data-mov]').forEach(function (tr) {
        var f = d.filas[Number(tr.getAttribute('data-mov'))];
        tr.onclick = function () { if (f.origen === 'cierre') abrirCierre(f.id, cargar); else abrirMovDetalle(f, cargar); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); tr.onclick(); } };
      });
    }
    cargar();
  }

  /** Un gasto del listado: se ve, y se anula mientras su caja sigue abierta. */
  function abrirMovDetalle(f, alCambiar) {
    var an = f.estado !== 'ok', abierto = !f.cierre;
    var caja = ventana('<h3 id="posVentTit">' + esc(TIPOS_MOV[f.tipo] || f.tipo) + ' · ' + plata(cent(f.monto)) + ' ' +
        (an ? '<span class="pill pill-bad">Anulado</span>' : '<span class="pill pill-ok">Vale</span>') + '</h3>' +
      '<div class="pos-ticket-datos">' +
        '<div><span>Fecha</span>' + esc(fechaHora(f.fecha)) + '</div>' +
        '<div><span>Sucursal</span>' + esc(bonito(f.local)) + '</div>' +
        '<div><span>Cargó</span>' + esc(f.persona || '—') + '</div>' +
        '<div><span>Cierre</span>' + esc(abierto ? 'Todavía en la caja abierta' : refCierre(f.cierre)) + '</div>' +
        (f.rubro ? '<div><span>Tipo de gasto</span>' + esc(f.rubro) + '</div>' : '') +
        (f.descripcion ? '<div><span>Descripción</span>' + esc(f.descripcion) + '</div>' : '') +
      '</div>' +
      (an ? '<div class="pos-cartel mal">Anulado' + (f.motivo ? ': ' + esc(f.motivo) : '') + '</div>' : '') +
      (!an && !abierto ? '<p class="pos-ayuda">Ya entró en el cierre ' + esc(refCierre(f.cierre)) + ': para cambiarlo, hay que anular ese cierre.</p>' : '') +
      '<div id="mdAnular"></div><div class="pos-pie">' + (!an && abierto ? '<button type="button" class="btn btn-sec btn-chico izq" id="mdAnularBtn">Anular</button>' : '') +
        '<button type="button" class="btn btn-pri btn-chico" data-cerrar>Cerrar</button></div>');
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
     LISTAS DE PRECIOS
     ════════════════════════════════════════════════════════════════════ */
  function verListas() {
    var c = $('cuerpo');
    if (!listaPorId(S.listaSel)) S.listaSel = S.ini.listas[0] && S.ini.listas[0].id;
    var li = listaPorId(S.listaSel);
    if (!li) { c.innerHTML = cabeza('Listas de precios', '') + '<div class="pos-cartel">No hay listas de precios.</div>'; return; }
    var base = li.base_id ? listaPorId(li.base_id) : null;
    var usan = S.ini.locales.filter(function (l) { return l.lista_id === li.id; }).map(nombreLocal);
    c.innerHTML = cabeza('Listas de precios', 'Cada sucursal usa una (se elige en Sucursales). Un precio cambiado acá vale desde la próxima venta.') +
      '<div class="pos-listas-elegir" role="group" aria-label="Lista">' + S.ini.listas.map(function (l) {
        return '<button type="button" class="chip' + (l.id === li.id ? ' sel' : '') + '" data-lista="' + l.id + '">' + esc(l.nombre) + '</button>'; }).join('') + '</div>' +
      (base ? '<div class="pos-calc"><p>Se calcula sola de <b>' + esc(base.nombre) + '</b>: ' + (Number(li.ajuste) < 0 ? String(-li.ajuste).replace('.', ',') + ' % menos' : String(li.ajuste).replace('.', ',') + ' % más') +
          ', redondeado a $' + miles(li.redondeo) + '. Un precio cambiado a mano en esta lista pisa al calculado.' + (usan.length ? ' La usan: ' + esc(usan.join(', ')) + '.' : '') + '</p>' +
          campo('', 'Porcentaje', '<input type="text" inputmode="decimal" id="lsAjuste" value="' + String(li.ajuste).replace('.', ',') + '">') +
          campo('', 'Redondeo ($)', '<input type="number" id="lsRedondeo" min="1" max="10000" value="' + li.redondeo + '">') +
          '<button type="button" class="btn btn-sec btn-chico" id="lsGuardar">Guardar</button></div>'
        : '<div class="pos-calc"><p>Los precios propios de esta lista' + (usan.length ? '. La usan: ' + esc(usan.join(', ')) : '') + '.</p></div>') +
      '<div class="pos-filtros">' + campo('ancho', 'Buscar', '<input type="search" id="lsBuscar" placeholder="Código o nombre" autocomplete="off">') +
        '<label class="pos-check"><input type="checkbox" id="lsSolo" checked> Sólo los que tienen precio</label></div>' +
      '<div id="lsTabla"><p class="cargando">Cargando…</p></div>';
    c.querySelectorAll('[data-lista]').forEach(function (b) { b.onclick = function () { S.listaSel = Number(b.getAttribute('data-lista')); verListas(); }; });
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
      var filas = (window.CATALOGO || []).map(function (p) { return { cod: p[0], nom: p[1], rubro: p[2] || '' }; });
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
    c.innerHTML = cabeza('Promociones', 'Se aplican solas en la venta y el vendedor las puede sacar. Entre las que no se suman, va la que más le conviene al cliente.',
        '<button type="button" class="btn btn-pri btn-chico" id="prNueva">Nueva promoción</button>') +
      '<div class="pos-promos">' + ((S.ini.promos || []).length ? S.ini.promos.map(function (p) {
        return '<div class="pos-promo' + (p.activo ? '' : ' apagada') + '"><label class="pos-switch" title="' + (p.activo ? 'Activa' : 'Apagada') + '"><input type="checkbox" data-activa="' + p.id + '"' + (p.activo ? ' checked' : '') +
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
  window.__pos = { cuenta: function (v, ini) { var antes = S.ini; S.ini = ini; try { return cuenta(v); } finally { S.ini = antes; } }, leerPlata: leerPlata, plata: plata };
})();
