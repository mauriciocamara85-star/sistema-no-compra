/* ════════════════════════════════════════════════════════════════════════
   EL MODO OBSERVADOR (13/10/2026, pedido de Mauricio): "entender rápido
   cómo está armado el local". El croquis con volumen, inclinado como una
   maqueta (2.5D con CSS: sin 3D de verdad), con la foto de cada módulo en
   su frente. Tocar un módulo hace zoom hasta su vista de frente: la foto
   grande, quién lo tiene, cuándo, el nivel y lo que vio la IA.
   Lo usan la app (supervisión: Equipo → El mapa del local) y la
   administración (Por local → Modo observador). Toma el plano de
   planoMapa(), la misma cuenta que el croquis de siempre.
   ════════════════════════════════════════════════════════════════════════ */

var VISOR_INCL = 38;                 // grados de inclinación de la maqueta ("Desde arriba" es 0)
var VISOR_ALTO = { pared: 58, deposito: 60, centro: 32, fijo: 34, muro: 34 };
/* La ropa, con color (pedido de Mauricio: "más moderno, con más color"): azul francia, blanco, terracota, mostaza, verde, bordó, marino, celeste y camel. */
var VISOR_ROPA = ['#2F5BB7', '#F3F0EA', '#C9573A', '#E0A93B', '#2E7D5B', '#8C2F45', '#1F2738', '#86B4DA', '#BF8F5F', '#5B4B9A'];

/** Abre el modo observador adentro de cont (que ya ocupa toda la pantalla). op: { local: {id, nombre}, puedeSugerir,
    puedeNombrar, puedeEditar, alVolver(), alEditar(d), capa: {abrir(fn), soltar(fn)} } */
function abrirVisor(cont, op) {
  var V = { op: op, cont: cont, tab: 'salon', inclinado: true, estado: {}, d: null, ficha: null, fit: {}, vista: 'vendedor' };
  try { V.liviano = localStorage.getItem('vdh_visor_liviano') === '1'; V.vista = localStorage.getItem('vdh_visor_vista') || 'vendedor'; } catch (e) { V.liviano = false; }
  if (!VISOR_VISTAS[V.vista]) V.vista = 'vendedor';
  cont.innerHTML = '<div class="cv' + (V.liviano ? ' cv-liviano' : '') + '">' +
    '<header class="cv-cab"><button class="cv-volver" id="volverMapa" type="button">‹ Volver</button>' +
      '<div class="cv-titulo"><small>Modo observador</small><b>' + esc(op.local.nombre || '') + '</b></div>' +
      '<div class="cv-cab-acc"><div class="cv-seg" id="cvTabs" role="group" aria-label="Qué mirar">' +
        '<button type="button" data-tab="salon" aria-pressed="true">Salón</button><button type="button" data-tab="deposito" aria-pressed="false">Depósito</button></div>' +
        '<button class="cv-chico" id="cvIncl" type="button" aria-pressed="true" title="Ver inclinado o desde arriba">Inclinado</button>' +
        (op.puedeEditar ? '<button class="cv-chico cv-lima" id="cvEditar" type="button">Armar el croquis</button>' : '') + '</div></header>' +
    '<div class="cv-cuerpo"><div class="cv-escena" id="cvEscena"><div class="cv-camara"><div class="cv-mundo" id="cvMundo"></div></div>' +
      '<p class="cv-cargando" id="cvCargando">Cargando el local…</p></div>' +
      '<aside class="cv-panel" id="cvPanel"></aside></div></div>';
  V.raiz = cont.querySelector('.cv');
  V.mundo = cont.querySelector('#cvMundo');
  V.escena = cont.querySelector('#cvEscena');
  cont.querySelector('#volverMapa').onclick = function () { if (V.ficha) { cerrarFicha(V); return; } visorSalir(V); };
  cont.querySelector('#cvTabs').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === V.tab) return;
    V.tab = b.dataset.tab;
    V.resaltado = null;
    cont.querySelectorAll('#cvTabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    visorDibujar(V, true);
  };
  cont.querySelector('#cvIncl').onclick = function () {
    V.inclinado = !V.inclinado;
    this.setAttribute('aria-pressed', V.inclinado);
    this.textContent = V.inclinado ? 'Inclinado' : 'Desde arriba';
    V.raiz.classList.toggle('cv-plano', !V.inclinado);
    visorCamara(V, false);
  };
  var ed = cont.querySelector('#cvEditar');
  if (ed) ed.onclick = function () {
    /* Para armarlo, la maqueta se aplana hasta el plano de siempre y se abre el editor. */
    V.inclinado = false;
    V.raiz.classList.add('cv-plano');
    visorCamara(V, false);
    setTimeout(function () { visorSalir(V, true); if (op.alEditar) op.alEditar(V.d); }, 420);
  };
  /* Tocar un módulo: su vista de frente. Pasar el mouse lo levanta (CSS). */
  V.mundo.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.cv-caja[data-mod]');
    if (c && !V.ficha) abrirFicha(V, c.dataset.mod, c);
  });
  /* El panel: cómo verlo (por vendedor, por estado, por antigüedad). */
  cont.querySelector('#cvPanel').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-vista]');
    if (b && b.dataset.vista !== V.vista) {
      V.vista = b.dataset.vista;
      V.resaltado = null;
      try { localStorage.setItem('vdh_visor_vista', V.vista); } catch (x) {}
      visorPintar(V); visorPanel(V);
      return;
    }
    /* Tocar a alguien de la leyenda: se iluminan sus módulos y el resto queda atenuado; tocarlo de nuevo, se ve todo. */
    var r = e.target.closest && e.target.closest('[data-resalta]');
    if (r) { V.resaltado = V.resaltado === r.dataset.resalta ? null : r.dataset.resalta; visorPintar(V); visorPanel(V); }
    if (e.target.closest && e.target.closest('#cvVerTodos')) { V.resaltado = null; visorPintar(V); visorPanel(V); }
  });
  V.alTamano = function () { if (V.d) { V.fit = {}; visorCamara(V, true); } };
  window.addEventListener('resize', V.alTamano);
  V.alTecla = function (e) { if (e.key === 'Escape' && V.ficha) cerrarFicha(V); };
  document.addEventListener('keydown', V.alTecla);
  visorCargar(V);
  return V;
}

