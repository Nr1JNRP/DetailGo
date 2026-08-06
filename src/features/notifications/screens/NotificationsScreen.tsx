import React from 'react';

import { useShop } from '@features/shops';
import { useFeedback } from '@shared/components/FeedbackProvider';

import NotificationsScreenView from '../components/NotificationsScreenView';
import { useShopNotifications } from '../hooks/useShopNotifications';
import {
  clearShopNotifications,
  markAllNotificationsRead,
} from '../services/notifications.service';

/** Tela de notificações do proprietário (estética). */
export default function NotificationsScreen() {
  const { shopId } = useShop();
  const { items, loading } = useShopNotifications(shopId);
  const { showConfirm, showError } = useFeedback();

  const handleClearAll = () => {
    if (!shopId) return;
    showConfirm({
      title: 'Limpar notificações',
      message: 'Isso vai apagar todas as notificações da estética. Deseja continuar?',
      confirmLabel: 'Limpar tudo',
      destructive: true,
      onConfirm: async () => {
        try {
          await clearShopNotifications(shopId);
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
      subtitle="Agendamentos recebidos"
      onOpened={() => {
        if (shopId) markAllNotificationsRead(shopId).catch(() => {});
      }}
      onClearAll={handleClearAll}
    />
  );
}
