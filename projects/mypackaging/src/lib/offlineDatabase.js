// IndexedDB Database Wrapper for MyPackaging PWA
// Provides offline storage capabilities with schema versioning

class OfflineDatabase {
  constructor() {
    this.dbName = 'MyPackagingOfflineDB';
    this.version = 1;
    this.db = null;
  }

  // Initialize the database with proper schema
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        this.createStores();
      };
    });
  }

  // Create object stores for different data types
  createStores() {
    console.log('Creating IndexedDB stores...');

    // Pending Sales Store
    if (!this.db.objectStoreNames.contains('pendingSales')) {
      const salesStore = this.db.createObjectStore('pendingSales', {
        keyPath: 'id',
        autoIncrement: false
      });
      
      salesStore.createIndex('timestamp', 'timestamp', { unique: false });
      salesStore.createIndex('status', 'status', { unique: false });
      salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      console.log('Created pendingSales store');
    }

    // Pending Inventory Updates Store
    if (!this.db.objectStoreNames.contains('pendingInventory')) {
      const inventoryStore = this.db.createObjectStore('pendingInventory', {
        keyPath: 'id',
        autoIncrement: false
      });
      
      inventoryStore.createIndex('productId', 'productId', { unique: false });
      inventoryStore.createIndex('timestamp', 'timestamp', { unique: false });
      inventoryStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      inventoryStore.createIndex('type', 'type', { unique: false }); // 'adjustment', 'restock', 'sale'
      console.log('Created pendingInventory store');
    }

    // Sync Queue Store
    if (!this.db.objectStoreNames.contains('syncQueue')) {
      const syncStore = this.db.createObjectStore('syncQueue', {
        keyPath: 'id',
        autoIncrement: false
      });
      
      syncStore.createIndex('priority', 'priority', { unique: false });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      syncStore.createIndex('type', 'type', { unique: false }); // 'sales', 'inventory', 'settings'
      syncStore.createIndex('status', 'status', { unique: false }); // 'pending', 'syncing', 'failed', 'completed'
      console.log('Created syncQueue store');
    }

    // Conflict Resolution Store
    if (!this.db.objectStoreNames.contains('conflicts')) {
      const conflictsStore = this.db.createObjectStore('conflicts', {
        keyPath: 'id',
        autoIncrement: false
      });
      
      conflictsStore.createIndex('entityType', 'entityType', { unique: false });
      conflictsStore.createIndex('entityId', 'entityId', { unique: false });
      conflictsStore.createIndex('timestamp', 'timestamp', { unique: false });
      conflictsStore.createIndex('resolved', 'resolved', { unique: false });
      console.log('Created conflicts store');
    }

    // Cached Data Store (for offline reads)
    if (!this.db.objectStoreNames.contains('cachedData')) {
      const cacheStore = this.db.createObjectStore('cachedData', {
        keyPath: 'key'
      });
      
      cacheStore.createIndex('type', 'type', { unique: false });
      cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      cacheStore.createIndex('expires', 'expires', { unique: false });
      console.log('Created cachedData store');
    }
  }

  // Generic method to add data to any store
  async addData(storeName, data) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => {
        console.log(`Data added to ${storeName}:`, data.id);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error adding data to ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Generic method to update data in any store
  async updateData(storeName, data) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => {
        console.log(`Data updated in ${storeName}:`, data.id);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error updating data in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Generic method to get data from any store
  async getData(storeName, id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error getting data from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Generic method to get all data from a store
  async getAllData(storeName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error getting all data from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Get data by index
  async getDataByIndex(storeName, indexName, value) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error getting data by index from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Delete data from any store
  async deleteData(storeName, id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`Data deleted from ${storeName}:`, id);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error deleting data from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Count records in a store
  async countData(storeName, filter = null) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        let request;

        if (filter && filter.indexName && filter.value !== undefined) {
          const index = store.index(filter.indexName);
          request = index.count(filter.value);
        } else {
          request = store.count();
        }

        request.onsuccess = () => {
          resolve(request.result || 0);
        };

        request.onerror = () => {
          console.error(`Error counting data in ${storeName}:`, request.error);
          resolve(0); // Return 0 instead of rejecting to prevent cascading errors
        };
      } catch (error) {
        console.error(`Error setting up count transaction for ${storeName}:`, error);
        resolve(0);
      }
    });
  }

  // Clear all data from a store
  async clearStore(storeName) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`Store ${storeName} cleared`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error clearing store ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Get database statistics
  async getStats() {
    const stats = {};
    const storeNames = ['pendingSales', 'pendingInventory', 'syncQueue', 'conflicts', 'cachedData'];

    for (const storeName of storeNames) {
      try {
        stats[storeName] = await this.countData(storeName);
      } catch (error) {
        stats[storeName] = 0;
      }
    }

    return stats;
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('IndexedDB connection closed');
    }
  }
}

// Export singleton instance
const offlineDB = new OfflineDatabase();
export default offlineDB;