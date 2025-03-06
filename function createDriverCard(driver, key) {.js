function createDriverCard(driver, key) {
    // ...existing code...
    
    // إضافة عداد الرسائل غير المقروءة للسائق فقط
    let unreadMessagesCount = 0;
    let unreadMessagesHtml = '';
    
    // إذا كان المستخدم الحالي هو السائق، نضيف عداد الرسائل
    if (isCurrentDriver) {
        unreadMessagesHtml = `
            <span class="message-badge position-absolute top-0 end-0 translate-middle badge rounded-pill bg-danger d-none">
                0
            </span>
        `;
        
        // هنا سنقوم بتحديث عداد الرسائل لاحقاً من خلال دالة getUnreadMessagesCount
        updateDriverMessageBadge(key);
    }

    return `
        <!-- ...existing code... -->
        <button class="action-btn secondary position-relative" 
                onclick="${isCurrentDriver ? `showDriverMessages('${key}')` : `openChatWindow('${key}')`}"
                style="background: #333; color: #FFD700; padding: 10px 20px; 
                       border-radius: 20px; border: 1px solid #FFD700; 
                       cursor: pointer; font-weight: bold; transition: all 0.3s;"
                ${!isApproved ? 'disabled' : ''}>
            <i class="fas fa-comment"></i> ${isCurrentDriver ? 'الرسائل' : 'مراسلة'}
            ${isCurrentDriver ? unreadMessagesHtml : ''}
        </button>
        <!-- ...existing code... -->
    `;
}

// دالة لعرض رسائل السائق (عندما يكون السائق هو المسجل الدخول)
function showDriverMessages(driverId) {
    // ...existing code...
}

// فتح نافذة المحادثة بين السائق والمستخدم
function openDriverChatWindow(driverId, userId) {
    // ...existing code...
}

// إرسال رسالة من السائق إلى المستخدم
function sendDriverMessage(driverId, userId) {
    // ...existing code...
}

// تعليم المحادثة كمقروءة
function markConversationAsRead(driverId, userId) {
    // ...existing code...
}

// تحديث عداد الرسائل غير المقروءة للسائق
function updateDriverMessageBadge(driverId) {
    // ...existing code...
}

// حساب عدد الرسائل غير المقروءة
function getUnreadCount(chatData, driverId) {
    // ...existing code...
}

// تحديث حالة جميع الرسائل كمقروءة
function updateMessagesReadStatus(driverId) {
    // ...existing code...
}

// الحصول على آخر وقت للرسائل في محادثة
function getLastMessageTime(chatData) {
    // ...existing code...
}

// الحصول على آخر رسالة في محادثة
function getLastMessage(chatData) {
    // ...existing code...
}

// الحصول على اسم المستخدم من معرفه
function getUserName(userId) {
    // ...existing code...
}

// تنسيق وقت الرسالة
function formatMessageTime(timestamp) {
    // ...existing code...
}

// إضافة الأنماط CSS للنافذة المنبثقة
function addDriverChatStyles() {
    // ...existing code...
}
