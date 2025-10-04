import React from 'react';
import { Link } from 'react-router-dom';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import './DashboardAlerts.css';

const DashboardAlerts = () => {
  const { 
    alerts, 
    stats, 
    loading, 
    dismissAlert, 
    hasAlerts, 
    criticalAlerts, 
    warningAlerts 
  } = useDashboardAlerts();

  if (loading) {
    return (
      <div className="dashboard-alerts loading">
        <div className="loading-spinner">Loading alerts...</div>
      </div>
    );
  }

  const getAlertTypeClass = (type) => {
    switch (type) {
      case 'error': return 'alert-error';
      case 'warning': return 'alert-warning';
      case 'success': return 'alert-success';
      case 'info': return 'alert-info';
      default: return 'alert-info';
    }
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: { text: 'HIGH', class: 'priority-high' },
      medium: { text: 'MED', class: 'priority-medium' },
      low: { text: 'LOW', class: 'priority-low' }
    };
    return badges[priority] || badges.low;
  };

  return (
    <div className="dashboard-alerts">
      {/* Alert Summary Bar */}
      <div className="alerts-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-icon">📊</span>
            <div className="stat-content">
              <span className="stat-label">Today's Sales</span>
              <span className="stat-value">RM {stats.todaySales.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="stat-item">
            <span className="stat-icon">📦</span>
            <div className="stat-content">
              <span className="stat-label">Low Stock Items</span>
              <span className={`stat-value ${stats.lowStock > 0 ? 'warning' : ''}`}>
                {stats.lowStock}
              </span>
            </div>
          </div>
          
          <div className="stat-item">
            <span className="stat-icon">🚨</span>
            <div className="stat-content">
              <span className="stat-label">Out of Stock</span>
              <span className={`stat-value ${stats.outOfStock > 0 ? 'danger' : ''}`}>
                {stats.outOfStock}
              </span>
            </div>
          </div>
          
          <div className="stat-item">
            <span className="stat-icon">💸</span>
            <div className="stat-content">
              <span className="stat-label">Outstanding Credit</span>
              <span className={`stat-value ${stats.totalOutstanding > 1000 ? 'warning' : ''}`}>
                RM {stats.totalOutstanding.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {hasAlerts && (
          <div className="alert-counts">
            {criticalAlerts > 0 && (
              <div className="alert-count critical">
                <span className="count">{criticalAlerts}</span>
                <span className="label">Critical</span>
              </div>
            )}
            {warningAlerts > 0 && (
              <div className="alert-count warning">
                <span className="count">{warningAlerts}</span>
                <span className="label">Warnings</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Alerts */}
      {hasAlerts && (
        <div className="active-alerts">
          <div className="alerts-header">
            <h3>🔔 Active Alerts</h3>
            <span className="alert-subtitle">
              Showing {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="alerts-list">
            {alerts.slice(0, 5).map((alert) => {
              const priorityBadge = getPriorityBadge(alert.priority);
              
              return (
                <div 
                  key={alert.id} 
                  className={`alert-item ${getAlertTypeClass(alert.type)}`}
                >
                  <div className="alert-content">
                    <div className="alert-header">
                      <div className="alert-title-row">
                        <span className="alert-icon">{alert.icon}</span>
                        <h4 className="alert-title">{alert.title}</h4>
                        <div className={`priority-badge ${priorityBadge.class}`}>
                          {priorityBadge.text}
                        </div>
                      </div>
                      <button 
                        className="dismiss-btn"
                        onClick={() => dismissAlert(alert.id)}
                        title="Dismiss alert"
                      >
                        ×
                      </button>
                    </div>
                    
                    <p className="alert-message">{alert.message}</p>
                    
                    <div className="alert-actions">
                      {alert.action && (
                        <Link to={alert.action} className="alert-action-btn">
                          {alert.actionText || 'View Details'}
                        </Link>
                      )}
                      <span className="alert-timestamp">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {alerts.length > 5 && (
            <div className="alerts-footer">
              <p className="more-alerts">
                + {alerts.length - 5} more alert{alerts.length - 5 !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* No Alerts State */}
      {!hasAlerts && (
        <div className="no-alerts">
          <div className="no-alerts-content">
            <span className="no-alerts-icon">✅</span>
            <h3>All Systems Normal</h3>
            <p>No active alerts. Your business is running smoothly!</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <h4>Quick Actions</h4>
        <div className="action-buttons">
          <Link to="/sales" className="action-btn sales">
            <span className="action-icon">🛒</span>
            <span>New Sale</span>
          </Link>
          
          <Link to="/products" className="action-btn products">
            <span className="action-icon">📦</span>
            <span>Check Stock</span>
          </Link>
          
          <Link to="/purchases" className="action-btn purchases">
            <span className="action-icon">📋</span>
            <span>Add Purchase</span>
          </Link>
          
          <Link to="/hutang" className="action-btn hutang">
            <span className="action-icon">💳</span>
            <span>Manage Credits</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardAlerts;