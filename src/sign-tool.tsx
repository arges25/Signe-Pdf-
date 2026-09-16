import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck, FileCheck2, FileText, FolderOpen, Grip, Image as ImageIcon, LoaderCircle, LockKeyhole, Minus, MousePointer2, PenLine, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Empty, EmptyHeader, EmptyDescription, EmptyTitle, EmptyContent } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import SignatureDialog from "./signature-dialog";
import ExportDialog, { type ExportFormat } from "./export-dialog";
import { clamp, signPdf, type SignatureAsset, type Stamp } from "@/lib/pdf-signing";
import { clearSavedSignature, loadSavedSignature, saveSignature } from "@/lib/signature-store";
import { detectFileKind } from "@/lib/file-detect";
import { decodeImage, signImageToBlob, signImageToPdf, type ImageDocument } from "@/lib/image-signing";
import { loadPdfDocument } from "@/lib/pdf-loader";
import { BrandWordmark, PrivacyBadge } from "./brand-wordmark";

const supportsFileSystemAccess = typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
function supportsShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    const probe = new File([""], "test.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch { return false; }
}
const saveHint = supportsFileSystemAccess
  ? "Vous pourrez choisir l’emplacement et le nom du fichier."
  : supportsShareFiles()
    ? "Utilisez le menu Partager pour l’enregistrer dans Fichiers (iPhone/Android) ou l’envoyer ailleurs."
    : "Le fichier sera téléchargé par votre navigateur.";

const RE_ENCODABLE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
function imageFormatLabel(mime: string): string {
  if (mime === "image/jpeg") return "JPEG";
  if (mime === "image/webp") return "WEBP";
  return "PNG";
}
function imageFormatExtension(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}
function blobExtension(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "pdf";
}

type Drag = {
  id: string; rect: DOMRect;
  pointerId: number; startClientX: number; startClientY: number; liveX: number; liveY: number;
  startX: number; startY: number; startW: number; startH: number;
  pointer2Id?: number; liveX2?: number; liveY2?: number; pinchStartDist?: number;
};
type Resize = { id: string; corner: "tl" | "tr" | "bl" | "br"; pointerId: number; startClientX: number; startX: number; startY: number; startW: number; startH: number };
type ModelTool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };

