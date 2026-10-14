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
  if (_visorActual) visorSalir(_visorActual, true);
  var V = { op: op, cont: cont, tab: 'salon', inclinado: true, estado: {}, d: null, ficha: null, fit: {}, vista: 'vendedor' };
  _visorActual = V;
  try {
    V.liviano = localStorage.getItem('vdh_visor_liviano') === '1';
    V.vista = localStorage.getItem('vdh_visor_vista') || 'vendedor';
    V.inclinado = localStorage.getItem('vdh_visor_cam') !== 'arriba';
  } catch (e) { V.liviano = false; }
  if (!VISOR_VISTAS[V.vista]) V.vista = 'vendedor';
  cont.innerHTML = '<div class="cv' + (V.liviano ? ' cv-liviano' : '') + (V.inclinado ? '' : ' cv-plano') + '">' +
    '<header class="cv-cab"><button class="cv-volver" id="volverMapa" type="button">‹ Volver</button>' +
      '<div class="cv-titulo"><small>Modo observador</small><b>' + esc(op.local.nombre || '') + '</b></div>' +
      '<div class="cv-cab-acc"><div class="cv-seg" id="cvTabs" role="group" aria-label="Qué mirar">' +
        '<button type="button" data-tab="salon" aria-pressed="true">Salón</button><button type="button" data-tab="deposito" aria-pressed="false">Depósito</button></div>' +
        '<div class="cv-seg" id="cvCam" role="group" aria-label="Cómo mirar la maqueta"><button type="button" data-cam="incl" aria-pressed="' + V.inclinado + '">Inclinado</button>' +
          '<button type="button" data-cam="arriba" aria-pressed="' + !V.inclinado + '">Desde arriba</button></div>' +
        (op.puedeEditar ? '<button class="cv-chico cv-lima" id="cvEditar" type="button">Armar el croquis</button>' : '') + '</div></header>' +
    '<div class="cv-cuerpo"><div class="cv-escena" id="cvEscena"><div class="cv-zoom" id="cvZoom"><div class="cv-camara"><div class="cv-mundo" id="cvMundo"></div></div></div>' +
      '<div class="cv-zoom-acc"><button type="button" id="cvCentrar" class="cv-chico" hidden>Centrar</button>' +
        '<button type="button" id="cvMenos" class="cv-redondo" aria-label="Alejar">−</button><button type="button" id="cvMas" class="cv-redondo" aria-label="Acercar">+</button></div>' +
      '<p class="cv-cargando" id="cvCargando">Cargando el local…</p></div>' +
      '<aside class="cv-panel" id="cvPanel"></aside></div></div>';
  V.raiz = cont.querySelector('.cv');
  V.mundo = cont.querySelector('#cvMundo');
  V.zoomEl = cont.querySelector('#cvZoom');
  V.z = { k: 1, x: 0, y: 0 };
  V.escena = cont.querySelector('#cvEscena');
  cont.querySelector('#volverMapa').onclick = function () { if (V.ficha && !V.ficha.cerrando) { cerrarFicha(V); return; } visorSalir(V); };
  cont.querySelector('#cvTabs').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === V.tab) return;
    V.tab = b.dataset.tab;
    V.resaltado = null;
    visorZoom(V, 1, 0, 0, false);   // sin animar: la maqueta nueva se mide enseguida
    cont.querySelectorAll('#cvTabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    visorDibujar(V, true);
  };
  cont.querySelector('#cvCam').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-cam]');
    if (!b || (b.dataset.cam === 'incl') === V.inclinado) return;
    V.inclinado = b.dataset.cam === 'incl';
    try { localStorage.setItem('vdh_visor_cam', V.inclinado ? 'incl' : 'arriba'); } catch (x) {}
    cont.querySelectorAll('#cvCam [data-cam]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    V.raiz.classList.toggle('cv-plano', !V.inclinado);
    visorCamara(V, false);
  };
  var ed = cont.querySelector('#cvEditar');
  if (ed) ed.onclick = function () {
    /* Para armarlo, la maqueta se aplana hasta el plano de siempre y se abre el editor. */
    V.inclinado = false;
    V.raiz.classList.add('cv-plano');
    cont.querySelectorAll('#cvCam [data-cam]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.cam === 'arriba'); });
    visorCamara(V, false);
    setTimeout(function () { visorSalir(V, true); if (op.alEditar) op.alEditar(V.d); }, 420);
  };
  /* Tocar un módulo: su vista de frente. Pasar el mouse lo levanta (CSS). */
  V.mundo.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.cv-caja[data-mod]');
    /* Después de mover la maqueta con el dedo, soltarla arriba de un módulo no lo abre. */
    if (!c || Date.now() - (V.movidoEn || 0) <= 350) return;
    if (V.ficha && V.ficha.cerrando && V.ficha.fin) V.ficha.fin();
    if (!V.ficha) abrirFicha(V, c.dataset.mod, c);
  });
  V.mundo.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target.closest && e.target.closest('.cv-caja[data-mod]');
    if (!c || V.ficha) return;
    e.preventDefault();
    abrirFicha(V, c.dataset.mod, c);
  });
  visorGestos(V);
  /* El panel: cómo verlo (por vendedor, por estado, por antigüedad). */
  cont.querySelector('#cvPanel').addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#cvLiviano')) {
      V.liviano = !V.liviano;
      V.raiz.classList.toggle('cv-liviano', V.liviano);
      try { localStorage.setItem('vdh_visor_liviano', V.liviano ? '1' : '0'); } catch (x) {}
      visorPanel(V);
      return;
    }
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
    var ab = e.target.closest && e.target.closest('[data-abrir]');
    if (ab && !V.ficha) { var cj = V.mundo.querySelector('.cv-caja[data-mod="' + ab.dataset.abrir + '"]'); if (cj) abrirFicha(V, ab.dataset.abrir, cj); }
  });
  V.alTamano = function () {
    if (!document.body.contains(V.raiz)) { visorSalir(V, true); return; }
    if (V.ficha) { V.ajustePendiente = true; return; }
    if (V.d) { visorZoom(V, 1, 0, 0, false); V.fit = {}; visorCamara(V, true); }
  };
  window.addEventListener('resize', V.alTamano);
  V.alTecla = function (e) {
    if (!document.body.contains(V.raiz)) { visorSalir(V, true); return; }
    if (e.key === 'Escape' && V.ficha) cerrarFicha(V);
  };
  document.addEventListener('keydown', V.alTecla);
  visorCargar(V);
  return V;
}

