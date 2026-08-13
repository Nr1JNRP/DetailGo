const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockWhere = jest.fn((...args: unknown[]) => ({ tipo: 'where', args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ tipo: 'orderBy', args }));
const mockLimit = jest.fn((...args: unknown[]) => ({ tipo: 'limit', args }));
const mockCollection = jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') }));
const mockQuery = jest.fn((ref: unknown, ...clauses: unknown[]) => ({ ref, clauses }));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown])),
  query: (...args: unknown[]) => mockQuery(...(args as [unknown])),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { watchUserAppointmentsWithFallback, fetchUserAppointmentsGlobal } from './appointmentsRepo';

const INICIO = 1_784_000_000_000;

const snapDocs = (docs: Record<string, unknown>[]) => ({
  docs: docs.map((data, i) => ({ id: `doc-${i}`, data: () => data })),
});

/** Documento como gravado na subcoleção do cliente (usa whenMs). */
const naSubcolecao = (over: Record<string, unknown> = {}) => ({
  whenMs: INICIO,
  shopId: 'shop-1',
  status: 'scheduled',
  ...over,
});

/** Documento como gravado na coleção do shop (usa startAtMs). */
const noGlobal = (over: Record<string, unknown> = {}) => ({
  startAtMs: INICIO,
  customerUid: 'user-1',
  shopId: 'shop-1',
  status: 'scheduled',
  ...over,
});

/** Dispara o callback de sucesso registrado no onSnapshot. */
const emitir = (snap: unknown) => mockOnSnapshot.mock.calls[0][1](snap);
/** Dispara o callback de erro registrado no onSnapshot. */
const emitirErro = (err: unknown) => mockOnSnapshot.mock.calls[0][2](err);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocs.mockReset();
  mockOnSnapshot.mockReturnValue(jest.fn());
});

