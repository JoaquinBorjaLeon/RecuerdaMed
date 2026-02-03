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

export type FamilyLinkStatus = "PENDING" | "ACTIVE" | "REJECTED" | "REMOVED";

export type FamilyLink = {
  id: string;
  patientId: string;
  familyEmail: string;
  familyId?: string;
  status: FamilyLinkStatus;
  createdAt: any;
  acceptedAt?: any;
  rejectedAt?: any;
  removedAt?: any;
};

/**
 * Paciente invita a familiar
 * ID = familyEmail (temporal, hasta aceptar)
 */
export async function inviteFamily(patientId: string, familyEmail: string) {
  const email = familyEmail.trim().toLowerCase();
  if (!email) throw new Error("Email inválido");

  const tempId = `${email}_${patientId}`;

  await setDoc(doc(db, "familyLinks", tempId), {
    patientId,
    familyEmail: email,
    status: "PENDING",
    createdAt: serverTimestamp(),
  });
}

/**
 * Invitaciones pendientes por email
 */
export async function getPendingFamilyInvitesByEmail(email: string) {
  const q = query(
    collection(db, "familyLinks"),
    where("familyEmail", "==", email.toLowerCase()),
    where("status", "==", "PENDING")
  );

  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) }) as FamilyLink
  );
}

/**
 * Aceptar invitación
 * ⚠️ Se reescribe el documento con ID determinista
 */
export async function acceptFamilyInvite(
  oldFamilyLinkId: string,
  familyId: string
) {
  const oldRef = doc(db, "familyLinks", oldFamilyLinkId);
  const snap = await getDocs(
    query(collection(db, "familyLinks"), where("__name__", "==", oldFamilyLinkId))
  );

  if (snap.empty) throw new Error("Invitación no encontrada");

  const data = snap.docs[0].data();
  const patientId = data.patientId;

  const newId = `${familyId}_${patientId}`;

  await setDoc(doc(db, "familyLinks", newId), {
    patientId,
    familyId,
    familyEmail: data.familyEmail,
    status: "ACTIVE",
    createdAt: data.createdAt,
    acceptedAt: serverTimestamp(),
  });

  await updateDoc(oldRef, { status: "REMOVED" });
}

/**
 * Rechazar invitación
 */
export async function rejectFamilyInvite(familyLinkId: string) {
  await updateDoc(doc(db, "familyLinks", familyLinkId), {
    status: "REJECTED",
    rejectedAt: serverTimestamp(),
  });
}

/**
 * Eliminar relación paciente–familiar
 * - Si pasas familyId + patientId: usa ID determinista
 * - Si pasas un único linkId: lo usa directamente
 */
export async function removeFamilyLink(
  familyIdOrLinkId: string,
  patientId?: string
) {
  const id = patientId
    ? `${familyIdOrLinkId}_${patientId}`
    : familyIdOrLinkId;

  await updateDoc(doc(db, "familyLinks", id), {
    status: "REMOVED",
    removedAt: serverTimestamp(),
  });
}

/**
 * Familiares activos de un paciente
 */
export async function getActiveFamilyLinksForPatient(
  patientId: string
): Promise<{ linkId: string; family: UserProfile }[]> {
  const q = query(
    collection(db, "familyLinks"),
    where("patientId", "==", patientId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);

  const result = await Promise.all(
    snap.docs.map(async (d) => {
      const familyId = d.data().familyId;
      if (!familyId) return null;
      const family = await getUserById(familyId);
      if (!family) return null;
      return { linkId: d.id, family };
    })
  );

  return result.filter(Boolean) as {
    linkId: string;
    family: UserProfile;
  }[];
}

/**
 * Pacientes activos de un familiar
 */
export async function getPatientsForFamily(
  familyId: string
): Promise<UserProfile[]> {
  const q = query(
    collection(db, "familyLinks"),
    where("familyId", "==", familyId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);
  const patients = await Promise.all(
    snap.docs.map((d) => getUserById(d.data().patientId))
  );

  return patients.filter(Boolean) as UserProfile[];
}

/**
 * IDs de familiares activos de un paciente
 */
export async function getActiveFamilies(patientId: string): Promise<string[]> {
  const q = query(
    collection(db, "familyLinks"),
    where("patientId", "==", patientId),
    where("status", "==", "ACTIVE")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => d.data().familyId as string)
    .filter(Boolean);
}
