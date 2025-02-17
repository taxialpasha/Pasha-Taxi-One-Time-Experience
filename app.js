const firebaseConfig = {
        apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPf1n1TrAzwEMiAI",
        authDomain: "messageemeapp.firebaseapp.com",
        databaseURL: "https://messageemeapp-default-rtdb.firebaseio.com",
        projectId: "messageemeapp",
        storageBucket: "messageemeapp.appspot.com",
        messagingSenderId: "255034474844",
        appId: "1:255034474844:web:5e3b7a6bc4b2fb94cc4199"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    const database = firebase.database();
    const storage = firebase.storage();
    const messaging = firebase.messaging();

    // Request notification permission
    // Enhanced notification handling
class NotificationHandler {
  constructor() {
      this.messaging = firebase.messaging();
      this.hasPermission = false;
  }

async initialize() {
    try {
        // محاولة تسجيل Service Worker
       // يجب تحديث جميع المسارات لتتضمن /Al-Pasha/
// مثلاً في ملف firebase-messaging-sw.js
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./firebase-messaging-sw.js', {
        scope: './'
    })
}

        await this.checkNotificationSupport();
        await this.requestPermission();
        await this.setupMessaging();
    } catch (error) {
        console.error('Notification initialization error:', error);
        this.handlePermissionError(error);
    }
}

  async checkNotificationSupport() {
      if (!('Notification' in window)) {
          throw new Error('This browser does not support notifications');
      }
  }

  async requestPermission() {
      try {
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
              this.hasPermission = true;
              return true;
          } else if (permission === 'denied') {
              throw new Error('notification_blocked');
          } else {
              throw new Error('notification_dismissed');
          }
      } catch (error) {
          throw error;
      }
  }

  async setupMessaging() {
    if (!this.hasPermission) return;

    try {
        // استخدام Service Worker المسجل
        await this.messaging.getToken({
            vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc',
            serviceWorkerRegistration: this.swRegistration
        });

        // إعداد معالج الرسائل
        this.messaging.onMessage((payload) => {
            console.log('Received foreground message:', payload);
            this.showNotification(payload);
        });
    } catch (error) {
        console.error('Error setting up messaging:', error);
        throw error;
    }
}

  async saveTokenToDatabase(token) {
      if (!userId) return;
      
      try {
          await database.ref('tokens/' + userId).set({ token: token });
      } catch (error) {
          console.error('Error saving token:', error);
      }
  }

  setupMessageHandler() {
      this.messaging.onMessage((payload) => {
          this.showNotification(payload);
      });
  }

  showNotification(payload) {
      if (!this.hasPermission) return;

      try {
          // Try using the Notification API
          new Notification(payload.notification.title, {
              body: payload.notification.body,
              icon: payload.notification.icon || '/default-icon.png',
              badge: '/badge-icon.png',
              tag: payload.data?.notificationId || 'default',
              data: payload.data
          });
      } catch (error) {
          // Fallback to custom toast notification
          this.showCustomToast(payload.notification);
      }
  }

  showCustomToast(notification) {
      const toast = document.createElement('div');
      toast.className = 'notification-toast animate__animated animate__fadeInRight';
      toast.innerHTML = `
          <div class="notification-content">
              <h4>${notification.title}</h4>
              <p>${notification.body}</p>
          </div>
          <button onclick="this.parentElement.remove()" class="close-btn">&times;</button>
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
          toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
          setTimeout(() => toast.remove(), 300);
      }, 5000);
  }

  handlePermissionError(error) {
      let message;
      
      switch(error.message) {
          case 'notification_blocked':
              message = 'التنبيهات محظورة. يرجى تفعيلها من إعدادات المتصفح';
              this.showPermissionInstructions();
              break;
          case 'notification_dismissed':
              message = 'لم يتم منح إذن التنبيهات. يمكنك تفعيلها لاحقاً من الإعدادات';
              break;
          default:
              message = 'حدث خطأ في إعداد التنبيهات';
      }
      
      showToast(message, 'warning');
  }

  showPermissionInstructions() {
      Swal.fire({
          title: 'تفعيل التنبيهات',
          html: `
              <div class="permission-instructions">
                  <p>لتلقي التنبيهات، يرجى اتباع الخطوات التالية:</p>
                  <ol>
                      <li>انقر على أيقونة القفل في شريط العنوان</li>
                      <li>ابحث عن إعدادات "التنبيهات"</li>
                      <li>قم بتغيير الإعداد إلى "السماح"</li>
                  </ol>
              </div>
          `,
          icon: 'info',
          confirmButtonText: 'فهمت'
      });
  }
}

// Initialize notifications
const notificationHandler = new NotificationHandler();
notificationHandler.initialize().catch(console.error);


    // Initialize user ID
    let userId;
    if (!localStorage.getItem('userId')) {
        userId = generateUUID();
        localStorage.setItem('userId', userId);
    } else {
        userId = localStorage.getItem('userId');
    }

    // Generate unique user ID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0,
                v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // Other application-specific logic
    let map;
    let markers = [];
    let userMarker;
    let userLocation = null;
    let markerLayer;
    let isLoadingDrivers = false; // للتحكم في حالة تحميل البيانات
    let isViewingDriverLocation = false; // لتعطيل تحديث موقع المستخدم عند عرض موقع السائق
    let currentDriverId = null;
    let currentChatDriverId = null;

    // Example: Fetch drivers from database
    function fetchDrivers() {
        if (isLoadingDrivers) return;
        isLoadingDrivers = true;

        database.ref('drivers').once('value', (snapshot) => {
            const drivers = snapshot.val();
            console.log(drivers);
            isLoadingDrivers = false;
        });
    }

    fetchDrivers(); // Load drivers on page load



    let currentDriverImage = ''; // متغير لصورة السائق
    let currentDriverName = '';  // متغير لاسم السائق
    let currentDriverCard = '';  // متغير لبطاقة السائق

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

        // إظهار النافذة
        const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
        chatModal.show();
    }

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
                    alert('تم تأكيد الرحلة بنجاح!');
                    document.getElementById('tripSelection').classList.add('d-none');
                    document.querySelector('.chat-footer').classList.remove('d-none');
                    document.getElementById('chatMessages').classList.remove('d-none');
                    loadMessages();
                    loadDrivers(); // تحديث بطاقة السائق
                })
                .catch((error) => {
                    console.error("Error saving trip:", error);
                });
        } else {
            alert('يرجى إدخال جميع البيانات بشكل صحيح.');
        }
    }

    // إضافة في نهاية الملف
function showNearbyDriversMap() {
    // إغلاق القائمة الجانبية
    toggleSideNav();

    // عرض نافذة منبثقة تحتوي على الخريطة
    Swal.fire({
        title: 'السائقين في الجوار',
        html: '<div id="nearbyDriversMap"></div>',
        width: '90%',
        padding: '0',
        background: '#1a1a1a',
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'dark-popup',
            title: 'text-white',
            htmlContainer: 'p-0'
        },
        didOpen: () => {
            // تهيئة الخريطة
            const mapContainer = document.getElementById('nearbyDriversMap');
            const root = ReactDOM.createRoot(mapContainer);
            root.render(React.createElement(NearbyDriversMap));
        }
    });
}

    function addRating(driverId) {
        database.ref(`drivers/${driverId}`).transaction((driver) => {
            if (driver) {
                // زيادة التقييم تدريجياً
                const currentRating = driver.rating || 5;
                const tripsCount = driver.trips || 0;

                // معادلة لحساب التقييم الجديد
                // كلما زاد عدد الرحلات، زاد التقييم بشكل أبطأ
                const newRating = Math.min(5, currentRating + (0.1 / Math.sqrt(tripsCount + 1)));

                driver.rating = parseFloat(newRating.toFixed(1));
            }
            return driver;
        }).then(() => {
            showToast('تم إضافة التقييم بنجاح');
            loadDrivers(); // تحديث بطاقة السائق
        }).catch((error) => {
            console.error('Error updating rating:', error);
            showToast('حدث خطأ في تحديث التقييم', 'error');
        });
    }

    function loadTrips() {
        const tripsContainer = document.getElementById('tripsList');
        tripsContainer.innerHTML = ''; // مسح الرحلات السابقة

        database.ref(`chats/${userId}/${currentChatDriverId}/trips`).on('child_added', (snapshot) => {
            const trip = snapshot.val();
            const tripDiv = document.createElement('div');
            tripDiv.className = 'trip-details';
            tripDiv.innerHTML = `
            <p>عدد المشاوير: ${trip.tripCount}</p>
            <p>الوجهة: ${trip.tripDestination}</p>
            <p>نوع الرحلة: ${trip.tripType}</p>
            <p>الأيام: ${trip.tripDays.join(', ')}</p>
            <p>التاريخ: ${new Date(trip.timestamp).toLocaleString()}</p>
        `;
            tripsContainer.appendChild(tripDiv);
        });
    }



    function sendMessage() {
        const messageInput = document.getElementById('chatInput');
        const messageText = messageInput.value.trim();

        if (messageText) {
            database.ref(`chats/${userId}/${currentChatDriverId}/messages`).push({
                sender: userId,
                text: messageText,
                timestamp: Date.now()
            });
            messageInput.value = ''; // تفريغ حقل الإدخال
        }
    }


    function loadMessages() {
        const chatBox = document.getElementById('chatMessages');
        chatBox.innerHTML = '';

        database.ref(`chats/${userId}/${currentChatDriverId}/messages`).on('child_added', (snapshot) => {
            const message = snapshot.val();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.innerHTML = `
            <div class="message-bubble ${message.sender === userId ? 'sent' : 'received'}">
                <p>${message.text}</p>
                <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
        `;
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }


    // استدعاء نافذة المحادثة مع تحديث اسم وصورة السائق
    // استدعاء نافذة المحادثة مع تحديث اسم وصورة السائق
    function openChatWindow(driverId) {
        console.log('Opening chat for driver:', driverId); // للتأكد من وصول معرف السائق
        currentChatDriverId = driverId;
        showLoading();

        database.ref(`drivers/${driverId}`).once('value')
            .then(snapshot => {
                const driverData = snapshot.val();
                console.log('Driver Data:', driverData); // للتأكد من البيانات المستلمة

                if (driverData) {
                    // الوصول المباشر إلى الصورة من البيانات الرئيسية
                    const imageUrl = driverData.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527';
                    // الوصول إلى الاسم من coordinates
                    const name = driverData?.name || 'اسم غير متوفر';
                    // معلومات السيارة من البيانات الرئيسية
                    const carInfo = `${driverData.carType || ''} - ${driverData.carModel || ''}`;

                    // تحديث واجهة المستخدم
                    const chatModal = document.getElementById('chatModal');
                    if (chatModal) {
                        const driverImageElement = chatModal.querySelector('#driverImage');
                        const driverNameElement = chatModal.querySelector('#driverName');
                        const driverCardInfoElement = chatModal.querySelector('#driverCardInfo');

                        if (driverImageElement) {
                            driverImageElement.src = imageUrl;
                            console.log('Setting image URL:', imageUrl); // للتأكد من الرابط
                        }
                        if (driverNameElement) driverNameElement.textContent = name;
                        if (driverCardInfoElement) driverCardInfoElement.textContent = carInfo;

                        // إعادة تعيين حالة المحادثة
                        const tripSelection = chatModal.querySelector('#tripSelection');
                        const chatFooter = chatModal.querySelector('.chat-footer');
                        const chatMessages = chatModal.querySelector('#chatMessages');

                        if (tripSelection) tripSelection.classList.remove('d-none');
                        if (chatFooter) chatFooter.classList.add('d-none');
                        if (chatMessages) {
                            chatMessages.classList.add('d-none');
                            chatMessages.innerHTML = '';
                        }

                        // إظهار النافذة المنبثقة
                        const modalInstance = new bootstrap.Modal(chatModal);
                        modalInstance.show();
                    }
                } else {
                    showToast('لم يتم العثور على بيانات السائق', 'error');
                }
            })
            .catch(error => {
                console.error('Error fetching driver data:', error);
                showToast('حدث خطأ في تحميل بيانات السائق', 'error');
            })
            .finally(() => {
                hideLoading();
            });
    }

    function createDriverCard(driver, driverId) {
        return `
        <div class="driver-card">
            <div class="driver-image-container">
                <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" class="driver-image">
            </div>
            <div class="driver-info">
                <h3 class="driver-name">${driver.name || 'اسم غير متوفر'}</h3>
                <button class="btn btn-primary" onclick="openChatWindow('${driverId}')">فتح المحادثة</button>
            </div>
        </div>
    `;
    }




    function viewDriverLocation(driverId) {
        isViewingDriverLocation = true; // تعطيل تحديث موقع المستخدم

        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();
            if (driver && driver.coordinates) {
                const { lat, lng } = driver.coordinates;

                // تعيين موقع الخريطة إلى موقع السائق
                map.setView([lat, lng], 15);

                // إضافة علامة موقع السائق
                const driverMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        html: `<i class="fas fa-taxi" style="color: #FFD700;"></i>`,
                        className: 'driver-marker',
                        iconSize: [30, 30],
                    }),
                }).addTo(markerLayer);

                driverMarker.bindPopup(`
                <div style="text-align: center;">
                    <h6>${driver.name}</h6>
                    <p>${driver.carType} - ${driver.carModel}</p>
                    <button class="action-btn secondary" onclick="openChatWindow('${key}')">
    <i class="fas fa-comment"></i> مراسلة
</button>


                </div>
            `).openPopup();

                scrollToMap();
            } else {
                showToast('لم يتم إضافة موقع للسائق', 'error');
            }
        });

        // إعادة تفعيل تحديث موقع المستخدم بعد فترة
        setTimeout(() => {
            isViewingDriverLocation = false;
        }, 30000); // 30 ثانية
    }
    function viewDriverLocation(driverId) {
        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();
            if (driver && driver.coordinates) {
                const { lat, lng } = driver.coordinates;
                map.flyTo([lat, lng], 15, {
                    animate: true,
                    duration: 1.5
                });

                markerLayer.clearLayers();

                const driverMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        html: `
                        <div style="position: relative; text-align: center;">
                            <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" 
                                 alt="صورة السائق" 
                                 style="width: 50px; height: 50px; border: 3px solid #FFD700; 
                                 border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                            <i class="fas fa-taxi" 
                               style="position: absolute; bottom: -5px; right: 50%; transform: translateX(50%); 
                               color: #FFD700; font-size: 1.5rem;"></i>
                        </div>
                    `,
                        className: 'driver-marker',
                        iconSize: [60, 60],
                    }),
                }).addTo(markerLayer);

                const popupContent = `
                <div style="text-align: center; font-family: 'Segoe UI', sans-serif; min-width: 200px; background: #000000; border-radius: 10px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <div class="driver-popup-header" style="margin-bottom: 10px;">
                        <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" 
                             alt="صورة السائق" 
                             style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #FFD700; 
                             margin-bottom: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        <h5 style="color: #FFFFFF; font-weight: bold; margin: 8px 0;">${driver.name}</h5>
                    </div>
                    
                    <div class="driver-popup-stats" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 15px;">
                        <div style="text-align: center;">
                            <div style="font-weight: bold; color: #FFD700;">
                                <i class="fas fa-star"></i> ${driver.rating ? driver.rating.toFixed(1) : '5.0'}
                            </div>
                            <div style="font-size: 0.8rem; color: #FFFFFF;">التقييم</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: bold; color: #FFD700;">
                                <i class="fas fa-route"></i> ${driver.trips || 0}
                            </div>
                            <div style="font-size: 0.8rem; color: #FFFFFF;">الرحلات</div>
                        </div>
                    </div>
                    
                    <div class="driver-popup-info" style="margin-bottom: 15px; text-align: right; color: #FFFFFF;">
                        <p style="margin: 5px 0;">
                            <i class="fas fa-car" style="color: #FFD700; margin-left: 5px;"></i>
                            ${driver.carType} - ${driver.carModel}
                        </p>
                        <p style="margin: 5px 0;">
                            <i class="fas fa-map-marker-alt" style="color: #FFD700; margin-left: 5px;"></i>
                            ${driver.location}
                        </p>
                        <p style="margin: 5px 0;">
                            <i class="fas fa-phone" style="color: #FFD700; margin-left: 5px;"></i>
                            ${driver.phone}
                        </p>
                    </div>
            
                    <div class="driver-popup-actions" style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                        <button onclick="openChatWindow('${driverId}')" 
                                style="background: #FFD700; color: #333; border: none; padding: 8px 15px; 
                                border-radius: 20px; cursor: pointer; font-weight: bold; 
                                display: flex; align-items: center; justify-content: center; gap: 5px;
                                transition: all 0.3s ease;">
                            <i class="fas fa-comment"></i>
                            مراسلة السائق
                        </button>
                    </div>
                </div>
            `;


                driverMarker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-popup'
                }).openPopup();

                scrollToMap();

                Swal.fire({
                    title: '🚖 تم تحديد موقع السائق!',
                    html: `
                    <p style="font-size: 1rem; color: #555;">
                        السائق <b>${driver.name}</b> بانتظارك.
                    </p>
                    <p style="color: #666;">هل ترغب بمراسلته الآن؟</p>
                `,
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonColor: '#FFD700',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: '📨 نعم، مراسلة السائق',
                    cancelButtonText: '❌ إغلاق',
                }).then((result) => {
                    if (result.isConfirmed) {
                        openChatWindow(driverId);
                    }
                });
            } else {
                showToast('لم يتم العثور على موقع السائق.', 'error');
            }
        });
    }


    function initMap() {
        // الإحداثيات الافتراضية
        const defaultLocation = [33.3152, 44.3661];

        // إنشاء الخريطة مع خيارات التخصيص
        map = L.map('map', {
            center: defaultLocation,
            zoom: 8,
            zoomControl: false, // إخفاء التحكم الافتراضي بالتكبير/التصغير
            attributionControl: false, // إخفاء شريط النسب
        });
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);
        // إضافة زر تكبير/تصغير مخصص
        L.control.zoom({
            position: 'topright',
        }).addTo(map);

        // إضافة زر شريط النسبة المخصص
        L.control.attribution({
            position: 'bottomleft',
            prefix: '<a href="https://leafletjs.com" target="_blank">Leaflet</a>',
        }).addTo(map);

        // إضافة طبقة علامات مخصصة
        markerLayer = L.layerGroup().addTo(map);

        // تمكين الموقع الجغرافي
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                updateUserLocation,
                handleLocationError,
                { enableHighAccuracy: true }
            );
        }

        // إضافة أزرار التبديل بين الطبقات
        const layersControl = {
            "خريطة الشوارع": tileLayer,
            "خريطة القمر الصناعي": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google',
            }),
        };

        L.control.layers(layersControl).addTo(map);
    }

    function updateUserLocation(position) {
        const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
        };

        // تحقق إذا تغير الموقع بما يكفي لتحديث الخريطة
        if (!userLocation || Math.abs(newLocation.lat - userLocation.lat) > 0.0001 || Math.abs(newLocation.lng - userLocation.lng) > 0.0001) {
            userLocation = newLocation;

            // تحديث علامة المستخدم فقط إذا تغير الموقع
            const userIcon = L.divIcon({
                html: '<i class="fas fa-user-circle fa-5x" style="color: #007bff;"></i>',
                className: 'user-marker',
                iconSize: [30, 30],
            });

            if (!userMarker) {
                userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                    .bindPopup('موقعك الحالي')
                    .addTo(map);
            } else {
                userMarker.setLatLng([userLocation.lat, userLocation.lng]);
            }

            // تحديث الخريطة مرة واحدة فقط
            map.setView([userLocation.lat, userLocation.lng], 13);

            // تحميل السائقين إذا كان الموقع جديدًا
            loadDrivers();
        }
    }


    // قاموس يحتوي على إحداثيات المحافظات والمناطق العراقية
    const locationCoordinates = {
        "بغداد": { lat: 33.3152, lng: 44.3661 },
        "الكرخ": { lat: 33.3024, lng: 44.3937 },
        "الرصافة": { lat: 33.3319, lng: 44.4445 },
        "البصرة": { lat: 30.5085, lng: 47.7804 },
        "نينوى": { lat: 36.3359, lng: 43.1194 },
        "الموصل": { lat: 36.3359, lng: 43.1194 },
        "النجف": { lat: 31.9892, lng: 44.3405 },
        "الكوفة": { lat: 32.0343, lng: 44.4019 },
        "كربلاء": { lat: 32.6101, lng: 44.0241 },
        "الحسينية": { lat: 32.6239, lng: 44.0179 },
        "أربيل": { lat: 36.1901, lng: 44.0091 },
        "كركوك": { lat: 35.4681, lng: 44.3923 },
        "الأنبار": { lat: 33.3784, lng: 43.1441 },
        "الرمادي": { lat: 33.4250, lng: 43.3001 },
        "الفلوجة": { lat: 33.3538, lng: 43.7789 },
        "بابل": { lat: 32.4680, lng: 44.4491 },
        "الحلة": { lat: 32.4689, lng: 44.4217 },
        "المسيب": { lat: 32.8471, lng: 44.2907 },
        "الهاشمية": { lat: 32.2482, lng: 44.6027 },
        "القاسم": { lat: 32.2973, lng: 44.5907 },
        "ديالى": { lat: 33.7752, lng: 44.6451 },
        "بعقوبة": { lat: 33.7474, lng: 44.6537 },
        "ذي قار": { lat: 31.0529, lng: 46.2590 },
        "الناصرية": { lat: 31.0529, lng: 46.2590 },
        "السليمانية": { lat: 35.5556, lng: 45.4350 },
        "صلاح الدين": { lat: 34.6108, lng: 43.6782 },
        "تكريت": { lat: 34.6707, lng: 43.6789 },
        "واسط": { lat: 32.5141, lng: 45.8206 },
        "الكوت": { lat: 32.5141, lng: 45.8206 },
        "ميسان": { lat: 31.8389, lng: 47.1451 },
        "العمارة": { lat: 31.8389, lng: 47.1451 },
        "المثنى": { lat: 31.3289, lng: 45.2792 },
        "السماوة": { lat: 31.3199, lng: 45.2847 },
        "دهوك": { lat: 36.8695, lng: 42.9505 },
        "القادسية": { lat: 31.9889, lng: 44.9252 },
        "الديوانية": { lat: 31.9889, lng: 44.9252 }
    };

    function getCoordinatesForLocation(location) {
        // تحقق من وجود الموقع في القاموس
        if (locationCoordinates[location]) {
            return locationCoordinates[location];
        }

        // إذا لم يتم العثور على الموقع، نرجع إحداثيات بغداد كقيمة افتراضية
        console.warn(`لم يتم العثور على إحداثيات لـ ${location}، سيتم استخدام إحداثيات بغداد`);
        return locationCoordinates["بغداد"];
    }

    // مثال على الاستخدام في دالة إضافة السائق
  async function handleAddDriver(event) {
    event.preventDefault();
    showLoading();

    try {
        const imageFile = document.getElementById('driverImage').files[0];
        if (!imageFile) {
            throw new Error('الرجاء اختيار صورة للسائق');
        }

        // الحصول على الإحداثيات مباشرة من حقول الإدخال
        const latitude = parseFloat(document.getElementById('driverLatitude').value);
        const longitude = parseFloat(document.getElementById('driverLongitude').value);
        
        // التحقق من وجود الإحداثيات
        if (!latitude || !longitude) {
            throw new Error('يرجى تحديد موقع السائق أولاً');
        }

        const imageRef = storage.ref(`drivers/${Date.now()}_${imageFile.name}`);
        const uploadTask = await imageRef.put(imageFile);
        const imageUrl = await uploadTask.ref.getDownloadURL();

        const driverData = {
            name: document.getElementById('driverName').value,
            phone: document.getElementById('driverPhone').value,
            carType: document.getElementById('carType').value,
            carModel: document.getElementById('carModel').value,
            location: document.getElementById('driverLocation').value, // المحافظة فقط
            coordinates: {
                lat: latitude,
                lng: longitude
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: imageUrl,
            rating: 5,
            trips: 0,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await database.ref('drivers').push(driverData);

        // إغلاق النافذة المنبثقة بعد النجاح
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        modal.hide();

        document.getElementById('addDriverForm').reset();
        showToast('تم إضافة السائق بنجاح');
        loadDrivers();
    } catch (error) {
        console.error('Error adding driver:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

    function handleLocationError(error) {
        // التعامل مع خطأ في الموقع الجغرافي
        console.error('خطأ في تحديد الموقع:', error);
        showToast('تعذر الوصول إلى موقعك الحالي. الرجاء التحقق من إعدادات الموقع.', 'error');
    }


    function createDriverCard(driver, key) {
        const distance = userLocation ? calculateDistance(userLocation, driver.coordinates) : null;

        return `
            <div class="driver-card animate__animated animate__fadeIn" style="background-color: #000000; color: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5); overflow: hidden;">
                <div class="driver-image-container" style="position: relative;">
                    <img src="${driver.imageUrl}" alt="${driver.name}" class="driver-image" style="width: 100%; height: 200px; object-fit: cover; border-bottom: 3px solid #FFD700;">
                    <div class="driver-status ${driver.active ? 'status-active' : 'status-inactive'}" 
                         onclick="toggleDriverStatus('${key}', ${driver.active})"
                         style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; border-radius: 20px; background: rgba(255, 255, 255, 0.8); font-weight: bold; color: ${driver.active ? '#2ECC40' : '#FF4136'};">
                        ${driver.active ? 'متاح' : 'مشغول'}
                    </div>
                </div>
                <div class="driver-info" style="padding: 15px;">
                    <h5 class="driver-name" style="font-size: 1.2rem; font-weight: bold; margin-bottom: 10px; color: #FFD700;">${driver.name}</h5>
                    <div class="driver-stats" style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <div class="stat-item" style="text-align: center;">
                            <div class="stat-value" style="font-weight: bold; color: #FFD700;">
                                <i class="fas fa-star"></i> ${driver.rating.toFixed(1)}
                            </div>
                            <div class="stat-label" style="font-size: 0.8rem; color: #FFFFFF;">التقييم</div>
                        </div>
                        <div class="stat-item" style="text-align: center;">
                            <div class="stat-value" style="font-weight: bold; color: #FFFFFF;">
                                <i class="fas fa-route"></i> ${driver.trips}
                            </div>
                            <div class="stat-label" style="font-size: 0.8rem; color: #FFFFFF;">الرحلات</div>
                        </div>
                        <div class="stat-item" style="text-align: center;">
                            <div class="stat-value" style="font-weight: bold; color: #FFFFFF;">
                                ${distance ? distance.toFixed(1) : '--'}
                            </div>
                            <div class="stat-label" style="font-size: 0.8rem; color: #FFFFFF;">كم</div>
                        </div>
                    </div>
                    <div class="text-muted" style="color: #FFFFFF; margin-bottom: 15px;">
                        <p class="mb-2">
                            <i class="fas fa-car me-2" style="color: #FFD700;"></i>
                            ${driver.carType} ${driver.carModel}
                        </p>
                        <p class="mb-0">
                            <i class="fas fa-map-marker-alt me-2" style="color: #FFD700;"></i>
                            ${driver.location}
                        </p>
                    </div>
                </div>
                <div class="driver-actions" style="display: flex; justify-content: space-between; padding: 10px;">
                    <button class="action-btn primary" onclick="bookDriver('${key}')" 
                            style="background: #FFD700; color: #333; padding: 10px 20px; border-radius: 20px; border: none; cursor: pointer; font-weight: bold; transition: all 0.3s;">
                        <i class="fas fa-taxi"></i> حجز
                    </button>
                    <button class="action-btn secondary" onclick="openChatWindow('${key}')" 
                            style="background: #333; color: #FFD700; padding: 10px 20px; border-radius: 20px; border: 1px solid #FFD700; cursor: pointer; font-weight: bold; transition: all 0.3s;">
                        <i class="fas fa-comment"></i> مراسلة
                    </button>
                </div>
            </div>
        `;
    }


    function bookDriver(driverId) {
        showLoading();
        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();
            if (driver && driver.active) {
                setTimeout(() => {
                    hideLoading();
                    database.ref(`drivers/${driverId}`).update({
                        active: false // تعيين الحالة إلى "مشغول"
                    }).then(() => {
                        showToast(`تم إرسال طلب الحجز إلى ${driver.name}`);
                        window.location.href = `tel:${driver.phone}`;
                        loadDrivers(); // تحديث حالة السائقين في الواجهة
                    });
                }, 1500);
            } else {
                hideLoading();
                showToast('السائق غير متاح حالياً', 'error');
            }
        });
    }









    function scrollToMap() {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }




    function updateRequiredTrips(driverId, count) {
        const tripCount = parseInt(count, 10);
        if (isNaN(tripCount) || tripCount < 0) {
            showToast('الرجاء إدخال عدد صحيح للمشاوير', 'error');
            return;
        }

        database.ref(`drivers/${driverId}`).update({
            requiredTrips: tripCount
        }).then(() => {
            showToast('تم تحديث عدد المشاوير بنجاح');
        }).catch((error) => {
            console.error('Error updating required trips:', error);
            showToast('حدث خطأ أثناء تحديث عدد المشاوير', 'error');
        });
    }


    function setTripCount(driverId) {
        const modal = new bootstrap.Modal(document.getElementById('tripCountModal'));
        modal.show();

        document.getElementById('tripCountForm').onsubmit = async (event) => {
            event.preventDefault();
            const tripCount = document.getElementById('tripCount').value;

            try {
                await database.ref(`drivers/${driverId}`).update({
                    tripsRequired: parseInt(tripCount)
                });
                showToast('تم تحديث عدد المشاوير بنجاح');
                modal.hide();
            } catch (error) {
                console.error('Error updating trip count:', error);
                showToast('حدث خطأ أثناء تحديث عدد المشاوير', 'error');
            }
        };
    }


    function calculateDistance(point1, point2) {
        // التحقق من صحة النقاط
        if (!point1 || !point2 || !point1.lat || !point1.lng || !point2.lat || !point2.lng) {
            return null;
        }

        const R = 6371;
        const dLat = toRad(point2.lat - point1.lat);
        const dLon = toRad(point2.lng - point1.lng);
        const lat1 = toRad(point1.lat);
        const lat2 = toRad(point2.lat);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function loadDrivers(location = 'all') {
        if (isLoadingDrivers) return;
        isLoadingDrivers = true;

        showLoading();
        const driversRef = database.ref('drivers');

        driversRef.once('value')
            .then((snapshot) => {
                const driversGrid = document.getElementById('driversGrid');
                driversGrid.innerHTML = '';
                markerLayer.clearLayers();

                snapshot.forEach((childSnapshot) => {
                    const driver = childSnapshot.val();
                    if (location === 'all' || driver.location === location) {
                        driversGrid.innerHTML += createDriverCard(driver, childSnapshot.key);

                        if (driver.coordinates) {
                            const { lat, lng } = driver.coordinates;

                            // إنشاء العلامة بمعلومات السائق
                            const driverMarker = L.marker([lat, lng], {
                                icon: L.divIcon({
                                    html: `<img src="${driver.imageUrl}" 
                                              alt="صورة السائق" 
                                              style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid #FFD700;">`,
                                    className: 'driver-marker',
                                    iconSize: [40, 40],
                                }),
                            }).addTo(markerLayer);

                            // تحديث النافذة المنبثقة
                            driverMarker.bindPopup(`
                            <div style="text-align: center;">
                                <div style="margin-bottom: 10px;">
                                    <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" 
                                         alt="صورة السائق" 
                                         style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid #FFD700; margin-bottom: 10px;">
                                    <h6 style="margin: 5px 0; font-weight: bold;">${driver.name}</h6>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
                                    <div>
                                        <i class="fas fa-star" style="color: #FFD700;"></i>
                                        ${driver.rating ? driver.rating.toFixed(1) : '5.0'}
                                    </div>
                                    <div>
                                        <i class="fas fa-route"></i>
                                        ${driver.trips || 0}
                                    </div>
                                </div>

                                <div style="margin-bottom: 10px;">
                                    <p style="margin: 5px 0;">🚗 ${driver.carType} - ${driver.carModel}</p>
                                    <p style="margin: 5px 0;">📍 ${driver.location}</p>
                                </div>

                                <button onclick="openChatWindow('${childSnapshot.key}')" 
                                        style="background: #FFD700; color: #333; border: none; 
                                               padding: 8px 15px; border-radius: 20px; width: 100%;
                                               cursor: pointer; display: flex; align-items: center; 
                                               justify-content: center; gap: 5px; font-weight: bold;">
                                    <i class="fas fa-comment"></i>
                                    مراسلة السائق
                                </button>
                            </div>
                        `, {
                                maxWidth: 250
                            });
                        }
                    }
                });

                hideLoading();
            })
            .catch((error) => {
                console.error('Error loading drivers:', error);
                showToast('حدث خطأ في تحميل بيانات السائقين', 'error');
            })
            .finally(() => {
                isLoadingDrivers = false;
            });
    }

    // تحديث دالة إنشاء بطاقة السائق
    // دالة إنشاء بطاقة السائق المحدثة
    function createDriverCard(driver, key) {
    const distance = userLocation && driver.coordinates ?
        calculateDistance(userLocation, driver.coordinates) : null;
    
    return `
        <div class="driver-card animate__animated animate__fadeIn" data-driver-id="${key}">
            <!-- قسم أزرار الإجراءات العلوية -->
            <div class="driver-card-actions">
                <button class="action-icon delete-btn" onclick="confirmDeleteDriver('${key}')" title="حذف السائق">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button class="action-icon edit-btn" onclick="showEditDriverModal('${key}')" title="تعديل البيانات">
                    <i class="fas fa-edit"></i>
                </button>
                <!-- إضافة أزرار التتبع -->
                <button class="action-icon track-btn" onclick="startDriverLocationTracking('${key}')" title="تفعيل تتبع الموقع">
                    <i class="fas fa-location-arrow"></i>
                </button>
                <button class="action-icon stop-track-btn" onclick="stopDriverLocationTracking()" title="إيقاف التتبع">
                    <i class="fas fa-stop-circle"></i>
                </button>
            </div>

            <!-- صورة السائق والحالة -->
            <div class="driver-image-container">
                <img src="${driver.imageUrl}" alt="${driver.name}" class="driver-image">
                <div class="driver-status ${driver.active ? 'status-active' : 'status-inactive'}">
                    ${driver.active ? 'متاح' : 'مشغول'}
                </div>
                <!-- مؤشر التتبع -->
                <div class="tracking-indicator" id="tracking-${key}">
                    <i class="fas fa-satellite-dish fa-pulse"></i>
                </div>
            </div>

            <!-- معلومات السائق -->
            <div class="driver-info">
                <h5 class="driver-name">${driver.name}</h5>
                <div class="driver-stats">
                    <div class="stat-item" onclick="addRating('${key}')" style="cursor: pointer">
                        <div class="stat-value">
                            <i class="fas fa-star" style="color: #FFD700;"></i>
                            ${driver.rating ? driver.rating.toFixed(1) : '5.0'}
                        </div>
                        <div class="stat-label">اضغط للتقييم</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">
                            <i class="fas fa-route"></i>
                            ${driver.trips || 0}
                        </div>
                        <div class="stat-label">عدد الرحلات</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">
                            ${distance ? distance.toFixed(1) : '--'}
                        </div>
                        <div class="stat-label">كم</div>
                    </div>
                </div>
                
                <div class="text-muted">
                    <p class="mb-2">
                        <i class="fas fa-car me-2"></i>
                        ${driver.carType} ${driver.carModel}
                    </p>
                    <p class="mb-0">
                        <i class="fas fa-map-marker-alt me-2"></i>
                        ${driver.location}
                    </p>
                </div>
            </div>

            <!-- أزرار الإجراءات السفلية -->
            <div class="driver-actions">
                <button class="action-btn primary" onclick="viewDriverLocation('${key}')">
                    <i class="fas fa-map-marker-alt"></i>
                    عرض الموقع
                </button>
                <button class="action-btn secondary" onclick="openChatWindow('${key}')">
                    <i class="fas fa-comment"></i> 
                    مراسلة
                </button>
            </div>
        </div>
    `;
}
function startDriverLocationTracking(driverId) {
    // ... الكود السابق ...

    // تحديث حالة التتبع في البطاقة
    const driverCard = document.querySelector(`[data-driver-id="${driverId}"]`);
    if (driverCard) {
        driverCard.setAttribute('data-tracking', 'true');
        const indicator = driverCard.querySelector('.tracking-indicator');
        if (indicator) {
            indicator.classList.add('active');
        }
    }

    showToast('تم تفعيل تتبع الموقع بنجاح', 'success');
}

