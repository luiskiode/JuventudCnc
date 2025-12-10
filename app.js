// ====== Boot ======
const sb = window.supabaseClient;
const LOCALE = 'es-PE';
const TZ = 'America/Lima';

if (!sb) {
  console.error(
    '⚠️ Supabase todavía no está listo (window.supabaseClient es undefined). Revisa el orden de los scripts.'
  );
}

// ====== Drawer (menú lateral) ======
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openDrawer');
const closeBtn = document.getElementById('closeDrawer');

function openDrawer() {
  drawer?.classList.add('open');
  overlay?.classList.add('show');
}
function closeDrawer() {
  drawer?.classList.remove('open');
  overlay?.classList.remove('show');
}

openBtn?.addEventListener('click', openDrawer);
closeBtn?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);

// ====== Tabs SPA ======
const tabs = Array.from(document.querySelectorAll('.tab'));
const views = Array.from(document.querySelectorAll('.view'));

function activate(tab) {
  const t = typeof tab === 'string' ? tab : tab?.dataset.tab;
  if (!t) return;

  tabs.forEach(b => {
    const on = b.dataset.tab === t;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  views.forEach(v => v.classList.toggle('active', v.dataset.view === t));

  document.querySelector(`#view-${t}`)?.focus({ preventScroll: false });

  if (location.hash !== `#${t}`) {
    history.replaceState(null, '', `#${t}`);
  }

  // Cargar lista al entrar a "miembros-activos"
  if (t === 'miembros-activos') {
    cargarListaMiembros();
  }
}

document
  .querySelectorAll('[data-tab]')
  .forEach(el =>
    el.addEventListener('click', e => {
      e.preventDefault();
      activate(el.getAttribute('data-tab'));
      closeDrawer();
    })
  );

window.addEventListener('hashchange', () =>
  activate((location.hash || '#inicio').replace('#', ''))
);

activate((location.hash || '#inicio').replace('#', ''));

// ====== Util ======
const fmtDate = d =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(d);

const fmtTime = d =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);

// ====== Eventos ======
async function cargarEventos({ destinoId = 'eventList', tipo = '' } = {}) {
  if (!sb?.from) return;

  let query = sb
    .from('eventos')
    .select('*')
    .gte('fecha', new Date().toISOString())
    .order('fecha', { ascending: true });

  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query.limit(50);
  if (error) {
    console.error(error);
    return;
  }

  const ul = document.getElementById(destinoId);
  if (!ul) return;

  ul.innerHTML = '';

  (data || []).forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';

    const fecha = new Date(ev.fecha);
    const meta = `${fmtDate(fecha)} ${fmtTime(fecha)}`;

    li.innerHTML = `
      <span class="event-title">${ev.titulo}</span>
      <span class="event-meta">${meta}</span>
    `;

    li.title = `${ev.descripcion || ''}`;

    li.addEventListener('click', () => {
      const q = encodeURIComponent(`${ev.lugar || ''}`);
      if (q) {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${q}`,
          '_blank'
        );
      }
    });

    ul.appendChild(li);
  });
}

async function cargarEventosHome() {
  if (!sb?.from) return;

  const { data } = await sb
    .from('eventos')
    .select('*')
    .gte('fecha', new Date().toISOString())
    .order('fecha', { ascending: true })
    .limit(4);

  const ul = document.getElementById('eventListHome');
  if (!ul) return;

  ul.innerHTML = '';

  (data || []).forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';

    const fecha = new Date(ev.fecha);
    const meta = `${new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      month: 'short',
      day: 'numeric'
    }).format(fecha)} · ${fmtTime(fecha)}`;

    li.innerHTML = `
      <span class="event-title">${ev.titulo}</span>
      <span class="event-meta">${meta}</span>
    `;

    ul.appendChild(li);
  });
}

document
  .getElementById('filtroTipo')
  ?.addEventListener('change', e =>
    cargarEventos({ destinoId: 'eventList', tipo: e.target.value })
  );

// ====== Mensaje semanal ======
async function cargarMensajeSemanal() {
  if (!sb?.from) return;

  const monday = (d => {
    const n = new Date(d);
    const day = (n.getDay() + 6) % 7;
    n.setDate(n.getDate() - day);
    n.setHours(0, 0, 0, 0);
    return n;
  })(new Date());

  const { data, error } = await sb
    .from('mensaje_semanal')
    .select('*')
    .eq('semana_start', monday.toISOString().slice(0, 10))
    .maybeSingle();

  const t = document.getElementById('msgTitle');
  const b = document.getElementById('msgBody');
  const m = document.getElementById('msgMeta');

  if (error) {
    console.error(error);
    if (t) t.textContent = '–';
    if (b) b.textContent = '';
    if (m) m.textContent = '';
    return;
  }

  if (!data) {
    if (t) t.textContent = 'Mensaje no publicado';
    if (b) b.textContent = 'Vuelve pronto.';
    if (m) m.textContent = '';
    return;
  }

  if (t) t.textContent = data.titulo || 'Mensaje para la semana';
  if (b) b.textContent = data.contenido || '';
  if (m) {
    m.textContent = `Por ${data.autor} • ${new Date(
      data.publicado_at
    ).toLocaleString(LOCALE, { timeZone: TZ })}`;
  }
}

// ====== Miembros / Perfil ======
const formMiembro = document.getElementById('formMiembro');

const perfilEstado = document.getElementById('perfilEstado');
const perfilNombreTxt = document.getElementById('perfilNombreTexto');
const perfilRolTxt = document.getElementById('perfilRolTexto');
const perfilFraseTxt = document.getElementById('perfilFraseTexto');
const btnCerrarPerfil = document.getElementById('btnCerrarPerfil');

const perfilNombreInput = document.getElementById('perfilNombreInput');
const perfilRolSelect = document.getElementById('perfilRolSelect');
const perfilFraseInput = document.getElementById('perfilFraseInput');

const avatarInicial = document.getElementById('perfilAvatarInicial');
const avatarImg = document.getElementById('perfilAvatarImg');
const btnCambiarFoto = document.getElementById('btnCambiarFoto');
const fotoInput = document.getElementById('perfilFotoInput');

function ocultarFormularioPerfil() {
  if (formMiembro) {
    formMiembro.style.display = 'none';
  }
  if (btnCerrarPerfil) {
    btnCerrarPerfil.style.display = 'inline-flex';
  }
}

function mostrarFormularioPerfil() {
  if (formMiembro) {
    formMiembro.style.display = 'grid';
  }
  if (btnCerrarPerfil) {
    btnCerrarPerfil.style.display = 'none';
  }
}

// Previsualizar y guardar foto en localStorage
btnCambiarFoto?.addEventListener('click', () => fotoInput?.click());
fotoInput?.addEventListener('change', () => {
  const file = fotoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (avatarImg) {
      avatarImg.src = dataUrl;
      avatarImg.style.display = 'block';
    }
    if (avatarInicial) avatarInicial.style.display = 'none';
    localStorage.setItem('jc_perfil_foto', dataUrl);
  };
  reader.readAsDataURL(file);
});

function actualizarUIPerfil({ nombre, rol_key, frase }) {
  if (nombre && perfilNombreTxt) {
    perfilNombreTxt.textContent = nombre;
    if (avatarInicial)
      avatarInicial.textContent = nombre.trim().charAt(0).toUpperCase();
  }
  if (rol_key && perfilRolTxt) {
    const label =
      rol_key === 'moderador'
        ? 'Moderador (solicitud)'
        : rol_key === 'voluntario'
        ? 'Voluntario digital'
        : 'Miembro';
    perfilRolTxt.textContent = label;
  }
  if (perfilFraseTxt) {
    perfilFraseTxt.textContent =
      frase && frase.trim()
        ? `“${frase.trim()}”`
        : 'Aquí aparecerá la frase que elijas para tu perfil.';
  }
}

function mostrarEstadoPerfil(texto, tipo = 'ok') {
  if (!perfilEstado) return;
  perfilEstado.textContent = texto;
  perfilEstado.classList.remove('ok', 'error');
  perfilEstado.classList.add(tipo);
}

formMiembro?.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(formMiembro);
  const nombre = f.get('nombre');
  const rol_key = f.get('rol_key') || 'miembro';
  const frase = f.get('frase') || '';

  // 1) Intentar obtener user_id SOLO si sb.auth existe
  let userId = null;
  try {
    if (sb?.auth?.getUser) {
      const { data: u } = await sb.auth.getUser();
      userId = u?.user?.id || null;
    }
  } catch (err) {
    console.warn(
      'No se pudo leer usuario de Supabase Auth (se guarda como invitado):',
      err
    );
  }

  const payload = {
    nombre,
    edad: Number(f.get('edad')),
    contacto: f.get('contacto') || null,
    ministerio: f.get('ministerio') || null,
    rol_key,
    user_id: userId
  };

  // 2) Intentar guardar en Supabase, pero aunque falle, mantenemos el perfil local
  let huboErrorRemoto = false;
  if (sb?.from) {
    try {
      const { error } = await sb.from('miembros').insert(payload);
      if (error) {
        console.error(error);
        huboErrorRemoto = true;
      }
    } catch (err) {
      console.error('Error de red/cliente al guardar miembro:', err);
      huboErrorRemoto = true;
    }
  } else {
    huboErrorRemoto = true;
  }

  // 3) Guardar info básica de perfil en localStorage SIEMPRE
  const perfilGuardado = { nombre, rol_key, frase };
  localStorage.setItem('jc_perfil', JSON.stringify(perfilGuardado));
  actualizarUIPerfil(perfilGuardado);

  const labelRol =
  rol_key === 'moderador'
    ? 'Moderador (solicitud)'
    : rol_key === 'voluntario'
    ? 'Voluntario digital'
    : 'Miembro';

  if (huboErrorRemoto) {
    mostrarEstadoPerfil(
      `Perfil guardado solo en este dispositivo como ${labelRol}. Más adelante se sincronizará con el servidor.`,
      'error'
    );
  } else {
    mostrarEstadoPerfil(
      `Registro guardado correctamente como ${labelRol}.`,
      'ok'
    );
  }

  formMiembro.reset();
});

// Restaurar perfil desde localStorage al cargar
(function restaurarPerfilDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem('jc_perfil');
    if (raw) {
      const p = JSON.parse(raw);
      actualizarUIPerfil(p);

      // Prefill inputs (por si algún día quieres reactivar edición)
      if (perfilNombreInput && p.nombre) perfilNombreInput.value = p.nombre;
      if (perfilRolSelect && p.rol_key) perfilRolSelect.value = p.rol_key;
      if (perfilFraseInput && p.frase) perfilFraseInput.value = p.frase;

      // Si ya hay perfil guardado, no mostramos el formulario otra vez
      ocultarFormularioPerfil();
    }

    const foto = localStorage.getItem('jc_perfil_foto');
    if (foto && avatarImg) {
      avatarImg.src = foto;
      avatarImg.style.display = 'block';
      if (avatarInicial) avatarInicial.style.display = 'none';
    }
  } catch (e) {
    console.error('Error restaurando perfil desde localStorage', e);
  }
})();

btnCerrarPerfil?.addEventListener('click', () => {
  // Borrar datos locales
  localStorage.removeItem('jc_perfil');
  localStorage.removeItem('jc_perfil_foto');

  // Reset UI básica
  if (perfilNombreTxt) perfilNombreTxt.textContent = 'Aún sin registrar';
  if (perfilRolTxt) perfilRolTxt.textContent = '';
  if (perfilFraseTxt) {
    perfilFraseTxt.textContent =
      'Aquí aparecerá la frase que elijas para tu perfil.';
  }

  if (avatarImg) {
    avatarImg.src = '';
    avatarImg.style.display = 'none';
  }
  if (avatarInicial) {
    avatarInicial.style.display = 'block';
    avatarInicial.textContent = '🙂';
  }

  mostrarFormularioPerfil();
  mostrarEstadoPerfil(
    'Perfil borrado en este dispositivo. Puedes volver a registrarte.',
    'ok'
  );
});

// ====== Recursos ======
const fileInput = document.getElementById('fileRec');

fileInput?.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file || !sb?.storage) return;

  const path = `${Date.now()}-${file.name}`;

  const { error: upErr } = await sb.storage
    .from('recursos')
    .upload(path, file, { upsert: false });

  if (upErr) {
    alert('Error al subir archivo');
    console.error(upErr);
    return;
  }

  // Obtener user_id SOLO si Auth está disponible
  let userId = null;
  try {
    if (sb?.auth?.getUser) {
      const { data: u } = await sb.auth.getUser();
      userId = u?.user?.id || null;
    }
  } catch (e) {
    console.warn('No se pudo obtener usuario para recurso:', e);
  }

  await sb.from('recursos').insert({
    titulo: file.name,
    categoria: file.type.includes('pdf')
      ? 'pdf'
      : file.type.includes('audio')
      ? 'audio'
      : file.type.includes('image')
      ? 'imagen'
      : 'otro',
    path,
    mime: file.type,
    subido_por: userId
  });

  if (typeof logAviso === 'function') {
    logAviso({
      title: 'Recurso subido',
      body: file.name
    });
  }

  listarRecursos();
});

// ====== Avisos (UI log) ======
const avisosList = document.getElementById('avisosList');

function logAviso({ title = 'Aviso', body = '' }) {
  if (!avisosList) return;
  const li = document.createElement('li');
  li.className = 'notice-item';
  li.textContent = `${new Date().toLocaleTimeString(LOCALE, {
    timeZone: TZ
  })} — ${title}: ${body}`;
  avisosList.prepend(li);
}

// ====== Paleta por usuario (Supabase) ======
async function cargarPaletaUsuario(uid) {
  if (!uid || !sb?.from) return;
  try {
    const { data, error } = await sb
      .from('paletas_usuarios')
      .select('tokens, modo')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error leyendo paleta usuario:', error);
      return;
    }
    if (!data?.tokens) return;

    const tokens =
      typeof data.tokens === 'string' ? JSON.parse(data.tokens) : data.tokens;

    // Guardar localmente
    localStorage.setItem('jc_tokens', JSON.stringify(tokens));
    if (data.modo) localStorage.setItem('jc_theme_mode', data.modo);

    // Aplicar si existe función global de diseño
    if (window.jcApplyTokens) {
      window.jcApplyTokens(tokens);
    }
  } catch (e) {
    console.error('Error cargarPaletaUsuario:', e);
  }
}

// ====== Contenido público (inicio básico) ======
async function cargarPublic() {
  try {
    await Promise.all([
      cargarEventosHome(),
      cargarMensajeSemanal(),
      cargarEventos({ destinoId: 'eventList', tipo: '' }),
      listarRecursos()
    ]);
  } catch (e) {
    console.error('Error en cargarPublic:', e);
  }
}

/* ==========================
   RENDERIZAR RECURSOS PÚBLICOS
   ========================== */

function listarRecursos(lista) {
  const contenedor = document.getElementById("listaRecursos");
  if (!contenedor) return;

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <p class="texto-mutedo">Aún no hay recursos subidos.</p>
    `;
    return;
  }

  contenedor.innerHTML = lista
    .map((item) => {
      return `
        <div class="recurso-item">
          <div class="recurso-info">
            <p class="recurso-nombre">${item.nombre}</p>
            <p class="recurso-fecha">${new Date(item.created_at).toLocaleDateString()}</p>
          </div>
          <a class="btn-descargar" href="${item.url}" target="_blank">Descargar</a>
        </div>
      `;
    })
    .join("");
}


// ====== Auth (Supabase) y roles ======
if (sb?.auth?.onAuthStateChange) {
  sb.auth.onAuthStateChange(async (_event, session) => {
    // Oculta por defecto
    document
      .querySelectorAll('.adminOnly')
      .forEach(el => (el.hidden = true));

    const uid = session?.user?.id || null;

    if (!uid) {
      cargarPublic();
      return;
    }

    // Chequear rol en BD (RLS aplica sobre auth.uid())
    const { data } = await sb
      .from('miembros')
      .select('rol_key')
      .eq('user_id', uid)
      .maybeSingle();

    if (data?.rol_key === 'admin' || data?.rol_key === 'moderador') {
      document
        .querySelectorAll('.adminOnly')
        .forEach(el => (el.hidden = false));
    }

    await cargarPaletaUsuario(uid);
    cargarPublic();
  });
} else {
  // Si no hay auth todavía, cargamos contenido público básico
  cargarPublic();
}

// ====== Push / PWA (sin Firebase, solo PWA básica) ======
const btnPermPush = document.getElementById('btnPermPush');
btnPermPush?.addEventListener('click', () => {
  alert('Las notificaciones push se activarán en una próxima versión 🙂');
});

// Service worker principal (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
      console.log('SW registrado');
    } catch (e) {
      console.error('SW error', e);
    }
  });
}

