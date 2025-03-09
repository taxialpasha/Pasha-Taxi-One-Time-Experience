// دالة لإضافة السائق إلى المفضلة
function addToFavorites(driverId) {
    // التحقق من وجود مستخدم مسجل الدخول
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    // جلب بيانات السائق
    database.ref(`drivers/${driverId}`).once('value')
        .then(snapshot => {
            const driver = snapshot.val();
            if (!driver) {
                showToast('لم يتم العثور على بيانات السائق', 'error');
                return;
            }
            
            // إضافة السائق للمفضلة في قاعدة البيانات
            return database.ref(`users/${userId}/favoriteDrivers/${driverId}`).set({
                driverId: driverId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            // تحديث زر المفضلة في بطاقة السائق الحالية
            const favoriteBtn = document.querySelector(`.driver-card[data-driver-id="${driverId}"] .favorite-btn`);
            if (favoriteBtn) {
                favoriteBtn.innerHTML = '<i class="fas fa-star"></i> إزالة من المفضلة';
                favoriteBtn.classList.add('is-favorite');
                favoriteBtn.setAttribute('onclick', `removeFromFavorites('${driverId}')`);
            }
            
            showToast('تمت إضافة السائق إلى المفضلة', 'success');
            
            // تحديث عدد المفضلة في الشريط الجانبي
            updateFavoritesBadge();
        })
        .catch(error => {
            console.error('Error adding to favorites:', error);
            showToast('حدث خطأ في إضافة السائق إلى المفضلة', 'error');
        });
}

// دالة لإزالة السائق من المفضلة
function removeFromFavorites(driverId) {
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    database.ref(`users/${userId}/favoriteDrivers/${driverId}`).remove()
        .then(() => {
            // تحديث زر المفضلة في بطاقة السائق الحالية
            const favoriteBtn = document.querySelector(`.driver-card[data-driver-id="${driverId}"] .favorite-btn`);
            if (favoriteBtn) {
                favoriteBtn.innerHTML = '<i class="fas fa-star"></i> إضافة للمفضلة';
                favoriteBtn.classList.remove('is-favorite');
                favoriteBtn.setAttribute('onclick', `addToFavorites('${driverId}')`);
            }
            
            showToast('تمت إزالة السائق من المفضلة', 'success');
            
            // تحديث عدد المفضلة في الشريط الجانبي
            updateFavoritesBadge();
            
            // إذا كنا في صفحة المفضلة، قم بإزالة البطاقة من العرض
            const favoriteView = document.getElementById('favoritesView');
            if (favoriteView && favoriteView.style.display !== 'none') {
                const driverCard = document.querySelector(`.favorite-driver-card[data-driver-id="${driverId}"]`);
                if (driverCard) {
                    driverCard.classList.add('animate__fadeOut');
                    setTimeout(() => driverCard.remove(), 300);
                }
            }
        })
        .catch(error => {
            console.error('Error removing from favorites:', error);
            showToast('حدث خطأ في إزالة السائق من المفضلة', 'error');
        });
}

// دالة تحديث عدد المفضلة في الشريط الجانبي
function updateFavoritesBadge() {
    const badge = document.getElementById('favoriteDriversBadge');
    if (!badge) return;
    
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    database.ref(`users/${userId}/favoriteDrivers`).once('value')
        .then(snapshot => {
            const count = snapshot.numChildren();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        })
        .catch(error => {
            console.error('Error updating favorites badge:', error);
        });
}

// دالة لعرض السائقين المفضلين
function showFavoriteDrivers() {
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    // إخفاء شبكة السائقين الرئيسية وإظهار المفضلة
    const driversGrid = document.getElementById('driversGrid');
    let favoritesView = document.getElementById('favoritesView');
    
    if (!favoritesView) {
        // إنشاء قسم المفضلة إذا لم يكن موجوداً
        favoritesView = document.createElement('div');
        favoritesView.id = 'favoritesView';
        favoritesView.className = 'drivers-grid';
        driversGrid.parentNode.insertBefore(favoritesView, driversGrid.nextSibling);
    }
    
    // إخفاء شبكة السائقين وإظهار المفضلة
    driversGrid.style.display = 'none';
    favoritesView.style.display = 'grid';
    
    // عرض مؤشر تحميل
    showLoading();
    
    // جلب السائقين المفضلين
    database.ref(`users/${userId}/favoriteDrivers`).once('value')
        .then(snapshot => {
            const favorites = snapshot.val() || {};
            
            // إفراغ قسم المفضلة
            favoritesView.innerHTML = '';
            
            // عنوان القسم
            const header = document.createElement('div');
            header.className = 'favorites-header';
            header.innerHTML = `
                <h3>السائقين المفضلين <span class="badge bg-primary">${Object.keys(favorites).length}</span></h3>
                <button class="btn btn-sm btn-outline-primary" onclick="showAllDrivers()">
                    <i class="fas fa-arrow-right"></i> العودة للسائقين
                </button>
            `;
            favoritesView.appendChild(header);
            
            // إذا لم يكن هناك مفضلة
            if (Object.keys(favorites).length === 0) {
                const noFavorites = document.createElement('div');
                noFavorites.className = 'no-favorites';
                noFavorites.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-star fa-3x mb-3" style="color: #FFD700;"></i>
                        <h4>لا يوجد سائقين مفضلين</h4>
                        <p>قم بإضافة سائقين للمفضلة لعرضهم هنا</p>
                        <button class="btn btn-primary mt-3" onclick="showAllDrivers()">
                            تصفح السائقين
                        </button>
                    </div>
                `;
                favoritesView.appendChild(noFavorites);
                hideLoading();
                return;
            }
            
            // جلب بيانات كل سائق مفضل
            const promises = Object.keys(favorites).map(driverId => {
                return database.ref(`drivers/${driverId}`).once('value')
                    .then(driverSnapshot => ({
                        id: driverId,
                        data: driverSnapshot.val()
                    }));
            });
            
            Promise.all(promises)
                .then(drivers => {
                    // إنشاء بطاقة لكل سائق مفضل
                    drivers.forEach(driver => {
                        if (driver.data) {
                            const card = createFavoriteDriverCard(driver.data, driver.id);
                            favoritesView.appendChild(card);
                        }
                    });
                    
                    hideLoading();
                })
                .catch(error => {
                    console.error('Error loading favorite drivers:', error);
                    showToast('حدث خطأ في تحميل السائقين المفضلين', 'error');
                    hideLoading();
                });
        })
        .catch(error => {
            console.error('Error getting favorite drivers:', error);
            showToast('حدث خطأ في جلب السائقين المفضلين', 'error');
            hideLoading();
        });
}

// دالة إنشاء بطاقة سائق مفضل
function createFavoriteDriverCard(driver, driverId) {
    const card = document.createElement('div');
    card.className = 'driver-card favorite-driver-card animate__animated animate__fadeIn';
    card.setAttribute('data-driver-id', driverId);
    
    card.innerHTML = `
        <div class="driver-image-container">
            <img src="${driver.imageUrl || 'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/driver-images%2F7605a607-6cf8-4b32-aee1-fa7558c98452.png?alt=media&token=5cf9e67c-ba6e-4431-a6a0-79dede15b527'}" 
                 alt="${driver.name}" class="driver-image">
                 
            <div class="driver-status ${driver.active ? 'status-active' : 'status-inactive'}">
                ${driver.active ? 'متاح' : 'مشغول'}
            </div>
        </div>
        
        <div class="driver-info">
            <h5 class="driver-name">${driver.name}</h5>
            
            <div class="driver-stats">
                <div class="stat-item">
                    <div class="stat-value">
                        <i class="fas fa-star"></i> ${driver.rating ? driver.rating.toFixed(1) : '5.0'}
                    </div>
                    <div class="stat-label">التقييم</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">
                        <i class="fas fa-route"></i> ${driver.trips || 0}
                    </div>
                    <div class="stat-label">الرحلات</div>
                </div>
            </div>
            
            <div class="text-muted">
                <p class="mb-2">
                    <i class="fas fa-car me-2"></i> ${driver.carType} ${driver.carModel}
                </p>
                <p class="mb-0">
                    <i class="fas fa-map-marker-alt me-2"></i> ${driver.location}
                </p>
            </div>
        </div>
        
        <div class="driver-actions">
            <button class="action-btn primary" onclick="viewDriverLocation('${driverId}')">
                <i class="fas fa-map-marker-alt"></i> عرض الموقع
            </button>
            <button class="action-btn secondary" onclick="openChatWindow('${driverId}')">
                <i class="fas fa-comment"></i> مراسلة
            </button>
        </div>
        
        <button class="action-btn favorite-btn is-favorite" onclick="removeFromFavorites('${driverId}')">
            <i class="fas fa-star"></i> إزالة من المفضلة
        </button>
    `;
    
    return card;
}

// دالة لعرض جميع السائقين (العودة من المفضلة)
function showAllDrivers() {
    const driversGrid = document.getElementById('driversGrid');
    const favoritesView = document.getElementById('favoritesView');
    
    if (driversGrid && favoritesView) {
        driversGrid.style.display = 'grid';
        favoritesView.style.display = 'none';
    }
    
    // تفعيل فلتر "الكل"
    const allChip = document.querySelector('.location-chip[data-location="all"]');
    if (allChip) {
        document.querySelectorAll('.location-chip').forEach(chip => chip.classList.remove('active'));
        allChip.classList.add('active');
    }
}

// دالة للتحقق مما إذا كان السائق مفضلاً
function isDriverFavorite(driverId) {
    return new Promise((resolve) => {
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        database.ref(`users/${userId}/favoriteDrivers/${driverId}`).once('value')
            .then(snapshot => {
                resolve(snapshot.exists());
            })
            .catch(() => {
                resolve(false);
            });
    });
}

// إضافة رابط المفضلة إلى القائمة
function addFavoritesLink() {
    const sideNavItems = document.querySelector('.side-nav-items');
    if (!sideNavItems) return;
    
    // التحقق من وجود الرابط مسبقاً
    if (document.getElementById('favoriteDriversLink')) return;
    
    // إنشاء رابط المفضلة
    const favoritesLink = document.createElement('a');
    favoritesLink.id = 'favoriteDriversLink';
    favoritesLink.href = 'javascript:void(0)';
    favoritesLink.className = 'side-nav-item';
    favoritesLink.innerHTML = `
        <i class="fas fa-star"></i> السائقين المفضلين
        <span id="favoriteDriversBadge" class="badge">0</span>
    `;
    
    // إضافة معالج الحدث
    favoritesLink.addEventListener('click', () => {
        // إغلاق القائمة الجانبية
        const sideNav = document.getElementById('sideNav');
        const navBackdrop = document.getElementById('navBackdrop');
        if (sideNav && sideNav.classList.contains('open')) {
            sideNav.classList.remove('open');
            if (navBackdrop) navBackdrop.classList.remove('show');
        }
        
        // عرض السائقين المفضلين
        showFavoriteDrivers();
    });
    
    // إدراج الرابط قبل رابط الإعدادات
    const settingsLink = Array.from(sideNavItems.querySelectorAll('.side-nav-item')).find(link => 
        link.textContent.trim().includes('الإعدادات')
    );
    
    if (settingsLink) {
        sideNavItems.insertBefore(favoritesLink, settingsLink);
    } else {
        sideNavItems.appendChild(favoritesLink);
    }
    
    // تحديث شارة عدد المفضلة
    updateFavoritesBadge();
}

// تحميل حالة المفضلة عند إنشاء بطاقة السائق
function updateDriverFavoriteStatus() {
    // الحصول على جميع بطاقات السائقين
    const driverCards = document.querySelectorAll('.driver-card');
    
    driverCards.forEach(card => {
        const driverId = card.getAttribute('data-driver-id');
        const favoriteBtn = card.querySelector('.favorite-btn');
        
        if (driverId && favoriteBtn) {
            isDriverFavorite(driverId)
                .then(isFavorite => {
                    if (isFavorite) {
                        favoriteBtn.innerHTML = '<i class="fas fa-star"></i> إزالة من المفضلة';
                        favoriteBtn.classList.add('is-favorite');
                        favoriteBtn.setAttribute('onclick', `removeFromFavorites('${driverId}')`);
                    } else {
                        favoriteBtn.innerHTML = '<i class="fas fa-star"></i> إضافة للمفضلة';
                        favoriteBtn.classList.remove('is-favorite');
                        favoriteBtn.setAttribute('onclick', `addToFavorites('${driverId}')`);
                    }
                });
        }
    });
}

// تهيئة ميزة المفضلة
document.addEventListener('DOMContentLoaded', function() {
    // إضافة رابط المفضلة إلى القائمة
    addFavoritesLink();
    
    // إضافة مستمع حدث لتحديث حالة المفضلة بعد تحميل السائقين
    document.addEventListener('driversLoaded', updateDriverFavoriteStatus);
    
    // تحديث المفضلة بعد تحميل الصفحة
    setTimeout(updateDriverFavoriteStatus, 2000);
});

// إضافة نمط CSS للمفضلة
function addFavoritesStyle() {
    const style = document.createElement('style');
    style.textContent = `
        /* نمط شارة المفضلة */
        #favoriteDriversBadge {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background-color: #FFD700;
            color: #000000;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        /* نمط زر المفضلة */
        .favorite-btn {
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: #FFD700;
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            font-size: 0.8rem;
            cursor: pointer;
            z-index: 10;
            transition: all 0.3s ease;
        }
        
        .favorite-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
        }
        
        .favorite-btn.is-favorite {
            background-color: #FFD700;
            color: #000000;
        }
        
        /* نمط عنوان المفضلة */
        .favorites-header {
            grid-column: 1 / -1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 215, 0, 0.3);
        }
        
        .favorites-header h3 {
            color: #FFD700;
            margin: 0;
        }
        
        /* نمط عند عدم وجود مفضلة */
        .no-favorites {
            grid-column: 1 / -1;
            color: #FFFFFF;
        }
    `;
    
    document.head.appendChild(style);
}

// إضافة الأنماط
addFavoritesStyle();