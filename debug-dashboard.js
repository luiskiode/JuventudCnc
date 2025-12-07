// debug-dashboard.js
// Panel técnico de diagnóstico + reparación para Juventud CNC
// Se muestra con ?debug=1 o con Ctrl+Alt+D

(function () {
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.has("debug") || localStorage.getItem("jc_debug") === "1";

  // Atajo: Ctrl+Alt+D para togglear debug
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d") {
      const cur = localStorage.getItem("jc_debug") === "1";
      localStorage.setItem("jc_debug", cur ? "0" : "1");
      if (!cur) {
        window.location.search = addOrUpdateQueryParam(window.location.search, "debug", "1");
      } else {
        window.location.search = removeQueryParam(window.location.search, "debug");
      }
    }
  });

  if (!debugEnabled) return;

  /* -------------------------------
     Helpers para query params
     ------------------------------- */
  function addOrUpdateQueryParam(search, key, value) {
    const p = new URLSearchParams(search);
    p.set(key, value);
    return "?" + p.toString();
  }
  function removeQueryParam(search, key) {
    const p = new URLSearchParams(search);
    p.delete(key);
    const s = p.toString();
    return s ? "?" + s : "";
  }

  /* -------------------------------
     Estado interno
     ------------------------------- */
  const state = {
    logs: [],
    sections: {},
  };

  const LEVEL_COLORS = {
    ok: "#22c55e",
    warn: "#eab308",
    error: "#ef4444",
    info: "#60a5fa",
  };

  /* -------------------------------
     Crear estilos del panel
     ------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
  #jc-debug-panel {
    position: fixed;
    right: 12px;
    bottom: 90px;
    width: min(380px, 95vw);
    max-height: 70vh;
    background: rgba(15,23,42,0.97);
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,0.6);
    box-shadow: 0 18px 40px rgba(0,0,0,0.7);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #e5e7eb;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #jc-debug-header {
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid rgba(51,65,85,0.9);
    background: linear-gradient(to right, rgba(37,99,235,0.25), rgba(236,72,153,0.25));
  }
  #jc-debug-title {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
  }
  #jc-debug-chip {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.7);
    background: rgba(15,23,42,0.8);
  }
  #jc-debug-close {
    border: none;
    background: transparent;
    color: #e5e7eb;
    font-size: 16px;
    cursor: pointer;
  }
  #jc-debug-body {
    padding: 8px 10px 10px;
    overflow: auto;
    font-size: 12px;
  }
  .jc-debug-section {
    border-radius: 10px;
    border: 1px solid rgba(148,163,184,0.4);
    padding: 6px 8px;
    margin-bottom: 6px;
    background: rgba(15,23,42,0.95);
  }
  .jc-debug-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
  }
  .jc-debug-section-title {
    font-size: 11px;
    font-weight: 600;
  }
  .jc-debug-section-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.6);
  }
  .jc-debug-logline {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    margin-bottom: 2px;
  }
  .jc-debug-logdot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    margin-top: 4px;
    flex-shrink: 0;
  }
  .jc-debug-logtext {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .jc-debug-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .jc-debug-btn {
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.6);
    background: rgba(15,23,42,0.95);
    color: #e5e7eb;
    font-size: 11px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .jc-debug-btn:hover {
    background: rgba(37,99,235,0.25);
  }
  .jc-debug-pill-ok {
    border-color: #22c55e;
    color: #bbf7d0;
  }
  .jc-debug-pill-warn {
    border-color: #eab308;
    color: #fef9c3;
  }
  .jc-debug-pill-error {
    border-color: #ef4444;
    color: #fecaca;
  }
  `;
  document.head.appendChild(style);

  /* -------------------------------
     Crear DOM del panel
     ------------------------------- */
  const panel = document.createElement("aside");
  panel.id = "jc-debug-panel";
  panel.innerHTML = `
    <div id="jc-debug-header">
      <div id="jc-debug-title">Panel técnico • Juventud CNC</div>
      <div id="jc-debug-chip">Diagnóstico en curso…</div>
      <button id="jc-debug-close" title="Cerrar">✕</button>
    </div>
    <div id="jc-debug-body"></div>
  `;
  document.body.appendChild(panel);

  const chip = panel.querySelector("#jc-debug-chip");
  const body = panel.querySelector("#jc-debug-body");
  panel.querySelector("#jc-debug-close").addEventListener("click", () => {
    panel.remove();
  });

  /* -------------------------------
     Log + secciones
     ------------------------------- */
  function ensureSection(key, title) {
    if (state.sections[key]) return state.sections[key];
    const sec = document.createElement("section");
    sec.className = "jc-debug-section";
    sec.innerHTML = `
      <div class="jc-debug-section-header">
        <div class="jc-debug-section-title">${title}</div>
        <div class="jc-debug-section-badge" data-section-badge="${key}">…</div>
      </div>
      <div data-section-body="${key}"></div>
      <div class="jc-debug-actions" data-section-actions="${key}"></div>
    `;
    body.appendChild(sec);
    state.sections[key] = sec;
    return sec;
  }

  function setSectionBadge(key, level) {
    const badge = panel.querySelector(`[data-section-badge="${key}"]`);
    if (!badge) return;
    badge.classList.remove("jc-debug-pill-ok", "jc-debug-pill-warn", "jc-debug-pill-error");
    if (level === "ok") {
      badge.textContent = "OK";
      badge.classList.add("jc-debug-pill-ok");
    } else if (level === "warn") {
      badge.textContent = "WARN";
      badge.classList.add("jc-debug-pill-warn");
    } else if (level === "error") {
      badge.textContent = "ERROR";
      badge.classList.add("jc-debug-pill-error");
    } else {
      badge.textContent = "…";
    }
  }

  function addActionButton(sectionKey, label, handler) {
    const actions = panel.querySelector(`[data-section-actions="${sectionKey}"]`);
    if (!actions) return;
    const btn = document.createElement("button");
    btn.className = "jc-debug-btn";
    btn.textContent = label;
    btn.addEventListener("click", handler);
    actions.appendChild(btn);
  }

  function log(sectionKey, title, level, message) {
    ensureSection(sectionKey, title);
    const sectionBody = panel.querySelector(`[data-section-body="${sectionKey}"]`);
    const line = document.createElement("div");
    line.className = "jc-debug-logline";
    const dot = document.createElement("div");
    dot.className = "jc-debug-logdot";
    dot.style.background = LEVEL_COLORS[level] || LEVEL_COLORS.info;
    const text = document.createElement("div");
    text.className = "jc-debug-logtext";
    text.textContent = message;
    line.appendChild(dot);
    line.appendChild(text);
    sectionBody.appendChild(line);

    state.logs.push({ sectionKey, level });

    // actualizar chip global
    updateGlobalChip();
  }

  function updateGlobalChip() {
    const hasError = state.logs.some((l) => l.level === "error");
    const hasWarn = state.logs.some((l) => l.level === "warn");
    if (hasError) {
      chip.textContent = "Problemas detectados";
      chip.style.borderColor = "#ef4444";
      chip.style.color = "#fecaca";
    } else if (hasWarn) {
      chip.textContent = "Advertencias";
      chip.style.borderColor = "#eab308";
      chip.style.color = "#fef9c3";
    } else {
      chip.textContent = "Todo OK";
      chip.style.borderColor = "#22c55e";
      chip.style.color = "#bbf7d0";
    }
  }

  /* -------------------------------
     DIAGNÓSTICOS
     ------------------------------- */

  async function checkEnvironment() {
    const key = "env";
    ensureSection(key, "Entorno y navegador");

    log(key, "Entorno y navegador", "info", `UserAgent: ${navigator.userAgent}`);

    if ("serviceWorker" in navigator) {
      log(key, "Entorno y navegador", "ok", "Service Workers soportados ✅");
    } else {
      log(key, "Entorno y navegador", "warn", "Service Workers NO soportados en este navegador ⚠️");
    }

    if ("caches" in window) {
      log(key, "Entorno y navegador", "ok", "API de caches disponible ✅");
    } else {
      log(key, "Entorno y navegador", "warn", "API de caches NO disponible ⚠️");
    }

    if ("localStorage" in window) {
      log(key, "Entorno y navegador", "ok", "localStorage disponible ✅");
    } else {
      log(key, "Entorno y navegador", "warn", "localStorage NO disponible ⚠️");
    }

    setSectionBadge(key, "ok");

    // Acciones
    addActionButton(key, "Resetear localStorage", () => {
      localStorage.clear();
      log(key, "Entorno y navegador", "info", "localStorage limpiado. Vuelve a recargar la app.");
    });
  }

  async function checkSupabase() {
    const key = "supabase";
    ensureSection(key, "Supabase");

    const sb = window.supabaseClient;
    if (!sb) {
      log(
        key,
        "Supabase",
        "error",
        "window.supabaseClient NO está definido. Revisa supabase-config.js.\nSugerencia: usa window.supabaseClient = supabase.createClient(URL, KEY); sin 'import'."
      );
      setSectionBadge(key, "error");
      return;
    }

    log(key, "Supabase", "ok", "Cliente Supabase detectado ✅");

    try {
      const { data, error } = await sb.from("eventos").select("*").limit(1);
      if (error) {
        log(key, "Supabase", "warn", `Conexión OK pero error al leer tabla 'eventos': ${error.message}`);
        setSectionBadge(key, "warn");
      } else {
        log(
          key,
          "Supabase",
          "ok",
          `Conexión a Supabase correcta. 'eventos' responde (${data ? data.length : 0} filas).`
        );
        setSectionBadge(key, "ok");
      }
    } catch (err) {
      log(key, "Supabase", "error", `Fallo de conexión con Supabase: ${err.message}`);
      setSectionBadge(key, "error");
    }

    addActionButton(key, "Forzar reintento lectura 'eventos'", async () => {
      await checkSupabase();
    });
  }

  async function checkFirebase() {
    const key = "firebase";
    ensureSection(key, "Firebase");

    const fb = window.firebase;
    if (!fb) {
      log(
        key,
        "Firebase",
        "error",
        "Firebase NO está disponible en window.firebase.\nRevisa que firebase-app-compat.js se cargue antes de firebase-config.js."
      );
      setSectionBadge(key, "error");
      return;
    }

    log(key, "Firebase", "ok", "Firebase detectado ✅");

    try {
      const app = fb.apps && fb.apps[0];
      if (app) {
        log(key, "Firebase", "ok", `App Firebase inicializada: ${app.name}`);
        setSectionBadge(key, "ok");
      } else {
        log(
          key,
          "Firebase",
          "warn",
          "Firebase está cargado pero ninguna app fue inicializada. Revisa firebase-config.js."
        );
        setSectionBadge(key, "warn");
      }
    } catch (err) {
      log(key, "Firebase", "error", `Error al leer apps de Firebase: ${err.message}`);
      setSectionBadge(key, "error");
    }
  }

  async function checkPWA() {
    const key = "pwa";
    ensureSection(key, "PWA y Service Worker");

    // Service workers
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) {
          log(key, "PWA y Service Worker", "warn", "No hay ningún service worker registrado.");
        } else {
          regs.forEach((r) => {
            log(
              key,
              "PWA y Service Worker",
              "ok",
              `SW registrado: ${r.scope}`
            );
          });
        }
      } catch (err) {
        log(key, "PWA y Service Worker", "error", `No se pudieron leer los service workers: ${err.message}`);
      }
    }

    // Manifest + icons
    try {
      const res = await fetch("manifest.json", { cache: "no-cache" });
      if (!res.ok) {
        log(key, "PWA y Service Worker", "error", `No se pudo cargar manifest.json (${res.status}).`);
        setSectionBadge(key, "error");
      } else {
        const manifest = await res.json();
        log(
          key,
          "PWA y Service Worker",
          "ok",
          `Manifest cargado. Nombre: "${manifest.name || manifest.short_name || "sin nombre"}".`
        );

        if (Array.isArray(manifest.icons) && manifest.icons.length) {
          for (const icon of manifest.icons) {
            const src = icon.src;
            try {
              const iconRes = await fetch(src, { cache: "no-cache" });
              if (!iconRes.ok) {
                log(
                  key,
                  "PWA y Service Worker",
                  "error",
                  `Icono faltante o inválido: ${src} (status ${iconRes.status}).`
                );
              } else {
                log(key, "PWA y Service Worker", "ok", `Icono OK: ${src}`);
              }
            } catch (e) {
              log(key, "PWA y Service Worker", "error", `Error al comprobar icono ${src}: ${e.message}`);
            }
          }
        } else {
          log(key, "PWA y Service Worker", "warn", "El manifest no define íconos.");
        }
        setSectionBadge(key, "ok");
      }
    } catch (err) {
      log(key, "PWA y Service Worker", "error", `Error al cargar manifest.json: ${err.message}`);
      setSectionBadge(key, "error");
    }

    // Acciones de reparación
    addActionButton(key, "Limpiar caches PWA", async () => {
      if (!("caches" in window)) {
        log(key, "PWA y Service Worker", "warn", "API de caches no disponible.");
        return;
      }
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
      log(key, "PWA y Service Worker", "info", "Todas las caches han sido eliminadas. Recarga recomendada.");
    });

    addActionButton(key, "Desregistrar Service Workers", async () => {
      if (!("serviceWorker" in navigator)) {
        log(key, "PWA y Service Worker", "warn", "Service Workers no soportados.");
        return;
      }
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
      log(key, "PWA y Service Worker", "info", "Todos los Service Workers han sido desregistrados.");
    });
  }

  function checkDesignMode() {
    const key = "design";
    ensureSection(key, "Diseño y panel visual");

    const tokens = localStorage.getItem("jc_tokens");
    if (tokens) {
      log(key, "Diseño y panel visual", "ok", "Se encontraron tokens de diseño en localStorage (jc_tokens).");
    } else {
      log(
        key,
        "Diseño y panel visual",
        "warn",
        "No hay tokens jc_tokens en localStorage. El panel de diseño puede no haber guardado nada aún."
      );
    }

    const computed = getComputedStyle(document.documentElement);
    const brand = computed.getPropertyValue("--brand").trim();
    const accent = computed.getPropertyValue("--accent").trim();

    log(
      key,
      "Diseño y panel visual",
      brand ? "ok" : "warn",
      `--brand actual: ${brand || "(no definido)"}`
    );
    log(
      key,
      "Diseño y panel visual",
      accent ? "ok" : "warn",
      `--accent actual: ${accent || "(no definido)"}`
    );

    setSectionBadge(key, "ok");

    addActionButton(key, "Resetear diseño (jc_tokens)", () => {
      localStorage.removeItem("jc_tokens");
      log(key, "Diseño y panel visual", "info", "jc_tokens eliminado. Recarga para usar los valores por defecto.");
    });
  }

  function attachGlobalErrorListener() {
    const key = "errors";
    ensureSection(key, "Errores JS en tiempo real");

    window.addEventListener("error", (event) => {
      log(
        key,
        "Errores JS en tiempo real",
        "error",
        `Error: ${event.message} \nArchivo: ${event.filename}:${event.lineno}`
      );
      setSectionBadge(key, "error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      log(
        key,
        "Errores JS en tiempo real",
        "error",
        `Promesa no manejada: ${event.reason && event.reason.message ? event.reason.message : String(event.reason)}`
      );
      setSectionBadge(key, "error");
    });

    setSectionBadge(key, "ok");
  }

  async function runDiagnostics() {
    log("env", "Entorno y navegador", "info", "Iniciando diagnóstico…");
    await checkEnvironment();
    await checkSupabase();
    await checkFirebase();
    await checkPWA();
    checkDesignMode();
    attachGlobalErrorListener();
  }

  runDiagnostics();
})();