function stopDriverLocationTracking() {
    // ... الكود السابق ...

    // إزالة حالة التتبع من جميع البطاقات
    document.querySelectorAll('.driver-card').forEach(card => {
        card.setAttribute('data-tracking', 'false');
        const indicator = card.querySelector('.tracking-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    });
}



    // دالة تأكيد الحذف مع نافذة تأكيد محسنة
    function confirmDeleteDriver(driverId) {
        // استخدام نافذة تأكيد محسنة
        Swal.fire({
            title: 'تأكيد الحذف',
            text: 'هل أنت متأكد من حذف هذا السائق؟',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteDriver(driverId); // استدعاء دالة الحذف إذا وافق المستخدم
            }
        });
    }

    // دالة حذف السائق
    async function deleteDriver(driverId) {
        try {
            // عرض مؤشر التحميل
            showLoading();

            // الوصول إلى مرجع بيانات السائق
            const driverRef = database.ref(`drivers/${driverId}`);
            const snapshot = await driverRef.once('value');
            const driverData = snapshot.val();

            if (!driverData) {
                // إذا لم يتم العثور على بيانات السائق
                showToast('لم يتم العثور على السائق', 'error');
                return;
            }

            // حذف الصورة من التخزين إذا كانت موجودة
            if (driverData.imageUrl) {
                try {
                    const imageRef = storage.refFromURL(driverData.imageUrl);
                    await imageRef.delete();
                } catch (error) {
                    console.error('Error deleting image:', error);
                    showToast('حدث خطأ أثناء حذف صورة السائق', 'error');
                }
            }

            // حذف بيانات السائق من قاعدة البيانات
            await driverRef.remove();

            // إزالة بطاقة السائق من الواجهة
            const card = document.querySelector(`[data-driver-id="${driverId}"]`);
            if (card) {
                // إضافة تأثير حذف قبل الإزالة
                card.classList.add('animate__fadeOut');
                setTimeout(() => card.remove(), 300);
            }

            // عرض رسالة نجاح
            showToast('تم حذف السائق بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting driver:', error);
            showToast('حدث خطأ أثناء حذف السائق', 'error');
        } finally {
            // إخفاء مؤشر التحميل
            hideLoading();
        }
    }


    // دالة إظهار نافذة التعديل
    function showEditDriverModal(driverId) {
        database.ref(`drivers/${driverId}`).once('value')
            .then(snapshot => {
                const driver = snapshot.val();
                if (driver) {
                    document.getElementById('editDriverId').value = driverId;
                    document.getElementById('editDriverName').value = driver.name;
                    document.getElementById('editDriverPhone').value = driver.phone;
                    document.getElementById('editCarType').value = driver.carType;
                    document.getElementById('editCarModel').value = driver.carModel;
                    document.getElementById('editDriverLocation').value = driver.location;

                    if (driver.imageUrl) {
                        document.getElementById('editImagePreview').src = driver.imageUrl;
                        document.getElementById('editImagePreview').style.display = 'block';
                    }

                    const editModal = new bootstrap.Modal(document.getElementById('editDriverModal'));
                    editModal.show();
                }
            })
            .catch(error => {
                console.error('Error fetching driver data:', error);
                showToast('حدث خطأ في تحميل بيانات السائق', 'error');
            });
    }

    // دالة معالجة تعديل البيانات
    async function handleEditDriver(event) {
        event.preventDefault();
        showLoading();

        try {
            const driverId = document.getElementById('editDriverId').value;
            const imageFile = document.getElementById('editDriverImage').files[0];
            let updates = {
                name: document.getElementById('editDriverName').value,
                phone: document.getElementById('editDriverPhone').value,
                carType: document.getElementById('editCarType').value,
                carModel: document.getElementById('editCarModel').value,
                location: document.getElementById('editDriverLocation').value
            };

            if (imageFile) {
                const imageRef = storage.ref(`drivers/${Date.now()}_${imageFile.name}`);
                const uploadTask = await imageRef.put(imageFile);
                updates.imageUrl = await uploadTask.ref.getDownloadURL();
            }

            await database.ref(`drivers/${driverId}`).update(updates);

            const modal = bootstrap.Modal.getInstance(document.getElementById('editDriverModal'));
            modal.hide();

            showToast('تم تحديث بيانات السائق بنجاح');
            loadDrivers();
        } catch (error) {
            console.error('Error updating driver:', error);
            showToast('حدث خطأ أثناء تحديث البيانات', 'error');
        } finally {
            hideLoading();
        }
    }

    // دوال إضافية للحذف والتعديل
    function confirmDeleteDriver(driverId) {
        Swal.fire({
            title: 'تأكيد الحذف',
            text: 'هل أنت متأكد من حذف هذا السائق؟',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteDriver(driverId);
            }
        });
    }

    async function deleteDriver(driverId) {
        try {
            showLoading();

            // حذف بيانات السائق من قاعدة البيانات
            const driverRef = database.ref(`drivers/${driverId}`);
            const driverSnapshot = await driverRef.once('value');
            const driverData = driverSnapshot.val();

            if (driverData && driverData.imageUrl) {
                // حذف الصورة من التخزين
                const imageRef = storage.refFromURL(driverData.imageUrl);
                await imageRef.delete();
            }

            // حذف البيانات
            await driverRef.remove();

            // حذف البطاقة من الواجهة مع تأثير حركي
            const driverCard = document.querySelector(`[data-driver-id="${driverId}"]`);
            if (driverCard) {
                driverCard.classList.add('animate__fadeOut');
                setTimeout(() => driverCard.remove(), 300);
            }

            showToast('تم حذف السائق بنجاح');
        } catch (error) {
            console.error('Error deleting driver:', error);
            showToast('حدث خطأ أثناء حذف السائق', 'error');
        } finally {
            hideLoading();
        }
    }


    function showEditDriverModal(driverId) {
        database.ref(`drivers/${driverId}`).once('value')
            .then(snapshot => {
                const driver = snapshot.val();
                if (driver) {
                    // ملء النموذج ببيانات السائق الحالية
                    document.getElementById('editDriverId').value = driverId;
                    document.getElementById('editDriverName').value = driver.name;
                    document.getElementById('editDriverPhone').value = driver.phone;
                    document.getElementById('editCarType').value = driver.carType;
                    document.getElementById('editCarModel').value = driver.carModel;
                    document.getElementById('editDriverLocation').value = driver.location;
                    document.getElementById('editDriverBio').value = driver.bio || '';

                    if (driver.imageUrl) {
                        document.getElementById('editImagePreview').src = driver.imageUrl;
                        document.getElementById('editImagePreview').style.display = 'block';
                        document.querySelector('#editDriverModal .upload-placeholder').style.display = 'none';
                    }

                    // عرض النافذة المنبثقة
                    const editModal = new bootstrap.Modal(document.getElementById('editDriverModal'));
                    editModal.show();
                }
            })
            .catch(error => {
                console.error('Error fetching driver data:', error);
                showToast('حدث خطأ في تحميل بيانات السائق', 'error');
            });
    }

    async function handleEditDriver(event) {
        event.preventDefault();
        showLoading();

        const driverId = document.getElementById('editDriverId').value;
        const imageFile = document.getElementById('editDriverImage').files[0];

        try {
            let imageUrl;
            if (imageFile) {
                const imageRef = storage.ref(`drivers/${Date.now()}_${imageFile.name}`);
                const uploadTask = await imageRef.put(imageFile);
                imageUrl = await uploadTask.ref.getDownloadURL();
            }

            const updates = {
                name: document.getElementById('editDriverName').value,
                phone: document.getElementById('editDriverPhone').value,
                carType: document.getElementById('editCarType').value,
                carModel: document.getElementById('editCarModel').value,
                location: document.getElementById('editDriverLocation').value,
                bio: document.getElementById('editDriverBio').value
            };

            if (imageUrl) {
                updates.imageUrl = imageUrl;
            }

            await database.ref(`drivers/${driverId}`).update(updates);

            // إغلاق النافذة المنبثقة
            const modal = bootstrap.Modal.getInstance(document.getElementById('editDriverModal'));
            modal.hide();

            showToast('تم تحديث بيانات السائق بنجاح');
            loadDrivers(); // تحديث عرض السائقين
        } catch (error) {
            console.error('Error updating driver:', error);
            showToast('حدث خطأ أثناء تحديث البيانات', 'error');
        } finally {
            hideLoading();
        }
    }

    function handleEditImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = document.getElementById('editImagePreview');
                const placeholder = document.querySelector('#editDriverModal .upload-placeholder');
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    }


    function handleImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = document.getElementById('imagePreview');
                const placeholder = document.querySelector('.upload-placeholder');
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    }
async function handleAddDriver(event) {
    event.preventDefault();
    showLoading();

    try {
        const imageFile = document.getElementById('driverImage').files[0];
        if (!imageFile) {
            throw new Error('الرجاء اختيار صورة للسائق');
        }

        // الحصول على الإحداثيات مباشرة من حقول الإدخال
        const latitude = parseFloat(document.getElementById('driverLatitude').value);
        const longitude = parseFloat(document.getElementById('driverLongitude').value);
        
        // التحقق من وجود الإحداثيات
        if (!latitude || !longitude) {
            throw new Error('يرجى تحديد موقع السائق أولاً');
        }

        const imageRef = storage.ref(`drivers/${Date.now()}_${imageFile.name}`);
        const uploadTask = await imageRef.put(imageFile);
        const imageUrl = await uploadTask.ref.getDownloadURL();

        const driverData = {
            name: document.getElementById('driverName').value,
            phone: document.getElementById('driverPhone').value,
            carType: document.getElementById('carType').value,
            carModel: document.getElementById('carModel').value,
            location: document.getElementById('driverLocation').value, // المحافظة فقط
            coordinates: {
                lat: latitude,
                lng: longitude
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: imageUrl,
            rating: 5,
            trips: 0,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await database.ref('drivers').push(driverData);

        // إغلاق النافذة المنبثقة بعد النجاح
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        modal.hide();

        document.getElementById('addDriverForm').reset();
        showToast('تم إضافة السائق بنجاح');
        loadDrivers();
    } catch (error) {
        console.error('Error adding driver:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

    function bookDriver(driverId) {
        showLoading();
        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();
            if (driver && driver.active) {
                setTimeout(() => {
                    hideLoading();
                    database.ref(`drivers/${driverId}`).update({
                        active: false // تعيين الحالة إلى "مشغول"
                    }).then(() => {
                        showToast(`تم إرسال طلب الحجز إلى ${driver.name}`);
                        window.location.href = `tel:${driver.phone}`;
                        loadDrivers(); // تحديث حالة السائقين في الواجهة
                    });
                }, 1500);
            } else {
                hideLoading();
                showToast('السائق غير متاح حالياً', 'error');
            }
        });
    }


    function messageDriver(driverId) {
        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();
            if (driver) {
                const phoneNumber = driver.phone.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${phoneNumber}`, '_blank');
            }
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `custom-toast animate__animated animate__fadeInRight`;
        toast.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'} me-2"></i>
                <div>${message}</div>
            `;

        document.getElementById('toastContainer').appendChild(toast);

        setTimeout(() => {
            toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    function messageDriver(driverId) {
        database.ref(`drivers/${driverId}`).once('value', (snapshot) => {
            const driver = snapshot.val();

            if (driver) {
                // تحديد السائق الحالي للدردشة
                currentChatDriverId = driverId;

                // فتح نافذة الدردشة
                const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
                document.getElementById('chatMessages').innerHTML = ''; // تفريغ الرسائل السابقة
                loadMessages(); // تحميل الرسائل السابقة بين المستخدم والسائق
                chatModal.show();
            } else {
                showToast('عذراً، لا يمكن العثور على معلومات السائق.', 'error');
            }
        });
    }

    // دالة مساعدة للتحقق من صلاحيات الموقع
    function checkLocationPermission() {
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' })
                .then(permission => {
                    if (permission.state === 'denied') {
                        showToast('يرجى تفعيل خدمة الموقع للحصول على أفضل تجربة.', 'error');
                    }
                });
        }
    }

    // تحديث دالة updateUserLocation لتخزين الموقع الأخير
    function updateUserLocation(position) {
        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        if (!userMarker) {
            const userIcon = L.divIcon({
                html: '<i class="fas fa-user-circle fa-2x" style="color: #007bff;"></i>',
                className: 'user-marker',
                iconSize: [30, 30]
            });

            userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                .bindPopup('موقعك الحالي')
                .addTo(map);
        } else {
            userMarker.setLatLng([userLocation.lat, userLocation.lng]);
        }

        // تحديث مركز الخريطة
        map.setView([userLocation.lat, userLocation.lng], map.getZoom());
    }

    function showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    function showAddDriverModal() {
        const modal = new bootstrap.Modal(document.getElementById('addDriverModal'));
        modal.show();
    }
    window.addEventListener('scroll', function () {
        const filter = document.querySelector('.location-filter');
        if (window.scrollY > 100) {
            filter.classList.add('sticky');
        } else {
            filter.classList.remove('sticky');
        }
    });


    // دالة البحث الرئيسية
    function searchDrivers(searchTerm, searchType = 'all') {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div></div>';

        if (!searchTerm.trim()) {
            resultsContainer.innerHTML = '';
            return;
        }

        const driversRef = database.ref('drivers');
        driversRef.once('value')
            .then((snapshot) => {
                const results = [];
                snapshot.forEach((childSnapshot) => {
                    const driver = childSnapshot.val();
                    const driverId = childSnapshot.key;

                    const searchLower = searchTerm.toLowerCase();
                    let match = false;

                    switch (searchType) {
                        case 'name':
                            match = driver.name.toLowerCase().includes(searchLower);
                            break;
                        case 'location':
                            match = driver.location.toLowerCase().includes(searchLower);
                            break;
                        case 'car':
                            match = driver.carType.toLowerCase().includes(searchLower) ||
                                driver.carModel.toString().includes(searchLower);
                            break;
                        default:
                            match = driver.name.toLowerCase().includes(searchLower) ||
                                driver.location.toLowerCase().includes(searchLower) ||
                                driver.carType.toLowerCase().includes(searchLower) ||
                                driver.carModel.toString().includes(searchLower);
                    }

                    if (match) {
                        results.push({ ...driver, id: driverId });
                    }
                });

                displaySearchResults(results, searchTerm);
            })
            .catch((error) => {
                console.error("Error searching:", error);
                resultsContainer.innerHTML = '<div class="no-results">حدث خطأ في البحث</div>';
            });
    }

    // دالة عرض نتائج البحث
    function displaySearchResults(results, searchTerm) {
        const resultsContainer = document.getElementById('searchResults');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">لا توجد نتائج للبحث</div>';
            return;
        }

        resultsContainer.innerHTML = results.map(driver => `
        <div class="search-result-item" onclick="handleDriverSelect('${driver.id}')">
            <div class="driver-info">
                <img src="${driver.imageUrl}" alt="${driver.name}" class="driver-image">
                <div class="driver-details">
                    <div class="driver-name">${highlightText(driver.name, searchTerm)}</div>
                    <div class="driver-meta">
                        <i class="fas fa-map-marker-alt"></i> 
                        ${highlightText(driver.location, searchTerm)}
                    </div>
                    <div class="driver-meta">
                        <i class="fas fa-car"></i> 
                        ${highlightText(driver.carType, searchTerm)} ${highlightText(driver.carModel.toString(), searchTerm)}
                    </div>
                </div>
                <div class="driver-status ${driver.active ? 'text-success' : 'text-danger'}">
                    <i class="fas fa-circle"></i>
                </div>
            </div>
        </div>
    `).join('');
    }

    // دالة تمييز نص البحث
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    // دالة معالجة اختيار السائق
    function handleDriverSelect(driverId) {
        viewDriverLocation(driverId);
        const modal = bootstrap.Modal.getInstance(document.getElementById('searchModal'));
        modal.hide();
    }

    // إعداد مستمعي الأحداث
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('navbarSearchInput');
        const searchTypeInputs = document.querySelectorAll('input[name="searchType"]');
        let searchTimeout;

        // مستمع حدث البحث
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchType = document.querySelector('input[name="searchType"]:checked').id.replace('search', '').toLowerCase();
                searchDrivers(e.target.value, searchType);
            }, 300);
        });

        // مستمع حدث تغيير نوع البحث
        searchTypeInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (searchInput.value) {
                    const searchType = input.id.replace('search', '').toLowerCase();
                    searchDrivers(searchInput.value, searchType);
                }
            });
        });

        // تنظيف البحث عند إغلاق النافذة المنبثقة
        document.getElementById('searchModal').addEventListener('hidden.bs.modal', () => {
            searchInput.value = '';
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchAll').checked = true;
        });
    });



    function filterDrivers(searchTerm) {
        const driverCards = document.querySelectorAll('.driver-card');
        searchTerm = searchTerm.toLowerCase();

        driverCards.forEach(card => {
            const driverName = card.querySelector('.driver-name').textContent.toLowerCase();
            const driverLocation = card.querySelector('.text-muted').textContent.toLowerCase();

            if (driverName.includes(searchTerm) || driverLocation.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Initialize map if not already initialized
        if (!window.mapInitialized) {
            window.mapInitialized = true;
            initMap();
        }

        // Add click handlers for location chips
        const locationChips = document.querySelectorAll('.location-chip');
        locationChips.forEach((chip) => {
            chip.addEventListener('click', () => {
                locationChips.forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                const location = chip.dataset.location;
                loadDrivers(location);
            });
        });

        // Set initial active state for 'all' chip
        const allChip = document.querySelector('.location-chip[data-location="all"]');
        if (allChip) {
            allChip.classList.add('active');
        }

        // Load all drivers immediately
        loadDrivers('all');

        // Also load drivers when Firebase is ready
        firebase.database().ref().once('value')
            .then(() => {
                loadDrivers('all');
            })
            .catch(error => {
                console.error('Error initializing Firebase:', error);
            });
    });

    const locationChips = document.querySelectorAll('.location-chip');
    locationChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            locationChips.forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            const location = chip.dataset.location;
            loadDrivers(location);
        });
    });

    loadDrivers(); // استدعاء التحميل الأولي للسائقين.


    // قائمة المحافظات والمناطق
    const iraqProvinces = {
        "بغداد": ["الكرخ", "الرصافة", "الأعظمية", "الكاظمية", "المنصور"],
        "البصرة": ["البصرة الجديدة", "الزبير", "أبو الخصيب", "القرنة"],
        "نينوى": ["الموصل", "تلعفر", "الحمدانية", "سنجار"],
        "أربيل": ["عنكاوا", "شقلاوة", "خبات", "سوران"],
        "النجف": ["الكوفة", "المناذرة", "المشخاب"],
        "كربلاء": ["الحسينية", "الهندية", "عين التمر"],
        "كركوك": ["دبس", "الحويجة", "داقوق"],
        "الأنبار": ["الرمادي", "الفلوجة", "هيت", "حديثة"],
        // يمكن إضافة المزيد من المحافظات والمناطق
    };

    // دالة تهيئة النماذج
    function initializeForms() {
        // ملء قائمة المحافظات
        const provinceSelect = document.querySelector('select[name="province"]');
        if (provinceSelect) {
            Object.keys(iraqProvinces).forEach(province => {
                const option = document.createElement('option');
                option.value = province;
                option.textContent = province;
                provinceSelect.appendChild(option);
            });
        }

        // إضافة مستمعي الأحداث للنماذج
        const driverRegistrationForm = document.getElementById('driverRegistrationForm');
        if (driverRegistrationForm) {
            driverRegistrationForm.addEventListener('submit', handleDriverRegistration);
        }
    }

    // دالة تحميل المناطق بناءً على المحافظة المختارة
    function loadAreas(province) {
        const areaSelect = document.querySelector('select[name="area"]');
        areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';

        if (iraqProvinces[province]) {
            iraqProvinces[province].forEach(area => {
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                areaSelect.appendChild(option);
            });
        }
    }

    // دالة معاينة الصورة الشخصية
    function previewDriverPhoto(input) {
        const preview = document.getElementById('driverPhotoPreview');
        const placeholder = input.parentElement.querySelector('.upload-placeholder');

        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    // دالة معاينة المستندات
    function previewDocument(input, previewId) {
        const preview = document.getElementById(previewId);
        const placeholder = input.parentElement.querySelector('.upload-placeholder');

        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    // دالة التحقق من صحة المستندات
    function validateDocuments() {
        const requiredDocuments = ['idFront', 'idBack', 'licenseFront', 'licenseBack'];
        const missingDocs = [];

        for (const docId of requiredDocuments) {
            const input = document.getElementById(docId);
            if (!input || !input.files || !input.files[0]) {
                missingDocs.push(docId);
            }
        }

        if (missingDocs.length > 0) {
            throw new Error(`يرجى رفع المستندات التالية: ${missingDocs.join(', ')}`);
        }

        return true;
    }

    // دالة معالجة تسجيل السائق
    // دالة معالجة تسجيل السائق المحسنة
    async function handleDriverRegistration(event) {
        event.preventDefault();
        showLoading();

        try {
            const formData = new FormData(event.target);
            const fullName = formData.get('fullName')?.trim();

            // التحقق من الاسم
            if (!fullName) {
                throw new Error('يرجى إدخال الاسم الكامل');
            }

            // التحقق من طول الاسم
            if (fullName.length < 2 || fullName.length > 50) {
                throw new Error('يجب أن يكون الاسم بين 2 و 50 حرف');
            }

            // التحقق من رقم الهاتف
            const phone = formData.get('phone')?.trim();
            if (!phone || phone.length < 10) {
                throw new Error('يرجى إدخال رقم هاتف صحيح');
            }

            // التحقق من العمر
            const age = parseInt(formData.get('age'));
            if (!age || age < 18 || age > 70) {
                throw new Error('يجب أن يكون العمر بين 18 و 70 سنة');
            }

            // إنشاء معرف فريد للسائق
            const driverId = `DR${Date.now()}`;

            // إعداد بيانات السائق
            const driverData = {
                id: driverId,
                fullName: fullName,
                age: age,
                phone: phone,
                vehicleType: formData.get('vehicleType')?.trim(),
                vehicleModel: formData.get('vehicleModel')?.trim(),
                vehicleNumber: formData.get('vehicleNumber')?.trim(),
                vehicleColor: formData.get('vehicleColor')?.trim(),
                province: formData.get('province')?.trim(),
                area: formData.get('area')?.trim(),
                address: formData.get('address')?.trim(),
                status: 'pending',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };

            // التحقق من الصورة الشخصية
            const photoFile = document.getElementById('driverPhoto').files[0];
            if (!photoFile) {
                throw new Error('يرجى اختيار صورة شخصية');
            }

            // التحقق من نوع الملف
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!validImageTypes.includes(photoFile.type)) {
                throw new Error('يرجى اختيار صورة بصيغة JPG أو PNG');
            }

            // رفع الصورة الشخصية مع إظهار نسبة التقدم
            try {
                driverData.photoUrl = await uploadFile(photoFile, 'driver-photos');
            } catch (uploadError) {
                throw new Error('فشل في رفع الصورة الشخصية: ' + uploadError.message);
            }

            // رفع المستندات
            const documents = {};
            const requiredDocuments = {
                idFront: 'هوية-امامي',
                idBack: 'هوية-خلفي',
                licenseFront: 'اجازة-امامي',
                licenseBack: 'اجازة-خلفي'
            };

            for (const [inputId, docName] of Object.entries(requiredDocuments)) {
                const file = document.getElementById(inputId).files[0];
                if (!file) {
                    throw new Error(`يرجى رفع ${docName}`);
                }
                if (!validImageTypes.includes(file.type)) {
                    throw new Error(`يرجى رفع ${docName} بصيغة JPG أو PNG`);
                }
                try {
                    documents[docName] = await uploadFile(file, 'driver-documents');
                } catch (uploadError) {
                    throw new Error(`فشل في رفع ${docName}: ${uploadError.message}`);
                }
            }
            driverData.documents = documents;

            // إنشاء الباركود باستخدام رقم الطلب فقط
            let qrCodeUrl;
            try {
                qrCodeUrl = generateDriverQR({ id: driverId });
                await validateQRCode(qrCodeUrl);
                driverData.qrCode = qrCodeUrl;
            } catch (qrError) {
                console.error('QR Code error:', qrError);
                // نستمر في العملية حتى لو فشل إنشاء الباركود
                driverData.qrCode = null;
            }

            // حفظ البيانات في Firebase
            try {
                await database.ref('Drivers').child(driverId).set(driverData);
            } catch (dbError) {
                console.error('Firebase error:', dbError);
                throw new Error('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى');
            }

            // عرض رسالة النجاح
            await showSuccessModal(driverData, qrCodeUrl);

            // إغلاق النافذة وإعادة تعيين النموذج
            const modal = bootstrap.Modal.getInstance(document.getElementById('driverRegistrationModal'));
            if (modal) {
                modal.hide();
                event.target.reset();
                resetPreviews();
            }

        } catch (error) {
            console.error('Registration error:', error);
            Swal.fire({
                title: 'خطأ!',
                text: error.message || 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى',
                icon: 'error',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#d33'
            });
        } finally {
            hideLoading();
        }
    }

    // دالة مساعدة لإظهار نسبة التقدم أثناء رفع الملفات
    function showUploadProgress(progress) {
        const progressBar = document.querySelector('.upload-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${Math.round(progress)}%`;
        }
    }
    async function uploadFile(file, folder) {
        if (!file) {
            throw new Error('لم يتم اختيار ملف');
        }

        // التحقق من حجم الملف (الحد الأقصى 5 ميجابايت)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('حجم الملف كبير جداً، يجب أن لا يتجاوز 5 ميجابايت');
        }

        try {
            // إنشاء اسم ملف آمن
            const safeFileName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileRef = storage.ref(`${folder}/${safeFileName}`);

            // رفع الملف مع إظهار نسبة التقدم
            const uploadTask = fileRef.put(file);

            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log('Upload progress:', progress);
                    },
                    (error) => {
                        console.error('Upload error:', error);
                        reject(new Error('فشل في رفع الملف، يرجى المحاولة مرة أخرى'));
                    },
                    async () => {
                        try {
                            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                            resolve(downloadURL);
                        } catch (error) {
                            reject(new Error('فشل في الحصول على رابط الملف'));
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error in uploadFile:', error);
            throw new Error('فشل في رفع الملف، يرجى المحاولة مرة أخرى');
        }
    }

    // دالة إعادة تعيين معاينات الصور
    function resetPreviews() {
        const previews = document.querySelectorAll('img[id$="Preview"]');
        const placeholders = document.querySelectorAll('.upload-placeholder');

        previews.forEach(preview => {
            preview.src = '#';
            preview.style.display = 'none';
        });

        placeholders.forEach(placeholder => {
            placeholder.style.display = 'flex';
        });
    }

    // دوال فتح نوافذ التسجيل
    function openDriverRegistration() {
        const profileModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
        profileModal.hide();

        const driverModal = new bootstrap.Modal(document.getElementById('driverRegistrationModal'));
        driverModal.show();
    }

    function openUserRegistration() {
        // يمكن إضافة نافذة تسجيل المستخدم هنا
        showToast('سيتم إضافة تسجيل المستخدمين قريباً');
    }

    // تهيئة عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', initializeForms);

    function generateDriverQR(driverData) {
        try {
            // استخدام رقم الطلب فقط لإنشاء الباركود
            const requestId = driverData.id; // مثال: DR1734725935436

            const qrContainer = document.createElement('div');
            new QRCode(qrContainer, {
                text: requestId, // استخدام رقم الطلب فقط
                width: 128,
                height: 128,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L, // مستوى تصحيح منخفض لأن البيانات بسيطة
                quietZone: 10,
                quietZoneColor: "#ffffff"
            });

            const qrImage = qrContainer.querySelector('img');
            if (!qrImage || !qrImage.src) {
                throw new Error('فشل في إنشاء صورة QR');
            }

            return qrImage.src;
        } catch (error) {
            console.error('خطأ في إنشاء QR code:', error);
            throw new Error('فشل في إنشاء رمز QR');
        }
    }

    // تحديث دالة عرض نافذة النجاح
    function showSuccessModal(driverData, qrCodeUrl) {
        Swal.fire({
            title: '<strong>تم تقديم طلبك بنجاح!</strong>',
            html: `
            <div class="success-registration-modal">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="registration-details">
                    <p class="lead">شكراً لك، ${driverData.fullName}</p>
                    <p>تم استلام طلبك وسيتم مراجعته من قبل فريقنا.</p>
                    <p>رقم الطلب: <strong>${driverData.id}</strong></p>
                </div>
                <div class="qr-code-section">
                    <p>الباركود الخاص بطلبك:</p>
                    <img src="${qrCodeUrl}" alt="رمز QR" class="qr-code-image">
                    <button class="download-qr-btn" onclick="downloadQRCode('${qrCodeUrl}', '${driverData.id}')">
                        <i class="fas fa-download"></i>
                        تحميل الباركود
                    </button>
                </div>
                <div class="note-section">
                    <p>* يرجى الاحتفاظ برقم الطلب والباركود للمراجعة</p>
                    <p>* يمكنك استخدام هذا الباركود لتتبع حالة طلبك</p>
                </div>
            </div>
        `,
            icon: 'success',
            confirmButtonText: 'تم',
            confirmButtonColor: '#FFD700',
            allowOutsideClick: false,
            customClass: {
                popup: 'success-registration-popup'
            }
        });
    }

    // دالة للتحقق من صحة الباركود
    function validateQRCode(qrCodeUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => reject(new Error('فشل في إنشاء الباركود'));
            img.src = qrCodeUrl;
        });
    }


    // دالة تحميل الباركود كصورة
    function downloadQRCode(dataUrl, driverId) {
        const link = document.createElement('a');
        link.download = `driver-qr-${driverId}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // دالة عرض نافذة النجاح
    function showSuccessModal(driverData, qrCodeUrl) {
        Swal.fire({
            title: '<strong>تم تقديم طلبك بنجاح!</strong>',
            html: `
            <div class="success-registration-modal">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="registration-details">
                    <p class="lead">شكراً لك، ${driverData.fullName}</p>
                    <p>تم استلام طلبك وسيتم مراجعته من قبل فريقنا.</p>
                    <p>رقم الطلب: <strong>${driverData.id}</strong></p>
                </div>
                <div class="qr-code-section">
                    <p>الباركود الخاص بك:</p>
                    <img src="${qrCodeUrl}" alt="رمز QR" class="qr-code-image">
                    <button class="download-qr-btn" onclick="downloadQRCode('${qrCodeUrl}', '${driverData.id}')">
                        <i class="fas fa-download"></i>
                        تحميل الباركود
                    </button>
                </div>
                <div class="note-section">
                    <p>* يرجى الاحتفاظ برقم الطلب والباركود للمراجعة</p>
                </div>
            </div>
        `,
            icon: 'success',
            confirmButtonText: 'تم',
            confirmButtonColor: '#FFD700',
            allowOutsideClick: false,
            customClass: {
                popup: 'success-registration-popup'
            }
        });
    }

    function generateDriverQR(driverData) {
        // استخدام مكتبة QRCode.js بشكل صحيح
        const qrContainer = document.createElement('div');
        new QRCode(qrContainer, {
            text: JSON.stringify({
                id: driverData.id,
                name: driverData.fullName,
                phone: driverData.phone
            }),
            width: 256,
            height: 256
        });
        return qrContainer.firstChild.toDataURL();
    }
    function submitDriverRegistration() {
        const form = document.getElementById('driverRegistrationForm');

        // التحقق من صحة البيانات أولاً
        if (!validateForm(form)) {
            return;
        }

        // معالجة التسجيل
        processRegistration(new FormData(form));
    }

    async function processRegistration(formData) {
        try {
            // معالجة البيانات على مراحل
            const basicInfo = await saveBasicInfo(formData);
            const documents = await saveDocuments(formData);

            await finalizeRegistration(basicInfo, documents);

            showSuccessMessage();
        } catch (error) {
            showErrorMessage(error);
        }
    }
    function optimizeImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // تقليل حجم الصورة
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.7);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }



    function displayAllDrivers() {
        const drivers = getAllDrivers(); // قم باستدعاء البيانات
        const grid = document.getElementById('driversGrid');
        grid.innerHTML = ''; // تنظيف الشبكة
        drivers.forEach(driver => {
            const card = createDriverCard(driver); // قم بإنشاء البطاقة
            grid.appendChild(card);
        });
    }
    document.addEventListener('DOMContentLoaded', function() {
        // التأكد من تحميل Firebase
        if (typeof firebase !== 'undefined') {
            // تهيئة Firebase
            firebase.initializeApp(firebaseConfig);
            
            // بدء تحميل البيانات
            loadDrivers();
            
            // تهيئة الخريطة
            if (!window.mapInitialized) {
                window.mapInitialized = true;
                initMap();
            }
        } else {
            console.error('Firebase not loaded');
        }
    });




    document.addEventListener('DOMContentLoaded', function () {
        displayAllDrivers(); // استدعاء الدالة التي تعرض جميع السائقين
        document.querySelector('.location-chip[data-location="all"]').classList.add('active'); // تفعيل فلتر "الكل"
    });
    function displayAllDrivers() {
        const drivers = getAllDrivers(); // استدعاء البيانات
        const grid = document.getElementById('driversGrid');
        grid.innerHTML = ''; // تنظيف المحتوى
        drivers.forEach(driver => {
            const card = createDriverCard(driver); // إنشاء بطاقة لكل سائق
            grid.appendChild(card);
        });
    }
    document.querySelectorAll('.location-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.location-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const location = this.getAttribute('data-location');
            if (location === 'all') {
                displayAllDrivers(); // عرض كل السائقين
            } else {
                filterDrivers(location); // تصفية السائقين بناءً على الموقع
            }
        });
    });

    function toggleSideNav() {
        const sideNav = document.getElementById('sideNav');
        const navBackdrop = document.getElementById('navBackdrop');
        const body = document.body;

        // Toggle الشريط الجانبي
        sideNav.classList.toggle('open');
        navBackdrop.classList.toggle('show');
        body.classList.toggle('side-nav-open'); // إضافة/إزالة تعطيل التمرير
    }
    function openUserRegistration() {
        const profileModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
        profileModal.hide();

        const userModal = new bootstrap.Modal(document.getElementById('userRegistrationModal'));
        userModal.show();
    }

    // دالة معاينة الصورة الشخصية
    function previewUserPhoto(input) {
        const preview = document.getElementById('userPhotoPreview');
        const placeholder = input.parentElement.querySelector('.upload-placeholder');

        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    // دالة معالجة تسجيل المستخدم
    async function handleUserRegistration(event) {
        event.preventDefault();
        showLoading();

        try {
            const formData = new FormData(event.target);

            // التحقق من تطابق كلمات المرور
            if (formData.get('password') !== formData.get('confirmPassword')) {
                throw new Error('كلمات المرور غير متطابقة');
            }

            // التحقق من الموافقة على الشروط والأحكام
            if (!formData.get('terms')) {
                throw new Error('يجب الموافقة على الشروط والأحكام');
            }

            // إنشاء معرف فريد للمستخدم
            const userId = `USER${Date.now()}`;

            // رفع الصورة الشخصية
            let photoUrl = null;
            const photoFile = document.getElementById('userPhoto').files[0];
            if (photoFile) {
                const imageRef = storage.ref(`users/${userId}/${Date.now()}_${photoFile.name}`);
                const uploadTask = await imageRef.put(photoFile);
                photoUrl = await uploadTask.ref.getDownloadURL();
            }

            // إعداد بيانات المستخدم
            const userData = {
                id: userId,
                fullName: formData.get('fullName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                province: formData.get('province'),
                area: formData.get('area'),
                address: formData.get('address'),
                photoUrl: photoUrl,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // حفظ البيانات في Firebase
            await database.ref('users').child(userId).set(userData);

            // إغلاق النافذة وإظهار رسالة النجاح
            const modal = bootstrap.Modal.getInstance(document.getElementById('userRegistrationModal'));
            modal.hide();

            Swal.fire({
                title: 'تم التسجيل بنجاح!',
                text: 'مرحباً بك في تطبيق تاكسي العراق',
                icon: 'success',
                confirmButtonColor: '#FFD700',
                confirmButtonText: 'تم'
            });

        } catch (error) {
            console.error('Registration error:', error);
            Swal.fire({
                title: 'خطأ!',
                text: error.message || 'حدث خطأ أثناء التسجيل',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'حسناً'
            });
        } finally {
            hideLoading();
        }
    }

    // إضافة مستمع الحدث لنموذج التسجيل
    document.addEventListener('DOMContentLoaded', function () {
        const userRegistrationForm = document.getElementById('userRegistrationForm');
        if (userRegistrationForm) {
            userRegistrationForm.addEventListener('submit', handleUserRegistration);
        }
    });
//اعدادات التنبيه بن السائق في الجوار

class LocationNotificationSystem {
    constructor() {
        this.database = firebase.database();
        this.NOTIFICATION_DISTANCE = 500; // المسافة بالأمتار التي عندها يتم إرسال الإشعار
        this.notificationSent = new Set(); // لتجنب تكرار الإشعارات
        this.activeWatches = new Map(); // لتتبع مراقبة المواقع النشطة
    }

    // حساب المسافة بين نقطتين
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // نصف قطر الأرض بالأمتار
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // تحديث موقع السائق
    async updateDriverLocation(driverId, latitude, longitude) {
        try {
            const locationUpdate = {
                latitude,
                longitude,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            // تحديث موقع السائق في قاعدة البيانات
            await this.database.ref(`drivers/${driverId}/location`).set(locationUpdate);

            // تحديث موقع السائق على الخريطة إذا كان موجوداً
            if (window.map && window.markerLayer) {
                const driverMarker = window.markerLayer.getLayers().find(
                    layer => layer.options.driverId === driverId
                );

                if (driverMarker) {
                    driverMarker.setLatLng([latitude, longitude]);
                }
            }

            // التحقق من الرحلات النشطة
            this.checkActiveTrips(driverId, { latitude, longitude });
        } catch (error) {
            console.error('Error updating driver location:', error);
            showToast('حدث خطأ في تحديث الموقع', 'error');
        }
    }

    // التحقق من الرحلات النشطة
    async checkActiveTrips(driverId, driverLocation) {
        try {
            const tripsRef = this.database.ref('trips');
            const activeTrips = await tripsRef
                .orderByChild('driverId')
                .equalTo(driverId)
                .once('value');

            activeTrips.forEach(snapshot => {
                const trip = snapshot.val();
                if (trip.status === 'active' && trip.pickupLocation) {
                    const distance = this.calculateDistance(
                        driverLocation.latitude,
                        driverLocation.longitude,
                        trip.pickupLocation.latitude,
                        trip.pickupLocation.longitude
                    );

                    if (distance <= this.NOTIFICATION_DISTANCE && !this.notificationSent.has(trip.id)) {
                        this.sendArrivalNotification(trip.userId, trip.id, driverId);
                        this.notificationSent.add(trip.id);
                    }
                }
            });
        } catch (error) {
            console.error('Error checking active trips:', error);
        }
    }

    // إرسال إشعار الوصول
    async sendArrivalNotification(userId, tripId, driverId) {
        try {
            // الحصول على معلومات السائق
            const driverSnapshot = await this.database.ref(`drivers/${driverId}`).once('value');
            const driver = driverSnapshot.val();

            // الحصول على token المستخدم
            const userTokenSnapshot = await this.database.ref(`users/${userId}/notificationToken`).once('value');
            const userToken = userTokenSnapshot.val();

            if (userToken) {
                const notification = {
                    title: "السائق في انتظارك!",
                    body: `${driver.name} وصل إلى موقعك وهو في انتظارك الآن.`,
                    icon: driver.imageUrl || '/default-driver-icon.png'
                };

                // تحديث حالة الرحلة
                await this.database.ref(`trips/${tripId}`).update({
                    driverArrived: true,
                    arrivalTime: firebase.database.ServerValue.TIMESTAMP
                });

                // إظهار الإشعار في واجهة المستخدم
                this.showInAppNotification(notification);

                // إرسال إشعار عبر FCM إذا كان متاحاً
                if (firebase.messaging && userToken) {
                    try {
                        const message = {
                            token: userToken,
                            notification: notification,
                            data: {
                                tripId: tripId,
                                driverId: driverId,
                                type: 'driver_arrival'
                            }
                        };

                        await firebase.messaging().send(message);
                    } catch (fcmError) {
                        console.error('Error sending FCM notification:', fcmError);
                    }
                }

                // محاولة إرسال إشعار محلي
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(notification.title, {
                        body: notification.body,
                        icon: notification.icon
                    });
                }
            }
        } catch (error) {
            console.error('Error sending arrival notification:', error);
        }
    }

    // إظهار إشعار في واجهة المستخدم
    showInAppNotification(notification) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast animate__animated animate__fadeInRight';
        toast.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-body">${notification.body}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

        document.body.appendChild(toast);

        // تشغيل صوت الإشعار
        const audio = new Audio('/https://github.com/AlQasimMall/Al-Pasha/blob/main/%D8%A7%D9%84%D9%87%D8%A7%D8%AA%D9%81-%D8%A7%D9%84%D8%AB%D8%A7%D8%A8%D8%AA.mp3');
        audio.play().catch(error => console.log('Could not play notification sound:', error));

        // إزالة الإشعار بعد 5 ثواني
        setTimeout(() => {
            toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // بدء تتبع موقع السائق
    startDriverLocationUpdates(driverId) {
        if (!navigator.geolocation) {
            showToast('خدمة تحديد الموقع غير متوفرة في متصفحك', 'error');
            return null;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateDriverLocation(
                    driverId,
                    position.coords.latitude,
                    position.coords.longitude
                );
            },
            (error) => {
                console.error('Geolocation error:', error);
                showToast('حدث خطأ في تحديد موقعك', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        this.activeWatches.set(driverId, watchId);
        return watchId;
    }

    // إيقاف تتبع موقع السائق
    stopDriverLocationUpdates(driverId) {
        const watchId = this.activeWatches.get(driverId);
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            this.activeWatches.delete(driverId);
        }
    }
}

// إنشاء نسخة عامة من نظام الإشعارات
const locationNotificationSystem = new LocationNotificationSystem();

// نظام الإشعارات المحسن
// نظام الإشعارات المحسن
class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.notifications = new Set();
        this.initialize();
    }

    // تهيئة نظام الإشعارات
    initialize() {
        this.checkNotificationSupport()
            .then(() => this.requestPermission())
            .catch(error => {
                console.error('Notification initialization error:', error);
            });
    }

    // إنشاء حاوية الإشعارات
    createContainer() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    // التحقق من دعم الإشعارات
    async checkNotificationSupport() {
        if (!('Notification' in window)) {
            throw new Error('المتصفح لا يدعم الإشعارات');
        }
    }

    // طلب إذن الإشعارات
    async requestPermission() {
        if (Notification.permission === 'default') {
            this.showPermissionDialog();
        } else if (Notification.permission === 'granted') {
            this.show('مرحباً بك!', 'تم تفعيل الإشعارات بنجاح', 'success');
        }
    }

    // عرض نافذة طلب الإذن
    showPermissionDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'permission-dialog';
        dialog.innerHTML = `
            <div class="permission-dialog-icon">
                <i class="fas fa-bell"></i>
            </div>
            <h3 class="permission-dialog-title">تفعيل الإشعارات</h3>
            <p class="permission-dialog-message">
                نود إرسال إشعارات لإبقائك على اطلاع بآخر التحديثات والعروض.
                هل تود تفعيل الإشعارات؟
            </p>
            <div class="permission-dialog-buttons">
                <button class="permission-button allow">نعم، تفعيل الإشعارات</button>
                <button class="permission-button deny">لا، شكراً</button>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.allow').addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.show('تم!', 'تم تفعيل الإشعارات بنجاح', 'success');
            }
            dialog.remove();
        });

        dialog.querySelector('.deny').addEventListener('click', () => {
            dialog.remove();
            this.show('تم الإلغاء', 'يمكنك تفعيل الإشعارات لاحقاً من الإعدادات', 'info');
        });
    }

    // عرض إشعار
    show(title, message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                ${this.getIconForType(type)}
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
            <div class="notification-progress"></div>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.close(notification));

        this.container.appendChild(notification);
        this.notifications.add(notification);

        setTimeout(() => this.close(notification), duration);

        return notification;
    }

    // إغلاق إشعار
    close(notification) {
        if (!this.notifications.has(notification)) return;
        
        notification.style.animation = 'slideOut 0.5s ease forwards';
        
        setTimeout(() => {
            notification.remove();
            this.notifications.delete(notification);
        }, 500);
    }

    // الحصول على أيقونة الإشعار حسب النوع
    getIconForType(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            warning: '<i class="fas fa-exclamation-circle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    }
}

