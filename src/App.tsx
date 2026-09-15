import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ArrowDownToLine, ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck, FileCheck2, FileText, FolderOpen, Grip, LoaderCircle, LockKeyhole, Minus, MousePointer2, PenLine, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Empty, EmptyHeader, EmptyDescription, EmptyTitle, EmptyContent } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import SignatureDialog from "./signature-dialog";
import ExportDialog from "./export-dialog";
import { clamp, signPdf, type SignatureAsset, type Stamp } from "@/lib/pdf-signing";
import { clearSavedSignature, loadSavedSignature, saveSignature } from "@/lib/signature-store";

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

type Drag = { id: string; pointerId: number; clientX: number; clientY: number; x: number; y: number; w: number; h: number; rect: DOMRect };
type ModelTool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };

export default function PdfEditor() {
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const objectUrl = useRef<string | null>(null);
  const dropDepth = useRef(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
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
  const active = stamps.find(s => s.id === selected);
  const ready = !!pdf && renderedPage === page && !rendering && !loading;
  const currentStep = !pdf ? 1 : stamps.length ? 3 : 2;
  const maxPageWidth = Math.min(dimensions.width, 840);
  const fittedWidth = Math.max(160, Math.min(stageWidth - (stageWidth < 600 ? 24 : 72), maxPageWidth));
  const displayWidth = fittedWidth * zoom;
  const displayHeight = displayWidth * dimensions.height / dimensions.width;
  const stateRef = useRef({ loaded: false, totalPages: 0, currentPage: 1, signatures: [] as { page: number; count: number }[] });
  stateRef.current = { loaded: !!pdf, totalPages: pdf?.numPages || 0, currentPage: page,
    signatures: [...new Set(stamps.map(s => s.page))].sort((a,b) => a-b).map(p => ({ page: p, count: stamps.filter(s => s.page === p).length })) };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage); return () => observer.disconnect();
  }, []);
  useEffect(() => { void loadSavedSignature().then(saved => { if (saved) setAsset(current => current ?? saved); }); }, []);
  useEffect(() => { setPageEntry(String(page)); setSelected(null); }, [page]);
  useEffect(() => () => { void docRef.current?.loadingTask.destroy(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: ModelTool, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({ name: "get_pdf_signing_status", description: "Lire la page affichée et le nombre de signatures ajoutées à chaque page du PDF ouvert, sans lire son contenu.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) {
        if (input === null || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Un objet vide est attendu.");
        return stateRef.current;
      } }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null; setDownload(null);
  }, [stamps, pdf]);

  useEffect(() => {
    if (!pdf) return;
    let stopped = false;
    let task: RenderTask | undefined;
    setRendering(true); setError("");
    (async () => {
      try {
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
      } catch (e) {
        if (stopped || (e as Error).name === "RenderingCancelledException") return;
        setRendering(false); setRenderedPage(0);
        setError("Cette page ne peut pas être affichée. Essayez une autre page ou un autre PDF.");
      }
    })();
    return () => { stopped = true; task?.cancel(); };
  }, [pdf, page, displayWidth, displayHeight, dimensions.width, dimensions.height]);

  const loadFile = useCallback(async (file: File) => {
    if (busyRef.current) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { setError("Choisissez un fichier au format PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { setError("Ce PDF dépasse 30 Mo. Choisissez un fichier plus léger."); return; }
    if (!file.size) { setError("Ce fichier est vide. Choisissez un autre PDF."); return; }
    busyRef.current = true; setLoading(true); setError("");
    let newDoc: PDFDocumentProxy | null = null;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { PDFDocument } = await import("pdf-lib");
      await PDFDocument.load(bytes, { updateMetadata: false });
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const assetsUrl = `${import.meta.env.BASE_URL}pdf-assets/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${assetsUrl}pdf.worker.min.mjs`;
      const task = pdfjs.getDocument({ data: bytes.slice(), cMapUrl: `${assetsUrl}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assetsUrl}standard_fonts/`, wasmUrl: `${assetsUrl}wasm/` });
      try { newDoc = await task.promise; } catch (e) { await task.destroy(); throw e; }
      if (!newDoc.numPages) throw new Error("Ce document ne contient aucune page.");
      const first = await newDoc.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      const previous = docRef.current;
      docRef.current = newDoc; bytesRef.current = bytes;
      setPdf(newDoc); setFilename(file.name); setFilesize(file.size);
      setPage(1); setPageEntry("1"); setZoom(1); setRenderedPage(0);
      setDimensions({ width: viewport.width, height: viewport.height });
      setStamps([]); setSelected(null); setPlacing(false);
      if (previous) void previous.loadingTask.destroy();
      toast.success("Votre PDF est prêt à être signé.");
    } catch (e) {
      if (newDoc && newDoc !== docRef.current) void newDoc.loadingTask.destroy();
      const message = e instanceof Error ? e.message : "";
      setError(/encrypt|password/i.test(message)
        ? "Ce PDF est protégé par un mot de passe. Ouvrez une copie déverrouillée pour la signer."
        : "Impossible d’ouvrir ce fichier. Vérifiez qu’il s’agit d’un PDF valide et non protégé.");
    } finally { busyRef.current = false; setLoading(false); }
  }, []);

  function chooseFile(file?: File) {
    if (!file || busyRef.current) return;
    if (pdf && stamps.length) setPendingFile(file); else void loadFile(file);
  }
  function goToPage(value: number) {
    if (!pdf || loading || exporting) return;
    const next = clamp(Math.round(value), 1, pdf.numPages);
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
    if (e.button !== 0 || !pageRef.current || !ready || exporting || dragRef.current) return;
    e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); setSelected(stamp.id); setPlacing(false);
    const rect = pageRef.current.getBoundingClientRect();
    dragRef.current = { id: stamp.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, x: stamp.x, y: stamp.y, w: stamp.w, h: stamp.h, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const x = clamp(drag.x + (e.clientX - drag.clientX) / drag.rect.width, 0, 1 - drag.w);
    const y = clamp(drag.y + (e.clientY - drag.clientY) / drag.rect.height, 0, 1 - drag.h);
    setStamps(items => items.map(s => s.id === drag.id ? { ...s, x, y } : s));
  }
  function stopDrag(e: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
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
    toast("Signature supprimée", { action: { label: "Annuler", onClick: () => { if (!busyRef.current && removed && docRef.current === pdf) setStamps(items => [...items, removed]); } } });
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

  async function confirmExport(name: string) {
    if (!pdf || !bytesRef.current || !stamps.length || busyRef.current) return;
    const finalName = `${name}.pdf`;
    busyRef.current = true; setExporting(true); setError("");
    try {
      // Ask for a save location first, before signing, so the picker still
      // benefits from the user gesture that triggered this handler.
      let handle: FileSystemFileHandle | null = null;
      if (supportsFileSystemAccess) {
        try {
          handle = await window.showSaveFilePicker!({
            suggestedName: finalName,
            types: [{ description: "Document PDF", accept: { "application/pdf": [".pdf"] } }],
          });
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // user cancelled the picker
          handle = null; // unexpected failure: fall back to another method
        }
      }

      const signed = await signPdf(bytesRef.current, pdf, stamps);
      const blob = new Blob([new Uint8Array(signed)], { type: "application/pdf" });

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success("Votre PDF signé a été enregistré.");
        setExportOpen(false);
        return;
      }

      const file = new File([blob], finalName, { type: "application/pdf" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: finalName });
          toast.success("Votre PDF signé est prêt.");
          setExportOpen(false);
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // user cancelled the share sheet
          // unexpected failure: fall back to a plain download below
        }
      }

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(blob); objectUrl.current = url;
      setDownload({ url, name: finalName });
      const link = document.createElement("a"); link.href = url; link.download = finalName;
      document.body.appendChild(link); link.click(); link.remove();
      toast.success("Votre PDF signé est prêt.");
      setExportOpen(false);
    } catch { setError("Le téléchargement n’a pas pu être préparé. Réessayez avec ce PDF ou une copie non protégée."); }
    finally { busyRef.current = false; setExporting(false); }
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="brand" aria-label="Signé"><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>Signé<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">La signature, simplement.</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>Tout reste sur votre appareil</span></div>
    </header>
    <main className="main-content">
      <div className="workspace-heading"><div><p className="eyebrow">VOTRE ESPACE DE SIGNATURE</p><h1>Signer un PDF</h1></div>
        <ol className="steps" aria-label="Progression">
          {[[1, "Importer"], [2, "Signer"], [3, "Télécharger"]].map(([number, title]) => <li key={number} className={currentStep >= Number(number) ? "step is-current" : "step"} aria-current={currentStep === number ? "step" : undefined}><span className="step-number">{currentStep > Number(number) ? <Check size={13} /> : number}</span><span>{title}</span>{number !== 3 && <span className="step-line" />}</li>)}
        </ol>
      </div>
      <div className="editor-shell">
        <aside className="tools-panel" aria-label="Outils de signature">
          <section className="tool-section document-section"><div className="section-heading"><span className="section-number">01</span><h2>Le document</h2>{pdf && <CircleCheck size={16} className="success-icon" />}</div>
            {pdf ? <><div className="file-card"><span className="file-symbol"><FileText size={23} /></span><div><strong title={filename}>{filename}</strong><span>{pdf.numPages} page{pdf.numPages > 1 ? "s" : ""} · {(filesize / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo</span></div></div><Button variant="ghost" className="change-file" disabled={loading || exporting} onClick={() => fileInput.current?.click()}><FolderOpen /> Changer de PDF</Button></>
              : <p className="section-copy">Importez le PDF que vous souhaitez signer.</p>}
          </section>
          <section className={`tool-section signature-section ${!pdf ? "section-waiting" : ""}`}><div className="section-heading"><span className="section-number">02</span><h2>Votre signature</h2></div>
            {asset ? <><button className="saved-signature" disabled={!ready || exporting} onClick={() => setPlacing(true)} aria-label="Placer votre signature sur le PDF"><img src={asset.dataUrl} alt="Votre signature" /><Plus size={16} className="signature-plus" /></button><Button variant="outline" className="add-signature" disabled={!ready || exporting} onClick={() => setPlacing(!placing)}><Plus />{placing ? "Cliquez sur la page…" : "Placer sur la page"}</Button><div className="saved-signature-actions"><Button variant="ghost" className="new-signature" disabled={exporting || loading} onClick={() => setSignatureOpen(true)}>Modifier ma signature</Button><Button variant="ghost" className="forget-signature" disabled={exporting || loading} onClick={deleteSavedSignature}>Supprimer ma signature enregistrée</Button></div></>
              : <><p className="section-copy">Une touche personnelle.<br />Dessinez-la ou saisissez votre nom.</p><Button variant="outline" className="add-signature" disabled={exporting} onClick={() => setSignatureOpen(true)}><PenLine /> Créer ma signature</Button></>}
            {active && <div className="selection-controls"><div className="size-label"><label id="signature-size-label">Taille de la signature</label><span>{Math.round(active.w * 100)} %</span></div><Slider min={5} max={Math.floor(Math.min(75, 95 * dimensions.height / dimensions.width * active.width / active.height))} step={1} value={[Math.round(active.w * 100)]} onValueChange={([value]) => resizeStamp(value)} aria-labelledby="signature-size-label" disabled={exporting} /><p className="move-hint"><Grip size={14} /> Faites glisser pour la déplacer.</p><Button variant="ghost" className="delete-signature" onClick={() => removeStamp(active.id)} disabled={exporting}><Trash2 /> Supprimer cette signature</Button></div>}
          </section>
          <section className="tool-section export-section"><div className="section-heading"><span className="section-number">03</span><h2>C’est signé</h2></div><p className="section-copy">{stamps.length ? `${stamps.length} signature${stamps.length > 1 ? "s" : ""} ajoutée${stamps.length > 1 ? "s" : ""} au document.` : "Votre PDF signé, prêt à télécharger."}</p><Button className="primary-button export-button" onClick={() => { setPlacing(false); setExportOpen(true); }} disabled={!pdf || !stamps.length || loading || exporting}>{exporting ? <LoaderCircle className="spin" /> : <ArrowDownToLine />}{exporting ? "Préparation du PDF…" : "Télécharger le PDF"}</Button><div className="privacy-note"><LockKeyhole size={14} /><span>Aucun document envoyé en ligne</span></div></section>
        </aside>
        <section className="document-workspace" aria-label="Aperçu du document">
          <div className="document-toolbar"><div className="toolbar-name"><FileText size={16} /><span>{pdf ? filename : "Aperçu du document"}</span></div><div className="zoom-controls"><Button variant="ghost" size="icon" aria-label="Réduire l’aperçu" disabled={!pdf || zoom <= 0.5 || exporting} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><Minus /></Button><button className="zoom-value" disabled={!pdf} onClick={() => setZoom(1)} title="Ajuster à la largeur">{Math.round(zoom * 100)} %</button><Button variant="ghost" size="icon" aria-label="Agrandir l’aperçu" disabled={!pdf || zoom >= 2.5 || exporting} onClick={() => setZoom(z => Math.min(2.5, z + 0.25))}><Plus /></Button></div></div>
          {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Fermer le message" onClick={() => setError("")}><X /></Button></div>}
          {download && <div className="download-banner" role="status"><FileCheck2 size={20} /><div><strong>Votre PDF signé est prêt.</strong><span>Sur iPhone, ouvrez le PDF puis utilisez Partager → Enregistrer dans Fichiers.</span></div><a href={download.url} download={download.name}>Télécharger</a><a href={download.url} target="_blank" rel="noopener noreferrer">Ouvrir</a></div>}
          <div ref={stageRef} className={`document-stage ${!pdf ? "empty-stage" : ""} ${dragOver ? "is-dragover" : ""}`} onDragEnter={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); dropDepth.current++; setDragOver(true); } }} onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }} onDragLeave={e => { e.preventDefault(); dropDepth.current--; if (dropDepth.current <= 0) { dropDepth.current = 0; setDragOver(false); } }} onDrop={e => { e.preventDefault(); dropDepth.current = 0; setDragOver(false); if (e.dataTransfer.files.length > 1) toast("Un PDF à la fois : le premier fichier a été sélectionné."); chooseFile(e.dataTransfer.files[0]); }}>
            {!pdf ? <Empty className="upload-zone"><EmptyHeader><div className="upload-icon"><FileText size={38} strokeWidth={1.4} /><span><Plus size={15} /></span></div><EmptyTitle className="upload-title">Votre PDF commence ici.</EmptyTitle><EmptyDescription className="upload-description">Glissez votre document dans cet espace<br className="desktop-break" /> ou choisissez-le sur votre appareil.</EmptyDescription></EmptyHeader><EmptyContent><Button className="primary-button upload-button" disabled={loading} onClick={() => fileInput.current?.click()}>{loading ? <LoaderCircle className="spin" /> : <Upload size={18} />}{loading ? "Ouverture du PDF…" : "Importer mon PDF"}{!loading && <ArrowRight size={16} />}</Button><span className="upload-meta">Fichier PDF · Jusqu’à 30 Mo</span></EmptyContent><div className="upload-footer"><ShieldCheck size={15} /><span>Votre document reste entre vos mains.</span></div></Empty>
              : <><div className={`page-shell ${placing ? "is-placing" : ""}`} ref={pageRef} style={{ width: displayWidth, height: displayHeight }} onClick={e => { if (!placing) { setSelected(null); return; } const r = e.currentTarget.getBoundingClientRect(); placeAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
                <canvas ref={canvasRef} className="pdf-canvas" style={{ visibility: ready ? "visible" : "hidden" }} aria-label={`Aperçu de la page ${page}`} />
                {!ready && <div className="page-loading" role="status">{rendering || loading ? <><LoaderCircle className="spin" />Affichage de la page…</> : <><FileText />Aperçu indisponible</>}</div>}
                {ready && stamps.filter(s => s.page === page).map(s => <button type="button" key={s.id} className={`placed-signature ${selected === s.id ? "is-selected" : ""}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }} onClick={e => { e.stopPropagation(); setSelected(s.id); setPlacing(false); }} onFocus={() => setSelected(s.id)} onPointerDown={e => startDrag(e, s)} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={e => moveWithKeys(e, s)} aria-label="Signature : faites glisser ou utilisez les flèches pour la déplacer" disabled={exporting}><img src={s.dataUrl} alt="Signature" draggable={false} />{selected === s.id && <><i className="handle top-left" /><i className="handle top-right" /><i className="handle bottom-left" /><i className="handle bottom-right" /></>}</button>)}
              </div>{loading && <div className="loading-overlay" role="status"><LoaderCircle className="spin" /><span>Ouverture du PDF…</span></div>}</>}
            {dragOver && <div className="drop-overlay"><Upload size={30} /><strong>Déposez votre PDF ici</strong></div>}
          </div>
          <div className="document-status">{pdf ? <><span className="status-tip">{placing ? <><MousePointer2 size={15} /> Touchez la page pour placer la signature.<Button variant="ghost" className="cancel-placement" onClick={() => setPlacing(false)}>Annuler</Button></> : <><PenLine size={14} /><span>{stamps.filter(s => s.page === page).length} signature{stamps.filter(s => s.page === page).length > 1 ? "s" : ""} sur cette page</span></>}</span><Pagination aria-label="Pages du PDF" className="page-pagination"><PaginationContent><PaginationItem><Button size="icon" variant="ghost" disabled={page <= 1 || loading || exporting} aria-label="Page précédente" onClick={() => goToPage(page - 1)}><ChevronLeft /></Button></PaginationItem><PaginationItem className="page-input-wrap"><label htmlFor="page-number">Page</label><Input id="page-number" type="number" min={1} max={pdf.numPages} value={pageEntry} onChange={e => setPageEntry(e.target.value)} onBlur={() => goToPage(Number(pageEntry) || page)} onKeyDown={e => { if (e.key === "Enter") goToPage(Number(pageEntry) || page); }} disabled={loading || exporting} /><span>/ {pdf.numPages}</span></PaginationItem><PaginationItem><Button size="icon" variant="ghost" disabled={page >= pdf.numPages || loading || exporting} aria-label="Page suivante" onClick={() => goToPage(page + 1)}><ChevronRight /></Button></PaginationItem></PaginationContent></Pagination></> : <><span className="status-tip"><LockKeyhole size={14} />Traitement sur votre appareil</span><span className="status-format">PDF</span></>}</div>
          {placing && ready && <div className="place-accessible"><Button variant="outline" onClick={() => placeAt(0.5, 0.75)}>Placer au centre de la page</Button></div>}
        </section>
      </div>
      <footer className="page-footer"><span>Un document. Une signature. C’est tout.</span><span>Signature visuelle ajoutée au PDF</span></footer>
    </main>
    <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Importer un fichier PDF" />
    <SignatureDialog open={signatureOpen} onOpenChange={setSignatureOpen} onSave={signature => {
      setAsset(signature); void saveSignature(signature);
      if (ready) { setPlacing(true); toast("Signature prête : touchez la page pour la placer."); }
      else toast("Signature enregistrée sur cet appareil. Elle sera proposée pour chaque PDF.");
    }} />
    <Dialog open={!!pendingFile} onOpenChange={open => { if (!open) setPendingFile(null); }}><DialogContent className="replace-dialog" showCloseButton={false}><DialogTitle>Ouvrir un autre PDF ?</DialogTitle><DialogDescription>Les signatures placées sur le document actuel seront retirées. Pensez à télécharger votre PDF signé avant de continuer.</DialogDescription><div className="replace-actions"><DialogClose asChild><Button variant="outline">Garder ce document</Button></DialogClose><Button onClick={() => { const file = pendingFile; setPendingFile(null); if (file) void loadFile(file); }}>Ouvrir le nouveau PDF</Button></div></DialogContent></Dialog>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={filename.replace(/\.pdf$/i, "") + "-signe"} saveHint={saveHint} onConfirm={confirmExport} />
    <Toaster position="bottom-center" theme="light" richColors closeButton />
  </div>;
}
