/* ============================================================
   auth.js — Login modal + Magic Link (redirect DIRECTO a la app)
   + consume ?code=... (PKCE) si viene
   + Auth state change (UNA VEZ)
   ============================================================ */
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});

  const sb = window.sb || window.supabaseClient;
  if (!sb || !sb.auth) {
    console.warn("[JC][auth] Supabase client no disponible (sb/supabaseClient).");
    JC.auth = JC.auth || { init: async () => false };
    return;
  }

  const state = window.jcState || window.JC?.uiState || (window.JC.uiState = {});
  const syncOverlay = window.jcSyncOverlay || (() => {});

  function jcSetLoginMsg(msg) {
    const el = document.getElementById("loginEstado");
    if (el) el.textContent = msg || "";
  }

  function getEls() {
    return {
      btnLogin: document.getElementById("btnLogin"),
      loginModal: document.getElementById("loginModal"),
      loginClose: document.getElementById("loginClose"),
      loginForm: document.getElementById("loginForm"),
      loginEmail: document.getElementById("loginEmail"),
      loginEstado: document.getElementById("loginEstado"),
    };
  }

  function openLoginModal() {
    const { loginModal, loginEmail } = getEls();
    if (!loginModal) return;
    state.loginOpen = true;
    loginModal.style.display = "flex";
    loginModal.classList.add("show");
    syncOverlay();
    setTimeout(() => loginEmail?.focus(), 30);
  }

  function closeLoginModal() {
    const { loginModal, loginEstado } = getEls();
    if (!loginModal) return;
    state.loginOpen = false;
    loginModal.classList.remove("show");
    loginModal.style.display = "none";
    syncOverlay();
    if (loginEstado) loginEstado.textContent = "";
  }

  window.jcOpenLoginModal = openLoginModal;
  window.jcCloseLoginModal = closeLoginModal;

  // ============================================================
  // Consume ?code=... para crear sesión (PKCE)
  // ============================================================
  async function consumeAuthCodeIfPresent() {
    try {
      const url = new URL(location.href);
      const code = url.searchParams.get("code");
      if (!code) return false;

      if (typeof sb.auth.exchangeCodeForSession === "function") {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) console.warn("[JC][auth] exchangeCodeForSession error:", error);
      }

      url.searchParams.delete("code");
      history.replaceState({}, document.title, url.toString());
      return true;
    } catch (e) {
      console.warn("[JC][auth] consumeAuthCodeIfPresent error:", e);
      return false;
    }
  }

  // ============================================================
  // Magic Link sender (redirige al index actual)
  // ============================================================
  async function sendMagicLink(email) {
    if (!sb?.auth?.signInWithOtp) throw new Error("Auth no disponible (signInWithOtp).");

    // Vuelve a la misma URL (GitHub Pages + carpeta) y abre Perfil
    const redirectTo =
      `${location.origin}${location.pathname}?tab=perfil&v=${encodeURIComponent(window.JC_BUILD || "")}`;

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) throw error;
    return true;
  }

  // ============================================================
  // Bind UI (UNA VEZ)
  // ============================================================
  function bindUIOnce() {
    if (window.__JC_AUTH_UI_BOUND__) return;
    window.__JC_AUTH_UI_BOUND__ = true;

    const { btnLogin, loginClose, loginModal, loginForm, loginEmail } = getEls();

    btnLogin?.addEventListener("click", openLoginModal);
    loginClose?.addEventListener("click", closeLoginModal);

    loginModal?.addEventListener("click", (e) => {
      if (e.target === loginModal) closeLoginModal();
    });

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (loginEmail?.value || "").trim().toLowerCase();
      if (!email) {
        jcSetLoginMsg("Escribe tu correo primero.");
        return;
      }

      jcSetLoginMsg("Enviando enlace…");

      try {
        await sendMagicLink(email);
        jcSetLoginMsg("✅ Listo. Revisa tu correo y abre el enlace.");
        window.angieSetEstado?.("ok");
      } catch (err) {
        console.error("[JC][auth] Login error:", err);
        jcSetLoginMsg(`Error: ${err?.message || "no se pudo enviar"}`);
        window.angieSetEstado?.("confundida");
      }
    });
  }

  // ============================================================
  // Refresh de módulos / gates
  // ============================================================
  async function refreshGates() {
    try { await window.cargarPerfil?.(); } catch {}
    try { await window.jcComunidad?.refreshAuthAndMiembro?.(); } catch {}
    try { await window.jcJudart?.refreshAuthAndMiembro?.(); } catch {}
    try { await window.jcEventos?.refreshAuth?.(); } catch {}
  }

  // ============================================================
  // Auth state global (UNA VEZ)
  // ============================================================
  function bindAuthStateOnce() {
    if (window.__JC_AUTH_STATE_BOUND__) return;
    window.__JC_AUTH_STATE_BOUND__ = true;

    window.currentUser = window.currentUser || null;

    if (typeof sb.auth.onAuthStateChange !== "function") {
      console.warn("[JC][auth] onAuthStateChange no disponible.");
      return;
    }

    sb.auth.onAuthStateChange(async (_event, session) => {
      try {
        window.currentUser = session?.user ?? null;
        if (window.currentUser) closeLoginModal();
        await refreshGates();
      } catch (e) {
        console.error("[JC][auth] onAuthStateChange error:", e);
      }
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  async function init() {
    bindUIOnce();
    bindAuthStateOnce();

    // 🔥 Si venimos de un magic link con ?code=..., lo convertimos en sesión aquí
    await consumeAuthCodeIfPresent();

    // Carga estado inicial
    try {
      const { data } = await sb.auth.getSession();
      window.currentUser = data?.session?.user ?? null;
      if (window.currentUser) closeLoginModal();
    } catch {}

    try { await refreshGates(); } catch {}
    return true;
  }

  async function signOut() {
    try {
      await sb.auth.signOut();
      window.currentUser = null;
      await refreshGates();
      return true;
    } catch (e) {
      console.error("[JC][auth] signOut error:", e);
      return false;
    }
  }

  async function getUser() {
    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user ?? null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!window.currentUser;
  }

  JC.auth = {
    init,
    openLoginModal,
    closeLoginModal,
    sendMagicLink,
    signOut,
    getUser,
    isLoggedIn,
  };
})();