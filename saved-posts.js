class SavedPostsManager {
    constructor() {
        this.database = firebase.database();
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.savedPostsRef = this.database.ref('savedPosts');
        this.postsRef = this.database.ref('posts');
    }

    // Load saved posts into a dedicated page
    async loadSavedPostsPage() {
        if (!this.currentUser) {
            Swal.fire('خطأ', 'يجب تسجيل الدخول لعرض المنشورات المحفوظة.', 'error');
            return;
        }

        // Clear the main content area and set up the saved posts page
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="saved-posts-page">
                <h2>المنشورات المحفوظة</h2>
                <div id="savedPostsContainer" class="saved-posts-container">
                    <div class="loading-saved-posts">
                        <div class="spinner"></div>
                        <p>جاري تحميل المنشورات المحفوظة...</p>
                    </div>
                </div>
            </div>
        `;

        const savedPostsContainer = document.getElementById('savedPostsContainer');

        try {
            const snapshot = await this.savedPostsRef.child(this.currentUser.uid).once('value');
            const savedPosts = snapshot.val();

            if (!savedPosts) {
                savedPostsContainer.innerHTML = '<p class="no-saved-posts">لا توجد منشورات محفوظة.</p>';
                return;
            }

            savedPostsContainer.innerHTML = '';
            const postIds = Object.keys(savedPosts);

            for (const postId of postIds) {
                const postSnapshot = await this.postsRef.child(postId).once('value');
                const postData = postSnapshot.val();

                if (postData) {
                    this.addPostToDOM(postId, postData, savedPostsContainer);
                }
            }
        } catch (error) {
            console.error('Error loading saved posts:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل المنشورات المحفوظة.', 'error');
        }
    }

    // Add a saved post to the DOM
    addPostToDOM(postId, postData, container) {
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
                <button class="post-action-btn remove-save-btn" onclick="savedPostsManager.removeSavedPost('${postId}')">
                    <i class="fas fa-trash"></i> إزالة من المحفوظات
                </button>
            </div>
        `;

        container.appendChild(postElement);
    }

    // Remove a saved post
    async removeSavedPost(postId) {
        if (!this.currentUser) {
            Swal.fire('خطأ', 'يجب تسجيل الدخول لإزالة المنشورات المحفوظة.', 'error');
            return;
        }

        try {
            await this.savedPostsRef.child(this.currentUser.uid).child(postId).remove();
            Swal.fire('تم الإزالة', 'تمت إزالة المنشور من المحفوظات.', 'success');

            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
            }

            const savedPostsContainer = document.getElementById('savedPostsContainer');
            if (savedPostsContainer && savedPostsContainer.children.length === 0) {
                savedPostsContainer.innerHTML = '<p class="no-saved-posts">لا توجد منشورات محفوظة.</p>';
            }
        } catch (error) {
            console.error('Error removing saved post:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء إزالة المنشور من المحفوظات.', 'error');
        }
    }
}

// Create a global instance of SavedPostsManager
window.savedPostsManager = new SavedPostsManager();
