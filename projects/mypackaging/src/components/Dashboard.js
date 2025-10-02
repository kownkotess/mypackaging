import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextWrapper';
import { CanAccess } from './RoleComponents';
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
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
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Role Information Panel */}
        <div className="role-info-panel">
          <div>
            <div className="role-title">Your Role: {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}</div>
            <div className="role-description">
              {userRole === 'admin' && 'Full system access with user management capabilities'}
              {userRole === 'manager' && 'Manage inventory, sales, and view reports'}
              {userRole === 'staff' && 'Create sales and view basic information'}
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
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

          {/* Purchases - All can view, manager+ can create/edit */}
          <CanAccess module="purchases">
            <Link to="/purchases" className="dashboard-card">
              <div className="card-icon">📋</div>
              <h3>Purchases</h3>
              <p>Track incoming stock and suppliers</p>
              <button className="card-btn">Add Purchase</button>
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

          {/* Analytics - Manager and Admin only */}
          <CanAccess module="analytics">
            <Link to="/analytics" className="dashboard-card">
              <div className="card-icon">📊</div>
              <h3>Analytics</h3>
              <p>Advanced reporting and business insights</p>
              <button className="card-btn">View Analytics</button>
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
