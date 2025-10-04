import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../assets/logo.png';
import './SignIn.css';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setError(getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Add password reset request to Firestore for admin
      await addDoc(collection(db, 'passwordResetRequests'), {
        email: email,
        requestedAt: serverTimestamp(),
        status: 'pending',
        reason: 'User forgot password',
        requestedBy: email
      });

      setMessage('Password reset request sent to admin. You will receive a temporary password via email shortly.');
      setShowForgotPassword(false);
    } catch (error) {
      console.error('Error sending password reset request:', error);
      setError('Failed to send password reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  if (showForgotPassword) {
    return (
      <div className="signin-container">
        <div className="signin-card">
          <div className="signin-header">
            <div className="logo-title-container">
              <img src={logo} alt="MyPackaging Logo" className="logo" />
              <div className="title-container">
                <span className="main-title">MYPACKAGING</span>
                <span className="sub-title">bybellestore</span>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleForgotPassword} className="signin-form">
            <h2>🔐 Forgot Password</h2>
            <p className="forgot-password-description">
              Enter your email address and we'll send a password reset request to the admin. 
              You'll receive a temporary password to access your account.
            </p>
            
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" disabled={loading} className="signin-btn">
                {loading ? 'Sending Request...' : 'Request Password Reset'}
              </button>
              
              <button 
                type="button" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setMessage('');
                }}
                className="link-btn"
                disabled={loading}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <div className="logo-title-container">
            <img src={logo} alt="MyPackaging Logo" className="logo" />
            <div className="title-container">
              <span className="main-title">MYPACKAGING</span>
              <span className="sub-title">bybellestore</span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="signin-form">
          <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
          
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              minLength="6"
            />
          </div>
          
          <button type="submit" disabled={loading} className="signin-btn">
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          {!isSignUp && (
            <div className="forgot-password-link">
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                className="link-btn"
                disabled={loading}
              >
                Forgot your password?
              </button>
            </div>
          )}
          
          <div className="signin-toggle">
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => setIsSignUp(false)}
                  className="link-btn"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => setIsSignUp(true)}
                  className="link-btn"
                >
                  Create Account
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
