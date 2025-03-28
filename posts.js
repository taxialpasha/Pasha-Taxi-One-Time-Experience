// posts.js - وحدة المنشورات لتطبيق تاكسي العراق

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

    // تهيئة مدير المنشورات
    init() {
        // التحقق من المستخدم الحالي
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }

        // تهيئة عنصر واجهة منشئ المنشورات فقط إذا كان المستخدم سائق
        this.initPostCreator();
        
        // تحميل المنشورات الأولية (يمكن للجميع مشاهدة المنشورات)
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
                        
                        // تحديث حالة ظهور منشئ المنشورات بناءً على نوع المستخدم
                        this.updatePostCreatorVisibility();
                    }
                });
                
                // التحقق من وجود المستخدم في جدول السائقين
                this.database.ref(`drivers`).orderByChild('uid').equalTo(user.uid).once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        // إذا وجدنا المستخدم في جدول السائقين، نعين نوع المستخدم إلى سائق
                        this.currentUser = { ...this.currentUser, userType: 'driver', role: 'driver' };
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                        
                        // تحديث حالة ظهور منشئ المنشورات
                        this.updatePostCreatorVisibility();
                    }
                });
            } else {
                this.currentUser = null;
                localStorage.removeItem('currentUser');
                this.updatePostCreatorVisibility();
            }
        });
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
                                    <h6>${this.currentUser?.fullName || this.currentUser?.name || 'مستخدم'}</h6>
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
            // التحقق من وجود المستخدم ومن أنه سائق
            if (this.currentUser && (this.currentUser.userType === 'driver' || this.currentUser.role === 'driver')) {
                postCreator.style.display = 'block';
                
                // تحديث معلومات المستخدم في منشئ المنشورات
                const avatar = postCreator.querySelector('.post-creator-avatar');
                if (avatar) {
                    avatar.src = this.currentUser.photoUrl || this.currentUser.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
                }
            } else {
                // إخفاء منشئ المنشورات إذا لم يكن المستخدم سائق
                postCreator.style.display = 'none';
            }
        }
        
        // تحديث معلومات المستخدم في نافذة إنشاء المنشورات المنبثقة
        const createPostUser = document.querySelector('.create-post-user');
        if (createPostUser && this.currentUser) {
            const avatar = createPostUser.querySelector('.create-post-avatar');
            const userName = createPostUser.querySelector('h6');
            
            if (avatar) {
                avatar.src = this.currentUser.photoUrl || this.currentUser.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
            }
            
            if (userName) {
                userName.textContent = this.currentUser.fullName || this.currentUser.name || 'مستخدم';
            }
        }
        
        // تحديث أيقونة التعليق
        const commentAvatar = document.querySelector('.comment-avatar');
        if (commentAvatar && this.currentUser) {
            commentAvatar.src = this.currentUser.photoUrl || this.currentUser.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
        }
    }

    // فتح منشئ المنشورات
    openPostCreator(mediaType = null) {
        // التحقق من وجود المستخدم وأنه سائق
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
        
        // التحقق من نوع المستخدم
        if (this.currentUser.userType !== 'driver' && this.currentUser.role !== 'driver') {
            Swal.fire({
                title: 'غير مسموح',
                text: 'عذراً، فقط السائقين يمكنهم نشر المنشورات',
                icon: 'warning',
                confirmButtonText: 'حسناً'
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
        // التحقق من وجود المستخدم وأنه سائق
        if (!this.currentUser) {
            showToast('يجب تسجيل الدخول لنشر منشور', 'error');
            return;
        }
        
        // التحقق من نوع المستخدم
        if (this.currentUser.userType !== 'driver' && this.currentUser.role !== 'driver') {
            showToast('عذراً، فقط السائقين يمكنهم نشر المنشورات', 'error');
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
                authorName: this.currentUser.fullName || this.currentUser.name || 'مستخدم',
                authorImage: this.currentUser.photoUrl || this.currentUser.imageUrl || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                likes: 0,
                comments: 0,
                shares: 0,
                mediaType: null,
                mediaUrl: null,
                // إضافة علامة توضح أن المنشور من سائق
                fromDriver: true
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

        // إضافة شارة "سائق" إلى رأس المنشور
        const driverBadge = postData.fromDriver ? 
            `<span class="driver-badge">
                <i class="fas fa-taxi"></i> سائق
            </span>` : '';

        // إنشاء HTML للمنشور
        postElement.innerHTML = `
        <div class="post-header">
            <div class="post-user">
            <img src="${postData.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
            <div class="post-user-info">
            <h6>${postData.authorName} ${driverBadge}</h6>
            <small>${postTime} <i class="fas fa-globe-asia fa-sm"></i></small>
            </div>
            </div>
            <div class="post-options">
            <button class="post-options-btn">
            <i class="fas fa-ellipsis-h"></i>
            </button>
            <div class="post-options-menu">
            ${this.currentUser?.uid === postData.authorId ? `
            <button class="post-option-item" onclick="window.postsManager.editPost('${postId}')">
            <i class="fas fa-edit"></i> تعديل المنشور
            </button>
            <button class="post-option-item" onclick="window.postsManager.deletePost('${postId}')">
            <i class="fas fa-trash"></i> حذف المنشور
            </button>
            ` : ''}
            <button class="post-option-item save-post-btn" data-post-id="${postId}" onclick="postsManager.toggleSave('${postId}')">
            <i class="fas fa-bookmark"></i> حفظ المنشور
            </button>
            <button class="post-option-item toggle-notifications-btn" data-post-id="${postId}">
            <i class="fas fa-bell-slash"></i> إيقاف التنبيهات
            </button>
            <button class="post-option-item report-post-btn" data-post-id="${postId}">
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

        // إضافة معالج لحفظ المنشور
        const savePostBtn = postElement.querySelector('.save-post-btn');
        if (savePostBtn) {
            savePostBtn.addEventListener('click', () => {
                this.toggleSave(postId);
            });
        }

        // إضافة معالج لإيقاف التنبيهات
        const toggleNotificationsBtn = postElement.querySelector('.toggle-notifications-btn');
        if (toggleNotificationsBtn) {
            toggleNotificationsBtn.addEventListener('click', () => {
                Swal.fire('تم إيقاف التنبيهات', 'لن تتلقى إشعارات جديدة لهذا المنشور.', 'info');
            });
        }

        // إضافة معالج للإبلاغ عن المنشور
        const reportPostBtn = postElement.querySelector('.report-post-btn');
        if (reportPostBtn) {
            reportPostBtn.addEventListener('click', () => {
                Swal.fire({
                    title: 'الإبلاغ عن المنشور',
                    input: 'select',
                    inputOptions: {
                        'spam': 'محتوى غير مرغوب فيه',
                        'abuse': 'إساءة أو تحرش',
                        'misleading': 'معلومات مضللة',
                        'other': 'أخرى'
                    },
                    inputPlaceholder: 'اختر سبب الإبلاغ',
                    showCancelButton: true,
                    confirmButtonText: 'إرسال',
                    cancelButtonText: 'إلغاء'
                }).then((result) => {
                    if (result.isConfirmed) {
                        const reason = result.value;
                        if (reason) {
                            this.database.ref(`reports/${postId}`).push({
                                reason,
                                reporterId: this.currentUser?.uid || 'unknown',
                                timestamp: firebase.database.ServerValue.TIMESTAMP
                            }).then(() => {
                                Swal.fire('تم الإبلاغ', 'تم إرسال الإبلاغ بنجاح.', 'success');
                            }).catch((error) => {
                                console.error('Error reporting post:', error);
                                Swal.fire('خطأ', 'حدث خطأ أثناء إرسال الإبلاغ.', 'error');
                            });
                        }
                    }
                });
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
            
            // تحديث واجهة المستخدم
            const saveButton = document.querySelector(`.save-btn[data-post-id="${postId}"]`);
            if (saveButton) {
                saveButton.classList.remove('active');
                saveButton.querySelector('i').classList.remove('fas');
                saveButton.querySelector('i').classList.add('far');
                saveButton.querySelector('span').textContent = 'حفظ';
                showToast('تمت إزالة المنشور من المحفوظات', 'info');
            }
        } else {
            // الحصول على بيانات المنشور
            const postSnapshot = await this.postsRef.child(postId).once('value');
            const postData = postSnapshot.val();
            
            if (!postData) {
                showToast('لم يتم العثور على المنشور', 'error');
                return;
            }
            
            // حفظ المنشور بالكامل في المحفوظات
            await savedRef.set({
                postId: postId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                postData: postData
            });
            
            // تحديث واجهة المستخدم
            const saveButton = document.querySelector(`.save-btn[data-post-id="${postId}"]`);
            if (saveButton) {
                saveButton.classList.add('active');
                saveButton.querySelector('i').classList.remove('far');
                saveButton.querySelector('i').classList.add('fas');
                saveButton.querySelector('span').textContent = 'محفوظ';
                
                // إضافة تأثير حركي للحفظ
                const saveIcon = saveButton.querySelector('i');
                saveIcon.classList.add('save-animation');
                setTimeout(() => saveIcon.classList.remove('save-animation'), 1000);
                
                showToast('تم حفظ المنشور', 'success');
            }
        }
        
    } catch (error) {
        console.error('Error toggling save:', error);
        showToast('حدث خطأ أثناء حفظ المنشور', 'error');
    }
}
    
    // مشاركة المنشور
    sharePost(postId) {
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

    // Edit a post
    async editPost(postId) {
        try {
            const postSnapshot = await this.postsRef.child(postId).once('value');
            const postData = postSnapshot.val();

            if (!postData || postData.authorId !== this.currentUser.uid) {
                Swal.fire('خطأ', 'لا يمكنك تعديل هذا المنشور.', 'error');
                return;
            }

            // Create a modal similar to the post creation modal
            const editPostModalHTML = `
                <div class="modal fade" id="editPostModal" tabindex="-1" aria-labelledby="editPostModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="editPostModalLabel">تعديل المنشور</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button>
                            </div>
                            <div class="modal-body">
                                <div class="create-post-container">
                                    <div class="create-post-user">
                                        <img src="${this.currentUser?.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                                             alt="صورة المستخدم" class="create-post-avatar">
                                        <div class="create-post-user-info">
                                            <h6>${this.currentUser?.fullName || this.currentUser?.name || 'مستخدم'}</h6>
                                            <span class="post-privacy">
                                                <i class="fas fa-globe-asia"></i> عام
                                            </span>
                                        </div>
                                    </div>
                                    <div class="create-post-content">
                                        <textarea id="editPostText" class="create-post-textarea" placeholder="قم بتعديل النص" rows="4">${postData.text || ''}</textarea>
                                        <div id="editMediaPreviewContainer" class="media-preview-container" style="${postData.mediaUrl ? 'display: block;' : 'display: none;'}">
                                            ${postData.mediaUrl ? (postData.mediaType === 'image' ? `<img src="${postData.mediaUrl}" class="media-preview-image">` : `<video src="${postData.mediaUrl}" controls class="media-preview-video"></video>`) : ''}
                                            <button class="remove-media-btn" id="removeEditMediaBtn"><i class="fas fa-times"></i></button>
                                        </div>
                                        <input type="file" id="editPostMediaInput" accept="image/*,video/*" style="display: none;">
                                    </div>
                                    <div class="create-post-options">
                                        <p>إضافة إلى منشورك</p>
                                        <div class="post-options-buttons">
                                            <button type="button" id="editAddPhotoBtn" class="post-option-btn">
                                                <i class="fas fa-image"></i>
                                                <span>صورة/فيديو</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                                <button type="button" id="saveEditPostBtn" class="btn btn-gold">حفظ</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Append the modal to the body
            const existingModal = document.getElementById('editPostModal');
            if (existingModal) existingModal.remove();
            document.body.insertAdjacentHTML('beforeend', editPostModalHTML);

            // Show the modal
            const editPostModal = new bootstrap.Modal(document.getElementById('editPostModal'));
            editPostModal.show();

            // Set up event listeners for the modal
            const editPostText = document.getElementById('editPostText');
            const editPostMediaInput = document.getElementById('editPostMediaInput');
            const editMediaPreviewContainer = document.getElementById('editMediaPreviewContainer');
            const removeEditMediaBtn = document.getElementById('removeEditMediaBtn');
            const editAddPhotoBtn = document.getElementById('editAddPhotoBtn');
            const saveEditPostBtn = document.getElementById('saveEditPostBtn');

            let updatedMediaFile = null;

            // Handle media file selection
            editAddPhotoBtn.addEventListener('click', () => {
                editPostMediaInput.click();
            });

            editPostMediaInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validate file size (10 MB max)
                const maxSize = 10 * 1024 * 1024;
                if (file.size > maxSize) {
                    Swal.fire('خطأ', 'يجب أن يكون حجم الملف أقل من 10 ميجابايت.', 'error');
                    return;
                }

                updatedMediaFile = file;

                // Show media preview
                editMediaPreviewContainer.innerHTML = '';
                editMediaPreviewContainer.style.display = 'block';

                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.className = 'media-preview-image';
                    editMediaPreviewContainer.appendChild(img);

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                } else if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.className = 'media-preview-video';
                    video.controls = true;
                    editMediaPreviewContainer.appendChild(video);

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        video.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }

                // Add remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-media-btn';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener('click', () => {
                    editMediaPreviewContainer.innerHTML = '';
                    editMediaPreviewContainer.style.display = 'none';
                    editPostMediaInput.value = '';
                    updatedMediaFile = null;
                });
                editMediaPreviewContainer.appendChild(removeBtn);
            });

            // Handle removing existing media
            if (removeEditMediaBtn) {
                removeEditMediaBtn.addEventListener('click', () => {
                    editMediaPreviewContainer.innerHTML = '';
                    editMediaPreviewContainer.style.display = 'none';
                    updatedMediaFile = null;
                });
            }

            // Save the edited post
            saveEditPostBtn.addEventListener('click', async () => {
                try {
                    const updatedText = editPostText.value.trim();
                    const updatedData = { text: updatedText };

                    // Show loading indicator
                    const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
                    const loadingIndicator = document.createElement('div');
                    loadingIndicator.className = 'loading-indicator';
                    loadingIndicator.innerHTML = `
                        <div class="spinner"></div>
                        <p>جاري التحديث...</p>
                    `;
                    postElement.appendChild(loadingIndicator);

                    if (updatedMediaFile) {
                        const mediaType = updatedMediaFile.type.startsWith('image/') ? 'image' : 'video';
                        const fileRef = this.storage.ref(`posts/${Date.now()}_${updatedMediaFile.name}`);
                        const uploadTask = await fileRef.put(updatedMediaFile);
                        const downloadUrl = await uploadTask.ref.getDownloadURL();

                        updatedData.mediaType = mediaType;
                        updatedData.mediaUrl = downloadUrl;
                    }

                    await this.postsRef.child(postId).update(updatedData);

                    // Remove loading indicator
                    loadingIndicator.remove();

                    Swal.fire('تم التعديل', 'تم تعديل المنشور بنجاح.', 'success');

                    // Update the post in the DOM
                    if (postElement) {
                        if (updatedData.text) {
                            const postTextElement = postElement.querySelector('.post-text');
                            if (postTextElement) postTextElement.innerHTML = this.formatPostText(updatedData.text);
                        }
                        if (updatedData.mediaUrl) {
                            const postMediaElement = postElement.querySelector('.post-media');
                            if (postMediaElement) {
                                postMediaElement.innerHTML = updatedData.mediaType === 'image'
                                    ? `<img src="${updatedData.mediaUrl}" alt="صورة المنشور" class="post-image">`
                                    : `<video src="${updatedData.mediaUrl}" controls class="post-video"></video>`;
                            }
                        }
                    }

                    editPostModal.hide();
                } catch (error) {
                    console.error('Error editing post:', error);
                    Swal.fire('خطأ', 'حدث خطأ أثناء تعديل المنشور.', 'error');
                }
            });
        } catch (error) {
            console.error('Error editing post:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تعديل المنشور.', 'error');
        }
    }

    // Delete a post
    async deletePost(postId) {
        try {
            const postSnapshot = await this.postsRef.child(postId).once('value');
            const postData = postSnapshot.val();

            if (!postData || postData.authorId !== this.currentUser.uid) {
                Swal.fire('خطأ', 'لا يمكنك حذف هذا المنشور.', 'error');
                return;
            }

            const confirm = await Swal.fire({
                title: 'حذف المنشور',
                text: 'هل أنت متأكد أنك تريد حذف هذا المنشور؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });

            if (!confirm.isConfirmed) return;

            // Delete media from storage if it exists
            if (postData.mediaUrl) {
                const mediaRef = this.storage.refFromURL(postData.mediaUrl);
                await mediaRef.delete().catch((error) => console.warn('Error deleting media:', error));
            }

            // Remove post from database
            await this.postsRef.child(postId).remove();
            Swal.fire('تم الحذف', 'تم حذف المنشور بنجاح.', 'success');

            // Remove the post from the DOM
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف المنشور.', 'error');
        }
    }
}

// إنشاء نسخة عالمية من مدير المنشورات
window.postsManager = new PostsManager();

// تهيئة مدير المنشورات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.postsManager.init();

    // Bind methods to the global object for use in onclick attributes
    window.postsManager.toggleLike = window.postsManager.toggleLike.bind(window.postsManager);
    window.postsManager.sharePost = window.postsManager.sharePost.bind(window.postsManager);
    window.postsManager.toggleSave = window.postsManager.toggleSave.bind(window.postsManager);
    window.postsManager.shareViaTwitter = window.postsManager.shareViaTwitter.bind(window.postsManager);
    window.postsManager.shareViaFacebook = window.postsManager.shareViaFacebook.bind(window.postsManager);
    window.postsManager.shareViaWhatsApp = window.postsManager.shareViaWhatsApp.bind(window.postsManager);
    window.postsManager.copyPostLink = window.postsManager.copyPostLink.bind(window.postsManager);
    window.postsManager.shareViaTelegram = window.postsManager.shareViaTelegram.bind(window.postsManager);
    window.postsManager.editPost = window.postsManager.editPost.bind(window.postsManager);
    window.postsManager.deletePost = window.postsManager.deletePost.bind(window.postsManager);
});

