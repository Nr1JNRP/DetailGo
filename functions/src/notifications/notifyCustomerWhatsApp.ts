import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import twilio from 'twilio';

import { toWhatsAppNumber } from './whatsapp.utils';

// Credenciais do Twilio — guardadas como secrets (nunca no código/app).
// Configure com:  firebase functions:secrets:set TWILIO_ACCOUNT_SID  (etc.)
export const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
export const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
// Número de origem no formato "whatsapp:+14155238886" (sandbox do Twilio).
export const twilioWhatsappFrom = defineSecret('TWILIO_WHATSAPP_FROM');

/** Todos os secrets do WhatsApp — anexe no `secrets` da função que dispara. */
export const whatsappSecrets = [twilioAccountSid, twilioAuthToken, twilioWhatsappFrom];

/**
 * Envia uma mensagem de WhatsApp para o cliente via Twilio. Busca o telefone em
 * users/{uid}. É best-effort: se o Twilio não estiver configurado ou o cliente
 * não tiver telefone válido, apenas registra e retorna (não quebra o fluxo).
 */
export async function notifyCustomerWhatsApp(customerUid: string, message: string): Promise<void> {
  const sid = twilioAccountSid.value();
  const token = twilioAuthToken.value();
  const from = twilioWhatsappFrom.value();

  if (!sid || !token || !from) {
    logger.info('Twilio não configurado; WhatsApp não enviado.');
    return;
  }

  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(customerUid).get();
  const phone = userSnap.get('phone') as string | undefined;
  const to = toWhatsAppNumber(phone);

  if (!to) {
    logger.info(`Cliente ${customerUid} sem telefone válido; WhatsApp não enviado.`);
    return;
  }

  const client = twilio(sid, token);
  const result = await client.messages.create({ from, to, body: message });
  logger.info(`WhatsApp de conclusão enviado ao cliente ${customerUid} (sid ${result.sid}).`);
}
