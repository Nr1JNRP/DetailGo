import React from 'react';

import { useShop } from '@features/shops';

import NotificationsScreenView from '../components/NotificationsScreenView';
import { useShopNotifications } from '../hooks/useShopNotifications';
import { markAllNotificationsRead } from '../services/notifications.service';

/** Tela de notificações do proprietário (estética). */
export default function NotificationsScreen() {
  const { shopId } = useShop();
  const { items, loading } = useShopNotifications(shopId);

  return (
    <NotificationsScreenView
      items={items}
      loading={loading}
      subtitle="Agendamentos recebidos"
      onOpened={() => {
        if (shopId) markAllNotificationsRead(shopId).catch(() => {});
      }}
    />
  );
}
