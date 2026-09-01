const mockGetIdToken = jest.fn();
const mockCurrentUser = {
  uid: 'user-123',
  getIdToken: mockGetIdToken,
};

let mockAuthUser: typeof mockCurrentUser | null = mockCurrentUser;

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockAuthUser,
  })),
}));

import { createCheckoutLink } from './checkout.service';

describe('checkout.service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockCurrentUser;
    mockGetIdToken.mockResolvedValue('mock-id-token');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('deve lançar erro se o usuário não estiver autenticado', async () => {
    mockAuthUser = null;

    await expect(createCheckoutLink('shop-123', 'pix')).rejects.toThrow(
      'Sessão expirada. Entre novamente.',
    );
  });

  it('deve gerar um link de checkout com sucesso para o método pix', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ link: 'https://asaas.com/checkout/123' }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const link = await createCheckoutLink('shop-123', 'pix');

    expect(link).toBe('https://asaas.com/checkout/123');
    expect(mockGetIdToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://us-central1-magic-auto.cloudfunctions.net/createAsaasCheckout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-id-token',
        },
        body: JSON.stringify({ shopId: 'shop-123', metodo: 'pix' }),
      },
    );
  });

  it('deve gerar um link de checkout com sucesso para o método card', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ link: 'https://asaas.com/checkout/456' }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const link = await createCheckoutLink('shop-456', 'card');

    expect(link).toBe('https://asaas.com/checkout/456');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://us-central1-magic-auto.cloudfunctions.net/createAsaasCheckout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-id-token',
        },
        body: JSON.stringify({ shopId: 'shop-456', metodo: 'card' }),
      },
    );
  });

  it('deve lançar erro quando a resposta da requisição não for ok (resposta.ok = false)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(createCheckoutLink('shop-123', 'pix')).rejects.toThrow(
      'Não foi possível iniciar o pagamento. Tente de novo.',
    );
  });

  it('deve lançar erro quando o JSON retornado não possuir a propriedade link', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(createCheckoutLink('shop-123', 'pix')).rejects.toThrow(
      'Não foi possível iniciar o pagamento. Tente de novo.',
    );
  });
});
