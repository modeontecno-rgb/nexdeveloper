/* Trabajador de segundo plano de NexDeveloper: avisos push y caché mínima. */

const CACHE = "nexdev-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.allSettled(nombres.filter((n) => n.startsWith("nexdev-shell-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/* Red primero. Nunca se cachean las llamadas al servidor de datos. */
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  evento.respondWith(
    (async () => {
      try {
        const respuesta = await fetch(peticion);
        if (respuesta && respuesta.ok && respuesta.type === "basic") {
          const cache = await caches.open(CACHE);
          await cache.put(peticion, respuesta.clone());
        }
        return respuesta;
      } catch (error) {
        const guardada = await caches.match(peticion);
        if (guardada) return guardada;
        if (peticion.mode === "navigate") {
          const inicio = await caches.match("/");
          if (inicio) return inicio;
        }
        throw error;
      }
    })(),
  );
});

self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch (error) {
    datos = { titulo: "NexDeveloper", cuerpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = datos.titulo || datos.title || "NexDeveloper";
  const cuerpo = datos.cuerpo || datos.body || "";
  const url = datos.url || "/avisos";
  const etiqueta = datos.id || datos.tag || String(Date.now());

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/iconos/icono-192.png",
      badge: "/iconos/icono-96.png",
      lang: "es",
      data: { url },
      tag: etiqueta,
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/avisos";

  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if ("focus" in ventana) {
          await ventana.focus();
          if ("navigate" in ventana) {
            try {
              await ventana.navigate(destino);
            } catch (error) {
              /* la ventana puede rechazar la navegación */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
