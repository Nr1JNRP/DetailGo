import { useEffect, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import type { UserAppointment } from '../domain/appointment.types';
import {
  normalizeUserAppointmentFromGlobal,
  normalizeUserAppointmentFromSubcollection,
} from '../data/appointment.normalizers';
import { filterActiveAppointments } from '../domain/appointment.helpers';

export type DashboardAppointment = UserAppointment;

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

type Params = {
  uid: string;
  shopId: string;
  limitN?: number;
};

export function useDashboardAppointments({ uid, shopId, limitN = 30 }: Params) {
  const [items, setItems] = useState<DashboardAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const fallbackOnceRef = useRef(false);

  useEffect(() => {
    if (!uid || !shopId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();
    setLoading(true);
    fallbackOnceRef.current = false;

    const qUser = query(
      collection(db, 'users', uid, 'appointments'),
      orderBy('whenMs', 'asc'),
      limit(limitN),
    );

    const unsub = onSnapshot(
      qUser,
      async snap => {
        const arr = snap.docs
          .map((d: QDoc) => normalizeUserAppointmentFromSubcollection(d))
          .filter(Boolean) as DashboardAppointment[];

        const activeAppointments = filterActiveAppointments(arr);

        if (snap.docs.length > 0) {
          setItems(activeAppointments);
          setLoading(false);
          return;
        }

        if (fallbackOnceRef.current) {
          setItems([]);
          setLoading(false);
          return;
        }

        fallbackOnceRef.current = true;

        try {
          const qGlobal = query(
            collection(db, 'shops', shopId, 'appointments'),
            where('customerUid', '==', uid),
            where('status', 'in', ['scheduled', 'in_progress']),
            orderBy('startAtMs', 'asc'),
            limit(limitN),
          );

          const globalSnap = await getDocs(qGlobal);

          const fromGlobal = globalSnap.docs
            .map((d: QDoc) => normalizeUserAppointmentFromGlobal(d))
            .filter(Boolean) as DashboardAppointment[];

          const activeGlobal = filterActiveAppointments(fromGlobal);

          setItems(activeGlobal);
          setLoading(false);
        } catch {
          setItems([]);
          setLoading(false);
        }
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [uid, shopId, limitN]);

  return { items, loading };
}
