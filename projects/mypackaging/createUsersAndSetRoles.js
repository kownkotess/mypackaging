const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
const serviceAccount = require('./mypackagingsystem-key.json'); // Update this path as needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://mypackagingsystem-default-rtdb.firebaseio.com/' // Update this URL
});

const db = admin.firestore();

// User roles configuration
const users = [
  {
    email: 'admin@mypackaging.com',
    role: 'admin',
    displayName: 'System Administrator'
  },
  {
    email: 'khairul@mypackaging.com',
    role: 'manager',
    displayName: 'Khairul (Manager)'
  },
  {
    email: 'yeen@mypackaging.com',
    role: 'manager',
    displayName: 'Yeen (Manager)'
  },
  {
    email: 'shazila@mypackaging.com',
    role: 'manager',
    displayName: 'Shazila (Manager)'
  },
  {
    email: 'masliza@mypackaging.com',
    role: 'manager',
    displayName: 'Masliza (Manager)'
  },
  {
    email: 'cashier@mypackaging.com',
    role: 'staff',
    displayName: 'Cashier (Staff)'
  }
];

async function createUsersAndRoles() {
  console.log('Starting user creation and role assignment...');
  
  for (const userData of users) {
    try {
      console.log(`\nProcessing user: ${userData.email}`);
      
      // Try to find existing user by email
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(userData.email);
        console.log(`  ✓ User ${userData.email} already exists`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Create new user
          console.log(`  ➤ Creating user ${userData.email}...`);
          userRecord = await admin.auth().createUser({
            email: userData.email,
            password: 'password123', // Default password - users should change this
            displayName: userData.displayName,
            emailVerified: true
          });
          console.log(`  ✓ Created user: ${userData.email}`);
        } else {
          throw error;
        }
      }
      
      // Set custom claims for the user
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: userData.role
      });
      console.log(`  ✓ Set custom claims: ${userData.role} for ${userData.email}`);
      
      // Create/update user document in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        email: userData.email,
        role: userData.role,
        displayName: userData.displayName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        mustChangePassword: true // Flag to force password change on first login
      }, { merge: true });
      
      console.log(`  ✓ Updated Firestore document for ${userData.email}`);
      
    } catch (error) {
      console.error(`  ✗ Error processing ${userData.email}:`, error.message);
    }
  }
  
  console.log('\n=== User Creation Summary ===');
  console.log('Default password for all users: password123');
  console.log('Users should change their passwords on first login.');
  console.log('\nRole assignments:');
  users.forEach(user => {
    console.log(`  ${user.email} → ${user.role}`);
  });
  
  console.log('\n🎉 User creation and role assignment completed!');
  process.exit(0);
}

// Run the script
createUsersAndRoles().catch(console.error);