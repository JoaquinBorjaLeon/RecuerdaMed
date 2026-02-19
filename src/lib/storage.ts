import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

function uriToBlob(uri: string): Promise<Blob> {
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
