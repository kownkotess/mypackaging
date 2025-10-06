const admin = require('firebase-admin');

// Try to find service account key in different locations
let serviceAccount;
try {
  serviceAccount = require('./mypackagingsystem-key.json');
} catch (e1) {
  try {
    serviceAccount = require('../shop-dashboard/mypackagingsystem-key.json');
  } catch (e2) {
    try {
      serviceAccount = require('../shop-dashboard/serviceAccountKey.json');
    } catch (e3) {
      console.error('❌ Could not find service account key file.');
      console.error('Please ensure one of these files exists:');
      console.error('- ./mypackagingsystem-key.json');
      console.error('- ../shop-dashboard/mypackagingsystem-key.json');
      console.error('- ../shop-dashboard/serviceAccountKey.json');
      process.exit(1);
    }
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTestData() {
  console.log('🧹 Starting cleanup of old test data...');
  
  try {
    // Get all payments
    const paymentsSnapshot = await db.collection('payments').get();
    console.log(`Found ${paymentsSnapshot.size} payments in database`);
    
    // Get all sales
    const salesSnapshot = await db.collection('sales').get();
    console.log(`Found ${salesSnapshot.size} sales in database`);
    
    // Define cutoff date - keep only data from today (Oct 7, 2025)
    const cutoffDate = new Date('2025-10-07T00:00:00.000Z');
    console.log('Cutoff date:', cutoffDate);
    
    let paymentsToDelete = [];
    let salesToDelete = [];
    let paymentsToKeep = [];
    let salesToKeep = [];
    
    // Analyze payments
    paymentsSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      
      if (createdAt < cutoffDate) {
        paymentsToDelete.push({
          id: doc.id,
          amount: data.amount,
          customerName: data.customerName,
          paymentMethod: data.paymentMethod,
          createdAt: createdAt
        });
      } else {
        paymentsToKeep.push({
          id: doc.id,
          amount: data.amount,
          customerName: data.customerName,
          paymentMethod: data.paymentMethod,
          createdAt: createdAt
        });
      }
    });
    
    // Analyze sales
    salesSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      
      if (createdAt < cutoffDate) {
        salesToDelete.push({
          id: doc.id,
          total: data.total,
          customerName: data.customerName,
          paymentType: data.paymentType,
          status: data.status,
          createdAt: createdAt
        });
      } else {
        salesToKeep.push({
          id: doc.id,
          total: data.total,
          customerName: data.customerName,
          paymentType: data.paymentType,
          status: data.status,
          createdAt: createdAt
        });
      }
    });
    
    console.log('\n📊 Analysis Results:');
    console.log(`Payments to delete: ${paymentsToDelete.length}`);
    console.log(`Payments to keep: ${paymentsToKeep.length}`);
    console.log(`Sales to delete: ${salesToDelete.length}`);
    console.log(`Sales to keep: ${salesToKeep.length}`);
    
    console.log('\n🗑️ Payments to be deleted:');
    paymentsToDelete.forEach(payment => {
      console.log(`- ${payment.customerName}: RM${payment.amount} (${payment.paymentMethod}) - ${payment.createdAt}`);
    });
    
    console.log('\n✅ Payments to keep:');
    paymentsToKeep.forEach(payment => {
      console.log(`- ${payment.customerName}: RM${payment.amount} (${payment.paymentMethod}) - ${payment.createdAt}`);
    });
    
    console.log('\n🗑️ Sales to be deleted:');
    salesToDelete.forEach(sale => {
      console.log(`- ${sale.customerName}: RM${sale.total} (${sale.paymentType}/${sale.status}) - ${sale.createdAt}`);
    });
    
    console.log('\n✅ Sales to keep:');
    salesToKeep.forEach(sale => {
      console.log(`- ${sale.customerName}: RM${sale.total} (${sale.paymentType}/${sale.status}) - ${sale.createdAt}`);
    });
    
    // Ask for confirmation before proceeding
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\n⚠️  Do you want to proceed with deleting the old test data? (yes/no): ', resolve);
    });
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled.');
      rl.close();
      process.exit(0);
    }
    
    rl.close();
    
    // Delete old payments
    console.log('\n🗑️ Deleting old payments...');
    const batch = db.batch();
    
    paymentsToDelete.forEach(payment => {
      const paymentRef = db.collection('payments').doc(payment.id);
      batch.delete(paymentRef);
    });
    
    salesToDelete.forEach(sale => {
      const saleRef = db.collection('sales').doc(sale.id);
      batch.delete(saleRef);
    });
    
    await batch.commit();
    
    console.log('✅ Cleanup completed successfully!');
    console.log(`✅ Deleted ${paymentsToDelete.length} old payments`);
    console.log(`✅ Deleted ${salesToDelete.length} old sales`);
    console.log(`✅ Kept ${paymentsToKeep.length} recent payments`);
    console.log(`✅ Kept ${salesToKeep.length} recent sales`);
    
    console.log('\n🎉 Your database is now clean with only legitimate business data!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  process.exit(0);
}

cleanupTestData();