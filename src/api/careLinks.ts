import {
  setDoc,
  doc,
  query,
  where,
  getDocs,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getUserById, UserProfile } from "./users";

export type CareLinkStatus = "PENDING" | "ACTIVE" | "REJECTED" | "REMOVED";

export type CareLink = {
  id: string;
  patientId: string;
  caregiverEmail: string;
  caregiverId?: string;
  status: CareLinkStatus;
  createdAt: any;
  acceptedAt?: any;
  rejectedAt?: any;
  removedAt?: any;
};

/**
 * Paciente invita a cuidador
 * ID = caregiverEmail (temporal, hasta aceptar)
 */
export async function inviteCaregiver(
  patientId: string,
  caregiverEmail: string
) {
  const email = caregiverEmail.trim().toLowerCase();
  if (!email) throw new Error("Email inválido");

  const tempId = `${email}_${patientId}`;

  await setDoc(doc(db, "careLinks", tempId), {
    patientId,
    caregiverEmail: email,
    status: "PENDING",
    createdAt: serverTimestamp(),
  });
}

/**
 * Invitaciones pendientes por email
 */
export async function getPendingInvitesByEmail(email: string) {
  const q = query(
    collection(db, "careLinks"),
    where("caregiverEmail", "==", email.toLowerCase()),
    where("status", "==", "PENDING")
  );

  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) }) as CareLink
  );
}

/**
 * Aceptar invitación
 * ⚠️ Se reescribe el documento con ID determinista
 */
export async function acceptInvite(
  oldCareLinkId: string,
  caregiverId: string
) {
  const oldRef = doc(db, "careLinks", oldCareLinkId);
  const snap = await getDocs(
    query(collection(db, "careLinks"), where("__name__", "==", oldCareLinkId))
  );

  if (snap.empty) throw new Error("Invitación no encontrada");

  const data = snap.docs[0].data();
  const patientId = data.patientId;

  const newId = `${caregiverId}_${patientId}`;

  await setDoc(doc(db, "careLinks", newId), {
    patientId,
    caregiverId,
    caregiverEmail: data.caregiverEmail,
    status: "ACTIVE",
    createdAt: data.createdAt,
    acceptedAt: serverTimestamp(),
  });

  await updateDoc(oldRef, { status: "REMOVED" });
}

/**
 * Rechazar invitación
 */
export async function rejectInvite(careLinkId: string) {
  await updateDoc(doc(db, "careLinks", careLinkId), {
    status: "REJECTED",
    rejectedAt: serverTimestamp(),
  });
}

/**
 * Eliminar relación paciente–cuidador
 * - Si pasas caregiverId + patientId: usa ID determinista
 * - Si pasas un único linkId: lo usa directamente
 */
export async function removeCareLink(
  caregiverIdOrLinkId: string,
  patientId?: string
) {
  const id = patientId
    ? `${caregiverIdOrLinkId}_${patientId}`
    : caregiverIdOrLinkId;

  await updateDoc(doc(db, "careLinks", id), {
    status: "REMOVED",
    removedAt: serverTimestamp(),
  });
}

/**
 * Cuidadores activos de un paciente
 */
export async function getActiveCareLinksForPatient(
  patientId: string
): Promise<{ linkId: string; caregiver: UserProfile }[]> {
  const q = query(
    collection(db, "careLinks"),
    where("patientId", "==", patientId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);

  const result = await Promise.all(
    snap.docs.map(async (d) => {
      const caregiverId = d.data().caregiverId;
      if (!caregiverId) return null;
      const caregiver = await getUserById(caregiverId);
      if (!caregiver) return null;
      return { linkId: d.id, caregiver };
    })
  );

  return result.filter(Boolean) as {
    linkId: string;
    caregiver: UserProfile;
  }[];
}

/**
 * Pacientes activos de un cuidador
 */
export async function getPatientsForCaregiver(
  caregiverId: string
): Promise<UserProfile[]> {
  const q = query(
    collection(db, "careLinks"),
    where("caregiverId", "==", caregiverId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);
  const patients = await Promise.all(
    snap.docs.map((d) => getUserById(d.data().patientId))
  );

  return patients.filter(Boolean) as UserProfile[];
}

/**
 * IDs de cuidadores activos de un paciente
 * (para notificaciones y permisos)
 */
export async function getActiveCaregivers(
  patientId: string
): Promise<string[]> {
  const q = query(
    collection(db, "careLinks"),
    where("patientId", "==", patientId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => d.data().caregiverId as string)
    .filter(Boolean);
}
