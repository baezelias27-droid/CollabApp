// ══════════════════════════════════════════════════════
//  firebase-config.js
//  ⚠️  REEMPLAZA LOS VALORES con los de tu proyecto Firebase
//  Consola: https://console.firebase.google.com
// ══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔑 TUS CREDENCIALES DE FIREBASE (reemplaza con las tuyas)
const firebaseConfig = {
  apiKey: "AIzaSyD4DLvG3O6bepT8mwfDQS6hDnlN31mhDu0",
  authDomain: "officeweb-8665d.firebaseapp.com",
  projectId: "officeweb-8665d",
  storageBucket: "officeweb-8665d.firebasestorage.app",
  messagingSenderId: "766821186188",
  appId: "1:766821186188:web:c73a210f50afb5cf7659a9",
  measurementId: "G-C452V4BVFJ"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db   = getFirestore(app);
