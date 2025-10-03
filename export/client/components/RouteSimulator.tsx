import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SIM_ROUTE_RADIUS_M } from "@/constants"; // default, but we will use user radius when available
import { useAppState } from "@/state/AppState";
import { distancePointToPolylineMeters, haversineDistanceMeters } from "@/utils/mapUtils";

const ORS_KEY: string | undefined = (import.meta as any)?.env?.VITE_ORS_API_KEY;
const ORS_BASE = "https://api.openrouteservice.org/ors/v2";
const OSRM_BASE = "https://router.project-osrm.org";
const TARGET_SEC = 50 * 60;

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

// ---------- Overpass utilities ----------
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
      f.catch(() => {});
      const resOrTimeout = await Promise.race([
        f,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 12000)),
      ]);
      if (resOrTimeout === "timeout") continue;
      const res = resOrTimeout as Response;
      if (!res.ok) continue;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {}
    } catch {
      // continue to next endpoint
    }
  }
  return null;
}

type Candidate = { coord: [number, number]; kind: "residential" | "motorway_trunk" | "arterial" };

type Segment = [number, number][]; // polyline of [lon,lat]

async function fetchAvoidSegments(center: { lat: number; lng: number }, radius: number): Promise<Segment[]> {
  const q = `[out:json][timeout:25];(
    way(around:${radius},${center.lat},${center.lng})[landuse="forest"];
    way(around:${radius},${center.lat},${center.lng})[natural="wood"];
  );out geom;`;
  const js = await fetchOverpass(q);
  if (!js || !Array.isArray(js.elements)) return [];
  const segs: Segment[] = [];
  for (const e of js.elements) {
    if (e.type === "way" && Array.isArray(e.geometry) && e.geometry.length >= 2) {
      segs.push(e.geometry.map((g: any) => [g.lon, g.lat] as [number, number]));
    }
  }
  return segs;
}

async function fetchHighwaySegments(center: { lat: number; lng: number }, radius: number): Promise<Segment[]> {
  const q = `[out:json][timeout:25];(way(around:${radius},${center.lat},${center.lng})[highway~"motorway|trunk"];);out geom;`;
  const js = await fetchOverpass(q);
  if (!js || !Array.isArray(js.elements)) return [];
  const segs: Segment[] = [];
  for (const e of js.elements) {
    if (e.type === "way" && Array.isArray(e.geometry) && e.geometry.length >= 2) {
      segs.push(e.geometry.map((g: any) => [g.lon, g.lat] as [number, number]));
    }
  }
  return segs;
}

function nearAny(pt: [number, number], segs: Segment[], thresholdM = 60): boolean {
  for (const s of segs) {
    const d = distancePointToPolylineMeters({ lat: pt[1], lng: pt[0] }, s);
    if (d <= thresholdM) return true;
  }
  return false;
}

async function buildCandidates(center: { lat: number; lng: number }, radius = SIM_ROUTE_RADIUS_M) {
  const highwayQ = `[out:json][timeout:25];(
    way(around:${radius},${center.lat},${center.lng})[highway~"residential|living_street|trunk|motorway"];);
    out geom tags;`;
  const avoidQ = `[out:json][timeout:25];(
    way(around:${radius},${center.lat},${center.lng})[landuse~"forest|grass"];
    way(around:${radius},${center.lat},${center.lng})[natural~"wood|water"];
    way(around:${radius},${center.lat},${center.lng})[water];
  );out geom;`;
  const [hjson, ajson] = await Promise.all([fetchOverpass(highwayQ), fetchOverpass(avoidQ)]);
  const badPolys: [number, number][][] = Array.isArray(ajson?.elements)
    ? ajson.elements.filter((e: any) => e.type === "way" && Array.isArray(e.geometry)).map((w: any) => w.geometry.map((g: any) => [g.lon, g.lat]))
    : [];

  const cands: Candidate[] = [];
  if (Array.isArray(hjson?.elements)) {
    for (const w of hjson.elements) {
      if (w.type !== "way" || !Array.isArray(w.geometry)) continue;
      const hw: string = w.tags?.highway || "";
      const kind: Candidate["kind"] = /^(residential|living_street)$/.test(hw)
        ? "residential"
        : /^(motorway|trunk)$/.test(hw)
        ? "motorway_trunk"
        : "arterial"; // primary/secondary/tertiary
      // sample points along way geometry (every ~400-600m)
      let acc = 0;
      for (let i = 1; i < w.geometry.length; i++) {
        const a = w.geometry[i - 1];
        const b = w.geometry[i];
        acc += haversineDistanceMeters({ lat: a.lat, lng: a.lon }, { lat: b.lat, lng: b.lon });
        if (acc >= 500) {
          acc = 0;
          const g = Math.random() < 0.5 ? a : b;
          const pt: [number, number] = [g.lon, g.lat];
          // filter out near forbidden landuse/natural/water
          let nearBad = false;
          for (const poly of badPolys) {
            if (distancePointToPolylineMeters({ lat: pt[1], lng: pt[0] }, poly) <= 80) { nearBad = true; break; }
          }
          if (!nearBad) cands.push({ coord: pt, kind });
        }
      }
    }
  }
  return cands;
}

