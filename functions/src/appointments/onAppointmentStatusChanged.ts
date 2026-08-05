import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { notifyCustomer } from '../notifications/notifyCustomer';
import { notifyOwner } from '../notifications/notifyOwner';
import {
  notifyCustomerWhatsApp,
  whatsappSecrets,
} from '../notifications/notifyCustomerWhatsApp';
import { formatWhen } from '../notifications/format';

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
  customerName?: string;
  status?: string;
  serviceLabel?: string;
  startAtMs?: number;
};

export const onAppointmentStatusChanged = onDocumentUpdated(
  {
    document: 'shops/{shopId}/appointments/{appointmentId}',
    secrets: whatsappSecrets,
  },
  async event => {
    const before = event.data?.before.data() as AppointmentData | undefined;
    const after = event.data?.after.data() as AppointmentData | undefined;
    if (!before || !after) return;

    // Só age quando o status realmente mudou.
    if (before.status === after.status) return;

    const { shopId, appointmentId } = event.params as {
      shopId: string;
      appointmentId: string;
    };
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

      // WhatsApp automático (best-effort — não quebra o fluxo se falhar).
      // Variáveis do template: {{1}} = nome, {{2}} = serviço.
      try {
        const name = after.customerName?.split(' ')[0] || 'Cliente';
        await notifyCustomerWhatsApp(customerUid, {
          contentVariables: { '1': name, '2': service },
          fallbackBody: `${name}, seu ${service} foi concluído! ✅ Obrigado — DetailGo.`,
        });
      } catch (err) {
        logger.error(`Falha ao enviar WhatsApp de conclusao ${appointmentId}`, err);
      }
    }

    // Cliente cancelou → avisa o owner (o horario abriu de novo na agenda).
    // Só o cliente gera status 'cancelled'; o owner marca done/no_show/in_progress.
    if (after.status === 'cancelled') {
      const service = after.serviceLabel || 'um serviço';
      const customer = after.customerName || 'Um cliente';
      const when = formatWhen(after.startAtMs);
      try {
        await notifyOwner(shopId, {
          type: 'appointment_cancelled',
          title: 'Agendamento cancelado',
          body: when
            ? `${customer} cancelou ${service} de ${when}.`
            : `${customer} cancelou ${service}.`,
          appointmentId,
          customerName: after.customerName ?? null,
          serviceLabel: after.serviceLabel ?? null,
          startAtMs: after.startAtMs ?? null,
        });
      } catch (err) {
        logger.error(`Falha ao notificar cancelamento ao owner ${appointmentId}`, err);
      }
    }
  },
);
