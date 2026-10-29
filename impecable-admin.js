/**
 * Supervisión (en la compu; antes "Equipo VDH", y antes "Impecable") · la administración (impecable-admin.html).
 * La app de los vendedores sigue llamándose Equipo VDH (Mauricio, 19/10: "los chicos no la van a ver").
 *
 * Para el administrador, los supervisores y la gerencia: cómo está cada
 * local, los números del orden, las cajas, los productos testigo y los
 * ajustes. Entra con la MISMA sesión de la app (el PIN de cada uno): si ya
 * entró a Impecable en este aparato, no vuelve a pedir nada.
 *
 * Lo que cada uno puede ver o cambiar lo decide la base (RLS): la gerencia
 * mira y no cambia; los ajustes los toca sólo el administrador. Esta página
 * sólo esconde lo que no corresponde, para no ofrecer botones que fallarían.
 */

var app = document.getElementById('app');
var cartel = document.getElementById('cartel');

var _cartelTimer = null;
function avisar(texto) {
  cartel.textContent = texto;
  cartel.hidden = false;
  clearTimeout(_cartelTimer);
  _cartelTimer = setTimeout(function () { cartel.hidden = true; }, 3500);
}

function unaVez(boton, accion) {
  boton.onclick = function () {
    if (boton.disabled) return;
    var texto = boton.textContent;
    boton.disabled = true;
    Promise.resolve().then(accion).then(function (r) {
      if (document.body.contains(boton)) { boton.disabled = r === 'dejar-apagado'; boton.textContent = texto; }
    }, function (e) {
      if (document.body.contains(boton)) { boton.disabled = false; boton.textContent = texto; }
      if (e && e.sinSesion) { pantallaSinSesion(e.message); return; }
      avisar(esDeRed(e) ? 'Sin señal: no se guardó. Probá de nuevo.' : mensajeDe(e));
    });
  };
}

/** Escribe y confirma que algo cambió: un PATCH que la seguridad no deja contesta igual que uno que sí. */
function guardarFila(ruta, cambios) {
  return tokenVend().then(function (t) { return pedir(ruta, { sesion: t, metodo: 'PATCH', cuerpo: cambios, contar: true }); })
    .then(function (n) { if (!n) throw rechazo('No se guardó: no tenés permiso para cambiar esto.'); return n; });
}

function haceDias(ts) {
  if (!ts) return 'sin foto';
  var d = Math.floor((Date.now() - new Date(ts).getTime()) / 864e5);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

var DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
var DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** "a, b y c". */
function yLista(xs) { return xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0]; }

/* ════════════════════════════════════════════════════════════════════════
   ENTRADA
   ════════════════════════════════════════════════════════════════════════ */

function pantallaSinSesion(mensaje) {
  app.innerHTML = '<div class="imp-entrar"><h2>Entrá con tu PIN</h2>' +
    '<p>' + esc(mensaje || 'Supervisión usa la misma entrada que la app Equipo VDH: elegí "' + SIN_LOCAL + '" (o tu local), tu nombre y tu PIN. Queda guardada en esta computadora.') + '</p>' +
    '<a class="boton lima enlace-boton" href="vendedores.html#/admin">Entrar con tu PIN</a></div>';
}

function pantallaNoCorresponde() {
  app.innerHTML = '<div class="imp-entrar"><h2>Esta parte es para supervisión</h2>' +
    '<p>Entraste como ' + esc(yo().nombre || '') + '. Tus controles y tareas están en la app.</p>' +
    '<a class="boton lima enlace-boton" href="vendedores.html">Ir a la app</a></div>';
}

/* El menú de la izquierda, como el del CRM: [clave, nombre, ícono, bajada]. */
var ICONO_MENU = {
  panorama: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  local: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  fotos: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  tareas: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  orden: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  cajas: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  testigo: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  app: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'
};
var SOLAPAS = [['panorama', 'Panorama', 'Todos los locales, semana a semana'],
               ['local', 'Por local', 'Cada módulo con su última foto, y cómo viene el local'],
               ['fotos', 'Fotos', 'Las fotos de los controles, con lo que dijo la IA'],
               ['tareas', 'Tareas', 'Una tarea para un local, varios o todos, y si la hicieron'],
               ['orden', 'Por vendedor', 'Cada vendedor, semana a semana'],
               ['cajas', 'Cajas', 'Como la planilla del control diario'],
               ['testigo', 'Productos testigo', 'Lo que se cuenta cada semana'],
               ['ajustes', 'Ajustes', 'Cómo funciona cada local, las reglas de orden y los tests']];
/* Sólo el administrador (22/10: "Tareas" era "Crear tarea", adentro de Ajustes). */
var SOLO_ADMIN = ['tareas', 'ajustes'];
var _solapa = 'panorama';
function svgMenu(k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONO_MENU[k] + '</svg>';
}
var _locales = [];
var _local = null;
var K_LOCAL_SUP = 'vdh_vend_local_sup';
var K_MENU_CHICO = 'nc_panel_equipo';

var _atrasPropio = 0;
(function () {
  var b = document.getElementById('btnRefrescar');
  if (b) b.onclick = function () { if (!puedeSalir()) return; if (_vend && _vend.refresco && esSupervision() && _locales.length) ir(_solapa); else inicio(); };
  /* Cerrar o recargar la página con algo sin guardar: el navegador pregunta. */
  window.addEventListener('beforeunload', function (e) { if (sinGuardar()) { e.preventDefault(); e.returnValue = ''; } });
  /* Los "atrás" que pide el editor del croquis al cerrarse llegan después (son asincrónicos): se marcan, para que no
     cierren un editor que se abrió enseguida. */
  window.addEventListener('popstate', function (e) { if (_atrasPropio) { _atrasPropio--; e.vdhPropio = true; } });
  /* Se recargó con el editor abierto: su marca quedó en el historial y el primer "atrás" no hacía nada (árbitro,
     ronda 2). Se saca. */
  if (history.state && history.state.vdhEditor) { _atrasPropio++; try { history.back(); } catch (e) { _atrasPropio--; } }
})();

/** Lo que quedó escrito sin guardar en la pantalla: un "Guardar" prendido o una regla nueva a medio escribir
    (15/10/2026: una regla tipeada en Ajustes no se había guardado y nadie se dio cuenta). */
function sinGuardar() {
  /* El croquis a medio armar (editarMapa) también cuenta. */
  var ed = [].filter.call(document.querySelectorAll('.editor-fondo'), function (e) { return e.cambiado && e.cambiado(); }).length;
  var c = document.getElementById('cuerpo');
  if (!c) return ed;
  /* 22/10: y una tarea escrita sin mandar (en Tareas, un toque en el menú la perdía sin avisar). */
  return ed + c.querySelectorAll('[data-guardar]:not([disabled])').length + document.querySelectorAll('.ventana [data-aviso-guardar]:not([disabled])').length +
    [].filter.call(c.querySelectorAll('[data-nueva-regla] textarea, #ctTitulo, #ctDetalle'), function (t) { return t.value.trim(); }).length;
}
function puedeSalir() {
  return !sinGuardar() || confirm('Hay cambios sin guardar. ¿Salir igual? Lo que no guardaste se pierde.');
}

function inicio() {
  if (!_vend || !_vend.refresco) { pantallaSinSesion(); return; }
  if (!esSupervision()) { pantallaNoCorresponde(); return; }
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  var per = yo();
  var cargar = per.local_id
    ? Promise.resolve([{ id: per.local_id, nombre: per.local || 'Tu local' }])
    : leer('/orden_locales?select=id,nombre&activo=is.true&order=nombre.asc');
  cargar.then(function (l) {
    _locales = l || [];
    var guardado = null;
    try { guardado = localStorage.getItem(K_LOCAL_SUP); } catch (e) {}
    _local = _locales.filter(function (x) { return x.id === guardado; })[0] || _locales[0] || null;
    var h = String(location.hash || '').replace(/^#\/?/, '');
    if (SOLAPAS.some(function (s) { return s[0] === h; })) _solapa = h;
    if (SOLO_ADMIN.indexOf(_solapa) > -1 && !esAdmin()) _solapa = 'panorama';
    ir(_solapa);
  }).catch(function (e) { error(e, inicio); });
}

function error(e, reintentar) {
  if (e && e.sinSesion) { pantallaSinSesion(e.message); return; }
  var c = document.getElementById('cuerpo') || app;
  c.innerHTML = '<div class="nota alerta">' + esc(esDeRed(e) ? 'Sin conexión: no se pudo cargar.' : mensajeDe(e)) + '</div><button class="boton chico" id="reintentar">Probar de nuevo</button>';
  document.getElementById('reintentar').onclick = reintentar;
}

function cabezaAdmin() {
  var per = yo();
  var solapas = SOLAPAS.filter(function (x) { return SOLO_ADMIN.indexOf(x[0]) < 0 || esAdmin(); });
  var actual = SOLAPAS.filter(function (x) { return x[0] === _solapa; })[0] || SOLAPAS[0];
  /* El local se elige en todo salvo en el Panorama, que es de todos, y en Tareas, que tiene su lista de locales. */
  var conLocal = _solapa !== 'panorama' && _solapa !== 'tareas' && _locales.length > 1;
  /* En la compu el menú se achica a íconos con el botón de todos los paneles (interfaz.js), y se recuerda. */
  var chico = Interfaz.panelChico(K_MENU_CHICO);
  return '<div class="imp-grid' + (chico ? ' menu-chico' : '') + '"><nav class="imp-menu" id="menuEquipo" aria-label="Supervisión"><div class="imp-menu-cab"><span>Supervisión</span>' + Interfaz.botonPanel(chico, '', 'menuEquipo') + '</div>' +
    solapas.map(function (x) {
      return '<button class="imp-item' + (x[0] === _solapa ? ' activa' : '') + '" data-solapa="' + x[0] + '" title="' + esc(x[1]) + '">' + svgMenu(x[0]) + '<span>' + esc(x[1]) + '</span></button>';
    }).join('') +
    '<div class="imp-menu-pie"><div class="imp-quien"><b>' + esc(per.nombre || '') + '</b>' + esc(ROL[per.rol] || '') + '</div>' +
      '<a class="imp-item" href="vendedores.html" title="Abrir la app">' + svgMenu('app') + '<span>Abrir la app</span></a>' +
      '<button class="imp-item" id="salir" title="Salir">' + svgMenu('salir') + '<span>Salir</span></button></div></nav>' +
    '<section class="imp-cuerpo"><div class="imp-cab"><div><h2>' + esc(actual[0] === 'local' && _local ? _local.nombre : actual[1]) + '</h2>' +
      '<span class="imp-sub">' + esc(actual[2]) + '</span></div><div class="imp-cab-der">' +
      (conLocal ? '<select class="imp-sel desplegable" id="selLocal" aria-label="Local">' + _locales.map(function (l) {
        return '<option value="' + esc(l.id) + '"' + (_local && l.id === _local.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
      }).join('') + '</select>' : '') + '</div></div>' +
    (soloMira() ? '<div class="nota">Entraste como gerencia: ves todo y no se puede cambiar nada.</div>' : '') +
    '<div id="cuerpo"><p class="cargando">Cargando…</p></div></section></div>';
}

function ir(solapa) {
  _solapa = solapa;
  try { history.replaceState(null, '', location.pathname + '#' + solapa); } catch (e) {}
  /* Para el "‹ Volver al sistema" de la app (vendedores.js): adónde volver desde "Abrir la app" o "Ver su app". */
  try { sessionStorage.setItem('vdh_volver_sistema', 'impecable-admin.html#' + solapa); } catch (e) {}
  app.innerHTML = cabezaAdmin();
  var s = document.getElementById('selLocal');
  if (s) s.onchange = function () { if (!puedeSalir()) { s.value = _local.id; return; } elegirLocal(s.value); ir(_solapa); };
  document.getElementById('salir').onclick = function () {
    if (!confirm('¿Salir? Para volver a entrar hace falta el PIN.')) return;
    cerrarSesion();
    pantallaSinSesion('Saliste. Para volver, entrá de nuevo con tu PIN.');
  };
  app.querySelectorAll('[data-solapa]').forEach(function (b) { b.onclick = function () { if (puedeSalir()) ir(b.dataset.solapa); }; });
  engancharPlegar();
  asomarMenu();
  if (!_local) { document.getElementById('cuerpo').innerHTML = '<div class="vacio">No hay locales cargados.</div>'; return; }
  ({ panorama: verPanorama, local: verLocal, fotos: verFotos, tareas: verTareas, orden: verOrden, cajas: verCajas, testigo: verTestigo, ajustes: verAjustes })[solapa]();
}

/** El botón del menú: cada vez se busca el que está en la página (al tocarlo se rehace con el texto contrario; el
    árbitro vio que, desde el 2.º toque, decía lo contrario de lo que hacía). */
function engancharPlegar() {
  var pl = app.querySelector('.imp-menu .plegar-panel');
  if (!pl) return;
  pl.onclick = function () {
    var g = app.querySelector('.imp-grid'), ch = !g.classList.contains('menu-chico');
    Interfaz.panelChico(K_MENU_CHICO, ch);
    g.classList.toggle('menu-chico', ch);
    pl.outerHTML = Interfaz.botonPanel(ch, '', 'menuEquipo');
    engancharPlegar();
    var nuevo = app.querySelector('.imp-menu .plegar-panel');
    if (nuevo) nuevo.focus();
  };
}

function elegirLocal(id) {
  _local = _locales.filter(function (l) { return l.id === id; })[0] || _local;
  try { localStorage.setItem(K_LOCAL_SUP, _local.id); } catch (e) {}
}

/* En el celular el menú es una tira: que se vea la sección abierta. */
function asomarMenu() {
  var a = app.querySelector('.imp-item.activa'), m = a && a.parentNode;
  if (!m || m.scrollWidth <= m.clientWidth + 1) return;
  m.scrollLeft = Math.max(0, a.offsetLeft - m.offsetLeft - (m.clientWidth - a.offsetWidth) / 2);
}

/* ════════════════════════════════════════════════════════════════════════
   PANORAMA: todos los locales, semana a semana
   ════════════════════════════════════════════════════════════════════════ */

var NIVELES = ['fuera_de_estandar', 'a_mejorar', 'bien', 'impecable'];
var PUNTOS_NIVEL = { fuera_de_estandar: 1, a_mejorar: 2, bien: 3, impecable: 4 };
/* El nivel de un grupo de semanas-persona, con la misma regla que la base
   (orden_v_persona_semana): el promedio de puntos, y si hubo algo fuera de
   estándar o vencido, como mucho "Bien". */
function nivelDeGrupo(g) {
  if (!g || !g.pn) return null;
  var n = NIVELES[Math.max(1, Math.min(4, Math.round(g.pp / g.pn))) - 1];
  if (g.malo && n === 'impecable') n = 'bien';
  return n;
}
function sumarSemana(g, f) {
  g.c += f.controles || 0; g.ca += f.controles_a_tiempo || 0;
  /* Hechos o vencidos: lo que está por hacer todavía no cuenta para "a tiempo". */
  g.r += (f.controles_a_tiempo || 0) + (f.controles_tarde || 0) + (f.controles_vencidos || 0);
  if (f.puntos != null && f.controles) { g.pp += Number(f.puntos) * f.controles; g.pn += f.controles; }
  if ((f.controles_vencidos || 0) > 0 || f.nivel_semana === 'fuera_de_estandar') g.malo = true;
}
function grupoVacio() { return { c: 0, ca: 0, r: 0, pp: 0, pn: 0, malo: false }; }
function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
/* sin: lo que dice si no tiene nivel (una foto mandada que la IA no pudo calificar y nadie revisó: "Esperando revisión"). */
function estNivel(n, sin) { return n ? '<span class="est nivel-' + esc(n) + '">' + esc(NIVEL[n]) + '</span>' : '<span class="est">' + esc(sin || 'Sin fotos') + '</span>'; }

/** Las semanas (sus lunes) que tocan un período, hasta la de hoy y como mucho las últimas 26 (medio año en columnas). */
function semanasDe(r) {
  var s = [], tope = lunesAR();
  for (var w = Interfaz.fecha.lunes(r.desde); w <= r.hasta && w <= tope; w = sumarDias(w, 7)) s.push(w);
  if (!s.length) s.push(Interfaz.fecha.lunes(r.desde));
  return s.slice(-26);
}

/* El período es el selector común (15/10/2026): arranca en las últimas 4 semanas, que es lo que entra en la PC del
   local; con más, la tabla se desliza. Los números de "esta semana" son siempre de esta semana. */
var _panOrden = 'alfa', _panPedido = 0;
function verPanorama() {
  var c = document.getElementById('cuerpo');
  c.innerHTML = '<div id="panKpis"><p class="cargando">Cargando…</p></div>' +
    '<div class="imp-filtros"><div id="panPer"></div><div class="solapas">' + [['alfa', 'Alfabético'], ['nivel', 'Por nivel']].map(function (o) {
      return '<button data-pan-orden="' + o[0] + '" class="' + (o[0] === _panOrden ? 'activa' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div></div><div id="panTabla"></div>';
  var sel = Interfaz.periodo(document.getElementById('panPer'), {
    inicial: '4s', atajos: ['semana', 'semana-pasada', '4s', '8s', '12s', 'mes', 'mes-pasado', '3m'], guardar: 'nc_eq_panorama',
    alCambiar: function (r) { datosPanorama(r); }
  });
  c.querySelectorAll('[data-pan-orden]').forEach(function (b) {
    b.onclick = function () {
      _panOrden = b.dataset.panOrden;
      c.querySelectorAll('[data-pan-orden]').forEach(function (x) { x.classList.toggle('activa', x === b); });
      datosPanorama(sel.rango());
    };
  });
  datosPanorama(sel.rango());
}

function datosPanorama(rango) {
  var pedido = ++_panPedido;
  var semanas = semanasDe(rango), enRango = {};
  semanas.forEach(function (w) { enRango[w] = true; });
  var esta = lunesAR(), pasada = sumarDias(esta, -7);
  var desde = semanas[0] < pasada ? semanas[0] : pasada, hasta = semanas[semanas.length - 1] > esta ? semanas[semanas.length - 1] : esta;
  document.getElementById('panTabla').innerHTML = '<p class="cargando">Cargando…</p>';
  Promise.all([
    /* De a 1000 (leerTodas): con 12 semanas o 3 meses y los 14 locales se pasa el tope de filas de la base. */
    leerTodas('/orden_v_persona_semana?select=local_id,semana,controles,controles_a_tiempo,controles_tarde,controles_vencidos,puntos,nivel_semana&semana=gte.' + desde + '&semana=lte.' + hasta + '&order=semana.asc,local_id.asc,persona_id.asc'),
    leer('/orden_v_estado_local?select=local_id,modulo_id,tareas_abiertas,sin_foto_reciente'),
    leer('/orden_v_por_revisar?select=id,local_id'),
    leerTodas('/orden_v_cajas?select=local_id,fecha,estado,alertas&fecha=gte.' + rango.desde + '&fecha=lte.' + rango.hasta + '&order=fecha.asc,local_id.asc')
  ]).then(function (r) {
    if (_solapa !== 'panorama' || pedido !== _panPedido) return;
    var por = {};
    _locales.forEach(function (l) { por[l.id] = { l: l, sem: {}, tot: grupoVacio(), mods: 0, sinFoto: 0, tareas: 0, revisar: 0, cajasDif: 0 }; });
    var cadena = {}; cadena[esta] = grupoVacio(); cadena[pasada] = grupoVacio();
    (r[0] || []).forEach(function (f) {
      var x = por[f.local_id]; if (!x) return;
      if (cadena[f.semana]) sumarSemana(cadena[f.semana], f);
      if (!enRango[f.semana]) return;
      sumarSemana(x.sem[f.semana] || (x.sem[f.semana] = grupoVacio()), f);
      sumarSemana(x.tot, f);
    });
    (r[1] || []).forEach(function (m) { var x = por[m.local_id]; if (!x) return; x.mods++; x.tareas += m.tareas_abiertas || 0; if (m.sin_foto_reciente) x.sinFoto++; });
    (r[2] || []).forEach(function (v) { var x = por[v.local_id]; if (x) x.revisar++; });
    (r[3] || []).forEach(function (k) { var x = por[k.local_id]; if (x && (k.alertas || []).length) x.cajasDif++; });
    var lista = Object.keys(por).map(function (k) { return por[k]; });
    var conMods = lista.filter(function (x) { return x.mods; }).length;
    var t = lista.reduce(function (a, x) { a.revisar += x.revisar; a.tareas += x.tareas; a.cajas += x.cajasDif; return a; }, { revisar: 0, tareas: 0, cajas: 0 });
    var ce = cadena[esta], pe = pct(ce.ca, ce.r), pp = pct(cadena[pasada].ca, cadena[pasada].r), nc = nivelDeGrupo(ce);

    var html = '<div class="imp-kpis">' +
      '<div class="kpi' + (pe == null ? '' : pe >= 80 ? ' es-ok' : ' es-pend') + '"><div class="kpi-n">' + (pe == null ? '—' : pe + '%') + '</div><div class="kpi-l">Controles a tiempo esta semana</div>' +
        '<div class="kpi-pie">' + (ce.r ? ce.ca + ' de ' + ce.r + ' hechos' : ce.c ? 'Ninguno hecho todavía' : 'Sin controles todavía') +
          (ce.c > ce.r ? ' · ' + (ce.c - ce.r) + ' por hacer' : '') + (pp != null ? ' · la pasada ' + pp + '%' : '') + '</div></div>' +
      '<div class="kpi"><div class="kpi-n">' + esc(nc ? NIVEL[nc] : '—') + '</div><div class="kpi-l">Nivel de la cadena esta semana</div><div class="kpi-pie">Lo que vio la IA y confirmó la supervisión</div></div>' +
      '<div class="kpi' + (t.revisar ? ' es-pend' : '') + '"><div class="kpi-n">' + t.revisar + '</div><div class="kpi-l">Fotos sin revisar</div><div class="kpi-pie">En todos los locales, ahora</div></div>' +
      '<div class="kpi' + (t.tareas ? ' es-pend' : '') + '"><div class="kpi-n">' + t.tareas + '</div><div class="kpi-l">Tareas abiertas en los módulos</div><div class="kpi-pie">Pendientes o vencidas</div></div>' +
      '<div class="kpi' + (t.cajas ? ' es-mal' : '') + '"><div class="kpi-n">' + t.cajas + '</div><div class="kpi-l">Cajas con diferencia</div><div class="kpi-pie">' + esc(rango.texto) + '</div></div>' +
      '<div class="kpi"><div class="kpi-n">' + conMods + '<small> de ' + lista.length + '</small></div><div class="kpi-l">Locales con módulos cargados</div><div class="kpi-pie">Los otros todavía no generan controles</div></div>' +
      '</div>';
    document.getElementById('panKpis').innerHTML = html;
    html = '';

    var valorOrden = function (x) {
      for (var j = semanas.length - 1; j >= 0; j--) { var g = x.sem[semanas[j]]; if (g && g.pn) return g.pp / g.pn + (pct(g.ca, g.r) || 0) / 1000; }
      return -1;
    };
    lista.sort(function (a, b) {
      if (_panOrden === 'nivel') { var d = valorOrden(b) - valorOrden(a); if (d) return d; }
      return a.l.nombre.localeCompare(b.l.nombre, 'es');
    });
    var sinMods = lista.filter(function (x) { return !x.mods; });
    lista = lista.filter(function (x) { return x.mods; });
    if (!lista.length) html += '<div class="vacio">Todavía ningún local tiene módulos: se arman en Por local, con "Armar el croquis".</div>';
    else html += '<div class="desliza"><table class="tabla-datos imp-pano"><thead><tr><th>Local</th>' +
      semanas.map(function (w) { return '<th class="n" style="text-align:center">' + esc(diaMes(w)) + '</th>'; }).join('') +
      '<th class="n">A tiempo</th><th class="n">Sin revisar</th><th class="n">Tareas</th><th class="n">Cajas con dif.</th></tr></thead><tbody>' +
      lista.map(function (x) {
        var a = pct(x.tot.ca, x.tot.r);
        return '<tr data-ir="' + esc(x.l.id) + '"><td class="local"><b>' + esc(x.l.nombre) + '</b><small>' + x.mods + (x.mods === 1 ? ' módulo' : ' módulos') + (x.sinFoto ? ' · ' + x.sinFoto + ' sin foto reciente' : '') + '</small></td>' +
          semanas.map(function (w) {
            var g = x.sem[w];
            if (!g || !g.c) return '<td class="sem">—</td>';
            if (!g.r) return '<td class="sem"><span class="est">Por hacer</span><small>' + g.c + (g.c === 1 ? ' control' : ' controles') + '</small></td>';
            return '<td class="sem">' + estNivel(nivelDeGrupo(g), 'Esperando revisión') + '<small>' + pct(g.ca, g.r) + '% a tiempo</small></td>';
          }).join('') +
          '<td class="n">' + (a == null ? '—' : a + '%') + '</td><td class="n">' + (x.revisar || '—') + '</td><td class="n">' + (x.tareas || '—') + '</td>' +
          '<td class="n' + (x.cajasDif ? ' rojo' : '') + '">' + (x.cajasDif || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (lista.length) html += '<p class="bajada" style="margin-top:10px">Cada casillero es una semana (desde el lunes): el nivel y, de los controles ya hechos, cuántos llegaron a tiempo. Tocá un local para ver sus módulos y sus fotos.</p>';
    if (sinMods.length) html += '<div class="nota imp-sin-mods">Todavía sin módulos (no generan controles): ' + sinMods.map(function (x) {
        return '<button class="imp-enlace" data-ir="' + esc(x.l.id) + '">' + esc(x.l.nombre) + '</button>';
      }).join(', ') + '. Se arman en Por local, con "Armar el croquis".</div>';
    var c = document.getElementById('panTabla');
    c.innerHTML = html;
    c.querySelectorAll('[data-ir]').forEach(function (tr) { tr.onclick = function () { elegirLocal(tr.dataset.ir); ir('local'); }; });
  }).catch(function (e) { error(e, verPanorama); });
}

/* El gráfico de un local: controles a tiempo (la línea) y el nivel (el color
   de cada punto), semana a semana. */
var COLOR_NIVEL = { impecable: '#E8C877', bien: '#8FD1AE', a_mejorar: '#F0C66A', fuera_de_estandar: '#FF9AA0' };
function graficoLocal(filas) {
  var semanas = [];
  for (var i = 7; i >= 0; i--) semanas.push(sumarDias(lunesAR(), -7 * i));
  var g = {};
  (filas || []).forEach(function (f) { sumarSemana(g[f.semana] || (g[f.semana] = grupoVacio()), f); });
  if (!semanas.some(function (w) { return g[w] && g[w].r; })) return '';
  var W = 720, H = 170, x0 = 40, x1 = W - 16, y0 = 16, y1 = H - 34;
  var X = function (j) { return x0 + (x1 - x0) * j / (semanas.length - 1); };
  var Y = function (p) { return y1 - (y1 - y0) * p / 100; };
  var puntos = semanas.map(function (w, j) { var s = g[w]; return s && s.r ? { j: j, p: pct(s.ca, s.r), n: nivelDeGrupo(s) } : null; });
  var tramos = [], tramo = [];
  puntos.forEach(function (p) { if (p) tramo.push(X(p.j).toFixed(1) + ',' + Y(p.p).toFixed(1)); else if (tramo.length) { tramos.push(tramo); tramo = []; } });
  if (tramo.length) tramos.push(tramo);
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Controles a tiempo por semana">' +
    [0, 50, 100].map(function (p) { return '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="rgba(255,255,255,.12)"/><text x="' + (x0 - 8) + '" y="' + (Y(p) + 4) + '" fill="#A6AEB8" font-size="11" text-anchor="end">' + p + '%</text>'; }).join('') +
    tramos.map(function (t) { return '<polyline points="' + t.join(' ') + '" fill="none" stroke="#E8AE85" stroke-width="2.2" stroke-linejoin="round"/>'; }).join('') +
    puntos.map(function (p) { return p ? '<circle cx="' + X(p.j).toFixed(1) + '" cy="' + Y(p.p).toFixed(1) + '" r="6" fill="' + (COLOR_NIVEL[p.n] || '#6F7884') + '" stroke="#0C0E11" stroke-width="2"><title>' + esc((p.n ? NIVEL[p.n] : 'Esperando revisión') + ' · ' + p.p + '% a tiempo') + '</title></circle>' : ''; }).join('') +
    semanas.map(function (w, j) { return '<text x="' + X(j).toFixed(1) + '" y="' + (H - 10) + '" fill="#A6AEB8" font-size="11" text-anchor="middle">' + esc(diaMes(w)) + '</text>'; }).join('') +
    '</svg>';
  return '<div class="imp-grafico">' + svg +
    '<div class="imp-ley">' + NIVELES.slice().reverse().map(function (n) { return '<span><i style="background:' + COLOR_NIVEL[n] + '"></i>' + esc(NIVEL[n]) + '</span>'; }).join('') + '</div></div>';
}

/* ════════════════════════════════════════════════════════════════════════
   FOTOS: las de los controles, con lo que dijo la IA
   ════════════════════════════════════════════════════════════════════════ */

/* El período es el selector común (15/10/2026): arranca en los últimos 7 días. */
var _fotoNivel = '', _fotoQuien = '', _fotoPedido = 0, _fotoDe = 'modulos';
function verFotos() {
  var c = document.getElementById('cuerpo');
  /* Módulos | Tareas (16/10): las fotos de las tareas hechas, para mirarlas y mandar a corregir (SQL 132).
     Desde el SQL 150 también las correcciones pedidas al revisar, Antes | Ahora. */
  c.innerHTML = '<div class="imp-filtros"><div class="solapas" id="fotoDe">' + [['modulos', 'Módulos'], ['tareas', 'Correcciones y tareas']].map(function (o) {
      return '<button data-foto-de="' + o[0] + '" class="' + (o[0] === _fotoDe ? 'activa' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div><div id="fotoPer"></div><div class="solapas"' + (_fotoDe === 'tareas' ? ' hidden' : '') + '>' +
    [['', 'Todos los niveles']].concat(NIVELES.slice().reverse().map(function (n) { return [n, NIVEL[n]]; })).map(function (o) {
      return '<button data-foto-nivel="' + o[0] + '" class="' + (o[0] === _fotoNivel ? 'activa' : '') + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div><span id="fotoQuienLugar"></span></div><div id="fotoDatos"><p class="cargando">Cargando…</p></div>';
  var sel = Interfaz.periodo(document.getElementById('fotoPer'), {
    inicial: '7', atajos: ['hoy', 'ayer', '7', 'semana', 'semana-pasada', '30', 'mes', 'mes-pasado'], hastaHoy: true, guardar: 'nc_eq_fotos',
    alCambiar: function (r) { (_fotoDe === 'tareas' ? datosTareasFoto : datosFotos)(r); }
  });
  c.querySelectorAll('[data-foto-nivel]').forEach(function (b) {
    b.onclick = function () {
      _fotoNivel = b.dataset.fotoNivel;
      c.querySelectorAll('[data-foto-nivel]').forEach(function (x) { x.classList.toggle('activa', x === b); });
      datosFotos(sel.rango());
    };
  });
  c.querySelectorAll('[data-foto-de]').forEach(function (b) {
    b.onclick = function () { if (b.dataset.fotoDe !== _fotoDe) { _fotoDe = b.dataset.fotoDe; verFotos(); } };
  });
  (_fotoDe === 'tareas' ? datosTareasFoto : datosFotos)(sel.rango());
}

/* Lo que hace falta de una foto para la ventana de la foto (Fotos y el módulo de Por local). SQL 150: las marcas, si
   se pidió la corrección y, en la foto de una corrección, de qué tarea es. */
var COLS_FOTO = 'id,fecha,tipo,estado,modulo_id,modulo_numero,modulo_nombre,sector_tipo,persona_nombre,foto_path,tomada_en,enviado_en,nivel,nivel_ia,nivel_final,nivel_declarado,ia_resultado,respuestas,discrepancia,a_tiempo,comentario,frontal,ultimo_intento_id,revisado_en';
var COLS_FOTO_150 = 'marcas,correccion_pedida,tarea_id';

function datosFotos(rango) {
  var L = valor(_local.id), pedido = ++_fotoPedido;
  leer150('/orden_v_controles?select=' + COLS_FOTO +
       '&local_id=eq.' + L + '&foto_path=not.is.null&fecha=gte.' + rango.desde + '&fecha=lte.' + rango.hasta + (_fotoNivel ? '&nivel=eq.' + _fotoNivel : '') + '&order=tomada_en.desc&limit=150',
       COLS_FOTO_150)
    .then(function (fotos) {
      if (_solapa !== 'fotos' || pedido !== _fotoPedido) return;
      fotos = fotos || [];
      var quienes = fotos.map(function (f) { return f.persona_nombre; }).filter(function (q, i, a) { return q && a.indexOf(q) === i; }).sort();
      if (_fotoQuien && quienes.indexOf(_fotoQuien) < 0) _fotoQuien = '';
      var vistas = fotos.filter(function (f) { return !_fotoQuien || f.persona_nombre === _fotoQuien; });
      document.getElementById('fotoQuienLugar').innerHTML = quienes.length > 1 ? '<select class="imp-sel" id="fotoQuien" aria-label="Quién"><option value="">Todos</option>' + quienes.map(function (q) {
          return '<option' + (q === _fotoQuien ? ' selected' : '') + '>' + esc(q) + '</option>';
        }).join('') + '</select>' : '';
      var html = '';
      if (!vistas.length) html += '<div class="vacio">No hay fotos en este período' + (_fotoNivel ? ' con ese nivel' : '') + '.</div>';
      else html += '<p class="bajada">' + vistas.length + (vistas.length === 1 ? ' foto' : ' fotos') + '. Tocá una para verla grande.</p><div class="imp-fotos">' + vistas.map(function (f, i) {
        var distinta = f.nivel_ia && f.nivel && f.nivel_ia !== f.nivel;
        return '<button class="imp-foto" data-i="' + i + '"><img data-foto="' + esc(f.foto_path) + '" alt=""><b>' + esc(f.modulo_nombre) + '</b>' +
          '<div class="info">' + (f.tipo === 'correccion' ? estCorreccion(f)
            : estNivel(f.nivel, 'Esperando revisión') + (distinta ? '<span class="est">IA: ' + esc(NIVEL[f.nivel_ia]) + '</span>' : '') + (f.estado === 'enviado' && f.nivel ? '<span class="est sorpresa">Sin revisar</span>' : '') +
              (f.correccion_pedida ? '<span class="est corregir">Corrección pedida</span>' : '')) + '</div>' +
          '<small>' + esc(diaMes(f.fecha) + ' · ' + (f.persona_nombre || '') + (f.tipo === 'sorpresa' ? ' · sorpresa' : '') + (f.frontal ? ' · frontal nuevo' : '') + (f.a_tiempo === false ? ' · tarde' : '')) + '</small></button>';
      }).join('') + '</div>';
      var c = document.getElementById('fotoDatos');
      c.innerHTML = html;
      cargarFotos(c);
      var q = document.getElementById('fotoQuien');
      if (q) q.onchange = function () { _fotoQuien = q.value; datosFotos(rango); };
      c.querySelectorAll('[data-i]').forEach(function (b) {
        b.onclick = function () { ventanaFoto(vistas[+b.dataset.i], { alTerminar: function () { datosFotos(rango); } }); };
      });
    }).catch(function (e) { error(e, verFotos); });
}

/** La foto de una corrección (SQL 150): se mira con su tarea (Antes | Ahora), no se le pone un nivel. */
function estCorreccion(f) {
  if (f.estado === 'enviado') return '<span class="est sorpresa">Corrección para mirar</span>';
  return f.comentario ? '<span class="est vencido">Corrección: pidió otra</span>' : '<span class="est listo">Corrección: quedó bien</span>';
}

/* La ventana de una foto, igual que Revisar en la app. Mauricio, 21/10: "me gustaría verlo como figura en la
   aplicación del teléfono"; "ahora me aparecen un montón de cosas que no son para controlar". Es la misma desde Fotos
   y desde un módulo de Por local: la foto con sus marcas, cómo está (esperando revisión o revisada, lo que vio la IA,
   lo que dijo él), y abajo la sugerencia o corrección, "Que lo corrija y mande otra foto" y los cuatro niveles. La ya
   revisada tiene "Cambiar la revisión"; la foto de una corrección se mira con su tarea, Antes | Ahora. Lo que es para
   la IA (el mueble, liquidación, la foto modelo, algo propio) va al final y cerrado, en "Para mejorar la IA".
   op: { modulo (su fila de Por local: a cargo de quién, tareas abiertas), historia (las fotos anteriores del módulo),
   alTerminar (qué recargar después de revisar) }. Sin f.id es un módulo sin fotos todavía. */
var TIPO_CONTROL = { programado: 'control', sorpresa: 'sorpresa', deposito: 'depósito', correccion: 'corrección' };
function ventanaFoto(f, op) {
  op = op || {};
  var ia = f.ia_resultado || {}, m = op.modulo, alTerminar = op.alTerminar || function () {};
  var hall = (ia.hallazgos || []).filter(function (h) { return h && h.titulo; });
  var corr = f.tipo === 'correccion', revisada = f.estado === 'revisado';
  var puede = !!f.id && !soloMira() && !corr && (f.estado === 'enviado' || revisada);
  var cuando = f.enviado_en || f.tomada_en;
  var bajada = [f.persona_nombre, f.id ? TIPO_CONTROL[f.tipo] || f.tipo : '', f.frontal ? 'frontal nuevo' : '',
                cuando ? diaMes(cuando) + ' ' + hora(cuando) : f.fecha ? diaMes(f.fecha) : '', f.a_tiempo === false ? 'tarde' : '',
                m && m.responsable ? 'a cargo de ' + m.responsable : '',
                m && m.tareas_abiertas ? m.tareas_abiertas + (m.tareas_abiertas == 1 ? ' tarea abierta' : ' tareas abiertas') : '']
    .filter(Boolean).join(' · ');
  /* Las preguntas: lo que respondió (la app de antes) o lo que miró la IA, en el orden de siempre. */
  var respondio = !!f.respuestas && Object.keys(f.respuestas).length > 0;
  var orden = Object.keys(NOMBRE_PUNTO);
  var lugar = function (k) { var i = orden.indexOf(k); return i < 0 ? 99 : i; };
  var puntos = Object.keys(respondio ? f.respuestas : ia.checks || {}).sort(function (a, b) { return lugar(a) - lugar(b); });
  var estado = corr ? estCorreccion(f)
    : revisada ? '<span class="est nivel-' + esc(f.nivel_final || f.nivel) + '">Revisada: ' + esc(NIVEL[f.nivel_final || f.nivel] || '—') + '</span>'
    : '<span class="est sorpresa">Esperando revisión</span>';
  var conIA = !soloMira() && !!f.modulo_id && (esAdmin() || f.sector_tipo !== 'deposito');
  var w = ventana('<h1>' + esc(f.modulo_nombre) + '</h1>' + (bajada ? '<p class="bajada">' + esc(bajada) + '</p>' : '') +
    (!f.id ? '<div class="vacio">Todavía no hay fotos de este módulo.</div>' :
      fotoConMarcas(f.foto_path, f.marcas, { clase: 'fm-grande', alt: 'La foto del módulo' }) +
      (puede ? '<p class="ayuda-marcas" id="vfAyuda"' + (revisada ? ' hidden' : '') + '>Tocá la foto para marcar dónde. Tocá una marca para sacarla.</p>' : '') +
      (f.discrepancia ? '<div class="nota alerta vf-aviso">Lo que respondió no coincide con lo que vio la IA: miralo con atención.</div>' : '') +
      '<div class="vf-estado">' + estado +
        (f.nivel_ia ? '<span class="est nivel-' + esc(f.nivel_ia) + '">IA: ' + esc(NIVEL[f.nivel_ia]) + '</span>'
          /* En modo práctica (SQL 170) el nivel no llega al control: sólo lo ve el supervisor. */
          : nivelPractica(ia) ? '<span class="est nivel-' + esc(ia.nivel_sugerido) + '">IA, en práctica: ' + esc(NIVEL[ia.nivel_sugerido]) + '</span>'
          : ia.foto_valida === false ? '<span class="est vencido">IA: la foto no sirve</span>'
          : corr ? '' : '<span class="est">Sin revisión de la IA</span>') +
        (f.nivel_declarado ? '<span class="est nivel-' + esc(f.nivel_declarado) + '">Según él: ' + esc(NIVEL[f.nivel_declarado]) + '</span>' : '') + '</div>' +
      (!f.nivel_ia && ia.foto_valida === false && (ia.motivo_foto_invalida || ia.motivo) ? '<p class="bajada">' + esc(ia.motivo_foto_invalida || ia.motivo) + '</p>' : '') +
      (puntos.length || hall.length ? '<div class="vf-ia">' + puntos.map(function (k) {
          var dijo = respondio ? f.respuestas[k] : null, vio = ia.checks ? ia.checks[k] : null;
          return '<div class="pregunta"><span>' + esc(NOMBRE_PUNTO[k] || k) + '</span><div class="info">' +
            (respondio ? '<span class="est ' + (dijo === true ? 'listo' : dijo === false ? 'vencido' : '') + '">' + (dijo === true ? 'Dijo sí' : dijo === false ? 'Dijo no' : '—') + '</span>' : '') +
            (vio ? '<span class="est ' + (vio === 'ok' ? 'listo' : vio === 'mal' ? 'vencido' : '') + '">IA: ' + (vio === 'ok' ? 'bien' : vio === 'mal' ? 'mal' : 'no se ve') + '</span>' : '') +
            '</div></div>';
        }).join('') +
        (ia.practica && hall.length ? '<p class="ia-practica">Modo práctica: el vendedor no vio esto.' + (soloMira() ? '' : ' Decí si la IA acertó, así aprende.') + '</p>' : '') +
        /* SQL 170: en cada comentario, "Acertó" o "Se equivocó" (lo que se equivocó se le pasa a la IA con las próximas fotos). */
        hallazgosIA(ia, { foto: f.ultimo_intento_id, puede: !soloMira() }) + '</div>' : '') +
      (f.comentario ? '<div class="seccion">' + (f.correccion_pedida || corr ? 'Lo que se le pidió corregir' : 'La sugerencia') + '</div><div class="nota">' + esc(f.comentario) + '</div>'
        : f.correccion_pedida ? '<div class="nota alerta">Se le pidió que lo corrija y mande otra foto.</div>' : '') +
      (corr && f.tarea_id ? '<div class="vm-usar"><button class="boton' + (f.estado === 'enviado' && !soloMira() ? ' lima' : '') + ' chico" id="vfTarea">' +
        (f.estado === 'enviado' && !soloMira() ? 'Mirar la corrección (Antes | Ahora)' : 'Ver la corrección (Antes | Ahora)') + '</button></div>' : '') +
      (puede && revisada ? '<div class="vm-usar"><button class="boton chico" id="vfCambiar">Cambiar la revisión</button></div>' : '') +
      (puede ? '<div class="vf-revisar"' + (revisada ? ' hidden' : '') + '>' + (revisada ? '<div class="seccion">Cambiar la revisión</div>' : '') +
        '<label class="campo"><span>Sugerencia o corrección</span><textarea id="vfComent" rows="2" maxlength="500" placeholder="Ej.: 1) falta una camisa en cada pila, que sean 4"></textarea></label>' +
        '<label class="check pedir-correccion"><input type="checkbox" id="vfCorregir"> Que lo corrija y mande otra foto</label>' +
        '<p class="ayuda-chica">Con «A mejorar» o «Fuera de estándar» se le pide siempre. Si cambiás más de un nivel de lo que vio la IA, contá por qué.</p>' +
        '<div class="niveles">' + ['impecable', 'bien', 'a_mejorar', 'fuera_de_estandar'].map(function (n) {
          return '<button class="boton nivel nivel-' + n + '" data-nivel="' + n + '">' + NIVEL[n] + '</button>';
        }).join('') + '</div></div>' : '')) +
    (op.historia && op.historia.length ? '<div class="seccion">Fotos anteriores</div><div class="historia">' + op.historia.map(function (x, i) {
      return '<button class="foto-chica" data-hist="' + i + '"><img data-foto="' + esc(x.foto_path) + '" alt="">' +
        '<span class="fc-pie">' + esc(diaMes(x.tomada_en) + ' · ' + (x.persona_nombre || '')) + '</span>' +
        (x.tipo === 'correccion' ? estCorreccion(x) : x.estado === 'enviado' ? '<span class="est sorpresa">Sin revisar</span>' : estNivel(x.nivel, '—')) + '</button>';
    }).join('') + '</div>' : '') +
    (conIA ? '<details class="vm-ia"><summary>Para mejorar la IA</summary><div class="vm-ia-cuerpo"><p class="bajada">Cargando…</p></div></details>' : ''));
  engancharOpinionIA(w, f.ultimo_intento_id, { comentario: w.querySelector('#vfComent') });
  /* Lo de la IA se carga recién al abrirlo. */
  var det = w.querySelector('.vm-ia');
  if (det) det.addEventListener('toggle', function () {
    if (det.open && !det.dataset.cargado) { det.dataset.cargado = '1'; paraLaIA(det.querySelector('.vm-ia-cuerpo'), f); }
  });
  /* Una foto anterior se abre arriba de ésta; si se revisa ahí, se cierran las dos. */
  w.querySelectorAll('[data-hist]').forEach(function (b) {
    b.onclick = function () { ventanaFoto(op.historia[+b.dataset.hist], { alTerminar: function () { w.remove(); alTerminar(); } }); };
  });
  var vt = w.querySelector('#vfTarea');
  if (vt) unaVez(vt, function () {
    return tareaDeCorreccion(f.tarea_id).then(function (t) {
      if (!t) { avisar('No encontramos la tarea de esta corrección.'); return; }
      w.remove(); verTareaFoto(t, null, alTerminar);
    });
  });
  if (!puede) return;
  var form = w.querySelector('.vf-revisar'), marcador = null, coment = w.querySelector('#vfComent'), chk = w.querySelector('#vfCorregir');
  var abrir = function () {
    form.hidden = false; w.querySelector('#vfAyuda').hidden = false;
    marcador = marcarEnFoto(w.querySelector('.fm-grande'), f.marcas);
  };
  if (revisada) {
    /* Cambiar la revisión: arranca con lo que ya tenía. */
    coment.value = f.comentario || '';
    chk.checked = !!f.correccion_pedida;
    w.querySelector('#vfCambiar').onclick = function () { this.parentNode.remove(); abrir(); coment.focus(); };
  } else abrir();
  var niveles = w.querySelectorAll('[data-nivel]');
  niveles.forEach(function (bn) {
    unaVez(bn, function () {
      var n = bn.dataset.nivel, texto = String(coment.value || '').trim(), bajo = n === 'a_mejorar' || n === 'fuera_de_estandar';
      var corregir = bajo || chk.checked;
      if (corregir && !bajo && !texto) { avisar('Escribí qué tiene que corregir.'); coment.focus(); return; }
      niveles.forEach(function (x) { x.disabled = true; });
      return revisarControl(f, n, texto, corregir, marcador && marcador.marcas())
        .then(function () {
          avisar(f.modulo_nombre + ': ' + NIVEL[n] + (corregir && f.persona_nombre ? '. Le pediste a ' + f.persona_nombre + ' que lo corrija.' : corregir ? '. Le pediste que lo corrija.' : '.'));
          w.remove(); alTerminar(); return 'dejar-apagado';
        }, function (e) {
          if (/cambió la foto/i.test(mensajeDe(e))) { avisar(f.modulo_nombre + ': el vendedor cambió la foto recién. Mirala de nuevo.'); w.remove(); alTerminar(); return 'dejar-apagado'; }
          niveles.forEach(function (x) { x.disabled = false; }); throw e;
        });
    });
    /* Uno a la vez (como en la app): si ya se está mandando otro nivel, este toque no cuenta. */
    var tocar = bn.onclick;
    bn.onclick = function () {
      if (Array.prototype.some.call(niveles, function (x) { return x.disabled; })) return;
      return tocar.apply(this, arguments);
    };
  });
}

/* ── Las tareas con foto (16/10): las hechas en el período y las que esperan la corrección, para mirarlas y,
   si algo no está bien, mandarlas a corregir con un mensaje (SQL 132). SQL 150: también las correcciones que
   se pidieron al revisar una foto, con la de antes al lado y sus marcas. ── */
function tareaParaMirar(t) { return t.estado === 'hecha' && (!t.revisada_en || new Date(t.revisada_en) < new Date(t.completada_en)); }
function estTarea(t) {
  if (t.estado !== 'hecha') return '<span class="est vencido">Para corregir</span>';
  return tareaParaMirar(t) ? '<span class="est sorpresa">Para mirar</span>' : '<span class="est listo">Bien</span>';
}

var COLS_TAREA_FOTO = 'id,titulo,detalle,estado,persona_nombre,foto_path,completada_en,completada_a_tiempo,correccion,correccion_en,correcciones,revisada_en,creado_en';

/** La tarea de la foto de una corrección (para abrirla desde Módulos). */
function tareaDeCorreccion(id) {
  return leer150('/orden_v_tareas?select=' + COLS_TAREA_FOTO + '&id=eq.' + valor(id), 'foto_antes,marcas,ia_correccion')
    .then(function (r) { return (r || [])[0] || null; });
}

function datosTareasFoto(rango) {
  var L = valor(_local.id), pedido = ++_fotoPedido;
  var desdeTs = new Date(rango.desde + 'T00:00:00-03:00').toISOString(), hastaTs = new Date(sumarDias(rango.hasta, 1) + 'T00:00:00-03:00').toISOString();
  var base = '/orden_v_tareas?select=' + COLS_TAREA_FOTO + '&local_id=eq.' + L + '&order=completada_en.desc.nullslast&limit=150';
  /* Con el SQL 150, también las correcciones pedidas que todavía no mandó (tienen la foto de antes). */
  leer(base.replace('select=', 'select=foto_antes,marcas,ia_correccion,') +
       '&or=(and(foto_path.not.is.null,completada_en.gte.' + desdeTs + ',completada_en.lt.' + hastaTs + '),and(estado.in.(pendiente,vencida),or(correccion.not.is.null,foto_antes.not.is.null)))')
    .catch(function (e) {
      if (!e || e.sinSesion || esDeRed(e)) throw e;
      return leer(base + '&foto_path=not.is.null&or=(and(completada_en.gte.' + desdeTs + ',completada_en.lt.' + hastaTs + '),and(estado.in.(pendiente,vencida),correccion.not.is.null))');
    })
    .then(function (lista) {
      if (_solapa !== 'fotos' || pedido !== _fotoPedido || _fotoDe !== 'tareas') return;
      lista = lista || [];
      var mirar = lista.filter(tareaParaMirar).length, c = document.getElementById('fotoDatos');
      c.innerHTML = !lista.length ? '<div class="vacio">No hay correcciones ni fotos de tareas en este período.</div>'
        : '<p class="bajada">' + lista.length + (lista.length === 1 ? ' corrección o tarea con foto' : ' correcciones y tareas con foto') + (mirar ? ' · ' + mirar + ' para mirar' : '') +
          '. Tocá una para verla grande.</p><div class="imp-fotos">' + lista.map(function (t, i) {
            return '<button class="imp-foto" data-t="' + i + '"><img data-foto="' + esc(t.estado === 'hecha' ? t.foto_path : t.foto_antes || t.foto_path) + '" alt=""><b>' + esc(t.titulo) + '</b>' +
              '<div class="info">' + estTarea(t) + '</div>' +
              '<small>' + esc((t.estado === 'hecha' ? diaMes(t.completada_en) : 'a corregir desde el ' + diaMes(t.correccion_en || t.creado_en)) + ' · ' + (t.persona_nombre || '') +
                              (t.estado === 'hecha' && t.completada_a_tiempo === false ? ' · tarde' : '') + ((t.correcciones || []).length && t.estado === 'hecha' ? ' · corregida' : '')) + '</small></button>';
          }).join('') + '</div>';
      cargarFotos(c);
      c.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { verTareaFoto(lista[+b.dataset.t], rango); }; });
    }).catch(function (e) { error(e, verFotos); });
}

/** Una tarea con foto: la de antes (con sus marcas) y la que mandó, "Quedó bien" o "Pedir otra corrección".
    despues: qué recargar al terminar (la lista de tareas, o la de módulos si se abrió desde ahí). */
function verTareaFoto(t, rango, despues) {
  var hecha = t.estado === 'hecha', mirar = tareaParaMirar(t), puede = hecha && !soloMira(), hist = t.correcciones || [];
  var antes = !!t.foto_antes, pedido = t.correccion || (antes ? t.detalle : null);
  var fotos = antes && hecha
    ? '<div class="antes-ahora">' + fotoConMarcas(t.foto_antes, t.marcas, { etiqueta: 'Antes', alt: 'La foto de antes' }) +
      fotoConMarcas(t.foto_path, null, { etiqueta: 'Ahora', clase: 'fm-ahora', alt: 'La foto corregida' }) + '</div>'
    : antes ? fotoConMarcas(t.foto_antes, t.marcas, { etiqueta: 'Antes', clase: 'fm-grande', alt: 'La foto que tiene que corregir' })
    : fotoConMarcas(t.foto_path, null, { clase: 'fm-ahora fm-grande', alt: 'La foto de la tarea' });
  var f = ventana('<h1>' + esc(t.titulo) + '</h1><p class="bajada">' + esc((t.persona_nombre || '') + ' · ' +
      (hecha ? 'hecha el ' + diaMes(t.completada_en) + ' a las ' + hora(t.completada_en) + (t.completada_a_tiempo === false ? ' (tarde)' : '') : 'esperando la corrección')) + '</p>' +
    '<p>' + estTarea(t) + (antes && hecha && t.ia_correccion ? ' &nbsp; IA: ' + estNivel(t.ia_correccion) : '') + '</p>' +
    fotos +
    (pedido ? '<div class="nota' + (hecha ? '' : ' alerta') + '" style="margin-top:12px"><b>' + (hecha ? 'Le habías pedido:' : 'Le pediste:') + '</b> ' + esc(pedido) + '</div>' : '') +
    (t.detalle && t.detalle !== pedido ? '<div class="seccion">La tarea</div><p class="bajada">' + esc(t.detalle) + '</p>' : '') +
    (hist.length > 1 || (hist.length && hist[hist.length - 1].mensaje !== pedido) ? '<div class="seccion">Lo que se le pidió corregir</div>' + hist.map(function (h) {
      return '<div class="nota">' + esc(diaMes(h.en) + ' ' + hora(h.en) + ': ' + h.mensaje) + '</div>';
    }).join('') : '') +
    (puede ? '<div class="seccion">' + (mirar ? (antes ? '¿Quedó bien?' : '¿Está bien hecha?') : '¿Viste algo mal?') + '</div>' +
      '<p class="ayuda-chica">Si hay que corregir algo, tocá la foto' + (antes ? ' de «Ahora»' : '') + ' para marcar dónde. Tocá una marca para sacarla.</p>' +
      '<label class="campo"><span>Qué tiene que corregir (sólo si hace falta)</span><textarea id="vtMsg" rows="2" maxlength="500" placeholder="Ej.: 1) la pila de la izquierda sigue con 3"></textarea></label>' +
      '<div class="vm-usar">' + (mirar ? '<button class="boton lima chico" id="vtBien">' + (antes ? 'Quedó bien' : 'Está bien') + '</button> ' : '') +
      '<button class="boton chico" id="vtCorregir">' + (antes ? 'Pedir otra corrección' : 'Mandar a corregir') + '</button></div>' : ''));
  var listo = function (texto) { avisar(texto); f.remove(); (despues || function () { datosTareasFoto(rango); })(); return 'dejar-apagado'; };
  /* Las marcas van sobre la foto que mandó (con Antes | Ahora, la de la derecha). */
  var marcador = puede ? marcarEnFoto(f.querySelector('.fm-ahora') || f.querySelector('.foto-marcas')) : null;
  var b = f.querySelector('#vtBien'), m = f.querySelector('#vtCorregir');
  if (b) unaVez(b, function () {
    return revisarTarea(t, true).then(function () { return listo(antes ? 'Listo: la corrección quedó bien.' : 'Listo: «' + t.titulo + '» está bien.'); });
  });
  if (m) unaVez(m, function () {
    var msg = String(f.querySelector('#vtMsg').value || '').trim();
    if (!msg) { avisar('Escribí qué tiene que corregir.'); f.querySelector('#vtMsg').focus(); return; }
    return revisarTarea(t, false, msg, marcador && marcador.marcas()).then(function () {
      return listo('Se la mandaste a corregir' + (t.persona_nombre ? ' a ' + t.persona_nombre : '') + '.');
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   CÓMO ESTÁ EL LOCAL
   ════════════════════════════════════════════════════════════════════════ */

/* ── La foto de esta semana de cada módulo (28/10, Mauricio: "que me aparezca una alerta… para ver quién nos mandó los
      módulos, las fotos nuevas"; "que diga foto de la semana anterior"; "a Seba un tilde, como que ya la mandó esta
      semana"). Sale de los controles desde el lunes (sin las correcciones), como los arma la base:
        'ok'    la mandó (aunque sea tarde);
        'falta' ya le tocaba y no la mandó (se puede mandar hasta el domingo y queda tarde);
        'hoy'   le toca hoy y todavía no la mandó;
        'luego' le toca más adelante esta semana (el día del local, corrido por el franco del que lo tiene).
      La vidriera, con orden_vidriera_semana (SQL 159): la primera foto de la semana vale para todo el local. ── */
var _semanaLocal = null;   // { local, mods: { id del módulo: { estado, quien, en, dia, hasta, tarde } } }

function datosSemana(localId) {
  var L = valor(localId);
  return Promise.all([
    leer('/orden_v_controles?select=modulo_id,tipo,estado,fecha,vence_en,enviado_en,persona_nombre,a_tiempo&local_id=eq.' + L +
         '&fecha=gte.' + lunesAR() + '&tipo=neq.correccion'),
    llamar('orden_vidriera_semana', { p_local: localId }).catch(function () { return null; }),
    leer('/orden_config?select=dias_control,deposito_dia_vence&local_id=eq.' + L).catch(function () { return []; }),
    leer('/orden_personas?select=id,dias_libres&local_id=eq.' + L + '&activo=is.true').catch(function () { return []; })
  ]).then(function (r) { return { controles: r[0] || [], vidriera: r[1], config: (r[2] || [])[0] || {}, personas: r[3] || [] }; });
}

/** El día de la semana (1 = lunes … 7 = domingo) de una fecha AAAA-MM-DD. */
function diaIso(f) { return (new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7 + 1; }
/** Como orden_dia_que_le_toca: si ese día tiene franco, el último que trabaja antes en la semana (o, si no hay, el primero
    después). Sin las vacaciones ni los días que el local no abre: es para decir "le toca el jueves". */
function diaQueLeToca(libres, n) {
  var trabaja = function (k) { return (libres || []).map(Number).indexOf(k) < 0; };
  for (var k = n; k >= 1; k--) if (trabaja(k)) return k;
  for (k = n + 1; k <= 7; k++) if (trabaja(k)) return k;
  return n;
}

function semanaDeModulos(x, d, localId) {
  var hoy = hoyAR(), hoyIso = diaIso(hoy), ahora = Date.now(), por = {}, libres = {}, out = {}, cfg = x.config || {};
  x.controles.forEach(function (c) { (por[c.modulo_id] = por[c.modulo_id] || []).push(c); });
  x.personas.forEach(function (p) { libres[p.id] = p.dias_libres || []; });
  d.modulos.forEach(function (m) {
    var s = d.sectorDe[m.sector_id], cs = por[m.id] || [], v = x.vidriera;
    if (esVidriera(m) && v) {
      var vm = (v.vidrieras || []).filter(function (y) { return y.modulo === m.id; })[0];
      out[m.id] = vm && vm.mandada_en ? { estado: 'ok', quien: vm.por_nombre, en: vm.mandada_en }
        : !v.abierta ? { estado: 'luego', dia: v.dia }
        : v.tarde || hoy > v.dia ? { estado: 'falta', dia: v.dia } : { estado: 'hoy', hasta: v.limite };
      return;
    }
    var sin = cs.filter(function (c) { return c.estado === 'pendiente' || c.estado === 'vencido'; });
    var vencida = sin.filter(function (c) { return c.estado === 'vencido' || new Date(c.vence_en).getTime() <= ahora; })[0];
    if (vencida) { out[m.id] = { estado: 'falta', quien: vencida.persona_nombre, dia: vencida.fecha }; return; }
    if (sin.length) { out[m.id] = { estado: 'hoy', quien: sin[0].persona_nombre, hasta: sin[0].vence_en }; return; }
    var mandada = cs.filter(function (c) { return c.enviado_en && (c.estado === 'enviado' || c.estado === 'revisado'); })
      .sort(function (a, b) { return a.enviado_en < b.enviado_en ? 1 : -1; })[0];
    if (mandada) { out[m.id] = { estado: 'ok', quien: mandada.persona_nombre, en: mandada.enviado_en, tarde: mandada.a_tiempo === false, dia: mandada.fecha }; return; }
    /* Todavía no se pidió: si su día es más adelante, "le toca el jueves"; si ya pasó y no se pidió (vacaciones, nadie a
       cargo), nada. */
    var dias = s && s.tipo === 'deposito' ? [+cfg.deposito_dia_vence] : (cfg.dias_control || []).map(Number);
    var prox = dias.filter(function (n) { return n >= 1 && n <= 7; }).map(function (n) {
      return s && s.responsable_id ? diaQueLeToca(libres[s.responsable_id], n) : n;
    }).filter(function (n) { return n > hoyIso; }).sort()[0];
    if (prox) out[m.id] = { estado: 'luego', dia: sumarDias(lunesAR(), prox - 1) };
  });
  return { local: localId, mods: out };
}

/** La foto de esta semana del módulo id del local que se está mirando (o null: sin datos, o no se pidió). */
function semanaDe(id) { return _semanaLocal && _semanaLocal.local === _local.id ? _semanaLocal.mods[id] || null : null; }
/** Cómo se dice, corto (en la tarjeta y en la leyenda) y largo (al pasar el mouse). */
function textoSemana(sm) {
  if (!sm) return null;
  if (sm.estado === 'ok') return { corto: '✓ Esta semana', largo: (sm.quien ? 'La mandó ' + sm.quien + ' ' : 'Mandada ') + cuandoFue(sm.en) + (sm.tarde ? ' (tarde: le tocaba el ' + diaYFecha(sm.dia) + ')' : '') };
  if (sm.estado === 'falta') return { corto: 'Falta la de esta semana', largo: 'Le tocaba ' + (sm.quien ? 'a ' + sm.quien + ' ' : '') + 'el ' + diaYFecha(sm.dia) + ' y no la mandó. Todavía la puede mandar hasta el domingo (queda tarde).' };
  if (sm.estado === 'hoy') return { corto: 'Le toca hoy', largo: 'Le toca hoy' + (sm.quien ? ' a ' + sm.quien : '') + (sm.hasta ? ', hasta las ' + hora(sm.hasta) : '') + '.' };
  var dia = DIAS_LARGO[diaIso(sm.dia) - 1];
  return { corto: 'Le toca el ' + dia, largo: 'Esta semana le toca el ' + dia + ' ' + diaMes(sm.dia) + '.' };
}
/** La marca de la semana (la misma del croquis): ✓, ! o la cámara. */
var MARCA_SEMANA = { ok: 'listo', falta: 'falta', hoy: 'pendiente' };
function marcaSemanaSvg(estado) {
  var t = MARCA_SEMANA[estado];
  return t ? '<svg class="marca-sem" viewBox="-14 -14 28 28" aria-hidden="true">' + marcaModulo(t, 0, 0) + '</svg>' : '';
}
/** De cuándo es la foto que se ve, si no es de esta semana: "Semana pasada" o "Del 12/10". */
function fotoDeOtraSemana(ts) {
  if (!ts) return null;
  var f = hoyAR(new Date(ts)), lunes = lunesAR();
  return f >= lunes ? null : f >= sumarDias(lunes, -7) ? 'Semana pasada' : 'Del ' + diaMes(f);
}
/** El resumen de la semana arriba del croquis, que es también la leyenda de las marcas. */
function resumenSemana(d) {
  if (!_semanaLocal || !d) return '';
  var n = { ok: 0, falta: 0, hoy: 0, luego: 0 };
  d.modulos.forEach(function (m) { var sm = semanaDe(m.id); if (sm) n[sm.estado]++; });
  if (!n.ok && !n.falta && !n.hoy && !n.luego) return '';
  var pieza = function (k, texto) { return n[k] ? '<span class="sem-res sem-' + k + '">' + marcaSemanaSvg(k) + '<b>' + n[k] + '</b> ' + texto + '</span>' : ''; };
  return '<div class="sem-resumen"><span class="sem-tit">Esta semana</span>' +
    pieza('ok', n.ok === 1 ? 'mandada' : 'mandadas') + pieza('falta', n.falta === 1 ? 'falta (ya le tocaba)' : 'faltan (ya les tocaba)') +
    pieza('hoy', 'para hoy') + pieza('luego', 'más adelante en la semana') + '</div>';
}

function verLocal() {
  var L = valor(_local.id), localId = _local.id;
  Promise.all([
    leer('/orden_v_estado_local?select=*&local_id=eq.' + L + '&order=sector_tipo.desc,sector_numero.asc,modulo_numero.asc'),
    llamar('orden_resumen_semanal', { p_local: _local.id, p_semana: lunesAR() }).catch(function () { return null; }),
    leer('/orden_v_persona_semana?select=semana,controles,controles_a_tiempo,controles_tarde,controles_vencidos,puntos,nivel_semana&local_id=eq.' + L + '&semana=gte.' + sumarDias(lunesAR(), -49))
      .catch(function () { return []; }),
    cargarMapa(_local.id).catch(function () { return null; }),
    /* Sin esto (un error, sin permiso), las tarjetas y el croquis quedan como antes: apagadas con más de 7 días. */
    datosSemana(_local.id).catch(function () { return null; })
  ]).then(function (r) {
    if (_solapa !== 'local') return;
    var mods = r[0] || [], res = r[1] || {};
    _semanaLocal = r[3] && r[4] ? semanaDeModulos(r[4], r[3], localId) : null;
    var html = '<div class="numeros">' +
      '<div class="numero"><span>Nivel de la semana</span><b>' + esc(res.nivel_local || '—') + '</b></div>' +
      '<div class="numero"><span>Controles a tiempo</span><b>' + (res.controles ? res.controles_a_tiempo + ' de ' + res.controles : '—') + '</b></div>' +
      '<div class="numero"><span>Tareas pendientes</span><b>' + (res.tareas_pendientes != null ? res.tareas_pendientes : '—') + '</b></div>' +
      '<div class="numero"><span>Fotos sin revisar</span><b>' + (res.sin_revisar != null ? res.sin_revisar : '—') + '</b></div></div>';
    /* El croquis es lo principal (Mauricio, 15/10: "que el protagonista sea el croquis"): va arriba; el gráfico semana a
       semana, al final y cerrado. */
    _mapaLocal = r[3];
    html += '<div id="zonaMapa"></div>';
    if (!mods.length) html += '<div class="vacio">Este local todavía no tiene módulos: se arman en el mapa, con "Armar el croquis".</div>';
    [['salon', 'Salón'], ['deposito', 'Depósito']].forEach(function (g) {
      var lista = mods.filter(function (m) { return m.sector_tipo === g[0]; });
      if (!lista.length) return;
      html += '<div class="seccion">' + g[1] + '</div><div class="grilla-local">' + lista.map(function (m) {
        /* La de esta semana: ✓ si la mandó, la alerta si ya le tocaba y no la mandó; la foto de otra semana, apagada y con
           "Semana pasada" arriba. Sin los datos de la semana, como antes (apagada con más de 7 días). */
        var sm = semanaDe(m.modulo_id), ts = textoSemana(sm), otra = m.foto_path && (!sm || sm.estado !== 'ok') ? fotoDeOtraSemana(m.tomada_en) : null;
        var gris = _semanaLocal ? !!otra : m.sin_foto_reciente;
        return '<button class="tarjeta-modulo' + (gris ? ' gris' : '') + (sm ? ' sem-' + sm.estado : '') + '" data-modulo="' + esc(m.modulo_id) + '"' +
          (ts ? ' title="' + esc(ts.largo) + '"' : '') + '>' +
          '<div class="tm-foto">' + (m.foto_path ? '<img data-foto="' + esc(m.foto_path) + '" alt="">' : '<div class="sin-foto">Sin foto</div>') +
            (otra ? '<span class="tm-otra">' + esc(otra) + '</span>' : '') + (sm ? marcaSemanaSvg(sm.estado) : '') + '</div>' +
          '<b>' + esc(m.modulo_nombre) + '</b>' +
          '<div class="info">' + (ts ? '<span class="est sem sem-' + sm.estado + '">' + esc(ts.corto) + '</span>' : '') +
          (m.nivel ? '<span class="est nivel-' + esc(m.nivel) + '">' + esc(NIVEL[m.nivel]) + '</span>' : '') +
          (m.tareas_abiertas ? '<span class="est corregir">' + m.tareas_abiertas + (m.tareas_abiertas == 1 ? ' tarea' : ' tareas') + '</span>' : '') + '</div>' +
          '<small>' + esc(haceDias(m.tomada_en) + (m.foto_de ? ' · ' + m.foto_de : '') + (sm && sm.estado === 'ok' && sm.tarde ? ' · tarde' : '') +
                          (m.responsable ? ' · a cargo de ' + m.responsable : '')) + '</small></button>';
      }).join('') + '</div>';
    });
    var gr = graficoLocal(r[2]);
    if (gr) html += '<details class="imp-grafico-det"><summary>Semana a semana: controles a tiempo y nivel</summary>' + gr + '</details>';
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    cargarFotos(c);
    var porId = {};
    mods.forEach(function (m) { porId[m.modulo_id] = m; });
    c.querySelectorAll('[data-modulo]').forEach(function (b) { b.onclick = function () { verModulo(porId[b.dataset.modulo]); }; });
    _porIdLocal = porId;
    dibujarMapaLocal();
  }).catch(function (e) { error(e, verLocal); });
}

function ventana(html) {
  var f = document.createElement('div');
  f.className = 'ventana-fondo';
  f.innerHTML = '<div class="ventana">' + html + '<button class="boton" id="cerrarVentana" style="margin-top:14px">Cerrar</button></div>';
  document.body.appendChild(f);
  /* Si adentro quedó algo escrito sin guardar ("algo propio" de un módulo), pregunta antes de cerrar. */
  var cerrar = function () {
    if (f.querySelector('[data-aviso-guardar]:not([disabled])') && !confirm('Hay cambios sin guardar. ¿Cerrar igual? Lo que no guardaste se pierde.')) return;
    f.remove();
  };
  f.querySelector('#cerrarVentana').onclick = cerrar;
  f.onclick = function (e) { if (e.target === f) cerrar(); };
  cargarFotos(f);
  return f;
}

/* Un módulo de Por local: su última foto en la ventana de la foto (la misma de Fotos, como Revisar en la app), con
   las anteriores abajo. Después de revisar se recarga Por local. */
function verModulo(m) {
  leer150('/orden_v_controles?select=' + COLS_FOTO + '&modulo_id=eq.' + valor(m.modulo_id) + '&foto_path=not.is.null&order=tomada_en.desc&limit=12', COLS_FOTO_150)
    .then(function (h) {
      h = h || [];
      var f = h[0] || { modulo_id: m.modulo_id, modulo_nombre: m.modulo_nombre, sector_tipo: m.sector_tipo };
      ventanaFoto(f, { modulo: m, historia: h.slice(1), alTerminar: function () { if (_solapa === 'local') verLocal(); } });
    }).catch(function (e) { avisar(mensajeDe(e)); });
}

/* "Para mejorar la IA" (abajo y cerrado en la ventana de la foto): lo que la IA tiene en cuenta con las fotos de este
   módulo. Antes estaba suelto debajo de la foto ("Cómo se revisa"), mezclado con el control. */
function paraLaIA(cont, f) {
  var admin = esAdmin(), dep = f.sector_tipo === 'deposito', M = valor(f.modulo_id);
  Promise.all([
    /* La foto modelo y "algo propio" (antes en Ajustes → Sectores y módulos): sólo el administrador los cambia. */
    admin ? leer('/orden_modulos?select=id,foto_referencia_path,reglas_extra&id=eq.' + M) : Promise.resolve([]),
    /* Liquidación (SQL 125): va por talle y la IA no pide degradé. La marcan el supervisor y el administrador; sin el SQL no aparece. */
    dep ? Promise.resolve(null) : leer('/orden_modulos?select=liquidacion&id=eq.' + M).catch(function () { return null; }),
    /* El tipo de mueble (SQL 129): cambia las 4 preguntas del control y lo que mira la IA. Sin el SQL no aparece. */
    dep ? Promise.resolve(null) : leer('/orden_modulos?select=mueble,isla,nombre&id=eq.' + M).catch(function () { return null; })
  ]).then(function (r) {
    var mod = (r[0] || [])[0] || null;
    var liq = r[1] && r[1][0] && typeof r[1][0].liquidacion === 'boolean' ? r[1][0].liquidacion : null;
    var mb = r[2] && r[2][0] && 'mueble' in r[2][0] ? r[2][0] : null;
    if (!mod && liq === null && !mb) { cont.innerHTML = '<p class="bajada">No hay nada para ajustar en este módulo.</p>'; return; }
    cont.innerHTML = '<p class="bajada-chica vm-ia-bajada">No cambia la revisión: es lo que la IA tiene en cuenta cuando mira las fotos de este módulo.</p>' +
      (mb ? '<label class="campo vm-mueble"><span>Tipo de mueble</span><select id="vmMueble">' +
        '<option value="">' + esc('Como en el croquis: ' + nombreMueble(muebleDelCroquis(mb))) + '</option>' +
        TIPOS_MUEBLE.filter(function (t) { return t[0] !== 'deposito'; }).map(function (t) {
          return '<option value="' + t[0] + '"' + (mb.mueble === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join('') + '</select></label><p class="bajada-chica vm-preguntas" id="vmPreguntas"></p>' : '') +
      (liq !== null ? '<label class="vm-liq"><input type="checkbox" id="vmLiq"' + (liq ? ' checked' : '') + '><span><b>Es de liquidación</b>' +
        '<small>Lo colgado va ordenado por talle, no por color: la IA no pide degradé.</small></span></label>' : '') +
      (mod ? '<div id="vmModelo"></div>' +
        '<label class="campo"><span>Algo propio de este módulo (opcional: la IA lo lee con cada foto)</span><textarea id="vmPropio" rows="2" maxlength="300" placeholder="Ej.: acá van sólo gorras, colgadas y no dobladas">' + esc(mod.reglas_extra || '') + '</textarea></label>' +
        '<div class="vm-propio-acc"><button class="boton chico lima" id="vmPropioGuardar" data-aviso-guardar disabled>Guardar lo propio</button></div>' : '');
    var sm = cont.querySelector('#vmMueble');
    if (sm) {
      var pintarPreguntas = function (t) {
        cont.querySelector('#vmPreguntas').textContent = 'Las 4 preguntas del control: ' + (CHECKS_MUEBLE[t] || CHECKS_MUEBLE.estantes).map(function (k) { return NOMBRE_PUNTO[k]; }).join(' · ') + '.';
      };
      var elegido = sm.value;
      pintarPreguntas(elegido || muebleDelCroquis(mb));
      sm.onchange = function () {
        var nuevo = sm.value;
        sm.disabled = true;
        /* Devuelve el mueble que queda y cuántas tareas de la IA canceló (de puntos que ese mueble no tiene). */
        llamar('orden_modulo_mueble', { p_modulo: f.modulo_id, p_mueble: nuevo || null }).then(function (r) {
          var queda = r && typeof r === 'object' ? r.mueble : r, canceladas = (r && r.tareas_canceladas) || 0;
          var t = typeof queda === 'string' && CHECKS_MUEBLE[queda] ? queda : nuevo || muebleDelCroquis(mb);
          elegido = nuevo;
          pintarPreguntas(t);
          avisar('Listo: ' + f.modulo_nombre + ' queda como ' + nombreMueble(t) + '. Ya se pregunta eso, y la IA lo mira así desde la próxima foto.' +
                 (canceladas ? ' Se ' + (canceladas === 1 ? 'canceló 1 tarea' : 'cancelaron ' + canceladas + ' tareas') + ' de la IA de puntos que este mueble no tiene.' : ''));
        }, function (e) { sm.value = elegido; avisar(mensajeDe(e)); }).then(function () { sm.disabled = false; });
      };
    }
    var cl = cont.querySelector('#vmLiq');
    if (cl) cl.onchange = function () {
      var valorNuevo = cl.checked;
      cl.disabled = true;
      llamar('orden_modulo_liquidacion', { p_modulo: f.modulo_id, p_valor: valorNuevo }).then(function () {
        avisar(valorNuevo ? 'Listo: ' + f.modulo_nombre + ' es de liquidación. La IA no pide degradé desde la próxima foto.'
                          : 'Listo: ' + f.modulo_nombre + ' ya no es de liquidación.');
      }, function (e) { cl.checked = !valorNuevo; avisar(mensajeDe(e)); }).then(function () { cl.disabled = false; });
    };
    if (!mod) return;
    dibujarModelo(cont.querySelector('#vmModelo'), mod, f, f.foto_path);
    var ta = cont.querySelector('#vmPropio'), gp = cont.querySelector('#vmPropioGuardar');
    ta.oninput = function () { gp.disabled = ta.value.trim() === String(mod.reglas_extra || '').trim(); };
    unaVez(gp, function () {
      var t = ta.value.trim() || null;
      return guardarFila('/orden_modulos?id=eq.' + valor(mod.id), { reglas_extra: t }).then(function () {
        mod.reglas_extra = t; avisar('Guardado: la IA lo lee desde la próxima foto.'); return 'dejar-apagado';
      });
    });
  }).catch(function (e) {
    cont.innerHTML = '<p class="bajada">' + esc(mensajeDe(e)) + '</p>';
    delete cont.parentNode.dataset.cargado;   // al cerrarlo y abrirlo de nuevo, lo vuelve a intentar
  });
}

/** La foto modelo de un módulo: así tiene que quedar (la IA compara con ésta y el vendedor la ve en chiquito al sacar la foto).
    actual: la foto de la ventana, para "Usar la foto de arriba". */
function dibujarModelo(cont, mod, m, actual) {
  if (!cont) return;
  cont.innerHTML = '<div class="vm-modelo">' + (mod.foto_referencia_path ? '<img class="ref-mini" data-foto="' + esc(mod.foto_referencia_path) + '" alt="Foto modelo">' : '<div class="ref-mini sin-foto">Sin foto modelo</div>') +
    '<div><b>Foto modelo</b><p class="bajada-chica">' + (mod.foto_referencia_path
      ? 'Así tiene que quedar. La IA compara cada foto con ésta, y al vendedor le aparece en chiquito al sacar la foto.'
      : 'Todavía no tiene. ' + (actual ? 'Si la foto de arriba salió bien, usala; si no, subí una.' : 'Subí una que haya salido bien.') +
        ' Mientras tanto, la IA usa la foto ejemplo de su tipo de mueble (Ajustes → Reglas de orden).') + '</p>' +
    '<div class="imp-mapa-acc">' + (actual ? '<button class="boton chico" data-usar-actual>Usar la foto de arriba</button>' : '') +
      '<button class="boton chico" data-subir-modelo>' + (mod.foto_referencia_path ? 'Subir otra' : 'Subir una foto') + '</button>' +
      (mod.foto_referencia_path ? '<button class="boton chico" data-sacar-modelo>Sacar</button>' : '') + '</div></div></div>';
  cargarFotos(cont);
  var u = cont.querySelector('[data-usar-actual]');
  if (u) unaVez(u, function () {
    return usarComoModelo(mod, actual).then(function () { dibujarModelo(cont, mod, m, actual); avisar('Listo: es la foto modelo de ' + m.modulo_nombre + ' (la IA compara con ésta).'); });
  });
  cont.querySelector('[data-subir-modelo]').onclick = function () {
    elegirFoto(function (blob) {
      return subirArchivo(rutaModelo(mod), blob).then(function (ruta) { return ponerModelo(mod, ruta); })
        .then(function () { dibujarModelo(cont, mod, m, actual); avisar('Foto modelo guardada.'); });
    });
  };
  var s = cont.querySelector('[data-sacar-modelo]');
  if (s) unaVez(s, function () {
    if (!confirm('¿Sacar la foto modelo de ' + m.modulo_nombre + '? La IA va a usar la foto ejemplo de su tipo de mueble.')) return;
    return ponerModelo(mod, null).then(function () { dibujarModelo(cont, mod, m, actual); avisar('Listo: sin foto modelo.'); });
  });
}
function rutaModelo(mod) { return _local.id + '/referencias/' + mod.id + '-' + nombreArchivo(); }
function ponerModelo(mod, ruta) {
  return guardarFila('/orden_modulos?id=eq.' + valor(mod.id), { foto_referencia_path: ruta }).then(function () { mod.foto_referencia_path = ruta; });
}
/** "Usar como modelo": se copia la foto (las del control se borran a los 30 días; la modelo, nunca). */
function usarComoModelo(mod, ruta) { return copiarFoto(ruta, rutaModelo(mod)).then(function (nueva) { return ponerModelo(mod, nueva); }); }

/** Copia una foto adentro de orden-fotos. Si el servidor no sabe copiar, la baja y la vuelve a subir. */
function copiarFoto(desde, hasta) {
  return tokenVend().then(function (t) {
    return fetch(BASE + '/storage/v1/object/copy', {
      method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: BUCKET, sourceKey: desde, destinationKey: hasta })
    });
  }).then(function (r) {
    if (r.ok) return hasta;
    return urlFirmada(desde).then(function (u) {
      if (!u) throw rechazo('No se pudo copiar la foto.');
      return fetch(u).then(function (x) { if (!x.ok) throw rechazo('No se pudo copiar la foto.'); return x.blob(); })
        .then(function (b) { return subirArchivo(hasta, b); });
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   ORDEN (las estadísticas)
   ════════════════════════════════════════════════════════════════════════ */

/* El período es el selector común (15/10/2026): arranca en las últimas 4 semanas. */
var _ordenPedido = 0;
function verOrden() {
  var c = document.getElementById('cuerpo');
  c.innerHTML = '<div class="imp-filtros"><div id="ordenPer"></div></div><div id="ordenDatos"><p class="cargando">Cargando…</p></div>';
  var sel = Interfaz.periodo(document.getElementById('ordenPer'), {
    inicial: '4s', atajos: ['semana', 'semana-pasada', '4s', '8s', '12s', 'mes', 'mes-pasado', '3m'], guardar: 'nc_eq_vendedor',
    alCambiar: function (r) { datosOrden(r); }
  });
  datosOrden(sel.rango());
}

function datosOrden(rango) {
  var L = valor(_local.id), pedido = ++_ordenPedido;
  var semanas = semanasDe(rango), desde = semanas[0], hastaSem = semanas[semanas.length - 1];
  var desdeTs = new Date(rango.desde + 'T00:00:00-03:00').toISOString(), hastaTs = new Date(sumarDias(rango.hasta, 1) + 'T00:00:00-03:00').toISOString();
  Promise.all([
    leer('/orden_v_persona_semana?select=*&local_id=eq.' + L + '&semana=gte.' + desde + '&semana=lte.' + hastaSem + '&order=semana.asc'),
    leer('/orden_controles?select=nivel_ia,nivel_final&local_id=eq.' + L + '&estado=eq.revisado&nivel_ia=not.is.null&revisado_en=gte.' + desdeTs + '&revisado_en=lt.' + hastaTs),
    leer('/orden_v_personas?select=id,nombre,inicial,avisos_activos,ultima_foto&local_id=eq.' + L + '&activo=is.true&rol=eq.vendedor&order=nombre.asc'),
    leer('/orden_v_tareas?select=origen,estado&local_id=eq.' + L + '&creado_en=gte.' + desdeTs + '&creado_en=lt.' + hastaTs),
    /* SQL 170: en modo práctica el nivel de la IA no llega al control (queda en lo que vio), y lo que el supervisor
       dijo de cada comentario. Sin el SQL, nada. */
    leer('/orden_v_controles?select=nivel_final,sug:ia_resultado->>nivel_sugerido&local_id=eq.' + L + '&estado=eq.revisado&nivel_ia=is.null' +
         '&ia_resultado->>practica=eq.true&revisado_en=gte.' + desdeTs + '&revisado_en=lt.' + hastaTs).catch(function () { return []; }),
    leer('/orden_ia_opiniones?select=acerto&local_id=eq.' + L + '&marcado_en=gte.' + desdeTs + '&marcado_en=lt.' + hastaTs).catch(function () { return null; })
  ]).then(function (r) {
    if (_solapa !== 'orden' || pedido !== _ordenPedido) return;
    var filas = r[0] || [], gente = r[2] || [], tareas = r[3] || [], opiniones = r[5];
    var ia = (r[1] || []).concat((r[4] || []).filter(function (x) { return NIVEL[x.sug] && x.nivel_final; })
      .map(function (x) { return { nivel_ia: x.sug, nivel_final: x.nivel_final }; }));
    var aciertos = (opiniones || []).filter(function (o) { return o.acerto; }).length;
    var por = {};
    filas.forEach(function (f) { (por[f.persona_id] = por[f.persona_id] || {})[f.semana] = f; });
    var puntos = { impecable: 4, bien: 3, a_mejorar: 2, fuera_de_estandar: 1 };
    var exactas = ia.filter(function (x) { return x.nivel_ia === x.nivel_final; }).length;
    var cerca = ia.filter(function (x) { return Math.abs(puntos[x.nivel_ia] - puntos[x.nivel_final]) <= 1; }).length;
    var origen = { ia: 0, supervisor: 0, admin: 0, sistema: 0 };
    tareas.forEach(function (t) { origen[t.origen] = (origen[t.origen] || 0) + 1; });
    var sinAvisos = gente.filter(function (p) { return !p.avisos_activos; });

    var html = '<div class="numeros">' +
      '<div class="numero"><span>Cuánto acierta la IA (igual que el supervisor)</span><b>' + (ia.length ? Math.round(100 * exactas / ia.length) + '%' : '—') + '</b><span>' + (ia.length ? 'A un nivel o menos: ' + Math.round(100 * cerca / ia.length) + '% · ' + ia.length + ' fotos revisadas' : 'Todavía sin fotos revisadas') + '</span></div>' +
      (opiniones ? '<div class="numero"><span>Comentarios de la IA que acertaron</span><b>' + (opiniones.length ? Math.round(100 * aciertos / opiniones.length) + '%' : '—') + '</b><span>' +
        (opiniones.length ? aciertos + ' de ' + opiniones.length + ' que marcó el supervisor' : 'Se marcan al revisar: «Acertó» o «Se equivocó»') + '</span></div>' : '') +
      '<div class="numero"><span>Tareas del período</span><b>' + tareas.length + '</b><span>IA ' + origen.ia + ' · supervisor ' + origen.supervisor + ' · administración ' + origen.admin + ' · sistema ' + origen.sistema + '</span></div>' +
      '<div class="numero"><span>Sin los avisos activados</span><b>' + sinAvisos.length + '</b><span>' + esc(sinAvisos.map(function (p) { return p.nombre + (p.inicial ? ' ' + p.inicial + '.' : ''); }).join(', ') || 'Todos los tienen') + '</span></div></div>' +
      '<div class="seccion">Por vendedor y por semana</div>';
    if (!gente.length) html += '<div class="vacio">Todavía no hay vendedores en este local.</div>';
    else {
      html += '<div class="desliza"><table class="tabla-datos"><thead><tr><th>Vendedor</th>' + semanas.map(function (s) { return '<th>' + esc(diaMes(s)) + '</th>'; }).join('') +
        '<th class="n">Controles a tiempo</th><th class="n">Tareas a tiempo</th><th class="n">Test</th></tr></thead><tbody>' +
        gente.map(function (p) {
          var t = { c: 0, ca: 0, t: 0, ta: 0, d: 0, dt: 0 };
          var celdas = semanas.map(function (s) {
            var f = (por[p.id] || {})[s];
            if (!f) return '<td>—</td>';
            t.c += f.controles; t.ca += f.controles_a_tiempo; t.t += f.tareas; t.ta += f.tareas_a_tiempo; t.d += f.desafio_puntaje || 0; t.dt += f.desafio_total || 0;
            return '<td>' + (f.nivel_semana ? '<span class="est nivel-' + esc(f.nivel_semana) + '">' + esc(NIVEL[f.nivel_semana]) + '</span>' : '—') + '</td>';
          }).join('');
          var pc = function (a, b) { return b ? a + '/' + b + ' (' + Math.round(100 * a / b) + '%)' : '—'; };
          return '<tr><td><b>' + esc(p.nombre + (p.inicial ? ' ' + p.inicial + '.' : '')) + '</b><br><a class="ver-app-admin" href="vendedores.html#/ver/' + esc(p.id) + '">Ver su app</a></td>' + celdas +
            '<td class="n">' + pc(t.ca, t.c) + '</td><td class="n">' + pc(t.ta, t.t) + '</td><td class="n">' + (t.dt ? t.d + '/' + t.dt : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    document.getElementById('ordenDatos').innerHTML = html;
  }).catch(function (e) { error(e, verOrden); });
}

/* ════════════════════════════════════════════════════════════════════════
   CAJAS (como la planilla "Control Diario")
   ════════════════════════════════════════════════════════════════════════ */

var _mes = null, _cajasTodos = false;
var NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function nombreMes(m) { var n = NOMBRE_MES[+m.slice(5) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + m.slice(0, 4); }
/* Los últimos 6 meses ('AAAA-MM'), del actual para atrás, con la fecha de Argentina. */
function mesesCajas() {
  var a = +hoyAR().slice(0, 4), m = +hoyAR().slice(5, 7), r = [];
  for (var i = 0; i < 6; i++) { r.push(a + '-' + (m < 10 ? '0' : '') + m); m--; if (!m) { m = 12; a--; } }
  return r;
}
function mesSiguiente(mes) { var a = +mes.slice(0, 4), m = +mes.slice(5) + 1; if (m > 12) { m = 1; a++; } return a + '-' + (m < 10 ? '0' : '') + m; }
/* Los cierres del mes (SQL 115). Si todavía no corrió, Cajas anda igual y lo dice. */
function leerCierres(ruta) {
  return leer(ruta).then(function (x) { return { filas: x || [] }; }, function (e) {
    if (e && !e.sinSesion && e.delServidor && /orden_v_cajas_meses|does not exist|schema cache|42P01|PGRST205/i.test(e.message || '')) return { filas: [], falta: true };
    throw e;
  });
}

/* "Todo controlado y ok", o qué faltó o sobró y qué día (como la planilla). */
var MEDIOS_CAJA = [['desvio_mp', 'Mercado Pago'], ['desvio_tarjeta', 'tarjeta'], ['desvio_gocuotas', 'Go Cuotas'], ['desvio_efectivo', 'efectivo']];
function textoCierre(cajas, tot) {
  var partes = [];
  cajas.forEach(function (c) {
    MEDIOS_CAJA.forEach(function (md) {
      var v = Number(c[md[0]] || 0);
      if (Math.abs(v) > 0.5) partes.push((v > 0 ? 'faltaron ' : 'sobraron ') + pesos(Math.abs(v)) + ' en ' + md[1] + ' el ' + diaMes(c.fecha));
    });
  });
  if (partes.length > 8) partes = partes.slice(0, 8).concat(['y ' + (partes.length - 8) + ' diferencias más']);
  var t = partes.length ? 'Todo controlado. ' + partes.join('; ').replace(/^./, function (x) { return x.toUpperCase(); }) + '.' : 'Todo controlado y ok';
  var sin = Number(tot && tot.dias_sin_cargar || 0);
  if (sin) t += (partes.length ? ' ' : '. ') + (sin === 1 ? 'Quedó 1 día' : 'Quedaron ' + sin + ' días') + ' sin cargar.';
  return t;
}

/* La tarjeta del cierre, arriba de los días: en curso, falta cerrar, controlado o reabierto. */
function tarjetaCierre(cierre, tot, terminado, falta115, pasoElMes) {
  if (falta115) return '<div class="nota">Para dar el mes por controlado falta correr el SQL 115 en Supabase.</div>';
  if (!tot) return '';
  var h = (cierre && cierre.historia) || [], ult = h[h.length - 1], cab, txt, botones = '';
  if (cierre && cierre.estado === 'controlado') {
    cab = '<span class="est listo">Controlado ✓</span>';
    txt = '<p class="cierre-obs">' + esc(cierre.observacion) + '</p>' +
      '<p class="cierre-quien">Lo cerró ' + esc(cierre.controlado_por_nombre || 'Administración') + ' el ' + esc(diaMes(cierre.controlado_en)) + ' a las ' + esc(hora(cierre.controlado_en)) + '. Los montos de esos días quedan trabados.</p>';
    if (esAdmin()) botones = '<button class="boton chico" id="cajaReabrir">Reabrir el mes</button>';
  } else if (!terminado) {
    cab = '<span class="est">En curso</span>';
    txt = pasoElMes
      ? '<p class="cierre-quien">Todavía se puede cargar la caja del último día: se cierra cuando abra el local.</p>'
      : '<p class="cierre-quien">Se da por controlado cuando termine el mes, desde el 1/' + Number(mesSiguiente(_mes).slice(5)) + '.</p>';
  } else {
    cab = '<span class="est sorpresa">Falta cerrar</span>';
    txt = cierre && cierre.estado === 'reabierto' && ult
      ? '<p class="cierre-quien">Lo reabrió ' + esc(ult.por || 'Administración') + ' el ' + esc(diaMes(ult.en)) + ': ' + esc(ult.texto) + '</p>'
      : '<p class="cierre-quien">Revisá los totales y los días con diferencias, y dalo por controlado.</p>';
    if (esAdmin()) botones = '<button class="boton lima chico" id="cajaCerrar">Dar el mes por controlado</button>';
    else txt += '<p class="cierre-quien">Lo cierra Administración.</p>';
  }
  if (h.length > 1) botones += '<button class="boton chico" id="cajaHistoria">Ver la historia</button>';
  return '<div class="cierre-mes"><div class="cierre-cab"><b>Cierre de ' + esc(nombreMes(_mes).toLowerCase()) + '</b>' + cab + '</div>' + txt +
    (botones ? '<div class="botones">' + botones + '</div>' : '') + '</div>';
}

function resumenMedios(tot) {
  return '<div class="cierre-medios">' + [['Mercado Pago', 'sis_mp', 'real_mp', 'desvio_mp'], ['Tarjeta', 'sis_tarjeta', 'real_lote', 'desvio_tarjeta'],
    ['Go Cuotas', 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas'], ['Efectivo', 'sis_efectivo', 'real_efectivo', 'desvio_efectivo']].map(function (x) {
    var d = Number(tot[x[3]] || 0);
    return '<div><b>' + x[0] + '</b><span>Cierre ' + pesos(tot[x[1]]) + ' · real ' + pesos(tot[x[2]]) + '</span><span class="' + (Math.abs(d) > 0.5 ? 'rojo' : '') + '">Desvío ' + pesos(d) + '</span></div>';
  }).join('') + '</div>';
}

/* "Dar el mes por controlado": la observación ya escrita, para corregir si hace falta. */
function cerrarMesCaja(cajas, tot) {
  var avisos = [];
  var n = function (x, uno, varios) { x = Number(x || 0); return x + ' ' + (x === 1 ? uno : varios); };
  if (tot.dias_sin_cargar) avisos.push(n(tot.dias_sin_cargar, 'día quedó sin cargar', 'días quedaron sin cargar') + ': se puede cerrar igual y la observación lo dice (si después aparece, se reabre el mes).');
  if (tot.dias_sin_controlar) avisos.push(n(tot.dias_sin_controlar, 'día no lo marcó como controlado', 'días no los marcó como controlados') + ' el encargado.');
  if (tot.dias_con_alertas) avisos.push(n(tot.dias_con_alertas, 'día tiene alertas', 'días tienen alertas') + ': tocalos en la tabla para ver qué pasó.');
  var f = ventana('<h1>Dar ' + esc(nombreMes(_mes).toLowerCase()) + ' por controlado</h1>' +
    '<p class="bajada">' + esc(_local.nombre) + '. Queda anotado a tu nombre, y los montos de esos días quedan trabados (si hace falta corregir algo, se reabre).</p>' +
    resumenMedios(tot) +
    (avisos.length ? '<div class="nota alerta">' + avisos.map(esc).join('<br>') + '</div>' : '') +
    '<label class="campo"><span>Observación</span><textarea id="cmObs" rows="3" maxlength="600">' + esc(textoCierre(cajas, tot)) + '</textarea></label>' +
    '<button class="boton lima" id="cmGuardar">Dar por controlado</button>');
  unaVez(f.querySelector('#cmGuardar'), function () {
    var obs = f.querySelector('#cmObs').value.trim();
    if (!obs) { avisar('Escribí la observación (por ejemplo: "Todo controlado y ok").'); return; }
    return llamar('orden_caja_mes_cerrar', { p_local: _local.id, p_mes: _mes, p_observacion: obs })
      .then(function () { f.remove(); avisar(nombreMes(_mes) + ' quedó controlado.'); verCajas(); }, function (e) {
        /* Ya estaba cerrado (otro lo cerró, o se cortó la respuesta y se reintentó): la pantalla se pone al día. */
        if (e && e.delServidor && /ya estaba cerrado/i.test(e.message || '')) { f.remove(); avisar(nombreMes(_mes) + ' ya estaba controlado.'); verCajas(); return; }
        throw e;
      });
  });
}

function reabrirMesCaja() {
  var f = ventana('<h1>Reabrir ' + esc(nombreMes(_mes).toLowerCase()) + '</h1>' +
    '<p class="bajada">' + esc(_local.nombre) + '. Los montos de esos días se pueden volver a cambiar hasta que lo des por controlado otra vez. Queda anotado quién lo reabrió y por qué.</p>' +
    '<label class="campo"><span>¿Por qué se reabre?</span><textarea id="rmMot" rows="2" maxlength="600"></textarea></label>' +
    '<button class="boton lima" id="rmGuardar">Reabrir el mes</button>');
  unaVez(f.querySelector('#rmGuardar'), function () {
    var mot = f.querySelector('#rmMot').value.trim();
    if (!mot) { avisar('Contá por qué se reabre.'); return; }
    return llamar('orden_caja_mes_reabrir', { p_local: _local.id, p_mes: _mes, p_motivo: mot })
      .then(function () { f.remove(); avisar(nombreMes(_mes) + ' quedó abierto otra vez.'); verCajas(); }, function (e) {
        if (e && e.delServidor && /no está cerrado/i.test(e.message || '')) { f.remove(); avisar(nombreMes(_mes) + ' ya estaba abierto.'); verCajas(); return; }
        throw e;
      });
  });
}

function historiaMesCaja(cierre) {
  ventana('<h1>Historia de ' + esc(nombreMes(_mes).toLowerCase()) + '</h1><p class="bajada">' + esc(_local.nombre) + '</p>' +
    '<div class="cierre-historia">' + (cierre.historia || []).slice().reverse().map(function (x) {
      return '<div><b>' + (x.que === 'reabierto' ? 'Reabierto' : 'Controlado') + '</b><span>' + esc((x.por || 'Administración') + ' · ' + diaMes(x.en) + ' ' + hora(x.en)) + '</span><p>' + esc(x.texto || '') + '</p></div>';
    }).join('') + '</div>');
}

/* ── El período de Cajas (interfaz común): un mes, con su cierre y su resumen, o cualquier rango
   (una semana, los últimos 30 días…), con sus días y los totales de esos días. ── */
var _cajasRango = null;   // null: un mes (_mes); si no, el rango elegido { desde, hasta, atajo, unidad, texto }
function finDeMes(m) { var d = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(); return m + '-' + (d < 10 ? '0' : '') + d; }
function periodoCajasHTML() { return '<div class="cajas-per" id="cajasPer"></div>'; }
var ATAJOS_CAJAS = ['mes', 'mes-pasado', 'semana', 'semana-pasada', 'hoy', 'ayer', '30', '3m'];
function armarPeriodoCajas() {
  var host = document.getElementById('cajasPer');
  if (!host || !window.Interfaz) return;
  guardarPeriodo('nc_eq_cajas_periodo', _cajasRango || (_mes === mesesCajas()[0] ? { atajo: 'mes' } : { desde: _mes + '-01', hasta: finDeMes(_mes), unidad: 'mes' }));
  Interfaz.periodo(host, {
    inicial: _cajasRango ? (_cajasRango.atajo || { desde: _cajasRango.desde, hasta: _cajasRango.hasta }) : { desde: _mes + '-01', hasta: finDeMes(_mes) },
    atajos: ATAJOS_CAJAS,
    alCambiar: function (r) {
      if (r.unidad === 'mes') { _mes = r.desde.slice(0, 7); _cajasRango = null; } else _cajasRango = r;
      verCajas();
    }
  });
}
/* El período se recuerda en esta compu (lo marcó el árbitro: los demás lugares ya lo hacían). No va con la opción
   guardar del selector: ésa gana sobre "inicial", y el mes también cambia desde el resumen por mes. Se guarda como lo
   guarda el selector, y al entrar se lee con uno suelto (que vuelve a calcular los atajos: "Este mes" sigue siéndolo). */
function guardarPeriodo(clave, r) {
  try { localStorage.setItem(clave, JSON.stringify(r.atajo ? { atajo: r.atajo } : { desde: r.desde, hasta: r.hasta, unidad: r.unidad })); } catch (e) {}
}
function leerPeriodo(clave, atajos, op) {
  if (!window.Interfaz) return null;
  try { if (!localStorage.getItem(clave)) return null; } catch (e) { return null; }
  return Interfaz.periodo(document.createElement('div'), Object.assign({ guardar: clave, atajos: atajos }, op || {})).rango();
}
var _cajasPerLeido = false;
function leerPeriodoCajas() {
  if (_cajasPerLeido) return;
  _cajasPerLeido = true;
  var r = leerPeriodo('nc_eq_cajas_periodo', ATAJOS_CAJAS);
  if (!r) return;
  if (r.unidad === 'mes') { _mes = r.desde.slice(0, 7); _cajasRango = null; } else _cajasRango = r;
}
/** Todas las filas de una lectura, de a 1000 (el tope de la API de Supabase). Con los 14 locales, un rango largo pasa
    ese número y sin esto los totales saldrían cortos sin avisar (lo marcó el árbitro). La ruta lleva su order=. */
function leerTodas(ruta, desde) {
  var N = 1000;
  desde = desde || 0;
  return leer(ruta + '&limit=' + N + '&offset=' + desde).then(function (f) {
    f = f || [];
    return f.length < N ? f : leerTodas(ruta, desde + N).then(function (resto) { return f.concat(resto); });
  });
}

/* Cada medio, un bloque (14/10, Mauricio: "segmentame bien eso"): su color suave y una línea que lo separa. */
function colCaja(c, s, rl, dv, g) {
  return celdaCaja(c, s, rl, 'g-' + g + ' ini') + celdaCaja(c, rl, s, 'g-' + g) + '<td class="n g-' + g + (Math.abs(Number(c[dv] || 0)) > 0.5 ? ' rojo' : '') + '">' + pesos(c[dv]) + '</td>';
}
function colsCaja(c, efvo) {
  return colCaja(c, 'sis_mp', 'real_mp', 'desvio_mp', 'mp') + colCaja(c, 'sis_tarjeta', 'real_lote', 'desvio_tarjeta', 'tarjeta') +
         colCaja(c, 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas', 'gocuotas') + colCaja(c, efvo, 'real_efectivo', 'desvio_efectivo', 'efectivo');
}
/** La tabla de los días (como la planilla) con la fila del total. */
function tablaDiasCaja(cajas, tot) {
  return '<div class="desliza"><table class="tabla-datos tabla-cajas"><thead><tr><th rowspan="2">Día</th>' +
    GRUPOS_CAJA.map(function (m) { return '<th colspan="3" class="grupo g-' + m[0] + ' ini">' + m[1] + '</th>'; }).join('') + '<th rowspan="2" class="ini">Estado</th></tr>' +
    '<tr>' + GRUPOS_CAJA.map(function (m) { return '<th class="n g-' + m[0] + ' ini">Cierre</th><th class="n g-' + m[0] + '">Real</th><th class="n g-' + m[0] + '">Desvío</th>'; }).join('') + '</tr></thead><tbody>' +
    cajas.map(function (c) {
      return '<tr data-caja="' + esc(c.id) + '" style="cursor:pointer"><td><b>' + esc(diaMes(c.fecha)) + '</b></td>' + colsCaja(c, 'sis_saldo_final_efvo') +
        '<td class="ini">' + (c.estado === 'controlada' ? '<span class="est listo">Controlada</span>' : c.estado === 'cargada' ? '<span class="est sorpresa">Sin controlar</span>' : '<span class="est pendiente">Sin cargar</span>') +
        ((c.alertas || []).length ? ' <span class="est vencido">' + c.alertas.length + '</span>' : '') +
        (c.diferencia_persona ? ' <span class="est vencido" title="' + esc('Diferencia a cargo de ' + (c.diferencia_persona_nombre || '—') + ': ' + pesos(c.diferencia_monto)) + '">A cargo</span>' : '') + '</td></tr>';
    }).join('') +
    (tot ? '<tr class="fila-total"><td><b>Total</b></td>' + colsCaja(tot, 'sis_efectivo') + '<td class="ini"></td></tr>' : '') +
    '</tbody></table></div><p class="bajada" style="margin-top:8px">Desvío = lo que dice el cierre − lo real (positivo: falta plata). Tocá un día para ver las fotos o corregir los números.</p>';
}
/** (SQL 124) Las diferencias que no tuvieron arreglo: a cargo de quién, en el período. */
function aCargoCajaHTML(cajas, cuando) {
  var aCargo = {};
  cajas.forEach(function (x) {
    if (!x.diferencia_persona || !(Number(x.diferencia_monto) > 0)) return;
    var k = x.diferencia_persona_nombre || '—', a = aCargo[k] = aCargo[k] || { total: 0, dias: [] };
    a.total += Number(x.diferencia_monto); a.dias.push(diaMes(x.fecha) + ' (' + pesos(x.diferencia_monto) + ')');
  });
  if (!Object.keys(aCargo).length) return '';
  return '<h3 class="cierre-titulo">Diferencias a cargo en ' + esc(cuando) + '</h3><div class="desliza"><table class="tabla-datos a-cargo"><thead><tr><th>Persona</th><th class="n">Total</th><th>Días</th></tr></thead><tbody>' +
    Object.keys(aCargo).sort().map(function (k) { return '<tr><td><b>' + esc(k) + '</b></td><td class="n rojo">' + pesos(aCargo[k].total) + '</td><td>' + esc(aCargo[k].dias.join(' · ')) + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="bajada" style="margin-top:8px">Las anota el supervisor al dar la caja por controlada, cuando la diferencia no tuvo arreglo.</p>';
}
/** Los totales de unos días (para un rango que no es un mes): lo mismo que da la base para el mes. */
function totalCajas(cajas) {
  var t = { dias_sin_cargar: 0, dias_sin_controlar: 0, dias_con_alertas: 0 };
  ['sis_mp', 'real_mp', 'desvio_mp', 'sis_tarjeta', 'real_lote', 'desvio_tarjeta', 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas', 'real_efectivo', 'desvio_efectivo'].forEach(function (k) {
    var hay = cajas.filter(function (c) { return c[k] != null; });
    t[k] = hay.length ? hay.reduce(function (a, c) { return a + Number(c[k]); }, 0) : null;
  });
  var se = cajas.filter(function (c) { return c.sis_saldo_final_efvo != null; });
  t.sis_efectivo = se.length ? se.reduce(function (a, c) { return a + Number(c.sis_saldo_final_efvo); }, 0) : null;
  cajas.forEach(function (c) {
    if (c.estado === 'pendiente') t.dias_sin_cargar++;
    if (c.estado === 'cargada') t.dias_sin_controlar++;
    if ((c.alertas || []).length) t.dias_con_alertas++;
  });
  return t;
}
function engancharDiasCaja(c, cajas) {
  var porId = {};
  cajas.forEach(function (x) { porId[x.id] = x; });
  c.querySelectorAll('[data-caja]').forEach(function (tr) { tr.onclick = function () { ventanaCaja(porId[tr.dataset.caja]); }; });
}

function verCajas() {
  var meses = mesesCajas(), hoyMes = meses[0];
  leerPeriodoCajas();
  if (!_mes) _mes = hoyMes;
  /* Con "Todos los locales", el local de arriba no corresponde: se esconde. */
  var sel = document.getElementById('selLocal');
  if (sel) sel.style.display = _cajasTodos && _locales.length > 1 ? 'none' : '';
  if (_cajasTodos && _locales.length > 1) { verCajasTodos(meses); return; }
  if (_cajasRango) { verCajasRango(); return; }
  var L = valor(_local.id);
  /* El mes elegido puede ser más viejo que los 6 del resumen: se pide también. */
  var mesesQ = meses.indexOf(_mes) < 0 ? meses.concat([_mes]) : meses;
  Promise.all([
    leer('/orden_v_cajas?select=*&local_id=eq.' + L + '&mes=eq.' + _mes + '&order=fecha.asc'),
    leer('/orden_v_cajas_mes?select=*&local_id=eq.' + L + '&mes=in.(' + mesesQ.join(',') + ')'),
    leer('/orden_config?select=caja_activa&local_id=eq.' + L),
    leerCierres('/orden_v_cajas_meses?select=*&local_id=eq.' + L + '&mes=in.(' + mesesQ.join(',') + ')'),
    /* El mes del día de caja: el día 1 antes de que abra el local, todavía es el anterior. */
    llamar('orden_caja_mes_actual', { p_local: _local.id }).catch(function () { return null; })
  ]).then(function (r) {
    if (_solapa !== 'cajas' || _cajasTodos || _cajasRango) return;
    var cajas = r[0] || [], porMes = {}, activa = !!(r[2] && r[2][0] && r[2][0].caja_activa), cierres = {};
    (r[1] || []).forEach(function (x) { porMes[x.mes] = x; });
    r[3].filas.forEach(function (x) { cierres[x.mes] = x; });
    var mesCaja = /^\d{4}-\d{2}$/.test(r[4] || '') ? r[4] : hoyMes;
    var tot = porMes[_mes], cierre = cierres[_mes], terminado = _mes < mesCaja;
    var html = (activa ? '' : '<div class="nota">El control de caja está apagado en este local (se prende en Ajustes → El local).</div>') +
      (_locales.length > 1 ? '<div class="solapas chicas cajas-vista"><button data-vista="local" class="activa">Un local</button><button data-vista="todos">Todos los locales</button></div>' : '') +
      periodoCajasHTML() +
      (tot ? '<div class="numeros"><div class="numero"><span>Días sin cargar</span><b>' + tot.dias_sin_cargar + '</b></div><div class="numero"><span>Sin controlar</span><b>' + tot.dias_sin_controlar + '</b></div><div class="numero"><span>Días con alertas</span><b>' + tot.dias_con_alertas + '</b></div><div class="numero"><span>Desvío del mes (efectivo)</span><b>' + pesos(tot.desvio_efectivo) + '</b></div></div>' : '') +
      tarjetaCierre(cierre, tot, terminado, r[3].falta, _mes < hoyMes);
    if (!cajas.length) html += '<div class="vacio">No hay cajas cargadas en este mes.</div>';
    else html += tablaDiasCaja(cajas, tot) + aCargoCajaHTML(cajas, nombreMes(_mes));
    /* Resumen por mes, como la parte de arriba de la planilla: del más viejo al más nuevo. */
    var conDatos = meses.slice().reverse().filter(function (m) { return porMes[m]; });
    if (conDatos.length) {
      /* Cada medio en una celda: el desvío y, abajo, cierre / real. */
      var medio = function (t, s, rl, dv, g) {
        var d = Number(t[dv] || 0);
        return '<td class="n g-' + g + ' ini"><b class="' + (Math.abs(d) > 0.5 ? 'rojo' : '') + '">' + pesos(d) + '</b><small>' + pesos(t[s]) + ' / ' + pesos(t[rl]) + '</small></td>';
      };
      html += '<h3 class="cierre-titulo">Resumen por mes</h3><div class="desliza"><table class="tabla-datos cajas-meses tabla-cajas"><thead><tr><th>Mes</th>' +
        GRUPOS_CAJA.map(function (m) { return '<th class="n grupo g-' + m[0] + ' ini">' + m[1] + '<small>desvío · cierre / real</small></th>'; }).join('') +
        '<th class="ini">Cierre</th><th>Observación</th></tr></thead><tbody>' +
        conDatos.map(function (m) {
          var t = porMes[m], ci = cierres[m], h = (ci && ci.historia) || [], ult = h[h.length - 1];
          var est = ci && ci.estado === 'controlado' ? '<span class="est listo">Controlado ✓</span><small>' + esc(ci.controlado_por_nombre || '') + (ci.controlado_en ? ' · ' + esc(diaMes(ci.controlado_en)) : '') + '</small>'
            : m < mesCaja ? '<span class="est sorpresa">Falta cerrar</span>' : '<span class="est">En curso</span>';
          var obs = ci && ci.estado === 'controlado' ? esc(ci.observacion) : ci && ci.estado === 'reabierto' && ult ? 'Reabierto: ' + esc(ult.texto) : '—';
          return '<tr data-ir-mes="' + m + '" class="' + (m === _mes ? 'mes-activo' : '') + '" style="cursor:pointer"><td><b>' + esc(nombreMes(m)) + '</b></td>' +
            medio(t, 'sis_mp', 'real_mp', 'desvio_mp', 'mp') + medio(t, 'sis_tarjeta', 'real_lote', 'desvio_tarjeta', 'tarjeta') + medio(t, 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas', 'gocuotas') + medio(t, 'sis_efectivo', 'real_efectivo', 'desvio_efectivo', 'efectivo') +
            '<td class="cierre-est ini">' + est + '</td><td class="obs">' + obs + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="bajada" style="margin-top:8px">Los últimos 6 meses con cajas. Tocá un mes para ver sus días.</p>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    armarPeriodoCajas();
    c.querySelectorAll('[data-ir-mes]').forEach(function (tr) { tr.onclick = function () { _mes = tr.dataset.irMes; _cajasRango = null; verCajas(); try { window.scrollTo(0, 0); } catch (e) {} }; });
    c.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { _cajasTodos = b.dataset.vista === 'todos'; verCajas(); }; });
    var bc = document.getElementById('cajaCerrar'), br = document.getElementById('cajaReabrir'), bh = document.getElementById('cajaHistoria');
    if (bc) bc.onclick = function () { cerrarMesCaja(cajas, tot); };
    if (br) br.onclick = reabrirMesCaja;
    if (bh) bh.onclick = function () { historiaMesCaja(cierre); };
    engancharDiasCaja(c, cajas);
  }).catch(function (e) { error(e, verCajas); });
}

/* Un rango que no es un mes (una semana, los últimos 30 días…): los días y sus totales. El cierre es por mes. */
function verCajasRango() {
  var L = valor(_local.id), rg = _cajasRango;
  Promise.all([
    leerTodas('/orden_v_cajas?select=*&local_id=eq.' + L + '&fecha=gte.' + rg.desde + '&fecha=lte.' + rg.hasta + '&order=fecha.asc,id.asc'),
    leer('/orden_config?select=caja_activa&local_id=eq.' + L)
  ]).then(function (r) {
    if (_solapa !== 'cajas' || _cajasTodos || _cajasRango !== rg) return;
    var cajas = r[0] || [], activa = !!(r[1] && r[1][0] && r[1][0].caja_activa), tot = totalCajas(cajas);
    var html = (activa ? '' : '<div class="nota">El control de caja está apagado en este local (se prende en Ajustes → El local).</div>') +
      (_locales.length > 1 ? '<div class="solapas chicas cajas-vista"><button data-vista="local" class="activa">Un local</button><button data-vista="todos">Todos los locales</button></div>' : '') +
      periodoCajasHTML() +
      '<div class="numeros"><div class="numero"><span>Días sin cargar</span><b>' + tot.dias_sin_cargar + '</b></div><div class="numero"><span>Sin controlar</span><b>' + tot.dias_sin_controlar + '</b></div>' +
        '<div class="numero"><span>Días con alertas</span><b>' + tot.dias_con_alertas + '</b></div><div class="numero"><span>Desvío (efectivo)</span><b>' + pesos(tot.desvio_efectivo) + '</b></div></div>' +
      '<p class="bajada">El cierre se da por mes: para darlo por controlado, elegí un mes.</p>' +
      (cajas.length ? tablaDiasCaja(cajas, tot) + aCargoCajaHTML(cajas, rg.texto.toLowerCase()) : '<div class="vacio">No hay cajas cargadas en este período.</div>');
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    armarPeriodoCajas();
    c.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { _cajasTodos = b.dataset.vista === 'todos'; verCajas(); }; });
    engancharDiasCaja(c, cajas);
  }).catch(function (e) { error(e, verCajas); });
}

/* ── Un día de caja: los números y las fotos del cierre grandes (14/10, pedido de Mauricio:
   "que me deje verlo, como cuando manda lo de los módulos"). Debajo de cada foto, lo que
   leyó la IA y, en rojo, si no coincide con lo que cargaron. Si la IA no la pudo leer,
   "Leer de nuevo" (sin que el vendedor la saque otra vez). */
var FOTOS_CIERRE = [
  ['sistema', 'Cierre del sistema', [['ventas_tarjeta', 'Tarjeta', 'sis_tarjeta'], ['ventas_mercado_pago', 'Mercado Pago', 'sis_mp'], ['ventas_debito_go', 'Go Cuotas', 'sis_gocuotas'],
    ['ventas_efectivo', 'Ventas en efectivo', null], ['ventas_totales', 'Ventas totales', null], ['saldo_final_efectivo', 'Saldo final en efectivo', 'sis_saldo_final_efvo'],
    ['total_efectivo', 'Total efectivo (lo contado)', 'real_efectivo']]],
  ['lote', 'Cierre de lote (posnet)', [['total', 'Total', 'real_lote']]],
  ['mp', 'Mercado Pago', [['total', 'Total', 'real_mp']]],
  ['gocuotas', 'Go Cuotas', [['total', 'Total', 'real_gocuotas']]]
];
/** Los medios de la caja, cada uno con su color (en la tabla y en el resumen por mes). */
var GRUPOS_CAJA = [['mp', 'Mercado Pago'], ['tarjeta', 'Tarjeta'], ['gocuotas', 'Go Cuotas'], ['efectivo', 'Efectivo']];

/** Un número de la caja; vacío con el otro lado escrito: "Falta" (falta cargarlo, SQL 122). */
function celdaCaja(c, k, otro, clase) {
  var cl = 'n' + (clase ? ' ' + clase : '');
  if (c[k] == null && c[otro] != null && Number(c[otro]) !== 0) return '<td class="' + cl + '"><span class="falta-cargar">Falta</span></td>';
  return '<td class="' + cl + '">' + pesos(c[k]) + '</td>';
}

/** El texto de una alerta de caja. */
function textoAlertaCaja(a) {
  if (a.tipo === 'desvio') return 'Diferencia en ' + a.campo + ': ' + pesos(a.monto);
  if (a.tipo === 'falta') return 'Falta cargar ' + a.campo + (a.falta === 'sistema' ? ' (lo que dice el sistema)' : '') + (a.motivo ? ': la foto no se lee. ' + a.motivo : '');
  if (a.tipo === 'no_coincide_foto') return 'Un monto no coincide con la foto (' + a.campo + ')';
  return 'Foto de otro día (' + a.foto + ')';
}

var FILAS_DIA_CAJA = [['Mercado Pago', 'sis_mp', 'real_mp', 'desvio_mp'], ['Tarjeta', 'sis_tarjeta', 'real_lote', 'desvio_tarjeta'],
                      ['Go Cuotas', 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas'], ['Efectivo', 'sis_saldo_final_efvo', 'real_efectivo', 'desvio_efectivo']];

function ventanaCaja(k) {
  /* Cómo quedó la lectura de cada foto; sin señal, igual se ven las fotos (sin la lectura).
     Y qué números puso la IA (SQL 122; sin ese SQL, no se marca nada). */
  Promise.all([
    leer('/orden_caja_fotos?select=id,tipo,foto_path,ia_estado,ia_resultado,tomada_en&caja_id=eq.' + valor(k.id) + '&borrada_en=is.null&order=tomada_en.desc')
      .catch(function () { return null; }),
    leer('/orden_cajas?select=ia_campos&id=eq.' + valor(k.id)).catch(function () { return null; })
  ]).then(function (r) { dibujarVentanaCaja(k, r[0], ((r[1] || [])[0] || {}).ia_campos || []); });
}

function dibujarVentanaCaja(k, fs, deIA) {
  deIA = deIA || [];
  var ultima = {};
  if (fs) fs.forEach(function (f) { if (!ultima[f.tipo]) ultima[f.tipo] = f; });
  else Object.keys(k.fotos || {}).forEach(function (t) { ultima[t] = { tipo: t, foto_path: k.fotos[t] }; });
  var hay = FOTOS_CIERRE.filter(function (t) { return ultima[t[0]]; });
  var v = ventana('<h1>Caja del ' + esc(diaMes(k.fecha)) + '</h1><p class="bajada">' + esc((k.local_nombre ? k.local_nombre : '') + (k.cargada_por_nombre ? ' · la cargó ' + k.cargada_por_nombre : '') + (k.controlada_por_nombre ? ' · la controló ' + k.controlada_por_nombre : '')) + '</p>' +
    ((k.alertas || []).length ? '<div class="nota alerta">' + k.alertas.map(function (a) { return esc(textoAlertaCaja(a)); }).join('<br>') + '</div>' : '') +
    (k.observaciones ? '<div class="nota">' + esc(k.observaciones) + '</div>' : '') + (k.nota_control ? '<div class="nota">Control: ' + esc(k.nota_control) + '</div>' : '') +
    (k.diferencia_persona ? '<div class="nota alerta"><b>Diferencia a cargo de ' + esc(k.diferencia_persona_nombre || '—') + ': ' + pesos(k.diferencia_monto) + '</b></div>' : '') +
    /* (SQL 142) Editar cualquier número a mano, por si la IA no leyó algo o leyó mal (19/10, Mauricio:
       "está bueno que se pueda editar cualquier dato. Que aparezca editar y listo"). */
    (soloMira() ? '' : '<div class="caja-dia-acc"><button class="boton chico" id="cajaEditar">Editar</button>' +
      '<button class="boton chico lima" id="cajaListo" data-aviso-guardar disabled hidden>Listo</button>' +
      '<button class="boton chico" id="cajaCancelar" hidden>Cancelar</button></div>') +
    '<div class="desliza"><table class="caja-dia"><thead><tr><th></th><th class="n">Cierre</th><th class="n">Real</th><th class="n">Desvío</th></tr></thead><tbody id="cajaDiaCuerpo">' +
    filasDiaCaja(k, deIA, false) + '</tbody></table></div>' +
    (deIA.length ? '<p class="bajada-chica">Los números con <span class="de-ia">IA</span> los cargó la IA desde las fotos: corroboralos con las fotos de abajo.</p>' : '') +
    controlCajaHTML(k) +
    (hay.length ? '<div class="seccion">Fotos del cierre</div><div class="fotos-cierre">' + hay.map(function (t) {
      var f = ultima[t[0]];
      /* El nombre arriba, la foto y, debajo, lo que leyó la IA (al bajar no se mezcla con la siguiente). */
      return '<figure class="foto-chica foto-cierre" data-tipo="' + t[0] + '"><figcaption><b>' + esc(t[1]) + '</b>' + (f.tomada_en ? ' · ' + esc(hora(f.tomada_en)) : '') + '</figcaption>' +
        '<img data-foto="' + esc(f.foto_path) + '" alt="' + esc(t[1]) + '">' + lecturaCierre(t, f, k) + '</figure>';
    }).join('') + '</div>' : '<div class="vacio">Sin fotos guardadas.</div>'));
  engancharReleer(v, k);
  engancharEdicionCaja(v, k, deIA);
  engancharControlCaja(v, k);
}

/* Dar la caja por controlada desde la compu, igual que en la app (21/10, Mauricio: "no me deja poner como
   controlada el cierre de caja… en la app está todo, tendría que ser lo mismo desde el sistema"). La misma función
   de la base (orden_caja_controlar, SQL 124): con alertas, "qué pasó" es obligatorio y, si la diferencia no tuvo
   arreglo, quién se hace cargo y cuánto. Quién puede lo decide la base (el administrador y los supervisores del local). */
function controlCajaHTML(k) {
  if (k.estado !== 'cargada' || soloMira()) return '';
  var alertas = (k.alertas || []).length;
  return '<div class="caja-control" id="cajaControl"><div class="seccion">Dar por controlada</div>' +
    '<label class="campo"><span>' + (alertas ? 'Qué pasó (obligatorio: tiene alertas)' : 'Nota (opcional)') + '</span><textarea id="notaCaja" rows="2" maxlength="600"></textarea></label>' +
    (alertas ? '<div class="renglon"><label class="campo c-grande"><span>Si la diferencia no tiene arreglo, ¿quién se hace cargo?</span>' +
        '<select id="aCargo"><option value="">Nadie: se resolvió o no corresponde</option></select></label>' +
      '<label class="campo c-medio" id="montoCargoCampo" hidden><span>Monto a su cargo</span><input id="montoCargo" inputmode="decimal" autocomplete="off" placeholder="$"></label></div>' : '') +
    '<button class="boton lima" id="cajaControlar">Dar por controlada</button></div>';
}

function engancharControlCaja(v, k) {
  var b = v.querySelector('#cajaControlar');
  if (!b) return;
  var sel = v.querySelector('#aCargo'), montoCampo = v.querySelector('#montoCargoCampo'), monto = v.querySelector('#montoCargo');
  /* Lo que falta de plata: la suma de los desvíos positivos (el sistema dice más de lo que hay). */
  var faltaPlata = (k.alertas || []).reduce(function (s, a) { return s + (a.tipo === 'desvio' && Number(a.monto) > 0 ? Number(a.monto) : 0); }, 0);
  if (sel) {
    if (faltaPlata > 0) monto.value = String(Math.round(faltaPlata));
    sel.onchange = function () { montoCampo.hidden = !sel.value; };
    /* La gente del local; de entrada, quien la cargó (si falta plata). */
    leer('/orden_personas?select=id,nombre,inicial&local_id=eq.' + valor(k.local_id) + '&activo=is.true&order=nombre.asc').then(function (gente) {
      (gente || []).forEach(function (p) {
        var o = document.createElement('option'); o.value = p.id; o.textContent = nombreVendedor(p); sel.appendChild(o);
      });
      if (faltaPlata > 0 && k.cargada_por && (gente || []).some(function (p) { return p.id === k.cargada_por; })) { sel.value = k.cargada_por; montoCampo.hidden = false; }
    }).catch(function () {});
  }
  unaVez(b, function () {
    var nota = v.querySelector('#notaCaja').value.trim();
    if ((k.alertas || []).length && !nota) { v.querySelector('#notaCaja').focus(); avisar('Tiene alertas: escribí qué pasó.'); return; }
    var persona = sel ? sel.value : '', m = null;
    if (persona) {
      m = numeroCaja(monto.value);
      if (!(m > 0)) { monto.focus(); avisar('Escribí cuánto queda a su cargo.'); return; }
      if (!confirm('La diferencia de ' + pesos(m) + ' queda a cargo de ' + sel.selectedOptions[0].textContent + '. ¿Confirmás?')) return;
    }
    b.textContent = 'Guardando…';
    var args = { p_caja: k.id, p_nota: nota || null };
    if (persona) { args.p_persona = persona; args.p_monto = m; }
    return llamar('orden_caja_controlar', args).then(function () { v.remove(); avisar('Caja controlada.'); verCajas(); });
  });
}

/** Los 4 renglones de la caja del día; editando, cada monto es un casillero para escribir. */
function filasDiaCaja(k, deIA, editando) {
  var monto = function (campo) { return pesos(k[campo]) + (deIA.indexOf(campo) > -1 && k[campo] != null ? ' <span class="de-ia" title="Lo cargó la IA desde la foto">IA</span>' : ''); };
  return FILAS_DIA_CAJA.map(function (f) {
    var d = Number(k[f[3]] || 0);
    var lado = function (a, b) {
      if (editando) return '<input class="monto-caja" data-campo="' + a + '" inputmode="decimal" autocomplete="off" value="' + (k[a] == null ? '' : esc(String(Number(k[a])))) + '">';
      return k[a] == null && k[b] != null && Number(k[b]) !== 0 ? '<span class="falta-cargar">Falta</span>' : monto(a);
    };
    return '<tr><td>' + f[0] + '</td><td class="n">' + lado(f[1], f[2]) + '</td><td class="n">' + lado(f[2], f[1]) + '</td><td class="n' + (Math.abs(d) > 0.5 ? ' rojo' : '') + '">' + pesos(d) + '</td></tr>';
  }).join('');
}

/** "$ 1.440.100,50", "95.000", "95000" o "1440100.5" → número; vacío o raro → null (el mismo de la app). */
function numeroCaja(v) {
  var t = String(v == null ? '' : v).replace(/[\s$]/g, '');
  if (!t || !/\d/.test(t) || /[^0-9.,-]/.test(t)) return null;
  var coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma > -1 && punto > -1) t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');   // 1.440.100,50 o 1,440,100.50
  else if (coma > -1) t = t.replace(',', '.');                                                                    // 95,5
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');                                             // 95.000
  var n = Number(t);
  return isFinite(n) ? n : null;
}

/** Qué cambió en los casilleros contra lo que tenía la caja (vacío = borrar ese dato). */
function cambiosCajaDia(cuerpo, k) {
  var valores = {}, malo = null;
  cuerpo.querySelectorAll('[data-campo]').forEach(function (i) {
    var t = String(i.value || '').trim(), antes = k[i.dataset.campo] == null ? null : Number(k[i.dataset.campo]);
    if (t === '') { if (antes != null) valores[i.dataset.campo] = null; return; }
    var n = numeroCaja(t);
    if (n == null) { malo = malo || i; return; }
    if (n !== antes) valores[i.dataset.campo] = String(n);
  });
  return { valores: valores, malo: malo };
}

/* (SQL 142) "Editar": los montos pasan a casilleros y "Listo" guarda SÓLO lo que cambió, con
   orden_caja_guardar (el mismo de la app: queda el historial, las alertas se recalculan y lo
   escrito deja de ser "de la IA"). Con el mes cerrado o sin permiso, la base frena y acá se
   muestra el motivo. Lo que no se toca no se manda: no pierde su marca IA. */
function engancharEdicionCaja(v, k, deIA) {
  var be = v.querySelector('#cajaEditar');
  if (!be) return;
  var bl = v.querySelector('#cajaListo'), bc = v.querySelector('#cajaCancelar'), cuerpo = v.querySelector('#cajaDiaCuerpo');
  var ctl = v.querySelector('#cajaControl');
  var modo = function (editando) {
    cuerpo.innerHTML = filasDiaCaja(k, deIA, editando);
    be.hidden = editando; bl.hidden = !editando; bc.hidden = !editando;
    if (ctl) ctl.hidden = editando;      /* no se controla un número a medio corregir */
    bl.disabled = true;
    if (editando) { var p = cuerpo.querySelector('[data-campo]'); if (p) p.focus(); }
  };
  cuerpo.addEventListener('input', function () {
    var c = cambiosCajaDia(cuerpo, k);
    bl.disabled = !c.malo && !Object.keys(c.valores).length;
  });
  be.onclick = function () { modo(true); };
  bc.onclick = function () { modo(false); };
  unaVez(bl, function () {
    var c = cambiosCajaDia(cuerpo, k);
    if (c.malo) { c.malo.focus(); avisar('Hay un monto que no se entiende: escribilo sólo con números.'); return; }
    if (!Object.keys(c.valores).length) { modo(false); return 'dejar-apagado'; }
    bl.textContent = 'Guardando…';
    return llamar('orden_caja_guardar', { p_caja: k.id, p_valores: c.valores, p_observaciones: null }).then(function (fila) {
      if (fila) Object.keys(fila).forEach(function (x) { k[x] = fila[x]; });
      v.remove();
      avisar('Guardado.');
      ventanaCaja(k);      /* la ventana de nuevo, con los desvíos y la marca IA al día */
      verCajas();          /* y la tabla de atrás */
    });
  });
}

/** Lo que leyó la IA de una foto del cierre, comparado con lo que cargaron. */
function lecturaCierre(t, f, k) {
  if (!f.ia_estado) return '';
  var r = f.ia_resultado || {};
  if (f.ia_estado === 'invalida') return '<div class="lectura-ia"><span class="rojo">La IA no la pudo leer: ' + esc(r.motivo || 'no es la pantalla pedida o no se ven los números') + '.</span></div>';
  if (f.ia_estado !== 'ok') {
    return '<div class="lectura-ia">' + (f.ia_estado === 'pendiente' ? 'Todavía no se leyó.' : 'La IA no la pudo leer.') +
      (soloMira() ? '' : ' <button class="boton chico" data-releer="' + esc(f.id) + '">Leer de nuevo</button>') + '</div>';
  }
  var renglones = t[2].filter(function (c) { return r[c[0]] != null || (c[2] && k[c[2]] != null && (c[0] in r || c[0] !== 'total_efectivo')); }).map(function (c) {
    var leido = r[c[0]], cargado = c[2] ? k[c[2]] : null;
    /* Rojo sólo si la IA leyó un número y lo cargado es otro (o no cargaron nada). */
    var distinto = !!c[2] && leido != null && (cargado == null || Math.abs(Number(leido) - Number(cargado)) > 0.5);
    return '<li>' + esc(c[1]) + ': <b>' + (leido == null ? 'no se leyó' : esc(pesos(leido))) + '</b>' +
      (distinto ? ' <span class="rojo">· cargaron ' + esc(pesos(cargado)) + '</span>' : '') + '</li>';
  });
  var otroDia = r.fecha && r.fecha !== String(k.fecha).slice(0, 10);
  return '<div class="lectura-ia">La IA leyó:' + (renglones.length ? '<ul>' + renglones.join('') + '</ul>' : ' ningún monto.') +
    (otroDia ? '<div class="rojo">La foto dice ' + esc(diaMes(r.fecha)) + ': parece de otro día.</div>' : '') +
    ((r.dudas || []).length ? '<div>No se leían bien: ' + esc(r.dudas.join(', ')) + '</div>' : '') + '</div>';
}

function engancharReleer(v, k) {
  v.querySelectorAll('[data-releer]').forEach(function (b) {
    unaVez(b, function () {
      b.textContent = 'Leyendo…';
      return llamarFuncion('leer-caja', { foto_id: b.dataset.releer }).then(function (d) {
        if (!d._ok || !d.ok || !d.lectura) { avisar(d.mensaje || d.error || 'No se pudo leer la foto. Probá más tarde.'); return; }
        var fig = b.closest('.foto-cierre'), t = FOTOS_CIERRE.filter(function (x) { return x[0] === fig.dataset.tipo; })[0];
        var div = document.createElement('div');
        div.innerHTML = lecturaCierre(t, { id: b.dataset.releer, ia_estado: d.lectura.foto_valida === false ? 'invalida' : 'ok', ia_resultado: d.lectura }, k);
        fig.querySelector('.lectura-ia').replaceWith(div.firstChild);
        avisar(d.lectura.foto_valida === false ? 'La IA dice que esa foto no se lee.' : 'Listo: la IA leyó la foto.');
      });
    });
  });
}

/* Todos los locales en un mes: los desvíos y si está cerrado. Tocar uno abre sus días. */
function verCajasTodos(meses) {
  if (_cajasRango) { verCajasTodosRango(); return; }
  var hoyMes = meses[0];
  Promise.all([
    leer('/orden_v_cajas_mes?select=*&mes=eq.' + _mes),
    leerCierres('/orden_v_cajas_meses?select=*&mes=eq.' + _mes),
    /* El mes del día de caja de cada local (el día 1 antes de que abra, el mes pasado sigue en curso). */
    Promise.all(_locales.map(function (l) { return llamar('orden_caja_mes_actual', { p_local: l.id }).catch(function () { return null; }); }))
  ]).then(function (r) {
    if (_solapa !== 'cajas' || !_cajasTodos || _cajasRango) return;
    var porLocal = {}, cierres = {}, mesCaja = {};
    (r[0] || []).forEach(function (x) { porLocal[x.local_id] = x; });
    r[1].filas.forEach(function (x) { cierres[x.local_id] = x; });
    _locales.forEach(function (l, i) { mesCaja[l.id] = /^\d{4}-\d{2}$/.test(r[2][i] || '') ? r[2][i] : hoyMes; });
    var terminoEn = function (l) { return _mes < mesCaja[l.id]; };
    var conCajas = _locales.filter(function (l) { return porLocal[l.id]; });
    var terminado = conCajas.some(terminoEn);
    var falta = conCajas.filter(function (l) { return terminoEn(l) && !(cierres[l.id] && cierres[l.id].estado === 'controlado'); }).length;
    var efvo = conCajas.reduce(function (a, l) { return a + Number(porLocal[l.id].desvio_efectivo || 0); }, 0);
    var celda = function (t, k) { var d = Number(t[k] || 0); return '<td class="n' + (Math.abs(d) > 0.5 ? ' rojo' : '') + '">' + pesos(d) + '</td>'; };
    var html = '<div class="solapas chicas cajas-vista"><button data-vista="local">Un local</button><button data-vista="todos" class="activa">Todos los locales</button></div>' +
      periodoCajasHTML() +
      (r[1].falta ? '<div class="nota">Para dar los meses por controlados falta correr el SQL 115 en Supabase.</div>' : '') +
      '<div class="numeros"><div class="numero"><span>Locales con cajas</span><b>' + conCajas.length + '</b></div>' +
        '<div class="numero"><span>' + (terminado ? 'Falta cerrar' : 'El mes sigue en curso') + '</span><b>' + (terminado ? falta : '—') + '</b></div>' +
        '<div class="numero"><span>Desvío del mes (efectivo, todos)</span><b>' + pesos(efvo) + '</b></div></div>';
    if (!conCajas.length) html += '<div class="vacio">Ningún local tiene cajas en este mes.</div>';
    else {
      html += '<div class="desliza"><table class="tabla-datos"><thead><tr><th>Local</th><th class="n">Mercado Pago</th><th class="n">Tarjeta</th><th class="n">Go Cuotas</th><th class="n">Efectivo</th>' +
        '<th class="n">Sin cargar</th><th class="n">Sin controlar</th><th>Cierre del mes</th></tr></thead><tbody>' +
        conCajas.map(function (l) {
          var t = porLocal[l.id], ci = cierres[l.id];
          var est = ci && ci.estado === 'controlado' ? '<span class="est listo">Controlado ✓</span>' : terminoEn(l) ? '<span class="est sorpresa">Falta cerrar</span>' : '<span class="est">En curso</span>';
          return '<tr data-ir="' + esc(l.id) + '" style="cursor:pointer"><td><b>' + esc(l.nombre) + '</b></td>' + celda(t, 'desvio_mp') + celda(t, 'desvio_tarjeta') + celda(t, 'desvio_gocuotas') + celda(t, 'desvio_efectivo') +
            '<td class="n">' + Number(t.dias_sin_cargar || 0) + '</td><td class="n">' + Number(t.dias_sin_controlar || 0) + '</td><td>' + est + '</td></tr>';
        }).join('') +
        '</tbody></table></div><p class="bajada" style="margin-top:8px">Los desvíos del mes (cierre − real; positivo: falta plata). Tocá un local para ver sus días y darlo por controlado.</p>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    armarPeriodoCajas();
    c.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { _cajasTodos = b.dataset.vista === 'todos'; verCajas(); }; });
    c.querySelectorAll('[data-ir]').forEach(function (tr) { tr.onclick = function () { _cajasTodos = false; elegirLocal(tr.dataset.ir); ir('cajas'); }; });
  }).catch(function (e) { error(e, verCajas); });
}

/* Todos los locales en un rango que no es un mes: los desvíos de esos días, por local. */
function verCajasTodosRango() {
  var rg = _cajasRango, K = ['desvio_mp', 'desvio_tarjeta', 'desvio_gocuotas', 'desvio_efectivo'];
  leerTodas('/orden_v_cajas?select=local_id,estado,' + K.join(',') + '&fecha=gte.' + rg.desde + '&fecha=lte.' + rg.hasta + '&order=fecha.asc,id.asc').then(function (filas) {
    if (_solapa !== 'cajas' || !_cajasTodos || _cajasRango !== rg) return;
    var porLocal = {};
    (filas || []).forEach(function (x) {
      var t = porLocal[x.local_id] = porLocal[x.local_id] || { desvio_mp: 0, desvio_tarjeta: 0, desvio_gocuotas: 0, desvio_efectivo: 0, dias_sin_cargar: 0, dias_sin_controlar: 0 };
      K.forEach(function (k) { t[k] += Number(x[k] || 0); });
      if (x.estado === 'pendiente') t.dias_sin_cargar++;
      if (x.estado === 'cargada') t.dias_sin_controlar++;
    });
    var conCajas = _locales.filter(function (l) { return porLocal[l.id]; });
    var efvo = conCajas.reduce(function (a, l) { return a + porLocal[l.id].desvio_efectivo; }, 0);
    var celda = function (t, k) { var d = Number(t[k] || 0); return '<td class="n' + (Math.abs(d) > 0.5 ? ' rojo' : '') + '">' + pesos(d) + '</td>'; };
    var html = '<div class="solapas chicas cajas-vista"><button data-vista="local">Un local</button><button data-vista="todos" class="activa">Todos los locales</button></div>' +
      periodoCajasHTML() +
      '<div class="numeros"><div class="numero"><span>Locales con cajas</span><b>' + conCajas.length + '</b></div>' +
        '<div class="numero"><span>Desvío (efectivo, todos)</span><b>' + pesos(efvo) + '</b></div></div>' +
      '<p class="bajada">El cierre se da por mes: para ver cuáles faltan cerrar, elegí un mes.</p>';
    if (!conCajas.length) html += '<div class="vacio">Ningún local tiene cajas en este período.</div>';
    else {
      html += '<div class="desliza"><table class="tabla-datos"><thead><tr><th>Local</th><th class="n">Mercado Pago</th><th class="n">Tarjeta</th><th class="n">Go Cuotas</th><th class="n">Efectivo</th>' +
        '<th class="n">Sin cargar</th><th class="n">Sin controlar</th></tr></thead><tbody>' +
        conCajas.map(function (l) {
          var t = porLocal[l.id];
          return '<tr data-ir="' + esc(l.id) + '" style="cursor:pointer"><td><b>' + esc(l.nombre) + '</b></td>' + celda(t, 'desvio_mp') + celda(t, 'desvio_tarjeta') + celda(t, 'desvio_gocuotas') + celda(t, 'desvio_efectivo') +
            '<td class="n">' + t.dias_sin_cargar + '</td><td class="n">' + t.dias_sin_controlar + '</td></tr>';
        }).join('') +
        '</tbody></table></div><p class="bajada" style="margin-top:8px">Los desvíos de esos días (cierre − real; positivo: falta plata). Tocá un local para ver sus días.</p>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    armarPeriodoCajas();
    c.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { _cajasTodos = b.dataset.vista === 'todos'; verCajas(); }; });
    c.querySelectorAll('[data-ir]').forEach(function (tr) { tr.onclick = function () { _cajasTodos = false; elegirLocal(tr.dataset.ir); ir('cajas'); }; });
  }).catch(function (e) { error(e, verCajas); });
}

/* ════════════════════════════════════════════════════════════════════════
   EDITOR DE FILAS (lo usan los productos testigo y los ajustes)
   ════════════════════════════════════════════════════════════════════════ */

function valorCampo(col, fila) {
  var v = fila[col.k];
  if (col.tipo === 'hora') return v ? String(v).slice(0, 5) : '';
  /* mostrar: cómo se muestra lo guardado (la semana del frontal: la próxima que le toca). */
  return col.mostrar ? col.mostrar(v, fila) : v;
}

function campoHTML(col, fila, soloLectura) {
  var v = valorCampo(col, fila);
  var dis = soloLectura || col.fijo ? ' disabled' : '';
  var clase = 'campo ' + (col.ancho ? 'c-' + col.ancho : col.tipo === 'bool' ? 'c-bool' : 'c-medio');
  if (col.tipo === 'ver') return '<div class="' + clase + '"><span>' + esc(col.t) + '</span><b>' + esc(col.ver ? col.ver(fila) : v) + '</b></div>';
  if (col.tipo === 'bool') return '<label class="' + clase + '"><input type="checkbox" data-k="' + col.k + '"' + (v ? ' checked' : '') + dis + '> ' + esc(col.t) + '</label>';
  if (col.tipo === 'area') return '<label class="' + clase + '"><span>' + esc(col.t) + '</span><textarea data-k="' + col.k + '" rows="1" maxlength="400"' + dis + '>' + esc(v == null ? '' : v) + '</textarea></label>';
  if (col.tipo === 'dias') {
    var arr = (v || []).map(Number);
    return '<div class="campo"><span>' + esc(col.t) + '</span><div class="dias" data-k="' + col.k + '">' + DIAS.map(function (d, i) {
      return '<label class="' + (arr.indexOf(i + 1) > -1 ? 'si' : '') + '" title="' + DIAS_LARGO[i] + '"><input type="checkbox" value="' + (i + 1) + '"' + (arr.indexOf(i + 1) > -1 ? ' checked' : '') + dis + '>' + d + '</label>';
    }).join('') + '</div></div>';
  }
  if (col.tipo === 'sel') {
    return '<label class="' + clase + '"><span>' + esc(col.t) + '</span><select data-k="' + col.k + '"' + dis + '>' + col.ops.map(function (o) {
      return '<option value="' + esc(o[0] == null ? '' : o[0]) + '"' + (String(o[0] == null ? '' : o[0]) === String(v == null ? '' : v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select></label>';
  }
  var tipo = col.tipo === 'num' ? 'number' : col.tipo === 'hora' ? 'time' : col.tipo === 'color' ? 'color' : 'text';
  return '<label class="' + clase + '"><span>' + esc(col.t) + '</span><input type="' + tipo + '" data-k="' + col.k + '" value="' + esc(v == null ? '' : v) + '"' +
         (col.tipo === 'num' ? ' inputmode="numeric" step="any"' : '') + dis + '></label>';
}

/** Las opciones de una lista, con la elegida. */
function opcionesHTML(col, v) {
  return col.ops.map(function (o) {
    return '<option value="' + esc(o[0] == null ? '' : o[0]) + '"' + (String(o[0] == null ? '' : o[0]) === String(v == null ? '' : v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('');
}

/** Un campo adentro de una frase ("vence a las [21:00]"): sin título arriba; el título queda para el lector de pantalla. */
function campoFrase(col, fila, soloLectura) {
  var v = valorCampo(col, fila), dis = soloLectura || col.fijo ? ' disabled' : '', tit = ' aria-label="' + esc(col.t) + '" title="' + esc(col.t) + '"';
  if (col.tipo === 'bool') return '<label class="frase-si"><input type="checkbox" data-k="' + col.k + '"' + (v ? ' checked' : '') + dis + '><span>' + esc(col.t) + '</span></label>';
  if (col.tipo === 'dias') {
    var arr = (v || []).map(Number);
    return '<span class="dias en-frase" data-k="' + col.k + '" role="group"' + tit + '>' + DIAS.map(function (d, i) {
      return '<label class="' + (arr.indexOf(i + 1) > -1 ? 'si' : '') + '" title="' + DIAS_LARGO[i] + '"><input type="checkbox" value="' + (i + 1) + '"' + (arr.indexOf(i + 1) > -1 ? ' checked' : '') + dis + '>' + d + '</label>';
    }).join('') + '</span>';
  }
  if (col.tipo === 'sel') return '<select class="en-frase" data-k="' + col.k + '"' + tit + dis + '>' + opcionesHTML(col, v) + '</select>';
  var tipo = col.tipo === 'num' ? 'number' : col.tipo === 'hora' ? 'time' : 'text';
  return '<input class="en-frase' + (col.tipo === 'num' ? ' num' : col.tipo === 'hora' ? ' hora' : '') + '" type="' + tipo + '" data-k="' + col.k + '" value="' + esc(v == null ? '' : v) + '"' +
    (col.tipo === 'num' ? ' inputmode="numeric" step="1"' + (col.min != null ? ' min="' + col.min + '"' : '') + (col.max != null ? ' max="' + col.max + '"' : '') : '') + tit + dis + '>';
}

/** Un texto largo crece con lo que tiene (una regla de dos renglones se ve entera). */
function autoAlto(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

function leerCampo(col, renglon) {
  if (col.tipo === 'dias') {
    return [].map.call(renglon.querySelectorAll('.dias[data-k="' + col.k + '"] input:checked'), function (i) { return +i.value; }).sort();
  }
  var el = renglon.querySelector('[data-k="' + col.k + '"]');
  if (!el) return undefined;
  if (col.tipo === 'bool') return el.checked;
  var v = String(el.value);
  if (col.tipo === 'num') return v === '' ? null : Number(v);
  if (col.tipo === 'sel') return v === '' ? null : (col.numero ? Number(v) : col.booleano ? v === 'true' : v);
  if (col.tipo === 'texto' || col.tipo === 'area' || col.tipo === 'hora' || col.tipo === 'color') { v = v.trim(); return v === '' && col.nulo ? null : v; }
  return v;
}

/** El valor de un campo llevado a una sola forma, para comparar el de la base con el de la pantalla. */
function normalizar(col, v) {
  if (col.tipo === 'bool' || col.booleano) return !!v && v !== 'false';
  if (col.tipo === 'dias') return (v || []).map(Number).sort();
  if (v == null || v === '') return col.tipo === 'num' || col.tipo === 'sel' || col.nulo ? null : '';
  if (col.tipo === 'num' || (col.tipo === 'sel' && col.numero)) return Number(v);
  if (col.tipo === 'hora') return String(v).slice(0, 5);
  return String(v);
}

/** 22/10: lo que no hace nada con otra opción apagada (col.si: hace falta prendida; col.siNo: hace falta apagada) se ve
    en gris y no se toca. Si está en la misma frase que la opción, sólo el campo; si no, la frase entera. Puede depender
    de las dos (24/10: las tareas de la IA, con la IA prendida y sin el modo práctica); porqueNo es el motivo del siNo. */
function pintarDepende(cols, r, sl) {
  var de = function (k) { return k ? cols.filter(function (c) { return c.k === k; })[0] : null; };
  cols.forEach(function (col) {
    var a = de(col.si), b = de(col.siNo);
    var el = (a || b) && r.querySelector('[data-k="' + col.k + '"]');
    if (!el) return;
    var va = a ? leerCampo(a, r) : true, vb = b ? leerCampo(b, r) : false;
    var andaA = va != null && va !== false && va !== '', andaB = !vb;
    var anda = andaA && andaB, por = !andaA ? a : b;
    if (!sl) el.disabled = !anda;
    el.title = !anda ? (!andaA ? col.porque : col.porqueNo || col.porque) || 'Depende de ' + (por.corto || por.t) + '.' : col.tipo === 'bool' ? '' : col.t;
    var fr = el.closest('.frase');
    var suyas = fr && ((a && fr.querySelector('[data-k="' + a.k + '"]')) || (b && fr.querySelector('[data-k="' + b.k + '"]')));
    if (fr && !suyas) fr.classList.toggle('apagada', !anda);
    else el.classList.toggle('apagado', !anda);
  });
}

/**
 * cfg: { cont, filas, cols, guardar(fila, cambios) → promesa, extra(fila) → html, accion(fila, nombre, boton) → promesa,
 *        armar(campo, fila) → html: en vez de los campos en fila, frases con cada campo adentro (campo(k) lo dibuja) }
 */
function editor(cfg) {
  var sl = soloMira();
  cfg.cont.innerHTML = cfg.filas.map(function (f, i) {
    var cuerpo = cfg.armar
      ? cfg.armar(function (k) { return campoFrase(cfg.cols.filter(function (c) { return c.k === k; })[0], f, sl); }, f)
      : cfg.cols.map(function (c) { return campoHTML(c, f, sl); }).join('');
    return '<div class="renglon' + (cfg.armar ? ' frases' : '') + '" data-i="' + i + '">' + cuerpo +
      (sl ? '' : '<div class="acciones-renglon">' + (cfg.extra ? cfg.extra(f) : '') + '<button class="boton chico lima" data-guardar disabled>Guardar</button></div>') + '</div>';
  }).join('') || '<div class="vacio">' + esc(cfg.vacio || 'Todavía no hay nada cargado.') + '</div>';
  cfg.cont.querySelectorAll('textarea[data-k]').forEach(function (t) { autoAlto(t); t.addEventListener('input', function () { autoAlto(t); }); });
  cfg.cont.querySelectorAll('.renglon').forEach(function (r) { pintarDepende(cfg.cols, r, sl); });
  if (sl) return;
  cfg.cont.querySelectorAll('.renglon').forEach(function (r) {
    var fila = cfg.filas[+r.dataset.i];
    var g = r.querySelector('[data-guardar]');
    var cambios = function () {
      var c = {};
      cfg.cols.forEach(function (col) {
        if (col.tipo === 'ver' || col.fijo) return;
        var nuevo = leerCampo(col, r);
        if (nuevo === undefined) return;
        if (JSON.stringify(normalizar(col, nuevo)) !== JSON.stringify(normalizar(col, valorCampo(col, fila)))) c[col.k] = nuevo;
      });
      return c;
    };
    var marcar = function () { g.disabled = !Object.keys(cambios()).length; };
    r.addEventListener('input', marcar);
    r.addEventListener('change', function (e) {
      if (e.target.closest('.dias')) e.target.parentNode.classList.toggle('si', e.target.checked);
      pintarDepende(cfg.cols, r, sl);
      marcar();
    });
    unaVez(g, function () {
      var c = cambios();
      if (!Object.keys(c).length) return 'dejar-apagado';
      /* Un número con mínimo vacío o más chico, o una hora vacía, no llegan a la base. */
      var falla = cfg.cols.filter(function (col) {
        return col.k in c && ((col.tipo === 'num' && ((col.min != null && (c[col.k] == null || c[col.k] < col.min)) || (col.max != null && c[col.k] > col.max))) || (col.tipo === 'hora' && !c[col.k]));
      })[0];
      if (falla) {
        avisar(falla.tipo === 'hora' ? 'Falta la hora: «' + falla.t + '».' : falla.max != null ? '«' + falla.t + '» tiene que ser de ' + (falla.min || 0) + ' a ' + falla.max + '.' : '«' + falla.t + '» tiene que ser ' + falla.min + ' o más.');
        return;
      }
      g.textContent = 'Guardando…';
      return cfg.guardar(fila, c).then(function () {
        Object.keys(c).forEach(function (k) { fila[k] = c[k]; });
        avisar('Guardado.');
        return 'dejar-apagado';
      });
    });
    r.querySelectorAll('[data-accion]').forEach(function (b) {
      unaVez(b, function () { return cfg.accion(fila, b.dataset.accion, b); });
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUCTOS TESTIGO (SQL 102): se programa acá; lo cargan los locales en la app
   ════════════════════════════════════════════════════════════════════════ */

/* _testigoRango: el período de las estadísticas (interfaz común); null = "Este mes". */
var _semanaTestigo = null, _testigoVista = 'semana', _testigoRango = null, _testigoLocal = '';
/* Arriba de Productos testigo: "Por semana" o "Estadísticas". */
function vistaTestigoHTML() {
  return '<div class="solapas chicas testigo-vista"><button data-tvista="semana" class="' + (_testigoVista === 'semana' ? 'activa' : '') + '">Por semana</button>' +
    '<button data-tvista="stats" class="' + (_testigoVista === 'stats' ? 'activa' : '') + '">Estadísticas</button></div>';
}
function enganchaVistaTestigo(c) {
  c.querySelectorAll('[data-tvista]').forEach(function (b) { b.onclick = function () { _testigoVista = b.dataset.tvista; verTestigo(); }; });
}

function verTestigo() {
  /* En las estadísticas el local se elige abajo (también "Todos"): el de arriba se esconde. */
  var sel = document.getElementById('selLocal');
  if (sel) sel.style.display = _testigoVista === 'stats' ? 'none' : '';
  if (_testigoVista === 'stats') { verTestigoStats(); return; }
  _semanaTestigo = _semanaTestigo || lunesAR();
  var L = valor(_local.id), c = document.getElementById('cuerpo'), hoy = hoyAR(), pedido = ++_pedidoTestigo;
  /* Sólo dibuja si sigue siendo lo último que se pidió (y en "Por semana"): una respuesta lenta no pisa las estadísticas. */
  var vale = function () { return pedido === _pedidoTestigo && _solapa === 'testigo' && _testigoVista === 'semana'; };
  Promise.all([
    leer('/testigo_semanas?select=*&local_id=eq.' + L + '&semana=eq.' + _semanaTestigo),
    /* Cómo va esa semana en cada local (el supervisor sólo tiene el suyo). */
    _locales.length > 1 ? leer('/testigo_semanas?select=id,local_id,fecha,cargada_en&semana=eq.' + _semanaTestigo) : Promise.resolve([])
  ]).then(function (r) {
    var sem = (r[0] || [])[0], todas = r[1] || [];
    var difs = todas.length ? leer('/testigo_v_items?select=semana_id,diferencia&semana_id=in.(' + todas.map(function (s) { return valor(s.id); }).join(',') + ')') : Promise.resolve([]);
    var items = sem ? leer('/testigo_v_items?select=*&semana_id=eq.' + valor(sem.id) + '&order=item.asc') : Promise.resolve([]);
    var quien = sem && sem.cargada_por ? leer('/orden_personas?select=nombre,inicial&id=eq.' + valor(sem.cargada_por)).catch(function () { return []; }) : Promise.resolve([]);
    return Promise.all([difs, items, quien]).then(function (x) {
      if (!vale()) return;
      dibujarTestigoAdmin(c, sem, todas, x[0] || [], x[1] || [], (x[2] || [])[0], hoy);
    });
  }).catch(function (e) { if (vale()) error(e, verTestigo); });
}

function dibujarTestigoAdmin(c, sem, todas, difs, items, quien, hoy) {
  /* La semana, con el selector de período común (interfaz): ‹ › de a una semana; en el calendario,
     cualquier día lleva a su semana (de lunes a domingo). */
  var html = vistaTestigoHTML() + (soloMira() ? '' : '<div class="imp-mapa-acc"><button class="boton chico lima" id="programar">Programar un control</button></div>') +
    '<div class="testigo-semanas" id="tSemanaPer"></div>' +
    '<p class="bajada">Los locales cargan los números del sistema y la cantidad real, con un video por producto. Diferencia = Stock sistema − Cantidad real (positivo: falta). ' +
    'Desvío = la diferencia sobre la cantidad enviada. Acá se puede corregir cualquier casillero.</p>';

  /* Todos los locales de esa semana, de un vistazo. */
  if (todas.length) {
    var conDif = {};
    difs.forEach(function (d) { if (d.diferencia) conDif[d.semana_id] = (conDif[d.semana_id] || 0) + 1; });
    var nombre = {};
    _locales.forEach(function (l) { nombre[l.id] = l.nombre; });
    html += '<div class="seccion">Esta semana en los locales</div><div class="imp-testigo-locales">' + todas.slice().sort(function (a, b) {
      return String(nombre[a.local_id] || '').localeCompare(String(nombre[b.local_id] || ''));
    }).map(function (s) {
      var estado = s.cargada_en ? 'mandado el ' + diaMes(s.cargada_en) + (conDif[s.id] ? ' · ' + conDif[s.id] + ' con diferencia' : ' · sin diferencias')
        : s.fecha && s.fecha < hoy ? 'sin mandar (venció el ' + diaMes(s.fecha) + ')' : s.fecha ? 'hasta el ' + diaYFecha(s.fecha) : 'sin fecha límite';
      var clase = s.cargada_en ? (conDif[s.id] ? 'mal' : 'bien') : s.fecha && s.fecha < hoy ? 'mal' : '';
      return '<button class="imp-testigo-local ' + clase + (s.local_id === _local.id ? ' actual' : '') + '" data-local="' + esc(s.local_id) + '"><b>' +
        esc(nombre[s.local_id] || 'Otro local') + '</b><small>' + esc(estado) + '</small></button>';
    }).join('') + '</div>';
  }

  html += '<div class="seccion">' + esc(_local.nombre) + '</div>';
  if (!sem) {
    /* Se arma con "Programar un control" (con su fecha límite: si no, el local no lo ve). */
    html += '<div class="vacio">' + esc(_local.nombre) + ' no tiene producto testigo esta semana.' +
      (soloMira() ? '' : ' Para armarlo, tocá "Programar un control".') + '</div>';
  } else {
    html += '<div class="nota">' + (sem.fecha ? 'Fecha límite: ' + esc(diaYFecha(sem.fecha)) + '. ' : '') +
      (sem.cargada_en ? 'Mandado' + (quien ? ' por ' + esc(nombreLista(quien)) : '') + ' el ' + esc(diaMes(sem.cargada_en)) + ' a las ' + esc(hora(sem.cargada_en)) + '.'
                      : 'El local todavía no lo mandó.') + (sem.cerrada ? ' Semana cerrada.' : '') + '</div>' +
      '<div id="itemsTestigo"></div>' +
      (soloMira() || sem.cerrada ? '' : '<div class="imp-mapa-acc"><button class="boton chico" id="agregarItem">Agregar un producto a ' + esc(_local.nombre) + '</button>' +
        /* Borrarlo entero (SQL 155), mientras el local no cargó nada; si ya empezó, se corrige casillero por casillero. */
        (sem.cargada_en || items.some(testigoCargado) ? '' : '<button class="boton chico" id="borrarControl">Borrar el control de ' + esc(_local.nombre) + '</button>') + '</div>');
    var conVideo = items.filter(function (f) { return f.video_path && !f.video_borrado; });
    if (conVideo.length) {
      /* Cómo está cada uno (SQL 157): para mirar, está bien o pedido de nuevo. */
      html += '<div class="seccion">Videos</div><div class="imp-mapa-acc">' + conVideo.map(function (f) {
        var ev = 'video_revisado_en' in f ? estadoVideoTestigo(f) : null;
        return '<button class="boton chico' + (ev === 'para_mirar' && !soloMira() && !sem.cerrada ? ' lima' : '') + '" data-video="' + esc(f.id) + '">▶ ' + esc(f.item + ' · ' + f.producto + (f.color ? ' ' + f.color : '')) +
          (ev ? ' · ' + esc(TEXTO_VIDEO[ev]) : '') + '</button>';
      }).join('') + '</div>';
    }
    var borrados = items.filter(function (f) { return f.video_borrado; }).length;
    if (borrados) html += '<p class="bajada">' + borrados + (borrados === 1 ? ' video ya se borró' : ' videos ya se borraron') + ' (se guardan 14 días; los que dieron diferencia, 90).</p>';
  }
  c.innerHTML = html;

  enganchaVistaTestigo(c);
  var hs = document.getElementById('tSemanaPer');
  if (hs && window.Interfaz) {
    Interfaz.periodo(hs, {
      inicial: { desde: _semanaTestigo, hasta: sumarDias(_semanaTestigo, 6) },
      atajos: ['semana', 'semana-pasada'],
      futuro: true,   // el testigo se programa para las semanas que vienen
      alCambiar: function (r) { _semanaTestigo = Interfaz.fecha.lunes(r.desde); verTestigo(); }
    });
  }
  c.querySelectorAll('[data-local]').forEach(function (b) {
    b.onclick = function () { if (b.dataset.local !== _local.id) { elegirLocal(b.dataset.local); ir('testigo'); } };
  });
  var b = document.getElementById('programar');
  if (b) b.onclick = programarTestigo;
  if (!sem) return;
  editor({
    cont: document.getElementById('itemsTestigo'), filas: items, vacio: 'Todavía no hay productos en esta semana.',
    cols: [{ k: 'item', t: 'Ítem', tipo: 'num', ancho: 'chico' }, { k: 'rubro', t: 'Rubro', tipo: 'texto', nulo: true, ancho: 'medio' },
           { k: 'producto', t: 'Producto', tipo: 'texto', ancho: 'grande' }, { k: 'color', t: 'Color', tipo: 'texto', nulo: true, ancho: 'chico' },
           { k: 'enviada', t: 'Enviada', tipo: 'num', ancho: 'chico' }, { k: 'stock_sistema', t: 'Stock sistema', tipo: 'num', ancho: 'chico' },
           { k: 'cantidad_real', t: 'Cantidad real', tipo: 'num', ancho: 'chico' }, { k: 'dev_fabrica', t: 'Dev. a fábrica', tipo: 'num', ancho: 'chico' },
           { k: 'salieron', t: 'Salieron', tipo: 'num', ancho: 'chico' }, { k: 'entraron', t: 'Entraron', tipo: 'num', ancho: 'chico' },
           { k: 'vendida', t: 'Vendida', tipo: 'num', ancho: 'chico' },
           { k: 'diferencia', t: 'Diferencia', tipo: 'ver', ver: function (f) { return textoDiferencia(f.diferencia) || '—'; } },
           { k: 'desvio', t: 'Desvío', tipo: 'ver', ver: function (f) { return textoDesvio(f.desvio) || '—'; } },
           { k: 'observacion', t: 'Observaciones', tipo: 'texto', nulo: true, ancho: 'grande' }],
    guardar: function (f, cambios) {
      /* Números enteros y no negativos, como en la app; vacío en dev/salieron/entraron es 0.
         El stock del sistema sí puede dar negativo (22/10: avisa que hay un error en el stock). */
      var malo = null;
      ['enviada', 'stock_sistema', 'cantidad_real', 'vendida', 'dev_fabrica', 'salieron', 'entraron'].forEach(function (k) {
        if (!(k in cambios)) return;
        if (cambios[k] == null) { if (['dev_fabrica', 'salieron', 'entraron'].indexOf(k) > -1) cambios[k] = 0; return; }
        if (!(Number.isInteger(cambios[k]) && cambios[k] >= (k === 'stock_sistema' ? -99999 : 0) && cambios[k] <= 99999)) malo = malo || k;
      });
      if (malo) return Promise.reject(rechazo('En "' + ({ enviada: 'Enviada', stock_sistema: 'Stock sistema', cantidad_real: 'Cantidad real', vendida: 'Vendida',
        dev_fabrica: 'Dev. a fábrica', salieron: 'Salieron', entraron: 'Entraron' })[malo] + '" va un número entero' + (malo === 'stock_sistema' ? '.' : ', sin negativos.')));
      return guardarFila('/testigo_items?id=eq.' + valor(f.id), cambios).then(verTestigo);
    }
  });
  c.querySelectorAll('[data-video]').forEach(function (bv) {
    bv.onclick = function () { verVideoTestigo(items.filter(function (f) { return f.id === bv.dataset.video; })[0], sem); };
  });
  var a = document.getElementById('agregarItem');
  if (a) unaVez(a, function () {
    var n = items.reduce(function (m, x) { return Math.max(m, x.item); }, 0) + 1;
    /* Con fecha límite: como programarlo (si ya lo habían mandado, vuelve a quedar para cargar el nuevo). Una planilla vieja sin fecha, directo. */
    return (sem.fecha ? llamar('testigo_programar', { p_fecha: sem.fecha, p_locales: [_local.id], p_productos: [{ producto: 'Producto ' + n }] })
                      : escribir('/testigo_items', 'POST', { semana_id: sem.id, item: n, producto: 'Producto ' + n }))
      .then(function () { avisar('Agregado "Producto ' + n + '": cambiale el nombre y guardá.'); verTestigo(); });
  });
  var bb = document.getElementById('borrarControl');
  if (bb) unaVez(bb, function () {
    if (!confirm('¿Borrar el producto testigo de ' + _local.nombre + ' de esta semana (' + items.length + (items.length === 1 ? ' producto' : ' productos') +
                 (sem.fecha ? ', fecha límite el ' + diaYFecha(sem.fecha) : '') + ')?\n\nLe desaparece de la app. Para volver a ponerlo, programalo de nuevo.')) return;
    return llamar('testigo_borrar', { p_semana: sem.id }).then(function () {
      avisar('Listo: se borró el control de ' + _local.nombre + '.');
      verTestigo();
    });
  });
}

/** ¿El local ya cargó algo en este producto? Lo mismo que mira testigo_borrar en la base (SQL 155). */
function testigoCargado(f) {
  return f.enviada != null || f.stock_sistema != null || f.cantidad_real != null || f.vendida != null ||
    Number(f.dev_fabrica || 0) !== 0 || Number(f.salieron || 0) !== 0 || Number(f.entraron || 0) !== 0 ||
    !!f.video_path || !!String(f.observacion || '').trim() || !!f.cargado_en;
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUCTOS TESTIGO: ESTADÍSTICAS (SQL 117)
   Qué locales tienen más productos con faltante, en %, por período.
   ════════════════════════════════════════════════════════════════════════ */

/* Los últimos n meses ('AAAA-MM'), del actual para atrás. */
function mesesAtras(n) {
  var a = +hoyAR().slice(0, 4), m = +hoyAR().slice(5, 7), r = [];
  for (var i = 0; i < n; i++) { r.push(a + '-' + (m < 10 ? '0' : '') + m); m--; if (!m) { m = 12; a--; } }
  return r;
}
/* Los meses ('AAAA-MM') que toca un rango de fechas, del más viejo al más nuevo. */
function mesesDeRango(desde, hasta) {
  var r = [], a = +desde.slice(0, 4), m = +desde.slice(5, 7), fa = +hasta.slice(0, 4), fm = +hasta.slice(5, 7);
  while ((a < fa || (a === fa && m <= fm)) && r.length < 120) { r.push(a + '-' + (m < 10 ? '0' : '') + m); m++; if (m > 12) { m = 1; a++; } }
  return r;
}
/* El período de las estadísticas (interfaz común). Es por mes: si eligen otra cosa, cuentan los meses que toca. */
var ATAJOS_TESTIGO = ['mes', 'mes-pasado', '3m', '6m', 'anio'], _testigoPerLeido = false;
function rangoTestigo() {
  /* El que se eligió la última vez en esta compu (como Cajas). */
  if (!_testigoPerLeido) { _testigoPerLeido = true; _testigoRango = leerPeriodo('nc_eq_testigo_periodo', ATAJOS_TESTIGO, { hastaHoy: true }) || _testigoRango; }
  if (_testigoRango) return _testigoRango;
  var m = mesesAtras(1)[0];
  return { desde: m + '-01', hasta: hoyAR(), atajo: 'mes', unidad: 'mes', texto: nombreMes(m) };
}
function sumarTestigo(filas) {
  return filas.reduce(function (a, f) {
    ['controles', 'mandados', 'sin_mandar', 'con_datos', 'productos', 'con_faltante', 'con_sobrante', 'unidades_faltan', 'unidades_sobran'].forEach(function (k) { a[k] += Number(f[k] || 0); });
    return a;
  }, { controles: 0, mandados: 0, sin_mandar: 0, con_datos: 0, productos: 0, con_faltante: 0, con_sobrante: 0, unidades_faltan: 0, unidades_sobran: 0 });
}
/* El % sin redondear (para ordenar) y cómo se muestra: "menos de 1 %" no es 0 %. */
function fraccion(a, b) { return b ? a / b : null; }
function textoPct(fr) { if (fr == null) return '—'; var p = Math.round(100 * fr); return fr > 0 && p === 0 ? '<1%' : p + '%'; }
function claseFaltante(fr) { return fr == null ? '' : fr === 0 ? 'pct-bien' : fr < 0.2 ? 'pct-medio' : 'pct-mal'; }

var _pedidoTestigo = 0;
function verTestigoStats() {
  var c = document.getElementById('cuerpo'), pedido = ++_pedidoTestigo;
  var rg = rangoTestigo(), ult6 = mesesAtras(6);
  var meses = mesesDeRango(rg.desde, rg.hasta), recortado = meses.length > 30;
  if (recortado) meses = meses.slice(-30);   // la base acepta hasta 36 meses en total (con los 6 del mes a mes)
  /* ¿Son meses enteros (hasta hoy)? Si no, se aclara que se cuentan los meses que toca. */
  var enteros = rg.desde.slice(8) === '01' && (rg.hasta === finDeMes(rg.hasta.slice(0, 7)) || rg.hasta === hoyAR());
  var per = [null, rg.texto.charAt(0).toLowerCase() + rg.texto.slice(1)];
  if (_locales.length < 2) _testigoLocal = _local.id;
  var todos = _locales.length > 1 && !_testigoLocal;
  llamar('testigo_estadisticas', { p_meses: ult6, p_periodo: meses, p_local: _testigoLocal || null }).then(function (x) { return x || { meses: [], productos: [] }; }, function (e) {
    /* Sólo "la función no existe" es que falta el SQL 117 (un "permission denied" es otra cosa). */
    if (e && !e.sinSesion && e.delServidor && /PGRST202|could not find the function/i.test(e.message || '')) return { falta: true, meses: [], productos: [] };
    throw e;
  }).then(function (r) {
    /* Sólo la última que se pidió (si cambiaron el período dos veces seguidas). */
    if (pedido !== _pedidoTestigo || _solapa !== 'testigo' || _testigoVista !== 'stats') return;
    var nombre = {}, todosLos = _locales.slice();
    _locales.forEach(function (l) { nombre[l.id] = l.nombre; });
    /* Un local dado de baja que tiene datos también entra (si no, los totales no cierran). */
    (r.meses || []).forEach(function (f) {
      if (!nombre[f.local_id]) { nombre[f.local_id] = (f.local_nombre || 'Otro local') + ' (de baja)'; todosLos.push({ id: f.local_id, nombre: nombre[f.local_id] }); }
    });
    var delLocal = function (f) { return !_testigoLocal || f.local_id === _testigoLocal; };
    var enPer = (r.meses || []).filter(function (f) { return meses.indexOf(f.mes) > -1 && delLocal(f); });
    var tot = sumarTestigo(enPer), ff = fraccion(tot.con_faltante, tot.productos);
    var html = vistaTestigoHTML() +
      '<div class="testigo-filtros"><div class="campo"><span>Período</span><div id="tPer" class="testigo-per"></div></div>' +
      (_locales.length > 1 ? '<label class="campo"><span>Local</span><select class="imp-sel desplegable" id="tLocal"><option value="">Todos los locales</option>' + todosLos.map(function (l) {
        return '<option value="' + esc(l.id) + '"' + (l.id === _testigoLocal ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
      }).join('') + '</select></label>' : '') + '</div>' +
      (!enteros || recortado ? '<p class="bajada-chica">Las estadísticas son por mes: se cuentan ' + (meses.length === 1 ? 'el mes entero de ' + esc(nombreMes(meses[0]).toLowerCase())
        : 'los meses enteros de ' + esc(nombreMes(meses[0]).toLowerCase()) + ' a ' + esc(nombreMes(meses[meses.length - 1]).toLowerCase())) + (recortado ? ' (hasta 30 meses)' : '') + '.</p>' : '');
    if (r.falta) {
      html += '<div class="nota">Para ver las estadísticas falta correr el SQL 117 en Supabase.</div>';
    } else {
      if (!tot.controles) {
        html += '<div class="vacio">No hay controles de producto testigo en ' + esc(per[1].toLowerCase()) + (_testigoLocal ? ' en ' + esc(nombre[_testigoLocal] || 'este local') : '') + '.</div>';
      } else {
        html += '<div class="numeros">' +
          '<div class="numero"><span>Productos contados</span><b>' + tot.productos + '</b><span>en ' + tot.con_datos + (tot.con_datos === 1 ? ' control' : ' controles') + '</span></div>' +
          '<div class="numero"><span>Con faltante</span><b>' + textoPct(ff) + '</b><span>' + tot.con_faltante + ' de ' + tot.productos + (tot.unidades_faltan ? ' · faltaron ' + tot.unidades_faltan + (tot.unidades_faltan === 1 ? ' unidad' : ' unidades') : '') + '</span></div>' +
          '<div class="numero"><span>Con sobrante</span><b>' + textoPct(fraccion(tot.con_sobrante, tot.productos)) + '</b><span>' + tot.con_sobrante + ' de ' + tot.productos + '</span></div>' +
          '<div class="numero"><span>Controles sin mandar</span><b>' + tot.sin_mandar + '</b><span>de ' + tot.controles + ' programados (pasada una semana del día)</span></div></div>';

        /* El ranking: los locales del período, del que más le faltan al que menos (por el % exacto). */
        if (todos) {
          var porLocal = {};
          enPer.forEach(function (f) { (porLocal[f.local_id] = porLocal[f.local_id] || []).push(f); });
          var filas = todosLos.map(function (l) {
            var t = sumarTestigo(porLocal[l.id] || []);
            return { l: l, t: t, fr: fraccion(t.con_faltante, t.productos) };
          }).filter(function (x) { return x.t.controles || _locales.some(function (l) { return l.id === x.l.id; }); })
            .sort(function (a, b) {
              if ((a.fr == null) !== (b.fr == null)) return a.fr == null ? 1 : -1;
              return (b.fr || 0) - (a.fr || 0) || b.t.unidades_faltan - a.t.unidades_faltan || a.l.nombre.localeCompare(b.l.nombre);
            });
          html += '<h3 class="cierre-titulo">Los locales, del que más le faltan al que menos</h3><div class="desliza"><table class="tabla-datos testigo-ranking"><thead><tr>' +
            '<th>Local</th><th>Con faltante</th><th class="n col-sec">Unidades que faltaron</th><th class="n col-sec">Con sobrante</th><th class="n col-sec">Productos</th><th class="n">Controles</th></tr></thead><tbody>' +
            filas.map(function (x) {
              if (!x.t.controles) return '<tr class="sin-datos"><td><b>' + esc(x.l.nombre) + '</b></td><td colspan="5">Sin controles en el período</td></tr>';
              if (!x.t.productos) return '<tr data-tlocal="' + esc(x.l.id) + '" style="cursor:pointer"><td><b>' + esc(x.l.nombre) + '</b></td><td colspan="4">Ningún producto contado todavía</td>' +
                '<td class="n">' + x.t.mandados + ' de ' + x.t.controles + (x.t.sin_mandar ? ' <span class="rojo">(' + x.t.sin_mandar + ' sin mandar)</span>' : '') + '</td></tr>';
              return '<tr data-tlocal="' + esc(x.l.id) + '" style="cursor:pointer"><td><b>' + esc(x.l.nombre) + '</b></td>' +
                '<td><div class="barra-pct ' + claseFaltante(x.fr) + '"><i><s style="width:' + Math.round(100 * (x.fr || 0)) + '%"></s></i><b>' + textoPct(x.fr) + '</b></div></td>' +
                '<td class="n col-sec">' + x.t.unidades_faltan + '</td><td class="n col-sec">' + textoPct(fraccion(x.t.con_sobrante, x.t.productos)) + '</td>' +
                '<td class="n col-sec">' + x.t.productos + '</td><td class="n">' + x.t.mandados + ' de ' + x.t.controles + (x.t.sin_mandar ? ' <span class="rojo">(' + x.t.sin_mandar + ' sin mandar)</span>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div><p class="bajada" style="margin-top:8px">Tocá un local para ver sólo el suyo.</p>';
        }
      }

      /* Mes a mes: el % con faltante de los últimos 6 meses (aunque el período elegido no tenga controles). */
      var ascen = ult6.slice().reverse(), porLM = {};
      (r.meses || []).forEach(function (f) { porLM[f.local_id + '|' + f.mes] = f; });
      var locMes = todosLos.filter(function (l) { return delLocal({ local_id: l.id }) && ascen.some(function (m) { return porLM[l.id + '|' + m]; }); });
      if (locMes.length) {
        var celda = function (fs) {
          var t = sumarTestigo(fs), fr = fraccion(t.con_faltante, t.productos);
          return '<td class="n ' + claseFaltante(fr) + '">' + textoPct(fr) + '</td>';
        };
        html += '<h3 class="cierre-titulo">Mes a mes (% con faltante)</h3><div class="desliza"><table class="tabla-datos testigo-meses"><thead><tr><th>Local</th>' +
          ascen.map(function (m) { return '<th class="n">' + esc(nombreMes(m).replace(/ \d{4}$/, '')) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          locMes.map(function (l) {
            return '<tr><td><b>' + esc(l.nombre) + '</b></td>' + ascen.map(function (m) { return celda(porLM[l.id + '|' + m] ? [porLM[l.id + '|' + m]] : []); }).join('') + '</tr>';
          }).join('') +
          (todos && locMes.length > 1 ? '<tr class="total"><td><b>Todos</b></td>' + ascen.map(function (m) {
            return celda((r.meses || []).filter(function (f) { return f.mes === m; }));
          }).join('') + '</tr>' : '') + '</tbody></table></div>';
      }

      /* Los productos que más faltan en el período (la base ya los manda ordenados, los 10 primeros). */
      if (tot.controles) {
        var top = r.productos || [];
        html += '<h3 class="cierre-titulo">Los productos que más faltan</h3>' + (top.length
          ? '<div class="desliza"><table class="tabla-datos testigo-productos"><thead><tr><th>Producto</th><th class="n">Veces con faltante</th><th class="n">Veces contado</th><th class="n">Unidades que faltaron</th></tr></thead><tbody>' +
            top.map(function (x) {
              return '<tr><td><b>' + esc(x.producto) + '</b>' + (x.color ? ' <span class="bajada-chica">' + esc(x.color) + '</span>' : '') + '</td><td class="n rojo">' + x.con_faltante + '</td><td class="n">' + x.veces + '</td><td class="n">' + x.unidades_faltan + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="vacio">Ningún producto con faltante en ' + esc(per[1].toLowerCase()) + '.</div>');
        html += '<p class="bajada" style="margin-top:8px">Con faltante: el stock del sistema es más de lo que se contó. Cuentan los productos de los controles mandados, con los dos números cargados.</p>';
      }
      if (_testigoLocal && _locales.length > 1) html += '<div class="botones"><button class="boton chico" id="tVerSemanas">Ver las semanas de ' + esc(nombre[_testigoLocal] || 'este local') + '</button></div>';
    }
    c.innerHTML = html;
    enganchaVistaTestigo(c);
    var hp = document.getElementById('tPer'), sl = document.getElementById('tLocal'), vs = document.getElementById('tVerSemanas');
    if (hp && window.Interfaz) {
      Interfaz.periodo(hp, {
        inicial: _testigoRango ? (_testigoRango.atajo || { desde: _testigoRango.desde, hasta: _testigoRango.hasta }) : 'mes',
        atajos: ATAJOS_TESTIGO, hastaHoy: true,
        alCambiar: function (r) { _testigoRango = r; guardarPeriodo('nc_eq_testigo_periodo', r); verTestigoStats(); }
      });
    }
    if (sl) sl.onchange = function () { _testigoLocal = sl.value; verTestigoStats(); };
    c.querySelectorAll('[data-tlocal]').forEach(function (tr) { tr.onclick = function () { _testigoLocal = tr.dataset.tlocal; verTestigoStats(); }; });
    if (vs) vs.onclick = function () {
      /* Un local de baja no está en la lista de arriba: se queda en el actual. */
      if (_locales.some(function (l) { return l.id === _testigoLocal; })) elegirLocal(_testigoLocal);
      _testigoVista = 'semana'; ir('testigo');
    };
  }).catch(function (e) {
    if (pedido !== _pedidoTestigo || _solapa !== 'testigo' || _testigoVista !== 'stats') return;
    if (e && e.sinSesion) { pantallaSinSesion(e.message); return; }
    /* Sin señal: los botones de arriba quedan, con "Probar de nuevo". */
    var m = String(e && e.message || '');
    c.innerHTML = vistaTestigoHTML() + '<div class="nota alerta">' + esc(esDeRed(e) ? 'Sin conexión: no se pudieron traer las estadísticas.'
      : /permission denied/i.test(m) ? 'Tu usuario no tiene acceso a estas estadísticas.'
      : /statement timeout|canceling statement/i.test(m) ? 'Tardó demasiado: probá con un período más corto o con un solo local.'
      : mensajeDe(e)) + '</div><button class="boton chico" id="reintentar">Probar de nuevo</button>';
    enganchaVistaTestigo(c);
    document.getElementById('reintentar').onclick = verTestigoStats;
  });
}

/** El video de un producto, con "Está bien" o "Que lo graben de nuevo" (SQL 157; esto último, sólo el día que lo grabaron). */
function verVideoTestigo(f, sem) {
  if (!f) return;
  var nombre = f.producto + (f.color ? ' ' + f.color : '');
  var ev = 'video_revisado_en' in f ? estadoVideoTestigo(f) : null, puede = !!ev && !soloMira() && !(sem && sem.cerrada);
  var deHoy = videoDeHoy(f), pedir = puede && deHoy && ev !== 'pedido';
  var est = { para_mirar: 'sorpresa', bien: 'listo', pedido: 'corregir', pedido_vencido: 'vencido' };
  var v = ventana('<h1>' + esc(f.item + ' · ' + nombre) + '</h1>' +
    '<p class="bajada">' + esc((f.video_subido_en ? 'Grabado el ' + diaMes(f.video_subido_en) + ' a las ' + hora(f.video_subido_en) + '. ' : '') +
      (f.stock_sistema != null && f.cantidad_real != null ? 'Sistema ' + f.stock_sistema + ', contaron ' + f.cantidad_real + ': ' + textoDiferencia(f.diferencia) + '.' : '')) + '</p>' +
    (ev ? '<p><span class="est ' + est[ev] + '">' + esc(TEXTO_VIDEO[ev]) + '</span></p>' : '') +
    '<video class="imp-video" id="videoTestigo" controls playsinline></video><p class="bajada" id="videoEstado">Cargando el video…</p>' +
    (ev === 'pedido' ? '<div class="nota alerta">Pediste que lo graben de nuevo a las ' + esc(hora(f.video_pedido_en)) + (f.video_pedido_msg ? ': «' + esc(f.video_pedido_msg) + '»' : '') +
                       '. Lo tienen que grabar hoy' + (puede ? '; si ya no hace falta, tocá «Está bien».' : '.') + '</div>'
     : ev === 'pedido_vencido' ? '<div class="nota">Pediste que lo graben de nuevo' + (f.video_pedido_msg ? ' («' + esc(f.video_pedido_msg) + '»)' : '') + ' y ese día no lo grabaron.</div>' : '') +
    (puede ? '<div class="seccion">¿Está bien?</div>' +
      (pedir ? '<label class="campo"><span>Qué tienen que cambiar (si querés que lo graben de nuevo)</span><textarea id="vvMsg" rows="2" maxlength="200" placeholder="Ej.: no se ven las etiquetas, contalas de a una"></textarea></label>' : '') +
      '<div class="vm-usar">' + (ev !== 'bien' ? '<button class="boton lima chico" id="vvBien">Está bien</button> ' : '') +
        (pedir ? '<button class="boton chico" id="vvPedir">Que lo graben de nuevo</button>' : '') + '</div>' +
      (!deHoy && ev !== 'pedido' ? '<p class="ayuda-chica">Lo grabaron el ' + esc(diaMes(f.video_subido_en)) + ': pedir que lo graben de nuevo sólo se puede el mismo día. Ahora habría que volver a contar todo.</p>' : '') : ''));
  urlFirmadaEn(VIDEOS_TESTIGO, f.video_path).then(function (u) {
    var el = v.querySelector('#videoTestigo'), est = v.querySelector('#videoEstado');
    if (!el) return;
    if (u) { el.src = u; est.textContent = ''; } else est.textContent = 'No se pudo abrir el video (puede que ya se haya borrado).';
  });
  var listo = function (texto) { avisar(texto); v.remove(); verTestigo(); return 'dejar-apagado'; };
  var b = v.querySelector('#vvBien'), p = v.querySelector('#vvPedir');
  if (b) unaVez(b, function () {
    return llamar('testigo_video_revisar', { p_item: f.id, p_bien: true }).then(function () { return listo('Listo: el video de ' + nombre + ' está bien.'); });
  });
  if (p) unaVez(p, function () {
    var msg = String(v.querySelector('#vvMsg').value || '').trim();
    return llamar('testigo_video_revisar', { p_item: f.id, p_bien: false, p_mensaje: msg || null }).then(function (r) {
      return listo(r && r.avisados ? 'Listo: le avisamos a ' + _local.nombre + ' que graben de nuevo ' + nombre + '.'
                                   : 'Listo, queda pedido. No encontramos a quién avisarle en ' + _local.nombre + ': decíselo vos.');
    });
  });
}

/* El catálogo (catalogo.js) para programar el testigo: por nombre, su rubro y sus colores ("NE" → "NEGRO"). */
var _catTestigo = null;
function catalogoTestigo() {
  if (_catTestigo) return _catTestigo;
  var porNombre = {}, rubros = {};
  (window.CATALOGO || []).forEach(function (p) {
    var nom = String(p[1] || '').trim(), k = nom.toLowerCase();
    if (!nom) return;
    var x = porNombre[k] = porNombre[k] || { nombre: nom, rubro: p[2] || '', colores: [] };
    if (!x.rubro && p[2]) x.rubro = p[2];
    String(p[4] || '').split('|').forEach(function (c) {
      var cc = c.split(':');
      if (cc[0] && !x.colores.some(function (y) { return y[0] === cc[0]; })) x.colores.push([cc[0], cc[1] || '']);
    });
    if (p[2]) rubros[p[2]] = 1;
  });
  return (_catTestigo = { porNombre: porNombre, rubros: Object.keys(rubros).sort() });
}

/** "Hasta el jueves se controlan estos productos" (SQL 152, planilla de Mauricio: Rubro, Producto, Color, Fecha límite):
    la fecha límite, los locales y los productos. Cada producto va a todos los locales marcados, o se le saca alguno
    (si a un local no le llegó, o le llegó en otro color: otra fila con ese color sólo para ese local). */
function programarTestigo() {
  var cat = catalogoTestigo(), varios = _locales.length > 1, n = 0, hoy = hoyAR();
  var fuera = {};   // por fila: los locales que se le sacaron a ese producto
  var nombre = {};
  _locales.forEach(function (l) { nombre[l.id] = l.nombre; });
  /* El ejemplo, sólo en el primero: en todos parecía que ya estaban cargados. */
  var fila = function (ejemplo) {
    n++;
    fuera[n] = {};
    return '<div class="renglon imp-prod" data-fila="' + n + '">' +
      '<label class="campo c-rubro"><span>Rubro</span><input data-p="rubro" maxlength="40" list="pRubros" autocomplete="off"' + (ejemplo ? ' placeholder="Remeras"' : '') + '></label>' +
      '<label class="campo c-grande"><span>Producto</span><input data-p="producto" maxlength="80" list="pCatalogo" autocomplete="off"' + (ejemplo ? ' placeholder="Por ejemplo: Cactus Over"' : '') + '></label>' +
      '<label class="campo c-chico"><span>Color</span><input data-p="color" maxlength="30" list="pColores' + n + '" autocomplete="off"' + (ejemplo ? ' placeholder="AO"' : '') + '></label>' +
      '<datalist id="pColores' + n + '"></datalist>' +
      (varios ? '<div class="campo imp-prod-loc"><span>Locales</span><button type="button" class="boton chico" data-plocs aria-expanded="false">Todos</button></div>' +
                '<div class="imp-prod-elegir" hidden></div>' : '') +
      '</div>';
  };
  var f = ventana('<h1>Programar un control</h1><p class="bajada">Elegí la fecha límite, los locales y los productos. A los locales les aparece en la app apenas lo programás ' +
      'y lo cuentan cualquier día hasta esa fecha (el día antes y ese día les llega el aviso). No tienen que cargar los productos, sólo los números y el video.</p>' +
    '<div class="renglon"><label class="campo c-medio"><span>Fecha límite</span><input type="date" id="pFecha" min="' + hoy + '" value="' + sumarDias(hoy, 1) + '"></label></div>' +
    '<div class="seccion">Locales</div>' +
    (varios ? '<div class="imp-mapa-acc"><button class="boton chico" id="pTodos">Todos</button><button class="boton chico" id="pNinguno">Ninguno</button></div>' : '') +
    '<div class="imp-locales">' + _locales.map(function (l) {
      return '<label class="imp-check"><input type="checkbox" data-loc="' + esc(l.id) + '" checked> ' + esc(l.nombre) + '</label>';
    }).join('') + '</div>' +
    '<div class="seccion">Productos</div><div id="pProds">' + fila(true) + fila() + fila() + fila() + '</div>' +
    '<datalist id="pRubros">' + cat.rubros.map(function (r) { return '<option value="' + esc(r) + '">'; }).join('') + '</datalist>' +
    '<datalist id="pCatalogo">' + Object.keys(cat.porNombre).sort().map(function (k) {
      var p = cat.porNombre[k];
      return '<option value="' + esc(p.nombre) + '">' + esc(p.rubro) + '</option>';
    }).join('') + '</datalist>' +
    '<button class="boton chico" id="pMas">Agregar otro producto</button>' +
    (varios ? '<p class="bajada">Si a un local no le llegó un producto, o le llegó en otro color: en ese producto tocá «Locales» y sacale ese local. ' +
              'Para el otro color, agregá otra fila con ese color sólo para ese local.</p>' : '') +
    '<button class="boton lima" id="pGuardar">Programar</button>');

  var marcados = function () { return [].filter.call(f.querySelectorAll('[data-loc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.loc; }); };
  var deFila = function (i) { return marcados().filter(function (id) { return !fuera[i][id]; }); };
  /* El botón de cada producto dice a qué locales va: "Todos", "Sin Flores", "Sólo Rivadavia" o "3 locales". */
  var textoLocales = function (i) {
    var m = marcados(), van = deFila(i);
    if (!m.length || !van.length) return 'Ninguno';
    if (van.length === m.length) return 'Todos';
    if (van.length === 1) return 'Sólo ' + nombre[van[0]];
    if (m.length - van.length === 1) return 'Sin ' + nombre[m.filter(function (id) { return fuera[i][id]; })[0]];
    return van.length + ' locales';
  };
  var pintarFila = function (r) {
    var i = +r.dataset.fila, b = r.querySelector('[data-plocs]'), el = r.querySelector('.imp-prod-elegir');
    if (!b) return;
    b.textContent = textoLocales(i);
    b.classList.toggle('cambiado', b.textContent !== 'Todos');
    if (el.hidden) return;
    el.innerHTML = '<div class="imp-prod-cab"><span>¿A qué locales va este producto?</span>' +
      '<button type="button" class="boton chico" data-ptodos>Todos</button><button type="button" class="boton chico" data-pninguno>Ninguno</button></div>' +
      '<div class="imp-locales">' + marcados().map(function (id) {
        return '<label class="imp-check"><input type="checkbox" data-ploc="' + esc(id) + '"' + (fuera[i][id] ? '' : ' checked') + '> ' + esc(nombre[id]) + '</label>';
      }).join('') + '</div>';
  };
  var pintarTodas = function () { f.querySelectorAll('.imp-prod').forEach(pintarFila); };
  /* Con el producto del catálogo: el rubro (si no lo escribieron a mano) y sus colores para elegir. */
  var delCatalogo = function (r) {
    var pi = r.querySelector('[data-p="producto"]'), ri = r.querySelector('[data-p="rubro"]');
    var p = cat.porNombre[pi.value.trim().toLowerCase()];
    r.querySelector('datalist').innerHTML = p ? p.colores.map(function (c) { return '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>'; }).join('') : '';
    if (!p) return;
    if (pi.value !== p.nombre && document.activeElement !== pi) pi.value = p.nombre;
    if (p.rubro && (!ri.value.trim() || ri.dataset.auto === '1')) { ri.value = p.rubro; ri.dataset.auto = '1'; }
  };

  f.querySelector('#pMas').onclick = function () { f.querySelector('#pProds').insertAdjacentHTML('beforeend', fila()); pintarTodas(); };
  var marcar = function (si) { f.querySelectorAll('[data-loc]').forEach(function (x) { x.checked = si; }); pintarTodas(); };
  if (varios) {
    f.querySelector('#pTodos').onclick = function () { marcar(true); };
    f.querySelector('#pNinguno').onclick = function () { marcar(false); };
    f.querySelector('.imp-locales').addEventListener('change', pintarTodas);
  }
  var prods = f.querySelector('#pProds');
  prods.addEventListener('input', function (e) {
    var r = e.target.closest('.imp-prod');
    if (!r) return;
    if (e.target.dataset.p === 'rubro') e.target.dataset.auto = '';
    if (e.target.dataset.p === 'producto') delCatalogo(r);
  });
  prods.addEventListener('change', function (e) {
    var r = e.target.closest('.imp-prod');
    if (!r) return;
    if (e.target.dataset.p === 'producto') delCatalogo(r);
    if (e.target.dataset.ploc) { fuera[+r.dataset.fila][e.target.dataset.ploc] = !e.target.checked; pintarFila(r); }
  });
  prods.addEventListener('click', function (e) {
    var r = e.target.closest('.imp-prod'), i = r && +r.dataset.fila;
    if (!r) return;
    if (e.target.closest('[data-plocs]')) {
      var el = r.querySelector('.imp-prod-elegir');
      el.hidden = !el.hidden;
      e.target.closest('[data-plocs]').setAttribute('aria-expanded', String(!el.hidden));
      pintarFila(r);
    } else if (e.target.closest('[data-ptodos]') || e.target.closest('[data-pninguno]')) {
      var si = !!e.target.closest('[data-ptodos]');
      fuera[i] = {};
      if (!si) marcados().forEach(function (id) { fuera[i][id] = true; });
      pintarFila(r);
    }
  });

  unaVez(f.querySelector('#pGuardar'), function () {
    var fecha = f.querySelector('#pFecha').value;
    var lista = [].map.call(f.querySelectorAll('.imp-prod'), function (r) {
      var v = function (k) { return r.querySelector('[data-p="' + k + '"]').value.trim(); };
      return { rubro: v('rubro'), producto: v('producto'), color: v('color'), locales: deFila(+r.dataset.fila) };
    }).filter(function (p) { return p.producto; });
    var locales = marcados();
    if (!fecha) { avisar('Elegí la fecha límite.'); return; }
    if (fecha < hoy) { avisar('La fecha límite ya pasó: elegí hoy o un día que viene.'); return; }
    if (!lista.length) { avisar('Escribí al menos un producto.'); return; }
    if (!locales.length) { avisar('Marcá al menos un local.'); return; }
    var sinLocal = lista.filter(function (p) { return !p.locales.length; })[0];
    if (sinLocal) { avisar('«' + sinLocal.producto + '» no va a ningún local: tocá «Locales» en ese producto y marcale alguno.'); return; }
    /* Sólo los locales que reciben algún producto. */
    var usados = locales.filter(function (id) { return lista.some(function (p) { return p.locales.indexOf(id) > -1; }); });
    /* Antes de programar, dónde va (21/10: se programó sin querer en los 14 en vez de sólo en Rivadavia). */
    var nombres = usados.map(function (id) { return nombre[id]; });
    var donde = usados.length > 1 && usados.length === _locales.length ? 'en los ' + usados.length + ' locales (todos)'
      : nombres.length > 6 ? 'en ' + nombres.length + ' locales: ' + nombres.slice(0, 5).join(', ') + ' y ' + (nombres.length - 5) + ' más'
      : 'en ' + yLista(nombres);
    if (!confirm('¿Programar ' + lista.length + (lista.length === 1 ? ' producto ' : ' productos ') + donde + ', con fecha límite el ' + diaYFecha(fecha) + '?\n\n' +
                 (usados.length === 1 ? 'Le aparece' : 'A cada uno le aparece') + ' en la app enseguida.')) return;
    return llamar('testigo_programar', { p_fecha: fecha, p_locales: usados, p_productos: lista }).then(function (r) {
      f.remove();
      avisar('Listo: ' + lista.length + (lista.length === 1 ? ' producto' : ' productos') + ' en ' + r.locales + (r.locales === 1 ? ' local' : ' locales') +
             ', con fecha límite el ' + diaYFecha(fecha) + '.');
      _semanaTestigo = lunesAR(fecha);
      verTestigo();
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   AJUSTES (sólo el administrador; la base no deja a nadie más)
   ════════════════════════════════════════════════════════════════════════ */

/* 15/10/2026: de 9 pestañas a 6. "Sectores y módulos" se fue al mapa (la foto modelo y "algo propio", a la ventana del
   módulo; agregar un sector, a "Repartir"); "Exhibidores" se sacó (vacío, y la nota repetía una regla); los colores y
   las fotos ejemplo están adentro de Reglas de orden. 17/10: "Crear tarea" (para un local, varios o todos).
   21/10: "Personas" se sacó: repetía Config → Usuarios, y los francos de cada uno pasaron allá (SQL 154).
   22/10: "Crear tarea" pasó al menú, como "Tareas": es trabajo de todas las semanas, no un ajuste. "Recordatorios por
   día" se sacó: en 9 días nadie cargó ninguno (sólo el vacío de "Agregar", apagado), no avisaba y se confundía con el
   recordatorio de la tarde de Los avisos. La tabla orden_recordatorios queda en la base. */
var SUBAJUSTES = [['local', 'El local'], ['reglas', 'Reglas de orden'], ['tableros', 'Ideas (tableros)'], ['tests', 'Tests']];
var _sub = 'local';

function verAjustes() {
  var c = document.getElementById('cuerpo');
  if (!SUBAJUSTES.some(function (s) { return s[0] === _sub; })) _sub = 'local';
  c.innerHTML = '<div class="solapas chicas">' + SUBAJUSTES.map(function (s) {
    return '<button data-sub="' + s[0] + '" class="' + (s[0] === _sub ? 'activa' : '') + '">' + s[1] + '</button>';
  }).join('') + '</div><div id="ajuste"><p class="cargando">Cargando…</p></div>';
  c.querySelectorAll('[data-sub]').forEach(function (b) { b.onclick = function () { if (!puedeSalir()) return; _sub = b.dataset.sub; verAjustes(); }; });
  ({ local: ajLocal, reglas: ajReglas, tableros: ajTableros, tests: ajPreguntas })[_sub]();
}

function zonaAjuste(html) { var z = document.getElementById('ajuste'); z.innerHTML = html; return z; }
function errAjuste(e) { error(e, verAjustes); }

/* ── El local (antes "Horarios y funciones"), en frases con el número adentro: "lo de abajo no lo entiendo" ── */
var DIAS_SEL = DIAS_LARGO.map(function (d, i) { return [i + 1, d]; });
var LOS_DIAS = ['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos'];

function frase(html, clase) { return '<p class="frase' + (clase ? ' ' + clase : '') + '">' + html + '</p>'; }

var COLS_DEL_LOCAL = [{ k: 'nombre', t: 'Nombre en la app', tipo: 'texto' }, { k: 'dias_abiertos', t: 'Días que abre', tipo: 'dias' },
  { k: 'hora_apertura', t: 'Abre a las', tipo: 'hora' }, { k: 'hora_cierre', t: 'Cierra a las', tipo: 'hora' },
  { k: 'activo', t: 'Activo: genera controles y aparece en Supervisión y en la app Equipo VDH.', tipo: 'bool' }];

/* Frontal nuevo (SQL 132): la semana en que arranca, entre ésta y las 9 que siguen. Lo guardado puede ser una semana
   vieja: se muestra la próxima que le toca (la misma cuenta, cada N semanas). */
var SEMANAS_FRONTAL = [[null, 'elegí la semana']].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) {
  var l = sumarDias(lunesAR(), 7 * i);
  return [l, i === 0 ? 'esta semana' : i === 1 ? 'la semana que viene' : 'la semana del ' + diaMes(l)];
}));
function verSemanaFrontal(v, fila) {
  if (!v) return v;
  var l = lunesAR(String(v).slice(0, 10)), n = Math.max(1, Number(fila.frontal_cada_semanas) || 1), hoy = lunesAR();
  while (l < hoy) l = sumarDias(l, 7 * n);
  return l;
}

/* Cada bloque se guarda solo y se puede copiar a los otros locales (el nombre y el horario de cada uno, no).
   22/10: "Los controles" se partió en los controles y los avisos; el test semanal pasó a la pestaña Tests. */
var BLOQUES_LOCAL = [
  { id: 'controles', titulo: 'Los controles',
    cols: [{ k: 'dias_control', t: 'Días del salón', corto: 'los días del salón', tipo: 'dias', delLocal: true },
           { k: 'hora_limite', t: 'Hora límite', corto: 'la hora límite', tipo: 'hora', delLocal: true },
           { k: 'sorpresas_por_semana', t: 'Controles sorpresa por semana', tipo: 'num', min: 0, max: 7 },
           { k: 'deposito_dia_vence', t: 'Día del depósito', tipo: 'sel', numero: true, ops: DIAS_SEL },
           { k: 'frontal_cada_semanas', t: 'Frontal nuevo', tipo: 'sel', numero: true, ops: [[null, 'apagado'], [1, 'todas las semanas'], [2, 'cada 2 semanas'], [3, 'cada 3 semanas'], [4, 'cada 4 semanas']] },
           { k: 'frontal_desde', t: 'Desde la semana', tipo: 'sel', ops: SEMANAS_FRONTAL, mostrar: verSemanaFrontal,
             si: 'frontal_cada_semanas', porque: 'Elegí primero cada cuántas semanas va el frontal nuevo.' }],
    armar: function (c) {
      /* SQL 145 (Mauricio, 20/10): martes el salón, jueves el depósito; con franco, el día anterior.
         SQL 159 (22/10): la vidriera, una vez por semana, el primer día del salón; la primera foto vale para todo el local. */
      return frase('El salón se controla ' + c('dias_control') + ' y el depósito el ' + c('deposito_dia_vence') + '. La foto vence a las ' + c('hora_limite') + ' de ese día.') +
        frase('Al que tiene franco ese día le toca el día anterior que trabaja. La vidriera va una vez por semana, el primer día del salón: la primera foto vale para todo el local ' +
              'y, si nadie la manda ese día, sigue pendiente hasta el domingo y queda tarde.', 'aclara') +
        frase('Controles sorpresa por semana, a cada sector: ' + c('sorpresas_por_semana') + ' (un día que no es de control, al azar).') +
        frase('Frontal nuevo: ' + c('frontal_cada_semanas') + ', desde ' + c('frontal_desde') + '. El primer día de control de esa semana cambian el frontal de cada módulo, y la foto del control sirve de prueba (sin fotos de más).');
    } },
  { id: 'avisos', titulo: 'Los avisos',
    cols: [{ k: 'hora_aviso_1', t: 'Aviso de la mañana', corto: 'la hora del aviso', tipo: 'hora', delLocal: true },
           { k: 'hora_aviso_2', t: 'Recordatorio de la tarde', corto: 'la hora del recordatorio', tipo: 'hora', delLocal: true },
           { k: 'max_avisos_dia', t: 'Tope de avisos por día', tipo: 'num', min: 1 },
           { k: 'horas_revision_supervisor', t: 'Horas para revisar', tipo: 'num', min: 1 }],
    armar: function (c) {
      return frase('A quien le toca un control le llega un aviso a las ' + c('hora_aviso_1') + ' y, si todavía no lo hizo, un recordatorio a las ' + c('hora_aviso_2') + '.') +
        frase('A cada persona le llegan como mucho ' + c('max_avisos_dia') + ' avisos por día (los urgentes llegan igual).') +
        frase('Si una foto o una caja espera más de ' + c('horas_revision_supervisor') + ' horas que la revise el supervisor, te llega un aviso.');
    } },
  { id: 'ia', titulo: 'La IA de las fotos',
    cols: [{ k: 'ia_activa', t: 'La IA revisa cada foto con las reglas de orden y le dice al vendedor qué corregir (como mucho 2 cosas, cortitas).', corto: 'la revisión con IA', tipo: 'bool' },
           /* SQL 170 (Mauricio, 24/10): entrenarla antes de que le hable al vendedor. nuevo: sin la columna en la base, no aparece. */
           { k: 'ia_practica', t: 'Modo práctica: la IA mira cada foto y la anota, pero al vendedor no le llega nada (ni sugerencias, ni nivel, ni tareas). Al revisar, decís si acertó, y así aprende.', corto: 'el modo práctica', tipo: 'bool', nuevo: true,
             si: 'ia_activa', porque: 'Con la IA de las fotos apagada no hace nada: prendela arriba.' },
           { k: 'ia_crea_tareas', t: 'Lo que hay que corregir le queda como tarea al vendedor, con plazo.', corto: 'las tareas de la IA', tipo: 'bool',
             si: 'ia_activa', porque: 'Con la IA de las fotos apagada no hace nada: prendela arriba.',
             siNo: 'ia_practica', porqueNo: 'En modo práctica al vendedor no le llega nada: tampoco tareas.' },
           { k: 'ia_sugerencias', t: 'Además deja sugerencias de estilo: consejos para que quede más lindo, como las reglas marcadas como sugerencia. Nunca son tareas, y entran en las 2 de cada foto.', corto: 'las sugerencias de estilo', tipo: 'bool',
             si: 'ia_activa', porque: 'Con la IA de las fotos apagada no hace nada: prendela arriba.',
             siNo: 'ia_practica', porqueNo: 'En modo práctica al vendedor no le llega nada: tampoco sugerencias.' }],
    armar: function (c, f) {
      return frase(c('ia_activa')) + ('ia_practica' in f ? frase(c('ia_practica')) : '') + frase(c('ia_crea_tareas')) + frase(c('ia_sugerencias')) +
        /* (19/10, Mauricio): que apagar una IA no parezca apagar la otra. Son dos llaves distintas en la base. */
        frase('Es sólo la IA de las fotos de los módulos. La que lee los cierres de caja va aparte, en «La caja»: apagar una no apaga la otra.', 'aclara');
    } },
  { id: 'faltas', titulo: 'Las faltas',
    cols: [{ k: 'modo_prueba', t: 'Modo prueba: por ahora no se sugieren faltas.', corto: 'el modo prueba', tipo: 'bool' }].concat([
             { k: 'ventana_faltas_dias', t: 'Días que se miran' }, { k: 'umbral_tareas_vencidas', t: 'Días con tareas vencidas' },
             { k: 'umbral_dias_sin_control', t: 'Días sin mandar controles' }, { k: 'umbral_fuera_estandar', t: 'Días con "Fuera de estándar"' }
           ].map(function (x) { return Object.assign(x, { tipo: 'num', min: 1, siNo: 'modo_prueba', porque: 'Con el modo prueba no se sugieren faltas: sacalo para que cuente.' }); })),
    armar: function (c) {
      return frase(c('modo_prueba')) +
        frase('Se sugiere una falta si en los últimos ' + c('ventana_faltas_dias') + ' días alguien tuvo ' + c('umbral_tareas_vencidas') + ' días con tareas vencidas, ' +
              c('umbral_dias_sin_control') + ' días sin mandar sus controles o ' + c('umbral_fuera_estandar') + ' días con fotos “Fuera de estándar”.') +
        frase('Es sólo una sugerencia: les llega a vos y al supervisor, y la decide siempre una persona.', 'aclara');
    } },
  { id: 'caja', titulo: 'La caja',
    /* La lectura con IA y la diferencia que no avisa cuentan también con el control apagado (la caja que carga el
       supervisor, y el POS): sólo el aviso de "no cargaron la caja" depende del control. */
    cols: [{ k: 'caja_activa', t: 'Control de caja: el local carga cada día la caja, con las fotos del cierre.', corto: 'el control de caja', tipo: 'bool' },
           { k: 'caja_ia', t: 'La IA lee las fotos del cierre y completa los números, también el efectivo contado. Apagada, se cargan a mano.', corto: 'la lectura con IA', tipo: 'bool' },
           { k: 'caja_tolerancia_pesos', t: 'Diferencia que no avisa ($)', tipo: 'num', min: 0 },
           { k: 'caja_minutos_tolerancia', t: 'Minutos después del cierre', tipo: 'num', min: 0, si: 'caja_activa', porque: 'Con el control de caja apagado no se avisa.' }],
    armar: function (c) {
      return frase(c('caja_activa')) + frase(c('caja_ia')) +
        frase('Una diferencia de hasta $ ' + c('caja_tolerancia_pesos') + ' no avisa.') +
        frase('Si ' + c('caja_minutos_tolerancia') + ' minutos después del cierre no cargaron la caja, les avisa al local y al supervisor.');
    } },
  { id: 'fotos', titulo: 'Las fotos guardadas',
    cols: [{ k: 'dias_guardar_fotos', t: 'Días que se guardan las fotos', tipo: 'num', min: 7 },
           { k: 'dias_guardar_fotos_problemas', t: 'Días de las de "A mejorar" o peor', tipo: 'num', min: 7 }, { k: 'dias_guardar_fotos_caja', t: 'Días de las de la caja', tipo: 'num', min: 7 }],
    armar: function (c) {
      return frase('Las fotos de los módulos se borran solas a los ' + c('dias_guardar_fotos') + ' días; las que salieron “A mejorar” o peor, a los ' + c('dias_guardar_fotos_problemas') +
                   '. Las de la caja, a los ' + c('dias_guardar_fotos_caja') + '.') +
        frase('La última foto de cada módulo y las fotos modelo no se borran nunca.', 'aclara');
    } }
];

function ajLocal() {
  var L = valor(_local.id);
  Promise.all([leer('/orden_locales?select=*&id=eq.' + L), leer('/orden_config?select=*&local_id=eq.' + L)]).then(function (r) {
    var loc = (r[0] || [])[0], cfg = (r[1] || [])[0], otros = _locales.length - 1;
    var z = zonaAjuste('<p class="bajada">Lo de ' + esc(_local.nombre) + '. Cada parte se guarda con su botón' +
        (otros ? '; "Copiar a los otros locales" pone lo mismo en ' + (otros === 1 ? 'el otro' : 'los otros ' + otros) + ' (el nombre, el horario, los días y las horas de cada uno no cambian)' : '') + '.</p>' +
      '<div class="seccion">El local</div><div id="ajLocal"></div>' +
      (cfg ? BLOQUES_LOCAL.map(function (b) { return '<div class="seccion">' + esc(b.titulo) + '</div><div id="ajb-' + b.id + '"></div>'; }).join('')
           : '<div class="nota">Este local todavía no tiene los ajustes de los controles.</div>'));
    if (loc) editor({ cont: z.querySelector('#ajLocal'), filas: [loc], cols: COLS_DEL_LOCAL,
      armar: function (c) {
        return frase('En la app se llama ' + c('nombre') + '.') + frase('Abre los días ' + c('dias_abiertos') + ' de ' + c('hora_apertura') + ' a ' + c('hora_cierre') + '.') + frase(c('activo'));
      },
      guardar: function (f, c) { return guardarFila('/orden_locales?id=eq.' + valor(f.id), c).then(function () { if (c.nombre) { _local.nombre = c.nombre; } }); } });
    if (!cfg) return;
    BLOQUES_LOCAL.forEach(function (b) {
      /* Lo nuevo (col.nuevo) sólo si la base ya lo tiene: con la base de antes, todo sigue como estaba. */
      b = Object.assign({}, b, { cols: b.cols.filter(function (c) { return !c.nuevo || c.k in cfg; }) });
      editor({ cont: z.querySelector('#ajb-' + b.id), filas: [cfg], cols: b.cols, armar: b.armar,
        guardar: function (f, c) { return guardarFila('/orden_config?local_id=eq.' + valor(f.local_id), c); },
        extra: otros ? function () { return '<button class="boton chico" data-accion="copiar">Copiar a los otros locales</button>'; } : null,
        accion: function (f, nombre, boton) { return copiarAOtros(f, b, boton); } });
    });
  }).catch(errAjuste);
}

/** "Copiar a los otros locales": lo guardado en un bloque, igual en todos (hoy había que cambiar los 14 de a uno). */
function copiarAOtros(fila, b, boton) {
  var g = boton.closest('.renglon').querySelector('[data-guardar]');
  if (g && !g.disabled) { avisar('Primero guardá los cambios de «' + b.titulo + '».'); return; }
  var otros = _locales.filter(function (l) { return l.id !== _local.id; });
  if (!otros.length) return;
  var copia = b.cols.filter(function (c) { return !c.delLocal; }), quedan = b.cols.filter(function (c) { return c.delLocal; });
  var que = copia.map(function (c) { return c.corto || c.t.toLowerCase(); });
  if (!confirm('¿Poner en ' + (otros.length === 1 ? otros[0].nombre : 'los otros ' + otros.length + ' locales') + ' lo mismo que tiene ' + _local.nombre + ' en «' + b.titulo + '»?\n\n' +
               'Se copia: ' + yLista(que) + '.' + (quedan.length ? '\nNo cambian (son de cada local): ' + yLista(quedan.map(function (c) { return c.corto || c.t.toLowerCase(); })) + '.' : ''))) return;
  var valores = {};
  copia.forEach(function (c) { valores[c.k] = fila[c.k] === undefined ? null : fila[c.k]; });
  return guardarFila('/orden_config?local_id=in.(' + otros.map(function (l) { return valor(l.id); }).join(',') + ')', valores).then(function (n) {
    avisar('Listo: «' + b.titulo + '» quedó igual en ' + n + (n === 1 ? ' local más.' : ' locales más.'));
  });
}

/** Borra y confirma que se borró (como guardarFila: si la seguridad no deja, la base contesta igual). */
function borrarFila(ruta) {
  return tokenVend().then(function (t) { return pedir(ruta, { sesion: t, metodo: 'DELETE', contar: true }); })
    .then(function (n) { if (!n) throw rechazo('No se borró: no tenés permiso o ya no estaba.'); return n; });
}

/** Elegir una foto de la compu o del celular, achicada a JPEG; alElegir(blob) devuelve una promesa. */
function elegirFoto(alElegir) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
  document.body.appendChild(input);
  input.onchange = function () {
    var f = input.files && input.files[0];
    input.remove();
    if (!f) return;
    avisar('Subiendo la foto…');
    archivoAJpeg(f).then(alElegir).catch(function (e) { avisar(esDeRed(e) ? 'Sin señal: no se subió. Probá de nuevo.' : mensajeDe(e)); });
  };
  input.click();
}

/** cfg.antes: html arriba de todo; cfg.despues(zona): para llenar eso cuando ya está dibujado. */
function ajLista(cfg) {
  leer(cfg.ruta).then(function (filas) {
    var z = zonaAjuste((cfg.antes || '') + (cfg.texto ? '<p class="bajada">' + cfg.texto + '</p>' : '') + '<div id="filasLista"></div>' +
      (cfg.nueva ? '<button class="boton" id="agregarLista" style="max-width:320px;margin-top:6px">Agregar</button>' : ''));
    editor({ cont: z.querySelector('#filasLista'), filas: filas || [], cols: cfg.cols,
      guardar: function (f, c) {
        if (cfg.validar) { var m = cfg.validar(Object.assign({}, f, c)); if (m) return Promise.reject(rechazo(m)); }
        return guardarFila(cfg.tabla + '?id=eq.' + valor(f.id), c);
      } });
    var a = z.querySelector('#agregarLista');
    if (a) unaVez(a, function () { return escribir(cfg.tabla, 'POST', cfg.nueva(filas || [])).then(function () { ajLista(cfg); }); });
    if (cfg.despues) cfg.despues(z);
  }).catch(errAjuste);
}

/* ── Reglas de orden (15/10/2026): agrupadas por punto con "+ Agregar" en cada uno; "Hay que corregir" o "Sugerencia";
      adentro, la regla de colores (en Exhibición) y las fotos ejemplo para la IA (SQL 123). ── */
var PUNTOS_REGLAS = [
  ['salon', 'dobladas', 'Doblado', 'Las prendas dobladas: cuántas por estante, el alto de la pila, los bordes. En la pared y en las mesas.'],
  ['salon', 'frontales', 'Frontales', 'La prenda que se muestra de frente en cada estante. Sólo en la pared.'],
  ['salon', 'colgado', 'Colgado', 'Las perchas y las prendas colgadas. Se le pregunta al vendedor en los percheros; en las mesas lo mira sólo la IA.'],
  ['salon', 'etiquetas', 'Etiquetas', 'En la pared, las mesas y los percheros.'],
  ['salon', 'limpieza', 'Limpieza', 'En todos los muebles. Las que empiezan con "En la vidriera:" son sólo para la vidriera.'],
  ['salon', 'exhibicion', 'Exhibición', 'Los colores, las cantidades y los percheros. La IA la mira en todo menos la vidriera; al vendedor se le pregunta en las mesas y en los percheros.'],
  ['salon', 'armado', 'Armado', 'Los maniquíes y las prendas de la vidriera.'],
  ['salon', 'carteles', 'Carteles', 'Los precios y los carteles de la vidriera.'],
  ['salon', 'luces', 'Luces', 'Las luces de la vidriera.'],
  ['deposito', 'dobladas', 'Doblado', ''],
  ['deposito', 'rotulado', 'Rotulado', ''],
  ['deposito', 'talles', 'Segmento y talle', ''],
  ['deposito', 'limpieza', 'Limpieza', '']
];
var NOMBRE_PUNTO = { dobladas: 'Doblado', frontales: 'Frontales', etiquetas: 'Etiquetas', limpieza: 'Limpieza', exhibicion: 'Exhibición', rotulado: 'Rotulado', talles: 'Segmento y talle',
                     colgado: 'Colgado', armado: 'Armado', carteles: 'Carteles', luces: 'Luces' };
/* Las 4 preguntas del control según el mueble (las mismas que orden_checks_mueble en la base, SQL 129). */
var CHECKS_MUEBLE = { estantes: ['dobladas', 'frontales', 'etiquetas', 'limpieza'], mesa: ['dobladas', 'exhibicion', 'etiquetas', 'limpieza'],
                      perchero: ['colgado', 'exhibicion', 'etiquetas', 'limpieza'], vidriera: ['armado', 'carteles', 'limpieza', 'luces'] };
/** El mueble que sale del croquis (el mismo criterio que orden_tipo_mueble). */
function muebleDelCroquis(m) { var n = String(m.nombre || ''); return /vidriera/i.test(n) ? 'vidriera' : /perch/i.test(n) ? 'perchero' : m.isla ? 'mesa' : 'estantes'; }
function nombreMueble(t) { var x = TIPOS_MUEBLE.filter(function (p) { return p[0] === t; })[0]; return x ? x[1] : t; }
var TIPOS_MUEBLE = [['estantes', 'Módulo de pared'], ['mesa', 'Mesa o exhibidor del medio'], ['perchero', 'Perchero'], ['vidriera', 'Vidriera'], ['deposito', 'Depósito']];
var FALTA_123 = 'falta correr el SQL 123 en Supabase (está en el Escritorio, en "App Orden")';
var _conSugerencia = true;

function colsRegla() {
  return [{ k: 'texto', t: 'La regla', tipo: 'area', ancho: 'grande' }]
    .concat(_conSugerencia ? [{ k: 'sugerencia', t: 'Tipo', tipo: 'sel', booleano: true, ancho: 'tipo', ops: [[false, 'Hay que corregir'], [true, 'Sugerencia (consejo)']] }] : [])
    .concat([{ k: 'activo', t: 'Activa', tipo: 'bool' }]);
}

function ajReglas() {
  Promise.all([
    leer('/orden_reglas?select=*&order=orden.asc'),
    leer('/orden_colores?select=*&order=orden.asc'),
    leer('/orden_fotos_ejemplo?select=tipo,foto_path').catch(function () { return null; })   // null: todavía no se corrió el SQL 123
  ]).then(function (r) {
    var reglas = r[0] || [], colores = r[1] || [];
    _conSugerencia = !reglas.length || 'sugerencia' in reglas[0];
    var grupos = {};
    reglas.forEach(function (x) { var k = (x.sector_tipo || 'ambos') + ':' + x.check_clave; (grupos[k] = grupos[k] || []).push(x); });
    var conocidos = PUNTOS_REGLAS.map(function (p) { return p[0] + ':' + p[1]; });
    var otras = Object.keys(grupos).filter(function (k) { return conocidos.indexOf(k) < 0; });
    var html = '<p class="bajada">Para todos los locales. La IA las lee en cada foto: lo que cambies cuenta desde la próxima, no hay que entrenar nada. ' +
      'Las que dicen <b>Hay que corregir</b> pueden volverse tareas; las <b>sugerencias</b> le llegan al vendedor como consejo, si el local tiene prendidas las sugerencias (en El local).</p>' +
      (_conSugerencia ? '' : '<div class="nota">Para marcar una regla como sugerencia ' + FALTA_123 + '.</div>');
    var grupo = '';
    PUNTOS_REGLAS.forEach(function (p) {
      if (p[0] !== grupo) { grupo = p[0]; html += '<h3 class="aj-grupo">' + (grupo === 'salon' ? 'Salón' : 'Depósito') + '</h3>'; }
      var k = p[0] + ':' + p[1];
      html += '<div class="seccion">' + esc(p[2]) + '</div>' + (p[3] ? '<p class="bajada-chica aj-bajada">' + esc(p[3]) + '</p>' : '') + '<div data-reglas="' + k + '"></div>' +
        '<button class="boton chico aj-agregar" data-agregar-regla="' + k + '">+ Agregar una regla</button>' +
        (k === 'salon:exhibicion' ? '<div class="aj-sub">Regla de colores: el degradé de los percheros, del más claro al más oscuro</div><div id="ajColores" class="aj-colores"></div>' +
           '<button class="boton chico aj-agregar" id="agregarColor">+ Agregar un color</button>' : '');
    });
    if (otras.length) {
      html += '<h3 class="aj-grupo">Para el salón y el depósito</h3>' + otras.map(function (k) {
        var p = k.split(':');
        return '<div class="seccion">' + esc((p[0] === 'ambos' ? '' : (p[0] === 'salon' ? 'Salón · ' : 'Depósito · ')) + (NOMBRE_PUNTO[p[1]] || p[1])) + '</div><div data-reglas="' + esc(k) + '"></div>';
      }).join('');
    }
    html += '<h3 class="aj-grupo">Fotos ejemplo para la IA</h3><div id="ajEjemplos"></div>';
    var z = zonaAjuste(html);
    z.querySelectorAll('[data-reglas]').forEach(function (cont) {
      var filas = grupos[cont.dataset.reglas] || [];
      cont.dataset.orden = filas.reduce(function (n, x) { return Math.max(n, x.orden || 0); }, 0);
      pintarReglas(cont, filas);
    });
    z.querySelectorAll('[data-agregar-regla]').forEach(function (b) { b.onclick = function () { nuevaRegla(b); }; });
    pintarColores(z.querySelector('#ajColores'), colores);
    unaVez(z.querySelector('#agregarColor'), function () {
      var id = crypto.randomUUID ? crypto.randomUUID() : null;
      if (!id) { avisar('Este navegador no puede agregar colores. Probá con Chrome.'); return; }
      var fila = { id: id, orden: colores.reduce(function (n, x) { return Math.max(n, x.orden || 0); }, 0) + 1, nombre: 'Nuevo color', hex: '#808080', activo: false };
      return escribir('/orden_colores', 'POST', fila).then(function () {
        colores.push(fila);
        var d = document.createElement('div');
        z.querySelector('#ajColores').appendChild(d);
        pintarColores(d, [fila]);
        avisar('Color agregado (apagado): ponele nombre, la muestra y prendelo.');
      });
    });
    dibujarEjemplos(z.querySelector('#ajEjemplos'), r[2]);
  }).catch(errAjuste);
}

function pintarReglas(cont, filas) {
  editor({ cont: cont, filas: filas, cols: colsRegla(), vacio: 'Sin reglas todavía.',
    guardar: function (f, c) {
      if ('texto' in c && String(c.texto || '').length < 5) return Promise.reject(rechazo('Escribí la regla.'));
      return guardarFila('/orden_reglas?id=eq.' + valor(f.id), c);
    },
    extra: function (f) { return (f.local_id ? '<span class="est">Sólo un local</span>' : '') + '<button class="boton chico" data-accion="borrar">Borrar</button>'; },
    accion: function (f, nombre, boton) {
      var t = String(f.texto || '');
      if (!confirm('¿Borrar la regla "' + (t.length > 80 ? t.slice(0, 80) + '…' : t) + '"?\n\nSi sólo querés dejar de usarla, sacale el tilde de "Activa".')) return;
      return borrarFila('/orden_reglas?id=eq.' + valor(f.id)).then(function () {
        var r = boton.closest('.renglon'), cont2 = r.parentNode;
        r.remove();
        if (!cont2.querySelector('.renglon') && cont2.hasAttribute('data-reglas')) cont2.innerHTML = '<div class="vacio">Sin reglas todavía.</div>';
        avisar('Regla borrada.');
      });
    } });
}

/** "+ Agregar una regla": un renglón para escribirla ahí mismo; se guarda recién con "Guardar". */
function nuevaRegla(boton) {
  var k = boton.dataset.agregarRegla, cont = boton.parentNode.querySelector('[data-reglas="' + k + '"]');
  var ya = cont.querySelector('[data-nueva-regla]');
  if (ya) { ya.querySelector('textarea').focus(); return; }
  var vacio = cont.querySelector(':scope > .vacio');
  if (vacio) vacio.remove();
  var d = document.createElement('div');
  d.className = 'renglon nueva-regla';
  d.setAttribute('data-nueva-regla', k);
  d.innerHTML = '<label class="campo c-grande"><span>La regla nueva</span><textarea rows="2" maxlength="400" placeholder="Escribila como se la dirías a un vendedor"></textarea></label>' +
    (_conSugerencia ? '<label class="campo c-tipo"><span>Tipo</span><select data-tipo-nueva><option value="false">Hay que corregir</option><option value="true">Sugerencia (consejo)</option></select></label>' : '') +
    '<div class="acciones-renglon"><button class="boton chico" data-cancelar>Cancelar</button><button class="boton chico lima" data-crear>Guardar</button></div>';
  cont.appendChild(d);
  var ta = d.querySelector('textarea');
  ta.addEventListener('input', function () { autoAlto(ta); });
  ta.focus();
  d.querySelector('[data-cancelar]').onclick = function () {
    d.remove();
    if (!cont.querySelector('.renglon')) cont.innerHTML = '<div class="vacio">Sin reglas todavía.</div>';
  };
  unaVez(d.querySelector('[data-crear]'), function () {
    var texto = ta.value.trim();
    if (texto.length < 5) { avisar('Escribí la regla.'); return; }
    var id = crypto.randomUUID ? crypto.randomUUID() : null;
    if (!id) { avisar('Este navegador no puede agregar reglas. Probá con Chrome.'); return; }
    var p = k.split(':'), orden = (+cont.dataset.orden || 0) + 1;
    var fila = { id: id, sector_tipo: p[0] === 'ambos' ? null : p[0], check_clave: p[1], texto: texto, activo: true, orden: orden };
    if (_conSugerencia) fila.sugerencia = d.querySelector('[data-tipo-nueva]').value === 'true';
    return escribir('/orden_reglas', 'POST', fila).then(function () {
      cont.dataset.orden = orden;
      var nueva = document.createElement('div');
      cont.replaceChild(nueva, d);
      pintarReglas(nueva, [fila]);
      avisar('Regla guardada: la IA la usa desde la próxima foto.');
    });
  });
}

function pintarColores(cont, filas) {
  editor({ cont: cont, filas: filas, vacio: 'Sin colores.',
    cols: [{ k: 'hex', t: 'Muestra', tipo: 'color', ancho: 'chico' }, { k: 'nombre', t: 'Color', tipo: 'texto' }, { k: 'orden', t: 'Orden', tipo: 'num', ancho: 'chico', min: 1 },
           { k: 'activo', t: 'Activo', tipo: 'bool' }],
    guardar: function (f, c) { return guardarFila('/orden_colores?id=eq.' + valor(f.id), c); } });
}

/** Las fotos ejemplo (una por tipo de mueble): la IA las usa con los módulos que todavía no tienen foto modelo. */
function dibujarEjemplos(cont, ejemplos) {
  if (!cont) return;
  if (ejemplos === null) { cont.innerHTML = '<div class="nota">Para las fotos ejemplo ' + FALTA_123 + '.</div>'; return; }
  var por = {};
  ejemplos.forEach(function (e) { por[e.tipo] = e.foto_path; });
  var otraVez = function () { dibujarEjemplos(cont, Object.keys(por).map(function (k) { return { tipo: k, foto_path: por[k] }; })); };
  cont.innerHTML = '<p class="bajada">La IA compara cada foto con la <b>foto modelo</b> de ese módulo, que se elige en Por local: tocás el módulo, abrís "Para mejorar la IA" y "Usar la foto de arriba" si salió bien. ' +
    'Si el módulo todavía no tiene, usa la foto ejemplo de su tipo de mueble. Que sean fotos de VDH bien hechas: las de Pinterest son de otros locales, con otros muebles, y la confunden.</p>' +
    '<div class="aj-ejemplos">' + TIPOS_MUEBLE.map(function (t) {
      var ruta = por[t[0]];
      return '<div class="aj-ejemplo">' + (ruta ? '<img data-foto="' + esc(ruta) + '" alt="Foto ejemplo: ' + esc(t[1]) + '">' : '<div class="sin-foto">Sin foto</div>') +
        '<b>' + esc(t[1]) + '</b><div class="aj-ejemplo-acc"><button class="boton chico" data-subir-ejemplo="' + t[0] + '">' + (ruta ? 'Cambiar' : 'Subir una foto') + '</button>' +
        (ruta ? '<button class="boton chico" data-sacar-ejemplo="' + t[0] + '">Sacar</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  cargarFotos(cont);
  cont.querySelectorAll('[data-subir-ejemplo]').forEach(function (b) {
    b.onclick = function () {
      var tipo = b.dataset.subirEjemplo;
      elegirFoto(function (blob) {
        return subirArchivo('ejemplos/' + tipo + '-' + nombreArchivo(), blob).then(function (ruta) {
          return (por[tipo] ? guardarFila('/orden_fotos_ejemplo?tipo=eq.' + tipo, { foto_path: ruta, actualizado_en: new Date().toISOString() })
                            : escribir('/orden_fotos_ejemplo', 'POST', { tipo: tipo, foto_path: ruta }))
            .then(function () { por[tipo] = ruta; avisar('Foto ejemplo guardada: la IA la usa desde la próxima foto.'); otraVez(); });
        });
      });
    };
  });
  cont.querySelectorAll('[data-sacar-ejemplo]').forEach(function (b) {
    unaVez(b, function () {
      var tipo = b.dataset.sacarEjemplo;
      if (!confirm('¿Sacar la foto ejemplo de «' + TIPOS_MUEBLE.filter(function (t) { return t[0] === tipo; })[0][1] + '»?')) return;
      return borrarFila('/orden_fotos_ejemplo?tipo=eq.' + tipo).then(function () { delete por[tipo]; avisar('Foto ejemplo sacada.'); otraVez(); });
    });
  });
}

function ajTableros() {
  ajLista({ ruta: '/orden_tableros?select=*&order=destacado.desc,orden.asc', tabla: '/orden_tableros',
    texto: 'Los tableros de Pinterest que ven los vendedores en Ideas, con sus fotos adentro de la app. Pegá la dirección del tablero ' +
      '(por ejemplo https://ar.pinterest.com/Mauu_Camara/vdh-ideas/), no el enlace de "Compartir": ése es para invitar a editarlo. El destacado va primero.',
    cols: [{ k: 'titulo', t: 'Título', tipo: 'texto' }, { k: 'url', t: 'Enlace (https://…)', tipo: 'texto', ancho: 'grande' },
           { k: 'destacado', t: 'Destacado', tipo: 'bool' }, { k: 'orden', t: 'Orden', tipo: 'num', ancho: 'chico' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
    validar: function (f) {
      var u = String(f.url || '').trim();
      if (!/^https:\/\/\S+$/i.test(u)) return 'El enlace tiene que empezar con https://';
      /* El de "Compartir" de Pinterest (pin.it o con invite_code) deja sumarse a editar el tablero: no se reparte. */
      if (/pin\.it\/|invite_code/i.test(u)) return 'Ese enlace es para invitar a editar el tablero. Abrí el tablero en Pinterest y copiá la dirección de arriba (por ejemplo https://ar.pinterest.com/Mauu_Camara/vdh-ideas/).';
      /* Lo mismo que sabe leer la función ideas-tablero: un tablero entero (usuario/tablero), sin secciones ni pines sueltos. */
      var m = u.match(/^https:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,8}\/([A-Za-z0-9_.-]{1,60})\/([A-Za-z0-9_.%-]{1,120})\/?$/i);
      if (!m || ['pin', 'search', 'ideas'].indexOf(m[1].toLowerCase()) > -1) return 'Tiene que ser la dirección de un tablero entero de Pinterest, como https://ar.pinterest.com/Mauu_Camara/vdh-ideas/';
      return null;
    },
    nueva: function (f) { return { titulo: 'Nuevo tablero', url: 'https://www.pinterest.com/', orden: f.length + 1, activo: false }; } });
}

var TEMAS_PREG = [['tela', 'Telas'], ['molderia', 'Molderías'], ['retail', 'Cómo trabajamos']];
function ajPreguntas() {
  ajLista({ ruta: '/orden_preguntas?select=id,tema,dificultad,pregunta,grupo,activo&order=grupo.asc.nullsfirst,tema.asc,dificultad.asc', tabla: '/orden_preguntas',
    antes: '<div class="seccion">El test semanal</div><div id="ajSemanal"><p class="cargando">Cargando…</p></div><div id="ajProgramados"></div><div class="seccion">Las preguntas</div>',
    despues: function (z) { ajTestSemanal(z); ajProgramados(z); },
    texto: 'Las preguntas de los tests de conocimiento, para todos los locales (opción múltiple; si le erran, la app explica la correcta). El test de la semana sale solo, con estas preguntas. ' +
      'Para uno especial (por ejemplo, la colección nueva), cargá sus preguntas con el mismo <b>grupo</b> ("Colección verano") y tocá "Mandar un test": sale ahora o el día y la hora que elijas. ' +
      'Se pueden apagar las que no sirvan.<br><span class="imp-mapa-acc" style="margin-top:10px"><button class="boton chico lima" id="mandarTest">Mandar un test</button>' +
      '<button class="boton chico" id="nuevaPregunta">Nueva pregunta</button></span>',
    cols: [{ k: 'tema', t: 'Tema', tipo: 'ver', ver: function (f) { return ({ tela: 'Telas', molderia: 'Molderías', retail: 'Cómo trabajamos' })[f.tema] || f.tema; } },
           { k: 'dificultad', t: 'Nivel', tipo: 'ver' }, { k: 'pregunta', t: 'Pregunta', tipo: 'ver' },
           { k: 'grupo', t: 'Grupo (test especial)', tipo: 'texto', nulo: true }, { k: 'activo', t: 'Activa', tipo: 'bool' }] });
  /* Los botones de arriba (la lista se dibuja después: se engancha en el contenedor). */
  document.getElementById('ajuste').onclick = function (e) {
    if (e.target.closest('#mandarTest')) mandarTest();
    else if (e.target.closest('#nuevaPregunta')) nuevaPregunta();
  };
}

/** 22/10: el test semanal (orden_config.desafio_activo), todos los locales juntos; antes estaba en El local, de a uno. */
function ajTestSemanal(z) {
  var cont = z.querySelector('#ajSemanal');
  if (!cont) return;
  leer('/orden_config?select=local_id,desafio_activo').then(function (filas) {
    var antes = {};
    (filas || []).forEach(function (f) { antes[f.local_id] = !!f.desafio_activo; });
    var locs = _locales.filter(function (l) { return l.id in antes; }), sl = soloMira();
    if (!locs.length) { cont.innerHTML = '<div class="nota">Ningún local tiene todavía los ajustes de los controles.</div>'; return; }
    cont.innerHTML = '<div class="renglon frases">' +
      frase('A cada vendedor le llega un test de conocimiento por semana, un día y una hora al azar (no cuenta para faltas). Prendido en:') +
      (locs.length > 1 && !sl ? '<div class="imp-mapa-acc"><button type="button" class="boton chico" data-ts="todos">Todos</button><button type="button" class="boton chico" data-ts="ninguno">Ninguno</button></div>' : '') +
      '<div class="imp-locales">' + locs.map(function (l) {
        return '<label class="imp-check"><input type="checkbox" data-ts-loc="' + esc(l.id) + '"' + (antes[l.id] ? ' checked' : '') + (sl ? ' disabled' : '') + '> ' + esc(l.nombre) + '</label>';
      }).join('') + '</div>' +
      (sl ? '' : '<div class="acciones-renglon"><button class="boton chico lima" data-guardar disabled>Guardar</button></div>') + '</div>';
    if (sl) return;
    var g = cont.querySelector('[data-guardar]');
    var cajas = function () { return [].slice.call(cont.querySelectorAll('[data-ts-loc]')); };
    var cambiadas = function () { return cajas().filter(function (x) { return x.checked !== antes[x.dataset.tsLoc]; }); };
    var marcar = function () { g.disabled = !cambiadas().length; };
    cont.addEventListener('change', marcar);
    cont.querySelectorAll('[data-ts]').forEach(function (b) {
      b.onclick = function () { var si = b.dataset.ts === 'todos'; cajas().forEach(function (x) { x.checked = si; }); marcar(); };
    });
    unaVez(g, function () {
      var cam = cambiadas();
      if (!cam.length) return 'dejar-apagado';
      var ruta = function (si) {
        var ids = cam.filter(function (x) { return x.checked === si; }).map(function (x) { return valor(x.dataset.tsLoc); });
        return ids.length ? guardarFila('/orden_config?local_id=in.(' + ids.join(',') + ')', { desafio_activo: si }) : null;
      };
      g.textContent = 'Guardando…';
      return Promise.all([ruta(true), ruta(false)]).then(function () {
        cam.forEach(function (x) { antes[x.dataset.tsLoc] = x.checked; });
        var n = cajas().filter(function (x) { return x.checked; }).length;
        avisar(!n ? 'Guardado: el test semanal quedó apagado en todos los locales.'
                  : 'Guardado: el test semanal está prendido en ' + (n === locs.length && n > 1 ? 'los ' + n + ' locales' : n + (n === 1 ? ' local' : ' locales')) + '.');
        return 'dejar-apagado';
      });
    });
  }).catch(function (e) { cont.innerHTML = '<div class="nota">' + esc(mensajeDe(e)) + '</div>'; });
}

/** Una pregunta nueva: 2 a 4 opciones, cuál es la correcta y la explicación (la ven al responder). */
function nuevaPregunta() {
  var f = ventana('<h1>Nueva pregunta</h1><p class="bajada">De opción múltiple. La explicación la ven después de responder: así aprenden.</p>' +
    '<div class="renglon"><label class="campo c-medio"><span>Tema</span><select id="nqTema">' + TEMAS_PREG.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo c-grande"><span>Grupo (para un test especial, opcional)</span><input id="nqGrupo" maxlength="60" placeholder="Colección verano"></label></div>' +
    '<label class="campo"><span>La pregunta</span><textarea id="nqPregunta" rows="2" maxlength="300"></textarea></label>' +
    [1, 2, 3, 4].map(function (n) {
      return '<div class="renglon"><label class="imp-check" style="width:110px"><input type="radio" name="nqCorrecta" value="' + n + '"' + (n === 1 ? ' checked' : '') + '> Correcta</label>' +
        '<label class="campo c-grande"><span>Opción ' + n + (n > 2 ? ' (opcional)' : '') + '</span><input data-op="' + n + '" maxlength="120"></label></div>';
    }).join('') +
    '<label class="campo"><span>Explicación (opcional)</span><textarea id="nqExplica" rows="2" maxlength="400"></textarea></label>' +
    '<button class="boton lima" id="nqGuardar">Guardar la pregunta</button>');
  unaVez(f.querySelector('#nqGuardar'), function () {
    var ops = [], correcta = 0;
    f.querySelectorAll('[data-op]').forEach(function (i) {
      var v = i.value.trim();
      if (!v) return;
      ops.push(v);
      if (f.querySelector('input[name="nqCorrecta"][value="' + i.dataset.op + '"]').checked) correcta = ops.length;
    });
    var preg = f.querySelector('#nqPregunta').value.trim();
    if (preg.length < 5) { avisar('Escribí la pregunta.'); return; }
    if (ops.length < 2) { avisar('Hacen falta al menos 2 opciones.'); return; }
    if (!correcta) { avisar('Marcá cuál es la correcta (en una opción escrita).'); return; }
    return escribir('/orden_preguntas', 'POST', { tema: f.querySelector('#nqTema').value, dificultad: 1, pregunta: preg, opciones: ops, correcta: correcta,
      explicacion: f.querySelector('#nqExplica').value.trim() || null, grupo: f.querySelector('#nqGrupo').value.trim() || null, activo: true })
      .then(function () { f.remove(); avisar('Pregunta guardada.'); ajPreguntas(); });
  });
}

/** "Tenés un test de conocimiento: Colección verano": a los vendedores de los locales elegidos, ahora o el día y la hora que se elija (SQL 161). */
function mandarTest() {
  leer('/orden_preguntas?select=grupo&activo=is.true&grupo=not.is.null').then(function (filas) {
    var grupos = {};
    (filas || []).forEach(function (g) { var k = String(g.grupo).trim(); if (k) grupos[k] = (grupos[k] || 0) + 1; });
    var nombres = Object.keys(grupos).sort(), hoy = hoyAR();
    var f = ventana('<h1>Mandar un test</h1><p class="bajada">Les llega a los vendedores de los locales que marques: "Tenés un test de conocimiento: …". ' +
        'Todos reciben las mismas preguntas. Se suma al de la semana.</p>' +
      '<div class="renglon"><label class="campo c-grande"><span>Título</span><input id="mtTitulo" maxlength="60" placeholder="Colección verano"></label>' +
        '<label class="campo c-medio"><span>Las preguntas</span><select id="mtDe">' +
          nombres.map(function (g) { return '<option value="g:' + esc(g) + '">Grupo "' + esc(g) + '" (' + grupos[g] + ')</option>'; }).join('') +
          '<option value="t:producto">Telas y molderías</option><option value="t:retail">Cómo trabajamos</option><option value="t:todo">De todo</option></select></label>' +
        '<label class="campo c-chico"><span>Cuántas</span><input id="mtCant" type="number" min="1" max="20" value="5"></label>' +
        '<label class="campo c-chico"><span>Días para hacerlo</span><input id="mtDias" type="number" min="1" max="14" value="2"></label></div>' +
      '<div class="renglon"><label class="campo c-medio"><span>Cuándo</span><select id="mtCuando"><option value="ahora">Ahora</option><option value="otro">Otro día y hora</option></select></label>' +
        '<label class="campo c-medio" data-mt-otro hidden><span>Día</span><input type="date" id="mtFecha" min="' + hoy + '" max="' + sumarDias(hoy, 60) + '" value="' + sumarDias(hoy, 1) + '"></label>' +
        '<label class="campo c-chico" data-mt-otro hidden><span>Hora</span><input type="time" id="mtHora" value="11:00"></label></div>' +
      '<p class="bajada" id="mtCuandoTexto"></p>' +
      '<div class="seccion">Locales</div>' +
      (_locales.length > 1 ? '<div class="imp-mapa-acc"><button class="boton chico" id="mtTodos">Todos</button><button class="boton chico" id="mtNinguno">Ninguno</button></div>' : '') +
      '<div class="imp-locales">' + _locales.map(function (l) {
        return '<label class="imp-check"><input type="checkbox" data-loc="' + esc(l.id) + '" checked> ' + esc(l.nombre) + '</label>';
      }).join('') + '</div>' +
      '<button class="boton lima" id="mtMandar">Mandar el test</button>');
    var de = f.querySelector('#mtDe'), titulo = f.querySelector('#mtTitulo');
    /* Si eligen un grupo, el título sale de ahí (se puede cambiar). */
    var ponerTitulo = function () { if (de.value.indexOf('g:') === 0 && !titulo.value.trim()) titulo.value = de.value.slice(2); };
    de.onchange = ponerTitulo; ponerTitulo();
    var marcar = function (si) { f.querySelectorAll('[data-loc]').forEach(function (x) { x.checked = si; }); };
    if (_locales.length > 1) { f.querySelector('#mtTodos').onclick = function () { marcar(true); }; f.querySelector('#mtNinguno').onclick = function () { marcar(false); }; }
    /* Cuándo: "Ahora" como siempre, u "Otro día y hora" con el día y la hora a la vista (y el botón dice "Programar"). */
    var cuando = f.querySelector('#mtCuando'), fecha = f.querySelector('#mtFecha'), horaT = f.querySelector('#mtHora'), boton = f.querySelector('#mtMandar');
    var pintarCuando = function () {
      var otro = cuando.value === 'otro', t = f.querySelector('#mtCuandoTexto');
      f.querySelectorAll('[data-mt-otro]').forEach(function (x) { x.hidden = !otro; });
      boton.textContent = otro ? 'Programar el test' : 'Mandar el test';
      t.textContent = !otro ? '' : !fecha.value || !horaT.value ? 'Elegí el día y la hora.'
        : 'Sale ' + cuandoSale(fecha.value, horaT.value) + '. Hasta entonces no lo ven: es sorpresa. A esa hora les aparece en la app y el aviso al celular llega en los 15 minutos siguientes. ' +
          'Hasta que salga, lo podés cancelar.';
    };
    cuando.onchange = fecha.oninput = horaT.oninput = pintarCuando;
    pintarCuando();
    unaVez(boton, function () {
      var locales = [].filter.call(f.querySelectorAll('[data-loc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.loc; });
      var v = de.value, esGrupo = v.indexOf('g:') === 0, otro = cuando.value === 'otro';
      if (!titulo.value.trim()) { avisar('Ponele un título.'); return; }
      if (otro && (!fecha.value || !horaT.value)) { avisar('Elegí el día y la hora.'); return; }
      if (!locales.length) { avisar('Marcá al menos un local.'); return; }
      var args = { p_locales: locales, p_titulo: titulo.value.trim(), p_grupo: esGrupo ? v.slice(2) : null, p_tema: esGrupo ? 'todo' : v.slice(2),
                   p_cantidad: parseInt(f.querySelector('#mtCant').value, 10) || 5, p_dias: parseInt(f.querySelector('#mtDias').value, 10) || 2 };
      if (otro) {
        args.p_fecha = fecha.value; args.p_hora = horaT.value;
        return llamar('orden_test_programar', args).then(function () {
          f.remove();
          avisar('Programado: sale ' + cuandoSale(fecha.value, horaT.value) + '.');
          var z = document.getElementById('ajuste');
          if (z) ajProgramados(z);
        }, function (e) {
          throw /PGRST202|could not find the function/i.test(String(e && e.message)) ? rechazo('Para programarlo falta correr el SQL 161 en Supabase (está en el Escritorio, en "App Orden").') : e;
        });
      }
      return llamar('orden_test_mandar', args)
        .then(function (r) {
          f.remove();
          avisar(r && r.personas ? 'Listo: le llegó a ' + r.personas + (r.personas === 1 ? ' vendedor' : ' vendedores') + ' (' + r.preguntas + ' preguntas).'
                                 : 'No hay vendedores aprobados en esos locales todavía.');
        });
    });
  }).catch(function (e) { avisar(mensajeDe(e)); });
}

/** "hoy a las 11:00", "mañana a las 11:00" o "el sábado 25/10 a las 11:00" (día AAAA-MM-DD y hora HH:MM de la Argentina). */
function cuandoSale(dia, hhmm) {
  var hoy = hoyAR();
  return (dia === hoy ? 'hoy' : dia === sumarDias(hoy, 1) ? 'mañana' : 'el ' + diaYFecha(dia)) + ' a las ' + hhmm;
}

/** Los tests programados (SQL 161): los que faltan, con "Cancelar", y los que salieron la última semana. Sin ninguno (o sin el SQL), no ocupa lugar. */
function ajProgramados(z) {
  var cont = z.querySelector('#ajProgramados');
  if (!cont) return;
  var desde = new Date(Date.now() - 7 * 864e5).toISOString();
  leer('/orden_tests_programados?select=id,locales,titulo,grupo,tema,cantidad,dias,sale_en,estado,personas,preguntas,error' +
       '&estado=neq.cancelado&or=(estado.eq.programado,resuelto_en.gte.' + desde + ')&order=sale_en.asc').then(function (filas) {
    if (!cont.isConnected) return;
    if (!filas || !filas.length) { cont.innerHTML = ''; return; }
    /* Primero los que faltan (el próximo arriba), después los que ya salieron (el último arriba). */
    var falta = function (t) { return t.estado === 'programado'; };
    filas = filas.filter(falta).concat(filas.filter(function (t) { return !falta(t); }).reverse());
    var DE ={ producto: 'de telas y molderías', retail: 'de cómo trabajamos', todo: 'de todo' };
    var locs = function (ids) {
      if (ids.length > 1 && ids.length >= _locales.length) return 'los ' + ids.length + ' locales';
      var n = ids.map(nombreLocal);
      return n.length > 3 ? n.slice(0, 3).join(', ') + ' y ' + (n.length - 3) + ' más' : yLista(n);
    };
    var estado = function (t) {
      if (t.estado === 'mandado') return t.personas ? '<span class="est listo">Salió: le llegó a ' + t.personas + (t.personas === 1 ? ' vendedor' : ' vendedores') + '</span>'
                                                    : '<span class="est vencido">Salió, pero no había vendedores aprobados en esos locales</span>';
      if (t.estado === 'no_salio') return '<span class="est vencido">No salió: ' + esc(t.error || 'falló') + '</span>';
      return '<span class="est sorpresa">Programado</span>';
    };
    cont.innerHTML = '<div class="seccion">Tests programados</div>' + filas.map(function (t) {
      var sale = cuandoSale(hoyAR(new Date(t.sale_en)), hora(t.sale_en));
      return '<div class="ct-mandada"><div class="ct-cab"><b>' + esc(t.titulo) + '</b><small>' +
          esc(sale.charAt(0).toUpperCase() + sale.slice(1) + ' · ' + locs(t.locales) + ' · ' + t.cantidad + (t.cantidad === 1 ? ' pregunta ' : ' preguntas ') +
              (t.grupo ? 'del grupo "' + t.grupo + '"' : DE[t.tema] || '') + ' · ' + t.dias + (t.dias === 1 ? ' día' : ' días') + ' para hacerlo') + '</small></div>' +
        '<div class="ct-estados">' + estado(t) + '</div>' +
        (t.estado === 'programado' && !soloMira() ? '<div class="ct-acc"><button class="boton chico" data-cancelar-test="' + esc(t.id) + '">Cancelar</button></div>' : '') + '</div>';
    }).join('');
    cont.querySelectorAll('[data-cancelar-test]').forEach(function (b) {
      unaVez(b, function () {
        var t = filas.filter(function (x) { return x.id === b.dataset.cancelarTest; })[0];
        if (!confirm('¿Cancelar «' + t.titulo + '», que sale ' + cuandoSale(hoyAR(new Date(t.sale_en)), hora(t.sale_en)) + '? No le llega a nadie.')) return;
        return llamar('orden_test_cancelar', { p_id: t.id }).then(function () { avisar('Cancelado: no le llega a nadie.'); ajProgramados(z); });
      });
    });
  }).catch(function () { cont.innerHTML = ''; });
}

/* ════════════════════════════════════════════════════════════════════════ */

inicio();

/* ════════════════════════════════════════════════════════════════════════
   EL MAPA DEL LOCAL (SQL 99), en "Por local": lo arman y reparten el
   supervisor del local o el administrador. La gerencia, sólo mira.
   ════════════════════════════════════════════════════════════════════════ */

var _mapaLocal = null, _porIdLocal = {}, _repartir = false;

function dibujarMapaLocal() {
  var z = document.getElementById('zonaMapa'), d = _mapaLocal;
  if (!z || !d) return;
  var puede = !soloMira();
  if (!puede) _repartir = false;
  z.innerHTML = '<div class="seccion">El mapa del local</div><div class="imp-mapa">' +
    (d.modulos.length ? '<div class="imp-mapa-acc"><button class="boton chico lima" id="btnObservador">Modo observador</button></div>' : '') +
    (puede ? '<div class="imp-mapa-acc"><button class="boton chico' + (_repartir ? ' lima' : '') + '" id="btnRepartir">' + (_repartir ? 'Listo, terminé' : 'Repartir y ponerles nombre') + '</button>' +
      (_repartir && d.pared.length + d.islas.length ? '<button class="boton chico" id="btnParejo">Repartir parejo el salón entre ' + planReparto(d).length + '</button>' : '') +
      (_repartir && d.dep.length > 1 && depositoNumerado(d) ? '<button class="boton chico" id="btnParejoDep">Repartir parejo el depósito entre ' + planReparto(d, 'deposito').length + '</button>' : '') +
      (_repartir && esAdmin() ? '<button class="boton chico" id="btnNuevoSector">Agregar un sector</button>' : '') +
      '<button class="boton chico" id="btnFormaMapa">Armar el croquis</button></div>' : '') +
    (_repartir ? '<p class="bajada">"Repartir parejo" divide los módulos en partes iguales, en bloques seguidos (22 entre 3: 7, 7 y 8). ' +
                 'Para hacerlo a mano o ponerle nombre a un módulo ("Vidriera"), tocalo. Tocá un sector (abajo) para elegir quién lo tiene, quién lo cubre y, en el depósito, qué tiene.</p>' : '') +
    (d.modulos.length ? (_repartir ? '' : resumenSemana(d)) + '<div class="imp-mapa-dibujos">' + svgMapa(d, { marcas: marcasSemana(d) }) + svgDeposito(d, { marcas: marcasSemana(d) }) + '</div>' + leyendaNombres(d)
                      : '<div class="vacio">Este local todavía no tiene módulos' + (puede ? ': tocá "Armar el croquis".' : '.') + '</div>') +
    (d.aprox && d.pared.length ? '<p class="bajada">Todavía no se armó el mapa: los módulos están en las paredes a ojo.</p>' : '') +
    (_repartir ? '<div class="seccion">Salón</div>' + leyendaMapa(d, true) + (d.deposito.length ? '<div class="seccion">Depósito</div>' + listaDeposito(d, true) : '')
               : leyendaPersonas(d)) +
    '</div>';
  var b = document.getElementById('btnRepartir');
  if (b) b.onclick = function () { _repartir = !_repartir; dibujarMapaLocal(); };
  b = document.getElementById('btnFormaMapa');
  if (b) b.onclick = function () { editarMapa(d); };
  b = document.getElementById('btnObservador');
  if (b) b.onclick = function () { abrirObservador(); };
  b = document.getElementById('btnParejo');
  if (b) unaVez(b, function () { return repartirParejo(d); });
  b = document.getElementById('btnParejoDep');
  if (b) unaVez(b, function () { return repartirParejo(d, 'deposito'); });
  b = document.getElementById('btnNuevoSector');
  if (b) b.onclick = function () { nuevoSector(); };
  z.querySelectorAll('.mapa-mod').forEach(function (g) {
    g.onclick = function () {
      if (_repartir) elegirSectorAdmin(d, g.dataset.mod);
      else if (_porIdLocal[g.dataset.mod]) verModulo(_porIdLocal[g.dataset.mod]);
    };
  });
  if (_repartir) z.querySelectorAll('[data-sector]').forEach(function (s) { s.onclick = function () { elegirGenteAdmin(d, s.dataset.sector); }; });
}

/** Las marcas de la semana en el croquis (✓ la mandó, ! falta, la cámara le toca hoy); repartiendo, ninguna. */
function marcasSemana(d) {
  if (_repartir || !_semanaLocal) return null;
  var out = {};
  d.modulos.forEach(function (m) { var sm = semanaDe(m.id), t = sm && MARCA_SEMANA[sm.estado]; if (t) out[m.id] = t; });
  return out;
}

/** El modo observador (croquis-visor.js), a pantalla completa arriba de la administración. "Armar el croquis" aplana
    la maqueta y abre el editor. */
function abrirObservador() {
  var caja = document.createElement('div');
  document.body.appendChild(caja);
  var cerrar = function () { caja.remove(); };
  /* La foto de esta semana de cada módulo, para las marcas de los números y la vista "Semana". */
  var semana = null;
  if (_semanaLocal && _semanaLocal.local === _local.id) {
    semana = {};
    Object.keys(_semanaLocal.mods).forEach(function (id) {
      var sm = _semanaLocal.mods[id], t = textoSemana(sm);
      semana[id] = { estado: sm.estado, corto: t.corto, largo: t.largo };
    });
  }
  var v = abrirVisor(caja, {
    local: _local, puedeSugerir: !soloMira(), puedeNombrar: !soloMira(), puedeEditar: !soloMira(), semana: semana,
    alVolver: cerrar,
    /* Al salir del editor (con o sin guardar) se vuelve al observador, que es de donde se vino. */
    alEditar: function (d) { cerrar(); editarMapa(d || _mapaLocal, { alSalir: abrirObservador }); }
  });
  v.raiz.style.zIndex = 55;   // arriba de la administración, abajo de las ventanas y del cartel
}

function recargarMapaLocal() {
  cargarMapa(_local.id).then(function (d) { _mapaLocal = d; dibujarMapaLocal(); }).catch(function (e) { avisar(mensajeDe(e)); });
}

function elegirSectorAdmin(d, modId) {
  var m = d.modulos.filter(function (x) { return x.id === modId; })[0];
  if (!m) return;
  var tipo = d.sectorDe[m.sector_id].tipo, lista = tipo === 'deposito' ? d.deposito : d.salon;
  /* El nombre: "Vidriera", "Caja"… para identificarlo (en el depósito el nombre es el del sector). */
  var conNombre = true;
  var f = ventana('<h1>' + esc(nombreModulo(m, d.sectorDe[m.sector_id], d)) + '</h1>' +
    (conNombre ? '<div class="renglon"><label class="campo c-grande"><span>' + (m.isla ? 'Nombre' : 'Nombre (opcional): dónde está, para reconocerlo') + '</span>' +
      '<input id="mNombre" maxlength="40" value="' + esc(m.isla ? m.nombre : nombrePropio(m) || '') + '" placeholder="' + (tipo === 'deposito' ? 'Estantería del fondo…' : 'Vidriera, Al lado de la caja…') + '"></label>' +
      '<button class="boton chico" id="mGuardarNombre">Guardar el nombre</button></div>' +
      /* Qué hay (SQL 114): lo que tiene, que cambia con la temporada; se lee arriba del módulo en el croquis. */
      '<div class="renglon"><label class="campo c-grande"><span>Qué hay (opcional)</span>' +
      '<input id="mQue" maxlength="60" value="' + esc(queHay(m) || '') + '" placeholder="Remeras, buzos de algodón…"></label>' +
      '<button class="boton chico" id="mGuardarQue">Guardar qué hay</button></div>' +
      /* SQL 118: lo anota la IA con cada foto; si lo escribió una persona, no lo pisa y deja su sugerencia. */
      (m.contenido_ia ? '<p class="bajada">La IA ve: <b>' + esc(m.contenido_ia) + '</b> <button class="boton chico" id="mUsarIa">Usar esto</button></p>'
        : queHay(m) && m.contenido_origen === 'ia' ? '<p class="bajada">Lo anotó la IA con la última foto, y lo va actualizando. Si lo escribís vos, deja de cambiarlo y sólo sugiere.</p>' : '') : '') +
    '<div class="seccion">¿De quién es?</div>' +
    '<p class="bajada">Elegí el sector. Cada sector tiene su responsable y quién lo cubre.</p><div class="mapa-ley">' + lista.map(function (s) {
      var resp = d.persona[s.responsable_id], sup = d.persona[s.suplente_id];
      return '<button class="mapa-sec' + (s.id === m.sector_id ? ' actual' : '') + '" data-a="' + esc(s.id) + '"><i style="background:' + d.color[s.id] + '"></i><span><b>' +
        esc(nombreSector(s) + ' · ' + (resp ? nombreLista(resp) : 'sin responsable')) + '</b><small>' + esc(sup ? 'Lo cubre ' + nombreLista(sup) : s.id === m.sector_id ? 'Es el de ahora' : '') + '</small></span></button>';
    }).join('') + '</div>');
  f.querySelectorAll('[data-a]').forEach(function (b) {
    unaVez(b, function () {
      if (b.dataset.a === m.sector_id) { f.remove(); return; }
      return llamar('orden_mover_modulo', { p_modulo: m.id, p_sector: b.dataset.a }).then(function () {
        f.remove(); avisar('Listo: ' + nombreModulo(m, d.sectorDe[m.sector_id], d) + ' cambió de sector.'); recargarMapaLocal();
      });
    });
  });
  var gq = f.querySelector('#mGuardarQue');
  if (gq) unaVez(gq, function () {
    var v = f.querySelector('#mQue').value.trim();
    return llamar('orden_modulo_contenido', { p_modulo: m.id, p_contenido: v || null }).then(function () {
      f.remove(); avisar(v ? 'Listo: en el croquis dice "' + v + '".' : 'Listo: se borró qué hay.'); recargarMapaLocal();
    }, function (e) {
      if (/orden_modulo_contenido|PGRST202|could not find the function/i.test(String(e && e.message))) throw rechazo('Falta correr el SQL 114 en Supabase (está en el Escritorio, en "App Orden").');
      throw e;
    });
  });
  var ui = f.querySelector('#mUsarIa');
  if (ui) unaVez(ui, function () {
    return llamar('orden_modulo_contenido_aceptar', { p_modulo: m.id }).then(function () {
      f.remove(); avisar('Listo: en el croquis dice "' + m.contenido_ia + '".'); recargarMapaLocal();
    }, function (e) {
      if (/orden_modulo_contenido_aceptar|PGRST202|could not find the function/i.test(String(e && e.message))) throw rechazo('Falta correr el SQL 118 en Supabase (está en el Escritorio, en "App Orden").');
      throw e;
    });
  });
  var gn = f.querySelector('#mGuardarNombre');
  if (gn) unaVez(gn, function () {
    var v = f.querySelector('#mNombre').value.trim();
    return llamar('orden_modulo_nombre', { p_modulo: m.id, p_nombre: v || null }).then(function () {
      f.remove(); avisar(v ? 'Listo: se llama "' + v + '".' : 'Listo: volvió a su nombre de siempre.'); recargarMapaLocal();
    });
  });
}

/** Cómo quedaría el reparto parejo (lo mismo que hace la base): bloques seguidos, los últimos llevan uno más. */
function planReparto(d, tipo) {
  var todos = tipo === 'deposito' ? d.deposito : d.salon;
  var secs = todos.filter(function (s) { return s.responsable_id; });
  if (!secs.length) secs = todos.slice();
  var mods = tipo === 'deposito' ? d.dep.slice().sort(function (a, b) { return a.numero - b.numero; })
                                  : d.pared.slice().sort(function (a, b) { return a.numero - b.numero; }).concat(d.islas.filter(function (m) { return !esVidriera(m); }));
  var k = secs.length, n = mods.length, base = k ? Math.floor(n / k) : 0, extra = k ? n % k : 0, desde = 0;
  return secs.map(function (s, i) {
    var cant = base + (i >= k - extra ? 1 : 0), suyos = mods.slice(desde, desde + cant);
    desde += cant;
    return { sector: s, cantidad: cant, nums: suyos.map(function (m) { return numeroVista(d, m) || m.nombre; }) };
  });
}

function repartirParejo(d, tipo) {
  var plan = planReparto(d, tipo), mods = tipo === 'deposito' ? d.dep : d.pared.concat(d.islas.filter(function (m) { return !esVidriera(m); }));
  if (!plan.length || !mods.length) { avisar('No hay módulos para repartir.'); return; }
  var texto = plan.map(function (p) {
    var resp = d.persona[p.sector.responsable_id];
    return (resp ? nombreLista(resp) : nombreSector(p.sector)) + ': ' + (p.nums.length ? rangosMixtos(p.nums) + ' (' + p.cantidad + ')' : 'ninguno');
  }).join('\n');
  if (!confirm('Repartir los ' + mods.length + (tipo === 'deposito' ? ' módulos del depósito' : ' módulos del salón (paredes y centro)') + ' en partes iguales:\n\n' + texto + '\n\n' +
               (tipo === 'deposito' ? 'El salón no cambia.' : 'El depósito no cambia.') + ' ¿Repartir así?')) return;
  return llamar('orden_mapa_repartir', { p_local: _local.id, p_tipo: tipo === 'deposito' ? 'deposito' : 'salon' }).then(function () {
    avisar('Listo: repartido parejo.'); recargarMapaLocal();
  });
}

/** Un sector nuevo (antes, en Ajustes → Sectores y módulos). Después se toca abajo para elegir quién lo tiene. */
function nuevoSector() {
  var f = ventana('<h1>Agregar un sector</h1><p class="bajada">Después lo tocás abajo para elegir quién lo tiene y quién lo cubre, y le pasás módulos (tocando cada uno o con "Repartir parejo").</p>' +
    '<div class="mapa-ley"><button class="mapa-sec" data-tipo="salon"><span><b>En el salón</b><small>Un sector más para repartir los módulos</small></span></button>' +
    '<button class="mapa-sec" data-tipo="deposito"><span><b>En el depósito</b><small>Con lo que tiene (remeras, buzos…)</small></span></button></div>');
  f.querySelectorAll('[data-tipo]').forEach(function (b) {
    unaVez(b, function () {
      var tipo = b.dataset.tipo, n = 1;
      /* El número sigue al más alto, contando los apagados (la base no deja dos iguales). */
      return leer('/orden_sectores?select=numero&local_id=eq.' + valor(_local.id) + '&tipo=eq.' + tipo + '&order=numero.desc&limit=1').then(function (u) {
        n = (u && u[0] ? u[0].numero : 0) + 1;
        return escribir('/orden_sectores', 'POST', { local_id: _local.id, tipo: tipo, numero: n });
      }).then(function () {
        f.remove();
        avisar('Listo: ' + (tipo === 'salon' ? 'sector ' + n + ' del salón' : 'depósito ' + n) + '. Tocalo abajo para elegir quién lo tiene.');
        recargarMapaLocal();
      });
    });
  });
}

function elegirGenteAdmin(d, secId) {
  var s = d.salon.concat(d.deposito).filter(function (x) { return x.id === secId; })[0];
  if (!s) return;
  var gente = Object.keys(d.persona).map(function (k) { return d.persona[k]; })
    .filter(function (p) { return (p.rol === 'vendedor' || p.rol === 'supervisor') && !(p.alta_propia && !p.aprobado); });
  var opciones = function (sel) {
    return '<option value="">Nadie</option>' + gente.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(nombreLista(p)) + '</option>';
    }).join('');
  };
  var f = ventana('<h1>' + esc(nombreSector(s)) + '</h1>' +
    '<label class="campo"><span>Lo tiene</span><select id="vResp">' + opciones(s.responsable_id) + '</select></label>' +
    '<label class="campo"><span>Lo cubre (franco o ausencia)</span><select id="vSup">' + opciones(s.suplente_id) + '</select></label>' +
    (s.tipo === 'deposito' ? '<label class="campo"><span>Qué tiene</span><input id="vCat" maxlength="80" value="' + esc(s.nombre || '') + '" placeholder="Remeras, camisas y buzos"></label>' : '') +
    '<button class="boton lima" id="vGuardar">Guardar</button>' + (esAdmin() ? '<div class="vm-sacar" id="vSacarZona"></div>' : ''));
  /* Sacar el sector: sólo si no tiene ningún módulo (ni apagado), porque con él se irían los módulos y su historia. */
  var zs = f.querySelector('#vSacarZona');
  if (zs) leer('/orden_modulos?select=id&sector_id=eq.' + valor(s.id) + '&limit=1').then(function (mm) {
    if (!document.body.contains(zs)) return;
    if (mm && mm.length) { zs.innerHTML = '<p class="bajada-chica">Para sacar este sector no tiene que tener módulos: pasalos a otro tocando cada uno.</p>'; return; }
    zs.innerHTML = '<button class="boton chico" id="vSacar">Sacar este sector</button>';
    unaVez(zs.querySelector('#vSacar'), function () {
      if (!confirm('¿Sacar ' + nombreSector(s) + '? No tiene módulos.')) return;
      return borrarFila('/orden_sectores?id=eq.' + valor(s.id)).then(function () { f.remove(); avisar('Sector sacado.'); recargarMapaLocal(); });
    });
  }).catch(function () {});
  unaVez(f.querySelector('#vGuardar'), function () {
    var cat = f.querySelector('#vCat');
    return llamar('orden_sector_gente', { p_sector: s.id, p_responsable: f.querySelector('#vResp').value || null,
                                          p_suplente: f.querySelector('#vSup').value || null, p_nombre: cat ? cat.value : null })
      .then(function () { f.remove(); avisar('Guardado.'); recargarMapaLocal(); });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   EL CROQUIS DEL LOCAL (SQL 112, pedido de Mauricio: "que quede muy parecido
   a lo real"). Cada pared es una fila de lugares: se toca un lugar para
   cambiarlo (módulo, módulo doble, hueco, algo fijo), la entrada se pone
   donde está y lo del centro se arrastra. Cada módulo se queda en su lugar
   con su historia (nombre, responsable, fotos): al guardar, lo que cambia es
   su número (el 1, al lado de la entrada, hacia la izquierda).
   ════════════════════════════════════════════════════════════════════════ */

var NOMBRE_PARED = { izquierda: 'Pared izquierda', fondo: 'Fondo', derecha: 'Pared derecha', frente: 'Frente' };
var NOMBRE_ESQUINA = { ai: 'de arriba a la izquierda', ad: 'de arriba a la derecha', bi: 'de abajo a la izquierda', bd: 'de abajo a la derecha' };
var NOMBRE_PARED_DEP = { izquierda: 'Pared izquierda', fondo: 'Pared de arriba', derecha: 'Pared derecha', frente: 'Pared de abajo' };
/* Hacia dónde queda "antes" y "después" en la vuelta, en cada pared (para "+ Un lugar…"). */
var LADOS_PARED = { izquierda: ['abajo', 'arriba'], fondo: ['a la izquierda', 'a la derecha'], derecha: ['arriba', 'abajo'], frente: ['a la derecha', 'a la izquierda'] };

/** Un croquis para editar: cada lugar con su módulo ({ t: 'm'|'d', id } — id null: uno nuevo) o { t: 'h', h }. */
function croquisEditable(cq, mods) {
  var e = { paredes: {}, puerta: Object.assign({}, cq.puerta), esquinas: Object.assign({}, cq.esquinas || {}) };
  VUELTA.forEach(function (w) {
    e.paredes[w] = cq.paredes[w].map(function (l) { return esModuloLugar(l) ? { t: l, id: null } : Object.assign({ t: 'h' }, lugarFijo(l)); });
  });
  var orden = ordenEditable(e), usados = {};
  mods.forEach(function (m) {
    var k = m.numero - 1;
    if (k >= 0 && k < orden.length && !orden[k].id && !usados[m.id]) { orden[k].id = m.id; usados[m.id] = true; }
  });
  return { e: e, sobran: mods.filter(function (m) { return !usados[m.id]; }) };
}
/** El croquis editable como se guarda ('m', 'd', { h }). */
function croquisGuardable(e) {
  var paredes = {};
  VUELTA.forEach(function (w) { paredes[w] = e.paredes[w].map(function (l) { return l.t === 'h' ? lugarFijo(l) : l.t; }); });
  return { paredes: paredes, puerta: Object.assign({}, e.puerta), esquinas: Object.assign({}, e.esquinas || {}) };
}
/** El dibujito de una pieza (para los botones y las listas del editor). */
function iconoPieza(k) {
  var t = tamanoPieza(k);
  return '<svg class="pieza-ico" viewBox="0 0 ' + (t.w + 4) + ' ' + (t.h + 4) + '" aria-hidden="true" focusable="false">' + dibujoPieza(k, { x: 2, y: 2, w: t.w, h: t.h }, '', 's', '', { sinNombre: true }) + '</svg>';
}
/** El dibujito de un módulo del centro (la ficha "Módulo" de la caja de muebles). */
function iconoModulo() {
  return '<svg class="pieza-ico" viewBox="0 0 74 50" aria-hidden="true" focusable="false">' +
    '<rect x="2" y="2" width="70" height="46" rx="5" fill="none" style="stroke:var(--sel-borde)" stroke-width="3"/>' +
    '<rect x="5" y="5" width="64" height="40" rx="3" fill="#6E4A2E"/>' +
    (CROQUIS_IMG ? imagenesCroquis(['mesa'], { x: 6, y: 6, w: 62, h: 38 }, 's', true, 0) : '') + '</svg>';
}
var NOMBRE_FRENTE = { calle: 'La vereda (local de calle)', galeria: 'El pasillo de una galería', shopping: 'El pasillo de un shopping' };
/** Los lugares con módulo, en el orden de los números. */
function ordenEditable(e) {
  return ordenCroquis(croquisGuardable(e)).map(function (x) { return e.paredes[x.pared][x.i]; });
}
/** La entrada de siempre (sin marcar) queda al final del frente; una marcada, adentro de su pared. */
function ajustarPuerta(e) {
  var p = e.puerta;
  if (!p || p.virtual || !e.paredes[p.pared]) { e.puerta = { pared: 'frente', pos: e.paredes.frente.length, virtual: true }; return; }
  p.pos = Math.max(0, Math.min(e.paredes[p.pared].length, p.pos));
}

/** Lo del centro se imanta a una grilla de 2,5 % (unos 10 cm) y, cerca de una pared, se pega a ella: su borde contra
    la pared (mitad: la mitad de su tamaño, de 0 a 1), sin meterse encima de los módulos de la pared. */
function imantarCroquis(v, mitad) {
  var m = Math.max(0, Math.min(0.5, mitad || 0)), g = Math.round(entre01(v) / 0.025) * 0.025;
  if (g < m + 0.04) g = m;
  if (g > 1 - m - 0.04) g = 1 - m;
  return Math.max(0, Math.min(1, +g.toFixed(4)));
}

/** Coordenadas de un toque en el dibujo (las del SVG, no las de la pantalla). */
function puntoSvg(svg, ev) {
  var p = svg.createSVGPoint();
  p.x = ev.clientX; p.y = ev.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

/** El croquis del local: la forma, los lugares de cada pared, la entrada, lo del centro y el depósito. */
function editarMapa(d, op) {
  op = op || {};
  var m = d.mapa || {};
  var modPorId = {};
  d.modulos.forEach(function (x) { modPorId[x.id] = x; });
  /* El depósito como va a quedar: numerado seguido si todavía era "uno por sector". */
  var depAhora = depositoNumerado(d) ? d.dep.slice() : d.dep.map(function (k, i) { return Object.assign({}, k, { numero: i + 1 }); });
  var ed = croquisEditable(croquisDe(d, 'salon'), d.pared), edDep = croquisEditable(croquisDe(d, 'deposito'), depAhora);
  /* Los módulos que salen de un lugar quedan a mano: si se vuelve a poner un lugar, vuelve el último que salió
     (con su historia). Los que hoy no entran en el mapa arrancan acá. */
  var st = { salon: ed.e, deposito: edDep.e, mover: null, pila: { salon: ed.sobran.map(function (x) { return x.id; }).reverse(), deposito: edDep.sobran.map(function (x) { return x.id; }).reverse() } };
  var cqGuardado = (m.croquis && m.croquis.salon) ? normalizarCroquis(m.croquis.salon) : { centro: {}, fijos: [] };
  var entradaFija = null;
  /* Los del centro (en orden de la caja hacia la vidriera) y las cosas fijas de adentro. */
  var nuevas = 0;
  var centro = d.islas.filter(function (x) { return !esVidriera(x); }).map(function (x) {
    return { key: x.id, id: x.id, nombre: x.nombre, antes: x.nombre, pos: cqGuardado.centro[String(x.nombre || '').toLowerCase()] || null };
  });
  /* La vidriera: sus paneles (módulos con foto y responsable, sin número). */
  var vidr = d.islas.filter(esVidriera).slice(0, 2).map(function (x) { return { key: x.id, id: x.id, nombre: x.nombre, antes: x.nombre }; });
  var fijos = (cqGuardado.fijos || []).map(function (x) { return Object.assign({}, x); });
  /* Los muebles del depósito (una mesa, un perchero en el medio). */
  var fijosDep = (m.croquis && m.croquis.deposito ? normalizarCroquis(m.croquis.deposito).fijos : []).map(function (x) { return Object.assign({}, x); });
  var fijosDe = { salon: fijos, deposito: fijosDep };

  /* A pantalla completa y "como un juego" (Mauricio, 15/10: "que sea pantalla completa… más práctico y más rápido";
     "los mueblecitos… al alcance para que yo los pueda deslizar… que te den ganas de hacerlo… sin tanta lectura"): a la
     izquierda la caja de muebles para arrastrar, en el medio el dibujo, a la derecha sólo la forma del local, y el salón
     y el depósito en dos solapas. Lo que se pone se toca en el dibujo (un globito con lo suyo) y se saca arrastrándolo
     de vuelta a la caja. */
  var grupo = function (titulo, cuerpo, id) { return '<div class="ed-grupo"' + (id ? ' id="' + id + '"' : '') + '>' + (titulo ? '<h4>' + titulo + '</h4>' : '') + cuerpo + '</div>'; };
  /* Los botones de a uno (Largo | Cuadrado…) manejan un desplegable escondido: lo demás sigue leyendo de ahí. */
  var tira = function (id, valor, ops) {
    return '<select id="' + id + '" class="ed-oculto" tabindex="-1" aria-hidden="true">' + ops.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[2]) + '</option>'; }).join('') + '</select>' +
      '<div class="ed-tira" role="group" data-tira="' + id + '">' + ops.map(function (o) {
        return '<button type="button" data-valor="' + o[0] + '" aria-pressed="' + (o[0] === valor) + '" title="' + esc(o[2]) + '">' + (o[3] || '') + '<span>' + esc(o[1]) + '</span></button>'; }).join('') + '</div>';
  };
  /* − 3 +: para no escribir números. */
  var paso = function (attrs, etiqueta) {
    return '<span class="ed-paso"><button type="button" data-paso="-1" aria-label="Uno menos">−</button>' +
      '<input type="number" inputmode="numeric" min="0" max="40" ' + attrs + ' aria-label="' + esc(etiqueta) + '">' +
      '<button type="button" data-paso="1" aria-label="Uno más">+</button></span>';
  };
  var icoForma = function (cuadrado) {
    return '<svg viewBox="0 0 20 16" aria-hidden="true"><rect x="' + (cuadrado ? 3 : 6) + '" y="1.5" width="' + (cuadrado ? 14 : 8) + '" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  };
  var anchoPuertaHtml = function (id, tipo) {
    return '<span class="imp-ancho-puerta" id="' + id + '"><span>Ocupa</span>' + [1, 2, 3].map(function (a) {
      return '<button type="button" class="boton chico" data-ancho-puerta="' + tipo + ':' + a + '">' + a + '</button>'; }).join('') + '</span>';
  };
  var fichas = function (id, tipo, piezas, conModulo) {
    return '<div class="ed-piezas" id="' + id + '">' +
      (conModulo ? '<button type="button" class="ed-ficha ed-ficha-mod" id="eIslaMas" data-nuevo="modulo" title="Un módulo en el centro (mesa, exhibidor…): con foto y responsable">' + iconoModulo() + '<span>Módulo</span></button>' : '') +
      piezas.map(function (k) {
        return '<button type="button" class="ed-ficha" data-en="' + tipo + '" data-pieza="' + k + '">' + iconoPieza(k) + '<span>' + esc(PIEZAS[k].nombre) + '</span></button>';
      }).join('') + '</div>';
  };
  var f = document.createElement('div');
  f.className = 'ventana-fondo editor-fondo';
  f.innerHTML = '<div class="ventana editor" role="dialog" aria-label="Armar el croquis">' +
    '<header class="ed-cab">' +
      '<button type="button" class="boton chico" id="eVolver">‹ Volver</button>' +
      '<h1>Armar el croquis<small>' + esc(_local ? _local.nombre : '') + '</small></h1>' +
      '<div class="ed-solapas" role="tablist" aria-label="Qué parte">' +
        '<button type="button" role="tab" data-solapa="salon" aria-selected="true">Salón</button>' +
        '<button type="button" role="tab" data-solapa="deposito" aria-selected="false">Depósito</button></div>' +
      '<p class="ed-total" id="eTotal"></p>' +
      '<button class="boton lima" id="eGuardar">Guardar</button>' +
    '</header>' +
    '<div class="ed-cuerpo">' +
      '<aside class="ed-bandeja" aria-label="Muebles para arrastrar">' +
        '<div data-de="salon"><p class="ed-bandeja-tit">Arrastrá al local</p>' + fichas('ePiezas', 'salon', PIEZAS_ADENTRO, true) + '</div>' +
        '<div data-de="deposito" hidden><p class="ed-bandeja-tit">Arrastrá al depósito</p>' + fichas('ePiezasDep', 'deposito', PIEZAS_DEPOSITO) + '</div>' +
        '<div class="ed-tacho" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>' +
          '<span>Soltalo acá para sacarlo</span></div>' +
      '</aside>' +
      '<div class="ed-dibujo">' +
        '<p class="nota ed-flota" id="eNotaCambiar" hidden>Tocá el lugar adonde va: los dos cambian de lugar. <button type="button" class="boton chico" id="eCancelarCambio">Cancelar</button></p>' +
        '<p class="nota ed-flota" id="eNotaPuerta" hidden>Tocá un <b>+</b> verde: ahí va la entrada.</p>' +
        '<p class="nota ed-flota" id="eNotaPuertaDep" hidden>Tocá un <b>+</b> verde: ahí va la puerta.</p>' +
        '<div class="imp-mapa-vista croquis" id="eVista" data-de="salon"></div>' +
        '<div class="imp-mapa-vista croquis" id="eVistaDep" data-de="deposito" hidden></div>' +
        '<div class="ed-burbuja" id="eBurbuja" role="dialog" aria-label="Lo que tocaste" hidden></div>' +
        '<p class="ed-pista">Tocá para cambiar · Arrastrá para mover</p>' +
      '</div>' +
      '<aside class="ed-panel">' +
        '<div data-de="salon">' +
          grupo('Forma', tira('eForma', m.forma === 'cuadrado' ? 'cuadrado' : 'rectangulo', [['rectangulo', 'Largo', 'De calle (largo)', icoForma(false)], ['cuadrado', 'Cuadrado', 'De shopping (cuadrado)', icoForma(true)]])) +
          grupo('Módulos en cada pared', '<div class="ed-plano">' + [['fondo', 'Fondo'], ['izquierda', 'Izquierda'], ['derecha', 'Derecha'], ['frente', 'Frente']].map(function (p) {
              return '<div class="ed-lado" data-lado="' + p[0] + '">' + paso('data-pared="' + p[0] + '"', 'Módulos en ' + NOMBRE_PARED[p[0]]) + '<small>' + p[1] + '</small></div>';
            }).join('') + '<div class="ed-plano-local" aria-hidden="true"><span>Vidriera</span></div></div>') +
          grupo('Vidriera', tira('eVidriera', String(vidr.length), [['0', 'Sin', 'Sin vidriera'], ['1', '1 panel', 'Un panel'], ['2', '2 paneles', 'Dos paneles (izq. y der.)']]) +
            '<p class="ed-chico" id="eNotaVidriera"></p>') +
          grupo('Enfrente', tira('eFrente', NOMBRE_FRENTE[cqGuardado.frente] ? cqGuardado.frente : 'calle', [['calle', 'Vereda', NOMBRE_FRENTE.calle], ['galeria', 'Galería', NOMBRE_FRENTE.galeria], ['shopping', 'Shopping', NOMBRE_FRENTE.shopping]])) +
          grupo('Entrada', '<div class="imp-lugar-ops"><button type="button" class="boton chico" id="eMoverPuerta">Mover la entrada</button>' + anchoPuertaHtml('eAnchoPuerta', 'salon') + '</div>') +
          grupo('', '<button type="button" class="boton chico" id="eAcomodar">Los del centro, en fila</button>', 'eGrupoCentro') +
        '</div>' +
        '<div data-de="deposito" hidden>' +
          grupo('Forma', tira('eFormaDep', m.forma_deposito === 'cuadrado' ? 'cuadrado' : 'rectangulo', [['rectangulo', 'Largo', 'Largo', icoForma(false)], ['cuadrado', 'Cuadrado', 'Cuadrado', icoForma(true)]])) +
          grupo('Módulos', paso('id="eDep"', 'Módulos del depósito') + '<p class="ed-chico">Cada uno, lo que entra en una foto.</p>') +
          grupo('Puerta', '<div class="imp-lugar-ops"><button type="button" class="boton chico" id="eMoverPuertaDep">Mover la puerta</button>' + anchoPuertaHtml('eAnchoPuertaDep', 'deposito') + '</div>') +
        '</div>' +
      '</aside>' +
    '</div></div>';
  document.body.appendChild(f);
  cargarFotos(f);
  var vistaS = f.querySelector('#eVista'), vistaD = f.querySelector('#eVistaDep');

  /* Las dos solapas: se ve el salón o el depósito (lo que estaba a medio hacer en la otra se cancela). */
  function ponerSolapa(t) {
    f.querySelectorAll('[data-solapa]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.solapa === t)); });
    f.querySelectorAll('[data-de]').forEach(function (el) { el.hidden = el.dataset.de !== t; });
    cerrarBurbuja();
    if (st.mover && st.mover !== t) st.mover = null;
    if (st.cambiar && st.cambiar.split(':')[0] !== t) st.cambiar = null;
    vista();
  }
  f.querySelectorAll('[data-solapa]').forEach(function (b) { b.onclick = function () { ponerSolapa(b.dataset.solapa); }; });
  /* Volver: si cambió algo sin guardar, pregunta. Lo mismo con el "atrás" del navegador o del teléfono, con Escape y al
     cerrar la pestaña (sinGuardar): el editor parece una página y el reflejo es tocar "atrás" (árbitro, 15/10). */
  var firmaInicial = null, conMarca = false;
  function firma() { return JSON.stringify([mapaArmado(), croquisArmado(), centro.map(function (c) { return c.nombre; }), vidr.map(function (v) { return v.nombre; })]); }
  f.cambiado = function () { return firmaInicial !== null && firma() !== firmaInicial; };
  /* Si todavía no llegó el "atrás" de un editor que se cerró recién, se espera: si no, ese "atrás" se come esta marca
     (árbitro, ronda 2). Más de medio segundo es que no va a llegar. */
  function ponerMarca(intento) {
    if (_atrasPropio > 0 && (intento || 0) < 25) { setTimeout(function () { if (f.isConnected) ponerMarca((intento || 0) + 1); }, 20); return; }
    if (_atrasPropio > 0) _atrasPropio = 0;
    try { history.pushState({ vdhEditor: true }, ''); conMarca = true; } catch (e) {}
  }
  function cerrarEditor() {
    window.removeEventListener('popstate', alAtras);
    document.removeEventListener('keydown', alEscape);
    f.remove();
    if (conMarca) { conMarca = false; _atrasPropio++; try { history.back(); } catch (e) { _atrasPropio--; } }
  }
  function salir() {
    if (f.cambiado() && !confirm('Hay cambios sin guardar. ¿Salir igual? Lo que no guardaste se pierde.')) return false;
    cerrarEditor();
    if (op.alSalir) op.alSalir();
    return true;
  }
  function alAtras(e) {
    if (e && e.vdhPropio) return;   // el de un editor anterior, que se cerró recién
    conMarca = false;   // ese "atrás" ya la sacó
    /* Con una ventanita encima (el menú de un lugar), el "atrás" cierra sólo esa. */
    var encima = [].slice.call(document.querySelectorAll('.ventana-fondo:not(.editor-fondo)')).pop();
    if (encima) { var c = encima.querySelector('#cerrarVentana'); if (c) c.click(); else encima.remove(); ponerMarca(); return; }
    if (elegido) { cerrarBurbuja(); ponerMarca(); return; }
    if (!salir()) ponerMarca();
  }
  function alEscape(ev) {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    /* Con el menú de un lugar abierto, Escape cierra sólo ese menú (como el "atrás"; árbitro, ronda 2). */
    var encima = [].slice.call(document.querySelectorAll('.ventana-fondo:not(.editor-fondo)')).pop();
    if (encima) { var c = encima.querySelector('#cerrarVentana'); if (c) c.click(); else encima.remove(); return; }
    if (elegido) { var a0 = document.activeElement; if (a0 && burbuja.contains(a0)) a0.blur(); cerrarBurbuja(); return; }
    var a = document.activeElement;
    if (a && f.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) { a.blur(); return; }
    /* Primero cancela lo que estaba a medio hacer ("Cambiar de lugar", "Mover la entrada"). */
    if (st.cambiar || st.mover) { st.cambiar = null; st.mover = null; vista(); return; }
    salir();
  }
  ponerMarca();
  window.addEventListener('popstate', alAtras);
  document.addEventListener('keydown', alEscape);
  f.querySelector('#eVolver').onclick = salir;

  /* ── Cambios en los lugares ── */
  function sacarModulo(tipo, l) { if (l.t !== 'h' && l.id) st.pila[tipo].push(l.id); }
  function moduloNuevo(tipo, t) { return { t: t || 'm', id: st.pila[tipo].length ? st.pila[tipo].pop() : null }; }
  function ponerTipo(tipo, w, i, t, texto, k) {
    var e = st[tipo], l = e.paredes[w][i];
    if (t === 'h') {
      if (l.t !== 'h') sacarModulo(tipo, l);
      e.paredes[w][i] = { t: 'h', h: texto || '', k: k || null, a: l.t === 'h' ? l.a : null };
    } else if (l.t === 'h') e.paredes[w][i] = moduloNuevo(tipo, t);
    else l.t = t;
  }
  function agregarLugar(tipo, w, i, despues) {
    var e = st[tipo], j = despues ? i + 1 : i, p = e.puerta;
    e.paredes[w].splice(j, 0, moduloNuevo(tipo));
    /* El lugar nuevo queda pegado al que tocaste: la entrada se corre si estaba de ese lado. */
    if (!p.virtual && p.pared === w && (despues ? j <= p.pos : j < p.pos)) p.pos++;
    ajustarPuerta(e);
  }
  function sacarLugar(tipo, w, i) {
    var e = st[tipo], p = e.puerta;
    sacarModulo(tipo, e.paredes[w].splice(i, 1)[0]);
    if (!p.virtual && p.pared === w && i < p.pos) p.pos--;
    ajustarPuerta(e);
  }
  /** Cuántos módulos hay en una pared (los dobles cuentan uno; los probadores, los huecos y lo fijo, no). */
  function modulosEn(w) { return st.salon.paredes[w].filter(function (l) { return l.t !== 'h'; }).length; }
  /** La pared pasa a tener n módulos: se agregan al final, o se sacan los últimos (lo que no es módulo queda). */
  function cambiarCantidad(w, n) {
    var e = st.salon, ls = e.paredes[w];
    while (modulosEn(w) < n && ls.length < 60) ls.push(moduloNuevo('salon'));
    while (modulosEn(w) > n) {
      for (var i = ls.length - 1; i >= 0 && ls[i].t === 'h'; i--) {}
      if (i < 0) break;
      sacarLugar('salon', w, i);
    }
    ajustarPuerta(e);
  }
  /** El depósito se vuelve a acomodar alrededor con la cantidad y la forma nuevas; la puerta queda donde estaba. */
  function rehacerDeposito(n, cuadrado) {
    var ids = ordenEditable(st.deposito).map(function (l) { return l.id; });
    var p = paredesDeposito(n, cuadrado), c = { izquierda: p[3], fondo: p[0], derecha: p[1], frente: p[2] };
    var nuevo = { paredes: {}, puerta: st.deposito.puerta.virtual ? null : Object.assign({}, st.deposito.puerta), esquinas: Object.assign({}, st.deposito.esquinas || {}) };
    VUELTA.forEach(function (w) { nuevo.paredes[w] = []; for (var k = 0; k < c[w]; k++) nuevo.paredes[w].push({ t: 'm', id: null }); });
    ajustarPuerta(nuevo);
    for (var k = ids.length - 1; k >= n; k--) if (ids[k]) st.pila.deposito.push(ids[k]);
    ordenEditable(nuevo).forEach(function (l, k2) { l.id = k2 < Math.min(n, ids.length) ? ids[k2] : (st.pila.deposito.length ? st.pila.deposito.pop() : null); });
    st.deposito = nuevo;
  }

  /* ── Lo que se ve ── */
  function centroMapa() {
    var c = {};
    centro.forEach(function (x) { var n = x.nombre.trim().toLowerCase(); if (x.pos && n && !c[n]) c[n] = { x: x.pos.x, y: x.pos.y }; });
    return c;
  }
  function croquisArmado() {
    return { v: 1, salon: Object.assign(croquisGuardable(st.salon), { centro: centroMapa(), frente: f.querySelector('#eFrente').value,
               fijos: fijos.map(function (x) { return { nombre: x.nombre.trim(), tipo: x.tipo, x: x.x, y: x.y, vertical: !!x.vertical }; }) }),
             deposito: Object.assign(croquisGuardable(st.deposito), { fijos: fijosDep.map(function (x) { return { nombre: x.nombre.trim(), tipo: x.tipo, x: x.x, y: x.y, vertical: !!x.vertical }; }) }) };
  }
  function mapaArmado() {
    var mm = { forma: f.querySelector('#eForma').value, forma_deposito: f.querySelector('#eFormaDep').value };
    VUELTA.forEach(function (w) { mm[w] = st.salon.paredes[w].filter(function (l) { return l.t !== 'h'; }).length; });
    mm.deposito = ordenEditable(st.deposito).length;
    return mm;
  }
  /** Los datos para dibujar: cada módulo con el número que va a tener; los nuevos, en el sector del anterior. */
  function datosVista(mm) {
    var pared = [], dep = [], ult = d.salon[0] ? d.salon[0].id : null;
    ordenEditable(st.salon).forEach(function (l, k) {
      var x = l.id && modPorId[l.id];
      if (x) ult = x.sector_id;
      pared.push(x ? Object.assign({}, x, { numero: k + 1 }) : { id: 'nuevo' + k, numero: k + 1, nombre: 'Módulo ' + (k + 1), sector_id: ult, isla: false });
    });
    var islas = centro.map(function (c, k) {
      var ex = c.id && modPorId[c.id];
      return ex ? Object.assign({}, ex, { nombre: c.nombre.trim() || ex.nombre })
                : { id: c.key, numero: 1000 + k, nombre: c.nombre.trim() || '?', isla: true, sector_id: d.salon[0] ? d.salon[0].id : null };
    }).concat(vidr.map(function (v, k) {
      var ex = v.id && modPorId[v.id];
      return ex ? Object.assign({}, ex, { nombre: v.nombre }) : { id: v.key, numero: 2000 + k, nombre: v.nombre, isla: true, sector_id: d.salon[0] ? d.salon[0].id : null };
    }));
    var secDep = d.deposito[0] || { id: '__deposito', tipo: 'deposito', numero: 1, nombre: null };
    var sectorDe = Object.assign({}, d.sectorDe);
    sectorDe[secDep.id] = secDep;
    var ultDep = secDep.id;
    ordenEditable(st.deposito).forEach(function (l, k) {
      var x = l.id && modPorId[l.id];
      if (x) ultDep = x.sector_id;
      dep.push(x ? Object.assign({}, x, { numero: k + 1 }) : { id: 'dnuevo' + k, numero: k + 1, nombre: 'Depósito ' + (k + 1), sector_id: ultDep, isla: false });
    });
    return Object.assign({}, d, { mapa: mm, pared: pared, islas: islas, dep: dep, sectorDe: sectorDe });
  }
  /** Qué cambia al guardar: los nuevos, los que se apagan y los que cambian de número. */
  function cambios() {
    var nuevos = 0, apagan = 0, renumeran = 0, quedan = {};
    [['salon', d.pared], ['deposito', depAhora]].forEach(function (g) {
      ordenEditable(st[g[0]]).forEach(function (l, k) {
        if (!l.id) { nuevos++; return; }
        quedan[l.id] = true;
        var antes = g[1].filter(function (x) { return x.id === l.id; })[0];
        if (antes && antes.numero !== k + 1) renumeran++;
      });
      apagan += g[1].filter(function (x) { return !quedan[x.id]; }).length;
    });
    nuevos += centro.filter(function (q) { return !q.id; }).length + vidr.filter(function (q) { return !q.id; }).length;
    apagan += d.islas.filter(function (i) { return !centro.some(function (c) { return c.id === i.id; }) && !vidr.some(function (v) { return v.id === i.id; }); }).length;
    return { nuevos: nuevos, apagan: apagan, renumeran: renumeran };
  }
  function vista() {
    var mm = mapaArmado(), dv = datosVista(mm), cq = croquisArmado();
    vistaS.innerHTML = svgMapa(dv, { croquis: cq, editable: true, vacios: true, moverPuerta: st.mover === 'salon' ? 'salon' : null });
    vistaD.innerHTML = svgDeposito(dv, { croquis: cq, editable: true, moverPuerta: st.mover === 'deposito' ? 'deposito' : null }) ||
      '<p class="bajada">Sin módulos en el depósito.</p>';
    f.querySelectorAll('[data-pared]').forEach(function (i) { if (document.activeElement !== i) i.value = modulosEn(i.dataset.pared); });
    var dep = f.querySelector('#eDep');
    if (document.activeElement !== dep) dep.value = mm.deposito;
    f.querySelector('#eMoverPuerta').textContent = st.mover === 'salon' ? 'Cancelar' : 'Mover la entrada';
    f.querySelector('#eMoverPuertaDep').textContent = st.mover === 'deposito' ? 'Cancelar' : 'Mover la puerta';
    /* El ancho, sólo con la puerta puesta (la de siempre, en la esquina, no se dibuja). */
    [['salon', '#eAnchoPuerta'], ['deposito', '#eAnchoPuertaDep']].forEach(function (x) {
      var p = st[x[0]].puerta, caja = f.querySelector(x[1]);
      caja.hidden = !p || p.virtual;
      caja.querySelectorAll('[data-ancho-puerta]').forEach(function (b) { b.classList.toggle('lima', +b.dataset.anchoPuerta.split(':')[1] === anchoPuerta(p)); });
    });
    f.querySelector('#eNotaPuerta').hidden = st.mover !== 'salon';
    f.querySelector('#eNotaPuertaDep').hidden = st.mover !== 'deposito';
    /* Cuántos paneles de vidriera van, según dónde está la entrada. */
    var pu = st.salon.puerta, enMedio = pu && !pu.virtual && pu.pared === 'frente' && pu.pos > 0 && pu.pos < st.salon.paredes.frente.length;
    f.querySelector('#eNotaVidriera').textContent = !vidr.length ? '' : enMedio ? 'Con la entrada en el medio del frente van dos paneles.' : 'Con la entrada en una punta va un panel.';
    /* "Cambiar de lugar": el lugar elegido, marcado, y el aviso arriba del dibujo. */
    f.querySelector('#eNotaCambiar').hidden = !st.cambiar;
    if (st.cambiar) {
      var orig = vistaDe(st.cambiar.split(':')[0]).querySelector('[data-lugar="' + st.cambiar + '"]');
      if (orig) orig.classList.add('mapa-origen'); else st.cambiar = null;
    }
    var total = dv.pared.length;
    /* Los botones de a uno, como dicen los desplegables escondidos. */
    f.querySelectorAll('[data-tira]').forEach(function (t) {
      var v = f.querySelector('#' + t.dataset.tira).value;
      t.querySelectorAll('[data-valor]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.valor === v)); });
    });
    f.querySelector('#eGrupoCentro').hidden = !centro.length;
    var c = cambios();
    /* Arriba, corto: cuántos hay y qué cambia al guardar (el detalle lo pregunta al guardar). */
    var tot = [total + ' en las paredes'].concat(centro.length ? [centro.length + ' en el centro'] : [], [mm.deposito + ' en el depósito']).join(' · ');
    var cam = [].concat(c.nuevos ? ['se crean ' + c.nuevos] : [], c.renumeran ? ['cambian de número ' + c.renumeran] : [], c.apagan ? ['se apagan ' + c.apagan] : []).join(' · ');
    f.querySelector('#eTotal').innerHTML = esc(tot) + (cam ? '<b>Al guardar: ' + esc(cam) + '</b>' : '');
    posBurbuja();
  }

  /* ── El menú de un lugar de la pared ── */
  function menuLugar(tipo, w, i) {
    var e = st[tipo], l = e.paredes[w][i];
    if (!l) return;
    var num = ordenEditable(e).indexOf(l) + 1, x = l.t !== 'h' && l.id ? modPorId[l.id] : null;
    var ahora = l.t === 'h' ? (l.h ? '"' + l.h + '" (no es un módulo)' : 'un hueco (no es un módulo)')
      : (l.t === 'd' ? 'el módulo doble ' : 'el módulo ') + num + (x && nombrePropio(x) ? ' · ' + nombrePropio(x) : '') + (l.id ? '' : ' (nuevo)');
    var lados = LADOS_PARED[w], nombres = tipo === 'deposito' ? NOMBRE_PARED_DEP : NOMBRE_PARED;
    /* La esquina de esta punta (si es la primera o la última de la pared) y de quién es. */
    var esquina = i === 0 ? PUNTAS[w][0] : i === e.paredes[w].length - 1 ? PUNTAS[w][1] : null;
    var esMia = esquina && duenoEsquina({ esquinas: e.esquinas }, esquina) === w;
    var g = ventana('<h1>' + esc((tipo === 'deposito' ? 'Depósito · ' : '') + nombres[w]) + ' · lugar ' + (i + 1) + '</h1><p class="bajada">Ahora es ' + esc(ahora) + '.</p>' +
      '<div class="imp-lugar-ops">' +
        '<button type="button" class="boton chico' + (l.t === 'm' ? ' lima' : '') + '" data-op="m">Módulo</button>' +
        '<button type="button" class="boton chico' + (l.t === 'd' ? ' lima' : '') + '" data-op="d">Módulo doble (el doble de ancho)</button>' +
        '<button type="button" class="boton chico' + (l.t === 'h' && !l.h ? ' lima' : '') + '" data-op="h">Hueco</button></div>' +
      '<div class="seccion">O algo que no es un módulo</div><div class="imp-lugar-ops imp-piezas">' + PIEZAS_PARED.map(function (k) {
        var es = l.t === 'h' && (l.h || l.k) && (l.k || tipoPieza(l.h)) === k;
        return '<button type="button" class="boton chico' + (es ? ' lima' : '') + '" data-op="p:' + k + '">' + iconoPieza(k) + '<span>' + esc(PIEZAS[k].nombre) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="renglon"><label class="campo c-grande"><span>Otra cosa (escribí qué es)</span><input id="lFijo" maxlength="40" value="' + esc(l.t === 'h' && !l.k && tipoPieza(l.h) === 'otro' ? l.h : '') + '" placeholder="Baño, matafuegos, un exhibidor fijo…"></label>' +
        '<button type="button" class="boton chico" data-op="f">Poner esto</button></div>' +
      (l.t === 'h' ? '<div class="imp-lugar-ops"><span class="bajada" style="margin:0;align-self:center">Ocupa</span>' + [1, 2, 3].map(function (a) {
        return '<button type="button" class="boton chico' + ((l.a || 1) === a ? ' lima' : '') + '" data-op="a:' + a + '">' + a + (a === 1 ? ' lugar' : ' lugares') + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="seccion">Agregar o sacar</div><div class="imp-lugar-ops">' +
        '<button type="button" class="boton chico" data-op="antes">+ Un lugar ' + lados[0] + '</button>' +
        '<button type="button" class="boton chico" data-op="despues">+ Un lugar ' + lados[1] + '</button>' +
        '<button type="button" class="boton chico" data-op="sacar">Sacar este lugar</button>' +
        '<button type="button" class="boton chico" data-op="cambiar">Cambiar de lugar con otro</button></div>' +
      (esquina ? '<div class="seccion">La esquina ' + NOMBRE_ESQUINA[esquina] + '</div><div class="imp-lugar-ops">' +
        '<button type="button" class="boton chico' + (esMia ? ' lima' : '') + '" data-op="esq:' + w + '">Que esta pared llegue hasta la esquina</button>' +
        '<button type="button" class="boton chico' + (esMia ? '' : ' lima') + '" data-op="esq:' + (ESQUINAS[esquina][0] === w ? ESQUINAS[esquina][1] : ESQUINAS[esquina][0]) + '">Que la ocupe ' +
          esc((nombres[ESQUINAS[esquina][0] === w ? ESQUINAS[esquina][1] : ESQUINAS[esquina][0]] || '').toLowerCase()) + '</button></div>' : '') +
      (l.t !== 'h' && l.id ? '<p class="bajada" style="margin-top:12px">Si lo sacás o lo cambiás por algo que no es un módulo, el módulo se apaga al guardar (no se borra: quedan sus fotos).</p>' : ''));
    g.querySelectorAll('[data-op]').forEach(function (b) {
      b.onclick = function () {
        var op = b.dataset.op;
        if (op === 'f') {
          var t = g.querySelector('#lFijo').value.trim();
          if (!t) { avisar('Escribí qué es (baño, matafuegos…) o elegí una de arriba.'); return; }
          ponerTipo(tipo, w, i, 'h', t);
        } else if (op.indexOf('p:') === 0) ponerTipo(tipo, w, i, 'h', PIEZAS[op.slice(2)].nombre, op.slice(2));
        else if (op.indexOf('a:') === 0) { if (l.t === 'h') l.a = +op.slice(2) > 1 ? +op.slice(2) : null; }
        else if (op === 'antes' || op === 'despues') {
          if (e.paredes[w].length >= 60) { avisar('Como mucho 60 lugares por pared.'); return; }
          agregarLugar(tipo, w, i, op === 'despues');
        } else if (op === 'sacar') sacarLugar(tipo, w, i);
        else if (op === 'cambiar') { st.cambiar = tipo + ':' + w + ':' + i; st.mover = null; }
        else if (op.indexOf('esq:') === 0) { e.esquinas = e.esquinas || {}; if (op.slice(4) === ESQUINAS[esquina][0]) delete e.esquinas[esquina]; else e.esquinas[esquina] = op.slice(4); }
        else ponerTipo(tipo, w, i, op);
        g.remove(); vista();
        /* En el celular, el dibujo justo debajo de la cabecera, con el aviso a la vista (centrando el lugar, en los
           de 384 px o menos la cabecera tapaba el aviso; árbitro, ronda 2). */
        if (op === 'cambiar' && !verDibujo(true)) { var mc = vistaDe(tipo).querySelector('.mapa-origen'); if (mc) mc.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      };
    });
  }

  /* ── El menú de la entrada (o de la puerta del depósito): cuántos lugares ocupa y moverla ── */
  /** Lo que se puede sumar a la entrada: un hueco, o algo fijo que dice "entrada" o "puerta" (no la del depósito). */
  function sumableAPuerta(l) { return !!l && l.t === 'h' && l.k !== 'deposito' && (lugarVacio(l) || (!l.k && /entrada|puerta/i.test(l.h || ''))); }
  /** Lo de al lado de la puerta que se puede sumar, pasa a ser parte de ella (hasta 3 lugares). desdeCero: la puerta
      recién puesta en un hueco toma su ancho (y el de los huecos pegados). */
  function sumarALaPuerta(tipo, desdeCero) {
    var e = st[tipo], p = e.puerta, lista = e.paredes[p.pared], a = desdeCero ? 0 : anchoPuerta(p);
    while (sumableAPuerta(lista[p.pos]) && a + anchoLugar(lista[p.pos]) <= 3) a += anchoLugar(lista.splice(p.pos, 1)[0]);
    while (p.pos > 0 && sumableAPuerta(lista[p.pos - 1]) && a + anchoLugar(lista[p.pos - 1]) <= 3) { a += anchoLugar(lista.splice(p.pos - 1, 1)[0]); p.pos--; }
    p.a = a > 1 ? a : null;
    ajustarPuerta(e);
  }
  function menuPuerta(tipo) {
    var e = st[tipo], p = e.puerta, dep = tipo === 'deposito';
    if (!p || p.virtual) return;
    var a = anchoPuerta(p), lista = e.paredes[p.pared] || [];
    var pegados = [lista[p.pos - 1], lista[p.pos]].filter(sumableAPuerta);
    var g = ventana('<h1>' + (dep ? 'La puerta del depósito' : 'La entrada') + '</h1>' +
      '<p class="bajada">El 1 es el módulo de al lado, hacia la izquierda.' + (dep ? '' : ' Para que quede en el medio, dejá la misma cantidad de lugares de cada lado y, si hace falta, que ocupe 2.') + '</p>' +
      (pegados.length ? '<p class="nota">' + (lugarVacio(pegados[0]) ? 'Al lado de la entrada quedó un hueco.' : 'Al lado está <b>"' + esc(pegados[0].h) + '"</b>, cargado como algo fijo.') +
        ' Si es parte de la entrada, sumalo: la entrada se agranda y no queda un espacio raro.</p>' +
        '<div class="imp-lugar-ops"><button type="button" class="boton chico lima" data-op="sumar">Sumarlo a la entrada</button></div>' : '') +
      '<div class="seccion">¿Cuántos lugares ocupa?</div><div class="imp-lugar-ops">' + [1, 2, 3].map(function (n) {
        return '<button type="button" class="boton chico' + (n === a ? ' lima' : '') + '" data-op="a:' + n + '">' + n + (n === 1 ? ' lugar' : ' lugares') + '</button>';
      }).join('') + '</div>' +
      '<div class="seccion">Moverla</div><div class="imp-lugar-ops"><button type="button" class="boton chico" data-op="mover">Ponerla en otro lugar</button></div>');
    g.querySelectorAll('[data-op]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.op === 'mover') { st.mover = tipo; st.cambiar = null; }
        else if (b.dataset.op === 'sumar') sumarALaPuerta(tipo, false);
        else { var n = +b.dataset.op.slice(2); p.a = n > 1 ? n : null; }
        g.remove(); vista();
      };
    });
  }

  /* ── Tocar el dibujo ── */
  var soltadoEn = 0;
  function vistaDe(tipo) { return tipo === 'deposito' ? vistaD : vistaS; }
  function tocar(ev) {
    var t = ev.target.closest && ev.target.closest('[data-lugar], [data-puerta], [data-hueco-puerta]');
    /* Al soltar algo que arrastraban encima de una pared, no se abre el menú de ese lugar. */
    if (!t || Date.now() - soltadoEn < 400) return;
    if (st.cambiar && t.dataset.lugar) {
      var de = st.cambiar, a = t.dataset.lugar;
      if (de === a) { st.cambiar = null; vista(); return; }
      if (de.split(':')[0] !== a.split(':')[0]) { avisar(de.split(':')[0] === 'deposito' ? 'Elegí otro lugar del depósito.' : 'Elegí otro lugar del salón.'); return; }
      st.cambiar = null;
      intercambiar(de, a);
      vista();
      var nv = vistaDe(a.split(':')[0]).querySelector('[data-lugar="' + a + '"]');
      if (nv && nv.previousElementSibling) nv.previousElementSibling.classList.add('mapa-rebota');
      avisar('Listo: cambiaron de lugar. Al guardar se numeran de nuevo desde la entrada (cada módulo sigue con su responsable y sus fotos).');
      return;
    }
    if (t.dataset.huecoPuerta) {
      var p = t.dataset.huecoPuerta.split(':');
      var anchoAntes = anchoPuerta(st[p[0]].puerta);
      st[p[0]].puerta = { pared: p[1], pos: +p[2], a: p[3] === 'h' ? null : anchoAntes > 1 ? anchoAntes : null };
      if (p[3] === 'h') sumarALaPuerta(p[0], true);
      st.mover = null; vista();
      avisar(p[0] === 'deposito' ? 'Listo: la puerta del depósito va ahí.' : 'Listo: la entrada va ahí. El 1 es el de al lado, hacia la izquierda.');
    } else if (t.dataset.puerta) menuPuerta(t.dataset.puerta);
    else if (!st.mover) { var q = t.dataset.lugar.split(':'); menuLugar(q[0], q[1], +q[2]); }
  }
  vistaS.addEventListener('click', tocar);
  vistaD.addEventListener('click', tocar);

  /* ── Arrastrar un lugar de una pared hasta otro: los dos cambian de lugar ── */
  function intercambiar(a, b) {
    var p = a.split(':'), q = b.split(':'), tipo = p[0];
    if (tipo !== q[0] || a === b) return false;
    var la = st[tipo].paredes[p[1]], lb = st[tipo].paredes[q[1]];
    if (!la || !lb || !la[+p[2]] || !lb[+q[2]]) return false;
    var x = la[+p[2]]; la[+p[2]] = lb[+q[2]]; lb[+q[2]] = x;
    return true;
  }
  function arrastreLugar(vistaEl) {
    var arr = null;
    function destinoEn(x, y) {
      var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
      for (var k = 0; k < els.length; k++) {
        var l = els[k].getAttribute && els[k].getAttribute('data-lugar');
        if (l && l !== arr.lugar && l.split(':')[0] === arr.lugar.split(':')[0]) return els[k];
      }
      return null;
    }
    function agarrar(tq, x, y, dedo) {
      var svg = tq.closest('svg');
      arr = { toque: tq, lugar: tq.getAttribute('data-lugar'), svg: svg, x0: x, y0: y, p0: puntoSvg(svg, { clientX: x, clientY: y }), dedo: dedo, activo: false, destino: null };
      /* Con el dedo, se mantiene apretado un momento (si no, es deslizar la pantalla). */
      if (dedo) arr.reloj = setTimeout(function () { if (arr && !arr.activo) empezar(); }, 320);
    }
    function empezar() {
      arr.activo = true;
      arr.toque.style.pointerEvents = 'none';
      [arr.toque, arr.toque.previousElementSibling].forEach(function (el) { if (el) el.classList.add('levantado'); });
      if (arr.dedo && navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
    }
    /* Devuelve true si se está arrastrando (para no desplazar la pantalla). */
    function mover(x, y) {
      if (!arr) return false;
      var dx = x - arr.x0, dy = y - arr.y0;
      if (!arr.activo) {
        if (arr.dedo) { if (Math.abs(dx) + Math.abs(dy) > 10) terminar(false); return false; }
        if (Math.abs(dx) + Math.abs(dy) < 6) return false;
        empezar();
      }
      var p = puntoSvg(arr.svg, { clientX: x, clientY: y }), mx = p.x - arr.p0.x, my = p.y - arr.p0.y;
      [arr.toque, arr.toque.previousElementSibling].forEach(function (el) { if (el) el.setAttribute('transform', 'translate(' + mx.toFixed(1) + ',' + my.toFixed(1) + ')'); });
      var d = destinoEn(x, y);
      if (d !== arr.destino) {
        if (arr.destino) arr.destino.classList.remove('mapa-destino');
        arr.destino = d;
        if (d) d.classList.add('mapa-destino');
      }
      return true;
    }
    function terminar(soltado) {
      if (!arr) return;
      var a = arr;
      arr = null;
      clearTimeout(a.reloj);
      if (!a.activo) return;
      soltadoEn = Date.now();
      var hecho = soltado && a.destino && intercambiar(a.lugar, a.destino.getAttribute('data-lugar'));
      var final = hecho ? a.destino.getAttribute('data-lugar') : null;
      vista();
      if (hecho) {
        var nuevo = vistaEl.querySelector('[data-lugar="' + final + '"]');
        if (nuevo && nuevo.previousElementSibling) nuevo.previousElementSibling.classList.add('mapa-rebota');
        avisar('Listo: cambiaron de lugar. Al guardar se numeran de nuevo desde la entrada (cada módulo sigue con su responsable y sus fotos).');
      }
    }
    /* El mouse (y el lápiz). */
    var idMouse = null;
    function moverMouse(ev) { if (ev.pointerId === idMouse) mover(ev.clientX, ev.clientY); }
    function soltarMouse(ev) {
      if (ev.pointerId !== idMouse) return;
      idMouse = null;
      window.removeEventListener('pointermove', moverMouse); window.removeEventListener('pointerup', soltarMouse); window.removeEventListener('pointercancel', soltarMouse);
      terminar(ev.type === 'pointerup');
    }
    vistaEl.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'touch') return;
      var tq = ev.target.closest && ev.target.closest('[data-lugar]');
      if (!tq || st.mover || st.cambiar || arr || (ev.button && ev.button !== 0)) return;
      idMouse = ev.pointerId;
      agarrar(tq, ev.clientX, ev.clientY, false);
      window.addEventListener('pointermove', moverMouse);
      window.addEventListener('pointerup', soltarMouse);
      window.addEventListener('pointercancel', soltarMouse);
    });
    /* El dedo. */
    vistaEl.addEventListener('touchstart', function (ev) {
      var tq = ev.target.closest && ev.target.closest('[data-lugar]');
      if (!tq || st.mover || st.cambiar || arr || ev.touches.length !== 1) { if (arr) terminar(false); return; }
      agarrar(tq, ev.touches[0].clientX, ev.touches[0].clientY, true);
    }, { passive: true });
    vistaEl.addEventListener('touchmove', function (ev) {
      if (!arr || !arr.dedo) return;
      if (mover(ev.touches[0].clientX, ev.touches[0].clientY)) ev.preventDefault();
    }, { passive: false });
    vistaEl.addEventListener('touchend', function (ev) {
      if (!arr || !arr.dedo) return;
      var activo = arr.activo;
      terminar(true);
      /* Soltar después de arrastrar no "toca" el lugar de abajo. */
      if (activo) ev.preventDefault();
    });
    vistaEl.addEventListener('touchcancel', function () { if (arr && arr.dedo) terminar(false); });
    /* Mantener apretado no abre el menú del navegador. */
    vistaEl.addEventListener('contextmenu', function (ev) { if (ev.target.closest && ev.target.closest('[data-lugar]')) ev.preventDefault(); });
  }
  arrastreLugar(vistaS);
  arrastreLugar(vistaD);
  /* Arrastrar lo del centro y las cosas fijas de adentro (con el dedo o con el mouse). */
  function engancharAdentro(vistaEl, en) {
  vistaEl.addEventListener('touchstart', function (ev) { if (ev.target.closest && ev.target.closest('[data-centro], [data-fijo]')) ev.preventDefault(); }, { passive: false });
  vistaEl.addEventListener('pointerdown', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-centro], [data-fijo]');
    if (!t) return;
    ev.preventDefault();
    var svg = t.closest('svg'), caja = (svg.getAttribute('data-adentro') || '').split(' ').map(Number);
    var mover = t.hasAttribute('data-centro') ? [t, t.previousElementSibling] : [t];
    var bb = t.getBBox(), c0 = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, p0 = puntoSvg(svg, ev), movido = false;
    /* Dónde queda, ya imantado a la grilla y a las paredes (lo mismo mientras se mueve y al soltar). */
    /* La mitad de lo que se mueve (lo del centro queda de 46 × 70; lo fijo, de su tamaño), para que su borde y no su
       centro sea lo que se pegue a la pared. Un eje que casi no se movió queda como estaba. */
    var mitadX = (t.hasAttribute('data-fijo') ? bb.width / 2 : 23) / caja[2], mitadY = (t.hasAttribute('data-fijo') ? bb.height / 2 : 35) / caja[3];
    var x0 = (c0.x - caja[0]) / caja[2], y0 = (c0.y - caja[1]) / caja[3];
    var lugar = function (p) {
      return { x: Math.abs(p.x - p0.x) < 3 ? entre01(x0) : imantarCroquis((c0.x + p.x - p0.x - caja[0]) / caja[2], mitadX),
               y: Math.abs(p.y - p0.y) < 3 ? entre01(y0) : imantarCroquis((c0.y + p.y - p0.y - caja[1]) / caja[3], mitadY) };
    };
    function mueve(e2) {
      var p = puntoSvg(svg, e2);
      if (!movido && Math.abs(p.x - p0.x) + Math.abs(p.y - p0.y) < 5) return;
      if (!movido) { cerrarBurbuja(); f.classList.add('arrastrando'); }
      movido = true;
      var tacho = sobreBandeja(e2);
      bandejaEl.classList.toggle('tacho-activo', tacho);
      var q = lugar(p), dx = caja[0] + q.x * caja[2] - c0.x, dy = caja[1] + q.y * caja[3] - c0.y;
      /* Levantado: un poco más grande y con sombra, centrado en su lugar. */
      mover.forEach(function (el) {
        if (!el) return;
        el.classList.add('levantado');
        el.classList.toggle('a-sacar', tacho);
        el.setAttribute('transform', 'translate(' + (dx + c0.x).toFixed(1) + ',' + (dy + c0.y).toFixed(1) + ') scale(1.06) translate(' + (-c0.x).toFixed(1) + ',' + (-c0.y).toFixed(1) + ')');
      });
    }
    function suelta(e2) {
      window.removeEventListener('pointermove', mueve); window.removeEventListener('pointerup', suelta); window.removeEventListener('pointercancel', suelta);
      f.classList.remove('arrastrando'); bandejaEl.classList.remove('tacho-activo');
      if (e2.type === 'pointercancel') { vista(); return; }
      if (!movido) {
        /* Un toque: su globito (el nombre, girarlo, sacarlo). */
        abrirBurbuja(t.hasAttribute('data-fijo') ? { en: en, tipo: 'fijo', k: +t.dataset.fijo }
                                                 : { en: en, tipo: 'centro', key: t.previousElementSibling && t.previousElementSibling.dataset.mod });
        return;
      }
      soltadoEn = Date.now();
      /* Soltado arriba de la caja de muebles: se saca (como tirarlo al tacho). */
      if (sobreBandeja(e2)) {
        if (t.hasAttribute('data-fijo')) fijosDe[en].splice(+t.dataset.fijo, 1);
        else { var kc = centroDe(t.previousElementSibling && t.previousElementSibling.dataset.mod); if (kc > -1) centro.splice(kc, 1); }
        vista();
        return;
      }
      var pos = lugar(puntoSvg(svg, e2)), cual = null;
      if (t.hasAttribute('data-fijo')) { var fx = fijosDe[en][+t.dataset.fijo]; if (fx) { fx.x = pos.x; fx.y = pos.y; } cual = '[data-fijo="' + t.dataset.fijo + '"]'; }
      else {
        var mod = t.previousElementSibling && t.previousElementSibling.dataset.mod;
        var c = centro.filter(function (x) { return x.key === mod; })[0];
        if (c) c.pos = pos;
        cual = '.mapa-mod[data-mod="' + mod + '"]';
      }
      vista();
      /* Al soltarla, rebota un poquito en su lugar nuevo. */
      var nuevo = cual && vistaEl.querySelector(cual);
      if (nuevo) nuevo.classList.add('mapa-rebota');
    }
    window.addEventListener('pointermove', mueve);
    window.addEventListener('pointerup', suelta);
    window.addEventListener('pointercancel', suelta);
  });

  }
  engancharAdentro(vistaS, 'salon');
  engancharAdentro(vistaD, 'deposito');

  /* Si la entrada no está puesta y hay algo fijo que dice "entrada" ("Puerta de entrada"), pasa a ser la entrada: así el
     1 es el módulo de al lado, hacia la izquierda (pedido de Mauricio: "desde la puerta hacia la izquierda, siempre el 1"). */
  if (st.salon.puerta.virtual) {
    VUELTA.some(function (w) {
      var i = st.salon.paredes[w].findIndex(function (l) { return l.t === 'h' && !l.k && /entrada/i.test(l.h || ''); });
      if (i < 0) return false;
      entradaFija = st.salon.paredes[w][i].h;
      st.salon.puerta = { pared: w, pos: i, a: null };
      sumarALaPuerta('salon', true);
      return true;
    });
  }
  /* Lo de recién (la entrada que se pone sola) no cuenta como un cambio: "Volver" pregunta sólo si tocaron algo. */
  firmaInicial = firma();

  /* ── Los botones y los campos ── */
  f.querySelector('#eCancelarCambio').onclick = function () { st.cambiar = null; vista(); };
  /* En el celular el dibujo queda arriba del panel: al empezar a mover la entrada (o a cambiar de lugar), sube hasta el
     dibujo (los + verdes), con el aviso a la vista. Dice si lo hizo. */
  function verDibujo(cambiando) {
    if (!(cambiando || st.mover) || !window.matchMedia || !matchMedia('(max-width: 860px)').matches) return false;
    var sc = f.querySelector('.ventana.editor'), dib = f.querySelector('.ed-dibujo'), cab = f.querySelector('.ed-cab');
    sc.scrollBy({ top: dib.getBoundingClientRect().top - sc.getBoundingClientRect().top - cab.offsetHeight, behavior: 'smooth' });
    return true;
  }
  f.querySelector('#eMoverPuerta').onclick = function () { st.mover = st.mover === 'salon' ? null : 'salon'; st.cambiar = null; vista(); verDibujo(); };
  f.querySelector('#eMoverPuertaDep').onclick = function () { st.mover = st.mover === 'deposito' ? null : 'deposito'; vista(); verDibujo(); };
  f.querySelectorAll('[data-ancho-puerta]').forEach(function (b) {
    b.onclick = function () {
      var q = b.dataset.anchoPuerta.split(':'), p = st[q[0]].puerta;
      if (!p || p.virtual) return;
      p.a = +q[1] > 1 ? +q[1] : null;
      vista();
    };
  });
  f.querySelector('#eAcomodar').onclick = function () { centro.forEach(function (c) { c.pos = null; }); vista(); };
  f.querySelectorAll('[data-pared]').forEach(function (i) {
    i.addEventListener('change', function () {
      if (i.value === '' || isNaN(parseInt(i.value, 10))) { vista(); return; }
      cambiarCantidad(i.dataset.pared, Math.max(0, Math.min(40, parseInt(i.value, 10))));
      vista();
    });
  });
  f.querySelector('#eForma').addEventListener('change', vista);
  function depCambio() {
    var i = f.querySelector('#eDep');
    var n = i.value === '' || isNaN(parseInt(i.value, 10)) ? ordenEditable(st.deposito).length : Math.max(0, Math.min(40, parseInt(i.value, 10)));
    rehacerDeposito(n, f.querySelector('#eFormaDep').value === 'cuadrado');
    vista();
  }
  f.querySelector('#eDep').addEventListener('change', depCambio);
  f.querySelector('#eFormaDep').addEventListener('change', depCambio);
  /* ── El globito de lo que se tocó en el dibujo: su nombre, girarlo, sacarlo ── */
  var burbuja = f.querySelector('#eBurbuja'), bandejaEl = f.querySelector('.ed-bandeja');
  var elegido = null;   // { en, tipo: 'centro', key } o { en, tipo: 'fijo', k }
  function centroDe(key) { for (var k = 0; k < centro.length; k++) if (centro[k].key === key) return k; return -1; }
  function elegidoEl() {
    if (!elegido) return null;
    var v = vistaDe(elegido.en);
    return elegido.tipo === 'fijo' ? v.querySelector('[data-fijo="' + elegido.k + '"]') : v.querySelector('.mapa-mod[data-mod="' + elegido.key + '"]');
  }
  function cerrarBurbuja() {
    elegido = null;
    burbuja.hidden = true;
    burbuja.innerHTML = '';
    f.querySelectorAll('.ed-elegido').forEach(function (el) { el.classList.remove('ed-elegido'); });
  }
  /** escribir: con el nombre listo para escribir encima (lo nuevo del centro, "otra cosa"). */
  function abrirBurbuja(sel, escribir) {
    var html, en = ' data-en="' + sel.en + '"';
    if (sel.tipo === 'centro') {
      var k = centroDe(sel.key), c = centro[k];
      if (!c) { cerrarBurbuja(); return; }
      html = '<b class="ed-burbuja-tit">Módulo ' + (ordenEditable(st.salon).length + k + 1) + ' · en el centro</b>' +
        '<input maxlength="40" data-isla="' + k + '" value="' + esc(c.nombre) + '" placeholder="Mesa, exhibidor, perchero…" aria-label="Nombre del módulo del centro">' +
        '<div class="ed-burbuja-ops">' + (c.pos ? '<button type="button" class="boton chico" data-suelta="' + k + '" title="Volver a la fila del medio">A la fila</button>' : '') +
        '<button type="button" class="boton chico" data-sacar="' + k + '">Sacar</button></div>';
    } else {
      var x = fijosDe[sel.en] && fijosDe[sel.en][sel.k];
      if (!x) { cerrarBurbuja(); return; }
      html = '<b class="ed-burbuja-tit">' + esc(PIEZAS[x.tipo].nombre) + '</b>' +
        '<input maxlength="40"' + en + ' data-fijo-nombre="' + sel.k + '" value="' + esc(x.nombre) + '" placeholder="' + esc(x.tipo === 'otro' ? 'Qué es (escribilo)' : 'Nombre (opcional)') +
          '" aria-label="' + esc(PIEZAS[x.tipo].nombre) + ': nombre">' +
        '<div class="ed-burbuja-ops"><button type="button" class="boton chico"' + en + ' data-girar="' + sel.k + '">Girar</button>' +
        '<button type="button" class="boton chico"' + en + ' data-sacar-fijo="' + sel.k + '">Sacar</button></div>';
    }
    elegido = sel;
    burbuja.innerHTML = '<button type="button" class="ed-burbuja-x" data-cerrar aria-label="Cerrar">×</button>' + html;
    posBurbuja();
    if (escribir) { var i = burbuja.querySelector('input'); if (i) { i.focus({ preventScroll: true }); i.select(); } }
  }
  /** Al lado de lo elegido (arriba; si no entra, abajo), sin salirse del dibujo. */
  function posBurbuja() {
    if (!elegido) return;
    var el = elegidoEl();
    if (!el || !el.getBoundingClientRect().width) { cerrarBurbuja(); return; }
    f.querySelectorAll('.ed-elegido').forEach(function (x) { if (x !== el) x.classList.remove('ed-elegido'); });
    el.classList.add('ed-elegido');
    burbuja.hidden = false;
    var caja = burbuja.parentNode.getBoundingClientRect(), r = el.getBoundingClientRect(), bw = burbuja.offsetWidth, bh = burbuja.offsetHeight;
    var x = r.left + r.width / 2 - caja.left - bw / 2, y = r.top - caja.top - bh - 10;
    if (y < 6) y = r.bottom - caja.top + 10;
    burbuja.style.left = Math.round(Math.max(6, Math.min(caja.width - bw - 6, x))) + 'px';
    burbuja.style.top = Math.round(Math.max(6, Math.min(caja.height - bh - 6, y))) + 'px';
  }
  burbuja.addEventListener('input', function (ev) {
    var t = ev.target, k, l;
    if (t.dataset.isla != null) { k = +t.dataset.isla; if (centro[k]) centro[k].nombre = t.value; }
    else if (t.dataset.fijoNombre != null) { l = fijosDe[t.dataset.en]; k = +t.dataset.fijoNombre; if (l && l[k]) l[k].nombre = t.value; }
    else return;
    vista();
  });
  burbuja.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); cerrarBurbuja(); } });
  burbuja.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b) return;
    var q = b.dataset, lista = q.en ? fijosDe[q.en] : null;
    if (q.cerrar != null) cerrarBurbuja();
    else if (q.sacar != null) { centro.splice(+q.sacar, 1); cerrarBurbuja(); vista(); }
    else if (q.suelta != null) { if (centro[+q.suelta]) centro[+q.suelta].pos = null; vista(); abrirBurbuja(elegido); }
    else if (q.girar != null && lista) {
      if (lista[+q.girar]) lista[+q.girar].vertical = !lista[+q.girar].vertical;
      vista();
      var el = elegidoEl();
      if (el) el.classList.add('mapa-rebota');
    } else if (q.sacarFijo != null && lista) { lista.splice(+q.sacarFijo, 1); cerrarBurbuja(); vista(); }
  });
  /* Tocar el dibujo fuera de lo elegido (o de otra cosa de adentro, que abre la suya) cierra el globito. */
  f.querySelector('.ed-dibujo').addEventListener('click', function (ev) {
    if (!elegido || burbuja.contains(ev.target) || (ev.target.closest && ev.target.closest('[data-centro], [data-fijo]'))) return;
    cerrarBurbuja();
  });
  /** ¿Lo están soltando arriba de la caja de muebles? (ahí se saca). */
  function sobreBandeja(ev) {
    var r = bandejaEl.getBoundingClientRect();
    return r.width > 0 && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }
  /** "Centro 1", "Centro 2"…: el primer nombre libre para uno nuevo (después se cambia). */
  function nombreLibre() {
    for (var k = centro.length + 1; ; k++) {
      var n = 'Centro ' + k;
      if (!centro.some(function (c) { return c.nombre.trim().toLowerCase() === n.toLowerCase(); })) return n;
    }
  }
  /** Un módulo nuevo en el centro: donde lo soltaron o, si tocaron la ficha, en la fila del medio. */
  function nuevoCentro(pos) {
    if (centro.length >= 30) { avisar('Como mucho 30 en el centro.'); return null; }
    var c = { key: 'nueva' + (++nuevas), id: null, nombre: nombreLibre(), antes: null, pos: pos || null };
    centro.push(c);
    vista();
    var g = vistaS.querySelector('.mapa-mod[data-mod="' + c.key + '"]');
    if (g) g.classList.add('mapa-rebota');
    return c;
  }
  f.querySelector('#eIslaMas').addEventListener('click', function () {
    if (Date.now() - piezaSoltadaEn < 500) return;
    var c = nuevoCentro(null);
    if (c) abrirBurbuja({ en: 'salon', tipo: 'centro', key: c.key }, true);
  });
  /* Los botones de a uno: cambian el desplegable escondido (y su "change" hace lo de siempre). */
  f.querySelectorAll('[data-tira]').forEach(function (t) {
    t.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-valor]'), s = f.querySelector('#' + t.dataset.tira);
      if (!b || s.value === b.dataset.valor) return;
      s.value = b.dataset.valor;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  /* − n +: uno más o uno menos (el lugar nuevo de la pared rebota). */
  f.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-paso]');
    if (!b) return;
    var i = b.parentNode.querySelector('input');
    i.value = String(Math.max(0, Math.min(40, (parseInt(i.value, 10) || 0) + +b.dataset.paso)));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    if (+b.dataset.paso > 0 && i.dataset.pared) {
      var ls = st.salon.paredes[i.dataset.pared], nv = vistaS.querySelector('[data-lugar="salon:' + i.dataset.pared + ':' + (ls.length - 1) + '"]');
      if (nv && nv.previousElementSibling) nv.previousElementSibling.classList.add('mapa-rebota');
    }
  });
  /** Un mueble nuevo: donde lo soltaron (pos) o, si lo tocaron, en un lugar libre (en el salón, a los costados del medio:
      por el medio va la fila de los del centro). */
  function agregarMueble(en, tipo, pos) {
    var lista = fijosDe[en];
    if (lista.length >= 30) { avisar('Como mucho 30 muebles.'); return; }
    if (!pos) {
      var lugares = [], xs = en === 'deposito' ? [0.5, 0.3, 0.7] : [0.25, 0.75, 0.12, 0.88, 0.38, 0.62], ys = en === 'deposito' ? [0.5, 0.3, 0.7] : [0.15, 0.3, 0.45, 0.6, 0.75, 0.88];
      xs.forEach(function (x) { ys.forEach(function (y) { lugares.push({ x: x, y: y }); }); });
      pos = lugares.filter(function (p) { return !lista.some(function (q) { return Math.abs(q.x - p.x) < 0.1 && Math.abs(q.y - p.y) < 0.09; }); })[0] || { x: 0.5, y: 0.5 };
    }
    lista.push({ nombre: '', tipo: tipo, x: pos.x, y: pos.y, vertical: false });
    vista();
    var dib = (en === 'deposito' ? vistaD : vistaS).querySelector('[data-fijo="' + (lista.length - 1) + '"]');
    if (dib) dib.classList.add('mapa-rebota');
    if (tipo === 'otro') abrirBurbuja({ en: en, tipo: 'fijo', k: lista.length - 1 }, true);
  }
  var piezaSoltadaEn = 0;
  f.querySelectorAll('#ePiezas, #ePiezasDep').forEach(function (bandeja) {
    bandeja.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-pieza]');
      if (!b || Date.now() - piezaSoltadaEn < 500) return;
      agregarMueble(b.dataset.en, b.dataset.pieza, null);
      if (b.dataset.pieza !== 'otro') avisar(PIEZAS[b.dataset.pieza].nombre + ': ya está en el local. Arrastrala adonde va.');
    });
    /* Agarrarla de la bandeja y llevarla al dibujo: se suelta donde va. */
    bandeja.addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-pieza], [data-nuevo]');
      if (!b || (ev.button && ev.button !== 0)) return;
      var en = b.dataset.en || 'salon', destino = en === 'deposito' ? vistaD : vistaS, x0 = ev.clientX, y0 = ev.clientY, fantasma = null;
      function mueve(e2) {
        if (!fantasma) {
          if (Math.abs(e2.clientX - x0) + Math.abs(e2.clientY - y0) < 8) return;
          fantasma = document.createElement('div');
          fantasma.className = 'pieza-fantasma';
          fantasma.innerHTML = b.dataset.nuevo ? iconoModulo() : iconoPieza(b.dataset.pieza);
          document.body.appendChild(fantasma);
        }
        e2.preventDefault();
        fantasma.style.left = e2.clientX + 'px';
        fantasma.style.top = e2.clientY + 'px';
        var sobre = document.elementFromPoint(e2.clientX, e2.clientY);
        destino.classList.toggle('soltar-aca', !!(sobre && destino.contains(sobre)));
      }
      function suelta(e2) {
        window.removeEventListener('pointermove', mueve); window.removeEventListener('pointerup', suelta); window.removeEventListener('pointercancel', suelta);
        destino.classList.remove('soltar-aca');
        if (!fantasma) return;
        fantasma.remove();
        piezaSoltadaEn = Date.now();
        if (e2.type !== 'pointerup') return;
        var sobre = document.elementFromPoint(e2.clientX, e2.clientY), svg = sobre && destino.contains(sobre) && destino.querySelector('svg.mapa-svg');
        if (!svg) { avisar('Soltala arriba del dibujo' + (en === 'deposito' ? ' del depósito.' : ' del salón.')); return; }
        var caja = (svg.getAttribute('data-adentro') || '').split(' ').map(Number), p = puntoSvg(svg, e2), t = b.dataset.nuevo ? { w: 46, h: 70 } : tamanoPieza(b.dataset.pieza, false);
        var pos = { x: imantarCroquis((p.x - caja[0]) / caja[2], t.w / 2 / caja[2]), y: imantarCroquis((p.y - caja[1]) / caja[3], t.h / 2 / caja[3]) };
        if (b.dataset.nuevo) nuevoCentro(pos); else agregarMueble(en, b.dataset.pieza, pos);
      }
      window.addEventListener('pointermove', mueve, { passive: false });
      window.addEventListener('pointerup', suelta);
      window.addEventListener('pointercancel', suelta);
    });
  });
  f.querySelector('#eFrente').addEventListener('change', vista);
  /** Un panel o dos: el que estaba sigue siendo el mismo (con su historia); "Vidriera" pasa a ser "Vidriera izq." y al revés. */
  function ponerVidriera(n) {
    var antes = vidr.slice(), nuevo = [];
    var tomar = function (prefs) {
      for (var i = 0; i < prefs.length; i++) {
        for (var k = 0; k < antes.length; k++) if (antes[k].nombre.trim().toLowerCase() === prefs[i].toLowerCase()) return antes.splice(k, 1)[0];
      }
      return null;
    };
    (NOMBRES_VIDRIERA[n] || []).forEach(function (nom) {
      var prefs = nom === 'Vidriera' ? ['Vidriera', 'Vidriera izq.', 'Vidriera der.'] : nom === 'Vidriera izq.' ? ['Vidriera izq.', 'Vidriera'] : ['Vidriera der.'];
      var v = tomar(prefs) || { key: 'vidriera' + (++nuevas), id: null, antes: null };
      v.nombre = nom;
      nuevo.push(v);
    });
    vidr = nuevo;
  }
  f.querySelector('#eVidriera').addEventListener('change', function (ev) { ponerVidriera(+ev.target.value); vista(); });
  vista();
  if (entradaFija) avisar('"' + entradaFija + '" pasó a ser la entrada: el 1 es el módulo de al lado, hacia la izquierda. Guardá para que quede así.');

  /* ── Guardar ── */
  unaVez(f.querySelector('#eGuardar'), function () {
    var mm = mapaArmado(), total = VUELTA.reduce(function (s, w) { return s + mm[w]; }, 0), vistos = {}, c = cambios();
    if (total > 100) { avisar('Entre todas las paredes, como mucho 100 módulos.'); return; }
    var llena = VUELTA.filter(function (w) { return mm[w] > 40; })[0];
    if (llena) { avisar(NOMBRE_PARED[llena] + ': como mucho 40 módulos por pared.'); return; }
    var islas = centro.map(function (q) { return q.nombre.trim(); });
    for (var k = 0; k < islas.length; k++) {
      var nom = islas[k], l = nom.toLowerCase();
      if (!nom) { avisar('Ponele nombre al módulo ' + (total + k + 1) + ' (el del centro).'); return; }
      if (esNombreVidriera(nom)) { avisar('"' + nom + '" es el nombre de la vidriera: usá otro para el del centro (la vidriera se elige a la derecha, en "Vidriera").'); return; }
      if (vistos[l]) { avisar('Hay dos en el centro que se llaman "' + nom + '": cambiale el nombre a uno.'); return; }
      vistos[l] = true;
    }
    vidr.forEach(function (v) { vistos[v.nombre.toLowerCase()] = true; });
    islas = islas.concat(vidr.map(function (v) { return v.nombre; }));
    if (fijos.some(function (x) { return x.tipo === 'otro' && !x.nombre.trim(); })) { avisar('Hay una "otra cosa" adentro sin nombre: escribí qué es o sacala.'); return; }
    /* Si sacás uno y le ponés su nombre a otro en la misma vez, la base no los distingue (van por nombre). */
    var choca = d.islas.filter(function (i) { return !centro.some(function (q) { return q.id === i.id; }) && !vidr.some(function (q) { return q.id === i.id; }) && vistos[i.nombre.trim().toLowerCase()]; })[0];
    if (choca) { avisar('"' + choca.nombre + '" lo estás sacando: guardá primero sin él y después usá ese nombre para otro.'); return; }
    var ojo = [];
    if (c.renumeran) ojo.push(c.renumeran + (c.renumeran === 1 ? ' módulo cambia' : ' módulos cambian') + ' de número. Siguen con su responsable y sus fotos; los vendedores los van a ver con el número nuevo.');
    if (c.apagan) ojo.push('Se apagan ' + c.apagan + (c.apagan === 1 ? ' módulo' : ' módulos') + ' (no se borran: quedan sus fotos).');
    if (ojo.length && !confirm(ojo.join('\n\n') + '\n\n¿Guardar igual?')) return;
    var ordS = ordenEditable(st.salon).map(function (x) { return x.id; }), ordD = ordenEditable(st.deposito).map(function (x) { return x.id; });
    /* A los del centro que les cambiaste el nombre, primero el nombre: así siguen siendo los mismos (con su responsable y sus fotos). */
    var renombrar = centro.concat(vidr).filter(function (q) { return q.id && q.nombre.trim() !== q.antes; });
    return renombrar.reduce(function (p, q) {
      return p.then(function () {
        return llamar('orden_modulo_nombre', { p_modulo: q.id, p_nombre: q.nombre.trim() }).then(function () { q.antes = q.nombre.trim(); });
      });
    }, Promise.resolve()).then(function () {
      return llamar('orden_croquis_guardar', { p_local: _local.id, p_mapa: mm, p_islas: islas, p_orden_salon: ordS, p_orden_deposito: ordD, p_croquis: croquisArmado() })
        .catch(function (e) {
          if (/orden_croquis_guardar|PGRST202|could not find the function/i.test(String(e && e.message))) throw rechazo('Falta correr el SQL 112 en Supabase (está en el Escritorio, en "App Orden"). Hasta entonces no se puede guardar el croquis.');
          throw e;
        });
    }).then(function (r) {
      cerrarEditor();
      avisar('Croquis guardado' + (r && r.creados ? ': ' + r.creados + (r.creados === 1 ? ' módulo nuevo.' : ' módulos nuevos.') : '.'));
      verLocal();
      if (op.alSalir) op.alSalir();
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   TAREAS (17/10/2026, "Crear tarea" en Ajustes; desde el 22/10, en el menú)
   Pedido de Mauricio: "una pestaña como la de recordatorio por día, pero que diga crear tarea, y que pueda
   seleccionar un local o todos los locales". A cada vendedor le llega la suya con un aviso, como cuando la manda
   el supervisor desde la app (orden_crear_tarea; queda con origen "admin"). Abajo, las que se mandaron desde acá:
   cuántas se hicieron, quién, y "Cancelar las que faltan".
   22/10 (SQL 159): con un local, la foto de un módulo o de la vidriera para todo el equipo ("que les aparezca a los
   3"): orden_crear_tarea_equipo. El aviso, a los que trabajan ese día; la primera foto la cierra para todos.
   22/10: pasó de Ajustes al menú ("es trabajo de todas las semanas, no un ajuste"); sigue siendo sólo del admin.
   ════════════════════════════════════════════════════════════════════════ */
var PLAZOS_TAREA = [['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Esta semana']];
function nombreLocal(id) { var l = _locales.filter(function (x) { return x.id === id; })[0]; return l ? l.nombre : '—'; }
function nombreVendedor(p) { return p.nombre + (p.inicial ? ' ' + p.inicial + '.' : ''); }

function verTareas() {
  var desde = new Date(Date.now() - 30 * 864e5).toISOString();
  Promise.all([
    leer('/orden_personas?select=id,nombre,apellido,inicial,local_id&rol=eq.vendedor&activo=is.true&aprobado=is.true&local_id=not.is.null&order=nombre.asc'),
    leer159('/orden_v_tareas?select=id,local_id,persona_nombre,titulo,estado,creado_en,completada_en,revisada_en,modulo_nombre,motivo_no_pude&origen=eq.admin&creado_en=gte.' + desde + '&order=creado_en.desc&limit=600')
  ]).then(function (r) {
    var cuerpo = document.getElementById('cuerpo');
    if (_solapa !== 'tareas' || !cuerpo) return;
    var porLocal = {};
    (r[0] || []).forEach(function (p) { (porLocal[p.local_id] = porLocal[p.local_id] || []).push(p); });
    var gente = function (id) { return porLocal[id] || []; };
    var varios = _locales.length > 1;
    cuerpo.innerHTML = '<div id="tareas"></div>';
    var z = cuerpo.firstChild;
    z.innerHTML = ('<p class="bajada">Una tarea para el equipo de un local, de varios o de todos. A cada vendedor le llega la suya con un aviso y la ve en Tareas de la app, ' +
        'como cuando la manda el supervisor. Si pide foto, se mira en Fotos → Tareas y se puede mandar a corregir. ' +
        'Con un solo local, puede ser la foto de un módulo o de la vidriera para todo el equipo: con que uno la mande, alcanza.</p>' +
      '<div class="seccion">Qué hay que hacer</div>' +
      '<div class="renglon ct-form"><label class="campo c-todo"><span>La tarea</span><input id="ctTitulo" maxlength="140" placeholder="Por ejemplo: renovar los frontales de tus módulos"></label>' +
      '<label class="campo c-todo"><span>Detalle (opcional)</span><textarea id="ctDetalle" rows="2" maxlength="600"></textarea></label>' +
      '<label class="campo c-medio"><span>Plazo</span><select id="ctPlazo">' +
        PLAZOS_TAREA.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === 'manana' ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="campo c-bool"><input type="checkbox" id="ctFoto" checked> Pide foto al terminarla (con la foto se ve que se hizo)</label></div>' +
      '<div class="seccion">Para qué locales</div><div class="renglon ct-bloque">' +
      (varios ? '<div class="imp-mapa-acc"><button class="boton chico" id="ctTodos">Todos los locales</button><button class="boton chico" id="ctNinguno">Ninguno</button></div>' : '') +
      '<div class="imp-locales">' + _locales.map(function (l) {
        var n = gente(l.id).length;
        return '<label class="imp-check' + (n ? '' : ' ct-sin') + '"><input type="checkbox" data-loc="' + esc(l.id) + '"' + (l.id === _local.id ? ' checked' : '') + '> <span>' + esc(l.nombre) +
               ' <small>' + (n ? n + (n === 1 ? ' persona' : ' personas') : 'nadie en la app') + '</small></span></label>';
      }).join('') + '</div>' +
      '<div id="ctQuien"></div></div>' +
      '<button class="boton lima" id="ctMandar" style="max-width:320px">Mandar la tarea</button>' +
      '<div class="seccion">Las que mandaste (últimos 30 días)</div><div id="ctMandadas"></div>');

    var marcados = function () { return [].filter.call(z.querySelectorAll('[data-loc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.loc; }); };
    /* La foto de un módulo para todo el equipo (SQL 159): sólo con un local. modulo: el elegido ({id, nombre}). */
    var mapas = {}, modulo = null;
    var tituloDe = function (md) { return md ? 'Mandá la foto: ' + md.nombre : ''; };
    var pintarEquipo = function () {
      var f = z.querySelector('#ctFoto'), ps = z.querySelector('#ctPersonas'), ayuda = z.querySelector('#ctEquipo');
      f.disabled = !!modulo;
      if (modulo) f.checked = true;
      if (ps) ps.hidden = !!modulo;
      if (ayuda) ayuda.remove();
      if (modulo && ps) {
        var loc = marcados()[0], n = gente(loc).length;
        ps.insertAdjacentHTML('afterend', '<p class="bajada" id="ctEquipo">Para todo el equipo de ' + esc(nombreLocal(loc)) + ' (' + n + (n === 1 ? ' persona' : ' personas') +
          '): les aparece a todos, el aviso les llega a los que trabajan ese día, y con que uno mande la foto de ' + esc(modulo.nombre) + ' queda hecha para todos.</p>');
      }
    };
    var pintarModulos = function (loc) {
      var caja = z.querySelector('#ctModuloCaja');
      (mapas[loc] = mapas[loc] || cargarMapa(loc)).then(function (d) {
        if (!caja.isConnected) return;
        if (!d.modulos.length) { caja.innerHTML = '<p class="bajada">' + esc(nombreLocal(loc)) + ' todavía no tiene el croquis armado: la tarea va para cada uno.</p>'; return; }
        var vids = d.islas.filter(esVidriera), salon = d.pared.concat(d.islas.filter(function (m) { return !esVidriera(m); }));
        var nombre = function (m) { return nombreModulo(m, d.sectorDe[m.sector_id], d); };
        var grupo = function (t, l) {
          return l.length ? '<optgroup label="' + t + '">' + l.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(nombre(m)) + '</option>'; }).join('') + '</optgroup>' : '';
        };
        caja.innerHTML = '<label class="campo c-medio"><span>De qué módulo</span><select id="ctModulo"><option value="">Ninguno: una tarea para cada uno</option>' +
          grupo(vids.length > 1 ? 'Vidrieras' : 'Vidriera', vids) + grupo('Salón', salon) + grupo('Depósito', d.dep) + '</select></label>';
        var sel = caja.querySelector('#ctModulo');
        sel.onchange = function () {
          var m = d.modulos.filter(function (x) { return x.id === sel.value; })[0], t = z.querySelector('#ctTitulo'), antes = tituloDe(modulo);
          modulo = m ? { id: m.id, nombre: nombre(m) } : null;
          /* Sin título (o con el que se armó solo para otro módulo): uno armado. */
          if (!t.value.trim() || t.value.trim() === antes) t.value = tituloDe(modulo);
          pintarEquipo();
        };
      }).catch(function () {
        delete mapas[loc];
        if (caja.isConnected) caja.innerHTML = '<p class="bajada">No se pudieron cargar los módulos: la tarea va para cada uno.</p>';
      });
    };
    /* Con un solo local se elige a quién (todos tildados) o un módulo para todo el equipo; con varios, le llega a todo el equipo de cada uno. */
    var quien = function () {
      var locs = marcados(), q = z.querySelector('#ctQuien');
      modulo = null;
      if (locs.length === 1) {
        var ps = gente(locs[0]);
        q.innerHTML = (ps.length ? '<div class="seccion">Foto de un módulo (opcional)</div><div id="ctModuloCaja"><p class="bajada">Cargando los módulos…</p></div>' : '') +
          '<div class="seccion">Para quién</div><div id="ctPersonas">' + (ps.length
          ? '<div class="imp-locales">' + ps.map(function (p) { return '<label class="imp-check"><input type="checkbox" data-persona="' + esc(p.id) + '" checked> ' + esc(nombreVendedor(p)) + '</label>'; }).join('') + '</div>'
          : '<p class="bajada">En ' + esc(nombreLocal(locs[0])) + ' todavía no hay nadie aprobado en la app: no le llegaría a nadie.</p>') + '</div>';
        if (ps.length) pintarModulos(locs[0]);
      } else if (locs.length) {
        var n = locs.reduce(function (s, id) { return s + gente(id).length; }, 0);
        q.innerHTML = '<p class="bajada">Le llega a todo el equipo de cada local: ' + (n ? n + (n === 1 ? ' persona.' : ' personas.') : 'en esos locales todavía no hay nadie aprobado en la app.') + '</p>';
      } else q.innerHTML = '';
      pintarEquipo();
    };
    z.querySelectorAll('[data-loc]').forEach(function (x) { x.onchange = quien; });
    if (varios) {
      var marcar = function (si) { z.querySelectorAll('[data-loc]').forEach(function (x) { x.checked = si; }); quien(); };
      z.querySelector('#ctTodos').onclick = function () { marcar(true); };
      z.querySelector('#ctNinguno').onclick = function () { marcar(false); };
    }
    quien();

    unaVez(z.querySelector('#ctMandar'), function () {
      var titulo = z.querySelector('#ctTitulo').value.trim(), locs = marcados();
      if (!titulo) { avisar('Escribí qué hay que hacer.'); return; }
      if (!locs.length) { avisar('Marcá al menos un local.'); return; }
      /* La foto de un módulo para todo el equipo (SQL 159). */
      if (modulo && locs.length === 1) {
        var k = gente(locs[0]).length;
        if (!confirm('¿Mandar «' + titulo + '» a todo el equipo de ' + nombreLocal(locs[0]) + ' (' + k + (k === 1 ? ' persona' : ' personas') + ')?\n\n' +
                     'Con que uno mande la foto de ' + modulo.nombre + ' queda hecha para todos.')) return;
        return llamar('orden_crear_tarea_equipo', { p_local: locs[0], p_modulo: modulo.id, p_titulo: titulo, p_detalle: z.querySelector('#ctDetalle').value.trim() || null,
                                                    p_plazo: z.querySelector('#ctPlazo').value })
          .then(function () {
            avisar('Listo: le aparece a todo el equipo de ' + nombreLocal(locs[0]) + '. El aviso les llega a los que trabajan hoy.');
            verTareas();
          }, function (e) {
            throw /schema cache|Could not find the function/i.test(mensajeDe(e)) ? rechazo('Falta actualizar el sistema (SQL 159) para las tareas de todo el equipo.') : e;
          });
      }
      var ids = locs.length === 1
        ? [].filter.call(z.querySelectorAll('[data-persona]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.persona; })
        : locs.reduce(function (a, id) { return a.concat(gente(id).map(function (p) { return p.id; })); }, []);
      if (!ids.length) {
        avisar(locs.length === 1 && gente(locs[0]).length ? 'Elegí para quién es.' : 'En ' + (locs.length === 1 ? 'ese local' : 'esos locales') + ' todavía no hay nadie aprobado en la app.');
        return;
      }
      var sinGente = locs.filter(function (id) { return !gente(id).length; });
      var donde = locs.length === 1 ? nombreLocal(locs[0]) : locs.length === _locales.length ? 'todos los locales' : locs.length + ' locales';
      if (!confirm('¿Mandar «' + titulo + '» a ' + ids.length + (ids.length === 1 ? ' persona' : ' personas') + ' de ' + donde + '?' +
                   (locs.length > 1 && sinGente.length ? '\n\n' + (sinGente.length === 1 ? 'Un local todavía no tiene' : sinGente.length + ' locales todavía no tienen') +
                     ' a nadie aprobado en la app: ahí no le llega a nadie.' : ''))) return;
      return llamar('orden_crear_tarea', { p_personas: ids, p_titulo: titulo, p_detalle: z.querySelector('#ctDetalle').value.trim() || null, p_modulo: null,
                                           p_plazo: z.querySelector('#ctPlazo').value, p_requiere_foto: z.querySelector('#ctFoto').checked })
        .then(function () {
          avisar('Listo: se la mandamos a ' + ids.length + (ids.length === 1 ? ' persona.' : ' personas.'));
          verTareas();
        });
    });
    dibujarMandadas(z.querySelector('#ctMandadas'), r[1] || []);
  }).catch(function (e) { error(e, verTareas); });
}

/** Las tareas mandadas desde acá, de a una por vez que se mandó (las de una misma vez tienen la misma hora exacta;
    las de todo el equipo, el mismo grupo). */
function dibujarMandadas(cont, lista) {
  var grupos = [], por = {};
  lista.forEach(function (t) {
    var k = t.grupo || t.titulo + '|' + t.creado_en;
    if (!por[k]) { por[k] = { titulo: t.titulo, creado_en: t.creado_en, equipo: !!t.grupo, modulo: t.modulo_nombre, tareas: [] }; grupos.push(por[k]); }
    por[k].tareas.push(t);
  });
  if (!grupos.length) { cont.innerHTML = '<div class="vacio">Todavía no mandaste tareas desde acá.</div>'; return; }
  var abierta = function (t) { return t.estado === 'pendiente' || t.estado === 'vencida'; };
  var comoVa = function (t) {
    if (t.estado === 'hecha') return 'la hizo el ' + diaMes(t.completada_en) + ' a las ' + hora(t.completada_en) + (tareaParaMirar(t) ? ' (para mirar)' : '');
    if (hechaPorOtro(t)) return t.motivo_no_pude.replace(/^La hizo/, 'la hizo');
    return { pendiente: 'todavía no', vencida: 'vencida', no_pude: 'no pudo', cancelada: 'cancelada' }[t.estado] || t.estado;
  };
  cont.innerHTML = grupos.map(function (g, i) {
    var cuenta = function (f) { return g.tareas.filter(f).length; };
    /* Las de todo el equipo: con que uno la haga, alcanza; las de los demás quedan "La hizo X" (no son canceladas). */
    var hechas = cuenta(function (t) { return t.estado === 'hecha'; }), mirar = cuenta(tareaParaMirar), faltan = cuenta(function (t) { return t.estado === 'pendiente'; }),
        vencidas = cuenta(function (t) { return t.estado === 'vencida'; }), nopudo = cuenta(function (t) { return t.estado === 'no_pude'; }),
        canceladas = cuenta(function (t) { return t.estado === 'cancelada' && !hechaPorOtro(t); });
    var locs = [];
    g.tareas.forEach(function (t) { var n = nombreLocal(t.local_id); if (locs.indexOf(n) < 0) locs.push(n); });
    var est = function (n, uno, varios, cl) { return n ? '<span class="est' + (cl ? ' ' + cl : '') + '">' + n + ' ' + (n === 1 ? uno : varios) + '</span>' : ''; };
    return '<div class="ct-mandada"><div class="ct-cab"><b>' + esc(g.titulo) + '</b><small>' +
        esc(diaMes(g.creado_en) + ' ' + hora(g.creado_en) + ' · ' + (locs.length > 3 ? locs.slice(0, 3).join(', ') + ' y ' + (locs.length - 3) + ' más' : locs.join(', ')) +
            (g.equipo ? ' · todo el equipo (' + g.tareas.length + ')' + (g.modulo ? ' · ' + g.modulo : '') : ' · ' + g.tareas.length + (g.tareas.length === 1 ? ' persona' : ' personas'))) + '</small></div>' +
      '<div class="ct-estados">' + est(hechas, 'hecha', 'hechas', 'listo') + est(mirar, 'para mirar', 'para mirar', 'sorpresa') + est(faltan, 'falta', 'faltan') +
        est(vencidas, 'vencida', 'vencidas', 'vencido') + est(nopudo, 'no pudo', 'no pudieron', 'corregir') + est(canceladas, 'cancelada', 'canceladas') + '</div>' +
      '<details><summary>Ver quién</summary><ul>' + g.tareas.map(function (t) {
        return '<li>' + esc((t.persona_nombre || '—') + ' (' + nombreLocal(t.local_id) + '): ' + comoVa(t)) + '</li>';
      }).join('') + '</ul></details>' +
      (faltan + vencidas ? '<div class="ct-acc"><button class="boton chico" data-cancelar-grupo="' + i + '">Cancelar las que faltan</button></div>' : '') + '</div>';
  }).join('');
  cont.querySelectorAll('[data-cancelar-grupo]').forEach(function (b) {
    unaVez(b, function () {
      var abiertas = grupos[+b.dataset.cancelarGrupo].tareas.filter(abierta);
      if (!confirm(abiertas.length === 1 ? '¿Cancelar la que todavía no se hizo? Le desaparece de Tareas.' : '¿Cancelar las ' + abiertas.length + ' que todavía no se hicieron? Les desaparece de Tareas.')) return;
      return abiertas.reduce(function (p, t) {
        return p.then(function () { return llamar('orden_cancelar_tarea', { p_tarea: t.id, p_motivo: 'La canceló Administración' }); });
      }, Promise.resolve()).then(function () {
        avisar(abiertas.length === 1 ? 'Listo: cancelada.' : 'Listo: ' + abiertas.length + ' canceladas.');
        verTareas();
      });
    });
  });
}
