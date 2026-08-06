import React from 'react';
import { getAuth } from '@react-native-firebase/auth';

import { useFeedback } from '@shared/components/FeedbackProvider';

import NotificationsScreenView from '../components/NotificationsScreenView';
import { useUserNotifications } from '../hooks/useUserNotifications';
import {
  clearUserNotifications,
  markAllUserNotificationsRead,
} from '../services/notifications.service';

/** Tela de notificações do cliente (lembretes de agendamento). */
export default function CustomerNotificationsScreen() {
  const uid = getAuth().currentUser?.uid ?? null;
  const { items, loading } = useUserNotifications(uid);
  const { showConfirm, showError } = useFeedback();

  const handleClearAll = () => {
    if (!uid) return;
    showConfirm({
      title: 'Limpar notificações',
      message: 'Isso vai apagar todas as suas notificações. Deseja continuar?',
      confirmLabel: 'Limpar tudo',
      destructive: true,
      onConfirm: async () => {
        try {
          await clearUserNotifications(uid);
        } catch {
          showError('Não foi possível limpar as notificações agora.');
        }
      },
    });
  };

  return (
    <NotificationsScreenView
      items={items}
      loading={loading}
      subtitle="Seus lembretes"
      onOpened={() => {
        if (uid) markAllUserNotificationsRead(uid).catch(() => {});
      }}
      onClearAll={handleClearAll}
    />
  );
}
