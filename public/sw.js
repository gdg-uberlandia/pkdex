/* Push only: authenticated pages and API responses are never cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (!message || typeof message.title !== "string") return;
  const noticeId = typeof message.noticeId === "string" && /^[0-9a-f-]{36}$/i.test(message.noticeId) ? message.noticeId : null;
  event.waitUntil(self.registration.showNotification(message.title, {
    icon: "/icons/pwa-192.png",
      body: typeof message.body === "string" ? message.body : "",
    tag: noticeId || "devfest-notice",
    data: { url: noticeId ? `/notices/${noticeId}` : "/notices" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notices", self.location.origin);
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/notices")) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === target.href);
    if (existing) return existing.focus();
    return self.clients.openWindow(target.href);
  })());
});
