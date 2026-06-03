import { useEffect, useMemo, useState } from 'react';

import { watchShopNotifications } from '../services/notifications.service';
import type { ShopNotification } from '../data/notification.types';

type Result = {
  items: ShopNotification[];
  unreadCount: number;
  loading: boolean;
};

/** Escuta em tempo real as notificações do shop e calcula não lidas. */
export function useShopNotifications(shopId: string | null | undefined): Result {
  const [items, setItems] = useState<ShopNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = watchShopNotifications(
      shopId,
      list => {
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [shopId]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  return { items, unreadCount, loading };
}
