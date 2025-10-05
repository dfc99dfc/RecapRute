import { useEffect, useRef } from "react";

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

export default function AdsTop() {
  const ref = useRef<HTMLModElement | null>(null);
  useEffect(() => {
    try {
      // Push once when mounted
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);
  return (
    <div className="w-full">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-3223149668541045"
        data-ad-slot="2657320713"
        data-ad-format="auto"
        data-full-width-responsive="true"
        ref={ref as any}
      />
    </div>
  );
}