// إنشاء نسخة عامة من نظام الإشعارات
const notificationSystem = new NotificationSystem();

// دالة مختصرة لعرض الإشعارات
function showNotification(title, message, type = 'info') {
    notificationSystem.show(title, message, type);
}

// مثال على الاستخدام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // إشعار ترحيبي
    setTimeout(() => {
        showNotification(
            'مرحباً بك في تاكسي العراق!',
            'نحن سعداء بانضمامك إلينا',
            'info'
        );
    }, 1000);
    
    // التحقق من حالة الاتصال
    if (navigator.onLine) {
        showNotification(
            'متصل بالإنترنت',
            'يمكنك الآن استخدام جميع خدمات التطبيق',
            'success'
        );
    } else {
        showNotification(
            'غير متصل',
            'يرجى التحقق من اتصال الإنترنت',
            'error'
        );
    }
});

// مراقبة حالة الاتصال
window.addEventListener('online', () => {
    showNotification(
        'تم استعادة الاتصال',
        'يمكنك الآن استخدام جميع خدمات التطبيق',
        'success'
    );
});

window.addEventListener('offline', () => {
    showNotification(
        'انقطع الاتصال',
        'يرجى التحقق من اتصال الإنترنت',
        'error'
    );
});
  // إضافة هذا الكود في ملف app.js
