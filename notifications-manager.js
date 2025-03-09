// نظام إدارة الإشعارات لتطبيق تاكسي العراق
class NotificationsManager {
    constructor() {
        this.database = firebase.database();
        this.storage = firebase.storage();
        this.notifications = [];
        this.unreadCount = 0;
        this.notificationSound = document.getElementById('notificationSound') || new Audio('https://github.com/AlQasimMall/taxialpasha/raw/main/%D8%A7%D9%84%D9%87%D8%A7%D8%AA%D9%81-%D8%A7%D9%84%D8%AB%D8%A7%D8%A8%D8%AA.mp3');
        this.userId = localStorage.getItem('userId') || this.generateUserId();
        this.userLocation = null;
        
        // بدء تشغيل النظام
        this.init();
    }
    
    // إنشاء معرف مستخدم جديد إذا لم يكن موجوداً
    generateUserId() {
        const newUserId = 'user_' + Date.now();
        localStorage.setItem('userId', newUserId);
        return newUserId;
    }
    
    // تهيئة نظام الإشعارات
    init() {
        this.setupNotificationStyles();
        this.setupNotificationButton();
        this.setupNotificationModal();
        this.requestNotificationPermission();
        this.loadUserLocation();
        this.listenToNewDrivers();
        this.listenToUserNotifications();
    }
    
    // إضافة الأنماط الخاصة بالإشعارات
    setupNotificationStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* شارة الإشعارات */
            .notifications-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background-color: #FF4136;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                font-weight: bold;
                border: 2px solid #1a1a1a;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            /* نافذة الإشعارات المنبثقة */
            .notifications-container {
                max-height: 70vh;
                overflow-y: auto;
                padding: 10px;
            }
            
            .notifications-container::-webkit-scrollbar {
                width: 8px;
            }
            
            .notifications-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .notifications-container::-webkit-scrollbar-thumb {
                background: #FFD700;
                border-radius: 4px;
            }
            
            /* عنصر الإشعار */
            .notification-item {
                background-color: #242424;
                border-radius: 15px;
                margin-bottom: 15px;
                padding: 15px;
                display: flex;
                gap: 15px;
                position: relative;
                transition: all 0.3s ease;
                border: 1px solid rgba(255, 215, 0, 0.1);
            }
            
