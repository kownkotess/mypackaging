import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
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
    const productsRef = collection(db, 'products');
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
        createdAt: serverTimestamp(),
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
        createdAt: serverTimestamp()
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

const firestoreUtils = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribeProducts,
  createSale,
  createPurchase,
  subscribePurchases
};

export default firestoreUtils;