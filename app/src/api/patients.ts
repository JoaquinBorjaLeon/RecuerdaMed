import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export async function ensurePatientProfile(uid: string) {
  const ref = doc(db, "patients", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      timezone: "Europe/Madrid",
      locale: "es-ES",
      createdAt: serverTimestamp(),
    });
  }
  return ref;
}
