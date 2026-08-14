const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();
const mockWhere = jest.fn((...args: unknown[]) => ({ tipo: 'where', args }));
const mockStartAfter = jest.fn((d: unknown) => ({ tipo: 'startAfter', d }));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  query: jest.fn((ref: unknown, ...clauses: unknown[]) => ({ ref, clauses })),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: jest.fn((...args: unknown[]) => ({ tipo: 'orderBy', args })),
  limit: jest.fn((n: number) => ({ tipo: 'limit', n })),
  startAfter: (d: unknown) => mockStartAfter(d),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'owner-1' } })),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
    // Roda o efeito como se a tela estivesse sempre em foco.
    useFocusEffect: (cb: () => void | (() => void)) => ReactLocal.useEffect(cb, [cb]),
  };
});

const mockShowError = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};
jest.mock('@shared/components/FeedbackProvider', () => ({
  useFeedback: () => mockFeedbackApi,
}));

const mockShopApi = { shopId: 'shop-1' as string | null };

// As funções precisam ser ESTÁVEIS entre renders: a tela as usa como
// dependência de useCallback/useFocusEffect. Criar uma nova a cada render
// reexecuta o efeito indefinidamente e o teste estoura a memória.
const mockFetchCustomerName = jest.fn(async () => 'Ana Silva');
const mockCacheApi = { fetchCustomerName: mockFetchCustomerName };
jest.mock('@shared/hooks/useFirestoreCache', () => ({
  useCustomerName: () => mockCacheApi,
}));

const mockPullRefreshApi = { refreshControl: undefined, tick: 0 };
jest.mock('@shared/hooks/usePullRefresh', () => ({
  usePullRefresh: () => mockPullRefreshApi,
}));

jest.mock('@features/shops', () => ({ useShop: () => mockShopApi }));

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import AdminHistoryScreen from './AdminHistoryScreen';

const INICIO = new Date(2026, 6, 15, 14, 30).getTime();

const doc = (over: Record<string, unknown> = {}, id = 'appt-1') => ({
  id,
  data: () => ({
    startAtMs: INICIO,
    customerUid: 'user-1',
    customerName: 'Ana Silva',
    serviceLabel: 'Polimento',
    price: 300,
    status: 'done',
    ...over,
  }),
});

/** Entrega um snapshot ao listener registrado e aguarda o estado assentar. */
async function emitir(docs: ReturnType<typeof doc>[]) {
  const onNext = mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1][1];
  await act(async () => {
    await onNext({ docs });
  });
}

/** Dispara o callback de erro do listener. */
async function emitirErro(error: { code?: string }) {
  const onError = mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1][2];
  await act(async () => {
    onError(error);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShopApi.shopId = 'shop-1';
  mockOnSnapshot.mockReturnValue(jest.fn());
});

