/* ═══════════════════════════════════════════════════════════════════════
   ventas.js — la planilla del local, adentro del Sistema VDH.

   Pedido de Mauricio (15/10/2026): reemplazar las planillas de Google de los
   14 locales. Las cuatro hojas que usan (Ventas, Tráfico, Informe Vendedor e
   Informe Temporada) se ven como la planilla, con las mismas fórmulas
   (ventas-calc.js, comparado al peso con las 14 planillas de septiembre y
   octubre). Lo ámbar lo cambia cualquiera del local, "todos los vendedores,
   todos"; el reparto del objetivo (los % grises) sólo el encargado, el
   supervisor o Administración. Gerencia mira.

   Quién entra: con su usuario (persona.js) o desde la compu habilitada del
   local (la llave de Cobrar, 'nc_caja'). La base decide qué locales ve cada
   uno (ventas_locales) y vuelve a mirarlo en cada celda que se guarda.

   Cada celda se guarda sola al salir de ella (ventas_guardar), en fila: la
   pantalla no espera a la base para recalcular. Si la base dice que no, se
   avisa y se vuelve a leer el mes. Cada minuto, si nadie está escribiendo,
   se vuelve a leer: así dos compus del mismo local ven lo del otro.

   E-commerce (17/10/2026): una opción más del selector, sólo para Atención al
   cliente y Administración (ventas_ecom_puede). Es la hoja "[Mes] E-commerce"
   de su planilla; la venta y la Q llegan solas de la tienda, y lo de Meta y
   las visitas y los carritos de Google Analytics (19/10) los trae el robot
   de cada hora (ventas-ecom.sql, ventas-calc: ecom).
   Desde el SQL 148 (21/10/2026), Atención al cliente ve sólo esta hoja: las
   de los locales ya no (ventas_acceso). El vendedor con la casilla de
   Atención ve la de su local y esta.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VC = window.VentasCalc, def = VC.def;
  var $ = function (id) { return document.getElementById(id); };
  var K_LOCAL = 'nc_ventas_local', K_HOJA = 'nc_ventas_hoja';
  var PRIMER_MES = '2026-09-01';          // el primero que pasó de la planilla al sistema
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var MED = ['🥇', '🥈', '🥉'];
  /* Los nombres de la base para cada dato de Informe Vendedor. */
  var CAMPO_IV = { t: 'trafico', c: 'conversion', tp: 'ticket', pf: 'perfumes', bx: 'boxer', pxt: 'pxt' };
  var IV_CAMPO = { trafico: 't', conversion: 'c', ticket: 'tp', perfumes: 'pf', boxer: 'bx', pxt: 'pxt' };
  var TRAF_IDX = { trafico: 1, conversion: 2, ticket: 3 };

  var ST = {
    locales: [], local: null, mes: null, D: null, C: null, firma: '',
    hoja: 'ventas', temp: null, pedido: 0, arranco: false, leido: 0
  };
  /* El e-commerce en el selector: no es un local de la base (ventas_ecom_*). */
  var ECOM = { id: 'ecommerce', nombre: 'E-commerce', codigo: 'ECOMMERCE', ecom: true };
  function esEcom() { return !!(ST.local && ST.local.ecom); }

  /* ══ Formatos (los de la planilla) ═══════════════════════════════════════ */
  function nf(n) { return Math.round(n).toLocaleString('es-AR'); }
  function pesos(n) { return (Math.round(n) < 0 ? '-$' : '$') + nf(Math.abs(n)); }
  /* $#,##0;"($"#,##0);- */
  function pesosP(n) { var r = Math.round(n); return r === 0 ? '-' : r < 0 ? '($' + nf(-r) + ')' : '$' + nf(r); }
  /* +$#,##0;-$#,##0 */
  function conSigno(n) { return (Math.round(n) < 0 ? '-$' : '+$') + nf(Math.abs(n)); }
  function pc(n, d) { d = d || 0; return (n * 100).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }
  function pcIn(n) { return (n * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%'; }
  /* +0%;-0%;- */
  function sp(n) {
    if (!def(n) || !isFinite(n)) return '';
    if (n === 0) return '-';
    return (n > 0 ? '+' : '-') + Math.abs(Math.round(n * 100)) + '%';
  }
  /* +0.0%;-0.0% (y con d decimales) */
  function spd(n, d) {
    if (!def(n) || !isFinite(n)) return '';
    d = d === undefined ? 1 : d;
    var t = Math.abs(n * 100).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (Math.round(n * 100 * Math.pow(10, d)) === 0 ? '' : n > 0 ? '+' : '-') + t + '%';
  }
  function dec(n, d) { d = d === undefined ? 1 : d; return Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function decLibre(n) { return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
  function mill(n) { return '$' + (n / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M'; }
  function millCorto(n) { return (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M'; }
  /* El color de un desvío, con los cortes del dashboard (ventas-calc: semaforo): 'sv' verde, 'sa' amarillo, 'sr' rojo. */
  function sem(real, obj) { return VC.semaforo(real, obj); }
  function suma(a) { var s = 0; for (var i = 0; i < a.length; i++) s += Number(a[i]) || 0; return s; }

  /* ══ Fechas ═════════════════════════════════════════════════════════════ */
  /* Hoy en Argentina, 'AAAA-MM-DD' (la compu puede tener otra zona). */
  function hoyAR() {
    try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); }
    catch (e) { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  }
  function mesDe(f) { return String(f).slice(0, 7) + '-01'; }
  function otroMes(mes, n) {
    var p = mes.split('-'), k = +p[0] * 12 + (+p[1] - 1) + n;
    return Math.floor(k / 12) + '-' + ('0' + (k % 12 + 1)).slice(-2) + '-01';
  }
  function nombreMes(mes) { var p = String(mes).split('-'); return VC.MESES[+p[1] - 1]; }
  function anioMes(mes) { return +String(mes).split('-')[0]; }

  /* ══ La base ════════════════════════════════════════════════════════════ */
  function caja() { var k = leer('nc_caja'); return /^caja_/.test(k) ? k : null; }
  function llamar(nombre, args) {
    args.p_caja = caja();
    return persona.tokenSiHay().then(function (t) { return funcion(nombre, args, t || undefined); });
  }
  /* El error, dicho para el que carga. */
  function motivo(e) {
    if (e && e.sinSesion) return 'Se cerró tu sesión: entrá de nuevo con tu usuario.';
    var m = String((e && e.message) || e || '');
    if (/failed to fetch|networkerror|network|load failed/i.test(m)) return 'Sin conexión con la base: no se guardó. Revisá internet y probá de nuevo.';
    m = m.replace(/^ventas:\s*/, '');
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  /* ══ Lo que se ve fuera de la hoja ══════════════════════════════════════ */
  function mostrar(que) {          // 'cargando' | 'caja' | 'hoja'
    $('vtCargando').hidden = que !== 'cargando';
    $('vtCaja').hidden = que !== 'caja';
    $('vtHoja').hidden = que !== 'hoja';
    $('vtTira').hidden = que !== 'hoja';
    $('vtPestanas').hidden = que !== 'hoja';
  }
  function cargando(txt) { $('vtCargando').textContent = txt; mostrar('cargando'); }
  function cajaMsg(html) { $('vtCaja').innerHTML = html; mostrar('caja'); }
  function fallo(e, otraVez) {
    if (e && e.sinSesion) { porton(); return; }
    cajaMsg('<h2>No se pudo abrir la planilla</h2><p>' + esc(motivo(e)) + '</p>' +
      '<button type="button" class="btn btn-pri" data-acc="reintentar">Probar de nuevo</button>');
    ST.reintentar = otraVez;
  }

  /* Ni usuario del local ni compu habilitada. */
  function porton() {
    ST.D = null;
    $('vtLocalChip').hidden = true; $('vtMesChip').hidden = true;
    $('vtQuien').innerHTML = ''; $('vtSoloVer').hidden = true; estado('');
    var y = persona.yo(), html = '<h2>Ventas del local</h2>';
    if (!persona.hay()) {
      html += '<p>Es la planilla de ventas de cada local: Ventas, Tráfico, Informe Vendedor e Informe Temporada. ' +
        'Para abrirla, entrá con tu usuario del local, o abrila desde la compu habilitada del local.</p>' +
        '<button type="button" class="btn btn-pri" data-acc="entrar">Entrar con tu usuario</button>';
    } else if (!y) {
      html += '<p>Tu usuario está esperando el OK. Cuando te aprueben, vas a ver la planilla de tu local.</p>' +
        '<button type="button" class="btn btn-sec" data-acc="entrar">Ver mi usuario</button>';
    } else {
      html += '<p>Entraste como <b>' + esc(y.nombre) + '</b>. La planilla de cada local la abren su gente, su supervisor, ' +
        'Administración y Gerencia; la del E-commerce, Atención al cliente y Administración.</p>' +
        '<button type="button" class="btn btn-sec" data-acc="entrar">Ver mi usuario</button>';
    }
    cajaMsg(html);
  }

  var tEstado = null;
  function estado(txt, cl) {
    var el = $('vtEstado');
    el.textContent = txt;
    el.className = 'vt-estado' + (cl ? ' ' + cl : '');
  }
  function fechaCorta(f) { f = String(f || ''); return f.slice(8, 10) + '/' + f.slice(5, 7); }
  function pintarQuien() {
    var D = ST.D, chip = $('vtSoloVer'), txt = '', tit = '';
    /* El mes pasado se completa hasta el 7 del siguiente; después cierra y lo corrige Administración (ventas_acceso_mes). */
    if (D && D.cerrado) {
      txt = D.puede === 'escribir' ? 'Mes cerrado · corregís vos' : 'Mes cerrado';
      tit = !D.carga_hasta ? 'El sistema empezó en septiembre de 2026.'
        : 'Se cargaba hasta el ' + fechaCorta(D.carga_hasta) + '.' + (D.puede === 'escribir' ? ' Para el local ya está cerrado: lo que cambies queda como corrección de Administración.' : ' Si hay que corregir algo, lo hace Administración.');
    } else if (D && D.puede !== 'escribir') txt = 'Sólo para mirar';
    else if (D && D.carga_hasta && mesDe(D.hoy) > String(D.mes).slice(0, 10)) {
      txt = 'Se completa hasta el ' + fechaCorta(D.carga_hasta);
      tit = 'Los últimos días y el informe de la última semana. Después cierra y lo corrige Administración.';
    }
    chip.textContent = txt; chip.title = tit; chip.hidden = !txt;
    $('vtQuien').innerHTML = D && D.quien ? (D.puede === 'escribir' ? 'Carga: ' : 'Mira: ') + '<b>' + esc(D.quien) + '</b>' : '';
  }

  /* ══ Arranque: qué locales ve y cuál abre ═══════════════════════════════ */
  function cargarLocales() {
    cargando('Abriendo…');
    /* El e-commerce va al final de la lista, sólo para Atención al cliente y Administración. Si la base todavía
       no lo tiene (o falla), la lista queda como siempre. */
    Promise.all([
      llamar('ventas_locales', {}),
      llamar('ventas_ecom_puede', {}).catch(function () { return null; })
    ]).then(function (r) {
      ST.locales = (r[0] || []).slice();
      if (r[1] === 'escribir') ST.locales.push(ECOM);
      if (!ST.locales.length) { porton(); return; }
      var guardado = leer(K_LOCAL), codCaja = String(leer('nc_caja_local') || '').trim().toUpperCase();
      var y = persona.yo(), elegido = null;
      function buscar(f) { for (var i = 0; i < ST.locales.length; i++) if (f(ST.locales[i])) return ST.locales[i]; return null; }
      /* El que eligió antes en este aparato; si no, el de la compu; si no, el de su usuario; si no, el primero. */
      elegido = buscar(function (l) { return l.id === guardado; }) ||
        (codCaja && caja() ? buscar(function (l) { return String(l.codigo || '').toUpperCase() === codCaja; }) : null) ||
        (y && y.local_id ? buscar(function (l) { return l.id === y.local_id; }) : null) ||
        ST.locales[0];
      if (!ST.local || ST.local.id !== elegido.id) ST.temp = null;
      ST.local = elegido;
      pintarSelectores();
      cargarMes();
    }).catch(function (e) { fallo(e, cargarLocales); });
  }

  function pintarSelectores() {
    var sl = $('vtLocal');
    /* La lista es la común (select.desplegable, estilos.css): los locales y el E-commerce en dos grupos. El legend es el
       título en la lista; el label, en el iPhone. */
    function op(l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === ST.local.id ? ' selected' : '') +
        (l.ecom ? ' data-icono="web" data-sub="vdh.com.ar"' : '') + '>' + esc(l.nombre) + '</option>';
    }
    function grupo(t, ls) { return '<optgroup label="' + t + '"><legend>' + t + '</legend>' + ls.map(op).join('') + '</optgroup>'; }
    var locales = ST.locales.filter(function (l) { return !l.ecom; }), web = ST.locales.filter(function (l) { return l.ecom; });
    sl.innerHTML = locales.length && web.length ? grupo('Locales', locales) + grupo('Tienda online', web) : ST.locales.map(op).join('');
    sl.disabled = ST.locales.length < 2;
    $('vtLocalChip').hidden = false;
    /* Los meses: desde el primero que pasó al sistema hasta el que viene. */
    var hoyMes = mesDe(hoyAR()), hasta = otroMes(hoyMes, 1), m = PRIMER_MES, ops = [];
    while (m <= hasta) { ops.push(m); m = otroMes(m, 1); }
    if (ops.indexOf(ST.mes) < 0) ops.push(ST.mes);
    ops.sort();
    $('vtMes').innerHTML = ops.reverse().map(function (x) {
      var marca = x === hoyMes ? 'Este mes' : x === hasta ? 'Próximo' : '';
      return '<option value="' + x + '"' + (x === ST.mes ? ' selected' : '') + (marca ? ' data-marca="' + marca + '"' : '') + '>' +
        nombreMes(x) + ' ' + anioMes(x) + '</option>';
    }).join('');
    $('vtMesChip').hidden = false;
  }

  /* ══ El mes ═════════════════════════════════════════════════════════════ */
  function cargarMes(silencioso) {
    var pedido = ++ST.pedido;
    if (!silencioso) cargando('Abriendo la planilla de ' + nombreMes(ST.mes) + '…');
    var ec = esEcom();
    return (ec ? llamar('ventas_ecom_leer', { p_mes: ST.mes, p_abrir: true })
               : llamar('ventas_mes_leer', { p_local: ST.local.id, p_mes: ST.mes, p_abrir: true })).then(function (D) {
      if (pedido !== ST.pedido) return;
      ST.leido = Date.now();
      var firma = JSON.stringify(D);
      if (silencioso && ST.D && firma === ST.firma) return;        // nada cambió
      ST.D = D; ST.firma = firma;
      if (ST.temp && ST.temp.meses.indexOf(mesDeDatos(D)) >= 0) ST.temp.D[mesDeDatos(D)] = D;
      pintarQuien();
      if (!D.cfg) {
        cajaMsg('<h2>' + nombreMes(ST.mes) + ' todavía no tiene planilla</h2><p>' + (ec ? 'Se abre sola cuando llega el mes.' : 'Se abre sola la primera vez que alguien del local entra a cargar.') + '</p>');
        return;
      }
      if (silencioso) redibujar(); else dibujar(true);
    }).catch(function (e) {
      if (pedido !== ST.pedido) return;
      if (silencioso) { if (Object.keys(sinGuardar).length) pintarGuardado(); else estado('Sin conexión', 'mal'); return; }
      fallo(e, function () { cargarMes(); });
    });
  }

  /* ══ Dibujar ════════════════════════════════════════════════════════════ */
  function edita() { return !!(ST.D && ST.D.puede === 'escribir'); }
  function editaPesos() { return edita() && !!ST.D.supervisa; }

  function dibujar(arriba) {
    var D = ST.D, ec = !!D.ecom;
    /* El e-commerce tiene su hoja; al volver a un local, vuelve a la pestaña que tenía. */
    $('vtApp').classList.toggle('ecom', ec);
    if (ec) { if (ST.hoja !== 'ecom') ST.hojaLocal = ST.hoja; ST.hoja = 'ecom'; }
    else if (ST.hoja === 'ecom') ST.hoja = ST.hojaLocal || 'ventas';
    if (ec) ST.C = VC.ecom(D);
    else {
      ST.C = VC.calcular(D);
      /* Lo cargado, a mano para las celdas. */
      ST.venta = {}; ST.tiene = {};
      (D.ventas || []).forEach(function (r) { (ST.venta[r[0]] = ST.venta[r[0]] || {})[r[1]] = Number(r[2]); ST.tiene[r[0]] = true; });
      /* SQL 181: las vacaciones de cada uno en este mes, [primer día, último día, motivo] (Config → Usuarios). */
      ST.vac = {};
      (D.vendedores || []).forEach(function (v) { ST.vac[v.id] = v.vacaciones || []; });
    }
    document.querySelectorAll('.vt-pest').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === ST.hoja)); });
    $('vtMesPest').textContent = nombreMes(ST.mes);
    var h = $('vtHoja');
    if (ec) h.innerHTML = hojaEcom(ST.C);
    else if (ST.hoja === 'temporada') h.innerHTML = hojaTemporada();
    else h.innerHTML = ST.hoja === 'trafico' ? hojaTrafico(ST.C) : ST.hoja === 'vendedor' ? hojaVendedor(ST.C) : hojaVentas(ST.C);
    mostrar('hoja');
    if (arriba) posicionar();
  }

  /* Dónde queda la hoja al abrirla: donde la dejó en esta pestaña (mismo local y mes); si es la primera vez,
     en Ventas y Tráfico la semana de hoy (lo que se carga todos los días), y si no, arriba de todo. */
  var posDe = {};
  function clavePos() { return (ST.local ? ST.local.id : '') + '|' + ST.mes + '|' + ST.hoja; }
  function recordarPos() { if (ST.D && ST.D.cfg && !$('vtHoja').hidden) posDe[clavePos()] = $('vtScroll').scrollTop; }
  function posicionar() {
    var sc = $('vtScroll'), antes = posDe[clavePos()];
    if (antes !== undefined) { sc.scrollTop = antes; return; }
    sc.scrollTop = 0;
    var th = (ST.hoja === 'ventas' || ST.hoja === 'trafico' || ST.hoja === 'ecom') ? $('vtHoja').querySelector('th.hoy') : null;
    if (th) sc.scrollTop = Math.max(0, th.closest('table').getBoundingClientRect().top - sc.getBoundingClientRect().top - 8);
  }

  /* Vuelve a dibujar sin perder la celda ni el lugar (después de que el foco pasó a la de abajo). */
  var pendienteDibujo = false, focoPedido = null;
  function redibujar(foco) {
    if (foco) focoPedido = foco;           // si ya había uno en camino, se lleva este foco
    if (pendienteDibujo) return;
    pendienteDibujo = true;
    setTimeout(function () {
      pendienteDibujo = false;
      var fp = focoPedido; focoPedido = null;
      if (!ST.D || !ST.D.cfg) return;
      var sc = $('vtScroll'), a = document.activeElement;
      var k = fp || (a && a.getAttribute && a.closest && a.closest('#vtHoja') ? a.getAttribute('data-k') : null);
      var km = a && a.getAttribute ? a.getAttribute('data-mes') : null;
      var st = sc.scrollTop, sl = sc.scrollLeft;
      dibujar();
      sc.scrollTop = st; sc.scrollLeft = sl;
      if (k) {
        var sel = '[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]' + (km ? '[data-mes="' + km + '"]' : '');
        var n = $('vtHoja').querySelector(sel);
        if (n) { n.focus({ preventScroll: true }); if (n.select) n.select(); }
      }
    }, 0);
  }

  /* Una celda que se carga. que|clave dicen qué es en la base (ventas_guardar). */
  function texto(v, tipo) {
    if (!def(v)) return '';
    if (tipo === 'money') return pesos(v);
    if (tipo === 'pct') return pcIn(v);
    if (tipo === 'pctc') return (v * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '%';
    if (tipo === 'dec' || tipo === 'dias') return decLibre(v);
    if (tipo === 'int') return nf(v);
    return String(v);
  }
  function entrada(que, clave, v, tipo, cl, extra, puede) {
    cl = cl || ''; extra = extra || '';
    var tit = tipo === 'txt' && v ? ' title="' + esc(v) + '"' : '';     // un nombre que no entra se lee al pasar el mouse
    if (!(puede === undefined ? edita() : puede)) return '<td class="' + cl + '"' + tit + '>' + esc(texto(v, tipo)) + '</td>';
    return '<td class="ed ' + cl + '"' + tit + '><input data-k="' + esc(que + '|' + clave) + '" data-t="' + tipo + '" value="' + esc(texto(v, tipo)) + '"' +
      (tipo === 'txt' ? ' maxlength="60"' : ' inputmode="decimal"') + ' autocomplete="off" spellcheck="false" ' + extra + '></td>';
  }
  function kpi(et, val, sub, cl) {
    return '<div class="vt-kpi"><div class="et">' + et + '</div><div class="val ' + (cl || '') + '">' + val + '</div><div class="sub">' + sub + '</div></div>';
  }
  function titulo(que) {
    return '<div class="titulo">  ' + esc(String(ST.D.local.nombre || '').toUpperCase()) + '  ·  ' + que + '  ·  ' +
      nombreMes(ST.mes).toUpperCase() + ' ' + anioMes(ST.mes) + '</div>';
  }
  var COLG_SEM = '<colgroup><col style="width:168px"><col><col><col><col><col><col><col><col style="width:122px"><col style="width:112px"></colgroup>';
  function colsDe(w) { var c = [null, null, null, null, null, null, null]; w.dias.forEach(function (x) { c[x.k] = x; }); return c; }
  function hoyCl(C, x) { return x && x.d === C.hoy && !C.cerrado ? ' col-hoy' : ''; }
  function esHoy(C, x) { return x && x.d === C.hoy && !C.cerrado; }
  function nombrados(C) { return C.V.filter(function (v) { return !v.sin; }); }

  /* ── Hoja Ventas ─────────────────────────────────────────────────────── */
  function hojaVentas(C) {
    var c = C.c, V = nombrados(C), h = titulo('VENTAS');
    h += '<div class="vt-kpis k4">' + kpi('Avance del mes', pc(C.avance, 1), '% cumplimiento') + kpi('Venta acumulada', pesos(C.E4), 'mes a mes') +
      kpi('Faltan vender', pesos(C.faltan), 'para cerrar el mes') + kpi('Desvío acumulado', pesos(C.desvAcum), 'vs objetivo a hoy', sem(C.realHoy, C.objHoy)) + '</div>';
    var hay = C.rkSem.some(function (r) { return Math.trunc(r.venta) > 0; }), hayM = C.rkMes.some(function (r) { return Math.trunc(r.real) > 0; });
    var filaSem = '', filaMes = '';
    for (var i = 0; i < 3; i++) {
      var s = C.rkSem[i], m = C.rkMes[i], conS = hay && s && Math.trunc(s.venta) > 0, conM = hayM && m && Math.trunc(m.real) > 0;
      filaSem += '<tr><td class="med m' + i + '">' + MED[i] + '  ' + (conS ? esc(s.nombre) : '—') + '</td><td>' + pesos(s ? Math.trunc(s.venta) : 0) + '</td><td class="av">' + pc(s && hay ? s.av : 0) + '</td></tr>';
      filaMes += '<tr><td class="med m' + i + '">' + MED[i] + '  ' + (conM ? esc(m.nombre) : '—') + '</td><td class="ob">' + pesos(m ? m.obj : 0) + '</td><td>' + pesos(m ? Math.trunc(m.real) : 0) + '</td><td class="av">' + pc(m ? m.av : 0, 1) + '</td></tr>';
    }
    h += '<div class="rankings"><div class="rk"><div class="rk-tit">RANKING SEMANAL<span>semana ' + C.semAct + '</span></div>' +
      '<table><colgroup><col><col style="width:30%"><col style="width:18%"></colgroup><tr><th class="izq">Vendedor</th><th>Venta sem</th><th>Av%</th></tr>' + filaSem + '</table></div>' +
      '<div class="rk"><div class="rk-tit">RANKING DEL MES</div><table><colgroup><col><col style="width:22%"><col style="width:22%"><col style="width:15%"></colgroup>' +
      '<tr><th class="izq">Vendedor</th><th>Objetivo</th><th>Real</th><th>Avance</th></tr>' + filaMes + '</table></div></div>';
    /* El desvío de la proyección va como todos los demás (proyección − objetivo: positivo = pasa el objetivo);
       la planilla lo restaba al revés (D13 = G18 − C13) y un verde quedaba con signo menos. */
    function proyDesv(p) { return def(p) ? '<span class="v2 ' + sem(p, c.obj) + '">' + pesosP(p - c.obj) : '<span class="v2">'; }
    h += '<div class="proy">' +
      '<div><span class="nom">Proyección ponderada</span><span class="v1">' + (def(C.proyPond) ? pesos(C.proyPond) : 'Sin datos') + '</span><span></span>' + proyDesv(C.proyPond) + '<span class="s">desvío vs objetivo</span></span></div>' +
      '<div><span class="nom">Proyección lineal</span><span class="v1">' + (def(C.proyLin) ? pesos(C.proyLin) : 'Sin datos') + '</span><span></span>' + proyDesv(C.proyLin) + '<span class="s">desvío vs objetivo</span></span></div>' +
      '<div class="pagos"><span class="nom">Medios de pago</span><span class="pv">' + pc(C.efectivoPct) + '<span class="s">Efectivo</span></span><span class="pv">' + pc(C.tarjetaPct) + '<span class="s">Tarjeta</span></span><span class="pv desc">' + pc(C.descPct) + '<span class="s">Descuento</span></span></div></div>';

    /* Configuración */
    var sumaOk = Math.abs(C.pctSuma - 1) < 0.0005, colsV = '';
    for (var j = 0; j < V.length; j++) colsV += '<col>';
    h += '<div class="banda">  CONFIGURACIÓN  —  celdas en ámbar son editables</div><div class="cfg">' +
      '<table><colgroup><col style="width:150px"><col><col style="width:190px"><col><col style="width:100px"><col><col style="width:110px"><col></colgroup><tr>' +
      '<th class="izq">Nombre del local</th><td class="amb">' + esc(String(ST.D.local.nombre || '').toUpperCase()) + '</td>' +
      '<th>Objetivo Mensual del Local</th>' + entrada('config', 'objetivo', c.obj || null, 'money', 'amb g', 'aria-label="Objetivo mensual del local"') +
      '<th>Conversión</th>' + entrada('config', 'conversion', c.conv || null, 'pct', 'amb g', 'aria-label="Conversión objetivo"') +
      '<th>Ticket Prom.</th>' + entrada('config', 'ticket', c.tp || null, 'money', 'amb g', 'aria-label="Ticket promedio objetivo"') + '</tr></table>' +
      /* Con muchos vendedores la caja de Efectivo baja y cada uno tiene su ancho (si igual no entran, la tabla se desliza sola). */
      '<div class="cfg-fila' + (V.length > 5 ? ' muchos' : '') + '"><div class="cfg-vend-env"><table class="cfg-vend" style="min-width:' + (150 + V.length * 110 + (edita() ? 150 : 0)) + 'px"><colgroup><col style="width:150px">' + colsV + (edita() ? '<col style="width:150px">' : '') + '</colgroup>' +
      '<tr><th class="izq">Vendedores</th>' + V.map(function (v) {
        return entrada('vendedor', v.id + ':nombre', v.nombre, 'txt', 'amb', 'placeholder="Nombre" aria-label="Nombre del vendedor"');
      }).join('') + (edita() ? '<td rowspan="2" style="padding:4px"><button type="button" class="btn-add" data-acc="agregar">+ Sumar vendedor</button></td>' : '') + '</tr>' +
      /* Si todas las semanas se reparten a mano, el % del mes es lo que dio eso y no se escribe; si alguna va con
         el % de siempre, se sigue escribiendo acá (es el de esas semanas). */
      '<tr><th class="izq">% Objetivo mensual</th>' + V.map(function (v) {
        if (todoPorSemana(C)) return '<td class="azul" title="Sale de las semanas (ver abajo de esta tabla)">' + pcIn(v.pctMes) + '</td>';
        return entrada('vendedor', v.id + ':pct', v.pct, 'pct', 'amb', 'aria-label="% del objetivo de ' + esc(v.nombre) + '"');
      }).join('') + '</tr>' +
      '<tr><th class="izq">Objetivo vendedor</th>' + V.map(function (v) {
        var vacio = !ST.tiene[v.id] && !tieneSemanal(v.id);
        return '<td class="calc-m">' + mill(c.obj * v.pctMes) + (edita() && vacio ? '<br><button type="button" class="quitar" data-acc="quitar" data-id="' + v.id + '">Quitar</button>' : '') + '</td>';
      }).join('') +
      (edita() ? '<td class="suma ' + (sumaOk ? 'ok' : 'mal') + '">' + (sumaOk ? 'Suman 100%' : 'Suman ' + pcIn(C.pctSuma) + ': ' + (C.pctSuma < 1 ? 'falta repartir ' + pcIn(1 - C.pctSuma) : 'sobra ' + pcIn(C.pctSuma - 1))) + '</td>' : '') + '</tr>' +
      '</table></div>' +
      '<table class="cfg-caja"><colgroup><col style="width:148px"><col></colgroup>' +
      '<tr><th class="izq">Efectivo (acum.)</th>' + entrada('config', 'efectivo', c.efectivo || null, 'money', 'amb', 'aria-label="Efectivo acumulado"') + '</tr>' +
      '<tr><th class="izq">Descuento (acum.)</th>' + entrada('config', 'descuento', c.descuento || null, 'money', 'amb', 'aria-label="Descuento acumulado"') + '</tr>' +
      '<tr><td colspan="2" class="nota">Efectivo y Descuento se actualiza diariamente</td></tr></table></div>' +
      '<table><colgroup><col style="width:150px"><col style="width:90px"><col style="width:130px"><col style="width:90px"><col style="width:120px"><col style="width:90px"><col></colgroup><tr>' +
      '<th class="izq">Días transcurridos</th><td class="amb">' + C.C22 + '</td><th>Días restantes</th><td class="azul">' + C.L18 + '</td>' +
      '<th>Días hábiles</th>' + entrada('config', 'dias_habiles', c.diasHabiles || null, 'int', 'amb g', 'aria-label="Días hábiles"') + '<td style="border:0"></td></tr></table></div>' +
      '<p class="aviso-carga">⚠️ Cargá la venta el día que pasó. Si no vendió, poné 0. No cargues nada en días que todavía no llegaron (dejalos vacíos)</p>';
    if (editaPesos()) {
      var sSem = suma(C.sem.map(function (w) { return w.peso; }));
      h += '<p class="aviso-carga" style="padding-top:0">El reparto del objetivo (los % grises arriba de cada semana) lo cambia el encargado o el supervisor.' +
        (Math.abs(sSem - 1) > 0.0005 ? ' <b style="color:var(--mal)">Las semanas suman ' + pcIn(sSem) + ', no 100%.</b>' : '') + '</p>';
    }
    h += avisoReparto(C);

    h += '<div class="semanas-pad">' + C.sem.map(function (w) { return semanaVentas(C, w); }).join('') + '</div>';

    h += '<div class="banda escalon">  ESCALÓN DE OBJETIVOS  ·  Premio · Falta · Ritmo</div>' +
      '<table class="esc"><tr><th>Nivel</th><th>Objetivo</th><th>Premio</th><th>Venta acum.</th><th>Falta</th><th>Desvío %</th><th>Días rest.</th><th>Obj. diario</th><th>Ritmo diario</th><th>Estado</th></tr>' +
      C.escalon.map(function (e, i) {
        return '<tr><td>' + e.nivel + '</td><td>' + pesos(e.meta) + '</td>' + entrada('premio', String(i), e.premio, 'money', 'amb', 'aria-label="Premio ' + e.nivel + '"') +
          /* Desvío % es cuánto del nivel ya se vendió (G92): a mitad de mes siempre está lejos, así que sólo se pinta
             de verde al llegar, como la planilla. El que dice si se va bien es el Estado: el ritmo contra lo que hace falta por día. */
          '<td>' + pesos(C.E4) + '</td><td>' + pesos(e.falta) + '</td><td class="' + (e.desv >= 1 ? 'sv' : '') + '">' + pc(e.desv, 1) + '</td><td class="dias">' + C.L18 + '</td><td>' + pesos(e.objDia) + '</td><td>' + pesos(e.ritmo) + '</td>' +
          '<td class="' + (e.objDia > 0 ? sem(e.ritmo, e.objDia) : 'sv') + '">' + (e.ok ? '✅ En ritmo' : '⚠️ Acelerar') + '</td></tr>';
      }).join('') + '</table>';
    return h;
  }

  /* ¿Todas las semanas se reparten a mano (ventas-calc: w.fuente)? */
  function todoPorSemana(C) { return C.sem.every(function (w) { return w.fuente !== 'mes'; }); }
  function listaY(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a.join(''); }

  /* Las semanas que se reparten a mano (unas vacaciones), dichas arriba de las semanas, con su motivo. */
  function avisoReparto(C) {
    var mano = C.sem.filter(function (w) { return w.fuente === 'mano'; }), mot = [];
    if (!mano.length) return '';
    (ST.D.reparto || []).forEach(function (r) { if (r[3] && mot.indexOf(r[3]) < 0) mot.push(r[3]); });
    return '<p class="aviso-carga" style="padding-top:0">' + (mano.length > 1 ? 'Las semanas ' : 'La semana ') +
      listaY(mano.map(function (w) { return w.n; })) + ' se reparte' + (mano.length > 1 ? 'n' : '') + ' a mano' +
      (mot.length ? ': ' + esc(mot.join(' · ')) : '') + '.</p>';
  }

  function tieneSemanal(vid) {
    return (ST.D.semanal || []).some(function (r) {
      return Number(r.v) === Number(vid) && [r.t, r.c, r.tp, r.pf, r.bx, r.pxt].some(def);
    });
  }

  function semanaVentas(C, w) {
    var c = C.c, V = nombrados(C), sin = C.V.filter(function (v) { return v.sin; }), cols = colsDe(w), ep = editaPesos();
    /* El desvío de cada vendedor es el de la planilla (K29): contra SU objetivo de la semana, que en los
       locales con la tabla de días trabajados se ajusta por los días que trabajó (ventas-calc, iv). */
    var b = C.sem.indexOf(w), ivDe = {};
    (C.iv || []).forEach(function (x) { ivDe[x.v.id] = x; });
    function objV(v) {
      var s = ivDe[v.id] && ivDe[v.id].semanas[b];
      return s && def(s.crudo) ? s.crudo : c.obj * w.parte[v.id] * w.peso;
    }
    function desvioV(v) { return w.porVend[v.id] - objV(v); }
    /* El semáforo de un día o de la semana: sólo con la venta cargada (un día que no llegó queda sin color). */
    function semDia(x) { return x.cargado ? sem(x.real, x.obj) : ''; }
    var semSem = w.empezo && w.dias.some(function (x) { return x.cargado; }) ? sem(w.real, w.obj) : '';
    function cel(f) { return cols.map(function (x, k) { return x ? f(x, k) : '<td class="vt-vacio"></td>'; }).join(''); }
    var t = '<table class="sem">' + COLG_SEM + '<tbody>';
    var sDias = suma(w.dias.map(function (x) { return x.peso; }));
    t += '<tr class="pesos"><td></td>' + cols.map(function (x, k) {
      if (!x) return '<td></td>';
      return ep ? entrada('peso_dia', String(x.d), x.peso, 'pct', '', 'aria-label="% del ' + DIAS[k] + ' ' + x.d + ' en la semana"') : '<td>' + pc(x.peso) + '</td>';
    }).join('') + (ep ? entrada('peso_semana', String(w.n), w.peso, 'pct', '', 'aria-label="% de la semana ' + w.n + ' en el mes"') : '<td>' + pc(w.peso) + '</td>') +
      '<td>' + (ep && Math.abs(sDias - 1) > 0.0005 ? '<span class="suma-mal" title="Los días de la semana tienen que sumar 100%">Σ ' + pcIn(sDias) + '</span>' : '') + '</td></tr>';
    t += '<tr class="cab"><th class="izq">  Semana ' + w.n + '</th>' + cols.map(function (x, k) {
      return x ? '<th class="' + (esHoy(C, x) ? 'hoy' : '') + '">' + DIAS[k] + ' ' + x.d + (esHoy(C, x) ? '<span class="pill-hoy">hoy</span>' : '') + '</th>' : '<th></th>';
    }).join('') + '<th>Obj. Semanal</th><th>Desvío</th></tr>';
    t += '<tr class="obj"><td class="izq">Objetivo</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + '">' + pesos(x.obj) + '</td>'; }) +
      '<td class="tot">' + pesos(w.obj) + '</td><td class="tot"></td></tr>';
    t += '<tr class="real"><td class="izq">Venta real</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + ' ' + semDia(x) + '">' + pesos(x.real) + '</td>'; }) +
      '<td class="tot">' + pesos(w.real) + '</td><td class="tot ' + semSem + '">' + pesosP(w.real - w.obj) + '</td></tr>';
    t += '<tr class="desv"><td class="izq">Desvío %</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + (x.real && x.obj ? ' ' + semDia(x) : '') + '">' + (x.real && x.obj ? sp(x.real / x.obj - 1) : '') + '</td>'; }) +
      '<td class="' + (w.real && w.obj ? semSem : '') + '">' + (w.real && w.obj ? sp(w.real / w.obj - 1) : '') + '</td><td></td></tr>';
    V.forEach(function (v, r) {
      t += '<tr class="vend"><td class="izq">' + esc(v.nombre) + '</td>' + cel(function (x, k) { return celdaVenta(C, v, x, r, w, k); }) +
        '<td class="tot">' + pesos(w.porVend[v.id]) + '</td><td class="tot ' + (semSem ? sem(w.porVend[v.id], objV(v)) : '') + '">' + pesosP(desvioV(v)) + '</td></tr>';
    });
    sin.forEach(function (v) {
      if (!w.dias.some(function (x) { return def((ST.venta[v.id] || {})[x.d]); })) return;
      var total = suma(Object.keys(ST.venta[v.id] || {}).map(function (d) { return ST.venta[v.id][d]; }));
      t += '<tr class="sinv"><td class="izq"><span class="chip-mal">Sin vendedor</span></td>' +
        cel(function (x) { var m = (ST.venta[v.id] || {})[x.d]; return '<td>' + (def(m) ? pesos(m) : '') + '</td>'; }) +
        (edita() && V.length ? '<td colspan="2" style="padding:3px 6px"><select data-acc="asignar" data-desde="' + v.id + '" aria-label="¿De quién es la venta sin vendedor?" title="Pasa los ' + pesos(total) + ' sin vendedor del mes">' +
          '<option value="">¿De quién es?</option>' + V.map(function (o) { return '<option value="' + o.id + '">' + esc(o.nombre) + '</option>'; }).join('') + '</select></td>'
          : '<td class="tot">' + pesos(w.sinV) + '</td><td class="tot">' + pesosP(w.sinV) + '</td>') + '</tr>';
    });
    return t + '</tbody></table>';
  }

  /* SQL 181: si ese día está de vacaciones, el motivo ('' si no tiene); si no, null. */
  function deVacaciones(v, d) {
    var a = (ST.vac[v.id] || []).filter(function (p) { return d >= p[0] && d <= p[1]; })[0];
    return a ? a[2] || '' : null;
  }

  function celdaVenta(C, v, x, r, w, k) {
    var val = (ST.venta[v.id] || {})[x.d], franco = v.francos.indexOf(k) >= 0, vac = deVacaciones(v, x.d);
    var titVac = ' title="' + esc(String(v.nombre).split(' ')[0] + ' de vacaciones' + (vac ? ': ' + vac : '')) + '"';
    if (x.futuro) return '<td class="futuro' + (vac !== null ? ' vac' : franco ? ' franco' : '') + '"' + (vac !== null ? titVac : ' title="Todavía no llegó: se carga el día que pasó"') + '></td>';
    /* De vacaciones: como un franco, pero sin poder cargarlo (Mauricio, 26/10). Si ya había algo cargado, se ve y cuenta. */
    if (vac !== null) return '<td class="vac' + hoyCl(C, x) + '"' + titVac + '>' + (def(val) ? pesos(val) : '') + '</td>';
    /* Sin el borde de "Falta cargar" (26/10, Mauricio): un día vacío es un día que no vino o no vendió, no algo
       incompleto (en octubre lo marcaba en 311 celdas, casi todas de francos sin anotar y de los que cubren). */
    var cl = (franco ? 'franco' : '') + hoyCl(C, x);
    var tit = franco ? ' title="Franco de ' + esc(String(v.nombre).split(' ')[0]) + '"' : '';
    if (!edita()) return '<td class="' + cl + '"' + tit + '>' + (def(val) ? pesos(val) : '') + '</td>';
    return entrada('venta', v.id + ':' + x.d, val, 'money', cl, 'data-g="s' + w.n + '" data-r="' + r + '" data-c="' + k + '" aria-label="' + esc(v.nombre) + ', ' + DIAS[k] + ' ' + x.d + '"' + tit)
      .replace('<td class="ed', '<td' + tit + ' class="ed');
  }

  /* ── Hoja Tráfico ────────────────────────────────────────────────────── */
  function hojaTrafico(C) {
    var c = C.c, T = C.traf, h = titulo('TRAFICO');
    h += '<div class="vt-kpis k5">' + kpi('Tráfico acumulado', T.sumT ? nf(T.sumT) : '—', nf(T.sumT) + ' de ' + nf(T.necTot) + ' necesarios') +
      kpi('Conversión real', def(T.D4) ? pc(T.D4, 1) : '—', 'objetivo: ' + pc(c.conv), sem(T.D4, c.conv)) + kpi('Ticket promedio', def(T.F4) ? pesos(T.F4) : '—', 'objetivo: ' + pesos(c.tp), sem(T.F4, c.tp)) +
      kpi('Proyección tráfico', def(T.H4) ? nf(T.H4) : 'Sin datos', 'necesario: ' + nf(T.necTot), sem(T.H4, T.necTot)) + kpi('Prendas por ticket', dec(T.pxt, 2), 'objetivo ' + dec(c.pxtObj), T.pxt ? sem(T.pxt, c.pxtObj) : '') + '</div>';
    h += '<div class="banda gris">  TICKET PROMEDIO NECESARIO POR OBJETIVO</div><table class="tp-nec"><tr><th>Nivel</th><th>TP necesario</th><th>TP actual</th><th>Desvío</th></tr>' +
      T.tpNec.map(function (r) {
        return '<tr><td>' + r.nivel + '</td><td class="grande">' + (def(r.nec) ? pesos(r.nec) : '—') + '</td><td>' + (def(r.act) ? pesos(r.act) : '—') + '</td>' +
          '<td class="' + (def(r.desv) ? sem(r.act, r.nec) : '') + '">' + (def(r.desv) ? pesosP(r.desv) : '—') + '</td></tr>';
      }).join('') + '</table>';
    /* Los mismos cortes del semáforo (la planilla decía "levemente bajo" hasta −10%). */
    var msg = T.sinDatos ? 'Sin datos de tráfico cargados aún.'
      : T.L5 >= 0 ? '✅  Ritmo de tráfico en línea con el objetivo. Sin necesidad de compensar.'
      : sem(1 + T.L5, 1) === 'sa' ? '🟡  Tráfico levemente bajo (' + sp(T.L5) + '). Compensar con conversión o ticket.'
      : '🔴  Tráfico bajo (' + sp(T.L5) + '). Para llegar igual: conv. a ' + (def(T.convNec) ? pc(T.convNec) : '—') + ' o TP a ' + (def(T.tpComp) ? pesos(T.tpComp) : '—') + '. Activar captación urgente.';
    h += '<div class="banda ritmo">  RITMO DE TRÁFICO</div><table class="ritmo-t"><colgroup><col style="width:22%"><col style="width:22%"><col><col><col><col></colgroup>' +
      '<tr><th>Métrica</th><th>Ritmo actual</th><th colspan="4">Para compensar</th></tr>' +
      '<tr><td class="grande" style="font-size:14px">Tráfico</td><td class="grande ' + (T.sinDatos ? '' : sem(1 + T.L5, 1)) + '">' + (T.sinDatos ? '—' : sp(T.L5) || '0%') + '</td><td class="chico">Conv. necesaria:</td>' +
      '<td class="grande" style="font-size:15px">' + (def(T.convNec) ? pc(T.convNec) : '—') + '</td><td class="chico">TP:</td><td class="grande" style="font-size:15px">' + (def(T.tpComp) ? pesos(T.tpComp) : '—') + '</td></tr></table>' +
      '<div class="ritmo-msg">' + esc(msg) + '</div>';
    h += '<div class="banda">  CONFIGURACIÓN  —  conectada a Ventas automáticamente · celdas en ámbar son editables</div><div class="cfg2">' +
      '<table><colgroup><col style="width:170px"><col><col style="width:190px"><col><col style="width:110px"><col><col style="width:130px"><col></colgroup>' +
      '<tr><th class="izq">Local</th><td class="azul">' + esc(String(ST.D.local.nombre || '').toUpperCase()) + '</td><th>Objetivo Mensual del Local</th><td class="verde">' + pesos(c.obj) + '</td><th>Conversión</th><td class="verde">' + pc(c.conv) + '</td><th>Ticket Promedio</th><td class="verde">' + pesos(c.tp) + '</td></tr>' +
      '<tr><th class="izq">Días hábiles restantes</th><td class="verde">' + C.L18 + '</td><th>Días hábiles</th><td class="verde">' + c.diasHabiles + '</td><th colspan="2" class="nota" style="text-align:center">Prendas por Ticket: actualizar diariamente</th><th>Q Líneas · Q Prendas</th>' +
      '<td style="padding:0"><table style="height:100%"><tr>' + entrada('config', 'q_lineas', c.qLineas || null, 'int', 'amb', 'aria-label="Q líneas (tickets)"') + entrada('config', 'q_prendas', c.qPrendas || null, 'int', 'amb', 'aria-label="Q prendas"') + '</tr></table></td></tr>' +
      '<tr><td colspan="8" class="nota izq">  Ingresá tráfico real y conversión real día a día en cada semana</td></tr></table></div>';
    h += '<div class="semanas-pad">' + C.sem.map(function (w) { return semanaTrafico(C, w); }).join('') + '</div>';
    return h;
  }

  function semanaTrafico(C, w) {
    var c = C.c, cols = colsDe(w), NOM = ['Tráfico real', 'Conversión real', 'Ticket promedio real'];
    function cel(f) { return cols.map(function (x, k) { return x ? f(x, k) : '<td class="vt-vacio"></td>'; }).join(''); }
    function campo(x, k, i, tipo) {
      var v = [x.t, x.cv, x.tk][i];
      if (x.futuro) return '<td class="futuro" title="Todavía no llegó: se carga el día que pasó"></td>';
      return entrada('trafico', x.d + ':' + ['trafico', 'conversion', 'ticket'][i], v, tipo, hoyCl(C, x).trim(),
        'data-g="t' + w.n + '" data-r="' + i + '" data-c="' + k + '" aria-label="' + NOM[i] + ', ' + DIAS[k] + ' ' + x.d + '"');
    }
    var t = '<table class="sem">' + COLG_SEM + '<tbody>';
    t += '<tr class="cab"><th class="izq">  Semana ' + w.n + '</th>' + cols.map(function (x, k) {
      return x ? '<th class="' + (esHoy(C, x) ? 'hoy' : '') + '">' + DIAS_C[k] + ' ' + x.d + (esHoy(C, x) ? '<span class="pill-hoy">hoy</span>' : '') + '</th>' : '<th></th>';
    }).join('') + '<th>Total Sem</th><th>vs Necesario</th></tr>';
    t += '<tr class="necf"><td class="izq">Tráfico necesario</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + '">' + nf(x.nec) + '</td>'; }) + '<td class="tot">' + nf(w.tNec) + '</td><td class="tot"></td></tr>';
    t += '<tr class="real"><td class="izq">Tráfico real</td>' + cel(function (x, k) { return campo(x, k, 0, 'int'); }) + '<td class="tot">' + (def(w.tReal) ? nf(w.tReal) : '') + '</td>' +
      '<td class="tot ' + (def(w.tReal) ? sem(w.tReal, w.tNec) : '') + '">' + (def(w.tReal) ? (w.tReal - w.tNec > 0 ? '+' : '') + nf(w.tReal - w.tNec) : '-') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Conversión real</td>' + cel(function (x, k) { return campo(x, k, 1, 'pct'); }) + '<td class="tot">' + (def(w.tConv) ? pc(w.tConv) : '') + '</td><td class="tot ' + (def(w.tConv) ? sem(w.tConv, c.conv) : '') + '">' + (def(w.tConv) ? sp(w.tConv - c.conv) : '-') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Ticket promedio real</td>' + cel(function (x, k) { return campo(x, k, 2, 'money'); }) + '<td class="tot">' + (def(w.tTk) ? pesos(w.tTk) : '') + '</td><td class="tot ' + (def(w.tTk) ? sem(w.tTk, c.tp) : '') + '">' + (def(w.tTk) ? pesos(w.tTk - c.tp) : '-') + '</td></tr>';
    return t + '</tbody></table>';
  }

  /* ── Hoja Informe Vendedor ───────────────────────────────────────────── */
  function hojaVendedor(C) {
    var c = C.c, V = nombrados(C), n = C.sem.length, cols = '';
    for (var i = 0; i < n; i++) cols += '<col>';
    var colg = '<colgroup><col style="width:190px">' + cols + '<col style="width:120px"><col style="width:100px"></colgroup>';
    var h = titulo('INFORME POR VENDEDOR');
    h += '<div class="banda osc">  📊 RESUMEN DEL LOCAL POR SEMANA</div>';
    function filaR(nom, k, f) {
      /* Los desvíos son "real / objetivo − 1", menos el de conversión, que es la resta (J7 = I7 − conv. objetivo). */
      var d = C.resD[k], cl = !def(d) ? '' : k === 'c' ? sem(C.resT.c, c.conv) : sem(1 + d, 1);
      return '<tr><td class="izq">' + nom + '</td>' + C.res.map(function (r) { return '<td>' + (def(r[k]) ? f(r[k]) : '') + '</td>'; }).join('') +
        '<td class="tt">' + (def(C.resT[k]) ? f(C.resT[k]) : '') + '</td><td class="' + cl + '">' + sp(d) + '</td></tr>';
    }
    h += '<table class="res">' + colg + '<tr><th class="izq">Métrica</th>' + C.sem.map(function (w) { return '<th>Sem ' + w.n + '</th>'; }).join('') + '<th>Total/Prom</th><th>Desvío</th></tr>' +
      filaR('Venta', 'venta', pesos) + filaR('Tráfico', 't', nf) + filaR('Conversión', 'c', function (x) { return pc(x); }) + filaR('TP', 'tp', pesos) +
      filaR('Perfumes', 'pf', nf) + filaR('Boxer', 'bx', nf) + filaR('PxT', 'pxt', function (x) { return dec(x); }) + '</table>';
    var ancho = Math.max(V.length, n), relleno = function (k) { var s = ''; for (var j = 0; j < k; j++) s += '<td></td>'; return s; };
    var colsP = ''; for (var q = 0; q < ancho; q++) colsP += '<col>';
    h += '<div class="banda">  CONFIGURACIÓN  —  ámbar editable · azul se calcula solo</div><div class="iv-cfg' + (V.length > 5 ? ' muchos' : '') + '">' +
      '<table><colgroup><col style="width:150px"><col></colgroup>' +
      '<tr><th>Objetivo Mensual</th><td class="azul">' + pesos(c.obj) + '</td></tr>' +
      '<tr><th>PxT objetivo</th>' + entrada('config', 'pxt_obj', c.pxtObj || null, 'dec', 'amb', 'aria-label="PxT objetivo"') + '</tr>' +
      '<tr><th>Factor Perf/Boxer</th>' + entrada('config', 'factor', c.factor || null, 'dec', 'amb', 'aria-label="Factor perfumes y boxer"') + '</tr>' +
      '<tr><th>Precio Perfume</th>' + entrada('config', 'precio_perfume', c.perfume || null, 'money', 'amb', 'aria-label="Precio del perfume"') + '</tr>' +
      '<tr><th>Precio Boxer</th>' + entrada('config', 'precio_boxer', c.boxer || null, 'money', 'amb', 'aria-label="Precio del boxer"') + '</tr></table>' +
      '<table class="panel"><colgroup><col style="width:150px">' + colsP + '</colgroup>' +
      '<tr><th>Nombre del local</th><td class="azul" colspan="' + ancho + '">' + esc(String(ST.D.local.nombre || '').toUpperCase()) + '</td></tr>' +
      '<tr><th>Conversión objetivo</th><td class="azul" colspan="' + ancho + '">' + pc(c.conv) + '</td></tr>' +
      '<tr><th>TP objetivo</th><td class="azul" colspan="' + ancho + '">' + pesos(c.tp) + '</td></tr>' +
      '<tr><th>Vendedores</th>' + V.map(function (v) { return '<td class="azul">' + esc(String(v.nombre).split(' ')[0] || '—') + '</td>'; }).join('') + relleno(ancho - V.length) + '</tr>' +
      '<tr><th>% Objetivo mensual</th>' + V.map(function (v) { return '<td class="azul">' + pcIn(v.pctMes) + '</td>'; }).join('') + relleno(ancho - V.length) + '</tr>' +
      '<tr><th>Peso por semana</th>' + C.sem.map(function (w) { return '<td class="azul">' + pc(w.peso) + '</td>'; }).join('') + relleno(ancho - n) + '</tr></table></div>';

    /* La tabla de días trabajados por semana (la que probaba Rivadavia) salió el 15/10: más adelante va una
       sección de vacaciones. Septiembre de Rivadavia sigue contando los días que tenía (con_dias), como la planilla. */
    h += '<p class="aviso-carga">  Ámbar = editás vos  ·  Azul = se calcula solo (viene de Ventas)  ·  Cargá el real de tráfico, conv, TP, perfumes, boxer y PxT por vendedor</p>';

    var METR = [['venta', 'Venta', pesos, null], ['t', 'Tráfico', nf, 'int'], ['c', 'Conversión', function (x) { return pc(x); }, 'pct'], ['tp', 'TP', pesos, 'money'],
      ['pf', 'Perfumes', nf, 'int'], ['bx', 'Boxer', nf, 'int'], ['pxt', 'PxT', function (x) { return dec(x); }, 'dec']];
    C.iv.forEach(function (x, vi) {
      if (x.v.sin && !x.conDatos) return;
      var nom = x.v.sin ? 'Sin vendedor' : x.v.nombre;
      h += '<div class="vb"><div class="vb-nom">' + esc(nom) + '<small>' + (x.v.sin ? 'lo cargado sin nombre en la planilla' : pcIn(x.v.pctMes) + ' del objetivo del local') + '</small></div>' +
        '<table>' + colg + '<tr class="cabv"><th class="izq">Métrica</th>' + C.sem.map(function (w) { return '<th>Sem ' + w.n + '</th>'; }).join('') + '<th>Total/Prom</th><th>Desvío</th></tr>';
      METR.forEach(function (m, mi) {
        var k = m[0], f = m[2], tipo = m[3];
        h += '<tr class="o"><td class="izq">' + m[1] + ' · obj</td>' + x.semanas.map(function (s) { return '<td>' + f(s.o[k]) + '</td>'; }).join('') + '<td>' + f(x.ob[k]) + '</td><td></td></tr>';
        var tot = x.tot[k], d = x.desv[k];
        /* Cada semana contra su objetivo (C27 contra C26, como la planilla) y el desvío del mes (J27 = real / obj − 1). */
        h += '<tr class="r"><td class="izq">' + m[1] + ' · real</td>' + x.semanas.map(function (s, j) {
          var cl = s.empezo && def(s.r[k]) ? sem(s.r[k], s.o[k]) : '';
          if (k === 'venta') return '<td class="blue ' + cl + '">' + (def(s.r.venta) ? pesos(s.r.venta) : '') + '</td>';
          if (!s.empezo) return '<td class="futuro" title="Esta semana todavía no empezó"></td>';
          return entrada('semanal', x.v.id + ':' + s.n + ':' + CAMPO_IV[k], s.r[k], tipo, cl,
            'data-g="iv' + vi + '" data-r="' + mi + '" data-c="' + j + '" aria-label="' + esc(nom) + ', ' + m[1] + ', semana ' + s.n + '"');
        }).join('') + '<td>' + (def(tot) ? f(tot) : '') + '</td><td class="' + (def(d) ? sem(1 + d, 1) : '') + '">' + sp(d) + '</td></tr>';
      });
      h += '</table></div>';
    });
    return h + '<div style="height:14px"></div>';
  }

  /* ── Hoja Informe Temporada ──────────────────────────────────────────── */
  function cargarTemporada(refrescar) {
    var meses = VC.semestre(ST.mes), clave = ST.local.id + '|' + meses[0], t = ST.temp;
    if (t && t.clave === clave && !refrescar) return;
    if (!t || t.clave !== clave) {
      t = ST.temp = { clave: clave, meses: meses, D: {}, listo: false, error: null };
      if (ST.D && ST.D.cfg && meses.indexOf(mesDeDatos(ST.D)) >= 0) t.D[mesDeDatos(ST.D)] = ST.D;
    }
    if (t.leyendo) return;
    t.leyendo = true;
    var local = ST.local.id, actual = ST.mes;
    Promise.all(meses.map(function (m) {
      if (m === actual) return Promise.resolve(null);
      return llamar('ventas_mes_leer', { p_local: local, p_mes: m, p_abrir: false });
    })).then(function (lista) {
      t.leyendo = false;
      lista.forEach(function (D, i) { if (D) t.D[meses[i]] = D; });
      var primera = !t.listo;
      t.listo = true; t.error = null;
      if (ST.temp !== t || ST.hoja !== 'temporada') return;
      redibujar();
      if (primera) setTimeout(function () { if (ST.hoja === 'temporada' && !$('vtHoja').hidden) posicionar(); }, 0);
    }).catch(function (e) {
      t.leyendo = false;
      if (t.listo) return;                       // un refresco que falló: queda lo que había
      t.error = motivo(e);
      if (ST.temp === t && ST.hoja === 'temporada') redibujar();
    });
  }
  function mesDeDatos(D) { return String(D && D.mes || '').slice(0, 10); }
  /* Los datos de un mes del semestre: el que se está mirando (ST.D) o el que juntó Temporada.
     Nunca ST.D con otro mes adentro (mientras se lee el mes nuevo, ST.D es todavía el de antes). */
  function mesTemp(m) { return ST.D && mesDeDatos(ST.D) === m ? ST.D : ST.temp && ST.temp.D[m]; }

  function hojaTemporada() {
    cargarTemporada();
    var t = ST.temp, meses = t.meses;
    var nomLocal = esc(String(ST.D.local.nombre || '').toUpperCase());
    var h = '<div class="titulo">  VDH  ·  INFORME DE TEMPORADA  ·  ' + nomLocal +
      '<small>Semestre comercial ' + nombreMes(meses[0]) + ' ' + anioMes(meses[0]) + ' – ' + nombreMes(meses[5]) + ' ' + anioMes(meses[5]) + '  ·  se arma solo con las hojas de cada mes</small></div>';
    if (t.error) return h + '<div class="tp-vacio">No se pudieron juntar los meses: ' + esc(t.error) + '</div>';
    if (!t.listo) return h + '<div class="tp-vacio">Juntando los 6 meses del semestre…</div>';
    var T = VC.temporada(meses.map(function (m) {
      var D = mesTemp(m);
      return { mes: m, D: D || null, C: D && D.cfg ? (D === ST.D && ST.C ? ST.C : VC.calcular(D)) : null };
    }));
    var F = T.filas;
    var ESTADO = { sin: '⚪ Sin datos', ok: '🟢 OK', cerca: '🟡 Cerca', atencion: '🔴 Atención' };
    h += '<div class="vt-kpis k4">' +
      /* La venta total no se pinta: a mitad de semestre se compara contra el semestre anterior entero. */
      kpi('Venta total semestre', pesos(T.real), conSigno(T.antDif) + '  vs semestre anterior') +
      kpi('Cumplimiento objetivo', pc(T.av, 1), conSigno(T.desv) + '  vs objetivo del semestre', sem(T.real, T.obj)) +
      kpi('Tráfico total', nf(T.t), pc(T.conv) + '  conversión promedio') +
      kpi('Ticket promedio', pesos(T.tk), conSigno(T.tkDesv) + '  vs objetivo ' + pesos(T.tkObj), T.tk ? sem(T.tk, T.tkObj) : '') + '</div>';

    /* Ventas por mes y tráfico */
    h += '<div class="tp-grid"><div><div class="banda">  📊  VENTAS POR MES   —   con acumulado corrido</div>' +
      '<table class="tp-tab"><colgroup><col style="width:92px"><col><col><col style="width:66px"><col><col><col style="width:96px"></colgroup>' +
      '<tr><th class="izq">Mes</th><th>Objetivo</th><th>Venta Real</th><th>Avance</th><th>Acum. Real</th><th>Desv. Acum.</th><th>Estado</th></tr>' +
      F.map(function (f) {
        var con = f.hay && f.empezo;                 // un mes que no empezó queda sin color
        return '<tr><td class="izq">' + f.nombre + '</td><td>' + (f.obj ? pesos(f.obj) : '') + '</td><td>' + (con ? pesos(f.real) : '') + '</td>' +
          '<td class="' + (f.obj && con ? sem(f.real, f.obj) : '') + '">' + (f.obj && con ? pc(f.av, 1) : '') + '</td><td>' + pesos(f.acum) + '</td>' +
          '<td class="' + (con ? sem(f.acum, f.acumObj) : '') + '">' + pesos(f.desvAcum) + '</td>' +
          '<td class="izq">' + ESTADO[f.estado] + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td class="izq">TOTAL</td><td>' + pesos(T.obj) + '</td><td>' + pesos(T.real) + '</td><td class="' + sem(T.real, T.obj) + '">' + pc(T.av, 1) + '</td><td>' + pesos(T.real) + '</td>' +
      '<td class="' + sem(T.real, T.obj) + '">' + pesos(T.desv) + '</td><td class="izq">' + ESTADO[T.estado] + '</td></tr></table></div>';
    h += '<div><div class="banda">  🎯  TRÁFICO · CONVERSIÓN · TICKET</div>' +
      '<table class="tp-tab"><colgroup><col style="width:92px"><col><col><col><col></colgroup>' +
      '<tr><th class="izq">Mes</th><th>Tráfico</th><th>Conv.</th><th>Ticket Prom.</th><th>PxT</th></tr>' +
      F.map(function (f) {
        var con = f.hay && f.empezo;
        return '<tr><td class="izq">' + f.nombre + '</td><td>' + (con && f.t ? nf(f.t) : '') + '</td><td>' + (con && f.conv ? pc(f.conv) : '') + '</td>' +
          '<td>' + (con && f.tk ? pesos(f.tk) : '') + '</td><td>' + (con && f.pxt ? dec(f.pxt, 2) : '') + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td class="izq">PROMEDIO</td><td>' + nf(T.t) + '</td><td>' + pc(T.conv) + '</td><td>' + pesos(T.tk) + '</td><td>' + dec(T.pxt, 2) + '</td></tr></table></div></div>';

    /* Ranking y foco */
    var filasRk = T.rk.map(function (r, i) {
      return '<tr><td class="med' + (i < 3 ? ' m' + i : '') + '">' + (i < 3 ? MED[i] : i + 1) + '  ' + esc(r.nombre) + '</td><td>' + pesos(r.venta) + '</td><td>' + pc(r.part, 1) + '</td><td>' + (def(r.pxt) ? dec(r.pxt, 2) : '') + '</td></tr>';
    });
    if (T.sinV > 0) filasRk.push('<tr class="sinv"><td class="med">·  Sin vendedor</td><td>' + pesos(T.sinV) + '</td><td>' + pc(T.real ? T.sinV / T.real : 0, 1) + '</td><td></td></tr>');
    if (T.otros > 0) filasRk.push('<tr><td class="med">·  Otros del semestre</td><td>' + pesos(T.otros) + '</td><td>' + pc(T.real ? T.otros / T.real : 0, 1) + '</td><td></td></tr>');
    var b = T.base || {};
    h += '<div class="tp-grid"><div><div class="banda">  🏆  RANKING SEMESTRAL</div><table class="tp-tab tp-rk"><colgroup><col><col style="width:130px"><col style="width:70px"><col style="width:62px"></colgroup>' +
      '<tr><th class="izq">Vendedor</th><th>Venta Acum.</th><th>Part.</th><th>PxT</th></tr>' +
      (filasRk.length ? filasRk.join('') : '<tr><td colspan="4">Todavía no hay ventas cargadas</td></tr>') +
      '<tr class="tot"><td class="izq">TOTAL EQUIPO</td><td>' + pesos(T.real) + '</td><td>' + (T.real ? '100%' : '') + '</td><td>' + (def(T.rkPxt) ? dec(T.rkPxt, 2) : '') + '</td></tr></table></div>';
    h += '<div><div class="banda">  🔎  FOCO DEL SEMESTRE</div><table class="tp-tab tp-foco"><colgroup><col style="width:40px"><col><col style="width:150px"></colgroup>' +
      '<tr><td>🟢</td><td>Mejor mes</td><td class="v">' + (T.mejor ? T.mejor.nombre : '—') + '</td></tr>' +
      '<tr><td>🔴</td><td>Peor mes</td><td class="v">' + (T.peor ? T.peor.nombre : '—') + '</td></tr>' +
      '<tr><td>📌</td><td>Meses sobre obj.</td><td class="v">' + T.sobreObj + ' de 6</td></tr>' +
      '<tr><td>🎯</td><td>Brecha conversión</td><td class="v ' + (T.conv ? sem(T.conv, b.conv) : '') + '">' + sp(T.brechaConv) + '</td></tr>' +
      '<tr><td>🛍</td><td>Brecha PxT (obj ' + dec(b.pxtObj || 0) + ')</td><td class="v ' + (T.pxt ? sem(T.pxt, b.pxtObj) : '') + '">' + (T.brechaPxt > 0 ? '+' : '') + dec(T.brechaPxt, 2) + '</td></tr>' +
      '<tr><td>🧴</td><td>Perfumes</td><td class="v ' + sem(T.pf, T.pfObj) + '">' + T.pf + ' vs ' + (def(T.pfObj) ? T.pfObj : '—') + ' obj</td></tr>' +
      '<tr><td>🩲</td><td>Boxer</td><td class="v ' + sem(T.bx, T.bxObj) + '">' + T.bx + ' vs ' + (def(T.bxObj) ? T.bxObj : '—') + ' obj</td></tr></table>' +
      '<p class="aviso-carga">Objetivos: conv. ' + pc(b.conv || 0) + ' · PxT ' + dec(b.pxtObj || 0) + ' · perfume ' + (b.perfume ? pesos(b.perfume) : '—') + ' · boxer ' + (b.boxer ? pesos(b.boxer) : '—') + '</p></div></div>';

    /* Contra el semestre anterior: lo único que se carga a mano en esta hoja. */
    var a0 = anioMes(meses[0]) - 1, a5 = anioMes(meses[5]) - 1;
    h += '<div class="tp-grid" style="grid-template-columns:minmax(0,1fr)"><div><div class="banda">  📈  VS SEMESTRE ANTERIOR   —   ' +
      nombreMes(meses[0]).slice(0, 3) + ' ' + String(a0).slice(2) + ' → ' + nombreMes(meses[5]).slice(0, 3) + ' ' + String(a5).slice(2) + '   ·   la columna Sem. Anterior es ámbar: se carga a mano</div>' +
      '<table class="tp-tab"><colgroup><col style="width:110px"><col><col><col style="width:90px"><col><col style="width:110px"><col style="width:70px"></colgroup>' +
      '<tr><th class="izq">Mes</th><th>Sem. Anterior</th><th>Sem. Actual</th><th>Var. %</th><th>Var. $</th><th>Peso del mes</th><th>Tend.</th></tr>' +
      F.map(function (f, i) {
        var con = f.hay && f.empezo, Dm = mesTemp(f.mes);
        /* Cada fila es de su mes: la de un mes cerrado no se escribe, aunque el mes que se mira esté abierto. */
        var cel = (Dm ? Dm.puede === 'escribir' : edita())
          ? entrada('temporada', '', f.ant, 'money', 'amb', 'data-mes="' + f.mes + '" data-g="tp" data-r="' + i + '" data-c="0" aria-label="Venta de ' + f.nombre + ' del semestre anterior"', true)
          : '<td class="amb"' + (Dm.cerrado ? ' title="' + f.nombre + ' ya cerró: si hay que corregirlo, lo hace Administración."' : '') + '>' + esc(texto(f.ant, 'money')) + '</td>';
        var clA = con && f.ant ? sem(f.real, f.ant) : '';
        return '<tr><td class="izq">' + f.nombre + '</td>' + cel +
          '<td>' + (con ? pesos(f.real) : '') + '</td><td class="' + clA + '">' + (con && f.ant ? pc(f.antVar, 1) : '') + '</td>' +
          '<td class="' + clA + '">' + (con ? pesosP(f.antDif) : '') + '</td><td>' + (con ? pc(f.peso, 1) : '') + '</td><td>' + (con && f.ant ? f.tend : '') + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td class="izq">TOTAL</td><td>' + pesos(T.ant) + '</td><td>' + pesos(T.real) + '</td><td class="' + (T.ant ? sem(T.real, T.ant) : '') + '">' + (T.ant ? pc(T.antVar, 1) : '') + '</td>' +
      '<td class="' + (T.ant ? sem(T.real, T.ant) : '') + '">' + pesosP(T.antDif) + '</td><td>' + (T.real ? '100%' : '') + '</td><td>' + (T.ant ? T.antTend : '') + '</td></tr></table></div></div>';

    /* Los gráficos de la planilla */
    h += '<div class="banda">  📉  EVOLUCIÓN DEL SEMESTRE</div><div class="graficos">' +
      '<div class="graf"><h3>Participación por vendedor</h3>' + graficoDona(T) + '</div>' +
      '<div class="graf"><h3>Objetivo vs Venta Real</h3>' + graficoBarras(F) + '</div>' +
      '<div class="graf"><h3>Acumulado real vs objetivo acumulado</h3>' + graficoLinea(F) + '</div></div>';
    h += '<p class="aviso-carga">  Todo se calcula solo con las hojas de cada mes. Lo único que se carga a mano es la columna Sem. Anterior.</p>';
    return h;
  }

  /* ── Hoja E-commerce ─────────────────────────────────────────────────── */
  /* La hoja "[Mes] E-commerce" de la planilla del e-commerce, con los mismos bloques y en el mismo orden.
     Pedido de Mauricio (17/10): el panel del embudo es lo de la tienda y el de abajo, lo de Meta. La venta y
     la Q llegan solas de los pedidos pagados; lo de Meta y las visitas y los carritos de Google Analytics
     (19/10: Tienda Nube no los da por su API) los trae el robot de cada hora. Lo de Analytics sale en azul
     y se puede pisar escribiendo otro número; borrándolo, vuelve. Las cuentas, en ventas-calc (ecom). */
  var ESTADO_DIAG = { sin: '⚪ sin datos', nivel: '🟢 en nivel', cerca: '🟡 cerca', flojo: '🔴 flojo' };
  var ETAPAS = ['Visitas → Carrito', 'Carrito → Compra', 'Conversión total'];
  /* +#,##0;-#,##0 (visitas y ventas de más o de menos) */
  function nSigno(n) { var r = Math.round(n); return r === 0 ? '0' : (r > 0 ? '+' : '-') + nf(Math.abs(r)); }
  /* '19/10 a las 19:20' (hora de Argentina, de 0 a 23) */
  function fechaHora(ts) {
    try {
      var p = {};
      new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
      return p.day + '/' + p.month + ' a las ' + p.hour + ':' + p.minute;
    }
    catch (e) { return String(ts || '').slice(0, 16).replace('T', ' '); }
  }
  /* Cómo le fue al robot con Meta o con Analytics: el error de la última vez, o la hora de la última lectura buena (null si nunca leyó). */
  function estadoRobot(e, fuente, bien) {
    e = e || {};
    if (e.error) return '<span class="mal">⚠️ La última vez no se pudo leer ' + fuente + ' (' + esc(fechaHora(e.error_en)) + '): ' + esc(String(e.error).replace(/[.\s]+$/, '')) + '.</span>' +
      (e.ultima ? ' Lo de abajo es lo que llegó el ' + esc(fechaHora(e.ultima)) + '.' : '');
    return e.ultima ? bien + ' Última lectura: ' + esc(fechaHora(e.ultima)) + '.' : null;
  }
  /* Lo de Analytics (en azul) se puede pisar: lo escrito gana, y borrándolo vuelve el de Analytics. */
  var GA_TIT = 'De Google Analytics. Si escribís otro número, queda el tuyo; si lo borrás, vuelve el de Analytics.';

  function hojaEcom(C) {
    var c = C.c, D = ST.D, h = titulo('VENTAS'), conDias = C.C20 > 0;
    h += '<div class="vt-kpis k4">' + kpi('Avance del mes', pc(C.avance, 1), '% del objetivo') + kpi('Venta acumulada', pesos(C.E4), 'en el mes') +
      kpi('Desvío acumulado', pesos(C.desvAcum), C.objHoy ? spd(C.desvAcumPct) + '  vs objetivo a hoy' : 'aún sin días completos', sem(C.realHoy, C.objHoy)) +
      /* El ritmo que hace falta, pintado contra el que se lleva (como el Estado del escalón). */
      kpi('Ritmo necesario', pesos(C.ritmoNec), conDias ? pesos(C.ventaDia) + '  ritmo real' : 'por día · aún sin días completos',
        !conDias ? '' : C.ritmoNec > 0 ? sem(C.ventaDia, C.ritmoNec) : 'sv') + '</div>';

    /* Métricas del mes: se pintan las tasas (lo acumulado contra el objetivo del mes entero estaría siempre en rojo). */
    h += '<div class="banda osc">  MÉTRICAS DEL MES</div>' +
      '<table class="res ecm-met"><colgroup><col style="width:17%"><col><col><col style="width:17%"><col><col></colgroup>' +
      '<tr><th class="izq">Métrica</th><th>Total</th><th>Objetivo</th><th class="izq">Métrica</th><th>Total</th><th>Objetivo</th></tr>' +
      '<tr><td class="izq">Visitas</td><td class="tt">' + nf(C.visTot) + '</td><td>' + nf(C.C19) + '</td>' +
      '<td class="izq">Ticket prom.</td><td class="tt ' + (C.qTot ? sem(C.tkTot, c.tp) : '') + '">' + pesos(C.tkTot) + '</td><td>' + pesos(c.tp) + '</td></tr>' +
      '<tr><td class="izq">Q Ventas</td><td class="tt">' + nf(C.qTot) + '</td><td>' + nf(C.J19) + '</td>' +
      '<td class="izq">Venta/día</td><td class="tt ' + (conDias ? sem(C.ventaDia, C.G19) : '') + '">' + pesos(C.ventaDia) + '</td><td>' + pesos(C.G19) + '</td></tr>' +
      '<tr><td class="izq">Conversión</td><td class="tt ' + (C.visTot ? sem(C.convTot, c.conv) : '') + '">' + pc(C.convTot, 2) + '</td><td>' + pc(c.conv, 2) + '</td>' +
      '<td class="izq">Tráfico rest.</td><td class="tt">' + nf(C.trafRest) + '</td><td>' + nf(C.C19) + '</td></tr></table>';

    var mt = C.metaT, e = C.embT;
    h += '<div class="proy">' +
      '<div><span class="nom">Proyección ponderada</span><span class="v1">' + (def(C.proyPond) ? pesos(C.proyPond) : 'Sin datos') + '</span><span></span>' +
      (def(C.proyPond) ? '<span class="v2 ' + sem(C.proyPond, c.obj) + '">' + pesosP(C.proyPond - c.obj) : '<span class="v2">') + '<span class="s">desvío vs objetivo</span></span></div>' +
      '<div class="tres"><span class="nom">Meta Ads</span>' +
      '<span class="pv blanco ' + (mt.inv ? sem(mt.roas, c.beRoas) : '') + '">' + (mt.inv ? dec(mt.roas, 2) : '—') + '<span class="s">ROAS</span></span>' +
      '<span class="pv blanco">' + (mt.vtas ? pesos(mt.cpa) : '—') + '<span class="s">Costo por compra</span></span></div>' +
      '<div class="pagos"><span class="nom">Embudo de ventas</span>' +
      '<span class="pv">' + pc(e.carVis, 1) + '<span class="s">' + ETAPAS[0] + '</span></span>' +
      '<span class="pv">' + pc(e.comCar, 1) + '<span class="s">' + ETAPAS[1] + '</span></span>' +
      '<span class="pv">' + pc(e.conv, 2) + '<span class="s">' + ETAPAS[2] + '</span></span></div></div>';

    /* Configuración */
    var colg = '<colgroup><col style="width:150px"><col><col style="width:150px"><col><col style="width:150px"><col><col style="width:150px"><col></colgroup>';
    h += '<div class="banda">  CONFIGURACIÓN  —  celdas en ámbar son editables</div><div class="cfg">' +
      '<table>' + colg + '<tr><th class="izq">Nombre del canal</th><td class="amb">E-COMMERCE</td>' +
      '<th>Objetivo Mensual</th>' + entrada('config', 'objetivo', c.obj || null, 'money', 'amb g', 'aria-label="Objetivo mensual del e-commerce"') +
      '<th>Ticket Promedio</th>' + entrada('config', 'ticket', c.tp || null, 'money', 'amb g', 'aria-label="Ticket promedio objetivo"') +
      '<th>Conversión obj.</th>' + entrada('config', 'conversion', c.conv || null, 'pctc', 'amb g', 'aria-label="Conversión objetivo"') + '</tr></table>' +
      '<table>' + colg + '<tr><th class="izq">Tráfico necesario</th><td class="azul">' + nf(C.C19) + '</td>' +
      '<th>Venta objetivo/día</th><td class="azul">' + pesos(C.G19) + '</td><th>Q Ventas objetivo</th><td class="azul">' + nf(C.J19) + '</td>' +
      '<th>Visitas objetivo/día</th><td class="azul">' + nf(C.J20) + '</td></tr>' +
      '<tr><th class="izq">Días transcurridos</th><td class="azul" title="Los días completos: lo de hoy todavía está entrando">' + C.C20 + '</td>' +
      '<th>Días restantes</th><td class="azul">' + C.E20 + '</td>' +
      '<th>Días del mes</th>' + entrada('config', 'dias_mes', c.diasMes || null, 'int', 'amb g', 'aria-label="Días del mes"') + '<td colspan="2" style="border:0"></td></tr></table></div>' +
      '<p class="aviso-carga">⚠️ La venta y la Q ventas llegan solas de la tienda (los pedidos pagados); las visitas, de Google Analytics, al día siguiente. ' +
      'Lo que es "a hoy" (días transcurridos, desvío acumulado, ritmo, proyección) cuenta hasta ayer: lo de hoy todavía está entrando.</p>';
    if (editaPesos()) {
      var sSem = suma(C.sem.map(function (w) { return w.peso; }));
      if (Math.abs(sSem - 1) > 0.0005) h += '<p class="aviso-carga" style="padding-top:0"><b style="color:var(--mal)">Las semanas suman ' + pcIn(sSem) + ', no 100%.</b></p>';
    }

    h += '<div class="semanas-pad">' + C.sem.map(function (w) { return semanaEcom(C, w); }).join('') + '</div>';

    h += '<div class="banda escalon">  ESCALÓN DE OBJETIVOS  ·  Premio · Falta · Ritmo</div>' +
      '<table class="esc"><tr><th>Nivel</th><th>Objetivo</th><th>Premio</th><th>Venta acum.</th><th>Falta</th><th>Desvío %</th><th>Días rest.</th><th>Obj. diario</th><th>Ritmo diario</th><th>Estado</th></tr>' +
      C.escalon.map(function (x, i) {
        return '<tr><td>' + x.nivel + '</td><td>' + pesos(x.meta) + '</td>' + entrada('premio', String(i), x.premio, 'money', 'amb', 'aria-label="Premio ' + x.nivel + '"') +
          '<td>' + pesos(C.E4) + '</td><td>' + pesos(x.falta) + '</td><td class="' + (x.desv >= 1 ? 'sv' : '') + '">' + pc(x.desv, 1) + '</td><td class="dias">' + x.diasRest + '</td>' +
          '<td>' + pesos(x.objDia) + '</td><td>' + pesos(x.ritmo) + '</td>' +
          '<td class="' + (x.objDia > 0 ? (conDias ? sem(x.ritmo, x.objDia) : '') : 'sv') + '">' + (x.ok ? '✅ En ritmo' : '⚠️ Acelerar') + '</td></tr>';
      }).join('') + '</table>';

    /* Los paneles semanales de abajo: una columna por semana y el total del mes. */
    var S = C.sem, colS = '<colgroup><col style="width:220px">' + S.map(function () { return '<col>'; }).join('') + '<col style="width:140px"></colgroup>';
    var cabS = '<tr><th class="izq">Métrica</th>' + S.map(function (w) { return '<th>Semana ' + w.n + '</th>'; }).join('') + '<th>TOTAL MES</th></tr>';
    function fila(nom, f, tot, totCl) {
      return '<tr><td class="izq">' + nom + '</td>' + S.map(function (w, i) { return w.empezo ? f(w, i) : '<td class="futuro"></td>'; }).join('') +
        '<td class="tot ' + (totCl || '') + '">' + tot + '</td></tr>';
    }
    function td(txt, cl) { return '<td' + (cl ? ' class="' + cl + '"' : '') + '>' + txt + '</td>'; }

    /* Embudo de la tienda */
    var carT = def(e.car);
    var estGA = estadoRobot(D.ga_estado, 'Google Analytics', 'Las visitas y los carritos llegan solos cada hora de Google Analytics (vdh.com.ar), hasta ayer.') ||
      (C.hayGA ? 'Las visitas y los carritos llegan de Google Analytics (vdh.com.ar), hasta ayer.'
        : 'Google Analytics todavía no está conectado: hasta que lo esté, las visitas y los carritos se cargan a mano.');
    h += '<div class="banda escalon">  🛒  EMBUDO DE LA TIENDA  ·  vdh.com.ar</div><p class="ecm-est">' + estGA + '</p><table class="ecm">' + colS + cabS +
      fila('Visitas', function (w) { return td(w.hayVis ? nf(w.vis) : ''); }, C.visTot ? nf(C.visTot) : '') +
      fila('Carritos creados', function (w) {
        return entrada('carritos', String(w.n), w.car, 'int', w.carGA ? 'ga' : 'amb',
          'aria-label="Carritos creados de la semana ' + w.n + '"' + (w.carGA ? ' data-ga="1" title="' + GA_TIT + '"' : ''));
      }, carT ? nf(e.car) : '') +
      fila('Compras', function (w) { return td(nf(w.q)); }, nf(C.qTot)) +
      fila('Facturación', function (w) { return td(pesos(w.real)); }, pesos(C.E4)) +
      fila('% Carritos / Visitas', function (w, i) { return td(def(w.car) && w.vis ? pc(C.emb[i].carVis, 1) : ''); }, carT && C.visTot ? pc(e.carVis, 1) : '') +
      fila('% Compras / Carritos', function (w, i) { return td(w.car ? pc(C.emb[i].comCar, 1) : ''); }, e.car ? pc(e.comCar, 1) : '') +
      fila('Conversión total', function (w, i) { return td(w.vis ? pc(C.emb[i].conv, 2) : ''); }, C.visTot ? pc(e.conv, 2) : '') +
      fila('Ticket promedio', function (w, i) { return td(w.q ? pesos(C.emb[i].tk) : ''); }, C.qTot ? pesos(e.tk) : '') + '</table>' +
      '<p class="aviso-carga">Compras y facturación llegan solas de la tienda. Visitas (en cada semana, día por día) y carritos creados, de Google Analytics: ' +
      'todo el tráfico de la tienda, aparte de los de Meta de abajo. Lo de Analytics sale en azul; si escribís otro número, queda el tuyo.</p>';

    /* Meta Ads */
    var est = estadoRobot(D.meta_estado, 'Meta', 'Llega solo cada hora de la cuenta de anuncios de Meta (VDH Prepago).') ||
      (C.hayMeta ? 'Lo de Meta está cargado hasta el ' + (D.meta[D.meta.length - 1][0]) + '/' + String(D.mes).slice(5, 7) +
        ': todavía no llega solo (falta conectar la cuenta de anuncios).'
        : 'Meta todavía no está conectado: cuando lo esté, este panel se llena solo cada hora.');
    function hayM(w) { return w.dias.some(function (x) { return x.meta; }); }
    function m(k, f) { return function (w) { return td(hayM(w) ? f(w.meta[k]) : ''); }; }
    function roasCl(r, inv) { return inv ? sem(r, c.beRoas) : ''; }
    var nada = !C.hayMeta, nota = '<td colspan="' + S.length + '" class="izq nota">';
    h += '<div class="banda escalon">  📣  META ADS</div><p class="ecm-est">' + est + '</p><table class="ecm">' + colS + cabS +
      '<tr><td class="izq">Impuesto sobre pauta</td>' + entrada('config', 'impuesto', c.imp, 'pctc', 'amb', 'aria-label="Impuesto sobre la pauta"') + nota + '←  editable · se suma a la inversión con impuestos</td></tr>' +
      '<tr><td class="izq">ROAS mínimo (rentable)</td>' + entrada('be_roas', '', c.beRoas, 'dec', 'amb', 'aria-label="ROAS mínimo para que sea rentable"') + nota + '←  editable · el ROAS se pinta contra este número</td></tr>' +
      fila('Inversión Meta (sin imp.)', m('inv', pesos), nada ? '' : pesos(mt.inv)) +
      fila('Inversión Meta (con imp.)', m('invImp', pesos), nada ? '' : pesos(mt.invImp)) +
      fila('Facturación Meta', m('fact', pesos), nada ? '' : pesos(mt.fact)) +
      fila('Ventas Meta', m('vtas', nf), nada ? '' : nf(mt.vtas)) +
      fila('Visitas Meta', m('vis', nf), nada ? '' : nf(mt.vis)) +
      fila('Carritos Meta', m('car', nf), nada ? '' : nf(mt.car)) +
      fila('ROAS', function (w) { return td(hayM(w) ? dec(w.meta.roas, 2) : '', roasCl(w.meta.roas, hayM(w) && w.meta.inv)); }, nada ? '' : dec(mt.roas, 2), nada ? '' : roasCl(mt.roas, mt.inv)) +
      fila('ROAS (con imp.)', m('roasImp', function (x) { return dec(x, 2); }), nada ? '' : dec(mt.roasImp, 2)) +
      fila('Costo por compra', m('cpa', pesos), nada ? '' : pesos(mt.cpa)) +
      fila('Costo por carrito', m('cCar', pesos), nada ? '' : pesos(mt.cCar)) +
      fila('Costo por visita', m('cVis', pesos), nada ? '' : pesos(mt.cVis)) +
      fila('% Inversión / Facturación', m('pctInv', function (x) { return pc(x, 1); }), nada ? '' : pc(mt.pctInv, 1)) + '</table>' +
      '<p class="aviso-carga">La inversión con impuestos y el % sobre la facturación usan el impuesto de arriba; la facturación es la de la tienda.</p>';

    /* Diagnóstico del embudo */
    var cuello = C.cuello === 'visitas' ? 'Cuello de botella: ' + ETAPAS[0] + '   ·   mirá ficha de producto, fotos, precio y disponibilidad de talles.'
      : C.cuello === 'carrito' ? 'Cuello de botella: ' + ETAPAS[1] + '   ·   mirá costo de envío, medios de pago y pasos del checkout.'
      : 'Sin datos suficientes para diagnosticar.';
    h += '<div class="banda escalon">  🔎  DIAGNÓSTICO DEL EMBUDO  ·  referencias del rubro indumentaria</div>' +
      '<table class="ecm"><colgroup><col style="width:220px"><col><col><col><col></colgroup>' +
      '<tr><th class="izq">Etapa</th><th>Tu resultado</th><th>Referencia rubro</th><th>% del benchmark</th><th>Estado</th></tr>' +
      C.diag.map(function (g, i) {
        return '<tr><td class="izq">' + ETAPAS[i] + '</td><td class="tot">' + pc(g.res, i === 2 ? 2 : 1) + '</td>' +
          entrada('bench', String(i), g.ref, 'pctc', 'amb', 'aria-label="Referencia del rubro: ' + ETAPAS[i] + '"') +
          '<td>' + (g.res ? pc(g.pct) : '') + '</td><td>' + ESTADO_DIAG[g.estado] + '</td></tr>';
      }).join('') + '<tr class="cuello"><td colspan="5" class="izq">' + cuello + '</td></tr></table>';

    /* Orgánico contra pago */
    h += '<div class="banda escalon">  ⚖️  ORGÁNICO vs PAGO</div><table class="ecm">' + colS + cabS +
      fila('Facturación Meta', function (w) { return td(hayM(w) ? pesos(w.meta.fact) : ''); }, nada ? '' : pesos(C.orgT.meta)) +
      fila('Facturación orgánica', function (w, i) { return td(hayM(w) ? pesos(C.org[i].org) : ''); }, nada ? '' : pesos(C.orgT.org)) +
      fila('% dependencia de Meta', function (w, i) { return td(hayM(w) && w.real ? pc(C.org[i].dep) : ''); }, nada || !C.E4 ? '' : pc(C.orgT.dep)) +
      '<tr class="cuello"><td colspan="' + (S.length + 2) + '" class="izq">' +
      (nada ? 'Falta lo de Meta para calcularlo.' : !C.E4 ? 'Sin facturación todavía.'
        : pc(C.orgT.dep) + ' de la venta del mes vino de Meta.  Cuanto más alto, más te expone una suba del costo por compra.') + '</td></tr></table>';
    return h + '<div style="height:14px"></div>';
  }

  function semanaEcom(C, w) {
    var c = C.c, cols = colsDe(w), ep = editaPesos(), ed = edita();
    function cel(f) { return cols.map(function (x, k) { return x ? f(x, k) : '<td class="vt-vacio"></td>'; }).join(''); }
    /* El semáforo de un día sólo con el día completo: el de hoy todavía está entrando. */
    function semDia(x) { return x.completo ? sem(x.real, x.obj) : ''; }
    var algun = w.dias.some(function (x) { return x.completo; }), semSem = algun ? sem(w.real, w.obj) : '';
    var FUT = '<td class="futuro" title="Todavía no llegó"></td>';
    var t = '<table class="sem">' + COLG_SEM + '<tbody>';
    var sDias = suma(w.dias.map(function (x) { return x.peso; }));
    t += '<tr class="pesos"><td></td>' + cols.map(function (x, k) {
      if (!x) return '<td></td>';
      return ep ? entrada('peso_dia', String(x.d), x.peso, 'pct', '', 'aria-label="% del ' + DIAS[k] + ' ' + x.d + ' en la semana"') : '<td>' + pc(x.peso) + '</td>';
    }).join('') + (ep ? entrada('peso_semana', String(w.n), w.peso, 'pct', '', 'aria-label="% de la semana ' + w.n + ' en el mes"') : '<td>' + pc(w.peso) + '</td>') +
      '<td>' + (ep && Math.abs(sDias - 1) > 0.0005 ? '<span class="suma-mal" title="Los días de la semana tienen que sumar 100%">Σ ' + pcIn(sDias) + '</span>' : '') + '</td></tr>';
    t += '<tr class="cab"><th class="izq">  Semana ' + w.n + '</th>' + cols.map(function (x, k) {
      return x ? '<th class="' + (esHoy(C, x) ? 'hoy' : '') + '">' + DIAS[k] + ' ' + x.d + (esHoy(C, x) ? '<span class="pill-hoy">hoy</span>' : '') + '</th>' : '<th></th>';
    }).join('') + '<th>Obj. Semanal</th><th>Desvío</th></tr>';
    t += '<tr class="obj"><td class="izq">Objetivo</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + '">' + pesos(x.obj) + '</td>'; }) +
      '<td class="tot">' + pesos(w.obj) + '</td><td class="tot"></td></tr>';
    t += '<tr class="real"><td class="izq">Venta real</td>' + cel(function (x) {
      if (x.futuro) return FUT;
      return '<td class="' + hoyCl(C, x) + ' ' + semDia(x) + '"' + (x.completo ? '' : ' title="Hoy: todavía está entrando"') + '>' + pesos(x.real) + '</td>';
    }) + '<td class="tot">' + pesos(w.real) + '</td><td class="tot ' + semSem + '">' + pesosP(w.desv) + '</td></tr>';
    t += '<tr class="desv"><td class="izq">Desvío %</td>' + cel(function (x) {
      return '<td class="' + hoyCl(C, x) + (def(x.desvPct) ? ' ' + semDia(x) : '') + '">' + (def(x.desvPct) ? sp(x.desvPct) : '') + '</td>';
    }) + '<td class="' + (def(w.desvPct) ? semSem : '') + '">' + (def(w.desvPct) ? sp(w.desvPct) : '') + '</td><td></td></tr>';
    t += '<tr class="vend"><td class="izq">Visitas</td>' + cel(function (x, k) {
      if (x.futuro) return '<td class="futuro" title="Todavía no llegó"></td>';
      var falta = ed && x.completo && !def(x.vis), cl = hoyCl(C, x) + (falta ? ' falta' : '') + (x.visGA ? ' ga' : '');
      var tit = x.visGA ? GA_TIT : falta ? 'Falta cargar' : !x.completo && !def(x.vis) && C.hayGA ? 'Las de hoy llegan mañana, de Google Analytics' : '';
      if (!ed) return '<td class="' + cl + '"' + (tit ? ' title="' + tit + '"' : '') + '>' + (def(x.vis) ? nf(x.vis) : '') + '</td>';
      return entrada('visitas', String(x.d), x.vis, 'int', cl, 'aria-label="Visitas del ' + DIAS[k] + ' ' + x.d + '"' +
        (x.visGA ? ' data-ga="1"' : '') + (tit ? ' title="' + tit + '"' : ''));
    }) + '<td class="tot">' + (w.hayVis ? nf(w.vis) : '') + '</td><td class="tot ' + (w.hayVis && algun ? sem(w.vis, w.visNec) : '') + '">' + (w.hayVis ? nSigno(w.desvVis) : '') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Q Ventas</td>' + cel(function (x) { return x.futuro ? FUT : '<td class="' + hoyCl(C, x) + '">' + nf(x.q) + '</td>'; }) +
      '<td class="tot">' + nf(w.q) + '</td><td class="tot ' + (algun ? sem(w.q, w.qNec) : '') + '">' + (w.empezo ? nSigno(w.desvQ) : '') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Conversión</td>' + cel(function (x) { return x.futuro ? FUT : '<td class="' + hoyCl(C, x) + '">' + (def(x.conv) ? pc(x.conv, 2) : '') + '</td>'; }) +
      '<td class="tot">' + (w.vis ? pc(w.conv, 2) : '') + '</td><td class="tot ' + (w.vis ? sem(w.conv, c.conv) : '') + '">' + (w.vis ? spd(w.desvConv, 2) : '') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Ticket prom.</td>' + cel(function (x) { return x.futuro ? FUT : '<td class="' + hoyCl(C, x) + '">' + (def(x.tk) ? pesos(x.tk) : '') + '</td>'; }) +
      '<td class="tot">' + (w.q ? pesos(w.tk) : '') + '</td><td class="tot ' + (w.q ? sem(w.tk, c.tp) : '') + '">' + (w.q ? pesosP(w.desvTk) : '') + '</td></tr>';
    return t + '</tbody></table>';
  }

  /* ══ Gráficos (SVG a mano, como en Estadísticas) ═══════════════════════ */
  /* Los colores de cada tema (el oscuro, 20/10/2026). La paleta oscura son los mismos trabajos en pasos para el
     fondo oscuro: el azul de la venta real primero, y validada (luz, croma, daltonismo y contraste ≥ 3:1 contra
     el recuadro del gráfico). El "corte" entre porciones de la dona es el fondo del recuadro. */
  var GRAF = {
    light: { serie: ['#1E3A5F', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'], gris: '#CBD5E1', corte: '#FFFFFF',
      centro: '#111827', apoyo: '#6B7280', mes: '#374151', grilla: '#E3E6EA', ok: '#047857', obj: '#CBD5E1', objLinea: '#94A3B8', real: '#1E3A5F' },
    dark: { serie: ['#3987E5', '#199E70', '#C98500', '#D55181', '#9085E9', '#D95926', '#1A9BB8', '#E66767'], gris: '#56657B', corte: '#111824',
      centro: '#F1F5F9', apoyo: '#96A1B1', mes: '#BCC5D2', grilla: '#1F2A3A', ok: '#5ADBA0', obj: '#56657B', objLinea: '#8391A6', real: '#3987E5' }
  };
  function colGraf() { return document.documentElement.dataset.theme === 'dark' ? GRAF.dark : GRAF.light; }
  function graficoDona(T) {
    var items = T.rk.map(function (r) { return { nombre: r.nombre, v: r.venta }; });
    if (T.sinV > 0) items.push({ nombre: 'Sin vendedor', v: T.sinV, gris: true });
    if (T.otros > 0) items.push({ nombre: 'Otros', v: T.otros, gris: true });
    var tot = suma(items.map(function (x) { return x.v; }));
    if (!tot) return '<div class="tp-vacio">Sin ventas todavía</div>';
    var G = colGraf(), cx = 110, cy = 100, R = 88, r = 54, a = -Math.PI / 2, svg = '';
    items.forEach(function (x, i) {
      var col = x.gris ? G.gris : G.serie[i % G.serie.length], frac = x.v / tot;
      if (frac >= 0.9999) { svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + col + '" stroke-width="' + (R - r) + '"/>'; x.col = col; return; }
      var b = a + frac * 2 * Math.PI, g = frac > 0.5 ? 1 : 0;
      var p = function (rad, ang) { return (cx + rad * Math.cos(ang)).toFixed(2) + ' ' + (cy + rad * Math.sin(ang)).toFixed(2); };
      svg += '<path d="M' + p(R, a) + ' A' + R + ' ' + R + ' 0 ' + g + ' 1 ' + p(R, b) + ' L' + p(r, b) + ' A' + r + ' ' + r + ' 0 ' + g + ' 0 ' + p(r, a) + 'Z" fill="' + col + '" stroke="' + G.corte + '" stroke-width="1.5"><title>' + esc(x.nombre) + ': ' + pesos(x.v) + '</title></path>';
      x.col = col; a = b;
    });
    svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="15" font-weight="700" fill="' + G.centro + '">' + millCorto(tot) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" font-size="10" fill="' + G.apoyo + '">del semestre</text>';
    return '<svg viewBox="0 0 220 200" role="img" aria-label="Participación de cada vendedor en la venta del semestre">' + svg + '</svg>' +
      '<div class="ley">' + items.map(function (x) {
        return '<span><i style="background:' + x.col + '"></i>' + esc(x.gris ? x.nombre : String(x.nombre).split(' ')[0]) + ' ' + pc(x.v / tot) + '</span>';
      }).join('') + '</div>';
  }
  function ejeMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function graficoBarras(F) {
    var W = 360, H = 200, x0 = 40, y0 = 14, ah = H - 34 - y0, aw = W - x0 - 6;
    var max = ejeMax(Math.max.apply(null, F.map(function (f) { return Math.max(f.obj, f.real); }).concat([1])));
    var G = colGraf(), svg = '', paso = aw / F.length, bw = Math.min(18, paso / 3);
    [0, 0.5, 1].forEach(function (k) {
      var y = y0 + ah - k * ah;
      svg += '<line x1="' + x0 + '" x2="' + (W - 6) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + G.grilla + '"/>' +
        '<text x="' + (x0 - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + G.apoyo + '">' + millCorto(max * k) + '</text>';
    });
    F.forEach(function (f, i) {
      var cx = x0 + paso * i + paso / 2, ho = f.obj / max * ah, hr = f.real / max * ah;
      svg += '<rect x="' + (cx - bw - 1).toFixed(1) + '" y="' + (y0 + ah - ho).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ho.toFixed(1) + '" fill="' + G.obj + '"><title>' + f.nombre + ' · objetivo ' + pesos(f.obj) + '</title></rect>' +
        '<rect x="' + (cx + 1).toFixed(1) + '" y="' + (y0 + ah - hr).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hr.toFixed(1) + '" fill="' + G.real + '"><title>' + f.nombre + ' · real ' + pesos(f.real) + '</title></rect>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="10" fill="' + G.mes + '">' + f.nombre.slice(0, 3) + '</text>' +
        (f.real ? '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="' + (f.av >= 1 ? G.ok : G.apoyo) + '">' + pc(f.av) + '</text>' : '');
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Objetivo contra venta real de cada mes">' + svg + '</svg>' +
      '<div class="ley"><span><i style="background:' + G.obj + '"></i>Objetivo</span><span><i style="background:' + G.real + '"></i>Venta real</span></div>';
  }
  function graficoLinea(F) {
    var W = 360, H = 200, x0 = 40, y0 = 14, ah = H - 34 - y0, aw = W - x0 - 14;
    var conObj = F.filter(function (f) { return f.obj; }), conReal = F.filter(function (f) { return f.hay && f.empezo; });
    var max = ejeMax(Math.max.apply(null, F.map(function (f) { return Math.max(f.acumObj, f.acum); }).concat([1])));
    var G = colGraf(), paso = aw / (F.length - 1), svg = '';
    function px(i) { return x0 + paso * i; }
    function py(v) { return y0 + ah - v / max * ah; }
    [0, 0.5, 1].forEach(function (k) {
      var y = py(max * k);
      svg += '<line x1="' + x0 + '" x2="' + (W - 6) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + G.grilla + '"/>' +
        '<text x="' + (x0 - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + G.apoyo + '">' + millCorto(max * k) + '</text>';
    });
    F.forEach(function (f, i) { svg += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="10" fill="' + G.mes + '">' + f.nombre.slice(0, 3) + '</text>'; });
    function trazo(lista, k, col, punteado) {
      if (!lista.length) return '';
      var pts = lista.map(function (f) { return px(F.indexOf(f)).toFixed(1) + ',' + py(f[k]).toFixed(1); });
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.2"' + (punteado ? ' stroke-dasharray="5 4"' : '') + ' stroke-linejoin="round"/>' +
        lista.map(function (f) { return '<circle cx="' + px(F.indexOf(f)).toFixed(1) + '" cy="' + py(f[k]).toFixed(1) + '" r="3" fill="' + col + '"><title>' + f.nombre + ': ' + pesos(f[k]) + '</title></circle>'; }).join('');
    }
    svg += trazo(conObj, 'acumObj', G.objLinea, true) + trazo(conReal, 'acum', G.real, false);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Venta acumulada contra objetivo acumulado">' + svg + '</svg>' +
      '<div class="ley"><span><i style="background:' + G.real + '"></i>Acumulado real</span><span><i style="background:' + G.objLinea + '"></i>Objetivo acumulado</span></div>';
  }

  /* ══ Cargar una celda ═══════════════════════════════════════════════════ */
  /* Lo que se escribe, como número: "34.500", "34500", "$34.500", "28,2%", "0,282". undefined = vacía; null = no es número. */
  function leerNum(txt, tipo) {
    if (tipo === 'txt') return String(txt).trim().replace(/\s+/g, ' ');
    var s = String(txt).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (s === '' || s === '-') return undefined;
    var conPct = /%$/.test(s);
    s = s.replace(/%/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = Number(s);
    if (!isFinite(n) || s === '') return null;
    /* Como Sheets y Excel con una celda en %: de 1 para arriba es el % ("1" = 1%, "50" = 50%); menos de 1, la fracción ("0,5" = 50%). */
    if (tipo === 'pct') return conPct || n >= 1 ? n / 100 : n;
    /* Los % chicos del e-commerce (conversión 0,8%, impuesto, referencias): el número es siempre el %, "0,8" = 0,8%. */
    if (tipo === 'pctc') return n / 100;
    if (tipo === 'int') return Math.round(n);
    if (tipo === 'dias') return Math.round(n * 2) / 2;
    return n;
  }

  /* El cambio en lo que la pantalla tiene del mes (para recalcular sin esperar a la base). */
  function ponerLocal(D, que, clave, v) {
    var p = clave.split(':'), x, i;
    if (v === undefined) v = null;
    if (que === 'config') D.cfg[clave] = clave === 'impuesto' && v === null ? 0 : v;      // vacío, la base lo deja en 0
    else if (que === 'premio') { D.cfg.premios = (D.cfg.premios || [null, null, null, null]).slice(); D.cfg.premios[+clave] = v; }
    else if (que === 'bench') { D.cfg.bench = (D.cfg.bench || [0.065, 0.26, 0.015]).slice(); D.cfg.bench[+clave] = v; }
    else if (que === 'be_roas') D.cfg.be_roas = v;
    else if (que === 'visitas' || que === 'carritos') {            // e-commerce: [día, peso, visitas] y [semana, peso, carritos]
      var L = que === 'visitas' ? (D.dias = D.dias || []) : (D.semanas = D.semanas || []);
      for (i = 0; i < L.length; i++) if (Number(L[i][0]) === Number(clave)) x = L[i];
      if (x) x[2] = v; else L.push([Number(clave), 0, v]);
    }
    else if (que === 'vendedor') {
      D.vendedores.forEach(function (o) { if (Number(o.id) === Number(p[0])) o[p[1]] = p[1] === 'pct' ? (v || 0) : v; });
    } else if (que === 'venta') {
      D.ventas = (D.ventas || []).filter(function (r) { return !(Number(r[0]) === Number(p[0]) && Number(r[1]) === Number(p[1])); });
      if (v !== null) D.ventas.push([Number(p[0]), Number(p[1]), v]);
    } else if (que === 'trafico') {
      D.trafico = D.trafico || [];
      for (i = 0; i < D.trafico.length; i++) if (Number(D.trafico[i][0]) === Number(p[0])) x = D.trafico[i];
      if (!x) { x = [Number(p[0]), null, null, null]; D.trafico.push(x); }
      x[TRAF_IDX[p[1]]] = v;
      D.trafico = D.trafico.filter(function (r) { return [r[1], r[2], r[3]].some(def); });
    } else if (que === 'semanal' || que === 'dias') {
      D.semanal = D.semanal || [];
      for (i = 0; i < D.semanal.length; i++) if (Number(D.semanal[i].v) === Number(p[0]) && Number(D.semanal[i].s) === Number(p[1])) x = D.semanal[i];
      if (!x) { x = { v: Number(p[0]), s: Number(p[1]) }; D.semanal.push(x); }
      x[que === 'dias' ? 'd' : IV_CAMPO[p[2]]] = v;
      D.semanal = D.semanal.filter(function (r) { return [r.d, r.t, r.c, r.tp, r.pf, r.bx, r.pxt].some(def); });
    } else if (que === 'peso_dia' || que === 'peso_semana') {
      var lista = que === 'peso_dia' ? (D.dias = D.dias || []) : (D.semanas = D.semanas || []);
      for (i = 0; i < lista.length; i++) if (Number(lista[i][0]) === Number(clave)) x = lista[i];
      if (x) x[1] = v || 0; else lista.push([Number(clave), v || 0]);
    } else if (que === 'temporada') D.venta_anterior = v;
  }

  /* Las celdas se guardan de a una y en orden (si escribe rápido, la base las recibe como las cargó). */
  var cola = Promise.resolve(), pendientes = 0;
  /* Lo que no se guardó queda a la vista (en rojo, arriba) hasta que esa misma celda se guarde bien:
     un "Guardado" de otra celda no lo tapa. clave → lo que se escribió y dónde. */
  var sinGuardar = {};
  /* Dónde estaba lo que no se guardó, si no es el local y mes que se mira. */
  function dondeNoSeGuardo(x) {
    if (!x.local || (ST.local && x.local === ST.local.id && x.mes === ST.mes)) return x.desc;
    return 'en ' + x.localNombre + ', ' + nombreMes(x.mes).toLowerCase() + ': ' + x.desc;
  }
  function pintarGuardado() {
    var ks = Object.keys(sinGuardar);
    if (ks.length) {
      var todo = ks.map(function (k) { return dondeNoSeGuardo(sinGuardar[k]); });
      estado('No se guardó: ' + todo[0] + (todo.length > 1 ? ' y ' + (todo.length - 1) + ' más' : '') + '. Volvé a cargarlo.', 'mal');
      $('vtEstado').title = 'No se guardó: ' + todo.join(' · ');
      /* Si decide dejarlo como está (o ya no se puede cargar), lo saca él: no queda pegado hasta recargar. */
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'vt-estado-x'; x.setAttribute('data-acc', 'descartar');
      x.textContent = 'Entendido'; x.title = 'Sacar el aviso: lo que no se guardó no queda guardado';
      $('vtEstado').appendChild(x);
    } else {
      estado('Guardado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      $('vtEstado').title = '';
    }
  }
  function guardarCelda(que, clave, valor, mes, desc) {
    pendientes++;
    estado('Guardando…', 'guardando');
    var local = ST.local.id, localNombre = ST.local.nombre || '', k = local + '|' + mes + '|' + que + '|' + clave;
    var p = cola.then(function () {
      if (local === ECOM.id) return llamar('ventas_ecom_guardar', { p_mes: mes, p_que: que, p_clave: clave, p_valor: valor });
      return llamar('ventas_guardar', { p_local: local, p_mes: mes, p_que: que, p_clave: clave, p_valor: valor });
    });
    cola = p.catch(function () {});
    return p.then(function (r) {
      pendientes--;
      delete sinGuardar[k];
      if (!pendientes) pintarGuardado();
      return r;
    }, function (e) {
      pendientes--;
      /* Lo que la base rechaza por una regla (mes cerrado, un número que no va) no se puede volver a cargar igual:
         se avisa y la celda vuelve a lo que tiene la base. Lo que no llegó (internet, la base caída) queda en rojo. */
      var regla = e && e.delServidor && /^ventas:/.test(String(e.message || ''));
      if (!regla) sinGuardar[k] = { desc: desc || 'una celda', local: local, localNombre: localNombre, mes: mes };
      if (Object.keys(sinGuardar).length) pintarGuardado(); else if (!pendientes) estado('');
      throw e;
    });
  }

  function aplicar(el) {
    var td = el.closest('td'), k = el.getAttribute('data-k').split('|'), que = k[0], clave = k[1], tipo = el.getAttribute('data-t');
    var mes = el.getAttribute('data-mes') || ST.mes;
    if (el.value === el.defaultValue) return;
    var val = leerNum(el.value, tipo);
    var mal = val === null ? 'Eso no es un número: quedó como estaba.'
      : tipo === 'txt' && !val ? 'El nombre no puede quedar vacío.'
      : typeof val === 'number' && val < 0 ? 'No puede ser negativo: quedó como estaba.'
      : tipo === 'pct' && (que === 'vendedor' || que === 'peso_dia' || que === 'peso_semana') && val > 1 ? 'El % va de 0 a 100: quedó como estaba.'
      : tipo === 'pctc' && val > 1 ? 'El % va de 0 a 100: quedó como estaba.'
      : esEcom() && que === 'config' && clave === 'conversion' && val > 0.2 ? 'Es demasiado para la conversión del e-commerce (anda cerca del 1%): quedó como estaba.'
      : que === 'config' && clave === 'dias_mes' && (val < 1 || val > 31) ? 'El mes tiene de 1 a 31 días.'
      : que === 'be_roas' && val === undefined ? 'El ROAS mínimo no puede quedar vacío: quedó como estaba.'
      : que === 'be_roas' && val > 100 ? 'Es demasiado para un ROAS: quedó como estaba.'
      : tipo === 'dias' && val > 7 ? 'Una semana tiene hasta 7 días.'
      : que === 'config' && clave === 'dias_habiles' && val > 31 ? 'El mes no tiene tantos días.'
      : que === 'config' && (clave === 'conversion' || clave === 'factor') && val > 5 ? 'Es demasiado: ' + (clave === 'conversion' ? 'la conversión' : 'el factor') + ' va como % (50% es la mitad). Quedó como estaba.'
      : (que === 'trafico' || que === 'semanal') && /:conversion$/.test(clave) && val > 5 ? 'Es demasiado: la conversión va como % (50% es la mitad). Quedó como estaba.'
      : typeof val === 'number' && val >= 1e10 ? 'El número es demasiado grande: quedó como estaba.'
      : '';
    if (mal) {
      avisar('err', mal);
      if (td) { td.classList.add('mal-entrada'); setTimeout(function () { td.classList.remove('mal-entrada'); }, 500); }
      el.value = el.defaultValue;
      return;
    }
    /* Una celda con lo de Google Analytics no tiene nada escrito: borrarla no cambia nada (sigue lo de Analytics),
       y si no se guarda lo que se escribe, vuelve a quedar vacía (no se queda el número de Analytics como escrito). */
    var antes = el.hasAttribute('data-ga') ? undefined : leerNum(el.defaultValue, tipo);
    if (antes === val) {                                     // lo mismo, escrito de otra forma
      /* Si esa celda había quedado sin guardar, escribir lo que tiene la base es dejarla así: se va el rojo. */
      var kNo = ST.local.id + '|' + mes + '|' + que + '|' + clave;
      if (sinGuardar[kNo]) { delete sinGuardar[kNo]; if (!pendientes) { if (Object.keys(sinGuardar).length) pintarGuardado(); else estado(''); } }
      redibujar(); return;
    }
    var D = que === 'temporada' ? mesTemp(mes) : ST.D;
    if (D) ponerLocal(D, que, clave, val);
    if (que === 'temporada' && mes === ST.mes) ST.D.venta_anterior = val === undefined ? null : val;
    redibujar();
    var desc = (el.getAttribute('aria-label') || 'una celda') + (el.value.trim() ? ' (' + el.value.trim() + ')' : ' (vacía)');
    guardarCelda(que, clave, val === undefined ? '' : String(val), mes, desc).catch(function (e) {
      avisar('err', motivo(e));
      if (e && e.sinSesion) { porton(); return; }
      /* No se guardó: la celda vuelve a lo que tenía (no queda a la vista algo que la base no tiene) y se
         vuelve a leer el mes entero, aunque la base no haya cambiado (sin internet, queda lo de antes). */
      if (D) ponerLocal(D, que, clave, antes);
      if (que === 'temporada' && mes === ST.mes) ST.D.venta_anterior = antes === undefined ? null : antes;
      if (que === 'temporada' && ST.temp) cargarTemporada(true);
      redibujar();
      ST.firma = null;
      cargarMes(true);
    });
  }

  /* ══ Sumar, quitar y asignar vendedores ═════════════════════════════════ */
  function cerrarDialogo() { $('vtVelo').hidden = true; $('vtDialogo').innerHTML = ''; }
  function dialogoSumar() {
    var ya = {};
    (ST.D.vendedores || []).forEach(function (v) { if (v.persona) ya[v.persona] = true; });
    var eq = (ST.D.equipo || []).filter(function (p) { return !ya[p.id]; });
    var d = $('vtDialogo');
    d.innerHTML = '<h2 id="vtDlgTit">Sumar un vendedor a ' + nombreMes(ST.mes) + '</h2>' +
      (eq.length ? '<p class="sub">Del equipo del local</p><div class="lista">' + eq.map(function (p) {
        return '<button type="button" data-persona="' + esc(p.id) + '">' + esc(p.nombre) + '</button>';
      }).join('') + '</div>' : '') +
      '<p class="sub">' + (eq.length ? 'O escribí el nombre' : 'Nombre') + '</p>' +
      '<form class="fila" id="vtDlgForm"><input class="campo" id="vtDlgNom" maxlength="60" autocomplete="off" placeholder="Nombre y apellido" aria-label="Nombre del vendedor">' +
      '<button type="submit" class="btn btn-pri">Sumar</button></form>' +
      '<p class="nota">Arranca con 0% del objetivo: después le ponés su % en Configuración. Los del equipo traen sus francos de Config → Usuarios.</p>' +
      '<div class="pie"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button></div>';
    $('vtVelo').hidden = false;
    var primero = d.querySelector('[data-persona]') || $('vtDlgNom');
    primero.focus();
    d.onclick = function (e) {
      if (e.target.closest('[data-cerrar]')) { cerrarDialogo(); return; }
      var b = e.target.closest('[data-persona]');
      if (b) sumar(null, b.getAttribute('data-persona'), b);
    };
    $('vtDlgForm').onsubmit = function (e) {
      e.preventDefault();
      var nom = $('vtDlgNom').value.trim().replace(/\s+/g, ' ');
      if (nom.length < 2) { avisar('err', 'Escribí el nombre.'); $('vtDlgNom').focus(); return; }
      sumar(nom, null, e.submitter || d.querySelector('button[type="submit"]'));
    };
  }
  function sumar(nombre, idPersona, boton) {
    if (boton) boton.disabled = true;
    llamar('ventas_vendedor_agregar', { p_local: ST.local.id, p_mes: ST.mes, p_nombre: nombre, p_persona: idPersona }).then(function (r) {
      cerrarDialogo();
      avisar('ok', 'Listo: ahora ponele su % del objetivo.');
      return cargarMes(true).then(function () { redibujar('vendedor|' + r.id + ':pct'); });
    }).catch(function (e) { if (boton) boton.disabled = false; avisar('err', motivo(e)); });
  }
  function quitar(id) {
    var v = (ST.D.vendedores || []).filter(function (x) { return Number(x.id) === Number(id); })[0];
    llamar('ventas_vendedor_quitar', { p_local: ST.local.id, p_mes: ST.mes, p_id: Number(id) }).then(function () {
      avisar('ok', 'Quitaste a ' + (v ? v.nombre : 'ese vendedor') + ' de ' + nombreMes(ST.mes) + '.');
      cargarMes(true);
    }).catch(function (e) { avisar('err', motivo(e)); });
  }
  function asignar(sel) {
    var hacia = sel.value, desde = sel.getAttribute('data-desde');
    if (!hacia) return;
    var v = (ST.D.vendedores || []).filter(function (x) { return String(x.id) === hacia; })[0];
    sel.disabled = true;
    llamar('ventas_asignar', { p_local: ST.local.id, p_mes: ST.mes, p_desde: Number(desde), p_hacia: Number(hacia) }).then(function (r) {
      avisar('ok', 'Listo: ' + pesos(r.total || 0) + ' pasaron a ' + (v ? v.nombre : 'ese vendedor') + '.');
      cargarMes(true);
    }).catch(function (e) { sel.disabled = false; sel.value = ''; avisar('err', motivo(e)); });
  }

  /* ══ Los eventos ════════════════════════════════════════════════════════ */
  var hoja = $('vtHoja');
  hoja.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-acc') === 'asignar') { asignar(el); return; }
    if (el.getAttribute('data-k')) aplicar(el);
  });
  hoja.addEventListener('focusin', function (e) { if (e.target.tagName === 'INPUT') e.target.select(); });
  /* Enter baja a la celda de abajo, como en Sheets (Mayús + Enter sube). */
  hoja.addEventListener('keydown', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT') return;
    if (e.key === 'Escape') { el.value = el.defaultValue; el.blur(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var g = el.getAttribute('data-g'), r = +el.getAttribute('data-r'), c = el.getAttribute('data-c'), paso = e.shiftKey ? -1 : 1;
    /* Salta las filas que ese día no se cargan (alguien de vacaciones, SQL 181). */
    var sig = null;
    for (var rr = r + paso; g && !sig && rr >= 0 && Math.abs(rr - r) <= 20; rr += paso) {
      sig = hoja.querySelector('input[data-g="' + g + '"][data-r="' + rr + '"][data-c="' + c + '"]');
    }
    if (!sig) { var todos = [].slice.call(hoja.querySelectorAll('input')); sig = todos[todos.indexOf(el) + paso]; }
    if (sig) sig.focus(); else el.blur();
  });
  hoja.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-acc]');
    if (!b) return;
    if (b.getAttribute('data-acc') === 'agregar') dialogoSumar();
    else if (b.getAttribute('data-acc') === 'quitar') quitar(b.getAttribute('data-id'));
  });
  $('vtCaja').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-acc]');
    if (!b) return;
    if (b.getAttribute('data-acc') === 'entrar') persona.entrar();
    else if (b.getAttribute('data-acc') === 'reintentar' && ST.reintentar) ST.reintentar();
  });
  $('vtVelo').addEventListener('click', function (e) { if (e.target === $('vtVelo')) cerrarDialogo(); });
  $('vtEstado').addEventListener('click', function (e) {
    if (!e.target.closest('[data-acc="descartar"]')) return;
    sinGuardar = {};
    estado(''); $('vtEstado').title = '';
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('vtVelo').hidden) cerrarDialogo(); });
  [].forEach.call(document.querySelectorAll('.vt-pest'), function (b) {
    b.addEventListener('click', function () {
      recordarPos();
      ST.hoja = b.getAttribute('data-tab');
      if (ST.hoja !== 'ecom') guardar(K_HOJA, ST.hoja);
      if (ST.D && ST.D.cfg) dibujar(true);
    });
  });
  $('vtLocal').addEventListener('change', function () {
    recordarPos();
    var id = this.value;
    ST.local = ST.locales.filter(function (l) { return l.id === id; })[0] || ST.local;
    guardar(K_LOCAL, ST.local.id);
    ST.temp = null;
    cargarMes();
  });
  $('vtMes').addEventListener('change', function () {
    recordarPos();
    if (ST.temp && ST.D && ST.D.cfg && ST.temp.meses.indexOf(mesDeDatos(ST.D)) >= 0) ST.temp.D[mesDeDatos(ST.D)] = ST.D;
    ST.mes = this.value;
    if (ST.temp && ST.temp.meses.indexOf(ST.mes) < 0) ST.temp = null;
    cargarMes();
  });

  /* Cada minuto, si nadie está escribiendo, se vuelve a leer el mes (lo que cargó otra compu). */
  function quieto() {
    var a = document.activeElement;
    return ST.D && ST.D.cfg && !pendientes && $('vtVelo').hidden && document.visibilityState !== 'hidden' &&
      !(a && a.closest && a.closest('#vtHoja') && a.tagName === 'INPUT');
  }
  setInterval(function () { if (quieto()) { if (ST.hoja === 'temporada' && ST.temp) cargarTemporada(true); cargarMes(true); } }, 60000);
  window.addEventListener('focus', function () { if (quieto() && Date.now() - ST.leido > 20000) cargarMes(true); });

  /* Arranque */
  ST.mes = mesDe(hoyAR());
  var h0 = leer(K_HOJA);
  if (['ventas', 'trafico', 'vendedor', 'temporada'].indexOf(h0) >= 0) ST.hoja = h0;
  persona.listo.then(function () { ST.arranco = true; cargarLocales(); });
  /* Entró o salió alguien (persona.js): se vuelve a preguntar qué locales ve. */
  var tPersona = null;
  document.addEventListener('persona', function () {
    if (!ST.arranco) return;
    clearTimeout(tPersona);
    tPersona = setTimeout(cargarLocales, 150);
  });
  iniciarTema();                          // en oscuro, también la barra del navegador (theme-color)
  iniciarPWA();
})();
