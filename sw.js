const CACHE_NAME = 'comercio-app-v1';

// Archivos estáticos principales que sí queremos en caché local
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // Si tienes CSS o JS externos locales (ej: ./styles.css), agrégalos acá
];

// 1. Instalación: Guardar recursos estáticos básicos
self.addEventListener('install', event => {
  self.skipWaiting(); // Forzar activación inmediata de la versión nueva
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// 2. Activación: Limpieza de cachés antiguas si cambias la versión
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

  // REGLA CRÍTICA: NO cachear consultas a Supabase ni peticiones de la API
  if (url.hostname.includes('supabase.co') || event.request.method !== 'GET') {
    return; // Deja que pase directamente a la red sin interceptar
  }

  // Para el resto de archivos estáticos (HTML, JS local, manifiesto):
  // Estrategia: Red primero, respaldo en Caché si no hay conexión (Network First)
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Si responde bien la red, actualizamos la caché y devolvemos la respuesta fresca
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si no hay internet, devolvemos la versión guardada en caché
        return caches.match(event.request);
      })
  );
});
