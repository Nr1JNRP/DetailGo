import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

export type OwnerNotification = {
  type: string;
  title: string;
  body: string;
  appointmentId: string;
  customerName?: string | null;
  serviceLabel?: string | null;
  startAtMs?: number | null;
};

/**
 * Grava a notificacao no sino do owner (shops/{shopId}/notifications) e envia o
 * push FCM para os tokens do dono da estetica (users/{ownerId}.fcmTokens),
 * removendo tokens invalidos. Espelha o notifyCustomer, mas para o lado do shop.
 */
export async function notifyOwner(shopId: string, n: OwnerNotification): Promise<void> {
  const db = admin.firestore();

  // 1) Sino in-app do shop — independe de ter token de push.
  await db
    .collection('shops')
    .doc(shopId)
    .collection('notifications')
    .add({
      type: n.type,
      title: n.title,
      body: n.body,
      appointmentId: n.appointmentId,
      customerName: n.customerName ?? null,
      serviceLabel: n.serviceLabel ?? null,
      startAtMs: n.startAtMs ?? null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 2) Push FCM para o owner.
  const shopSnap = await db.collection('shops').doc(shopId).get();
  const ownerId = shopSnap.get('ownerId') as string | undefined;
  if (!ownerId) {
    logger.warn(`Shop ${shopId} sem ownerId; push nao enviado.`);
    return;
  }

  const ownerSnap = await db.collection('users').doc(ownerId).get();
  const tokens = (ownerSnap.get('fcmTokens') as string[] | undefined) ?? [];
  if (tokens.length === 0) {
    logger.info(`Owner ${ownerId} sem fcmTokens; push nao enviado.`);
    return;
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: n.title, body: n.body },
    data: { type: n.type, shopId, appointmentId: n.appointmentId },
    android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    if (res.success) return;
    const code = res.error?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length > 0) {
    await db
      .collection('users')
      .doc(ownerId)
      .update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
  }

  logger.info(
    `Notificacao "${n.type}" enviada ao owner ${ownerId}: ${response.successCount}/${tokens.length} ok.`,
  );
}
