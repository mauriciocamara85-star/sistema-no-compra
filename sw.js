/**
 * VDH · Sistema No Compra — service worker.
 *
 * Sirve para dos cosas concretas:
 *   1. Que la app se pueda instalar en el celular del local (sin service
 *      worker, Android no ofrece "Agregar a pantalla de inicio" como app).
 *   2. Que abra aunque el WiFi del shopping esté caído. Lo que se cargue sin
 *      señal queda en la cola del formulario y se manda al volver.
 *
 * Estrategia: RED PRIMERO. Si hay conexión siempre se ve la versión recién
 * publicada —un git push y los locales ya lo tienen, sin banner de
 * "actualizar"— y el caché queda sólo como red de contención.
 *
 * Al tocar cualquier archivo de la app, subir CACHE: ese cambio de nombre es
 * lo que borra el caché viejo de los celulares.
 */
const CACHE = 'no-compra-v36';

const BASICOS = [
  './',
  './index.html',
  './panel.html',
  './motivos.html',
  './resultados.html',
  './config.html',
  './estilos.css',
  './comun.js',
  /* El catálogo de productos. Es el archivo que MÁS importa tener en caché:
     sin él el buscador y la pistola no resuelven nada, y justamente están
     para funcionar con el WiFi del shopping caído. */
  './catalogo.js',
  /* El generador del código de barras, que dibuja la tarjeta del socio en
     la caja. Se mudó de club/ a la raíz cuando el Club se fue a su propio
     dominio. */
  './codigo.js',
  // Sin esto, la PRIMERA apertura sin señal no encuentra el puente con la
  // base y la pantalla queda sin datos. Las siguientes sí, porque el fetch
  // de abajo guarda todo lo que sale bien.
  './datos.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (evento) => {
  // skipWaiting: la versión nueva toma el control en la próxima apertura, sin
  // esperar a que se cierren todas las pestañas.
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(BASICOS)).catch(() => { /* sin caché, la app anda igual */ })
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;

  // Sólo GET del propio sitio. Los POST a la base no pasan por acá —son de
  // otro origen y además no son GET—, y está bien que así sea: si se
  // cachearan, un registro podría "guardarse" contra el caché y no llegar
  // nunca.
  if (pedido.method !== 'GET') return;
  if (new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    // "cache: no-cache" NO es redundante con la estrategia de red primero:
    // sin esto, fetch() pasa por el caché HTTP del navegador, y GitHub Pages
    // manda Cache-Control de 600 segundos. Durante diez minutos la app se
    // servía sola la versión vieja sin llegar a la red, y el service worker
    // encima guardaba esa copia vieja. Decía "red primero" y hacía lo
    // contrario. Con no-cache va igual a la red pero preguntando por el
    // ETag: si no cambió nada, el servidor contesta 304 y no baja nada.
    fetch(new Request(pedido, { cache: 'no-cache' }))
      .then((respuesta) => {
        // Sólo se guarda lo que salió bien; un 404 cacheado es peor que nada.
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia)).catch(() => {});
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido).then((guardada) => {
        if (guardada) return guardada;
        // Navegación sin señal y sin esa página en el caché: se ofrece el
        // formulario, que es a lo que viene el 95% de las aperturas.
        if (pedido.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
