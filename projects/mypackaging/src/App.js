import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './components/RoleBasedAccess.css';
import { AuthProvider } from './context/AuthContext';
import { AuthWrapperProvider } from './context/AuthContextWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Sales from './components/Sales';
import Purchases from './components/Purchases';
import Hutang from './components/Hutang';
import Analytics from './components/Analytics';
import Reports from './components/ReportsFull';
import Settings from './components/Settings';
import ChangePassword from './components/ChangePassword';

function App() {
  return (
    <AuthProvider>
      <AuthWrapperProvider>
        <Router>
          <div className="App">
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
            
            {/* Analytics - manager and admin only */}
            <Route path="/analytics" element={
              <ProtectedRoute requiredRole={['manager', 'admin']} module="analytics">
                <Analytics />
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
          </Routes>
        </div>
      </Router>
      </AuthWrapperProvider>
    </AuthProvider>
  );
}

export default App;
