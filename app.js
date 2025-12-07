// ====== Boot ======
const sb = window.supabaseClient;
const LOCALE = 'es-PE';
const TZ = 'America/Lima';

if (!sb) {
  console.error('⚠️ Supabase todavía no está listo (window.supabaseClient es undefined). Revisa el orden de los scripts.');
}

// Drawer
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openDrawer');
const closeBtn = document.getElementById('closeDrawer');

function openDrawer () {
  drawer?.classList.add('open');
  overlay?.classList.add('show');
}
function closeDrawer () {
  drawer?.classList.remove('open');
  overlay?.classList.remove('show');
}

openBtn?.addEventListener('click', openDrawer);
closeBtn?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);

// Tabs SPA
const tabs = Array.from(document.querySelectorAll('.tab'));
const views = Array.from(document.querySelectorAll('.view'));

function activate (tab) {
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

  // 🔥 Cargar lista al entrar a "miembros-activos"
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
async function cargarEventos ({ destinoId = 'eventList', tipo = '' } = {}) {
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

async function cargarEventosHome () {
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
async function cargarMensajeSemanal () {
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

/// ====== Miembros / Perfil ======
// Nota: Recomendado usar Supabase Auth para que RLS reconozca auth.uid().
const formMiembro = document.getElementById('formMiembro');

const perfilEstado     = document.getElementById('perfilEstado');
const perfilNombreTxt  = document.getElementById('perfilNombreTexto');
const perfilRolTxt     = document.getElementById('perfilRolTexto');
const perfilFraseTxt   = document.getElementById('perfilFraseTexto');

const perfilNombreInput = document.getElementById('perfilNombreInput');
const perfilRolSelect   = document.getElementById('perfilRolSelect');
const perfilFraseInput  = document.getElementById('perfilFraseInput');

const avatarInicial = document.getElementById('perfilAvatarInicial');
const avatarImg     = document.getElementById('perfilAvatarImg');
const btnCambiarFoto = document.getElementById('btnCambiarFoto');
const fotoInput      = document.getElementById('perfilFotoInput');

function ocultarFormularioPerfil() {
  if (formMiembro) {
    formMiembro.style.display = 'none';
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
    if (avatarInicial) avatarInicial.textContent = nombre.trim().charAt(0).toUpperCase();
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



  // Guardar info básica de perfil en localStorage (sin tocar la BD)
   const perfilGuardado = { nombre, rol_key, frase };
  localStorage.setItem('jc_perfil', JSON.stringify(perfilGuardado));
  actualizarUIPerfil(perfilGuardado);

  const labelRol =
    rol_key === 'moderador'
      ? 'moderador (solicitud enviada)'
      : rol_key === 'voluntario'
      ? 'voluntario digital'
      : 'miembro';

  if (huboErrorRemoto) {
    mostrarEstadoPerfil(
      `Perfil guardado en este dispositivo como ${labelRol}. Más adelante se sincronizará con el servidor.`,
      'error'
    );
  } else {
    mostrarEstadoPerfil(`Registro guardado correctamente como ${labelRol}.`, 'ok');
  }

  // Ya no necesitamos mostrar el formulario después del primer registro
  ocultarFormularioPerfil();
;

formMiembro?.addEventListener('submit', async (e) => {
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
    console.warn('No se pudo leer usuario de Supabase Auth (se guarda como invitado):', err);
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
      ? 'moderador (solicitud enviada)'
      : rol_key === 'voluntario'
      ? 'voluntario digital'
      : 'miembro';

  if (huboErrorRemoto) {
    mostrarEstadoPerfil(
      `Perfil guardado solo en este dispositivo como ${labelRol}. Más adelante se sincronizará con el servidor.`,
      'error'
    );
  } else {
    mostrarEstadoPerfil(`Registro guardado correctamente como ${labelRol}.`, 'ok');
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

// ====== Recursos ======
const fileInput = document.getElementById('fileRec');

fileInput?.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const path = `${Date.now()}-${file.name}`;

  const { error: upErr } = await sb.storage
    .from('recursos')
    .upload(path, file, { upsert: false });

  if (upErr) {
    alert('Error al subir');
    console.error(upErr);
    return;
  }

  const { data: u } = await sb.auth.getUser();

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
    subido_por: u?.user?.id || null
  });

  listarRecursos();
});

async function listarRecursos () {
  const { data, error } = await sb
    .from('recursos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    return;
  }

  const ul = document.getElementById('listaRecursos');
  if (!ul) return;

  ul.innerHTML = '';

  for (const r of data || []) {
    const { data: url } = sb.storage.from('recursos').getPublicUrl(r.path);
    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <span>${r.titulo}</span>
      <a class="btn small" href="${url.publicUrl}" target="_blank" rel="noopener noreferrer">Abrir</a>
    `;
    ul.appendChild(li);
  }
}

// ====== Avisos (UI log) ======
const avisosList = document.getElementById('avisosList');

function logAviso ({ title = 'Aviso', body = '' }) {
  if (!avisosList) return;
  const li = document.createElement('li');
  li.className = 'notice-item';
  li.textContent = `${new Date().toLocaleTimeString(LOCALE, {
    timeZone: TZ
  })} — ${title}: ${body}`;
  avisosList.prepend(li);
}

// ====== Paleta por usuario (Supabase) ======
async function cargarPaletaUsuario (uid) {
  if (!uid) return;
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
async function cargarPublic () {
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


// ====== Push / PWA ======
const btnPermPush = document.getElementById('btnPermPush');
btnPermPush?.addEventListener('click', () => setupPush());

// Protegerse si Firebase no está inicializado
let messaging = null;
if (window.firebase && firebase.apps && firebase.apps.length) {
  messaging = firebase.messaging(); // FCM solo si hay app inicializada
} else {
  console.warn('Firebase no inicializado; notificaciones desactivadas por ahora.');
}

async function setupPush () {
  if (!messaging) {
    console.warn('No hay instancia de messaging; omitiendo setupPush.');
    return;
  }
  try {
    await Notification.requestPermission();
    const token = await messaging.getToken({ vapidKey: 'TU_VAPID_KEY' });
    logAviso({
      title: 'Notificaciones',
      body: 'Permiso activado correctamente.'
    });
    console.log('FCM token', token);
  } catch (err) {
    console.error('FCM error', err);
  }
}

// SW (usa rutas relativas si publicas en subcarpeta, p.ej. GitHub Pages)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Si usas GitHub Pages en /JuventudCnc/, es más seguro usar rutas relativas:
      await navigator.serviceWorker.register('./service-worker.js');
      await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      console.log('SW registrados');
    } catch (e) {
      console.error('SW error', e);
    }
  });
}

// FAB demo
document.getElementById('fab')?.addEventListener('click', () => {
  const active = document.querySelector('.tab.active')?.dataset.tab;
  if (active === 'eventos') {
    alert('Crear nuevo evento (admin)');
  } else if (active === 'recursos') {
    document.getElementById('fileRec')?.click();
  } else {
    alert('Acción rápida');
  }
});

async function cargarListaMiembros () {
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
// ================== ANGIE ANIMADA TRAVIESA ==================
(function initAngieTraviesa () {
  const widget = document.getElementById('angieWidget');
  const textEl = document.getElementById('angieText');
  const btnClose = document.getElementById('angieClose');

  if (!widget || !textEl) return;

  const STORAGE_KEY_HIDE = 'jc_angie_hide_until';

  // Siempre retorna un nombre válido
  function obtenerNombreUsuario() {
    const raw = document.getElementById("perfilNombreTexto")?.textContent;
    return raw && raw.trim().length > 0 ? raw.trim() : "amigo";
  }

  // --- Saludo inicial (antes del sistema) ---
  setTimeout(() => {
    const nombre = obtenerNombreUsuario();
    const frasesIniciales = [
      `¡Hola ${nombre}! ¿Ya tomaste agüita hoy? 💧`,
      `${nombre}, adivina... ¡Dios tiene un plan contigo! ✨`,
      `Oye ${nombre}, vi que te esforzaste hoy 👀`,
      `¡Hey! ¿Listo para un gran día? 😄`,
      `Te estuve esperando, ${nombre} 💗💙`
    ];

    widget.classList.add("angie-widget--visible");
    textEl.textContent =
      frasesIniciales[Math.floor(Math.random() * frasesIniciales.length)];
  }, 1800);
  // --- FIN saludo inicial ---


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

  function momentoDelDia() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'manana';
    if (h >= 12 && h < 19) return 'tarde';
    return 'noche';
  }

  function elegirMensaje(nombre) {
    const bloque = mensajesBase[momentoDelDia()] || mensajesBase.tarde;
    const extra = Math.random() < 0.35 ? mensajesBase.travesuras : [];
    const pool = bloque.concat(extra);

    const msg = pool[Math.floor(Math.random() * pool.length)];
    return msg.replace("{{nombre}}", nombre);
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
      setTimeout(() => widget.classList.remove('angie-widget--wiggle'), 3000);
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
})();