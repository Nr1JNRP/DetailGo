import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');

const PLAN_AMOUNT = 89.0; // Preço de lançamento (R$ 89,00/mês)
const PLAN_DESCRIPTION = 'DetailGo Pro - Plano Mensal';

export const createPixCharge = onRequest(
  { secrets: [mpAccessToken], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      // Verifica autenticação via Bearer token
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      if (!idToken) {
        res.status(401).json({ error: 'Token não fornecido.' });
        return;
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const { shopId } = req.body as { shopId?: string };
      if (!shopId) {
        res.status(400).json({ error: 'shopId é obrigatório.' });
        return;
      }

      const db = admin.firestore();

      const shopSnap = await db.doc(`shops/${shopId}`).get();
      if (!shopSnap.exists) {
        res.status(404).json({ error: 'Loja não encontrada.' });
        return;
      }

      const shop = shopSnap.data() as { name: string; ownerId: string };

      if (shop.ownerId !== uid) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }

      const userSnap = await db.doc(`users/${uid}`).get();
      const user = (userSnap.data() ?? {}) as {
        email?: string;
        firstName?: string;
        lastName?: string;
      };

      const mpClient = new MercadoPagoConfig({
        accessToken: mpAccessToken.value(),
      });
      const payment = new Payment(mpClient);

      const paymentData = await payment.create({
        body: {
          transaction_amount: PLAN_AMOUNT,
          description: `${PLAN_DESCRIPTION} - ${shop.name}`,
          payment_method_id: 'pix',
          payer: {
            email: user.email ?? `owner_${uid}@detailgo.app`,
            first_name: user.firstName ?? 'Proprietario',
            last_name: user.lastName ?? 'DetailGo',
          },
          date_of_expiration: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          metadata: {
            shop_id: shopId,
            shop_name: shop.name,
          },
        },
      });

      const paymentId = paymentData.id!.toString();
      const qrCode =
        paymentData.point_of_interaction?.transaction_data?.qr_code ?? '';
      const qrCodeBase64 =
        paymentData.point_of_interaction?.transaction_data?.qr_code_base64 ?? '';

      await db.doc(`payments/${paymentId}`).set({
        paymentId,
        shopId,
        shopName: shop.name,
        amount: PLAN_AMOUNT,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`PIX criado: ${paymentId} para shop: ${shopId}`);

      res.status(200).json({
        payment_id: paymentId,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expires_at: paymentData.date_of_expiration ?? '',
        amount: PLAN_AMOUNT,
      });
    } catch (error: any) {
      logger.error('Erro ao criar PIX:', error);
      res.status(500).json({
        error: error?.message ?? 'Erro interno ao gerar PIX.',
      });
    }
  },
);