class NotificationTester {
    constructor() {
        this.messaging = firebase.messaging();
        this.initialized = false;
    }

    async testNotifications() {
        try {
            // التحقق من دعم الإشعارات
            if (!('Notification' in window)) {
                throw new Error('المتصفح لا يدعم الإشعارات');
            }

            // طلب الإذن
            const permission = await Notification.requestPermission();
            console.log('حالة إذن الإشعارات:', permission);

            if (permission !== 'granted') {
                throw new Error('لم يتم منح إذن الإشعارات');
            }

            // الحصول على التوكن
            const token = await this.messaging.getToken({
                vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc'
            });

            console.log('تم الحصول على التوكن:', token);

            // حفظ التوكن في قاعدة البيانات
            await this.saveTokenToDatabase(token);

            // إرسال إشعار تجريبي
            this.showTestNotification();

            return {
                success: true,
                token: token,
                message: 'تم إعداد الإشعارات بنجاح'
            };

        } catch (error) {
            console.error('خطأ في اختبار الإشعارات:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async saveTokenToDatabase(token) {
        try {
            const userId = localStorage.getItem('userId') || 'anonymous';
            await firebase.database().ref(`fcm_tokens/${userId}`).set({
                token: token,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                device: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }
            });
            console.log('تم حفظ التوكن في قاعدة البيانات');
        } catch (error) {
            console.error('خطأ في حفظ التوكن:', error);
        }
    }

    showTestNotification() {
        const notification = new Notification('اختبار الإشعارات', {
            body: 'هذا إشعار تجريبي للتأكد من عمل النظام',
            icon: '/pngwing.com.png',
            badge: '/pngwing.com.png'
        });

        notification.onclick = () => {
            console.log('تم النقر على الإشعار التجريبي');
            window.focus();
            notification.close();
        };
    }
}
function captureCurrentLocation() {
    // إنشاء وعد لمعالجة تحديد الموقع
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            Swal.fire({
                icon: 'error',
                title: 'خطأ!',
                text: 'متصفحك لا يدعم تحديد الموقع'
            });
            reject('Geolocation not supported');
            return;
        }

