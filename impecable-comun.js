/**
 * Equipo VDH (antes "Impecable") · lo que comparten la app (vendedores.html) y la administración
 * (impecable-admin.html): la sesión, las llamadas a la base, las fotos y los
 * formatos de fecha.
 *
 * Usa de datos.js sólo BASE, CLAVE, pedir(), funcion(), valor() y rechazo().
 * La sesión es propia (por PIN), con otra llave en el teléfono que la del
 * Panel (por mail): si compartieran el lugar, una pisaría a la otra.
 */

var NOMBRE_APP = 'Equipo VDH';
var K_VEND = 'vdh_vend_sesion';
var ZONA = 'America/Argentina/Buenos_Aires';
var BUCKET = 'orden-fotos';
/* La llave pública de las notificaciones: la misma del Club (mandar-avisos).
   No es secreta; la privada vive sólo en los Secrets de Supabase. */
var VAPID_PUBLICA = 'BCG_mGNkME20VL9WrdVAUqSnPOPdNqQOIdyDGnY3UG8WbC-CbxV87N83mGVW71SZW_wrRYXMv2ZGkEWzRGLBxoo';

var NIVEL = { impecable: 'Impecable', bien: 'Bien', a_mejorar: 'A mejorar', fuera_de_estandar: 'Fuera de estándar' };
var ROL = { vendedor: 'Vendedor', supervisor: 'Supervisor', admin: 'Administrador', gerencia: 'Gerencia', atencion: 'Atención al cliente' };
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
   derecha → frente. Los del centro (exhibidores, mesas, percheros) van en
   fila por el medio, de la caja hacia la vidriera. Locales de calle: un rectángulo largo; de shopping: más
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
  var islas = mods.filter(function (m) { return enSalon(m) && m.isla; }).sort(porNumero);
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
/** Cuántos módulos hay en las paredes según el mapa. */
function totalParedes(d) { var mm = (d && d.mapa) || {}; return PAREDES.reduce(function (s, p) { return s + Math.max(0, +mm[p[0]] || 0); }, 0); }
/** El número que se ve: los de las paredes, el suyo; los del centro, a continuación (22 en las paredes → 23, 24…). */
function numeroVista(d, m) {
  if (!m || !m.isla || !d) return m ? m.numero : null;
  var i = -1;
  (d.islas || []).forEach(function (x, k) { if (x === m || x.id === m.id) i = k; });
  return i < 0 ? null : totalParedes(d) + i + 1;
}
function nombreModulo(m, s, d) {
  if (!m) return 'Ese módulo';
  if (m.isla) { var nv = numeroVista(d, m); return m.nombre + (nv ? ' (módulo ' + nv + ')' : ''); }
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
    esc(nombreModulo(m, s, d) + (resp ? ' · ' + nombreLista(resp) : ' · sin responsable')) + '</title>' +
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

/* ════════════════════════════════════════════════════════════════════════
   EL CROQUIS (SQL 112, pedido de Mauricio: "que quede muy parecido a lo
   real"). Cada pared es una fila de lugares, en el sentido de la vuelta:
   pared izquierda (de abajo arriba) → fondo (de izquierda a derecha) → pared
   derecha (de arriba abajo) → frente (de derecha a izquierda). Un lugar es
   un módulo ('m'), un módulo doble ('d': uno solo, el doble de ancho) o algo
   que no es módulo ({ h: 'Probadores' }; sin nombre, un hueco). La puerta
   va entre dos lugares ({ pared, pos }: antes del lugar pos). El 1 es el
   primer módulo después de la puerta, siguiendo la vuelta ("desde la puerta
   hacia la izquierda"). En el salón, además, lo del centro donde está (x, y
   de 0 a 1 adentro) y las cosas fijas para ubicarse (mostrador, escalera).
   Sin croquis guardado sale de la cantidad por pared, con la puerta en la
   esquina de abajo a la izquierda: el 1 queda donde estaba siempre.
   ════════════════════════════════════════════════════════════════════════ */

var VUELTA = ['izquierda', 'fondo', 'derecha', 'frente'];
function esModuloLugar(l) { return l === 'm' || l === 'd'; }
function anchoLugar(l) { return l === 'd' ? 2 : 1; }
function repetido(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
function entre01(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; }

/** El croquis guardado, prolijo (lo raro se descarta). */
function normalizarCroquis(g) {
  var paredes = {};
  VUELTA.forEach(function (w) {
    paredes[w] = ((g.paredes || {})[w] || []).slice(0, 60).map(function (l) {
      return l === 'd' ? 'd' : (l && typeof l === 'object') ? { h: String(l.h || '').slice(0, 40) } : 'm';
    });
  });
  var pu = g.puerta && VUELTA.indexOf(g.puerta.pared) > -1
    ? { pared: g.puerta.pared, pos: Math.max(0, Math.min(paredes[g.puerta.pared].length, Math.round(+g.puerta.pos) || 0)), virtual: !!g.puerta.virtual }
    : { pared: 'frente', pos: paredes.frente.length, virtual: true };
  var centro = {};
  Object.keys(g.centro || {}).forEach(function (k) { var p = g.centro[k]; if (p) centro[String(k).toLowerCase()] = { x: entre01(p.x), y: entre01(p.y) }; });
  var fijos = (g.fijos || []).slice(0, 30).map(function (f) { return { nombre: String((f && f.nombre) || '').slice(0, 40), x: entre01(f && f.x), y: entre01(f && f.y), vertical: !!(f && f.vertical) }; });
  return { paredes: paredes, puerta: pu, centro: centro, fijos: fijos };
}

/** Cuántos módulos tiene un croquis (los dobles cuentan uno). */
function modulosDeCroquis(cq) {
  return VUELTA.reduce(function (s, w) { return s + cq.paredes[w].filter(esModuloLugar).length; }, 0);
}

/** El croquis del salón o del depósito: el guardado (si coincide con la cantidad de módulos) o el de siempre. */
function croquisDe(d, tipo) {
  var mm = (d && d.mapa) || {};
  var g = mm.croquis && mm.croquis[tipo];
  var esperado = tipo === 'deposito' ? (d.dep || []).length : totalParedes(d);
  if (g && g.paredes) {
    var cq = normalizarCroquis(g);
    /* Si alguien cambió la cantidad con una versión vieja de la administración, el croquis ya no sirve. */
    if (modulosDeCroquis(cq) === esperado) return cq;
  }
  var c = { izquierda: 0, fondo: 0, derecha: 0, frente: 0 };
  if (tipo === 'deposito') {
    var p = paredesDeposito(esperado, mm.forma_deposito === 'cuadrado');   // [arriba, derecha, abajo, izquierda]
    c = { izquierda: p[3], fondo: p[0], derecha: p[1], frente: p[2] };
  } else {
    PAREDES.forEach(function (x) { c[x[0]] = Math.max(0, +mm[x[0]] || 0); });
  }
  var paredes = {};
  VUELTA.forEach(function (w) { paredes[w] = repetido(c[w], 'm'); });
  /* La puerta de siempre (abajo a la izquierda) no se dibuja: sólo marca desde dónde se numera, hasta que la pongan donde está. */
  return { paredes: paredes, puerta: { pared: 'frente', pos: c.frente, virtual: true }, centro: {}, fijos: [] };
}

/** Los módulos de las paredes en el orden de los números: el 1 es el primero después de la puerta. */
function ordenCroquis(cq) {
  var todos = [], inicio = 0;
  VUELTA.forEach(function (w) {
    cq.paredes[w].forEach(function (l, i) {
      if (cq.puerta && w === cq.puerta.pared && i === cq.puerta.pos) inicio = todos.length;
      todos.push({ pared: w, i: i, l: l });
    });
    if (cq.puerta && w === cq.puerta.pared && cq.puerta.pos >= cq.paredes[w].length) inicio = todos.length;
  });
  return todos.slice(inicio).concat(todos.slice(0, inicio)).filter(function (x) { return esModuloLugar(x.l); });
}

function sinPuerta(cq) { return Object.assign({}, cq, { puerta: null }); }

/** Dónde va cada lugar (y la puerta) en el rectángulo x0..x1 × y0..y1, con paredes de grosor P y G de aire. */
function geometriaCroquis(cq, x0, y0, x1, y1, P, G) {
  if (cq.puerta && cq.puerta.virtual) cq = sinPuerta(cq);   // la de siempre no ocupa lugar ni se dibuja
  var u = {};
  VUELTA.forEach(function (w) {
    u[w] = cq.paredes[w].reduce(function (s, l) { return s + anchoLugar(l); }, 0) + (cq.puerta && cq.puerta.pared === w ? 1 : 0);
  });
  var arriba = u.fondo ? y0 + P : y0, abajo = u.frente ? y1 - P : y1;
  var izq = u.izquierda ? x0 + P : x0, der = u.derecha ? x1 - P : x1;
  var tramos = {
    izquierda: { horiz: false, fijo: x0, desde: abajo, hasta: arriba },
    fondo: { horiz: true, fijo: y0, desde: x0, hasta: x1 },
    derecha: { horiz: false, fijo: x1 - P, desde: arriba, hasta: abajo },
    frente: { horiz: true, fijo: y1 - P, desde: der, hasta: izq }
  };
  var lugares = {}, puerta = null;
  VUELTA.forEach(function (w) {
    lugares[w] = [];
    if (!u[w]) return;
    var t = tramos[w], paso = Math.abs(t.hasta - t.desde) / u[w], signo = t.hasta >= t.desde ? 1 : -1, k = 0;
    function caja(n) {
      var a = t.desde + signo * k * paso, b = t.desde + signo * (k + n) * paso, lo = Math.min(a, b) + G / 2, tam = n * paso - G;
      k += n;
      return t.horiz ? { x: lo, y: t.fijo + G / 2, w: tam, h: P - G } : { x: t.fijo + G / 2, y: lo, w: P - G, h: tam };
    }
    cq.paredes[w].forEach(function (l, i) {
      if (cq.puerta && cq.puerta.pared === w && cq.puerta.pos === i) puerta = { pared: w, r: caja(1) };
      lugares[w].push(caja(anchoLugar(l)));
    });
    if (cq.puerta && cq.puerta.pared === w && cq.puerta.pos >= cq.paredes[w].length) puerta = { pared: w, r: caja(1) };
  });
  return { lugares: lugares, puerta: puerta, adentro: { x0: izq, y0: arriba, x1: der, y1: abajo }, tramos: tramos, G: G };
}

/** Un lugar que no es módulo: con nombre (probadores, columna), gris; sin nombre, un hueco punteado. */
function cajaFija(r, texto, attrs) {
  var parado = r.h > r.w * 1.2, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  var out = '<g class="mapa-fijo"' + (attrs || '') + '><rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) + '" rx="7" ' +
    (texto ? 'fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-opacity=".35"' : 'fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 4"') + '/>';
  if (texto) {
    out += parado
      ? '<text transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(-90)" text-anchor="middle" dy="3.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity=".8">' + esc(recortar(texto, Math.max(3, Math.floor(r.h / 6.4)))) + '</text>'
      : '<text x="' + cx.toFixed(1) + '" y="' + (cy + 3.5).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor" fill-opacity=".8">' + esc(recortar(texto, Math.max(3, Math.floor(r.w / 6.2)))) + '</text>';
  }
  return out + '</g>';
}

/** La puerta: un lugar marcado en verde lima, con "Entrada" (o "Puerta"). */
function dibujoPuerta(p, texto, attrs) {
  var r = p.r, parado = p.pared === 'izquierda' || p.pared === 'derecha', cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return '<g class="mapa-puerta"' + (attrs || '') + '><rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) + '" rx="7" fill="#C6F432" fill-opacity=".22" stroke="#9BC21F" stroke-dasharray="5 3"/>' +
    (parado ? '<text transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(-90)" text-anchor="middle" dy="4" font-size="11" font-weight="700" fill="currentColor">' + esc(texto) + '</text>'
            : '<text x="' + cx.toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">' + esc(texto) + '</text>') + '</g>';
}

/** Dónde puede ir la puerta (para "Mover la puerta"): entre cada dos lugares y en las puntas de cada pared con lugares. */
function marcasPuerta(cq, geo, tipo) {
  var out = '';
  VUELTA.forEach(function (w) {
    var ls = geo.lugares[w];
    if (!ls.length) return;
    var t = geo.tramos[w], signo = t.hasta >= t.desde ? 1 : -1, G = geo.G;
    for (var p = 0; p <= ls.length; p++) {
      var r = ls[Math.min(p, ls.length - 1)], fin = p === ls.length, x, y;
      if (t.horiz) {
        var empieza = signo > 0 ? r.x - G / 2 : r.x + r.w + G / 2, termina = signo > 0 ? r.x + r.w + G / 2 : r.x - G / 2;
        x = fin ? termina : empieza; y = r.y + r.h / 2;
      } else {
        var empiezaY = signo > 0 ? r.y - G / 2 : r.y + r.h + G / 2, terminaY = signo > 0 ? r.y + r.h + G / 2 : r.y - G / 2;
        y = fin ? terminaY : empiezaY; x = r.x + r.w / 2;
      }
      out += '<g class="mapa-marca-puerta" data-hueco-puerta="' + tipo + ':' + w + ':' + p + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="#C6F432" stroke="#111" stroke-width="1.5"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 5).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="800" fill="#111">+</text></g>';
    }
  });
  return out;
}

/** Los lugares de las paredes: cada módulo en el suyo (por número, desde la puerta), lo que no es módulo y la
    puerta. op.vacios: los lugares sin módulo, punteados y con el número que les toca; op.editable: se tocan. */
function dibujarParedes(d, op, cq, geo, tipo, mods, etiqueta, sub) {
  var orden = ordenCroquis(cq), dueno = [], sobran = [], num = {}, out = '';
  mods.forEach(function (m) { var k = m.numero - 1; if (k >= 0 && k < orden.length && !dueno[k]) dueno[k] = m; else sobran.push(m); });
  orden.forEach(function (x, k) { num[x.pared + ':' + x.i] = k; });
  VUELTA.forEach(function (w) {
    cq.paredes[w].forEach(function (l, i) {
      var r = geo.lugares[w][i];
      if (!r) return;
      if (esModuloLugar(l)) {
        var k = num[w + ':' + i], m = dueno[k];
        if (m) out += cajaModulo(d, op, m, r, etiqueta(m), sub(m));
        else if (op.vacios) {
          out += '<g class="mapa-vacio"><rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) +
            '" rx="7" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-dasharray="4 3"/><text x="' + (r.x + r.w / 2).toFixed(1) + '" y="' + (r.y + r.h / 2 + 4).toFixed(1) +
            '" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" fill-opacity=".6">' + (k + 1) + '</text></g>';
        }
      } else out += cajaFija(r, l.h);
      if (op.editable) out += '<rect class="mapa-toque" data-lugar="' + tipo + ':' + w + ':' + i + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) + '" fill="transparent"/>';
    });
  });
  if (geo.puerta) out += dibujoPuerta(geo.puerta, tipo === 'deposito' ? 'Puerta' : 'Entrada', op.editable ? ' data-puerta="' + tipo + '"' : '');
  if (op.moverPuerta === tipo) out += marcasPuerta(cq, geo, tipo);
  return { svg: out, sobran: sobran };
}

/** Lo de adentro del salón: las cosas fijas (para ubicarse) y los módulos del centro, cada uno donde lo
    pusieron; los que todavía no tienen lugar, en fila por el medio (de la caja hacia la vidriera). */
function dibujarCentro(d, op, cq, geo, sobran) {
  var a = geo.adentro, mx = 14, out = '';
  var ax0 = a.x0 + mx, ay0 = a.y0 + mx, aw = Math.max(40, a.x1 - a.x0 - 2 * mx), ah = Math.max(40, a.y1 - a.y0 - 2 * mx);
  (cq.fijos || []).forEach(function (f, k) {
    var w = f.vertical ? 34 : 110, h = f.vertical ? 110 : 34, cx = ax0 + f.x * aw, cy = ay0 + f.y * ah;
    out += cajaFija({ x: cx - w / 2, y: cy - h / 2, w: w, h: h }, f.nombre || 'Fijo', op.editable ? ' data-fijo="' + k + '"' : '');
  });
  var libres = [];
  function toque(m, r) {
    return op.editable && m.isla ? '<rect class="mapa-toque arrastrable" data-centro="' + esc(String(m.nombre || '').toLowerCase()) + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) +
      '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) + '" fill="transparent"/>' : '';
  }
  d.islas.forEach(function (m) {
    var pos = (cq.centro || {})[String(m.nombre || '').toLowerCase()];
    if (!pos) { libres.push(m); return; }
    var cx = ax0 + pos.x * aw, cy = ay0 + pos.y * ah, r = { x: cx - 23, y: cy - 35, w: 46, h: 70 };
    out += cajaModulo(d, op, m, r, String(numeroVista(d, m) || ''), m.nombre) + toque(m, r);
  });
  var fila = libres.concat(sobran);
  if (fila.length) {
    var iy0 = a.y0 + 14, iy1 = a.y1 - 14, paso = Math.max(20, (iy1 - iy0) / fila.length);
    var alto = Math.max(16, Math.min(paso - 14, 96)), ancho = Math.min(46, alto / 1.35), medio = (a.x0 + a.x1) / 2;
    fila.forEach(function (m, k) {
      var r = { x: medio - ancho / 2, y: iy0 + k * paso + (paso - alto) / 2, w: ancho, h: alto };
      out += (m.isla ? cajaModulo(d, op, m, r, String(numeroVista(d, m) || ''), m.nombre) : cajaModulo(d, op, m, r, String(m.numero))) + toque(m, r);
    });
  }
  return { svg: out, caja: [ax0, ay0, aw, ah] };
}

