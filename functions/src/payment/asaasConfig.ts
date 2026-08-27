export type AsaasEnv = 'sandbox' | 'production';

export type AsaasConfig = {
  baseUrl: string;
  /** Valor da mensalidade, em reais. */
  planValue: number;
};

/**
 * A URL da API e o valor cobrado andam juntos de propósito.
 *
 * Se fossem duas configurações separadas, existiria o estado inválido de
 * produção cobrando R$ 0,01 — que ninguém percebe até o fim do mês. Do jeito
 * que está, para errar o valor seria preciso errar a URL junto, e aí a
 * primeira chamada falha na hora.
 */
const CONFIGS: Record<AsaasEnv, AsaasConfig> = {
  sandbox: { baseUrl: 'https://api-sandbox.asaas.com/v3', planValue: 0.01 },
  production: { baseUrl: 'https://api.asaas.com/v3', planValue: 89.0 },
};

/**
 * Resolve o ambiente a partir do valor configurado. Qualquer coisa que não seja
 * exatamente 'production' cai em sandbox: um erro de digitação não pode
 * silenciosamente cobrar de verdade.
 */
export function resolveAsaasConfig(env: string | undefined): AsaasConfig {
  return env === 'production' ? CONFIGS.production : CONFIGS.sandbox;
}
