// Decorative only — a light stack-of-documents motif for the home hero
// card, drawn as inline SVG so it costs no extra asset request or
// GitHub Pages base-path handling.
export default function HeroIllustration() {
  return <svg viewBox="0 0 132 132" fill="none" aria-hidden="true">
    <rect x="30" y="14" width="70" height="92" rx="10" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" transform="rotate(8 65 60)" />
    <rect x="22" y="22" width="70" height="92" rx="10" fill="#ffffff" stroke="#dbe2f5" strokeWidth="1.5" transform="rotate(-4 57 68)" />
    <g transform="rotate(-4 57 68)">
      <rect x="34" y="40" width="46" height="5" rx="2.5" fill="#c9d4f5" />
      <rect x="34" y="52" width="34" height="5" rx="2.5" fill="#dbe2f5" />
      <rect x="34" y="64" width="40" height="5" rx="2.5" fill="#dbe2f5" />
    </g>
    <rect x="66" y="78" width="34" height="24" rx="6" fill="#3b57eb" />
    <text x="83" y="94" fontSize="10" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="sans-serif">PDF</text>
    <path d="M46 108c6-2 12-2 17 2" stroke="#7c5cff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </svg>;
}
