// دالة تحميل الرسائل بين المستخدمين والسائقين
async function loadMessagesBetweenUsersAndDrivers() {
    try {
        const messagesList = document.getElementById('messagesList');
        const noMessagesContainer = document.getElementById('noMessagesContainer');
        const errorMessagesContainer = document.getElementById('errorMessagesContainer');
        
        // إظهار مؤشر التحميل
        messagesList.innerHTML = `
            <div class="loading-messages">
                <div class="spinner-border text-gold" role="status">
                    <span class="visually-hidden">جاري التحميل...</span>
                </div>
                <p>جاري تحميل الرسائل...</p>
            </div>
        `;
        
        // إخفاء رسائل الخطأ والرسائل الفارغة
        noMessagesContainer.classList.add('d-none');
        errorMessagesContainer.classList.add('d-none');

        // جلب المستخدم الحالي من التخزين المحلي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        // الحصول على معرف المستخدم الحالي
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) {
            // إذا لم يكن هناك مستخدم مسجل الدخول
            noMessagesContainer.classList.remove('d-none');
            messagesList.innerHTML = '';
            return;
        }

        // جلب جميع المحادثات
        const chatsSnapshot = await firebase.database().ref('chats').once('value');
        const allChats = chatsSnapshot.val() || {};
        
        // تحضير مصفوفة المحادثات لهذا المستخدم
        const userChats = [];
        
        // مسار البحث عن المحادثات يختلف حسب نوع المستخدم (مستخدم عادي أو سائق)
        const isDriver = currentUser.userType === 'driver' || currentUser.role === 'driver';
        
        // البحث في جميع المحادثات
        Object.keys(allChats).forEach(firstId => {
            Object.keys(allChats[firstId] || {}).forEach(secondId => {
                // تحديد ما إذا كان المستخدم الحالي طرفًا في هذه المحادثة
                const isUserInvolved = (firstId === currentUserId || secondId === currentUserId);
                
                if (isUserInvolved) {
                    // تحديد الطرف الآخر في المحادثة
                    const otherPartyId = firstId === currentUserId ? secondId : firstId;
                    const chatData = allChats[firstId][secondId];
                    
                    // إذا كانت هناك رسائل في هذه المحادثة
                    if (chatData && chatData.messages) {
                        // الحصول على آخر رسالة
                        const messageIds = Object.keys(chatData.messages);
                        if (messageIds.length > 0) {
                            const lastMessageId = messageIds[messageIds.length - 1];
                            const lastMessage = chatData.messages[lastMessageId];
                            
                            // حساب عدد الرسائل غير المقروءة
                            let unreadCount = 0;
                            messageIds.forEach(msgId => {
                                const msg = chatData.messages[msgId];
                                if (!msg.read && msg.senderId !== currentUserId) {
                                    unreadCount++;
                                }
                            });
                            
                            // إضافة معلومات المحادثة
                            userChats.push({
                                chatId: `${firstId}_${secondId}`,
                                otherPartyId: otherPartyId,
                                lastMessage: lastMessage,
                                unreadCount: unreadCount,
                                timestamp: lastMessage.timestamp
                            });
                        }
                    }
                }
            });
        });
        
        // ترتيب المحادثات حسب آخر رسالة
        userChats.sort((a, b) => b.timestamp - a.timestamp);
        
        // التحقق من وجود محادثات
        if (userChats.length === 0) {
            noMessagesContainer.classList.remove('d-none');
            messagesList.innerHTML = '';
            return;
        }
        
        // جلب معلومات المستخدمين والسائقين الآخرين
        const userPromises = userChats.map(chat => getUserInfo(chat.otherPartyId));
        const usersInfo = await Promise.all(userPromises);
        
        // إعداد قائمة المحادثات للعرض
        messagesList.innerHTML = '';
        
        userChats.forEach((chat, index) => {
            // استخدام معلومات المستخدم الآخر
            const otherUser = usersInfo[index];
            if (!otherUser) return; // تخطي إذا لم يتم العثور على معلومات المستخدم
            
            // تحديد نوع المستخدم الآخر
            const isOtherPartyDriver = otherUser.userType === 'driver' || otherUser.role === 'driver';
            
            // تنسيق وقت آخر رسالة
            const lastMessageTime = formatTimestamp(chat.lastMessage.timestamp);
            
            // تحديد نوع الرسالة الأخيرة
            const isLocationMessage = chat.lastMessage.type === 'location';
            const messagePreview = isLocationMessage ? 'مشاركة موقع 📍' : (chat.lastMessage.text || '');
            
            // إنشاء عنصر المحادثة
            const messageItem = document.createElement('div');
            messageItem.className = `message-item ${chat.unreadCount > 0 ? 'unread' : ''}`;
            messageItem.innerHTML = `
                <div class="message-avatar">
                    <img src="${otherUser.photoUrl || otherUser.imageUrl || 'default-avatar.png'}" alt="${otherUser.name || 'مستخدم'}">
                    <div class="user-type-badge ${isOtherPartyDriver ? 'driver-badge' : 'user-badge'}">
                        <i class="fas ${isOtherPartyDriver ? 'fa-taxi' : 'fa-user'}"></i>
                    </div>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <h6 class="message-sender">${otherUser.name || otherUser.fullName || 'مستخدم'}</h6>
                        <span class="message-time">${lastMessageTime}</span>
                    </div>
                    <p class="message-preview">
                        ${chat.lastMessage.senderId === currentUserId ? '<i class="fas fa-reply me-1" style="opacity: 0.5;"></i>' : ''}
                        ${messagePreview}
                    </p>
                    <div class="message-footer">
                        <div class="message-status">
                            ${chat.lastMessage.senderId === currentUserId ? 
                                (chat.lastMessage.read ? 
                                    '<i class="fas fa-check-double text-primary"></i> تم القراءة' : 
                                    '<i class="fas fa-check"></i> تم الإرسال') : ''}
                        </div>
                        <div class="message-badges">
                            ${isLocationMessage ? '<span class="message-badge location"><i class="fas fa-map-marker-alt me-1"></i> موقع</span>' : ''}
                            ${chat.unreadCount > 0 ? `<span class="message-badge unread">${chat.unreadCount} جديدة</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // إضافة معالج الحدث للنقر
            messageItem.addEventListener('click', () => {
                // تعيين معلومات المستخدم الآخر في المحادثة وعرض نافذة المحادثة
                openChatWithUser(chat.otherPartyId, otherUser);
                
                // إغلاق نافذة قائمة الرسائل
                const messagesModal = bootstrap.Modal.getInstance(document.getElementById('messagesModal'));
                if (messagesModal) {
                    messagesModal.hide();
                }
            });
            
            // إضافة العنصر للقائمة
            messagesList.appendChild(messageItem);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        
        // عرض رسالة الخطأ
        document.getElementById('errorMessagesContainer').classList.remove('d-none');
        document.getElementById('errorMessagesText').textContent = error.message || 'حدث خطأ أثناء تحميل الرسائل';
        document.getElementById('messagesList').innerHTML = '';
    }
}

// دالة للحصول على معلومات المستخدم
async function getUserInfo(userId) {
    try {
        // البحث أولاً في قاعدة بيانات المستخدمين
        const userSnapshot = await firebase.database().ref(`users/${userId}`).once('value');
        let userData = userSnapshot.val();
        
        // إذا لم يتم العثور على المستخدم، ابحث في قاعدة بيانات السائقين
        if (!userData) {
            const driversSnapshot = await firebase.database().ref(`drivers`).orderByChild('uid').equalTo(userId).once('value');
            const driversData = driversSnapshot.val();
            
            if (driversData) {
                // استخراج بيانات السائق من النتيجة
                const driverId = Object.keys(driversData)[0];
                userData = driversData[driverId];
                userData.userType = 'driver'; // تعيين نوع المستخدم كسائق
                userData.role = 'driver';
                userData.driverId = driverId;
            }
        }
        
        // إذا لم يتم العثور على المستخدم في أي من القاعدتين
        if (!userData) {
            return {
                name: `مستخدم ${userId.substring(0, 6)}`,
                photoUrl: 'default-avatar.png',
                userType: 'user' // افتراضي
            };
        }
        
        return userData;
    } catch (error) {
        console.error('Error getting user info:', error);
        // إرجاع بيانات افتراضية في حالة حدوث خطأ
        return {
            name: 'مستخدم غير معروف',
            photoUrl: 'default-avatar.png',
            userType: 'user' // افتراضي
        };
    }
}

// دالة فتح المحادثة مع مستخدم معين
async function openChatWithUser(userId, userData = null) {
    try {
        // التحقق من وجود مستخدم مسجل الدخول
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (!currentUser || !currentUser.uid) {
            showToast('يرجى تسجيل الدخول أولاً للتمكن من إجراء المحادثات', 'warning');
            return;
        }

        // التحقق من أن المستخدم لا يحاول محادثة نفسه
        if (currentUser.uid === userId) {
            showToast('لا يمكن إجراء محادثة مع نفسك', 'warning');
            return;
        }

        // جلب معلومات المستخدم المستهدف إذا لم تكن موجودة
        if (!userData) {
            userData = await getUserInfo(userId);
        }

        if (!userData) {
            showToast('لم يتم العثور على المستخدم', 'error');
            return;
        }

        // تحديد نوع المستخدم الآخر
        const isOtherPartyDriver = userData.userType === 'driver' || userData.role === 'driver';

        // تحديث معلومات نافذة المحادثة
        document.getElementById('chatUserAvatar').src = userData.photoUrl || userData.imageUrl || 'default-avatar.png';
        document.getElementById('chatUserName').textContent = userData.name || userData.fullName || 'مستخدم';
        document.getElementById('chatUserInfo').textContent = isOtherPartyDriver ? 'سائق' : 'مستخدم';

        // تحديث رابط الاتصال إذا كان رقم الهاتف متاحاً
        const callBtn = document.getElementById('chatCallBtn');
        if (userData.phone) {
            callBtn.setAttribute('onclick', `window.open('tel:${userData.phone}', '_blank')`);
            callBtn.disabled = false;
        } else {
            callBtn.disabled = true;
        }

        // تخزين معرف المستخدم المستهدف في عنصر حاوية الرسائل
        const messagesContainer = document.getElementById('chatMessagesContainer');
        messagesContainer.setAttribute('data-target-user', userId);

        // تحميل الرسائل السابقة
        await loadMessages(userId);

        // تعليم الرسائل كمقروءة
        markMessagesAsRead(userId);

        // عرض تذكير بمشاركة الموقع (للمستخدمين العاديين عند التحدث مع سائق)
        const locationReminderBanner = document.getElementById('locationReminderBanner');
        if (locationReminderBanner) {
            if (!isOtherPartyDriver && currentUser.userType !== 'driver') {
                locationReminderBanner.classList.add('d-none');
            } else if (isOtherPartyDriver && currentUser.userType !== 'driver') {
                locationReminderBanner.classList.remove('d-none');
                
                // إضافة معالج لزر مشاركة الموقع السريع
                const quickShareLocationBtn = document.getElementById('quickShareLocationBtn');
                if (quickShareLocationBtn) {
                    quickShareLocationBtn.onclick = () => shareLocation(userId);
                }
            } else {
                locationReminderBanner.classList.add('d-none');
            }
        }

        // إضافة معالج لزر إرسال الرسالة
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        if (sendMessageBtn) {
            sendMessageBtn.onclick = () => sendMessage(userId);
        }

        // إضافة معالج لزر مشاركة الموقع
        const shareLocationBtn = document.getElementById('shareLocationBtn');
        if (shareLocationBtn) {
            shareLocationBtn.onclick = () => shareLocation(userId);
        }

        // إضافة معالج لمفتاح Enter في حقل الإدخال
        const chatMessageInput = document.getElementById('chatMessageInput');
        if (chatMessageInput) {
            chatMessageInput.onkeypress = function(event) {
                if (event.key === 'Enter') {
                    sendMessage(userId);
                }
            };
            // تركيز حقل الإدخال
            setTimeout(() => chatMessageInput.focus(), 300);
        }

        // فتح نافذة المحادثة
        const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
        chatModal.show();
    } catch (error) {
        console.error('Error opening chat:', error);
        showToast('حدث خطأ أثناء فتح المحادثة', 'error');
    }
}

// دالة تحميل الرسائل بين المستخدم والطرف الآخر
async function loadMessages(targetUserId) {
    try {
        const messagesContainer = document.getElementById('chatMessagesContainer');
        
        // عرض مؤشر التحميل
        messagesContainer.innerHTML = `
            <div class="loading-messages">
                <div class="spinner-border text-gold" role="status">
                    <span class="visually-hidden">جاري التحميل...</span>
                </div>
                <p>جاري تحميل الرسائل...</p>
            </div>
        `;
        
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) {
            messagesContainer.innerHTML = '<div class="no-messages text-center p-4">يرجى تسجيل الدخول أولاً</div>';
            return;
        }
        
        // تحديد مسار المحادثة
        const chatPath = getChatPath(currentUserId, targetUserId);
        
        // جلب الرسائل من قاعدة البيانات
        const messagesSnapshot = await firebase.database().ref(`chats/${chatPath}/messages`).orderByChild('timestamp').once('value');
        const messages = messagesSnapshot.val() || {};
        
        // تنظيف حاوية الرسائل
        messagesContainer.innerHTML = '';
        
        // التحقق من وجود رسائل
        if (Object.keys(messages).length === 0) {
            messagesContainer.innerHTML = `
                <div class="no-messages text-center p-4">
                    <i class="fas fa-comments fa-3x mb-3" style="color: #444;"></i>
                    <p>لا توجد رسائل سابقة. ابدأ محادثة جديدة!</p>
                </div>
            `;
            return;
        }
        
        // تجميع الرسائل حسب اليوم
        const messagesByDate = {};
        
        // معالجة الرسائل وتجميعها
        Object.keys(messages).forEach(messageId => {
            const message = messages[messageId];
            
            // الحصول على تاريخ الرسالة
            const messageDate = new Date(message.timestamp);
            const dateStr = messageDate.toLocaleDateString('ar-SA');
            
            // إضافة المجموعة إذا لم تكن موجودة
            if (!messagesByDate[dateStr]) {
                messagesByDate[dateStr] = [];
            }
            
            // إضافة الرسالة إلى المجموعة المناسبة
            messagesByDate[dateStr].push({
                id: messageId,
                ...message
            });
        });
        
        // عرض الرسائل مع فواصل التاريخ
        Object.keys(messagesByDate).forEach(dateStr => {
            // إضافة فاصل التاريخ
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date-separator text-center my-3';
            dateDiv.innerHTML = `
                <span class="date-label px-3 py-1">${formatDateHeader(dateStr)}</span>
            `;
            messagesContainer.appendChild(dateDiv);
            
            // إضافة رسائل هذا اليوم
            messagesByDate[dateStr].forEach(message => {
                addMessageToUI(message, message.id);
            });
        });
        
        // التمرير إلى آخر رسالة
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    } catch (error) {
        console.error('Error loading messages:', error);
        
        const messagesContainer = document.getElementById('chatMessagesContainer');
        messagesContainer.innerHTML = `
            <div class="error-message text-center p-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger"></i>
                <p>حدث خطأ أثناء تحميل الرسائل.</p>
                <button class="btn btn-primary mt-2" onclick="loadMessages('${targetUserId}')">
                    <i class="fas fa-sync-alt me-2"></i>
                    إعادة المحاولة
                </button>
            </div>
        `;
    }
}

