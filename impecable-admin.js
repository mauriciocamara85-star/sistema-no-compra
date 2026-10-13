/**
 * Impecable · la administración (impecable-admin.html).
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
    '<p>' + esc(mensaje || 'Impecable usa su propia entrada: elegí "Administrador" (o tu local), tu nombre y tu PIN. Queda guardada en esta computadora.') + '</p>' +
    '<a class="boton lima enlace-boton" href="vendedores.html#/admin">Entrar a Impecable</a></div>';
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
  return '<div class="imp-grid"><nav class="imp-menu" aria-label="Impecable"><div class="imp-menu-cab">Impecable</div>' +
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
      .catch(function () { return []; })
  ]).then(function (r) {
    if (_solapa !== 'local') return;
    var mods = r[0] || [], res = r[1] || {};
    var html = '<div class="numeros">' +
      '<div class="numero"><span>Nivel de la semana</span><b>' + esc(res.nivel_local || '—') + '</b></div>' +
      '<div class="numero"><span>Controles a tiempo</span><b>' + (res.controles ? res.controles_a_tiempo + ' de ' + res.controles : '—') + '</b></div>' +
      '<div class="numero"><span>Tareas pendientes</span><b>' + (res.tareas_pendientes != null ? res.tareas_pendientes : '—') + '</b></div>' +
      '<div class="numero"><span>Fotos sin revisar</span><b>' + (res.sin_revisar != null ? res.sin_revisar : '—') + '</b></div></div>';
    html += graficoLocal(r[2]);
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
        '<th class="n">Controles a tiempo</th><th class="n">Tareas a tiempo</th><th class="n">Desafío</th></tr></thead><tbody>' +
        gente.map(function (p) {
          var t = { c: 0, ca: 0, t: 0, ta: 0, d: 0, dt: 0 };
          var celdas = semanas.map(function (s) {
            var f = (por[p.id] || {})[s];
            if (!f) return '<td>—</td>';
            t.c += f.controles; t.ca += f.controles_a_tiempo; t.t += f.tareas; t.ta += f.tareas_a_tiempo; t.d += f.desafio_puntaje || 0; t.dt += f.desafio_total || 0;
            return '<td>' + (f.nivel_semana ? '<span class="est nivel-' + esc(f.nivel_semana) + '">' + esc(NIVEL[f.nivel_semana]) + '</span>' : '—') + '</td>';
          }).join('');
          var pc = function (a, b) { return b ? a + '/' + b + ' (' + Math.round(100 * a / b) + '%)' : '—'; };
          return '<tr><td><b>' + esc(p.nombre + (p.inicial ? ' ' + p.inicial + '.' : '')) + '</b></td>' + celdas +
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

var _mes = null;
function verCajas() {
  _mes = _mes || hoyAR().slice(0, 7);
  var L = valor(_local.id);
  Promise.all([
    leer('/orden_v_cajas?select=*&local_id=eq.' + L + '&mes=eq.' + _mes + '&order=fecha.asc'),
    leer('/orden_v_cajas_mes?select=*&local_id=eq.' + L + '&mes=eq.' + _mes),
    leer('/orden_config?select=caja_activa&local_id=eq.' + L)
  ]).then(function (r) {
    if (_solapa !== 'cajas') return;
    var cajas = r[0] || [], tot = (r[1] || [])[0], activa = !!(r[2] && r[2][0] && r[2][0].caja_activa);
    var meses = [];
    for (var i = 0; i < 6; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    var col = function (c, s, rl, dv) {
      return '<td class="n">' + pesos(c[s]) + '</td><td class="n">' + pesos(c[rl]) + '</td><td class="n' + (Math.abs(Number(c[dv] || 0)) > 0.5 ? ' rojo' : '') + '">' + pesos(c[dv]) + '</td>';
    };
    var html = (activa ? '' : '<div class="nota">El control de caja está apagado en este local (se prende en Ajustes → Horarios y funciones).</div>') +
      '<div class="solapas chicas">' + meses.map(function (m) { return '<button data-mes="' + m + '" class="' + (m === _mes ? 'activa' : '') + '">' + m.slice(5) + '/' + m.slice(0, 4) + '</button>'; }).join('') + '</div>' +
      (tot ? '<div class="numeros"><div class="numero"><span>Días sin cargar</span><b>' + tot.dias_sin_cargar + '</b></div><div class="numero"><span>Sin controlar</span><b>' + tot.dias_sin_controlar + '</b></div><div class="numero"><span>Días con alertas</span><b>' + tot.dias_con_alertas + '</b></div><div class="numero"><span>Desvío del mes (efectivo)</span><b>' + pesos(tot.desvio_efectivo) + '</b></div></div>' : '');
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
   PRODUCTOS TESTIGO (carga semanal, con la forma de la planilla)
   ════════════════════════════════════════════════════════════════════════ */

