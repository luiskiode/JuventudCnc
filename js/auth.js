/* ============================================================
   auth.js — login modal + ensure anon + auth state change (UNA VEZ)
   (robusto para carga por módulos + evita doble bind + no revienta si falta algo)
   ============================================================ */
(function () {
  "use strict";

  // 1) Namespace
  const JC = (window.JC = window.JC || {});

  // 2) Supabase client (tu proyecto usa window.supabaseClient)
  const sb = window.supabaseClient;
  if (!sb || !sb.auth) {
    console.warn("[JC] supabaseClient no disponible en auth.js");
    JC.auth = JC.auth || { init: async () => {} };
    return;
  }

  // 3) Estado overlay (viene de ui.js)
  const state = window.jcState || window.JC?.uiState || { loginOpen: false };
  const syncOverlay = window.jcSyncOverlay || (() => {});

  // ============================================================
  // ensure anon session (si tu proyecto lo usa)
  // ============================================================
  async function jcEnsureAnonSession() {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user?.id) return data.session.user.id;

      if (typeof sb.auth.signInAnonymously === "function") {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw error;
        const { data: d2 } = await sb.auth.getSession();
        return d2?.session?.user?.id || null;
      }

      // Si no existe signInAnonymously, simplemente no forzamos nada.
      return null;
    } catch (e) {
      console.warn("[JC] Anon session error:", e);
      return null;
    }
  }
  window.jcEnsureAnonSession = jcEnsureAnonSession;

  // ============================================================
  // Login Modal
  // ============================================================
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
    // pequeño delay para asegurar focus en móviles
    setTimeout(() => loginEmail?.focus(), 30);
  }

  function closeLoginModal() {
    if (!loginModal) return;
    state.loginOpen = false;
    loginModal.classList.remove("show");
    loginModal.style.display = "none";
    syncOverlay();
    if (loginEstado) loginEstado.textContent = "";
  }

  window.jcOpenLoginModal = openLoginModal;
  window.jcCloseLoginModal = closeLoginModal;

  btnLogin?.addEventListener("click", openLoginModal);
  loginClose?.addEventListener("click", closeLoginModal);
  loginModal?.addEventListener("click", (e) => {
    if (e.target === loginModal) closeLoginModal();
  });

  async function sendMagicLink(email) {
    if (!sb?.auth?.signInWithOtp) throw new Error("Auth no disponible (signInWithOtp).");

    const origin = location.origin;
    const path = location.pathname;

    // Mantén tu #perfil y además agrega build para evitar cache raro si lo usas
    const redirectTo = `${origin}${path}#perfil`;

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) throw error;
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (loginEmail?.value || "").trim().toLowerCase();
    if (!email) {
      if (loginEstado) loginEstado.textContent = "Escribe tu correo primero.";
      return;
    }

    if (loginEstado) loginEstado.textContent = "Enviando enlace…";

    try {
      await sendMagicLink(email);
      if (loginEstado) loginEstado.textContent = "✅ Listo. Revisa tu correo y abre el enlace.";
      window.angieSetEstado?.("ok");
    } catch (err) {
      console.error("[JC] Login error:", err);
      if (loginEstado) loginEstado.textContent = `Error: ${err?.message || "no se pudo enviar"}`;
      window.angieSetEstado?.("confundida");
    }
  });

  // ============================================================
  // Auth state global (UNA VEZ por página)
  // ============================================================
  if (!window.__JC_AUTH_BOUND__ && typeof sb.auth.onAuthStateChange === "function") {
    window.__JC_AUTH_BOUND__ = true;

    window.currentUser = null;

    sb.auth.onAuthStateChange(async (_event, session) => {
      try {
        window.currentUser = session?.user ?? null;

        // Si tienes “gates” por módulos, refrescarlos sin romper si no existen
        try {
          await window.cargarPerfil?.();
        } catch {}

        try {
          await window.jcComunidad?.refreshAuthAndMiembro?.();
        } catch {}

        try {
          await window.jcJudart?.refreshAuthAndMiembro?.();
        } catch {}

        try {
          await window.jcEventos?.refreshAuth?.();
        } catch {}

        // Si estás en Comunidad, refresca feed (pero sin depender de normalizeTab)
        try {
          const tab = (location.hash || "#inicio").replace("#", "").trim();
          if (tab === "comunidad") await window.jcComunidad?.cargarFeed?.({ force: true });
        } catch {}
      } catch (e) {
        console.error("[JC] onAuthStateChange error:", e);
      }
    });
  }

  // ============================================================
  // JC.auth public API (para que main.js pueda await JC.auth.init())
  // ============================================================
  async function init() {
    // Opcional: asegura sesión anónima si tu app lo requiere para RLS/lectura pública
    // (si no lo necesitas, no hace daño porque retorna null)
    await jcEnsureAnonSession();

    // Si ya hay sesión, cierra el modal para evitar que quede abierto
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) closeLoginModal();
    } catch {}

    return true;
  }

  JC.auth = JC.auth || {};
  JC.auth.init = init;

  // Helpers útiles (por si los usas en otros módulos)
  JC.auth.getUser = async function () {
    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user ?? null;
    } catch {
      return null;
    }
  };

  JC.auth.isLoggedIn = function () {
    return !!window.currentUser;
  };
})();
