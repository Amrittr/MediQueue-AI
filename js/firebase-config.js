import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOsshe93Hd3lkDr5xqieBRL1fhgLG_tMY",
  authDomain: "dsa-project-570fb.firebaseapp.com",
  databaseURL: "https://dsa-project-570fb-default-rtdb.firebaseio.com",
  projectId: "dsa-project-570fb",
  storageBucket: "dsa-project-570fb.firebasestorage.app",
  messagingSenderId: "1052928923076",
  appId: "1:1052928923076:web:b50a5808ce1dd4a44b4091",
  measurementId: "G-0D76QZQ97B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
