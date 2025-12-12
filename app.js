/* ============================================================
    BOOT
============================================================ */

const sb = window.supabaseClient;
const LOCALE = "es-PE";
const TZ = "America/Lima";

if (!sb) console.error ;
/* ============================================================
    DRAWER
============================================================ */

const drawer = document.getElementById("drawer");;
const overlay = document.getElementById("overlay");

function openDrawer() {
  drawer.classList.add("open");
  overlay.classList.add("show");
}

function closeDrawer() {
  drawer.classList.remove("open");
  overlay.classList.remove("show");
}

document.getElementById("openDrawer")?.addEventListener("click", openDrawer);
document.getElementById("closeDrawer")?.addEventListener("click", closeDrawer);
overlay?.addEventListener("click", closeDrawer);

/* ============================================================
    SISTEMA SPA / TABS — REPARADO
============================================================ */

const tabs = [...document.querySelectorAll(".tab")];
const views = [...document.querySelectorAll(".view")];

function showOnlyView(v) {
  views.forEach(view => {
    if (view.dataset.view === v) {
      view.style.display = "block";
      view.classList.add("active");
    } else {
      view.style.display = "none";
      view.classList.remove("active");
    }
  });
}

function resetUIStates() {
  window.scrollTo({ top: 0 });
  
  document.getElementById("jcChat")?.classList.remove("open");
  document.getElementById("angieWidget")?.classList.remove("visible");
  document.getElementById("miaWidget")?.classList.remove("visible");
  document.getElementById("ciroWidget")?.classList.remove("visible");
}

function activate(tab) {
  const t = typeof tab === "string" ? tab : tab?.dataset.tab;
  if (!t) return;

  tabs.forEach(b => {
    const active = b.dataset.tab === t;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active);
  });

  showOnlyView(t);
  resetUIStates();

  if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);

  if (t === "miembros-activos") cargarListaMiembros();
}

document.querySelectorAll("[data-tab]").forEach(el => {
  el.addEventListener("click", e => {
    e.preventDefault();
    activate(el.dataset.tab);
    closeDrawer();
  });
});

window.addEventListener("hashchange", () =>
  activate((location.hash || "#inicio").replace("#", ""))
);

activate((location.hash || "#inicio").replace("#", ""));

/* ============================================================
    FORMATO DE FECHAS
============================================================ */

const fmtDate = d =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "long", month: "short", day: "numeric"}).format(d);

const fmtTime = d =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit"}).format(d);

/* ============================================================
    EVENTOS
============================================================ */

async function cargarEventos({ destinoId = "eventList", tipo = "" } = {}) {
  if (!sb?.from) return;

  let q = sb
    .from("eventos")
    .select("*")
    .gte("fecha", new Date().toISOString())
    .order("fecha", { ascending: true });

  if (tipo) q = q.eq("tipo", tipo);

  const { data, error } = await q.limit(50);
  if (error) return;

  const ul = document.getElementById(destinoId);
  ul.innerHTML = "";

  data?.forEach(ev => {
    const li = document.createElement("li");
    li.className = "event-item";
    const fecha = new Date(ev.fecha);
    li.innerHTML = `
      <span class="event-title">${ev.titulo}</span>
      <span class="event-meta">${fmtDate(fecha)} ${fmtTime(fecha)}</span>
    `;
    ul.appendChild(li);
  });
}

async function cargarEventosHome() {
  const ul = document.getElementById("eventListHome");
  if (!ul) return;

  const { data } = await sb
    .from("eventos")
    .select("*")
    .gte("fecha", new Date().toISOString())
    .order("fecha", { ascending: true })
    .limit(4);

  ul.innerHTML = "";

  data?.forEach(ev => {
    const fecha = new Date(ev.fecha);
    ul.innerHTML += `
      <li class="event-item">
        <span class="event-title">${ev.titulo}</span>
        <span class="event-meta">${fecha.toLocaleDateString(LOCALE,{month:"short",day:"numeric"})} · ${fmtTime(fecha)}</span>
      </li>
    `;
  });
}

