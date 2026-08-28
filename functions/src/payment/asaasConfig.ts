export type AsaasConfig = {
  baseUrl: string;
  /** Valor da mensalidade, em reais. */
  planValue: number;
};

const PRODUCAO: AsaasConfig = { baseUrl: 'https://api.asaas.com/v3', planValue: 89.0 };
// R$ 5,00 é o mínimo que o Asaas aceita numa cobrança: valor abaixo disso é
// recusado com 400. Por isso o teste não pode custar um centavo.
const SANDBOX: AsaasConfig = { baseUrl: 'https://api-sandbox.asaas.com/v3', planValue: 5.0 };

/** Prefixo das chaves de produção do Asaas. As de sandbox usam `$aact_hmlg_`. */
const PREFIXO_PRODUCAO = '$aact_prod_';

/**
 * Descobre o ambiente pela própria chave de API.
 *
 * A alternativa seria uma configuração separada (ASAAS_ENV), mas aí existiriam
 * dois valores que precisam concordar — e o dia em que discordarem é o dia em
 * que produção cobra R$ 0,01 de todo mundo, ou sandbox tenta cobrar de verdade.
 * A chave já carrega essa informação, então ela é a única fonte.
 *
 * Chave irreconhecível cai em sandbox: se for uma chave de produção nova, a
 * primeira chamada falha com 401 e o erro aparece na hora — melhor do que
 * cobrar errado em silêncio.
 */
export function resolveAsaasConfig(apiKey: string | undefined): AsaasConfig {
  return apiKey?.startsWith(PREFIXO_PRODUCAO) ? PRODUCAO : SANDBOX;
}