        // عرض مؤشر التحميل
        const loadingAlert = Swal.fire({
            title: 'جاري تحديد موقعك...',
            text: 'يرجى الانتظار',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // إغلاق مؤشر التحميل فوراً
                loadingAlert.close();

                // تحديث حقول الإحداثيات
                document.getElementById('driverLatitude').value = position.coords.latitude;
                document.getElementById('driverLongitude').value = position.coords.longitude;

                // عرض رسالة النجاح لفترة قصيرة
                Swal.fire({
                    icon: 'success',
                    title: 'تم!',
                    text: 'تم تحديد موقعك بنجاح',
                    timer: 1500,
                    showConfirmButton: false
                });

                resolve(position);
            },
            (error) => {
                // إغلاق مؤشر التحميل
                loadingAlert.close();

                let errorMessage = 'حدث خطأ في تحديد الموقع';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'تم رفض الوصول إلى الموقع. يرجى السماح للتطبيق باستخدام خدمة الموقع';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'معلومات الموقع غير متوفرة';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'انتهت مهلة طلب الموقع';
                        break;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'خطأ!',
                    text: errorMessage
                });

                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}


// تشغيل الاختبار عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', addTestButton);
// إضافة متغير عالمي لتخزين معرف المراقبة
let locationWatchId = null;

