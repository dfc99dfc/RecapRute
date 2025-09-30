import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { persistence, type StorageData } from "@/utils/persistence";

export type User = {
  id: string;
  name: string;
  avatarColor: string; // simple colored circle avatar
};

export type PinType =
  | "hidden-speed-sign"
  | "tricky-intersection"
  | "roundabout"
  | "lane-rules"
  | "police-check";

export const PIN_TYPE_LABELS: Record<PinType, string> = {
  "hidden-speed-sign": "Hidden speed sign",
  "tricky-intersection": "Tricky intersection",
  "roundabout": "Roundabout",
  "lane-rules": "Lane rules",
  "police-check": "Police check",
};

export const PIN_TYPE_EMOJI: Record<PinType, string> = {
  "hidden-speed-sign": "🔮",
  "tricky-intersection": "🍄",
  "roundabout": "🦄",
  "lane-rules": "🐚",
  "police-check": "🚨",
};

export type PinVisibility = "public" | "private";

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  type: PinType;
  visibility: PinVisibility;
  createdAt: string; // ISO
  ownerId: string;
  ownerName: string;
  collects: number;
  collectedBy: string[]; // user ids
};

export type RouteShape = { coordinates: [number, number][]; durationSec?: number; milestones?: { timeSec: number; coord: [number, number] }[] } | null;
export type SavedRoute = { id: string; createdAt: string; route: RouteShape };

export type AppStateShape = {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;

  pins: Pin[];
  addPin: (p: Omit<Pin, "id" | "createdAt" | "ownerId" | "ownerName" | "collects" | "collectedBy">) => void;
  collectPin: (pinId: string) => void;
  setPinVisibility: (pinId: string, visibility: PinVisibility) => void;
  updatePin: (pinId: string, data: Partial<Omit<Pin, "id" | "createdAt" | "ownerId" | "ownerName" | "collectedBy" | "collects">>) => void;
  deletePin: (pinId: string) => void;

  pinView: "my" | "public";
  setPinView: (v: "my" | "public") => void;

  speedLimitsOn: boolean;
  setSpeedLimitsOn: (v: boolean) => void;

  placingMode: boolean;
  setPlacingMode: (v: boolean) => void;

  center: { lat: number; lng: number };
  rangeCenter: { lat: number; lng: number };
  radiusM: number;
  setCenter: (c: { lat: number; lng: number }) => void;
  setRangeCenter: (c: { lat: number; lng: number }) => void;
  setRadiusM: (m: number) => void;
  setCenterAndRadius: (c: { lat: number; lng: number }, m: number) => void;
  hasCenter: boolean;
  setHasCenter: (v: boolean) => void;

  route: RouteShape;
  setRoute: (r: RouteShape) => void;

  savedRoutes: SavedRoute[];
  saveCurrentRoute: () => void;
  loadSavedRoute: (id: string) => void;
  deleteSavedRoute: (id: string) => void;
};

const AppStateContext = createContext<AppStateShape | undefined>(undefined);

const LS_USER = "rr_user";
const LS_PINS = "rr_pins";

