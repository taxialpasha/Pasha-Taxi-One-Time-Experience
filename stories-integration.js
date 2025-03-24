// تكامل القصص مع تطبيق تاكسي العراق
(function() {
    // تسجيل Service Worker لإشعارات القصص إذا كان متاحًا
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw-stories.js')
            .then(registration => {
                console.log('تم تسجيل Service Worker للقصص بنجاح:', registration);
            })
            .catch(error => {
                console.error('فشل تسجيل Service Worker للقصص:', error);
            });
    }
    
    // حفظ مشاهدات القصص في Firebase
    function saveStoryView(storyId, userId) {
        // التحقق من تسجيل الدخول
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        // إضافة المشاهدة إلى Firebase
        const viewData = {
            storyId: storyId,
            userId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        firebase.database().ref(`story_views`).push(viewData)
            .catch(error => {
                console.error('خطأ في حفظ مشاهدة القصة:', error);
            });
    }
    
    // الحصول على إحصائيات القصة
    async function getStoryStats(storyId) {
        try {
            const viewsRef = firebase.database().ref('story_views')
                .orderByChild('storyId')
                .equalTo(storyId);
            
            const snapshot = await viewsRef.once('value');
            const views = snapshot.numChildren();
            
            return {
                views: views
            };
        } catch (error) {
            console.error('خطأ في الحصول على إحصائيات القصة:', error);
            return {
                views: 0
            };
        }
    }
    
    // تحديث عرض الصفحة عند تحميل القصص
    window.addEventListener('stories-loaded', function(event) {
        // تعديل هامش المحتوى الرئيسي ليناسب وجود القصص
        adjustMainContentMargin();
    });
    
    // تعديل هامش المحتوى الرئيسي
    function adjustMainContentMargin() {
        const storiesContainer = document.querySelector('.stories-container');
        const mainContent = document.querySelector('.container');
        
        if (storiesContainer && mainContent) {
            const storiesHeight = storiesContainer.offsetHeight;
            mainContent.style.marginTop = `${storiesHeight + 10}px`;
        }
    }
    
    // استدعاء تعديل الهوامش عند تحميل الصفحة وتغيير حجم النافذة
    window.addEventListener('DOMContentLoaded', adjustMainContentMargin);
    window.addEventListener('resize', adjustMainContentMargin);
    
    // إعادة تحميل القصص بشكل دوري (كل 5 دقائق)
    let autoRefreshInterval;
    
    function startAutoRefresh() {
        // إيقاف أي تحديث سابق
        stopAutoRefresh();
        
        // بدء تحديث جديد كل 5 دقائق
        autoRefreshInterval = setInterval(() => {
            if (window.storiesSystem) {
                window.storiesSystem.loadStories();
            }
        }, 5 * 60 * 1000); // 5 دقائق
    }
    
    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    }
    
    // بدء التحديث التلقائي
    startAutoRefresh();
    
    // إيقاف التحديث التلقائي عند عدم نشاط التبويب
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // إعادة تحميل القصص وبدء التحديث التلقائي عند العودة للتبويب
            if (window.storiesSystem) {
                window.storiesSystem.loadStories();
            }
            startAutoRefresh();
        } else {
            // إيقاف التحديث التلقائي عند مغادرة التبويب
            stopAutoRefresh();
        }
    });
    
    // التكامل مع الإشعارات
    function setupStoryNotifications() {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        // الاستماع للقصص الجديدة
        firebase.database().ref('stories')
            .orderByChild('timestamp')
            .startAt(Date.now())
            .on('child_added', (snapshot) => {
                const story = snapshot.val();
                
                // تجاهل قصص المستخدم نفسه
                if (story.userId === currentUser.uid) return;
                
                // عرض إشعار بالقصة الجديدة
                showStoryNotification(story);
            });
    }
    
    // عرض إشعار بقصة جديدة
    function showStoryNotification(story) {
        // التحقق من وجود دعم للإشعارات
        if (!("Notification" in window)) return;
        
        // التحقق من إذن الإشعارات
        if (Notification.permission === "granted") {
            // إنشاء إشعار
            const notification = new Notification(`قصة جديدة من ${story.userName}`, {
                icon: story.userPhoto || '/default-avatar.png',
                body: `انقر لمشاهدة القصة ${story.mediaType === 'video' ? 'المصورة' : ''}`,
                tag: `story-${story.userId}`,
                requireInteraction: false
            });
            
            // فتح القصة عند النقر على الإشعار
            notification.onclick = function() {
                window.focus();
                if (window.storiesSystem) {
                    window.storiesSystem.openStory(story.userId);
                }
                notification.close();
            };
        }
        // طلب إذن الإشعارات إذا لم يتم البت في الإذن بعد
        else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
    
    // الحصول على المستخدم الحالي من التخزين المحلي
    function getCurrentUser() {
        try {
            const userJson = localStorage.getItem('currentUser');
            if (userJson) {
                return JSON.parse(userJson);
            }
            return null;
        } catch (error) {
            console.error('خطأ في قراءة بيانات المستخدم:', error);
            return null;
        }
    }
    
    // إعداد التكامل مع الإشعارات عند تحميل الصفحة
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setupStoryNotifications();
    } else {
        document.addEventListener('DOMContentLoaded', setupStoryNotifications);
    }
    
    // كشف وضع الشبكة وعرض إشعارات مناسبة
    window.addEventListener('online', () => {
        if (window.storiesSystem) {
            window.storiesSystem.loadStories();
        }
    });
    
    window.addEventListener('offline', () => {
        showToast('أنت حاليًا غير متصل بالإنترنت. قد لا تظهر أحدث القصص.', 'warning');
    });
    
    // تصدير الدوال المفيدة
    window.storyUtils = {
        saveStoryView,
        getStoryStats,
        showStoryNotification
    };
})();