// معلومات المستخدم الحالي
const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        
// إنشاء منشئ المنشورات
const postCreator = document.createElement('div');
postCreator.className = 'post-creator';
postCreator.innerHTML = `
    <div class="post-creator-header">
        <img src="${currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
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
`;

// إضافة منشئ المنشورات
postsSection.appendChild(postCreator);

// إضافة حاوية المنشورات
const postsContainer = document.createElement('div');
postsContainer.className = 'posts-container';
postsContainer.id = 'postsContainer';
postsContainer.innerHTML = `
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
`;

postsSection.appendChild(postsContainer);


// إضافة نوافذ المنشورات المنبثقة إذا لم تكن موجودة
if (!document.getElementById('createPostModal')) {
const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};

// إنشاء نافذة إنشاء المنشور المنبثقة
const createPostModal = document.createElement('div');
createPostModal.className = 'modal fade';
createPostModal.id = 'createPostModal';
createPostModal.tabIndex = '-1';
createPostModal.setAttribute('aria-labelledby', 'createPostModalLabel');
createPostModal.setAttribute('aria-hidden', 'true');

createPostModal.innerHTML = `
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="createPostModalLabel">إنشاء منشور جديد</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button>
            </div>
            <div class="modal-body">
                <div class="create-post-container">
                    <div class="create-post-user">
                        <img src="${currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                             alt="صورة المستخدم" class="create-post-avatar">
                        <div class="create-post-user-info">
                            <h6>${currentUser.fullName || currentUser.name || 'مستخدم'}</h6>
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
`;

