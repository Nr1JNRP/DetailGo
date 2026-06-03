import { useEffect } from 'react';

import { registerFcmToken, requestPushPermission } from '../services/push.service';
import { ensureNotificationChannel } from '../services/notifee.service';

/**
 * Pede permissão de notificação, garante o canal Android e registra o token
 * FCM do usuário (tipicamente o owner). A exibição em foreground é tratada
 * globalmente por useForegroundNotifications. Executa uma vez por uid.
 */
export function useRegisterPushToken(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid) return;

    let unsubRefresh: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      await ensureNotificationChannel();

      const granted = await requestPushPermission();
      if (!granted || cancelled) return;

      unsubRefresh = await registerFcmToken(uid);
      if (cancelled) unsubRefresh?.();
    })();

    return () => {
      cancelled = true;
      unsubRefresh?.();
    };
  }, [uid]);
}
