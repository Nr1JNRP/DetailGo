import { useEffect } from 'react';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';

import { ensureNotificationChannel, displayPushNotification } from '../services/notifee.service';

/**
 * Handler GLOBAL de notificações em foreground. Deve ser montado no topo da
 * árvore (App), pois o Android não exibe sozinho mensagens do FCM com o app
 * aberto — precisamos exibir manualmente via notifee, independente da tela
 * ou da conta logada no momento.
 */
export function useForegroundNotifications(): void {
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      await ensureNotificationChannel();

      unsub = onMessage(getMessaging(), async remoteMessage => {
        const title = remoteMessage.notification?.title ?? 'Nova notificação';
        const body = remoteMessage.notification?.body ?? '';
        await displayPushNotification(
          title,
          body,
          remoteMessage.data as Record<string, string>,
        ).catch(() => {});
      });
    })();

    return () => unsub?.();
  }, []);
}
