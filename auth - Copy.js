// تهيئة خدمات Firebase
const auth = firebase.auth();

// إدارة جلسة المستخدم ------------------
class UserSession {
    constructor() {
        this.currentUser = null;
    }

    // جلب المستخدم الحالي من التخزين المحلي
    loadFromLocalStorage() {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                return true;
            } catch (e) {
                console.error('Error parsing user data from localStorage:', e);
                localStorage.removeItem('currentUser');
            }
        }
        return false;
    }

    // حفظ المستخدم في التخزين المحلي
    saveToLocalStorage(userData) {
        this.currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(userData));
    }

    // مسح بيانات المستخدم
    clear() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    // التحقق إذا كان المستخدم مسجل الدخول
    isLoggedIn() {
        return !!this.currentUser;
    }

    // التحقق إذا كان المستخدم سائق
    isDriver() {
        return this.isLoggedIn() && this.currentUser.userType === 'driver';
    }

    // التحقق إذا كان المستخدم مستخدم عادي
    isRegularUser() {
        return this.isLoggedIn() && this.currentUser.userType === 'user';
    }
}

// إنشاء كائن مدير الجلسة
const userSession = new UserSession();

// تهيئة حالة المستخدم عند تحميل الصفحة
function initializeAuthState() {
    // التحقق أولاً من وجود مستخدم في التخزين المحلي
    if (userSession.loadFromLocalStorage()) {
        // تحديث واجهة المستخدم مباشرة من البيانات المخزنة
        updateUIAfterLogin(userSession.currentUser);
    }

    // ثم الاستماع لحالة المصادقة في Firebase
    auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            console.log('Firebase auth user detected:', firebaseUser.uid);
            
            // التحقق من وجود مستخدم في localStorage
            if (!userSession.isLoggedIn()) {
                try {
                    // محاولة جلب بيانات السائق
                    let userData = null;
                    let userType = null;
                    
                    // التحقق من قاعدة بيانات السائقين
                    const driverSnapshot = await database.ref(`drivers/${firebaseUser.uid}`).once('value');
                    if (driverSnapshot.exists()) {
                        userData = driverSnapshot.val();
                        userType = 'driver';
                    } else {
                        // التحقق من قاعدة بيانات المستخدمين
                        const userSnapshot = await database.ref(`users/${firebaseUser.uid}`).once('value');
                        if (userSnapshot.exists()) {
                            userData = userSnapshot.val();
                            userType = 'user';
                        }
                    }
                    
                    if (userData) {
                        // دمج البيانات من Firebase Auth مع البيانات المخزنة
                        const combinedData = {
                            ...userData,
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            displayName: firebaseUser.displayName || userData.fullName || userData.name,
                            photoURL: firebaseUser.photoURL || userData.photoUrl,
                            userType: userType
                        };
                        
                        // حفظ البيانات وتحديث الواجهة
                        userSession.saveToLocalStorage(combinedData);
                        updateUIAfterLogin(combinedData);
                    }
                } catch (error) {
                    console.error('Error loading user data:', error);
                }
            }
        } else {
            console.log('No Firebase auth user detected');
            // تسجيل الخروج إذا لم يكن هناك مستخدم في Firebase Authentication
            if (userSession.isLoggedIn()) {
                userSession.clear();
                resetUserInterface();
            }
        }
    });
}

// ------------- وظائف تسجيل الدخول والتسجيل -------------

