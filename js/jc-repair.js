/* js/jc-repair.js
   Juventud CNC — Repair (repara y estabiliza automáticamente)
   Reparaciones seguras:
   - Guard anti doble init para init comunes
   - Hook a console para detectar doble carga
   - Wrapper de Supabase getSession con timeout + logs
   - Reintento suave de init (main/bots) si existen
   - Limpieza de localStorage corrupto (solo si es inválido)
*/
(() => {
  "use strict";

  const PREFIX = "[JC][Repair]";
  const BUILD = (window.JC_BUILD || "unknown") + "";

  const Repair = {
    build: BUILD,
    appliedAt: new Date().toISOString(),
    patches: [],
    warnings: [],
    errors: [],
    config: {
      supabaseTimeoutMs: 3500,
      retryInitMax: 3,
      retryInitDelayMs: 450,
      enableConsoleHook: true,
      enableInitGuards: true,
      enableLocalStorageFix: true,
    },
  };

  function log(...a) { console.log(PREFIX, ...a); }
  function warn(...a) { console.warn(PREFIX, ...a); }
  function err(...a) { console.error(PREFIX, ...a); }

  function patch(name, ok, detail) {
    Repair.patches.push({ name, ok: !!ok, detail: detail ?? null });
    if (!ok) Repair.warnings.push({ name, detail });
  }

  function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`Timeout (${ms}ms) ${label || ""}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  // ----------------------------
  // 1) Console hook (para detectar dobles init y duplicaciones)
  // ----------------------------
  function applyConsoleHook() {
    if (!Repair.config.enableConsoleHook) return patch("console hook", true, "disabled");
    if (window.__JC_CONSOLE_HOOKED) return patch("console hook", true, "already");

    window.__JC_CONSOLE_HOOKED = true;

    const origLog = console.log.bind(console);
    console.log = (...args) => {
      try {
        // detecta patrones típicos
        const s = args.map(a => (typeof a === "string" ? a : "")).join(" ");
        if (s.includes("bots.js init OK")) {
          window.__JC_BOTS_INIT_OK_COUNT = (window.__JC_BOTS_INIT_OK_COUNT || 0) + 1;
          if (window.__JC_BOTS_INIT_OK_COUNT > 1) {
            warn("Detectado bots init OK duplicado:", window.__JC_BOTS_INIT_OK_COUNT);
          }
        }
      } catch {}
      origLog(...args);
    };

    patch("console hook", true, "installed");
  }

  // ----------------------------
  // 2) Init guards globales (evita doble init)
  // ----------------------------
  function applyInitGuards() {
    if (!Repair.config.enableInitGuards) return patch("init guards", true, "disabled");

    // Guard genérico para que lo uses desde cualquier módulo:
    if (!window.JC_GUARD_ONCE) {
      window.JC_GUARD_ONCE = (key, fn) => {
        const k = "__JC_GUARD_" + key;
        if (window[k]) return { ran: false, reason: "blocked", key };
        window[k] = true;
        try {
          const r = fn?.();
          return { ran: true, key, result: r };
        } catch (e) {
          return { ran: true, key, error: String(e?.message || e) };
        }
      };
      patch("JC_GUARD_ONCE", true, "created");
    } else {
      patch("JC_GUARD_ONCE", true, "exists");
    }

    // Flags principales (compat con tus logs)
    window.__JC_MAIN_INIT_DONE = window.__JC_MAIN_INIT_DONE || false;
    window.__JC_BOTS_INIT_DONE = window.__JC_BOTS_INIT_DONE || false;

    patch("init flags", true, { main: window.__JC_MAIN_INIT_DONE, bots: window.__JC_BOTS_INIT_DONE });
  }

  // ----------------------------
  // 3) Supabase getSession wrapper con timeout + logs
  // ----------------------------
  function applySupabasePatch() {
    const sb = window?.JC?.supabase;
    if (!sb?.auth?.getSession) return patch("supabase getSession patch", false, "JC.supabase.auth.getSession no disponible");

    if (sb.auth.__jc_getSession_patched) return patch("supabase getSession patch", true, "already");

    const orig = sb.auth.getSession.bind(sb.auth);

    sb.auth.getSession = async (...args) => {
      try {
        const p = orig(...args);
        const r = await withTimeout(p, Repair.config.supabaseTimeoutMs, "supabase.getSession");
        const hasSession = !!r?.data?.session;
        console.log("[JC] getSession result:", { hasSession, build: BUILD });
        return r;
      } catch (e) {
        console.warn("[JC] getSession failed:", String(e?.message || e));
        throw e;
      }
    };

    sb.auth.__jc_getSession_patched = true;
    patch("supabase getSession patch", true, { timeoutMs: Repair.config.supabaseTimeoutMs });
  }

  // ----------------------------
  // 4) LocalStorage: limpia SOLO si detecta corrupción
  // ----------------------------
  function applyLocalStorageFix() {
    if (!Repair.config.enableLocalStorageFix) return patch("localStorage fix", true, "disabled");

    const keysToValidate = [
      "jc_bg_main_dataurl",
      "jc_theme",
      "jc_user_profile",
    ];

    let fixed = 0;

    for (const k of keysToValidate) {
      const v = localStorage.getItem(k);
      if (v == null) continue;

      // regla: si debería ser JSON pero no lo es, lo limpiamos
      if (k.includes("profile") || k.includes("theme")) {
        if (typeof v === "string") {
          const looksJson = v.trim().startsWith("{") || v.trim().startsWith("[");
          if (looksJson) {
            try { JSON.parse(v); }
            catch {
              localStorage.removeItem(k);
              fixed++;
              warn("LocalStorage corrupto removido:", k);
            }
          }
        }
      }

      // regla: dataURL muy corto o roto (background)
      if (k.includes("bg") && typeof v === "string") {
        const ok = v.startsWith("data:image/") && v.length > 200;
        if (!ok) {
          localStorage.removeItem(k);
          fixed++;
          warn("Background dataurl inválido removido:", k);
        }
      }
    }

    patch("localStorage fix", true, { fixed });
  }

  // ----------------------------
  // 5) Reintento suave de inits si existen
  // ----------------------------
  async function retryInit() {
    const tries = Repair.config.retryInitMax;
    const delay = Repair.config.retryInitDelayMs;

    const tryRun = async (label, fn, flagName) => {
      if (typeof fn !== "function") return;
      if (window[flagName]) return;

      for (let i = 1; i <= tries; i++) {
        try {
          const r = fn();
          window[flagName] = true;
          patch(`retry init ${label}`, true, { attempt: i });
          return r;
        } catch (e) {
          warn(`${label} init falló intento ${i}/${tries}:`, e);
          await new Promise(res => setTimeout(res, delay * i));
        }
      }
      patch(`retry init ${label}`, false, `no se pudo iniciar tras ${tries} intentos`);
    };

    // intenta bots init si existe (varios nombres posibles)
    const botsInit = window?.JC?.bots?.init || window?.JC?.initBots || window?.initBots;
    await tryRun("bots", botsInit, "__JC_BOTS_INIT_DONE");

    // intenta main init si existe
    const mainInit = window?.JC?.init || window?.JC?.mainInit || window?.initApp;
    await tryRun("main", mainInit, "__JC_MAIN_INIT_DONE");
  }

  Repair.report = () => ({
    build: Repair.build,
    appliedAt: Repair.appliedAt,
    patches: Repair.patches,
    warnings: Repair.warnings,
    errors: Repair.errors,
  });

  async function applyAll() {
    try {
      applyConsoleHook();
      applyInitGuards();
      applySupabasePatch();
      applyLocalStorageFix();
      await retryInit();
      log("Repair aplicado ✅", Repair.report());
    } catch (e) {
      Repair.errors.push(String(e?.message || e));
      err("Repair falló:", e);
    }

    window.JC_REPAIR = Repair;
  }

  applyAll();
})();