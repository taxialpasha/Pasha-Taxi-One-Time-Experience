// نظام المراسلة بين المستخدمين والسائقين في منشورات تاكسي العراق

class ChatSystem {
    constructor() {
        // تهيئة المراجع الأساسية
        this.database = firebase.database();
        this.storage = firebase.storage();
        this.auth = firebase.auth();
        
        // المستخدم الحالي
        this.currentUser = null;
        
        // مراجع قاعدة البيانات
        this.chatsRef = this.database.ref('chats');
        this.usersRef = this.database.ref('users');
        this.driversRef = this.database.ref('drivers');
        
        // عناصر واجهة المستخدم
        this.chatModal = null;
        this.messageSound = document.getElementById('messageSound');
        
        // تهيئة الحالة
        this.initialize();
    }
    
    // تهيئة النظام
    initialize() {
        // تحميل بيانات المستخدم الحالي من التخزين المحلي
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
        
        // الاستماع لتغييرات حالة المصادقة
        this.auth.onAuthStateChanged(user => {
            if (user) {
                // تحديث معلومات المستخدم الحالي
                this.loadCurrentUserInfo(user.uid);
            } else {
                this.currentUser = null;
            }
        });
        
        // تهيئة نظام الإشعارات
        this.initializeNotifications();
        
        // تهيئة متطلبات نظام المراسلة
        this.addStyles();
        this.createChatModal();
    }
    
