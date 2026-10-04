const CACHE_NAME = 'barber-saas-cache-v4';
// The saved home page, plus a plain "no internet" page shown instead of the browser's own error screen.
const OFFLINE_URL = '/offline.html';
const urlsToCache = [
  OFFLINE_URL,
  '/icon-192.png'
];

self.addEventListener('install', (event) => {
  // Activate a newly installed SW immediately instead of waiting for every
  // open tab to close — without this, updates sit dormant indefinitely.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // These two must be saved: without them the worker is useless, so installing it fails (and is retried).
      await cache.addAll(urlsToCache);
      // The home page is a bonus: if it is slow or failing right now, that must never stop the app from installing.
      try { await cache.add('/'); } catch (e) {}
    })
  );
});

self.addEventListener('activate', (event) => {
  // Delete any cache left over from a previous version — otherwise a stale
  // cached '/' page is served cache-first forever with no way to refresh it.
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Always ask the network first, so a new version of the app reaches everyone straight after a deploy.
// If the phone is offline (or the signal drops), fall back to a saved copy, and for a page visit to our friendly
// "no internet" page. Without this the browser's own error screen appears, which looks like a broken app, and older
// phones refuse to install a site that cannot answer a page request while offline.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only reads are handled here; bookings and other writes go straight to the network so they can fail honestly.
  if (request.method !== 'GET') return;
  event.respondWith(
    fetch(request).catch(async () => {
      const saved = await caches.match(request);
      if (saved) return saved;
      if (request.mode === 'navigate') {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return Response.error();
    })
  );
});

// ---- Push notifications (new booking, customer cancelled / rescheduled) ----
self.addEventListener('push', (event) => {
  let data = { title: 'BarberSaaS', body: '', url: '/dashboard/appointments' };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
      tag: 'booking-update',
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
