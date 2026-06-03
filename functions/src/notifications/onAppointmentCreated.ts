import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Dispara quando um novo agendamento e criado em
 * shops/{shopId}/appointments/{appointmentId}.
 *
 * 1. Cria um registro de notificacao em shops/{shopId}/notifications (sino in-app).
 * 2. Envia push FCM para os dispositivos do owner da estetica.
 */

type AppointmentData = {
  customerName?: string;
  customerUid?: string;
  serviceLabel?: string;
  startAtMs?: number;
  status?: string;
};

/** Formata um timestamp (ms) como "dd/MM • HH:mm" no fuso de Sao Paulo. */
function formatWhen(startAtMs?: number): string {
  if (!startAtMs) return '';
  const date = new Date(startAtMs);
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')} • ${get('hour')}:${get('minute')}`;
}

export const onAppointmentCreated = onDocumentCreated(
  'shops/{shopId}/appointments/{appointmentId}',
  async event => {
    const snap = event.data;
    if (!snap) return;

    const { shopId, appointmentId } = event.params as {
      shopId: string;
      appointmentId: string;
    };
    const appt = snap.data() as AppointmentData;

    // So notifica novos agendamentos ativos.
    if (appt.status && appt.status !== 'scheduled') {
      logger.info(`Ignorando agendamento ${appointmentId} com status ${appt.status}.`);
      return;
    }

    const db = admin.firestore();

    const customerName = appt.customerName || 'Um cliente';
    const serviceLabel = appt.serviceLabel || 'um serviço';
    const when = formatWhen(appt.startAtMs);

    const title = 'Novo agendamento';
    const body = when
      ? `${customerName} agendou ${serviceLabel} para ${when}`
      : `${customerName} agendou ${serviceLabel}`;

    // 1) Registro in-app (sino)
    try {
      await db
        .collection('shops')
        .doc(shopId)
        .collection('notifications')
        .add({
          type: 'appointment_created',
          title,
          body,
          appointmentId,
          customerName,
          serviceLabel,
          startAtMs: appt.startAtMs ?? null,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      logger.error('Falha ao gravar notificacao in-app', err);
    }

    // 2) Push FCM para o owner
    try {
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
        notification: { title, body },
        data: {
          type: 'appointment_created',
          shopId,
          appointmentId,
        },
        android: {
          priority: 'high',
          notification: { channelId: 'default', sound: 'default' },
        },
      });

      // Remove tokens invalidos do array do owner.
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
        `Push enviado para owner ${ownerId}: ${response.successCount}/${tokens.length} ok.`,
      );
    } catch (err) {
      logger.error('Falha ao enviar push FCM', err);
    }
  },
);
