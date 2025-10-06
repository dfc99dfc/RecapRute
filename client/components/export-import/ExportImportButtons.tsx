import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { persistence } from "@/utils/persistence";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportImportButtons() {
  const doExport = async () => {
    const current = await persistence.readAll();
    downloadJson("recaprule-data.json", current);
    toast.success("Data exported");
  };

  const doImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const incoming = JSON.parse(text);
        const next = {
          pins: Array.isArray(incoming.pins) ? incoming.pins : [],
          speedEdits: incoming.speedEdits || {},
          route: incoming.route ?? null,
          points: typeof incoming.points === 'number' ? incoming.points : 0,
          center: incoming.center,
          rangeCenter: incoming.rangeCenter,
          radiusM: typeof incoming.radiusM === 'number' ? incoming.radiusM : 10000,
          hasCenter: typeof incoming.hasCenter === 'boolean' ? incoming.hasCenter : (incoming.center != null),
          savedRoutes: Array.isArray(incoming.savedRoutes) ? incoming.savedRoutes : [],
          mindArticles: Array.isArray(incoming.mindArticles) ? incoming.mindArticles : [],
          mindArticleOverrides: typeof incoming.mindArticleOverrides === 'object' && incoming.mindArticleOverrides ? incoming.mindArticleOverrides : {},
        };
        await persistence.savePartial(next);
        toast.success("Data imported");
        window.location.reload();
      } catch (e) {
        console.error(e);
        toast.error("Invalid JSON");
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={doExport}>Export</Button>
        <Button size="sm" onClick={doImport}>Import</Button>
      </div>
      <div className="text-[11px] text-muted-foreground max-w-[16rem] leading-snug">
        remember to export your data and save locally for importing next time
      </div>
    </div>
  );
}

function mergePins(a: any[], b: any[]) {
  const byId = new Map<string, any>();
  for (const p of a) byId.set(p.id, p);
  for (const p of b) byId.set(p.id, p);
  return Array.from(byId.values());
}
