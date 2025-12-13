/* ============================================================
   Juventud CNC — app.js (FULL)
   ============================================================ */

/* ============================================================
   BOOT / CONSTANTS
============================================================ */
const LOCALE = "es-PE";
const TZ = "America/Lima";

function SB() {
  return window.supabaseClient;
}

function hasSB() {
  return !!SB()?.from;
}

function safeEl(id) {
  return document.getElementById(id);
}

function setText(id, txt) {
  const el = safeEl(id);
  if (el) el.textContent = txt ?? "";
}

function nowISO() {
  return new Date().toISOString();
}

/* ============================================================
   DRAWER / OVERLAY
============================================================ */
const drawer = safeEl("drawer");
const overlay = safeEl("overlay");
const openDrawerBtn = safeEl("openDrawer");
const closeDrawerBtn = safeEl("closeDrawer");

function openDrawer() {
  drawer?.classList.add("open");
  overlay?.classList.add("show");
}

function closeDrawer() {
  drawer?.classList.remove("open");
  // OJO: overlay también lo usa el panel de Angie; si Angie está abierto, su propio script lo gestiona.
  overlay?.classList.remove("show");
}

openDrawerBtn?.addEventListener("click", openDrawer);
closeDrawerBtn?.addEventListener("click", closeDrawer);

// Overlay: cierra drawer + cierra panel Angie si existe
overlay?.addEventListener("click", () => {
  if (drawer?.classList.contains("open")) closeDrawer();
  // Si el panel Angie está abierto, el index ya expone window.jcCloseAngiePanel
  window.jcCloseAngiePanel?.();
});

/* ============================================================
   TABS / SPA
============================================================ */
const tabs = Array.from(document.querySelectorAll(".tab"));
const views = Array.from(document.querySelectorAll(".view"));

function activate(tab) {
  const t = typeof tab === "string" ? tab : tab?.dataset?.tab;
  if (!t) return;

  tabs.forEach((b) => {
    const on = b.dataset.tab === t;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  views.forEach((v) => v.classList.toggle("active", v.dataset.view === t));

  if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);

  // Hooks por vista
  if (t === "miembros-activos") cargarListaMiembros();
  if (t === "recursos") listarRecursos();

  // Bots + chat
  angieSegunVista(t);
  jcChatPlayScene(t);
}

window.activate = activate;

document.querySelectorAll("[data-tab]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    activate(el.getAttribute("data-tab"));
    closeDrawer();
    // si Angie panel estaba abierto, no lo cerramos aquí (tú decides desde el botón 🎨)
  });
});

window.addEventListener("hashchange", () => {
  activate((location.hash || "#inicio").replace("#", ""));
});

/* ============================================================
   FORMATO FECHAS
============================================================ */
const fmtDate = (d) =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);

const fmtTime = (d) =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/* ============================================================
   EVENTOS
============================================================ */
async function cargarEventos({ destinoId = "eventList", tipo = "" } = {}) {
  const sb = SB();
  if (!sb?.from) return;

  let q = sb
    .from("eventos")
    .select("*")
    .gte("fecha", nowISO())
    .order("fecha", { ascending: true });

  if (tipo) q = q.eq("tipo", tipo);

  const { data, error } = await q.limit(50);
  if (error) {
    console.error("cargarEventos error:", error);
    return;
  }

  const ul = safeEl(destinoId);
  if (!ul) return;

  ul.innerHTML = "";

  (data || []).forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-item";
    const fecha = new Date(ev.fecha);

    li.innerHTML = `
      <span class="event-title">${ev.titulo || "Evento"}</span>
      <span class="event-meta">${fmtDate(fecha)} ${fmtTime(fecha)}</span>
    `;

    // click -> maps si hay lugar
    li.addEventListener("click", () => {
      const lugar = (ev.lugar || "").trim();
      if (!lugar) return;
      const q = encodeURIComponent(lugar);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
    });

    ul.appendChild(li);
  });
}

async function cargarEventosHome() {
  const sb = SB();
  if (!sb?.from) return;

  const ul = safeEl("eventListHome");
  if (!ul) return;

  const { data, error } = await sb
    .from("eventos")
    .select("*")
    .gte("fecha", nowISO())
    .order("fecha", { ascending: true })
    .limit(4);

  if (error) {
    console.error("cargarEventosHome error:", error);
    return;
  }

  ul.innerHTML = "";

  (data || []).forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-item";
    const fecha = new Date(ev.fecha);
    const meta = `${new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      month: "short",
      day: "numeric",
    }).format(fecha)} · ${fmtTime(fecha)}`;

    li.innerHTML = `
      <span class="event-title">${ev.titulo || "Evento"}</span>
      <span class="event-meta">${meta}</span>
    `;
    ul.appendChild(li);
  });
}

safeEl("filtroTipo")?.addEventListener("change", (e) => {
  cargarEventos({ destinoId: "eventList", tipo: e.target.value });
});

/* ============================================================
   MENSAJE SEMANAL
============================================================ */
async function cargarMensajeSemanal() {
  const sb = SB();
  if (!sb?.from) return;

  const monday = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const { data, error } = await sb
    .from("mensaje_semanal")
    .select("*")
    .eq("semana_start", monday.toISOString().slice(0, 10))
    .maybeSingle();

  if (error) console.error("cargarMensajeSemanal:", error);

  setText("msgTitle", data?.titulo || "Mensaje semanal");
  setText("msgBody", data?.contenido || "Vuelve pronto.");
  setText(
    "msgMeta",
    data
      ? `Por ${data.autor || "—"} • ${new Date(data.publicado_at).toLocaleString(LOCALE, {
          timeZone: TZ,
        })}`
      : ""
  );
}

