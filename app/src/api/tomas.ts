// src/api/tomas.ts
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Toma, Schedule } from "../types";
import * as Notifications from "expo-notifications";

// -------------------- helpers --------------------
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function parseYMD(ymd: string): Date {
  // ymd = "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function iso(d: Date) {
  return d.toISOString();
}
// JS: 0=Sun..6=Sat  -> ISO: 1=Mon..7=Sun
function jsDayToISOdow(jsDay: number) {
  return ((jsDay + 6) % 7) + 1;
}

// -------------------- Firestore ops --------------------
export async function createToma(data: Omit<Toma, "id" | "createdAt">) {
  await addDoc(collection(db, "tomas"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

async function tomaExistsByDedupeKey(patientId: string, dedupeKey: string) {
  const q = query(
    collection(db, "tomas"),
    where("patientId", "==", patientId),
    where("dedupeKey", "==", dedupeKey),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export function listenUpcomingTomas(
  patientId: string,
  cb: (items: Toma[]) => void
) {
  const q = query(
    collection(db, "tomas"),
    where("patientId", "==", patientId),
    orderBy("plannedAt", "asc")
  );

  return onSnapshot(q, async (snap) => {
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) }) as Toma
    );

    // 1) Pintas la UI
    cb(items);

    // 2) Y en paralelo actualizas estados si toca
    // (solo cambia si procede, por eso no crea bucles infinitos)
    await Promise.all(
      items.map(async (t) => {
        try {
          await updateTomaStatusIfNeeded(t);
        } catch (e) {
          // Silencioso en prod; en dev puedes loguear
          // console.warn("updateTomaStatusIfNeeded error:", e);
        }
      })
    );
  });
}


export async function confirmToma(tomaId: string) {
  await updateDoc(doc(db, "tomas", tomaId), {
    status: "CONFIRMED",
    confirmedAt: new Date().toISOString(),
  });
}

/**
 * Actualiza el estado de una toma según el momento actual
 * PLANNED -> DUE -> EXPIRED
 */
export async function updateTomaStatusIfNeeded(toma: Toma) {
  const now = new Date().toISOString();

  // Pasa a DUE cuando entra en ventana
  if (toma.status === "PLANNED" && now >= toma.windowStart && now <= toma.windowEnd) {
    await updateDoc(doc(db, "tomas", toma.id), { status: "DUE" });
    return;
  }

  // Pasa a EXPIRED cuando se pasa la ventana
  if (toma.status === "DUE" && now > toma.windowEnd) {
    await updateDoc(doc(db, "tomas", toma.id), { status: "EXPIRED" });
  }
}

/**
 * Genera tomas dentro del rango:
 *   max(hoy, schedule.startDate)  ->  min(schedule.endDate, hoy + daysAhead)
 * y respeta DAILY / DOW / EVERY_X_HOURS.
 *
 * Evita duplicados usando dedupeKey.
 * Programa y persiste notificationId en cada toma.
 */
export async function generateTomasFromSchedule(schedule: Schedule, daysAhead: number = 7) {
  // Validaciones mínimas
  if (!schedule.patientId || !schedule.medId || !schedule.id) return;
  if (!schedule.startDate) return;

  const tolerance = schedule.toleranceMinutes ?? 30;

  // Rango válido
  const today = startOfDay(new Date());
  const start = startOfDay(parseYMD(schedule.startDate));
  const rangeStart = startOfDay(new Date(Math.max(today.getTime(), start.getTime())));

  const maxAhead = endOfDay(new Date());
  maxAhead.setDate(maxAhead.getDate() + daysAhead);

  let rangeEnd = maxAhead;
  if (schedule.endDate) {
    const end = endOfDay(parseYMD(schedule.endDate));
    rangeEnd = new Date(Math.min(maxAhead.getTime(), end.getTime()));
  }

  // Si el rango no tiene sentido, no generamos nada
  if (rangeEnd.getTime() < rangeStart.getTime()) return;

  // Crea una toma (si no existe) y programa notificación
  const createOneToma = async (plannedAt: Date) => {
    if (plannedAt.getTime() < rangeStart.getTime()) return;
    if (plannedAt.getTime() > rangeEnd.getTime()) return;

    const plannedISO = iso(plannedAt);

    // Clave anti-duplicados (scheduleId + plannedAt)
    const dedupeKey = `${schedule.id}__${plannedISO}`;

    const exists = await tomaExistsByDedupeKey(schedule.patientId, dedupeKey);
    if (exists) return;

    // Programar notificación (trigger por fecha absoluta)
    const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "RecuerdaMed",
      body: "Es hora de tomar tu medicación",
      data: { tomaPlannedAt: plannedISO, scheduleId: schedule.id, medId: schedule.medId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plannedAt,
      },
    });


    await createToma({
      scheduleId: schedule.id,
      medId: schedule.medId,
      patientId: schedule.patientId,

      plannedAt: plannedISO,
      windowStart: iso(new Date(plannedAt.getTime() - tolerance * 60_000)),
      windowEnd: iso(new Date(plannedAt.getTime() + tolerance * 60_000)),

      status: "PLANNED",
      notificationId,
      dedupeKey,
    });
  };

  // DAILY / DOW
  if (schedule.pattern === "DAILY" || schedule.pattern === "DOW") {
    const times = (schedule.times ?? []).map((t) => t.trim()).filter(Boolean);
    if (!times.length) return;

    const allowedDow = schedule.pattern === "DOW" ? schedule.dow ?? [] : null;

    for (
      let d = new Date(rangeStart);
      d.getTime() <= rangeEnd.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      if (allowedDow) {
        const isoDow = jsDayToISOdow(d.getDay());
        if (!allowedDow.includes(isoDow)) continue;
      }

      for (const t of times) {
        const [hh, mm] = t.split(":").map(Number);
        const plannedAt = new Date(d);
        plannedAt.setHours(hh, mm, 0, 0);
        await createOneToma(plannedAt);
      }
    }
    return;
  }

  // EVERY_X_HOURS
  if (schedule.pattern === "EVERY_X_HOURS") {
    const interval = schedule.everyXHours ?? 8;
    if (!interval || interval < 1) return;

    let t = new Date(rangeStart);
    t.setHours(0, 0, 0, 0);

    while (t.getTime() <= rangeEnd.getTime()) {
      await createOneToma(new Date(t));
      t = new Date(t.getTime() + interval * 3_600_000);
    }
    return;
  }
}
