// Service Worker للقصص في تطبيق تاكسي العراق

const CACHE_NAME = 'stories-cache-v1';
const OFFLINE_URL = '/offline-stories.html';

// المصادر التي يجب تخزينها مسبقًا
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/style.css',
  '/stories-style.css',
  '/stories.js',
  '/stories-integration.js',
  '/default-avatar.png'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// تنشيط Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية الشبكة أولاً ثم السقوط إلى التخزين المؤقت
self.addEventListener('fetch', event => {
  // تجاهل طلبات من Firebase
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com')) {
    return;
  }
  
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // استراتيجية الشبكة أولاً، ثم التخزين المؤقت
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // تخزين نسخة جديدة من المورد
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            // تخزين فقط إذا كانت الاستجابة ناجحة
            if (response.status === 200) {
              cache.put(event.request, responseClone);
            }
          });
        
        return response;
      })
      .catch(() => {
        // الاستجابة من التخزين المؤقت في حالة عدم الاتصال
        return caches.match(event.request)
          .then(cachedResponse => {
            // إذا وجدنا استجابة في التخزين المؤقت، أعدها
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // للطلبات الخاصة بالصفحات، عرض صفحة عدم الاتصال
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // إذا لم نجد استجابة، نعيد خطأ
            return new Response('غير متوفر دون اتصال بالإنترنت', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// استقبال الإشعارات
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    // محاولة تحليل البيانات
    const data = event.data.json();
    
    // التحقق من نوع الإشعار
    if (data.type === 'new_story') {
      // إنشاء إشعار بقصة جديدة
      const options = {
        body: data.body || 'قصة جديدة متاحة!',
        icon: data.icon || '/default-avatar.png',
        badge: '/notification-badge.png',
        data: {
          url: data.url || '/',
          storyId: data.storyId,
          userId: data.userId
        },
        actions: [
          {
            action: 'view',
            title: 'عرض'
          },
          {
            action: 'close',
            title: 'إغلاق'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'قصة جديدة', options)
      );
    }
  } catch (error) {
    console.error('خطأ في معالجة إشعار القصص:', error);
  }
});

// النقر على الإشعار
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // فتح الصفحة المناسبة وعرض القصة
  const data = event.notification.data;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // التحقق إذا كان التطبيق مفتوح بالفعل
        for (const client of clientList) {
          if (client.url === data.url && 'focus' in client) {
            return client.focus()
              .then(client => {
                // إرسال رسالة لفتح القصة
                if (data.userId) {
                  client.postMessage({
                    type: 'OPEN_STORY',
                    userId: data.userId,
                    storyId: data.storyId
                  });
                }
                return client;
              });
          }
        }
        
        // إذا لم يكن التطبيق مفتوحًا، فتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow(data.url);
        }
      })
  );
});

// استقبال الرسائل
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// تحديث تسجيل الخدمة عند تغيير الإصدار
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'UPDATE_VERSION') {
    self.registration.update();
  }
});