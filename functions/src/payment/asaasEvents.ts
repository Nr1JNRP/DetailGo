export type AsaasEvent = {
  event?: string;
  payment?: {
    id?: string;
    externalReference?: string;
    subscription?: string;
    value?: number;
    status?: string;
  };
};

/** O que o webhook deve fazer com um evento. */
export type EventOutcome =
  | { kind: 'ignore'; reason: string }
  | {
      kind: 'confirm';
      shopId: string;
      paymentId: string;
      subscriptionId?: string;
      value?: number;
    }
  | { kind: 'overdue'; shopId: string; paymentId: string };

const CONFIRMADOS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
const VENCIDOS = ['PAYMENT_OVERDUE'];

/**
 * Traduz o evento do Asaas na decisão a executar — sem tocar no Firestore.
 *
 * A separação existe para o teste poder cobrir o que importa (qual evento
 * libera acesso, qual não) sem emulador e sem rede.
 */
export function decideFromEvent(evento: AsaasEvent): EventOutcome {
  const nome = evento.event;
  const pagamento = evento.payment;

  if (!nome || !pagamento?.id) {
    return { kind: 'ignore', reason: 'evento sem nome ou sem pagamento' };
  }

  // O externalReference é o shopId, gravado na criação do checkout. Sem ele não
  // dá para saber quem pagou — e adivinhar seria liberar o shop errado.
  const shopId = pagamento.externalReference;
  if (!shopId) {
    return { kind: 'ignore', reason: 'pagamento sem externalReference' };
  }

  if (CONFIRMADOS.includes(nome)) {
    return {
      kind: 'confirm',
      shopId,
      paymentId: pagamento.id,
      subscriptionId: pagamento.subscription,
      value: pagamento.value,
    };
  }

  if (VENCIDOS.includes(nome)) {
    return { kind: 'overdue', shopId, paymentId: pagamento.id };
  }

  return { kind: 'ignore', reason: `evento nao tratado: ${nome}` };
}

/** Quantos dias cada pagamento confirmado adiciona ao acesso. */
export const DIAS_POR_CICLO = 30;

/**
 * Calcula até quando o acesso vale depois de um pagamento.
 *
 * Renovar antes do vencimento soma ao que resta, em vez de encurtar: quem paga
 * adiantado não pode perder dias.
 */
export function nextActiveUntil(atual: Date | undefined, now: Date): Date {
  const base = atual && atual.getTime() > now.getTime() ? atual : now;
  const proximo = new Date(base);
  proximo.setDate(proximo.getDate() + DIAS_POR_CICLO);
  return proximo;
}
