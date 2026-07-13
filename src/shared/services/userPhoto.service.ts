import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { getFirestore, doc, setDoc, deleteField } from '@react-native-firebase/firestore';

export type UploadProfilePhotoResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * Envia a foto de perfil pro Firebase Storage (users/{uid}/profile.jpg), grava a
 * URL de download em users/{uid}.photoURL e limpa o photoB64 legado (base64 no
 * Firestore). O listener único de users/{uid} (useMeStore) propaga a mudança.
 *
 * @param uid      dono da foto
 * @param localUri uri local do arquivo escolhido (image-picker asset.uri)
 */
export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
): Promise<UploadProfilePhotoResult> {
  try {
    const storageRef = ref(getStorage(), `users/${uid}/profile.jpg`);
    await putFile(storageRef, localUri);
    const url = await getDownloadURL(storageRef);

    await setDoc(
      doc(getFirestore(), 'users', uid),
      { photoURL: url, photoB64: deleteField() },
      { merge: true },
    );

    return { ok: true, url };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Não foi possível enviar a foto.' };
  }
}
