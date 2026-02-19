// js/resources.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.resources = JC.resources || {};
  JC.state = JC.state || {};

  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

  // ✅ Siempre toma el cliente correcto (alias estándar)
  function getSB() {
    return window.sb || window.supabaseClient || JC.sb || null;
  }

  // ============================================================
  // Helpers de vista (no dependas de location.hash)
  // - Tu router usa .view.active + data-view
  // - A veces main.js también setea body[data-view]
  // ============================================================
  function getCurrentView() {
    try {
      const v = document.querySelector(".view.active")?.getAttribute("data-view");
      if (v) return v;
      const b = document.body?.getAttribute("data-view");
      if (b) return b;
      const h = (location.hash || "").replace("#", "").trim();
      if (h) return h;
      return "inicio";
    } catch {
      return "inicio";
    }
  }

  function isRecursosVisible() {
    return getCurrentView() === "recursos";
  }

  // Links configurables
  const VATICANO_URL =
    (JC.config && JC.config.links && JC.config.links.vaticano) ||
    "https://www.vatican.va/content/vatican/es.html";

  const BIBLIA_URL =
    (JC.config && JC.config.links && JC.config.links.biblia) ||
    "https://es.jesus.net/biblia/salmo-23";

  // Roles permitidos para Catefa
  const CATEFA_ROLES_OK = new Set(["animador", "catequista", "admin", "coordinador"]);

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

  function getRoleKey() {
    const rk =
      JC.state?.profile?.rol_key ||
      JC.state?.profile?.rol ||
      JC.state?.profile?.role ||
      null;
    return (rk || "").toString().trim().toLowerCase();
  }

  function hasCatefaAccess() {
    const rk = getRoleKey();
    return CATEFA_ROLES_OK.has(rk);
  }

  function openExternal(url, fallbackId) {
    try {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (w) return;
      const a = fallbackId ? document.getElementById(fallbackId) : null;
      if (a && a.href) a.click();
      else location.href = url;
    } catch (e) {
      console.error("[JC] openExternal error", e);
      location.href = url;
    }
  }

  function bindCatefaLinksOnce() {
    if (bindCatefaLinksOnce.__bound) return;
    bindCatefaLinksOnce.__bound = true;

    document.getElementById("btnVaticano")?.addEventListener("click", () =>
      openExternal(VATICANO_URL, "linkVaticano")
    );
    document.getElementById("btnBiblia")?.addEventListener("click", () =>
      openExternal(BIBLIA_URL, "linkBiblia")
    );
  }

  function setCatefaGate(msg) {
    const gate = document.getElementById("catefaGate");
    if (gate) gate.textContent = msg || "";
  }

  function setCatefaEstado(msg) {
    const estado = document.getElementById("catefaEstado");
    if (estado) estado.textContent = msg || "";
  }

  function renderEmptyIfNeeded() {
    const listNinos = document.getElementById("catefaNinos");
    const listSesiones = document.getElementById("catefaSesiones");

    if (listNinos && listNinos.children.length === 0) {
      listNinos.innerHTML = '<div class="muted small">Selecciona un grupo para ver niños.</div>';
    }
    if (listSesiones && listSesiones.children.length === 0) {
      listSesiones.innerHTML = '<div class="muted small">Selecciona un grupo para ver sesiones.</div>';
    }
  }

  async function getUserId() {
    const u = JC.state.user || window.currentUser;
    if (u?.id) return String(u.id);

    const sb = getSB();
    if (!sb?.auth?.getSession) return "";
    try {
      const { data } = await sb.auth.getSession();
      const id = data?.session?.user?.id;
      return id ? String(id) : "";
    } catch {
      return "";
    }
  }

  // ============================================================
  // CATEFA: cargar grupos asignados
  // ============================================================
  async function cargarGruposAsignados() {
    const sel = document.getElementById("catefaGrupoSelect");
    if (!sel) return;

    sel.innerHTML = `<option value="">(Cargando…)</option>`;

    const sb = getSB();
    if (!sb) {
      sel.innerHTML = `<option value="">(Sin Supabase)</option>`;
      return;
    }

    try {
      const userId = await getUserId();
      if (!userId) {
        sel.innerHTML = `<option value="">(Inicia sesión)</option>`;
        return;
      }

      // 1) asignaciones (RLS debe filtrar por user_id)
      const a = await sb.from("catefa_asignaciones").select("grupo_id").eq("user_id", userId);

      if (a.error) throw a.error;

      const ids = (a.data || []).map((x) => x.grupo_id).filter(Boolean);

      if (!ids.length) {
        sel.innerHTML = `<option value="">(Sin grupos asignados)</option>`;
        return;
      }

      // 2) grupos
      const g = await sb
        .from("catefa_grupos")
        .select("id,nombre")
        .in("id", ids)
        .order("nombre", { ascending: true });

      if (g.error) throw g.error;

      sel.innerHTML = `<option value="">(Elige un grupo…)</option>`;
      for (const row of g.data || []) {
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = row.nombre || row.id;
        sel.appendChild(opt);
      }
    } catch (e) {
      console.warn("[Catefa] cargarGruposAsignados error:", e);
      sel.innerHTML = `<option value="">(Error cargando grupos)</option>`;
    }
  }

  // ============================================================
  // API compat: listarRecursos (evita crash)
  // ============================================================
  async function listarRecursos(scope = "catefa") {
    try {
      renderEmptyIfNeeded();

      const userId = await getUserId();
      if (!userId) {
        setCatefaGate("🔑 Inicia sesión para usar Catefa.");
        setCatefaEstado("");
        return { ok: false, reason: "no_session" };
      }

      if (!hasCatefaAccess()) {
        const rk = getRoleKey() || "miembro";
        setCatefaGate(`🔒 Catefa requiere rol (animador/catequista). Tu rol: ${rk}`);
        setCatefaEstado("");
        return { ok: false, reason: "no_role", role: rk };
      }

      setCatefaGate("Cargando Catefa…");
      setCatefaEstado("");

      await cargarGruposAsignados();

      setCatefaGate("Catefa listo ✅");
      setCatefaEstado(`OK · ${String(scope)}`);
      return { ok: true, scope };
    } catch (e) {
      console.error("[JC] listarRecursos error", e);
      setCatefaGate("Error cargando Catefa ❌");
      setCatefaEstado("");
      return { ok: false, error: e };
    }
  }

  function bindCatefaRefreshOnce() {
    if (bindCatefaRefreshOnce.__bound) return;
    bindCatefaRefreshOnce.__bound = true;

    document.getElementById("btnCatefaRefresh")?.addEventListener("click", () => listarRecursos("catefa"));
  }

  function bindFabUploadHookOnce() {
    if (bindFabUploadHookOnce.__bound) return;
    bindFabUploadHookOnce.__bound = true;

    const fab = document.getElementById("fab");
    const fileRec = document.getElementById("fileRec");
    if (!fab || !fileRec) return;

    fab.addEventListener("click", () => {
      if (isRecursosVisible()) fileRec.click();
    });
  }

  function bindGrupoSelectOnce() {
    if (bindGrupoSelectOnce.__bound) return;
    bindGrupoSelectOnce.__bound = true;

    const sel = document.getElementById("catefaGrupoSelect");
    if (!sel) return;

    sel.addEventListener("change", () => {
      // Por ahora, mantenemos UI consistente sin inventar tablas/queries.
      // Aquí es donde luego conectamos catefa_ninos / catefa_sesiones / asistencia.
      renderEmptyIfNeeded();
      setCatefaEstado(sel.value ? `Grupo: ${sel.options[sel.selectedIndex]?.textContent || sel.value}` : "");
    });
  }

  // ============================================================
  // Public API (para main.js)
  // ============================================================
  let __inited = false;
  function init() {
    if (__inited) return;
    __inited = true;

    // compat global (evita el crash “listarRecursos is not defined”)
    window.listarRecursos = listarRecursos;

    JC.resources.listarRecursos = listarRecursos;
    JC.resources.initCatefa = () => listarRecursos("catefa");
    JC.resources.refresh = () => listarRecursos("catefa");

    bindFabUploadHookOnce();
    bindCatefaLinksOnce();
    bindCatefaRefreshOnce();
    bindGrupoSelectOnce();

    // ✅ Reacciona cuando el perfil cambia (login / logout / rol)
    JC.on("profile:changed", () => {
      if (isRecursosVisible()) listarRecursos("catefa");
    });

    // ✅ Reacciona a cambios de auth aunque profile.js no haya emitido todavía
    // (evita estados “pegados” cuando entra/sale sesión)
    JC.on("auth:changed", () => {
      if (isRecursosVisible()) listarRecursos("catefa");
    });

    // ✅ Precarga SOLO si estás en recursos (evita ruido al arrancar)
    if (isRecursosVisible()) listarRecursos("catefa");
  }

  JC.resources.init = init;
})();