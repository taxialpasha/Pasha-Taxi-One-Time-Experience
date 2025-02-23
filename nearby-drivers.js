// تحديث دالة إنشاء مؤشر السائق على الخريطة
function createDriverMarker(driver, key) {
    const isApproved = driver.approved === true;
    const isPending = driver.approvalStatus === 'pending';
    const statusColor = isApproved ? '#2ECC40' : (isPending ? '#FFD700' : '#FF4136');

    // إنشاء أيقونة مخصصة مع مراعاة حالة الموافقة
    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="driver-marker ${isApproved ? 'active' : 'inactive'}" 
                 style="${!isApproved ? 'filter: grayscale(100%);' : ''}">
                <div class="marker-pulse" style="border-color: ${statusColor}"></div>
                <div class="marker-container">
                    <img src="${driver.imageUrl || 'default-avatar.png'}" alt="${driver.name}">
                </div>
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });

    // إنشاء المؤشر مع النافذة المنبثقة
    const marker = L.marker([driver.coordinates.lat, driver.coordinates.lng], {
        icon: icon,
        title: driver.name,
        riseOnHover: true
    });

    // تحديث محتوى النافذة المنبثقة
    const popupContent = `
        <div class="driver-popup">
            <div class="driver-popup-header">
                <div class="popup-status ${isApproved ? 'active' : 'inactive'}">
                    ${isApproved ? 'مفعل' : (isPending ? 'قيد المراجعة' : 'غير مفعل')}
                </div>
                <img src="${driver.imageUrl || 'default-avatar.png'}" 
                     style="${!isApproved ? 'filter: grayscale(100%); opacity: 0.7;' : ''}">
                <h4>${driver.name}</h4>
                ${isApproved ? `
                    <div class="driver-rating">
                        <div class="stars-container">
                            ${generateRatingStars(driver.rating)}
                        </div>
                    </div>
                ` : '<div class="pending-notice">في انتظار الموافقة</div>'}
            </div>
            <div class="driver-popup-info">
                <div class="info-row">
                    <i class="fas fa-car"></i> ${driver.carType} - ${driver.carModel}
                </div>
                <div class="info-row">
                    <i class="fas fa-map-marker-alt"></i> ${driver.location}
                </div>
            </div>
            ${isApproved ? `
                <div class="driver-popup-actions">
                    <button class="chat-btn" onclick="openChatWindow('${key}')">
                        <i class="fas fa-comment"></i> مراسلة
                    </button>
                    <button class="book-btn" onclick="bookDriver('${key}')">
                        <i class="fas fa-car"></i> حجز
                    </button>
                </div>
            ` : `
                <div class="pending-message">
                    هذا السائق غير مفعل حالياً
                </div>
            `}
        </div>
    `;

    marker.bindPopup(popupContent, {
        className: `custom-popup ${isApproved ? 'active' : 'inactive'}`,
        minWidth: 280,
        maxWidth: 320
    });

    return marker;
}

// تحديث دالة البحث عن السائقين في الجوار
function searchNearbyDrivers(radius) {
    if (!userLocation) {
        showToast('يرجى تحديد موقعك أولاً', 'warning');
        return;
    }

    const driversRef = database.ref('drivers');
    driversRef.once('value')
        .then((snapshot) => {
            const drivers = [];
            snapshot.forEach((childSnapshot) => {
                const driver = childSnapshot.val();
                const key = childSnapshot.key;

                if (driver.coordinates && driver.approved === true) {
                    const distance = calculateDistance(userLocation, driver.coordinates);
                    if (distance <= radius) {
                        drivers.push({
                            ...driver,
                            id: key,
                            distance: distance
                        });
                    }
                }
            });

            // ترتيب السائقين حسب المسافة
            drivers.sort((a, b) => a.distance - b.distance);

            // عرض النتائج
            displayNearbyDrivers(drivers);
        })
        .catch((error) => {
            console.error('Error fetching nearby drivers:', error);
            showToast('حدث خطأ في البحث عن السائقين', 'error');
        });
}

// تحديث دالة عرض السائقين في الجوار
function displayNearbyDrivers(drivers) {
    const resultsContainer = document.querySelector('.nearby-results-content');
    if (!resultsContainer) return;

    if (drivers.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-drivers">
                <i class="fas fa-search"></i>
                <p>لا يوجد سائقين في هذه المنطقة</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = drivers.map(driver => `
        <div class="nearby-driver-card ${driver.approved ? '' : 'inactive'}">
            <div class="driver-info">
                <img src="${driver.imageUrl || 'default-avatar.png'}" alt="${driver.name}">
                <div class="info-content">
                    <h5>${driver.name}</h5>
                    <p><i class="fas fa-car"></i> ${driver.carType} - ${driver.carModel}</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${driver.location}</p>
                    <p><i class="fas fa-star"></i> ${driver.rating ? driver.rating.toFixed(1) : '5.0'}</p>
                </div>
            </div>
            <div class="driver-actions">
                <button onclick="viewDriverLocation('${driver.id}')" class="view-location-btn" ${!driver.approved ? 'disabled' : ''}>
                    <i class="fas fa-map-marker-alt"></i> الموقع
                </button>
                <button onclick="openChatWindow('${driver.id}')" class="chat-btn" ${!driver.approved ? 'disabled' : ''}>
                    <i class="fas fa-comment"></i> مراسلة
                </button>
            </div>
        </div>
    `).join('');
}

// تحديث دالة عرض موقع السائق
function viewDriverLocation(driverId) {
    database.ref(`drivers/${driverId}`).once('value')
        .then((snapshot) => {
            const driver = snapshot.val();
            if (!driver) {
                showToast('لم يتم العثور على السائق', 'error');
                return;
            }

            if (!driver.approved) {
                showToast('هذا السائق غير مفعل حالياً', 'warning');
                return;
            }

            if (driver.coordinates) {
                const { lat, lng } = driver.coordinates;
                map.flyTo([lat, lng], 15, {
                    duration: 1.5
                });

                // إظهار علامة السائق على الخريطة
                createDriverMarker(driver, driverId).addTo(markerLayer);
            } else {
                showToast('لا توجد إحداثيات لهذا السائق', 'error');
            }
        })
        .catch((error) => {
            console.error('Error viewing driver location:', error);
            showToast('حدث خطأ في عرض موقع السائق', 'error');
        });
}

// أنماط CSS إضافية للعناصر المقيدة
const restrictedStyles = `
    .driver-marker.inactive {
        filter: grayscale(100%);
        opacity: 0.7;
    }

    .pending-notice {
        background: #FFD700;
        color: #000;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        margin-top: 5px;
    }

    .pending-message {
        text-align: center;
        padding: 10px;
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid #FFD700;
        border-radius: 8px;
        margin-top: 10px;
    }

    .custom-popup.inactive .driver-popup-actions {
        opacity: 0.5;
        pointer-events: none;
    }

    .nearby-driver-card.inactive {
        opacity: 0.7;
        filter: grayscale(100%);
        pointer-events: none;
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = restrictedStyles;
document.head.appendChild(styleSheet);
