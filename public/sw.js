self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch(e) {}
  }
  event.waitUntil(self.registration.showNotification('Crypto Risk Alert', {
    body: data.message || 'Magas kockázati szint elérve'
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});