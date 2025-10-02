import React from 'react';
import { useAuth } from '../context/AuthContextWrapper';
import SignIn from './SignIn';

const ProtectedRoute = ({ children, requiredRole, requiredPermission, module, action }) => {
  const { user, userRole, hasPermission, hasRole, canAccess } = useAuth();
  
  // If user is not logged in, show sign in page
  if (!user) {
    return <SignIn />;
  }
  
  // If specific role is required
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
          <p>Required role: {Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole}</p>
          <p>Your role: {userRole}</p>
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  // If specific permission is required
  if (requiredPermission && module && action && !hasPermission(module, action)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>Access Denied</h2>
          <p>You don't have permission to perform this action.</p>
          <p>Required permission: {action} on {module}</p>
          <p>Your role: {userRole}</p>
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  // If module access is required
  if (module && !canAccess(module)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>Access Denied</h2>
          <p>You don't have access to the {module} module.</p>
          <p>Your role: {userRole}</p>
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return children;
};

export default ProtectedRoute;
