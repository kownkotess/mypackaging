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
      // Define cutoff date - keep only data from today (Oct 7, 2025)
      const cutoffDate = new Date('2025-10-07T00:00:00.000Z');
      
      // Get all payments
      const paymentsSnapshot = await getDocs(collection(db, 'payments'));
      console.log(`Found ${paymentsSnapshot.size} payments in database`);
      
      // Get all sales
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      console.log(`Found ${salesSnapshot.size} sales in database`);
      
      let paymentsToDelete = [];
      let salesToDelete = [];
      let paymentsToKeep = [];
      let salesToKeep = [];
      
      // Analyze payments
      paymentsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt < cutoffDate) {
          paymentsToDelete.push({
            id: docSnapshot.id,
            amount: data.amount,
            customerName: data.customerName,
            paymentMethod: data.paymentMethod,
            createdAt: createdAt
          });
        } else {
          paymentsToKeep.push({
            id: docSnapshot.id,
            amount: data.amount,
            customerName: data.customerName,
            paymentMethod: data.paymentMethod,
            createdAt: createdAt
          });
        }
      });
      
      // Analyze sales
      salesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const createdAt = data.createdAt?.toDate();
        
        if (createdAt < cutoffDate) {
          salesToDelete.push({
            id: docSnapshot.id,
            total: data.total,
            customerName: data.customerName,
            paymentType: data.paymentType,
            status: data.status,
            createdAt: createdAt
          });
        } else {
          salesToKeep.push({
            id: docSnapshot.id,
            total: data.total,
            customerName: data.customerName,
            paymentType: data.paymentType,
            status: data.status,
            createdAt: createdAt
          });
        }
      });
      
      setAnalysis({
        paymentsToDelete,
        salesToDelete,
        paymentsToKeep,
        salesToKeep
      });
      
      console.log('Analysis Results:');
      console.log(`Payments to delete: ${paymentsToDelete.length}`);
      console.log(`Payments to keep: ${paymentsToKeep.length}`);
      console.log(`Sales to delete: ${salesToDelete.length}`);
      console.log(`Sales to keep: ${salesToKeep.length}`);
      
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError('Failed to analyze data');
    }
    setLoading(false);
  };

  const performCleanup = async () => {
    if (!analysis) return;
    
    const confirmed = await showConfirm(
      'Delete Old Test Data',
      `This will permanently delete ${analysis.paymentsToDelete.length} old payments and ${analysis.salesToDelete.length} old sales. This cannot be undone. Are you sure?`
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    try {
      // Delete old payments
      for (const payment of analysis.paymentsToDelete) {
        await deleteDoc(doc(db, 'payments', payment.id));
        console.log(`Deleted payment: ${payment.customerName} - RM${payment.amount}`);
      }
      
      // Delete old sales
      for (const sale of analysis.salesToDelete) {
        await deleteDoc(doc(db, 'sales', sale.id));
        console.log(`Deleted sale: ${sale.customerName} - RM${sale.total}`);
      }
      
      showSuccess(`Cleanup completed! Deleted ${analysis.paymentsToDelete.length} payments and ${analysis.salesToDelete.length} sales.`);
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
      <p>This tool will remove old test data while keeping your recent legitimate business records.</p>
      
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={{ padding: '15px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '5px' }}>
              <h4>🗑️ To Delete (Old Test Data)</h4>
              <p><strong>Payments:</strong> {analysis.paymentsToDelete.length}</p>
              <p><strong>Sales:</strong> {analysis.salesToDelete.length}</p>
              
              <details>
                <summary>View payments to delete</summary>
                {analysis.paymentsToDelete.map(payment => (
                  <div key={payment.id} style={{ fontSize: '0.9em', margin: '5px 0' }}>
                    {payment.customerName}: RM{payment.amount} ({payment.paymentMethod}) - {payment.createdAt.toLocaleDateString()}
                  </div>
                ))}
              </details>
              
              <details>
                <summary>View sales to delete</summary>
                {analysis.salesToDelete.map(sale => (
                  <div key={sale.id} style={{ fontSize: '0.9em', margin: '5px 0' }}>
                    {sale.customerName}: RM{sale.total} ({sale.paymentType}/{sale.status}) - {sale.createdAt.toLocaleDateString()}
                  </div>
                ))}
              </details>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '5px' }}>
              <h4>✅ To Keep (Recent Data)</h4>
              <p><strong>Payments:</strong> {analysis.paymentsToKeep.length}</p>
              <p><strong>Sales:</strong> {analysis.salesToKeep.length}</p>
              
              <details>
                <summary>View payments to keep</summary>
                {analysis.paymentsToKeep.map(payment => (
                  <div key={payment.id} style={{ fontSize: '0.9em', margin: '5px 0' }}>
                    {payment.customerName}: RM{payment.amount} ({payment.paymentMethod}) - {payment.createdAt.toLocaleDateString()}
                  </div>
                ))}
              </details>
              
              <details>
                <summary>View sales to keep</summary>
                {analysis.salesToKeep.map(sale => (
                  <div key={sale.id} style={{ fontSize: '0.9em', margin: '5px 0' }}>
                    {sale.customerName}: RM{sale.total} ({sale.paymentType}/{sale.status}) - {sale.createdAt.toLocaleDateString()}
                  </div>
                ))}
              </details>
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