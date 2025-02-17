// نظام إدارة الأخطاء
class ErrorManager {
    constructor() {
        this.errorTypes = {
            AUTH: 'auth',
            VALIDATION: 'validation',
            NETWORK: 'network',
            SERVER: 'server',
            PERMISSION: 'permission',
            GENERAL: 'general'
        };

        this.errorMessages = {
            // أخطاء المصادقة
            'auth/email-invalid': 'البريد الإلكتروني غير صحيح',
            'auth/password-invalid': 'كلمة المرور غير صحيحة',
            'auth/user-not-found': 'لم يتم العثور على المستخدم',
            'auth/wrong-password': 'كلمة المرور غير صحيحة',
            
            // أخطاء التحقق
            'validation/required-field': 'هذا الحقل مطلوب',
            'validation/invalid-phone': 'رقم الهاتف غير صحيح',
            'validation/invalid-email': 'البريد الإلكتروني غير صحيح',
            
            // أخطاء الشبكة
            'network/no-connection': 'لا يوجد اتصال بالإنترنت',
            'network/timeout': 'انتهت مهلة الاتصال',
            
            // أخطاء الخادم
            'server/internal-error': 'حدث خطأ في الخادم',
            'server/not-available': 'الخدمة غير متوفرة حالياً',
            
            // أخطاء الصلاحيات
            'permission/location-denied': 'تم رفض الوصول إلى الموقع',
            'permission/camera-denied': 'تم رفض الوصول إلى الكاميرا',
            
            // أخطاء عامة
            'general/unknown': 'حدث خطأ غير متوقع'
        };
    }

    // عرض رسالة خطأ
    showError(errorCode, customMessage = null) {
        const message = customMessage || this.errorMessages[errorCode] || 'حدث خطأ غير متوقع';
        const type = this.getErrorType(errorCode);
        
        // إنشاء عنصر رسالة الخطأ
        const errorElement = document.createElement('div');
        errorElement.className = `error-message ${type}-error animate__animated animate__fadeIn`;
        errorElement.innerHTML = `
            <i class="fas ${this.getErrorIcon(type)}"></i>
            <span>${message}</span>
            <button class="error-close" onclick="this.parentElement.remove()">×</button>
        `;

        // إضافة الرسالة للصفحة
        document.body.appendChild(errorElement);

        // حذف الرسالة تلقائياً بعد 5 ثواني
        setTimeout(() => {
            errorElement.classList.replace('animate__fadeIn', 'animate__fadeOut');
            setTimeout(() => errorElement.remove(), 500);
        }, 5000);

        // إذا كان الخطأ من نوع المصادقة، عرض نافذة منبثقة
        if (type === 'auth') {
            this.showAuthError(message);
        }

        // تسجيل الخطأ في وحدة التحكم للتتبع
        console.error(`[${type.toUpperCase()}] ${errorCode}: ${message}`);
    }

    // عرض خطأ المصادقة
    showAuthError(message) {
        Swal.fire({
            title: 'خطأ في تسجيل الدخول',
            html: message,
            icon: 'error',
            confirmButtonText: 'حسناً',
            customClass: {
                popup: 'dark-popup',
                title: 'text-white',
                htmlContainer: 'text-white',
                confirmButton: 'swal-button-custom'
            }
        });
    }

    // تحديد نوع الخطأ من الكود
    getErrorType(errorCode) {
        const prefix = errorCode.split('/')[0];
        return this.errorTypes[prefix.toUpperCase()] || this.errorTypes.GENERAL;
    }

    // الحصول على أيقونة الخطأ المناسبة
    getErrorIcon(type) {
        const icons = {
            auth: 'fa-user-lock',
            validation: 'fa-exclamation-triangle',
            network: 'fa-wifi',
            server: 'fa-server',
            permission: 'fa-ban',
            general: 'fa-exclamation-circle'
        };
        return icons[type] || icons.general;
    }

    // التحقق من صحة حقل
    validateField(field, rules) {
        const value = field.value.trim();
        const errors = [];

        rules.forEach(rule => {
            switch (rule) {
                case 'required':
                    if (!value) {
                        errors.push('validation/required-field');
                    }
                    break;
                case 'email':
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        errors.push('validation/invalid-email');
                    }
                    break;
                case 'phone':
                    if (!/^[\d\+][\d\-\(\)]{8,}$/.test(value)) {
                        errors.push('validation/invalid-phone');
                    }
                    break;
            }
        });

        if (errors.length > 0) {
            field.classList.add('is-invalid');
            this.showError(errors[0]);
            return false;
        }

        field.classList.remove('is-invalid');
        return true;
    }

    // معالجة أخطاء الشبكة
    handleNetworkError(error) {
        if (!navigator.onLine) {
            this.showError('network/no-connection');
        } else if (error.name === 'TimeoutError') {
            this.showError('network/timeout');
        } else {
            this.showError('network/general', error.message);
        }
    }

    // معالجة أخطاء Firebase
    handleFirebaseError(error) {
        const errorCode = error.code || 'general/unknown';
        this.showError(errorCode, error.message);
    }
}

// إنشاء نسخة عامة من مدير الأخطاء
const errorManager = new ErrorManager();

// أمثلة على الاستخدام:

// التحقق من صحة حقل البريد الإلكتروني
document.querySelector('input[type="email"]')?.addEventListener('blur', function() {
    errorManager.validateField(this, ['required', 'email']);
});

// معالجة خطأ تسجيل الدخول
async function handleLogin(event) {
    event.preventDefault();
    try {
        // محاولة تسجيل الدخول
        // ...
    } catch (error) {
        errorManager.handleFirebaseError(error);
    }
}

// معالجة أخطاء الشبكة
window.addEventListener('online', () => {
    errorManager.showError('network/connected', 'تم استعادة الاتصال بالإنترنت');
});

window.addEventListener('offline', () => {
    errorManager.showError('network/no-connection');
});