// تطبيق الإشراف التربوي الرقمي
// المالك والمبتكر: واضح محمد
// المهنة: مشرف تربوي — بشار
// البريد: hamadalh08@gmail.com
// تاريخ نظام الملكية: 19/09/2026
// الإصدار: 1.0.0
// © 2026 — جميع الحقوق محفوظة

// Service Worker لبرنامج الإشراف التربوي
// يعمل فقط عند استضافة الملف عبر رابط https (مثل Firebase Hosting أو GitHub Pages)
// الهدف: تخزين الصفحة والمكتبات المستخدمة محلياً كي يفتح التطبيق فوراً حتى بلا إنترنت إطلاقاً
// لا يتدخل إطلاقاً في طلبات Firestore/Firebase حتى لا يؤثر على المزامنة الحية

const CACHE_NAME = 'sijil-cache-v5';
const CORE_ASSETS = [
  './',
  './index.html'
];
// مكتبات خارجية (CDN) يحتاجها التطبيق — تُطلب عبر وسم <script> بدون crossorigin،
// لذا تصل استجابتها "opaque" (بلا تفاصيل)، ويجب تخزينها بوضع no-cors صراحة
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([
        cache.addAll(CORE_ASSETS).catch(() => {}),
        // كل مكتبة CDN تُخزَّن على حدة بوضع no-cors؛ فشل واحدة لا يوقف البقية
        ...CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res)).catch(() => {})
        )
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // استثناء كامل لطلبات Firebase/Firestore/Google APIs — يجب أن تصل الشبكة مباشرة
  // حتى لا يؤثر التخزين المؤقت على حيوية المزامنة بين الأجهزة
  if (
    req.url.includes('firestore.googleapis.com') ||
    req.url.includes('googleapis.com') ||
    req.url.includes('firebaseio.com') ||
    req.url.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // صفحة HTML الرئيسية: "الشبكة أولاً" — نضمن دائماً أحدث نسخة مرفوعة طالما هناك
  // اتصال، ولا نلجأ للنسخة المخزَّنة إلا عند انعدام الاتصال فعلاً. هذا يمنع مشكلة
  // "تحديث لا يظهر رغم رفع نسخة جديدة" التي تسببت فيها استراتيجية الكاش-أولاً سابقاً.
  const isNavigation = req.mode === 'navigate' || req.url.endsWith('/') || req.url.endsWith('/index.html');
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // بقية الملفات (مكتبات CDN وغيرها): الكاش أولاً للسرعة، مع تحديث خلفي عند توفر الاتصال
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
