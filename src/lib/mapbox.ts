// Geocodificação para o campo personalizado "Localização" (issue #193) e
// para a view "Mapa". Usa a Mapbox Geocoding API v5 com o token público
// VITE_MAPBOX_TOKEN (seguro no bundle — mesma categoria da anon key do
// Supabase).

export const MAPBOX_TOKEN: string = (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

export interface GeocodeResult {
  lat: number;
  lng: number;
  placeName: string;
}

// Cache em memória por sessão de aba: evita regeocodificar o mesmo endereço
// a cada digitação/re-render. Não persiste entre reloads de propósito — o
// texto formatado pode mudar quando o Mapbox atualiza sua base.
const geocodeCache = new Map<string, GeocodeResult | null>();

function cacheKey(address: string): string {
  return address.trim().toLowerCase();
}

// Retorna null em vez de lançar quando o endereço não geocodifica (sem token,
// endereço vazio, sem resultados, erro de rede) — o chamador trata isso como
// "endereço inválido" e mantém o texto digitado sem lat/lng, em vez de travar
// a UI com uma exceção.
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed || !MAPBOX_TOKEN) return null;

  const key = cacheKey(trimmed);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature || !Array.isArray(feature.center)) {
      geocodeCache.set(key, null);
      return null;
    }
    const result: GeocodeResult = {
      lng: feature.center[0],
      lat: feature.center[1],
      placeName: feature.place_name || trimmed,
    };
    geocodeCache.set(key, result);
    return result;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}
