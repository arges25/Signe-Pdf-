import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import { imagePlacement } from "./pdf-signing";
import type { EditElement } from "./edit-types";

function hexToUnitRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const int = parseInt(full, 16) || 0;
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

// Applies redaction/highlight rectangles and text annotations directly onto
// the ORIGINAL pdf-lib document's existing pages — never rasterizes a page
// to an image, so the untouched vector text, embedded fonts and images
// stay at full quality and the document stays printable. Page geometry
// (including rotation) comes from the same pdf.js preview document already
// open in the editor, reusing the exact placement math already proven by
// the signing feature (imagePlacement).
export async function applyEditsToPdf(original: Uint8Array, preview: PDFDocumentProxy, elements: EditElement[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees, BlendMode } = await import("pdf-lib");
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const viewportCache = new Map<number, PageViewport>();
  async function getViewport(pageNum: number) {
    let vp = viewportCache.get(pageNum);
    if (!vp) {
      const p = await preview.getPage(pageNum);
      vp = p.getViewport({ scale: 1 });
      viewportCache.set(pageNum, vp);
    }
    return vp;
  }

  for (const el of elements) {
    if (el.page < 1 || el.page > doc.getPageCount()) continue;
    const viewport = await getViewport(el.page);
    const pdfPage = doc.getPage(el.page - 1);
    const { r, g, b } = hexToUnitRgb(el.color);

    if (el.kind === "rect") {
      const { x, y, width, height, angle } = imagePlacement(el, viewport);
      pdfPage.drawRectangle({
        x, y, width, height, rotate: degrees(angle),
        color: rgb(r, g, b),
        opacity: el.mode === "highlight" ? 0.45 : 1,
        blendMode: el.mode === "highlight" ? BlendMode.Multiply : BlendMode.Normal,
      });
    } else if (el.glyph) {
      const { x, y, width, height } = imagePlacement({ x: el.x, y: el.y, w: el.fontSize, h: el.fontSize }, viewport);
      const thickness = Math.max(1, Math.min(width, height) * 0.14);
      const color = rgb(r, g, b);
      if (el.glyph === "cross") {
        pdfPage.drawLine({ start: { x, y: y + height }, end: { x: x + width, y }, thickness, color });
        pdfPage.drawLine({ start: { x, y }, end: { x: x + width, y: y + height }, thickness, color });
      } else {
        const midX = x + width * 0.4, midY = y + height * 0.1;
        pdfPage.drawLine({ start: { x, y: y + height * 0.5 }, end: { x: midX, y: midY }, thickness, color });
        pdfPage.drawLine({ start: { x: midX, y: midY }, end: { x: x + width, y: y + height }, thickness, color });
      }
    } else {
      const { x, y, height: size, angle } = imagePlacement({ x: el.x, y: el.y, w: el.fontSize, h: el.fontSize }, viewport);
      const font = el.bold && el.italic ? fonts.boldItalic : el.bold ? fonts.bold : el.italic ? fonts.italic : fonts.regular;
      const lines = el.text.split("\n");
      const lineHeight = size * 1.3;
      const widths = lines.map(line => font.widthOfTextAtSize(line, size));
      const maxWidth = Math.max(...widths, 0);
      lines.forEach((line, i) => {
        const dx = el.align === "center" ? (maxWidth - widths[i]) / 2 : el.align === "right" ? maxWidth - widths[i] : 0;
        pdfPage.drawText(line, {
          x: x + dx, y: y - i * lineHeight, size, font,
          color: rgb(r, g, b), rotate: degrees(angle),
        });
      });
    }
  }

  return doc.save({ updateFieldAppearances: false });
}
