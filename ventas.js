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
  function dec(n, d) { d = d === undefined ? 1 : d; return Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function decLibre(n) { return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
  function mill(n) { return '$' + (n / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M'; }
  function millCorto(n) { return (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M'; }
  function signo(n) { return !def(n) || !isFinite(n) || n === 0 ? '' : n > 0 ? 'pos' : 'neg'; }
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
        'Atención al cliente, Administración y Gerencia.</p>' +
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
  function pintarQuien() {
    var D = ST.D;
    $('vtSoloVer').hidden = !D || D.puede === 'escribir';
    $('vtQuien').innerHTML = D && D.quien ? (D.puede === 'escribir' ? 'Carga: ' : 'Mira: ') + '<b>' + esc(D.quien) + '</b>' : '';
  }

  /* ══ Arranque: qué locales ve y cuál abre ═══════════════════════════════ */
  function cargarLocales() {
    cargando('Abriendo…');
    llamar('ventas_locales', {}).then(function (lista) {
      ST.locales = lista || [];
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
    sl.innerHTML = ST.locales.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === ST.local.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
    }).join('');
    sl.disabled = ST.locales.length < 2;
    $('vtLocalChip').hidden = false;
    /* Los meses: desde el primero que pasó al sistema hasta el que viene. */
    var hasta = otroMes(mesDe(hoyAR()), 1), m = PRIMER_MES, ops = [];
    while (m <= hasta) { ops.push(m); m = otroMes(m, 1); }
    if (ops.indexOf(ST.mes) < 0) ops.push(ST.mes);
    ops.sort();
    $('vtMes').innerHTML = ops.reverse().map(function (x) {
      return '<option value="' + x + '"' + (x === ST.mes ? ' selected' : '') + '>' + nombreMes(x) + ' ' + anioMes(x) + '</option>';
    }).join('');
    $('vtMesChip').hidden = false;
  }

  /* ══ El mes ═════════════════════════════════════════════════════════════ */
  function cargarMes(silencioso) {
    var pedido = ++ST.pedido;
    if (!silencioso) cargando('Abriendo la planilla de ' + nombreMes(ST.mes) + '…');
    return llamar('ventas_mes_leer', { p_local: ST.local.id, p_mes: ST.mes, p_abrir: true }).then(function (D) {
      if (pedido !== ST.pedido) return;
      ST.leido = Date.now();
      var firma = JSON.stringify(D);
      if (silencioso && ST.D && firma === ST.firma) return;        // nada cambió
      ST.D = D; ST.firma = firma;
      pintarQuien();
      if (!D.cfg) {
        cajaMsg('<h2>' + nombreMes(ST.mes) + ' todavía no tiene planilla</h2><p>Se abre sola la primera vez que alguien del local entra a cargar.</p>');
        return;
      }
      if (silencioso) redibujar(); else dibujar(true);
    }).catch(function (e) {
      if (pedido !== ST.pedido) return;
      if (silencioso) { estado('Sin conexión', 'mal'); return; }
      fallo(e, function () { cargarMes(); });
    });
  }

  /* ══ Dibujar ════════════════════════════════════════════════════════════ */
  function edita() { return !!(ST.D && ST.D.puede === 'escribir'); }
  function editaPesos() { return edita() && !!ST.D.supervisa; }

  function dibujar(arriba) {
    var D = ST.D;
    ST.C = VC.calcular(D);
    /* Lo cargado, a mano para las celdas. */
    ST.venta = {}; ST.tiene = {};
    (D.ventas || []).forEach(function (r) { (ST.venta[r[0]] = ST.venta[r[0]] || {})[r[1]] = Number(r[2]); ST.tiene[r[0]] = true; });
    document.querySelectorAll('.vt-pest').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === ST.hoja)); });
    $('vtMesPest').textContent = nombreMes(ST.mes);
    var h = $('vtHoja');
    if (ST.hoja === 'temporada') h.innerHTML = hojaTemporada();
    else h.innerHTML = ST.hoja === 'trafico' ? hojaTrafico(ST.C) : ST.hoja === 'vendedor' ? hojaVendedor(ST.C) : hojaVentas(ST.C);
    mostrar('hoja');
    if (arriba) $('vtScroll').scrollTop = 0;
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
    if (tipo === 'dec' || tipo === 'dias') return decLibre(v);
    if (tipo === 'int') return nf(v);
    return String(v);
  }
  function entrada(que, clave, v, tipo, cl, extra) {
    cl = cl || ''; extra = extra || '';
    if (!edita()) return '<td class="' + cl + '">' + esc(texto(v, tipo)) + '</td>';
    return '<td class="ed ' + cl + '"><input data-k="' + esc(que + '|' + clave) + '" data-t="' + tipo + '" value="' + esc(texto(v, tipo)) + '"' +
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
      kpi('Faltan vender', pesos(C.faltan), 'para cerrar el mes') + kpi('Desvío acumulado', pesos(C.desvAcum), 'vs objetivo a hoy', C.desvAcum < 0 ? 'neg' : '') + '</div>';
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
    h += '<div class="proy">' +
      '<div><span class="nom">Proyección ponderada</span><span class="v1">' + (def(C.proyPond) ? pesos(C.proyPond) : 'Sin datos') + '</span><span></span><span class="v2">' + (def(C.proyPond) ? pesosP(c.obj - C.proyPond) : '') + '<span class="s">desvío vs objetivo</span></span></div>' +
      '<div><span class="nom">Proyección lineal</span><span class="v1">' + (def(C.proyLin) ? pesos(C.proyLin) : 'Sin datos') + '</span><span></span><span class="v2">' + (def(C.proyLin) ? pesosP(c.obj - C.proyLin) : '') + '<span class="s">desvío vs objetivo</span></span></div>' +
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
      '<div class="cfg-fila"><table class="cfg-vend"><colgroup><col style="width:150px">' + colsV + (edita() ? '<col style="width:150px">' : '') + '</colgroup>' +
      '<tr><th class="izq">Vendedores</th>' + V.map(function (v) {
        return entrada('vendedor', v.id + ':nombre', v.nombre, 'txt', 'amb', 'placeholder="Nombre" aria-label="Nombre del vendedor"');
      }).join('') + (edita() ? '<td rowspan="2" style="padding:4px"><button type="button" class="btn-add" data-acc="agregar">+ Sumar vendedor</button></td>' : '') + '</tr>' +
      '<tr><th class="izq">% Objetivo mensual</th>' + V.map(function (v) {
        return entrada('vendedor', v.id + ':pct', v.pct, 'pct', 'amb', 'aria-label="% del objetivo de ' + esc(v.nombre) + '"');
      }).join('') + '</tr>' +
      '<tr><th class="izq">Objetivo vendedor</th>' + V.map(function (v) {
        var vacio = !ST.tiene[v.id] && !tieneSemanal(v.id);
        return '<td class="calc-m">' + mill(c.obj * v.pct) + (edita() && vacio ? '<br><button type="button" class="quitar" data-acc="quitar" data-id="' + v.id + '">Quitar</button>' : '') + '</td>';
      }).join('') +
      (edita() ? '<td class="suma ' + (sumaOk ? 'ok' : 'mal') + '">' + (sumaOk ? 'Suman 100%' : 'Suman ' + pcIn(C.pctSuma) + ': ' + (C.pctSuma < 1 ? 'falta repartir ' + pcIn(1 - C.pctSuma) : 'sobra ' + pcIn(C.pctSuma - 1))) + '</td>' : '') + '</tr>' +
      '</table>' +
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

    h += '<div class="semanas-pad">' + C.sem.map(function (w) { return semanaVentas(C, w); }).join('') + '</div>';

    h += '<div class="banda escalon">  ESCALÓN DE OBJETIVOS  ·  Premio · Falta · Ritmo</div>' +
      '<table class="esc"><tr><th>Nivel</th><th>Objetivo</th><th>Premio</th><th>Venta acum.</th><th>Falta</th><th>Desvío %</th><th>Días rest.</th><th>Obj. diario</th><th>Ritmo diario</th><th>Estado</th></tr>' +
      C.escalon.map(function (e, i) {
        return '<tr><td>' + e.nivel + '</td><td>' + pesos(e.meta) + '</td>' + entrada('premio', String(i), e.premio, 'money', 'amb', 'aria-label="Premio ' + e.nivel + '"') +
          '<td>' + pesos(C.E4) + '</td><td>' + pesos(e.falta) + '</td><td>' + pc(e.desv, 1) + '</td><td class="dias">' + C.L18 + '</td><td>' + pesos(e.objDia) + '</td><td>' + pesos(e.ritmo) + '</td>' +
          '<td class="' + (e.ok ? 'ok' : 'no') + '">' + (e.ok ? '✅ En ritmo' : '⚠️ Acelerar') + '</td></tr>';
      }).join('') + '</table>';
    return h;
  }

  function tieneSemanal(vid) {
    return (ST.D.semanal || []).some(function (r) {
      return Number(r.v) === Number(vid) && [r.t, r.c, r.tp, r.pf, r.bx, r.pxt].some(def);
    });
  }

  function semanaVentas(C, w) {
    var c = C.c, V = nombrados(C), sin = C.V.filter(function (v) { return v.sin; }), cols = colsDe(w), ep = editaPesos();
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
    t += '<tr class="real"><td class="izq">Venta real</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + '">' + pesos(x.real) + '</td>'; }) +
      '<td class="tot">' + pesos(w.real) + '</td><td class="tot ' + (w.real - w.obj < 0 ? 'peor' : 'mejor') + '">' + pesosP(w.real - w.obj) + '</td></tr>';
    t += '<tr class="desv"><td class="izq">Desvío %</td>' + cel(function (x) { return '<td class="' + hoyCl(C, x) + '">' + (x.real && x.obj ? sp(x.real / x.obj - 1) : '') + '</td>'; }) +
      '<td>' + (w.real && w.obj ? sp(w.real / w.obj - 1) : '') + '</td><td></td></tr>';
    V.forEach(function (v, r) {
      t += '<tr class="vend"><td class="izq">' + esc(v.nombre) + '</td>' + cel(function (x, k) { return celdaVenta(C, v, x, r, w, k); }) +
        '<td class="tot">' + pesos(w.porVend[v.id]) + '</td><td class="tot">' + pesosP(w.porVend[v.id] - c.obj * v.pct * w.peso) + '</td></tr>';
    });
    sin.forEach(function (v) {
      if (!w.dias.some(function (x) { return def((ST.venta[v.id] || {})[x.d]); })) return;
      var total = suma(Object.keys(ST.venta[v.id] || {}).map(function (d) { return ST.venta[v.id][d]; }));
      t += '<tr class="sinv"><td class="izq"><span class="chip-mal">Sin vendedor</span></td>' +
        cel(function (x) { var m = (ST.venta[v.id] || {})[x.d]; return '<td>' + (def(m) ? pesos(m) : '') + '</td>'; }) +
        (edita() && V.length ? '<td colspan="2" style="padding:3px 6px"><select data-acc="asignar" data-desde="' + v.id + '" aria-label="¿De quién es la venta sin vendedor?" title="Pasa los ' + pesos(total) + ' sin vendedor del mes">' +
          '<option value="">¿De quién es?</option>' + V.map(function (o) { return '<option value="' + o.id + '">' + esc(o.nombre) + '</option>'; }).join('') + '</select></td>'
          : '<td class="tot">' + pesos(w.sinV) + '</td><td class="tot"></td>') + '</tr>';
    });
    return t + '</tbody></table>';
  }

  function celdaVenta(C, v, x, r, w, k) {
    var val = (ST.venta[v.id] || {})[x.d], franco = v.francos.indexOf(k) >= 0;
    if (x.futuro) return '<td class="futuro' + (franco ? ' franco' : '') + '" title="Todavía no llegó: se carga el día que pasó"></td>';
    var falta = edita() && !def(val) && x.d < C.hoy && !franco && ST.tiene[v.id];
    var cl = (franco ? 'franco' : '') + hoyCl(C, x) + (falta ? ' falta' : '');
    var tit = franco ? ' title="Franco de ' + esc(String(v.nombre).split(' ')[0]) + '"' : falta ? ' title="Falta cargar"' : '';
    if (!edita()) return '<td class="' + cl + '"' + tit + '>' + (def(val) ? pesos(val) : '') + '</td>';
    return entrada('venta', v.id + ':' + x.d, val, 'money', cl, 'data-g="s' + w.n + '" data-r="' + r + '" data-c="' + k + '" aria-label="' + esc(v.nombre) + ', ' + DIAS[k] + ' ' + x.d + '"' + tit)
      .replace('<td class="ed', '<td' + tit + ' class="ed');
  }

  /* ── Hoja Tráfico ────────────────────────────────────────────────────── */
  function hojaTrafico(C) {
    var c = C.c, T = C.traf, h = titulo('TRAFICO');
    h += '<div class="vt-kpis k5">' + kpi('Tráfico acumulado', T.sumT ? nf(T.sumT) : '—', nf(T.sumT) + ' de ' + nf(T.necTot) + ' necesarios') +
      kpi('Conversión real', def(T.D4) ? pc(T.D4, 1) : '—', 'objetivo: ' + pc(c.conv)) + kpi('Ticket promedio', def(T.F4) ? pesos(T.F4) : '—', 'objetivo: ' + pesos(c.tp)) +
      kpi('Proyección tráfico', def(T.H4) ? nf(T.H4) : 'Sin datos', 'necesario: ' + nf(T.necTot)) + kpi('Prendas por ticket', dec(T.pxt, 2), 'objetivo ' + dec(c.pxtObj)) + '</div>';
    h += '<div class="banda gris">  TICKET PROMEDIO NECESARIO POR OBJETIVO</div><table class="tp-nec"><tr><th>Nivel</th><th>TP necesario</th><th>TP actual</th><th>Desvío</th></tr>' +
      T.tpNec.map(function (r) {
        return '<tr><td>' + r.nivel + '</td><td class="grande">' + (def(r.nec) ? pesos(r.nec) : '—') + '</td><td>' + (def(r.act) ? pesos(r.act) : '—') + '</td><td>' + (def(r.desv) ? pesosP(r.desv) : '—') + '</td></tr>';
      }).join('') + '</table>';
    var msg = T.sinDatos ? 'Sin datos de tráfico cargados aún.'
      : T.L5 >= 0 ? '✅  Ritmo de tráfico en línea con el objetivo. Sin necesidad de compensar.'
      : T.L5 >= -0.1 ? '🟡  Tráfico levemente bajo (' + sp(T.L5) + '). Compensar con conversión o ticket.'
      : '🔴  Tráfico bajo (' + sp(T.L5) + '). Para llegar igual: conv. a ' + (def(T.convNec) ? pc(T.convNec) : '—') + ' o TP a ' + (def(T.tpComp) ? pesos(T.tpComp) : '—') + '. Activar captación urgente.';
    h += '<div class="banda ritmo">  RITMO DE TRÁFICO</div><table class="ritmo-t"><colgroup><col style="width:22%"><col style="width:22%"><col><col><col><col></colgroup>' +
      '<tr><th>Métrica</th><th>Ritmo actual</th><th colspan="4">Para compensar</th></tr>' +
      '<tr><td class="grande" style="font-size:14px">Tráfico</td><td class="grande">' + (T.sinDatos ? '—' : sp(T.L5) || '0%') + '</td><td class="chico">Conv. necesaria:</td>' +
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
      '<td class="tot ' + (def(w.tReal) && w.tReal < w.tNec ? 'peor' : 'mejor') + '">' + (def(w.tReal) ? (w.tReal - w.tNec > 0 ? '+' : '') + nf(w.tReal - w.tNec) : '-') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Conversión real</td>' + cel(function (x, k) { return campo(x, k, 1, 'pct'); }) + '<td class="tot">' + (def(w.tConv) ? pc(w.tConv) : '') + '</td><td class="tot">' + (def(w.tConv) ? sp(w.tConv - c.conv) : '-') + '</td></tr>';
    t += '<tr class="vend"><td class="izq">Ticket promedio real</td>' + cel(function (x, k) { return campo(x, k, 2, 'money'); }) + '<td class="tot">' + (def(w.tTk) ? pesos(w.tTk) : '') + '</td><td class="tot">' + (def(w.tTk) ? pesos(w.tTk - c.tp) : '-') + '</td></tr>';
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
      return '<tr><td class="izq">' + nom + '</td>' + C.res.map(function (r) { return '<td>' + (def(r[k]) ? f(r[k]) : '') + '</td>'; }).join('') +
        '<td class="tt">' + (def(C.resT[k]) ? f(C.resT[k]) : '') + '</td><td class="' + signo(C.resD[k]) + '">' + sp(C.resD[k]) + '</td></tr>';
    }
    h += '<table class="res">' + colg + '<tr><th class="izq">Métrica</th>' + C.sem.map(function (w) { return '<th>Sem ' + w.n + '</th>'; }).join('') + '<th>Total/Prom</th><th>Desvío</th></tr>' +
      filaR('Venta', 'venta', pesos) + filaR('Tráfico', 't', nf) + filaR('Conversión', 'c', function (x) { return pc(x); }) + filaR('TP', 'tp', pesos) +
      filaR('Perfumes', 'pf', nf) + filaR('Boxer', 'bx', nf) + filaR('PxT', 'pxt', function (x) { return dec(x); }) + '</table>';
    var ancho = Math.max(V.length, n), relleno = function (k) { var s = ''; for (var j = 0; j < k; j++) s += '<td></td>'; return s; };
    var colsP = ''; for (var q = 0; q < ancho; q++) colsP += '<col>';
    h += '<div class="banda">  CONFIGURACIÓN  —  ámbar editable · azul se calcula solo</div><div class="iv-cfg">' +
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
      '<tr><th>% Objetivo mensual</th>' + V.map(function (v) { return '<td class="azul">' + pcIn(v.pct) + '</td>'; }).join('') + relleno(ancho - V.length) + '</tr>' +
      '<tr><th>Peso por semana</th>' + C.sem.map(function (w) { return '<td class="azul">' + pc(w.peso) + '</td>'; }).join('') + relleno(ancho - n) + '</tr></table></div>';

    /* Días trabajados (la tabla que tenía Rivadavia): cambia el objetivo semanal de cada uno. */
    if (c.conDias) {
      var porV = {};
      C.iv.forEach(function (x) { porV[x.v.id] = x; });
      h += '<div class="banda">  DÍAS TRABAJADOS POR SEMANA  —  ámbar editable · vacío = los días hábiles de la semana</div><div class="dias-t"><table>' + colg +
        '<tr><th class="izq">Vendedor</th>' + C.sem.map(function (w) { return '<th>Sem ' + w.n + '</th>'; }).join('') + '<th></th><th></th></tr>' +
        '<tr><td class="izq">Días hábiles</td>' + C.sem.map(function (w) { return '<td class="hab">' + w.hab + '</td>'; }).join('') + '<td></td><td></td></tr>' +
        V.map(function (v, vi) {
          var x = porV[v.id];
          return '<tr><td class="izq">' + esc(v.nombre) + '</td>' + x.semanas.map(function (s, j) {
            return entrada('dias', v.id + ':' + s.n, s.diasCargado ? s.dias : null, 'dias', 'amb',
              'placeholder="' + s.hab + '" data-g="d" data-r="' + vi + '" data-c="' + j + '" aria-label="Días que trabajó ' + esc(v.nombre) + ' la semana ' + s.n + '"');
          }).join('') + '<td></td><td></td></tr>';
        }).join('') + '</table></div>';
    }
    h += '<p class="aviso-carga">  Ámbar = editás vos  ·  Azul = se calcula solo (viene de Ventas)  ·  Cargá el real de tráfico, conv, TP, perfumes, boxer y PxT por vendedor</p>';

    var METR = [['venta', 'Venta', pesos, null], ['t', 'Tráfico', nf, 'int'], ['c', 'Conversión', function (x) { return pc(x); }, 'pct'], ['tp', 'TP', pesos, 'money'],
      ['pf', 'Perfumes', nf, 'int'], ['bx', 'Boxer', nf, 'int'], ['pxt', 'PxT', function (x) { return dec(x); }, 'dec']];
    C.iv.forEach(function (x, vi) {
      if (x.v.sin && !x.conDatos) return;
      var nom = x.v.sin ? 'Sin vendedor' : x.v.nombre;
      h += '<div class="vb"><div class="vb-nom">' + esc(nom) + '<small>' + (x.v.sin ? 'lo cargado sin nombre en la planilla' : pcIn(x.v.pct) + ' del objetivo del local') + '</small></div>' +
        '<table>' + colg + '<tr class="cabv"><th class="izq">Métrica</th>' + C.sem.map(function (w) { return '<th>Sem ' + w.n + '</th>'; }).join('') + '<th>Total/Prom</th><th>Desvío</th></tr>';
      METR.forEach(function (m, mi) {
        var k = m[0], f = m[2], tipo = m[3];
        h += '<tr class="o"><td class="izq">' + m[1] + ' · obj</td>' + x.semanas.map(function (s) { return '<td>' + f(s.o[k]) + '</td>'; }).join('') + '<td>' + f(x.ob[k]) + '</td><td></td></tr>';
        var tot = x.tot[k], d = x.desv[k];
        h += '<tr class="r"><td class="izq">' + m[1] + ' · real</td>' + x.semanas.map(function (s, j) {
          if (k === 'venta') return '<td class="blue">' + (def(s.r.venta) ? pesos(s.r.venta) : '') + '</td>';
          if (!s.empezo) return '<td class="futuro" title="Esta semana todavía no empezó"></td>';
          return entrada('semanal', x.v.id + ':' + s.n + ':' + CAMPO_IV[k], s.r[k], tipo, '',
            'data-g="iv' + vi + '" data-r="' + mi + '" data-c="' + j + '" aria-label="' + esc(nom) + ', ' + m[1] + ', semana ' + s.n + '"');
        }).join('') + '<td>' + (def(tot) ? f(tot) : '') + '</td><td class="' + signo(d) + '">' + sp(d) + '</td></tr>';
      });
      h += '</table></div>';
    });
    return h + '<div style="height:14px"></div>';
  }

  /* ── Hoja Informe Temporada ──────────────────────────────────────────── */
  function cargarTemporada() {
    var meses = VC.semestre(ST.mes), clave = ST.local.id + '|' + meses[0];
    if (ST.temp && ST.temp.clave === clave) return;
    var t = ST.temp = { clave: clave, meses: meses, D: {}, listo: false, error: null };
    Promise.all(meses.map(function (m) {
      if (m === ST.mes) return Promise.resolve(null);
      return llamar('ventas_mes_leer', { p_local: ST.local.id, p_mes: m, p_abrir: false });
    })).then(function (lista) {
      lista.forEach(function (D, i) { if (D) t.D[meses[i]] = D; });
      t.listo = true;
      if (ST.temp === t && ST.hoja === 'temporada') redibujar();
    }).catch(function (e) {
      t.error = motivo(e);
      if (ST.temp === t && ST.hoja === 'temporada') redibujar();
    });
  }
  function mesTemp(m) { return m === ST.mes ? ST.D : ST.temp && ST.temp.D[m]; }

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
      return { mes: m, D: D || null, C: D && D.cfg ? (m === ST.mes ? ST.C : VC.calcular(D)) : null };
    }));
    var F = T.filas;
    var ESTADO = { sin: '⚪ Sin datos', ok: '🟢 OK', cerca: '🟡 Cerca', atencion: '🔴 Atención' };
    h += '<div class="vt-kpis k4">' +
      kpi('Venta total semestre', pesos(T.real), conSigno(T.antDif) + '  vs semestre anterior') +
      kpi('Cumplimiento objetivo', pc(T.av, 1), conSigno(T.desv) + '  vs objetivo del semestre', T.desv < 0 ? 'neg' : '') +
      kpi('Tráfico total', nf(T.t), pc(T.conv) + '  conversión promedio') +
      kpi('Ticket promedio', pesos(T.tk), conSigno(T.tkDesv) + '  vs objetivo ' + pesos(T.tkObj)) + '</div>';

    /* Ventas por mes y tráfico */
    h += '<div class="tp-grid"><div><div class="banda">  📊  VENTAS POR MES   —   con acumulado corrido</div>' +
      '<table class="tp-tab"><colgroup><col style="width:92px"><col><col><col style="width:66px"><col><col><col style="width:96px"></colgroup>' +
      '<tr><th class="izq">Mes</th><th>Objetivo</th><th>Venta Real</th><th>Avance</th><th>Acum. Real</th><th>Desv. Acum.</th><th>Estado</th></tr>' +
      F.map(function (f) {
        return '<tr><td class="izq">' + f.nombre + '</td><td>' + (f.obj ? pesos(f.obj) : '') + '</td><td>' + (f.hay && f.empezo ? pesos(f.real) : '') + '</td>' +
          '<td>' + (f.obj && f.hay && f.empezo ? pc(f.av, 1) : '') + '</td><td>' + pesos(f.acum) + '</td><td class="' + signo(f.desvAcum) + '">' + pesos(f.desvAcum) + '</td>' +
          '<td class="izq">' + ESTADO[f.estado] + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td class="izq">TOTAL</td><td>' + pesos(T.obj) + '</td><td>' + pesos(T.real) + '</td><td>' + pc(T.av, 1) + '</td><td>' + pesos(T.real) + '</td>' +
      '<td class="' + signo(T.desv) + '">' + pesos(T.desv) + '</td><td class="izq">' + ESTADO[T.estado] + '</td></tr></table></div>';
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
      '<tr><td>🎯</td><td>Brecha conversión</td><td class="v ' + signo(T.brechaConv) + '">' + sp(T.brechaConv) + '</td></tr>' +
      '<tr><td>🛍</td><td>Brecha PxT (obj ' + dec(b.pxtObj || 0) + ')</td><td class="v ' + signo(T.brechaPxt) + '">' + (T.brechaPxt > 0 ? '+' : '') + dec(T.brechaPxt, 2) + '</td></tr>' +
      '<tr><td>🧴</td><td>Perfumes</td><td class="v">' + T.pf + ' vs ' + (def(T.pfObj) ? T.pfObj : '—') + ' obj</td></tr>' +
      '<tr><td>🩲</td><td>Boxer</td><td class="v">' + T.bx + ' vs ' + (def(T.bxObj) ? T.bxObj : '—') + ' obj</td></tr></table>' +
      '<p class="aviso-carga">Objetivos: conv. ' + pc(b.conv || 0) + ' · PxT ' + dec(b.pxtObj || 0) + ' · perfume ' + (b.perfume ? pesos(b.perfume) : '—') + ' · boxer ' + (b.boxer ? pesos(b.boxer) : '—') + '</p></div></div>';

    /* Contra el semestre anterior: lo único que se carga a mano en esta hoja. */
    var a0 = anioMes(meses[0]) - 1, a5 = anioMes(meses[5]) - 1;
    h += '<div class="tp-grid" style="grid-template-columns:minmax(0,1fr)"><div><div class="banda">  📈  VS SEMESTRE ANTERIOR   —   ' +
      nombreMes(meses[0]).slice(0, 3) + ' ' + String(a0).slice(2) + ' → ' + nombreMes(meses[5]).slice(0, 3) + ' ' + String(a5).slice(2) + '   ·   la columna Sem. Anterior es ámbar: se carga a mano</div>' +
      '<table class="tp-tab"><colgroup><col style="width:110px"><col><col><col style="width:90px"><col><col style="width:110px"><col style="width:70px"></colgroup>' +
      '<tr><th class="izq">Mes</th><th>Sem. Anterior</th><th>Sem. Actual</th><th>Var. %</th><th>Var. $</th><th>Peso del mes</th><th>Tend.</th></tr>' +
      F.map(function (f, i) {
        var con = f.hay && f.empezo;
        return '<tr><td class="izq">' + f.nombre + '</td>' +
          entrada('temporada', '', f.ant, 'money', 'amb', 'data-mes="' + f.mes + '" data-g="tp" data-r="' + i + '" data-c="0" aria-label="Venta de ' + f.nombre + ' del semestre anterior"') +
          '<td>' + (con ? pesos(f.real) : '') + '</td><td class="' + (con ? signo(f.antVar) : '') + '">' + (con && f.ant ? pc(f.antVar, 1) : '') + '</td>' +
          '<td>' + (con ? pesosP(f.antDif) : '') + '</td><td>' + (con ? pc(f.peso, 1) : '') + '</td><td>' + (con && f.ant ? f.tend : '') + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td class="izq">TOTAL</td><td>' + pesos(T.ant) + '</td><td>' + pesos(T.real) + '</td><td class="' + signo(T.antVar) + '">' + (T.ant ? pc(T.antVar, 1) : '') + '</td>' +
      '<td>' + pesosP(T.antDif) + '</td><td>' + (T.real ? '100%' : '') + '</td><td>' + (T.ant ? T.antTend : '') + '</td></tr></table></div></div>';

    /* Los gráficos de la planilla */
    h += '<div class="banda">  📉  EVOLUCIÓN DEL SEMESTRE</div><div class="graficos">' +
      '<div class="graf"><h3>Participación por vendedor</h3>' + graficoDona(T) + '</div>' +
      '<div class="graf"><h3>Objetivo vs Venta Real</h3>' + graficoBarras(F) + '</div>' +
      '<div class="graf"><h3>Acumulado real vs objetivo acumulado</h3>' + graficoLinea(F) + '</div></div>';
    h += '<p class="aviso-carga">  Todo se calcula solo con las hojas de cada mes. Lo único que se carga a mano es la columna Sem. Anterior.</p>';
    return h;
  }

  /* ══ Gráficos (SVG a mano, como en Estadísticas) ═══════════════════════ */
  var PALETA = ['#1E3A5F', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];
  function graficoDona(T) {
    var items = T.rk.map(function (r) { return { nombre: r.nombre, v: r.venta }; });
    if (T.sinV > 0) items.push({ nombre: 'Sin vendedor', v: T.sinV, gris: true });
    if (T.otros > 0) items.push({ nombre: 'Otros', v: T.otros, gris: true });
    var tot = suma(items.map(function (x) { return x.v; }));
    if (!tot) return '<div class="tp-vacio">Sin ventas todavía</div>';
    var cx = 110, cy = 100, R = 88, r = 54, a = -Math.PI / 2, svg = '';
    items.forEach(function (x, i) {
      var col = x.gris ? '#CBD5E1' : PALETA[i % PALETA.length], frac = x.v / tot;
      if (frac >= 0.9999) { svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + col + '" stroke-width="' + (R - r) + '"/>'; x.col = col; return; }
      var b = a + frac * 2 * Math.PI, g = frac > 0.5 ? 1 : 0;
      var p = function (rad, ang) { return (cx + rad * Math.cos(ang)).toFixed(2) + ' ' + (cy + rad * Math.sin(ang)).toFixed(2); };
      svg += '<path d="M' + p(R, a) + ' A' + R + ' ' + R + ' 0 ' + g + ' 1 ' + p(R, b) + ' L' + p(r, b) + ' A' + r + ' ' + r + ' 0 ' + g + ' 0 ' + p(r, a) + 'Z" fill="' + col + '" stroke="#FFFFFF" stroke-width="1.5"><title>' + esc(x.nombre) + ': ' + pesos(x.v) + '</title></path>';
      x.col = col; a = b;
    });
    svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">' + millCorto(tot) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" font-size="10" fill="#6B7280">del semestre</text>';
    return '<svg viewBox="0 0 220 200" role="img" aria-label="Participación de cada vendedor en la venta del semestre">' + svg + '</svg>' +
      '<div class="ley">' + items.map(function (x) {
        return '<span><i style="background:' + x.col + '"></i>' + esc(x.gris ? x.nombre : String(x.nombre).split(' ')[0]) + ' ' + pc(x.v / tot) + '</span>';
      }).join('') + '</div>';
  }
  function ejeMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function graficoBarras(F) {
    var W = 360, H = 200, x0 = 40, y0 = 14, ah = H - 34 - y0, aw = W - x0 - 6;
    var max = ejeMax(Math.max.apply(null, F.map(function (f) { return Math.max(f.obj, f.real); }).concat([1])));
    var svg = '', paso = aw / F.length, bw = Math.min(18, paso / 3);
    [0, 0.5, 1].forEach(function (k) {
      var y = y0 + ah - k * ah;
      svg += '<line x1="' + x0 + '" x2="' + (W - 6) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#E3E6EA"/>' +
        '<text x="' + (x0 - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#6B7280">' + millCorto(max * k) + '</text>';
    });
    F.forEach(function (f, i) {
      var cx = x0 + paso * i + paso / 2, ho = f.obj / max * ah, hr = f.real / max * ah;
      svg += '<rect x="' + (cx - bw - 1).toFixed(1) + '" y="' + (y0 + ah - ho).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ho.toFixed(1) + '" fill="#CBD5E1"><title>' + f.nombre + ' · objetivo ' + pesos(f.obj) + '</title></rect>' +
        '<rect x="' + (cx + 1).toFixed(1) + '" y="' + (y0 + ah - hr).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hr.toFixed(1) + '" fill="#1E3A5F"><title>' + f.nombre + ' · real ' + pesos(f.real) + '</title></rect>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="10" fill="#374151">' + f.nombre.slice(0, 3) + '</text>' +
        (f.real ? '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="' + (f.av >= 1 ? '#047857' : '#6B7280') + '">' + pc(f.av) + '</text>' : '');
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Objetivo contra venta real de cada mes">' + svg + '</svg>' +
      '<div class="ley"><span><i style="background:#CBD5E1"></i>Objetivo</span><span><i style="background:#1E3A5F"></i>Venta real</span></div>';
  }
  function graficoLinea(F) {
    var W = 360, H = 200, x0 = 40, y0 = 14, ah = H - 34 - y0, aw = W - x0 - 14;
    var conObj = F.filter(function (f) { return f.obj; }), conReal = F.filter(function (f) { return f.hay && f.empezo; });
    var max = ejeMax(Math.max.apply(null, F.map(function (f) { return Math.max(f.acumObj, f.acum); }).concat([1])));
    var paso = aw / (F.length - 1), svg = '';
    function px(i) { return x0 + paso * i; }
    function py(v) { return y0 + ah - v / max * ah; }
    [0, 0.5, 1].forEach(function (k) {
      var y = py(max * k);
      svg += '<line x1="' + x0 + '" x2="' + (W - 6) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#E3E6EA"/>' +
        '<text x="' + (x0 - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#6B7280">' + millCorto(max * k) + '</text>';
    });
    F.forEach(function (f, i) { svg += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="10" fill="#374151">' + f.nombre.slice(0, 3) + '</text>'; });
    function trazo(lista, k, col, punteado) {
      if (!lista.length) return '';
      var pts = lista.map(function (f) { return px(F.indexOf(f)).toFixed(1) + ',' + py(f[k]).toFixed(1); });
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.2"' + (punteado ? ' stroke-dasharray="5 4"' : '') + ' stroke-linejoin="round"/>' +
        lista.map(function (f) { return '<circle cx="' + px(F.indexOf(f)).toFixed(1) + '" cy="' + py(f[k]).toFixed(1) + '" r="3" fill="' + col + '"><title>' + f.nombre + ': ' + pesos(f[k]) + '</title></circle>'; }).join('');
    }
    svg += trazo(conObj, 'acumObj', '#94A3B8', true) + trazo(conReal, 'acum', '#1E3A5F', false);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Venta acumulada contra objetivo acumulado">' + svg + '</svg>' +
      '<div class="ley"><span><i style="background:#1E3A5F"></i>Acumulado real</span><span><i style="background:#94A3B8"></i>Objetivo acumulado</span></div>';
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
    if (tipo === 'pct') return conPct || n > 1 ? n / 100 : n;
    if (tipo === 'int') return Math.round(n);
    if (tipo === 'dias') return Math.round(n * 2) / 2;
    return n;
  }

  /* El cambio en lo que la pantalla tiene del mes (para recalcular sin esperar a la base). */
  function ponerLocal(D, que, clave, v) {
    var p = clave.split(':'), x, i;
    if (v === undefined) v = null;
    if (que === 'config') D.cfg[clave] = v;
    else if (que === 'premio') { D.cfg.premios = (D.cfg.premios || [null, null, null, null]).slice(); D.cfg.premios[+clave] = v; }
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
  function guardarCelda(que, clave, valor, mes) {
    pendientes++;
    estado('Guardando…', 'guardando');
    var local = ST.local.id;
    var p = cola.then(function () {
      return llamar('ventas_guardar', { p_local: local, p_mes: mes, p_que: que, p_clave: clave, p_valor: valor });
    });
    cola = p.catch(function () {});
    return p.then(function (r) {
      pendientes--;
      if (!pendientes) estado('Guardado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      return r;
    }, function (e) {
      pendientes--;
      estado('No se guardó', 'mal');
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
      : tipo === 'dias' && val > 7 ? 'Una semana tiene hasta 7 días.'
      : que === 'config' && clave === 'dias_habiles' && val > 31 ? 'El mes no tiene tantos días.'
      : '';
    if (mal) {
      avisar('err', mal);
      if (td) { td.classList.add('mal-entrada'); setTimeout(function () { td.classList.remove('mal-entrada'); }, 500); }
      el.value = el.defaultValue;
      return;
    }
    var antes = leerNum(el.defaultValue, tipo);
    if (antes === val) { redibujar(); return; }              // lo mismo, escrito de otra forma
    var D = que === 'temporada' ? mesTemp(mes) : ST.D;
    if (D) ponerLocal(D, que, clave, val);
    if (que === 'temporada' && mes === ST.mes) ST.D.venta_anterior = val === undefined ? null : val;
    redibujar();
    guardarCelda(que, clave, val === undefined ? '' : String(val), mes).catch(function (e) {
      avisar('err', motivo(e));
      if (e && e.sinSesion) { porton(); return; }
      if (que === 'temporada') ST.temp = null;
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
      '<p class="nota">Arranca con 0% del objetivo: después le ponés su % en Configuración. Los del equipo traen sus francos de Equipo VDH.</p>' +
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
    var sig = g ? hoja.querySelector('input[data-g="' + g + '"][data-r="' + (r + paso) + '"][data-c="' + c + '"]') : null;
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('vtVelo').hidden) cerrarDialogo(); });
  [].forEach.call(document.querySelectorAll('.vt-pest'), function (b) {
    b.addEventListener('click', function () {
      ST.hoja = b.getAttribute('data-tab');
      guardar(K_HOJA, ST.hoja);
      if (ST.D && ST.D.cfg) dibujar(true);
    });
  });
  $('vtLocal').addEventListener('change', function () {
    var id = this.value;
    ST.local = ST.locales.filter(function (l) { return l.id === id; })[0] || ST.local;
    guardar(K_LOCAL, ST.local.id);
    ST.temp = null;
    cargarMes();
  });
  $('vtMes').addEventListener('change', function () {
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
  setInterval(function () { if (quieto()) { if (ST.hoja === 'temporada') ST.temp = null; cargarMes(true); } }, 60000);
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
  iniciarPWA();
})();
