/* js/jc-doctor.js
   Juventud CNC — Doctor (verifica/analiza/diagnostica)
   ✅ No rompe la app si algo falta
   ✅ Genera reporte + overlay opcional (por defecto: OFF / silencioso)
   ✅ Trabaja “detrás de todo”: no inyecta UI a menos que lo pidas
*/
(() => {
  "use strict";

  const BUILD = String(window.JC_BUILD || window.__JC_BUILD || "unknown");
  const START_TS = Date.now();

  // ------------------------------------------------------------
  // Config de ejecución
  // - Por defecto: silencioso (sin overlay)
  // - Puedes forzar overlay así en index ANTES de cargar jc-doctor.js:
  //   <script>window.JC_DOCTOR_OVERLAY = true;</script>
  // - O silenciar explícito:
  //   <script>window.JC_DOCTOR_SILENT = true;</script>
  // ------------------------------------------------------------
  const WANT_OVERLAY =
    window.JC_DOCTOR_OVERLAY === true && window.JC_DOCTOR_SILENT !== true;

  const Doctor = {
    build: BUILD,
    startedAt: new Date().toISOString(),
    checks: [],
    errors: [],
    warnings: [],
    notes: [],
    stats: {
      jsErrors: 0,
      unhandledRejections: 0,
      duplicateInits: 0,
    },
    config: {
      overlay: WANT_OVERLAY, // ✅ por defecto OFF
      assetTimeoutMs: 2500,
      supabaseTimeoutMs: 3500,
      domReadyTimeoutMs: 6000,
      logPrefix: "[JC][Doctor]",

      // IDs que realmente deben existir según tu index actual
      requiredDomIds: [
        // Layout / shell
        "drawer",
        "closeDrawer",
        "overlay",
        "openDrawer",

        // Topbar
        "btnBots",
        "btnLogin",
        "btnPerfil",

        // Floats + fondo
        "jcFloatLayer",
        "jcAppBgLayer",
        "jcAppBgOverlay",

        // Chat (vive dentro de la vista box)
        "jcChat",
        "jcChatBody",
        "jcChatToggle",

        // Widgets bots
        "angieWidget",
        "angieAvatarImg",
        "angieText",
        "miaWidget",
        "miaAvatarImg",
        "miaText",
        "ciroWidget",
        "ciroAvatarImg",
        "ciroText",
        "almaWidget",
        "almaAvatarImg",
        "almaText",

        // Comunidad
        "comuGate",
        "comuList",
        "comuComposer",
        "btnComuRefresh",

        // Miembros
        "miembrosList",
        "btnMiembrosRefresh",

        // Perfil
        "btnPerfilRefresh",
      ],

      requiredGlobals: [
        "JC",
      ],
    },
  };

  function log(...a) { console.log(Doctor.config.logPrefix, ...a); }
  function warn(...a) { console.warn(Doctor.config.logPrefix, ...a); }
  function err(...a) { console.error(Doctor.config.logPrefix, ...a); }

  // ----------------------------
  // Captura errores globales
  // ----------------------------
  window.addEventListener("error", (e) => {
    Doctor.stats.jsErrors++;
    Doctor.errors.push({
      type: "error",
      message: e?.message || "Unknown error",
      filename: e?.filename,
      lineno: e?.lineno,
      colno: e?.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    Doctor.stats.unhandledRejections++;
    Doctor.errors.push({
      type: "unhandledrejection",
      message: (e?.reason && (e.reason.message || String(e.reason))) || "Unknown rejection",
    });
  });

  // ----------------------------
  // Overlay UI (OPCIONAL)
  // ----------------------------
  let overlayEl = null;

  function ensureOverlay() {
    if (!Doctor.config.overlay) return;
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "jcDoctorOverlay";
    overlayEl.style.cssText = [
      "position:fixed",
      "right:12px",
      "bottom:12px",
      "z-index:1",            // ✅ “detrás”: no invade UI (y encima no se muestra si overlay=false)
      "width:min(420px, calc(100vw - 24px))",
      "max-height:55vh",
      "overflow:auto",
      "padding:10px 12px",
      "border-radius:14px",
      "background:rgba(10,12,20,.92)",
      "color:#e5e7eb",
      "font:12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial",
      "box-shadow:0 10px 30px rgba(0,0,0,.35)",
      "backdrop-filter: blur(8px)",
      "pointer-events:auto",
    ].join(";");

    overlayEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <div>
          <div style="font-weight:700;">Juventud CNC — Doctor</div>
          <div style="opacity:.8;">Build: <span id="jcDocBuild"></span></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="jcDocBtnCopy" style="all:unset;cursor:pointer;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.10)">Copiar</button>
          <button id="jcDocBtnHide" style="all:unset;cursor:pointer;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.10)">Ocultar</button>
        </div>
      </div>
      <div id="jcDocStatus" style="margin-top:8px;opacity:.95"></div>
      <pre id="jcDocPre" style="margin:10px 0 0;white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.06);padding:8px;border-radius:12px;"></pre>
    `;

    document.documentElement.appendChild(overlayEl);
    overlayEl.querySelector("#jcDocBuild").textContent = Doctor.build;

    overlayEl.querySelector("#jcDocBtnHide").onclick = () => {
      overlayEl.style.display = "none";
    };

    overlayEl.querySelector("#jcDocBtnCopy").onclick = async () => {
      try {
        const txt = JSON.stringify(Doctor.report(), null, 2);
        await navigator.clipboard.writeText(txt);
        toast("Reporte copiado ✅");
      } catch {
        toast("No se pudo copiar ❌");
      }
    };
  }

  function toast(msg) {
    if (!overlayEl) return;
    const s = overlayEl.querySelector("#jcDocStatus");
    if (!s) return;
    s.textContent = msg;
    setTimeout(() => { if (s.textContent === msg) s.textContent = ""; }, 1600);
  }

  function renderOverlay() {
    if (!overlayEl) return;
    const pre = overlayEl.querySelector("#jcDocPre");
    if (!pre) return;
    pre.textContent = JSON.stringify(Doctor.report(), null, 2);
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  function addCheck(name, ok, detail, level = "info") {
    Doctor.checks.push({ name, ok: !!ok, level, detail: detail ?? null });
    if (!ok && level === "warn") Doctor.warnings.push({ name, detail });
    if (!ok && level === "error") Doctor.errors.push({ type: "check", name, detail });
  }

  function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`Timeout (${ms}ms) ${label || ""}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  async function pingAsset(url, timeoutMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
      clearTimeout(t);
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: String(e?.message || e) };
    }
  }

  function domHasId(id) { return !!document.getElementById(id); }

  function getSupabaseClient() {
    // Tu app suele exponer sb / supabaseClient
    const sb = window.sb || window.supabaseClient || window.JC?.supabase || null;
    return sb || null;
  }

  // ----------------------------
  // Checks principales
  // ----------------------------
  async function runChecks() {
    // ✅ Overlay solo si lo pides explícitamente
    ensureOverlay();

    // Build / versión
    addCheck("BUILD definido", Doctor.build !== "unknown", Doctor.build, Doctor.build !== "unknown" ? "info" : "warn");

    // DOM ready (por si hay carga lenta)
    const domReady =
      (document.readyState === "interactive" || document.readyState === "complete")
        ? Promise.resolve(true)
        : new Promise((res) => document.addEventListener("DOMContentLoaded", () => res(true), { once: true }));

    try {
      await withTimeout(domReady, Doctor.config.domReadyTimeoutMs, "DOM Ready");
      addCheck("DOM Ready", true, document.readyState);
    } catch (e) {
      addCheck("DOM Ready", false, String(e?.message || e), "error");
    }

    // Globals
    for (const g of Doctor.config.requiredGlobals) {
      addCheck(`Global window.${g}`, typeof window[g] !== "undefined", typeof window[g]);
    }

    // DOM IDs críticos
    for (const id of Doctor.config.requiredDomIds) {
      const ok = domHasId(id);
      addCheck(`DOM #${id}`, ok, ok ? "OK" : "No existe", ok ? "info" : "warn");
    }

    // Duplicidad de init (banderas comunes)
    const flags = ["__JC_MAIN_INIT_DONE", "__JC_BOTS_INIT_DONE", "__JC_INIT_DONE", "__JC_APP_INIT"];
    let found = 0;
    for (const f of flags) if (window[f]) found++;
    if (found >= 2) {
      Doctor.stats.duplicateInits++;
      addCheck("Posible doble init (flags)", false, flags.filter((f) => window[f]), "warn");
    } else {
      addCheck("Doble init (flags)", true, "No evidente");
    }

    // Supabase
    const sb = getSupabaseClient();
    addCheck("Supabase client detectado", !!sb, sb ? "OK" : "No encontrado", sb ? "info" : "warn");

    if (sb?.auth?.getSession) {
      try {
        const r = await withTimeout(sb.auth.getSession(), Doctor.config.supabaseTimeoutMs, "supabase.getSession");
        const hasSession = !!r?.data?.session;
        addCheck("Supabase getSession()", true, { hasSession });
      } catch (e) {
        addCheck("Supabase getSession()", false, String(e?.message || e), "warn");
      }
    }

    // Service Worker
    const sw = ("serviceWorker" in navigator);
    addCheck("Service Worker soportado", sw, sw ? "Sí" : "No");
    if (sw) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        addCheck("Service Worker registrado", !!reg, reg ? "Sí" : "No", reg ? "info" : "warn");
      } catch (e) {
        addCheck("Service Worker getRegistration()", false, String(e?.message || e), "warn");
      }
    }

    // Assets “canary” (rutas reales según tu index)
    const canaryAssets = [
      "assets/angie-sonrisa-saludo.png",
      "assets/mia-casual-wink.png",
      "assets/ciro-happy.png",
      "assets/alma-agradecida.png",
      "manifest.json",
    ];
    for (const url of canaryAssets) {
      const r = await pingAsset(url, Doctor.config.assetTimeoutMs);
      addCheck(`Asset ${url}`, r.ok, r, r.ok ? "info" : "warn");
    }

    Doctor.notes.push({
      msSinceStart: Date.now() - START_TS,
      userAgent: navigator.userAgent,
      readyState: document.readyState,
    });

    renderOverlay();
    log("Reporte listo", Doctor.report());
    return Doctor.report();
  }

  Doctor.report = () => ({
    build: Doctor.build,
    startedAt: Doctor.startedAt,
    now: new Date().toISOString(),
    stats: Doctor.stats,
    checks: Doctor.checks,
    warnings: Doctor.warnings,
    errors: Doctor.errors,
    notes: Doctor.notes,
  });

  Doctor.run = runChecks;

  // Exponer
  window.JC_DOCTOR = Doctor;

  // Ejecutar automático
  runChecks().catch((e) => err("Doctor failed:", e));
})();