// دالة بدء تتبع موقع السائق
function startDriverLocationTracking(driverId) {
    if (!navigator.geolocation) {
        showToast('متصفحك لا يدعم خدمة تحديد الموقع', 'error');
        return;
    }

    // إيقاف أي تتبع سابق إذا كان موجوداً
    if (locationWatchId) {
        stopDriverLocationTracking();
    }

    // بدء مراقبة الموقع
    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            updateDriverLocation(driverId, position);
        },
        (error) => {
            handleLocationError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );

    // تخزين معرف السائق في localStorage
    localStorage.setItem('activeDriverId', driverId);
    
    showToast('تم تفعيل تتبع الموقع بنجاح', 'success');
}

// دالة إيقاف تتبع موقع السائق
function stopDriverLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        localStorage.removeItem('activeDriverId');
        showToast('تم إيقاف تتبع الموقع', 'info');
    }
}

// دالة تحديث موقع السائق
async function updateDriverLocation(driverId, position) {
    try {
        const locationUpdate = {
            coordinates: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            },
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };

        // تحديث الموقع في قاعدة البيانات
        await database.ref(`drivers/${driverId}`).update(locationUpdate);

        // تحديث موقع السائق على الخريطة
        updateDriverMarkerOnMap(driverId, locationUpdate.coordinates);
    } catch (error) {
        console.error('Error updating driver location:', error);
        showToast('حدث خطأ في تحديث الموقع', 'error');
    }
}

