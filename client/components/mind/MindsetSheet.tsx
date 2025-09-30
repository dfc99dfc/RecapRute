import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { persistence } from "@/utils/persistence";
import { useIsMobile } from "@/hooks/use-mobile";

type BuiltinArticle = { id: string; title: string; file: string; kind: "builtin" };
type CustomArticle = { id: string; title: string; content: string; createdAt: string; kind: "custom" };

type AnyArticle = BuiltinArticle | CustomArticle;

export default function MindsetSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
  const [builtin, setBuiltin] = useState<BuiltinArticle[]>([]);
  const [custom, setCustom] = useState<CustomArticle[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { title?: string; content?: string; hidden?: boolean }>>({});
  const [active, setActive] = useState<AnyArticle | null>(null);
  const [content, setContent] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("articles/index.json")
      .then((r) => r.json())
      .then((json) => { if (mounted) setBuiltin((json || []).map((a: any) => ({ ...a, kind: "builtin" })) as BuiltinArticle[]); })
      .catch(() => setBuiltin([]));
    (async () => {
      const data = await persistence.readAll();
      if (!mounted) return;
      setCustom(((data as any).mindArticles || []).map((a: any) => ({ ...a, kind: "custom" })) as CustomArticle[]);
      setOverrides(((data as any).mindArticleOverrides || {}) as Record<string, { title?: string; content?: string; hidden?: boolean }>);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!active) return;
    if (active.kind === "builtin") {
      const ov = overrides[active.id];
      if (ov?.content) {
        setContent(ov.content);
      } else {
        fetch(`articles/${(active as BuiltinArticle).file}`)
          .then((r) => r.text())
          .then((t) => { if (!cancelled) setContent(t); });
      }
      setEditTitle(ov?.title || active.title);
      setEditing(false);
    } else {
      setContent((active as CustomArticle).content);
      setEditTitle(active.title);
    }
    return () => { cancelled = true; };
  }, [active, overrides]);

  const visibleBuiltin = builtin.filter((b) => !overrides[b.id]?.hidden).map((b) => ({ ...b, title: overrides[b.id]?.title || b.title }));
  const all: AnyArticle[] = [...custom, ...visibleBuiltin];

  const startCreate = () => { setCreating(true); setNewTitle(""); setNewContent(""); setActive(null); setEditing(false); };
  const saveCreate = async () => {
    const item: CustomArticle = { id: `mind_${Date.now()}`, title: newTitle || "Untitled", content: newContent, createdAt: new Date().toISOString(), kind: "custom" };
    const next = [item, ...custom];
    setCustom(next);
    await persistence.savePartial({ mindArticles: next.map(({ kind, ...rest }) => rest) as any });
    setCreating(false);
    setActive(item);
  };

  const saveEdit = async () => {
    if (!active) return;
    if (active.kind === "custom") {
      const next = custom.map((a) => (a.id === active.id ? { ...a, title: editTitle, content } : a));
      setCustom(next);
      await persistence.savePartial({ mindArticles: next.map(({ kind, ...rest }) => rest) as any });
    } else {
      const nextOv = { ...overrides, [active.id]: { ...(overrides[active.id] || {}), title: editTitle, content } };
      setOverrides(nextOv);
      await persistence.savePartial({ mindArticleOverrides: nextOv });
    }
    setEditing(false);
    setActive((prev) => (prev ? { ...prev, title: editTitle } as AnyArticle : prev));
  };

  const deleteActive = async () => {
    if (!active) return;
    if (!confirm("Delete this article? This cannot be undone.")) return;
    if (active.kind === "custom") {
      const next = custom.filter((a) => a.id !== active.id);
      setCustom(next);
      await persistence.savePartial({ mindArticles: next.map(({ kind, ...rest }) => rest) as any });
    } else {
      const nextOv = { ...overrides, [active.id]: { ...(overrides[active.id] || {}), hidden: true } };
      setOverrides(nextOv);
      await persistence.savePartial({ mindArticleOverrides: nextOv });
    }
    setActive(null);
    setContent("");
  };

  const sheetWidth = isMobile
    ? "w-full max-w-none"
    : (creating || active) ? "w-[860px] sm:max-w-none" : "w-[380px] sm:max-w-sm";

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setActive(null); setEditing(false); setCreating(false); } }}>
      <SheetContent side="right" className={sheetWidth}>
        <SheetHeader>
          <SheetTitle>Mindset massage</SheetTitle>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={startCreate}>New</Button>
          </div>
        </SheetHeader>

        {isMobile ? (
          <div className="mt-4">
            {creating && (
              <div className="mb-4 rounded-md border p-3">
                <div className="space-y-2">
                  <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <Textarea rows={10} placeholder="Write content..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveCreate}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}

            <ul className="space-y-1">
              {all.map((a) => {
                const opened = active?.id === a.id;
                return (
                  <li key={a.id} className="rounded-md border">
                    <button
                      className={`w-full text-left rounded-md px-2 py-2 ${opened ? 'bg-accent' : 'hover:bg-accent'}`}
                      onClick={() => { setCreating(false); setEditing(false); setActive(opened ? null : a); }}
                    >
                      {a.title}
                    </button>
                    {opened && (
                      <div className="mt-2 px-2 pb-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium pr-2 truncate">{a.title}</div>
                          <div className="flex items-center gap-2">
                            {!editing && (<button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditing(true)}>Edit</button>)}
                            <button className="rounded-md border px-2 py-1 text-xs text-red-600" onClick={deleteActive}>Delete</button>
                          </div>
                        </div>
                        {editing ? (
                          <div className="mt-2 space-y-2">
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                            <Textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 prose prose-sm max-w-none whitespace-pre-wrap break-words">{content}</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          (creating || active) ? (
            <div className="mt-4 flex gap-4">
              <div className="flex-1 min-w-0 rounded-md border p-3">
                {creating ? (
                  <div className="space-y-2">
                    <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <Textarea rows={14} placeholder="Write content..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveCreate}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold truncate pr-4">{active!.title}</h3>
                      <div className="flex items-center gap-2">
                        {!editing && (<button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditing(true)}>Edit</button>)}
                        <button className="rounded-md border px-2 py-1 text-xs text-red-600" onClick={deleteActive}>Delete</button>
                      </div>
                    </div>
                    {editing ? (
                      <div className="mt-3 space-y-2">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        <Textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 prose prose-sm max-w-none whitespace-pre-wrap break-words">{content}</div>
                    )}
                  </div>
                )}
              </div>

              <aside className="w-[380px] shrink-0 overflow-auto">
                <ul className="space-y-1">
                  {all.map((a) => (
                    <li key={a.id}>
                      <button className={`w-full text-left rounded-md px-2 py-1 hover:bg-accent ${active?.id===a.id? 'bg-accent':''}`} onClick={() => { setCreating(false); setEditing(false); setActive(a); }}>
                        {a.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          ) : (
            <div className="mt-4 w-[380px]">
              <aside className="overflow-auto">
                <ul className="space-y-1">
                  {all.map((a) => (
                    <li key={a.id}>
                      <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => { setCreating(false); setEditing(false); setActive(a); }}>
                        {a.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