var _semanaTestigo = null;
function verTestigo() {
  _semanaTestigo = _semanaTestigo || lunesAR();
  var L = valor(_local.id);
  leer('/testigo_semanas?select=*&local_id=eq.' + L + '&semana=eq.' + _semanaTestigo).then(function (s) {
    var sem = (s || [])[0];
    var c = document.getElementById('cuerpo');
    var semanas = [];
    for (var i = 0; i < 6; i++) semanas.push(sumarDias(lunesAR(), -7 * i));
    var cab = '<div class="solapas chicas">' + semanas.map(function (w) { return '<button data-semana="' + w + '" class="' + (w === _semanaTestigo ? 'activa' : '') + '">Semana del ' + diaMes(w) + '</button>'; }).join('') + '</div>' +
      '<p class="bajada">Vendida = Enviada − Dev. a fábrica − Salieron + Entraron − Stock sistema. Diferencia = Stock sistema − Cantidad real (positivo: falta mercadería). El desvío de la planilla queda pendiente: falta saber cómo se calcula.</p>';
    var engancharSemanas = function () { c.querySelectorAll('[data-semana]').forEach(function (b) { b.onclick = function () { _semanaTestigo = b.dataset.semana; verTestigo(); }; }); };
    if (!sem) {
      c.innerHTML = cab + '<div class="vacio">No hay carga para esta semana.</div>' + (soloMira() ? '' : '<button class="boton lima" id="empezar" style="max-width:320px;margin-top:12px">Empezar la carga de esta semana</button>');
      engancharSemanas();
      var b = document.getElementById('empezar');
      if (b) unaVez(b, function () {
        return escribir('/testigo_semanas', 'POST', { local_id: _local.id, semana: _semanaTestigo, cargado_por: yo().id }).then(verTestigo);
      });
      return;
    }
    return leer('/testigo_v_items?select=*&semana_id=eq.' + valor(sem.id) + '&order=item.asc').then(function (items) {
      c.innerHTML = cab + (sem.cerrada ? '<div class="nota">Esta semana está cerrada.</div>' : '') + '<div id="itemsTestigo"></div>' +
        (soloMira() || sem.cerrada ? '' : '<button class="boton" id="agregarItem" style="max-width:320px">Agregar un producto</button>');
      engancharSemanas();
      editor({
        cont: document.getElementById('itemsTestigo'), filas: items || [], vacio: 'Todavía no hay productos en esta semana.',
        cols: [{ k: 'item', t: 'Ítem', tipo: 'num', ancho: 'chico' }, { k: 'producto', t: 'Producto', tipo: 'texto', ancho: 'grande' }, { k: 'color', t: 'Color', tipo: 'texto', nulo: true },
               { k: 'enviada', t: 'Enviada', tipo: 'num', ancho: 'chico' }, { k: 'stock_sistema', t: 'Stock sistema', tipo: 'num', ancho: 'chico' },
               { k: 'cantidad_real', t: 'Cantidad real', tipo: 'num', ancho: 'chico' }, { k: 'dev_fabrica', t: 'Dev. a fábrica', tipo: 'num', ancho: 'chico' },
               { k: 'salieron', t: 'Salieron', tipo: 'num', ancho: 'chico' }, { k: 'entraron', t: 'Entraron', tipo: 'num', ancho: 'chico' },
               { k: 'vendida', t: 'Vendida', tipo: 'ver' }, { k: 'diferencia', t: 'Diferencia', tipo: 'ver' }],
        guardar: function (f, cambios) { return guardarFila('/testigo_items?id=eq.' + valor(f.id), cambios).then(verTestigo); }
      });
      var a = document.getElementById('agregarItem');
      if (a) unaVez(a, function () {
        var n = (items || []).reduce(function (m, x) { return Math.max(m, x.item); }, 0) + 1;
        return escribir('/testigo_items', 'POST', { semana_id: sem.id, item: n, producto: 'Producto ' + n }).then(verTestigo);
      });
    });
  }).catch(function (e) { error(e, verTestigo); });
}

