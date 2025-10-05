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
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';

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

    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
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
      
      // If changing status to "Received" or "Received Partial", update stock levels
      if ((newStatus === '✅ Received' || newStatus === '📦❗ Received Partial') && 
          oldStatus !== '✅ Received' && oldStatus !== '📦❗ Received Partial' && 
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
        
        // Update stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = currentPurchase.items[i];
          const productRef = productRefs[i];
          
          if (productDoc.exists()) {
            const productData = productDoc.data();
            
            // For partial deliveries, use received quantity; for full delivery, use ordered quantity
            let qtyToAdd;
            if (newStatus === '📦❗ Received Partial') {
              qtyToAdd = Number(item.receivedQty) || 0;
            } else {
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
      
      // If changing status from "Received" or "Received Partial" to something else, remove stock
      if ((oldStatus === '✅ Received' || oldStatus === '📦❗ Received Partial') && 
          newStatus !== '✅ Received' && newStatus !== '📦❗ Received Partial' && 
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
        
        // Remove stock for each product
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const item = currentPurchase.items[i];
          const productRef = productRefs[i];
          
          if (productDoc.exists()) {
            const productData = productDoc.data();
            
            // For partial deliveries, remove received quantity; for full delivery, remove ordered quantity
            let qtyToRemove;
            if (oldStatus === '📦❗ Received Partial') {
              qtyToRemove = Number(item.receivedQty) || 0;
            } else {
              qtyToRemove = Number(item.qty) || 0;
            }
            
            transaction.update(productRef, {
              stockBalance: Math.max(0, (productData.stockBalance || 0) - qtyToRemove),
              totalPurchased: Math.max(0, (productData.totalPurchased || 0) - qtyToRemove),
              updatedAt: serverTimestamp()
            });
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

const firestoreUtils = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribeProducts,
  createSale,
  createPurchase,
  updatePurchase,
  subscribePurchases
};

export default firestoreUtils;
