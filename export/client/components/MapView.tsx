import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, Circle } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import EditPinModal from "@/components/pins/EditPinModal";
import { DEFAULT_SPEED_RADIUS_M, SPEED_COLORS, SPEED_WEIGHTS, SPEED_LEGEND_ORDER } from "@/constants";
import { useAppState } from "@/state/AppState";
import { parseMaxSpeed, distancePointToPolylineMeters, haversineDistanceMeters } from "@/utils/mapUtils";

// Fix default icon paths for Leaflet in Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

export type RouteGeo = [number, number][];

function useOverpassMaxspeed(center = KEMI_AJOVARMA_CENTER, radius = DEFAULT_SPEED_RADIUS_M, enabled = true) {
  const [segments, setSegments] = useState<{ id: number; latlngs: [number, number][], speed?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => `rr_maxspeed_${center.lat.toFixed(3)}_${center.lng.toFixed(3)}_${radius}`, [center, radius]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled) { setSegments([]); setLoading(false); return; }
      setLoading(true);
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          const normalized = Array.isArray(parsed)
            ? parsed.map((p: any, i: number) => ({ id: p.id ?? i, latlngs: p.latlngs, speed: p.speed }))
            : [];
          if (!cancelled) setSegments(normalized);
          try { sessionStorage.setItem(key, JSON.stringify(normalized)); } catch {}
          setLoading(false);
          return;
        }
        // Fetch ALL highway ways in area; derive speed if present
        const q = `[out:json][timeout:25];(way(around:${radius},${center.lat},${center.lng})["highway"];);out geom;`;
        const endpoints = [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter",
        ];
        async function safeFetchOverpass(u: string) {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 12000);
          try {
            const res = await fetch(u, {
              mode: 'cors',
              cache: 'no-store',
              credentials: 'omit',
              redirect: 'follow',
              referrerPolicy: 'no-referrer',
              signal: ctrl.signal,
            });
            if (!res.ok) return null;
            const text = await res.text();
            try { return JSON.parse(text); } catch { return null; }
          } catch {
            return null;
          } finally {
            clearTimeout(t);
          }
        }
        let json = null as any;
        for (const ep of endpoints) {
          json = await safeFetchOverpass(`${ep}?data=${encodeURIComponent(q)}`);
          if (json) break;
        }
        if (!json) { if (!cancelled) setSegments([]); setLoading(false); return; }
        const segs: { id: number; latlngs: [number, number][], speed?: string }[] = [];
        for (const e of json.elements || []) {
          const tags = e.tags || {};
          const s = parseMaxSpeed(tags.maxspeed || tags["zone:maxspeed"] || tags["maxspeed:type"]);
          const latlngs: [number, number][] = (e.geometry || []).map((g: any) => [Number(Number(g.lat).toFixed(5)), Number(Number(g.lon).toFixed(5))]);
          if (latlngs.length >= 2) segs.push({ id: e.id, latlngs, speed: s });
        }
        if (!cancelled) {
          setSegments(segs);
          try {
            const payload = JSON.stringify(segs);
            if (payload.length < 1500000) sessionStorage.setItem(key, payload);
          } catch {}
        }
      } catch (err) {
        // swallow network errors to avoid noisy console in production
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [key, center, radius, enabled]);

  return { segments, loading };
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function createTierIcon(emoji: string, _count: number) {
  // circular badge with emoji only (no count)
  return new DivIcon({
    className: "rr-emoji-icon",
    html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:#fff;color:#000;border:2px solid #000;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.15);transform:translate(-14px,-28px);font-size:16px;line-height:1;\">${emoji}</div>`,
  });
}

function createLabelIcon(text: string) {
  return new DivIcon({
    className: "rr-emoji-icon",
    html: `<div style=\"display:inline-flex;white-space:nowrap;align-items:center;gap:4px;background:#000;color:white;padding:2px 6px;border-radius:10px;border:1px solid #000;box-shadow:0 1px 2px rgba(0,0,0,.12);transform:translate(-14px,-24px);font-size:12px;line-height:1;\">${text}</div>`,
  });
}

function createCenterIcon() {
  return new DivIcon({
    className: "rr-emoji-icon",
    html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:#fff;color:#000;border:2px solid #000;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.15);transform:translate(-14px,-28px);font-size:16px;line-height:1;\">📍</div>`,
  });
}

function RouteAnimatedOverlay({ coords }: { coords: [number, number][] }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf: number; let start = performance.now(); const period = 30000;
    const tick = (t: number) => { setProgress(((t - start) % period) / period); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [coords]);
  const total = coords.reduce((acc, _, i) => i ? acc + haversineDistanceMeters({ lat: coords[i-1][0], lng: coords[i-1][1] }, { lat: coords[i][0], lng: coords[i][1] }) : 0, 0);
  const target = total * progress;
  const head: [number, number][] = [];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i-1], b = coords[i];
    const L = haversineDistanceMeters({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    if (acc + L <= target) { head.push(a); if (i === coords.length - 1) head.push(b); acc += L; continue; }
    const remain = Math.max(0, target - acc);
    const t = L > 0 ? remain / L : 0;
    const lat = a[0] + (b[0] - a[0]) * t; const lng = a[1] + (b[1] - a[1]) * t;
    head.push(a, [lat, lng]);
    break;
  }
  return (
    <>
      <Polyline positions={coords} pathOptions={{ color: "#000000", weight: 5, opacity: 0.5 }} />
      {head.length >= 2 && <Polyline positions={head} pathOptions={{ color: "#000000", weight: 6, opacity: 1 }} />}
    </>
  );
}

