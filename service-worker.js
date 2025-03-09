const CACHE_NAME = 'taxi-iraq-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/scripts/main.js',
  // الصورة الرئيسية للتطبيق
  'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527',
  // الملفات الإضافية المهمة
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.rtl.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  '/offline.html',
  '/style.css',
  '/app.js',
  '/notifications-manager.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/default-driver.png',
  'https://github.com/AlQasimMall/taxialpasha/raw/main/%D8%A7%D9%84%D9%87%D8%A7%D8%AA%D9%81-%D8%A7%D9%84%D8%AB%D8%A7%D8%A8%D8%AA.mp3'
];

// تثبيت Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('فتح التخزين المؤقت بنجاح');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // تخطي مرحلة الانتظار
  );
});

// تنشيط Service Worker وحذف التخزين المؤقت القديم
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('حذف التخزين المؤقت القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// التعامل مع طلبات الشبكة
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // إذا وجد في التخزين المؤقت، أعد النسخة المخزنة
        if (response) {
          return response;
        }

        // إذا لم يوجد، حاول جلبه من الشبكة
        return fetch(event.request)
          .then(function(networkResponse) {
            // تحقق من صحة الاستجابة
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // انسخ الاستجابة قبل تخزينها
            const responseToCache = networkResponse.clone();

            // احفظ النسخة في التخزين المؤقت
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(function() {
            // إذا فشل الطلب، تحقق مما إذا كان طلب صورة
            if (event.request.destination === 'image') {
              return caches.match('https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527');
            }
            // إذا كان طلب صفحة، أعد صفحة عدم الاتصال
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// معالجة أحداث التحديث
self.addEventListener('message', function(event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// معالجة إشعارات الدفع
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    // عرض الإشعار
    const title = data.title || 'تاكسي العراق';
    const options = {
      body: data.message || 'إشعار جديد',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      tag: data.tag || 'default',
      data: data.data || {}
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
});

// معالجة النقر على الإشعار
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const url = event.notification.data.url || '/';
  const driverId = event.notification.data.driverId;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // التحقق مما إذا كانت هناك نافذة مفتوحة بالفعل
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // إرسال رسالة إلى النافذة لفتح صفحة السائق إذا تم توفير معرف
          if (driverId) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              driverId: driverId
            });
          }
          return client.focus();
        }
      }
      
      // فتح نافذة جديدة إذا لم يتم العثور على نافذة مفتوحة
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

const firebaseConfig = {
  apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPf1n1TrAzwEMiAI",
  authDomain: "messageemeapp.firebaseapp.com",
  databaseURL: "https://messageemeapp-default-rtdb.firebaseio.com",
  projectId: "messageemeapp",
  storageBucket: "messageemeapp.appspot.com",
  messagingSenderId: "255034474844",
  appId: "1:255034474844:web:5e3b7a6bc4b2fb94cc4199"
};

firebase.initializeApp(firebaseConfig);

// تهيئة الإشعارات
const messaging = firebase.messaging();
messaging.getToken({ vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc' })
.then((currentToken) => {
  if (currentToken) {
    console.log('Token:', currentToken);
    // أرسل التوكن إلى السيرفر الخاص بك لتخزينه
  } else {
    console.log('No registration token available.');
  }
}).catch((err) => {
  console.error('Error while retrieving token:', err);
});
