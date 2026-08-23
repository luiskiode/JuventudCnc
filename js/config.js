/* ============================================================
   config.js — build + helpers globales (robusto y compatible)
   - No pisa window.JC si ya existe (solo extiende)
   - Helpers seguros + logAviso básico (sin reventar si falta el UL)
   - Auto-update por JC_BUILD SIN loops (y sin romper auth.html)
   - NO borra caches a lo loco en cada carga (solo cuando cambia build)
   ============================================================ */

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // BUILD
  // ------------------------------------------------------------------
  const JC_BUILD = String(window.JC_BUILD || "dev");
  window.JC_BUILD = JC_BUILD;

  // ------------------------------------------------------------------
  // GLOBAL NAMESPACE (NO PISAR)
  // ------------------------------------------------------------------
  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // Constantes
  JC.LOCALE = JC.LOCALE || "es-PE";
  JC.TZ = JC.TZ || "America/Lima";
  JC.isDev =
    JC.isDev ??
    (JC_BUILD === "dev" || /localhost|127\.0\.0\.1/.test(location.hostname));

  // ------------------------------------------------------------------
  // HELPERS DOM (defínelos aquí primero; ui.js puede sobre-escribir con los suyos)
  // ------------------------------------------------------------------
  JC.$ =
    JC.$ ||
    function $(q, root = document) {
      try {
        return root.querySelector(q);
      } catch {
        return null;
      }
    };

  JC.$$ =
    JC.$$ ||
    function $$(q, root = document) {
      try {
        return Array.from(root.querySelectorAll(q));
      } catch {
        return [];
      }
    };

  JC.el =
    JC.el ||
    function el(id) {
      return document.getElementById(id);
    };

  // ------------------------------------------------------------------
  // HELPERS: safeText (escape para innerHTML)
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
  // SAFE JSON
  // ------------------------------------------------------------------
  JC.safeParse =
    JC.safeParse ||
    function safeParse(s) {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
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
  // DATE FORMATTERS (con guardas)
  // ------------------------------------------------------------------
  JC.fmtDate =
    JC.fmtDate ||
    function fmtDate(d) {
      try {
        const date = d instanceof Date ? d : new Date(d);
        if (isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat(JC.LOCALE, {
          timeZone: JC.TZ,
          weekday: "long",
          month: "short",
          day: "numeric"
        }).format(date);
      } catch {
        return "—";
      }
    };

  JC.fmtDateTime =
    JC.fmtDateTime ||
    function fmtDateTime(d) {
      try {
        const date = d instanceof Date ? d : new Date(d);
        if (isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat(JC.LOCALE, {
          timeZone: JC.TZ,
          weekday: "short",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
      } catch {
        return "—";
      }
    };

  // ------------------------------------------------------------------
  // TAB NORMALIZER (compat)
  // ------------------------------------------------------------------
  JC.normalizeTab =
    JC.normalizeTab ||
    function normalizeTab(t) {
      const key = String(t || "").trim().replace(/^#/, "");
      if (!key) return "inicio";
      if (key === "avisos") return "judart"; // legacy
      return key;
    };

  // ------------------------------------------------------------------
  // SIMPLE NOTICE LOGGER
  // ------------------------------------------------------------------
  JC.state.avisos = JC.state.avisos || [];

  window.logAviso =
    window.logAviso ||
    function logAviso({ title = "Aviso", body = "", ts = Date.now() } = {}) {
      try {
        const item = {
          title: String(title || "Aviso"),
          body: String(body || ""),
          ts: Number(ts) || Date.now()
        };

        JC.state.avisos.unshift(item);
        JC.state.avisos = JC.state.avisos.slice(0, 50);

        const ul = document.getElementById("avisosList");
        if (!ul) return;

        const li = document.createElement("li");
        li.className = "notice-item";
        li.innerHTML = `
          <div class="notice-title"><strong>${JC.safeText(item.title)}</strong></div>
          <div class="notice-body">${JC.safeText(item.body)}</div>
          <div class="notice-meta">${JC.safeText(
            new Date(item.ts).toLocaleString(JC.LOCALE)
          )}</div>
        `;
        ul.prepend(li);
      } catch {}
    };

  // ------------------------------------------------------------------
  // AUTO-UPDATE por BUILD (anti-versiones viejas)
  // FIXES que aplicamos:
  // 1) No correr en auth.html (callback magic link) para NO interferir
  // 2) Evitar loops: marcar "jc_build_updating" en sessionStorage
  // 3) Borrar caches SOLO si cambia build (y sin bloquear la navegación)
  // ------------------------------------------------------------------
  (function autoUpdateOnNewBuild() {
    const KEY = "jc_build";
    const LOCK = "jc_build_updating";

    // ⚠️ No tocar auth.html (critical)
    try {
      const path = (location.pathname || "").toLowerCase();
      if (path.endsWith("/auth.html")) return;
    } catch {}

    let prev = null;
    try {
      prev = localStorage.getItem(KEY);
    } catch {}

    // Primer guardado (o mismo build)
    if (!prev || prev === JC_BUILD) {
      try {
        localStorage.setItem(KEY, JC_BUILD);
      } catch {}
      try {
        sessionStorage.removeItem(LOCK);
      } catch {}
      return;
    }

    // Si cambió build:
    // evita loops (si ya intentamos esta sesión, no insistir)
    try {
      if (sessionStorage.getItem(LOCK) === "1") {
        // Aun así, actualiza el KEY para estabilizar
        try { localStorage.setItem(KEY, JC_BUILD); } catch {}
        return;
      }
      sessionStorage.setItem(LOCK, "1");
    } catch {}

    // limpiar caches en background (sin await)
    try {
      if ("caches" in window && typeof caches.keys === "function") {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
    } catch {}

    // asegura param v=BUILD (solo una vez)
    let url = null;
    try {
      url = new URL(location.href);
      if (url.searchParams.get("v") !== JC_BUILD) url.searchParams.set("v", JC_BUILD);
    } catch {}

    // guarda build nuevo
    try {
      localStorage.setItem(KEY, JC_BUILD);
    } catch {}

    // navegación dura
    try {
      location.replace(url ? url.toString() : location.href);
    } catch {
      try { location.reload(); } catch {}
    }
  })();

  // ------------------------------------------------------------------
  // LINKS DEFAULT (para resources.js)
  // ------------------------------------------------------------------
  JC.config = JC.config || {};
  JC.config.links = JC.config.links || {
    vaticano: "https://www.vatican.va/content/vatican/es.html",
    biblia: "https://es.jesus.net/biblia/salmo-23"
  };

  console.log("[JC] config loaded", JC_BUILD);
})();