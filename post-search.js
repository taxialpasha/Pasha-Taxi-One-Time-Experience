// post-search.js - نظام البحث في المنشورات لتطبيق تاكسي العراق

class PostSearchSystem {
    constructor() {
        this.database = firebase.database();
        this.postsRef = this.database.ref('posts');
        this.searchResults = [];
        this.isSearching = false;
        this.searchQuery = '';
        this.searchType = 'all'; // 'all', 'content', 'author'
        this.searchResultsContainer = null;
        this.searchLimit = 20; // عدد النتائج الأقصى للبحث
        this.initialized = false;
    }

    // تهيئة نظام البحث
    init() {
        // إضافة مكونات واجهة البحث
        this.createSearchInterface();
        // إضافة معالجات الأحداث
        this.setupEventListeners();
        this.initialized = true;
    }

    // إنشاء واجهة البحث
    createSearchInterface() {
        // التحقق من وجود حقل البحث الحالي
        const existingSearchInput = document.getElementById('navbarSearchInput');
        if (existingSearchInput) {
            // إذا كان موجوداً بالفعل، نستخدمه بدلاً من إنشاء واحد جديد
            this.searchInput = existingSearchInput;
            
            // إضافة خيارات البحث في المنشورات إذا لم تكن موجودة
            const searchModal = document.getElementById('searchModal');
            if (searchModal) {
                const searchOptions = searchModal.querySelector('.search-options');
                if (searchOptions) {
                    // إضافة خيارات البحث في المنشورات إذا لم تكن موجودة
                    if (!searchOptions.querySelector('#searchPosts')) {
                        const postsRadio = document.createElement('input');
                        postsRadio.type = 'radio';
                        postsRadio.className = 'btn-check';
                        postsRadio.name = 'searchType';
                        postsRadio.id = 'searchPosts';
                        
                        const postsLabel = document.createElement('label');
                        postsLabel.className = 'btn btn-outline-primary';
                        postsLabel.htmlFor = 'searchPosts';
                        postsLabel.textContent = 'المنشورات';
                        
                        searchOptions.appendChild(postsRadio);
                        searchOptions.appendChild(postsLabel);
                    }
                    
                    // إضافة خيارات البحث في المنشورات تفصيلية
                    const searchTypesContainer = document.createElement('div');
                    searchTypesContainer.id = 'postSearchTypes';
                    searchTypesContainer.className = 'post-search-types mt-2';
                    searchTypesContainer.style.display = 'none';
                    searchTypesContainer.innerHTML = `
                        <div class="btn-group w-100" role="group">
                            <input type="radio" class="btn-check" name="postSearchType" id="searchPostsAll" checked>
                            <label class="btn btn-outline-secondary" for="searchPostsAll">الكل</label>
                            
                            <input type="radio" class="btn-check" name="postSearchType" id="searchPostsContent">
                            <label class="btn btn-outline-secondary" for="searchPostsContent">المحتوى</label>
                            
                            <input type="radio" class="btn-check" name="postSearchType" id="searchPostsAuthor">
                            <label class="btn btn-outline-secondary" for="searchPostsAuthor">الكاتب</label>
                        </div>
                    `;
                    
                    // إضافة خيارات البحث بعد الخيارات الأساسية
                    searchOptions.parentNode.insertBefore(searchTypesContainer, searchOptions.nextSibling);
                }
                
                // التأكد من وجود حاوية نتائج البحث
                const searchResults = searchModal.querySelector('#searchResults');
                if (searchResults) {
                    this.searchResultsContainer = searchResults;
                }
            }
            
            return;
        }
        
        // إنشاء حقل البحث وإضافته إلى شريط التنقل
        const navbarNav = document.querySelector('.navbar-nav');
        if (navbarNav) {
            const searchForm = document.createElement('form');
            searchForm.className = 'search-form d-flex ms-auto';
            searchForm.innerHTML = `
                <div class="input-group">
                    <input type="search" id="navbarSearchInput" class="form-control search-input" 
                           placeholder="ابحث عن منشور أو سائق...">
                    <button class="btn search-btn" type="button">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            `;
            navbarNav.appendChild(searchForm);
            
            this.searchInput = document.getElementById('navbarSearchInput');
        }
        
        // إنشاء نافذة نتائج البحث المنبثقة
        const searchResultsModal = document.createElement('div');
        searchResultsModal.className = 'modal fade';
        searchResultsModal.id = 'searchResultsModal';
        searchResultsModal.setAttribute('tabindex', '-1');
        searchResultsModal.setAttribute('aria-hidden', 'true');
        
        searchResultsModal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">نتائج البحث: <span id="searchQueryDisplay"></span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button>
                    </div>
                    <div class="modal-body">
                        <div class="search-types mb-3">
                            <div class="btn-group w-100" role="group">
                                <input type="radio" class="btn-check" name="searchTypeRadio" id="searchTypeAll" checked>
                                <label class="btn btn-outline-primary" for="searchTypeAll">الكل</label>
                                
                                <input type="radio" class="btn-check" name="searchTypeRadio" id="searchTypeContent">
                                <label class="btn btn-outline-primary" for="searchTypeContent">المحتوى</label>
                                
                                <input type="radio" class="btn-check" name="searchTypeRadio" id="searchTypeAuthor">
                                <label class="btn btn-outline-primary" for="searchTypeAuthor">الكاتب</label>
                            </div>
                        </div>
                        
                        <div id="searchResultsContainer" class="search-results-container">
                            <div class="search-loading">
                                <div class="spinner"></div>
                                <p>جاري البحث...</p>
                            </div>
                            <div class="no-results" style="display: none;">
                                <i class="fas fa-search fa-3x"></i>
                                <p>لا توجد نتائج للبحث</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(searchResultsModal);
        this.searchResultsContainer = document.getElementById('searchResultsContainer');
    }

