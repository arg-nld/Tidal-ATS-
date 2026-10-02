import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyASWjmstH9GsKmNhW6hDTmQc2_1fpRcj60",
  authDomain: "ats-dashboard-35950.firebaseapp.com",
  projectId: "ats-dashboard-35950",
  storageBucket: "ats-dashboard-35950.firebasestorage.app",
  messagingSenderId: "7545090710",
  appId: "1:7545090710:web:114b6ec221c4a27cccc8b7",
  measurementId: "G-SDFWFKFZS6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const APP_ID = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'ats-dashboard-mvp';

export default app;
