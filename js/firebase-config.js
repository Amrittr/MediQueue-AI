import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) || "AIzaSyAOsshe93Hd3lkDr5xqieBRL1fhgLG_tMY",
  authDomain: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || "dsa-project-570fb.firebaseapp.com",
  databaseURL: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_DATABASE_URL) || "https://dsa-project-570fb-default-rtdb.firebaseio.com",
  projectId: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID) || "dsa-project-570fb",
  storageBucket: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || "dsa-project-570fb.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "1052928923076",
  appId: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_APP_ID) || "1:1052928923076:web:b50a5808ce1dd4a44b4091",
  measurementId: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || "G-0D76QZQ97B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
