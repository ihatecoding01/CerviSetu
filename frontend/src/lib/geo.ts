// Location helpers for Find Your Centre. Nothing here talks to the CerviSetu server.
export interface Point { lat: number; lng: number }

/** Great-circle distance in km. This is straight-line distance, not road distance. */
export function straightLineKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The destination only: her own maps app picks the starting point, so her location is not put in the link. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export interface RouteResult { km: number; minutes: number; path: [number, number][] }

/** A real road route from an OSRM-compatible service, or null when none is configured or it fails. */
export async function fetchRoute(baseUrl: string, from: Point, to: Point): Promise<RouteResult | null> {
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const route = (await res.json()).routes?.[0];
    if (!route) return null;
    return { km: route.distance / 1000, minutes: Math.round(route.duration / 60), path: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]) };
  } catch {
    return null;
  }
}

/** Looks up a typed place once, on request. Returns null when nothing matches or the service fails. */
export async function geocode(baseUrl: string, query: string): Promise<Point | null> {
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl}?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const hit = (await res.json())[0];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}
