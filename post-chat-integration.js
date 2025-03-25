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