// نظام تتبع موقع السائق
class DriverTracker {
    constructor() {
        this.watchIds = new Map();
        this.database = firebase.database();
    }

    // تحديث موقع السائق
    async updateDriverLocation(driverId, position) {
        try {
            const locationUpdate = {
                coordinates: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                },
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };

            await this.database.ref(`drivers/${driverId}`).update(locationUpdate);
            
            // تحديث الموقع على الخريطة
            if (window.map && window.markerLayer) {
                this.updateDriverMarker(driverId, locationUpdate.coordinates);
            }
        } catch (error) {
            console.error('Error updating location:', error);
            throw error;
        }
    }

    // بدء تتبع السائق
    startTracking(driverId) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        // إيقاف أي تتبع سابق
        this.stopTracking(driverId);

        const watchId = navigator.geolocation.watchPosition(
            (position) => this.updateDriverLocation(driverId, position),
            (error) => this.handleLocationError(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        this.watchIds.set(driverId, watchId);
        localStorage.setItem(`tracking_${driverId}`, 'active');
        
        return watchId;
    }

    // إيقاف تتبع السائق
    stopTracking(driverId) {
        const watchId = this.watchIds.get(driverId);
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            this.watchIds.delete(driverId);
            localStorage.removeItem(`tracking_${driverId}`);
        }
    }

    // تحديث علامة السائق على الخريطة
    updateDriverMarker(driverId, coordinates) {
        const markerLayer = window.markerLayer;
        if (!markerLayer) return;

        let marker = markerLayer.getLayers().find(layer => layer.driverId === driverId);

        if (marker) {
            marker.setLatLng([coordinates.lat, coordinates.lng]);
            this.updateMarkerRotation(marker, coordinates.heading);
        } else {
            this.createNewDriverMarker(driverId, coordinates);
        }
    }

    // إنشاء علامة جديدة للسائق
    async createNewDriverMarker(driverId, coordinates) {
        try {
            const snapshot = await this.database.ref(`drivers/${driverId}`).once('value');
            const driver = snapshot.val();

            if (driver) {
                const icon = L.divIcon({
                    html: `
                        <div class="driver-marker ${driver.active ? 'active' : ''}">
                            <img src="${driver.imageUrl || 'default-avatar.png'}" 
                                 class="driver-photo" 
                                 alt="${driver.name}">
                            <div class="driver-direction"></div>
                        </div>
                    `,
                    className: 'custom-driver-marker',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                const marker = L.marker([coordinates.lat, coordinates.lng], {
                    icon: icon,
                    driverId: driverId
                }).addTo(window.markerLayer);

                marker.bindPopup(this.createDriverPopup(driver));
                this.updateMarkerRotation(marker, coordinates.heading);
            }
        } catch (error) {
            console.error('Error creating marker:', error);
        }
    }

    // تحديث اتجاه علامة السائق
    updateMarkerRotation(marker, heading) {
        if (heading != null) {
            const directionEl = marker.getElement().querySelector('.driver-direction');
            if (directionEl) {
                directionEl.style.transform = `rotate(${heading}deg)`;
            }
        }
    }

    // إنشاء نافذة منبثقة للسائق
    createDriverPopup(driver) {
        return `
            <div class="driver-popup">
                <img src="${driver.imageUrl || 'default-avatar.png'}" 
                     class="driver-popup-photo" 
                     alt="${driver.name}">
                <h3>${driver.name}</h3>
                <p>${driver.carType} - ${driver.carModel}</p>
                <p class="driver-status ${driver.active ? 'active' : 'inactive'}">
                    ${driver.active ? 'متاح' : 'مشغول'}
                </p>
                <button onclick="openChatWindow('${driver.id}')" 
                        class="chat-button">
                    <i class="fas fa-comment"></i> مراسلة
                </button>
            </div>
        `;
    }

    handleLocationError(error) {
        let message = 'خطأ في تحديد الموقع';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'تم رفض الوصول إلى خدمة الموقع';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'معلومات الموقع غير متوفرة';
                break;
            case error.TIMEOUT:
                message = 'انتهت مهلة طلب تحديد الموقع';
                break;
        }
        showToast(message, 'error');
    }
}

// إنشاء نسخة عالمية من نظام التتبع
const driverTracker = new DriverTracker();