    // تحميل معلومات المستخدم الحالي
    async loadCurrentUserInfo(uid) {
        try {
            // البحث عن المستخدم في جدول المستخدمين
            const userSnapshot = await this.usersRef.child(uid).once('value');
            let userData = userSnapshot.val();
            
            // إذا لم يتم العثور على المستخدم، ابحث في جدول السائقين
            if (!userData) {
                const driverQuery = await this.driversRef.orderByChild('uid').equalTo(uid).once('value');
                const driversData = driverQuery.val();
                
                if (driversData) {
                    const driverId = Object.keys(driversData)[0];
                    userData = driversData[driverId];
                    userData.userType = 'driver';
                    userData.role = 'driver';
                    userData.driverId = driverId;
                }
            }
            
            if (userData) {
                this.currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(userData));
                
                // تحديث عداد الرسائل غير المقروءة
                this.updateUnreadMessageCount();
                
                // البدء في الاستماع للرسائل الجديدة
                this.listenForNewMessages();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    // تهيئة نظام الإشعارات
    initializeNotifications() {
        // طلب إذن الإشعارات إذا لم يكن قد تم طلبه من قبل
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
    
    // إضافة الأنماط الخاصة بنظام المراسلة
    addStyles() {
        const styles = `
        /* أنماط زر المراسلة في المنشور */
        .post-action-btn.chat-btn {
            position: relative;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            border: none;
            margin: 0 8px;
            transition: all 0.3s ease;
            transform: scale(1.1);
        }
        
        .post-action-btn.chat-btn i {
            color: #000;
            font-size: 1.2rem;
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
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            border: 1px solid #fff;
            font-weight: bold;
        }
        
        .post-action-btn.chat-btn:hover {
            transform: translateY(-3px) scale(1.15);
            box-shadow: 0 6px 12px rgba(0,0,0,0.4);
        }
        
        .post-action-btn.chat-btn:active {
            transform: translateY(1px) scale(1.1);
        }
        
        /* أنماط نافذة المحادثة */
        .chat-modal {
            background: #1a1a1a;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid rgba(255, 215, 0, 0.3);
        }
        
        .chat-header {
            background: linear-gradient(to right, #FFD700, #FFA500);
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        
        .chat-header .avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .chat-header .user-info {
            flex-grow: 1;
        }
        
        .chat-header .user-info h5 {
            margin: 0;
            color: #000;
            font-weight: bold;
        }
        
        .chat-header .user-info p {
            margin: 0;
            color: rgba(0,0,0,0.7);
            font-size: 12px;
        }
        
        .chat-header .close-btn {
            background: rgba(0,0,0,0.2);
            color: #fff;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .chat-header .close-btn:hover {
            background: rgba(0,0,0,0.4);
            transform: rotate(90deg);
        }
        
        .chat-body {
            padding: 15px;
            height: 300px;
            overflow-y: auto;
            background-color: #242424;
        }
        
        .chat-body::-webkit-scrollbar {
            width: 5px;
        }
        
        .chat-body::-webkit-scrollbar-thumb {
            background: rgba(255, 215, 0, 0.5);
            border-radius: 10px;
        }
        
        .chat-message {
            margin-bottom: 15px;
            display: flex;
            flex-direction: column;
        }
        
        .chat-message.sent {
            align-items: flex-end;
        }
        
        .chat-message.received {
            align-items: flex-start;
        }
        
        .message-bubble {
            max-width: 70%;
            padding: 10px 15px;
            border-radius: 15px;
            word-wrap: break-word;
            position: relative;
            margin-bottom: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .message-bubble.sent {
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
            border-top-right-radius: 5px;
        }
        
        .message-bubble.received {
            background: #333;
            color: #fff;
            border-top-left-radius: 5px;
        }
        
        .message-time {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 5px;
            margin-bottom: 5px;
        }
        
        .message-bubble.sent + .message-time {
            text-align: right;
            margin-right: 15px;
        }
        
        .message-bubble.received + .message-time {
            margin-left: 15px;
        }
        
        .chat-footer {
            padding: 10px 15px;
            background: #1a1a1a;
            border-top: 1px solid rgba(255, 215, 0, 0.2);
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .chat-input {
            flex-grow: 1;
            padding: 10px 15px;
            border-radius: 20px;
            border: 1px solid rgba(255, 215, 0, 0.3);
            background: #333;
            color: #fff;
            outline: none;
            transition: all 0.3s ease;
        }
        
        .chat-input:focus {
            border-color: #FFD700;
            box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
        }
        
        .action-button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .send-btn {
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
        }
        
        .location-btn {
            background: #333;
            color: #FFD700;
            border: 1px solid #FFD700;
        }
        
        .action-button:hover {
            transform: scale(1.1);
        }
        
        .action-button:active {
            transform: scale(0.95);
        }
        
        /* أنماط الرسائل المرئية */
        .no-messages {
            text-align: center;
            color: #555;
            margin-top: 50px;
            font-style: italic;
        }
        
        .location-message {
            display: flex;
            flex-direction: column;
            background: rgba(255, 215, 0, 0.1);
            border-radius: 10px;
            overflow: hidden;
            cursor: pointer;
            border: 1px solid rgba(255, 215, 0, 0.2);
            transition: all 0.3s ease;
        }
        
        .location-message:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border-color: rgba(255, 215, 0, 0.5);
        }
        
        .location-header {
            padding: 8px;
            display: flex;
            align-items: center;
            gap: 5px;
            background: rgba(255, 215, 0, 0.2);
        }
        
        .location-header i {
            color: #FFD700;
        }
        
        .location-preview {
            width: 150px;
            height: 100px;
            background: #333;
            position: relative;
            overflow: hidden;
        }
        
        .location-preview::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .location-preview i {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #FFD700;
            font-size: 24px;
            z-index: 1;
        }
        
        .location-coordinates {
            padding: 8px;
            font-size: 12px;
            text-align: center;
        }
        
        .location-action {
            padding: 8px;
            text-align: center;
            font-size: 11px;
            color: #FFD700;
            border-top: 1px dashed rgba(255, 215, 0, 0.2);
        }
        
        /* أنماط إشعارات الرسائل الجديدة */
        .message-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 15px;
            border-radius: 10px;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border-left: 3px solid #FFD700;
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .message-notification .title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #FFD700;
        }
        
        .message-notification .message {
            margin-bottom: 10px;
            opacity: 0.9;
        }
        
        .message-notification .actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .message-notification .action-btn {
            padding: 5px 10px;
            font-size: 12px;
            border-radius: 5px;
            cursor: pointer;
            border: none;
            transition: all 0.3s ease;
        }
        
        .message-notification .view-btn {
            background: #FFD700;
            color: #000;
        }
        
        .message-notification .close-btn {
            background: transparent;
            color: #ccc;
        }
        
        .message-notification .action-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
        }
        `;
        
        // إضافة الأنماط إلى الصفحة
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    // إنشاء نافذة المحادثة
    createChatModal() {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'postChatModal';
        modalDiv.tabIndex = '-1';
        modalDiv.setAttribute('aria-hidden', 'true');
        
        modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content chat-modal">
                <div class="chat-header">
                    <img src="default-avatar.png" alt="صورة المستخدم" class="avatar" id="chatUserAvatar">
                    <div class="user-info">
                        <h5 id="chatUserName">اسم المستخدم</h5>
                        <p id="chatUserInfo">معلومات إضافية</p>
                    </div>
                    <button type="button" class="close-btn" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="chat-body" id="chatMessagesContainer">
                    <div class="no-messages">لا توجد رسائل سابقة</div>
                </div>
                <div class="chat-footer">
                    <button class="action-button location-btn" id="shareLocationBtn" title="مشاركة الموقع">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <input type="text" class="chat-input" id="chatMessageInput" placeholder="اكتب رسالتك هنا...">
                    <button class="action-button send-btn" id="sendMessageBtn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // إضافة النافذة إلى المستند
        document.body.appendChild(modalDiv);
        
        // تهيئة معالجات الأحداث بعد إضافة النافذة
        const sendBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('chatMessageInput');
        const locationBtn = document.getElementById('shareLocationBtn');
        
        if (sendBtn && messageInput) {
            // إرسال الرسالة عند النقر على زر الإرسال
            sendBtn.addEventListener('click', () => {
                this.sendMessage(messageInput.value);
            });
            
            // إرسال الرسالة عند الضغط على Enter
            messageInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.sendMessage(messageInput.value);
                }
            });
        }
        
        if (locationBtn) {
            // مشاركة الموقع عند النقر على زر الموقع
            locationBtn.addEventListener('click', () => {
                this.shareLocation();
            });
        }
        
        // تخزين النافذة المنبثقة للاستخدام لاحقًا
        this.chatModal = new bootstrap.Modal(document.getElementById('postChatModal'));
    }
    
    // إضافة زر المراسلة إلى منشور
    addChatButtonToPost(postId, authorId) {
        const postActions = document.querySelector(`.post[data-post-id="${postId}"] .post-actions`);
        
        if (!postActions) return;
        
        // إنشاء زر المراسلة
        const chatButton = document.createElement('button');
        chatButton.className = 'post-action-btn chat-btn';
        chatButton.setAttribute('data-post-id', postId);
        chatButton.setAttribute('data-author-id', authorId);
        
        // التحقق من وجود رسائل غير مقروءة
        this.getUnreadMessagesCount(authorId).then(count => {
            chatButton.innerHTML = `
                <i class="fas fa-comment-dots"></i>
                ${count > 0 ? `<span class="chat-badge">${count}</span>` : ''}
            `;
        });
        
        // إضافة معالج النقر
        chatButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openChatWithUser(authorId);
        });
        
