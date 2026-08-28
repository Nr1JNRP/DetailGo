import { timingSafeEqual } from 'crypto';

/**
 * Confere o token que o Asaas envia no cabeçalho `asaas-access-token`.
 *
 * O Asaas não assina o corpo — a autenticação do webhook é esse token estático,
 * definido (ou gerado) quando o webhook é criado. Sem a checagem, qualquer um
 * que descubra a URL da function consegue forjar confirmação de pagamento.
 */
export function isValidAsaasToken(recebido: string | undefined, esperado: string): boolean {
  // Espaço em branco nas pontas não faz parte do token, e entra fácil sem
  // ninguém ver: gravar o segredo por pipe no PowerShell acrescenta uma quebra
  // de linha, e o valor passa a diferir por um caractere invisível. Já custou
  // uma depuração longa aqui.
  const a = Buffer.from((recebido ?? '').trim(), 'utf8');
  const b = Buffer.from((esperado ?? '').trim(), 'utf8');

  if (a.length === 0 || b.length === 0) return false;

  // Comparar com === vaza o tamanho do prefixo correto pelo tempo de resposta,
  // o que permite descobrir o token caractere a caractere.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
