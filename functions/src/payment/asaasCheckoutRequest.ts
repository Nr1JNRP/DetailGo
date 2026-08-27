import type { AsaasConfig } from './asaasConfig';

export type CheckoutRequest = {
  billingTypes: string[];
  chargeTypes: string[];
  minutesToExpire: number;
  externalReference: string;
  callback: { successUrl: string; cancelUrl: string; expiredUrl: string };
  items: Array<{ name: string; description: string; quantity: number; value: number }>;
  subscription: { cycle: string; nextDueDate: string };
};

/** Data no formato que o Asaas espera (AAAA-MM-DD). */
export function toAsaasDate(when: Date): string {
  return when.toISOString().slice(0, 10);
}

/**
 * Monta o corpo do POST /v3/checkouts.
 *
 * Separado da chamada HTTP para poder ser testado sem rede — é aqui que mora a
 * decisão de cobrar mensalmente e de qual valor usar.
 */
export function buildCheckoutRequest(params: {
  shopId: string;
  shopName: string;
  config: AsaasConfig;
  returnUrl: string;
  now?: Date;
}): CheckoutRequest {
  const { shopId, shopName, config, returnUrl, now = new Date() } = params;

  return {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    // Liga o checkout ao shop: é por aqui que o webhook sabe quem pagou.
    externalReference: shopId,
    callback: {
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      expiredUrl: returnUrl,
    },
    items: [
      {
        name: 'DetailGo Pro',
        description: `Assinatura mensal — ${shopName}`,
        quantity: 1,
        value: config.planValue,
      },
    ],
    // Primeira cobrança hoje: o dono está assinando agora e espera liberar já.
    subscription: { cycle: 'MONTHLY', nextDueDate: toAsaasDate(now) },
  };
}
