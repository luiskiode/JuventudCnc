// js/bots.js
(function () {
  const JC = window.JC;

  function init() {
    // Botón encender/apagar bots
    JC.$("#btnBots")?.addEventListener("click", () => {
      JC.state.botsEnabled = !JC.state.botsEnabled;
      const chat = JC.$("#jcChat");
      if (chat) chat.style.display = JC.state.botsEnabled ? "block" : "none";
      JC.emit("bots:toggled", { enabled: JC.state.botsEnabled });
    });

    // Si quieres: por defecto chat oculto hasta toggle
    const chat = JC.$("#jcChat");
    if (chat) chat.style.display = "none";

    // Cuando cambias de vista, si estás en "box", mueve el chat al mount
    JC.on("ui:view", ({ detail }) => {
      const tab = detail?.tab;
      const mount = JC.$("#boxChatMount");
      const chatEl = JC.$("#jcChat");
      if (!mount || !chatEl) return;

      if (tab === "box") mount.appendChild(chatEl);
      else document.body.appendChild(chatEl);
    });
  }

  JC.bots = { init };
})();
