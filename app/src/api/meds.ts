import { addDoc, collection, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Medication } from "../types";

export async function createMedication(uid: string, data: Omit<Medication,"id"|"patientId"|"createdAt">) {
  const ref = await addDoc(collection(db, "medications"), {
  patientId: uid,
  name: data.name,
  form: data.form ?? "",
  strength: data.strength ?? "",
  notes: data.notes ?? "",
  createdAt: serverTimestamp(),
});
  return ref.id;
}

export async function listMyMedications(uid: string) {
  const q = query(
    collection(db, "medications"),
    where("patientId","==", uid),
    orderBy("createdAt","desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Medication[];
}
