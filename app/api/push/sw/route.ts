// The push service worker, served from /api/push/sw (scope /api/push/): it only shows notifications
// and opens the link on tap. No fetch handler, so it never touches page loads or caching.
export const dynamic = 'force-static';

const SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Uithoorn.online', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Uithoorn.online';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', tag: d.tag || undefined, renotify: Boolean(d.tag), requireInteraction: true,
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/provider' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/provider', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
`;

export function GET() {
  return new Response(SW, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}
