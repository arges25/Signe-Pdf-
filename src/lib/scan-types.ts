import type { Quad } from "./perspective";
import type { ScanFilter } from "./scan-filters";

export type Rotation = 0 | 90 | 180 | 270;

export type ScanPage = {
  id: string;
  // Working-resolution decoded photo (capped, see WORKING_MAX_DIM in
  // scan-processing.ts) already in its user-corrected source orientation.
  sourceCanvas: HTMLCanvasElement;
  corners: Quad; // normalized 0-1, top-left origin, relative to sourceCanvas
  outputRotation: Rotation; // quick fix applied after crop, from the page list
  filter: ScanFilter;
  thumbnailUrl: string;
};

export type ScanQuality = "standard" | "high" | "maximum";
export const QUALITY_LABELS: Record<ScanQuality, string> = { standard: "Standard", high: "Haute", maximum: "Maximum" };
export const QUALITY_DESCRIPTIONS: Record<ScanQuality, string> = {
  standard: "fichier plus léger",
  high: "bon compromis qualité / taille",
  maximum: "qualité maximale",
};
// maxDim: the longest side of a page's rendered pixel content. jpegQuality:
// the JPEG encoder quality factor. Physical PDF page size (see
// scan-to-pdf.ts) stays constant across tiers — only pixel density and
// compression change, which is what actually trades size for sharpness.
export const QUALITY_PRESETS: Record<ScanQuality, { maxDim: number; jpegQuality: number }> = {
  standard: { maxDim: 1250, jpegQuality: 0.62 },
  high: { maxDim: 1700, jpegQuality: 0.78 },
  maximum: { maxDim: 2100, jpegQuality: 0.9 },
};
