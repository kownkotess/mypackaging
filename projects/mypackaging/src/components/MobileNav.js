import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextWrapper';
import NotificationDropdown from './NotificationDropdown';
import './MobileNav.css';

const MobileNav = () => {
  const { user, userRole, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="mobile-nav">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-logo-section">
            <span className="mobile-app-name">MyPackaging</span>
            <span className="mobile-role-badge">{userRole}</span>
          </div>
          
          <div className="mobile-header-actions">
            <NotificationDropdown />
            <button 
              className="mobile-menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <span className={`hamburger ${isMenuOpen ? 'active' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            
            {/* User Info Section */}
            <div className="mobile-user-section">
              <div className="mobile-user-info">
                <span className="mobile-user-email">{user?.email}</span>
                <span className={`mobile-role-indicator ${userRole}`}>
                  {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="mobile-nav-links">
              {userRole !== 'outsider' && (
                <>
                  <Link to="/" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">🏠</span>
                    Dashboard
                  </Link>
                  
                  <Link to="/products" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">📦</span>
                    Inventory
                  </Link>
                  
                  <Link to="/sales" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">🛒</span>
                    Sales
                  </Link>
                  
                  <Link to="/purchases" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">📋</span>
                    Purchases
                  </Link>
                  
                  <Link to="/hutang" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">💳</span>
                    Credits
                  </Link>
                  
                  {(userRole === 'admin' || userRole === 'manager') && (
                    <>
                      <Link to="/analytics" className="mobile-nav-link" onClick={closeMenu}>
                        <span className="nav-icon">📊</span>
                        Analytics
                      </Link>
                      
                      <Link to="/reports" className="mobile-nav-link" onClick={closeMenu}>
                        <span className="nav-icon">📈</span>
                        Reports
                      </Link>
                    </>
                  )}
                  
                  <Link to="/settings" className="mobile-nav-link" onClick={closeMenu}>
                    <span className="nav-icon">⚙️</span>
                    Settings
                  </Link>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mobile-menu-actions">
              <Link 
                to="/change-password" 
                className="mobile-action-btn secondary"
                onClick={closeMenu}
              >
                🔐 Change Password
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="mobile-action-btn primary"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileNav;