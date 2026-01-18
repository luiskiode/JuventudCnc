// js/main.js
// Router + arranque de módulos (robusto) — compatible con tu index y con ui.js modular
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // Selectores seguros
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  JC.$ = $;
  JC.$$ = $$;

  // ============================================================
  // Service Worker registration + update (PWA)
  // ============================================================
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    const swUrl = "./service-worker.js";

    try {
      const reg = await navigator.serviceWorker.register(swUrl, { scope: "./" });

      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            try {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            } catch {}
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        setTimeout(() => {
          try { location.reload(); } catch {}
        }, 150);
      });
    } catch (e) {
      console.warn("[JC] SW register error", e);
    }
  }

  // ============================================================
  // B) Mensaje semanal (Inicio) — lectura pública
  // ============================================================
  async function loadMensajeSemanal() {
    const titleEl = document.getElementById("msgTitle");
    const bodyEl = document.getElementById("msgBody");
    const metaEl = document.getElementById("msgMeta");

    // Si no existe UI, salimos
    if (!titleEl && !bodyEl && !metaEl) return;

    // Estado inicial
    if (titleEl) titleEl.textContent = "Cargando mensaje...";
    if (bodyEl) bodyEl.textContent = "Un momento…";
    if (metaEl) metaEl.textContent = "";

    const sb = window.sb || window.supabaseClient;
    if (!sb) {
      if (titleEl) titleEl.textContent = "Mensaje semanal";
      if (bodyEl) bodyEl.textContent = "⚠️ No se encontró conexión a Supabase (cliente no cargado).";
      return;
    }

    try {
      // Intento robusto: traer el más reciente
      const q = await sb
        .from("mensaje_semanal")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (q.error) {
        // Si created_at no existe, probamos con otro orden común
        const q2 = await sb
          .from("mensaje_semanal")
          .select("*")
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (q2.error) throw q2.error;

        renderMsg(q2.data);
        return;
      }

      renderMsg(q.data);
    } catch (e) {
      console.warn("[JC] mensaje_semanal error:", e);
      if (titleEl) titleEl.textContent = "Mensaje semanal";
      if (bodyEl) bodyEl.textContent = "⚠️ No se pudo cargar el mensaje. (Revisa RLS o estructura de tabla).";
      if (metaEl) metaEl.textContent = "";
    }

    function renderMsg(row) {
      if (!row) {
        if (titleEl) titleEl.textContent = "Mensaje semanal";
        if (bodyEl) bodyEl.textContent = "Aún no hay mensaje publicado.";
        if (metaEl) metaEl.textContent = "";
        return;
      }

      // Campos flexibles (por si varían)
      const titulo =
        row.titulo ?? row.title ?? row.encabezado ?? "Mensaje semanal";
      const cuerpo =
        row.cuerpo ?? row.body ?? row.mensaje ?? row.contenido ?? "—";

      const fechaRaw =
        row.created_at ?? row.creado_en ?? row.fecha ?? row.updated_at ?? null;

      let meta = "";
      if (fechaRaw) {
        try {
          const d = new Date(fechaRaw);
          meta = isNaN(d.getTime()) ? "" : `Publicado: ${d.toLocaleString("es-PE")}`;
        } catch {}
      }

      if (titleEl) titleEl.textContent = String(titulo);
      if (bodyEl) bodyEl.textContent = String(cuerpo);
      if (metaEl) metaEl.textContent = meta;
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

    $$(".view").forEach((v) => {
      const k = v.dataset.view;
      v.classList.toggle("active", k === tab);
    });

    $$(".tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
      b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false");
    });

    $$("#drawer [data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    const main = $("#main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      try { main.focus({ preventScroll: true }); } catch {}
    }
  }

  async function runViewHooks(tab) {
    try {
      // ✅ Inicio: carga mensaje semanal
      if (tab === "inicio") {
        loadMensajeSemanal();
      }

      if (tab === "cursos") window.initCursosView?.();
      if (tab === "notificaciones") window.initNotificacionesView?.();
      if (tab === "miembros-activos") window.initMiembrosView?.();

      if (tab === "box") {
        JC.bots?.mountBox?.();
      }

      if (tab === "eventos") {
        JC.events?.cargarEventos?.({ force: true });
      }

      if (tab === "comunidad" || tab === "foro") {
        JC.community?.cargarFeed?.({ force: true });
      }

      if (tab === "recursos") {
        JC.resources?.initCatefa?.();
        JC.resources?.refresh?.({ force: true });
      }

      if (tab === "judart") {
        JC.judart?.refresh?.({ force: true });
      }
    } catch (e) {
      console.warn("[JC] hook error", tab, e);
    }
  }

  async function activate(tab, { silentUrl = false } = {}) {
    tab = ensureValidTab(normalizeTab(tab));

    try { window.jcCloseDrawer?.(); } catch {}

    setActiveUI(tab);

    try { document.body.setAttribute("data-view", tab); } catch {}

    if (!silentUrl) {
      const newHash = `#${tab}`;
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }

      // Limpia ?tab=... si venimos desde auth.html
      try {
        const u = new URL(location.href);
        if (u.searchParams.has("tab")) {
          u.searchParams.delete("tab");
          history.replaceState(null, "", u.toString());
        }
      } catch {}
    }

    await runViewHooks(tab);

    try {
      JC.bots?.segunVista?.(tab);
      window.botsSegunVista?.(tab);
    } catch {}
  }

  window.activate = activate;
  JC.activate = activate;

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

  async function init() {
    registerSW().catch(() => {});

    try {
      if (JC.ui?.init) JC.ui.init();
      else window.jcUI?.initUI?.();
    } catch (e) {
      console.warn("[JC] ui init error", e);
    }

    // ✅ Cargar mensaje semanal apenas inicia (aunque no estés en inicio)
    loadMensajeSemanal();

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