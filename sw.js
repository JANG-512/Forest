// Forest Island service worker
// App files are network-only by design: GitHub Pages deploys should not require Cmd+Shift+R.
const BUILD_ID = '20260529-visual-v21';
const CACHE_NAME = `forest-island-cdn-${BUILD_ID}`;
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
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('forest-island') && k !== CACHE_NAME)
        .map(k => caches.delete(k))))
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
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(e.request);
        if (res && res.status === 200) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const freshRequest = new Request(e.request, { cache: 'reload' });
    const res = await fetch(freshRequest);
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  })());
});
