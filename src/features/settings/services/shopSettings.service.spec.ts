const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: jest.fn(() => 'ts'),
}));

import { ensureShopSettings } from './shopSettings.service';

function snapWith(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

// Documento de uma loja criada antes de slotStepMin/minNoticeMin existirem.
const legacyShop = {
  openHour: 8,
  closeHour: 18,
  parallelCapacity: 2,
  workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
};

describe('ensureShopSettings', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('preenche os padrões novos em loja antiga', async () => {
    mockGetDoc.mockResolvedValueOnce(snapWith(legacyShop));
    mockSetDoc.mockResolvedValueOnce(undefined);

    const { settings } = await ensureShopSettings('shop-1');

    expect(settings.slotStepMin).toBe(30);
    expect(settings.minNoticeMin).toBe(15);
  });

  it('sem permissão de escrita, ainda devolve as settings', async () => {
    // O cliente lê as settings para montar os horários, mas as firestore.rules
    // só deixam o dono escrever. A gravação dos padrões falha e NÃO pode
    // derrubar a leitura — senão o cliente não consegue ver horário nenhum.
    mockGetDoc.mockResolvedValueOnce(snapWith(legacyShop));
    mockSetDoc.mockRejectedValueOnce(new Error('permission-denied'));

    const { settings } = await ensureShopSettings('shop-1');

    expect(settings.slotStepMin).toBe(30);
    expect(settings.openHour).toBe(8);
  });

  it('descarta valores inválidos e usa o padrão', async () => {
    mockGetDoc.mockResolvedValueOnce(snapWith({ ...legacyShop, slotStepMin: 7, minNoticeMin: -5 }));
    mockSetDoc.mockResolvedValueOnce(undefined);

    const { settings } = await ensureShopSettings('shop-1');

    expect(settings.slotStepMin).toBe(30);
    expect(settings.minNoticeMin).toBe(15);
  });

  it('mantém valores válidos já configurados', async () => {
    mockGetDoc.mockResolvedValueOnce(
      snapWith({ ...legacyShop, slotStepMin: 15, minNoticeMin: 60 }),
    );

    const { settings } = await ensureShopSettings('shop-1');

    expect(settings.slotStepMin).toBe(15);
    expect(settings.minNoticeMin).toBe(60);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
