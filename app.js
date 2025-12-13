/* ============================================================
   BOOT
============================================================ */
const sb = window.supabaseClient;
const LOCALE = "es-PE";
const TZ = "America/Lima";

if (!sb) {
  console.error("⚠️ Supabase no está listo (window.supabaseClient undefined). Revisa el orden de scripts.");
}

/* ============================================================
   HELPERS
============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function safeText(el, txt) { if (el) el.textContent = txt; }
function nowIso() { return new Date().toISOString(); }

/* ============================================================
   OVERLAY + DRAWER + PANEL ANGIE (sin conflictos)
============================================================ */
const drawer = $("#drawer");
const overlay = $("#overlay");
const angiePanel = $("#angie-panel");

function isDrawerOpen() { return drawer?.classList.contains("open"); }
function isAngieOpen() { return angiePanel?.classList.contains("open"); }

function syncOverlay() {
  if (!overlay) return;
  overlay.classList.toggle("show", isDrawerOpen() || isAngieOpen());
}

function openDrawer() { drawer?.classList.add("open"); syncOverlay(); }
function closeDrawer() { drawer?.classList.remove("open"); syncOverlay(); }

$("#openDrawer")?.addEventListener("click", openDrawer);
$("#closeDrawer")?.addEventListener("click", closeDrawer);

overlay?.addEventListener("click", () => {
  // cierra todo lo que esté abierto
  closeDrawer();
  window.jcCloseAngiePanel?.();
});

/* ============================================================
   SPA / TABS (sin montarse en móvil)
============================================================ */
const tabs = $$(".tab");
const views = $$(".view");

function activate(tab) {
  const t = typeof tab === "string" ? tab : tab?.dataset?.tab;
  if (!t) return;

  tabs.forEach((b) => {
    const on = b.dataset.tab === t;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  views.forEach((v) => v.classList.toggle("active", v.dataset.view === t));

  // foco suave
  $("#view-" + t)?.focus?.({ preventScroll: false });

  if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);

  // acciones por vista
  if (t === "miembros-activos") cargarListaMiembros();

  // bots + chat
  botsSegunVista(t);
  jcChatPlayScene(t);

  // cerrar drawer al navegar
  closeDrawer();
}

$$("[data-tab]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    activate(el.getAttribute("data-tab"));
  });
});

window.addEventListener("hashchange", () => {
  activate((location.hash || "#inicio").replace("#", ""));
});

activate((location.hash || "#inicio").replace("#", ""));

/* ============================================================
   FECHAS
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
   EVENTOS (ordenado)
============================================================ */
async function cargarEventos({ destinoId = "eventList", tipo = "" } = {}) {
  if (!sb?.from) return;

  let q = sb
    .from("eventos")
    .select("*")
    .gte("fecha", nowIso())
    .order("fecha", { ascending: true });

  if (tipo) q = q.eq("tipo", tipo);

  const { data, error } = await q.limit(50);
  if (error) {
    console.error("Eventos error:", error);
    return;
  }

  const ul = document.getElementById(destinoId);
  if (!ul) return;

  ul.innerHTML = "";
  (data || []).forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-item";
    const fecha = new Date(ev.fecha);

    li.innerHTML = `
      <span class="event-title">${ev.titulo}</span>
      <span class="event-meta">${fmtDate(fecha)} · ${fmtTime(fecha)}</span>
    `;

    // click abre maps si hay lugar
    li.addEventListener("click", () => {
      const q = encodeURIComponent(ev.lugar || "");
      if (q) window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
    });

    ul.appendChild(li);
  });
}

async function cargarEventosHome() {
  if (!sb?.from) return;

  const { data, error } = await sb
    .from("eventos")
    .select("*")
    .gte("fecha", nowIso())
    .order("fecha", { ascending: true })
    .limit(4);

  if (error) {
    console.error(error);
    return;
  }

  const ul = $("#eventListHome");
  if (!ul) return;

  ul.innerHTML = "";
  (data || []).forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-item";
    const fecha = new Date(ev.fecha);

    li.innerHTML = `
      <span class="event-title">${ev.titulo}</span>
      <span class="event-meta">${new Intl.DateTimeFormat(LOCALE, {
        timeZone: TZ,
        month: "short",
        day: "numeric",
      }).format(fecha)} · ${fmtTime(fecha)}</span>
    `;
    ul.appendChild(li);
  });
}

