// MyPackaging PWA Service Worker
// Provides offline functionality and caching strategies

const CACHE_NAME = 'mypackaging-v1.0.4'; // Updated version to force refresh - Mobile UI fixes
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// Install Service Worker and cache resources
addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('[SW] Caching failed:', error);
      })
  );
});

// Activate Service Worker and clean up old caches
addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
});

// Fetch Strategy: Cache First for static assets, Network First for API calls
addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip non-GET requests for API calls - don't try to cache them
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
    // For API calls, just fetch without caching POST/PUT/DELETE requests
    event.respondWith(
      fetch(request).catch(() => {
        // For GET requests, try cache as fallback
        if (request.method === 'GET') {
          return caches.match(request);
        }
        // For other methods, return offline response
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Network First Strategy for app files (HTML, JS, CSS) - Always get latest!
  // Cache First for images and static assets only
  if (request.method === 'GET') {
    const isAppFile = url.pathname.endsWith('.html') || 
                      url.pathname.endsWith('.js') || 
                      url.pathname.endsWith('.css') ||
                      url.pathname === '/' ||
                      url.pathname.includes('/static/');
    
    if (isAppFile) {
      // NETWORK FIRST for app files - always try to get latest version
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Clone and cache the new version
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // If network fails (offline), use cache as fallback
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Last resort: return index for navigation
              if (request.destination === 'document') {
                return caches.match('/');
              }
              return new Response('Offline', { status: 503 });
            });
          })
      );
    } else {
      // CACHE FIRST for images and other assets
      event.respondWith(
        caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return fetch(request).then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
              return response;
            });
          })
      );
    }
  }
});

// Background Sync for offline actions
addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncOfflineSales());
  }
  
  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncOfflineInventory());
  }
});

// Sync offline sales when connection is restored
async function syncOfflineSales() {
  try {
    console.log('[SW] Syncing offline sales...');
    
    // Open IndexedDB to get pending sales
    const db = await openOfflineDB();
    if (!db) return;
    
    const transaction = db.transaction(['pendingSales'], 'readonly');
    const store = transaction.objectStore('pendingSales');
    const index = store.index('syncStatus');
    const pendingSales = await getFromIndex(index, 'pending');
    
    console.log(`[SW] Found ${pendingSales.length} pending sales to sync`);
    
    for (const sale of pendingSales) {
      try {
        await syncSaleToFirestore(sale);
        await updateSaleStatus(db, sale.id, 'completed');
        console.log('[SW] Synced sale:', sale.id);
      } catch (error) {
        console.log('[SW] Failed to sync sale:', sale.id, error);
        await updateSaleStatus(db, sale.id, 'failed', error.message);
      }
    }
    
    db.close();
    return Promise.resolve();
  } catch (error) {
    console.log('[SW] Background sync failed:', error);
    return Promise.reject(error);
  }
}

// Sync offline inventory updates
async function syncOfflineInventory() {
  try {
    console.log('[SW] Syncing offline inventory...');
    
    const db = await openOfflineDB();
    if (!db) return;
    
    const transaction = db.transaction(['pendingInventory'], 'readonly');
    const store = transaction.objectStore('pendingInventory');
    const index = store.index('syncStatus');
    const pendingUpdates = await getFromIndex(index, 'pending');
    
    console.log(`[SW] Found ${pendingUpdates.length} pending inventory updates to sync`);
    
    for (const update of pendingUpdates) {
      try {
        await syncInventoryToFirestore(update);
        await updateInventoryStatus(db, update.id, 'completed');
        console.log('[SW] Synced inventory:', update.id);
      } catch (error) {
        console.log('[SW] Failed to sync inventory:', update.id, error);
        await updateInventoryStatus(db, update.id, 'failed', error.message);
      }
    }
    
    db.close();
    return Promise.resolve();
  } catch (error) {
    console.log('[SW] Inventory sync failed:', error);
    return Promise.reject(error);
  }
}

// Helper functions for IndexedDB operations
async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MyPackagingOfflineDB', 1);
    
    request.onerror = () => {
      console.error('[SW] IndexedDB error:', request.error);
      resolve(null);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = () => {
      // DB upgrade would be handled by the main app
      resolve(null);
    };
  });
}

async function getFromIndex(index, value) {
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      console.error('[SW] Index query error:', request.error);
      resolve([]);
    };
  });
}

async function updateSaleStatus(db, saleId, status, error = null) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingSales'], 'readwrite');
    const store = transaction.objectStore('pendingSales');
    const getRequest = store.get(saleId);
    
    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      if (sale) {
        sale.syncStatus = status;
        sale.lastAttempt = Date.now();
        sale.attempts = (sale.attempts || 0) + 1;
        
        if (error) {
          sale.lastError = error;
        }
        
        const putRequest = store.put(sale);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function updateInventoryStatus(db, updateId, status, error = null) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingInventory'], 'readwrite');
    const store = transaction.objectStore('pendingInventory');
    const getRequest = store.get(updateId);
    
    getRequest.onsuccess = () => {
      const update = getRequest.result;
      if (update) {
        update.syncStatus = status;
        update.lastAttempt = Date.now();
        update.attempts = (update.attempts || 0) + 1;
        
        if (error) {
          update.lastError = error;
        }
        
        const putRequest = store.put(update);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function syncSaleToFirestore(sale) {
  // In a real implementation, this would make an API call to your backend
  // For now, we'll simulate the sync process
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sale)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

async function syncInventoryToFirestore(update) {
  // In a real implementation, this would make an API call to your backend
  const response = await fetch('/api/inventory', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

// Push notifications for important updates
addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from MyPackaging',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png'
      }
    ]
  };

  event.waitUntil(
    registration.showNotification('MyPackaging Update', options)
  );
});

// Handle notification clicks
addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received.');

  event.notification.close();

  if (event.action === 'explore') {
    // Open the app when notification is clicked
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker loaded successfully');