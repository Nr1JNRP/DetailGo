const mockGetIdToken = jest.fn();
const mockCurrentUser = { uid: 'owner-1', getIdToken: mockGetIdToken };

let mockAuthUser: typeof mockCurrentUser | null = mockCurrentUser;

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: mockAuthUser })),
}));

import { cancelSubscription, fetchSubscription } from './subscription.service';

const BASE = 'https://us-central1-magic-auto.cloudfunctions.net';

const assinaturaAtiva = {
  ativa: true,
  formaPagamento: 'card' as const,
  valor: 89,
  proximaCobranca: '2026-10-12',
};

function mockarFetch(resposta: { ok: boolean; corpo?: unknown }) {
  const fn = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: jest.fn().mockResolvedValue(resposta.corpo ?? {}),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('subscription.service', () => {
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockCurrentUser;
    mockGetIdToken.mockResolvedValue('id-token');
  });

  afterAll(() => {
    globalThis.fetch = fetchOriginal;
  });

  describe('fetchSubscription', () => {
    it('devolve a assinatura do dono', async () => {
      const fetchMock = mockarFetch({ ok: true, corpo: { assinatura: assinaturaAtiva } });

      await expect(fetchSubscription('shop-1')).resolves.toEqual(assinaturaAtiva);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/getAsaasSubscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer id-token',
        },
        body: JSON.stringify({ shopId: 'shop-1' }),
      });
    });

    // Quem pagou por Pix não tem assinatura no Asaas. Isso não é erro, e a tela
    // depende de receber null para oferecer a troca para cartão.
    it('devolve null quando não existe assinatura', async () => {
      mockarFetch({ ok: true, corpo: { assinatura: null } });

      await expect(fetchSubscription('shop-1')).resolves.toBeNull();
    });

    it('propaga a mensagem de erro que a function devolveu', async () => {
      mockarFetch({ ok: false, corpo: { error: 'Loja não encontrada.' } });

      await expect(fetchSubscription('shop-1')).rejects.toThrow('Loja não encontrada.');
    });

    it('usa mensagem genérica quando a resposta de erro não tem corpo legível', async () => {
      const fn = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('não é json')),
      });
      globalThis.fetch = fn as unknown as typeof fetch;

      await expect(fetchSubscription('shop-1')).rejects.toThrow(
        'Não foi possível completar a operação.',
      );
    });

    it('recusa a chamada sem usuário logado, sem chegar na rede', async () => {
      mockAuthUser = null;
      const fetchMock = mockarFetch({ ok: true });

      await expect(fetchSubscription('shop-1')).rejects.toThrow(
        'Sessão expirada. Entre novamente.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('cancelSubscription', () => {
    it('chama a function de cancelamento com o shopId', async () => {
      const fetchMock = mockarFetch({ ok: true, corpo: { cancelada: true } });

      await expect(cancelSubscription('shop-9')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/cancelAsaasSubscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer id-token',
        },
        body: JSON.stringify({ shopId: 'shop-9' }),
      });
    });

    it('propaga o erro do cancelamento', async () => {
      mockarFetch({ ok: false, corpo: { error: 'Assinatura já cancelada.' } });

      await expect(cancelSubscription('shop-9')).rejects.toThrow('Assinatura já cancelada.');
    });
  });
});
