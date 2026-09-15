export type TextAlign = "left" | "center" | "right";

// Position/size are fractions of the page (0-1), top-left origin — the same
// convention as Stamp in pdf-signing.ts, so the on-screen overlay math is
// identical (left/top/width/height as percentages).
export type TextElement = {
  id: string;
  kind: "text";
  page: number;
  x: number;
  y: number;
  fontSize: number; // fraction of page height
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  // Set only for the quick "coche"/"croix" tools: the standard PDF fonts'
  // WinAnsi encoding can't represent ✓/✕, so these are drawn as vector
  // strokes on export instead of text glyphs (see applyEditsToPdf). The
  // on-screen preview still renders `text` directly, since the browser's
  // own font handles the Unicode symbol fine.
  glyph?: "check" | "cross";
};

export type RectElement = {
  id: string;
  kind: "rect";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  mode: "redact" | "highlight";
};

export type EditElement = TextElement | RectElement;

export const DEFAULT_TEXT_COLOR = "#172a46";
export const DEFAULT_TEXT_SIZE = 0.028; // ~ a readable annotation size at typical page heights
export const DEFAULT_REDACT_COLOR = "#ffffff";
export const DEFAULT_HIGHLIGHT_COLOR = "#ffe066";
