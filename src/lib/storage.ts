import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Platform } from "react-native";
import { storage } from "./firebase";

async function uriToBlob(uri: string): Promise<Blob> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error("No se pudo cargar la imagen");
    }
    return res.blob();
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

export async function uploadUserAvatar(uid: string, uri: string) {
  const blob = await uriToBlob(uri);

  const fileRef = ref(storage, `users/${uid}/avatar.jpg`);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}

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