// FAB: atajos reales
document.getElementById('fab')?.addEventListener('click', () => {
  const active = document.querySelector('.tab.active')?.dataset.tab;

  if (active === 'eventos') {
    // Lleva al formulario de nuevo evento
    const form = document.getElementById('formEvento');
    const titulo = document.getElementById('evTitulo');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (titulo) titulo.focus();
    }
  } else if (active === 'recursos') {
    // Dispara el selector de archivo directamente
    document.getElementById('fileRec')?.click();
  } else {
    alert('Acción rápida');
  }
});

// ====== Lista de miembros ======
async function cargarListaMiembros() {
  const lista = document.getElementById('listaMiembros');
  if (!lista) return;

  lista.innerHTML = '<li>Cargando...</li>';

  if (!sb?.from) {
    lista.innerHTML = '<li>No se puede conectar al servidor.</li>';
    return;
  }

  const { data, error } = await sb
    .from('miembros')
    .select('nombre, rol_key')
    .limit(50);

  if (error) {
    console.error('Error al cargar miembros:', error);
    lista.innerHTML = '<li>Error al cargar miembros.</li>';
    return;
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<li>No hay miembros registrados aún.</li>';
    return;
  }

  lista.innerHTML = '';
  data.forEach(m => {
    const li = document.createElement('li');
    li.className = 'user-item';
    const labelRol =
      m.rol_key === 'moderador'
        ? 'Moderador'
        : m.rol_key === 'voluntario'
        ? 'Voluntario digital'
        : 'Miembro';

    li.innerHTML = `
      <span><strong>${m.nombre}</strong></span>
      <span class="estado-activo">${labelRol}</span>
    `;
    lista.appendChild(li);
  });
}
/* ==========================
   ANGIE: Expresiones + Paleta
   ========================== */