$("#filtroTipo")?.addEventListener("change", (e) => {
  cargarEventos({ destinoId: "eventList", tipo: e.target.value });
});

/* ============================================================
   MENSAJE SEMANAL
============================================================ */
async function cargarMensajeSemanal() {
  if (!sb?.from) return;

  const monday = ((d) => {
    const n = new Date(d);
    const day = (n.getDay() + 6) % 7;
    n.setDate(n.getDate() - day);
    n.setHours(0, 0, 0, 0);
    return n;
  })(new Date());

  const { data, error } = await sb
    .from("mensaje_semanal")
    .select("*")
    .eq("semana_start", monday.toISOString().slice(0, 10))
    .maybeSingle();

  if (error) console.error(error);

  safeText($("#msgTitle"), data?.titulo || "Mensaje no publicado");
  safeText($("#msgBody"), data?.contenido || "Vuelve pronto.");
  safeText(
    $("#msgMeta"),
    data ? `Por ${data.autor} • ${new Date(data.publicado_at).toLocaleString(LOCALE, { timeZone: TZ })}` : ""
  );
}

/* ============================================================
   PERFIL (local + supabase si se puede)
============================================================ */
const formMiembro = $("#formMiembro");
const perfilEstado = $("#perfilEstado");
const perfilNombreTxt = $("#perfilNombreTexto");
const perfilRolTxt = $("#perfilRolTexto");
const perfilFraseTxt = $("#perfilFraseTexto");
const btnCerrarPerfil = $("#btnCerrarPerfil");

const avatarInicial = $("#perfilAvatarInicial");
const avatarImg = $("#perfilAvatarImg");
const btnCambiarFoto = $("#btnCambiarFoto");
const fotoInput = $("#perfilFotoInput");

function labelRol(rol_key) {
  return rol_key === "moderador" ? "Moderador (solicitud)"
    : rol_key === "voluntario" ? "Voluntario digital"
    : "Miembro";
}

function mostrarEstadoPerfil(texto, tipo = "ok") {
  if (!perfilEstado) return;
  perfilEstado.textContent = texto;
  perfilEstado.classList.remove("ok", "error");
  perfilEstado.classList.add(tipo);
}

function actualizarUIPerfil({ nombre, rol_key, frase }) {
  if (perfilNombreTxt) perfilNombreTxt.textContent = nombre || "Aún sin registrar";
  if (perfilRolTxt) perfilRolTxt.textContent = rol_key ? labelRol(rol_key) : "";
  if (perfilFraseTxt) {
    perfilFraseTxt.textContent =
      frase && frase.trim() ? `“${frase.trim()}”` : "Aquí aparecerá la frase que elijas para tu perfil.";
  }
  if (avatarInicial) avatarInicial.textContent = (nombre || "🙂").trim().charAt(0).toUpperCase();
}

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
    localStorage.setItem("jc_perfil_foto", dataUrl);
  };
  reader.readAsDataURL(file);
});

formMiembro?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = $("#perfilNombreInput")?.value?.trim() || "";
  const rol_key = $("#perfilRolSelect")?.value || "miembro";
  const frase = $("#perfilFraseInput")?.value || "";

  const edad = Number(formMiembro.querySelector('[name="edad"]')?.value || 0);
  const contacto = formMiembro.querySelector('[name="contacto"]')?.value || null;
  const ministerio = formMiembro.querySelector('[name="ministerio"]')?.value || null;

  let userId = null;
  try {
    if (sb?.auth?.getUser) {
      const { data: u } = await sb.auth.getUser();
      userId = u?.user?.id || null;
    }
  } catch {}

  const payload = { nombre, edad, contacto, ministerio, rol_key, user_id: userId };

  let remoteFail = false;
  if (sb?.from) {
    try {
      const { error } = await sb.from("miembros").insert(payload);
      if (error) remoteFail = true;
    } catch {
      remoteFail = true;
    }
  } else remoteFail = true;

  localStorage.setItem("jc_perfil", JSON.stringify({ nombre, rol_key, frase }));
  actualizarUIPerfil({ nombre, rol_key, frase });

  btnCerrarPerfil && (btnCerrarPerfil.style.display = "inline-flex");
  formMiembro.style.display = "none";

  mostrarEstadoPerfil(
    remoteFail
      ? `Perfil guardado solo en este dispositivo como ${labelRol(rol_key)}. Luego se sincroniza.`
      : `Registro guardado correctamente como ${labelRol(rol_key)}.`,
    remoteFail ? "error" : "ok"
  );
});

