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

/** Sube un archivo a otro bucket (los videos de productos testigo, SQL 102). Devuelve la ruta. */
function subirArchivoEn(bucket, ruta, blob, tipo) {
  return tokenVend().then(function (t) {
    return fetch(BASE + '/storage/v1/object/' + bucket + '/' + ruta, {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': tipo, 'x-upsert': 'false' },
      body: blob
    });
  }).then(function (r) {
    if (!r.ok) return r.text().then(function () { throw rechazo(r.status === 413 ? 'El video pesa demasiado: grabalo más corto.' : 'No se pudo subir (' + r.status + ').'); });
    return ruta;
  });
}

/** Como urlFirmada, pero de otro bucket. */
function urlFirmadaEn(bucket, ruta) {
  if (!ruta) return Promise.resolve(null);
  var clave = bucket + '|' + ruta, g = _firmadas[clave];
  if (g && g.hasta > Date.now()) return Promise.resolve(g.url);
  return tokenVend().then(function (t) {
    return fetch(BASE + '/storage/v1/object/sign/' + bucket + '/' + ruta, {
      method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
  }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var u = d && d.signedURL ? BASE + '/storage/v1' + d.signedURL : null;
      if (u) _firmadas[clave] = { url: u, hasta: Date.now() + 50 * 60 * 1000 };
      return u;
    }).catch(function () { return null; });
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUCTOS TESTIGO (SQL 102): lo que comparten la app y la administración
   ════════════════════════════════════════════════════════════════════════ */

var VIDEOS_TESTIGO = 'testigo-videos';

/** Stock sistema − cantidad real: "Faltan 2", "Sobra 1", "Da justo". */
function textoDiferencia(dif) {
  if (dif == null || dif === '' || isNaN(dif)) return '';
  dif = Number(dif);
  if (dif === 0) return 'Da justo';
  if (dif > 0) return dif === 1 ? 'Falta 1' : 'Faltan ' + dif;
  return dif === -1 ? 'Sobra 1' : 'Sobran ' + (-dif);
}

/** La diferencia sobre lo enviado: "13,3 %". */
function textoDesvio(desvio) {
  if (desvio == null || desvio === '' || isNaN(desvio)) return '';
  return String(Math.round(Number(desvio) * 10) / 10).replace('.', ',') + ' %';
}

/** "jueves 16/10" (de una fecha AAAA-MM-DD). */
function diaYFecha(f) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(f + 'T12:00:00Z')) + ' ' + diaMes(f);
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

/* ════════════════════════════════════════════════════════════════════════
   EL MAPA DEL LOCAL, visto desde arriba (SQL 99)

   Lo usan la app (cada vendedor ve el local con lo suyo marcado y toca un
   módulo para mandar la foto) y la administración (el supervisor o el
   administrador lo arma y reparte). La entrada (la vidriera) está abajo y la
   caja, atrás. Los módulos de las paredes van en orden desde la entrada,
   dando la vuelta: pared izquierda (de la entrada al fondo) → fondo → pared
   derecha → frente. Las "islas" (la caja, los percheros) van adentro, contra
   el fondo. Locales de calle: un rectángulo largo; de shopping: más
   cuadrado. El depósito, un cuadrado aparte. Cada persona tiene su color, el
   mismo en el salón y en el depósito.
   ════════════════════════════════════════════════════════════════════════ */

var COLORES_PERSONA = ['#4D9FFF', '#2FE38A', '#F0C66A', '#B38BFF', '#FF8A65', '#4DD0E1', '#F06292', '#AED581', '#FFD54F', '#90A4AE'];
var GRIS_SIN_RESPONSABLE = '#BDB8AE';
var PAREDES = [['izquierda', 'Pared izquierda'], ['fondo', 'Fondo'], ['derecha', 'Pared derecha'], ['frente', 'Frente (vidriera)']];

function nombreLista(p) { return p ? p.nombre + (p.inicial ? ' ' + p.inicial + '.' : '') : ''; }
function nombreSector(s) { return s.tipo === 'deposito' ? 'Depósito ' + s.numero : (s.nombre || 'Sector ' + s.numero); }
/** 1, 2, 3, 5 → "1–3, 5" */
function rangos(nums) {
  var n = nums.slice().sort(function (a, b) { return a - b; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
  var out = [], i = 0;
  while (i < n.length) { var j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push(j > i ? n[i] + '–' + n[j] : String(n[i])); i = j + 1; }
  return out.join(', ');
}
function esCaja(m) { return /caja/i.test(m.nombre || ''); }

/** Lo que hace falta para dibujar. Sin mapa guardado, reparte los módulos en las paredes a ojo (aprox). */
function datosMapa(config, sectores, modulos, gente) {
  var porNumero = function (a, b) { return a.numero - b.numero; };
  var salon = (sectores || []).filter(function (s) { return s.tipo === 'salon'; }).sort(porNumero);
  var deposito = (sectores || []).filter(function (s) { return s.tipo === 'deposito'; }).sort(porNumero);
  var todos = salon.concat(deposito), sectorDe = {}, persona = {}, colorPersona = {}, color = {}, k = 0;
  todos.forEach(function (s) { sectorDe[s.id] = s; });
  (gente || []).forEach(function (p) { persona[p.id] = p; });
  todos.forEach(function (s) { if (s.responsable_id && !colorPersona[s.responsable_id]) colorPersona[s.responsable_id] = COLORES_PERSONA[k++ % COLORES_PERSONA.length]; });
  todos.forEach(function (s) { color[s.id] = colorPersona[s.responsable_id] || GRIS_SIN_RESPONSABLE; });
  var mods = (modulos || []).filter(function (m) { return m.activo !== false && sectorDe[m.sector_id]; });
  var enSalon = function (m) { return sectorDe[m.sector_id].tipo === 'salon'; };
  var pared = mods.filter(function (m) { return enSalon(m) && !m.isla; }).sort(porNumero);
  var islas = mods.filter(function (m) { return enSalon(m) && m.isla; })
    .sort(function (a, b) { return (esCaja(b) ? 1 : 0) - (esCaja(a) ? 1 : 0) || a.numero - b.numero; });
  /* El depósito, por número (desde el SQL 102 van 1, 2, 3… en todo el local); antes, uno por sector. */
  var dep = mods.filter(function (m) { return !enSalon(m); })
    .sort(function (a, b) { return a.numero - b.numero || sectorDe[a.sector_id].numero - sectorDe[b.sector_id].numero; });
  var mapa = config && config.mapa, aprox = false;
  if (!mapa) {
    /* Hasta el número más alto (si hay huecos, quedan vacíos): así el primer
       "Guardar" no apaga ninguno sin querer. */
    aprox = true;
    var n = pared.length ? Math.max.apply(null, pared.map(function (m) { return m.numero; })) : 0;
    if (n > 100) n = pared.length;
    var iz = Math.ceil(n * 0.4), fo = Math.round(n * 0.2);
    mapa = { forma: 'rectangulo', izquierda: iz, fondo: fo, derecha: Math.max(0, n - iz - fo), frente: 0 };
  }
  return { mapa: mapa, aprox: aprox, pared: pared, islas: islas, dep: dep, salon: salon, deposito: deposito,
           sectorDe: sectorDe, persona: persona, colorPersona: colorPersona, color: color, modulos: mods };
}

/** Los datos del mapa de un local (lo que deja ver la base a quien pregunta). */
function cargarMapa(localId) {
  var L = valor(localId);
  return Promise.all([
    leer('/orden_config?select=*&local_id=eq.' + L).catch(function () { return []; }),
    leer('/orden_sectores?select=id,tipo,numero,nombre,responsable_id,suplente_id&local_id=eq.' + L + '&activo=is.true&order=tipo.asc,numero.asc'),
    leer('/orden_personas?select=id,nombre,inicial,rol,aprobado,alta_propia&local_id=eq.' + L + '&activo=is.true&order=nombre.asc').catch(function () { return []; })
  ]).then(function (r) {
    var sectores = r[1] || [], config = (r[0] || [])[0];
    if (!sectores.length) return datosMapa(config, [], [], r[2]);
    return leer('/orden_modulos?select=*&activo=is.true&sector_id=in.(' + sectores.map(function (s) { return valor(s.id); }).join(',') + ')&order=numero.asc')
      .then(function (mods) { return datosMapa(config, sectores, mods, r[2]); });
  });
}

/* Una marca arriba a la derecha de un módulo: falta la foto (cámara), ya está
   (✓), hay que corregir (!), se pasó (×). */
function marcaModulo(tipo, x, y) {
  var t = 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(1.4)';
  if (tipo === 'listo') return '<g transform="' + t + '"><circle r="9" fill="#2FE38A" stroke="#111" stroke-width="1.4"/><path d="M-4 0.5l2.6 2.6L4.2-3" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>';
  if (tipo === 'corregir') return '<g transform="' + t + '"><circle r="9" fill="#FF9AA0" stroke="#111" stroke-width="1.4"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#111">!</text></g>';
  if (tipo === 'vencido') return '<g transform="' + t + '"><circle r="9" fill="#8A857C" stroke="#111" stroke-width="1.4"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#111">×</text></g>';
  return '<g transform="' + t + '"><circle r="9.5" fill="' + (tipo === 'sorpresa' ? '#F0C66A' : '#FFFFFF') + '" stroke="#111" stroke-width="1.4"/>' +
    '<rect x="-5.2" y="-3" width="10.4" height="7.2" rx="1.6" fill="#111"/><rect x="-2" y="-5" width="4" height="2.4" rx=".6" fill="#111"/><circle cy=".6" r="2.1" fill="#fff"/></g>';
}

/* Un módulo dibujado. op.resaltar: un sector; op.mios: {id: true} (lo demás
   queda apagado); op.marcas: {id: 'pendiente'|'sorpresa'|'listo'|'corregir'|'vencido'}. */
/** El nombre propio de un módulo ("Vidriera", "Estantería de remeras"), o null si es el de siempre ("Módulo 7", "Depósito 3"). */
function nombrePropio(m) {
  var n = String((m && m.nombre) || '').trim();
  return !m || m.isla || !n || /^(m[oó]dulo|dep[oó]sito)( sector)? \d+$/i.test(n) ? null : n;
}
/** "Vidriera (módulo 1)", "Módulo 7", "Caja", "Depósito 3". s: su sector (para saber si es del depósito). */
function nombreModulo(m, s) {
  if (!m) return 'Ese módulo';
  if (m.isla) return m.nombre;
  var p = nombrePropio(m);
  if (s && s.tipo === 'deposito') return p ? p + ' (depósito ' + m.numero + ')' : (m.nombre || 'Depósito ' + m.numero);
  return p ? p + ' (módulo ' + m.numero + ')' : 'Módulo ' + m.numero;
}
/** ¿El depósito ya va numerado 1, 2, 3…? (antes del SQL 102 había uno por sector, todos "1"). */
function depositoNumerado(d) {
  var vistos = {};
  return d.dep.every(function (m) { if (vistos[m.numero]) return false; vistos[m.numero] = true; return true; });
}
function recortar(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t; }

function cajaModulo(d, op, m, r, etiqueta, sub) {
  var s = d.sectorDe[m.sector_id], resp = s && d.persona[s.responsable_id];
  var apagado = (op.resaltar && m.sector_id !== op.resaltar) || (op.mios && !op.mios[m.id]);
  /* Con nombre en un módulo parado (pared de costado): el número arriba y el nombre de costado. */
  var parado = !!sub && r.h > r.w * 1.2;
  var fs = parado ? Math.max(10, Math.min(15, r.w * 0.34)) : Math.max(10, Math.min(20, r.h * (sub ? 0.3 : 0.62), r.w * (etiqueta.length > 3 ? 0.16 : 0.5)));
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  var out = '<g class="mapa-mod' + (op.marcas && op.marcas[m.id] ? ' con-marca' : '') + '" data-mod="' + esc(m.id) + '"' + (apagado ? ' opacity=".3"' : '') + '><title>' +
    esc(nombreModulo(m, s) + (resp ? ' · ' + nombreLista(resp) : ' · sin responsable')) + '</title>' +
    '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) + '" rx="7" fill="' + (d.color[m.sector_id] || GRIS_SIN_RESPONSABLE) + '" stroke="rgba(0,0,0,.35)"/>';
  if (parado) {
    var largo = Math.max(2, Math.floor((r.h - fs - 8) / 5.8));
    out += '<text x="' + cx.toFixed(1) + '" y="' + (r.y + fs + 2).toFixed(1) + '" text-anchor="middle" font-size="' + fs.toFixed(1) + '" font-weight="700" fill="#111">' + esc(etiqueta) + '</text>' +
      '<text transform="translate(' + (cx + 3.5).toFixed(1) + ',' + (r.y + fs + 4 + (r.h - fs - 4) / 2).toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="9.5" font-weight="600" fill="#111">' + esc(recortar(sub, largo)) + '</text>';
  } else {
    out += '<text x="' + cx.toFixed(1) + '" y="' + (cy + (sub ? -3 : fs * 0.36)).toFixed(1) + '" text-anchor="middle" font-size="' + fs.toFixed(1) + '" font-weight="700" fill="#111">' + esc(etiqueta) + '</text>' +
      (sub ? '<text x="' + cx.toFixed(1) + '" y="' + (cy + 13).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#111">' + esc(recortar(sub, Math.max(3, Math.floor(r.w / 6.2)))) + '</text>' : '');
  }
  /* La marca (cámara, ✓…): arriba a la derecha; en un módulo parado con nombre, al costado, del lado de adentro del local. */
  if (op.marcas && op.marcas[m.id]) {
    out += parado ? marcaModulo(op.marcas[m.id], cx < (op._mitad || 260) ? r.x + r.w + 9 : r.x - 9, cy)
                  : marcaModulo(op.marcas[m.id], r.x + r.w - 11, r.y + 11);
  }
  return out + '</g>';
}

/** El salón, en SVG. op.vacios: los lugares sin módulo, punteados. */
function svgMapa(d, op) {
  op = op || {};
  var cuadrado = (d.mapa || {}).forma === 'cuadrado';
  var W = cuadrado ? 600 : 520, H = cuadrado ? 560 : 700, M = 16, P = 50, G = 5, ABAJO = 28;
  op = Object.assign({}, op, { _mitad: W / 2 });
  var c = {};
  PAREDES.forEach(function (p) { c[p[0]] = Math.max(0, +(d.mapa || {})[p[0]] || 0); });
  var x0 = M, y0 = M, x1 = W - M, y1 = H - M - ABAJO;
  var arriba = c.fondo ? y0 + P : y0, abajo = c.frente ? y1 - P : y1;
  var lugares = [];
  function tramo(n, horiz, fijo, desde, hasta) {
    if (!n) return;
    var paso = Math.abs(hasta - desde) / n, signo = hasta >= desde ? 1 : -1;
    for (var i = 0; i < n; i++) {
      var a = desde + signo * i * paso, lo = Math.min(a, a + signo * paso) + G / 2, tam = paso - G;
      lugares.push(horiz ? { x: lo, y: fijo + G / 2, w: tam, h: P - G } : { x: fijo + G / 2, y: lo, w: P - G, h: tam });
    }
  }
  tramo(c.izquierda, false, x0, abajo, arriba);                                            // de la entrada al fondo
  tramo(c.fondo, true, y0, x0, x1);                                                         // de izquierda a derecha
  tramo(c.derecha, false, x1 - P, arriba, abajo);                                           // del fondo a la entrada
  tramo(c.frente, true, y1 - P, x1 - (c.derecha ? P : 0), x0 + (c.izquierda ? P : 0));      // de derecha a izquierda
  var out = '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor" fill-opacity=".75">▲ Entrada · vidriera</text>';
  /* Cada módulo va a su lugar por número (si uno está apagado, queda el hueco). */
  var enPared = [], sobran = [];
  d.pared.forEach(function (m) {
    var k = m.numero - 1;
    if (k >= 0 && k < lugares.length && !enPared[k]) enPared[k] = m; else sobran.push(m);
  });
  lugares.forEach(function (v, j) {
    if (enPared[j]) out += cajaModulo(d, op, enPared[j], v, String(enPared[j].numero), nombrePropio(enPared[j]));
    else if (op.vacios) out += '<rect x="' + v.x.toFixed(1) + '" y="' + v.y.toFixed(1) + '" width="' + Math.max(4, v.w).toFixed(1) + '" height="' + Math.max(4, v.h).toFixed(1) + '" rx="7" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-dasharray="4 3"/>';
  });
  /* Adentro, contra el fondo: la caja primero, después lo demás (y los de las paredes que no entraron). */
  var adentro = d.islas.concat(sobran);
  var ix0 = x0 + (c.izquierda ? P : 0) + 14, ix1 = x1 - (c.derecha ? P : 0) - 14, iy0 = arriba + 14;
  var bw = 96, bh = 38, porFila = Math.max(1, Math.floor((ix1 - ix0 + 10) / (bw + 10)));
  adentro.forEach(function (m, k) {
    var fila = Math.floor(k / porFila), col = k % porFila, enFila = Math.min(porFila, adentro.length - fila * porFila);
    var izq = ix0 + ((ix1 - ix0) - (enFila * (bw + 10) - 10)) / 2 + col * (bw + 10);
    var et = m.isla ? (m.nombre.length > 12 ? m.nombre.slice(0, 11) + '…' : m.nombre) : String(m.numero);
    out += cajaModulo(d, op, m, { x: izq, y: iy0 + fila * (bh + 10), w: bw, h: bh }, et);
  });
  return '<svg class="mapa-svg' + (cuadrado ? ' cuadrado' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="El salón, visto desde arriba">' + out + '</svg>';
}

/** El depósito: un cuadrado aparte, con cada sector y lo que tiene. */
function svgDeposito(d, op) {
  op = op || {};
  if (!d.dep.length) return '';
  /* La forma: largo (dos filas) o cuadrado. Numerado 1, 2, 3… desde el SQL 102; antes, uno por sector. */
  var n = d.dep.length, cuadrado = (d.mapa || {}).forma_deposito === 'cuadrado', numerado = depositoNumerado(d);
  var cols = cuadrado ? Math.ceil(Math.sqrt(n)) : Math.min(6, n <= 3 ? n : Math.ceil(n / 2)), filas = Math.ceil(n / cols);
  var W = 420, M = 12, T = 30, gap = 10, tw = (W - 2 * M - (cols + 1) * gap) / cols, th = cols > 4 ? 58 : 72;
  var H = T + filas * (th + gap) + gap + M;
  var out = '<text x="' + M + '" y="20" font-size="14" font-weight="700" fill="currentColor" fill-opacity=".8">Depósito</text>' +
    '<rect x="' + M + '" y="' + T + '" width="' + (W - 2 * M) + '" height="' + (H - T - M) + '" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>';
  d.dep.forEach(function (m, k) {
    var s = d.sectorDe[m.sector_id], fila = Math.floor(k / cols), col = k % cols;
    var sub = (numerado && nombrePropio(m)) || s.nombre || '';
    out += cajaModulo(d, op, m, { x: M + gap + col * (tw + gap), y: T + gap + fila * (th + gap), w: tw, h: th },
      numerado ? String(m.numero) : 'Sector ' + s.numero, sub);
  });
  return '<svg class="mapa-svg deposito" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="El depósito">' + out + '</svg>';
}

/** Quién tiene qué: una fila por persona, con su color (para mirar). */
function leyendaPersonas(d) {
  var lista = Object.keys(d.colorPersona).map(function (pid) {
    var secs = d.salon.concat(d.deposito).filter(function (s) { return s.responsable_id === pid; });
    var ids = {}; secs.forEach(function (s) { ids[s.id] = true; });
    var nums = d.pared.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.numero; });
    var islas = d.islas.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.nombre; });
    var numDep = d.dep.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.numero; });
    var cats = secs.filter(function (s) { return s.tipo === 'deposito' && s.nombre; }).map(function (s) { return s.nombre; });
    var deps = !numDep.length ? [] : depositoNumerado(d) ? ['Depósito ' + rangos(numDep) + (cats.length ? ' (' + cats.join(', ') + ')' : '')]
      : secs.filter(function (s) { return s.tipo === 'deposito'; }).map(function (s) { return 'Depósito ' + s.numero + (s.nombre ? ' (' + s.nombre + ')' : ''); });
    var cubre = secs.map(function (s) { return nombreLista(d.persona[s.suplente_id]); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var partes = (nums.length ? ['Módulos ' + rangos(nums)] : []).concat(islas.length ? [islas.join(', ')] : []).concat(deps);
    return '<div class="mapa-sec"><i style="background:' + d.colorPersona[pid] + '"></i><span><b>' + esc(nombreLista(d.persona[pid]) || 'Alguien que ya no está') + '</b><small>' +
      esc((partes.join(' · ') || 'Sin módulos') + (cubre.length ? ' · lo cubre ' + cubre.join(', ') : '')) + '</small></span></div>';
  });
  var sin = d.salon.concat(d.deposito).filter(function (s) { return !s.responsable_id; });
  var sinMods = d.modulos.filter(function (m) { return sin.some(function (s) { return s.id === m.sector_id; }); });
  if (sinMods.length) {
    lista.push('<div class="mapa-sec"><i style="background:' + GRIS_SIN_RESPONSABLE + '"></i><span><b>Sin responsable</b><small>' +
      esc(sinMods.map(function (m) { return nombreModulo(m, d.sectorDe[m.sector_id]); }).join(', ')) + '</small></span></div>');
  }
  return lista.length ? '<div class="mapa-ley">' + lista.join('') + '</div>' : '';
}

/** Cada sector, con su gente (para repartir: tocable). */
function leyendaMapa(d, tocable) {
  var tag = tocable ? 'button' : 'div';
  return '<div class="mapa-ley">' + d.salon.map(function (s) {
    var n = d.modulos.filter(function (m) { return m.sector_id === s.id; }).length;
    var resp = d.persona[s.responsable_id], sup = d.persona[s.suplente_id];
    return '<' + tag + ' class="mapa-sec" data-sector="' + esc(s.id) + '"><i style="background:' + d.color[s.id] + '"></i><span><b>' +
      esc(nombreSector(s) + ' · ' + (resp ? nombreLista(resp) : 'sin responsable')) + '</b><small>' + n + (n === 1 ? ' módulo' : ' módulos') +
      (sup ? ' · lo cubre ' + esc(nombreLista(sup)) : '') + '</small></span></' + tag + '>';
  }).join('') + '</div>';
}

/** El depósito, como la planilla: cada sector con su gente y lo que tiene. */
function listaDeposito(d, tocable) {
  if (!d.deposito.length) return '';
  var tag = tocable ? 'button' : 'div';
  return '<div class="mapa-ley">' + d.deposito.map(function (s) {
    var resp = d.persona[s.responsable_id], sup = d.persona[s.suplente_id];
    return '<' + tag + ' class="mapa-sec" data-sector="' + esc(s.id) + '"><i style="background:' + d.color[s.id] + '"></i><span><b>' +
      esc('Depósito ' + s.numero + ' · ' + (resp ? nombreLista(resp) : 'sin responsable')) + '</b><small>' + esc(s.nombre || 'Sin categoría') +
      (sup ? ' · lo cubre ' + esc(nombreLista(sup)) : '') + '</small></span></' + tag + '>';
  }).join('') + '</div>';
}

var DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
/** El día de la semana en Argentina: 1 = lunes … 7 = domingo. */
function diaSemanaAR() { var d = new Date(hoyAR() + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }
