import { geohashForLocation, distanceBetween } from 'geofire-common';

const FUNCTIONS_BASE = 'https://us-central1-magic-auto.cloudfunctions.net';

export type Coordinates = {
  lat: number;
  lng: number;
};

export function generateGeohash(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]);
}

/**
 * Formata distância para exibição amigável.
 * Ex: 0.8km → "800m" | 2.5km → "2.5km"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

async function geocodeNominatim(address: string): Promise<Coordinates | null> {
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

/**
 * Geocodifica um endereço via Cloud Function proxy (chave no servidor).
 * Fallback para Nominatim se a função não estiver disponível.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lat && data.lng) return { lat: data.lat, lng: data.lng };
    }
  } catch {}

  return geocodeNominatim(address);
}

export type ReverseGeocodeResult = {
  address: string;
  city: string;
  cep?: string;
};

/**
 * Geocodificação reversa via Cloud Function proxy (chave no servidor).
 * Fallback para Nominatim se a função não estiver disponível.
 */
export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/reverseGeocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.address || data.city) return data as ReverseGeocodeResult;
    }
  } catch {}

  // Fallback: Nominatim reverse
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&accept-language=pt-BR`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DetailGoApp/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const a = data.address ?? {};
      const road = a.road ?? a.pedestrian ?? '';
      const suburb = a.suburb ?? a.neighbourhood ?? '';
      const city = a.city ?? a.town ?? a.municipality ?? '';
      const state = a.state ?? '';
      const postalCode = (a.postcode ?? '').replace(/\D/g, '');
      return {
        address: [road, suburb].filter(Boolean).join(', '),
        city: city && state ? `${city} - ${state}` : city || state,
        cep: postalCode || undefined,
      };
    }
  } catch {}

  return null;
}
