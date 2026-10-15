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
var VISOR_INCL_MIN = 12, VISOR_INCL_MAX = 68;   // lo que se puede inclinar arrastrando el mouse para arriba o para abajo
var VISOR_ZOOM_MAX = 5;              // lo más que se acerca (para ver la foto de un módulo desde el plano)
var VISOR_ALTO = { pared: 58, deposito: 60, centro: 32, vidriera: 26, muro: 34, muroFoto: 96 };   // muroFoto: "Desde arriba", como la foto (paredes altas)
/* Los módulos de las paredes, como los de verdad: más altos que anchos (pedido de Mauricio: "son rectangulares para
   arriba, no tan cuadrados"). El alto sale del ancho típico de los del local, así la foto del frente queda vertical. */
var VISOR_MODULO_PROPORCION = 1.7, VISOR_MODULO_TOPE = 96;

/** Abre el modo observador adentro de cont (que ya ocupa toda la pantalla). op: { local: {id, nombre}, puedeSugerir,
    puedeNombrar, puedeEditar, alVolver(), alEditar(d), capa: {abrir(fn), soltar(fn)} } */
function abrirVisor(cont, op) {
  if (_visorActual) visorSalir(_visorActual, true);
  var V = { op: op, cont: cont, tab: 'salon', inclinado: true, incl: VISOR_INCL, estado: {}, d: null, ficha: null, fit: {}, vista: 'vendedor', giro: 0, todas: false, rec: null };
  _visorActual = V;
  try {
    V.liviano = localStorage.getItem('vdh_visor_liviano') === '1';
    V.vista = localStorage.getItem('vdh_visor_vista') || 'vendedor';
    V.inclinado = localStorage.getItem('vdh_visor_cam') !== 'arriba';
  } catch (e) { V.liviano = false; }
  if (!VISOR_VISTAS[V.vista]) V.vista = 'vendedor';
  /* En 3D, si el equipo puede (y no se apagó en "Ajustes de la vista"); en un teléfono o una compu chica, liviano. */
  V.usa3d = visor3dElegido();
  if (V.usa3d && !V.liviano && visor3dLento() && !visorLivianoElegido()) V.liviano = true;
  cont.innerHTML = '<div class="cv' + (V.liviano ? ' cv-liviano' : '') + (V.inclinado ? '' : ' cv-plano') + (V.usa3d ? ' cv-modo-3d' : '') + '">' +
    /* La ropa (las mismas siluetas del mapa), una vez: cada prenda de la maqueta la usa. */
    '<svg class="cv-sprite" aria-hidden="true" focusable="false"><defs>' + simbolosPrendas('cvR') + '</defs></svg>' +
    '<header class="cv-cab"><button class="cv-volver" id="volverMapa" type="button">‹ Volver</button>' +
      '<div class="cv-titulo"><small>Modo observador</small><b>' + esc(op.local.nombre || '') + '</b></div>' +
      '<div class="cv-cab-acc"><div class="cv-seg" id="cvTabs" role="group" aria-label="Qué mirar">' +
        '<button type="button" data-tab="salon" aria-pressed="true">Salón</button><button type="button" data-tab="deposito" aria-pressed="false">Depósito</button></div>' +
        '<div class="cv-seg" id="cvCam" role="group" aria-label="Cómo mirar la maqueta"><button type="button" data-cam="incl" aria-pressed="' + V.inclinado + '">Inclinado</button>' +
          '<button type="button" data-cam="arriba" aria-pressed="' + !V.inclinado + '">Desde arriba</button></div>' +
        (op.puedeEditar ? '<button class="cv-chico cv-lima" id="cvEditar" type="button">Armar el croquis</button>' : '') + '</div></header>' +
    '<div class="cv-cuerpo"><div class="cv-escena" id="cvEscena"><div class="cv-zoom" id="cvZoom"><div class="cv-camara"><div class="cv-mundo" id="cvMundo"></div></div></div>' +
      '<div class="cv-recorrer" id="cvRecorrerBarra" hidden><button type="button" class="cv-redondo" id="cvAnt" aria-label="Pared anterior">‹</button>' +
        '<div class="cv-parada"><small id="cvParadaN"></small><b id="cvParada"></b></div><button type="button" class="cv-redondo" id="cvSig" aria-label="Pared siguiente">›</button>' +
        '<button type="button" class="cv-chico" id="cvSalirRec">Listo</button></div>' +
      '<div class="cv-zoom-acc"><button type="button" id="cvCaminar" class="cv-chico cv-lima" aria-pressed="false" hidden>Caminar</button>' +
        '<button type="button" id="cvMira" class="cv-chico" aria-pressed="false" hidden title="El mouse mueve la vista, como en un juego (Esc lo suelta)">Mira</button>' +
        '<button type="button" id="cvRecorrer" class="cv-chico cv-lima">Recorrer</button><button type="button" id="cvCentrar" class="cv-chico" hidden>Centrar</button>' +
        '<button type="button" id="cvGirarIzq" class="cv-redondo" aria-label="Girar el local hacia la izquierda" title="Girar">⟲</button>' +
        '<button type="button" id="cvGirarDer" class="cv-redondo" aria-label="Girar el local hacia la derecha" title="Girar">⟳</button>' +
        '<button type="button" id="cvMenos" class="cv-redondo" aria-label="Alejar">−</button><button type="button" id="cvMas" class="cv-redondo" aria-label="Acercar">+</button></div>' +
      /* En la compu, cómo se maneja con el mouse (en el celular, con los dedos, ya se entiende). */
      '<p class="cv-ayuda-raton" id="cvAyudaRaton"><b>Arrastrá</b> para girar e inclinar · <b>Rueda</b> o <b>doble clic</b> para acercar · <b>Clic derecho</b> y arrastrá para mover</p>' +
      '<p class="cv-cargando" id="cvCargando">Cargando el local…</p><div class="cv-mira" id="cvMiraPunto" aria-hidden="true"><i></i><span id="cvMiraTexto"></span></div><div class="cv-fundido" id="cvFundido"></div></div>' +
      '<aside class="cv-panel" id="cvPanel"></aside></div></div>';
  V.raiz = cont.querySelector('.cv');
  V.mundo = cont.querySelector('#cvMundo');
  V.zoomEl = cont.querySelector('#cvZoom');
  V.z = { k: 1, x: 0, y: 0 };
  V.escena = cont.querySelector('#cvEscena');
  V.ayudaRaton = cont.querySelector('#cvAyudaRaton').innerHTML;
  cont.querySelector('#volverMapa').onclick = function () { if (V.ficha && !V.ficha.cerrando) { cerrarFicha(V); return; } visorSalir(V); };
  cont.querySelector('#cvTabs').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === V.tab) return;
    if (V.c3 && V.c3.caminando()) V.c3caminar = 'puerta';
    V.tab = b.dataset.tab;
    visorSalirRecorrido(V, true);
    V.giro = 0;
    V.resaltado = null;
    visorZoom(V, 1, 0, 0, false);   // sin animar: la maqueta nueva se mide enseguida
    cont.querySelectorAll('#cvTabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    visorDibujar(V, true);
  };
  cont.querySelector('#cvCam').onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-cam]');
    if (!b) return;
    if (V.usa3d) {
      /* En 3D: inclinado (como siempre) o desde arriba, sin volver a armarlo. */
      if (!V.c3) return;
      V.inclinado = b.dataset.cam === 'incl';
      try { localStorage.setItem('vdh_visor_cam', V.inclinado ? 'incl' : 'arriba'); } catch (x) {}
      cont.querySelectorAll('#cvCam [data-cam]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      V.raiz.classList.toggle('cv-plano', !V.inclinado);
      visorSalirRecorrido(V, true);
      V.c3.inclinar(!V.inclinado);
      return;
    }
    if ((b.dataset.cam === 'incl') === V.inclinado) {
      /* Ya inclinada, pero con otra inclinación (la del mouse): vuelve a la de siempre. */
      if (V.inclinado && Math.abs(V.incl - VISOR_INCL) > 0.5 && V.d) { V.incl = VISOR_INCL; visorZoom(V, 1, 0, 0, true); visorCamara(V, false); }
      return;
    }
    V.inclinado = b.dataset.cam === 'incl';
    try { localStorage.setItem('vdh_visor_cam', V.inclinado ? 'incl' : 'arriba'); } catch (x) {}
    cont.querySelectorAll('#cvCam [data-cam]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    V.raiz.classList.toggle('cv-plano', !V.inclinado);
    /* Desde arriba las paredes son altas (como la foto, con perspectiva): se vuelve a armar la maqueta. */
    visorDibujar(V, false);
    V.fit = {};
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
  visorPrevia(V);
  /* El panel: cómo verlo (por vendedor, por estado, por antigüedad). */
  cont.querySelector('#cvPanel').addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#cvVer3d')) { visor3dCambiar(V, !V.usa3d); return; }
    var se = e.target.closest && e.target.closest('[data-sens]');
    if (se) {
      try { localStorage.setItem('vdh_visor_sens', se.dataset.sens); } catch (x) {}
      if (V.c3) V.c3.sensibilidad(visorSensibilidad());
      [].forEach.call(V.cont.querySelectorAll('[data-sens]'), function (b) { b.setAttribute('aria-pressed', b === se); });
      return;
    }
    if (e.target.closest && e.target.closest('#cvLiviano')) {
      V.liviano = !V.liviano;
      V.raiz.classList.toggle('cv-liviano', V.liviano);
      try { localStorage.setItem('vdh_visor_liviano', V.liviano ? '1' : '0'); } catch (x) {}
      if (V.c3) visor3dMontar(V, V.c3.caminando() ? V.c3.dondeEstoy() : null);
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
    if (ab && !V.ficha && V.usa3d) { var m3 = visorModulo(V, ab.dataset.abrir); if (m3 && V.c3) visor3dAbrir(V, m3); return; }
    if (ab && !V.ficha) { var cj = V.mundo.querySelector('.cv-caja[data-mod="' + ab.dataset.abrir + '"]'); if (cj) abrirFicha(V, ab.dataset.abrir, cj); }
  });
  V.alTamano = function () {
    if (!document.body.contains(V.raiz)) { visorSalir(V, true); return; }
    if (V.usa3d) { if (V.c3) V.c3.redimensionar(); return; }
    if (V.ficha) { V.ajustePendiente = true; return; }
    if (V.d) { visorZoom(V, 1, 0, 0, false); V.fit = {}; visorCamara(V, true); }
  };
  window.addEventListener('resize', V.alTamano);
  V.alTecla = function (e) {
    if (!document.body.contains(V.raiz)) { visorSalir(V, true); return; }
    if (e.key === 'Escape' && V.ficha) cerrarFicha(V);
    /* Con el teclado: ← → giran, ↑ ↓ inclinan, + y − acercan (no mientras se escribe ni con un módulo abierto). */
    var t = e.target, tag = t && t.tagName;
    if (V.ficha || !V.d || e.altKey || e.ctrlKey || e.metaKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (V.usa3d) {
      /* En 3D, de arriba: ← → giran y + − acercan (caminando, las flechas caminan: las maneja el 3D). */
      if (!V.c3 || V.c3.caminando()) return;
      var g = { ArrowLeft: -Math.PI / 12, ArrowRight: Math.PI / 12 }[e.key];
      if (g) { e.preventDefault(); V.c3.girar(g); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); V.c3.acercar(1.35); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); V.c3.acercar(1 / 1.35); }
      return;
    }
    var paso = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
    if (paso) { e.preventDefault(); visorPaso(V, paso[0], paso[1]); return; }
    var r = V.escena.getBoundingClientRect(), c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (e.key === '+' || e.key === '=') { e.preventDefault(); visorZoomEn(V, V.z.k * 1.35, c, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); visorZoomEn(V, V.z.k / 1.35, c, true); }
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
  visor3dSoltar(V);
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

/** Un dibujo del mapa (en sus coordenadas) puesto sobre un lugar r: la tapa de un mueble o algo sobre el piso. */
function visorSvg(r, contenido, clase) {
  return '<svg class="' + (clase || 'cv-svg') + '" viewBox="' + [r.x, r.y, r.w, r.h].map(n1).join(' ') + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + contenido + '</svg>';
}
function visorLugar(r) { return 'left:' + n1(r.x) + 'px;top:' + n1(r.y) + 'px;width:' + n1(r.w) + 'px;height:' + n1(r.h) + 'px'; }
/** El nombre de una pieza, parado de frente a quien mira (como el número de un módulo). */
function visorNombrePieza(texto) { return texto ? '<div class="cv-rotulo cv-rotulo-pieza"><span>' + esc(texto) + '</span></div>' : ''; }

/* ── Las piezas (lo que no es módulo), con volumen: arriba, el mismo dibujo del mapa ── */
var VISOR_PIEZA_ALTO = { probador: 50, caja: 30, mesa: 20, mesalisa: 22, perchero: 42, columna: 76, espejo: 64, banco: 12, otro: 34 };
function visorPieza(pl, it) {
  var r = it.r, k = it.pieza, caras = visorCaras(pl, r);
  if (!k) return '<div class="cv-hueco" style="' + visorLugar(r) + '"></div>';
  var p = PIEZAS[k] || PIEZAS.otro, texto = String(it.texto || '').trim(), propio = texto && texto.toLowerCase() !== p.nombre.toLowerCase();
  var nombre = propio || k === 'probador' || k === 'caja' || k === 'escalera' || k === 'deposito' || k === 'otro' ? visorNombrePieza(propio ? texto : p.corto || p.nombre) : '';
  var dibujo = visorSvg(r, dibujoPieza(k, r, texto, it.frente, '', { sinNombre: true }));
  if (k === 'deposito') return '<div class="cv-piso-pieza" style="' + visorLugar(r) + '">' + dibujo + nombre + '</div>';
  if (k === 'planta') return visorPlanta(r, caras) + (propio ? '<div class="cv-piso-pieza" style="' + visorLugar(r) + '">' + nombre + '</div>' : '');
  if (k === 'maniqui') return visorManiqui(r, dibujo) + (propio ? '<div class="cv-piso-pieza" style="' + visorLugar(r) + '">' + nombre + '</div>' : '');
  if (k === 'escalera') return visorEscalera(r, it.frente, caras, nombre);
  return visorCaja(r, VISOR_PIEZA_ALTO[k] || 34, 'cv-fijo cv-pz-' + k, 'data-frente="' + (it.frente || 's') + '"', null, dibujo, nombre, '', caras);
}
/** Una planta: la maceta y las hojas, en capas (desde arriba se ve la copa; inclinada, con volumen). */
function visorPlanta(r, caras) {
  var m = Math.min(r.w, r.h), cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = m * 0.55;
  var maceta = visorCaja({ x: cx - s / 2, y: cy - s / 2, w: s, h: s }, 14, 'cv-fijo cv-pz-maceta', '', null, '', '', '', caras);
  if (CROQUIS_IMG) return maceta + '<div class="cv-piso-pieza cv-copa" style="' + visorLugar(r) + '">' + visorSvg(r, dibujoPieza('planta', r, '', 's', '', { sinNombre: true })) + '</div>';
  return maceta +
    [[1.08, 20, 0, 0], [0.88, 29, -0.07, -0.05], [0.6, 37, 0.05, -0.09]].map(function (h) {
      var d = m * h[0];
      return '<div class="cv-hoja" style="left:' + n1(cx - d / 2 + h[2] * m) + 'px;top:' + n1(cy - d / 2 + h[3] * m) + 'px;width:' + n1(d) + 'px;height:' + n1(d) + 'px;transform:translateZ(' + h[1] + 'px)"></div>';
    }).join('');
}
/** Un maniquí: parado de frente (con una remera de color); desde arriba se ve el dibujo del mapa en el piso. */
function visorManiqui(r, dibujo) {
  var m = Math.min(r.w, r.h), cx = r.x + r.w / 2, cy = r.y + r.h / 2, w = m * 1.05, h = m * 2.4;
  var ropa = ROPA_COLORES[semillaDe('maniqui' + r.x + r.y) % ROPA_COLORES.length];
  return '<div class="cv-piso-pieza cv-maniqui-piso" style="' + visorLugar(r) + '">' + dibujo + '</div>' +
    '<div class="cv-parado" style="left:' + n1(cx - w / 2) + 'px;top:' + n1(cy - h) + 'px;width:' + n1(w) + 'px;height:' + n1(h) + 'px">' +
    '<svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="20" cy="97" rx="12" ry="3" fill="#2F3237"/><rect x="19" y="60" width="2" height="37" fill="#8E949B"/>' +
    '<path d="M7.6 40 8.4 57M32.4 40 31.6 57" stroke="#ECE7E0" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M8 24Q20 19 32 24L34.6 39.6 29.4 41 28.6 60Q20 63 11.4 60L10.6 41 5.4 39.6Z" fill="' + ropa + '" stroke="rgba(0,0,0,.45)" stroke-width=".8" stroke-linejoin="round"/>' +
    '<rect x="17.6" y="15" width="4.8" height="6.5" fill="#ECE7E0"/><ellipse cx="20" cy="10" rx="6" ry="7.4" fill="#F4F1EC" stroke="rgba(0,0,0,.3)" stroke-width=".6"/></svg></div>';
}
/** Una escalera: escalones que suben hacia el lado opuesto a su frente (como la flecha del mapa). */
function visorEscalera(r, frente, caras, nombre) {
  var n = 6, out = '';
  for (var i = 0; i < n; i++) {
    var f0 = i / n, f1 = (i + 1) / n, e;
    if (frente === 'n') e = { x: r.x + r.w - f1 * r.w, y: r.y, w: r.w / n, h: r.h };
    else if (frente === 'e') e = { x: r.x, y: r.y + r.h - f1 * r.h, w: r.w, h: r.h / n };
    else if (frente === 'o') e = { x: r.x, y: r.y + f0 * r.h, w: r.w, h: r.h / n };
    else e = { x: r.x + f0 * r.w, y: r.y, w: r.w / n, h: r.h };
    out += visorCaja(e, 7 + i * 9, 'cv-fijo cv-pz-escalon', '', null, '', i === n - 1 ? nombre : '', '', caras);
  }
  return out;
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
    cara('n', 'left:0;top:0;width:' + w + 'px;height:' + a + 'px', frente === 'n' ? rotar(180) : '') +
    cara('e', 'left:' + (r.w - a).toFixed(1) + 'px;top:0;width:' + a + 'px;height:' + h + 'px', frente === 'e' ? rotar(-90) : '') +
    cara('o', 'left:0;top:0;width:' + a + 'px;height:' + h + 'px', frente === 'o' ? rotar(90) : '') +
    '<div class="cv-tapa">' + (tapa || '') + '</div>' + (rotulo || '') + '</div>';
  /* La foto del frente, derecha: en las caras de costado se gira adentro de la cara. */
  function rotar(g) {
    var largo = g === 90 || g === -90 ? r.h : r.w;
    return '<div class="cv-foto-cara" style="width:' + largo.toFixed(1) + 'px;height:' + a + 'px;transform:translate(-50%,-50%) rotate(' + g + 'deg)"></div>';
  }
}

/** Qué caras de una caja pueden quedar de frente a quien mira (la cámara está arriba del centro del local): la de abajo
    siempre; la de arriba, si la caja está en la mitad de abajo; las de los costados, según de qué lado del centro esté. */
function visorCaras(pl, r) {
  /* Ya girado (o girando), todas: si no, en la mitad de la vuelta faltarían caras. */
  if (_visorTodas) return 'snoe';
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return 's' + (cy > pl.H * 0.45 ? 'n' : '') + (cx < pl.W * 0.58 ? 'e' : '') + (cx > pl.W * 0.42 ? 'o' : '');
}

/** El alto de los módulos de las paredes del plano pl: el ancho típico (el del medio) por la proporción, entre el alto de
    siempre (minimo) y el tope. El ancho de un módulo es su largo a lo largo de la pared. */
function visorAltoModulos(pl, minimo) {
  var anchos = pl.items.filter(function (it) { return it.tipo === 'modulo' && it.pared && !it.vidriera; }).map(function (it) {
    return it.pared === 'izquierda' || it.pared === 'derecha' ? it.r.h : it.r.w;
  }).sort(function (a, b) { return a - b; });
  if (!anchos.length) return minimo;
  return Math.round(Math.max(minimo, Math.min(VISOR_MODULO_TOPE, anchos[anchos.length >> 1] * VISOR_MODULO_PROPORCION)));
}

var _visorTodas = false;
function visorColor(V, m) {
  if (esVidriera(m)) return COLOR_VIDRIERA;
  var s = V.d.sectorDe[m.sector_id];
  return (s && V.d.color[m.sector_id]) || GRIS_SIN_RESPONSABLE;
}

function visorDibujar(V, ajustar) {
  var d = V.d, pl = planoMapa(d, V.tab), out = '';
  _visorTodas = !!V.todas;
  V.plano = pl;
  if (V.usa3d) {
    /* En 3D: el panel y el 3D de lo que se mira (si ya está armado, queda como está). */
    V.mundo.innerHTML = '';
    visorPanel(V);
    if (!V.c3 || V.c3tab !== V.tab) visor3dMontar(V, V.c3caminar);
    V.c3caminar = null;
    return;
  }
  V.mundo.style.width = pl.W + 'px';
  V.mundo.style.height = pl.H + 'px';
  /* El piso (cálido, de madera) y las paredes bajas, cortadas para ver adentro; el frente es vidriera. */
  out += '<div class="cv-piso' + (pl.tipo === 'deposito' ? ' cv-piso-dep' : '') + '" style="left:' + pl.x0 + 'px;top:' + pl.y0 + 'px;width:' + (pl.x1 - pl.x0) + 'px;height:' + (pl.y1 - pl.y0) + 'px"></div>';
  var puerta = pl.items.filter(function (x) { return x.tipo === 'puerta'; })[0], g = 11, am = V.inclinado ? VISOR_ALTO.muro : VISOR_ALTO.muroFoto;
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
  var altoPared = visorAltoModulos(pl, VISOR_ALTO.pared), altoDep = visorAltoModulos(pl, VISOR_ALTO.deposito);
  if (pl.tipo === 'salon') out += '<div class="cv-vereda cv-frente-' + (FRENTES[pl.frente] ? pl.frente : 'calle') + '" style="left:' + (pl.x0 - 30) + 'px;top:' + (pl.y1 + g) + 'px;width:' + (pl.x1 - pl.x0 + 60) + 'px;height:' + (pl.H - pl.y1 - g + 30) + 'px"><span>' + esc((FRENTES[pl.frente] || FRENTES.calle).nombre) + '</span></div>';
  pl.items.forEach(function (it) {
    var r = it.r;
    if (it.tipo === 'puerta') {
      out += '<div class="cv-entrada" style="' + visorLugar(r) + '">' + visorSvg(r, dibujoPuerta({ r: r, pared: it.pared }, '', '', pl.tipo !== 'deposito', { sinNombre: true })) +
        visorNombrePieza(pl.tipo === 'deposito' ? 'Puerta' : 'Entrada') + '</div>';
      return;
    }
    if (it.tipo === 'fijo') { out += visorPieza(pl, it); return; }
    var m = it.m, e = V.estado[m.id] || {}, alto = pl.tipo === 'deposito' ? altoDep : it.vidriera ? VISOR_ALTO.vidriera : it.pared ? altoPared : VISOR_ALTO.centro;
    /* La cara que mira al salón: la de los costados mira al medio; la del frente mira hacia adentro (de espaldas a
       quien mira la maqueta), así que esos llevan la foto arriba. */
    var frente = it.vidriera ? 's' : it.pared === 'izquierda' ? 'e' : it.pared === 'derecha' ? 'o' : it.pared === 'frente' ? 'n' : 's';
    var arriba = it.pared === 'frente' && !it.vidriera;
    var numero = esVidriera(m) ? m.nombre : m.isla ? numeroVista(d, m) : m.numero, que = esVidriera(m) ? queHay(m) : visorEtiqueta(m);
    var rotulo = '<div class="cv-rotulo"><b' + (e.sin_foto_reciente || !e.foto_path ? ' class="vieja" title="Sin foto reciente"' : '') + '>' + esc(String(numero || '')) + '</b>' + (que ? '<span>' + esc(recortar(que, 18)) + '</span>' : '') + '</div>';
    var tapa = visorSvg(r, interiorModulo(d, m, r, 'cvR', it.pared), 'cv-merca') + '<div class="cv-foto-cara cv-foto-tapa"></div>';
    out += visorCaja(r, alto, 'cv-mod' + (e.foto_path ? ' con-foto' : ' sin-foto') + (it.pared ? '' : ' adentro') + (arriba ? ' foto-arriba' : '') + (it.vidriera ? ' cv-vidriera' : ''),
      'data-mod="' + esc(m.id) + '" role="button" tabindex="0" aria-label="' + esc(nombreModulo(m, d.sectorDe[m.sector_id], d)) + '"',
      frente || 'tapa', tapa, rotulo, visorCategoria(V, m).color, visorCaras(pl, r));
  });
  V.mundo.innerHTML = out;
  visorPintar(V);
  visorFotos(V);
  visorPanel(V);
  if (ajustar) { V.fit = {}; visorCamara(V, true); }
}

/* ── Acercar y alejar: con dos dedos, con la rueda del mouse, con doble clic o con los botones; acercada, se mueve con un
      dedo (en la compu, con el clic derecho) ── */
function visorZoom(V, k, x, y, animar, libre) {
  k = Math.max(1, Math.min(VISOR_ZOOM_MAX, k));
  if (k === 1 && !libre) { x = 0; y = 0; }
  var r = V.escena.getBoundingClientRect(), lx = r.width * (k - (libre ? 0 : 1)) / 2 + 80, ly = r.height * (k - (libre ? 0 : 1)) / 2 + 80;
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
  k2 = Math.max(1, Math.min(VISOR_ZOOM_MAX, k2));
  visorZoom(V, k2, (f.x - cx) - k2 * ((f.x - cx) - z.x) / z.k, (f.y - cy) - k2 * ((f.y - cy) - z.y) / z.k, animar);
}
/* Cómo se maneja (pedido de Mauricio: "agarro cualquier lugar del croquis, lo puedo hacer girar y sólo con el mouse ya
   puedo manejar"):
   - Mouse: arrastrar gira (de costado) e inclina (para arriba o para abajo); con el clic derecho (o Shift) mueve; la
     rueda acerca hacia donde apunta, un clic de la rueda un 25 %; doble clic acerca al doble ahí (Shift: aleja).
   - Dedos: con uno, sin acercar, gira e inclina; acercada, mueve. Con dos, acerca y, retorciéndolos, gira.
   Al girar o inclinar, el punto del piso que está en el medio de la pantalla queda quieto (se gira alrededor de lo que
   se está mirando, también acercada). Al soltar sin acercar, el local vuelve a quedar entero y centrado. */
function visorGestos(V) {
  var sc = V.escena, dedos = {}, ini = null, cuadro = 0;
  var centro = function () { var r = sc.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  V.cont.querySelector('#cvMas').onclick = function () { if (V.usa3d) { if (V.c3) V.c3.acercar(1.45); return; } visorZoomEn(V, V.z.k * 1.45, centro(), true); };
  V.cont.querySelector('#cvMenos').onclick = function () { if (V.usa3d) { if (V.c3) V.c3.acercar(1 / 1.45); return; } visorZoomEn(V, V.z.k / 1.45, centro(), true); };
  V.cont.querySelector('#cvCentrar').onclick = function () {
    if (V.usa3d) { visorSalirRecorrido(V, true); if (V.c3) V.c3.vistaInicial(); return; }
    visorZoom(V, 1, 0, 0, true); visorCamara(V, false);
  };
  /* Modo mira (en la compu): el mouse mueve la vista, como en un juego; Esc lo suelta. */
  V.cont.querySelector('#cvMira').onclick = function () {
    if (!V.c3) return;
    visorSalirRecorrido(V, true);
    visorPreviaOcultar(V);
    V.c3.mira(true);
  };
  /* Caminar por el local (en 3D), o volver a verlo de arriba. */
  V.cont.querySelector('#cvCaminar').onclick = function () {
    if (!V.c3) return;
    visorSalirRecorrido(V, true);
    if (V.c3.caminando()) V.c3.dejarDeCaminar(); else V.c3.caminar();
  };
  /* Los botones llevan al cuarto de vuelta anterior o siguiente (después de girar a mano, quedan derechos otra vez). */
  /* En 3D, un cuarto de vuelta (caminando, la cabeza gira un octavo). */
  V.cont.querySelector('#cvGirarIzq').onclick = function () { if (V.usa3d) { if (V.c3) V.c3.girar(-Math.PI / (V.c3.caminando() ? 4 : 2)); return; } visorGirar(V, Math.ceil(V.giro / 90 - 0.01) * 90 - 90); };
  V.cont.querySelector('#cvGirarDer').onclick = function () { if (V.usa3d) { if (V.c3) V.c3.girar(Math.PI / (V.c3.caminando() ? 4 : 2)); return; } visorGirar(V, Math.floor(V.giro / 90 + 0.01) * 90 + 90); };
  V.cont.querySelector('#cvRecorrer').onclick = function () { visorRecorrer(V, 0); };
  V.cont.querySelector('#cvAnt').onclick = function () { if (V.rec) visorRecorrer(V, V.rec.i - 1); };
  V.cont.querySelector('#cvSig').onclick = function () { if (V.rec) visorRecorrer(V, V.rec.i + 1); };
  V.cont.querySelector('#cvSalirRec').onclick = function () { visorSalirRecorrido(V); };
  var afuera = function (e) { return e.target.closest && e.target.closest('.cv-zoom-acc, .cv-recorrer'); };
  sc.addEventListener('wheel', function (e) {
    if (V.ficha || !V.d || V.usa3d) return;
    e.preventDefault();
    visorPreviaOcultar(V);
    /* La rueda de un mouse da pasos de 100 (o líneas); el panel táctil, muchos pasitos (y con Ctrl, el pellizco). */
    var d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
    d = Math.max(-300, Math.min(300, d));
    visorZoomEn(V, V.z.k * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0022)), { x: e.clientX, y: e.clientY }, Math.abs(d) >= 50 && !e.ctrlKey);
  }, { passive: false });
  sc.addEventListener('dblclick', function (e) {
    /* En un módulo, el primer clic ya lo abrió. */
    if (V.ficha || !V.d || V.usa3d || afuera(e) || (e.target.closest && e.target.closest('.cv-caja[data-mod]'))) return;
    e.preventDefault();
    var k = e.shiftKey ? V.z.k / 2 : V.z.k >= VISOR_ZOOM_MAX - 0.01 ? 1 : V.z.k * 2;
    if (k <= 1.01) visorZoom(V, 1, 0, 0, true);
    else visorZoomEn(V, k, { x: e.clientX, y: e.clientY }, true);
  });
  /* El clic derecho sirve para mover: sin el menú del navegador arriba de la maqueta. */
  sc.addEventListener('contextmenu', function (e) { if (!afuera(e)) e.preventDefault(); });

  /** Empieza un gesto que gira o inclina: ya con todas las caras dibujadas, y el punto del piso a dejar quieto. */
  var empezar = function (g, x, y) {
    g.activo = true;
    V.gesto = true;
    visorPreviaOcultar(V);
    if (!V.todas) { V.todas = true; visorDibujar(V, false); }
    visorZoom(V, V.z.k, V.z.x, V.z.y, false, true);   // corta una animación del zoom que esté en camino
    V.mundo.style.transition = 'none';
    g.giro = V.giro; g.incl = V.incl; g.z = Object.assign({}, V.z);
    var c = x == null ? centro() : { x: x, y: y };
    g.q = visorPisoEn(V, c.x, c.y);
    g.t = visorEnPantalla(V, [g.q])[0];
  };
  /** Aplica el giro y la inclinación de ahora (una vez por cuadro) y deja quieto el punto del piso. */
  var aplicar = function () {
    cuadro = 0;
    var g = ini;
    if (!g || !g.activo || g.modo === 'mover') return;
    visorPose(V);
    visorClavar(V, g.q, g.t, g.k || V.z.k);
  };
  var pedirCuadro = function () { if (!cuadro) cuadro = requestAnimationFrame(aplicar); };
  var terminar = function (g) {
    if (cuadro) { cancelAnimationFrame(cuadro); cuadro = 0; ini = g; aplicar(); }
    ini = null;
    V.gesto = false;
    V.movidoEn = Date.now();
    if (g.modo === 'mover') return;
    /* Sin acercar, el local vuelve a quedar entero y centrado; acercada, queda donde se dejó. */
    if (V.z.k <= 1.08) visorReencuadrar(V);
  };

  sc.addEventListener('pointerdown', function (e) {
    if (V.ficha || !V.d || V.usa3d || afuera(e)) return;
    visorPreviaOcultar(V);
    if (e.pointerType === 'mouse') {
      if (e.button > 2) return;
      if (e.button === 1) e.preventDefault();   // sin el desplazamiento automático de la rueda
      ini = { raton: true, id: e.pointerId, p: { x: e.clientX, y: e.clientY }, z: Object.assign({}, V.z), activo: false,
              modo: e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey ? 'mover' : 'girar' };
      return;
    }
    dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(dedos);
    if (ids.length === 2) {
      var a = dedos[ids[0]], b = dedos[ids[1]], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ini = { dos: true, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), z: Object.assign({}, V.z), torcido: false, giroExtra: 0 };
      empezar(ini, mid.x, mid.y);
    } else if (ids.length === 1) ini = { dos: false, p: { x: e.clientX, y: e.clientY }, z: Object.assign({}, V.z), activo: false, modo: V.z.k > 1.02 ? 'mover' : 'girar' };
    /* Al tocar un módulo con el dedo, se levanta (como al pasar el mouse). */
    var caja = e.target.closest && e.target.closest('.cv-mod');
    if (caja) { caja.classList.add('cv-tocado'); setTimeout(function () { caja.classList.remove('cv-tocado'); }, 260); }
  });
  /** Arrastrar con un dedo o con el mouse: girar e inclinar, o mover. */
  var arrastrar = function (e, umbral) {
    var dx = e.clientX - ini.p.x, dy = e.clientY - ini.p.y;
    if (!ini.activo) {
      if (Math.abs(dx) + Math.abs(dy) < umbral) return;
      if (ini.modo === 'mover') { ini.activo = true; V.gesto = true; visorPreviaOcultar(V); }
      else { visorSalirRecorrido(V, true); empezar(ini); }
      /* Ya arrastrando: el resto del gesto es de la maqueta, aunque el mouse salga de ella (y al soltar no abre nada). */
      try { sc.setPointerCapture(e.pointerId); } catch (x) {}
    }
    V.movidoEn = Date.now();
    if (ini.modo === 'mover') { visorZoom(V, V.z.k, ini.z.x + dx, ini.z.y + dy, false, true); return; }
    V.giro = ini.giro - dx * 0.3;
    if (V.inclinado) V.incl = Math.max(VISOR_INCL_MIN, Math.min(VISOR_INCL_MAX, ini.incl - dy * 0.22));
    pedirCuadro();
  };
  sc.addEventListener('pointermove', function (e) {
    if (!ini) return;
    if (ini.raton) { if (e.pointerId === ini.id) arrastrar(e, 5); return; }
    if (!dedos[e.pointerId]) return;
    dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(dedos);
    if (ini.dos && ids.length >= 2) {
      var a = dedos[ids[0]], b = dedos[ids[1]], dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      /* Retorcer los dedos gira, pero recién pasados 8° (pellizcar solo, para acercar, no gira de casualidad). */
      var dg = (Math.atan2(b.y - a.y, b.x - a.x) - ini.ang) * 180 / Math.PI;
      dg = ((dg + 540) % 360) - 180;
      if (!ini.torcido && Math.abs(dg) > 8) { ini.torcido = true; ini.giroExtra = -dg; visorSalirRecorrido(V, true); }
      if (ini.torcido) V.giro = ini.giro + dg + ini.giroExtra;
      ini.k = Math.max(1, Math.min(VISOR_ZOOM_MAX, ini.z.k * dist / ini.dist));
      ini.t = [mid.x, mid.y];
      V.movidoEn = Date.now();
      pedirCuadro();
    } else if (!ini.dos) arrastrar(e, 8);
  });
  var suelta = function (e) {
    if (ini && ini.raton) {
      if (e.pointerId !== ini.id) return;
      var g = ini;
      if (g.activo) terminar(g); else ini = null;
      return;
    }
    if (!dedos[e.pointerId]) return;
    delete dedos[e.pointerId];
    var ids = Object.keys(dedos), antes = ini;
    if (antes && antes.activo) terminar(antes);
    /* Si queda un dedo después de pellizcar, sigue moviendo desde ahí (si quedó acercada). */
    ini = ids.length === 1 && antes && antes.dos ? { dos: false, p: dedos[ids[0]], z: Object.assign({}, V.z), activo: V.z.k > 1.02, modo: 'mover' } : null;
  };
  sc.addEventListener('pointerup', suelta);
  sc.addEventListener('pointercancel', suelta);
  sc.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && ini && ini.raton && !ini.activo) ini = null; });
}

