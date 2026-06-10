import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { notifyCustomer } from '../notifications/notifyCustomer';

/**
 * Quando o status de um agendamento muda em shops/{shopId}/appointments/{id}
 * (ex.: o owner marca done/no_show/in_progress):
 *  1. propaga o novo status para a cópia do cliente em
 *     users/{customerUid}/appointments/{id} (o owner não pode escrever na
 *     subcoleção de outro usuário; o Admin SDK ignora as regras);
 *  2. quando o servico e CONCLUIDO (done), notifica o cliente (push + sino)
 *     para ele saber que o atendimento terminou.
 *
 * As duas cópias do agendamento compartilham o mesmo id do documento.
 */

type AppointmentData = {
  customerUid?: string;
  status?: string;
  serviceLabel?: string;
};

export const onAppointmentStatusChanged = onDocumentUpdated(
  'shops/{shopId}/appointments/{appointmentId}',
  async event => {
    const before = event.data?.before.data() as AppointmentData | undefined;
    const after = event.data?.after.data() as AppointmentData | undefined;
    if (!before || !after) return;

    // Só age quando o status realmente mudou.
    if (before.status === after.status) return;

    const { appointmentId } = event.params as { appointmentId: string };
    const customerUid = after.customerUid;
    if (!customerUid || !after.status) return;

    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const payload: Record<string, unknown> = {
      status: after.status,
      updatedAt: now,
    };
    if (after.status === 'in_progress') payload.startedAt = now;
    if (after.status === 'done') payload.doneAt = now;
    if (after.status === 'no_show') payload.noShowAt = now;
    if (after.status === 'cancelled') payload.cancelledAt = now;

    try {
      await db
        .collection('users')
        .doc(customerUid)
        .collection('appointments')
        .doc(appointmentId)
        .set(payload, { merge: true });
    } catch (err) {
      logger.error(`Falha ao sincronizar status do agendamento ${appointmentId}`, err);
    }

    // Servico concluido → notifica o cliente (push + sino).
    if (after.status === 'done') {
      const service = after.serviceLabel || 'seu serviço';
      try {
        await notifyCustomer(customerUid, {
          type: 'appointment_done',
          title: 'Serviço concluído',
          body: `Seu ${service} foi finalizado. Obrigado pela preferência!`,
          appointmentId,
          serviceLabel: after.serviceLabel ?? null,
        });
      } catch (err) {
        logger.error(`Falha ao notificar conclusao do agendamento ${appointmentId}`, err);
      }
    }
  },
);
