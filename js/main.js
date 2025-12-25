// js/main.js
(function () {
  // Asegura namespace global
  const JC = (window.JC = window.JC || {});
  JC.build = window.JC_BUILD || JC.build || "dev";

  // Logger seguro
  JC.log =
    JC.log ||
    function (...args) {
      console.log("[JC]", ...args);
    };

  // Helper: inicializa un módulo sin tumbar toda la app si falla
  async function safeInit(label, fn) {
    try {
      if (typeof fn === "function") {
        await fn();
        JC.log(`${label}: OK`);
      } else {
        JC.log(`${label}: skip (no definido)`);
      }
    } catch (e) {
      console.error(`[JC] ${label}: ERROR`, e);
      // No re-throw: seguimos con el resto para que la app no muera por un solo módulo
    }
  }

  async function init() {
    // 1) UI primero (drawer/tabs/wrappers)
    await safeInit("ui.init", () => JC.ui?.init?.());

    // 2) Auth y Perfil (bloqueantes para gates)
    await safeInit("auth.init", () => JC.auth?.init?.());
    await safeInit("profile.init", () => JC.profile?.init?.());

    // 3) Resto de módulos (no deberían romper el arranque)
    await safeInit("bots.init", () => JC.bots?.init?.());
    await safeInit("events.init", () => JC.events?.init?.());
    await safeInit("resources.init", () => JC.resources?.init?.());
    await safeInit("community.init", () => JC.community?.init?.());

    JC.log("Init OK", JC.build);
  }

  // Arranque robusto (por si algo quita defer o carga raro)
  function boot() {
    init().catch((e) => console.error("[JC] init error", e));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
