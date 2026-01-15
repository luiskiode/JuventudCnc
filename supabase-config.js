// supabase-config.js
// Requiere SDK cargado antes (index.html SIN defer):
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>

(() => {
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

  // Cliente único (idempotente)
  if (!window.supabaseClient) {
    window.supabaseClient = SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        // storage: window.localStorage, // si alguna vez quieres forzar storage
      },
    });
  }

  // ✅ Mantén SDK separado del cliente
  window.supabaseSDK = SDK;

  // ✅ Alias recomendado para toda la app:
  window.sb = window.supabaseClient;

  // Debug helper
  window.__JC_SUPABASE__ = {
    url: SUPABASE_URL,
    hasClient: !!window.supabaseClient,
  };

  if (!window.__JC_SUPABASE_LOGGED__) {
    window.__JC_SUPABASE_LOGGED__ = true;
    console.log("[Supabase] Cliente listo:", {
      hasClient: !!window.supabaseClient,
      build: window.JC_BUILD || "(sin build)",
      url: window.supabaseClient?.supabaseUrl,
    });
  }
})();

// =====================
// SUPABASE SELF TEST
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

    console.log("[JC] Supabase: probando auth.getSession()…");
    const s = await window.sb.auth.getSession();
    console.log("[JC] Session:", s?.data?.session ? "OK (logueado)" : "No session");

    // ⚠️ Cambia "events" por tu tabla real si se llama distinto
    const table = "events";

    console.log(`[JC] Supabase: probando select en "${table}"…`);
    const q = await window.sb.from(table).select("*").limit(1);

    if (q.error) {
      console.warn("[JC] Select error:", q.error.message, q.error);
      return { ok: false, step: "select", error: q.error };
    }

    console.log("[JC] Select OK:", q.data);
    return { ok: true, step: "done", data: q.data };
  } catch (e) {
    console.error("[JC] SelfTest crash:", e);
    return { ok: false, step: "crash", error: e };
  }
};

// Auto test (opcional)
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => window.jcSupabaseSelfTest(), 800);
});