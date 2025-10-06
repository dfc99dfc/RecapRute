import { useEffect, useState } from "react";
import MapView from "@/components/MapView";
import PinModal from "@/components/PinModal";
import RouteSimulator, { useRouteSimulation } from "@/components/RouteSimulator";
// Login removed
import { AppStateProvider, useAppState } from "@/state/AppState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { KEMI_AJOVARMA_CENTER, SPEED_COLORS, SPEED_WEIGHTS, SPEED_LEGEND_ORDER_EXTENDED } from "@/constants";
import ExportImportButtons from "@/components/export-import/ExportImportButtons";
import { isInBigCity } from "@/utils/bigCities";
import ChooseExamCenter from "@/components/center/ChooseExamCenter";
import MyRoutesSheet from "@/components/routes/MyRoutesSheet";
import MindsetSheet from "@/components/mind/MindsetSheet";
import { useIsMobile } from "@/hooks/use-mobile";

function HeaderBar() {
  const { route, saveCurrentRoute, setRoute } = useAppState();
  const { loading, simulate } = useRouteSimulation();
  const [dots, setDots] = useState(1);
  useEffect(() => {
    if (!loading) { setDots(1); return; }
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, [loading]);
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-[1000] h-14">
      <div className="pointer-events-auto absolute right-3 top-2 flex flex-col items-end gap-2">
        <ExportImportButtons />
        <div className="md:hidden flex flex-col items-end gap-2">
          {route?.coordinates && (
            <Button size="sm" className="w-auto" variant="outline" onClick={() => setRoute(null)}>🧹 Clear route</Button>
          )}
          {loading && (
            <div className="text-[11px] text-muted-foreground max-w-[16rem] leading-snug text-right">Might take minutes</div>
          )}
          <Button size="sm" className="w-auto bg-black text-white hover:bg-black/90" disabled={loading} onClick={() => { if (route?.coordinates) { saveCurrentRoute(); } else { if (!loading) simulate(); } }}>
            {route?.coordinates ? "💾 Save this route" : (loading ? `Route generating${".".repeat(dots)}` : "🛣️ Simulate exam route")}
          </Button>
          <Button size="sm" className="w-auto" variant="outline" onClick={() => {
            const evt = new CustomEvent('open-my-routes');
            window.dispatchEvent(evt);
          }}>🗂️ My routes</Button>
        </div>
      </div>
    </div>
  );
}

