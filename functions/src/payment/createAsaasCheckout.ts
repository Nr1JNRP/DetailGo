import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { resolveAsaasConfig } from './asaasConfig';
import { buildCheckoutRequest } from './asaasCheckoutRequest';

const asaasApiKey = defineSecret('ASAAS_API_KEY');
const asaasEnv = defineString('ASAAS_ENV', { default: 'sandbox' });

/** Para onde o navegador volta depois do checkout. Não é prova de pagamento. */
const RETURN_URL = 'https://detailgo.app/assinatura';

export const createAsaasCheckout = onRequest(
  { secrets: [asaasApiKey], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const authHeader = req.headers.authorization ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!idToken) {
        res.status(401).json({ error: 'Token não fornecido.' });
        return;
      }

      const { uid } = await admin.auth().verifyIdToken(idToken);

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
      // Só o dono assina a própria loja — senão qualquer autenticado abriria
      // cobrança no nome de outro estabelecimento.
      if (shop.ownerId !== uid) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }

      const config = resolveAsaasConfig(asaasEnv.value());
      const body = buildCheckoutRequest({
        shopId,
        shopName: shop.name,
        config,
        returnUrl: RETURN_URL,
      });

      const resposta = await fetch(`${config.baseUrl}/checkouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: asaasApiKey.value(),
        },
        body: JSON.stringify(body),
      });

      if (!resposta.ok) {
        // O corpo do erro do Asaas descreve o campo recusado, mas pode repetir
        // dados do pagador — fica no log do servidor, não na resposta ao app.
        logger.error(`Asaas recusou o checkout (${resposta.status})`, await resposta.text());
        res.status(502).json({ error: 'Não foi possível iniciar o pagamento.' });
        return;
      }

      const checkout = (await resposta.json()) as { id?: string; link?: string };
      if (!checkout.link) {
        logger.error('Asaas respondeu sem link de checkout', checkout);
        res.status(502).json({ error: 'Não foi possível iniciar o pagamento.' });
        return;
      }

      logger.info(`Checkout criado: shop=${shopId} checkout=${checkout.id}`);
      res.status(200).json({ checkout_id: checkout.id, link: checkout.link });
    } catch (error) {
      logger.error('Erro ao criar checkout Asaas:', error);
      res.status(500).json({ error: 'Não foi possível iniciar o pagamento.' });
    }
  },
);