// تحديث دالة إضافة السائق
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
                lng: longitude,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: imageUrl,
            rating: 5,
            trips: 0,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };

        // إضافة السائق وبدء التتبع
        const newDriverRef = await database.ref('drivers').push(driverData);
        const driverId = newDriverRef.key;

        // بدء تتبع موقع السائق
        await driverTracker.startTracking(driverId);

        // إغلاق النافذة المنبثقة
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        modal.hide();

        document.getElementById('addDriverForm').reset();
        showToast('تم إضافة السائق وتفعيل التتبع بنجاح');
        loadDrivers();

    } catch (error) {
        console.error('Error adding driver:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// إضافة أنماط CSS للعلامات
const styles = `
    .custom-driver-marker {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .driver-photo {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid #FFD700;
        object-fit: cover;
    }

    .driver-direction {
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 12px solid #FFD700;
        transition: transform 0.3s ease;
    }

    .driver-popup {
        text-align: center;
        padding: 10px;
    }

    .driver-popup-photo {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        margin-bottom: 10px;
        border: 2px solid #FFD700;
    }

    .driver-status {
        padding: 5px 10px;
        border-radius: 15px;
        margin: 5px 0;
        font-size: 0.9em;
    }

    .driver-status.active {
        background: rgba(46, 204, 64, 0.2);
        color: #2ECC40;
    }

    .driver-status.inactive {
        background: rgba(255, 65, 54, 0.2);
        color: #FF4136;
    }

    .chat-button {
        background: #FFD700;
        border: none;
        padding: 5px 15px;
        border-radius: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .chat-button:hover {
        background: #ccac00;
        transform: translateY(-2px);
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// استعادة التتبع عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const activeDrivers = Object.keys(localStorage)
        .filter(key => key.startsWith('tracking_'))
        .map(key => key.replace('tracking_', ''));

    activeDrivers.forEach(driverId => {
        if (localStorage.getItem(`tracking_${driverId}`) === 'active') {
            driverTracker.startTracking(driverId);
        }
    });
});
// نظام تتبع موقع السائق
class DriverTracker {
    constructor() {
        this.watchIds = new Map();
        this.database = firebase.database();
    }

    // تحديث موقع السائق
    async updateDriverLocation(driverId, position) {
        try {
            const locationUpdate = {
                coordinates: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                },
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };

            await this.database.ref(`drivers/${driverId}`).update(locationUpdate);
            
            // تحديث الموقع على الخريطة
            if (window.map && window.markerLayer) {
                this.updateDriverMarker(driverId, locationUpdate.coordinates);
            }
        } catch (error) {
            console.error('Error updating location:', error);
            throw error;
        }
    }

    // بدء تتبع السائق
    startTracking(driverId) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        // إيقاف أي تتبع سابق
        this.stopTracking(driverId);

        const watchId = navigator.geolocation.watchPosition(
            (position) => this.updateDriverLocation(driverId, position),
            (error) => this.handleLocationError(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        this.watchIds.set(driverId, watchId);
        localStorage.setItem(`tracking_${driverId}`, 'active');
        
        return watchId;
    }

    // إيقاف تتبع السائق
    stopTracking(driverId) {
        const watchId = this.watchIds.get(driverId);
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            this.watchIds.delete(driverId);
            localStorage.removeItem(`tracking_${driverId}`);
        }
    }

    // تحديث علامة السائق على الخريطة
    updateDriverMarker(driverId, coordinates) {
        const markerLayer = window.markerLayer;
        if (!markerLayer) return;

        let marker = markerLayer.getLayers().find(layer => layer.driverId === driverId);

        if (marker) {
            marker.setLatLng([coordinates.lat, coordinates.lng]);
            this.updateMarkerRotation(marker, coordinates.heading);
        } else {
            this.createNewDriverMarker(driverId, coordinates);
        }
    }

    // إنشاء علامة جديدة للسائق
    async createNewDriverMarker(driverId, coordinates) {
        try {
            const snapshot = await this.database.ref(`drivers/${driverId}`).once('value');
            const driver = snapshot.val();

            if (driver) {
                const icon = L.divIcon({
                    html: `
                        <div class="driver-marker ${driver.active ? 'active' : ''}">
                            <img src="${driver.imageUrl || 'default-avatar.png'}" 
                                 class="driver-photo" 
                                 alt="${driver.name}">
                            <div class="driver-direction"></div>
                        </div>
                    `,
                    className: 'custom-driver-marker',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                const marker = L.marker([coordinates.lat, coordinates.lng], {
                    icon: icon,
                    driverId: driverId
                }).addTo(window.markerLayer);

                marker.bindPopup(this.createDriverPopup(driver));
                this.updateMarkerRotation(marker, coordinates.heading);
            }
        } catch (error) {
            console.error('Error creating marker:', error);
        }
    }

    // تحديث اتجاه علامة السائق
    updateMarkerRotation(marker, heading) {
        if (heading != null) {
            const directionEl = marker.getElement().querySelector('.driver-direction');
            if (directionEl) {
                directionEl.style.transform = `rotate(${heading}deg)`;
            }
        }
    }

    // إنشاء نافذة منبثقة للسائق
    createDriverPopup(driver) {
        return `
            <div class="driver-popup">
                <img src="${driver.imageUrl || 'default-avatar.png'}" 
                     class="driver-popup-photo" 
                     alt="${driver.name}">
                <h3>${driver.name}</h3>
                <p>${driver.carType} - ${driver.carModel}</p>
                <p class="driver-status ${driver.active ? 'active' : 'inactive'}">
                    ${driver.active ? 'متاح' : 'مشغول'}
                </p>
                <button onclick="openChatWindow('${driver.id}')" 
                        class="chat-button">
                    <i class="fas fa-comment"></i> مراسلة
                </button>
            </div>
        `;
    }

    handleLocationError(error) {
        let message = 'خطأ في تحديد الموقع';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'تم رفض الوصول إلى خدمة الموقع';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'معلومات الموقع غير متوفرة';
                break;
            case error.TIMEOUT:
                message = 'انتهت مهلة طلب تحديد الموقع';
                break;
        }
        showToast(message, 'error');
    }
}

// إنشاء نسخة عالمية من نظام التتبع
const driverTracker = new DriverTracker();

// تحديث دالة إضافة السائق
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
                lng: longitude,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            },
            bio: document.getElementById('driverBio').value,
            imageUrl: imageUrl,
            rating: 5,
            trips: 0,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };

        // إضافة السائق وبدء التتبع
        const newDriverRef = await database.ref('drivers').push(driverData);
        const driverId = newDriverRef.key;

        // بدء تتبع موقع السائق
        await driverTracker.startTracking(driverId);

        // إغلاق النافذة المنبثقة
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDriverModal'));
        modal.hide();

        document.getElementById('addDriverForm').reset();
        showToast('تم إضافة السائق وتفعيل التتبع بنجاح');
        loadDrivers();

    } catch (error) {
        console.error('Error adding driver:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// إضافة أنماط CSS للعلامات
const styles = `
    .custom-driver-marker {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .driver-photo {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid #FFD700;
        object-fit: cover;
    }

    .driver-direction {
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 12px solid #FFD700;
        transition: transform 0.3s ease;
    }

    .driver-popup {
        text-align: center;
        padding: 10px;
    }

    .driver-popup-photo {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        margin-bottom: 10px;
        border: 2px solid #FFD700;
    }

    .driver-status {
        padding: 5px 10px;
        border-radius: 15px;
        margin: 5px 0;
        font-size: 0.9em;
    }

    .driver-status.active {
        background: rgba(46, 204, 64, 0.2);
        color: #2ECC40;
    }

    .driver-status.inactive {
        background: rgba(255, 65, 54, 0.2);
        color: #FF4136;
    }

    .chat-button {
        background: #FFD700;
        border: none;
        padding: 5px 15px;
        border-radius: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .chat-button:hover {
        background: #ccac00;
        transform: translateY(-2px);
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// استعادة التتبع عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const activeDrivers = Object.keys(localStorage)
        .filter(key => key.startsWith('tracking_'))
        .map(key => key.replace('tracking_', ''));

    activeDrivers.forEach(driverId => {
        if (localStorage.getItem(`tracking_${driverId}`) === 'active') {
            driverTracker.startTracking(driverId);
        }
    });
});