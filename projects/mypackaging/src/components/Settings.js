import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import './Settings.css';

const Settings = () => {
  const { user, userRole, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date()
      });
      await fetchUsers(); // Refresh the list
      alert('User role updated successfully!');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && hasRole('admin')) {
      fetchUsers();
    }
  }, [activeTab, hasRole]);

  return (
    <div className="settings">
      <header className="settings-header">
        <div className="header-content">
          <Link to="/" className="back-btn">← Back to Dashboard</Link>
          <h1>Settings</h1>
          <div className="user-role-badge">
            Role: {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
          </div>
        </div>
      </header>

      <main className="settings-main">
        <div className="settings-container">
          <div className="settings-nav">
            <button 
              className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              👤 Profile
            </button>
            
            {(userRole === 'admin' || userRole === 'manager') && (
              <>
                <button 
                  className={`nav-btn ${activeTab === 'system' ? 'active' : ''}`}
                  onClick={() => setActiveTab('system')}
                >
                  ⚙️ System
                </button>
                <button 
                  className={`nav-btn ${activeTab === 'operational' ? 'active' : ''}`}
                  onClick={() => setActiveTab('operational')}
                >
                  📋 Operations
                </button>
              </>
            )}
            
            {userRole === 'admin' && (
              <>
                <button 
                  className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                >
                  👥 Users
                </button>
                <button 
                  className={`nav-btn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  🔒 Security
                </button>
              </>
            )}
          </div>

          <div className="settings-content">
            {activeTab === 'profile' && (
              <ProfileSettings user={user} />
            )}
            
            {activeTab === 'system' && (userRole === 'admin' || userRole === 'manager') && (
              <SystemSettings />
            )}
            
            {activeTab === 'operational' && (userRole === 'admin' || userRole === 'manager') && (
              <OperationalSettings />
            )}
            
            {activeTab === 'users' && userRole === 'admin' && (
              <UserManagement 
                users={users}
                loadingUsers={loadingUsers}
                updateUserRole={updateUserRole}
              />
            )}
            
            {activeTab === 'security' && userRole === 'admin' && (
              <SecuritySettings />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const ProfileSettings = ({ user }) => {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="settings-section">
      <h2>Profile Settings</h2>
      
      <div className="settings-group">
        <h3>Account Information</h3>
        <div className="info-item">
          <label>Email:</label>
          <span>{user?.email}</span>
        </div>
        <div className="info-item">
          <label>User ID:</label>
          <span>{user?.uid}</span>
        </div>
        <div className="info-item">
          <label>Last Sign In:</label>
          <span>{user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'N/A'}</span>
        </div>
      </div>

      <div className="settings-group">
        <h3>Security</h3>
        <button 
          className="btn btn-secondary"
          onClick={() => setShowChangePassword(!showChangePassword)}
        >
          Change Password
        </button>
        {showChangePassword && (
          <div className="change-password-form">
            <p className="note">For security reasons, password changes require re-authentication. Please sign out and use the "Forgot Password" option to reset your password.</p>
          </div>
        )}
      </div>

      <div className="settings-group">
        <h3>Preferences</h3>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            Email notifications
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            Auto-save forms
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" />
            Dark mode (Coming soon)
          </label>
        </div>
      </div>
    </div>
  );
};

const SystemSettings = () => (
  <div className="settings-section">
    <h2>System Configuration</h2>
    
    <div className="settings-group">
      <h3>Business Information</h3>
      <div className="form-group">
        <label>Shop Name:</label>
        <input type="text" defaultValue="MyPackaging by Belle Store" className="form-control" />
      </div>
      <div className="form-group">
        <label>Address:</label>
        <textarea className="form-control" rows="3" placeholder="Enter shop address"></textarea>
      </div>
      <div className="form-group">
        <label>Contact Number:</label>
        <input type="tel" className="form-control" placeholder="+60 12-345 6789" />
      </div>
    </div>

    <div className="settings-group">
      <h3>Regional Settings</h3>
      <div className="form-group">
        <label>Currency:</label>
        <select className="form-control">
          <option value="MYR">Malaysian Ringgit (RM)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="SGD">Singapore Dollar (S$)</option>
        </select>
      </div>
      <div className="form-group">
        <label>Tax Rate (%):</label>
        <input type="number" step="0.01" defaultValue="6.00" className="form-control" />
      </div>
      <div className="form-group">
        <label>Date Format:</label>
        <select className="form-control">
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>
    </div>

    <div className="settings-group">
      <h3>Backup & Recovery</h3>
      <button className="btn btn-primary">Export Data</button>
      <button className="btn btn-secondary">Schedule Backup</button>
      <p className="note">Last backup: Never</p>
    </div>
  </div>
);

const OperationalSettings = () => (
  <div className="settings-section">
    <h2>Operational Settings</h2>
    
    <div className="settings-group">
      <h3>Inventory Alerts</h3>
      <div className="form-group">
        <label>Low Stock Threshold:</label>
        <input type="number" defaultValue="10" className="form-control" />
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Enable low stock notifications
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" />
          Auto-generate purchase orders
        </label>
      </div>
    </div>

    <div className="settings-group">
      <h3>Payment Settings</h3>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Accept cash payments
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Accept online payments
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Allow credit sales (Hutang)
        </label>
      </div>
      <div className="form-group">
        <label>Default Credit Limit (RM):</label>
        <input type="number" defaultValue="1000" className="form-control" />
      </div>
    </div>

    <div className="settings-group">
      <h3>Receipt Settings</h3>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Print receipts automatically
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" />
          Email receipts to customers
        </label>
      </div>
    </div>
  </div>
);

const UserManagement = ({ users, loadingUsers, updateUserRole }) => {
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role || 'staff');
  };

  const handleSaveRole = async () => {
    if (editingUser && newRole) {
      await updateUserRole(editingUser.id, newRole);
      setEditingUser(null);
      setNewRole('');
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewRole('');
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'role-badge admin';
      case 'manager': return 'role-badge manager';
      case 'staff': return 'role-badge staff';
      default: return 'role-badge staff';
    }
  };

  return (
    <div className="settings-section">
      <h2>User Management</h2>
      
      <div className="settings-group">
        <h3>Current Users</h3>
        {loadingUsers ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="user-list">
            {users.map(user => (
              <div key={user.id} className="user-item">
                <div className="user-info">
                  <strong>{user.email}</strong>
                  <span className={getRoleBadgeClass(user.role)}>
                    {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'Staff'}
                  </span>
                  {user.displayName && (
                    <span className="user-display-name">({user.displayName})</span>
                  )}
                </div>
                <div className="user-actions">
                  {editingUser?.id === user.id ? (
                    <div className="edit-role-form">
                      <select 
                        value={newRole} 
                        onChange={(e) => setNewRole(e.target.value)}
                        className="role-select"
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={handleSaveRole}
                        disabled={!newRole}
                      >
                        Save
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEditRole(user)}
                    >
                      Edit Role
                    </button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="empty-state">
                <p>No users found. Users will appear here once they sign in.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="settings-group">
        <h3>Role Permissions</h3>
        <div className="permissions-info">
          <div className="permission-item">
            <strong>Admin:</strong> Full system access including user management, all modules with create/edit/delete permissions
          </div>
          <div className="permission-item">
            <strong>Manager:</strong> Access to inventory, sales, purchases, and reports with create/edit permissions
          </div>
          <div className="permission-item">
            <strong>Staff:</strong> Limited access to sales creation and hutang viewing only
          </div>
        </div>
      </div>
    </div>
  );
};

const SecuritySettings = () => (
  <div className="settings-section">
    <h2>Security & Compliance</h2>
    
    <div className="settings-group">
      <h3>Audit Trail</h3>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Enable audit logging
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Log user actions
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          Log data changes
        </label>
      </div>
      <button className="btn btn-secondary">View Audit Logs</button>
      <button className="btn btn-secondary">Export Audit Report</button>
    </div>

    <div className="settings-group">
      <h3>Session Management</h3>
      <div className="form-group">
        <label>Session Timeout (minutes):</label>
        <select className="form-control">
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="120">2 hours</option>
          <option value="480">8 hours</option>
        </select>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" />
          Force logout on browser close
        </label>
      </div>
    </div>

    <div className="settings-group">
      <h3>Data Protection</h3>
      <div className="form-group">
        <label>Data Retention Period (months):</label>
        <select className="form-control">
          <option value="12">12 months</option>
          <option value="24">24 months</option>
          <option value="36">36 months</option>
          <option value="60">5 years</option>
        </select>
      </div>
      <div className="setting-item">
        <label>
          <input type="checkbox" defaultChecked />
          GDPR compliance mode
        </label>
      </div>
      <button className="btn btn-secondary">Customer Data Request</button>
      <button className="btn btn-danger">Data Deletion Request</button>
    </div>

    <div className="settings-group">
      <h3>Security Monitoring</h3>
      <div className="security-alert">
        <h4>Recent Security Events</h4>
        <p>No security incidents detected in the last 30 days.</p>
      </div>
      <button className="btn btn-primary">Run Security Scan</button>
    </div>
  </div>
);

export default Settings;
