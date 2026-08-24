const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { discoverNearbyShops } from './discoverShops.service';

describe('discoverNearbyShops', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockReset();
    mockQuery.mockReset();
    mockWhere.mockReset();
  });

  it('retorna estéticas visíveis dentro do raio ordenadas por distância', async () => {
    const userLocation = { lat: -23.55052, lng: -46.633308 }; // São Paulo (Centro)

    // ~2km de distância
    const shop1 = {
      id: 'shop-1',
      data: () => ({
        name: 'Estética Centro',
        location: { lat: -23.56, lng: -46.64, address: 'Rua A, 123', city: 'São Paulo' },
      }),
    };

    // ~20km de distância
    const shop2 = {
      id: 'shop-2',
      data: () => ({
        name: 'Estética Afastada',
        location: { lat: -23.7, lng: -46.65, address: 'Av B, 456', city: 'São Paulo' },
      }),
    };

    // ~100km de distância (fora do raio de 50km)
    const shop3 = {
      id: 'shop-3',
      data: () => ({
        name: 'Estética Outra Cidade',
        location: { lat: -22.9, lng: -47.05, address: 'Rua C, 789', city: 'Campinas' },
      }),
    };

    mockGetDocs.mockResolvedValueOnce({
      docs: [shop2, shop1, shop3],
    });

    const results = await discoverNearbyShops(userLocation, 50);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('shop-1');
    expect(results[0].name).toBe('Estética Centro');
    expect(results[1].id).toBe('shop-2');
    expect(results[1].distanceKm).toBeGreaterThan(results[0].distanceKm);
  });

  it('ignora estéticas sem coordenadas válidas', async () => {
    const userLocation = { lat: -23.55052, lng: -46.633308 };

    const invalidShop1 = {
      id: 'shop-invalid-1',
      data: () => ({
        name: 'Sem location',
      }),
    };

    const invalidShop2 = {
      id: 'shop-invalid-2',
      data: () => ({
        name: 'Sem lat',
        location: { lng: -46.64 },
      }),
    };

    const validShop = {
      id: 'shop-valid',
      data: () => ({
        name: null, // Testando fallback de nome
        location: { lat: -23.55, lng: -46.63 },
      }),
    };

    mockGetDocs.mockResolvedValueOnce({
      docs: [invalidShop1, invalidShop2, validShop],
    });

    const results = await discoverNearbyShops(userLocation, 10);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('shop-valid');
    expect(results[0].name).toBe('Estética');
    expect(results[0].address).toBe('');
    expect(results[0].city).toBe('');
  });

  it('retorna lista vazia em caso de falha no Firestore', async () => {
    const userLocation = { lat: -23.55052, lng: -46.633308 };
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const results = await discoverNearbyShops(userLocation);

    expect(results).toEqual([]);
  });
});