function visorSalir(V, sinVolver) {
  window.removeEventListener('resize', V.alTamano);
  document.removeEventListener('keydown', V.alTecla);
  if (V.ficha) cerrarFicha(V, true);
  if (!sinVolver && V.op.alVolver) V.op.alVolver();
}

function visorCargar(V) {
  var L = valor(V.op.local.id);
  Promise.all([
    cargarMapa(V.op.local.id),
    leer('/orden_v_estado_local?select=modulo_id,foto_path,tomada_en,nivel,foto_de,responsable,sin_foto_reciente,tareas_abiertas&local_id=eq.' + L).catch(function () { return []; })
  ]).then(function (r) {
    V.d = r[0];
    (r[1] || []).forEach(function (x) { V.estado[x.modulo_id] = x; });
    var c = V.cont.querySelector('#cvCargando');
    if (c) c.remove();
    if (!V.d.modulos.length) { V.escena.insertAdjacentHTML('beforeend', '<p class="cv-vacio">Este local todavía no tiene módulos cargados.</p>'); return; }
    if (!V.d.dep.length) { var t = V.cont.querySelector('#cvTabs'); if (t) t.hidden = true; }
    visorDibujar(V, true);
  }).catch(function (e) {
    var c = V.cont.querySelector('#cvCargando');
    if (c) c.textContent = (esDeRed(e) ? 'Sin conexión: no se pudo cargar el local.' : mensajeDe(e)) + ' Volvé a entrar para probar de nuevo.';
  });
}

/* ── La maqueta ── */

