// Self-destroying service worker.
// The app no longer registers a service worker. This file only exists so that
// browsers which still have an OLD service worker registered will, on their
// next update check, fetch this and permanently unregister it + clear caches,
// so they can never be pinned to a stale build again.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }
    try { await self.registration.unregister(); } catch (e) { /* ignore */ }
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
