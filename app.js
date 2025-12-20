/* ============================================================
   JUVENTUD CNC — app.js FINAL (panel Angie en botón + bots + msg + eventos)
   ============================================================ */

(() => {
  "use strict";

  
  const JC_BUILD = "2025-12-20.01";
  // Fuerza actualización sin pedir “borrar cookies” (cache-bust + limpieza suave)
  (function ensureFreshBuild() {
    let prev = null;
    try { prev = localStorage.getItem("jc_build"); } catch {}
    if (prev && prev !== JC_BUILD) {
      try { sessionStorage.clear(); } catch {}
      // Si existe SW/caches, intentamos limpiar y actualizar
      if ("caches" in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
      }
      if (navigator.serviceWorker?.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update())).catch(() => {});
      }
      try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
      const url = new URL(location.href);
      url.searchParams.set("v", JC_BUILD);
      location.replace(url.toString());
      return;
    }
    try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
  })();
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

  const fmtTime = (d) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

  const safeText = (s) => (typeof s === "string" ? s : "");
  const nowISO = () => new Date().toISOString();

  /* =========================
     OVERLAY MANAGER
     ========================= */
  const overlay = document.getElementById("overlay");
  const state = {
    drawerOpen: false,
    angieOpen: false
  };

  function syncOverlay() {
    const shouldShow = state.drawerOpen || state.angieOpen;
    if (!overlay) return;
    overlay.classList.toggle("show", shouldShow);
  }

  /* =========================
     DRAWER
     ========================= */
  const drawer = document.getElementById("drawer");

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("open");
    state.drawerOpen = true;
    syncOverlay();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("open");
    state.drawerOpen = false;
    syncOverlay();
  }

  document.getElementById("openDrawer")?.addEventListener("click", openDrawer);
  document.getElementById("closeDrawer")?.addEventListener("click", closeDrawer);

  overlay?.addEventListener("click", () => {
    // cierra todo lo que esté abierto
    closeDrawer();
    window.jcCloseAngiePanel?.();
  });

  /* ============================================================
     PANEL ANGIE (EN EL BOTÓN 🎨) — reemplaza el sidepanel viejo
     ============================================================ */

  // 1) matar panel viejo si existe
  const legacyPanel = document.getElementById("angie-panel");
  if (legacyPanel) legacyPanel.style.display = "none";

  // 2) inyectar estilos del modal (para que se vea bien sin tocar styles.css)
  function injectAngieModalStyles() {
    if (document.getElementById("jc-angie-modal-style")) return;
    const style = document.createElement("style");
    style.id = "jc-angie-modal-style";
    style.textContent = `
      .jc-modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: flex-end;
        justify-content: center;
        z-index: 80;
        padding: 14px;
      }
      .jc-modal.open { display: flex; }
      .jc-modal-card {
        width: min(720px, 100%);
        max-height: min(82vh, 720px);
        display: flex;
        flex-direction: column;
        border-radius: 18px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(148, 163, 184, 0.45);
        box-shadow: 0 18px 55px rgba(0,0,0,.75);
        backdrop-filter: blur(14px);
      }
      .jc-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148,163,184,.35);
        background: linear-gradient(135deg, rgba(56,189,248,.14), rgba(244,114,182,.14));
      }
      .jc-modal-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .jc-modal-title strong {
        font-size: 13px;
        letter-spacing: .02em;
      }
      .jc-modal-title small {
        color: rgba(148,163,184,.95);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .jc-modal-close {
        appearance: none;
        border: none;
        border-radius: 999px;
        width: 36px;
        height: 36px;
        cursor: pointer;
        background: rgba(148,163,184,.12);
        color: #e5e7eb;
        font-size: 16px;
      }
      .jc-modal-close:hover { background: rgba(148,163,184,.20); }

      .jc-modal-tabs {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148,163,184,.28);
        flex-wrap: wrap;
      }
      .jc-seg {
        appearance: none;
        border: 1px solid rgba(148,163,184,.30);
        background: rgba(15,23,42,.8);
        color: #e5e7eb;
        padding: 7px 10px;
        font-size: 12px;
        border-radius: 999px;
        cursor: pointer;
      }
      .jc-seg.active {
        border-color: rgba(56,189,248,.6);
        background: linear-gradient(135deg, rgba(56,189,248,.18), rgba(244,114,182,.18));
      }

      .jc-modal-body {
        padding: 12px;
        overflow: auto;
        display: grid;
        gap: 12px;
      }

      .jc-panel {
        display: none;
      }
      .jc-panel.active { display: block; }

      .jc-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .jc-pill {
        appearance: none;
        border: 1px solid rgba(148,163,184,.35);
        background: rgba(15,23,42,.86);
        color: #e5e7eb;
        padding: 7px 10px;
        font-size: 12px;
        border-radius: 999px;
        cursor: pointer;
      }
      .jc-pill:hover { border-color: rgba(244,114,182,.55); }

      .jc-iframe {
        width: 100%;
        height: min(54vh, 520px);
        border: 1px solid rgba(148,163,184,.30);
        border-radius: 14px;
        overflow: hidden;
        background: #0b1120;
      }
      .jc-iframe iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }

      .jc-card-mini {
        border: 1px solid rgba(148,163,184,.28);
        background: rgba(15,23,42,.84);
        border-radius: 14px;
        padding: 12px;
      }
      .jc-card-mini h4 {
        margin: 0 0 6px;
        font-size: 13px;
      }
      .jc-card-mini p {
        margin: 0;
        color: rgba(226,232,240,.92);
        font-size: 12px;
        line-height: 1.45;
      }
    `;
    document.head.appendChild(style);
  }

  // 3) construir modal
  let angieModal, angieModalClose, angieModalTabs, angiePanels;
  function buildAngieModal() {
    if (angieModal) return;

    injectAngieModalStyles();

    angieModal = document.createElement("div");
    angieModal.className = "jc-modal";
    angieModal.id = "jcAngieModal";

    angieModal.innerHTML = `
      <div class="jc-modal-card" role="dialog" aria-modal="true" aria-label="Panel Angie">
        <div class="jc-modal-header">
          <div class="jc-modal-title">
            <strong>🎨 Angie · Diseño & Emociones</strong>
            <small>Paleta, emociones, trama y modo de Mia (casual/elegante).</small>
          </div>
          <button class="jc-modal-close" id="jcAngieModalClose" aria-label="Cerrar">✕</button>
        </div>

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
            <div class="jc-card-mini">
              <h4>Escena express</h4>
              <div class="jc-pills">
                <button class="jc-pill" id="jcSceneWelcome">▶ Bienvenida</button>
                <button class="jc-pill" id="jcSceneServe">▶ Servicio</button>
                <button class="jc-pill" id="jcSceneCalm">▶ Calma</button>
              </div>
            </div>
          </section>

          <section class="jc-panel" data-panel="mia">
            <div class="jc-card-mini">
              <h4>Mia — modo</h4>
              <p>Casual para lo diario. Elegante para perfil / diseño (cuando abres 🎨).</p>
            </div>
            <div class="jc-pills">
              <button class="jc-pill" id="jcMiaCasual">👟 Casual</button>
              <button class="jc-pill" id="jcMiaElegante">👗 Elegante</button>
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(angieModal);

    
    // Cache-bust para la herramienta (evita que quede “pegada” por cache)
    try {
      const iframe = angieModal.querySelector("iframe");
      if (iframe) iframe.src = "Angie herramienta.html?v=" + encodeURIComponent(JC_BUILD);
    } catch {}
angieModalClose = document.getElementById("jcAngieModalClose");
    angieModalTabs = document.getElementById("jcAngieTabs");
    angiePanels = $$("[data-panel].jc-panel", angieModal);

    // Tabs del modal
    angieModalTabs?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-panel]");
      if (!btn) return;
      const key = btn.getAttribute("data-panel");

      $$("button[data-panel]", angieModalTabs).forEach((b) => b.classList.toggle("active", b === btn));
      angiePanels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-panel") === key));
    });

    // Cerrar
    angieModalClose?.addEventListener("click", () => closeAngieModal());

    // Botones emociones (se rellenan luego de definir estados)
    // Escenas express
    document.getElementById("jcSceneWelcome")?.addEventListener("click", () => {
      jcChatAddMessage({ from: "mia", text: "Bienvenido 💗 yo organizo todo para que te sientas en casa.", estado: "guiando" });
      jcChatAddMessage({ from: "ciro", text: "¡Y yo te empujo a servir! 😄💪", estado: "excited" });
      jcChatAddMessage({ from: "angie", text: "Yo pongo el brillo 😏✨", estado: "traviesa" });
    });
    document.getElementById("jcSceneServe")?.addEventListener("click", () => {
      miaSetEstado("apoyo");
      ciroSetEstado("excited");
      angieSetEstado("ok");
      jcChatAddMessage({ from: "system", text: "Escena: Servicio activado 🙌" });
    });
    document.getElementById("jcSceneCalm")?.addEventListener("click", () => {
      miaSetEstado("preocupada");
      ciroSetEstado("calm");
      angieSetEstado("rezando");
      jcChatAddMessage({ from: "system", text: "Escena: Calma y oración 🙏" });
    });

    // Modo Mia
    document.getElementById("jcMiaCasual")?.addEventListener("click", () => miaSetModo("casual"));
    document.getElementById("jcMiaElegante")?.addEventListener("click", () => miaSetModo("elegante"));
  }

  function openAngieModal() {
    buildAngieModal();
    if (!angieModal) return;
    angieModal.classList.add("open");
    state.angieOpen = true;
    syncOverlay();

    // Mini detalle: Mia elegante en modo diseño
    miaSetModo("elegante");
    miaSetEstado("elegant_relief");
    angieSetEstado("feliz");
  }

  function closeAngieModal() {
    if (!angieModal) return;
    angieModal.classList.remove("open");
    state.angieOpen = false;
    syncOverlay();

    // vuelve a casual salvo que estés en perfil
    const t = (location.hash || "#inicio").replace("#", "");
    miaSetModo(t === "perfil" ? "elegante" : "casual");
  }

  // expuesto para overlay click
  window.jcCloseAngiePanel = closeAngieModal;

  // 🎨 botón Angie: capturamos y bloqueamos handlers viejos
  const btnAngie = document.getElementById("btnAngie");
  btnAngie?.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation(); // 🔥 mata el listener viejo del inline-script
      openAngieModal();
    },
    true // capture
  );

  // ESC cierra
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.angieOpen) closeAngieModal();
      if (state.drawerOpen) closeDrawer();
    }
  });

  // Mensajes desde iframe (herramienta Angie)
  window.addEventListener("message", (ev) => {
    if (!ev?.data) return;

    if (ev.data.type === "applyTokens") {
      const tokens = ev.data.tokens || {};
      try {
        localStorage.setItem("jc_tokens", JSON.stringify(tokens));
      } catch {}
      jcApplyTokens(tokens);
    }

    if (ev.data.type === "angieEstado") {
      const value = ev.data.value;
      angieSetEstado(mapAngieToolEstado(value));
    }
  });

  function mapAngieToolEstado(v) {
    // tool tiene orando/pensativa, etc. lo mapeamos a tus keys reales
    const map = {
      orando: "rezando",
      pensativa: "confundida"
    };
    return map[v] || v || "feliz";
  }

  /* =========================
     TOKENS / THEME PICKER
     ========================= */

  const themePicker = document.getElementById("themePicker");
  themePicker?.addEventListener("change", () => {
    const mode = themePicker.value;
    try { localStorage.setItem("jc_theme_mode", mode); } catch {}
    applyThemePreset(mode);
  });

  function applyThemePreset(mode = "auto") {
    // presets sencillos (solo los principales)
    const presets = {
      chicos:  { brand: "#38bdf8", brand2: "#0ea5e9", accent: "#60a5fa" },
      chicas:  { brand: "#f472b6", brand2: "#ec4899", accent: "#fb7185" },
      mix:     { brand: "#2563eb", brand2: "#1d4ed8", accent: "#ec4899" },
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

    // La herramienta manda ids: brand, brand2, accent, neutral900...
    // Los convertimos a variables reales: --brand, --brand-2, --neutral-900...
    const map = {
      brand: "--brand",
      brand2: "--brand-2",
      accent: "--accent",
      neutral900: "--neutral-900",
      neutral800: "--neutral-800",
      neutral700: "--neutral-700",
      neutral600: "--neutral-600",
      neutral400: "--neutral-400",
      neutral200: "--neutral-200",
      neutral100: "--neutral-100"
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

  /* =========================
     SPA / TABS
     ========================= */

  const tabs = $$(".tab");
  const views = $$(".view");

  function showView(key) {
    views.forEach((v) => v.classList.toggle("active", v.dataset.view === key));
  }

  function activate(tab) {
    const t = typeof tab === "string" ? tab : tab?.dataset?.tab;
    if (!t) return;

    tabs.forEach((b) => {
      const on = b.dataset.tab === t;
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
     EVENTOS
     ========================= */

  async function cargarEventos({ destinoId = "eventList", tipo = "" } = {}) {
    const ul = document.getElementById(destinoId);
    if (!ul) return;

    if (!sb?.from) {
      ul.innerHTML = "<li class='event-item'><span class='event-title'>Servidor no disponible</span><span class='event-meta'>Revisa conexión / Supabase</span></li>";
      return;
    }

    ul.innerHTML = "<li class='event-item'><span class='event-title'>Cargando...</span><span class='event-meta'>un momento</span></li>";

    try {
      let q = sb
        .from("eventos")
        .select("*")
        .gte("fecha", nowISO())
        .order("fecha", { ascending: true });

      if (tipo) q = q.eq("tipo", tipo);

      const { data, error } = await q.limit(80);
      if (error) throw error;

      ul.innerHTML = "";
      const list = Array.isArray(data) ? data : [];

      if (!list.length) {
        ul.innerHTML = "<li class='event-item'><span class='event-title'>Sin eventos próximos</span><span class='event-meta'>Vuelve pronto</span></li>";
        return;
      }

      list.forEach((ev) => {
        const li = document.createElement("li");
        li.className = "event-item";

        const fecha = new Date(ev.fecha);
        const meta = `${fmtDate(fecha)} · ${fmtTime(fecha)}`;

        li.innerHTML = `
          <span class="event-title">${safeText(ev.titulo) || "Evento"}</span>
          <span class="event-meta">${meta}</span>
        `;

        // click -> maps si hay lugar
        li.addEventListener("click", () => {
          const q = encodeURIComponent(safeText(ev.lugar));
          if (q) window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
        });

        ul.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarEventos:", e);
      ul.innerHTML = "<li class='event-item'><span class='event-title'>Error cargando eventos</span><span class='event-meta'>Intenta más tarde</span></li>";
    }
  }

  async function cargarEventosHome() {
    const ul = document.getElementById("eventListHome");
    if (!ul) return;

    if (!sb?.from) {
      ul.innerHTML = "<li class='event-item'><span class='event-title'>Servidor no disponible</span><span class='event-meta'>Supabase no listo</span></li>";
      return;
    }

    try {
      const { data, error } = await sb
        .from("eventos")
        .select("*")
        .gte("fecha", nowISO())
        .order("fecha", { ascending: true })
        .limit(4);

      if (error) throw error;

      ul.innerHTML = "";
      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        ul.innerHTML = "<li class='event-item'><span class='event-title'>Aún no hay eventos</span><span class='event-meta'>Agrega uno en la pestaña Eventos</span></li>";
        return;
      }

      list.forEach((ev) => {
        const li = document.createElement("li");
        li.className = "event-item";
        const fecha = new Date(ev.fecha);
        const meta = `${new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, month: "short", day: "numeric" }).format(fecha)} · ${fmtTime(fecha)}`;

        li.innerHTML = `
          <span class="event-title">${safeText(ev.titulo) || "Evento"}</span>
          <span class="event-meta">${meta}</span>
        `;
        ul.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarEventosHome:", e);
      ul.innerHTML = "<li class='event-item'><span class='event-title'>Error cargando</span><span class='event-meta'>Intenta luego</span></li>";
    }
  }

  document.getElementById("filtroTipo")?.addEventListener("change", (e) => {
    cargarEventos({ destinoId: "eventList", tipo: e.target.value || "" });
  });

  /* =========================
     MENSAJE SEMANAL (INICIO)
     ========================= */

  async function cargarMensajeSemanal() {
    const t = document.getElementById("msgTitle");
    const b = document.getElementById("msgBody");
    const m = document.getElementById("msgMeta");
    if (!t || !b || !m) return;

    // fallback visual inmediato
    t.textContent = "Cargando mensaje...";
    b.textContent = "Un momento…";
    m.textContent = "–";

    if (!sb?.from) {
      t.textContent = "Mensaje semanal";
      b.textContent = "Conéctate a internet para ver el mensaje de la semana.";
      m.textContent = "";
      return;
    }

    const monday = (() => {
      const d = new Date();
      const day = (d.getDay() + 6) % 7; // lunes = 0
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    try {
      const { data, error } = await sb
        .from("mensaje_semanal")
        .select("*")
        .eq("semana_start", monday.toISOString().slice(0, 10))
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        t.textContent = "Mensaje no publicado";
        b.textContent = "Vuelve pronto. Esta semana aún no hay mensaje publicado.";
        m.textContent = "";
        return;
      }

      t.textContent = safeText(data.titulo) || "Mensaje semanal";
      b.textContent = safeText(data.contenido) || "";
      m.textContent = data.autor
        ? `Por ${safeText(data.autor)} • ${new Date(data.publicado_at || Date.now()).toLocaleString(LOCALE, { timeZone: TZ })}`
        : "";
    } catch (e) {
      console.error("Error cargarMensajeSemanal:", e);
      t.textContent = "Mensaje semanal";
      b.textContent = "No se pudo cargar el mensaje. Intenta más tarde.";
      m.textContent = "";
    }
  }

  /* =========================
     PERFIL (local + supabase)
     ========================= */

  const formMiembro = document.getElementById("formMiembro");
  const perfilEstado = document.getElementById("perfilEstado");
  const perfilNombreTxt = document.getElementById("perfilNombreTexto");
  const perfilRolTxt = document.getElementById("perfilRolTexto");
  const perfilFraseTxt = document.getElementById("perfilFraseTexto");
  const btnCerrarPerfil = document.getElementById("btnCerrarPerfil");

  const avatarInicial = document.getElementById("perfilAvatarInicial");
  const avatarImg = document.getElementById("perfilAvatarImg");
  const btnCambiarFoto = document.getElementById("btnCambiarFoto");
  const fotoInput = document.getElementById("perfilFotoInput");

  function mostrarEstadoPerfil(txt, type = "ok") {
    if (!perfilEstado) return;
    perfilEstado.textContent = txt;
    perfilEstado.classList.remove("ok", "error");
    perfilEstado.classList.add(type);
  }

  function ocultarFormularioPerfil() {
    if (formMiembro) formMiembro.style.display = "none";
    if (btnCerrarPerfil) btnCerrarPerfil.style.display = "inline-flex";
  }

  function mostrarFormularioPerfil() {
    if (formMiembro) formMiembro.style.display = "grid";
    if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
  }

  function actualizarUIPerfil({ nombre, rol_key, frase }) {
    const nm = safeText(nombre).trim();
    if (perfilNombreTxt) perfilNombreTxt.textContent = nm || "Aún sin registrar";

    const label =
      rol_key === "moderador" ? "Moderador (solicitud)" :
      rol_key === "voluntario" ? "Voluntario digital" :
      rol_key === "admin" ? "Admin" :
      rol_key ? "Miembro" : "";

    if (perfilRolTxt) perfilRolTxt.textContent = label;

    if (perfilFraseTxt) {
      perfilFraseTxt.textContent = frase && safeText(frase).trim()
        ? `“${safeText(frase).trim()}”`
        : "Aquí aparecerá la frase elegida.";
    }

    if (avatarInicial) {
      avatarInicial.textContent = nm ? nm.charAt(0).toUpperCase() : "🙂";
    }
  }

  // foto
  btnCambiarFoto?.addEventListener("click", () => fotoInput?.click());
  fotoInput?.addEventListener("change", () => {
    const file = fotoInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (avatarImg) {
        avatarImg.src = dataUrl;
        avatarImg.style.display = "block";
      }
      if (avatarInicial) avatarInicial.style.display = "none";
      try { localStorage.setItem("jc_perfil_foto", String(dataUrl)); } catch {}
    };
    reader.readAsDataURL(file);
  });

  formMiembro?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const f = new FormData(formMiembro);

    const nombre = safeText(f.get("nombre"));
    const rol_key = safeText(f.get("rol_key")) || "miembro";
    const frase = safeText(f.get("frase")) || "";

    let userId = null;
    try {
      if (sb?.auth?.getUser) {
        const { data: u } = await sb.auth.getUser();
        userId = u?.user?.id || null;
      }
    } catch {}

    const payload = {
      nombre,
      edad: Number(f.get("edad")),
      contacto: f.get("contacto") || null,
      ministerio: f.get("ministerio") || null,
      rol_key,
      user_id: userId
    };

    let remoteError = false;
    if (sb?.from) {
      try {
        const { error } = await sb.from("miembros").insert(payload);
        if (error) remoteError = true;
      } catch {
        remoteError = true;
      }
    } else {
      remoteError = true;
    }

    const perfilLocal = { nombre, rol_key, frase };
    try { localStorage.setItem("jc_perfil", JSON.stringify(perfilLocal)); } catch {}
    actualizarUIPerfil(perfilLocal);

    ocultarFormularioPerfil();

    const labelRol =
      rol_key === "moderador" ? "Moderador (solicitud)" :
      rol_key === "voluntario" ? "Voluntario digital" :
      "Miembro";

    mostrarEstadoPerfil(
      remoteError
        ? `Perfil guardado solo en este dispositivo como ${labelRol}.`
        : `Registro guardado correctamente como ${labelRol}.`,
      remoteError ? "error" : "ok"
    );

    formMiembro.reset();
  });

  // restaurar perfil
  (function restorePerfil() {
    try {
      const raw = localStorage.getItem("jc_perfil");
      if (raw) {
        const p = JSON.parse(raw);
        actualizarUIPerfil(p);
        ocultarFormularioPerfil();
      }
      const foto = localStorage.getItem("jc_perfil_foto");
      if (foto && avatarImg) {
        avatarImg.src = foto;
        avatarImg.style.display = "block";
        if (avatarInicial) avatarInicial.style.display = "none";
      }
    } catch (e) {
      console.error("Error restaurando perfil:", e);
    }
  })();

  btnCerrarPerfil?.addEventListener("click", () => {
    try {
      localStorage.removeItem("jc_perfil");
      localStorage.removeItem("jc_perfil_foto");
    } catch {}

    if (perfilNombreTxt) perfilNombreTxt.textContent = "Aún sin registrar";
    if (perfilRolTxt) perfilRolTxt.textContent = "";
    if (perfilFraseTxt) perfilFraseTxt.textContent = "Aquí aparecerá la frase elegida.";

    if (avatarImg) {
      avatarImg.src = "";
      avatarImg.style.display = "none";
    }
    if (avatarInicial) {
      avatarInicial.style.display = "block";
      avatarInicial.textContent = "🙂";
    }

    mostrarFormularioPerfil();
    mostrarEstadoPerfil("Perfil borrado en este dispositivo. Puedes volver a registrarte.", "ok");

    // Mia elegante en perfil si quieres mantenerlo:
    miaSetModo("elegante");
    miaSetEstado("elegant_relief");
  });

  /* =========================
     RECURSOS (inyecta contenedor si falta)
     ========================= */

  function ensureRecursosContainer() {
    let cont = document.getElementById("listaRecursos");
    if (cont) return cont;

    const view = document.getElementById("view-recursos");
    if (!view) return null;

    cont = document.createElement("div");
    cont.id = "listaRecursos";
    cont.className = "grid";
    cont.style.gap = "10px";

    // lo ponemos después del primer card
    view.appendChild(cont);
    return cont;
  }

  async function listarRecursos() {
    const cont = ensureRecursosContainer();
    if (!cont) return;

    cont.innerHTML = `<p class="muted small">Cargando recursos...</p>`;

    if (!sb?.from || !sb?.storage) {
      cont.innerHTML = `<p class="muted small">Servidor no disponible.</p>`;
      return;
    }

    try {
      const { data, error } = await sb
        .from("recursos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        cont.innerHTML = `<p class="muted small">Aún no hay recursos subidos.</p>`;
        return;
      }

      cont.innerHTML = list
        .map((r) => {
          const fecha = new Date(r.created_at || Date.now()).toLocaleDateString(LOCALE, { timeZone: TZ });
          const pub = sb.storage.from("recursos").getPublicUrl(r.path || "").data?.publicUrl || "#";
          const titulo = safeText(r.titulo) || "Recurso";
          return `
            <div class="recurso-item" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px;border:1px solid rgba(148,163,184,.28);border-radius:14px;background:rgba(15,23,42,.86)">
              <div style="min-width:0">
                <p class="recurso-nombre" style="margin:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titulo}</p>
                <p class="recurso-fecha muted small" style="margin:2px 0 0">${fecha}</p>
              </div>
              <a class="btn-descargar" href="${pub}" target="_blank" rel="noreferrer"
                 style="text-decoration:none;border:1px solid rgba(148,163,184,.35);padding:7px 10px;border-radius:999px;background:rgba(15,23,42,.8);color:#e5e7eb;font-size:12px">
                 Descargar
              </a>
            </div>
          `;
        })
        .join("");
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
     AVISOS (UI log)
     ========================= */

  const avisosList = document.getElementById("avisosList");
  function logAviso({ title = "Aviso", body = "" }) {
    if (!avisosList) return;
    const li = document.createElement("li");
    li.className = "notice-item";
    li.textContent = `${new Date().toLocaleTimeString(LOCALE, { timeZone: TZ })} — ${title}: ${body}`;
    avisosList.prepend(li);
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
          <span><strong>${safeText(m.nombre) || "Sin nombre"}</strong></span>
          <span class="estado-activo">${labelRol}</span>
        `;
        lista.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarListaMiembros:", e);
      lista.innerHTML = "<li>Error al cargar miembros.</li>";
    }
  }

  /* =========================
     FORM EVENTO (crear)
     ========================= */
  const formEvento = document.getElementById("formEvento");
  const evEstado = document.getElementById("evEstado");

  formEvento?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!sb?.from) {
      if (evEstado) {
        evEstado.textContent = "No se puede conectar al servidor por ahora.";
        evEstado.classList.add("error");
      }
      return;
    }

    const tituloEl = document.getElementById("evTitulo");
    const fechaEl = document.getElementById("evFecha");
    const tipoEl = document.getElementById("evTipo");
    const lugarEl = document.getElementById("evLugar");
    const descEl = document.getElementById("evDescripcion");

    const titulo = tituloEl?.value?.trim();
    const fechaRaw = fechaEl?.value;
    const tipo = tipoEl?.value || null;
    const lugar = lugarEl?.value?.trim() || null;
    const descripcion = descEl?.value?.trim() || null;

    if (!titulo || !fechaRaw) {
      if (evEstado) {
        evEstado.textContent = "Completa al menos título y fecha.";
        evEstado.classList.add("error");
      }
      return;
    }

    const fechaIso = new Date(fechaRaw).toISOString();

    if (evEstado) {
      evEstado.textContent = "Guardando evento...";
      evEstado.classList.remove("error");
      evEstado.classList.add("ok");
    }

    try {
      const { error } = await sb.from("eventos").insert({
        titulo,
        fecha: fechaIso,
        tipo,
        lugar,
        descripcion
      });

      if (error) throw error;

      formEvento.reset();

      if (evEstado) {
        evEstado.textContent = "Evento creado correctamente 🙌";
        evEstado.classList.remove("error");
        evEstado.classList.add("ok");
      }

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
        "Ciro ya está por “parar todo”. Mia me dijo: calma. 😮‍💨"
      ]
    },
    llorando: {
      img: "assets/angie-llorando.png",
      frases: [
        "Si hoy dolió, mañana puede sanar 💔",
        "Puedes llorar y aún así ser fuerte 💧",
        "Mia me abrazó. Ciro dijo: “no estás solo”. Y yo… te creo."
      ]
    },
    enamorada: {
      img: "assets/angie-enamorada.png",
      frases: [
        "Ayyy qué bonito 😍",
        "El corazón también sabe hablar 💗",
        "Mia dice que sea prudente… pero yo soy Angie 😌"
      ]
    },
    sorprendida: {
      img: "assets/angie-sorprendida.png",
      frases: [
        "¿EN SERIO? 😲",
        "Wow, no me esperaba eso 👀",
        "Ciro dijo “vamos con todo”. Yo digo: “con todo y con flow” 😏"
      ]
    },
    vergonzosa: {
      img: "assets/angie-vergonzosa.png",
      frases: [
        "Yo también soy tímida a veces… poquitito 🙈",
        "Tranquilo, nadie te va a juzgar aquí 💗",
        "Mia me está mirando… ok, me porto bien 😅"
      ]
    },
    cansada: {
      img: "assets/angie-cansada.png",
      frases: [
        "Uf… también puedes descansar 😮‍💨",
        "Un respiro y seguimos, ¿trato hecho?",
        "Ciro dice que no hay descanso… Mia dice que sí. Yo voto por Mia 😴"
      ]
    },
    ok: {
      img: "assets/angie-ok.png",
      frases: [
        "¡Buen trabajo! 👍",
        "Estoy orgullosa de ti ✨",
        "Mia está feliz. Ciro está motivado. Y yo… yo estoy encantada 💗"
      ]
    }
  };

  function pick(arr, fallback) {
    const a = Array.isArray(arr) ? arr : [];
    return a.length ? a[Math.floor(Math.random() * a.length)] : fallback;
  }

  function angieSetEstado(tipo = "feliz") {
    const widget = document.getElementById("angieWidget");
    const imgEl = document.getElementById("angieAvatarImg");
    const textEl = document.getElementById("angieText");
    if (!widget || !textEl) return;

    const estado = ANGIE_ESTADOS[tipo] || ANGIE_ESTADOS.feliz;
    if (imgEl && estado.img) imgEl.src = estado.img;
    textEl.textContent = pick(estado.frases, "Hola 👋");

    widget.classList.add("angie-widget--visible");

    // micro relación
    if (tipo === "traviesa") miaSetEstado("preocupada");
    if (tipo === "enojada") ciroSetEstado("stop");
    if (tipo === "rezando") ciroSetEstado("pray");
    if (tipo === "ok") miaSetEstado("apoyo");
  }
  window.angieSetEstado = angieSetEstado;

  // === Mia (casual + elegant)
  const MIA_ESTADOS = {
    guiando: {
      img: "assets/mia-casual-wink.png",
      frases: [
        "Hola 💗 Respira. Vamos paso a paso.",
        "Si te pierdes, yo te ubico 😊",
        "Ciro quiere correr… pero primero ordenamos 🙌"
      ]
    },
    apoyo: {
      img: "assets/mia-casual-love.png",
      frases: [
        "Aquí estoy contigo, no estás solo 💖",
        "Lo estás haciendo mejor de lo que crees ✨",
        "Angie bromea, Ciro empuja… y yo te sostengo."
      ]
    },
    preocupada: {
      img: "assets/mia-casual-confused.png",
      frases: [
        "Hmm… revisemos eso con calma.",
        "Algo no cuadra, pero lo resolvemos.",
        "Ciro, sin drama 😅"
      ]
    },
    triste: {
      img: "assets/mia-casual-sad.png",
      frases: [
        "Si te pesa… aquí tienes un espacio seguro.",
        "Hoy toca ser suave contigo.",
        "Angie, hoy no bromas… hoy acompañas 💗"
      ]
    },
    llorando: {
      img: "assets/mia-casual-cry.png",
      frases: [
        "Si lloras, no pasa nada… seguimos juntos.",
        "Dios también te escucha en silencio.",
        "Ciro, una oración. Angie, un abrazo."
      ]
    },
    vergonzosa: {
      img: "assets/mia-casual-embarrassed.png",
      frases: [
        "Je… bueno, sí… 🙈",
        "No me hagas sonrojar 😅",
        "Angie te está mirando, cuidado 😏"
      ]
    },
    shy: {
      img: "assets/mia-casual-shy.png",
      frases: [
        "Estoy aquí… aunque me cueste hablar 🙈",
        "Vamos poquito a poquito.",
        "Ciro, bajemos un cambio 💙"
      ]
    },
    sorprendida: {
      img: "assets/mia-casual-surprised.png",
      frases: [
        "¡Oh! No lo vi venir 😳",
        "Ok… replaneamos.",
        "Angie, sin caos por favor 😅"
      ]
    },

    elegant_shy:    { img: "assets/mia-elegant-shy.png", frases: ["Uy… 🙈"] },
    elegant_love:   { img: "assets/mia-elegant-love.png", frases: ["Me alegra verte 💗"] },
    elegant_heart:  { img: "assets/mia-elegant-heart.png", frases: ["Te acompaño con el corazón 💖"] },
    elegant_cry:    { img: "assets/mia-elegant-cry.png", frases: ["Estoy contigo… 💧"] },
    elegant_conf:   { img: "assets/mia-elegant-confused.png", frases: ["Revisemos con paciencia 🤍"] },
    elegant_relief: { img: "assets/mia-elegant-relief.png", frases: ["Bien… respira, ya pasó 😮‍💨"] },
    elegant_kiss:   { img: "assets/mia-elegant-kiss.png", frases: ["Un empujoncito de ánimo 💋"] },
    elegant_dreamy: { img: "assets/mia-elegant-dreamy.png", frases: ["Soñemos bonito… ✨"] }
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

  // ✅ FIX de tu error: miaSetModo existe y está expuesta
  let miaModo = localStorage.getItem("jc_mia_modo") || "casual"; // casual|elegante

  function miaSetModo(modo = "casual") {
    miaModo = modo === "elegante" ? "elegante" : "casual";
    try { localStorage.setItem("jc_mia_modo", miaModo); } catch {}

    // si cambias modo, forzamos un estado acorde
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
    },
    angry: {
      img: "assets/ciro-angry.png",
      frases: [
        "Me molesta… pero respiro.",
        "Ok… no reacciono. Lo arreglo.",
        "Angie, no avives el fuego 😅"
      ]
    }
  };

  function ciroSetEstado(tipo = "feliz") {
    const widget = document.getElementById("ciroWidget");
    const imgEl = document.getElementById("ciroAvatarImg");
    const textEl = document.getElementById("ciroText");
    if (!widget || !textEl) return;

    const estado = CIRO_ESTADOS[tipo] || CIRO_ESTADOS.feliz;

    if (imgEl && estado.img) imgEl.src = estado.img;
    textEl.textContent = pick(estado.frases, "Aquí estoy 🙌");

    widget.classList.add("ciro-widget--visible");
  }
  window.ciroSetEstado = ciroSetEstado;

  // preload (evita parpadeo)
  (function preloadAllBotAssets() {
    const all = [
      "assets/angie-widget-v2.png",
      ...Object.values(ANGIE_ESTADOS).map((x) => x.img),
      ...Object.values(MIA_ESTADOS).map((x) => x.img),
      ...Object.values(CIRO_ESTADOS).map((x) => x.img)
    ];
    jcPreloadImages(all);
  })();

  // cierre widgets (si quieres permitir cerrar)
  document.getElementById("angieClose")?.addEventListener("click", () => $("#angieWidget")?.classList.remove("angie-widget--visible"));
  document.getElementById("miaClose")?.addEventListener("click", () => $("#miaWidget")?.classList.remove("mia-widget--visible"));
  document.getElementById("ciroClose")?.addEventListener("click", () => $("#ciroWidget")?.classList.remove("ciro-widget--visible"));

  /* =========================
     Bots según vista (incluye modo Mia)
     ========================= */
  function botsSegunVista(tab) {
    const mapaAngie = {
      inicio: "feliz",
      eventos: "sorprendida",
      comunidad: "saludo",
      recursos: "confundida",
      avisos: "traviesa",
      "miembros-activos": "ok",
      perfil: "vergonzosa"
    };

    // Mia elegante en perfil y cuando panel está abierto
    if (tab === "perfil" || state.angieOpen) {
      miaSetModo("elegante");
    } else {
      miaSetModo("casual");
    }

    angieSetEstado(mapaAngie[tab] || "feliz");

    // Ciro reacciona por vista (sutil)
    if (tab === "eventos") ciroSetEstado("excited");
    else if (tab === "avisos") ciroSetEstado("stop");
    else if (tab === "inicio") ciroSetEstado("feliz");
    else ciroSetEstado("calm");

    // chat escena
    jcChatPlayScene(tab);
  }

  /* =========================
     CHAT (mini novela)
     ========================= */
  const jcChatBody = document.getElementById("jcChatBody");
  const jcChatWidget = document.getElementById("jcChat");
  const jcChatToggle = document.getElementById("jcChatToggle");

  const JC_CHAR_INFO = {
    mia: { name: "Mia", initial: "M" },
    ciro: { name: "Ciro", initial: "C" },
    angie: { name: "Angie", initial: "A" },
    system: { name: "Sistema", initial: "★" }
  };

  function jcChatAddMessage(msg) {
    if (!jcChatBody) return;

    const info = JC_CHAR_INFO[msg.from] || JC_CHAR_INFO.system;

    const row = document.createElement("div");
    row.className = `jc-chat-msg from-${msg.from}`;
    row.innerHTML = `
      <div class="jc-chat-avatar">${info.initial}</div>
      <div class="jc-chat-bubble">
        <div class="jc-chat-name">${info.name}</div>
        <div class="jc-chat-text">${safeText(msg.text)}</div>
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
    avisos: [
      { from: "ciro", text: "Avisos importantes. No digas después que nadie te avisó 😌", estado: "stop", delay: 400 },
      { from: "mia", text: "Solo lo necesario, para caminar juntos 💗", estado: "apoyo", delay: 1200 }
    ],
    "miembros-activos": [
      { from: "angie", text: "¡Mira cuántos ya se están sumando! 👥", estado: "feliz", delay: 400 },
      { from: "ciro", text: "Algún día: pizza gigante con todos los nombres 🍕", estado: "feliz", delay: 1200 }
    ]
  };

  function jcChatPlayScene(viewKey) {
    const scene = JC_CHAT_SCENES[viewKey];
    if (!scene || !jcChatWidget) return;

    const storageKey = `jc_chat_scene_${viewKey}`;
    if (sessionStorage.getItem(storageKey) === "1") return;
    sessionStorage.setItem(storageKey, "1");

    let totalDelay = 0;
    scene.forEach((msg) => {
      totalDelay += typeof msg.delay === "number" ? msg.delay : 800;
      setTimeout(() => jcChatAddMessage(msg), totalDelay);
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

    const mkBtn = (label, fn) => {
      const b = document.createElement("button");
      b.className = "jc-pill";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };

    angieWrap.innerHTML = "";
    Object.keys(ANGIE_ESTADOS).forEach((k) => {
      angieWrap.appendChild(mkBtn(k, () => angieSetEstado(k)));
    });

    miaWrap.innerHTML = "";
    // casual + elegant keys más usados
    ["guiando","apoyo","preocupada","triste","llorando","vergonzosa","sorprendida","elegant_relief","elegant_love","elegant_conf","elegant_cry"].forEach((k) => {
      if (!MIA_ESTADOS[k]) return;
      miaWrap.appendChild(mkBtn(k, () => miaSetEstado(k)));
    });

    ciroWrap.innerHTML = "";
    Object.keys(CIRO_ESTADOS).forEach((k) => {
      ciroWrap.appendChild(mkBtn(k, () => ciroSetEstado(k)));
    });
  }

  // cuando se construye modal por primera vez, rellenamos
  const _oldBuild = buildAngieModal;
  buildAngieModal = function () {
    _oldBuild();
    fillEmotionButtons();
  };

  /* =========================
     AUTH / ROLES (adminOnly)
     ========================= */
  async function onSession(session) {
    // ocultar adminOnly por defecto
    $$(".adminOnly").forEach((el) => (el.hidden = true));

    const uid = session?.user?.id || null;
    if (!uid || !sb?.from) return;

    try {
      const { data } = await sb.from("miembros").select("rol_key").eq("user_id", uid).maybeSingle();
      if (data?.rol_key === "admin" || data?.rol_key === "moderador") {
        $$(".adminOnly").forEach((el) => (el.hidden = false));
      }
    } catch (e) {
      console.warn("No se pudo leer rol:", e);
    }
  }

  if (sb?.auth?.onAuthStateChange) {
    sb.auth.onAuthStateChange(async (_event, session) => {
      await onSession(session);
      await cargarPublic();
    });
  }

  /* =========================
     CARGA PÚBLICA INICIAL
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

  /* =========================
     FAB + push aviso
     ========================= */
  document.getElementById("fab")?.addEventListener("click", () => {
    const active = $(".tab.active")?.dataset?.tab;

    if (active === "eventos") {
      document.getElementById("formEvento")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("evTitulo")?.focus();
      ciroSetEstado("excited");
      return;
    }

    if (active === "recursos") {
      document.getElementById("fileRec")?.click();
      angieSetEstado("traviesa");
      return;
    }

    alert("Acción rápida");
  });

  const btnPermPush = document.getElementById("btnPermPush");
  btnPermPush?.addEventListener("click", () => {
    alert("Las notificaciones push se activarán en una próxima versión 🙂");
  });

})();