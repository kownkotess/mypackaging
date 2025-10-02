import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();

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
          <h1>MyPackaging Shop System</h1>
          <div className="user-info">
            <span>Welcome, {user?.email}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          <Link to="/products" className="dashboard-card">
            <div className="card-icon">📦</div>
            <h3>Inventory</h3>
            <p>Manage your products and stock levels</p>
            <button className="card-btn">View Products</button>
          </Link>

          <Link to="/sales" className="dashboard-card">
            <div className="card-icon">🛒</div>
            <h3>Sales</h3>
            <p>Record new sales and transactions</p>
            <button className="card-btn">New Sale</button>
          </Link>

          <Link to="/purchases" className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3>Purchases</h3>
            <p>Track incoming stock and suppliers</p>
            <button className="card-btn">Add Purchase</button>
          </Link>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Hutang</h3>
            <p>Manage credit and payment tracking</p>
            <button className="card-btn">View Credits</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Reports</h3>
            <p>Sales history and business analytics</p>
            <button className="card-btn">View Reports</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⚙️</div>
            <h3>Settings</h3>
            <p>Configure system preferences</p>
            <button className="card-btn">Settings</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;