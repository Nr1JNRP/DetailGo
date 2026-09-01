const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
// Guarda as opções do último showConfirm para o teste disparar o onConfirm.
let ultimaConfirmacao: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
} | null = null;
const mockFeedback = {
  showError: mockShowError,
  showSuccess: mockShowSuccess,
  showConfirm: jest.fn((options: typeof ultimaConfirmacao) => {
    ultimaConfirmacao = options;
  }),
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedback }));

// 12/10/2026 12:01. O objeto imita o Timestamp do Firestore, que é o que a tela
// recebe de verdade — se ela passar a ler outro campo, o teste quebra.
const ACESSO_ATE_MS = new Date(2026, 9, 12, 12, 1).getTime();
const mockShopApi = {
  shopId: 'shop-1' as string | null,
  shop: { activeUntil: { toMillis: () => ACESSO_ATE_MS } } as {
    activeUntil?: { toMillis: () => number };
  } | null,
};
jest.mock('@features/shops', () => ({ useShop: () => mockShopApi }));

const mockFetchSubscription = jest.fn();
const mockCancelSubscription = jest.fn();
jest.mock('../services/subscription.service', () => ({
  fetchSubscription: (...args: unknown[]) => mockFetchSubscription(...args),
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import SubscriptionDetailScreen from './SubscriptionDetailScreen';

// A próxima cobrança é DIFERENTE do acesso até de propósito: com as duas datas
// iguais o teste passa mesmo se a tela trocar uma pela outra ou nem formatar.
const assinaturaCartao = {
  ativa: true,
  formaPagamento: 'card' as const,
  valor: 89,
  proximaCobranca: '2026-11-05',
};

function renderizar() {
  return render(<SubscriptionDetailScreen />);
}

describe('SubscriptionDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ultimaConfirmacao = null;
    mockShopApi.shopId = 'shop-1';
    mockShopApi.shop = { activeUntil: { toMillis: () => ACESSO_ATE_MS } };
    mockFetchSubscription.mockResolvedValue(assinaturaCartao);
    mockCancelSubscription.mockResolvedValue(undefined);
  });

  it('busca a assinatura da loja ao abrir', async () => {
    renderizar();

    await waitFor(() => expect(mockFetchSubscription).toHaveBeenCalledWith('shop-1'));
  });

  it('mostra os dados do cartão cadastrado', async () => {
    renderizar();

    expect(await screen.findByText('Cartão de crédito')).toBeTruthy();
    expect(screen.getByText('R$ 89,00')).toBeTruthy();
    expect(screen.getByText('Automática, todo mês')).toBeTruthy();
    // A próxima cobrança vem do Asaas em AAAA-MM-DD e precisa virar data BR.
    expect(screen.getByText('05/11/2026')).toBeTruthy();
  });

  it('mostra até quando o acesso já pago vale', async () => {
    renderizar();

    expect(await screen.findByText('Acesso até')).toBeTruthy();
    expect(screen.getByText('12/10/2026')).toBeTruthy();
  });

  it('mostra -- quando o Asaas não devolve a data da próxima cobrança', async () => {
    mockFetchSubscription.mockResolvedValue({ ...assinaturaCartao, proximaCobranca: null });

    renderizar();

    expect(await screen.findByText('Próxima cobrança')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('mostra -- quando a data do Asaas vem quebrada', async () => {
    mockFetchSubscription.mockResolvedValue({ ...assinaturaCartao, proximaCobranca: 'ontem' });

    renderizar();

    expect(await screen.findByText('Próxima cobrança')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('oferece cancelar quando existe recorrência', async () => {
    renderizar();

    expect(await screen.findByTestId('cancelar-assinatura')).toBeTruthy();
    expect(screen.queryByTestId('mudar-para-cartao')).toBeNull();
  });

  // Pix é cobrança avulsa: não há o que cancelar, e o dono precisa saber que
  // nada renova sozinho.
  it('mostra pagamento avulso e oferece migrar para cartão quando não há assinatura', async () => {
    mockFetchSubscription.mockResolvedValue(null);

    renderizar();

    expect(await screen.findByText('Pagamento avulso')).toBeTruthy();
    expect(screen.getByText('Pix, pago manualmente')).toBeTruthy();
    expect(
      screen.getByText('O Pix não renova sozinho. Você precisa pagar de novo a cada mês.'),
    ).toBeTruthy();
    expect(screen.getByTestId('mudar-para-cartao')).toBeTruthy();
    expect(screen.queryByTestId('cancelar-assinatura')).toBeNull();
  });

  it('trata assinatura inativa como sem recorrência', async () => {
    mockFetchSubscription.mockResolvedValue({ ...assinaturaCartao, ativa: false });

    renderizar();

    expect(await screen.findByTestId('mudar-para-cartao')).toBeTruthy();
  });

  it('leva para o checkout ao tocar em mudar para cartão', async () => {
    mockFetchSubscription.mockResolvedValue(null);

    renderizar();

    fireEvent.press(await screen.findByTestId('mudar-para-cartao'));

    expect(mockNavigate).toHaveBeenCalledWith('Subscription');
  });

  it('volta ao tocar na seta', async () => {
    renderizar();

    fireEvent.press(await screen.findByTestId('voltar'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('pede confirmação antes de cancelar, dizendo até quando o acesso vale', async () => {
    renderizar();

    fireEvent.press(await screen.findByTestId('cancelar-assinatura'));

    expect(mockFeedback.showConfirm).toHaveBeenCalled();
    expect(ultimaConfirmacao?.destructive).toBe(true);
    expect(ultimaConfirmacao?.message).toContain('12/10/2026');
    // Só confirmar chama a API. Abrir o modal não pode cancelar nada.
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it('cancela e some com o botão depois da confirmação', async () => {
    renderizar();

    fireEvent.press(await screen.findByTestId('cancelar-assinatura'));
    await act(async () => {
      await ultimaConfirmacao?.onConfirm();
    });

    expect(mockCancelSubscription).toHaveBeenCalledWith('shop-1');
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Assinatura cancelada. Seu acesso vale até 12/10/2026.',
    );
    await waitFor(() => expect(screen.queryByTestId('cancelar-assinatura')).toBeNull());
  });

  it('avisa quando o cancelamento falha e mantém o botão', async () => {
    mockCancelSubscription.mockRejectedValue(new Error('Asaas fora do ar.'));

    renderizar();

    fireEvent.press(await screen.findByTestId('cancelar-assinatura'));
    await act(async () => {
      await ultimaConfirmacao?.onConfirm();
    });

    expect(mockShowError).toHaveBeenCalledWith('Asaas fora do ar.');
    expect(screen.getByTestId('cancelar-assinatura')).toBeTruthy();
  });

  it('avisa quando a busca falha', async () => {
    mockFetchSubscription.mockRejectedValue(new Error('Sessão expirada. Entre novamente.'));

    renderizar();

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Sessão expirada. Entre novamente.'),
    );
  });

  it('mostra -- quando a loja ainda não tem data de acesso', async () => {
    mockShopApi.shop = null;
    mockFetchSubscription.mockResolvedValue({ ...assinaturaCartao, proximaCobranca: null });

    renderizar();

    expect(await screen.findByText('Acesso até')).toBeTruthy();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('não busca nada sem shopId', async () => {
    mockShopApi.shopId = null;

    renderizar();

    await waitFor(() => expect(mockFetchSubscription).not.toHaveBeenCalled());
  });
});
