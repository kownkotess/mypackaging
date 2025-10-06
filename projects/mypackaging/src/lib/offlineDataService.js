// Offline Data Service for MyPackaging PWA
// Handles business logic for offline operations

import offlineDB from './offlineDatabase';

class OfflineDataService {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize the service
  async init() {
    if (!this.isInitialized) {
      await offlineDB.init();
      this.isInitialized = true;
      console.log('OfflineDataService initialized');
    }
  }

  // Generate unique ID for offline operations
  generateOfflineId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // === SALES OPERATIONS ===

  // Store a sale for offline processing
  async storePendingSale(saleData) {
    await this.init();

    const pendingSale = {
      id: this.generateOfflineId(),
      ...saleData,
      timestamp: Date.now(),
      syncStatus: 'pending',
      createdOffline: true,
      attempts: 0,
      lastAttempt: null,
      conflicts: []
    };

    await offlineDB.addData('pendingSales', pendingSale);
    
    // Add to sync queue
    await this.addToSyncQueue('sales', pendingSale.id, 'high');
    
    console.log('Sale stored for offline sync:', pendingSale.id);
    return pendingSale;
  }

  // Get all pending sales
  async getPendingSales() {
    await this.init();
    return await offlineDB.getDataByIndex('pendingSales', 'syncStatus', 'pending');
  }

  // Update sale sync status
  async updateSaleStatus(saleId, status, error = null) {
    await this.init();
    
    const sale = await offlineDB.getData('pendingSales', saleId);
    if (sale) {
      sale.syncStatus = status;
      sale.lastAttempt = Date.now();
      sale.attempts = (sale.attempts || 0) + 1;
      
      if (error) {
        sale.lastError = error;
      }
      
      await offlineDB.updateData('pendingSales', sale);
    }
  }

  // === INVENTORY OPERATIONS ===

  // Store inventory update for offline processing
  async storePendingInventoryUpdate(updateData) {
    await this.init();

    const pendingUpdate = {
      id: this.generateOfflineId(),
      ...updateData,
      timestamp: Date.now(),
      syncStatus: 'pending',
      createdOffline: true,
      attempts: 0,
      lastAttempt: null
    };

    await offlineDB.addData('pendingInventory', pendingUpdate);
    
    // Add to sync queue with priority based on type
    const priority = updateData.type === 'sale' ? 'high' : 'medium';
    await this.addToSyncQueue('inventory', pendingUpdate.id, priority);
    
    console.log('Inventory update stored for offline sync:', pendingUpdate.id);
    return pendingUpdate;
  }

  // Get pending inventory updates
  async getPendingInventoryUpdates() {
    await this.init();
    return await offlineDB.getDataByIndex('pendingInventory', 'syncStatus', 'pending');
  }

  // Update inventory sync status
  async updateInventoryStatus(updateId, status, error = null) {
    await this.init();
    
    const update = await offlineDB.getData('pendingInventory', updateId);
    if (update) {
      update.syncStatus = status;
      update.lastAttempt = Date.now();
      update.attempts = (update.attempts || 0) + 1;
      
      if (error) {
        update.lastError = error;
      }
      
      await offlineDB.updateData('pendingInventory', update);
    }
  }

  // === SYNC QUEUE OPERATIONS ===

  // Add item to sync queue
  async addToSyncQueue(type, entityId, priority = 'medium') {
    await this.init();

    const queueItem = {
      id: this.generateOfflineId(),
      type,
      entityId,
      priority,
      status: 'pending',
      timestamp: Date.now(),
      attempts: 0,
      lastAttempt: null
    };

    await offlineDB.addData('syncQueue', queueItem);
    return queueItem;
  }