// وظيفة تسجيل دخول المستخدم
async function handleLogin(event) {
    event.preventDefault();
    showLoading();

    try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // تسجيل الدخول باستخدام Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        // جلب بيانات المستخدم
        let userData = null;
        let userType = null;
        
        // التحقق من قاعدة بيانات السائقين
        const driverSnapshot = await database.ref(`drivers/${firebaseUser.uid}`).once('value');
        if (driverSnapshot.exists()) {
            userData = driverSnapshot.val();
            userType = 'driver';
        } else {
            // التحقق من قاعدة بيانات المستخدمين
            const userSnapshot = await database.ref(`users/${firebaseUser.uid}`).once('value');
            if (userSnapshot.exists()) {
                userData = userSnapshot.val();
                userType = 'user';
            }
        }

        if (!userData) {
            throw new Error('لم يتم العثور على بيانات المستخدم');
        }

        // دمج البيانات من Firebase Auth مع البيانات المخزنة
        const combinedData = {
            ...userData,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName || userData.fullName || userData.name,
            photoURL: firebaseUser.photoURL || userData.photoUrl,
            userType: userType
        };

        // حفظ البيانات وتحديث الواجهة
        userSession.saveToLocalStorage(combinedData);
        updateUIAfterLogin(combinedData);

        // إغلاق نافذة تسجيل الدخول
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();

        showToast('تم تسجيل الدخول بنجاح', 'success');
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
        
        if (error.code) {
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
        }

        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// وظيفة تسجيل مستخدم جديد
async function handleUserRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const fullName = formData.get('fullName');

        // التحقق من كلمة المرور
        if (password !== confirmPassword) {
            throw new Error('كلمات المرور غير متطابقة');
        }

        // التحقق من الشروط والأحكام
        if (!formData.get('terms')) {
            throw new Error('يجب الموافقة على الشروط والأحكام');
        }

        // إنشاء حساب في Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        // تحديث الملف الشخصي
        await firebaseUser.updateProfile({
            displayName: fullName
        });

        // رفع الصورة الشخصية إذا وجدت
        let photoUrl = null;
        const photoFile = document.getElementById('userPhoto').files[0];
        if (photoFile) {
            const imageRef = storage.ref(`users/${firebaseUser.uid}/profile_${Date.now()}`);
            const uploadTask = await imageRef.put(photoFile);
            photoUrl = await uploadTask.ref.getDownloadURL();
            
            // تحديث صورة المستخدم في Firebase Auth
            await firebaseUser.updateProfile({
                photoURL: photoUrl
            });
        }

        // إعداد بيانات المستخدم
        const userData = {
            uid: firebaseUser.uid,
            fullName: fullName,
            email: email,
            phone: formData.get('phone'),
            province: formData.get('province'),
            area: formData.get('area'),
            address: formData.get('address'),
            photoUrl: photoUrl,
            userType: 'user',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        // حفظ البيانات في قاعدة البيانات
        await database.ref(`users/${firebaseUser.uid}`).set(userData);

        // حفظ البيانات محلياً وتحديث الواجهة
        userSession.saveToLocalStorage({
            ...userData,
            displayName: fullName,
            photoURL: photoUrl,
            emailVerified: firebaseUser.emailVerified
        });

        // إغلاق نافذة التسجيل
        const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
        if (modal) modal.hide();

        // عرض رسالة نجاح
        Swal.fire({
            title: 'تم التسجيل بنجاح!',
            text: 'مرحباً بك في تطبيق تاكسي العراق',
            icon: 'success',
            confirmButtonColor: '#FFD700',
            confirmButtonText: 'تم'
        });

        updateUIAfterLogin(userData);
    } catch (error) {
        console.error('User registration error:', error);
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
            }
        }
        
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// وظيفة تسجيل سائق جديد
async function handleDriverRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const fullName = formData.get('fullName');
        const email = document.getElementById('driverEmail').value;
        const password = document.getElementById('driverPassword').value;
        const confirmPassword = document.getElementById('driverConfirmPassword').value;

        // التحقق من تطابق كلمات المرور
        if (password !== confirmPassword) {
            throw new Error('كلمات المرور غير متطابقة');
        }

        // التحقق من وجود صورة شخصية
        const photoFile = document.getElementById('driverPhoto').files[0];
        if (!photoFile) {
            throw new Error('الرجاء اختيار صورة شخصية');
        }

        // التحقق من المستندات المطلوبة
        const requiredDocs = {
            'idCardFront': 'صورة الهوية الأمامية',
            'idCardBack': 'صورة الهوية الخلفية',
            'residenceFront': 'صورة بطاقة السكن الأمامية',
            'residenceBack': 'صورة بطاقة السكن الخلفية',
            'licenseFront': 'صورة إجازة السوق الأمامية',
            'licenseBack': 'صورة إجازة السوق الخلفية'
        };

        for (const [docId, docName] of Object.entries(requiredDocs)) {
            const file = document.getElementById(docId).files[0];
            if (!file) {
                throw new Error(`الرجاء رفع ${docName}`);
            }
        }

        // إنشاء حساب في Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        // تحديث الملف الشخصي
        await firebaseUser.updateProfile({
            displayName: fullName
        });

        // رفع الصورة الشخصية
        const imageRef = storage.ref(`drivers/${firebaseUser.uid}/profile_${Date.now()}`);
        const uploadTask = await imageRef.put(photoFile);
        const photoUrl = await uploadTask.ref.getDownloadURL();
        
        // تحديث صورة المستخدم في Firebase Auth
        await firebaseUser.updateProfile({
            photoURL: photoUrl
        });

        // رفع المستندات
        const documents = {};
        for (const [docId, docName] of Object.entries(requiredDocs)) {
            const file = document.getElementById(docId).files[0];
            const docRef = storage.ref(`drivers/${firebaseUser.uid}/documents/${docId}_${Date.now()}`);
            const docUpload = await docRef.put(file);
            documents[docId] = await docUpload.ref.getDownloadURL();
        }

        // إعداد بيانات السائق
        const driverData = {
            uid: firebaseUser.uid,
            name: fullName,
            email: email,
            phone: document.getElementById('driverPhone').value,
            carType: document.getElementById('carType').value,
            carModel: document.getElementById('carModel').value,
            location: document.getElementById('driverLocation').value,
            coordinates: {
                lat: parseFloat(document.getElementById('driverLatitude').value),
                lng: parseFloat(document.getElementById('driverLongitude').value)
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: photoUrl,
            documents: documents,
            userType: 'driver',
            rating: 5,
            trips: 0,
            approved: false,
            approvalStatus: 'pending',
            active: false,
            registrationDate: firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        };

        // حفظ البيانات في قاعدة البيانات
        await database.ref(`drivers/${firebaseUser.uid}`).set(driverData);

        // حفظ البيانات محلياً وتحديث الواجهة
        userSession.saveToLocalStorage({
            ...driverData,
            displayName: fullName,
            photoURL: photoUrl,
            emailVerified: firebaseUser.emailVerified
        });

        // إغلاق نافذة التسجيل
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        if (modal) modal.hide();

        // إعادة تعيين النموذج
        document.getElementById('addDriverForm').reset();
        resetImagePreviews();

        // عرض رسالة نجاح
        Swal.fire({
            title: 'تم التسجيل بنجاح!',
            html: `
                <div class="success-message">
                    <p>تم إنشاء حسابك بنجاح!</p>
                    <p>سيتم مراجعة الحساب من قبل الإدارة خلال 24 ساعة.</p>
                    <small>ستتلقى إشعاراً عند الموافقة على حسابك.</small>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#FFD700'
        });

        updateUIAfterLogin(driverData);
    } catch (error) {
        console.error('Driver registration error:', error);
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
            }
        }
        
        showToast(errorMessage, 'error');
        
        // في حالة فشل التسجيل، نحاول حذف المستخدم من Firebase Auth إذا تم إنشاؤه
        try {
            const currentUser = auth.currentUser;
            if (currentUser) {
                await currentUser.delete();
            }
        } catch (deleteError) {
            console.error('Error deleting user after registration failure:', deleteError);
        }
    } finally {
        hideLoading();
    }
}

// Export the registration functions
export { handleUserRegistration, handleDriverRegistration };

// وظيفة تسجيل الخروج المحسنة
async function handleLogout() {
    try {
        showLoading();
        
        // 1. تسجيل الخروج من Firebase Auth
        await firebase.auth().signOut();
        
        // 2. مسح جميع بيانات المستخدم من التخزين المحلي
        localStorage.clear(); // مسح كل البيانات وليس فقط currentUser
        sessionStorage.clear(); // مسح بيانات الجلسة أيضًا
        
        // 3. إعادة تعيين متغير الجلسة
        if (typeof userSession !== 'undefined') {
            userSession.clear();
        }
        
        // 4. إعادة تعيين واجهة المستخدم
        resetUserInterface();
        
        // 5. عرض رسالة نجاح
        showToast('تم تسجيل الخروج بنجاح', 'success');
        
        // 6. إعادة تحميل الصفحة بشكل كامل لإعادة تهيئة جميع المكونات
        // استخدام تأخير بسيط للسماح بإظهار رسالة النجاح
        setTimeout(() => {
            // استخدم هذا الأسلوب لتجنب تخزين الصفحة في ذاكرة التخزين المؤقت
            window.location.href = window.location.pathname + "?logout=" + new Date().getTime();
        }, 1000);
        
    } catch (error) {
        console.error('Logout error:', error);
        showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
        
        // في حالة الخطأ، حاول إجبار إعادة تحميل الصفحة
        setTimeout(() => {
            window.location.reload(true);
        }, 2000);
    } finally {
        hideLoading();
    }
}

// إضافة دالة للتحقق من حالة تسجيل الخروج عند تحميل الصفحة
function checkLogoutStatus() {
    // التحقق مما إذا كانت هذه الصفحة ناتجة عن تسجيل الخروج
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('logout')) {
        // إذا كان المستخدم قد سجل الخروج، نزيل معلمة تسجيل الخروج من URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // نتأكد مرة أخرى من مسح جميع البيانات المحلية
        localStorage.clear();
        sessionStorage.clear();
        
        // نتأكد من تحديث واجهة المستخدم
        resetUserInterface();
    }
}

// استدعاء دالة التحقق من تسجيل الخروج عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', checkLogoutStatus);

// ------------- وظائف تحديث واجهة المستخدم -------------

// وظيفة موحدة لتحديث واجهة المستخدم بعد تسجيل الدخول
function updateUIAfterLogin(userData) {
    // التحقق من نوع المستخدم
    const isDriver = userData.userType === 'driver';
    
    // المعلومات المشتركة
    const displayName = userData.fullName || userData.name || userData.displayName || '';
    const photoURL = userData.photoUrl || userData.photoURL || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527';
    
    // تحديث القائمة الجانبية
    const sideNavUserInfo = document.querySelector('.side-nav-user-info');
    if (sideNavUserInfo) {
        sideNavUserInfo.innerHTML = `
            <div class="text-center p-4">
                <img src="${photoURL}" 
                     alt="${displayName}" 
                     class="rounded-circle mb-3"
                     style="width: 80px; height: 80px; object-fit: cover; border: 2px solid #FFD700;">
                <h6 class="text-white mb-1">${displayName}</h6>
                <span class="badge bg-warning mb-2">${isDriver ? 'سائق' : 'مستخدم'}</span>
                ${isDriver ? `
                <div class="driver-status ${userData.active ? 'status-active' : 'status-inactive'}">
                    ${userData.active ? 'متاح' : 'غير متاح'}
                </div>
                ` : ''}
                <div class="mt-3">
                    ${isDriver ? `
                    <button onclick="toggleDriverStatus('${userData.uid}')" class="btn btn-outline-warning btn-sm w-100 mb-2">
                        <i class="fas fa-toggle-on me-2"></i>تغيير الحالة
                    </button>
                    ` : ''}
                    
                </div>
            </div>
        `;
    }

    // تحديث زر الملف الشخصي
    const profileBtn = document.querySelector('.user-profile-btn');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${photoURL}" 
                     alt="${displayName}" 
                     class="rounded-circle me-2" 
                     style="width: 35px; height: 35px; object-fit: cover; border: 2px solid #FFD700;">
                <span class="d-none d-md-inline">${displayName}</span>
            </div>
        `;
        
        // التبديل من فتح نافذة التسجيل إلى عرض قائمة المستخدم
        profileBtn.removeAttribute('data-bs-toggle');
        profileBtn.removeAttribute('data-bs-target');
        profileBtn.onclick = showUserMenu;
    }

    // إخفاء عناصر تسجيل الدخول والتسجيل
    const loginElements = document.querySelectorAll('.login-only');
    loginElements.forEach(el => {
        el.style.display = 'none';
    });

    // إظهار العناصر الخاصة بالمستخدمين المسجلين
    const authElements = document.querySelectorAll('.auth-only');
    authElements.forEach(el => {
        el.style.display = 'block';
    });

    // إظهار العناصر الخاصة بالسائقين فقط
    const driverElements = document.querySelectorAll('.driver-only');
    driverElements.forEach(el => {
        el.style.display = isDriver ? 'block' : 'none';
    });

    // إظهار العناصر الخاصة بالمستخدمين العاديين
    const userElements = document.querySelectorAll('.user-only');
    userElements.forEach(el => {
        el.style.display = !isDriver ? 'block' : 'none';
    });
}

// وظيفة إعادة تعيين واجهة المستخدم عند تسجيل الخروج
function resetUserInterface() {
    // إعادة تعيين الزر
    const profileBtn = document.querySelector('.user-profile-btn');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <i class="fas fa-user"></i>
            <span class="ms-1 د-none د-md-inline">تسجيل</span>
        `;
        profileBtn.setAttribute('data-bs-toggle', 'modal');
        profileBtn.setAttribute('data-bs-target', '#profileModal');
        profileBtn.onclick = null;
    }

    // إعادة تعيين القائمة الجانبية
    const sideNavUserInfo = document.querySelector('.side-nav-user-info');
    if (sideNavUserInfo) {
        sideNavUserInfo.innerHTML = '';
    }

    // إعادة تعيين عرض العناصر المختلفة
    document.querySelectorAll('.login-only').forEach(el => {
        el.style.display = 'block';
    });
    
    document.querySelectorAll('.auth-only').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.driver-only').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.user-only').forEach(el => {
        el.style.display = 'none';
    });
}

// وظيفة عرض قائمة المستخدم
function showUserMenu(event) {
    if (event) event.preventDefault();
    
    if (!userSession.isLoggedIn()) {
        console.error('No user data available');
        return;
    }
    
    const userData = userSession.currentUser;
    const isDriver = userData.userType === 'driver';
    const displayName = userData.fullName || userData.name || userData.displayName || '';
    const photoURL = userData.photoUrl || userData.photoURL || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527';
    
    Swal.fire({
        title: `مرحباً ${displayName}`,
        html: `
            <div class="text-center mb-3">
                <img src="${photoURL}" 
                     alt="صورة المستخدم" 
                     class="rounded-circle mb-3"
                     style="width: 100px; height: 100px; object-fit: cover; border: 3px solid #FFD700;">
                <p class="mb-2">${userData.email || ''}</p>
                <p class="text-muted">${userData.phone || ''}</p>
                ${isDriver ? `
                <div class="badge p-2 my-2 ${userData.active ? 'bg-success' : 'bg-danger'}">
                    ${userData.active ? 'متاح الآن' : 'غير متاح'}
                </div>
                ${userData.approved ? '' : '<div class="badge bg-warning p-2 my-2">في انتظار الموافقة</div>'}
                ` : ''}
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
            // فتح نافذة تعديل الملف الشخصي
            showEditProfileModal();
        } else if (result.isDenied) {
            handleLogout();
        }
    });
}

