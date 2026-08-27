import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Valida a assinatura HMAC que o Mercado Pago envia no cabeçalho `x-signature`.
 *
 * O cabeçalho vem como `ts=<timestamp>,v1=<hash>`. O hash é o HMAC-SHA256 do
 * texto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` usando a chave secreta
 * do webhook. Sem essa checagem qualquer um dispara a function com IDs
 * arbitrários e nos faz consultar a API do MP a cada requisição.
 */
export function isValidMercadoPagoSignature(params: {
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
  secret: string;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params;
  if (!signatureHeader || !requestId || !dataId || !secret) return false;

  const partes = new Map<string, string>();
  for (const parte of signatureHeader.split(',')) {
    const [chave, valor] = parte.split('=');
    if (chave && valor) partes.set(chave.trim(), valor.trim());
  }

  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return false;

  // O MP normaliza o id em minúsculas ao montar o manifesto.
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac('sha256', secret).update(manifesto).digest('hex');

  // Comparação em tempo constante: comparar com === vaza o tamanho do prefixo
  // correto e permite descobrir o hash byte a byte.
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
