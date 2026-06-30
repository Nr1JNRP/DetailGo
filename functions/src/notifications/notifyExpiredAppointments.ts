import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { formatHour } from './format';

/**
 * Roda a cada 1 minuto. Encontra agendamentos que passaram do horario marcado
 * + a tolerancia (15 min) e ainda estao `scheduled` (o estabelecimento nao deu
 * baixa). Avisa o cliente que o servico nao foi realizado e marca o doc para
 * nao reenviar.
 */

const GRACE_MS = 15 * 60 * 1000; // tolerancia de nao comparecimento
const LOOKBACK_MS = 3 * 60 * 60 * 1000; // olha as ultimas ~3h (limita a varredura)

type ExpiredAppointment = {
  customerUid?: string;
  serviceLabel?: string;
  startAtMs?: number;
  expiredNotified?: boolean;
};

export const notifyExpiredAppointments = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const cutoff = now - GRACE_MS;

    // scheduled que ja passaram do horario + tolerancia (na janela de lookback).
    // Só casa os docs de shops/*/appointments (os de users/* usam whenMs, nao
    // startAtMs) — evita duplicidade.
    const snap = await db
      .collectionGroup('appointments')
      .where('status', '==', 'scheduled')
      .where('startAtMs', '>=', now - LOOKBACK_MS)
      .where('startAtMs', '<=', cutoff)
      .get();

    if (snap.empty) return;

    let sent = 0;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data() as ExpiredAppointment;
      if (appt.expiredNotified) continue;
      if (!appt.customerUid) continue;

      try {
        const userSnap = await db.collection('users').doc(appt.customerUid).get();
        const tokens = (userSnap.get('fcmTokens') as string[] | undefined) ?? [];

        // Marca como avisado mesmo sem token, para nao reprocessar a cada ciclo.
        await docSnap.ref.update({ expiredNotified: true });

        const service = appt.serviceLabel || 'seu serviço';
        const hour = formatHour(appt.startAtMs);
        const title = 'Serviço não realizado';
        const body = hour
          ? `Seu ${service} das ${hour} passou do horário sem ser iniciado.`
          : `Seu ${service} passou do horário sem ser iniciado.`;

        // Registro in-app (sino do cliente) — independe de ter token de push.
        await db
          .collection('users')
          .doc(appt.customerUid)
          .collection('notifications')
          .add({
            type: 'appointment_expired',
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
            type: 'appointment_expired',
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
        logger.error(`Falha ao notificar expiracao do agendamento ${docSnap.id}`, err);
      }
    }

    if (sent > 0) {
      logger.info(`Notificacoes de expiracao enviadas: ${sent}.`);
    }
  },
);