const ANGIE_ESTADOS = {
  feliz: {
    img: 'assets/angie-feliz-saludo.png',
    frases: [
      '¡Holaaa! Qué bueno verte 😄',
      'Hoy puede ser un buen día 💫',
      'Me alegra que estés aquí 💙'
    ]
  },

  saludo: {
    img: 'assets/angie-sonrisa-saludo.png',
    frases: [
      '¿Listo para empezar algo épico?',
      '¡Hey! Pasa, siéntete en casa 😌'
    ]
  },

  rezando: {
    img: 'assets/angie-rezando.png',
    frases: [
      'Hagamos una pausa cortita para ofrecerle esto a Dios 🙏',
      'Cuando no sepas qué hacer, reza un poquito y seguimos.',
      'No estás solo, siempre podemos poner esto en manos del Señor. 🙏'
    ]
  },

  traviesa: {
    img: 'assets/angie-traviesa.png',
    frases: [
      'Mmm… sé que estás tramando algo, cuéntame 👀',
      'Yo también tengo ideas locas a veces, tranqui 😏'
    ]
  },

  confundida: {
    img: 'assets/angie-confundida.png',
    frases: [
      'No entendí mucho, pero podemos verlo juntos 🤔',
      'Si algo no te queda claro, pregunta. Aquí nadie nace sabiendo 💛'
    ]
  },

  enojada: {
    img: 'assets/angie-enojada.png',
    frases: [
      '¡Oye! Eso no estuvo bien 😤',
      'Respira profundo… lo hablamos mejor, ¿sí?'
    ]
  },

  llorando: {
    img: 'assets/angie-llorando.png',
    frases: [
      'Si hoy dolió, mañana puede sanar 💔',
      'Puedes llorar y aún así ser fuerte 💧'
    ]
  },

  enamorada: {
    img: 'assets/angie-enamorada.png',
    frases: [
      'Ayyy qué bonito 😍',
      'El corazón también sabe hablar 💗'
    ]
  },

  sorprendida: {
    img: 'assets/angie-sorprendida.png',
    frases: [
      '¿EN SERIO? 😲',
      'Wow, no me esperaba eso 👀'
    ]
  },

  vergonzosa: {
    img: 'assets/angie-vergonzosa.png',
    frases: [
      'Yo también soy tímida a veces, te entiendo 🙈',
      'Tranquilo, nadie te va a juzgar aquí 💗'
    ]
  },

  cansada: {
    img: 'assets/angie-cansada.png',
    frases: [
      'Uf… también puedes descansar 😮‍💨',
      'Un respiro y seguimos, ¿trato hecho?'
    ]
  },

  ok: {
    img: 'assets/angie-ok.png',
    frases: [
      '¡Buen trabajo! 👍',
      'Estoy orgullosa de ti ✨'
    ]
  }
};


