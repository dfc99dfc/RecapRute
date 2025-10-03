export const KEMI_AJOVARMA_CENTER = { lat: 65.7369, lng: 24.5637 };

export const SPEED_COLORS: Record<string, string> = {
  "120": "#FF6A00",
  "100": "#FF0048",
  "80": "#F600FF",
  "60": "#675FFF",
  "50": "#00E5FF",
  "40": "#00FF00",
  "30": "#FFE500",
  "20": "#000000",
  "ungiven": "#64748b",
};

export const DEFAULT_SPEED_RADIUS_M = 10000; // 10 km
export const SIM_ROUTE_RADIUS_M = 11000; // 11 km
export const SIM_ROUTE_MAX_DURATION_SEC = 65 * 60; // 65 minutes

export const SPEED_WEIGHTS: Record<string, number> = {
  "120": 24,
  "100": 20,
  "80": 16,
  "60": 12,
  "50": 8,
  "40": 4,
  "30": 2,
  "20": 1,
  "ungiven": 1,
};

export const SPEED_LEGEND_ORDER = ["120", "100", "80", "60", "50", "40", "30", "20"] as const;
export const SPEED_LEGEND_ORDER_EXTENDED: readonly string[] = [...SPEED_LEGEND_ORDER, "ungiven"];