/** Gira e inclina la maqueta en el acto, durante un gesto (la escala y el centro quedan como estaban). */
function visorPose(V) {
  var mu = V.mundo;
  mu.style.transition = 'none';
  mu.style.setProperty('--giro', V.giro.toFixed(2) + 'deg');
  mu.style.setProperty('--incl', (V.inclinado ? V.incl : 0).toFixed(2) + 'deg');
}
/** Un paso con el teclado: gira dg grados e inclina di (alrededor de lo que está en el medio de la pantalla). */
function visorPaso(V, dg, di) {
  if (!V.d || V.ficha) return;
  visorSalirRecorrido(V, true);
  if (!V.todas) { V.todas = true; visorDibujar(V, false); }
  var nuevaIncl = V.inclinado ? Math.max(VISOR_INCL_MIN, Math.min(VISOR_INCL_MAX, V.incl + di)) : V.incl;
  if (V.z.k <= 1.08) { V.giro += dg; V.incl = nuevaIncl; visorZoom(V, 1, 0, 0, true); visorCamara(V, false); return; }
  var r = V.escena.getBoundingClientRect();
  visorZoom(V, V.z.k, V.z.x, V.z.y, false, true);
  var q = visorPisoEn(V, r.left + r.width / 2, r.top + r.height / 2), t = visorEnPantalla(V, [q])[0];
  V.giro += dg; V.incl = nuevaIncl;
  visorPose(V);
  visorClavar(V, q, t, V.z.k);
}

