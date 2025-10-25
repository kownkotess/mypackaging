import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import emailService from '../services/emailService';

export const useDashboardAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    lowStock: 0,
    outOfStock: 0,
    overduePayments: 0,
    totalOutstanding: 0,
    todaySales: 0,
    recentActivity: 0
  });

  useEffect(() => {
    const unsubscribes = [];
    
    try {
      // Monitor Products for stock alerts
      const productsQuery = query(collection(db, 'products'));
      unsubscribes.push(onSnapshot(productsQuery, (snapshot) => {
        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        processStockAlerts(products);
      }));

      // Monitor Sales for today's activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const salesQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', Timestamp.fromDate(today)),
        orderBy('createdAt', 'desc')
      );
      unsubscribes.push(onSnapshot(salesQuery, (snapshot) => {
        const todaySales = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        processSalesAlerts(todaySales);
      }));

      // Monitor Credit Sales for overdue payments
      const creditSalesQuery = query(
        collection(db, 'sales'),
        where('status', '==', 'Hutang')
      );
      unsubscribes.push(onSnapshot(creditSalesQuery, (snapshot) => {
        const creditSales = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        
        processCreditAlerts(creditSales);
      }));

      setLoading(false);
    } catch (error) {
      console.error('Error setting up dashboard alerts:', error);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const processStockAlerts = (products) => {
    const lowStockProducts = [];
    const outOfStockProducts = [];
    
    products.forEach(product => {
      const stockBalance = product.stockBalance || 0;
      const reorderPoint = product.reorderPoint || 10;
      
      if (stockBalance <= 0) {
        outOfStockProducts.push(product);
      } else if (stockBalance <= reorderPoint) {
        lowStockProducts.push(product);
      }
    });

    // Create stock alerts
    const stockAlerts = [];
    
    if (outOfStockProducts.length > 0) {
      const alert = {
        id: 'out-of-stock',
        type: 'error',
        priority: 'high',
        title: `${outOfStockProducts.length} Products Out of Stock`,
        message: `Critical: ${outOfStockProducts.map(p => p.name).join(', ')} need immediate restocking`,
        icon: '🚨',
        action: '/products',
        actionText: 'Manage Stock',
        timestamp: new Date()
      };
      stockAlerts.push(alert);

      // Send email alert for critical stock issues
      outOfStockProducts.forEach(product => {
        emailService.sendStockAlert({
          productName: product.name,
          currentStock: 0,
          reorderPoint: product.reorderPoint || 10,
          type: 'critical',
          urgency: 'immediate',
          suggestedAction: 'emergency_reorder',
          message: `${product.name} is completely out of stock and requires immediate attention`
        }).catch(error => console.error('Failed to send stock alert email:', error));
      });
    }
    
    if (lowStockProducts.length > 0) {
      const alert = {
        id: 'low-stock',
        type: 'warning',
        priority: 'medium',
        title: `${lowStockProducts.length} Products Low on Stock`,
        message: `Consider reordering: ${lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}${lowStockProducts.length > 3 ? ' and more' : ''}`,
        icon: '⚠️',
        action: '/purchases',
        actionText: 'Create Purchase Order',
        timestamp: new Date()
      };
      stockAlerts.push(alert);

      // Send low stock report email if there are many low stock items
      if (lowStockProducts.length >= 5) {
        emailService.sendLowStockReport([...lowStockProducts, ...outOfStockProducts])
          .catch(error => console.error('Failed to send low stock report:', error));
      }
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockProducts.length
    }));

    // Update alerts
    setAlerts(prev => {
      const nonStockAlerts = prev.filter(alert => 
        !['out-of-stock', 'low-stock'].includes(alert.id)
      );
      return [...nonStockAlerts, ...stockAlerts];
    });
  };

  const processSalesAlerts = (todaySales) => {
    const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const salesCount = todaySales.length;
    
    const salesAlerts = [];
    
    // Daily milestone alerts
    if (todayRevenue >= 1000) {
      salesAlerts.push({
        id: 'daily-milestone',
        type: 'success',
        priority: 'low',
        title: 'Daily Sales Milestone Reached!',
        message: `Congratulations! Today's sales: RM ${todayRevenue.toFixed(2)} from ${salesCount} transactions`,
        icon: '🎉',
        action: '/analytics',
        actionText: 'View Analytics',
        timestamp: new Date()
      });
    }

    // High activity alert
    if (salesCount >= 10) {
      salesAlerts.push({
        id: 'high-activity',
        type: 'info',
        priority: 'low',
        title: 'High Sales Activity Today',
        message: `${salesCount} sales recorded today. Great work!`,
        icon: '📈',
        action: '/sales',
        actionText: 'View Sales',
        timestamp: new Date()
      });
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      todaySales: todayRevenue,
      recentActivity: salesCount
    }));

    // Update alerts
    setAlerts(prev => {
      const nonSalesAlerts = prev.filter(alert => 
        !['daily-milestone', 'high-activity'].includes(alert.id)
      );
      return [...nonSalesAlerts, ...salesAlerts];
    });
  };

  const processCreditAlerts = (creditSales) => {
    const now = new Date();
    const overdueThreshold = 7; // Days
    
    const overduePayments = creditSales.filter(sale => {
      if (!sale.createdAt || sale.status === 'Paid') return false;
      // Fix floating point precision: treat anything < 0.01 as zero
      if ((sale.remaining || 0) < 0.01) return false;
      
      const daysDiff = Math.floor((now - sale.createdAt) / (1000 * 60 * 60 * 24));
      return daysDiff > overdueThreshold;
    });

    const totalOutstanding = creditSales
      .filter(sale => sale.status === 'Hutang')
      .reduce((sum, sale) => sum + (sale.remaining || sale.total || 0), 0);

    const creditAlerts = [];
    
    if (overduePayments.length > 0) {
      const overdueAmount = overduePayments.reduce((sum, sale) => 
        sum + (sale.remaining || sale.total || 0), 0
      );
      
      creditAlerts.push({
        id: 'overdue-payments',
        type: 'error',
        priority: 'high',
        title: `${overduePayments.length} Overdue Payments`,
        message: `RM ${overdueAmount.toFixed(2)} in overdue credit payments require attention`,
        icon: '💸',
        action: '/hutang',
        actionText: 'Manage Credits',
        timestamp: new Date()
      });
    }

    if (totalOutstanding > 5000) {
      creditAlerts.push({
        id: 'high-outstanding',
        type: 'warning',
        priority: 'medium',
        title: 'High Outstanding Credit',
        message: `Total outstanding credit: RM ${totalOutstanding.toFixed(2)}. Monitor cash flow.`,
        icon: '💳',
        action: '/hutang',
        actionText: 'View Credits',
        timestamp: new Date()
      });
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      overduePayments: overduePayments.length,
      totalOutstanding
    }));

    // Update alerts
    setAlerts(prev => {
      const nonCreditAlerts = prev.filter(alert => 
        !['overdue-payments', 'high-outstanding'].includes(alert.id)
      );
      return [...nonCreditAlerts, ...creditAlerts];
    });
  };

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getAlertsByPriority = () => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return alerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp; // Most recent first for same priority
    });
  };

  return {
    alerts: getAlertsByPriority(),
    stats,
    loading,
    dismissAlert,
    hasAlerts: alerts.length > 0,
    criticalAlerts: alerts.filter(alert => alert.priority === 'high').length,
    warningAlerts: alerts.filter(alert => alert.priority === 'medium').length
  };
};