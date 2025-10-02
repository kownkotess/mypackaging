import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>MyPackaging Shop Management System</h1>
        <p>Welcome to your shop management dashboard!</p>
        <div className="quick-links">
          <div className="link-card">
            <h3>📦 Inventory</h3>
            <p>Manage your products</p>
          </div>
          <div className="link-card">
            <h3>🛒 Sales</h3>
            <p>Record new sales</p>
          </div>
          <div className="link-card">
            <h3>📋 Purchases</h3>
            <p>Track incoming stock</p>
          </div>
          <div className="link-card">
            <h3>💳 Hutang</h3>
            <p>Manage credit & payments</p>
          </div>
          <div className="link-card">
            <h3>📊 Dashboard</h3>
            <p>View reports & summary</p>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;