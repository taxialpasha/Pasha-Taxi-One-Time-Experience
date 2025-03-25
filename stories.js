// نظام القصص لتطبيق تاكسي العراق
class StoriesSystem {
    constructor() {
        // المراجع إلى عناصر DOM
        this.storiesContainer = document.querySelector('.stories-container');
        this.storyViewer = document.getElementById('storyViewer');
        this.storyProgress = document.getElementById('storyProgress');
        this.storyContent = document.querySelector('.story-content');
        this.storyUserImg = document.getElementById('storyUserImg');
        this.storyUserName = document.getElementById('storyUserName');
        this.storyTime = document.getElementById('storyTime');
        this.storyClose = document.getElementById('storyClose');
        this.navPrev = document.getElementById('navPrev');
        this.navNext = document.getElementById('navNext');
        this.storyLoader = document.getElementById('storyLoader');
        this.addStoryBtn = document.getElementById('addStoryBtn');
        this.addStoryModal = document.getElementById('addStoryModal');
        this.closeAddStoryModal = document.getElementById('closeAddStoryModal');
        this.selectMediaBtn = document.getElementById('selectMediaBtn');
        this.storyMediaInput = document.getElementById('storyMediaInput');
        this.storyPreview = document.getElementById('storyPreview');
        this.uploadStoryBtn = document.getElementById('uploadStoryBtn');
        this.closeAddStoryModalBtn = document.getElementById('closeAddStoryModal');
        
        // حالة النظام
        this.stories = []; // مصفوفة القصص
        this.currentUserIndex = 0; // مؤشر المستخدم الحالي
        this.currentStoryIndex = 0; // مؤشر القصة الحالية
        this.timer = null; // مؤقت العرض
        this.progressBars = []; // مصفوفة أشرطة التقدم
        this.storyDuration = 5000; // مدة عرض كل قصة (5 ثوانٍ)
        this.isPlaying = false; // هل القصة قيد التشغيل
        this.selectedMedia = null; // الوسائط المختارة للتحميل
        
        // تهيئة النظام
        this.init();
    }
    
    // تهيئة نظام القصص
    init() {
        // تحميل القصص من Firebase
        this.loadStories();
        
        // إضافة مستمعي الأحداث
        this.addEventListeners();
    }
    
    // تحميل القصص من Firebase
    async loadStories() {
        try {
            // التحقق مما إذا كانت Firebase متاحة
            if (!firebase || !firebase.database) {
                console.error('Firebase غير متاح');
                return;
            }
            
            // البدء بإظهار مؤشر التحميل في حاوية القصص
            this.showLoadingInContainer();
            
            // جلب القصص من Firebase
            const storiesRef = firebase.database().ref('stories');
            const snapshot = await storiesRef.orderByChild('timestamp').once('value');
            const storiesData = snapshot.val() || {};
            
            // تحويل القصص إلى مصفوفة وفلترة القصص القديمة (أكثر من 24 ساعة)
            this.stories = Object.keys(storiesData)
                .map(key => ({
                    id: key,
                    ...storiesData[key]
                }))
                .filter(story => {
                    // التحقق من أن القصة لم تتجاوز 24 ساعة
                    const storyTime = new Date(story.timestamp);
                    const now = new Date();
                    const diff = now - storyTime;
                    return diff <= 24 * 60 * 60 * 1000; // 24 ساعة بالميلي ثانية
                })
                .reverse(); // ترتيب بحيث تظهر أحدث القصص أولاً
            
            // تنظيم القصص حسب المستخدم
            this.organizeStoriesByUser();
            
            // عرض القصص في الواجهة
            this.renderStories();
        } catch (error) {
            console.error('خطأ في تحميل القصص:', error);
            this.showErrorMessage('فشل في تحميل القصص');
        } finally {
            // إخفاء مؤشر التحميل
            this.hideLoadingInContainer();
        }
    }
    
    // إظهار مؤشر التحميل في حاوية القصص
    showLoadingInContainer() {
        // إضافة عنصر التحميل مؤقتًا
        const loadingItem = document.createElement('div');
        loadingItem.className = 'story-item loading-item';
        loadingItem.innerHTML = `
            <div class="story-circle" style="display: flex; align-items: center; justify-content: center;">
                <div style="width: 30px; height: 30px; border: 2px solid #FFD700; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <span class="story-username">جاري التحميل...</span>
        `;
        
        // إضافة بعد زر إضافة القصة
        if (this.addStoryBtn) {
            this.addStoryBtn.insertAdjacentElement('afterend', loadingItem);
        } else {
            this.storiesContainer.appendChild(loadingItem);
        }
    }
    
    // إخفاء مؤشر التحميل
    hideLoadingInContainer() {
        const loadingItem = document.querySelector('.loading-item');
        if (loadingItem) {
            loadingItem.remove();
        }
    }
    
    // عرض رسالة خطأ
    showErrorMessage(message) {
        const errorItem = document.createElement('div');
        errorItem.className = 'story-item error-item';
        errorItem.innerHTML = `
            <div class="story-circle" style="display: flex; align-items: center; justify-content: center; background-color: #ff4d4d;">
                <i class="fas fa-exclamation-triangle" style="color: white; font-size: 24px;"></i>
            </div>
            <span class="story-username">${message}</span>
        `;
        
        // إزالة أي رسالة خطأ سابقة
        const prevError = document.querySelector('.error-item');
        if (prevError) {
            prevError.remove();
        }
        
        // إضافة بعد زر إضافة القصة
        if (this.addStoryBtn) {
            this.addStoryBtn.insertAdjacentElement('afterend', errorItem);
        } else {
            this.storiesContainer.appendChild(errorItem);
        }
        
        // إزالة رسالة الخطأ بعد 5 ثوانٍ
        setTimeout(() => {
            errorItem.remove();
        }, 5000);
    }
    
