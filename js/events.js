// js/events.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // ✅ Usa SIEMPRE el alias estándar cuando exista
  function getSB() {
    return window.sb || window.supabaseClient || JC.sb || null;
  }

  // Helpers mínimos
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ = JC.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

  // Event bus simple
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
  // Refs
  // (IMPORTANTE) Tu index usa IDs/clases "event-cal-*" y "event-cal-grid".
  // Antes estabas usando .cal-* y .event-cal-day => no aplicaba el CSS.
  // ============================================================
  function refs() {
    return {
      gate: $("#evGate"),
      wrapCreate: $("#evCreateWrap"),
      form: $("#formEvento"),
      estado: $("#evEstado"),
      list: $("#eventList"),
      listHome: $("#eventListHome"),

      // toolbar
      filtroTipo: $("#filtroTipo"),
      evScope: $("#evScope"),
      btnRefresh: $("#btnEvRefresh"),
      evSearch: $("#evSearch"),
      evSort: $("#evSort"),

      // calendario
      calPrev: $("#evCalPrev"),
      calNext: $("#evCalNext"),
      calLabel: $("#evCalLabel"),
      calendar: $("#evCalendar"),
      dayHint: $("#evDayHint"),
      clearDay: $("#evClearDay"),

      // modal editar
      modal: $("#evModal"),
      modalClose: $("#evModalClose"),
      editForm: $("#evEditForm"),
      editEstado: $("#evEditEstado"),
      editDelete: $("#evEditDelete")
    };
  }

  const st = {
    bound: false,
    selectedDayISO: null,
    calDate: new Date(),
    // cache local de eventos (cuando aún no hay DB o falla)
    events: []
  };

  function getUser() {
    return JC.state.user || window.currentUser || null;
  }
  function isLogged() {
    return !!getUser();
  }
  function isMember() {
    return !!JC.state.isMember;
  }

  // ============================================================
  // Gate: ver eventos público; crear/editar solo miembros
  // ============================================================
  function setGate() {
    const { gate, wrapCreate } = refs();

    if (!isLogged()) {
      if (gate) gate.textContent = "👀 Eventos visibles. 🔑 Inicia sesión para crear/editar.";
      if (wrapCreate) wrapCreate.style.display = "none";
      return;
    }

    if (!isMember()) {
      if (gate) gate.textContent = "👀 Puedes ver eventos. 🔒 Completa tu perfil para crear/editar.";
      if (wrapCreate) wrapCreate.style.display = "none";
      return;
    }

    if (gate) gate.textContent = "✅ Miembro activo: puedes crear/editar eventos.";
    if (wrapCreate) wrapCreate.style.display = "block";
  }

  // ============================================================
  // Utils
  // ============================================================
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isoFromDateInput(dtLocal) {
    // dtLocal: "2026-01-10T19:30"
    try {
      const d = new Date(dtLocal);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }

  function shortDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "—";
    }
  }

  function todayISODate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ============================================================
  // Calendario (7 columnas) — match con tu index + styles.css
  // ============================================================
  function monthLabel(d) {
    try {
      const s = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return "Mes";
    }
  }

  function renderCalendarSkeleton() {
    const { calendar, calLabel, dayHint, clearDay } = refs();
    if (!calendar) return;

    if (calLabel) calLabel.textContent = monthLabel(st.calDate);

    calendar.innerHTML = "";
    calendar.classList.add("event-cal-grid"); // por si faltó clase en HTML

    const y = st.calDate.getFullYear();
    const m = st.calDate.getMonth();
    const first = new Date(y, m, 1);
    const startDay = (first.getDay() + 6) % 7; // 0=L
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    if (dayHint) dayHint.textContent = st.selectedDayISO ? `Filtrado: ${st.selectedDayISO}` : "Toca un día para filtrar";
    if (clearDay) clearDay.style.display = st.selectedDayISO ? "" : "none";

    for (let i = 0; i < startDay; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "event-cal-day is-empty";
      cell.disabled = true;
      cell.setAttribute("aria-hidden", "true");
      calendar.appendChild(cell);
    }

    const today = todayISODate();

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "event-cal-day";
      cell.textContent = String(day);
      cell.dataset.iso = iso;

      if (iso === today) cell.classList.add("is-today");
      if (st.selectedDayISO === iso) cell.classList.add("is-selected");

      cell.addEventListener("click", () => {
        st.selectedDayISO = st.selectedDayISO === iso ? null : iso;
        renderCalendarSkeleton();
        cargarEventos({ force: true });
      });

      calendar.appendChild(cell);
    }
  }

  // ============================================================
  // Query + render (con fallback local)
  // Tabla esperada: eventos (o public.eventos)
  // Campos mínimos: id, titulo, fecha, lugar, tipo, created_by (opcional)
  // ============================================================
  function getFilters() {
    const r = refs();
    return {
      tipo: r.filtroTipo?.value || "",
      scope: r.evScope?.value || "upcoming",
      search: (r.evSearch?.value || "").trim(),
      sort: r.evSort?.value || "asc"
    };
  }

  function applyClientFilters(rows) {
    const { tipo, scope, search, sort } = getFilters();
    let out = Array.isArray(rows) ? rows.slice() : [];

    if (tipo) out = out.filter((x) => String(x.tipo || "") === tipo);

    if (st.selectedDayISO) {
      out = out.filter((x) => {
        const iso = String(x.fecha || x.fecha_at || x.start_at || "");
        return iso.startsWith(st.selectedDayISO);
      });
    }

    if (search) {
      const q = search.toLowerCase();
      out = out.filter((x) => {
        const t = `${x.titulo || ""} ${x.lugar || ""}`.toLowerCase();
        return t.includes(q);
      });
    }

    // scope: upcoming | all | past
    const now = Date.now();
    if (scope === "upcoming") {
      out = out.filter((x) => {
        const d = new Date(x.fecha || x.fecha_at || x.start_at || 0).getTime();
        return !isNaN(d) && d >= now - 60 * 1000; // tolerancia 1min
      });
    } else if (scope === "past") {
      out = out.filter((x) => {
        const d = new Date(x.fecha || x.fecha_at || x.start_at || 0).getTime();
        return !isNaN(d) && d < now - 60 * 1000;
      });
    }

    out.sort((a, b) => {
      const da = new Date(a.fecha || a.fecha_at || a.start_at || 0).getTime();
      const db = new Date(b.fecha || b.fecha_at || b.start_at || 0).getTime();
      const diff = (da || 0) - (db || 0);
      return sort === "desc" ? -diff : diff;
    });

    return out;
  }

  function renderList(rows) {
    const { list, listHome } = refs();

    const renderInto = (el, items, compact = false) => {
      if (!el) return;

      if (!items.length) {
        el.innerHTML = `<li class="muted small">No hay eventos para mostrar.</li>`;
        return;
      }

      el.innerHTML = items
        .map((ev) => {
          const titulo = escapeHtml(ev.titulo || "Evento");
          const lugar = escapeHtml(ev.lugar || "");
          const tipo = escapeHtml(ev.tipo || "");
          const fecha = shortDate(ev.fecha || ev.fecha_at || ev.start_at);

          // Botón editar solo si miembro
          const canEdit = isMember();
          const editBtn = canEdit
            ? `<button class="btn small ghost" type="button" data-ev-act="edit" data-ev-id="${escapeHtml(ev.id)}">Editar</button>`
            : "";

          return `
            <li class="event-item">
              <div>
                <div class="event-title">${titulo}</div>
                <div class="muted small">${lugar}${tipo ? ` · ${tipo}` : ""}</div>
              </div>
              <div class="event-meta">
                ${escapeHtml(fecha)}
                ${compact ? "" : `<div class="event-toolbar" style="margin-top:8px">${editBtn}</div>`}
              </div>
            </li>
          `;
        })
        .join("");

      // bind edit buttons (delegado por lista)
      el.querySelectorAll('[data-ev-act="edit"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-ev-id");
          if (!id) return;
          openEditModalById(id);
        });
      });
    };

    const filtered = applyClientFilters(rows);

    renderInto(list, filtered, false);
    renderInto(listHome, filtered.slice(0, 4), true);
  }

  async function fetchFromSupabase() {
    const sb = getSB();
    if (!sb) return { ok: false, data: [] };

    // ✅ intenta "eventos" y si no existe, no revienta (solo fallback)
    // Nota: si tu tabla se llama distinto, cámbiala aquí.
    try {
      const q = await sb
        .from("eventos")
        .select("id,titulo,fecha,lugar,tipo,created_at")
        .order("fecha", { ascending: true });

      if (q.error) throw q.error;
      return { ok: true, data: q.data || [] };
    } catch (e) {
      console.warn("[events] fetch supabase error:", e?.message || e);
      return { ok: false, data: [] };
    }
  }

  // ============================================================
  // Cargar eventos (DB si existe, si no: cache local)
  // ============================================================
  async function cargarEventos({ force = false } = {}) {
    // DB
    const fromDb = await fetchFromSupabase();
    if (fromDb.ok) {
      st.events = fromDb.data || [];
      renderList(st.events);
      return { ok: true, source: "db", count: st.events.length };
    }

    // fallback local (si ya creaste eventos en esta sesión)
    if (!st.events.length && force) {
      // vacío pero estable
      renderList([]);
      return { ok: true, source: "local", count: 0 };
    }

    renderList(st.events);
    return { ok: true, source: "local", count: st.events.length };
  }

  // ============================================================
  // Crear evento (solo miembros)
  // - Si existe tabla "eventos": inserta
  // - Si no: guarda en memoria (fallback)
  // ============================================================
  async function crearEventoFromForm() {
    const r = refs();
    if (!r.estado) return;

    if (!isLogged()) {
      r.estado.textContent = "🔑 Inicia sesión para crear eventos.";
      return;
    }
    if (!isMember()) {
      r.estado.textContent = "🔒 Completa tu perfil para crear eventos.";
      return;
    }

    const titulo = $("#evTitulo")?.value?.trim();
    const fechaLocal = $("#evFecha")?.value;
    const lugar = $("#evLugar")?.value?.trim() || "";
    const tipo = $("#evTipo")?.value || "";

    if (!titulo || !fechaLocal) {
      r.estado.textContent = "Completa al menos Título y Fecha.";
      return;
    }

    const fechaISO = isoFromDateInput(fechaLocal);
    if (!fechaISO) {
      r.estado.textContent = "Fecha inválida.";
      return;
    }

    r.estado.textContent = "Guardando…";

    const sb = getSB();
    const user = getUser();

    // Intento DB
    let saved = false;
    if (sb) {
      try {
        const payload = {
          titulo,
          fecha: fechaISO,
          lugar: lugar || null,
          tipo: tipo || null,
          created_by: user?.id || null
        };

        const ins = await sb.from("eventos").insert(payload).select("id,titulo,fecha,lugar,tipo").maybeSingle();
        if (ins.error) throw ins.error;

        if (ins.data) {
          saved = true;
          r.estado.textContent = "✅ Evento creado.";
        }
      } catch (e) {
        console.warn("[events] insert error:", e?.message || e);
        // no revienta, cae a local
      }
    }

    // Fallback local
    if (!saved) {
      st.events.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        titulo,
        fecha: fechaISO,
        lugar,
        tipo
      });
      r.estado.textContent = "✅ Evento listo (modo local).";
    }

    try {
      window.logAviso?.({ title: "Eventos", body: `Evento: ${titulo}` });
      window.miaSetEstado?.("apoyo");
    } catch {}

    // limpiar form
    try {
      $("#evTitulo").value = "";
      $("#evFecha").value = "";
      $("#evLugar").value = "";
      $("#evTipo").value = "";
    } catch {}

    await cargarEventos({ force: true });
  }

  // ============================================================
  // Modal editar (mínimo: carga en form, sin romper)
  // ============================================================
  function openEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("show");

    // ✅ ui.js usa JC.uiState.angieOpen/loginOpen/pauseOpen/drawerOpen
    // NO existe eventsOpen ahí, así que no lo usamos.
    window.JC = window.JC || {};
    window.JC.uiState = window.JC.uiState || {};
    // marcamos genericamente "loginOpen"?? no. Mejor no ensuciar.
    // Solo sincronizamos overlay por si tu syncOverlay usa algún estado:
    // (tu syncOverlay NO mira events, así que overlay no se mostrará.
    //  Solución: cerramos overlay y dejamos el modal como focus principal.)
    // Para que overlay funcione con modales, lo correcto es que ui.js considere cualquier .jc-modal.show.
    // Pero por ahora no rompemos.
  }

  function closeEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
  }

  function openEditModalById(id) {
    const r = refs();
    const ev = st.events.find((x) => String(x.id) === String(id));
    if (!ev) return;

    // Prefill
    try {
      $("#evEditTitulo").value = ev.titulo || "";
      // Pasar ISO a datetime-local aproximado
      const d = new Date(ev.fecha || ev.fecha_at || ev.start_at || 0);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        $("#evEditFecha").value = v;
      } else {
        $("#evEditFecha").value = "";
      }
      $("#evEditLugar").value = ev.lugar || "";
      $("#evEditTipo").value = ev.tipo || "";
      if (r.editEstado) r.editEstado.textContent = "";
      // guarda id activo
      openEditModalById.__id = String(id);
    } catch {}

    openEditModal();
  }

  async function saveEditFromModal() {
    const r = refs();
    if (!isLogged() || !isMember()) {
      if (r.editEstado) r.editEstado.textContent = "🔒 Solo miembros pueden editar.";
      return;
    }

    const id = openEditModalById.__id;
    if (!id) return;

    const titulo = $("#evEditTitulo")?.value?.trim();
    const fechaLocal = $("#evEditFecha")?.value;
    const lugar = $("#evEditLugar")?.value?.trim() || "";
    const tipo = $("#evEditTipo")?.value || "";

    if (!titulo || !fechaLocal) {
      if (r.editEstado) r.editEstado.textContent = "Completa título y fecha.";
      return;
    }

    const fechaISO = isoFromDateInput(fechaLocal);
    if (!fechaISO) {
      if (r.editEstado) r.editEstado.textContent = "Fecha inválida.";
      return;
    }

    if (r.editEstado) r.editEstado.textContent = "Guardando…";

    const sb = getSB();
    let saved = false;

    if (sb) {
      try {
        const up = await sb
          .from("eventos")
          .update({ titulo, fecha: fechaISO, lugar: lugar || null, tipo: tipo || null })
          .eq("id", id);

        if (up.error) throw up.error;
        saved = true;
      } catch (e) {
        console.warn("[events] update error:", e?.message || e);
      }
    }

    // fallback local
    const idx = st.events.findIndex((x) => String(x.id) === String(id));
    if (idx >= 0) {
      st.events[idx] = { ...st.events[idx], titulo, fecha: fechaISO, lugar, tipo };
    }

    if (r.editEstado) r.editEstado.textContent = saved ? "✅ Cambios guardados." : "✅ Guardado (modo local).";
    await cargarEventos({ force: true });
  }

  async function deleteFromModal() {
    const r = refs();
    if (!isLogged() || !isMember()) {
      if (r.editEstado) r.editEstado.textContent = "🔒 Solo miembros pueden borrar.";
      return;
    }

    const id = openEditModalById.__id;
    if (!id) return;

    if (r.editEstado) r.editEstado.textContent = "Borrando…";

    const sb = getSB();
    let deleted = false;

    if (sb) {
      try {
        const del = await sb.from("eventos").delete().eq("id", id);
        if (del.error) throw del.error;
        deleted = true;
      } catch (e) {
        console.warn("[events] delete error:", e?.message || e);
      }
    }

    // fallback local
    st.events = st.events.filter((x) => String(x.id) !== String(id));

    if (r.editEstado) r.editEstado.textContent = deleted ? "🗑️ Borrado." : "🗑️ Borrado (modo local).";
    closeEditModal();
    await cargarEventos({ force: true });
  }

  // ============================================================
  // Bind UI (una vez)
  // ============================================================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    r.btnRefresh?.addEventListener("click", () => cargarEventos({ force: true }));
    r.filtroTipo?.addEventListener("change", () => cargarEventos({ force: true }));
    r.evScope?.addEventListener("change", () => cargarEventos({ force: true }));

    r.evSearch?.addEventListener("input", () => {
      clearTimeout(bindUI.__t);
      bindUI.__t = setTimeout(() => cargarEventos({ force: true }), 220);
    });

    r.evSort?.addEventListener("change", () => cargarEventos({ force: true }));

    r.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      crearEventoFromForm();
    });

    r.calPrev?.addEventListener("click", () => {
      st.calDate = new Date(st.calDate.getFullYear(), st.calDate.getMonth() - 1, 1);
      renderCalendarSkeleton();
    });

    r.calNext?.addEventListener("click", () => {
      st.calDate = new Date(st.calDate.getFullYear(), st.calDate.getMonth() + 1, 1);
      renderCalendarSkeleton();
    });

    r.clearDay?.addEventListener("click", () => {
      st.selectedDayISO = null;
      renderCalendarSkeleton();
      cargarEventos({ force: true });
    });

    // Modal editar
    r.modalClose?.addEventListener("click", closeEditModal);
    r.modal?.addEventListener("click", (e) => {
      if (e.target === r.modal) closeEditModal();
    });

    r.editForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveEditFromModal();
    });

    r.editDelete?.addEventListener("click", deleteFromModal);

    // Exponer compat (para auth.js refreshGates)
    window.jcEventos = window.jcEventos || {};
    window.jcEventos.refreshAuth = async () => {
      setGate();
      await cargarEventos({ force: true });
    };
    window.jcEventos.cargarEventos = cargarEventos;
  }

  async function init() {
    bindUI();

    JC.on("profile:changed", () => {
      setGate();
      cargarEventos({ force: true });
    });

    setGate();
    renderCalendarSkeleton();
    await cargarEventos({ force: true });
  }

  // Public API
  JC.events = {
    init,
    setGate,
    cargarEventos,
    openEditModal,
    closeEditModal
  };
})();