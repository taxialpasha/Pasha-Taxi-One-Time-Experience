const nearbyDriversManager = {
    userLocation: null,
    searchRadius: 5,
    nearbyDrivers: [],
    radiusCircle: null,
    markers: [],
    map: null,

    initialize(mapInstance) {
        this.map = mapInstance;
        this.setupControls();
        this.setupEventListeners();
    },

    setupControls() {
        // إضافة زر البحث
        const searchButton = L.control({ position: 'bottomright' });
        searchButton.onAdd = () => {
            const btn = L.DomUtil.create('button', 'nearby-search-btn');
            btn.innerHTML = '<i class="fas fa-search"></i>';
            btn.title = 'البحث عن السائقين في الجوار';
            return btn;
        };
        searchButton.addTo(this.map);

        // إضافة تحكم نطاق البحث
        const radiusControl = L.control({ position: 'bottomright' });
        radiusControl.onAdd = () => {
            const container = L.DomUtil.create('div', 'radius-control');
            container.style.display = 'none';
            container.innerHTML = `
                <label>نطاق البحث: <span id="radiusValue">5</span> كم</label>
                <input type="range" id="radiusSlider" min="1" max="20" value="5">
            `;
            return container;
        };
        radiusControl.addTo(this.map);
    },

    setupEventListeners() {
        document.querySelector('.nearby-search-btn').addEventListener('click', 
            () => this.toggleSearch());
        
        document.getElementById('radiusSlider').addEventListener('input', 
            (e) => this.updateRadius(e.target.value));
    },

    async toggleSearch() {
        const radiusControl = document.querySelector('.radius-control');
        if (radiusControl.style.display === 'none') {
            radiusControl.style.display = 'block';
            await this.startSearch();
        } else {
            this.closeSearch();
        }
    },

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
    },

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
                (error) => reject(new Error('فشل في تحديد موقعك')),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    },

    // باقي الأكواد الخاصة بالوظائف الأخرى
};
