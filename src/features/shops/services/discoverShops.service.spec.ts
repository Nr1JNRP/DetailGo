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

describe('discoverShops.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userLocation = { lat: -23.55052, lng: -46.633308 }; // São Paulo

  it('retorna lojas visíveis dentro do raio ordenadas por distância', async () => {
    const mockDocs = [
      {
        id: 'shop-far',
        data: () => ({
          name: 'Estética Distante',
          location: { lat: -23.6, lng: -46.7, address: 'Rua Longa', city: 'São Paulo' },
        }),
      },
      {
        id: 'shop-close',
        data: () => ({
          name: 'Estética Perto',
          location: { lat: -23.551, lng: -46.634, address: 'Rua Perto', city: 'São Paulo' },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toHaveLength(2);
    expect(shops[0].id).toBe('shop-close');
    expect(shops[0].name).toBe('Estética Perto');
    expect(shops[1].id).toBe('shop-far');
    expect(shops[0].distanceKm).toBeLessThan(shops[1].distanceKm);
  });

  it('ignora lojas fora do raio especificado', async () => {
    const mockDocs = [
      {
        id: 'shop-very-far',
        data: () => ({
          name: 'Estética Outra Cidade',
          location: { lat: -22.9068, lng: -43.1729, address: 'Av. Rio', city: 'Rio de Janeiro' },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toEqual([]);
  });

  it('ignora lojas sem localização ou com coordenadas inválidas', async () => {
    const mockDocs = [
      {
        id: 'shop-no-loc',
        data: () => ({ name: 'Sem Localização' }),
      },
      {
        id: 'shop-no-lat',
        data: () => ({ name: 'Sem Lat', location: { lng: -46.633308 } }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toEqual([]);
  });

  it('usa valores padrão de nome, endereço e cidade se ausentes no documento', async () => {
    const mockDocs = [
      {
        id: 'shop-minimal',
        data: () => ({
          location: { lat: -23.55052, lng: -46.633308 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toHaveLength(1);
    expect(shops[0]).toEqual({
      id: 'shop-minimal',
      name: 'Estética',
      lat: -23.55052,
      lng: -46.633308,
      address: '',
      city: '',
      distanceKm: 0,
    });
  });

  it('retorna array vazio graciosamente se houver falha no getDocs', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const shops = await discoverNearbyShops(userLocation, 50);

    expect(shops).toEqual([]);
  });
});
