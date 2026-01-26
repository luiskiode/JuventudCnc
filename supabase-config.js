// supabase-config.js
// Requiere SDK cargado antes (index.html SIN defer):
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
//
// ✅ FIXES aplicados según errores típicos que vimos:
// - Cliente único e idempotente (no se recrea ni se pisa)
// - Alias consistentes: window.sb, window.supabaseClient
// - Storage robusto (fallback si localStorage falla en PWA / modo privado)
// - Hook de debug + self-test no invasivo
// - NO asume tablas (evita confusión con RLS)
// - Logs limpios (solo una vez)

(() => {
  "use strict";

  // ✅ Tu proyecto
  const SUPABASE_URL = "https://lwpdpheoomdszxcjqccy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGRwaGVvb21kc3p4Y2pxY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzkyMTUsImV4cCI6MjA3MjI1NTIxNX0._6oEjUeSY95ZrRIRzmmfAqZw-X1C8-P2mWUEE4d5NcY";

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

  // Fallback in-memory (si localStorage está bloqueado)
  const memStore = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  })();

  const storage = hasLocalStorage()
    ? {
        getItem: (key) => {
          try {
            return window.localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            window.localStorage.setItem(key, value);
          } catch (e) {
            // Si falla por quota / privado, caemos a memory (no reventar)
            try {
              memStore.setItem(key, value);
            } catch {}
            console.warn("[Supabase] localStorage setItem falló:", e?.name || e);
          }
        },
        removeItem: (key) => {
          try {
            window.localStorage.removeItem(key);
          } catch {
            try {
              memStore.removeItem(key);
            } catch {}
          }
        }
      }
    : memStore;

  // ============================================================
  // Cliente único (idempotente)
  // ============================================================
  if (!window.supabaseClient) {
    window.supabaseClient = SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // ✅ Magic link + navegación moderna
        flowType: "pkce",
        detectSessionInUrl: true,

        // ✅ Persistencia entre reinicios (si storage lo permite)
        persistSession: true,
        autoRefreshToken: true,

        // ✅ Estabilidad
        storageKey: AUTH_STORAGE_KEY,
        storage
      }
    });
  }

  // Alias recomendado para toda la app
  window.sb = window.supabaseClient;

  // Mantén SDK separado del cliente (útil para debug)
  window.supabaseSDK = SDK;

  // Debug helper
  window.__JC_SUPABASE__ = {
    url: SUPABASE_URL,
    hasClient: !!window.supabaseClient,
    build: window.JC_BUILD || "(sin build)",
    storageKey: AUTH_STORAGE_KEY,
    storageType: storage === memStore ? "memory" : "localStorage"
  };

  // Log una sola vez
  if (!window.__JC_SUPABASE_LOGGED__) {
    window.__JC_SUPABASE_LOGGED__ = true;
    console.log("[Supabase] Cliente listo:", {
      hasClient: !!window.supabaseClient,
      build: window.JC_BUILD || "(sin build)",
      url: window.supabaseClient?.supabaseUrl,
      storage: window.__JC_SUPABASE__?.storageType
    });
  }
})();

// =====================
// SUPABASE SELF TEST (no invasivo)
// =====================
// Importante: NO depender de tablas (RLS confunde).
// Verifica únicamente:
// 1) SDK presente
// 2) Cliente presente
// 3) auth.getSession responde
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
    return { ok: false, step: "crash", error: String(e?.message || e) };
  }
};

// Auto test (solo si estás en modo debug)
document.addEventListener("DOMContentLoaded", () => {
  // Si quieres apagarlo en prod, en config.js pon window.JC_DEBUG=false
  const DEBUG = window.JC_DEBUG ?? true;
  if (!DEBUG) return;
  setTimeout(() => window.jcSupabaseSelfTest(), 800);
});