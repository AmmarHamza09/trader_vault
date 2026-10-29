// Intentionally does NOT cache or intercept anything. A registered service
// worker is enough to satisfy "installable PWA" criteria on its own — this
// app's data is live/real-time (Convex + Clerk), so silently serving a
// cached page or asset risked showing a stale JS bundle after a deploy,
// which looked like "works sometimes, not others." Every request just
// passes straight through to the network.
const OLD_CACHES = ['tradevault-shell-v1'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => OLD_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- Push notifications (TradingView / MT5 alerts) ----
self.addEventListener('push', (event) => {
  let data = { title: 'TraderVault', body: '', tag: 'tradevault' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {
    /* plain text push */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/favicon-32.png',
      vibrate: [200, 100, 200],
      renotify: true,
      requireInteraction: false,
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    })
  );
});