(function restorePerfil() {
  try {
    const raw = localStorage.getItem("jc_perfil");
    if (raw) {
      const p = JSON.parse(raw);
      actualizarUIPerfil(p);
      if (formMiembro) formMiembro.style.display = "none";
      if (btnCerrarPerfil) btnCerrarPerfil.style.display = "inline-flex";
    }
    const foto = localStorage.getItem("jc_perfil_foto");
    if (foto && avatarImg) {
      avatarImg.src = foto;
      avatarImg.style.display = "block";
      if (avatarInicial) avatarInicial.style.display = "none";
    }
  } catch (e) {
    console.error(e);
  }
})();

btnCerrarPerfil?.addEventListener("click", () => {
  localStorage.removeItem("jc_perfil");
  localStorage.removeItem("jc_perfil_foto");
  if (avatarImg) { avatarImg.src = ""; avatarImg.style.display = "none"; }
  if (avatarInicial) { avatarInicial.style.display = "block"; avatarInicial.textContent = "🙂"; }
  if (formMiembro) formMiembro.style.display = "grid";
  if (btnCerrarPerfil) btnCerrarPerfil.style.display = "none";
  safeText(perfilNombreTxt, "Aún sin registrar");
  safeText(perfilRolTxt, "");
  safeText(perfilFraseTxt, "Aquí aparecerá la frase que elijas para tu perfil.");
  mostrarEstadoPerfil("Perfil borrado en este dispositivo. Puedes volver a registrarte.", "ok");
});

/* ============================================================
   RECURSOS (render real)
============================================================ */
async function listarRecursos() {
  const cont = $("#listaRecursos");
  if (!cont || !sb?.from) return;

  cont.innerHTML = `<p class="muted small">Cargando...</p>`;

  const { data, error } = await sb
    .from("recursos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error(error);
    cont.innerHTML = `<p class="muted small">Error cargando recursos.</p>`;
    return;
  }

  if (!data?.length) {
    cont.innerHTML = `<p class="muted small">Aún no hay recursos subidos.</p>`;
    return;
  }

  cont.innerHTML = data.map((r) => {
    const fecha = new Date(r.created_at).toLocaleDateString(LOCALE, { timeZone: TZ });
    const pub = sb.storage?.from("recursos")?.getPublicUrl(r.path)?.data?.publicUrl || "#";
    return `
      <div class="event-item" style="cursor:default;">
        <span class="event-title">${r.titulo || "Recurso"}</span>
        <span class="event-meta">${fecha}</span>
        <a class="btn small" href="${pub}" target="_blank" rel="noreferrer">Descargar</a>
      </div>
    `;
  }).join("");
}

$("#fileRec")?.addEventListener("change", async () => {
  const input = $("#fileRec");
  const file = input?.files?.[0];
  if (!file || !sb?.storage) return;

  const path = `${Date.now()}-${file.name}`;
  const { error: upErr } = await sb.storage.from("recursos").upload(path, file, { upsert: false });
  if (upErr) {
    console.error(upErr);
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
    categoria: file.type.includes("pdf") ? "pdf" : file.type.includes("audio") ? "audio" : file.type.includes("image") ? "imagen" : "otro",
    path,
    mime: file.type,
    subido_por: userId,
  });

  listarRecursos();
});

/* ============================================================
   MIEMBROS (que “sí se vea”)
============================================================ */
async function cargarListaMiembros() {
  const lista = $("#listaMiembros");
  if (!lista) return;

  lista.innerHTML = "<li>Cargando...</li>";

  if (!sb?.from) {
    lista.innerHTML = "<li>No se puede conectar al servidor.</li>";
    return;
  }

  const { data, error } = await sb.from("miembros").select("nombre, rol_key").limit(80);
  if (error) {
    console.error(error);
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
    li.innerHTML = `
      <span><strong>${m.nombre || "—"}</strong></span>
      <span class="estado-activo">${labelRol(m.rol_key)}</span>
    `;
    lista.appendChild(li);
  });
}

/* ============================================================
   BOTS (con trama + Mia modo casual/elegante)
============================================================ */

/* preload */
function jcPreloadImages(paths = []) {
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  uniq.forEach((src) => { const img = new Image(); img.src = src; });
}

