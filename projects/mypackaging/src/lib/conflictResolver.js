// Conflict Resolution System for MyPackaging PWA
// Handles data conflicts during sync operations

import offlineDataService from './offlineDataService';

class ConflictResolver {
  constructor() {
    this.resolutionStrategies = {
      'client-wins': 'Use local (offline) version',
      'server-wins': 'Use server version',
      'merge': 'Merge both versions',
      'manual': 'Let user decide'
    };
  }

  // Detect conflicts between local and server data
  detectConflict(localData, serverData, entity) {
    const conflicts = [];

    // Check for timestamp conflicts
    if (localData.updatedAt && serverData.updatedAt) {
      const localTime = localData.updatedAt;
      const serverTime = serverData.updatedAt;
      
      if (localTime !== serverTime) {
        conflicts.push({
          field: 'updatedAt',
          type: 'timestamp',
          local: localTime,
          server: serverTime,
          severity: 'medium'
        });
      }
    }

    // Check for specific entity conflicts
    switch (entity) {
      case 'sale':
        return this.detectSaleConflicts(localData, serverData, conflicts);
      case 'inventory':
        return this.detectInventoryConflicts(localData, serverData, conflicts);
      case 'product':
        return this.detectProductConflicts(localData, serverData, conflicts);
      default:
        return this.detectGenericConflicts(localData, serverData, conflicts);
    }
  }

  // Detect sale-specific conflicts
  detectSaleConflicts(localSale, serverSale, existingConflicts) {
    const conflicts = [...existingConflicts];

    // Critical fields that should never conflict
    const criticalFields = ['total', 'items', 'paymentMethod'];
    
    criticalFields.forEach(field => {
      if (localSale[field] !== serverSale[field]) {
        conflicts.push({
          field,
          type: 'value_mismatch',
          local: localSale[field],
          server: serverSale[field],
          severity: 'high'
        });
      }
    });

    // Check for item-level conflicts
    if (localSale.items && serverSale.items) {
      const itemConflicts = this.compareItemArrays(localSale.items, serverSale.items);
      conflicts.push(...itemConflicts);
    }

    return conflicts;
  }

  // Detect inventory-specific conflicts
  detectInventoryConflicts(localUpdate, serverUpdate, existingConflicts) {
    const conflicts = [...existingConflicts];

    // Stock quantity conflicts are critical
    if (localUpdate.quantity !== serverUpdate.quantity) {
      conflicts.push({
        field: 'quantity',
        type: 'stock_mismatch',
        local: localUpdate.quantity,
        server: serverUpdate.quantity,
        severity: 'high'
      });
    }

    // Check for concurrent modifications
    if (localUpdate.lastModified && serverUpdate.lastModified) {
      const timeDiff = Math.abs(localUpdate.lastModified - serverUpdate.lastModified);
      if (timeDiff < 60000) { // Within 1 minute
        conflicts.push({
          field: 'concurrent_modification',
          type: 'timing',
          local: localUpdate.lastModified,
          server: serverUpdate.lastModified,
          severity: 'high'
        });
      }
    }

    return conflicts;
  }

  // Detect product-specific conflicts
  detectProductConflicts(localProduct, serverProduct, existingConflicts) {
    const conflicts = [...existingConflicts];

    // Important product fields
    const importantFields = ['name', 'price', 'barcode', 'category'];
    
    importantFields.forEach(field => {
      if (localProduct[field] !== serverProduct[field]) {
        conflicts.push({
          field,
          type: 'product_data_mismatch',
          local: localProduct[field],
          server: serverProduct[field],
          severity: field === 'price' ? 'high' : 'medium'
        });
      }
    });

    return conflicts;
  }

  // Generic conflict detection
  detectGenericConflicts(localData, serverData, existingConflicts) {
    const conflicts = [...existingConflicts];

    // Compare all common fields
    const localKeys = Object.keys(localData);
    const serverKeys = Object.keys(serverData);
    const allKeys = [...new Set([...localKeys, ...serverKeys])];

    allKeys.forEach(key => {
      if (key === 'id' || key === 'createdAt') return; // Skip immutable fields
      
      const localValue = localData[key];
      const serverValue = serverData[key];

      if (localValue !== serverValue) {
        conflicts.push({
          field: key,
          type: 'generic_mismatch',
          local: localValue,
          server: serverValue,
          severity: 'medium'
        });
      }
    });

    return conflicts;
  }

  // Compare arrays of items (for sales)
  compareItemArrays(localItems, serverItems) {
    const conflicts = [];

    if (localItems.length !== serverItems.length) {
      conflicts.push({
        field: 'items',
        type: 'array_length_mismatch',
        local: localItems.length,
        server: serverItems.length,
        severity: 'high'
      });
    }

    // Compare individual items
    const maxLength = Math.max(localItems.length, serverItems.length);
    for (let i = 0; i < maxLength; i++) {
      const localItem = localItems[i];
      const serverItem = serverItems[i];

      if (!localItem && serverItem) {
        conflicts.push({
          field: `items[${i}]`,
          type: 'missing_local_item',
          local: null,
          server: serverItem,
          severity: 'high'
        });
      } else if (localItem && !serverItem) {
        conflicts.push({
          field: `items[${i}]`,
          type: 'missing_server_item',
          local: localItem,
          server: null,
          severity: 'high'
        });
      } else if (localItem && serverItem) {
        if (JSON.stringify(localItem) !== JSON.stringify(serverItem)) {
          conflicts.push({
            field: `items[${i}]`,
            type: 'item_mismatch',
            local: localItem,
            server: serverItem,
            severity: 'high'
          });
        }
      }
    }

    return conflicts;
  }