/* ── Dónde cae cada cosa en la pantalla (para girar alrededor de lo que se mira) ── */

/** Dónde se ven ahora en la pantalla unos puntos del piso (en las coordenadas del plano): unas marcas invisibles en el
    piso de la maqueta, medidas de una vez. */
function visorEnPantalla(V, pts) {
  var mu = V.mundo, marcas = mu.querySelectorAll('.cv-marca');
  for (var i = marcas.length; i < pts.length; i++) mu.insertAdjacentHTML('beforeend', '<i class="cv-marca" aria-hidden="true"></i>');
  marcas = mu.querySelectorAll('.cv-marca');
  pts.forEach(function (p, j) { marcas[j].style.left = p[0].toFixed(2) + 'px'; marcas[j].style.top = p[1].toFixed(2) + 'px'; });
  return pts.map(function (p, j) { var r = marcas[j].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
}
/** El punto del piso (en las coordenadas del plano, adentro del local) que se ve en (sx, sy) de la pantalla. El piso es
    un plano: con cuatro de sus puntos se arma cómo se proyecta (una homografía) y se invierte. */
function visorPisoEn(V, sx, sy) {
  var pl = V.plano, q = [[pl.x0, pl.y0], [pl.x1, pl.y0], [pl.x1, pl.y1], [pl.x0, pl.y1]];
  var h = visorHomografia(visorEnPantalla(V, q), q), p = h ? h(sx, sy) : null;
  if (!p || !isFinite(p[0]) || !isFinite(p[1])) return [(pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2];
  return [Math.max(pl.x0, Math.min(pl.x1, p[0])), Math.max(pl.y0, Math.min(pl.y1, p[1]))];
}
/** La homografía que lleva los 4 puntos de a los 4 de b (resuelve el sistema de 8 ecuaciones). */
function visorHomografia(a, b) {
  var M = [], i, j, c;
  for (i = 0; i < 4; i++) {
    var x = a[i][0], y = a[i][1], u = b[i][0], v = b[i][1];
    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (c = 0; c < 8; c++) {
    var piv = c;
    for (i = c + 1; i < 8; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    var t = M[c]; M[c] = M[piv]; M[piv] = t;
    for (i = 0; i < 8; i++) {
      if (i === c) continue;
      var f = M[i][c] / M[c][c];
      for (j = c; j < 9; j++) M[i][j] -= f * M[c][j];
    }
  }
  var h = M.map(function (fila, k) { return fila[8] / fila[k]; });
  return function (x, y) { var w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
/** Dónde se vería un punto de la pantalla sin el zoom (el acercamiento es lo último que se aplica: una escala y un
    corrimiento alrededor del centro de la escena). Lee el zoom que se ve de verdad, aunque esté animándose. */
function visorSinZoom(V, x, y) {
  var r = V.escena.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  var m = (getComputedStyle(V.zoomEl).transform || '').match(/matrix\(([^)]+)\)/), v = m ? m[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
  var k = v[0] || 1;
  return [ox + (x - ox - v[4]) / k, oy + (y - oy - v[5]) / k];
}
/** Deja el punto q del piso en el lugar t de la pantalla, con el zoom k (corriendo el zoom, no la maqueta). */
function visorClavar(V, q, t, k) {
  var p = visorEnPantalla(V, [q])[0], b = visorSinZoom(V, p[0], p[1]);
  var r = V.escena.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  visorZoom(V, k, t[0] - ox - k * (b[0] - ox), t[1] - oy - k * (b[1] - oy), false, true);
}

/* ── Girar el local y recorrerlo pared por pared ── */

/** El ángulo más cercano al de ahora que apunta a destino (así gira por el camino corto). */
function visorAngulo(V, destino) {
  var d = ((destino - V.giro) % 360 + 540) % 360 - 180;
  return V.giro + d;
}
/** Gira el local a g grados (sin acercar). */
function visorGirar(V, g) {
  if (!V.d) return;
  if (!V.todas) { V.todas = true; visorDibujar(V, false); }
  V.giro = g;
  visorZoom(V, 1, 0, 0, true);
  visorCamara(V, false);
}
/** Las paradas del recorrido: cada pared con módulos (de la entrada dando la vuelta), la vidriera y el centro. El giro
    deja esa pared al fondo, de frente a quien mira (con las fotos a la vista). */
var VISOR_PARADAS = [['izquierda', 'Pared izquierda', 90], ['fondo', 'El fondo', 0], ['derecha', 'Pared derecha', 270], ['frente', 'El frente', 180], ['vidriera', 'La vidriera', 0], ['centro', 'El centro', 0]];
function visorParadas(V) {
  var grupos = {};
  (V.plano ? V.plano.items : []).forEach(function (it) {
    if (it.tipo !== 'modulo') return;
    var g = it.vidriera ? 'vidriera' : it.pared || 'centro';
    (grupos[g] = grupos[g] || []).push(it.m);
  });
  return VISOR_PARADAS.filter(function (p) { return grupos[p[0]]; }).map(function (p) {
    var mods = grupos[p[0]], nums = mods.map(function (m) { return esVidriera(m) ? m.nombre : m.isla ? numeroVista(V.d, m) : m.numero; });
    return { clave: p[0], nombre: V.tab === 'deposito' && p[0] !== 'centro' ? p[1].replace('El frente', 'La pared de abajo').replace('El fondo', 'La pared de arriba') : p[1],
             giro: p[2], ids: mods.map(function (m) { return m.id; }), nums: rangosMixtos(nums) };
  });
}
/** Va a la parada i: gira el local y se acerca a esa pared. */
function visorRecorrer(V, i) {
  if (!V.d || V.ficha || (V.usa3d && !V.c3)) return;
  var paradas = visorParadas(V);
  if (!paradas.length) return;
  i = (i + paradas.length) % paradas.length;
  var p = paradas[i];
  V.rec = { i: i, paradas: paradas };
  if (V.c3) { V.c3.mirarModulos(p.ids); visorBarraRecorrido(V, i, paradas, p); return; }
  if (!V.todas) { V.todas = true; visorDibujar(V, false); }
  var mu = V.mundo, antes = { giro: V.giro, z: Object.assign({}, V.z) };
  /* Se mide cómo queda (sin animar), se vuelve a donde estaba y se anima hasta ahí. */
  V.giro = visorAngulo(V, p.giro);
  visorZoom(V, 1, 0, 0, false);
  visorCamara(V, true);
  var u = null;
  p.ids.forEach(function (id) {
    var c = mu.querySelector('.cv-caja[data-mod="' + id + '"]');
    if (!c) return;
    c.querySelectorAll('.cv-tapa, .cv-frente').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      u = u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
  });
  var box = V.escena.getBoundingClientRect(), abajo = 120, k = 1, x = 0, y = 0;
  if (u) {
    k = Math.max(1, Math.min(3.2, (box.width - 32) / Math.max(1, u.r - u.l), (box.height - abajo - 24) / Math.max(1, u.b - u.t)));
    var cx = (u.l + u.r) / 2 - (box.left + box.width / 2), cy = (u.t + u.b) / 2 - (box.top + (box.height - abajo) / 2);
    x = -k * cx; y = -k * cy;
  }
  /* De vuelta a como estaba, sin animar; después, la animación hasta la parada. */
  var destino = V.giro;
  V.giro = antes.giro;
  visorCamara(V, true);
  visorZoom(V, antes.z.k, antes.z.x, antes.z.y, false, true);
  void mu.offsetWidth;
  V.giro = destino;
  visorCamara(V, false);
  visorZoom(V, k, x, y, true, true);
  visorBarraRecorrido(V, i, paradas, p);
}
function visorBarraRecorrido(V, i, paradas, p) {
  var barra = V.cont.querySelector('#cvRecorrerBarra');
  barra.hidden = false;
  V.raiz.classList.add('cv-recorriendo');
  V.cont.querySelector('#cvParadaN').textContent = (i + 1) + ' de ' + paradas.length;
  V.cont.querySelector('#cvParada').textContent = p.nombre + (p.nums ? ' · ' + p.nums : '');
}
function visorSalirRecorrido(V, sinAnimar) {
  if (!V.rec) return;
  V.rec = null;
  var barra = V.cont.querySelector('#cvRecorrerBarra');
  if (barra) barra.hidden = true;
  V.raiz.classList.remove('cv-recorriendo');
  if (sinAnimar) return;
  if (V.c3) V.c3.vistaInicial(); else if (!V.usa3d) visorZoom(V, 1, 0, 0, true);
}

/* ── La cámara: inclinada o desde arriba, centrada y del tamaño de la pantalla ── */

function visorMedir(V, incl) {
  var mu = V.mundo, box = V.escena.getBoundingClientRect();
  mu.style.transition = 'none';
  mu.style.setProperty('--incl', incl + 'deg');
  mu.style.setProperty('--giro', V.giro + 'deg');
  mu.style.setProperty('--s', 1);
  mu.style.setProperty('--dx', '0px'); mu.style.setProperty('--dy', '0px');
  var u = null;
  mu.querySelectorAll('.cv-piso, .cv-tapa, .cv-vereda').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    u = u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  });
  if (!u) return { s: 1, dx: 0, dy: 0 };
  /* Como se vería sin el zoom (si estaba acercada, o alejándose todavía): el encuadre es del local entero. */
  var a = visorSinZoom(V, u.l, u.t), b = visorSinZoom(V, u.r, u.b);
  u = { l: a[0], t: a[1], r: b[0], b: b[1] };
  /* Abajo queda lugar para los botones de acercar (que no tapen el local). */
  var abajo = 58, alto = box.height - abajo;
  var s = Math.min((box.width - 24) / (u.r - u.l), (alto - 20) / (u.b - u.t));
  s = Math.max(0.2, Math.min(s, 1.6));
  /* El centro de lo que se ve, al centro de la escena (lo inclinado sube las tapas). */
  var cx = (u.l + u.r) / 2 - (box.left + box.width / 2), cy = (u.t + u.b) / 2 - (box.top + alto / 2);
  return { s: s, dx: -cx * s, dy: -cy * s };
}
function visorCamara(V, sinAnimar) {
  var incl = V.inclinado ? V.incl : 0;
  /* Girado o inclinado a mano, los ángulos no son redondos: se guarda el encuadre por décima de grado. */
  var clave = (Math.round(incl * 10) / 10) + V.tab + ':' + (Math.round((((V.giro % 360) + 360) % 360) * 10) / 10);
  var mu = V.mundo;
  if (!V.fit[clave]) {
    /* Medir mueve la maqueta: después se vuelve a como estaba, así la animación sale de ahí (y no da un salto). */
    var antes = ['--incl', '--giro', '--s', '--dx', '--dy'].map(function (k) { return [k, mu.style.getPropertyValue(k)]; });
    V.fit[clave] = visorMedir(V, incl);
    antes.forEach(function (a) { if (a[1]) mu.style.setProperty(a[0], a[1]); });
  }
  var f = V.fit[clave];
  if (!sinAnimar) { mu.style.transition = 'none'; void mu.offsetWidth; }
  mu.style.transition = sinAnimar ? 'none' : '';
  mu.style.setProperty('--incl', incl + 'deg');
  mu.style.setProperty('--giro', V.giro + 'deg');
  mu.style.setProperty('--s', f.s.toFixed(3));
  mu.style.setProperty('--dx', f.dx.toFixed(1) + 'px');
  mu.style.setProperty('--dy', f.dy.toFixed(1) + 'px');
  V.sFit = f.s;
  visorRotulos(V);
}
/** Después de girar o inclinar con el mouse sin acercar: el local vuelve a quedar entero y centrado, de a poco. */
function visorReencuadrar(V) {
  visorZoom(V, 1, 0, 0, true);
  visorCamara(V, false);
}

/* ── Las fotos de los módulos: una miniatura liviana para la maqueta; la grande, sólo al entrar al módulo ── */

var _miniaturas = {}, _miniCola = [], _miniActivas = 0;
/** Una miniatura de la foto: se arma una vez en el teléfono y queda guardada en este aparato. Es de 360 px (antes 240):
    con los módulos más altos y el zoom hasta 5 veces, la de 240 se veía borrosa. Se guarda con otro nombre (la de 240
    no sirve) y las viejas se borran solas a los 40 días. */
var MINI_LADO = 360;
function miniClave(ruta) { return ruta + '@' + MINI_LADO; }
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
        var lado = MINI_LADO, esc2 = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
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
        var q = db.transaction('fotos').objectStore('fotos').get(miniClave(ruta));
        q.onsuccess = function () { var v = q.result; ok(v && v.b ? v.b : v instanceof Blob ? v : null); };
        q.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
  });
}
function miniGuardar(ruta, blob) {
  miniBase().then(function (db) { if (db) try { db.transaction('fotos', 'readwrite').objectStore('fotos').put({ b: blob, t: Date.now() }, miniClave(ruta)); } catch (e) {} });
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
/** ¿La foto es horizontal (más ancha que alta)? Desde el 15/10 se puede sacar con el teléfono acostado. Se mide una vez
    por dirección. */
var _visorHoriz = {};
function visorHorizontal(u) {
  if (!u) return Promise.resolve(false);
  if (!_visorHoriz[u]) _visorHoriz[u] = new Promise(function (ok) {
    var i = new Image();
    i.onload = function () { ok(i.naturalWidth > i.naturalHeight * 1.05); };
    i.onerror = function () { ok(false); };
    i.src = u;
  });
  return _visorHoriz[u];
}
function visorFotos(V) {
  V.mundo.querySelectorAll('.cv-caja[data-mod]').forEach(function (c) {
    var e = V.estado[c.dataset.mod];
    if (!e || !e.foto_path) return;
    miniaturaFoto(e.foto_path).then(function (u) {
      if (!u) { c.classList.add('foto-no'); return; }
      c.querySelectorAll('.cv-foto-cara').forEach(function (f) { f.style.backgroundImage = 'url("' + u + '")'; });
      c.classList.add('foto-lista');
      /* Horizontal: entera en la cara del módulo (sin cortarle los costados). */
      visorHorizontal(u).then(function (h) { c.querySelectorAll('.cv-foto-cara').forEach(function (f) { f.classList.toggle('cv-horizontal', h); }); });
    });
  });
}

/* ── Pasar el mouse por un módulo (en la compu): su foto al lado, vertical y grande, sin abrirlo ("que desde acá mismo,
      desde el observador, pueda verlo un poquito mejor"). Primero la miniatura; si se queda un rato, la foto entera. ── */
function visorPrevia(V) {
  var sc = V.escena, espera = null, nitida = null, actual = null, pos = { x: 0, y: 0 };
  var el = document.createElement('div');
  el.className = 'cv-previa';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  sc.appendChild(el);
  var ocultar = function () { clearTimeout(espera); clearTimeout(nitida); actual = null; el.hidden = true; delete el.dataset.mod; visor3dEncima(V, null); };
  V.previa = { el: el, ocultar: ocultar };
  /** Al lado del puntero, adentro de la escena (si no entra a la derecha, a la izquierda). */
  var ubicar = function () {
    var r = sc.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, x = pos.x - r.left + 22, y = pos.y - r.top - h * 0.35;
    if (x + w > r.width - 10) x = pos.x - r.left - 22 - w;
    el.style.left = Math.max(10, x).toFixed(0) + 'px';
    el.style.top = Math.max(10, Math.min(r.height - h - 10, y)).toFixed(0) + 'px';
  };
  var mostrar = function (id) {
    var m = visorModulo(V, id);
    if (!m || V.ficha || V.gesto) return;
    var d = V.d, e = V.estado[m.id] || {}, s = d.sectorDe[m.sector_id], resp = s && d.persona[s.responsable_id];
    var numero = m.isla ? numeroVista(d, m) : m.numero, nombre = m.isla ? m.nombre : nombrePropio(m), que = queHay(m);
    var titulo = esVidriera(m) ? m.nombre : (s && s.tipo === 'deposito' ? 'Depósito ' : 'Módulo ') + numero;
    var bajada = esVidriera(m) ? que : que && nombre && que !== nombre ? nombre + ' · ' + que : que || nombre;
    el.dataset.mod = m.id;
    el.innerHTML = '<div class="cv-previa-foto' + (e.foto_path ? '' : ' sin') + '">' + (e.foto_path ? '' : '<span>Todavía no hay foto</span>') + '</div>' +
      '<div class="cv-previa-txt"><b>' + esc(titulo) + '</b>' + (bajada ? '<span>' + esc(bajada) + '</span>' : '') +
        '<small><i style="background:' + visorColor(V, m) + '"></i>' + esc(esVidriera(m) ? 'Por turnos' : resp ? nombreLista(resp) : 'Sin responsable') +
          (e.foto_path && e.tomada_en ? ' · ' + esc(textoHace(e.tomada_en)) : '') + (e.foto_path && e.nivel ? ' · ' + esc(NIVEL[e.nivel] || e.nivel) : '') + '</small>' +
        '<em>' + (V.c3 && V.c3.caminando() && !V.c3.mirando() ? 'Clic para ir hasta ahí' : 'Clic para abrirlo') + '</em></div>';
    var f = el.querySelector('.cv-previa-foto');
    if (e.foto_path) {
      miniaturaFoto(e.foto_path).then(function (u) {
        if (!u || el.dataset.mod !== m.id || f.classList.contains('cv-nitida')) return;
        f.style.backgroundImage = 'url("' + u + '")';
        visorHorizontal(u).then(function (h) { if (el.dataset.mod === m.id) { f.classList.toggle('cv-horizontal', h); ubicar(); } });
      });
      nitida = setTimeout(function () { if (el.dataset.mod === m.id) visorCargarFoto(f, e.foto_path); }, 650);
    }
    el.hidden = false;
    ubicar();
  };
  /** El puntero quedó arriba del módulo id (o de ninguno; arriba de la foto misma, la deja). Recién al quedarse un
      momento (pasar por arriba de varios no los muestra a todos). */
  var encima = function (id, sobrePrevia) {
    if (!id) { if (!sobrePrevia) ocultar(); return; }
    if (id === actual) return;
    clearTimeout(espera); clearTimeout(nitida);
    actual = id;
    visor3dEncima(V, id);
    espera = setTimeout(function () { if (actual === id) mostrar(id); }, el.hidden ? 180 : 60);
  };
  /** Mostrarla para el módulo id, al lado del punto x, y (el puntito del modo mira). */
  V.previa.mostrarEn = function (id, x, y) { pos = { x: x, y: y }; encima(id); if (!el.hidden) ubicar(); };
  sc.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse' || V.usa3d) return;
    pos = { x: e.clientX, y: e.clientY };
    var c = !e.buttons && !V.ficha && !V.gesto && e.target.closest && e.target.closest('.cv-caja[data-mod]');
    encima(c ? c.dataset.mod : null, e.target.closest && e.target.closest('.cv-previa'));
  });
  sc.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || (V.c3 && V.c3.mirando())) return;   // en mira manda el puntito
    pos = { x: e.clientX, y: e.clientY };
    if (V.usa3d) {
      /* En 3D (de arriba o caminando): el módulo debajo del puntero; no mientras se arrastra ni arriba de los botones. */
      var sobre = e.target.closest && e.target.closest('.cv-previa'), fuera = e.target.closest && e.target.closest('.cv-zoom-acc, .cv-recorrer');
      var m = V.c3 && !e.buttons && !V.ficha && !sobre && !fuera ? V.c3.moduloEn(e.clientX, e.clientY) : null;
      encima(m ? m.id : null, sobre);
    }
    if (!el.hidden) ubicar();
  });
  sc.addEventListener('pointerleave', ocultar);
}
function visorPreviaOcultar(V) { if (V.previa) V.previa.ocultar(); }

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
  if (esVidriera(m)) return { clave: 'p:turnos', texto: 'Vidriera (por turnos)', color: COLOR_VIDRIERA };
  var s = V.d.sectorDe[m.sector_id], p = s && s.responsable_id;
  return { clave: 'p:' + (p || 'nadie'), texto: p && V.d.persona[p] ? nombreLista(V.d.persona[p]) : 'Sin responsable', color: visorColor(V, m) };
}
/** Lo que se lee arriba de cada módulo: qué hay (SQL 114) o, si no tiene, su nombre. */
function visorEtiqueta(m) { return queHay(m) || (m.isla ? m.nombre : nombrePropio(m)); }
/** ¿Puede escribir qué hay en este módulo? op.puedeNombrar es sí o no (el supervisor), o una función: el vendedor, en
    sus módulos (o los que cubre) y en la vidriera, que es de todos (SQL 118). */
