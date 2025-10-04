import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const addAlert = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newAlert = {
      id,
      message,
      type, // 'success', 'error', 'warning', 'info'
      duration,
      timestamp: new Date()
    };

    setAlerts(prev => [...prev, newAlert]);

    // Auto-remove alert after duration
    if (duration > 0) {
      setTimeout(() => {
        removeAlert(id);
      }, duration);
    }

    return id;
  }, [removeAlert]);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback((message, duration) => addAlert(message, 'success', duration), [addAlert]);
  const showError = useCallback((message, duration) => addAlert(message, 'error', duration), [addAlert]);
  const showWarning = useCallback((message, duration) => addAlert(message, 'warning', duration), [addAlert]);
  const showInfo = useCallback((message, duration) => addAlert(message, 'info', duration), [addAlert]);

  // Confirmation dialog replacement
  const showConfirm = useCallback((message, onConfirm, onCancel) => {
    const id = addAlert(
      message,
      'confirm',
      0, // Don't auto-remove confirmation dialogs
    );

    // Store confirmation callbacks
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { ...alert, onConfirm, onCancel }
        : alert
    ));

    return id;
  }, [addAlert]);

  const value = {
    alerts,
    addAlert,
    removeAlert,
    clearAllAlerts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
};