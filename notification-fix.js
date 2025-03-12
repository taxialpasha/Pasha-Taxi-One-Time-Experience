document.addEventListener('DOMContentLoaded', function() {
    // التأكد من تحميل Firebase
    if (typeof firebase !== 'undefined') {
        // تهيئة مستمع للإشعارات الجديدة
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        // الاستماع إلى الإشعارات الجديدة
        firebase.database().ref(`users/${userId}/notifications`).on('child_added', function(snapshot) {
            const notification = snapshot.val();
            
            // إذا كان الإشعار جديد وغير مقروء
            if (notification && !notification.read) {
                // تحديث عداد الإشعارات
                updateNotificationCounter();
                
                // عرض إشعار Toast
                showNotificationToast(notification);
                
                // تشغيل صوت الإشعار
                playNotificationSound();
            }
        });
        
        // تحديث العداد عند بدء التشغيل
        updateNotificationCounter();
    }
});

// تحديث عداد الإشعارات
function updateNotificationCounter() {
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    // البحث عن الإشعارات غير المقروءة
    firebase.database().ref(`users/${userId}/notifications`).orderByChild('read').equalTo(false).once('value', function(snapshot) {
        const unreadCount = snapshot.numChildren();
        
        // تحديث شارة عدد الإشعارات
        const badge = document.getElementById('notificationsBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    });
}

// عرض إشعار Toast
function showNotificationToast(notification) {
    // إنشاء عنصر Toast
    const toast = document.createElement('div');
    toast.className = 'notification-toast animate__animated animate__fadeInRight';
    
    // تحديد محتوى الإشعار
    toast.innerHTML = `
        <div class="notification-icon">
            ${notification.icon ? 
                `<img src="${notification.icon}" alt="صورة الإشعار" onerror="this.src='default-driver.png'">` : 
                `<i class="fas fa-bell" style="font-size: 24px; color: #FFD700;"></i>`
            }
        </div>
        <div class="notification-content">
            <div class="notification-title">${notification.title || 'إشعار'}</div>
            <div class="notification-message">${notification.message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // إضافة Toast إلى الصفحة
    document.body.appendChild(toast);
    
    // إزالة Toast بعد 5 ثوانٍ
    setTimeout(() => {
        toast.classList.add('fadeOut');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 500);
    }, 5000);
}

// تشغيل صوت الإشعار
function playNotificationSound() {
    const notificationSound = document.getElementById('notificationSound');
    if (notificationSound) {
        // إعادة الصوت إلى البداية
        notificationSound.currentTime = 0;
        
        // تشغيل الصوت
        notificationSound.play().catch(error => {
            console.warn('Error playing notification sound:', error);
        });
    }
}
