/* ============================================================
   JUVENTUD CNC — app.js FINAL (panel Angie en botón + bots + msg + eventos)
   ============================================================ */

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

    // si bots están apagados, ocultamos todo y salimos
    if (!botsEnabled) {
      hideBotsUI();
      return;
    }

    const mapaAngie = {
      inicio: "feliz",
      eventos: "sorprendida",
      comunidad: "saludo",
      recursos: "confundida",
      judart: "traviesa",
      avisos: "traviesa", // compat
      "miembros-activos": "ok",
      perfil: "vergonzosa"
    };

    // Mia elegante en perfil y cuando modal está abierto
    if (t === "perfil" || state.angieOpen) {
      miaSetModo("elegante");
    } else {
      miaSetModo("casual");
    }

    angieSetEstado(mapaAngie[t] || "feliz");

    // Ciro reacciona por vista (sutil)
    if (t === "eventos") ciroSetEstado("excited");
    else if (t === "judart" || t === "avisos") ciroSetEstado("stop");
    else if (t === "inicio") ciroSetEstado("feliz");
    else ciroSetEstado("calm");

    // chat escena
    jcChatPlayScene(t);
  }

  /* =========================
     PERFIL
     ========================= */
  const formMiembro = document.getElementById("formMiembro");
  const perfilNombreTexto = document.getElementById("perfilNombreTexto");
  const perfilRolTexto = document.getElementById("perfilRolTexto");
  const perfilFraseTexto = document.getElementById("perfilFraseTexto");
  const perfilEstado = document.getElementById("perfilEstado");
  const btnCerrarPerfil = document.getElementById("btnCerrarPerfil");

  async function cargarPerfil() {
    if (!sb?.auth?.getUser || !sb?.from) return;

    try {
      const { data: u } = await sb.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return;

      const { data, error } = await sb.from("miembros").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;

      if (data) {
        if (perfilNombreTexto) perfilNombreTexto.textContent = safeText(data.nombre || "Registrado");
        if (perfilRolTexto) perfilRolTexto.textContent = safeText(data.rol_key || "");
        if (perfilFraseTexto) perfilFraseTexto.textContent = safeText(data.frase || "");
        if (btnCerrarPerfil) btnCerrarPerfil.style.display = "";

        if (formMiembro) {
          formMiembro.nombre.value = data.nombre || "";
          formMiembro.edad.value = data.edad || "";
          formMiembro.contacto.value = data.contacto || "";
          formMiembro.ministerio.value = data.ministerio || "";
          formMiembro.rol_key.value = data.rol_key || "miembro";
          formMiembro.frase.value = data.frase || "";
        }
      }
    } catch (e) {
      console.error("Error cargarPerfil:", e);
    }
  }

  formMiembro?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (perfilEstado) perfilEstado.textContent = "Guardando…";

    if (!sb?.auth?.getUser || !sb?.from) {
      if (perfilEstado) perfilEstado.textContent = "No hay conexión al servidor.";
      return;
    }

    try {
      const { data: u } = await sb.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) {
        if (perfilEstado) perfilEstado.textContent = "Necesitas iniciar sesión (próximamente).";
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
      if (perfilNombreTexto) perfilNombreTexto.textContent = payload.nombre;
      if (perfilRolTexto) perfilRolTexto.textContent = payload.rol_key;
      if (perfilFraseTexto) perfilFraseTexto.textContent = payload.frase;

      btnCerrarPerfil && (btnCerrarPerfil.style.display = "");

      logAviso({ title: "Perfil actualizado", body: payload.nombre });
      miaSetEstado("apoyo");
      angieSetEstado("ok");
    } catch (err) {
      console.error("Error guardar perfil:", err);
      if (perfilEstado) perfilEstado.textContent = "Error guardando el perfil.";
      angieSetEstado("confundida");
    }
  });

  btnCerrarPerfil?.addEventListener("click", async () => {
    try {
      await sb?.auth?.signOut?.();
    } catch {}
    if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
    if (perfilEstado) perfilEstado.textContent = "Sesión cerrada.";
    angieSetEstado("saludo");
  });

  // Botón perfil en topbar
  document.getElementById("btnPerfil")?.addEventListener("click", () => activate("perfil"));

  /* =========================
     FAB / acciones rápidas
     ========================= */
  const fab = document.getElementById("fab");
  fab?.addEventListener("click", () => {
    const active = normalizeTab((location.hash || "#inicio").replace("#", ""));
    if (active === "recursos") {
      document.getElementById("fileRec")?.click();
      angieSetEstado("traviesa");
      return;
    }
    if (normalizeTab(active) === "judart") {
      jcChatAddMessage({ from: "angie", text: "Judart pronto tendrá subida de arte 🎨✨", estado: "feliz" });
      return;
    }

    alert("Acción rápida");
  });

  // Reemplazo: Notificaciones -> Judart
  const btnPermPush = document.getElementById("btnPermPush");
  btnPermPush?.addEventListener("click", () => {
    activate("judart");
    jcChatAddMessage({ from: "angie", text: "Bienvenido a Judart 🎨✨", estado: "feliz" });
  });

  /* =========================
     Cargar todo lo público
     ========================= */
  async function cargarPublic() {
    try {
      await Promise.all([
        cargarEventosHome(),
        cargarMensajeSemanal(),
        cargarEventos({ destinoId: "eventList", tipo: $("#filtroTipo")?.value || "" }),
        listarRecursos()
      ]);
    } catch (e) {
      console.error("Error en cargarPublic:", e);
    }
  }

  // inicial
  cargarPublic();

  // cargar perfil (si hay auth)
  cargarPerfil();

})();
