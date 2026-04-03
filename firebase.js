import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBE3cSgO122qK067CfUuyiQspNxAv3xZco",
  authDomain: "foodstore-app-b5e3d.firebaseapp.com",
  projectId: "foodstore-app-b5e3d",
  storageBucket: "foodstore-app-b5e3d.firebasestorage.app",
  messagingSenderId: "1019410476760",
  appId: "1:1019410476760:web:86d36e9c8a55f07440f1ad"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);