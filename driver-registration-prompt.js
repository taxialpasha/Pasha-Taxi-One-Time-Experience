// posts.js - وحدة المنشورات لتطبيق تاكسي العراق (نسخة معدلة)

class PostsManager {
    constructor() {
        this.database = firebase.database();
        this.storage = firebase.storage();
        this.currentUser = null;
        this.postsRef = this.database.ref('posts');
        this.likesRef = this.database.ref('likes');
        this.commentsRef = this.database.ref('comments');
        this.savedPostsRef = this.database.ref('savedPosts');
        this.maxCommentLength = 1000;
        this.postsPerPage = 10;
        this.lastVisiblePost = null;
        this.isLoading = false;
        this.noMorePosts = false;
    }

    // التحقق ما إذا كان المستخدم قد أعجب بالمنشور
    async checkIfLiked(postId, userId) {
        try {
            const snapshot = await this.likesRef.child(postId).child(userId).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking if post is liked:', error);
            return false;
        }
    }
    
    // التحقق ما إذا كان المستخدم قد حفظ المنشور
    async checkIfSaved(postId, userId) {
        try {
            const snapshot = await this.savedPostsRef.child(userId).child(postId).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking if post is saved:', error);
            return false;
        }
    }
    
    // تبديل حالة الإعجاب
    async toggleLike(postId) {
        if (!this.currentUser) {
            Swal.fire({
                title: 'مطلوب تسجيل الدخول',
                text: 'يجب عليك تسجيل الدخول أولاً للتفاعل مع المنشورات',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'تسجيل الدخول',
                cancelButtonText: 'إلغاء'
            }).then((result) => {
                if (result.isConfirmed) {
                    openLoginModal();
                }
            });
            return;
        }
        
        try {
            const userId = this.currentUser.uid;
            const likeRef = this.likesRef.child(postId).child(userId);
            const postRef = this.postsRef.child(postId);
            
            // تحقق مما إذا كان المستخدم قد أعجب بالفعل
            const snapshot = await likeRef.once('value');
            const isLiked = snapshot.exists();
            
            // تحديث عدد الإعجابات والمرجع
            await firebase.database().ref().transaction(function(current) {
                // إذا لم يكن المنشور موجوداً، لا تفعل شيئاً
                if (!current || !current.posts || !current.posts[postId]) {
                    return current;
                }
                
                // تحديث عدد الإعجابات
                if (isLiked) {
                    // إزالة الإعجاب
                    current.posts[postId].likes--;
                    if (current.likes && current.likes[postId] && current.likes[postId][userId]) {
                        current.likes[postId][userId] = null;
                    }
                } else {
                    // إضافة إعجاب
                    current.posts[postId].likes++;
                    if (!current.likes) current.likes = {};
                    if (!current.likes[postId]) current.likes[postId] = {};
                    current.likes[postId][userId] = true;
                }
                
                return current;
            });
            
            // تحديث واجهة المستخدم
            const likeButton = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
            const likesCount = document.getElementById(`likes-count-${postId}`);
            
            if (likeButton) {
                if (isLiked) {
                    likeButton.classList.remove('active');
                    likeButton.querySelector('i').classList.remove('fas');
                    likeButton.querySelector('i').classList.add('far');
                } else {
                    likeButton.classList.add('active');
                    likeButton.querySelector('i').classList.remove('far');
                    likeButton.querySelector('i').classList.add('fas');
                    
                    // إضافة تأثير النبض عند الإعجاب
                    const heart = document.createElement('div');
                    heart.className = 'heart-animation';
                    likeButton.appendChild(heart);
                    setTimeout(() => heart.remove(), 1000);
                }
            }
            
            if (likesCount) {
                const currentLikes = parseInt(likesCount.textContent);
                likesCount.textContent = isLiked ? currentLikes - 1 : currentLikes + 1;
            }
            
        } catch (error) {
            console.error('Error toggling like:', error);
            showToast('حدث خطأ أثناء تسجيل الإعجاب', 'error');
        }
    }
    
    // تبديل حالة الحفظ
    async toggleSave(postId) {
        if (!this.currentUser) {
            Swal.fire({
                title: 'مطلوب تسجيل الدخول',
                text: 'يجب عليك تسجيل الدخول أولاً للتفاعل مع المنشورات',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'تسجيل الدخول',
                cancelButtonText: 'إلغاء'
            }).then((result) => {
                if (result.isConfirmed) {
                    openLoginModal();
                }
            });
            return;
        }
        
        try {
            const userId = this.currentUser.uid;
            const savedRef = this.savedPostsRef.child(userId).child(postId);
            
            // تحقق مما إذا كان المنشور محفوظاً بالفعل
            const snapshot = await savedRef.once('value');
            const isSaved = snapshot.exists();
            
            if (isSaved) {
                // إزالة من المحفوظات
                await savedRef.remove();
            } else {
                // إضافة إلى المحفوظات
                await savedRef.set(true);
            }
            
            // تحديث واجهة المستخدم
            const saveButton = document.querySelector(`.save-btn[data-post-id="${postId}"]`);
            
            if (saveButton) {
                if (isSaved) {
                    saveButton.classList.remove('active');
                    saveButton.querySelector('i').classList.remove('fas');
                    saveButton.querySelector('i').classList.add('far');
                    showToast('تمت إزالة المنشور من المحفوظات', 'info');
                } else {
                    saveButton.classList.add('active');
                    saveButton.querySelector('i').classList.remove('far');
                    saveButton.querySelector('i').classList.add('fas');
                    showToast('تم حفظ المنشور', 'success');
                }
            }
            
        } catch (error) {
            console.error('Error toggling save:', error);
            showToast('حدث خطأ أثناء حفظ المنشور', 'error');
        }
    }
    
