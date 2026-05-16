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
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Schedule } from "../types";
import { generateTomasFromSchedule } from "./tomas";

/** Crea una planificación y genera automáticamente las tomas para los próximos 7 días */
export async function createSchedule(
  input: Omit<Schedule, "id" | "createdAt">
) {
  const ref = await addDoc(collection(db, "schedules"), {
    ...input,
    createdAt: serverTimestamp(),
  });

  await generateTomasFromSchedule(
    { id: ref.id, ...input } as Schedule,
    7
  );

  return ref.id;
}

/** Listener en tiempo real de las planificaciones de una medicación */
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
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Schedule & { status?: string })
        .filter((s) => s.status !== "DELETED")
    );
  });
}

/** Borra tomas futuras no confirmadas de un schedule y regenera con los nuevos parámetros */
export async function regenerateScheduleTomas(scheduleId: string) {
  const q = query(
    collection(db, "tomas"),
    where("scheduleId", "==", scheduleId)
  );
  const snap = await getDocs(q);
  const now = new Date().toISOString();

  for (const d of snap.docs) {
    const toma = d.data();
    if (toma.status !== "CONFIRMED" && toma.plannedAt > now) {
      await deleteDoc(doc(db, "tomas", d.id));
    }
  }

  const schedSnap = await getDoc(doc(db, "schedules", scheduleId));
  if (schedSnap.exists()) {
    const schedule = { id: schedSnap.id, ...schedSnap.data() } as Schedule;
    await generateTomasFromSchedule(schedule, 7);
  }
}

/** Elimina una planificación y todas sus tomas asociadas */
export async function deleteScheduleAndTomas(
  scheduleId: string,
  patientId?: string
) {
  let effectivePatientId = patientId;

  // Si no viene patientId (flujo de paciente), lo recuperamos del schedule
  if (!effectivePatientId) {
    const scheduleSnap = await getDoc(doc(db, "schedules", scheduleId));
    if (scheduleSnap.exists()) {
      const schedule = scheduleSnap.data() as Partial<Schedule>;
      if (schedule.patientId) effectivePatientId = schedule.patientId;
    }
  }

  // Borrar tomas vinculadas
  const filters = [where("scheduleId", "==", scheduleId)];
  if (effectivePatientId) {
    filters.push(where("patientId", "==", effectivePatientId));
  }
  const q = query(collection(db, "tomas"), ...filters);
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const status = d.data().status;
    if (status !== "CONFIRMED" && status !== "EXPIRED") {
      await deleteDoc(doc(db, "tomas", d.id));
    }
  }

  // Archivar la planificación (preserva contexto histórico)
  await updateDoc(doc(db, "schedules", scheduleId), {
    status: "DELETED",
    deletedAt: serverTimestamp(),
  });
}
