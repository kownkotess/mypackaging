import React, { createContext, useContext } from 'react';
import { useAuth as useOriginalAuth } from './AuthContext';

const AuthWrapperContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthWrapperContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthWrapperProvider');
  }
  return context;
};

export const AuthWrapperProvider = ({ children }) => {
  const originalAuth = useOriginalAuth();
  
  // Email-based role override
  const getEmailBasedRole = (email) => {
    const roleMapping = {
      'admin@mypackaging.com': 'admin',
      'khairul@mypackaging.com': 'manager',
      'yeen@mypackaging.com': 'manager',
      'shazila@mypackaging.com': 'manager', 
      'masliza@mypackaging.com': 'manager',
      'cashier@mypackaging.com': 'staff'
    };
    return roleMapping[email] || 'outsider'; // Changed from 'staff' to 'outsider'
  };

  // Permission matrix
  const PERMISSIONS = {
    admin: {
      products: ['view', 'create', 'edit', 'delete'],
      sales: ['view', 'create', 'edit', 'delete'],
      purchases: ['view', 'create', 'edit', 'delete'],
      hutang: ['view', 'create', 'edit', 'delete'],
      reports: ['view', 'create', 'edit', 'delete'],
      analytics: ['view', 'create', 'edit', 'delete'],
      settings: ['view', 'create', 'edit', 'delete'],
      users: ['view', 'create', 'edit', 'delete']
    },
    manager: {
      products: ['view', 'create', 'edit'],
      sales: ['view', 'create', 'edit'],
      purchases: ['view', 'create', 'edit'],
      hutang: ['view', 'create', 'edit'],
      reports: ['view', 'create'],
      analytics: ['view']
    },
    staff: {
      sales: ['view', 'create'],
      hutang: ['view', 'edit']
    },
    outsider: {
      dashboard: ['view'] // Only dashboard access, no other modules
    }
  };

  // Override role based on email
  const userRole = originalAuth.user?.email ? getEmailBasedRole(originalAuth.user.email) : null;
  const userPermissions = userRole ? PERMISSIONS[userRole] || {} : {};

  // Create enhanced auth context
  const enhancedAuth = {
    ...originalAuth,
    userRole,
    userPermissions,
    hasPermission: (module, action) => {
      if (!userPermissions || !module || !action) return false;
      if (!userPermissions[module]) return false;
      return userPermissions[module].includes(action);
    },
    hasRole: (roles) => {
      if (!userRole || !roles) return false;
      if (typeof roles === 'string') {
        return userRole === roles;
      }
      if (Array.isArray(roles)) {
        return roles.includes(userRole);
      }
      return false;
    },
    canAccess: (module) => {
      if (!userPermissions || !module) return false;
      if (!userPermissions[module]) return false;
      return userPermissions[module].length > 0;
    }
  };

  return (
    <AuthWrapperContext.Provider value={enhancedAuth}>
      {children}
    </AuthWrapperContext.Provider>
  );
};