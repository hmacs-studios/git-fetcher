const CACHE_NAME = 'medmacs-1772zba';
const PRECACHE_URLS = ["/","index.html","assets/index-CSIIfZmE.css","assets/index-SKkfIv-G.js","assets/react-vendor--CgM7R3s.js","assets/commonjs-Cpj98o6Y.js","assets/capacitor-MBChqShc.js","assets/query-DIFTfD2A.js","assets/supabase-BkQ1WA2k.js","assets/ui-vendor-CbK4XRml.js","assets/motion-DKYyQvtj.js"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html').then(response => response || caches.match('/'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});