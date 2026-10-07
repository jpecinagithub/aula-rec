/* AulaRec service worker: la interfaz funciona offline una vez instalada.
   La captura de pantalla depende del navegador y puede no estar disponible offline. */

const CACHE = 'aularec-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim())
      .catch(() => undefined),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || Promise.reject(new Error('offline'))),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached || Promise.reject(new Error('offline')));
    }),
  );
});
