async function testNotifications() {
    const statusDiv = document.getElementById('notification-status');
    statusDiv.innerHTML = 'جاري الاختبار...';

    try {
        // 1. التحقق من دعم الإشعارات
        if (!('Notification' in window)) {
            throw new Error('المتصفح لا يدعم الإشعارات');
        }

        // 2. طلب الإذن
        const permission = await Notification.requestPermission();
        updateStatus('إذن الإشعارات:', permission);

        // 3. الحصول على توكن FCM
        const messaging = firebase.messaging();
        const token = await messaging.getToken({
            vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc'
        });
        updateStatus('FCM Token:', token);

        // 4. إرسال إشعار تجريبي
        if (permission === 'granted') {
            const notification = new Notification('إشعار تجريبي', {
                body: 'تم إرسال الإشعار بنجاح!',
                icon: '/pngwing.com.png'
            });
            updateStatus('حالة الإشعار:', 'تم الإرسال بنجاح');
        }

    } catch (error) {
        updateStatus('خطأ:', error.message);
    }
}

function updateStatus(label, value) {
    const statusDiv = document.getElementById('notification-status');
    statusDiv.innerHTML += `<p><strong>${label}</strong> ${value}</p>`;
}