import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showSpinner, hideSpinner } from "./app.js";

export async function redirectByRole(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("No user data");
    const data = snap.data();
    if (data.role === "admin") window.location.replace("admin.html");
    else if (data.role === "chef") {
      if (data.status === "pending") window.location.replace("pending.html");
      else if (data.status === "approved") window.location.replace("chef.html");
      else window.location.replace("rejected.html");
    } else window.location.replace("index.html");
  } catch (err) {
    console.error(err);
    showToast("Error loading account", "error");
    setTimeout(() => window.location.href = "login.html", 1500);
  }
}

export async function handleSignup(name, email, password, role) {
  showSpinner();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const status = role === "chef" ? "pending" : "active";
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, role, status, createdAt: new Date().toISOString()
    });
    showToast("Account created!", "success");
    setTimeout(() => redirectByRole(cred.user), 1200);
  } catch (err) {
    hideSpinner();
    showToast(err.code === "auth/email-already-in-use" ? "Email already exists" : "Error", "error");
  }
}

export async function handleLogin(email, password) {
  showSpinner();
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    showToast("Welcome back!", "success");
    hideSpinner(); // critical: hide before redirect
    await redirectByRole(cred.user);
  } catch (err) {
    hideSpinner();
    showToast("Invalid email or password", "error");
  }
}

export async function handleLogout() {
  await signOut(auth);
  window.location.href = "login.html";
}

export function requireAuth(allowedRoles = [], callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "login.html";
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data();
      if (allowedRoles.length && !allowedRoles.includes(data.role)) {
        showToast("Access denied", "error");
        return setTimeout(() => redirectByRole(user), 1200);
      }
      callback(user, data);
      hideSpinner();
    } catch (err) {
      console.error(err);
      showToast("Error loading data", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
    }
  });
}