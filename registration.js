// دالة التحقق من صحة كلمة المرور
function validatePassword(password) {
    // يجب أن تكون كلمة المرور 6 أحرف على الأقل وتحتوي على حرف وأرقام
    const minLength = 6;
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    
    return password.length >= minLength && hasNumber && hasLetter;
}

// دالة التحقق من تطابق كلمتي المرور
function validatePasswordMatch(password, confirmPassword) {
    return password === confirmPassword;
}

// دالة التحقق من صحة البريد الإلكتروني
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// دالة التحقق من رقم الهاتف
function validatePhone(phone) {
    // يمكن تعديل هذا النمط حسب تنسيق أرقام الهواتف في العراق
    const phoneRegex = /^07[3-9]\d{8}$/;
    return phoneRegex.test(phone);
}

// دالة معالجة تسجيل المستخدم
async function handleUserRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const form = event.target;
        const formData = new FormData(form);

        // التحقق من البيانات
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const phone = formData.get('phone');
        const terms = formData.get('terms');

        // التحقق من الموافقة على الشروط والأحكام
        if (!terms) {
            throw new Error('يجب الموافقة على الشروط والأحكام');
        }

        // التحقق من صحة البريد الإلكتروني
        if (!validateEmail(email)) {
            throw new Error('البريد الإلكتروني غير صالح');
        }

        // التحقق من صحة كلمة المرور
        if (!validatePassword(password)) {
            throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل وتحتوي على حرف وأرقام');
        }

        // التحقق من تطابق كلمتي المرور
        if (!validatePasswordMatch(password, confirmPassword)) {
            throw new Error('كلمتا المرور غير متطابقتين');
        }

        // التحقق من صحة رقم الهاتف
        if (!validatePhone(phone)) {
            throw new Error('رقم الهاتف غير صالح');
        }

        // إنشاء حساب جديد في Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // تحديث الملف الشخصي للمستخدم
        await user.updateProfile({
            displayName: formData.get('fullName')
        });

        // معالجة الصورة الشخصية
        let photoUrl = null;
        const photoFile = document.getElementById('userPhoto').files[0];
        if (photoFile) {
            const imageRef = storage.ref(`users/${user.uid}/profile/${Date.now()}_${photoFile.name}`);
            const uploadTask = await imageRef.put(photoFile);
            photoUrl = await uploadTask.ref.getDownloadURL();
            
            await user.updateProfile({
                photoURL: photoUrl
            });
        }

        // إعداد بيانات المستخدم للتخزين في Realtime Database
        const userData = {
            uid: user.uid,
            fullName: formData.get('fullName'),
            email: email,
            phone: phone,
            province: formData.get('province'),
            area: formData.get('area'),
            address: formData.get('address'),
            photoUrl: photoUrl,
            userType: 'user',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        };

        // حفظ البيانات في Realtime Database
        await database.ref(`users/${user.uid}`).set(userData);

        // إغلاق النافذة المنبثقة
        const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
        modal.hide();

        // عرض رسالة النجاح
        Swal.fire({
            title: 'تم التسجيل بنجاح!',
            text: 'مرحباً بك في تطبيق تاكسي العراق',
            icon: 'success',
            confirmButtonColor: '#FFD700',
            confirmButtonText: 'تم'
        });

        // تحديث واجهة المستخدم
        updateUIAfterLogin(userData);

    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = error.message;
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'كلمة المرور ضعيفة جداً';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'تسجيل المستخدمين معطل حالياً';
                    break;
            }
        }

        Swal.fire({
            title: 'خطأ!',
            text: errorMessage,
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: 'حسناً'
        });
    } finally {
        hideLoading();
    }
}

// إضافة مستمعي الأحداث عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('userRegistrationForm');
    if (form) {
        // إضافة مستمع لتقديم النموذج
        form.addEventListener('submit', handleUserRegistration);

        // إضافة مستمعي التحقق المباشر للحقول
        const passwordInput = form.querySelector('input[name="password"]');
        const confirmPasswordInput = form.querySelector('input[name="confirmPassword"]');
        const emailInput = form.querySelector('input[name="email"]');
        const phoneInput = form.querySelector('input[name="phone"]');

        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                const isValid = validatePassword(this.value);
                this.setCustomValidity(isValid ? '' : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل وتحتوي على حرف وأرقام');
            });
        }

        if (confirmPasswordInput && passwordInput) {
            confirmPasswordInput.addEventListener('input', function() {
                const isValid = validatePasswordMatch(passwordInput.value, this.value);
                this.setCustomValidity(isValid ? '' : 'كلمتا المرور غير متطابقتين');
            });
        }

        if (emailInput) {
            emailInput.addEventListener('input', function() {
                const isValid = validateEmail(this.value);
                this.setCustomValidity(isValid ? '' : 'البريد الإلكتروني غير صالح');
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                const isValid = validatePhone(this.value);
                this.setCustomValidity(isValid ? '' : 'رقم الهاتف غير صالح');
            });
        }
    }
});