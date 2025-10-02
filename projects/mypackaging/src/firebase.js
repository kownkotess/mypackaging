// Firebase scaffold. Fill .env with your Firebase web app config first.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Prefer env vars; fall back to the provided dev config if envs are not set
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAnyCM5xlBSQzGvVCaYMGrl5qBH5UQbScg',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'mypackagingbybellestore.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'mypackagingbybellestore',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'mypackagingbybellestore.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '951765544285',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:951765544285:web:e80ed69f7803ce9d204cb4',
};

// Guard against missing envs in dev to help early
function assertConfig(cfg) {
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn('Missing Firebase envs:', missing.join(', '), '\nUsing fallback inline Firebase config for development.');
  }
}

assertConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
