import {
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import type { AppNotification } from '../domain/notification.types';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

const MAX_NOTIFICATIONS = 50;

function normalize(d: QDoc): AppNotification {
  const data = d.data() as Record<string, unknown>;
  const createdAt = data.createdAt as FirebaseFirestoreTypes.Timestamp | undefined;
  return {
    id: d.id,
    type: (data.type as AppNotification['type']) ?? 'appointment_created',
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

// Caminho da coleção de notificações: shop (owner) ou user (cliente).
type Scope = { kind: 'shop'; shopId: string } | { kind: 'user'; uid: string };

function notificationsPath(scope: Scope): [string, string, string] {
  return scope.kind === 'shop'
    ? ['shops', scope.shopId, 'notifications']
    : ['users', scope.uid, 'notifications'];
}

/** Escuta as notificações de um escopo em tempo real (mais recentes primeiro). */
function watchNotifications(
  scope: Scope,
  onChange: (items: AppNotification[]) => void,
  onError?: (err: unknown) => void,
) {
  const db = getFirestore();
  const [c, id, sub] = notificationsPath(scope);
  const qy = query(
    collection(db, c, id, sub),
    orderBy('createdAt', 'desc'),
    limit(MAX_NOTIFICATIONS),
  );

  return onSnapshot(
    qy,
    snap => onChange(snap.docs.map((d: QDoc) => normalize(d))),
    err => onError?.(err),
  );
}

/** Marca todas as notificações não lidas de um escopo como lidas. */
async function markAllRead(scope: Scope): Promise<void> {
  const db = getFirestore();
  const [c, id, sub] = notificationsPath(scope);
  const qy = query(
    collection(db, c, id, sub),
    where('read', '==', false),
    limit(MAX_NOTIFICATIONS),
  );
  const snap = await getDocs(qy);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d: QDoc) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

/**
 * Apaga TODAS as notificações de um escopo (esvazia o sino). O Firestore não
 * deleta uma coleção inteira de uma vez: busca em lotes e deleta em batch
 * (limite de 500 por batch) até não sobrar nada.
 */
async function clearAll(scope: Scope): Promise<void> {
  const db = getFirestore();
  const [c, id, sub] = notificationsPath(scope);
  const PAGE = 400;

  let done = false;
  while (!done) {
    const snap = await getDocs(query(collection(db, c, id, sub), limit(PAGE)));
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d: QDoc) => batch.delete(d.ref));
    await batch.commit();

    done = snap.size < PAGE;
  }
}

// ── Owner (shop) ──
export function watchShopNotifications(
  shopId: string,
  onChange: (items: AppNotification[]) => void,
  onError?: (err: unknown) => void,
) {
  return watchNotifications({ kind: 'shop', shopId }, onChange, onError);
}

export function markAllNotificationsRead(shopId: string): Promise<void> {
  return markAllRead({ kind: 'shop', shopId });
}

export function clearShopNotifications(shopId: string): Promise<void> {
  return clearAll({ kind: 'shop', shopId });
}

// ── Cliente (user) ──
export function watchUserNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  onError?: (err: unknown) => void,
) {
  return watchNotifications({ kind: 'user', uid }, onChange, onError);
}

export function markAllUserNotificationsRead(uid: string): Promise<void> {
  return markAllRead({ kind: 'user', uid });
}

export function clearUserNotifications(uid: string): Promise<void> {
  return clearAll({ kind: 'user', uid });
}
