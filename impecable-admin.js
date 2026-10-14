/**
 * Equipo VDH (antes "Impecable") · la administración (impecable-admin.html).
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

/* ════════════════════════════════════════════════════════════════════════
   ENTRADA
   ════════════════════════════════════════════════════════════════════════ */

function pantallaSinSesion(mensaje) {
  app.innerHTML = '<div class="imp-entrar"><h2>Entrá con tu PIN</h2>' +
    '<p>' + esc(mensaje || 'Equipo VDH usa su propia entrada: elegí "Administrador" (o tu local), tu nombre y tu PIN. Queda guardada en esta computadora.') + '</p>' +
    '<a class="boton lima enlace-boton" href="vendedores.html#/admin">Entrar a Equipo VDH</a></div>';
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
               ['orden', 'Por vendedor', 'Cada vendedor, semana a semana'],
               ['cajas', 'Cajas', 'Como la planilla del control diario'],
               ['testigo', 'Productos testigo', 'Lo que se cuenta cada semana'],
               ['ajustes', 'Ajustes', 'La gente, los sectores y módulos, los horarios y las reglas']];
var _solapa = 'panorama';
function svgMenu(k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONO_MENU[k] + '</svg>';
}
var _locales = [];
var _local = null;
var K_LOCAL_SUP = 'vdh_vend_local_sup';

(function () {
  var b = document.getElementById('btnRefrescar');
  if (b) b.onclick = function () { if (_vend && _vend.refresco && esSupervision() && _locales.length) ir(_solapa); else inicio(); };
})();

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
    if (_solapa === 'ajustes' && !esAdmin()) _solapa = 'panorama';
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
  var solapas = SOLAPAS.filter(function (x) { return x[0] !== 'ajustes' || esAdmin(); });
  var actual = SOLAPAS.filter(function (x) { return x[0] === _solapa; })[0] || SOLAPAS[0];
  /* El local se elige en todo salvo en el Panorama, que es de todos. */
  var conLocal = _solapa !== 'panorama' && _locales.length > 1;
  return '<div class="imp-grid"><nav class="imp-menu" aria-label="Equipo VDH"><div class="imp-menu-cab">Equipo VDH</div>' +
    solapas.map(function (x) {
      return '<button class="imp-item' + (x[0] === _solapa ? ' activa' : '') + '" data-solapa="' + x[0] + '">' + svgMenu(x[0]) + esc(x[1]) + '</button>';
    }).join('') +
    '<div class="imp-menu-pie"><div class="imp-quien"><b>' + esc(per.nombre || '') + '</b>' + esc(ROL[per.rol] || '') + '</div>' +
      '<a class="imp-item" href="vendedores.html">' + svgMenu('app') + 'Abrir la app</a>' +
      '<button class="imp-item" id="salir">' + svgMenu('salir') + 'Salir</button></div></nav>' +
    '<section class="imp-cuerpo"><div class="imp-cab"><div><h2>' + esc(actual[0] === 'local' && _local ? _local.nombre : actual[1]) + '</h2>' +
      '<span class="imp-sub">' + esc(actual[2]) + '</span></div><div class="imp-cab-der">' +
      (conLocal ? '<select class="imp-sel" id="selLocal" aria-label="Local">' + _locales.map(function (l) {
        return '<option value="' + esc(l.id) + '"' + (_local && l.id === _local.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
      }).join('') + '</select>' : '') + '</div></div>' +
    (soloMira() ? '<div class="nota">Entraste como gerencia: ves todo y no se puede cambiar nada.</div>' : '') +
    '<div id="cuerpo"><p class="cargando">Cargando…</p></div></section></div>';
}