document.getElementById("filtroTipo")?.addEventListener("change", e =>
  cargarEventos({ destinoId: "eventList", tipo: e.target.value })
);

/* ============================================================
    MENSAJE SEMANAL
============================================================ */

async function cargarMensajeSemanal() {
  const monday = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const { data } = await sb
    .from("mensaje_semanal")
    .select("*")
    .eq("semana_start", monday.toISOString().slice(0, 10))
    .maybeSingle();

  document.getElementById("msgTitle").textContent = data?.titulo || "Mensaje semanal";
  document.getElementById("msgBody").textContent = data?.contenido || "";
  document.getElementById("msgMeta").textContent = data
    ? `Por ${data.autor} • ${new Date(data.publicado_at).toLocaleString(LOCALE,{timeZone:TZ})}`
    : "";
}

/* ============================================================
   PERFIL
============================================================ */

const formMiembro = document.getElementById("formMiembro");

function actualizarUIPerfil({ nombre, rol_key, frase }) {
  const inicial = nombre ? nombre.charAt(0).toUpperCase() : "🙂";

  document.getElementById("perfilNombreTexto").textContent = nombre;
  document.getElementById("perfilRolTexto").textContent =
    rol_key === "moderador"
      ? "Moderador"
      : rol_key === "voluntario"
      ? "Voluntario digital"
      : "Miembro";

  document.getElementById("perfilFraseTexto").textContent =
    frase ? `“${frase}”` : "Aquí aparecerá tu frase.";

  const avatarInicial = document.getElementById("perfilAvatarInicial");
  const avatarImg = document.getElementById("perfilAvatarImg");

  avatarInicial.textContent = inicial;
  avatarInicial.style.display = "block";
  avatarImg.style.display = "none";
}

formMiembro?.addEventListener("submit", async e => {
  e.preventDefault();

  const f = new FormData(formMiembro);

  const payload = {
    nombre: f.get("nombre"),
    edad: Number(f.get("edad")),
    contacto: f.get("contacto"),
    ministerio: f.get("ministerio"),
    rol_key: f.get("rol_key"),
    frase: f.get("frase"),
    user_id: null
  };

  try {
    const { data: u } = await sb.auth.getUser();
    payload.user_id = u?.user?.id || null;
  } catch {}

  let remoteError = false;
  try {
    const { error } = await sb.from("miembros").insert(payload);
    if (error) remoteError = true;
  } catch {
    remoteError = true;
  }

  localStorage.setItem("jc_perfil", JSON.stringify(payload));
  actualizarUIPerfil(payload);

  const status = document.getElementById("perfilEstado");
  status.textContent =
    remoteError
      ? "Perfil guardado solo en este dispositivo."
      : "Perfil guardado correctamente.";
});

/* ============================================================
   RECURSOS
============================================================ */

async function listarRecursos() {
  const cont = document.getElementById("listaRecursos");
  cont.innerHTML = "<p class='muted small'>Cargando...</p>";

  const { data, error } = await sb
    .from("recursos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    cont.innerHTML = "<p class='error small'>Error cargando recursos.</p>";
    return;
  }

  if (!data?.length) {
    cont.innerHTML = "<p class='muted small'>Aún no hay recursos.</p>";
    return;
  }

  cont.innerHTML = data
    .map(r => {
      const fecha = new Date(r.created_at).toLocaleDateString();
      const link = sb.storage.from("recursos").getPublicUrl(r.path).data.publicUrl;

      return `
        <div class="recurso-item">
          <div>
            <p class="recurso-nombre">${r.titulo}</p>
            <p class="recurso-fecha">${fecha}</p>
          </div>
          <a href="${link}" class="btn-descargar" target="_blank">Descargar</a>
        </div>
      `;
    })
    .join("");
}

/* ============================================================
    PALETA / TOKENS
============================================================ */

