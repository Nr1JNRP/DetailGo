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
  const userLocation = { lat: -23.55052, lng: -46.633308 }; // São Paulo SP center

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca apenas estéticas marcadas como isVisibleOnMap no Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await discoverNearbyShops(userLocation);

    expect(mockCollection).toHaveBeenCalledWith({}, 'shops');
    expect(mockWhere).toHaveBeenCalledWith('isVisibleOnMap', '==', true);
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('ignora estéticas sem coordenadas válidas de lat/lng', async () => {
    const mockDocs = [
      {
        id: 'shop-no-loc',
        data: () => ({ name: 'Sem Local', location: null }),
      },
      {
        id: 'shop-no-lat',
        data: () => ({ name: 'Sem Lat', location: { lng: -46.63 } }),
      },
      {
        id: 'shop-no-lng',
        data: () => ({ name: 'Sem Lng', location: { lat: -23.55 } }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const results = await discoverNearbyShops(userLocation);
    expect(results).toEqual([]);
  });

  it('filtra estéticas fora do raio informado e ordena por distância', async () => {
    const mockDocs = [
      {
        // ~100km away
        id: 'shop-far',
        data: () => ({
          name: 'Estética Distante',
          location: { lat: -22.9068, lng: -47.0616, address: 'Rua Longa 100', city: 'Campinas' },
        }),
      },
      {
        // ~2km away
        id: 'shop-close',
        data: () => ({
          name: 'Estética Perto',
          location: {
            lat: -23.5615,
            lng: -46.6559,
            address: 'Av Paulista 1000',
            city: 'São Paulo',
          },
        }),
      },
      {
        // ~10km away
        id: 'shop-mid',
        data: () => ({
          name: 'Estética Média',
          location: { lat: -23.6211, lng: -46.6983, address: 'Av Berrini 500', city: 'São Paulo' },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    // Radius = 50km
    const results = await discoverNearbyShops(userLocation, 50);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('shop-close');
    expect(results[1].id).toBe('shop-mid');
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
    expect(results[0].address).toBe('Av Paulista 1000');
    expect(results[0].city).toBe('São Paulo');
  });

  it('usa valores padrão para nome, endereço e cidade se omitidos', async () => {
    const mockDocs = [
      {
        id: 'shop-minimal',
        data: () => ({
          location: { lat: -23.551, lng: -46.634 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const results = await discoverNearbyShops(userLocation, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'shop-minimal',
      name: 'Estética',
      lat: -23.551,
      lng: -46.634,
      address: '',
      city: '',
      distanceKm: expect.any(Number),
    });
  });

  it('retorna lista vazia em caso de falha no Firestore', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore connection error'));

    const results = await discoverNearbyShops(userLocation);
    expect(results).toEqual([]);
  });
});
