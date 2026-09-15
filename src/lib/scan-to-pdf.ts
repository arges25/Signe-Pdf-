import { renderPageOutput } from "./scan-processing";
import type { QUALITY_PRESETS, ScanPage } from "./scan-types";

// We don't know a photographed document's real-world size, so the
// physical PDF page is assigned the closest common paper size to its
// cropped aspect ratio (kept constant across quality tiers — only pixel
// density and JPEG compression change with quality, never the page size),
// falling back to A4 when nothing matches closely.
function physicalPageSizePt(aspect: number): { widthPt: number; heightPt: number } {
  const A4_RATIO = 297 / 210, LETTER_RATIO = 11 / 8.5;
  const longAspect = Math.max(aspect, 1 / aspect);
  const longInches = Math.abs(longAspect - LETTER_RATIO) < Math.abs(longAspect - A4_RATIO) ? 11 : 11.69;
  const shortInches = longInches / longAspect;
  const [longPt, shortPt] = [longInches * 72, shortInches * 72];
  return aspect >= 1 ? { widthPt: longPt, heightPt: shortPt } : { widthPt: shortPt, heightPt: longPt };
}

export async function buildPdfFromScans(pages: ScanPage[], preset: (typeof QUALITY_PRESETS)[keyof typeof QUALITY_PRESETS]): Promise<Uint8Array> {
  if (!pages.length) throw new Error("Ajoutez au moins une page avant de créer le PDF.");
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();

  for (const page of pages) {
    const canvas = renderPageOutput(page, preset.maxDim);
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", preset.jpegQuality));
      if (!blob) throw new Error("La conversion d’une page a échoué.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const jpg = await doc.embedJpg(bytes);
      const { widthPt, heightPt } = physicalPageSizePt(canvas.width / canvas.height);
      const pdfPage = doc.addPage([widthPt, heightPt]);
      pdfPage.drawImage(jpg, { x: 0, y: 0, width: widthPt, height: heightPt });
    } finally {
      canvas.width = 0; canvas.height = 0;
    }
  }
  return doc.save({ updateFieldAppearances: false });
}
