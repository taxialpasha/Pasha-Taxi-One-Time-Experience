// Initialize Firebase Auth
const auth = firebase.auth();

// دالة لعرض مؤشر التحميل
function showLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }
}

// دالة لإخفاء مؤشر التحميل
function hideLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
}

// دالة معالجة تسجيل المستخدم الجديد
async function handleUserRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const fullName = formData.get('fullName');
        const phone = formData.get('phone');
        const province = formData.get('province');
        const area = formData.get('area');
        const address = formData.get('address');
        
        // التحقق من تطابق كلمات المرور
        if (password !== confirmPassword) {
            throw new Error('كلمات المرور غير متطابقة');
        }
        
        // التحقق من الموافقة على الشروط والأحكام
        const terms = formData.get('terms');
        if (!terms) {
            throw new Error('يجب الموافقة على الشروط والأحكام');
        }

        // إنشاء حساب جديد في Firebase Authentication
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // رفع الصورة الشخصية إذا وجدت
        let photoUrl = null;
        const photoFile = document.getElementById('userPhoto').files[0];
        if (photoFile) {
            const imageRef = firebase.storage().ref(`users/${user.uid}/${Date.now()}_${photoFile.name}`);
            const uploadTask = await imageRef.put(photoFile);
            photoUrl = await uploadTask.ref.getDownloadURL();
            
            // تحديث صورة المستخدم في الملف الشخصي
            await user.updateProfile({
                displayName: fullName,
                photoURL: photoUrl
            });
        } else {
            // تحديث اسم المستخدم في الملف الشخصي حتى لو لم تكن هناك صورة
            await user.updateProfile({
                displayName: fullName
            });
        }

        // حفظ البيانات الإضافية في Realtime Database
        const userData = {
            uid: user.uid,
            fullName: fullName,
            email: email,
            phone: phone,
            province: province,
            area: area,
            address: address,
            photoUrl: photoUrl,
            userType: 'user',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP
        };

        await firebase.database().ref(`users/${user.uid}`).set(userData);

        // إرسال بريد تأكيد الحساب
        await user.sendEmailVerification();

        // حفظ بيانات المستخدم في التخزين المحلي
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // تحديث واجهة المستخدم
        updateUIAfterLogin(userData);

        // إغلاق نافذة التسجيل
        const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
        if (modal) {
            modal.hide();
        }

        // إرسال حدث نجاح تسجيل الدخول
        document.dispatchEvent(new CustomEvent('login-success'));

        // عرض رسالة نجاح
        Swal.fire({
            title: 'تم التسجيل بنجاح!',
            html: `
                <div class="user-registration-success">
                    <p>مرحباً بك ${fullName} في تطبيق تاكسي العراق</p>
                    <p class="text-muted">تم إرسال رابط تأكيد إلى بريدك الإلكتروني: ${email}</p>
                </div>
            `,
            icon: 'success',
            confirmButtonColor: '#FFD700',
            confirmButtonText: 'تم'
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'حدث خطأ أثناء التسجيل';
        
        // ترجمة رسائل خطأ Firebase
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
                errorMessage = 'تسجيل المستخدمين غير مفعل حالياً';
                break;
            default:
                errorMessage = error.message;
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

// دالة فحص وتهيئة نموذج تسجيل المستخدم
function initUserRegistrationForm() {
    const userRegistrationForm = document.getElementById('userRegistrationForm');
    if (userRegistrationForm) {
        // إزالة أي مستمعات سابقة لتجنب التكرار
        const newForm = userRegistrationForm.cloneNode(true);
        userRegistrationForm.parentNode.replaceChild(newForm, userRegistrationForm);
        
        // إضافة مستمع الحدث الجديد
        newForm.addEventListener('submit', handleUserRegistration);
        
        // إضافة التحقق من تطابق كلمات المرور
        const passwordInput = newForm.querySelector('input[name="password"]');
        const confirmPasswordInput = newForm.querySelector('input[name="confirmPassword"]');
        
        if (passwordInput && confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', function() {
                if (this.value !== passwordInput.value) {
                    this.setCustomValidity('كلمات المرور غير متطابقة');
                } else {
                    this.setCustomValidity('');
                }
            });
            
            passwordInput.addEventListener('input', function() {
                if (confirmPasswordInput.value && this.value !== confirmPasswordInput.value) {
                    confirmPasswordInput.setCustomValidity('كلمات المرور غير متطابقة');
                } else {
                    confirmPasswordInput.setCustomValidity('');
                }
            });
        }
        
        console.log('تم تهيئة نموذج تسجيل المستخدم');
    }
}

