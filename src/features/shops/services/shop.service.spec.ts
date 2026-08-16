const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
}));

import { updateShopName } from './shop.service';

describe('shop.service', () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
    mockDoc.mockReset();
  });

  it('lança erro ao tentar atualizar nome com string vazia ou de espaços', async () => {
    await expect(updateShopName('shop-123', '')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );
    await expect(updateShopName('shop-123', '   ')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('atualiza o nome da loja removendo espaços nas pontas e define updatedAt', async () => {
    const dummyRef = { id: 'shop-123' };
    mockDoc.mockReturnValue(dummyRef);
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateShopName('shop-123', '   Estética Speed   ');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'shops', 'shop-123');
    expect(mockUpdateDoc).toHaveBeenCalledWith(dummyRef, {
      name: 'Estética Speed',
      updatedAt: 'MOCK_TIMESTAMP',
    });
  });
});