function angieSetEstado(tipo) {
  const widget = document.getElementById('angieWidget');
  if (!widget) return;

  const imgEl = widget.querySelector('.angie-avatar img');
  const textEl = document.getElementById('angieText');
  if (!textEl) return;

  const estado = ANGIE_ESTADOS[tipo] || ANGIE_ESTADOS.feliz;
  const frases = estado.frases || [];

  const frase =
    frases.length > 0
      ? frases[Math.floor(Math.random() * frases.length)]
      : 'Hola 👋';

  if (imgEl && estado.img) {
    imgEl.src = estado.img;
  }

  textEl.textContent = frase;
  widget.classList.add('angie-widget--visible');
}


// Hacer accesible desde otros scripts (iframe, etc.)
window.angieSetEstado = angieSetEstado;

// ====== Angie animada traviesa (saludo inicial / cerrar) ======
(function initAngieTraviesa() {
  const widget = document.getElementById('angieWidget');
  const textEl = document.getElementById('angieText');
  const btnClose = document.getElementById('angieClose');

  if (!widget || !textEl) return;

  const STORAGE_KEY_HIDE = 'jc_angie_hide_until';

  function obtenerNombreUsuario() {
    const raw = document.getElementById('perfilNombreTexto')?.textContent;
    return raw && raw.trim().length > 0 ? raw.trim() : 'amigo';
  }

  function momentoDelDia() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'manana';
    if (h >= 12 && h < 19) return 'tarde';
    return 'noche';
  }

  function saludoInicial() {
    const hideUntil = Number(localStorage.getItem(STORAGE_KEY_HIDE) || '0');
    if (Date.now() < hideUntil) return;

    const m = momentoDelDia();
    let tipo = 'feliz';
    if (m === 'manana') tipo = 'saludo';
    else if (m === 'noche') tipo = 'rezando';

    angieSetEstado(tipo);

    const nombre = obtenerNombreUsuario();
    textEl.textContent = textEl.textContent.replace('amigo', nombre);
  }

  function ocultarAngie() {
    widget.classList.remove('angie-widget--visible');
    widget.classList.remove('angie-widget--wiggle');
    localStorage.setItem(
      STORAGE_KEY_HIDE,
      String(Date.now() + 30 * 60 * 1000) // 30 min
    );
  }

  btnClose?.addEventListener('click', ocultarAngie);

  // saludo suave inicial
  setTimeout(saludoInicial, 2000);
})();

  
  
