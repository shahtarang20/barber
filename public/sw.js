const CACHE_NAME = 'barber-saas-cache-v6';
// Saved copies of the app's own scripts, styles, fonts and icons (nothing personal ever goes in here).
const STATIC_CACHE = 'barber-static-v1';
// A plain "no internet" page, shown instead of the browser's own error screen when a page cannot be reached.
const OFFLINE_URL = '/offline.html';
const urlsToCache = [
  OFFLINE_URL,
  '/icon-192.png'
];

self.addEventListener('install', (event) => {
  // Activate a newly installed SW immediately instead of waiting for every
  // open tab to close — without this, updates sit dormant indefinitely.
  self.skipWaiting();
  // Only two tiny files are saved. The browser will not offer "install this app" until the worker is ready, so on a slow
  // mobile connection anything bigger here (like the whole home page) delays the install button by many seconds.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', (event) => {
  // Delete any cache left over from a previous version — otherwise a stale
  // cached '/' page is served cache-first forever with no way to refresh it.
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
            .map((name) => caches.delete(name))
        )
      ),
      // Lets the browser start the page request while this worker is still waking up (saves 50-300 ms on a slow phone).
      self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(() => {}) : Promise.resolve(),
    ]).then(() => self.clients.claim())
  );
});

// Keeps the saved copies from growing without limit (oldest saved first).
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

// Files that are the same for every visitor and never carry anyone's data: the app's own scripts/styles/fonts
// (named by their content, so a saved copy is never out of date), the icons, and the resized pictures.
function staticKind(url) {
  if (url.origin !== self.location.origin) return null;
  const p = url.pathname;
  // Production file names are a short content hash (e.g. 0bma92pht_c97.js), so a saved copy can never be stale.
  // (A development server's longer, readable names do not match, so they are never saved.)
  if (/^\/_next\/static\/(chunks\/[a-z0-9_-]{8,20}\.(js|css)|media\/[a-z0-9._-]{12,48}\.(woff2?|png|jpe?g|svg|webp|avif))$/.test(p)) return 'immutable';
  if (p === '/manifest.json' || p === '/apple-touch-icon.png' || /^\/icon-[\w-]+\.png$/.test(p)) return 'swr';
  if (p === '/_next/image') return 'swr';
  return null;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isCacheable(response)) { cache.put(request, response.clone()); trim(cache, 200); }
  return response;
}

// Shows the saved copy at once and refreshes it in the background for next time.
async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (isCacheable(response)) { cache.put(request, response.clone()); trim(cache, 200); }
    return response;
  });
  if (hit) { event.waitUntil(network.catch(() => {})); return hit; }
  return network;
}

// Pages and data (everything signed-in people see) always go to the network and are never saved: a barber's
// appointments or another person's details must not sit in a shared cache. Only a page visit with no internet
// gets our friendly "no internet" page. Requests we do not handle here are left to the browser untouched,
// so data calls do not pay for an extra hop through this worker.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only reads are handled here; bookings and other writes go straight to the network so they can fail honestly.
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        return preload || (await fetch(request));
      } catch (e) {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }
    })());
    return;
  }

  if (request.headers.has('range')) return; // video / audio streaming
  const kind = staticKind(new URL(request.url));
  if (kind === 'immutable') {
    event.respondWith(cacheFirst(request).catch(() => Response.error()));
  } else if (kind === 'swr') {
    event.respondWith(staleWhileRevalidate(event).catch(() => Response.error()));
  }
});

// ---- Push notifications (new booking, customer cancelled / rescheduled) ----
self.addEventListener('push', (event) => {
  let data = { title: 'BarberSaaS', body: '', url: '/dashboard/appointments', tag: 'booking-update' };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
      tag: data.tag || 'booking-update',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard/appointments';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
