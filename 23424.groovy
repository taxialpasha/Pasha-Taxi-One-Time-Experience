// Enhanced notification handling
class NotificationHandler {
    constructor() {
        this.messaging = firebase.messaging();
        this.hasPermission = false;
    }

 async initialize() {
      try {
          // محاولة تسجيل Service Worker
          if ('serviceWorker' in navigator) {
              this.swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                  scope: '/firebase-cloud-messaging-push-scope'
              });
              console.log('Service Worker registered successfully:', this.swRegistration);
          }

          await this.checkNotificationSupport();
          await this.requestPermission();
          await this.setupMessaging();
      } catch (error) {
          console.error('Notification initialization error:', error);
          this.handlePermissionError(error);
      }
  }

    async checkNotificationSupport() {
        if (!('Notification' in window)) {
            throw new Error('This browser does not support notifications');
        }
    }

    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                this.hasPermission = true;
                return true;
            } else if (permission === 'denied') {
                throw new Error('notification_blocked');
            } else {
                throw new Error('notification_dismissed');
            }
        } catch (error) {
            throw error;
        }
    }

   async setupMessaging() {
        if (!this.hasPermission) return;

        try {
            const token = await this.messaging.getToken({
                vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc',
                serviceWorkerRegistration: this.swRegistration
            });

            if (token) {
                console.log('FCM Token:', token);
                await this.saveTokenToDatabase(token);
            }
        } catch (error) {
            console.error('Error getting messaging token:', error);
            throw error;
        }
    }
}

    async saveTokenToDatabase(token) {
        if (!userId) return;
        
        try {
            await database.ref('tokens/' + userId).set({ token: token });
        } catch (error) {
            console.error('Error saving token:', error);
        }
    }

    setupMessageHandler() {
        this.messaging.onMessage((payload) => {
            this.showNotification(payload);
        });
    }

    showNotification(payload) {
        if (!this.hasPermission) return;

        try {
            // Try using the Notification API
            new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: payload.notification.icon || '/default-icon.png',
                badge: '/badge-icon.png',
                tag: payload.data?.notificationId || 'default',
                data: payload.data
            });
        } catch (error) {
            // Fallback to custom toast notification
            this.showCustomToast(payload.notification);
        }
    }

    showCustomToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast animate__animated animate__fadeInRight';
        toast.innerHTML = `
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.body}</p>
            </div>
            <button onclick="this.parentElement.remove()" class="close-btn">&times;</button>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    handlePermissionError(error) {
        let message;
        
        switch(error.message) {
            case 'notification_blocked':
                message = 'التنبيهات محظورة. يرجى تفعيلها من إعدادات المتصفح';
                this.showPermissionInstructions();
                break;
            case 'notification_dismissed':
                message = 'لم يتم منح إذن التنبيهات. يمكنك تفعيلها لاحقاً من الإعدادات';
                break;
            default:
                message = 'حدث خطأ في إعداد التنبيهات';
        }
        
        showToast(message, 'warning');
    }

    showPermissionInstructions() {
        Swal.fire({
            title: 'تفعيل التنبيهات',
            html: `
                <div class="permission-instructions">
                    <p>لتلقي التنبيهات، يرجى اتباع الخطوات التالية:</p>
                    <ol>
                        <li>انقر على أيقونة القفل في شريط العنوان</li>
                        <li>ابحث عن إعدادات "التنبيهات"</li>
                        <li>قم بتغيير الإعداد إلى "السماح"</li>
                    </ol>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'فهمت'
        });
    }
}

// Initialize notifications
const notificationHandler = new NotificationHandler();
notificationHandler.initialize().catch(console.error);