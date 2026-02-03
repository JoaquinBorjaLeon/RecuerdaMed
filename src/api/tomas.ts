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
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Toma, Schedule } from "../types";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getActiveCaregivers } from "./careLinks";
import { getPushTokensByUserIds } from "./pushTokens";
import { sendPushToUsers } from "./notifications";
import { getUserById } from "./users";

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
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function iso(d: Date) {
  return d.toISOString();
}
function jsDayToISOdow(jsDay: number) {
  return ((jsDay + 6) % 7) + 1;
}

const EXPIRY_WARNING_MINUTES = 5;

async function getAllLinkedTokens(patientId: string) {
  const caregiverIds = await getActiveCaregivers(patientId);
  const allIds = Array.from(new Set([patientId, ...caregiverIds]));
  return getPushTokensByUserIds(allIds);
}

async function getLinkedCaregiverTokens(patientId: string) {
  const caregiverIds = await getActiveCaregivers(patientId);
  return getPushTokensByUserIds(caregiverIds);
}

async function buildTomaMessage(toma: Toma) {
  let medName = "medicación";
  try {
    const medSnap = await getDoc(doc(db, "medications", toma.medId));
    if (medSnap.exists()) {
      const data = medSnap.data() as any;
      if (data?.name) medName = data.name;
    }
  } catch {}

  let patientName = "Paciente";
  try {
    const user = await getUserById(toma.patientId);
    if (user?.fullName) patientName = user.fullName;
  } catch {}

  return { medName, patientName };
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

    cb(items);

    await Promise.all(
      items.map(async (t) => {
        try {
          await updateTomaStatusIfNeeded(t);
        } catch {}
      })
    );
  });
}

export async function confirmToma(tomaId: string, toma: Toma) {
  await updateDoc(doc(db, "tomas", tomaId), {
    status: "CONFIRMED",
    confirmedAt: new Date().toISOString(),
  });

  const tokens = await getLinkedCaregiverTokens(toma.patientId);
  const { medName, patientName } = await buildTomaMessage(toma);
  const confirmedAt = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  await sendPushToUsers(
    tokens,
    "RecuerdaMed",
    `${patientName} confirmó la toma de ${medName} a las ${confirmedAt}`
  );

  await updateDoc(doc(db, "tomas", tomaId), {
    confirmedNotifiedAt: new Date().toISOString(),
  });
}

export async function updateTomaStatusIfNeeded(toma: Toma) {
  const now = new Date().toISOString();

  // aviso de caducidad cercana
  if (!toma.warningNotifiedAt && toma.status !== "CONFIRMED") {
    const warnAt = new Date(new Date(toma.windowEnd).getTime() - EXPIRY_WARNING_MINUTES * 60000);
    if (new Date(now) >= warnAt && new Date(now) < new Date(toma.windowEnd)) {
      const tokens = await getAllLinkedTokens(toma.patientId);
      const { medName, patientName } = await buildTomaMessage(toma);
      await sendPushToUsers(
        tokens,
        "RecuerdaMed",
        `La toma de ${medName} de ${patientName} caduca en ${EXPIRY_WARNING_MINUTES} min`
      );
      await updateDoc(doc(db, "tomas", toma.id), {
        warningNotifiedAt: new Date().toISOString(),
      });
    }
  }

  if (toma.status === "CONFIRMED") return;

  let nextStatus: Toma["status"] = "PLANNED";

  if (now >= toma.windowStart && now <= toma.windowEnd) {
    nextStatus = "DUE";
  } else if (now > toma.windowEnd) {
    nextStatus = "EXPIRED";
  }

  if (toma.status !== nextStatus) {
    await updateDoc(doc(db, "tomas", toma.id), { status: nextStatus });
  }

  if (nextStatus === "EXPIRED" && !toma.expiredNotifiedAt) {
    const tokens = await getAllLinkedTokens(toma.patientId);
    const { medName, patientName } = await buildTomaMessage(toma);
    await sendPushToUsers(
      tokens,
      "RecuerdaMed",
      `${patientName} no confirmó la toma de ${medName} a tiempo`
    );
    await updateDoc(doc(db, "tomas", toma.id), {
      expiredNotifiedAt: new Date().toISOString(),
    });
  }
}

