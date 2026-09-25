/**
 * VDH · Sistema No Compra — lo que comparten las dos pantallas.
 *
 * Carga antes que el script propio de cada página (index.html / panel.html).
 * Acá vive todo lo que si se duplicara terminaría desincronizándose: la
 * dirección del backend, el tema, los avisos y el arranque de la PWA.
 */

/* ── LA BASE ───────────────────────────────────────────────────────────
   Acá vivía `llamar()`, que le hablaba al backend de Apps Script. Ya no
   existe ninguno de los dos: todo pasa por `base`, en datos.js.

   La dirección del backend viejo se fue con él. Si algún día hace falta
   mirar cómo era, está en el historial de git. */

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
  if (meta) meta.setAttribute('content', elegido === 'light' ? '#E8EAED' : '#121315');
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

/**
 * Capitaliza para mostrar: 'MAR DEL PLATA' → 'Mar del Plata'.
 *
 * Las palabras cortas que unen —de, del, la, los, y— van en minúscula salvo
 * que arranquen el nombre. Poner mayúscula después de cada espacio dejaba
 * "Mar Del Plata", "Villa Del Parque" y "Lomas De Zamora", que se leen como
 * un cartel de oferta. Misma corrección que en club/club.js, que tiene su
 * propia copia porque las páginas del cliente no cargan este archivo.
 */
var MENUDAS = { de: 1, del: 1, la: 1, las: 1, los: 1, el: 1, y: 1 };

/* Las siglas se quedan como son. Hoy es una sola —el local del shopping
   DOT— pero sin esto quedaba "Dot", que parece un error de tipeo. */
var SIGLAS = { dot: 'DOT' };

function bonito(s) {
  return String(s || '').toLowerCase().split(/(\s+|-)/).map(function (p, i) {
    if (!/[a-záéíóúñ]/.test(p)) return p;
    if (SIGLAS[p]) return SIGLAS[p];
    if (i > 0 && MENUDAS[p]) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join('');
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

/**
 * ¿Este teléfono sirve?  Devuelve el problema, o vacío si está bien.
 *
 * Un celular argentino tiene 10 dígitos (característica + número), sin el 0
 * y sin el 15. Se avisa pero no se bloquea con menos: hay números que no
 * siguen la regla y es peor perder el registro que rechazarlo.
 *
 * Vive acá y no en una pantalla porque lo usan DOS: el formulario al
 * cargar un cliente, y la pantalla del descuento al buscarlo. Dos copias
 * de la misma regla se separan el día que alguien ajusta una sola.
 */
function revisarTelefono(t) {
  var n = String(t).replace(/\D/g, '');
  if (!n) return 'Falta el WhatsApp del cliente.';
  if (n.length < 8) return 'Ese número quedó corto. Revisalo.';
  return '';
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
