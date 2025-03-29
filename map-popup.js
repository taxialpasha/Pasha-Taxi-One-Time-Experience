// إنشاء نظام لعرض الخريطة في نافذة منبثقة

// دالة إنشاء أزرار الخريطة المنبثقة
function createMapPopupButton() {
    // إنشاء الزر الرئيسي
    const mapButton = document.createElement('button');
    mapButton.id = 'mapPopupButton';
    mapButton.className = 'map-popup-btn';
    mapButton.innerHTML = '<i class="fas fa-map-marked-alt"></i><span>عرض الخريطة</span>';
    mapButton.title = 'عرض الخريطة في نافذة منبثقة';
    
    // إضافة معالج النقر
    mapButton.addEventListener('click', openMapPopup);
    
    // إضافة الزر إلى الصفحة
    document.body.appendChild(mapButton);
    
    // إضافة التنسيقات الخاصة بالزر
    addMapPopupStyles();
}

// دالة فتح النافذة المنبثقة للخريطة
function openMapPopup() {
    // التحقق من وجود مكتبة Swal (SweetAlert2)
    if (typeof Swal === 'undefined') {
        // إذا لم تكن مكتبة SweetAlert2 موجودة، نستخدم واجهة منبثقة بسيطة
        createSimpleMapModal();
        return;
    }
    
    // استخدام SweetAlert2 لإنشاء نافذة منبثقة جميلة
    Swal.fire({
        title: '<i class="fas fa-map"></i> الخريطة',
        html: '<div id="popupMap" style="width: 100%; height: 70vh;"></div>',
        width: '90%',
        padding: '0',
        background: '#1a1a1a',
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'dark-popup',
            title: 'text-white'
        },
        didOpen: () => {
            // إنشاء خريطة جديدة في النافذة المنبثقة
            initializePopupMap();
        }
    });
}

// دالة إنشاء نافذة منبثقة بسيطة (احتياطية)
function createSimpleMapModal() {
    // إنشاء النافذة المنبثقة
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'map-modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'map-modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'map-modal-header';
    modalHeader.innerHTML = '<h3><i class="fas fa-map"></i> الخريطة</h3><button class="map-modal-close">&times;</button>';
    
    const modalBody = document.createElement('div');
    modalBody.className = 'map-modal-body';
    modalBody.innerHTML = '<div id="popupMap" style="width: 100%; height: 70vh;"></div>';
    
    // تجميع النافذة
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // إضافة معالج للإغلاق
    const closeButton = modalHeader.querySelector('.map-modal-close');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    // إغلاق النافذة عند النقر خارجها
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    });
    
    // تهيئة الخريطة
    initializePopupMap();
}