export default function SignTool({ onBack, handoff }: { onBack?: () => void; handoff?: { file: File; token: number } | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const imageRef = useRef<ImageDocument | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const resizeRef = useRef<Resize | null>(null);
  const objectUrl = useRef<string | null>(null);
  const dropDepth = useRef(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [image, setImage] = useState<ImageDocument | null>(null);
  const [filename, setFilename] = useState("");
  const [filesize, setFilesize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [page, setPage] = useState(1);
  const [pageEntry, setPageEntry] = useState("1");
  const [stageWidth, setStageWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 });
  const [rendering, setRendering] = useState(false);
  const [renderedPage, setRenderedPage] = useState(0);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [asset, setAsset] = useState<SignatureAsset | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const docLoaded = !!pdf || !!image;
  const totalPages = pdf ? pdf.numPages : image ? 1 : 0;
  const active = stamps.find(s => s.id === selected);
  const ready = docLoaded && renderedPage === page && !rendering && !loading;
  const currentStep = !docLoaded ? 1 : stamps.length ? 3 : 2;
  const maxPageWidth = Math.min(dimensions.width, 840);
  const fittedWidth = Math.max(160, Math.min(stageWidth - (stageWidth < 600 ? 24 : 72), maxPageWidth));
  const displayWidth = fittedWidth * zoom;
  const displayHeight = displayWidth * dimensions.height / dimensions.width;
  const stateRef = useRef({ loaded: false, totalPages: 0, currentPage: 1, signatures: [] as { page: number; count: number }[] });
  stateRef.current = { loaded: docLoaded, totalPages, currentPage: page,
    signatures: [...new Set(stamps.map(s => s.page))].sort((a,b) => a-b).map(p => ({ page: p, count: stamps.filter(s => s.page === p).length })) };

  const exportFormats: ExportFormat[] = pdf
    ? [{ id: "pdf", label: "PDF", extension: "pdf", description: "seul format qui ne dégrade pas le document" }]
    : image
      ? [
          { id: "pdf", label: "PDF", extension: "pdf", description: "un document, une page" },
          RE_ENCODABLE_MIMES.has(image.mime)
            ? { id: "image", label: imageFormatLabel(image.mime), extension: imageFormatExtension(image.mime), description: "comme le fichier d’origine" }
            : { id: "image", label: "PNG", extension: "png", description: "le format d’origine ne peut pas être ré-exporté depuis le navigateur" },
        ]
      : [];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage); return () => observer.disconnect();
  }, []);
  useEffect(() => { void loadSavedSignature().then(saved => { if (saved) setAsset(current => current ?? saved); }); }, []);
  useEffect(() => { setPageEntry(String(page)); setSelected(null); }, [page]);
  useEffect(() => () => { void docRef.current?.loadingTask.destroy(); imageRef.current?.bitmap.close(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: ModelTool, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({ name: "get_pdf_signing_status", description: "Lire la page affichée et le nombre de signatures ajoutées à chaque page du document ouvert, sans lire son contenu.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) {
        if (input === null || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Un objet vide est attendu.");
        return stateRef.current;
      } }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null; setDownload(null);
  }, [stamps, pdf, image]);

  useEffect(() => {
    if (!pdf && !image) return;
    let stopped = false;
    let task: RenderTask | undefined;
    setRendering(true); setError("");
    (async () => {
      try {
        if (pdf) {
          const p = await pdf.getPage(page);
          if (stopped) return;
          const base = p.getViewport({ scale: 1 });
          if (dimensions.width !== base.width || dimensions.height !== base.height) {
            setDimensions({ width: base.width, height: base.height });
            return;
          }
          const outputScale = Math.min(window.devicePixelRatio || 1, 2, 3200 / Math.max(displayWidth, displayHeight));
          const viewport = p.getViewport({ scale: displayWidth / base.width * outputScale });
          const buffer = document.createElement("canvas");
          buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
          task = p.render({ canvas: buffer, canvasContext: buffer.getContext("2d")!, viewport });
          await task.promise;
          if (stopped || !canvasRef.current) return;
          const target = canvasRef.current;
          target.width = buffer.width; target.height = buffer.height;
          target.getContext("2d")!.drawImage(buffer, 0, 0);
          setRenderedPage(page); setRendering(false);
        } else if (image) {
          if (!canvasRef.current) return;
          const outputScale = Math.min(window.devicePixelRatio || 1, 2, 3200 / Math.max(displayWidth, displayHeight));
          const target = canvasRef.current;
          target.width = Math.ceil(displayWidth * outputScale); target.height = Math.ceil(displayHeight * outputScale);
          target.getContext("2d")!.drawImage(image.bitmap, 0, 0, target.width, target.height);
          if (stopped) return;
          setRenderedPage(1); setRendering(false);
        }
      } catch (e) {
        if (stopped || (e as Error).name === "RenderingCancelledException") return;
        setRendering(false); setRenderedPage(0);
        setError("Cette page ne peut pas être affichée. Essayez une autre page ou un autre fichier.");
      }
    })();
    return () => { stopped = true; task?.cancel(); };
  }, [pdf, image, page, displayWidth, displayHeight, dimensions.width, dimensions.height]);

  const loadFile = useCallback(async (file: File) => {
    if (busyRef.current) return;
    if (file.size > 30 * 1024 * 1024) { setError("Ce fichier dépasse 30 Mo. Choisissez un fichier plus léger."); return; }
    if (!file.size) { setError("Ce fichier est vide. Choisissez un autre fichier."); return; }
    busyRef.current = true; setLoading(true); setError("");
    try {
      const detected = await detectFileKind(file);
      if (detected.kind === "unsupported") {
        setError("Format non pris en charge. Formats acceptés : PDF, JPG, PNG et WEBP.");
        return;
      }
      if (detected.kind === "pdf") {
        const result = await loadPdfDocument(file, detected);
        if (!result.ok) {
          setError(result.message);
        } else {
          const previousDoc = docRef.current;
          const previousImage = imageRef.current;
          docRef.current = result.doc; imageRef.current = null; bytesRef.current = result.bytes;
          setImage(null); setPdf(result.doc); setFilename(file.name); setFilesize(file.size);
          setPage(1); setPageEntry("1"); setZoom(1); setRenderedPage(0);
          setDimensions({ width: result.width, height: result.height });
          setStamps([]); setSelected(null); setPlacing(false);
          if (previousDoc) void previousDoc.loadingTask.destroy();
          previousImage?.bitmap.close();
          toast.success("Votre PDF est prêt à être signé.");
        }
      } else {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const decoded = await decodeImage(file, detected.mime);
          const previousDoc = docRef.current;
          const previousImage = imageRef.current;
          imageRef.current = decoded; docRef.current = null; bytesRef.current = bytes;
          setPdf(null); setImage(decoded); setFilename(file.name); setFilesize(file.size);
          setPage(1); setPageEntry("1"); setZoom(1); setRenderedPage(0);
          setDimensions({ width: decoded.width, height: decoded.height });
          setStamps([]); setSelected(null); setPlacing(false);
          if (previousDoc) void previousDoc.loadingTask.destroy();
          previousImage?.bitmap.close();
          toast.success("Votre image est prête à être signée.");
        } catch {
          setError(detected.mime === "image/heic" || detected.mime === "image/heif"
            ? "Ce format (HEIC/HEIF) n’est pas pris en charge par votre navigateur. Essayez une photo en JPG ou PNG."
            : "Impossible d’ouvrir ce fichier. Vérifiez qu’il s’agit d’une image valide et non corrompue.");
        }
      }
    } finally { busyRef.current = false; setLoading(false); }
  }, []);

  const handoffToken = handoff?.token;
  useEffect(() => { if (handoff) void loadFile(handoff.file); }, [handoffToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseFile(file?: File) {
    if (!file || busyRef.current) return;
    if (docLoaded && stamps.length) setPendingFile(file); else void loadFile(file);
  }
  function goToPage(value: number) {
    if (!docLoaded || loading || exporting) return;
    const next = clamp(Math.round(value), 1, totalPages);
    setPage(next); setPageEntry(String(next)); setSelected(null);
  }
  function placeAt(x: number, y: number) {
    if (!asset || !ready || exporting) return;
    const w = Math.min(0.34, 0.24 * dimensions.height / dimensions.width * asset.width / asset.height);
    const h = w * dimensions.width / dimensions.height * asset.height / asset.width;
    const stamp: Stamp = { ...asset, id: crypto.randomUUID(), page, x: clamp(x - w / 2, 0, 1 - w), y: clamp(y - h / 2, 0, 1 - h), w, h };
    setStamps(items => [...items, stamp]); setSelected(stamp.id); setPlacing(false);
  }
  function startDrag(e: PointerEvent<HTMLButtonElement>, stamp: Stamp) {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!pageRef.current || !ready || exporting) return;
    const rect = pageRef.current.getBoundingClientRect();
    const existing = dragRef.current;
    // A second finger landing on the same stamp starts a pinch gesture instead
    // of a second independent drag — the first finger's live position feeds
    // the distance calculation from here on.
    if (existing && existing.id === stamp.id && existing.pointerId !== e.pointerId && existing.pointer2Id === undefined) {
      existing.pointer2Id = e.pointerId; existing.liveX2 = e.clientX; existing.liveY2 = e.clientY;
      existing.pinchStartDist = Math.hypot(existing.liveX - e.clientX, existing.liveY - e.clientY) || 1;
      existing.startX = stamp.x; existing.startY = stamp.y; existing.startW = stamp.w; existing.startH = stamp.h;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer session already gone — the move/up handlers below still no-op safely */ }
      return;
    }
    if (existing) return;
    e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); setSelected(stamp.id); setPlacing(false);
    dragRef.current = {
      id: stamp.id, rect, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY,
      liveX: e.clientX, liveY: e.clientY, startX: stamp.x, startY: stamp.y, startW: stamp.w, startH: stamp.h,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer session already gone — the move/up handlers below still no-op safely */ }
  }
  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.pointerId === drag.pointerId) { drag.liveX = e.clientX; drag.liveY = e.clientY; }
    else if (drag.pointer2Id !== undefined && e.pointerId === drag.pointer2Id) { drag.liveX2 = e.clientX; drag.liveY2 = e.clientY; }
    else return;

    if (drag.pointer2Id !== undefined && drag.liveX2 !== undefined && drag.liveY2 !== undefined) {
      const dist = Math.hypot(drag.liveX - drag.liveX2, drag.liveY - drag.liveY2) || 1;
      const scale = dist / (drag.pinchStartDist || 1);
      const aspect = drag.startH / drag.startW;
      let w = clamp(drag.startW * scale, 0.03, 0.9);
      let h = w * aspect;
      if (h > 0.95) { h = 0.95; w = h / aspect; }
      const cx = drag.startX + drag.startW / 2, cy = drag.startY + drag.startH / 2;
      const x = clamp(cx - w / 2, 0, 1 - w), y = clamp(cy - h / 2, 0, 1 - h);
      setStamps(items => items.map(s => s.id === drag.id ? { ...s, w, h, x, y } : s));
    } else {
      const x = clamp(drag.startX + (drag.liveX - drag.startClientX) / drag.rect.width, 0, 1 - drag.startW);
      const y = clamp(drag.startY + (drag.liveY - drag.startClientY) / drag.rect.height, 0, 1 - drag.startH);
      setStamps(items => items.map(s => s.id === drag.id ? { ...s, x, y } : s));
    }
  }
  function stopDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (drag && (e.pointerId === drag.pointerId || e.pointerId === drag.pointer2Id)) dragRef.current = null;
  }
  function startResizeHandle(e: PointerEvent<HTMLSpanElement>, stamp: Stamp, corner: Resize["corner"]) {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!ready || exporting || resizeRef.current) return;
    e.preventDefault();
    resizeRef.current = { id: stamp.id, corner, pointerId: e.pointerId, startClientX: e.clientX, startX: stamp.x, startY: stamp.y, startW: stamp.w, startH: stamp.h };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer session already gone — the move/up handlers below still no-op safely */ }
    setSelected(stamp.id);
  }
  function moveResizeHandle(e: PointerEvent<HTMLSpanElement>) {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const dxFrac = (e.clientX - r.startClientX) / rect.width;
    const aspect = r.startH / r.startW;
    const sign = r.corner === "tl" || r.corner === "bl" ? -1 : 1;
    let w = clamp(r.startW + sign * dxFrac, 0.03, 0.9);
    let h = w * aspect;
    if (h > 0.95) { h = 0.95; w = h / aspect; }
    let x = r.corner === "tl" || r.corner === "bl" ? r.startX + r.startW - w : r.startX;
    let y = r.corner === "tl" || r.corner === "tr" ? r.startY + r.startH - h : r.startY;
    x = clamp(x, 0, 1 - w); y = clamp(y, 0, 1 - h);
    setStamps(items => items.map(s => s.id === r.id ? { ...s, w, h, x, y } : s));
  }
  function stopResizeHandle(e: PointerEvent<HTMLSpanElement>) {
    if (resizeRef.current?.pointerId === e.pointerId) resizeRef.current = null;
  }
  function moveWithKeys(e: KeyboardEvent<HTMLButtonElement>, stamp: Stamp) {
    if (exporting) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault(); const [dx, dy] = moves[e.key], step = e.shiftKey ? 0.02 : 0.003;
      setStamps(items => items.map(s => s.id === stamp.id ? { ...s, x: clamp(s.x + dx * step, 0, 1 - s.w), y: clamp(s.y + dy * step, 0, 1 - s.h) } : s));
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeStamp(stamp.id); }
  }
  function removeStamp(id: string) {
    if (exporting) return;
    const removed = stamps.find(s => s.id === id);
    setStamps(items => items.filter(s => s.id !== id)); setSelected(null);
    toast("Signature supprimée", { action: { label: "Annuler", onClick: () => { if (!busyRef.current && removed && (docRef.current === pdf || imageRef.current === image)) setStamps(items => [...items, removed]); } } });
  }
  function resizeStamp(percent: number) {
    if (!active || exporting) return;
    const w = percent / 100, h = w * dimensions.width / dimensions.height * active.height / active.width;
    if (h > 0.95) return;
    setStamps(items => items.map(s => s.id === active.id ? { ...s, w, h, x: clamp(s.x, 0, 1 - w), y: clamp(s.y, 0, 1 - h) } : s));
  }
  function deleteSavedSignature() {
    if (exporting) return;
    const previous = asset;
    setAsset(null); setPlacing(false);
    void clearSavedSignature();
    toast("Signature enregistrée supprimée de cet appareil", previous ? { action: { label: "Annuler", onClick: () => { setAsset(previous); void saveSignature(previous); } } } : undefined);
  }

  async function confirmExport(name: string, formatId: string) {
    if ((!pdf && !image) || !bytesRef.current || !stamps.length || busyRef.current) return;
    const extension = pdf ? "pdf" : formatId === "image" && image ? imageFormatExtension(image.mime) : "pdf";
    const finalName = `${name}.${extension}`;
    busyRef.current = true; setExporting(true); setError("");
    try {
      // Ask for a save location first, before signing/converting, so the
      // picker still benefits from the user gesture that triggered this.
      let handle: FileSystemFileHandle | null = null;
      if (supportsFileSystemAccess) {
        try {
          const mime = extension === "pdf" ? "application/pdf" : `image/${extension === "jpg" ? "jpeg" : extension}`;
          handle = await window.showSaveFilePicker!({
            suggestedName: finalName,
            types: [{ description: extension === "pdf" ? "Document PDF" : "Image", accept: { [mime]: [`.${extension}`] } }],
          });
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // user cancelled the picker
          handle = null; // unexpected failure: fall back to another method
        }
      }

      let blob: Blob;
      if (pdf) {
        const signed = await signPdf(bytesRef.current, pdf, stamps);
        blob = new Blob([new Uint8Array(signed)], { type: "application/pdf" });
      } else if (image && formatId === "image") {
        const outputMime = RE_ENCODABLE_MIMES.has(image.mime) ? image.mime : "image/png";
        blob = await signImageToBlob(image, stamps, outputMime);
      } else if (image) {
        const signed = await signImageToPdf(bytesRef.current, image, stamps);
        blob = new Blob([new Uint8Array(signed)], { type: "application/pdf" });
      } else return;

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success("Votre document signé a été enregistré.");
        setExportOpen(false);
        return;
      }

      const actualName = name + "." + blobExtension(blob.type);
      const file = new File([blob], actualName, { type: blob.type });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: actualName });
          toast.success("Votre document signé est prêt.");
          setExportOpen(false);
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // user cancelled the share sheet
          // unexpected failure: fall back to a plain download below
        }
      }

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(blob); objectUrl.current = url;
      setDownload({ url, name: actualName });
      const link = document.createElement("a"); link.href = url; link.download = actualName;
      document.body.appendChild(link); link.click(); link.remove();
      toast.success("Votre document signé est prêt.");
      setExportOpen(false);
    } catch { setError("Le téléchargement n’a pas pu être préparé. Réessayez avec ce fichier ou une copie non protégée."); }
    finally { busyRef.current = false; setExporting(false); }
  }

  return <div className="app-shell">
    <header className="site-header">
      {onBack && <Button variant="ghost" className="back-button" onClick={onBack}><ArrowLeft size={16} /> Accueil</Button>}
      <BrandWordmark />
      <PrivacyBadge />
    </header>
    <main className="main-content">
      <div className="workspace-heading"><div><p className="eyebrow">VOTRE ESPACE DE SIGNATURE</p><h1>Signer un document</h1></div>
        <ol className="steps" aria-label="Progression">
          {[[1, "Importer"], [2, "Signer"], [3, "Télécharger"]].map(([number, title]) => <li key={number} className={currentStep >= Number(number) ? "step is-current" : "step"} aria-current={currentStep === number ? "step" : undefined}><span className="step-number">{currentStep > Number(number) ? <Check size={13} /> : number}</span><span>{title}</span>{number !== 3 && <span className="step-line" />}</li>)}
        </ol>
      </div>
      <div className="editor-shell">
        <aside className="tools-panel" aria-label="Outils de signature">
          <section className="tool-section document-section"><div className="section-heading"><span className="section-number">01</span><h2>Le document</h2>{docLoaded && <CircleCheck size={16} className="success-icon" />}</div>
            {docLoaded ? <><div className="file-card"><span className="file-symbol">{image ? <ImageIcon size={23} /> : <FileText size={23} />}</span><div><strong title={filename}>{filename}</strong><span>{totalPages} page{totalPages > 1 ? "s" : ""} · {(filesize / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo</span></div></div><Button variant="ghost" className="change-file" disabled={loading || exporting} onClick={() => fileInput.current?.click()}><FolderOpen /> Changer de fichier</Button></>
              : <p className="section-copy">Importez le fichier que vous souhaitez signer.</p>}
          </section>
          <section className={`tool-section signature-section ${!docLoaded ? "section-waiting" : ""}`}><div className="section-heading"><span className="section-number">02</span><h2>Votre signature</h2></div>
            {asset ? <><button className="saved-signature" disabled={!ready || exporting} onClick={() => setPlacing(true)} aria-label="Placer votre signature sur le document"><img src={asset.dataUrl} alt="Votre signature" /><Plus size={16} className="signature-plus" /></button><Button variant="outline" className="add-signature" disabled={!ready || exporting} onClick={() => setPlacing(!placing)}><Plus />{placing ? "Cliquez sur la page…" : "Placer sur la page"}</Button><div className="saved-signature-actions"><Button variant="ghost" className="new-signature" disabled={exporting || loading} onClick={() => setSignatureOpen(true)}>Modifier ma signature</Button><Button variant="ghost" className="forget-signature" disabled={exporting || loading} onClick={deleteSavedSignature}>Supprimer ma signature enregistrée</Button></div></>
              : <><p className="section-copy">Une touche personnelle.<br />Dessinez-la ou saisissez votre nom.</p><Button variant="outline" className="add-signature" disabled={exporting} onClick={() => setSignatureOpen(true)}><PenLine /> Créer ma signature</Button></>}
            {active && <div className="selection-controls"><div className="size-label"><label id="signature-size-label">Taille de la signature</label><span>{Math.round(active.w * 100)} %</span></div><Slider min={5} max={Math.floor(Math.min(75, 95 * dimensions.height / dimensions.width * active.width / active.height))} step={1} value={[Math.round(active.w * 100)]} onValueChange={([value]) => resizeStamp(value)} aria-labelledby="signature-size-label" disabled={exporting} /><p className="move-hint"><Grip size={14} /> Faites glisser pour la déplacer.</p><Button variant="ghost" className="delete-signature" onClick={() => removeStamp(active.id)} disabled={exporting}><Trash2 /> Supprimer cette signature</Button></div>}
          </section>
          <section className="tool-section export-section"><div className="section-heading"><span className="section-number">03</span><h2>C’est signé</h2></div><p className="section-copy">{stamps.length ? `${stamps.length} signature${stamps.length > 1 ? "s" : ""} ajoutée${stamps.length > 1 ? "s" : ""} au document.` : "Votre document signé, prêt à télécharger."}</p><Button className="primary-button export-button" onClick={() => { setPlacing(false); setExportOpen(true); }} disabled={!docLoaded || !stamps.length || loading || exporting}>{exporting ? <LoaderCircle className="spin" /> : <ArrowDownToLine />}{exporting ? "Préparation du fichier…" : "Télécharger le document"}</Button><div className="privacy-note"><LockKeyhole size={14} /><span>Aucun document envoyé en ligne</span></div></section>
        </aside>
        <section className="document-workspace" aria-label="Aperçu du document">
          <div className="document-toolbar"><div className="toolbar-name"><FileText size={16} /><span>{docLoaded ? filename : "Aperçu du document"}</span></div><div className="zoom-controls"><Button variant="ghost" size="icon" aria-label="Réduire l’aperçu" disabled={!docLoaded || zoom <= 0.5 || exporting} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><Minus /></Button><button className="zoom-value" disabled={!docLoaded} onClick={() => setZoom(1)} title="Ajuster à la largeur">{Math.round(zoom * 100)} %</button><Button variant="ghost" size="icon" aria-label="Agrandir l’aperçu" disabled={!docLoaded || zoom >= 2.5 || exporting} onClick={() => setZoom(z => Math.min(2.5, z + 0.25))}><Plus /></Button></div></div>
          {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Fermer le message" onClick={() => setError("")}><X /></Button></div>}
          {download && <div className="download-banner" role="status"><FileCheck2 size={20} /><div><strong>Votre document signé est prêt.</strong><span>Sur iPhone, ouvrez le fichier puis utilisez Partager → Enregistrer dans Fichiers.</span></div><a href={download.url} download={download.name}>Télécharger</a><a href={download.url} target="_blank" rel="noopener noreferrer">Ouvrir</a></div>}
          <div ref={stageRef} className={`document-stage ${!docLoaded ? "empty-stage" : ""} ${dragOver ? "is-dragover" : ""}`} onDragEnter={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); dropDepth.current++; setDragOver(true); } }} onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }} onDragLeave={e => { e.preventDefault(); dropDepth.current--; if (dropDepth.current <= 0) { dropDepth.current = 0; setDragOver(false); } }} onDrop={e => { e.preventDefault(); dropDepth.current = 0; setDragOver(false); if (e.dataTransfer.files.length > 1) toast("Un fichier à la fois : le premier a été sélectionné."); chooseFile(e.dataTransfer.files[0]); }}>
            {!docLoaded ? <Empty className="upload-zone"><EmptyHeader><div className="upload-icon"><FileText size={38} strokeWidth={1.4} /><span><Plus size={15} /></span></div><EmptyTitle className="upload-title">Votre document commence ici.</EmptyTitle><EmptyDescription className="upload-description">Glissez votre document dans cet espace<br className="desktop-break" /> ou choisissez-le sur votre appareil.</EmptyDescription></EmptyHeader><EmptyContent><Button className="primary-button upload-button" disabled={loading} onClick={() => fileInput.current?.click()}>{loading ? <LoaderCircle className="spin" /> : <Upload size={18} />}{loading ? "Ouverture du fichier…" : "Importer un fichier"}{!loading && <ArrowRight size={16} />}</Button><span className="upload-meta">PDF, JPG, PNG, WEBP · Jusqu’à 30 Mo</span></EmptyContent><div className="upload-footer"><ShieldCheck size={15} /><span>Votre document reste entre vos mains.</span></div></Empty>
              : <><div className={`page-shell ${placing ? "is-placing" : ""}`} ref={pageRef} style={{ width: displayWidth, height: displayHeight }} onClick={e => { if (!placing) { setSelected(null); return; } const r = e.currentTarget.getBoundingClientRect(); placeAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
                <canvas ref={canvasRef} className="pdf-canvas" style={{ visibility: ready ? "visible" : "hidden" }} aria-label={`Aperçu de la page ${page}`} />
                {!ready && <div className="page-loading" role="status">{rendering || loading ? <><LoaderCircle className="spin" />Affichage de la page…</> : <><FileText />Aperçu indisponible</>}</div>}
                {ready && stamps.filter(s => s.page === page).map(s => <button type="button" key={s.id} className={`placed-signature ${selected === s.id ? "is-selected" : ""}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }} onClick={e => { e.stopPropagation(); setSelected(s.id); setPlacing(false); }} onFocus={() => setSelected(s.id)} onPointerDown={e => startDrag(e, s)} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={e => moveWithKeys(e, s)} aria-label="Signature : faites glisser ou utilisez les flèches pour la déplacer" disabled={exporting}><img src={s.dataUrl} alt="Signature" draggable={false} />{selected === s.id && <>
                  <span className="handle top-left" onPointerDown={e => startResizeHandle(e, s, "tl")} onPointerMove={moveResizeHandle} onPointerUp={stopResizeHandle} onPointerCancel={stopResizeHandle} onLostPointerCapture={stopResizeHandle} />
                  <span className="handle top-right" onPointerDown={e => startResizeHandle(e, s, "tr")} onPointerMove={moveResizeHandle} onPointerUp={stopResizeHandle} onPointerCancel={stopResizeHandle} onLostPointerCapture={stopResizeHandle} />
                  <span className="handle bottom-left" onPointerDown={e => startResizeHandle(e, s, "bl")} onPointerMove={moveResizeHandle} onPointerUp={stopResizeHandle} onPointerCancel={stopResizeHandle} onLostPointerCapture={stopResizeHandle} />
                  <span className="handle bottom-right" onPointerDown={e => startResizeHandle(e, s, "br")} onPointerMove={moveResizeHandle} onPointerUp={stopResizeHandle} onPointerCancel={stopResizeHandle} onLostPointerCapture={stopResizeHandle} />
                </>}</button>)}
              </div>{loading && <div className="loading-overlay" role="status"><LoaderCircle className="spin" /><span>Ouverture du fichier…</span></div>}</>}
            {dragOver && <div className="drop-overlay"><Upload size={30} /><strong>Déposez votre fichier ici</strong></div>}
          </div>
          <div className="document-status">{docLoaded ? <><span className="status-tip">{placing ? <><MousePointer2 size={15} /> Touchez la page pour placer la signature.<Button variant="ghost" className="cancel-placement" onClick={() => setPlacing(false)}>Annuler</Button></> : <><PenLine size={14} /><span>{stamps.filter(s => s.page === page).length} signature{stamps.filter(s => s.page === page).length > 1 ? "s" : ""} sur cette page</span></>}</span>{totalPages > 1 && <Pagination aria-label="Pages du document" className="page-pagination"><PaginationContent><PaginationItem><Button size="icon" variant="ghost" disabled={page <= 1 || loading || exporting} aria-label="Page précédente" onClick={() => goToPage(page - 1)}><ChevronLeft /></Button></PaginationItem><PaginationItem className="page-input-wrap"><label htmlFor="page-number">Page</label><Input id="page-number" type="number" min={1} max={totalPages} value={pageEntry} onChange={e => setPageEntry(e.target.value)} onBlur={() => goToPage(Number(pageEntry) || page)} onKeyDown={e => { if (e.key === "Enter") goToPage(Number(pageEntry) || page); }} disabled={loading || exporting} /><span>/ {totalPages}</span></PaginationItem><PaginationItem><Button size="icon" variant="ghost" disabled={page >= totalPages || loading || exporting} aria-label="Page suivante" onClick={() => goToPage(page + 1)}><ChevronRight /></Button></PaginationItem></PaginationContent></Pagination>}</> : <><span className="status-tip"><LockKeyhole size={14} />Traitement sur votre appareil</span><span className="status-format">PDF · Image</span></>}</div>
          {placing && ready && <div className="place-accessible"><Button variant="outline" onClick={() => placeAt(0.5, 0.75)}>Placer au centre de la page</Button></div>}
        </section>
      </div>
      <footer className="page-footer"><span>Un document. Une signature. C’est tout.</span><span>Signature visuelle ajoutée au document</span></footer>
    </main>
    <input ref={fileInput} type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" className="sr-only" tabIndex={-1} onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Sélectionner un fichier à importer" />
    <SignatureDialog open={signatureOpen} onOpenChange={setSignatureOpen} onSave={signature => {
      setAsset(signature); void saveSignature(signature);
      if (ready) { setPlacing(true); toast("Signature prête : touchez la page pour la placer."); }
      else toast("Signature enregistrée sur cet appareil. Elle sera proposée pour chaque document.");
    }} />
    <Dialog open={!!pendingFile} onOpenChange={open => { if (!open) setPendingFile(null); }}><DialogContent className="replace-dialog" showCloseButton={false}><DialogTitle>Ouvrir un autre fichier ?</DialogTitle><DialogDescription>Les signatures placées sur le document actuel seront retirées. Pensez à télécharger votre document signé avant de continuer.</DialogDescription><div className="replace-actions"><DialogClose asChild><Button variant="outline">Garder ce document</Button></DialogClose><Button onClick={() => { const file = pendingFile; setPendingFile(null); if (file) void loadFile(file); }}>Ouvrir le nouveau fichier</Button></div></DialogContent></Dialog>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={filename.replace(/\.[^.]+$/i, "") + "-signe"} saveHint={saveHint} formats={exportFormats} onConfirm={confirmExport} />
    <Toaster position="bottom-center" theme="light" richColors closeButton />
  </div>;
}
