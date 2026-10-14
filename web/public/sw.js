// Only here because Android Chrome shows web notifications through a service worker. It caches
// nothing and handles no requests; a tap on the reminder reopens the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(self.registration.scope));
});
