// firebase-messaging-sw.js (seguro - sin secretos)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Solo datos públicos del cliente (NUNCA service account). Con compat basta con el senderId.
// Puedes usar tu config pública completa si prefieres, pero nunca la private_key.
firebase.initializeApp({
  messagingSenderId: 'TU_MESSAGING_SENDER_ID'
});

const messaging = firebase.messaging();

// Notificaciones en background
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // opcional: abrir app
  e.waitUntil(clients.openWindow('/#avisos'));
});

messaging.onBackgroundMessage(({ notification }) => {
  const title = notification?.title || 'Juventud CNC';
  const body = notification?.body || 'Nuevo aviso';
  const icon = notification?.icon || '/icons/icon-192.png';
  self.registration.showNotification(title, { body, icon });
});