describe('watchUserAppointmentsWithFallback', () => {
  it('devolve a função de cancelamento do listener', () => {
    const unsub = jest.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub);

    const res = watchUserAppointmentsWithFallback({ uid: 'user-1', onChange: jest.fn() });

    expect(res).toBe(unsub);
  });

  it('entrega os agendamentos da subcoleção quando existem', async () => {
    const onChange = jest.fn();
    watchUserAppointmentsWithFallback({ uid: 'user-1', shopId: 'shop-1', onChange });

    await emitir(snapDocs([naSubcolecao(), naSubcolecao({ whenMs: INICIO + 1000 })]));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ startAtMs: INICIO })]),
    );
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
    // Com dados na subcoleção não há motivo para consultar a coleção do shop.
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('descarta documentos inválidos da subcoleção', async () => {
    const onChange = jest.fn();
    watchUserAppointmentsWithFallback({ uid: 'user-1', onChange });

    await emitir(snapDocs([naSubcolecao(), { semWhenMs: true }]));

    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });

  // A subcoleção do cliente é um espelho para listagem rápida. Se estiver
  // vazia — conta antiga, ou sincronização que não rodou — o app busca na
  // coleção do shop para o cliente não ver a tela vazia por engano.
  describe('fallback para a coleção do shop', () => {
    it('busca no shop quando a subcoleção vem vazia', async () => {
      const onChange = jest.fn();
      mockGetDocs.mockResolvedValueOnce(snapDocs([noGlobal()]));

      watchUserAppointmentsWithFallback({ uid: 'user-1', shopId: 'shop-1', onChange });
      await emitir(snapDocs([]));

      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledWith('customerUid', '==', 'user-1');
      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ startAtMs: INICIO })]);
    });

    it('sem shopId não há onde buscar: devolve lista vazia', async () => {
      const onChange = jest.fn();

      watchUserAppointmentsWithFallback({ uid: 'user-1', onChange });
      await emitir(snapDocs([]));

      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('só tenta o fallback uma vez', async () => {
      const onChange = jest.fn();
      mockGetDocs.mockResolvedValueOnce(snapDocs([noGlobal()]));

      watchUserAppointmentsWithFallback({ uid: 'user-1', shopId: 'shop-1', onChange });
      await emitir(snapDocs([]));
      await emitir(snapDocs([]));

      // A segunda emissão vazia não repete a consulta — evita bater no
      // Firestore a cada atualização de um cliente sem agendamento.
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('falha na busca avisa o chamador e devolve lista vazia', async () => {
      const onChange = jest.fn();
      const onError = jest.fn();
      const erro = new Error('permission-denied');
      mockGetDocs.mockRejectedValueOnce(erro);

      watchUserAppointmentsWithFallback({ uid: 'user-1', shopId: 'shop-1', onChange, onError });
      await emitir(snapDocs([]));

      expect(onError).toHaveBeenCalledWith(erro);
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('falha na busca sem onError não quebra', async () => {
      const onChange = jest.fn();
      mockGetDocs.mockRejectedValueOnce(new Error('offline'));

      watchUserAppointmentsWithFallback({ uid: 'user-1', shopId: 'shop-1', onChange });

      await expect(emitir(snapDocs([]))).resolves.toBeUndefined();
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  it('erro do listener chega ao onError', () => {
    const onError = jest.fn();
    const erro = new Error('listener caiu');

    watchUserAppointmentsWithFallback({ uid: 'user-1', onChange: jest.fn(), onError });
    emitirErro(erro);

    expect(onError).toHaveBeenCalledWith(erro);
  });

  it('erro do listener sem onError não quebra', () => {
    watchUserAppointmentsWithFallback({ uid: 'user-1', onChange: jest.fn() });

    expect(() => emitirErro(new Error('listener caiu'))).not.toThrow();
  });

  it('usa o limite padrão de 50 e respeita o informado', () => {
    watchUserAppointmentsWithFallback({ uid: 'user-1', onChange: jest.fn() });
    expect(mockLimit).toHaveBeenCalledWith(50);

    mockLimit.mockClear();
    watchUserAppointmentsWithFallback({ uid: 'user-1', limitN: 10, onChange: jest.fn() });
    expect(mockLimit).toHaveBeenCalledWith(10);
  });
});

describe('fetchUserAppointmentsGlobal', () => {
  it('consulta os agendamentos do cliente naquele shop', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([noGlobal(), noGlobal()]));

    const res = await fetchUserAppointmentsGlobal({ uid: 'user-1', shopId: 'shop-1' });

    expect(res).toHaveLength(2);
    // Escopo por shop e por cliente: sem isso a consulta vazaria dados de
    // outros clientes ou de outra estética.
    expect(mockCollection).toHaveBeenCalledWith({}, 'shops', 'shop-1', 'appointments');
    expect(mockWhere).toHaveBeenCalledWith('customerUid', '==', 'user-1');
    expect(mockOrderBy).toHaveBeenCalledWith('startAtMs', 'desc');
  });

  it('filtra por status quando a lista é informada', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    await fetchUserAppointmentsGlobal({
      uid: 'user-1',
      shopId: 'shop-1',
      statusIn: ['done', 'cancelled'],
    });

    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['done', 'cancelled']);
  });

  it('lista de status vazia não vira filtro', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    await fetchUserAppointmentsGlobal({ uid: 'user-1', shopId: 'shop-1', statusIn: [] });

    expect(mockWhere).not.toHaveBeenCalledWith('status', 'in', expect.anything());
  });

  it('descarta documentos inválidos', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([noGlobal(), { semStartAtMs: true }]));

    const res = await fetchUserAppointmentsGlobal({ uid: 'user-1', shopId: 'shop-1' });

    expect(res).toHaveLength(1);
  });

  it('usa o limite padrão de 50 e respeita o informado', async () => {
    mockGetDocs.mockResolvedValue(snapDocs([]));

    await fetchUserAppointmentsGlobal({ uid: 'user-1', shopId: 'shop-1' });
    expect(mockLimit).toHaveBeenCalledWith(50);

    mockLimit.mockClear();
    await fetchUserAppointmentsGlobal({ uid: 'user-1', shopId: 'shop-1', limitN: 5 });
    expect(mockLimit).toHaveBeenCalledWith(5);
  });
});
