const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db, ...pathSegments) => pathSegments.join('/')),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
}));

import { updateShopName } from './shop.service';

describe('shop.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateShopName', () => {
    it('lança erro ao tentar atualizar para um nome vazio ou apenas com espaços', async () => {
      await expect(updateShopName('shop-123', '')).rejects.toThrow(
        'Nome da loja não pode ser vazio.',
      );
      await expect(updateShopName('shop-123', '   ')).rejects.toThrow(
        'Nome da loja não pode ser vazio.',
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('atualiza o nome da loja no documento correto do Firestore e adiciona updatedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopName('shop-123', '  Detailing Garage Pro  ');

      expect(mockUpdateDoc).toHaveBeenCalledWith('shops/shop-123', {
        name: 'Detailing Garage Pro',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });
});
