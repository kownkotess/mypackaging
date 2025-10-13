import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateProductQRCode } from '../utils/qrCodeGenerator';

export const generateQRCodeForProduct = async (productId, productName) => {
  try {
    const qrCodeDataURL = await generateProductQRCode(productId, productName);
    
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      qrCode: qrCodeDataURL,
      qrCodeGenerated: true,
      qrCodeUpdatedAt: serverTimestamp()
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code for existing product:', error);
    
    // Update with error status
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      qrCodeGenerated: false,
      qrCodeError: error.message,
      qrCodeUpdatedAt: serverTimestamp()
    });
    
    throw error;
  }
};

export const generateQRCodesForAllProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
    
    const results = {
      total: productsSnapshot.size,
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const productDoc of productsSnapshot.docs) {
      const product = productDoc.data();
      
      // Skip if QR code already exists and is valid
      if (product.qrCodeGenerated && product.qrCode) {
        results.success++;
        continue;
      }
      
      try {
        await generateQRCodeForProduct(productDoc.id, product.name);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          productId: productDoc.id,
          productName: product.name,
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error generating QR codes for all products:', error);
    throw error;
  }
};

// Products operations
export const getProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

export const addProduct = async (productData) => {
  try {
    // Check if product with same name already exists
    const productsRef = collection(db, 'products');
    const nameQuery = query(productsRef, where('name', '==', productData.name.trim()));
    const existingProducts = await getDocs(nameQuery);
    
    if (!existingProducts.empty) {
      throw new Error(`A product with the name "${productData.name}" already exists. Please use a different name.`);
    }

    const docRef = await addDoc(productsRef, {
      ...productData,
      stockBalance: productData.startingStock || 0,
      quantitySold: 0,
      totalPurchased: productData.startingStock || 0,
      createdAt: serverTimestamp()
    });
    
    // Generate QR code for the new product
    try {
      const qrCodeDataURL = await generateProductQRCode(docRef.id, productData.name);
      
      // Update the product with the QR code
      await updateDoc(docRef, {
        qrCode: qrCodeDataURL,
        qrCodeGenerated: true,
        qrCodeUpdatedAt: serverTimestamp()
      });
    } catch (qrError) {
      console.warn('Failed to generate QR code for product:', qrError);
      // Don't fail the entire operation if QR generation fails
      await updateDoc(docRef, {
        qrCodeGenerated: false,
        qrCodeError: qrError.message
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, updates) => {
  try {
    // If name is being updated, check if the new name already exists
    if (updates.name) {
      const productsRef = collection(db, 'products');
      const nameQuery = query(productsRef, where('name', '==', updates.name.trim()));
      const existingProducts = await getDocs(nameQuery);
      
      // Check if any existing product has this name AND it's not the current product being updated
      const duplicateExists = existingProducts.docs.some(doc => doc.id !== productId);
      
      if (duplicateExists) {
        throw new Error(`A product with the name "${updates.name}" already exists. Please use a different name.`);
      }
    }

    // Use transaction for critical field updates that might conflict with stock operations
    const criticalFields = ['name', 'stockBalance', 'quantitySold', 'totalPurchased', 'reorderPoint'];
    const hasCriticalUpdates = Object.keys(updates).some(key => criticalFields.includes(key));
    
    if (hasCriticalUpdates) {
      return await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', productId);
        const productDoc = await transaction.get(productRef);
        
        if (!productDoc.exists()) {
          throw new Error('Product not found');
        }
        
        transaction.update(productRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      });
    } else {
      // Non-critical updates can use simple updateDoc
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

// Subscribe to products changes
export const subscribeProducts = (callback) => {
  const productsRef = collection(db, 'products');
  const q = query(productsRef, orderBy('name'));
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(products);
  });
};

// Sales operations  
export const createSale = async (saleData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // STEP 1: READ ALL PRODUCTS FIRST (before any writes)
      const productReads = [];
      const productRefs = [];
      
      for (const item of saleData.items) {
        const productRef = doc(db, 'products', item.productId);
        productRefs.push(productRef);
        productReads.push(transaction.get(productRef));
      }
      
      // Wait for all product reads to complete
      const productDocs = await Promise.all(productReads);
      
      // Validate all products and stock availability
      const stockUpdates = [];
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const item = saleData.items[i];
        const productRef = productRefs[i];
        
        if (!productDoc.exists()) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const productData = productDoc.data();
        const requiredUnits = calculateRequiredUnits(item, productData);
        
        if (productData.stockBalance < requiredUnits) {
          throw new Error(`Insufficient stock for ${productData.name}`);
        }
        
        // Prepare stock update data
        stockUpdates.push({
          ref: productRef,
          stockBalance: productData.stockBalance - requiredUnits,
          quantitySold: (productData.quantitySold || 0) + requiredUnits
        });
      }

      // STEP 2: PERFORM ALL WRITES (after all reads are complete)
      // Add sale document
      const salesRef = collection(db, 'sales');
      const saleDocRef = doc(salesRef);
      
      transaction.set(saleDocRef, {
        ...saleData,
        createdAt: saleData.customDate ? Timestamp.fromDate(new Date(saleData.customDate)) : serverTimestamp(),
        status: saleData.remaining > 0 ? 'Hutang' : 'Paid'
      });

      // Update product stock for each item
      stockUpdates.forEach(update => {
        transaction.update(update.ref, {
          stockBalance: update.stockBalance,
          quantitySold: update.quantitySold,
          updatedAt: serverTimestamp()
        });
      });

      // Add line items
      saleData.items.forEach(item => {
        const lineItemRef = collection(db, 'sales', saleDocRef.id, 'lineItems');
        transaction.set(doc(lineItemRef), {
          ...item,
          createdAt: serverTimestamp()
        });
      });

      return saleDocRef.id;
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

// Helper function to calculate required units
const calculateRequiredUnits = (item, productData) => {
  const qtyBox = Number(item.qtyBox) || 0;
  const qtyPack = Number(item.qtyPack) || 0;
  const qtyLoose = Number(item.qtyLoose) || 0;
  
  const bigBulkQty = Number(productData.bigBulkQty) || 1;
  const smallBulkQty = Number(productData.smallBulkQty) || 1;
  
  return (qtyBox * bigBulkQty) + (qtyPack * smallBulkQty) + qtyLoose;
};

// Purchases operations
export const createPurchase = async (purchaseData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // STEP 1: READ ALL PRODUCTS FIRST (if status is received)
      let productReads = [];
      let productRefs = [];
      let stockUpdates = [];

      if (purchaseData.status === '✅ Received' && purchaseData.items) {
        for (const item of purchaseData.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }
        
        // Wait for all product reads to complete
        const productDocs = await Promise.all(productReads);
        
        // Prepare stock updates
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = purchaseData.items[i];
          const productRef = productRefs[i];
          
          if (productDoc.exists()) {
            const productData = productDoc.data();
            const qty = Number(item.qty) || 0;
            
            stockUpdates.push({
              ref: productRef,
              stockBalance: (productData.stockBalance || 0) + qty,
              totalPurchased: (productData.totalPurchased || 0) + qty
            });
          }
        }
      }

      // STEP 2: PERFORM ALL WRITES
      // Add purchase document
      const purchasesRef = collection(db, 'purchases');
      const purchaseDocRef = doc(purchasesRef);
      
      transaction.set(purchaseDocRef, {
        ...purchaseData,
        createdAt: purchaseData.customDate ? Timestamp.fromDate(new Date(purchaseData.customDate)) : serverTimestamp()
      });

      // Update product stock if status is received
      stockUpdates.forEach(update => {
        transaction.update(update.ref, {
          stockBalance: update.stockBalance,
          totalPurchased: update.totalPurchased,
          updatedAt: serverTimestamp()
        });
      });

      // Add line items
      if (purchaseData.items) {
        purchaseData.items.forEach(item => {
          const lineItemRef = collection(db, 'purchases', purchaseDocRef.id, 'lineItems');
          transaction.set(doc(lineItemRef), {
            ...item,
            createdAt: serverTimestamp()
          });
        });
      }

      return purchaseDocRef.id;
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    throw error;
  }
};

// Subscribe to purchases with real-time updates
export const subscribePurchases = (callback) => {
  const purchasesRef = collection(db, 'purchases');
  const q = query(purchasesRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const purchases = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(purchases);
  }, (error) => {
    console.error('Error subscribing to purchases:', error);
    callback([]);
  });
};

// Update purchase (mainly for status changes)
export const updatePurchase = async (purchaseId, updateData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const purchaseRef = doc(db, 'purchases', purchaseId);
      const purchaseDoc = await transaction.get(purchaseRef);
      
      if (!purchaseDoc.exists()) {
        throw new Error('Purchase not found');
      }
      
      const currentPurchase = purchaseDoc.data();
      const newStatus = updateData.status;
      const oldStatus = currentPurchase.status;
      
      // STEP 1: First, remove any previously added stock if we're transitioning FROM a received state
      if ((oldStatus === '✅ Received' || oldStatus === '📦❗ Received Partial') && 
          currentPurchase.items) {
        // Read all products first
        const productReads = [];
        const productRefs = [];
        
        for (const item of currentPurchase.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }
        
        const productDocs = await Promise.all(productReads);
        
        // Remove previously added stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = currentPurchase.items[i];
          const productRef = productRefs[i];
          
          if (productDoc.exists()) {
            const productData = productDoc.data();
            
            // Remove the quantity that was previously added
            let qtyToRemove;
            if (oldStatus === '📦❗ Received Partial') {
              qtyToRemove = Number(item.receivedQty) || 0;
            } else {
              qtyToRemove = Number(item.qty) || 0;
            }
            
            if (qtyToRemove > 0) {
              transaction.update(productRef, {
                stockBalance: Math.max(0, (productData.stockBalance || 0) - qtyToRemove),
                totalPurchased: Math.max(0, (productData.totalPurchased || 0) - qtyToRemove),
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }
      
      // STEP 2: Then, add new stock if we're transitioning TO a received state
      if ((newStatus === '✅ Received' || newStatus === '📦❗ Received Partial') && 
          currentPurchase.items) {
        // Use updated items if provided (for partial delivery), otherwise use current items
        const itemsToProcess = updateData.items || currentPurchase.items;
        
        // Read all products first (may have been updated in STEP 1)
        const productReads = [];
        const productRefs = [];
        
        for (const item of itemsToProcess) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }
        
        const productDocs = await Promise.all(productReads);
        
        // Add new stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = itemsToProcess[i];
          const productRef = productRefs[i];
          
          if (productDoc.exists()) {
            const productData = productDoc.data();
            
            // For partial deliveries, use received quantity; for full delivery, use ordered quantity
            let qtyToAdd;
            if (newStatus === '📦❗ Received Partial') {
              qtyToAdd = Number(item.receivedQty) || 0;
            } else if (newStatus === '✅ Received') {
              qtyToAdd = Number(item.qty) || 0;
            }
            
            if (qtyToAdd > 0) {
              transaction.update(productRef, {
                stockBalance: (productData.stockBalance || 0) + qtyToAdd,
                totalPurchased: (productData.totalPurchased || 0) + qtyToAdd,
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }
      
      // Update the purchase document
      transaction.update(purchaseRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      return purchaseId;
    });
  } catch (error) {
    console.error('Error updating purchase:', error);
    throw error;
  }
};

// Bulk operations with batched writes
export const bulkUpdateProducts = async (updates) => {
  try {
    const maxBatchSize = 500; // Firestore limit is 500 operations per batch
    
    // Split into chunks if needed
    const chunks = [];
    for (let i = 0; i < updates.length; i += maxBatchSize) {
      chunks.push(updates.slice(i, i + maxBatchSize));
    }
    
    for (const chunk of chunks) {
      const currentBatch = writeBatch(db);
      
      for (const update of chunk) {
        const { productId, ...updateData } = update;
        const productRef = doc(db, 'products', productId);
        currentBatch.update(productRef, {
          ...updateData,
          updatedAt: serverTimestamp()
        });
      }
      
      await currentBatch.commit();
    }
    
    return { success: true, updatedCount: updates.length };
  } catch (error) {
    console.error('Error in bulk update:', error);
    throw error;
  }
};

// Bulk stock adjustments with transaction safety
export const bulkStockAdjustment = async (adjustments) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // Read all products first
      const productRefs = adjustments.map(adj => doc(db, 'products', adj.productId));
      const productDocs = await Promise.all(
        productRefs.map(ref => transaction.get(ref))
      );
      
      // Validate all products exist and calculate new values
      const updates = [];
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const adjustment = adjustments[i];
        
        if (!productDoc.exists()) {
          throw new Error(`Product ${adjustment.productId} not found`);
        }
        
        const currentData = productDoc.data();
        const newStockBalance = (currentData.stockBalance || 0) + (adjustment.adjustmentQty || 0);
        
        if (newStockBalance < 0) {
          throw new Error(`Cannot adjust ${currentData.name} stock below zero`);
        }
        
        updates.push({
          ref: productRefs[i],
          stockBalance: newStockBalance,
          adjustmentReason: adjustment.reason || 'Bulk adjustment',
          lastAdjustment: adjustment.adjustmentQty
        });
      }
      
      // Apply all updates
      updates.forEach(update => {
        transaction.update(update.ref, {
          stockBalance: update.stockBalance,
          lastAdjustment: update.lastAdjustment,
          adjustmentReason: update.adjustmentReason,
          updatedAt: serverTimestamp()
        });
      });
      
      return { success: true, adjustedCount: adjustments.length };
    });
  } catch (error) {
    console.error('Error in bulk stock adjustment:', error);
    throw error;
  }
};

// Get unique customer names from sales
export const getUniqueCustomerNames = async () => {
  try {
    const salesRef = collection(db, 'sales');
    const salesSnapshot = await getDocs(salesRef);
    
    const customerNamesSet = new Set();
    salesSnapshot.forEach(doc => {
      const customerName = doc.data().customerName;
      if (customerName && customerName.trim() && customerName.toLowerCase() !== 'walk in') {
        customerNamesSet.add(customerName.trim());
      }
    });
    
    return Array.from(customerNamesSet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  } catch (error) {
    console.error('Error getting unique customer names:', error);
    return [];
  }
};

// ============================================
// RETURNS OPERATIONS (Task 1)
// ============================================

// Create a return - this will DECREASE product stock (items sent back to supplier)
// and increment totalReturned. Deletion of the return will restore stock.
export const createReturn = async (returnData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // STEP 1: READ ALL PRODUCTS FIRST
      const productReads = [];
      const productRefs = [];
      const stockUpdates = [];

      if (returnData.items) {
        for (const item of returnData.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }

        // Wait for all product reads to complete
        const productDocs = await Promise.all(productReads);

        // Prepare stock updates (subtract quantities for returns)
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = returnData.items[i];
          const productRef = productRefs[i];

          if (productDoc.exists()) {
            const productData = productDoc.data();
            const qty = Number(item.qty) || 0;

            // Ensure we do not allow negative stock
            const newStockBalance = Math.max(0, (productData.stockBalance || 0) - qty);
            const newTotalReturned = (productData.totalReturned || 0) + qty;

            stockUpdates.push({
              ref: productRef,
              stockBalance: newStockBalance,
              totalReturned: newTotalReturned
            });
          } else {
            throw new Error(`Product ${item.productId} not found`);
          }
        }
      }

      // STEP 2: PERFORM ALL WRITES
      // Add return document
      const returnsRef = collection(db, 'returns');
      const returnDocRef = doc(returnsRef);

      transaction.set(returnDocRef, {
        ...returnData,
        createdAt: returnData.customDate ? Timestamp.fromDate(new Date(returnData.customDate)) : serverTimestamp()
      });

      // Update product stock (subtract quantities)
      stockUpdates.forEach(update => {
        transaction.update(update.ref, {
          stockBalance: update.stockBalance,
          totalReturned: update.totalReturned,
          updatedAt: serverTimestamp()
        });
      });

      return returnDocRef.id;
    });
  } catch (error) {
    console.error('Error creating return:', error);
    throw error;
  }
};

