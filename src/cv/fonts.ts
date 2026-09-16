import type { FontId } from "./types/theme";

// Self-hosted (public/fonts/cv/<slug>/{400,700}.woff), lazy-loaded only
// when a CV actually selects a given family — never all at once. Each file
// is the Google Fonts "latin-ext" cut, which is a complete, self-contained
// subset (not a unicode-range narrowing of "latin"): French/German
// accents and the Turkish ç/ğ/ı/İ/ö/ş/ü all render correctly from it, in
// both the on-screen preview and the embedded PDF.
export type FontCategory = "sans" | "serif" | "display" | "mono";

export type FontDef = { id: FontId; label: string; cssFamily: string; category: FontCategory; slug: string };

export const FONT_LIBRARY: FontDef[] = [
  { id: "inter", label: "Inter", cssFamily: "CV Inter", category: "sans", slug: "inter" },
  { id: "roboto", label: "Roboto", cssFamily: "CV Roboto", category: "sans", slug: "roboto" },
  { id: "open-sans", label: "Open Sans", cssFamily: "CV Open Sans", category: "sans", slug: "open-sans" },
  { id: "lato", label: "Lato", cssFamily: "CV Lato", category: "sans", slug: "lato" },
  { id: "montserrat", label: "Montserrat", cssFamily: "CV Montserrat", category: "sans", slug: "montserrat" },
  { id: "poppins", label: "Poppins", cssFamily: "CV Poppins", category: "sans", slug: "poppins" },
  { id: "raleway", label: "Raleway", cssFamily: "CV Raleway", category: "sans", slug: "raleway" },
  { id: "nunito", label: "Nunito", cssFamily: "CV Nunito", category: "sans", slug: "nunito" },
  { id: "work-sans", label: "Work Sans", cssFamily: "CV Work Sans", category: "sans", slug: "work-sans" },
  { id: "pt-sans", label: "PT Sans", cssFamily: "CV PT Sans", category: "sans", slug: "pt-sans" },
  { id: "pt-serif", label: "PT Serif", cssFamily: "CV PT Serif", category: "serif", slug: "pt-serif" },
  { id: "merriweather", label: "Merriweather", cssFamily: "CV Merriweather", category: "serif", slug: "merriweather" },
  { id: "playfair-display", label: "Playfair Display", cssFamily: "CV Playfair Display", category: "serif", slug: "playfair-display" },
  { id: "eb-garamond", label: "EB Garamond", cssFamily: "CV EB Garamond", category: "serif", slug: "eb-garamond" },
  { id: "libre-baskerville", label: "Libre Baskerville", cssFamily: "CV Libre Baskerville", category: "serif", slug: "libre-baskerville" },
  { id: "oswald", label: "Oswald", cssFamily: "CV Oswald", category: "display", slug: "oswald" },
  { id: "courier-prime", label: "Courier Prime", cssFamily: "CV Courier Prime", category: "mono", slug: "courier-prime" },
];

const FONT_BY_ID = new Map(FONT_LIBRARY.map(f => [f.id, f]));
export function fontDef(id: FontId): FontDef { return FONT_BY_ID.get(id) ?? FONT_LIBRARY[0]; }

function fontUrl(slug: string, weight: 400 | 700): string {
  return `${import.meta.env.BASE_URL}fonts/cv/${slug}/${weight}.woff`;
}

const injectedStyles = new Set<FontId>();

// Injects a <style> @font-face rule for this family (both weights) the
// first time it's needed, then no-ops on every later call — the mechanism
// that keeps the editor from ever downloading fonts the user hasn't
// selected.
export function ensureFontLoaded(id: FontId): void {
  if (injectedStyles.has(id)) return;
  injectedStyles.add(id);
  const def = fontDef(id);
  const style = document.createElement("style");
  style.textContent = `
@font-face { font-family: '${def.cssFamily}'; font-weight: 400; font-style: normal; font-display: swap; src: url('${fontUrl(def.slug, 400)}') format('woff'); }
@font-face { font-family: '${def.cssFamily}'; font-weight: 700; font-style: normal; font-display: swap; src: url('${fontUrl(def.slug, 700)}') format('woff'); }
`;
  document.head.appendChild(style);
}

const fontBytesCache = new Map<string, Uint8Array>();

// Fetches the raw font bytes for PDF embedding (pdf-lib + fontkit). Cached
// per weight so exporting twice in a row doesn't re-fetch.
export async function fetchFontBytes(id: FontId, weight: 400 | 700): Promise<Uint8Array> {
  const def = fontDef(id);
  const cacheKey = `${def.slug}-${weight}`;
  const cached = fontBytesCache.get(cacheKey);
  if (cached) return cached;
  const res = await fetch(fontUrl(def.slug, weight));
  const bytes = new Uint8Array(await res.arrayBuffer());
  fontBytesCache.set(cacheKey, bytes);
  return bytes;
}
