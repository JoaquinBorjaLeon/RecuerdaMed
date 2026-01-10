// src/api/meds.ts
import {
  addDoc,
  collection,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { canDeleteMedication } from "./tomas";

type CreateMedicationInput = {
  name: string;
  form?: string;
  strength?: string;
  notes?: string;
};

export async function createMedication(
  patientId: string,
  data: CreateMedicationInput
) {
  if (!patientId) {
    throw new Error("patientId requerido");
  }

  await addDoc(collection(db, "medications"), {
    patientId,
    name: data.name,
    form: data.form ?? "",
    strength: data.strength ?? "",
    notes: data.notes ?? "",
    createdAt: serverTimestamp(),
  });
}

export async function deleteMedication(medicationId: string) {
  const allowed = await canDeleteMedication(medicationId);
  if (!allowed) {
    throw new Error("No se puede borrar una medicación con tomas futuras");
  }
  await deleteDoc(doc(db, "medications", medicationId));
}
