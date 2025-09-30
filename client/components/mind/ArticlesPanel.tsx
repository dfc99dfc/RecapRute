import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ArticleMeta = { id: string; title: string; file: string };

export default function ArticlesPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<ArticleMeta[]>([]);
  const [active, setActive] = useState<ArticleMeta | null>(null);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    fetch("articles/index.json")
      .then((r) => r.json())
      .then((json) => { if (mounted) setList(json); })
      .catch(() => setList([]));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!active) return;
    fetch(`articles/${active.file}`)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setContent(t); });
    return () => { cancelled = true; };
  }, [active]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-[70vh]">
          <aside className="w-64 border-r p-3 overflow-auto">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">Mindset massage</h2>
              <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
            </div>
            <ul className="space-y-1">
              {list.map((a) => (
                <li key={a.id}>
                  <button className="w-full text-left rounded-md px-2 py-1 hover:bg-accent" onClick={() => setActive(a)}>
                    {a.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <main className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
            {active ? (
              <article>
                <h1 className="text-xl font-bold mb-2">{active.title}</h1>
                <pre className="whitespace-pre-wrap break-words">{content}</pre>
              </article>
            ) : (
              <div className="text-slate-600">Select an article</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
