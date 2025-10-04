import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import './NotificationDropdown.css';

const NotificationDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Only show for admin@mypackaging.com
  if (!user || user.email !== 'admin@mypackaging.com') {
    return null;
  }

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    // Navigate to Settings page with user management tab
    navigate('/settings?tab=users');
    setIsOpen(false);
  };

  const handleViewAllClick = () => {
    // Navigate to Settings page with user management tab
    navigate('/settings?tab=users');
    setIsOpen(false);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const notificationTime = timestamp.toDate();
    const diffInMs = now - notificationTime;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  return (
    <div className="notification-dropdown" ref={dropdownRef}>
      <button 
        className={`notification-bell ${unreadCount > 0 ? 'has-notifications' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-menu">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="unread-count">{unreadCount} new</span>
            )}
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <span>No notifications</span>
              </div>
            ) : (
              notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-title">
                      Password Reset Request
                    </div>
                    <div className="notification-message">
                      {notification.email} requested a password reset
                    </div>
                    <div className="notification-time">
                      {formatTimeAgo(notification.requestedAt)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="notification-dot"></div>
                  )}
                </div>
              ))
            )}
          </div>

          {notifications.length > 5 && (
            <div className="notification-footer">
              <button 
                className="view-all-btn"
                onClick={handleViewAllClick}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;