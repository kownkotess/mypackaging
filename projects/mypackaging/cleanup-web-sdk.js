const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Your Firebase configuration (from firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyAnyCM5xlBSQzGvVCaYMGrl5qBH5UQbScg",
  authDomain: "mypackagingbybellestore.firebaseapp.com",
  projectId: "mypackagingbybellestore",
  storageBucket: "mypackagingbybellestore.firebasestorage.app",
  messagingSenderId: "951765544285",
  appId: "1:951765544285:web:e80ed69f7803ce9d204cb4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupTestData() {
  console.log('🧹 Starting cleanup of old test data...');
  
  try {
    // Define cutoff date - keep only data from today (Oct 7, 2025)
    const cutoffDate = new Date('2025-10-07T00:00:00.000Z');
    console.log('Cutoff date:', cutoffDate);
    
    // Get all payments
    console.log('📥 Fetching payments...');
    const paymentsSnapshot = await getDocs(collection(db, 'payments'));
    console.log(`Found ${paymentsSnapshot.size} payments in database`);
    
    // Get all sales
    console.log('📥 Fetching sales...');
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
    for (const payment of paymentsToDelete) {
      await deleteDoc(doc(db, 'payments', payment.id));
      console.log(`✅ Deleted payment: ${payment.customerName} - RM${payment.amount}`);
    }
    
    // Delete old sales
    console.log('\n🗑️ Deleting old sales...');
    for (const sale of salesToDelete) {
      await deleteDoc(doc(db, 'sales', sale.id));
      console.log(`✅ Deleted sale: ${sale.customerName} - RM${sale.total}`);
    }
    
    console.log('\n✅ Cleanup completed successfully!');
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