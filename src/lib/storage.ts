import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadUserAvatar(uid: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();

  const fileRef = ref(storage, `users/${uid}/avatar.jpg`);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}
