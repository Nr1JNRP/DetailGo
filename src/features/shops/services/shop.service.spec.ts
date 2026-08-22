const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetFirestore = jest.fn();
const mockServerTimestamp = jest.fn(() => 'MOCK_TIMESTAMP');

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockGetFirestore()),
  doc: jest.fn((...args: any[]) => mockDoc(...args)),
  updateDoc: jest.fn((...args: any[]) => mockUpdateDoc(...args)),
  serverTimestamp: jest.fn(() => mockServerTimestamp()),
}));

import { updateShopName } from './shop.service';

describe('shop.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateShopName', () => {
    it('atualiza o nome da estética aplicando trim com sucesso', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateShopName('shop-123', '  Nova Estética Auto  ');

      expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, {
        name: 'Nova Estética Auto',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });

    it('lança erro ao fornecer nome vazio ou contendo apenas espaços', async () => {
      await expect(updateShopName('shop-123', '')).rejects.toThrow(
        'Nome da loja não pode ser vazio.',
      );
      await expect(updateShopName('shop-123', '   ')).rejects.toThrow(
        'Nome da loja não pode ser vazio.',
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
