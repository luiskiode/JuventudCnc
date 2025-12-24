// js/profile.js
(function () {
  const JC = window.JC;

  async function loadProfile() {
    JC.state.profile = null;
    JC.state.isMember = false;

    const user = JC.state.user;
    if (!user) {
      JC.emit("profile:changed", { profile: null, isMember: false });
      return;
    }

    // Asumimos tabla: miembros (ajústalo si tu tabla tiene otro nombre)
    const { data, error } = await JC.sb
      .from("miembros")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) console.warn("[profile] load error", error);

    JC.state.profile = data || null;
    JC.state.isMember = !!data;

    JC.emit("profile:changed", { profile: JC.state.profile, isMember: JC.state.isMember });
  }

  function paintProfile() {
    const p = JC.state.profile;
    const user = JC.state.user;

    const nombre = JC.$("#perfilNombreTexto");
    const rol = JC.$("#perfilRolTexto");
    const frase = JC.$("#perfilFraseTexto");
    const estado = JC.$("#perfilEstado");
    const btnCerrar = JC.$("#btnCerrarPerfil");

    if (!user) {
      nombre && (nombre.textContent = "Aún sin registrar");
      rol && (rol.textContent = "");
      frase && (frase.textContent = "Aquí aparecerá tu frase.");
      estado && (estado.textContent = "Inicia sesión para registrar tu perfil.");
      btnCerrar && (btnCerrar.style.display = "none");
      return;
    }

    btnCerrar && (btnCerrar.style.display = "inline-flex");

    if (!p) {
      nombre && (nombre.textContent = user.email || "Usuario");
      rol && (rol.textContent = "🔒 No registrado aún");
      frase && (frase.textContent = "Completa el formulario para activar tu perfil.");
      estado && (estado.textContent = "Falta registrar tu perfil.");
      return;
    }

    nombre && (nombre.textContent = p.nombre || user.email || "Miembro");
    rol && (rol.textContent = p.rol_key ? `Rol: ${p.rol_key}` : "");
    frase && (frase.textContent = p.frase || "—");
    estado && (estado.textContent = "✅ Perfil cargado.");
  }

  async function saveProfileFromForm(form) {
    const user = JC.state.user;
    if (!user) return;

    const fd = new FormData(form);
    const payload = {
      user_id: user.id,
      email: user.email,
      nombre: String(fd.get("nombre") || "").trim(),
      edad: Number(fd.get("edad") || 0) || null,
      contacto: String(fd.get("contacto") || "").trim(),
      ministerio: String(fd.get("ministerio") || "").trim(),
      rol_key: String(fd.get("rol_key") || "miembro"),
      frase: String(fd.get("frase") || "").trim(),
      updated_at: new Date().toISOString(),
    };

    const estado = JC.$("#perfilEstado");
    try {
      estado && (estado.textContent = "Guardando perfil…");

      const { error } = await JC.sb.from("miembros").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      estado && (estado.textContent = "✅ Perfil guardado.");
      await loadProfile();
      paintProfile();
    } catch (e) {
      console.error(e);
      estado && (estado.textContent = "❌ Error guardando perfil.");
    }
  }

  function bindUI() {
    // Guardar perfil
    JC.$("#formMiembro")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveProfileFromForm(e.currentTarget);
    });

    // Cerrar sesión
    JC.$("#btnCerrarPerfil")?.addEventListener("click", async () => {
      await JC.sb.auth.signOut();
      JC.state.user = null;
      await loadProfile();
      paintProfile();
    });

    // Botón topbar perfil
    JC.$("#btnPerfil")?.addEventListener("click", () => JC.ui?.activate("perfil"));
  }

  async function init() {
    bindUI();

    JC.on("auth:changed", async () => {
      await loadProfile();
      paintProfile();
    });

    // primer paint
    await loadProfile();
    paintProfile();
  }

  JC.profile = { init, loadProfile, paintProfile };
})();