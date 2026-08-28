import type { AsaasConfig } from './asaasConfig';

/**
 * Como o dono vai pagar.
 *
 * O Asaas não permite Pix recorrente: `CREDIT_CARD` é o único método aceito em
 * `RECURRENT`, e `PIX` exige `DETACHED`. Faz sentido — Pix não tem mandato de
 * débito automático, então ninguém cobra sozinho. Cartão renova; Pix é avulso e
 * o dono paga de novo a cada ciclo.
 */
export type MetodoPagamento = 'card' | 'pix';

export type CheckoutRequest = {
  billingTypes: string[];
  chargeTypes: string[];
  minutesToExpire: number;
  externalReference: string;
  callback: { successUrl: string; cancelUrl: string; expiredUrl: string };
  items: Array<{ name: string; description: string; quantity: number; value: number }>;
  subscription?: { cycle: string; nextDueDate: string };
};

/** Data no formato que o Asaas espera (AAAA-MM-DD). */
export function toAsaasDate(when: Date): string {
  return when.toISOString().slice(0, 10);
}

/**
 * Monta o corpo do POST /v3/checkouts.
 *
 * Separado da chamada HTTP para poder ser testado sem rede — é aqui que mora a
 * diferença entre o cartão recorrente e o Pix avulso.
 */
export function buildCheckoutRequest(params: {
  shopId: string;
  shopName: string;
  metodo: MetodoPagamento;
  config: AsaasConfig;
  returnUrl: string;
  now?: Date;
}): CheckoutRequest {
  const { shopId, shopName, metodo, config, returnUrl, now = new Date() } = params;

  const base = {
    minutesToExpire: 60,
    // Liga o checkout ao shop: é por aqui que o webhook sabe quem pagou.
    externalReference: shopId,
    callback: { successUrl: returnUrl, cancelUrl: returnUrl, expiredUrl: returnUrl },
    items: [
      {
        name: 'DetailGo Pro',
        description: `Assinatura mensal — ${shopName}`,
        quantity: 1,
        value: config.planValue,
      },
    ],
  };

  if (metodo === 'card') {
    return {
      ...base,
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      // Primeira cobrança hoje: o dono está assinando agora e espera liberar já.
      subscription: { cycle: 'MONTHLY', nextDueDate: toAsaasDate(now) },
    };
  }

  return { ...base, billingTypes: ['PIX'], chargeTypes: ['DETACHED'] };
}
