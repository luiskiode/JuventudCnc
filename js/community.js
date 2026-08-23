// js/community.js
// Comunidad (Retos + Dinámicas + Foro) — Supabase conectado
// ✅ Lectura pública (feed + comentarios + likes) por defecto
// ✅ Publicar / comentar / reaccionar ❤️ SOLO miembros (RLS lo refuerza)
// ✅ Robusto: no revienta si falta algún ID o si sb aún no está listo
// ✅ Modal comentarios funcional (carga + publicar + likes)
// ✅ Exports compatibles: window.jcComunidad.cargarFeed / refreshAuthAndMiembro / openModal / closeModal
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
      btnCommentClear: $("#btnComuCommentClear"),
    };
  }

  const st = {
    cat: "chicos",
    openPostId: null,
    bound: false,
    feedCache: new Map(), // key = cat, value = [{...post}]
  };

  function safeText(s) {
    try {
      if (typeof JC.safeText === "function") return JC.safeText(s);
    } catch {}
    return String(s ?? "");
  }

  async function getUserId() {
    const u = JC.state.user || window.currentUser || null;
    if (u?.id) return u.id;
    const sb = getSB();
    if (!sb?.auth?.getUser) return null;
    try {
      const { data } = await sb.auth.getUser();
      return data?.user?.id || null;
    } catch {
      return null;
    }
  }

  function isLogged() {
    return !!(JC.state.user || window.currentUser);
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
      if (gate) {
        gate.textContent =
          "👀 Puedes leer la comunidad. 🔑 Inicia sesión para interactuar (publicar, comentar y reaccionar ❤️).";
      }
      if (composer) composer.style.display = "none";
      if (badge) badge.textContent = "👀 Lectura pública";
      return;
    }

    if (!isMember()) {
      if (gate) {
        gate.textContent =
          "👀 Puedes leer. 🔒 Completa tu perfil para publicar, comentar y reaccionar ❤️.";
      }
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
  // Supabase: queries
  // Tables esperadas:
  // - comu_posts (id, created_at, user_id, cat, titulo, contenido, is_deleted)
  // - comu_comments (id, created_at, post_id, user_id, contenido)
  // - comu_likes (post_id, user_id, created_at) PK(post_id,user_id)
  // ============================================================
  async function sbFetchPosts(cat, limit = 30) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const { data, error } = await sb
      .from("comu_posts")
      .select("id,created_at,user_id,cat,titulo,contenido,is_deleted")
      .eq("cat", cat)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async function sbFetchLikesForPosts(postIds = []) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    if (!postIds.length) return [];

    // Traemos likes de esos posts (público)
    const { data, error } = await sb
      .from("comu_likes")
      .select("post_id,user_id,created_at")
      .in("post_id", postIds);

    if (error) throw error;
    return data || [];
  }

  async function sbCreatePost({ cat, titulo, contenido }) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const uid = await getUserId();
    if (!uid) throw new Error("No hay sesión");

    const { error } = await sb.from("comu_posts").insert({
      user_id: uid,
      cat,
      titulo,
      contenido,
    });

    if (error) throw error;
    return true;
  }

  async function sbFetchComments(postId, limit = 80) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const { data, error } = await sb
      .from("comu_comments")
      .select("id,created_at,post_id,user_id,contenido")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async function sbCreateComment({ postId, contenido }) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const uid = await getUserId();
    if (!uid) throw new Error("No hay sesión");

    const { error } = await sb.from("comu_comments").insert({
      post_id: postId,
      user_id: uid,
      contenido,
    });

    if (error) throw error;
    return true;
  }

  async function sbHasLiked(postId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    const uid = await getUserId();
    if (!uid) return false;

    const { data, error } = await sb
      .from("comu_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async function sbLike(postId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const uid = await getUserId();
    if (!uid) throw new Error("No hay sesión");

    const { error } = await sb.from("comu_likes").insert({
      post_id: postId,
      user_id: uid,
    });

    if (error) throw error;
    return true;
  }

  async function sbUnlike(postId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const uid = await getUserId();
    if (!uid) throw new Error("No hay sesión");

    const { error } = await sb
      .from("comu_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);

    if (error) throw error;
    return true;
  }

  // ============================================================
  // Render helpers
  // ============================================================
  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(ts || "");
    }
  }

  function getMiniAvatarLetter(uid) {
    const s = String(uid || "").trim();
    return s ? s.slice(0, 2).toUpperCase() : "JC";
  }

  function renderPostCard(post, meta = {}) {
    const likes = Number(meta.likes || 0);
    const comments = Number(meta.comments || 0);
    const likedByMe = !!meta.likedByMe;

    const when = fmtDate(post.created_at);
    const title = safeText(post.titulo);
    const content = safeText(post.contenido);

    // Botón like (si no es miembro, queda “bloqueado”)
    const canInteract = isLogged() && isMember();

    return `
      <article class="jc-card-mini comu-post" data-post-id="${post.id}">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px">
          <div style="display:flex; gap:10px; min-width:0">
            <div class="comu-avatar" aria-hidden="true"
                 style="width:34px;height:34px;border-radius:999px;display:grid;place-items:center;
                        background:rgba(255,255,255,.08); flex:0 0 auto; font-weight:800;">
              ${getMiniAvatarLetter(post.user_id)}
            </div>
            <div style="min-width:0">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
                <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:520px">${title}</strong>
                <span class="badge badge-mix">${safeText(post.cat)}</span>
              </div>
              <div class="muted small" style="margin-top:2px">${when}</div>
            </div>
          </div>

          <button class="btn small ghost comu-open" type="button" data-open-post="${post.id}">
            💬 Ver
          </button>
        </div>

        <div class="muted" style="margin-top:10px; white-space:pre-wrap">${content}</div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px">
          <button class="btn small ${likedByMe ? "" : "ghost"} comu-like"
                  type="button"
                  data-like-post="${post.id}"
                  ${canInteract ? "" : 'disabled title="Solo miembros pueden reaccionar"'}
                  aria-label="Reaccionar con corazón">
            ❤️ <span data-like-count="${post.id}">${likes}</span>
          </button>

          <button class="btn small ghost comu-open"
                  type="button"
                  data-open-post="${post.id}"
                  aria-label="Abrir comentarios">
            💬 <span data-comment-count="${post.id}">${comments}</span>
          </button>

          ${!canInteract ? `<span class="muted small">🔒 Interacción solo miembros</span>` : ``}
        </div>
      </article>
    `;
  }

  // ============================================================
  // FEED (Supabase real)
  // ============================================================
  async function cargarFeed({ force = false } = {}) {
    const r = refs();
    if (!r.list) return;

    // Cached, si no forzamos
    if (!force && st.feedCache.has(st.cat)) {
      r.list.innerHTML = st.feedCache.get(st.cat);
      bindPostCardActions(); // por si el DOM se recreó
      return;
    }

    r.list.innerHTML = `<div class="muted small">Cargando publicaciones…</div>`;

    try {
      const posts = await sbFetchPosts(st.cat, 30);
      const postIds = posts.map((p) => p.id);

      // likes + mi like
      let likesRows = [];
      try {
        likesRows = await sbFetchLikesForPosts(postIds);
      } catch (e) {
        // Si tu policy de likes select no está, no reventamos
        console.warn("[comunidad] likes fetch warn", e);
        likesRows = [];
      }

      const likesCount = new Map(); // post_id -> count
      const likedByMe = new Set(); // post_id liked by current user
      const uid = await getUserId();

      likesRows.forEach((row) => {
        likesCount.set(row.post_id, (likesCount.get(row.post_id) || 0) + 1);
        if (uid && row.user_id === uid) likedByMe.add(row.post_id);
      });

      // comments count (simple: no contamos con query agregada para no depender de RPC)
      // En vez de 30 queries, lo dejamos en 0 y se actualiza al abrir modal.
      // Si quieres contadores exactos, lo hacemos con view/RPC luego.
      const html = posts.length
        ? posts
            .map((p) =>
              renderPostCard(p, {
                likes: likesCount.get(p.id) || 0,
                comments: 0,
                likedByMe: likedByMe.has(p.id),
              })
            )
            .join("")
        : `<div class="muted small">Aún no hay publicaciones en <b>${safeText(st.cat)}</b>. Sé el primero 💙💗</div>`;

      r.list.innerHTML = html;
      st.feedCache.set(st.cat, html);
      bindPostCardActions();
    } catch (e) {
      console.error("[comunidad] cargarFeed error", e);
      r.list.innerHTML = `<div class="muted small">❌ No se pudo cargar el feed: ${safeText(e?.message || e)}</div>`;
    }
  }

  // ============================================================
  // PUBLICAR (solo miembros) — Supabase
  // ============================================================
  async function publicar() {
    const r = refs();
    if (!r.estado) return;

    if (!isLogged()) {
      r.estado.textContent = "🔑 Inicia sesión para publicar.";
      return;
    }
    if (!isMember()) {
      r.estado.textContent = "🔒 Completa tu perfil para publicar.";
      return;
    }

    const t = String(r.titulo?.value || "").trim();
    const c = String(r.contenido?.value || "").trim();

    if (!t || !c) {
      r.estado.textContent = "Completa título y contenido.";
      return;
    }

    try {
      r.estado.textContent = "Publicando…";
      await sbCreatePost({ cat: st.cat, titulo: t, contenido: c });

      r.estado.textContent = "✅ Publicado.";
      try {
        window.logAviso?.({ title: "Comunidad", body: `Nueva publicación: ${t}` });
        window.miaSetEstado?.("apoyo");
      } catch {}

      if (r.titulo) r.titulo.value = "";
      if (r.contenido) r.contenido.value = "";

      st.feedCache.delete(st.cat); // invalidate
      await cargarFeed({ force: true });
    } catch (e) {
      console.error("[comunidad] publicar error", e);
      r.estado.textContent = `❌ No se pudo publicar: ${safeText(e?.message || "RLS/permisos")}`;
      try { window.angieSetEstado?.("confundida"); } catch {}
    }
  }

  // ============================================================
  // MODAL COMENTARIOS (Supabase real)
  // ============================================================
  async function renderComments(postId) {
    const r = refs();
    if (!r.commentsList) return;

    r.commentsList.innerHTML = `<div class="muted small">Cargando comentarios…</div>`;

    try {
      const comments = await sbFetchComments(postId, 80);

      r.commentsList.innerHTML = comments.length
        ? comments
            .map((c) => {
              const when = fmtDate(c.created_at);
              return `
                <div class="jc-card-mini" style="margin-bottom:10px">
                  <div class="muted small">${when}</div>
                  <div style="white-space:pre-wrap">${safeText(c.contenido)}</div>
                </div>
              `;
            })
            .join("")
        : `<div class="muted small">Aún no hay comentarios. Sé el primero 🙌</div>`;
    } catch (e) {
      console.error("[comunidad] load comments error", e);
      r.commentsList.innerHTML = `<div class="muted small">❌ No se pudieron cargar comentarios: ${safeText(e?.message || e)}</div>`;
    }
  }

  function openModal(postId, title = "Comentarios", meta = "—") {
    const r = refs();
    if (!r.modal) return;

    st.openPostId = postId || null;

    if (r.modalTitle) r.modalTitle.textContent = title;
    if (r.modalMeta) r.modalMeta.textContent = meta;

    // Gate comentar
    if (isLogged() && isMember()) {
      if (r.commentComposer) r.commentComposer.style.display = "block";
      if (r.commentGate) r.commentGate.style.display = "none";
    } else {
      if (r.commentComposer) r.commentComposer.style.display = "none";
      if (r.commentGate) {
        r.commentGate.style.display = "block";
        r.commentGate.textContent = !isLogged()
          ? "🔑 Inicia sesión para comentar."
          : "🔒 Completa tu perfil para comentar.";
      }
    }

    r.modal.style.display = "flex";
    r.modal.classList.add("show");

    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.comuOpen = true;
      window.jcSyncOverlay?.();
    } catch {}

    // cargar comentarios real
    renderComments(postId);
  }

  function closeModal() {
    const r = refs();
    if (!r.modal) return;

    r.modal.classList.remove("show");
    r.modal.style.display = "none";
    st.openPostId = null;

    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.comuOpen = false;
      window.jcSyncOverlay?.();
    } catch {}
  }

  async function comentar() {
    const r = refs();
    if (!r.commentEstado) return;

    if (!isLogged()) {
      r.commentEstado.textContent = "🔑 Inicia sesión primero.";
      return;
    }
    if (!isMember()) {
      r.commentEstado.textContent = "🔒 Completa tu perfil para comentar.";
      return;
    }

    const postId = st.openPostId;
    if (!postId) {
      r.commentEstado.textContent = "No hay publicación seleccionada.";
      return;
    }

    const txt = String(r.commentText?.value || "").trim();
    if (!txt) {
      r.commentEstado.textContent = "Escribe un comentario.";
      return;
    }

    try {
      r.commentEstado.textContent = "Enviando…";
      await sbCreateComment({ postId, contenido: txt });

      r.commentEstado.textContent = "✅ Comentario enviado.";
      if (r.commentText) r.commentText.value = "";

      await renderComments(postId);
    } catch (e) {
      console.error("[comunidad] comentar error", e);
      r.commentEstado.textContent = `❌ No se pudo comentar: ${safeText(e?.message || "RLS/permisos")}`;
    }
  }

  // ============================================================
  // Likes (❤️)
  // ============================================================
  async function toggleLike(postId) {
    if (!postId) return;

    if (!isLogged()) {
      window.logAviso?.({ title: "Comunidad", body: "Inicia sesión para reaccionar ❤️" });
      return;
    }
    if (!isMember()) {
      window.logAviso?.({ title: "Comunidad", body: "Completa tu perfil para reaccionar ❤️" });
      return;
    }

    const btn = document.querySelector(`[data-like-post="${postId}"]`);
    const countEl = document.querySelector(`[data-like-count="${postId}"]`);

    // UI optimistic
    let current = 0;
    try { current = parseInt(countEl?.textContent || "0", 10) || 0; } catch {}
    const wasLiked = btn?.classList.contains("btn") && !btn?.classList.contains("ghost");

    try {
      if (wasLiked) {
        // unlike
        if (btn) btn.classList.add("ghost");
        if (countEl) countEl.textContent = String(Math.max(0, current - 1));
        await sbUnlike(postId);
      } else {
        // like
        if (btn) btn.classList.remove("ghost");
        if (countEl) countEl.textContent = String(current + 1);
        await sbLike(postId);
      }

      // invalida cache para que al refrescar esté ok
      st.feedCache.delete(st.cat);
    } catch (e) {
      console.error("[comunidad] like toggle error", e);
      // revert UI si falla
      try {
        if (wasLiked) {
          if (btn) btn.classList.remove("ghost");
          if (countEl) countEl.textContent = String(current);
        } else {
          if (btn) btn.classList.add("ghost");
          if (countEl) countEl.textContent = String(current);
        }
      } catch {}
      window.logAviso?.({ title: "Comunidad", body: `No se pudo reaccionar: ${safeText(e?.message || e)}` });
    }
  }

  // ============================================================
  // Bind handlers de cards (se llama tras render)
  // ============================================================
  function bindPostCardActions() {
    const root = refs().list;
    if (!root) return;

    // open modal
    root.querySelectorAll("[data-open-post]").forEach((btn) => {
      if (btn.__jcBound) return;
      btn.__jcBound = true;
      btn.addEventListener("click", () => {
        const postId = parseInt(btn.getAttribute("data-open-post"), 10);
        if (!postId) return;
        openModal(postId, "Comentarios", `Post #${postId}`);
      });
    });

    // like
    root.querySelectorAll("[data-like-post]").forEach((btn) => {
      if (btn.__jcBound) return;
      btn.__jcBound = true;
      btn.addEventListener("click", () => {
        const postId = parseInt(btn.getAttribute("data-like-post"), 10);
        toggleLike(postId);
      });
    });
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
        st.feedCache.delete(st.cat);
        await cargarFeed({ force: true });
      });
    });

    r.formPost?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await publicar();
    });

    r.btnClear?.addEventListener("click", () => {
      const rr = refs();
      if (rr.titulo) rr.titulo.value = "";
      if (rr.contenido) rr.contenido.value = "";
      if (rr.estado) rr.estado.textContent = "";
    });

    r.btnRefresh?.addEventListener("click", () => {
      st.feedCache.delete(st.cat);
      cargarFeed({ force: true });
    });

    r.modalClose?.addEventListener("click", closeModal);
    r.modal?.addEventListener("click", (e) => {
      if (e.target === r.modal) closeModal();
    });

    r.formComment?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await comentar();
    });

    r.btnCommentClear?.addEventListener("click", () => {
      const rr = refs();
      if (rr.commentText) rr.commentText.value = "";
      if (rr.commentEstado) rr.commentEstado.textContent = "";
    });

    // ✅ Exponer compat que main.js/auth.js llaman
    window.jcComunidad = window.jcComunidad || {};
    window.jcComunidad.cargarFeed = cargarFeed;
    window.jcComunidad.refreshAuthAndMiembro = async () => {
      setGate();
      st.feedCache.delete(st.cat);
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
      st.feedCache.delete(st.cat);
      cargarFeed({ force: true });
    });

    // Recalcular gates si cambia auth (por si profile aún no emite)
    JC.on("auth:changed", () => {
      setGate();
      st.feedCache.delete(st.cat);
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
    closeModal,
  };
})();