    // تنظيم القصص حسب المستخدم
    organizeStoriesByUser() {
        // إنشاء قاموس للمستخدمين وقصصهم
        const userStories = {};
        
        // تجميع القصص حسب معرف المستخدم
        this.stories.forEach(story => {
            if (!userStories[story.userId]) {
                userStories[story.userId] = {
                    user: {
                        id: story.userId,
                        name: story.userName,
                        photoURL: story.userPhoto
                    },
                    stories: []
                };
            }
            
            userStories[story.userId].stories.push(story);
        });
        
        // تحويل القاموس إلى مصفوفة
        this.userStories = Object.values(userStories);
    }
    
    // عرض القصص في الواجهة
    renderStories() {
        // التحقق من وجود قصص
        if (this.userStories.length === 0) {
            this.showNoStoriesMessage();
            return;
        }
        
        // تفريغ حاوية القصص (ما عدا زر الإضافة)
        const allStoryItems = Array.from(this.storiesContainer.querySelectorAll('.story-item:not(.add-story)'));
        allStoryItems.forEach(item => item.remove());
        
        // الحصول على المستخدم الحالي من التخزين المحلي
        const currentUser = this.getCurrentUser();
        
        // إضافة القصص للواجهة
        this.userStories.forEach(userStory => {
            const storyItem = document.createElement('div');
            storyItem.className = 'story-item';
            storyItem.setAttribute('data-user-id', userStory.user.id);
            
            // التحقق مما إذا كانت قصص المستخدم مشاهدة بالكامل
            const allViewed = this.checkIfAllStoriesViewed(userStory.stories);
            if (!allViewed) {
                storyItem.classList.add('has-new');
            }
            
            storyItem.innerHTML = `
                <div class="story-circle ${allViewed ? 'viewed' : ''}">
                    <img src="${userStory.user.photoURL || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="${userStory.user.name}" class="story-img">
                </div>
                <span class="story-username">${userStory.user.name}</span>
            `;
            
            // إضافة مستمع لفتح القصص عند النقر
            storyItem.addEventListener('click', () => {
                this.openStory(userStory.user.id);
            });
            
            // إضافة القصة إلى الحاوية (بعد زر الإضافة)
            if (this.addStoryBtn) {
                this.addStoryBtn.insertAdjacentElement('afterend', storyItem);
            } else {
                this.storiesContainer.appendChild(storyItem);
            }
        });
        
        // إخفاء زر الإضافة إذا لم يكن المستخدم مسجل الدخول
        if (!currentUser) {
            if (this.addStoryBtn) {
                this.addStoryBtn.style.display = 'none';
            }
        } else {
            if (this.addStoryBtn) {
                this.addStoryBtn.style.display = 'flex';
            }
        }
    }
    
    // عرض رسالة عدم وجود قصص
    showNoStoriesMessage() {
        const noStoriesItem = document.createElement('div');
        noStoriesItem.className = 'story-item no-stories-item';
        noStoriesItem.innerHTML = `
            <div class="story-circle" style="background-color: #333;">
                <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                    <i class="fas fa-film" style="color: #666; font-size: 24px;"></i>
                </div>
            </div>
            <span class="story-username">لا توجد قصص</span>
        `;
        
        // إضافة بعد زر إضافة القصة
        if (this.addStoryBtn) {
            this.addStoryBtn.insertAdjacentElement('afterend', noStoriesItem);
        } else {
            this.storiesContainer.appendChild(noStoriesItem);
        }
    }
    
    // تعديل في دالة getCurrentUser لتمييز السائقين عن المستخدمين العاديين
getCurrentUser() {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            // إضافة حقل لتحديد نوع المستخدم
            return {
                ...user,
                isDriver: user.userType === 'driver' || user.role === 'driver' || user.type === 'driver'
            };
        }
        return null;
    } catch (error) {
        console.error('خطأ في قراءة بيانات المستخدم:', error);
        return null;
    }
}

// تعديل في دالة openAddStoryModal للتحقق من أن المستخدم سائق
openAddStoryModal() {
    // التحقق مما إذا كان المستخدم مسجل الدخول
    const currentUser = this.getCurrentUser();
    
    if (!currentUser) {
        // إذا لم يكن المستخدم مسجل الدخول، عرض نافذة تسجيل الدخول
        this.showLoginPrompt();
        return;
    }
    
    // التحقق من أن المستخدم سائق
    if (!currentUser.isDriver) {
        // إذا لم يكن المستخدم سائق، عرض رسالة إعلامية
        this.showDriverOnlyMessage();
        return;
    }
    
    // إعادة تعيين المودال
    this.resetAddStoryModal();
    
    // إظهار المودال
    this.addStoryModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // منع التمرير في الصفحة الخلفية
}

