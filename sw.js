const CACHE_NAME = 'comercio-app-v1';

// Archivos estáticos principales que queremos precachear
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Instalación: Guardar recursos estáticos básicos tolerando posibles fallos puntuales
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url))
      );
    })
  );
});

// 2. Activación: Limpieza de cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia de peticiones (Fetch)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar métodos que no sean GET
  if (event.request.method !== 'GET') return;

  // REGLA CRÍTICA: Ignorar Supabase y servicios de placeholders/APIs externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('via.placeholder.com')
  ) {
    return; // Pasa directamente a la red sin pasar por el SW
  }

  // Estrategia Network First para recursos locales
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Solo guardamos en caché si la respuesta es válida y pertenece a nuestro origen o esquema HTTP/HTTPS
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Intentar responder desde caché si la red falla
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si es una navegación HTML y no hay red ni caché, devolver index.html guardado
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
