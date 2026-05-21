// Forest Island — Service Worker v2
const CACHE_NAME = 'forest-island-v2';
const CORE_URLS = ['./', './index.html', './manifest.json', './icon.svg', './icon-maskable.svg'];
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache same-origin assets
    await cache.addAll(CORE_URLS);
    // Cache CDN resources with no-cors (opaque responses)
    for (const url of CDN_URLS) {
      try {
        const res = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, res);
      } catch (err) {
        console.warn('[SW] Could not pre-cache CDN:', url, err.message);
      }
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

self.addEventListener('fetch', e => {
  // Skip non-GET and browser-extension requests
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful same-origin responses
        if (res && res.status === 200 && new URL(e.request.url).origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: return cached index for navigation requests
        if (e.request.mode === 'navigate') return caches.match('./');
      });
    })
  );
});
