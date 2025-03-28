/**
 * مدير تكامل المنشورات - للربط بين صفحة المنشورات الرئيسية وصفحة المنشورات المحفوظة
 */
class PostsIntegrationManager {
    constructor() {
        this.database = firebase.database();
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.savedPostsRef = this.database.ref('savedPosts');
        this.postsRef = this.database.ref('posts');
        
        // تهيئة مدير المنشورات المحفوظة إذا لم يكن موجوداً
        if (!window.savedPostsManager) {
            window.savedPostsManager = new SavedPostsManager();
        }
        
        // إعداد المستمعات
        this.setupEventListeners();
    }

    /**
     * إعداد مستمعات الأحداث
     */
    setupEventListeners() {
        // الاستماع لأحداث حفظ المنشورات
        document.addEventListener('postSaved', (event) => {
            const { postId, saved } = event.detail;
            this.handlePostSaveEvent(postId, saved);
        });
        
        // الاستماع لتغييرات تسجيل الدخول
        document.addEventListener('userLoggedIn', (event) => {
            this.currentUser = event.detail.user;
            this.refreshSavedPostsCounter();
        });
        
        document.addEventListener('userLoggedOut', () => {
            this.currentUser = null;
        });
        
        // تحديث عداد المنشورات المحفوظة عند تحميل الصفحة
        document.addEventListener('DOMContentLoaded', () => {
            this.refreshSavedPostsCounter();
        });
    }

