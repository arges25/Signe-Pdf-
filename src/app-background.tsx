// Global animated backdrop — mounted once at the app root, behind every
// screen (home, tools, docs, réglages, and every tool's own page). Pure
// CSS blobs, no canvas/WebGL, so it stays cheap on mobile and respects
// prefers-reduced-motion.
export default function AppBackground() {
  return <div className="app-bg" aria-hidden="true">
    <span className="app-bg-blob app-bg-blob-1" />
    <span className="app-bg-blob app-bg-blob-2" />
    <span className="app-bg-blob app-bg-blob-3" />
    <span className="app-bg-blob app-bg-blob-4" />
  </div>;
}
