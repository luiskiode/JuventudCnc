/* ============================================================
   config.js — build + helpers globales (robusto y compatible)
   - No pisa window.JC si ya existe (solo extiende)
   - Helpers seguros + logAviso básico
   - Auto-update por JC_BUILD sin loops
   ============================================================ */

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // BUILD / CACHE BUST
  // ------------------------------------------------------------------
  const JC_BUILD = String(window.JC_BUILD || "dev");
  window.JC_BUILD = JC_BUILD;

  (function autoUpdateOnNewBuild() {
    const KEY = "jc_build";
    let prev = null;

    try {
      prev = localStorage.getItem(KEY);
    } catch {}

    // Si cambió el build, limpiamos caches y recargamos con ?v=BUILD
    if (prev && prev !== JC_BUILD) {
      try { sessionStorage.clear(); } catch {}

      if ("caches" in window && typeof caches.keys === "function") {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }

      const url = new URL(location.href);
      // evita loops: si ya está el build en la URL, no forzar replace infinito
      if (url.searchParams.get("v") !== JC_BUILD) url.searchParams.set("v", JC_BUILD);

      try { localStorage.setItem(KEY, JC_BUILD); } catch {}

      // hard nav
      location.replace(url.toString());
      return;
    }

    // primer guardado / mismo build
    try { localStorage.setItem(KEY, JC_BUILD); } catch {}
  })();

  // ------------------------------------------------------------------
  // GLOBAL NAMESPACE (NO PISAR)
  // ------------------------------------------------------------------
  const JC = (window.JC = window.JC || {});

  // Constantes
  JC.LOCALE = JC.LOCALE || "es-PE";
  JC.TZ = JC.TZ || "America/Lima";

  // ------------------------------------------------------------------
  // HELPERS DOM
  // ------------------------------------------------------------------
  JC.$ =
    JC.$ ||
    function $(q, root = document) {
      try { return root.querySelector(q); } catch { return null; }
    };

  JC.$$ =
    JC.$$ ||
    function $$(q, root = document) {
      try { return Array.from(root.querySelectorAll(q)); } catch { return []; }
    };

  JC.el =
    JC.el ||
    function el(id) {
      return document.getElementById(id);
    };

  // ------------------------------------------------------------------
  // HELPERS: safeText (ESCAPE real para innerHTML)
  // ------------------------------------------------------------------
  JC.safeText =
    JC.safeText ||
    function safeText(v) {
      return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

  // ------------------------------------------------------------------
  // RANDOM PICK
  // ------------------------------------------------------------------
  JC.pick =
    JC.pick ||
    function pick(arr, fallback = "") {
      if (!Array.isArray(arr) || !arr.length) return fallback;
      return arr[Math.floor(Math.random() * arr.length)];
    };

  // ------------------------------------------------------------------
  // DATE FORMATTERS
  // ------------------------------------------------------------------
  JC.fmtDate =
    JC.fmtDate ||
    function fmtDate(d) {
      const date = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat(JC.LOCALE, {
        timeZone: JC.TZ,
        weekday: "long",
        month: "short",
        day: "numeric"
      }).format(date);
    };

  JC.fmtDateTime =
    JC.fmtDateTime ||
    function fmtDateTime(d) {
      const date = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat(JC.LOCALE, {
        timeZone: JC.TZ,
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    };

  // ------------------------------------------------------------------
  // SAFE JSON
  // ------------------------------------------------------------------
  JC.safeParse =
    JC.safeParse ||
    function safeParse(s) {
      try { return JSON.parse(s); } catch { return null; }
    };

  // ------------------------------------------------------------------
  // TAB NORMALIZER (compat)
  // ------------------------------------------------------------------
  JC.normalizeTab =
    JC.normalizeTab ||
    function normalizeTab(t) {
      const key = String(t || "").trim().replace(/^#/, "");
      if (!key) return "inicio";
      if (key === "avisos") return "judart"; // compat legacy
      return key;
    };

  // ------------------------------------------------------------------
  // SIMPLE NOTICE LOGGER (para notificaciones / debug)
  // - si existe #avisosList lo pinta
  // - también deja en memoria JC.state.avisos
  // ------------------------------------------------------------------
  JC.state = JC.state || {};
  JC.state.avisos = JC.state.avisos || [];

  window.logAviso =
    window.logAviso ||
    function logAviso({ title = "Aviso", body = "", ts = Date.now() } = {}) {
      try {
        const item = { title: String(title || "Aviso"), body: String(body || ""), ts: Number(ts) || Date.now() };
        JC.state.avisos.unshift(item);
        JC.state.avisos = JC.state.avisos.slice(0, 50);

        const ul = document.getElementById("avisosList");
        if (!ul) return;

        const li = document.createElement("li");
        li.className = "notice-item";
        li.innerHTML = `
          <div class="notice-title"><strong>${JC.safeText(item.title)}</strong></div>
          <div class="notice-body">${JC.safeText(item.body)}</div>
          <div class="notice-meta">${JC.safeText(new Date(item.ts).toLocaleString(JC.LOCALE))}</div>
        `;
        ul.prepend(li);
      } catch {}
    };

  // ------------------------------------------------------------------
  // DEV FLAG (opcional)
  // ------------------------------------------------------------------
  JC.isDev = JC.isDev ?? (JC_BUILD === "dev" || /localhost|127\.0\.0\.1/.test(location.hostname));

  console.log("[JC] config loaded", JC_BUILD);
})();