function visorPuedeNombrar(V, m) { var p = V.op.puedeNombrar; return typeof p === 'function' ? !!p(m, V.d) : !!p; }
/** Qué hay en cada módulo (los que tienen nombre o qué hay), enteros: en la maqueta, en el celular, se leen al acercar. */
function visorListaQue(V, mods, abierto) {
  var d = V.d, con = mods.filter(function (m) { return visorEtiqueta(m); });
  if (!con.length) return '';
  return '<details class="cv-sec cv-que-sec"' + abierto + '><summary>Qué hay en cada módulo</summary>' +
    '<p class="cv-ayuda cv-solo-ocultos">En el plano se leen al acercarlo.</p><div class="cv-lista-que">' + con.map(function (m) {
      var n = m.isla ? m.nombre : nombrePropio(m), q = queHay(m);
      if (esVidriera(m)) return '<button type="button" data-abrir="' + esc(m.id) + '"><b>V</b>' + esc(m.nombre + (q ? ' · ' + q : '')) + '</button>';
      return '<button type="button" data-abrir="' + esc(m.id) + '"><b>' + esc(String(m.isla ? numeroVista(d, m) : m.numero)) + '</b>' + esc(n && q ? n + ' · ' + q : n || q) + '</button>';
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
  if (V.c3) V.c3.pintar(function (m) { return visorCategoria(V, m).color; }, V.resaltado ? function (m) { return visorCategoria(V, m).clave === V.resaltado; } : null);
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
    '<details class="cv-sec"><summary>Ajustes de la vista</summary>' +
      (V.usa3d ? '<div class="cv-sens"><span>Sensibilidad del mouse</span><div class="cv-seg" role="group" aria-label="Sensibilidad del mouse">' +
        [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']].map(function (x) {
          return '<button type="button" data-sens="' + x[0] + '" aria-pressed="' + (visorSensClave() === x[0]) + '">' + x[1] + '</button>';
        }).join('') + '</div></div>' : '') +
      (visor3dPuede() ? '<button type="button" class="cv-interruptor" id="cvVer3d" aria-pressed="' + !!V.usa3d + '"><span>Ver en 3D</span><small>El local como es, para recorrerlo caminando</small></button>' : '') +
      '<button type="button" class="cv-interruptor" id="cvLiviano" aria-pressed="' + !!V.liviano + '">' +
      '<span>Modo liviano</span><small>Sin sombras ni texturas, para teléfonos lentos</small></button></details>';
}

/* ── El local en 3D (15/10/2026, pedido de Mauricio: "pasalo al motor de verdad, hagámoslo dentro de la aplicación…
      en modo caminar, que se puedan ver las fotos, cada módulo"). El motor (three.js) está en croquis3d.js, armado
      desde croquis3d/fuente.js, y cómo es el mueble de cada local, en croquis-locales.js: se bajan la primera vez y
      quedan en el sitio (andan sin internet). Tocar un módulo abre la misma ficha de siempre, con su foto; pasar el
      mouse, la foto al lado. La maqueta de siempre queda para los equipos que no pueden con el 3D (o si se apaga en
      "Ajustes de la vista"). ── */
var _visorMotor = null, _visorWebgl = null;
/** ¿Este equipo puede con el 3D? (WebGL 2, el que usa el motor) */
function visor3dPuede() {
  if (_visorWebgl === null) {
    try {
      var g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_lose_context');
      _visorWebgl = !!g;
      if (x) x.loseContext();
    } catch (e) { _visorWebgl = false; }
  }
  return _visorWebgl;
}
/** En 3D, salvo que se haya apagado en este equipo. */
function visor3dElegido() {
  var g = null;
  try { g = localStorage.getItem('vdh_visor_3d'); } catch (e) {}
  return g !== '0' && visor3dPuede();
}
/** Un teléfono o una compu con pocos núcleos: el 3D arranca liviano (si no se eligió a mano). */
function visor3dLento() { return (navigator.hardwareConcurrency || 8) <= 4 || !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches); }
function visorLivianoElegido() { try { return localStorage.getItem('vdh_visor_liviano') !== null; } catch (e) { return false; } }
/** El motor y los locales, una sola vez. El import() se arma en el momento: así un navegador viejo, que no lo conoce, igual
    lee este archivo (y ve la maqueta de siempre). */
