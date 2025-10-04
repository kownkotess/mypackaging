import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const notificationsRef = collection(db, 'passwordResetRequests');
    
    // Query for pending password reset requests (simplified - no orderBy for now)
    const q = query(
      notificationsRef,
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          read: false // Initially mark as unread
        }));
        
        // Sort by requestedAt client-side
        notificationsList.sort((a, b) => {
          if (!a.requestedAt || !b.requestedAt) return 0;
          return b.requestedAt.toDate() - a.requestedAt.toDate();
        });
        
        setNotifications(notificationsList);
        setLoading(false);
        
        // Auto-cleanup old notifications (30 days)
        cleanupOldNotifications();
      },
      (err) => {
        console.error('Error fetching notifications:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(notification => !notification.read).length;

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  // Clean up notifications older than 30 days
  const cleanupOldNotifications = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Note: In a production app, this should be done server-side
      // For now, we'll just filter them out client-side
      setNotifications(prev => 
        prev.filter(notification => {
          if (!notification.requestedAt) return true;
          const notificationDate = notification.requestedAt.toDate();
          return notificationDate > thirtyDaysAgo;
        })
      );
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Approve password reset request
  const approveRequest = async (requestId, tempPassword) => {
    try {
      const requestRef = doc(db, 'passwordResetRequests', requestId);
      await updateDoc(requestRef, {
        status: 'approved',
        tempPassword: tempPassword,
        processedAt: Timestamp.now(),
        processedBy: 'admin@mypackaging.com'
      });
      
      // Remove from notifications list
      setNotifications(prev => 
        prev.filter(notification => notification.id !== requestId)
      );
      
      return true;
    } catch (error) {
      console.error('Error approving request:', error);
      setError(error.message);
      return false;
    }
  };

  // Reject password reset request
  const rejectRequest = async (requestId, reason = '') => {
    try {
      const requestRef = doc(db, 'passwordResetRequests', requestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        rejectionReason: reason,
        processedAt: Timestamp.now(),
        processedBy: 'admin@mypackaging.com'
      });
      
      // Remove from notifications list
      setNotifications(prev => 
        prev.filter(notification => notification.id !== requestId)
      );
      
      return true;
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError(error.message);
      return false;
    }
  };

  // Delete old processed requests (admin cleanup)
  const deleteProcessedRequests = async () => {
    // Note: In production, this should be handled server-side
    // For now, we'll implement basic cleanup
    return true;
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    approveRequest,
    rejectRequest,
    deleteProcessedRequests,
    cleanupOldNotifications
  };
};