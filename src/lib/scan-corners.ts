import type { Quad } from "./perspective";
import { defaultCorners } from "./perspective";

// Best-effort document-edge detection with no external CV library:
// classify pixels as "paper" or "background" via a global brightness
// threshold (Otsu), then scan inward from each edge to find where each
// row/column crosses from mostly-background to mostly-paper. This is
// deliberately brightness-based rather than raw-edge-based — a first
// attempt using summed gradient magnitude was fooled by dense text inside
// the page (lots of small internal edges outscoring the one real
// boundary); a paper region reads as "mostly bright" per row/column even
// with text on it, so thresholding is far more robust for the common
// "document on a contrasting background" case this targets. Done
// separately for each half of the image so mild rotation/skew still
// produces a non-axis-aligned quad. Always safe to fall back from since
// the caller lets the user drag every corner afterward regardless.
export function detectDocumentCorners(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Quad | null {
  try {
    const workW = 220;
    const workH = Math.max(1, Math.round((workW * sourceHeight) / sourceWidth));
    const canvas = document.createElement("canvas");
    canvas.width = workW; canvas.height = workH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, workW, workH);
    const { data } = ctx.getImageData(0, 0, workW, workH);

    const gray = new Float32Array(workW * workH);
    for (let i = 0; i < workW * workH; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[Math.round(gray[i])]++;
    const total = gray.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, weightB = 0, threshold = 0, bestVariance = -1;
    for (let t = 0; t < 256; t++) {
      weightB += hist[t];
      if (weightB === 0) continue;
      const weightF = total - weightB;
      if (weightF === 0) break;
      sumB += t * hist[t];
      const meanB = sumB / weightB, meanF = (sum - sumB) / weightF;
      const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
      if (between > bestVariance) { bestVariance = between; threshold = t; }
    }

    function rowBrightFraction(y: number, loX: number, hiX: number): number {
      let count = 0;
      for (let x = loX; x < hiX; x++) if (gray[y * workW + x] > threshold) count++;
      return count / Math.max(1, hiX - loX);
    }
    function colBrightFraction(x: number, loY: number, hiY: number): number {
      let count = 0;
      for (let y = loY; y < hiY; y++) if (gray[y * workW + x] > threshold) count++;
      return count / Math.max(1, hiY - loY);
    }
    const findTopEdge = (loY: number, hiY: number, loX: number, hiX: number) => { for (let y = loY; y < hiY; y++) if (rowBrightFraction(y, loX, hiX) > 0.5) return y; return loY; };
    const findBottomEdge = (loY: number, hiY: number, loX: number, hiX: number) => { for (let y = hiY - 1; y >= loY; y--) if (rowBrightFraction(y, loX, hiX) > 0.5) return y; return hiY - 1; };
    const findLeftEdge = (loX: number, hiX: number, loY: number, hiY: number) => { for (let x = loX; x < hiX; x++) if (colBrightFraction(x, loY, hiY) > 0.5) return x; return loX; };
    const findRightEdge = (loX: number, hiX: number, loY: number, hiY: number) => { for (let x = hiX - 1; x >= loX; x--) if (colBrightFraction(x, loY, hiY) > 0.5) return x; return hiX - 1; };

    const midX = Math.round(workW / 2), midY = Math.round(workH / 2);

    const topY_left = findTopEdge(1, workH - 1, 1, midX);
    const topY_right = findTopEdge(1, workH - 1, midX, workW - 1);
    const bottomY_left = findBottomEdge(1, workH - 1, 1, midX);
    const bottomY_right = findBottomEdge(1, workH - 1, midX, workW - 1);
    const leftX_top = findLeftEdge(1, workW - 1, 1, midY);
    const leftX_bottom = findLeftEdge(1, workW - 1, midY, workH - 1);
    const rightX_top = findRightEdge(1, workW - 1, 1, midY);
    const rightX_bottom = findRightEdge(1, workW - 1, midY, workH - 1);

    const quadPx: Quad = [
      { x: leftX_top, y: topY_left },
      { x: rightX_top, y: topY_right },
      { x: rightX_bottom, y: bottomY_right },
      { x: leftX_bottom, y: bottomY_left },
    ];

    // Sanity checks: plausible ordering and a large-enough enclosed area,
    // otherwise this guess is probably noise (e.g. a near-uniform photo
    // with no real contrast) — let the caller fall back.
    const area = Math.abs(
      quadPx[0].x * quadPx[1].y - quadPx[1].x * quadPx[0].y +
      quadPx[1].x * quadPx[2].y - quadPx[2].x * quadPx[1].y +
      quadPx[2].x * quadPx[3].y - quadPx[3].x * quadPx[2].y +
      quadPx[3].x * quadPx[0].y - quadPx[0].x * quadPx[3].y,
    ) / 2;
    const minArea = workW * workH * 0.15;
    const plausibleOrder = quadPx[0].y < quadPx[3].y + workH * 0.05 && quadPx[1].y < quadPx[2].y + workH * 0.05
      && quadPx[0].x < quadPx[1].x + workW * 0.05 && quadPx[3].x < quadPx[2].x + workW * 0.05;
    if (area < minArea || !plausibleOrder) return null;

    return quadPx.map(p => ({ x: p.x / workW, y: p.y / workH })) as Quad;
  } catch {
    return null;
  }
}

export function detectOrDefaultCorners(source: CanvasImageSource, width: number, height: number): Quad {
  return detectDocumentCorners(source, width, height) ?? defaultCorners();
}
