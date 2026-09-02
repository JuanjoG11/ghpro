const CACHE_NAME = 'gh-pro-v2.0.4';
const STATIC_ASSETS = [
  '/index.html',
  '/app.js',
  '/supabase.js',
  '/manifest.json',
];

// Archivos JS/HTML propios: siempre network-first para tener siempre la versión nueva
const NETWORK_FIRST = ['/index.html', '/app.js', '/supabase.js'];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static assets, network-first for everything else
self.addEventListener('fetch', (event) => {
  // Solo interceptar GET; ignorar chrome-extension y otros esquemas no-http
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Peticiones a Supabase: siempre ir a la red, sin cachear
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Para archivos HTML y JS propios usar network-first
      const isHTML = event.request.headers.get('accept') &&
                     event.request.headers.get('accept').includes('text/html');
      const reqPath = new URL(event.request.url).pathname;
      const isNetworkFirst = isHTML || NETWORK_FIRST.includes(reqPath);

      if (isNetworkFirst) {
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached || new Response('Sin conexión', { status: 503 }));
      }

      // Para el resto: cache-first (JS, CSS, imágenes — cambian poco)
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const reqUrl = new URL(event.request.url);
        const cacheble =
          response &&
          response.status === 200 &&
          response.type !== 'opaque' &&
          response.type !== 'error' &&
          (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:');

        if (cacheble) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html').then((r) => r || new Response('Sin conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          }));
        }
        return new Response('', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body:    data.body    || 'Tienes documentos próximos a vencer',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/index.html#alertas' },
    actions: [
      { action: 'view',    title: 'Ver alertas' },
      { action: 'dismiss', title: 'Descartar'   },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'GH Pro – Alerta', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