/** El salón, en SVG. op.vacios, op.editable, op.croquis (el que se está armando), op.moverPuerta ('salon'). */
function svgMapa(d, op) {
  op = op || {};
  var cuadrado = (d.mapa || {}).forma === 'cuadrado';
  var W = cuadrado ? 600 : 520, H = cuadrado ? 560 : 700, M = 16, P = 50, G = 5, ABAJO = 28;
  op = Object.assign({}, op, { _mitad: W / 2 });
  var cq = op.croquis ? op.croquis.salon : croquisDe(d, 'salon');
  var x0 = M, y0 = M, x1 = W - M, y1 = H - M - ABAJO;
  var geo = geometriaCroquis(op.moverPuerta === 'salon' ? sinPuerta(cq) : cq, x0, y0, x1, y1, P, G);
  var out = '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor" fill-opacity=".75">Frente · vidriera</text>';
  var p = dibujarParedes(d, op, cq, geo, 'salon', d.pared, function (m) { return String(m.numero); }, nombrePropio);
  var c = dibujarCentro(d, op, cq, geo, p.sobran);
  return '<svg class="mapa-svg' + (cuadrado ? ' cuadrado' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" data-adentro="' + c.caja.map(function (v) { return v.toFixed(1); }).join(' ') +
    '" role="img" aria-label="El salón, visto desde arriba">' + out + c.svg + p.svg + '</svg>';
}

/** Cuántos módulos del depósito van en cada pared: [arriba, derecha, abajo, izquierda]. Siempre alrededor:
    en el cuadrado, parejo (7 → 2, 2, 1, 2); en el largo, más arriba y abajo (7 → 3, 1, 2, 1). */
function paredesDeposito(n, cuadrado) {
  if (cuadrado) {
    var q = Math.floor(n / 4), r = n % 4;
    return [q + (r >= 1 ? 1 : 0), q + (r === 3 ? 1 : 0), q + (r === 2 ? 1 : 0), q + (r === 3 ? 1 : 0)];
  }
  var lado = n >= 5 ? Math.max(1, Math.round(n / 6)) : 0, resto = n - 2 * lado;
  return [Math.ceil(resto / 2), lado, Math.floor(resto / 2), lado];
}

/** El depósito: aparte, con los módulos alrededor, contra las paredes, y el medio libre. Se numeran desde la
    puerta, hacia la izquierda, dando la vuelta (como el salón). */
function svgDeposito(d, op) {
  op = op || {};
  var cq = op.croquis ? op.croquis.deposito : croquisDe(d, 'deposito');
  if (!d.dep.length && !modulosDeCroquis(cq)) return '';
  /* La forma: largo o cuadrado. Numerado 1, 2, 3… desde el SQL 102; antes, uno por sector. */
  var cuadrado = (d.mapa || {}).forma_deposito === 'cuadrado', numerado = depositoNumerado(d);
  var W = 420, M = 12, T = 30, P = 64, G = 6, alto = cuadrado ? W - 2 * M : 250, H = T + alto + M;
  op = Object.assign({}, op, { _mitad: W / 2 });
  var x0 = M, y0 = T, x1 = W - M, y1 = T + alto;
  var geo = geometriaCroquis(op.moverPuerta === 'deposito' ? sinPuerta(cq) : cq, x0, y0, x1, y1, P, G);
  var out = '<text x="' + M + '" y="20" font-size="14" font-weight="700" fill="currentColor" fill-opacity=".8">Depósito</text>' +
    '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + alto + '" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>';
  var mods = numerado ? d.dep : d.dep.map(function (m, i) { return Object.assign({}, m, { numero: i + 1 }); });
  var p = dibujarParedes(d, op, cq, geo, 'deposito', mods,
    function (m) { return numerado ? String(m.numero) : 'Sector ' + d.sectorDe[m.sector_id].numero; },
    function (m) { var s = d.sectorDe[m.sector_id]; return (numerado && nombrePropio(m)) || (s && s.nombre) || ''; });
  return '<svg class="mapa-svg deposito" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="El depósito">' + out + p.svg + '</svg>';
}

/** Los módulos con nombre, enteros: en las paredes de costado se ven cortados ("Vidri…"). */
function leyendaNombres(d) {
  var con = d.pared.concat(d.islas, d.dep).filter(function (m) { return m.isla || nombrePropio(m); });
  if (!con.length) return '';
  return '<p class="mapa-nombres"><b>Con nombre:</b> ' + con.map(function (m) {
    var s = d.sectorDe[m.sector_id];
    return esc((s && s.tipo === 'deposito' ? 'Depósito ' : '') + numeroVista(d, m) + ' · ' + (m.isla ? m.nombre : nombrePropio(m)));
  }).join(' — ') + '</p>';
}

/** Quién tiene qué: una fila por persona, con su color (para mirar). */
function leyendaPersonas(d) {
  var lista = Object.keys(d.colorPersona).map(function (pid) {
    var secs = d.salon.concat(d.deposito).filter(function (s) { return s.responsable_id === pid; });
    var ids = {}; secs.forEach(function (s) { ids[s.id] = true; });
    var nums = d.pared.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.numero; })
      .concat(d.islas.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return numeroVista(d, m); }));
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
      esc(sinMods.map(function (m) { return nombreModulo(m, d.sectorDe[m.sector_id], d); }).join(', ')) + '</small></span></div>');
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
