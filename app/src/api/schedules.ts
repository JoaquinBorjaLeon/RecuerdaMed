import { addDoc, collection, getDocs, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Schedule } from "../types";

export async function createSchedule(input: Omit<Schedule,'id'|'createdAt'>) {
  const ref = await addDoc(collection(db, "schedules"), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listSchedulesByMed(medId: string) {
  const q = query(
    collection(db, "schedules"),
    where("medId","==", medId),
    orderBy("createdAt","desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Schedule[];
}

// listener en tiempo real (útil en el detalle)
export function listenSchedulesByMed(medId: string, cb: (items: Schedule[]) => void) {
  const q = query(
    collection(db, "schedules"),
    where("medId","==", medId),
    orderBy("createdAt","desc")
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Schedule[]);
  });
}
