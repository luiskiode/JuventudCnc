// js/resources.js
(function () {
  // Namespace seguro
  const JC = (window.JC = window.JC || {});
  JC.resources = JC.resources || {};

  // Helpers mínimos (no dependas de que ui.js ya los haya definido)
  const $ = (sel, root = document) => root.querySelector(sel);

  // URLs (defaults) — se pueden sobreescribir desde config.js si quieres
  const VATICANO_URL =
    (JC.config && JC.config.links && JC.config.links.vaticano) ||
    "https://www.vatican.va/content/vatican/es.html";

  const BIBLIA_URL =
    (JC.config && JC.config.links && JC.config.links.biblia) ||
    "https://es.jesus.net/biblia/salmo-23?gad_source=1&gad_campaignid=22037241986&gbraid=0AAAAAo9sgALt2dICRTY7UBIEnOuLX4rgD&gclid=CjwKCAiA3rPKBhBZEiwAhPNFQFVqLZ8BJr1VNGmQ4zNdEwYwTxM_EQFkFLu8jj0iI9UctfSBU8Kk6BoCtvcQAvD_BwE";

  /**
   * ✅ Parche crítico:
   * Mucho código (main/activate) probablemente llama a listarRecursos().
   * Si no existe, rompe toda la navegación.
   *
   * Este stub NO reemplaza tu lógica final: evita el crash y deja trazas claras.
   * Luego, cuando pegues el “listado real”, se reemplaza aquí.
   */
  async function listarRecursos(scope = "catefa") {
    try {
      // Gate/estado (si existen)
      const gate = $("#catefaGate");
      const estado = $("#catefaEstado");

      if (gate) gate.textContent = "Cargando recursos…";
      if (estado) estado.textContent = "";

      // Si todavía no tienes backend listo, mostramos placeholder seguro
      // (Así Catefa “no se muere” aunque la lógica aún esté en progreso)
      const listNinos = $("#catefaNinos");
      const listSesiones = $("#catefaSesiones");

      if (listNinos && listNinos.children.length === 0) {
        listNinos.innerHTML =
          '<div class="muted small">Aún no hay datos. Inicia sesión y selecciona un grupo.</div>';
      }
      if (listSesiones && listSesiones.children.length === 0) {
        listSesiones.innerHTML =
          '<div class="muted small">Aún no hay sesiones. Crea una sesión para empezar.</div>';
      }

      if (gate) gate.textContent = "Catefa listo ✅";
      if (estado) estado.textContent = `OK · ${String(scope)}`;

      return { ok: true, scope };
    } catch (e) {
      console.error("[JC] listarRecursos error", e);
      const gate = $("#catefaGate");
      if (gate) gate.textContent = "Error cargando Catefa ❌";
      return { ok: false, error: e };
    }
  }

  function openExternal(url, fallbackId) {
    try {
      // Intento 1: abrir con window.open
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (w) return;

      // Intento 2: fallback anchor en DOM (si popup blocked)
      const a = fallbackId ? document.getElementById(fallbackId) : null;
      if (a && a.href) a.click();
      else location.href = url;
    } catch (e) {
      console.error("[JC] openExternal error", e);
      // último recurso
      location.href = url;
    }
  }

  function bindCatefaLinks() {
    const btnV = document.getElementById("btnVaticano");
    const btnB = document.getElementById("btnBiblia");

    if (btnV) {
      btnV.addEventListener("click", () => openExternal(VATICANO_URL, "linkVaticano"));
    }
    if (btnB) {
      btnB.addEventListener("click", () => openExternal(BIBLIA_URL, "linkBiblia"));
    }

    // Opcional: si por alguna razón quieres mostrar los fallbacks
    // cuando JS detecta bloqueo de popups, esto se puede activar luego.
  }

  function bindCatefaRefresh() {
    const btn = document.getElementById("btnCatefaRefresh");
    if (btn) btn.addEventListener("click", () => listarRecursos("catefa"));
  }

  function bindFabUploadHook() {
    // En tu index actual NO existe #fab ni #fileRec.
    // Entonces lo hacemos compatible sin romper nada.
    const fab = document.getElementById("fab");
    const fileRec = document.getElementById("fileRec");

    if (!fab || !fileRec) return;

    fab.addEventListener("click", () => {
      // Tu app usa data-view / data-tab, no necesariamente location.hash.
      // De todas formas dejamos un fallback.
      const current =
        (JC.ui && JC.ui.getActiveView && JC.ui.getActiveView()) ||
        (location.hash || "#inicio").replace("#", "");

      if (current === "recursos") fileRec.click();
    });
  }

  function init() {
    // 1) Exporta función global para evitar "listarRecursos is not defined"
    window.listarRecursos = listarRecursos;
    JC.resources.listarRecursos = listarRecursos;

    // 2) Hooks de UI
    bindFabUploadHook();
    bindCatefaLinks();
    bindCatefaRefresh();

    // 3) Primera carga segura (solo si estamos en recursos o si existe el gate)
    // No forzamos navegación; solo pre-carga si el DOM tiene Catefa.
    if (document.getElementById("catefaGate")) {
      // No await para no bloquear init global
      listarRecursos("catefa");
    }
  }

  JC.resources.init = init;
})();