// دالة إضافة رسالة إلى واجهة المستخدم
function addMessageToUI(message, messageId) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    
    // الحصول على المستخدم الحالي
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUserId = currentUser.uid;
    
    // تحديد ما إذا كانت الرسالة مرسلة أم مستلمة
    const isSent = message.senderId === currentUserId;
    
    // إنشاء عنصر الرسالة
    const messageElem = document.createElement('div');
    messageElem.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    messageElem.setAttribute('data-message-id', messageId);
    
    // تحديد نوع الرسالة (نص أو موقع)
    if (message.type === 'location') {
        // رسالة موقع
        messageElem.innerHTML = `
            <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                <div class="location-message" onclick="viewLocation(${message.location.lat}, ${message.location.lng}, '${messageId}')">
                    <div class="location-header">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>موقع ${isSent ? 'مشترك' : 'مستلم'}</span>
                    </div>
                    <div class="location-preview">
                        <i class="fas fa-map"></i>
                    </div>
                    <div class="location-info">
                        ${message.location.lat.toFixed(6)}, ${message.location.lng.toFixed(6)}
                    </div>
                    <div class="location-action">
                        انقر لعرض الموقع على الخريطة
                    </div>
                </div>
            </div>
            <span class="message-time">${formatMessageTime(message.timestamp)}</span>
            ${isSent ? `
                <span class="message-status">
                    ${message.read ? '<i class="fas fa-check-double text-primary"></i>' : '<i class="fas fa-check"></i>'}
                </span>
            ` : ''}
        `;
    } else {
        // رسالة نصية عادية
        messageElem.innerHTML = `
            <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                ${message.text || ''}
            </div>
            <span class="message-time">${formatMessageTime(message.timestamp)}</span>
            ${isSent ? `
                <span class="message-status">
                    ${message.read ? '<i class="fas fa-check-double text-primary"></i>' : '<i class="fas fa-check"></i>'}
                </span>
            ` : ''}
        `;
    }
    
    // إضافة الرسالة إلى الحاوية
    messagesContainer.appendChild(messageElem);
}

