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
var SIN_LOCAL = 'Supervisores y administración';   // los que no son de un local (SQL 120: también los supervisores)

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
 *
 * tope (ms, opcional): si no contesta en ese tiempo se corta, y queda como
 * "sin señal" (con señal floja el pedido podía no volver nunca).
 */
function llamar(nombre, args, tope) {
  var corte = tope && window.AbortController ? new AbortController() : null;
  var reloj = corte ? setTimeout(function () { corte.abort(); }, tope) : 0;
  return tokenVend().then(function (t) {
    return fetch(BASE + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
      signal: corte ? corte.signal : undefined
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
  }).then(function (v) { clearTimeout(reloj); return v; }, function (e) { clearTimeout(reloj); throw e; });
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

/* ════════════════════════════════════════════════════════════════════════
   LAS MARCAS EN LA FOTO (SQL 150, pedido de Mauricio el 21/10): al revisar,
   círculos rojos con número donde está lo que hay que corregir ("a esta
   parte le falta una camisa"). Se guardan como [{x, y}] de 0 a 1 sobre la
   foto, numeradas en ese orden. La caja mide lo mismo que la foto: así una
   marca cae en el mismo lugar en el celular y en la compu.
   ════════════════════════════════════════════════════════════════════════ */
var MAX_MARCAS = 9;

/** La foto con sus marcas. op: { editable, etiqueta ("Antes", "Ahora"), clase, alt }. */
function fotoConMarcas(ruta, marcas, op) {
  op = op || {};
  return '<div class="foto-marcas' + (op.editable ? ' editable' : '') + (op.clase ? ' ' + op.clase : '') + '">' +
    '<div class="fm-caja"><img data-foto="' + esc(ruta) + '" alt="' + esc(op.alt || 'La foto') + '">' +
    '<div class="fm-capa">' + dibujoMarcas(marcas) + '</div></div>' +
    (op.etiqueta ? '<span class="fm-etiqueta">' + esc(op.etiqueta) + '</span>' : '') + '</div>';
}

function dibujoMarcas(marcas) {
  return (marcas || []).map(function (m, i) {
    return '<span class="fm-marca" data-i="' + i + '" style="left:' + (Number(m.x) * 100).toFixed(2) + '%;top:' + (Number(m.y) * 100).toFixed(2) + '%">' + (i + 1) + '</span>';
  }).join('');
}

/** Hace editable la foto de `cont` (un .foto-marcas): tocar la foto agrega una marca y tocar una marca la saca.
    Devuelve { marcas() } con la lista (null sin marcas), lista para mandar a la base. */
function marcarEnFoto(cont, inicial) {
  var lista = (inicial || []).slice(0, MAX_MARCAS).map(function (m) { return { x: Number(m.x), y: Number(m.y) }; });
  var caja = cont.querySelector('.fm-caja'), capa = cont.querySelector('.fm-capa');
  cont.classList.add('editable');
  var pintar = function () { capa.innerHTML = dibujoMarcas(lista); };
  caja.onclick = function (e) {
    var marca = e.target.closest('.fm-marca');
    if (marca) { lista.splice(+marca.dataset.i, 1); pintar(); return; }
    var img = caja.querySelector('img'), r = img.getBoundingClientRect();
    if (!img.naturalWidth || !r.width || !r.height) return;   // todavía no cargó
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (lista.length >= MAX_MARCAS) { avisar('Como mucho ' + MAX_MARCAS + ' marcas por foto.'); return; }
    lista.push({ x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 });
    pintar();
  };
  pintar();
  return { marcas: function () { return lista.length ? lista.map(function (m) { return { x: m.x, y: m.y }; }) : null; } };
}

/** Revisar la foto de un control (la app y la compu). Lo nuevo del SQL 150 (pedir la corrección con "Bien" o
    "Impecable", las marcas) va sólo si se usa: sin eso, el pedido es el de siempre y anda con la base de antes. */
function revisarControl(c, nivel, comentario, corregir, marcas) {
  var args = { p_control: c.id, p_nivel: nivel, p_comentario: comentario || null, p_foto: c.ultimo_intento_id || null };
  if (corregir && nivel !== 'a_mejorar' && nivel !== 'fuera_de_estandar') args.p_corregir = true;
  if (marcas && marcas.length) args.p_marcas = marcas;
  return llamar('orden_revisar_control', args).catch(function (e) { throw falta150(e); });
}

/** Mirar la foto de una tarea hecha: "Quedó bien" o "Pedir otra corrección" (con marcas, SQL 150). */
function revisarTarea(t, bien, mensaje, marcas) {
  var args = { p_tarea: t.id, p_bien: bien, p_mensaje: mensaje || null };
  if (marcas && marcas.length) args.p_marcas = marcas;
  return llamar('orden_tarea_revisar', args).catch(function (e) { throw falta150(e); });
}

function falta150(e) {
  return /schema cache|Could not find the function/i.test(mensajeDe(e)) ? rechazo('Falta actualizar el sistema para pedir correcciones y marcar la foto (SQL 150).') : e;
}

/** Lee con las columnas del SQL 150; si la base todavía no las tiene, sin ellas (así nada se rompe en el medio). */
function leer150(ruta, nuevas) {
  return leer(ruta.replace('select=', 'select=' + nuevas + ',')).catch(function (e) {
    if (!e || e.sinSesion || esDeRed(e)) throw e;   // sin señal o sin sesión: no es por las columnas
    return leer(ruta);
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
/** La vidriera es de todos (SQL 145: cualquiera le saca foto, cuando quiera): su propio color, blanco cálido. */
var COLOR_VIDRIERA = '#F1ECDF';
var PAREDES = [['izquierda', 'Pared izquierda'], ['fondo', 'Fondo'], ['derecha', 'Pared derecha'], ['frente', 'Frente']];

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
/** Qué hay en el módulo ("Remeras", "Buzos de algodón"), aparte de su nombre (SQL 114), o null. */
function queHay(m) { var v = String((m && m.contenido) || '').trim(); return v || null; }
/** "Vidriera (módulo 1)", "Módulo 7", "Caja", "Depósito 3". s: su sector (para saber si es del depósito). */
/** Cuántos módulos hay en las paredes según el mapa. */
function totalParedes(d) { var mm = (d && d.mapa) || {}; return PAREDES.reduce(function (s, p) { return s + Math.max(0, +mm[p[0]] || 0); }, 0); }
/** El número que se ve: los de las paredes, el suyo; los del centro, a continuación (22 en las paredes → 23, 24…). */
function numeroVista(d, m) {
  if (!m || !m.isla || !d) return m ? m.numero : null;
  if (esVidriera(m)) return null;
  var i = -1, k = 0;
  (d.islas || []).forEach(function (x) { if (esVidriera(x)) return; if (x === m || x.id === m.id) i = k; k++; });
  return i < 0 ? null : totalParedes(d) + i + 1;
}
/** La vidriera: un módulo del centro que se llama "Vidriera", "Vidriera izq." o "Vidriera der." (va contra el vidrio, sin número). */
var NOMBRES_VIDRIERA = { 1: ['Vidriera'], 2: ['Vidriera izq.', 'Vidriera der.'] };
function esNombreVidriera(n) { return /^vidriera( izq\.| der\.)?$/i.test(String(n || '').trim()); }
function esVidriera(m) { return !!m && !!m.isla && esNombreVidriera(m.nombre); }
/** "1–3, 5, Vidriera izq.": los números en rangos y después los nombres. */
/** Los que comparten la vidriera: los que tienen sectores del salón, en su orden ("Lautaro G., Seba y Nano"). */
function turnoVidrieraTexto(d) {
  var vistos = {}, nombres = [];
  (d.salon || []).forEach(function (s) {
    if (!s.responsable_id || vistos[s.responsable_id]) return;
    vistos[s.responsable_id] = true;
    nombres.push(nombreLista(d.persona[s.responsable_id]) || 'Alguien');
  });
  return nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : nombres.join('') || 'Nadie todavía';
}
function rangosMixtos(l) {
  var nums = l.filter(function (x) { return typeof x === 'number'; }), otros = l.filter(function (x) { return x && typeof x !== 'number'; });
  return [nums.length ? rangos(nums) : ''].concat(otros).filter(Boolean).join(', ');
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

/* ════════════════════════════════════════════════════════════════════════
   EL CROQUIS COMO UNA FOTO (14/10/2026, pedido de Mauricio): "más parecido
   a la foto" de Pinterest (el local visto desde arriba, con los probadores,
   la puerta, la galería enfrente), "algo bien tecnológico donde se vea el
   color de cada módulo, como si fuera un neón", y "si pongo buzos, que
   aparezcan unos buzitos". El mismo dibujo en el mapa de siempre (SVG) y en
   el modo observador (la tapa de cada mueble): piso de cerámica, paredes
   oscuras, vidriera de vidrio, muebles de nogal con la ropa de lo que dice
   "qué hay", y el color de quien tiene cada módulo en una luz de neón al pie.
   ════════════════════════════════════════════════════════════════════════ */

function n1(v) { return (+v || 0).toFixed(1); }
function rectSvg(x, y, w, h, rx, resto) {
  return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(Math.max(0, w)) + '" height="' + n1(Math.max(0, h)) + '"' + (rx ? ' rx="' + n1(rx) + '"' : '') + (resto ? ' ' + resto : '') + '/>';
}
function semillaDe(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function esClaro(hex) { var n = parseInt(String(hex || '#000').slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; }

/* ── La ropa ── */

/* Azul francia, blanco, terracota, mostaza, verde, bordó, marino, celeste, camel y violeta. */
var ROPA_COLORES = ['#2F5BB7', '#F3F0EA', '#C9573A', '#E0A93B', '#2E7D5B', '#8C2F45', '#1F2738', '#86B4DA', '#BF8F5F', '#5B4B9A'];
var ROPA_TONOS = {
  jean: ['#2E4A78', '#3C64A0', '#1F3354', '#5A7EB0', '#27406A'],
  pantalon: ['#2B2F36', '#C2A27A', '#5B6B4E', '#1F2738', '#8A6E52', '#6B6F78'],
  bermuda: ['#C2A27A', '#5B6B4E', '#2E4A78', '#1F2738', '#86B4DA', '#BF8F5F'],
  zapatilla: ['#F3F0EA', '#1F2738', '#E8E4DC', '#C9573A', '#2F5BB7'],
  medias: ['#F3F0EA', '#1F2738', '#9AA0A6', '#C9573A']
};
/** Qué prendas dice un texto ("Remeras y buzos" → remera, buzo), en el orden en que aparecen; como mucho 3. */
var PRENDAS = [
  ['remera', /camiseta|remer|t-?shirt|playera/], ['musculosa', /musculos|\btops?\b|\bbod(y|ies)\b/], ['buzo', /buzo|hoodie|canguro|frisa|poler[oó]n/],
  ['sweater', /sweater|su[eé]ter|pullover|tejid|cardig|polar/], ['campera', /camper|parka|rompeviento|chaleco|abrigo|tapado|\bsaco/],
  ['camisa', /camisa|chomba|\bpolo/], ['jean', /jean|denim/], ['bermuda', /bermud|short|\bmallas?\b/], ['pantalon', /pantal|jogger|jogging|cargo|chino|\bcalzas?\b|pijama/],
  ['vestido', /vestid|enterit/], ['pollera', /poller|falda/], ['zapatilla', /zapatill|calzado|zapato|\bbota|ojota|sandalia/],
  ['gorra', /gorr|sombrer|piluso/], ['medias', /\bmedias\b|soquete/], ['accesorio', /accesori|cintur|billeter|mochil|bolso|carter|lentes|anteojo|bijou|ri[ñn]oner/]
];
function prendasDe(texto) {
  var t = String(texto || '').toLowerCase(), hallado = [];
  PRENDAS.forEach(function (p) { var i = t.search(p[1]); if (i > -1) hallado.push([i, p[0]]); });
  return hallado.sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }).slice(0, 3);
}
/* Cada prenda de frente, en una caja de 20 × 20: [la silueta, los detalles (costuras, cierre, bolsillo)]. */
var DIBUJO_PRENDA = {
  remera: ['M7 2.6Q10 5.2 13 2.6L18.6 5.6 16.7 9.8 14.7 9V18H5.3V9L3.3 9.8 1.4 5.6Z', 'M7.6 3Q10 5.4 12.4 3'],
  musculosa: ['M6.6 2H8.2Q10 6.4 11.8 2H13.4L13.8 6.6Q15.4 8.6 15.2 11V18H4.8V11Q4.6 8.6 6.2 6.6Z', ''],
  buzo: ['M7.1 3.3Q10 .3 12.9 3.3L16.9 5.1Q18 6.1 18.4 8.1L19.4 16.7 16.8 17.1 15.2 9.9V18.4H4.8V9.9L3.2 17.1.6 16.7 1.6 8.1Q2 6.1 3.1 5.1Z', 'M8.1 4.5Q10 6.7 11.9 4.5M6.6 12.8H13.4L14 16.2H6Z'],
  sweater: ['M7.4 2.7Q10 4.7 12.6 2.7L16.9 4.6Q18 5.6 18.4 7.6L19.4 16.7 16.8 17.1 15.2 9.7V18.4H4.8V9.7L3.2 17.1.6 16.7 1.6 7.6Q2 5.6 3.1 4.6Z', 'M4.8 16.7H15.2M7.9 3.1Q10 5.2 12.1 3.1'],
  campera: ['M7 2.4 10 4.3 13 2.4 17.1 4.4Q18.2 5.4 18.6 7.6L19.4 16.9 16.8 17.3 15.4 10V18.7H4.6V10L3.2 17.3.6 16.9 1.4 7.6Q1.8 5.4 2.9 4.4Z', 'M10 4.3V18.7M4.6 9.4H15.4M4.6 12.5H15.4M4.6 15.6H15.4'],
  camisa: ['M7.3 2.5 10 3.6 12.7 2.5 16.9 4.5Q18 5.5 18.4 7.5L19.4 16.7 16.8 17.1 15.2 9.6V18.5H4.8V9.6L3.2 17.1.6 16.7 1.6 7.5Q2 5.5 3.1 4.5Z', 'M7.3 2.5 10 6.4 12.7 2.5M10 6.4V18.5'],
  jean: ['M4.6 1.6H15.4L16.4 18.6H11.2L10 7.6 8.8 18.6H3.6Z', 'M4.6 3.8H15.4M10 3.8V7.6M6.2 3.8Q6.4 6 8.4 6.2M13.8 3.8Q13.6 6 11.6 6.2'],
  pantalon: ['M4.6 1.6H15.4L16.4 18.6H11.2L10 7.6 8.8 18.6H3.6Z', 'M4.6 3.8H15.4M10 3.8V7.6'],
  bermuda: ['M3.8 3.4H16.2L17.4 14.2H11L10 8.2 9 14.2H2.6Z', 'M3.8 5.6H16.2M10 5.6V8.2'],
  vestido: ['M7.2 1.6H8.4L8.8 4.6H11.2L11.6 1.6H12.8L13.4 6.4Q12.4 7.6 12.6 9.2L16.6 18.6H3.4L7.4 9.2Q7.6 7.6 6.6 6.4Z', 'M7.4 9.2H12.6'],
  pollera: ['M6 3.6H14L17.4 17.2Q10 19 2.6 17.2Z', 'M6 5.4H14M8 5.4 6.8 17.6M12 5.4 13.2 17.6'],
  zapatilla: ['M1.4 13.6Q1.2 8.4 4 8L7.6 9.2 11.2 6.2Q13 5.8 13.8 7.4L18 10.2Q19 11 18.8 12.4L18.6 13.6Z', 'M1.6 15.2H18.4M8.8 9.6 10.3 8.4M10.4 10.6 11.9 9.4'],
  gorra: ['M3 13.2Q2.8 5.4 10 5.2Q15.6 5.2 16 11.2L19.2 12.6Q19.4 14 17.4 14H3Z', 'M9.2 5.4 10.8 5.4M10 5.4Q8.6 9 9 14'],
  medias: ['M7 1.6H12.4V11L16.6 14.4Q18 16.2 16.4 17.8Q15 18.8 13.6 17.6L7.6 13Q7 12.4 7 11.4Z', 'M7 4H12.4'],
  accesorio: ['M3.6 8H16.4L17.4 18.4H2.6Z', 'M7 8Q7 3.2 10 3.2Q13 3.2 13 8M3.2 11.6H16.8']
};
/** Las siluetas como símbolos (una vez por dibujo): cada prenda es un <use> con su color. */
function simbolosPrendas(pref) {
  return Object.keys(DIBUJO_PRENDA).map(function (k) {
    var d = DIBUJO_PRENDA[k];
    return '<symbol id="' + pref + '-' + k + '" viewBox="0 0 20 20" overflow="visible"><path d="' + d[0] + '" stroke="rgba(0,0,0,.55)" stroke-width="1" stroke-linejoin="round"/>' +
      (d[1] ? '<path d="' + d[1] + '" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' : '') + '</symbol>';
  }).join('');
}
/** La ropa de un mueble, de frente y en filas (como exhibida): r es el lugar, tipos lo de prendasDe. */
function svgPrendas(r, tipos, sem, pref) {
  var p = 2, w = r.w - 2 * p, h = r.h - 2 * p;
  if (w < 8 || h < 8 || !tipos.length) return '';
  var s = Math.max(9, Math.min(19, Math.min(w, h) * 0.46));
  var cols = Math.max(1, Math.floor(w / (s * 1.04))), filas = Math.max(1, Math.floor(h / (s * 1.04)));
  var gx = (w - cols * s) / (cols + 1), gy = (h - filas * s) / (filas + 1), out = '', k = 0;
  sem = sem >>> 0;
  for (var f = 0; f < filas; f++) {
    for (var c = 0; c < cols; c++) {
      var tipo = tipos[k % tipos.length], tonos = ROPA_TONOS[tipo] || ROPA_COLORES;
      var col = tonos[(sem + Math.floor(k / 2) * 3 + f) % tonos.length];
      out += '<use href="#' + pref + '-' + tipo + '" x="' + n1(r.x + p + gx + c * (s + gx)) + '" y="' + n1(r.y + p + gy + f * (s + gy)) + '" width="' + n1(s) + '" height="' + n1(s) +
        '" fill="' + col + '" color="' + (esClaro(col) ? 'rgba(0,0,0,.38)' : 'rgba(255,255,255,.5)') + '"/>';
      k++;
    }
  }
  return out;
}
/** Ropa colgada de un caño, vista desde arriba (cuando no dice qué hay): tandas del mismo color. */
function svgColgada(r, sem) {
  var horiz = r.w >= r.h, L = horiz ? r.w : r.h, F = horiz ? r.h : r.w, x = 2, i = 0, out = '';
  sem = sem >>> 0;
  out += horiz ? rectSvg(r.x + 1, r.y + r.h / 2 - 0.6, r.w - 2, 1.2, 0, 'fill="#A9AEB4"') : rectSvg(r.x + r.w / 2 - 0.6, r.y + 1, 1.2, r.h - 2, 0, 'fill="#A9AEB4"');
  while (x < L - 4.5) {
    var col = ROPA_COLORES[(sem + Math.floor(i / 3) * 7) % ROPA_COLORES.length], largo = F * (0.66 + ((sem >> (i % 13)) & 3) * 0.07), a = (F - largo) / 2;
    out += horiz ? rectSvg(r.x + x, r.y + a, 3.1, largo, 1.3, 'fill="' + col + '" stroke="rgba(0,0,0,.35)" stroke-width=".4"')
                 : rectSvg(r.x + a, r.y + x, largo, 3.1, 1.3, 'fill="' + col + '" stroke="rgba(0,0,0,.35)" stroke-width=".4"');
    x += 4.1; i++;
  }
  return out;
}
/** Cajas de cartón en estantes (el depósito). */
function svgCajas(r, sem) {
  var cols = Math.max(1, Math.floor((r.w - 2) / 15)), filas = Math.max(1, Math.floor((r.h - 2) / 13)), out = '';
  var bw = (r.w - 2) / cols, bh = (r.h - 2) / filas, tonos = ['#B98E5E', '#A87E52', '#C7A274', '#9C7449'];
  sem = sem >>> 0;
  for (var f = 0; f < filas; f++) {
    for (var c = 0; c < cols; c++) {
      var x = r.x + 1 + c * bw, y = r.y + 1 + f * bh;
      out += rectSvg(x + 0.8, y + 0.8, bw - 1.6, bh - 1.6, 1, 'fill="' + tonos[(sem + c * 3 + f) % 4] + '" stroke="rgba(60,40,20,.5)" stroke-width=".5"') +
        rectSvg(x + bw / 2 - 0.7, y + 0.8, 1.4, bh - 1.6, 0, 'fill="rgba(255,240,215,.45)"');
    }
  }
  return out;
}

/* ── Las piezas (lo que no es un módulo: no lleva foto, está para ubicarse) ── */

/** Su nombre y su tamaño en el plano del salón (de 520 de ancho; un módulo de pared mide unos 45 × 65). */
var PIEZAS = {
  probador: { nombre: 'Probadores', w: 78, h: 64 },
  caja: { nombre: 'Caja', w: 108, h: 40 },
  mesa: { nombre: 'Mesa', w: 96, h: 50 },
  mesalisa: { nombre: 'Mesa lisa', w: 84, h: 44 },
  perchero: { nombre: 'Perchero', w: 104, h: 34 },
  maniqui: { nombre: 'Maniquí', w: 40, h: 40 },
  planta: { nombre: 'Planta', w: 40, h: 40 },
  columna: { nombre: 'Columna', w: 30, h: 30 },
  escalera: { nombre: 'Escalera', w: 112, h: 46 },
  espejo: { nombre: 'Espejo', w: 72, h: 12 },
  banco: { nombre: 'Banco', w: 72, h: 28 },
  deposito: { nombre: 'Puerta del depósito', corto: 'Depósito', w: 60, h: 46 },
  otro: { nombre: 'Otra cosa', w: 110, h: 34 }
};
/** Las de adentro (en este orden en el editor) y las que van en un lugar de una pared. */
var PIEZAS_ADENTRO = ['probador', 'caja', 'mesa', 'mesalisa', 'perchero', 'maniqui', 'planta', 'columna', 'escalera', 'espejo', 'banco', 'otro'];
var PIEZAS_PARED = ['probador', 'deposito', 'columna', 'escalera', 'espejo'];
var PIEZAS_DEPOSITO = ['mesa', 'mesalisa', 'perchero', 'columna', 'escalera', 'banco', 'otro'];
function piezaValida(k) { return Object.prototype.hasOwnProperty.call(PIEZAS, k) ? k : null; }
/** El tipo por el nombre (las de antes no tenían tipo: "Mostrador" es la caja). */
function tipoPieza(texto) {
  var t = String(texto || '').toLowerCase();
  if (/probador/.test(t)) return 'probador';
  if (/dep[oó]sito/.test(t)) return 'deposito';
  if (/m[oó]dulo/.test(t)) return 'otro';
  if (/mostrador|\bcaja/.test(t)) return 'caja';
  if (/perch/.test(t)) return 'perchero';
  if (/maniq/.test(t)) return 'maniqui';
  if (/planta|maceta/.test(t)) return 'planta';
  if (/columna/.test(t)) return 'columna';
  if (/escaler/.test(t)) return 'escalera';
  if (/espejo/.test(t)) return 'espejo';
  if (/banco|sill[oó]n|puff|asiento/.test(t)) return 'banco';
  if (/mesa lisa|mesa para (doblar|ordenar)/.test(t)) return 'mesalisa';
  if (/mesa|exhibidor/.test(t)) return 'mesa';
  return 'otro';
}
function tamanoPieza(tipo, vertical) { var p = PIEZAS[tipo] || PIEZAS.otro; return vertical ? { w: p.h, h: p.w } : { w: p.w, h: p.h }; }

/** El marco de una pieza que tiene un frente (el lado que da al salón: 's', 'n', 'e' u 'o'): se dibuja como si el
    frente estuviera abajo (L de largo, F de fondo) y se gira. */
function marcoPieza(r, frente) {
  if (frente === 'e') return { L: r.h, F: r.w, t: 'translate(' + n1(r.x) + ',' + n1(r.y + r.h) + ') rotate(-90)' };
  if (frente === 'o') return { L: r.h, F: r.w, t: 'translate(' + n1(r.x + r.w) + ',' + n1(r.y) + ') rotate(90)' };
  if (frente === 'n') return { L: r.w, F: r.h, t: 'translate(' + n1(r.x + r.w) + ',' + n1(r.y + r.h) + ') rotate(180)' };
  return { L: r.w, F: r.h, t: 'translate(' + n1(r.x) + ',' + n1(r.y) + ')' };
}
/** Hacia dónde mira una pieza de adentro: la larga, hacia el medio del local (de frente o de espaldas); la parada, hacia el costado del medio. */
function frenteAdentro(r, caja) {
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2, mx = caja.x + caja.w / 2, my = caja.y + caja.h / 2;
  if (r.w >= r.h) return cy <= my ? 's' : 'n';
  return cx <= mx ? 'e' : 'o';
}
var FRENTE_PARED = { izquierda: 'e', derecha: 'o', fondo: 's', frente: 'n' };

/** Un nombre chiquito sobre una pieza (derecho, o de costado si la pieza es angosta y alta). */
function nombrePieza(r, texto, oscuro) {
  if (!texto) return '';
  var parado = r.h > r.w, largo = (parado ? r.h : r.w) - 6, fs = 9.5, t = String(texto);
  while (fs > 7 && t.length * fs * 0.6 + 10 > largo) fs -= 0.5;
  if (t.length * fs * 0.6 + 10 > largo) t = recortar(texto, Math.max(3, Math.floor((largo - 10) / (fs * 0.6))));
  var ancho = Math.min(largo, t.length * fs * 0.6 + 10), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return '<g class="mapa-pieza-nombre" transform="translate(' + n1(cx) + ',' + n1(cy) + ')' + (parado ? ' rotate(-90)' : '') + '" pointer-events="none">' +
    '<rect x="' + n1(-ancho / 2) + '" y="-7" width="' + n1(ancho) + '" height="14" rx="7" fill="' + (oscuro ? 'rgba(14,17,22,.82)' : 'rgba(255,255,255,.85)') + '"/>' +
    '<text y="3.3" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="' + (oscuro ? '#F4F5F7' : '#2A2522') + '">' + esc(t) + '</text></g>';
}

/** Una pieza dibujada. r: su lugar; frente: hacia dónde da (ver marcoPieza); texto: su nombre (se ve si no es el de
    siempre, o si la pieza no se reconoce sola); attrs: para tocarla en el editor. op.sinNombre: sin el nombre (el
    modo observador lo pone parado). */
function dibujoPieza(tipo, r, texto, frente, attrs, op) {
  op = op || {};
  tipo = piezaValida(tipo) || 'otro';
  var m = marcoPieza(r, frente || 's'), L = m.L, F = m.F, g = '', sem = semillaDe(tipo + r.x + r.y), i;
  var nombre = String(texto || '').trim(), propio = nombre && nombre.toLowerCase() !== PIEZAS[tipo].nombre.toLowerCase();
  var conNombre = !op.sinNombre && (propio || tipo === 'probador' || tipo === 'caja' || tipo === 'escalera' || tipo === 'deposito' || tipo === 'otro');
  if (CROQUIS_IMG && IMAGEN_PIEZA[tipo]) {
    /* Cada imagen de los probadores son dos: una cada dos veces su fondo (un lugar de pared, una; una pared de 3 lugares, tres). */
    var cuantas = tipo === 'probador' ? Math.max(1, Math.round(L / (F * 2))) : 1, lista = [];
    for (i = 0; i < cuantas; i++) lista.push(IMAGEN_PIEZA[tipo]);
    g = imagenesCroquis(lista, r, frente || 's', tipo === 'probador', 0);
  } else if (tipo === 'probador') {
    var n = Math.max(1, Math.round(L / 58)), paso = L / n;
    g += rectSvg(0, 0, L, F, 2, 'fill="#CDB797"');
    for (i = 0; i < n; i++) {
      var x0 = i * paso;
      g += rectSvg(x0 + 5, 3.2, paso - 10, 2.2, 1, 'fill="#BFE3F2" stroke="#8FB3C4" stroke-width=".4"') +                       // el espejo del fondo
        '<circle cx="' + n1(x0 + paso / 2) + '" cy="' + n1(F * 0.42) + '" r="' + n1(Math.min(paso, F) * 0.1) + '" fill="#6A4A36"/>' +   // el banquito
        '<path d="M' + n1(x0 + 3) + ' ' + n1(F - 2.4) + ' q' + n1((paso * 0.62) / 8) + ' -2.6 ' + n1((paso * 0.62) / 4) + ' 0 t' + n1((paso * 0.62) / 4) + ' 0 t' + n1((paso * 0.62) / 4) + ' 0 t' + n1((paso * 0.62) / 4) +
        ' 0" fill="none" stroke="#8E3B30" stroke-width="3" stroke-linecap="round"/>';                                                 // la cortina, corrida
    }
    g += rectSvg(0, 0, L, 2.8, 0, 'fill="#F1ECE4"') + rectSvg(0, 0, 2.8, F, 0, 'fill="#F1ECE4"') + rectSvg(L - 2.8, 0, 2.8, F, 0, 'fill="#F1ECE4"');
    for (i = 1; i < n; i++) g += rectSvg(i * paso - 1.3, 0, 2.6, F * 0.9, 0, 'fill="#F1ECE4"');
    g = '<g transform="' + m.t + '">' + g + '</g>' + rectSvg(r.x, r.y, r.w, r.h, 2, 'fill="none" stroke="rgba(60,45,30,.45)" stroke-width=".8"');
  } else if (tipo === 'caja') {
    g += rectSvg(0, 0, L, F, 4, 'fill="#5E4130" stroke="#2C1D14" stroke-width=".8"') + rectSvg(2.2, 2.2, L - 4.4, F - 4.4, 3, 'fill="#2E2A27"');
    g += rectSvg(L * 0.07, F * 0.16, L * 0.2, F * 0.36, 1.5, 'fill="#101214"') + rectSvg(L * 0.07 + 1.6, F * 0.16 + 1.6, L * 0.2 - 3.2, F * 0.36 - 3.2, 1, 'fill="#C6F432" opacity=".85"');
    g += rectSvg(L * 0.8, F * 0.18, F * 0.22, F * 0.32, 1.5, 'fill="#1B1D20" stroke="#55595F" stroke-width=".6"') + rectSvg(L * 0.74, F * 0.62, L * 0.2, F * 0.16, 1, 'fill="#E9E2D6" opacity=".9"');
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'mesa') {
    g += rectSvg(0, 0, L, F, 3, 'fill="#8A6449" stroke="#5E4130" stroke-width="1"') + rectSvg(1.6, 1.6, L - 3.2, F - 3.2, 2, 'fill="none" stroke="#A57C5C" stroke-width=".8"');
    var cols = Math.max(2, Math.floor(L / 21)), filas = Math.max(1, Math.floor(F / 21)), bw = (L - 6) / cols, bh = (F - 6) / filas, s2 = Math.min(bw, bh) * 0.74;
    for (var f = 0; f < filas; f++) {
      for (var c = 0; c < cols; c++) {
        var col = ROPA_COLORES[(sem + c * 3 + f * 5) % ROPA_COLORES.length], bx = 3 + c * bw + (bw - s2) / 2, by = 3 + f * bh + (bh - s2) / 2;
        g += rectSvg(bx, by, s2, s2, 1.5, 'fill="' + col + '" stroke="rgba(0,0,0,.4)" stroke-width=".5"') +
          rectSvg(bx + 1.2, by + s2 * 0.42, s2 - 2.4, 0.9, 0, 'fill="' + (esClaro(col) ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.35)') + '"');
      }
    }
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'perchero') {
    var rp = Math.max(2.2, F * 0.16);
    g += rectSvg(rp, F / 2 - 0.8, L - 2 * rp, 1.6, 0, 'fill="#B4B9BE"');
    for (var xx = rp * 2.2, k = 0; xx < L - rp * 2.2; xx += 4.1, k++) {
      var cc = ROPA_COLORES[(sem + Math.floor(k / 3) * 7) % ROPA_COLORES.length];
      g += rectSvg(xx, F * 0.12, 3.1, F * 0.76, 1.3, 'fill="' + cc + '" stroke="rgba(0,0,0,.35)" stroke-width=".4"');
    }
    g += '<circle cx="' + n1(rp) + '" cy="' + n1(F / 2) + '" r="' + n1(rp) + '" fill="#8E949B"/><circle cx="' + n1(L - rp) + '" cy="' + n1(F / 2) + '" r="' + n1(rp) + '" fill="#8E949B"/>';
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'maniqui') {
    /* Como la ropa, de frente (se entiende mejor que desde arriba): la base, el cuerpo vestido con una remera de color y la cabeza. */
    var mm = Math.min(r.w, r.h), cx = r.x + r.w / 2, cy = r.y + r.h / 2, ropa = ROPA_COLORES[sem % ROPA_COLORES.length], u = mm / 34;
    g += '<ellipse cx="' + n1(cx) + '" cy="' + n1(cy + 14 * u) + '" rx="' + n1(12 * u) + '" ry="' + n1(3.4 * u) + '" fill="#2F3237"/>' +
      rectSvg(cx - 0.9 * u, cy + 4 * u, 1.8 * u, 10 * u, 0, 'fill="#8E949B"') +
      '<path d="M' + n1(cx - 9.5 * u) + ' ' + n1(cy - 6 * u) + 'Q' + n1(cx) + ' ' + n1(cy - 9.5 * u) + ' ' + n1(cx + 9.5 * u) + ' ' + n1(cy - 6 * u) + 'L' + n1(cx + 6 * u) + ' ' + n1(cy + 6 * u) +
        'H' + n1(cx - 6 * u) + 'Z" fill="' + ropa + '" stroke="rgba(0,0,0,.45)" stroke-width=".7" stroke-linejoin="round"/>' +
      '<circle cx="' + n1(cx) + '" cy="' + n1(cy - 12 * u) + '" r="' + n1(4 * u) + '" fill="#F4F1EC" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>';
  } else if (tipo === 'planta') {
    var pm = Math.min(r.w, r.h), px = r.x + r.w / 2, py = r.y + r.h / 2, verdes = ['#2F6B3C', '#3F7D4A', '#4E9A57', '#3A7444'];
    g += '<circle cx="' + n1(px) + '" cy="' + n1(py) + '" r="' + n1(pm * 0.34) + '" fill="#A0583C" stroke="#6E3A26" stroke-width="1"/>';
    for (i = 0; i < 7; i++) {
      var a = i / 7 * Math.PI * 2 + (sem % 10) / 10;
      g += '<circle cx="' + n1(px + Math.cos(a) * pm * 0.25) + '" cy="' + n1(py + Math.sin(a) * pm * 0.25) + '" r="' + n1(pm * 0.22) + '" fill="' + verdes[i % 4] + '"/>';
    }
    g += '<circle cx="' + n1(px - pm * 0.05) + '" cy="' + n1(py - pm * 0.06) + '" r="' + n1(pm * 0.17) + '" fill="#6DB36F"/>';
  } else if (tipo === 'columna') {
    g += rectSvg(r.x, r.y, r.w, r.h, 2, 'fill="#DAD5CD" stroke="#A9A39A" stroke-width="1"') + '<path d="M' + n1(r.x) + ' ' + n1(r.y + r.h) + 'L' + n1(r.x + r.w) + ' ' + n1(r.y) + 'V' + n1(r.y + r.h) + 'Z" fill="rgba(0,0,0,.08)"/>';
  } else if (tipo === 'escalera') {
    var esc0 = Math.max(4, Math.floor(L / 9));
    g += rectSvg(0, 0, L, F, 1.5, 'fill="#E6E0D6"');
    for (i = 1; i < esc0; i++) g += rectSvg(i * L / esc0 - 0.5, 2.4, 1, F - 4.8, 0, 'fill="#A79E91"');
    g += rectSvg(0, 0, L, 2.4, 0, 'fill="#2B2D32"') + rectSvg(0, F - 2.4, L, 2.4, 0, 'fill="#2B2D32"') +
      '<path d="M' + n1(L * 0.12) + ' ' + n1(F / 2) + 'H' + n1(L * 0.86) + 'M' + n1(L * 0.8) + ' ' + n1(F / 2 - 4) + 'L' + n1(L * 0.86) + ' ' + n1(F / 2) + 'L' + n1(L * 0.8) + ' ' + n1(F / 2 + 4) + '" fill="none" stroke="#5A5045" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'espejo') {
    g += rectSvg(0, 0, L, F, 2, 'fill="#B9D6E4" stroke="#C9CED4" stroke-width="1.6"') + '<path d="M' + n1(L * 0.18) + ' ' + n1(F - 1.5) + 'L' + n1(L * 0.32) + ' 1.5" stroke="rgba(255,255,255,.75)" stroke-width="1.2"/>';
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'mesalisa') {
    /* La tabla sola: madera con sus vetas y el borde más oscuro. */
    g += rectSvg(0, 0, L, F, 3, 'fill="#8A6449" stroke="#5E4130" stroke-width="1"') + rectSvg(2, 2, L - 4, F - 4, 2, 'fill="#9A7253"');
    for (i = 1; i < 6; i++) g += '<path d="M3 ' + n1(F * i / 6) + 'Q' + n1(L * 0.35) + ' ' + n1(F * i / 6 + ((sem >> i) & 1 ? 1.4 : -1.4)) + ' ' + n1(L - 3) + ' ' + n1(F * i / 6) + '" fill="none" stroke="rgba(70,45,28,.22)" stroke-width=".7"/>';
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'banco') {
    g += rectSvg(0, 0, L, F, F * 0.45, 'fill="#7A4B33" stroke="#4E2F20" stroke-width="1"') + rectSvg(F * 0.4, F / 2 - 0.5, L - F * 0.8, 1, 0, 'fill="rgba(255,255,255,.25)"');
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else if (tipo === 'deposito') {
    /* La puerta que lleva al depósito: el hueco en la pared y la hoja abierta hacia el salón. */
    var ap = Math.min(L * 0.72, 46), h0 = (L - ap) / 2, hoja = Math.min(ap, F * 0.92);
    g += rectSvg(h0, 0, ap, 3.4, 0, 'fill="#3A3530"') +
      '<path d="M' + n1(h0 + hoja) + ' 1.7A' + n1(hoja) + ' ' + n1(hoja) + ' 0 0 1 ' + n1(h0) + ' ' + n1(1.7 + hoja) + '" fill="none" stroke="#7A6650" stroke-width=".9" stroke-dasharray="2.5 2.5"/>' +
      rectSvg(h0 - 1, 1.7, 2.2, hoja, 0.8, 'fill="#6A4A36"');
    g = '<g transform="' + m.t + '">' + g + '</g>';
  } else {
    g += rectSvg(r.x, r.y, r.w, r.h, 6, 'fill="#6E7682" stroke="rgba(0,0,0,.3)" stroke-width=".8"');
  }
  var oscuro = tipo === 'otro' || tipo === 'caja' || tipo === 'deposito';
  /* Un fondo invisible del tamaño de la pieza: en el editor se agarra de cualquier parte (un perchero es casi todo aire). */
  return '<g class="mapa-fijo mapa-pieza pz-' + tipo + '"' + (attrs || '') + '>' + (attrs ? rectSvg(r.x, r.y, r.w, r.h, 0, 'fill="transparent"') : '') + g +
    (conNombre ? nombrePieza(r, propio ? nombre : PIEZAS[tipo].corto || PIEZAS[tipo].nombre, oscuro) : '') + '</g>';
}

function cajaModulo(d, op, m, r, etiqueta, sub, lado) {
  var s = d.sectorDe[m.sector_id], resp = s && d.persona[s.responsable_id], dep = !!(s && s.tipo === 'deposito');
  var apagado = (op.resaltar && m.sector_id !== op.resaltar) || (op.mios && !op.mios[m.id]);
  var color = esVidriera(m) ? COLOR_VIDRIERA : d.color[m.sector_id] || GRIS_SIN_RESPONSABLE, parado = r.h > r.w;
  var out = '<g class="mapa-mod' + (op.marcas && op.marcas[m.id] ? ' con-marca' : '') + '" data-mod="' + esc(m.id) + '"' + (apagado ? ' opacity=".4"' : '') + '><title>' +
    esc(nombreModulo(m, s, d) + (resp ? ' · ' + nombreLista(resp) : ' · sin responsable')) + '</title>';
  /* El neón de quien lo tiene: la luz se derrama sobre el piso, del lado del salón (lo apagado, sin luz). */
  if (!apagado) out += luzNeon(r, lado, color, op._neon);
  out += rectSvg(r.x, r.y, Math.max(4, r.w), Math.max(4, r.h), 3, 'class="mapa-cuerpo" fill="' + (dep ? '#7B828B' : op._madera ? 'url(#' + op._madera + ')' : '#6B4A35') + '" stroke="' + (dep ? '#3E444B' : '#2C1D14') +
    '" stroke-width=".8"' + (op._sombra ? ' filter="' + op._sombra + '"' : '')) + interiorModulo(d, m, r, op._pref || 'mpR', lado);
  if (!apagado) out += lineaNeon(r, lado, color);
  var marca = op.marcas && op.marcas[m.id];
  out += rotuloModulo(r, etiqueta, sub, color, lado, !!marca);
  /* La marca (cámara, ✓…): en la punta del módulo, montada sobre la pared (el número está del otro lado, sobre el neón). */
  if (marca) { var em = esquinaMarca(r, lado); out += marcaModulo(marca, em[0], em[1]); }
  return out + '</g>';
}
/** Dónde va la marca de un módulo: en las paredes, al principio del módulo y sobre la pared; en el centro, arriba a la derecha. */
function esquinaMarca(r, lado) {
  if (lado === 'izquierda') return [r.x - 1, r.y + 13];
  if (lado === 'derecha') return [r.x + r.w + 1, r.y + 13];
  if (lado === 'fondo') return [r.x + 13, r.y - 1];
  if (lado === 'frente') return [r.x + 13, r.y + r.h + 1];
  return [r.x + r.w - 11, r.y + 11];
}
/* ── Las imágenes de cada pieza (14/10, "más parecido a la foto"): vistas desde arriba, con el estilo de los locales
   (marco de hierro oxidado, estante de madera, riel negro tipo escalera). Están en croquis-img/; sin esa carpeta
   (CROQUIS_IMG vacío) se usan los dibujos. ── */
var CROQUIS_IMG = 'croquis-img/';
/** Qué imagen va según la prenda: las que no tienen la suya usan la parecida. */
var IMAGEN_PRENDA = { remera: 'remeras', musculosa: 'remeras', buzo: 'buzos', sweater: 'buzos', campera: 'camperas', camisa: 'camisas', jean: 'jeans',
  pantalon: 'pantalones', bermuda: 'bermudas', vestido: 'mixto', pollera: 'mixto', zapatilla: 'zapatillas', gorra: 'accesorios', medias: 'accesorios', accesorio: 'accesorios' };
var IMAGEN_PIEZA = { probador: 'probador', caja: 'caja', mesa: 'mesa', perchero: 'perchero', maniqui: 'maniqui', planta: 'planta', escalera: 'escalera' };
/** Una o más imágenes en el lugar r, del lado del salón hacia frente (ver marcoPieza: la imagen tiene la pared arriba).
    Varias, una al lado de la otra a lo largo. relleno: llena el lugar recortando (los módulos); si no, entra entera. */
function imagenesCroquis(nombres, r, frente, relleno, sem) {
  var mp = marcoPieza(r, frente || 's'), k = nombres.length, paso = mp.L / k, out = '';
  nombres.forEach(function (n, i) {
    var al = ['xMinYMid', 'xMidYMid', 'xMaxYMid'][((sem >>> 0) + i) % 3];
    out += '<image href="' + CROQUIS_IMG + n + '.webp" x="' + n1(i * paso) + '" y="0" width="' + n1(paso) + '" height="' + n1(mp.F) + '" preserveAspectRatio="' + (relleno ? al + ' slice' : 'xMidYMid meet') + '"/>';
  });
  return '<g transform="' + mp.t + '">' + out + '</g>';
}
/** Lo de adentro de un módulo: la ropa de lo que dice "qué hay" (o su nombre, si es de ropa), con la imagen de esa prenda (dos, si dice dos);
    si no dice, ropa colgada; en el depósito, la estantería con cajas. lado: la pared del módulo (sin pared, está en el centro). */
function interiorModulo(d, m, r, pref, lado) {
  var s = d.sectorDe[m.sector_id], dep = !!(s && s.tipo === 'deposito'), a = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, sem = semillaDe(m.id);
  var tipos = prendasDe(queHay(m) || (m.isla ? m.nombre : nombrePropio(m)) || (dep && s ? s.nombre : ''));
  if (CROQUIS_IMG && esVidriera(m)) {
    var bv = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, cuantas = Math.max(1, Math.round(bv.w / (bv.h * 3.6))), lv = [];
    for (var iv = 0; iv < cuantas; iv++) lv.push(iv % 2 ? 'vidriera-b' : 'vidriera-a');
    return rectSvg(bv.x, bv.y, bv.w, bv.h, 2, 'fill="#6E4A2E"') + imagenesCroquis(lv, bv, 's', true, sem);
  }
  if (CROQUIS_IMG) {
    var nombres = [];
    (dep ? ['deposito'] : tipos.map(function (t) { return IMAGEN_PRENDA[t]; })).forEach(function (n) { if (n && nombres.indexOf(n) < 0 && nombres.length < 2) nombres.push(n); });
    if (!nombres.length) nombres = [lado ? 'colgada' : 'mesa'];
    var b = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 };
    return rectSvg(b.x, b.y, b.w, b.h, 2, 'fill="#6E4A2E"') + imagenesCroquis(nombres, b, lado ? FRENTE_PARED[lado] : r.h > r.w * 1.15 ? 'e' : 's', true, sem);
  }
  return rectSvg(a.x, a.y, a.w, a.h, 2, 'fill="' + (dep ? '#59606A' : '#4A3326') + '"') + (tipos.length ? svgPrendas(a, tipos, sem, pref) : dep ? svgCajas(a, sem) : svgColgada(a, sem));
}
/** La luz del neón sobre el piso, del lado que da al salón (lado: la pared del módulo; sin pared, alrededor). */
function luzNeon(r, lado, color, filtro) {
  var f = 'fill="' + color + '" opacity=".95"' + (filtro ? ' filter="' + filtro + '"' : ''), a = 12;
  if (lado === 'izquierda') return rectSvg(r.x + r.w - 3, r.y + 3, a + 3, r.h - 6, 3, f);
  if (lado === 'derecha') return rectSvg(r.x - a, r.y + 3, a + 3, r.h - 6, 3, f);
  if (lado === 'fondo') return rectSvg(r.x + 3, r.y + r.h - 3, r.w - 6, a + 3, 3, f);
  if (lado === 'frente') return rectSvg(r.x + 3, r.y - a, r.w - 6, a + 3, 3, f);
  return rectSvg(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 7, 'fill="none" stroke="' + color + '" stroke-width="6" opacity=".8"' + (filtro ? ' filter="' + filtro + '"' : ''));
}
/** El tubo del neón: una línea del color, con el centro casi blanco (como encendido). */
function lineaNeon(r, lado, color) {
  var l = lado === 'izquierda' ? [r.x + r.w, r.y + 3, r.x + r.w, r.y + r.h - 3] : lado === 'derecha' ? [r.x, r.y + 3, r.x, r.y + r.h - 3]
        : lado === 'fondo' ? [r.x + 3, r.y + r.h, r.x + r.w - 3, r.y + r.h] : lado === 'frente' ? [r.x + 3, r.y, r.x + r.w - 3, r.y] : null;
  if (!l) return rectSvg(r.x - 1.2, r.y - 1.2, r.w + 2.4, r.h + 2.4, 4.5, 'fill="none" stroke="' + color + '" stroke-width="2.2"') +
    rectSvg(r.x - 1.2, r.y - 1.2, r.w + 2.4, r.h + 2.4, 4.5, 'fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7"');
  var p = 'x1="' + n1(l[0]) + '" y1="' + n1(l[1]) + '" x2="' + n1(l[2]) + '" y2="' + n1(l[3]) + '" stroke-linecap="round"';
  return '<line ' + p + ' stroke="' + color + '" stroke-width="3"/><line ' + p + ' stroke="#fff" stroke-opacity=".65" stroke-width=".9"/>';
}
/** El número, en una pastilla oscura con el borde del color de quien lo tiene, y qué hay (o el nombre), adentro. */
function rotuloModulo(r, etiqueta, sub, color, lado, conMarca) {
  etiqueta = String(etiqueta || '');
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2, parado = r.h > r.w, fs = Math.max(10.5, Math.min(15, Math.min(r.w, r.h) * 0.32));
  var th = fs * 1.5, bw = Math.max(th, etiqueta.length * fs * 0.62 + fs * 0.9), bx = cx, by = cy, out = '';
  /* En las paredes, el número va montado sobre la línea de neón; en el centro, adentro (arriba si lleva nombre). */
  if (lado === 'izquierda') bx = r.x + r.w;
  else if (lado === 'derecha') bx = r.x;
  else if (lado === 'fondo') by = r.y + r.h;
  else if (lado === 'frente') by = r.y;
  else if (sub) by = parado ? r.y + 4 + th / 2 : cy - 7;
  if (sub) {
    /* Qué hay (o el nombre): adentro, a lo largo; si no entra, con letra más chica y, si igual no entra, recortado. */
    var lx = cx, ly = cy, largo;
    if (!lado) {
      if (parado) { var desde = by + th / 2 + 3; largo = r.y + r.h - desde - 4; ly = desde + largo / 2; }
      else { largo = r.w - 6; ly = by + th / 2 + 9; }
    } else {
      var s0 = (parado ? r.y : r.x) + 4, s1 = (parado ? r.y + r.h : r.x + r.w) - 4;
      if (!parado && lado === 'izquierda') s1 -= bw / 2 + 2;
      if (!parado && lado === 'derecha') s0 += bw / 2 + 2;
      if (parado && lado === 'fondo') s1 -= th / 2 + 2;
      if (parado && lado === 'frente') s0 += th / 2 + 2;
      if (conMarca && !parado && lado === 'izquierda') s0 += 14;
      if (conMarca && !parado && lado === 'derecha') s1 -= 14;
      if (conMarca && parado && lado === 'fondo') s0 += 14;
      if (conMarca && parado && lado === 'frente') s1 -= 14;
      largo = s1 - s0;
      if (parado) ly = (s0 + s1) / 2; else lx = (s0 + s1) / 2;
    }
    var f2 = 9.5, t = String(sub);
    while (f2 > 8 && t.length * f2 * 0.6 + 10 > largo) f2 -= 0.5;
    if (t.length * f2 * 0.6 + 10 > largo) t = recortar(sub, Math.max(2, Math.floor((largo - 10) / (f2 * 0.6))));
    if (largo > 16 && (t === sub || t.length >= 4)) {
      var ancho = Math.min(largo, t.length * f2 * 0.6 + 10);
      out += '<g transform="translate(' + n1(lx) + ',' + n1(ly) + ')' + (parado ? ' rotate(-90)' : '') + '">' + rectSvg(-ancho / 2, -6.5, ancho, 13, 6.5, 'fill="rgba(13,15,19,.82)"') +
        '<text y="3.2" text-anchor="middle" font-size="' + f2 + '" font-weight="700" fill="#F4F5F7">' + esc(t) + '</text></g>';
    }
  }
  return out + rectSvg(bx - bw / 2, by - th / 2, bw, th, th / 2, 'fill="rgba(13,15,19,.94)" stroke="' + color + '" stroke-width="1.8"') +
    '<text x="' + n1(bx) + '" y="' + n1(by + fs * 0.36) + '" text-anchor="middle" font-size="' + n1(fs) + '" font-weight="800" fill="#F4F5F7">' + esc(etiqueta) + '</text>';
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
function anchoLugar(l) { return l === 'd' ? 2 : l && typeof l === 'object' && (l.a === 2 || l.a === 3) ? l.a : 1; }
function repetido(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
function entre01(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; }

/** El croquis guardado, prolijo (lo raro se descarta). */
function normalizarCroquis(g) {
  var paredes = {};
  VUELTA.forEach(function (w) {
    paredes[w] = ((g.paredes || {})[w] || []).slice(0, 60).map(function (l) {
      return l === 'd' ? 'd' : (l && typeof l === 'object') ? lugarFijo(l) : 'm';
    });
  });
  var pu = g.puerta && VUELTA.indexOf(g.puerta.pared) > -1
    ? { pared: g.puerta.pared, pos: Math.max(0, Math.min(paredes[g.puerta.pared].length, Math.round(+g.puerta.pos) || 0)), virtual: !!g.puerta.virtual, a: anchoPuerta(g.puerta) }
    : { pared: 'frente', pos: paredes.frente.length, virtual: true };
  var centro = {};
  Object.keys(g.centro || {}).forEach(function (k) { var p = g.centro[k]; if (p) centro[String(k).toLowerCase()] = { x: entre01(p.x), y: entre01(p.y) }; });
  var fijos = (g.fijos || []).slice(0, 30).map(function (f) {
    var nombre = String((f && f.nombre) || '').slice(0, 40);
    return { nombre: nombre, tipo: piezaValida(f && f.tipo) || tipoPieza(nombre), x: entre01(f && f.x), y: entre01(f && f.y), vertical: !!(f && f.vertical) };
  });
  var esq = {};
  Object.keys(ESQUINAS).forEach(function (k) { var v = (g.esquinas || {})[k]; if (ESQUINAS[k].indexOf(v) > -1 && v !== ESQUINAS[k][0]) esq[k] = v; });
  return { paredes: paredes, puerta: pu, centro: centro, fijos: fijos, frente: FRENTES[g.frente] ? g.frente : 'calle', esquinas: esq };
}
/** Las esquinas: de quién es cada una (la primera, si no se dijo otra cosa). ai: arriba a la izquierda, ad: arriba a la
    derecha, bi: abajo a la izquierda, bd: abajo a la derecha. */
var ESQUINAS = { ai: ['fondo', 'izquierda'], ad: ['fondo', 'derecha'], bi: ['frente', 'izquierda'], bd: ['frente', 'derecha'] };
/** La esquina que toca cada punta de cada pared (la punta 0 es donde arranca la pared en la vuelta). */
var PUNTAS = { izquierda: ['bi', 'ai'], fondo: ['ai', 'ad'], derecha: ['ad', 'bd'], frente: ['bd', 'bi'] };
function duenoEsquina(cq, k) { var v = (cq.esquinas || {})[k]; return ESQUINAS[k].indexOf(v) > -1 ? v : ESQUINAS[k][0]; }
/** Un lugar de una pared que no es módulo: { h: su nombre, k: qué pieza es (probadores, la puerta del depósito…), a: cuántos lugares ocupa (1 a 3) }. Sin nombre ni pieza, un hueco. */
function lugarFijo(l) {
  var o = { h: String(l.h || '').slice(0, 40) }, k = piezaValida(l.k), a = Math.round(+l.a);
  if (k) o.k = k;
  if (a === 2 || a === 3) o.a = a;
  return o;
}
/** Qué hay enfrente del local, del otro lado de la vidriera. */
var FRENTES = { calle: { nombre: 'Vereda', fondo: '#3A3E45', texto: 'rgba(255,255,255,.5)' }, galeria: { nombre: 'Galería', fondo: '#CDD1D6', texto: 'rgba(30,34,40,.55)' },
                shopping: { nombre: 'Pasillo del shopping', fondo: '#D6D8DB', texto: 'rgba(30,34,40,.55)' } };

/** Cuántos lugares ocupa la puerta (1 a 3): con 2, entre dos módulos de cada lado, queda centrada. */
function anchoPuerta(p) { var a = Math.round(+(p && p.a)); return a === 2 || a === 3 ? a : 1; }
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
  return { paredes: paredes, puerta: { pared: 'frente', pos: c.frente, virtual: true }, centro: {}, fijos: [], frente: 'calle' };
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
    u[w] = cq.paredes[w].reduce(function (s, l) { return s + anchoLugar(l); }, 0) + (cq.puerta && cq.puerta.pared === w ? anchoPuerta(cq.puerta) : 0);
  });
  var arriba = u.fondo ? y0 + P : y0, abajo = u.frente ? y1 - P : y1;
  var izq = u.izquierda ? x0 + P : x0, der = u.derecha ? x1 - P : x1;
  /* Cada esquina es de una de sus dos paredes (si la otra no tiene nada, la ocupa la que tiene): así no quedan huecos. */
  var de = function (k, w) { var d = duenoEsquina(cq, k), otra = ESQUINAS[k][0] === w ? ESQUINAS[k][1] : ESQUINAS[k][0]; return d === w || !u[otra]; };
  var tramos = {
    izquierda: { horiz: false, fijo: x0, desde: de('bi', 'izquierda') ? y1 : abajo, hasta: de('ai', 'izquierda') ? y0 : arriba },
    fondo: { horiz: true, fijo: y0, desde: de('ai', 'fondo') ? x0 : izq, hasta: de('ad', 'fondo') ? x1 : der },
    derecha: { horiz: false, fijo: x1 - P, desde: de('ad', 'derecha') ? y0 : arriba, hasta: de('bd', 'derecha') ? y1 : abajo },
    frente: { horiz: true, fijo: y1 - P, desde: de('bd', 'frente') ? x1 : der, hasta: de('bi', 'frente') ? x0 : izq }
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
      if (cq.puerta && cq.puerta.pared === w && cq.puerta.pos === i) puerta = { pared: w, r: caja(anchoPuerta(cq.puerta)) };
      lugares[w].push(caja(anchoLugar(l)));
    });
    if (cq.puerta && cq.puerta.pared === w && cq.puerta.pos >= cq.paredes[w].length) puerta = { pared: w, r: caja(anchoPuerta(cq.puerta)) };
  });
  return { lugares: lugares, puerta: puerta, adentro: { x0: izq, y0: arriba, x1: der, y1: abajo }, tramos: tramos, G: G };
}

/** Un lugar de una pared sin nada (un hueco): punteado. Lo que tiene nombre o pieza (probadores, la puerta del depósito) lo dibuja dibujoPieza. */
function cajaHueco(r) {
  return '<g class="mapa-fijo mapa-hueco">' + rectSvg(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 4, 'fill="none" stroke="#7A6650" stroke-opacity=".6" stroke-dasharray="3 4"') + '</g>';
}

/** La puerta (la entrada del local o la del depósito): la alfombra, las hojas de vidrio abiertas hacia adentro y su nombre. doble: dos hojas. */
function dibujoPuerta(p, texto, attrs, doble, op) {
  op = op || {};
  var m = marcoPieza(p.r, FRENTE_PARED[p.pared] || 'n'), L = m.L, F = m.F, g = '', hojas = doble ? 2 : 1, largo = Math.min(L / hojas - 2, F * 0.95), ang = 72 * Math.PI / 180;
  /* La alfombra y las hojas de vidrio, abiertas hacia adentro. */
  g += rectSvg(L * 0.1, F * 0.14, L * 0.8, F * 0.52, 3, 'fill="#2B2D32" fill-opacity=".88"');
  for (var k = 0; k < hojas; k++) {
    var hx = k ? L - 1.5 : 1.5, sg = k ? -1 : 1, ex = hx + sg * largo * Math.cos(ang), ey = largo * Math.sin(ang);
    g += '<path d="M' + n1(hx + sg * largo) + ' 0A' + n1(largo) + ' ' + n1(largo) + ' 0 0 ' + (k ? 0 : 1) + ' ' + n1(ex) + ' ' + n1(ey) + '" fill="none" stroke="#7A6650" stroke-width=".9" stroke-dasharray="2.5 2.5"/>' +
      '<line x1="' + n1(hx) + '" y1="0" x2="' + n1(ex) + '" y2="' + n1(ey) + '" stroke="#9FD0E6" stroke-width="2.6" stroke-linecap="round"/>' +
      '<line x1="' + n1(hx) + '" y1="0" x2="' + n1(ex) + '" y2="' + n1(ey) + '" stroke="#fff" stroke-opacity=".7" stroke-width=".7" stroke-linecap="round"/>';
  }
  return '<g class="mapa-puerta"' + (attrs || '') + '>' + rectSvg(p.r.x, p.r.y, p.r.w, p.r.h, 4, 'fill="transparent"') + '<g transform="' + m.t + '">' + g + '</g>' +
    (op.sinNombre || !texto ? '' : nombrePieza(p.r, texto, true)) + '</g>';
}

/** Dónde puede ir la puerta (para "Mover la puerta"): entre cada dos lugares y en las puntas de cada pared con lugares. */
/** Un lugar de pared sin nada (ni nombre ni pieza): un hueco. */
function lugarVacio(l) { return !!l && typeof l === 'object' && !l.k && !String(l.h || '').trim(); }
/** Un lugar donde puede ir la entrada: un hueco, o algo fijo cargado como "entrada" o "puerta" (no la del depósito). */
function lugarParaEntrada(l) { return lugarVacio(l) || (!!l && typeof l === 'object' && !l.k && /entrada|puerta/i.test(l.h || '')); }
function marcasPuerta(cq, geo, tipo) {
  var out = '';
  var marca = function (x, y, dato) {
    return '<g class="mapa-marca-puerta" data-hueco-puerta="' + dato + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="#C6F432" stroke="#111" stroke-width="1.5"/>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y + 5).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="800" fill="#111">+</text></g>';
  };
  VUELTA.forEach(function (w) {
    var ls = geo.lugares[w], lg = cq.paredes[w] || [];
    if (!ls.length) return;
    var t = geo.tramos[w], signo = t.hasta >= t.desde ? 1 : -1, G = geo.G;
    /* En el medio de cada hueco: la entrada va ahí, en lugar del hueco. */
    lg.forEach(function (l, i) { var r = ls[i]; if (r && lugarParaEntrada(l)) out += marca(r.x + r.w / 2, r.y + r.h / 2, tipo + ':' + w + ':' + i + ':h'); });
    for (var p = 0; p <= ls.length; p++) {
      /* Pegado a un hueco, no: la entrada quedaría con el hueco al lado. */
      if (lugarParaEntrada(lg[p - 1]) || lugarParaEntrada(lg[p])) continue;
      var r = ls[Math.min(p, ls.length - 1)], fin = p === ls.length, x, y;
      if (t.horiz) {
        var empieza = signo > 0 ? r.x - G / 2 : r.x + r.w + G / 2, termina = signo > 0 ? r.x + r.w + G / 2 : r.x - G / 2;
        x = fin ? termina : empieza; y = r.y + r.h / 2;
      } else {
        var empiezaY = signo > 0 ? r.y - G / 2 : r.y + r.h + G / 2, terminaY = signo > 0 ? r.y + r.h + G / 2 : r.y - G / 2;
        y = fin ? terminaY : empiezaY; x = r.x + r.w / 2;
      }
      out += marca(x, y, tipo + ':' + w + ':' + p);
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
        if (m) out += cajaModulo(d, op, m, r, etiqueta(m), sub(m), w);
        else if (op.vacios) {
          out += '<g class="mapa-vacio">' + rectSvg(r.x, r.y, Math.max(4, r.w), Math.max(4, r.h), 4, 'fill="rgba(255,255,255,.3)" stroke="#7A6650" stroke-opacity=".85" stroke-dasharray="4 3"') +
            '<text x="' + n1(r.x + r.w / 2) + '" y="' + n1(r.y + r.h / 2 + 4) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#5A4A38">' + (k + 1) + '</text></g>';
        }
      } else if (l.h || l.k) out += dibujoPieza(l.k || tipoPieza(l.h), r, l.h, FRENTE_PARED[w]);
      else out += cajaHueco(r);
      if (op.editable) out += '<rect class="mapa-toque" data-lugar="' + tipo + ':' + w + ':' + i + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(4, r.w).toFixed(1) + '" height="' + Math.max(4, r.h).toFixed(1) + '" fill="transparent"/>';
    });
  });
  if (geo.puerta) out += dibujoPuerta(geo.puerta, tipo === 'deposito' ? 'Puerta' : 'Entrada', op.editable ? ' data-puerta="' + tipo + '"' : '', tipo !== 'deposito');
  if (op.moverPuerta === tipo) out += marcasPuerta(cq, geo, tipo);
  return { svg: out, sobran: sobran };
}

