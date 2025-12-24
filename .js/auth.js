// js/auth.js
(function () {
  const JC = window.JC;

  function openModal() {
    const m = JC.$("#loginModal");
    if (m) m.style.display = "block";
  }
  function closeModal() {
    const m = JC.$("#loginModal");
    if (m) m.style.display = "none";
  }

  async function refreshSession() {
    if (!JC.sb?.auth) return;
    const { data } = await JC.sb.auth.getSession();
    JC.state.user = data?.session?.user || null;
    JC.emit("auth:changed", { user: JC.state.user });
  }

  async function sendMagicLink(email) {
    const estado = JC.$("#loginEstado");
    try {
      estado && (estado.textContent = "Enviando enlace…");
      const redirectTo = location.origin + location.pathname + "#perfil";

      const { error } = await JC.sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      estado && (estado.textContent = "✅ Listo. Revisa tu correo (y spam).");
    } catch (e) {
      console.error(e);
      estado && (estado.textContent = "❌ Error enviando enlace. Revisa el correo.");
    }
  }

  function bindUI() {
    JC.$("#btnLogin")?.addEventListener("click", openModal);
    JC.$("#loginClose")?.addEventListener("click", closeModal);

    JC.$("#loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = JC.$("#loginEmail")?.value?.trim();
      if (!email) return;
      sendMagicLink(email);
    });
  }

  function bindAuthEvents() {
    if (!JC.sb?.auth) return;

    JC.sb.auth.onAuthStateChange((_event, session) => {
      JC.state.user = session?.user || null;
      JC.emit("auth:changed", { user: JC.state.user });
    });
  }

  async function init() {
    bindUI();
    bindAuthEvents();
    await refreshSession();
  }

  JC.auth = { init, openModal, closeModal, refreshSession };
})();