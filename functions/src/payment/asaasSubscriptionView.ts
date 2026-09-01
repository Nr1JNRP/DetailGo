/** O que o Asaas devolve em GET /v3/subscriptions/{id}. */
export type AsaasSubscription = {
  id?: string;
  billingType?: string;
  status?: string;
  value?: number;
  cycle?: string;
  nextDueDate?: string | null;
  deleted?: boolean;
};

/** O que a tela precisa saber. Nada além disso atravessa a fronteira. */
export type SubscriptionView = {
  ativa: boolean;
  formaPagamento: 'card' | 'pix' | 'outro';
  valor: number | null;
  proximaCobranca: string | null;
};

/**
 * Traduz a assinatura do Asaas no que a tela mostra.
 *
 * Pura de propósito: é aqui que moram as decisões sobre resposta incompleta, e
 * dá para testar todas sem rede. Assinatura removida ou inativa conta como não
 * ativa — a tela trata os dois casos igual, oferecendo assinar de novo.
 */
export function toSubscriptionView(assinatura: AsaasSubscription | null): SubscriptionView {
  if (!assinatura || assinatura.deleted) {
    return { ativa: false, formaPagamento: 'outro', valor: null, proximaCobranca: null };
  }

  const forma =
    assinatura.billingType === 'CREDIT_CARD'
      ? 'card'
      : assinatura.billingType === 'PIX'
      ? 'pix'
      : 'outro';

  return {
    ativa: assinatura.status === 'ACTIVE',
    formaPagamento: forma,
    valor: assinatura.value ?? null,
    proximaCobranca: assinatura.nextDueDate ?? null,
  };
}