// دالة إرسال رسالة
async function sendMessage(targetUserId) {
    try {
        // الحصول على نص الرسالة
        const messageInput = document.getElementById('chatMessageInput');
        const text = messageInput.value.trim();
        
        // التحقق من وجود نص
        if (!text) return;
        
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) {
            showToast('يرجى تسجيل الدخول أولاً للتمكن من إرسال الرسائل', 'warning');
            return;
        }
        
        // تحديد مسار المحادثة
        const chatPath = getChatPath(currentUserId, targetUserId);
        
        // إنشاء بيانات الرسالة
        const messageData = {
            text: text,
            senderId: currentUserId,
            senderName: currentUser.name || currentUser.fullName || 'مستخدم',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        };
        
        // حفظ الرسالة في قاعدة البيانات
        const newMessageRef = await firebase.database().ref(`chats/${chatPath}/messages`).push(messageData);
        
        // تنظيف حقل الإدخال
        messageInput.value = '';
        messageInput.focus();
        
        // إضافة الرسالة إلى واجهة المستخدم بوقت مؤقت
        const tempMessage = {
            ...messageData,
            timestamp: Date.now()
        };
        
        addMessageToUI(tempMessage, newMessageRef.key);
        
        // التمرير إلى أسفل
        const messagesContainer = document.getElementById('chatMessagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // تشغيل صوت الإرسال
        playMessageSound();
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('حدث خطأ أثناء إرسال الرسالة', 'error');
    }
}

