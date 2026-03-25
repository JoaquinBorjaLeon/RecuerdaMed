// src/api/schedules.ts
import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  deleteDoc,
  doc,
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

export async function listSchedulesByMed(
  medId: string,
  patientId?: string
) {
  const filters = [where("medId", "==", medId)];
  if (patientId) filters.push(where("patientId", "==", patientId));

  const q = query(
    collection(db, "schedules"),
    ...filters,
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
  cb: (items: Schedule[]) => void,
  patientId?: string
) {
  const filters = [where("medId", "==", medId)];
  if (patientId) filters.push(where("patientId", "==", patientId));

  const q = query(
    collection(db, "schedules"),
    ...filters,
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

// Eliminar planificación y sus tomas asociadas
export async function deleteScheduleAndTomas(
  scheduleId: string,
  patientId?: string
) {
  let effectivePatientId = patientId;

  // In patient flows, route params may not include patientId; recover from schedule.
  if (!effectivePatientId) {
    const scheduleSnap = await getDoc(doc(db, "schedules", scheduleId));
    if (scheduleSnap.exists()) {
      const schedule = scheduleSnap.data() as Partial<Schedule>;
      if (schedule.patientId) effectivePatientId = schedule.patientId;
    }
  }

  // 1) borrar tomas vinculadas
  const filters = [where("scheduleId", "==", scheduleId)];
  if (effectivePatientId) {
    filters.push(where("patientId", "==", effectivePatientId));
  }
  const q = query(collection(db, "tomas"), ...filters);
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "tomas", d.id));
  }

  // 2) borrar planificación
  await deleteDoc(doc(db, "schedules", scheduleId));
}