/* MIA modo */
let miaModo = localStorage.getItem("jc_mia_modo") || "casual"; // casual | elegante
window.miaSetModo = (modo) => {
  miaModo = (modo === "elegante" ? "elegante" : "casual");
  localStorage.setItem("jc_mia_modo", miaModo);
  miaSetEstado(miaModo === "elegante" ? "elegant_relief" : "guiando");
};

const ANGIE_ESTADOS = {
  feliz: { img: "assets/angie-feliz-saludo.png", frases: ["¡Holaaa! Qué bueno verte 😄", "Mia coordina, Ciro empuja… y yo le pongo brillo 😏✨"] },
  saludo: { img: "assets/angie-sonrisa-saludo.png", frases: ["¡Hey! Pasa, siéntete en casa 😌", "¿Listo para empezar algo épico?"] },
  rezando: { img: "assets/angie-rezando.png", frases: ["Pausa cortita: lo ponemos en manos de Dios 🙏", "Ciro rezó primero… yo lo seguí 😇"] },
  traviesa: { img: "assets/angie-traviesa.png", frases: ["Mmm… ¿qué estás tramando? 👀", "Si Ciro se pone serio, yo lo hago reír 😏"] },
  confundida: { img: "assets/angie-confundida.png", frases: ["No entendí… pero lo resolvemos juntos 🤔", "Mia lo explica bonito, yo lo traduzco 😅"] },
  enojada: { img: "assets/angie-enojada.png", frases: ["¡Oye! Eso no estuvo bien 😤", "Ciro se quiere parar… Mia dice calma 😮‍💨"] },
  llorando: { img: "assets/angie-llorando.png", frases: ["Si hoy dolió, mañana sana 💔", "Mia te sostiene… Ciro te acompaña… y yo te creo."] },
  enamorada: { img: "assets/angie-enamorada.png", frases: ["Ayyy qué bonito 😍", "Mia dice prudencia… pero yo soy Angie 😌"] },
  sorprendida: { img: "assets/angie-sorprendida.png", frases: ["¿EN SERIO? 😲", "Ciro dijo “vamos con todo”… yo digo: con todo y con flow 😏"] },
  vergonzosa: { img: "assets/angie-vergonzosa.png", frases: ["Ok… me porto bien 🙈", "Mia me está mirando… 😅"] },
  cansada: { img: "assets/angie-cansada.png", frases: ["Un respiro y seguimos 😮‍💨", "Ciro no quiere descanso… Mia sí. Yo voto por Mia 😴"] },
  ok: { img: "assets/angie-ok.png", frases: ["¡Buen trabajo! 👍", "Mia está feliz, Ciro motivado… y yo encantada 💗"] },
};

const MIA_ESTADOS = {
  // casual
  guiando: { img: "assets/mia-casual-wink.png", frases: ["Respira 💗 vamos paso a paso.", "Primero orden, luego velocidad… Ciro 😅"] },
  apoyo: { img: "assets/mia-casual-love.png", frases: ["Aquí estoy contigo 💖", "Angie bromea, Ciro empuja… yo te sostengo."] },
  preocupada: { img: "assets/mia-casual-confused.png", frases: ["Hmm… revisemos eso con calma.", "Ciro, sin drama 😅"] },

  // elegante
  elegant_relief: { img: "assets/mia-elegant-relief.png", frases: ["Bien… respira. Yo me encargo. 🤍"] },
  elegant_conf: { img: "assets/mia-elegant-confused.png", frases: ["Revisemos con paciencia. Orden y claridad."] },
  elegant_love: { img: "assets/mia-elegant-love.png", frases: ["Estoy contigo, con calma y propósito. 💗"] },
};

