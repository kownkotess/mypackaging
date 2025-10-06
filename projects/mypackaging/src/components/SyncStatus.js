import React, { useState, useEffect } from 'react';
import offlineDataService from '../lib/offlineDataService';
import './SyncStatus.css';

const SyncStatus = ({ compact = false }) => {
  const [syncStats, setSyncStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    loadSyncStats();
    
    // Update stats every 30 seconds
    const interval = setInterval(loadSyncStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadSyncStats = async () => {
    try {
      setIsLoading(true);
      
      // Initialize the offline service first
      await offlineDataService.init();
      
      const stats = await offlineDataService.getSyncStats();
      setSyncStats(stats);
      setLastUpdate(Date.now());
      
      console.log('Sync stats loaded:', stats);
    } catch (error) {
      console.error('Error loading sync stats:', error);
      // Set default stats if there's an error
      setSyncStats({
        pendingSales: 0,
        pendingInventory: 0,
        queuedItems: 0,
        unresolvedConflicts: 0,
        cachedItems: 0,
        lastSync: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getSyncStatusColor = () => {
    if (!syncStats) return 'gray';
    
    const { pendingSales, pendingInventory, unresolvedConflicts } = syncStats;
    const totalPending = pendingSales + pendingInventory;
    
    if (unresolvedConflicts > 0) return 'red';
    if (totalPending > 10) return 'orange';
    if (totalPending > 0) return 'yellow';
    return 'green';
  };

  const getSyncStatusText = () => {
    if (isLoading) return 'Loading...';
    if (!syncStats) return 'Unknown';
    
    const { pendingSales, pendingInventory, unresolvedConflicts } = syncStats;
    const totalPending = pendingSales + pendingInventory;
    
    if (unresolvedConflicts > 0) return `${unresolvedConflicts} conflicts`;
    if (totalPending > 0) return `${totalPending} pending`;
    return 'Up to date';
  };

  if (compact) {
    return (
      <div className={`sync-status-compact sync-status-${getSyncStatusColor()}`}>
        <div className="sync-indicator">
          <div className="sync-dot"></div>
        </div>
        <span className="sync-text">{getSyncStatusText()}</span>
      </div>
    );
  }

  return (
    <div className="sync-status-card">
      <div className="sync-status-header">
        <h3>Sync Status</h3>
        <button 
          className="refresh-btn"
          onClick={loadSyncStats}
          disabled={isLoading}
        >
          {isLoading ? '⟳' : '↻'}
        </button>
      </div>

      {syncStats && (
        <div className="sync-stats">
          <div className="stat-row">
            <span className="stat-label">Pending Sales:</span>
            <span className={`stat-value ${syncStats.pendingSales > 0 ? 'pending' : 'clean'}`}>
              {syncStats.pendingSales}
            </span>
          </div>
          
          <div className="stat-row">
            <span className="stat-label">Pending Inventory:</span>
            <span className={`stat-value ${syncStats.pendingInventory > 0 ? 'pending' : 'clean'}`}>
              {syncStats.pendingInventory}
            </span>
          </div>
          
          <div className="stat-row">
            <span className="stat-label">Queue Items:</span>
            <span className={`stat-value ${syncStats.queuedItems > 0 ? 'pending' : 'clean'}`}>
              {syncStats.queuedItems}
            </span>
          </div>
          
          {syncStats.unresolvedConflicts > 0 && (
            <div className="stat-row">
              <span className="stat-label">Conflicts:</span>
              <span className="stat-value conflict">
                {syncStats.unresolvedConflicts}
              </span>
            </div>
          )}
          
          <div className="stat-row">
            <span className="stat-label">Cached Items:</span>
            <span className="stat-value">
              {syncStats.cachedItems}
            </span>
          </div>
          
          <div className="stat-row">
            <span className="stat-label">Last Sync:</span>
            <span className="stat-value">
              {formatLastSync(syncStats.lastSync)}
            </span>
          </div>
        </div>
      )}

      <div className="sync-status-footer">
        <div className={`sync-indicator-large sync-status-${getSyncStatusColor()}`}>
          <div className="sync-dot-large"></div>
          <span>{getSyncStatusText()}</span>
        </div>
        
        <div className="last-updated">
          Updated: {formatLastSync(lastUpdate)}
        </div>
      </div>
    </div>
  );
};

export default SyncStatus;