// ---------- ORS/OSRM helpers ----------
async function snapPoint([lon, lat]: [number, number]): Promise<[number, number]> {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return [lon, lat];
  if (ORS_KEY) {
    try {
      const res = await safeFetch(`${ORS_BASE}/snap/driving-car`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: ORS_KEY },
        body: JSON.stringify({ locations: [[lon, lat]], radius: 200 }),
      });
      if (res?.ok) {
        const js = await res.json();
        const snapped: [number, number] | undefined = js?.snappedPoints?.[0]?.location;
        if (snapped) return snapped;
      }
    } catch {}
  }
  // Fallback OSRM nearest
  try {
    const res = await safeFetch(`${OSRM_BASE}/nearest/v1/driving/${lon},${lat}`);
    if (res?.ok) {
      const js = await res.json();
      const p = js?.waypoints?.[0]?.location;
      if (Array.isArray(p) && p.length >= 2) return [p[0], p[1]];
    }
  } catch {}
  return [lon, lat];
}

async function routeMulti(coordinates: [number, number][]): Promise<{ coords: [number, number][], durationSec: number }> {
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
        const dur = feat?.properties?.summary?.duration as number | undefined;
        if (coords && typeof dur === "number") return { coords, durationSec: dur };
      }
    } catch {}
  }
  // Fallback OSRM
  const coordsStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${coordsStr}?alternatives=false&overview=full&geometries=geojson`;
  const res = await safeFetch(url);
  if (!res || !res.ok) throw new Error("routing failed");
  const js = await res.json();
  const r = js?.routes?.[0];
  if (!r) throw new Error("no route");
  return { coords: r.geometry.coordinates as [number, number][], durationSec: r.duration as number };
}

function milestonesEvery10m(routeCoords: [number, number][], totalDurationSec: number) {
  const marks: { timeSec: number; coord: [number, number] }[] = [];
  if (!routeCoords.length || !Number.isFinite(totalDurationSec) || totalDurationSec <= 0) return marks;
  const totalLen = polylineLength(routeCoords);
  if (totalLen <= 0) return marks;
  const speed = totalLen / totalDurationSec; // m/s
  let nextT = 600;
  while (nextT < totalDurationSec) {
    const targetDist = speed * nextT;
    const coord = pointAtDistance(routeCoords, targetDist);
    if (coord) marks.push({ timeSec: nextT, coord });
    nextT += 600;
  }
  return marks;
}

function polylineLength(poly: [number, number][]) {
  let L = 0;
  for (let i = 1; i < poly.length; i++) {
    L += haversineDistanceMeters({ lat: poly[i - 1][1], lng: poly[i - 1][0] }, { lat: poly[i][1], lng: poly[i][0] });
  }
  return L;
}

function pointAtDistance(poly: [number, number][], d: number): [number, number] | null {
  if (poly.length < 2) return null;
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = haversineDistanceMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
    if (acc + seg >= d) {
      const t = Math.max(0, Math.min(1, (d - acc) / seg));
      const lon = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      return [lon, lat];
    }
    acc += seg;
  }
  return poly[poly.length - 1];
}

function coveredMetersAgainstSegs(coords: [number, number][], segs: Segment[], thresholdM = 35): number {
  if (!coords.length || !segs.length) return 0;
  let covered = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let close = false;
    for (const s of segs) {
      const d = distancePointToPolylineMeters({ lat: mid[1], lng: mid[0] }, s);
      if (d <= thresholdM) { close = true; break; }
    }
    if (close) covered += haversineDistanceMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
  }
  return covered;
}

function pickWaypoints(cands: Candidate[], n: number) {
  const res: Candidate[] = [];
  const residential = cands.filter((c) => c.kind === "residential");
  const motor = cands.filter((c) => c.kind === "motorway_trunk");
  const rest = cands.filter((c) => c.kind !== "residential" && c.kind !== "motorway_trunk");
  if (motor.length) res.push(motor[Math.floor(Math.random() * motor.length)]);
  if (residential.length) res.push(residential[Math.floor(Math.random() * residential.length)]);
  while (res.length < n) {
    const pool = [...motor, ...residential, ...rest];
    if (!pool.length) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!res.some((r) => r.coord[0] === pick.coord[0] && r.coord[1] === pick.coord[1])) res.push(pick);
  }
  return Array.from(new Set(res.map((r) => JSON.stringify(r)))).map((s) => JSON.parse(s) as Candidate);
}

async function buildRoadLoopWithinRadius(examCenter: { lat: number; lng: number }, radiusM: number, targetSec = TARGET_SEC, avoidSegs?: Segment[], ringCenter?: { lat: number; lng: number }) {
  // Build a ring of snapped via-points inside the circle, then multi-stop route over roads
  const innerR = Math.max(400, Math.floor(radiusM * 0.8));
  const center = ringCenter ?? examCenter;
  // try multiple densities and phase offsets
  for (const K of [8, 10, 12]) {
    const phase = Math.random() * Math.PI * 2;
    const ring: [number, number][] = [];
    for (let i = 0; i < K; i++) {
      const theta = phase + (2 * Math.PI * i) / K;
      const dx = (innerR * Math.cos(theta)) / (111320 * Math.cos((center.lat * Math.PI) / 180));
      const dy = innerR * Math.sin(theta) / 111320;
      const guess: [number, number] = [center.lng + dx, center.lat + dy];
      // snap each guess to nearest road
      const s = await snapPoint(guess);
      if (haversineDistanceMeters({ lat: s[1], lng: s[0] }, center) <= radiusM && !(avoidSegs && nearAny(s, avoidSegs))) ring.push(s);
    }
    // remove near-duplicates
    const uniq: [number, number][] = [];
    for (const p of ring) {
      if (!uniq.some((q) => haversineDistanceMeters({ lat: p[1], lng: p[0] }, { lat: q[1], lng: q[0] }) < 50)) uniq.push(p);
    }
    if (uniq.length < 3) continue;
    const coords: [number, number][] = [[examCenter.lng, examCenter.lat], ...uniq, [examCenter.lng, examCenter.lat]];
    try {
      const { coords: rc, durationSec } = await routeMulti(coords);
      const outOfRange = rc.some(([lon, lat]) => haversineDistanceMeters({ lat, lng: lon }, center) > radiusM);
      if (!outOfRange) {
        // If too short, try repeating ring to approach target
        let finalCoords = rc;
        if (durationSec < targetSec * 0.85) {
          const repeatCoords: [number, number][] = [[center.lng, center.lat], ...uniq, ...uniq, [center.lng, center.lat]];
          const r2 = await routeMulti(repeatCoords);
          const out2 = r2.coords.some(([lon, lat]) => haversineDistanceMeters({ lat, lng: lon }, center) > radiusM);
          if (!out2) finalCoords = r2.coords;
        }
        const dur = Math.max(durationSec, targetSec * 0.85);
        const milestones = milestonesEvery10m(finalCoords, dur);
        return { coordinates: finalCoords, durationSec: dur, milestones };
      }
    } catch {}
  }
  return null;
}

export function useRouteSimulation() {
  const { center, rangeCenter, radiusM, setRoute, route, speedLimitsOn, setSpeedLimitsOn } = useAppState();
  const [loading, setLoading] = useState(false);

  const simulate = useCallback(async () => {
    if (loading) return;
    if (speedLimitsOn) setSpeedLimitsOn(false);
    setLoading(true);
    try {
      // 0) Fetch avoid areas (forest/wood) polygons once
      const areaCenter = rangeCenter || center;
      const avoidSegs = await fetchAvoidSegments(areaCenter, radiusM);
      const highwaySegs = await fetchHighwaySegments(areaCenter, radiusM);
      // 1) Overpass: build candidate set within a shrunken working radius to keep final route inside the user circle
      const workR = Math.max(500, Math.floor(radiusM * 0.85));
      const candidates = await buildCandidates(areaCenter, workR);
      let success = false;

      // 2-3) Try 5 attempts with N=2-3 waypoints (snap each), then directions
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        const n = 2 + Math.floor(Math.random() * 2); // 2 or 3
        const picks = pickWaypoints(candidates, n);
        const needMotor = true;
        const okTypes = picks.some((c) => c.kind === "motorway_trunk");
        if (picks.length < 2 || !picks.some((c) => c.kind === "residential") || !okTypes) {
          continue;
        }
        const allowR = Math.max(300, radiusM * 0.85);
        const snapped: [number, number][] = [];
        for (const p of picks) {
          const s = await snapPoint(p.coord);
          // ensure snapped point stays clearly within the circle and outside forest
          if (haversineDistanceMeters({ lat: s[1], lng: s[0] }, areaCenter) > allowR) { continue; }
          if (nearAny(s, avoidSegs)) { continue; }
          snapped.push(s);
        }
        if (snapped.length < 2) { continue; }
        const mid = Math.floor(snapped.length / 2);
        const coords: [number, number][] = [[center.lng, center.lat], ...snapped.slice(0, mid), [center.lng, center.lat], ...snapped.slice(mid), [center.lng, center.lat]];
        try {
          const { coords: routeCoords, durationSec } = await routeMulti(coords);
          const outOfRange = routeCoords.some(([lon, lat]) => haversineDistanceMeters({ lat, lng: lon }, areaCenter) > radiusM);
          const hitsForest = avoidSegs.length ? routeCoords.some((c) => nearAny(c, avoidSegs)) : false;
          const highwayMeters = coveredMetersAgainstSegs(routeCoords, highwaySegs, 45);
          const smallRange = radiusM < 6000;
          if (!outOfRange && !hitsForest && highwayMeters >= 500 && (
              (smallRange && durationSec >= TARGET_SEC * 0.6) ||
              (!smallRange && durationSec >= TARGET_SEC * 0.9 && durationSec <= TARGET_SEC * 1.1)
            )) {
            const milestones = milestonesEvery10m(routeCoords, durationSec);
            const visCoords: [number, number][] = [];
            visCoords.push([center.lng, center.lat]);
            for (const c of routeCoords) visCoords.push(c);
            visCoords.push([center.lng, center.lat]);
            setRoute({ coordinates: visCoords, durationSec, milestones });
            success = true;
            break;
          }
          // If out-of-range, densify by inserting extra interior points and retry in this attempt
          if (outOfRange) {
            const extraPts: [number, number][] = [];
            for (let i = 0; i < 2; i++) {
              const ang = Math.random() * Math.PI * 2;
              const r = (allowR * (0.6 + Math.random() * 0.2));
              const dx = (r * Math.cos(ang)) / (111320 * Math.cos((areaCenter.lat * Math.PI) / 180));
              const dy = r * Math.sin(ang) / 111320;
              const s = await snapPoint([areaCenter.lng + dx, areaCenter.lat + dy]);
              if (haversineDistanceMeters({ lat: s[1], lng: s[0] }, areaCenter) <= allowR && !nearAny(s, avoidSegs)) extraPts.push(s);
            }
            const coords2: [number, number][] = [[center.lng, center.lat], ...snapped, ...extraPts, [center.lng, center.lat]];
            try {
              const r2 = await routeMulti(coords2);
              const out2 = r2.coords.some(([lon, lat]) => haversineDistanceMeters({ lat, lng: lon }, areaCenter) > radiusM);
              const h2 = coveredMetersAgainstSegs(r2.coords, highwaySegs, 45);
              if (!out2 && h2 >= 500 && r2.durationSec >= TARGET_SEC * 0.85 && r2.durationSec <= TARGET_SEC * 1.15) {
                const ms = milestonesEvery10m(r2.coords, r2.durationSec);
                const visCoords: [number, number][] = [];
                visCoords.push([center.lng, center.lat]);
                for (const c of r2.coords) visCoords.push(c);
                visCoords.push([center.lng, center.lat]);
                setRoute({ coordinates: visCoords, durationSec: r2.durationSec, milestones: ms });
                success = true;
                break;
              }
            } catch {}
          }
        } catch {}
      }

      // 4) Fallback synthetic loop
      if (!success) {
        const roadLoop = await buildRoadLoopWithinRadius(center, Math.max(400, Math.floor(radiusM * 0.85)), TARGET_SEC, avoidSegs, areaCenter);
        if (roadLoop) {
          const visCoords: [number, number][] = [];
          visCoords.push([center.lng, center.lat]);
          for (const c of roadLoop.coordinates) visCoords.push(c);
          visCoords.push([center.lng, center.lat]);
          setRoute({ ...roadLoop, coordinates: visCoords });
        } else {
          setRoute(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [center, rangeCenter, radiusM, setRoute, route, speedLimitsOn, setSpeedLimitsOn]);

  return { loading, simulate } as const;
}

export default function RouteSimulator() {
  // legacy component no longer renders a button in bottom bar
  return null;
}
