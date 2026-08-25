const mockGetDocs = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { discoverNearbyShops } from './discoverShops.service';

describe('discoverShops.service', () => {
  const userLoc = { lat: -23.5505, lng: -46.6333 }; // São Paulo center

  beforeEach(() => {
    mockGetDocs.mockReset();
  });

  it('retorna estéticas visíveis no mapa dentro do raio ordenadas por distância', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'shop-far',
          data: () => ({
            name: 'Estética Distante',
            isVisibleOnMap: true,
            location: { lat: -23.7, lng: -46.6333, address: 'Rua Longa', city: 'São Paulo' },
          }),
        },
        {
          id: 'shop-near',
          data: () => ({
            name: 'Estética Perto',
            isVisibleOnMap: true,
            location: { lat: -23.551, lng: -46.6335, address: 'Rua Perto 10', city: 'São Paulo' },
          }),
        },
        {
          id: 'shop-out-of-radius',
          data: () => ({
            name: 'Outra Cidade',
            isVisibleOnMap: true,
            location: { lat: -22.9068, lng: -43.1729, address: 'Rua Rio', city: 'Rio de Janeiro' },
          }),
        },
      ],
    });

    const results = await discoverNearbyShops(userLoc, 30);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('shop-near');
    expect(results[0].name).toBe('Estética Perto');
    expect(results[0].address).toBe('Rua Perto 10');
    expect(results[1].id).toBe('shop-far');
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
  });

  it('ignora estéticas sem coordenadas válidas ou com localização incompleta', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'shop-no-loc',
          data: () => ({ name: 'Sem Loc', isVisibleOnMap: true }),
        },
        {
          id: 'shop-partial-loc',
          data: () => ({ name: 'Sem Lng', isVisibleOnMap: true, location: { lat: -23.55 } }),
        },
        {
          id: 'shop-valid',
          data: () => ({
            isVisibleOnMap: true,
            location: { lat: -23.5505, lng: -46.6333 },
          }),
        },
      ],
    });

    const results = await discoverNearbyShops(userLoc, 10);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('shop-valid');
    expect(results[0].name).toBe('Estética'); // Nome padrão quando ausente
    expect(results[0].address).toBe('');
    expect(results[0].city).toBe('');
  });

  it('retorna array vazio quando o Firestore lança erro', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('firestore-error'));

    const results = await discoverNearbyShops(userLoc, 50);

    expect(results).toEqual([]);
  });
});
