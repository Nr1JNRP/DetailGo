const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'ts'),
}));

import { updateShopName } from './shop.service';

describe('updateShopName', () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
    mockDoc.mockReset();
  });

  it('atualiza o nome da estética removendo espaços extras', async () => {
    mockDoc.mockReturnValueOnce({ path: 'shops/shop-1' });
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateShopName('shop-1', '  Estética Premium  ');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'shops', 'shop-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'shops/shop-1' },
      {
        name: 'Estética Premium',
        updatedAt: 'ts',
      },
    );
  });

  it('lança erro se o nome estiver vazio ou contiver apenas espaços', async () => {
    await expect(updateShopName('shop-1', '   ')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
