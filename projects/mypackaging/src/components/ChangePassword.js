import React, { useState } from 'react';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContextWrapper';
import './ChangePassword.css';

const ChangePassword = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Check if user can change password (all except cashier)
  const canChangePassword = user?.email !== 'cashier@mypackaging.com';

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!canChangePassword) {
      setError('Password changes are not allowed for this account. Contact your administrator.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setMessage('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) {
      console.error('Password change error:', error);
      
      switch (error.code) {
        case 'auth/wrong-password':
          setError('Current password is incorrect');
          break;
        case 'auth/weak-password':
          setError('New password is too weak');
          break;
        case 'auth/requires-recent-login':
          setError('Please log out and log back in before changing your password');
          break;
        default:
          setError('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) return;
    
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      setError('Failed to send password reset email');
    }
  };

  if (!canChangePassword) {
    return (
      <div className="change-password-container">
        <div className="change-password-card">
          <h2>🔒 Change Password</h2>
          <div className="restriction-notice">
            <div className="notice-icon">⚠️</div>
            <div className="notice-content">
              <h3>Password Change Restricted</h3>
              <p>Password changes are not allowed for the cashier account for security reasons.</p>
              <p>If you need to change your password, please contact your administrator or manager.</p>
            </div>
          </div>
          <div className="admin-contact">
            <h4>Contact Information:</h4>
            <ul>
              <li>Admin: admin@mypackaging.com</li>
              <li>Manager: khairul@mypackaging.com</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="change-password-container">
      <div className="change-password-card">
        <h2>🔒 Change Password</h2>
        <p className="change-password-description">
          Update your account password. You'll need to enter your current password to confirm the change.
        </p>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handlePasswordChange} className="change-password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={loading}
              className="form-input"
              placeholder="Enter your current password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              className="form-input"
              placeholder="Enter new password (min 6 characters)"
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="form-input"
              placeholder="Confirm your new password"
              minLength="6"
            />
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary change-password-btn"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

        <div className="alternative-options">
          <hr />
          <p className="forgot-password-text">
            Forgot your current password?
          </p>
          <button 
            type="button" 
            onClick={handleForgotPassword}
            className="btn btn-secondary forgot-password-btn"
            disabled={loading}
          >
            Send Password Reset Email
          </button>
        </div>

        <div className="security-notes">
          <h4>Password Security Tips:</h4>
          <ul>
            <li>Use at least 8 characters</li>
            <li>Include uppercase and lowercase letters</li>
            <li>Add numbers and special characters</li>
            <li>Don't reuse old passwords</li>
            <li>Keep your password confidential</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;