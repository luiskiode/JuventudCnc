// js/events.js
(function () {
  const JC = window.JC;

  function setGate() {
    const gate = JC.$("#evGate");
    const wrap = JC.$("#evCreateWrap");

    if (!JC.state.user) {
      gate && (gate.textContent = "🔒 Inicia sesión para ver tu estado de miembro.");
      wrap && (wrap.style.display = "none");
      return;
    }
    if (!JC.state.isMember) {
      gate && (gate.textContent = "🔒 Registra tu perfil para gestionar eventos.");
      wrap && (wrap.style.display = "none");
      return;
    }
    gate && (gate.textContent = "✅ Miembro activo: puedes crear/editar eventos.");
    wrap && (wrap.style.display = "block");
  }

  function init() {
    JC.on("profile:changed", setGate);
    setGate();

    // Aquí luego mueves:
    // - cargar lista eventos
    // - calendario
    // - crear/editar/borrar
  }

  JC.events = { init };
})();