// js/community.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // ✅ NO fijar el cliente una vez (evita “sb null” si carga después)
  const getSB = () => window.sb || window.supabaseClient || JC.sb || null;

  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ = JC.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

  // Event bus simple (robusto)
  if (typeof JC.on !== "function") {
    JC.on = function (evt, cb) {
      document.addEventListener(`JC:${evt}`, (e) => cb(e.detail), false);
    };
  }
  if (typeof JC.emit !== "function") {
    JC.emit = function (evt, detail) {
      document.dispatchEvent(new CustomEvent(`JC:${evt}`, { detail }));
    };
  }

  // ============================================================
  // UI refs
  // ============================================================
  function refs() {
    return {
      gate: $("#comuGate"),
      composer: $("#comuComposer"),
      badge: $("#comuLockBadge"),

      tabs: $$(".comu-tab[data-comu-cat]"),
      formPost: $("#formComuPost"),
      titulo: $("#comuTitulo"),
      contenido: $("#comuContenido"),
      estado: $("#comuEstado"),
      btnClear: $("#btnComuClear"),
      btnRefresh: $("#btnComuRefresh"),
      list: $("#comuList"),

      // Modal comentarios
      modal: $("#comuModal"),
      modalClose: $("#comuModalClose"),
      modalTitle: $("#comuModalTitle"),
      modalMeta: $("#comuModalMeta"),
      commentsList: $("#comuCommentsList"),
      commentComposer: $("#comuCommentComposer"),
      commentGate: $("#comuCommentGate"),
      formComment: $("#formComuComment"),
      commentText: $("#comuCommentText"),
      commentEstado: $("#comuCommentEstado"),
      btnCommentClear: $("#btnComuCommentClear")
    };
  }

  const st = {
    cat: "chicos",
    openPostId: null,
    bound: false
  };

  function isLogged() {
    return !!JC.state.user || !!window.currentUser;
  }
  function isMember() {
    return !!JC.state.isMember;
  }

  // ============================================================
  // Gate: lectura pública; interacción solo miembros
  // ============================================================
  function setGate() {
    const { gate, composer, badge } = refs();

    if (!isLogged()) {
      if (gate) gate.textContent =
        "👀 Puedes leer la comunidad. 🔑 Inicia sesión para interactuar (publicar, comentar y reaccionar ❤️).";
      if (composer) composer.style.display = "none";
      if (badge) badge.textContent = "👀 Lectura pública";
      return;
    }

    if (!isMember()) {
      if (gate) gate.textContent =
        "👀 Puedes leer. 🔒 Completa tu perfil para publicar, comentar y reaccionar ❤️.";
      if (composer) composer.style.display = "none";
      if (badge) badge.textContent = "🔒 Interacción solo miembros";
      return;
    }

    if (gate) gate.textContent = "✅ Miembro activo: puedes publicar, comentar y reaccionar ❤️";
    if (composer) composer.style.display = "block";
    if (badge) badge.textContent = "✅ Miembros";
  }

  // ============================================================
  // Tabs
  // ============================================================
  function setActiveCat(cat) {
    st.cat = (cat || "chicos").toString();
    const { tabs } = refs();
    tabs.forEach((b) => {
      const active = b.dataset.comuCat === st.cat;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  // ============================================================
  // FEED (placeholder, lectura pública)
  // NOTA: Aquí antes te crasheaba por cosas tipo:
  // - "comunidad is not defined" (módulo viejo)
  // - hooks llamando a window.jcComunidad.cargarFeed y no existía
  // Ya lo exponemos al final y no depende de variables globales raras.
  // ============================================================
  async function cargarFeed({ force = false } = {}) {
    const { list } = refs();
    if (!list) return;

    // Mientras conectas tablas reales:
    // posts_comunidad / comentarios_comunidad / reacciones_comunidad
    list.innerHTML = `
      <div class="jc-card-mini">
        <strong>🧩 Comunidad</strong>
        <div class="muted small" style="margin-top:6px">
          Categoría actual: <b>${JC.safeText ? JC.safeText(st.cat) : st.cat}</b><br/>
          Lectura pública ✅ — interacción (publicar/comentar/reaccionar) solo miembros 🔒<br/>
          (Feed real pendiente de conectar)
        </div>

        <div class="muted small" style="margin-top:10px">
          💡 Siguiente paso: conectar Supabase y renderizar cards con botón ❤️ + abrir modal de comentarios.
        </div>
      </div>
    `;
  }

  // ============================================================
  // PUBLICAR (solo miembros) — placeholder
  // ============================================================
  async function publicar() {
    const { titulo, contenido, estado } = refs();
    if (!estado) return;

    if (!isLogged()) {
      estado.textContent = "🔑 Inicia sesión para publicar.";
      return;
    }
    if (!isMember()) {
      estado.textContent = "🔒 Completa tu perfil para publicar.";
      return;
    }

    const t = String(titulo?.value || "").trim();
    const c = String(contenido?.value || "").trim();

    if (!t || !c) {
      estado.textContent = "Completa título y contenido.";
      return;
    }

    // Placeholder hasta conectar Supabase
    estado.textContent = "✅ Publicación lista (pendiente de conectar a Supabase).";
    try {
      window.logAviso?.({ title: "Comunidad", body: `Publicación preparada: ${t}` });
      window.miaSetEstado?.("apoyo");
    } catch {}

    if (titulo) titulo.value = "";
    if (contenido) contenido.value = "";

    await cargarFeed({ force: true });
  }

  // ============================================================
  // MODAL COMENTARIOS
  // FIX: antes estabas tocando window.jcState.loginOpen (no existe)
  // y eso rompía overlay. Ahora usamos JC.uiState (ui.js) si existe.
  // ============================================================
  function openModal(postId, title = "Comentarios", meta = "—") {
    const {
      modal,
      modalTitle,
      modalMeta,
      commentsList,
      commentComposer,
      commentGate
    } = refs();
    if (!modal) return;

    st.openPostId = postId || null;

    if (modalTitle) modalTitle.textContent = title;
    if (modalMeta) modalMeta.textContent = meta;

    if (commentsList) {
      commentsList.innerHTML =
        `<div class="muted small">Comentarios (lectura pública) — pendiente de conectar a Supabase.</div>`;
    }

    // Gate comentar
    if (isLogged() && isMember()) {
      if (commentComposer) commentComposer.style.display = "block";
      if (commentGate) commentGate.style.display = "none";
    } else {
      if (commentComposer) commentComposer.style.display = "none";
      if (commentGate) {
        commentGate.style.display = "block";
        commentGate.textContent = !isLogged()
          ? "🔑 Inicia sesión para comentar."
          : "🔒 Completa tu perfil para comentar.";
      }
    }

    modal.style.display = "flex";
    modal.classList.add("show");

    // ✅ Overlay correcto (ui.js usa JC.uiState)
    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.comuOpen = true;
      window.jcSyncOverlay?.();
    } catch {}
  }

  function closeModal() {
    const { modal } = refs();
    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";
    st.openPostId = null;

    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.comuOpen = false;
      window.jcSyncOverlay?.();
    } catch {}
  }

  async function comentar() {
    const { commentText, commentEstado } = refs();
    if (!commentEstado) return;

    if (!isLogged()) {
      commentEstado.textContent = "🔑 Inicia sesión primero.";
      return;
    }
    if (!isMember()) {
      commentEstado.textContent = "🔒 Completa tu perfil para comentar.";
      return;
    }

    const txt = String(commentText?.value || "").trim();
    if (!txt) {
      commentEstado.textContent = "Escribe un comentario.";
      return;
    }

    commentEstado.textContent = "✅ Comentario listo (pendiente de Supabase).";
    if (commentText) commentText.value = "";
  }

  // ============================================================
  // Bind UI (una vez)
  // ============================================================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    r.tabs.forEach((b) => {
      b.addEventListener("click", async () => {
        setActiveCat(b.dataset.comuCat);
        await cargarFeed({ force: true });
      });
    });

    r.formPost?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await publicar();
    });

    r.btnClear?.addEventListener("click", () => {
      if (r.titulo) r.titulo.value = "";
      if (r.contenido) r.contenido.value = "";
      if (r.estado) r.estado.textContent = "";
    });

    r.btnRefresh?.addEventListener("click", () => cargarFeed({ force: true }));

    r.modalClose?.addEventListener("click", closeModal);
    r.modal?.addEventListener("click", (e) => {
      if (e.target === r.modal) closeModal();
    });

    r.formComment?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await comentar();
    });

    r.btnCommentClear?.addEventListener("click", () => {
      if (r.commentText) r.commentText.value = "";
      if (r.commentEstado) r.commentEstado.textContent = "";
    });

    // ✅ Exponer compat que main.js/auth.js llaman
    window.jcComunidad = window.jcComunidad || {};
    window.jcComunidad.cargarFeed = cargarFeed;
    window.jcComunidad.refreshAuthAndMiembro = async () => {
      setGate();
      await cargarFeed({ force: true });
    };
    window.jcComunidad.openModal = openModal;
    window.jcComunidad.closeModal = closeModal;
  }

  async function init() {
    bindUI();

    // Recalcular gates cuando cambia perfil
    JC.on("profile:changed", () => {
      setGate();
      cargarFeed({ force: true });
    });

    setActiveCat(st.cat);
    setGate();
    await cargarFeed({ force: true });
  }

  JC.community = {
    init,
    setGate,
    cargarFeed,
    openModal,
    closeModal
  };
})();