// ====== Crear nuevo evento (form) ======
const formEvento = document.getElementById('formEvento');
const evEstado = document.getElementById('evEstado');

formEvento?.addEventListener('submit', async e => {
  e.preventDefault();

  if (!sb?.from) {
    if (evEstado) {
      evEstado.textContent = 'No se puede conectar al servidor por ahora.';
      evEstado.classList.add('error');
    }
    return;
  }

  const tituloEl = document.getElementById('evTitulo');
  const fechaEl = document.getElementById('evFecha');
  const tipoEl = document.getElementById('evTipo');
  const lugarEl = document.getElementById('evLugar');
  const descEl = document.getElementById('evDescripcion');

  const titulo = tituloEl?.value.trim();
  const fechaRaw = fechaEl?.value;
  const tipo = tipoEl?.value || null;
  const lugar = lugarEl?.value?.trim() || null;
  const descripcion = descEl?.value?.trim() || null;

  if (!titulo || !fechaRaw) {
    if (evEstado) {
      evEstado.textContent = 'Completa al menos título y fecha.';
      evEstado.classList.add('error');
    }
    return;
  }

  const fechaIso = new Date(fechaRaw).toISOString();

  if (evEstado) {
    evEstado.textContent = 'Guardando evento...';
    evEstado.classList.remove('error');
    evEstado.classList.add('ok');
  }

  try {
    const { error } = await sb.from('eventos').insert({
      titulo,
      fecha: fechaIso,
      tipo,
      lugar,
      descripcion
    });

    if (error) {
      console.error('Error insertando evento:', error);
      if (evEstado) {
        evEstado.textContent =
          'No se pudo guardar el evento. Intenta más tarde.';
        evEstado.classList.add('error');
      }
      return;
    }

    if (formEvento instanceof HTMLFormElement) formEvento.reset();

    if (evEstado) {
      evEstado.textContent = 'Evento creado correctamente 🙌';
      evEstado.classList.remove('error');
      evEstado.classList.add('ok');
    }

    if (typeof logAviso === 'function') {
      logAviso({
        title: 'Nuevo evento',
        body: `${titulo} (${tipo || 'general'})`
      });
    }

    const filtro = document.getElementById('filtroTipo');
    const tipoFiltro = filtro?.value || '';
    cargarEventos({ destinoId: 'eventList', tipo: tipoFiltro });
    cargarEventosHome();
  } catch (err) {
    console.error(err);
    if (evEstado) {
      evEstado.textContent = 'Error inesperado al guardar el evento.';
      evEstado.classList.add('error');
    }
  }
});


