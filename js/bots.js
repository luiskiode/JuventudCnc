// js/bots.js
// Juventud CNC - Bots / Chat controller
// Objetivo: encender/apagar el chat (#jcChat), moverlo al mount (#boxChatMount) cuando tab="box",
// y evitar errores si JC/DOM aún no están listos.

(function () {
  "use strict";

  // ---------- Utils ----------
  function safeGetJC() {
    return window.JC && typeof window.JC === "object" ? window.JC : null;
  }

  function domReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  function ensureHelpers(JC) {
    // Si tu core ya trae JC.$/JC.on/JC.emit, esto no hace nada.
    // Si no existen, crea versiones seguras para evitar crasheos.
    if (typeof JC.$ !== "function") {
      JC.$ = (sel, root) => (root || document).querySelector(sel);
    }
    if (typeof JC.on !== "function") {
      // Fallback a eventos DOM custom sobre window
      JC.on = (name, fn) => window.addEventListener(name, fn);
    }
    if (typeof JC.emit !== "function") {
      JC.emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
    }
    if (!JC.state || typeof JC.state !== "object") JC.state = {};
  }

  // Persistencia opcional del estado bots (no rompe si no quieres usarlo)
  const STORAGE_KEY = "jc_botsEnabled";

  function loadPersistedEnabled() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
      return null;
    } catch {
      return null;
    }
  }

  function savePersistedEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // ---------- Core behavior ----------
  function getChatEl(JC) {
    return JC.$("#jcChat");
  }

  function getToggleBtn(JC) {
    return JC.$("#btnBots");
  }

  function getBoxMount(JC) {
    return JC.$("#boxChatMount");
  }

  function applyChatVisibility(JC) {
    const chat = getChatEl(JC);
    if (!chat) return;

    // Bloque/none, pero respetando si alguien ya usa flex
    // (si necesitas flex, cambia "block" por "flex").
    chat.style.display = JC.state.botsEnabled ? "block" : "none";

    // Accesibilidad / estado
    chat.setAttribute("aria-hidden", JC.state.botsEnabled ? "false" : "true");

    const btn = getToggleBtn(JC);
    if (btn) {
      btn.setAttribute("aria-pressed", JC.state.botsEnabled ? "true" : "false");
      // Si usas un ícono/texto dentro del botón, puedes actualizarlo aquí
      // btn.textContent = JC.state.botsEnabled ? "Bots: ON" : "Bots: OFF";
    }
  }

  function placeChatForTab(JC, tab) {
    const chatEl = getChatEl(JC);
    if (!chatEl) return;

    // Si no hay mount, siempre lo mandamos al body
    const mount = getBoxMount(JC);
    if (tab === "box" && mount) {
      if (chatEl.parentElement !== mount) mount.appendChild(chatEl);
    } else {
      if (chatEl.parentElement !== document.body) document.body.appendChild(chatEl);
    }
  }

  function toggleBots(JC) {
    JC.state.botsEnabled = !JC.state.botsEnabled;
    savePersistedEnabled(JC.state.botsEnabled);
    applyChatVisibility(JC);
    JC.emit("bots:toggled", { enabled: JC.state.botsEnabled });
  }

  // ---------- Public init ----------
  function init() {
    const JC = safeGetJC();
    if (!JC) {
      // Si se carga antes de JC, reintenta una vez cuando DOM esté listo
      domReady(() => {
        const JC2 = safeGetJC();
        if (!JC2) return;
        ensureHelpers(JC2);
        initWithJC(JC2);
      });
      return;
    }

    ensureHelpers(JC);
    initWithJC(JC);
  }

  function initWithJC(JC) {
    // Evita doble init
    if (JC.bots && JC.bots.__inited) return;

    // Estado inicial
    const persisted = loadPersistedEnabled();
    if (typeof persisted === "boolean") JC.state.botsEnabled = persisted;
    else if (typeof JC.state.botsEnabled !== "boolean") JC.state.botsEnabled = false;

    // Set inicial de visibilidad (por defecto oculto)
    applyChatVisibility(JC);

    // Bind botón toggle
    const btn = getToggleBtn(JC);
    if (btn && !btn.__jcBotsBound) {
      btn.__jcBotsBound = true;
      btn.addEventListener("click", () => toggleBots(JC));
    }

    // Al cambiar de vista, mover el chat si estás en "box"
    // Nota: tu core emite "ui:view" con detail.tab
    JC.on("ui:view", (ev) => {
      const detail = ev?.detail || {};
      const tab = detail.tab;
      placeChatForTab(JC, tab);
      // Importante: al moverlo, no pierdas el estado de visible/oculto
      applyChatVisibility(JC);
    });

    // Si el chat ya existía en el DOM y la vista inicial es "box", puedes forzarlo:
    // Si tu app emite ui:view al inicio, esto no hace falta.
    // Aquí solo lo dejamos estable:
    placeChatForTab(JC, JC.state.activeTab || null);

    // Exponer API pública
    JC.bots = {
      __inited: true,
      init,
      toggle: () => toggleBots(JC),
      show: () => {
        JC.state.botsEnabled = true;
        savePersistedEnabled(true);
        applyChatVisibility(JC);
        JC.emit("bots:toggled", { enabled: true });
      },
      hide: () => {
        JC.state.botsEnabled = false;
        savePersistedEnabled(false);
        applyChatVisibility(JC);
        JC.emit("bots:toggled", { enabled: false });
      },
      placeForTab: (tab) => placeChatForTab(JC, tab),
      refresh: () => applyChatVisibility(JC)
    };
  }

  // Auto-init cuando el DOM esté listo
  domReady(init);
})();