function BottomBar() {
  const isMobile = useIsMobile();
  const { speedLimitsOn, setSpeedLimitsOn, speedVisibility, setSpeedVisibility, setCityLightMode, setPlacingMode, center, radiusM, setCenterAndRadius, hasCenter, setHasCenter, setRoute } = useAppState();
  const [mindOpen, setMindOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);

  useEffect(() => {
    if (!hasCenter) setChooseOpen(true);
  }, [hasCenter]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] mb-3 flex items-end justify-center">
      {!isMobile && (
        <div className="pointer-events-auto absolute left-3 bottom-3 z-[1000] flex flex-col items-start gap-2">
          {speedLimitsOn && (
            <div className="text-[11px] text-muted-foreground max-w-[16rem] leading-snug">
              <div>click on the road to edit max speed</div>
              <div>click each speed bar to switch on/off</div>
            </div>
          )}
          {speedLimitsOn && (
            <div className="w-32 rounded-lg bg-white/90 p-2 shadow">
              {(SPEED_LEGEND_ORDER_EXTENDED as readonly string[]).map((k) => {
                const on = speedVisibility[k] !== false;
                return (
                  <button key={k} className={`flex w-full items-center justify-between py-1 ${on ? '' : 'opacity-30'}`} onClick={() => setSpeedVisibility({ ...speedVisibility, [k]: !on })}>
                    <span className="mr-2 inline-block w-16 rounded-full" style={{ backgroundColor: (SPEED_COLORS as any)[k], height: `${(SPEED_WEIGHTS as any)[k]}px` }} />
                    <span className="text-sm tabular-nums">{k}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="inline-flex w-auto whitespace-nowrap items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow">
            <span className="text-sm">speed limit</span>
            <Switch checked={speedLimitsOn} onCheckedChange={setSpeedLimitsOn} />
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-3 px-3">
          <Button className="h-14 text-base" variant="outline" onClick={() => setChooseOpen(true)}>📍 Choose exam center</Button>
          <Button className="h-14 text-base bg-[#22c55e] text-white border border-[#065f46] hover:bg-[#1fb153]" onClick={() => setPlacingMode(true)}>➕ Mark tricky spot</Button>
          <Button className="h-14 text-base" variant="outline" onClick={() => setMindOpen(true)}>💆 Mindset massage</Button>
        </div>
      )}
      {isMobile && (
        <div className="pointer-events-auto absolute left-3 bottom-3 z-[1000] flex flex-col items-start gap-2">
          {speedLimitsOn && (
            <div className="text-[11px] text-muted-foreground max-w-[16rem] leading-snug">
              <div>click on the road to edit max speed</div>
              <div>click each speed bar to switch on/off</div>
            </div>
          )}
          {speedLimitsOn && (
            <div className="w-32 rounded-lg bg-white/90 p-2 shadow">
              {(SPEED_LEGEND_ORDER_EXTENDED as readonly string[]).map((k) => {
                const on = speedVisibility[k] !== false;
                return (
                  <button key={k} className={`flex w-full items-center justify-between py-1 ${on ? '' : 'opacity-30'}`} onClick={() => setSpeedVisibility({ ...speedVisibility, [k]: !on })}>
                    <span className="mr-2 inline-block w-16 rounded-full" style={{ backgroundColor: (SPEED_COLORS as any)[k], height: `${(SPEED_WEIGHTS as any)[k]}px` }} />
                    <span className="text-sm tabular-nums">{k}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="inline-flex w-auto whitespace-nowrap items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow">
            <span className="text-sm">speed limit</span>
            <Switch checked={speedLimitsOn} onCheckedChange={setSpeedLimitsOn} />
          </div>

          <Button size="sm" variant="outline" onClick={() => setChooseOpen(true)}>📍 Choose exam center</Button>
          <Button size="sm" className="bg-[#22c55e] text-white border border-[#065f46] hover:bg-[#1fb153]" onClick={() => setPlacingMode(true)}>➕ Mark tricky spot</Button>
          <Button size="sm" variant="outline" onClick={() => setMindOpen(true)}>💆 Mindset massage</Button>
        </div>
      )}

      <MindsetSheet open={mindOpen} onOpenChange={setMindOpen} />

      <ChooseExamCenter
        open={chooseOpen}
        onOpenChange={setChooseOpen}
        initialCenter={center}
        initialRadiusM={hasCenter ? radiusM : (isInBigCity(center.lat, center.lng).match ? 3000 : 5000)}
        hasPrevious={hasCenter}
        onConfirm={(c, r) => {
          setCenterAndRadius(c, r);
          const big = isInBigCity(c.lat, c.lng).match;
          if (big) {
            setCityLightMode(true);
            const vis: Record<string, boolean> = {};
            for (const k of SPEED_LEGEND_ORDER_EXTENDED as readonly string[]) vis[k] = false;
            vis["50"] = true;
            vis["30"] = true;
            setSpeedVisibility(vis);
          } else {
            setCityLightMode(false);
            const vis: Record<string, boolean> = {};
            for (const k of SPEED_LEGEND_ORDER_EXTENDED as readonly string[]) vis[k] = true;
            setSpeedVisibility(vis);
          }
          setHasCenter(true);
          setRoute(null);
        }}
      />
    </div>
  );
}

function MapScene() {
  const { placingMode, setPlacingMode, route, saveCurrentRoute, setRoute } = useAppState();
  const { loading, simulate } = useRouteSimulation();
  const [dots, setDots] = useState(1);
  const [pinModal, setPinModal] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [routesOpen, setRoutesOpen] = useState(false);

  const handleMapClick = (la: number, ln: number) => {
    if (!placingMode) return;
    setLat(la);
    setLng(ln);
    setPinModal(true);
    setPlacingMode(false);
  };

  useEffect(() => {
    // Center hint on first load
  }, []);

  useEffect(() => {
    if (!loading) { setDots(1); return; }
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const onOpen = () => setRoutesOpen(true);
    window.addEventListener('open-my-routes', onOpen as any);
    return () => window.removeEventListener('open-my-routes', onOpen as any);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full">
      <MapView onMapClickForPin={handleMapClick} />
      <HeaderBar />
      <BottomBar />
      <div className="pointer-events-none absolute right-3 top-1/2 z-[1000] -translate-y-1/2 hidden md:block">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {route?.coordinates && (
            <Button className="h-12 w-auto text-base" variant="outline" onClick={() => setRoute(null)}>🧹 Clear route</Button>
          )}
          {loading && (
            <div className="text-[11px] text-muted-foreground max-w-[16rem] leading-snug text-right">Might take minutes</div>
          )}
          <Button className="h-12 w-auto px-3 text-base bg-black text-white hover:bg-black/90" disabled={loading} onClick={() => { if (route?.coordinates) { saveCurrentRoute(); } else { if (!loading) simulate(); } }}>
            {route?.coordinates ? "💾 Save this route" : (loading ? `Route generating${".".repeat(dots)}` : "🛣️ Simulate exam route")}
          </Button>
          <Button className="h-12 w-auto px-3 text-base" variant="outline" onClick={() => setRoutesOpen(true)}>🗂️ My routes</Button>
        </div>
      </div>


      {placingMode && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-start justify-center p-3">
          <div className="mt-16 rounded-full bg-white/90 px-4 py-2 text-sm shadow">Tap the map to place your pin</div>
        </div>
      )}
      <PinModal open={pinModal} onOpenChange={setPinModal} lat={lat} lng={lng} />
      <MyRoutesSheet open={routesOpen} onOpenChange={setRoutesOpen} />
    </div>
  );
}

export default function Index() {
  return (
    <AppStateProvider>
      <MapScene />
      <div className="hidden" aria-hidden>
        {/* Hidden preloads / SEO hints */}
        <span>{KEMI_AJOVARMA_CENTER.lat}</span>
      </div>
    </AppStateProvider>
  );
}