/* ============================================================
   PERFIL (local + supabase)
============================================================ */
const formMiembro = safeEl("formMiembro");
const perfilEstado = safeEl("perfilEstado");
const btnCerrarPerfil = safeEl("btnCerrarPerfil");

const perfilNombreTxt = safeEl("perfilNombreTexto");
const perfilRolTxt = safeEl("perfilRolTexto");
const perfilFraseTxt = safeEl("perfilFraseTexto");

const perfilNombreInput = safeEl("perfilNombreInput"); // OJO: en tu HTML NO tiene name="nombre"
const perfilRolSelect = safeEl("perfilRolSelect");
const perfilFraseInput = safeEl("perfilFraseInput");

const avatarInicial = safeEl("perfilAvatarInicial");
const avatarImg = safeEl("perfilAvatarImg");
const btnCambiarFoto = safeEl("btnCambiarFoto");
const fotoInput = safeEl("perfilFotoInput");

function mostrarEstadoPerfil(texto, tipo = "ok") {
  if (!perfilEstado) return;
  perfilEstado.textContent = texto || "";
  perfilEstado.classList.remove("ok", "error");
  perfilEstado.classList.add(tipo);
}

function actualizarUIPerfil({ nombre, rol_key, frase } = {}) {
  const n = (nombre || "").trim();

  if (perfilNombreTxt) perfilNombreTxt.textContent = n || "Aún sin registrar";

  const labelRol =
    rol_key === "moderador"
      ? "Moderador (solicitud)"
      : rol_key === "voluntario"
      ? "Voluntario digital"
      : rol_key === "admin"
      ? "Admin"
      : "";

  if (perfilRolTxt) perfilRolTxt.textContent = labelRol;

  if (perfilFraseTxt) {
    perfilFraseTxt.textContent = frase && frase.trim()
      ? `“${frase.trim()}”`
      : "Aquí aparecerá la frase elegida.";
  }

  if (avatarInicial) {
    avatarInicial.textContent = n ? n.charAt(0).toUpperCase() : "🙂";
  }
}

function ocultarFormularioPerfil() {
  if (formMiembro) formMiembro.style.display = "none";
  if (btnCerrarPerfil) btnCerrarPerfil.style.display = "inline-flex";
}

function mostrarFormularioPerfil() {
  if (formMiembro) formMiembro.style.display = "grid";
  if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
}

// Foto local
btnCambiarFoto?.addEventListener("click", () => fotoInput?.click());
fotoInput?.addEventListener("change", () => {
  const file = fotoInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (avatarImg) {
      avatarImg.src = dataUrl;
      avatarImg.style.display = "block";
    }
    if (avatarInicial) avatarInicial.style.display = "none";
    try {
      localStorage.setItem("jc_perfil_foto", String(dataUrl));
    } catch {}
  };
  reader.readAsDataURL(file);
});

// Submit perfil
formMiembro?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sb = SB();

  // Leer nombre desde ID (porque tu input no tiene name="nombre")
  const nombre = (perfilNombreInput?.value || "").trim();

  // Lo demás sí viene con name en el HTML
  const f = new FormData(formMiembro);
  const edad = Number(f.get("edad"));
  const contacto = (f.get("contacto") || "").toString() || null;
  const ministerio = (f.get("ministerio") || "").toString() || null;
  const rol_key = (f.get("rol_key") || "miembro").toString();
  const frase = (perfilFraseInput?.value || f.get("frase") || "").toString();

  if (!nombre) {
    mostrarEstadoPerfil("Escribe tu nombre.", "error");
    return;
  }

  let userId = null;
  try {
    if (sb?.auth?.getUser) {
      const { data: u } = await sb.auth.getUser();
      userId = u?.user?.id || null;
    }
  } catch (err) {
    console.warn("No se pudo leer usuario auth:", err);
  }

  const payload = { nombre, edad, contacto, ministerio, rol_key, frase, user_id: userId };

  let remotoFallo = false;
  if (sb?.from) {
    try {
      const { error } = await sb.from("miembros").insert(payload);
      if (error) {
        console.error("Insert miembro error:", error);
        remotoFallo = true;
      }
    } catch (err) {
      console.error("Insert miembro fallo red:", err);
      remotoFallo = true;
    }
  } else {
    remotoFallo = true;
  }

  try {
    localStorage.setItem("jc_perfil", JSON.stringify({ nombre, rol_key, frase }));
  } catch {}

  actualizarUIPerfil({ nombre, rol_key, frase });
  ocultarFormularioPerfil();

  const labelRol =
    rol_key === "moderador"
      ? "Moderador (solicitud)"
      : rol_key === "voluntario"
      ? "Voluntario digital"
      : "Miembro";

  mostrarEstadoPerfil(
    remotoFallo
      ? `Perfil guardado solo en este dispositivo como ${labelRol}.`
      : `Registro guardado correctamente como ${labelRol}.`,
    remotoFallo ? "error" : "ok"
  );
});

