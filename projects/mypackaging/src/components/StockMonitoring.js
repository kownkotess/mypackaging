import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStockMonitoring } from '../hooks/useStockMonitoring';
import { useAlert } from '../context/AlertContext';
import ReturnToTop from './ReturnToTop';
import './StockMonitoring.css';

const StockMonitoring = () => {
  const { 
    stockAlerts, 
    products,
    loading, 
    settings,
    updateSettings,
    updateProductReorderPoint,
    dismissAlert,
    markAlertAsHandled,
    getStockStatus,
    getStockHealthMetrics,
    hasStockIssues,
    criticalAlerts,
    warningAlerts
  } = useStockMonitoring();

  const { showSuccess, showError } = useAlert();
  const [showSettings, setShowSettings] = useState(false);
  const [editingReorderPoint, setEditingReorderPoint] = useState(null);
  const [newReorderPoint, setNewReorderPoint] = useState('');

  const healthMetrics = getStockHealthMetrics;

  const handleSettingsUpdate = (key, value) => {
    updateSettings({ [key]: value });
    showSuccess('Stock monitoring settings updated');
  };

  const handleReorderPointUpdate = async (productId) => {
    if (!newReorderPoint || isNaN(newReorderPoint)) {
      showError('Please enter a valid number');
      return;
    }

    try {
      await updateProductReorderPoint(productId, parseInt(newReorderPoint));
      showSuccess('Reorder point updated successfully');
      setEditingReorderPoint(null);
      setNewReorderPoint('');
    } catch (error) {
      showError('Failed to update reorder point');
    }
  };

  const handleAlertAction = async (alert, action) => {
    try {
      await markAlertAsHandled(alert, action);
      showSuccess(`Alert marked as handled: ${action}`);
    } catch (error) {
      showError('Failed to handle alert');
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'out-of-stock': 'status-critical',
      'critical-low': 'status-danger',
      'low-stock': 'status-warning',
      'normal': 'status-normal'
    };
    return classes[status] || 'status-normal';
  };

  const getUrgencyClass = (urgency) => {
    const classes = {
      'immediate': 'urgency-immediate',
      'high': 'urgency-high',
      'medium': 'urgency-medium'
    };
    return classes[urgency] || 'urgency-medium';
  };

  if (loading) {
    return (
      <div className="stock-monitoring">
        <div className="loading">Loading stock monitoring data...</div>
      </div>
    );
  }

  return (
    <div className="stock-monitoring">
      <div className="page-navigation">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
      </div>

      <div className="monitoring-header">
        <div className="header-content">
          <h1>📊 Stock Monitoring System</h1>
          <p>Real-time inventory alerts and stock health monitoring</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn secondary"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
          </button>
          <Link to="/products" className="btn primary">
            📦 Manage Products
          </Link>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <h3>Monitoring Settings</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Global Reorder Point</label>
              <input
                type="number"
                value={settings.globalReorderPoint}
                onChange={(e) => handleSettingsUpdate('globalReorderPoint', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div className="setting-item">
              <label>Critical Stock Level</label>
              <input
                type="number"
                value={settings.criticalStockLevel}
                onChange={(e) => handleSettingsUpdate('criticalStockLevel', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enableAutoNotifications}
                  onChange={(e) => handleSettingsUpdate('enableAutoNotifications', e.target.checked)}
                />
                Enable Auto Notifications
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Health Metrics */}
      {healthMetrics && (
        <div className="health-metrics">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div className="metric-content">
                <span className="metric-value">{healthMetrics.totalProducts}</span>
                <span className="metric-label">Total Products</span>
              </div>
            </div>
            
            <div className="metric-card critical">
              <div className="metric-icon">🚨</div>
              <div className="metric-content">
                <span className="metric-value">{healthMetrics.outOfStock}</span>
                <span className="metric-label">Out of Stock</span>
              </div>
            </div>
            
            <div className="metric-card warning">
              <div className="metric-icon">⚠️</div>
              <div className="metric-content">
                <span className="metric-value">{healthMetrics.criticalLow}</span>
                <span className="metric-label">Critical Low</span>
              </div>
            </div>
            
            <div className="metric-card info">
              <div className="metric-icon">📊</div>
              <div className="metric-content">
                <span className="metric-value">{healthMetrics.lowStock}</span>
                <span className="metric-label">Low Stock</span>
              </div>
            </div>
            
            <div className="metric-card success">
              <div className="metric-icon">✅</div>
              <div className="metric-content">
                <span className="metric-value">{healthMetrics.normal}</span>
                <span className="metric-label">Normal Stock</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-content">
                <span className="metric-value">RM {healthMetrics.totalStockValue.toFixed(0)}</span>
                <span className="metric-label">Stock Value</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Stock Alerts */}
      {hasStockIssues && (
        <div className="stock-alerts-section">
          <div className="section-header">
            <h2>🔔 Active Stock Alerts</h2>
            <div className="alert-summary">
              {criticalAlerts > 0 && <span className="critical-count">{criticalAlerts} Critical</span>}
              {warningAlerts > 0 && <span className="warning-count">{warningAlerts} High Priority</span>}
            </div>
          </div>
          
          <div className="alerts-list">
            {stockAlerts.map(alert => (
              <div key={alert.id} className={`alert-card ${getUrgencyClass(alert.urgency)}`}>
                <div className="alert-header">
                  <div className="alert-info">
                    <h4>{alert.productName}</h4>
                    <span className={`urgency-badge ${getUrgencyClass(alert.urgency)}`}>
                      {alert.urgency.toUpperCase()}
                    </span>
                  </div>
                  <button 
                    className="dismiss-btn"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    ×
                  </button>
                </div>
                
                <p className="alert-message">{alert.message}</p>
                
                <div className="alert-details">
                  <span>Current: {alert.currentStock} units</span>
                  <span>Reorder Point: {alert.reorderPoint} units</span>
                  <span>Level: {alert.level.replace('-', ' ')}</span>
                </div>
                
                <div className="alert-actions">
                  <button 
                    className="btn small primary"
                    onClick={() => handleAlertAction(alert, 'created_purchase_order')}
                  >
                    Create Purchase Order
                  </button>
                  <button 
                    className="btn small secondary"
                    onClick={() => handleAlertAction(alert, 'noted')}
                  >
                    Mark as Noted
                  </button>
                  <Link to={`/products`} className="btn small info">
                    View Product
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Status Overview */}
      <div className="stock-overview">
        <div className="section-header">
          <h2>📋 Stock Status Overview</h2>
          <p>Current stock levels for all products</p>
        </div>
        
        <div className="products-table">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Current Stock</th>
                <th>Reorder Point</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const status = getStockStatus(product);
                return (
                  <tr key={product.id} className={getStatusBadgeClass(status)}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>
                      <span className={`stock-value ${status === 'out-of-stock' ? 'critical' : ''}`}>
                        {product.stockBalance || 0} units
                      </span>
                    </td>
                    <td>
                      {editingReorderPoint === product.id ? (
                        <div className="inline-edit">
                          <input
                            type="number"
                            value={newReorderPoint}
                            onChange={(e) => setNewReorderPoint(e.target.value)}
                            placeholder={product.reorderPoint || settings.globalReorderPoint}
                            className="reorder-input"
                          />
                          <button 
                            className="btn tiny primary"
                            onClick={() => handleReorderPointUpdate(product.id)}
                          >
                            ✓
                          </button>
                          <button 
                            className="btn tiny secondary"
                            onClick={() => {
                              setEditingReorderPoint(null);
                              setNewReorderPoint('');
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span 
                          className="reorder-point clickable"
                          onClick={() => {
                            setEditingReorderPoint(product.id);
                            setNewReorderPoint(product.reorderPoint || settings.globalReorderPoint);
                          }}
                        >
                          {product.reorderPoint || settings.globalReorderPoint} units
                          <span className="edit-hint">✏️</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(status)}`}>
                        {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {status !== 'normal' && (
                          <Link to="/purchases" className="btn tiny primary">
                            Reorder
                          </Link>
                        )}
                        <Link to="/products" className="btn tiny secondary">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reorder Suggestions */}
      {healthMetrics && healthMetrics.reorderSuggestions.length > 0 && (
        <div className="reorder-suggestions">
          <div className="section-header">
            <h2>📋 Reorder Suggestions</h2>
            <p>Intelligent reordering recommendations based on current stock levels</p>
          </div>
          
          <div className="suggestions-list">
            {healthMetrics.reorderSuggestions.slice(0, 10).map(suggestion => (
              <div key={suggestion.productId} className={`suggestion-card priority-${suggestion.priority}`}>
                <div className="suggestion-header">
                  <h4>{suggestion.productName}</h4>
                  <span className={`priority-badge priority-${suggestion.priority}`}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                </div>
                
                <div className="suggestion-details">
                  <div className="detail-row">
                    <span>Current Stock:</span>
                    <span>{suggestion.currentStock} units</span>
                  </div>
                  <div className="detail-row">
                    <span>Suggested Quantity:</span>
                    <span>{suggestion.suggestedQuantity} units</span>
                  </div>
                  <div className="detail-row">
                    <span>Estimated Cost:</span>
                    <span>RM {suggestion.estimatedCost.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="suggestion-actions">
                  <Link to="/purchases" className="btn small primary">
                    Create Purchase Order
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Issues State */}
      {!hasStockIssues && (
        <div className="no-issues">
          <div className="no-issues-content">
            <span className="success-icon">✅</span>
            <h3>All Stock Levels Normal</h3>
            <p>No stock alerts at this time. Your inventory is well-managed!</p>
          </div>
        </div>
      )}

      {/* Return to Top Button */}
      <ReturnToTop />
    </div>
  );
};

export default StockMonitoring;