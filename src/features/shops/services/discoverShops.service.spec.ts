const mockGetDocs = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...args) => ({ type: 'collection', path: args.slice(1).join('/') })),
  query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
  where: jest.fn((field, op, val) => ({ field, op, val })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { discoverNearbyShops } from './discoverShops.service';

describe('discoverShops.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna lista vazia se getDocs falhar', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const shops = await discoverNearbyShops({ lat: -23.5505, lng: -46.6333 });

    expect(shops).toEqual([]);
  });

  it('ignora lojas sem visibilidade no mapa ou sem coordenadas validas', async () => {
    const docs = [
      {
        id: 'shop-no-loc',
        data: () => ({ name: 'Sem Localizacao' }),
      },
      {
        id: 'shop-invalid-loc',
        data: () => ({ name: 'Localizacao Invalida', location: { lat: null, lng: -46.63 } }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs });

    const shops = await discoverNearbyShops({ lat: -23.5505, lng: -46.6333 });

    expect(shops).toEqual([]);
  });

  it('filtra por raio e ordena esteticas pela distancia mais proxima', async () => {
    // Coordenadas SP centro: -23.5505, -46.6333
    // Perto (~2km): -23.56, -46.64
    // Longe (~100km): -22.90, -47.06 (Campinas aprox)
    const docs = [
      {
        id: 'shop-far',
        data: () => ({
          name: 'Estetica Longe',
          location: { lat: -22.9057, lng: -47.0608, address: 'Rua Far', city: 'Campinas' },
        }),
      },
      {
        id: 'shop-near',
        data: () => ({
          name: 'Estetica Perto',
          location: { lat: -23.56, lng: -46.64, address: 'Rua Near', city: 'Sao Paulo' },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs });

    const userLocation = { lat: -23.5505, lng: -46.6333 };
    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toHaveLength(1);
    expect(shops[0].id).toBe('shop-near');
    expect(shops[0].name).toBe('Estetica Perto');
    expect(shops[0].address).toBe('Rua Near');
    expect(shops[0].city).toBe('Sao Paulo');
    expect(shops[0].distanceKm).toBeLessThan(50);
  });

  it('aplica nome e endereco padrao caso nao estejam preenchidos', async () => {
    const docs = [
      {
        id: 'shop-no-name',
        data: () => ({
          location: { lat: -23.551, lng: -46.634 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs });

    const shops = await discoverNearbyShops({ lat: -23.5505, lng: -46.6333 });

    expect(shops).toHaveLength(1);
    expect(shops[0].name).toBe('Estética');
    expect(shops[0].address).toBe('');
    expect(shops[0].city).toBe('');
  });
});