// Cerrar perfil (solo local)
btnCerrarPerfil?.addEventListener("click", () => {
  try {
    localStorage.removeItem("jc_perfil");
    localStorage.removeItem("jc_perfil_foto");
  } catch {}

  actualizarUIPerfil({ nombre: "", rol_key: "", frase: "" });

  if (avatarImg) {
    avatarImg.src = "";
    avatarImg.style.display = "none";
  }
  if (avatarInicial) {
    avatarInicial.style.display = "block";
    avatarInicial.textContent = "🙂";
  }

  mostrarFormularioPerfil();
  mostrarEstadoPerfil("Perfil borrado en este dispositivo. Puedes volver a registrarte.", "ok");
});

// Restaurar perfil al cargar
(function restaurarPerfil() {
  try {
    const raw = localStorage.getItem("jc_perfil");
    if (raw) {
      const p = JSON.parse(raw);
      actualizarUIPerfil(p);

      if (perfilNombreInput && p.nombre) perfilNombreInput.value = p.nombre;
      if (perfilRolSelect && p.rol_key) perfilRolSelect.value = p.rol_key;
      if (perfilFraseInput && p.frase) perfilFraseInput.value = p.frase;

      ocultarFormularioPerfil();
    }

    const foto = localStorage.getItem("jc_perfil_foto");
    if (foto && avatarImg) {
      avatarImg.src = foto;
      avatarImg.style.display = "block";
      if (avatarInicial) avatarInicial.style.display = "none";
    }
  } catch (e) {
    console.error("Error restaurando perfil:", e);
  }
})();

/* ============================================================
   AVISOS (UI log)
============================================================ */
const avisosList = safeEl("avisosList");
function logAviso({ title = "Aviso", body = "" } = {}) {
  if (!avisosList) return;
  const li = document.createElement("li");
  li.className = "notice-item";
  li.textContent = `${new Date().toLocaleTimeString(LOCALE, { timeZone: TZ })} — ${title}: ${body}`;
  avisosList.prepend(li);
}

/* ============================================================
   RECURSOS (listar + upload)
============================================================ */
async function listarRecursos() {
  const sb = SB();
  const cont = safeEl("listaRecursos");
  if (!cont) return;

  cont.innerHTML = `<p class="muted small">Cargando...</p>`;

  if (!sb?.from) {
    cont.innerHTML = `<p class="muted small">No se puede conectar al servidor.</p>`;
    return;
  }

  const { data, error } = await sb
    .from("recursos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("listarRecursos error:", error);
    cont.innerHTML = `<p class="muted small">Error cargando recursos.</p>`;
    return;
  }

  if (!data?.length) {
    cont.innerHTML = `<p class="muted small">Aún no hay recursos subidos.</p>`;
    return;
  }

  // Render
  cont.innerHTML = data
    .map((r) => {
      const fecha = new Date(r.created_at).toLocaleDateString(LOCALE, { timeZone: TZ });
      let url = "";
      try {
        url = sb.storage?.from("recursos")?.getPublicUrl(r.path)?.data?.publicUrl || "";
      } catch {}

      return `
        <div class="recurso-item">
          <div class="recurso-info">
            <p class="recurso-nombre">${r.titulo || "Recurso"}</p>
            <p class="recurso-fecha">${fecha}</p>
          </div>
          ${url ? `<a class="btn-descargar" href="${url}" target="_blank" rel="noopener">Descargar</a>` : ""}
        </div>
      `;
    })
    .join("");
}

// Upload
const fileInput = safeEl("fileRec");
fileInput?.addEventListener("change", async () => {
  const sb = SB();
  const file = fileInput.files?.[0];
  if (!file || !sb?.storage || !sb?.from) return;

  try {
    const path = `${Date.now()}-${file.name}`;

    const { error: upErr } = await sb.storage.from("recursos").upload(path, file, { upsert: false });
    if (upErr) {
      console.error("Upload error:", upErr);
      alert("Error al subir archivo");
      return;
    }

    let userId = null;
    try {
      if (sb?.auth?.getUser) {
        const { data: u } = await sb.auth.getUser();
        userId = u?.user?.id || null;
      }
    } catch {}

    await sb.from("recursos").insert({
      titulo: file.name,
      categoria: file.type.includes("pdf")
        ? "pdf"
        : file.type.includes("audio")
        ? "audio"
        : file.type.includes("image")
        ? "imagen"
        : "otro",
      path,
      mime: file.type,
      subido_por: userId,
    });

    logAviso({ title: "Recurso subido", body: file.name });
    await listarRecursos();
  } catch (e) {
    console.error(e);
    alert("Error inesperado al subir");
  } finally {
    fileInput.value = "";
  }
});

/* ============================================================
   MIEMBROS (lista)
============================================================ */
async function cargarListaMiembros() {
  const sb = SB();
  const lista = safeEl("listaMiembros");
  if (!lista) return;

  lista.innerHTML = "<li>Cargando...</li>";

  if (!sb?.from) {
    lista.innerHTML = "<li>No se puede conectar al servidor.</li>";
    return;
  }

  const { data, error } = await sb
    .from("miembros")
    .select("nombre, rol_key")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("cargarListaMiembros:", error);
    lista.innerHTML = "<li>Error al cargar miembros.</li>";
    return;
  }

  if (!data?.length) {
    lista.innerHTML = "<li>No hay miembros registrados aún.</li>";
    return;
  }

  lista.innerHTML = "";
  data.forEach((m) => {
    const li = document.createElement("li");
    li.className = "user-item";

    const labelRol =
      m.rol_key === "admin"
        ? "Admin"
        : m.rol_key === "moderador"
        ? "Moderador"
        : m.rol_key === "voluntario"
        ? "Voluntario digital"
        : "Miembro";

    li.innerHTML = `
      <span><strong>${m.nombre || "—"}</strong></span>
      <span class="estado-activo">${labelRol}</span>
    `;
    lista.appendChild(li);
  });
}

