// تطبيق الإشراف التربوي الرقمي
// المالك والمبتكر: واضح محمد
// المهنة: مشرف تربوي — بشار
// البريد: hamadalh08@gmail.com
// تاريخ نظام الملكية: 19/09/2026
// الإصدار: 1.0.0
// © 2026 — جميع الحقوق محفوظة

// Service Worker لبرنامج الإشراف التربوي
// يعمل فقط عند استضافة الملف عبر رابط https (مثل Firebase Hosting)
// الهدف: تخزين الصفحة والمكتبات المستخدمة محلياً كي يفتح التطبيق فوراً حتى بلا إنترنت إطلاقاً
// لا يتدخل إطلاقاً في طلبات Firestore/Firebase حتى لا يؤثر على المزامنة الحية

const CACHE_NAME = 'sijil-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {}) // لا نمنع التثبيت لو فشل تخزين بعض الأصول مبدئياً
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

  // استراتيجية: تقديم النسخة المخزنة فوراً إن وُجدت (سرعة + عمل بلا إنترنت)،
  // مع تحديثها في الخلفية من الشبكة كلما توفر اتصال
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
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