// استدعاء دالة التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    initUserRegistrationForm();
    
    // إعادة تهيئة النموذج عند فتح النافذة المنبثقة
    const userRegistrationModal = document.getElementById('userRegistrationModal');
    if (userRegistrationModal) {
        userRegistrationModal.addEventListener('shown.bs.modal', function() {
            initUserRegistrationForm();
        });
    }
});

// دالة معالجة تسجيل الدخول - تم تعديلها للبحث عن معلومات السائق أيضًا
async function handleLogin(event) {
    event.preventDefault();
    showLoading();
    
    // تعطيل التفاعل مع الصفحة أثناء عملية تسجيل الدخول
    document.body.style.pointerEvents = 'none';

    try {
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');

        // تسجيل الدخول باستخدام Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // البحث عن البيانات في جدول المستخدمين أولاً
        const userDataSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        let userData = userDataSnapshot.val();
        let userType = 'user';
        
        // إذا لم يتم العثور على بيانات المستخدم، نبحث في جدول السائقين
        if (!userData) {
            // البحث في جدول السائقين (حسب UID)
            const driverDataSnapshot = await firebase.database().ref('drivers').orderByChild('uid').equalTo(user.uid).once('value');
            const driversData = driverDataSnapshot.val();
            
            if (driversData) {
                // استخراج بيانات السائق (نأخذ أول سائق يطابق UID)
                const driverId = Object.keys(driversData)[0];
                userData = driversData[driverId];
                userType = 'driver';
            } else {
                throw new Error('لم يتم العثور على بيانات المستخدم');
            }
        }

        // تحسين البيانات المستخرجة
        const enhancedUserData = {
            ...userData,
            uid: user.uid,
            email: user.email,
            fullName: userData.fullName || userData.name || user.displayName,
            photoUrl: userData.imageUrl || userData.photoUrl || user.photoURL,
            userType: userData.role || userData.userType || userType
        };

        // حفظ بيانات المستخدم في التخزين المحلي
        localStorage.setItem('currentUser', JSON.stringify(enhancedUserData));

        // تحديث واجهة المستخدم
        updateUIAfterLogin(enhancedUserData);

        // إغلاق نافذة تسجيل الدخول
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) {
            loginModal.hide();
        }

        showToast('تم تسجيل الدخول بنجاح');

        // تحديث أيقونة الملف الشخصي
        updateProfileIcon(user);

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/user-disabled':
                errorMessage = 'تم تعطيل هذا الحساب';
                break;
        }

        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
        // إعادة تفعيل التفاعل مع الصفحة بعد انتهاء عملية تسجيل الدخول
        document.body.style.pointerEvents = 'auto';
        
        // إضافة تأخير بسيط لضمان إعادة تحميل العناصر بشكل صحيح
        setTimeout(() => {
            // إعادة التحقق من أن الصفحة تعمل بشكل كامل
            document.body.classList.remove('modal-open');
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => {
                backdrop.remove();
            });
        }, 500);
    }
}
        // إعادة تفعيل التفاعل مع الصفحة بعد انتهاء عملية تسجيل الدخول
        document.body.style.pointerEvents = 'auto';
        
        // إضافة تأخير بسيط لضمان إعادة تحميل العناصر بشكل صحيح
        setTimeout(() => {
            // إعادة التحقق من أن الصفحة تعمل بشكل كامل
            document.body.classList.remove('modal-open');
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => {
                backdrop.remove();
            });
        }, 500);
    