// Subscribe to returns with real-time updates
export const subscribeReturns = (callback) => {
  const returnsRef = collection(db, 'returns');
  const q = query(returnsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const returns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(returns);
  }, (error) => {
    console.error('Error subscribing to returns:', error);
    callback([]);
  });
};

// Delete a return - restore stock that was subtracted when the return was created (admin only)
export const deleteReturn = async (returnId) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const returnRef = doc(db, 'returns', returnId);
      const returnDoc = await transaction.get(returnRef);

      if (!returnDoc.exists()) {
        throw new Error('Return not found');
      }

      const returnData = returnDoc.data();

      // STEP 1: Restore the stock that was subtracted when return was created
      if (returnData.items) {
        const productReads = [];
        const productRefs = [];

        for (const item of returnData.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }

        const productDocs = await Promise.all(productReads);

        // Restore stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = returnData.items[i];
          const productRef = productRefs[i];

          if (productDoc.exists()) {
            const productData = productDoc.data();
            const qtyToRestore = Number(item.qty) || 0;

            if (qtyToRestore > 0) {
              transaction.update(productRef, {
                stockBalance: (productData.stockBalance || 0) + qtyToRestore,
                totalReturned: Math.max(0, (productData.totalReturned || 0) - qtyToRestore),
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }

      // STEP 2: Delete the return document
      transaction.delete(returnRef);

      return returnId;
    });
  } catch (error) {
    console.error('Error deleting return:', error);
    throw error;
  }
};

