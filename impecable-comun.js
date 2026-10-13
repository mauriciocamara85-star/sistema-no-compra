/**
 * Impecable · lo que comparten la app (vendedores.html) y la administración
 * (impecable-admin.html): la sesión, las llamadas a la base, las fotos y los
 * formatos de fecha.
 *
 * Usa de datos.js sólo BASE, CLAVE, pedir(), funcion(), valor() y rechazo().
 * La sesión es propia (por PIN), con otra llave en el teléfono que la del
 * Panel (por mail): si compartieran el lugar, una pisaría a la otra.
 */

var NOMBRE_APP = 'Impecable';
var K_VEND = 'vdh_vend_sesion';
var ZONA = 'America/Argentina/Buenos_Aires';
var BUCKET = 'orden-fotos';
/* La llave pública de las notificaciones: la misma del Club (mandar-avisos).
   No es secreta; la privada vive sólo en los Secrets de Supabase. */
var VAPID_PUBLICA = 'BCG_mGNkME20VL9WrdVAUqSnPOPdNqQOIdyDGnY3UG8WbC-CbxV87N83mGVW71SZW_wrRYXMv2ZGkEWzRGLBxoo';

var NIVEL = { impecable: 'Impecable', bien: 'Bien', a_mejorar: 'A mejorar', fuera_de_estandar: 'Fuera de estándar' };
var ROL = { vendedor: 'Vendedor', supervisor: 'Supervisor', admin: 'Administrador', gerencia: 'Gerencia' };
/* La gente sin local (vos, los dueños) va en un grupo aparte. La base lo
   llama "Administrador" desde el SQL 93 (antes "Oficina" o "Supervisión"). */
var SIN_LOCAL = 'Administrador';

/* ════════════════════════════════════════════════════════════════════════
   LA SESIÓN
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

/* Si dos pantallas piden un token vencido a la vez, se renueva UNA vez: el
   refresco es de un solo uso, y el segundo pedido con el mismo lo invalidaría
   y cerraría la sesión sin motivo. */
var _renovando = null;

/**
 * Un token que sirva, renovándolo si hace falta. Sin señal NO borra la
 * sesión: tira el error de red y la pantalla dice "sin conexión". Sólo la
 * borra si Supabase dice que el refresco ya no vale.
 */
function tokenVend() {
  /* Otra pestaña (la app y la administración abiertas a la vez) puede haber
     renovado la sesión: se mira lo guardado antes de usar el refresco, que es
     de un solo uso. */
  var guardada = leerVend_();
  if (guardada && _vend && guardada.refresco !== _vend.refresco) _vend = guardada;
  if (!_vend || !_vend.refresco) return Promise.reject(sinSesionVend_());
  if (Date.now() < _vend.vence) return Promise.resolve(_vend.token);
  if (!_renovando) {
    var refresco = _vend.refresco;
    _renovando = fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresco })
    }).then(function (r) {
      if (r.status === 400 || r.status === 401) {
        /* Si mientras tanto otra pestaña la renovó, se sigue con ésa en vez de cerrar todo. */
        var otra = leerVend_();
        if (otra && otra.refresco && otra.refresco !== refresco) { _vend = otra; return null; }
        guardarVend_(null);
        throw sinSesionVend_();
      }
      if (!r.ok) throw new Error('Supabase respondió ' + r.status);
      return r.json().then(function (d) {
        anotarVend_({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at });
        return _vend.token;
      });
    });
    /* Se suelta antes que cualquier otra espera (se anota primero). */
    _renovando.then(function () { _renovando = null; }, function () { _renovando = null; });
  }
  /* null: la renovó otra pestaña. Se vuelve a empezar con la de ella, que
     puede estar vigente o necesitar otra renovación. */
  return _renovando.then(function (t) { return t || tokenVend(); });
}

/** Leer una tabla o vista con la sesión de quien entró (la seguridad la pone la base). */
function leer(ruta) {
  return tokenVend().then(function (t) { return pedir(ruta, { sesion: t }); });
}
/** Escribir directo en una tabla (sólo lo que la seguridad deja: los ajustes, al administrador). */
function escribir(ruta, metodo, cuerpo) {
  return tokenVend().then(function (t) { return pedir(ruta, { sesion: t, metodo: metodo, cuerpo: cuerpo }); });
}
/**
 * Una función de la base, con la sesión.
 *
 * No usa funcion() de datos.js porque ésa siempre lee la respuesta como JSON,
 * y las funciones que no devuelven nada (marcar "No pude", pedir más tiempo,
 * el descargo) contestan 204 sin cuerpo: leerla así tira un error y la
 * pantalla diría "falló" cuando en realidad se hizo.
 */
function llamar(nombre, args) {
  return tokenVend().then(function (t) {
    return fetch(BASE + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    });
  }).then(function (r) {
    return r.text().then(function (txt) {
      if (!r.ok) {
        var msg = txt;
        try { msg = JSON.parse(txt).message || txt; } catch (e) {}
        throw rechazo(msg);
      }
      if (!txt) return null;
      try { return JSON.parse(txt); } catch (e) { return txt; }
    });
  });
}

function cerrarSesion() {
  var t = _vend && _vend.token;
  guardarVend_(null);
  if (t) {
    /* scope=local: cierra sólo este aparato (sin eso, Supabase cierra la sesión en todos). */
    fetch(BASE + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t } })
      .catch(function () {});
  }
}

/* Las fotos chicas (cajas, historial) se abren enteras al tocarlas. */
document.addEventListener('click', function (e) {
  var img = e.target && e.target.closest && e.target.closest('.foto-chica img');
  if (img && img.src) window.open(img.src, '_blank', 'noopener');
});

