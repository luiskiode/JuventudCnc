// js/profile.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};
  JC.state.profile = JC.state.profile ?? null;
  JC.state.isMember = JC.state.isMember ?? false;
  JC.state.user = JC.state.user ?? null;

  // ✅ Cliente correcto (alias estándar)
  JC.sb = JC.sb || window.sb || window.supabaseClient;

  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

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

  function showRegisterBox(show) {
    const { registerBox } = uiRefs();
    if (registerBox) registerBox.style.display = show ? "" : "none";
  }

  function showForm(show) {
    const { form } = uiRefs();
    if (form) form.style.display = show ? "" : "none";
  }

  async function getUser() {
    if (window.currentUser) return window.currentUser;
    const sb = JC.sb;
    if (!sb?.auth?.getSession) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.user ?? null;
    } catch {
      return null;
    }
  }

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

  function paintProfile() {
    const r = uiRefs();
    const user = JC.state.user;
    const p = JC.state.profile;

    if (!user) {
      setGate("🔑 No has iniciado sesión.");
      showBox(false);

      if (r.nombre) r.nombre.textContent = "—";
      if (r.email) r.email.textContent = "—";
      if (r.fraseView) r.fraseView.textContent = "—";
      if (r.avatar) r.avatar.src = "";
      if (r.estado) r.estado.textContent = "";
      return;
    }

    showBox(true);

    // Gate
    if (JC.state.isMember) {
      setGate("✅ Perfil activo.");
      showRegisterBox(false);
      // Puedes ocultar el form si quieres “modo tarjeta”
      // Yo lo dejo visible como edición, pero si quieres ocultarlo:
      // showForm(false);
      showForm(true);
    } else {
      setGate("📝 Completa tu perfil para registrarte como miembro.");
      showRegisterBox(true);
      showForm(true);
    }

    // Vista
    if (r.nombre) r.nombre.textContent = p?.nombre || user.email || "Usuario";
    if (r.email) r.email.textContent = user.email || "—";
    if (r.fraseView) r.fraseView.textContent = p?.frase ? `“${p.frase}”` : "—";

    // Avatar
    if (r.avatar) {
      r.avatar.src = p?.avatar_url || "";
    }

    // Prefill inputs sin machacar
    try {
      const active = document.activeElement;

      if (r.nombreInput && active !== r.nombreInput) r.nombreInput.value = p?.nombre || "";
      if (r.aliasInput && active !== r.aliasInput) r.aliasInput.value = p?.alias || "";
      if (r.fraseInput && active !== r.fraseInput) r.fraseInput.value = p?.frase || "";
      if (r.rolInput && active !== r.rolInput) r.rolInput.value = p?.rol_key || "miembro";
    } catch {}

    if (r.estado) {
      r.estado.textContent = JC.state.isMember
        ? "✅ Eres miembro registrado."
        : "🔒 Aún no estás registrado. Guarda tu perfil para activarlo.";
    }
  }

  async function uploadAvatarIfAny(userId) {
    const sb = JC.sb;
    const { avatarInput } = uiRefs();
    const file = avatarInput?.files?.[0];
    if (!file || !sb?.storage) return null;

    // Bucket que tú ya usabas:
    const bucket = "miembros";

    // Ruta estable por usuario
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    // Sube con upsert
    const up = await sb.storage.from(bucket).upload(path, file, {
      upsert: true,
      cacheControl: "3600"
    });

    if (up.error) throw up.error;

    // Obtén URL pública
    const pub = sb.storage.from(bucket).getPublicUrl(path);
    return pub?.data?.publicUrl || null;
  }

  async function saveProfileFromUI() {
    const sb = JC.sb;
    if (!sb) return;

    const r = uiRefs();
    const user = await getUser();
    JC.state.user = user;

    if (!user) {
      if (r.estado) r.estado.textContent = "🔑 Inicia sesión para guardar tu perfil.";
      return;
    }

    // nombre es NOT NULL en tu tabla -> obligatorio
    const nombre = String(r.nombreInput?.value || "").trim();
    if (!nombre) {
      if (r.estado) r.estado.textContent = "Escribe tu nombre (obligatorio).";
      return;
    }

    try {
      if (r.estado) r.estado.textContent = "Guardando perfil…";

      // 1) avatar (opcional)
      let avatarUrl = JC.state.profile?.avatar_url || null;
      try {
        const newUrl = await uploadAvatarIfAny(user.id);
        if (newUrl) avatarUrl = newUrl;
      } catch (e) {
        console.warn("[profile] avatar upload failed:", e);
        // no bloqueamos el guardado del perfil si falla la foto
      }

      const payload = {
        user_id: user.id,
        email: user.email || null,
        nombre,
        alias: String(r.aliasInput?.value || "").trim() || null,
        frase: String(r.fraseInput?.value || "").trim() || null,
        rol_key: String(r.rolInput?.value || "").trim() || "miembro",
        avatar_url: avatarUrl,
        estado: "activo",
        updated_at: new Date().toISOString()
      };

      const { error } = await sb.from("miembros").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      if (r.estado) r.estado.textContent = "✅ Perfil guardado.";

      // Limpia input de file para no re-subir accidentalmente
      if (r.avatarInput) {
        try { r.avatarInput.value = ""; } catch {}
      }

      await loadProfile();
      paintProfile();
    } catch (e) {
      console.error("[profile] save error", e);
      if (r.estado) r.estado.textContent = `❌ Error guardando perfil: ${e?.message || "revisa permisos/RLS"}`;
    }
  }

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

    // Preview local del avatar al seleccionar
    r.avatarInput?.addEventListener("change", () => {
      const f = r.avatarInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      if (r.avatar) r.avatar.src = url;
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1500);
    });
  }

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
    save: saveProfileFromUI
  };
})();