function visor3dMotor() {
  if (!_visorMotor) {
    _visorMotor = new Promise(function (ok) {
      var importar = new Function('u', 'return import(u)');
      ok(Promise.all([importar(new URL('croquis3d.js', document.baseURI).href), importar(new URL('croquis-locales.js', document.baseURI).href)]));
    }).then(function (r) { return { montar: r[0].montarCroquis3D, locales: r[1].LOCALES_3D || {} }; });
    _visorMotor.catch(function () { _visorMotor = null; });   // sin conexión: la próxima vez prueba de nuevo
  }
  return _visorMotor;
}

/** Arma (o vuelve a armar) el 3D de lo que se está mirando: el salón o el depósito. caminar: 'puerta' (llegó por la
    puerta) o dónde estaba parado ({x, z, yaw}); sin él, el local de arriba. */
function visor3dMontar(V, caminar) {
  if (!V.usa3d || !V.d || !V.d.modulos.length) return;
  var pide = V.c3pide = (V.c3pide || 0) + 1, tab = V.tab;
  if (!V.c3 && !V.escena.querySelector('#cv3dCargando')) V.escena.insertAdjacentHTML('beforeend', '<p class="cv-cargando" id="cv3dCargando">Armando el local en 3D…</p>');
  visor3dMotor().then(function (motor) {
    if (pide !== V.c3pide || !V.usa3d || _visorActual !== V) return;   // ya se pidió otro, se apagó o se cerró
    visor3dSoltar(V);
    var d = V.d, pl = planoMapa(d, tab), salon = pl.tipo !== 'deposito', loc = motor.locales[V.op.local.id] || null;
    var numero = function (m) { return esVidriera(m) ? 'V' : m.isla ? numeroVista(d, m) : m.numero; };
    var cont = document.createElement('div');
    cont.className = 'cv-3d';
    V.escena.insertBefore(cont, V.zoomEl.nextSibling);
    V.c3cont = cont;
    var cam = V.cont.querySelector('#cvCaminar'), acc = V.cont.querySelector('.cv-zoom-acc');
    if (cam) cam.hidden = false;   // para medir los botones de abajo como van a quedar
    V.c3 = motor.montar(cont, pl, d, {
      liviano: !!V.liviano, estilo: pl.frente === 'shopping' ? 'shopping' : 'calle', texturaPiso: 'croquis-img/textura-cemento.webp',
      /* El local, arriba de los botones de abajo (que no los tape). */
      abajo: acc ? Math.max(0, V.escena.getBoundingClientRect().bottom - acc.getBoundingClientRect().top + 8) : 0,
      altoModulos: visorAltoModulos(pl, salon ? VISOR_ALTO.pared : VISOR_ALTO.deposito),
      color: function (m) { return visorCategoria(V, m).color; },
      numero: numero,
      /* El número, con el puntito de "sin foto reciente" (como en la maqueta de siempre). */
      rotulo: function (m, color) {
        var e = V.estado[m.id] || {};
        return '<b style="border-color:' + color + '"' + (e.sin_foto_reciente || !e.foto_path ? ' class="vieja" title="Sin foto reciente"' : '') + '>' + esc(String(numero(m) || '')) + '</b>';
      },
      tipos: function (m) { return prendasDe(visorEtiqueta(m)); },
      /* El mueble de cada módulo como el de verdad (de las fotos del local) y lo que va entre módulos; los locales que
         todavía no están en croquis-locales.js, con los muebles de siempre. */
      ficha: loc && loc.fichas && salon ? function (m) { return loc.fichas[String(numero(m))] || null; } : null,
      entre: loc && salon ? loc.entre || null : null,
      medioDeposito: !!(loc && loc.medioDeposito),
      quieto: function () { return !!V.ficha; },
      sensibilidad: visorSensibilidad(),
      alMira: function (si) { visor3dMira(V, si); },
      alApuntar: function (a) { visor3dApuntar(V, a); },
      caminar: caminar || null,
      alTocar: function (m, o) { visor3dAbrir(V, m, o && o.desdeMira); },
      alPuerta: function (destino) { visor3dPasar(V, destino); },
      alCaminar: function (si) { visor3dCaminando(V, si); },
      /* Si en este equipo va lento, pasa solo a liviano (si no se eligió a mano). */
      alLento: function () {
        if (V.liviano || visorLivianoElegido() || !V.c3) return;
        V.liviano = true;
        V.raiz.classList.add('cv-liviano');
        visor3dMontar(V, V.c3.caminando() ? V.c3.dondeEstoy() : null);
        visorPanel(V);
        avisarVisor('El 3D iba lento en este equipo: pasó a liviano (se cambia en "Ajustes de la vista").');
      }
    });
    V.c3tab = tab;
    if (window.ResizeObserver) { V.c3ro = new ResizeObserver(function () { if (V.c3) V.c3.redimensionar(); }); V.c3ro.observe(cont); }
    if (!caminar && !V.inclinado) V.c3.inclinar(true);
    visorPintar(V);
    visor3dBotones(V);
  }).catch(function (e) {
    if (pide === V.c3pide && _visorActual === V) visor3dFallo(V, e);
  }).then(function () {
    if (pide !== V.c3pide) return;
    var c = V.escena.querySelector('#cv3dCargando'), fu = V.cont.querySelector('#cvFundido');
    if (c) c.remove();
    if (fu && fu.classList.contains('negro')) requestAnimationFrame(function () { fu.classList.remove('negro'); });
  });
}
/** Suelta el 3D (para volver a armarlo, al apagarlo o al salir): la placa de video queda libre. */
function visor3dSoltar(V) {
  if (V.c3ro) { V.c3ro.disconnect(); V.c3ro = null; }
  if (V.c3) { try { V.c3.destruir(); } catch (e) {} V.c3 = null; }
  if (V.c3cont) { V.c3cont.remove(); V.c3cont = null; }
  V.c3tab = null;
}
/** No anduvo (no bajó o este equipo no pudo dibujarlo): la maqueta de siempre. La próxima vez prueba de nuevo. */
function visor3dFallo(V, e) {
  if (window.console && console.warn) console.warn('Observador: el 3D no anduvo', e);
  visor3dSoltar(V);
  V.usa3d = false;
  V.raiz.classList.remove('cv-modo-3d');
  visor3dBotones(V);
  if (!V.d) return;
  visorZoom(V, 1, 0, 0, false);
  visorDibujar(V, true);
  /* No bajó el motor (el import() falla con "Failed to fetch…") o no pudo dibujar (el WebGL). */
  var red = navigator.onLine === false || /fetch|module|import|network/i.test(String((e && e.message) || e));
  avisarVisor(red ? 'Sin conexión para bajar el 3D: el local se ve como siempre.' : 'Este equipo no pudo mostrar el 3D: el local se ve como siempre.');
}
/** Prender o apagar el 3D ("Ajustes de la vista"): queda elegido en este equipo. */
function visor3dCambiar(V, si) {
  try { localStorage.setItem('vdh_visor_3d', si ? '1' : '0'); } catch (e) {}
  visorSalirRecorrido(V, true);
  visorPreviaOcultar(V);
  visor3dSoltar(V);
  V.c3pide = (V.c3pide || 0) + 1;   // si había uno a medio armar, ya no vale
  V.usa3d = !!si && visor3dPuede();
  V.raiz.classList.toggle('cv-modo-3d', V.usa3d);
  visor3dBotones(V);
  visorZoom(V, 1, 0, 0, false);
  if (V.d && V.d.modulos.length) visorDibujar(V, true);
}
/** Los botones de abajo: en 3D, Caminar; Centrar siempre a mano (vuelve a la vista de arriba). */
function visor3dBotones(V) {
  var en3d = !!V.c3, cam = V.cont.querySelector('#cvCaminar'), rec = V.cont.querySelector('#cvRecorrer'), ce = V.cont.querySelector('#cvCentrar');
  if (cam) cam.hidden = !en3d;
  var mi = V.cont.querySelector('#cvMira');
  if (mi) mi.hidden = !en3d || !visorPuedeMira();
  if (rec) rec.classList.toggle('cv-lima', !en3d);
  if (ce) ce.hidden = !en3d && V.z.k === 1;
  visor3dCaminando(V, en3d && V.c3.caminando());
}
/** Caminando o de arriba: el botón y la ayuda de cómo se maneja con el mouse. */
function visor3dCaminando(V, si) {
  var cam = V.cont.querySelector('#cvCaminar'), ay = V.cont.querySelector('#cvAyudaRaton');
  /* Sólo si hay una puerta para pasar (la del depósito en el salón, o la del salón en el depósito). */
  var puerta = V.c3 && V.c3.puertas.some(function (p) { return p.toque; }) ? ' · <b>Doble clic en la puerta</b> para pasar' : '';
  if (cam) { cam.setAttribute('aria-pressed', !!si); cam.textContent = si ? 'Ver de arriba' : 'Caminar'; }
  V.raiz.classList.toggle('cv-caminando', !!si);
  if (!ay) return;
  ay.innerHTML = !V.c3 ? V.ayudaRaton : V.c3.mirando()
    ? '<b>Mové el mouse</b> para mirar · <b>Flechas</b> o <b>WASD</b> para caminar (<b>Shift</b> corre) · <b>Clic</b>: el módulo del puntito abre su foto, la puerta pasa, el piso camina · <b>Esc</b> suelta el mouse'
    : si
    ? '<b>Clic en el piso</b> para caminar · <b>Arrastrá</b> para mirar · <b>Flechas</b> para moverte (<b>Shift</b> corre) · <b>Clic en un módulo</b> para ir y ver su foto' + puerta
    : '<b>Arrastrá</b> para girar · <b>Rueda</b> o <b>doble clic</b> para acercar · <b>Clic derecho</b> para mover · <b>Clic en un módulo</b> para ver su foto' + puerta;
}
/** Tocar un módulo en 3D (o en la lista de qué hay): su ficha, saliendo desde su número. Desde el modo mira, al cerrarla
    se vuelve a mira. */