var _visorActual = null;
function visorSalir(V, sinVolver) {
  if (_visorActual === V) _visorActual = null;
  window.removeEventListener('resize', V.alTamano);
  document.removeEventListener('keydown', V.alTecla);
  if (V.ficha) cerrarFicha(V, true);
  if (!sinVolver && V.op.alVolver) V.op.alVolver();
}

function visorCargar(V) {
  var L = valor(V.op.local.id);
  Promise.all([
    cargarMapa(V.op.local.id),
    /* Con el SQL 113, el local entero (también para los vendedores, que de la vista sólo ven sus fotos); sin él, la vista. */
    llamar('orden_visor_estado', { p_local: V.op.local.id }).catch(function () {
      return leer('/orden_v_estado_local?select=modulo_id,foto_path,tomada_en,nivel,foto_de,responsable,sin_foto_reciente,tareas_abiertas&local_id=eq.' + L);
    }).catch(function () { return []; })
  ]).then(function (r) {
    V.d = r[0];
    (r[1] || []).forEach(function (x) { V.estado[x.modulo_id] = x; });
    var c = V.cont.querySelector('#cvCargando');
    if (c) c.remove();
    if (!V.d.modulos.length) {
      V.raiz.classList.add('cv-sin-modulos');
      V.escena.insertAdjacentHTML('beforeend', '<p class="cv-vacio">Este local todavía no tiene módulos cargados.</p>');
      return;
    }
    if (V.d.aprox) V.escena.insertAdjacentHTML('beforeend', '<p class="cv-aviso">Todavía no se armó el croquis de este local: los módulos están ubicados a ojo.</p>');
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
/** Una caja con volumen: la tapa, sus caras y el halo en el piso. frente: qué cara mira al salón. caras: cuáles se
    dibujan ('snoe'): las que nunca quedan de frente a quien mira no se dibujan (cuestan en cada cuadro). */
function visorCaja(r, alto, clase, attrs, frente, tapa, rotulo, halo, caras) {
  var w = r.w.toFixed(1), h = r.h.toFixed(1), a = alto;
  caras = caras || 'snoe';
  var cara = function (lado, estilo, contenido) {
    if (caras.indexOf(lado) < 0 && lado !== frente) return '';
    return '<div class="cv-cara cv-' + lado + (lado === frente ? ' cv-frente' : '') + '" style="' + estilo + '">' + (lado === frente ? contenido || '' : '') + '</div>';
  };
  return '<div class="cv-caja ' + clase + '" ' + attrs + ' style="left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + w + 'px;height:' + h + 'px;--alto:' + a + 'px' + (halo ? ';--halo:' + halo : '') + '">' +
    (halo ? '<div class="cv-halo"></div>' : '') +
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

/** Qué caras de una caja pueden quedar de frente a quien mira (la cámara está arriba del centro del local): la de abajo
    siempre; la de arriba, si la caja está en la mitad de abajo; las de los costados, según de qué lado del centro esté. */
function visorCaras(pl, r) {
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return 's' + (cy > pl.H * 0.45 ? 'n' : '') + (cx < pl.W * 0.58 ? 'e' : '') + (cx > pl.W * 0.42 ? 'o' : '');
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
  /* De cada pared, la cara de adentro (la de afuera nunca se ve); del frente, también la de la vereda. */
  var adentro = { fondo: 's', izquierda: 'e', derecha: 'o', frente: 'ns' };
  var muro = function (x, y, w, h, vidrio, lado) { return visorCaja({ x: x, y: y, w: w, h: h }, am, 'cv-muro' + (vidrio ? ' cv-vidrio' : ''), '', null, '', '', '', adentro[lado]); };
  var tramos = function (lado, desde, hasta, fijo, horiz, vidrio) {
    var cortes = [[desde, hasta]];
    if (puerta && puerta.pared === lado) {
      var a0 = horiz ? puerta.r.x : puerta.r.y, a1 = a0 + (horiz ? puerta.r.w : puerta.r.h);
      cortes = [[desde, a0], [a1, hasta]];
    }
    cortes.forEach(function (c) {
      if (c[1] - c[0] < 2) return;
      out += horiz ? muro(c[0], fijo, c[1] - c[0], g, vidrio, lado) : muro(fijo, c[0], g, c[1] - c[0], vidrio, lado);
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
      out += visorCaja(r, VISOR_ALTO.fijo, 'cv-fijo', '', null, '<span class="cv-fijo-texto' + (r.h > r.w * 1.2 ? ' parado' : '') + '">' + esc(it.texto) + '</span>', '', '', visorCaras(pl, r));
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
      frente || 'tapa', tapa, rotulo, visorCategoria(V, m).color, visorCaras(pl, r));
  });
  V.mundo.innerHTML = out;
  visorPintar(V);
  visorFotos(V);
  visorPanel(V);
  if (ajustar) { V.fit = {}; visorCamara(V, true); }
}

/* ── Acercar y alejar: con dos dedos, con la rueda del mouse o con los botones; acercada, se mueve con un dedo ── */
function visorZoom(V, k, x, y, animar) {
  k = Math.max(1, Math.min(3.5, k));
  if (k === 1) { x = 0; y = 0; }
  var r = V.escena.getBoundingClientRect(), lx = r.width * (k - 1) / 2 + 80, ly = r.height * (k - 1) / 2 + 80;
  V.z = { k: k, x: Math.max(-lx, Math.min(lx, x)), y: Math.max(-ly, Math.min(ly, y)) };
  V.zoomEl.classList.toggle('cv-gesto', !animar);
  V.zoomEl.style.transform = 'translate(' + V.z.x.toFixed(1) + 'px,' + V.z.y.toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
  visorRotulos(V);
  var ce = V.cont.querySelector('#cvCentrar');
  if (ce) ce.hidden = k === 1;
}
/** Los números se leen igual aunque la maqueta quede chica, y al acercar no se agrandan tanto (quedan sobre su módulo). */
function visorRotulos(V) {
  var base = Math.max(1, 0.9 / (V.sFit || 1)), k = (V.z && V.z.k) || 1;
  V.mundo.style.setProperty('--zc', Math.max(0.42, base / Math.pow(k, 0.8)).toFixed(3));
  if (V.raiz) V.raiz.classList.toggle('cv-nombres-ocultos', (V.sFit || 1) * k < 0.68);
}
/** Acercar manteniendo quieto el punto f (de la pantalla). */
function visorZoomEn(V, k2, f, animar) {
  var r = V.escena.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, z = V.z;
  k2 = Math.max(1, Math.min(3.5, k2));
  visorZoom(V, k2, (f.x - cx) - k2 * ((f.x - cx) - z.x) / z.k, (f.y - cy) - k2 * ((f.y - cy) - z.y) / z.k, animar);
}
function visorGestos(V) {
  var esc = V.escena, dedos = {}, ini = null;
  var centro = function () { var r = esc.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  V.cont.querySelector('#cvMas').onclick = function () { visorZoomEn(V, V.z.k * 1.45, centro(), true); };
  V.cont.querySelector('#cvMenos').onclick = function () { visorZoomEn(V, V.z.k / 1.45, centro(), true); };
  V.cont.querySelector('#cvCentrar').onclick = function () { visorZoom(V, 1, 0, 0, true); };
  esc.addEventListener('wheel', function (e) {
    if (V.ficha) return;
    e.preventDefault();
    visorZoomEn(V, V.z.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: e.clientX, y: e.clientY }, false);
  }, { passive: false });
  esc.addEventListener('pointerdown', function (e) {
    if (V.ficha || (e.target.closest && e.target.closest('.cv-zoom-acc'))) return;
    dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(dedos);
    if (ids.length === 2) {
      var a = dedos[ids[0]], b = dedos[ids[1]];
      ini = { dos: true, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: Object.assign({}, V.z) };
    } else ini = { dos: false, p: { x: e.clientX, y: e.clientY }, z: Object.assign({}, V.z), movio: false };
    /* Al tocar un módulo con el dedo, se levanta (como al pasar el mouse). */
    var caja = e.target.closest && e.target.closest('.cv-mod');
    if (caja && e.pointerType !== 'mouse') { caja.classList.add('cv-tocado'); setTimeout(function () { caja.classList.remove('cv-tocado'); }, 260); }
  });
  var mueve = function (e) {
    if (!dedos[e.pointerId] || !ini) return;
    dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(dedos), c = centro();
    if (ini.dos && ids.length >= 2) {
      var a = dedos[ids[0]], b = dedos[ids[1]], dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var k2 = Math.max(1, Math.min(3.5, ini.z.k * dist / ini.dist));
      visorZoom(V, k2, (mid.x - c.x) - k2 * ((ini.mid.x - c.x) - ini.z.x) / ini.z.k, (mid.y - c.y) - k2 * ((ini.mid.y - c.y) - ini.z.y) / ini.z.k, false);
      V.movidoEn = Date.now();
    } else if (!ini.dos && V.z.k > 1) {
      var dx = e.clientX - ini.p.x, dy = e.clientY - ini.p.y;
      if (!ini.movio && Math.abs(dx) + Math.abs(dy) < 8) return;
      ini.movio = true;
      visorZoom(V, V.z.k, ini.z.x + dx, ini.z.y + dy, false);
      V.movidoEn = Date.now();
    }
  };
  var suelta = function (e) {
    if (!dedos[e.pointerId]) return;
    delete dedos[e.pointerId];
    var ids = Object.keys(dedos);
    /* Si queda un dedo después de pellizcar, sigue moviendo desde ahí. */
    ini = ids.length === 1 ? { dos: false, p: dedos[ids[0]], z: Object.assign({}, V.z), movio: true } : null;
  };
  esc.addEventListener('pointermove', mueve);
  esc.addEventListener('pointerup', suelta);
  esc.addEventListener('pointercancel', suelta);
  esc.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') suelta(e); });
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
  /* Abajo queda lugar para los botones de acercar (que no tapen el local). */
  var abajo = 58, alto = box.height - abajo;
  var s = Math.min((box.width - 24) / (u.r - u.l), (alto - 20) / (u.b - u.t));
  s = Math.max(0.2, Math.min(s, 1.6));
  /* El centro de lo que se ve, al centro de la escena (lo inclinado sube las tapas). */
  var cx = (u.l + u.r) / 2 - (box.left + box.width / 2), cy = (u.t + u.b) / 2 - (box.top + alto / 2);
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
  V.sFit = f.s;
  visorRotulos(V);
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
    miniLimpiar(db);
    return new Promise(function (ok) {
      try {
        var q = db.transaction('fotos').objectStore('fotos').get(ruta);
        q.onsuccess = function () { var v = q.result; ok(v && v.b ? v.b : v instanceof Blob ? v : null); };
        q.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
  });
}
function miniGuardar(ruta, blob) {
  miniBase().then(function (db) { if (db) try { db.transaction('fotos', 'readwrite').objectStore('fotos').put({ b: blob, t: Date.now() }, ruta); } catch (e) {} });
}
var _miniLimpias = false;
function miniLimpiar(db) {
  if (_miniLimpias) return;
  _miniLimpias = true;
  var limite = Date.now() - 40 * 864e5;
  try {
    db.transaction('fotos', 'readwrite').objectStore('fotos').openCursor().onsuccess = function (e) {
      var cur = e.target.result;
      if (!cur) return;
      if (!cur.value || !cur.value.t || cur.value.t < limite) cur.delete();
      cur.continue();
    };
  } catch (e) {}
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
/** Qué hay en cada módulo (los que tienen nombre), enteros: en la maqueta, en el celular, se leen al acercar. */
function visorListaQue(V, mods, abierto) {
  var d = V.d, con = mods.filter(function (m) { return m.isla || nombrePropio(m); });
  if (!con.length) return '';
  return '<details class="cv-sec cv-que-sec"' + abierto + '><summary>Qué hay en cada módulo</summary>' +
    '<p class="cv-ayuda cv-solo-ocultos">En el plano se leen al acercarlo.</p><div class="cv-lista-que">' + con.map(function (m) {
      return '<button type="button" data-abrir="' + esc(m.id) + '"><b>' + esc(String(m.isla ? numeroVista(d, m) : m.numero)) + '</b>' + esc(m.isla ? m.nombre : nombrePropio(m)) + '</button>';
    }).join('') + '</div></details>';
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
    visorListaQue(V, mods, abierto) +
    '<details class="cv-sec"' + abierto + '><summary>De un vistazo</summary><div class="cv-vistazo"><span><b>' + mods.length + '</b> módulos</span>' +
      (sinFoto ? '<span><b>' + sinFoto + '</b> sin foto</span>' : '') + (viejas ? '<span><b>' + viejas + '</b> con la foto de hace más de 7 días</span>' : '') + '</div></details>' +
    '<details class="cv-sec"><summary>Ajustes de la vista</summary><button type="button" class="cv-interruptor" id="cvLiviano" aria-pressed="' + !!V.liviano + '">' +
      '<span>Modo liviano</span><small>Sin sombras ni texturas, para teléfonos lentos</small></button></details>';
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
    '<header class="cv-ficha-cab"><div><small>' + esc(visorDonde(V, m)) + '</small><h2>' + esc(titulo) + '</h2>' +
      '<p class="cv-que-linea"><span class="cv-que" id="cvQue">' + esc(que || '') + '</span>' +
        (V.op.puedeNombrar && !m.isla ? '<button class="cv-enlace" type="button" id="cvCambiarQue">' + (que ? 'Cambiar' : '+ Qué hay en este módulo') + '</button>' : '') + '</p>' +
      '<form class="cv-que-form" id="cvQueForm" hidden><input id="cvQueInput" maxlength="40" autocomplete="off" placeholder="Remeras, buzos, jeans…" aria-label="Qué hay en este módulo">' +
        '<button class="cv-boton cv-lima" type="submit">Guardar</button><button class="cv-boton" type="button" id="cvQueCancelar">Cancelar</button></form></div>' +
      '<button class="cv-cerrar" type="button" aria-label="Volver al plano">×</button></header>' +
    '<div class="cv-ficha-cuerpo">' +
      '<div class="cv-fotos' + (ref ? ' con-ref' : '') + '" id="cvFotos">' +
      (e.foto_path
        ? '<figure class="cv-foto cv-ahora"><div class="cv-foto-img" id="cvFotoGrande" data-amplia="ahora"></div><figcaption id="cvFotoPie">' + esc(visorPie(e.tomada_en, e.foto_de)) + '</figcaption>' +
          '<div class="cv-historia" id="cvHistoria" hidden></div></figure>'
        : '<div class="cv-sin-foto"><div class="cv-sin-foto-ico" aria-hidden="true"></div><p><b>Todavía no hay una foto de este módulo.</b></p>' +
          (V.op.puedeSugerir && resp ? '<button class="cv-boton cv-lima" type="button" id="cvPedirFoto">Pedirle la foto a ' + esc(nombreLista(resp)) + '</button>' : resp ? '' : '<p>No tiene responsable: ' + esc(visorDondeAsignar(V)) + '.</p>') + '</div>') +
      (ref ? '<figure class="cv-foto cv-ref"><div class="cv-foto-img" id="cvFotoRef" data-amplia="ref"></div><figcaption><b>Así se arma en VDH</b></figcaption></figure>' : '') + '</div>' +
      '<div class="cv-datos">' + (e.nivel ? '<span class="cv-nivel nivel-' + esc(e.nivel) + '">' + esc(NIVEL[e.nivel] || e.nivel) + '</span>' : '') +
        '<span class="cv-persona"><i style="background:' + visorColor(V, m) + '"></i>' + esc(resp ? nombreLista(resp) : 'Sin responsable') + (sup ? ' · lo cubre ' + esc(nombreLista(sup)) : '') + '</span>' +
        '<span id="cvTareas"' + (+e.tareas_abiertas ? '' : ' hidden') + '>' + visorTextoTareas(e.tareas_abiertas) + '</span></div>' +
      '<div class="cv-ia" id="cvIa">' + (e.foto_path ? '<p class="cv-gris">Buscando lo que vio la IA…</p>' : '') + '</div>' +
      (V.op.puedeSugerir ? (resp
        ? '<div class="cv-acciones"><button class="cv-boton cv-lima" type="button" id="cvSugerir">Dejar sugerencia</button></div>' +
          '<form class="cv-sugerencia" id="cvSugForm" hidden><h3>Sugerencia para ' + esc(nombreLista(resp)) + '</h3>' +
            '<textarea id="cvSugTexto" maxlength="300" rows="3" placeholder="Ej.: Pasá los buzos azules al estante de arriba" aria-label="Qué le sugerís"></textarea>' +
            '<div class="cv-seg cv-plazo" role="group" aria-label="Para cuándo"><button type="button" data-plazo="hoy" aria-pressed="false">Hoy</button>' +
              '<button type="button" data-plazo="manana" aria-pressed="true">Mañana</button><button type="button" data-plazo="semana" aria-pressed="false">Esta semana</button></div>' +
            '<label class="cv-check"><input type="checkbox" id="cvSugFoto" checked> Que la devuelva con una foto nueva</label>' +
            '<div class="cv-fila"><button type="submit" class="cv-boton cv-lima" id="cvSugMandar">Mandar a ' + esc(nombreLista(resp)) + '</button>' +
              '<button type="button" class="cv-boton" id="cvSugCancelar">Cancelar</button></div></form>' +
          '<p class="cv-ok" id="cvSugOk" hidden></p>'
        : (e.foto_path ? '<p class="cv-gris">Este módulo no tiene responsable: ' + esc(visorDondeAsignar(V)) + ' para dejarle sugerencias.</p>' : '')) : '') +
    '</div></section>');
  var fondo = V.raiz.querySelector('.cv-ficha-fondo'), ficha = V.raiz.querySelector('.cv-ficha');
  V.ficha = { el: ficha, fondo: fondo, caja: caja, id: id };
  ficha.querySelector('.cv-cerrar').onclick = function () { cerrarFicha(V); };
  fondo.onclick = function () { cerrarFicha(V); };
  ficha.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab') return;
    var f = [].filter.call(ficha.querySelectorAll('button, input, textarea, [tabindex="0"]'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  });
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
  visorFichaSugerencia(V, m, resp);
  visorFichaQue(V, m);
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
  var listo = false;
  var fin = f.fin = function () {
    if (listo) return;
    listo = true;
    f.el.remove(); f.fondo.remove();
    if (V.ficha === f) V.ficha = null;
    if (ya) return;
    if (f.caja && document.body.contains(f.caja)) f.caja.focus({ preventScroll: true });
    if (V.ajustePendiente) { V.ajustePendiente = false; V.alTamano(); }
  };
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
  llamar('orden_visor_historia', { p_modulo: id }).catch(function () {
    return leer('/orden_v_controles?select=id,foto_path,tomada_en,nivel,nivel_ia,nivel_final,persona_nombre,ia_resultado,comentario&modulo_id=eq.' + valor(id) +
                '&foto_path=not.is.null&order=tomada_en.desc&limit=12');
  }).then(function (h) {
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
function visorCargarFoto(div, ruta, sinMiniatura) {
  if (!div) return;
  div.dataset.ruta = ruta;
  div.classList.remove('cv-nitida', 'cv-foto-falla');
  div.textContent = '';
  var sigue = function () { return div.dataset.ruta === ruta; };
  var falla = function () { if (!sigue()) return; div.style.backgroundImage = ''; div.classList.add('cv-foto-falla'); div.textContent = 'Esta foto ya no está guardada.'; };
  if (!sinMiniatura) miniaturaFoto(ruta).then(function (u) { if (u && sigue() && !div.classList.contains('cv-nitida')) div.style.backgroundImage = 'url("' + u + '")'; });
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
    visorCargarFoto(f.el.querySelector('#cvFotoGrande'), c.foto_path, i > 0);
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

/* ── Dejar sugerencia: una tarea para el que tiene el módulo (con foto si se pide), como las de "Nueva tarea" ── */
var VISOR_PLAZOS = { hoy: 'hoy', manana: 'mañana', semana: 'esta semana' };
function visorFichaSugerencia(V, m, resp) {
  var f = V.ficha.el, abrir = f.querySelector('#cvSugerir'), form = f.querySelector('#cvSugForm');
  if (!abrir || !form) return;
  var plazo = 'manana', ok = f.querySelector('#cvSugOk'), texto = f.querySelector('#cvSugTexto'), mandar = f.querySelector('#cvSugMandar');
  abrir.onclick = function () { abrir.hidden = true; ok.hidden = true; form.hidden = false; texto.focus(); form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  f.querySelector('#cvSugCancelar').onclick = function () { form.hidden = true; abrir.hidden = false; };
  form.querySelector('.cv-plazo').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-plazo]');
    if (!b) return;
    plazo = b.dataset.plazo;
    form.querySelectorAll('[data-plazo]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
  };
  form.onsubmit = function (e) {
    e.preventDefault();
    if (mandar.disabled) return;   // doble toque: una sola vez
    var s = String(texto.value || '').replace(/\s+/g, ' ').trim();
    if (s.length < 3) { avisarVisor('Escribí qué le sugerís.'); texto.focus(); return; }
    var titulo = s.length > 140 ? s.slice(0, 139) + '…' : s;
    var detalle = 'Sugerencia desde el croquis (' + nombreModulo(m, V.d.sectorDe[m.sector_id], V.d) + ')' + (s.length > 140 ? ': ' + s : '');
    var antes = mandar.textContent, clave = titulo + '|' + plazo, reintento = form.dataset.fallo === clave;
    mandar.disabled = true;
    mandar.textContent = 'Mandando…';
    visorMandarTarea(m, resp, titulo, detalle, plazo, f.querySelector('#cvSugFoto').checked, reintento).then(function () {
      delete form.dataset.fallo;
      form.hidden = true;
      texto.value = '';
      ok.hidden = false;
      ok.textContent = 'Listo: le llegó a ' + nombreLista(resp) + ' como tarea para ' + VISOR_PLAZOS[plazo] + '.';
      abrir.hidden = false;
      abrir.textContent = 'Dejar otra sugerencia';
      mandar.disabled = false;
      mandar.textContent = antes;
      var e2 = V.estado[m.id] || (V.estado[m.id] = {});
      e2.tareas_abiertas = (+e2.tareas_abiertas || 0) + 1;
      visorContarTareas(V, e2);
    }, function (err) {
      if (esDeRed(err)) form.dataset.fallo = clave;
      mandar.disabled = false;
      mandar.textContent = antes;
      avisarVisor(esDeRed(err) ? 'Sin conexión: no se mandó. Probá de nuevo (no se va a duplicar).' : mensajeDe(err));
    });
  };
}

/* ── Qué hay en este módulo: su nombre propio (Remeras, Buzos…), que se ve arriba del módulo en la maqueta. Lo de adentro
      del local (la caja, las mesas) se renombra en el croquis: su nombre es el que el croquis usa para ubicarlo. ── */
function visorFichaQue(V, m) {
  var f = V.ficha.el, b = f.querySelector('#cvCambiarQue'), form = f.querySelector('#cvQueForm');
  if (!b || !form) return;
  var input = f.querySelector('#cvQueInput');
  b.onclick = function () { input.value = nombrePropio(m) || ''; form.hidden = false; b.hidden = true; input.focus(); };
  f.querySelector('#cvQueCancelar').onclick = function () { form.hidden = true; b.hidden = false; };
  form.onsubmit = function (e) {
    e.preventDefault();
    var guardar = form.querySelector('[type="submit"]');
    if (guardar.disabled) return;
    var v = String(input.value || '').replace(/\s+/g, ' ').trim();
    guardar.disabled = true;
    llamar('orden_modulo_nombre', { p_modulo: m.id, p_nombre: v || null }).then(function () {
      var s = V.d.sectorDe[m.sector_id];
      m.nombre = v || ((s && s.tipo === 'deposito' ? 'Depósito ' : 'Módulo ') + m.numero);
      f.querySelector('#cvQue').textContent = nombrePropio(m) || '';
      b.textContent = nombrePropio(m) ? 'Cambiar' : '+ Qué hay en este módulo';
      form.hidden = true; b.hidden = false; guardar.disabled = false;
      /* El rótulo de la maqueta también cambia. */
      var caja = V.mundo.querySelector('.cv-caja[data-mod="' + m.id + '"] .cv-rotulo');
      if (caja) {
        var span = caja.querySelector('span'), p = nombrePropio(m);
        if (p) { if (!span) { span = document.createElement('span'); caja.appendChild(span); } span.textContent = recortar(p, 18); }
        else if (span) span.remove();
      }
      avisarVisor(v ? 'Listo: en el croquis dice "' + v + '".' : 'Listo: volvió a su nombre de siempre.');
    }, function (err) {
      guardar.disabled = false;
      avisarVisor(esDeRed(err) ? 'Sin conexión: no se guardó. Probá de nuevo.' : mensajeDe(err));
    });
  };
}

/** Sin foto: se le pide al que lo tiene (una tarea con foto, como las de siempre). */
function visorPedirFoto(V, m, resp, boton) {
  var titulo = 'Sacale una foto a ' + nombreModulo(m, V.d.sectorDe[m.sector_id], V.d).replace(/^(Módulo|Depósito) /, function (x) { return x.toLowerCase(); });
  var reintento = boton.dataset.fallo === '1';
  boton.disabled = true;
  boton.textContent = 'Pidiendo…';
  visorMandarTarea(m, resp, titulo, 'Desde el croquis: el módulo no tiene foto.', 'hoy', true, reintento).then(function () {
    delete boton.dataset.fallo;
    var e2 = V.estado[m.id] || (V.estado[m.id] = {});
    e2.tareas_abiertas = (+e2.tareas_abiertas || 0) + 1;
    visorContarTareas(V, e2);
    boton.textContent = 'Listo: le llegó a ' + nombreLista(resp);
    avisarVisor('Le pedimos la foto a ' + nombreLista(resp).replace(/\.$/, '') + '.');
  }, function (e) {
    if (esDeRed(e)) boton.dataset.fallo = '1';
    boton.disabled = false;
    boton.textContent = 'Pedirle la foto a ' + nombreLista(resp);
    avisarVisor(esDeRed(e) ? 'Sin conexión: no se mandó. Probá de nuevo.' : mensajeDe(e));
  });
}
/** Manda una tarea al responsable del módulo. Al reintentar después de un corte, primero se fija si la de antes llegó
    igual (la base la creó pero no llegó la respuesta): así no se duplica. Si no es un reintento, se manda (una
    sugerencia repetida a propósito es otra tarea). */
function visorMandarTarea(m, resp, titulo, detalle, plazo, conFoto, reintento) {
  titulo = String(titulo).trim().slice(0, 140);
  var mandar = function () { return llamar('orden_crear_tarea', { p_personas: [resp.id], p_titulo: titulo, p_detalle: detalle || null, p_modulo: m.id, p_plazo: plazo, p_requiere_foto: !!conFoto }); };
  if (!reintento) return mandar();
  var desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  return leer('/orden_tareas?select=id&persona_id=eq.' + valor(resp.id) + '&modulo_id=eq.' + valor(m.id) + '&titulo=eq.' + encodeURIComponent(titulo) +
              '&creado_en=gte.' + encodeURIComponent(desde) + '&limit=1').catch(function () { return []; })
    .then(function (ya) { return ya && ya.length ? ya : mandar(); });
}
function visorTextoTareas(n) { n = +n || 0; return n + (n === 1 ? ' tarea abierta' : ' tareas abiertas'); }
function visorContarTareas(V, e) {
  var z = V.ficha && V.ficha.el.querySelector('#cvTareas');
  if (z) { z.textContent = visorTextoTareas(e.tareas_abiertas); z.hidden = !(+e.tareas_abiertas); }
}
function visorDondeAsignar(V) { return V.op.dondeAsignar || 'asignáselo en Por local'; }
function avisarVisor(texto) {
  if (typeof avisar === 'function') { avisar(texto); return; }
}
