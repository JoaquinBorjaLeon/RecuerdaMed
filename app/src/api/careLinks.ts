import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc,
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
 */
export async function inviteCaregiver(
  patientId: string,
  caregiverEmail: string
) {
  const email = caregiverEmail.trim().toLowerCase();
  if (!email) throw new Error("Email inválido");

  await addDoc(collection(db, "careLinks"), {
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
 */
export async function acceptInvite(careLinkId: string, caregiverId: string) {
  await updateDoc(doc(db, "careLinks", careLinkId), {
    caregiverId,
    status: "ACTIVE",
    acceptedAt: serverTimestamp(),
  });
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
 * (lo puede hacer paciente o cuidador)
 */
export async function removeCareLink(careLinkId: string) {
  await updateDoc(doc(db, "careLinks", careLinkId), {
    status: "REMOVED",
    removedAt: serverTimestamp(),
  });
}

/**
 * Cuidadores activos de un paciente (con careLinkId)
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
 * IDs de cuidadores activos (para notificaciones)
 */
export async function getActiveCaregivers(patientId: string): Promise<string[]> {
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