// ============================================
// SHOP OPERATIONS (Task 2)
// ============================================

// SHOP USE: Record items used in shop (damaged, samples, personal use)
// Deducts from stock balance. Only admin can delete (restores stock).
export const createShopUse = async (shopUseData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // STEP 1: READ ALL PRODUCTS FIRST
      const productReads = [];
      const productRefs = [];
      const stockUpdates = [];

      if (shopUseData.items) {
        for (const item of shopUseData.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }

        // Wait for all product reads to complete
        const productDocs = await Promise.all(productReads);

        // Prepare stock updates (subtract quantities for shop use)
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = shopUseData.items[i];
          const productRef = productRefs[i];

          if (productDoc.exists()) {
            const productData = productDoc.data();
            const qty = Number(item.qty) || 0;

            // Ensure we do not allow negative stock
            const newStockBalance = Math.max(0, (productData.stockBalance || 0) - qty);
            const newTotalShopUse = (productData.totalShopUse || 0) + qty;

            stockUpdates.push({
              ref: productRef,
              stockBalance: newStockBalance,
              totalShopUse: newTotalShopUse
            });
          } else {
            throw new Error(`Product ${item.productId} not found`);
          }
        }
      }

      // STEP 2: PERFORM ALL WRITES
      // Add shop use document
      const shopUsesRef = collection(db, 'shopUses');
      const shopUseDocRef = doc(shopUsesRef);

      transaction.set(shopUseDocRef, {
        ...shopUseData,
        createdAt: shopUseData.customDate ? Timestamp.fromDate(new Date(shopUseData.customDate)) : serverTimestamp()
      });

      // Update product stock (subtract quantities)
      stockUpdates.forEach(update => {
        transaction.update(update.ref, {
          stockBalance: update.stockBalance,
          totalShopUse: update.totalShopUse,
          updatedAt: serverTimestamp()
        });
      });

      return shopUseDocRef.id;
    });
  } catch (error) {
    console.error('Error creating shop use:', error);
    throw error;
  }
};

