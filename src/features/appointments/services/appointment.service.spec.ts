const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((...args: any[]) => args);
const mockCollection = jest.fn((...args: any[]) => args);
const mockQuery = jest.fn((...args: any[]) => args);
const mockWhere = jest.fn((...args: any[]) => ({ type: 'where', args }));
const mockWriteBatch = jest.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  writeBatch: () => mockWriteBatch(),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
}));

const mockCurrentUser = { uid: 'user-123' };
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

import {
  getAppointmentRules,
  cancelAppointment,
  clearShopFavoriteIfNoActive,
} from './appointment.service';

const HOUR = 60 * 60 * 1000;

// Helper para criar mock snapshot com base em se é para user (com exists como função) ou outro (exists como boolean)
const createMockUserSnap = (data: any, exists = true) => ({
  exists: () => exists,
  data: () => data,
});

const createMockAppointmentSnap = (data: any, exists = true) => ({
  exists,
  data: () => data,
});

describe('getAppointmentRules', () => {
  it('agendamento futuro pode ser cancelado', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() + HOUR });
    expect(rules.canCancel).toBe(true);
    expect(rules.isExpired).toBe(false);
  });

  it('NÃO cancela depois do horário marcado (corte no instante)', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() - HOUR });
    expect(rules.canCancel).toBe(false);
    expect(rules.message).toMatch(/já passou/i);
  });

  it('exatamente no horário já não permite cancelar', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() });
    expect(rules.canCancel).toBe(false);
  });

  it.each([
    ['cancelled', /cancelado/i],
    ['no_show', /não compareceu/i],
    ['done', /já foi realizado/i],
    ['in_progress', /andamento/i],
  ] as const)('status %s não permite cancelar e explica o motivo', (status, motivo) => {
    const rules = getAppointmentRules({ status, startAtMs: Date.now() + HOUR });
    expect(rules.canCancel).toBe(false);
    expect(rules.message).toMatch(motivo);
  });
});

describe('cancelAppointment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser.uid = 'user-123';
  });

  it('retorna erro se o usuário não estiver logado', async () => {
    const authMock = require('@react-native-firebase/auth');
    authMock.getAuth.mockReturnValueOnce({ currentUser: null });

    const result = await cancelAppointment('appt-1', 'user-123', 'shop-1');
    expect(result).toEqual({ ok: false, message: 'Você precisa estar logado.' });
  });

  it('retorna erro se o ID do usuário logado for diferente de customerUid', async () => {
    const result = await cancelAppointment('appt-1', 'other-user', 'shop-1');
    expect(result).toEqual({ ok: false, message: 'Permissão negada.' });
  });

  it('retorna erro se o agendamento não for encontrado', async () => {
    mockGetDoc.mockResolvedValueOnce(createMockAppointmentSnap(null, false));

    const result = await cancelAppointment('appt-1', 'user-123', 'shop-1');
    expect(result).toEqual({ ok: false, message: 'Agendamento não encontrado.' });
  });

  it('retorna erro se as regras impedirem o cancelamento', async () => {
    mockGetDoc.mockResolvedValueOnce(
      createMockAppointmentSnap({ status: 'done', startAtMs: Date.now() + HOUR }),
    );

    const result = await cancelAppointment('appt-1', 'user-123', 'shop-1');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/já foi realizado/i);
  });

  it('cancela com sucesso utilizando batch write e limpa o shop favorito', async () => {
    // Primeiro getDoc: o agendamento
    mockGetDoc.mockResolvedValueOnce(
      createMockAppointmentSnap({ status: 'scheduled', startAtMs: Date.now() + HOUR }),
    );
    // Segundo getDoc (dentro de clearShopFavoriteIfNoActive): o usuário
    mockGetDoc.mockResolvedValueOnce(createMockUserSnap({ shopId: 'shop-1' }));
    // getDocs do agendamento (retorna lista vazia indicando nenhum agendamento ativo)
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const result = await cancelAppointment('appt-1', 'user-123', 'shop-1');

    expect(result).toEqual({ ok: true, message: 'Agendamento cancelado com sucesso!' });
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('retorna erro formatado se uma exceção for lançada', async () => {
    mockGetDoc.mockRejectedValueOnce({ code: 'permission-denied', message: 'No permissions' });

    const result = await cancelAppointment('appt-1', 'user-123', 'shop-1');
    expect(result).toEqual({ ok: false, message: 'Você não tem permissão para isso.' });
  });
});

describe('clearShopFavoriteIfNoActive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não altera nada se o perfil do usuário não existir', async () => {
    mockGetDoc.mockResolvedValueOnce(createMockUserSnap(null, false));

    await clearShopFavoriteIfNoActive('user-123', 'shop-1');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('não altera nada se o shopId favorito do usuário for diferente do shopId atual', async () => {
    mockGetDoc.mockResolvedValueOnce(createMockUserSnap({ shopId: 'different-shop' }));

    await clearShopFavoriteIfNoActive('user-123', 'shop-1');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('não altera nada se o usuário tiver agendamentos ativos na estética', async () => {
    mockGetDoc.mockResolvedValueOnce(createMockUserSnap({ shopId: 'shop-1' }));
    // Retorna um agendamento ativo e não vencido
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ status: 'scheduled', startAtMs: Date.now() + HOUR }),
        },
      ],
    });

    await clearShopFavoriteIfNoActive('user-123', 'shop-1');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('limpa o shopId do usuário se ele tiver apenas agendamentos expirados ou cancelados', async () => {
    mockGetDoc.mockResolvedValueOnce(createMockUserSnap({ shopId: 'shop-1' }));
    // Retorna agendamentos cancelados, ou scheduled porém expirados (vencidos)
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ status: 'cancelled', startAtMs: Date.now() + HOUR }),
        },
        {
          data: () => ({ status: 'scheduled', startAtMs: Date.now() - 60 * 60 * 1000 }), // bem no passado (tolerância é 15min)
        },
      ],
    });

    await clearShopFavoriteIfNoActive('user-123', 'shop-1');

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.any(Array), // doc(db, 'users', customerUid)
      { shopId: null },
      { merge: true },
    );
  });

  it('captura qualquer erro interno sem lançar exceção', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('Firestore down'));

    // Não deve lançar erro
    await expect(clearShopFavoriteIfNoActive('user-123', 'shop-1')).resolves.not.toThrow();
  });
});
