import { warpQuadToCanvas, type Point, type Quad } from "./perspective";
import { applyScanFilter } from "./scan-filters";
import type { Rotation, ScanPage } from "./scan-types";

// The largest dimension a page's decoded source photo is kept at in memory.
// An iPhone photo can be 4000px+ on its long side (~48MB as raw RGBA) —
// nothing here ever needs more detail than this, so every page is
// downscaled once at import time and the original ImageBitmap is closed
// immediately after, rather than keeping several full-resolution copies
// alive at once while the user scans multiple pages.
const WORKING_MAX_DIM = 1900;

export async function decodeToWorkingCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, WORKING_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export function rotateCanvas(source: HTMLCanvasElement, degrees: Rotation): HTMLCanvasElement {
  if (degrees === 0) return source;
  const swapped = degrees === 90 || degrees === 270;
  const out = document.createElement("canvas");
  out.width = swapped ? source.height : source.width;
  out.height = swapped ? source.width : source.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

// Rotates normalized (top-left origin) corner coordinates to match a
// source photo that was itself just rotated by `degrees`, so adjustments
// the user already made aren't thrown away by a simple orientation fix.
export function rotateQuadNormalized(quad: Quad, degrees: Rotation): Quad {
  const rotatePoint = (p: Point): Point => {
    switch (degrees) {
      case 90: return { x: 1 - p.y, y: p.x };
      case 180: return { x: 1 - p.x, y: 1 - p.y };
      case 270: return { x: p.y, y: 1 - p.x };
      default: return p;
    }
  };
  return quad.map(rotatePoint) as Quad;
}

function dist(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }

// A photographed rectangle's true aspect ratio is best estimated from the
// longer of its two opposite edge pairs (the shorter one is foreshortened
// by perspective), which is the standard technique for sizing a
// perspective-corrected crop.
function estimateCropAspect(quadPx: Quad): number {
  const [TL, TR, BR, BL] = quadPx;
  const topW = dist(TL, TR), botW = dist(BL, BR);
  const leftH = dist(TL, BL), rightH = dist(TR, BR);
  const width = Math.max(topW, botW), height = Math.max(leftH, rightH);
  return width / Math.max(1, height);
}

export function renderPageOutput(page: ScanPage, targetLongSide: number): HTMLCanvasElement {
  const w = page.sourceCanvas.width, h = page.sourceCanvas.height;
  const quadPx = page.corners.map(p => ({ x: p.x * w, y: p.y * h })) as Quad;
  const aspect = estimateCropAspect(quadPx);
  const baseW = aspect >= 1 ? targetLongSide : Math.max(1, Math.round(targetLongSide * aspect));
  const baseH = aspect >= 1 ? Math.max(1, Math.round(targetLongSide / aspect)) : targetLongSide;
  const warped = warpQuadToCanvas(page.sourceCanvas, quadPx, baseW, baseH);
  const output = page.outputRotation === 0 ? warped : rotateCanvas(warped, page.outputRotation);
  applyScanFilter(output, page.filter);
  return output;
}

export async function renderThumbnail(page: ScanPage, longSide = 260): Promise<string> {
  const canvas = renderPageOutput(page, longSide);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
  canvas.width = 0; canvas.height = 0; // release the backing store promptly
  if (!blob) return "";
  return URL.createObjectURL(blob);
}