document.body.appendChild(createPostModal);

// إنشاء نافذة التعليقات المنبثقة
const commentsModal = document.createElement('div');
commentsModal.className = 'modal fade';
commentsModal.id = 'commentsModal';
commentsModal.tabIndex = '-1';
commentsModal.setAttribute('aria-labelledby', 'commentsModalLabel');
commentsModal.setAttribute('aria-hidden', 'true');

commentsModal.innerHTML = `
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
                    <img src="${currentUser.photoUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                         alt="صورة المستخدم" class="comment-avatar">
                    <input type="text" id="commentInput" class="comment-input" placeholder="أضف تعليقًا...">
                    <button id="sendCommentBtn" class="send-comment-btn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

document.body.appendChild(commentsModal);
}

// تهيئة مدير المنشورات
if (window.postsManager) {
window.postsManager.init();
} else {
console.warn('Posts manager not found. Make sure to include posts.js.');
}

// ربط أحداث المنشورات
setupPostsEventHandlers();


// التحقق من وجود مدير المنشورات وإنشائه إذا لم يكن موجوداً
function ensurePostsManager() {
if (!window.postsManager) {
// تعريف مبسط لمدير المنشورات في حال عدم وجوده
window.postsManager = {
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    database: firebase.database(),
    storage: firebase.storage(),
    postsRef: firebase.database().ref('posts'),
    likesRef: firebase.database().ref('likes'),
    commentsRef: firebase.database().ref('comments'),
    savedPostsRef: firebase.database().ref('savedPosts'),
    
    init: function() {
        // تهيئة مكون إنشاء المنشورات
        this.updatePostCreatorVisibility();
        
        // تحميل المنشورات الأولية
        this.loadInitialPosts();
        
        // إضافة مستمع للتمرير لتحميل المزيد من المنشورات
        this.setupInfiniteScroll();
        
        // تهيئة معالجات الأحداث
        this.setupEventListeners();
    },
    
    // تحديث ظهور منشئ المنشورات
    updatePostCreatorVisibility: function() {
        const postCreator = document.querySelector('.post-creator');
        if (postCreator) {
            if (this.currentUser) {
                postCreator.style.display = 'block';
            } else {
                postCreator.style.display = 'none';
            }
        }
    },
    
    // فتح منشئ المنشورات
    openPostCreator: function(mediaType = null) {
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
    },
    
    // إعداد التمرير اللانهائي
    setupInfiniteScroll: function() {
        window.addEventListener('scroll', () => {
            // التحقق من وصول التمرير إلى أسفل الصفحة
            if (
                window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
                !this.isLoading &&
                !this.noMorePosts
            ) {
                this.loadMorePosts();
            }
        });
    },
    
    // تحميل المنشورات الأولية
    loadInitialPosts: function() {
        const postsLoading = document.getElementById('postsLoading');
        const noPosts = document.getElementById('noPosts');
        const postsContainer = document.getElementById('postsContainer');
        
        if (postsLoading) {
            postsLoading.style.display = 'flex';
        }
        
        // استعلام للحصول على أحدث المنشورات
        this.postsRef
            .orderByChild('timestamp')
            .limitToLast(10)
            .once('value')
            .then((snapshot) => {
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
            })
            .catch((error) => {
                console.error('Error loading posts:', error);
                showToast('حدث خطأ أثناء تحميل المنشورات', 'error');
            })
            .finally(() => {
                if (postsLoading) {
                    postsLoading.style.display = 'none';
                }
            });
    },
    
    // إضافة منشور إلى DOM
    addPostToDOM: function(postId, postData) {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;
        
        // إنشاء عنصر المنشور
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.setAttribute('data-post-id', postId);
        
        // تنسيق الوقت
        const postTime = this.formatPostTime(postData.timestamp);
        
        // إنشاء محتوى الوسائط
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
        
        // إنشاء HTML للمنشور
        postElement.innerHTML = `
        <div class="post-header">
            <div class="post-user">
                <img src="${postData.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
                <div class="post-user-info">
                    <h6>${postData.authorName}</h6>
                    <small>${postTime} <i class="fas fa-globe-asia fa-sm"></i></small>
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
            <button class="post-action-btn like-btn" data-post-id="${postId}" onclick="window.postsManager.toggleLike('${postId}')">
                <i class="far fa-heart"></i>
                <span>إعجاب</span>
            </button>
            <button class="post-action-btn comment-btn" data-post-id="${postId}" data-bs-toggle="modal" data-bs-target="#commentsModal">
                <i class="far fa-comment"></i>
                <span>تعليق</span>
            </button>
            <button class="post-action-btn share-btn" data-post-id="${postId}" onclick="window.postsManager.sharePost('${postId}')">
                <i class="far fa-share-square"></i>
                <span>مشاركة</span>
            </button>
            <button class="post-action-btn save-btn" data-post-id="${postId}" onclick="window.postsManager.toggleSave('${postId}')">
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
        
        // التحقق من حالة الإعجاب والحفظ إذا كان المستخدم مسجل الدخول
        if (this.currentUser) {
            this.checkIfLiked(postId, this.currentUser.uid).then(result => {
                if (result) {
                    const likeButton = postElement.querySelector('.like-btn');
                    if (likeButton) {
                        likeButton.classList.add('active');
                        likeButton.querySelector('i').classList.remove('far');
                        likeButton.querySelector('i').classList.add('fas');
                    }
                }
            });
            
            this.checkIfSaved(postId, this.currentUser.uid).then(result => {
                if (result) {
                    const saveButton = postElement.querySelector('.save-btn');
                    if (saveButton) {
                        saveButton.classList.add('active');
                        saveButton.querySelector('i').classList.remove('far');
                        saveButton.querySelector('i').classList.add('fas');
                    }
                }
            });
        }
    },
    
    // تنسيق نص المنشور
    formatPostText: function(text) {
        if (!text) return '';
        
        // تحويل الروابط إلى روابط قابلة للنقر
        let formattedText = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // تحويل الهاشتاغات إلى روابط
        formattedText = formattedText.replace(/#(\w+)/g, '<a href="#" class="hashtag">#$1</a>');
        
        // تحويل المنشنات إلى روابط
        formattedText = formattedText.replace(/@(\w+)/g, '<a href="#" class="mention">@$1</a>');
        
        // تحويل العودات السطرية إلى <br>
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        return formattedText;
    },
    
    // تنسيق وقت المنشور
    formatPostTime: function(timestamp) {
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
    },
    
    // تهيئة معالجات الأحداث
    setupEventListeners: function() {
        // يتم تنفيذ هذه الدالة من خلال setupPostsEventHandlers()
    },
    
    // التحقق ما إذا كان المستخدم قد أعجب بالمنشور
    checkIfLiked: async function(postId, userId) {
        try {
            const snapshot = await this.likesRef.child(postId).child(userId).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking if post is liked:', error);
            return false;
        }
    },
    
    // التحقق ما إذا كان المستخدم قد حفظ المنشور
    checkIfSaved: async function(postId, userId) {
        try {
            const snapshot = await this.savedPostsRef.child(userId).child(postId).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking if post is saved:', error);
            return false;
        }
    },
    
    // تبديل حالة الإعجاب
    toggleLike: async function(postId) {
        // الكود التفصيلي للإعجاب موجود في ملف posts.js
        
        if (!this.currentUser) {
            Swal.fire({
                title: 'مطلوب تسجيل الدخول',
                text: 'يجب عليك تسجيل الدخول أولاً للتفاعل مع المنشورات',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'تسجيل الدخول',
                cancelButtonText: 'إلغاء'
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
    },
    
    // مشاركة المنشور
    sharePost: function(postId) {
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
    },
    
    // معالجة تحميل المزيد من المنشورات
    loadMorePosts: function() {
        // كود تحميل المزيد من المنشورات (مبسط)
        console.log('Loading more posts...');
    }
};
}

return window.postsManager;
}

// دالة لإضافة قسم المنشورات إلى الصفحة
function addPostsSectionToPage() {
// التأكد من وجود مدير المنشورات
ensurePostsManager();

// تهيئة قسم المنشورات
initializePostsSection();
}

// تشغيل إضافة قسم المنشورات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
// التأكد من تحميل Firebase أولاً
if (typeof firebase !== 'undefined') {
// إضافة قسم المنشورات بعد قسم القصص
setTimeout(() => {
    addPostsSectionToPage();
}, 1000); // انتظار ثانية واحدة للتأكد من تحميل باقي العناصر
} else {
console.error('Firebase not initialized! Cannot add posts section.');
}
});
// posts-integration.js
// ملف للتكامل بين وحدة المنشورات وقاعدة البيانات Firebase

