/* ============================================================
   app.js (LEGACY BRIDGE) — Juventud CNC
   Objetivo: que NO reviente nada aunque ya se haya dividido en js/*
   - Mantiene compat con funciones/vars antiguas (activate, listarRecursos, etc.)
   - Crea modales faltantes (Angie herramientas) y handlers de overlay
   - Conecta AngieHerramientas.html vía postMessage (applyTokens / angieEstado)
   - Stubs seguros si algún módulo/ID no existe
   ============================================================ */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Namespace + helpers
  // ------------------------------------------------------------
  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};
  JC.flags = JC.flags || {};

  const $ = (JC.$ =
    JC.$ ||
    function (sel, root = document) {
      return root.querySelector(sel);
    });

  const $$ = (JC.$$ =
    JC.$$ ||
    function (sel, root = document) {
      return Array.from(root.querySelectorAll(sel));
    });

  JC.safeText =
    JC.safeText ||
    function (v) {
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
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function lsGet(key, fallback = "") {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------
  // Logger visible (Notificaciones -> Registro)
  // ------------------------------------------------------------
  window.logAviso =
    window.logAviso ||
    function ({ title = "Aviso", body = "" } = {}) {
      try {
        const ul = document.getElementById("avisosList");
        if (!ul) return;

        const li = document.createElement("li");
        const t = new Date();
        const stamp = t.toLocaleString();

        li.innerHTML = `
          <div class="notice-title"><strong>${JC.safeText(title)}</strong></div>
          <div class="notice-body">${JC.safeText(body)}</div>
          <div class="notice-meta muted small">${JC.safeText(stamp)}</div>
        `;
        ul.prepend(li);

        // limita a 40
        const items = ul.querySelectorAll("li");
        if (items.length > 40) items[items.length - 1].remove();
      } catch {}
    };

  // ------------------------------------------------------------
  // Compat: constants para que NO fallen funciones viejas
  // (si bots.js no cargó aún, no debería explotar)
  // ------------------------------------------------------------
  window.ANGIE_ESTADOS = window.ANGIE_ESTADOS || {};
  window.MIA_ESTADOS = window.MIA_ESTADOS || {};
  window.CIRO_ESTADOS = window.CIRO_ESTADOS || {};

  // Compat: setters (si bots.js existe, delega; si no, no crashea)
  window.angieSetEstado =
    window.angieSetEstado ||
    function (estado) {
      try {
        JC.bots?.angieSetEstado?.(estado);
        return;
      } catch {}
      // fallback mínimo (solo cambia texto si existe)
      const txt = document.getElementById("angieText");
      if (txt) txt.textContent = `Angie: ${estado || "..."}`;
    };

  window.miaSetEstado =
    window.miaSetEstado ||
    function (estado) {
      try {
        JC.bots?.miaSetEstado?.(estado);
        return;
      } catch {}
      const txt = document.getElementById("miaText");
      if (txt) txt.textContent = `Mia: ${estado || "..."}`;
    };

  window.ciroSetEstado =
    window.ciroSetEstado ||
    function (estado) {
      try {
        JC.bots?.ciroSetEstado?.(estado);
        return;
      } catch {}
      const txt = document.getElementById("ciroText");
      if (txt) txt.textContent = `Ciro: ${estado || "..."}`;
    };

  // ------------------------------------------------------------
  // Compat: funciones antiguas que a veces eran llamadas desde otros lados
  // ------------------------------------------------------------
  window.listarRecursos =
    window.listarRecursos ||
    function (...args) {
      // Antes se llamaba desde cargarPublic / recursos
      if (typeof JC.resources?.listarRecursos === "function") return JC.resources.listarRecursos(...args);
      if (typeof JC.resources?.cargarRecursos === "function") return JC.resources.cargarRecursos(...args);
      if (typeof JC.resources?.refresh === "function") return JC.resources.refresh({ force: true });
      console.warn("[JC] listarRecursos: resources module not ready");
      return Promise.resolve([]);
    };

  // Alias útiles para viejos accesos globales
  Object.defineProperty(window, "comunidad", {
    get() {
      return JC.community || window.community || null;
    }
  });

  // ------------------------------------------------------------
  // Modales: Login (para ui.js overlay calls)
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

  function ensureOverlaySync() {
    try {
      window.jcSyncOverlay?.();
    } catch {}
  }

  window.jcOpenLoginModal =
    window.jcOpenLoginModal ||
    function () {
      const modal = document.getElementById("loginModal");
      if (!modal) return;
      // marca estado si ui.js existe
      try {
        const st = (JC.uiState = JC.uiState || {});
        st.loginOpen = true;
      } catch {}
      openModal(modal);
      ensureOverlaySync();
      window.logAviso?.({ title: "Login", body: "Modal de login abierto 🔑" });
    };

  window.jcCloseLoginModal =
    window.jcCloseLoginModal ||
    function () {
      const modal = document.getElementById("loginModal");
      if (!modal) return;
      try {
        const st = (JC.uiState = JC.uiState || {});
        st.loginOpen = false;
      } catch {}
      closeModal(modal);
      ensureOverlaySync();
    };

  function bindLoginModalUI() {
    const btn = document.getElementById("btnLogin");
    const closeBtn = document.getElementById("loginClose");
    const modal = document.getElementById("loginModal");
    if (btn) btn.addEventListener("click", () => window.jcOpenLoginModal?.());
    if (closeBtn) closeBtn.addEventListener("click", () => window.jcCloseLoginModal?.());
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) window.jcCloseLoginModal?.();
      });
    }
  }

  // ------------------------------------------------------------
  // Modal: Angie herramientas (creado dinámicamente)
  // - btnAngie abre un iframe a "angie-herramientas.html" o "angieherramientas.html"
  // ------------------------------------------------------------
  const ANGIE_TOOL_CANDIDATES = ["angie-herramientas.html", "angieherramientas.html", "angieHerramientas.html"];

  function pickAngieToolUrl() {
    // Sin fetch (GitHub Pages a veces bloquea HEAD). Elegimos el primero; si 404, el iframe lo mostrará.
    return ANGIE_TOOL_CANDIDATES[0];
  }

  function ensureAngieModal() {
    let modal = document.getElementById("angieModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "angieModal";
    modal.className = "jc-modal";
    modal.style.display = "none";

    modal.innerHTML = `
      <div class="jc-modal-card" role="dialog" aria-modal="true" aria-label="Angie herramientas">
        <header class="jc-modal-header">
          <div>
            <h3>🎨 Angie · Herramientas</h3>
            <p class="muted small">Paleta y emociones (aplica en tiempo real)</p>
          </div>
          <button id="angieModalClose" class="icon-btn" type="button">✕</button>
        </header>
        <div class="jc-modal-body" style="padding:0">
          <iframe
            id="angieToolsFrame"
            title="Angie herramientas"
            src="${pickAngieToolUrl()}"
            style="width:100%; height:min(74vh,720px); border:0; display:block;"
            loading="lazy"
          ></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // close handlers
    modal.addEventListener("click", (e) => {
      if (e.target === modal) window.jcCloseAngieModal?.();
    });
    modal.querySelector("#angieModalClose")?.addEventListener("click", () => window.jcCloseAngieModal?.());

    return modal;
  }

  window.jcOpenAngieModal =
    window.jcOpenAngieModal ||
    function () {
      const modal = ensureAngieModal();
      try {
        const st = (JC.uiState = JC.uiState || {});
        st.angieOpen = true;
      } catch {}
      openModal(modal);
      ensureOverlaySync();
      window.logAviso?.({ title: "Angie", body: "Herramientas abiertas 🎨" });
    };

  window.jcCloseAngieModal =
    window.jcCloseAngieModal ||
    function () {
      const modal = document.getElementById("angieModal");
      if (!modal) return;
      try {
        const st = (JC.uiState = JC.uiState || {});
        st.angieOpen = false;
      } catch {}
      closeModal(modal);
      ensureOverlaySync();
    };

  function bindAngieButton() {
    const btn = document.getElementById("btnAngie");
    if (!btn) return;
    btn.addEventListener("click", () => window.jcOpenAngieModal?.());
  }

  // ------------------------------------------------------------
  // PostMessage: AngieHerramientas -> App
  //  - { type:'applyTokens', tokens:{...} }
  //  - { type:'angieEstado', estado:'feliz' }
  // ------------------------------------------------------------
  function applyTokensAndPersist(tokens) {
    if (!tokens || typeof tokens !== "object") return;

    // merge con tokens guardados
    const current = safeParse(lsGet("jc_tokens", "")) || {};
    const merged = { ...current, ...tokens };
    lsSet("jc_tokens", JSON.stringify(merged));

    // aplica a CSS vars vía ui.js si existe, o directo
    try {
      window.jcApplyTokens?.(merged);
    } catch {}

    window.logAviso?.({ title: "Tema", body: "Tokens aplicados 🎨" });
  }

  function onMessage(e) {
    const data = e?.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "applyTokens") {
      applyTokensAndPersist(data.tokens);
      return;
    }

    if (data.type === "angieEstado") {
      const estado = data.estado || data.value;
      try {
        window.angieSetEstado?.(estado);
      } catch {}
      window.logAviso?.({ title: "Angie", body: `Estado: ${estado || "—"}` });
      return;
    }
  }

  // ------------------------------------------------------------
  // Router compat (por si main.js no está)
  // ------------------------------------------------------------
  function normalizeTab(t) {
    t = (t || "").trim();
    if (!t) return "inicio";
    return t.replace(/^#/, "");
  }

  function hasMainRouter() {
    // si main.js está, window.activate ya debería existir
    return typeof window.activate === "function" && window.activate !== activateFallback;
  }

  async function activateFallback(tab) {
    tab = normalizeTab(tab);
    const view = document.querySelector(`.view[data-view="${tab}"]`);
    if (!view) tab = "inicio";

    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === tab));
    $$(".tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $$("#drawer [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

    const newHash = `#${tab}`;
    if (location.hash !== newHash) history.replaceState(null, "", newHash);

    // hooks mínimos
    try {
      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
    } catch {}
  }

  // si no existe, expón fallback
  if (typeof window.activate !== "function") {
    window.activate = activateFallback;
    JC.activate = activateFallback;
  }

  // ------------------------------------------------------------
  // Service Worker (no rompe si no existe)
  // ------------------------------------------------------------
  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    // respeta si ya lo maneja otro módulo
    if (JC.flags.swRegistered) return;
    JC.flags.swRegistered = true;

    navigator.serviceWorker
      .register("sw.js")
      .then(() => window.logAviso?.({ title: "PWA", body: "Service Worker registrado ✅" }))
      .catch((e) => console.warn("[JC] SW register failed", e));
  }

  // ------------------------------------------------------------
  // Bind general UI
  // ------------------------------------------------------------
  function bindEscClose() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      try {
        window.jcCloseAngieModal?.();
        window.jcCloseLoginModal?.();
        window.jcClosePauseModal?.();
        window.jcCloseDrawer?.();
      } catch {}
    });
  }

  function bindBotsToggle() {
    const btn = document.getElementById("btnBots");
    if (!btn) return;

    btn.addEventListener("click", () => {
      try {
        // Si bots.js tiene toggle
        if (typeof JC.bots?.toggle === "function") {
          const on = JC.bots.toggle();
          window.logAviso?.({ title: "Bots", body: on ? "Bots activados 🤖" : "Bots apagados 📴" });
          return;
        }

        // fallback simple: muestra/oculta chat mini
        const chat = document.getElementById("jcChat");
        if (!chat) return;
        const now = chat.style.display === "none" || getComputedStyle(chat).display === "none";
        chat.style.display = now ? "block" : "none";
        window.logAviso?.({ title: "Bots", body: now ? "Chat mini abierto 🤖" : "Chat mini oculto 📴" });
      } catch (e) {
        console.warn("[JC] btnBots error", e);
      }
    });
  }

  function bindProfileButton() {
    const btn = document.getElementById("btnPerfil");
    if (!btn) return;
    btn.addEventListener("click", () => {
      try {
        window.activate?.("perfil");
      } catch {}
    });
  }

  // ------------------------------------------------------------
  // INIT
  // ------------------------------------------------------------
  onReady(() => {
    // overlay sync helper siempre
    try {
      window.jcSyncOverlay?.();
    } catch {}

    bindLoginModalUI();
    bindAngieButton();
    bindBotsToggle();
    bindProfileButton();
    bindEscClose();

    // postMessage
    window.addEventListener("message", onMessage);

    // registra SW
    registerSW();

    // Aplica tokens guardados si ui.js aún no lo hizo
    try {
      const saved = safeParse(lsGet("jc_tokens", "")) || null;
      if (saved && typeof window.jcApplyTokens === "function") window.jcApplyTokens(saved);
    } catch {}

    // Arranque por si main.js NO existe
    if (!hasMainRouter()) {
      const start = normalizeTab(location.hash || "#inicio");
      Promise.resolve(window.activate?.(start, { silentHash: true })).catch(() => {});
      window.addEventListener("hashchange", () => {
        Promise.resolve(window.activate?.(normalizeTab(location.hash), { silentHash: true })).catch(() => {});
      });
    }

    console.log("[JC] app.js bridge loaded", window.JC_BUILD || "");
  });
})();