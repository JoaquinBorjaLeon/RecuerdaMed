import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwLeBu-GKb35byyur_am0RDvNo95wwWEc",
  authDomain: "recuerdamed-36b57.firebaseapp.com",
  projectId: "recuerdamed-36b57",
  storageBucket: "recuerdamed-36b57.appspot.com",
  messagingSenderId: "328395174403",
  appId: "1:328395174403:web:7bf11bb7123d00b40a1436",
  measurementId: "G-3EHH96I8L5",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
