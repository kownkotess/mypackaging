import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContextWrapper';
import { useAlert } from '../context/AlertContext';

const DataCleanup = () => {
  const { user, userRole } = useAuth();
  const { showSuccess, showError, showConfirm } = useAlert();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const analyzeData = async () => {
    setLoading(true);
    try {
      // Calculate cutoff date - 24 months ago from today
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 24);
      
      console.log(`Analyzing data older than: ${cutoffDate.toLocaleDateString()}`);
      
      // Get all collections (except products)
      const [
        paymentsSnapshot,
        salesSnapshot,
        purchasesSnapshot,
        returnsSnapshot,
        shopUsesSnapshot,
        transfersSnapshot,
        extraCashSnapshot,
        stockAuditsSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'returns')),
        getDocs(collection(db, 'shopUses')),
        getDocs(collection(db, 'transfers')),
        getDocs(collection(db, 'extraCash')),
        getDocs(collection(db, 'stockAudits'))
      ]);
      
      console.log(`Found ${paymentsSnapshot.size} payments`);
      console.log(`Found ${salesSnapshot.size} sales`);
      console.log(`Found ${purchasesSnapshot.size} purchases`);
      console.log(`Found ${returnsSnapshot.size} returns`);
      console.log(`Found ${shopUsesSnapshot.size} shop uses`);
      console.log(`Found ${transfersSnapshot.size} transfers`);
      console.log(`Found ${extraCashSnapshot.size} extra cash records`);
      console.log(`Found ${stockAuditsSnapshot.size} stock audits`);
      
      let paymentsToDelete = [];
      let salesToDelete = [];
      let purchasesToDelete = [];
      let returnsToDelete = [];
      let shopUsesToDelete = [];
      let transfersToDelete = [];
      let extraCashToDelete = [];
      let stockAuditsToDelete = [];
      
      let paymentsToKeep = [];
      let salesToKeep = [];
      let purchasesToKeep = [];
      let returnsToKeep = [];
      let shopUsesToKeep = [];
      let transfersToKeep = [];
      let extraCashToKeep = [];
      let stockAuditsToKeep = [];
      
      // Analyze payments
      paymentsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          paymentsToDelete.push({
            id: docSnapshot.id,
            amount: data.amount,
            customerName: data.customerName,
            createdAt: createdAt
          });
        } else {
          paymentsToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze sales
      salesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          salesToDelete.push({
            id: docSnapshot.id,
            total: data.total,
            customerName: data.customerName,
            createdAt: createdAt
          });
        } else {
          salesToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze purchases
      purchasesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          purchasesToDelete.push({
            id: docSnapshot.id,
            supplierName: data.supplierName,
            totalCost: data.totalCost,
            createdAt: createdAt
          });
        } else {
          purchasesToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze returns
      returnsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          returnsToDelete.push({
            id: docSnapshot.id,
            supplierName: data.supplierName,
            createdAt: createdAt
          });
        } else {
          returnsToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze shop uses
      shopUsesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          shopUsesToDelete.push({
            id: docSnapshot.id,
            reason: data.reason,
            createdAt: createdAt
          });
        } else {
          shopUsesToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze transfers
      transfersSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          transfersToDelete.push({
            id: docSnapshot.id,
            fromProduct: data.fromProductName,
            toProduct: data.toProductName,
            createdAt: createdAt
          });
        } else {
          transfersToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze extra cash
      extraCashSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          extraCashToDelete.push({
            id: docSnapshot.id,
            amount: data.amount,
            notes: data.notes,
            createdAt: createdAt
          });
        } else {
          extraCashToKeep.push({ id: docSnapshot.id });
        }
      });
      
      // Analyze stock audits
      stockAuditsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt && createdAt < cutoffDate) {
          stockAuditsToDelete.push({
            id: docSnapshot.id,
            notes: data.notes,
            createdAt: createdAt
          });
        } else {
          stockAuditsToKeep.push({ id: docSnapshot.id });
        }
      });
      
      setAnalysis({
        paymentsToDelete,
        salesToDelete,
        purchasesToDelete,
        returnsToDelete,
        shopUsesToDelete,
        transfersToDelete,
        extraCashToDelete,
        stockAuditsToDelete,
        paymentsToKeep,
        salesToKeep,
        purchasesToKeep,
        returnsToKeep,
        shopUsesToKeep,
        transfersToKeep,
        extraCashToKeep,
        stockAuditsToKeep,
        cutoffDate
      });
      
      const totalToDelete = paymentsToDelete.length + salesToDelete.length + 
                           purchasesToDelete.length + returnsToDelete.length +
                           shopUsesToDelete.length + transfersToDelete.length +
                           extraCashToDelete.length + stockAuditsToDelete.length;
      
      console.log('Analysis Results:');
      console.log(`Total records to delete: ${totalToDelete}`);
      console.log(`  - Payments: ${paymentsToDelete.length}`);
      console.log(`  - Sales: ${salesToDelete.length}`);
      console.log(`  - Purchases: ${purchasesToDelete.length}`);
      console.log(`  - Returns: ${returnsToDelete.length}`);
      console.log(`  - Shop Uses: ${shopUsesToDelete.length}`);
      console.log(`  - Transfers: ${transfersToDelete.length}`);
      console.log(`  - Extra Cash: ${extraCashToDelete.length}`);
      console.log(`  - Stock Audits: ${stockAuditsToDelete.length}`);
      
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError('Failed to analyze data');
    }
    setLoading(false);
  };

  const performCleanup = async () => {
    if (!analysis) return;
    
    const totalToDelete = analysis.paymentsToDelete.length + analysis.salesToDelete.length + 
                         analysis.purchasesToDelete.length + analysis.returnsToDelete.length +
                         analysis.shopUsesToDelete.length + analysis.transfersToDelete.length +
                         analysis.extraCashToDelete.length + analysis.stockAuditsToDelete.length;
    
    const confirmed = await showConfirm(
      'Delete Old Data (24+ months)',
      `This will permanently delete ${totalToDelete} records older than ${analysis.cutoffDate.toLocaleDateString()}:\n\n` +
      `• ${analysis.paymentsToDelete.length} payments\n` +
      `• ${analysis.salesToDelete.length} sales\n` +
      `• ${analysis.purchasesToDelete.length} purchases\n` +
      `• ${analysis.returnsToDelete.length} returns\n` +
      `• ${analysis.shopUsesToDelete.length} shop uses\n` +
      `• ${analysis.transfersToDelete.length} transfers\n` +
      `• ${analysis.extraCashToDelete.length} extra cash\n` +
      `• ${analysis.stockAuditsToDelete.length} stock audits\n\n` +
      `This cannot be undone. Continue?`
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    try {
      let deletedCount = 0;
      
      // Delete old payments
      for (const payment of analysis.paymentsToDelete) {
        await deleteDoc(doc(db, 'payments', payment.id));
        deletedCount++;
      }
      
      // Delete old sales
      for (const sale of analysis.salesToDelete) {
        await deleteDoc(doc(db, 'sales', sale.id));
        deletedCount++;
      }
      
      // Delete old purchases
      for (const purchase of analysis.purchasesToDelete) {
        await deleteDoc(doc(db, 'purchases', purchase.id));
        deletedCount++;
      }
      
      // Delete old returns
      for (const returnDoc of analysis.returnsToDelete) {
        await deleteDoc(doc(db, 'returns', returnDoc.id));
        deletedCount++;
      }
      
      // Delete old shop uses
      for (const shopUse of analysis.shopUsesToDelete) {
        await deleteDoc(doc(db, 'shopUses', shopUse.id));
        deletedCount++;
      }
      
      // Delete old transfers
      for (const transfer of analysis.transfersToDelete) {
        await deleteDoc(doc(db, 'transfers', transfer.id));
        deletedCount++;
      }
      
      // Delete old extra cash
      for (const extraCash of analysis.extraCashToDelete) {
        await deleteDoc(doc(db, 'extraCash', extraCash.id));
        deletedCount++;
      }
      
      // Delete old stock audits
      for (const stockAudit of analysis.stockAuditsToDelete) {
        await deleteDoc(doc(db, 'stockAudits', stockAudit.id));
        deletedCount++;
      }
      
      showSuccess(
        `Cleanup completed! Deleted ${deletedCount} records older than 24 months.\n` +
        `Products were NOT affected.`
      );
      setAnalysis(null);
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      showError('Failed to clean up data');
    }
    setLoading(false);
  };

  if (!user || userRole !== 'admin') {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🧹 Database Cleanup Tool</h2>
      <p>
        This tool deletes records older than <strong>24 months (2 years)</strong> to keep your database clean.
        <br />
        <strong>Products are never deleted</strong> - only transaction records.
      </p>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <strong>What will be cleaned:</strong>
        <ul style={{ marginTop: '10px', marginBottom: '0' }}>
          <li>Sales (older than 24 months)</li>
          <li>Payments (older than 24 months)</li>
          <li>Purchases (older than 24 months)</li>
          <li>Returns (older than 24 months)</li>
          <li>Shop Uses (older than 24 months)</li>
          <li>Transfers (older than 24 months)</li>
          <li>Extra Cash (older than 24 months)</li>
          <li>Stock Audits (older than 24 months)</li>
        </ul>
        <p style={{ marginTop: '10px', marginBottom: '0', fontWeight: 'bold', color: '#28a745' }}>
          ✓ Products will NOT be affected
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={analyzeData} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Analyzing...' : '🔍 Analyze Database'}
        </button>
      </div>

      {analysis && (
        <div>
          <h3>📊 Analysis Results</h3>
          <p style={{ marginBottom: '20px' }}>
            Cutoff Date: <strong>{analysis.cutoffDate.toLocaleDateString()}</strong> (24 months ago)
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={{ padding: '15px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '5px' }}>
              <h4>🗑️ To Delete (Older than 24 months)</h4>
              <p><strong>Payments:</strong> {analysis.paymentsToDelete.length}</p>
              <p><strong>Sales:</strong> {analysis.salesToDelete.length}</p>
              <p><strong>Purchases:</strong> {analysis.purchasesToDelete.length}</p>
              <p><strong>Returns:</strong> {analysis.returnsToDelete.length}</p>
              <p><strong>Shop Uses:</strong> {analysis.shopUsesToDelete.length}</p>
              <p><strong>Transfers:</strong> {analysis.transfersToDelete.length}</p>
              <p><strong>Extra Cash:</strong> {analysis.extraCashToDelete.length}</p>
              <p><strong>Stock Audits:</strong> {analysis.stockAuditsToDelete.length}</p>
              <hr />
              <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                Total: {analysis.paymentsToDelete.length + analysis.salesToDelete.length + 
                       analysis.purchasesToDelete.length + analysis.returnsToDelete.length +
                       analysis.shopUsesToDelete.length + analysis.transfersToDelete.length +
                       analysis.extraCashToDelete.length + analysis.stockAuditsToDelete.length}
              </p>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '5px' }}>
              <h4>✅ To Keep (Within 24 months)</h4>
              <p><strong>Payments:</strong> {analysis.paymentsToKeep.length}</p>
              <p><strong>Sales:</strong> {analysis.salesToKeep.length}</p>
              <p><strong>Purchases:</strong> {analysis.purchasesToKeep.length}</p>
              <p><strong>Returns:</strong> {analysis.returnsToKeep.length}</p>
              <p><strong>Shop Uses:</strong> {analysis.shopUsesToKeep.length}</p>
              <p><strong>Transfers:</strong> {analysis.transfersToKeep.length}</p>
              <p><strong>Extra Cash:</strong> {analysis.extraCashToKeep.length}</p>
              <p><strong>Stock Audits:</strong> {analysis.stockAuditsToKeep.length}</p>
              <hr />
              <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                Total: {analysis.paymentsToKeep.length + analysis.salesToKeep.length + 
                       analysis.purchasesToKeep.length + analysis.returnsToKeep.length +
                       analysis.shopUsesToKeep.length + analysis.transfersToKeep.length +
                       analysis.extraCashToKeep.length + analysis.stockAuditsToKeep.length}
              </p>
            </div>
          </div>

          <button 
            onClick={performCleanup} 
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Cleaning...' : '🗑️ Delete Old Test Data'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DataCleanup;