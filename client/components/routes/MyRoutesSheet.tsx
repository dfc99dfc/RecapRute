import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/state/AppState";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${month}/${day}/${year} ${time}`;
}

export default function MyRoutesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { savedRoutes, loadSavedRoute, deleteSavedRoute } = useAppState();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>My routes</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {savedRoutes.length === 0 && (
            <div className="text-sm text-muted-foreground">No saved routes yet.</div>
          )}
          {savedRoutes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="text-sm">{r.city ? `Route ${r.city}` : 'Route generated'} · {formatTimestamp(r.createdAt)}</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => { loadSavedRoute(r.id); onOpenChange(false); }}>Load</Button>
                <button className="rounded-md border px-2 py-1 text-xs text-red-600" onClick={() => { if (confirm('Delete this saved route? This cannot be undone.')) deleteSavedRoute(r.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
