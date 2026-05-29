import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');

export const mercadoPagoWebhook = onRequest({ secrets: [mpAccessToken] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { type, data } = req.body as {
      type?: string;
      data?: { id?: string };
    };

    if (type !== 'payment' || !data?.id) {
      res.status(200).send('ok');
      return;
    }

    const paymentId = data.id.toString();

    const mpClient = new MercadoPagoConfig({
      accessToken: mpAccessToken.value(),
    });
    const paymentClient = new Payment(mpClient);
    const paymentData = await paymentClient.get({ id: paymentId });

    const status = paymentData.status;
    const shopIdFromMeta = paymentData.metadata?.shop_id as string | undefined;

    const db = admin.firestore();

    let shopId = shopIdFromMeta;
    if (!shopId) {
      const paymentDoc = await db.doc(`payments/${paymentId}`).get();
      if (paymentDoc.exists) {
        shopId = (paymentDoc.data() as { shopId: string }).shopId;
      }
    }

    const paymentDocRef = db.doc(`payments/${paymentId}`);
    const paymentDocSnap = await paymentDocRef.get();
    const previousPaymentStatus = paymentDocSnap.exists
      ? (paymentDocSnap.data()?.status as string | undefined)
      : undefined;

    if (paymentDocSnap.exists) {
      await paymentDocRef.update({
        status: status ?? 'unknown',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (status === 'approved' && shopId && previousPaymentStatus !== 'approved') {
      const now = new Date();

      const shopSnap = await db.doc(`shops/${shopId}`).get();
      const shopData = shopSnap.data();
      const currentActiveUntil = shopData?.activeUntil?.toDate?.() as Date | undefined;
      const renewalBase =
        currentActiveUntil && currentActiveUntil.getTime() > now.getTime()
          ? currentActiveUntil
          : now;
      const activeUntil = new Date(renewalBase);
      activeUntil.setDate(activeUntil.getDate() + 30);

      await db.doc(`shops/${shopId}`).update({
        subscriptionStatus: 'active',
        activeUntil: admin.firestore.Timestamp.fromDate(activeUntil),
        lastPaymentId: paymentId,
        lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`Assinatura ativada: shop=${shopId} ate ${activeUntil.toISOString()}`);
    }

    res.status(200).send('ok');
  } catch (error) {
    logger.error('Erro no webhook MP:', error);
    res.status(200).send('error handled');
  }
});
