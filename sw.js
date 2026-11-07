// Service worker: ให้ TEACHERKIT ใช้งานได้แม้ไม่มีอินเทอร์เน็ต
// ใช้กลยุทธ์ network-first เพื่อให้ได้เวอร์ชันล่าสุดเสมอเมื่อออนไลน์
const CACHE = 'teacherkit-v5';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/vendor/qrcode.js',
  'js/roster-scanner.js', 'js/roster-ocr.js', 'js/roster-ocr-worker.js',
  ...['classes', 'picker', 'groups', 'timer', 'attendance', 'grades', 'scoreboard', 'noise', 'seating', 'random', 'qr', 'schedule', 'behavior', 'homework', 'exam', 'teachlog'].map(t => `js/tools/${t}.js`),
];
// โหลด OCR เฉพาะตอนใช้ครั้งแรก และเก็บโปรแกรม/ภาษาไว้ใช้ซ้ำ ไม่ cache ภาพของครู
const OCR_SOURCES = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/',
  'https://tessdata.projectnaptha.com/4.0.0_fast/',
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
        if (res.ok && (new URL(e.request.url).origin === location.origin || OCR_SOURCES.some(source => e.request.url.startsWith(source)))) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (e.request.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
        return Response.error();
      })
  );
});