export async function generateTomasFromSchedule(
  schedule: Schedule,
  daysAhead: number = 7
) {
  if (!schedule.patientId || !schedule.medId || !schedule.id) return;
  if (!schedule.startDate) return;

  let medSnapshot: { name?: string; strength?: string; form?: string } | null = null;
  try {
    const medSnap = await getDoc(doc(db, "medications", schedule.medId));
    if (medSnap.exists()) {
      const data = medSnap.data() as any;
      medSnapshot = {
        name: data?.name,
        strength: data?.strength,
        form: data?.form,
      };
    }
  } catch {}

  const tolerance = schedule.toleranceMinutes ?? 30;

  const today = startOfDay(new Date());
  const start = startOfDay(parseYMD(schedule.startDate));
  const rangeStart = startOfDay(
    new Date(Math.max(today.getTime(), start.getTime()))
  );

  const maxAhead = endOfDay(new Date());
  maxAhead.setDate(maxAhead.getDate() + daysAhead);

  let rangeEnd = maxAhead;
  if (schedule.endDate) {
    const end = endOfDay(parseYMD(schedule.endDate));
    rangeEnd = new Date(Math.min(maxAhead.getTime(), end.getTime()));
  }

  if (rangeEnd.getTime() < rangeStart.getTime()) return;

  const createOneToma = async (plannedAt: Date) => {
    if (plannedAt < rangeStart || plannedAt > rangeEnd) return;

    const plannedISO = iso(plannedAt);
    const dedupeKey = `${schedule.id}__${plannedISO}`;

    if (await tomaExistsByDedupeKey(schedule.patientId, dedupeKey)) return;

    let notificationId: string | undefined;
    if (Platform.OS !== "web") {
      try {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "RecuerdaMed",
            body: "Es hora de tomar tu medicación",
            data: {
              route: "/tomas",
              tomaPlannedAt: plannedISO,
              scheduleId: schedule.id,
              medId: schedule.medId,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: plannedAt,
          },
        });

        // Aviso de caducidad cercana
        const warnAt = new Date(
          plannedAt.getTime() + tolerance * 60000 - EXPIRY_WARNING_MINUTES * 60000
        );
        if (warnAt > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "RecuerdaMed",
              body: `La toma va a caducar en ${EXPIRY_WARNING_MINUTES} minutos`,
              data: {
                route: "/tomas",
                tomaPlannedAt: plannedISO,
                scheduleId: schedule.id,
                medId: schedule.medId,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: warnAt,
            },
          });
        }

        // Aviso de caducidad
        const expiredAt = new Date(plannedAt.getTime() + tolerance * 60000);
        if (expiredAt > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "RecuerdaMed",
              body: "No has confirmado la toma dentro del tiempo",
              data: {
                route: "/tomas",
                tomaPlannedAt: plannedISO,
                scheduleId: schedule.id,
                medId: schedule.medId,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: expiredAt,
            },
          });
        }
      } catch (e) {
        // En web no está disponible; no bloqueamos la creación
      }
    }

    const tomaPayload: Omit<Toma, "id" | "createdAt"> = {
      scheduleId: schedule.id,
      medId: schedule.medId,
      patientId: schedule.patientId,
      medName: medSnapshot?.name,
      medStrength: medSnapshot?.strength,
      medForm: medSnapshot?.form,
      plannedAt: plannedISO,
      windowStart: iso(
        new Date(plannedAt.getTime() - tolerance * 60000)
      ),
      windowEnd: iso(
        new Date(plannedAt.getTime() + tolerance * 60000)
      ),
      status: "PLANNED",
      dedupeKey,
    };

    if (notificationId) {
      tomaPayload.notificationId = notificationId;
    }

    await createToma(tomaPayload);
  };

  if (schedule.pattern === "DAILY" || schedule.pattern === "DOW") {
    const times = schedule.times ?? [];
    const allowedDow = schedule.pattern === "DOW" ? schedule.dow ?? [] : null;

    for (
      let d = new Date(rangeStart);
      d <= rangeEnd;
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
  }

  if (schedule.pattern === "EVERY_X_HOURS") {
    let t = new Date(rangeStart);
    while (t <= rangeEnd) {
      await createOneToma(new Date(t));
      t = new Date(t.getTime() + schedule.everyXHours! * 3600000);
    }
  }
}

export async function canDeleteMedication(
  medicationId: string,
  patientId?: string
): Promise<boolean> {
  // Bloqueamos borrado si existe *cualquier* toma futura del medicamento,
  // independientemente del status (PLANNED o DUE principalmente).
  // Usamos limit(1) para que sea rápido.
  const nowIso = new Date().toISOString();

  try {
    const base = [
      where("medId", "==", medicationId),
      where("plannedAt", ">", nowIso),
    ];
    const q = query(
      collection(db, "tomas"),
      ...(patientId ? [where("patientId", "==", patientId), ...base] : base),
      limit(1)
    );

    const snap = await getDocs(q);
    return snap.empty;
  } catch (e: any) {
    // Si por lo que sea la query falla, NO permitimos borrar (fail-safe)
    console.warn("canDeleteMedication error:", e?.code, e?.message, e);
    return false;
  }
}

