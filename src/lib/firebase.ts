// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
// @ts-expect-error – RN-only export resolved by Metro's "react-native" condition
import { getReactNativePersistence } from "@firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBwLebU-GKb350yyur_am0RDvNo95wwWEc",
  authDomain: "recuerdamed-36b57.firebaseapp.com",
  projectId: "recuerdamed-36b57",
  storageBucket: "recuerdamed-36b57.firebasestorage.app",
  messagingSenderId: "328395174403",
  appId: "1:328395174403:web:7bf11bb7123d00b40a1436",
  measurementId: "G-3EHH9G1BL5"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);