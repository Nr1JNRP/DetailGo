import { decideFromEvent, nextActiveUntil, DIAS_POR_CICLO } from './asaasEvents';

const pagamento = (over: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  externalReference: 'shop_1',
  subscription: 'sub_1',
  value: 89,
  status: 'CONFIRMED',
  ...over,
});

describe('decideFromEvent', () => {
  it.each(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])('%s libera o acesso', evento => {
    expect(decideFromEvent({ event: evento, payment: pagamento() })).toEqual({
      kind: 'confirm',
      shopId: 'shop_1',
      paymentId: 'pay_1',
      subscriptionId: 'sub_1',
      value: 89,
    });
  });

  it('PAYMENT_OVERDUE marca a falha sem liberar', () => {
    expect(decideFromEvent({ event: 'PAYMENT_OVERDUE', payment: pagamento() })).toEqual({
      kind: 'overdue',
      shopId: 'shop_1',
      paymentId: 'pay_1',
    });
  });

  // Sem o externalReference não dá para saber de quem é o pagamento. Adivinhar
  // liberaria o shop errado.
  it('ignora pagamento sem externalReference', () => {
    const fora = decideFromEvent({
      event: 'PAYMENT_CONFIRMED',
      payment: pagamento({ externalReference: undefined }),
    });

    expect(fora.kind).toBe('ignore');
  });

  it.each([
    ['evento vazio', {}],
    ['sem nome do evento', { payment: pagamento() }],
    ['sem pagamento', { event: 'PAYMENT_CONFIRMED' }],
    ['pagamento sem id', { event: 'PAYMENT_CONFIRMED', payment: pagamento({ id: undefined }) }],
  ])('ignora %s', (_nome, evento) => {
    expect(decideFromEvent(evento).kind).toBe('ignore');
  });

  // O Asaas manda dezenas de eventos; tratar o que não se entende como
  // confirmação liberaria acesso por engano.
  it.each(['PAYMENT_CREATED', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'SUBSCRIPTION_CREATED'])(
    'ignora %s',
    evento => {
      expect(decideFromEvent({ event: evento, payment: pagamento() }).kind).toBe('ignore');
    },
  );
});

describe('nextActiveUntil', () => {
  const agora = new Date('2026-08-27T12:00:00Z');

  it('sem acesso anterior conta a partir de agora', () => {
    const ate = nextActiveUntil(undefined, agora);

    expect(ate.getTime()).toBe(new Date('2026-09-26T12:00:00Z').getTime());
  });

  it('acesso ja vencido tambem conta a partir de agora', () => {
    const vencido = new Date('2026-08-01T12:00:00Z');

    expect(nextActiveUntil(vencido, agora).getTime()).toBe(
      new Date('2026-09-26T12:00:00Z').getTime(),
    );
  });

  // Quem paga adiantado nao pode perder os dias que ainda tinha.
  it('renovacao antecipada soma ao que resta', () => {
    const aindaVale = new Date('2026-09-10T12:00:00Z');

    expect(nextActiveUntil(aindaVale, agora).getTime()).toBe(
      new Date('2026-10-10T12:00:00Z').getTime(),
    );
  });

  it('adiciona exatamente um ciclo', () => {
    const ate = nextActiveUntil(undefined, agora);
    const dias = Math.round((ate.getTime() - agora.getTime()) / 86_400_000);

    expect(dias).toBe(DIAS_POR_CICLO);
  });
});