// وظيفة تبديل حالة السائق (متاح/غير متاح)
async function toggleDriverStatus(driverId) {
    try {
        showLoading();
        
        // التحقق من وجود المستخدم في الجلسة
        if (!userSession.isLoggedIn() || !userSession.isDriver()) {
            throw new Error('يجب تسجيل الدخول كسائق أولاً');
        }
        
        const driverRef = database.ref(`drivers/${driverId}`);
        const snapshot = await driverRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('لم يتم العثور على بيانات السائق');
        }
        
        const driverData = snapshot.val();
        const newStatus = !driverData.active;
        
        await driverRef.update({
            active: newStatus,
            lastStatusUpdate: firebase.database.ServerValue.TIMESTAMP
        });
        
        // تحديث البيانات المحلية
        const userData = userSession.currentUser;
        userData.active = newStatus;
        userSession.saveToLocalStorage(userData);
        
        // تحديث واجهة المستخدم
        updateUIAfterLogin(userData);
        
        showToast(`تم تغيير الحالة إلى ${newStatus ? 'متاح' : 'غير متاح'}`, 'success');
    } catch (error) {
        console.error('Error toggling driver status:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// وظيفة عرض نافذة تعديل الملف الشخصي
function showEditProfileModal() {
    if (!userSession.isLoggedIn()) {
        console.error('No user data available');
        return;
    }
    
    const userData = userSession.currentUser;
    const isDriver = userData.userType === 'driver';
    
    let modalContent = '';
    
    if (isDriver) {
        modalContent = `
            <form id="editDriverForm" class="text-start">
                <div class="mb-3">
                    <label class="form-label">رقم الهاتف</label>
                    <input type="tel" class="form-control" id="editPhone" value="${userData.phone || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">نوع السيارة</label>
                    <input type="text" class="form-control" id="editCarType" value="${userData.carType || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">موديل السيارة</label>
                    <input type="text" class="form-control" id="editCarModel" value="${userData.carModel || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">نبذة شخصية</label>
                    <textarea class="form-control" id="editBio" rows="3">${userData.bio || ''}</textarea>
                </div>
            </form>
        `;
    } else {
        modalContent = `
            <form id="editUserForm" class="text-start">
                <div class="mb-3">
                    <label class="form-label">الاسم الكامل</label>
                    <input type="text" class="form-control" id="editFullName" value="${userData.fullName || userData.name || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">رقم الهاتف</label>
                    <input type="tel" class="form-control" id="editPhone" value="${userData.phone || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">العنوان</label>
                    <textarea class="form-control" id="editAddress" rows="2">${userData.address || ''}</textarea>
                </div>
            </form>
        `;
    }
    
    Swal.fire({
        title: 'تعديل الملف الشخصي',
        html: modalContent,
        showCancelButton: true,
        confirmButtonText: 'حفظ التغييرات',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#FFD700',
        cancelButtonColor: '#6c757d',
        preConfirm: () => {
            // جمع البيانات من النموذج
            const data = {};
            
            if (isDriver) {
                data.phone = document.getElementById('editPhone').value;
                data.carType = document.getElementById('editCarType').value;
                data.carModel = document.getElementById('editCarModel').value;
                data.bio = document.getElementById('editBio').value;
            } else {
                data.fullName = document.getElementById('editFullName').value;
                data.phone = document.getElementById('editPhone').value;
                data.address = document.getElementById('editAddress').value;
            }
            
            return data;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            updateUserProfile(userData.uid, result.value, isDriver);
        }
    });
}

// وظيفة تحديث ملف المستخدم
async function updateUserProfile(userId, newData, isDriver) {
    try {
        showLoading();
        
        // تحديث البيانات في قاعدة البيانات
        const userRef = database.ref(`${isDriver ? 'drivers' : 'users'}/${userId}`);
        await userRef.update({
            ...newData,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        });
        
        // تحديث البيانات المحلية
        const userData = userSession.currentUser;
        Object.assign(userData, newData);
        userSession.saveToLocalStorage(userData);
        
        // تحديث واجهة المستخدم
        updateUIAfterLogin(userData);
        
        showToast('تم تحديث البيانات بنجاح', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
        hideLoading();
    }
}

// وظيفة إعادة تعيين معاينات الصور
function resetImagePreviews() {
    const previews = document.querySelectorAll('img[id$="Preview"]');
    const placeholders = document.querySelectorAll('.upload-placeholder');

    previews.forEach(preview => {
        preview.src = '#';
        preview.style.display = 'none';
    });

    placeholders.forEach(placeholder => {
        placeholder.style.display = 'flex';
    });
}

// تهيئة إدارة المستخدمين عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initializeAuthState();
    
    // ربط نموذج تسجيل الدخول
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // ربط نموذج تسجيل المستخدم
    const userRegistrationForm = document.getElementById('userRegistrationForm');
    if (userRegistrationForm) {
        userRegistrationForm.addEventListener('submit', handleUserRegistration);
    }
    
    // ربط نموذج إضافة السائق
    const addDriverForm = document.getElementById('addDriverForm');
    if (addDriverForm) {
        addDriverForm.addEventListener('submit', handleDriverRegistration);
    }
});


function togglePasswordVisibility(button) {
    const input = button.previousElementSibling;
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}