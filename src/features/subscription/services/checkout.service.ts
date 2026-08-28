import { getAuth } from '@react-native-firebase/auth';

const CREATE_CHECKOUT_URL = 'https://us-central1-magic-auto.cloudfunctions.net/createAsaasCheckout';

/**
 * Pede à Cloud Function um checkout do Asaas e devolve o link para abrir.
 *
 * O link leva a uma página do próprio Asaas, onde o dono escolhe Pix ou cartão
 * e informa os dados. Nenhum dado de pagamento passa por aqui — é o que mantém
 * o app fora do escopo de PCI.
 */
export async function createCheckoutLink(shopId: string): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const idToken = await user.getIdToken();

  const resposta = await fetch(CREATE_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ shopId }),
  });

  if (!resposta.ok) {
    throw new Error('Não foi possível iniciar o pagamento. Tente de novo.');
  }

  const { link } = (await resposta.json()) as { link?: string };
  if (!link) throw new Error('Não foi possível iniciar o pagamento. Tente de novo.');

  return link;
}