// دالة لتحديث حالة توفر السائق
async function toggleDriverAvailability() {
    try {
        const userData = JSON.parse(localStorage.getItem('currentUser'));
        if (!userData || userData.userType !== 'driver') {
            return;
        }

        const newStatus = userData.isAvailable ? 'مشغول' : 'متاح';
        await firebase.database().ref(`drivers/${userData.id}`).update({
            isAvailable: !userData.isAvailable
        });

        // تحديث البيانات المحلية
        userData.isAvailable = !userData.isAvailable;
        localStorage.setItem('currentUser', JSON.stringify(userData));

        // تحديث واجهة المستخدم
        updateUIAfterLogin(userData);

        showToast(`تم تغيير الحالة إلى ${newStatus}`, 'success');
    } catch (error) {
        console.error('Error toggling driver availability:', error);
        showToast('حدث خطأ أثناء تغيير الحالة', 'error');
    }
}
// دالة تحديث واجهة المستخدم بعد تسجيل الدخول - تم تعديلها لتظهر نوع المستخدم (سائق/مستخدم)
function updateUIAfterLogin(userData) {
    // تحديد نوع المستخدم ليظهر في الواجهة
    const userRole = userData.userType === 'driver' ? 'سائق' : 'مستخدم';
    
    // تحديث زر الملف الشخصي في الشريط العلوي
    const profileBtn = document.querySelector('.user-profile-btn');
    if (profileBtn) {
        // استخدام الصورة الشخصية من البيانات
        const userPhoto = userData.photoUrl || userData.imageUrl || 'default-avatar.png';
        const userName = userData.fullName || userData.name || 'المستخدم';
        
        profileBtn.innerHTML = `
            <img src="${userPhoto}" 
                 alt="${userName}" 
                 class="rounded-circle me-2" 
                 style="width: 35px; height: 35px; object-fit: cover;">
            <span class="d-none d-md-inline">${userName}</span>
        `;
        
        // تحديث الروابط والإجراءات
        profileBtn.removeAttribute('data-bs-toggle');
        profileBtn.removeAttribute('data-bs-target');
        profileBtn.setAttribute('onclick', 'showUserMenu(event)');
    }

    // تحديث معلومات المستخدم في الشريط الجانبي
    const sideNavUserInfo = document.querySelector('.side-nav-user-info');
    if (sideNavUserInfo) {
        // استخدام الصورة الشخصية من البيانات
        const userPhoto = userData.photoUrl || userData.imageUrl || 'default-avatar.png';
        const userName = userData.fullName || userData.name || 'المستخدم';
        
        sideNavUserInfo.innerHTML = `
            <div class="text-center">
                <img src="${userPhoto}" 
                     alt="${userName}" 
                     class="rounded-circle mb-3"
                     style="width: 80px; height: 80px; object-fit: cover; border: 3px solid #FFD700;">
                <h6 class="text-white mb-1">${userName}</h6>
                <span class="badge bg-gold mb-2">${userRole}</span>
                <p class="text-white-50 small mb-3">${userData.email}</p>
                <div class="mt-3">
                 
                </div>
                ${userData.userType === 'driver' ? `
               
                ` : ''}
            </div>
        `;
    }
    
    // إظهار أو إخفاء عناصر واجهة خاصة بالسائقين إذا كان المستخدم سائق
    const driverOnlyElements = document.querySelectorAll('.driver-only');
    driverOnlyElements.forEach(element => {
        element.style.display = userData.userType === 'driver' ? 'block' : 'none';
    });
}
// دالة عرض قائمة المستخدم
function showUserMenu(event) {
    event.preventDefault();
    const userData = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!userData) {
        console.error('User data not found.');
        return;
    }
    
    Swal.fire({
        title: `مرحباً ${userData.fullName || userData.name}`,
        html: `
            <div class="text-center mb-3">
                <img src="${userData.photoUrl || userData.photoURL || 'default-avatar.png'}" 
                     alt="صورة المستخدم" 
                     class="rounded-circle mb-3"
                     style="width: 100px; height: 100px; object-fit: cover;">
                <p class="mb-2">${userData.email}</p>
                <p class="text-muted">${userData.phone || ''}</p>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'تعديل الملف الشخصي',
        denyButtonText: 'تسجيل الخروج',
        cancelButtonText: 'إغلاق',
        confirmButtonColor: '#FFD700',
        denyButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
    }).then((result) => {
        if (result.isConfirmed) {
            // نقل المستخدم إلى صفحة تعديل الملف الشخصي
            window.location.href = 'edit-profile.html';
        } else if (result.isDenied) {
            handleLogout();
        }
    });
}

// مراقبة حالة تسجيل الدخول
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // المستخدم مسجل الدخول
        console.log('User is signed in:', user.uid);
        
        // التحقق من وجود بيانات المستخدم في التخزين المحلي أولاً
        const cachedUserData = localStorage.getItem('currentUser');
        
        if (cachedUserData) {
            // استخدام البيانات المخزنة محلياً لتحديث الواجهة
            updateUIAfterLogin(JSON.parse(cachedUserData));
        } else {
            // إذا لم تكن البيانات موجودة، نقوم بجلبها من قاعدة البيانات
            try {
                // البحث عن بيانات المستخدم في جدول المستخدمين أولاً
                const userDataSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
                let userData = userDataSnapshot.val();
                let userType = 'user';
                
                // إذا لم يتم العثور على بيانات المستخدم، نبحث في جدول السائقين
                if (!userData) {
                    // البحث في جدول السائقين (حسب UID)
                    const driverDataSnapshot = await firebase.database().ref('drivers').orderByChild('uid').equalTo(user.uid).once('value');
                    const driversData = driverDataSnapshot.val();
                    
                    if (driversData) {
                        // استخراج بيانات السائق (نأخذ أول سائق يطابق UID)
                        const driverId = Object.keys(driversData)[0];
                        userData = driversData[driverId];
                        userType = 'driver';
                    } else {
                        // إذا لم يتم العثور على البيانات، نستخدم البيانات الأساسية من Firebase Auth
                        userData = {
                            uid: user.uid,
                            fullName: user.displayName || 'المستخدم',
                            email: user.email,
                            photoUrl: user.photoURL
                        };
                    }
                }
                
                // تحسين البيانات المستخرجة
                const enhancedUserData = {
                    ...userData,
                    uid: user.uid,
                    email: user.email || userData.email,
                    fullName: userData.fullName || userData.name || user.displayName || 'المستخدم',
                    photoUrl: userData.photoUrl || userData.imageUrl || user.photoURL,
                    userType: userData.role || userData.userType || userType
                };
                
                // حفظ البيانات في التخزين المحلي
                localStorage.setItem('currentUser', JSON.stringify(enhancedUserData));
                
                // تحديث واجهة المستخدم
                updateUIAfterLogin(enhancedUserData);
            } catch (error) {
                console.error('Error fetching user data:', error);
                // في حالة حدوث خطأ، نقوم بتسجيل الخروج للتأكد من تنظيف الحالة
                handleLogout();
            }
        }
    } else {
        // المستخدم غير مسجل الدخول
        console.log('User is signed out');
        // حذف بيانات المستخدم من التخزين المحلي
        localStorage.removeItem('currentUser');
        // إعادة تعيين واجهة المستخدم
        resetUserInterface();
    }
});

// دالة تسجيل الخروج
async function handleLogout() {
    try {
        showLoading();
        
        // تسجيل الخروج من Firebase Auth
        await firebase.auth().signOut();
        
        // حذف بيانات المستخدم من التخزين المحلي
        localStorage.removeItem('currentUser');
        
        // إعادة تعيين واجهة المستخدم
        resetUserInterface();
        
        showToast('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
    } finally {
        hideLoading();
    }
}

// دالة إعادة تعيين واجهة المستخدم
function resetUserInterface() {
    // إعادة زر الملف الشخصي إلى حالته الأصلية
    const profileBtn = document.querySelector('.user-profile-btn');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <i class="fas fa-user-circle me-2"></i>
            <span class="d-none d-md-inline">تسجيل الدخول</span>
        `;
        
        // إعادة تعيين خصائص الزر ليفتح نافذة تسجيل الدخول
        profileBtn.setAttribute('data-bs-toggle', 'modal');
        profileBtn.setAttribute('data-bs-target', '#loginModal');
        profileBtn.removeAttribute('onclick');
    }
    
    // إعادة تعيين معلومات المستخدم في الشريط الجانبي
    const sideNavUserInfo = document.querySelector('.side-nav-user-info');
    if (sideNavUserInfo) {
        sideNavUserInfo.innerHTML = `
            <div class="text-center">
                <i class="fas fa-user-circle text-white" style="font-size: 4rem;"></i>
                <h6 class="text-white mt-3">مرحباً بك</h6>
                <p class="text-white-50 small">قم بتسجيل الدخول للوصول إلى حسابك</p>
                <div class="mt-3">
                    <button class="btn btn-gold w-100 mb-2" data-bs-toggle="modal" data-bs-target="#loginModal">
                        تسجيل الدخول
                    </button>
                    <button class="btn btn-outline-light w-100 mb-2" data-bs-toggle="modal" data-bs-target="#userRegistrationModal">
                        إنشاء حساب
                    </button>
                    <button class="btn btn-outline-light w-100" data-bs-toggle="modal" data-bs-target="#addDriverModal">
                        إضافة سائق
                    </button>
                </div>
            </div>
        `;
    }
    
    // إخفاء عناصر واجهة خاصة بالسائقين
    const driverOnlyElements = document.querySelectorAll('.driver-only');
    driverOnlyElements.forEach(element => {
        element.style.display = 'none';
    });
}