// Subscribe to shop uses in real-time
export const subscribeShopUses = (callback) => {
  const q = query(collection(db, 'shopUses'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const shopUses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(shopUses);
  }, (error) => {
    console.error('Error subscribing to shop uses:', error);
    callback([]);
  });
};

// Delete shop use (admin only) - restores stock
export const deleteShopUse = async (shopUseId, shopUseData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const shopUseRef = doc(db, 'shopUses', shopUseId);

      // STEP 1: READ ALL PRODUCTS FIRST
      const productReads = [];
      const productRefs = [];

      if (shopUseData.items) {
        for (const item of shopUseData.items) {
          const productRef = doc(db, 'products', item.productId);
          productRefs.push(productRef);
          productReads.push(transaction.get(productRef));
        }

        // Wait for all product reads to complete
        const productDocs = await Promise.all(productReads);

        // Restore stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = shopUseData.items[i];
          const productRef = productRefs[i];

          if (productDoc.exists()) {
            const productData = productDoc.data();
            const qtyToRestore = Number(item.qty) || 0;

            if (qtyToRestore > 0) {
              transaction.update(productRef, {
                stockBalance: (productData.stockBalance || 0) + qtyToRestore,
                totalShopUse: Math.max(0, (productData.totalShopUse || 0) - qtyToRestore),
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }

      // STEP 2: Delete the shop use document
      transaction.delete(shopUseRef);

      return shopUseId;
    });
  } catch (error) {
    console.error('Error deleting shop use:', error);
    throw error;
  }
};

// ============================================
// TRANSFER OPERATIONS (Task 2)
// ============================================

// TRANSFER: Convert units between products (e.g., 1 roll of 100m bubble wrap → 100 x 1m pieces)
// Deducts from source product, adds to target product based on conversion rate
export const createTransfer = async (transferData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // Get both source and target products
      const sourceProductRef = doc(db, 'products', transferData.sourceProductId);
      const targetProductRef = doc(db, 'products', transferData.targetProductId);

      const sourceProductDoc = await transaction.get(sourceProductRef);
      const targetProductDoc = await transaction.get(targetProductRef);

      if (!sourceProductDoc.exists()) {
        throw new Error('Source product not found');
      }
      if (!targetProductDoc.exists()) {
        throw new Error('Target product not found');
      }

      const sourceProductData = sourceProductDoc.data();
      const targetProductData = targetProductDoc.data();

      const sourceQty = Number(transferData.sourceQty) || 0;
      const targetQty = Number(transferData.targetQty) || 0;

      // Calculate new stock balances
      const newSourceStock = Math.max(0, (sourceProductData.stockBalance || 0) - sourceQty);
      const newTargetStock = (targetProductData.stockBalance || 0) + targetQty;

      // Create transfer document
      const transfersRef = collection(db, 'transfers');
      const transferDocRef = doc(transfersRef);

      transaction.set(transferDocRef, {
        ...transferData,
        createdAt: transferData.customDate ? Timestamp.fromDate(new Date(transferData.customDate)) : serverTimestamp()
      });

      // Update source product (deduct)
      transaction.update(sourceProductRef, {
        stockBalance: newSourceStock,
        totalTransferredOut: (sourceProductData.totalTransferredOut || 0) + sourceQty,
        updatedAt: serverTimestamp()
      });

      // Update target product (add)
      transaction.update(targetProductRef, {
        stockBalance: newTargetStock,
        totalTransferredIn: (targetProductData.totalTransferredIn || 0) + targetQty,
        updatedAt: serverTimestamp()
      });

      return transferDocRef.id;
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    throw error;
  }
};