// دالة جديدة لعرض رسالة أن القصص للسائقين فقط
showDriverOnlyMessage() {
    Swal.fire({
        title: 'قصص للسائقين فقط',
        text: 'عذراً، ميزة نشر القصص متاحة للسائقين فقط. يمكنك تسجيل حساب كسائق للاستفادة من هذه الميزة.',
        icon: 'info',
        confirmButtonText: 'حسناً',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#FFD700'
    });
}

// تعديل في دالة renderStories لإخفاء أو إظهار زر إضافة القصة
renderStories() {
    // التحقق من وجود قصص
    if (this.userStories.length === 0) {
        this.showNoStoriesMessage();
        return;
    }
    
    // تفريغ حاوية القصص (ما عدا زر الإضافة)
    const allStoryItems = Array.from(this.storiesContainer.querySelectorAll('.story-item:not(.add-story)'));
    allStoryItems.forEach(item => item.remove());
    
    // الحصول على المستخدم الحالي من التخزين المحلي
    const currentUser = this.getCurrentUser();
    
    // إضافة القصص للواجهة
    this.userStories.forEach(userStory => {
        const storyItem = document.createElement('div');
        storyItem.className = 'story-item';
        storyItem.setAttribute('data-user-id', userStory.user.id);
        
        // التحقق مما إذا كانت قصص المستخدم مشاهدة بالكامل
        const allViewed = this.checkIfAllStoriesViewed(userStory.stories);
        if (!allViewed) {
            storyItem.classList.add('has-new');
        }
        
        storyItem.innerHTML = `
            <div class="story-circle ${allViewed ? 'viewed' : ''}">
                <img src="${userStory.user.photoURL || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="${userStory.user.name}" class="story-img">
                <div class="driver-badge" title="سائق">
                    <i class="fas fa-car"></i>
                </div>
            </div>
            <span class="story-username">${userStory.user.name}</span>
        `;
        
        // إضافة مستمع لفتح القصص عند النقر
        storyItem.addEventListener('click', () => {
            this.openStory(userStory.user.id);
        });
        
        // إضافة القصة إلى الحاوية (بعد زر الإضافة)
        if (this.addStoryBtn) {
            this.addStoryBtn.insertAdjacentElement('afterend', storyItem);
        } else {
            this.storiesContainer.appendChild(storyItem);
        }
    });
    
    // إخفاء/إظهار زر الإضافة بناءً على نوع المستخدم
    if (this.addStoryBtn) {
        if (!currentUser) {
            // إخفاء زر الإضافة إذا لم يكن المستخدم مسجل الدخول
            this.addStoryBtn.style.display = 'none';
        } else if (!currentUser.isDriver) {
            // إخفاء زر الإضافة إذا لم يكن المستخدم سائق
            this.addStoryBtn.style.display = 'none';
        } else {
            // إظهار زر الإضافة إذا كان المستخدم سائق
            this.addStoryBtn.style.display = 'flex';
            
            // تعديل عنوان زر الإضافة ليكون أكثر وضوحاً للسائقين
            const usernameElement = this.addStoryBtn.querySelector('.story-username');
            if (usernameElement) {
                usernameElement.textContent = 'أضف قصتك';
            }
        }
    }
    
    // إضافة شرح إرشادي إذا كان المستخدم غير مسجل الدخول أو ليس سائق
    if (!currentUser || !currentUser.isDriver) {
        this.addViewerOnlyExplanation();
    }
}

// دالة جديدة لإضافة شرح "المشاهدة فقط"
addViewerOnlyExplanation() {
    // التحقق من وجود الشرح مسبقاً
    if (document.querySelector('.stories-view-only-notice')) {
        return;
    }
    
    // إنشاء عنصر الشرح
    const explanation = document.createElement('div');
    explanation.className = 'stories-view-only-notice';
  
    
    // إضافة إلى حاوية القصص
    this.storiesContainer.appendChild(explanation);
}

