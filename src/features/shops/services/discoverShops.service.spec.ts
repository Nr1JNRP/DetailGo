const mockGetFirestore = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockGetFirestore()),
  collection: jest.fn((...args: any[]) => mockCollection(...args)),
  doc: jest.fn((...args: any[]) => mockDoc(...args)),
  getDocs: jest.fn((...args: any[]) => mockGetDocs(...args)),
  query: jest.fn((...args: any[]) => mockQuery(...args)),
  where: jest.fn((...args: any[]) => mockWhere(...args)),
}));

import { discoverNearbyShops } from './discoverShops.service';

describe('discoverShops.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverNearbyShops', () => {
    const userLocation = { lat: -23.55052, lng: -46.633308 }; // São Paulo central

    it('busca estéticas visíveis no mapa e calcula distância ordenando por proximidade', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'shop-far',
            data: () => ({
              name: 'Estética Longe',
              location: {
                lat: -23.65052,
                lng: -46.733308,
                address: 'Rua Longe, 100',
                city: 'São Paulo',
              },
            }),
          },
          {
            id: 'shop-near',
            data: () => ({
              name: 'Estética Perto',
              location: {
                lat: -23.55152,
                lng: -46.634308,
                address: 'Rua Perto, 10',
                city: 'São Paulo',
              },
            }),
          },
        ],
      });

      const results = await discoverNearbyShops(userLocation, 50);

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('shop-near');
      expect(results[0].name).toBe('Estética Perto');
      expect(results[1].id).toBe('shop-far');
      expect(results[1].name).toBe('Estética Longe');
      expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
    });

    it('descarta estéticas fora do raio especificado', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'shop-out',
            data: () => ({
              name: 'Estética Fora do Raio',
              location: { lat: -24.55052, lng: -47.633308 },
            }),
          },
        ],
      });

      const results = await discoverNearbyShops(userLocation, 10);
      expect(results).toEqual([]);
    });

    it('ignora estéticas sem coordenadas válidas', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'shop-no-loc',
            data: () => ({
              name: 'Estética Sem Local',
              location: null,
            }),
          },
          {
            id: 'shop-missing-lat',
            data: () => ({
              name: 'Estética Sem Lat',
              location: { lng: -46.633308 },
            }),
          },
        ],
      });

      const results = await discoverNearbyShops(userLocation, 50);
      expect(results).toEqual([]);
    });

    it('trata dados nulos ou ausentes usando fallbacks para nome, endereço e cidade', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'shop-minimal',
            data: () => ({
              location: { lat: -23.5506, lng: -46.6334 },
            }),
          },
        ],
      });

      const results = await discoverNearbyShops(userLocation, 50);
      expect(results.length).toBe(1);
      expect(results[0]).toEqual({
        id: 'shop-minimal',
        name: 'Estética',
        lat: -23.5506,
        lng: -46.6334,
        address: '',
        city: '',
        distanceKm: expect.any(Number),
      });
    });

    it('retorna array vazio quando getDocs falhar', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const results = await discoverNearbyShops(userLocation, 50);
      expect(results).toEqual([]);
    });
  });
});
