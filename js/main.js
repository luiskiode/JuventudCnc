// js/main.js
// Router + arranque de módulos (robusto) — compatible con tu index y con ui.js modular
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // Selectores seguros
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  JC.$ = JC.$ || $;
  JC.$$ = JC.$$ || $$;

  // ============================================================
  // Service Worker registration + update (PWA) — GitHub Pages OK
  // - Scope correcto para /JuventudCnc/
  // - Evita loops de reload
  // ============================================================
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    // ✅ En GitHub Pages, usa ruta absoluta dentro del repo
    const basePath = "/JuventudCnc/";
    const swUrl = `${basePath}service-worker.js`;

    try {
      const reg = await navigator.serviceWorker.register(swUrl, { scope: basePath });

      // Si hay uno esperando, forzamos activación
      if (reg.waiting) {
        try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
      }

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;

        sw.addEventListener("statechange", () => {
          // cuando instala y ya había controller => hay update listo
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            try { reg.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
          }
        });
      });

      // Evita reload múltiple
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        setTimeout(() => {
          try { location.reload(); } catch {}
        }, 120);
      });
    } catch (e) {
      console.warn("[JC] SW register error", e);
    }
  }

  // ============================================================
  // Mensaje semanal (robusto + fallback)
  // ============================================================
  async function loadMensajeSemanal() {
    const titleEl = document.getElementById("msgTitle");
    const bodyEl = document.getElementById("msgBody");
    const metaEl = document.getElementById("msgMeta");
    if (!titleEl && !bodyEl && !metaEl) return;

    if (titleEl) titleEl.textContent = "Cargando mensaje...";
    if (bodyEl) bodyEl.textContent = "Un momento…";
    if (metaEl) metaEl.textContent = "";

    const sb = window.sb || window.supabaseClient;
    if (!sb) {
      if (titleEl) titleEl.textContent = "Mensaje semanal";
      if (bodyEl) bodyEl.textContent = "⚠️ No hay conexión a Supabase (cliente no cargado).";
      return;
    }

    try {
      // Preferimos publicado_at; si es null, fallback por id
      const q = await sb
        .from("mensaje_semanal")
        .select("id, semana_start, titulo, contenido, autor, publicado_at")
        .order("publicado_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (q.error) throw q.error;

      if (!q.data) {
        const q2 = await sb
          .from("mensaje_semanal")
          .select("id, semana_start, titulo, contenido, autor, publicado_at")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (q2.error) throw q2.error;
        render(q2.data);
        return;
      }

      render(q.data);
    } catch (e) {
      console.warn("[JC] mensaje_semanal error:", e);
      if (titleEl) titleEl.textContent = "Mensaje semanal";
      if (bodyEl) bodyEl.textContent = "⚠️ No se pudo cargar el mensaje. (Revisa RLS o permisos).";
      if (metaEl) metaEl.textContent = "";
    }

    function render(row) {
      if (!row) {
        if (titleEl) titleEl.textContent = "Mensaje semanal";
        if (bodyEl) bodyEl.textContent = "Aún no hay mensaje publicado.";
        if (metaEl) metaEl.textContent = "";
        return;
      }

      const titulo = row.titulo || "Mensaje semanal";
      const cuerpo = row.contenido || "—";

      const parts = [];
      if (row.autor) parts.push(`Autor: ${row.autor}`);

      if (row.publicado_at) {
        try {
          const d = new Date(row.publicado_at);
          if (!isNaN(d.getTime())) parts.push(`Publicado: ${d.toLocaleString("es-PE")}`);
        } catch {}
      } else if (row.semana_start) {
        parts.push(`Semana: ${row.semana_start}`);
      }

      if (titleEl) titleEl.textContent = String(titulo);
      if (bodyEl) bodyEl.textContent = String(cuerpo);
      if (metaEl) metaEl.textContent = parts.join(" · ");
    }
  }

  // ============================================================
  // Tabs helpers
  // ============================================================
  function normalizeTab(t) {
    t = (t || "").trim();
    if (!t) return "inicio";
    return t.replace(/^#/, "");
  }

  function ensureValidTab(tab) {
    const exists = !!document.querySelector(`.view[data-view="${tab}"]`);
    return exists ? tab : "inicio";
  }

  function getTabFromURL() {
    try {
      const u = new URL(location.href);
      const q = (u.searchParams.get("tab") || "").trim();
      if (q) return normalizeTab(q);
      return normalizeTab(location.hash || "#inicio");
    } catch {
      return normalizeTab(location.hash || "#inicio");
    }
  }

  function setActiveUI(tab) {
    tab = ensureValidTab(tab);

    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === tab));

    $$(".tabs .tab").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });

    $$("#drawer [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }

  // ============================================================
  // View hooks (corregido para tus nombres reales + evitar crash)
  // - resources.js expone listarRecursos / JC.resources.initCatefa() / refresh()
  // - events.js/community.js pueden tener nombres distintos => probamos varios
  // ============================================================
  async function runViewHooks(tab) {
    try {
      if (tab === "inicio") loadMensajeSemanal();

      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
      if (tab === "miembros-activos") window.initMiembrosView?.();

      if (tab === "box") {
        // algunos builds montan chat grande aquí
        JC.bots?.mountBox?.();
        window.jcBots?.mountBox?.();
      }

      if (tab === "eventos") {
        // nombres alternativos
        await (JC.events?.cargarEventos?.({ force: true })
          || window.jcEventos?.cargarEventos?.({ force: true })
          || window.jcEventos?.refresh?.({ force: true }));
      }

      if (tab === "comunidad" || tab === "foro") {
        await (JC.community?.cargarFeed?.({ force: true })
          || window.jcComunidad?.cargarFeed?.({ force: true })
          || window.jcComunidad?.refresh?.({ force: true }));
      }

      if (tab === "recursos") {
        // ✅ aquí fue donde antes se rompía (listarRecursos undefined / refresh signature)
        // resources.js ya define window.listarRecursos = listarRecursos
        if (JC.resources?.initCatefa) await JC.resources.initCatefa();
        else await window.listarRecursos?.("catefa");

        // refresh en tu resources.js no usa params; no le pasamos {force:true}
        if (JC.resources?.refresh) await JC.resources.refresh();
      }

      if (tab === "judart") {
        await (JC.judart?.refresh?.({ force: true }) || window.jcJudart?.refresh?.({ force: true }));
      }
    } catch (e) {
      console.warn("[JC] hook error", tab, e);
    }
  }

  // ============================================================
  // Activate (router)
  // ============================================================
  let __activating = false;

  async function activate(tab, { silentUrl = false } = {}) {
    // Evita re-entradas (hashchange + click)
    if (__activating) return;
    __activating = true;

    tab = ensureValidTab(normalizeTab(tab));

    try { window.jcCloseDrawer?.(); } catch {}

    setActiveUI(tab);

    try { document.body.setAttribute("data-view", tab); } catch {}

    if (!silentUrl) {
      const newHash = `#${tab}`;
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }

      // Si venimos desde auth.html con ?tab=perfil, limpiamos ese query
      try {
        const u = new URL(location.href);
        if (u.searchParams.has("tab")) {
          u.searchParams.delete("tab");
          history.replaceState(null, "", u.toString());
        }
      } catch {}
    }

    await runViewHooks(tab);

    // Bots según vista
    try {
      JC.bots?.segunVista?.(tab);
      window.botsSegunVista?.(tab);
    } catch {}

    // Focus accesible al main (sin romper scroll)
    const main = $("#main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      try { main.focus({ preventScroll: true }); } catch {}
    }

    __activating = false;
  }

  window.activate = activate;
  JC.activate = activate;

  // ============================================================
  // Bind navegación (delegada)
  // ============================================================
  function bindNav() {
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-tab]");
      if (!el) return;

      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;

      const tab = el.getAttribute("data-tab");
      if (!tab) return;

      e.preventDefault();
      activate(tab);
    });
  }

  // ============================================================
  // Init
  // ============================================================
  async function init() {
    registerSW().catch(() => {});

    // UI init
    try {
      if (JC.ui?.init) JC.ui.init();
      else window.jcUI?.initUI?.();
    } catch (e) {
      console.warn("[JC] ui init error", e);
    }

    // Carga el mensaje semanal en background
    loadMensajeSemanal().catch(() => {});

    // Init módulos (robusto)
    try { await JC.auth?.init?.(); } catch (e) { console.warn("[JC] auth init error", e); }
    try { await JC.profile?.init?.(); } catch (e) { console.warn("[JC] profile init error", e); }

    try { JC.bots?.init?.(); } catch (e) { console.warn("[JC] bots init error", e); }
    try { JC.events?.init?.(); } catch (e) { console.warn("[JC] events init error", e); }
    try { JC.resources?.init?.(); } catch (e) { console.warn("[JC] resources init error", e); }
    try { JC.community?.init?.(); } catch (e) { console.warn("[JC] community init error", e); }
    try { JC.judart?.init?.(); } catch (e) { console.warn("[JC] judart init error", e); }

    bindNav();

    const start = ensureValidTab(getTabFromURL());
    await activate(start, { silentUrl: false });

    window.addEventListener("hashchange", () => {
      activate(ensureValidTab(normalizeTab(location.hash)), { silentUrl: true });
    });

    console.log("[JC] Init OK", window.JC_BUILD || "");
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => init().catch((e) => console.error("[JC] init fatal", e)),
      { once: true }
    );
  } else {
    init().catch((e) => console.error("[JC] init fatal", e));
  }
})();