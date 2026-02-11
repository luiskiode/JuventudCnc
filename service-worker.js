// Juventud CNC - Service Worker (ESTABLE / SIN LOOPS)

const CACHE_VERSION = "2026-02-02.02";
const STATIC_CACHE = `jc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `jc-runtime-${CACHE_VERSION}`;

const SCOPE_PATH = "/JuventudCnc/";

// ==========================================
// INSTALL (sin skipWaiting automático)
// ==========================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing version", CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then(() => {
      return Promise.resolve();
    })
  );
});

// ==========================================
// ACTIVATE (limpia versiones viejas)
// ==========================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating version", CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.includes(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
});

// ==========================================
// FETCH
// ==========================================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // ❗ auth.html nunca cache
  if (url.pathname.endsWith("auth.html")) {
    event.respondWith(fetch(req));
    return;
  }

  // 🧠 Navegación = Network First
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, copy);
          });
          return res;
        })
        .catch(() => caches.match(`${SCOPE_PATH}index.html`))
    );
    return;
  }

  // ⚡ JS / CSS / Core = Network First
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, copy);
          });
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 🖼 Assets = Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(req, copy);
        });
        return res;
      });
    })
  );
});