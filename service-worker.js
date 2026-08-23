// Juventud CNC - Service Worker (ESTABLE / SIN LOOPS)
// ✅ Evita cachear videos (reduce ERR_CACHE_READ_FAILURE)
// ✅ Mantiene Network First para navegación y core
// ✅ Assets: cache-first, pero excluye multimedia pesada

const CACHE_VERSION = "2026-02-02.02";
const STATIC_CACHE = `jc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `jc-runtime-${CACHE_VERSION}`;

const SCOPE_PATH = "/JuventudCnc/";

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const MEDIA_EXT = [...VIDEO_EXT, ".mp3", ".wav", ".ogg"];

// ==========================================
// INSTALL (sin skipWaiting automático)
// ==========================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing version", CACHE_VERSION);
  event.waitUntil(caches.open(STATIC_CACHE).then(() => Promise.resolve()));
});

// ==========================================
// ACTIVATE (limpia versiones viejas)
// ==========================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating version", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.includes(CACHE_VERSION)).map((k) => caches.delete(k)));
      // Toma control sin esperar navegación nueva (no causa loops por sí solo)
      await self.clients.claim();
    })()
  );
});

// ==========================================
// FETCH
// ==========================================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo manejamos nuestro origin y dentro del scope
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // ❗ auth.html nunca cache
  if (url.pathname.endsWith("auth.html")) {
    event.respondWith(fetch(req));
    return;
  }

  // 🚫 Nunca cachear multimedia pesada (evita errores de cache en algunos equipos)
  const lowerPath = url.pathname.toLowerCase();
  if (MEDIA_EXT.some((ext) => lowerPath.endsWith(ext))) {
    // Forzamos red y evitamos usar cache del browser tanto como podamos
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 🧠 Navegación = Network First
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(`${SCOPE_PATH}index.html`))
    );
    return;
  }

  // ⚡ JS / CSS / JSON = Network First
  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".css") || lowerPath.endsWith(".json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 🖼 Assets = Cache First (pero NO cachear respuestas 304/opaque raras)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // Solo cachea respuestas OK
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});