export type AsaasEvent = {
  event?: string;
  payment?: {
    id?: string;
    /** Chega `null` em cobrança nascida de checkout — não é opcional, é nulo. */
    externalReference?: string | null;
    /** Id do checkout que originou a cobrança. */
    checkoutSession?: string | null;
    subscription?: string | null;
    value?: number;
    status?: string;
  };
};

/**
 * Como descobrir de quem é o pagamento.
 *
 * O `externalReference` gravado no checkout **não** é repassado para a
 * cobrança — chega sempre nulo. O que vem é o `checkoutSession`, o id do
 * checkout, que resolvemos contra a associação gravada na criação.
 */
export type ShopRef = { shopId?: string; checkoutSession?: string };

/** O que o webhook deve fazer com um evento. */
export type EventOutcome =
  | { kind: 'ignore'; reason: string }
  | {
      kind: 'confirm';
      ref: ShopRef;
      paymentId: string;
      subscriptionId?: string;
      value?: number;
    }
  | { kind: 'overdue'; ref: ShopRef; paymentId: string };

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

  // Sem nenhuma das duas pistas não dá para saber quem pagou — e adivinhar
  // seria liberar a estética errada.
  const ref: ShopRef = {
    shopId: pagamento.externalReference ?? undefined,
    checkoutSession: pagamento.checkoutSession ?? undefined,
  };
  if (!ref.shopId && !ref.checkoutSession) {
    return { kind: 'ignore', reason: 'pagamento sem vinculo com estetica' };
  }

  if (CONFIRMADOS.includes(nome)) {
    return {
      kind: 'confirm',
      ref,
      paymentId: pagamento.id,
      subscriptionId: pagamento.subscription ?? undefined,
      value: pagamento.value,
    };
  }

  if (VENCIDOS.includes(nome)) {
    return { kind: 'overdue', ref, paymentId: pagamento.id };
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