/* ==========================
   ANGIE: Cambiar según sección
   ========================== */

function angieSegunVista(tab) {
  if (!window.angieSetEstado) return;

  const mapa = {
    inicio: "feliz",
    eventos: "sorprendida",
    comunidad: "saludo",
    recursos: "confundida",
    avisos: "traviesa",
    "miembros-activos": "ok",
    perfil: "vergonzosa"
  };

  window.angieSetEstado(mapa[tab] || "feliz");
}

const originalActivate = window.activate;
window.activate = function (tab) {
  originalActivate(tab);
  angieSegunVista(tab);
};

/* ==========================
   APLICAR TOKENS VISUALES
   ========================== */
window.jcApplyTokens = function (tokens) {
  if (!tokens) return;
  const root = document.documentElement;

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Dar feedback visual con Angie
  window.angieSetEstado("feliz");
};
/* ==========================
   CHAT NOVELA JUVENTUD CNC
   ========================== */

const jcChatBody = document.getElementById('jcChatBody');
const jcChatWidget = document.getElementById('jcChat');
const jcChatToggle = document.getElementById('jcChatToggle');

/**
 * Config de personajes
 */
const JC_CHAR_INFO = {
  mia:   { name: 'Mia',   initial: 'M'  },
  ciro:  { name: 'Ciro',  initial: 'C'  },
  angie: { name: 'Angie', initial: 'A'  },
  system:{ name: 'Sistema', initial: '★'}
};

