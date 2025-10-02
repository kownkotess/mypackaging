// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Replace with your Firebase project configuration
// You'll need to get this from your Firebase Console > Project Settings > General > Your apps
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

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
