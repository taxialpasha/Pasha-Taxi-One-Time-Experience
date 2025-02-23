// Initialize Firebase Auth
const auth = firebase.auth();

// تعديل دالة معالجة تسجيل المستخدم
// دالة معالجة تسجيل المستخدم الجديد
async function handleUserRegistration(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const fullName = formData.get('fullName');

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
        }

        // حفظ البيانات الإضافية في Realtime Database
        const userData = {
            uid: user.uid,
            fullName: fullName,
            email: email,
            phone: formData.get('phone'),
            province: formData.get('province'),
            area: formData.get('area'),
            address: formData.get('address'),
            photoUrl: photoUrl,
            userType: 'user',
            approved: false, // إضافة حالة الموافقة
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await firebase.database().ref(`users/${user.uid}`).set(userData);

        // إغلاق نافذة التسجيل
        const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
        modal.hide();

        // عرض رسالة نجاح
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
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// دالة معالجة تسجيل الدخول
async function handleLogin(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = new FormData(event.target);
        const email = formData.get('email');
        const password = formData.get('password');

        // تسجيل الدخول باستخدام Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // جلب البيانات الإضافية من Realtime Database
        const userDataSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        const userData = userDataSnapshot.val();

        // حفظ بيانات المستخدم في التخزين المحلي
        localStorage.setItem('currentUser', JSON.stringify({
            ...userData,
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
        }));

        // تحديث واجهة المستخدم
        updateUIAfterLogin({
            ...userData,
            name: user.displayName,
            photo: user.photoURL
        });

        // إغلاق نافذة تسجيل الدخول
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        loginModal.hide();

        showToast('تم تسجيل الدخول بنجاح');

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
    }
}

// دالة تحديث واجهة المستخدم بعد تسجيل الدخول
function updateUIAfterLogin(userData) {
    // تحديث زر الملف الشخصي في الشريط العلوي
    const profileBtn = document.querySelector('.user-profile-btn');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <img src="${userData.photoUrl || userData.photoURL || 'default-avatar.png'}" 
                 alt="${userData.fullName || userData.name}" 
                 class="rounded-circle me-2" 
                 style="width: 35px; height: 35px; object-fit: cover;">
            <span class="d-none d-md-inline">${userData.fullName || userData.name}</span>
        `;
        
        // تحديث الروابط والإجراءات
        profileBtn.removeAttribute('data-bs-toggle');
        profileBtn.removeAttribute('data-bs-target');
        profileBtn.setAttribute('onclick', 'showUserMenu(event)');
    }

    // تحديث معلومات المستخدم في الشريط الجانبي
    const sideNavUserInfo = document.querySelector('.side-nav-user-info');
    if (sideNavUserInfo) {
        sideNavUserInfo.innerHTML = `
            <div class="text-center">
                <img src="${userData.photoUrl || userData.photoURL || 'default-avatar.png'}" 
                     alt="${userData.fullName || userData.name}" 
                     class="rounded-circle mb-3"
                     style="width: 80px; height: 80px; object-fit: cover;">
                <h6 class="text-white mb-1">${userData.fullName || userData.name}</h6>
                <span class="text-gold">${userData.email}</span>
                <div class="mt-3">
                    <button onclick="handleLogout()" class="btn btn-outline-danger btn-sm w-100">
                        <i class="fas fa-sign-out-alt me-2"></i>تسجيل الخروج
                    </button>
                </div>
            </div>
        `;
    }
}

// دالة عرض قائمة المستخدم
function showUserMenu(event) {
    event.preventDefault();
    const userData = JSON.parse(localStorage.getItem('currentUser'));
    
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
            // فتح نافذة تعديل الملف الشخصي
            showEditProfileModal();
        } else if (result.isDenied) {
            handleLogout();
        }
    });
}

// دالة تسجيل الخروج
async function handleLogout() {
    try {
        await firebase.auth().signOut();
        localStorage.removeItem('currentUser');
        resetUserInterface();
        showToast('تم تسجيل الخروج بنجاح');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
    }
}

// مراقبة حالة تسجيل الدخول
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // المستخدم مسجل الدخول
        console.log('User is signed in:', user.uid);
        
        try {
            const userDataSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
            const userData = userDataSnapshot.val();
            
            if (userData) {
                updateUIAfterLogin({
                    ...userData,
                    name: user.displayName,
                    photo: user.photoURL
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    } else {
        // المستخدم غير مسجل الدخول
        console.log('User is signed out');
        localStorage.removeItem('currentUser');
        resetUserInterface();
    }
});

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