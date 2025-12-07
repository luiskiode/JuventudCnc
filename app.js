// ====== Boot ======
const sb = window.supabaseClient;
const LOCALE = 'es-PE';
const TZ = 'America/Lima';

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

formMiembro?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(formMiembro);
  const nombre = f.get('nombre');
  const rol_key = f.get('rol_key') || 'miembro';
  const frase = f.get('frase') || '';

  const { data: u } = await sb.auth.getUser();
  const payload = {
    nombre,
    edad: Number(f.get('edad')),
    contacto: f.get('contacto') || null,
    ministerio: f.get('ministerio') || null,
    rol_key,
    user_id: u?.user?.id || null // UUID de Supabase Auth
  };

  const { error } = await sb.from('miembros').insert(payload);
  if (error) {
    console.error(error);
    mostrarEstadoPerfil('Ocurrió un error al guardar tu registro. Intenta nuevamente.', 'error');
    alert('Error al guardar miembro');
    return;
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

  mostrarEstadoPerfil(`Registro guardado correctamente como ${labelRol}.`, 'ok');

  formMiembro.reset();
});

// Restaurar perfil desde localStorage al cargar
(function restaurarPerfilDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem('jc_perfil');
    if (raw) {
      const p = JSON.parse(raw);
      actualizarUIPerfil(p);

      // Prefill inputs
      if (perfilNombreInput && p.nombre) perfilNombreInput.value = p.nombre;
      if (perfilRolSelect && p.rol_key) perfilRolSelect.value = p.rol_key;
      if (perfilFraseInput && p.frase) perfilFraseInput.value = p.frase;
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

// ====== Auth (Supabase) y roles ======
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

  // Cargar paleta visual desde Supabase si existe
  await cargarPaletaUsuario(uid);

  // Cargar contenido público
  cargarPublic();
});

// Carga pública
function cargarPublic () {
  cargarMensajeSemanal();
  cargarEventos();
  cargarEventosHome();
  listarRecursos();
}

// ====== Push / PWA ======
const btnPermPush = document.getElementById('btnPermPush');
btnPermPush?.addEventListener('click', () => setupPush());

const messaging = firebase.messaging(); // FCM solo para notificaciones

async function setupPush () {
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