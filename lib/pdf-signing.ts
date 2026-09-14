import type { PDFDocumentProxy } from "pdfjs-dist";

export type SignatureAsset = { dataUrl: string; width: number; height: number };
export type Stamp = SignatureAsset & {
  id: string; page: number; x: number; y: number; w: number; h: number;
};
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

// Map the bottom-left corner and the image basis to the PDF coordinate system.
// This preserves placement on rotated pages, offset CropBoxes and UserUnits.
export function imagePlacement(
  stamp: Pick<Stamp, "x" | "y" | "w" | "h">,
  viewport: { width: number; height: number; convertToPdfPoint(x: number, y: number): number[] },
) {
  const left = stamp.x * viewport.width;
  const bottom = (stamp.y + stamp.h) * viewport.height;
  const start = viewport.convertToPdfPoint(left, bottom);
  const right = viewport.convertToPdfPoint(left + stamp.w * viewport.width, bottom);
  const top = viewport.convertToPdfPoint(left, stamp.y * viewport.height);
  return {
    x: start[0], y: start[1],
    width: Math.hypot(right[0] - start[0], right[1] - start[1]),
    height: Math.hypot(top[0] - start[0], top[1] - start[1]),
    angle: Math.atan2(right[1] - start[1], right[0] - start[0]) * 180 / Math.PI,
  };
}

export async function signPdf(original: Uint8Array, preview: PDFDocumentProxy, stamps: Stamp[]): Promise<Uint8Array> {
  if (!stamps.length) throw new Error("Ajoutez une signature avant de télécharger.");
  const { PDFDocument, degrees } = await import("pdf-lib");
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const stamp of stamps) {
    if (stamp.page < 1 || stamp.page > doc.getPageCount()) throw new Error("Page introuvable.");
    let image = images.get(stamp.dataUrl);
    if (!image) { image = await doc.embedPng(stamp.dataUrl); images.set(stamp.dataUrl, image); }
    const page = await preview.getPage(stamp.page);
    const { angle, ...placement } = imagePlacement(stamp, page.getViewport({ scale: 1 }));
    doc.getPage(stamp.page - 1).drawImage(image, { ...placement, rotate: degrees(angle) });
  }
  return doc.save({ updateFieldAppearances: false });
}

export function cropSignature(canvas: HTMLCanvasElement): SignatureAsset | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let x1 = width, y1 = height, x2 = -1, y2 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] > 10) {
      x1 = Math.min(x1, x); y1 = Math.min(y1, y);
      x2 = Math.max(x2, x); y2 = Math.max(y2, y);
    }
  }
  if (x2 < 0 || y2 < 0) return null;
  const pad = 10;
  const result = document.createElement("canvas");
  result.width = x2 - x1 + 1 + pad * 2;
  result.height = y2 - y1 + 1 + pad * 2;
  result.getContext("2d")!.drawImage(canvas, x1, y1, x2 - x1 + 1, y2 - y1 + 1,
    pad, pad, x2 - x1 + 1, y2 - y1 + 1);
  return { dataUrl: result.toDataURL("image/png"), width: result.width, height: result.height };
}
