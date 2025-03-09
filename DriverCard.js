import React from 'react';

const DriverCard = ({ driver, addToFavorites }) => {
    return (
        <div className="driver-card">
            <button onClick={() => addToFavorites(driver)}>إضافة إلى السائقين المفضلين</button>
        </div>
    );
};

export default DriverCard;