/* ============================================================
   PALETA / TOKENS (supabase -> local -> css vars)
============================================================ */
async function cargarPaletaUsuario(uid) {
  const sb = SB();
  if (!uid || !sb?.from) return;

  try {
    const { data, error } = await sb
      .from("paletas_usuarios")
      .select("tokens, modo")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error("cargarPaletaUsuario:", error);
      return;
    }
    if (!data?.tokens) return;

    const tokens = typeof data.tokens === "string" ? JSON.parse(data.tokens) : data.tokens;

    try {
      localStorage.setItem("jc_tokens", JSON.stringify(tokens));
      if (data.modo) localStorage.setItem("jc_theme_mode", data.modo);
    } catch {}

    if (typeof window.jcApplyTokens === "function") {
      window.jcApplyTokens(tokens);
    } else {
      // fallback
      Object.entries(tokens || {}).forEach(([k, v]) => {
        const key = k.startsWith("--") ? k : `--${k}`;
        document.documentElement.style.setProperty(key, v);
      });
    }
  } catch (e) {
    console.error("cargarPaletaUsuario fallo:", e);
  }
}

/* ============================================================
   AUTH / ROLES (adminOnly)
============================================================ */
async function aplicarVisibilidadAdminOnly(uid) {
  document.querySelectorAll(".adminOnly").forEach((el) => (el.hidden = true));

  const sb = SB();
  if (!uid || !sb?.from) return;

  const { data, error } = await sb
    .from("miembros")
    .select("rol_key")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("rol_key lookup error:", error);
    return;
  }

  if (data?.rol_key === "admin" || data?.rol_key === "moderador") {
    document.querySelectorAll(".adminOnly").forEach((el) => (el.hidden = false));
  }
}

if (SB()?.auth?.onAuthStateChange) {
  SB().auth.onAuthStateChange(async (_event, session) => {
    const uid = session?.user?.id || null;

    await aplicarVisibilidadAdminOnly(uid);

    if (uid) await cargarPaletaUsuario(uid);

    // cargar contenido público siempre
    cargarPublic();
  });
} else {
  // sin auth listo aún
  cargarPublic();
}

