/* ============================================================
   auth.js — Login modal + Magic Link (redirect a auth.html)
   + Auth state change (UNA VEZ)
   Robusto para módulos, evita doble bind, no pisa exports.
   ============================================================ */
(function () {
  "use strict";

  // Namespace
  const JC = (window.JC = window.JC || {});

  // Usa alias si existe
  const sb = window.sb || window.supabaseClient;
  if (!sb || !sb.auth) {
    console.warn("[JC][auth] Supabase client no disponible (sb/supabaseClient).");
    JC.auth = JC.auth || { init: async () => false };
    return;
  }

  // Estado overlay (ui.js)
  const state = window.jcState || window.JC?.uiState || (window.JC.uiState = {});
  const syncOverlay = window.jcSyncOverlay || (() => {});

  // ============================================================
  // Config de rutas (GitHub Pages)
  // ============================================================
  const APP_ORIGIN = "https://luiskiode.github.io";
  const APP_BASE = "/JuventudCnc/";
  const AUTH_CALLBACK_URL = `${APP_ORIGIN}${APP_BASE}auth.html`;

  function jcSetLoginMsg(msg) {
    const el = document.getElementById("loginEstado");
    if (el) el.textContent = msg || "";
  }

  // ============================================================
  // (Opcional) Anon session (solo si tu backend lo usa)
  // OJO: Para tu caso (leer foro público sin sesión) NO es obligatorio.
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

      return null;
    } catch (e) {
      console.warn("[JC][auth] Anon session error:", e);
      return null;
    }
  }
  window.jcEnsureAnonSession = jcEnsureAnonSession;

  // ============================================================
  // Modal helpers (no asume que existan los nodos)
  // ============================================================
  function getEls() {
    return {
      btnLogin: document.getElementById("btnLogin"),
      loginModal: document.getElementById("loginModal"),
      loginClose: document.getElementById("loginClose"),
      loginForm: document.getElementById("loginForm"),
      loginEmail: document.getElementById("loginEmail"),
      loginEstado: document.getElementById("loginEstado")
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
  // Magic Link sender
  // ============================================================
  async function sendMagicLink(email) {
    if (!sb?.auth?.signInWithOtp) {
      throw new Error("Auth no disponible (signInWithOtp).");
    }

    // “next” le dice al callback dónde volver.
    // Usamos query (no hash) para que sea sólido y fácil de parsear en auth.html.
    const next = encodeURIComponent(`${APP_ORIGIN}${APP_BASE}?tab=perfil`);
    const redirectTo = `${AUTH_CALLBACK_URL}?next=${next}&v=${encodeURIComponent(window.JC_BUILD || "")}`;

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo
      }
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
  // Auth state global (UNA VEZ)
  // ============================================================
  async function refreshGates() {
    // Refresca módulos sin romper si no existen
    try { await window.cargarPerfil?.(); } catch {}
    try { await window.jcComunidad?.refreshAuthAndMiembro?.(); } catch {}
    try { await window.jcJudart?.refreshAuthAndMiembro?.(); } catch {}
    try { await window.jcEventos?.refreshAuth?.(); } catch {}

    // Si estás en comunidad, refresca feed
    try {
      const tab = new URL(location.href).searchParams.get("tab")
        || (location.hash || "#inicio").replace("#", "").trim();
      if (tab === "comunidad" || tab === "foro") {
        await window.jcComunidad?.cargarFeed?.({ force: true });
      }
    } catch {}
  }

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

        // Si ya hay sesión, cerramos modal para evitar que quede abierto
        if (window.currentUser) closeLoginModal();

        await refreshGates();
      } catch (e) {
        console.error("[JC][auth] onAuthStateChange error:", e);
      }
    });
  }

  // ============================================================
  // Public API (NO pisar JC.auth luego)
  // ============================================================
  async function init() {
    // UI listeners
    bindUIOnce();
    bindAuthStateOnce();

    // Carga estado inicial
    try {
      const { data } = await sb.auth.getSession();
      window.currentUser = data?.session?.user ?? null;
      if (window.currentUser) closeLoginModal();
    } catch {}

    // (Opcional) Anon session si lo necesitas en tu esquema
    // Para tu regla actual (foro lectura pública), normalmente NO hace falta.
    // Lo dejamos comentado por defecto para evitar usuarios “anon” ocupando cosas.
    // try { await jcEnsureAnonSession(); } catch {}

    // Refresca gates una primera vez
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
    sendMagicLink, // útil para tests
    signOut,
    getUser,
    isLoggedIn
  };
})();