// js/resources.js
// Catefa (Recursos) — Grupos + Niños + Sesiones + Asistencia (RLS-first)
// ✅ Robusto: no rompe si faltan IDs
// ✅ Solo muestra lo permitido por RLS
// ✅ Upsert asistencia (sesion_id + nino_id)  <-- (grupo_id NO existe en catefa_asistencias)
// ✅ Export CSV (si existe #btnCatefaExport)

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  const getSB = () => window.sb || window.supabaseClient || JC.sb || null;
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

  // Event bus (si no existe)
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

  // -------------------------
  // Refs (IDs del index)
  // -------------------------
  function refs() {
    return {
      gate: $("#catefaGate"),
      estado: $("#catefaEstado"),

      btnRefresh: $("#btnCatefaRefresh"),
      btnVaticano: $("#btnVaticano"),
      btnBiblia: $("#btnBiblia"),
      linkVaticano: $("#linkVaticano"),
      linkBiblia: $("#linkBiblia"),

      grupoSelect: $("#catefaGrupoSelect"),

      tema: $("#catefaTema"),
      fecha: $("#catefaFecha"),
      btnNuevaSesion: $("#btnCatefaNuevaSesion"),

      ninoNombre: $("#catefaNinoNombre"),
      ninoApellidos: $("#catefaNinoApellidos"),
      btnNuevoNino: $("#btnCatefaNuevoNino"),

      ninosBox: $("#catefaNinos"),
      sesionesBox: $("#catefaSesiones"),
      asistenciaPanel: $("#catefaAsistenciaPanel"),

      // (Opcional) si luego lo pones en el index:
      // <button id="btnCatefaExport" class="btn small ghost" type="button">⬇️ Exportar asistencia</button>
      btnExport: $("#btnCatefaExport"),
    };
  }

  function setGate(msg) {
    const r = refs();
    if (r.gate) r.gate.textContent = msg || "";
  }
  function setEstado(msg) {
    const r = refs();
    if (r.estado) r.estado.textContent = msg || "";
  }

  const st = {
    bound: false,
    grupoId: "",
    grupos: [],
    ninos: [],
    sesiones: [],
    sesionActivaId: "",
    asistencias: [], // cache asistencia de sesión activa
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

  // Convierte a string “numérica” (bigint) sin romper
  function normGrupoId(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    // si viene como number/string numérica, ok; si viene raro, igual lo devolvemos
    return s;
  }

  // -------------------------
  // Data loaders
  // -------------------------
  async function loadGruposAsignados() {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");

    const user = await getUser();
    if (!user) {
      st.grupos = [];
      return [];
    }

    // RLS-friendly: catefa_grupos ya está filtrado por policy (solo asignados / creador / admin)
    const q = await sb
      .from("catefa_grupos")
      .select("id,nombre,created_at")
      .order("nombre", { ascending: true });

    if (q.error) throw q.error;

    st.grupos = q.data || [];
    return st.grupos;
  }

  async function loadNinos(grupoId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    grupoId = normGrupoId(grupoId);
    if (!grupoId) return [];

    const q = await sb
      .from("catefa_ninos")
      .select("id,grupo_id,nombre,apellidos,created_at,activo")
      .eq("grupo_id", grupoId)
      .order("nombre", { ascending: true });

    if (q.error) throw q.error;

    st.ninos = q.data || [];
    return st.ninos;
  }

  async function loadSesiones(grupoId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    grupoId = normGrupoId(grupoId);
    if (!grupoId) return [];

    const q = await sb
      .from("catefa_sesiones")
      .select("id,grupo_id,tema,fecha,created_at")
      .eq("grupo_id", grupoId)
      .order("fecha", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(80);

    if (q.error) throw q.error;

    st.sesiones = q.data || [];
    return st.sesiones;
  }

  // ✅ catefa_asistencias NO tiene grupo_id → solo filtramos por sesion_id
  async function loadAsistencias(sesionId) {
    const sb = getSB();
    if (!sb) throw new Error("Supabase no disponible");
    if (!sesionId) return [];

    const q = await sb
      .from("catefa_asistencias")
      .select("id,sesion_id,nino_id,presente,nota,updated_at")
      .eq("sesion_id", sesionId);

    if (q.error) throw q.error;

    st.asistencias = q.data || [];
    return st.asistencias;
  }

  // -------------------------
  // Render helpers
  // -------------------------
  function renderGrupoSelect() {
    const r = refs();
    if (!r.grupoSelect) return;

    if (!st.grupos.length) {
      r.grupoSelect.innerHTML = `<option value="">(Sin grupos asignados)</option>`;
      return;
    }

    r.grupoSelect.innerHTML =
      `<option value="">Selecciona un grupo…</option>` +
      st.grupos.map((g) => `<option value="${safeText(g.id)}">${safeText(g.nombre)}</option>`).join("");

    if (st.grupoId) r.grupoSelect.value = st.grupoId;
  }

  function renderNinos() {
    const r = refs();
    if (!r.ninosBox) return;

    if (!st.grupoId) {
      r.ninosBox.innerHTML = `<div class="muted small">Selecciona un grupo para ver niños.</div>`;
      return;
    }
    if (!st.ninos.length) {
      r.ninosBox.innerHTML = `<div class="muted small">Aún no hay niños en este grupo.</div>`;
      return;
    }

    r.ninosBox.innerHTML = st.ninos
      .map((n) => {
        const full = `${n.nombre || ""} ${n.apellidos || ""}`.trim();
        const activo = (n.activo ?? true) ? "✅ activo" : "⛔ inactivo";
        return `
          <div class="card" style="padding:10px 12px; margin-top:10px">
            <strong>${safeText(full || "Niño")}</strong>
            <div class="muted small">${safeText(activo)}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderSesiones() {
    const r = refs();
    if (!r.sesionesBox) return;

    if (!st.grupoId) {
      r.sesionesBox.innerHTML = `<div class="muted small">Selecciona un grupo para ver sesiones.</div>`;
      return;
    }
    if (!st.sesiones.length) {
      r.sesionesBox.innerHTML = `<div class="muted small">Aún no hay sesiones en este grupo.</div>`;
      return;
    }

    r.sesionesBox.innerHTML = st.sesiones
      .map((s) => {
        const when = s.fecha ? new Date(s.fecha).toLocaleString("es-PE") : "Sin fecha";
        const active = String(st.sesionActivaId) === String(s.id);
        return `
          <div class="card" style="padding:10px 12px; margin-top:10px; border-color:${active ? "rgba(244,114,182,.55)" : ""}">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap">
              <div style="min-width:0">
                <strong>${safeText(s.tema || "Sesión")}</strong>
                <div class="muted small">${safeText(when)}</div>
              </div>
              <button class="btn small ghost" type="button" data-catefa-sesion="${safeText(s.id)}">
                ${active ? "Activa ✅" : "Tomar asistencia"}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // bind buttons
    r.sesionesBox.querySelectorAll("[data-catefa-sesion]").forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-catefa-sesion") || "";
        st.sesionActivaId = id;
        renderSesiones();
        await renderAsistencia();
      });
    });
  }

  async function renderAsistencia() {
    const r = refs();
    if (!r.asistenciaPanel) return;

    if (!st.grupoId || !st.sesionActivaId) {
      r.asistenciaPanel.innerHTML = ``;
      return;
    }

    if (!st.ninos.length) {
      r.asistenciaPanel.innerHTML = `<div class="card"><div class="muted small">No hay niños para tomar asistencia.</div></div>`;
      return;
    }

    r.asistenciaPanel.innerHTML = `<div class="card"><div class="muted small">Cargando asistencia…</div></div>`;

    try {
      const asist = await loadAsistencias(st.sesionActivaId);
      const map = new Map(asist.map((a) => [String(a.nino_id), a]));

      r.asistenciaPanel.innerHTML = `
        <div class="card">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
            <h4 style="margin:0">✅ Asistencia</h4>
            ${r.btnExport ? `` : ``}
          </div>

          <div class="muted small" style="margin:6px 0 10px">
            Marca presentes y se guarda automático. (RLS protege quién puede escribir)
          </div>

          <div class="grid">
            ${st.ninos
              .map((n) => {
                const full = `${n.nombre || ""} ${n.apellidos || ""}`.trim();
                const a = map.get(String(n.id));
                const checked = a?.presente ? "checked" : "";
                return `
                  <label style="display:flex; gap:10px; align-items:center; padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,.22); background:rgba(2,6,23,.18)">
                    <input type="checkbox" data-catefa-check="${safeText(n.id)}" ${checked} />
                    <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${safeText(full || "Niño")}</span>
                  </label>
                `;
              })
              .join("")}
          </div>

          <div class="muted small" style="margin-top:10px" id="catefaAsistEstado"></div>
        </div>
      `;

      const estadoEl = document.getElementById("catefaAsistEstado");

      r.asistenciaPanel.querySelectorAll("[data-catefa-check]").forEach((chk) => {
        if (chk.__bound) return;
        chk.__bound = true;

        chk.addEventListener("change", async () => {
          const ninoId = chk.getAttribute("data-catefa-check");
          const presente = !!chk.checked;

          try {
            if (estadoEl) estadoEl.textContent = "Guardando…";
            const sb = getSB();

            // ✅ NO grupo_id (no existe)
            const payload = {
              sesion_id: st.sesionActivaId,
              nino_id: ninoId,
              presente,
              updated_at: new Date().toISOString(),
            };

            // upsert por UNIQUE (sesion_id,nino_id) — si no existe unique, fallará → te lo dirá
            const up = await sb
              .from("catefa_asistencias")
              .upsert(payload, { onConflict: "sesion_id,nino_id" });

            if (up.error) throw up.error;

            if (estadoEl) estadoEl.textContent = "✅ Guardado.";
            setTimeout(() => {
              if (estadoEl?.textContent === "✅ Guardado.") estadoEl.textContent = "";
            }, 1200);
          } catch (e) {
            console.error("[catefa] asistencia upsert error", e);
            if (estadoEl) estadoEl.textContent = `❌ No se pudo guardar: ${e?.message || "RLS/permisos/unique"}`;
          }
        });
      });
    } catch (e) {
      console.error("[catefa] renderAsistencia error", e);
      r.asistenciaPanel.innerHTML = `<div class="card"><div class="muted small">❌ Error cargando asistencia: ${safeText(e?.message || e)}</div></div>`;
    }
  }

  // -------------------------
  // Actions (crear niño / sesión)
  // -------------------------
  async function createSesion() {
    const r = refs();
    if (!r.btnNuevaSesion) return;

    if (!isLogged()) return setEstado("🔑 Inicia sesión.");
    if (!st.grupoId) return setEstado("Selecciona un grupo.");

    const tema = String(r.tema?.value || "").trim();
    if (!tema) return setEstado("Escribe el tema.");

    const fecha = r.fecha?.value ? new Date(r.fecha.value).toISOString() : null;

    try {
      setEstado("Guardando sesión…");
      const sb = getSB();
      const q = await sb.from("catefa_sesiones").insert({
        grupo_id: st.grupoId,
        tema,
        fecha,
      });

      if (q.error) throw q.error;

      if (r.tema) r.tema.value = "";
      if (r.fecha) r.fecha.value = "";

      setEstado("✅ Sesión guardada.");
      await refresh({ soft: true });
    } catch (e) {
      console.error("[catefa] createSesion error", e);
      setEstado(`❌ No se pudo guardar: ${e?.message || "RLS/permisos"}`);
    }
  }

  async function createNino() {
    const r = refs();
    if (!r.btnNuevoNino) return;

    if (!isLogged()) return setEstado("🔑 Inicia sesión.");
    if (!st.grupoId) return setEstado("Selecciona un grupo.");

    const nombre = String(r.ninoNombre?.value || "").trim();
    const apellidos = String(r.ninoApellidos?.value || "").trim() || null;

    if (!nombre) return setEstado("Escribe el nombre del niño.");

    try {
      setEstado("Agregando niño…");
      const sb = getSB();
      const q = await sb.from("catefa_ninos").insert({
        grupo_id: st.grupoId,
        nombre,
        apellidos,
        activo: true,
      });

      if (q.error) throw q.error;

      if (r.ninoNombre) r.ninoNombre.value = "";
      if (r.ninoApellidos) r.ninoApellidos.value = "";

      setEstado("✅ Niño agregado.");
      await refresh({ soft: true });
    } catch (e) {
      console.error("[catefa] createNino error", e);
      setEstado(`❌ No se pudo agregar: ${e?.message || "RLS/permisos"}`);
    }
  }

  // -------------------------
  // Export CSV (opcional)
  // -------------------------
  function toCSV(rows) {
    const esc = (v) => {
      const s = String(v ?? "");
      // CSV Excel-friendly
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };

    return rows.map((r) => r.map(esc).join(",")).join("\n");
  }

  function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function exportAsistenciaCSV() {
    if (!st.sesionActivaId) {
      setEstado("Selecciona una sesión (Tomar asistencia) primero.");
      return;
    }
    if (!st.ninos.length) {
      setEstado("No hay niños en el grupo.");
      return;
    }

    // asegura asistencias cargadas
    try {
      await loadAsistencias(st.sesionActivaId);
    } catch {}

    const map = new Map((st.asistencias || []).map((a) => [String(a.nino_id), !!a.presente]));
    const ses = st.sesiones.find((s) => String(s.id) === String(st.sesionActivaId));
    const grupo = st.grupos.find((g) => String(g.id) === String(st.grupoId));

    const header = [
      ["Grupo", grupo?.nombre || ""],
      ["Sesión", ses?.tema || ""],
      ["Fecha", ses?.fecha ? new Date(ses.fecha).toLocaleString("es-PE") : ""],
      [],
      ["nino_id", "nombre", "apellidos", "presente"],
    ];

    const body = st.ninos.map((n) => [
      n.id,
      n.nombre || "",
      n.apellidos || "",
      map.get(String(n.id)) ? "SI" : "NO",
    ]);

    const csv = toCSV([...header, ...body]);

    const stamp = new Date().toISOString().slice(0, 10);
    const file = `catefa_asistencia_${grupo?.id || "grupo"}_${st.sesionActivaId}_${stamp}.csv`;
    downloadText(file, csv);
    setEstado("✅ CSV descargado.");
    setTimeout(() => setEstado(""), 1200);
  }

  // -------------------------
  // Refresh
  // -------------------------
  async function refresh({ soft = false } = {}) {
    const r = refs();

    try {
      if (!soft) setGate("Cargando Catefa…");
      setEstado("");

      if (!isLogged()) {
        setGate("🔑 Inicia sesión para ver Catefa (RLS).");
        st.grupos = [];
        st.grupoId = "";
        st.ninos = [];
        st.sesiones = [];
        st.sesionActivaId = "";
        renderGrupoSelect();
        renderNinos();
        renderSesiones();
        if (r.asistenciaPanel) r.asistenciaPanel.innerHTML = "";
        return;
      }

      const grupos = await loadGruposAsignados();
      renderGrupoSelect();

      if (!grupos.length) {
        setGate("🔒 No tienes grupos asignados (RLS).");
        st.grupoId = "";
        st.ninos = [];
        st.sesiones = [];
        st.sesionActivaId = "";
        renderNinos();
        renderSesiones();
        if (r.asistenciaPanel) r.asistenciaPanel.innerHTML = "";
        return;
      }

      setGate("✅ Catefa listo. Selecciona tu grupo.");

      // Si no hay grupo elegido, toma el primero
      if (!st.grupoId) st.grupoId = String(grupos[0]?.id || "");
      st.grupoId = normGrupoId(st.grupoId);

      if (r.grupoSelect) r.grupoSelect.value = st.grupoId;

      await loadNinos(st.grupoId);
      await loadSesiones(st.grupoId);

      // si la sesión activa ya no existe, limpia
      if (st.sesionActivaId && !st.sesiones.some((s) => String(s.id) === String(st.sesionActivaId))) {
        st.sesionActivaId = "";
      }

      renderNinos();
      renderSesiones();
      await renderAsistencia();
    } catch (e) {
      console.error("[catefa] refresh error", e);
      setGate("❌ Catefa no pudo cargar.");
      setEstado(e?.message || "Revisa RLS / tablas / permisos");
    }
  }

  // -------------------------
  // Bind
  // -------------------------
  function bindUIOnce() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    r.btnRefresh?.addEventListener("click", () => refresh({ soft: false }));

    r.btnVaticano?.addEventListener("click", () => {
      if (r.linkVaticano) r.linkVaticano.style.display = "";
      r.linkVaticano?.click?.();
    });

    r.btnBiblia?.addEventListener("click", () => {
      if (r.linkBiblia) r.linkBiblia.style.display = "";
      r.linkBiblia?.click?.();
    });

    r.grupoSelect?.addEventListener("change", async () => {
      st.grupoId = normGrupoId(r.grupoSelect.value || "");
      st.sesionActivaId = "";
      await refresh({ soft: true });
    });

    r.btnNuevaSesion?.addEventListener("click", createSesion);
    r.btnNuevoNino?.addEventListener("click", createNino);

    // export (si existe botón)
    r.btnExport?.addEventListener("click", exportAsistenciaCSV);

    // Reaccionar a auth/perfil
    JC.on("auth:changed", () => refresh({ soft: true }));
    JC.on("profile:changed", () => refresh({ soft: true }));
  }

  async function initCatefa() {
    bindUIOnce();
    await refresh({ soft: false });
    return true;
  }

  JC.resources = {
    init: initCatefa,
    initCatefa,
    refresh,
    exportAsistenciaCSV,
  };

  // Compat global por si main.js llama listarRecursos("catefa")
  window.listarRecursos = async function () {
    await initCatefa();
  };
})();