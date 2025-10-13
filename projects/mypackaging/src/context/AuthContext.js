import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Role hierarchy and permissions
export const ROLES = {
  STAFF: 'staff',
  MANAGER: 'manager', 
  ADMIN: 'admin'
};

export const PERMISSIONS = {
  // Product permissions
  VIEW_PRODUCTS: 'view_products',
  ADD_PRODUCTS: 'add_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',
  
  // Sales permissions
  VIEW_SALES: 'view_sales',
  CREATE_SALES: 'create_sales',
  EDIT_SALES: 'edit_sales',
  DELETE_SALES: 'delete_sales',
  
  // Purchase permissions
  VIEW_PURCHASES: 'view_purchases',
  CREATE_PURCHASES: 'create_purchases',
  EDIT_PURCHASES: 'edit_purchases',
  DELETE_PURCHASES: 'delete_purchases',
  
  // Hutang/Credit permissions
  VIEW_HUTANG: 'view_hutang',
  MANAGE_HUTANG: 'manage_hutang',
  APPROVE_CREDIT: 'approve_credit',
  
  // Analytics and reporting
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_REPORTS: 'view_reports',
  EXPORT_DATA: 'export_data',
  
  // Administrative permissions
  MANAGE_USERS: 'manage_users',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  SYSTEM_SETTINGS: 'system_settings',
  BACKUP_DATA: 'backup_data'
};

// Role-based permission mapping
export const ROLE_PERMISSIONS = {
  [ROLES.STAFF]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.CREATE_SALES,
    PERMISSIONS.VIEW_PURCHASES,
    PERMISSIONS.VIEW_HUTANG
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.ADD_PRODUCTS,
    PERMISSIONS.EDIT_PRODUCTS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.CREATE_SALES,
    PERMISSIONS.EDIT_SALES,
    PERMISSIONS.VIEW_PURCHASES,
    PERMISSIONS.CREATE_PURCHASES,
    PERMISSIONS.EDIT_PURCHASES,
    PERMISSIONS.VIEW_HUTANG,
    PERMISSIONS.MANAGE_HUTANG,
    PERMISSIONS.APPROVE_CREDIT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_DATA
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS) // Admin has all permissions
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get user role from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        
        // Set user online status
        try {
          await updateDoc(userDocRef, {
            isOnline: true,
            lastSeen: serverTimestamp()
          });
        } catch (error) {
          console.error('Error updating online status:', error);
        }

        // Subscribe to user document for real-time role updates
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            const role = userData.role || ROLES.STAFF; // Default to staff
            setUserRole(role);
            setUserPermissions(ROLE_PERMISSIONS[role] || []);
          } else {
            // If user document doesn't exist, create it with default role
            setUserRole(ROLES.STAFF);
            setUserPermissions(ROLE_PERMISSIONS[ROLES.STAFF]);
          }
          setUser(user);
          setLoading(false);
        });

        // Set up heartbeat to update last seen every 5 minutes
        const heartbeatInterval = setInterval(async () => {
          try {
            await updateDoc(userDocRef, {
              lastSeen: serverTimestamp()
            });
          } catch (error) {
            console.error('Error updating heartbeat:', error);
          }
        }, 5 * 60 * 1000); // 5 minutes

        // Handle browser/tab close to set user offline
        const handleBeforeUnload = async () => {
          try {
            await updateDoc(userDocRef, {
              isOnline: false,
              lastSeen: serverTimestamp()
            });
          } catch (error) {
            console.error('Error setting offline status:', error);
          }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
          unsubscribeUser();
          clearInterval(heartbeatInterval);
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      } else {
        setUser(null);
        setUserRole(null);
        setUserPermissions([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      // Set user offline before signing out
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          await updateDoc(userDocRef, {
            isOnline: false,
            lastSeen: serverTimestamp()
          });
        } catch (error) {
          console.error('Error updating offline status:', error);
        }
      }
      
      await signOut(auth);
      setUser(null);
      setUserRole(null);
      setUserPermissions([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Permission checking functions
  const hasPermission = (permission) => {
    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => userPermissions.includes(permission));
  };

  const hasAllPermissions = (permissions) => {
    return permissions.every(permission => userPermissions.includes(permission));
  };

  const hasRole = (role) => {
    return userRole === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(userRole);
  };

  const isAtLeastRole = (role) => {
    const roleHierarchy = [ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    return userRoleIndex >= requiredRoleIndex;
  };

  const value = {
    user,
    userRole,
    userPermissions,
    loading,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isAtLeastRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