// دالة تحديث موقع السائق على الخريطة
function updateDriverMarkerOnMap(driverId, coordinates) {
    if (!map || !markerLayer) return;

    // البحث عن علامة السائق الحالية
    let driverMarker = markerLayer.getLayers().find(
        layer => layer.options.driverId === driverId
    );

    if (driverMarker) {
        // تحديث موقع العلامة الحالية
        driverMarker.setLatLng([coordinates.lat, coordinates.lng]);
    } else {
        // إنشاء علامة جديدة للسائق
        database.ref(`drivers/${driverId}`).once('value')
            .then(snapshot => {
                const driver = snapshot.val();
                if (driver) {
                    driverMarker = L.marker([coordinates.lat, coordinates.lng], {
                        icon: L.divIcon({
                            html: `
                                <div style="position: relative; text-align: center;">
                                    <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" 
                                         alt="صورة السائق" 
                                         style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid #FFD700;">
                                    <i class="fas fa-taxi" 
                                       style="position: absolute; bottom: -5px; right: 50%; transform: translateX(50%); 
                                       color: #FFD700; font-size: 1.2rem;"></i>
                                </div>
                            `,
                            className: 'driver-marker',
                            iconSize: [40, 40]
                        }),
                        driverId: driverId
                    }).addTo(markerLayer);

                    // إضافة النافذة المنبثقة
                    driverMarker.bindPopup(`
                        <div style="text-align: center;">
                            <h6>${driver.name}</h6>
                            <p>${driver.carType} - ${driver.carModel}</p>
                            <button class="btn btn-sm btn-primary" onclick="openChatWindow('${driverId}')">
                                <i class="fas fa-comment"></i> مراسلة
                            </button>
                        </div>
                    `);
                }
            });
    }
}

