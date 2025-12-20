/* ============================================================
   JUVENTUD CNC — app.js FINAL (panel Angie en botón + bots + msg + eventos)
   ============================================================ */


   const JC_BUILD = window.JC_BUILD || "dev";

(function autoUpdateOnNewBuild() {
  let prev = null;
  try { prev = localStorage.getItem("jc_build"); } catch {}

  if (prev && prev !== JC_BUILD) {
    // limpieza suave sin tocar tus datos importantes
    try { sessionStorage.clear(); } catch {}

    // si existe caches API (PWA / SW) intentamos limpiar
    if ("caches" in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {});
    }

    // fuerza recarga con query param (revienta cache duro de Safari)
    const url = new URL(location.href);
    url.searchParams.set("v", JC_BUILD);
    try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
    location.replace(url.toString());
    return;
  }

  try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
})();


(() => {
  "use strict";

  /* =========================
     BOOT
     ========================= */
  const sb = window.supabaseClient;
  const LOCALE = "es-PE";
  const TZ = "America/Lima";

  if (!sb) {
    console.error("⚠️ Supabase no está listo (window.supabaseClient undefined). Revisa supabase-config.js y el orden de scripts.");
  }

  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

  const fmtDate = (d) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "long", month: "short", day: "numeric" }).format(d);

  const fmtDateTime = (d) =>
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);

  const pick = (arr, fallback = "") => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);

  const safeText = (s) => (typeof s === "string" ? s : s == null ? "" : String(s));

  /* =========================
     Drawer + overlay
     ========================= */
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const openDrawerBtn = $("#openDrawer");
  const closeDrawerBtn = $("#closeDrawer");

  const state = {
    drawerOpen: false,
    angieOpen: false
  };

  // =========================
  // BOTS: switch maestro (ON/OFF)
  // =========================
  let botsEnabled = true;
  try {
    const saved = localStorage.getItem("jc_bots_enabled");
    if (saved === "0") botsEnabled = false;
  } catch {}

  // para poder cancelar escenas/timers cuando apagas bots
  const botTimers = new Set();
  function botSetTimeout(fn, ms) {
    const id = setTimeout(() => {
      botTimers.delete(id);
      fn();
    }, ms);
    botTimers.add(id);
    return id;
  }
  function clearBotTimers() {
    botTimers.forEach((id) => clearTimeout(id));
    botTimers.clear();
  }

  // Alias de vistas (si en tu HTML aún existe 'avisos', lo tratamos como 'judart')
  function normalizeTab(t) {
    if (!t) return "inicio";
    const key = String(t).trim();
    if (key === "avisos") return "judart";
    return key;
  }

  function syncOverlay() {
    const shouldShow = state.drawerOpen || state.angieOpen;
    if (!overlay) return;
    overlay.classList.toggle("show", shouldShow);
  }

  function openDrawer() {
    if (!drawer) return;
    state.drawerOpen = true;
    drawer.classList.add("open");
    syncOverlay();
  }

  function closeDrawer() {
    if (!drawer) return;
    state.drawerOpen = false;
    drawer.classList.remove("open");
    syncOverlay();
  }

  openDrawerBtn?.addEventListener("click", openDrawer);
  closeDrawerBtn?.addEventListener("click", closeDrawer);

  overlay?.addEventListener("click", () => {
    closeDrawer();
    jcCloseAngieModal();
  });

  /* =========================
     Theme: presets + tokens (FIX brand-2 / neutral-900 etc)
     ========================= */
  const themePicker = $("#themePicker");

  function applyThemePreset(mode = "auto") {
    // presets sencillos (solo los principales)
    const presets = {
      chicos:  { brand: "#38bdf8", brand2: "#0ea5e9", "brand-2": "#0ea5e9", accent: "#60a5fa" },
      chicas:  { brand: "#f472b6", brand2: "#ec4899", "brand-2": "#ec4899", accent: "#fb7185" },
      mix:     { brand: "#2563eb", brand2: "#1d4ed8", "brand-2": "#1d4ed8", accent: "#ec4899" },
      auto:    null
    };

    const p = presets[mode];
    if (!p) return;

    const current = safeParse(localStorage.getItem("jc_tokens")) || {};
    const merged = { ...current, ...p };
    try { localStorage.setItem("jc_tokens", JSON.stringify(merged)); } catch {}
    jcApplyTokens(merged);
  }

  function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function jcApplyTokens(tokens) {
    if (!tokens) return;
    const root = document.documentElement;

    // La herramienta manda ids: brand, brand-2, accent, neutral-900...
    // Los convertimos a variables reales: --brand, --brand-2, --neutral-900...
    const map = {
      // herramienta Angie usa ids con guiones (brand-2, neutral-900...)
      brand: "--brand",
      brand2: "--brand-2",
      "brand-2": "--brand-2",
      accent: "--accent",
      neutral900: "--neutral-900",
      "neutral-900": "--neutral-900",
      neutral800: "--neutral-800",
      "neutral-800": "--neutral-800",
      neutral700: "--neutral-700",
      "neutral-700": "--neutral-700",
      neutral600: "--neutral-600",
      "neutral-600": "--neutral-600",
      neutral400: "--neutral-400",
      "neutral-400": "--neutral-400",
      neutral200: "--neutral-200",
      "neutral-200": "--neutral-200",
      neutral100: "--neutral-100",
      "neutral-100": "--neutral-100"
    };

    Object.entries(tokens).forEach(([k, v]) => {
      const cssVar = map[k] || (k.startsWith("--") ? k : `--${k}`);
      if (typeof v === "string" && v.trim()) root.style.setProperty(cssVar, v);
    });
  }

  // exponer (por si algo externo lo usa)
  window.jcApplyTokens = jcApplyTokens;

  // restaurar tokens en carga
  (function restoreTokensOnLoad() {
    const saved = safeParse(localStorage.getItem("jc_tokens"));
    if (saved) jcApplyTokens(saved);

    const mode = localStorage.getItem("jc_theme_mode");
    if (themePicker && mode) themePicker.value = mode;
  })();

  themePicker?.addEventListener("change", () => {
    const mode = themePicker.value || "auto";
    try { localStorage.setItem("jc_theme_mode", mode); } catch {}
    applyThemePreset(mode);
  });

  // botón maestro para encender/apagar bots
  ensureBotsButton();
  // aplicar estado inicial
  if (!botsEnabled) hideBotsUI();


  /* =========================
     Angie: Modal con herramienta (vive en el botón 🎨)
     (se ignora/oculta el panel viejo)
     ========================= */
  const btnAngie = $("#btnAngie");
  let angieModal = null;

  // esconder panel legacy si existe (ya no se usa)
  const legacyPanel = $("#angie-panel");
  if (legacyPanel) legacyPanel.style.display = "none";

  function jcBuildAngieModal() {
    if (angieModal) return;

    angieModal = document.createElement("div");
    angieModal.id = "jcAngieModal";
    angieModal.className = "jc-modal";

    angieModal.innerHTML = `
      <div class="jc-modal-card" role="dialog" aria-modal="true" aria-label="Diseño Angie">
        <header class="jc-modal-header">
          <div>
            <h3>🎨 Diseño Angie</h3>
            <p class="muted small">Paleta + emociones + modo Mia. (Ahora vive en este botón.)</p>
          </div>
          <button class="icon-btn" id="jcCloseAngie">✕</button>
        </header>

        <div class="jc-modal-tabs" id="jcAngieTabs">
          <button class="jc-seg active" data-panel="paleta">Paleta</button>
          <button class="jc-seg" data-panel="emociones">Emociones</button>
          <button class="jc-seg" data-panel="trama">Trama</button>
          <button class="jc-seg" data-panel="mia">Mia (modo)</button>
        </div>

        <div class="jc-modal-body">
          <section class="jc-panel active" data-panel="paleta">
            <div class="jc-card-mini">
              <h4>Paleta en tiempo real</h4>
              <p>Cambia colores en la herramienta y se aplican directo al app. Cierra con ✕ / overlay / ESC.</p>
            </div>
            <div class="jc-iframe">
              <iframe src="Angie herramienta.html" title="Herramienta Angie"></iframe>
            </div>
          </section>

          <section class="jc-panel" data-panel="emociones">
            <div class="jc-card-mini">
              <h4>Emociones rápidas</h4>
              <p>Para que se note la relación: Mia guía, Ciro empuja, Angie le pone chispa (y humor).</p>
            </div>

            <div class="jc-card-mini">
              <h4>Angie</h4>
              <div class="jc-pills" id="jcAngiePills"></div>
            </div>

            <div class="jc-card-mini">
              <h4>Mia</h4>
              <div class="jc-pills" id="jcMiaPills"></div>
            </div>

            <div class="jc-card-mini">
              <h4>Ciro</h4>
              <div class="jc-pills" id="jcCiroPills"></div>
            </div>
          </section>

          <section class="jc-panel" data-panel="trama">
            <div class="jc-card-mini">
              <h4>📖 Trama rápida (para no olvidarla)</h4>
              <p>
                <strong>Mia</strong> es la coordinadora: organiza, calma y acompaña. Tiene dos modos:
                <em>Casual</em> (día a día) y <em>Elegante</em> (modo “presentación / liderazgo / diseño”).<br><br>
                <strong>Ciro</strong> es el monaguillo con voluntad fuerte: empuja a la acción, protege el orden y el respeto,
                se emociona rápido, pero aprende a respirar.<br><br>
                <strong>Angie</strong> es la chispa: dulce, traviesa y emocional; rompe tensión con humor, anima y acompaña.
                Los tres se complementan: <em>orden (Mia)</em> + <em>fuerza (Ciro)</em> + <em>brillo (Angie)</em>.
              </p>
            </div>
          </section>

          <section class="jc-panel" data-panel="mia">
            <div class="jc-card-mini">
              <h4>Mia: modo</h4>
              <p>Cambia el modo de Mia (Casual / Elegante). En perfil se pone elegante automáticamente.</p>
              <div class="jc-row">
                <button class="btn small" id="jcMiaCasual">Casual</button>
                <button class="btn small" id="jcMiaElegante">Elegante</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(angieModal);

    // tabs
    const tabs = $$("[data-panel]", $("#jcAngieTabs"));
    const panels = $$("[data-panel]", angieModal).filter((x) => x.classList.contains("jc-panel"));
    tabs.forEach((b) => {
      b.addEventListener("click", () => {
        tabs.forEach((x) => x.classList.toggle("active", x === b));
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === b.dataset.panel));
      });
    });

    $("#jcCloseAngie")?.addEventListener("click", jcCloseAngieModal);

    // Mia mode
    $("#jcMiaCasual")?.addEventListener("click", () => miaSetModo("casual"));
    $("#jcMiaElegante")?.addEventListener("click", () => miaSetModo("elegante"));

    // ESC
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") jcCloseAngieModal();
    });

    // fill emotion buttons after build
    botSetTimeout(fillEmotionButtons, 50);
  }

  function jcOpenAngieModal() {
    jcBuildAngieModal();
    state.angieOpen = true;
    angieModal?.classList.add("show");
    syncOverlay();
    // Mia elegante cuando modal está abierto
    miaSetModo("elegante");
  }

  function jcCloseAngieModal() {
    state.angieOpen = false;
    angieModal?.classList.remove("show");
    syncOverlay();
  }

  // exponer (por compat con overlay click)
  window.jcCloseAngieModal = jcCloseAngieModal;

  // botón Angie abre modal
  btnAngie?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!botsEnabled) setBotsEnabled(true, { silent: true });
    jcOpenAngieModal();
  }, { capture: true });

  /* =========================
     PostMessage desde herramienta Angie (paleta)
     ========================= */
  window.addEventListener("message", (ev) => {
    const data = ev?.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "applyTokens" && data.tokens) {
      const tokens = data.tokens;
      try { localStorage.setItem("jc_tokens", JSON.stringify(tokens)); } catch {}
      jcApplyTokens(tokens);
      try { logAviso({ title: "Paleta aplicada", body: "Colores actualizados 🎨" }); } catch {}
      return;
    }

    // emociones desde herramienta
    if (data.type === "angieEstado" && data.estado) {
      angieSetEstado(data.estado);
      return;
    }
    if (data.type === "miaEstado" && data.estado) {
      miaSetEstado(data.estado);
      return;
    }
    if (data.type === "ciroEstado" && data.estado) {
      ciroSetEstado(data.estado);
      return;
    }
  });

  /* =========================
     EVENTOS: Home y lista
     ========================= */
  async function cargarEventosHome() {
    const ul = $("#eventListHome");
    if (!ul) return;

    ul.innerHTML = "<li class='muted small'>Cargando…</li>";

    if (!sb?.from) {
      ul.innerHTML = "<li class='muted small'>No hay conexión al servidor.</li>";
      return;
    }

    try {
      const { data, error } = await sb
        .from("eventos")
        .select("id,titulo,fecha,lugar,tipo")
        .order("fecha", { ascending: true })
        .limit(5);

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        ul.innerHTML = "<li class='muted small'>Aún no hay eventos.</li>";
        return;
      }

      ul.innerHTML = "";
      list.forEach((ev) => {
        const li = document.createElement("li");
        li.className = "event-item";
        const d = ev.fecha ? new Date(ev.fecha) : null;

        li.innerHTML = `
          <div>
            <div class="event-title"><strong>${safeText(ev.titulo || "Evento")}</strong></div>
            <div class="muted small">${safeText(ev.lugar || "")}</div>
          </div>
          <div class="event-meta muted small">${d ? fmtDateTime(d) : ""}</div>
        `;
        ul.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarEventosHome:", e);
      ul.innerHTML = "<li class='muted small'>Error cargando eventos.</li>";
    }
  }

  /* =========================
     Mensaje semanal (Supabase)
     ========================= */
  async function cargarMensajeSemanal() {
    const title = $("#msgTitle");
    const body = $("#msgBody");
    const meta = $("#msgMeta");

    if (!title || !body) return;

    title.textContent = "Cargando…";
    body.textContent = "Un momento…";
    if (meta) meta.textContent = "";

    if (!sb?.from) {
      title.textContent = "Sin conexión";
      body.textContent = "No se puede cargar el mensaje semanal.";
      return;
    }

    try {
      const { data, error } = await sb
        .from("mensajes_semanales")
        .select("titulo,contenido,fecha")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        title.textContent = "Aún no hay mensaje";
        body.textContent = "Pronto aparecerá el mensaje semanal ✨";
        return;
      }

      title.textContent = safeText(data.titulo || "Mensaje semanal");
      body.textContent = safeText(data.contenido || "");
      if (meta && data.fecha) meta.textContent = `Actualizado: ${fmtDate(new Date(data.fecha))}`;
    } catch (e) {
      console.error("Error cargarMensajeSemanal:", e);
      title.textContent = "Error";
      body.textContent = "No se pudo cargar el mensaje semanal.";
    }
  }

  /* =========================
     EVENTOS (vista Eventos)
     ========================= */
  async function cargarEventos({ destinoId = "eventList", tipo = "" } = {}) {
    const ul = document.getElementById(destinoId);
    if (!ul) return;

    ul.innerHTML = "<li class='muted small'>Cargando…</li>";

    if (!sb?.from) {
      ul.innerHTML = "<li class='muted small'>No hay conexión al servidor.</li>";
      return;
    }

    try {
      let q = sb.from("eventos").select("id,titulo,fecha,lugar,tipo").order("fecha", { ascending: true });
      if (tipo) q = q.eq("tipo", tipo);

      const { data, error } = await q;
      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        ul.innerHTML = "<li class='muted small'>No hay eventos para mostrar.</li>";
        return;
      }

      ul.innerHTML = "";
      list.forEach((ev) => {
        const li = document.createElement("li");
        li.className = "event-item";
        const d = ev.fecha ? new Date(ev.fecha) : null;
        li.innerHTML = `
          <div>
            <div class="event-title"><strong>${safeText(ev.titulo || "Evento")}</strong></div>
            <div class="muted small">${safeText(ev.lugar || "")}</div>
          </div>
          <div class="event-meta muted small">${d ? fmtDateTime(d) : ""}</div>
        `;
        ul.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarEventos:", e);
      ul.innerHTML = "<li class='muted small'>Error cargando eventos.</li>";
    }
  }

  $("#filtroTipo")?.addEventListener("change", () => {
    const tipo = $("#filtroTipo")?.value || "";
    cargarEventos({ destinoId: "eventList", tipo });
  });

  const formEvento = $("#formEvento");
  formEvento?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const evEstado = $("#evEstado");
    if (evEstado) {
      evEstado.classList.remove("error");
      evEstado.textContent = "Guardando…";
    }

    if (!sb?.from) {
      if (evEstado) evEstado.textContent = "No hay conexión al servidor.";
      return;
    }

    const titulo = $("#evTitulo")?.value?.trim();
    const fecha = $("#evFecha")?.value;
    const lugar = $("#evLugar")?.value?.trim() || "";
    const tipo = $("#evTipo")?.value?.trim() || "";

    if (!titulo || !fecha) {
      if (evEstado) {
        evEstado.textContent = "Completa título y fecha.";
        evEstado.classList.add("error");
      }
      angieSetEstado("confundida");
      return;
    }

    try {
      const { error } = await sb.from("eventos").insert({ titulo, fecha, lugar, tipo });
      if (error) throw error;

      formEvento.reset();
      if (evEstado) evEstado.textContent = "Evento guardado ✅";

      logAviso({ title: "Nuevo evento", body: `${titulo} (${tipo || "general"})` });

      const tipoFiltro = document.getElementById("filtroTipo")?.value || "";
      cargarEventos({ destinoId: "eventList", tipo: tipoFiltro });
      cargarEventosHome();

      ciroSetEstado("excited");
      angieSetEstado("sorprendida");
    } catch (err) {
      console.error("Error insertando evento:", err);
      if (evEstado) {
        evEstado.textContent = "No se pudo guardar el evento. Intenta más tarde.";
        evEstado.classList.add("error");
      }
      angieSetEstado("confundida");
    }
  });

  /* =========================
     BOTS: estados + preload + modo Mia
     ========================= */
  function jcPreloadImages(paths = []) {
    const uniq = Array.from(new Set(paths.filter(Boolean)));
    uniq.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }

  // === Angie (todos tus assets)
  const ANGIE_ESTADOS = {
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
      frases: [
        "¿QUÉ? 😳 ok… interesante…",
        "Eso sí no lo vi venir 👀",
        "Mia… ¿tú sabías esto? 😅"
      ]
    },
    ok: {
      img: "assets/angie-ok.png",
      frases: [
        "Listo ✅",
        "¡Perfecto! quedó bonito 💗",
        "Ciro: aprobado. Mia: ordenado. Yo: feliz 😌"
      ]
    },
    vergonzosa: {
      img: "assets/angie-vergonzosa.png",
      frases: [
        "Awww… ok, me da pena 😳",
        "No me mires así 😅",
        "Mia dice que sea formal… pero yo soy así 🤭"
      ]
    }
  };

  function angieSetEstado(tipo = "feliz") {
    const widget = document.getElementById("angieWidget");
    const imgEl = document.getElementById("angieAvatarImg");
    const textEl = document.getElementById("angieText");
    if (!widget || !textEl) return;

    let estado = ANGIE_ESTADOS[tipo];
    if (!estado) estado = ANGIE_ESTADOS.feliz;

    if (imgEl && estado.img) imgEl.src = estado.img;
    textEl.textContent = pick(estado.frases, "Hola, estoy aquí para ayudarte 💗");

    widget.classList.add("angie-widget--visible");
  }
  window.angieSetEstado = angieSetEstado;

  // === Mia (todos tus assets)
  const MIA_ESTADOS = {
    guiando: {
      img: "assets/mia-casual-wink.png",
      frases: [
        "Soy Mia. Aquí todo lo coordinamos con calma 💗",
        "Respira. Vamos paso a paso.",
        "¿Qué necesitas? Te acompaño."
      ]
    },
    apoyo: {
      img: "assets/mia-casual.png",
      frases: [
        "Bien, vamos avanzando 💗",
        "Todo suma. Lo importante es seguir.",
        "Te apoyo en lo que necesites."
      ]
    },
    elegant_relief: {
      img: "assets/mia-elegante.png",
      frases: [
        "Modo elegante. Orden + claridad ✨",
        "Presentemos esto bonito.",
        "Vamos a dejarlo impecable."
      ]
    }
  };

  function miaSetEstado(tipo = "guiando") {
    const widget = document.getElementById("miaWidget");
    const imgEl = document.getElementById("miaAvatarImg");
    const textEl = document.getElementById("miaText");
    if (!widget || !textEl) return;

    let estado = MIA_ESTADOS[tipo];
    if (!estado) estado = MIA_ESTADOS.guiando;

    if (imgEl && estado.img) imgEl.src = estado.img;
    textEl.textContent = pick(estado.frases, "Estoy aquí 💗");

    widget.classList.add("mia-widget--visible");
  }
  window.miaSetEstado = miaSetEstado;

  // ✅ FIX: miaSetModo existe y está expuesta
  let miaModo = localStorage.getItem("jc_mia_modo") || "casual"; // casual|elegante

  function miaSetModo(modo = "casual") {
    miaModo = modo === "elegante" ? "elegante" : "casual";
    try { localStorage.setItem("jc_mia_modo", miaModo); } catch {}

    if (miaModo === "elegante") {
      miaSetEstado("elegant_relief");
    } else {
      miaSetEstado("guiando");
    }
  }
  window.miaSetModo = miaSetModo;

  // === Ciro (todos tus assets)
  const CIRO_ESTADOS = {
    feliz: {
      img: "assets/ciro-happy.png",
      frases: [
        "¡Holaaa! ¡Vamos con fuerza! 💪🔥",
        "Hoy se sirve con alegría 🙌",
        "Mia organizó… yo ejecuto 😤"
      ]
    },
    excited: {
      img: "assets/ciro-excited.png",
      frases: [
        "¡YA! Dime qué hacemos 😄",
        "Estoy listo, listo, listo 💥",
        "Angie, no distraigas… (ok, un poquito sí 😅)"
      ]
    },
    calm: {
      img: "assets/ciro-calm.png",
      frases: [
        "Estoy concentrado… dame un segundo.",
        "Paso firme, mente en paz.",
        "Mia tiene razón: primero orden."
      ]
    },
    worried: {
      img: "assets/ciro-worried.png",
      frases: [
        "Eh… ¿y si sale mal? 😬",
        "Ok… lo intentamos de nuevo.",
        "Angie… no te rías 😅"
      ]
    },
    pray: {
      img: "assets/ciro-pray.png",
      frases: [
        "Un momento… oración primero 🙏",
        "Señor, guíanos.",
        "Mia, gracias por recordarnos lo esencial."
      ]
    },
    happy_pray: {
      img: "assets/ciro-happy-pray.png",
      frases: [
        "¡Orando y con alegría! 😇",
        "Dios por delante, siempre.",
        "Angie, hoy sí te salió bonito 💙"
      ]
    },
    stop: {
      img: "assets/ciro-stop.png",
      frases: [
        "¡Alto ahí! Eso no va 😤",
        "Respeto primero.",
        "Mia, ¿lo hablamos? Yo me calmo."
      ]
    }
  };

  function ciroSetEstado(tipo = "feliz") {
    const widget = document.getElementById("ciroWidget");
    const imgEl = document.getElementById("ciroAvatarImg");
    const textEl = document.getElementById("ciroText");
    if (!widget || !textEl) return;

    let estado = CIRO_ESTADOS[tipo];
    if (!estado) estado = CIRO_ESTADOS.feliz;

    if (imgEl && estado.img) imgEl.src = estado.img;
    textEl.textContent = pick(estado.frases, "Estoy atento a lo que necesites 🙌");

    widget.classList.add("ciro-widget--visible");
  }
  window.ciroSetEstado = ciroSetEstado;

  // preload de todos los assets de bots
  (function preloadAllBotImages() {
    const all = [
      ...Object.values(ANGIE_ESTADOS).map((x) => x.img),
      ...Object.values(MIA_ESTADOS).map((x) => x.img),
      ...Object.values(CIRO_ESTADOS).map((x) => x.img)
    ];
    jcPreloadImages(all);
  })();

  // fallback: si un asset no existe (GitHub Pages es sensible a mayúsculas), avisamos y evitamos "widget vacío"
  function bindImgFallback(imgEl, who = "asset") {
    if (!imgEl) return;
    imgEl.addEventListener("error", () => {
      imgEl.style.opacity = "0.25";
      imgEl.title = `No se encontró: ${imgEl.getAttribute("src")}`;
      try { logAviso({ title: `Falta un asset de ${who}`, body: imgEl.getAttribute("src") || "" }); } catch {}
    });
  }
  bindImgFallback(document.getElementById("angieAvatarImg"), "Angie");
  bindImgFallback(document.getElementById("miaAvatarImg"), "Mia");
  bindImgFallback(document.getElementById("ciroAvatarImg"), "Ciro");

  // cierre widgets (si quieres permitir cerrar)
  document.getElementById("angieClose")?.addEventListener("click", () => $("#angieWidget")?.classList.remove("angie-widget--visible"));
  document.getElementById("miaClose")?.addEventListener("click", () => $("#miaWidget")?.classList.remove("mia-widget--visible"));
  document.getElementById("ciroClose")?.addEventListener("click", () => $("#ciroWidget")?.classList.remove("ciro-widget--visible"));

  /* =========================
     CHAT
     ========================= */
  let jcChatBody = document.getElementById("jcChatBody");
  let jcChatWidget = document.getElementById("jcChat");
  let jcChatToggle = document.getElementById("jcChatToggle");

  // Si tu index nuevo no trae el chat, lo creamos para no romper CSS ni bots
  (function ensureChatWidget() {
    if (jcChatWidget && jcChatBody) return;

    const chat = document.createElement("section");
    chat.className = "jc-chat";
    chat.id = "jcChat";
    chat.innerHTML = `
      <header class="jc-chat-header">
        <div class="jc-chat-title">
          <span class="dot-online"></span>
          <span>Chat bots</span>
        </div>
        <button class="jc-chat-toggle" id="jcChatToggle" title="Colapsar">⌄</button>
      </header>
      <div class="jc-chat-body" id="jcChatBody"></div>
    `;
    document.body.appendChild(chat);

    jcChatWidget = chat;
    jcChatBody = document.getElementById("jcChatBody");
    jcChatToggle = document.getElementById("jcChatToggle");
  })();

  const JC_CHAR_INFO = {
    mia: { name: "Mia", initial: "M" },
    ciro: { name: "Ciro", initial: "C" },
    angie: { name: "Angie", initial: "A" },
    system: { name: "Sistema", initial: "★" }
  };

  function hideBotsUI() {
    document.getElementById("angieWidget")?.classList.remove("angie-widget--visible");
    document.getElementById("miaWidget")?.classList.remove("mia-widget--visible");
    document.getElementById("ciroWidget")?.classList.remove("ciro-widget--visible");
    if (jcChatWidget) jcChatWidget.style.display = "none";
    clearBotTimers();
  }

  function showBotsUI() {
    if (jcChatWidget) jcChatWidget.style.display = "";
  }

  function setBotsEnabled(on, { silent = false } = {}) {
    botsEnabled = !!on;
    try { localStorage.setItem("jc_bots_enabled", botsEnabled ? "1" : "0"); } catch {}

    if (!botsEnabled) {
      hideBotsUI();
      if (!silent) {
        try { logAviso({ title: "Bots apagados", body: "Puedes volver a encenderlos con 🤖" }); } catch {}
      }
    } else {
      showBotsUI();
      if (!silent) {
        jcChatAddMessage({ from: "system", text: "Bots encendidos 🤖✨" });
      }
      const current = normalizeTab((location.hash || "#inicio").replace("#", ""));
      botsSegunVista(current);
    }

    updateBotsButtonUI();
  }

  function ensureBotsButton() {
    const actions = document.querySelector(".topbar-actions");
    if (!actions) return;

    let btn = document.getElementById("btnBots");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnBots";
      btn.className = "icon-btn";
      btn.type = "button";
      btn.title = "Encender / Apagar bots";
      btn.textContent = "🤖";
      actions.insertBefore(btn, document.getElementById("btnAngie") || actions.lastElementChild);
    }

    btn.addEventListener("click", () => setBotsEnabled(!botsEnabled));

    updateBotsButtonUI();
  }

  function updateBotsButtonUI() {
    const btn = document.getElementById("btnBots");
    if (!btn) return;
    btn.setAttribute("aria-pressed", botsEnabled ? "true" : "false");
    btn.style.opacity = botsEnabled ? "1" : "0.55";
    btn.title = botsEnabled ? "Bots encendidos (clic para apagar)" : "Bots apagados (clic para encender)";
  }

  function jcChatAddMessage(msg) {
    if (!jcChatBody) return;
    if (!botsEnabled) return;

    const info = JC_CHAR_INFO[msg.from] || JC_CHAR_INFO.system;

    const row = document.createElement("div");
    row.className = `jc-chat-msg from-${msg.from || "system"}`;

    row.innerHTML = `
      <div class="jc-chat-avatar">${info.initial}</div>
      <div class="jc-chat-bubble">
        <div class="jc-chat-name">${info.name}</div>
        <div class="jc-chat-text">${safeText(msg.text || "")}</div>
      </div>
    `;

    jcChatBody.appendChild(row);
    jcChatBody.scrollTop = jcChatBody.scrollHeight;

    // sincronizar emociones
    if (msg.from === "angie") angieSetEstado(msg.estado || "feliz");
    if (msg.from === "mia") miaSetEstado(msg.estado || (miaModo === "elegante" ? "elegant_relief" : "guiando"));
    if (msg.from === "ciro") ciroSetEstado(msg.estado || "feliz");
  }

  const JC_CHAT_SCENES = {
    inicio: [
      { from: "mia", text: "¡Hola! Soy Mia, coordino Juventud CNC. Te acompaño 💗", estado: "guiando", delay: 400 },
      { from: "ciro", text: "Y yo soy Ciro. Si hay que servir, ¡yo voy primero! 💪", estado: "excited", delay: 900 },
      { from: "angie", text: "Yo soy Angie… y sí: hoy toca algo épico ✨", estado: "feliz", delay: 1400 }
    ],
    eventos: [
      { from: "mia", text: "Revisa los eventos y mira dónde puedes sumarte 🙌", estado: "apoyo", delay: 400 },
      { from: "ciro", text: "Yo ya me apunté. Vamos con fuerza 🔥", estado: "excited", delay: 1100 },
      { from: "angie", text: "Crea uno nuevo… me encanta llenar la agenda 😏", estado: "traviesa", delay: 1700 }
    ],
    perfil: [
      { from: "mia", text: "Aquí es para conocerte mejor. Nombre y frase 📝", estado: "elegant_relief", delay: 400 },
      { from: "ciro", text: "Prometo no llenarte de tareas… (bueno, intentaré 😂)", estado: "feliz", delay: 1200 }
    ],
    recursos: [
      { from: "angie", text: "Esto será nuestra biblioteca: cantos, guías y materiales 📂", estado: "ok", delay: 400 },
      { from: "mia", text: "Cuando subas algo, piensa: ¿ayuda a acercar a alguien a Dios? 💭", estado: "guiando", delay: 1200 }
    ],
    judart: [
      { from: "angie", text: "Judart es nuestro rincón creativo 🎨✨", estado: "traviesa", delay: 400 },
      { from: "mia", text: "Aquí vamos a subir arte, diseños y momentos bonitos del grupo 💗", estado: "apoyo", delay: 1200 },
      { from: "ciro", text: "Arte con propósito. Disciplina + talento 😤", estado: "calm", delay: 1900 }
    ],
    // compat con la vista antigua (antes se llamaba 'avisos')
    avisos: [
      { from: "angie", text: "Judart 🎨 (antes ‘Avisos’). Aquí va el arte del grupo ✨", estado: "traviesa", delay: 400 },
      { from: "mia", text: "Contenido creativo y sano para todos 💗", estado: "apoyo", delay: 1200 }
    ],
    "miembros-activos": [
      { from: "angie", text: "¡Mira cuántos ya se están sumando! 👥", estado: "feliz", delay: 400 },
      { from: "ciro", text: "Algún día: pizza gigante con todos los nombres 🍕", estado: "feliz", delay: 1200 }
    ]
  };

  function jcChatPlayScene(viewKey) {
    if (!botsEnabled) return;
    const vk = normalizeTab(viewKey);
    const scene = JC_CHAT_SCENES[vk] || JC_CHAT_SCENES[viewKey];
    if (!scene || !jcChatWidget) return;

    const storageKey = `jc_chat_scene_${vk}`;
    if (sessionStorage.getItem(storageKey) === "1") return;
    sessionStorage.setItem(storageKey, "1");

    let totalDelay = 0;
    scene.forEach((msg) => {
      totalDelay += typeof msg.delay === "number" ? msg.delay : 800;
      botSetTimeout(() => jcChatAddMessage(msg), totalDelay);
    });
  }

  jcChatToggle?.addEventListener("click", () => {
    jcChatWidget?.classList.toggle("jc-chat--collapsed");
  });

  // escena inicial
  setTimeout(() => {
    const initialTab = (location.hash || "#inicio").replace("#", "");
    jcChatPlayScene(initialTab || "inicio");
  }, 700);

  /* =========================
     Rellenar botones del modal (emociones)
     ========================= */
  function fillEmotionButtons() {
    if (!angieModal) return;

    const angieWrap = document.getElementById("jcAngiePills");
    const miaWrap = document.getElementById("jcMiaPills");
    const ciroWrap = document.getElementById("jcCiroPills");
    if (!angieWrap || !miaWrap || !ciroWrap) return;

    const buildPills = (wrap, keys, onClick) => {
      wrap.innerHTML = "";
      keys.forEach((k) => {
        const b = document.createElement("button");
        b.className = "pill";
        b.type = "button";
        b.textContent = k;
        b.addEventListener("click", () => onClick(k));
        wrap.appendChild(b);
      });
    };

    buildPills(angieWrap, Object.keys(ANGIE_ESTADOS), (k) => {
      angieSetEstado(k);
      jcChatAddMessage({ from: "angie", text: `Mood: ${k} ✨`, estado: k });
    });

    buildPills(miaWrap, Object.keys(MIA_ESTADOS), (k) => {
      miaSetEstado(k);
      jcChatAddMessage({ from: "mia", text: `Estoy en modo: ${k} 💗`, estado: k });
    });

    buildPills(ciroWrap, Object.keys(CIRO_ESTADOS), (k) => {
      ciroSetEstado(k);
      jcChatAddMessage({ from: "ciro", text: `Estado: ${k} 💪`, estado: k });
    });
  }

  /* =========================
     AVISOS/Judart (UI log)
     ========================= */
  const avisosList = document.getElementById("avisosList");
  function logAviso({ title = "Aviso", body = "" }) {
    // si existe lista, escribimos ahí; si no, lo mandamos al chat para no perder info
    if (avisosList) {
      const li = document.createElement("li");
      li.className = "notice-item";
      li.textContent = `${new Date().toLocaleTimeString(LOCALE, { timeZone: TZ })} — ${title}: ${body}`;
      avisosList.prepend(li);
      return;
    }
    jcChatAddMessage({ from: "system", text: `${title}: ${body}` });
  }
  window.logAviso = logAviso;

    /* =========================
     COMUNIDAD (init)
     ========================= */
  const comunidad = createComunidadModule({
    sb,
    $,
    $$,
    safeText,
    fmtDateTime,
    normalizeTab,
    logAviso,
    angieSetEstado,
    miaSetEstado,
    ciroSetEstado
  });

  comunidad.init();

  /* =========================
     MIEMBROS
     ========================= */
  async function cargarListaMiembros() {
    const lista = document.getElementById("listaMiembros");
    if (!lista) return;

    lista.innerHTML = "<li>Cargando...</li>";

    if (!sb?.from) {
      lista.innerHTML = "<li>No se puede conectar al servidor.</li>";
      return;
    }

    try {
      const { data, error } = await sb.from("miembros").select("nombre, rol_key").order("created_at", { ascending: false }).limit(80);
      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        lista.innerHTML = "<li>No hay miembros registrados aún.</li>";
        return;
      }

      lista.innerHTML = "";
      list.forEach((m) => {
        const li = document.createElement("li");
        li.className = "user-item";

        const labelRol =
          m.rol_key === "moderador" ? "Moderador" :
          m.rol_key === "voluntario" ? "Voluntario digital" :
          m.rol_key === "admin" ? "Admin" :
          "Miembro";

        li.innerHTML = `
          <div>
            <div><strong>${safeText(m.nombre || "Usuario")}</strong></div>
            <div class="muted small">${labelRol}</div>
          </div>
          <span class="estado-activo">Activo</span>
        `;

        lista.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarListaMiembros:", e);
      lista.innerHTML = "<li>Error cargando miembros.</li>";
    }
  }

  /* =========================
     RECURSOS (tabla + storage)
     ========================= */
  async function listarRecursos() {
    const cont = document.getElementById("listaRecursos");
    if (!cont) return;

    cont.innerHTML = `<p class="muted small">Cargando recursos…</p>`;

    if (!sb?.from) {
      cont.innerHTML = `<p class="muted small">No se puede conectar al servidor.</p>`;
      return;
    }

    try {
      const { data, error } = await sb.from("recursos").select("id,titulo,categoria,path,mime,created_at").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        cont.innerHTML = `<p class="muted small">Aún no hay recursos subidos.</p>`;
        return;
      }

      const rows = await Promise.all(list.map(async (r) => {
        let url = "";
        try {
          if (sb?.storage?.from) {
            const { data: pub } = sb.storage.from("recursos").getPublicUrl(r.path);
            url = pub?.publicUrl || "";
          }
        } catch {}

        return `
          <div class="resource-item">
            <div>
              <div><strong>${safeText(r.titulo || "Recurso")}</strong></div>
              <div class="muted small">${safeText(r.categoria || "")} • ${r.created_at ? fmtDateTime(new Date(r.created_at)) : ""}</div>
            </div>
            ${url ? `<a class="btn small" href="${url}" target="_blank" rel="noreferrer">Abrir</a>` : `<span class="muted small">Sin URL</span>`}
          </div>
        `;
      }));

      cont.innerHTML = rows.join("");
    } catch (e) {
      console.error("Error listarRecursos:", e);
      cont.innerHTML = `<p class="muted small">Error cargando recursos.</p>`;
    }
  }

  // subida
  const fileInput = document.getElementById("fileRec");
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!sb?.storage || !sb?.from) {
      alert("Servidor no disponible para subir.");
      return;
    }

    try {
      const path = `${Date.now()}-${file.name}`;
      const { error: upErr } = await sb.storage.from("recursos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      let userId = null;
      try {
        if (sb?.auth?.getUser) {
          const { data: u } = await sb.auth.getUser();
          userId = u?.user?.id || null;
        }
      } catch {}

      await sb.from("recursos").insert({
        titulo: file.name,
        categoria: file.type.includes("pdf") ? "pdf" :
                  file.type.includes("audio") ? "audio" :
                  file.type.includes("image") ? "imagen" : "otro",
        path,
        mime: file.type,
        subido_por: userId
      });

      logAviso({ title: "Recurso subido", body: file.name });
      listarRecursos();
      angieSetEstado("ok");
    } catch (e) {
      console.error("Error subiendo recurso:", e);
      alert("Error al subir archivo");
      angieSetEstado("confundida");
    } finally {
      try { fileInput.value = ""; } catch {}
    }
  });

  /* =========================
     SPA / TABS
     ========================= */
  const tabs = $$(".tab");
  const views = $$(".view");

  function showView(key) {
    const k = normalizeTab(key);
    let has = false;
    views.forEach((v) => { if (v.dataset.view === k) has = true; });
    const fallback = k === "judart" && !has ? "avisos" : k;
    views.forEach((v) => v.classList.toggle("active", v.dataset.view === fallback));
  }

  function activate(tab) {
    const tRaw = typeof tab === "string" ? tab : tab?.dataset?.tab;
    if (!tRaw) return;
    const t = normalizeTab(tRaw);

    tabs.forEach((b) => {
      const on = normalizeTab(b.dataset.tab) === t;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    showView(t);

    if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);

    // cargas por vista
    botsSegunVista(t);

    comunidad.onTab(t);

    if (t === "miembros-activos") cargarListaMiembros();
    if (t === "eventos") cargarEventos({ destinoId: "eventList", tipo: $("#filtroTipo")?.value || "" });
    if (t === "recursos") listarRecursos();
  }

  // Drawer links + "Ver todos"
  $$("[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      activate(el.getAttribute("data-tab"));
      closeDrawer();
    });
  });

  window.addEventListener("hashchange", () => activate((location.hash || "#inicio").replace("#", "")));

  // inicial
  activate((location.hash || "#inicio").replace("#", ""));

  // exponer por compat
  window.activate = activate;

  /* =========================
     BOTs según vista
     ========================= */
  function botsSegunVista(tab) {
  const t = normalizeTab(tab);

  if (!botsEnabled) {
    hideBotsUI();
    return;
  }

  // --- solo 1 bot visible ---
  const wAngie = document.getElementById("angieWidget");
  const wMia   = document.getElementById("miaWidget");
  const wCiro  = document.getElementById("ciroWidget");

  function showOnly(which) {
    wAngie?.classList.toggle("angie-widget--visible", which === "angie");
    wMia?.classList.toggle("mia-widget--visible", which === "mia");
    wCiro?.classList.toggle("ciro-widget--visible", which === "ciro");
  }

  // Rotación por pestaña (cada vez que entras, cambia el bot)
  const key = `jc_bot_turn_${t}`;
  let turn = Number(sessionStorage.getItem(key) || "0");
  turn = (turn + 1) % 3;
  sessionStorage.setItem(key, String(turn));

  const order = ["angie", "mia", "ciro"];
  let activeBot = order[turn];

  // Si estás en perfil, preferimos Mia (modo elegante) para guiar el registro
  if (t === "perfil") activeBot = "mia";

  // Estados por vista
  const mapaAngie = {
    inicio: "feliz",
    eventos: "sorprendida",
    comunidad: "saludo",
    recursos: "confundida",
    judart: "traviesa",
    avisos: "traviesa",
    "miembros-activos": "ok",
    perfil: "vergonzosa"
  };

  // Mia elegante en perfil o cuando modal Angie está abierto
  if (t === "perfil" || state.angieOpen) miaSetModo("elegante");
  else miaSetModo("casual");

  // Solo “habla” el bot visible (los demás se quedan ocultos)
  if (activeBot === "angie") {
    showOnly("angie");
    angieSetEstado(mapaAngie[t] || "feliz");
  } else if (activeBot === "mia") {
    showOnly("mia");
    // Mia: guía según vista
    miaSetEstado(t === "comunidad" ? "apoyo" : "guiando");
  } else {
    showOnly("ciro");
    // Ciro reacciona por vista
    if (t === "eventos") ciroSetEstado("excited");
    else if (t === "judart" || t === "avisos") ciroSetEstado("stop");
    else if (t === "inicio") ciroSetEstado("feliz");
    else ciroSetEstado("calm");
  }

  // Chat escena se mantiene (ya sale secuencial con delays) :contentReference[oaicite:2]{index=2}
  jcChatPlayScene(t);
}

/* =========================
   PERFIL (LISTO)
   - Auto sesión anónima (si está habilitada en Supabase)
   - Si ya está registrado: oculta formulario
   - Si no: muestra formulario
   - Avatar: muestra inicial + opcional foto (dataURL local)
   ========================= */
const formMiembro = document.getElementById("formMiembro");
const perfilNombreTexto = document.getElementById("perfilNombreTexto");
const perfilRolTexto = document.getElementById("perfilRolTexto");
const perfilFraseTexto = document.getElementById("perfilFraseTexto");
const perfilEstado = document.getElementById("perfilEstado");
const btnCerrarPerfil = document.getElementById("btnCerrarPerfil");

// Avatar UI
const perfilAvatar = document.getElementById("perfilAvatar");
const perfilAvatarImg = document.getElementById("perfilAvatarImg");
const perfilAvatarInitial = document.getElementById("perfilAvatarInitial");
const perfilAvatarInput = document.getElementById("perfilAvatarInput");
const btnAvatarClear = document.getElementById("btnAvatarClear");

function setAvatarInitialFromName(name) {
  const n = (name || "").trim();
  const letter = n ? n[0].toUpperCase() : "👤";
  if (perfilAvatarInitial) perfilAvatarInitial.textContent = letter;
}

function loadAvatarFromLocal() {
  let url = "";
  try { url = localStorage.getItem("jc_avatar_dataurl") || ""; } catch {}
  if (perfilAvatarImg) perfilAvatarImg.src = url || "";
  if (perfilAvatarImg) perfilAvatarImg.style.display = url ? "block" : "none";
  if (perfilAvatarInitial) perfilAvatarInitial.style.display = url ? "none" : "grid";
}

function saveAvatarToLocal(dataUrl) {
  try { localStorage.setItem("jc_avatar_dataurl", dataUrl || ""); } catch {}
  loadAvatarFromLocal();
}

async function ensureUserId() {
  if (!sb?.auth?.getUser) return null;

  // 1) ya hay sesión?
  let uRes = await sb.auth.getUser();
  let userId = uRes?.data?.user?.id || null;

  // 2) si no, intenta anónimo (requiere habilitarlo en Supabase Auth)
  if (!userId && sb?.auth?.signInAnonymously) {
    const { error } = await sb.auth.signInAnonymously();
    if (!error) {
      uRes = await sb.auth.getUser();
      userId = uRes?.data?.user?.id || null;
    }
  }

  return userId;
}

async function cargarPerfil() {
  if (!sb?.from) return;

  try {
    const userId = await ensureUserId();

    // Si NO hay userId, igual mostramos el form pero avisamos
    if (!userId) {
      if (perfilEstado) perfilEstado.textContent =
        "No se pudo iniciar sesión automática. Activa Auth anónimo en Supabase (Anonymous sign-ins).";
      if (formMiembro) formMiembro.style.display = "";
      if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
      if (perfilNombreTexto) perfilNombreTexto.textContent = "Aún sin registrar";
      if (perfilRolTexto) perfilRolTexto.textContent = "";
      if (perfilFraseTexto) perfilFraseTexto.textContent = "Completa tu perfil para formar parte de la comunidad.";
      setAvatarInitialFromName("");
      loadAvatarFromLocal();
      angieSetEstado("confundida");
      return;
    }

    const { data, error } = await sb
      .from("miembros")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      // ===== YA REGISTRADO =====
      const nombre = data.nombre || "Miembro";
      if (perfilNombreTexto) perfilNombreTexto.textContent = safeText(nombre);
      if (perfilRolTexto) perfilRolTexto.textContent = data.rol_key ? `Rol: ${data.rol_key}` : "";
      if (perfilFraseTexto) perfilFraseTexto.textContent = safeText(data.frase || "");
      if (btnCerrarPerfil) btnCerrarPerfil.style.display = "inline-flex";

      // oculta form
      if (formMiembro) formMiembro.style.display = "none";

      // rellena form (por si luego habilitas "editar")
      if (formMiembro) {
        formMiembro.nombre.value = data.nombre || "";
        formMiembro.edad.value = data.edad || "";
        formMiembro.contacto.value = data.contacto || "";
        formMiembro.ministerio.value = data.ministerio || "";
        formMiembro.rol_key.value = data.rol_key || "miembro";
        formMiembro.frase.value = data.frase || "";
      }

      setAvatarInitialFromName(nombre);
      loadAvatarFromLocal();

      if (perfilEstado) perfilEstado.textContent = "";
    } else {
      // ===== NO REGISTRADO =====
      if (formMiembro) formMiembro.style.display = "";
      if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";

      if (perfilNombreTexto) perfilNombreTexto.textContent = "Aún sin registrar";
      if (perfilRolTexto) perfilRolTexto.textContent = "";
      if (perfilFraseTexto) perfilFraseTexto.textContent = "Completa tu perfil para formar parte de la comunidad.";
      if (perfilEstado) perfilEstado.textContent = "";

      setAvatarInitialFromName(formMiembro?.nombre?.value || "");
      loadAvatarFromLocal();
    }
  } catch (e) {
    console.error("Error cargarPerfil:", e);
    if (perfilEstado) perfilEstado.textContent = "Error cargando perfil.";
    angieSetEstado("confundida");
  }
}

// Guardar perfil
formMiembro?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (perfilEstado) perfilEstado.textContent = "Guardando…";

  if (!sb?.from) {
    if (perfilEstado) perfilEstado.textContent = "No hay conexión al servidor.";
    return;
  }

  try {
    const userId = await ensureUserId();

    if (!userId) {
      if (perfilEstado) perfilEstado.textContent =
        "No se pudo iniciar sesión automática. Activa Auth anónimo en Supabase (Anonymous sign-ins).";
      angieSetEstado("confundida");
      return;
    }

    const payload = {
      user_id: userId,
      nombre: formMiembro.nombre.value.trim(),
      edad: Number(formMiembro.edad.value || 0),
      contacto: formMiembro.contacto.value.trim(),
      ministerio: formMiembro.ministerio.value.trim(),
      rol_key: formMiembro.rol_key.value.trim(),
      frase: formMiembro.frase.value.trim()
    };

    const { error } = await sb.from("miembros").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;

    if (perfilEstado) perfilEstado.textContent = "Perfil guardado ✅";
    miaSetEstado("apoyo");
    angieSetEstado("ok");

    // ocultar form ya registrado + refrescar
    await cargarPerfil();

    // Si ya tienes el módulo de comunidad, en cuanto entres a Comunidad te habilitará el composer
    // (porque ya existirá row en miembros)
  } catch (err) {
    console.error("Error guardar perfil:", err);
    // muestra el error real si viene de Supabase
    if (perfilEstado) perfilEstado.textContent = `Error guardando: ${err?.message || "revisa consola"}`;
    angieSetEstado("confundida");
  }
});

// Avatar (opcional, local)
perfilAvatarInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // solo imagen
  if (!file.type.startsWith("image/")) {
    if (perfilEstado) perfilEstado.textContent = "Selecciona una imagen válida.";
    return;
  }

  // to base64 dataURL (local, no supabase)
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    saveAvatarToLocal(dataUrl);
    if (perfilEstado) perfilEstado.textContent = "Foto actualizada ✅ (local)";
  };
  reader.readAsDataURL(file);
});

btnAvatarClear?.addEventListener("click", () => {
  saveAvatarToLocal("");
  if (perfilEstado) perfilEstado.textContent = "Foto eliminada.";
});

// Cerrar sesión
btnCerrarPerfil?.addEventListener("click", async () => {
  try {
    await sb?.auth?.signOut?.();
  } catch {}

  if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
  if (perfilEstado) perfilEstado.textContent = "Sesión cerrada.";

  // mostrar formulario otra vez
  if (formMiembro) formMiembro.style.display = "";
  if (perfilNombreTexto) perfilNombreTexto.textContent = "Aún sin registrar";
  if (perfilRolTexto) perfilRolTexto.textContent = "";
  if (perfilFraseTexto) perfilFraseTexto.textContent = "Completa tu perfil para formar parte de la comunidad.";
  setAvatarInitialFromName("");
  loadAvatarFromLocal();

  angieSetEstado("saludo");
});

// Inicial
cargarPerfil();
  

})();
/* ==========================================================
   COMUNIDAD MODULE (posts + comentarios + corazones)
   Requiere:
   - window.supabaseClient (sb)
   - helpers: $, $$, safeText, fmtDateTime (si no existen, el módulo trae fallback)
   Tablas:
   - posts_comunidad, comentarios_comunidad, reacciones_comunidad
   RLS:
   - ya configurado en Supabase
   ========================================================== */
function createComunidadModule(ctx = {}) {
  const sb = ctx.sb || window.supabaseClient;

  // helpers: usa los tuyos si existen, si no, fallback
  const $ = ctx.$ || ((q, el = document) => el.querySelector(q));
  const $$ = ctx.$$ || ((q, el = document) => Array.from(el.querySelectorAll(q)));
  const safeText = ctx.safeText || ((s) => (typeof s === "string" ? s : s == null ? "" : String(s)));
  const fmtDateTime =
    ctx.fmtDateTime ||
    ((d) =>
      new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d));

  const normalizeTab = ctx.normalizeTab || ((t) => String(t || "inicio").trim());
  const logAviso = ctx.logAviso || null;
  const angieSetEstado = ctx.angieSetEstado || window.angieSetEstado;
  const miaSetEstado = ctx.miaSetEstado || window.miaSetEstado;
  const ciroSetEstado = ctx.ciroSetEstado || window.ciroSetEstado;

  // Estado módulo
  const state = {
    inited: false,
    cat: "chicos",
    // auth / membresía
    user: null,
    miembro: null, // row de public.miembros
    canWrite: false,

    // modal
    modalOpen: false,
    modalPost: null,
  };

  // Cache DOM
  const dom = {};

  function cacheDom() {
    dom.tabs = $$(".comu-tab");
    dom.lockBadge = $("#comuLockBadge");
    dom.gate = $("#comuGate");
    dom.composer = $("#comuComposer");
    dom.formPost = $("#formComuPost");
    dom.titulo = $("#comuTitulo");
    dom.contenido = $("#comuContenido");
    dom.estado = $("#comuEstado");
    dom.btnClear = $("#btnComuClear");
    dom.btnRefresh = $("#btnComuRefresh");
    dom.list = $("#comuList");

    dom.modal = $("#comuModal");
    dom.modalClose = $("#comuModalClose");
    dom.modalTitle = $("#comuModalTitle");
    dom.modalMeta = $("#comuModalMeta");
    dom.commentsList = $("#comuCommentsList");

    dom.commentComposer = $("#comuCommentComposer");
    dom.commentGate = $("#comuCommentGate");
    dom.formComment = $("#formComuComment");
    dom.commentText = $("#comuCommentText");
    dom.commentEstado = $("#comuCommentEstado");
    dom.btnCommentClear = $("#btnComuCommentClear");
  }

  async function refreshAuthAndMiembro() {
    state.user = null;
    state.miembro = null;
    state.canWrite = false;

    if (!sb?.auth?.getSession || !sb?.from) {
      setGate("⚠️ Sin conexión a Supabase.");
      setComposerVisible(false);
      setCommentComposerVisible(false);
      return;
    }

    try {
      const { data } = await sb.auth.getSession();
      const user = data?.session?.user || null;
      state.user = user;

      if (!user?.id) {
        setGate("👀 Estás en modo espectador. Regístrate en “Mi perfil” para publicar, comentar y reaccionar ❤️");
        setComposerVisible(false);
        setCommentComposerVisible(false);
        return;
      }

      // Verificar si está en public.miembros (registrado)
      const { data: miembro, error } = await sb
        .from("miembros")
        .select("id,nombre,rol_key,user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      state.miembro = miembro || null;
      state.canWrite = !!miembro;

      if (!miembro) {
        setGate("🔒 Tu sesión está activa, pero aún no estás registrado como miembro. Ve a “Mi perfil” y guarda tu registro.");
        setComposerVisible(false);
        setCommentComposerVisible(false);
        return;
      }

      const rol = miembro.rol_key ? ` (${miembro.rol_key})` : "";
      setGate(`✅ Hola ${safeText(miembro.nombre)}${rol}. Puedes publicar, comentar y reaccionar ❤️`);
      setComposerVisible(true);
      // El composer de comentarios se maneja cuando se abre el modal
    } catch (e) {
      console.error("Comunidad: refreshAuthAndMiembro:", e);
      setGate("⚠️ No se pudo validar tu acceso. Intenta recargar.");
      setComposerVisible(false);
      setCommentComposerVisible(false);
    }
  }

  function setGate(msg) {
    if (dom.gate) dom.gate.textContent = msg;
  }

  function setComposerVisible(on) {
    if (dom.composer) dom.composer.style.display = on ? "block" : "none";
  }

  function setCommentComposerVisible(on) {
    if (dom.commentComposer) dom.commentComposer.style.display = on ? "block" : "none";
    if (dom.commentGate) dom.commentGate.style.display = on ? "none" : "block";
  }

  function setStatus(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("error", !!isError);
  }

  function bindOnce() {
    // Tabs
    dom.tabs?.forEach((b) => {
      b.addEventListener("click", async () => {
        const cat = b.dataset.comuCat || "chicos";
        setActiveCat(cat);
        await cargarFeed();
      });
    });

    // Refresh
    dom.btnRefresh?.addEventListener("click", () => cargarFeed({ force: true }));

    // Clear post
    dom.btnClear?.addEventListener("click", () => {
      if (dom.titulo) dom.titulo.value = "";
      if (dom.contenido) dom.contenido.value = "";
      setStatus(dom.estado, "");
      angieSetEstado?.("ok");
    });

    // Submit post
    dom.formPost?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await crearPost();
    });

    // Modal close
    dom.modalClose?.addEventListener("click", closeModal);
    // clic fuera (modal overlay)
    dom.modal?.addEventListener("click", (e) => {
      if (e.target === dom.modal) closeModal();
    });
    // ESC
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.modalOpen) closeModal();
    });

    // Clear comment
    dom.btnCommentClear?.addEventListener("click", () => {
      if (dom.commentText) dom.commentText.value = "";
      setStatus(dom.commentEstado, "");
      miaSetEstado?.("apoyo");
    });

    // Submit comment
    dom.formComment?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await crearComentario();
    });
  }

  function setActiveCat(cat) {
    state.cat = (cat || "chicos").toLowerCase();

    dom.tabs?.forEach((b) => {
      const on = (b.dataset.comuCat || "") === state.cat;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    // micro “mood” por categoría
    if (state.cat === "chicos") ciroSetEstado?.("excited");
    if (state.cat === "chicas") angieSetEstado?.("feliz");
    if (state.cat === "dinamicas") miaSetEstado?.("guiando");
    if (state.cat === "foro") angieSetEstado?.("saludo");
  }

  async function cargarFeed({ force = false } = {}) {
    if (!dom.list) return;

    dom.list.innerHTML = `<div class="muted small">Cargando publicaciones…</div>`;

    if (!sb?.from) {
      dom.list.innerHTML = `<div class="muted small">Sin conexión al servidor.</div>`;
      return;
    }

    try {
      // 1) Traer posts de la categoría
      const { data: posts, error } = await sb
        .from("posts_comunidad")
        .select("id,autor_id,autor_nombre,categoria,titulo,contenido,created_at")
        .eq("categoria", state.cat)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const list = Array.isArray(posts) ? posts : [];
      if (!list.length) {
        dom.list.innerHTML = `<div class="muted small">Aún no hay publicaciones aquí. Sé el primero 😄</div>`;
        return;
      }

      // 2) Traer reacciones (contadores) para esos posts
      const postIds = list.map((p) => p.id).filter(Boolean);

      let reactions = [];
      if (postIds.length) {
        const { data: r, error: rErr } = await sb
          .from("reacciones_comunidad")
          .select("post_id,user_id,tipo")
          .in("post_id", postIds)
          .eq("tipo", "heart");
        if (rErr) throw rErr;
        reactions = Array.isArray(r) ? r : [];
      }

      const counts = new Map(); // post_id -> count
      const mine = new Set();   // post_id hearted by me
      reactions.forEach((x) => {
        counts.set(x.post_id, (counts.get(x.post_id) || 0) + 1);
        if (state.user?.id && x.user_id === state.user.id) mine.add(x.post_id);
      });

      // 3) Render
      dom.list.innerHTML = "";
      list.forEach((p) => dom.list.appendChild(renderPostCard(p, counts.get(p.id) || 0, mine.has(p.id))));
    } catch (e) {
      console.error("Comunidad: cargarFeed:", e);
      dom.list.innerHTML = `<div class="muted small">Error cargando publicaciones.</div>`;
      angieSetEstado?.("confundida");
    }
  }

  function renderPostCard(p, heartCount = 0, heartOn = false) {
    const el = document.createElement("article");
    el.className = "comu-post";

    const d = p.created_at ? new Date(p.created_at) : null;
    const meta = `${safeText(p.autor_nombre || "Miembro")} · ${d ? fmtDateTime(d) : ""}`;

    el.innerHTML = `
      <div class="comu-post-head">
        <div>
          <h4 class="comu-post-title">${escapeHtml(safeText(p.titulo || "Publicación"))}</h4>
          <div class="comu-post-meta">${escapeHtml(meta)}</div>
        </div>
      </div>

      <div class="comu-post-body">${escapeHtml(safeText(p.contenido || ""))}</div>

      <div class="comu-post-actions">
        <button class="comu-heart ${heartOn ? "on" : ""}" type="button" data-act="heart" data-id="${p.id}">
          ❤️ <span data-heart-count>${heartCount}</span>
        </button>

        <button class="comu-comment-btn" type="button" data-act="comments" data-id="${p.id}">
          💬 Comentarios
        </button>
      </div>
    `;

    el.querySelector('[data-act="heart"]')?.addEventListener("click", () => toggleHeart(p.id));
    el.querySelector('[data-act="comments"]')?.addEventListener("click", () => openComments(p));

    return el;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function crearPost() {
    if (!state.canWrite || !state.user?.id || !state.miembro) {
      setStatus(dom.estado, "🔒 Debes estar registrado para publicar.", true);
      angieSetEstado?.("confundida");
      return;
    }

    const titulo = (dom.titulo?.value || "").trim();
    const contenido = (dom.contenido?.value || "").trim();

    if (!titulo || !contenido) {
      setStatus(dom.estado, "Completa título y contenido.", true);
      angieSetEstado?.("confundida");
      return;
    }

    setStatus(dom.estado, "Publicando…");

    try {
      const payload = {
        autor_id: state.user.id,
        autor_nombre: state.miembro.nombre || "Miembro",
        categoria: state.cat,
        titulo,
        contenido,
      };

      const { error } = await sb.from("posts_comunidad").insert(payload);
      if (error) throw error;

      setStatus(dom.estado, "Publicado ✅");
      if (dom.titulo) dom.titulo.value = "";
      if (dom.contenido) dom.contenido.value = "";

      logAviso?.({ title: "Comunidad", body: "Nueva publicación creada ✅" });

      // mood
      ciroSetEstado?.("feliz");
      angieSetEstado?.("ok");

      await cargarFeed({ force: true });
    } catch (e) {
      console.error("Comunidad: crearPost:", e);
      setStatus(dom.estado, "No se pudo publicar. Intenta nuevamente.", true);
      angieSetEstado?.("enojada");
    }
  }

  async function toggleHeart(postId) {
    if (!state.canWrite || !state.user?.id) {
      // espectador
      logAviso?.({ title: "Comunidad", body: "🔒 Regístrate para reaccionar ❤️" });
      angieSetEstado?.("saludo");
      return;
    }

    if (!sb?.from) return;

    try {
      // ¿ya existe mi reacción?
      const { data: existing, error: exErr } = await sb
        .from("reacciones_comunidad")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", state.user.id)
        .eq("tipo", "heart")
        .maybeSingle();

      if (exErr) throw exErr;

      if (existing?.id) {
        // quitar
        const { error: delErr } = await sb
          .from("reacciones_comunidad")
          .delete()
          .eq("id", existing.id);

        if (delErr) throw delErr;

        miaSetEstado?.("apoyo");
      } else {
        // poner
        const { error: insErr } = await sb
          .from("reacciones_comunidad")
          .insert({ post_id: postId, user_id: state.user.id, tipo: "heart" });

        if (insErr) throw insErr;

        angieSetEstado?.("vergonzosa");
      }

      // refrescar feed para actualizar contador/estado
      await cargarFeed({ force: true });
    } catch (e) {
      console.error("Comunidad: toggleHeart:", e);
      logAviso?.({ title: "Comunidad", body: "No se pudo reaccionar. Intenta otra vez." });
      angieSetEstado?.("confundida");
    }
  }

  async function openComments(post) {
    state.modalPost = post;
    state.modalOpen = true;

    if (!dom.modal) return;

    dom.modal.style.display = "flex";
    dom.modal.classList.add("show");

    const d = post.created_at ? new Date(post.created_at) : null;
    if (dom.modalTitle) dom.modalTitle.textContent = safeText(post.titulo || "Comentarios");
    if (dom.modalMeta) dom.modalMeta.textContent = `${safeText(post.autor_nombre || "Miembro")} · ${d ? fmtDateTime(d) : ""}`;

    // gate: solo miembros comentan
    setCommentComposerVisible(!!state.canWrite);

    await cargarComentarios(post.id);
  }

  function closeModal() {
    state.modalOpen = false;
    state.modalPost = null;

    if (!dom.modal) return;
    dom.modal.classList.remove("show");
    dom.modal.style.display = "none";

    if (dom.commentsList) dom.commentsList.innerHTML = "";
    setStatus(dom.commentEstado, "");
    if (dom.commentText) dom.commentText.value = "";
  }

  async function cargarComentarios(postId) {
    if (!dom.commentsList) return;

    dom.commentsList.innerHTML = `<div class="muted small">Cargando comentarios…</div>`;

    if (!sb?.from) {
      dom.commentsList.innerHTML = `<div class="muted small">Sin conexión.</div>`;
      return;
    }

    try {
      const { data, error } = await sb
        .from("comentarios_comunidad")
        .select("id,autor_id,autor_nombre,contenido,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        dom.commentsList.innerHTML = `<div class="muted small">Aún no hay comentarios. Sé el primero 😊</div>`;
        return;
      }

      dom.commentsList.innerHTML = "";
      list.forEach((c) => dom.commentsList.appendChild(renderComment(c)));
    } catch (e) {
      console.error("Comunidad: cargarComentarios:", e);
      dom.commentsList.innerHTML = `<div class="muted small">Error cargando comentarios.</div>`;
    }
  }

  function renderComment(c) {
    const el = document.createElement("div");
    el.className = "comu-comment";
    const d = c.created_at ? new Date(c.created_at) : null;

    el.innerHTML = `
      <div class="comu-comment-meta">
        <strong>${escapeHtml(safeText(c.autor_nombre || "Miembro"))}</strong>
        · ${escapeHtml(d ? fmtDateTime(d) : "")}
      </div>
      <div class="comu-comment-body">${escapeHtml(safeText(c.contenido || ""))}</div>
    `;
    return el;
  }

  async function crearComentario() {
    if (!state.canWrite || !state.user?.id || !state.miembro || !state.modalPost?.id) {
      setStatus(dom.commentEstado, "🔒 Debes estar registrado para comentar.", true);
      miaSetEstado?.("guiando");
      return;
    }

    const contenido = (dom.commentText?.value || "").trim();
    if (!contenido) {
      setStatus(dom.commentEstado, "Escribe un comentario.", true);
      return;
    }

    setStatus(dom.commentEstado, "Comentando…");

    try {
      const payload = {
        post_id: state.modalPost.id,
        autor_id: state.user.id,
        autor_nombre: state.miembro.nombre || "Miembro",
        contenido,
      };

      const { error } = await sb.from("comentarios_comunidad").insert(payload);
      if (error) throw error;

      setStatus(dom.commentEstado, "Comentario agregado ✅");
      if (dom.commentText) dom.commentText.value = "";

      ciroSetEstado?.("feliz");

      await cargarComentarios(state.modalPost.id);
    } catch (e) {
      console.error("Comunidad: crearComentario:", e);
      setStatus(dom.commentEstado, "No se pudo comentar. Intenta de nuevo.", true);
      angieSetEstado?.("confundida");
    }
  }

  // API pública del módulo
  async function init() {
    if (state.inited) return;
    state.inited = true;

    cacheDom();
    bindOnce();

    // arrancar cat por defecto
    setActiveCat(state.cat);

    // refrescar auth/miembro
    await refreshAuthAndMiembro();

    // cargar feed inicial si ya estás en comunidad
    // (si no, se cargará cuando cambies de vista)
  }

  async function onTab(tabName) {
    const t = normalizeTab(tabName);
    if (t !== "comunidad") return;

    // cada vez que entras a comunidad, revalida acceso y carga feed
    await refreshAuthAndMiembro();
    await cargarFeed();
  }

  return { init, onTab, cargarFeed };
}