function visor3dAbrir(V, m, desdeMira) {
  if (V.ficha || !visorModulo(V, m.id)) return;
  V.volverMira = !!desdeMira;
  var c = V.c3 && V.c3.cajas.filter(function (x) { return x.m.id === m.id; })[0], b = c && c.el.querySelector('b');
  abrirFicha(V, m.id, b && document.body.contains(b) && b.getBoundingClientRect().width ? b : V.escena);
}
/* ── Modo mira y sensibilidad (pedido de Mauricio, 15/10: "un modo mira… un puntito en el medio y que el mouse lo pueda
      mover para cualquier lado… y bajarle un poco la sensibilidad, está como muy, muy rápido"). ── */
var VISOR_SENS = { baja: 0.6, media: 1, alta: 1.6 };
function visorSensClave() { var k = null; try { k = localStorage.getItem('vdh_visor_sens'); } catch (e) {} return VISOR_SENS[k] ? k : 'media'; }
function visorSensibilidad() { return VISOR_SENS[visorSensClave()]; }
/** Mira sólo con mouse (en el teléfono no hay puntero que trabar). */
function visorPuedeMira() { return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.Element && Element.prototype.requestPointerLock); }
/** Entró o salió del modo mira: el puntito, el botón y la ayuda. */
function visor3dMira(V, si) {
  var b = V.cont.querySelector('#cvMira');
  if (b) b.setAttribute('aria-pressed', !!si);
  V.raiz.classList.toggle('cv-mirando', !!si);
  if (!si) visor3dApuntar(V, null);
  visor3dCaminando(V, !!(V.c3 && V.c3.caminando()));
}
/** En mira, lo que quedó en el puntito: un módulo (su número se agranda y su foto aparece al lado) o una puerta. */
function visor3dApuntar(V, a) {
  var p = V.cont.querySelector('#cvMiraPunto'), t = V.cont.querySelector('#cvMiraTexto');
  if (p) p.classList.toggle('sobre', !!a);
  if (t) t.textContent = a && a.puerta ? (a.puerta.destino === 'deposito' ? 'Puerta al depósito · clic para pasar' : 'Puerta al salón · clic para pasar') : '';
  if (!V.previa) return;
  if (a && a.m) { var r = V.escena.getBoundingClientRect(); V.previa.mostrarEn(a.m.id, r.left + r.width / 2, r.top + r.height / 2); }
  else V.previa.ocultar();
}
/** El número del módulo que tiene el puntero encima se agranda (como el módulo que se levanta en la maqueta). */
function visor3dEncima(V, id) {
  if (!V.c3) return;
  V.c3.cajas.forEach(function (c) { c.el.classList.toggle('encima', c.m.id === id); });
}
/** Pasar por una puerta (doble clic, o caminando hasta ella): funde a negro y aparece del otro lado, caminando. */
function visor3dPasar(V, destino) {
  if ((destino !== 'salon' && destino !== 'deposito') || destino === V.tab || V.ficha || !V.d) return;
  if (destino === 'deposito' && !V.d.dep.length) return;
  var fu = V.cont.querySelector('#cvFundido');
  if (fu) fu.classList.add('negro');
  visorPreviaOcultar(V);
  setTimeout(function () {
    if (_visorActual !== V) return;
    V.tab = destino;
    V.cont.querySelectorAll('#cvTabs [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tab === destino); });
    visorSalirRecorrido(V, true);
    V.resaltado = null;
    V.c3caminar = 'puerta';
    visorDibujar(V, true);
  }, visorMovimiento() ? 340 : 0);
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
  if (it && it.vidriera) return 'Vidriera';
  if (!it || !it.pared) return 'Adentro del salón';
  return { izquierda: 'Pared izquierda', fondo: 'Fondo', derecha: 'Pared derecha', frente: 'Frente' }[it.pared];
}

function abrirFicha(V, id, caja) {
  var m = visorModulo(V, id);
  if (!m) return;
  var d = V.d, e = V.estado[id] || {}, s = d.sectorDe[m.sector_id], resp = s && d.persona[s.responsable_id], sup = s && d.persona[s.suplente_id];
  var numero = m.isla ? numeroVista(d, m) : m.numero, nombre = m.isla ? m.nombre : nombrePropio(m), que = queHay(m);
  var titulo = esVidriera(m) ? m.nombre : (s && s.tipo === 'deposito' ? 'Depósito ' : 'Módulo ') + numero, ref = m.foto_referencia_path;
  var puedeQue = visorPuedeNombrar(V, m), iaQue = puedeQue ? String(m.contenido_ia || '').trim() : '';
  /* Liquidación (SQL 125): con la columna y fuera del depósito; la cambia quien puede escribir qué hay. */
  var liq = 'liquidacion' in m && !(s && s.tipo === 'deposito');
  var origen = caja.querySelector('.cv-frente, .cv-tapa') || caja;
  V.raiz.insertAdjacentHTML('beforeend', '<div class="cv-ficha-fondo"></div><section class="cv-ficha" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
    '<header class="cv-ficha-cab"><div><small>' + esc(visorDonde(V, m)) + '</small><h2>' + esc(titulo) + '</h2>' +
      (nombre ? '<p class="cv-nombre">' + esc(nombre) + '</p>' : '') +
      '<p class="cv-que-linea"' + (que || puedeQue ? '' : ' hidden') + '><span class="cv-que-et"' + (que ? '' : ' hidden') + '>Qué hay:</span><span class="cv-que" id="cvQue">' + esc(que || '') + '</span>' +
        '<small class="cv-que-ia" id="cvQueOrigen"' + (que && m.contenido_origen === 'ia' ? '' : ' hidden') + '>lo anotó la IA</small>' +
        (puedeQue ? '<button class="cv-enlace" type="button" id="cvCambiarQue">' + (que ? 'Cambiar' : '+ Qué hay en este módulo') + '</button>' : '') + '</p>' +
      /* Lo había escrito una persona y la IA ve otra cosa: no lo pisa, lo sugiere (SQL 118). */
      '<p class="cv-que-sug" id="cvQueSug"' + (iaQue ? '' : ' hidden') + '>La IA ve: <b id="cvQueSugTexto">' + esc(iaQue) + '</b>' +
        '<button class="cv-enlace" type="button" id="cvQueUsar">Usar esto</button></p>' +
      '<form class="cv-que-form" id="cvQueForm" hidden><input id="cvQueInput" maxlength="60" autocomplete="off" placeholder="Remeras, buzos, jeans…" aria-label="Qué hay en este módulo">' +
        '<button class="cv-boton cv-lima" type="submit">Guardar</button><button class="cv-boton" type="button" id="cvQueCancelar">Cancelar</button></form>' +
      (liq && puedeQue ? '<button type="button" class="cv-interruptor cv-liq" id="cvLiq" aria-pressed="' + !!m.liquidacion + '"><span>Liquidación</span><small>Va por talle, no por color (la IA no pide el degradé)</small></button>'
        : liq && m.liquidacion ? '<p class="cv-liq-et">Liquidación · va por talle</p>' : '') + '</div>' +
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
        '<span class="cv-persona"><i style="background:' + visorColor(V, m) + '"></i>' + (esVidriera(m) ? esc('Por turnos: ' + turnoVidrieraTexto(d)) : esc(resp ? nombreLista(resp) : 'Sin responsable') + (sup ? ' · lo cubre ' + esc(nombreLista(sup)) : '')) + '</span>' +
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
  visorPreviaOcultar(V);
  V.ficha = { el: ficha, fondo: fondo, caja: caja, id: id, desde: Date.now() };
  ficha.querySelector('.cv-cerrar').onclick = function () { cerrarFicha(V); };
  /* Un doble clic en un módulo: el primero lo abre y el segundo cae en el fondo; ése no lo cierra. */
  fondo.onclick = function () { if (V.ficha && Date.now() - V.ficha.desde < 450) return; cerrarFicha(V); };
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
  visorFichaLiquidacion(V, m);
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
    var volver = V.volverMira;
    V.volverMira = false;
    if (ya) return;
    /* Se abrió desde el modo mira: vuelve a él. */
    if (volver && V.c3 && V.c3.caminando()) V.c3.mira(true);
    if (f.caja && document.body.contains(f.caja)) f.caja.focus({ preventScroll: true });
    if (V.ajustePendiente) { V.ajustePendiente = false; V.alTamano(); }
  };
  V.escena.classList.remove('cv-detras');
  var origen = f.caja && document.body.contains(f.caja) ? f.caja.querySelector('.cv-frente, .cv-tapa') || f.caja : null;
  if (origen && !origen.getBoundingClientRect().width) origen = null;   // el número quedó fuera de la vista
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
  div.classList.remove('cv-nitida', 'cv-foto-falla', 'cv-horizontal');
  div.textContent = '';
  var sigue = function () { return div.dataset.ruta === ruta; };
  var falla = function () { if (!sigue()) return; div.style.backgroundImage = ''; div.classList.add('cv-foto-falla'); div.textContent = 'Esta foto ya no está guardada.'; };
  if (!sinMiniatura) miniaturaFoto(ruta).then(function (u) {
    if (!u || !sigue() || div.classList.contains('cv-nitida')) return;
    div.style.backgroundImage = 'url("' + u + '")';
    visorHorizontal(u).then(function (h) { if (sigue() && !div.classList.contains('cv-nitida')) div.classList.toggle('cv-horizontal', h); });
  });
  urlFirmada(ruta).then(function (u) {
    if (!sigue()) return;
    if (!u) { falla(); return; }
    var img = new Image();
    img.onload = function () {
      if (!sigue()) return;
      div.style.backgroundImage = 'url("' + u + '")';
      div.classList.add('cv-nitida');
      div.classList.toggle('cv-horizontal', img.naturalWidth > img.naturalHeight * 1.05);   // el recuadro, con la forma de la foto
    };
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

/* ── Qué hay en este módulo (Remeras, Buzos…), aparte de su nombre (SQL 114): se lee arriba del módulo en la maqueta.
      También en lo de adentro (la caja, las mesas): su nombre, el que los ubica en el croquis, no cambia.
      Desde el SQL 118 lo escribe también el vendedor en lo suyo, y lo anota la IA con cada foto: si lo había escrito
      una persona, la IA no lo pisa y queda su sugerencia ("La IA ve: Buzos · Usar esto"). ── */
function visorFichaQue(V, m) {
  var f = V.ficha.el, b = f.querySelector('#cvCambiarQue'), form = f.querySelector('#cvQueForm');
  if (!b || !form) return;
  var input = f.querySelector('#cvQueInput'), usar = f.querySelector('#cvQueUsar');
  /** Ya guardado: la ficha, el rótulo de la maqueta y la lista del panel. */
  var mostrar = function (v, origen) {
    m.contenido = v || null;
    m.contenido_origen = v ? origen : null;
    m.contenido_ia = null;
    f.querySelector('#cvQue').textContent = v;
    f.querySelector('.cv-que-et').hidden = !v;
    f.querySelector('#cvQueOrigen').hidden = !(v && origen === 'ia');
    f.querySelector('#cvQueSug').hidden = true;
    b.textContent = v ? 'Cambiar' : '+ Qué hay en este módulo';
    form.hidden = true; b.hidden = false;
    var caja = V.mundo.querySelector('.cv-caja[data-mod="' + m.id + '"] .cv-rotulo');
    if (caja) {
      var span = caja.querySelector('span'), p = visorEtiqueta(m);
      if (p) { if (!span) { span = document.createElement('span'); caja.appendChild(span); } span.textContent = recortar(p, 18); }
      else if (span) span.remove();
    }
    visorPanel(V);
    avisarVisor(v ? 'Listo: en el croquis dice "' + v + '".' : 'Listo: se borró qué hay.');
  };
  var fallo = function (err) {
    var t = String(err && err.message);
    /* Sin el SQL 118: la función nueva no está, o la de antes (sólo el supervisor) no deja al vendedor. */
    var falta = /orden_modulo_contenido|PGRST202|could not find the function|Sólo el supervisor del local escribe qué hay/i.test(t);
    avisarVisor(falta ? 'Falta correr el SQL 118 en Supabase (está en el Escritorio, en "App Orden").' : esDeRed(err) ? 'Sin conexión: no se guardó. Probá de nuevo.' : mensajeDe(err));
  };
  b.onclick = function () { input.value = queHay(m) || ''; form.hidden = false; b.hidden = true; input.focus(); };
  f.querySelector('#cvQueCancelar').onclick = function () { form.hidden = true; b.hidden = false; };
  form.onsubmit = function (e) {
    e.preventDefault();
    var guardar = form.querySelector('[type="submit"]');
    if (guardar.disabled) return;
    var v = String(input.value || '').replace(/\s+/g, ' ').trim();
    guardar.disabled = true;
    llamar('orden_modulo_contenido', { p_modulo: m.id, p_contenido: v || null }).then(function () {
      guardar.disabled = false;
      mostrar(v, 'persona');
    }, function (err) { guardar.disabled = false; fallo(err); });
  };
  if (usar) usar.onclick = function () {
    if (usar.disabled) return;
    var v = f.querySelector('#cvQueSugTexto').textContent;
    usar.disabled = true;
    llamar('orden_modulo_contenido_aceptar', { p_modulo: m.id }).then(function () {
      usar.disabled = false;
      mostrar(v, 'ia');
    }, function (err) { usar.disabled = false; fallo(err); });
  };
}

/* ── Liquidación (SQL 125, pedido de Mauricio): los percheros de liquidación van por talle, no por color, y la IA no
      pide el degradé. Lo marca quien tiene el módulo o el supervisor (los mismos que escriben qué hay). ── */
function visorFichaLiquidacion(V, m) {
  var b = V.ficha.el.querySelector('#cvLiq');
  if (!b) return;
  b.onclick = function () {
    if (b.disabled) return;
    var v = !m.liquidacion;
    b.disabled = true;
    b.setAttribute('aria-pressed', v);
    llamar('orden_modulo_liquidacion', { p_modulo: m.id, p_valor: v }).then(function () {
      b.disabled = false;
      m.liquidacion = v;
      avisarVisor(v ? 'Listo: es de liquidación, va por talle.' : 'Listo: ya no es de liquidación.');
    }, function (err) {
      b.disabled = false;
      b.setAttribute('aria-pressed', !v);
      var falta = /orden_modulo_liquidacion|PGRST202|could not find the function/i.test(String(err && err.message));
      avisarVisor(falta ? 'Falta correr el SQL 125 en Supabase (está en el Escritorio, en "App Orden").' : esDeRed(err) ? 'Sin conexión: no se guardó. Probá de nuevo.' : mensajeDe(err));
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
