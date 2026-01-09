// src/api/pushTokens.ts
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Platform } from "react-native";

export async function savePushToken(patientId: string, token: string) {
  const q = query(
    collection(db, "push_tokens"),
    where("patientId", "==", patientId),
    where("token", "==", token)
  );

  const snap = await getDocs(q);

  // Evita duplicados
  if (!snap.empty) {
    return;
  }

  await addDoc(collection(db, "push_tokens"), {
    patientId,
    token,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
}