/* ============================================================
   BOT SYSTEM — preload + estados + relación
============================================================ */
function jcPreloadImages(paths = []) {
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  uniq.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

// --- ANGIE ---
const ANGIE_ESTADOS = {
  feliz: {
    img: "assets/angie-feliz-saludo.png",
    frases: [
      "¡Holaaa! Qué bueno verte 😄",
      "Hoy puede ser un buen día 💫",
      "Mia ya ordenó todo… yo vengo a ponerle brillo 😏✨",
      "Ciro dice que hoy toca servir. Yo digo: servir con estilo 💗",
    ],
  },
  saludo: {
    img: "assets/angie-sonrisa-saludo.png",
    frases: [
      "¿Listo para empezar algo épico?",
      "¡Hey! Pasa, siéntete en casa 😌",
      "Mia me pidió que te dé la bienvenida… pero yo lo hago mejor 😉",
    ],
  },
  rezando: {
    img: "assets/angie-rezando.png",
    frases: [
      "Hagamos una pausa cortita para poner esto en manos de Dios 🙏",
      "Si el día pesa… respiramos, rezamos, y seguimos.",
      "Ciro rezó primero. Yo solo… lo seguí (por una vez 😇)",
    ],
  },
  traviesa: {
    img: "assets/angie-traviesa.png",
    frases: [
      "Mmm… sé que estás tramando algo, cuéntame 👀",
      "Yo también tengo ideas locas… tranqui 😏",
      "Si Ciro se pone serio, yo lo saco a reír. Es mi misión 😌",
    ],
  },
  confundida: {
    img: "assets/angie-confundida.png",
    frases: [
      "No entendí mucho… pero lo resolvemos juntos 🤔",
      "Pregunta sin miedo: aquí nadie nace sabiendo 💛",
      "Mia lo explica bonito. Yo lo explico… a mi manera 😅",
    ],
  },
  enojada: {
    img: "assets/angie-enojada.png",
    frases: [
      "¡Oye! Eso no estuvo bien 😤",
      "Respira… lo hablamos mejor, ¿sí?",
      "Ciro ya está por “parar todo”. Mia me dijo: calma. 😮‍💨",
    ],
  },
  llorando: {
    img: "assets/angie-llorando.png",
    frases: [
      "Si hoy dolió, mañana puede sanar 💔",
      "Puedes llorar y aún así ser fuerte 💧",
      "Mia me abrazó. Ciro dijo: “no estás solo”. Y yo… te creo.",
    ],
  },
  enamorada: {
    img: "assets/angie-enamorada.png",
    frases: [
      "Ayyy qué bonito 😍",
      "El corazón también sabe hablar 💗",
      "Mia dice que sea prudente… pero yo soy Angie 😌",
    ],
  },
  sorprendida: {
    img: "assets/angie-sorprendida.png",
    frases: [
      "¿EN SERIO? 😲",
      "Wow, no me esperaba eso 👀",
      "Ciro dijo “vamos con todo”. Yo digo: “con todo y con flow” 😏",
    ],
  },
  vergonzosa: {
    img: "assets/angie-vergonzosa.png",
    frases: [
      "Yo también soy tímida a veces… poquitito 🙈",
      "Tranquilo, nadie te va a juzgar aquí 💗",
      "Mia me está mirando… ok, me porto bien 😅",
    ],
  },
  cansada: {
    img: "assets/angie-cansada.png",
    frases: [
      "Uf… también puedes descansar 😮‍💨",
      "Un respiro y seguimos, ¿trato hecho?",
      "Ciro dice que no hay descanso… Mia dice que sí. Yo voto por Mia 😴",
    ],
  },
  ok: {
    img: "assets/angie-ok.png",
    frases: [
      "¡Buen trabajo! 👍",
      "Estoy orgullosa de ti ✨",
      "Mia está feliz. Ciro está motivado. Y yo… yo estoy encantada 💗",
    ],
  },
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function angieSetEstado(tipo = "feliz") {
  const widget = safeEl("angieWidget");
  const imgEl = safeEl("angieAvatarImg");
  const textEl = safeEl("angieText");
  if (!widget || !textEl) return;

  const estado = ANGIE_ESTADOS[tipo] || ANGIE_ESTADOS.feliz;
  if (imgEl && estado.img) imgEl.src = estado.img;
  textEl.textContent = estado.frases?.length ? pick(estado.frases) : "Hola 👋";

  widget.classList.add("angie-widget--visible");

  // Relación: Angie dispara reacciones suaves
  if (tipo === "traviesa") miaSetEstado("preocupada");
  if (tipo === "enojada") ciroSetEstado("stop");
  if (tipo === "llorando") {
    miaSetEstado("llorando");
    ciroSetEstado("pray");
  }
}
window.angieSetEstado = angieSetEstado;

// --- MIA ---
const MIA_ESTADOS = {
  guiando: {
    img: "assets/mia-casual-wink.png",
    frases: [
      "Hola 💗 Respira. Vamos paso a paso.",
      "Si te pierdes, yo te ubico 😊",
      "Ciro quiere correr… pero primero ordenamos 🙌",
    ],
  },
  apoyo: {
    img: "assets/mia-casual-love.png",
    frases: [
      "Aquí estoy contigo, no estás solo 💖",
      "Lo estás haciendo mejor de lo que crees ✨",
      "Angie bromea, Ciro empuja… y yo te sostengo.",
    ],
  },
  preocupada: {
    img: "assets/mia-casual-confused.png",
    frases: [
      "Hmm… revisemos eso con calma.",
      "Algo no cuadra, pero lo resolvemos.",
      "Ciro, sin drama 😅",
    ],
  },
  triste: {
    img: "assets/mia-casual-sad.png",
    frases: [
      "Si te pesa… aquí tienes un espacio seguro.",
      "Hoy toca ser suave contigo.",
      "Angie, hoy no bromas… hoy acompañas 💗",
    ],
  },
  llorando: {
    img: "assets/mia-casual-cry.png",
    frases: [
      "Si lloras, no pasa nada… seguimos juntos.",
      "Dios también te escucha en silencio.",
      "Ciro, una oración. Angie, un abrazo.",
    ],
  },
  vergonzosa: {
    img: "assets/mia-casual-embarrassed.png",
    frases: ["Je… bueno, sí… 🙈", "No me hagas sonrojar 😅", "Angie te está mirando, cuidado 😏"],
  },
  shy: {
    img: "assets/mia-casual-shy.png",
    frases: ["Estoy aquí… aunque me cueste hablar 🙈", "Vamos poquito a poquito.", "Ciro, bajemos un cambio 💙"],
  },
  sorprendida: {
    img: "assets/mia-casual-surprised.png",
    frases: ["¡Oh! No lo vi venir 😳", "Ok… replaneamos.", "Angie, sin caos por favor 😅"],
  },

  // elegant set (por si lo usas después)
  elegant_confused: { img: "assets/mia-elegant-confused.png", frases: ["Revisemos con paciencia 🤍"] },
  elegant_cry: { img: "assets/mia-elegant-cry.png", frases: ["Estoy contigo… 💧"] },
  elegant_dreamy: { img: "assets/mia-elegant-dreamy.png", frases: ["Soñemos bonito… ✨"] },
  elegant_heart: { img: "assets/mia-elegant-heart.png", frases: ["Te acompaño con el corazón 💖"] },
  elegant_kiss: { img: "assets/mia-elegant-kiss.png", frases: ["Un empujoncito de ánimo 💋"] },
  elegant_love: { img: "assets/mia-elegant-love.png", frases: ["Me alegra verte 💗"] },
  elegant_relief: { img: "assets/mia-elegant-relief.png", frases: ["Bien… respira, ya pasó 😮‍💨"] },
  elegant_shy: { img: "assets/mia-elegant-shy.png", frases: ["Uy… 🙈"] },
};

function miaSetEstado(tipo = "guiando") {
  const widget = safeEl("miaWidget");
  const imgEl = safeEl("miaAvatarImg");
  const textEl = safeEl("miaText");
  if (!widget || !textEl) return;

  let estado = MIA_ESTADOS[tipo];
  if (!estado) {
    const keys = Object.keys(MIA_ESTADOS);
    estado = MIA_ESTADOS[pick(keys)];
  }

  if (imgEl && estado.img) imgEl.src = estado.img;
  textEl.textContent = estado.frases?.length ? pick(estado.frases) : "Estoy aquí 💗";

  widget.classList.add("mia-widget--visible");

  // Relación: Mia calma a Ciro cuando se acelera
  if (tipo === "preocupada") ciroSetEstado("calm");
}
window.miaSetEstado = miaSetEstado;

// --- CIRO ---
const CIRO_ESTADOS = {
  feliz: {
    img: "assets/ciro-happy.png",
    frases: ["¡Holaaa! ¡Vamos con fuerza! 💪🔥", "Hoy se sirve con alegría 🙌", "Mia organizó… yo ejecuto 😤"],
  },
  excited: {
    img: "assets/ciro-excited.png",
    frases: ["¡YA! Dime qué hacemos 😄", "Estoy listo, listo, listo 💥", "Angie, no distraigas… (ok, un poquito sí 😅)"],
  },
  calm: {
    img: "assets/ciro-calm.png",
    frases: ["Estoy concentrado… dame un segundo.", "Paso firme, mente en paz.", "Mia tiene razón: primero orden."],
  },
  worried: {
    img: "assets/ciro-worried.png",
    frases: ["Eh… ¿y si sale mal? 😬", "Ok… lo intentamos de nuevo.", "Angie… no te rías 😅"],
  },
  pray: {
    img: "assets/ciro-pray.png",
    frases: ["Un momento… oración primero 🙏", "Señor, guíanos.", "Mia, gracias por recordarnos lo esencial."],
  },
  happy_pray: {
    img: "assets/ciro-happy-pray.png",
    frases: ["¡Orando y con alegría! 😇", "Dios por delante, siempre.", "Angie, hoy sí te salió bonito 💙"],
  },
  stop: {
    img: "assets/ciro-stop.png",
    frases: ["¡Alto ahí! Eso no va 😤", "Respeto primero.", "Mia, ¿lo hablamos? Yo me calmo."],
  },
  angry: {
    img: "assets/ciro-angry.png",
    frases: ["Me molesta… pero respiro.", "Ok… no reacciono. Lo arreglo.", "Angie, no avives el fuego 😅"],
  },
};

function ciroSetEstado(tipo = "feliz") {
  const widget = safeEl("ciroWidget");
  const imgEl = safeEl("ciroAvatarImg");
  const textEl = safeEl("ciroText");
  if (!widget || !textEl) return;

  const estado = CIRO_ESTADOS[tipo] || CIRO_ESTADOS.feliz;
  if (imgEl && estado.img) imgEl.src = estado.img;
  textEl.textContent = estado.frases?.length ? pick(estado.frases) : "Aquí estoy 🙌";

  widget.classList.add("ciro-widget--visible");

  // Relación: cuando Ciro se pone “stop”, Angie baja la travesura
  if (tipo === "stop") angieSetEstado("ok");
}
window.ciroSetEstado = ciroSetEstado;

// Close buttons (ocultar 30 min)
(function initBotCloseButtons() {
  const MAP = [
    { id: "angieWidget", close: "angieClose", key: "jc_angie_hide_until" },
    { id: "miaWidget", close: "miaClose", key: "jc_mia_hide_until" },
    { id: "ciroWidget", close: "ciroClose", key: "jc_ciro_hide_until" },
  ];

  MAP.forEach(({ id, close, key }) => {
    const w = safeEl(id);
    const c = safeEl(close);
    if (!w || !c) return;

    // restore hide
    const until = Number(localStorage.getItem(key) || "0");
    if (Date.now() < until) {
      w.classList.remove("angie-widget--visible", "mia-widget--visible", "ciro-widget--visible");
    }

    c.addEventListener("click", () => {
      w.classList.remove("angie-widget--visible", "mia-widget--visible", "ciro-widget--visible");
      try {
        localStorage.setItem(key, String(Date.now() + 30 * 60 * 1000));
      } catch {}
    });
  });
})();

// Preload ALL listed assets
(function preloadAllBotAssets() {
  const all = [
    "assets/angie-widget-v2.png",

    "assets/angie-cansada.png",
    "assets/angie-confundida.png",
    "assets/angie-enamorada.png",
    "assets/angie-enojada.png",
    "assets/angie-feliz-saludo.png",
    "assets/angie-llorando.png",
    "assets/angie-ok.png",
    "assets/angie-rezando.png",
    "assets/angie-sonrisa-saludo.png",
    "assets/angie-sorprendida.png",
    "assets/angie-traviesa.png",
    "assets/angie-vergonzosa.png",

    "assets/ciro-angry.png",
    "assets/ciro-calm.png",
    "assets/ciro-excited.png",
    "assets/ciro-happy-pray.png",
    "assets/ciro-happy.png",
    "assets/ciro-pray.png",
    "assets/ciro-stop.png",
    "assets/ciro-worried.png",

    "assets/mia-casual-confused.png",
    "assets/mia-casual-cry.png",
    "assets/mia-casual-embarrassed.png",
    "assets/mia-casual-love.png",
    "assets/mia-casual-sad.png",
    "assets/mia-casual-shy.png",
    "assets/mia-casual-surprised.png",
    "assets/mia-casual-wink.png",

    "assets/mia-elegant-confused.png",
    "assets/mia-elegant-cry.png",
    "assets/mia-elegant-dreamy.png",
    "assets/mia-elegant-heart.png",
    "assets/mia-elegant-kiss.png",
    "assets/mia-elegant-love.png",
    "assets/mia-elegant-relief.png",
    "assets/mia-elegant-shy.png",
  ];

  jcPreloadImages(all);
})();

/* ============================================================
   BOTS: mood según vista (con relación)
============================================================ */
function angieSegunVista(tab) {
  const mapa = {
    inicio: "feliz",
    eventos: "sorprendida",
    comunidad: "saludo",
    recursos: "confundida",
    avisos: "traviesa",
    "miembros-activos": "ok",
    perfil: "vergonzosa",
  };

  const estadoAngie = mapa[tab] || "feliz";
  angieSetEstado(estadoAngie);

  // Reacción de equipo según tab (se nota la relación)
  if (tab === "eventos") {
    miaSetEstado("guiando");
    ciroSetEstado("excited");
  } else if (tab === "perfil") {
    miaSetEstado("apoyo");
    ciroSetEstado("calm");
  } else if (tab === "recursos") {
    miaSetEstado("preocupada");
    ciroSetEstado("calm");
  } else if (tab === "avisos") {
    miaSetEstado("guiando");
    ciroSetEstado("happy_pray");
  } else {
    // inicio / comunidad / miembros
    miaSetEstado("guiando");
    ciroSetEstado("feliz");
  }
}

/* ============================================================
   CHAT (WhatsApp style)
============================================================ */
const jcChatBody = safeEl("jcChatBody");
const jcChatWidget = safeEl("jcChat");
const jcChatToggle = safeEl("jcChatToggle");

const JC_CHAR_INFO = {
  mia: { name: "Mia", initial: "M" },
  ciro: { name: "Ciro", initial: "C" },
  angie: { name: "Angie", initial: "A" },
  system: { name: "Sistema", initial: "★" },
};

function jcChatAddMessage({ from = "system", text = "", estado } = {}) {
  if (!jcChatBody) return;

  const info = JC_CHAR_INFO[from] || JC_CHAR_INFO.system;

  const row = document.createElement("div");
  row.className = `jc-chat-msg from-${from}`;

  row.innerHTML = `
    <div class="jc-chat-avatar">${info.initial}</div>
    <div class="jc-chat-bubble">
      <div class="jc-chat-name">${info.name}</div>
      <div class="jc-chat-text">${text}</div>
    </div>
  `;

  jcChatBody.appendChild(row);
  jcChatBody.scrollTop = jcChatBody.scrollHeight;

  // Sincronizar emociones con widgets
  if (from === "angie") angieSetEstado(estado || "feliz");
  if (from === "mia") miaSetEstado(estado || "guiando");
  if (from === "ciro") ciroSetEstado(estado || "feliz");
}

const JC_CHAT_SCENES = {
  inicio: [
    { from: "mia", text: "¡Hola! Soy Mia 💗 Yo coordino este espacio para que te sientas en casa.", estado: "guiando", delay: 500 },
    { from: "ciro", text: "¡Y yo soy Ciro! Si hay que servir, yo me apunto primero 😄", estado: "excited", delay: 1000 },
    { from: "angie", text: "Y yo Angie… te acompaño en todo 😏✨ (y sí, Mia manda… pero yo brillo).", estado: "traviesa", delay: 1400 },
  ],
  eventos: [
    { from: "mia", text: "Aquí verás los próximos eventos. Elige uno y camina con nosotros 🙌", estado: "guiando", delay: 500 },
    { from: "ciro", text: "Yo ya estoy listo para servir. ¡Dime cuál y vamos! 💪🔥", estado: "excited", delay: 1000 },
    { from: "angie", text: "Si creas un evento nuevo… me avisas 😏 yo lo hago épico.", estado: "sorprendida", delay: 1500 },
  ],
  recursos: [
    { from: "angie", text: "Esta parte será como una biblioteca… pero sin perder el estilo 💗📂", estado: "confundida", delay: 500 },
    { from: "mia", text: "Sube solo lo que ayude a acercar a alguien a Dios. Eso es lo más importante.", estado: "apoyo", delay: 1100 },
    { from: "ciro", text: "Y yo reviso que todo esté ordenado. Si se desordena… lo paro 😤", estado: "stop", delay: 1700 },
  ],
  perfil: [
    { from: "mia", text: "En tu perfil dejas tu nombre y una frase. Así nos conocemos de verdad 💗", estado: "apoyo", delay: 500 },
    { from: "ciro", text: "Si pones voluntario digital… prometo no spamearte (bueno… intento 😂)", estado: "feliz", delay: 1200 },
    { from: "angie", text: "Pon una frase bonita… que luego yo la leo y me pongo sentimental 😳", estado: "vergonzosa", delay: 1700 },
  ],
  avisos: [
    { from: "ciro", text: "Aquí se anuncian cosas importantes. No digas luego “nadie me avisó” 😌", estado: "calm", delay: 500 },
    { from: "mia", text: "Tranquilo, no saturaremos. Solo lo necesario para caminar juntos.", estado: "guiando", delay: 1200 },
  ],
  comunidad: [
    { from: "mia", text: "Aquí construiremos comunidad: noticias, retos y compartir 💬", estado: "guiando", delay: 500 },
    { from: "angie", text: "Yo quiero ver a todos participando… me pone feliz 💗", estado: "feliz", delay: 1200 },
  ],
  "miembros-activos": [
    { from: "angie", text: "Mira cuántos ya se sumaron… ¡no estamos solos! 👥", estado: "ok", delay: 500 },
    { from: "ciro", text: "Algún día hacemos una convivencia con todos. Yo llevo la energía 💪", estado: "feliz", delay: 1200 },
  ],
};

function jcChatPlayScene(viewKey) {
  if (!jcChatWidget) return;
  const scene = JC_CHAT_SCENES[viewKey];
  if (!scene) return;

  const storageKey = `jc_chat_scene_${viewKey}`;
  if (sessionStorage.getItem(storageKey) === "1") return;
  sessionStorage.setItem(storageKey, "1");

  let totalDelay = 0;
  scene.forEach((msg) => {
    totalDelay += typeof msg.delay === "number" ? msg.delay : 800;
    setTimeout(() => jcChatAddMessage(msg), totalDelay);
  });
}

jcChatToggle?.addEventListener("click", () => {
  jcChatWidget?.classList.toggle("jc-chat--collapsed");
});

/* ============================================================
   EVENT FORM (crear evento)
============================================================ */
const formEvento = safeEl("formEvento");
const evEstado = safeEl("evEstado");

formEvento?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sb = SB();
  if (!sb?.from) {
    if (evEstado) {
      evEstado.textContent = "No se puede conectar al servidor por ahora.";
      evEstado.classList.add("error");
    }
    return;
  }

  const titulo = (safeEl("evTitulo")?.value || "").trim();
  const fechaRaw = safeEl("evFecha")?.value;
  const tipo = safeEl("evTipo")?.value || null;
  const lugar = (safeEl("evLugar")?.value || "").trim() || null;
  const descripcion = (safeEl("evDescripcion")?.value || "").trim() || null;

  if (!titulo || !fechaRaw) {
    if (evEstado) {
      evEstado.textContent = "Completa al menos título y fecha.";
      evEstado.classList.add("error");
    }
    return;
  }

  const fechaIso = new Date(fechaRaw).toISOString();

  if (evEstado) {
    evEstado.textContent = "Guardando evento...";
    evEstado.classList.remove("error");
    evEstado.classList.add("ok");
  }

  try {
    const { error } = await sb.from("eventos").insert({
      titulo,
      fecha: fechaIso,
      tipo,
      lugar,
      descripcion,
    });

    if (error) {
      console.error("insert evento:", error);
      if (evEstado) {
        evEstado.textContent = "No se pudo guardar el evento. Intenta más tarde.";
        evEstado.classList.add("error");
      }
      return;
    }

    formEvento.reset();
    if (evEstado) {
      evEstado.textContent = "Evento creado correctamente 🙌";
      evEstado.classList.remove("error");
      evEstado.classList.add("ok");
    }

    logAviso({ title: "Nuevo evento", body: `${titulo} (${tipo || "general"})` });

    const filtro = safeEl("filtroTipo")?.value || "";
    await cargarEventos({ destinoId: "eventList", tipo: filtro });
    await cargarEventosHome();
  } catch (err) {
    console.error(err);
    if (evEstado) {
      evEstado.textContent = "Error inesperado al guardar el evento.";
      evEstado.classList.add("error");
    }
  }
});