document.addEventListener('DOMContentLoaded', function() {
// التأكد من تهيئة Firebase
if (typeof firebase !== 'undefined') {
// تأكد من وجود العناصر المطلوبة في الصفحة قبل إضافة المنشورات
const addStylesAndScripts = () => {
    // إضافة التنسيقات
    const postsStyles = document.createElement('style');
    postsStyles.textContent = `
    /* تنسيقات قسم المنشورات */
    .posts-section {
        display: flex;
        flex-direction: column;
        margin: 15px 0;
        padding-bottom: 60px;
    }

    /* منشئ المنشور */
    .post-creator {
        background-color: #242424;
        border-radius: 15px;
        padding: 15px;
        margin-bottom: 15px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        gap: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .post-creator:hover {
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transform: translateY(-2px);
    }

    .post-creator-header {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .post-creator-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #FFD700;
    }

    .post-creator-text {
        background-color: #333;
        border-radius: 20px;
        padding: 10px 15px;
        flex-grow: 1;
        color: #aaa;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 14px;
    }

    .post-creator-text:hover {
        background-color: #444;
        color: #fff;
    }

    /* ...وهكذا مع بقية التنسيقات */
    /* في الواقع، يفضل استيراد ملف CSS الخارجي */
    `;
    document.head.appendChild(postsStyles);

    // التحقق من وجود قسم المنشورات
    if (!document.querySelector('.posts-section')) {
        // إضافة قسم المنشورات بعد قسم القصص
        const storiesContainer = document.querySelector('.stories-container');
        const postsSection = document.createElement('div');
        postsSection.className = 'posts-section';
        
        if (storiesContainer) {
            storiesContainer.insertAdjacentElement('afterend', postsSection);
        } else {
            // إذا لم يوجد قسم القصص، أضف للحاوية الرئيسية
            const mainContainer = document.querySelector('.container');
            if (mainContainer) {
                mainContainer.appendChild(postsSection);
            }
        }
    }

    // تهيئة مدير المنشورات
    if (window.postsManager) {
        window.postsManager.init();
    } else {
        console.error('Posts manager not found. Make sure to include posts.js before this file.');
    }
};

// تحميل مدير المنشورات إذا لم يكن محملاً بالفعل
if (!window.postsManager) {
    const postsScript = document.createElement('script');
    postsScript.src = './posts.js';
    postsScript.onload = function() {
        console.log('Posts manager loaded successfully.');
        addStylesAndScripts();
    };
    postsScript.onerror = function() {
        console.error('Failed to load posts manager!');
    };
    document.body.appendChild(postsScript);
} else {
    addStylesAndScripts();
}
} else {
console.error('Firebase not initialized!');
}
});

