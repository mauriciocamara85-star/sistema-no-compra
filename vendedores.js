/**
 * VDH · La app de los vendedores — el login y "Hoy" (12/10/2026).
 *
 * Usa de datos.js sólo BASE, CLAVE, pedir() y funcion(). La sesión es
 * otra, con otra llave en el teléfono: la del Panel es por mail y la de
 * acá por PIN, y si compartieran el lugar una pisaría a la otra.
 *
 * ── El login ──────────────────────────────────────────────────────────────
 * Local → nombre → PIN de 4 números, UNA vez por celular. El PIN lo revisa
 * la Edge Function "entrar" (freno: 5 mal seguidos y 5 minutos de espera,
 * por persona) y devuelve una sesión de Supabase, que se guarda acá y se
 * renueva sola. "No soy yo" la cierra y vuelve a la lista.
 */

var K_VEND = 'vdh_vend_sesion';
var ZONA = 'America/Argentina/Buenos_Aires';

var app = document.getElementById('app');
var barra = document.getElementById('barra');
var cartel = document.getElementById('cartel');

/* ════════════════════════════════════════════════════════════════════════
   LA SESIÓN DEL VENDEDOR
   ════════════════════════════════════════════════════════════════════════ */

function leerVend_() {
  try { return JSON.parse(localStorage.getItem(K_VEND) || 'null'); } catch (e) { return null; }
}
function guardarVend_(s) {
  try {
    if (s) localStorage.setItem(K_VEND, JSON.stringify(s));
    else localStorage.removeItem(K_VEND);
  } catch (e) { /* incógnito: dura lo que la pestaña */ }
  _vend = s;
}
var _vend = leerVend_();

function anotarVend_(r, persona) {
  guardarVend_({
    token: r.access_token,
    refresco: r.refresh_token,
    /* Un minuto antes de que venza, como en datos.js: una llamada que sale
       justo en el límite llega vencida. expires_at viene en segundos. */
    vence: r.expires_at ? (r.expires_at - 60) * 1000 : Date.now() + 3540 * 1000,
    persona: persona || (_vend && _vend.persona)
  });
}

function sinSesionVend_() {
  var e = new Error('Se cerró la sesión. Entrá de nuevo con tu PIN.');
  e.sinSesion = true;
  return e;
}

/**
 * Un token que sirva, renovándolo si hace falta. Sin señal NO borra la
 * sesión: tira el error de red y la pantalla dice "sin conexión". Sólo la
 * borra si Supabase dice que el refresco ya no vale.
 */
function tokenVend() {
  if (!_vend || !_vend.refresco) return Promise.reject(sinSesionVend_());
  if (Date.now() < _vend.vence) return Promise.resolve(_vend.token);
  return fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: _vend.refresco })
  }).then(function (r) {
    if (r.status === 400 || r.status === 401) { guardarVend_(null); throw sinSesionVend_(); }
    if (!r.ok) throw new Error('Supabase respondió ' + r.status);
    return r.json();
  }).then(function (d) {
    anotarVend_({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at });
    return _vend.token;
  });
}

function leer(ruta) {
  return tokenVend().then(function (t) { return pedir(ruta, { sesion: t }); });
}

function salir() {
  var t = _vend && _vend.token;
  guardarVend_(null);
  if (t) {
    fetch(BASE + '/auth/v1/logout', { method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t } })
      .catch(function () {});
  }
  pantallaLocales();
}

/* ════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ════════════════════════════════════════════════════════════════════════ */

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** La fecha de hoy en Argentina, AAAA-MM-DD (la del teléfono puede estar en otra zona). */
function hoyAR(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d || new Date());
}

/** El lunes de esta semana, AAAA-MM-DD. */
function lunesAR() {
  var h = hoyAR();
  var d = new Date(h + 'T12:00:00Z');
  var dia = (d.getUTCDay() + 6) % 7;   // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

function hora(ts) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(ts));
}

function diaCorto(ts) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'short' }).format(new Date(ts)).replace('.', '');
}

/* "Lunes 12/10", armado a mano: el formato es-AR del navegador da "lunes 12-10". */
function fechaLarga() {
  var d = new Date();
  var dia = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'long' }).format(d);
  var h = hoyAR(d).split('-');
  return dia.charAt(0).toUpperCase() + dia.slice(1) + ' ' + Number(h[2]) + '/' + Number(h[1]);
}

var _cartelTimer = null;
function avisar(texto) {
  cartel.textContent = texto;
  cartel.hidden = false;
  clearTimeout(_cartelTimer);
  _cartelTimer = setTimeout(function () { cartel.hidden = true; }, 3500);
}

function esDeRed(e) { return e && !e.delServidor && !e.sinSesion; }

