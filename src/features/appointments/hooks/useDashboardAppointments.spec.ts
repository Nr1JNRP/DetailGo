const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();
const mockWhere = jest.fn((...args: unknown[]) => ({ tipo: 'where', args }));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  query: jest.fn((ref: unknown, ...clauses: unknown[]) => ({ ref, clauses })),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: jest.fn((...args: unknown[]) => ({ tipo: 'orderBy', args })),
  limit: jest.fn((n: number) => ({ tipo: 'limit', n })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useDashboardAppointments } from './useDashboardAppointments';

const INICIO = 1_784_000_000_000;

/** Documento da subcoleção do cliente (usa whenMs). */
const naSubcolecao = (over: Record<string, unknown> = {}, id = 'appt-1') => ({
  id,
  data: () => ({ whenMs: INICIO, shopId: 'shop-1', status: 'scheduled', ...over }),
});

/** Documento da coleção do shop (usa startAtMs). */
const noGlobal = (over: Record<string, unknown> = {}, id = 'appt-9') => ({
  id,
  data: () => ({ startAtMs: INICIO, shopId: 'shop-1', status: 'scheduled', ...over }),
});

const snap = (docs: unknown[]) => ({ docs });

async function emitir(docs: unknown[]) {
  const onNext = mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1][1];
  await act(async () => {
    await onNext(snap(docs));
  });
}

const params = { uid: 'user-1', shopId: 'shop-1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSnapshot.mockReturnValue(jest.fn());
  mockGetDocs.mockResolvedValue(snap([]));
});

describe('useDashboardAppointments', () => {
  it.each([
    ['sem uid', { uid: '', shopId: 'shop-1' }],
    ['sem shopId', { uid: 'user-1', shopId: '' }],
  ])('%s não assina nada', async (_nome, p) => {
    const { result } = renderHook(() => useDashboardAppointments(p));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  // O painel do cliente mostra só o que ainda vai acontecer; concluído e
  // cancelado pertencem ao histórico.
  it('mantém apenas agendamentos ativos', async () => {
    const { result } = renderHook(() => useDashboardAppointments(params));

    await emitir([
      naSubcolecao({ status: 'scheduled' }, 'a'),
      naSubcolecao({ status: 'in_progress' }, 'b'),
      naSubcolecao({ status: 'done' }, 'c'),
      naSubcolecao({ status: 'cancelled' }, 'd'),
    ]);

    expect(result.current.items.map(i => i.id).sort()).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
  });

  it('descarta documentos inválidos', async () => {
    const { result } = renderHook(() => useDashboardAppointments(params));

    await emitir([naSubcolecao(), { id: 'x', data: () => ({ semWhenMs: true }) }]);

    expect(result.current.items).toHaveLength(1);
  });

  describe('fallback para a coleção do shop', () => {
    it('busca no shop quando a subcoleção vem vazia', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([noGlobal()]));

      const { result } = renderHook(() => useDashboardAppointments(params));
      await emitir([]);

      expect(mockWhere).toHaveBeenCalledWith('customerUid', '==', 'user-1');
      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['scheduled', 'in_progress']);
      await waitFor(() => expect(result.current.items).toHaveLength(1));
    });

    it('filtra os inativos que vierem do shop', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([noGlobal({ status: 'done' }, 'antigo')]));

      const { result } = renderHook(() => useDashboardAppointments(params));
      await emitir([]);

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.items).toEqual([]);
    });

    it('só tenta uma vez', async () => {
      const { result } = renderHook(() => useDashboardAppointments(params));

      await emitir([]);
      await emitir([]);

      // Repetir a busca a cada atualização vazia gastaria leitura à toa.
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(result.current.items).toEqual([]);
    });

    it('falha na busca deixa a lista vazia sem travar', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('permission-denied'));

      const { result } = renderHook(() => useDashboardAppointments(params));
      await emitir([]);

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.items).toEqual([]);
    });
  });

  it('erro do listener encerra o carregamento', async () => {
    const { result } = renderHook(() => useDashboardAppointments(params));

    await act(async () => {
      mockOnSnapshot.mock.calls[0][2](new Error('offline'));
    });

    expect(result.current.loading).toBe(false);
  });

  it('usa o limite padrão de 30 e respeita o informado', () => {
    const { limit } = require('@react-native-firebase/firestore');

    renderHook(() => useDashboardAppointments(params));
    expect(limit).toHaveBeenCalledWith(30);

    limit.mockClear();
    renderHook(() => useDashboardAppointments({ ...params, limitN: 5 }));
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('cancela a assinatura ao desmontar', () => {
    const unsub = jest.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub);

    const { unmount } = renderHook(() => useDashboardAppointments(params));
    unmount();

    expect(unsub).toHaveBeenCalled();
  });
});
