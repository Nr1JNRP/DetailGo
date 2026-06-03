import React from 'react';
import { getAuth } from '@react-native-firebase/auth';

import NotificationsScreenView from '../components/NotificationsScreenView';
import { useUserNotifications } from '../hooks/useUserNotifications';
import { markAllUserNotificationsRead } from '../services/notifications.service';

/** Tela de notificações do cliente (lembretes de agendamento). */
export default function CustomerNotificationsScreen() {
  const uid = getAuth().currentUser?.uid ?? null;
  const { items, loading } = useUserNotifications(uid);

  return (
    <NotificationsScreenView
      items={items}
      loading={loading}
      subtitle="Seus lembretes"
      onOpened={() => {
        if (uid) markAllUserNotificationsRead(uid).catch(() => {});
      }}
    />
  );
}
