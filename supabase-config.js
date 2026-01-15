// supabase-config.js
// Requiere SDK cargado antes (index.html SIN defer):
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>

(() => {
  // ✅ Tu proyecto
  const SUPABASE_URL = "https://lwpdpheoomdszxcjqccy.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGRwaGVvb21kc3p4Y2pxY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzkyMTUsImV4cCI6MjA3MjI1NTIxNX0._6oEjUeSY95ZrRIRzmmfAqZw-X1C8-P2mWUEE4d5NcY";

  // Guards
  const SDK = window.supabase; // SDK v2 expuesto por el script tag
  if (!SDK || typeof SDK.createClient !== "function") {
    console.error("[Supabase] SDK no cargado. Revisa el script supabase-js@2 en index.html.");
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[Supabase] Falta SUPABASE_URL o SUPABASE_ANON_KEY.");
    return;
  }

  // Storage explícito (mejor consistencia web/PWA)
  // Nota: en algunos navegadores PWA, localStorage puede comportarse distinto.
  // Aun así, para Supabase v2 suele ser la opción más estable para persistencia.
  const AUTH_STORAGE_KEY = "jc_sb_auth_v2";
  const storage = {
    getItem: (key) => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key, value) => {
      try { window.localStorage.setItem(key, value); } catch {}
    },
    removeItem: (key) => {
      try { window.localStorage.removeItem(key); } catch {}
    }
  };

  // Cliente único (idempotente)
  if (!window.supabaseClient) {
    window.supabaseClient = SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // ✅ Para magic link + seguridad web moderna
        flowType: "pkce",

        // ✅ Captura sesión cuando llegas desde magic link/callback
        detectSessionInUrl: true,

        // ✅ Mantener sesión entre reinicios (web y PWA)
        persistSession: true,
        autoRefreshToken: true,

        // ✅ Más estable entre contextos
        storageKey: AUTH_STORAGE_KEY,
        storage
      }
    });
  }

  // Mantén SDK separado del cliente
  window.supabaseSDK = SDK;

  // Alias recomendado para toda la app:
  window.sb = window.supabaseClient;

  // Debug helper
  window.__JC_SUPABASE__ = {
    url: SUPABASE_URL,
    hasClient: !!window.supabaseClient,
    build: window.JC_BUILD || "(sin build)",
    storageKey: AUTH_STORAGE_KEY
  };

  if (!window.__JC_SUPABASE_LOGGED__) {
    window.__JC_SUPABASE_LOGGED__ = true;
    console.log("[Supabase] Cliente listo:", {
      hasClient: !!window.supabaseClient,
      build: window.JC_BUILD || "(sin build)",
      url: window.supabaseClient?.supabaseUrl
    });
  }
})();

// =====================
// SUPABASE SELF TEST (no invasivo)
// =====================
// Importante: NO depender de una tabla que tenga RLS estricto porque confunde el diagnóstico.
// Este self test solo verifica:
// 1) que existe el cliente
// 2) que auth.getSession() responde
window.jcSupabaseSelfTest = async function () {
  try {
    if (!window.supabaseSDK) {
      console.error("[JC] Supabase SDK no existe (window.supabaseSDK missing)");
      return { ok: false, step: "sdk" };
    }
    if (!window.sb) {
      console.error("[JC] Cliente sb no existe. Revisa supabase-config.js (createClient).");
      return { ok: false, step: "client" };
    }

    console.log("[JC] Supabase: probando auth.getSession()…");
    const s = await window.sb.auth.getSession();
    const has = !!s?.data?.session;
    console.log("[JC] Session:", has ? "OK (logueado)" : "No session");

    return { ok: true, step: "auth", session: has ? "yes" : "no" };
  } catch (e) {
    console.error("[JC] SelfTest crash:", e);
    return { ok: false, step: "crash", error: e };
  }
};

// Auto test (solo si estás en modo debug)
document.addEventListener("DOMContentLoaded", () => {
  // Si quieres apagarlo en prod, en config.js puedes poner window.JC_DEBUG=false
  const DEBUG = window.JC_DEBUG ?? true;
  if (!DEBUG) return;
  setTimeout(() => window.jcSupabaseSelfTest(), 800);
});