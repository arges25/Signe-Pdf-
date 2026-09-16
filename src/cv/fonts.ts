import type { FontId } from "./types/theme";

// Self-hosted (public/fonts/cv/<slug>/{latin,latin-ext}-{400,700}.woff),
// lazy-loaded only when a CV actually selects a given family.
//
// Google's own subset files are *disjoint*, not nested: "latin" covers
// Basic Latin + Latin-1 Supplement (plain ASCII plus French/German
// accents), "latin-ext" covers Latin Extended-A/B (the Turkish ş/ğ/ı/İ
// range) and neither is a superset of the other — a font embedded from
// latin-ext alone is missing plain A–Z entirely. Both are loaded and used
// together everywhere a font is needed (on-screen and in the exported
// PDF) so French/German/Turkish text — and plain text — all render
// correctly from the same font choice.
export type FontCategory = "sans" | "serif" | "display" | "mono";
export type FontSubset = "latin" | "latin-ext";

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

// Google's standard boundaries for these two subset names (used
// identically across their whole catalog) — the font files themselves
// were subsetted to exactly these ranges, so this is what tells the
// browser (via `unicode-range`) and the PDF exporter (via pickSubset
// below) which file actually has a given character's glyph.
const LATIN_RANGE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT_RANGE = "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

function fontUrl(slug: string, subset: FontSubset, weight: 400 | 700): string {
  return `${import.meta.env.BASE_URL}fonts/cv/${slug}/${subset}-${weight}.woff`;
}

const injectedStyles = new Set<FontId>();

// Injects @font-face rules for both subsets (both weights) the first time
// this family is needed, then no-ops on every later call. Two rules per
// weight, same font-family name, different unicode-range — the browser
// picks whichever file actually has the glyph for each character,
// automatically and per-character, exactly as intended.
export function ensureFontLoaded(id: FontId): void {
  if (injectedStyles.has(id)) return;
  injectedStyles.add(id);
  const def = fontDef(id);
  const style = document.createElement("style");
  const rule = (weight: 400 | 700, subset: FontSubset, range: string) =>
    `@font-face { font-family: '${def.cssFamily}'; font-weight: ${weight}; font-style: normal; font-display: swap; unicode-range: ${range}; src: url('${fontUrl(def.slug, subset, weight)}') format('woff'); }`;
  style.textContent = [
    rule(400, "latin", LATIN_RANGE), rule(700, "latin", LATIN_RANGE),
    rule(400, "latin-ext", LATIN_EXT_RANGE), rule(700, "latin-ext", LATIN_EXT_RANGE),
  ].join("\n");
  document.head.appendChild(style);
}

// codepoint <= 0xFF (Basic Latin + Latin-1 Supplement) is the "latin"
// subset; everything else this app needs (Turkish ş/ğ/ı/İ, and any other
// Latin Extended-A/B character) falls in "latin-ext" — matches the two
// ranges above exactly for every character these four languages use.
export function subsetForChar(ch: string): FontSubset {
  return ch.codePointAt(0)! <= 0xFF ? "latin" : "latin-ext";
}

const fontBytesCache = new Map<string, Uint8Array>();

// Fetches the raw font bytes for PDF embedding (pdf-lib + fontkit),
// cached per (family, subset, weight).
export async function fetchFontBytes(id: FontId, subset: FontSubset, weight: 400 | 700): Promise<Uint8Array> {
  const def = fontDef(id);
  const cacheKey = `${def.slug}-${subset}-${weight}`;
  const cached = fontBytesCache.get(cacheKey);
  if (cached) return cached;
  const res = await fetch(fontUrl(def.slug, subset, weight));
  const bytes = new Uint8Array(await res.arrayBuffer());
  fontBytesCache.set(cacheKey, bytes);
  return bytes;
}