const starterUsers: User[] = [
  { id: "u_alex", name: "Alex", avatarColor: "#ef4444" },
  { id: "u_bailey", name: "Bailey", avatarColor: "#10b981" },
  { id: "u_casey", name: "Casey", avatarColor: "#3b82f6" },
];

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinView, setPinView] = useState<"my" | "public">("public");
  const [speedLimitsOn, setSpeedLimitsOn] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [route, setRoute] = useState<RouteShape>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 65.7369, lng: 24.5637 });
  const [rangeCenter, setRangeCenter] = useState<{ lat: number; lng: number }>({ lat: 65.7369, lng: 24.5637 });
  const [radiusM, setRadiusM] = useState<number>(10000);
  const [hasCenter, setHasCenter] = useState<boolean>(false);

  // Load from persistence (Electron JSON or localStorage fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data: StorageData = await persistence.readAll();
        if (!mounted) return;
        setPins(Array.isArray(data.pins) ? data.pins : []);
        setRoute(data.route ?? null);
        if (data.center) setCenter(data.center);
        if ((data as any).rangeCenter) setRangeCenter((data as any).rangeCenter);
        if (typeof data.radiusM === 'number') setRadiusM(data.radiusM);
        if (typeof (data as any).hasCenter === 'boolean') setHasCenter((data as any).hasCenter);
        if (Array.isArray((data as any).savedRoutes)) setSavedRoutes((data as any).savedRoutes as SavedRoute[]);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Persist pins, route, center & radius via abstraction
  useEffect(() => {
    persistence.savePartial({ pins }).catch(() => {});
  }, [pins]);
  useEffect(() => {
    persistence.savePartial({ route }).catch(() => {});
  }, [route]);
  useEffect(() => {
    persistence.savePartial({ savedRoutes }).catch(() => {});
  }, [savedRoutes]);
  useEffect(() => {
    persistence.savePartial({ center }).catch(() => {});
  }, [center]);
  useEffect(() => {
    persistence.savePartial({ rangeCenter }).catch(() => {});
  }, [rangeCenter]);
  useEffect(() => {
    persistence.savePartial({ radiusM }).catch(() => {});
  }, [radiusM]);
  useEffect(() => {
    persistence.savePartial({ hasCenter }).catch(() => {});
  }, [hasCenter]);

  const login = useCallback((u: User) => setUser(u), []);
  const logout = useCallback(() => setUser(null), []);

  const addPin: AppStateShape["addPin"] = useCallback(
    (p) => {
      const pin: Pin = {
        id: `pin_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ownerId: user ? user.id : "anon",
        ownerName: user ? user.name : "anonymous",
        collects: 0,
        collectedBy: [],
        ...p,
      };
      setPins((prev) => [pin, ...prev]);
    },
    [user],
  );

  const collectPin = useCallback(
    (pinId: string) => {
      if (!user) return;
      setPins((prev) =>
        prev.map((p) => {
          if (p.id !== pinId) return p;
          if (p.ownerId === user.id) return p; // skip own pin
          if (p.collectedBy.includes(user.id)) return p; // already collected
          return {
            ...p,
            collects: p.collects + 1,
            collectedBy: [...p.collectedBy, user.id],
          };
        }),
      );
    },
    [user],
  );

  const setPinVisibility = useCallback((pinId: string, visibility: PinVisibility) => {
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, visibility, collects: visibility === "private" ? 0 : p.collects } : p)));
  }, []);

  const updatePin = useCallback((pinId: string, data: Partial<Omit<Pin, "id" | "createdAt" | "ownerId" | "ownerName" | "collectedBy" | "collects">>) => {
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, ...data } : p)));
  }, []);

  const deletePin = useCallback((pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  }, []);

  const saveCurrentRoute = useCallback(() => {
    if (!route || !route.coordinates || route.coordinates.length < 2) return;
    const entry: SavedRoute = { id: `route_${Date.now()}`, createdAt: new Date().toISOString(), route: JSON.parse(JSON.stringify(route)) };
    setSavedRoutes((prev) => [entry, ...prev]);
  }, [route]);

  const loadSavedRoute = useCallback((id: string) => {
    const item = savedRoutes.find((r) => r.id === id);
    setRoute(item ? (item.route ? { ...item.route } : null) : null);
  }, [savedRoutes]);

  const deleteSavedRoute = useCallback((id: string) => {
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo<AppStateShape>(
    () => ({
      user,
      login,
      logout,
      pins,
      addPin,
      collectPin,
      setPinVisibility,
      updatePin,
      deletePin,
      pinView,
      setPinView,
      speedLimitsOn,
      setSpeedLimitsOn,
      placingMode,
      setPlacingMode,
      center,
      rangeCenter,
      radiusM,
      setCenter,
      setRangeCenter,
      setRadiusM,
      setCenterAndRadius: (c, m) => { setCenter(c); setRadiusM(m); setRangeCenter(c); },
      hasCenter,
      setHasCenter,
      route,
      setRoute,
      savedRoutes,
      saveCurrentRoute,
      loadSavedRoute,
      deleteSavedRoute,
    }),
    [user, login, logout, pins, addPin, collectPin, setPinVisibility, updatePin, deletePin, pinView, speedLimitsOn, placingMode, center, rangeCenter, radiusM, route, savedRoutes, saveCurrentRoute, loadSavedRoute, deleteSavedRoute],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function getStarterUsers() {
  return starterUsers;
}
