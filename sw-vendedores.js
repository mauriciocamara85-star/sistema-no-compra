/**
 * Impecable · service worker propio de la app de los vendedores.
 *
 * Es aparte del sw.js del Sistema No Compra a propósito: así la app se
 * instala como otra app (su scope es "vendedores…") y las notificaciones no
 * dependen de un archivo que comparten todas las demás pantallas.
 *
 * Sirve para tres cosas:
 *   1. Que se pueda instalar en el celular.
 *   2. Que abra aunque no haya señal (lo último que se vio queda guardado).
 *   3. Las notificaciones: muestra el aviso y, al tocarlo, abre la pantalla
 *      que corresponde (#/tareas, #/revisar…).
 *
 * Estrategia: RED PRIMERO, como el del No Compra. Al tocar la app, subir CACHE.
 */
const CACHE = 'impecable-v3';

const BASICOS = [
  './vendedores.html',
  './vendedores.js',
  './impecable-comun.js',
  './impecable.css',
  './datos.js',
  './vendedores.webmanifest',
  './impecable-192.png',
  './impecable-512.png'
];

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).catch(() => { /* sin caché, la app anda igual */ }));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('impecable-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  // Sólo GET del propio sitio: las llamadas a la base nunca pasan por el caché.
  if (pedido.method !== 'GET') return;
  if (new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(
    // "no-cache": va a la red preguntando por el ETag (GitHub Pages cachea 10 minutos).
    fetch(new Request(pedido, { cache: 'no-cache' }))
      .then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia)).catch(() => {});
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido).then((guardada) => {
        if (guardada) return guardada;
        if (pedido.mode === 'navigate') return caches.match('./vendedores.html');
        return Response.error();
      }))
  );
});

// El aviso que manda la base (Edge Function tick): { id, titulo, cuerpo, url }.
self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch (e) { d = { titulo: evento.data && evento.data.text() }; }
  evento.waitUntil(self.registration.showNotification(d.titulo || 'Impecable', {
    body: d.cuerpo || '',
    icon: 'impecable-192.png',
    badge: 'impecable-192.png',
    tag: d.id || undefined,
    data: { url: d.url || '/hoy' }
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL('vendedores.html#' + String((evento.notification.data && evento.notification.data.url) || '/hoy'), self.registration.scope).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.indexOf('vendedores.html') > -1 && 'focus' in v) {
          v.navigate(destino).catch(() => {});
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