// دالة مشاركة الموقع
async function shareLocation(targetUserId) {
    try {
        // التحقق من دعم تحديد الموقع
        if (!navigator.geolocation) {
            showToast('متصفحك لا يدعم خدمة تحديد الموقع', 'error');
            return;
        }
        
        // عرض مؤشر التحميل
        showToast('جاري تحديد موقعك...', 'info');
        
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) {
            showToast('يرجى تسجيل الدخول أولاً للتمكن من مشاركة الموقع', 'warning');
            return;
        }
        
        // الحصول على الموقع الحالي
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude, accuracy } = position.coords;
        
        // تحديد مسار المحادثة
        const chatPath = getChatPath(currentUserId, targetUserId);
        
        // إنشاء بيانات رسالة الموقع
        const locationMessage = {
            type: 'location',
            location: {
                lat: latitude,
                lng: longitude,
                accuracy: accuracy
            },
            senderId: currentUserId,
            senderName: currentUser.name || currentUser.fullName || 'مستخدم',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        };
        
        // حفظ رسالة الموقع في قاعدة البيانات
        const newMessageRef = await firebase.database().ref(`chats/${chatPath}/messages`).push(locationMessage);
        
        // إضافة الرسالة إلى واجهة المستخدم بوقت مؤقت
        const tempMessage = {
            ...locationMessage,
            timestamp: Date.now()
        };
        
        addMessageToUI(tempMessage, newMessageRef.key);
        
        // التمرير إلى أسفل
        const messagesContainer = document.getElementById('chatMessagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // تشغيل صوت الإرسال
        playMessageSound();
        
        // إخفاء تذكير مشاركة الموقع إذا كان ظاهراً
        const locationReminderBanner = document.getElementById('locationReminderBanner');
        if (locationReminderBanner && !locationReminderBanner.classList.contains('d-none')) {
            locationReminderBanner.classList.add('d-none');
        }
        
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

// دالة عرض الموقع على الخريطة
function viewLocation(lat, lng, messageId) {
    try {
        // إغلاق نافذة المحادثة
        const chatModal = bootstrap.Modal.getInstance(document.getElementById('chatModal'));
        chatModal.hide();
        
        // التأكد من وجود خريطة
        if (!window.map) {
            showToast('الخريطة غير متاحة حالياً', 'error');
            return;
        }
        
        // تعليم الرسالة كمقروءة
        markMessageAsRead(messageId);
        
        // انتقال الخريطة إلى الموقع
        window.map.flyTo([lat, lng], 15, {
            animate: true,
            duration: 1.5
        });
        
        // إنشاء طبقة العلامات إذا لم تكن موجودة
        if (!window.markerLayer) {
            window.markerLayer = L.layerGroup().addTo(window.map);
        } else {
            window.markerLayer.clearLayers();
        }
        
        // إضافة علامة على الخريطة للموقع المشارك
        const locationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `
                    <div class="custom-marker location-marker">
                        <div class="marker-pulse"></div>
                        <div class="marker-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                    </div>
                `,
                className: '',
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            })
        }).addTo(window.markerLayer);
        
        // إضافة نافذة منبثقة للعلامة
        locationMarker.bindPopup(`
            <div class="location-popup">
                <h6>الموقع المشارك</h6>
                <p class="location-coordinates">
                    <i class="fas fa-map-pin"></i>
                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </p>
                <div class="location-actions">
                    <button onclick="getDirectionsToLocation(${lat}, ${lng})" class="location-btn">
                        <i class="fas fa-directions"></i>
                        الاتجاهات
                    </button>
                    <button onclick="window.open('https://www.google.com/maps?q=${lat},${lng}', '_blank')" class="location-btn">
                        <i class="fas fa-external-link-alt"></i>
                        فتح في Google Maps
                    </button>
                </div>
            </div>
        `, {
            maxWidth: 300,
            className: 'custom-popup'
        }).openPopup();
        
        // التمرير إلى الخريطة
        document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error viewing location:', error);
        showToast('حدث خطأ في عرض الموقع', 'error');
    }
}

