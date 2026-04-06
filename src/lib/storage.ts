import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Platform } from "react-native";
import { storage } from "./firebase";

/** Convierte una URI local (file:// o blob) a Blob para subir a Firebase Storage */
async function uriToBlob(uri: string): Promise<Blob> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    if (!res.ok) throw new Error("No se pudo cargar la imagen");
    return res.blob();
  }

  // En nativo usamos XMLHttpRequest para convertir la URI a blob
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

/** Sube el avatar del usuario a Storage y devuelve su URL pública */
export async function uploadUserAvatar(uid: string, uri: string) {
  const blob = await uriToBlob(uri);
  const fileRef = ref(storage, `users/${uid}/avatar.jpg`);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}

/** Sube una imagen de medicación a Storage y devuelve su URL pública */
export async function uploadMedicationImage(
  uploaderUid: string,
  uri: string
) {
  const blob = await uriToBlob(uri);
  const ts = Date.now();
  const fileRef = ref(
    storage,
    `users/${uploaderUid}/medications/med-${ts}.jpg`
  );
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}
