import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type UserRole = "PATIENT" | "CAREGIVER" | "FAMILY";

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt?: any;
};

/** Crea o actualiza el perfil del usuario (registro o primer login) */
export async function upsertUserProfile(input: {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  photoURL?: string;
}) {
  const { uid, fullName, email, role, photoURL } = input;

  await setDoc(
    doc(db, "users", uid),
    {
      fullName,
      email: email.toLowerCase(),
      role,
      ...(photoURL ? { photoURL } : {}),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Actualiza campos editables del perfil (nombre, foto) */
export async function updateUserProfile(uid: string, patch: Partial<UserProfile>) {
  const data: Record<string, any> = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.photoURL !== undefined) data.photoURL = patch.photoURL;

  if (Object.keys(data).length === 0) return;
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

/** Obtiene un usuario por su UID */
export async function getUserById(
  uid: string
): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...(snap.data() as Omit<UserProfile, "id">),
  };
}

/** Busca un usuario por email (normalizado a minúsculas) */
export async function getUserByEmail(
  email: string
): Promise<UserProfile | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const q = query(
    collection(db, "users"),
    where("email", "==", normalized)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<UserProfile, "id">),
  };
}
