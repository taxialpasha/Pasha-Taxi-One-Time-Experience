import React from 'react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { currentUser } = useAuth();

  return (
    <aside>
      {/* ...existing code... */}
      <div className="user-info">
        {currentUser ? (
          <img src={currentUser.photoURL} alt="User Avatar" className="user-avatar" />
        ) : (
          <button>Register</button>
        )}
      </div>
      {/* ...existing code... */}
    </aside>
  );
};

export default Sidebar;
