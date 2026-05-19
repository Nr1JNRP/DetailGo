import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Roda todo dia às 03:00 (horário de Brasília).
 * Verifica shops com trial expirado e sem assinatura ativa,
 * e os torna invisíveis no mapa.
 */
export const checkTrialExpiry = onSchedule(
  {
    schedule: '0 6 * * *', // 03:00 BRT = 06:00 UTC
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Busca shops visíveis no mapa com trial expirado
    const snap = await db
      .collection('shops')
      .where('isVisibleOnMap', '==', true)
      .where('subscriptionStatus', '==', 'trial')
      .where('trialEndsAt', '<=', now)
      .get();

    if (snap.empty) {
      logger.info('Nenhum trial expirado encontrado.');
      return;
    }

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        isVisibleOnMap: false,
        subscriptionStatus: 'inactive',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    });

    await batch.commit();

    logger.info(`✅ ${count} shop(s) com trial expirado ocultados do mapa.`);
  },
);