    // إعداد معالجات الأحداث
    setupEventListeners() {
        // البحث عند الكتابة في حقل البحث
        if (this.searchInput) {
            // معالج حدث التغيير في حقل البحث
            this.searchInput.addEventListener('input', this.debounce(() => {
                const query = this.searchInput.value.trim();
                if (query.length >= 2) {
                    this.searchQuery = query;
                    this.performSearch();
                } else if (query.length === 0) {
                    // إفراغ نتائج البحث إذا تم مسح الاستعلام
                    this.clearSearchResults();
                }
            }, 500));
            
            // معالج حدث الضغط على زر Enter
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = this.searchInput.value.trim();
                    if (query.length >= 2) {
                        this.searchQuery = query;
                        this.performSearch(true); // فتح نافذة النتائج
                    }
                }
            });
        }
        
        // معالج أحداث زر البحث
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = this.searchInput.value.trim();
                if (query.length >= 2) {
                    this.searchQuery = query;
                    this.performSearch(true); // فتح نافذة النتائج
                }
            });
        }
        
        // معالجات أحداث خيارات البحث
        document.querySelectorAll('input[name="searchType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // إظهار/إخفاء خيارات البحث في المنشورات
                const postSearchTypes = document.getElementById('postSearchTypes');
                if (postSearchTypes) {
                    postSearchTypes.style.display = radio.id === 'searchPosts' ? 'block' : 'none';
                }
                
                // إذا تم تغيير نوع البحث وكان هناك استعلام، إعادة البحث
                if (this.searchQuery.length >= 2) {
                    this.performSearch();
                }
            });
        });
        
        // معالجات أحداث خيارات البحث في المنشورات
        document.querySelectorAll('input[name="postSearchType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // تحديث نوع البحث وإعادة البحث إذا كان هناك استعلام
                switch (radio.id) {
                    case 'searchPostsContent':
                        this.searchType = 'content';
                        break;
                    case 'searchPostsAuthor':
                        this.searchType = 'author';
                        break;
                    default:
                        this.searchType = 'all';
                }
                
                if (this.searchQuery.length >= 2) {
                    this.performSearch();
                }
            });
        });
        
        // معالجات أحداث خيارات البحث في نافذة النتائج
        document.querySelectorAll('input[name="searchTypeRadio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // تحديث نوع البحث وإعادة البحث
                switch (radio.id) {
                    case 'searchTypeContent':
                        this.searchType = 'content';
                        break;
                    case 'searchTypeAuthor':
                        this.searchType = 'author';
                        break;
                    default:
                        this.searchType = 'all';
                }
                
                if (this.searchQuery.length >= 2) {
                    this.performSearch();
                }
            });
        });
    }

    // إجراء البحث
    async performSearch(showModal = false) {
        if (this.isSearching || !this.searchQuery) return;
        
        this.isSearching = true;
        this.searchResults = [];
        
        // عرض حالة التحميل
        this.showLoadingState();
        
        try {
            // تحديد مرجع البحث (فقط المنشورات حاليًا)
            let searchRef = this.postsRef.orderByChild('timestamp').limitToLast(100);
            
            // الحصول على البيانات
            const snapshot = await searchRef.once('value');
            
            // معالجة النتائج
            snapshot.forEach(childSnapshot => {
                const post = childSnapshot.val();
                post.id = childSnapshot.key;
                
                // إجراء البحث حسب النوع
                let match = false;
                
                if (this.searchType === 'author' || this.searchType === 'all') {
                    // البحث في اسم الكاتب
                    if (post.authorName && post.authorName.toLowerCase().includes(this.searchQuery.toLowerCase())) {
                        match = true;
                    }
                }
                
                if ((this.searchType === 'content' || this.searchType === 'all') && !match) {
                    // البحث في نص المنشور
                    if (post.text && post.text.toLowerCase().includes(this.searchQuery.toLowerCase())) {
                        match = true;
                    }
                }
                
                if (match) {
                    this.searchResults.push(post);
                }
            });
            
            // ترتيب النتائج (الأحدث أولاً)
            this.searchResults.sort((a, b) => b.timestamp - a.timestamp);
            
            // تحديد نتائج البحث بعدد محدد
            if (this.searchResults.length > this.searchLimit) {
                this.searchResults = this.searchResults.slice(0, this.searchLimit);
            }
            
            // عرض النتائج
            this.displaySearchResults();
            
            // فتح نافذة النتائج إذا طلب ذلك
            if (showModal) {
                this.openSearchResultsModal();
            }
            
        } catch (error) {
            console.error('Error searching posts:', error);
            this.showErrorState('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
        } finally {
            this.isSearching = false;
        }
    }

    // عرض نتائج البحث
    displaySearchResults() {
        // التأكد من وجود حاوية النتائج
        if (!this.searchResultsContainer) return;
        
        // إزالة حالة التحميل
        this.searchResultsContainer.querySelector('.search-loading')?.style.setProperty('display', 'none');
        
        // التحقق من وجود نتائج
        if (this.searchResults.length === 0) {
            // عرض رسالة عدم وجود نتائج
            const noResults = this.searchResultsContainer.querySelector('.no-results');
            if (noResults) {
                noResults.style.display = 'flex';
            }
            return;
        }
        
        // إخفاء رسالة عدم وجود نتائج
        const noResults = this.searchResultsContainer.querySelector('.no-results');
        if (noResults) {
            noResults.style.display = 'none';
        }
        
        // إنشاء عناصر نتائج البحث
        const resultsHtml = this.searchResults.map(post => {
            // تنسيق وقت المنشور
            const postTime = this.formatPostTime(post.timestamp);
            
            // تمييز النص المطابق
            let highlightedText = '';
            if (post.text) {
                highlightedText = this.highlightMatchedText(post.text, this.searchQuery);
                // اقتصاص النص الطويل
                if (highlightedText.length > 150) {
                    highlightedText = highlightedText.substring(0, 150) + '...';
                }
            }
            
            // تمييز اسم الكاتب إذا كان مطابقًا
            const highlightedAuthor = this.highlightMatchedText(post.authorName || 'غير معروف', this.searchQuery);
            
            // تحديد نوع ومعاينة الوسائط
            let mediaPreview = '';
            if (post.mediaType === 'image' && post.mediaUrl) {
                mediaPreview = `
                    <div class="search-result-media">
                        <img src="${post.mediaUrl}" alt="صورة المنشور" class="search-result-image">
                    </div>
                `;
            } else if (post.mediaType === 'video' && post.mediaUrl) {
                mediaPreview = `
                    <div class="search-result-media">
                        <div class="video-preview-container">
                            <i class="fas fa-play-circle"></i>
                            <img src="https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd" alt="معاينة الفيديو" class="video-preview">
                        </div>
                    </div>
                `;
            }
            
            // إنشاء HTML لنتيجة البحث
            return `
                <div class="search-result-item" data-post-id="${post.id}">
                    <div class="search-result-header">
                        <div class="search-result-user">
                            <img src="${post.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                                 alt="صورة المستخدم" class="search-result-avatar">
                            <div class="search-result-user-info">
                                <h6>${highlightedAuthor}</h6>
                                <small>${postTime}</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="search-result-content">
                        ${highlightedText ? `<p class="search-result-text">${highlightedText}</p>` : ''}
                        ${mediaPreview}
                    </div>
                    
                    <div class="search-result-actions">
                        <button class="btn btn-gold view-post-btn" onclick="postSearchSystem.viewPost('${post.id}')">
                            <i class="fas fa-eye"></i>
                            <span>عرض المنشور</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // إضافة عناصر النتائج إلى الحاوية
        const resultsWrapper = document.createElement('div');
        resultsWrapper.className = 'search-results-wrapper';
        resultsWrapper.innerHTML = resultsHtml;
        
        // إزالة النتائج السابقة
        const existingResults = this.searchResultsContainer.querySelector('.search-results-wrapper');
        if (existingResults) {
            existingResults.remove();
        }
        
        this.searchResultsContainer.appendChild(resultsWrapper);
        
        // تحديث عدد النتائج في نافذة النتائج
        const searchQueryDisplay = document.getElementById('searchQueryDisplay');
        if (searchQueryDisplay) {
            searchQueryDisplay.textContent = `"${this.searchQuery}" (${this.searchResults.length} نتيجة)`;
        }
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

    // تمييز النص المطابق
    highlightMatchedText(text, query) {
        if (!text || !query) return text;
        
        // استبدال النص المطابق بنص ممَيَّز
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="highlight-text">$1</span>');
    }

    // عرض حالة التحميل
    showLoadingState() {
        if (!this.searchResultsContainer) return;
        
        // إظهار مؤشر التحميل
        const loadingEl = this.searchResultsContainer.querySelector('.search-loading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
        
        // إخفاء رسالة عدم وجود نتائج
        const noResults = this.searchResultsContainer.querySelector('.no-results');
        if (noResults) {
            noResults.style.display = 'none';
        }
        
        // إزالة النتائج السابقة
        const existingResults = this.searchResultsContainer.querySelector('.search-results-wrapper');
        if (existingResults) {
            existingResults.remove();
        }
    }

    // عرض حالة الخطأ
    showErrorState(message) {
        if (!this.searchResultsContainer) return;
        
        // إخفاء مؤشر التحميل
        const loadingEl = this.searchResultsContainer.querySelector('.search-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        // إزالة النتائج السابقة
        const existingResults = this.searchResultsContainer.querySelector('.search-results-wrapper');
        if (existingResults) {
            existingResults.remove();
        }
        
        // عرض رسالة الخطأ
        const errorEl = document.createElement('div');
        errorEl.className = 'search-error';
        errorEl.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn btn-primary mt-3" onclick="postSearchSystem.performSearch()">
                <i class="fas fa-sync-alt"></i>
                إعادة المحاولة
            </button>
        `;
        
        this.searchResultsContainer.appendChild(errorEl);
    }

    // مسح نتائج البحث
    clearSearchResults() {
        if (!this.searchResultsContainer) return;
        
        // إزالة النتائج السابقة
        const existingResults = this.searchResultsContainer.querySelector('.search-results-wrapper');
        if (existingResults) {
            existingResults.remove();
        }
        
        // إخفاء رسالة عدم وجود نتائج
        const noResults = this.searchResultsContainer.querySelector('.no-results');
        if (noResults) {
            noResults.style.display = 'none';
        }
        
        // إخفاء رسالة الخطأ
        const errorEl = this.searchResultsContainer.querySelector('.search-error');
        if (errorEl) {
            errorEl.remove();
        }
    }

    // فتح نافذة نتائج البحث
    openSearchResultsModal() {
        // تحديث عنوان النافذة
        const searchQueryDisplay = document.getElementById('searchQueryDisplay');
        if (searchQueryDisplay) {
            searchQueryDisplay.textContent = `"${this.searchQuery}" (${this.searchResults.length} نتيجة)`;
        }
        
        // فتح النافذة
        const modal = document.getElementById('searchResultsModal');
        if (modal) {
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
        } else {
            // إذا لم تكن النافذة موجودة، استخدم SweetAlert2
            Swal.fire({
                title: `نتائج البحث: "${this.searchQuery}"`,
                html: `
                    <div class="search-results-container">
                        ${this.searchResults.length === 0 
                            ? '<div class="no-results"><i class="fas fa-search fa-3x"></i><p>لا توجد نتائج للبحث</p></div>' 
                            : '<div class="search-results-wrapper">' + this.searchResults.map(post => {
                                const postTime = this.formatPostTime(post.timestamp);
                                const highlightedText = this.highlightMatchedText(post.text, this.searchQuery);
                                return `
                                    <div class="search-result-item" data-post-id="${post.id}">
                                        <div class="search-result-header">
                                            <div class="search-result-user">
                                                <img src="${post.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" 
                                                     alt="صورة المستخدم" class="search-result-avatar">
                                                <div class="search-result-user-info">
                                                    <h6>${this.highlightMatchedText(post.authorName || 'غير معروف', this.searchQuery)}</h6>
                                                    <small>${postTime}</small>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="search-result-content">
                                            ${highlightedText ? `<p class="search-result-text">${highlightedText}</p>` : ''}
                                        </div>
                                        
                                        <div class="search-result-actions">
                                            <button class="btn btn-gold view-post-btn" onclick="postSearchSystem.viewPost('${post.id}')">
                                                <i class="fas fa-eye"></i>
                                                <span>عرض المنشور</span>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('') + '</div>'
                        }
                    </div>
                `,
                width: '700px',
                showConfirmButton: false,
                showCloseButton: true,
                customClass: {
                    container: 'search-results-modal-container',
                    popup: 'search-results-modal',
                    header: 'search-results-modal-header',
                    closeButton: 'search-results-modal-close',
                    content: 'search-results-modal-content'
                }
            });
        }
    }

    // عرض المنشور المحدد
    viewPost(postId) {
        if (!postId) return;
        
        // إغلاق نافذة النتائج
        const modal = document.getElementById('searchResultsModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
        
        // البحث عن المنشور في الصفحة الحالية
        const existingPost = document.querySelector(`.post[data-post-id="${postId}"]`);
        if (existingPost) {
            // التمرير إلى المنشور
            existingPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // إضافة تأثير تمييز
            existingPost.classList.add('highlight-post');
            setTimeout(() => {
                existingPost.classList.remove('highlight-post');
            }, 3000);
            
            return;
        }
        
        // إذا لم يكن المنشور موجودًا في الصفحة الحالية
        // نبحث عنه في قاعدة البيانات ونعرضه
        this.postsRef.child(postId).once('value')
            .then(snapshot => {
                const post = snapshot.val();
                if (!post) {
                    showToast('لم يتم العثور على المنشور', 'error');
                    return;
                }
                
                // إضافة معرف المنشور إلى البيانات
                post.id = postId;
                
                // عرض المنشور في نافذة مستقلة
                this.showPostModal(post);
            })
            .catch(error => {
                console.error('Error fetching post:', error);
                showToast('حدث خطأ أثناء جلب المنشور', 'error');
            });
    }

    // عرض المنشور في نافذة مستقلة
    showPostModal(post) {
        // إنشاء محتوى وسائط المنشور
        let mediaContent = '';
        if (post.mediaType && post.mediaUrl) {
            if (post.mediaType === 'image') {
                mediaContent = `
                    <div class="post-media">
                        <img src="${post.mediaUrl}" alt="صورة المنشور" class="post-image">
                    </div>
                `;
            } else if (post.mediaType === 'video') {
                mediaContent = `
                    <div class="post-media">
                        <video src="${post.mediaUrl}" controls class="post-video"></video>
                    </div>
                `;
            }
        }
        
        // شارة السائق
        const driverBadge = post.fromDriver ? 
            `<span class="driver-badge">
                <i class="fas fa-taxi"></i> سائق
            </span>` : '';
            
        // تنسيق وقت المنشور
        const postTime = this.formatPostTime(post.timestamp);
        
        // عرض النافذة باستخدام SweetAlert2
        Swal.fire({
            title: '',
            html: `
                <div class="post-modal">
                    <div class="post-header">
                        <div class="post-user">
                            <img src="${post.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
                            <div class="post-user-info">
                                <h6>${post.authorName} ${driverBadge}</h6>
                                <small>${postTime} <i class="fas fa-globe-asia fa-sm"></i></small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="post-content">
                        ${post.text ? `<p class="post-text">${post.text}</p>` : ''}
                        ${mediaContent}
                    </div>
                    
                    <div class="post-stats">
                        <div class="post-likes">
                            <i class="fas fa-heart"></i>
                            <span>${post.likes || 0}</span>
                        </div>
                        <div class="post-comments-shares">
                            <span>${post.comments || 0} تعليق</span>
                            <span>${post.shares || 0} مشاركة</span>
                        </div>
                    </div>
                    
                    <div class="post-modal-actions">
                        <button class="btn btn-secondary" onclick="Swal.close()">
                            <i class="fas fa-times"></i>
                            إغلاق
                        </button>
                        <button class="btn btn-gold" onclick="postSearchSystem.goToMainPost('${post.id}')">
                            <i class="fas fa-external-link-alt"></i>
                            عرض في الصفحة الرئيسية
                        </button>
                    </div>
                </div>
            `,
            width: '600px',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                container: 'post-modal-container',
                popup: 'post-modal-popup',
                header: 'post-modal-header',
                closeButton: 'post-modal-close',
                content: 'post-modal-content'
            }
        });
    }

    // الانتقال إلى المنشور في الصفحة الرئيسية
    goToMainPost(postId) {
        // إغلاق النافذة المنبثقة
        Swal.close();
        
        // التأكد من عرض قسم المنشورات
        const postsSection = document.querySelector('.posts-section');
        if (postsSection) {
            postsSection.style.display = 'block';
        }
        
        // إخفاء الأقسام الأخرى مثل المحفوظات
        const savedPostsSection = document.getElementById('savedPostsSection');
        if (savedPostsSection) {
            savedPostsSection.style.display = 'none';
        }
        
        // البحث عن المنشور في الصفحة
        let existingPost = document.querySelector(`.post[data-post-id="${postId}"]`);
        
        if (existingPost) {
            // المنشور موجود بالفعل، التمرير إليه
            existingPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // إضافة تأثير تمييز
            existingPost.classList.add('highlight-post');
            setTimeout(() => {
                existingPost.classList.remove('highlight-post');
            }, 3000);
        } else {
            // المنشور غير موجود، محاولة تحميله
            
            // أولاً، نتحقق مما إذا كان window.postsManager متاحًا
            if (window.postsManager) {
                // جلب المنشور وإضافته إلى الصفحة
                this.postsRef.child(postId).once('value')
                    .then(snapshot => {
                        const post = snapshot.val();
                        if (!post) {
                            showToast('لم يتم العثور على المنشور', 'error');
                            return;
                        }
                        
                        // إضافة المنشور إلى DOM
                        window.postsManager.addPostToDOM(postId, post);
                        
                        // الانتظار قليلاً للتأكد من إضافة المنشور ثم التمرير إليه
                        setTimeout(() => {
                            existingPost = document.querySelector(`.post[data-post-id="${postId}"]`);
                            if (existingPost) {
                                existingPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                existingPost.classList.add('highlight-post');
                                setTimeout(() => {
                                    existingPost.classList.remove('highlight-post');
                                }, 3000);
                            }
                        }, 500);
                    })
                    .catch(error => {
                        console.error('Error fetching post for main page:', error);
                        showToast('حدث خطأ أثناء جلب المنشور', 'error');
                    });
            } else {
                // إذا لم يكن مدير المنشورات متاحًا، نعرض رسالة خطأ
                showToast('غير قادر على عرض المنشور في الصفحة الرئيسية', 'error');
            }
        }
    }

    // دالة للتأخير (يستخدم مع البحث الفوري)
    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
}

// إنشاء نسخة عالمية من نظام البحث
window.postSearchSystem = new PostSearchSystem();

// تهيئة نظام البحث عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.postSearchSystem.init();
});

// إضافة الأنماط CSS لنظام البحث
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        /* أنماط البحث الرئيسية */
        .search-input {
            background-color: #222;
            color: #fff;
            border: 1px solid #444;
            border-radius: 20px;
            padding: 8px 15px;
            transition: all 0.3s ease;
            font-size: 14px;
            direction: rtl;
        }
        
        .search-input:focus {
            border-color: #FFD700;
            box-shadow: 0 0 0 0.2rem rgba(255, 215, 0, 0.25);
            background-color: #333;
        }
        
        .search-btn {
            background-color: #FFD700;
            color: #000;
            border: none;
            border-radius: 0 20px 20px 0;
            margin-left: -1px;
            transition: all 0.3s ease;
        }
        
        .search-btn:hover {
            background-color: #f0c800;
            transform: translateY(-2px);
        }
        
        /* أنماط نتائج البحث */
        .search-results-container {
            max-height: 70vh;
            overflow-y: auto;
            padding: 10px;
        }
        
        .search-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .search-loading .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 215, 0, 0.3);
            border-radius: 50%;
            border-top: 4px solid #FFD700;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .no-results {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            color: #888;
            text-align: center;
        }
        
        .no-results i {
            margin-bottom: 15px;
            color: #555;
        }
        
        .search-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            color: #ff6b6b;
            text-align: center;
        }
        
        .search-error i {
            margin-bottom: 15px;
            font-size: 2rem;
        }
        
        /* أنماط بطاقة نتيجة البحث */
        .search-result-item {
            background-color: #242424;
            border-radius: 10px;
            margin-bottom: 15px;
            overflow: hidden;
            padding: 15px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            animation: fadeIn 0.5s ease;
        }
        
        .search-result-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 215, 0, 0.3);
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .search-result-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .search-result-user {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .search-result-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #FFD700;
        }
        
        .search-result-user-info h6 {
            margin: 0;
            font-size: 0.9rem;
            color: #fff;
        }
        
        .search-result-user-info small {
            font-size: 0.75rem;
            color: #aaa;
        }
        
        .search-result-content {
            margin-bottom: 15px;
        }
        
        .search-result-text {
            color: #ddd;
            font-size: 0.9rem;
            margin-bottom: 10px;
            line-height: 1.5;
        }
        
        .search-result-media {
            max-height: 200px;
            overflow: hidden;
            border-radius: 8px;
            margin-top: 10px;
        }
        
        .search-result-image {
            width: 100%;
            height: auto;
            border-radius: 8px;
            object-fit: cover;
        }
        
        .video-preview-container {
            position: relative;
            width: 100%;
            height: 120px;
            background-color: #000;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .video-preview-container i {
            position: absolute;
            font-size: 3rem;
            color: #FFD700;
            opacity: 0.8;
            transition: all 0.3s ease;
        }
        
        .video-preview-container:hover i {
            transform: scale(1.1);
            opacity: 1;
        }
        
        .video-preview {
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.5;
        }
        
        .search-result-actions {
            display: flex;
            justify-content: flex-end;
        }
        
        .view-post-btn {
            background-color: #FFD700;
            color: #000;
            border: none;
            border-radius: 20px;
            padding: 6px 15px;
            font-size: 0.9rem;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .view-post-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(255, 215, 0, 0.4);
        }
        
        .view-post-btn:active {
            transform: translateY(0);
        }
        
        /* تمييز النص المطابق */
        .highlight-text {
            background-color: rgba(255, 215, 0, 0.3);
            color: #FFD700;
            padding: 0 2px;
            border-radius: 2px;
            font-weight: bold;
        }
        
        /* تمييز المنشور عند الانتقال إليه */
        .highlight-post {
            animation: highlightPulse 3s ease;
        }
        
        @keyframes highlightPulse {
            0%, 100% { box-shadow: 0 0 0 rgba(255, 215, 0, 0.5); }
            50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
        }
        
        /* أنماط نافذة المنشور المستقلة */
        .post-modal {
            background-color: #242424;
            border-radius: 10px;
            padding: 15px;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .post-modal .post-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        
        .post-modal .post-user {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .post-modal .post-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #FFD700;
        }
        
        .post-modal .post-content {
            margin-bottom: 20px;
        }
        
        .post-modal .post-text {
            color: #fff;
            font-size: 1rem;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        
        .post-modal .post-media {
            margin-top: 15px;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .post-modal .post-image {
            width: 100%;
            border-radius: 10px;
        }
        
        .post-modal .post-video {
            width: 100%;
            border-radius: 10px;
        }
        
        .post-modal .post-stats {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 15px;
            color: #bbb;
            font-size: 0.9rem;
        }
        
        .post-modal .post-likes {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .post-modal .post-likes i {
            color: #ff6b6b;
        }
        
        .post-modal .post-comments-shares {
            display: flex;
            gap: 15px;
        }
        
        .post-modal-actions {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 15px;
        }
        
        .post-modal-actions button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            border-radius: 8px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .post-modal-actions button:hover {
            transform: translateY(-2px);
        }
        
        /* تعديلات خاصة بالموبايل */
        @media (max-width: 768px) {
            .search-results-container {
                max-height: 60vh;
            }
            
            .search-result-item {
                padding: 10px;
            }
            
            .search-result-avatar {
                width: 35px;
                height: 35px;
            }
            
            .search-result-text {
                font-size: 0.85rem;
            }
            
            .view-post-btn {
                padding: 5px 12px;
                font-size: 0.8rem;
            }
            
            .post-modal {
                padding: 10px;
            }
            
            .post-modal .post-avatar {
                width: 40px;
                height: 40px;
            }
            
            .post-modal .post-user-info h6 {
                font-size: 0.9rem;
            }
            
            .post-modal .post-text {
                font-size: 0.9rem;
            }
        }
    `;
    
    document.head.appendChild(style);
});


