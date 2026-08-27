import { isValidAsaasToken } from './asaasWebhookToken';

const TOKEN = 'token-do-webhook-1234567890';

describe('isValidAsaasToken', () => {
  it('aceita o token correto', () => {
    expect(isValidAsaasToken(TOKEN, TOKEN)).toBe(true);
  });

  it('recusa token diferente', () => {
    expect(isValidAsaasToken('outro-token-qualquer-123456', TOKEN)).toBe(false);
  });

  // O ataque que a checagem impede: forjar confirmacao de pagamento em quem
  // descobrir a URL da function.
  it('recusa quando nao vem token nenhum', () => {
    expect(isValidAsaasToken(undefined, TOKEN)).toBe(false);
  });

  it.each([
    ['prefixo correto mas incompleto', TOKEN.slice(0, -1)],
    ['um caractere a mais', `${TOKEN}x`],
    ['vazio', ''],
    ['so espaco', ' '],
  ])('recusa %s', (_nome, recebido) => {
    expect(isValidAsaasToken(recebido, TOKEN)).toBe(false);
  });

  // Se o segredo nao foi configurado, nada pode passar — senao a function
  // ficaria aberta justamente por falta de configuracao.
  it('recusa tudo quando o segredo esta vazio', () => {
    expect(isValidAsaasToken(TOKEN, '')).toBe(false);
    expect(isValidAsaasToken('', '')).toBe(false);
  });
});
