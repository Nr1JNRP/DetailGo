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

  it('recusa quando so ha espaco em branco dos dois lados', () => {
    expect(isValidAsaasToken('  ', '\n')).toBe(false);
  });

  // Gravar o segredo por pipe no PowerShell acrescenta uma quebra de linha.
  // O token passa a diferir por um caractere invisivel e tudo vira 401 — sem
  // nenhuma pista no log. Aconteceu de verdade em 27/08/2026.
  describe('espaco em branco invisivel', () => {
    it.each([
      ['quebra de linha no segredo', TOKEN, `${TOKEN}\n`],
      ['CRLF no segredo', TOKEN, `${TOKEN}\r\n`],
      ['espaco no segredo', TOKEN, `${TOKEN} `],
      ['quebra de linha no recebido', `${TOKEN}\n`, TOKEN],
      ['sobra dos dois lados', ` ${TOKEN}\n`, `\n${TOKEN} `],
    ])('aceita apesar de %s', (_nome, recebido, esperado) => {
      expect(isValidAsaasToken(recebido, esperado)).toBe(true);
    });

    // O corte é só nas pontas: espaço no meio muda o token de verdade.
    it('nao ignora diferenca no meio', () => {
      const comEspacoNoMeio = `${TOKEN.slice(0, 5)} ${TOKEN.slice(5)}`;

      expect(isValidAsaasToken(comEspacoNoMeio, TOKEN)).toBe(false);
    });
  });
});