async function cargarPaletaUsuario(uid) {
  if (!uid) return;

  const { data } = await sb
    .from("paletas_usuarios")
    .select("tokens, modo")
    .eq("user_id", uid)
    .maybeSingle();

  if (!data?.tokens) return;

  localStorage.setItem("jc_tokens", JSON.stringify(data.tokens));
  if (data.modo) localStorage.setItem("jc_theme_mode", data.modo);

  if (window.jcApplyTokens) window.jcApplyTokens(data.tokens);
}

window.jcApplyTokens = function (tokens) {
  Object.entries(tokens).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
};

/* ============================================================
   ANGIE / MIA / CIRO: BOTS MEJORADOS
============================================================ */

const ANGIE_ESTADOS = {
  feliz: {
    img: "assets/angie-feliz-saludo.png",
    frases: [
      "¡Holaaa! Qué bueno verte 😄",
      "Hoy será un buen día ✨",
      "Estoy muy feliz de tenerte aquí 💗"
    ]
  },
  saludo: {
    img: "assets/angie-sonrisa-saludo.png",
    frases: ["¿Listo para empezar algo épico?", "¡Hey! Pasa, siéntete en casa 😌"]
  },
  sorprendida: {
    img: "assets/angie-sorprendida.png",
    frases: ["¿¡EN SERIO!? 😲", "Wooow, no esperaba eso 👀"]
  },
  vergonzosa: {
    img: "assets/angie-vergonzosa.png",
    frases: ["Ayy… qué vergüenza 🙈", "Oye no me hagas sonrojar 😳💗"]
  },
  traviesa: {
    img: "assets/angie-traviesa.png",
    frases: ["Mmm… ¿qué estás tramando? 😏", "Me encanta cuando haces eso 😼"]
  },
  ok: {
    img: "assets/angie-ok.png",
    frases: ["¡Buen trabajo! 👍", "Estoy orgullosa ✨"]
  }
};

function angieSetEstado(tipo) {
  const w = document.getElementById("angieWidget");
  if (!w) return;

  const estado = ANGIE_ESTADOS[tipo] || ANGIE_ESTADOS.feliz;
  const frase = estado.frases[Math.floor(Math.random() * estado.frases.length)];

  w.querySelector(".angie-avatar img").src = estado.img;
  document.getElementById("angieText").textContent = frase;

  w.classList.add("visible");

  // Interacciones automáticas con Mia y Ciro
  if (tipo === "traviesa") miaSetEstado("preocupada");
  if (tipo === "sorprendida") ciroSetEstado("feliz");
  if (tipo === "vergonzosa") miaSetEstado("feliz");
}

window.angieSetEstado = angieSetEstado;

const MIA_ESTADOS = {
  saludo: { img: "assets/mia-casual-wink.png", msg: "¡Hola! Qué bueno verte 💗" },
  feliz: { img: "assets/mia-casual-wink.png", msg: "Estoy súper feliz hoy ✨" },
  preocupada: { img: "assets/mia-casual-confused.png", msg: "Hmm… revisemos eso." },
  reflexiva: { img: "assets/mia-casual-sad.png", msg: "A veces es bueno pensar un poquito 💭" }
};

function miaSetEstado(tipo) {
  const w = document.getElementById("miaWidget");
  if (!w) return;

  let estado = MIA_ESTADOS[tipo];
  if (!estado) {
    const keys = Object.keys(MIA_ESTADOS);
    estado = MIA_ESTADOS[keys[Math.floor(Math.random() * keys.length)]];
  }

  w.querySelector(".angie-avatar img").src = estado.img;
  document.getElementById("miaText").textContent = estado.msg;
  w.classList.add("visible");

  if (tipo === "preocupada") ciroSetEstado("decision");
}

window.miaSetEstado = miaSetEstado;

