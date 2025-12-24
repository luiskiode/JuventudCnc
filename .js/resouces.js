
// js/resources.js
(function () {
  const JC = window.JC;

  function init() {
    // Aquí luego mueves:
    // - listarRecursos()
    // - upload desde #fileRec
    // - FAB abre selector cuando estás en "recursos"
    JC.$("#fab")?.addEventListener("click", () => {
      const current = (location.hash || "#inicio").replace("#", "");
      if (current === "recursos") JC.$("#fileRec")?.click();
    });
  }

  JC.resources = { init };
})();