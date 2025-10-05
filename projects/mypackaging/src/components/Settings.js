import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';
import { collection, getDocs, doc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import EmailSettings from './EmailSettings';
import businessInfoService from '../services/businessInfoService';
import { getAuditLogs } from '../lib/auditLog';
import './Settings.css';

const Settings = () => {
  const { user, userRole, hasRole } = useAuth();
  const { showSuccess, showError } = useAlert();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [deletingLogs, setDeletingLogs] = useState(false);

  // Check URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['profile', 'system', 'operational', 'email', 'users', 'security'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Function to handle tab change and update URL
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/settings?tab=${tab}`);
  };

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
      showSuccess('User role updated successfully!');
    } catch (error) {
      console.error('Error updating user role:', error);
      showError('Failed to update user role. Please try again.');
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const logs = await getAuditLogs(50); // Get last 50 audit logs
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      showError('Failed to load audit logs. Please try again.');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleViewAuditLogs = () => {
    setShowAuditLogs(true);
    fetchAuditLogs();
  };

  const exportAuditLogs = async () => {
    try {
      const logs = await getAuditLogs(1000); // Get more logs for export
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Category', 'Details', 'IP Address'].join(','),
        ...logs.map(log => [
          log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A',
          log.userEmail || 'System',
          log.action || 'N/A',
          log.category || 'N/A',
          `"${(log.details || '').replace(/"/g, '""')}"`,
          log.ipAddress || 'N/A'
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Audit logs exported successfully!');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      showError('Failed to export audit logs. Please try again.');
    }
  };

  // Handle delete audit logs with admin password verification
  const handleDeleteAuditLogs = () => {
    if (user?.email !== 'admin@mypackaging.com') {
      showError('Only admin@mypackaging.com can delete audit logs');
      return;
    }
    setShowDeleteConfirmation(true);
  };

  // Verify admin password and delete audit logs
  const confirmDeleteAuditLogs = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      showError('Please enter your password');
      return;
    }

    setDeletingLogs(true);
    try {
      // Verify admin password
      await signInWithEmailAndPassword(auth, 'admin@mypackaging.com', adminPassword);
      
      // Get all audit logs
      const auditLogsRef = collection(db, 'auditLogs');
      const snapshot = await getDocs(auditLogsRef);
      
      // Delete in batches of 500 (Firestore limit)
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      // Commit remaining deletes
      if (batchCount > 0) {
        await batch.commit();
      }
      
      showSuccess(`Successfully deleted ${snapshot.size} audit log entries`);
      setShowDeleteConfirmation(false);
      setAdminPassword('');
      setAuditLogs([]);
      
    } catch (error) {
      console.error('Error deleting audit logs:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showError('Invalid password. Please try again.');
      } else {
        showError('Failed to delete audit logs. Please try again.');
      }
    } finally {
      setDeletingLogs(false);
    }
  };

  // Cleanup audit logs older than 6 months
  const cleanupOldAuditLogs = async () => {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const auditLogsRef = collection(db, 'auditLogs');
      const q = query(auditLogsRef, where('timestamp', '<', sixMonthsAgo));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No old audit logs to cleanup');
        return;
      }
      
      // Delete in batches
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      // Commit remaining deletes
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`Cleaned up ${snapshot.size} old audit log entries`);
      
    } catch (error) {
      console.error('Error cleaning up old audit logs:', error);
    }
  };

  // Run cleanup on component mount and when viewing audit logs
  useEffect(() => {
    cleanupOldAuditLogs();
  }, []);

  const exportAllData = async () => {
    try {
      setLoadingUsers(true); // Reuse loading state for feedback
      
      const collections = ['products', 'sales', 'purchases', 'hutang', 'users', 'auditLogs'];
      const allData = {};
      
      for (const collectionName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          allData[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore timestamps to readable dates
            ...(doc.data().createdAt && { createdAt: doc.data().createdAt.toDate?.()?.toISOString() }),
            ...(doc.data().updatedAt && { updatedAt: doc.data().updatedAt.toDate?.()?.toISOString() }),
            ...(doc.data().timestamp && { timestamp: doc.data().timestamp.toDate?.()?.toISOString() })
          }));
        } catch (error) {
          console.warn(`Failed to export ${collectionName}:`, error);
          allData[collectionName] = [];
        }
      }
      
      const jsonData = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mypackaging-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showSuccess('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      showError('Failed to export data. Please try again.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const scheduleBackup = () => {
    showSuccess('Automatic backup scheduling will be available in a future update. For now, please use manual export.');
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
              onClick={() => handleTabChange('profile')}
            >
              👤 Profile
            </button>
            
            {(userRole === 'admin' || userRole === 'manager') && (
              <>
                <button 
                  className={`nav-btn ${activeTab === 'system' ? 'active' : ''}`}
                  onClick={() => handleTabChange('system')}
                >
                  ⚙️ System
                </button>
                <button 
                  className={`nav-btn ${activeTab === 'operational' ? 'active' : ''}`}
                  onClick={() => handleTabChange('operational')}
                >
                  📋 Operations
                </button>
                <button 
                  className={`nav-btn ${activeTab === 'email' ? 'active' : ''}`}
                  onClick={() => handleTabChange('email')}
                >
                  📧 Email Service
                </button>
              </>
            )}
            
            {userRole === 'admin' && (
              <>
                <button 
                  className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => handleTabChange('users')}
                >
                  👥 Users
                </button>
                <button 
                  className={`nav-btn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => handleTabChange('security')}
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
              <SystemSettings 
                onExportData={exportAllData}
                onScheduleBackup={scheduleBackup}
              />
            )}
            
            {activeTab === 'operational' && (userRole === 'admin' || userRole === 'manager') && (
              <OperationalSettings />
            )}
            
            {activeTab === 'email' && (userRole === 'admin' || userRole === 'manager') && (
              <EmailSettings />
            )}
            
            {activeTab === 'users' && userRole === 'admin' && (
              <UserManagement 
                users={users}
                loadingUsers={loadingUsers}
                updateUserRole={updateUserRole}
              />
            )}
            
            {activeTab === 'security' && userRole === 'admin' && (
              <SecuritySettings 
                onViewAuditLogs={handleViewAuditLogs}
                onExportAuditLogs={exportAuditLogs}
              />
            )}
          </div>
        </div>
      </main>

      {/* Audit Logs Modal */}
      {showAuditLogs && (
        <div className="modal-overlay" onClick={() => setShowAuditLogs(false)}>
          <div className="modal-content audit-logs-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Audit Trail</h3>
              <button className="close-btn" onClick={() => setShowAuditLogs(false)}>×</button>
            </div>
            <div className="modal-body">
              {loadingAuditLogs ? (
                <div className="loading">Loading audit logs...</div>
              ) : (
                <div className="audit-logs-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Category</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>
                            No audit logs found
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log, index) => (
                          <tr key={index}>
                            <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
                            <td>{log.userEmail || 'System'}</td>
                            <td>{log.action || 'N/A'}</td>
                            <td>{log.category || 'N/A'}</td>
                            <td>{log.details || 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={exportAuditLogs}>
                📤 Export to CSV
              </button>
              {user?.email === 'admin@mypackaging.com' && (
                <button className="btn btn-danger" onClick={handleDeleteAuditLogs}>
                  🗑️ Delete All Logs
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowAuditLogs(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirmation(false)}>
          <div className="modal-content delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Delete All Audit Logs</h3>
              <button className="close-btn" onClick={() => setShowDeleteConfirmation(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="warning-message">
                <p><strong>⚠️ WARNING:</strong> This action will permanently delete ALL audit logs and cannot be undone.</p>
                <p>Only the admin account can perform this action. Please enter your password to confirm:</p>
              </div>
              <form onSubmit={confirmDeleteAuditLogs} className="delete-form">
                <div className="form-group">
                  <label htmlFor="adminPassword">Admin Password:</label>
                  <input
                    type="password"
                    id="adminPassword"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    disabled={deletingLogs}
                  />
                </div>
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setAdminPassword('');
                    }}
                    disabled={deletingLogs}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-danger"
                    disabled={deletingLogs}
                  >
                    {deletingLogs ? 'Deleting...' : 'Delete All Logs'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
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

const SystemSettings = ({ onExportData, onScheduleBackup }) => {
  const { showSuccess, showError } = useAlert();
  const [businessInfo, setBusinessInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load business information
  const loadBusinessInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await businessInfoService.getBusinessInfo();
      setBusinessInfo(info);
    } catch (error) {
      console.error('Error loading business info:', error);
      showError('Failed to load business information');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadBusinessInfo();
  }, [loadBusinessInfo]);

  const handleInputChange = (field, value) => {
    setBusinessInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      console.log('Saving business info:', businessInfo);
      
      // Validate required fields
      if (!businessInfo.shopName || businessInfo.shopName.trim() === '') {
        showError('Shop name is required');
        return;
      }
      
      if (!businessInfo.email || businessInfo.email.trim() === '') {
        showError('Email is required');
        return;
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(businessInfo.email)) {
        showError('Please enter a valid email address');
        return;
      }
      
      await businessInfoService.updateBusinessInfo(businessInfo);
      showSuccess('Business information updated successfully!');
      setIsEditing(false);
      
      // Reload to confirm the save
      await loadBusinessInfo();
      
    } catch (error) {
      console.error('Error saving business info:', error);
      showError(error.message || 'Failed to save business information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadBusinessInfo(); // Reload original data
  };

  if (loading) {
    return (
      <div className="settings-section">
        <div className="loading-state">Loading business information...</div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>System Configuration</h2>
        <div className="header-actions">
          {!isEditing ? (
            <button 
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
            >
              ✏️ Edit Business Info
            </button>
          ) : (
            <div className="edit-actions">
              <button 
                className="btn btn-success"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                ❌ Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="settings-group">
        <h3>Business Information</h3>
        <div className="business-info-form">
          <div className="form-row">
            <div className="form-group">
              <label>Shop Name: *</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={businessInfo.shopName || ''} 
                  onChange={(e) => handleInputChange('shopName', e.target.value)}
                  className="form-control"
                  placeholder="Enter shop name"
                />
              ) : (
                <div className="form-display">{businessInfo.shopName || 'Not set'}</div>
              )}
            </div>
            <div className="form-group">
              <label>Tagline:</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={businessInfo.tagline || ''} 
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  className="form-control"
                  placeholder="Your business tagline"
                />
              ) : (
                <div className="form-display">{businessInfo.tagline || 'Not set'}</div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Business Address: *</label>
            {isEditing ? (
              <textarea 
                value={businessInfo.address || ''} 
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="form-control" 
                rows="3" 
                placeholder="Enter complete business address&#10;Line 1&#10;Line 2&#10;City, Postal Code"
              />
            ) : (
              <div className="form-display address-display">
                {businessInfo.address ? 
                  businessInfo.address.split('\n').map((line, index) => (
                    <div key={index}>{line}</div>
                  )) : 'Not set'
                }
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Number: *</label>
              {isEditing ? (
                <input 
                  type="tel" 
                  value={businessInfo.phone || ''} 
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="form-control" 
                  placeholder="+60 3-1234 5678"
                />
              ) : (
                <div className="form-display">{businessInfo.phone || 'Not set'}</div>
              )}
            </div>
            <div className="form-group">
              <label>Email Address: *</label>
              {isEditing ? (
                <input 
                  type="email" 
                  value={businessInfo.email || ''} 
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="form-control" 
                  placeholder="info@yourbusiness.com"
                />
              ) : (
                <div className="form-display">{businessInfo.email || 'Not set'}</div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Business Registration Number:</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={businessInfo.registrationNumber || ''} 
                  onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                  className="form-control" 
                  placeholder="SSM-1234567890"
                />
              ) : (
                <div className="form-display">{businessInfo.registrationNumber || 'Not set'}</div>
              )}
            </div>
            <div className="form-group">
              <label>Website:</label>
              {isEditing ? (
                <input 
                  type="url" 
                  value={businessInfo.website || ''} 
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="form-control" 
                  placeholder="www.yourbusiness.com"
                />
              ) : (
                <div className="form-display">{businessInfo.website || 'Not set'}</div>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="info-note">
              <p><strong>Note:</strong> This information will be used in receipts, emails, and other business documents.</p>
              <p><small>Last updated: {businessInfo.updatedAt ? new Date(businessInfo.updatedAt.seconds * 1000).toLocaleString() : 'Never'}</small></p>
            </div>
          )}
        </div>
      </div>

      <div className="settings-group">
        <h3>Regional Settings</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Currency:</label>
            {isEditing ? (
              <select 
                value={businessInfo.currency || 'MYR'} 
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="form-control"
              >
                <option value="MYR">Malaysian Ringgit (RM)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="SGD">Singapore Dollar (S$)</option>
              </select>
            ) : (
              <div className="form-display">{businessInfo.currency || 'MYR'} - Malaysian Ringgit (RM)</div>
            )}
          </div>
          <div className="form-group">
            <label>Tax Rate (%):</label>
            {isEditing ? (
              <input 
                type="number" 
                step="0.01" 
                value={businessInfo.taxRate || 6.00} 
                onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))}
                className="form-control"
                min="0"
                max="100"
              />
            ) : (
              <div className="form-display">{businessInfo.taxRate || 6.00}%</div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Backup & Recovery</h3>
        <div className="backup-actions">
          <button className="btn btn-primary" onClick={onExportData}>📤 Export Data</button>
          <button className="btn btn-secondary" onClick={onScheduleBackup}>⏰ Schedule Backup</button>
        </div>
        <p className="note">Last backup: Never</p>
      </div>
    </div>
  );
};

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

      <PasswordResetRequests />
    </div>
  );
};

const SecuritySettings = ({ onViewAuditLogs, onExportAuditLogs }) => (
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
      <button className="btn btn-secondary" onClick={onViewAuditLogs}>View Audit Logs</button>
      <button className="btn btn-secondary" onClick={onExportAuditLogs}>Export Audit Report</button>
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

const PasswordResetRequests = () => {
  const { showSuccess, showWarning } = useAlert();
  const { notifications, approveRequest, rejectRequest } = useNotifications();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleApprove = async (request) => {
    setProcessing(true);
    const newTempPassword = generateTempPassword();
    
    const success = await approveRequest(request.id, newTempPassword);
    if (success) {
      // In a real app, you would send the temporary password via email
      showSuccess(`Password reset approved! Temporary password: ${newTempPassword}\n\nNote: In production, this would be sent via email.`);
    }
    setProcessing(false);
  };

  const handleReject = async (request) => {
    if (!rejectionReason.trim()) {
      showWarning('Please provide a reason for rejection.');
      return;
    }
    
    setProcessing(true);
    const success = await rejectRequest(request.id, rejectionReason);
    if (success) {
      showSuccess('Password reset request rejected.');
      setRejectionReason('');
      setSelectedRequest(null);
    }
    setProcessing(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return timestamp.toDate().toLocaleString();
  };

  return (
    <div className="settings-group" id="user-management">
      <h3>
        🔔 Password Reset Requests 
        {notifications.length > 0 && (
          <span className="requests-count">({notifications.length} pending)</span>
        )}
      </h3>
      <div className="password-reset-requests">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <p>No pending password reset requests.</p>
          </div>
        ) : (
          <div className="requests-table">
            <div className="table-header">
              <div className="header-cell">User Email</div>
              <div className="header-cell">Requested At</div>
              <div className="header-cell">Reason</div>
              <div className="header-cell">Actions</div>
            </div>
            {notifications.map((request) => (
              <div key={request.id} className="table-row">
                <div className="table-cell">
                  <strong>{request.email}</strong>
                </div>
                <div className="table-cell">
                  {formatDate(request.requestedAt)}
                </div>
                <div className="table-cell">
                  {request.reason || 'User forgot password'}
                </div>
                <div className="table-cell">
                  <div className="request-actions">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleApprove(request)}
                      disabled={processing}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setSelectedRequest(request)}
                      disabled={processing}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h4>Reject Password Reset Request</h4>
            <p>User: <strong>{selectedRequest.email}</strong></p>
            <div className="form-group">
              <label>Reason for rejection:</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason..."
                rows="3"
                className="form-control"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={() => handleReject(selectedRequest)}
                disabled={processing || !rejectionReason.trim()}
              >
                {processing ? 'Processing...' : 'Confirm Rejection'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                disabled={processing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
