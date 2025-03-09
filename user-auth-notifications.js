// User Authentication and Notifications System
class UserAuthSystem {
    constructor() {
        this.database = firebase.database();
        this.storage = firebase.storage();
        this.currentUser = null;
        this.messageCounter = 0;
        this.notificationCounter = 0;
        this.initializeAuth();
    }

    // تهيئة النظام
    async initializeAuth() {
        // التحقق من وجود مستخدم مسجل في localStorage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUIForLoggedInUser();
            this.startNotificationListeners();
        }

        // إضافة مستمعي الأحداث للأزرار
        this.addEventListeners();
    }

    // إضافة مستمعي الأحداث
    addEventListeners() {
        // مستمع تسجيل المستخدم
        const userRegistrationForm = document.getElementById('userRegistrationForm');
        if (userRegistrationForm) {
            userRegistrationForm.addEventListener('submit', (e) => this.handleUserRegistration(e));
        }

        // مستمع تسجيل السائق
        const driverRegistrationForm = document.getElementById('driverRegistrationForm');
        if (driverRegistrationForm) {
            driverRegistrationForm.addEventListener('submit', (e) => this.handleDriverRegistration(e));
        }

        // زر تسجيل الخروج
        const logoutButton = document.createElement('button');
        logoutButton.className = 'nav-link';
       
        logoutButton.onclick = () => this.handleLogout();
        
        // إضافة زر تسجيل الخروج إلى القائمة
        const toolsContainer = document.querySelector('.tools');
        if (toolsContainer) {
            toolsContainer.appendChild(logoutButton);
        }
    }

    // معالجة تسجيل المستخدم
    async handleUserRegistration(event) {
        event.preventDefault();
        try {
            const formData = new FormData(event.target);
            const userData = {
                fullName: formData.get('fullName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                userType: 'user',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // رفع الصورة الشخصية
            const photoFile = document.getElementById('userPhoto').files[0];
            if (photoFile) {
                const photoUrl = await this.uploadUserPhoto(photoFile);
                userData.photoUrl = photoUrl;
            }

            // حفظ بيانات المستخدم
            const newUserRef = await this.database.ref('users').push(userData);
            userData.id = newUserRef.key;

            // تحديث حالة المستخدم الحالي
            this.currentUser = userData;
            localStorage.setItem('currentUser', JSON.stringify(userData));

            // تحديث واجهة المستخدم
            this.updateUIForLoggedInUser();

            // إغلاق نافذة التسجيل
            const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
            if (modal) modal.hide();

            showToast('تم التسجيل بنجاح!', 'success');
        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message, 'error');
        }
    }

    // معالجة تسجيل السائق
    async handleDriverRegistration(event) {
        event.preventDefault();
        try {
            const formData = new FormData(event.target);
            const driverData = {
                fullName: formData.get('fullName'),
                phone: formData.get('phone'),
                userType: 'driver',
                carType: formData.get('vehicleType'),
                carModel: formData.get('vehicleModel'),
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // رفع الصورة الشخصية
            const photoFile = document.getElementById('driverPhoto').files[0];
            if (photoFile) {
                const photoUrl = await this.uploadUserPhoto(photoFile);
                driverData.photoUrl = photoUrl;
            }

            // حفظ بيانات السائق
            const newDriverRef = await this.database.ref('drivers').push(driverData);
            driverData.id = newDriverRef.key;

            // تحديث حالة المستخدم الحالي
            this.currentUser = driverData;
            localStorage.setItem('currentUser', JSON.stringify(driverData));

            // تحديث واجهة المستخدم
            this.updateUIForLoggedInUser();

            // إغلاق نافذة التسجيل
            const modal = bootstrap.Modal.getInstance(document.getElementById('driverRegistrationModal'));
            if (modal) modal.hide();

            showToast('تم التسجيل بنجاح!', 'success');
        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message, 'error');
        }
    }

    // رفع الصورة الشخصية
    async uploadUserPhoto(file) {
        const fileRef = this.storage.ref(`user-photos/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        return await fileRef.getDownloadURL();
    }

    // تحديث واجهة المستخدم بعد تسجيل الدخول
    updateUIForLoggedInUser() {
        if (!this.currentUser) return;

        // تحديث أيقونة المستخدم في الشريط العلوي
        const profileButton = document.querySelector('.user-profile-btn');
        if (profileButton) {
            profileButton.innerHTML = `
                <img src="${this.currentUser.photoUrl || 'default-avatar.png'}" 
                     alt="صورة المستخدم" 
                     class="rounded-circle" 
                     style="width: 30px; height: 30px; object-fit: cover;">
            `;
        }

        // تحديث معلومات المستخدم في الشريط الجانبي
        const sideNavHeader = document.querySelector('.side-nav-header');
        if (sideNavHeader) {
            sideNavHeader.innerHTML = `
                <div class="user-info">
                    <img src="${this.currentUser.photoUrl || 'default-avatar.png'}" 
                         alt="صورة المستخدم" 
                         class="rounded-circle mb-2" 
                         style="width: 60px; height: 60px; object-fit: cover;">
                    <h6 class="mb-0">${this.currentUser.fullName}</h6>
                    <small class="text-muted">${this.currentUser.userType === 'driver' ? 'سائق' : 'مستخدم'}</small>
                </div>
            `;
        }

        // بدء مراقبة الإشعارات والرسائل إذا كان المستخدم سائقاً
        if (this.currentUser.userType === 'driver') {
            this.startNotificationListeners();
        }
    }

    // بدء مراقبة الإشعارات والرسائل
    startNotificationListeners() {
        if (!this.currentUser || this.currentUser.userType !== 'driver') return;

        // مراقبة الرسائل الجديدة
        this.database.ref(`chats/${this.currentUser.id}`).on('child_added', (snapshot) => {
            this.messageCounter++;
            this.updateMessageBadge();
            this.showMessageNotification(snapshot.val());
        });

        // مراقبة الحجوزات الجديدة
        this.database.ref(`bookings/${this.currentUser.id}`).on('child_added', (snapshot) => {
            this.notificationCounter++;
            this.updateNotificationBadge();
            this.showBookingNotification(snapshot.val());
        });
    }

    // تحديث شارة الرسائل
    updateMessageBadge() {
        const messageBadge = document.querySelector('.message-badge');
        if (messageBadge) {
            messageBadge.textContent = this.messageCounter;
            messageBadge.style.display = this.messageCounter > 0 ? 'block' : 'none';
        }
    }

    // تحديث شارة الإشعارات
    updateNotificationBadge() {
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge) {
            notificationBadge.textContent = this.notificationCounter;
            notificationBadge.style.display = this.notificationCounter > 0 ? 'block' : 'none';
        }
    }

    // عرض إشعار رسالة جديدة
    showMessageNotification(message) {
        const notification = new Notification('رسالة جديدة', {
            body: `رسالة جديدة من ${message.senderName}`,
            icon: message.senderPhoto || 'default-avatar.png'
        });

        notification.onclick = () => {
            window.focus();
            this.openMessagesPanel();
        };
    }

    // عرض إشعار حجز جديد
    showBookingNotification(booking) {
        const notification = new Notification('حجز جديد', {
            body: `طلب حجز جديد من ${booking.userName}`,
            icon: booking.userPhoto || 'default-avatar.png'
        });

        notification.onclick = () => {
            window.focus();
            this.openBookingDetails(booking);
        };
    }

    // فتح لوحة الرسائل
    openMessagesPanel() {
        // تنفيذ كود فتح لوحة الرسائل
        this.messageCounter = 0;
        this.updateMessageBadge();
    }

    // فتح تفاصيل الحجز
    openBookingDetails(booking) {
        // تنفيذ كود فتح تفاصيل الحجز
        this.notificationCounter = 0;
        this.updateNotificationBadge();
    }

    // معالجة تسجيل الخروج
    handleLogout() {
        Swal.fire({
            title: 'تسجيل الخروج',
            text: 'هل أنت متأكد من تسجيل الخروج؟',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم',
            cancelButtonText: 'لا'
        }).then((result) => {
            if (result.isConfirmed) {
                // إزالة بيانات المستخدم
                this.currentUser = null;
                localStorage.removeItem('currentUser');

                // إعادة تعيين العدادات
                this.messageCounter = 0;
                this.notificationCounter = 0;

                // إيقاف مستمعي الإشعارات
                if (this.currentUser?.userType === 'driver') {
                    this.database.ref(`chats/${this.currentUser.id}`).off();
                    this.database.ref(`bookings/${this.currentUser.id}`).off();
                }

                // إعادة تعيين واجهة المستخدم
                this.resetUI();

                showToast('تم تسجيل الخروج بنجاح', 'success');
            }
        });
    }

    // إعادة تعيين واجهة المستخدم
    resetUI() {
        // إعادة أيقونة المستخدم في الشريط العلوي
        const profileButton = document.querySelector('.user-profile-btn');
        if (profileButton) {
            profileButton.innerHTML = '<i class="fas fa-user"></i>';
        }

        // إعادة تعيين معلومات المستخدم في الشريط الجانبي
        const sideNavHeader = document.querySelector('.side-nav-header');
        if (sideNavHeader) {
            sideNavHeader.innerHTML = `
                <h2 class="side-nav-title">تاكسي العراق</h2>
                <button class="side-nav-close" onclick="toggleSideNav()">×</button>
            `;
        }

        // إخفاء الشارات
        const messageBadge = document.querySelector('.message-badge');
        const notificationBadge = document.querySelector('.notification-badge');
        if (messageBadge) messageBadge.style.display = 'none';
        if (notificationBadge) notificationBadge.style.display = 'none';
    }
}

// إنشاء نسخة من النظام وتصديرها
const userAuthSystem = new UserAuthSystem();
export default userAuthSystem;

// تسجيل Service Worker إذا كان متاحًا
document.addEventListener('DOMContentLoaded', function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered with scope:', registration.scope);
                
                // التقاط رسائل من Service Worker
                navigator.serviceWorker.addEventListener('message', event => {
                    const data = event.data;
                    
                    // إذا كانت الرسالة من نوع NOTIFICATION_CLICK
                    if (data.type === 'NOTIFICATION_CLICK') {
                        // إذا كان هناك معرف للسائق، عرض موقعه
                        if (data.driverId && typeof viewDriverLocation === 'function') {
                            viewDriverLocation(data.driverId);
                        }
                    }
                });
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    }
    
    // إضافة المزيد من الوظائف حسب الحاجة
});