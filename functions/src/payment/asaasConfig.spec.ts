import { resolveAsaasConfig } from './asaasConfig';
import { buildCheckoutRequest, toAsaasDate } from './asaasCheckoutRequest';

describe('resolveAsaasConfig', () => {
  it('producao cobra o valor cheio e aponta para a API real', () => {
    const config = resolveAsaasConfig('production');

    expect(config.planValue).toBe(89.0);
    expect(config.baseUrl).toBe('https://api.asaas.com/v3');
  });

  it('sandbox cobra um centavo e aponta para a API de teste', () => {
    const config = resolveAsaasConfig('sandbox');

    expect(config.planValue).toBe(0.01);
    expect(config.baseUrl).toContain('sandbox');
  });

  // O estado perigoso e produção cobrando um centavo. Erro de digitação, valor
  // ausente ou lixo tem que cair em sandbox — nunca cobrar de verdade por engano.
  it.each([undefined, '', 'producao', 'PRODUCTION', 'prod', 'qualquer coisa'])(
    'trata %s como sandbox',
    valor => {
      expect(resolveAsaasConfig(valor).planValue).toBe(0.01);
    },
  );

  it('a URL e o valor andam sempre juntos', () => {
    for (const env of ['production', 'sandbox', 'lixo']) {
      const { baseUrl, planValue } = resolveAsaasConfig(env);
      const ehProducao = !baseUrl.includes('sandbox');

      expect(planValue).toBe(ehProducao ? 89.0 : 0.01);
    }
  });
});

describe('buildCheckoutRequest', () => {
  const base = {
    shopId: 'shop_1',
    shopName: 'Estetica A',
    config: resolveAsaasConfig('production'),
    returnUrl: 'https://detailgo.app/assinatura',
    now: new Date('2026-08-27T12:00:00Z'),
  };

  it('pede Pix e cartao, em cobranca recorrente mensal', () => {
    const req = buildCheckoutRequest(base);

    expect(req.billingTypes).toEqual(['PIX', 'CREDIT_CARD']);
    expect(req.chargeTypes).toEqual(['RECURRENT']);
    expect(req.subscription.cycle).toBe('MONTHLY');
  });

  // E por este campo que o webhook descobre quem pagou.
  it('carrega o shopId no externalReference', () => {
    expect(buildCheckoutRequest(base).externalReference).toBe('shop_1');
  });

  it('usa o valor do ambiente, nao um numero fixo', () => {
    const sandbox = buildCheckoutRequest({ ...base, config: resolveAsaasConfig('sandbox') });

    expect(buildCheckoutRequest(base).items[0].value).toBe(89.0);
    expect(sandbox.items[0].value).toBe(0.01);
  });

  it('primeira cobranca e hoje', () => {
    expect(buildCheckoutRequest(base).subscription.nextDueDate).toBe('2026-08-27');
  });

  it('o nome do item cabe no limite de 30 caracteres do Asaas', () => {
    expect(buildCheckoutRequest(base).items[0].name.length).toBeLessThanOrEqual(30);
  });
});

describe('toAsaasDate', () => {
  it('formata como AAAA-MM-DD', () => {
    expect(toAsaasDate(new Date('2026-01-05T23:30:00Z'))).toBe('2026-01-05');
  });
});
