import React from 'react';
import { useAlert } from '../context/AlertContext';
import './Toast.css';

const Toast = () => {
  const { alerts, removeAlert } = useAlert();

  if (alerts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'confirm': return '❓';
      default: return 'ℹ️';
    }
  };

  const handleConfirm = (alert) => {
    if (alert.onConfirm) {
      alert.onConfirm();
    }
    removeAlert(alert.id);
  };

  const handleCancel = (alert) => {
    if (alert.onCancel) {
      alert.onCancel();
    }
    removeAlert(alert.id);
  };

  return (
    <div className="toast-container">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`toast toast-${alert.type}`}
          onClick={() => alert.type !== 'confirm' && removeAlert(alert.id)}
        >
          <div className="toast-content">
            <span className="toast-icon">{getIcon(alert.type)}</span>
            <span className="toast-message">{alert.message}</span>
            
            {alert.type === 'confirm' ? (
              <div className="toast-buttons">
                <button 
                  onClick={() => handleConfirm(alert)}
                  className="btn btn-confirm"
                >
                  Yes
                </button>
                <button 
                  onClick={() => handleCancel(alert)}
                  className="btn btn-cancel"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeAlert(alert.id);
                }}
                className="toast-close"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
          
          {/* Progress bar for timed alerts */}
          {alert.duration > 0 && alert.type !== 'confirm' && (
            <div 
              className="toast-progress"
              style={{
                animationDuration: `${alert.duration}ms`
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default Toast;