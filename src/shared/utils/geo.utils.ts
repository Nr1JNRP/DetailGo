import { geohashForLocation, distanceBetween } from 'geofire-common';

export type Coordinates = {
  lat: number;
  lng: number;
};

/**
 * Gera geohash a partir de coordenadas (lat, lng)
 */
export function generateGeohash(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

/**
 * Calcula distância em km entre dois pontos
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]);
}

/**
 * Formata distância para exibição amigável.
 * Ex: 0.8km → "800m" | 2.5km → "2.5km"
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Geocodifica um endereço em texto livre via Nominatim (OpenStreetMap).
 * Usado como fallback quando o GPS falha.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address,
    )}&limit=1&countrycodes=br`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DetailGoApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
