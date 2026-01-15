// js/main.js
// Router + arranque de módulos (robusto) — compatible con tu index y con ui.js modular
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // Selectores seguros
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  JC.$ = $;
  JC.$$ = $$;

  // ============================================================
  // Service Worker registration + update (PWA)
  // ============================================================
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    // Ajusta el nombre si tu SW se llama distinto
    const swUrl = "./service-worker.js";

    try {
      const reg = await navigator.serviceWorker.register(swUrl, { scope: "./" });

      // Si hay una nueva versión esperando, la activamos (opcional)
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      // Cuando se instala un nuevo SW, forzamos activación (opcional)
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            // Hay update listo
            try {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            } catch {}
          }
        });
      });

      // Recarga suave cuando el SW toma control (para aplicar assets nuevos)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        // Evita loops: una sola recarga
        setTimeout(() => {
          try { location.reload(); } catch {}
        }, 150);
      });
    } catch (e) {
      console.warn("[JC] SW register error", e);
    }
  }

  // ============================================================
  // Tabs helpers
  // ============================================================
  function normalizeTab(t) {
    t = (t || "").trim();
    if (!t) return "inicio";
    return t.replace(/^#/, "");
  }

  function ensureValidTab(tab) {
    const exists = !!document.querySelector(`.view[data-view="${tab}"]`);
    return exists ? tab : "inicio";
  }

  function getTabFromURL() {
    try {
      const u = new URL(location.href);

      // 1) Prioridad: query ?tab=...
      const q = (u.searchParams.get("tab") || "").trim();
      if (q) return normalizeTab(q);

      // 2) Fallback: hash #...
      return normalizeTab(location.hash || "#inicio");
    } catch {
      return normalizeTab(location.hash || "#inicio");
    }
  }

  function setActiveUI(tab) {
    tab = ensureValidTab(tab);

    // Views
    $$(".view").forEach((v) => {
      const k = v.dataset.view;
      v.classList.toggle("active", k === tab);
    });

    // Bottom tabs
    $$(".tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
      b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false");
    });

    // Drawer links
    $$("#drawer [data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    // Accesibilidad: foco al top del contenido
    const main = $("#main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      try {
        main.focus({ preventScroll: true });
      } catch {}
    }
  }

  async function runViewHooks(tab) {
    try {
      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
      if (tab === "miembros-activos") window.initMiembrosView?.();

      if (tab === "box") {
        JC.bots?.mountBox?.();
      }

      if (tab === "eventos") {
        JC.events?.cargarEventos?.({ force: true });
      }

      if (tab === "comunidad" || tab === "foro") {
        JC.community?.cargarFeed?.({ force: true });
      }

      if (tab === "recursos") {
        JC.resources?.initCatefa?.();
        JC.resources?.refresh?.({ force: true });
      }

      if (tab === "judart") {
        JC.judart?.refresh?.({ force: true });
      }
    } catch (e) {
      console.warn("[JC] hook error", tab, e);
    }
  }

  async function activate(tab, { silentUrl = false } = {}) {
    tab = ensureValidTab(normalizeTab(tab));

    // Cierra drawer si está abierto
    try {
      window.jcCloseDrawer?.();
    } catch {}

    setActiveUI(tab);

    // Data-view para estilos
    try {
      document.body.setAttribute("data-view", tab);
    } catch {}

    // URL: mantenemos hash como “estado” principal (compat)
    if (!silentUrl) {
      const newHash = `#${tab}`;
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }

      // Si venimos desde ?tab=..., lo limpiamos para no repetir
      try {
        const u = new URL(location.href);
        if (u.searchParams.has("tab")) {
          u.searchParams.delete("tab");
          history.replaceState(null, "", u.toString());
        }
      } catch {}
    }

    await runViewHooks(tab);

    // Bots por vista
    try {
      JC.bots?.segunVista?.(tab);
      window.botsSegunVista?.(tab);
    } catch {}
  }

  // Exponer para UI / otros módulos
  window.activate = activate;
  JC.activate = activate;

  function bindNav() {
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-tab]");
      if (!el) return;

      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;

      const tab = el.getAttribute("data-tab");
      if (!tab) return;

      e.preventDefault();
      activate(tab);
    });
  }

  async function init() {
    // 0) PWA SW
    registerSW().catch(() => {});

    // 1) UI init
    try {
      if (JC.ui?.init) JC.ui.init();
      else window.jcUI?.initUI?.();
    } catch (e) {
      console.warn("[JC] ui init error", e);
    }

    // 2) Auth init
    try {
      await JC.auth?.init?.();
    } catch (e) {
      console.warn("[JC] auth init error", e);
    }

    // 3) Profile init
    try {
      await JC.profile?.init?.();
    } catch (e) {
      console.warn("[JC] profile init error", e);
    }

    // 4) Init módulos
    try { JC.bots?.init?.(); } catch (e) { console.warn("[JC] bots init error", e); }
    try { JC.events?.init?.(); } catch (e) { console.warn("[JC] events init error", e); }
    try { JC.resources?.init?.(); } catch (e) { console.warn("[JC] resources init error", e); }
    try { JC.community?.init?.(); } catch (e) { console.warn("[JC] community init error", e); }
    try { JC.judart?.init?.(); } catch (e) { console.warn("[JC] judart init error", e); }

    bindNav();

    // 5) Arranque desde URL (?tab o #hash)
    const start = ensureValidTab(getTabFromURL());
    await activate(start, { silentUrl: false });

    // 6) Hashchange
    window.addEventListener("hashchange", () => {
      activate(ensureValidTab(normalizeTab(location.hash)), { silentUrl: true });
    });

    console.log("[JC] Init OK", window.JC_BUILD || "");
  }

  // Arranque seguro
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => init().catch((e) => console.error("[JC] init fatal", e)),
      { once: true }
    );
  } else {
    init().catch((e) => console.error("[JC] init fatal", e));
  }
})();