// دالة لربط أحداث المنشورات
function setupPostsEventHandlers() {
// زر الإعجاب
document.querySelectorAll('.like-btn').forEach(button => {
button.addEventListener('click', function() {
    const postId = this.getAttribute('data-post-id');
    if (window.postsManager) {
        window.postsManager.toggleLike(postId);
    }
});
});

// زر الحفظ
document.querySelectorAll('.save-btn').forEach(button => {
button.addEventListener('click', function() {
    const postId = this.getAttribute('data-post-id');
    if (window.postsManager) {
        window.postsManager.toggleSave(postId);
    }
});
});

// زر المشاركة
document.querySelectorAll('.share-btn').forEach(button => {
button.addEventListener('click', function() {
    const postId = this.getAttribute('data-post-id');
    if (window.postsManager) {
        window.postsManager.sharePost(postId);
    }
});
});

// منشئ المنشور
const postCreatorTrigger = document.getElementById('postCreatorTrigger');
if (postCreatorTrigger) {
postCreatorTrigger.addEventListener('click', function() {
    if (window.postsManager) {
        window.postsManager.openPostCreator();
    }
});
}
}

// دالة لتهيئة قسم المنشورات في الصفحة
function initializePostsSection() {
// التأكد من تهيئة Firebase
if (typeof firebase === 'undefined') {
console.error('Firebase not initialized!');
return;
}

// إنشاء قسم المنشورات إذا لم يكن موجوداً
const mainContainer = document.querySelector('.container');
if (!mainContainer) return;

// التحقق من وجود قسم المنشورات
let postsSection = document.querySelector('.posts-section');
if (!postsSection) {
postsSection = document.createElement('div');
postsSection.className = 'posts-section';

// إضافة قسم المنشورات بعد قسم القصص
const storiesContainer = document.querySelector('.stories-container');
if (storiesContainer) {
    storiesContainer.insertAdjacentElement('afterend', postsSection);
} else {
    mainContainer.appendChild(postsSection);
}
}

// إضافة منشئ المنشورات
if (!document.querySelector('.post-creator')) {
    // معلومات المستخدم الحالي
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
}
}