function ir(solapa) {
  _solapa = solapa;
  try { history.replaceState(null, '', location.pathname + '#' + solapa); } catch (e) {}
  app.innerHTML = cabezaAdmin();
  var s = document.getElementById('selLocal');
  if (s) s.onchange = function () { elegirLocal(s.value); ir(_solapa); };
  document.getElementById('salir').onclick = function () {
    if (!confirm('¿Salir? Para volver a entrar hace falta el PIN.')) return;
    cerrarSesion();
    pantallaSinSesion('Saliste. Para volver, entrá de nuevo con tu PIN.');
  };
  app.querySelectorAll('[data-solapa]').forEach(function (b) { b.onclick = function () { ir(b.dataset.solapa); }; });
  asomarMenu();
  if (!_local) { document.getElementById('cuerpo').innerHTML = '<div class="vacio">No hay locales cargados.</div>'; return; }
  ({ panorama: verPanorama, local: verLocal, fotos: verFotos, orden: verOrden, cajas: verCajas, testigo: verTestigo, ajustes: verAjustes })[solapa]();
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
function estNivel(n) { return n ? '<span class="est nivel-' + esc(n) + '">' + esc(NIVEL[n]) + '</span>' : '<span class="est">Sin fotos</span>'; }

var _panSemanas = 4, _panOrden = 'alfa';   // con 4 entra todo en la PC del local; 8 y 12 se deslizan
function verPanorama() {
  var semanas = [];
  for (var i = _panSemanas - 1; i >= 0; i--) semanas.push(sumarDias(lunesAR(), -7 * i));
  var desde = semanas[0], esta = semanas[semanas.length - 1], pasada = semanas[semanas.length - 2];
  Promise.all([
    leer('/orden_v_persona_semana?select=local_id,semana,controles,controles_a_tiempo,controles_tarde,controles_vencidos,puntos,nivel_semana&semana=gte.' + desde),
    leer('/orden_v_estado_local?select=local_id,modulo_id,tareas_abiertas,sin_foto_reciente'),
    leer('/orden_v_por_revisar?select=id,local_id'),
    leer('/orden_v_cajas?select=local_id,fecha,estado,alertas&fecha=gte.' + desde)
  ]).then(function (r) {
    if (_solapa !== 'panorama') return;
    var por = {};
    _locales.forEach(function (l) { por[l.id] = { l: l, sem: {}, tot: grupoVacio(), mods: 0, sinFoto: 0, tareas: 0, revisar: 0, cajasDif: 0 }; });
    var cadena = {}; cadena[esta] = grupoVacio(); cadena[pasada] = grupoVacio();
    (r[0] || []).forEach(function (f) {
      var x = por[f.local_id]; if (!x) return;
      sumarSemana(x.sem[f.semana] || (x.sem[f.semana] = grupoVacio()), f);
      sumarSemana(x.tot, f);
      if (cadena[f.semana]) sumarSemana(cadena[f.semana], f);
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
      '<div class="kpi' + (t.cajas ? ' es-mal' : '') + '"><div class="kpi-n">' + t.cajas + '</div><div class="kpi-l">Cajas con diferencia</div><div class="kpi-pie">En las últimas ' + _panSemanas + ' semanas</div></div>' +
      '<div class="kpi"><div class="kpi-n">' + conMods + '<small> de ' + lista.length + '</small></div><div class="kpi-l">Locales con módulos cargados</div><div class="kpi-pie">Los otros todavía no generan controles</div></div>' +
      '</div>' +
      '<div class="imp-filtros"><div class="solapas">' + [4, 8, 12].map(function (n) {
        return '<button data-pan-sem="' + n + '" class="' + (n === _panSemanas ? 'activa' : '') + '">' + n + ' semanas</button>';
      }).join('') + '</div><div class="solapas">' + [['alfa', 'Alfabético'], ['nivel', 'Por nivel']].map(function (o) {
        return '<button data-pan-orden="' + o[0] + '" class="' + (o[0] === _panOrden ? 'activa' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';

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
    if (!lista.length) html += '<div class="vacio">Todavía ningún local tiene módulos cargados: se cargan en Ajustes → Sectores y módulos.</div>';
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
            return '<td class="sem">' + estNivel(nivelDeGrupo(g)) + '<small>' + pct(g.ca, g.r) + '% a tiempo</small></td>';
          }).join('') +
          '<td class="n">' + (a == null ? '—' : a + '%') + '</td><td class="n">' + (x.revisar || '—') + '</td><td class="n">' + (x.tareas || '—') + '</td>' +
          '<td class="n' + (x.cajasDif ? ' rojo' : '') + '">' + (x.cajasDif || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (lista.length) html += '<p class="bajada" style="margin-top:10px">Cada casillero es una semana (desde el lunes): el nivel y, de los controles ya hechos, cuántos llegaron a tiempo. Tocá un local para ver sus módulos y sus fotos.</p>';
    if (sinMods.length) html += '<div class="nota imp-sin-mods">Todavía sin módulos (no generan controles): ' + sinMods.map(function (x) {
        return '<button class="imp-enlace" data-ir="' + esc(x.l.id) + '">' + esc(x.l.nombre) + '</button>';
      }).join(', ') + '. Se cargan en Ajustes → Sectores y módulos.</div>';
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    c.querySelectorAll('[data-pan-sem]').forEach(function (b) { b.onclick = function () { _panSemanas = +b.dataset.panSem; verPanorama(); }; });
    c.querySelectorAll('[data-pan-orden]').forEach(function (b) { b.onclick = function () { _panOrden = b.dataset.panOrden; verPanorama(); }; });
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
    [0, 50, 100].map(function (p) { return '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="rgba(255,255,255,.12)"/><text x="' + (x0 - 8) + '" y="' + (Y(p) + 4) + '" fill="#B8B2A7" font-size="11" text-anchor="end">' + p + '%</text>'; }).join('') +
    tramos.map(function (t) { return '<polyline points="' + t.join(' ') + '" fill="none" stroke="#F4F2EC" stroke-width="2.2" stroke-linejoin="round"/>'; }).join('') +
    puntos.map(function (p) { return p ? '<circle cx="' + X(p.j).toFixed(1) + '" cy="' + Y(p.p).toFixed(1) + '" r="6" fill="' + (COLOR_NIVEL[p.n] || '#8A857C') + '" stroke="#0A0A09" stroke-width="2"><title>' + esc((p.n ? NIVEL[p.n] : 'Sin fotos') + ' · ' + p.p + '% a tiempo') + '</title></circle>' : ''; }).join('') +
    semanas.map(function (w, j) { return '<text x="' + X(j).toFixed(1) + '" y="' + (H - 10) + '" fill="#B8B2A7" font-size="11" text-anchor="middle">' + esc(diaMes(w)) + '</text>'; }).join('') +
    '</svg>';
  return '<div class="imp-grafico"><h3>Semana a semana: controles a tiempo y nivel</h3>' + svg +
    '<div class="imp-ley">' + NIVELES.slice().reverse().map(function (n) { return '<span><i style="background:' + COLOR_NIVEL[n] + '"></i>' + esc(NIVEL[n]) + '</span>'; }).join('') + '</div></div>';
}

/* ════════════════════════════════════════════════════════════════════════
   FOTOS: las de los controles, con lo que dijo la IA
   ════════════════════════════════════════════════════════════════════════ */

var _fotoDias = 7, _fotoNivel = '', _fotoQuien = '';
function verFotos() {
  var L = valor(_local.id);
  var desde = sumarDias(hoyAR(), -(_fotoDias - 1));
  leer('/orden_v_controles?select=id,fecha,tipo,estado,modulo_numero,modulo_nombre,sector_tipo,persona_nombre,foto_path,tomada_en,nivel,nivel_ia,nivel_final,nivel_declarado,ia_resultado,a_tiempo,comentario' +
       '&local_id=eq.' + L + '&foto_path=not.is.null&fecha=gte.' + desde + (_fotoNivel ? '&nivel=eq.' + _fotoNivel : '') + '&order=tomada_en.desc&limit=150')
    .then(function (fotos) {
      if (_solapa !== 'fotos') return;
      fotos = fotos || [];
      var quienes = fotos.map(function (f) { return f.persona_nombre; }).filter(function (q, i, a) { return q && a.indexOf(q) === i; }).sort();
      if (_fotoQuien && quienes.indexOf(_fotoQuien) < 0) _fotoQuien = '';
      var vistas = fotos.filter(function (f) { return !_fotoQuien || f.persona_nombre === _fotoQuien; });
      var html = '<div class="imp-filtros"><div class="solapas">' + [[7, 'Última semana'], [14, '2 semanas'], [30, 'Un mes']].map(function (o) {
          return '<button data-foto-dias="' + o[0] + '" class="' + (o[0] === _fotoDias ? 'activa' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div><div class="solapas">' + [['', 'Todos los niveles']].concat(NIVELES.slice().reverse().map(function (n) { return [n, NIVEL[n]]; })).map(function (o) {
          return '<button data-foto-nivel="' + o[0] + '" class="' + (o[0] === _fotoNivel ? 'activa' : '') + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div>' +
        (quienes.length > 1 ? '<select class="imp-sel" id="fotoQuien" aria-label="Quién"><option value="">Todos</option>' + quienes.map(function (q) {
          return '<option' + (q === _fotoQuien ? ' selected' : '') + '>' + esc(q) + '</option>';
        }).join('') + '</select>' : '') + '</div>';
      if (!vistas.length) html += '<div class="vacio">No hay fotos en este período' + (_fotoNivel ? ' con ese nivel' : '') + '.</div>';
      else html += '<p class="bajada">' + vistas.length + (vistas.length === 1 ? ' foto' : ' fotos') + '. Tocá una para verla grande.</p><div class="imp-fotos">' + vistas.map(function (f, i) {
        var distinta = f.nivel_ia && f.nivel && f.nivel_ia !== f.nivel;
        return '<button class="imp-foto" data-i="' + i + '"><img data-foto="' + esc(f.foto_path) + '" alt=""><b>' + esc(f.modulo_nombre) + '</b>' +
          '<div class="info">' + estNivel(f.nivel) + (distinta ? '<span class="est">IA: ' + esc(NIVEL[f.nivel_ia]) + '</span>' : '') + (f.estado === 'enviado' ? '<span class="est sorpresa">Sin revisar</span>' : '') + '</div>' +
          '<small>' + esc(diaMes(f.fecha) + ' · ' + (f.persona_nombre || '') + (f.tipo === 'sorpresa' ? ' · sorpresa' : '') + (f.a_tiempo === false ? ' · tarde' : '')) + '</small></button>';
      }).join('') + '</div>';
      var c = document.getElementById('cuerpo');
      c.innerHTML = html;
      cargarFotos(c);
      c.querySelectorAll('[data-foto-dias]').forEach(function (b) { b.onclick = function () { _fotoDias = +b.dataset.fotoDias; verFotos(); }; });
      c.querySelectorAll('[data-foto-nivel]').forEach(function (b) { b.onclick = function () { _fotoNivel = b.dataset.fotoNivel; verFotos(); }; });
      var q = document.getElementById('fotoQuien');
      if (q) q.onchange = function () { _fotoQuien = q.value; verFotos(); };
      c.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { verFoto(vistas[+b.dataset.i]); }; });
    }).catch(function (e) { error(e, verFotos); });
}

function verFoto(f) {
  var ia = f.ia_resultado || {};
  var hall = (ia.hallazgos || []).filter(function (h) { return h && h.titulo; });
  ventana('<h1>' + esc(f.modulo_nombre) + '</h1><p class="bajada">' + esc(diaMes(f.fecha) + ' · ' + (f.persona_nombre || '') + ' · ' + ({ programado: 'control', sorpresa: 'sorpresa', deposito: 'depósito', correccion: 'corrección' }[f.tipo] || f.tipo)) + '</p>' +
    '<img class="foto-grande" data-foto="' + esc(f.foto_path) + '" alt="">' +
    '<div class="seccion">Los niveles</div><p class="bajada">' +
      'Final: ' + estNivel(f.nivel) +
      (f.nivel_ia ? ' &nbsp; IA: ' + estNivel(f.nivel_ia) : '') +
      (f.nivel_declarado ? ' &nbsp; El vendedor: ' + estNivel(f.nivel_declarado) : '') + '</p>' +
    (hall.length ? '<div class="seccion">Lo que vio la IA</div><ul>' + hall.map(function (h) { return '<li>' + esc(h.titulo) + (h.gravedad === 'sugerencia' ? ' (sugerencia)' : '') + '</li>'; }).join('') + '</ul>' : '') +
    (f.comentario ? '<div class="seccion">La supervisión</div><div class="nota">' + esc(f.comentario) + '</div>' : ''));
}

/* ════════════════════════════════════════════════════════════════════════
   CÓMO ESTÁ EL LOCAL
   ════════════════════════════════════════════════════════════════════════ */

function verLocal() {
  var L = valor(_local.id);
  Promise.all([
    leer('/orden_v_estado_local?select=*&local_id=eq.' + L + '&order=sector_tipo.desc,sector_numero.asc,modulo_numero.asc'),
    llamar('orden_resumen_semanal', { p_local: _local.id, p_semana: lunesAR() }).catch(function () { return null; }),
    leer('/orden_v_persona_semana?select=semana,controles,controles_a_tiempo,controles_tarde,controles_vencidos,puntos,nivel_semana&local_id=eq.' + L + '&semana=gte.' + sumarDias(lunesAR(), -49))
      .catch(function () { return []; }),
    cargarMapa(_local.id).catch(function () { return null; })
  ]).then(function (r) {
    if (_solapa !== 'local') return;
    var mods = r[0] || [], res = r[1] || {};
    var html = '<div class="numeros">' +
      '<div class="numero"><span>Nivel de la semana</span><b>' + esc(res.nivel_local || '—') + '</b></div>' +
      '<div class="numero"><span>Controles a tiempo</span><b>' + (res.controles ? res.controles_a_tiempo + ' de ' + res.controles : '—') + '</b></div>' +
      '<div class="numero"><span>Tareas pendientes</span><b>' + (res.tareas_pendientes != null ? res.tareas_pendientes : '—') + '</b></div>' +
      '<div class="numero"><span>Fotos sin revisar</span><b>' + (res.sin_revisar != null ? res.sin_revisar : '—') + '</b></div></div>';
    html += graficoLocal(r[2]);
    _mapaLocal = r[3];
    html += '<div id="zonaMapa"></div>';
    if (!mods.length) html += '<div class="vacio">Este local todavía no tiene módulos cargados. Se cargan en Ajustes → Sectores y módulos.</div>';
    [['salon', 'Salón'], ['deposito', 'Depósito']].forEach(function (g) {
      var lista = mods.filter(function (m) { return m.sector_tipo === g[0]; });
      if (!lista.length) return;
      html += '<div class="seccion">' + g[1] + '</div><div class="grilla-local">' + lista.map(function (m) {
        return '<button class="tarjeta-modulo' + (m.sin_foto_reciente ? ' gris' : '') + '" data-modulo="' + esc(m.modulo_id) + '">' +
          (m.foto_path ? '<img data-foto="' + esc(m.foto_path) + '" alt="">' : '<div class="sin-foto">Sin foto</div>') +
          '<b>' + esc(m.modulo_nombre) + '</b>' +
          '<div class="info">' + (m.nivel ? '<span class="est nivel-' + esc(m.nivel) + '">' + esc(NIVEL[m.nivel]) + '</span>' : '') +
          (m.tareas_abiertas ? '<span class="est corregir">' + m.tareas_abiertas + (m.tareas_abiertas == 1 ? ' tarea' : ' tareas') + '</span>' : '') + '</div>' +
          '<small>' + esc(haceDias(m.tomada_en) + (m.foto_de ? ' · ' + m.foto_de : '') + (m.responsable ? ' · a cargo de ' + m.responsable : '')) + '</small></button>';
      }).join('') + '</div>';
    });
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
  var cerrar = function () { f.remove(); };
  f.querySelector('#cerrarVentana').onclick = cerrar;
  f.onclick = function (e) { if (e.target === f) cerrar(); };
  cargarFotos(f);
  return f;
}

function verModulo(m) {
  leer('/orden_v_controles?select=id,foto_path,tomada_en,nivel,persona_nombre,tipo,estado&modulo_id=eq.' + valor(m.modulo_id) +
       '&foto_path=not.is.null&order=tomada_en.desc&limit=12').then(function (h) {
    ventana('<h1>' + esc(m.modulo_nombre) + '</h1><p class="bajada">' + esc((m.responsable ? 'A cargo de ' + m.responsable : '') + (m.tareas_abiertas ? ' · ' + m.tareas_abiertas + ' tareas abiertas' : '')) + '</p>' +
      (m.foto_path ? '<img class="foto-grande" data-foto="' + esc(m.foto_path) + '" alt="">' : '<div class="vacio">Todavía no hay fotos de este módulo.</div>') +
      ((h || []).length > 1 ? '<div class="seccion">Fotos anteriores (las que todavía se guardan)</div><div class="historia">' + h.slice(1).map(function (x) {
        return '<figure class="foto-chica"><img data-foto="' + esc(x.foto_path) + '" alt=""><figcaption>' + esc(diaMes(x.tomada_en) + ' · ' + (x.nivel ? NIVEL[x.nivel] : '—') + ' · ' + (x.persona_nombre || '')) + '</figcaption></figure>';
      }).join('') + '</div>' : ''));
  }).catch(function (e) { avisar(mensajeDe(e)); });
}

/* ════════════════════════════════════════════════════════════════════════
   ORDEN (las estadísticas)
   ════════════════════════════════════════════════════════════════════════ */

var _semanas = 4;
function verOrden() {
  var L = valor(_local.id);
  var desde = sumarDias(lunesAR(), -7 * (_semanas - 1));
  var desdeTs = new Date(desde + 'T00:00:00-03:00').toISOString();
  Promise.all([
    leer('/orden_v_persona_semana?select=*&local_id=eq.' + L + '&semana=gte.' + desde + '&order=semana.asc'),
    leer('/orden_controles?select=nivel_ia,nivel_final&local_id=eq.' + L + '&estado=eq.revisado&nivel_ia=not.is.null&revisado_en=gte.' + desdeTs),
    leer('/orden_v_personas?select=id,nombre,inicial,avisos_activos,ultima_foto&local_id=eq.' + L + '&activo=is.true&rol=eq.vendedor&order=nombre.asc'),
    leer('/orden_v_tareas?select=origen,estado&local_id=eq.' + L + '&creado_en=gte.' + desdeTs)
  ]).then(function (r) {
    if (_solapa !== 'orden') return;
    var filas = r[0] || [], ia = r[1] || [], gente = r[2] || [], tareas = r[3] || [];
    var semanas = [];
    for (var i = _semanas - 1; i >= 0; i--) semanas.push(sumarDias(lunesAR(), -7 * i));
    var por = {};
    filas.forEach(function (f) { (por[f.persona_id] = por[f.persona_id] || {})[f.semana] = f; });
    var puntos = { impecable: 4, bien: 3, a_mejorar: 2, fuera_de_estandar: 1 };
    var exactas = ia.filter(function (x) { return x.nivel_ia === x.nivel_final; }).length;
    var cerca = ia.filter(function (x) { return Math.abs(puntos[x.nivel_ia] - puntos[x.nivel_final]) <= 1; }).length;
    var origen = { ia: 0, supervisor: 0, admin: 0, sistema: 0 };
    tareas.forEach(function (t) { origen[t.origen] = (origen[t.origen] || 0) + 1; });
    var sinAvisos = gente.filter(function (p) { return !p.avisos_activos; });

    var html = '<div class="solapas chicas">' + [4, 8, 12].map(function (n) {
      return '<button data-semanas="' + n + '" class="' + (n === _semanas ? 'activa' : '') + '">' + n + ' semanas</button>';
    }).join('') + '</div>' +
      '<div class="numeros">' +
      '<div class="numero"><span>Cuánto acierta la IA (igual que el supervisor)</span><b>' + (ia.length ? Math.round(100 * exactas / ia.length) + '%' : '—') + '</b><span>' + (ia.length ? 'A un nivel o menos: ' + Math.round(100 * cerca / ia.length) + '% · ' + ia.length + ' fotos revisadas' : 'Todavía sin fotos revisadas') + '</span></div>' +
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
          return '<tr><td><b>' + esc(p.nombre + (p.inicial ? ' ' + p.inicial + '.' : '')) + '</b><br><a class="ver-app-admin" href="vendedores.html#/ver/' + esc(p.id) + '" target="_blank" rel="noopener">Ver su app</a></td>' + celdas +
            '<td class="n">' + pc(t.ca, t.c) + '</td><td class="n">' + pc(t.ta, t.t) + '</td><td class="n">' + (t.dt ? t.d + '/' + t.dt : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    c.querySelectorAll('[data-semanas]').forEach(function (b) { b.onclick = function () { _semanas = +b.dataset.semanas; verOrden(); }; });
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
function tarjetaCierre(cierre, tot, terminado, falta115) {
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
    txt = '<p class="cierre-quien">Se da por controlado cuando termine el mes, desde el 1/' + Number(mesSiguiente(_mes).slice(5)) + '.</p>';
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
  if (tot.dias_sin_cargar) avisos.push(n(tot.dias_sin_cargar, 'día quedó sin cargar', 'días quedaron sin cargar') + ': se puede cerrar igual (ya no se pueden cargar) y la observación lo dice.');
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
      .then(function () { f.remove(); avisar(nombreMes(_mes) + ' quedó controlado.'); verCajas(); });
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
      .then(function () { f.remove(); avisar(nombreMes(_mes) + ' quedó abierto otra vez.'); verCajas(); });
  });
}

function historiaMesCaja(cierre) {
  ventana('<h1>Historia de ' + esc(nombreMes(_mes).toLowerCase()) + '</h1><p class="bajada">' + esc(_local.nombre) + '</p>' +
    '<div class="cierre-historia">' + (cierre.historia || []).slice().reverse().map(function (x) {
      return '<div><b>' + (x.que === 'reabierto' ? 'Reabierto' : 'Controlado') + '</b><span>' + esc((x.por || 'Administración') + ' · ' + diaMes(x.en) + ' ' + hora(x.en)) + '</span><p>' + esc(x.texto || '') + '</p></div>';
    }).join('') + '</div>');
}

function verCajas() {
  var meses = mesesCajas(), hoyMes = meses[0];
  if (!_mes || meses.indexOf(_mes) < 0) _mes = hoyMes;
  /* Con "Todos los locales", el local de arriba no corresponde: se esconde. */
  var sel = document.getElementById('selLocal');
  if (sel) sel.style.visibility = _cajasTodos && _locales.length > 1 ? 'hidden' : '';
  if (_cajasTodos && _locales.length > 1) { verCajasTodos(meses); return; }
  var L = valor(_local.id);
  Promise.all([
    leer('/orden_v_cajas?select=*&local_id=eq.' + L + '&mes=eq.' + _mes + '&order=fecha.asc'),
    leer('/orden_v_cajas_mes?select=*&local_id=eq.' + L + '&mes=in.(' + meses.join(',') + ')'),
    leer('/orden_config?select=caja_activa&local_id=eq.' + L),
    leerCierres('/orden_v_cajas_meses?select=*&local_id=eq.' + L + '&mes=in.(' + meses.join(',') + ')')
  ]).then(function (r) {
    if (_solapa !== 'cajas' || _cajasTodos) return;
    var cajas = r[0] || [], porMes = {}, activa = !!(r[2] && r[2][0] && r[2][0].caja_activa), cierres = {};
    (r[1] || []).forEach(function (x) { porMes[x.mes] = x; });
    r[3].filas.forEach(function (x) { cierres[x.mes] = x; });
    var tot = porMes[_mes], cierre = cierres[_mes], terminado = _mes < hoyMes;
    var col = function (c, s, rl, dv) {
      return '<td class="n">' + pesos(c[s]) + '</td><td class="n">' + pesos(c[rl]) + '</td><td class="n' + (Math.abs(Number(c[dv] || 0)) > 0.5 ? ' rojo' : '') + '">' + pesos(c[dv]) + '</td>';
    };
    /* La marca de cada mes: ✓ controlado; un punto si terminó, tiene cajas y falta cerrarlo. */
    var marca = function (m) {
      if (cierres[m] && cierres[m].estado === 'controlado') return ' <i class="mes-ok" title="Controlado">✓</i>';
      if (m < hoyMes && porMes[m] && !r[3].falta) return ' <i class="mes-falta" title="Falta cerrar"></i>';
      return '';
    };
    var html = (activa ? '' : '<div class="nota">El control de caja está apagado en este local (se prende en Ajustes → Horarios y funciones).</div>') +
      (_locales.length > 1 ? '<div class="solapas chicas cajas-vista"><button data-vista="local" class="activa">' + esc(_local.nombre) + '</button><button data-vista="todos">Todos los locales</button></div>' : '') +
      '<div class="solapas chicas">' + meses.map(function (m) { return '<button data-mes="' + m + '" class="' + (m === _mes ? 'activa' : '') + '">' + m.slice(5) + '/' + m.slice(0, 4) + marca(m) + '</button>'; }).join('') + '</div>' +
      (tot ? '<div class="numeros"><div class="numero"><span>Días sin cargar</span><b>' + tot.dias_sin_cargar + '</b></div><div class="numero"><span>Sin controlar</span><b>' + tot.dias_sin_controlar + '</b></div><div class="numero"><span>Días con alertas</span><b>' + tot.dias_con_alertas + '</b></div><div class="numero"><span>Desvío del mes (efectivo)</span><b>' + pesos(tot.desvio_efectivo) + '</b></div></div>' : '') +
      tarjetaCierre(cierre, tot, terminado, r[3].falta);
    if (!cajas.length) html += '<div class="vacio">No hay cajas cargadas en este mes.</div>';
    else {
      html += '<div class="desliza"><table class="tabla-datos"><thead><tr><th rowspan="2">Día</th><th colspan="3">Mercado Pago</th><th colspan="3">Tarjeta</th><th colspan="3">Go Cuotas</th><th colspan="3">Efectivo</th><th rowspan="2">Estado</th></tr>' +
        '<tr>' + [1, 2, 3, 4].map(function () { return '<th class="n">Cierre</th><th class="n">Real</th><th class="n">Desvío</th>'; }).join('') + '</tr></thead><tbody>' +
        cajas.map(function (c) {
          return '<tr data-caja="' + esc(c.id) + '" style="cursor:pointer"><td><b>' + esc(diaMes(c.fecha)) + '</b></td>' +
            col(c, 'sis_mp', 'real_mp', 'desvio_mp') + col(c, 'sis_tarjeta', 'real_lote', 'desvio_tarjeta') + col(c, 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas') + col(c, 'sis_saldo_final_efvo', 'real_efectivo', 'desvio_efectivo') +
            '<td>' + (c.estado === 'controlada' ? '<span class="est listo">Controlada</span>' : c.estado === 'cargada' ? '<span class="est sorpresa">Sin controlar</span>' : '<span class="est pendiente">Sin cargar</span>') +
            ((c.alertas || []).length ? ' <span class="est vencido">' + c.alertas.length + '</span>' : '') + '</td></tr>';
        }).join('') +
        (tot ? '<tr><td><b>Total</b></td>' + col(tot, 'sis_mp', 'real_mp', 'desvio_mp') + col(tot, 'sis_tarjeta', 'real_lote', 'desvio_tarjeta') + col(tot, 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas') + col(tot, 'sis_efectivo', 'real_efectivo', 'desvio_efectivo') + '<td></td></tr>' : '') +
        '</tbody></table></div><p class="bajada" style="margin-top:8px">Desvío = lo que dice el cierre − lo real (positivo: falta plata). Tocá un día para ver las fotos.</p>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    c.querySelectorAll('[data-mes]').forEach(function (b) { b.onclick = function () { _mes = b.dataset.mes; verCajas(); }; });
    c.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { _cajasTodos = b.dataset.vista === 'todos'; verCajas(); }; });
    var bc = document.getElementById('cajaCerrar'), br = document.getElementById('cajaReabrir'), bh = document.getElementById('cajaHistoria');
    if (bc) bc.onclick = function () { cerrarMesCaja(cajas, tot); };
    if (br) br.onclick = reabrirMesCaja;
    if (bh) bh.onclick = function () { historiaMesCaja(cierre); };
    var porId = {};
    cajas.forEach(function (x) { porId[x.id] = x; });
    c.querySelectorAll('[data-caja]').forEach(function (tr) {
      tr.onclick = function () {
        var k = porId[tr.dataset.caja], f = k.fotos || {};
        ventana('<h1>Caja del ' + esc(diaMes(k.fecha)) + '</h1><p class="bajada">' + esc((k.cargada_por_nombre ? 'La cargó ' + k.cargada_por_nombre : '') + (k.controlada_por_nombre ? ' · la controló ' + k.controlada_por_nombre : '')) + '</p>' +
          ((k.alertas || []).length ? '<div class="nota alerta">' + k.alertas.map(function (a) { return esc(a.tipo === 'desvio' ? 'Diferencia en ' + a.campo + ': ' + pesos(a.monto) : a.tipo === 'no_coincide_foto' ? 'Un monto no coincide con la foto (' + a.campo + ')' : 'Foto de otro día (' + a.foto + ')'); }).join('<br>') + '</div>' : '') +
          (k.observaciones ? '<div class="nota">' + esc(k.observaciones) + '</div>' : '') + (k.nota_control ? '<div class="nota">Control: ' + esc(k.nota_control) + '</div>' : '') +
          (Object.keys(f).length ? '<div class="historia">' + Object.keys(f).map(function (t) { return '<figure class="foto-chica"><img data-foto="' + esc(f[t]) + '" alt=""><figcaption>' + esc(t) + '</figcaption></figure>'; }).join('') + '</div>' : '<div class="vacio">Sin fotos guardadas.</div>'));
      };
    });
  }).catch(function (e) { error(e, verCajas); });
}

/* Todos los locales en un mes: los desvíos y si está cerrado. Tocar uno abre sus días. */
function verCajasTodos(meses) {
  var hoyMes = meses[0];
  Promise.all([
    leer('/orden_v_cajas_mes?select=*&mes=eq.' + _mes),
    leerCierres('/orden_v_cajas_meses?select=*&mes=eq.' + _mes)
  ]).then(function (r) {
    if (_solapa !== 'cajas' || !_cajasTodos) return;
    var porLocal = {}, cierres = {}, terminado = _mes < hoyMes;
    (r[0] || []).forEach(function (x) { porLocal[x.local_id] = x; });
    r[1].filas.forEach(function (x) { cierres[x.local_id] = x; });
    var conCajas = _locales.filter(function (l) { return porLocal[l.id]; });
    var falta = terminado ? conCajas.filter(function (l) { return !(cierres[l.id] && cierres[l.id].estado === 'controlado'); }).length : 0;
    var efvo = conCajas.reduce(function (a, l) { return a + Number(porLocal[l.id].desvio_efectivo || 0); }, 0);
    var celda = function (t, k) { var d = Number(t[k] || 0); return '<td class="n' + (Math.abs(d) > 0.5 ? ' rojo' : '') + '">' + pesos(d) + '</td>'; };
    var html = '<div class="solapas chicas cajas-vista"><button data-vista="local">' + esc(_local.nombre) + '</button><button data-vista="todos" class="activa">Todos los locales</button></div>' +
      '<div class="solapas chicas">' + meses.map(function (m) { return '<button data-mes="' + m + '" class="' + (m === _mes ? 'activa' : '') + '">' + m.slice(5) + '/' + m.slice(0, 4) + '</button>'; }).join('') + '</div>' +
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
          var est = ci && ci.estado === 'controlado' ? '<span class="est listo">Controlado ✓</span>' : terminado ? '<span class="est sorpresa">Falta cerrar</span>' : '<span class="est">En curso</span>';
          return '<tr data-ir="' + esc(l.id) + '" style="cursor:pointer"><td><b>' + esc(l.nombre) + '</b></td>' + celda(t, 'desvio_mp') + celda(t, 'desvio_tarjeta') + celda(t, 'desvio_gocuotas') + celda(t, 'desvio_efectivo') +
            '<td class="n">' + Number(t.dias_sin_cargar || 0) + '</td><td class="n">' + Number(t.dias_sin_controlar || 0) + '</td><td>' + est + '</td></tr>';
        }).join('') +
        '</tbody></table></div><p class="bajada" style="margin-top:8px">Los desvíos del mes (cierre − real; positivo: falta plata). Tocá un local para ver sus días y darlo por controlado.</p>';
    }
    var c = document.getElementById('cuerpo');
    c.innerHTML = html;
    c.querySelectorAll('[data-mes]').forEach(function (b) { b.onclick = function () { _mes = b.dataset.mes; verCajas(); }; });
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
  return v;
}

function campoHTML(col, fila, soloLectura) {
  var v = valorCampo(col, fila);
  var dis = soloLectura || col.fijo ? ' disabled' : '';
  var clase = 'campo ' + (col.ancho ? 'c-' + col.ancho : col.tipo === 'bool' ? 'c-bool' : 'c-medio');
  if (col.tipo === 'ver') return '<div class="' + clase + '"><span>' + esc(col.t) + '</span><b>' + esc(col.ver ? col.ver(fila) : v) + '</b></div>';
  if (col.tipo === 'bool') return '<label class="' + clase + '"><input type="checkbox" data-k="' + col.k + '"' + (v ? ' checked' : '') + dis + '> ' + esc(col.t) + '</label>';
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

function leerCampo(col, renglon) {
  if (col.tipo === 'dias') {
    return [].map.call(renglon.querySelectorAll('.dias[data-k="' + col.k + '"] input:checked'), function (i) { return +i.value; }).sort();
  }
  var el = renglon.querySelector('[data-k="' + col.k + '"]');
  if (!el) return undefined;
  if (col.tipo === 'bool') return el.checked;
  var v = String(el.value);
  if (col.tipo === 'num') return v === '' ? null : Number(v);
  if (col.tipo === 'sel') return v === '' ? null : (col.numero ? Number(v) : v);
  if (col.tipo === 'texto' || col.tipo === 'hora' || col.tipo === 'color') { v = v.trim(); return v === '' && col.nulo ? null : v; }
  return v;
}

/** El valor de un campo llevado a una sola forma, para comparar el de la base con el de la pantalla. */
function normalizar(col, v) {
  if (col.tipo === 'bool') return !!v;
  if (col.tipo === 'dias') return (v || []).map(Number).sort();
  if (v == null || v === '') return col.tipo === 'num' || col.tipo === 'sel' || col.nulo ? null : '';
  if (col.tipo === 'num' || (col.tipo === 'sel' && col.numero)) return Number(v);
  if (col.tipo === 'hora') return String(v).slice(0, 5);
  return String(v);
}

/**
 * cfg: { cont, filas, cols, guardar(fila, cambios) → promesa, extra(fila) → html, accion(fila, nombre, boton) → promesa }
 */
function editor(cfg) {
  var sl = soloMira();
  cfg.cont.innerHTML = cfg.filas.map(function (f, i) {
    return '<div class="renglon" data-i="' + i + '">' + cfg.cols.map(function (c) { return campoHTML(c, f, sl); }).join('') +
      (sl ? '' : '<div class="acciones-renglon">' + (cfg.extra ? cfg.extra(f) : '') + '<button class="boton chico lima" data-guardar disabled>Guardar</button></div>') + '</div>';
  }).join('') || '<div class="vacio">' + esc(cfg.vacio || 'Todavía no hay nada cargado.') + '</div>';
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
        if (JSON.stringify(normalizar(col, nuevo)) !== JSON.stringify(normalizar(col, fila[col.k]))) c[col.k] = nuevo;
      });
      return c;
    };
    var marcar = function () { g.disabled = !Object.keys(cambios()).length; };
    r.addEventListener('input', marcar);
    r.addEventListener('change', function (e) {
      if (e.target.closest('.dias')) e.target.parentNode.classList.toggle('si', e.target.checked);
      marcar();
    });
    unaVez(g, function () {
      var c = cambios();
      if (!Object.keys(c).length) return 'dejar-apagado';
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

var _semanaTestigo = null;
function verTestigo() {
  _semanaTestigo = _semanaTestigo || lunesAR();
  var L = valor(_local.id), c = document.getElementById('cuerpo'), hoy = hoyAR();
  var semanas = [sumarDias(lunesAR(), 7)];
  for (var i = 0; i < 6; i++) semanas.push(sumarDias(lunesAR(), -7 * i));
  if (semanas.indexOf(_semanaTestigo) < 0) semanas.unshift(_semanaTestigo);
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
      if (_solapa !== 'testigo') return;
      dibujarTestigoAdmin(c, semanas, sem, todas, x[0] || [], x[1] || [], (x[2] || [])[0], hoy);
    });
  }).catch(function (e) { error(e, verTestigo); });
}

function dibujarTestigoAdmin(c, semanas, sem, todas, difs, items, quien, hoy) {
  var html = (soloMira() ? '' : '<div class="imp-mapa-acc"><button class="boton chico lima" id="programar">Programar un control</button></div>') +
    '<div class="solapas chicas">' + semanas.map(function (w) {
      return '<button data-semana="' + w + '" class="' + (w === _semanaTestigo ? 'activa' : '') + '">Semana del ' + diaMes(w) + '</button>';
    }).join('') + '</div>' +
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
        : s.fecha && s.fecha < hoy ? 'sin mandar (era el ' + diaMes(s.fecha) + ')' : s.fecha ? 'se cuenta el ' + diaYFecha(s.fecha) : 'sin día';
      var clase = s.cargada_en ? (conDif[s.id] ? 'mal' : 'bien') : s.fecha && s.fecha < hoy ? 'mal' : '';
      return '<button class="imp-testigo-local ' + clase + (s.local_id === _local.id ? ' actual' : '') + '" data-local="' + esc(s.local_id) + '"><b>' +
        esc(nombre[s.local_id] || 'Otro local') + '</b><small>' + esc(estado) + '</small></button>';
    }).join('') + '</div>';
  }

  html += '<div class="seccion">' + esc(_local.nombre) + '</div>';
  if (!sem) {
    /* Se arma con "Programar un control" (con su día: si no, el local no lo ve). */
    html += '<div class="vacio">' + esc(_local.nombre) + ' no tiene producto testigo esta semana.' +
      (soloMira() ? '' : ' Para armarlo, tocá "Programar un control".') + '</div>';
  } else {
    html += '<div class="nota">' + (sem.fecha ? 'Se cuenta el ' + esc(diaYFecha(sem.fecha)) + '. ' : '') +
      (sem.cargada_en ? 'Mandado' + (quien ? ' por ' + esc(nombreLista(quien)) : '') + ' el ' + esc(diaMes(sem.cargada_en)) + ' a las ' + esc(hora(sem.cargada_en)) + '.'
                      : 'El local todavía no lo mandó.') + (sem.cerrada ? ' Semana cerrada.' : '') + '</div>' +
      '<div id="itemsTestigo"></div>' +
      (soloMira() || sem.cerrada ? '' : '<button class="boton chico" id="agregarItem">Agregar un producto a ' + esc(_local.nombre) + '</button>');
    var conVideo = items.filter(function (f) { return f.video_path && !f.video_borrado; });
    if (conVideo.length) {
      html += '<div class="seccion">Videos</div><div class="imp-mapa-acc">' + conVideo.map(function (f) {
        return '<button class="boton chico" data-video="' + esc(f.id) + '">▶ ' + esc(f.item + ' · ' + f.producto + (f.color ? ' ' + f.color : '')) + '</button>';
      }).join('') + '</div>';
    }
    var borrados = items.filter(function (f) { return f.video_borrado; }).length;
    if (borrados) html += '<p class="bajada">' + borrados + (borrados === 1 ? ' video ya se borró' : ' videos ya se borraron') + ' (se guardan 14 días; los que dieron diferencia, 90).</p>';
  }
  c.innerHTML = html;

  c.querySelectorAll('[data-semana]').forEach(function (b) { b.onclick = function () { _semanaTestigo = b.dataset.semana; verTestigo(); }; });
  c.querySelectorAll('[data-local]').forEach(function (b) {
    b.onclick = function () { if (b.dataset.local !== _local.id) { elegirLocal(b.dataset.local); ir('testigo'); } };
  });
  var b = document.getElementById('programar');
  if (b) b.onclick = programarTestigo;
  if (!sem) return;
  editor({
    cont: document.getElementById('itemsTestigo'), filas: items, vacio: 'Todavía no hay productos en esta semana.',
    cols: [{ k: 'item', t: 'Ítem', tipo: 'num', ancho: 'chico' }, { k: 'producto', t: 'Producto', tipo: 'texto', ancho: 'grande' }, { k: 'color', t: 'Color', tipo: 'texto', nulo: true, ancho: 'chico' },
           { k: 'enviada', t: 'Enviada', tipo: 'num', ancho: 'chico' }, { k: 'stock_sistema', t: 'Stock sistema', tipo: 'num', ancho: 'chico' },
           { k: 'cantidad_real', t: 'Cantidad real', tipo: 'num', ancho: 'chico' }, { k: 'dev_fabrica', t: 'Dev. a fábrica', tipo: 'num', ancho: 'chico' },
           { k: 'salieron', t: 'Salieron', tipo: 'num', ancho: 'chico' }, { k: 'entraron', t: 'Entraron', tipo: 'num', ancho: 'chico' },
           { k: 'vendida', t: 'Vendida', tipo: 'num', ancho: 'chico' },
           { k: 'diferencia', t: 'Diferencia', tipo: 'ver', ver: function (f) { return textoDiferencia(f.diferencia) || '—'; } },
           { k: 'desvio', t: 'Desvío', tipo: 'ver', ver: function (f) { return textoDesvio(f.desvio) || '—'; } },
           { k: 'observacion', t: 'Observaciones', tipo: 'texto', nulo: true, ancho: 'grande' }],
    guardar: function (f, cambios) {
      /* Números enteros y no negativos, como en la app; vacío en dev/salieron/entraron es 0. */
      var malo = null;
      ['enviada', 'stock_sistema', 'cantidad_real', 'vendida', 'dev_fabrica', 'salieron', 'entraron'].forEach(function (k) {
        if (!(k in cambios)) return;
        if (cambios[k] == null) { if (['dev_fabrica', 'salieron', 'entraron'].indexOf(k) > -1) cambios[k] = 0; return; }
        if (!(Number.isInteger(cambios[k]) && cambios[k] >= 0 && cambios[k] <= 99999)) malo = malo || k;
      });
      if (malo) return Promise.reject(rechazo('En "' + ({ enviada: 'Enviada', stock_sistema: 'Stock sistema', cantidad_real: 'Cantidad real', vendida: 'Vendida',
        dev_fabrica: 'Dev. a fábrica', salieron: 'Salieron', entraron: 'Entraron' })[malo] + '" va un número entero, sin negativos.'));
      return guardarFila('/testigo_items?id=eq.' + valor(f.id), cambios).then(verTestigo);
    }
  });
  c.querySelectorAll('[data-video]').forEach(function (bv) {
    bv.onclick = function () { verVideoTestigo(items.filter(function (f) { return f.id === bv.dataset.video; })[0]); };
  });
  var a = document.getElementById('agregarItem');
  if (a) unaVez(a, function () {
    var n = items.reduce(function (m, x) { return Math.max(m, x.item); }, 0) + 1;
    /* Con día: como programarlo (si ya lo habían mandado, vuelve a quedar para cargar el nuevo). Una planilla vieja sin día, directo. */
    return (sem.fecha ? llamar('testigo_programar', { p_fecha: sem.fecha, p_locales: [_local.id], p_productos: [{ producto: 'Producto ' + n }] })
                      : escribir('/testigo_items', 'POST', { semana_id: sem.id, item: n, producto: 'Producto ' + n }))
      .then(function () { avisar('Agregado "Producto ' + n + '": cambiale el nombre y guardá.'); verTestigo(); });
  });
}

function verVideoTestigo(f) {
  if (!f) return;
  var v = ventana('<h1>' + esc(f.item + ' · ' + f.producto + (f.color ? ' ' + f.color : '')) + '</h1>' +
    '<p class="bajada">' + esc((f.video_subido_en ? 'Grabado el ' + diaMes(f.video_subido_en) + ' a las ' + hora(f.video_subido_en) + '. ' : '') +
      (f.stock_sistema != null && f.cantidad_real != null ? 'Sistema ' + f.stock_sistema + ', contaron ' + f.cantidad_real + ': ' + textoDiferencia(f.diferencia) + '.' : '')) + '</p>' +
    '<video class="imp-video" id="videoTestigo" controls playsinline></video><p class="bajada" id="videoEstado">Cargando el video…</p>');
  urlFirmadaEn(VIDEOS_TESTIGO, f.video_path).then(function (u) {
    var el = v.querySelector('#videoTestigo'), est = v.querySelector('#videoEstado');
    if (!el) return;
    if (u) { el.src = u; est.textContent = ''; } else est.textContent = 'No se pudo abrir el video (puede que ya se haya borrado).';
  });
}

/** "Este jueves se controlan estos productos": para todos los locales o los elegidos. */
function programarTestigo() {
  /* El ejemplo, sólo en el primero: en todos parecía que ya estaban cargados. */
  var fila = function (ejemplo) {
    return '<div class="renglon imp-prod"><label class="campo c-grande"><span>Producto</span><input data-p="producto" maxlength="80"' + (ejemplo ? ' placeholder="Por ejemplo: Last Chance"' : '') + '></label>' +
           '<label class="campo c-chico"><span>Color</span><input data-p="color" maxlength="30"' + (ejemplo ? ' placeholder="NE"' : '') + '></label></div>';
  };
  var varios = _locales.length > 1;
  var f = ventana('<h1>Programar un control</h1><p class="bajada">Elegí el día y los productos. A los locales que marques les aparece en la app (y el día antes les llega el aviso): ' +
      'no tienen que cargar los productos, sólo los números y el video.</p>' +
    '<div class="renglon"><label class="campo c-medio"><span>Día</span><input type="date" id="pFecha" value="' + sumarDias(hoyAR(), 1) + '"></label></div>' +
    '<div class="seccion">Productos</div><div id="pProds">' + fila(true) + fila() + fila() + fila() + '</div>' +
    '<button class="boton chico" id="pMas">Agregar otro producto</button>' +
    '<div class="seccion">Locales</div>' +
    (varios ? '<div class="imp-mapa-acc"><button class="boton chico" id="pTodos">Todos</button><button class="boton chico" id="pNinguno">Ninguno</button></div>' : '') +
    '<div class="imp-locales">' + _locales.map(function (l) {
      return '<label class="imp-check"><input type="checkbox" data-loc="' + esc(l.id) + '" checked> ' + esc(l.nombre) + '</label>';
    }).join('') + '</div>' +
    '<p class="bajada">Si a un local no le llegó un producto, destildalo acá y después cambiale el producto en su planilla.</p>' +
    '<button class="boton lima" id="pGuardar">Programar</button>');
  f.querySelector('#pMas').onclick = function () { f.querySelector('#pProds').insertAdjacentHTML('beforeend', fila()); };
  var marcar = function (si) { f.querySelectorAll('[data-loc]').forEach(function (x) { x.checked = si; }); };
  if (varios) {
    f.querySelector('#pTodos').onclick = function () { marcar(true); };
    f.querySelector('#pNinguno').onclick = function () { marcar(false); };
  }
  unaVez(f.querySelector('#pGuardar'), function () {
    var fecha = f.querySelector('#pFecha').value;
    var prods = [].map.call(f.querySelectorAll('.imp-prod'), function (r) {
      return { producto: r.querySelector('[data-p="producto"]').value.trim(), color: r.querySelector('[data-p="color"]').value.trim() };
    }).filter(function (p) { return p.producto; });
    var locales = [].filter.call(f.querySelectorAll('[data-loc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.loc; });
    if (!fecha) { avisar('Elegí el día.'); return; }
    if (!prods.length) { avisar('Escribí al menos un producto.'); return; }
    if (!locales.length) { avisar('Marcá al menos un local.'); return; }
    return llamar('testigo_programar', { p_fecha: fecha, p_locales: locales, p_productos: prods }).then(function (r) {
      f.remove();
      avisar('Listo: ' + prods.length + (prods.length === 1 ? ' producto' : ' productos') + ' en ' + r.locales + (r.locales === 1 ? ' local' : ' locales') +
             ' para el ' + diaYFecha(fecha) + '.');
      _semanaTestigo = lunesAR(fecha);
      verTestigo();
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   AJUSTES (sólo el administrador; la base no deja a nadie más)
   ════════════════════════════════════════════════════════════════════════ */

var SUBAJUSTES = [['personas', 'Personas'], ['sectores', 'Sectores y módulos'], ['recordatorios', 'Recordatorios por día'],
                  ['horarios', 'Horarios y funciones'], ['reglas', 'Reglas de orden'],
                  ['colores', 'Regla de colores'], ['tableros', 'Ideas (tableros)'], ['exhibidores', 'Exhibidores'], ['preguntas', 'Preguntas de los tests']];
var _sub = 'personas';

function verAjustes() {
  var c = document.getElementById('cuerpo');
  c.innerHTML = '<div class="solapas chicas">' + SUBAJUSTES.map(function (s) {
    return '<button data-sub="' + s[0] + '" class="' + (s[0] === _sub ? 'activa' : '') + '">' + s[1] + '</button>';
  }).join('') + '</div><div id="ajuste"><p class="cargando">Cargando…</p></div>';
  c.querySelectorAll('[data-sub]').forEach(function (b) { b.onclick = function () { _sub = b.dataset.sub; verAjustes(); }; });
  ({ personas: ajPersonas, recordatorios: ajRecordatorios, sectores: ajSectores, horarios: ajHorarios, reglas: ajReglas, colores: ajColores,
     tableros: ajTableros, exhibidores: ajExhibidores, preguntas: ajPreguntas })[_sub]();
}

function zonaAjuste(html) { var z = document.getElementById('ajuste'); z.innerHTML = html; return z; }
function errAjuste(e) { error(e, verAjustes); }

function ajPersonas() {
  var L = valor(_local.id);
  Promise.all([
    leer('/orden_personas?select=id,nombre,apellido,inicial,rol,local_id,dias_libres,telegram_chat_id,activo,aprobado,auth_user_id&or=(local_id.eq.' + L + ',local_id.is.null)&order=local_id.nullsfirst,nombre.asc'),
    leer('/orden_locales?select=id,nombre&order=nombre.asc')
  ]).then(function (r) {
    var gente = r[0] || [], locs = r[1] || [];
    var z = zonaAjuste('<p class="bajada">Las de ' + esc(_local.nombre) + ' y las que no tienen local (administración y gerencia). Para cambiar a alguien de local, elegí otro y guardá. "Borrar PIN": la próxima vez que entre, crea uno nuevo (y hay que volver a aprobarlo). "Aprobado": quien entra por primera vez no ve nada del local hasta que se lo aprueba (a los vendedores también los aprueba su supervisor desde la app).</p>' +
      '<div id="filasPersonas"></div><div class="seccion">Agregar a alguien</div><div class="renglon" id="nuevaPersona">' +
      campoHTML({ k: 'nombre', t: 'Nombre', tipo: 'texto' }, {}) + campoHTML({ k: 'apellido', t: 'Apellido', tipo: 'texto' }, {}) +
      campoHTML({ k: 'rol', t: 'Rol', tipo: 'sel', ops: [['vendedor', 'Vendedor'], ['supervisor', 'Supervisor'], ['gerencia', 'Gerencia'], ['admin', 'Administrador'], ['atencion', 'Atención al cliente']] }, { rol: 'vendedor' }) +
      campoHTML({ k: 'local_id', t: 'Local', tipo: 'sel', ops: [[null, 'Sin local']].concat(locs.map(function (l) { return [l.id, l.nombre]; })) }, { local_id: _local.id }) +
      '<div class="acciones-renglon"><button class="boton chico lima" id="agregarPersona">Agregar</button></div></div>');
    editor({
      cont: z.querySelector('#filasPersonas'), filas: gente,
      cols: [{ k: 'nombre', t: 'Nombre', tipo: 'texto' }, { k: 'apellido', t: 'Apellido', tipo: 'texto', nulo: true },
             { k: 'rol', t: 'Rol', tipo: 'sel', ops: [['vendedor', 'Vendedor'], ['supervisor', 'Supervisor'], ['gerencia', 'Gerencia'], ['admin', 'Administrador'], ['atencion', 'Atención al cliente']] },
             { k: 'local_id', t: 'Local', tipo: 'sel', ops: [[null, 'Sin local']].concat(locs.map(function (l) { return [l.id, l.nombre]; })) },
             { k: 'dias_libres', t: 'Francos', tipo: 'dias' }, { k: 'telegram_chat_id', t: 'Telegram (id)', tipo: 'texto', nulo: true },
             { k: 'activo', t: 'Activo', tipo: 'bool' }, { k: 'aprobado', t: 'Aprobado', tipo: 'bool' },
             { k: 'auth_user_id', t: 'Entró a la app', tipo: 'ver', ver: function (f) { return f.auth_user_id ? 'Sí' : 'Todavía no'; } }],
      guardar: function (f, c) {
        if ('apellido' in c) c.inicial = c.apellido ? c.apellido.charAt(0).toUpperCase() : null;
        /* Aprobar pasa por la base, como cuando aprueba el supervisor: a un
           vendedor además lo suma al equipo de la Carga de No Compra. */
        var aprobar = c.aprobado === true && f.aprobado === false;
        var resto = Object.assign({}, c);
        if (aprobar) delete resto.aprobado;
        var antes = Object.keys(resto).length ? guardarFila('/orden_personas?id=eq.' + valor(f.id), resto) : Promise.resolve();
        return antes.then(function () { if (aprobar) return llamar('orden_aprobar_persona', { p_persona: f.id, p_aprobar: true }); });
      },
      extra: function () { return '<button class="boton chico" data-accion="pin">Borrar PIN</button>'; },
      accion: function (f) {
        if (!confirm('¿Borrar el PIN de ' + f.nombre + '? La próxima vez que entre va a crear uno nuevo.')) return;
        return llamar('orden_pin_borrar', { p_persona: f.id }).then(function () { avisar('PIN borrado: la próxima vez crea uno nuevo.'); });
      }
    });
    unaVez(z.querySelector('#agregarPersona'), function () {
      var r2 = z.querySelector('#nuevaPersona');
      var nombre = String(r2.querySelector('[data-k=nombre]').value || '').trim(), apellido = String(r2.querySelector('[data-k=apellido]').value || '').trim();
      if (!nombre) { avisar('Falta el nombre.'); return; }
      var id = (crypto.randomUUID ? crypto.randomUUID() : null);
      if (!id) { avisar('Este navegador no puede agregar personas. Probá con Chrome.'); return; }
      var rol = r2.querySelector('[data-k=rol]').value, local = r2.querySelector('[data-k=local_id]').value || null;
      if (rol === 'vendedor' && !local) { avisar('Un vendedor tiene que tener local.'); return; }
      return escribir('/orden_personas', 'POST', { id: id, nombre: nombre, apellido: apellido || null, inicial: apellido ? apellido.charAt(0).toUpperCase() : null, rol: rol, local_id: local })
        .then(function () { return llamar('orden_pin_borrar', { p_persona: id }); })   // queda en la lista del login, para crear su PIN
        .then(function () { avisar(nombre + ' agregado: ya aparece en la app para crear su PIN.'); ajPersonas(); });
    });
  }).catch(errAjuste);
}

function ajSectores() {
  var L = valor(_local.id);
  Promise.all([
    leer('/orden_sectores?select=*&local_id=eq.' + L + '&order=tipo.asc,numero.asc'),
    leer('/orden_personas?select=id,nombre,inicial&local_id=eq.' + L + '&activo=is.true&order=nombre.asc'),
    leer('/orden_exhibidores?select=id,nombre&order=nombre.asc')
  ]).then(function (r) {
    var sectores = r[0] || [], gente = r[1] || [], exh = r[2] || [];
    var ops = [[null, '—']].concat(gente.map(function (p) { return [p.id, p.nombre + (p.inicial ? ' ' + p.inicial + '.' : '')]; }));
    var ids = sectores.map(function (s) { return s.id; });
    return (ids.length ? leer('/orden_modulos?select=*&sector_id=in.(' + ids.join(',') + ')&order=numero.asc') : Promise.resolve([])).then(function (mods) {
      var html = '<p class="bajada">Cada sector tiene un responsable y un suplente (el que lo cubre en sus francos). Los controles le llegan a quien esté ese día.</p>';
      sectores.forEach(function (s) {
        /* Los módulos se agregan desde el mapa (van numerados por todo el local: el salón pared por pared, el depósito 1, 2, 3…). */
        html += '<div class="seccion">' + (s.tipo === 'salon' ? 'Salón' : 'Depósito') + ' · sector ' + s.numero + '</div><div data-sector="' + esc(s.id) + '"></div><div data-modulos="' + esc(s.id) + '"></div>' +
          '<button class="boton chico" data-al-mapa>Agregar o sacar módulos: en el mapa del local</button>';
      });
      html += '<div class="seccion">Agregar un sector</div><div class="renglon" id="nuevoSector">' +
        campoHTML({ k: 'tipo', t: 'Tipo', tipo: 'sel', ops: [['salon', 'Salón'], ['deposito', 'Depósito']] }, { tipo: 'salon' }) +
        campoHTML({ k: 'numero', t: 'Número', tipo: 'num', ancho: 'chico' }, { numero: (sectores.length ? Math.max.apply(null, sectores.map(function (s) { return s.numero; })) : 0) + 1 }) +
        '<div class="acciones-renglon"><button class="boton chico lima" id="agregarSector">Agregar</button></div></div>';
      var z = zonaAjuste(html);
      sectores.forEach(function (s) {
        editor({ cont: z.querySelector('[data-sector="' + s.id + '"]'), filas: [s],
          cols: [{ k: 'nombre', t: 'Nombre (opcional)', tipo: 'texto', nulo: true }, { k: 'responsable_id', t: 'Responsable', tipo: 'sel', ops: ops },
                 { k: 'suplente_id', t: 'Suplente', tipo: 'sel', ops: ops }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
          guardar: function (f, c) { return guardarFila('/orden_sectores?id=eq.' + valor(f.id), c); } });
        var suyos = (mods || []).filter(function (m) { return m.sector_id === s.id; });
        /* En el salón, el número y si está prendido los maneja el mapa (si no, el mapa los pisa al guardar). */
        var delMapa = true;
        editor({ cont: z.querySelector('[data-modulos="' + s.id + '"]'), filas: suyos, vacio: 'Sin módulos.',
          cols: [{ k: 'numero', t: 'N.º', tipo: 'num', ancho: 'chico', fijo: delMapa }, { k: 'nombre', t: 'Módulo', tipo: 'texto' },
                 { k: 'exhibidor_id', t: 'Exhibidor', tipo: 'sel', ops: [[null, '—']].concat(exh.map(function (e) { return [e.id, e.nombre]; })) },
                 { k: 'reglas_extra', t: 'Algo propio de este módulo', tipo: 'texto', nulo: true, ancho: 'grande' }, { k: 'activo', t: 'Activo', tipo: 'bool', fijo: delMapa }],
          guardar: function (f, c) { return guardarFila('/orden_modulos?id=eq.' + valor(f.id), c); },
          extra: function (f) {
            return (f.foto_referencia_path ? '<img class="ref-mini" data-foto="' + esc(f.foto_referencia_path) + '" alt="Referencia">' : '') +
              '<button class="boton chico" data-accion="ref">' + (f.foto_referencia_path ? 'Cambiar la foto de referencia' : 'Foto de referencia') + '</button>';
          },
          accion: function (f) { return fotoReferencia(f); } });
      });
      cargarFotos(z);
      z.querySelectorAll('[data-al-mapa]').forEach(function (b) { b.onclick = function () { ir('local'); }; });
      unaVez(z.querySelector('#agregarSector'), function () {
        var r2 = z.querySelector('#nuevoSector');
        return escribir('/orden_sectores', 'POST', { local_id: _local.id, tipo: r2.querySelector('[data-k=tipo]').value, numero: Number(r2.querySelector('[data-k=numero]').value) })
          .then(ajSectores);
      });
    });
  }).catch(errAjuste);
}

function fotoReferencia(m) {
  return new Promise(function (ok, mal) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    document.body.appendChild(input);
    input.onchange = function () {
      var f = input.files && input.files[0];
      input.remove();
      if (!f) { ok(); return; }
      archivoAJpeg(f)
        .then(function (b) { return subirArchivo(_local.id + '/referencias/' + m.id + '-' + nombreArchivo(), b); })
        .then(function (ruta) { return guardarFila('/orden_modulos?id=eq.' + valor(m.id), { foto_referencia_path: ruta }); })
        .then(function () { avisar('Foto de referencia guardada.'); ajSectores(); ok(); }, mal);
    };
    input.click();
  });
}

function ajHorarios() {
  var L = valor(_local.id);
  Promise.all([leer('/orden_locales?select=*&id=eq.' + L), leer('/orden_config?select=*&local_id=eq.' + L)]).then(function (r) {
    var loc = (r[0] || [])[0], cfg = (r[1] || [])[0];
    var z = zonaAjuste('<div class="seccion">El local</div><div id="ajLocal"></div><div class="seccion">Los controles y los avisos</div><div id="ajCfg1"></div>' +
      '<div class="seccion">Qué está prendido</div><div id="ajCfg2"></div><div class="seccion">Faltas (sólo se sugieren; con el modo prueba prendido, ni eso)</div><div id="ajCfg3"></div>' +
      '<div class="seccion">Caja y fotos</div><div id="ajCfg4"></div>');
    var diasOps = DIAS_LARGO.map(function (d, i) { return [i + 1, d]; });
    var g = function (f, c) { return guardarFila('/orden_config?local_id=eq.' + valor(f.local_id), c); };
    if (loc) editor({ cont: z.querySelector('#ajLocal'), filas: [loc],
      cols: [{ k: 'nombre', t: 'Nombre en la app', tipo: 'texto' }, { k: 'dias_abiertos', t: 'Días que abre', tipo: 'dias' },
             { k: 'hora_apertura', t: 'Abre', tipo: 'hora' }, { k: 'hora_cierre', t: 'Cierra', tipo: 'hora' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
      guardar: function (f, c) { return guardarFila('/orden_locales?id=eq.' + valor(f.id), c).then(function () { if (c.nombre) { _local.nombre = c.nombre; } }); } });
    if (!cfg) return;
    editor({ cont: z.querySelector('#ajCfg1'), filas: [cfg],
      cols: [{ k: 'dias_control', t: 'Días de control (todos los módulos)', tipo: 'dias' }, { k: 'hora_aviso_1', t: 'Aviso de la mañana', tipo: 'hora' },
             { k: 'hora_aviso_2', t: 'Recordatorio de la tarde', tipo: 'hora' }, { k: 'hora_limite', t: 'Hora límite', tipo: 'hora' },
             { k: 'sorpresas_por_semana', t: 'Sorpresas por semana', tipo: 'num', ancho: 'chico' },
             { k: 'deposito_dia_vence', t: 'El depósito vence el', tipo: 'sel', numero: true, ops: diasOps },
             { k: 'cambio_imagen_dia', t: 'Cambio de imagen', tipo: 'sel', numero: true, ops: [[null, 'Apagado']].concat(diasOps) },
             { k: 'max_avisos_dia', t: 'Tope de avisos por día', tipo: 'num', ancho: 'chico' }],
      guardar: g });
    editor({ cont: z.querySelector('#ajCfg2'), filas: [cfg],
      cols: [{ k: 'ia_activa', t: 'Revisión con IA', tipo: 'bool' }, { k: 'ia_crea_tareas', t: 'La IA crea tareas', tipo: 'bool' },
             { k: 'ia_sugerencias', t: 'Sugerencias de estilo de la IA', tipo: 'bool' }, { k: 'modo_prueba', t: 'Modo prueba (sin faltas)', tipo: 'bool' },
             { k: 'desafio_activo', t: 'Test semanal', tipo: 'bool' }, { k: 'caja_activa', t: 'Control de caja', tipo: 'bool' }],
      guardar: g });
    editor({ cont: z.querySelector('#ajCfg3'), filas: [cfg],
      cols: [{ k: 'ventana_faltas_dias', t: 'Se mira (días)', tipo: 'num', ancho: 'chico' }, { k: 'umbral_tareas_vencidas', t: 'Días con tareas fuera de plazo', tipo: 'num', ancho: 'chico' },
             { k: 'umbral_dias_sin_control', t: 'Días sin mandar controles', tipo: 'num', ancho: 'chico' }, { k: 'umbral_fuera_estandar', t: 'Días "Fuera de estándar"', tipo: 'num', ancho: 'chico' },
             { k: 'horas_revision_supervisor', t: 'Horas para revisar', tipo: 'num', ancho: 'chico' }],
      guardar: g });
    editor({ cont: z.querySelector('#ajCfg4'), filas: [cfg],
      cols: [{ k: 'caja_tolerancia_pesos', t: 'Tolerancia de caja ($)', tipo: 'num', ancho: 'chico' }, { k: 'caja_minutos_tolerancia', t: 'Minutos después del cierre', tipo: 'num', ancho: 'chico' },
             { k: 'dias_guardar_fotos', t: 'Días que se guardan las fotos (mín. 7)', tipo: 'num', ancho: 'chico' }, { k: 'dias_guardar_fotos_problemas', t: '…las de "A mejorar" o peor', tipo: 'num', ancho: 'chico' },
             { k: 'dias_guardar_fotos_caja', t: '…las de caja', tipo: 'num', ancho: 'chico' }],
      guardar: g });
  }).catch(errAjuste);
}

var CHECKS = [['dobladas', 'Doblado'], ['frontales', 'Frontales'], ['etiquetas', 'Etiquetas'], ['limpieza', 'Limpieza'], ['exhibicion', 'Exhibición'], ['rotulado', 'Rotulado'], ['talles', 'Segmento y talle']];

function ajLista(cfg) {
  leer(cfg.ruta).then(function (filas) {
    var z = zonaAjuste((cfg.texto ? '<p class="bajada">' + cfg.texto + '</p>' : '') + '<div id="filasLista"></div>' +
      (cfg.nueva ? '<button class="boton" id="agregarLista" style="max-width:320px;margin-top:6px">Agregar</button>' : ''));
    editor({ cont: z.querySelector('#filasLista'), filas: filas || [], cols: cfg.cols,
      guardar: function (f, c) {
        if (cfg.validar) { var m = cfg.validar(Object.assign({}, f, c)); if (m) return Promise.reject(rechazo(m)); }
        return guardarFila(cfg.tabla + '?id=eq.' + valor(f.id), c);
      } });
    var a = z.querySelector('#agregarLista');
    if (a) unaVez(a, function () { return escribir(cfg.tabla, 'POST', cfg.nueva(filas || [])).then(function () { ajLista(cfg); }); });
  }).catch(errAjuste);
}

function ajReglas() {
  ajLista({ ruta: '/orden_reglas?select=*&order=sector_tipo.asc,check_clave.asc,orden.asc', tabla: '/orden_reglas',
    texto: 'La IA las lee en cada foto. Cambiar una regla cambia lo que mira desde la próxima foto: no hay que entrenar nada.',
    cols: [{ k: 'sector_tipo', t: 'Dónde', tipo: 'sel', ops: [[null, 'Salón y depósito'], ['salon', 'Salón'], ['deposito', 'Depósito']] },
           { k: 'check_clave', t: 'Punto', tipo: 'sel', ops: CHECKS }, { k: 'texto', t: 'La regla', tipo: 'texto', ancho: 'grande' },
           { k: 'orden', t: 'Orden', tipo: 'num', ancho: 'chico' }, { k: 'activo', t: 'Activa', tipo: 'bool' }],
    nueva: function () { return { sector_tipo: 'salon', check_clave: 'frontales', texto: 'Nueva regla (escribila y guardá)', activo: false }; } });
}

function ajColores() {
  ajLista({ ruta: '/orden_colores?select=*&order=orden.asc', tabla: '/orden_colores', texto: 'El degradé de los percheros, del más claro al más oscuro.',
    cols: [{ k: 'orden', t: 'Orden', tipo: 'num', ancho: 'chico' }, { k: 'nombre', t: 'Color', tipo: 'texto' }, { k: 'hex', t: 'Muestra', tipo: 'color', ancho: 'chico' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
    nueva: function (f) { return { orden: f.length + 1, nombre: 'Nuevo color', hex: '#808080', activo: false }; } });
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

function ajExhibidores() {
  ajLista({ ruta: '/orden_exhibidores?select=*&order=nombre.asc', tabla: '/orden_exhibidores', texto: 'La cantidad ideal de prendas de cada tipo: ni muy lleno ni muy vacío (la IA la tiene en cuenta).',
    cols: [{ k: 'nombre', t: 'Exhibidor', tipo: 'texto' }, { k: 'prendas_min', t: 'Mínimo', tipo: 'num', ancho: 'chico' }, { k: 'prendas_max', t: 'Máximo', tipo: 'num', ancho: 'chico' },
           { k: 'notas', t: 'Notas', tipo: 'texto', nulo: true, ancho: 'grande' }],
    nueva: function (f) { return { nombre: 'Exhibidor ' + (f.length + 1) }; } });
}

var TEMAS_PREG = [['tela', 'Telas'], ['molderia', 'Molderías'], ['retail', 'Cómo trabajamos']];
function ajPreguntas() {
  ajLista({ ruta: '/orden_preguntas?select=id,tema,dificultad,pregunta,grupo,activo&order=grupo.asc.nullsfirst,tema.asc,dificultad.asc', tabla: '/orden_preguntas',
    texto: 'Las preguntas de los tests de conocimiento (opción múltiple; si le erran, la app explica la correcta). El test de la semana sale solo. ' +
      'Para uno especial (por ejemplo, la colección nueva), cargá sus preguntas con el mismo <b>grupo</b> ("Colección verano") y tocá "Mandar un test ahora". ' +
      'Se pueden apagar las que no sirvan.<br><span class="imp-mapa-acc" style="margin-top:10px"><button class="boton chico lima" id="mandarTest">Mandar un test ahora</button>' +
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

/** "Tenés un test de conocimiento: Colección verano": a los vendedores de los locales elegidos. */
function mandarTest() {
  leer('/orden_preguntas?select=grupo&activo=is.true&grupo=not.is.null').then(function (filas) {
    var grupos = {};
    (filas || []).forEach(function (g) { var k = String(g.grupo).trim(); if (k) grupos[k] = (grupos[k] || 0) + 1; });
    var nombres = Object.keys(grupos).sort();
    var f = ventana('<h1>Mandar un test ahora</h1><p class="bajada">Les llega a los vendedores de los locales que marques: "Tenés un test de conocimiento: …". ' +
        'Todos reciben las mismas preguntas. Se suma al de la semana.</p>' +
      '<div class="renglon"><label class="campo c-grande"><span>Título</span><input id="mtTitulo" maxlength="60" placeholder="Colección verano"></label>' +
        '<label class="campo c-medio"><span>Las preguntas</span><select id="mtDe">' +
          nombres.map(function (g) { return '<option value="g:' + esc(g) + '">Grupo "' + esc(g) + '" (' + grupos[g] + ')</option>'; }).join('') +
          '<option value="t:producto">Telas y molderías</option><option value="t:retail">Cómo trabajamos</option><option value="t:todo">De todo</option></select></label>' +
        '<label class="campo c-chico"><span>Cuántas</span><input id="mtCant" type="number" min="1" max="20" value="5"></label>' +
        '<label class="campo c-chico"><span>Días para hacerlo</span><input id="mtDias" type="number" min="1" max="14" value="2"></label></div>' +
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
    unaVez(f.querySelector('#mtMandar'), function () {
      var locales = [].filter.call(f.querySelectorAll('[data-loc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.loc; });
      var v = de.value, esGrupo = v.indexOf('g:') === 0;
      if (!titulo.value.trim()) { avisar('Ponele un título.'); return; }
      if (!locales.length) { avisar('Marcá al menos un local.'); return; }
      return llamar('orden_test_mandar', { p_locales: locales, p_titulo: titulo.value.trim(), p_grupo: esGrupo ? v.slice(2) : null, p_tema: esGrupo ? 'todo' : v.slice(2),
                                           p_cantidad: parseInt(f.querySelector('#mtCant').value, 10) || 5, p_dias: parseInt(f.querySelector('#mtDias').value, 10) || 2 })
        .then(function (r) {
          f.remove();
          avisar(r && r.personas ? 'Listo: le llegó a ' + r.personas + (r.personas === 1 ? ' vendedor' : ' vendedores') + ' (' + r.preguntas + ' preguntas).'
                                 : 'No hay vendedores aprobados en esos locales todavía.');
        });
    });
  }).catch(function (e) { avisar(mensajeDe(e)); });
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
      '<button class="boton chico" id="btnFormaMapa">Armar el croquis</button></div>' : '') +
    (_repartir ? '<p class="bajada">"Repartir parejo" divide los módulos en partes iguales, en bloques seguidos (22 entre 3: 7, 7 y 8). ' +
                 'Para hacerlo a mano o ponerle nombre a un módulo ("Vidriera"), tocalo. Tocá un sector (abajo) para elegir quién lo tiene, quién lo cubre y, en el depósito, qué tiene.</p>' : '') +
    (d.modulos.length ? '<div class="imp-mapa-dibujos">' + svgMapa(d) + svgDeposito(d) + '</div>' + leyendaNombres(d)
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
  z.querySelectorAll('.mapa-mod').forEach(function (g) {
    g.onclick = function () {
      if (_repartir) elegirSectorAdmin(d, g.dataset.mod);
      else if (_porIdLocal[g.dataset.mod]) verModulo(_porIdLocal[g.dataset.mod]);
    };
  });
  if (_repartir) z.querySelectorAll('[data-sector]').forEach(function (s) { s.onclick = function () { elegirGenteAdmin(d, s.dataset.sector); }; });
}

/** El modo observador (croquis-visor.js), a pantalla completa arriba de la administración. "Armar el croquis" aplana
    la maqueta y abre el editor. */
function abrirObservador() {
  var caja = document.createElement('div');
  document.body.appendChild(caja);
  var cerrar = function () { caja.remove(); };
  var v = abrirVisor(caja, {
    local: _local, puedeSugerir: !soloMira(), puedeNombrar: !soloMira(), puedeEditar: !soloMira(),
    alVolver: cerrar,
    alEditar: function (d) { cerrar(); editarMapa(d || _mapaLocal); }
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
      '<button class="boton chico" id="mGuardarQue">Guardar qué hay</button></div>' : '') +
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
                                  : d.pared.slice().sort(function (a, b) { return a.numero - b.numero; }).concat(d.islas);
  var k = secs.length, n = mods.length, base = k ? Math.floor(n / k) : 0, extra = k ? n % k : 0, desde = 0;
  return secs.map(function (s, i) {
    var cant = base + (i >= k - extra ? 1 : 0), suyos = mods.slice(desde, desde + cant);
    desde += cant;
    return { sector: s, cantidad: cant, nums: suyos.map(function (m) { return numeroVista(d, m) || m.nombre; }) };
  });
}

function repartirParejo(d, tipo) {
  var plan = planReparto(d, tipo), mods = tipo === 'deposito' ? d.dep : d.pared.concat(d.islas);
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
    '<button class="boton lima" id="vGuardar">Guardar</button>');
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
function editarMapa(d) {
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

  var f = ventana('<h1>El croquis del local</h1><p class="bajada">El local visto desde arriba, como lo ven los vendedores. ' +
    '<b>Tocá un lugar de una pared</b> para cambiarlo: módulo, módulo doble, hueco o algo que no es un módulo (probadores, la puerta del depósito, una columna). ' +
    '<b>Arrastralo</b> hasta otro lugar para cambiarlos de lugar (en el celular, mantenelo apretado un momento y movelo). ' +
    '<b>Tocá la entrada</b> para elegir cuántos lugares ocupa o ponerla en otro lugar. ' +
    'El 1 es el primero al lado de la entrada, hacia la izquierda, y sigue dando la vuelta. Cada módulo se queda en su lugar con su responsable y sus fotos: si cambia algo, cambia su número.</p>' +
    '<div class="renglon"><label class="campo c-medio"><span>Forma</span><select id="eForma"><option value="rectangulo"' + (m.forma !== 'cuadrado' ? ' selected' : '') + '>De calle (largo)</option>' +
      '<option value="cuadrado"' + (m.forma === 'cuadrado' ? ' selected' : '') + '>De shopping (cuadrado)</option></select></label>' +
      '<label class="campo c-medio"><span>Enfrente de la vidriera</span><select id="eFrente">' + Object.keys(NOMBRE_FRENTE).map(function (k) {
        return '<option value="' + k + '"' + ((cqGuardado.frente || 'calle') === k ? ' selected' : '') + '>' + NOMBRE_FRENTE[k] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="campo c-medio"><span>Vidriera (con foto)</span><select id="eVidriera">' + [['0', 'Sin vidriera'], ['1', 'Un panel'], ['2', 'Dos paneles (izq. y der.)']].map(function (o) {
        return '<option value="' + o[0] + '"' + (String(vidr.length) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      PAREDES.map(function (p) {
        return '<label class="campo c-chico"><span>' + esc(p[1]) + '</span><input type="number" inputmode="numeric" min="0" max="40" data-pared="' + p[0] + '" aria-label="Lugares en ' + esc(p[1]) + '"></label>';
      }).join('') + '</div>' +
    '<p class="bajada">Los números de arriba son los <b>lugares</b> de cada pared (módulos, huecos y cosas fijas). <span id="eNotaVidriera"></span></p>' +
    '<div class="imp-mapa-acc"><button type="button" class="boton chico" id="eMoverPuerta">Mover la entrada</button>' +
      '<span class="imp-ancho-puerta" id="eAnchoPuerta"><span>Ancho de la entrada</span>' + [1, 2, 3].map(function (a) {
        return '<button type="button" class="boton chico" data-ancho-puerta="salon:' + a + '">' + a + (a === 1 ? ' lugar' : ' lugares') + '</button>'; }).join('') + '</span>' +
      '<button type="button" class="boton chico" id="eAcomodar">Acomodar solos los del centro</button></div>' +
    '<p class="nota" id="eNotaCambiar" hidden>Tocá el lugar adonde va (de cualquier pared): los dos cambian de lugar. <button type="button" class="boton chico" id="eCancelarCambio" style="margin-left:6px">Cancelar</button></p>' +
    '<p class="nota" id="eNotaPuerta" hidden>Tocá un <b>+</b> verde: ahí va la entrada. Si tocás el de un hueco, la entrada lo ocupa. El 1 queda al lado, hacia la izquierda.</p>' +
    '<div class="imp-mapa-vista croquis" id="eVista"></div>' +
    '<div class="seccion">Módulos del centro del salón</div>' +
    '<p class="bajada">Exhibidores, mesas, percheros: uno por lugar, numerados a continuación de las paredes. <b>Arrastralos en el dibujo</b> para ponerlos donde están; ' +
      'los que no movés van en fila por el medio, de la caja hacia la vidriera.</p>' +
    '<div class="imp-islas" id="eIslas"></div>' +
    '<button type="button" class="boton chico" id="eIslaMas">+ Agregar un módulo en el centro</button>' +
    '<div class="seccion">Muebles y cosas del local</div>' +
    '<p class="bajada">Los probadores, la caja, las mesas, los percheros, los maniquíes, las plantas: no son módulos (no llevan foto), están para que el croquis se parezca al local. ' +
      '<b>Tocá una para agregarla</b> y arrastrala en el dibujo hasta donde está; "Girarla" la pone parada o acostada. El nombre es opcional.</p>' +
    '<div class="imp-lugar-ops imp-piezas" id="ePiezas">' + PIEZAS_ADENTRO.map(function (k) {
      return '<button type="button" class="boton chico" data-en="salon" data-pieza="' + k + '">' + iconoPieza(k) + '<span>' + esc(PIEZAS[k].nombre) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="imp-islas" id="eFijos"></div>' +
    '<div class="seccion">Depósito</div>' +
    '<div class="renglon"><label class="campo c-medio"><span>Forma del depósito</span><select id="eFormaDep"><option value="rectangulo"' + (m.forma_deposito !== 'cuadrado' ? ' selected' : '') + '>Largo</option>' +
      '<option value="cuadrado"' + (m.forma_deposito === 'cuadrado' ? ' selected' : '') + '>Cuadrado</option></select></label>' +
      '<label class="campo c-chico"><span>Módulos</span><input type="number" inputmode="numeric" min="0" max="40" id="eDep"></label>' +
      '<p class="bajada" style="flex:1 1 260px;margin:0">Dividilo en partes que entren en una foto cada una. Si cambiás la cantidad o la forma, los módulos se vuelven a acomodar alrededor (la puerta queda).</p></div>' +
    '<div class="imp-mapa-acc"><button type="button" class="boton chico" id="eMoverPuertaDep">Mover la puerta del depósito</button>' +
      '<span class="imp-ancho-puerta" id="eAnchoPuertaDep"><span>Ancho de la puerta</span>' + [1, 2, 3].map(function (a) {
        return '<button type="button" class="boton chico" data-ancho-puerta="deposito:' + a + '">' + a + (a === 1 ? ' lugar' : ' lugares') + '</button>'; }).join('') + '</span></div>' +
    '<p class="nota" id="eNotaPuertaDep" hidden>Tocá un <b>+</b> verde: ahí va la puerta del depósito.</p>' +
    '<div class="imp-mapa-vista croquis" id="eVistaDep"></div>' +
    '<div class="seccion">Muebles del depósito</div><p class="bajada">Una mesa o un perchero en el medio: tocalos o <b>arrastralos hasta el dibujo del depósito</b>.</p>' +
    '<div class="imp-lugar-ops imp-piezas" id="ePiezasDep">' + PIEZAS_DEPOSITO.map(function (k) {
      return '<button type="button" class="boton chico" data-en="deposito" data-pieza="' + k + '">' + iconoPieza(k) + '<span>' + esc(PIEZAS[k].nombre) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="imp-islas" id="eFijosDep"></div>' +
    '<p class="bajada" id="eTotal"></p><button class="boton lima" id="eGuardar">Guardar</button>');
  var vistaS = f.querySelector('#eVista'), vistaD = f.querySelector('#eVistaDep');

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
  function cambiarCantidad(w, n) {
    var e = st.salon, ls = e.paredes[w];
    while (ls.length < n) ls.push(moduloNuevo('salon'));
    while (ls.length > n) sacarModulo('salon', ls.pop());
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
  function filasCentro(total) {
    /* Mientras escriben un nombre, la lista no se vuelve a dibujar (perderían lo que están tocando). */
    var hayFoco = function (sel) { var a = document.activeElement; return a && a.tagName === 'INPUT' && a.closest && a.closest(sel); };
    if (!hayFoco('#eIslas')) {
      f.querySelector('#eIslas').innerHTML = centro.length ? centro.map(function (c, k) {
        return '<div class="imp-isla"><b>' + (total + k + 1) + '</b><input maxlength="40" data-isla="' + k + '" value="' + esc(c.nombre) + '" placeholder="Mesa, exhibidor, perchero…" aria-label="Nombre del módulo del centro">' +
          (c.pos ? '<button type="button" class="boton chico" data-suelta="' + k + '" title="Volver a la fila del medio">A la fila</button>' : '') +
          '<button type="button" class="boton chico" data-sacar="' + k + '">Sacar</button></div>';
      }).join('') : '<p class="bajada">Todavía no hay módulos en el centro.</p>';
    } else f.querySelectorAll('#eIslas .imp-isla b').forEach(function (b, k) { b.textContent = total + k + 1; });
    [['salon', '#eFijos', 'Todavía no hay muebles adentro.'], ['deposito', '#eFijosDep', 'Todavía no hay muebles en el depósito.']].forEach(function (z) {
      if (hayFoco(z[1])) return;
      var lista = fijosDe[z[0]], en = ' data-en="' + z[0] + '"';
      f.querySelector(z[1]).innerHTML = lista.length ? lista.map(function (x, k) {
        return '<div class="imp-isla">' + iconoPieza(x.tipo) + '<input maxlength="40"' + en + ' data-fijo-nombre="' + k + '" value="' + esc(x.nombre) + '" placeholder="' +
          esc(x.tipo === 'otro' ? 'Qué es (escribilo)' : PIEZAS[x.tipo].nombre + ' (nombre opcional)') + '" aria-label="' + esc(PIEZAS[x.tipo].nombre) + ': nombre">' +
          '<button type="button" class="boton chico"' + en + ' data-girar="' + k + '">Girarla</button><button type="button" class="boton chico"' + en + ' data-sacar-fijo="' + k + '">Sacar</button></div>';
      }).join('') : '<p class="bajada">' + z[2] + '</p>';
    });
  }
  function vista() {
    var mm = mapaArmado(), dv = datosVista(mm), cq = croquisArmado();
    vistaS.innerHTML = svgMapa(dv, { croquis: cq, editable: true, vacios: true, moverPuerta: st.mover === 'salon' ? 'salon' : null });
    vistaD.innerHTML = svgDeposito(dv, { croquis: cq, editable: true, moverPuerta: st.mover === 'deposito' ? 'deposito' : null }) ||
      '<p class="bajada">Sin módulos en el depósito.</p>';
    f.querySelectorAll('[data-pared]').forEach(function (i) { if (document.activeElement !== i) i.value = st.salon.paredes[i.dataset.pared].length; });
    var dep = f.querySelector('#eDep');
    if (document.activeElement !== dep) dep.value = mm.deposito;
    f.querySelector('#eMoverPuerta').textContent = st.mover === 'salon' ? 'Cancelar' : 'Mover la entrada';
    f.querySelector('#eMoverPuertaDep').textContent = st.mover === 'deposito' ? 'Cancelar' : 'Mover la puerta del depósito';
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
    f.querySelector('#eNotaVidriera').textContent = 'Vidriera: ' + (enMedio ? 'con la entrada en el medio del frente, van dos paneles (uno a cada lado).' : 'con la entrada en una punta, va un panel.');
    /* "Cambiar de lugar": el lugar elegido, marcado, y el aviso arriba del dibujo. */
    f.querySelector('#eNotaCambiar').hidden = !st.cambiar;
    if (st.cambiar) {
      var orig = vistaDe(st.cambiar.split(':')[0]).querySelector('[data-lugar="' + st.cambiar + '"]');
      if (orig) orig.classList.add('mapa-origen'); else st.cambiar = null;
    }
    var total = dv.pared.length;
    filasCentro(total);
    var c = cambios();
    f.querySelector('#eTotal').textContent = total + (total === 1 ? ' módulo' : ' módulos') + ' en las paredes' +
      (centro.length ? ', ' + centro.length + ' en el centro (del ' + (total + 1) + ' al ' + (total + centro.length) + ')' : '') + ' y ' + mm.deposito + ' en el depósito.' +
      (vidr.length ? ' La vidriera: ' + (vidr.length === 1 ? 'un panel' : 'dos paneles') + ' (piden foto, sin número).' : '') +
      (c.renumeran ? ' Cambian de número ' + c.renumeran + ' (siguen con su responsable y sus fotos).' : '') +
      (c.nuevos ? ' Se crean ' + c.nuevos + ' (van al sector del anterior; después se reparten).' : '') +
      (c.apagan ? ' Se apagan ' + c.apagan + ': no se borran, quedan sus fotos.' : '');
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
        if (op === 'cambiar') { var mc = vistaDe(tipo).querySelector('.mapa-origen'); if (mc) mc.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
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
      movido = true;
      var q = lugar(p), dx = caja[0] + q.x * caja[2] - c0.x, dy = caja[1] + q.y * caja[3] - c0.y;
      /* Levantado: un poco más grande y con sombra, centrado en su lugar. */
      mover.forEach(function (el) {
        if (!el) return;
        el.classList.add('levantado');
        el.setAttribute('transform', 'translate(' + (dx + c0.x).toFixed(1) + ',' + (dy + c0.y).toFixed(1) + ') scale(1.06) translate(' + (-c0.x).toFixed(1) + ',' + (-c0.y).toFixed(1) + ')');
      });
    }
    function suelta(e2) {
      window.removeEventListener('pointermove', mueve); window.removeEventListener('pointerup', suelta); window.removeEventListener('pointercancel', suelta);
      if (e2.type === 'pointercancel') { vista(); return; }
      if (!movido) {
        /* Un toque: su renglón, abajo, para cambiarle el nombre. */
        var k = t.hasAttribute('data-fijo') ? '[data-en="' + en + '"][data-fijo-nombre="' + t.dataset.fijo + '"]'
          : '[data-isla="' + centro.map(function (c) { return c.key; }).indexOf(t.previousElementSibling && t.previousElementSibling.dataset.mod) + '"]';
        var inp = f.querySelector(k);
        if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus({ preventScroll: true }); }
        return;
      }
      soltadoEn = Date.now();
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

  /* ── Los botones y los campos ── */
  f.querySelector('#eCancelarCambio').onclick = function () { st.cambiar = null; vista(); };
  f.querySelector('#eMoverPuerta').onclick = function () { st.mover = st.mover === 'salon' ? null : 'salon'; st.cambiar = null; vista(); };
  f.querySelector('#eMoverPuertaDep').onclick = function () { st.mover = st.mover === 'deposito' ? null : 'deposito'; vista(); };
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
  var listaC = f.querySelector('#eIslas'), listaF = f.querySelector('#eFijos');
  listaC.addEventListener('input', function (ev) {
    var k = ev.target.dataset && ev.target.dataset.isla;
    if (k == null || !centro[+k]) return;
    centro[+k].nombre = ev.target.value;
    vista();
  });
  /* Al tocar un botón de una lista, se suelta el campo que estaba escribiendo (si no, la lista no se vuelve a dibujar). */
  function soltarFoco() { var a = document.activeElement; if (a && a.tagName === 'INPUT' && f.contains(a)) a.blur(); }
  listaC.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-sacar], [data-suelta]');
    if (!b) return;
    soltarFoco();
    if (b.dataset.sacar != null) centro.splice(+b.dataset.sacar, 1);
    else if (centro[+b.dataset.suelta]) centro[+b.dataset.suelta].pos = null;
    vista();
  });
  /** "Centro 1", "Centro 2"…: el primer nombre libre para uno nuevo (después se cambia). */
  function nombreLibre() {
    for (var k = centro.length + 1; ; k++) {
      var n = 'Centro ' + k;
      if (!centro.some(function (c) { return c.nombre.trim().toLowerCase() === n.toLowerCase(); })) return n;
    }
  }
  f.querySelector('#eIslaMas').addEventListener('click', function () {
    if (centro.length >= 30) { avisar('Como mucho 30 en el centro.'); return; }
    centro.push({ key: 'nueva' + (++nuevas), id: null, nombre: nombreLibre(), antes: null, pos: null });
    vista();
    var nuevo = listaC.querySelector('[data-isla="' + (centro.length - 1) + '"]');
    if (nuevo) { nuevo.focus(); nuevo.select(); }
  });
  [listaF, f.querySelector('#eFijosDep')].forEach(function (lf) {
    lf.addEventListener('input', function (ev) {
      var k = ev.target.dataset && ev.target.dataset.fijoNombre, lista = fijosDe[ev.target.dataset.en];
      if (k == null || !lista || !lista[+k]) return;
      lista[+k].nombre = ev.target.value;
      vista();
    });
    lf.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-girar], [data-sacar-fijo]'), lista = b && fijosDe[b.dataset.en];
      if (!lista) return;
      soltarFoco();
      if (b.dataset.girar != null) { var x = lista[+b.dataset.girar]; if (x) x.vertical = !x.vertical; }
      else lista.splice(+b.dataset.sacarFijo, 1);
      vista();
    });
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
    if (tipo === 'otro') { var nuevo = f.querySelector('[data-en="' + en + '"][data-fijo-nombre="' + (lista.length - 1) + '"]'); if (nuevo) nuevo.focus(); }
  }
  var piezaSoltadaEn = 0;
  f.querySelectorAll('#ePiezas, #ePiezasDep').forEach(function (bandeja) {
    bandeja.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-pieza]');
      if (!b || Date.now() - piezaSoltadaEn < 500) return;
      agregarMueble(b.dataset.en, b.dataset.pieza, null);
      avisar(PIEZAS[b.dataset.pieza].nombre + ': ya está en el dibujo. Arrastrala hasta donde va (o, la próxima, arrastrala directo desde acá).');
    });
    /* Agarrarla de la bandeja y llevarla al dibujo: se suelta donde va. */
    bandeja.addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-pieza]');
      if (!b || (ev.button && ev.button !== 0)) return;
      var en = b.dataset.en, destino = en === 'deposito' ? vistaD : vistaS, x0 = ev.clientX, y0 = ev.clientY, fantasma = null;
      function mueve(e2) {
        if (!fantasma) {
          if (Math.abs(e2.clientX - x0) + Math.abs(e2.clientY - y0) < 8) return;
          fantasma = document.createElement('div');
          fantasma.className = 'pieza-fantasma';
          fantasma.innerHTML = iconoPieza(b.dataset.pieza);
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
        var caja = (svg.getAttribute('data-adentro') || '').split(' ').map(Number), p = puntoSvg(svg, e2), t = tamanoPieza(b.dataset.pieza, false);
        agregarMueble(en, b.dataset.pieza, { x: imantarCroquis((p.x - caja[0]) / caja[2], t.w / 2 / caja[2]), y: imantarCroquis((p.y - caja[1]) / caja[3], t.h / 2 / caja[3]) });
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
      if (esNombreVidriera(nom)) { avisar('"' + nom + '" es el nombre de la vidriera: usá otro para el del centro (la vidriera se elige arriba, en "Vidriera").'); return; }
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
      f.remove();
      avisar('Croquis guardado' + (r && r.creados ? ': ' + r.creados + (r.creados === 1 ? ' módulo nuevo.' : ' módulos nuevos.') : '.'));
      verLocal();
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   AJUSTES · LOS RECORDATORIOS DE CADA DÍA (SQL 99)
   ════════════════════════════════════════════════════════════════════════ */

var DIAS_OPS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo']];
function ajRecordatorios() {
  ajLista({ ruta: '/orden_recordatorios?select=*&local_id=eq.' + valor(_local.id) + '&order=dia.asc,creado_en.asc', tabla: '/orden_recordatorios',
    texto: 'Lo que hay que acordarse cada día en ' + esc(_local.nombre) + ' (martes entra mercadería, jueves cambio de imagen…). Ese día les aparece a los vendedores del local arriba en "Hoy".',
    cols: [{ k: 'dia', t: 'Día', tipo: 'sel', numero: true, ops: DIAS_OPS }, { k: 'texto', t: 'El recordatorio', tipo: 'texto', ancho: 'grande' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
    validar: function (f) { return String(f.texto || '').trim().length < 2 ? 'Escribí el recordatorio.' : null; },
    nueva: function () { return { local_id: _local.id, dia: 2, texto: 'Nuevo recordatorio (escribilo y guardá)', activo: false }; } });
}
