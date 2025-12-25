// js/community.js
(function () {
  "use strict";

  // Namespace seguro
  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // Helpers mínimos
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

  // Event bus simple (por si no existe)
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

  // UI refs (IDs reales del index)
  function refs() {
    return {
      gate: $("#comuGate"),
      composer: $("#comuComposer"),
      badge: $("#comuLockBadge"),
      tabs: Array.from(document.querySelectorAll(".comu-tab[data-comu-cat]")),
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

  // Estado interno de comunidad
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

  function setGate() {
    const { gate, composer, badge } = refs();

    // No logueado
    if (!isLogged()) {
      if (gate) gate.textContent = "🔒 Inicia sesión para ver contenido de comunidad.";
      if (composer) composer.style.display = "none";
      if (badge) badge.textContent = "🔒 Solo miembros";
      return;
    }

    // Logueado pero no miembro
    if (!isMember()) {
      if (gate) gate.textContent = "🔒 Regístrate (perfil) para publicar, comentar y reaccionar ❤️";
      if (composer) composer.style.display = "none";
      if (badge) badge.textContent = "🔒 Solo miembros";
      return;
    }

    // Miembro
    if (gate) gate.textContent = "✅ Miembro activo: puedes publicar, comentar y reaccionar ❤️";
    if (composer) composer.style.display = "block";
    if (badge) badge.textContent = "✅ Miembros";
  }

  function setActiveCat(cat) {
    st.cat = cat || "chicos";
    const { tabs } = refs();
    tabs.forEach((b) => {
      const active = b.dataset.comuCat === st.cat;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  // =========================
  // FEED (placeholder seguro)
  // =========================
  async function cargarFeed({ force = false } = {}) {
    const { list } = refs();
    if (!list) return;

    // Si aún no hay lógica real de Supabase aquí, no rompemos UI
    // Luego reemplazamos por: select posts by cat, order, join profiles, etc.
    if (!isLogged()) {
      list.innerHTML = `<div class="muted small">🔒 Inicia sesión para ver publicaciones.</div>`;
      return;
    }

    if (!isMember()) {
      list.innerHTML = `<div class="muted small">🔒 Regístrate (perfil) para ver el feed completo.</div>`;
      return;
    }

    // Placeholder de arranque (hasta que pegues la tabla real)
    list.innerHTML = `
      <div class="jc-card-mini">
        <strong>🧩 Comunidad lista</strong>
        <div class="muted small" style="margin-top:6px">
          Categoría actual: <b>${st.cat}</b><br/>
          (Feed real pendiente: posts/comentarios/likes con Supabase + RLS)
        </div>
      </div>
    `;
  }

  // =========================
  // PUBLICAR (stub seguro)
  // =========================
  async function publicar() {
    const { titulo, contenido, estado } = refs();
    if (!estado) return;

    if (!isLogged()) {
      estado.textContent = "🔒 Inicia sesión primero.";
      return;
    }
    if (!isMember()) {
      estado.textContent = "🔒 Regístrate (perfil) para publicar.";
      return;
    }

    const t = String(titulo?.value || "").trim();
    const c = String(contenido?.value || "").trim();

    if (!t || !c) {
      estado.textContent = "Completa título y contenido.";
      return;
    }

    // Aquí es donde irá el insert real en Supabase.
    // Por ahora solo confirmamos para que no parezca roto.
    estado.textContent = "✅ Publicación lista (pendiente de conectar a Supabase).";
    try {
      window.logAviso?.({ title: "Comunidad", body: "Publicación preparada ✅" });
      window.miaSetEstado?.("apoyo");
    } catch {}

    // Limpia
    if (titulo) titulo.value = "";
    if (contenido) contenido.value = "";

    await cargarFeed({ force: true });
  }

  // =========================
  // MODAL COMENTARIOS (stub)
  // =========================
  function openModal(postId, title = "Comentarios", meta = "—") {
    const { modal, modalTitle, modalMeta, commentsList, commentComposer, commentGate } = refs();
    if (!modal) return;

    st.openPostId = postId || null;

    if (modalTitle) modalTitle.textContent = title;
    if (modalMeta) modalMeta.textContent = meta;

    if (commentsList) {
      commentsList.innerHTML = `<div class="muted small">Comentarios (pendiente de conectar a Supabase).</div>`;
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
          ? "🔒 Inicia sesión para comentar."
          : "🔒 Regístrate para comentar.";
      }
    }

    modal.style.display = "flex";
    modal.classList.add("show");
    // overlay global (si lo tienes)
    try {
      window.jcState && (window.jcState.loginOpen = true); // reusa overlay, sin crear uno nuevo
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
      window.jcState && (window.jcState.loginOpen = false);
      window.jcSyncOverlay?.();
    } catch {}
  }

  async function comentar() {
    const { commentText, commentEstado } = refs();
    if (!commentEstado) return;

    if (!isLogged()) {
      commentEstado.textContent = "🔒 Inicia sesión primero.";
      return;
    }
    if (!isMember()) {
      commentEstado.textContent = "🔒 Regístrate para comentar.";
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

  // =========================
  // Bind UI (una vez)
  // =========================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    // Tabs categorías
    r.tabs.forEach((b) => {
      b.addEventListener("click", async () => {
        setActiveCat(b.dataset.comuCat);
        await cargarFeed({ force: true });
      });
    });

    // Publicar
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

    // Modal comentarios
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

    // Exponer para auth.js / otros módulos (compat)
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

    // gate se recalcula cuando cambia perfil
    JC.on("profile:changed", () => {
      setGate();
      cargarFeed({ force: true });
    });

    // Estado inicial
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