function visorSemilla(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
/** La mercadería vista desde arriba (como en la foto de referencia): en las paredes, la ropa colgada de un caño, en
    tandas del mismo color; adentro, prendas dobladas en pilas sobre la mesa; en el depósito, cajas en estantes. */
function visorMercaderia(id, vertical, clase) {
  var s = visorSemilla(id), partes = [], x = 0, i, c;
  if (clase === 'doblada' || clase === 'cajas') {
    var tonos = [];
    for (i = 0; i < 4; i++) tonos.push((clase === 'cajas' ? ['#B98E5E', '#A87E52', '#C7A274', '#9C7449'] : VISOR_ROPA)[(s + i * 3) % (clase === 'cajas' ? 4 : VISOR_ROPA.length)] + ' ' + (i * 25) + '% ' + ((i + 1) * 25) + '%');
    var junta = clase === 'cajas' ? '#5A4231' : '#5C3F2C';
    return 'repeating-linear-gradient(90deg, transparent 0 13px, ' + junta + ' 13px 16px), repeating-linear-gradient(0deg, transparent 0 11px, ' + junta + ' 11px 14px), linear-gradient(' + (vertical ? 180 : 90) + 'deg,' + tonos.join(',') + ')';
  }
  for (i = 0; i < 14; i++) {
    c = VISOR_ROPA[(s + Math.floor(i / 2) * 5 + i) % VISOR_ROPA.length];
    var n = 3 + ((s >> i) & 3);
    for (var k = 0; k < n; k++) { partes.push(c + ' ' + x + 'px ' + (x + 4) + 'px', 'rgba(0,0,0,.42) ' + (x + 4) + 'px ' + (x + 5) + 'px'); x += 5; }
  }
  var caño = vertical ? 'linear-gradient(90deg, transparent calc(50% - 1px), #A9AEB4 calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px))'
                      : 'linear-gradient(0deg, transparent calc(50% - 1px), #A9AEB4 calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px))';
  return caño + ', repeating-linear-gradient(' + (vertical ? 180 : 90) + 'deg,' + partes.join(',') + ')';
}
/** Una caja con volumen: la tapa, sus cuatro caras y el halo en el piso. frente: qué cara mira al salón. */
function visorCaja(r, alto, clase, attrs, frente, tapa, rotulo, halo) {
  var w = r.w.toFixed(1), h = r.h.toFixed(1), a = alto;
  var cara = function (lado, estilo, contenido) {
    return '<div class="cv-cara cv-' + lado + (lado === frente ? ' cv-frente' : '') + '" style="' + estilo + '">' + (lado === frente ? contenido || '' : '') + '</div>';
  };
  return '<div class="cv-caja ' + clase + '" ' + attrs + ' style="left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + w + 'px;height:' + h + 'px;--alto:' + a + 'px' + (halo ? ';--halo:' + halo : '') + '">' +
    '<div class="cv-halo"></div>' +
    cara('s', 'left:0;top:' + (r.h - a).toFixed(1) + 'px;width:' + w + 'px;height:' + a + 'px', frente === 's' ? rotar(0) : '') +
    cara('n', 'left:0;top:0;width:' + w + 'px;height:' + a + 'px', '') +
    cara('e', 'left:' + (r.w - a).toFixed(1) + 'px;top:0;width:' + a + 'px;height:' + h + 'px', frente === 'e' ? rotar(-90) : '') +
    cara('o', 'left:0;top:0;width:' + a + 'px;height:' + h + 'px', frente === 'o' ? rotar(90) : '') +
    '<div class="cv-tapa">' + (tapa || '') + '</div>' + (rotulo || '') + '</div>';
  /* La foto del frente, derecha: en las caras de costado se gira adentro de la cara. */
  function rotar(g) {
    var largo = g ? r.h : r.w;
    return '<div class="cv-foto-cara" style="width:' + largo.toFixed(1) + 'px;height:' + a + 'px;transform:translate(-50%,-50%) rotate(' + g + 'deg)"></div>';
  }
}

function visorColor(V, m) {
  var s = V.d.sectorDe[m.sector_id];
  return (s && V.d.color[m.sector_id]) || GRIS_SIN_RESPONSABLE;
}

function visorDibujar(V, ajustar) {
  var d = V.d, pl = planoMapa(d, V.tab), out = '';
  V.plano = pl;
  V.mundo.style.width = pl.W + 'px';
  V.mundo.style.height = pl.H + 'px';
  /* El piso (cálido, de madera) y las paredes bajas, cortadas para ver adentro; el frente es vidriera. */
  out += '<div class="cv-piso" style="left:' + pl.x0 + 'px;top:' + pl.y0 + 'px;width:' + (pl.x1 - pl.x0) + 'px;height:' + (pl.y1 - pl.y0) + 'px"></div>';
  var puerta = pl.items.filter(function (x) { return x.tipo === 'puerta'; })[0], g = 11, am = VISOR_ALTO.muro;
  var muro = function (x, y, w, h, vidrio) { return visorCaja({ x: x, y: y, w: w, h: h }, am, 'cv-muro' + (vidrio ? ' cv-vidrio' : ''), '', null, '', '', ''); };
  var tramos = function (lado, desde, hasta, fijo, horiz, vidrio) {
    var cortes = [[desde, hasta]];
    if (puerta && puerta.pared === lado) {
      var a0 = horiz ? puerta.r.x : puerta.r.y, a1 = a0 + (horiz ? puerta.r.w : puerta.r.h);
      cortes = [[desde, a0], [a1, hasta]];
    }
    cortes.forEach(function (c) {
      if (c[1] - c[0] < 2) return;
      out += horiz ? muro(c[0], fijo, c[1] - c[0], g, vidrio) : muro(fijo, c[0], g, c[1] - c[0], vidrio);
    });
  };
  tramos('fondo', pl.x0 - g, pl.x1 + g, pl.y0 - g, true, false);
  tramos('izquierda', pl.y0, pl.y1, pl.x0 - g, false, false);
  tramos('derecha', pl.y0, pl.y1, pl.x1, false, false);
  tramos('frente', pl.x0 - g, pl.x1 + g, pl.y1, true, pl.tipo === 'salon');
  if (pl.tipo === 'salon') out += '<div class="cv-vereda" style="left:' + (pl.x0 - 30) + 'px;top:' + (pl.y1 + g) + 'px;width:' + (pl.x1 - pl.x0 + 60) + 'px;height:' + (pl.H - pl.y1 - g + 30) + 'px"><span>Vereda</span></div>';
  pl.items.forEach(function (it) {
    var r = it.r;
    if (it.tipo === 'puerta') {
      out += '<div class="cv-entrada" style="left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + r.w.toFixed(1) + 'px;height:' + r.h.toFixed(1) + 'px"><span>' + (pl.tipo === 'deposito' ? 'Puerta' : 'Entrada') + '</span></div>';
      return;
    }
    if (it.tipo === 'fijo') {
      if (!it.texto) { out += '<div class="cv-hueco" style="left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + r.w.toFixed(1) + 'px;height:' + r.h.toFixed(1) + 'px"></div>'; return; }
      out += visorCaja(r, VISOR_ALTO.fijo, 'cv-fijo', '', null, '<span class="cv-fijo-texto' + (r.h > r.w * 1.2 ? ' parado' : '') + '">' + esc(it.texto) + '</span>', '', '');
      return;
    }
    var m = it.m, e = V.estado[m.id] || {}, alto = pl.tipo === 'deposito' ? VISOR_ALTO.deposito : it.pared ? VISOR_ALTO.pared : VISOR_ALTO.centro;
    /* La cara que mira al salón: la de los costados mira al medio; la del frente mira hacia adentro (de espaldas a
       quien mira la maqueta), así que esos llevan la foto arriba. */
    var frente = it.pared === 'izquierda' ? 'e' : it.pared === 'derecha' ? 'o' : it.pared === 'frente' ? null : 's';
    var numero = m.isla ? numeroVista(d, m) : m.numero, que = m.isla ? m.nombre : nombrePropio(m);
    var rotulo = '<div class="cv-rotulo"><b' + (e.sin_foto_reciente || !e.foto_path ? ' class="vieja" title="Sin foto reciente"' : '') + '>' + esc(String(numero || '')) + '</b>' + (que ? '<span>' + esc(recortar(que, 18)) + '</span>' : '') + '</div>';
    var tapa = '<div class="cv-merca" style="background:' + visorMercaderia(m.id, r.h > r.w, pl.tipo === 'deposito' ? 'cajas' : it.pared ? 'colgada' : 'doblada') + '"></div><div class="cv-foto-cara cv-foto-tapa"></div>';
    out += visorCaja(r, alto, 'cv-mod' + (e.foto_path ? ' con-foto' : ' sin-foto') + (it.pared ? '' : ' adentro') + (frente ? '' : ' foto-arriba'),
      'data-mod="' + esc(m.id) + '" role="button" tabindex="0" aria-label="' + esc(nombreModulo(m, d.sectorDe[m.sector_id], d)) + '"',
      frente || 'tapa', tapa, rotulo, visorCategoria(V, m).color);
  });
  V.mundo.innerHTML = out;
  visorPintar(V);
  visorFotos(V);
  visorPanel(V);
  if (ajustar) { V.fit = {}; visorCamara(V, true); }
}

/* ── La cámara: inclinada o desde arriba, centrada y del tamaño de la pantalla ── */

function visorMedir(V, incl) {
  var mu = V.mundo, box = V.escena.getBoundingClientRect();
  mu.style.transition = 'none';
  mu.style.setProperty('--incl', incl + 'deg');
  mu.style.setProperty('--s', 1);
  mu.style.setProperty('--dx', '0px'); mu.style.setProperty('--dy', '0px');
  var u = null;
  mu.querySelectorAll('.cv-piso, .cv-tapa, .cv-vereda').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    u = u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  });
  if (!u) return { s: 1, dx: 0, dy: 0 };
  var s = Math.min((box.width - 24) / (u.r - u.l), (box.height - 24) / (u.b - u.t));
  s = Math.max(0.2, Math.min(s, 1.6));
  /* El centro de lo que se ve, al centro de la escena (lo inclinado sube las tapas). */
  var cx = (u.l + u.r) / 2 - (box.left + box.width / 2), cy = (u.t + u.b) / 2 - (box.top + box.height / 2);
  return { s: s, dx: -cx * s, dy: -cy * s };
}
function visorCamara(V, sinAnimar) {
  var incl = V.inclinado ? VISOR_INCL : 0, clave = String(incl) + V.tab;
  var mu = V.mundo, antes = mu.style.transform;
  if (!V.fit[clave]) V.fit[clave] = visorMedir(V, incl);
  var f = V.fit[clave];
  if (!sinAnimar) { mu.style.transition = 'none'; void mu.offsetWidth; }
  mu.style.transition = sinAnimar ? 'none' : '';
  mu.style.setProperty('--incl', incl + 'deg');
  mu.style.setProperty('--s', f.s.toFixed(3));
  mu.style.setProperty('--dx', f.dx.toFixed(1) + 'px');
  mu.style.setProperty('--dy', f.dy.toFixed(1) + 'px');
  /* Los números se leen igual aunque la maqueta quede chica. */
  mu.style.setProperty('--zc', Math.max(1, 0.9 / f.s).toFixed(2));
  void antes;
}

