import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PinType, useAppState } from "@/state/AppState";

export default function PinModal({
  open,
  onOpenChange,
  lat,
  lng,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lat: number | null;
  lng: number | null;
}) {
  const { addPin } = useAppState();
  const [address, setAddress] = useState<string>("");
  const [desc, setDesc] = useState("");
  const DEFAULT_TYPE: PinType = "tricky-intersection";

  useEffect(() => {
    setAddress("");
    if (!lat || !lng) return;
    let cancelled = false;
    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const json = await res.json();
        if (!cancelled) setAddress(json.display_name || "");
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const remaining = useMemo(() => 10000 - desc.length, [desc.length]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement & { title: { value: string } };
    const type: PinType = DEFAULT_TYPE;
    if (!lat || !lng) return;

    addPin({ lat, lng, title: form.title.value, description: desc, type, visibility: "public" });

    onOpenChange(false);
    setDesc("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg z-[2000]">
        <DialogHeader>
          <DialogTitle>Mark a tricky spot</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">Demo mode: pins are saved locally. Replace with backend later.</div>
          {address && <div className="text-sm">📍 {address}</div>}
          <div>
            <Input id="title" name="title" required placeholder="Short title" maxLength={120} />
          </div>
          <div>
            <Textarea id="description" name="description" value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 10000))} placeholder="Describe the situation" rows={5} />
            <div className="mt-1 text-right text-xs text-muted-foreground">{remaining} / 10000</div>
          </div>
          <div className="text-xs text-muted-foreground">Location: {lat?.toFixed(5)}, {lng?.toFixed(5)}</div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
