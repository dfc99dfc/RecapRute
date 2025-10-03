import { useState, useCallback } from "react";
import { useAppState } from "@/state/AppState";
import { haversineDistanceMeters } from "@/utils/mapUtils";

const ORS_KEY: string | undefined = (import.meta as any)?.env?.VITE_ORS_API_KEY;
const ORS_BASE = "https://api.openrouteservice.org/ors/v2";
const OSRM_BASE = "https://router.project-osrm.org";

// Safe fetch that never throws; returns null on timeout or error
async function safeFetch(url: string, init?: RequestInit, timeoutMs = 12000): Promise<Response | null> {
  try {
    const f = fetch(url, init);
    const res = await Promise.race([
      f,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
    ]);
    if (res === "timeout") return null;
    return res as Response;
  } catch {
    return null;
  }
}

// ---------- Overpass ----------
async function fetchOverpass(q: string) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const url = `${ep}?data=${encodeURIComponent(q)}`;
      const f = fetch(url, {
        mode: "cors",
        cache: "no-store",
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      });
      const resOrTimeout = await Promise.race([
        f,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 12000)),
      ]);
      if (resOrTimeout === "timeout") continue;
      const res = resOrTimeout as Response;
      if (!res.ok) continue;
      const text = await res.text();
      try { return JSON.parse(text); } catch {}
    } catch {}
  }
  return null;
}

// ---------- Routing ----------
async function routeMulti(coordinates: [number, number][]): Promise<[number, number][]> {
  // expects [lon,lat]
  if (ORS_KEY) {
    try {
      const res = await safeFetch(`${ORS_BASE}/directions/driving-car/geojson`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: ORS_KEY },
        body: JSON.stringify({ coordinates }),
      });
      if (res?.ok) {
        const js = await res.json();
        const feat = js?.features?.[0];
        const coords = feat?.geometry?.coordinates as [number, number][] | undefined;
        if (coords) return coords;
      }
    } catch {}
  }
  const coordsStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${coordsStr}?alternatives=false&overview=full&geometries=geojson`;
  const res = await safeFetch(url);
  if (!res || !res.ok) throw new Error("routing failed");
  const js = await res.json();
  const r = js?.routes?.[0];
  if (!r) throw new Error("no route");
  return r.geometry.coordinates as [number, number][];
}

// ---------- Residential network helpers ----------
async function fetchResidentialPoints(center: { lat: number; lng: number }, radiusM: number): Promise<[number, number][]> {
  const q = `[out:json][timeout:25];(way(around:${radiusM},${center.lat},${center.lng})[highway~"residential|living_street"];);out geom;`;
  const js = await fetchOverpass(q);
  if (!js || !Array.isArray(js.elements)) return [];
  const pts: [number, number][] = [];
  for (const e of js.elements) {
    if (!Array.isArray(e.geometry) || e.geometry.length < 2) continue;
    let acc = 0;
    for (let i = 1; i < e.geometry.length; i++) {
      const a = e.geometry[i - 1];
      const b = e.geometry[i];
      acc += haversineDistanceMeters({ lat: a.lat, lng: a.lon }, { lat: b.lat, lng: b.lon });
      if (acc >= 250) { // sample roughly every 250m
        acc = 0;
        const g = Math.random() < 0.5 ? a : b;
        pts.push([g.lon, g.lat]);
      }
    }
  }
  return pts;
}

function selectResidentialRingPoints(center: { lat: number; lng: number }, candidates: [number, number][], radiusM: number, sectors = 8) {
  const lat0 = center.lat * Math.PI / 180;
  const innerR = Math.max(300, radiusM * 0.8);
  const minR = Math.max(150, radiusM * 0.35);
  const chosen: [number, number][] = [];
  for (let s = 0; s < sectors; s++) {
    const theta = (2 * Math.PI * s) / sectors;
    let best: { p: [number, number]; dist: number } | null = null;
    for (const c of candidates) {
      const dx = (c[0] - center.lng) * Math.cos(lat0);
      const dy = (c[1] - center.lat);
      const ang = Math.atan2(dy, dx);
      let dAng = Math.abs(((ang - theta + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (dAng > Math.PI / sectors) continue; // keep roughly in sector
      const dist = haversineDistanceMeters({ lat: center.lat, lng: center.lng }, { lat: c[1], lng: c[0] });
      if (dist < minR || dist > innerR) continue;
      if (!best || dist > best.dist) best = { p: c, dist };
    }
    if (best) {
      if (!chosen.some((q) => haversineDistanceMeters({ lat: q[1], lng: q[0] }, { lat: best!.p[1], lng: best!.p[0] }) < 80)) {
        chosen.push(best.p);
      }
    }
  }
  if (chosen.length < 3) {
    const pool = candidates.filter((c) => {
      const d = haversineDistanceMeters({ lat: center.lat, lng: center.lng }, { lat: c[1], lng: c[0] });
      return d >= minR && d <= innerR;
    });
    while (chosen.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      const p = pool.splice(i, 1)[0];
      if (!chosen.some((q) => haversineDistanceMeters({ lat: q[1], lng: q[0] }, { lat: p[1], lng: p[0] }) < 80)) chosen.push(p);
    }
  }
  return chosen;
}

async function buildResidentialLoop(center: { lat: number; lng: number }, radiusM: number): Promise<[number, number][] | null> {
  const candidates = await fetchResidentialPoints(center, radiusM);
  if (!candidates.length) return null;
  for (const scale of [0.8, 0.7, 0.6]) {
    const ring = selectResidentialRingPoints(center, candidates, radiusM * scale, 8);
    if (ring.length < 3) continue;
    const coords: [number, number][] = [[center.lng, center.lat], ...ring, [center.lng, center.lat]];
    try {
      const rc = await routeMulti(coords);
      const out = rc.some(([lon, lat]) => haversineDistanceMeters({ lat, lng: lon }, center) > radiusM + 30);
      if (!out) return rc;
    } catch {}
  }
  return null;
}

export function useRouteSimulation() {
  const { center, rangeCenter, radiusM, setRoute, speedLimitsOn, setSpeedLimitsOn } = useAppState();
  const [loading, setLoading] = useState(false);

  const simulate = useCallback(async () => {
    if (loading) return;
    if (speedLimitsOn) setSpeedLimitsOn(false);
    setLoading(true);
    try {
      const areaCenter = rangeCenter || center;
      const rc = await buildResidentialLoop(areaCenter, radiusM);
      if (rc && rc.length >= 2) {
        setRoute({ coordinates: rc });
      } else {
        setRoute(null);
      }
    } catch (e) {
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [center, rangeCenter, radiusM, setRoute, loading, speedLimitsOn, setSpeedLimitsOn]);

  return { loading, simulate } as const;
}

export default function RouteSimulator() {
  return null;
}
