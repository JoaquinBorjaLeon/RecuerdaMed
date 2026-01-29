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

export async function getPushTokensByUserIds(userIds: string[]) {
  if (!userIds.length) return [];

  // Firestore "in" permite máx 10 elementos
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const tokens: string[] = [];
  for (const chunk of chunks) {
    const q = query(
      collection(db, "push_tokens"),
      where("patientId", "in", chunk)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const token = d.data().token as string;
      if (token) tokens.push(token);
    });
  }

  return tokens;
}