// هذا الملف يحتوي على كود دمج زر المراسلة في المنشورات
// يجب تضمينه بعد تحميل ملف posts.js ونظام المراسلة

/**
 * تعديل دالة إنشاء بطاقة المنشور لإضافة زر المراسلة
 */
const originalCreateDriverCard = window.postsManager.createDriverCard;

window.postsManager.createDriverCard = function(driver, key) {
    // استدعاء الدالة الأصلية للحصول على HTML الخاص بالبطاقة
    const originalHTML = originalCreateDriverCard.call(this, driver, key);
    
    // إنشاء عنصر DOM مؤقت لتعديل HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalHTML;
    
    // البحث عن قسم أزرار التفاعل
    const actionsDiv = tempDiv.querySelector('.post-actions');
    
    if (actionsDiv) {
        // التحقق من وجود المستخدم الحالي
        const currentUser = this.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        // التحقق من أن السائق ليس المستخدم نفسه
        if (currentUser && currentUser.uid !== key) {
            // إنشاء زر المراسلة
            const chatButton = document.createElement('button');
            chatButton.className = 'post-action-btn chat-btn';
            chatButton.setAttribute('data-driver-id', key);
            chatButton.innerHTML = '<i class="fas fa-comment-dots"></i><span>مراسلة</span>';
            
            // إضافة معالج النقر
            chatButton.addEventListener('click', function() {
                if (window.chatSystem) {
                    window.chatSystem.openChatWithUser(key);
                } else {
                    window.openChatWindow(key);
                }
            });
            
            // تحديد موقع إدراج زر المراسلة (بعد زر الإعجاب)
            const likeButton = actionsDiv.querySelector('.like-btn');
            const commentButton = actionsDiv.querySelector('.comment-btn');
            
            if (likeButton && commentButton) {
                // إدراج بين زر الإعجاب وزر التعليق
                actionsDiv.insertBefore(chatButton, commentButton);
            } else {
                // إضافة في نهاية قسم الأزرار
                actionsDiv.appendChild(chatButton);
            }
        }
    }
    
    // استخراج HTML المعدل
    return tempDiv.innerHTML;
};