/**
 * Añade un mensaje al chat
 * @param {{from: 'mia'|'ciro'|'angie'|'system', text: string, estado?: string}} msg
 */
function jcChatAddMessage(msg) {
  if (!jcChatBody) return;

  const info = JC_CHAR_INFO[msg.from] || JC_CHAR_INFO.system;

  const row = document.createElement('div');
  row.className = `jc-chat-msg from-${msg.from}`;

  row.innerHTML = `
    <div class="jc-chat-avatar">${info.initial}</div>
    <div class="jc-chat-bubble">
      <div class="jc-chat-name">${info.name}</div>
      <div class="jc-chat-text">${msg.text}</div>
    </div>
  `;

  jcChatBody.appendChild(row);
  jcChatBody.scrollTop = jcChatBody.scrollHeight;

  // Opcional: sincronizar emociones con otros widgets
  if (msg.from === 'angie' && typeof window.angieSetEstado === 'function' && msg.estado) {
    window.angieSetEstado(msg.estado);
  }
  // Más adelante puedes conectar aquí a Mia y Ciro si creas sus widgets
}

/**
 * Escenas por vista/tab.
 * Cada escena solo se dispara una vez por sesión.
 */
const JC_CHAT_SCENES = {
  inicio: [
    {
      from: 'mia',
      text: '¡Hola! Soy Mia, coordino Juventud CNC. Qué bueno tenerte por aquí 💗',
      delay: 400
    },
    {
      from: 'ciro',
      text: 'Y yo soy Ciro, monaguillo oficial. Si hay algo de servicio, ¡me apunto de una! 😄',
      delay: 900
    },
    {
      from: 'angie',
      text: 'Yo soy Angie, me encanta servir y acompañarte en todo esto. ¿Listo para algo épico? ✨',
      estado: 'feliz',
      delay: 1400
    }
  ],

  eventos: [
    {
      from: 'mia',
      text: 'En esta parte verás los próximos eventos. Revisa qué día puedes sumarte 🙌',
      delay: 400
    },
    {
      from: 'ciro',
      text: 'Yo ya marqué la misa del sábado y la convivencia. Si quieres, vamos juntos 💙',
      delay: 1100
    },
    {
      from: 'angie',
      text: 'Si creas un evento nuevo, avísame… me encanta llenar la agenda 😏',
      estado: 'traviesa',
      delay: 1700
    }
  ],

  comunidad: [
    {
      from: 'mia',
      text: 'Aquí se irá armando todo lo de comunidad: noticias, retos y cositas para compartir 💬',
      delay: 400
    },
    {
      from: 'angie',
      text: 'Mientras tanto, puedes ir soñando con qué quieres aportar al grupo 😉',
      estado: 'vergonzosa',
      delay: 1100
    }
  ],

  perfil: [
    {
      from: 'mia',
      text: 'En “Mi perfil” puedes dejar tu nombre y una frase que te represente. Eso nos ayuda a conocerte mejor 📝',
      delay: 400
    },
    {
      from: 'ciro',
      text: 'Si pones que quieres ser voluntario digital, prometo no llenar tu WhatsApp de tareas… bueno, intentaré 😂',
      delay: 1300
    }
  ],

  recursos: [
    {
      from: 'angie',
      text: 'Esta parte será como una biblioteca: cantos, guías, materiales. Paciencia, vamos por fases 📂',
      estado: 'ok',
      delay: 400
    },
    {
      from: 'mia',
      text: 'Cuando subas algo, piensa siempre: “¿Ayuda a acercar a alguien a Dios?” 💭',
      delay: 1200
    }
  ],

  avisos: [
    {
      from: 'ciro',
      text: 'Aquí se anuncian las cosas importantes. No lo ignores, que luego dices que nadie te avisó 😌',
      delay: 400
    },
    {
      from: 'mia',
      text: 'Tranquilo, no saturaremos. Solo lo necesario para caminar juntos 💗',
      delay: 1200
    }
  ],

  'miembros-activos': [
    {
      from: 'angie',
      text: 'Mira cuánta gente ya está sumándose al equipo. ¡No estamos solos en esto! 👥',
      estado: 'feliz',
      delay: 400
    },
    {
      from: 'ciro',
      text: 'Algún día tendremos que hacer una pizza gigante con todos los nombres de esa lista, te lo juro 🍕',
      delay: 1200
    }
  ]
};

