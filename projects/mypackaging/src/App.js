import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './components/RoleBasedAccess.css';
import { AuthProvider } from './context/AuthContext';
import { AuthWrapperProvider } from './context/AuthContextWrapper';
import { AlertProvider } from './context/AlertContext';
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

function App() {
  return (
    <AuthProvider>
      <AuthWrapperProvider>
        <AlertProvider>
          <Router>
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
  );
}

export default App;
