/* ============================================================
   JUVENTUD CNC — app.js FINAL (FIX comunidad + perfil TDZ + bots + msg + eventos)
   ============================================================ */

const JC_BUILD = window.JC_BUILD || "dev";

(function autoUpdateOnNewBuild() {
  let prev = null;
  try { prev = localStorage.getItem("jc_build"); } catch {}

  if (prev && prev !== JC_BUILD) {
    try { sessionStorage.clear(); } catch {}

    if ("caches" in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {});
    }

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

  if (!sb) {
    console.error("❌ Supabase no inicializado: window.supabaseClient undefined. Revisa supabase-config.js y el orden de scripts.");
    alert("Error crítico: Supabase no está cargado.");
    throw new Error("Supabase client (sb) no definido");
  }

  const LOCALE = "es-PE";
  const TZ = "America/Lima";

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));
  const el = (id) => document.getElementById(id);

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
     MENSAJE SEMANAL (DINÁMICO)
     ========================= */
  function getWeekKey() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }

  async function renderWeeklyMessage() {
    const titleEl = document.getElementById("msgTitle");
    const bodyEl = document.getElementById("msgBody");
    const metaEl = document.getElementById("msgMeta");

    if (!titleEl || !bodyEl || !metaEl) return;

    const weekKey = getWeekKey();
    metaEl.textContent = `Semana ${weekKey.replace("-", " ")}`;

    let nombre = "bienvenido";
    let personalizado = false;

    try {
      if (sb?.auth?.getUser) {
        const { data: u } = await sb.auth.getUser();
        const userId = u?.user?.id;

        if (userId && sb?.from) {
          const { data } = await sb
            .from("miembros")
            .select("nombre")
            .eq("user_id", userId)
            .maybeSingle();

          if (data?.nombre) {
            nombre = data.nombre.trim();
            personalizado = true;
          }
        }
      }
    } catch (e) {
      console.warn("Mensaje semanal: sin perfil cargado aún");
    }

    if (personalizado) {
      titleEl.textContent = `🕊️ Hola, ${nombre}`;
      bodyEl.textContent =
        "Esta semana te invitamos a participar, compartir y crecer en comunidad. Gracias por ser parte activa de Juventud CNC 💙💗";
    } else {
      titleEl.textContent = "Bienvenido a Juventud CNC";
      bodyEl.textContent =
        "Broer , esta semana te invitamos a conocer la comunidad, explorar los espacios y dar el primer paso. Aquí todos sumamos 💙💗";
    }
  }

  /* =========================
     Drawer + overlay
     ========================= */
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const openDrawerBtn = $("#openDrawer");
  const closeDrawerBtn = $("#closeDrawer");

  const state = {
    drawerOpen: false,
    angieOpen: false,
    loginOpen: false
  };

  // ✅ FIX: declarar comunidad dentro del IIFE (strict mode)
  let comunidad = null;

  // =========================
  // BOTS: switch maestro (ON/OFF)
  // =========================
  let botsEnabled = true;
  try {
    const saved = localStorage.getItem("jc_bots_enabled");
    if (saved === "0") botsEnabled = false;
  } catch {}

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

  function normalizeTab(t) {
    if (!t) return "inicio";
    const key = String(t).trim();
    if (key === "avisos") return "judart";
    return key;
  }

  function syncOverlay() {
    const shouldShow = state.drawerOpen || state.angieOpen || state.loginOpen;
    if (!overlay) return;
    overlay.classList.toggle("show", shouldShow);
  }

  /* =========================
     LOGIN (Magic Link por email)
     ========================= */
  const btnLogin = document.getElementById("btnLogin");
  const loginModal = document.getElementById("loginModal");
  const loginClose = document.getElementById("loginClose");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginEstado = document.getElementById("loginEstado");

  function openLoginModal() {
    if (!loginModal) return;
    state.loginOpen = true;
    loginModal.style.display = "flex";
    loginModal.classList.add("show");
    syncOverlay();
    loginEmail?.focus();
  }

  function closeLoginModal() {
    if (!loginModal) return;
    state.loginOpen = false;
    loginModal.classList.remove("show");
    loginModal.style.display = "none";
    syncOverlay();
    if (loginEstado) loginEstado.textContent = "";
  }

  btnLogin?.addEventListener("click", () => openLoginModal());
  loginClose?.addEventListener("click", () => closeLoginModal());
  loginModal?.addEventListener("click", (e) => {
    if (e.target === loginModal) closeLoginModal();
  });

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb?.auth?.signInWithOtp) {
      if (loginEstado) loginEstado.textContent = "Auth no disponible.";
      return;
    }

    const email = (loginEmail?.value || "").trim().toLowerCase();
    if (!email) return;

    if (loginEstado) loginEstado.textContent = "Enviando enlace…";

    try {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: location.origin + location.pathname + "#perfil"
        }
      });

      if (error) throw error;

      if (loginEstado) loginEstado.textContent = "✅ Listo. Revisa tu correo y abre el enlace.";
      angieSetEstado?.("ok");
    } catch (err) {
      console.error("Login error:", err);
      if (loginEstado) loginEstado.textContent = `Error: ${err?.message || "no se pudo enviar"}`;
      angieSetEstado?.("confundida");
    }
  });

  // Cuando la sesión cambie, refrescamos perfil/comunidad
  if (sb?.auth?.onAuthStateChange) {
  sb.auth.onAuthStateChange(async (_event, _session) => {
    try { if (typeof cargarPerfil === "function") await cargarPerfil(); } catch {}

    try {
      const mod = window.jcComunidad || comunidad;
      const current = normalizeTab((location.hash || "#inicio").replace("#", ""));

      if (mod && typeof mod.refreshAuthAndMiembro === "function") {
        await mod.refreshAuthAndMiembro(); // ✅ actualiza state.user/state.canWrite + UI gate
      }

      // Si estás en Comunidad, refresca feed (para counts + corazón “on”)
      if (current === "comunidad" && mod && typeof mod.cargarFeed === "function") {
        await mod.cargarFeed({ force: true });
      }
    } catch {}
  });
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
    closeLoginModal();
  });

  /* =========================
     Theme: presets + tokens
     ========================= */
  const themePicker = $("#themePicker");

  function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function jcApplyTokens(tokens) {
    if (!tokens) return;
    const root = document.documentElement;

    const map = {
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
  window.jcApplyTokens = jcApplyTokens;

  function applyThemePreset(mode = "auto") {
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
  /* ============================================================
     FONDO GLOBAL: Importar desde galería (UI en pestaña BOX)
     - Aplica al fondo de la pantalla principal (no al view box)
     - Guarda en localStorage
     ============================================================ */
  const JC_BG_KEY = "jc_bg_main_dataurl";

  function jcApplyGlobalBackground(dataUrl) {
    try {
      if (dataUrl) {
        document.documentElement.style.setProperty("--jc-bg-image", `url("${dataUrl}")`);
        document.body.classList.add("jc-has-bg");
      } else {
        document.documentElement.style.removeProperty("--jc-bg-image");
        document.body.classList.remove("jc-has-bg");
      }
    } catch {}
  }

  function jcLoadGlobalBackground() {
    let dataUrl = "";
    try { dataUrl = localStorage.getItem(JC_BG_KEY) || ""; } catch {}
    if (dataUrl) jcApplyGlobalBackground(dataUrl);
  }

  function jcSaveGlobalBackground(dataUrl) {
    try { localStorage.setItem(JC_BG_KEY, dataUrl || ""); } catch {}
    jcApplyGlobalBackground(dataUrl || "");
  }

  // 🔥 Reescala/comprime para que no reviente el límite de localStorage
  function jcReadImageAsCompressedDataURL(file, { maxW = 1400, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) return reject(new Error("Archivo no es imagen"));

      const img = new Image();
      const fr = new FileReader();

      fr.onload = () => { img.src = String(fr.result || ""); };
      fr.onerror = reject;

      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const scale = w > maxW ? (maxW / w) : 1;
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;

        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return reject(new Error("No canvas ctx"));

        ctx2d.drawImage(img, 0, 0, cw, ch);

        // JPEG suele pesar menos que PNG
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out);
      };

      img.onerror = () => reject(new Error("No se pudo cargar imagen"));
      fr.readAsDataURL(file);
    });
  }

  function jcBindGlobalBackgroundUI() {
    // UI (en pestaña BOX)
    const btnPick = document.getElementById("btnBgPick");
    const btnClear = document.getElementById("btnBgClear");
    const input = document.getElementById("bgPickerInput");
    const estado = document.getElementById("bgPickEstado");

    if (!btnPick || !btnClear || !input) return;

    btnPick.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (estado) estado.textContent = "Cargando fondo…";

      try {
        const dataUrl = await jcReadImageAsCompressedDataURL(file, { maxW: 1400, quality: 0.82 });
        jcSaveGlobalBackground(dataUrl);
        if (estado) estado.textContent = "✅ Fondo aplicado";
        try { logAviso({ title: "Fondo", body: "Fondo global actualizado 🖼️" }); } catch {}
      } catch (e) {
        console.error("Fondo global:", e);
        if (estado) estado.textContent = "No se pudo aplicar el fondo.";
      } finally {
        try { input.value = ""; } catch {}
      }
    });

    btnClear.addEventListener("click", () => {
      jcSaveGlobalBackground("");
      if (estado) estado.textContent = "Fondo quitado.";
      try { logAviso({ title: "Fondo", body: "Fondo global quitado" }); } catch {}
    });
  }

  // ✅ Ejecutar: cargar fondo guardado + bind UI
  jcLoadGlobalBackground();
  jcBindGlobalBackgroundUI();
  
  /* =========================
     Angie: Modal con herramienta
     ========================= */
  const btnAngie = $("#btnAngie");
  let angieModal = null;

  const legacyPanel = $("#angie-panel");
  if (legacyPanel) legacyPanel.style.display = "none";

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
              <iframe src="Angie%20herramienta.html" title="Herramienta Angie"></iframe>
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

    const tabs = $$("[data-panel]", $("#jcAngieTabs"));
    const panels = $$("[data-panel]", angieModal).filter((x) => x.classList.contains("jc-panel"));
    tabs.forEach((b) => {
      b.addEventListener("click", () => {
        tabs.forEach((x) => x.classList.toggle("active", x === b));
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === b.dataset.panel));
      });
    });

    $("#jcCloseAngie")?.addEventListener("click", jcCloseAngieModal);
    $("#jcMiaCasual")?.addEventListener("click", () => miaSetModo("casual"));
    $("#jcMiaElegante")?.addEventListener("click", () => miaSetModo("elegante"));

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") jcCloseAngieModal();
    });

    botSetTimeout(fillEmotionButtons, 50);
  }

  function jcOpenAngieModal() {
    jcBuildAngieModal();
    state.angieOpen = true;
    angieModal?.classList.add("show");
    syncOverlay();
    miaSetModo("elegante");
  }

  function jcCloseAngieModal() {
    state.angieOpen = false;
    angieModal?.classList.remove("show");
    syncOverlay();
  }

  window.jcCloseAngieModal = jcCloseAngieModal;

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

    if (data.type === "angieEstado" && data.estado) { angieSetEstado(data.estado); return; }
    if (data.type === "miaEstado" && data.estado)   { miaSetEstado(data.estado); return; }
    if (data.type === "ciroEstado" && data.estado)  { ciroSetEstado(data.estado); return; }
  });

  /* =========================
     EVENTOS: Home y lista
     ========================= */
  async function cargarEventosHome() {
    const ul = $("#eventListHome");
    if (!ul) return;

    ul.innerHTML = "<li class='muted small'>Cargando…</li>";

    if (!sb?.from) {
      ul.innerHTML = "<li class='muted small'>Sin conexión al servidor.</li>";
      return;
    }

    try {
      const nowISO = new Date().toISOString();

      const { data, error } = await sb
        .from("eventos")
        .select("id,titulo,fecha,lugar,tipo")
        .gte("fecha", nowISO)
        .order("fecha", { ascending: true })
        .limit(5);

      if (error) throw error;

      const list = Array.isArray(data) ? data : [];
      if (!list.length) {
        ul.innerHTML = "<li class='muted small'>No hay eventos próximos aún.</li>";
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
          <div class="event-meta muted small">${d && !isNaN(d) ? fmtDateTime(d) : ""}</div>
        `;
        ul.appendChild(li);
      });
    } catch (e) {
      console.error("Error cargarEventosHome:", e);
      ul.innerHTML = "<li class='muted small'>No se pudieron cargar los eventos (permisos/RLS).</li>";
    }
  }

  /* =========================
     Mensaje semanal (Supabase)
     ========================= */
  async function cargarMensajeSemanal() {
    const title = $("#msgTitle");
    const body  = $("#msgBody");
    const meta  = $("#msgMeta");

    if (!title || !body) return;

    title.textContent = "Cargando…";
    body.textContent  = "Un momento…";
    if (meta) meta.textContent = "";

    if (!sb?.from) {
      try { await renderWeeklyMessage(); } catch {}
      return;
    }

    try {
      const { data, error } = await sb
        .from("mensajes_semanales")
        .select("titulo,contenido,fecha")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("mensajes_semanales error => fallback:", error);
        await renderWeeklyMessage();
        return;
      }

      if (!data) {
        await renderWeeklyMessage();
        return;
      }

      title.textContent = safeText(data.titulo || "Mensaje semanal");
      body.textContent  = safeText(data.contenido || "");
      if (meta) meta.textContent = data.fecha ? `Actualizado: ${fmtDate(new Date(data.fecha))}` : "";
    } catch (e) {
      console.error("Error cargarMensajeSemanal:", e);
      try { await renderWeeklyMessage(); } catch {
        title.textContent = "Error";
        body.textContent  = "No se pudo cargar el mensaje semanal.";
      }
    }
  }

  /* =========================
     EVENTOS (CRUD + calendario + permisos)
     ========================= */
  const EV = {
    canWrite: false,
    month: new Date(),
    selectedDayKey: "",
    lastList: [],
    bound: false
  };

  const fmtMonthLabel = (d) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, month: "long", year: "numeric" }).format(d);

  const fmtDayKey = (d) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  function toInputLocalValue(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  async function evRefreshAuth() {
    EV.canWrite = false;

    const gate = document.getElementById("evGate");
    const createWrap = document.getElementById("evCreateWrap");

    if (!sb?.auth?.getSession || !sb?.from) {
      if (gate) gate.textContent = "⚠️ Sin conexión a Supabase.";
      if (createWrap) createWrap.style.display = "none";
      EV.canWrite = false;
      return;
    }

    try {
      const { data } = await sb.auth.getSession();
      const user = data?.session?.user || null;

      if (!user?.id) {
        if (gate) gate.textContent = "👀 Estás en modo espectador. Regístrate en “Mi perfil” para crear/editar/borrar eventos.";
        if (createWrap) createWrap.style.display = "none";
        EV.canWrite = false;
        return;
      }

      const { data: miembro } = await sb
        .from("miembros")
        .select("id,nombre,rol_key,user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!miembro) {
        if (gate) gate.textContent = "🔒 Tienes sesión, pero aún no eres miembro. Ve a “Mi perfil” y guarda tu registro.";
        if (createWrap) createWrap.style.display = "none";
        EV.canWrite = false;
        return;
      }

      if (gate) gate.textContent = `✅ Hola ${safeText(miembro.nombre || "Miembro")}. Puedes crear/editar/borrar eventos.`;
      if (createWrap) createWrap.style.display = "";
      EV.canWrite = true;
    } catch (e) {
      console.error("Eventos auth:", e);
      if (gate) gate.textContent = "⚠️ No se pudo validar acceso. Intenta recargar.";
      if (createWrap) createWrap.style.display = "none";
      EV.canWrite = false;
    }
  }

  function tipoLabel(tipo) {
    const t = (tipo || "").toLowerCase();
    if (t === "formacion") return "📘 Formación";
    if (t === "servicio") return "🫶 Servicio";
    if (t === "convivencia") return "🤝 Convivencia";
    if (t === "oracion") return "🙏 Oración";
    return "📌 General";
  }

  function isPast(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  }

  function renderEventoLi(ev) {
    const li = document.createElement("li");
    li.className = "event-item";

    const d = ev.fecha ? new Date(ev.fecha) : null;
    const when = d ? fmtDateTime(d) : "";
    const past = d ? isPast(ev.fecha) : false;

    li.innerHTML = `
      <div style="min-width:0">
        <div class="event-title"><strong>${safeText(ev.titulo || "Evento")}</strong></div>
        <div class="muted small">${safeText(ev.lugar || "")}</div>

        <div class="event-badges">
          <span class="event-badge">${tipoLabel(ev.tipo)}</span>
          ${past ? `<span class="event-badge">✅ Realizado</span>` : `<span class="event-badge">⏳ Próximo</span>`}
        </div>

        ${EV.canWrite ? `
          <div class="event-actions">
            <button class="icon-mini" type="button" data-act="edit">✏️ Editar</button>
            <button class="icon-mini" type="button" data-act="delete">🗑️ Borrar</button>
          </div>
        ` : ``}
      </div>
      <div class="event-meta muted small">${when}</div>
    `;

    if (EV.canWrite) {
      li.querySelector('[data-act="edit"]')?.addEventListener("click", () => evOpenModal(ev));
      li.querySelector('[data-act="delete"]')?.addEventListener("click", () => evDelete(ev));
    }

    return li;
  }

  async function cargarEventos({ destinoId = "eventList", tipo = "", scope = "upcoming", q = "", sort = "asc" } = {}) {
    const ul = document.getElementById(destinoId);
    if (!ul) return;

    ul.innerHTML = "<li class='muted small'>Cargando…</li>";

    if (!sb?.from) {
      ul.innerHTML = "<li class='muted small'>No hay conexión al servidor.</li>";
      return;
    }

    try {
      let query = sb.from("eventos").select("id,titulo,fecha,lugar,tipo").limit(300);
      query = query.order("fecha", { ascending: sort !== "desc" });
      if (tipo) query = query.eq("tipo", tipo);

      const { data, error } = await query;
      if (error) throw error;

      let list = Array.isArray(data) ? data : [];

      const needle = (q || "").trim().toLowerCase();
      if (needle) {
        list = list.filter((ev) => {
          const a = (ev.titulo || "").toLowerCase();
          const b = (ev.lugar || "").toLowerCase();
          return a.includes(needle) || b.includes(needle);
        });
      }

      if (scope === "upcoming") list = list.filter((ev) => !isPast(ev.fecha));
      if (scope === "past") list = list.filter((ev) => isPast(ev.fecha));

      const listForCalendar = [...list];
      EV.lastList = listForCalendar;

      if (EV.selectedDayKey) {
        list = list.filter((ev) => {
          if (!ev.fecha) return false;
          return fmtDayKey(new Date(ev.fecha)) === EV.selectedDayKey;
        });
      }

      if (!list.length) {
        ul.innerHTML = "<li class='muted small'>No hay eventos para mostrar.</li>";
        return;
      }

      ul.innerHTML = "";
      list.forEach((ev) => ul.appendChild(renderEventoLi(ev)));
    } catch (e) {
      console.error("Error cargarEventos:", e);
      ul.innerHTML = "<li class='muted small'>Error cargando eventos.</li>";
    }
  }

  function evRenderCalendar() {
    const grid = document.getElementById("evCalendar");
    const label = document.getElementById("evCalLabel");
    const hint = document.getElementById("evDayHint");
    const clearBtn = document.getElementById("evClearDay");

    if (!grid) return;

    const base = new Date(EV.month.getFullYear(), EV.month.getMonth(), 1);
    if (label) label.textContent = fmtMonthLabel(base);

    const jsDay = base.getDay();
    const mondayIndex = (jsDay === 0 ? 6 : jsDay - 1);

    const start = new Date(base);
    start.setDate(base.getDate() - mondayIndex);

    const counts = new Map();
    (EV.lastList || []).forEach((ev) => {
      if (!ev.fecha) return;
      const key = fmtDayKey(new Date(ev.fecha));
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    grid.innerHTML = "";

    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);

      const key = fmtDayKey(day);
      const inMonth = day.getMonth() === base.getMonth();

      const cell = document.createElement("div");
      cell.className = "ev-day";
      if (!inMonth) cell.classList.add("muted");
      if (EV.selectedDayKey && key === EV.selectedDayKey) cell.classList.add("active");

      const count = counts.get(key) || 0;

      cell.innerHTML = `
        <div>${day.getDate()}</div>
        ${count ? `<div class="ev-dot"><i></i><span>${count}</span></div>` : ``}
      `;

      cell.addEventListener("click", () => {
        EV.selectedDayKey = (EV.selectedDayKey === key) ? "" : key;

        if (hint) hint.textContent = EV.selectedDayKey
          ? `Filtrando por día: ${EV.selectedDayKey}`
          : "Toca un día para filtrar";

        if (clearBtn) clearBtn.style.display = EV.selectedDayKey ? "" : "none";

        evRenderCalendar();
        evRefreshList();
      });

      grid.appendChild(cell);
    }

    if (hint) hint.textContent = EV.selectedDayKey
      ? `Filtrando por día: ${EV.selectedDayKey}`
      : "Toca un día para filtrar";

    if (clearBtn) clearBtn.style.display = EV.selectedDayKey ? "" : "none";
  }

  function evShiftMonth(delta) {
    EV.month = new Date(EV.month.getFullYear(), EV.month.getMonth() + delta, 1);
    EV.selectedDayKey = "";
    evRenderCalendar();
    evRefreshList();
  }

  const evModal = document.getElementById("evModal");
  const evModalClose = document.getElementById("evModalClose");
  const evModalMeta = document.getElementById("evModalMeta");

  const evEditForm = document.getElementById("evEditForm");
  const evEditTitulo = document.getElementById("evEditTitulo");
  const evEditFecha = document.getElementById("evEditFecha");
  const evEditLugar = document.getElementById("evEditLugar");
  const evEditTipo = document.getElementById("evEditTipo");
  const evEditEstado = document.getElementById("evEditEstado");
  const evEditDelete = document.getElementById("evEditDelete");

  let evEditing = null;

  function evOpenModal(ev) {
    if (!EV.canWrite) return;

    evEditing = ev;
    if (!evModal) return;

    if (evModalMeta) evModalMeta.textContent = safeText(ev.id || "");
    if (evEditTitulo) evEditTitulo.value = ev.titulo || "";
    if (evEditFecha) evEditFecha.value = toInputLocalValue(ev.fecha);
    if (evEditLugar) evEditLugar.value = ev.lugar || "";
    if (evEditTipo) evEditTipo.value = ev.tipo || "";

    if (evEditEstado) evEditEstado.textContent = "";
    evModal.style.display = "flex";
    evModal.classList.add("show");
  }

  function evCloseModal() {
    evEditing = null;
    if (!evModal) return;
    evModal.classList.remove("show");
    evModal.style.display = "none";
  }

  evModalClose?.addEventListener("click", evCloseModal);
  evModal?.addEventListener("click", (e) => { if (e.target === evModal) evCloseModal(); });

  async function evDelete(ev) {
    if (!EV.canWrite) return;
    const ok = confirm("¿Borrar este evento?");
    if (!ok) return;

    try {
      const { error } = await sb.from("eventos").delete().eq("id", ev.id);
      if (error) throw error;

      logAviso?.({ title: "Evento eliminado", body: safeText(ev.titulo || "") });
      cargarEventosHome?.();
      evCloseModal();
      evRefreshList();

      angieSetEstado?.("ok");
    } catch (err) {
      console.error("Error borrando evento:", err);
      alert("No se pudo borrar el evento.");
      angieSetEstado?.("confundida");
    }
  }

  evEditDelete?.addEventListener("click", async () => {
    if (!evEditing) return;
    await evDelete(evEditing);
  });

  evEditForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!EV.canWrite || !evEditing?.id) return;

    if (evEditEstado) evEditEstado.textContent = "Guardando…";

    const titulo = (evEditTitulo?.value || "").trim();
    const fechaRaw = evEditFecha?.value;
    const fechaISO = fechaRaw ? new Date(fechaRaw).toISOString() : null;
    const lugar = (evEditLugar?.value || "").trim();
    const tipo = (evEditTipo?.value || "").trim();

    if (!titulo || !fechaISO) {
      if (evEditEstado) evEditEstado.textContent = "Completa título y fecha.";
      angieSetEstado?.("confundida");
      return;
    }

    try {
      const { error } = await sb
        .from("eventos")
        .update({ titulo, fecha: fechaISO, lugar, tipo })
        .eq("id", evEditing.id);

      if (error) throw error;

      if (evEditEstado) evEditEstado.textContent = "Cambios guardados ✅";
      logAviso?.({ title: "Evento editado", body: safeText(titulo) });

      ciroSetEstado?.("feliz");
      angieSetEstado?.("ok");

      cargarEventosHome?.();
      evCloseModal();
      evRefreshList();
    } catch (err) {
      console.error("Error editando evento:", err);
      if (evEditEstado) evEditEstado.textContent = "No se pudo guardar. Intenta otra vez.";
      angieSetEstado?.("confundida");
    }
  });

  function evRefreshList() {
    const tipo = document.getElementById("filtroTipo")?.value || "";
    const scope = document.getElementById("evScope")?.value || "upcoming";
    const q = document.getElementById("evSearch")?.value || "";
    const sort = document.getElementById("evSort")?.value || "asc";

    cargarEventos({ destinoId: "eventList", tipo, scope, q, sort })
      .then(() => evRenderCalendar())
      .catch(() => {});
  }

  function evBindUI() {
    if (EV.bound) return; // ✅ evita duplicar listeners si entras/sales del tab
    EV.bound = true;

    document.getElementById("filtroTipo")?.addEventListener("change", evRefreshList);
    document.getElementById("evScope")?.addEventListener("change", evRefreshList);
    document.getElementById("evSort")?.addEventListener("change", evRefreshList);
    document.getElementById("btnEvRefresh")?.addEventListener("click", evRefreshList);

    (function bindSearchDebounce(){
      const input = document.getElementById("evSearch");
      if (!input) return;
      let t = null;
      input.addEventListener("input", () => {
        if (t) clearTimeout(t);
        t = setTimeout(evRefreshList, 180);
      });
    })();

    document.getElementById("evCalPrev")?.addEventListener("click", () => evShiftMonth(-1));
    document.getElementById("evCalNext")?.addEventListener("click", () => evShiftMonth(1));

    document.getElementById("evClearDay")?.addEventListener("click", () => {
      EV.selectedDayKey = "";
      evRenderCalendar();
      evRefreshList();
    });
  }

  const formEvento = document.getElementById("formEvento");
  formEvento?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const evEstado = document.getElementById("evEstado");
    if (evEstado) evEstado.textContent = "";

    if (!EV.canWrite) {
      if (evEstado) evEstado.textContent = "🔒 Solo miembros pueden crear eventos.";
      angieSetEstado?.("confundida");
      return;
    }

    // ✅ FIX: NO uses perfilEstado aquí (evita TDZ)
    if (!sb?.from) {
      if (evEstado) evEstado.textContent = "Sin conexión al servidor. No se puede guardar el evento ahora.";
      angieSetEstado?.("confundida");
      return;
    }

    const titulo = document.getElementById("evTitulo")?.value?.trim();
    const fechaRaw = document.getElementById("evFecha")?.value;
    const fechaISO = fechaRaw ? new Date(fechaRaw).toISOString() : null;
    const lugar = document.getElementById("evLugar")?.value?.trim() || "";
    const tipo = document.getElementById("evTipo")?.value?.trim() || "";

    if (!titulo || !fechaISO) {
      if (evEstado) evEstado.textContent = "Completa título y fecha.";
      angieSetEstado?.("confundida");
      return;
    }

    if (evEstado) evEstado.textContent = "Guardando…";

    try {
      const { error } = await sb.from("eventos").insert({ titulo, fecha: fechaISO, lugar, tipo });
      if (error) throw error;

      formEvento.reset();
      if (evEstado) evEstado.textContent = "Evento guardado ✅";

      logAviso?.({ title: "Nuevo evento", body: `${titulo} (${tipo || "general"})` });
      cargarEventosHome?.();

      ciroSetEstado?.("excited");
      angieSetEstado?.("sorprendida");

      evRefreshList();
    } catch (err) {
      console.error("Error insertando evento:", err);
      if (evEstado) evEstado.textContent = "No se pudo guardar el evento. Intenta más tarde.";
      angieSetEstado?.("confundida");
    }
  });

  async function initEventosView() {
    evBindUI();
    await evRefreshAuth();
    evRenderCalendar();
    evRefreshList();
  }

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

  const MIA_ESTADOS = {
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
  };

  function miaSetEstado(tipo = "guiando") {
    const widget = document.getElementById("miaWidget");
    const imgEl = document.getElementById("miaAvatarImg");
    const textEl = document.getElementById("miaText");
    if (!widget || !textEl) return;

    let estado = MIA_ESTADOS[tipo];
    if (!estado) estado = MIA_ESTADOS.guiando;

    if (imgEl && estado.imgs) imgEl.src = pick(estado.imgs);
    textEl.textContent = pick(estado.frases, "Estoy aquí 💗");

    widget.classList.add("mia-widget--visible");
  }
  window.miaSetEstado = miaSetEstado;

  let miaModo = localStorage.getItem("jc_mia_modo") || "casual";
  function miaSetModo(modo = "casual") {
    miaModo = modo === "elegante" ? "elegante" : "casual";
    try { localStorage.setItem("jc_mia_modo", miaModo); } catch {}

    if (miaModo === "elegante") miaSetEstado("elegante");
    else miaSetEstado("guiando");
  }
  window.miaSetModo = miaSetModo;

  const CIRO_ESTADOS = {
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

  (function preloadAllBotImages() {
    const all = [
      ...Object.values(ANGIE_ESTADOS).map((x) => x.img),
      ...Object.values(MIA_ESTADOS).flatMap((x) => x.imgs || []),
      ...Object.values(CIRO_ESTADOS).map((x) => x.img)
    ];
    jcPreloadImages(all);
  })();

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

  document.getElementById("angieClose")?.addEventListener("click", () => $("#angieWidget")?.classList.remove("angie-widget--visible"));
  document.getElementById("miaClose")?.addEventListener("click", () => $("#miaWidget")?.classList.remove("mia-widget--visible"));
  document.getElementById("ciroClose")?.addEventListener("click", () => $("#ciroWidget")?.classList.remove("ciro-widget--visible"));

  /* =========================
     CHAT (encerrado en BOX)
     ========================= */
  let jcChatBody = document.getElementById("jcChatBody");
  let jcChatWidget = document.getElementById("jcChat");
  let jcChatToggle = document.getElementById("jcChatToggle");

  function getBoxViewEl() {
    return document.querySelector('[data-view="box"]') || null;
  }

  function getChatMount() {
    const mount = document.getElementById("boxChatMount");
    if (mount) return mount;

    const boxView = getBoxViewEl();
    if (boxView) {
      const alt = boxView.querySelector(".box-chat-mount");
      return alt || boxView;
    }
    return document.body;
  }

  function applyChatLayoutForMount(mountEl) {
    if (!jcChatWidget) return;

    const isInBox = !!(mountEl && (mountEl.id === "boxChatMount" || mountEl.closest?.('[data-view="box"]')));
    jcChatWidget.classList.toggle("in-box", isInBox);

    if (isInBox) {
      jcChatWidget.style.position = "relative";
      jcChatWidget.style.inset = "auto";
      jcChatWidget.style.right = "auto";
      jcChatWidget.style.bottom = "auto";
      jcChatWidget.style.width = "100%";
      jcChatWidget.style.maxWidth = "100%";
    } else {
      jcChatWidget.style.position = "";
      jcChatWidget.style.inset = "";
      jcChatWidget.style.right = "";
      jcChatWidget.style.bottom = "";
      jcChatWidget.style.width = "";
      jcChatWidget.style.maxWidth = "";
    }
  }

  function moveChatToMount() {
    const mount = getChatMount();
    if (!jcChatWidget || !mount) return;

    try {
      const cs = getComputedStyle(mount);
      if (cs.position === "static") mount.style.position = "relative";
    } catch {}

    if (jcChatWidget.parentElement !== mount) mount.appendChild(jcChatWidget);
    applyChatLayoutForMount(mount);
  }

  (function ensureChatWidget() {
    if (jcChatWidget && jcChatBody) {
      moveChatToMount();
      return;
    }

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

    getChatMount().appendChild(chat);

    jcChatWidget = chat;
    jcChatBody = document.getElementById("jcChatBody");
    jcChatToggle = document.getElementById("jcChatToggle");

    moveChatToMount();
  })();

  const JC_CHAR_INFO = {
    mia: { name: "Mia", initial: "M" },
    ciro: { name: "Ciro", initial: "C" },
    angie: { name: "Angie", initial: "A" },
    system: { name: "Sistema", initial: "★" }
  };

  function syncChatVisibility(tabKey) {
    if (!jcChatWidget) return;

    const t = normalizeTab(tabKey);
    const shouldShow = botsEnabled && t === "box";

    moveChatToMount();
    jcChatWidget.style.display = shouldShow ? "" : "none";
  }

  function hideBotsUI() {
    document.getElementById("angieWidget")?.classList.remove("angie-widget--visible");
    document.getElementById("miaWidget")?.classList.remove("mia-widget--visible");
    document.getElementById("ciroWidget")?.classList.remove("ciro-widget--visible");
    clearBotTimers();
    syncChatVisibility("inicio");
  }

  function showBotsUI() {
    const current = normalizeTab((location.hash || "#inicio").replace("#", ""));
    syncChatVisibility(current);
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

    if (msg.from === "angie") angieSetEstado(msg.estado || "feliz");
    if (msg.from === "mia") miaSetEstado(msg.estado || (miaModo === "elegante" ? "elegante" : "guiando"));
    if (msg.from === "ciro") ciroSetEstado(msg.estado || "feliz");
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
      if (!silent) jcChatAddMessage({ from: "system", text: "Bots encendidos 🤖✨" });
      const current = normalizeTab((location.hash || "#inicio").replace("#", ""));
      botsSegunVista(current);
    }

    updateBotsButtonUI();
  }

    ensureBotsButton();
  if (!botsEnabled) hideBotsUI();

  const JC_CHAT_SCENES = {
    // =========================
    // BOX (drama sentimental + propósito)
    // =========================
    box: [
      { from: "system", text: "Bienvenido a Box 📦 — aquí se habla con calma.", delay: 200 },

      { from: "mia", text: "Aquí no quiero que te pierdas. Respira… yo te acompaño 💗", estado: "guiando", delay: 650 },
      { from: "ciro", text: "Orden y enfoque. Pero… también corazón. No somos máquinas.", estado: "calm", delay: 900 },

      { from: "angie", text: "Mia… siempre tan perfecta. A veces me pregunto si yo solo estorbo 😅", estado: "confundida", delay: 1050 },
      { from: "mia", text: "Angie, tú no estorbas. Tú levantas el ánimo cuando todos están cansados.", estado: "apoyo", delay: 1150 },

      { from: "ciro", text: "Y cuando alguien se rompe por dentro… Angie lo nota primero.", estado: "worried", delay: 1200 },
      { from: "angie", text: "No digas eso, Ciro… después me pongo sentimental 🙄…", estado: "vergonzosa", delay: 1050 },

      { from: "ciro", text: "Yo también me pongo. Pero aprendí a guardármelo… para no preocupar a Mia.", estado: "calm", delay: 1100 },
      { from: "mia", text: "Ciro… si te lo guardas, te pesa. No tienes que cargar solo.", estado: "elegante", delay: 1200 },

      { from: "ciro", text: "A veces siento que si me detengo… todo se cae. Y me da miedo fallarte.", estado: "worried", delay: 1250 },
      { from: "mia", text: "No me fallas. Me cuidas. Pero yo también te cuido a ti.", estado: "apoyo", delay: 1150 },

      { from: "angie", text: "Ok… esto es demasiado lindo. (Y yo aquí haciéndome la fuerte 😭)", estado: "triste", delay: 1150 },
      { from: "ciro", text: "Angie… tú vales mucho. Aunque te hagas la traviesa.", estado: "calm", delay: 1100 },
      { from: "angie", text: "¿Y por qué cuando dices eso… me duele bonito? 😅", estado: "vergonzosa", delay: 1050 },

      { from: "mia", text: "Escuchen: aquí se sirve con respeto. Y con verdad. Si algo duele, se habla.", estado: "elegante", delay: 1200 },
      { from: "ciro", text: "Entonces digo la verdad: no quiero que nadie aquí se sienta solo.", estado: "happy_pray", delay: 1250 },

      { from: "angie", text: "Ya… me ganaste. Gracias por no rendirte con nosotros.", estado: "feliz", delay: 1050 },
      { from: "mia", text: "Eso es Box: un lugar seguro para ordenar… y sanar un poquito.", estado: "apoyo", delay: 1100 },

      { from: "system", text: "🕊️ Promesa del equipo: servir juntos, sin máscaras, con amor y fuerza.", delay: 900 }
    ],

  
    // MIEMBROS ACTIVOS (drama largo)
    // =========================
    "miembros-activos": [
      { from: "system", text: "Miembros activos 👥 — se siente la familia creciendo.", delay: 250 },
      { from: "mia", text: "Me da paz verlos aquí. Somos equipo, familia… y sí, los cuido como a mis hermanos 🤍", estado: "apoyo", delay: 900 },
      { from: "ciro", text: "Yo… solo quiero que Mia esté bien. Si tengo que cargar el peso, lo cargo. Sin que se note.", estado: "calm", delay: 1250 },
      { from: "angie", text: "Ayyy Ciro… siempre tan fuerte 😏 (sí, ya te vimos). Igual… me gusta cuando hablas así.", estado: "vergonzosa", delay: 1350 },
      { from: "mia", text: "Ciro, no tienes que demostrar nada para que te valoremos. Eres mi hermano de corazón, ¿ok? ✨", estado: "elegante", delay: 1400 },
      { from: "ciro", text: "Sí… hermana. Entendido. (Respira, Ciro.) Igual voy a estar. Siempre.", estado: "worried", delay: 1500 },
      { from: "angie", text: "Y tú… también mereces que te miren bonito, ¿sabías? No siempre tienes que ser el fuerte…", estado: "confundida", delay: 1550 },
      { from: "ciro", text: "Angie, tú vales muchísimo. Pero no te enredes. Cuida tu corazón. Yo te cuido como a mi hermana.", estado: "calm", delay: 1600 },
      { from: "angie", text: "Claro… tu “hermana”. 😅 (ok ok, ya. Mejor… sigamos sirviendo).", estado: "triste", delay: 1700 },
      { from: "system", text: "Plot twist guardado 😇 — aquí lo importante: servir juntos, con respeto y corazón.", delay: 1200 }
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
      const { data, error } = await sb
        .from("miembros")
        .select("nombre, rol_key")
        .order("created_at", { ascending: false })
        .limit(80);

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
      lista.innerHTML = "<li>No se pudo cargar la lista de miembros.</li>";
      try { angieSetEstado?.("confundida"); } catch {}
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
      const { data, error } = await sb
        .from("recursos")
        .select("id,titulo,categoria,path,mime,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
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

    if (t === "inicio") {
      cargarMensajeSemanal();
      cargarEventosHome();
    }

    tabs.forEach((b) => {
      const on = normalizeTab(b.dataset.tab) === t;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    showView(t);
    syncChatVisibility(t);

    if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);

    botsSegunVista(t);

    // ✅ FIX: no rompas si aún no se inicializó
    comunidad?.onTab?.(t);

    if (t === "miembros-activos") cargarListaMiembros();
    if (t === "eventos") initEventosView();
    if (t === "recursos") listarRecursos();
  }

  $$("[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      activate(el.getAttribute("data-tab"));
      closeDrawer();
    });
  });

  window.addEventListener("hashchange", () => activate((location.hash || "#inicio").replace("#", "")));

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

    const wAngie = document.getElementById("angieWidget");
    const wMia   = document.getElementById("miaWidget");
    const wCiro  = document.getElementById("ciroWidget");

    function showOnly(which) {
      wAngie?.classList.toggle("angie-widget--visible", which === "angie");
      wMia?.classList.toggle("mia-widget--visible", which === "mia");
      wCiro?.classList.toggle("ciro-widget--visible", which === "ciro");
    }

    const key = `jc_bot_turn_${t}`;
    let turn = Number(sessionStorage.getItem(key) || "0");
    turn = (turn + 1) % 3;
    sessionStorage.setItem(key, String(turn));

    const order = ["angie", "mia", "ciro"];
    let activeBot = order[turn];

    if (t === "perfil") activeBot = "mia";

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

    if (t === "perfil" || state.angieOpen) miaSetModo("elegante");
    else miaSetModo("casual");

    if (activeBot === "angie") {
      showOnly("angie");
      angieSetEstado(mapaAngie[t] || "feliz");
    } else if (activeBot === "mia") {
      showOnly("mia");
      miaSetEstado(t === "comunidad" ? "apoyo" : "guiando");
    } else {
      showOnly("ciro");
      if (t === "eventos") ciroSetEstado("excited");
      else if (t === "judart" || t === "avisos") ciroSetEstado("stop");
      else if (t === "inicio") ciroSetEstado("feliz");
      else ciroSetEstado("calm");
    }

    jcChatPlayScene(t);
  }

  /* =========================
     PERFIL (LISTO)
     ========================= */
  const formMiembro = document.getElementById("formMiembro");
  const perfilNombreTexto = document.getElementById("perfilNombreTexto");
  const perfilRolTexto = document.getElementById("perfilRolTexto");
  const perfilFraseTexto = document.getElementById("perfilFraseTexto");
  const perfilEstado = document.getElementById("perfilEstado");
  const btnCerrarPerfil = document.getElementById("btnCerrarPerfil");

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
    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  async function cargarPerfil() {
    if (!sb?.from) return;

    try {
      const userId = await ensureUserId();

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
        const nombre = data.nombre || "Miembro";
        if (perfilNombreTexto) perfilNombreTexto.textContent = safeText(nombre);
        if (perfilRolTexto) perfilRolTexto.textContent = data.rol_key ? `Rol: ${data.rol_key}` : "";
        if (perfilFraseTexto) perfilFraseTexto.textContent = safeText(data.frase || "");
        if (btnCerrarPerfil) btnCerrarPerfil.style.display = "inline-flex";

        if (formMiembro) formMiembro.style.display = "none";

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

  formMiembro?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (perfilEstado) perfilEstado.textContent = "Guardando…";

    // ✅ FIX: nada de renderWeeklyMessage aquí
    if (!sb?.from) {
      if (perfilEstado) perfilEstado.textContent = "Sin conexión al servidor. No se puede guardar el perfil ahora.";
      angieSetEstado?.("confundida");
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

      await cargarPerfil();
    } catch (err) {
      console.error("Error guardar perfil:", err);
      if (perfilEstado) perfilEstado.textContent = `Error guardando: ${err?.message || "revisa consola"}`;
      angieSetEstado("confundida");
    }
  });

  perfilAvatarInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (perfilEstado) perfilEstado.textContent = "Selecciona una imagen válida.";
      return;
    }

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

  btnCerrarPerfil?.addEventListener("click", async () => {
    try { await sb?.auth?.signOut?.(); } catch {}

    if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
    if (perfilEstado) perfilEstado.textContent = "Sesión cerrada.";

    if (formMiembro) formMiembro.style.display = "";
    if (perfilNombreTexto) perfilNombreTexto.textContent = "Aún sin registrar";
    if (perfilRolTexto) perfilRolTexto.textContent = "";
    if (perfilFraseTexto) perfilFraseTexto.textContent = "Completa tu perfil para formar parte de la comunidad.";
    setAvatarInitialFromName("");
    loadAvatarFromLocal();

    angieSetEstado("saludo");
  });

  // =========================
  // INICIAL: Comunidad module (ya existe createComunidadModule abajo)
  // =========================
  comunidad = createComunidadModule({
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

  window.jcComunidad = comunidad;
  comunidad.init();

  // Inicial
  cargarPerfil();
  activate((location.hash || "#inicio").replace("#", ""));

})();

/* ==========================================================
   COMUNIDAD MODULE (posts + comentarios + corazones)
   ========================================================== */
function createComunidadModule(ctx = {}) {
  const sb = ctx.sb || window.supabaseClient;

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

  const state = {
    inited: false,
    cat: "chicos",
    user: null,
    miembro: null,
    canWrite: false,
    modalOpen: false,
    modalPost: null,
  };

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

  function setGate(msg) { if (dom.gate) dom.gate.textContent = msg; }
  function setComposerVisible(on) { if (dom.composer) dom.composer.style.display = on ? "block" : "none"; }
  function setCommentComposerVisible(on) {
    if (dom.commentComposer) dom.commentComposer.style.display = on ? "block" : "none";
    if (dom.commentGate) dom.commentGate.style.display = on ? "none" : "block";
  }
  function setStatus(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("error", !!isError);
  }

  // ✅ FIX: si el modal de comentarios está abierto, sincroniza el gate/composer al cambiar auth
  function syncCommentComposerIfModal() {
    if (!state.modalOpen) return;
    setCommentComposerVisible(!!state.canWrite);
  }

  async function refreshAuthAndMiembro() {
    state.user = null;
    state.miembro = null;
    state.canWrite = false;

    if (!sb?.auth?.getSession || !sb?.from) {
      setGate("⚠️ Sin conexión a Supabase.");
      setComposerVisible(false);
      setCommentComposerVisible(false);
      syncCommentComposerIfModal();
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
        syncCommentComposerIfModal();
        return;
      }

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
        syncCommentComposerIfModal();
        return;
      }

      const rol = miembro.rol_key ? ` (${miembro.rol_key})` : "";
      setGate(`✅ Hola ${safeText(miembro.nombre)}${rol}. Puedes publicar, comentar y reaccionar ❤️`);
      setComposerVisible(true);
      syncCommentComposerIfModal();
    } catch (e) {
      console.error("Comunidad: refreshAuthAndMiembro:", e);
      setGate("⚠️ No se pudo validar tu acceso. Intenta recargar.");
      setComposerVisible(false);
      setCommentComposerVisible(false);
      syncCommentComposerIfModal();
    }
  }

  function bindOnce() {
    dom.tabs?.forEach((b) => {
      b.addEventListener("click", async () => {
        const cat = b.dataset.comuCat || "chicos";
        setActiveCat(cat);
        await cargarFeed();
      });
    });

    dom.btnRefresh?.addEventListener("click", () => cargarFeed({ force: true }));

    dom.btnClear?.addEventListener("click", () => {
      if (dom.titulo) dom.titulo.value = "";
      if (dom.contenido) dom.contenido.value = "";
      setStatus(dom.estado, "");
      angieSetEstado?.("ok");
    });

    dom.formPost?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await crearPost();
    });

    dom.modalClose?.addEventListener("click", closeModal);
    dom.modal?.addEventListener("click", (e) => { if (e.target === dom.modal) closeModal(); });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.modalOpen) closeModal();
    });

    dom.btnCommentClear?.addEventListener("click", () => {
      if (dom.commentText) dom.commentText.value = "";
      setStatus(dom.commentEstado, "");
      miaSetEstado?.("apoyo");
    });

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

    if (state.cat === "chicos") ciroSetEstado?.("excited");
    if (state.cat === "chicas") angieSetEstado?.("feliz");
    if (state.cat === "dinamicas") miaSetEstado?.("guiando");
    if (state.cat === "foro") angieSetEstado?.("saludo");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  async function cargarFeed({ force = false } = {}) {
    if (!dom.list) return;

    dom.list.innerHTML = `<div class="muted small">Cargando publicaciones…</div>`;

    if (!sb?.from) {
      dom.list.innerHTML = `<div class="muted small">Sin conexión al servidor.</div>`;
      return;
    }

    try {
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

      const counts = new Map();
      const mine = new Set();
      reactions.forEach((x) => {
        counts.set(x.post_id, (counts.get(x.post_id) || 0) + 1);
        if (state.user?.id && x.user_id === state.user.id) mine.add(x.post_id);
      });

      dom.list.innerHTML = "";
      list.forEach((p) => dom.list.appendChild(renderPostCard(p, counts.get(p.id) || 0, mine.has(p.id))));
    } catch (e) {
      console.error("Comunidad: cargarFeed:", e);
      dom.list.innerHTML = `<div class="muted small">Error cargando publicaciones.</div>`;
      angieSetEstado?.("confundida");
    }
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
      logAviso?.({ title: "Comunidad", body: "🔒 Regístrate para reaccionar ❤️" });
      angieSetEstado?.("saludo");
      return;
    }

    if (!sb?.from) return;

    try {
      const { data: existing, error: exErr } = await sb
        .from("reacciones_comunidad")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", state.user.id)
        .eq("tipo", "heart")
        .maybeSingle();

      if (exErr) throw exErr;

      if (existing?.id) {
        const { error: delErr } = await sb
          .from("reacciones_comunidad")
          .delete()
          .eq("id", existing.id);
        if (delErr) throw delErr;

        miaSetEstado?.("apoyo");
      } else {
        const { error: insErr } = await sb
          .from("reacciones_comunidad")
          .insert({ post_id: postId, user_id: state.user.id, tipo: "heart" });
        if (insErr) throw insErr;

        angieSetEstado?.("vergonzosa");
      }

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

    // ✅ respeta permisos actuales (y se auto-actualiza con refreshAuthAndMiembro)
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

  async function init() {
    if (state.inited) return;
    state.inited = true;

    cacheDom();
    bindOnce();
    setActiveCat(state.cat);

    await refreshAuthAndMiembro();
  }

  async function onTab(tabName) {
    const t = normalizeTab(tabName);
    if (t !== "comunidad") return;

    await refreshAuthAndMiembro();
    await cargarFeed();
  }

  // ✅ FIX: exporta refreshAuthAndMiembro para que el onAuthStateChange lo llame
  return { init, onTab, cargarFeed, refreshAuthAndMiembro };
}