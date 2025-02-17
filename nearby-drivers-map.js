class NearbyDriversManager {
    constructor() {
        this.userLocation = null;
        this.searchRadius = 5; // كيلومتر
        this.nearbyDrivers = [];
        this.radiusCircle = null;
        this.markers = [];
    }

    initialize() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('nearbySearchBtn');
        const radiusSlider = document.getElementById('radiusSlider');
        const closeResults = document.querySelector('.close-results');

        searchBtn.addEventListener('click', () => this.toggleSearch());
        radiusSlider.addEventListener('input', (e) => this.updateRadius(e.target.value));
        closeResults.addEventListener('click', () => this.closeResults());
    }

    async toggleSearch() {
        const radiusControl = document.querySelector('.radius-control');
        const resultsPanel = document.getElementById('nearbyResults');

        if (radiusControl.style.display === 'none') {
            radiusControl.style.display = 'block';
            resultsPanel.style.display = 'block';
            await this.startSearch();
        } else {
            this.closeResults();
        }
    }

    async startSearch() {
        try {
            showLoading();
            await this.getUserLocation();
            await this.findNearbyDrivers();
            this.updateMap();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('متصفحك لا يدعم خدمة تحديد الموقع'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    resolve(this.userLocation);
                },
                (error) => {
                    reject(new Error('فشل في تحديد موقعك'));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    async findNearbyDrivers() {
        if (!this.userLocation) return;

        const driversRef = firebase.database().ref('drivers');
        const snapshot = await driversRef.once('value');
        const drivers = snapshot.val();

        this.nearbyDrivers = [];
        if (drivers) {
            Object.entries(drivers).forEach(([id, driver]) => {
                if (driver.coordinates && driver.active) {
                    const distance = this.calculateDistance(
                        this.userLocation.lat,
                        this.userLocation.lng,
                        driver.coordinates.lat,
                        driver.coordinates.lng
                    );

                    if (distance <= this.searchRadius) {
                        this.nearbyDrivers.push({
                            id,
                            ...driver,
                            distance
                        });
                    }
                }
            });
        }

        this.updateResults();
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // نصف قطر الأرض بالكيلومتر
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    updateResults() {
        const resultsContent = document.querySelector('.nearby-results-content');
        resultsContent.innerHTML = '';

        if (this.nearbyDrivers.length === 0) {
            resultsContent.innerHTML = `
                <div class="no-results">
                    لا يوجد سائقين في نطاق ${this.searchRadius} كم
                </div>
            `;
            return;
        }

        this.nearbyDrivers
            .sort((a, b) => a.distance - b.distance)
            .forEach(driver => {
                const driverCard = this.createDriverCard(driver);
                resultsContent.appendChild(driverCard);
            });
    }

    createDriverCard(driver) {
        const card = document.createElement('div');
        card.className = 'driver-card';
        card.innerHTML = `
            <div class="driver-info">
                <img src="${driver.imageUrl || 'default-avatar.png'}" alt="${driver.name}" class="driver-avatar">
                <div class="driver-details">
                    <h4>${driver.name}</h4>
                    <div class="driver-meta">
                        <p><i class="fas fa-car"></i> ${driver.carType} - ${driver.carModel}</p>
                        <p><i class="fas fa-star"></i> ${driver.rating?.toFixed(1) || '5.0'}</p>
                        <p><i class="fas fa-route"></i> ${driver.distance.toFixed(1)} كم</p>
                    </div>
                </div>
            </div>
            <div class="driver-actions">
                <button onclick="openChatWindow('${driver.id}')" class="driver-btn chat-btn">
                    <i class="fas fa-comment"></i> مراسلة
                </button>
                <button onclick="bookDriver('${driver.id}')" class="driver-btn book-btn">
                    <i class="fas fa-taxi"></i> حجز
                </button>
            </div>
        `;
        return card;
    }

    updateMap() {
        // إزالة العلامات السابقة
        this.clearMarkers();

        // إضافة دائرة نطاق البحث
        if (this.radiusCircle) {
            map.removeLayer(this.radiusCircle);
        }

        this.radiusCircle = L.circle([this.userLocation.lat, this.userLocation.lng], {
            radius: this.searchRadius * 1000,
            color: '#FFD700',
            fillColor: '#FFD700',
            fillOpacity: 0.1
        }).addTo(map);

        // إضافة علامات السائقين
        this.nearbyDrivers.forEach(driver => {
            const marker = L.marker([driver.coordinates.lat, driver.coordinates.lng], {
                icon: L.divIcon({
                    html: `
                        <div class="driver-marker">
                            <img src="${driver.imageUrl || 'default-avatar.png'}" alt="${driver.name}">
                            <i class="fas fa-taxi"></i>
                        </div>
                    `,
                    className: 'custom-div-icon'
                })
            }).addTo(map);

            marker.bindPopup(this.createPopupContent(driver));
            this.markers.push(marker);
        });

        // تحريك الخريطة لتشمل كل العلامات
        if (this.markers.length > 0) {
            const group = new L.featureGroup([this.radiusCircle, ...this.markers]);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }

    createPopupContent(driver) {
        return `
            <div class="driver-popup">
                <div class="driver-info">
                    <img src="${driver.imageUrl || 'default-avatar.png'}" alt="${driver.name}">
                    <h4>${driver.name}</h4>
                    <div class="driver-meta">
                        <p>${driver.carType} - ${driver.carModel}</p>
                        <p>⭐ ${driver.rating?.toFixed(1) || '5.0'}</p>
                        <p>📍 ${driver.distance.toFixed(1)} كم</p>
                    </div>
                </div>
                <div class="driver-actions">
                    <button onclick="openChatWindow('${driver.id}')" class="chat-btn">
                        مراسلة
                    </button>
                    <button onclick="bookDriver('${driver.id}')" class="book-btn">
                        حجز
                    </button>
                </div>
            </div>
        `;
    }

    updateRadius(value) {
        this.searchRadius = Number(value);
        document.getElementById('radiusValue').textContent = value;
        this.findNearbyDrivers();
    }

    clearMarkers() {
        this.markers.forEach(marker => map.removeLayer(marker));
        this.markers = [];
    }

    closeResults() {
        document.querySelector('.radius-control').style.display = 'none';
        document.getElementById('nearbyResults').style.display = 'none';
        if (this.radiusCircle) {
            map.removeLayer(this.radiusCircle);
        }
        this.clearMarkers();
    }
}

// تهيئة مدير البحث عن السائقين
const nearbyDriversManager = new NearbyDriversManager();

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    nearbyDriversManager.initialize();
});