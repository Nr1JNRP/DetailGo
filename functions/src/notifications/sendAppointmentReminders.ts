import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { formatHour } from './format';

/**
 * Roda a cada 1 minuto. Encontra agendamentos que comecam nos proximos ~2 min
 * e ainda nao foram lembrados, e envia um push FCM ao cliente avisando que o
 * atendimento esta proximo.
 */

const LEAD_MS = 2 * 60 * 1000; // 2 minutos antes
const BUFFER_MS = 30 * 1000; // folga para nao perder ticks do cron

type ReminderAppointment = {
  customerUid?: string;
  serviceLabel?: string;
  startAtMs?: number;
  reminderSent?: boolean;
};

export const sendAppointmentReminders = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();

    // Agendamentos que comecam de agora ate ~2min (com folga) e ainda ativos.
    const snap = await db
      .collectionGroup('appointments')
      .where('status', '==', 'scheduled')
      .where('startAtMs', '>=', now)
      .where('startAtMs', '<=', now + LEAD_MS + BUFFER_MS)
      .get();

    if (snap.empty) return;

    let sent = 0;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data() as ReminderAppointment;
      if (appt.reminderSent) continue;
      if (!appt.customerUid) continue;

      try {
        const userSnap = await db.collection('users').doc(appt.customerUid).get();
        const tokens = (userSnap.get('fcmTokens') as string[] | undefined) ?? [];

        // Marca como lembrado mesmo sem token, para nao reprocessar a cada minuto.
        await docSnap.ref.update({ reminderSent: true });

        const service = appt.serviceLabel || 'seu atendimento';
        const hour = formatHour(appt.startAtMs);
        const title = 'Agendamento próximo';
        const body = hour
          ? `Seu ${service} é às ${hour}. Faltam poucos minutos!`
          : `Seu ${service} está próximo. Faltam poucos minutos!`;

        // Registro in-app (sino do cliente) — independe de ter token de push.
        await db
          .collection('users')
          .doc(appt.customerUid)
          .collection('notifications')
          .add({
            type: 'appointment_reminder',
            title,
            body,
            appointmentId: docSnap.id,
            serviceLabel: appt.serviceLabel ?? null,
            startAtMs: appt.startAtMs ?? null,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        if (tokens.length === 0) {
          logger.info(`Cliente ${appt.customerUid} sem fcmTokens; push nao enviado.`);
          continue;
        }

        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            type: 'appointment_reminder',
            appointmentId: docSnap.id,
          },
          android: {
            priority: 'high',
            notification: { channelId: 'default', sound: 'default' },
          },
        });

        // Remove tokens invalidos do cliente.
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
            .doc(appt.customerUid)
            .update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            });
        }

        sent += response.successCount;
      } catch (err) {
        logger.error(`Falha ao enviar lembrete do agendamento ${docSnap.id}`, err);
      }
    }

    if (sent > 0) {
      logger.info(`Lembretes enviados: ${sent}.`);
    }
  },
);