// تحديث دالة إضافة السائق لتتضمن حالة التحقق
async function handleDriverRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const imageFile = document.getElementById('driverPhoto').files[0];
        if (!imageFile) {
            throw new Error('الرجاء اختيار صورة شخصية');
        }

        // إنشاء معرف فريد للسائق
        const driverId = `DR${Date.now()}`;

        // رفع الصورة الشخصية
        const imageRef = storage.ref(`drivers/${driverId}/profile_photo`);
        const uploadTask = await imageRef.put(imageFile);
        const photoUrl = await uploadTask.ref.getDownloadURL();

        // رفع المستندات
        const documents = {};
        const requiredDocs = {
            idFront: 'هوية-امامي',
            idBack: 'هوية-خلفي',
            licenseFront: 'اجازة-امامي',
            licenseBack: 'اجازة-خلفي'
        };

        for (const [inputId, docName] of Object.entries(requiredDocs)) {
            const file = document.getElementById(inputId).files[0];
            if (!file) {
                throw new Error(`يرجى رفع ${docName}`);
            }
            const docRef = storage.ref(`drivers/${driverId}/documents/${docName}`);
            const docUpload = await docRef.put(file);
            documents[docName] = await docUpload.ref.getDownloadURL();
        }

        // إعداد بيانات السائق
        const driverData = {
            id: driverId,
            fullName: formData.get('fullName'),
            age: parseInt(formData.get('age')),
            phone: formData.get('phone'),
            vehicleType: formData.get('vehicleType'),
            vehicleModel: formData.get('vehicleModel'),
            vehicleNumber: formData.get('vehicleNumber'),
            vehicleColor: formData.get('vehicleColor'),
            province: formData.get('province'),
            area: formData.get('area'),
            address: formData.get('address'),
            photoUrl: photoUrl,
            documents: documents,
            status: 'pending', // حالة التحقق: pending, approved, rejected
            isVerified: false, // سيتم تغييرها إلى true عند الموافقة
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };

        // حفظ البيانات في Firebase
        await database.ref(`drivers/${driverId}`).set(driverData);

        // إغلاق النافذة المنبثقة
        const modal = bootstrap.Modal.getInstance(document.getElementById('driverRegistrationModal'));
        modal.hide();

        // عرض رسالة النجاح
        Swal.fire({
            title: 'تم تقديم الطلب بنجاح!',
            html: `
                <div class="success-message">
                    <p>شكراً لك! تم استلام طلبك بنجاح.</p>
                    <p>رقم الطلب: <strong>${driverId}</strong></p>
                    <p>سيتم مراجعة طلبك والرد عليك قريباً.</p>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#FFD700'
        });

        // إعادة تحميل قائمة السائقين
        loadDrivers();

    } catch (error) {
        console.error('Registration error:', error);
        Swal.fire({
            title: 'خطأ!',
            text: error.message || 'حدث خطأ أثناء التسجيل',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
    } finally {
        hideLoading();
    }
}

// تحديث دالة updateProfileIcon لتتحقق من وجود العناصر في DOM بشكل أفضل
function updateProfileIcon(user) {
    // التحقق من وجود المستخدم أولاً
    if (!user) {
        console.warn('تعذر تحديث أيقونة الملف الشخصي: بيانات المستخدم غير متوفرة');
        return;
    }

    try {
        // تحقق مما إذا كانت عناصر الملف الشخصي موجودة في الصفحة الحالية
        const profileIcon = document.getElementById('profileIcon');
        const profileName = document.getElementById('profileName');
        
        // تحديث الأيقونة إذا كانت موجودة
        if (profileIcon) {
            profileIcon.src = user.photoURL || user.photoUrl || 'default-profile.png';
        }
        
        // تحديث الاسم إذا كان موجوداً
        if (profileName) {
            profileName.textContent = user.displayName || user.fullName || user.name || 'Anonymous';
        }
        
        // تحقق أيضًا من عناصر الصفحة الرئيسية للملف الشخصي
        const userProfileBtn = document.querySelector('.user-profile-btn');
        if (userProfileBtn) {
            // استخدام الصورة الشخصية من البيانات
            const userPhoto = user.photoURL || user.photoUrl || user.imageUrl || 'default-avatar.png';
            const userName = user.displayName || user.fullName || user.name || 'المستخدم';
            
            userProfileBtn.innerHTML = `
                <img src="${userPhoto}" 
                     alt="${userName}" 
                     class="rounded-circle me-2" 
                     style="width: 35px; height: 35px; object-fit: cover;">
                <span class="d-none d-md-inline">${userName}</span>
            `;
        }
    } catch (error) {
        // تسجيل الخطأ ولكن لا توقف البرنامج
        console.warn('خطأ في تحديث أيقونة الملف الشخصي:', error);
    }
}

// تحديث مراقب حالة المصادقة
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('User is signed in:', user.uid);
        updateProfileIcon(user);
        
        // محاولة تحميل بيانات المستخدم من قاعدة البيانات
        loadUserData(user);
    } else {
        console.log('User is signed out');
        resetUserInterface();
    }
});

// دالة إضافية لتحميل بيانات المستخدم من قاعدة البيانات
async function loadUserData(user) {
    try {
        // التحقق من وجود بيانات في التخزين المحلي أولاً
        const cachedUserData = localStorage.getItem('currentUser');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            updateUIAfterLogin(userData);
            return;
        }
        
        // بحث في قاعدة بيانات المستخدمين
        const userSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
            // تحديث بيانات التخزين المحلي والواجهة
            localStorage.setItem('currentUser', JSON.stringify(userData));
            updateUIAfterLogin(userData);
            return;
        }
        
        // بحث في قاعدة بيانات السائقين
        const driverSnapshot = await firebase.database().ref('drivers').orderByChild('uid').equalTo(user.uid).once('value');
        const driversData = driverSnapshot.val();
        
        if (driversData) {
            // استخراج بيانات السائق
            const driverId = Object.keys(driversData)[0];
            const driverData = driversData[driverId];
            
            // تحديث بيانات التخزين المحلي والواجهة
            localStorage.setItem('currentUser', JSON.stringify(driverData));
            updateUIAfterLogin(driverData);
            return;
        }
        
        // إذا لم نجد بيانات، ننشئ بيانات أولية من معلومات المصادقة
        const basicUserData = {
            uid: user.uid,
            email: user.email,
            fullName: user.displayName || 'المستخدم',
            photoUrl: user.photoURL,
            userType: 'user'
        };
        
        localStorage.setItem('currentUser', JSON.stringify(basicUserData));
        updateUIAfterLogin(basicUserData);
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// عرض نافذة تأكيد تسجيل الدخول
function showLoginPrompt(message) {
    Swal.fire({
        title: 'مطلوب تسجيل الدخول',
        text: message,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'تسجيل الدخول',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#FFD700',
        background: '#1a1a1a',
        color: '#FFFFFF'
    }).then((result) => {
        if (result.isConfirmed) {
            // فتح نافذة تسجيل الدخول
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        }
    });
}