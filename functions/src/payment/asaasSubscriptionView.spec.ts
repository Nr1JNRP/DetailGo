import { toSubscriptionView } from './asaasSubscriptionView';

const assinatura = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  billingType: 'CREDIT_CARD',
  status: 'ACTIVE',
  value: 89,
  cycle: 'MONTHLY',
  nextDueDate: '2026-10-12',
  deleted: false,
  ...over,
});

describe('toSubscriptionView', () => {
  it('traduz uma assinatura ativa no cartao', () => {
    expect(toSubscriptionView(assinatura())).toEqual({
      ativa: true,
      formaPagamento: 'card',
      valor: 89,
      proximaCobranca: '2026-10-12',
    });
  });

  // Assinatura removida ou inativa da no mesmo para a tela: ela oferece
  // assinar de novo em vez de mostrar um cancelamento que nao existe mais.
  it.each([
    ['removida', assinatura({ deleted: true })],
    ['inativa', assinatura({ status: 'INACTIVE' })],
    ['expirada', assinatura({ status: 'EXPIRED' })],
    ['ausente', null],
  ])('%s nao conta como ativa', (_nome, entrada) => {
    expect(toSubscriptionView(entrada).ativa).toBe(false);
  });

  it('reconhece assinatura em Pix', () => {
    expect(toSubscriptionView(assinatura({ billingType: 'PIX' })).formaPagamento).toBe('pix');
  });

  it('forma de pagamento desconhecida nao vira cartao', () => {
    expect(toSubscriptionView(assinatura({ billingType: 'BOLETO' })).formaPagamento).toBe('outro');
  });

  // Resposta incompleta nao pode virar "R$ undefined" na tela do dono.
  it('campos ausentes viram null, nao lixo', () => {
    const vista = toSubscriptionView(assinatura({ value: undefined, nextDueDate: null }));

    expect(vista.valor).toBeNull();
    expect(vista.proximaCobranca).toBeNull();
  });

  it('assinatura removida nao vaza valor nem data', () => {
    const vista = toSubscriptionView(assinatura({ deleted: true }));

    expect(vista).toEqual({
      ativa: false,
      formaPagamento: 'outro',
      valor: null,
      proximaCobranca: null,
    });
  });
});
