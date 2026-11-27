// 앱 껍데기만 캐시합니다(오프라인에서도 열림). 데이터는 항상 서버에서 받아옵니다.
const CACHE = 'mmbc-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'js/app.js', 'js/store-demo.js', 'js/store-supabase.js',
  'vendor/supabase-2.119.0.js', 'icons/icon-192.png', 'icons/mark.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // 새 버전을 먼저 시도하고, 안 되면 캐시
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});

// 푸시 알림
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '모닝머니북클럽', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-64.png', tag: d.tag, data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.location.origin)) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
