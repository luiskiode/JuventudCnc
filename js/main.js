// js/main.js
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

  function setActiveUI(tab) {
    // views
    $$(".view").forEach((v) => {
      const k = v.dataset.view;
      v.classList.toggle("active", k === tab);
    });

    // bottom tabs
    $$(".tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    // drawer links
    $$("#drawer [data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  async function runViewHooks(tab) {
    // Hooks opcionales (no rompen si no existen)
    try {
      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
      if (tab === "miembros-activos") window.initMiembrosView?.();
      if (tab === "box") {
        // Si tienes mount del chat grande
        JC.bots?.mountBox?.();
      }
      if (tab === "eventos") {
        // refresh placeholder
        JC.events?.cargarEventos?.({ force: true });
      }
      if (tab === "comunidad") {
        JC.community?.cargarFeed?.({ force: true });
      }
    } catch (e) {
      console.warn("[JC] hook error", tab, e);
    }
  }

  async function activate(tab, { silentHash = false } = {}) {
    tab = normalizeTab(tab);

    // Cierra drawer si está abierto
    try { window.jcCloseDrawer?.(); } catch {}

    setActiveUI(tab);

    // hash
    if (!silentHash) {
      const newHash = `#${tab}`;
      if (location.hash !== newHash) history.replaceState(null, "", newHash);
    }

    await runViewHooks(tab);
  }

  // Exponer compat
  window.activate = activate;
  JC.activate = activate;

  function bindNav() {
    // Delegación: cualquier elemento con data-tab
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-tab]");
      if (!el) return;

      const tab = el.getAttribute("data-tab");
      if (!tab) return;

      e.preventDefault();
      activate(tab);
    });

    // “Ver todos” (link en eventos home)
    document.addEventListener("click", (e) => {
      const a = e.target?.closest?.('a[data-tab]');
      if (!a) return;
      e.preventDefault();
      activate(a.dataset.tab);
    });
  }

  async function init() {
    // 1) UI init (usa el que exista)
    try {
      // Si ui.js expone JC.ui.init()
      JC.ui?.init?.();
      // Si ui.js expone window.jcUI.initUI()
      window.jcUI?.initUI?.();
    } catch (e) {
      console.warn("[JC] ui init error", e);
    }

    // 2) Auth init (si existe)
    try {
      await JC.auth?.init?.();
    } catch (e) {
      console.warn("[JC] auth init error", e);
    }

    // 3) Profile init (si existe)
    try {
      await JC.profile?.init?.();
    } catch (e) {
      console.warn("[JC] profile init error", e);
    }

    // 4) Módulos
    try { JC.bots?.init?.(); } catch {}
    try { JC.events?.init?.(); } catch {}
    try { JC.resources?.init?.(); } catch {}
    try { JC.community?.init?.(); } catch {}
    try { JC.judart?.init?.(); } catch {} // por si existe

    bindNav();

    // Arranca en hash o inicio
    const start = normalizeTab(location.hash || "#inicio");
    await activate(start, { silentHash: true });

    // Hashchange (si cambian manual)
    window.addEventListener("hashchange", () => {
      activate(normalizeTab(location.hash), { silentHash: true });
    });

    console.log("[JC] Init OK", window.JC_BUILD || "");
  }

  // Arranque seguro
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init().catch(console.error), { once: true });
  } else {
    init().catch(console.error);
  }
})();