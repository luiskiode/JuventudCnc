
// js/community.js
(function () {
  const JC = window.JC;

  function setGate() {
    const gate = JC.$("#comuGate");
    const composer = JC.$("#comuComposer");
    const badge = JC.$("#comuLockBadge");

    if (!JC.state.user) {
      gate && (gate.textContent = "🔒 Inicia sesión para ver contenido de comunidad.");
      composer && (composer.style.display = "none");
      badge && (badge.textContent = "🔒 Solo miembros");
      return;
    }

    if (!JC.state.isMember) {
      gate && (gate.textContent = "🔒 Regístrate (perfil) para publicar, comentar y reaccionar ❤️");
      composer && (composer.style.display = "none");
      badge && (badge.textContent = "🔒 Solo miembros");
      return;
    }

    gate && (gate.textContent = "✅ Miembro activo: puedes publicar, comentar y reaccionar ❤️");
    composer && (composer.style.display = "block");
    badge && (badge.textContent = "✅ Miembros");
  }

  function init() {
    JC.on("profile:changed", setGate);
    setGate();

    // Aquí luego mueves:
    // - cargar feed
    // - publicar
    // - abrir modal comentarios
    // - comentar + likes
  }

  JC.community = { init };
})();