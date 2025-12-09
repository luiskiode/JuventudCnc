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
// ====== Angie: expresiones y frases ======
const ANGIE_ESTADOS = {
  feliz: {
    img: 'assets/angie-feliz-saludo.png',
    frases: [
      '¡Holaaa! Qué bueno verte por aquí 😄',
      'Hoy siento que va a ser un buen día 💫',
      'Te ves más fuerte que ayer, ¿sabías? 💪'
    ]
  },
  saludo: {
    img: 'assets/angie-sonrisa-saludo.png',
    frases: [
      '¡Hey! ¿Listo para empezar algo épico?',
      'Pasa, pasa, la casa es tuya 😌',
      'Ya te estaba esperando por aquí 👀'
    ]
  },
  rezando: {
    img: 'assets/angie-rezando.png',
    frases: [
      'Un ratito de silencio también es oración 🙏',
      'Si quieres, podemos ofrecer este rato por alguien 💛'
    ]
  },
  enojada: {
    img: 'assets/angie-enojada.png',
    frases: [
      'Oye, eso no estuvo nada bien 😤',
      'Respira profundo… contamos hasta 5 y lo hablamos mejor, ¿sí?'
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
      'Si algo no te queda claro, pregunta. Aquí nadie nace sabiendo.'
    ]
  },
  llorando: {
    img: 'assets/angie-llorando.png',
    frases: [
      'Si hoy dolió, no significa que siempre será así 💔',
      'Puedes llorar y aún así ser fuerte, ¿lo sabías? 💧'
    ]
  },
  enamorada: {
    img: 'assets/angie-enamorada.png',
    frases: [
      'Ayyy, qué bonito eso que acabas de leer/vivir 😍',
      'Hay cosas que solo se entienden con el corazón 💖'
    ]
  },
  sorprendida: {
    img: 'assets/angie-sorprendida.png',
    frases: [
      '¡¿En serio?! Eso está espectacular ✨',
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
      'Se nota que te estás esforzando mucho… también puedes descansar 😮‍💨',
      'Un respiro y seguimos, ¿trato hecho?'
    ]
  },
  ok: {
    img: 'assets/angie-ok.png',
    frases: [
      '¡Buen trabajo, crack! 👍',
      'Estoy orgullosa de ti, en serio ✨'
    ]
  }
};

function angieSetEstado(tipo) {
  const widget = document.getElementById('angieWidget');
  if (!widget) return;

  const imgEl = widget.querySelector('.angie-avatar img');
  const textEl = document.getElementById('angieText');
  if (!textEl) return;

  // Tomar el estado pedido o caer en "feliz" si no existe
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

// ====== Angie animada traviesa ======
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

  // Cerrar Angie por un rato
  btnClose?.addEventListener('click', () => {
    widget.classList.remove('angie-widget--visible');
    const hideUntil = Date.now() + 60 * 60 * 1000; // 1 hora
    localStorage.setItem(STORAGE_KEY_HIDE, String(hideUntil));
  });

  // Saludo inicial según momento del día
  setTimeout(() => {
    const hideUntil = Number(localStorage.getItem(STORAGE_KEY_HIDE) || '0');
    if (Date.now() < hideUntil) return;

    const h = new Date().getHours();
    let tipo = 'feliz';
    if (h >= 6 && h < 12) tipo = 'saludo';
    if (h >= 12 && h < 19) tipo = 'feliz';
    if (h >= 19 || h < 6) tipo = 'rezando';

    angieSetEstado(tipo);
  }, 2000);

  // API pública interna para usar en otras partes
  window.angieSetEstado = angieSetEstado;
})();

  // ⭐ Sistema principal de mensajes y travesuras
  const mensajesBase = {
    manana: [
      '🌞 ¡Buenos días! Hoy podemos hacer algo grande.',
      '☕ ¿Ya desayunaste? Las misiones se hacen con energía.',
      '📖 Hoy es buen día para leer el mensaje semanal.'
    ],
    tarde: [
      '💪 Mitad de día… ¡Mitad de misión completada!',
      '👀 Te estuve viendo, ¿haciendo cosas de bien o procrastinando?',
      '🎯 ¿Ya revisaste los eventos de esta semana?'
    ],
    noche: [
      '🌙 Ya es tarde, pero nunca es tarde para hablar con Dios.',
      '✨ Gracias por pasarte por aquí hoy.',
      '🛏️ No olvides descansar, mañana seguimos con la aventura.'
    ],
    travesuras: [
      '🙈 Me asomé solo a ver si seguías por aquí…',
      '😏 No le digas a nadie, pero tú eres mi usuario favorito.',
      '🎨 ¿Te acuerdas que también puedo cambiar colores? Jejeje.',
      '👟 Casi me tropiezo entrando, no te rías 🙃'
    ]
  };



  function elegirMensaje(nombre) {
    const bloque = mensajesBase[momentoDelDia()] || mensajesBase.tarde;
    const extra = Math.random() < 0.35 ? mensajesBase.travesuras : [];
    const pool = bloque.concat(extra);

    const msg = pool[Math.floor(Math.random() * pool.length)];
    return msg.replace('{{nombre}}', nombre);
  }

  function mostrarAngie() {
    const hideUntil = Number(localStorage.getItem(STORAGE_KEY_HIDE) || '0');
    if (Date.now() < hideUntil) return; // aún está escondida

    const nombre = obtenerNombreUsuario();
    const mensaje = elegirMensaje(nombre);

    textEl.textContent = mensaje;
    widget.classList.add('angie-widget--visible');

    // Wiggle travieso
    if (Math.random() < 0.6) {
      widget.classList.add('angie-widget--wiggle');
      setTimeout(
        () => widget.classList.remove('angie-widget--wiggle'),
        3000
      );
    }
  }

  function ocultarAngie() {
  widget.classList.remove('angie-widget--visible');
  widget.classList.remove('angie-widget--wiggle');

  // Se oculta por 30 minutos
  localStorage.setItem(
    STORAGE_KEY_HIDE,
    String(Date.now() + 30 * 60 * 1000)
  );
}

  btnClose?.addEventListener('click', ocultarAngie);

  // ⭐ Aparición principal (después del saludo inicial)
  setTimeout(mostrarAngie, 4500);

  // ⭐ Reaparición según la vista
  window.addEventListener('hashchange', () => {
    const view = (location.hash || '#inicio').replace('#', '');

    if (['comunidad', 'eventos', 'miembros-activos'].includes(view)) {
      if (Math.random() < 0.45) {
        setTimeout(mostrarAngie, 1200);
      }
    }
  });

  
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

/*/* ==========================
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

window.angieSetEstado = function (estado) {
  const data = ANGIE_ESTADOS[estado];
  if (!data) return;

  const widget = document.getElementById("angieWidget");
  const imgEl = widget.querySelector(".angie-avatar img");
  const textEl = document.getElementById("angieText");

  // Cambiar imagen
  imgEl.src = data.img;

  // Frase aleatoria
  textEl.textContent =
    data.frases[Math.floor(Math.random() * data.frases.length)];

  widget.classList.add("angie-widget--visible");
};

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
