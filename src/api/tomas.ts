import {
  collection,
  setDoc,
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
import { startOfDay, endOfDay, parseYMD, iso, jsDayToISOdow } from "../utils/tomaHelpers";

/** Minutos antes de la expiración para enviar aviso */
const EXPIRY_WARNING_MINUTES = 5;

/** Obtiene los push tokens del paciente + todos sus vinculados (cuidadores y familiares) */
async function getAllLinkedTokens(patientId: string) {
  const linkedIds = await getActiveCaregivers(patientId);
  const allIds = Array.from(new Set([patientId, ...linkedIds]));
  return getPushTokensByUserIds(allIds);
}

/** Obtiene los push tokens de vinculados (cuidadores y familiares, sin el paciente) */
async function getLinkedCaregiverAndFamilyTokens(patientId: string) {
  const linkedIds = await getActiveCaregivers(patientId);
  return getPushTokensByUserIds(linkedIds);
}

/** Construye nombre del medicamento y paciente para los mensajes push */
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

// ── Operaciones Firestore ──

/** Inserta una toma en Firestore usando el dedupeKey como ID determinista (escritura atómica) */
export async function createToma(data: Omit<Toma, "id" | "createdAt">) {
  const tomaRef = doc(db, "tomas", data.dedupeKey);
  const existing = await getDoc(tomaRef);
  if (existing.exists()) return;

  await setDoc(tomaRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Listener en tiempo real de las tomas de un paciente. Actualiza estados automáticamente. */
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

/** Confirma una toma y notifica a cuidadores/familiares */
export async function confirmToma(tomaId: string, toma: Toma) {
  await updateDoc(doc(db, "tomas", tomaId), {
    status: "CONFIRMED",
    confirmedAt: new Date().toISOString(),
  });

  const tokens = await getLinkedCaregiverAndFamilyTokens(toma.patientId);
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

/**
 * Actualiza el estado de una toma según la hora actual:
 * PLANNED → DUE (dentro de ventana) → EXPIRED (pasada la ventana).
 * Envía notificaciones de aviso cercano a expiración y de expiración.
 */
export async function updateTomaStatusIfNeeded(toma: Toma) {
  const now = new Date().toISOString();

  // Aviso de caducidad cercana (5 min antes de windowEnd)
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

  // Notificación de expiración a todos los vinculados
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

/**
 * Genera tomas futuras a partir de una planificación.
 * Soporta patrones DAILY, DOW (días de la semana) y EVERY_X_HOURS.
 * Usa dedupeKey para evitar duplicados.
 */
export async function generateTomasFromSchedule(
  schedule: Schedule,
  daysAhead: number = 7
) {
  if (!schedule.patientId || !schedule.medId || !schedule.id) return;
  if (!schedule.startDate) return;

  // Snapshot de la medicación para desnormalizar en cada toma
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

  const tolerance = Math.max(schedule.toleranceMinutes ?? 30, 1);

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

  /** Crea una toma individual y programa sus notificaciones locales */
  const createOneToma = async (plannedAt: Date) => {
    if (plannedAt < rangeStart || plannedAt > rangeEnd) return;

    const plannedISO = iso(plannedAt);
    const dedupeKey = `${schedule.id}__${plannedISO}`;

    const existing = await getDoc(doc(db, "tomas", dedupeKey));
    if (existing.exists()) return;

    let notificationId: string | undefined;
    if (Platform.OS !== "web") {
      try {
        // Notificación principal: "Es hora de tomar tu medicación"
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

        // Aviso X min antes de expirar
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

        // Aviso de expiración
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
      } catch {
        // En web las notificaciones locales no están disponibles
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

  // Generar tomas según el patrón
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
    const hours = schedule.everyXHours ?? 1;
    if (hours <= 0) return;
    let t = new Date(rangeStart);
    while (t <= rangeEnd) {
      await createOneToma(new Date(t));
      t = new Date(t.getTime() + hours * 3600000);
    }
  }
}

/**
 * Comprueba si se puede eliminar una medicación.
 * Devuelve false si existen tomas futuras o planificaciones activas (sin endDate o con endDate futura).
 */
export async function canDeleteMedication(
  medicationId: string,
  patientId?: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const todayYMD = nowIso.slice(0, 10);

  try {
    const tomaBase = [
      where("medId", "==", medicationId),
      where("plannedAt", ">", nowIso),
    ];
    const tomaQ = query(
      collection(db, "tomas"),
      ...(patientId ? [where("patientId", "==", patientId), ...tomaBase] : tomaBase),
      limit(1)
    );
    const tomaSnap = await getDocs(tomaQ);
    if (!tomaSnap.empty) return false;

    const schedFilters = [where("medId", "==", medicationId)];
    if (patientId) schedFilters.push(where("patientId", "==", patientId));
    const schedQ = query(collection(db, "schedules"), ...schedFilters);
    const schedSnap = await getDocs(schedQ);

    for (const d of schedSnap.docs) {
      const sched = d.data();
      if (!sched.endDate || sched.endDate >= todayYMD) return false;
    }

    return true;
  } catch (e: any) {
    console.warn("canDeleteMedication error:", e?.code, e?.message, e);
    return false;
  }
}
