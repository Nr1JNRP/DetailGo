const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn((..._args: unknown[]) => 'shopDocRef');

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (db: unknown, ...pathSegments: string[]) => mockDoc(db, ...pathSegments),
  updateDoc: (docRef: unknown, data: unknown) => mockUpdateDoc(docRef, data),
  serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
}));

import { updateShopName } from './shop.service';

describe('shop.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('atualiza o nome da loja com sucesso', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateShopName('shop-1', '  Estética Auto Shine  ');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'shops', 'shop-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith('shopDocRef', {
      name: 'Estética Auto Shine',
      updatedAt: 'MOCK_TIMESTAMP',
    });
  });

  it('lança erro se o nome estiver vazio ou contiver apenas espaços', async () => {
    await expect(updateShopName('shop-1', '')).rejects.toThrow('Nome da loja não pode ser vazio.');
    await expect(updateShopName('shop-1', '   ')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
