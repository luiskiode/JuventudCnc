// js/main.js
// Router + arranque de módulos (robusto) — compatible con tu index y con ui.js modular
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ = JC.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

  function normalizeTab(t) {
    t = (t || "").trim();
    if (!t) return "inicio";
    return t.replace(/^#/, "");
  }

  function ensureValidTab(tab) {
    // Si el tab no existe como view, volvemos a inicio
    const exists = !!document.querySelector(`.view[data-view="${tab}"]`);
    return exists ? tab : "inicio";
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
    // Hooks opcionales (no rompen si no existen)
    try {
      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
      if (tab === "miembros-activos") window.initMiembrosView?.();

      if (tab === "box") {
        // Si hay chat grande en el Box
        JC.bots?.mountBox?.();
      }

      if (tab === "eventos") {
        // Si events.js expone init/cargar
        JC.events?.cargarEventos?.({ force: true });
      }

      if (tab === "comunidad") {
        JC.community?.cargarFeed?.({ force: true });
      }

      if (tab === "recursos") {
        JC.resources?.initCatefa?.(); // si existe
        JC.resources?.refresh?.({ force: true }); // si existe
      }

      if (tab === "judart") {
        JC.judart?.refresh?.({ force: true });
      }
    } catch (e) {
      console.warn("[JC] hook error", tab, e);
    }
  }

  async function activate(tab, { silentHash = false } = {}) {
    tab = ensureValidTab(normalizeTab(tab));

    // Cierra drawer si está abierto
    try {
      window.jcCloseDrawer?.();
    } catch {}

    setActiveUI(tab);

    // Hash (sin recargar)
    if (!silentHash) {
      const newHash = `#${tab}`;
      if (location.hash !== newHash) history.replaceState(null, "", newHash);
    }

    await runViewHooks(tab);

    // Bots por vista (si existe helper en bots.js)
    try {
      JC.bots?.segunVista?.(tab);
      window.botsSegunVista?.(tab); // compat si existía antes
    } catch {}
  }

  // Exponer para UI / otros módulos
  window.activate = activate;
  JC.activate = activate;

  function bindNav() {
    // Delegación: cualquier elemento con data-tab (tabs + drawer + botones "Ver todos")
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-tab]");
      if (!el) return;

      // Ignora elementos deshabilitados
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;

      const tab = el.getAttribute("data-tab");
      if (!tab) return;

      e.preventDefault();
      activate(tab);
    });
  }

  async function init() {
    // 0) Pequeña señal de arranque (debug)
    // console.log("[JC] main init start", window.JC_BUILD || "");

    // 1) UI init (usa el que exista, sin duplicar)
    try {
      // ui.js suele exponer ambos; llamamos uno solo
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

    // 4) Init módulos (si existen)
    try {
      JC.bots?.init?.();
    } catch (e) {
      console.warn("[JC] bots init error", e);
    }

    try {
      JC.events?.init?.();
    } catch (e) {
      console.warn("[JC] events init error", e);
    }

    try {
      JC.resources?.init?.();
    } catch (e) {
      console.warn("[JC] resources init error", e);
    }

    try {
      JC.community?.init?.();
    } catch (e) {
      console.warn("[JC] community init error", e);
    }

    try {
      JC.judart?.init?.();
    } catch (e) {
      console.warn("[JC] judart init error", e);
    }

    bindNav();

    // 5) Arranca en hash o inicio
    const start = ensureValidTab(normalizeTab(location.hash || "#inicio"));
    await activate(start, { silentHash: true });

    // 6) Hashchange (si lo cambian manual)
    window.addEventListener("hashchange", () => {
      activate(ensureValidTab(normalizeTab(location.hash)), { silentHash: true });
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