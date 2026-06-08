import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Quando o status de um agendamento muda em shops/{shopId}/appointments/{id}
 * (ex.: o owner marca done/no_show/in_progress), propaga o novo status para a
 * cópia do cliente em users/{customerUid}/appointments/{id}.
 *
 * Necessário porque o owner não tem permissão de escrever na subcoleção de
 * outro usuário (regras do Firestore) — o Admin SDK aqui ignora as regras.
 * As duas cópias compartilham o mesmo id do documento.
 */

type AppointmentData = {
  customerUid?: string;
  status?: string;
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
  },
);
