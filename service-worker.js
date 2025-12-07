const CACHE_NAME = 'juventud-cnc-v1';
const ASSETS = [
'/',
'/index.html',
'/styles.css',
'/app.js',
'/manifest.json'
];


self.addEventListener('install', (e) => {
e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});


self.addEventListener('activate', (e) => {
e.waitUntil(
caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
);
});


self.addEventListener('fetch', (e) => {
const { request } = e;
e.respondWith(
caches.match(request).then(cached => cached || fetch(request).then(res => {
const resClone = res.clone();
caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
return res;
}).catch(() => cached))
);
});
