// saved-posts.js - مدير المنشورات المحفوظة لتطبيق تاكسي العراق

class SavedPostsManager {
    constructor() {
        this.database = firebase.database();
        this.currentUser = null;
        this.savedPostsRef = null;
        this.postsRef = this.database.ref('posts');
        this.isLoading = false;
        this.savedPosts = [];
        this.initialized = false;
    }

    // تهيئة مدير المنشورات المحفوظة
    init() {
        // التحقق من المستخدم الحالي
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            if (this.currentUser && this.currentUser.uid) {
                this.savedPostsRef = this.database.ref(`savedPosts/${this.currentUser.uid}`);
            }
        }

        // مراقبة تغييرات المستخدم
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.database.ref(`users/${user.uid}`).once('value').then(snapshot => {
                    const userData = snapshot.val();
                    if (userData) {
                        this.currentUser = { ...userData, uid: user.uid };
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                        this.savedPostsRef = this.database.ref(`savedPosts/${this.currentUser.uid}`);
                    }
                });
            } else {
                this.currentUser = null;
                this.savedPostsRef = null;
                localStorage.removeItem('currentUser');
            }
        });

        this.initialized = true;
    }

    // تحميل صفحة المنشورات المحفوظة
    async loadSavedPostsPage() {
        // التحقق من تسجيل الدخول
        if (!this.currentUser) {
            Swal.fire({
                title: 'مطلوب تسجيل الدخول',
                text: 'يجب عليك تسجيل الدخول أولاً لعرض المنشورات المحفوظة',
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

        // إنشاء أو تحديث قسم المنشورات المحفوظة في الصفحة الحالية
        this.createOrUpdateSavedPostsSection();

        // تحميل المنشورات المحفوظة
        await this.loadSavedPosts();

        // إغلاق القائمة الجانبية إذا كانت مفتوحة
        const sideNav = document.getElementById('sideNav');
        const navBackdrop = document.getElementById('navBackdrop');
        if (sideNav && sideNav.classList.contains('open')) {
            sideNav.classList.remove('open');
            if (navBackdrop) navBackdrop.classList.remove('show');
        }
    }

 // تحديث دالة createOrUpdateSavedPostsSection لوضع المنشورات المحفوظة في بداية الصفحة

// تحديث دالة createOrUpdateSavedPostsSection لوضع المنشورات المحفوظة في بداية الصفحة

createOrUpdateSavedPostsSection() {
    // Verificar si existe la sección de publicaciones guardadas
    let savedPostsSection = document.getElementById('savedPostsSection');
    
    if (!savedPostsSection) {
        // Crear la sección de publicaciones guardadas
        savedPostsSection = document.createElement('div');
        savedPostsSection.id = 'savedPostsSection';
        savedPostsSection.className = 'saved-posts-section';
        
        // Crear el encabezado
        const headerContainer = document.createElement('div');
        headerContainer.className = 'section-header';
        headerContainer.innerHTML = `
            <h3><i class="fas fa-bookmark"></i> المنشورات المحفوظة</h3>
            <button id="backToMain" class="btn btn-outline-secondary btn-sm">
                <i class="fas fa-arrow-right"></i> العودة
            </button>
        `;
        savedPostsSection.appendChild(headerContainer);
        
        // Crear el contenedor de publicaciones guardadas
        const postsContainer = document.createElement('div');
        postsContainer.id = 'savedPostsContainer';
        postsContainer.className = 'saved-posts-container';
        
        // Añadir indicador de carga
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'savedPostsLoading';
        loadingIndicator.className = 'loading-posts';
        loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <p>جاري تحميل المنشورات المحفوظة...</p>
        `;
        postsContainer.appendChild(loadingIndicator);
        
        // Añadir mensaje de no hay publicaciones
        const noPosts = document.createElement('div');
        noPosts.id = 'noSavedPosts';
        noPosts.className = 'no-posts';
        noPosts.style.display = 'none';
        noPosts.innerHTML = `
            <i class="far fa-bookmark fa-4x"></i>
            <p>لا توجد منشورات محفوظة</p>
            <p>يمكنك حفظ المنشورات التي تهمك للرجوع إليها لاحقاً</p>
        `;
        postsContainer.appendChild(noPosts);
        
        savedPostsSection.appendChild(postsContainer);
        
        // Añadir la sección al inicio del contenedor principal
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            // Ocultar las otras secciones
            const otherSections = mainContainer.querySelectorAll('.stories-container, .posts-section, #map, .drivers-grid');
            otherSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Añadir la sección de publicaciones guardadas al inicio del contenedor principal
            mainContainer.prepend(savedPostsSection);
            
            // Desplazarse al inicio de la página
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Añadir evento para el botón de volver
            const backButton = savedPostsSection.querySelector('#backToMain');
            backButton.addEventListener('click', () => this.backToMainPage());
        }
    } else {
        // Mostrar la sección de publicaciones guardadas y ocultar las otras secciones
        savedPostsSection.style.display = 'block';
        
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            const otherSections = mainContainer.querySelectorAll('.stories-container, .posts-section, #map, .drivers-grid');
            otherSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Asegurarse de que la sección de publicaciones guardadas esté al inicio del contenedor
            if (mainContainer.firstChild !== savedPostsSection) {
                mainContainer.removeChild(savedPostsSection);
                mainContainer.prepend(savedPostsSection);
            }
            
            // Desplazarse al inicio de la página
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Reiniciar el contenedor de publicaciones
        const postsContainer = document.getElementById('savedPostsContainer');
        if (postsContainer) {
            const loadingIndicator = document.getElementById('savedPostsLoading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }
            
            // Eliminar publicaciones anteriores
            const posts = postsContainer.querySelectorAll('.post');
            posts.forEach(post => post.remove());
            
            // Ocultar mensaje de no hay publicaciones
            const noPosts = document.getElementById('noSavedPosts');
            if (noPosts) {
                noPosts.style.display = 'none';
            }
        }
    }
}

// Reemplaza la función backToMainPage en saved-posts.js con esta versión mejorada
backToMainPage() {
    // Ocultar la sección de publicaciones guardadas
    const savedPostsSection = document.getElementById('savedPostsSection');
    if (savedPostsSection) {
        savedPostsSection.style.display = 'none';
    }
    
    // Mostrar las otras secciones
    const mainContainer = document.querySelector('.container');
    if (mainContainer) {
        // Mostrar todas las otras secciones
        const otherSections = mainContainer.querySelectorAll('.stories-container, .posts-section');
        otherSections.forEach(section => {
            section.style.display = '';
        });
        
        // Manejar elementos de mapa y otras listas de manera especial
        const map = document.getElementById('map');
        if (map) {
            // Verificar si estamos en la página de mapa
            const currentPath = window.location.pathname;
            if (currentPath.endsWith('map.html') || currentPath.includes('/map') || currentPath === '/' || currentPath === '') {
                map.style.display = 'block';
            }
        }
        
        const driversGrid = document.querySelector('.drivers-grid');
        if (driversGrid) {
            // Verificar si estamos en la página de conductores
            const currentPath = window.location.pathname;
            if (currentPath.endsWith('drivers.html') || currentPath.includes('/drivers')) {
                driversGrid.style.display = 'grid';
            }
        }
    }
    
    // Desplazarse al inicio de la página
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
    // العودة إلى الصفحة الرئيسية
    backToMainPage() {
        // إخفاء قسم المنشورات المحفوظة
        const savedPostsSection = document.getElementById('savedPostsSection');
        if (savedPostsSection) {
            savedPostsSection.style.display = 'none';
        }
        
        // إظهار الأقسام الأخرى
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            const otherSections = mainContainer.querySelectorAll('.stories-container, .posts-section, #map, .drivers-grid');
            otherSections.forEach(section => {
                section.style.display = '';
            });
        }
    }
// تحميل المنشورات المحفوظة
async loadSavedPosts() {
    if (!this.currentUser || !this.savedPostsRef) {
        console.error('User not logged in or saved posts reference not available');
        this.showNoSavedPosts();
        return;
    }
    
    this.isLoading = true;
    const loadingEl = document.getElementById('savedPostsLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
    
    try {
        // الحصول على قائمة المنشورات المحفوظة
        const savedPostsSnapshot = await this.savedPostsRef.once('value');
        const savedPostsData = savedPostsSnapshot.val();
        
        if (!savedPostsData) {
            this.showNoSavedPosts();
            return;
        }
        
        // استخراج المنشورات المحفوظة
        const postsData = [];
        
        for (const postId in savedPostsData) {
            try {
                // الهيكل الجديد: البيانات المخزنة مباشرة في المحفوظات
                if (savedPostsData[postId].postData) {
                    // استخدام البيانات المخزنة مباشرة
                    postsData.push({
                        id: postId,
                        savedAt: savedPostsData[postId].timestamp,
                        ...savedPostsData[postId].postData
                    });
                } 
                // الهيكل القديم: مرجع فقط
                else {
                    // محاولة استرداد البيانات من مرجع المنشورات
                    const postSnapshot = await this.postsRef.child(postId).once('value');
                    const postData = postSnapshot.val();
                    
                    if (postData) {
                        postsData.push({
                            id: postId,
                            ...postData
                        });
                    }
                }
            } catch (error) {
                console.error(`Error loading saved post ${postId}:`, error);
            }
        }
        
        // ترتيب المنشورات حسب تاريخ الحفظ أو الإنشاء (الأحدث أولاً)
        postsData.sort((a, b) => {
            // استخدام تاريخ الحفظ إن وجد، وإلا استخدام تاريخ الإنشاء
            const timeA = a.savedAt || a.timestamp;
            const timeB = b.savedAt || b.timestamp;
            return timeB - timeA;
        });
        
        // حفظ المنشورات المحفوظة
        this.savedPosts = postsData;
        
        if (this.savedPosts.length === 0) {
            this.showNoSavedPosts();
            return;
        }
        
        // عرض المنشورات
        this.displaySavedPosts();
        
    } catch (error) {
        console.error('Error loading saved posts:', error);
        this.showErrorMessage('حدث خطأ أثناء تحميل المنشورات المحفوظة');
    } finally {
        this.isLoading = false;
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
}
    // Modificación de la función de displaySavedPosts para corregir el error
// Necesitamos asegurarnos de que esté usando los métodos correctos para formatear el texto y el tiempo

// displaySavedPosts modificado
displaySavedPosts() {
    const postsContainer = document.getElementById('savedPostsContainer');
    const noPosts = document.getElementById('noSavedPosts');
    
    if (!postsContainer) return;
    
    // Verificar si hay posts guardados
    if (this.savedPosts.length === 0) {
        this.showNoSavedPosts();
        return;
    }
    
    // Ocultar el mensaje de "no hay posts guardados"
    if (noPosts) {
        noPosts.style.display = 'none';
    }
    
    // Mostrar los posts guardados
    this.savedPosts.forEach(post => {
        // Verificar si window.postsManager existe y tiene el método addPostToDOM
        if (window.postsManager && typeof window.postsManager.addPostToDOM === 'function' && 
            window.postsManager.formatPostTime && typeof window.postsManager.formatPostTime === 'function' &&
            window.postsManager.formatPostText && typeof window.postsManager.formatPostText === 'function') {
            // Usar el método del gestor de posts
            window.postsManager.addPostToDOM(post.id, post);
        } else {
            // Si no existe el gestor de posts, usar el método interno
            this.createPostCard(post, postsContainer);
        }
    });
    
    // Actualizar el estado de los botones de guardado
    this.updateSaveButtonsState();
}

// Agregar los métodos de formateo como función de respaldo
// Si estos métodos no están disponibles en window.postsManager, 
// SavedPostsManager los usará directamente

// Formatear texto del post
formatPostText(text) {
    if (!text) return '';
    
    // Convertir enlaces a enlaces clickeables
    let formattedText = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    
    // Convertir hashtags a enlaces
    formattedText = formattedText.replace(/#(\w+)/g, '<a href="#" class="hashtag">#$1</a>');
    
    // Convertir menciones a enlaces
    formattedText = formattedText.replace(/@(\w+)/g, '<a href="#" class="mention">@$1</a>');
    
    // Convertir saltos de línea a <br>
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

// Formatear tiempo del post
formatPostTime(timestamp) {
    if (!timestamp) return 'الآن';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // Menos de un minuto
    if (diff < 60 * 1000) {
        return 'الآن';
    }
    
    // Menos de una hora
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `منذ ${minutes} دقيقة${minutes > 2 ? '' : ''}`;
    }
    
    // Menos de un día
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `منذ ${hours} ساعة${hours > 2 ? 'ات' : ''}`;
    }
    
    // Menos de una semana
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `منذ ${days} يوم${days > 1 ? '' : ''}`;
    }
    
    // Fecha completa
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Modificar el método createPostCard para usar los métodos internos
createPostCard(post, container) {
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.setAttribute('data-post-id', post.id);
    
    // Formatear el tiempo
    const postTime = this.formatPostTime(post.timestamp);
    
    // Insignia de conductor
    const driverBadge = post.fromDriver ? 
        `<span class="driver-badge">
            <i class="fas fa-taxi"></i> سائق
        </span>` : '';
    
    // Crear contenido multimedia
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
    
    // Crear HTML para el post
    postElement.innerHTML = `
    <div class="post-header">
        <div class="post-user">
            <img src="${post.authorImage || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd'}" alt="صورة المستخدم" class="post-avatar">
            <div class="post-user-info">
                <h6>${post.authorName} ${driverBadge}</h6>
                <small>${postTime} <i class="fas fa-globe-asia fa-sm"></i></small>
            </div>
        </div>
        <div class="post-options">
            <button class="post-options-btn">
                <i class="fas fa-ellipsis-h"></i>
            </button>
            <div class="post-options-menu">
                <button class="post-option-item save-post-btn" data-post-id="${post.id}" onclick="window.savedPostsManager.unsavePost('${post.id}')">
                    <i class="fas fa-bookmark"></i> إزالة من المحفوظات
                </button>
                <button class="post-option-item report-post-btn" data-post-id="${post.id}">
                    <i class="fas fa-flag"></i> الإبلاغ عن المنشور
                </button>
            </div>
        </div>
    </div>
    
    <div class="post-content">
        ${post.text ? `<p class="post-text">${this.formatPostText(post.text)}</p>` : ''}
        ${mediaContent}
    </div>
    
    <div class="post-stats">
        <div class="post-likes">
            <i class="fas fa-heart"></i>
            <span id="likes-count-${post.id}">${post.likes || 0}</span>
        </div>
        <div class="post-comments-shares">
            <span id="comments-count-${post.id}">${post.comments || 0} تعليق</span>
            <span>${post.shares || 0} مشاركة</span>
        </div>
    </div>
    
    <div class="post-actions">
        <button class="post-action-btn like-btn" data-post-id="${post.id}">
            <i class="far fa-heart"></i>
            <span>إعجاب</span>
        </button>
        <button class="post-action-btn comment-btn" data-post-id="${post.id}" data-bs-toggle="modal" data-bs-target="#commentsModal">
            <i class="far fa-comment"></i>
            <span>تعليق</span>
        </button>
        <button class="post-action-btn share-btn" data-post-id="${post.id}">
            <i class="far fa-share-square"></i>
            <span>مشاركة</span>
        </button>
        <button class="post-action-btn save-btn active" data-post-id="${post.id}" onclick="window.savedPostsManager.unsavePost('${post.id}')">
            <i class="fas fa-bookmark"></i>
            <span>محفوظ</span>
        </button>
    </div>
    `;
    
    // Agregar el post al contenedor
    container.appendChild(postElement);
    
    // Agregar el manejador de clic para las opciones del post
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
    
    // Agregar manejador para el botón de Like
    const likeBtn = postElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (window.postsManager && typeof window.postsManager.toggleLike === 'function') {
                window.postsManager.toggleLike(post.id);
            }
        });
    }
    
    // Agregar manejador para el botón de Compartir
    const shareBtn = postElement.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (window.postsManager && typeof window.postsManager.sharePost === 'function') {
                window.postsManager.sharePost(post.id);
            }
        });
    }
}
    // إزالة منشور من المحفوظات
    async unsavePost(postId) {
        if (!this.currentUser || !this.savedPostsRef) {
            showToast('يجب تسجيل الدخول لإزالة المنشور من المحفوظات', 'error');
            return;
        }
        
        try {
            // إزالة المنشور من المحفوظات
            await this.savedPostsRef.child(postId).remove();
            
            // إزالة المنشور من واجهة المستخدم
            const postElement = document.querySelector(`[data-post-id="${postId}"]`);
            if (postElement) {
                // إضافة تأثير للإزالة
                postElement.classList.add('removing');
                setTimeout(() => {
                    postElement.remove();
                    
                    // التحقق من وجود منشورات أخرى
                    const remainingPosts = document.querySelectorAll('#savedPostsContainer .post');
                    if (remainingPosts.length === 0) {
                        this.showNoSavedPosts();
                    }
                }, 500);
            }
            
            // إزالة المنشور من القائمة المحلية
            this.savedPosts = this.savedPosts.filter(post => post.id !== postId);
            
            // تحديث زر الحفظ في الصفحة الرئيسية إذا كان المنشور معروضاً
            const mainPagePostSaveBtn = document.querySelector(`.posts-section .save-btn[data-post-id="${postId}"]`);
            if (mainPagePostSaveBtn) {
                mainPagePostSaveBtn.classList.remove('active');
                const icon = mainPagePostSaveBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                }
            }
            
            showToast('تمت إزالة المنشور من المحفوظات', 'success');
            
        } catch (error) {
            console.error('Error unsaving post:', error);
            showToast('حدث خطأ أثناء إزالة المنشور من المحفوظات', 'error');
        }
    }

    // تحديث حالة أزرار الحفظ
    updateSaveButtonsState() {
        const saveButtons = document.querySelectorAll('.save-btn');
        
        saveButtons.forEach(button => {
            const postId = button.getAttribute('data-post-id');
            if (postId) {
                // التحقق من حفظ المنشور
                if (this.savedPosts.some(post => post.id === postId)) {
                    button.classList.add('active');
                    const icon = button.querySelector('i');
                    if (icon) {
                        icon.classList.remove('far');
                        icon.classList.add('fas');
                    }
                    // تحديث نص الزر إذا كنا في صفحة المنشورات المحفوظة
                    if (document.getElementById('savedPostsSection') && document.getElementById('savedPostsSection').style.display !== 'none') {
                        const span = button.querySelector('span');
                        if (span) {
                            span.textContent = 'محفوظ';
                        }
                    }
                }
            }
        });
    }

    // إظهار رسالة عدم وجود منشورات محفوظة
    showNoSavedPosts() {
        const postsContainer = document.getElementById('savedPostsContainer');
        const noPosts = document.getElementById('noSavedPosts');
        
        if (postsContainer && noPosts) {
            // إزالة المنشورات
            const posts = postsContainer.querySelectorAll('.post');
            posts.forEach(post => post.remove());
            
            // إظهار رسالة عدم وجود منشورات
            noPosts.style.display = 'flex';
        }
    }

    // إظهار رسالة خطأ
    showErrorMessage(message) {
        const postsContainer = document.getElementById('savedPostsContainer');
        if (!postsContainer) return;
        
        // إزالة مؤشر التحميل والمنشورات
        const loadingEl = document.getElementById('savedPostsLoading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        // إزالة المنشورات
        const posts = postsContainer.querySelectorAll('.post');
        posts.forEach(post => post.remove());
        
        // إضافة رسالة الخطأ
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn btn-primary retry-btn" onclick="window.savedPostsManager.loadSavedPosts()">
                <i class="fas fa-sync-alt"></i> إعادة المحاولة
            </button>
        `;
        
        postsContainer.appendChild(errorEl);
    }

    // تنسيق نص المنشور
    formatPostText(text) {
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
}

// إنشاء نسخة عالمية من مدير المنشورات المحفوظة
window.savedPostsManager = new SavedPostsManager();

// تهيئة مدير المنشورات المحفوظة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.savedPostsManager.init();
    
    // تحميل المنشورات المحفوظة إذا كنا على صفحة المنشورات المحفوظة
    if (window.location.hash === '#saved-posts') {
        window.savedPostsManager.loadSavedPostsPage();
    }
    
    // إضافة مستمع لتغيير الهاش للتبديل بين الصفحات
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#saved-posts') {
            window.savedPostsManager.loadSavedPostsPage();
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Añadir CSS para posicionar las publicaciones guardadas en la parte superior
    const style = document.createElement('style');
    style.textContent = `
        /* Estilos para la sección de publicaciones guardadas */
        .saved-posts-section {
            padding: 15px;
            margin-top: 60px;
            background-color: #1a1a1a;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            margin-bottom: 20px;
            animation: fadeIn 0.5s ease;
            width: 100%;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            margin-bottom: 15px;
            border-bottom: 1px solid #333;
        }
        
        .section-header h3 {
            margin: 0;
            color: #FFD700;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.3rem;
        }
        
        .section-header h3 i {
            font-size: 1.2em;
        }
        
        #backToMain {
            background-color: transparent;
            border: 1px solid #FFD700;
            color: #FFD700;
            transition: all 0.3s ease;
            padding: 5px 15px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        #backToMain:hover {
            background-color: #FFD700;
            color: #000;
            transform: translateY(-2px);
        }
        
        #backToMain i {
            font-size: 0.9em;
        }
        
        .saved-posts-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        /* Mejoras para dispositivos móviles */
        @media (max-width: 768px) {
            .saved-posts-section {
                margin-top: 55px;
                padding: 10px;
            }
            
            .section-header h3 {
                font-size: 1.1rem;
            }
            
            #backToMain {
                padding: 3px 10px;
                font-size: 0.8rem;
            }
        }
        
        /* Estilos para la animación de eliminar publicación */
        .post.removing {
            animation: fadeOut 0.5s ease forwards;
        }
        
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
});