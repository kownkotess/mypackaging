import React, { useState, useEffect } from 'react';
import './InstallPrompt.css';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      
      // Show custom install prompt
      setShowInstallPrompt(true);
    };

    // Listen for successful app installation
    const handleAppInstalled = () => {
      console.log('PWA was installed successfully');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to install prompt: ${outcome}`);
    
    // Clear the saved prompt since it can only be used once
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    
    // Remember user dismissed the prompt (localStorage)
    localStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if user previously dismissed or if app is already installed
  const shouldShow = showInstallPrompt && 
    !localStorage.getItem('installPromptDismissed') &&
    !window.matchMedia('(display-mode: standalone)').matches;

  if (!shouldShow) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-icon">
          📱
        </div>
        <div className="install-prompt-text">
          <h3>Install MyPackaging</h3>
          <p>Get quick access and offline features by installing our app!</p>
        </div>
        <div className="install-prompt-actions">
          <button 
            className="install-btn install-btn-primary"
            onClick={handleInstallClick}
          >
            Install
          </button>
          <button 
            className="install-btn install-btn-secondary"
            onClick={handleDismiss}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;