function yo() { return (_vend && _vend.persona) || {}; }
function esSupervision() { var r = yo().rol; return r === 'supervisor' || r === 'admin' || r === 'gerencia'; }
/** Gerencia (los dueños) ve todo y no cambia nada. */
function soloMira() { return yo().rol === 'gerencia'; }
function esAdmin() { return yo().rol === 'admin'; }

/* ════════════════════════════════════════════════════════════════════════
   FECHAS Y TEXTOS
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

/** El lunes de la semana de una fecha AAAA-MM-DD (de hoy, si no se pasa). */
function lunesAR(f) {
  var d = new Date((f || hoyAR()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

function sumarDias(f, n) {
  var d = new Date(f + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function hora(ts) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(ts));
}

function diaCorto(ts) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'short' }).format(new Date(ts)).replace('.', '');
}

/** "12/10" (de un timestamp o de una fecha AAAA-MM-DD). */
function diaMes(v) {
  var f = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : hoyAR(new Date(v));
  var p = f.split('-');
  return Number(p[2]) + '/' + Number(p[1]);
}

/* "Lunes 12/10", armado a mano: el formato es-AR del navegador da "lunes 12-10". */
function fechaLarga() {
  var d = new Date();
  var dia = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'long' }).format(d);
  return dia.charAt(0).toUpperCase() + dia.slice(1) + ' ' + diaMes(hoyAR(d));
}

/** "Vence hoy 18:00" / "Vence vie 18:00" / "Vencida". */
function textoVence(ts, estado) {
  if (estado === 'vencida' || estado === 'vencido') return 'Vencida';
  if (!ts) return '';
  return 'Vence ' + (hoyAR(new Date(ts)) === hoyAR() ? 'hoy ' : diaCorto(ts) + ' ' + diaMes(ts) + ' ') + hora(ts);
}

function pesos(n) {
  if (n == null || n === '') return '—';
  var v = Number(n);
  return (v < 0 ? '−' : '') + '$ ' + Math.abs(Math.round(v)).toLocaleString('es-AR');
}

function nombreLocal(l) { return l && l.id ? l.nombre : SIN_LOCAL; }

function esDeRed(e) { return e && !e.delServidor && !e.sinSesion; }

/** El mensaje de un error de la base, sin la parte técnica. */
function mensajeDe(e) {
  var m = String((e && e.message) || 'Algo falló.');
  return m.replace(/^La base respondió \d+: /, '');
}

/* ════════════════════════════════════════════════════════════════════════
   FOTOS
   ════════════════════════════════════════════════════════════════════════ */

/** Un dibujo (video o imagen) achicado a JPEG: lado largo 1280 px, 75 %. */
function aJpeg(fuente, ancho, alto) {
  var escala = Math.min(1, 1280 / Math.max(ancho, alto));
  var cv = document.createElement('canvas');
  cv.width = Math.round(ancho * escala);
  cv.height = Math.round(alto * escala);
  cv.getContext('2d').drawImage(fuente, 0, 0, cv.width, cv.height);
  return new Promise(function (ok, mal) {
    cv.toBlob(function (b) { b ? ok(b) : mal(new Error('No se pudo procesar la foto')); }, 'image/jpeg', 0.75);
  });
}

function archivoAJpeg(archivo) {
  return new Promise(function (ok, mal) {
    var img = new Image();
    var url = URL.createObjectURL(archivo);
    img.onload = function () { URL.revokeObjectURL(url); aJpeg(img, img.naturalWidth, img.naturalHeight).then(ok, mal); };
    img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

/** Sube una foto a orden-fotos en la ruta dada. Devuelve la ruta. */
function subirArchivo(ruta, blob) {
  return tokenVend().then(function (t) {
    return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + ruta, {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: blob
    });
  }).then(function (r) {
    if (!r.ok) return r.text().then(function () { throw rechazo('No se pudo subir la foto (' + r.status + ').'); });
    return ruta;
  });
}

function nombreArchivo() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
}

/* Las direcciones firmadas duran una hora: se guardan para no pedir dos veces la misma. */
var _firmadas = {};
function urlFirmada(ruta) {
  if (!ruta) return Promise.resolve(null);
  var g = _firmadas[ruta];
  if (g && g.hasta > Date.now()) return Promise.resolve(g.url);
  return tokenVend().then(function (t) {
    return fetch(BASE + '/storage/v1/object/sign/' + BUCKET + '/' + ruta, {
      method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
  }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var u = d && d.signedURL ? BASE + '/storage/v1' + d.signedURL : null;
      if (u) _firmadas[ruta] = { url: u, hasta: Date.now() + 50 * 60 * 1000 };
      return u;
    }).catch(function () { return null; });
}

/** Pone la foto firmada en cada <img data-foto="ruta"> de un contenedor. */
function cargarFotos(cont) {
  (cont || document).querySelectorAll('img[data-foto]').forEach(function (img) {
    var ruta = img.getAttribute('data-foto');
    img.removeAttribute('data-foto');
    urlFirmada(ruta).then(function (u) { if (u) img.src = u; else img.alt = 'Foto no disponible'; });
  });
}

/** Una Edge Function con la sesión. */
function llamarFuncion(nombre, cuerpo) {
  return tokenVend().then(function (t) {
    return fetch(BASE + '/functions/v1/' + nombre, {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {})
    });
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) { d = d || {}; d._ok = r.ok; d._status = r.status; return d; });
  });
}
