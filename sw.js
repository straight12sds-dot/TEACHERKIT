// Service worker: ให้ TEACHERKIT ใช้งานได้แม้ไม่มีอินเทอร์เน็ต
// ใช้กลยุทธ์ network-first เพื่อให้ได้เวอร์ชันล่าสุดเสมอเมื่อออนไลน์
const CACHE = 'teacherkit-v3';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/vendor/qrcode.js',
  ...['classes', 'picker', 'groups', 'timer', 'attendance', 'grades', 'scoreboard', 'noise', 'seating', 'random', 'qr', 'schedule', 'behavior', 'homework', 'exam', 'teachlog'].map(t => `js/tools/${t}.js`),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
