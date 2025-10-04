// Utility script to clean up old password reset requests
// Run this script manually when needed to clean up test data

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAnyCM5xlBSQzGvVCaYMGrl5qBH5UQbScg",
  authDomain: "mypackagingbybellestore.firebaseapp.com",
  projectId: "mypackagingbybellestore",
  storageBucket: "mypackagingbybellestore.firebasestorage.app",
  messagingSenderId: "951765544285",
  appId: "1:951765544285:web:e80ed69f7803ce9d204cb4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanupTestRequests = async () => {
  try {
    console.log('Cleaning up test password reset requests...');
    
    const snapshot = await getDocs(collection(db, 'passwordResetRequests'));
    
    let deletedCount = 0;
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      // Delete test requests or requests from test@example.com
      if (data.email === 'test@example.com' || data.reason === 'Test request') {
        await deleteDoc(doc(db, 'passwordResetRequests', docSnapshot.id));
        console.log('Deleted test request:', docSnapshot.id);
        deletedCount++;
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} test requests.`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Uncomment to run cleanup
// cleanupTestRequests();

export { cleanupTestRequests };