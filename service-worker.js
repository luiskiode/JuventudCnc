// Juventud CNC - Service Worker (auto-update / anti-versiones viejas)
// Estrategia:
// - Navegación dentro del scope: Network First (trae lo nuevo si hay red)
// - auth.html (callback magic link): Network ONLY (no cache / no fallback)
// - Core assets: Network First
// - Resto: Stale While Revalidate

const CACHE_VERSION = "2026-01-08.01";
const STATIC_CACHE = `juventud-cnc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `juventud-cnc-runtime-${CACHE_VERSION}`;

// Ajusta si cambias la carpeta del proyecto
const SCOPE_PATH = "/JuventudCnc/";

// ✅ Core de tu app actual (módulos)
const CORE_ASSETS = [
  `${SCOPE_PATH}`,
  `${SCOPE_PATH}index.html`,
  `${SCOPE_PATH}auth.html`,            // ✅ callback magic link (se precachea solo como archivo; fetch será network-only)
  `${SCOPE_PATH}styles.css`,
  `${SCOPE_PATH}manifest.json`,
  `${SCOPE_PATH}supabase-config.js`,
  `${SCOPE_PATH}js/config.js`,
  `${SCOPE_PATH}js/ui.js`,
  `${SCOPE_PATH}js/auth.js`,
  `${SCOPE_PATH}js/bots.js`,
  `${SCOPE_PATH}js/events.js`,
  `${SCOPE_PATH}js/profile.js`,
  `${SCOPE_PATH}js/community.js`,
  `${SCOPE_PATH}js/resources.js`,
  `${SCOPE_PATH}js/main.js`,
  `${SCOPE_PATH}assets/angie-widget-v2.png`,
  `${SCOPE_PATH}icons/icon-192.png`,
  `${SCOPE_PATH}icons/icon-512.png`
];

// Instalar: precache + activar sin esperar
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

// Activar: limpiar caches viejos + tomar control
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

// Permite forzar update desde la app
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Helpers
async function networkFirst(request, { fallbackUrl } = {}) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
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

  // Solo cache same-origin
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Solo manejar dentro del scope del proyecto
  if (!path.startsWith(SCOPE_PATH)) return;

  // ✅ 0) auth.html: Network ONLY (CRÍTICO para magic link)
  // - No cache
  // - No fallback a index.html
  if (path === `${SCOPE_PATH}auth.html`) {
    event.respondWith(fetch(req));
    return;
  }

  // ✅ 1) Navegación: Network First con fallback a index.html
  if (req.mode === "navigate") {
    event.respondWith(
      networkFirst(req, { fallbackUrl: `${SCOPE_PATH}index.html` })
    );
    return;
  }

  // ✅ 2) Core assets: Network First (para actualizar siempre)
  const isCore =
    path === `${SCOPE_PATH}styles.css` ||
    path === `${SCOPE_PATH}manifest.json` ||
    path === `${SCOPE_PATH}supabase-config.js` ||
    path.startsWith(`${SCOPE_PATH}js/`);

  if (isCore) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ✅ 3) Resto: Stale While Revalidate
  event.respondWith(staleWhileRevalidate(req));
});