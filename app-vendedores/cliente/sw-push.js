// Módulo VDH · agregar esto al service worker de la PWA (sw.js).
// Muestra las notificaciones que manda la Edge Function "tick" y abre la pantalla correcta al tocarlas.

self.addEventListener("push", (event) => {
  let aviso = { titulo: "VDH", cuerpo: "", url: "/" };
  try {
    aviso = { ...aviso, ...event.data.json() };
  } catch (_) {
    aviso.cuerpo = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo || undefined,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: aviso.id,          // si llega el mismo aviso dos veces, no se duplica
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          v.navigate(url);
          return v.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
