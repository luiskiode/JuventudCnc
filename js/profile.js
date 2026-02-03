// js/profile.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};
  JC.state.profile = JC.state.profile ?? null;
  JC.state.isMember = JC.state.isMember ?? false;
  JC.state.user = JC.state.user ?? null;

  // ✅ Siempre toma el cliente correcto (no lo “congeles” al cargar)
  function getSB() {
    return window.sb || window.supabaseClient || JC.sb || null;
  }

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

  // ============================================================
  // Refs UI (IDs del index actual)
  // ============================================================
  function uiRefs() {
    return {
      gate: $("#perfilGate"),
      box: $("#perfilBox"),
      hint: $("#perfilHint"),

      avatar: $("#perfilAvatar"),
      fraseView: $("#perfilFraseView"),
      registerBox: $("#perfilRegisterBox"),

      nombre: $("#perfilNombre"),
      email: $("#perfilEmail"),

      form: $("#perfilForm"),
      avatarInput: $("#perfilAvatarInput"),
      nombreInput: $("#perfilNombreInput"),
      aliasInput: $("#perfilAliasInput"),
      fraseInput: $("#perfilFraseInput"),
      rolInput: $("#perfilRolInput"),
      emailInput: $("#perfilEmailInput"), // ✅ (nuevo en index) readonly
      estado: $("#perfilEstado"),

      btnLogout: $("#btnLogout"),
      btnRefresh: $("#btnPerfilRefresh"),
    };
  }

  function setGate(msg) {
    const { gate } = uiRefs();
    if (gate) gate.textContent = msg || "";
  }

  // ✅ Cuando NO hay sesión: mostrar hint y esconder box.
  // ✅ Cuando hay sesión: mostrar box y esconder hint.
  function showBox(show) {
    const { box, hint } = uiRefs();
    if (box) box.style.display = show ? "" : "none";
    if (hint) hint.style.display = show ? "none" : "";
  }

  function showRegisterBox(show) {
    const { registerBox } = uiRefs();
    if (registerBox) registerBox.style.display = show ? "" : "none";
  }

  function showForm(show) {
    const { form } = uiRefs();
    if (form) form.style.display = show ? "" : "none";
  }

  // ============================================================
  // Auth helpers
  // ============================================================
  async function getUser() {
    if (window.currentUser) return window.currentUser;

    const sb = getSB();
    if (!sb?.auth?.getSession) return null;

    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user ?? null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // Load profile (tabla: miembros)
  // ============================================================
  async function loadProfile() {
    JC.state.profile = null;
    JC.state.isMember = false;

    const sb = getSB();
    if (!sb) {
      console.warn("[profile] Supabase no disponible");
      JC.emit("profile:changed", { profile: null, isMember: false, user: null });
      return { profile: null, isMember: false, user: null };
    }

    const user = await getUser();
    JC.state.user = user;

    if (!user) {
      JC.emit("profile:changed", { profile: null, isMember: false, user: null });
      return { profile: null, isMember: false, user: null };
    }

    try {
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
        isMember: JC.state.isMember,
        user,
      });

      return { profile: JC.state.profile, isMember: JC.state.isMember, user };
    } catch (e) {
      console.error("[profile] load exception", e);
      JC.state.profile = null;
      JC.state.isMember = false;
      JC.emit("profile:changed", { profile: null, isMember: false, user });
      return { profile: null, isMember: false, user };
    }
  }

  // ============================================================
  // Paint profile (UI)
  // ============================================================
  function paintProfile() {
    const r = uiRefs();
    const user = JC.state.user;
    const p = JC.state.profile;

    // Si la vista ni existe, no hagas nada
    if (!r.gate && !r.box && !r.hint) return;

    if (!user) {
      setGate("🔑 No has iniciado sesión.");
      showBox(false);

      if (r.nombre) r.nombre.textContent = "—";
      if (r.email) r.email.textContent = "—";
      if (r.fraseView) r.fraseView.textContent = "—";
      if (r.avatar) r.avatar.src = "";
      if (r.estado) r.estado.textContent = "";
      showRegisterBox(false);
      showForm(false);
      return;
    }

    showBox(true);

    // ✅ Vista “tarjeta” (siempre visible con sesión)
    if (r.nombre) r.nombre.textContent = p?.nombre || user.email || "Usuario";
    if (r.email) r.email.textContent = user.email || "—";
    if (r.fraseView) r.fraseView.textContent = p?.frase ? `“${p.frase}”` : "—";
    if (r.avatar) r.avatar.src = p?.avatar_url || "";

    // ✅ Si existe campo email en el formulario, rellenarlo (readonly)
    try {
      if (r.emailInput) r.emailInput.value = user.email || "";
    } catch {}

    // ✅ REGLA PRINCIPAL:
    // - Si YA es miembro: ocultar el formulario de registro.
    // - Si NO es miembro: mostrarlo para completar registro.
    if (JC.state.isMember) {
      setGate("✅ Perfil activo.");
      showRegisterBox(false);
      showForm(false); // 🔥 aquí está el cambio importante

      if (r.estado) r.estado.textContent = "✅ Perfil registrado. Puedes iniciar sesión en cualquier dispositivo con tu correo.";
    } else {
      setGate("📝 Completa tu perfil para registrarte como miembro.");
      showRegisterBox(true);
      showForm(true);

      if (r.estado) r.estado.textContent = "🔒 Aún no estás registrado. Guarda tu perfil para activarlo.";
    }

    // Prefill inputs SOLO cuando toca registro (no pisar al usuario y no mostrar si está oculto)
    if (!JC.state.isMember) {
      try {
        const active = document.activeElement;
        if (r.nombreInput && active !== r.nombreInput) r.nombreInput.value = p?.nombre || "";
        if (r.aliasInput && active !== r.aliasInput) r.aliasInput.value = p?.alias || "";
        if (r.fraseInput && active !== r.fraseInput) r.fraseInput.value = p?.frase || "";
        if (r.rolInput && active !== r.rolInput) r.rolInput.value = p?.rol_key || "miembro";
      } catch {}
    }
  }

  // ============================================================
  // Avatar upload (Storage)
  // ============================================================
  async function uploadAvatarIfAny(userId) {
    const sb = getSB();
    const { avatarInput } = uiRefs();
    const file = avatarInput?.files?.[0];
    if (!file || !sb?.storage) return null;

    // Bucket actual (según tu implementación previa)
    const bucket = "miembros";

    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const ext = ["png", "jpg", "jpeg", "webp"].includes(rawExt) ? rawExt : "jpg";

    const path = `${userId}/avatar.${ext}`;

    const up = await sb.storage.from(bucket).upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });

    if (up.error) throw up.error;

    const pub = sb.storage.from(bucket).getPublicUrl(path);
    return pub?.data?.publicUrl || null;
  }

  // ============================================================
  // Save profile (registro)
  // ============================================================
  async function saveProfileFromUI() {
    const sb = getSB();
    if (!sb) return;

    const r = uiRefs();
    const user = await getUser();
    JC.state.user = user;

    if (!user) {
      if (r.estado) r.estado.textContent = "🔑 Inicia sesión para guardar tu perfil.";
      return;
    }

    const nombre = String(r.nombreInput?.value || "").trim();
    if (!nombre) {
      if (r.estado) r.estado.textContent = "Escribe tu nombre (obligatorio).";
      return;
    }

    const rolKey = String(r.rolInput?.value || "").trim() || "miembro";

    try {
      if (r.estado) r.estado.textContent = "Guardando perfil…";

      // 1) avatar (opcional)
      let avatarUrl = JC.state.profile?.avatar_url || null;
      try {
        const newUrl = await uploadAvatarIfAny(user.id);
        if (newUrl) avatarUrl = newUrl;
      } catch (e) {
        console.warn("[profile] avatar upload failed:", e);
      }

      const payload = {
        user_id: user.id,
        email: user.email || null,
        nombre,
        alias: String(r.aliasInput?.value || "").trim() || null,
        frase: String(r.fraseInput?.value || "").trim() || null,
        rol_key: rolKey,
        avatar_url: avatarUrl,
        estado: "activo",
      };

      // ✅ requiere UNIQUE sobre user_id para onConflict
      const { error } = await sb.from("miembros").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      if (r.estado) r.estado.textContent = "✅ Perfil guardado.";

      // Limpia input file
      if (r.avatarInput) {
        try { r.avatarInput.value = ""; } catch {}
      }

      await loadProfile();
      paintProfile(); // 🔥 aquí se ocultará el form por ser miembro
    } catch (e) {
      console.error("[profile] save error", e);
      if (r.estado) r.estado.textContent = `❌ Error guardando perfil: ${e?.message || "revisa permisos/RLS"}`;
    }
  }

  // ============================================================
  // Logout
  // ============================================================
  async function logout() {
    const sb = getSB();
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

      JC.emit("auth:changed", { user: null });
      JC.emit("profile:changed", { profile: null, isMember: false, user: null });
    }
  }

  // ============================================================
  // Bind UI
  // ============================================================
  let __bound = false;
  function bindUI() {
    if (__bound) return;
    __bound = true;

    const r = uiRefs();

    r.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveProfileFromUI();
    });

    r.btnLogout?.addEventListener("click", logout);

    r.btnRefresh?.addEventListener("click", async () => {
      setGate("Actualizando…");
      await loadProfile();
      paintProfile();
    });

    // Preview local del avatar
    r.avatarInput?.addEventListener("change", () => {
      const f = r.avatarInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      if (r.avatar) r.avatar.src = url;
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 1500);
    });
  }

  // ============================================================
  // Auth listener (UNA VEZ, sin pelear con auth.js)
  // ============================================================
  function bindAuthListenerOnce() {
    const sb = getSB();
    if (!sb?.auth?.onAuthStateChange) return;

    if (window.__JC_PROFILE_AUTH_BOUND__) return;
    window.__JC_PROFILE_AUTH_BOUND__ = true;

    sb.auth.onAuthStateChange(async (_event, session) => {
      window.currentUser = session?.user ?? null;
      JC.state.user = window.currentUser;

      JC.emit("auth:changed", { user: window.currentUser });

      await loadProfile();
      paintProfile();
    });
  }

  // ============================================================
  // Init
  // ============================================================
  async function init() {
    bindUI();
    bindAuthListenerOnce();

    setGate("Cargando…");
    await loadProfile();
    paintProfile();

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
    save: saveProfileFromUI,
    logout,
  };
})();