const CIRO_ESTADOS = {
  feliz: { img: "assets/ciro-happy.png", frases: ["¡Vamos con fuerza! 💪🔥", "Mia ordena… yo ejecuto 😤"] },
  excited: { img: "assets/ciro-excited.png", frases: ["¡YA! Dime qué hacemos 😄", "Angie no distraigas… ok sí 😂"] },
  calm: { img: "assets/ciro-calm.png", frases: ["Estoy concentrado… dame un segundo.", "Mia tiene razón: primero orden."] },
  worried: { img: "assets/ciro-worried.png", frases: ["¿Y si sale mal? 😬", "Ok… lo intentamos otra vez."] },
  pray: { img: "assets/ciro-pray.png", frases: ["Oración primero 🙏", "Señor, guíanos."] },
  stop: { img: "assets/ciro-stop.png", frases: ["¡Alto! Eso no va 😤", "Respeto primero."] },
  angry: { img: "assets/ciro-angry.png", frases: ["Me molesta… pero respiro.", "Angie no avives el fuego 😅"] },
  happy_pray: { img: "assets/ciro-happy-pray.png", frases: ["¡Orando y con alegría! 😇", "Dios por delante, siempre."] },
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function angieSetEstado(tipo = "feliz") {
  const widget = $("#angieWidget");
  const imgEl = $("#angieAvatarImg");
  const textEl = $("#angieText");
  if (!widget || !textEl) return;

  const st = ANGIE_ESTADOS[tipo] || ANGIE_ESTADOS.feliz;
  if (imgEl) imgEl.src = st.img;
  textEl.textContent = pick(st.frases || ["Hola 👋"]);

  widget.classList.add("angie-widget--visible");
}
window.angieSetEstado = angieSetEstado;

function miaSetEstado(tipo = "guiando") {
  const widget = $("#miaWidget");
  const imgEl = $("#miaAvatarImg");
  const textEl = $("#miaText");
  if (!widget || !textEl) return;

  // si piden un estado elegante pero estamos en casual, lo respetamos igual
  const st = MIA_ESTADOS[tipo] || MIA_ESTADOS[(miaModo === "elegante" ? "elegant_relief" : "guiando")];
  if (imgEl) imgEl.src = st.img;
  textEl.textContent = pick(st.frases || ["Estoy aquí 💗"]);

  widget.classList.add("mia-widget--visible");
}
window.miaSetEstado = miaSetEstado;

function ciroSetEstado(tipo = "feliz") {
  const widget = $("#ciroWidget");
  const imgEl = $("#ciroAvatarImg");
  const textEl = $("#ciroText");
  if (!widget || !textEl) return;

  const st = CIRO_ESTADOS[tipo] || CIRO_ESTADOS.feliz;
  if (imgEl) imgEl.src = st.img;
  textEl.textContent = pick(st.frases || ["Aquí estoy 🙌"]);

  widget.classList.add("ciro-widget--visible");
}
window.ciroSetEstado = ciroSetEstado;

/* close buttons bots */
$("#angieClose")?.addEventListener("click", () => $("#angieWidget")?.classList.remove("angie-widget--visible"));
$("#miaClose")?.addEventListener("click", () => $("#miaWidget")?.classList.remove("mia-widget--visible"));
$("#ciroClose")?.addEventListener("click", () => $("#ciroWidget")?.classList.remove("ciro-widget--visible"));

function botsSegunVista(tab) {
  // Mia elegante en Perfil (modo coordinadora), casual en el resto
  if (tab === "perfil") window.miaSetModo("elegante");
  else window.miaSetModo("casual");

  const mapaAngie = {
    inicio: "feliz",
    eventos: "sorprendida",
    comunidad: "saludo",
    recursos: "confundida",
    avisos: "traviesa",
    "miembros-activos": "ok",
    perfil: "vergonzosa",
  };

  angieSetEstado(mapaAngie[tab] || "feliz");

  // Ciro reacciona a donde estás
  if (tab === "eventos") ciroSetEstado("excited");
  else if (tab === "avisos") ciroSetEstado("calm");
  else if (tab === "recursos") ciroSetEstado("worried");
  else ciroSetEstado("feliz");

  // Mia acompaña según clima
  if (tab === "recursos") miaSetEstado("preocupada");
  else miaSetEstado(miaModo === "elegante" ? "elegant_relief" : "guiando");
}

/* preload all */
(function preloadBots() {
  const all = [
    "assets/angie-widget-v2.png",
    ...Object.values(ANGIE_ESTADOS).map((x) => x.img),
    ...Object.values(MIA_ESTADOS).map((x) => x.img),
    ...Object.values(CIRO_ESTADOS).map((x) => x.img),
  ];
  jcPreloadImages(all);
})();

/* ============================================================
   CHAT (trama visible)
============================================================ */
const jcChatBody = $("#jcChatBody");
const jcChatWidget = $("#jcChat");
const jcChatToggle = $("#jcChatToggle");

const JC_CHAR = {
  mia: { name: "Mia", initial: "M" },
  ciro: { name: "Ciro", initial: "C" },
  angie: { name: "Angie", initial: "A" },
  system: { name: "Sistema", initial: "★" },
};

function jcChatAddMessage({ from = "system", text = "", estado }) {
  if (!jcChatBody) return;
  const info = JC_CHAR[from] || JC_CHAR.system;

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

  // sincroniza emociones
  if (from === "angie") angieSetEstado(estado || "feliz");
  if (from === "mia") miaSetEstado(estado || (miaModo === "elegante" ? "elegant_relief" : "guiando"));
  if (from === "ciro") ciroSetEstado(estado || "feliz");
}

const JC_CHAT_SCENES = {
  inicio: [
    { from: "mia", text: "Bienvenido 💗 Yo coordino el grupo: orden, calma y corazón.", estado: "guiando", delay: 400 },
    { from: "ciro", text: "¡Y yo ejecuto! Si hay servicio, estoy listo 💪🔥", estado: "excited", delay: 900 },
    { from: "angie", text: "Y yo… yo hago que todo se sienta bonito 😏✨", estado: "traviesa", delay: 1400 },
    { from: "mia", text: "Angie… por favor 😅 (pero sí, ella nos da vida).", estado: "apoyo", delay: 900 },
  ],
  perfil: [
    { from: "mia", text: "Modo coordinadora: elegante y claro 🤍 Aquí registras tu perfil.", estado: "elegant_relief", delay: 400 },
    { from: "ciro", text: "Si te animas a voluntario digital, yo te ayudo con lo que sea 🙌", estado: "feliz", delay: 1100 },
    { from: "angie", text: "Y yo te pongo una frase épica 😌", estado: "enamorada", delay: 1500 },
  ],
  eventos: [
    { from: "ciro", text: "¡Agenda lista! Dime cuál evento atacamos primero 😄", estado: "excited", delay: 400 },
    { from: "mia", text: "Primero revisa fecha y lugar. Luego confirmamos con calma.", estado: "guiando", delay: 1000 },
    { from: "angie", text: "Y si creas uno nuevo… yo lo anuncio con estilo 😏", estado: "traviesa", delay: 1400 },
  ],
  recursos: [
    { from: "mia", text: "Recursos = biblioteca del grupo 📂 Subimos solo lo que edifica.", estado: "preocupada", delay: 400 },
    { from: "ciro", text: "Si hay PDF de cantos… yo lo descargo primero 😇", estado: "happy_pray", delay: 1100 },
    { from: "angie", text: "Paciencia. Vamos por fases, pero quedará legendario ✨", estado: "ok", delay: 1500 },
  ],
};

function jcChatPlayScene(viewKey) {
  const scene = JC_CHAT_SCENES[viewKey];
  if (!scene || !jcChatWidget) return;

  const key = `jc_chat_scene_${viewKey}`;
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");

  let total = 0;
  scene.forEach((msg) => {
    total += msg.delay ?? 800;
    setTimeout(() => jcChatAddMessage(msg), total);
  });
}

jcChatToggle?.addEventListener("click", () => {
  jcChatWidget?.classList.toggle("jc-chat--collapsed");
});

/* ============================================================
   AUTH / ROLES + CARGA INICIAL
============================================================ */
async function cargarPublic() {
  await Promise.all([
    cargarEventosHome(),
    cargarMensajeSemanal(),
    cargarEventos({ destinoId: "eventList", tipo: $("#filtroTipo")?.value || "" }),
    listarRecursos(),
  ]);
}

if (sb?.auth?.onAuthStateChange) {
  sb.auth.onAuthStateChange(async (_event, session) => {
    $$(".adminOnly").forEach((el) => (el.hidden = true));

    const uid = session?.user?.id || null;
    if (!uid) {
      await cargarPublic();
      return;
    }

    const { data } = await sb.from("miembros").select("rol_key").eq("user_id", uid).maybeSingle();
    if (data?.rol_key === "admin" || data?.rol_key === "moderador") {
      $$(".adminOnly").forEach((el) => (el.hidden = false));
    }

    await cargarPublic();
  });
} else {
  cargarPublic();
}

/* ============================================================
   PWA + FAB
============================================================ */
$("#btnPermPush")?.addEventListener("click", () => {
  alert("Las notificaciones push se activarán en una próxima versión 🙂");
});

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

$("#fab")?.addEventListener("click", () => {
  const active = $(".tab.active")?.dataset?.tab;

  if (active === "eventos") {
    $("#formEvento")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#evTitulo")?.focus?.();
  } else if (active === "recursos") {
    $("#fileRec")?.click();
  } else {
    angieSetEstado("feliz");
    jcChatAddMessage({ from: "system", text: "Acción rápida lista. (Pronto: atajos reales)" });
  }
});