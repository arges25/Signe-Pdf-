import { fontDef } from "../fonts";
import type { FontId } from "../types/theme";

let measureCanvas: HTMLCanvasElement | null = null;
function ctx(): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const c = measureCanvas.getContext("2d");
  if (!c) throw new Error("2D canvas context unavailable");
  return c;
}

export function fontCss(id: FontId, sizePt: number, bold = false): string {
  const px = sizePt * (96 / 72);
  return `${bold ? "700" : "400"} ${px}px '${fontDef(id).cssFamily}'`;
}

// Waits for the given font faces to actually be loaded before any
// measurement happens — canvas measureText silently falls back to the
// generic default face until then, which would under-count wrapped lines.
export async function waitForFonts(specs: { id: FontId; sizePt: number; bold?: boolean }[]): Promise<void> {
  try {
    await Promise.all(specs.map(s => document.fonts.load(fontCss(s.id, s.sizePt, s.bold))));
    await document.fonts.ready;
  } catch { /* best-effort — pagination falls back to default-font metrics */ }
}

export function textWidthPt(text: string, id: FontId, sizePt: number, bold = false): number {
  const c = ctx();
  c.font = fontCss(id, sizePt, bold);
  return c.measureText(text).width * (72 / 96);
}

// Greedy word-wrap line count for a block of (possibly multi-paragraph)
// text at a given column width — mirrors the wrapping doc-to-pdf.ts uses
// for the real PDF, just with canvas metrics instead of pdf-lib's, so the
// preview's page breaks land in the same place the export will.
export function estimateWrappedLineCount(text: string, id: FontId, sizePt: number, maxWidthPt: number, bold = false): number {
  if (!text.trim()) return 0;
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") { lines += 1; continue; }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let lineWidth = 0;
    let wordsOnLine = 0;
    for (const word of words) {
      const w = textWidthPt(word + " ", id, sizePt, bold);
      if (wordsOnLine > 0 && lineWidth + w > maxWidthPt) { lines += 1; lineWidth = 0; wordsOnLine = 0; }
      lineWidth += w; wordsOnLine += 1;
    }
    if (wordsOnLine > 0) lines += 1;
  }
  return Math.max(1, lines);
}