        // إدراج زر المراسلة بعد زر الإعجاب
        const likeButton = postActions.querySelector('.like-btn');
        if (likeButton && likeButton.nextSibling) {
            postActions.insertBefore(chatButton, likeButton.nextSibling);
        } else {
            postActions.appendChild(chatButton);
        }
    }
    
    // فتح نافذة المحادثة مع مستخدم معين
    async openChatWithUser(userId) {
        try {
            // التحقق من وجود مستخدم مسجل الدخول
            if (!this.currentUser) {
                this.showLoginPrompt();
                return;
            }
            
            // التحقق من أن المستخدم لا يحاول محادثة نفسه
            if (this.currentUser.uid === userId) {
                showToast('لا يمكن إجراء محادثة مع نفسك', 'warning');
                return;
            }
            
            // جلب معلومات المستخدم المستهدف
            const targetUser = await this.getUserInfo(userId);
            
            if (!targetUser) {
                showToast('لم يتم العثور على المستخدم', 'error');
                return;
            }
            
            // تحديث معلومات نافذة المحادثة
            document.getElementById('chatUserAvatar').src = targetUser.photoUrl || targetUser.imageUrl || 'default-avatar.png';
            document.getElementById('chatUserName').textContent = targetUser.fullName || targetUser.name || 'مستخدم';
            
            // إظهار معلومات إضافية إذا كان المستخدم سائقًا
            if (targetUser.carType && targetUser.carModel) {
                document.getElementById('chatUserInfo').textContent = `${targetUser.carType} ${targetUser.carModel}`;
            } else {
                document.getElementById('chatUserInfo').textContent = targetUser.userType === 'driver' ? 'سائق' : 'مستخدم';
            }
            
            // تحميل الرسائل السابقة
            this.loadMessages(userId);
            
            // تعليم الرسائل كمقروءة
            this.markMessagesAsRead(userId);
            
            // تخزين معرف المستخدم المستهدف في عنصر حاوية الرسائل
            const messagesContainer = document.getElementById('chatMessagesContainer');
            messagesContainer.setAttribute('data-target-user', userId);
            
            // فتح نافذة المحادثة
            this.chatModal.show();
            
            // تركيز حقل الإدخال
            setTimeout(() => {
                document.getElementById('chatMessageInput').focus();
            }, 500);
        } catch (error) {
            console.error('Error opening chat:', error);
            showToast('حدث خطأ أثناء فتح المحادثة', 'error');
        }
    }
    
    // جلب معلومات مستخدم
    async getUserInfo(userId) {
        try {
            // البحث أولاً في جدول المستخدمين
            const userSnapshot = await this.usersRef.child(userId).once('value');
            let userData = userSnapshot.val();
            
            // إذا لم يتم العثور على المستخدم، ابحث في جدول السائقين
            if (!userData) {
                const driverQuery = await this.driversRef.orderByChild('uid').equalTo(userId).once('value');
                const driversData = driverQuery.val();
                
                if (driversData) {
                    const driverId = Object.keys(driversData)[0];
                    userData = driversData[driverId];
                    userData.userType = 'driver';
                }
            }
            
            return userData;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }
    
    // تحميل الرسائل السابقة
    async loadMessages(targetUserId) {
        try {
            const messagesContainer = document.getElementById('chatMessagesContainer');
            messagesContainer.innerHTML = '<div class="loading-messages">جاري تحميل الرسائل...</div>';
            
            const currentUserId = this.currentUser.uid;
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(currentUserId, targetUserId);
            
            // جلب الرسائل من قاعدة البيانات
            const messagesSnapshot = await this.database.ref(`chats/${chatPath}/messages`).orderByChild('timestamp').once('value');
            const messages = messagesSnapshot.val();
            
            // تنظيف حاوية الرسائل
            messagesContainer.innerHTML = '';
            
            // عرض الرسائل إذا وُجدت
            if (messages) {
                Object.keys(messages).forEach(messageId => {
                    const message = messages[messageId];
                    this.addMessageToUI(message, messageId);
                });
                
                // التمرير إلى آخر رسالة
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                messagesContainer.innerHTML = '<div class="no-messages">لا توجد رسائل سابقة</div>';
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('chatMessagesContainer').innerHTML = 
                '<div class="error-message">حدث خطأ أثناء تحميل الرسائل. يرجى المحاولة مرة أخرى.</div>';
        }
    }
    
    // إضافة رسالة إلى واجهة المستخدم
    addMessageToUI(message, messageId) {
        const messagesContainer = document.getElementById('chatMessagesContainer');
        const isSent = message.senderId === this.currentUser.uid;
        
        const messageElem = document.createElement('div');
        messageElem.className = `chat-message ${isSent ? 'sent' : 'received'}`;
        messageElem.setAttribute('data-message-id', messageId);
        
        // تحديد نوع الرسالة
        if (message.type === 'location') {
            // رسالة موقع
            messageElem.innerHTML = `
                <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                    <div class="location-message" onclick="chatSystem.viewLocation(${message.location.lat}, ${message.location.lng}, '${messageId}')">
                        <div class="location-header">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>موقع ${isSent ? 'مشترك' : 'مستلم'}</span>
                        </div>
                        <div class="location-preview">
                            <i class="fas fa-map"></i>
                        </div>
                        <div class="location-coordinates">
                            ${message.location.lat.toFixed(6)}, ${message.location.lng.toFixed(6)}
                        </div>
                        <div class="location-action">
                            انقر لعرض الموقع على الخريطة
                        </div>
                    </div>
                </div>
                <div class="message-time">${this.formatTimestamp(message.timestamp)}</div>
            `;
        } else {
            // رسالة نصية عادية
            messageElem.innerHTML = `
                <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                    ${message.text}
                </div>
                <div class="message-time">${this.formatTimestamp(message.timestamp)}</div>
            `;
        }
        
        messagesContainer.appendChild(messageElem);
    }
    
    // إرسال رسالة
    async sendMessage(text) {
        try {
            // الحصول على نص الرسالة وتنظيفه
            text = text.trim();
            if (!text) return;
            
            // التحقق من وجود مستخدم هدف
            const messagesContainer = document.getElementById('chatMessagesContainer');
            const targetUserId = messagesContainer.getAttribute('data-target-user');
            
            if (!targetUserId) {
                throw new Error('لم يتم تحديد المستخدم المستهدف');
            }
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(this.currentUser.uid, targetUserId);
            
            // إنشاء بيانات الرسالة
            const messageData = {
                text: text,
                senderId: this.currentUser.uid,
                senderName: this.currentUser.fullName || this.currentUser.name || 'مستخدم',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            };
            
            // حفظ الرسالة في قاعدة البيانات
            const newMessageRef = await this.database.ref(`chats/${chatPath}/messages`).push(messageData);
            
            // تنظيف حقل الإدخال
            document.getElementById('chatMessageInput').value = '';
            
            // إضافة الرسالة إلى واجهة المستخدم
            this.addMessageToUI({
                ...messageData,
                timestamp: Date.now() // استخدام الوقت الحالي حتى يتم تحديثه
            }, newMessageRef.key);
            
            // التمرير إلى أسفل
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // تشغيل صوت الإرسال
            this.playMessageSound();
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('حدث خطأ أثناء إرسال الرسالة', 'error');
        }
    }
    
    // مشاركة الموقع الحالي
    async shareLocation() {
        try {
            // التحقق من دعم تحديد الموقع
            if (!navigator.geolocation) {
                showToast('متصفحك لا يدعم خدمة تحديد الموقع', 'error');
                return;
            }
            
            // عرض مؤشر التحميل
            showToast('جاري تحديد موقعك...', 'info');
            
            // الحصول على الموقع الحالي
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude, accuracy } = position.coords;
            
            // الحصول على المستخدم المستهدف
            const messagesContainer = document.getElementById('chatMessagesContainer');
            const targetUserId = messagesContainer.getAttribute('data-target-user');
            
            if (!targetUserId) {
                throw new Error('لم يتم تحديد المستخدم المستهدف');
            }
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(this.currentUser.uid, targetUserId);
            
            // إنشاء بيانات رسالة الموقع
            const locationMessage = {
                type: 'location',
                location: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy
                },
                senderId: this.currentUser.uid,
                senderName: this.currentUser.fullName || this.currentUser.name || 'مستخدم',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            };
            
            // حفظ رسالة الموقع في قاعدة البيانات
            const newMessageRef = await this.database.ref(`chats/${chatPath}/messages`).push(locationMessage);
            
            // إضافة الرسالة إلى واجهة المستخدم
            this.addMessageToUI({
                ...locationMessage,
                timestamp: Date.now() // استخدام الوقت الحالي حتى يتم تحديثه
            }, newMessageRef.key);
            
            // التمرير إلى أسفل
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // تشغيل صوت الإرسال
            this.playMessageSound();
            
            // عرض رسالة نجاح
            showToast('تم مشاركة موقعك بنجاح', 'success');
        } catch (error) {
            console.error('Error sharing location:', error);
            
            let errorMessage = 'حدث خطأ في مشاركة الموقع';
            if (error.code === 1) { // PERMISSION_DENIED
                errorMessage = 'تم رفض الوصول إلى الموقع. يرجى السماح للتطبيق باستخدام خدمة الموقع';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMessage = 'معلومات الموقع غير متوفرة حالياً';
            } else if (error.code === 3) { // TIMEOUT
                errorMessage = 'انتهت مهلة تحديد الموقع';
            }
            
            showToast(errorMessage, 'error');
        }
    }
    
    // عرض الموقع على الخريطة
    viewLocation(lat, lng, messageId) {
        try {
            // إغلاق نافذة المحادثة
            this.chatModal.hide();
            
            // التأكد من وجود خريطة
            if (!window.map) {
                showToast('الخريطة غير متاحة حالياً', 'error');
                return;
            }
            
            // تعليم الرسالة كمقروءة
            this.markMessageAsRead(messageId);
            
            // نقل الخريطة إلى الموقع
            window.map.flyTo([lat, lng], 15, {
                animate: true,
                duration: 1.5
            });
            
            // إضافة علامة على الخريطة
            if (window.markerLayer) {
                window.markerLayer.clearLayers();
                
                // إنشاء أيقونة العلامة
                const locationIcon = L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(255, 215, 0, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #FFD700; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #000;">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                        </div>
                    `,
                    className: 'location-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                });
                
                // إضافة العلامة
                const marker = L.marker([lat, lng], { icon: locationIcon }).addTo(window.markerLayer);
                
                // إضافة نافذة منبثقة
                marker.bindPopup(`
                    <div style="text-align: center;">
                        <h6 style="color: #FFD700; margin-bottom: 10px;">الموقع المشترك</h6>
                        <p style="color: #ccc;">
                            <i class="fas fa-map-pin" style="color: #FFD700;"></i>
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </p>
                        <button onclick="chatSystem.getDirectionsToLocation(${lat}, ${lng})" 
                                style="background: #FFD700; color: #000; border: none; padding: 5px 10px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; gap: 5px; margin: 0 auto;">
                            <i class="fas fa-directions"></i>
                            اتجاهات
                        </button>
                    </div>
                `, {
                    className: 'custom-popup'
                }).openPopup();
            }
            
            // التمرير إلى الخريطة
            const mapElement = document.getElementById('map');
            if (mapElement) {
                mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Error viewing location:', error);
            showToast('حدث خطأ في عرض الموقع', 'error');
            
            // إعادة فتح نافذة المحادثة
            this.chatModal.show();
        }
    }
    
    // الحصول على اتجاهات إلى الموقع
    async getDirectionsToLocation(destLat, destLng) {
        try {
            showToast('جاري الحصول على الاتجاهات...', 'info');
            
            // الحصول على موقع المستخدم الحالي
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const sourceLat = position.coords.latitude;
            const sourceLng = position.coords.longitude;
            
            // التأكد من وجود خريطة وطبقة للمسار
            if (!window.map || !window.routeLayer) {
                showToast('الخريطة غير متاحة حالياً', 'error');
                return;
            }
            
            // مسح الطبقة السابقة
            window.routeLayer.clearLayers();
            
            // إضافة العلامات للبداية والنهاية
            const startIcon = L.divIcon({
                html: `<div style="background-color: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user fa-sm"></i></div>`,
                className: 'start-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const endIcon = L.divIcon({
                html: `<div style="background-color: #FFD700; color: black; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-map-marker-alt fa-sm"></i></div>`,
                className: 'end-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const startMarker = L.marker([sourceLat, sourceLng], { icon: startIcon }).addTo(window.routeLayer);
            const endMarker = L.marker([destLat, destLng], { icon: endIcon }).addTo(window.routeLayer);
            
            // محاولة الحصول على المسار باستخدام API خارجية
            try {
                // استخدام OSRM للحصول على المسار
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson`;
                const response = await fetch(osrmUrl);
                const data = await response.json();
                
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    // رسم المسار
                    const routeLine = L.polyline(coordinates, {
                        color: '#FFD700',
                        weight: 5,
                        opacity: 0.7,
                        dashArray: '10, 10',
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(window.routeLayer);
                    
                    // ضبط حدود الخريطة لتشمل المسار كاملاً
                    window.map.fitBounds(routeLine.getBounds(), {
                        padding: [50, 50]
                    });
                    
                    // حساب المسافة والوقت
                    const distance = (route.distance / 1000).toFixed(1); // بالكيلومتر
                    const duration = Math.ceil(route.duration / 60); // بالدقائق
                    
                    // عرض معلومات المسار
                    const routeInfoDiv = document.createElement('div');
                    routeInfoDiv.className = 'route-info';
                    routeInfoDiv.innerHTML = `
                        <div style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 10px; z-index: 1000; max-width: 300px;">
                            <h6 style="color: #FFD700; margin-bottom: 10px; border-bottom: 1px solid rgba(255,215,0,0.3); padding-bottom: 5px;">معلومات المسار</h6>
                            <div style="margin-bottom: 8px;">
                                <i class="fas fa-road" style="color: #FFD700; margin-left: 10px;"></i>
                                <span>المسافة: ${distance} كم</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <i class="fas fa-clock" style="color: #FFD700; margin-left: 10px;"></i>
                                <span>الوقت التقريبي: ${duration} دقيقة</span>
                            </div>
                            <button onclick="chatSystem.clearRouteInfo()" style="background: #FFD700; color: #000; border: none; padding: 8px 15px; border-radius: 5px; margin-top: 10px; width: 100%; font-weight: bold;">
                                <i class="fas fa-times"></i> إغلاق
                            </button>
                        </div>
                    `;
                    
                    // إضافة معلومات المسار إلى المستند
                    document.body.appendChild(routeInfoDiv);
                    
                    // تخزين عنصر معلومات المسار للاستخدام لاحقًا
                    window.routeInfoElement = routeInfoDiv;
                    
                    showToast('تم عرض المسار بنجاح', 'success');
                } else {
                    throw new Error('لم يتم العثور على مسار');
                }
            } catch (routeError) {
                console.error('Error getting route:', routeError);
                
                // استخدام خط مستقيم كبديل
                const straightLine = L.polyline([
                    [sourceLat, sourceLng],
                    [destLat, destLng]
                ], {
                    color: '#FFD700',
                    weight: 5,
                    opacity: 0.5,
                    dashArray: '10, 10'
                }).addTo(window.routeLayer);
                
                // ضبط حدود الخريطة
                window.map.fitBounds(straightLine.getBounds(), {
                    padding: [50, 50]
                });
                
                showToast('تعذر الحصول على مسار دقيق، تم عرض خط مستقيم', 'warning');
            }
        } catch (error) {
            console.error('Error getting directions:', error);
            showToast('تعذر الحصول على الاتجاهات', 'error');
        }
    }
    
    // مسح معلومات المسار
    clearRouteInfo() {
        if (window.routeInfoElement) {
            window.routeInfoElement.remove();
            window.routeInfoElement = null;
        }
        
        if (window.routeLayer) {
            window.routeLayer.clearLayers();
        }
    }
    
    // تشغيل صوت الرسالة
    playMessageSound() {
        if (this.messageSound) {
            // إعادة ضبط الصوت قبل التشغيل
            this.messageSound.pause();
            this.messageSound.currentTime = 0;
            
            // محاولة تشغيل الصوت
            this.messageSound.play().catch(error => {
                console.warn('Could not play message sound:', error);
            });
        }
    }
    
    // تحديث عداد الرسائل غير المقروءة
    async updateUnreadMessageCount() {
        try {
            // التحقق من وجود مستخدم مسجل الدخول
            if (!this.currentUser) return;
            
            // الحصول على جميع المحادثات
            const chatsSnapshot = await this.chatsRef.once('value');
            const allChats = chatsSnapshot.val() || {};
            
            // البحث عن محادثات المستخدم الحالي
            let totalUnread = 0;
            const userChats = {};
            
            // تجميع جميع المحادثات للمستخدم الحالي
            Object.keys(allChats).forEach(firstId => {
                Object.keys(allChats[firstId] || {}).forEach(secondId => {
                    // تحديد ما إذا كانت المحادثة تخص المستخدم الحالي
                    if (firstId === this.currentUser.uid || secondId === this.currentUser.uid) {
                        const otherUserId = firstId === this.currentUser.uid ? secondId : firstId;
                        const chatData = allChats[firstId][secondId];
                        
                        // حساب عدد الرسائل غير المقروءة
                        let unreadCount = 0;
                        if (chatData.messages) {
                            Object.values(chatData.messages).forEach(message => {
                                if (!message.read && message.senderId !== this.currentUser.uid) {
                                    unreadCount++;
                                }
                            });
                        }
                        
                        // تخزين عدد الرسائل غير المقروءة
                        userChats[otherUserId] = unreadCount;
                        totalUnread += unreadCount;
                    }
                });
            });
            
            // تحديث شارة الرسائل الرئيسية
            this.updateMessageBadge(totalUnread);
            
            // تحديث شارات المحادثات الفردية
            this.updateChatButtonBadges(userChats);
        } catch (error) {
            console.error('Error updating unread count:', error);
        }
    }
    
    // تحديث شارة الرسائل الرئيسية
    updateMessageBadge(count) {
        const badges = document.querySelectorAll('.message-badge');
        badges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }
    
    // تحديث شارات أزرار المحادثة
    updateChatButtonBadges(userChats) {
        // الحصول على جميع أزرار المحادثة
        const chatButtons = document.querySelectorAll('.post-action-btn.chat-btn');
        
        chatButtons.forEach(button => {
            const authorId = button.getAttribute('data-author-id');
            if (authorId && userChats[authorId]) {
                const count = userChats[authorId];
                
                // تحديث الشارة
                let badge = button.querySelector('.chat-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'chat-badge';
                        button.appendChild(badge);
                    }
                    badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    }
    
    // الحصول على عدد الرسائل غير المقروءة لمستخدم معين
    async getUnreadMessagesCount(userId) {
        try {
            // التحقق من وجود مستخدم مسجل الدخول
            if (!this.currentUser) return 0;
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(this.currentUser.uid, userId);
            
            // الحصول على الرسائل
            const messagesSnapshot = await this.database.ref(`chats/${chatPath}/messages`).once('value');
            const messages = messagesSnapshot.val() || {};
            
            // تحديث حالة الرسائل غير المقروءة
            const updates = {};
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                if (!message.read && message.senderId !== this.currentUser.uid) {
                    updates[`chats/${chatPath}/messages/${messageId}/read`] = true;
                }
            });
            
            // تطبيق التحديثات
            if (Object.keys(updates).length > 0) {
                await this.database.ref().update(updates);
                
                // تحديث عداد الرسائل غير المقروءة
                this.updateUnreadMessageCount();
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }
    
    // تنسيق الطابع الزمني
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMinutes < 1) {
            return 'الآن';
        } else if (diffMinutes < 60) {
            return `منذ ${diffMinutes} دقيقة`;
        } else if (diffHours < 24) {
            return `منذ ${diffHours} ساعة`;
        } else if (diffDays < 7) {
            return `منذ ${diffDays} يوم`;
        } else {
            // تنسيق التاريخ لأكثر من أسبوع
            return date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
    
    // الحصول على مسار المحادثة
    getChatPath(userId1, userId2) {
        // ترتيب المعرفات لضمان اتساق المسار
        const [firstId, secondId] = [userId1, userId2].sort();
        return `${firstId}/${secondId}`;
    }
    
    // إظهار نافذة تسجيل الدخول
    showLoginPrompt() {
        Swal.fire({
            title: 'مطلوب تسجيل الدخول',
            text: 'يجب عليك تسجيل الدخول أولاً للتمكن من إجراء محادثة',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'تسجيل الدخول',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#FFD700',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                // استدعاء دالة فتح نافذة تسجيل الدخول
                if (typeof openLoginModal === 'function') {
                    openLoginModal();
                } else {
                    // بديل إذا لم تكن الدالة متاحة
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) {
                        const bootstrapModal = new bootstrap.Modal(loginModal);
                        bootstrapModal.show();
                    } else {
                        showToast('نافذة تسجيل الدخول غير متاحة', 'error');
                    }
                }
            }
        });
    }
    
    // الاستماع للرسائل الجديدة
    listenForNewMessages() {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!this.currentUser) return;
        
        // التوقف عن الاستماع السابق إذا وجد
        if (this.messagesListener) {
            this.messagesListener();
        }
        
        // إنشاء مستمع جديد
        this.messagesListener = this.chatsRef.on('child_added', snapshot => {
            const firstId = snapshot.key;
            
            // التحقق مما إذا كانت المحادثة تخص المستخدم الحالي
            if (firstId === this.currentUser.uid || snapshot.hasChild(this.currentUser.uid)) {
                // الاستماع للمحادثات المضافة
                snapshot.ref.on('child_added', chatSnapshot => {
                    const secondId = chatSnapshot.key;
                    
                    // تحديد ما إذا كانت المحادثة تخص المستخدم الحالي
                    if (firstId === this.currentUser.uid || secondId === this.currentUser.uid) {
                        // الاستماع للرسائل الجديدة
                        chatSnapshot.ref.child('messages').limitToLast(1).on('child_added', messageSnapshot => {
                            const message = messageSnapshot.val();
                            
                            // معالجة الرسالة الجديدة فقط إذا لم تكن من المستخدم الحالي
                            if (message.senderId !== this.currentUser.uid) {
                                // تحديث عدد الرسائل غير المقروءة
                                this.updateUnreadMessageCount();
                                
                                // إظهار إشعار بالرسالة الجديدة
                                this.showMessageNotification(message, firstId === this.currentUser.uid ? secondId : firstId);
                                
                                // تحديث واجهة المستخدم إذا كانت نافذة المحادثة مفتوحة
                                this.updateChatUI(message, messageSnapshot.key);
                            }
                        });
                    }
                });
            }
        });
    }
    
    // تحديث واجهة المستخدم بالرسائل الجديدة
    updateChatUI(message, messageId) {
        // التحقق مما إذا كانت نافذة المحادثة مفتوحة
        const messagesContainer = document.getElementById('chatMessagesContainer');
        const targetUserId = messagesContainer.getAttribute('data-target-user');
        
        if (targetUserId && targetUserId === message.senderId) {
            // إضافة الرسالة إلى واجهة المستخدم
            this.addMessageToUI(message, messageId);
            
            // التمرير إلى أسفل
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // تعليم الرسالة كمقروءة
            this.markMessageAsRead(messageId);
        }
    }
    
    // إظهار إشعار بالرسالة الجديدة
    async showMessageNotification(message, senderId) {
        try {
            // الحصول على معلومات المرسل
            const sender = await this.getUserInfo(senderId);
            if (!sender) return;
            
            // تشغيل صوت الإشعار
            this.playMessageSound();
            
            // إنشاء إشعار
            const notificationDiv = document.createElement('div');
            notificationDiv.className = 'message-notification';
            
            // تحديد نص الرسالة
            let messageText = '';
            if (message.type === 'location') {
                messageText = 'مشاركة موقع';
            } else {
                messageText = message.text.length > 30 ? message.text.substring(0, 30) + '...' : message.text;
            }
            
            // إعداد محتوى الإشعار
            notificationDiv.innerHTML = `
                <div class="title">
                    <i class="fas fa-envelope"></i>
                    رسالة جديدة من ${sender.fullName || sender.name || 'مستخدم'}
                </div>
                <div class="message">${messageText}</div>
                <div class="actions">
                    <button class="action-btn view-btn" data-sender-id="${senderId}">
                        <i class="fas fa-eye"></i>
                        عرض
                    </button>
                    <button class="action-btn close-btn">
                        <i class="fas fa-times"></i>
                        إغلاق
                    </button>
                </div>
            `;
            
            // إضافة معالجات الأحداث
            const viewBtn = notificationDiv.querySelector('.view-btn');
            const closeBtn = notificationDiv.querySelector('.close-btn');
            
            viewBtn.addEventListener('click', () => {
                this.openChatWithUser(senderId);
                notificationDiv.remove();
            });
            
            closeBtn.addEventListener('click', () => {
                notificationDiv.remove();
            });
            
            // إضافة الإشعار إلى المستند
            document.body.appendChild(notificationDiv);
            
            // إزالة الإشعار بعد 10 ثوانٍ
            setTimeout(() => {
                if (document.body.contains(notificationDiv)) {
                    notificationDiv.style.animation = 'slideOut 0.3s ease-out forwards';
                    setTimeout(() => {
                        if (document.body.contains(notificationDiv)) {
                            notificationDiv.remove();
                        }
                    }, 300);
                }
            }, 10000);
            
            // محاولة إظهار إشعار نظام إذا كان المتصفح يدعم ذلك
            if ("Notification" in window && Notification.permission === "granted") {
                const notification = new Notification(`رسالة جديدة من ${sender.fullName || sender.name || 'مستخدم'}`, {
                    body: messageText,
                    icon: sender.photoUrl || sender.imageUrl || 'default-avatar.png',
                    badge: 'default-avatar.png',
                    tag: 'new-message'
                });
                
                notification.onclick = () => {
                    window.focus();
                    this.openChatWithUser(senderId);
                    notification.close();
                };
            }
        } catch (error) {
            console.error('Error showing message notification:', error);
        }
    }
    
    // تعليم رسالة كمقروءة
    async markMessageAsRead(messageId) {
        try {
            // التحقق من وجود مستخدم مسجل الدخول
            if (!this.currentUser) return;
            
            // الحصول على مسار الرسالة
            const messagesContainer = document.getElementById('chatMessagesContainer');
            const targetUserId = messagesContainer.getAttribute('data-target-user');
            
            if (!targetUserId) return;
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(this.currentUser.uid, targetUserId);
            
            // تحديث حالة الرسالة
            await this.database.ref(`chats/${chatPath}/messages/${messageId}`).update({
                read: true
            });
        } catch (error) {
            console.error('Error marking message as read:', error);
        }
    }
    
    // تعليم جميع رسائل محادثة كمقروءة
    async markMessagesAsRead(targetUserId) {
        try {
            // التحقق من وجود مستخدم مسجل الدخول
            if (!this.currentUser) return;
            
            // تحديد مسار المحادثة
            const chatPath = this.getChatPath(this.currentUser.uid, targetUserId);
            
            // الحصول على الرسائل
            const messagesSnapshot = await this.database.ref(`chats/${chatPath}/messages`).once('value');
            const messages = messagesSnapshot.val() || {};
            
            // تحديث حالة الرسائل غير المقروءة
            const updates = {};
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                if (!message.read && message.senderId !== this.currentUser.uid) {
                    updates[`chats/${chatPath}/messages/${messageId}/read`] = true;
                }
            });
            
            // تطبيق التحديثات
            if (Object.keys(updates).length > 0) {
                await this.database.ref().update(updates);
                
                // تحديث عداد الرسائل غير المقروءة
                this.updateUnreadMessageCount();
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }
}

// إنشاء كائن عام من نظام المحادثة
window.chatSystem = new ChatSystem();

// ==================================================================
// تكامل نظام المراسلة مع وحدة المنشورات
// ==================================================================

// تعديل وحدة المنشورات لدعم المراسلة
const originalPostsManager = window.postsManager || {};

class EnhancedPostsManager {
    constructor(originalManager) {
        // نسخ الخصائص والدوال من المدير الأصلي
        Object.assign(this, originalManager);
        
        // حفظ المدير الأصلي للاستخدام في الدوال
        this.originalManager = originalManager;
        
        // تهيئة التكامل مع نظام المراسلة
        this.initChatIntegration();
    }
    
    // تهيئة التكامل مع نظام المراسلة
    initChatIntegration() {
        // الاستماع للتحديثات في قائمة المنشورات
        document.addEventListener('posts-updated', () => {
            this.addChatButtonsToAllPosts();
        });
        
        // إضافة أزرار المراسلة عند تهيئة المدير
        const originalInit = this.originalManager.init || this.init;
        this.init = function() {
            // استدعاء دالة التهيئة الأصلية
            if (typeof originalInit === 'function') {
                originalInit.apply(this, arguments);
            }
            
            // إضافة أزرار المراسلة بعد التهيئة
            setTimeout(() => {
                this.addChatButtonsToAllPosts();
            }, 1000); // تأخير قصير للتأكد من تحميل المنشورات
        };
        
        // تعديل دالة إضافة المنشور لإضافة زر المراسلة
        const originalAddPostToDOM = this.originalManager.addPostToDOM || this.addPostToDOM;
        this.addPostToDOM = function(postId, postData) {
            // استدعاء الدالة الأصلية
            if (typeof originalAddPostToDOM === 'function') {
                originalAddPostToDOM.apply(this, arguments);
            }
            
            // إضافة زر المراسلة
            this.addChatButtonToPost(postId, postData);
        };
    }
    
    // إضافة أزرار المراسلة لجميع المنشورات
    addChatButtonsToAllPosts() {
        const posts = document.querySelectorAll('.post');
        posts.forEach(post => {
            const postId = post.getAttribute('data-post-id');
            if (postId) {
                // الحصول على بيانات المنشور
                this.postsRef.child(postId).once('value').then(snapshot => {
                    const postData = snapshot.val();
                    if (postData) {
                        this.addChatButtonToPost(postId, postData);
                    }
                }).catch(error => {
                    console.error('Error fetching post data:', error);
                });
            }
        });
    }
    
    // إضافة زر المراسلة إلى منشور
    addChatButtonToPost(postId, postData) {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const postActions = postElement.querySelector('.post-actions');
        if (!postActions) return;
        
        // التحقق من أن المنشور مكتوب بواسطة سائق
        if (!postData.fromDriver && !postData.authorId) return;
        
        // التأكد من عدم وجود زر محادثة بالفعل
        if (postActions.querySelector('.chat-btn')) return;
        
        // الحصول على معرف الكاتب
        const authorId = postData.authorId;
        
        // إنشاء زر المراسلة
        const chatButton = document.createElement('button');
        chatButton.className = 'post-action-btn chat-btn';
        chatButton.setAttribute('data-post-id', postId);
        chatButton.setAttribute('data-author-id', authorId);
        chatButton.innerHTML = '<i class="fas fa-comment-dots"></i>';
        
        // التحقق من وجود رسائل غير مقروءة
        if (window.chatSystem) {
            window.chatSystem.getUnreadMessagesCount(authorId).then(count => {
                if (count > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'chat-badge';
                    badge.textContent = count;
                    chatButton.appendChild(badge);
                }
            }).catch(error => {
                console.error('Error getting unread count:', error);
            });
        }
        
        // إضافة معالج النقر
        chatButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // فتح المحادثة
            if (window.chatSystem) {
                window.chatSystem.openChatWithUser(authorId);
            } else {
                showToast('نظام المراسلة غير متاح حاليًا', 'error');
            }
        });
        
        // إدراج زر المراسلة بعد زر الإعجاب
        const likeButton = postActions.querySelector('.like-btn');
        const commentButton = postActions.querySelector('.comment-btn');
        
        if (likeButton && commentButton) {
            postActions.insertBefore(chatButton, commentButton);
        } else {
            // إضافة في النهاية إذا لم يتم العثور على الأزرار الأخرى
            postActions.appendChild(chatButton);
        }
    }
}