    // مشاركة المنشور
    // تحديث عدد المشاركات
    async updateShareCount(postId) {
        try {
            await this.postsRef.child(postId).transaction(post => {
                if (post) {
                    post.shares = (post.shares || 0) + 1;
                }
                return post;
            });
            
            // تحديث واجهة المستخدم
            const shareCountElement = document.querySelector(`.post[data-post-id="${postId}"] .post-comments-shares span:last-child`);
            if (shareCountElement) {
                const currentShares = parseInt(shareCountElement.textContent);
                shareCountElement.textContent = `${currentShares + 1} مشاركة`;
            }
        } catch (error) {
            console.error('Error updating share count:', error);
        }
    }
    
    // مشاركة عبر واتساب
    shareViaWhatsApp(postId) {
        const postUrl = `${window.location.origin}/post/${postId}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(postUrl)}`, '_blank');
    }
    
    // مشاركة عبر فيسبوك
    shareViaFacebook(postId) {
        const postUrl = `${window.location.origin}/post/${postId}`;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`, '_blank');
    }
    
    // مشاركة عبر تويتر
    shareViaTwitter(postId) {
        const postUrl = `${window.location.origin}/post/${postId}`;
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}`, '_blank');
    }
    
    // مشاركة عبر تيليجرام
    shareViaTelegram(postId) {
        const postUrl = `${window.location.origin}/post/${postId}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}`, '_blank');
    }
    
    // نسخ رابط المنشور
    copyPostLink(postId) {
        const postUrl = `${window.location.origin}/post/${postId}`;
        navigator.clipboard.writeText(postUrl).then(() => {
            Swal.close();
            showToast('تم نسخ رابط المنشور', 'success');
        });
    }
    
    // تحميل التعليقات
    async loadComments(postId) {
        const commentsContainer = document.getElementById('commentsContainer');
        const noComments = document.getElementById('noComments');
        
        if (!commentsContainer) return;
        
        // إعداد حاوية التعليقات
        commentsContainer.innerHTML = '<div class="loading-comments"><div class="spinner"></div></div>';
        commentsContainer.setAttribute('data-post-id', postId);
        
        try {
            // استعلام للحصول على آخر 50 تعليق
            const snapshot = await this.database.ref(`comments/${postId}`)
                .orderByChild('timestamp')
                .limitToLast(50)
                .once('value');
                
            // إزالة مؤشر التحميل
            commentsContainer.innerHTML = '';
            
            // التحقق من وجود تعليقات
            const commentsExist = snapshot.exists();
            
            if (commentsExist) {
                if (noComments) noComments.style.display = 'none';
                
                // تجميع التعليقات
                const comments = [];
                snapshot.forEach(childSnapshot => {
                    comments.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                
                // عرض التعليقات بترتيب تصاعدي
                comments.forEach(comment => {
                    this.addCommentToDOM(comment, commentsContainer);
                });
            } else {
                if (noComments) noComments.style.display = 'block';
                commentsContainer.appendChild(noComments);
            }
            
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsContainer.innerHTML = '<div class="error-loading">حدث خطأ أثناء تحميل التعليقات.</div>';
        }
    }
    
    // إضافة تعليق إلى DOM
    addCommentToDOM(comment, container) {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.setAttribute('data-comment-id', comment.id);
        
        // تنسيق وقت التعليق
        const commentTime = this.formatPostTime(comment.timestamp);
        
        // إنشاء HTML للتعليق
        commentElement.innerHTML = `
        <img src="${comment.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="comment-avatar">
        <div class="comment-content">
            <div class="comment-bubble">
                <h6>${comment.authorName}</h6>
                <p>${this.formatPostText(comment.text)}</p>
            </div>
            <div class="comment-actions">
                <button class="comment-action like-comment" data-comment-id="${comment.id}">إعجاب</button>
                <button class="comment-action reply-comment" data-comment-id="${comment.id}">رد</button>
                <small class="comment-time">${commentTime}</small>
            </div>
        </div>
        `;
        
        // إضافة التعليق إلى الحاوية
        container.appendChild(commentElement);
    }
    
    // إضافة تعليق جديد
    async addComment(postId, commentText) {
        if (!this.currentUser) {
            showToast('يجب تسجيل الدخول للتعليق', 'error');
            return;
        }
        
        if (!commentText || commentText.length > this.maxCommentLength) {
            showToast(`يجب أن يكون التعليق بين 1 و ${this.maxCommentLength} حرف`, 'warning');
            return;
        }
        
        try {
            // إنشاء بيانات التعليق
            const commentData = {
                text: commentText,
                authorId: this.currentUser.uid,
                authorName: this.currentUser.fullName || this.currentUser.name || 'مستخدم',
                authorImage: this.currentUser.photoUrl || null,
                authorRole: this.currentUser.role || 'user', // إضافة دور المستخدم
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                likes: 0
            };
            
            // إضافة التعليق إلى قاعدة البيانات
            const newCommentRef = this.database.ref(`comments/${postId}`).push();
            await newCommentRef.set(commentData);
            
            // تحديث عدد التعليقات في المنشور
            await this.postsRef.child(postId).transaction(post => {
                if (post) {
                    post.comments = (post.comments || 0) + 1;
                }
                return post;
            });
            
            // تحديث واجهة المستخدم
            commentData.id = newCommentRef.key;
            
            // إضافة التعليق إلى DOM
            const commentsContainer = document.getElementById('commentsContainer');
            const noComments = document.getElementById('noComments');
            
            if (commentsContainer) {
                if (noComments && noComments.style.display !== 'none') {
                    noComments.style.display = 'none';
                }
                
                this.addCommentToDOM(commentData, commentsContainer);
                
                // تمرير للأسفل لعرض التعليق الجديد
                commentsContainer.scrollTop = commentsContainer.scrollHeight;
            }
            
            // تحديث عدد التعليقات في المنشور
            const commentsCount = document.getElementById(`comments-count-${postId}`);
            if (commentsCount) {
                const currentComments = parseInt(commentsCount.textContent);
                commentsCount.textContent = `${currentComments + 1} تعليق`;
            }
            
        } catch (error) {
            console.error('Error adding comment:', error);
            showToast('حدث خطأ أثناء إضافة التعليق', 'error');
        }
    }
}

// إنشاء نسخة عالمية من مدير المنشورات
window.postsManager = new PostsManager();

// تهيئة مدير المنشورات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.postsManager.init();
});
        Swal.fire({
            title: 'مشاركة المنشور',
            html: `
            <div class="share-options">
                <button class="share-option" onclick="postsManager.shareViaWhatsApp('${postId}')">
                    <i class="fab fa-whatsapp"></i>
                    <span>WhatsApp</span>
                </button>
                <button class="share-option" onclick="postsManager.shareViaFacebook('${postId}')">
                    <i class="fab fa-facebook"></i>
                    <span>Facebook</span>
                </button>
                <button class="share-option" onclick="postsManager.shareViaTwitter('${postId}')">
                    <i class="fab fa-twitter"></i>
                    <span>Twitter</span>
                </button>
                <button class="share-option" onclick="postsManager.shareViaTelegram('${postId}')">
                    <i class="fab fa-telegram"></i>
                    <span>Telegram</span>
                </button>
                <button class="share-option" onclick="postsManager.copyPostLink('${postId}')">
                    <i class="fas fa-link"></i>
                    <span>نسخ الرابط</span>
                </button>
            </div>
            `,
            showConfirmButton: false,
            showCloseButton: true
        });
        
        // تحديث عدد المشاركات
        this.updateShareCount(postId);
    }

    // تهيئة مدير المنشورات
    init() {
        // التحقق من المستخدم الحالي
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }

        // تهيئة عنصر واجهة منشئ المنشورات
        this.initPostCreator();
        
        // تحميل المنشورات الأولية
        this.loadInitialPosts();
        
        // إضافة مستمع للتمرير لتحميل المزيد من المنشورات
        this.setupInfiniteScroll();

        // مراقبة تغييرات المستخدم
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.database.ref(`users/${user.uid}`).once('value').then(snapshot => {
                    const userData = snapshot.val();
                    if (userData) {
                        this.currentUser = { ...userData, uid: user.uid };
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    }
            
        } catch (error) {
            console.error('Error loading more posts:', error);
            showToast('حدث خطأ أثناء تحميل المزيد من المنشورات', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // إضافة منشور إلى DOM
    addPostToDOM(postId, postData) {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;
        
        // إنشاء عنصر المنشور
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.setAttribute('data-post-id', postId);
        
        // تنسيق الوقت
        const postTime = this.formatPostTime(postData.timestamp);
        
        // التحقق من حالة الإعجاب
        let isLiked = false;
        let isSaved = false;
        
        if (this.currentUser) {
            // يجب استدعاء هذه الدوال بشكل غير متزامن لتحديث واجهة المستخدم لاحقاً
            this.checkIfLiked(postId, this.currentUser.uid).then(result => {
                isLiked = result;
                const likeButton = postElement.querySelector('.like-btn');
                if (likeButton) {
                    if (isLiked) {
                        likeButton.classList.add('active');
                        likeButton.querySelector('i').classList.remove('far');
                        likeButton.querySelector('i').classList.add('fas');
                    }
                }
            });
            
            this.checkIfSaved(postId, this.currentUser.uid).then(result => {
                isSaved = result;
                const saveButton = postElement.querySelector('.save-btn');
                if (saveButton) {
                    if (isSaved) {
                        saveButton.classList.add('active');
                        saveButton.querySelector('i').classList.remove('far');
                        saveButton.querySelector('i').classList.add('fas');
                    }
                }
            });
        }
        
        // إنشاء محتوى المنشور
        let mediaContent = '';
        if (postData.mediaType && postData.mediaUrl) {
            if (postData.mediaType === 'image') {
                mediaContent = `
                <div class="post-media">
                    <img src="${postData.mediaUrl}" alt="صورة المنشور" class="post-image">
                </div>
                `;
            } else if (postData.mediaType === 'video') {
                mediaContent = `
                <div class="post-media">
                    <video src="${postData.mediaUrl}" controls class="post-video"></video>
                </div>
                `;
            }
        }
        
        // إضافة شارة السائق
        const driverBadge = postData.authorRole === 'driver' ? 
            `<span class="driver-badge"><i class="fas fa-car"></i> سائق</span>` : '';
        
        // إضافة معلومات المركبة إذا كان السائق ولديه معلومات مركبة
        let vehicleInfo = '';
        if (postData.authorRole === 'driver' && postData.vehicleInfo) {
            vehicleInfo = `
            <div class="vehicle-info">
                <i class="fas fa-car-side"></i>
                <span>${postData.vehicleInfo.model || ''} ${postData.vehicleInfo.year || ''}</span>
                ${postData.vehicleInfo.plate ? `<span>رقم اللوحة: ${postData.vehicleInfo.plate}</span>` : ''}
            </div>
            `;
        }
        
        // إنشاء HTML للمنشور
        postElement.innerHTML = `
        <div class="post-header">
            <div class="post-user">
                <img src="${postData.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
                <div class="post-user-info">
                    <h6>${postData.authorName} ${driverBadge}</h6>
                    <small>${postTime} <i class="fas fa-globe-asia fa-sm"></i></small>
                    ${vehicleInfo}
                </div>
            </div>
            <div class="post-options">
                <button class="post-options-btn">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div class="post-options-menu">
                    <button class="post-option-item">
                        <i class="fas fa-bookmark"></i> حفظ المنشور
                    </button>
                    <button class="post-option-item">
                        <i class="fas fa-bell-slash"></i> إيقاف التنبيهات
                    </button>
                    <button class="post-option-item">
                        <i class="fas fa-flag"></i> الإبلاغ عن المنشور
                    </button>
                </div>
            </div>
        </div>
        
        <div class="post-content">
            ${postData.text ? `<p class="post-text">${this.formatPostText(postData.text)}</p>` : ''}
            ${mediaContent}
        </div>
        
        <div class="post-stats">
            <div class="post-likes">
                <i class="fas fa-heart"></i>
                <span id="likes-count-${postId}">${postData.likes || 0}</span>
            </div>
            <div class="post-comments-shares">
                <span id="comments-count-${postId}">${postData.comments || 0} تعليق</span>
                <span>${postData.shares || 0} مشاركة</span>
            </div>
        </div>
        
        <div class="post-actions">
            <button class="post-action-btn like-btn" data-post-id="${postId}" onclick="postsManager.toggleLike('${postId}')">
                <i class="far fa-heart"></i>
                <span>إعجاب</span>
            </button>
            <button class="post-action-btn comment-btn" data-post-id="${postId}" data-bs-toggle="modal" data-bs-target="#commentsModal">
                <i class="far fa-comment"></i>
                <span>تعليق</span>
            </button>
            <button class="post-action-btn share-btn" data-post-id="${postId}" onclick="postsManager.sharePost('${postId}')">
                <i class="far fa-share-square"></i>
                <span>مشاركة</span>
            </button>
            <button class="post-action-btn save-btn" data-post-id="${postId}" onclick="postsManager.toggleSave('${postId}')">
                <i class="far fa-bookmark"></i>
                <span>حفظ</span>
            </button>
        </div>
        `;
        
        // إضافة المنشور إلى الحاوية
        const loadingEl = postsContainer.querySelector('.loading-posts');
        if (loadingEl) {
            postsContainer.insertBefore(postElement, loadingEl);
        } else {
            postsContainer.appendChild(postElement);
        }
        
        // إضافة معالج النقر لخيارات المنشور
        const optionsBtn = postElement.querySelector('.post-options-btn');
        const optionsMenu = postElement.querySelector('.post-options-menu');
        
        if (optionsBtn && optionsMenu) {
            optionsBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                optionsMenu.classList.toggle('active');
            });
            
            document.addEventListener('click', (event) => {
                if (!optionsBtn.contains(event.target) && !optionsMenu.contains(event.target)) {
                    optionsMenu.classList.remove('active');
                }
            });
        }
    }
    
    // تنسيق نص المنشور
    formatPostText(text) {
        // تحويل الروابط إلى روابط قابلة للنقر
        let formattedText = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // تحويل الهاشتاغات إلى روابط
        formattedText = formattedText.replace(/#(\w+)/g, '<a href="#" class="hashtag">#$1</a>');
        
        // تحويل المنشنات إلى روابط
        formattedText = formattedText.replace(/@(\w+)/g, '<a href="#" class="mention">@$1</a>');
        
        // تحويل العودات السطرية إلى <br>
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        return formattedText;
    }
    
    // تنسيق وقت المنشور
    formatPostTime(timestamp) {
        if (!timestamp) return 'الآن';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        // أقل من دقيقة
        if (diff < 60 * 1000) {
            return 'الآن';
        }
        
        // أقل من ساعة
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `منذ ${minutes} دقيقة${minutes > 2 ? '' : ''}`;
        }
        
        // أقل من يوم
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `منذ ${hours} ساعة${hours > 2 ? 'ات' : ''}`;
        }
        
        // أقل من أسبوع
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `منذ ${days} يوم${days > 1 ? '' : ''}`;
        }
        
        // تاريخ كامل
        const date = new Date(timestamp);
        return date.toLocaleDateString('ar-IQ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
                    this.updatePostCreatorVisibility();
                });
            } else {
                this.currentUser = null;
                localStorage.removeItem('currentUser');
                this.updatePostCreatorVisibility();
            }
        });
    }

    // التحقق مما إذا كان المستخدم سائقًا
    isDriver() {
        return this.currentUser && this.currentUser.role === 'driver';
    }

    // تهيئة مكون إنشاء المنشورات
    initPostCreator() {
        // إنشاء عنصر منشئ المنشورات وإضافته للـ DOM
        const postCreatorHTML = `
        <div class="post-creator">
            <div class="post-creator-header">
                <img src="${this.currentUser?.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                     alt="صورة المستخدم" class="post-creator-avatar">
                <div class="post-creator-text" id="postCreatorTrigger">ماذا تريد أن تشارك اليوم؟</div>
            </div>
            <div class="post-creator-actions">
                <button class="post-action" id="uploadPhotoBtn">
                    <i class="fas fa-image"></i>
                    <span>صورة</span>
                </button>
                <button class="post-action" id="uploadVideoBtn">
                    <i class="fas fa-video"></i>
                    <span>فيديو</span>
                </button>
                <button class="post-action">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>موقع</span>
                </button>
            </div>
        </div>
        `;

        // إنشاء عنصر المنشورات وإضافته إلى DOM
        const postsContainer = `
        <div class="posts-container" id="postsContainer">
            <!-- سيتم تحميل المنشورات هنا بشكل ديناميكي -->
            <div class="loading-posts" id="postsLoading">
                <div class="spinner"></div>
                <p>جاري تحميل المنشورات...</p>
            </div>
            <div class="no-posts" id="noPosts" style="display: none;">
                <i class="far fa-newspaper fa-4x"></i>
                <p>لا توجد منشورات بعد.</p>
                <p>كن أول من يشارك منشوراً!</p>
            </div>
        </div>
        `;

        // إنشاء نافذة إنشاء المنشور المنبثقة
        const createPostModalHTML = `
        <div class="modal fade" id="createPostModal" tabindex="-1" aria-labelledby="createPostModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="createPostModalLabel">إنشاء منشور جديد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button>
                    </div>
                    <div class="modal-body">
                        <div class="create-post-container">
                            <div class="create-post-user">
                                <img src="${this.currentUser?.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                                     alt="صورة المستخدم" class="create-post-avatar">
                                <div class="create-post-user-info">
                                    <h6>${this.currentUser?.fullName || this.currentUser?.name || 'سائق'}</h6>
                                    <span class="post-privacy">
                                        <i class="fas fa-globe-asia"></i> عام
                                    </span>
                                </div>
                            </div>
                            <div class="create-post-content">
                                <textarea id="postText" class="create-post-textarea" placeholder="ماذا تريد أن تشارك اليوم؟"
                                          rows="4"></textarea>
                                <div id="mediaPreviewContainer" class="media-preview-container" style="display: none;"></div>
                                <input type="file" id="postMediaInput" accept="image/*,video/*" style="display: none;">
                            </div>
                            <div class="create-post-options">
                                <p>إضافة إلى منشورك</p>
                                <div class="post-options-buttons">
                                    <button type="button" id="addPhotoBtn" class="post-option-btn" onclick="document.getElementById('postMediaInput').click()">
                                        <i class="fas fa-image"></i>
                                        <span>صورة/فيديو</span>
                                    </button>
                                    <button type="button" class="post-option-btn">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span>موقع</span>
                                    </button>
                                    <button type="button" class="post-option-btn">
                                        <i class="fas fa-tag"></i>
                                        <span>وسم أصدقاء</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" id="publishPostBtn" class="btn btn-gold" disabled>نشر</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        // إنشاء نافذة التعليقات المنبثقة
        const commentsModalHTML = `
        <div class="modal fade" id="commentsModal" tabindex="-1" aria-labelledby="commentsModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="commentsModalLabel">التعليقات</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="comments-container" id="commentsContainer">
                            <!-- ستظهر التعليقات هنا -->
                            <div class="no-comments" id="noComments">
                                <p>لا توجد تعليقات بعد. كن أول من يعلق!</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="comment-input-container w-100">
                            <img src="${this.currentUser?.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                                 alt="صورة المستخدم" class="comment-avatar">
                            <input type="text" id="commentInput" class="comment-input" placeholder="أضف تعليقًا...">
                            <button id="sendCommentBtn" class="send-comment-btn" disabled>
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

        // إضافة العناصر إلى الصفحة
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            // إنشاء قسم المنشورات
            const postsSection = document.createElement('div');
            postsSection.className = 'posts-section';
            postsSection.innerHTML = postCreatorHTML + postsContainer;
            
            // إضافة قسم المنشورات بعد قسم القصص
            const storiesContainer = document.querySelector('.stories-container');
            if (storiesContainer) {
                storiesContainer.insertAdjacentElement('afterend', postsSection);
            } else {
                mainContainer.prepend(postsSection);
            }
            
            // إضافة النوافذ المنبثقة إلى نهاية الصفحة
            document.body.insertAdjacentHTML('beforeend', createPostModalHTML + commentsModalHTML);
            
            // تهيئة معالجات الأحداث
            this.setupEventListeners();
            
            // تحديث حالة عرض منشئ المنشورات
            this.updatePostCreatorVisibility();
        }
    }

    // تهيئة معالجات الأحداث
    setupEventListeners() {
        // النقر على منشئ المنشورات
        const postCreatorTrigger = document.getElementById('postCreatorTrigger');
        const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
        const uploadVideoBtn = document.getElementById('uploadVideoBtn');
        
        if (postCreatorTrigger) {
            postCreatorTrigger.addEventListener('click', () => this.openPostCreator());
        }
        
        if (uploadPhotoBtn) {
            uploadPhotoBtn.addEventListener('click', () => this.openPostCreator('photo'));
        }
        
        if (uploadVideoBtn) {
            uploadVideoBtn.addEventListener('click', () => this.openPostCreator('video'));
        }
        
        // معالجة حدث تغيير الوسائط
        const postMediaInput = document.getElementById('postMediaInput');
        if (postMediaInput) {
            postMediaInput.addEventListener('change', (e) => this.handleMediaChange(e));
        }
        
        // زر نشر المنشور
        const publishPostBtn = document.getElementById('publishPostBtn');
        if (publishPostBtn) {
            publishPostBtn.addEventListener('click', () => this.createPost());
        }
        
        // نص المنشور
        const postText = document.getElementById('postText');
        if (postText) {
            postText.addEventListener('input', () => {
                if (publishPostBtn) {
                    const hasText = postText.value.trim().length > 0;
                    const hasMedia = document.getElementById('mediaPreviewContainer').children.length > 0;
                    publishPostBtn.disabled = !(hasText || hasMedia);
                }
            });
        }
        
        // زر إرسال التعليق
        const sendCommentBtn = document.getElementById('sendCommentBtn');
        const commentInput = document.getElementById('commentInput');
        
        if (commentInput) {
            commentInput.addEventListener('input', () => {
                if (sendCommentBtn) {
                    sendCommentBtn.disabled = commentInput.value.trim().length === 0;
                }
            });
            
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && commentInput.value.trim().length > 0) {
                    if (sendCommentBtn && !sendCommentBtn.disabled) {
                        sendCommentBtn.click();
                    }
                }
            });
        }
        
        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', () => {
                const postId = document.getElementById('commentsContainer').getAttribute('data-post-id');
                this.addComment(postId, commentInput.value.trim());
                commentInput.value = '';
                sendCommentBtn.disabled = true;
            });
        }
        
        // فتح نافذة التعليقات عندما تُعرض
        const commentsModal = document.getElementById('commentsModal');
        if (commentsModal) {
            commentsModal.addEventListener('show.bs.modal', (event) => {
                const button = event.relatedTarget;
                const postId = button.getAttribute('data-post-id');
                this.loadComments(postId);
            });
        }
    }

    // إعداد التمرير اللانهائي
    setupInfiniteScroll() {
        window.addEventListener('scroll', () => {
            // التحقق من وصول التمرير إلى أسفل الصفحة وعدم تحميل المزيد حالياً
            if (
                window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
                !this.isLoading &&
                !this.noMorePosts
            ) {
                this.loadMorePosts();
            }
        });
    }

    // تحديث ظهور منشئ المنشورات
    updatePostCreatorVisibility() {
        const postCreator = document.querySelector('.post-creator');
        if (postCreator) {
            // إظهار أو إخفاء منشئ المنشورات بناءً على ما إذا كان المستخدم سائقًا
            if (this.isDriver()) {
                postCreator.style.display = 'block';
                
                // تحديث معلومات المستخدم في منشئ المنشورات
                const avatar = postCreator.querySelector('.post-creator-avatar');
                if (avatar) {
                    avatar.src = this.currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
                }
            } else {
                postCreator.style.display = 'none';
            }
        }
        
        // تحديث معلومات المستخدم في نافذة إنشاء المنشورات المنبثقة
        const createPostUser = document.querySelector('.create-post-user');
        if (createPostUser && this.currentUser) {
            const avatar = createPostUser.querySelector('.create-post-avatar');
            const userName = createPostUser.querySelector('h6');
            
            if (avatar) {
                avatar.src = this.currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
            }
            
            if (userName) {
                userName.textContent = this.currentUser.fullName || this.currentUser.name || 'سائق';
            }
        }
        
        // تحديث أيقونة التعليق
        const commentAvatar = document.querySelector('.comment-avatar');
        if (commentAvatar && this.currentUser) {
            commentAvatar.src = this.currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
        }
    }

    // فتح منشئ المنشورات
    openPostCreator(mediaType = null) {
        if (!this.currentUser) {
            Swal.fire({
                title: 'مطلوب تسجيل الدخول',
                text: 'يجب عليك تسجيل الدخول أولاً لمشاركة المنشورات',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'تسجيل الدخول',
                cancelButtonText: 'إلغاء'
            }).then((result) => {
                if (result.isConfirmed) {
                    openLoginModal();
                }
            });
            return;
        }
        
        // التحقق مما إذا كان المستخدم سائقًا
        if (!this.isDriver()) {
            Swal.fire({
                title: 'غير مسموح',
                text: 'يُسمح فقط للسائقين بإنشاء منشورات جديدة',
                icon: 'warning',
                confirmButtonText: 'حسنًا'
            });
            return;
        }
        
        // فتح النافذة المنبثقة
        const createPostModal = new bootstrap.Modal(document.getElementById('createPostModal'));
        createPostModal.show();
        
        // التركيز على حقل النص
        setTimeout(() => {
            document.getElementById('postText').focus();
        }, 500);
        
        // فتح مستعرض الملفات إذا كان نوع الوسائط محدداً
        if (mediaType) {
            setTimeout(() => {
                if (mediaType === 'photo') {
                    const fileInput = document.getElementById('postMediaInput');
                    if (fileInput) {
                        fileInput.setAttribute('accept', 'image/*');
                        fileInput.click();
                    }
                } else if (mediaType === 'video') {
                    const fileInput = document.getElementById('postMediaInput');
                    if (fileInput) {
                        fileInput.setAttribute('accept', 'video/*');
                        fileInput.click();
                    }
                }
            }, 700);
        }
    }

    // معالجة اختيار ملف وسائط
    handleMediaChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const mediaPreviewContainer = document.getElementById('mediaPreviewContainer');
        const publishPostBtn = document.getElementById('publishPostBtn');
        
        // حد الحجم (10 ميجابايت)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            Swal.fire({
                title: 'الملف كبير جداً',
                text: 'يجب أن يكون حجم الملف أقل من 10 ميجابايت',
                icon: 'error'
            });
            return;
        }
        
        // إظهار معاينة الوسائط
        mediaPreviewContainer.innerHTML = '';
        mediaPreviewContainer.style.display = 'block';
        
        if (file.type.startsWith('image/')) {
            // إنشاء معاينة للصورة
            const img = document.createElement('img');
            img.className = 'media-preview-image';
            mediaPreviewContainer.appendChild(img);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            // إنشاء معاينة للفيديو
            const video = document.createElement('video');
            video.className = 'media-preview-video';
            video.controls = true;
            mediaPreviewContainer.appendChild(video);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                video.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // إضافة زر إزالة
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => {
            mediaPreviewContainer.innerHTML = '';
            mediaPreviewContainer.style.display = 'none';
            event.target.value = '';
            
            // تحديث حالة زر النشر
            const postText = document.getElementById('postText');
            if (publishPostBtn && postText) {
                publishPostBtn.disabled = postText.value.trim().length === 0;
            }
        });
        mediaPreviewContainer.appendChild(removeBtn);
        
        // تمكين زر النشر
        if (publishPostBtn) {
            publishPostBtn.disabled = false;
        }
    }

    // إنشاء منشور جديد
    async createPost() {
        if (!this.currentUser) {
            showToast('يجب تسجيل الدخول لنشر منشور', 'error');
            return;
        }
        
        // التحقق مما إذا كان المستخدم سائقًا
        if (!this.isDriver()) {
            showToast('يُسمح فقط للسائقين بإنشاء منشورات', 'error');
            return;
        }
        
        try {
            const textEl = document.getElementById('postText');
            const mediaInput = document.getElementById('postMediaInput');
            const text = textEl.value.trim();
            const mediaFile = mediaInput.files[0];
            
            if (!text && !mediaFile) {
                showToast('يجب كتابة نص أو إضافة وسائط للمنشور', 'warning');
                return;
            }
            
            // عرض مؤشر التحميل
            Swal.fire({
                title: 'جاري النشر',
                text: 'يرجى الانتظار...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // إنشاء بيانات المنشور الأساسية
            const postData = {
                text: text,
                authorId: this.currentUser.uid,
                authorName: this.currentUser.fullName || this.currentUser.name || 'سائق',
                authorImage: this.currentUser.photoUrl || null,
                authorRole: 'driver', // إضافة دور السائق للمنشور
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                likes: 0,
                comments: 0,
                shares: 0,
                mediaType: null,
                mediaUrl: null,
                vehicleInfo: this.currentUser.vehicleInfo || null // إضافة معلومات المركبة إذا كانت متوفرة
            };
            
            // إذا كان هناك ملف وسائط، قم برفعه
            if (mediaFile) {
                const mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
                postData.mediaType = mediaType;
                
                // إنشاء مرجع في التخزين
                const fileRef = this.storage.ref(`posts/${Date.now()}_${mediaFile.name}`);
                const uploadTask = await fileRef.put(mediaFile);
                const downloadUrl = await uploadTask.ref.getDownloadURL();
                
                postData.mediaUrl = downloadUrl;
            }
            
            // إنشاء مرجع جديد للمنشور وإضافة البيانات
            const newPostRef = this.postsRef.push();
            await newPostRef.set(postData);
            
            // إغلاق النافذة المنبثقة وإعادة تعيين النموذج
            const modal = bootstrap.Modal.getInstance(document.getElementById('createPostModal'));
            modal.hide();
            
            // إعادة تعيين عناصر النموذج
            textEl.value = '';
            mediaInput.value = '';
            document.getElementById('mediaPreviewContainer').innerHTML = '';
            document.getElementById('mediaPreviewContainer').style.display = 'none';
            document.getElementById('publishPostBtn').disabled = true;
            
            // عرض رسالة النجاح
            Swal.fire({
                title: 'تم النشر!',
                text: 'تم نشر المنشور بنجاح',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // إضافة المنشور الجديد إلى القائمة
            this.addPostToDOM(newPostRef.key, postData);
            
        } catch (error) {
            console.error('Error creating post:', error);
            Swal.fire({
                title: 'خطأ',
                text: 'حدث خطأ أثناء نشر المنشور. يرجى المحاولة مرة أخرى.',
                icon: 'error'
            });
        }
    }

    // تحميل المنشورات الأولية
    async loadInitialPosts() {
        this.isLoading = true;
        const postsLoading = document.getElementById('postsLoading');
        const noPosts = document.getElementById('noPosts');
        const postsContainer = document.getElementById('postsContainer');
        
        if (postsLoading) {
            postsLoading.style.display = 'flex';
        }
        
        try {
            // استعلام للحصول على أحدث المنشورات
            const snapshot = await this.postsRef
                .orderByChild('timestamp')
                .limitToLast(this.postsPerPage)
                .once('value');
            
            // تحويل البيانات
            const posts = [];
            snapshot.forEach(childSnapshot => {
                posts.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // عرض المنشورات بترتيب عكسي (الأحدث أولاً)
            const postsArray = posts.reverse();
            
            if (postsArray.length > 0) {
                // تخزين آخر منشور لاستخدامه في التحميل اللاحق
                this.lastVisiblePost = postsArray[postsArray.length - 1].timestamp;
                
                // عرض المنشورات
                postsArray.forEach(post => {
                    this.addPostToDOM(post.id, post);
                });
                
                if (noPosts) {
                    noPosts.style.display = 'none';
                }
            } else {
                if (noPosts) {
                    noPosts.style.display = 'flex';
                }
            }
            
        } catch (error) {
            console.error('Error loading posts:', error);
            showToast('حدث خطأ أثناء تحميل المنشورات', 'error');
        } finally {
            if (postsLoading) {
                postsLoading.style.display = 'none';
            }
            this.isLoading = false;
        }
    }
    
    // تحميل المزيد من المنشورات
    async loadMorePosts() {
        if (this.isLoading || this.noMorePosts) return;
        
        this.isLoading = true;
        
        try {
            if (!this.lastVisiblePost) {
                this.noMorePosts = true;
                return;
            }
            
            // إضافة مؤشر التحميل في نهاية قائمة المنشورات
            const postsContainer = document.getElementById('postsContainer');
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-more-posts';
            loadingIndicator.innerHTML = '<div class="spinner"></div>';
            postsContainer.appendChild(loadingIndicator);
            
            // استعلام للحصول على المنشورات القديمة
            const snapshot = await this.postsRef
                .orderByChild('timestamp')
                .endAt(this.lastVisiblePost - 1) // نقطة النهاية هي توقيت آخر منشور مرئي ناقص 1
                .limitToLast(this.postsPerPage)
                .once('value');
                
            // تحويل البيانات
            const posts = [];
            snapshot.forEach(childSnapshot => {
                posts.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // إزالة مؤشر التحميل
            loadingIndicator.remove();
            
            // عرض المنشورات الجديدة بترتيب عكسي
            const postsArray = posts.reverse();
            
            if (postsArray.length > 0) {
                // تحديث آخر منشور مرئي
                this.lastVisiblePost = postsArray[postsArray.length - 1].timestamp;
                
                // إضافة المنشورات الجديدة
                postsArray.forEach(post => {
                    this.addPostToDOM(post.id, post);
                });
            } else {
                // لا توجد منشورات إضافية
                this.noMorePosts = true;
                
                // إضافة رسالة "لا توجد منشورات أخرى"
                const noMorePostsEl = document.createElement('div');
                noMorePostsEl.className = 'no-more-posts';
                noMorePostsEl.innerHTML = '<p>لا توجد منشورات أخرى</p>';
                postsContainer.appendChild(noMorePostsEl);
            }
            
            <script src="driver-registration-prompt.js"></script>