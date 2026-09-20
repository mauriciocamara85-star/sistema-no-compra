/**
 * VDH · Sistema No Compra — lo que comparten las dos pantallas.
 *
 * Carga antes que el script propio de cada página (index.html / panel.html).
 * Acá vive todo lo que si se duplicara terminaría desincronizándose: la
 * dirección del backend, el tema, los avisos y el arranque de la PWA.
 */

/* ── BACKEND ───────────────────────────────────────────────────────────────
   La interfaz se sirve desde GitHub Pages, fuera de Apps Script, así que no
   existe google.script.run: se le habla al backend por POST. */
var API = 'https://script.google.com/macros/s/AKfycbxI373Id-FVEbyhErLlM5wvvyVApwdEBl2tmg_WfVgvXXpdy6ZgGDB0fGdHBQFHMVqu/exec';

/**
 * El Content-Type va en text/plain A PROPÓSITO. Con application/json el
 * navegador manda antes un pedido de permiso (preflight OPTIONS) que Apps
 * Script no contesta, y la llamada falla siempre. Con text/plain es un pedido
 * simple y sale directo; el backend igual parsea el cuerpo como JSON.
 */
function llamar(cuerpo) {
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(cuerpo)
  }).then(function (r) {
    if (!r.ok) throw new Error('El servidor respondió ' + r.status);
    return r.json();
  });
}

/* ── ALMACENAMIENTO ────────────────────────────────────────────────────────
   Siempre entre try/catch: en una ventana privada o con las cookies
   bloqueadas, tocar localStorage tira excepción y tumbaría la página entera. */
function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch (e) { /* sin memoria, se sigue igual */ }
}
function leer(clave) {
  try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; }
}
function guardarJSON(clave, valor) { guardar(clave, JSON.stringify(valor)); }
function leerJSON(clave, porDefecto) {
  try { return JSON.parse(leer(clave)) || porDefecto; } catch (e) { return porDefecto; }
}

/* ── TEMA ──────────────────────────────────────────────────────────────────
   Arranca en oscuro, como la app de ranking. La elección es a mano y queda
   guardada; el <head> de cada página la aplica antes de pintar para que no
   haya un flash blanco al abrir. */
var TEMA_CLAVE = 'nc_tema';

function aplicarTema(tema) {
  var elegido = tema === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = elegido;
  guardar(TEMA_CLAVE, elegido);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', elegido === 'light' ? '#EEF2F7' : '#0B1220');
  Array.prototype.forEach.call(document.querySelectorAll('.tema-btn'), function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.tema === elegido));
  });
}

function iniciarTema() {
  aplicarTema(leer(TEMA_CLAVE) || 'dark');
  Array.prototype.forEach.call(document.querySelectorAll('.tema-btn'), function (b) {
    b.onclick = function () { aplicarTema(b.dataset.tema); };
  });
}

/* ── TEXTO ─────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Capitaliza para mostrar: 'SAN JUSTO 1' → 'San Justo 1'. */
function bonito(s) {
  return String(s || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
}

var PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

/* ── AVISOS ────────────────────────────────────────────────────────────── */
var ICONO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var ICONO_MAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
var ICONO_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>';

var _toastTimer = null;

/**
 * Mensaje flotante. 'ok' | 'err' | 'info'.
 * Se apoya en un <div class="toast"> que las dos páginas ya tienen.
 */
function avisar(tipo, mensaje) {
  var el = document.getElementById('toast');
  if (!el) return;
  var icono = tipo === 'ok' ? ICONO_OK : (tipo === 'err' ? ICONO_MAL : ICONO_INFO);
  el.className = 'toast ' + tipo + ' visible';
  el.innerHTML = icono + '<span>' + esc(mensaje) + '</span>';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.remove('visible'); }, tipo === 'err' ? 4500 : 3000);
}

/* ── WHATSAPP ──────────────────────────────────────────────────────────────
   Los números se cargan como característica + número, sin el 0 y sin el 15.
   wa.me los quiere con el país adelante y el 9 de celular. */
function normalizarTel(tel) {
  var n = String(tel || '').replace(/\D/g, '').replace(/^0/, '');
  if (!n) return '';
  if (n.indexOf('54') !== 0) n = '549' + n;
  return n;
}

function linkWsp(tel, texto) {
  var n = normalizarTel(tel);
  return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

/* ── PWA ───────────────────────────────────────────────────────────────────
   El service worker sirve para dos cosas: que la app se instale en el celular
   del local y que abra aunque el WiFi del shopping esté caído. La estrategia
   es "red primero": si hay señal se ve siempre la versión publicada, y el
   caché queda sólo de red de contención. */
function iniciarPWA() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;   // abierto a mano desde el disco
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin PWA, la app anda igual */ });
  });
}
