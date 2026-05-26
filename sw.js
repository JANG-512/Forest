// Forest Island service worker
// Network-first by design: GitHub Pages deploys should not require Cmd+Shift+R.
const CACHE_NAME = 'forest-island-v19';
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CDN_URLS) {
      try {
        const res = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        await cache.put(url, res);
      } catch (err) {}
    }
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const res = await fetch(e.request, { cache: 'no-store' });
      if (res && res.status === 200) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      if (e.request.mode === 'navigate') return cache.match('./index.html') || cache.match('./');
      throw err;
    }
  })());
});
