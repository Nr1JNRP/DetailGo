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

import type { AppointmentStatus, UserAppointment } from '../domain/appointment.types';

import {
  normalizeUserAppointmentFromGlobal,
  normalizeUserAppointmentFromSubcollection,
} from './appointment.normalizers';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

export function watchUserAppointmentsWithFallback(params: {
  uid: string;
  shopId?: string | null;
  limitN?: number;
  onChange: (items: UserAppointment[]) => void;
  onError?: (err: unknown) => void;
}) {
  const db = getFirestore();
  const { uid, shopId, limitN = 50, onChange, onError } = params;

  let fallbackDone = false;

  const qy = query(
    collection(db, 'users', uid, 'appointments'),
    orderBy('whenMs', 'desc'),
    limit(limitN),
  );

  const unsub = onSnapshot(
    qy,
    async snap => {
      const listFromSub = snap.docs
        .map((d: QDoc) => normalizeUserAppointmentFromSubcollection(d))
        .filter(Boolean) as UserAppointment[];

      if (snap.docs.length > 0) {
        onChange(listFromSub);
        return;
      }

      if (fallbackDone) {
        onChange([]);
        return;
      }

      if (!shopId) {
        onChange([]);
        return;
      }

      fallbackDone = true;

      try {
        const globalQy = query(
          collection(db, 'shops', shopId, 'appointments'),
          where('customerUid', '==', uid),
          orderBy('startAtMs', 'desc'),
          limit(limitN),
        );

        const globalSnap = await getDocs(globalQy);

        const fromGlobal = globalSnap.docs
          .map((d: QDoc) => normalizeUserAppointmentFromGlobal(d))
          .filter(Boolean) as UserAppointment[];

        onChange(fromGlobal);
      } catch (e) {
        onError?.(e);
        onChange([]);
      }
    },
    err => {
      onError?.(err);
    },
  );

  return unsub;
}

export async function fetchUserAppointmentsGlobal(params: {
  uid: string;
  shopId: string;
  statusIn?: AppointmentStatus[];
  limitN?: number;
}) {
  const db = getFirestore();
  const { uid, shopId, statusIn, limitN = 50 } = params;

  const qy = statusIn?.length
    ? query(
        collection(db, 'shops', shopId, 'appointments'),
        where('customerUid', '==', uid),
        where('status', 'in', statusIn),
        orderBy('startAtMs', 'desc'),
        limit(limitN),
      )
    : query(
        collection(db, 'shops', shopId, 'appointments'),
        where('customerUid', '==', uid),
        orderBy('startAtMs', 'desc'),
        limit(limitN),
      );

  const snap = await getDocs(qy);

  return snap.docs
    .map((d: QDoc) => normalizeUserAppointmentFromGlobal(d))
    .filter(Boolean) as UserAppointment[];
}
