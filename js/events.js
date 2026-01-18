// js/events.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  // UI state (overlay)
  JC.uiState = JC.uiState || {};
  if (typeof JC.uiState.eventsOpen !== "boolean") JC.uiState.eventsOpen = false;

  // Cliente supabase (listo para conectar DB luego)
  const sb = window.sb || window.supabaseClient || JC.sb || null;

  // Helpers mínimos
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

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
    calDate: new Date()
  };

  function isLogged() {
    return !!JC.state.user || !!window.currentUser;
  }
  function isMember() {
    return !!JC.state.isMember;
  }

  // =========================
  // Gate: ver eventos es público; crear/editar solo miembros
  // =========================
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

  // =========================
  // Render helpers (placeholder)
  // =========================
  function renderEmpty(listEl, msg) {
    if (!listEl) return;
    listEl.innerHTML = `<li class="muted small">${msg}</li>`;
  }

  function renderListPlaceholder() {
    const { list, listHome } = refs();

    const msg = st.selectedDayISO
      ? `📅 Eventos (placeholder) — filtrado por día: ${st.selectedDayISO}`
      : "📅 Eventos (placeholder) — pronto conectamos Supabase (public.eventos).";

    renderEmpty(list, msg);
    renderEmpty(listHome, msg);
  }

  // =========================
  // Calendario (skeleton)
  // =========================
  function monthLabel(d) {
    try {
      return d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    } catch {
      return "Mes";
    }
  }

  function renderCalendarSkeleton() {
    const { calendar, calLabel, dayHint, clearDay } = refs();
    if (!calendar) return;

    if (calLabel) {
      const s = monthLabel(st.calDate);
      calLabel.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    }

    calendar.innerHTML = "";

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
      calendar.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "event-cal-day";
      cell.textContent = String(day);
      cell.dataset.iso = iso;

      if (st.selectedDayISO === iso) cell.classList.add("is-selected");

      cell.addEventListener("click", () => {
        st.selectedDayISO = st.selectedDayISO === iso ? null : iso;
        renderCalendarSkeleton();
        cargarEventos({ force: true });
      });

      calendar.appendChild(cell);
    }
  }

  // =========================
  // Carga eventos (placeholder por ahora)
  // =========================
  async function cargarEventos({ force = false } = {}) {
    // Cuando conectemos:
    // - select public.eventos (lectura pública)
    // - filtros: tipo, scope, search, sort, selectedDayISO
    renderListPlaceholder();
  }

  // =========================
  // Crear evento (solo miembros)
  // =========================
  async function crearEventoFromForm() {
    const { estado } = refs();
    if (!estado) return;

    if (!isLogged()) {
      estado.textContent = "🔑 Inicia sesión para crear eventos.";
      return;
    }
    if (!isMember()) {
      estado.textContent = "🔒 Completa tu perfil para crear eventos.";
      return;
    }

    const titulo = $("#evTitulo")?.value?.trim();
    const fecha = $("#evFecha")?.value;
    const lugar = $("#evLugar")?.value?.trim();
    const tipo = $("#evTipo")?.value;

    if (!titulo || !fecha) {
      estado.textContent = "Completa al menos Título y Fecha.";
      return;
    }

    estado.textContent = "✅ Evento listo (pendiente conectar a Supabase).";
    try {
      window.logAviso?.({ title: "Eventos", body: `Evento preparado: ${titulo}` });
      window.miaSetEstado?.("apoyo");
    } catch {}

    try {
      $("#evTitulo").value = "";
      $("#evFecha").value = "";
      $("#evLugar").value = "";
      $("#evTipo").value = "";
    } catch {}

    await cargarEventos({ force: true });
  }

  // =========================
  // Modal editar (overlay correcto)
  // =========================
  function openEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("show");

    JC.uiState.eventsOpen = true;
    window.jcSyncOverlay?.();
  }

  function closeEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";

    JC.uiState.eventsOpen = false;
    window.jcSyncOverlay?.();
  }

  // =========================
  // Bind UI (una vez)
  // =========================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    r.btnRefresh?.addEventListener("click", () => cargarEventos({ force: true }));
    r.filtroTipo?.addEventListener("change", () => cargarEventos({ force: true }));
    r.evScope?.addEventListener("change", () => cargarEventos({ force: true }));

    r.evSearch?.addEventListener("input", () => {
      clearTimeout(bindUI.__t);
      bindUI.__t = setTimeout(() => cargarEventos({ force: true }), 250);
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
      if (r.editEstado) r.editEstado.textContent = "✅ Guardado (pendiente Supabase).";
    });

    r.editDelete?.addEventListener("click", () => {
      if (r.editEstado) r.editEstado.textContent = "🗑️ Borrado (pendiente Supabase).";
    });

    // Exponer compat
    window.jcEventos = window.jcEventos || {};
    window.jcEventos.refreshAuth = async () => {
      setGate();
      await cargarEventos({ force: true });
    };
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

  JC.events = {
    init,
    setGate,
    cargarEventos,
    openEditModal,
    closeEditModal
  };
})();