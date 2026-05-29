import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Roda todo dia as 03:10 (horario de Brasilia).
 * Verifica shops com assinatura mensal expirada e bloqueia o acesso Pro.
 */
export const checkSubscriptionExpiry = onSchedule(
  {
    schedule: '10 6 * * *', // 03:10 BRT = 06:10 UTC
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection('shops')
      .where('subscriptionStatus', '==', 'active')
      .where('activeUntil', '<=', now)
      .get();

    if (snap.empty) {
      logger.info('Nenhuma assinatura expirada encontrada.');
      return;
    }

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        subscriptionStatus: 'inactive',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    });

    await batch.commit();

    logger.info(`${count} shop(s) com assinatura expirada bloqueados.`);
  },
);