// Subscribe to transfers in real-time
export const subscribeTransfers = (callback) => {
  const q = query(collection(db, 'transfers'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const transfers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(transfers);
  }, (error) => {
    console.error('Error subscribing to transfers:', error);
    callback([]);
  });
};

// Delete transfer (admin only) - reverses the transfer
export const deleteTransfer = async (transferId, transferData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const transferRef = doc(db, 'transfers', transferId);

      // Get both source and target products
      const sourceProductRef = doc(db, 'products', transferData.sourceProductId);
      const targetProductRef = doc(db, 'products', transferData.targetProductId);

      const sourceProductDoc = await transaction.get(sourceProductRef);
      const targetProductDoc = await transaction.get(targetProductRef);

      if (sourceProductDoc.exists() && targetProductDoc.exists()) {
        const sourceProductData = sourceProductDoc.data();
        const targetProductData = targetProductDoc.data();

        const sourceQty = Number(transferData.sourceQty) || 0;
        const targetQty = Number(transferData.targetQty) || 0;

        // Reverse the transfer: add back to source, subtract from target
        transaction.update(sourceProductRef, {
          stockBalance: (sourceProductData.stockBalance || 0) + sourceQty,
          totalTransferredOut: Math.max(0, (sourceProductData.totalTransferredOut || 0) - sourceQty),
          updatedAt: serverTimestamp()
        });

        transaction.update(targetProductRef, {
          stockBalance: Math.max(0, (targetProductData.stockBalance || 0) - targetQty),
          totalTransferredIn: Math.max(0, (targetProductData.totalTransferredIn || 0) - targetQty),
          updatedAt: serverTimestamp()
        });
      }

      // Delete the transfer document
      transaction.delete(transferRef);

      return transferId;
    });
  } catch (error) {
    console.error('Error deleting transfer:', error);
    throw error;
  }
};

