import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextWrapper';
import { CanAccess } from './RoleComponents';
import NotificationDropdown from './NotificationDropdown';
import DashboardAlerts from './DashboardAlerts';
import SyncStatus from './SyncStatus';
import ConflictResolution from './ConflictResolution';
import SwipeableDrawer from './SwipeableDrawer';
import offlineDataService from '../lib/offlineDataService';
import logo from '../assets/logo.png';
import './Dashboard.css';

const Dashboard = () => {
  const { user, userRole, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Test function to add sample offline data
  const addTestData = async () => {
    try {
      await offlineDataService.init();
      
      // Add a test pending sale
      await offlineDataService.storePendingSale({
        total: 25.99,
        items: [
          { name: 'Test Product', quantity: 2, price: 12.99 }
        ],
        paymentMethod: 'cash',
        customerName: 'Test Customer'
      });
      
      // Add a test inventory update
      await offlineDataService.storePendingInventoryUpdate({
        productId: 'test-product-123',
        type: 'adjustment',
        quantity: 10,
        reason: 'Stock adjustment test'
      });
      
      console.log('Test data added successfully');
      alert('Test data added! Check sync status.');
      
      // Refresh the page to see updated sync status
      window.location.reload();
    } catch (error) {
      console.error('Error adding test data:', error);
      alert('Error adding test data. Check console.');
    }
  };

  // Function to clear all test/pending data
  const clearTestData = async () => {
    try {
      const confirm = window.confirm('Are you sure you want to clear all pending sync data? This action cannot be undone.');
      if (!confirm) return;

      await offlineDataService.init();
      
      // Clear all pending data
      await offlineDataService.clearAllPendingData();
      
      console.log('Test data cleared successfully');
      alert('All pending data cleared!');
      
      // Refresh the page to see updated sync status
      window.location.reload();
    } catch (error) {
      console.error('Error clearing test data:', error);
      alert('Error clearing test data. Check console.');
    }
  };

  return (
    <div className="dashboard">
      {/* Swipeable Drawer - shown only on mobile/tablet */}
      <SwipeableDrawer />
      
      {/* Desktop Header - hidden on mobile */}
      <header className="dashboard-header desktop-only">
        <div className="header-content">
          <div className="logo-title-container">
            <img src={logo} alt="MyPackaging Logo" className="logo" />
            <div className="title-container">
              <span className="main-title">MYPACKAGING</span>
              <span className="sub-title">bybellestore</span>
            </div>
          </div>
          <div className="user-info">
            <span>Welcome, {user?.email}</span>
            <span className={`role-badge ${userRole}`}>{userRole}</span>
            <NotificationDropdown />
            <Link to="/change-password" className="change-password-link">
              🔐 Change Password
            </Link>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Dashboard Alert Center */}
        <DashboardAlerts />

        {/* Sync Status Panel */}
        <div className="sync-panel">
          <SyncStatus compact={true} />
          {(userRole === 'admin' || userRole === 'manager') && (
            <div style={{ display: 'flex', gap: '10px', marginLeft: '10px' }}>
              <button 
                onClick={addTestData}
                className="test-data-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: '#ffc107',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Test Data
              </button>
              <button 
                onClick={clearTestData}
                className="clear-data-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear Test Data
              </button>
            </div>
          )}
        </div>

        {/* Role Information Panel */}
        <div className="role-info-panel">
          <div>
            <div className="role-title">Your Role: {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}</div>
            <div className="role-description">
              {userRole === 'admin' && 'Full system access with user management capabilities'}
              {userRole === 'manager' && 'Manage inventory, sales, and view reports'}
              {userRole === 'staff' && 'Create sales and view basic information'}
              {userRole === 'outsider' && '⚠️ Limited access - Contact admin@mypackaging.com for role upgrade'}
            </div>
          </div>
        </div>

        {/* Outsider Welcome Message */}
        {userRole === 'outsider' && (
          <div className="outsider-welcome">
            <div className="welcome-card">
              <h2>🔐 Welcome to MyPackaging System</h2>
              <p>Your account has been created successfully, but you currently have limited access.</p>
              <div className="access-info">
                <h3>Current Access Level: <span className="role-badge outsider">Outsider</span></h3>
                <ul>
                  <li>✅ View this dashboard</li>
                  <li>✅ Change your password</li>
                  <li>❌ Access business operations (Sales, Inventory, etc.)</li>
                </ul>
              </div>
              <div className="upgrade-info">
                <h3>Need More Access?</h3>
                <p>Contact your system administrator to upgrade your role:</p>
                <div className="contact-info">
                  <strong>📧 admin@mypackaging.com</strong>
                </div>
                <p><small>Please provide your email address ({user?.email}) when requesting access.</small></p>
              </div>
            </div>
          </div>
        )}

        {/* Conflict Resolution Section - Show for all authenticated users */}
        <CanAccess module="dashboard">
          <div className="conflicts-section">
            <ConflictResolution />
          </div>
        </CanAccess>

        <div className="dashboard-grid">{userRole !== 'outsider' && (
          <>
          {/* Products - All roles can view, manager+ can edit */}
          <CanAccess module="products">
            <Link to="/products" className="dashboard-card">
              <div className="card-icon">📦</div>
              <h3>Inventory</h3>
              <p>Manage your products and stock levels</p>
              <button className="card-btn">View Products</button>
            </Link>
          </CanAccess>

          {/* Sales - All roles can view and create */}
          <CanAccess module="sales">
            <Link to="/sales" className="dashboard-card">
              <div className="card-icon">🛒</div>
              <h3>Sales</h3>
              <p>Record new sales and transactions</p>
              <button className="card-btn">New Sale</button>
            </Link>
          </CanAccess>

          {/* Purchases & Returns - All can view, manager+ can create/edit */}
          <CanAccess module="purchases">
            <Link to="/purchases" className="dashboard-card">
              <div className="card-icon">📋</div>
              <h3>Purchases & Returns</h3>
              <p>Track stock in/out and suppliers</p>
              <button className="card-btn">Manage</button>
            </Link>
          </CanAccess>

          {/* Hutang - All roles can view, manager+ can manage */}
          <CanAccess module="hutang">
            <Link to="/hutang" className="dashboard-card">
              <div className="card-icon">💳</div>
              <h3>Hutang</h3>
              <p>Manage credit and payment tracking</p>
              <button className="card-btn">View Credits</button>
            </Link>
          </CanAccess>

          {/* Shop - Manager and Admin only */}
          <CanAccess module="shop">
            <Link to="/shop" className="dashboard-card">
              <div className="card-icon">🏪</div>
              <h3>Shop Management</h3>
              <p>Shop use, transfers, and stock audits</p>
              <button className="card-btn">Manage</button>
            </Link>
          </CanAccess>

          {/* Analytics - Manager and Admin only */}
          <CanAccess module="analytics">
            <Link to="/analytics" className="dashboard-card">
              <div className="card-icon">📊</div>
              <h3>Analytics</h3>
              <p>Advanced reporting and business insights</p>
              <button className="card-btn">View Analytics</button>
            </Link>
          </CanAccess>

          {/* Stock Monitoring - Manager and Admin only */}
          <CanAccess module="analytics">
            <Link to="/stock-monitoring" className="dashboard-card">
              <div className="card-icon">📈</div>
              <h3>Stock Monitoring</h3>
              <p>Real-time inventory alerts and monitoring</p>
              <button className="card-btn">Monitor Stock</button>
            </Link>
          </CanAccess>

          {/* Reports - Manager and Admin only */}
          <CanAccess module="reports">
            <Link to="/reports" className="dashboard-card">
              <div className="card-icon">📈</div>
              <h3>Reports</h3>
              <p>Comprehensive business reports and exports</p>
              <button className="card-btn">View Reports</button>
            </Link>
          </CanAccess>

          {/* Settings - All users can access */}
          <CanAccess module="settings">
            <Link to="/settings" className="dashboard-card">
              <div className="card-icon">⚙️</div>
              <h3>Settings</h3>
              <p>Configure system preferences</p>
              <button className="card-btn">Settings</button>
            </Link>
          </CanAccess>
          </>
        )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
