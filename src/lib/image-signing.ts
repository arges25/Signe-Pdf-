import type { Stamp } from "./pdf-signing";

export type ImageDocument = { bitmap: ImageBitmap; width: number; height: number; mime: string };

// Formats pdf-lib and <canvas>.toBlob can natively read/write. Anything else
// (webp, heic/heif) is decoded by the browser (already required just to
// preview it) and re-encoded to PNG before it can be embedded or exported.
const EMBEDDABLE_MIMES = new Set(["image/png", "image/jpeg"]);

export async function decodeImage(file: File, mime: string): Promise<ImageDocument> {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height, mime };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l’image de la signature."));
    img.src = src;
  });
}

async function bitmapToPngBytes(bitmap: ImageBitmap, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Conversion de l’image impossible.");
  return new Uint8Array(await blob.arrayBuffer());
}

// Builds a single-page PDF sized to the image's own pixel dimensions (1px =
// 1pt), with the image as the page background and the signatures drawn on
// top at their stamped position.
export async function signImageToPdf(
  sourceBytes: Uint8Array,
  image: ImageDocument,
  stamps: Stamp[],
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([image.width, image.height]);

  const baseBytes = EMBEDDABLE_MIMES.has(image.mime) ? sourceBytes : await bitmapToPngBytes(image.bitmap, image.width, image.height);
  const baseImage = image.mime === "image/jpeg" ? await doc.embedJpg(baseBytes) : await doc.embedPng(baseBytes);
  page.drawImage(baseImage, { x: 0, y: 0, width: image.width, height: image.height });

  const signatureImages = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const stamp of stamps) {
    let signatureImage = signatureImages.get(stamp.dataUrl);
    if (!signatureImage) { signatureImage = await doc.embedPng(stamp.dataUrl); signatureImages.set(stamp.dataUrl, signatureImage); }
    page.drawImage(signatureImage, {
      x: stamp.x * image.width,
      // PDF page coordinates are bottom-left origin; stamps are stored as
      // top-left origin fractions (matching the on-screen CSS overlay).
      y: (1 - stamp.y - stamp.h) * image.height,
      width: stamp.w * image.width,
      height: stamp.h * image.height,
    });
  }
  return doc.save({ updateFieldAppearances: false });
}

// Flattens the signatures onto the image itself and re-encodes it. Returns
// the blob actually produced — a browser that can't encode the requested
// type (e.g. some don't support image/webp output) silently falls back to
// PNG per spec, so the caller must name the file after blob.type, not the
// mime it asked for.
export async function signImageToBlob(image: ImageDocument, stamps: Stamp[], outputMime: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image.bitmap, 0, 0, image.width, image.height);
  for (const stamp of stamps) {
    const img = await loadHtmlImage(stamp.dataUrl);
    ctx.drawImage(img, stamp.x * image.width, stamp.y * image.height, stamp.w * image.width, stamp.h * image.height);
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outputMime));
  if (!blob) throw new Error("Conversion de l’image impossible.");
  return blob;
}
