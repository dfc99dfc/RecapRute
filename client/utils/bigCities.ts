import { haversineDistanceMeters } from "@/utils/mapUtils";

export type BigCity = { name: string; lat: number; lng: number; radiusKm: number };

export const BIG_CITIES: BigCity[] = [
  // Europe
  { name: "Berlin", lat: 52.52, lng: 13.405, radiusKm: 30 },
  { name: "London", lat: 51.5074, lng: -0.1278, radiusKm: 35 },
  { name: "Paris", lat: 48.8566, lng: 2.3522, radiusKm: 30 },
  { name: "Madrid", lat: 40.4168, lng: -3.7038, radiusKm: 28 },
  { name: "Barcelona", lat: 41.3851, lng: 2.1734, radiusKm: 25 },
  { name: "Rome", lat: 41.9028, lng: 12.4964, radiusKm: 28 },
  { name: "Milan", lat: 45.4642, lng: 9.19, radiusKm: 25 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, radiusKm: 22 },
  { name: "Brussels", lat: 50.8503, lng: 4.3517, radiusKm: 22 },
  { name: "Vienna", lat: 48.2082, lng: 16.3738, radiusKm: 25 },
  { name: "Warsaw", lat: 52.2297, lng: 21.0122, radiusKm: 28 },
  { name: "Prague", lat: 50.0755, lng: 14.4378, radiusKm: 22 },
  { name: "Munich", lat: 48.1351, lng: 11.582, radiusKm: 24 },
  { name: "Hamburg", lat: 53.5511, lng: 9.9937, radiusKm: 28 },
  { name: "Copenhagen", lat: 55.6761, lng: 12.5683, radiusKm: 20 },
  { name: "Stockholm", lat: 59.3293, lng: 18.0686, radiusKm: 28 },
  { name: "Oslo", lat: 59.9139, lng: 10.7522, radiusKm: 20 },
  // North America
  { name: "New York City", lat: 40.7128, lng: -74.006, radiusKm: 45 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, radiusKm: 50 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, radiusKm: 35 },
  { name: "San Francisco Bay Area", lat: 37.7749, lng: -122.4194, radiusKm: 50 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, radiusKm: 30 },
  { name: "Vancouver", lat: 49.2827, lng: -123.1207, radiusKm: 25 },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, radiusKm: 35 },
  // Asia
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, radiusKm: 40 },
  { name: "Osaka", lat: 34.6937, lng: 135.5023, radiusKm: 28 },
  { name: "Seoul", lat: 37.5665, lng: 126.978, radiusKm: 35 },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737, radiusKm: 40 },
  { name: "Beijing", lat: 39.9042, lng: 116.4074, radiusKm: 40 },
  { name: "Shenzhen", lat: 22.5431, lng: 114.0579, radiusKm: 30 },
  { name: "Guangzhou", lat: 23.1291, lng: 113.2644, radiusKm: 30 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, radiusKm: 25 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, radiusKm: 20 },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018, radiusKm: 35 },
  { name: "Jakarta", lat: -6.2088, lng: 106.8456, radiusKm: 35 },
  { name: "Manila", lat: 14.5995, lng: 120.9842, radiusKm: 30 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, radiusKm: 32 },
  { name: "Delhi", lat: 28.6139, lng: 77.209, radiusKm: 38 },
  // Oceania
  { name: "Sydney", lat: -33.8688, lng: 151.2093, radiusKm: 35 },
  { name: "Melbourne", lat: -37.8136, lng: 144.9631, radiusKm: 35 },
  { name: "Auckland", lat: -36.8485, lng: 174.7633, radiusKm: 25 },
  // Middle East
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, radiusKm: 35 },
  { name: "Tehran", lat: 35.6892, lng: 51.389, radiusKm: 35 },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, radiusKm: 35 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753, radiusKm: 35 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, radiusKm: 30 },
];

export function isInBigCity(lat: number, lng: number) {
  for (const c of BIG_CITIES) {
    const d = haversineDistanceMeters({ lat, lng }, { lat: c.lat, lng: c.lng });
    if (d <= c.radiusKm * 1000) return { match: c };
  }
  return { match: null };
}