// دالة تهيئة الخريطة في النافذة المنبثقة
// دالة تهيئة الخريطة في النافذة المنبثقة
function initializePopupMap() {
    // التحقق من وجود مكتبة Leaflet
    if (typeof L === 'undefined') {
        const popupMap = document.getElementById('popupMap');
        if (popupMap) {
            popupMap.innerHTML = '<div class="map-error">عذراً، لا يمكن تحميل الخريطة. مكتبة Leaflet غير متوفرة.</div>';
        }
        return;
    }
    
    // إنشاء مرجع لعنصر الخريطة
    const popupMap = document.getElementById('popupMap');
    if (!popupMap) return;
    
    // بيانات الموقع الافتراضي (بغداد)
    const defaultLocation = [33.3152, 44.3661];
    
    // إضافة مؤشر التحميل قبل تهيئة الخريطة
    popupMap.innerHTML = `
        <div class="map-loading">
            <div class="spinner"></div>
            <p>جاري تحميل الخريطة والسائقين...</p>
        </div>
    `;
    
    // إنشاء خريطة جديدة
    const map = L.map('popupMap', {
        center: defaultLocation,
        zoom: 12,
        zoomControl: false
    });
    
    // إضافة طبقة الخريطة
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // إضافة زر التحكم بالتكبير/التصغير
    L.control.zoom({
        position: 'bottomright',
        zoomInTitle: 'تكبير',
        zoomOutTitle: 'تصغير'
    }).addTo(map);
    
    // إضافة زر الموقع الحالي
    L.control.locate({
        position: 'bottomright',
        strings: {
            title: 'أظهر موقعي'
        },
        flyTo: true,
        cacheLocation: true,
        showPopup: false,
        locateOptions: {
            enableHighAccuracy: true,
            watch: false
        }
    }).addTo(map);
    
    // إضافة طبقة السائقين كطبقة منفصلة
    const driversLayer = L.layerGroup().addTo(map);
    
    // إضافة عناصر التحكم بالطبقات
    const layerControl = L.control.layers(
        {}, // لا توجد طبقات أساسية إضافية
        { "السائقين": driversLayer }, // طبقات متراكبة
        { position: 'topright', collapsed: false }
    ).addTo(map);
    
    // تحميل بيانات السائقين من قاعدة البيانات
    loadAllDriversToPopupMap(map, driversLayer);
    
    // محاولة نسخ العلامات من الخريطة الأصلية
    copyMarkersToPopupMap(map);
    
    // تحديث حجم الخريطة بعد التهيئة
    setTimeout(() => {
        map.invalidateSize();
        
        // إزالة مؤشر التحميل
        const loadingElement = popupMap.querySelector('.map-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }, 500);
    
    // إضافة مصفي للسائقين
    addDriversFilterControl(map, driversLayer);
    
    return { map, driversLayer };
}

// دالة نسخ العلامات من الخريطة الأصلية
function copyMarkersToPopupMap(popupMap) {
    try {
        // محاولة الوصول إلى الخريطة الأصلية
        if (window.map && window.markerLayer) {
            // طبقة العلامات الجديدة
            const newMarkerLayer = L.layerGroup().addTo(popupMap);
            
            // نسخ العلامات من طبقة العلامات الأصلية
            window.markerLayer.eachLayer(function(layer) {
                if (layer instanceof L.Marker) {
                    // نسخ العلامة
                    const clonedMarker = L.marker(layer.getLatLng(), {
                        icon: layer.options.icon,
                        title: layer.options.title,
                        driverId: layer.options.driverId
                    });
                    
                    // نسخ النافذة المنبثقة إذا وجدت
                    if (layer.getPopup()) {
                        clonedMarker.bindPopup(layer.getPopup().getContent());
                    }
                    
                    // إضافة إلى الطبقة الجديدة
                    clonedMarker.addTo(newMarkerLayer);
                }
            });
            
            // التركيز على المنطقة التي تحتوي على العلامات
            if (newMarkerLayer.getLayers().length > 0) {
                const group = L.featureGroup(newMarkerLayer.getLayers());
                popupMap.fitBounds(group.getBounds(), {
                    padding: [50, 50]
                });
            }
        } else if (window.driversMarkers && window.driversMarkers.length > 0) {
            // إذا كانت العلامات محفوظة في مصفوفة
            const newMarkerLayer = L.layerGroup().addTo(popupMap);
            
            window.driversMarkers.forEach(marker => {
                const clonedMarker = L.marker(marker.getLatLng(), {
                    icon: marker.options.icon
                });
                
                if (marker.getPopup()) {
                    clonedMarker.bindPopup(marker.getPopup().getContent());
                }
                
                clonedMarker.addTo(newMarkerLayer);
            });
            
            // التركيز على المنطقة التي تحتوي على العلامات
            const group = L.featureGroup(newMarkerLayer.getLayers());
            if (group.getBounds().isValid()) {
                popupMap.fitBounds(group.getBounds(), {
                    padding: [50, 50]
                });
            }
        }
    } catch (error) {
        console.error('Error copying markers:', error);
    }
}
// دالة إنشاء زر الخريطة المنبثقة
function createMapPopupButton() {
    // إنشاء الزر
    const mapButton = document.createElement('button');
    mapButton.id = 'mapPopupButton';
    mapButton.className = 'map-popup-btn';
    mapButton.innerHTML = '<i class="fas fa-map-marked-alt"></i>'; // فقط الأيقونة بدون نص
    mapButton.title = 'عرض الخريطة في نافذة منبثقة'; // نص تلميح يظهر عند التحويم
    
    // إضافة معالج النقر
    mapButton.addEventListener('click', openMapPopup);
    
    // إضافة الزر إلى الصفحة
    document.body.appendChild(mapButton);
    
    // إضافة التنسيقات الخاصة بالزر
    addMapPopupStyles();
}

// دالة إضافة التنسيقات
function addMapPopupStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* تنسيقات زر الخريطة المنبثقة */
        .map-popup-btn {
            position: fixed;
            top: 50%; /* وضع الزر في منتصف الصفحة عمودياً */
            right: 20px; /* المسافة من اليمين */
            transform: translateY(-50%); /* ضبط المحاذاة العمودية */
            width: 50px; /* عرض أصغر للزر */
            height: 50px; /* ارتفاع أصغر للزر */
            border-radius: 50%; /* شكل دائري */
            background-color: #FFD700; /* لون خلفية أصفر ذهبي */
            color: #000000; /* لون النص أسود */
            border: none;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            z-index: 1000;
            display: flex;
            align-items: center; /* محاذاة الأيقونة في الوسط */
            justify-content: center; /* محاذاة الأيقونة في الوسط */
            transition: all 0.3s ease;
            padding: 0;
        }
        
        /* تكبير الأيقونة */
        .map-popup-btn i {
            font-size: 22px;
        }
        
        /* تأثير التحويم */
        .map-popup-btn:hover {
            transform: translateY(-50%) scale(1.1); /* الحفاظ على المحاذاة العمودية مع تكبير الزر */
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
        }
        
        /* تأثير الضغط */
        .map-popup-btn:active {
            transform: translateY(-50%) scale(0.95); /* الحفاظ على المحاذاة العمودية مع تصغير الزر */
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        
        /* تنسيقات النافذة المنبثقة البسيطة */
        .map-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .map-modal-content {
            width: 90%;
            max-width: 1000px;
            max-height: 90vh;
            background-color: #1a1a1a;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            animation: scaleIn 0.3s ease;
        }
        
        @keyframes scaleIn {
            from { transform: scale(0.9); }
            to { transform: scale(1); }
        }
        
        .map-modal-header {
            padding: 15px;
            background-color: #242424;
            color: #FFD700;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
        }
        
        .map-modal-header h3 {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .map-modal-close {
            background: none;
            border: none;
            color: #FFD700;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .map-modal-close:hover {
            transform: scale(1.2);
        }
        
        .map-modal-body {
            flex-grow: 1;
            padding: 0;
            overflow: hidden;
        }
        
        .map-error {
            padding: 20px;
            text-align: center;
            color: #ff6b6b;
            font-weight: bold;
        }
        
        /* تنسيقات نافذة SweetAlert المخصصة */
        .dark-popup {
            background-color: #1a1a1a !important;
            color: #FFFFFF !important;
            border-radius: 15px !important;
        }
        
        .text-white {
            color: #FFD700 !important;
            font-size: 1.5rem !important;
        }
        
        /* تخصيص أنماط الخريطة في النافذة المنبثقة */
        #popupMap .leaflet-control-zoom,
        #popupMap .leaflet-control-locate {
            margin-bottom: 30px !important;
        }
        
        /* تعديل للهواتف المحمولة */
        @media (max-width: 768px) {
            .map-popup-btn {
                right: 15px; /* تقريب الزر من الحافة اليمنى على الشاشات الصغيرة */
            }
        }
    `;
    document.head.appendChild(style);
}

// تشغيل النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تأخير بسيط لضمان تحميل جميع المكتبات
    setTimeout(createMapPopupButton, 1000);
});

// تشغيل النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تأخير بسيط لضمان تحميل جميع المكتبات
    setTimeout(createMapPopupButton, 1000);
});

// تحديث موضع الزر عند تغير حجم النافذة
window.addEventListener('resize', function() {
    // تعديل موضع الزر إذا لزم الأمر
    const mapButton = document.getElementById('mapPopupButton');
    if (mapButton) {
        // يمكن إضافة تعديلات هنا
    }
});

// إضافة دوال مساعدة للواجهة

// دالة لتحديث موضع زر الخريطة
function updateMapButtonPosition(bottomOffset) {
    const mapButton = document.getElementById('mapPopupButton');
    if (mapButton) {
        mapButton.style.bottom = `${bottomOffset}px`;
    }
}

// دالة إظهار أو إخفاء زر الخريطة
function toggleMapButton(show) {
    const mapButton = document.getElementById('mapPopupButton');
    if (mapButton) {
        mapButton.style.display = show ? 'flex' : 'none';
    }
}


