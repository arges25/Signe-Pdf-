export type ScanFilter = "original" | "auto" | "color" | "bw" | "grayscale" | "contrast";

export const FILTER_LABELS: Record<ScanFilter, string> = {
  original: "Original",
  auto: "Auto",
  color: "Couleur",
  bw: "Noir et blanc",
  grayscale: "Niveaux de gris",
  contrast: "Contraste élevé",
};

// Per-channel histogram stretch (a.k.a. auto-levels): remap so the 0.5th
// and 99.5th percentile of each channel become black and white, clipping
// the rest. Mild and safe — unlike full auto-contrast, a small clip
// percentile keeps text from blowing out.
function channelStretch(data: Uint8ClampedArray, clipPercent = 0.5) {
  for (let channel = 0; channel < 3; channel++) {
    const hist = new Uint32Array(256);
    for (let i = channel; i < data.length; i += 4) hist[data[i]]++;
    const total = data.length / 4;
    const clip = total * (clipPercent / 100);
    let lo = 0, acc = 0;
    for (; lo < 255; lo++) { acc += hist[lo]; if (acc > clip) break; }
    let hi = 255; acc = 0;
    for (; hi > 0; hi--) { acc += hist[hi]; if (acc > clip) break; }
    if (hi <= lo) continue;
    const scale = 255 / (hi - lo);
    for (let i = channel; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, Math.round((data[i] - lo) * scale)));
    }
  }
}

function toGrayscale(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
}

function applyContrast(data: Uint8ClampedArray, amount: number) {
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
  }
}

// Adaptive-ish threshold: use the luminance histogram's midpoint between
// its two dominant clusters (a cheap Otsu approximation) rather than a
// fixed 128, so both dark and bright photos binarize sensibly.
function otsuThreshold(data: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[Math.round(data[i])]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) { bestVar = between; best = t; }
  }
  return best;
}

// Cheap 3x3 sharpen (unsharp-mask-like) convolution, applied in place on a
// fresh copy so neighbours read the original values.
function sharpen(data: Uint8ClampedArray, width: number, height: number, amount = 0.35) {
  const src = new Uint8ClampedArray(data);
  const idx = (x: number, y: number, c: number) => (y * width + x) * 4 + c;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const center = src[idx(x, y, c)];
        const neighbourAvg = (src[idx(x - 1, y, c)] + src[idx(x + 1, y, c)] + src[idx(x, y - 1, c)] + src[idx(x, y + 1, c)]) / 4;
        data[idx(x, y, c)] = Math.max(0, Math.min(255, center + (center - neighbourAvg) * amount));
      }
    }
  }
}

export function applyScanFilter(canvas: HTMLCanvasElement, filter: ScanFilter) {
  if (filter === "original") return;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  switch (filter) {
    case "color":
      channelStretch(data, 0.4);
      break;
    case "grayscale":
      toGrayscale(data);
      channelStretch(data, 0.4);
      break;
    case "contrast":
      toGrayscale(data);
      channelStretch(data, 0.3);
      applyContrast(data, 35);
      break;
    case "bw": {
      toGrayscale(data);
      channelStretch(data, 0.3);
      const threshold = otsuThreshold(data);
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i] > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      break;
    }
    case "auto":
      channelStretch(data, 0.5);
      applyContrast(data, 12);
      sharpen(data, canvas.width, canvas.height, 0.25);
      break;
  }
  ctx.putImageData(imageData, 0, 0);
}
