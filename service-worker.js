// Juventud CNC - Service Worker (actualización automática / anti-versiones viejas)
// Versión: 2025-12-20.02
// Estrategia:
// - Navegación + archivos core: Network First (si hay red, siempre trae lo nuevo)
// - Resto de recursos locales: Stale While Revalidate (rápido + se actualiza en segundo plano)

const CACHE_VERSION = "2025-12-20.02";
const STATIC_CACHE = `juventud-cnc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `juventud-cnc-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/angie-widget-v2.png"
];

// Instalar: precache + activar sin esperar
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

// Activar: limpiar caches viejos + tomar control de clientes
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Permite forzar update desde la app si lo deseas
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Helpers
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await caches.match("./index.html");
      if (offline) return offline;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (res) => {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo cacheamos lo mismo-origen (evita cachear Supabase/CDNs por accidente)
  if (url.origin !== self.location.origin) {
    return;
  }

  const path = url.pathname;

  // 1) Navegación: SIEMPRE network-first para evitar versiones viejas pegadas
  if (req.mode === "navigate" || path === "/" || path.endsWith("/index.html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) Archivos core: network-first (styles/app/manifest) para que se actualicen
  if (path.endsWith("/styles.css") || path.endsWith("/app.js") || path.endsWith("/manifest.json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) Resto: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});