            .notification-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                border-color: rgba(255, 215, 0, 0.3);
                cursor: pointer;
            }
            
            .notification-item.unread {
                border-right: 4px solid #FFD700;
                background-color: rgba(255, 215, 0, 0.05);
            }
            
            .notification-icon {
                flex-shrink: 0;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                overflow: hidden;
                border: 2px solid #FFD700;
                background-color: #333;
            }
            
            .notification-icon img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .notification-content {
                flex: 1;
            }
            
            .notification-title {
                font-weight: bold;
                color: #FFD700;
                margin-bottom: 5px;
                font-size: 1.1rem;
            }
            
            .notification-message {
                color: #ddd;
                font-size: 0.9rem;
                margin-bottom: 10px;
            }
            
            .notification-time {
                color: #999;
                font-size: 0.8rem;
            }
            
            .notification-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
            }
            
            .notification-action-btn {
                background-color: #333;
                color: #FFD700;
                border: 1px solid #FFD700;
                border-radius: 5px;
                padding: 5px 10px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .notification-action-btn:hover {
                background-color: #FFD700;
                color: #000;
            }
            
            /* إشعار Toast */
            .notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #1a1a1a;
                border: 2px solid #FFD700;
                border-radius: 10px;
                padding: 15px;
                display: flex;
                align-items: center;
                gap: 15px;
                z-index: 9999;
                min-width: 300px;
                max-width: 400px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                animation: fadeInRight 0.5s;
            }
            
            @keyframes fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
            
            .notification-toast.fadeOut {
                animation: fadeOutRight 0.5s forwards;
            }
            
            .notification-toast .notification-close {
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                color: #999;
                font-size: 1rem;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // إعداد زر الإشعارات في الشريط العلوي
    setupNotificationButton() {
        // البحث عن زر الإشعارات في الشريط العلوي
        let notificationBtn = document.querySelector('a.nav-link i.fa-bell, a.nav-link i.fa-bell-o').parentElement;
        
        // إذا لم يوجد زر، ننشئ واحداً
        if (!notificationBtn) {
            // ننشئ زر الإشعارات في الشريط العلوي
            notificationBtn = document.createElement('a');
            notificationBtn.className = 'nav-link position-relative';
            notificationBtn.innerHTML = '<i class="fas fa-bell"></i>';
            
            // نضيف الزر إلى قائمة الأدوات
            const tools = document.querySelector('.tools');
            if (tools) {
                tools.appendChild(notificationBtn);
            }
        }
        
        // إضافة سمة data-bs-toggle وdata-bs-target
        notificationBtn.setAttribute('data-bs-toggle', 'modal');
        notificationBtn.setAttribute('data-bs-target', '#notificationsModal');
        notificationBtn.setAttribute('id', 'notificationsBtn');
        
        // إضافة شارة عدد الإشعارات غير المقروءة
        const badge = document.createElement('span');
        badge.className = 'notifications-badge';
        badge.id = 'notificationsBadge';
        badge.style.display = 'none';
        badge.textContent = '0';
        notificationBtn.appendChild(badge);
    }
    
    // إعداد نافذة الإشعارات المنبثقة
    setupNotificationModal() {
        // التحقق من وجود النافذة
        let modal = document.getElementById('notificationsModal');
        
        // إذا لم توجد النافذة، ننشئ واحدة
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'notificationsModal';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'notificationsModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="notificationsModalLabel">الإشعارات</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="notificationsContainer" class="notifications-container">
                                <div class="text-center p-5">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">جاري التحميل...</span>
                                    </div>
                                    <p class="mt-3">جاري تحميل الإشعارات...</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" id="markAllReadBtn">
                                <i class="fas fa-check-double"></i> تعليم الكل كمقروء
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // إضافة مستمع لحدث عرض النافذة
            modal.addEventListener('show.bs.modal', () => {
                this.loadNotifications();
            });
            
            // إضافة مستمع لزر تعليم الكل كمقروء
            const markAllReadBtn = document.getElementById('markAllReadBtn');
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', () => {
                    this.markAllAsRead();
                });
            }
        }
    }
    
    // طلب إذن الإشعارات
    requestNotificationPermission() {
        if ('Notification' in window) {
            // إذا كان الإذن غير محدد بعد
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                // نعرض نافذة تأكيد قبل طلب الإذن
                Swal.fire({
                    title: 'تفعيل الإشعارات',
                    text: 'هل ترغب في تلقي إشعارات عند إضافة سائق جديد في منطقتك؟',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، أرغب',
                    cancelButtonText: 'لا، شكراً',
                    confirmButtonColor: '#FFD700',
                    cancelButtonColor: '#d33'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                this.showToast('تم تفعيل الإشعارات بنجاح');
                            }
                        });
                    }
                });
            }
        }
    }
    
    // تحميل موقع المستخدم
    loadUserLocation() {
        // محاولة استرداد الموقع من التخزين المحلي
        const savedLocation = localStorage.getItem('userLocation');
        if (savedLocation) {
            try {
                this.userLocation = JSON.parse(savedLocation);
            } catch (e) {
                this.userLocation = savedLocation;
            }
        }
        
        // محاولة الحصول على الموقع الحالي
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                
                // استخدام Nominatim للحصول على اسم الموقع
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=ar`)
                    .then(response => response.json())
                    .then(data => {
                        let location = null;
                        
                        // استخراج المدينة أو المحافظة
                        if (data.address) {
                            location = data.address.city || 
                                       data.address.town || 
                                       data.address.county || 
                                       data.address.state;
                        }
                        
                        if (location) {
                            this.userLocation = location;
                            localStorage.setItem('userLocation', JSON.stringify(location));
                            
                            // تحديث موقع المستخدم في قاعدة البيانات
                            this.updateUserLocation(location);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching location name:', error);
                    });
            }, error => {
                console.warn('Geolocation error:', error);
            });
        }
    }
    
    // تحديث موقع المستخدم في قاعدة البيانات
    updateUserLocation(location) {
        this.database.ref(`users/${this.userId}/location`).set(location);
    }
    
    // الاستماع إلى إضافة سائقين جدد
    listenToNewDrivers() {
        this.database.ref('drivers').on('child_added', snapshot => {
            const driver = snapshot.val();
            const driverId = snapshot.key;
            
            // التحقق مما إذا كان السائق تمت إضافته حديثاً (في آخر 5 دقائق)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            if (driver.registrationDate && driver.registrationDate > fiveMinutesAgo) {
                // التحقق مما إذا كان السائق في نفس منطقة المستخدم
                if (this.isDriverInUserLocation(driver.location)) {
                    // إنشاء إشعار جديد
                    this.createNewDriverNotification(driver, driverId);
                }
            }
        });
    }
    
    // التحقق مما إذا كان السائق في نفس منطقة المستخدم
    isDriverInUserLocation(driverLocation) {
        // إذا لم يكن لدينا معلومات عن موقع المستخدم، نفترض أنه في نفس المنطقة
        if (!this.userLocation) return true;
        
        // تحويل المواقع إلى نصوص للمقارنة
        const userLocationStr = typeof this.userLocation === 'string' ? 
            this.userLocation.toLowerCase() : JSON.stringify(this.userLocation).toLowerCase();
        const driverLocationStr = driverLocation.toLowerCase();
        
        // التحقق من وجود تطابق في الاسم
        return userLocationStr.includes(driverLocationStr) || 
               driverLocationStr.includes(userLocationStr);
    }
    
    // إنشاء إشعار للسائق الجديد
    createNewDriverNotification(driver, driverId) {
        const notification = {
            type: 'new_driver',
            title: 'سائق جديد في منطقتك',
            message: `انضم السائق ${driver.name} إلى منطقة ${driver.location}`,
            icon: driver.imageUrl || 'default-driver.png',
            driverId: driverId,
            timestamp: Date.now(),
            read: false
        };
        
        // حفظ الإشعار في قاعدة البيانات
        this.addNotificationToDatabase(notification);
        
        // عرض الإشعار
        this.showNotification(notification);
    }
    
    // إضافة الإشعار إلى قاعدة البيانات
    addNotificationToDatabase(notification) {
        this.database.ref(`users/${this.userId}/notifications`).push(notification);
    }
    
    // الاستماع إلى إشعارات المستخدم
    listenToUserNotifications() {
        this.database.ref(`users/${this.userId}/notifications`).on('child_added', snapshot => {
            const notification = snapshot.val();
            const notificationId = snapshot.key;
            
            if (!notification.read) {
                this.unreadCount++;
                this.updateNotificationBadge();
            }
            
            // إضافة الإشعار إلى قائمة الإشعارات
            this.notifications.push({
                id: notificationId,
                ...notification
            });
        });
        
        // الاستماع إلى تحديثات الإشعارات (مثل تعليمها كمقروءة)
        this.database.ref(`users/${this.userId}/notifications`).on('child_changed', snapshot => {
            const updatedNotification = snapshot.val();
            const notificationId = snapshot.key;
            
            // تحديث الإشعار في القائمة
            const index = this.notifications.findIndex(n => n.id === notificationId);
            if (index !== -1) {
                const oldNotification = this.notifications[index];
                
                // إذا تم تعليم الإشعار كمقروء، نقلل عدد الإشعارات غير المقروءة
                if (!oldNotification.read && updatedNotification.read) {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateNotificationBadge();
                }
                
                // تحديث الإشعار في القائمة
                this.notifications[index] = {
                    id: notificationId,
                    ...updatedNotification
                };
            }
        });
        
        // الاستماع إلى حذف الإشعارات
        this.database.ref(`users/${this.userId}/notifications`).on('child_removed', snapshot => {
            const notificationId = snapshot.key;
            const removedNotification = snapshot.val();
            
            // حذف الإشعار من القائمة
            const index = this.notifications.findIndex(n => n.id === notificationId);
            if (index !== -1) {
                const oldNotification = this.notifications[index];
                
                // إذا كان الإشعار غير مقروء، نقلل عدد الإشعارات غير المقروءة
                if (!oldNotification.read) {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateNotificationBadge();
                }
                
                // حذف الإشعار من القائمة
                this.notifications.splice(index, 1);
            }
        });
    }
    
    // عرض الإشعار
    showNotification(notification) {
        // عرض إشعار Toast
        this.showToast(notification);
        
        // عرض إشعار نظام إذا كان مدعوماً
        if ('Notification' in window && Notification.permission === 'granted') {
            this.showSystemNotification(notification);
        }
        
        // تشغيل صوت الإشعار
        this.playNotificationSound();
    }
    
    // عرض إشعار Toast
    showToast(notification) {
        // إذا كان الوسيط نصاً، نحوله إلى كائن
        if (typeof notification === 'string') {
            notification = {
                type: 'info',
                title: 'إشعار',
                message: notification,
                icon: null,
                timestamp: Date.now()
            };
        }
        
        // إنشاء عنصر Toast
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        
        // تحديد المحتوى
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
                ${notification.timestamp ? 
                    `<div class="notification-time">${this.formatTime(notification.timestamp)}</div>` : ''
                }
                ${notification.driverId ? 
                    `<div class="notification-actions">
                        <button class="notification-action-btn" onclick="event.stopPropagation(); viewDriverLocation('${notification.driverId}')">
                            <i class="fas fa-map-marker-alt"></i> عرض الموقع
                        </button>
                    </div>` : ''
                }
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
    
    // عرض إشعار النظام
    showSystemNotification(notification) {
        const options = {
            body: notification.message,
            icon: notification.icon || 'default-driver.png',
            tag: notification.id || Date.now().toString(),
            requireInteraction: false, // هل يبقى الإشعار حتى ينقر عليه المستخدم
            data: {
                url: window.location.href,
                driverId: notification.driverId
            }
        };
        
        const systemNotification = new Notification(notification.title, options);
        
        // معالجة النقر على الإشعار
        systemNotification.onclick = function() {
            window.focus(); // تركيز النافذة
            
            // إذا كان هناك معرف للسائق، عرض موقعه
            if (notification.driverId && typeof viewDriverLocation === 'function') {
                viewDriverLocation(notification.driverId);
            }
            
            systemNotification.close();
        };
        
        // إغلاق الإشعار تلقائيًا بعد 10 ثوانٍ
        setTimeout(() => {
            systemNotification.close();
        }, 10000);
    }
    
    // تشغيل صوت الإشعار
    playNotificationSound() {
        if (this.notificationSound) {
            // إعادة الصوت إلى البداية
            this.notificationSound.currentTime = 0;
            
            // تشغيل الصوت
            this.notificationSound.play().catch(error => {
                console.warn('Error playing notification sound:', error);
            });
        }
    }
    
    // تحديث شارة عدد الإشعارات غير المقروءة
    updateNotificationBadge() {
        const badge = document.getElementById('notificationsBadge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    }
    
    // تحميل الإشعارات وعرضها
    loadNotifications() {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        // عرض حالة التحميل
        container.innerHTML = `
            <div class="text-center p-5 loading-notifications">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">جاري التحميل...</span>
                </div>
                <p class="mt-3">جاري تحميل الإشعارات...</p>
            </div>
        `;
        
        // الحصول على آخر 20 إشعار مرتبة حسب الوقت
        this.database.ref(`users/${this.userId}/notifications`)
            .orderByChild('timestamp')
            .limitToLast(20)
            .once('value')
            .then(snapshot => {
                const notifications = [];
                snapshot.forEach(childSnapshot => {
                    notifications.unshift({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                
                // عرض الإشعارات
                this.renderNotifications(notifications);
            })
            .catch(error => {
                console.error('Error loading notifications:', error);
                container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                        <p class="mt-3">حدث خطأ أثناء تحميل الإشعارات</p>
                    </div>
                `;
            });
    }
    
    // عرض الإشعارات في الواجهة
    renderNotifications(notifications) {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        // إذا لم تكن هناك إشعارات
        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-bell-slash" style="font-size: 3rem; color: #999;"></i>
                    <p class="mt-3">لا توجد إشعارات</p>
                </div>
            `;
            return;
        }
        
        // إفراغ الحاوية
        container.innerHTML = '';
        
        // إضافة الإشعارات
        notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
            notificationItem.setAttribute('data-id', notification.id);
            
            // تحضير زر الإجراء
            let actionButton = '';
            if (notification.type === 'new_driver' && notification.driverId) {
                actionButton = `
                    <div class="notification-actions">
                        <button class="notification-action-btn" onclick="event.stopPropagation(); viewDriverLocation('${notification.driverId}')">
                            <i class="fas fa-map-marker-alt"></i> عرض موقع السائق
                        </button>
                        <button class="notification-action-btn" onclick="event.stopPropagation(); notificationsManager.markAsRead('${notification.id}')">
                            <i class="fas fa-check"></i> تعليم كمقروء
                        </button>
                    </div>
                `;
            }
            
            // تعيين المحتوى
            notificationItem.innerHTML = `
                <div class="notification-icon">
                    ${notification.icon ? 
                        `<img src="${notification.icon}" alt="صورة الإشعار" onerror="this.src='default-driver.png'">` : 
                        `<i class="fas fa-bell" style="font-size: 24px; color: #FFD700;"></i>`
                    }
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title || 'إشعار'}</div>
                  <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
                    ${actionButton}
                </div>
            `;
            
            // إضافة مستمع حدث للنقر لتعليم الإشعار كمقروء
            notificationItem.addEventListener('click', () => {
                this.markAsRead(notification.id);
            });
            
            // إضافة الإشعار إلى الحاوية
            container.appendChild(notificationItem);
        });
    }
    
    // تعليم إشعار كمقروء
    markAsRead(notificationId) {
        this.database.ref(`users/${this.userId}/notifications/${notificationId}`)
            .update({ read: true })
            .then(() => {
                // تحديث عنصر الإشعار في الواجهة
                const notificationElement = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
                if (notificationElement) {
                    notificationElement.classList.remove('unread');
                }
                
                // تحديث عدد الإشعارات غير المقروءة
                const index = this.notifications.findIndex(n => n.id === notificationId);
                if (index !== -1 && !this.notifications[index].read) {
                    this.notifications[index].read = true;
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateNotificationBadge();
                }
            })
            .catch(error => {
                console.error('Error marking notification as read:', error);
                this.showToast('حدث خطأ أثناء تعليم الإشعار كمقروء');
            });
    }
    
    // تعليم جميع الإشعارات كمقروءة
    markAllAsRead() {
        // جمع معرفات الإشعارات غير المقروءة
        const unreadIds = this.notifications
            .filter(n => !n.read)
            .map(n => n.id);
        
        if (unreadIds.length === 0) {
            this.showToast('لا توجد إشعارات غير مقروءة');
            return;
        }
        
        // تحضير التحديثات
        const updates = {};
        unreadIds.forEach(id => {
            updates[`users/${this.userId}/notifications/${id}/read`] = true;
        });
        
        // تنفيذ التحديثات
        this.database.ref().update(updates)
            .then(() => {
                // تحديث الواجهة
                document.querySelectorAll('.notification-item.unread').forEach(element => {
                    element.classList.remove('unread');
                });
                
                // تحديث النموذج المحلي
                this.notifications.forEach(n => {
                    if (!n.read) n.read = true;
                });
                
                // تحديث العداد
                this.unreadCount = 0;
                this.updateNotificationBadge();
                
                this.showToast('تم تعليم جميع الإشعارات كمقروءة');
            })
            .catch(error => {
                console.error('Error marking all notifications as read:', error);
                this.showToast('حدث خطأ أثناء تعليم الإشعارات كمقروءة');
            });
    }
    
    // تنسيق الوقت بشكل نسبي
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        // أقل من دقيقة
        if (diff < 60 * 1000) {
            return 'الآن';
        }
        
        // أقل من ساعة
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
        }
        
        // أقل من يوم
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
        }
        
        // أقل من أسبوع
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
        }
        
        // تاريخ كامل
        const date = new Date(timestamp);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// إنشاء كائن نظام الإشعارات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // التأكد من أنه تم تحميل Firebase
    if (typeof firebase !== 'undefined') {
        window.notificationsManager = new NotificationsManager();
    } else {
        console.error('Firebase not loaded yet. Notifications system cannot be initialized.');
    }
});