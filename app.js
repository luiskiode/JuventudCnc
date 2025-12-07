// ====== Boot ======
const sb = window.supabaseClient;
const LOCALE = 'es-PE';
const TZ = 'America/Lima';

// Drawer
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openDrawer');
const closeBtn = document.getElementById('closeDrawer');
function openDrawer(){ drawer?.classList.add('open'); overlay?.classList.add('show'); }
function closeDrawer(){ drawer?.classList.remove('open'); overlay?.classList.remove('show'); }
openBtn?.addEventListener('click', openDrawer);
closeBtn?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);

// Tabs SPA
const tabs = Array.from(document.querySelectorAll('.tab'));
const views = Array.from(document.querySelectorAll('.view'));
function activate(tab){
  const t = typeof tab === 'string' ? tab : tab?.dataset.tab;
  if(!t) return;
  tabs.forEach(b=>{ const on = b.dataset.tab===t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on? 'true':'false'); });
  views.forEach(v=> v.classList.toggle('active', v.dataset.view===t));
  document.querySelector(`#view-${t}`)?.focus({ preventScroll:false });
  if(location.hash !== `#${t}`) history.replaceState(null, '', `#${t}`);
}
document.querySelectorAll('[data-tab]').forEach(el=> el.addEventListener('click', (e)=>{ e.preventDefault(); activate(el.getAttribute('data-tab')); closeDrawer(); }));
window.addEventListener('hashchange', ()=> activate((location.hash||'#inicio').replace('#','')));
activate((location.hash||'#inicio').replace('#',''));

// ====== Util ======
const fmtDate = (d) => new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday:'long', month:'short', day:'numeric' }).format(d);
const fmtTime = (d) => new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour:'2-digit', minute:'2-digit' }).format(d);

// ====== Eventos ======
async function cargarEventos({ destinoId='eventList', tipo='' }={}){
  let query = sb.from('eventos').select('*').gte('fecha', new Date().toISOString()).order('fecha', { ascending: true });
  if(tipo) query = query.eq('tipo', tipo);
  const { data, error } = await query.limit(50);
  if(error){ console.error(error); return; }
  const ul = document.getElementById(destinoId);
  ul.innerHTML = '';
  (data||[]).forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';
    const fecha = new Date(ev.fecha);
    const meta = `${fmtDate(fecha)} ${fmtTime(fecha)}`;
    li.innerHTML = `<span class="event-title">${ev.titulo}</span><span class="event-meta">${meta}</span>`;
    li.title = `${ev.descripcion||''}`;
    li.addEventListener('click',()=>{
      const q = encodeURIComponent(`${ev.lugar || ''}`);
      if(q) window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');
    });
    ul.appendChild(li);
  });
}

async function cargarEventosHome(){
  const { data } = await sb.from('eventos').select('*').gte('fecha', new Date().toISOString()).order('fecha',{ascending:true}).limit(4);
  const ul = document.getElementById('eventListHome');
  if(!ul) return;
  ul.innerHTML = '';
  (data||[]).forEach(ev=>{
    const li = document.createElement('li');
    li.className='event-item';
    const fecha = new Date(ev.fecha);
    const meta = `${new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, month:'short', day:'numeric' }).format(fecha)} · ${fmtTime(fecha)}`;
    li.innerHTML = `<span class="event-title">${ev.titulo}</span><span class="event-meta">${meta}</span>`;
    ul.appendChild(li);
  });
}
document.getElementById('filtroTipo')?.addEventListener('change', (e)=> cargarEventos({ destinoId:'eventList', tipo: e.target.value }));

// ====== Mensaje semanal ======
async function cargarMensajeSemanal(){
  const monday = (d=>{const n=new Date(d); const day=(n.getDay()+6)%7; n.setDate(n.getDate()-day); n.setHours(0,0,0,0); return n})(new Date());
  const { data, error } = await sb.from('mensaje_semanal').select('*').eq('semana_start', monday.toISOString().slice(0,10)).maybeSingle();
  const t = document.getElementById('msgTitle');
  const b = document.getElementById('msgBody');
  const m = document.getElementById('msgMeta');
  if(error){ console.error(error); t.textContent='–'; b.textContent=''; return; }
  if(!data){ t.textContent='Mensaje no publicado'; b.textContent='Vuelve pronto.'; m.textContent=''; return; }
  t.textContent = data.titulo || 'Mensaje para la semana';
  b.textContent = data.contenido;
  m.textContent = `Por ${data.autor} • ${new Date(data.publicado_at).toLocaleString(LOCALE, { timeZone: TZ })}`;
}

