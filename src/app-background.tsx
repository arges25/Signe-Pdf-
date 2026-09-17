import { useEffect, useRef } from "react";

// Global animated backdrop — mounted once at the app root, behind every
// screen (home, tools, docs, réglages, and every tool's own page). Pure
// CSS blobs (no canvas/WebGL) plus a lightweight pointer-driven parallax,
// so it stays cheap on mobile and respects prefers-reduced-motion.
export default function AppBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function onPointerMove(e: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el!.style.setProperty("--px", x.toFixed(3));
        el!.style.setProperty("--py", y.toFixed(3));
      });
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="app-bg" ref={ref} aria-hidden="true">
    <span className="app-bg-blob app-bg-blob-1" />
    <span className="app-bg-blob app-bg-blob-2" />
    <span className="app-bg-blob app-bg-blob-3" />
    <span className="app-bg-blob app-bg-blob-4" />
    <span className="app-bg-blob app-bg-blob-5" />
  </div>;
}
