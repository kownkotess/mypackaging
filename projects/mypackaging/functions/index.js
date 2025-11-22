const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Scheduled function to delete old admin requests
 * Runs daily at 2:00 AM UTC (10:00 AM Malaysia Time)
 * Deletes completed/rejected requests older than 30 days
 */
exports.cleanupOldAdminRequests = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('Asia/Kuala_Lumpur')
  .onRun(async (context) => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      console.log('Starting cleanup of old admin requests...');
      
      // Query for completed or rejected requests older than 30 days
      const snapshot = await db.collection('adminRequests')
        .where('status', 'in', ['completed', 'rejected'])
        .where('updatedAt', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      if (snapshot.empty) {
        console.log('No old admin requests to delete.');
        return null;
      }

      // Batch delete for efficiency
      const batch = db.batch();
      let deleteCount = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      await batch.commit();
      console.log(`Successfully deleted ${deleteCount} old admin requests.`);
      
      return { deleted: deleteCount };
    } catch (error) {
      console.error('Error cleaning up admin requests:', error);
      throw error;
    }
  });

/**
 * Scheduled function to delete old sales records
 * Runs monthly on the 1st at 3:00 AM UTC (11:00 AM Malaysia Time)
 * Deletes sales older than 24 months
 */
exports.cleanupOldSales = functions.pubsub
  .schedule('0 3 1 * *')
  .timeZone('Asia/Kuala_Lumpur')
  .onRun(async (context) => {
    const db = admin.firestore();
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

    try {
      console.log('Starting cleanup of old sales records...');
      
      // Query for sales older than 24 months
      const snapshot = await db.collection('sales')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(twentyFourMonthsAgo))
        .get();

      if (snapshot.empty) {
        console.log('No old sales to delete.');
        return null;
      }

      // Batch delete for efficiency (max 500 per batch)
      let deleteCount = 0;
      const batchSize = 500;
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deleteCount++;
        });
        
        await batch.commit();
        console.log(`Batch committed: ${batchDocs.length} sales deleted.`);
      }

      console.log(`Successfully deleted ${deleteCount} old sales records.`);
      
      return { deleted: deleteCount };
    } catch (error) {
      console.error('Error cleaning up sales:', error);
      throw error;
    }
  });

/**
 * Scheduled function to delete old purchases records
 * Runs monthly on the 1st at 3:30 AM UTC (11:30 AM Malaysia Time)
 * Deletes purchases older than 24 months
 */
exports.cleanupOldPurchases = functions.pubsub
  .schedule('30 3 1 * *')
  .timeZone('Asia/Kuala_Lumpur')
  .onRun(async (context) => {
    const db = admin.firestore();
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

    try {
      console.log('Starting cleanup of old purchase records...');
      
      // Query for purchases older than 24 months
      const snapshot = await db.collection('purchases')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(twentyFourMonthsAgo))
        .get();

      if (snapshot.empty) {
        console.log('No old purchases to delete.');
        return null;
      }

      // Batch delete for efficiency
      let deleteCount = 0;
      const batchSize = 500;
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deleteCount++;
        });
        
        await batch.commit();
        console.log(`Batch committed: ${batchDocs.length} purchases deleted.`);
      }

      console.log(`Successfully deleted ${deleteCount} old purchase records.`);
      
      return { deleted: deleteCount };
    } catch (error) {
      console.error('Error cleaning up purchases:', error);
      throw error;
    }
  });