const CIRO_ESTADOS = {
  saludo: { img: "assets/ciro-happy.png", msg: "¡Holaaa! Yo también estoy listo 😄" },
  feliz: { img: "assets/ciro-happy.png", msg: "¡Estoy muy feliz por esto! 💪" },
  decision: { img: "assets/ciro-excited.png", msg: "¡Vamos! Estoy a tu lado 🔥" },
  calmado: { img: "assets/ciro-calm.png", msg: "Todo con calma, bro 🙏" }
};

function ciroSetEstado(tipo) {
  const w = document.getElementById("ciroWidget");
  if (!w) return;

  let estado = CIRO_ESTADOS[tipo];
  if (!estado) {
    const keys = Object.keys(CIRO_ESTADOS);
    estado = CIRO_ESTADOS[keys[Math.floor(Math.random() * keys.length)]];
  }

  w.querySelector(".angie-avatar img").src = estado.img;
  document.getElementById("ciroText").textContent = estado.msg;
  w.classList.add("visible");
}

window.ciroSetEstado = ciroSetEstado;

/* ============================================================
   EMOCIONES SEGÚN LA VISTA
============================================================ */

function angieSegunVista(tab) {
  const mapa = {
    inicio: "feliz",
    eventos: "sorprendida",
    comunidad: "saludo",
    recursos: "ok",
    avisos: "traviesa",
    "miembros-activos": "feliz",
    perfil: "vergonzosa"
  };
  angieSetEstado(mapa[tab] || "feliz");
}

/* ============================================================
   CHAT NOVELA
============================================================ */

const jcChatBody = document.getElementById("jcChatBody");
const jcChatWidget = document.getElementById("jcChat");

function jcChatAddMessage(msg) {
  if (!jcChatBody) return;

  const row = document.createElement("div");
  row.className = `jc-chat-msg from-${msg.from}`;
  row.innerHTML = `
    <div class="jc-chat-avatar">${msg.from[0].toUpperCase()}</div>
    <div class="jc-chat-bubble">
      <div class="jc-chat-name">${msg.from}</div>
      <div class="jc-chat-text">${msg.text}</div>
    </div>
  `;
  jcChatBody.appendChild(row);
  jcChatBody.scrollTop = jcChatBody.scrollHeight;

  // Reacciones entre bots
  if (msg.from === "mia") ciroSetEstado("feliz");
  if (msg.from === "ciro") angieSetEstado("sorprendida");
  if (msg.from === "angie") miaSetEstado("feliz");
}

const JC_CHAT_SCENES = {
  inicio: [
    { from: "mia", text: "¡Hola! Soy Mia 💗" },
    { from: "ciro", text: "¡Y yo soy Ciro! 😄" },
    { from: "angie", text: "Y yo Angie… ¡te extrañamos! ✨" }
  ],
  eventos: [
    { from: "mia", text: "Aquí verás las actividades 🙌" },
    { from: "ciro", text: "Yo ya estoy listo para servir 💪" },
    { from: "angie", text: "¡Crea un evento! Quiero animarlo 😏" }
  ],
  comunidad: [
    { from: "mia", text: "Aquí construiremos una familia 💬" },
    { from: "angie", text: "Me encanta cuando todos participan 💗" }
  ]
};

function jcChatPlayScene(tab) {
  const scene = JC_CHAT_SCENES[tab];
  if (!scene) return;

  const key = `scene_${tab}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  let delay = 0;
  scene.forEach(msg => {
    delay += 700;
    setTimeout(() => jcChatAddMessage(msg), delay);
  });
}

/* ============================================================
   INTERCEPTOR FINAL DE activate()
============================================================ */

const ORIGINAL_ACTIVATE = window.activate;

window.activate = function (tab) {
  ORIGINAL_ACTIVATE(tab);
  angieSegunVista(tab);
  jcChatPlayScene(tab);
};

/* ============================================================
   CARGA PÚBLICA
============================================================ */

async function cargarPublic() {
  await Promise.all([
    cargarEventosHome(),
    cargarMensajeSemanal(),
    cargarEventos(),
    listarRecursos()
  ]);
}