/**
 * تعديل دالة إنشاء المنشور لإضافة زر المراسلة
 */
const originalAddPostToDOM = window.postsManager.addPostToDOM;

window.postsManager.addPostToDOM = function(postId, postData) {
    // استدعاء الدالة الأصلية أولاً
    originalAddPostToDOM.call(this, postId, postData);
    
    // إضافة زر المراسلة للمنشور
    this.addChatButtonToPost(postId, postData);
};

/**
 * إضافة دالة جديدة لإضافة زر المراسلة للمنشور
 */
window.postsManager.addChatButtonToPost = function(postId, postData) {
    // البحث عن عنصر المنشور
    const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
    if (!postElement) return;
    
    // البحث عن قسم الأزرار
    const actionsDiv = postElement.querySelector('.post-actions');
    if (!actionsDiv) return;
    
    // التحقق مما إذا كان المنشور ينتمي لسائق
    if (!postData.fromDriver && !postData.authorId) return;
    
    // التحقق من عدم وجود زر المراسلة بالفعل
    if (actionsDiv.querySelector('.chat-btn')) return;
    
    // الحصول على المستخدم الحالي
    const currentUser = this.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // التحقق من أن المستخدم ليس كاتب المنشور
    if (currentUser && currentUser.uid === postData.authorId) return;
    
    // إنشاء زر المراسلة
    const chatButton = document.createElement('button');
    chatButton.className = 'post-action-btn chat-btn';
    chatButton.setAttribute('data-post-id', postId);
    chatButton.setAttribute('data-author-id', postData.authorId);
    
    // التحقق من وجود رسائل غير مقروءة
    if (window.chatSystem) {
        window.chatSystem.getUnreadMessagesCount(postData.authorId).then(count => {
            if (count > 0) {
                chatButton.innerHTML = `
                    <i class="fas fa-comment-dots"></i>
                    <span>مراسلة</span>
                    <span class="chat-badge">${count}</span>
                `;
            } else {
                chatButton.innerHTML = `
                    <i class="fas fa-comment-dots"></i>
                    <span>مراسلة</span>
                `;
            }
        }).catch(error => {
            console.error('Error getting unread count:', error);
            chatButton.innerHTML = `
                <i class="fas fa-comment-dots"></i>
                <span>مراسلة</span>
            `;
        });
    } else {
        chatButton.innerHTML = `
            <i class="fas fa-comment-dots"></i>
            <span>مراسلة</span>
        `;
    }
    
    // إضافة معالج النقر
    chatButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // فتح المحادثة
        if (window.chatSystem) {
            window.chatSystem.openChatWithUser(postData.authorId);
        } else if (typeof openChatWindow === 'function') {
            openChatWindow(postData.authorId);
        } else {
            alert('نظام المراسلة غير متاح حالياً');
        }
    });
    
    // إدراج زر المراسلة بعد زر الإعجاب
    const likeButton = actionsDiv.querySelector('.like-btn');
    const commentButton = actionsDiv.querySelector('.comment-btn');
    
    if (likeButton && commentButton) {
        actionsDiv.insertBefore(chatButton, commentButton);
    } else {
        actionsDiv.appendChild(chatButton);
    }
};

