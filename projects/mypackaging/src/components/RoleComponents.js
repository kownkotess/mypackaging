import React from 'react';
import { useAuth } from '../context/AuthContextWrapper';



/**
 * RequirePermission Component
 * Conditionally renders children based on specific permissions
 */
export const RequirePermission = ({ 
  children, 
  module, 
  action, 
  fallback = null,
  showMessage = false 
}) => {
  const authContext = useAuth();
  
  // Handle loading state or context not available
  if (!authContext) {
    return fallback;
  }
  
  const { userRole, hasPermission } = authContext;
  
  // Handle case where hasPermission is not available (loading state)
  if (!hasPermission || typeof hasPermission !== 'function') {
    return fallback;
  }
  
  if (!hasPermission(module, action)) {
    if (showMessage) {
      return (
        <div className="permission-message">
          <p>Permission required: {action} on {module}</p>
          <p>Your role: {userRole}</p>
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

/**
 * RoleBasedComponent Component
 * Renders different content based on user role
 */
export const RoleBasedComponent = ({ roleContent, defaultContent = null }) => {
  const authContext = useAuth();
  
  // Handle loading state or context not available
  if (!authContext) {
    return defaultContent;
  }
  
  const { userRole } = authContext;
  
  if (roleContent[userRole]) {
    return roleContent[userRole];
  }
  
  return defaultContent;
};

/**
 * CanAccess Component
 * Conditionally renders children based on module access
 */
export const CanAccess = ({ 
  children, 
  module, 
  fallback = null,
  showMessage = false 
}) => {
  const authContext = useAuth();
  
  // Handle loading state or context not available
  if (!authContext) {
    return fallback;
  }
  
  const { userRole, canAccess } = authContext;
  
  // Handle case where canAccess is not available (loading state)
  if (!canAccess || typeof canAccess !== 'function') {
    return fallback;
  }
  
  if (!canAccess(module)) {
    if (showMessage) {
      return (
        <div className="access-message">
          <p>No access to {module} module</p>
          <p>Your role: {userRole}</p>
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

/**
 * RoleGate Component
 * Advanced component that combines multiple access controls
 */
export const RoleGate = ({ 
  children,
  requiredRoles,
  requiredPermissions = [],
  requiredModules = [],
  operator = 'AND', // 'AND' or 'OR'
  fallback = null,
  showMessage = false
}) => {
  const authContext = useAuth();
  
  // Handle loading state or context not available
  if (!authContext) {
    return fallback;
  }
  
  const { userRole, hasRole, hasPermission, canAccess } = authContext;
  
  // Handle case where functions are not available (loading state)
  if (!hasRole || !hasPermission || !canAccess || 
      typeof hasRole !== 'function' || 
      typeof hasPermission !== 'function' || 
      typeof canAccess !== 'function') {
    return fallback;
  }
  
  let hasRoleAccess = true;
  let hasPermissionAccess = true;
  let hasModuleAccess = true;
  
  // Check role requirements
  if (requiredRoles) {
    hasRoleAccess = hasRole(requiredRoles);
  }
  
  // Check permission requirements
  if (requiredPermissions.length > 0) {
    if (operator === 'AND') {
      hasPermissionAccess = requiredPermissions.every(perm => 
        hasPermission(perm.module, perm.action)
      );
    } else {
      hasPermissionAccess = requiredPermissions.some(perm => 
        hasPermission(perm.module, perm.action)
      );
    }
  }
  
  // Check module access requirements
  if (requiredModules.length > 0) {
    if (operator === 'AND') {
      hasModuleAccess = requiredModules.every(module => canAccess(module));
    } else {
      hasModuleAccess = requiredModules.some(module => canAccess(module));
    }
  }
  
  // Determine final access based on operator
  let hasAccess;
  if (operator === 'AND') {
    hasAccess = hasRoleAccess && hasPermissionAccess && hasModuleAccess;
  } else {
    hasAccess = hasRoleAccess || hasPermissionAccess || hasModuleAccess;
  }
  
  if (!hasAccess) {
    if (showMessage) {
      return (
        <div className="role-gate-message">
          <p>Access denied</p>
          <p>Your role: {userRole}</p>
          {requiredRoles && <p>Required roles: {Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}</p>}
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

const RoleComponents = {
  RequirePermission,
  RoleBasedComponent,
  CanAccess,
  RoleGate
};

export default RoleComponents;