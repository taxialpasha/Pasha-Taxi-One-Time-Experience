       // فتح نافذة المحادثة بين السائق والمستخدم
       function openDriverChatWindow(driverId, userId) {
        showLoading();
    
        // جلب معلومات المستخدم
        Promise.all([
            database.ref(`users/${userId}`).once('value'),
            database.ref(`chats/${userId}/${driverId}/messages`).once('value')
        ])
            .then(([userSnapshot, messagesSnapshot]) => {
                // استخراج بيانات المستخدم مع التحقق من جميع الحقول المحتملة
                const userData = userSnapshot.val() || {};
                
                // استخدام الاسم الكامل من عدة حقول محتملة
                const userName = userData.fullName || userData.name || `مستخدم ${userId.substring(0, 6)}`;
                
                // استخدام صورة الملف الشخصي من عدة حقول محتملة
                const userPhoto = userData.photoUrl || userData.profilePicture || userData.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/user-photos%2F1741376568952_default-avatar.png?alt=media&token=ad672ccf-c8e1-4788-a252-52de6c3ceedd';
                
                const messages = messagesSnapshot.val() || {};
    
                // تحويل المفاتيح إلى مصفوفة
                const messagesList = Object.keys(messages).map(key => ({
                    id: key,
                    ...messages[key]
                })).sort((a, b) => a.timestamp - b.timestamp);
    
                // تجهيز HTML للرسائل
                let messagesHtml = '';
                messagesList.forEach(msg => {
                    const isFromDriver = msg.sender === driverId;
                    
                    // التحقق من نوع الرسالة
                    if (msg.type === 'location') {
                        // إنشاء عرض لرسالة الموقع
                        messagesHtml += createLocationMessageView(msg, msg.id, isFromDriver);
                    } else {
                        // إنشاء عرض لرسالة نصية عادية
                        messagesHtml += `
                            <div class="message ${isFromDriver ? 'sent' : 'received'}">
                                <div class="message-bubble ${isFromDriver ? 'sent' : 'received'}">
                                    <p>${msg.text || ''}</p>
                                    <div class="timestamp">${formatMessageTime(msg.timestamp)}</div>
                                </div>
                            </div>
                        `;
                    }
                });
    
                // إنشاء نافذة المحادثة مع بيانات المستخدم المحدثة
                Swal.fire({
                    title: userName,
                    html: `
                        <div class="chat-container">
                            <div class="chat-header" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #FFD700;">
                                <img src="${userPhoto}" alt="${userName}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                                <div>
                                    <h5 style="margin: 0; color: #FFFFFF;">${userName}</h5>
                                    ${userData.email ? `<small style="color: #CCCCCC;">${userData.email}</small>` : ''}
                                </div>
                            </div>
                            <div class="chat-body" id="chatBody" style="flex-grow: 1; overflow-y: auto; padding: 15px; background-color: #1a1a1a;">
                                ${messagesHtml || '<div class="no-messages">لا توجد رسائل سابقة</div>'}
                            </div>
                            <div class="chat-footer" style="padding: 10px; display: flex; gap: 10px; background-color: #242424; border-top: 1px solid #FFD700;">
                                <button class="location-btn" id="shareLocationBtn" title="مشاركة الموقع" style="width: 40px; height: 40px; border-radius: 50%; background: #333; color: #FFD700; border: none; cursor: pointer;">
                                    <i class="fas fa-map-marker-alt"></i>
                                </button>
                                <input type="text" id="driverMessageInput" class="chat-input" placeholder="اكتب رسالتك هنا..." style="flex-grow: 1; border-radius: 20px; padding: 8px 15px; background: #333; color: #FFF; border: 1px solid #FFD700;">
                                <button class="send-btn" onclick="sendDriverMessage('${driverId}', '${userId}')" style="width: 40px; height: 40px; border-radius: 50%; background: #FFD700; color: #000; border: none; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    `,
                    width: '90%',
                    padding: '0',
                    background: '#1a1a1a',
                    color: '#FFFFFF',
                    showConfirmButton: false,
                    showCloseButton: true,
                    didOpen: () => {
                        // تمرير للأسفل ليظهر آخر رسالة
                        const chatBody = document.getElementById('chatBody');
                        if (chatBody) {
                            chatBody.scrollTop = chatBody.scrollHeight;
                        }
    
                        // إضافة مستمع الحدث لمفتاح Enter
                        const messageInput = document.getElementById('driverMessageInput');
                        if (messageInput) {
                            messageInput.addEventListener('keypress', function (e) {
                                if (e.key === 'Enter') {
                                    sendDriverMessage(driverId, userId);
                                }
                            });
                            messageInput.focus();
                        }
    
                        // إضافة مستمع الحدث لزر مشاركة الموقع
                        const shareLocationBtn = document.getElementById('shareLocationBtn');
                        if (shareLocationBtn) {
                            shareLocationBtn.addEventListener('click', function() {
                                shareDriverLocation(driverId, userId);
                            });
                        }
    
                        // تعليم جميع رسائل هذا المستخدم كمقروءة
                        markConversationAsRead(driverId, userId);
                    },
                    customClass: {
                        popup: 'dark-popup chat-window',
                        title: 'text-white chat-header',
                        closeButton: 'chat-close-btn'
                    }
                });
    
                hideLoading();
            })
            .catch(error => {
                console.error('Error opening chat:', error);
                hideLoading();
                showToast('حدث خطأ في فتح المحادثة', 'error');
            });
    }
    
    
    // دالة مشاركة موقع السائق
    async function shareDriverLocation(driverId, userId) {
        try {
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
            
            const { latitude, longitude } = position.coords;
            
            // إنشاء بيانات رسالة الموقع
            const locationMessage = {
                sender: driverId, // معرف السائق
                type: 'location',
                location: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: position.coords.accuracy
                },
                timestamp: Date.now(),
                read: false
            };
            
            // إرسال رسالة الموقع للمستخدم
            await database.ref(`chats/${userId}/${driverId}/messages`).push(locationMessage);
            
            // إضافة الرسالة الجديدة إلى نافذة المحادثة
            const chatBody = document.getElementById('chatBody');
            if (chatBody) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
                messageElement.innerHTML = createLocationMessageView(locationMessage, Date.now().toString(), true);
                chatBody.appendChild(messageElement);
                chatBody.scrollTop = chatBody.scrollHeight;
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
    
    
    // دالة إنشاء عرض لرسالة الموقع
    function createLocationMessageView(message, messageId, isFromDriver) {
        const { lat, lng } = message.location;
        
        return `
            <div class="message-bubble ${isFromDriver ? 'sent' : 'received'}" style="background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; padding: 10px; border-radius: 10px; margin: 5px 0;">
                <div class="location-message" data-message-id="${messageId}" data-lat="${lat}" data-lng="${lng}" onclick="navigateToLocation(${lat}, ${lng}, '${messageId}')" style="cursor: pointer; transition: all 0.3s ease;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <i class="fas fa-map-marker-alt" style="color: #FFD700; font-size: 1.2rem;"></i>
                        <span>موقع ${isFromDriver ? 'السائق' : 'المستخدم'}</span>
                    </div>
                    <div style="width: 100%; height: 120px; border-radius: 8px; border: 1px solid #555; background: #242424; overflow: hidden; margin-bottom: 5px; display: flex; align-items: center; justify-content: center;">
                        <div style="color: #FFD700; text-align: center;">
                            <i class="fas fa-map" style="font-size: 2rem; margin-bottom: 5px;"></i>
                            <div>الإحداثيات: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                        </div>
                    </div>
                    <div style="text-align: center; color: #FFD700; font-size: 0.8rem;">
                        انقر للانتقال إلى الموقع على الخريطة
                    </div>
                </div>
                <div class="timestamp" style="text-align: right; font-size: 0.7rem; color: #999; margin-top: 5px;">${formatMessageTime(message.timestamp)}</div>
            </div>
        `;
    }
    
    
    
    // دالة الانتقال إلى الموقع على الخريطة
    function navigateToLocation(lat, lng, messageId) {
        // إغلاق نافذة المحادثة أو تصغيرها
        const currentSwalInstance = Swal.getPopup();
        if (currentSwalInstance) {
            Swal.close();
        }
    
        // إظهار رسالة جاري الانتقال إلى الموقع
        showToast('جاري الانتقال إلى الموقع...', 'info');
        
        // تأخير قليل للتأكد من إغلاق النافذة السابقة
        setTimeout(() => {
            // تحريك الخريطة إلى الموقع المحدد مع تأثير حركي
            map.flyTo([lat, lng], 15, {
                animate: true,
                duration: 1.5
            });
            
            // إنشاء علامة على الخريطة للموقع المشترك
            markerLayer.clearLayers(); // مسح العلامات الحالية
            
            // إنشاء علامة الموقع مع تصميم مميز
            const locationMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(255, 215, 0, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #FFD700; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #000;">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                        </div>
                    `,
                    className: 'custom-location-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                })
            }).addTo(markerLayer);
            
            // إضافة نافذة منبثقة تعرض معلومات الموقع
            locationMarker.bindPopup(`
                <div style="text-align: center; padding: 10px;">
                    <h6 style="color: #FFD700; margin-bottom: 10px;">الموقع المشترك</h6>
                    <p style="display: flex; align-items: center; justify-content: center; gap: 5px; margin-bottom: 10px;">
                        <i class="fas fa-map-pin" style="color: #FFD700;"></i>
                        <span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
                    </p>
                    <button onclick="window.open('https://www.google.com/maps?q=${lat},${lng}', '_blank')" 
                            style="background: #FFD700; color: #000; border: none; padding: 5px 10px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; gap: 5px; margin: 0 auto;">
                        <i class="fas fa-external-link-alt"></i>
                        فتح في خرائط Google
                    </button>
                </div>
            `, {
                className: 'custom-popup'
            }).openPopup();
            
            // تعليم رسالة الموقع كمقروءة
            markLocationMessageAsRead(messageId);
        }, 500);
    }
    
    // دالة تعليم رسالة الموقع كمقروءة
    function markLocationMessageAsRead(messageId) {
        // البحث عن المحادثة التي تحتوي على هذه الرسالة
        database.ref(`chats`).once('value')
            .then(snapshot => {
                const allChats = snapshot.val() || {};
                
                // البحث عن الرسالة في جميع المحادثات
                Object.keys(allChats).forEach(userId => {
                    Object.keys(allChats[userId] || {}).forEach(driverId => {
                        const messages = allChats[userId][driverId]?.messages || {};
                        
                        if (messages[messageId]) {
                            // وجدنا الرسالة، نعلمها كمقروءة
                            database.ref(`chats/${userId}/${driverId}/messages/${messageId}`).update({
                                read: true
                            });
                        }
                    });
                });
            });
    }
    
    
    
    
    
    // تحديث دالة إرسال الرسالة من المستخدم
    function sendMessage() {
        const messageInput = document.getElementById('chatInput');
        const messageText = messageInput.value.trim();
    
        if (messageText) {
            const message = {
                sender: userId,
                type: 'text', // تحديد النوع كنص
                text: messageText,
                timestamp: Date.now(),
                read: false
            };
    
            database.ref(`chats/${userId}/${currentChatDriverId}/messages`).push(message);
            messageInput.value = ''; // تفريغ حقل الإدخال
        }
    }
    
    
    
    
    
    // دالة مشاركة موقع المستخدم
    async function shareUserLocation() {
        try {
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
            
            const { latitude, longitude } = position.coords;
            
            // إنشاء بيانات رسالة الموقع
            const locationMessage = {
                sender: userId, // معرف المستخدم الحالي
                type: 'location',
                location: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: position.coords.accuracy
                },
                timestamp: Date.now(),
                read: false
            };
            
            // إرسال رسالة الموقع للسائق
            const messageRef = await database.ref(`chats/${userId}/${currentChatDriverId}/messages`).push(locationMessage);
            
            // إضافة الرسالة الجديدة إلى نافذة المحادثة
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
                messageElement.innerHTML = createLocationMessageView(locationMessage, messageRef.key, false);
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
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
    
    
    
    
    
    
    // تحديث دالة تحميل الرسائل
    function loadMessages() {
        const chatBox = document.getElementById('chatMessages');
        chatBox.innerHTML = '';
    
        database.ref(`chats/${userId}/${currentChatDriverId}/messages`).on('child_added', (snapshot) => {
            const message = snapshot.val();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.classList.add(message.sender === userId ? 'sent' : 'received');
            
            // التحقق من نوع الرسالة
            if (message.type === 'location') {
                // إنشاء عرض لرسالة الموقع
                messageDiv.innerHTML = createLocationMessageView(message, snapshot.key, message.sender === userId);
            } else {
                // إنشاء عرض لرسالة نصية عادية
                messageDiv.innerHTML = `
                    <div class="message-bubble ${message.sender === userId ? 'sent' : 'received'}">
                        <p>${message.text || ''}</p>
                        <span class="timestamp">${formatMessageTime(message.timestamp)}</span>
                    </div>
                `;
            }
            
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }
    
    
    
    
    
    // تحديث دالة فتح نافذة المحادثة للمستخدم
    function openChatWindow(driverId, driverImage, driverName, driverCard) {
        currentChatDriverId = driverId;
        currentDriverImage = driverImage;
        currentDriverName = driverName;
        currentDriverCard = driverCard;
    
        // تحديث بيانات السائق في النافذة
        document.getElementById('driverImage').src = driverImage;
        document.getElementById('driverName').innerText = driverName;
        document.getElementById('driverCardInfo').innerText = `بطاقة: ${driverCard}`;
    
        // إعادة ضبط النافذة: إظهار إدخال الرحلة وإخفاء الرسائل
        document.getElementById('tripSelection').classList.remove('d-none');
        document.querySelector('.chat-footer').classList.add('d-none');
        document.getElementById('chatMessages').classList.add('d-none');
    
        // إضافة زر مشاركة الموقع
        const chatFooter = document.querySelector('.chat-footer');
        if (chatFooter) {
            chatFooter.innerHTML = `
                <div class="input-group w-100">
                    <button class="location-btn" id="shareLocationBtn" title="مشاركة الموقع" style="width: 40px; height: 40px; border-radius: 50%; background: #333; color: #FFD700; border: none; cursor: pointer;">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <input type="text" id="chatInput" class="form-control chat-input" placeholder="اكتب رسالتك هنا...">
                    <button class="btn send-btn" onclick="sendMessage()">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            `;
        }
    
        // إظهار النافذة
        const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
        chatModal.show();
    
        // إضافة مستمع الحدث لزر مشاركة الموقع بعد ظهور النافذة
        setTimeout(() => {
            const shareLocationBtn = document.getElementById('shareLocationBtn');
            if (shareLocationBtn) {
                shareLocationBtn.addEventListener('click', shareUserLocation);
            }
        }, 500);
    }
    
    
    
    // تحديث دالة تأكيد الرحلة لدعم الموقع
    function confirmTrip() {
        const tripCount = document.getElementById('tripCount').value;
        const tripDestination = document.getElementById('tripDestination').value;
        const tripType = document.getElementById('tripType').value;
        const tripDays = ["الأحد", "الإثنين", "الثلاثاء"];
    
        if (tripCount > 0 && tripDestination) {
            const tripData = {
                tripCount: tripCount,
                tripDestination: tripDestination,
                tripType: tripType,
                tripDays: tripDays,
                timestamp: Date.now()
            };
    
            // إضافة بيانات الرحلة
            database.ref(`chats/${userId}/${currentChatDriverId}/trips`).push(tripData)
                .then(() => {
                    // تحديث عدد الرحلات للسائق
                    return database.ref(`drivers/${currentChatDriverId}`).transaction((driver) => {
                        if (driver) {
                            driver.trips = (driver.trips || 0) + 1;
                        }
                        return driver;
                    });
                })
                .then(() => {
                    showToast('تم تأكيد الرحلة بنجاح!', 'success');
                    document.getElementById('tripSelection').classList.add('d-none');
                    document.querySelector('.chat-footer').classList.remove('d-none');
                    document.getElementById('chatMessages').classList.remove('d-none');
                    
                    // إضافة مستمع الحدث لزر مشاركة الموقع
                    const shareLocationBtn = document.getElementById('shareLocationBtn');
                    if (shareLocationBtn) {
                        shareLocationBtn.addEventListener('click', shareUserLocation);
                    }
                    
                    loadMessages(); // تحميل الرسائل
                    loadDrivers(); // تحديث بطاقة السائق
                })
                .catch((error) => {
                    console.error("Error saving trip:", error);
                    showToast('حدث خطأ أثناء تأكيد الرحلة', 'error');
                });
        } else {
            showToast('يرجى إدخال جميع البيانات بشكل صحيح', 'warning');
        }
    }
    
    // دالة الانتقال إلى الموقع على الخريطة مع رسم خط السير
    async function navigateToLocation(lat, lng, messageId) {
        // إغلاق نافذة المحادثة
        const currentSwalInstance = Swal.getPopup();
        if (currentSwalInstance) {
            Swal.close();
        }
    
        // إظهار رسالة جاري الانتقال إلى الموقع
        showToast('جاري الانتقال إلى الموقع...', 'info');
        
        try {
            // الحصول على موقع المستخدم الحالي
            const userPosition = await getCurrentPositionPromise();
            const userLat = userPosition.coords.latitude;
            const userLng = userPosition.coords.longitude;
            
            // تحريك الخريطة إلى مركز بين النقطتين
            const centerLat = (userLat + parseFloat(lat)) / 2;
            const centerLng = (userLng + parseFloat(lng)) / 2;
            
            // حساب المسافة لتحديد مستوى التكبير المناسب
            const distance = calculateDistance(userLat, userLng, parseFloat(lat), parseFloat(lng));
            const zoomLevel = getZoomLevelByDistance(distance);
            
            // تحريك الخريطة للعرض المناسب
            map.flyTo([centerLat, centerLng], zoomLevel, {
                animate: true,
                duration: 1.5
            });
            
            // مسح الطبقات الحالية
            markerLayer.clearLayers();
            
            // إضافة علامة موقع المستخدم
            const userMarker = L.marker([userLat, userLng], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(0, 123, 255, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #fff;">
                                <i class="fas fa-user"></i>
                            </div>
                        </div>
                    `,
                    className: 'user-location-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                })
            }).addTo(markerLayer);
            
            // إضافة علامة الموقع المشترك
            const sharedLocationMarker = L.marker([parseFloat(lat), parseFloat(lng)], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(255, 215, 0, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #FFD700; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #000;">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                        </div>
                    `,
                    className: 'shared-location-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                })
            }).addTo(markerLayer);
            
            // رسم خط السير بين النقطتين
            const routeLine = L.polyline([
                [userLat, userLng],
                [parseFloat(lat), parseFloat(lng)]
            ], {
                color: '#FFD700',
                weight: 5,
                opacity: 0.7,
                dashArray: '10, 10',
                lineCap: 'round',
                lineJoin: 'round',
                className: 'animated-route'
            }).addTo(markerLayer);
            
            // الحصول على معلومات إضافية عن الموقع باستخدام خدمة Nominatim
            const locationInfo = await getLocationInfo(lat, lng);
            
            // تقدير المسافة والوقت
            const distanceInKm = calculateDistance(userLat, userLng, parseFloat(lat), parseFloat(lng));
            const estimatedTime = Math.ceil((distanceInKm * 60) / 40); // بافتراض سرعة متوسطة 40 كم/ساعة
            
            // إضافة نافذة معلومات مفصلة للموقع
            sharedLocationMarker.bindPopup(createDetailedLocationPopup(lat, lng, locationInfo, distanceInKm, estimatedTime, messageId), {
                className: 'custom-popup',
                maxWidth: 300,
                minWidth: 250
            }).openPopup();
            
            // تعليم رسالة الموقع كمقروءة
            markLocationMessageAsRead(messageId);
            
        } catch (error) {
            console.error('Error navigating to location:', error);
            
            // إذا تعذر الحصول على موقع المستخدم، نكتفي بعرض الموقع المشترك فقط
            map.flyTo([parseFloat(lat), parseFloat(lng)], 15, {
                animate: true,
                duration: 1.5
            });
            
            markerLayer.clearLayers();
            
            // إضافة علامة الموقع المشترك فقط
            const sharedLocationMarker = L.marker([parseFloat(lat), parseFloat(lng)], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(255, 215, 0, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #FFD700; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #000;">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                        </div>
                    `,
                    className: 'shared-location-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                })
            }).addTo(markerLayer);
            
            // محاولة الحصول على معلومات الموقع
            try {
                const locationInfo = await getLocationInfo(lat, lng);
                sharedLocationMarker.bindPopup(createDetailedLocationPopup(lat, lng, locationInfo, null, null, messageId), {
                    className: 'custom-popup',
                    maxWidth: 300,
                    minWidth: 250
                }).openPopup();
            } catch (infoError) {
                // إذا تعذر الحصول على معلومات الموقع، نكتفي بعرض الإحداثيات فقط
                sharedLocationMarker.bindPopup(`
                    <div style="text-align: center; padding: 10px;">
                        <h6 style="color: #FFD700; margin-bottom: 10px;">الموقع المشترك</h6>
                        <p style="display: flex; align-items: center; justify-content: center; gap: 5px; margin-bottom: 10px;">
                            <i class="fas fa-map-pin" style="color: #FFD700;"></i>
                            <span>${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</span>
                        </p>
                        <button onclick="window.open('https://www.google.com/maps?q=${lat},${lng}', '_blank')" 
                                style="background: #FFD700; color: #000; border: none; padding: 5px 10px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; gap: 5px; margin: 0 auto;">
                            <i class="fas fa-external-link-alt"></i>
                            فتح في خرائط Google
                        </button>
                    </div>
                `, {
                    className: 'custom-popup'
                }).openPopup();
            }
            
            // تعليم رسالة الموقع كمقروءة
            markLocationMessageAsRead(messageId);
            
            showToast('تعذر الحصول على موقعك الحالي، تم عرض الموقع المشترك فقط', 'warning');
        }
    }
    
    
    
    
    
    // دالة للحصول على موقع المستخدم باستخدام Promise
    function getCurrentPositionPromise() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }
    
    // دالة حساب المسافة بين نقطتين
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // نصف قطر الأرض بالكيلومترات
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance * 10) / 10; // تقريب إلى أقرب 0.1 كم
    }
    
    // تحويل الدرجات إلى راديان
    function toRad(degrees) {
        return degrees * Math.PI / 180;
    }
    
    // تحديد مستوى التكبير المناسب حسب المسافة
    function getZoomLevelByDistance(distance) {
        if (distance < 0.5) return 16;
        if (distance < 1) return 15;
        if (distance < 3) return 14;
        if (distance < 7) return 13;
        if (distance < 15) return 12;
        if (distance < 30) return 11;
        if (distance < 60) return 10;
        return 9;
    }
    
    // الحصول على معلومات الموقع باستخدام خدمة Nominatim
    async function getLocationInfo(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ar`);
            if (!response.ok) {
                throw new Error('فشل في الحصول على معلومات الموقع');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching location info:', error);
            throw error;
        }
    }
    
    // إنشاء نافذة معلومات مفصلة للموقع
    function createDetailedLocationPopup(lat, lng, locationInfo, distance, time, messageId) {
        // تنسيق العنوان بشكل أفضل
        const formatAddress = (info) => {
            if (!info || !info.address) return 'عنوان غير معروف';
            
            const addr = info.address;
            const parts = [];
            
            // ترتيب عناصر العنوان من الأصغر إلى الأكبر
            if (addr.road) parts.push(addr.road);
            if (addr.suburb) parts.push(addr.suburb);
            if (addr.city_district) parts.push(addr.city_district);
            if (addr.city) parts.push(addr.city);
            if (addr.state) parts.push(addr.state);
            if (addr.country) parts.push(addr.country);
            
            return parts.join('، ') || info.display_name || 'عنوان غير معروف';
        };
        
        // تحديد نوع الموقع
        const getLocationType = (info) => {
            if (!info || !info.address) return 'موقع';
            
            const addr = info.address;
            
            if (addr.amenity) return addr.amenity;
            if (addr.shop) return 'متجر ' + addr.shop;
            if (addr.building) return 'مبنى';
            if (addr.highway) return 'طريق';
            if (addr.leisure) return 'منطقة ترفيهية';
            
            return 'موقع';
        };
        
        // إعداد محتوى النافذة المنبثقة
        let popupContent = `
            <div class="location-detailed-popup">
                <h5 style="color: #FFD700; text-align: center; margin-bottom: 15px; font-weight: bold; border-bottom: 1px solid rgba(255, 215, 0, 0.3); padding-bottom: 10px;">
                    <i class="fas fa-map-marked-alt me-2"></i>
                    تفاصيل الموقع
                </h5>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                        <i class="fas fa-map-pin" style="color: #FFD700; margin-top: 3px; margin-left: 8px; min-width: 16px;"></i>
                        <div>
                            <strong style="color: #FFFFFF;">العنوان:</strong>
                            <p style="margin: 0; color: #CCCCCC;">${formatAddress(locationInfo)}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                        <i class="fas fa-info-circle" style="color: #FFD700; margin-top: 3px; margin-left: 8px; min-width: 16px;"></i>
                        <div>
                            <strong style="color: #FFFFFF;">نوع الموقع:</strong>
                            <p style="margin: 0; color: #CCCCCC;">${getLocationType(locationInfo)}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                        <i class="fas fa-map-marker-alt" style="color: #FFD700; margin-top: 3px; margin-left: 8px; min-width: 16px;"></i>
                        <div>
                            <strong style="color: #FFFFFF;">الإحداثيات:</strong>
                            <p style="margin: 0; color: #CCCCCC; font-family: monospace;">${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</p>
                        </div>
                    </div>
        `;
        
        // إضافة معلومات المسافة والوقت إذا كانت متوفرة
        if (distance !== null && time !== null) {
            popupContent += `
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                        <i class="fas fa-route" style="color: #FFD700; margin-top: 3px; margin-left: 8px; min-width: 16px;"></i>
                        <div>
                            <strong style="color: #FFFFFF;">المسافة:</strong>
                            <p style="margin: 0; color: #CCCCCC;">${distance} كم</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                        <i class="fas fa-clock" style="color: #FFD700; margin-top: 3px; margin-left: 8px; min-width: 16px;"></i>
                        <div>
                            <strong style="color: #FFFFFF;">الوقت التقريبي:</strong>
                            <p style="margin: 0; color: #CCCCCC;">${time} دقيقة</p>
                        </div>
                    </div>
            `;
        }
        
        // إضافة أزرار التفاعل
        popupContent += `
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    <button onclick="getDirectionsToLocation(${lat}, ${lng})" style="flex: 1; background: #FFD700; color: #000; border: none; padding: 8px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all 0.3s ease;">
                        <i class="fas fa-directions"></i>
                        الاتجاهات
                    </button>
                    
                    <button onclick="window.open('https://www.google.com/maps?q=${lat},${lng}', '_blank')" style="flex: 1; background: #333; color: #FFD700; border: 1px solid #FFD700; padding: 8px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all 0.3s ease;">
                        <i class="fas fa-external-link-alt"></i>
                        Google Maps
                    </button>
                </div>
                
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="reopenChatWithMessage('${messageId}')" style="width: 100%; background: transparent; color: #FFD700; border: 1px dashed #FFD700; padding: 8px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all 0.3s ease;">
                        <i class="fas fa-comment-alt"></i>
                        العودة للمحادثة
                    </button>
                </div>
            </div>
        `;
        
        return popupContent;
    }
    
    
    
    
    
    
    
    
    // دالة للحصول على الاتجاهات إلى الموقع باستخدام OSRM
    async function getDirectionsToLocation(destLat, destLng) {
        try {
            showToast('جاري الحصول على الاتجاهات...', 'info');
            
            // الحصول على موقع المستخدم الحالي
            const position = await getCurrentPositionPromise();
            const sourceLat = position.coords.latitude;
            const sourceLng = position.coords.longitude;
            
            // بناء رابط الطلب إلى خدمة OSRM
            const apiUrl = `https://router.project-osrm.org/route/v1/driving/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
            
            // إجراء الطلب
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('فشل في الحصول على بيانات المسار');
            }
            
            const data = await response.json();
            
            if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
                throw new Error('لم يتم العثور على مسار');
            }
            
            // الحصول على بيانات المسار
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // تحديث الخريطة
            markerLayer.clearLayers();
            
            // إضافة علامات البداية والنهاية
            const startMarker = L.marker([sourceLat, sourceLng], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #fff;">
                                <i class="fas fa-user"></i>
                            </div>
                        </div>
                    `,
                    className: 'user-location-marker',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                })
            }).addTo(markerLayer);
            
            const endMarker = L.marker([destLat, destLng], {
                icon: L.divIcon({
                    html: `
                        <div style="position: relative; width: 100%; height: 100%;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: #FFD700; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); z-index: 2; border: 2px solid #000;">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                        </div>
                    `,
                    className: 'destination-location-marker',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                })
            }).addTo(markerLayer);
            
            // رسم خط المسار
            const routeLine = L.polyline(coordinates, {
                color: '#4a89dc',
                weight: 5,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(markerLayer);
            
            // تكبير الخريطة لتناسب المسار
            map.fitBounds(routeLine.getBounds(), {
                padding: [30, 30]
            });
            
            // إضافة معلومات المسار
            const distance = (route.distance / 1000).toFixed(1); // المسافة بالكيلومترات
            const duration = Math.round(route.duration / 60); // الوقت بالدقائق
            
            // إنشاء مربع معلومات المسار
            const routeInfoControl = L.control({ position: 'bottomleft' });
            routeInfoControl.onAdd = function() {
                const div = L.DomUtil.create('div', 'route-info-box');
                div.innerHTML = `
                    <div style="background: rgba(0,0,0,0.8); color: #fff; padding: 15px; border-radius: 10px; border: 2px solid #FFD700; margin: 10px; min-width: 200px; max-width: 300px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                        <h6 style="color: #FFD700; margin-bottom: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid rgba(255,215,0,0.3); padding-bottom: 8px;">
                            <i class="fas fa-directions"></i> معلومات المسار
                        </h6>
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <i class="fas fa-route" style="color: #FFD700; margin-left: 10px; font-size: 1.1rem;"></i>
                            <div>
                                <span style="color: #ccc;">المسافة:</span>
                                <span style="color: #fff; font-weight: bold; margin-right: 5px;">${distance} كم</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <i class="fas fa-clock" style="color: #FFD700; margin-left: 10px; font-size: 1.1rem;"></i>
                            <div>
                                <span style="color: #ccc;">الوقت التقريبي:</span>
                                <span style="color: #fff; font-weight: bold; margin-right: 5px;">${duration} دقيقة</span>
                            </div>
                        </div>
                        <button onclick="clearRoute()" style="width: 100%; background: #FFD700; color: #000; border: none; padding: 8px; border-radius: 5px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all 0.3s ease; margin-top: 10px;">
                            <i class="fas fa-times"></i>
                            إغلاق المسار
                        </button>
                    </div>
                `;
                return div;
            };
            routeInfoControl.addTo(map);
            
            // حفظ التحكم في متغير عالمي للإزالة لاحقاً
            window.currentRouteInfoControl = routeInfoControl;
            
            showToast('تم عرض المسار بنجاح', 'success');
            
        } catch (error) {
            console.error('Error getting directions:', error);
            showToast('تعذر الحصول على المسار. يرجى المحاولة مرة أخرى.', 'error');
        }
    }
    
    // دالة لمسح المسار وعناصر التحكم
    function clearRoute() {
        // إزالة عنصر التحكم بمعلومات المسار
        if (window.currentRouteInfoControl) {
            map.removeControl(window.currentRouteInfoControl);
            window.currentRouteInfoControl = null;
        }
        
        // مسح طبقة العلامات
        markerLayer.clearLayers();
        
        showToast('تم مسح المسار', 'info');
    }
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    // تكملة دالة إنشاء عرض لرسالة الموقع
    function createLocationMessageView(message, messageId, isFromDriver) {
        const { lat, lng } = message.location;
        
        return `
            <div class="message-bubble ${isFromDriver ? 'sent' : 'received'}" style="background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; padding: 10px; border-radius: 10px; margin: 5px 0; width: 220px;">
                <div class="location-message" data-message-id="${messageId}" data-lat="${lat}" data-lng="${lng}" onclick="navigateToLocation(${lat}, ${lng}, '${messageId}')" style="cursor: pointer; transition: all 0.3s ease;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <i class="fas fa-map-marker-alt" style="color: #FFD700; font-size: 1.2rem;"></i>
                        <span style="color: #FFFFFF; font-weight: bold;">موقع ${isFromDriver ? 'السائق' : 'المستخدم'}</span>
                    </div>
                    <div style="width: 100%; height: 120px; border-radius: 8px; border: 1px solid #555; background: #242424; overflow: hidden; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; position: relative;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); z-index: 2;">
                            <i class="fas fa-map" style="color: #FFD700; font-size: 2rem; margin-bottom: 5px;"></i>
                            <div style="color: #FFFFFF; text-align: center; font-size: 0.8rem; padding: 0 10px;">
                                ${lat.toFixed(6)}, ${lng.toFixed(6)}
                            </div>
                        </div>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/pin-s+ffd700(${lng},${lat})/${lng},${lat},14,0/220x120?access_token=pk.eyJ1IjoiZXhhbXBsZXVzZXIiLCJhIjoiY2syMDNwdjZ6MDZwcTNpcDUyeW92bTBociJ9.example') center/cover; opacity: 0.5; filter: grayscale(30%);"></div>
                    </div>
                    <div style="text-align: center; color: #FFD700; font-size: 0.8rem;">
                        <i class="fas fa-info-circle"></i> انقر للانتقال إلى الموقع على الخريطة
                    </div>
                </div>
                <div class="timestamp" style="text-align: right; font-size: 0.7rem; color: #999; margin-top: 5px;">${formatMessageTime(message.timestamp)}</div>
            </div>
        `;
    }
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    // تحديث دالة فتح نافذة المحادثة
    function openChatWindow(driverId, driverImage, driverName, driverCard) {
        currentChatDriverId = driverId;
        currentDriverImage = driverImage;
        currentDriverName = driverName;
        currentDriverCard = driverCard;
    
        // تحديث بيانات السائق في النافذة
        document.getElementById('driverImage').src = driverImage;
        document.getElementById('driverName').innerText = driverName;
        document.getElementById('driverCardInfo').innerText = `بطاقة: ${driverCard}`;
    
        // إعادة ضبط النافذة: إظهار إدخال الرحلة
        document.getElementById('tripSelection').classList.remove('d-none');
        document.querySelector('.chat-footer').classList.add('d-none');
        document.getElementById('chatMessages').classList.add('d-none');
    
        // إظهار النافذة
        const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
        chatModal.show();
    }
    
    // تحديث دالة عرض المحادثة بعد تأكيد الرحلة
    function showChatInterface() {
        // إخفاء قسم اختيار الرحلة
        document.getElementById('tripSelection').classList.add('d-none');
        
        // إظهار واجهة الدردشة
        document.querySelector('.chat-footer').classList.remove('d-none');
        document.getElementById('chatMessages').classList.remove('d-none');
        
        // تحديث شريط إدخال المحادثة ليشمل زر مشاركة الموقع
        const chatFooter = document.querySelector('.chat-footer');
        if (chatFooter) {
            chatFooter.innerHTML = `
                <div class="input-group w-100">
                    <button class="location-btn" id="shareLocationBtn" title="مشاركة الموقع" style="width: 40px; height: 40px; border-radius: 50%; background: #333; color: #FFD700; border: none; cursor: pointer;">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <input type="text" id="chatInput" class="form-control chat-input" placeholder="اكتب رسالتك هنا...">
                    <button class="btn send-btn" onclick="sendMessage()">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            `;
            
            // إضافة مستمع الحدث لزر مشاركة الموقع
            const shareLocationBtn = document.getElementById('shareLocationBtn');
            if (shareLocationBtn) {
                shareLocationBtn.addEventListener('click', shareUserLocation);
            }
        }
        
        // تحميل الرسائل السابقة
        loadMessages();
    }
    
    // تحديث دالة تأكيد الرحلة لتستدعي showChatInterface
    function confirmTrip() {
        const tripCount = document.getElementById('tripCount').value;
        const tripDestination = document.getElementById('tripDestination').value;
        const tripType = document.getElementById('tripType').value;
        const tripDays = ["الأحد", "الإثنين", "الثلاثاء"];
    
        if (tripCount > 0 && tripDestination) {
            const tripData = {
                tripCount: tripCount,
                tripDestination: tripDestination,
                tripType: tripType,
                tripDays: tripDays,
                timestamp: Date.now()
            };
    
            // إضافة بيانات الرحلة
            database.ref(`chats/${userId}/${currentChatDriverId}/trips`).push(tripData)
                .then(() => {
                    // تحديث عدد الرحلات للسائق
                    return database.ref(`drivers/${currentChatDriverId}`).transaction((driver) => {
                        if (driver) {
                            driver.trips = (driver.trips || 0) + 1;
                        }
                        return driver;
                    });
                })
                .then(() => {
                    showToast('تم تأكيد الرحلة بنجاح!', 'success');
                    
                    // عرض واجهة المحادثة
                    showChatInterface();
                    
                    // تحديث بطاقة السائق
                    loadDrivers();
                })
                .catch((error) => {
                    console.error("Error saving trip:", error);
                    showToast('حدث خطأ في تأكيد الرحلة', 'error');
                });
        } else {
            showToast('يرجى إدخال جميع البيانات بشكل صحيح', 'warning');
        }
    }
    
    
    // تحديث دالة حساب عدد الرسائل غير المقروءة
    function getUnreadCount(chatData, driverId) {
        if (!chatData || !chatData.messages) return 0;
    
        let count = 0;
        const messages = chatData.messages;
    
        Object.keys(messages).forEach(key => {
            // تحقق من أن الرسالة غير مقروءة وأنها ليست من السائق نفسه
            if (!messages[key].read && messages[key].sender !== driverId) {
                count++;
            }
        });
    
        return count;
    }
    
    // دالة مشاركة موقع المستخدم
    async function shareUserLocation() {
        try {
            // عرض مؤشر التحميل
            showToast('جاري تحديد موقعك...', 'info');
            
            // الحصول على الموقع الحالي
            const position = await getCurrentPositionPromise();
            const { latitude, longitude } = position.coords;
            
            // إنشاء بيانات رسالة الموقع
            const locationMessage = {
                sender: userId, // معرف المستخدم الحالي
                type: 'location',
                location: {
                    lat: latitude,
                    lng: longitude,
                    accuracy: position.coords.accuracy
                },
                timestamp: Date.now(),
                read: false
            };
            
            // إرسال رسالة الموقع للسائق
            const messageRef = await database.ref(`chats/${userId}/${currentChatDriverId}/messages`).push(locationMessage);
            
            // إضافة الرسالة الجديدة إلى نافذة المحادثة
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
                messageElement.innerHTML = createLocationMessageView(locationMessage, messageRef.key, true);
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // إصدار صوت الإرسال
            playMessageSound();
            
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
    
    // دالة تشغيل صوت الرسالة
    function playMessageSound() {
        const messageSound = document.getElementById('messageSound');
        if (messageSound) {
            messageSound.play().catch(error => {
                console.log('Could not play message sound:', error);
            });
        }
    }
    
    
    
    
    
    // دالة إعادة فتح المحادثة مع تمييز رسالة معينة
    function reopenChatWithMessage(messageId) {
        // إغلاق النافذة المنبثقة الحالية
        const currentPopup = document.querySelector('.leaflet-popup');
        if (currentPopup) {
            const closeButton = currentPopup.querySelector('.leaflet-popup-close-button');
            if (closeButton) {
                closeButton.click();
            }
        }
        
        // مسح المسار على الخريطة
        clearRoute();
        
        // إعادة فتح نافذة المحادثة
        if (currentChatDriverId) {
            // فتح المحادثة للمستخدم العادي
            const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
            chatModal.show();
            
            // إظهار واجهة المحادثة
            document.getElementById('tripSelection').classList.add('d-none');
            document.querySelector('.chat-footer').classList.remove('d-none');
            document.getElementById('chatMessages').classList.remove('d-none');
            
            // تحميل الرسائل
            loadMessages();
            
            // تمييز الرسالة المحددة بعد فترة وجيزة
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    messageElement.style.animation = 'highlight 2s ease';
                }
            }, 500);
        } else {
            // للسائق: إعادة فتح محادثة المستخدم
            const userId = findUserIdByMessageId(messageId);
            if (userId) {
                openDriverChatWindow(getCurrentDriverId(), userId);
            } else {
                showToast('تعذر العثور على المحادثة', 'error');
            }
        }
    }
    
    // دالة للبحث عن معرف المستخدم باستخدام معرف الرسالة
    function findUserIdByMessageId(messageId) {
        // هذه الدالة تحتاج إلى تنفيذ يعتمد على هيكل البيانات الخاص بك
        // يمكنك تنفيذها باستخدام Firebase بطريقة أسنكرونية
        // هنا نقدم نموذجًا بسيطًا للتوضيح
        
        let foundUserId = null;
        
        // هنا يمكنك البحث في الذاكرة المؤقتة أو استدعاء Firebase
        // للبحث عن المستخدم الذي يملك هذه الرسالة
        
        // إرجاع معرف المستخدم أو null إذا لم يتم العثور عليه
        return foundUserId;
    }
    
    // دالة للحصول على معرف السائق الحالي
    function getCurrentDriverId() {
        // الحصول على بيانات المستخدم المسجل
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        
        // التحقق من أن المستخدم الحالي هو سائق
        if (currentUser.role === 'driver' && currentUser.uid) {
            return currentUser.uid;
        }
        
        return null;
    }
    
    
    // دالة لحفظ رسائل الموقع المشتركة في التخزين المحلي
    function saveSharedLocations(messageId, lat, lng, sender, timestamp) {
        try {
            // الحصول على قائمة المواقع الحالية
            let sharedLocations = JSON.parse(localStorage.getItem('sharedLocations')) || [];
            
            // إضافة الموقع الجديد
            sharedLocations.push({
                messageId,
                lat,
                lng,
                sender,
                timestamp,
                driverId: currentChatDriverId || getCurrentDriverId()
            });
            
            // الاحتفاظ بأحدث 20 موقع فقط
            if (sharedLocations.length > 20) {
                sharedLocations = sharedLocations.slice(-20);
            }
            
            // حفظ القائمة
            localStorage.setItem('sharedLocations', JSON.stringify(sharedLocations));
        } catch (error) {
            console.error('Error saving shared locations:', error);
        }
    }
    
    // دالة لتحميل آخر المواقع المشتركة
    function loadSharedLocations() {
        try {
            return JSON.parse(localStorage.getItem('sharedLocations')) || [];
        } catch (error) {
            console.error('Error loading shared locations:', error);
            return [];
        }
    }
    
    // دالة لإضافة خيار عرض آخر المواقع المشتركة
    function addRecentLocationsControl() {
        // إنشاء زر في الخريطة
        const recentLocationsControl = L.control({ position: 'topright' });
        recentLocationsControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'recent-locations-control');
            div.innerHTML = `
                <button title="آخر المواقع المشتركة" style="width: 40px; height: 40px; border-radius: 5px; background: #FFD700; color: #000; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); margin: 10px;">
                    <i class="fas fa-history"></i>
                </button>
            `;
            
            // إضافة مستمع الحدث
            div.firstChild.addEventListener('click', showRecentLocations);
            
            return div;
        };
        recentLocationsControl.addTo(map);
    }
    
    // دالة لعرض آخر المواقع المشتركة
    function showRecentLocations() {
        const locations = loadSharedLocations();
        
        if (locations.length === 0) {
            showToast('لا توجد مواقع مشتركة حديثة', 'info');
            return;
        }
        
        // إنشاء قائمة المواقع للعرض
        let locationsHTML = '';
        locations.forEach((location, index) => {
            locationsHTML += `
                <div class="recent-location-item" onclick="navigateToLocation(${location.lat}, ${location.lng}, '${location.messageId}')" style="background: rgba(0,0,0,0.7); padding: 10px; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s ease; border: 1px solid #444;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <div style="color: #FFD700; font-weight: bold;">
                            <i class="fas fa-map-marker-alt"></i> موقع ${location.sender === 'user' ? 'المستخدم' : 'السائق'}
                        </div>
                        <div style="color: #ccc; font-size: 0.8rem;">
                            ${formatRelativeTime(location.timestamp)}
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: #ddd; margin-top: 5px;">
                        <i class="fas fa-map-pin"></i> ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
                    </div>
                </div>
            `;
        });
        
        Swal.fire({
            title: 'آخر المواقع المشتركة',
            html: `
                <div style="max-height: 300px; overflow-y: auto; padding: 10px;">
                    ${locationsHTML}
                </div>
            `,
            background: '#1a1a1a',
            color: '#FFFFFF',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'dark-popup',
                title: 'text-white'
            }
        });
    }
    
    // دالة تنسيق الوقت النسبي
    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diffMs = now - timestamp;
        
        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
        } else if (hours > 0) {
            return `منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
        } else if (minutes > 0) {
            return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
        } else {
            return 'الآن';
        }
    
        
    }
    
    
    
    
    
    
    
    
    
    
    
    // تهيئة الخريطة
    function initMap() {
        const defaultLocation = [33.3152, 44.3661]; // بغداد
    
        map = L.map('map', {
            center: defaultLocation,
            zoom: 8,
            zoomControl: false
        });
    
        // تعريف طبقات الخريطة المختلفة
        const layers = {
            street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: 19
            }),
            dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© CartoDB',
                maxZoom: 19
            })
        };
    
        // إضافة الطبقة الافتراضية
        layers.dark.addTo(map);
    
        // إضافة زر التحكم بالطبقات
        L.control.layers({
            "خريطة الشوارع": layers.street,
            "قمر صناعي": layers.satellite,
            "خريطة داكنة": layers.dark
        }, null, {
            position: 'topleft',
            collapsed: true
        }).addTo(map);
    
        // إضافة زر موقع المستخدم
        const locationButton = L.control({ position: 'bottomright' });
        locationButton.onAdd = function () {
            const btn = L.DomUtil.create('button', 'user-location-btn');
            btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
            btn.title = 'تحديد موقعك الحالي';
            btn.onclick = function () {
                getCurrentLocation();
            };
            return btn;
        };
        locationButton.addTo(map);
    
        // إضافة زر التكبير/التصغير
        L.control.zoom({
            position: 'bottomright',
            zoomInTitle: 'تكبير',
            zoomOutTitle: 'تصغير'
        }).addTo(map);
    
        // إضافة مقياس المسافة
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 200
        }).addTo(map);
        
        // إضافة زر آخر المواقع المشتركة
        addRecentLocationsControl();
    
        // إضافة طبقات الخريطة
        markerLayer = L.layerGroup().addTo(map);
        routeLayer = L.layerGroup().addTo(map);
    }
    