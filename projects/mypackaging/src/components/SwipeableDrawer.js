import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextWrapper';
import { useTheme } from '../context/ThemeContext';
import NotificationDropdown from './NotificationDropdown';
import logo from '../assets/logo.png';
import { Capacitor } from '@capacitor/core';
import './SwipeableDrawer.css';

const SwipeableDrawer = () => {
  const { user, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dragPosition, setDragPosition] = useState(-280); // Drawer width is 280px
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const drawerRef = useRef(null);

  const DRAWER_WIDTH = 280;
  const EDGE_THRESHOLD = 60; // pixels from edge to trigger swipe (increased for better detection)
  const OPEN_THRESHOLD = DRAWER_WIDTH * 0.5; // 50% of drawer width

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const closeDrawer = () => {
    setIsOpen(false);
    setDragPosition(-DRAWER_WIDTH);
  };

  const openDrawer = () => {
    setIsOpen(true);
    setDragPosition(0);
  };

  // Handle touch start
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;

    // Only start dragging if:
    // 1. Drawer is closed and touch starts from left edge, OR
    // 2. Drawer is open
    if (!isOpen && touch.clientX <= EDGE_THRESHOLD) {
      setIsDragging(true);
    } else if (isOpen) {
      setIsDragging(true);
    }
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    const deltaX = touch.clientX - startXRef.current;

    // Calculate new position
    let newPosition;
    if (isOpen) {
      // Drawer is open, allow dragging left to close
      newPosition = Math.min(0, Math.max(-DRAWER_WIDTH, deltaX));
    } else {
      // Drawer is closed, allow dragging right to open
      newPosition = Math.min(0, Math.max(-DRAWER_WIDTH, -DRAWER_WIDTH + deltaX));
    }

    setDragPosition(newPosition);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaX = currentXRef.current - startXRef.current;
    
    // Determine if drawer should open or close based on drag distance and direction
    if (isOpen) {
      // Drawer was open
      if (deltaX < -OPEN_THRESHOLD / 2) {
        // Dragged left significantly, close it
        closeDrawer();
      } else {
        // Didn't drag enough, keep it open
        openDrawer();
      }
    } else {
      // Drawer was closed
      if (deltaX > OPEN_THRESHOLD) {
        // Dragged right significantly, open it
        openDrawer();
      } else {
        // Didn't drag enough, keep it closed
        closeDrawer();
      }
    }

    setIsDragging(false);
  };

  // Add touch event listeners
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleGlobalTouchStart = (e) => handleTouchStart(e);
    const handleGlobalTouchMove = (e) => handleTouchMove(e);
    const handleGlobalTouchEnd = () => handleTouchEnd();

    document.addEventListener('touchstart', handleGlobalTouchStart);
    document.addEventListener('touchmove', handleGlobalTouchMove);
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleGlobalTouchStart);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, isOpen]);

  // Calculate overlay opacity based on drawer position
  const overlayOpacity = (dragPosition + DRAWER_WIDTH) / DRAWER_WIDTH * 0.5;

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-left-section">
            <button 
              className="mobile-menu-toggle"
              onClick={() => (isOpen ? closeDrawer() : openDrawer())}
              aria-label="Toggle menu"
            >
              <span className={`hamburger ${isOpen ? 'active' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <img src={logo} alt="MyPackaging Logo" className="mobile-logo" />
            <div className="mobile-app-name">
              <span className="app-name-main">MYPACKAGING</span>
              <span className="app-name-sub">bybellestore</span>
            </div>
          </div>
          
          <div className="mobile-header-actions">
            <span className={`mobile-role-badge ${userRole}`}>{userRole}</span>
            <button 
              onClick={toggleTheme}
              className="mobile-theme-toggle"
              aria-label="Toggle dark mode"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <NotificationDropdown />
          </div>
        </div>
      </div>

      {/* Overlay */}
      {(isOpen || isDragging) && (
        <div
          className="swipeable-overlay"
          style={{ opacity: overlayOpacity }}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`swipeable-drawer ${isDragging ? 'dragging' : ''} ${isOpen ? 'open' : ''}`}
        style={{
          transform: `translateX(${dragPosition}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* User Info Section */}
        <div className="drawer-user-section">
          <img src={logo} alt="MyPackaging Logo" className="drawer-logo" />
          <div className="drawer-user-info">
            <span className="drawer-user-email">{user?.email}</span>
            <span className={`drawer-role-badge ${userRole}`}>
              {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="drawer-nav-links">
          {userRole !== 'outsider' && (
            <>
              <Link to="/" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">🏠</span>
                Dashboard
              </Link>
              
              <Link to="/products" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">📦</span>
                Inventory
              </Link>
              
              <Link to="/sales" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">🛒</span>
                Sales
              </Link>
              
              <Link to="/purchases" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">📋</span>
                Purchases & Returns
              </Link>
              
              <Link to="/hutang" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">💳</span>
                Credits
              </Link>
              
              {(userRole === 'admin' || userRole === 'manager') && (
                <>
                  <Link to="/shop" className="drawer-nav-link" onClick={closeDrawer}>
                    <span className="nav-icon">🏪</span>
                    Shop
                  </Link>
                  
                  <Link to="/reports" className="drawer-nav-link" onClick={closeDrawer}>
                    <span className="nav-icon">📊</span>
                    Reports
                  </Link>
                </>
              )}
              
              <Link to="/request-changes" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">📝</span>
                Request Changes
              </Link>
              
              {userRole === 'admin' && (
                <Link to="/admin-requests" className="drawer-nav-link" onClick={closeDrawer}>
                  <span className="nav-icon">✅</span>
                  Admin Requests
                </Link>
              )}
              
              <Link to="/change-password" className="drawer-nav-link" onClick={closeDrawer}>
                <span className="nav-icon">🔐</span>
                Change Password
              </Link>
            </>
          )}
          
          {/* Dark Mode Toggle */}
          <div className="drawer-theme-toggle">
            <button className="drawer-theme-button" onClick={toggleTheme}>
              <span className="nav-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
          
          <button className="drawer-logout-button" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default SwipeableDrawer;
