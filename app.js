// Registrar service worker (PWA)
if ('serviceWorker' in navigator) {
window.addEventListener('load', () => {
navigator.serviceWorker.register('/service-worker.js').catch(console.error);
});
}


// Mock de eventos (sustituir luego por Supabase/Calendario)
const eventos = [
{ titulo: 'Reunión de Oración', fecha: 'Viernes, 7 PM', lugar: 'Salón Parroquial' },
{ titulo: 'Formación Bíblica', fecha: 'Sábado, 5 PM', lugar: 'Aula 2' },
{ titulo: 'Voluntariado Cáritas', fecha: 'Domingo, 9 AM', lugar: 'Comedor' },
];


const list = document.getElementById('eventList');
function renderEventos(){
list.innerHTML = '';
eventos.forEach(ev => {
const li = document.createElement('li');
li.className = 'event-item';
li.innerHTML = `<span class="event-title">${ev.titulo}</span><span class="event-meta">${ev.fecha}</span>`;
li.title = `${ev.titulo} • ${ev.lugar}`;
list.appendChild(li);
});
}
renderEventos();


// Drawer control
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openDrawer');
const closeBtn = document.getElementById('closeDrawer');


function openDrawer(){ drawer.classList.add('open'); overlay.classList.add('show'); }
function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.remove('show'); }
openBtn.addEventListener('click', openDrawer);
closeBtn.addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);


// FAB demo
document.getElementById('fab').addEventListener('click', () => {
alert('Acción rápida (ej: crear evento)');
});