// تعديل دالة handleAddDriver لتفعيل التتبع المباشر
async function handleAddDriver(event) {
    event.preventDefault();
    showLoading();

    try {
        const imageFile = document.getElementById('driverImage').files[0];
        if (!imageFile) {
            throw new Error('الرجاء اختيار صورة للسائق');
        }

        const latitude = parseFloat(document.getElementById('driverLatitude').value);
        const longitude = parseFloat(document.getElementById('driverLongitude').value);
        
        if (!latitude || !longitude) {
            throw new Error('يرجى تحديد موقع السائق أولاً');
        }

        const imageRef = storage.ref(`drivers/${Date.now()}_${imageFile.name}`);
        const uploadTask = await imageRef.put(imageFile);
        const imageUrl = await uploadTask.ref.getDownloadURL();

        const driverData = {
            name: document.getElementById('driverName').value,
            phone: document.getElementById('driverPhone').value,
            carType: document.getElementById('carType').value,
            carModel: document.getElementById('carModel').value,
            location: document.getElementById('driverLocation').value,
            coordinates: {
                lat: latitude,
                lng: longitude
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: imageUrl,
            rating: 5,
            trips: 0,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        // إضافة السائق إلى قاعدة البيانات
        const newDriverRef = await database.ref('drivers').push(driverData);
        const driverId = newDriverRef.key;

        // تفعيل تتبع الموقع المباشر
        startDriverLocationTracking(driverId);

        // إغلاق النافذة المنبثقة
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        modal.hide();

        document.getElementById('addDriverForm').reset();
        showToast('تم إضافة السائق وتفعيل تتبع الموقع بنجاح');
        loadDrivers();
    } catch (error) {
        console.error('Error adding driver:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// إضافة استعادة حالة التتبع عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const activeDriverId = localStorage.getItem('activeDriverId');
    if (activeDriverId) {
        startDriverLocationTracking(activeDriverId);
    }
});
