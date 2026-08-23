// supabase-config.js
// Requiere SDK cargado antes (index.html SIN defer):
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
//
// ✅ Cliente único e idempotente
// ✅ window.sb / window.supabaseClient
// ✅ window.JC.supabase (FIX CRÍTICO para Doctor/Repair y módulos)
// ✅ Storage robusto (fallback si localStorage falla)
// ✅ FLOW IMPLICIT (estable en GitHub Pages/PWA para magic links)
// ✅ detectSessionInUrl=true (captura tokens del link automáticamente)
// ✅ Self-test NO corre cuando vienes con ?code= o #access_token
//
// Notas:
// - Si vienes de PKCE -> implicit, usa jcSupabaseHardResetAuth() una vez y recarga.

(() => {
  "use strict";

  const SUPABASE_URL = "https://lwpdpheoomdszxcjqccy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGRwaGVvb21kc3p4Y2pxY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzkyMTUsImV4cCI6MjA3MjI1NTIxNX0._6oEjUeSY95ZrRIRzmmfAqZw-X1C8-P2mWUEE4d5NcY";

  const SDK = window.supabase;
  if (!SDK || typeof SDK.createClient !== "function") {
    console.error("[Supabase] SDK no cargado. Revisa supabase-js@2 en index.html.");
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[Supabase] Falta SUPABASE_URL o SUPABASE_ANON_KEY.");
    return;
  }

  // ============================================================
  // Storage robusto (PWA / privado / errores de quota)
  // ============================================================
  const AUTH_STORAGE_KEY = "jc_sb_auth_v2";

  function hasLocalStorage() {
    try {
      const k = "__jc_ls_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  const memStore = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  })();

  const canUseLS = hasLocalStorage();
  const storage =
    canUseLS
      ? {
          getItem: (key) => {
            try { return window.localStorage.getItem(key); } catch { return null; }
          },
          setItem: (key, value) => {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {
              try { memStore.setItem(key, value); } catch {}
              console.warn("[Supabase] localStorage setItem falló:", e?.name || e);
            }
          },
          removeItem: (key) => {
            try { window.localStorage.removeItem(key); }
            catch { try { memStore.removeItem(key); } catch {} }
          },
        }
      : memStore;

  // ============================================================
  // Cliente único (idempotente)
  // ============================================================
  if (!window.supabaseClient) {
    window.supabaseClient = SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // ✅ IMPLICIT para magic link estable
        flowType: "implicit",
        detectSessionInUrl: true,

        persistSession: true,
        autoRefreshToken: true,

        storageKey: AUTH_STORAGE_KEY,
        storage,
      },
    });
  }

  // Aliases comunes
  window.sb = window.supabaseClient;
  window.supabaseSDK = SDK;

  // ✅ FIX CRÍTICO: expone el cliente donde tus módulos/Doctor lo esperan
  window.JC = window.JC || {};
  window.JC.supabase = window.supabaseClient;

  // Metadata útil de debug
  window.__JC_SUPABASE__ = {
    url: SUPABASE_URL,
    hasClient: !!window.supabaseClient,
    build: window.JC_BUILD || "(sin build)",
    storageKey: AUTH_STORAGE_KEY,
    storageType: storage === memStore ? "memory" : "localStorage",
    flowType: "implicit",
  };

  if (!window.__JC_SUPABASE_LOGGED__) {
    window.__JC_SUPABASE_LOGGED__ = true;
    console.log("[Supabase] Cliente listo:", {
      hasClient: !!window.supabaseClient,
      build: window.JC_BUILD || "(sin build)",
      url: window.supabaseClient?.supabaseUrl,
      storage: window.__JC_SUPABASE__?.storageType,
      flowType: window.__JC_SUPABASE__?.flowType,
    });
  }

  // Helper para reset (útil cuando cambiaste de PKCE -> implicit)
  window.jcSupabaseHardResetAuth = async function () {
    try { await window.sb?.auth?.signOut?.(); } catch {}
    try { window.localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}

    // Limpieza conservadora (NO borra a ciegas)
    try {
      const ls = window.localStorage;
      if (ls) {
        Object.keys(ls).forEach((k) => {
          // Solo candidatos claros, pero por defecto NO borramos automáticamente
          if (
            k.includes("supabase") ||
            k.includes("sb-") ||
            k.includes("pkce") ||
            k.includes("code-verifier")
          ) {
            // Si algún día quieres borrar, descomenta:
            // ls.removeItem(k);
          }
        });
      }
    } catch {}

    console.log("[JC] Supabase auth reset OK. Recarga la página.");
    return true;
  };
})();

// =====================
// SUPABASE SELF TEST (no invasivo)
// =====================
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

    // Preferimos JC.supabase si existe
    const client = window.JC?.supabase || window.sb;

    console.log("[JC] Supabase: probando auth.getSession()…");
    const s = await client.auth.getSession();
    const has = !!s?.data?.session;
    console.log("[JC] Session:", has ? "OK (logueado)" : "No session");
    return { ok: true, step: "auth", session: has ? "yes" : "no" };
  } catch (e) {
    console.error("[JC] SelfTest crash:", e);
    return { ok: false, step: "crash", error: String(e?.message || e) };
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG = window.JC_DEBUG ?? true;
  if (!DEBUG) return;

  setTimeout(() => {
    try {
      const u = new URL(location.href);
      // No interferir con callbacks
      if (u.searchParams.get("code")) return;
      if ((location.hash || "").includes("access_token")) return;
      window.jcSupabaseSelfTest();
    } catch {}
  }, 800);
});