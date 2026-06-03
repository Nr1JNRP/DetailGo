import notifee, { AndroidImportance } from '@notifee/react-native';

export const ANDROID_CHANNEL_ID = 'default';

/**
 * Cria (ou atualiza) o canal de notificação de alta prioridade.
 * Necessário no Android 8+ e responsável pelo banner "heads-up" no topo.
 */
export async function ensureNotificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: 'Agendamentos',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Exibe uma notificação local na bandeja do Android. Usado para mostrar o push
 * quando o app está em primeiro plano (foreground), já que nesse estado o
 * sistema não exibe automaticamente as mensagens do FCM.
 */
export async function displayPushNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  await ensureNotificationChannel();
  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: ANDROID_CHANNEL_ID,
      smallIcon: 'ic_launcher',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
}
