import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import './App.css';
import './components/RoleBasedAccess.css';
import { AuthProvider } from './context/AuthContext';
import { AuthWrapperProvider } from './context/AuthContextWrapper';
import { AlertProvider } from './context/AlertContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Toast from './components/Toast';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Sales from './components/Sales';
import Purchases from './components/Purchases';
import Hutang from './components/Hutang';
import Shop from './components/Shop';
import Analytics from './components/Analytics';
import Reports from './components/ReportsFull';
import Settings from './components/Settings';
import ChangePassword from './components/ChangePassword';
import StockMonitoring from './components/StockMonitoring';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import DataCleanup from './components/DataCleanup';
import RequestChanges from './components/RequestChanges';
import AdminRequests from './components/AdminRequests';

function ScrollToTop() {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  return null;
}

function AndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[BackButton] Not running on native platform');
      return;
    }
    
    console.log('[BackButton] Setting up listener');
    
    const handleBackButton = () => {
      console.log('[BackButton] Back button pressed, location:', location.pathname);
      
      // Check if there's a modal open first (highest priority)
      const hasOpenModal = document.querySelector('.modal-overlay, .report-expand-overlay, .modal, .popup');
      if (hasOpenModal) {
        console.log('[BackButton] Modal detected, closing modal');
        // Close modal by clicking backdrop or close button
        const closeButton = document.querySelector('.close-button, .modal-close, button[aria-label="Close"]');
        if (closeButton) {
          closeButton.click();
        }
        return; // Don't exit app, just close modal
      }
      
      // If NOT on dashboard, navigate back to dashboard
      if (location.pathname !== '/') {
        console.log('[BackButton] Navigating to dashboard');
        navigate('/');
        return; // Don't exit app, navigate instead
      }
      
      // If on dashboard, allow default back button behavior (exit app)
      console.log('[BackButton] On dashboard, allowing app exit');
      CapApp.exitApp();
    };
    
    // Listen to back button event
    const listener = CapApp.addListener('backButton', handleBackButton);
    
    console.log('[BackButton] Listener attached');
    
    // Cleanup listener on unmount
    return () => {
      console.log('[BackButton] Removing listener');
      listener.then(l => l.remove());
    };
  }, [navigate, location]);
  
  return null;
}

function App() {
  // Configure status bar for mobile app
  useEffect(() => {
    const configureStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Set overlay mode so content goes under status bar
          await StatusBar.setOverlaysWebView({ overlay: true });
          // Set status bar style to light (white icons/text)
          await StatusBar.setStyle({ style: 'light' });
          // Set background color to semi-transparent dark for better visibility
          await StatusBar.setBackgroundColor({ color: '#80000000' }); // 50% transparent black
        } catch (error) {
          console.error('StatusBar configuration error:', error);
        }
      }
    };
    configureStatusBar();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthWrapperProvider>
          <AlertProvider>
            <Router>
              <ScrollToTop />
              <AndroidBackButton />
              <div className="App">
                <OfflineIndicator />
                <Toast />
                <Routes>
              {/* Dashboard - accessible to all authenticated users */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Products - view for all, edit for manager+, delete for admin only */}
              <Route path="/products" element={
                <ProtectedRoute module="products">
                  <Products />
                </ProtectedRoute>
              } />
              
              {/* Sales - view/create for all, edit for manager+, delete for admin only */}
              <Route path="/sales" element={
                <ProtectedRoute module="sales">
                  <Sales />
                </ProtectedRoute>
              } />
              
              {/* Purchases - view for all, create/edit for manager+, delete for admin only */}
              <Route path="/purchases" element={
                <ProtectedRoute module="purchases">
                  <Purchases />
                </ProtectedRoute>
              } />
              
              {/* Hutang - view for all, manage for manager+, delete for admin only */}
              <Route path="/hutang" element={
                <ProtectedRoute module="hutang">
                  <Hutang />
                </ProtectedRoute>
              } />
              
              {/* Shop - manager and admin only */}
              <Route path="/shop" element={
                <ProtectedRoute requiredRole={['manager', 'admin']} module="shop">
                  <Shop />
                </ProtectedRoute>
              } />
              
              {/* Analytics - manager and admin only */}
              <Route path="/analytics" element={
                <ProtectedRoute requiredRole={['manager', 'admin']} module="analytics">
                  <Analytics />
                </ProtectedRoute>
              } />
              
              {/* Stock Monitoring - manager and admin only */}
              <Route path="/stock-monitoring" element={
                <ProtectedRoute requiredRole={['manager', 'admin']} module="analytics">
                  <StockMonitoring />
                </ProtectedRoute>
              } />
              
              {/* Reports - manager and admin only */}
              <Route path="/reports" element={
                <ProtectedRoute requiredRole={['manager', 'admin']} module="reports">
                  <Reports />
                </ProtectedRoute>
              } />
              
              {/* Settings - all users can view, but different content based on role */}
              <Route path="/settings" element={
                <ProtectedRoute module="settings">
                  <Settings />
                </ProtectedRoute>
              } />
              
              {/* Change Password - accessible to all authenticated users except cashier */}
              <Route path="/change-password" element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              } />
              
              {/* Request Changes - accessible to all authenticated users */}
              <Route path="/request-changes" element={
                <ProtectedRoute>
                  <RequestChanges />
                </ProtectedRoute>
              } />
              
              {/* Admin Requests - admin only */}
              <Route path="/admin-requests" element={
                <ProtectedRoute requiredRole={['admin']}>
                  <AdminRequests />
                </ProtectedRoute>
              } />
              
              {/* Data Cleanup - admin only, temporary route */}
              <Route path="/data-cleanup" element={
                <ProtectedRoute requiredRole={['admin']}>
                  <DataCleanup />
                </ProtectedRoute>
              } />
            </Routes>
            <InstallPrompt />
          </div>
        </Router>
        </AlertProvider>
      </AuthWrapperProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