export default function MapView({ onMapClickForPin }: { onMapClickForPin: (lat: number, lng: number) => void }) {
  const { speedLimitsOn, pins, pinView, user, collectPin, route, setRoute, center, rangeCenter, setRangeCenter, radiusM, deletePin } = useAppState();
  const { segments } = useOverpassMaxspeed(rangeCenter, radiusM, speedLimitsOn);

  const [speedEdits, setSpeedEdits] = useState<Record<string, string>>({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { persistence } = await import("@/utils/persistence");
        const data = await persistence.readAll();
        if (!mounted) return;
        setSpeedEdits(data.speedEdits || {});
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { persistence } = await import("@/utils/persistence");
        await persistence.savePartial({ speedEdits });
      } catch {}
    })();
  }, [speedEdits]);

  const [editAnchor, setEditAnchor] = useState<[number, number] | null>(null);
  const [editWayId, setEditWayId] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);

  const filteredPins = useMemo(() => pins, [pins]);

  return (
    <div className="relative h-full w-full">
      <MapContainer key={`${center.lat},${center.lng}`} center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {speedLimitsOn &&
          segments.map((s, idx) => {
            const wayKey = String((s as any).id ?? idx);
            const effective = (speedEdits[wayKey] ?? s.speed) as string | undefined;
            const mid = s.latlngs[Math.floor(s.latlngs.length / 2)] || s.latlngs[0];
            const dist = mid ? haversineDistanceMeters({ lat: mid[0], lng: mid[1] }, rangeCenter) : Infinity;
            const inside = Number.isFinite(dist) && dist <= radiusM;
            return (
              <React.Fragment key={wayKey}>
                <Polyline
                  key={`${wayKey}-${effective ?? "none"}`}
                  positions={s.latlngs}
                  eventHandlers={{
                    click: (e) => {
                      setEditWayId(wayKey);
                      setEditAnchor([e.latlng.lat, e.latlng.lng]);
                    },
                  }}
                  pathOptions={{
                    color: (effective && SPEED_COLORS[effective]) || "#64748b",
                    weight: (effective && SPEED_WEIGHTS[effective]) ?? SPEED_WEIGHTS["20"],
                    opacity: inside ? (effective ? 0.9 : 0.5) : 0.15,
                    className: "rr-speed-edit rr-pencil-cursor",
                  }}
                />
                {!effective && (
                  <Polyline
                    key={`${wayKey}-hit`}
                    positions={s.latlngs}
                    eventHandlers={{
                      click: (e) => {
                        setEditWayId(wayKey);
                        setEditAnchor([e.latlng.lat, e.latlng.lng]);
                      },
                    }}
                    pathOptions={{
                      color: "#000000",
                      weight: 12,
                      opacity: inside ? 0 : 0, // invisible hit area either way
                      className: "rr-speed-hit rr-pencil-cursor",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

        {editAnchor && speedLimitsOn && (
          <Popup position={editAnchor} closeOnClick={false}>
            <div className="min-w-[140px]">
              <div className="mb-2 text-sm font-medium">Set max speed</div>
              <div className="grid grid-cols-1 gap-1">
                {SPEED_LEGEND_ORDER.map((k) => (
                  <button
                    key={k}
                    className="flex items-center justify-start gap-2 rounded-md border p-1 text-sm"
                    onClick={() => {
                      if (editWayId != null) setSpeedEdits((prev) => ({ ...prev, [String(editWayId)]: k }));
                      setEditAnchor(null);
                      setEditWayId(null);
                    }}
                  >
                    <span className="inline-block w-12 rounded-full" style={{ backgroundColor: (SPEED_COLORS as any)[k], height: `${(SPEED_WEIGHTS as any)[k]}px` }} />
                    <span>{k}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-right">
                <button className="text-xs text-blue-600 underline" onClick={() => { setEditAnchor(null); setEditWayId(null); }}>Close</button>
              </div>
            </div>
          </Popup>
        )}

        <Circle center={[rangeCenter.lat, rangeCenter.lng]} radius={radiusM} pathOptions={{ color: "#22c55e", dashArray: "6 6", weight: 1, fillOpacity: 0 }} />
        <Marker position={[center.lat, center.lng]} icon={createCenterIcon() as unknown as L.Icon} />
        <Marker position={[rangeCenter.lat, rangeCenter.lng]} draggable eventHandlers={{ dragend: (e) => { const ll = (e.target as any).getLatLng(); setRangeCenter({ lat: ll.lat, lng: ll.lng }); } }} icon={new DivIcon({ className: "rr-emoji-icon", html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#22c55e;color:#fff;border:2px solid #065f46;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.2);transform:translate(-11px,-22px);font-size:12px;line-height:1;\">⬤</div>` }) as unknown as L.Icon} />
        {route?.coordinates && (
          <>
            <RouteAnimatedOverlay coords={route.coordinates.map((c) => [c[1], c[0]]) as [number, number][]} />
            {(() => {
              const coords = route.coordinates;
              const n = coords.length;
              if (n < 4) return null;
              const handleCount = Math.min(12, Math.max(4, Math.floor(n / 50)));
              const idxs: number[] = [];
              for (let i = 1; i < handleCount + 1; i++) {
                const j = Math.floor((i / (handleCount + 1)) * (n - 1));
                if (j > 0 && j < n - 1 && !idxs.includes(j)) idxs.push(j);
              }
              async function snapNearest(lng: number, lat: number): Promise<[number, number]> {
                try {
                  const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`);
                  if (res.ok) {
                    const js = await res.json();
                    const p = js?.waypoints?.[0]?.location;
                    if (Array.isArray(p) && p.length >= 2) return [p[0], p[1]];
                  }
                } catch {}
                return [lng, lat];
              }
              async function osrmRoute(vias: [number, number][]): Promise<[number, number][]> {
                const s = vias.map((c) => `${c[0]},${c[1]}`).join(";");
                const url = `https://router.project-osrm.org/route/v1/driving/${s}?alternatives=false&overview=full&geometries=geojson`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("routing failed");
                const js = await res.json();
                const r = js?.routes?.[0];
                return (r?.geometry?.coordinates ?? []) as [number, number][];
              }
              return idxs.map((idx, i) => (
                <Marker
                  key={`route-handle-${idx}`}
                  position={[coords[idx][1], coords[idx][0]]}
                  draggable
                  eventHandlers={{
                    async dragend(e) {
                      const ll = (e.target as any).getLatLng();
                      const snapped = await snapNearest(ll.lng, ll.lat);
                      const all = (route?.coordinates || []).slice();
                      // determine neighbor anchors (previous and next handle or endpoints)
                      const prevIdx = i > 0 ? idxs[i - 1] : 0;
                      const nextIdx = i < idxs.length - 1 ? idxs[i + 1] : (all.length - 1);
                      const start = all[prevIdx];
                      const end = all[nextIdx];
                      try {
                        const seg = await osrmRoute([start, snapped, end]);
                        const updated = all.slice(0, prevIdx).concat(seg, all.slice(nextIdx + 1));
                        setRoute({ coordinates: updated, durationSec: route?.durationSec, milestones: route?.milestones });
                      } catch {
                        // fallback: simple point replace
                        const fallback = all.slice();
                        fallback[idx] = snapped;
                        setRoute({ coordinates: fallback, durationSec: route?.durationSec, milestones: route?.milestones });
                      }
                    },
                  }}
                  icon={new DivIcon({ className: "rr-emoji-icon", html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#2563eb;color:#fff;border:2px solid #1e40af;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.2);transform:translate(-8px,-16px);font-size:10px;line-height:1;\"></div>` }) as unknown as L.Icon}
                />
              ));
            })()}
          </>
        )}

        {filteredPins.map((p) => {
          const icon = createTierIcon("🍄", 0);
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={icon as unknown as L.Icon}>
              <Popup>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-muted-foreground whitespace-pre-wrap break-words">{p.description}</div>
                  <div className="pt-1 flex gap-2">
                    <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingPinId(p.id)}>Edit</button>
                    <button className="rounded-md border px-2 py-1 text-xs text-red-600" onClick={() => { if (confirm('Delete this pin? This cannot be undone.')) deletePin(p.id); }}>Delete</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {route?.coordinates && pins.map((p) => {
          // Highlight tricky spots near the route regardless of view
          const d = distancePointToPolylineMeters({ lat: p.lat, lng: p.lng }, route.coordinates as [number, number][]);
          if (d > 50) return null;
          const icon = createTierIcon("🍄", 0);
          return (
            <Marker key={`route-pin-${p.id}`} position={[p.lat, p.lng]} icon={icon as unknown as L.Icon}>
              <Popup>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-muted-foreground">{p.description}</div>
                  <div className="pt-1 flex gap-2">
                    <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingPinId(p.id)}>Edit</button>
                    <button className="rounded-md border px-2 py-1 text-xs text-red-600" onClick={() => { if (confirm('Delete this pin? This cannot be undone.')) deletePin(p.id); }}>Delete</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapClickHandler onClick={onMapClickForPin} />
      </MapContainer>
      {editingPinId && (
        <EditPinModal open={!!editingPinId} onOpenChange={(v) => !v && setEditingPinId(null)} pinId={editingPinId} />
      )}
    </div>
  );
}
