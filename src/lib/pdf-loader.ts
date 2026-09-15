import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DetectedFile } from "./file-detect";

export type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
export type PdfErrorCategory = "password" | "corrupt" | "engine" | "worker" | "not-pdf";

// Five distinct, user-facing diagnoses instead of one catch-all message, so
// "wrong password" doesn't look like "corrupted file" or "our code broke".
function diagnosePdfError(e: unknown, pdfjs: PdfjsModule | undefined, signatureMatched: boolean): { category: PdfErrorCategory; message: string } {
  const err = e instanceof Error ? e : new Error(String(e));
  if (pdfjs && err instanceof pdfjs.PasswordException) {
    return { category: "password", message: "Ce PDF est protégé par un mot de passe. Ouvrez une copie déverrouillée pour la signer." };
  }
  if (pdfjs && err instanceof pdfjs.InvalidPDFException) {
    return signatureMatched
      ? { category: "corrupt", message: "Ce PDF semble corrompu ou endommagé. Essayez de le réexporter, ou utilisez une autre copie." }
      : { category: "not-pdf", message: "Ce fichier n’est pas un PDF valide, malgré son nom ou son extension." };
  }
  if (!pdfjs || /worker|failed to fetch|networkerror|load failed|importing a module/i.test(err.message)) {
    return { category: "worker", message: "Le composant technique de lecture des PDF n’a pas pu être chargé. Rechargez la page (tirez vers le bas sur iPhone) et réessayez." };
  }
  if (!signatureMatched) {
    return { category: "not-pdf", message: "Ce fichier n’est pas un PDF valide, malgré son nom ou son extension." };
  }
  return { category: "engine", message: "Le moteur de lecture PDF a rencontré une erreur inattendue. Réessayez, ou avec un autre fichier." };
}

export type PdfLoadSuccess = { ok: true; doc: PDFDocumentProxy; bytes: Uint8Array; width: number; height: number };
export type PdfLoadFailure = { ok: false; category: PdfErrorCategory; message: string };

// Shared, robust PDF-opening path used by both the signing and the editing
// tools: reads the raw bytes directly (file.arrayBuffer(), never a fragile
// URL), resolves the pdf.js worker/cmaps/fonts/wasm relative to
// import.meta.env.BASE_URL (so it works both at the domain root and under
// the GitHub Pages /Signe-Pdf-/ subpath), and reports a precise, logged
// diagnosis instead of a single generic error.
export async function loadPdfDocument(file: File, detected: DetectedFile): Promise<PdfLoadSuccess | PdfLoadFailure> {
  let newDoc: PDFDocumentProxy | null = null;
  let pdfjs: PdfjsModule | undefined;
  let workerSrc = "";
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const assetsUrl = `${import.meta.env.BASE_URL}pdf-assets/`;
    workerSrc = `${assetsUrl}pdf.worker.min.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    console.info("[Signé] Ouverture du PDF…", { name: file.name, size: file.size, type: file.type || "(vide)", signatureMatched: detected.signatureMatched, workerSrc, baseUrl: import.meta.env.BASE_URL });
    const task = pdfjs.getDocument({ data: bytes.slice(), cMapUrl: `${assetsUrl}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assetsUrl}standard_fonts/`, wasmUrl: `${assetsUrl}wasm/` });
    try { newDoc = await task.promise; } catch (e) { await task.destroy(); throw e; }
    if (!newDoc.numPages) throw new Error("Ce document ne contient aucune page.");
    const first = await newDoc.getPage(1);
    const viewport = first.getViewport({ scale: 1 });
    return { ok: true, doc: newDoc, bytes, width: viewport.width, height: viewport.height };
  } catch (e) {
    if (newDoc) void newDoc.loadingTask.destroy();
    const diagnosis = diagnosePdfError(e, pdfjs, detected.signatureMatched);
    console.error(`[Signé] Échec d’ouverture du PDF — catégorie: ${diagnosis.category}`, { name: file.name, size: file.size, type: file.type || "(vide)", signatureMatched: detected.signatureMatched, workerSrc, errorName: e instanceof Error ? e.name : typeof e, errorMessage: e instanceof Error ? e.message : String(e), error: e });
    return { ok: false, ...diagnosis };
  }
}