/** Lo de adentro del salón: las cosas fijas (para ubicarse) y los módulos del centro, cada uno donde lo
    pusieron; los que todavía no tienen lugar, en fila por el medio (de la caja hacia la vidriera). */
function dibujarCentro(d, op, cq, geo, sobran) {
  var a = geo.adentro, mx = 14, out = '';
  var ax0 = a.x0 + mx, ay0 = a.y0 + mx, aw = Math.max(40, a.x1 - a.x0 - 2 * mx), ah = Math.max(40, a.y1 - a.y0 - 2 * mx);
  (cq.fijos || []).forEach(function (f, k) {
    var tp = piezaValida(f.tipo) || tipoPieza(f.nombre), t = tamanoPieza(tp, f.vertical), cx = ax0 + f.x * aw, cy = ay0 + f.y * ah;
    var r = { x: cx - t.w / 2, y: cy - t.h / 2, w: t.w, h: t.h };
    out += dibujoPieza(tp, r, f.nombre, frenteAdentro(r, { x: ax0, y: ay0, w: aw, h: ah }), op.editable ? ' data-fijo="' + k + '"' : '');
  });
  var libres = [];
  function toque(m, r) {
    return op.editable && m.isla ? '<rect class="mapa-toque arrastrable" data-centro="' + esc(String(m.nombre || '').toLowerCase()) + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) +
      '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) + '" fill="transparent"/>' : '';
  }
  d.islas.forEach(function (m) {
    if (esVidriera(m)) return;
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

/** Los muebles de adentro del depósito (una mesa, un perchero), donde los pusieron. */
function fijosAdentro(cq, geo, op) {
  var a = geo.adentro, mx = 14, out = '';
  var ax0 = a.x0 + mx, ay0 = a.y0 + mx, aw = Math.max(40, a.x1 - a.x0 - 2 * mx), ah = Math.max(40, a.y1 - a.y0 - 2 * mx);
  (cq.fijos || []).forEach(function (f, k) {
    var tp = piezaValida(f.tipo) || tipoPieza(f.nombre), t = tamanoPieza(tp, f.vertical), cx = ax0 + f.x * aw, cy = ay0 + f.y * ah;
    var r = { x: cx - t.w / 2, y: cy - t.h / 2, w: t.w, h: t.h };
    out += dibujoPieza(tp, r, f.nombre, frenteAdentro(r, { x: ax0, y: ay0, w: aw, h: ah }), op.editable ? ' data-fijo="' + k + '"' : '');
  });
  return { svg: out, caja: [ax0, ay0, aw, ah] };
}

/** El piso (cerámica en el salón, cemento en el depósito), las luces del techo, la sombra de los muebles, el brillo del neón y la ropa. */
var _mapaN = 0;
function defsMapa(x0, y0, x1, y1, tipo) {
  var n = ++_mapaN, dep = tipo === 'deposito', w = x1 - x0, h = y1 - y0, luces = '';
  var piso = CROQUIS_IMG
    ? '<pattern id="mpP' + n + '" width="150" height="150" patternUnits="userSpaceOnUse" x="' + x0 + '" y="' + y0 + '"><rect width="150" height="150" fill="#9C9A95"/>' +
      '<image href="' + CROQUIS_IMG + 'textura-cemento.webp" width="150" height="150" preserveAspectRatio="none"/>' + (dep ? '<rect width="150" height="150" fill="#2B2A26" fill-opacity=".16"/>' : '') + '</pattern>'
    : dep
    ? '<pattern id="mpP' + n + '" width="96" height="96" patternUnits="userSpaceOnUse" x="' + x0 + '" y="' + y0 + '"><rect width="96" height="96" fill="#B5B0A8"/>' +
      '<circle cx="18" cy="22" r="1" fill="rgba(0,0,0,.08)"/><circle cx="61" cy="47" r="1.3" fill="rgba(0,0,0,.07)"/><circle cx="35" cy="78" r="1" fill="rgba(255,255,255,.18)"/><circle cx="82" cy="12" r="1" fill="rgba(255,255,255,.15)"/>' +
      '<path d="M96 0H0V96" fill="none" stroke="rgba(0,0,0,.13)" stroke-width="1"/></pattern>'
    : '<pattern id="mpP' + n + '" width="48" height="48" patternUnits="userSpaceOnUse" x="' + x0 + '" y="' + y0 + '"><rect width="48" height="48" fill="#E2CFB2"/>' +
      '<path d="M48 0H0V48" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/><path d="M47.4 1V47.4H1" fill="none" stroke="rgba(120,90,60,.13)" stroke-width="1"/></pattern>';
  if (!dep) [0.25, 0.75].forEach(function (lx) { [0.18, 0.5, 0.82].forEach(function (ly) { luces += '<ellipse cx="' + n1(x0 + lx * w) + '" cy="' + n1(y0 + ly * h) + '" rx="' + n1(w * 0.26) + '" ry="' + n1(h * 0.14) + '" fill="url(#mpL' + n + ')"/>'; }); });
  return { sombra: 'url(#mpS' + n + ')', neon: 'url(#mpN' + n + ')', madera: 'mpM' + n, pref: 'mpR' + n,
    svg: '<defs>' + piso +
      '<radialGradient id="mpL' + n + '"><stop offset="0" stop-color="#FFF3DC" stop-opacity="' + (CROQUIS_IMG ? '.42' : '.7') + '"/><stop offset="1" stop-color="#FFF6E4" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="mpV' + n + '" cx=".5" cy=".5" r=".72"><stop offset=".5" stop-color="#3C2814" stop-opacity="0"/><stop offset="1" stop-color="#3C2814" stop-opacity="' + (dep ? '.3' : '.24') + '"/></radialGradient>' +
      '<linearGradient id="mpM' + n + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#80593F"/><stop offset="1" stop-color="#5A3D2C"/></linearGradient>' +
      '<filter id="mpS' + n + '" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#000" flood-opacity=".35"/></filter>' +
      '<filter id="mpN' + n + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.6"/></filter>' + (CROQUIS_IMG ? '' : simbolosPrendas('mpR' + n)) + '</defs>',
    piso: '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="url(#mpP' + n + ')"/>' + luces +
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="url(#mpV' + n + ')"/>' };
}
/** Las paredes (gris oliva oscuro, como en los locales, con la cara de adentro un poco más clara) alrededor de x0..x1 × y0..y1, abiertas donde está la
    puerta; con vidrio, el frente es la vidriera. */
function murosMapa(x0, y0, x1, y1, T, puerta, vidrio) {
  var out = '', hueco = null;
  if (puerta) hueco = puerta.pared === 'fondo' || puerta.pared === 'frente' ? [puerta.r.x - 2, puerta.r.x + puerta.r.w + 2] : [puerta.r.y - 2, puerta.r.y + puerta.r.h + 2];
  function tramo(w, a0, a1, fijo, horiz, deVidrio) {
    var cortes = hueco && puerta.pared === w ? [[a0, hueco[0]], [hueco[1], a1]] : [[a0, a1]];
    cortes.forEach(function (c) {
      if (c[1] - c[0] < 1) return;
      var x = horiz ? c[0] : fijo, y = horiz ? fijo : c[0], ww = horiz ? c[1] - c[0] : T, hh = horiz ? T : c[1] - c[0];
      if (deVidrio) {
        out += rectSvg(x, y + T * 0.3, ww, T * 0.4, 0, 'fill="#A7D6EA" fill-opacity=".75"') + rectSvg(x, y + T * 0.3, ww, 0.9, 0, 'fill="#fff" fill-opacity=".9"');
        for (var p = c[0] + 70; p < c[1] - 20; p += 70) out += rectSvg(p - 1.5, y, 3, T, 0, 'fill="#30322C"');
      } else {
        out += rectSvg(x, y, ww, hh, 0, 'fill="#30322C"');
        /* La cara de adentro, clara. */
        out += w === 'fondo' ? rectSvg(x, y + T - 1.6, ww, 1.6, 0, 'fill="#6E7064"') : w === 'izquierda' ? rectSvg(x + T - 1.6, y, 1.6, hh, 0, 'fill="#6E7064"')
             : w === 'derecha' ? rectSvg(x, y, 1.6, hh, 0, 'fill="#6E7064"') : rectSvg(x, y, ww, 1.6, 0, 'fill="#6E7064"');
      }
    });
  }
  tramo('fondo', x0 - T, x1 + T, y0 - T, true, false);
  tramo('izquierda', y0, y1, x0 - T, false, false);
  tramo('derecha', y0, y1, x1, false, false);
  tramo('frente', x0 - T, x1 + T, y1, true, vidrio);
  /* Las columnas de las esquinas del frente. */
  if (vidrio) out += rectSvg(x0 - T, y1, T + 2, T, 0, 'fill="#30322C"') + rectSvg(x1 - 2, y1, T + 2, T, 0, 'fill="#30322C"');
  return out;
}

/** El salón, en SVG. op.vacios, op.editable, op.croquis (el que se está armando), op.moverPuerta ('salon'). */
function svgMapa(d, op) {
  op = op || {};
  var cuadrado = (d.mapa || {}).forma === 'cuadrado';
  var W = cuadrado ? 600 : 520, H = cuadrado ? 560 : 700, M = 16, P = 50, G = 5, ABAJO = 28, T = 8;
  op = Object.assign({}, op, { _mitad: W / 2 });
  var cq = op.croquis ? op.croquis.salon : croquisDe(d, 'salon');
  var x0 = M, y0 = M, x1 = W - M, y1 = H - M - ABAJO, fr = FRENTES[cq.frente] || FRENTES.calle;
  /* La vidriera, si hay: el vidrio pasa a yv y el dibujo crece hacia abajo. */
  var vids = d.islas.filter(esVidriera), yv = vids.length ? y1 + ALTO_VIDRIERA : y1;
  H += yv - y1;
  var geo = geometriaCroquis(op.moverPuerta === 'salon' ? sinPuerta(cq) : cq, x0, y0, x1, y1, P, G), df = defsMapa(x0, y0, x1, yv, 'salon');
  op._sombra = df.sombra; op._neon = df.neon; op._madera = df.madera; op._pref = df.pref;
  /* El local como una foto desde arriba: lo de afuera (la vereda o la galería), el piso, las paredes y la vidriera. */
  var out = df.svg + rectSvg(0, 0, W, H, 16, 'fill="#14171C"') +
    rectSvg(x0 - T - 4, yv + T, x1 - x0 + 2 * T + 8, H - yv - T - 5, 6, 'fill="' + fr.fondo + '"') +
    '<text class="mapa-afuera" x="' + (W / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="1.6" fill="' + fr.texto + '">' + esc(fr.nombre.toUpperCase()) + '</text>' +
    df.piso + murosMapa(x0, y0, x1, yv, T, geo.puerta, true);
  var p = dibujarParedes(d, op, cq, geo, 'salon', d.pared, function (m) { return String(m.numero); }, function (m) { return queHay(m) || nombrePropio(m); });
  var c = dibujarCentro(d, op, cq, geo, p.sobran);
  panelesVidriera(vids, x0, x1, y1, yv, geo.puerta, G).forEach(function (x) { c.svg += cajaModulo(d, op, x.m, x.r, x.m.nombre, queHay(x.m), 'frente'); });
  return '<svg class="mapa-svg' + (cuadrado ? ' cuadrado' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" data-adentro="' + c.caja.map(function (v) { return v.toFixed(1); }).join(' ') +
    '" role="img" aria-label="El salón, visto desde arriba">' + out + c.svg + p.svg + '</svg>';
}

/** Los paneles de la vidriera, entre el local (y1) y el vidrio (yv): "izq." a la izquierda de la entrada, "der." a la
    derecha; una sola, en el tramo más largo. Si la entrada no está en el frente (o está en una punta), se reparte el frente. */
var ALTO_VIDRIERA = 40;
function panelesVidriera(vids, x0, x1, y1, yv, puerta, G) {
  if (!vids.length) return [];
  var tramos = [[x0, x1]];
  if (puerta && puerta.pared === 'frente') tramos = [[x0, puerta.r.x - G / 2], [puerta.r.x + puerta.r.w + G / 2, x1]];
  var usables = tramos.filter(function (s) { return s[1] - s[0] >= 70; });
  var largo = function (s) { return s[1] - s[0]; };
  var mitad = function (s, cual) { var m = (s[0] + s[1]) / 2; return cual ? [m + G / 2, s[1]] : [s[0], m - G / 2]; };
  var mayor = usables.slice().sort(function (a, b) { return largo(b) - largo(a); })[0] || [x0, x1];
  var dos = usables.length === 2;
  var donde = function (m) {
    var n = String(m.nombre || '').trim().toLowerCase();
    if (n === 'vidriera izq.') return dos ? usables[0] : mitad(mayor, false);
    if (n === 'vidriera der.') return dos ? usables[1] : mitad(mayor, true);
    return mayor;
  };
  return vids.map(function (m) { var s = donde(m); return { m: m, r: { x: s[0] + G / 2, y: y1 + 4, w: Math.max(10, s[1] - s[0] - G), h: yv - y1 - 8 } }; });
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
  var geo = geometriaCroquis(op.moverPuerta === 'deposito' ? sinPuerta(cq) : cq, x0, y0, x1, y1, P, G), df = defsMapa(x0, y0, x1, y1, 'deposito');
  op._sombra = df.sombra; op._neon = df.neon; op._madera = df.madera; op._pref = df.pref;
  var out = df.svg + rectSvg(0, 0, W, H, 16, 'fill="#14171C"') + '<text x="' + (M + 2) + '" y="18" font-size="13" font-weight="800" letter-spacing=".6" fill="#C9CED6">Depósito</text>' +
    df.piso + murosMapa(x0, y0, x1, y1, 6, geo.puerta, false);
  var mods = numerado ? d.dep : d.dep.map(function (m, i) { return Object.assign({}, m, { numero: i + 1 }); });
  var p = dibujarParedes(d, op, cq, geo, 'deposito', mods,
    function (m) { return numerado ? String(m.numero) : 'Sector ' + d.sectorDe[m.sector_id].numero; },
    function (m) { var s = d.sectorDe[m.sector_id]; return (numerado && nombrePropio(m)) || (s && s.nombre) || ''; });
  var fx = fijosAdentro(cq, geo, op);
  return '<svg class="mapa-svg deposito" viewBox="0 0 ' + W + ' ' + H + '" data-adentro="' + fx.caja.map(function (v) { return v.toFixed(1); }).join(' ') +
    '" role="img" aria-label="El depósito">' + out + fx.svg + p.svg + '</svg>';
}

/** El plano del salón o del depósito como datos, con la misma cuenta que svgMapa y svgDeposito (el modo
    observador lo dibuja con volumen). items: { tipo: 'modulo'|'fijo'|'puerta', m, r: {x, y, w, h}, pared
    ('izquierda'|'fondo'|'derecha'|'frente', o null si está adentro), texto, vertical }. */
function planoMapa(d, tipo) {
  var dep = tipo === 'deposito', mm = d.mapa || {}, W, H, x0, y0, x1, y1, P, G;
  var cuadrado = dep ? mm.forma_deposito === 'cuadrado' : mm.forma === 'cuadrado';
  if (dep) { W = 420; P = 64; G = 6; x0 = 12; y0 = 30; x1 = W - 12; y1 = y0 + (cuadrado ? W - 24 : 250); H = y1 + 12; }
  else { W = cuadrado ? 600 : 520; H = cuadrado ? 560 : 700; P = 50; G = 5; x0 = 16; y0 = 16; x1 = W - 16; y1 = H - 16 - 28; }
  var cq = croquisDe(d, tipo), geo = geometriaCroquis(cq, x0, y0, x1, y1, P, G);
  var numerado = !dep || depositoNumerado(d);
  var mods = dep ? (numerado ? d.dep : d.dep.map(function (m, i) { return Object.assign({}, m, { numero: i + 1 }); })) : d.pared;
  var orden = ordenCroquis(cq), dueno = [], sobran = [], num = {}, items = [];
  mods.forEach(function (m) { var k = m.numero - 1; if (k >= 0 && k < orden.length && !dueno[k]) dueno[k] = m; else sobran.push(m); });
  orden.forEach(function (x, k) { num[x.pared + ':' + x.i] = k; });
  VUELTA.forEach(function (w) {
    cq.paredes[w].forEach(function (l, i) {
      var r = geo.lugares[w][i];
      if (!r) return;
      if (esModuloLugar(l)) { var m = dueno[num[w + ':' + i]]; if (m) items.push({ tipo: 'modulo', m: m, r: r, pared: w, doble: l === 'd' }); }
      else items.push({ tipo: 'fijo', r: r, pared: w, texto: l.h || '', pieza: l.h || l.k ? l.k || tipoPieza(l.h) : null, frente: FRENTE_PARED[w] });
    });
  });
  if (geo.puerta) items.push({ tipo: 'puerta', r: geo.puerta.r, pared: geo.puerta.pared });
  /* Lo de adentro, igual que dibujarCentro (en el depósito, sólo los muebles). */
  var a = geo.adentro, mx = 14, ax0 = a.x0 + mx, ay0 = a.y0 + mx;
  var aw = Math.max(40, a.x1 - a.x0 - 2 * mx), ah = Math.max(40, a.y1 - a.y0 - 2 * mx), libres = [];
  (cq.fijos || []).forEach(function (f) {
    var tp = piezaValida(f.tipo) || tipoPieza(f.nombre), t = tamanoPieza(tp, f.vertical), cx = ax0 + f.x * aw, cy = ay0 + f.y * ah;
    var r = { x: cx - t.w / 2, y: cy - t.h / 2, w: t.w, h: t.h };
    items.push({ tipo: 'fijo', r: r, pared: null, texto: f.nombre || '', vertical: f.vertical, pieza: tp, frente: frenteAdentro(r, { x: ax0, y: ay0, w: aw, h: ah }) });
  });
  if (!dep) {
    d.islas.forEach(function (m) {
      if (esVidriera(m)) return;
      var pos = (cq.centro || {})[String(m.nombre || '').toLowerCase()];
      if (!pos) { libres.push(m); return; }
      var cx = ax0 + pos.x * aw, cy = ay0 + pos.y * ah;
      items.push({ tipo: 'modulo', m: m, r: { x: cx - 23, y: cy - 35, w: 46, h: 70 }, pared: null });
    });
    var fila = libres.concat(sobran);
    if (fila.length) {
      var iy0 = a.y0 + 14, iy1 = a.y1 - 14, paso = Math.max(20, (iy1 - iy0) / fila.length);
      var alto = Math.max(16, Math.min(paso - 14, 96)), ancho = Math.min(46, alto / 1.35), medio = (a.x0 + a.x1) / 2;
      fila.forEach(function (m, k) { items.push({ tipo: 'modulo', m: m, r: { x: medio - ancho / 2, y: iy0 + k * paso + (paso - alto) / 2, w: ancho, h: alto }, pared: null }); });
    }
  }
  var yv = y1;
  if (!dep) {
    var vids = d.islas.filter(esVidriera);
    if (vids.length) { yv = y1 + ALTO_VIDRIERA; H += ALTO_VIDRIERA; }
    panelesVidriera(vids, x0, x1, y1, yv, geo.puerta, G).forEach(function (x) { items.push({ tipo: 'modulo', m: x.m, r: x.r, pared: 'frente', vidriera: true }); });
  }
  return { tipo: dep ? 'deposito' : 'salon', W: W, H: H, x0: x0, y0: y0, x1: x1, y1: yv, P: P, cuadrado: cuadrado, items: items, numerado: numerado, frente: cq.frente || 'calle' };
}

/** Los módulos con nombre, enteros: en las paredes de costado se ven cortados ("Vidri…"). */
function leyendaNombres(d) {
  var con = d.pared.concat(d.islas, d.dep).filter(function (m) { return m.isla || nombrePropio(m) || queHay(m); });
  if (!con.length) return '';
  return '<p class="mapa-nombres"><b>Con nombre:</b> ' + con.map(function (m) {
    var s = d.sectorDe[m.sector_id], n = m.isla ? m.nombre : nombrePropio(m), q = queHay(m);
    if (esVidriera(m)) return esc(m.nombre + (q ? ' (' + q + ')' : ''));
    return esc((s && s.tipo === 'deposito' ? 'Depósito ' : '') + numeroVista(d, m) + ' · ' + (n && q ? n + ' (' + q + ')' : n || q));
  }).join(' — ') + '</p>';
}

/** Quién tiene qué: una fila por persona, con su color (para mirar). */
function leyendaPersonas(d) {
  var lista = Object.keys(d.colorPersona).map(function (pid) {
    var secs = d.salon.concat(d.deposito).filter(function (s) { return s.responsable_id === pid; });
    var ids = {}; secs.forEach(function (s) { ids[s.id] = true; });
    var nums = d.pared.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.numero; })
      .concat(d.islas.filter(function (m) { return ids[m.sector_id] && !esVidriera(m); }).map(function (m) { return numeroVista(d, m); }));
    var islas = d.islas.filter(function (m) { return ids[m.sector_id] && !esVidriera(m); }).map(function (m) { return m.nombre; });
    var numDep = d.dep.filter(function (m) { return ids[m.sector_id]; }).map(function (m) { return m.numero; });
    var cats = secs.filter(function (s) { return s.tipo === 'deposito' && s.nombre; }).map(function (s) { return s.nombre; });
    var deps = !numDep.length ? [] : depositoNumerado(d) ? ['Depósito ' + rangos(numDep) + (cats.length ? ' (' + cats.join(', ') + ')' : '')]
      : secs.filter(function (s) { return s.tipo === 'deposito'; }).map(function (s) { return 'Depósito ' + s.numero + (s.nombre ? ' (' + s.nombre + ')' : ''); });
    var cubre = secs.map(function (s) { return nombreLista(d.persona[s.suplente_id]); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var partes = (nums.length ? ['Módulos ' + rangos(nums)] : []).concat(islas.length ? [islas.join(', ')] : []).concat(deps);
    return '<div class="mapa-sec"><i style="background:' + d.colorPersona[pid] + '"></i><span><b>' + esc(nombreLista(d.persona[pid]) || 'Alguien que ya no está') + '</b><small>' +
      esc((partes.join(' · ') || 'Sin módulos') + (cubre.length ? ' · lo cubre ' + cubre.join(', ') : '')) + '</small></span></div>';
  });
  /* La vidriera: de todos (SQL 145): cualquiera del local le saca foto, cualquier día. */
  if (d.islas.some(esVidriera)) {
    lista.push('<div class="mapa-sec"><i style="background:' + COLOR_VIDRIERA + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)"></i><span><b>Vidriera · de todos</b><small>' +
      esc(turnoVidrieraTexto(d) + ': cualquiera le saca foto, cuando quiera') + '</small></span></div>');
  }
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
