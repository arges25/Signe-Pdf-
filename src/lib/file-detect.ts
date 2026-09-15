// Robust "what did the user just pick" detection. Browsers (especially iOS
// Safari, and files coming from cloud providers or the Files app) often
// report an empty or wrong `File.type`, so the file extension and MIME are
// only ever hints here — the file's own magic-byte signature is checked
// too, and any of the three matching is enough to try opening it. A file is
// only ever reported as unsupported (or, later, corrupt) after a real
// attempt to open it fails — never pre-emptively on a heuristic alone.

export type FileKind = "pdf" | "image" | "unsupported";
export type DetectedFile = { kind: FileKind; mime: string };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
// ISO base media file format "ftyp" brands used by HEIC/HEIF images.
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]);

function matchesAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (offset < 0 || offset + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i++) if (bytes[offset + i] !== signature[i]) return false;
  return true;
}

function containsPdfSignature(bytes: Uint8Array): boolean {
  // The PDF header should be at the very start of the file, but some real-
  // world PDFs (and pdf.js itself tolerates this) have a little leading
  // noise before it, so scan a short window rather than only offset 0.
  const scanLength = Math.min(Math.max(bytes.length - PDF_SIGNATURE.length, 0), 1024);
  for (let i = 0; i <= scanLength; i++) if (matchesAt(bytes, i, PDF_SIGNATURE)) return true;
  return false;
}

function isWebp(bytes: Uint8Array): boolean {
  return matchesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && matchesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50]); // "RIFF"...."WEBP"
}

function isHeif(bytes: Uint8Array): boolean {
  if (!matchesAt(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return false; // "ftyp" box at offset 4
  const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  return HEIF_BRANDS.has(brand);
}

function extensionOf(name: string): string {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

export async function detectFileKind(file: File): Promise<DetectedFile> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const ext = extensionOf(file.name);
  const mime = (file.type || "").toLowerCase();

  if (containsPdfSignature(head) || ext === ".pdf" || mime === "application/pdf") {
    return { kind: "pdf", mime: "application/pdf" };
  }
  if (matchesAt(head, 0, PNG_SIGNATURE) || ext === ".png" || mime === "image/png") {
    return { kind: "image", mime: "image/png" };
  }
  if (matchesAt(head, 0, JPEG_SIGNATURE) || ext === ".jpg" || ext === ".jpeg" || mime === "image/jpeg" || mime === "image/jpg") {
    return { kind: "image", mime: "image/jpeg" };
  }
  if (isWebp(head) || ext === ".webp" || mime === "image/webp") {
    return { kind: "image", mime: "image/webp" };
  }
  if (isHeif(head) || ext === ".heic" || ext === ".heif" || mime === "image/heic" || mime === "image/heif") {
    return { kind: "image", mime: ext === ".heif" || mime === "image/heif" ? "image/heif" : "image/heic" };
  }
  return { kind: "unsupported", mime };
}