  // Suggest resolution strategy based on conflict analysis
  suggestResolution(conflicts, entityType) {
    if (conflicts.length === 0) {
      return { strategy: 'no-conflict', confidence: 100 };
    }

    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    const timestampConflicts = conflicts.filter(c => c.type === 'timestamp');

    // High severity conflicts usually require manual resolution
    if (highSeverityConflicts.length > 0) {
      return { strategy: 'manual', confidence: 90, reason: 'High severity conflicts detected' };
    }

    // For timestamp-only conflicts, prefer newer data
    if (conflicts.length === timestampConflicts.length && timestampConflicts.length > 0) {
      const latestIsLocal = timestampConflicts.some(c => c.local > c.server);
      return {
        strategy: latestIsLocal ? 'client-wins' : 'server-wins',
        confidence: 80,
        reason: 'Timestamp-based resolution'
      };
    }

    // For sales, prefer local data (user was working offline)
    if (entityType === 'sale') {
      return { strategy: 'client-wins', confidence: 70, reason: 'Offline sales priority' };
    }

    // For inventory, prefer server data (might have concurrent updates)
    if (entityType === 'inventory') {
      return { strategy: 'server-wins', confidence: 70, reason: 'Server inventory authority' };
    }

    // Default to manual resolution for complex cases
    return { strategy: 'manual', confidence: 60, reason: 'Complex conflicts require review' };
  }

  // Resolve conflict using specified strategy
  async resolveConflict(conflictId, strategy, manualResolution = null) {
    const conflict = await offlineDataService.getData('conflicts', conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    let resolvedData;

    switch (strategy) {
      case 'client-wins':
        resolvedData = conflict.localData;
        break;
      
      case 'server-wins':
        resolvedData = conflict.serverData;
        break;
      
      case 'merge':
        resolvedData = this.mergeData(conflict.localData, conflict.serverData);
        break;
      
      case 'manual':
        if (!manualResolution) {
          throw new Error('Manual resolution data required');
        }
        resolvedData = manualResolution;
        break;
      
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    // Mark conflict as resolved
    await offlineDataService.resolveConflict(conflictId, {
      strategy,
      resolvedData,
      timestamp: Date.now()
    });

    return resolvedData;
  }

  // Merge local and server data intelligently
  mergeData(localData, serverData) {
    const merged = { ...serverData }; // Start with server data as base

    // Preserve local changes for specific fields
    const preserveLocalFields = ['notes', 'localModifications', 'offlineChanges'];
    
    preserveLocalFields.forEach(field => {
      if (localData[field] !== undefined) {
        merged[field] = localData[field];
      }
    });

    // For arrays, merge intelligently
    Object.keys(localData).forEach(key => {
      if (Array.isArray(localData[key]) && Array.isArray(serverData[key])) {
        merged[key] = this.mergeArrays(localData[key], serverData[key]);
      }
    });

    // Use latest timestamp
    if (localData.updatedAt && serverData.updatedAt) {
      merged.updatedAt = Math.max(localData.updatedAt, serverData.updatedAt);
    }

    return merged;
  }

  // Merge arrays by combining unique items
  mergeArrays(localArray, serverArray) {
    const merged = [...serverArray];
    
    localArray.forEach(localItem => {
      const existsInServer = serverArray.some(serverItem => 
        JSON.stringify(serverItem) === JSON.stringify(localItem)
      );
      
      if (!existsInServer) {
        merged.push(localItem);
      }
    });

    return merged;
  }

  // Get conflict summary for UI display
  getConflictSummary(conflicts) {
    const summary = {
      total: conflicts.length,
      high: conflicts.filter(c => c.severity === 'high').length,
      medium: conflicts.filter(c => c.severity === 'medium').length,
      low: conflicts.filter(c => c.severity === 'low').length,
      types: {}
    };

    conflicts.forEach(conflict => {
      summary.types[conflict.type] = (summary.types[conflict.type] || 0) + 1;
    });

    return summary;
  }

  // Format conflict for user-friendly display
  formatConflictForDisplay(conflict) {
    const fieldLabels = {
      'updatedAt': 'Last Modified',
      'total': 'Total Amount',
      'quantity': 'Stock Quantity',
      'price': 'Price',
      'name': 'Product Name',
      'items': 'Sale Items'
    };

    return {
      field: fieldLabels[conflict.field] || conflict.field,
      type: conflict.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      localValue: this.formatValue(conflict.local),
      serverValue: this.formatValue(conflict.server),
      severity: conflict.severity,
      icon: this.getSeverityIcon(conflict.severity)
    };
  }

  // Format values for display
  formatValue(value) {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'number' && value > 1000000000) {
      return new Date(value).toLocaleString(); // Timestamp
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  // Get icon for severity level
  getSeverityIcon(severity) {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}

// Export singleton instance
const conflictResolver = new ConflictResolver();
export default conflictResolver;