describe('AdminHistoryScreen', () => {
  it('mostra o título e os filtros disponíveis', async () => {
    render(<AdminHistoryScreen />);
    await emitir([]);

    expect(screen.getByText('Histórico')).toBeTruthy();
    ['Todos', 'Concluídos', 'Não realizados', 'Cancelados'].forEach(f => {
      expect(screen.getByText(f)).toBeTruthy();
    });
  });

  it('mostra o aviso de lista vazia', async () => {
    render(<AdminHistoryScreen />);
    await emitir([]);

    expect(screen.getByText('Nenhum registro encontrado.')).toBeTruthy();
  });

  it('lista os registros do histórico', async () => {
    render(<AdminHistoryScreen />);
    await emitir([doc()]);

    await waitFor(() => expect(screen.getByText('Polimento')).toBeTruthy());
    // O nome vem junto do veículo no mesmo texto: "Ana Silva · Carro".
    expect(screen.getByText(/Ana Silva/)).toBeTruthy();
  });

  it('encurta o nome do cliente para dois termos', async () => {
    // Nome completo estoura a largura da linha; dois termos identificam sem
    // truncar no meio da palavra.
    render(<AdminHistoryScreen />);
    await emitir([doc({ customerName: 'Maria Aparecida da Silva Souza' })]);

    await waitFor(() => expect(screen.getByText(/Maria Aparecida ·/)).toBeTruthy());
    expect(screen.queryByText(/Souza/)).toBeNull();
  });

  it('usa "Serviço" quando o registro não tem rótulo', async () => {
    render(<AdminHistoryScreen />);
    await emitir([doc({ serviceLabel: null })]);

    await waitFor(() => expect(screen.getByText('Serviço')).toBeTruthy());
  });

  it('volta ao tocar na seta', async () => {
    render(<AdminHistoryScreen />);
    await emitir([]);

    fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

    expect(mockGoBack).toHaveBeenCalled();
  });

  // O histórico só mostra o que já terminou — agendamentos ativos ficam na
  // agenda, não aqui.
  it('consulta os três status de histórico no filtro Todos', async () => {
    render(<AdminHistoryScreen />);
    await emitir([]);

    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['done', 'no_show', 'cancelled']);
  });

  it.each([
    ['Concluídos', ['done']],
    ['Não realizados', ['no_show']],
    ['Cancelados', ['cancelled']],
  ] as const)('filtro %s consulta apenas %s', async (rotulo, statusEsperado) => {
    render(<AdminHistoryScreen />);
    await emitir([]);
    mockWhere.mockClear();

    await act(async () => {
      fireEvent.press(screen.getByText(rotulo));
    });

    expect(mockWhere).toHaveBeenCalledWith('status', 'in', statusEsperado);
  });

  describe('exibição por status', () => {
    it('mostra o preço nos concluídos', async () => {
      render(<AdminHistoryScreen />);
      await emitir([doc({ status: 'done', price: 300 })]);

      await waitFor(() => expect(screen.getByText('R$ 300')).toBeTruthy());
    });

    it('marca os não realizados', async () => {
      render(<AdminHistoryScreen />);
      await emitir([doc({ status: 'no_show' })]);

      await waitFor(() => expect(screen.getByText('NÃO REALIZADO')).toBeTruthy());
    });

    it('marca os cancelados', async () => {
      render(<AdminHistoryScreen />);
      await emitir([doc({ status: 'cancelled' })]);

      await waitFor(() => expect(screen.getByText('CANCELADO')).toBeTruthy());
    });
  });

  describe('erros do listener', () => {
    // O Firestore exige índice composto para a consulta com filtro + ordenação.
    // Sem ele a tela fica vazia sem explicação — daí a mensagem específica.
    it('orienta a criar o índice quando falta precondição', async () => {
      render(<AdminHistoryScreen />);
      await emitirErro({ code: 'failed-precondition' });

      expect(mockShowError).toHaveBeenCalledWith(
        'Crie um índice composto no Firebase Console.',
        expect.objectContaining({ title: 'Índice necessário' }),
      );
    });

    it('mostra mensagem genérica nos demais erros', async () => {
      render(<AdminHistoryScreen />);
      await emitirErro({ code: 'unavailable' });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao carregar histórico.');
    });
  });

  // O documento do shop guarda o nome do cliente, mas registros antigos podem
  // ter só 'Cliente'. Nesse caso a tela busca o nome real no cache.
  describe('nome do cliente ausente', () => {
    it('busca o nome quando o registro traz o genérico', async () => {
      render(<AdminHistoryScreen />);
      await emitir([doc({ customerName: 'Cliente' })]);

      await waitFor(() => expect(mockFetchCustomerName).toHaveBeenCalledWith('user-1'));
      expect(screen.getByText(/Ana Silva/)).toBeTruthy();
    });

    it('não busca quando o nome já veio preenchido', async () => {
      render(<AdminHistoryScreen />);
      await emitir([doc({ customerName: 'Bruno Tirac' })]);

      await waitFor(() => expect(screen.getByText(/Bruno Tirac/)).toBeTruthy());
      expect(mockFetchCustomerName).not.toHaveBeenCalled();
    });
  });

  describe('paginação', () => {
    /** Aciona o onEndReached da lista, como ao rolar até o fim. */
    async function rolarAteOFim() {
      const { SectionList } = require('react-native');
      const lista = screen.UNSAFE_getByType(SectionList);
      await act(async () => {
        await lista.props.onEndReached?.();
      });
    }

    it('não busca mais itens quando a primeira página veio incompleta', async () => {
      // Menos que o tamanho da página significa que acabou — não adianta pedir
      // mais e gastar leitura no Firestore.
      render(<AdminHistoryScreen />);
      await emitir([doc()]);

      await rolarAteOFim();

      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('avisa quando a busca por mais itens falha', async () => {
      const pagina = Array.from({ length: 30 }, (_, i) => doc({}, `appt-${i}`));
      mockGetDocs.mockRejectedValueOnce(new Error('offline'));

      render(<AdminHistoryScreen />);
      await emitir(pagina);
      await rolarAteOFim();

      expect(mockShowError).toHaveBeenCalledWith('Falha ao carregar mais itens.');
    });

    it('busca a página seguinte a partir do último item', async () => {
      const pagina = Array.from({ length: 30 }, (_, i) => doc({}, `appt-${i}`));
      mockGetDocs.mockResolvedValueOnce({ docs: [doc({}, 'appt-99')] });

      render(<AdminHistoryScreen />);
      await emitir(pagina);
      await rolarAteOFim();

      // A continuação usa startAfter no último documento recebido — sem isso a
      // segunda página repetiria a primeira.
      expect(mockStartAfter).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt-29' }));
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('não busca duas vezes ao rolar de novo durante o carregamento', async () => {
      const pagina = Array.from({ length: 30 }, (_, i) => doc({}, `appt-${i}`));
      mockGetDocs.mockResolvedValue({ docs: [] });

      render(<AdminHistoryScreen />);
      await emitir(pagina);
      await rolarAteOFim();
      mockGetDocs.mockClear();
      // Depois de uma página vazia não há mais o que buscar.
      await rolarAteOFim();

      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  it('não consulta nada sem shop definido', async () => {
    mockShopApi.shopId = null;

    render(<AdminHistoryScreen />);

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});
