/* ═══════════════════════════════════════════════════════════════════════════
   Este service worker no sirve el Club: lo DESINSTALA.

   El Club se mudó a vdhclub.com el 25/09/2026. Los teléfonos donde se probó
   la versión de acá tienen guardado el service worker viejo, y ése servía las
   páginas desde su propio caché. Sin esto, esos teléfonos seguirían viendo la
   copia vieja para siempre: nunca llegarían a pedirle nada a la red, así que
   nunca verían la redirección.

   El archivo no se borra del repositorio por la misma razón. Un 404 acá no
   desinstala nada: deja el service worker viejo instalado y andando.

   Qué hace, en orden: se activa sin esperar, borra los cachés del Club, se
   da de baja a sí mismo y recarga las pestañas abiertas — que ya sin él van
   derecho a la red, se encuentran la redirección y se van al dominio nuevo.

   Y no tiene 'fetch': sin ese oyente el navegador va solo a la red, que es
   exactamente lo que se busca mientras esto termina de limpiar.
   ═══════════════════════════════════════════════════════════════════════════ */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(
          nombres
            .filter(function (n) { return n.indexOf('vdh-club-') === 0; })
            .map(function (n) { return caches.delete(n); })
        );
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (pestanas) {
        pestanas.forEach(function (p) { p.navigate(p.url); });
      })
      .catch(function () { /* si algo falla, igual quedó dado de baja */ })
  );
});