/**
 * Reproduce una escena asociada a una vista/tab.
 * Solo una vez por sesión (usa sessionStorage).
 */
function jcChatPlayScene(viewKey) {
  const scene = JC_CHAT_SCENES[viewKey];
  if (!scene || !jcChatWidget) return;

  const storageKey = `jc_chat_scene_${viewKey}`;
  if (sessionStorage.getItem(storageKey) === '1') {
    return; // ya se mostró esta escena en esta sesión
  }
  sessionStorage.setItem(storageKey, '1');

  let totalDelay = 0;
  scene.forEach(msg => {
    const stepDelay = typeof msg.delay === 'number' ? msg.delay : 800;
    totalDelay += stepDelay;
    setTimeout(() => jcChatAddMessage(msg), totalDelay);
  });
}

// Toggle minimizar/maximizar
jcChatToggle?.addEventListener('click', () => {
  jcChatWidget?.classList.toggle('jc-chat--collapsed');
});

/**
 * Hook: interceptar cambios de pestaña para disparar escenas
 * Sobrescribimos la función activate original.
 */
if (typeof activate === 'function') {
  const _origActivate = activate;
  activate = function(tab) {
    // ejecutar lógica original
    _origActivate(tab);

    // determinar clave de vista
    const t = typeof tab === 'string' ? tab : tab?.dataset?.tab;
    if (t) {
      jcChatPlayScene(t);
    }
  };
  window.activate = activate;
}