function pantallaError(e, reintentar) {
  if (e && e.sinSesion) { guardarVend_(null); pantallaLocales(e.message); return; }
  barra.hidden = !_vend;
  app.innerHTML =
    '<p class="marca"><b>VDH</b> Vendedores</p>' +
    '<h1>' + (esDeRed(e) ? 'Sin conexión' : 'Algo falló') + '</h1>' +
    '<p class="bajada">' + esc(esDeRed(e) ? 'No hay señal o internet anda lento. Probá de nuevo en un rato.' : (e && e.message) || '') + '</p>' +
    '<button class="boton lima" id="reintentar">Probar de nuevo</button>';
  document.getElementById('reintentar').onclick = reintentar;
}

/* ════════════════════════════════════════════════════════════════════════
   EL LOGIN: LOCAL → NOMBRE → PIN
   ════════════════════════════════════════════════════════════════════════ */

function pantallaLocales(mensaje) {
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  funcion('orden_login_locales', {}).then(function (locales) {
    app.innerHTML =
      '<p class="marca"><b>VDH</b> Vendedores</p>' +
      '<h1>¿En qué local trabajás?</h1>' +
      '<p class="bajada">' + esc(mensaje || 'Elegí tu local. Esto se hace una sola vez en este celular.') + '</p>' +
      '<div class="lista">' + locales.map(function (l, i) {
        return '<button class="opcion" data-i="' + i + '">' + esc(l.nombre) + '</button>';
      }).join('') + '</div>';
    app.querySelectorAll('.opcion').forEach(function (b) {
      b.onclick = function () { pantallaPersonas(locales[+b.dataset.i]); };
    });
  }).catch(function (e) { pantallaError(e, function () { pantallaLocales(mensaje); }); });
}

function pantallaPersonas(local) {
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  funcion('orden_login_personas', { p_local: local.id }).then(function (gente) {
    app.innerHTML =
      '<button class="volver" id="volver">‹ Cambiar de local</button>' +
      '<h1>¿Quién sos?</h1>' +
      '<p class="bajada">' + esc(local.nombre) + '</p>' +
      '<div class="lista">' + gente.map(function (p, i) {
        return '<button class="opcion" data-i="' + i + '">' + esc(p.nombre) + '</button>';
      }).join('') + '</div>';
    document.getElementById('volver').onclick = function () { pantallaLocales(); };
    app.querySelectorAll('.opcion').forEach(function (b) {
      b.onclick = function () { pantallaPin(local, gente[+b.dataset.i]); };
    });
  }).catch(function (e) { pantallaError(e, function () { pantallaPersonas(local); }); });
}

