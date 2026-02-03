// src/api/users.ts
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

/**
 * Roles admitidos en la app
 */
export type UserRole = "PATIENT" | "CAREGIVER" | "FAMILY";

/**
 * Modelo de usuario en Firestore
 */
export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt?: any;
};

/**
 * Crea o actualiza el perfil del usuario
 * Se llama:
 * - tras el registro
 * - tras el primer login
 */
export async function upsertUserProfile(input: {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
}) {
  const { uid, fullName, email, role } = input;

  await setDoc(
    doc(db, "users", uid),
    {
      fullName,
      email: email.toLowerCase(),
      role,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Obtiene un usuario por su ID
 * Usado para mostrar nombre/email del paciente en invitaciones
 */
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

/**
 * Obtiene un usuario por email
 */
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