// ====== Miembros ======
// Nota: Recomendado usar Supabase Auth para que RLS reconozca auth.uid().
const formMiembro = document.getElementById('formMiembro');
formMiembro?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = new FormData(formMiembro);
  const { data: u } = await sb.auth.getUser();
  const payload = {
    nombre: f.get('nombre'),
    edad: Number(f.get('edad')),
    contacto: f.get('contacto')||null,
    ministerio: f.get('ministerio')||null,
    rol_key: f.get('rol_key')||'miembro',
    user_id: u?.user?.id || null // UUID de Supabase Auth
  };
  const { error } = await sb.from('miembros').insert(payload);
  if(error){ alert('Error al guardar miembro'); console.error(error); }
  else { alert('¡Miembro registrado!'); formMiembro.reset(); }
});

// ====== Recursos ======
const fileInput = document.getElementById('fileRec');
fileInput?.addEventListener('change', async ()=>{
  const file = fileInput.files[0];
  if(!file) return;
  const path = `${Date.now()}-${file.name}`;
  const { error: upErr } = await sb.storage.from('recursos').upload(path, file, { upsert:false });
  if(upErr){ alert('Error al subir'); console.error(upErr); return; }
  const { data: u } = await sb.auth.getUser();
  await sb.from('recursos').insert({
    titulo: file.name,
    categoria: file.type.includes('pdf')?'pdf':(file.type.includes('audio')?'audio':(file.type.includes('image')?'imagen':'otro')),
    path, mime: file.type, subido_por: u?.user?.id || null
  });
  listarRecursos();
});
async function listarRecursos(){
  const { data, error } = await sb.from('recursos').select('*').order('created_at',{ascending:false}).limit(20);
  if(error) return console.error(error);
  const ul = document.getElementById('listaRecursos');
  if(!ul) return;
  ul.innerHTML='';
  for(const r of (data||[])){
    const { data: url } = sb.storage.from('recursos').getPublicUrl(r.path);
    const li = document.createElement('li');
    li.className='file-item';
    li.innerHTML = `<span>${r.titulo}</span><a class="btn small" href="${url.publicUrl}" target="_blank">Abrir</a>`;
    ul.appendChild(li);
  }
}

// ====== Avisos (UI log) ======
const avisosList = document.getElementById('avisosList');
function logAviso({ title='Aviso', body='' }){
  if(!avisosList) return;
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString(LOCALE, { timeZone: TZ })} — ${title}: ${body}`;
  avisosList.prepend(li);
}

// ====== Auth (Supabase) y roles ======
sb.auth.onAuthStateChange(async (_event, session)=>{
  // Oculta por defecto
  document.querySelectorAll('.adminOnly').forEach(el=> el.hidden = true);

  const uid = session?.user?.id || null;
  if(!uid){ cargarPublic(); return; }

  // Chequear rol en BD (RLS aplica sobre auth.uid())
  const { data } = await sb.from('miembros').select('rol_key').eq('user_id', uid).maybeSingle();
  if(data?.rol_key === 'admin' || data?.rol_key === 'moderador'){
    document.querySelectorAll('.adminOnly').forEach(el=> el.hidden = false);
  }
  cargarPublic();
});

// Carga pública
function cargarPublic(){
  cargarMensajeSemanal();
  cargarEventos();
  cargarEventosHome();
  listarRecursos();
}

// ====== Push / PWA ======
const btnPermPush = document.getElementById('btnPermPush');
btnPermPush?.addEventListener('click', ()=> setupPush());

const messaging = firebase.messaging(); // FCM solo para notificaciones
async function setupPush(){
  try{
    await Notification.requestPermission();
    const token = await messaging.getToken({ vapidKey: 'TU_VAPID_KEY' });
    logAviso({ title:'Notificaciones', body:'Permiso activado correctamente.' });
    console.log('FCM token', token);
  }catch(err){ console.error('FCM error', err); }
}

// SW (usa rutas relativas si publicas en subruta)
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      // Si usas GitHub Pages en /juventud-cnc/, registra './service-worker.js'
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('SW registrados');
    }catch(e){ console.error('SW error', e); }
  });
}

// FAB demo
document.getElementById('fab')?.addEventListener('click', ()=>{
  const active = document.querySelector('.tab.active')?.dataset.tab;
  if(active==='eventos') alert('Crear nuevo evento (admin)');
  else if(active==='recursos') document.getElementById('fileRec')?.click();
  else alert('Acción rápida');
});