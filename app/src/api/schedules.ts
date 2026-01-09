// src/api/schedules.ts
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Schedule } from "../types";
import { generateTomasFromSchedule } from "./tomas";

export async function createSchedule(
  input: Omit<Schedule, "id" | "createdAt">
) {
  // 1️⃣ Crear la planificación
  const ref = await addDoc(collection(db, "schedules"), {
    ...input,
    createdAt: serverTimestamp(),
  });

  // 2️⃣ Generar tomas automáticamente (H4.3 + H4.4)
  await generateTomasFromSchedule(
    {
      id: ref.id,
      ...input,
    } as Schedule,
    7 // días hacia delante
  );

  return ref.id;
}

export async function listSchedulesByMed(medId: string) {
  const q = query(
    collection(db, "schedules"),
    where("medId", "==", medId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) }) as Schedule
  );
}

// Listener en tiempo real
export function listenSchedulesByMed(
  medId: string,
  cb: (items: Schedule[]) => void
) {
  const q = query(
    collection(db, "schedules"),
    where("medId", "==", medId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) }) as Schedule
      )
    );
  });
}