// ============================================
// STOCK AUDIT OPERATIONS (Task 2)
// ============================================

// STOCK AUDIT: Manual stock adjustment with admin password verification
// Adjusts stock to match actual count. Creates permanent audit trail.
export const createStockAudit = async (auditData) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', auditData.productId);
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      const productData = productDoc.data();
      const currentStock = productData.stockBalance || 0;
      const actualStock = Number(auditData.actualStock) || 0;
      const difference = actualStock - currentStock;

      // Create audit document
      const auditsRef = collection(db, 'stockAudits');
      const auditDocRef = doc(auditsRef);

      transaction.set(auditDocRef, {
        ...auditData,
        currentStock: currentStock,
        actualStock: actualStock,
        difference: difference,
        createdAt: serverTimestamp()
      });

      // Update product stock to actual count
      transaction.update(productRef, {
        stockBalance: actualStock,
        lastAuditDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return auditDocRef.id;
    });
  } catch (error) {
    console.error('Error creating stock audit:', error);
    throw error;
  }
};

// Subscribe to stock audits in real-time
export const subscribeStockAudits = (callback) => {
  const q = query(collection(db, 'stockAudits'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const audits = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(audits);
  }, (error) => {
    console.error('Error subscribing to stock audits:', error);
    callback([]);
  });
};

const firestoreUtils = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribeProducts,
  createSale,
  createPurchase,
  updatePurchase,
  subscribePurchases,
  createReturn,
  subscribeReturns,
  deleteReturn,
  createShopUse,
  subscribeShopUses,
  deleteShopUse,
  createTransfer,
  subscribeTransfers,
  deleteTransfer,
  createStockAudit,
  subscribeStockAudits,
  bulkUpdateProducts,
  bulkStockAdjustment,
  getUniqueCustomerNames
};

export default firestoreUtils;
