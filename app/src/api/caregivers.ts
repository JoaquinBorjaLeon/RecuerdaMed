import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

export async function getCaregiverPushTokens(patientId: string): Promise<string[]> {
  // 1) Obtener cuidadores vinculados
  const linksQ = query(
    collection(db, "vinculos_cuidado"),
    where("patientId", "==", patientId),
    where("revocado", "==", false)
  );
  const linksSnap = await getDocs(linksQ);
  const caregiverIds = linksSnap.docs.map(d => d.data().caregiverId);

  if (!caregiverIds.length) return [];

  // 2) Obtener tokens de esos cuidadores
  const tokensQ = query(
    collection(db, "push_tokens"),
    where("patientId", "in", caregiverIds)
  );
  const tokensSnap = await getDocs(tokensQ);
  return tokensSnap.docs.map(d => d.data().token);
}
