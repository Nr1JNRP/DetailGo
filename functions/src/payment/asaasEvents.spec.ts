import { decideFromEvent, nextActiveUntil, DIAS_POR_CICLO } from './asaasEvents';

const pagamento = (over: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  // O Asaas manda nulo aqui mesmo quando o checkout foi criado com um valor:
  // o externalReference do checkout nao chega na cobranca.
  externalReference: null,
  checkoutSession: 'chk_1',
  subscription: 'sub_1',
  value: 89,
  status: 'CONFIRMED',
  ...over,
});

describe('decideFromEvent', () => {
  it.each(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])('%s libera o acesso', evento => {
    expect(decideFromEvent({ event: evento, payment: pagamento() })).toEqual({
      kind: 'confirm',
      ref: { shopId: undefined, checkoutSession: 'chk_1' },
      paymentId: 'pay_1',
      subscriptionId: 'sub_1',
      value: 89,
    });
  });

  it('PAYMENT_OVERDUE marca a falha sem liberar', () => {
    const fora = decideFromEvent({ event: 'PAYMENT_OVERDUE', payment: pagamento() });

    expect(fora).toMatchObject({ kind: 'overdue', paymentId: 'pay_1' });
  });

  // Se um dia o Asaas passar a repassar o externalReference, ele vale mais que
  // a consulta: e direto, sem ida ao banco.
  it('prefere o externalReference quando ele vem', () => {
    const fora = decideFromEvent({
      event: 'PAYMENT_CONFIRMED',
      payment: pagamento({ externalReference: 'shop_1' }),
    });

    expect(fora).toMatchObject({ ref: { shopId: 'shop_1' } });
  });

  // Sem nenhuma das duas pistas nao da para saber de quem e o pagamento.
  // Adivinhar liberaria a estetica errada.
  it('ignora pagamento sem vinculo nenhum', () => {
    const fora = decideFromEvent({
      event: 'PAYMENT_CONFIRMED',
      payment: pagamento({ externalReference: null, checkoutSession: undefined }),
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

  // O Asaas manda dezenas de eventos; tratar o que nao se entende como
  // confirmacao liberaria acesso por engano.
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
    expect(nextActiveUntil(undefined, agora).getTime()).toBe(
      new Date('2026-09-26T12:00:00Z').getTime(),
    );
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
    const dias = Math.round(
      (nextActiveUntil(undefined, agora).getTime() - agora.getTime()) / 86_400_000,
    );

    expect(dias).toBe(DIAS_POR_CICLO);
  });
});