/* ════════════════════════════════════════════════════════════════════════
   AJUSTES (sólo el administrador; la base no deja a nadie más)
   ════════════════════════════════════════════════════════════════════════ */

var SUBAJUSTES = [['personas', 'Personas'], ['sectores', 'Sectores y módulos'], ['horarios', 'Horarios y funciones'], ['reglas', 'Reglas de orden'],
                  ['colores', 'Regla de colores'], ['tableros', 'Ideas (tableros)'], ['exhibidores', 'Exhibidores'], ['preguntas', 'Preguntas del desafío']];
var _sub = 'personas';

function verAjustes() {
  var c = document.getElementById('cuerpo');
  c.innerHTML = '<div class="solapas chicas">' + SUBAJUSTES.map(function (s) {
    return '<button data-sub="' + s[0] + '" class="' + (s[0] === _sub ? 'activa' : '') + '">' + s[1] + '</button>';
  }).join('') + '</div><div id="ajuste"><p class="cargando">Cargando…</p></div>';
  c.querySelectorAll('[data-sub]').forEach(function (b) { b.onclick = function () { _sub = b.dataset.sub; verAjustes(); }; });
  ({ personas: ajPersonas, sectores: ajSectores, horarios: ajHorarios, reglas: ajReglas, colores: ajColores,
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
      campoHTML({ k: 'rol', t: 'Rol', tipo: 'sel', ops: [['vendedor', 'Vendedor'], ['supervisor', 'Supervisor'], ['gerencia', 'Gerencia'], ['admin', 'Administrador']] }, { rol: 'vendedor' }) +
      campoHTML({ k: 'local_id', t: 'Local', tipo: 'sel', ops: [[null, 'Sin local']].concat(locs.map(function (l) { return [l.id, l.nombre]; })) }, { local_id: _local.id }) +
      '<div class="acciones-renglon"><button class="boton chico lima" id="agregarPersona">Agregar</button></div></div>');
    editor({
      cont: z.querySelector('#filasPersonas'), filas: gente,
      cols: [{ k: 'nombre', t: 'Nombre', tipo: 'texto' }, { k: 'apellido', t: 'Apellido', tipo: 'texto', nulo: true },
             { k: 'rol', t: 'Rol', tipo: 'sel', ops: [['vendedor', 'Vendedor'], ['supervisor', 'Supervisor'], ['gerencia', 'Gerencia'], ['admin', 'Administrador']] },
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
        html += '<div class="seccion">' + (s.tipo === 'salon' ? 'Salón' : 'Depósito') + ' · sector ' + s.numero + '</div><div data-sector="' + esc(s.id) + '"></div><div data-modulos="' + esc(s.id) + '"></div>' +
          '<button class="boton chico" data-agregar-modulo="' + esc(s.id) + '">Agregar módulo a este sector</button>';
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
        editor({ cont: z.querySelector('[data-modulos="' + s.id + '"]'), filas: suyos, vacio: 'Sin módulos.',
          cols: [{ k: 'numero', t: 'N.º', tipo: 'num', ancho: 'chico' }, { k: 'nombre', t: 'Módulo', tipo: 'texto' },
                 { k: 'exhibidor_id', t: 'Exhibidor', tipo: 'sel', ops: [[null, '—']].concat(exh.map(function (e) { return [e.id, e.nombre]; })) },
                 { k: 'reglas_extra', t: 'Algo propio de este módulo', tipo: 'texto', nulo: true, ancho: 'grande' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
          guardar: function (f, c) { return guardarFila('/orden_modulos?id=eq.' + valor(f.id), c); },
          extra: function (f) {
            return (f.foto_referencia_path ? '<img class="ref-mini" data-foto="' + esc(f.foto_referencia_path) + '" alt="Referencia">' : '') +
              '<button class="boton chico" data-accion="ref">' + (f.foto_referencia_path ? 'Cambiar la foto de referencia' : 'Foto de referencia') + '</button>';
          },
          accion: function (f) { return fotoReferencia(f); } });
      });
      cargarFotos(z);
      z.querySelectorAll('[data-agregar-modulo]').forEach(function (b) {
        unaVez(b, function () {
          var sid = b.dataset.agregarModulo;
          var n = Math.max.apply(null, [0].concat((mods || []).filter(function (m) { return m.sector_id === sid; }).map(function (m) { return m.numero; }))) + 1;
          return escribir('/orden_modulos', 'POST', { sector_id: sid, numero: n, nombre: 'Módulo ' + n }).then(ajSectores);
        });
      });
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
             { k: 'desafio_activo', t: 'Desafío semanal', tipo: 'bool' }, { k: 'caja_activa', t: 'Control de caja', tipo: 'bool' }],
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
  ajLista({ ruta: '/orden_tableros?select=*&order=destacado.desc,orden.asc', tabla: '/orden_tableros', texto: 'Los tableros de Pinterest que ven los vendedores en Ideas. Uno destacado: "Frontales de la semana".',
    cols: [{ k: 'titulo', t: 'Título', tipo: 'texto' }, { k: 'url', t: 'Enlace (https://…)', tipo: 'texto', ancho: 'grande' },
           { k: 'destacado', t: 'Destacado', tipo: 'bool' }, { k: 'orden', t: 'Orden', tipo: 'num', ancho: 'chico' }, { k: 'activo', t: 'Activo', tipo: 'bool' }],
    validar: function (f) { return /^https:\/\/\S+$/i.test(f.url || '') ? null : 'El enlace tiene que empezar con https://'; },
    nueva: function (f) { return { titulo: 'Nuevo tablero', url: 'https://www.pinterest.com/', orden: f.length + 1, activo: false }; } });
}

function ajExhibidores() {
  ajLista({ ruta: '/orden_exhibidores?select=*&order=nombre.asc', tabla: '/orden_exhibidores', texto: 'La cantidad ideal de prendas de cada tipo: ni muy lleno ni muy vacío (la IA la tiene en cuenta).',
    cols: [{ k: 'nombre', t: 'Exhibidor', tipo: 'texto' }, { k: 'prendas_min', t: 'Mínimo', tipo: 'num', ancho: 'chico' }, { k: 'prendas_max', t: 'Máximo', tipo: 'num', ancho: 'chico' },
           { k: 'notas', t: 'Notas', tipo: 'texto', nulo: true, ancho: 'grande' }],
    nueva: function (f) { return { nombre: 'Exhibidor ' + (f.length + 1) }; } });
}

function ajPreguntas() {
  ajLista({ ruta: '/orden_preguntas?select=id,tema,dificultad,pregunta,activo&order=tema.asc,dificultad.asc', tabla: '/orden_preguntas',
    texto: 'Las preguntas del desafío (salen de los manuales de VDH). Se pueden apagar las que no sirvan.',
    cols: [{ k: 'tema', t: 'Tema', tipo: 'ver', ver: function (f) { return { tela: 'Telas', molderia: 'Molderías', retail: 'Cómo trabajamos' }[f.tema] || f.tema; } },
           { k: 'dificultad', t: 'Nivel', tipo: 'ver' }, { k: 'pregunta', t: 'Pregunta', tipo: 'ver' }, { k: 'activo', t: 'Activa', tipo: 'bool' }] });
}

/* ════════════════════════════════════════════════════════════════════════ */

inicio();
