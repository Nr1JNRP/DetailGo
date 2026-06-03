import { useEffect, useMemo, useState } from 'react';

import { watchUserNotifications } from '../services/notifications.service';
import type { AppNotification } from '../domain/notification.types';

type Result = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
};

/** Escuta em tempo real as notificações do cliente e calcula não lidas. */
export function useUserNotifications(uid: string | null | undefined): Result {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = watchUserNotifications(
      uid,
      list => {
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [uid]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  return { items, unreadCount, loading };
}
