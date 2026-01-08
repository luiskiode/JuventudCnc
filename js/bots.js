// js/bots.js
// Juventud CNC — Bots (Angie / Mia / Ciro) + Chat controller
// ✅ “Drama” rescatado: estados + frases + rotación por pestaña + mini chat + box mount
// ✅ Robusto: no revienta si falta algún ID, CSS o asset
// ✅ Compatible con app.js bridge (JC.bots.angieSetEstado / miaSetEstado / ciroSetEstado)

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ =
    (JC.$ =
      JC.$ ||
      function (sel, root) {
        return (root || document).querySelector(sel);
      });

  const $$ =
    (JC.$$ =
      JC.$$ ||
      function (sel, root) {
        return Array.from((root || document).querySelectorAll(sel));
      });

  const safeText =
    (JC.safeText =
      JC.safeText ||
      function (v) {
        return String(v ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      });

  function domReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  // Event bus unificado (por si lo usan otros módulos)
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

  function pick(arr, fallback = "") {
    return Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback;
  }

  function clamp(n, a, b) {
    n = Number(n || 0);
    return Math.max(a, Math.min(b, n));
  }

  // ---------------------------
  // Persistencia
  // ---------------------------
  const STORAGE_ENABLED = "jc_botsEnabled";
  const STORAGE_WIDGETS = "jc_bot_widgets"; // {angie:true,mia:true,ciro:true}
  const STORAGE_LAST = "jc_bot_last_state"; // {angie:{estado},mia:{estado},ciro:{estado}}

  function lsGet(key, fallback = null) {
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
  function safeParse(s) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  // ---------------------------
  // DOM refs
  // ---------------------------
  // Widgets
  function elAngieWidget() { return document.getElementById("angieWidget"); }
  function elMiaWidget() { return document.getElementById("miaWidget"); }
  function elCiroWidget() { return document.getElementById("ciroWidget"); }

  function elAngieText() { return document.getElementById("angieText"); }
  function elMiaText() { return document.getElementById("miaText"); }
  function elCiroText() { return document.getElementById("ciroText"); }

  function elAngieImg() { return document.getElementById("angieAvatarImg"); }
  function elMiaImg() { return document.getElementById("miaAvatarImg"); }
  function elCiroImg() { return document.getElementById("ciroAvatarImg"); }

  // Close buttons
  function btnAngieClose() { return document.getElementById("angieClose"); }
  function btnMiaClose() { return document.getElementById("miaClose"); }
  function btnCiroClose() { return document.getElementById("ciroClose"); }

  // Chat mini
  function elChat() { return document.getElementById("jcChat"); }
  function elChatBody() { return document.getElementById("jcChatBody"); }
  function btnChatCollapse() { return document.getElementById("jcChatToggle"); }
  function btnBotsToggle() { return document.getElementById("btnBots"); }
  function elBoxMount() { return document.getElementById("boxChatMount"); }

  // ---------------------------
  // Drama: Estados + frases + assets
  // (Ajusta rutas/nombres si cambian; si un asset 404, no revienta)
  // ---------------------------
  const ANGIE_ESTADOS = (window.ANGIE_ESTADOS = window.ANGIE_ESTADOS || {
    saludo: {
      img: "assets/angie-sonrisa-saludo.png",
      frases: ["¿Listo para empezar algo épico?", "¡Hey! Pasa, siéntete en casa 😌", "Hoy puede ser un buen día 💫"]
    },
    feliz: {
      img: "assets/angie-feliz-saludo.png",
      frases: ["¡Holaaa! Qué bueno verte 😄", "Me alegra que estés aquí 💙", "Vamos paso a paso, tú puedes 💫"]
    },
    rezando: {
      img: "assets/angie-rezando.png",
      frases: ["Hagamos una pausa cortita para ofrecerle esto a Dios 🙏", "No estás solo. Respiramos… y seguimos 🙏"]
    },
    traviesa: {
      img: "assets/angie-traviesa.png",
      frases: ["😏 Yo digo que hoy rompemos el miedo… con estilo.", "Te vi dudando… yo te empujo un poquito 😄"]
    },
    enojada: {
      img: "assets/angie-enojada.png",
      frases: ["😡 Ey… con respeto. Aquí nos cuidamos.", "Si algo te molesta, lo hablamos. Sin destruir."]
    },
    confundida: {
      img: "assets/angie-confundida.png",
      frases: ["🤔 Espera… creo que algo no cargó. Lo arreglamos.", "Dame un segundo… estoy pensando."]
    },
    llorando: {
      img: "assets/angie-llorando.png",
      frases: ["😭 Si hoy pesa, aquí no estás solo.", "Estoy contigo… aunque sea en silencio."]
    },
    enamorada: {
      img: "assets/angie-enamorada.png",
      frases: ["😍 Me encanta verte avanzando.", "Aww… eso estuvo bonito 💗"]
    },
    cansada: {
      img: "assets/angie-cansada.png",
      frases: ["🥱 Un descanso y seguimos, ¿sí?", "Hoy fue mucho… pero sigues aquí. Bien."]
    },
    ok: {
      img: "assets/angie-feliz-saludo.png",
      frases: ["Listo ✅", "Hecho ✅", "Perfecto ✅"]
    }
  });

  const MIA_ESTADOS = (window.MIA_ESTADOS = window.MIA_ESTADOS || {
    saludo: {
      img: "assets/mia-casual-wink.png",
      frases: ["Soy Mia. Aquí todo lo coordinamos con calma 💗", "Respira. Ordenamos y avanzamos 💗"]
    },
    apoyo: {
      img: "assets/mia-casual-wink.png",
      frases: ["Estoy contigo. Un paso a la vez 💗", "Vamos bien. Sin prisa, pero sin pausa."]
    },
    alegre: {
      img: "assets/mia-casual-wink.png",
      frases: ["¡Me encanta cuando el equipo se activa! ✨", "Hoy sí… hoy se siente avance 💗"]
    },
    alerta: {
      img: "assets/mia-casual-wink.png",
      frases: ["Ojo: revisa permisos / sesión si algo no aparece.", "Si no ves datos, puede ser RLS o sesión."]
    },
    firme: {
      img: "assets/mia-casual-wink.png",
      frases: ["Con respeto y orden. Esa es la vibra.", "Primero claridad, luego velocidad."]
    }
  });

  const CIRO_ESTADOS = (window.CIRO_ESTADOS = window.CIRO_ESTADOS || {
    happy: {
      img: "assets/ciro-happy.png",
      frases: ["¡Holaaa! ¡Vamos con fuerza! 💪🔥", "Dale, que sí sale 💪", "Yo cubro la espalda 😄"]
    },
    valiente: {
      img: "assets/ciro-happy.png",
      frases: ["Si da miedo… igual lo hacemos.", "Disciplina > excusas 💪"]
    },
    atento: {
      img: "assets/ciro-happy.png",
      frases: ["Revisa consola. Si hay error, lo cazamos.", "¿Qué pestaña falló? Yo me lanzo."]
    },
    fe: {
      img: "assets/ciro-happy.png",
      frases: ["Dios primero 🙏 y luego… a ejecutar.", "Paz. Orden. Acción."]
    }
  });

  // ---------------------------
  // Estado interno
  // ---------------------------
  const st = {
    bound: false,
    wrappedActivate: false,
    mountedInBox: false,
    collapsed: false,
    widgets: { angie: true, mia: true, ciro: true },
    last: {
      angie: { estado: "feliz" },
      mia: { estado: "saludo" },
      ciro: { estado: "happy" }
    }
  };

  // ---------------------------
  // Widgets: show/hide + close
  // ---------------------------
  function loadWidgetsPrefs() {
    const w = safeParse(lsGet(STORAGE_WIDGETS, "")) || null;
    if (w && typeof w === "object") {
      st.widgets.angie = w.angie !== false;
      st.widgets.mia = w.mia !== false;
      st.widgets.ciro = w.ciro !== false;
    }

    const last = safeParse(lsGet(STORAGE_LAST, "")) || null;
    if (last && typeof last === "object") {
      st.last.angie = last.angie || st.last.angie;
      st.last.mia = last.mia || st.last.mia;
      st.last.ciro = last.ciro || st.last.ciro;
    }
  }

  function saveWidgetsPrefs() {
    lsSet(STORAGE_WIDGETS, JSON.stringify(st.widgets));
    lsSet(STORAGE_LAST, JSON.stringify(st.last));
  }

  function setWidgetVisible(bot, visible) {
    visible = !!visible;
    st.widgets[bot] = visible;
    saveWidgetsPrefs();

    const map = {
      angie: elAngieWidget(),
      mia: elMiaWidget(),
      ciro: elCiroWidget()
    };
    const el = map[bot];
    if (!el) return;
    el.style.display = visible ? "" : "none";
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function applyWidgetsVisibility() {
    // botsEnabled gobierna todo
    const enabled = !!JC.state.botsEnabled;

    // Widgets
    const wA = elAngieWidget();
    const wM = elMiaWidget();
    const wC = elCiroWidget();

    if (wA) wA.style.display = enabled && st.widgets.angie ? "" : "none";
    if (wM) wM.style.display = enabled && st.widgets.mia ? "" : "none";
    if (wC) wC.style.display = enabled && st.widgets.ciro ? "" : "none";

    if (wA) wA.setAttribute("aria-hidden", enabled && st.widgets.angie ? "false" : "true");
    if (wM) wM.setAttribute("aria-hidden", enabled && st.widgets.mia ? "false" : "true");
    if (wC) wC.setAttribute("aria-hidden", enabled && st.widgets.ciro ? "false" : "true");
  }

  // ---------------------------
  // Chat: show/hide + mount + collapse
  // ---------------------------
  function applyChatVisibility() {
    const chat = elChat();
    if (!chat) return;

    const enabled = !!JC.state.botsEnabled;
    chat.style.display = enabled ? "block" : "none";
    chat.setAttribute("aria-hidden", enabled ? "false" : "true");

    const btn = btnBotsToggle();
    if (btn) {
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.classList.toggle("is-on", enabled);
      btn.title = enabled ? "Apagar bots" : "Encender bots";
    }
  }

  function placeChatForTab(tab) {
    const chat = elChat();
    if (!chat) return;

    const mount = elBoxMount();

    if (tab === "box" && mount) {
      if (chat.parentElement !== mount) mount.appendChild(chat);
      st.mountedInBox = true;

      // En box normalmente conviene expandido
      setCollapsed(false);
    } else {
      if (chat.parentElement !== document.body) document.body.appendChild(chat);
      st.mountedInBox = false;
    }
  }

  function setCollapsed(collapsed) {
    const chat = elChat();
    const body = elChatBody();
    if (!chat || !body) return;

    st.collapsed = !!collapsed;
    body.style.display = st.collapsed ? "none" : "";

    const btn = btnChatCollapse();
    if (btn) btn.textContent = st.collapsed ? "⌃" : "⌄";
  }

  // ---------------------------
  // Chat lines: “drama” en texto
  // ---------------------------
  function chatLine(bot, text, meta) {
    const body = elChatBody();
    if (!body) return;

    const now = new Date();
    const stamp = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const div = document.createElement("div");
    div.className = "jc-chat-line";
    div.innerHTML = `
      <div class="muted small" style="opacity:.9">${safeText(bot)} · ${safeText(stamp)}${meta ? " · " + safeText(meta) : ""}</div>
      <div>${safeText(text)}</div>
    `;
    body.appendChild(div);

    // Autoscroll suave
    try {
      body.scrollTop = body.scrollHeight;
    } catch {}
  }

  function seedChatOnce() {
    const body = elChatBody();
    if (!body || body.__jcSeeded) return;
    body.__jcSeeded = true;

    chatLine("Sistema", "🤖 Bots listos. Usa el botón 🤖 para mostrar/ocultar.", "inicio");
    chatLine("Angie", "Si algo se ve raro en celular, dímelo… lo dejamos bonito 😄", "drama");
    chatLine("Mia", "Ordenamos módulos y listo. Sin estrés 💗", "calma");
    chatLine("Ciro", "Yo me encargo de la fuerza 💪🔥", "power");
  }

  // ---------------------------
  // Estados: aplicar al DOM
  // ---------------------------
  function setBotState(bot, estado, { speak = true, from = "" } = {}) {
    const map = {
      angie: { states: ANGIE_ESTADOS, textEl: elAngieText(), imgEl: elAngieImg(), widgetEl: elAngieWidget() },
      mia: { states: MIA_ESTADOS, textEl: elMiaText(), imgEl: elMiaImg(), widgetEl: elMiaWidget() },
      ciro: { states: CIRO_ESTADOS, textEl: elCiroText(), imgEl: elCiroImg(), widgetEl: elCiroWidget() }
    };

    const cfg = map[bot];
    if (!cfg) return;

    const s = cfg.states?.[estado] || cfg.states?.saludo || cfg.states?.happy || null;
    const frase = s ? pick(s.frases, "") : "";

    // Guardar “last”
    st.last[bot] = { estado: estado || st.last[bot]?.estado || "" };
    saveWidgetsPrefs();

    // DOM updates (safe)
    if (cfg.textEl && frase) cfg.textEl.textContent = frase;

    if (cfg.imgEl && s?.img) {
      cfg.imgEl.src = s.img;
      cfg.imgEl.onerror = () => {
        // no revientes por 404
        cfg.imgEl.onerror = null;
        // deja la imagen anterior si existe, o fallback a vacío
        try {
          cfg.imgEl.removeAttribute("src");
        } catch {}
      };
    }

    // “speaking” highlight (si tu CSS lo usa)
    if (cfg.widgetEl) {
      cfg.widgetEl.classList.add("is-speaking");
      setTimeout(() => cfg.widgetEl && cfg.widgetEl.classList.remove("is-speaking"), 700);
    }

    // Chat drama
    if (speak && frase && JC.state.botsEnabled) {
      const name = bot === "angie" ? "Angie" : bot === "mia" ? "Mia" : "Ciro";
      chatLine(name, frase, from || estado || "");
    }
  }

  // Exports para compat (app.js bridge los busca)
  function angieSetEstado(estado, opts) { setBotState("angie", estado || "feliz", opts); }
  function miaSetEstado(estado, opts) { setBotState("mia", estado || "saludo", opts); }
  function ciroSetEstado(estado, opts) { setBotState("ciro", estado || "happy", opts); }

  // ---------------------------
  // “Según pestaña” (rescatando el drama)
  // ---------------------------
  function botsSegunVista(tab) {
    tab = String(tab || "").replace(/^#/, "").trim() || "inicio";
    JC.state.activeTab = tab;

    // Chat mount según pestaña
    placeChatForTab(tab);

    // Rotación de vibes (ajusta libremente)
    if (tab === "inicio") {
      angieSetEstado("feliz", { speak: true, from: "inicio" });
      miaSetEstado("alegre", { speak: false });
      ciroSetEstado("happy", { speak: false });
      return;
    }

    if (tab === "eventos") {
      miaSetEstado("alerta", { speak: true, from: "eventos" });
      angieSetEstado("saludo", { speak: false });
      ciroSetEstado("atento", { speak: false });
      return;
    }

    if (tab === "comunidad") {
      angieSetEstado("traviesa", { speak: true, from: "comunidad" });
      miaSetEstado("firme", { speak: false });
      ciroSetEstado("valiente", { speak: false });
      return;
    }

    if (tab === "recursos") {
      miaSetEstado("apoyo", { speak: true, from: "catefa" });
      angieSetEstado("confundida", { speak: false });
      ciroSetEstado("fe", { speak: false });
      return;
    }

    if (tab === "judart") {
      angieSetEstado("enamorada", { speak: true, from: "judart" });
      miaSetEstado("alegre", { speak: false });
      ciroSetEstado("happy", { speak: false });
      return;
    }

    if (tab === "perfil") {
      miaSetEstado("apoyo", { speak: true, from: "perfil" });
      angieSetEstado("saludo", { speak: false });
      ciroSetEstado("atento", { speak: false });
      return;
    }

    if (tab === "box") {
      ciroSetEstado("happy", { speak: true, from: "box" });
      // en box normalmente quieres chat visible
      if (JC.state.botsEnabled) setCollapsed(false);
      return;
    }

    // Default
    angieSetEstado("saludo", { speak: false });
    miaSetEstado("saludo", { speak: false });
    ciroSetEstado("happy", { speak: false });
  }

  // ---------------------------
  // Toggle bots
  // ---------------------------
  function loadPersistedEnabled() {
    const v = lsGet(STORAGE_ENABLED, null);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  }
  function savePersistedEnabled(enabled) {
    lsSet(STORAGE_ENABLED, enabled ? "1" : "0");
  }

  function toggleBots() {
    JC.state.botsEnabled = !JC.state.botsEnabled;
    savePersistedEnabled(JC.state.botsEnabled);

    applyWidgetsVisibility();
    applyChatVisibility();

    JC.emit("bots:toggled", { enabled: JC.state.botsEnabled });

    // Mini feedback
    if (typeof window.logAviso === "function") {
      window.logAviso({
        title: "Bots",
        body: JC.state.botsEnabled ? "Bots activados 🤖" : "Bots apagados 📴"
      });
    }
  }

  function showBots() {
    JC.state.botsEnabled = true;
    savePersistedEnabled(true);
    applyWidgetsVisibility();
    applyChatVisibility();
    JC.emit("bots:toggled", { enabled: true });
  }

  function hideBots() {
    JC.state.botsEnabled = false;
    savePersistedEnabled(false);
    applyWidgetsVisibility();
    applyChatVisibility();
    JC.emit("bots:toggled", { enabled: false });
  }

  // ---------------------------
  // Integración con router
  // - main.js NO emite eventos; entonces:
  //   1) escuchamos hashchange
  //   2) “wrappeamos” window.activate cuando exista
  // ---------------------------
  function handleTabChange(tab) {
    botsSegunVista(tab);
    applyWidgetsVisibility();
    applyChatVisibility();
  }

  function hookActivateWhenAvailable() {
    if (st.wrappedActivate) return;

    const act = window.activate;
    if (typeof act !== "function") return;

    if (act.__jcBotsWrapped) {
      st.wrappedActivate = true;
      return;
    }

    const wrapped = function (tab, opts) {
      const res = act.call(this, tab, opts);
      try {
        const t = String(tab || "").replace(/^#/, "").trim() || "inicio";
        handleTabChange(t);
      } catch {}
      return res;
    };

    wrapped.__jcBotsWrapped = true;
    // preserva referencia (para otros)
    try {
      window.activate = wrapped;
      JC.activate = wrapped;
    } catch {}

    st.wrappedActivate = true;
  }

  function activateHookRetries() {
    hookActivateWhenAvailable();
    if (st.wrappedActivate) return;

    // Reintentos suaves (main.js carga al final)
    setTimeout(hookActivateWhenAvailable, 60);
    setTimeout(hookActivateWhenAvailable, 180);
    setTimeout(hookActivateWhenAvailable, 420);
    setTimeout(hookActivateWhenAvailable, 900);
    setTimeout(hookActivateWhenAvailable, 1500);
  }

  // ---------------------------
  // Bind UI
  // ---------------------------
  function bindUIOnce() {
    if (st.bound) return;
    st.bound = true;

    // Toggle bots
    const btn = btnBotsToggle();
    if (btn && !btn.__jcBotsBound) {
      btn.__jcBotsBound = true;
      btn.addEventListener("click", toggleBots);
    }

    // Collapse chat
    const cbtn = btnChatCollapse();
    if (cbtn && !cbtn.__jcCollapseBound) {
      cbtn.__jcCollapseBound = true;
      cbtn.addEventListener("click", () => setCollapsed(!st.collapsed));
    }

    // Close widgets (X)
    const aClose = btnAngieClose();
    if (aClose && !aClose.__jcBound) {
      aClose.__jcBound = true;
      aClose.addEventListener("click", () => setWidgetVisible("angie", false));
    }

    const mClose = btnMiaClose();
    if (mClose && !mClose.__jcBound) {
      mClose.__jcBound = true;
      mClose.addEventListener("click", () => setWidgetVisible("mia", false));
    }

    const cClose2 = btnCiroClose();
    if (cClose2 && !cClose2.__jcBound) {
      cClose2.__jcBound = true;
      cClose2.addEventListener("click", () => setWidgetVisible("ciro", false));
    }

    // Hash fallback
    window.addEventListener("hashchange", () => {
      const tab = (location.hash || "#inicio").replace("#", "").trim() || "inicio";
      handleTabChange(tab);
    });

    // Si algún módulo sí emite tab:changed, lo tomamos
    JC.on("tab:changed", (d) => {
      const tab = d?.tab;
      if (tab) handleTabChange(tab);
    });
  }

  // ---------------------------
  // API: mountBox (main.js lo llama)
  // ---------------------------
  function mountBox() {
    placeChatForTab("box");
    applyChatVisibility();
    if (JC.state.botsEnabled) setCollapsed(false);
  }

  // ---------------------------
  // Init
  // ---------------------------
  function init() {
    loadWidgetsPrefs();

    // Estado inicial bots enabled
    const persisted = loadPersistedEnabled();
    if (typeof persisted === "boolean") JC.state.botsEnabled = persisted;
    else if (typeof JC.state.botsEnabled !== "boolean") JC.state.botsEnabled = false;

    bindUIOnce();
    seedChatOnce();

    // Restaura últimos estados (sin spam de chat)
    try {
      angieSetEstado(st.last.angie?.estado || "feliz", { speak: false });
      miaSetEstado(st.last.mia?.estado || "saludo", { speak: false });
      ciroSetEstado(st.last.ciro?.estado || "happy", { speak: false });
    } catch {}

    // Tab inicial
    const tab = (location.hash || "#inicio").replace("#", "").trim() || "inicio";
    handleTabChange(tab);

    // UI reflect
    applyWidgetsVisibility();
    applyChatVisibility();
    setCollapsed(false);

    // Hook router (cuando main.js defina activate)
    activateHookRetries();

    // Export
    JC.bots = JC.bots || {};
    JC.bots.__inited = true;

    JC.bots.init = init;
    JC.bots.toggle = toggleBots;
    JC.bots.show = showBots;
    JC.bots.hide = hideBots;

    JC.bots.mountBox = mountBox;
    JC.bots.placeForTab = placeChatForTab;
    JC.bots.setCollapsed = setCollapsed;

    JC.bots.say = (bot, text, meta) => chatLine(bot || "Bot", text || "", meta || "");
    JC.bots.seed = seedChatOnce;

    JC.bots.botsSegunVista = botsSegunVista;

    JC.bots.angieSetEstado = angieSetEstado;
    JC.bots.miaSetEstado = miaSetEstado;
    JC.bots.ciroSetEstado = ciroSetEstado;

    // Compat global (por si algo llama directo)
    window.angieSetEstado = window.angieSetEstado || angieSetEstado;
    window.miaSetEstado = window.miaSetEstado || miaSetEstado;
    window.ciroSetEstado = window.ciroSetEstado || ciroSetEstado;

    // Log
    try {
      console.log("[JC] bots.js init OK", { enabled: JC.state.botsEnabled, tab: JC.state.activeTab });
    } catch {}
  }

  domReady(init);
})();