    /**
     * معالجة حدث حفظ المنشور
     * @param {string} postId - معرف المنشور
     * @param {boolean} saved - حالة الحفظ (محفوظ أم لا)
     */
    async handlePostSaveEvent(postId, saved) {
        if (!this.currentUser) {
            this.showLoginPrompt();
            return;
        }
        
        try {
            if (saved) {
                // حفظ المنشور
                await this.savedPostsRef.child(this.currentUser.uid).child(postId).set({
                    savedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                this.showToast('تم حفظ المنشور بنجاح');
            } else {
                // إزالة المنشور المحفوظ
                await this.savedPostsRef.child(this.currentUser.uid).child(postId).remove();
                
                this.showToast('تم إزالة المنشور من المحفوظات');
            }
            
            // تحديث عداد المنشورات المحفوظة
            this.refreshSavedPostsCounter();
            
        } catch (error) {
            console.error('Error handling post save:', error);
            this.showToast('حدث خطأ أثناء حفظ المنشور', 'error');
        }
    }

    /**
     * حفظ منشور جديد (يمكن استدعاؤها من أي مكان في التطبيق)
     * @param {string} postId - معرف المنشور المراد حفظه
     */
    async savePost(postId) {
        if (!this.currentUser) {
            this.showLoginPrompt();
            return false;
        }
        
        try {
            // التحقق من وجود المنشور
            const postSnapshot = await this.postsRef.child(postId).once('value');
            const postData = postSnapshot.val();
            
            if (!postData) {
                this.showToast('المنشور غير موجود', 'error');
                return false;
            }
            
            // إضافة المنشور إلى المحفوظات
            await this.savedPostsRef.child(this.currentUser.uid).child(postId).set({
                savedAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            // تغيير حالة زر الحفظ إن وجد
            this.updateSaveButtonState(postId, true);
            
            // تحديث العداد
            this.refreshSavedPostsCounter();
            
            this.showToast('تم حفظ المنشور بنجاح');
            return true;
            
        } catch (error) {
            console.error('Error saving post:', error);
            this.showToast('حدث خطأ أثناء حفظ المنشور', 'error');
            return false;
        }
    }

    /**
     * إزالة منشور من المحفوظات
     * @param {string} postId - معرف المنشور المراد إزالته
     */
    async removeSavedPost(postId) {
        if (!this.currentUser) {
            this.showLoginPrompt();
            return false;
        }
        
        try {
            // إزالة المنشور من المحفوظات
            await this.savedPostsRef.child(this.currentUser.uid).child(postId).remove();
            
            // تغيير حالة زر الحفظ إن وجد
            this.updateSaveButtonState(postId, false);
            
            // تحديث العداد
            this.refreshSavedPostsCounter();
            
            this.showToast('تم إزالة المنشور من المحفوظات');
            
            // إذا كنا في صفحة المنشورات المحفوظة، فقم بإزالة المنشور من العرض
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postElement && window.location.href.includes('saved-posts.html')) {
                postElement.classList.add('animate__animated', 'animate__fadeOut');
                setTimeout(() => {
                    postElement.remove();
                    
                    // التحقق مما إذا كانت القائمة فارغة
                    const savedPostsContainer = document.getElementById('savedPostsContainer');
                    if (savedPostsContainer && savedPostsContainer.children.length === 0) {
                        savedPostsContainer.innerHTML = '<p class="no-saved-posts">لا توجد منشورات محفوظة.</p>';
                    }
                }, 500);
            }
            
            return true;
            
        } catch (error) {
            console.error('Error removing saved post:', error);
            this.showToast('حدث خطأ أثناء إزالة المنشور من المحفوظات', 'error');
            return false;
        }
    }

    /**
     * تحديث حالة زر الحفظ في واجهة المستخدم
     * @param {string} postId - معرف المنشور
     * @param {boolean} isSaved - هل المنشور محفوظ؟
     */
    updateSaveButtonState(postId, isSaved) {
        const saveButton = document.querySelector(`.post[data-post-id="${postId}"] .save-post-btn`);
        if (saveButton) {
            if (isSaved) {
                saveButton.classList.add('saved');
                saveButton.innerHTML = '<i class="fas fa-bookmark"></i> تم الحفظ';
            } else {
                saveButton.classList.remove('saved');
                saveButton.innerHTML = '<i class="far fa-bookmark"></i> حفظ';
            }
        }
    }

    /**
     * التحقق مما إذا كان المنشور محفوظًا
     * @param {string} postId - معرف المنشور
     * @returns {Promise<boolean>} - هل المنشور محفوظ؟
     */
    async isPostSaved(postId) {
        if (!this.currentUser) return false;
        
        try {
            const snapshot = await this.savedPostsRef.child(this.currentUser.uid).child(postId).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking saved post:', error);
            return false;
        }
    }

    /**
     * تحديث عداد المنشورات المحفوظة في الشريط الجانبي
     */
    async refreshSavedPostsCounter() {
        if (!this.currentUser) return;
        
        try {
            const snapshot = await this.savedPostsRef.child(this.currentUser.uid).once('value');
            const savedPosts = snapshot.val() || {};
            const count = Object.keys(savedPosts).length;
            
            // تحديث العداد في رابط الشريط الجانبي
            const savedPostsLink = document.querySelector('a.side-nav-item[onclick*="loadSavedPostsPage"]');
            if (savedPostsLink) {
                let badge = savedPostsLink.querySelector('.saved-posts-badge');
                
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'saved-posts-badge';
                        savedPostsLink.appendChild(badge);
                    }
                    badge.textContent = count;
                    badge.style.display = 'inline-block';
                } else if (badge) {
                    badge.style.display = 'none';
                }
            }
            
        } catch (error) {
            console.error('Error refreshing saved posts counter:', error);
        }
    }

    /**
     * عرض نافذة منبثقة لتسجيل الدخول
     */
    showLoginPrompt() {
        Swal.fire({
            title: 'تسجيل الدخول مطلوب',
            text: 'يجب تسجيل الدخول لحفظ المنشورات',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'تسجيل الدخول',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                // فتح نافذة تسجيل الدخول
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    }

    /**
     * عرض رسالة توست
     * @param {string} message - الرسالة
     * @param {string} type - نوع الرسالة (success, error, warning, info)
     */
    showToast(message, type = 'success') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // استخدام Sweet Alert إذا لم تكن دالة showToast متاحة
            Swal.fire({
                title: type === 'error' ? 'خطأ' : 'تم',
                text: message,
                icon: type,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    }

    /**
     * تحميل المنشورات المحفوظة (يستدعى من الصفحة الرئيسية)
     * @param {HTMLElement} container - حاوية عرض المنشورات
     */
    async loadSavedPostsForMainPage(container) {
        if (!this.currentUser) {
            container.innerHTML = '<p class="no-saved-posts">يجب تسجيل الدخول لعرض المنشورات المحفوظة.</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="loading-saved-posts">
                <div class="spinner"></div>
                <p>جاري تحميل المنشورات المحفوظة...</p>
            </div>
        `;
        
        try {
            const snapshot = await this.savedPostsRef.child(this.currentUser.uid).once('value');
            const savedPosts = snapshot.val();
            
            if (!savedPosts) {
                container.innerHTML = '<p class="no-saved-posts">لا توجد منشورات محفوظة.</p>';
                return;
            }
            
            container.innerHTML = '';
            const postIds = Object.keys(savedPosts);
            
            if (postIds.length === 0) {
                container.innerHTML = '<p class="no-saved-posts">لا توجد منشورات محفوظة.</p>';
                return;
            }
            
            let loadedCount = 0;
            const maxPostsToShow = 5; // عدد المنشورات للعرض في الصفحة الرئيسية
            
            for (const postId of postIds) {
                if (loadedCount >= maxPostsToShow) break;
                
                const postSnapshot = await this.postsRef.child(postId).once('value');
                const postData = postSnapshot.val();
                
                if (postData) {
                    // استخدام AddPostToDOM من مدير المنشورات المحفوظة
                    if (window.savedPostsManager) {
                        window.savedPostsManager.addPostToDOM(postId, postData, container);
                    } else {
                        // إضافة المنشور بتنسيق بسيط إذا لم يكن المدير متاحًا
                        this.addSimplePostToDOM(postId, postData, container);
                    }
                    loadedCount++;
                }
            }
            
            // إضافة زر "عرض المزيد" إذا كان هناك المزيد من المنشورات
            if (postIds.length > maxPostsToShow) {
                const viewMoreButton = document.createElement('div');
                viewMoreButton.className = 'view-more-posts';
                viewMoreButton.innerHTML = `
                    <button class="btn btn-primary w-100" onclick="window.location.href='saved-posts.html'">
                        <i class="fas fa-chevron-down"></i> عرض المزيد (${postIds.length - maxPostsToShow} منشور آخر)
                    </button>
                `;
                container.appendChild(viewMoreButton);
            }
            
        } catch (error) {
            console.error('Error loading saved posts for main page:', error);
            container.innerHTML = '<p class="error-message">حدث خطأ أثناء تحميل المنشورات المحفوظة.</p>';
        }
    }

    /**
     * إضافة منشور بتنسيق بسيط للعرض
     * @param {string} postId - معرف المنشور
     * @param {Object} postData - بيانات المنشور
     * @param {HTMLElement} container - حاوية العرض
     */
    addSimplePostToDOM(postId, postData, container) {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.setAttribute('data-post-id', postId);
        
        const postTime = new Date(postData.timestamp).toLocaleString('ar-IQ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let mediaContent = '';
        if (postData.mediaType && postData.mediaUrl) {
            mediaContent = postData.mediaType === 'image'
                ? `<img src="${postData.mediaUrl}" alt="صورة المنشور" class="post-image">`
                : `<video src="${postData.mediaUrl}" controls class="post-video"></video>`;
        }
        
        postElement.innerHTML = `
            <div class="post-header">
                <div class="post-user">
                    <img src="${postData.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
                    <div class="post-user-info">
                        <h6>${postData.authorName}</h6>
                        <small>${postTime}</small>
                    </div>
                </div>
            </div>
            <div class="post-content">
                ${postData.text ? `<p>${postData.text}</p>` : ''}
                ${mediaContent}
            </div>
            <div class="post-actions">
                <button class="post-action-btn remove-save-btn" onclick="postsIntegrationManager.removeSavedPost('${postId}')">
                    <i class="fas fa-trash"></i> إزالة من المحفوظات
                </button>
                <button class="post-action-btn view-post-btn" onclick="window.location.href='index.html?post=${postId}'">
                    <i class="fas fa-eye"></i> عرض المنشور
                </button>
            </div>
        `;
        
        container.appendChild(postElement);
    }
}

// إنشاء نسخة عالمية من مدير تكامل المنشورات
window.postsIntegrationManager = new PostsIntegrationManager();