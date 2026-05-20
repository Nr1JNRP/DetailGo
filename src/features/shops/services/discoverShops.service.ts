import { collection, getDocs, getFirestore, query, where } from '@react-native-firebase/firestore';
import { distanceKm, type Coordinates } from '@shared/utils/geo.utils';

export type NearbyShop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  distanceKm: number;
};

/**
 * Busca estéticas parceiras visíveis no mapa dentro de um raio (km).
 * Filtra por isVisibleOnMap no Firestore e calcula a distância no cliente.
 */
export async function discoverNearbyShops(
  userLocation: Coordinates,
  radiusKm: number = 50,
): Promise<NearbyShop[]> {
  const db = getFirestore();

  const snap = await getDocs(
    query(collection(db, 'shops'), where('isVisibleOnMap', '==', true)),
  ).catch(() => {
    return { docs: [] } as any;
  });

  const results: NearbyShop[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const location = data.location;

    // Shops sem coordenadas válidas são ignorados
    if (!location?.lat || !location?.lng) continue;

    const dist = distanceKm(userLocation, { lat: location.lat, lng: location.lng });

    // Filtra pelo raio
    if (dist > radiusKm) continue;

    results.push({
      id: docSnap.id,
      name: data.name ?? 'Estética',
      lat: location.lat,
      lng: location.lng,
      address: location.address ?? '',
      city: location.city ?? '',
      distanceKm: dist,
    });
  }

  // Ordena pela mais próxima
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}
