import { useEffect } from 'react';

import { registerFcmToken, requestPushPermission } from '../services/push.service';
import { ensureNotificationChannel } from '../services/notifee.service';

/**
 * Garante o canal Android, pede permissão de notificação e registra o token
 * FCM do usuário (tipicamente o owner). A exibição em foreground é tratada
 * globalmente por useForegroundNotifications. Executa uma vez por uid.
 *
 * Importante: o token é registrado SEMPRE, mesmo se a permissão de exibição
 * for negada. O token FCM é valido independente da permissão — ela só controla
 * se a notificação aparece na bandeja. Assim o servidor sempre tem pra onde
 * enviar, e as notificações passam a aparecer assim que o usuário ativar a
 * permissão (inclusive pelas configuracoes do Android).
 */
export function useRegisterPushToken(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid) return;

    let unsubRefresh: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      await ensureNotificationChannel();

      // Pede a permissão (best-effort) — para a notificação poder ser exibida.
      await requestPushPermission();
      if (cancelled) return;

      // Registra o token independentemente do resultado da permissão.
      unsubRefresh = await registerFcmToken(uid);
      if (cancelled) unsubRefresh?.();
    })();

    return () => {
      cancelled = true;
      unsubRefresh?.();
    };
  }, [uid]);
}
