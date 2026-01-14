// supabase-config.js
// Requiere que el SDK ya esté cargado antes (en index.html SIN defer):
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>

(() => {
  // ✅ Tu proyecto
  const SUPABASE_URL = "https://lwpdpheoomdszxcjqccy.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGRwaGVvb21kc3p4Y2pxY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzkyMTUsImV4cCI6MjA3MjI1NTIxNX0._6oEjUeSY95ZrRIRzmmfAqZw-X1C8-P2mWUEE4d5NcY";

  // 🔒 Guardas básicas
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error(
      "[Supabase] SDK no cargado. Revisa el <script src='...supabase-js@2'></script> en index.html"
    );
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[Supabase] Falta SUPABASE_URL o SUPABASE_ANON_KEY.");
    return;
  }

  // ✅ Cliente único (evita re-crearlo si recargas scripts por error)
  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          // Importante para Magic Link / OAuth redirect
          detectSessionInUrl: true,

          // PWA / recargas
          persistSession: true,
          autoRefreshToken: true,

          // Si tienes problemas con "sesión fantasma" puedes probar "localStorage"
          // storage: window.localStorage,
        },
        // Si usas Edge Functions, puedes activar fetch custom, etc. (no necesario ahora)
      }
    );
  }

 // guarda SDK por si algún módulo lo necesita
window.supabaseSDK = window.supabase;

// alias “supabase” al cliente (para código antiguo: supabase.auth..., supabase.from...)
window.supabase = window.supabaseClient;

// alias corto
window.sb = window.supabaseClient;

  // ✅ Helpers (opcionales, útiles para depurar)
  window.__JC_SUPABASE__ = {
    url: SUPABASE_URL,
    hasClient: !!window.supabaseClient,
  };

  // Log suave (solo una vez)
  if (!window.__JC_SUPABASE_LOGGED__) {
    window.__JC_SUPABASE_LOGGED__ = true;
    console.log("[Supabase] Cliente listo:", {
      hasClient: !!window.supabaseClient,
      build: window.JC_BUILD || "(sin build)",
    });
  }
})();

console.log("[JC] supabase client url:", window.supabaseClient?.supabaseUrl);
console.log("[JC] supabase is client?", !!window.supabase?.from);