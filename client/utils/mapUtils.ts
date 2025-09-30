import { SIM_ROUTE_RADIUS_M } from "@/constants";

export function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000; // Earth radius
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
  return R * c;
}

export function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}

export function randomPointInRadius(center: { lat: number; lng: number }, radiusMeters = SIM_ROUTE_RADIUS_M) {
  // https://gis.stackexchange.com/a/25822
  const y0 = center.lat;
  const x0 = center.lng;
  const rd = radiusMeters / 111300; // about
  const u = Math.random();
  const v = Math.random();
  const w = rd * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  const newX = x / Math.cos((y0 * Math.PI) / 180);
  return { lat: y + y0, lng: newX + x0 };
}

export function tierLabel(collects: number) {
  if (collects > 100) return "🔮 crystal";
  if (collects > 50) return "🦄 unicorn";
  if (collects > 10) return "🐚 shell";
  return "🍄 mushroom";
}

export function tierEmoji(collects: number) {
  if (collects > 100) return "🔮";
  if (collects > 50) return "🦄";
  if (collects > 10) return "🐚";
  return "🍄";
}

export function parseMaxSpeed(value?: string | number) {
  if (value == null) return undefined;
  const s = String(value).toLowerCase();
  const match = s.match(/(\d{2,3})/);
  if (!match) return undefined;
  return match[1];
}

export function distancePointToPolylineMeters(p: { lat: number; lng: number }, poly: [number, number][]) {
  if (poly.length < 2) return Infinity;
  // Equirectangular approximation around p
  const R = 6371000;
  const lat0 = deg2rad(p.lat);
  const px = deg2rad(p.lng) * Math.cos(lat0) * R;
  const py = lat0 * R;
  let best = Infinity;
  let prev: [number, number] | null = null;
  for (const coord of poly) {
    const lon = coord[0];
    const lat = coord[1];
    const x = deg2rad(lon) * Math.cos(lat0) * R;
    const y = deg2rad(lat) * R;
    if (prev) {
      const [x1, y1] = prev;
      const [x2, y2] = [x, y];
      const vx = x2 - x1;
      const vy = y2 - y1;
      const wx = px - x1;
      const wy = py - y1;
      const c1 = vx * wx + vy * wy;
      const c2 = vx * vx + vy * vy;
      let t = c2 > 0 ? c1 / c2 : 0;
      t = Math.max(0, Math.min(1, t));
      const projx = x1 + t * vx;
      const projy = y1 + t * vy;
      const dx = px - projx;
      const dy = py - projy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
    prev = [x, y];
  }
  return best;
}
