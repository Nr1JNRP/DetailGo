import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

export type CustomerNotification = {
  type: string;
  title: string;
  body: string;
  appointmentId: string;
  serviceLabel?: string | null;
  startAtMs?: number | null;
};

/**
 * Grava a notificacao no sino do cliente (users/{uid}/notifications) e envia o
 * push FCM para os tokens dele, removendo tokens invalidos. Reutilizavel por
 * qualquer trigger (lembrete, conclusao de servico, etc.).
 */
export async function notifyCustomer(customerUid: string, n: CustomerNotification): Promise<void> {
  const db = admin.firestore();

  // 1) Sino in-app — independe de ter token de push.
  await db
    .collection('users')
    .doc(customerUid)
    .collection('notifications')
    .add({
      type: n.type,
      title: n.title,
      body: n.body,
      appointmentId: n.appointmentId,
      serviceLabel: n.serviceLabel ?? null,
      startAtMs: n.startAtMs ?? null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 2) Push FCM.
  const userSnap = await db.collection('users').doc(customerUid).get();
  const tokens = (userSnap.get('fcmTokens') as string[] | undefined) ?? [];
  if (tokens.length === 0) {
    logger.info(`Cliente ${customerUid} sem fcmTokens; push nao enviado.`);
    return;
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: n.title, body: n.body },
    data: { type: n.type, appointmentId: n.appointmentId },
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
      .doc(customerUid)
      .update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
  }

  logger.info(
    `Notificacao "${n.type}" enviada ao cliente ${customerUid}: ${response.successCount}/${tokens.length} ok.`,
  );
}
