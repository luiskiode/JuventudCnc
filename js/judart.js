// js/judart.js
// Judart — Galería + Subir (imagen/video/link) + Retos
// ✅ Soporta VIDEO (mp4/webm) además de imágenes y links
// ✅ Storage bucket: "judart" (public recomendado)
// ✅ Robusto: tolera tablas con nombres distintos (jud_posts / judart_posts) y columnas variantes
// ✅ Gate: solo miembros pueden subir y reaccionar (RLS lo refuerza)
// ✅ Exports: window.jcJudart.refreshAuthAndMiembro / refresh / init

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

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

  // =========================
  // Config
  // =========================
  const BUCKET = "judart";
  const TABLE_CANDIDATES = ["jud_posts", "judart_posts", "judart"]; // intenta en este orden

  // límites razonables para cel básico
  const MAX_IMAGE_MB = 10;
  const MAX_VIDEO_MB = 45;

  function refs() {
    return {
      gateBadge: $("#judGateBadge"),
      gate: $("#judGate"),

      // tabs
      tabs: $$(".comu-tab[data-jud-tab]"),
      panelGaleria: $("#judPanelGaleria"),
      panelSubir: $("#judPanelSubir"),
      panelRetos: $("#judPanelRetos"),

      // galería
      search: $("#judSearch"),
      refresh: $("#judRefresh"),
      list: $("#judList"),

      // form subir
      form: $("#judForm"),
      titulo: $("#judTitulo"),
      desc: $("#judDesc"),
      mediaType: $("#judMediaType"),
      url: $("#judUrl"),
      file: $("#judFile"),
      btnClear: $("#judClear"),
      estado: $("#judEstado"),

      // modal
      modal: $("#judModal"),
      modalClose: $("#judModalClose"),
      modalTitle: $("#judModalTitle"),
      modalMeta: $("#judModalMeta"),
      modalMedia: $("#judModalMedia"),
      modalDesc: $("#judModalDesc"),
    };
  }

  const st = {
    bound: false,
    tab: "galeria",
    table: null,           // detectada
    rows: [],
    open: null,            // row actual en modal
    cacheTs: 0,
  };

  function safeText(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isLogged() {
    return !!(JC.state.user || window.currentUser);
  }
  function isMember() {
    return !!JC.state.isMember;
  }

  async function getUser() {
    const u = JC.state.user || window.currentUser || null;
    if (u?.id) return u;
    const sb = getSB();
    if (!sb?.auth?.getUser) return null;
    try {
      const { data } = await sb.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  function setGateUI() {
    const r = refs();
    if (!r.gate) return;

    if (!isLogged()) {
      r.gate.textContent = "👀 Puedes ver Judart. 🔑 Inicia sesión para subir y reaccionar ❤️";
      if (r.gateBadge) r.gateBadge.textContent = "👀 Lectura pública";
      return;
    }
    if (!isMember()) {
      r.gate.textContent = "👀 Puedes ver. 🔒 Completa tu perfil para subir y reaccionar ❤️";
      if (r.gateBadge) r.gateBadge.textContent = "🔒 Solo miembros";
      return;
    }
    r.gate.textContent = "✅ Miembro activo: puedes subir imágenes, videos y links 🎨";
    if (r.gateBadge) r.gateBadge.textContent = "✅ Miembros";
  }

  // =========================
  // Tabs (galeria/subir/retos)
  // =========================
  function setActiveTab(tab) {
    st.tab = (tab || "galeria").toString();
    const r = refs();

    r.tabs.forEach((b) => {
      const on = b.dataset.judTab === st.tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (r.panelGaleria) r.panelGaleria.style.display = st.tab === "galeria" ? "" : "none";
    if (r.panelSubir) r.panelSubir.style.display = st.tab === "subir" ? "" : "none";
    if (r.panelRetos) r.panelRetos.style.display = st.tab === "retos" ? "" : "none";
  }

  // =========================
  // DB helpers (tabla flexible)
  // =========================
  async function detectTableOnce() {
    if (st.table) return st.table;

    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    // probamos selects simples para detectar nombre correcto
    for (const t of TABLE_CANDIDATES) {
      try {
        const q = await sb.from(t).select("*").limit(1);
        if (!q.error) {
          st.table = t;
          return t;
        }
      } catch {}
    }

    // si no existe ninguna, devolvemos la primera (para que el error sea claro)
    st.table = TABLE_CANDIDATES[0];
    return st.table;
  }

  // Mapea posibles nombres de columnas que hemos visto en proyectos
  function normalizeRow(row) {
    const mediaType = row.media_type ?? row.tipo ?? row.type ?? "image";
    const mediaUrl = row.media_url ?? row.url ?? row.media ?? row.archivo_url ?? row.file_url ?? null;
    const mime = row.mime ?? row.media_mime ?? row.content_type ?? null;

    return {
      _raw: row,
      id: row.id ?? row.post_id ?? row.uuid ?? null,
      created_at: row.created_at ?? row.fecha ?? row.created ?? null,
      user_id: row.user_id ?? row.uid ?? row.autor_id ?? null,
      titulo: row.titulo ?? row.title ?? "Judart",
      descripcion: row.descripcion ?? row.desc ?? row.detalle ?? row.contenido ?? "",
      media_type: String(mediaType || "image"),
      media_url: mediaUrl,
      mime: mime,
      autor: row.autor ?? row.autor_email ?? row.email ?? null,
    };
  }

async function fetchPosts() {
  const sb = getSB();
  if (!sb) throw new Error("Supabase no disponible");

  const table = await detectTableOnce();

  // ✅ En celular baja el límite para no matar memoria/render (videos/iframes)
  const isMobile =
    (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 560px)").matches) ||
    (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""));

  const limit = isMobile ? 60 : 200;

  // Pedimos * para ser tolerantes con esquemas
  const q = await sb
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q.error) throw q.error;

  const rows = (q.data || []).map(normalizeRow);
  st.rows = rows;
  st.cacheTs = Date.now();
  return rows;
}

  // Inserción tolerante: intentamos payloads con columnas alternativas
  async function insertPost({ user, titulo, descripcion, media_type, media_url, mime }) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    const table = await detectTableOnce();

    const payloads = [
      // schema recomendado
      {
        user_id: user.id,
        titulo,
        descripcion,
        media_type,
        media_url,
        mime,
      },
      // variantes comunes
      {
        user_id: user.id,
        titulo,
        desc: descripcion,
        media_type,
        media_url,
        mime,
      },
      {
        user_id: user.id,
        titulo,
        contenido: descripcion,
        media_type,
        media_url,
        mime,
      },
      {
        uid: user.id,
        titulo,
        descripcion,
        tipo: media_type,
        url: media_url,
        mime,
      },
    ];

    let lastErr = null;

    for (const payload of payloads) {
      try {
        const q = await sb.from(table).insert(payload).select("*").limit(1);
        if (!q.error) return q.data?.[0] || null;
        lastErr = q.error;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("No se pudo insertar post Judart");
  }

  // =========================
  // Storage upload (image/video)
  // =========================
  function mb(n) {
    return (n / (1024 * 1024));
  }

  function guessExt(file) {
    const name = (file?.name || "").toLowerCase();
    const m = name.match(/\.([a-z0-9]+)$/);
    const ext = (m?.[1] || "").toLowerCase();

    if (ext) return ext;

    const t = (file?.type || "").toLowerCase();
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
    if (t.includes("mp4")) return "mp4";
    if (t.includes("webm")) return "webm";
    return "bin";
  }

  async function uploadToStorage({ user, file, kind }) {
    const sb = getSB();
    if (!sb?.storage) throw new Error("Storage no disponible");

    const sizeMb = mb(file.size);
    if (kind === "image" && sizeMb > MAX_IMAGE_MB) {
      throw new Error(`Imagen demasiado grande (${sizeMb.toFixed(1)}MB). Máx: ${MAX_IMAGE_MB}MB`);
    }
    if (kind === "video" && sizeMb > MAX_VIDEO_MB) {
      throw new Error(`Video demasiado grande (${sizeMb.toFixed(1)}MB). Máx: ${MAX_VIDEO_MB}MB`);
    }

    const ext = guessExt(file);
    const safeName = String(file.name || `file.${ext}`).replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${Date.now()}_${safeName}`;

    const up = await sb.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });

    if (up.error) throw up.error;

    const pub = sb.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.data?.publicUrl || null;
    if (!publicUrl) throw new Error("No se pudo obtener URL pública");

    return { publicUrl, mime: file.type || null, path };
  }

  // =========================
  // Render
  // =========================
  function isYouTube(url) {
    const u = String(url || "");
    return u.includes("youtube.com/watch") || u.includes("youtu.be/");
  }

  function toYouTubeEmbed(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.replace("/", "");
        return `https://www.youtube.com/embed/${id}`;
      }
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      return url;
    } catch {
      return url;
    }
  }

function renderMediaList(row) {
  const t = (row.media_type || "image").toLowerCase();
  const url = row.media_url;

  // ✅ LISTA: NUNCA <video> (evita crash en celular)
  if (t === "video" && url) {
    return `
      <div class="muted small" style="padding:12px;border-radius:14px;background:rgba(0,0,0,.25)">
        🎬 Video listo. Toca <strong>Ver</strong> para abrirlo.
      </div>
    `;
  }

  // Imagen sí (liviana)
  if (t === "image" && url) {
    return `
      <img src="${safeText(url)}" alt="Arte"
           style="width:100%; border-radius:14px; display:block; object-fit:cover"
           loading="lazy" />
    `;
  }

  // Link igual que antes (YouTube embed es pesado; mejor también en modal, pero lo dejamos)
  if ((t === "link" || t === "url") && url) {
    if (isYouTube(url)) {
      return `
        <div class="muted small" style="padding:12px;border-radius:14px;background:rgba(0,0,0,.25)">
          ▶️ YouTube. Toca <strong>Ver</strong> para abrir.
        </div>
      `;
    }
    return `<a class="link" href="${safeText(url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`;
  }

  return `<div class="muted small">Sin media</div>`;
}

function renderMediaModal(row) {
  const t = (row.media_type || "image").toLowerCase();
  const url = row.media_url;

  if (t === "video" && url) {
    const type = row.mime || "video/mp4";
    // ✅ cache-bust para evitar 304/caché raro en Android
    const bust = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    return `
      <video controls playsinline preload="metadata"
             style="width:100%; border-radius:14px; background:#000; display:block">
        <source src="${safeText(bust)}" type="${safeText(type)}">
      </video>
    `;
  }

  if (t === "image" && url) {
    return `
      <img src="${safeText(url)}" alt="Arte"
           style="width:100%; border-radius:14px; display:block; object-fit:cover" loading="lazy" />
    `;
  }

  if ((t === "link" || t === "url") && url) {
    if (isYouTube(url)) {
      const embed = toYouTubeEmbed(url);
      return `
        <div style="position:relative; width:100%; padding-top:56.25%; border-radius:14px; overflow:hidden; background:#000">
          <iframe src="${safeText(embed)}"
                  title="Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                  style="position:absolute; inset:0; width:100%; height:100%; border:0"></iframe>
        </div>
      `;
    }
    return `<a class="link" href="${safeText(url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`;
  }

  return `<div class="muted small">Sin media</div>`;
}


  function card(row) {
    const when = row.created_at ? new Date(row.created_at).toLocaleString("es-PE") : "";
    const title = safeText(row.titulo || "Judart");
    const desc = safeText(row.descripcion || "");
    const typeBadge =
      (row.media_type || "image").toLowerCase() === "video" ? "🎬 Video" :
      (row.media_type || "image").toLowerCase() === "link" ? "🔗 Link" : "🖼️ Imagen";

    return `
      <article class="jc-card-mini" style="padding:12px">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px">
          <div style="min-width:0">
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
              <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:520px">${title}</strong>
              <span class="badge badge-mix">${typeBadge}</span>
            </div>
            <div class="muted small" style="margin-top:4px">${safeText(when)}</div>
          </div>
          <button class="btn small ghost" type="button" data-jud-open="${safeText(row.id)}">Ver</button>
        </div>

        <div style="margin-top:10px">${renderMediaList(row)}</div>

        ${desc ? `<div class="muted small" style="margin-top:10px; white-space:pre-wrap">${desc}</div>` : ``}
      </article>
    `;
  }

  function applySearch(rows) {
    const r = refs();
    const q = String(r.search?.value || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((x) => {
      const t = String(x.titulo || "").toLowerCase();
      const d = String(x.descripcion || "").toLowerCase();
      const u = String(x.media_url || "").toLowerCase();
      return t.includes(q) || d.includes(q) || u.includes(q);
    });
  }

  function bindCards() {
    const r = refs();
    if (!r.list) return;

    r.list.querySelectorAll("[data-jud-open]").forEach((btn) => {
      if (btn.__jcBound) return;
      btn.__jcBound = true;

      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-jud-open");
        const row = st.rows.find((x) => String(x.id) === String(id));
        if (!row) return;
        openModal(row);
      });
    });
  }

  async function renderList({ force = false } = {}) {
    const r = refs();
    if (!r.list) return;

    try {
      if (force || !st.rows.length) {
        r.list.innerHTML = `<div class="muted small">Cargando galería…</div>`;
        await fetchPosts();
      }

      const rows = applySearch(st.rows);
      r.list.innerHTML = rows.length
        ? rows.map(card).join("")
        : `<div class="muted small">No hay resultados.</div>`;

      bindCards();
    } catch (e) {
      console.error("[judart] renderList error", e);
      r.list.innerHTML = `<div class="muted small">❌ No se pudo cargar Judart: ${safeText(e?.message || e)}</div>`;
    }
  }

  // =========================
  // Modal
  // =========================
  function openModal(row) {
    const r = refs();
    if (!r.modal) return;

    st.open = row;

    if (r.modalTitle) r.modalTitle.textContent = row.titulo || "Judart";
    if (r.modalMeta) {
      const when = row.created_at ? new Date(row.created_at).toLocaleString("es-PE") : "";
      r.modalMeta.textContent = when ? `Publicado: ${when}` : "—";
    }
    if (r.modalMedia) r.modalMedia.innerHTML = renderMediaModal(row);
    if (r.modalDesc) r.modalDesc.textContent = row.descripcion || "";

    r.modal.style.display = "flex";
    r.modal.classList.add("show");

    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.judOpen = true;
      window.jcSyncOverlay?.();
    } catch {}
  }

  function closeModal() {
    const r = refs();
    if (!r.modal) return;

    r.modal.classList.remove("show");
    r.modal.style.display = "none";
    st.open = null;

    try {
      JC.uiState = JC.uiState || {};
      JC.uiState.judOpen = false;
      window.jcSyncOverlay?.();
    } catch {}
  }

  // =========================
  // Form UI: media type
  // =========================
  function syncMediaInputs() {
    const r = refs();
    const t = String(r.mediaType?.value || "image");

    // si no existe judUrl/judFile, no hacemos nada
    if (r.url) r.url.style.display = t === "link" ? "" : "none";
    if (r.file) r.file.style.display = t === "link" ? "none" : "";

    // accept dinámico
    if (r.file) {
      if (t === "video") r.file.setAttribute("accept", "video/*");
      else if (t === "image") r.file.setAttribute("accept", "image/*");
      else r.file.setAttribute("accept", "image/*,video/*");
    }
  }

  // =========================
  // Publicar (subir)
  // =========================
  async function publicarJudart() {
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

    const user = await getUser();
    if (!user) {
      r.estado.textContent = "🔑 Sesión no disponible.";
      return;
    }

    const titulo = String(r.titulo?.value || "").trim();
    const descripcion = String(r.desc?.value || "").trim();
    const mediaType = String(r.mediaType?.value || "image").trim();

    if (!titulo) {
      r.estado.textContent = "Escribe un título.";
      return;
    }

    let media_url = null;
    let mime = null;

    try {
      r.estado.textContent = "Publicando…";

      if (mediaType === "link") {
        const url = String(r.url?.value || "").trim();
        if (!url) {
          r.estado.textContent = "Pega un link (URL).";
          return;
        }
        media_url = url;
        mime = null;
      } else {
        const file = r.file?.files?.[0] || null;
        if (!file) {
          r.estado.textContent = mediaType === "video" ? "Selecciona un video." : "Selecciona una imagen.";
          return;
        }

        const kind = mediaType === "video" ? "video" : "image";

        // filtros básicos para videos
        if (kind === "video") {
          const t = (file.type || "").toLowerCase();
          if (!(t.includes("mp4") || t.includes("webm") || t.startsWith("video/"))) {
            r.estado.textContent = "Video no compatible. Usa MP4 o WebM.";
            return;
          }
        }

        const up = await uploadToStorage({ user, file, kind });
        media_url = up.publicUrl;
        mime = up.mime;
      }

      const inserted = await insertPost({
        user,
        titulo,
        descripcion,
        media_type: mediaType,
        media_url,
        mime,
      });

      r.estado.textContent = "✅ Publicado.";
      try {
        window.logAviso?.({ title: "Judart", body: `Nuevo post: ${titulo}` });
        window.miaSetEstado?.("apoyo");
      } catch {}

      // limpiar form
      if (r.titulo) r.titulo.value = "";
      if (r.desc) r.desc.value = "";
      if (r.url) r.url.value = "";
      if (r.file) {
        try { r.file.value = ""; } catch {}
      }

      // refrescar lista y volver a galería
      st.rows = [];
      await renderList({ force: true });
      setActiveTab("galeria");

      return inserted;
    } catch (e) {
      console.error("[judart] publicar error", e);
      r.estado.textContent = `❌ No se pudo publicar: ${safeText(e?.message || "RLS/permisos/storage")}`;
      try { window.angieSetEstado?.("confundida"); } catch {}
      return null;
    }
  }

  // =========================
  // Refresh auth + miembro
  // =========================
  async function refreshAuthAndMiembro() {
    setGateUI();
    // no forzamos recarga siempre, solo si ya hay lista render
    if (st.tab === "galeria") {
      await renderList({ force: true });
    }
  }

  // =========================
  // Bind UI
  // =========================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    // tabs
    r.tabs.forEach((b) => {
      b.addEventListener("click", () => {
        setActiveTab(b.dataset.judTab);
        if (st.tab === "galeria") renderList({ force: true });
      });
    });

    // search
    r.search?.addEventListener("input", () => {
      renderList({ force: false });
    });

    // refresh
    r.refresh?.addEventListener("click", () => renderList({ force: true }));

    // modal
    r.modalClose?.addEventListener("click", closeModal);
    r.modal?.addEventListener("click", (e) => {
      if (e.target === r.modal) closeModal();
    });

    // media type UI
    r.mediaType?.addEventListener("change", syncMediaInputs);

    // clear form
    r.btnClear?.addEventListener("click", () => {
      const rr = refs();
      if (rr.titulo) rr.titulo.value = "";
      if (rr.desc) rr.desc.value = "";
      if (rr.url) rr.url.value = "";
      if (rr.file) {
        try { rr.file.value = ""; } catch {}
      }
      if (rr.estado) rr.estado.textContent = "";
    });

    // submit
    r.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      publicarJudart();
    });

    // Expose compat API
    window.jcJudart = window.jcJudart || {};
    window.jcJudart.init = init;
    window.jcJudart.refresh = renderList;
    window.jcJudart.refreshAuthAndMiembro = refreshAuthAndMiembro;
    window.jcJudart.openModal = openModal;
    window.jcJudart.closeModal = closeModal;
  }

  // =========================
  // Init
  // =========================
  async function init() {
    bindUI();

    // Gates reaccionan a perfil/auth
    JC.on("profile:changed", () => refreshAuthAndMiembro());
    JC.on("auth:changed", () => refreshAuthAndMiembro());

    setGateUI();
    syncMediaInputs();
    setActiveTab("galeria");
    await renderList({ force: true });

    return true;
  }

  JC.judart = { init, refresh: renderList, refreshAuthAndMiembro };
})();