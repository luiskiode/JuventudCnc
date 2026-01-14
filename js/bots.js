// js/bots.js
// Juventud CNC — Bots (Angie / Mia / Ciro) + Chat controller + Escenas + Rotación 40s
// ✅ Robusto: no revienta si falta algún ID/CSS/asset
// ✅ Toggle maestro (btnBots): ON/OFF gobierna TODO (widgets + chat autoplay + rotación)
// ✅ Autoplay automático de escenas (si está ON) + mezcla global de escenas para tarjetitas
// ✅ Rotación automática cada 40s (una sola “tarjetita” por tick) + anti-repetición
// ✅ Bridge compatible: JC.bots.angieSetEstado / miaSetEstado / ciroSetEstado

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

  // ---------------------------
  // Persistencia
  // ---------------------------
  const STORAGE_ENABLED = "jc_botsEnabled";
  const STORAGE_WIDGETS = "jc_bot_widgets"; // {angie:true,mia:true,ciro:true}
  const STORAGE_LAST = "jc_bot_last_state"; // {angie:{estado},mia:{estado},ciro:{estado}}
  const STORAGE_MIA_MODO = "jc_mia_modo"; // casual | elegante
  const STORAGE_SEEN_SCENES = "jc_scene_seen"; // { [tabOrKey]: true }

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
  // Tarjetitas flotantes (overlay) — 2 en PC, 1 en móvil
  // ---------------------------
  function ensureFloatLayer() {
    if (document.getElementById("jcFloatLayer")) return;

    const style = document.createElement("style");
    style.id = "jcFloatStyle";
    style.textContent = `
      #jcFloatLayer{position:fixed;inset:0;pointer-events:none;z-index:99998}
      .jc-float-wrap{position:fixed;left:12px;bottom:92px;display:flex;flex-direction:column;gap:10px;max-width:min(360px,calc(100vw - 24px));}
      @media (max-width: 720px){ .jc-float-wrap{left:10px;right:10px;bottom:92px;max-width:calc(100vw - 20px);} }
      .jc-float-card{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;
        padding:10px 12px;border-radius:16px;
        background:rgba(10,16,32,.82);backdrop-filter: blur(10px);
        box-shadow:0 10px 30px rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.10);
        transform:translateY(8px);opacity:0;transition:opacity .28s ease, transform .28s ease;
      }
      .jc-float-card.show{opacity:1;transform:translateY(0)}
      .jc-float-ava{width:44px;height:44px;border-radius:999px;flex:0 0 auto;object-fit:cover;background:rgba(255,255,255,.08)}
      .jc-float-name{font-size:12px;opacity:.9;margin:0 0 2px 0}
      .jc-float-text{font-size:13px;line-height:1.2;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .jc-float-x{pointer-events:auto;position:absolute;right:10px;top:8px;border:0;background:transparent;color:#fff;opacity:.75;cursor:pointer;font-size:16px}
      @media (max-width: 720px){
        .jc-float-card.hide-mobile{display:none!important}
      }
    `;
    document.head.appendChild(style);

    const layer = document.createElement("div");
    layer.id = "jcFloatLayer";
    layer.innerHTML = `
      <div class="jc-float-wrap" id="jcFloatWrap">
        <div class="jc-float-card show" id="jcFloat1">
          <img class="jc-float-ava" id="jcFloat1Img" alt="">
          <div>
            <div class="jc-float-name" id="jcFloat1Name">Bot</div>
            <p class="jc-float-text" id="jcFloat1Text"></p>
          </div>
        </div>

        <div class="jc-float-card show hide-mobile" id="jcFloat2">
          <img class="jc-float-ava" id="jcFloat2Img" alt="">
          <div>
            <div class="jc-float-name" id="jcFloat2Name">Bot</div>
            <p class="jc-float-text" id="jcFloat2Text"></p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(layer);
  }

  function setFloatCard(n, { bot, text, estado } = {}) {
    ensureFloatLayer();

    const card = document.getElementById(n === 2 ? "jcFloat2" : "jcFloat1");
    const img = document.getElementById(n === 2 ? "jcFloat2Img" : "jcFloat1Img");
    const name = document.getElementById(n === 2 ? "jcFloat2Name" : "jcFloat1Name");
    const p = document.getElementById(n === 2 ? "jcFloat2Text" : "jcFloat1Text");
    if (!card || !img || !name || !p) return;

    const b = normBot(bot);
    const nice = b === "angie" ? "Angie" : b === "mia" ? "Mia" : b === "ciro" ? "Ciro" : "Sistema";
    name.textContent = nice;
    p.textContent = String(text || "").trim();

    // set avatar src según bot+estado
    if (b === "angie") {
      const s = ANGIE_ESTADOS[normEstado("angie", estado) || "feliz"];
      img.src = s?.img || "";
    } else if (b === "mia") {
      const s = MIA_ESTADOS[normEstado("mia", estado) || (st.miaModo === "elegante" ? "elegante" : "guiando")];
      img.src = pick(s?.imgs || [], "") || "";
    } else if (b === "ciro") {
      const s = CIRO_ESTADOS[normEstado("ciro", estado) || "feliz"];
      img.src = s?.img || "";
    } else {
      img.removeAttribute("src");
    }

    // anim “refresh”
    card.classList.remove("show");
    setTimeout(() => card.classList.add("show"), 20);
  }

  function setFloatVisible(on) {
    const layer = document.getElementById("jcFloatLayer");
    if (!layer) return;
    layer.style.display = on ? "block" : "none";
    layer.setAttribute("aria-hidden", on ? "false" : "true");
  }


  // ---------------------------
  // Drama: Estados + frases + assets (trama antigua rescatada)
  // ---------------------------
  const ANGIE_ESTADOS = (window.ANGIE_ESTADOS = window.ANGIE_ESTADOS || {
    feliz: {
      img: "assets/angie-feliz-saludo.png",
      frases: [
        "¡Holaaa! Qué bueno verte 😄",
        "Hoy puede ser un buen día 💫",
        "Mia ya ordenó todo… yo vengo a ponerle brillo 😏✨",
        "Ciro dice que hoy toca servir. Yo digo: servir con estilo 💗"
      ]
    },
    saludo: {
      img: "assets/angie-sonrisa-saludo.png",
      frases: [
        "¿Listo para empezar algo épico?",
        "¡Hey! Pasa, siéntete en casa 😌",
        "Mia me pidió que te dé la bienvenida… pero yo lo hago mejor 😉"
      ]
    },
    rezando: {
      img: "assets/angie-rezando.png",
      frases: [
        "Hagamos una pausa cortita para poner esto en manos de Dios 🙏",
        "Si el día pesa… respiramos, rezamos, y seguimos.",
        "Ciro rezó primero. Yo solo… lo seguí (por una vez 😇)"
      ]
    },
    traviesa: {
      img: "assets/angie-traviesa.png",
      frases: [
        "Mmm… sé que estás tramando algo, cuéntame 👀",
        "Yo también tengo ideas locas… tranqui 😏",
        "Si Ciro se pone serio, yo lo saco a reír. Es mi misión 😌"
      ]
    },
    confundida: {
      img: "assets/angie-confundida.png",
      frases: [
        "No entendí mucho… pero lo resolvemos juntos 🤔",
        "Pregunta sin miedo: aquí nadie nace sabiendo 💛",
        "Mia lo explica bonito. Yo lo explico… a mi manera 😅"
      ]
    },
    enojada: {
      img: "assets/angie-enojada.png",
      frases: [
        "¡Oye! Eso no estuvo bien 😤",
        "Respira… lo hablamos mejor, ¿sí?",
        "Ciro ya está por “parar todo”. Mia me dijo: calma."
      ]
    },
    sorprendida: {
      img: "assets/angie-sorprendida.png",
      frases: ["¿QUÉ? 😳 ok… interesante…", "Eso sí no lo vi venir 👀", "Mia… ¿tú sabías esto? 😅"]
    },
    ok: {
      img: "assets/angie-ok.png",
      frases: ["Listo ✅", "¡Perfecto! quedó bonito 💗", "Ciro: aprobado. Mia: ordenado. Yo: feliz 😌"]
    },
    vergonzosa: {
      img: "assets/angie-vergonzosa.png",
      frases: ["Awww… ok, me da pena 😳", "No me mires así 😅", "Mia dice que sea formal… pero yo soy así 🤭"]
    }
  });

  const MIA_ESTADOS = (window.MIA_ESTADOS = window.MIA_ESTADOS || {
    guiando: {
      modo: "casual",
      imgs: ["assets/mia-casual-wink.png", "assets/mia-casual-surprised.png", "assets/mia-casual-love.png"],
      frases: ["Te acompaño paso a paso 💗", "Vamos viendo esto juntos 😊", "Estoy aquí para ayudarte"]
    },
    apoyo: {
      modo: "casual",
      imgs: ["assets/mia-casual-shy.png", "assets/mia-casual-embarrassed.png", "assets/mia-casual-love.png"],
      frases: ["Bien hecho, sigue así 💪", "Todo suma, no te rindas", "Confío en ti"]
    },
    confused: { modo: "casual", imgs: ["assets/mia-casual-confused.png"], frases: ["Revisemos esto con calma 🤍"] },
    triste: {
      modo: "casual",
      imgs: ["assets/mia-casual-sad.png", "assets/mia-casual-cry.png"],
      frases: ["Está bien sentirse así…", "Aquí no estás solo"]
    },
    elegante: {
      modo: "elegante",
      imgs: ["assets/mia-elegant-relief.png", "assets/mia-elegant-dreamy.png"],
      frases: ["Ordenemos esto con calma ✨", "Presentemos algo bonito"]
    },
    inspirada: {
      modo: "elegante",
      imgs: ["assets/mia-elegant-love.png", "assets/mia-elegant-heart.png"],
      frases: ["Esto puede inspirar a otros 💫", "Sigamos creando juntos"]
    },
    carinosa: {
      modo: "elegante",
      imgs: ["assets/mia-elegant-kiss.png", "assets/mia-elegant-shy.png"],
      frases: ["Me alegra verte aquí 🤍", "Gracias por ser parte"]
    },
    confundida: { modo: "elegante", imgs: ["assets/mia-elegant-confused.png"], frases: ["Algo no encaja… revisemos"] },
    llorando: { modo: "elegante", imgs: ["assets/mia-elegant-cry.png"], frases: ["Respira… seguimos juntos"] }
  });

  const CIRO_ESTADOS = (window.CIRO_ESTADOS = window.CIRO_ESTADOS || {
    feliz: {
      img: "assets/ciro-happy.png",
      frases: ["¡Holaaa! ¡Vamos con fuerza! 💪🔥", "Hoy se sirve con alegría 🙌", "Mia organizó… yo ejecuto 😤"]
    },
    excited: {
      img: "assets/ciro-excited.png",
      frases: ["¡YA! Dime qué hacemos 😄", "Estoy listo, listo, listo 💥", "Angie, no distraigas… (ok, un poquito sí 😅)"]
    },
    calm: {
      img: "assets/ciro-calm.png",
      frases: ["Estoy concentrado… dame un segundo.", "Paso firme, mente en paz.", "Mia tiene razón: primero orden."]
    },
    worried: {
      img: "assets/ciro-worried.png",
      frases: ["Eh… ¿y si sale mal? 😬", "Ok… lo intentamos de nuevo.", "Angie… no te rías 😅"]
    },
    pray: {
      img: "assets/ciro-pray.png",
      frases: ["Un momento… oración primero 🙏", "Señor, guíanos.", "Mia, gracias por recordarnos lo esencial."]
    },
    happy_pray: {
      img: "assets/ciro-happy-pray.png",
      frases: ["¡Orando y con alegría! 😇", "Dios por delante, siempre.", "Angie, hoy sí te salió bonito 💙"]
    },
    stop: {
      img: "assets/ciro-stop.png",
      frases: ["¡Alto ahí! Eso no va 😤", "Respeto primero.", "Mia, ¿lo hablamos? Yo me calmo."]
    }
  });

  // ---------------------------
  // Escenas (opcional, puede estar definido en otro archivo)
  // ---------------------------
  function getScenes() {
    const s = window.JC_CHAT_SCENES;
    return s && typeof s === "object" ? s : {};
  }

  // ---------------------------
  // Config
  // ---------------------------
  const ROTATE_MS = 40000;           // ✅ pedido: 40s
  const AUTOPLAY_MAX_LINES = 6;      // micro-escena por tab (para no invadir)
  const RECENT_LIMIT = 12;           // anti-repetición

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
      mia: { estado: "guiando" },
      ciro: { estado: "feliz" }
    },
    miaModo: "casual",
    rotateTimer: null,
    sceneTimers: [],
    recentLineKeys: [],
    lastSpeaker: "",
    seenScenes: {}
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

  function startRotation() {
    stopRotation();
    if (!JC.state.botsEnabled) return;

    st.rotateTimer = setInterval(() => {
      try { rotateOnceGlobal(); } catch {}
    }, ROTATE_MS);
  }

  // ---------------------------
  // Preferencias widgets + last + modo Mia + seen scenes
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

    const mm = lsGet(STORAGE_MIA_MODO, "casual");
    st.miaModo = mm === "elegante" ? "elegante" : "casual";

    const seen = safeParse(lsGet(STORAGE_SEEN_SCENES, "")) || null;
    st.seenScenes = (seen && typeof seen === "object") ? seen : {};
  }

  function saveWidgetsPrefs() {
    lsSet(STORAGE_WIDGETS, JSON.stringify(st.widgets));
    lsSet(STORAGE_LAST, JSON.stringify(st.last));
    lsSet(STORAGE_MIA_MODO, st.miaModo);
    lsSet(STORAGE_SEEN_SCENES, JSON.stringify(st.seenScenes));
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
    const enabled = !!JC.state.botsEnabled;

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
  // Chat lines
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

    try { body.scrollTop = body.scrollHeight; } catch {}
  }

  function seedChatOnce() {
    const body = elChatBody();
    if (!body || body.__jcSeeded) return;
    body.__jcSeeded = true;

    chatLine("Sistema", "🤖 Bots listos. Usa el botón 🤖 para mostrar/ocultar.", "inicio");
  }

  // ---------------------------
  // Normalización de estados (por compat: escenas vs estados)
  // ---------------------------
  function normBot(bot) {
    const b = String(bot || "").toLowerCase();
    if (b === "angie") return "angie";
    if (b === "mia") return "mia";
    if (b === "ciro") return "ciro";
    if (b === "system" || b === "sistema") return "system";
    return "system";
  }

  function normEstado(bot, estado) {
    bot = normBot(bot);
    const e = String(estado || "").trim();
    if (!e) return "";

    // Angie
    if (bot === "angie") {
      if (ANGIE_ESTADOS[e]) return e;
      // alias suaves
      if (e === "triste") return "vergonzosa";
      return "feliz";
    }

    // Mia
    if (bot === "mia") {
      if (MIA_ESTADOS[e]) return e;
      // aliases
      if (e === "saludo") return "guiando";
      if (e === "confundida") return "confundida";
      if (e === "confused") return "confused";
      // si piden elegante/apoyo/etc y existe
      return st.miaModo === "elegante" ? "elegante" : "guiando";
    }

    // Ciro
    if (bot === "ciro") {
      if (CIRO_ESTADOS[e]) return e;
      // aliases desde versiones previas
      if (e === "happy") return "feliz";
      if (e === "worried") return "worried";
      if (e === "calm") return "calm";
      if (e === "pray") return "pray";
      if (e === "happy_pray") return "happy_pray";
      if (e === "stop") return "stop";
      if (e === "excited") return "excited";
      return "feliz";
    }

    return "";
  }

  // ---------------------------
  // Estados: aplicar al DOM (con override opcional de texto)
  // ---------------------------
  function setBotState(bot, estado, { speak = true, from = "", overrideText = "" } = {}) {
    bot = normBot(bot);

    const map = {
      angie: { states: ANGIE_ESTADOS, textEl: elAngieText(), imgEl: elAngieImg(), widgetEl: elAngieWidget() },
      mia: { states: MIA_ESTADOS, textEl: elMiaText(), imgEl: elMiaImg(), widgetEl: elMiaWidget() },
      ciro: { states: CIRO_ESTADOS, textEl: elCiroText(), imgEl: elCiroImg(), widgetEl: elCiroWidget() }
    };

    const cfg = map[bot];
    if (!cfg) return;

    const estadoOk = normEstado(bot, estado) || (bot === "mia" ? "guiando" : bot === "ciro" ? "feliz" : "feliz");
    const s = cfg.states?.[estadoOk] || null;

    const frase = overrideText ? String(overrideText) : (s ? pick(s.frases, "") : "");

    // Guardar “last”
    st.last[bot] = { estado: estadoOk };
    saveWidgetsPrefs();

    // DOM updates (safe)
    if (cfg.textEl && frase) cfg.textEl.textContent = frase;

    // img (Mia usa imgs[], Angie/Ciro usan img)
    if (cfg.imgEl) {
      let src = "";
      if (bot === "mia") {
        const imgs = s?.imgs || [];
        src = pick(imgs, "");
      } else {
        src = s?.img || "";
      }

      if (src) {
        cfg.imgEl.src = src;
        cfg.imgEl.onerror = () => {
          cfg.imgEl.onerror = null;
          try { cfg.imgEl.removeAttribute("src"); } catch {}
        };
      }
    }

    // speaking highlight
    if (cfg.widgetEl) {
      cfg.widgetEl.classList.add("is-speaking");
      setTimeout(() => cfg.widgetEl && cfg.widgetEl.classList.remove("is-speaking"), 700);
    }

    // Chat (solo si está ON)
    if (speak && frase && JC.state.botsEnabled) {
      const name = bot === "angie" ? "Angie" : bot === "mia" ? "Mia" : "Ciro";
      chatLine(name, frase, from || estadoOk || "");
    }
  }

  // Exports para compat
  function angieSetEstado(estado, opts) { setBotState("angie", estado || "feliz", opts); }
  function miaSetEstado(estado, opts) { setBotState("mia", estado || (st.miaModo === "elegante" ? "elegante" : "guiando"), opts); }
  function ciroSetEstado(estado, opts) { setBotState("ciro", estado || "feliz", opts); }

  // Mia modo (persistente)
  function miaSetModo(modo = "casual") {
    st.miaModo = modo === "elegante" ? "elegante" : "casual";
    saveWidgetsPrefs();
    // aplica una vibe coherente sin spamear chat
    miaSetEstado(st.miaModo === "elegante" ? "elegante" : "guiando", { speak: false, from: "modo" });
  }

  // ---------------------------
  // Escenas: pool global + autoplay micro-escenas
  // ---------------------------
  function flattenScenePool() {
    const scenes = getScenes();
    const out = [];
    const keys = Object.keys(scenes || {});
    for (const k of keys) {
      const arr = scenes[k];
      if (!Array.isArray(arr)) continue;
      for (let i = 0; i < arr.length; i++) {
        const ln = arr[i] || {};
        const from = normBot(ln.from);
        const text = String(ln.text ?? "").trim();
        if (!text) continue;
        const estado = String(ln.estado ?? "").trim();
        const delay = Number(ln.delay ?? 0) || 0;

        // key para anti-repetición
        const key = `${k}::${i}::${from}::${estado}::${text.slice(0, 42)}`;

        out.push({ sceneKey: k, idx: i, from, text, estado, delay, key });
      }
    }
    return out;
  }

  function pushRecent(key) {
    if (!key) return;
    st.recentLineKeys = st.recentLineKeys.filter((k) => k !== key);
    st.recentLineKeys.unshift(key);
    if (st.recentLineKeys.length > RECENT_LIMIT) st.recentLineKeys.length = RECENT_LIMIT;
  }

   
  function isRecent(key) {
    return st.recentLineKeys.includes(key);
  }

 function rotateOnceGlobal() {
  if (!JC.state.botsEnabled) return;

  // respeta widgets visibles: si todos ocultos, no tiene sentido rotar
  const anyWidgetOn =
    (st.widgets.angie && !!elAngieWidget()) ||
    (st.widgets.mia && !!elMiaWidget()) ||
    (st.widgets.ciro && !!elCiroWidget());
  if (!anyWidgetOn) return;

  const pool = flattenScenePool();

  // si no hay escenas, caemos a frases base
  if (!pool.length) {
    const order = ["angie", "mia", "ciro"];
    const next = order[(order.indexOf(st.lastSpeaker) + 1 + order.length) % order.length] || "angie";
    st.lastSpeaker = next;

    if (next === "angie" && st.widgets.angie) angieSetEstado("feliz", { speak: true, from: "rotación" });
    if (next === "mia" && st.widgets.mia) miaSetEstado(st.miaModo === "elegante" ? "elegante" : "guiando", { speak: true, from: "rotación" });
    if (next === "ciro" && st.widgets.ciro) ciroSetEstado("feliz", { speak: true, from: "rotación" });

    // Tarjetitas: refleja lo mismo (si existe overlay)
    try {
      if (typeof setFloatCard === "function") {
        st.__floatFlip = !st.__floatFlip;
        const slot = st.__floatFlip ? 1 : 2;
        setFloatCard(slot, { bot: next, text: "", estado: st.last?.[next]?.estado || "" });
      }
    } catch {}
    return;
  }

  // filtro: preferimos NO system, y evitamos repetir recent
  const candidates = pool.filter((x) => x.from !== "system" && !isRecent(x.key));
  const usable = candidates.length ? candidates : pool.filter((x) => x.from !== "system");
  if (!usable.length) return;

  // elegir un bot diferente al último si se puede
  let pickOne = null;
  for (let tries = 0; tries < 12; tries++) {
    const c = usable[Math.floor(Math.random() * usable.length)];
    if (!c) break;
    if (c.from === st.lastSpeaker) continue;
    pickOne = c;
    break;
  }
  if (!pickOne) pickOne = usable[Math.floor(Math.random() * usable.length)] || usable[0];

  pushRecent(pickOne.key);
  st.lastSpeaker = pickOne.from;

  // ✅ Tarjetitas flotantes: actualiza 1 por tick (alternando slot 1/2)
  try {
    if (typeof setFloatCard === "function") {
      st.__floatFlip = !st.__floatFlip;
      const slot = st.__floatFlip ? 1 : 2;
      setFloatCard(slot, { bot: pickOne.from, text: pickOne.text, estado: pickOne.estado });
    }
  } catch {}

  // aplica a widget y chat (una línea por tick)
  if (pickOne.from === "angie" && st.widgets.angie) {
    setBotState("angie", pickOne.estado || "feliz", {
      speak: true,
      from: `mix:${pickOne.sceneKey}`,
      overrideText: pickOne.text
    });
  } else if (pickOne.from === "mia" && st.widgets.mia) {
    setBotState("mia", pickOne.estado || (st.miaModo === "elegante" ? "elegante" : "guiando"), {
      speak: true,
      from: `mix:${pickOne.sceneKey}`,
      overrideText: pickOne.text
    });
  } else if (pickOne.from === "ciro" && st.widgets.ciro) {
    setBotState("ciro", pickOne.estado || "feliz", {
      speak: true,
      from: `mix:${pickOne.sceneKey}`,
      overrideText: pickOne.text
    });
  } else {
    // si el widget de ese bot está apagado, intenta uno visible
    const order = ["angie", "mia", "ciro"];
    for (const b of order) {
      if (b === "angie" && st.widgets.angie) { angieSetEstado("feliz", { speak: true, from: "rotación" }); break; }
      if (b === "mia" && st.widgets.mia) { miaSetEstado(st.miaModo === "elegante" ? "elegante" : "guiando", { speak: true, from: "rotación" }); break; }
      if (b === "ciro" && st.widgets.ciro) { ciroSetEstado("feliz", { speak: true, from: "rotación" }); break; }
    }
  }
}
  function markSceneSeen(key) {
    if (!key) return;
    st.seenScenes[key] = true;
    saveWidgetsPrefs();
  }

  function hasSeenScene(key) {
    return !!st.seenScenes?.[key];
  }

  function pickSceneForTab(tab) {
    const scenes = getScenes();
    const keys = Object.keys(scenes || {});
    if (!keys.length) return "";

    // preferimos escena con mismo nombre de tab si existe
    if (scenes[tab]) return tab;

    // fallback: usa "box" si estamos en box y existe
    if (tab === "box" && scenes["box"]) return "box";

    // si hay una escena relacionada con tab (contiene tab)
    const hit = keys.find((k) => k.includes(tab));
    if (hit) return hit;

    // random
    return keys[Math.floor(Math.random() * keys.length)] || keys[0];
  }

  // ---------------------------
  // “Según pestaña”
  // - Actualiza mount
  // - Autoplay escena (si ON) (1 vez por tab/escena para evitar spam)
  // ---------------------------
  function botsSegunVista(tab) {
    tab = String(tab || "").replace(/^#/, "").trim() || "inicio";
    JC.state.activeTab = tab;

    placeChatForTab(tab);

    // estado base por tab (sin spamear chat)
    // (si no hay escenas, al menos cambian vibes)
    if (!Object.keys(getScenes()).length) {
      if (tab === "inicio") {
        angieSetEstado("saludo", { speak: false, from: "tab" });
        miaSetEstado(st.miaModo === "elegante" ? "elegante" : "guiando", { speak: false, from: "tab" });
        ciroSetEstado("feliz", { speak: false, from: "tab" });
      } else if (tab === "comunidad") {
        angieSetEstado("traviesa", { speak: false, from: "tab" });
        miaSetEstado("apoyo", { speak: false, from: "tab" });
        ciroSetEstado("calm", { speak: false, from: "tab" });
      } else if (tab === "box") {
        ciroSetEstado("calm", { speak: false, from: "tab" });
        if (JC.state.botsEnabled) setCollapsed(false);
      } else {
        angieSetEstado("feliz", { speak: false, from: "tab" });
        miaSetEstado(st.miaModo === "elegante" ? "elegante" : "guiando", { speak: false, from: "tab" });
        ciroSetEstado("feliz", { speak: false, from: "tab" });
      }
      return;
    }

    // autoplay escena (automático, pero controlado por toggle)
    if (JC.state.botsEnabled) {
      const sk = pickSceneForTab(tab);
      // 1 vez por tab/escena (anti-spam). Si quieres repetir siempre, borra esta condición.
      const seenKey = `tab:${tab}::scene:${sk}`;
      if (!hasSeenScene(seenKey)) {
        markSceneSeen(seenKey);
        playScene(sk, { maxLines: AUTOPLAY_MAX_LINES, tag: `auto:${tab}` });
      }
    }

    if (tab === "box" && JC.state.botsEnabled) setCollapsed(false);
  }

  // ---------------------------
  // Toggle bots (ON/OFF gobierna TODO)
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

   function applyAllVisibility() {
    applyWidgetsVisibility();
    applyChatVisibility();
    setFloatVisible(!!JC.state.botsEnabled);
  }

  function toggleBots() {
    JC.state.botsEnabled = !JC.state.botsEnabled;
    savePersistedEnabled(JC.state.botsEnabled);

    // detener o iniciar motores
    if (!JC.state.botsEnabled) {
      clearSceneTimers();
      stopRotation();
    } else {
      startRotation();
      // al prender, refresca tab actual y lanza autoplay si toca
      try { botsSegunVista(JC.state.activeTab || (location.hash || "#inicio").replace("#", "")); } catch {}
    }

    applyAllVisibility();
    JC.emit("bots:toggled", { enabled: JC.state.botsEnabled });

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
    applyAllVisibility();
    startRotation();
    JC.emit("bots:toggled", { enabled: true });
  }

  function hideBots() {
    JC.state.botsEnabled = false;
    savePersistedEnabled(false);
    clearSceneTimers();
    stopRotation();
    applyAllVisibility();
    JC.emit("bots:toggled", { enabled: false });
  }

  // ---------------------------
  // Integración con router
  // ---------------------------
  function handleTabChange(tab) {
    botsSegunVista(tab);
    applyAllVisibility();
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

    try {
      window.activate = wrapped;
      JC.activate = wrapped;
    } catch {}

    st.wrappedActivate = true;
  }

  function activateHookRetries() {
    hookActivateWhenAvailable();
    if (st.wrappedActivate) return;
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

    // Restaura últimos estados (sin spam)
    try {
      angieSetEstado(st.last.angie?.estado || "feliz", { speak: false });
      miaSetEstado(st.last.mia?.estado || (st.miaModo === "elegante" ? "elegante" : "guiando"), { speak: false });
      ciroSetEstado(st.last.ciro?.estado || "feliz", { speak: false });
    } catch {}

    // Tab inicial
    const tab = (location.hash || "#inicio").replace("#", "").trim() || "inicio";
    handleTabChange(tab);

    // UI reflect
    applyAllVisibility();
    setCollapsed(false);

    // Hook router
    activateHookRetries();

    // Motores
    if (JC.state.botsEnabled) startRotation();
    else {
      clearSceneTimers();
      stopRotation();
    }

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

    JC.bots.miaSetModo = miaSetModo;

    JC.bots.playScene = playScene;           // manual si quieres
    JC.bots.startRotation = startRotation;   // manual si quieres
    JC.bots.stopRotation = stopRotation;     // manual si quieres

    // Compat global
    window.angieSetEstado = window.angieSetEstado || angieSetEstado;
    window.miaSetEstado = window.miaSetEstado || miaSetEstado;
    window.ciroSetEstado = window.ciroSetEstado || ciroSetEstado;

    try {
      console.log("[JC] bots.js init OK", {
        enabled: JC.state.botsEnabled,
        tab: JC.state.activeTab,
        hasScenes: !!Object.keys(getScenes()).length,
        rotateMs: ROTATE_MS
      });
    } catch {}
  }

  domReady(init);
})();