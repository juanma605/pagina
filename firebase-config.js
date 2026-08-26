import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// El núcleo de tu base de datos
const firebaseConfig = {
  apiKey: "AIzaSyBPnGQwvl80gmNkDWypm43J1aLEBEuM2Zc",
  authDomain: "pagina-be6d7.firebaseapp.com",
  projectId: "pagina-be6d7",
  storageBucket: "pagina-be6d7.firebasestorage.app",
  messagingSenderId: "854585154706",
  appId: "1:854585154706:web:44c024ce1b9ed082d91a4b",
  measurementId: "G-36331F27NX"
};

// Inicialización de los servicios
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // El guardián de la puerta