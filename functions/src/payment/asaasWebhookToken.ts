import { timingSafeEqual } from 'crypto';

/**
 * Confere o token que o Asaas envia no cabeçalho `asaas-access-token`.
 *
 * O Asaas não assina o corpo — a autenticação do webhook é esse token estático,
 * definido (ou gerado) quando o webhook é criado. Sem a checagem, qualquer um
 * que descubra a URL da function consegue forjar confirmação de pagamento.
 */
export function isValidAsaasToken(recebido: string | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;

  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');

  // Comparar com === vaza o tamanho do prefixo correto pelo tempo de resposta,
  // o que permite descobrir o token caractere a caractere.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
