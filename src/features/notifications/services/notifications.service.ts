import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import type { ShopNotification } from '../data/notification.types';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

const MAX_NOTIFICATIONS = 50;

function normalize(d: QDoc): ShopNotification {
  const data = d.data() as Record<string, unknown>;
  const createdAt = data.createdAt as FirebaseFirestoreTypes.Timestamp | undefined;
  return {
    id: d.id,
    type: (data.type as ShopNotification['type']) ?? 'appointment_created',
    title: (data.title as string) ?? 'Notificação',
    body: (data.body as string) ?? '',
    appointmentId: data.appointmentId as string | undefined,
    customerName: data.customerName as string | undefined,
    serviceLabel: data.serviceLabel as string | undefined,
    startAtMs: (data.startAtMs as number | null | undefined) ?? null,
    read: Boolean(data.read),
    createdAtMs: createdAt?.toMillis?.() ?? 0,
  };
}

/** Escuta as notificações do shop em tempo real (mais recentes primeiro). */
export function watchShopNotifications(
  shopId: string,
  onChange: (items: ShopNotification[]) => void,
  onError?: (err: unknown) => void,
) {
  const db = getFirestore();
  const qy = query(
    collection(db, 'shops', shopId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(MAX_NOTIFICATIONS),
  );

  return onSnapshot(
    qy,
    snap => onChange(snap.docs.map((d: QDoc) => normalize(d))),
    err => onError?.(err),
  );
}

/** Marca uma notificação como lida. */
export async function markNotificationRead(shopId: string, notificationId: string): Promise<void> {
  const db = getFirestore();
  await updateDoc(doc(db, 'shops', shopId, 'notifications', notificationId), { read: true });
}

/** Marca todas as notificações não lidas do shop como lidas. */
export async function markAllNotificationsRead(shopId: string): Promise<void> {
  const db = getFirestore();
  const qy = query(
    collection(db, 'shops', shopId, 'notifications'),
    where('read', '==', false),
    limit(MAX_NOTIFICATIONS),
  );
  const snap = await getDocs(qy);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d: QDoc) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
