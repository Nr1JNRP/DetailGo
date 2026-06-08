import { useEffect, useMemo, useState, useCallback } from 'react';

import type { AppointmentStatus, UserAppointment } from '../domain/appointment.types';
import { watchUserAppointmentsWithFallback } from '../data/appointmentsRepo';

type Params = {
  uid?: string | null;
  shopId?: string | null;
  statusIn?: readonly AppointmentStatus[];
  limitN?: number;
};

export function useUserAppointments(params: Params) {
  const { uid, shopId, statusIn, limitN = 50 } = params;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UserAppointment[]>([]);
  const [version, setVersion] = useState(0);

  const statusSet = useMemo(() => new Set<AppointmentStatus>(statusIn ?? []), [statusIn]);

  const mutate = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = watchUserAppointmentsWithFallback({
      uid,
      shopId,
      limitN,
      onChange: list => {
        const scoped = shopId ? list.filter(item => !item.shopId || item.shopId === shopId) : list;

        const filtered =
          statusIn && statusIn.length > 0 ? scoped.filter(it => statusSet.has(it.status)) : scoped;

        const sorted = [...filtered].sort((a, b) => b.startAtMs - a.startAtMs);

        setItems(sorted);
        setLoading(false);
      },
      onError: () => {
        setItems([]);
        setLoading(false);
      },
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, shopId, limitN, statusIn?.join('|'), version]);

  return { loading, items, mutate };
}
