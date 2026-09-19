/*
  عامل الخدمة (Service Worker) — يجعل «مكة» يعمل بدون إنترنت:
  يخزّن ملفات التطبيق محلياً، وأي زيارة لاحقة تعمل من الذاكرة المؤقتة.
  عند تحديث النظام: غيّر رقم الإصدار VER ليُعاد التحميل تلقائياً.
*/
const VER = 'makkah-v1.0.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/core/util.js',
  './js/core/db.js',
  './js/core/bus.js',
  './js/core/auth.js',
  './js/core/repo.js',
  './js/core/attendance.js',
  './js/core/ai.js',
  './js/ui/components.js',
  './js/features/dashboard.js',
  './js/features/workers.js',
  './js/features/ledger.js',
  './js/features/customers.js',
  './js/features/suppliers.js',
  './js/features/inventory.js',
  './js/features/invoices.js',
  './js/features/reports.js',
  './js/features/settings.js',
  './js/features/assistant.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VER).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