// دالة الحصول على الاتجاهات إلى الموقع
async function getDirectionsToLocation(destLat, destLng) {
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
        
        // التأكد من وجود طبقة للمسارات
        if (!window.routeLayer) {
            window.routeLayer = L.layerGroup().addTo(window.map);
        } else {
            window.routeLayer.clearLayers();
        }
        
        // محاولة الحصول على المسار باستخدام OSRM
        try {
            // بناء عنوان طلب OSRM API
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson`;
            
            // إجراء الطلب
            const response = await fetch(osrmUrl);
            const data = await response.json();
            
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                
                // إضافة علامات البداية والنهاية
                const startMarker = L.marker([sourceLat, sourceLng], {
                    icon: L.divIcon({
                        html: '<div class="start-marker"><i class="fas fa-user"></i></div>',
                        className: '',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    })
                }).addTo(window.routeLayer);
                
                const endMarker = L.marker([destLat, destLng], {
                    icon: L.divIcon({
                        html: '<div class="end-marker"><i class="fas fa-map-marker-alt"></i></div>',
                        className: '',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).addTo(window.routeLayer);
                
                // رسم المسار
                const routeLine = L.polyline(coordinates, {
                    color: '#FFD700',
                    weight: 5,
                    opacity: 0.7,
                    lineJoin: 'round',
                    lineCap: 'round',
                    dashArray: '10, 10'
                }).addTo(window.routeLayer);
                
                // ضبط مستوى التكبير لرؤية المسار بالكامل
                routeLine.getBounds(), {
                    padding: [50, 50]
                }; // Added missing semicolon
                
                // عرض معلومات المسار
                const distance = (route.distance / 1000).toFixed(1); // بالكيلومترات
                const duration = Math.ceil(route.duration / 60); // بالدقائق
                
                // إضافة معلومات المسار
                const routeInfoDiv = document.createElement('div');
                routeInfoDiv.className = 'route-info-container';
                routeInfoDiv.innerHTML = `
                    <div class="route-info">
                        <h6><i class="fas fa-route"></i> معلومات الرحلة</h6>
                        <div class="route-info-item">
                            <i class="fas fa-road"></i>
                            <span>المسافة: ${distance} كم</span>
                        </div>
                        <div class="route-info-item">
                            <i class="fas fa-clock"></i>
                            <span>الوقت المتوقع: ${duration} دقيقة</span>
                        </div>
                        <button onclick="clearRoute()" class="clear-route-btn">
                            <i class="fas fa-times"></i> مسح المسار
                        </button>
                    </div>
                `;
                
                // إضافة معلومات المسار إلى الخريطة
                const routeInfoControl = L.control({ position: 'bottomleft' });
                routeInfoControl.onAdd = () => routeInfoDiv;
                routeInfoControl.addTo(window.map);
                
                // تخزين التحكم في متغير عالمي
                window.routeInfoControl = routeInfoControl;
                
                showToast('تم عرض المسار بنجاح', 'success');
            } else {
                throw new Error('لم يتم العثور على مسار');
            }
        } catch (routeError) {
            console.error('Error getting route:', routeError);
            
            // عند فشل الحصول على المسار، استخدم خط مستقيم كبديل
            const straightLine = L.polyline([
                [sourceLat, sourceLng],
                [destLat, destLng]
            ], {
                color: '#FFD700',
                weight: 4,
                opacity: 0.6,
                dashArray: '10, 10'
            }).addTo(window.routeLayer);
            
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

// دالة مسح المسار وعناصر التحكم
function clearRoute() {
    // إزالة عنصر التحكم بمعلومات المسار
    if (window.routeInfoControl) {
        window.map.removeControl(window.routeInfoControl);
        window.routeInfoControl = null;
    }
    
    // مسح طبقة المسارات
    if (window.routeLayer) {
        window.routeLayer.clearLayers();
    }
    
    showToast('تم مسح المسار', 'info');
}

// دالة تعليم رسالة واحدة كمقروءة
async function markMessageAsRead(messageId) {
    try {
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) return;
        
        // الحصول على المستخدم المستهدف من عنصر المحادثة
        const messagesContainer = document.getElementById('chatMessagesContainer');
        const targetUserId = messagesContainer.getAttribute('data-target-user');
        
        if (!targetUserId) return;
        
        // تحديد مسار المحادثة
        const chatPath = getChatPath(currentUserId, targetUserId);
        
        // تحديث حالة الرسالة
        await firebase.database().ref(`chats/${chatPath}/messages/${messageId}`).update({
            read: true
        });
        
        // تحديث عدد الرسائل غير المقروءة في الواجهة
        updateUnreadMessageCount();
    } catch (error) {
        console.error('Error marking message as read:', error);
    }
}

// دالة تعليم جميع رسائل محادثة كمقروءة
async function markMessagesAsRead(targetUserId) {
    try {
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) return;
        
        // تحديد مسار المحادثة
        const chatPath = getChatPath(currentUserId, targetUserId);
        
        // جلب الرسائل
        const messagesSnapshot = await firebase.database().ref(`chats/${chatPath}/messages`).once('value');
        const messages = messagesSnapshot.val() || {};
        
        // تجهيز التحديثات
        const updates = {};
        
        // تعليم الرسائل غير المقروءة التي لم يتم إرسالها من المستخدم الحالي
        Object.keys(messages).forEach(messageId => {
            const message = messages[messageId];
            if (!message.read && message.senderId !== currentUserId) {
                updates[`chats/${chatPath}/messages/${messageId}/read`] = true;
            }
        });
        
        // تنفيذ التحديثات إذا كانت هناك أي رسائل غير مقروءة
        if (Object.keys(updates).length > 0) {
            await firebase.database().ref().update(updates);
            
            // تحديث عدد الرسائل غير المقروءة
            updateUnreadMessageCount();
        }
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// دالة تحديث عدد الرسائل غير المقروءة
async function updateUnreadMessageCount() {
    try {
        // الحصول على المستخدم الحالي
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        
        if (!currentUserId) return;
        
        // جلب جميع المحادثات
        const chatsSnapshot = await firebase.database().ref('chats').once('value');
        const allChats = chatsSnapshot.val() || {};
        
        // حساب إجمالي الرسائل غير المقروءة
        let totalUnread = 0;
        
        // البحث في المحادثات
        Object.keys(allChats).forEach(firstId => {
            Object.keys(allChats[firstId] || {}).forEach(secondId => {
                // تحديد ما إذا كان المستخدم الحالي طرفاً في هذه المحادثة
                const isUserInvolved = (firstId === currentUserId || secondId === currentUserId);
                
                if (isUserInvolved && allChats[firstId][secondId].messages) {
                    // حساب الرسائل غير المقروءة لهذه المحادثة
                    const messages = allChats[firstId][secondId].messages;
                    
                    Object.values(messages).forEach(message => {
                        if (!message.read && message.senderId !== currentUserId) {
                            totalUnread++;
                        }
                    });
                }
            });
        });
        
        // تحديث شارة الرسائل في الواجهة
        updateMessageBadge(totalUnread);
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
}

// دالة تحديث شارة عدد الرسائل غير المقروءة في الواجهة
function updateMessageBadge(count) {
    const badges = document.querySelectorAll('.message-badge');
    
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
}

// دالة الحصول على مسار المحادثة
function getChatPath(userId1, userId2) {
    // ترتيب المعرفات لضمان اتساق المسار
    const [firstId, secondId] = [userId1, userId2].sort();
    return `${firstId}/${secondId}`;
}

// دالة تنسيق الطابع الزمني
function formatTimestamp(timestamp) {
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
            day: 'numeric'
        });
    }
}

// دالة تنسيق زمن الرسالة
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    // تنسيق الوقت فقط (الساعة:الدقيقة)
    return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// دالة تنسيق عنوان التاريخ
function formatDateHeader(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // تحويل التواريخ إلى سلاسل نصية للمقارنة (تجاهل الوقت)
    const dateString = date.toLocaleDateString('ar-EG');
    const todayString = today.toLocaleDateString('ar-EG');
    const yesterdayString = yesterday.toLocaleDateString('ar-EG');
    
    if (dateString === todayString) {
        return 'اليوم';
    } else if (dateString === yesterdayString) {
        return 'الأمس';
    } else {
        return date.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// دالة تشغيل صوت الإشعار
function playMessageSound() {
    const messageSound = document.getElementById('messageSound');
    if (messageSound) {
        // إعادة ضبط الصوت
        messageSound.pause();
        messageSound.currentTime = 0;
        
        // تشغيل الصوت
        messageSound.play().catch(error => {
            console.log('Could not play message sound:', error);
        });
    }
}

// دالة عرض إشعار منبثق
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `custom-toast animate__animated animate__fadeInRight toast-${type}`;
    
    // اختيار الأيقونة المناسبة
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-times-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    else if (type === 'info') icon = 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon} me-2"></i>
        <div>${message}</div>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    
    // إضافة التوست إلى الحاوية أو إنشاء الحاوية
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // إخفاء التوست تلقائياً بعد 3 ثوانٍ
    setTimeout(() => {
        toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// تحميل الرسائل عند فتح النافذة المنبثقة
document.addEventListener('DOMContentLoaded', function() {
    // إضافة معالج لنافذة الرسائل
    const messagesModal = document.getElementById('messagesModal');
    if (messagesModal) {
        messagesModal.addEventListener('show.bs.modal', loadMessagesBetweenUsersAndDrivers);
    }
    
    // إضافة معالجي البحث والتصفية
    const searchInput = document.getElementById('messagesSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterMessages);
    }
    
    const filterRadios = document.querySelectorAll('input[name="messageFilterType"]');
    filterRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const filterType = this.id.replace('Messages', '').toLowerCase();
            filterMessagesByType(filterType);
        });
    });
    
    // معالج لزر إرسال الرسالة
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', function() {
            const messagesContainer = document.getElementById('chatMessagesContainer');
            const targetUserId = messagesContainer.getAttribute('data-target-user');
            if (targetUserId) {
                sendMessage(targetUserId);
            }
        });
    }
    
    // معالج للرموز التعبيرية
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', function() {
            // يمكن تنفيذ منتقي الرموز التعبيرية هنا
            showToast('سيتم إضافة منتقي الرموز التعبيرية قريباً', 'info');
        });
    }
    
    // معالج للمرفقات
    const attachmentBtn = document.getElementById('attachmentBtn');
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', function() {
            // يمكن تنفيذ منتقي المرفقات هنا
            showToast('سيتم إضافة ميزة المرفقات قريباً', 'info');
        });
    }

    // إضافة معالج لزر post-action-btn chat-btn
    const chatButton = document.querySelector('.post-action-btn.chat-btn');
    if (chatButton) {
        chatButton.addEventListener('click', async function() {
            const targetUserId = chatButton.getAttribute('data-target-user-id'); // افترض أن معرف المستخدم موجود في خاصية data-target-user-id
            if (targetUserId) {
                await openChatWithUser(targetUserId);
            } else {
                showToast('لم يتم العثور على معرف المستخدم', 'error');
            }
        });
    }
});

// دالة تصفية الرسائل بناءً على النص المدخل
function filterMessages() {
    const searchTerm = document.getElementById('messagesSearchInput').value.toLowerCase();
    const messageItems = document.querySelectorAll('.message-item');
    
    messageItems.forEach(item => {
        const messageText = item.querySelector('.message-preview').textContent.toLowerCase();
        const senderName = item.querySelector('.message-sender').textContent.toLowerCase();
        
        if (messageText.includes(searchTerm) || senderName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
    
    // عرض رسالة عدم وجود نتائج إذا لم يتم العثور على أي رسائل مطابقة
    checkEmptyResults();
}

// دالة تصفية الرسائل حسب النوع
function filterMessagesByType(type) {
    const messageItems = document.querySelectorAll('.message-item');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUserId = currentUser.uid;
    
    messageItems.forEach(item => {
        // إعادة إظهار جميع الرسائل أولاً
        item.style.display = 'flex';
        
        if (type === 'driver') {
            // عرض الرسائل من السائقين فقط
            const isDriver = item.querySelector('.user-type-badge').classList.contains('driver-badge');
            if (!isDriver) {
                item.style.display = 'none';
            }
        } else if (type === 'user') {
            // عرض الرسائل من المستخدمين العاديين فقط
            const isUser = item.querySelector('.user-type-badge').classList.contains('user-badge');
            if (!isUser) {
                item.style.display = 'none';
            }
        } else if (type === 'unread') {
            // عرض الرسائل غير المقروءة فقط
            const isUnread = item.classList.contains('unread');
            if (!isUnread) {
                item.style.display = 'none';
            }
        }
        // type === 'all' يظهر جميع الرسائل
    });
    
    // عرض رسالة عدم وجود نتائج إذا لم يتم العثور على أي رسائل مطابقة
    checkEmptyResults();
}

// دالة التحقق من وجود نتائج فارغة
function checkEmptyResults() {
    const visibleItems = Array.from(document.querySelectorAll('.message-item')).filter(item => item.style.display !== 'none');
    const noMessagesContainer = document.getElementById('noMessagesContainer');
    
    if (visibleItems.length === 0 && noMessagesContainer) {
        noMessagesContainer.classList.remove('d-none');
        noMessagesContainer.querySelector('h5').textContent = 'لا توجد نتائج';
        noMessagesContainer.querySelector('p').textContent = 'لم يتم العثور على أي رسائل مطابقة لمعايير البحث.';
    } else if (noMessagesContainer) {
        noMessagesContainer.classList.add('d-none');
    }
}