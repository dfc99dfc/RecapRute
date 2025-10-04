import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { isInBigCity } from "@/utils/bigCities";

export type Place = { display_name: string; lat: string; lon: string };

export default function ChooseExamCenter({ open, onOpenChange, initialCenter, initialRadiusM, hasPrevious, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCenter: { lat: number; lng: number };
  initialRadiusM: number;
  hasPrevious?: boolean;
  onConfirm: (center: { lat: number; lng: number }, radiusM: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState(Math.round(initialRadiusM / 1000) || 10);
  const [currentName, setCurrentName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSelected(null);
    const suggested = isInBigCity(initialCenter.lat, initialCenter.lng).match ? 3 : 5;
    setRadiusKm(Math.round((initialRadiusM || suggested * 1000) / 1000) || suggested);
    if (hasPrevious) {
      (async () => {
        try {
          const res = await fetch(`https://photon.komoot.io/reverse?lat=${encodeURIComponent(initialCenter.lat)}&lon=${encodeURIComponent(initialCenter.lng)}&lang=en`);
          if (res.ok) {
            const js = await res.json();
            const props = js?.features?.[0]?.properties || {};
            const city = props.city || props.town || props.village || props.name || props.state || props.country;
            setCurrentName(city ? String(city) : `${initialCenter.lat.toFixed(5)}, ${initialCenter.lng.toFixed(5)}`);
          } else {
            setCurrentName(`${initialCenter.lat.toFixed(5)}, ${initialCenter.lng.toFixed(5)}`);
          }
        } catch {
          setCurrentName(`${initialCenter.lat.toFixed(5)}, ${initialCenter.lng.toFixed(5)}`);
        }
      })();
    } else {
      setCurrentName(null);
    }
  }, [open, initialRadiusM, initialCenter, hasPrevious]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const features = Array.isArray(json.features) ? json.features : [];
        const mapped = features.map((f: any) => {
          const coords = f.geometry?.coordinates || [0,0];
          const props = f.properties || {};
          const parts = [props.name, props.city, props.state, props.country].filter(Boolean);
          return { display_name: parts.join(", "), lat: String(coords[1]), lon: String(coords[0]) } as Place;
        });
        if (mounted) setResults(mapped);
      } catch (e) {
        // ignore network aborts/errors
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [query]);

  const canConfirm = useMemo(() => !!selected || !!initialCenter, [selected, initialCenter]);

  const onOk = () => {
    const c = selected ? { lat: parseFloat(selected.lat), lng: parseFloat(selected.lon) } : initialCenter;
    const km = Math.min(15, Math.max(1, radiusKm));
    onConfirm(c, km * 1000);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!selected) return;
    const big = isInBigCity(parseFloat(selected.lat), parseFloat(selected.lon)).match;
    setRadiusKm(big ? 3 : 5);
  }, [selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose exam center</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input placeholder="Type in a city or a street" value={query} onChange={(e) => setQuery(e.target.value)} />
            {hasPrevious && currentName && (
              <div className="mt-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">Current: {currentName}</div>
            )}
            <div className="mt-2 max-h-56 overflow-auto rounded-md shadow">
              {loading && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
              {!loading && results.length === 0 && query.length >= 2 && (
                <div className="p-3 text-sm text-muted-foreground">No results</div>
              )}
              <ul>
                {results.map((r, i) => (
                  <li key={`${r.lat},${r.lon},${i}`}>
                    <button
                      className={`w-full text-left px-3 py-2 ${selected?.lat === r.lat && selected?.lon === r.lon ? 'bg-black text-white' : 'hover:bg-accent'}`}
                      onClick={() => setSelected(r)}
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Distance range</span>
              <span className="tabular-nums">{radiusKm} km</span>
            </div>
            <Slider value={[radiusKm]} onValueChange={(v) => setRadiusKm(v[0])} min={1} max={15} step={1} />
          </div>
          <div className="text-right">
            <Button variant="secondary" className="mr-2" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onOk} disabled={!canConfirm}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
