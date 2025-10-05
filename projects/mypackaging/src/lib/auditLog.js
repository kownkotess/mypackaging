import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Log activities and system events for audit trail
 * @param {string} action - The action being performed (e.g., 'stock_alert', 'reorder_point_update')
 * @param {string} actor - Who performed the action ('system', 'user', email, etc.)
 * @param {string} description - Human readable description of the action
 * @param {string} category - Category of action ('alert', 'update', 'action', 'error')
 * @param {object} metadata - Additional data about the action
 */
export const logActivity = async (action, actor, description, category = 'action', metadata = {}) => {
  try {
    const logEntry = {
      action,
      actor,
      userEmail: actor, // For compatibility with audit viewer
      description,
      details: description, // For compatibility with audit viewer
      category,
      metadata,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      source: 'mypackaging_system'
    };

    // Add to audit log collection
    await addDoc(collection(db, 'auditLogs'), logEntry);
    
    // Also log to console for development
    console.log(`[AUDIT] ${category.toUpperCase()}: ${action} by ${actor} - ${description}`, metadata);
    
  } catch (error) {
    // Don't throw errors for audit logging failures to avoid breaking main functionality
    console.warn('Failed to write audit log:', error);
    console.log(`[AUDIT-FAILED] ${category.toUpperCase()}: ${action} by ${actor} - ${description}`, metadata);
  }
};

/**
 * Log stock-related activities
 */
export const logStock = {
  alert: (productName, currentStock, reorderPoint, urgency) => 
    logActivity(
      'stock_alert', 
      'system', 
      `Stock alert generated for ${productName}`, 
      'alert',
      { productName, currentStock, reorderPoint, urgency }
    ),
    
  reorderUpdate: (productName, oldPoint, newPoint, updatedBy) =>
    logActivity(
      'reorder_point_update',
      updatedBy || 'user',
      `Reorder point updated for ${productName} from ${oldPoint} to ${newPoint}`,
      'update',
      { productName, oldReorderPoint: oldPoint, newReorderPoint: newPoint }
    ),
    
  levelChange: (productName, oldStock, newStock, reason) =>
    logActivity(
      'stock_level_change',
      'system',
      `Stock level changed for ${productName} from ${oldStock} to ${newStock} - ${reason}`,
      'update',
      { productName, oldStock, newStock, reason }
    )
};

/**
 * Log sales-related activities
 */
export const logSales = {
  created: (saleId, customerName, total, paymentMethod) =>
    logActivity(
      'sale_created',
      'user',
      `Sale created for ${customerName || 'Walk-in'} - RM ${total}`,
      'action',
      { saleId, customerName, total, paymentMethod }
    ),
    
  updated: (saleId, changes, updatedBy) =>
    logActivity(
      'sale_updated',
      updatedBy || 'user',
      `Sale ${saleId} updated`,
      'update',
      { saleId, changes }
    ),
    
  deleted: (saleId, reason, deletedBy) =>
    logActivity(
      'sale_deleted',
      deletedBy || 'user',
      `Sale ${saleId} deleted - ${reason}`,
      'action',
      { saleId, reason }
    )
};

/**
 * Log email-related activities
 */
export const logEmail = {
  sent: (emailType, recipient, subject) =>
    logActivity(
      'email_sent',
      'system',
      `${emailType} email sent to ${recipient}`,
      'action',
      { emailType, recipient, subject }
    ),
    
  failed: (emailType, recipient, error) =>
    logActivity(
      'email_failed',
      'system',
      `Failed to send ${emailType} email to ${recipient}`,
      'error',
      { emailType, recipient, error: error.message }
    ),
    
  queued: (emailType, recipient) =>
    logActivity(
      'email_queued',
      'system',
      `${emailType} email queued for ${recipient}`,
      'action',
      { emailType, recipient }
    )
};

/**
 * Log user activities
 */
export const logUser = {
  login: (email, role) =>
    logActivity(
      'user_login',
      email,
      `User logged in with role: ${role}`,
      'action',
      { email, role }
    ),
    
  logout: (email) =>
    logActivity(
      'user_logout',
      email,
      'User logged out',
      'action',
      { email }
    ),
    
  roleChanged: (email, oldRole, newRole, changedBy) =>
    logActivity(
      'user_role_changed',
      changedBy || 'admin',
      `User ${email} role changed from ${oldRole} to ${newRole}`,
      'update',
      { email, oldRole, newRole }
    ),
    
  passwordReset: (email) =>
    logActivity(
      'password_reset_requested',
      email,
      'Password reset requested',
      'action',
      { email }
    )
};

/**
 * Log system events
 */
export const logSystem = {
  error: (component, error, context) =>
    logActivity(
      'system_error',
      'system',
      `Error in ${component}: ${error.message}`,
      'error',
      { component, error: error.message, stack: error.stack, context }
    ),
    
  warning: (component, message, context) =>
    logActivity(
      'system_warning',
      'system',
      `Warning in ${component}: ${message}`,
      'warning',
      { component, message, context }
    ),
    
  info: (component, message, context) =>
    logActivity(
      'system_info',
      'system',
      `Info from ${component}: ${message}`,
      'info',
      { component, message, context }
    )
};

/**
 * Get audit logs (for admin viewing)
 * @param {number} limit - Number of logs to retrieve
 * @param {string} category - Filter by category
 */
export const getAuditLogs = async (limit = 100, category = null) => {
  try {
    const { query, orderBy, getDocs, where } = await import('firebase/firestore');
    
    let q = query(
      collection(db, 'auditLogs'),
      orderBy('timestamp', 'desc')
    );
    
    if (category) {
      q = query(q, where('category', '==', category));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    }));
    
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error);
    return [];
  }
};

const auditLogService = {
  logActivity,
  logStock,
  logSales,
  logEmail,
  logUser,
  logSystem,
  getAuditLogs
};

export default auditLogService;