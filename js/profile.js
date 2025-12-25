// js/profile.js
(function () {
  "use strict";

  // Namespace + estado base
  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};
  JC.state.profile = JC.state.profile ?? null;
  JC.state.isMember = JC.state.isMember ?? false;
  JC.state.user = JC.state.user ?? null;

  // Supabase (tu app usa window.supabaseClient)
  JC.sb = JC.sb || window.supabaseClient;

  // Helpers mínimos
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

  // Event bus simple (si no existe en tu base)
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

  // --------- UI refs (IDs reales del index que pegaste)
  function uiRefs() {
    return {
      gate: $("#perfilGate"),
      box: $("#perfilBox"),
      hint: $("#perfilHint"),
      nombre: $("#perfilNombre"),
      email: $("#perfilEmail"),
      form: $("#perfilForm"),
      nombreInput: $("#perfilNombreInput"),
      rolInput: $("#perfilRolInput"),
      estado: $("#perfilEstado"),
      btnLogout: $("#btnLogout"),
      btnRefresh: $("#btnPerfilRefresh")
    };
  }

  function setGate(msg) {
    const { gate } = uiRefs();
    if (gate) gate.textContent = msg || "";
  }

  function showBox(show) {
    const { box, hint } = uiRefs();
    if (box) box.style.display = show ? "" : "none";
    if (hint) hint.style.display = show ? "none" : "";
  }

  async function getUser() {
    // Fuente 1: global definido por auth.js
    if (window.currentUser) return window.currentUser;

    // Fuente 2: sesión actual de supabase
    const sb = JC.sb;
    if (!sb?.auth?.getSession) return null;

    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user ?? null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // DATA: cargar perfil desde Supabase
  // ============================================================
  async function loadProfile() {
    JC.state.profile = null;
    JC.state.isMember = false;

    const sb = JC.sb;
    if (!sb) {
      console.warn("[profile] Supabase no disponible");
      JC.emit("profile:changed", { profile: null, isMember: false });
      return;
    }

    const user = await getUser();
    JC.state.user = user;

    if (!user) {
      JC.emit("profile:changed", { profile: null, isMember: false });
      return;
    }

    try {
      // Tabla esperada: miembros (como tu código)
      const { data, error } = await sb
        .from("miembros")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("[profile] load error", error);
        JC.state.profile = null;
        JC.state.isMember = false;
      } else {
        JC.state.profile = data || null;
        JC.state.isMember = !!data;
      }

      JC.emit("profile:changed", {
        profile: JC.state.profile,
        isMember: JC.state.isMember
      });
    } catch (e) {
      console.error("[profile] load exception", e);
      JC.state.profile = null;
      JC.state.isMember = false;
      JC.emit("profile:changed", { profile: null, isMember: false });
    }
  }

  // ============================================================
  // UI: pintar perfil
  // ============================================================
  function paintProfile() {
    const { nombre, email, nombreInput, rolInput, estado } = uiRefs();
    const user = JC.state.user;
    const p = JC.state.profile;

    if (!user) {
      setGate("🔑 No has iniciado sesión.");
      showBox(false);

      if (nombre) nombre.textContent = "—";
      if (email) email.textContent = "—";
      if (estado) estado.textContent = "";
      return;
    }

    // Logueado
    setGate(JC.state.isMember ? "✅ Perfil cargado." : "📝 Completa tu perfil para registrarte como miembro.");
    showBox(true);

    if (nombre) nombre.textContent = p?.nombre || user.email || "Usuario";
    if (email) email.textContent = user.email || "—";

    // Prefill inputs (sin machacar si el usuario está escribiendo)
    try {
      const active = document.activeElement;
      if (nombreInput && active !== nombreInput) nombreInput.value = p?.nombre || "";
      if (rolInput && active !== rolInput) rolInput.value = p?.rol_key || p?.rol || "";
    } catch {}

    if (estado) {
      estado.textContent = JC.state.isMember
        ? "✅ Eres miembro registrado."
        : "🔒 Aún no estás registrado como miembro. Guarda tu perfil para activarlo.";
    }
  }

  // ============================================================
  // Guardar perfil desde el formulario actual (#perfilForm)
  // ============================================================
  async function saveProfileFromUI() {
    const sb = JC.sb;
    if (!sb) return;

    const { nombreInput, rolInput, estado } = uiRefs();
    const user = await getUser();
    JC.state.user = user;

    if (!user) {
      if (estado) estado.textContent = "🔑 Inicia sesión para guardar tu perfil.";
      return;
    }

    const payload = {
      user_id: user.id,
      email: user.email || null,
      nombre: String(nombreInput?.value || "").trim() || null,
      rol_key: String(rolInput?.value || "").trim() || "miembro",
      updated_at: new Date().toISOString()
    };

    try {
      if (estado) estado.textContent = "Guardando perfil…";

      const { error } = await sb.from("miembros").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      if (estado) estado.textContent = "✅ Perfil guardado.";
      await loadProfile();
      paintProfile();
    } catch (e) {
      console.error("[profile] save error", e);
      if (estado) estado.textContent = `❌ Error guardando perfil: ${e?.message || "revisa permisos/RLS"}`;
    }
  }

  // ============================================================
  // Cerrar sesión
  // ============================================================
  async function logout() {
    const sb = JC.sb;
    const { estado } = uiRefs();
    try {
      if (estado) estado.textContent = "Cerrando sesión…";
      await sb?.auth?.signOut?.();
    } catch (e) {
      console.warn("[profile] signOut error", e);
    } finally {
      window.currentUser = null;
      JC.state.user = null;
      JC.state.profile = null;
      JC.state.isMember = false;
      paintProfile();
      setGate("🔑 Sesión cerrada.");
    }
  }

  // ============================================================
  // Bind UI
  // ============================================================
  let __bound = false;
  function bindUI() {
    if (__bound) return;
    __bound = true;

    const { form, btnLogout, btnRefresh } = uiRefs();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveProfileFromUI();
    });

    btnLogout?.addEventListener("click", logout);

    btnRefresh?.addEventListener("click", async () => {
      setGate("Actualizando…");
      await loadProfile();
      paintProfile();
    });
  }

  // ============================================================
  // Suscripción a cambios de auth (sin depender de JC.normalizeTab ni eventos externos)
  // ============================================================
  function bindAuthListenerOnce() {
    const sb = JC.sb;
    if (!sb?.auth?.onAuthStateChange) return;

    if (window.__JC_PROFILE_AUTH_BOUND__) return;
    window.__JC_PROFILE_AUTH_BOUND__ = true;

    sb.auth.onAuthStateChange(async (_event, session) => {
      window.currentUser = session?.user ?? null;
      JC.state.user = window.currentUser;

      await loadProfile();
      paintProfile();
    });
  }

  // ============================================================
  // API pública
  // ============================================================
  async function init() {
    bindUI();
    bindAuthListenerOnce();

    // Primer render
    setGate("Cargando…");
    await loadProfile();
    paintProfile();

    // Compat con auth.js (tu auth llama window.cargarPerfil?.())
    window.cargarPerfil = async function () {
      await loadProfile();
      paintProfile();
      return { profile: JC.state.profile, isMember: JC.state.isMember };
    };

    return true;
  }

  JC.profile = {
    init,
    loadProfile,
    paintProfile,
    save: saveProfileFromUI
  };
})();