  // Get sync queue items by priority
  async getSyncQueue(status = 'pending') {
    await this.init();
    const items = await offlineDB.getDataByIndex('syncQueue', 'status', status);
    
    // Sort by priority and timestamp
    return items.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // Older items first
    });
  }

  // Update sync queue item status
  async updateSyncQueueStatus(queueId, status, error = null) {
    await this.init();
    
    const item = await offlineDB.getData('syncQueue', queueId);
    if (item) {
      item.status = status;
      item.lastAttempt = Date.now();
      item.attempts = (item.attempts || 0) + 1;
      
      if (error) {
        item.lastError = error;
      }
      
      await offlineDB.updateData('syncQueue', item);
    }
  }

  // Remove completed sync queue items
  async cleanupSyncQueue() {
    await this.init();
    
    const completedItems = await offlineDB.getDataByIndex('syncQueue', 'status', 'completed');
    const failedItems = await offlineDB.getDataByIndex('syncQueue', 'status', 'failed');
    
    // Remove items completed more than 24 hours ago
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const item of [...completedItems, ...failedItems]) {
      if (item.lastAttempt && item.lastAttempt < oneDayAgo) {
        await offlineDB.deleteData('syncQueue', item.id);
      }
    }
  }

  // === CONFLICT RESOLUTION ===

  // Store a conflict for user resolution
  async storeConflict(entityType, entityId, localData, serverData, conflictType) {
    await this.init();

    const conflict = {
      id: this.generateOfflineId(),
      entityType,
      entityId,
      localData,
      serverData,
      conflictType,
      timestamp: Date.now(),
      resolved: false,
      resolution: null
    };

    await offlineDB.addData('conflicts', conflict);
    console.log('Conflict stored for resolution:', conflict.id);
    return conflict;
  }

  // Get unresolved conflicts
  async getUnresolvedConflicts() {
    await this.init();
    return await offlineDB.getDataByIndex('conflicts', 'resolved', false);
  }

  // Resolve a conflict
  async resolveConflict(conflictId, resolution) {
    await this.init();
    
    const conflict = await offlineDB.getData('conflicts', conflictId);
    if (conflict) {
      conflict.resolved = true;
      conflict.resolution = resolution;
      conflict.resolvedAt = Date.now();
      
      await offlineDB.updateData('conflicts', conflict);
      console.log('Conflict resolved:', conflictId);
    }
  }

  // === CACHED DATA OPERATIONS ===

  // Store data in cache for offline access
  async cacheData(key, data, type, expirationHours = 24) {
    await this.init();

    const cachedItem = {
      key,
      data,
      type,
      timestamp: Date.now(),
      expires: Date.now() + (expirationHours * 60 * 60 * 1000)
    };

    await offlineDB.updateData('cachedData', cachedItem);
  }

  // Get cached data
  async getCachedData(key) {
    await this.init();
    
    const item = await offlineDB.getData('cachedData', key);
    
    if (!item) return null;
    
    // Check if expired
    if (item.expires && Date.now() > item.expires) {
      await offlineDB.deleteData('cachedData', key);
      return null;
    }
    
    return item.data;
  }

  // Clear expired cache items
  async clearExpiredCache() {
    await this.init();
    
    const allCached = await offlineDB.getAllData('cachedData');
    const now = Date.now();
    
    for (const item of allCached) {
      if (item.expires && now > item.expires) {
        await offlineDB.deleteData('cachedData', item.key);
      }
    }
  }

  // === STATISTICS AND MONITORING ===

  // Get sync statistics
  async getSyncStats() {
    await this.init();

    try {
      const stats = {
        pendingSales: await offlineDB.countData('pendingSales', { indexName: 'syncStatus', value: 'pending' }),
        pendingInventory: await offlineDB.countData('pendingInventory', { indexName: 'syncStatus', value: 'pending' }),
        queuedItems: await offlineDB.countData('syncQueue', { indexName: 'status', value: 'pending' }),
        unresolvedConflicts: await this.countUnresolvedConflicts(),
        cachedItems: await offlineDB.countData('cachedData'),
        lastSync: await this.getCachedData('lastSyncTime') || null
      };

      return stats;
    } catch (error) {
      console.error('Error getting sync stats:', error);
      // Return default stats if there's an error
      return {
        pendingSales: 0,
        pendingInventory: 0,
        queuedItems: 0,
        unresolvedConflicts: 0,
        cachedItems: 0,
        lastSync: null
      };
    }
  }

  // Helper method to count unresolved conflicts manually
  async countUnresolvedConflicts() {
    try {
      const allConflicts = await offlineDB.getAllData('conflicts');
      return allConflicts.filter(conflict => conflict.resolved === false).length;
    } catch (error) {
      console.error('Error counting unresolved conflicts:', error);
      return 0;
    }
  }

  // Update last sync time
  async updateLastSyncTime() {
    await this.init();
    await this.cacheData('lastSyncTime', Date.now(), 'metadata', 168); // 1 week
  }

  // === CLEANUP OPERATIONS ===

  // Clear all pending data (for testing or reset)
  async clearAllPendingData() {
    await this.init();
    
    await offlineDB.clearStore('pendingSales');
    await offlineDB.clearStore('pendingInventory');
    await offlineDB.clearStore('syncQueue');
    await offlineDB.clearStore('conflicts');
    
    console.log('All pending data cleared');
  }

  // Remove successfully synced items
  async cleanupSyncedData() {
    await this.init();

    // Remove successfully synced sales
    const syncedSales = await offlineDB.getDataByIndex('pendingSales', 'syncStatus', 'completed');
    for (const sale of syncedSales) {
      await offlineDB.deleteData('pendingSales', sale.id);
    }

    // Remove successfully synced inventory updates
    const syncedInventory = await offlineDB.getDataByIndex('pendingInventory', 'syncStatus', 'completed');
    for (const update of syncedInventory) {
      await offlineDB.deleteData('pendingInventory', update.id);
    }

    await this.cleanupSyncQueue();
    await this.clearExpiredCache();
    
    console.log('Synced data cleanup completed');
  }
}

// Export singleton instance
const offlineDataService = new OfflineDataService();
export default offlineDataService;