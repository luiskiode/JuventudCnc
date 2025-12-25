// js/events.js
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

      // modal editar (stub)
      modal: $("#evModal"),
      modalClose: $("#evModalClose"),
      editForm: $("#evEditForm"),
      editEstado: $("#evEditEstado"),
      editDelete: $("#evEditDelete")
    };
  }

  // Estado interno
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
  // Gate (permiso crear/editar)
  // =========================
  function setGate() {
    const { gate, wrapCreate } = refs();

    if (!isLogged()) {
      if (gate) gate.textContent = "🔒 Inicia sesión para ver tu estado de miembro.";
      if (wrapCreate) wrapCreate.style.display = "none";
      return;
    }

    if (!isMember()) {
      if (gate) gate.textContent = "🔒 Registra tu perfil para gestionar eventos.";
      if (wrapCreate) wrapCreate.style.display = "none";
      return;
    }

    if (gate) gate.textContent = "✅ Miembro activo: puedes crear/editar eventos.";
    if (wrapCreate) wrapCreate.style.display = "block";
  }

  // =========================
  // Render placeholder (hasta conectar Supabase)
  // =========================
  function renderEmpty(listEl, msg) {
    if (!listEl) return;
    listEl.innerHTML = `<li class="muted small">${msg}</li>`;
  }

  function renderListPlaceholder() {
    const { list, listHome } = refs();

    if (!isLogged()) {
      renderEmpty(list, "🔒 Inicia sesión para ver eventos.");
      renderEmpty(listHome, "🔒 Inicia sesión para ver eventos.");
      return;
    }

    // Si aún no hay lógica real de DB, al menos no se ve “muerto”
    const msg = isMember()
      ? "📅 Eventos listos (pendiente conectar a Supabase + calendario real)."
      : "🔒 Regístrate (perfil) para ver y gestionar eventos.";

    renderEmpty(list, msg);
    renderEmpty(listHome, msg);
  }

  // =========================
  // Calendario (skeleton seguro)
  // =========================
  function monthLabel(d) {
    try {
      return d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    } catch {
      return "Mes";
    }
  }

  function renderCalendarSkeleton() {
    const { calendar, calLabel } = refs();
    if (!calendar) return;

    if (calLabel) {
      const s = monthLabel(st.calDate);
      calLabel.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    }

    // grid simple del mes (sin data aún, pero clickeable)
    calendar.innerHTML = "";

    const y = st.calDate.getFullYear();
    const m = st.calDate.getMonth();
    const first = new Date(y, m, 1);
    const startDay = (first.getDay() + 6) % 7; // 0=L
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    // fillers anteriores
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
        // hint + botón “ver todos”
        const { dayHint, clearDay } = refs();
        if (dayHint) dayHint.textContent = st.selectedDayISO ? `Filtrado: ${st.selectedDayISO}` : "Toca un día para filtrar";
        if (clearDay) clearDay.style.display = st.selectedDayISO ? "" : "none";

        // re-render del calendario para marcar selección
        renderCalendarSkeleton();

        // refresca lista (cuando conectemos DB, filtra)
        cargarEventos({ force: true });
      });

      calendar.appendChild(cell);
    }
  }

  // =========================
  // Carga eventos (placeholder, pero con hooks listos)
  // =========================
  async function cargarEventos({ force = false } = {}) {
    // Aquí va la query real a Supabase (eventos por scope + filtros + día seleccionado)
    // Por ahora dejamos placeholder para que no se sienta roto
    renderListPlaceholder();
  }

  // =========================
  // Crear evento (stub seguro)
  // =========================
  async function crearEventoFromForm() {
    const { form, estado } = refs();
    if (!form || !estado) return;

    if (!isLogged()) {
      estado.textContent = "🔒 Inicia sesión primero.";
      return;
    }
    if (!isMember()) {
      estado.textContent = "🔒 Regístrate (perfil) para crear eventos.";
      return;
    }

    // inputs reales (ids del index)
    const titulo = $("#evTitulo")?.value?.trim();
    const fecha = $("#evFecha")?.value;
    const lugar = $("#evLugar")?.value?.trim();
    const tipo = $("#evTipo")?.value;

    if (!titulo || !fecha) {
      estado.textContent = "Completa al menos Título y Fecha.";
      return;
    }

    // Aquí va el insert real a Supabase
    estado.textContent = "✅ Evento listo (pendiente conectar a Supabase).";
    try {
      window.logAviso?.({ title: "Eventos", body: `Evento preparado: ${titulo}` });
      window.miaSetEstado?.("apoyo");
    } catch {}

    // Limpia (opcional)
    try {
      $("#evTitulo").value = "";
      $("#evFecha").value = "";
      $("#evLugar").value = "";
      $("#evTipo").value = "";
    } catch {}

    await cargarEventos({ force: true });
  }

  // =========================
  // Bind UI (una vez)
  // =========================
  function bindUI() {
    if (st.bound) return;
    st.bound = true;

    const r = refs();

    // Refresh
    r.btnRefresh?.addEventListener("click", () => cargarEventos({ force: true }));

    // Filtros (cuando conectemos DB, aplican)
    r.filtroTipo?.addEventListener("change", () => cargarEventos({ force: true }));
    r.evScope?.addEventListener("change", () => cargarEventos({ force: true }));
    r.evSearch?.addEventListener("input", () => {
      // debounce simple
      clearTimeout(bindUI.__t);
      bindUI.__t = setTimeout(() => cargarEventos({ force: true }), 250);
    });
    r.evSort?.addEventListener("change", () => cargarEventos({ force: true }));

    // Crear evento
    r.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      crearEventoFromForm();
    });

    // Calendario nav
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
      const { dayHint, clearDay } = refs();
      if (dayHint) dayHint.textContent = "Toca un día para filtrar";
      if (clearDay) clearDay.style.display = "none";
      renderCalendarSkeleton();
      cargarEventos({ force: true });
    });

    // Modal editar (stub, no rompe)
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

    // Exponer para auth.js (compat)
    window.jcEventos = window.jcEventos || {};
    window.jcEventos.refreshAuth = async () => {
      setGate();
      await cargarEventos({ force: true });
    };
  }

  function openEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("show");
    try {
      // reusa overlay global para no crear otro estado
      window.jcState && (window.jcState.loginOpen = true);
      window.jcSyncOverlay?.();
    } catch {}
  }

  function closeEditModal() {
    const { modal } = refs();
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
    try {
      window.jcState && (window.jcState.loginOpen = false);
      window.jcSyncOverlay?.();
    } catch {}
  }

  // =========================
  // Init
  // =========================
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
