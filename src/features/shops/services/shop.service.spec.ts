const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockServerTimestamp = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
}));

import { updateShopName } from './shop.service';

describe('updateShopName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({ path: 'shops/shop-123' });
    mockServerTimestamp.mockReturnValue('MOCK_TIMESTAMP');
  });

  it('atualiza o nome da loja cortando espaços em branco nas extremidades', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateShopName('shop-123', '   Estética Pro   ');

    expect(mockDoc).toHaveBeenCalledWith({}, 'shops', 'shop-123');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'shops/shop-123' },
      {
        name: 'Estética Pro',
        updatedAt: 'MOCK_TIMESTAMP',
      },
    );
  });

  it('lança erro quando o nome for vazio ou apenas espaços', async () => {
    await expect(updateShopName('shop-123', '')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );
    await expect(updateShopName('shop-123', '    ')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
