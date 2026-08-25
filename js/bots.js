// js/bots.js
// Juventud CNC — Bots (Angie / Mia / Ciro / Alma) + Chat controller + Escenas + Rotación 40s
// ✅ Motor robusto fusionado con soporte de avatares en tarjetas flotantes (Floats 1-slot)
// ✅ Toggle maestro (btnBots): ON/OFF gobierna widgets, chat y rotación automática
// ✅ Autoplay de escenas + rotación periódica con frases pastorales y de ánimo

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

  // Event bus unificado
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

  // ---------------------------
  // Persistencia
  // ---------------------------
  const STORAGE_ENABLED = "jc_botsEnabled";
  const STORAGE_WIDGETS = "jc_bot_widgets";
  const STORAGE_LAST = "jc_bot_last_state";
  const STORAGE_MIA_MODO = "jc_mia_modo";
  const STORAGE_SEEN_SCENES = "jc_scene_seen";

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
  function elAngieWidget() { return document.getElementById("angieWidget"); }
  function elMiaWidget() { return document.getElementById("miaWidget"); }
  function elCiroWidget() { return document.getElementById("ciroWidget"); }
  function elAlmaWidget() { return document.getElementById("almaWidget"); }

  function elAngieText() { return document.getElementById("angieText"); }
  function elMiaText() { return document.getElementById("miaText"); }
  function elCiroText() { return document.getElementById("ciroText"); }
  function elAlmaText() { return document.getElementById("almaText"); }

  function elAngieImg() { return document.getElementById("angieAvatarImg"); }
  function elMiaImg() { return document.getElementById("miaAvatarImg"); }
  function elCiroImg() { return document.getElementById("ciroAvatarImg"); }
  function elAlmaImg() { return document.getElementById("almaAvatarImg"); }

  function btnAngieClose() { return document.getElementById("angieClose"); }
  function btnMiaClose() { return document.getElementById("miaClose"); }
  function btnCiroClose() { return document.getElementById("ciroClose"); }
  function btnAlmaClose() { return document.getElementById("almaClose"); }

  // Chat
  function elChat() { return document.getElementById("jcChat"); }
  function elChatBody() { return document.getElementById("jcChatBody"); }
  function btnChatCollapse() { return document.getElementById("jcChatToggle"); }
  function btnBotsToggle() { return document.getElementById("btnBots"); }

  // ---------------------------
  // Normalización
  // ---------------------------
  function normBot(bot) {
    const b = String(bot || "").toLowerCase();
    if (b === "angie") return "angie";
    if (b === "mia") return "mia";
    if (b === "ciro") return "ciro";
    if (b === "alma") return "alma";
    return "system";
  }

  // ---------------------------
  // Estado interno
  // ---------------------------
  const ROTATE_MS = 25000;
  const AUTOPLAY_MAX_LINES = 6;
  const RECENT_LIMIT = 12;

  const st = {
    bound: false,
    wrappedActivate: false,
    mountedInBox: false,
    collapsed: false,
    widgets: { angie: true, mia: true, ciro: true, alma: true },
    last: {
      angie: { estado: "feliz" },
      mia: { estado: "guiando" },
      ciro: { estado: "feliz" },
      alma: { estado: "agradecida" },
    },
    miaModo: "casual",
    rotateTimer: null,
    sceneTimers: [],
    recentLineKeys: [],
    lastSpeaker: "",
    seenScenes: {},
  };

  function clearSceneTimers() {
    if (!st.sceneTimers.length) return;
    for (const t of st.sceneTimers) {
      try { clearTimeout(t); } catch {}
    }
    st.sceneTimers = [];
  }

  function stopRotation() {
    if (st.rotateTimer) {
      try { clearInterval(st.rotateTimer); } catch {}
      st.rotateTimer = null;
    }
  }

  function getScenes() {
    const s = window.JC_CHAT_SCENES;
    return s && typeof s === "object" ? s : {};
  }

  // ---------------------------
  // BOT ASSETS: Manifest + pools por emoción
  // ---------------------------
  const BOT_MANIFEST_URL = "assets/bots-manifest.json";
  let __jcBotManifest = null;

  async function jcLoadBotManifest() {
    if (__jcBotManifest) return __jcBotManifest;
    try {
      const r = await fetch(BOT_MANIFEST_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      const j = await r.json();
      __jcBotManifest = j && typeof j === "object" ? j : null;
      return __jcBotManifest;
    } catch (e) {
      return null;
    }
  }

  function jcPreloadImgs(urls = []) {
    try {
      urls.forEach((u) => {
        if (!u) return;
        const im = new Image();
        im.decoding = "async";
        im.loading = "eager";
        im.src = u;
      });
    } catch {}
  }

  // ---------------------------
  // Estados y Frases
  // ---------------------------
  const ANGIE_ESTADOS = (window.ANGIE_ESTADOS = window.ANGIE_ESTADOS || {
    feliz: {
      img: "assets/angie-feliz-saludo.png",
      frases: [
        "¡Holaaa! Qué bueno verte 😄",
        "Mia ya ordenó todo… yo vengo a ponerle brillo 😌✨",
        "Ciro dice que hoy toca servir. Yo digo: servir con estilo 💗",
        "Mia organiza, Ciro actúa… y yo hago que todo se vea bonito ✨",
        "Hoy puede ser un gran día para acompañar con el corazón 💫",
      ],
    },
    saludo: { img: "assets/angie-sonrisa-saludo.png", frases: ["¿Listo para acompañar a los chicos?", "¡Hey! Pasa, siéntete en casa 😌"] },
    rezando: { img: "assets/angie-rezando.png", frases: ["Hagamos una pausa cortita para poner esto en manos de Dios 🙏", "Si el día pesa… respiramos, rezamos, y seguimos."] },
    traviesa: { img: "assets/angie-traviesa.png", frases: ["Mmm… sé que estás tramando una buena dinámica 👀", "Si Ciro se pone serio, yo lo saco a reír 😌"] },
    ok: { img: "assets/angie-ok.png", frases: ["Listo ✅ Quedó impecable.", "¡Perfecto! Acompañemos con todo el corazón 💗"] },
  });

  const MIA_ESTADOS = (window.MIA_ESTADOS = window.MIA_ESTADOS || {
    guiando: {
      modo: "casual",
      imgs: ["assets/mia-casual-wink.png", "assets/mia-casual-love.png"],
      frases: [
        "Te acompaño paso a paso 💗",
        "Vamos viendo esto con calma y paciencia 😊",
        "Cada niño es un regalo, cuidemos su proceso 🤍",
        "Si te pierdes en algo del grupo, lo revisamos juntos 💗",
      ],
    },
    apoyo: {
      modo: "casual",
      imgs: ["assets/mia-casual-love.png", "assets/mia-casual-shy.png"],
      frases: ["Bien hecho, el servicio que hacen es hermoso 💪", "Gracias por ponerle corazón al equipo ✨"],
    },
    elegante: {
      modo: "elegante",
      imgs: ["assets/mia-elegant-relief.png"],
      frases: ["Ordenemos las actividades con calma ✨", "Presentemos siempre lo mejor para ellos."],
    },
  });

  const CIRO_ESTADOS = (window.CIRO_ESTADOS = window.CIRO_ESTADOS || {
    feliz: {
      img: "assets/ciro-happy.png",
      frases: [
        "¡Holaaa! ¡Vamos con fuerza! 💪🔥",
        "Hoy se sirve con alegría en el corazón 🙌",
        "¡Con todo el ánimo para la catequesis de hoy! 💥",
      ],
    },
    pray: {
      img: "assets/ciro-pray.png",
      frases: ["Un momento… oración primero 🙏", "Señor, guía nuestras palabras y acciones con los niños."],
    },
    calm: {
      img: "assets/ciro-calm.png",
      frases: ["Paso firme, mente en paz.", "La paciencia es clave para acompañar a cada niño 😌"],
    },
  });

  const ALMA_ESTADOS = (window.ALMA_ESTADOS = window.ALMA_ESTADOS || {
    agradecida: {
      img: "assets/alma-agradecida.png",
      frases: [
        "Gracias por seguir aquí… acompañar es un acto de amor ✨",
        "Hoy hiciste lo mejor que pudiste, y eso basta 🤍",
        "Acompañemos a los niños con escucha sincera 🕊️",
      ],
    },
    pensativa: {
      img: "assets/alma-pensativa.png",
      frases: [
        "Escuchar al otro es el primer paso para conocerlo 🤍",
        "No tienes que resolver todo hoy, da un paso a la vez 🌱",
      ],
    },
  });

  function normEstado(bot, estado) {
    bot = normBot(bot);
    const e = String(estado || "").trim();
    if (!e) return "";

    if (bot === "angie") return ANGIE_ESTADOS[e] ? e : "feliz";
    if (bot === "mia") return MIA_ESTADOS[e] ? e : (st.miaModo === "elegante" ? "elegante" : "guiando");
    if (bot === "ciro") return CIRO_ESTADOS[e] ? e : "feliz";
    if (bot === "alma") return ALMA_ESTADOS[e] ? e : "agradecida";
    return "";
  }

  function pickBotImg(bot, estado, fallback = "") {
    bot = normBot(bot);
    if (bot === "angie") return ANGIE_ESTADOS[estado]?.img || "assets/angie-feliz-saludo.png";
    if (bot === "mia") return pick(MIA_ESTADOS[estado]?.imgs || [], "assets/mia-casual-wink.png");
    if (bot === "ciro") return CIRO_ESTADOS[estado]?.img || "assets/ciro-happy.png";
    if (bot === "alma") return ALMA_ESTADOS[estado]?.img || "assets/alma-agradecida.png";
    return fallback;
  }

  // ---------------------------
  // Float cards (1-slot con avatares reales)
  // ---------------------------
  const JC_FLOAT = {
    layerId: "jcFloatLayer",
    cardClass: "jc-float-card",
    showClass: "is-show",
    visibleMs: 5000,
    fadeMs: 220,
    busy: false,
    lastKey: "",
    currentEl: null,
  };

  function jcGetFloatLayer() {
    return document.getElementById(JC_FLOAT.layerId);
  }

  function jcFloatClear() {
    const layer = jcGetFloatLayer();
    if (!layer) return;
    layer.innerHTML = "";
    JC_FLOAT.currentEl = null;
  }

  function jcFloatBuildCard({ bot = "Angie", emoji = "💬", avatar = "", text = "", key = "" }) {
    const div = document.createElement("div");
    div.className = JC_FLOAT.cardClass;
    div.dataset.key = key || "";

    const imgTag = avatar
      ? `<img src="${avatar}" alt="${bot}" style="width:40px; height:40px; border-radius:999px; object-fit:contain; background:rgba(255,255,255,0.1); flex-shrink:0;" onerror="this.style.display='none'" />`
      : "";

    div.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center;">
        ${imgTag}
        <div style="flex:1;">
          <div class="jc-float-top">
            <span class="jc-float-pill">${emoji} ${bot}</span>
            <span class="muted small" style="opacity:.75">Acompañamiento</span>
          </div>
          <div class="jc-float-text">${String(text || "")}</div>
        </div>
      </div>
    `;
    return div;
  }

  async function jcFloatShowCard(payload, opts = {}) {
    const layer = jcGetFloatLayer();
    if (!layer) return;
    if (!JC.state.botsEnabled) return;

    const key = payload?.key || `${payload?.bot || "bot"}:${String(payload?.text || "").slice(0, 40)}`;
    if (!opts.force && key && key === JC_FLOAT.lastKey) return;

    if (JC_FLOAT.busy) return;
    JC_FLOAT.busy = true;

    try {
      if (JC_FLOAT.currentEl) {
        JC_FLOAT.currentEl.classList.remove(JC_FLOAT.showClass);
        await new Promise((r) => setTimeout(r, JC_FLOAT.fadeMs));
        jcFloatClear();
      }

      const el = jcFloatBuildCard({ ...payload, key });
      layer.appendChild(el);
      JC_FLOAT.currentEl = el;
      JC_FLOAT.lastKey = key;

      requestAnimationFrame(() => el.classList.add(JC_FLOAT.showClass));

      setTimeout(() => {
        if (JC_FLOAT.currentEl === el) {
          el.classList.remove(JC_FLOAT.showClass);
          setTimeout(() => {
            if (JC_FLOAT.currentEl === el) jcFloatClear();
          }, JC_FLOAT.fadeMs);
        }
      }, JC_FLOAT.visibleMs);
    } finally {
      JC_FLOAT.busy = false;
    }
  }

  // ---------------------------
  // Preferencias y Visibilidad
  // ---------------------------
  function loadWidgetsPrefs() {
    const w = safeParse(lsGet(STORAGE_WIDGETS, "")) || null;
    if (w && typeof w === "object") {
      st.widgets.angie = w.angie !== false;
      st.widgets.mia = w.mia !== false;
      st.widgets.ciro = w.ciro !== false;
      st.widgets.alma = w.alma !== false;
    }

    const last = safeParse(lsGet(STORAGE_LAST, "")) || null;
    if (last && typeof last === "object") {
      st.last.angie = last.angie || st.last.angie;
      st.last.mia = last.mia || st.last.mia;
      st.last.ciro = last.ciro || st.last.ciro;
      st.last.alma = last.alma || st.last.alma;
    }

    const mm = lsGet(STORAGE_MIA_MODO, "casual");
    st.miaModo = mm === "elegante" ? "elegante" : "casual";

    const seen = safeParse(lsGet(STORAGE_SEEN_SCENES, "")) || null;
    st.seenScenes = seen && typeof seen === "object" ? seen : {};

    jcLoadBotManifest().then((m) => {
      if (!m) return;
      const urls = [
        ...(Object.values(m.angie || {}).flat() || []),
        ...(m.mia?.casual || []),
        ...(m.mia?.elegante || []),
        ...(Object.values(m.ciro || {}).flat() || []),
        ...(Object.values(m.alma || {}).flat() || []),
      ];
      jcPreloadImgs(urls);
    });
  }

  function saveWidgetsPrefs() {
    lsSet(STORAGE_WIDGETS, JSON.stringify(st.widgets));
    lsSet(STORAGE_LAST, JSON.stringify(st.last));
    lsSet(STORAGE_MIA_MODO, st.miaModo);
    lsSet(STORAGE_SEEN_SCENES, JSON.stringify(st.seenScenes));
  }

  function applyWidgetsVisibility() {
    const enabled = !!JC.state.botsEnabled;
    const map = [
      { el: elAngieWidget(), vis: st.widgets.angie },
      { el: elMiaWidget(), vis: st.widgets.mia },
      { el: elCiroWidget(), vis: st.widgets.ciro },
      { el: elAlmaWidget(), vis: st.widgets.alma },
    ];
    map.forEach(({ el, vis }) => {
      if (el) {
        el.style.display = enabled && vis ? "" : "none";
        el.setAttribute("aria-hidden", enabled && vis ? "false" : "true");
      }
    });
  }

  function applyChatVisibility() {
    const chat = elChat();
    if (!chat) return;
    const enabled = !!JC.state.botsEnabled;
    chat.style.display = enabled ? "flex" : "none";
    chat.setAttribute("aria-hidden", enabled ? "false" : "true");
  }

  function setCollapsed(collapsed) {
    const chat = elChat();
    const body = elChatBody();
    if (!chat || !body) return;
    st.collapsed = !!collapsed;
    body.style.display = st.collapsed ? "none" : "";
    chat.classList.toggle("jc-chat--collapsed", st.collapsed);
    const btn = btnChatCollapse();
    if (btn) btn.textContent = st.collapsed ? "⌃" : "⌄";
  }

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
    try { body.scrollTop = body.scrollHeight; } catch {}
  }

  // ---------------------------
  // Aplicar estado
  // ---------------------------
  function setBotState(bot, estado, { speak = true, from = "", overrideText = "" } = {}) {
    bot = normBot(bot);
    const map = {
      angie: { states: ANGIE_ESTADOS, textEl: elAngieText(), imgEl: elAngieImg(), widgetEl: elAngieWidget() },
      mia: { states: MIA_ESTADOS, textEl: elMiaText(), imgEl: elMiaImg(), widgetEl: elMiaWidget() },
      ciro: { states: CIRO_ESTADOS, textEl: elCiroText(), imgEl: elCiroImg(), widgetEl: elCiroWidget() },
      alma: { states: ALMA_ESTADOS, textEl: elAlmaText(), imgEl: elAlmaImg(), widgetEl: elAlmaWidget() },
    };

    const cfg = map[bot];
    if (!cfg) return;

    const estadoOk = normEstado(bot, estado) || "feliz";
    const s = cfg.states?.[estadoOk] || null;
    const frase = overrideText ? String(overrideText) : s ? pick(s.frases, "") : "";

    st.last[bot] = { estado: estadoOk };
    saveWidgetsPrefs();

    if (cfg.textEl && frase) cfg.textEl.textContent = frase;
    if (cfg.imgEl) {
      const src = pickBotImg(bot, estadoOk, s?.img || "");
      if (src) cfg.imgEl.src = src;
    }

    if (speak && frase && JC.state.botsEnabled) {
      const name = bot.charAt(0).toUpperCase() + bot.slice(1);
      chatLine(name, frase, from || estadoOk || "");
    }
  }

  function angieSetEstado(estado, opts) { setBotState("angie", estado || "feliz", opts); }
  function miaSetEstado(estado, opts) { setBotState("mia", estado || "guiando", opts); }
  function ciroSetEstado(estado, opts) { setBotState("ciro", estado || "feliz", opts); }
  function almaSetEstado(estado, opts) { setBotState("alma", estado || "agradecida", opts); }

  // ---------------------------
  // Motor de Rotación Global
  // ---------------------------
  function getBotFallbackLine(bot, estado) {
    bot = normBot(bot);
    if (bot === "angie") return pick(ANGIE_ESTADOS[estado || "feliz"]?.frases || [], "¡Holaaa! Qué bueno verte 😄");
    if (bot === "mia") return pick(MIA_ESTADOS[estado || "guiando"]?.frases || [], "Te acompaño paso a paso 💗");
    if (bot === "ciro") return pick(CIRO_ESTADOS[estado || "feliz"]?.frases || [], "¡Vamos con fuerza! 💪🔥");
    if (bot === "alma") return pick(ALMA_ESTADOS[estado || "agradecida"]?.frases || [], "Acompañemos con amor 🤍");
    return "";
  }

  function prettyBot(bot) {
    const b = normBot(bot);
    return b.charAt(0).toUpperCase() + b.slice(1);
  }

  function botEmoji(bot) {
    const b = normBot(bot);
    if (b === "angie") return "💙";
    if (b === "mia") return "💗";
    if (b === "ciro") return "🔥";
    if (b === "alma") return "🤍";
    return "💬";
  }

  function rotateOnceGlobal() {
    if (!JC.state.botsEnabled) return;

    const order = ["angie", "mia", "ciro", "alma"];
    const next = order[(order.indexOf(st.lastSpeaker) + 1 + order.length) % order.length] || "angie";
    st.lastSpeaker = next;

    let estadoBase = "feliz";
    if (next === "mia") estadoBase = "guiando";
    if (next === "alma") estadoBase = "agradecida";

    setBotState(next, estadoBase, { speak: true, from: "rotación" });

    const txt = getBotFallbackLine(next, estadoBase);
    const avatar = pickBotImg(next, estadoBase);

    jcFloatShowCard({
      bot: prettyBot(next),
      emoji: botEmoji(next),
      avatar: avatar,
      text: txt,
      key: `rot:${next}:${txt.slice(0, 20)}`,
    });
  }

  function startRotation() {
    stopRotation();
    if (!JC.state.botsEnabled) return;
    st.rotateTimer = setInterval(() => {
      try { rotateOnceGlobal(); } catch {}
    }, ROTATE_MS);
  }

  function toggleBots() {
    JC.state.botsEnabled = !JC.state.botsEnabled;
    lsSet(STORAGE_ENABLED, JC.state.botsEnabled ? "1" : "0");

    const btn = btnBotsToggle();
    if (btn) {
      btn.classList.toggle("is-on", JC.state.botsEnabled);
      btn.setAttribute("aria-pressed", JC.state.botsEnabled ? "true" : "false");
    }

    if (!JC.state.botsEnabled) {
      clearSceneTimers();
      stopRotation();
      jcFloatClear();
    } else {
      startRotation();
      setTimeout(rotateOnceGlobal, 400);
    }

    applyWidgetsVisibility();
    applyChatVisibility();
  }

  // ---------------------------
  // Inicialización
  // ---------------------------
  function init() {
    loadWidgetsPrefs();

    const persisted = lsGet(STORAGE_ENABLED, null);
    JC.state.botsEnabled = persisted !== "0";

    const btn = btnBotsToggle();
    if (btn && !btn.__jcBotsBound) {
      btn.__jcBotsBound = true;
      btn.addEventListener("click", toggleBots);
      btn.classList.toggle("is-on", JC.state.botsEnabled);
    }

    const cbtn = btnChatCollapse();
    if (cbtn && !cbtn.__jcCollapseBound) {
      cbtn.__jcCollapseBound = true;
      cbtn.addEventListener("click", () => setCollapsed(!st.collapsed));
    }

    applyWidgetsVisibility();
    applyChatVisibility();

    if (JC.state.botsEnabled) {
      startRotation();
      setTimeout(rotateOnceGlobal, 1200);
    }

    JC.bots = JC.bots || {};
    JC.bots.init = init;
    JC.bots.toggle = toggleBots;
    JC.bots.showFloatCard = jcFloatShowCard;
    JC.bots.angieSetEstado = angieSetEstado;
    JC.bots.miaSetEstado = miaSetEstado;
    JC.bots.ciroSetEstado = ciroSetEstado;
    JC.bots.almaSetEstado = almaSetEstado;

    window.angieSetEstado = angieSetEstado;
    window.miaSetEstado = miaSetEstado;
    window.ciroSetEstado = ciroSetEstado;
    window.almaSetEstado = almaSetEstado;
  }

  domReady(init);
})();