// تعديل في دالة uploadStory للتحقق من أن المستخدم سائق
async uploadStory() {
    if (!this.selectedMedia) return;
    
    // التحقق من المستخدم الحالي
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
        this.showLoginPrompt();
        return;
    }
    
    // التحقق من أن المستخدم سائق
    if (!currentUser.isDriver) {
        this.showDriverOnlyMessage();
        return;
    }
    
    try {
        // إظهار مؤشر التحميل
        Swal.fire({
            title: 'جاري رفع القصة...',
            text: 'يرجى الانتظار',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#1a1a1a',
            color: '#fff'
        });
        
        // رفع الملف إلى Firebase Storage
        const storageRef = firebase.storage().ref();
        const mediaId = Date.now().toString();
        const fileRef = storageRef.child(`stories/${currentUser.uid}/${mediaId}_${this.selectedMedia.file.name}`);
        
        // رفع الملف
        const uploadTask = await fileRef.put(this.selectedMedia.file);
        
        // الحصول على URL الملف
        const mediaUrl = await uploadTask.ref.getDownloadURL();
        
        // إنشاء بيانات القصة
        const storyData = {
            userId: currentUser.uid,
            userName: currentUser.fullName || currentUser.name || 'سائق',
            userPhoto: currentUser.photoUrl || currentUser.imageUrl || null,
            mediaType: this.selectedMedia.type,
            mediaUrl: mediaUrl,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            isDriverStory: true  // تعليم القصة كقصة سائق
        };
        
        // حفظ البيانات في Firebase Database
        const newStoryRef = firebase.database().ref('stories').push();
        await newStoryRef.set(storyData);
        
        // إغلاق مؤشر التحميل
        Swal.close();
        
        // إظهار رسالة نجاح
        Swal.fire({
            title: 'تم بنجاح!',
            text: 'تمت إضافة قصتك بنجاح وستظهر للمستخدمين',
            icon: 'success',
            confirmButtonText: 'حسناً',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#FFD700'
        });
        
        // إغلاق مودال الإضافة
        this.closeAddStoryModal();
        
        // إعادة تحميل القصص
        this.loadStories();
    } catch (error) {
        console.error('خطأ في رفع القصة:', error);
        
        // إغلاق مؤشر التحميل
        Swal.close();
        
        // إظهار رسالة خطأ
        Swal.fire({
            title: 'خطأ',
            text: 'حدث خطأ أثناء رفع القصة. يرجى المحاولة مرة أخرى.',
            icon: 'error',
            confirmButtonText: 'حسناً',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#FFD700'
        });
    }
}
    
    // التحقق مما إذا كانت جميع قصص المستخدم مشاهدة
    checkIfAllStoriesViewed(stories) {
        const viewedStories = this.getViewedStories();
        return stories.every(story => viewedStories.includes(story.id));
    }
    
    // الحصول على قائمة معرفات القصص المشاهدة
    getViewedStories() {
        try {
            const viewedJson = localStorage.getItem('viewedStories');
            if (viewedJson) {
                return JSON.parse(viewedJson);
            }
            return [];
        } catch (error) {
            console.error('خطأ في قراءة القصص المشاهدة:', error);
            return [];
        }
    }
    
    // تسجيل قصة كمشاهدة
    markStoryAsViewed(storyId) {
        try {
            let viewedStories = this.getViewedStories();
            if (!viewedStories.includes(storyId)) {
                viewedStories.push(storyId);
                localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
            }
        } catch (error) {
            console.error('خطأ في تسجيل القصة كمشاهدة:', error);
        }
    }
    
    // فتح عارض القصص
    openStory(userId) {
        // البحث عن مؤشر المستخدم
        this.currentUserIndex = this.userStories.findIndex(userStory => userStory.user.id === userId);
        if (this.currentUserIndex === -1) {
            console.error('لم يتم العثور على المستخدم');
            return;
        }
        
        // تعيين مؤشر القصة الحالية إلى أول قصة غير مشاهدة
        const userStories = this.userStories[this.currentUserIndex].stories;
        const viewedStories = this.getViewedStories();
        this.currentStoryIndex = userStories.findIndex(story => !viewedStories.includes(story.id));
        
        // إذا تمت مشاهدة جميع القصص، ابدأ من الأولى
        if (this.currentStoryIndex === -1) {
            this.currentStoryIndex = 0;
        }
        
        // تهيئة عارض القصص
        this.initStoryViewer();
        
        // عرض القصة الحالية
        this.showCurrentStory();
        
        // إظهار عارض القصص
        this.storyViewer.classList.add('active');
        document.body.style.overflow = 'hidden'; // منع التمرير في الصفحة الخلفية
    }
    
    // تهيئة عارض القصص
    initStoryViewer() {
        // تحديث معلومات المستخدم
        const user = this.userStories[this.currentUserIndex].user;
        this.storyUserImg.src = user.photoURL || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
        this.storyUserName.textContent = user.name;
        
        // إعادة تعيين مؤشر التحميل
        this.storyLoader.style.display = 'block';
        
        // تعيين أشرطة التقدم
        this.setupProgressBars();
    }
    
    // إعداد أشرطة التقدم
    setupProgressBars() {
        // إعادة تعيين شريط التقدم
        this.storyProgress.innerHTML = '';
        this.progressBars = [];
        
        // إنشاء أشرطة تقدم لكل قصة
        const userStories = this.userStories[this.currentUserIndex].stories;
        userStories.forEach((_, index) => {
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            // إذا كانت القصة سابقة، اجعل شريط التقدم مكتمل
            if (index < this.currentStoryIndex) {
                progressBar.style.width = '100%';
            }
            
            progressItem.appendChild(progressBar);
            this.storyProgress.appendChild(progressItem);
            this.progressBars.push(progressBar);
        });
    }
    
    // عرض القصة الحالية
    async showCurrentStory() {
        // إيقاف المؤقت الحالي إذا كان موجودًا
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        // الحصول على القصة الحالية
        const userStories = this.userStories[this.currentUserIndex].stories;
        const story = userStories[this.currentStoryIndex];
        
        // تسجيل القصة كمشاهدة
        this.markStoryAsViewed(story.id);
        
        // تحديث وقت القصة
        this.updateStoryTime(story.timestamp);
        
        // عرض القصة (صورة أو فيديو)
        await this.displayStoryMedia(story);
        
        // بدء مؤقت للانتقال التلقائي للقصة التالية
        this.startStoryTimer();
    }
    
    // تحديث وقت القصة
    updateStoryTime(timestamp) {
        const storyTime = new Date(timestamp);
        const now = new Date();
        const diff = now - storyTime;
        
        // تنسيق الوقت المنقضي
        let timeText = '';
        
        if (diff < 60 * 1000) { // أقل من دقيقة
            timeText = 'الآن';
        } else if (diff < 60 * 60 * 1000) { // أقل من ساعة
            const minutes = Math.floor(diff / (60 * 1000));
            timeText = `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
        } else if (diff < 24 * 60 * 60 * 1000) { // أقل من يوم
            const hours = Math.floor(diff / (60 * 60 * 1000));
            timeText = `منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
        } else { // أكثر من يوم
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            timeText = `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
        }
        
        this.storyTime.textContent = timeText;
    }
    
    // عرض وسائط القصة (صورة أو فيديو)
    async displayStoryMedia(story) {
        // إظهار مؤشر التحميل
        this.storyLoader.style.display = 'block';
        
        // إزالة أي وسائط سابقة
        const prevMedia = this.storyContent.querySelector('img, video');
        if (prevMedia) {
            prevMedia.remove();
        }
        
        try {
            // تحديد نوع الوسائط
            const isVideo = story.mediaType === 'video';
            
            if (isVideo) {
                // إنشاء عنصر فيديو
                const video = document.createElement('video');
                video.className = 'story-video';
                video.src = story.mediaUrl;
                video.muted = false;
                video.autoplay = true;
                video.controlsList = 'nodownload';
                
                // إضافة مستمعي الأحداث للفيديو
                video.addEventListener('loadeddata', () => {
                    this.storyLoader.style.display = 'none';
                    this.isPlaying = true;
                    
                    // ضبط مدة العرض لتتناسب مع مدة الفيديو
                    this.storyDuration = video.duration * 1000;
                    
                    // تشغيل الفيديو
                    video.play().catch(error => {
                        console.error('خطأ في تشغيل الفيديو:', error);
                    });
                });
                
                video.addEventListener('error', () => {
                    console.error('خطأ في تحميل الفيديو');
                    this.storyLoader.style.display = 'none';
                    this.isPlaying = false;
                });
                
                video.addEventListener('ended', () => {
                    this.isPlaying = false;
                    this.goToNextStory();
                });
                
                // إضافة الفيديو إلى محتوى القصة
                this.storyContent.appendChild(video);
            } else {
                // إنشاء عنصر صورة
                const img = document.createElement('img');
                img.className = 'story-image';
                img.src = story.mediaUrl;
                
                // إضافة مستمعي الأحداث للصورة
                img.addEventListener('load', () => {
                    this.storyLoader.style.display = 'none';
                    this.isPlaying = true;
                });
                
                img.addEventListener('error', () => {
                    console.error('خطأ في تحميل الصورة');
                    this.storyLoader.style.display = 'none';
                    this.isPlaying = false;
                });
                
                // إضافة الصورة إلى محتوى القصة
                this.storyContent.appendChild(img);
            }
        } catch (error) {
            console.error('خطأ في عرض وسائط القصة:', error);
            this.storyLoader.style.display = 'none';
            this.isPlaying = false;
        }
    }
    
    // بدء مؤقت للقصة
    startStoryTimer() {
        // التأكد من إيقاف أي مؤقت سابق
        if (this.timer) {
            clearTimeout(this.timer);
        }
        
        // الحصول على شريط التقدم الحالي
        const progressBar = this.progressBars[this.currentStoryIndex];
        if (!progressBar) return;
        
        // إعادة تعيين شريط التقدم
        progressBar.style.width = '0%';
        
        // المدة المتبقية
        let duration = this.storyDuration;
        
        // تحديد ما إذا كانت القصة الحالية فيديو
        const userStories = this.userStories[this.currentUserIndex].stories;
        const currentStory = userStories[this.currentStoryIndex];
        const isVideo = currentStory.mediaType === 'video';
        
        // إذا كانت فيديو، نستخدم مدة الفيديو الفعلية
        if (isVideo) {
            const video = this.storyContent.querySelector('video');
            if (video) {
                duration = video.duration * 1000;
            }
        }
        
        // بدء تحديث شريط التقدم
        let startTime = Date.now();
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration * 100, 100);
            progressBar.style.width = `${progress}%`;
            
            if (progress < 100 && this.isPlaying) {
                // استمرار في التحديث
                requestAnimationFrame(updateProgress);
            } else if (progress >= 100) {
                // الانتقال إلى القصة التالية
                this.goToNextStory();
            }
        };
        
        // بدء تحديث التقدم
        requestAnimationFrame(updateProgress);
        
        // ضبط المؤقت للانتقال إلى القصة التالية
        if (!isVideo) { // نستخدم المؤقت فقط للصور، أما الفيديو فلديه حدث 'ended'
            this.timer = setTimeout(() => {
                this.goToNextStory();
            }, duration);
        }
    }
    
    // الانتقال إلى القصة التالية
    goToNextStory() {
        // إيقاف أي وسائط حالية
        this.pauseCurrentMedia();
        
        const userStories = this.userStories[this.currentUserIndex].stories;
        
        // التحقق مما إذا كانت هناك قصة تالية لنفس المستخدم
        if (this.currentStoryIndex < userStories.length - 1) {
            // الانتقال إلى القصة التالية لنفس المستخدم
            this.currentStoryIndex++;
            this.showCurrentStory();
        } else {
            // الانتقال إلى المستخدم التالي
            if (this.currentUserIndex < this.userStories.length - 1) {
                this.currentUserIndex++;
                this.currentStoryIndex = 0;
                this.initStoryViewer();
                this.showCurrentStory();
            } else {
                // انتهت جميع القصص، إغلاق العارض
                this.closeStoryViewer();
            }
        }
    }
    
    // الانتقال إلى القصة السابقة
    goToPrevStory() {
        // إيقاف أي وسائط حالية
        this.pauseCurrentMedia();
        
        // التحقق مما إذا كانت هناك قصة سابقة لنفس المستخدم
        if (this.currentStoryIndex > 0) {
            // الانتقال إلى القصة السابقة لنفس المستخدم
            this.currentStoryIndex--;
            this.showCurrentStory();
        } else {
            // الانتقال إلى المستخدم السابق
            if (this.currentUserIndex > 0) {
                this.currentUserIndex--;
                const userStories = this.userStories[this.currentUserIndex].stories;
                this.currentStoryIndex = userStories.length - 1; // آخر قصة للمستخدم السابق
                this.initStoryViewer();
                this.showCurrentStory();
            } else {
                // نحن في أول قصة، لا يمكن الانتقال للخلف أكثر
                // يمكن إعادة تشغيل الفيديو أو عرض القصة من البداية
                this.showCurrentStory();
            }
        }
    }
    
    // إيقاف الوسائط الحالية (فيديو)
    pauseCurrentMedia() {
        this.isPlaying = false;
        
        // إيقاف تشغيل الفيديو إذا كان موجودًا
        const video = this.storyContent.querySelector('video');
        if (video) {
            video.pause();
        }
        
        // إيقاف المؤقت
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    
    // إغلاق عارض القصص
    closeStoryViewer() {
        // إيقاف أي وسائط حالية
        this.pauseCurrentMedia();
        
        // إخفاء العارض
        this.storyViewer.classList.remove('active');
        document.body.style.overflow = ''; // استعادة التمرير في الصفحة
        
        // تحديث الواجهة لعكس حالة المشاهدة
        this.renderStories();
    }
    
    // فتح مودال إضافة قصة جديدة
    openAddStoryModal() {
        // التحقق مما إذا كان المستخدم مسجل الدخول
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            // إذا لم يكن المستخدم مسجل الدخول، عرض نافذة تسجيل الدخول
            this.showLoginPrompt();
            return;
        }
        
        // إعادة تعيين المودال
        this.resetAddStoryModal();
        
        // إظهار المودال
        this.addStoryModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // منع التمرير في الصفحة الخلفية
    }
    
    // إعادة تعيين مودال إضافة قصة
    resetAddStoryModal() {
        this.storyMediaInput.value = '';
        this.storyPreview.innerHTML = '<p style="color: #ccc; text-align: center;">اختر صورة أو فيديو لإضافته كقصة</p>';
        this.uploadStoryBtn.disabled = true;
        this.selectedMedia = null;
    }
    
    // عرض نافذة تسجيل الدخول
    showLoginPrompt() {
        // عرض رسالة تنبيه تطلب من المستخدم تسجيل الدخول
        Swal.fire({
            title: 'تسجيل الدخول مطلوب',
            text: 'يجب تسجيل الدخول أولاً لإضافة قصة',
            icon: 'info',
            confirmButtonText: 'تسجيل الدخول',
            showCancelButton: true,
            cancelButtonText: 'إلغاء',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#FFD700'
        }).then((result) => {
            if (result.isConfirmed) {
                // فتح نافذة تسجيل الدخول
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    }
    
    // معاينة الوسائط المختارة
    previewSelectedMedia(file) {
        if (!file) return;
        
        // التحقق من نوع الملف
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) {
            Swal.fire({
                title: 'خطأ',
                text: 'يرجى اختيار صورة أو فيديو فقط',
                icon: 'error',
                confirmButtonText: 'حسناً',
                background: '#1a1a1a',
                color: '#fff',
                confirmButtonColor: '#FFD700'
            });
            return;
        }
        
        // التحقق من حجم الملف (الحد الأقصى 10 ميجابايت)
        const maxSize = 10 * 1024 * 1024; // 10 ميجابايت
        if (file.size > maxSize) {
            Swal.fire({
                title: 'خطأ',
                text: 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)',
                icon: 'error',
                confirmButtonText: 'حسناً',
                background: '#1a1a1a',
                color: '#fff',
                confirmButtonColor: '#FFD700'
            });
            return;
        }
        
        // إنشاء URL للملف
        const fileURL = URL.createObjectURL(file);
        
        // تحديث المعاينة
        if (isImage) {
            this.storyPreview.innerHTML = `<img src="${fileURL}" alt="معاينة القصة">`;
            this.selectedMedia = {
                file: file,
                type: 'image',
                url: fileURL
            };
        } else if (isVideo) {
            this.storyPreview.innerHTML = `
                <video src="${fileURL}" controls>
                    متصفحك لا يدعم تشغيل الفيديو
                </video>
            `;
            this.selectedMedia = {
                file: file,
                type: 'video',
                url: fileURL
            };
        }
        
        // تفعيل زر الرفع
        this.uploadStoryBtn.disabled = false;
    }
    
   
// تصحيح في دالة رفع القصة
async uploadStory() {
    if (!this.selectedMedia) return;
    
    // التحقق من المستخدم الحالي
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
        this.showLoginPrompt();
        return;
    }
    
    try {
        // إظهار مؤشر التحميل
        Swal.fire({
            title: 'جاري رفع القصة...',
            text: 'يرجى الانتظار',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#1a1a1a',
            color: '#fff'
        });
        
        // رفع الملف إلى Firebase Storage
        const storageRef = firebase.storage().ref();
        const mediaId = Date.now().toString();
        const fileRef = storageRef.child(`stories/${currentUser.uid}/${mediaId}_${this.selectedMedia.file.name}`);
        
        // رفع الملف
        const uploadTask = await fileRef.put(this.selectedMedia.file);
        
        // الحصول على URL الملف
        const mediaUrl = await uploadTask.ref.getDownloadURL();
        
        // إنشاء بيانات القصة
        const storyData = {
            userId: currentUser.uid,
            userName: currentUser.fullName || currentUser.name || 'مستخدم',
            userPhoto: currentUser.photoUrl || currentUser.imageUrl || null,
            mediaType: this.selectedMedia.type,
            mediaUrl: mediaUrl,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        // حفظ البيانات في Firebase Database
        const newStoryRef = firebase.database().ref('stories').push();
        await newStoryRef.set(storyData);
        
        // إغلاق مؤشر التحميل
        Swal.close();
        
        // إظهار رسالة نجاح
        Swal.fire({
            title: 'تم بنجاح!',
            text: 'تمت إضافة القصة بنجاح',
            icon: 'success',
            confirmButtonText: 'حسناً',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#FFD700'
        });
        
        // هنا المشكلة - استخدام الدالة بشكل صحيح
        this.closeAddStoryModalMethod();
        
        // إعادة تحميل القصص
        this.loadStories();
    } catch (error) {
        console.error('خطأ في رفع القصة:', error);
        
        // إغلاق مؤشر التحميل
        Swal.close();
        
        // إظهار رسالة خطأ
        Swal.fire({
            title: 'خطأ',
            text: 'حدث خطأ أثناء رفع القصة. يرجى المحاولة مرة أخرى.',
            icon: 'error',
            confirmButtonText: 'حسناً',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#FFD700'
        });
    }
}
    
// تعديل في دالة إضافة مستمعي الأحداث
addEventListeners() {
    // زر إغلاق عارض القصص
    this.storyClose.addEventListener('click', () => {
        this.closeStoryViewer();
    });
    
    // أزرار التنقل بين القصص
    this.navPrev.addEventListener('click', () => {
        this.goToPrevStory();
    });
    
    this.navNext.addEventListener('click', () => {
        this.goToNextStory();
    });
    
    // يتبع بقية الكود...
    
    // تعديل مستمع الحدث لزر إغلاق مودال إضافة قصة
    if (this.closeAddStoryModalBtn) {
        this.closeAddStoryModalBtn.addEventListener('click', () => {
            this.closeAddStoryModalMethod();
        });
    }
    
    // بقية الكود...
}

    // إغلاق مودال إضافة القصة
    closeAddStoryModalMethod() {
        this.addStoryModal.classList.remove('active');
        document.body.style.overflow = '';
        
        // إلغاء URL الملف لتحرير الذاكرة
        if (this.selectedMedia && this.selectedMedia.url) {
            URL.revokeObjectURL(this.selectedMedia.url);
        }
        
        this.resetAddStoryModal();
    }
    
    // إضافة مستمعي الأحداث
    addEventListeners() {
        // زر إغلاق عارض القصص
        this.storyClose.addEventListener('click', () => {
            this.closeStoryViewer();
        });
        
        // أزرار التنقل بين القصص
        this.navPrev.addEventListener('click', () => {
            this.goToPrevStory();
        });
        
        this.navNext.addEventListener('click', () => {
            this.goToNextStory();
        });
        
        // إيقاف/استئناف القصص الحالية عند الضغط
        this.storyContent.addEventListener('click', (event) => {
            // تجاهل النقرات على أزرار التنقل
            if (event.target === this.navPrev || event.target === this.navNext) {
                return;
            }
            
            // التحقق مما إذا كانت القصة الحالية فيديو
            const video = this.storyContent.querySelector('video');
            if (video) {
                if (video.paused) {
                    video.play().then(() => {
                        this.isPlaying = true;
                        this.startStoryTimer();
                    }).catch(error => {
                        console.error('خطأ في تشغيل الفيديو:', error);
                    });
                } else {
                    video.pause();
                    this.isPlaying = false;
                    if (this.timer) {
                        clearTimeout(this.timer);
                    }
                }
            }
        });
        
        // مفاتيح التنقل عبر لوحة المفاتيح
        document.addEventListener('keydown', (event) => {
            // التحقق من أن عارض القصص نشط
            if (!this.storyViewer.classList.contains('active')) {
                return;
            }
            
            switch (event.key) {
                case 'ArrowLeft':
                    // بما أن التطبيق بالعربية (RTL)، نعكس الاتجاهات
                    this.goToNextStory();
                    break;
                case 'ArrowRight':
                    this.goToPrevStory();
                    break;
                case 'Escape':
                    this.closeStoryViewer();
                    break;
                case ' ': // مسافة
                    // إيقاف/استئناف الفيديو
                    const video = this.storyContent.querySelector('video');
                    if (video) {
                        if (video.paused) {
                            video.play();
                            this.isPlaying = true;
                        } else {
                            video.pause();
                            this.isPlaying = false;
                        }
                    }
                    break;
            }
        });
        
        // زر إضافة قصة جديدة
        if (this.addStoryBtn) {
            this.addStoryBtn.addEventListener('click', () => {
                this.openAddStoryModal();
            });
        }
        
        // إغلاق مودال إضافة قصة
        this.closeAddStoryModal.addEventListener('click', () => {
            this.closeAddStoryModalMethod();
        });
        
        if (this.closeAddStoryModalBtn) {
            this.closeAddStoryModalBtn.addEventListener('click', () => {
                this.closeAddStoryModalMethod();
            });
        }
        
        // اختيار ملف من الجهاز
        this.selectMediaBtn.addEventListener('click', () => {
            this.storyMediaInput.click();
        });
        
        // معالجة اختيار الملف
        this.storyMediaInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.previewSelectedMedia(file);
            }
        });
        
        // رفع القصة
        this.uploadStoryBtn.addEventListener('click', () => {
            this.uploadStory();
        });
        
        // إضافة مستمع لمعالجة السحب والإفلات للملفات
        this.storyPreview.addEventListener('dragover', (event) => {
            event.preventDefault();
            this.storyPreview.classList.add('drag-over');
        });
        
        this.storyPreview.addEventListener('dragleave', () => {
            this.storyPreview.classList.remove('drag-over');
        });
        
        this.storyPreview.addEventListener('drop', (event) => {
            event.preventDefault();
            this.storyPreview.classList.remove('drag-over');
            
            const file = event.dataTransfer.files[0];
            if (file) {
                this.previewSelectedMedia(file);
            }
        });
        
        // دعم للأجهزة اللمسية (سحايب) للتنقل بين القصص
        let touchStartX = 0;
        
        this.storyContent.addEventListener('touchstart', (event) => {
            touchStartX = event.touches[0].clientX;
        });
        
        this.storyContent.addEventListener('touchend', (event) => {
            const touchEndX = event.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;
            
            // معكوس لاتجاه RTL
            if (diffX > 50) { // سحب لليسار
                this.goToPrevStory();
            } else if (diffX < -50) { // سحب لليمين
                this.goToNextStory();
            }
        });
        
        // مراقبة تغييرات الوضع المظلم (إذا كان متاحًا)
        if (window.matchMedia) {
            const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleDarkModeChange = (e) => {
                this.updateDarkModeStyles(e.matches);
            };
            
            // التحقق أولاً
            this.updateDarkModeStyles(darkModeMediaQuery.matches);
            
            // مراقبة التغييرات
            if (darkModeMediaQuery.addEventListener) {
                darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
            } else if (darkModeMediaQuery.addListener) {
                // للمتصفحات القديمة
                darkModeMediaQuery.addListener(handleDarkModeChange);
            }
        }
        
        // إعادة تحميل القصص عند تغيير حالة تسجيل الدخول
        document.addEventListener('login-success', () => {
            this.loadStories();
        });
        
        document.addEventListener('logout-success', () => {
            this.loadStories();
        });
    }
    
    // تحديث أنماط الوضع المظلم
    updateDarkModeStyles(isDarkMode) {
        // يمكن استخدام هذه الدالة لتعديل ألوان عناصر القصص
        // استنادًا إلى وضع المتصفح
        const storyViewer = this.storyViewer;
        
        if (isDarkMode) {
            storyViewer.style.setProperty('--story-bg-color', '#000000');
            storyViewer.style.setProperty('--story-text-color', '#ffffff');
        } else {
            storyViewer.style.setProperty('--story-bg-color', '#1a1a1a');
            storyViewer.style.setProperty('--story-text-color', '#ffffff');
        }
    }
}

// إنشاء وتهيئة نظام القصص عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const storiesSystem = new StoriesSystem();
    
    // إضافة النظام إلى الكائن window للوصول إليه من أي مكان
    window.storiesSystem = storiesSystem;
    
    // تعديل ارتفاع حاوية القصص لتناسب ارتفاع الشاشة
    adjustStoriesContainerHeight();
    
    // إعادة تعديل ارتفاع الحاوية عند تغيير حجم النافذة
    window.addEventListener('resize', adjustStoriesContainerHeight);
});

// تعديل ارتفاع حاوية القصص
function adjustStoriesContainerHeight() {
    const storiesContainer = document.querySelector('.stories-container');
    if (!storiesContainer) return;
    
    // تحديد ارتفاع مناسب استنادًا إلى حجم الشاشة
    const screenWidth = window.innerWidth;
    
    if (screenWidth <= 576) {
        // للشاشات الصغيرة (الهواتف)
        storiesContainer.style.height = '100px';
    } else if (screenWidth <= 992) {
        // للشاشات المتوسطة (الأجهزة اللوحية)
        storiesContainer.style.height = '120px';
    } else {
        // للشاشات الكبيرة
        storiesContainer.style.height = '130px';
    }
}

// في المُنشئ (constructor)
this.closeAddStoryModal = document.getElementById('closeAddStoryModal');
// ثم إضافة الدالة بشكل منفصل
this.closeAddStoryModal.onclick = () => this._closeAddStoryModal();
// تعريف دالة داخلية بديلة
this._closeAddStoryModal = function() {
    this.addStoryModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // بقية الكود...
};

// في دالة addEventListeners
if (this.closeAddStoryModalBtn) {
    this.closeAddStoryModalBtn.addEventListener('click', () => {
        this.closeAddStoryModalMethod();
    });
}

// في المُنشئ (constructor)
this.closeAddStoryModalBtn = document.getElementById('closeAddStoryModal');