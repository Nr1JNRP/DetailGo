import { getAuth } from '@react-native-firebase/auth';

const BASE = 'https://us-central1-magic-auto.cloudfunctions.net';

export type SubscriptionView = {
  ativa: boolean;
  formaPagamento: 'card' | 'pix' | 'outro';
  valor: number | null;
  proximaCobranca: string | null;
};

async function chamar<T>(funcao: string, shopId: string): Promise<T> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const idToken = await user.getIdToken();

  const resposta = await fetch(`${BASE}/${funcao}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ shopId }),
  });

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? 'Não foi possível completar a operação.');
  }

  return (await resposta.json()) as T;
}

/**
 * Situação da assinatura no Asaas.
 *
 * `null` não é erro: é o caso de quem pagou por Pix, que é cobrança avulsa e
 * não gera assinatura.
 */
export async function fetchSubscription(shopId: string): Promise<SubscriptionView | null> {
  const { assinatura } = await chamar<{ assinatura: SubscriptionView | null }>(
    'getAsaasSubscription',
    shopId,
  );
  return assinatura;
}

/**
 * Cancela a recorrência. O acesso continua até o fim do período já pago — o
 * `activeUntil` não é tocado.
 */
export async function cancelSubscription(shopId: string): Promise<void> {
  await chamar<{ cancelada: boolean }>('cancelAsaasSubscription', shopId);
}
