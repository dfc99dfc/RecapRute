import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/state/AppState";

export default function EditPinModal({ open, onOpenChange, pinId }: { open: boolean; onOpenChange: (v: boolean) => void; pinId: string }) {
  const { pins, updatePin, deletePin } = useAppState();
  const pin = useMemo(() => pins.find((p) => p.id === pinId), [pins, pinId]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!pin) return;
    setTitle(pin.title);
    setDesc(pin.description);
  }, [pin]);

  if (!pin) return null;

  const remaining = 10000 - desc.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg z-[2000]">
        <DialogHeader>
          <DialogTitle>Edit pin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} />
          </div>
          <div>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 10000))} rows={5} />
            <div className="mt-1 text-right text-xs text-muted-foreground">{remaining} / 10000</div>
          </div>
          <div className="flex justify-between">
            <Button variant="destructive" onClick={() => { if (confirm('Delete this pin? This cannot be undone.')) { deletePin(pin.id); onOpenChange(false); } }}>Delete</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => { updatePin(pin.id, { title, description: desc }); onOpenChange(false); }}>Save</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
