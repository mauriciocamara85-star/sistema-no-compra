/* ═══════════════════════════════════════════════════════════════════════
   interfaz.js — las piezas de pantalla que comparten todas las secciones.

   Pedido de Mauricio (15/10/2026): "el sistema tiene que tener coherencia,
   que todo funcione de la misma manera". Eligió en la maqueta:
   1. La barra negra (el rail), como Supabase: en la compu, angosta (sólo los
      íconos); al pasar el mouse se abre con los nombres por encima de la
      pantalla, y "Dejarla abierta" la fija (corre la pantalla). En el celular
      sigue siendo la barra de abajo.
   2. El panel de cada sección (CRM, Equipo VDH, Asistente) se achica a
      íconos con el mismo botón, y se recuerda.
   3. Un solo selector de período: un botón que dice el período, con ‹ › para
      el anterior y el siguiente; al tocarlo, los atajos y un calendario para
      elegir un rango (tocás un día, tocás otro y "Aplicar"), como Tienda Nube.

   No depende de nada: ni de comun.js ni de impecable-comun.js (que tienen
   sus propios leer/esc). Todo vive adentro de window.Interfaz.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(trazo) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + trazo + '</svg>'; }
  var ICONO = {
    fijar: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>'),
    soltar: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m17 9-3 3 3 3"/>'),
    panel: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>'),
    cal: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    izq: svg('<path d="m15 18-6-6 6-6"/>'),
    der: svg('<path d="m9 18 6-6-6-6"/>'),
    abajo: svg('<path d="m6 9 6 6 6-6"/>')
  };

  /* ══ 1. La barra negra ══════════════════════════════════════════════════ */
  var K_FIJA = 'nc_rail_fija';
  var raiz = document.documentElement;
  /* Antes de pintar: si la dejó abierta, la pantalla ya arranca corrida (sin el salto). */
  if (leer(K_FIJA) === '1') raiz.classList.add('rail-fija');
  function esCompu() { return !window.matchMedia || window.matchMedia('(min-width: 900px)').matches; }
  /* Fija: la dejó abierta, o es la Carga en la PC ancha (ahí la barra lleva la ficha de quién carga). */
  function railFija() {
    return raiz.classList.contains('rail-fija') ||
      (raiz.classList.contains('rail-ficha') && !!window.matchMedia && window.matchMedia('(min-width: 1200px)').matches);
  }

  function armarRail() {
    var rail = document.querySelector('.rail');
    if (!rail || rail.getAttribute('data-interfaz')) return;
    rail.setAttribute('data-interfaz', '1');
    /* Abajo de todo: dejarla abierta o volver a la angosta. */
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rail-item rail-fijar';
    var pintar = function () {
      var f = railFija();
      b.innerHTML = '<span class="rail-icono">' + (f ? ICONO.soltar : ICONO.fijar) + '</span>' + (f ? 'Achicar la barra' : 'Dejarla abierta');
      b.title = f ? 'Achicar la barra' : 'Dejar la barra abierta';
      b.setAttribute('aria-pressed', String(f));
    };
    pintar();
    b.onclick = function () {
      var f = !railFija();
      raiz.classList.toggle('rail-fija', f);
      guardar(K_FIJA, f ? '1' : null);
      rail.classList.remove('abierta');
      pintar();
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    };
    rail.appendChild(b);

    /* Se abre al pasar el mouse (con un cuarto de segundo de demora, para que no salte cada vez que el mouse
       cruza) y se cierra al salir. Por encima: la pantalla no se mueve. */
    var tAbrir = null, tCerrar = null;
    rail.addEventListener('mouseenter', function () {
      clearTimeout(tCerrar);
      if (!esCompu() || railFija()) return;
      tAbrir = setTimeout(function () { rail.classList.add('abierta'); }, 250);
    });
    rail.addEventListener('mouseleave', function () {
      clearTimeout(tAbrir);
      /* Con una lista desplegada adentro (el "quién carga" de Carga) el mouse "sale" sin salir: no se cierra. */
      if (rail.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
      tCerrar = setTimeout(function () { rail.classList.remove('abierta'); }, 150);
    });
    /* Con el teclado (Tab) también se abre, y se cierra al salir del foco. */
    rail.addEventListener('focusin', function () { if (esCompu() && !railFija()) { clearTimeout(tCerrar); rail.classList.add('abierta'); } });
    rail.addEventListener('focusout', function (e) { if (!rail.contains(e.relatedTarget)) { clearTimeout(tAbrir); rail.classList.remove('abierta'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') rail.classList.remove('abierta'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armarRail); else armarRail();

  /* ══ 2. El panel de cada sección ══════════════════════════════════════
     Cada sección arma su panel a su manera; lo común es el botón (el mismo ícono, arriba a la derecha) y que
     el estado se recuerda por sección. Uso: Interfaz.panelChico('nc_panel_equipo') → true/false;
     Interfaz.panelChico('nc_panel_equipo', true) lo guarda. Interfaz.botonPanel(chico) da el botón. */
  function panelChico(clave, valor) {
    if (arguments.length > 1) { guardar(clave, valor ? '1' : null); return !!valor; }
    return leer(clave) === '1';
  }
  function botonPanel(chico, extra) {
    var t = chico ? 'Abrir el panel' : 'Achicar el panel';
    return '<button type="button" class="plegar-panel' + (extra ? ' ' + extra : '') + '" title="' + t + '" aria-label="' + t + '" aria-expanded="' + String(!chico) + '">' + ICONO.panel + '</button>';
  }

  /* ══ 3. El selector de período ═════════════════════════════════════════
     Las fechas van como 'AAAA-MM-DD' (el día de Argentina) y el rango incluye los dos extremos.

     var sel = Interfaz.periodo(contenedor, {
       inicial: 'mes',                 // un atajo, o { desde, hasta }
       atajos: ['hoy', 'semana', …],   // cuáles se ofrecen (por omisión, los de siempre)
       guardar: 'nc_algo_periodo',     // opcional: se recuerda en este navegador
       hastaHoy: true,                 // opcional: nunca pasa de hoy (para estadísticas)
       desdeTodo: '2024-01-01',        // para el atajo "Todo"
       alCambiar: function (r) {}      // r = { desde, hasta, atajo, unidad, texto }
     });
     sel.rango() → el de ahora (alCambiar NO se llama al arrancar). */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DSEM = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  function hoyAR() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      return deTexto(p);
    } catch (e) { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  }
  function deTexto(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function aTexto(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sumar(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function lunes(d) { return sumar(d, -((d.getDay() + 6) % 7)); }
  function inicioMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function finMes(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function igual(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function dias(a, b) { return Math.round((b - a) / 864e5) + 1; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dm(d, conAnio) { return d.getDate() + '/' + (d.getMonth() + 1) + (conAnio ? '/' + d.getFullYear() : ''); }

  /** Los atajos: cada uno da un rango (con su unidad, para que ‹ › sepa de cuánto moverse). */
  var ATAJOS = {
    'hoy':           ['Hoy',              function (h) { return [h, h, 'dia']; }],
    'ayer':          ['Ayer',             function (h) { var a = sumar(h, -1); return [a, a, 'dia']; }],
    'semana':        ['Esta semana',      function (h) { var l = lunes(h); return [l, sumar(l, 6), 'semana']; }],
    'semana-pasada': ['Semana pasada',    function (h) { var l = sumar(lunes(h), -7); return [l, sumar(l, 6), 'semana']; }],
    '7':             ['Últimos 7 días',   function (h) { return [sumar(h, -6), h, 'rango']; }],
    '30':            ['Últimos 30 días',  function (h) { return [sumar(h, -29), h, 'rango']; }],
    '90':            ['Últimos 90 días',  function (h) { return [sumar(h, -89), h, 'rango']; }],
    '4s':            ['Últimas 4 semanas',  function (h) { var l = lunes(h); return [sumar(l, -21), sumar(l, 6), 'rango']; }],
    '8s':            ['Últimas 8 semanas',  function (h) { var l = lunes(h); return [sumar(l, -49), sumar(l, 6), 'rango']; }],
    '12s':           ['Últimas 12 semanas', function (h) { var l = lunes(h); return [sumar(l, -77), sumar(l, 6), 'rango']; }],
    'mes':           ['Este mes',         function (h) { return [inicioMes(h), finMes(h), 'mes']; }],
    'mes-pasado':    ['Mes pasado',       function (h) { var p = new Date(h.getFullYear(), h.getMonth() - 1, 1); return [p, finMes(p), 'mes']; }],
    '3m':            ['Últimos 3 meses',  function (h) { return [new Date(h.getFullYear(), h.getMonth() - 2, 1), finMes(h), 'rango']; }],
    '6m':            ['Últimos 6 meses',  function (h) { return [new Date(h.getFullYear(), h.getMonth() - 5, 1), finMes(h), 'rango']; }],
    'anio':          ['Este año',         function (h) { return [new Date(h.getFullYear(), 0, 1), new Date(h.getFullYear(), 11, 31), 'anio']; }],
    'todo':          ['Todo',             function (h, op) { return [op.desdeTodo ? deTexto(op.desdeTodo) : sumar(h, -1100), h, 'todo']; }]
  };
  var ATAJOS_DE_SIEMPRE = ['hoy', 'ayer', 'semana', 'semana-pasada', 'mes', 'mes-pasado', '30', '3m'];

  /** Qué es un rango elegido en el calendario: un día, una semana (de lunes a domingo), un mes entero o un rango. */
  function unidadDe(a, b) {
    if (igual(a, b)) return 'dia';
    if (a.getDate() === 1 && igual(b, finMes(a))) return 'mes';
    if (a.getDay() === 1 && dias(a, b) === 7) return 'semana';
    return 'rango';
  }
  /** El rango completo, a partir de las dos fechas (Date) y la unidad. hastaHoy: nunca pasa de hoy. */
  function armar(a, b, unidad, atajo, op) {
    var h = hoyAR(), b2 = op.hastaHoy && b > h ? h : b;
    var r = { desde: aTexto(a), hasta: aTexto(b2), atajo: atajo || null, unidad: unidad, _a: a, _b: b };
    r.texto = etiqueta(a, b, unidad, atajo, h);
    return r;
  }
  function etiqueta(a, b, unidad, atajo, h) {
    var otroAnio = a.getFullYear() !== h.getFullYear() || b.getFullYear() !== h.getFullYear();
    if (unidad === 'mes') return cap(MESES[a.getMonth()]) + ' ' + a.getFullYear();
    if (unidad === 'anio') return 'Año ' + a.getFullYear();
    if (unidad === 'semana') return 'Semana del ' + dm(a, otroAnio) + (igual(a, lunes(h)) ? ' (esta)' : '');
    if (unidad === 'dia') return igual(a, h) ? 'Hoy, ' + dm(a) : igual(a, sumar(h, -1)) ? 'Ayer, ' + dm(a) : dm(a, true);
    if (atajo && ATAJOS[atajo] && atajo !== 'semana' && atajo !== 'mes') return ATAJOS[atajo][0];
    return 'Del ' + dm(a, otroAnio) + ' al ' + dm(b, otroAnio);
  }
  /** ‹ y ›: el período anterior o el siguiente, del mismo tamaño (un mes es un mes, aunque tenga otros días). */
  function mover(r, dir, op) {
    var a = r._a, b = r._b;
    if (r.unidad === 'mes') { var m = new Date(a.getFullYear(), a.getMonth() + dir, 1); return armar(m, finMes(m), 'mes', null, op); }
    if (r.unidad === 'anio') { var y = a.getFullYear() + dir; return armar(new Date(y, 0, 1), new Date(y, 11, 31), 'anio', null, op); }
    var n = dias(a, b) * dir, a2 = sumar(a, n), b2 = sumar(b, n);
    return armar(a2, b2, r.unidad === 'todo' ? 'rango' : unidadDe(a2, b2) === 'rango' ? 'rango' : r.unidad, null, op);
  }
  function deAtajo(clave, op) { var x = ATAJOS[clave][1](hoyAR(), op); return armar(x[0], x[1], x[2], clave, op); }

  function periodo(host, op) {
    op = op || {};
    var atajos = (op.atajos || ATAJOS_DE_SIEMPRE).filter(function (k) { return ATAJOS[k]; });
    var r = null;
    /* El que estaba guardado: un atajo se vuelve a calcular (así "Este mes" sigue siendo este mes). */
    var g = op.guardar ? leer(op.guardar) : null;
    try {
      g = g ? JSON.parse(g) : null;
      if (g && g.atajo && ATAJOS[g.atajo]) r = deAtajo(g.atajo, op);
      else if (g && /^\d{4}-\d\d-\d\d$/.test(g.desde) && /^\d{4}-\d\d-\d\d$/.test(g.hasta)) { var ga = deTexto(g.desde), gb = deTexto(g.hasta); r = armar(ga, gb, g.unidad || unidadDe(ga, gb), null, op); }
    } catch (e) { r = null; }
    if (!r) {
      var ini = op.inicial || 'mes';
      if (typeof ini === 'string' && ATAJOS[ini]) r = deAtajo(ini, op);
      else if (ini && ini.desde && ini.hasta) { var ia = deTexto(ini.desde), ib = deTexto(ini.hasta); r = armar(ia, ib, unidadDe(ia, ib), null, op); }
      else r = deAtajo('mes', op);
    }

    host.innerHTML = '<div class="per">' +
      '<button type="button" class="per-flecha" data-mover="-1" aria-label="Período anterior" title="Período anterior">' + ICONO.izq + '</button>' +
      '<button type="button" class="per-boton" aria-haspopup="dialog" aria-expanded="false">' + ICONO.cal + '<span class="per-txt"></span>' + ICONO.abajo + '</button>' +
      '<button type="button" class="per-flecha" data-mover="1" aria-label="Período siguiente" title="Período siguiente">' + ICONO.der + '</button>' +
      '<div class="per-pop" role="dialog" aria-label="Elegir el período" hidden></div></div>';
    var caja = host.querySelector('.per'), boton = host.querySelector('.per-boton'), pop = host.querySelector('.per-pop');
    var tmpA = null, tmpB = null, vista = null, encima = null;

    function mostrar() { host.querySelector('.per-txt').textContent = r.texto; }
    function poner(nuevo, avisar) {
      r = nuevo;
      if (op.guardar) guardar(op.guardar, JSON.stringify(r.atajo ? { atajo: r.atajo } : { desde: aTexto(r._a), hasta: aTexto(r._b), unidad: r.unidad }));
      mostrar();
      if (avisar !== false && op.alCambiar) op.alCambiar(publico(r));
    }
    function publico(x) { return { desde: x.desde, hasta: x.hasta, atajo: x.atajo, unidad: x.unidad, texto: x.texto }; }
    host.querySelectorAll('[data-mover]').forEach(function (b) { b.onclick = function () { cerrar(); poner(mover(r, +b.getAttribute('data-mover'), op)); }; });
    boton.onclick = function () { if (pop.hidden) abrir(); else cerrar(); };

    function abrir() {
      tmpA = r._a; tmpB = r._b; encima = null;
      vista = inicioMes(r._b > hoyAR() && r._a <= hoyAR() ? hoyAR() : r._b);
      pop.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
      pintar();
      /* Si no entra a la derecha, se abre hacia la izquierda. */
      pop.classList.remove('a-la-izq');
      var rc = pop.getBoundingClientRect();
      if (rc.right > (window.innerWidth || 0) - 8) pop.classList.add('a-la-izq');
      var p = pop.querySelector('[aria-pressed="true"]') || pop.querySelector('.per-dia.inicio') || pop.querySelector('button');
      if (p) p.focus({ preventScroll: true });
    }
    function cerrar(devolverFoco) { if (pop.hidden) return; pop.hidden = true; boton.setAttribute('aria-expanded', 'false'); if (devolverFoco) boton.focus(); }

    function pintar() {
      var h = hoyAR(), ini = tmpA, fin = tmpB || encima, a = ini, b = fin;
      if (a && b && b < a) { var t = a; a = b; b = t; }
      var actual = null;
      atajos.forEach(function (k) { var x = ATAJOS[k][1](h, op); if (tmpB && igual(x[0], tmpA) && igual(x[1], tmpB)) actual = actual || k; });
      var celdas = DSEM.map(function (d) { return '<span class="per-dsem">' + d + '</span>'; }).join('');
      var arranque = lunes(vista);
      for (var i = 0; i < 42; i++) {
        var d = sumar(arranque, i);
        if (i >= 35 && d.getMonth() !== vista.getMonth()) break;
        var cls = ['per-dia'];
        if (d.getMonth() !== vista.getMonth()) cls.push('otro-mes');
        if (igual(d, h)) cls.push('hoy');
        if (a && igual(d, a)) cls.push('inicio');
        if ((b && igual(d, b)) || (!b && a && igual(d, a))) cls.push('fin');
        if (a && b && d > a && d < b) cls.push('en-rango');
        celdas += '<button type="button" class="' + cls.join(' ') + '" data-d="' + aTexto(d) + '" aria-label="' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() + '"><span>' + d.getDate() + '</span></button>';
      }
      var pie = tmpB ? etiqueta(a, b, unidadDe(a, b), null, h) + (unidadDe(a, b) === 'rango' ? ' · ' + dias(a, b) + ' días' : '') : 'Ahora tocá el último día';
      pop.innerHTML = '<div class="per-atajos">' + atajos.map(function (k) {
          return '<button type="button" data-atajo="' + k + '" aria-pressed="' + String(actual === k) + '">' + esc(ATAJOS[k][0]) + '</button>';
        }).join('') + '</div>' +
        '<div class="per-cal"><div class="per-cal-cab"><button type="button" data-mes="-1" aria-label="Mes anterior">' + ICONO.izq + '</button>' +
          '<b>' + cap(MESES[vista.getMonth()]) + ' ' + vista.getFullYear() + '</b><button type="button" data-mes="1" aria-label="Mes siguiente">' + ICONO.der + '</button></div>' +
          '<div class="per-grilla">' + celdas + '</div></div>' +
        '<div class="per-pie"><small>' + esc(pie) + '</small><span class="per-botones"><button type="button" class="per-btn" data-acc="cancelar">Cancelar</button>' +
          '<button type="button" class="per-btn oscuro" data-acc="aplicar"' + (tmpB ? '' : ' disabled') + '>Aplicar</button></span></div>';
      pop.querySelectorAll('[data-atajo]').forEach(function (x) {
        x.onclick = function () { cerrar(true); poner(deAtajo(x.getAttribute('data-atajo'), op)); };
      });
      pop.querySelectorAll('[data-mes]').forEach(function (x) {
        x.onclick = function () { vista = new Date(vista.getFullYear(), vista.getMonth() + +x.getAttribute('data-mes'), 1); pintar(); };
      });
      pop.querySelectorAll('[data-d]').forEach(function (x) {
        var d = deTexto(x.getAttribute('data-d'));
        x.onclick = function () {
          if (!tmpA || tmpB) { tmpA = d; tmpB = null; }
          else if (d < tmpA) { tmpB = tmpA; tmpA = d; }
          else tmpB = d;
          encima = null;
          pintar();
          var f = pop.querySelector('[data-d="' + aTexto(d) + '"]'); if (f) f.focus({ preventScroll: true });
        };
        /* Sólo si cambió el día: al repintar, el día nuevo vuelve a recibir mouseenter y, sin esto, se repintaba sin
           parar y el clic del segundo día caía en un botón que ya no existía (lo encontró el ayudante del CRM). */
        x.onmouseenter = function () { if (tmpA && !tmpB && !igual(encima, d)) { encima = d; pintar(); } };
      });
      pop.querySelector('[data-acc="cancelar"]').onclick = function () { cerrar(true); };
      pop.querySelector('[data-acc="aplicar"]').onclick = function () {
        if (!tmpB) return;
        cerrar(true);
        poner(armar(tmpA, tmpB, unidadDe(tmpA, tmpB), null, op));
      };
    }

    function afuera(e) {
      if (!document.body.contains(host)) { document.removeEventListener('mousedown', afuera, true); return; }
      if (!pop.hidden && !caja.contains(e.target)) cerrar();
    }
    document.addEventListener('mousedown', afuera, true);
    caja.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); cerrar(true); } });
    mostrar();
    return { rango: function () { return publico(r); }, poner: function (x, avisar) { var a = deTexto(x.desde), b = deTexto(x.hasta); poner(armar(a, b, unidadDe(a, b), null, op), avisar); }, elemento: caja };
  }

  window.Interfaz = {
    railFija: railFija,
    panelChico: panelChico,
    botonPanel: botonPanel,
    periodo: periodo,
    fecha: { hoy: function () { return aTexto(hoyAR()); }, sumar: function (s, n) { return aTexto(sumar(deTexto(s), n)); }, lunes: function (s) { return aTexto(lunes(deTexto(s))); },
             deTexto: deTexto, aTexto: aTexto },
    iconos: ICONO
  };
})();