// استبدال مدير المنشورات الأصلي
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من وجود المدير الأصلي
    setTimeout(() => {
        if (window.postsManager) {
            // تخزين المدير الأصلي
            const originalManager = window.postsManager;
            
            // إنشاء المدير المحسن واستبداله
            window.postsManager = new EnhancedPostsManager(originalManager);
            
            // إعادة تهيئة المدير إذا كان قد تم تهيئته بالفعل
            if (originalManager.currentUser) {
                window.postsManager.addChatButtonsToAllPosts();
            }
            
            console.log('تم تحسين مدير المنشورات بنظام المراسلة');
        }
    }, 2000); // تأخير للتأكد من تهيئة المدير الأصلي
});

// ==================================================================
// وظائف مساعدة
// ==================================================================

// دالة عرض التوست إذا لم تكن موجودة
if (typeof showToast !== 'function') {
    window.showToast = function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `custom-toast animate__animated animate__fadeInRight`;
        
        // اختيار الأيقونة المناسبة
        let iconClass = 'fa-check-circle text-success';
        if (type === 'error') {
            iconClass = 'fa-times-circle text-danger';
        } else if (type === 'warning') {
            iconClass = 'fa-exclamation-triangle text-warning';
        } else if (type === 'info') {
            iconClass = 'fa-info-circle text-info';
        }
        
        toast.innerHTML = `
            <i class="fas ${iconClass} me-2"></i>
            <div>${message}</div>
        `;
        
        // إضافة التوست إلى الحاوية أو إنشاء حاوية جديدة
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // إخفاء التوست بعد 3 ثوانٍ
        setTimeout(() => {
            toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
}

// إضافة أنماط CSS الخاصة بالتنبيهات إذا لم تكن موجودة
if (!document.getElementById('toast-styles')) {
    const toastStyles = document.createElement('style');
    toastStyles.id = 'toast-styles';
    toastStyles.textContent = `
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }
        
        .custom-toast {
            display: flex;
            align-items: center;
            padding: 10px 15px;
            margin-bottom: 10px;
            background-color: #222;
            color: #fff;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            min-width: 200px;
            max-width: 350px;
        }
        
        @keyframes fadeInRight {
            from {
                opacity: 0;
                transform: translateX(50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes fadeOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(50px);
            }
        }
        
        .animate__fadeInRight {
            animation: fadeInRight 0.3s ease-out;
        }
        
        .animate__fadeOutRight {
            animation: fadeOutRight 0.3s ease-out;
        }
    `;
    document.head.appendChild(toastStyles);
}

// كود خاص بمعالجة تسجيل المستخدمين وتحديث حالة الشات
document.addEventListener('login-success', function() {
    // تحديث حالة نظام المراسلة عند تسجيل الدخول
    if (window.chatSystem) {
        // الحصول على بيانات المستخدم من التخزين المحلي
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            const user = JSON.parse(userData);
            window.chatSystem.currentUser = user;
            
            // تحديث عداد الرسائل غير المقروءة
            window.chatSystem.updateUnreadMessageCount();
            
            // بدء الاستماع للرسائل الجديدة
            window.chatSystem.listenForNewMessages();
        }
    }
});

document.addEventListener('logout-success', function() {
    // إعادة تعيين حالة نظام المراسلة عند تسجيل الخروج
    if (window.chatSystem) {
        window.chatSystem.currentUser = null;
        
        // إيقاف الاستماع للرسائل
        if (window.chatSystem.messagesListener) {
            window.chatSystem.messagesListener();
            window.chatSystem.messagesListener = null;
        }
    }
});

// تهيئة نظام المراسلة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // التأكد من تهيئة نظام المراسلة
    if (!window.chatSystem) {
        window.chatSystem = new ChatSystem();
    }
    
    // تحديث أزرار المراسلة في المنشورات الموجودة
    setTimeout(() => {
        if (window.postsManager && window.postsManager.addChatButtonsToAllPosts) {
            window.postsManager.addChatButtonsToAllPosts();
        }
    }, 2500);
});