function pantallaPin(local, persona) {
  var pin = '';
  var ocupado = false;
  var primerNombre = String(persona.nombre).split(' ')[0];
  app.innerHTML =
    '<button class="volver" id="volver">‹ No soy ' + esc(primerNombre) + '</button>' +
    '<h1>Hola, ' + esc(primerNombre) + '</h1>' +
    '<p class="bajada">Poné tu PIN de 4 números. Te lo pide una sola vez en este celular.</p>' +
    '<div class="puntos" id="puntos"><i class="punto"></i><i class="punto"></i><i class="punto"></i><i class="punto"></i></div>' +
    '<p class="aviso-pin" id="avisoPin"></p>' +
    '<div class="teclado" id="teclado">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="tecla" data-n="' + n + '">' + n + '</button>'; }).join('') +
      '<button class="tecla vacia" tabindex="-1" aria-hidden="true"></button>' +
      '<button class="tecla" data-n="0">0</button>' +
      '<button class="tecla borrar" data-n="x" aria-label="Borrar">⌫</button>' +
    '</div>';
  document.getElementById('volver').onclick = function () { pantallaPersonas(local); };
  var puntos = document.getElementById('puntos');
  var aviso = document.getElementById('avisoPin');
  var teclas = app.querySelectorAll('.tecla[data-n]');

  function dibujar() {
    puntos.querySelectorAll('.punto').forEach(function (p, i) { p.classList.toggle('lleno', i < pin.length); });
  }
  function trabar(seg) {
    teclas.forEach(function (t) { t.disabled = true; });
    setTimeout(function () {
      teclas.forEach(function (t) { t.disabled = false; });
      aviso.className = 'aviso-pin';
      aviso.textContent = 'Ya podés probar de nuevo.';
    }, seg * 1000);
  }
  function mal(texto, seg) {
    pin = '';
    dibujar();
    puntos.classList.remove('mal');
    void puntos.offsetWidth;          // reinicia la animación
    puntos.classList.add('mal');
    aviso.className = 'aviso-pin error';
    aviso.textContent = texto;
    if (seg) trabar(seg);
  }
  function mandar() {
    ocupado = true;
    puntos.classList.add('esperando');
    aviso.className = 'aviso-pin';
    aviso.textContent = 'Revisando…';
    fetch(BASE + '/functions/v1/entrar', {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: persona.id, pin: pin })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      ocupado = false;
      puntos.classList.remove('esperando');
      if (x.ok && x.d.access_token) {
        var p = x.d.persona || {};
        p.local = local.id ? local.nombre : '';
        anotarVend_(x.d, p);
        pantallaHoy();
        return;
      }
      var d = x.d || {};
      if (d.espera > 0) {
        mal((d.porque || 'Esperá un rato.') + ' Faltan ' + Math.ceil(d.espera / 60) + ' min.', d.espera);
      } else if (d.restantes != null) {
        mal('PIN incorrecto. ' + (d.restantes === 1 ? 'Te queda 1 intento.' : 'Te quedan ' + d.restantes + ' intentos.'));
      } else {
        mal(d.porque || 'No se pudo entrar. Probá de nuevo.');
      }
    }).catch(function () {
      ocupado = false;
      puntos.classList.remove('esperando');
      mal('Sin conexión. Probá de nuevo cuando haya señal.');
    });
  }

  teclas.forEach(function (t) {
    t.onclick = function () {
      if (ocupado) return;
      if (t.dataset.n === 'x') { pin = pin.slice(0, -1); }
      else if (pin.length < 4) { pin += t.dataset.n; }
      aviso.textContent = '';
      dibujar();
      if (pin.length === 4) mandar();
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   ADENTRO: LA BARRA Y LAS PESTAÑAS
   ════════════════════════════════════════════════════════════════════════ */

var _pestana = 'hoy';
barra.querySelectorAll('.pestana').forEach(function (b) {
  b.onclick = function () { irA(b.dataset.pestana); };
});

function irA(p) {
  _pestana = p;
  barra.querySelectorAll('.pestana').forEach(function (b) { b.classList.toggle('activa', b.dataset.pestana === p); });
  if (p === 'hoy') pantallaHoy();
  else if (p === 'perfil') pantallaPerfil();
  else pantallaPronto(p);
}

function adentro() {
  barra.hidden = false;
  app.className = 'app con-barra';
}

function cabeza(titulo) {
  var per = _vend.persona || {};
  return '<div class="cabeza"><div>' +
    '<h1>' + esc(titulo) + '</h1>' +
    '<p class="bajada" style="margin:0">' + esc([per.local, fechaLarga()].filter(Boolean).join(' · ')) + '</p>' +
    '</div><button class="noesyo" id="noesyo">No soy yo</button></div>';
}

function engancharNoSoyYo() {
  var b = document.getElementById('noesyo');
  if (b) b.onclick = preguntarSalir;
}

function preguntarSalir() {
  var nombre = ((_vend && _vend.persona && _vend.persona.nombre) || '').split(' ')[0];
  if (confirm('¿No sos ' + nombre + '? Se cierra la sesión y para volver a entrar hace falta el PIN.')) salir();
}

/* ════════════════════════════════════════════════════════════════════════
   HOY
   ════════════════════════════════════════════════════════════════════════ */

var NIVEL = { impecable: 'Impecable', bien: 'Bien', a_mejorar: 'A mejorar', fuera_de_estandar: 'Fuera de estándar' };

var CAMARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';

function pantallaHoy() {
  if (!_vend) { pantallaLocales(); return; }
  _pestana = 'hoy';
  barra.querySelectorAll('.pestana').forEach(function (b) { b.classList.toggle('activa', b.dataset.pestana === 'hoy'); });
  adentro();
  var per = _vend.persona || {};
  var primerNombre = String(per.nombre || '').split(' ')[0];
  app.innerHTML = cabeza('Hola, ' + primerNombre) + '<p class="cargando">Cargando…</p>';
  engancharNoSoyYo();

  var hoy = hoyAR();
  var id = valor(per.id);
  Promise.all([
    /* Lo de hoy y lo que quedó pendiente (el depósito vence el viernes). */
    leer('/orden_v_controles?select=id,modulo_id,modulo_numero,modulo_nombre,sector_tipo,tipo,estado,vence_en,nivel' +
         '&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente)' +
         '&order=sector_tipo.asc,modulo_numero.asc'),
    leer('/orden_v_persona_semana?select=nivel_semana,controles&persona_id=eq.' + id + '&semana=eq.' + lunesAR()),
    /* Lo que la IA marcó y está sin corregir: ese módulo dice "Corregir". */
    leer('/orden_tareas?select=modulo_id&persona_id=eq.' + id + '&estado=eq.pendiente&origen=eq.ia')
  ]).then(function (r) {
    if (_pestana !== 'hoy') return;
    dibujarHoy(r[0] || [], (r[1] || [])[0], r[2] || []);
  }).catch(function (e) { pantallaError(e, pantallaHoy); });
}

function estadoDe(c, corregir) {
  if (c.estado === 'enviado' || c.estado === 'revisado') return { clase: 'listo', texto: 'Listo', hecho: true };
  if (c.estado === 'vencido') return { clase: 'vencido', texto: 'No se mandó', hecho: true };
  if (corregir[c.modulo_id]) return { clase: 'corregir', texto: 'Corregir' };
  if (c.tipo === 'sorpresa') return { clase: 'sorpresa', texto: 'Control sorpresa' };
  return { clase: 'pendiente', texto: 'Pendiente' };
}

function dibujarHoy(controles, semana, tareasIA) {
  var per = _vend.persona || {};
  var primerNombre = String(per.nombre || '').split(' ')[0];
  var corregir = {};
  tareasIA.forEach(function (t) { if (t.modulo_id) corregir[t.modulo_id] = true; });

  var total = controles.length;
  var hechos = controles.filter(function (c) { return c.estado === 'enviado' || c.estado === 'revisado'; }).length;
  var nivel = semana && semana.nivel_semana ? NIVEL[semana.nivel_semana] : null;

  var html = cabeza('Hola, ' + primerNombre);

  if (per.rol && per.rol !== 'vendedor') {
    html += '<div class="nota">Entraste como ' + esc(per.rol === 'admin' ? 'administrador' : per.rol) +
      '. Las pantallas para revisar las fotos del equipo vienen en otro paso.</div>';
  }

  html += '<div class="resumen">' +
    (total
      ? '<div class="grande">' + hechos + ' de ' + total + ' controles</div>' +
        '<div class="progreso"><i style="width:' + Math.round(100 * hechos / total) + '%"></i></div>'
      : '<div class="grande">Hoy no tenés controles</div><div class="progreso"><i style="width:100%"></i></div>') +
    '<div class="chico">' + (nivel ? 'Tu orden esta semana: ' + esc(nivel) : 'Tu orden esta semana: todavía sin fotos') + '</div>' +
    '</div>';

  var grupos = [['salon', 'Tus módulos'], ['deposito', 'Depósito']];
  grupos.forEach(function (g) {
    var lista = controles.filter(function (c) { return c.sector_tipo === g[0]; });
    if (!lista.length) return;
    html += '<div class="seccion">' + g[1] + '</div>';
    lista.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var vence = '';
      if (!e.hecho && c.vence_en) {
        vence = 'Vence ' + (hoyAR(new Date(c.vence_en)) === hoyAR() ? 'hoy ' : diaCorto(c.vence_en) + ' ') + hora(c.vence_en);
      }
      html += '<div class="modulo' + (e.hecho ? ' hecho' : '') + '">' +
        '<div class="que"><div class="nombre">' + esc(c.modulo_nombre) + '</div>' +
        '<div class="info"><span class="chip ' + e.clase + '">' + e.texto + '</span>' +
        (vence ? '<span class="chip vence">' + esc(vence) + '</span>' : '') + '</div></div>' +
        '<button class="camara" data-id="' + esc(c.id) + '" aria-label="Sacar foto de ' + esc(c.modulo_nombre) + '">' + CAMARA + '</button>' +
        '</div>';
    });
  });

  if (!total) {
    html += '<div class="vacio">Cuando te toque un control, aparece acá y te llega un aviso.</div>';
  }

  app.innerHTML = html;
  engancharNoSoyYo();
  app.querySelectorAll('.camara').forEach(function (b) {
    b.onclick = function () { avisar('La cámara llega en el próximo paso.'); };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   PERFIL Y LO QUE FALTA
   ════════════════════════════════════════════════════════════════════════ */

function pantallaPerfil() {
  adentro();
  var per = _vend.persona || {};
  app.innerHTML =
    '<h1>Perfil</h1>' +
    '<div class="perfil"><div class="nombre">' + esc(per.nombre) + '</div>' +
    '<div class="bajada" style="margin:4px 0 0">' + esc(per.local || 'Oficina') + '</div></div>' +
    '<button class="boton" id="salir">No soy yo</button>' +
    '<p class="nota">Tu historial, tu foto y tus desafíos aparecen acá más adelante.</p>';
  document.getElementById('salir').onclick = preguntarSalir;
}

function pantallaPronto(p) {
  adentro();
  var t = { tareas: 'Tareas', ideas: 'Ideas' }[p] || '';
  app.innerHTML = '<h1>' + t + '</h1><div class="vacio">Esta parte llega en el próximo paso.</div>';
}

/* ════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () { /* sin PWA, la app anda igual */ });
}

if (_vend && _vend.refresco) pantallaHoy();
else pantallaLocales();
