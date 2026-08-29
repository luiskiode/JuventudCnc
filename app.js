/* ============================================================
   app.js — Juventud CNC (Dynamic Views & Router Bridge)
   ============================================================ */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Namespace + helpers base
  // ------------------------------------------------------------
  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};
  JC.flags = JC.flags || {};
  JC.loadedViews = JC.loadedViews || new Set();

  JC.$ = JC.$ || function (sel, root = document) {
    try { return root.querySelector(sel); } catch { return null; }
  };

  JC.$$ = JC.$$ || function (sel, root = document) {
    try { return Array.from(root.querySelectorAll(sel)); } catch { return []; }
  };

  JC.safeText = JC.safeText || function (v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function lsGet(key, fallback = "") {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch { return fallback; }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch { return false; }
  }

  // Logger global
  window.logAviso = window.logAviso || function ({ title = "Aviso", body = "" } = {}) {
    try {
      const ul = document.getElementById("avisosList");
      if (!ul) return;
      const li = document.createElement("li");
      li.className = "notice-item";
      li.innerHTML = `
        <div class="notice-title"><strong>${JC.safeText(title)}</strong></div>
        <div class="notice-body">${JC.safeText(body)}</div>
        <div class="notice-meta muted small">${JC.safeText(new Date().toLocaleString())}</div>
      `;
      ul.prepend(li);
      const items = ul.querySelectorAll("li");
      if (items.length > 40) items[items.length - 1].remove();
    } catch {}
  };

  // ------------------------------------------------------------
  // Motor de Carga Dinámica (Fetch Views)
  // ------------------------------------------------------------
  JC.loadView = async function (tab) {
    const container = document.getElementById("app-container") || document.querySelector("main");
    if (!container) return false;

    // Si la vista ya existe en el DOM estático, no hacemos fetch
    let viewEl = document.querySelector(`.view[data-view="${tab}"]`);
    if (viewEl) return true;

    // Si ya intentó cargarse y falló, evitamos loops
    if (JC.loadedViews.has(tab)) return false;

    try {
      const res = await fetch(`views/${tab}.html`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const tempDiv = document.createElement("div");
      tempDiv.className = "view";
      tempDiv.dataset.view = tab;
      tempDiv.innerHTML = html;

      container.appendChild(tempDiv);
      JC.loadedViews.add(tab);
      return true;
    } catch (err) {
      console.warn(`[JC Router] No se pudo cargar la vista dinámica 'views/${tab}.html':`, err);
      return false;
    }
  };

  // ------------------------------------------------------------
  // Router SPA & Activación de Pestañas
  // ------------------------------------------------------------
  function normalizeTab(t) {
    t = (t || "").trim().replace(/^#/, "");
    return t || "inicio";
  }

  async function activate(tab) {
    tab = normalizeTab(tab);

    // Intenta cargar la vista dinámica si no está presente
    await JC.loadView(tab);

    let view = document.querySelector(`.view[data-view="${tab}"]`);
    if (!view) {
      tab = "inicio";
      view = document.querySelector(`.view[data-view="inicio"]`);
    }

    // Toggle de vistas y navegación
    JC.$$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === tab));
    JC.$$(".tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    JC.$$("#drawer [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

    const newHash = `#${tab}`;
    if (location.hash !== newHash) history.replaceState(null, "", newHash);

    // Inicialización de módulos según la pestaña activa
    try {
      if (tab === "catefa" && typeof JC.catefa?.init === "function") JC.catefa.init();
      if (tab === "cursos" && typeof window.initCursosView === "function") window.initCursosView();
      if (tab === "notificaciones" && typeof window.initNotificacionesView === "function") window.initNotificacionesView();
    } catch (e) {
      console.error(`[JC Router] Error al inicializar módulo ${tab}:`, e);
    }
  }

  window.activate = activate;
  JC.activate = activate;

  // ------------------------------------------------------------
  // Modales base y Listeners UI
  // ------------------------------------------------------------
  function openModal(el) {
    if (!el) return;
    el.style.display = "flex";
    el.classList.add("show");
  }

  function closeModal(el) {
    if (!el) return;
    el.classList.remove("show");
    el.style.display = "none";
  }

  window.jcOpenLoginModal = window.jcOpenLoginModal || function () {
    const modal = document.getElementById("loginModal");
    if (modal) openModal(modal);
  };

  window.jcCloseLoginModal = window.jcCloseLoginModal || function () {
    const modal = document.getElementById("loginModal");
    if (modal) closeModal(modal);
  };

  function bindUIEvents() {
    // Login Modal
    document.getElementById("btnLogin")?.addEventListener("click", () => window.jcOpenLoginModal());
    document.getElementById("loginClose")?.addEventListener("click", () => window.jcCloseLoginModal());
    
    const loginModal = document.getElementById("loginModal");
    loginModal?.addEventListener("click", (e) => { if (e.target === loginModal) window.jcCloseLoginModal(); });

    // Bots toggle
    document.getElementById("btnBots")?.addEventListener("click", () => {
      if (typeof JC.bots?.toggle === "function") {
        const on = JC.bots.toggle();
        window.logAviso?.({ title: "Bots", body: on ? "Bots activados 🤖" : "Bots apagados 📴" });
      }
    });

    // Tecla Escape para cerrar modales
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.jcCloseLoginModal();
        try { window.jcCloseAngieModal?.(); } catch {}
        try { window.jcCloseDrawer?.(); } catch {}
      }
    });
  }

  // ------------------------------------------------------------
  // Service Worker
  // ------------------------------------------------------------
  function registerSW() {
    if (!("serviceWorker" in navigator) || JC.flags.swRegistered) return;
    JC.flags.swRegistered = true;
    navigator.serviceWorker
      .register("sw.js")
      .then(() => window.logAviso?.({ title: "PWA", body: "Service Worker activo ✅" }))
      .catch((e) => console.warn("[JC] SW error:", e));
  }

  // ------------------------------------------------------------
  // Inicialización
  // ------------------------------------------------------------
  onReady(() => {
    bindUIEvents();
    registerSW();

    // Restaurar tokens de estilo si existen
    const savedTokens = safeParse(lsGet("jc_tokens", ""));
    if (savedTokens && typeof window.jcApplyTokens === "function") {
      window.jcApplyTokens(savedTokens);
    }

    // Arranque de ruta
    const startTab = normalizeTab(location.hash);
    activate(startTab);

    window.addEventListener("hashchange", () => {
      activate(location.hash);
    });

    console.log("[JC Engine] Router y cargador de vistas listo.");
  });
})();