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
  var K_PRUEBA = 'pos_prueba';             // el modo prueba, en sessionStorage: se apaga solo al cerrar la ventana

  /* ── Los menús: las secciones de Tango y Dragonfish, con los nombres de BlueSoft ── */
  var MENUS = {
    mostrador: [
      ['Ventas', [['venta', 'Nueva venta', 'venta'], ['tickets', 'Tickets', 'tickets'],
                  ['cambios', 'Cambios', 'cambio'], ['fallida', 'Venta fallida', 'fallida', 'index.html?volver=pos']]]
    ],
    gestion: [
      ['Artículos', [['productos', 'Productos', 'producto'], ['listas', 'Listas de precios', 'lista'], ['promos', 'Promociones', 'promo']]],
      ['Stock', [['stock', 'Stock', 'stock'], ['envios', 'Envíos', 'envio'],
                 ['recepcion', 'Recepción', 'recepcion'], ['inventario', 'Inventario', 'inventario']]],
      ['Caja', [['cierre', 'Cierre de caja', 'caja'], ['movimientos', 'Movimientos', 'movs']]],
      ['Clientes y reportes', [['clientes', 'Clientes', 'clientes'], ['reportes', 'Reportes', 'reportes']]],
      ['Configuración', [['sucursales', 'Sucursales', 'sucursal'], ['medios', 'Medios de pago', 'medios'], ['arca', 'Facturación (ARCA)', 'arca']]]
    ]
  };
  var MENU = MENUS[MODO];
  var INICIO = { mostrador: 'venta', gestion: 'listas' };
  var HECHAS = { venta: 1, tickets: 1, listas: 1, promos: 1, sucursales: 1 };
  var LETRAS = { A: 'Factura A', B: 'Factura B', X: 'X · interno' };

  /* Lo que va a tener cada sección que todavía no está (de la investigación del 20/10 y del mapa de BlueSoft). */
  var PRONTO = {
    cambios: ['Cambios y devoluciones', [
      'Buscar el ticket original (por número, por cliente o por la prenda) y elegir qué vuelve.',
      'Cambio por otra prenda: si sale lo mismo, sin plata de por medio; si sale más, se cobra la diferencia.',
      'La nota de crédito atada a la factura, dentro de los 15 días (lo pide ARCA).',
      'El ticket de cambio con un código único para el cliente (lo pide la ley de CABA).',
      'La prenda que vuelve entra al stock del local.'], 'Mientras tanto, los cambios se siguen haciendo en BlueSoft.'],
    cierre: ['Cierre de caja', [
      'Primero se cuenta el efectivo y recién después se ve cuánto tendría que haber (en BlueSoft se ve antes de contar).',
      'Las ventas del día por medio de pago salen solas de los tickets.',
      'En el mismo paso, cuánto pasa a la caja fuerte (hoy es otra pantalla).',
      'La foto del cierre y la diferencia, como en Supervisión → Cajas.'],
      'Mientras tanto, las cajas del día se controlan en <a href="impecable-admin.html#cajas">Supervisión → Cajas</a>.'],
    movimientos: ['Movimientos de caja', [
      'Entradas y salidas de la caja chica: gastos del local, retiros y el pase a la caja fuerte.',
      'Cada movimiento con quién, cuánto y por qué.',
      'Los gastos con sus tipos (limpieza, bidones, vidriera, luz…), como en BlueSoft.'], ''],
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
  var S = { ini: null, precios: {}, vista: 'venta', guardando: false, ultimo: null, listaSel: null };
  var V = null;   // la venta que se está armando

  function llamar(nombre, args) {
    return persona.token().then(function (t) { return funcion(nombre, args || {}, t); });
  }
  function esDeRed(e) { return !(e && (e.delServidor || e.sinSesion)); }
  function mensajeDe(e) {
    var m = String((e && e.message) || e || '');
    /* El 147 (pruebas y la X) cambia pos_tickets y suma pos_pruebas_borrar; con el 146 solo, la X no existe. */
    if (/Could not find the function|schema cache|PGRST202/.test(m)) return 'Todavía falta correr el SQL ' + (/pos_tickets|pos_pruebas_borrar/.test(m) ? '147' : '146') + ' (el del POS) en Supabase.';
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

  function ir(v) {
    /* Una dirección vieja (pos.html#listas) o un enlace a la otra pantalla: se va para allá. */
    var otro = MODO === 'gestion' ? 'mostrador' : 'gestion';
    if (!enMenu(MENU, v) && enMenu(MENUS[otro], v)) { location.replace(PAGINA[otro] + '#' + v); return; }
    if (!enMenu(MENU, v)) v = INICIO[MODO];
    S.vista = v;
    try { history.replaceState(null, '', location.pathname + location.search + '#' + v); } catch (e) {}
    cerrarVentana();
    app.innerHTML = marco();
    engancharMenu();
    var ver = { venta: verVenta, tickets: verTickets, listas: verListas, promos: verPromos, sucursales: verSucursales }[v];
    if (ver) ver(); else verPronto(v);
  }
  window.addEventListener('hashchange', function () { var v = vistaDelHash(); if (S.ini && v !== S.vista) ir(v); });

  function ponerPrueba(si) {
    try { if (si) sessionStorage.setItem(K_PRUEBA, '1'); else sessionStorage.removeItem(K_PRUEBA); } catch (e) {}
    /* El cartel de la última venta guardada es de la otra numeración: no se mezcla. */
    S.ultimo = null;
    marcarPrueba();
    ir(S.vista);
    avisar('info', si ? 'Modo prueba: lo que guardes numera aparte (P-1, P-2…) y no cuenta para nada.' : 'Listo: volviste a las ventas de verdad.');
  }

  /* ── El menú de la izquierda ── */
  function menuChico() { return S.vista === 'venta' ? leer(K_MENU_VENTA) !== 'abierto' : Interfaz.panelChico(K_MENU); }
  function guardarMenu(ch) { if (S.vista === 'venta') guardar(K_MENU_VENTA, ch ? 'chico' : 'abierto'); else Interfaz.panelChico(K_MENU, ch); }

  function item(it) {
    var activa = it[0] === S.vista;
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
      : '<div class="pos-grupo" aria-hidden="true"></div>' + MENU[0][1].map(item).join('') +
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
    var p = $('vProd');
    if (p && S.vista === 'venta') p.focus();
  }
  function errorEn(caja, id, txt) { var e = caja.querySelector('#' + id); if (e) e.textContent = txt || ''; return !txt; }

  /* ════════════════════════════════════════════════════════════════════
     LA VENTA
     ════════════════════════════════════════════════════════════════════ */
  function recuerdo() { return leerJSON(K_RECUERDO, {}) || {}; }
  function recordar() {
    var r = recuerdo();
    r.local = V.local_id;
    r.vendedor = r.vendedor || {};
    if (V.vendedor) r.vendedor[V.local_id] = V.vendedor;
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

  /** Los pagos que se mandan a la base (en centavos). */
  function pagosDe(total) {
    if (total <= 0) return [];
    if (V.forma === 'multiple') return (V.multiples || []).map(function (x) { return Object.assign({}, x); });
    var p = { medio: V.forma, monto: total };
    if (V.forma === 'efectivo' && V.pago.recibido) p.recibido = V.pago.recibido;
    if (V.forma === 'tarjeta') { p.tarjeta = V.pago.tarjeta || ''; p.tipo_tarjeta = tipoTarjeta(p.tarjeta); p.cuotas = Number(V.pago.cuotas) || 1; p.cupon = V.pago.cupon || ''; }
    else if (V.forma !== 'efectivo') p.cupon = V.pago.operacion || '';
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
    $('vLinea').onclick = abrirLineaLibre;
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

  function llenarVendedores() {
    var vs = vendedoresDe(V.local_id);
    if (V.vendedor && vs.indexOf(V.vendedor) < 0) vs.push(V.vendedor);
    $('vVend').innerHTML = '<option value="">Elegí quién vende…</option>' + opciones(vs.map(function (n) { return [n, n]; }), V.vendedor) +
      '<option value="__otro">Otro (escribirlo)…</option>';
  }
  function pedirVendedor() {
    var caja = ventana('<h3 id="posVentTit">¿Quién vende?</h3><p class="pos-bajada">Si no está en la lista del local, escribí su nombre como lo usa en la Carga.</p>' +
      campo('', 'Nombre', '<input type="text" id="pvNombre" maxlength="40" autofocus>') + '<div class="pos-error" id="pvError"></div>' +
      '<div class="pos-pie"><button type="button" class="btn btn-sec btn-chico" data-cerrar>Cancelar</button><button type="button" class="btn btn-pri btn-chico" id="pvOk">Listo</button></div>');
    function listo() {
      var n = caja.querySelector('#pvNombre').value.trim();
      if (!errorEn(caja, 'pvError', n.length < 2 ? 'Escribí el nombre.' : '')) return;
      V.vendedor = n;
      recordar();
      llenarVendedores();
      cerrarVentana();
      pintar();
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

  /* ── El pago (abajo de "Forma de pago") ── */
  function pintarPago() {
    var x = $('vPagoX'), p = V.pago;
    if (!x) return;
    if (V.forma === 'efectivo') {
      x.innerHTML = campo('c6', 'Recibido', '<input type="text" inputmode="decimal" id="vRecibido" placeholder="Opcional" value="' + plataCampo(p.recibido) + '">') +
        campo('c6 tk-vuelto', 'Vuelto', '<input type="text" id="vVuelto" readonly>');
    } else if (V.forma === 'tarjeta') {
      x.innerHTML = campo('c5', 'Tarjeta', '<select id="vTarjeta"><option value="">Elegí…</option>' + opciones(TARJETAS.map(function (t) { return [t[0], t[0]]; }), p.tarjeta) + '</select>') +
        campo('c3', 'Cuotas', '<select id="vCuotas">' + opciones(CUOTAS.map(function (n) { return [n, n]; }), p.cuotas || 1) + '</select>') +
        campo('c4', 'Cupón', '<input type="text" id="vCupon" inputmode="numeric" maxlength="20" placeholder="Del posnet" value="' + esc(p.cupon || '') + '">');
    } else if (V.forma === 'multiple') {
      x.innerHTML = '<div class="pos-f"><span>Pagos</span><div class="tk-cliente"><div class="tk-cliente-txt" id="vMultTxt"></div>' +
        '<button type="button" class="btn btn-sec btn-chico" id="vMultBtn">Cambiar</button></div></div>';
      $('vMultBtn').onclick = abrirMultiple;
    } else {
      x.innerHTML = campo('', 'Nº de operación', '<input type="text" id="vOper" maxlength="30" placeholder="Opcional" value="' + esc(p.operacion || '') + '">');
    }
    x.insertAdjacentHTML('beforeend', '<div class="tk-aviso-pago" id="vPagoAviso" role="status"></div>');
    var r = $('vRecibido');
    if (r) r.oninput = function () { var v = leerPlata(r.value); V.pago.recibido = isNaN(v) ? 0 : v; pintar(); };
    [['vTarjeta', 'tarjeta'], ['vCuotas', 'cuotas'], ['vCupon', 'cupon'], ['vOper', 'operacion']].forEach(function (k) {
      var e = $(k[0]);
      if (e) e[e.tagName === 'SELECT' ? 'onchange' : 'oninput'] = function () { V.pago[k[1]] = e.value; guardarBorrador(); };
    });
  }

  /* ── El producto: un solo campo para buscar o dispararle a la etiqueta ──
     La pistola escribe "RM41641 S NE" (código, talle y color) y casi siempre
     un Enter. Se distingue por la FORMA, como en la Carga. Acá, a diferencia
     del No Compra, el talle y el color de la etiqueta SÍ son los buenos: es
     la prenda que se lleva. */
  var ESCANEO = /^([A-Za-z]{1,4}\d[A-Za-z0-9]*)\s+(\S+)\s+(\S+)$/;
  var _sug = [], _mira = 0, _tEsc = null;

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

  function engancharProducto() {
    var campoP = $('vProd'), caja = $('vSug');
    function cerrar() { caja.hidden = true; _sug = []; campoP.removeAttribute('aria-activedescendant'); }
    function pintarSug() {
      if (!_sug.length) { cerrar(); return; }
      caja.innerHTML = _sug.map(function (p, i) {
        var pr = precioDe(p[0]);
        return '<button type="button" role="option" id="vSug' + i + '" data-sug="' + i + '" class="' + (i === _mira ? 'on' : '') + '" aria-selected="' + (i === _mira) + '">' +
          '<span>' + esc(p[1]) + ' <small>' + esc(p[2] || '') + '</small></span><small>' + esc(p[0]) + '</small>' +
          (pr ? '<span class="n">' + plata(pr) + '</span>' : '<span class="sin">Sin precio</span>') + '</button>';
      }).join('');
      caja.hidden = false;
      campoP.setAttribute('aria-activedescendant', 'vSug' + _mira);
    }
    campoP.oninput = function () {
      clearTimeout(_tEsc);
      var d = leerEscaneo(campoP.value);
      /* Algunas pistolas no mandan Enter: si el texto ya es un disparo completo (el talle y el color
         existen en esa prenda), se agrega solo, cuando deja de escribir. */
      if (d && PROD[d.codigo] && tallesDe(PROD[d.codigo]).indexOf(d.talle) >= 0 &&
          coloresDe(PROD[d.codigo]).some(function (x) { return x.cod === d.color; })) {
        var antes = campoP.value;
        _tEsc = setTimeout(function () { if (campoP.value === antes) agregarEscaneo(d); }, 150);
        cerrar();
        return;
      }
      _sug = buscarProductos(campoP.value);
      _mira = 0;
      pintarSug();
    };
    campoP.onkeydown = function (e) {
      if (e.key === 'ArrowDown' && _sug.length) { e.preventDefault(); _mira = (_mira + 1) % _sug.length; pintarSug(); return; }
      if (e.key === 'ArrowUp' && _sug.length) { e.preventDefault(); _mira = (_mira + _sug.length - 1) % _sug.length; pintarSug(); return; }
      if (e.key === 'Escape') { cerrar(); return; }
      if (e.key !== 'Enter') return;
      /* El Enter NUNCA guarda la venta: lo manda la pistola al final de cada disparo. */
      e.preventDefault();
      clearTimeout(_tEsc);
      var d = leerEscaneo(campoP.value);
      if (d) { agregarEscaneo(d); return; }
      var cod = campoP.value.trim().toUpperCase();
      if (PROD[cod]) { abrirDetalle(PROD[cod]); return; }
      /* Si las sugerencias se cerraron (salió del campo y volvió), se buscan de nuevo. */
      if (!_sug.length) { _sug = buscarProductos(campoP.value); _mira = 0; }
      if (_sug.length) { abrirDetalle(_sug[_mira]); return; }
      if (cod) {
        avisar('err', 'No encontré «' + campoP.value.trim() + '» en el catálogo. Si es un artículo suelto, cargalo con «Nueva línea».');
        campoP.select();   // el próximo disparo lo reemplaza
      }
    };
    caja.onmousedown = function (e) { e.preventDefault(); };   // que el campo no pierda el foco antes del click
    caja.onclick = function (e) { var b = e.target.closest('[data-sug]'); if (b) abrirDetalle(_sug[Number(b.getAttribute('data-sug'))]); };
    campoP.onblur = function () { setTimeout(function () { if (document.activeElement !== campoP) cerrar(); }, 120); };
    campoP.onfocus = function () { if (!_sug.length && !leerEscaneo(campoP.value)) { _sug = buscarProductos(campoP.value); _mira = 0; pintarSug(); } };
  }

  function agregarEscaneo(d) {
    var p = PROD[d.codigo];
    if (!p) {
      avisar('err', 'El código ' + d.codigo + ' no está en el catálogo. Si es un artículo suelto, cargalo con «Nueva línea».');
      var c = $('vProd');
      if (c) c.select();   // el próximo disparo lo reemplaza
      return;
    }
    var col = coloresDe(p).filter(function (x) { return x.cod === d.color; })[0];
    agregar(p, d.talle, col ? col.cod : d.color, 1);
  }

  function agregar(p, talle, color, cant) {
    var cod = p[0];
    var ya = V.lineas.filter(function (l) { return !l.libre && l.codigo === cod && l.talle === talle && l.color === color; })[0];
    if (ya) ya.cantidad = Math.min(999, ya.cantidad + (cant || 1));
    else V.lineas.push({ codigo: cod, descripcion: p[1], rubro: p[2] || '', talle: talle || '', color: color || '', color_nom: nombreColor(color, cod),
                         cantidad: cant || 1, precio: precioDe(cod) || 0, propio: false });
    var campoP = $('vProd');
    campoP.value = '';
    $('vSug').hidden = true;
    _sug = [];
    pintar();
    if (!precioDe(cod)) avisar('info', p[1] + ' no tiene precio en esta lista: escribilo en «Precio unit.».');
    campoP.focus();
  }

  /* "Agregar detalle…" de BlueSoft: el talle y el color, con chips en vez de desplegables. */
  function abrirDetalle(p) {
    var talles = tallesDe(p), colores = coloresDe(p), pr = precioDe(p[0]);
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
      agregar(p, talle, sel.color, n);
    }
    caja.querySelector('#dtOk').onclick = listo;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); listo(); } });
    setTimeout(function () { var b = caja.querySelector(sel.talle ? (colores.length > 1 ? '[data-color]' : '#dtOk') : '[data-talle], #dtOtro'); if (b) b.focus(); }, 0);
  }

  /* "Nueva línea": un artículo que no está en el catálogo. */
  function abrirLineaLibre() {
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
      V.lineas.push({ codigo: caja.querySelector('#llCod').value.trim().toUpperCase(), descripcion: d, rubro: '', talle: caja.querySelector('#llTalle').value.trim().toUpperCase(),
                      color: '', color_nom: '', cantidad: n, precio: pr, propio: true, libre: true });
      cerrarVentana();
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
    if (S.vista !== 'venta' || _velo || !S.ini) return;
    if (e.key === 'F9') { e.preventDefault(); guardarVenta(); }
    else if (e.key === 'F2') { e.preventDefault(); var p = $('vProd'); if (p) p.focus(); }
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
  function verTickets() {
    var c = $('cuerpo'), todos = {}, prueba = enPrueba();
    Object.keys(S.ini.vendedores || {}).forEach(function (k) { (S.ini.vendedores[k] || []).forEach(function (n) { todos[n] = 1; }); });
    c.innerHTML = cabeza('Tickets' + (prueba ? '<span class="pos-tag prueba">Modo prueba</span>' : ''), 'Las ventas del POS de todas las sucursales.',
        '<button type="button" class="btn btn-sec btn-chico" id="tkBorrar" hidden>Borrar las pruebas</button>' +
        '<button type="button" class="btn btn-pri btn-chico" data-ir="venta">Nueva venta</button>' +
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
    c.querySelector('[data-ir="venta"]').onclick = function () { ir('venta'); };
    var per = Interfaz.periodo($('tkPer'), { inicial: 'hoy', guardar: 'pos_tickets_periodo', hastaHoy: true, alCambiar: cargar });
    ['tkLocal', 'tkVend', 'tkLetra', 'tkMedio', 'tkEstado', 'tkPrueba'].forEach(function (id) { $(id).onchange = cargar; });
    $('tkBorrar').onclick = function () {
      var loc = $('tkLocal').value, l = loc && localDe(loc), bt = this;
      if (!confirm('¿Borrar ' + (l ? 'las ventas de prueba de ' + nombreLocal(l) : 'todas las ventas de prueba') +
                   ' (de cualquier día)? Las de verdad no se tocan. No se puede deshacer.')) return;
      bt.disabled = true;
      llamar('pos_pruebas_borrar', { p_local: loc || null }).then(function (n) {
        bt.disabled = false;
        avisar('ok', n ? 'Listo: se ' + (n === 1 ? 'borró 1 venta de prueba.' : 'borraron ' + n + ' ventas de prueba.') : 'No había ventas de prueba para borrar.');
        if (S.ultimo && S.ultimo.serie === 'prueba') S.ultimo = null;
        cargar();
      }).catch(function (e) { bt.disabled = false; avisar('err', mensajeDe(e)); });
    };
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