/* ── Las fotos de los módulos: una miniatura liviana para la maqueta; la grande, sólo al entrar al módulo ── */

var _miniaturas = {}, _miniCola = [], _miniActivas = 0;
/** Una miniatura (240 px) de la foto: se arma una vez en el teléfono y queda guardada en este aparato. */
function miniaturaFoto(ruta) {
  if (!ruta) return Promise.resolve(null);
  if (_miniaturas[ruta]) return _miniaturas[ruta];
  var p = miniLeerGuardada(ruta).then(function (blob) {
    if (blob) return URL.createObjectURL(blob);
    return new Promise(function (ok) { _miniCola.push({ ruta: ruta, ok: ok }); miniSiguiente(); });
  });
  _miniaturas[ruta] = p;
  p.then(function (u) { if (!u) delete _miniaturas[ruta]; });
  return p;
}
function miniSiguiente() {
  if (_miniActivas >= 4 || !_miniCola.length) return;
  var t = _miniCola.shift();
  _miniActivas++;
  var fin = function (u) { _miniActivas--; t.ok(u); miniSiguiente(); };
  urlFirmada(t.ruta).then(function (u) {
    if (!u) { fin(null); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var lado = 240, esc2 = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * esc2)); c.height = Math.max(1, Math.round(img.naturalHeight * esc2));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b) { fin(u); return; }
          miniGuardar(t.ruta, b);
          fin(URL.createObjectURL(b));
        }, 'image/jpeg', 0.72);
      } catch (e) { fin(u); }   // si el navegador no deja leerla, se usa la grande
    };
    img.onerror = function () { fin(null); };
    img.src = u;
  }, function () { fin(null); });
}
var _miniBase = null;
function miniBase() {
  if (_miniBase) return _miniBase;
  _miniBase = new Promise(function (ok) {
    try {
      var r = indexedDB.open('vdh-miniaturas', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('fotos'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ok(null); };
    } catch (e) { ok(null); }
  });
  return _miniBase;
}
function miniLeerGuardada(ruta) {
  return miniBase().then(function (db) {
    if (!db) return null;
    return new Promise(function (ok) {
      try { var q = db.transaction('fotos').objectStore('fotos').get(ruta); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }
      catch (e) { ok(null); }
    });
  });
}
function miniGuardar(ruta, blob) {
  miniBase().then(function (db) { if (db) try { db.transaction('fotos', 'readwrite').objectStore('fotos').put(blob, ruta); } catch (e) {} });
}
function visorFotos(V) {
  V.mundo.querySelectorAll('.cv-caja[data-mod]').forEach(function (c) {
    var e = V.estado[c.dataset.mod];
    if (!e || !e.foto_path) return;
    miniaturaFoto(e.foto_path).then(function (u) {
      if (!u) { c.classList.add('foto-no'); return; }
      c.querySelectorAll('.cv-foto-cara').forEach(function (f) { f.style.backgroundImage = 'url("' + u + '")'; });
      c.classList.add('foto-lista');
    });
  });
}

/* ── Cómo verlo: el color de cada módulo (el halo y el borde del número) ──
   Por vendedor: el de quien lo tiene (el mismo de siempre: identifica a la persona). Por estado del orden: el nivel de
   la última foto, con los colores de la app. Por antigüedad de la foto: de verde (de hoy) a rojo (más de 7 días). */
var VISOR_VISTAS = { vendedor: 'Vendedor', estado: 'Estado', antiguedad: 'Antigüedad' };
var VISOR_ESTADOS = [['impecable', 'Impecable', '#C6F432'], ['bien', 'Bien', '#5BD68A'], ['a_mejorar', 'A mejorar', '#F5B84B'], ['fuera_de_estandar', 'Fuera de estándar', '#FF8A8A'], ['sin', 'Sin foto', '#6E7684']];
var VISOR_EDADES = [['0', 'Hoy o ayer', '#5BD68A'], ['2', 'De 2 a 4 días', '#B9DE6A'], ['5', 'De 5 a 7 días', '#F5B84B'], ['8', 'Más de 7 días', '#FF8A8A'], ['sin', 'Sin foto', '#6E7684']];
function visorDias(ts) { return Math.round((new Date(hoyAR() + 'T12:00:00Z') - new Date(hoyAR(new Date(ts)) + 'T12:00:00Z')) / 864e5); }
/** La categoría de un módulo en la vista elegida: { clave, texto, color }. */
function visorCategoria(V, m) {
  var e = V.estado[m.id] || {}, x;
  if (V.vista === 'estado') {
    x = VISOR_ESTADOS.filter(function (s) { return s[0] === (e.foto_path && e.nivel ? e.nivel : 'sin'); })[0] || VISOR_ESTADOS[4];
    return { clave: 'c:' + x[0], texto: x[1], color: x[2] };
  }
  if (V.vista === 'antiguedad') {
    var dd = e.foto_path && e.tomada_en ? visorDias(e.tomada_en) : null;
    x = dd == null ? VISOR_EDADES[4] : dd <= 1 ? VISOR_EDADES[0] : dd <= 4 ? VISOR_EDADES[1] : dd <= 7 ? VISOR_EDADES[2] : VISOR_EDADES[3];
    return { clave: 'c:' + x[0], texto: x[1], color: x[2] };
  }
  var s = V.d.sectorDe[m.sector_id], p = s && s.responsable_id;
  return { clave: 'p:' + (p || 'nadie'), texto: p && V.d.persona[p] ? nombreLista(V.d.persona[p]) : 'Sin responsable', color: visorColor(V, m) };
}
/** Cambiar de vista no vuelve a armar la maqueta: sólo cambia los colores (con una transición suave). */
function visorPintar(V) {
  V.mundo.querySelectorAll('.cv-caja[data-mod]').forEach(function (c) {
    var m = visorModulo(V, c.dataset.mod);
    if (!m) return;
    var k = visorCategoria(V, m);
    c.style.setProperty('--halo', k.color);
    c.classList.toggle('cv-resaltado', !!V.resaltado && k.clave === V.resaltado);
    c.classList.toggle('cv-apagado', !!V.resaltado && k.clave !== V.resaltado);
  });
}
function visorModulosTab(V) { return V.tab === 'deposito' ? V.d.dep : V.d.pared.concat(V.d.islas); }

function visorPanel(V) {
  var mods = visorModulosTab(V), grupos = {}, orden = [];
  mods.forEach(function (m) {
    var k = visorCategoria(V, m);
    if (!grupos[k.clave]) { grupos[k.clave] = { k: k, n: 0 }; orden.push(k.clave); }
    grupos[k.clave].n++;
  });
  /* En las vistas por estado y por antigüedad, la leyenda va en su orden (de lo mejor a lo peor). */
  var lista = V.vista === 'vendedor' ? orden.sort(function (a, b) { return a === 'p:nadie' ? 1 : b === 'p:nadie' ? -1 : 0; })
    : (V.vista === 'estado' ? VISOR_ESTADOS : VISOR_EDADES).map(function (x) { return 'c:' + x[0]; }).filter(function (k) { return grupos[k]; });
  var sinFoto = mods.filter(function (m) { var e = V.estado[m.id]; return !e || !e.foto_path; }).length;
  var viejas = mods.filter(function (m) { var e = V.estado[m.id]; return e && e.foto_path && e.sin_foto_reciente; }).length;
  var abierto = window.innerWidth >= 900 ? ' open' : '';
  V.cont.querySelector('#cvPanel').innerHTML =
    '<p class="cv-rotulo-sec">Ver por</p><div class="cv-seg cv-vistas" role="group" aria-label="Ver por">' + Object.keys(VISOR_VISTAS).map(function (k) {
      return '<button type="button" data-vista="' + k + '" aria-pressed="' + (V.vista === k) + '">' + VISOR_VISTAS[k] + '</button>';
    }).join('') + '</div>' +
    '<div class="cv-ley" role="list">' + lista.map(function (k) {
      var g = grupos[k];
      return '<button type="button" class="cv-ley-item" role="listitem" data-resalta="' + esc(k) + '" aria-pressed="' + (V.resaltado === k) + '"><i style="background:' + g.k.color + '"></i><b>' + esc(g.k.texto) + '</b><small>' + g.n + '</small></button>';
    }).join('') + '</div>' +
    (V.resaltado ? '<button type="button" class="cv-chico cv-ver-todos" id="cvVerTodos">Ver todos</button>' : '') +
    '<p class="cv-ayuda"><span class="cv-punto-viejo" aria-hidden="true"></span> Sin foto reciente (más de 7 días). Tocá un módulo para ver su foto.</p>' +
    '<details class="cv-sec"' + abierto + '><summary>De un vistazo</summary><div class="cv-vistazo"><span><b>' + mods.length + '</b> módulos</span>' +
      (sinFoto ? '<span><b>' + sinFoto + '</b> sin foto</span>' : '') + (viejas ? '<span><b>' + viejas + '</b> con la foto de hace más de 7 días</span>' : '') + '</div></details>';
}

/* ── La vista de frente de un módulo ── */

function visorModulo(V, id) { return V.d.modulos.filter(function (m) { return m.id === id; })[0]; }
function textoHace(ts) {
  if (!ts) return '';
  var dias = Math.round((new Date(hoyAR() + 'T12:00:00Z') - new Date(hoyAR(new Date(ts)) + 'T12:00:00Z')) / 864e5);
  return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
}
function visorDonde(V, m) {
  var it = (V.plano.items || []).filter(function (x) { return x.m && x.m.id === m.id; })[0];
  if (V.tab === 'deposito') return 'Depósito';
  if (!it || !it.pared) return 'Adentro del salón';
  return { izquierda: 'Pared izquierda', fondo: 'Fondo', derecha: 'Pared derecha', frente: 'Frente' }[it.pared];
}

function abrirFicha(V, id, caja) {
  var m = visorModulo(V, id);
  if (!m) return;
  var d = V.d, e = V.estado[id] || {}, s = d.sectorDe[m.sector_id], resp = s && d.persona[s.responsable_id], sup = s && d.persona[s.suplente_id];
  var numero = m.isla ? numeroVista(d, m) : m.numero, que = m.isla ? m.nombre : nombrePropio(m);
  var titulo = (s && s.tipo === 'deposito' ? 'Depósito ' : 'Módulo ') + numero, ref = m.foto_referencia_path;
  var origen = caja.querySelector('.cv-frente, .cv-tapa');
  V.raiz.insertAdjacentHTML('beforeend', '<div class="cv-ficha-fondo"></div><section class="cv-ficha" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
    '<header class="cv-ficha-cab"><div><small>' + esc(visorDonde(V, m)) + '</small><h2>' + esc(titulo) + '</h2>' + (que ? '<p class="cv-que">' + esc(que) + '</p>' : '') + '</div>' +
      '<button class="cv-cerrar" type="button" aria-label="Volver al plano">×</button></header>' +
    '<div class="cv-ficha-cuerpo">' +
      '<div class="cv-fotos' + (ref ? ' con-ref' : '') + '" id="cvFotos">' +
      (e.foto_path
        ? '<figure class="cv-foto cv-ahora"><div class="cv-foto-img" id="cvFotoGrande" data-amplia="ahora"></div><figcaption id="cvFotoPie">' + esc(visorPie(e.tomada_en, e.foto_de)) + '</figcaption>' +
          '<div class="cv-historia" id="cvHistoria" hidden></div></figure>'
        : '<div class="cv-sin-foto"><div class="cv-sin-foto-ico" aria-hidden="true"></div><p><b>Todavía no hay una foto de este módulo.</b></p>' +
          (V.op.puedeSugerir && resp ? '<button class="cv-boton cv-lima" type="button" id="cvPedirFoto">Pedirle la foto a ' + esc(nombreLista(resp)) + '</button>' : resp ? '' : '<p>No tiene responsable: asignáselo en Por local.</p>') + '</div>') +
      (ref ? '<figure class="cv-foto cv-ref"><div class="cv-foto-img" id="cvFotoRef" data-amplia="ref"></div><figcaption><b>Así se arma en VDH</b></figcaption></figure>' : '') + '</div>' +
      '<div class="cv-datos">' + (e.nivel ? '<span class="cv-nivel nivel-' + esc(e.nivel) + '">' + esc(NIVEL[e.nivel] || e.nivel) + '</span>' : '') +
        '<span class="cv-persona"><i style="background:' + visorColor(V, m) + '"></i>' + esc(resp ? nombreLista(resp) : 'Sin responsable') + (sup ? ' · lo cubre ' + esc(nombreLista(sup)) : '') + '</span>' +
        (+e.tareas_abiertas ? '<span>' + e.tareas_abiertas + (+e.tareas_abiertas === 1 ? ' tarea abierta' : ' tareas abiertas') + '</span>' : '') + '</div>' +
      '<div class="cv-ia" id="cvIa">' + (e.foto_path ? '<p class="cv-gris">Buscando lo que vio la IA…</p>' : '') + '</div>' +
    '</div></section>');
  var fondo = V.raiz.querySelector('.cv-ficha-fondo'), ficha = V.raiz.querySelector('.cv-ficha');
  V.ficha = { el: ficha, fondo: fondo, caja: caja, id: id };
  ficha.querySelector('.cv-cerrar').onclick = function () { cerrarFicha(V); };
  fondo.onclick = function () { cerrarFicha(V); };
  if (V.op.capa) { V.ficha.alAtras = function (porNavegar) { if (!porNavegar) cerrarFicha(V, false, true); }; V.op.capa.abrir(V.ficha.alAtras); }
  /* La foto: primero la miniatura (ya está), después la grande. Al lado, la de referencia; tocar una la agranda. */
  if (e.foto_path) { visorCargarFoto(ficha.querySelector('#cvFotoGrande'), e.foto_path); visorIa(V, id); }
  if (ref) visorCargarFoto(ficha.querySelector('#cvFotoRef'), ref);
  var fotos = ficha.querySelector('#cvFotos');
  fotos.addEventListener('click', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-amplia]');
    if (!f || !fotos.classList.contains('con-ref')) return;
    var cl = 'amplia-' + f.dataset.amplia, ya = fotos.classList.contains(cl);
    fotos.classList.remove('amplia-ahora', 'amplia-ref');
    if (!ya) fotos.classList.add(cl);
  });
  var pf = ficha.querySelector('#cvPedirFoto');
  if (pf) pf.onclick = function () { visorPedirFoto(V, m, resp, pf); };
  /* El zoom: la ficha sale desde la cara del módulo y crece hasta su lugar. */
  var desde = origen.getBoundingClientRect(), hasta = ficha.getBoundingClientRect();
  V.escena.classList.add('cv-detras');
  if (visorMovimiento()) {
    ficha.animate([{ transform: visorDesde(desde, hasta), opacity: 0.35, borderRadius: '6px' }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    fondo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  }
  ficha.querySelector('.cv-cerrar').focus({ preventScroll: true });
}
function visorMovimiento() { return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function visorDesde(a, b) {
  var sx = Math.max(0.05, a.width / b.width), sy = Math.max(0.05, a.height / b.height);
  return 'translate(' + ((a.left + a.width / 2) - (b.left + b.width / 2)).toFixed(1) + 'px,' + ((a.top + a.height / 2) - (b.top + b.height / 2)).toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
}
function cerrarFicha(V, ya, porAtras) {
  var f = V.ficha;
  if (!f || f.cerrando) return;
  f.cerrando = true;
  if (V.op.capa && f.alAtras && !porAtras) V.op.capa.soltar(f.alAtras);
  var fin = function () { f.el.remove(); f.fondo.remove(); if (V.ficha === f) V.ficha = null; };
  V.escena.classList.remove('cv-detras');
  var origen = f.caja && document.body.contains(f.caja) ? f.caja.querySelector('.cv-frente, .cv-tapa') : null;
  if (ya || !origen || !visorMovimiento()) { fin(); return; }
  /* La vuelta: la ficha se achica hasta la cara del módulo. */
  var hasta = origen.getBoundingClientRect(), desde = f.el.getBoundingClientRect();
  var a = f.el.animate([{ transform: 'none', opacity: 1 }, { transform: visorDesde(hasta, desde), opacity: 0.2 }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  f.fondo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
  a.onfinish = fin;
  setTimeout(fin, 420);
}

/** Lo que vio la IA en la última foto (y lo que dijo quien la revisó). */
function visorIa(V, id) {
  leer('/orden_v_controles?select=id,foto_path,tomada_en,nivel,nivel_ia,nivel_final,persona_nombre,ia_resultado,comentario&modulo_id=eq.' + valor(id) +
       '&foto_path=not.is.null&order=tomada_en.desc&limit=12').then(function (h) {
    if (!V.ficha || V.ficha.id !== id) return;
    V.ficha.historia = h || [];
    var z = V.ficha.el.querySelector('#cvIa');
    if (z) z.innerHTML = visorTextoIa((h || [])[0]);
    visorHistoria(V);
  }).catch(function () {
    var z = V.ficha && V.ficha.id === id && V.ficha.el.querySelector('#cvIa');
    if (z) z.innerHTML = '<p class="cv-gris">Sin conexión: no se pudo ver lo que dijo la IA.</p>';
  });
}
/** "hace 3 días · 10/10 15:32 · sacada por Lautaro". */
function visorPie(ts, quien) { return ts ? textoHace(ts) + ' · ' + diaMes(ts) + ' ' + hora(ts) + (quien ? ' · sacada por ' + quien : '') : ''; }
/** Pone una foto en un recuadro: primero la miniatura (si está), después la grande. Si ya no se guarda, lo dice. */
function visorCargarFoto(div, ruta) {
  if (!div) return;
  div.dataset.ruta = ruta;
  div.classList.remove('cv-nitida', 'cv-foto-falla');
  div.textContent = '';
  var sigue = function () { return div.dataset.ruta === ruta; };
  var falla = function () { if (!sigue()) return; div.style.backgroundImage = ''; div.classList.add('cv-foto-falla'); div.textContent = 'Esta foto ya no está guardada.'; };
  miniaturaFoto(ruta).then(function (u) { if (u && sigue() && !div.classList.contains('cv-nitida')) div.style.backgroundImage = 'url("' + u + '")'; });
  urlFirmada(ruta).then(function (u) {
    if (!sigue()) return;
    if (!u) { falla(); return; }
    var img = new Image();
    img.onload = function () { if (!sigue()) return; div.style.backgroundImage = 'url("' + u + '")'; div.classList.add('cv-nitida'); };
    img.onerror = falla;
    img.src = u;
  });
}
/** El deslizador: de la foto más vieja que se guarda (a la izquierda) a la de ahora (a la derecha). */
function visorHistoria(V) {
  var f = V.ficha, h = f && f.historia, z = f && f.el.querySelector('#cvHistoria');
  if (!z || !h || h.length < 2) return;
  z.hidden = false;
  z.innerHTML = '<label class="cv-hist-tit" for="cvHist">Cómo estaba antes</label>' +
    '<input type="range" id="cvHist" min="0" max="' + (h.length - 1) + '" step="1" value="' + (h.length - 1) + '" aria-valuetext="Ahora">' +
    '<div class="cv-hist-marcas"><span>' + esc(diaMes(h[h.length - 1].tomada_en)) + '</span><span>Ahora</span></div>';
  var r = z.querySelector('#cvHist'), fig = f.el.querySelector('.cv-ahora'), pie = f.el.querySelector('#cvFotoPie');
  r.addEventListener('input', function () {
    var i = h.length - 1 - (+r.value), c = h[i];
    visorCargarFoto(f.el.querySelector('#cvFotoGrande'), c.foto_path);
    fig.classList.toggle('cv-antes', i > 0);
    pie.textContent = (i > 0 ? 'Antes: ' : '') + visorPie(c.tomada_en, c.persona_nombre) + (c.nivel ? ' · ' + (NIVEL[c.nivel] || c.nivel) : '');
    r.setAttribute('aria-valuetext', i > 0 ? diaMes(c.tomada_en) : 'Ahora');
    var ia = f.el.querySelector('#cvIa');
    if (ia) ia.innerHTML = visorTextoIa(c);
  });
}
function visorTextoIa(c) {
  if (!c) return '';
  var hall = ((c.ia_resultado || {}).hallazgos || []).slice(0, 4);
  return '<h3>Lo que vio la IA</h3>' + (c.nivel_ia ? '<p class="cv-gris">Le dio <b>' + esc(NIVEL[c.nivel_ia] || c.nivel_ia) + '</b>' +
      (c.nivel_final && c.nivel_final !== c.nivel_ia ? '; quien la revisó le dejó <b>' + esc(NIVEL[c.nivel_final] || c.nivel_final) + '</b>' : '') + '.</p>' : '') +
    (hall.length ? '<ul>' + hall.map(function (x) { return '<li><span class="cv-grav ' + (x.gravedad === 'corregir' ? 'mal' : '') + '">' + (x.gravedad === 'corregir' ? 'Corregir' : 'Ojo') + '</span>' + esc(x.titulo || '') + '</li>'; }).join('') + '</ul>'
                 : '<p class="cv-gris">' + (c.nivel_ia ? 'No marcó nada para corregir.' : 'Esta foto no pasó por la IA.') + '</p>') +
    (c.comentario ? '<p class="cv-comentario">"' + esc(c.comentario) + '"</p>' : '');
}

/** Sin foto: se le pide al que lo tiene (una tarea con foto, como las de siempre). */
function visorPedirFoto(V, m, resp, boton) {
  var titulo = 'Sacale una foto a ' + nombreModulo(m, V.d.sectorDe[m.sector_id], V.d).replace(/^M/, 'm');
  boton.disabled = true;
  boton.textContent = 'Pidiendo…';
  visorMandarTarea(m, resp, titulo, 'Desde el croquis: el módulo no tiene foto.', 'hoy', true).then(function () {
    boton.textContent = 'Listo: le llegó a ' + nombreLista(resp);
    avisarVisor('Le pedimos la foto a ' + nombreLista(resp) + '.');
  }, function (e) {
    boton.disabled = false;
    boton.textContent = 'Pedirle la foto a ' + nombreLista(resp);
    avisarVisor(esDeRed(e) ? 'Sin conexión: no se mandó. Probá de nuevo.' : mensajeDe(e));
  });
}
/** Manda una tarea al responsable del módulo sin duplicarla: si una tarea igual ya llegó en los últimos minutos (por
    ejemplo, se cortó la conexión después de mandarla), no se manda otra. */
function visorMandarTarea(m, resp, titulo, detalle, plazo, conFoto) {
  titulo = String(titulo).trim().slice(0, 140);
  var desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  return leer('/orden_tareas?select=id&persona_id=eq.' + valor(resp.id) + '&modulo_id=eq.' + valor(m.id) + '&titulo=eq.' + encodeURIComponent(titulo) +
              '&creado_en=gte.' + encodeURIComponent(desde) + '&limit=1').catch(function () { return []; })
    .then(function (ya) {
      if (ya && ya.length) return ya;
      return llamar('orden_crear_tarea', { p_personas: [resp.id], p_titulo: titulo, p_detalle: detalle || null, p_modulo: m.id, p_plazo: plazo, p_requiere_foto: !!conFoto });
    });
}
function avisarVisor(texto) {
  if (typeof avisar === 'function') { avisar(texto); return; }
}