// إضافة أنماط CSS خاصة بزر المراسلة في المنشورات
(function() {
    const style = document.createElement('style');
    style.textContent = `
    /* أنماط زر المراسلة في المنشور */
    .post-action-btn.chat-btn {
        position: relative;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        border-radius: 20px;
        padding: 6px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: none;
        margin: 0 5px;
        transition: all 0.3s ease;
        color: #000;
        font-weight: bold;
    }
    
    .post-action-btn.chat-btn i {
        color: #000;
        font-size: 1rem;
    }
    
    .post-action-btn.chat-btn .chat-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #FF3B30;
        color: white;
        border-radius: 50%;
        min-width: 18px;
        height: 18px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        border: 1px solid #fff;
        font-weight: bold;
    }
    
    .post-action-btn.chat-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
    }
    
    .post-action-btn.chat-btn:active {
        transform: translateY(1px);
    }
    
    /* تعديل قسم أزرار المنشور */
    .post-actions {
        display: flex;
        justify-content: space-around;
        padding: 10px 0;
    }
    `;
    document.head.appendChild(style);
})();

// إضافة وظيفة لتحديث أزرار المراسلة في جميع المنشورات
function updateAllChatButtons() {
    // التحقق من وجود مدير المنشورات
    if (!window.postsManager || !window.postsManager.addChatButtonToPost) return;
    
    // الحصول على جميع المنشورات
    const posts = document.querySelectorAll('.post');
    posts.forEach(post => {
        const postId = post.getAttribute('data-post-id');
        if (postId) {
            // جلب بيانات المنشور وإضافة زر المراسلة
            firebase.database().ref(`posts/${postId}`).once('value').then(snapshot => {
                const postData = snapshot.val();
                if (postData) {
                    window.postsManager.addChatButtonToPost(postId, postData);
                }
            }).catch(error => {
                console.error('Error fetching post data:', error);
            });
        }
    });
}

// تحديث أزرار المراسلة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تأخير التحديث للتأكد من تحميل المنشورات
    setTimeout(updateAllChatButtons, 2000);
});

// تحديث أزرار المراسلة عند تسجيل الدخول
document.addEventListener('login-success', function() {
    setTimeout(updateAllChatButtons, 1000);
});

// تحديث أزرار المراسلة دورياً
setInterval(function() {
    // تحديث أزرار المراسلة كل 5 دقائق للحفاظ على تحديث عدد الرسائل غير المقروءة
    updateAllChatButtons();
}, 300000); // 5 دقائق