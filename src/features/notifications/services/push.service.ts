import { PermissionsAndroid, Platform } from 'react-native';
import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { arrayUnion, doc, getFirestore, setDoc } from '@react-native-firebase/firestore';

/**
 * Solicita permissão de notificação ao usuário.
 * - Android 13+ (API 33): exige POST_NOTIFICATIONS em runtime.
 * - Demais: messaging().requestPermission() resolve automaticamente.
 */
export async function requestPushPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }

    const status = await requestPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/** Salva um token FCM no documento do usuário (suporta múltiplos dispositivos). */
async function saveToken(uid: string, token: string): Promise<void> {
  const db = getFirestore();
  await setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) }, { merge: true });
}

/**
 * Registra o token FCM do dispositivo no usuário e assina renovações de token.
 * Retorna uma função para cancelar a assinatura de renovação.
 */
export async function registerFcmToken(uid: string): Promise<() => void> {
  const messaging = getMessaging();
  try {
    const token = await getToken(messaging);
    if (token) await saveToken(uid, token);
  } catch {
    // silencioso — sem token, apenas não recebe push
  }

  return onTokenRefresh(messaging, async token => {
    if (token) await saveToken(uid, token);
  });
}
