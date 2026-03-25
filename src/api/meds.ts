import {
  addDoc,
  collection,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type CreateMedicationInput = {
  name: string;
  form?: string;
  strength?: string;
  notes?: string;
  imageUrl?: string;
};

export async function createMedication(
  patientId: string,
  data: CreateMedicationInput
) {
  if (!patientId) throw new Error("patientId requerido");

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuario no autenticado");

  await addDoc(collection(db, "medications"), {
    patientId,
    createdBy: uid,
    name: data.name,
    form: data.form ?? "",
    strength: data.strength ?? "",
    notes: data.notes ?? "",
    imageUrl: data.imageUrl ?? "",
    createdAt: serverTimestamp(),
  });
}

export async function deleteMedication(medId: string) {
  await deleteDoc(doc(db, "medications", medId));
}

type UpdateMedicationInput = {
  imageUrl?: string;
};

export async function updateMedication(
  medId: string,
  data: UpdateMedicationInput
) {
  await updateDoc(doc(db, "medications", medId), data as any);
}