/* ============================================================
   PWA / Push placeholder
============================================================ */
safeEl("btnPermPush")?.addEventListener("click", () => {
  alert("Las notificaciones push se activarán en una próxima versión 🙂");
});

// SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("SW registrado");
    } catch (e) {
      console.error("SW error", e);
    }
  });
}

// FAB atajos
safeEl("fab")?.addEventListener("click", () => {
  const active = document.querySelector(".tab.active")?.dataset?.tab;
  if (active === "eventos") {
    safeEl("formEvento")?.scrollIntoView({ behavior: "smooth", block: "start" });
    safeEl("evTitulo")?.focus();
  } else if (active === "recursos") {
    safeEl("fileRec")?.click();
  } else {
    alert("Acción rápida");
  }
});

/* ============================================================
   CARGA PÚBLICA
============================================================ */
async function cargarPublic() {
  try {
    await Promise.all([
      cargarEventosHome(),
      cargarMensajeSemanal(),
      cargarEventos({ destinoId: "eventList", tipo: safeEl("filtroTipo")?.value || "" }),
      listarRecursos(),
    ]);
  } catch (e) {
    console.error("cargarPublic error:", e);
  }
}

/* ============================================================
   INIT
============================================================ */
(function init() {
  // Activar tab inicial
  const initialTab = (location.hash || "#inicio").replace("#", "");
  activate(initialTab || "inicio");

  // Saludo inicial (si no están ocultos)
  setTimeout(() => {
    angieSegunVista(initialTab || "inicio");
    jcChatPlayScene(initialTab || "inicio");
  }, 600);
})();

