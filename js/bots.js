// js/bots.js
// Juventud CNC - Bots / Chat controller
// Objetivo: encender/apagar el chat (#jcChat), moverlo al mount (#boxChatMount) cuando tab="box",
// y NO depender de eventos "ui:view" (porque tu router actual usa activate()).

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // ---------- helpers mínimos ----------
  const $ = (JC.$ =
    JC.$ ||
    function (sel, root) {
      return (root || document).querySelector(sel);
    });

  // Event bus unificado (usa JC:evt como en profile/community/events)
  if (typeof JC.on !== "function") {
    JC.on = function (evt, cb) {
      document.addEventListener(`JC:${evt}`, (e) => cb(e.detail), false);
    };
  }
  if (typeof JC.emit !== "function") {
    JC.emit = function (evt, detail) {
      document.dispatchEvent(new CustomEvent(`JC:${evt}`, { detail }));
    };
  }

  function domReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  // Persistencia opcional
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
    } catch {}
  }

  // ---------- DOM refs ----------
  function getChatEl() {
    return $("#jcChat");
  }
  function getToggleBtn() {
    return $("#btnBots");
  }
  function getBoxMount() {
    return $("#boxChatMount");
  }
  function getCollapseBtn() {
    return $("#jcChatToggle");
  }
  function getChatBody() {
    return $("#jcChatBody");
  }

  // ---------- Estado interno ----------
  const st = {
    bound: false,
    mountedInBox: false,
    collapsed: false
  };

  // ---------- behavior ----------
  function applyChatVisibility() {
    const chat = getChatEl();
    if (!chat) return;

    chat.style.display = JC.state.botsEnabled ? "block" : "none";
    chat.setAttribute("aria-hidden", JC.state.botsEnabled ? "false" : "true");

    const btn = getToggleBtn();
    if (btn) {
      btn.setAttribute("aria-pressed", JC.state.botsEnabled ? "true" : "false");
      // feedback visual mínimo
      btn.classList.toggle("is-on", !!JC.state.botsEnabled);
    }
  }

  function placeChatForTab(tab) {
    const chatEl = getChatEl();
    if (!chatEl) return;

    const mount = getBoxMount();
    if (tab === "box" && mount) {
      if (chatEl.parentElement !== mount) mount.appendChild(chatEl);
      st.mountedInBox = true;
    } else {
      if (chatEl.parentElement !== document.body) document.body.appendChild(chatEl);
      st.mountedInBox = false;
    }
  }

  function toggleBots() {
    JC.state.botsEnabled = !JC.state.botsEnabled;
    savePersistedEnabled(JC.state.botsEnabled);
    applyChatVisibility();
    JC.emit("bots:toggled", { enabled: JC.state.botsEnabled });
  }

  // Collapsable mini chat (si existe el botón)
  function setCollapsed(collapsed) {
    const chat = getChatEl();
    const body = getChatBody();
    if (!chat || !body) return;

    st.collapsed = !!collapsed;
    body.style.display = st.collapsed ? "none" : "";
    const btn = getCollapseBtn();
    if (btn) btn.textContent = st.collapsed ? "⌃" : "⌄";
  }

  function bindUIOnce() {
    if (st.bound) return;
    st.bound = true;

    const btn = getToggleBtn();
    if (btn && !btn.__jcBotsBound) {
      btn.__jcBotsBound = true;
      btn.addEventListener("click", toggleBots);
    }

    const collapseBtn = getCollapseBtn();
    if (collapseBtn && !collapseBtn.__jcCollapseBound) {
      collapseBtn.__jcCollapseBound = true;
      collapseBtn.addEventListener("click", () => setCollapsed(!st.collapsed));
    }

    // MUY IMPORTANTE:
    // Tu router (main.js) usa activate() y NO está emitiendo "ui:view".
    // Aquí nos enganchamos a "tab:changed" (si lo emites) y además a hashchange.
    JC.on("tab:changed", (d) => {
      const tab = d?.tab;
      if (tab) {
        JC.state.activeTab = tab;
        placeChatForTab(tab);
        applyChatVisibility();
      }
    });

    window.addEventListener("hashchange", () => {
      const tab = (location.hash || "#inicio").replace("#", "").trim();
      JC.state.activeTab = tab || "inicio";
      placeChatForTab(JC.state.activeTab);
      applyChatVisibility();
    });
  }

  // API para que main.js pueda montar el chat grande cuando entra a Box
  function mountBox() {
    placeChatForTab("box");
    applyChatVisibility();
  }

  // Inicializa chat con contenido mínimo para que “se vea algo” (sin chat real aún)
  function ensureWelcomeLine() {
    const body = getChatBody();
    if (!body) return;
    if (body.__jcSeeded) return;
    body.__jcSeeded = true;

    const div = document.createElement("div");
    div.className = "jc-chat-line";
    div.innerHTML = `<div class="muted small">🤖 Bots listos. Usa el botón 🤖 para mostrar/ocultar.</div>`;
    body.appendChild(div);
  }

  function init() {
    // Estado inicial
    const persisted = loadPersistedEnabled();
    if (typeof persisted === "boolean") JC.state.botsEnabled = persisted;
    else if (typeof JC.state.botsEnabled !== "boolean") JC.state.botsEnabled = false;

    // Bind UI + seed
    bindUIOnce();
    ensureWelcomeLine();

    // Ubicación inicial según hash
    const tab = (location.hash || "#inicio").replace("#", "").trim() || "inicio";
    JC.state.activeTab = tab;
    placeChatForTab(tab);

    // Visibilidad inicial
    applyChatVisibility();
    setCollapsed(false);

    // Exponer API pública (sin pisarte si ya existe)
    JC.bots = JC.bots || {};
    JC.bots.__inited = true;
    JC.bots.init = init;
    JC.bots.toggle = toggleBots;
    JC.bots.show = () => {
      JC.state.botsEnabled = true;
      savePersistedEnabled(true);
      applyChatVisibility();
      JC.emit("bots:toggled", { enabled: true });
    };
    JC.bots.hide = () => {
      JC.state.botsEnabled = false;
      savePersistedEnabled(false);
      applyChatVisibility();
      JC.emit("bots:toggled", { enabled: false });
    };
    JC.bots.placeForTab = placeChatForTab;
    JC.bots.refresh = applyChatVisibility;
    JC.bots.mountBox = mountBox;
    JC.bots.setCollapsed = setCollapsed;
  }

  domReady(init);
})();