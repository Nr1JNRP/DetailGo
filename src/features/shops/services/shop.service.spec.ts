const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((...args) => ({ type: 'doc', path: args.slice(1).join('/') })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'ts'),
}));

import { updateShopName } from './shop.service';

describe('shop.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lanca erro ao tentar atualizar com nome vazio ou apenas espacos', async () => {
    await expect(updateShopName('shop-1', '')).rejects.toThrow('Nome da loja não pode ser vazio.');
    await expect(updateShopName('shop-1', '   ')).rejects.toThrow(
      'Nome da loja não pode ser vazio.',
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('atualiza o nome da loja no documento correto e com serverTimestamp', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateShopName('shop-100', '  Auto Detail Studio  ');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'shops/shop-100' },
      {
        name: 'Auto Detail Studio',
        updatedAt: 'ts',
      },
    );
  });
});
