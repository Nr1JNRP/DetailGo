const mockGetDocs = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((_db, ...pathSegments) => pathSegments.join('/')),
  query: jest.fn(ref => ref),
  where: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { discoverNearbyShops } from './discoverShops.service';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

describe('discoverShops.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverNearbyShops', () => {
    const userLocation = { lat: -23.55052, lng: -46.633308 }; // São Paulo central

    it('retorna estéticas no raio especificadas, ordenadas por menor distância', async () => {
      const docs = [
        {
          id: 'shop-far',
          data: () => ({
            name: 'Estética Distante (10km)',
            location: { lat: -23.64052, lng: -46.633308, address: 'Rua A', city: 'São Paulo' },
          }),
        },
        {
          id: 'shop-near',
          data: () => ({
            name: 'Estética Perto (1km)',
            location: { lat: -23.55952, lng: -46.633308, address: 'Rua B', city: 'São Paulo' },
          }),
        },
      ] as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot[];

      mockGetDocs.mockResolvedValueOnce({ docs });

      const results = await discoverNearbyShops(userLocation, 50);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('shop-near');
      expect(results[1].id).toBe('shop-far');
      expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
    });

    it('filtra fora estéticas fora do raio limite especificado', async () => {
      const docs = [
        {
          id: 'shop-too-far',
          data: () => ({
            name: 'Estética Muito Distante (100km)',
            location: { lat: -24.55052, lng: -46.633308, address: 'Rua C', city: 'Santos' },
          }),
        },
      ] as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot[];

      mockGetDocs.mockResolvedValueOnce({ docs });

      const results = await discoverNearbyShops(userLocation, 10); // Raio de 10km

      expect(results).toHaveLength(0);
    });

    it('ignora estéticas com localização ou coordenadas ausentes ou inválidas', async () => {
      const docs = [
        {
          id: 'shop-no-loc',
          data: () => ({ name: 'Sem Localização' }),
        },
        {
          id: 'shop-partial-loc',
          data: () => ({ name: 'Sem Lng', location: { lat: -23.55052 } }),
        },
      ] as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot[];

      mockGetDocs.mockResolvedValueOnce({ docs });

      const results = await discoverNearbyShops(userLocation, 50);

      expect(results).toHaveLength(0);
    });

    it('usa valores padrão ("Estética", "", "") quando campos de nome e endereço estiverem ausentes', async () => {
      const docs = [
        {
          id: 'shop-anon',
          data: () => ({
            location: { lat: -23.55152, lng: -46.633308 },
          }),
        },
      ] as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot[];

      mockGetDocs.mockResolvedValueOnce({ docs });

      const results = await discoverNearbyShops(userLocation, 50);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'shop-anon',
        name: 'Estética',
        address: '',
        city: '',
      });
    });

    it('retorna array vazio graciosamente se a busca no Firestore falhar', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('firestore-error'));

      const results = await discoverNearbyShops(userLocation, 50);

      expect(results).toEqual([]);
    });
  });
});
