export type StorageData = {
  pins: any[];
  speedEdits: Record<string, string>;
  route: { coordinates: [number, number][]; durationSec?: number; milestones?: { timeSec: number; coord: [number, number] }[] } | null;
  points: number;
  center?: { lat: number; lng: number };
  rangeCenter?: { lat: number; lng: number };
  radiusM?: number;
  hasCenter?: boolean;
  savedRoutes?: { id: string; createdAt: string; route: { coordinates: [number, number][]; durationSec?: number; milestones?: { timeSec: number; coord: [number, number] }[] } | null }[];
  mindArticles?: { id: string; title: string; content: string; createdAt: string }[];
  mindArticleOverrides?: Record<string, { title?: string; content?: string; hidden?: boolean }>;
};

const FALLBACK_KEY = 'rr_data';

function isElectron() {
  return typeof window !== 'undefined' && typeof (window as any).rr?.storage?.getAll === 'function';
}

async function readAll(): Promise<StorageData> {
  if (isElectron()) {
    const data = await (window as any).rr.storage.getAll();
    return {
      pins: data.pins || [],
      speedEdits: data.speedEdits || {},
      route: data.route || null,
      points: data.points || 0,
      center: data.center,
      rangeCenter: (data as any).rangeCenter,
      radiusM: data.radiusM,
      hasCenter: typeof data.hasCenter === 'boolean' ? data.hasCenter : (data.center != null),
      savedRoutes: Array.isArray((data as any).savedRoutes) ? (data as any).savedRoutes : [],
      mindArticles: Array.isArray((data as any).mindArticles) ? (data as any).mindArticles : [],
      mindArticleOverrides: (data as any).mindArticleOverrides || {},
    };
  }
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return { pins: [], speedEdits: {}, route: null, points: 0, savedRoutes: [], mindArticles: [], mindArticleOverrides: {} };
    const parsed = JSON.parse(raw);
    return {
      pins: parsed.pins || [],
      speedEdits: parsed.speedEdits || {},
      route: parsed.route || null,
      points: parsed.points || 0,
      center: parsed.center,
      rangeCenter: parsed.rangeCenter,
      radiusM: parsed.radiusM,
      hasCenter: typeof parsed.hasCenter === 'boolean' ? parsed.hasCenter : (parsed.center != null),
      savedRoutes: Array.isArray(parsed.savedRoutes) ? parsed.savedRoutes : [],
      mindArticles: Array.isArray(parsed.mindArticles) ? parsed.mindArticles : [],
      mindArticleOverrides: parsed.mindArticleOverrides || {},
    };
  } catch {
    return { pins: [], speedEdits: {}, route: null, points: 0, savedRoutes: [], mindArticles: [], mindArticleOverrides: {} };
  }
}

async function savePartial(partial: Partial<StorageData>): Promise<StorageData> {
  if (isElectron()) {
    return await (window as any).rr.storage.savePartial(partial);
  }
  const current = await readAll();
  const next = { ...current, ...partial } as StorageData;
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(next)); } catch {}
  return next;
}

async function exportData(): Promise<boolean> {
  if (isElectron()) {
    const res = await (window as any).rr.storage.export();
    return !!res?.ok;
  }
  try {
    const data = await readAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recaprule-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

async function importData(): Promise<StorageData | null> {
  if (isElectron()) {
    const res = await (window as any).rr.storage.import();
    return res?.ok ? res.data : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        resolve(data);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

export const persistence = { readAll, savePartial, exportData, importData, isElectron };
