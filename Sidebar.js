import React, { useState } from 'react';
// ...existing code...

const Sidebar = () => {
    const [favoriteDrivers, setFavoriteDrivers] = useState([]);

    const addToFavorites = (driver) => {
        setFavoriteDrivers([...favoriteDrivers, driver]);
    };

    return (
        <div className="sidebar">
            {/* ...existing code... */}
            <h3>السائقين المفضلين</h3>
            <ul>
                {favoriteDrivers.map((driver, index) => (
                    <li key={index}>{driver.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default Sidebar;
