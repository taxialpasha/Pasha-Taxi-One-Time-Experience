// في ملف firebase-config.js

const firebaseConfig = {
    apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPf1n1TrAzwEMiAI",
    authDomain: "messageemeapp.firebaseapp.com",
    databaseURL: "https://messageemeapp-default-rtdb.firebaseio.com",
    projectId: "messageemeapp",
    storageBucket: "messageemeapp.appspot.com",
    messagingSenderId: "255034474844",
    appId: "1:255034474844:web:5e3b7a6bc4b2fb94cc4199"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// تهيئة خدمات Firebase
const database = firebase.database();
const storage = firebase.storage();
const messaging = firebase.messaging();

// تكوين FCM مع مفتاح VAPID
messaging.usePublicVapidKey('BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc');

// دالة لتحديث token الإشعارات للمستخدم
async function updateNotificationToken(userId) {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await messaging.getToken();
            await database.ref(`users/${userId}/notificationToken`).set(token);
            console.log('تم تحديث token الإشعارات بنجاح');
        }
    } catch (error) {
        console.error('خطأ في تحديث token الإشعارات:', error);
    }
}

// الاستماع لتحديثات الـ token
messaging.onTokenRefresh(async () => {
    try {
        const token = await messaging.getToken();
        const userId = localStorage.getItem('userId');
        if (userId) {
            await database.ref(`users/${userId}/notificationToken`).set(token);
        }
    } catch (error) {
        console.error('خطأ في تحديث token الإشعارات:', error);
    }
});

// معالجة الإشعارات عندما يكون التطبيق مفتوحاً
messaging.onMessage((payload) => {
    console.log('تم استلام إشعار:', payload);
    
    // إنشاء وإظهار الإشعار
    const notification = payload.notification;
    locationNotificationSystem.showInAppNotification({
        title: notification.title,
        body: notification.body,
        icon: notification.icon
    });

    // تشغيل صوت الإشعار
    const audio = new Audio('/notification-sound.mp3');
    audio.play().catch(error => console.log('لا يمكن تشغيل صوت الإشعار:', error));
});

// دالة للتحقق من صلاحيات الموقع
async function checkLocationPermission() {
    if ('permissions' in navigator) {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state === 'granted';
        } catch (error) {
            console.error('خطأ في التحقق من صلاحيات الموقع:', error);
            return false;
        }
    }
    return !!navigator.geolocation;
}

// تحديث Service Worker للإشعارات في الخلفية
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
            messaging.useServiceWorker(registration);
            console.log('تم تسجيل Service Worker بنجاح');
        })
        .catch((error) => {
            console.error('خطأ في تسجيل Service Worker:', error);
        });
}

// تصدير المتغيرات والدوال
export {
    database,
    storage,
    messaging,
    updateNotificationToken,
    checkLocationPermission
};