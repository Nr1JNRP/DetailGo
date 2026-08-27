import { createHmac } from 'crypto';

import { isValidMercadoPagoSignature } from './webhookSignature';

const SECRET = 'segredo-do-webhook';
const REQUEST_ID = 'req-123';
const DATA_ID = 'PAY-999';
const TS = '1700000000';

/** Monta um cabeçalho válido, como o Mercado Pago faria. */
function assinar(over: { secret?: string; dataId?: string; ts?: string } = {}) {
  const manifesto = `id:${(over.dataId ?? DATA_ID).toLowerCase()};request-id:${REQUEST_ID};ts:${
    over.ts ?? TS
  };`;
  const v1 = createHmac('sha256', over.secret ?? SECRET)
    .update(manifesto)
    .digest('hex');
  return `ts=${over.ts ?? TS},v1=${v1}`;
}

const valido = {
  signatureHeader: assinar(),
  requestId: REQUEST_ID,
  dataId: DATA_ID,
  secret: SECRET,
};

describe('isValidMercadoPagoSignature', () => {
  it('aceita a assinatura correta', () => {
    expect(isValidMercadoPagoSignature(valido)).toBe(true);
  });

  it('aceita o id em qualquer caixa', () => {
    expect(isValidMercadoPagoSignature({ ...valido, dataId: 'pay-999' })).toBe(true);
  });

  it('recusa assinatura feita com outro segredo', () => {
    expect(
      isValidMercadoPagoSignature({ ...valido, signatureHeader: assinar({ secret: 'outro' }) }),
    ).toBe(false);
  });

  // O ataque que a checagem impede: disparar a function com IDs arbitrários.
  it('recusa quando o id do corpo nao e o id assinado', () => {
    expect(isValidMercadoPagoSignature({ ...valido, dataId: 'PAY-000' })).toBe(false);
  });

  // Adulterar o ts mantendo o v1 original: é o replay que a assinatura barra.
  it('recusa quando o timestamp foi adulterado', () => {
    const adulterado = valido.signatureHeader.replace(`ts=${TS}`, 'ts=1');

    expect(isValidMercadoPagoSignature({ ...valido, signatureHeader: adulterado })).toBe(false);
  });

  it.each([
    ['sem cabecalho', { signatureHeader: undefined }],
    ['sem request-id', { requestId: undefined }],
    ['sem id', { dataId: undefined }],
    ['sem segredo configurado', { secret: '' }],
  ])('recusa %s', (_nome, faltando) => {
    expect(isValidMercadoPagoSignature({ ...valido, ...faltando })).toBe(false);
  });

  it.each([
    ['cabecalho sem v1', 'ts=1700000000'],
    ['cabecalho sem ts', 'v1=abc'],
    ['cabecalho vazio', ''],
    ['lixo', 'nada-a-ver'],
  ])('recusa %s', (_nome, header) => {
    expect(isValidMercadoPagoSignature({ ...valido, signatureHeader: header })).toBe(false);
  });
});
