import { useEffect, useRef } from "react";

// One wave tile (0-1440 wide, 0-320 tall), drawn twice side by side inside a
// 200%-wide SVG so that animating its horizontal position by exactly -50%
// loops it seamlessly — the standard technique for an infinitely-scrolling
// wave graphic without any per-frame JS.
function WaveLayer({ className, path }: { className: string; path: string }) {
  return <div className={className} aria-hidden="true">
    <svg viewBox="0 0 2880 320" preserveAspectRatio="none">
      <path d={path} />
      <path d={path} transform="translate(1440 0)" />
    </svg>
  </div>;
}

const WAVE_BACK = "M0,160 C120,120 360,120 480,160 C600,200 840,200 960,160 C1080,120 1320,120 1440,160 L1440,320 L0,320 Z";
const WAVE_MID = "M0,180 C180,140 300,140 480,180 C660,220 780,220 960,180 C1140,140 1260,140 1440,180 L1440,320 L0,320 Z";
const WAVE_FRONT = "M0,200 C160,140 320,140 480,200 C640,260 800,260 960,200 C1120,140 1280,140 1440,200 L1440,320 L0,320 Z";

// Global animated backdrop — mounted once at the app root, behind every
// screen (home, tools, docs, réglages, and every tool's own page). Three
// layered SVG wave bands flow sideways at different speeds for a fluid,
// water-like parallax, plus two soft glow blobs up top for depth/halo —
// all pure CSS transforms (no canvas/WebGL/JS animation loop), so it stays
// cheap on mobile and respects prefers-reduced-motion.
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
    <div className="app-bg-waves">
      <WaveLayer className="app-wave app-wave-back" path={WAVE_BACK} />
      <WaveLayer className="app-wave app-wave-mid" path={WAVE_MID} />
      <WaveLayer className="app-wave app-wave-front" path={WAVE_FRONT} />
    </div>
  </div>;
}
