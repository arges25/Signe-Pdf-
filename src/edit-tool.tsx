import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Eraser, FileCheck2, FileText, FolderOpen, Grip, Highlighter, LoaderCircle, LockKeyhole, Minus, MousePointer2, PenLine, Plus, Redo2, ShieldCheck, Trash2, Type, Undo2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyDescription, EmptyTitle, EmptyContent } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import ExportDialog from "./export-dialog";
import TextElementDialog, { type TextElementValue } from "./text-element-dialog";
import { clamp } from "@/lib/pdf-signing";
import { detectFileKind } from "@/lib/file-detect";
import { loadPdfDocument } from "@/lib/pdf-loader";
import { applyEditsToPdf } from "@/lib/pdf-editing";
import { requestSaveHandle, saveBlob, saveHint } from "@/lib/save-file";
import { DEFAULT_HIGHLIGHT_COLOR, DEFAULT_REDACT_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_SIZE, type EditElement, type RectElement, type TextElement } from "@/lib/edit-types";

type Tool = "select" | "text" | "date" | "check" | "cross" | "redact" | "highlight";
type ElementDrag = { id: string; pointerId: number; clientX: number; clientY: number; x: number; y: number; rect: DOMRect };
type ResizeDrag = { id: string; pointerId: number; clientX: number; clientY: number; x: number; y: number; w: number; h: number; rect: DOMRect };
type RectDraft = { pointerId: number; rect: DOMRect; startX: number; startY: number; x: number; y: number; w: number; h: number };
type TextDialogState = { open: boolean; mode: "create" | "edit"; id: string | null; pos: { x: number; y: number } | null; initial: TextElementValue };

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Sélection", icon: MousePointer2 },
  { id: "text", label: "Texte", icon: Type },
  { id: "redact", label: "Masquer", icon: Eraser },
  { id: "date", label: "Date", icon: CalendarDays },
  { id: "check", label: "Coche", icon: Check },
  { id: "cross", label: "Croix", icon: X },
  { id: "highlight", label: "Surligner", icon: Highlighter },
];

const REDACT_COLORS: [string, string][] = [["#ffffff", "Blanc"], ["#f4f1ea", "Ivoire"], ["#e7e9ec", "Gris clair"], ["#172a46", "Noir"]];
const HIGHLIGHT_COLORS: [string, string][] = [["#ffe066", "Jaune"], ["#8ce99a", "Vert"], ["#a5d8ff", "Bleu"], ["#ffc9c9", "Rose"]];
const MARK_COLORS: [string, string][] = [["#188160", "Vert"], ["#c0392b", "Rouge"], ["#172a46", "Noir"], ["#2457ea", "Bleu"]];

function formatTodayFr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function defaultTextValue(text = ""): TextElementValue {
  return { text, fontSize: DEFAULT_TEXT_SIZE, color: DEFAULT_TEXT_COLOR, bold: false, italic: false, align: "left" };
}

export default function EditTool({ onBack, onSignThis }: { onBack?: () => void; onSignThis: (file: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<ElementDrag | null>(null);
  const resizeRef = useRef<ResizeDrag | null>(null);
  const rectDraftRef = useRef<RectDraft | null>(null);
  const suppressClickRef = useRef(false);
  const dragBeforeRef = useRef<EditElement[] | null>(null);
  const undoStackRef = useRef<EditElement[][]>([]);
  const redoStackRef = useRef<EditElement[][]>([]);
  const zoomRef = useRef(1);
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
  const [elements, setElements] = useState<EditElement[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [rectDraft, setRectDraft] = useState<RectDraft | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [textDialog, setTextDialog] = useState<TextDialogState>({ open: false, mode: "create", id: null, pos: null, initial: defaultTextValue() });

  const docLoaded = !!pdf;
  const totalPages = pdf ? pdf.numPages : 0;
  const selectedEl = elements.find(e => e.id === selected) ?? null;
  const ready = docLoaded && renderedPage === page && !rendering && !loading;
  const currentStep = !docLoaded ? 1 : elements.length ? 3 : 2;
  const maxPageWidth = Math.min(dimensions.width, 840);
  const fittedWidth = Math.max(160, Math.min(stageWidth - (stageWidth < 600 ? 24 : 72), maxPageWidth));
  const displayWidth = fittedWidth * zoom;
  const displayHeight = displayWidth * dimensions.height / dimensions.width;

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage); return () => observer.disconnect();
  }, []);
  useEffect(() => { setPageEntry(String(page)); setSelected(null); }, [page]);
  useEffect(() => () => { void docRef.current?.loadingTask.destroy(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null; setDownload(null);
  }, [elements, pdf]);

  // Best-effort pinch-to-zoom: single-finger touches are left alone (native
  // scroll still works), only a genuine two-finger gesture is intercepted.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let startDist = 0, startZoom = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    function onTouchStart(e: TouchEvent) { if (e.touches.length === 2) { startDist = dist(e.touches); startZoom = zoomRef.current; } }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || startDist <= 0) return;
      e.preventDefault();
      setZoom(clamp(startZoom * (dist(e.touches) / startDist), 0.5, 2.5));
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); };
  }, []);

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
        setError("Cette page ne peut pas être affichée. Essayez une autre page ou un autre fichier.");
      }
    })();
    return () => { stopped = true; task?.cancel(); };
  }, [pdf, page, displayWidth, displayHeight, dimensions.width, dimensions.height]);

  const loadFile = useCallback(async (file: File) => {
    if (busyRef.current) return;
    if (file.size > 30 * 1024 * 1024) { setError("Ce fichier dépasse 30 Mo. Choisissez un fichier plus léger."); return; }
    if (!file.size) { setError("Ce fichier est vide. Choisissez un autre fichier."); return; }
    busyRef.current = true; setLoading(true); setError("");
    try {
      const detected = await detectFileKind(file);
      if (detected.kind !== "pdf") {
        setError("Cet outil modifie uniquement des documents PDF. Pour une image, utilisez plutôt « Signer un PDF ».");
        return;
      }
      const result = await loadPdfDocument(file, detected);
      if (!result.ok) { setError(result.message); return; }
      const previousDoc = docRef.current;
      docRef.current = result.doc; bytesRef.current = result.bytes;
      setPdf(result.doc); setFilename(file.name); setFilesize(file.size);
      setPage(1); setPageEntry("1"); setZoom(1); setRenderedPage(0);
      setDimensions({ width: result.width, height: result.height });
      setElements([]); undoStackRef.current = []; redoStackRef.current = []; setHistoryTick(t => t + 1);
      setSelected(null); setTool("select");
      if (previousDoc) void previousDoc.loadingTask.destroy();
      toast.success("Votre PDF est prêt à être corrigé.");
    } finally { busyRef.current = false; setLoading(false); }
  }, []);

  function chooseFile(file?: File) {
    if (!file || busyRef.current) return;
    if (docLoaded && elements.length) setPendingFile(file); else void loadFile(file);
  }
  function goToPage(value: number) {
    if (!docLoaded || loading || exporting) return;
    const next = clamp(Math.round(value), 1, totalPages);
    setPage(next); setPageEntry(String(next)); setSelected(null);
  }

  function commit(next: EditElement[]) {
    undoStackRef.current = [...undoStackRef.current, elements];
    redoStackRef.current = [];
    setElements(next); setHistoryTick(t => t + 1);
  }
  function pushHistorySnapshot(before: EditElement[]) {
    undoStackRef.current = [...undoStackRef.current, before];
    redoStackRef.current = [];
    setHistoryTick(t => t + 1);
  }
  function undo() {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const previous = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, elements];
    setElements(previous); setSelected(null); setHistoryTick(t => t + 1);
  }
  function redo() {
    const stack = redoStackRef.current;
    if (!stack.length) return;
    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, elements];
    setElements(next); setSelected(null); setHistoryTick(t => t + 1);
  }
  function removeElement(id: string) {
    if (exporting) return;
    commit(elements.filter(el => el.id !== id));
    setSelected(null);
  }

  function onStageClick(e: PointerEvent<HTMLDivElement> & { clientX: number; clientY: number }) {
    if (!ready || exporting) return;
    // A rectangle just finished being drawn: the native click that follows
    // the drag's pointerup still lands on the stage and must not clear the
    // selection the drag itself just made.
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (tool === "select") { setSelected(null); return; }
    if (tool === "redact" || tool === "highlight") return; // handled by drag-to-draw below
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 0.94);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 0.94);
    if (tool === "text") {
      setTextDialog({ open: true, mode: "create", id: null, pos: { x, y }, initial: defaultTextValue() });
    } else if (tool === "date") {
      setTextDialog({ open: true, mode: "create", id: null, pos: { x, y }, initial: defaultTextValue(formatTodayFr()) });
    } else if (tool === "check" || tool === "cross") {
      const el: TextElement = { id: crypto.randomUUID(), kind: "text", page, x, y, fontSize: 0.045, text: tool === "check" ? "✓" : "✕", color: tool === "check" ? "#188160" : "#c0392b", bold: true, italic: false, align: "left", glyph: tool };
      commit([...elements, el]); setSelected(el.id); setTool("select");
    }
  }

  function onStageDown(e: PointerEvent<HTMLDivElement>) {
    if (!ready || exporting || e.button !== 0) return;
    if (tool !== "redact" && tool !== "highlight") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const draft = { pointerId: e.pointerId, rect, startX: x, startY: y, x, y, w: 0, h: 0 };
    rectDraftRef.current = draft; setRectDraft(draft);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onStageMove(e: PointerEvent<HTMLDivElement>) {
    const draft = rectDraftRef.current;
    if (!draft || e.pointerId !== draft.pointerId) return;
    const x = clamp((e.clientX - draft.rect.left) / draft.rect.width, 0, 1);
    const y = clamp((e.clientY - draft.rect.top) / draft.rect.height, 0, 1);
    const next = { ...draft, x: Math.min(draft.startX, x), y: Math.min(draft.startY, y), w: Math.abs(x - draft.startX), h: Math.abs(y - draft.startY) };
    rectDraftRef.current = next; setRectDraft(next);
  }
  function onStageUp(e: PointerEvent<HTMLDivElement>) {
    const draft = rectDraftRef.current;
    if (!draft || e.pointerId !== draft.pointerId) return;
    rectDraftRef.current = null; setRectDraft(null);
    if (draft.w < 0.012 || draft.h < 0.012) return;
    const el: RectElement = { id: crypto.randomUUID(), kind: "rect", page, x: draft.x, y: draft.y, w: draft.w, h: draft.h, color: tool === "redact" ? DEFAULT_REDACT_COLOR : DEFAULT_HIGHLIGHT_COLOR, mode: tool === "redact" ? "redact" : "highlight" };
    commit([...elements, el]); setSelected(el.id); setTool("select");
    suppressClickRef.current = true;
  }

  function startMove(e: PointerEvent<HTMLDivElement>, el: EditElement) {
    e.stopPropagation();
    if (e.button !== 0 || !pageRef.current || !ready || exporting || dragRef.current) return;
    e.preventDefault(); e.currentTarget.focus({ preventScroll: true });
    setSelected(el.id); setTool("select");
    const rect = pageRef.current.getBoundingClientRect();
    dragBeforeRef.current = elements;
    dragRef.current = { id: el.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, x: el.x, y: el.y, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const x = clamp(drag.x + (e.clientX - drag.clientX) / drag.rect.width, 0, 0.97);
    const y = clamp(drag.y + (e.clientY - drag.clientY) / drag.rect.height, 0, 0.97);
    setElements(items => items.map(it => it.id === drag.id ? { ...it, x, y } : it));
  }
  function stopMove(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (dragBeforeRef.current) { pushHistorySnapshot(dragBeforeRef.current); dragBeforeRef.current = null; }
  }
  function moveWithKeys(e: KeyboardEvent<HTMLDivElement>, el: EditElement) {
    if (exporting) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault(); const [dx, dy] = moves[e.key], step = e.shiftKey ? 0.02 : 0.003;
      commit(elements.map(it => it.id === el.id ? { ...it, x: clamp(it.x + dx * step, 0, 0.97), y: clamp(it.y + dy * step, 0, 0.97) } : it));
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeElement(el.id); }
    if (e.key === "Enter" && el.kind === "text" && !el.glyph) { e.preventDefault(); openEditDialog(el); }
  }

  function startResize(e: PointerEvent<HTMLButtonElement>, el: RectElement) {
    e.stopPropagation();
    if (e.button !== 0 || !pageRef.current || !ready || exporting || resizeRef.current) return;
    e.preventDefault();
    setSelected(el.id); setTool("select");
    const rect = pageRef.current.getBoundingClientRect();
    dragBeforeRef.current = elements;
    resizeRef.current = { id: el.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveResize(e: PointerEvent<HTMLButtonElement>) {
    const d = resizeRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const w = clamp(d.w + (e.clientX - d.clientX) / d.rect.width, 0.02, 1 - d.x);
    const h = clamp(d.h + (e.clientY - d.clientY) / d.rect.height, 0.02, 1 - d.y);
    setElements(items => items.map(it => it.id === d.id ? { ...it, w, h } : it));
  }
  function stopResize(e: PointerEvent<HTMLButtonElement>) {
    if (resizeRef.current?.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    if (dragBeforeRef.current) { pushHistorySnapshot(dragBeforeRef.current); dragBeforeRef.current = null; }
  }

  function openEditDialog(el: TextElement) {
    setTextDialog({ open: true, mode: "edit", id: el.id, pos: null, initial: { text: el.text, fontSize: el.fontSize, color: el.color, bold: el.bold, italic: el.italic, align: el.align } });
  }
  function confirmTextDialog(value: TextElementValue) {
    if (textDialog.mode === "create" && textDialog.pos) {
      const el: TextElement = { id: crypto.randomUUID(), kind: "text", page, x: textDialog.pos.x, y: textDialog.pos.y, fontSize: value.fontSize, text: value.text, color: value.color, bold: value.bold, italic: value.italic, align: value.align };
      commit([...elements, el]); setSelected(el.id);
    } else if (textDialog.mode === "edit" && textDialog.id) {
      commit(elements.map(el => el.id === textDialog.id && el.kind === "text" ? { ...el, text: value.text, fontSize: value.fontSize, color: value.color, bold: value.bold, italic: value.italic, align: value.align } : el));
    }
    setTool("select"); setTextDialog(d => ({ ...d, open: false }));
  }
  function deleteTextDialogElement() {
    if (textDialog.id) removeElement(textDialog.id);
    setTextDialog(d => ({ ...d, open: false }));
  }

  async function confirmExport(name: string) {
    if (!pdf || !bytesRef.current || busyRef.current) return;
    busyRef.current = true; setExporting(true); setError("");
    try {
      let handle: FileSystemFileHandle | null = null;
      try { handle = await requestSaveHandle(`${name}.pdf`, "application/pdf", "pdf"); }
      catch (e) { if ((e as Error).name === "AbortError") return; }
      const editedBytes = await applyEditsToPdf(bytesRef.current, pdf, elements);
      const blob = new Blob([new Uint8Array(editedBytes)], { type: "application/pdf" });
      const outcome = await saveBlob(blob, `${name}.pdf`, handle);
      if ("cancelled" in outcome) return;
      if (outcome.method === "download") setDownload({ url: outcome.url, name: outcome.finalName });
      toast.success("Votre PDF modifié est prêt.");
      setExportOpen(false);
    } catch (e) { console.error("[Signé] Échec de l'export édité", e); setError("L’export n’a pas pu être préparé. Réessayez avec ce fichier ou une copie non protégée."); }
    finally { busyRef.current = false; setExporting(false); }
  }

  async function signThisDocument() {
    if (!pdf || !bytesRef.current || busyRef.current) return;
    busyRef.current = true; setExporting(true); setError("");
    try {
      const editedBytes = await applyEditsToPdf(bytesRef.current, pdf, elements);
      const blob = new Blob([new Uint8Array(editedBytes)], { type: "application/pdf" });
      const outName = filename.replace(/\.[^.]+$/i, "") + "-modifie.pdf";
      onSignThis(new File([blob], outName, { type: "application/pdf" }));
    } catch { setError("Impossible de préparer ce document pour la signature. Réessayez."); }
    finally { busyRef.current = false; setExporting(false); }
  }

  const toolHint = !docLoaded ? "" : tool === "select" ? "Touchez un élément pour le sélectionner."
    : tool === "text" || tool === "date" ? "Touchez la page pour ajouter le texte."
    : tool === "check" || tool === "cross" ? "Touchez la page pour placer le symbole."
    : "Faites glisser sur la page pour dessiner la zone.";

  return <div className="app-shell">
    <header className="site-header">
      {onBack && <Button variant="ghost" className="back-button" onClick={onBack}><ArrowLeft size={16} /> Accueil</Button>}
      <div className="brand" aria-label="Signé"><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>Signé<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">La signature, simplement.</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>Tout reste sur votre appareil</span></div>
    </header>
    <main className="main-content">
      <div className="workspace-heading"><div><p className="eyebrow">VOTRE ESPACE DE CORRECTION</p><h1>Modifier un document</h1></div>
        <ol className="steps" aria-label="Progression">
          {[[1, "Importer"], [2, "Corriger"], [3, "Télécharger"]].map(([number, title]) => <li key={number} className={currentStep >= Number(number) ? "step is-current" : "step"} aria-current={currentStep === number ? "step" : undefined}><span className="step-number">{currentStep > Number(number) ? <Check size={13} /> : number}</span><span>{title}</span>{number !== 3 && <span className="step-line" />}</li>)}
        </ol>
      </div>
      <div className="editor-shell">
        <aside className="tools-panel" aria-label="Outils de correction" data-history={historyTick}>
          <section className="tool-section document-section"><div className="section-heading"><span className="section-number">01</span><h2>Le document</h2>{docLoaded && <CircleCheck size={16} className="success-icon" />}</div>
            {docLoaded ? <><div className="file-card"><span className="file-symbol"><FileText size={23} /></span><div><strong title={filename}>{filename}</strong><span>{totalPages} page{totalPages > 1 ? "s" : ""} · {(filesize / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo</span></div></div><Button variant="ghost" className="change-file" disabled={loading || exporting} onClick={() => fileInput.current?.click()}><FolderOpen /> Changer de fichier</Button></>
              : <p className="section-copy">Importez le PDF que vous souhaitez corriger.</p>}
          </section>
          <section className={`tool-section ${!docLoaded ? "section-waiting" : ""}`}><div className="section-heading"><span className="section-number">02</span><h2>Outils de correction</h2></div>
            <div className="edit-tool-grid">
              {TOOLS.map(t => <button key={t.id} type="button" className={`edit-tool-btn ${tool === t.id ? "is-active" : ""}`} disabled={!ready || exporting} onClick={() => setTool(t.id)} aria-pressed={tool === t.id}><t.icon size={18} /><span>{t.label}</span></button>)}
            </div>
            <div className="edit-history-row">
              <Button variant="outline" disabled={!undoStackRef.current.length || exporting} onClick={undo}><Undo2 /> Annuler</Button>
              <Button variant="outline" disabled={!redoStackRef.current.length || exporting} onClick={redo}><Redo2 /> Rétablir</Button>
            </div>
            {selectedEl && <div className="selection-controls">
              {selectedEl.kind === "text"
                ? (selectedEl.glyph
                    ? <div className="ink-options"><span>Couleur</span>
                        <RadioGroup value={selectedEl.color} onValueChange={color => commit(elements.map(el => el.id === selectedEl.id ? { ...el, color } : el))} className="ink-colors" aria-label="Couleur du symbole">
                          {MARK_COLORS.map(([hex, label]) => <RadioGroupItem key={hex} value={hex} className="ink-color" style={{ backgroundColor: hex }} aria-label={label} title={label} />)}
                        </RadioGroup>
                      </div>
                    : <><p className="section-copy selected-text-preview">« {selectedEl.text} »</p><Button variant="outline" className="add-signature" disabled={exporting} onClick={() => openEditDialog(selectedEl)}><Type /> Modifier le texte</Button></>)
                : <div className="ink-options"><span>Couleur</span>
                    <RadioGroup value={selectedEl.color} onValueChange={color => commit(elements.map(el => el.id === selectedEl.id ? { ...el, color } : el))} className="ink-colors" aria-label="Couleur de la zone">
                      {(selectedEl.mode === "redact" ? REDACT_COLORS : HIGHLIGHT_COLORS).map(([hex, label]) => <RadioGroupItem key={hex} value={hex} className="ink-color" style={{ backgroundColor: hex }} aria-label={label} title={label} />)}
                    </RadioGroup>
                  </div>}
              <p className="move-hint"><Grip size={14} /> Faites glisser pour déplacer.</p>
              <Button variant="ghost" className="delete-signature" disabled={exporting} onClick={() => removeElement(selectedEl.id)}><Trash2 /> Supprimer cet élément</Button>
            </div>}
          </section>
          <section className="tool-section export-section"><div className="section-heading"><span className="section-number">03</span><h2>C’est corrigé</h2></div><p className="section-copy">{elements.length ? `${elements.length} correction${elements.length > 1 ? "s" : ""} apportée${elements.length > 1 ? "s" : ""} au document.` : "Votre document corrigé, prêt à télécharger."}</p>
            <Button className="primary-button export-button" onClick={() => setExportOpen(true)} disabled={!docLoaded || loading || exporting}>{exporting ? <LoaderCircle className="spin" /> : <ArrowDownToLine />}{exporting ? "Préparation du fichier…" : "Télécharger le PDF modifié"}</Button>
            <Button variant="outline" className="add-signature sign-this-button" onClick={signThisDocument} disabled={!docLoaded || loading || exporting}><PenLine /> Signer ce document</Button>
            <div className="privacy-note"><LockKeyhole size={14} /><span>Aucun document envoyé en ligne</span></div>
          </section>
        </aside>
        <section className="document-workspace" aria-label="Aperçu du document">
          <div className="document-toolbar"><div className="toolbar-name"><FileText size={16} /><span>{docLoaded ? filename : "Aperçu du document"}</span></div><div className="zoom-controls"><Button variant="ghost" size="icon" aria-label="Réduire l’aperçu" disabled={!docLoaded || zoom <= 0.5 || exporting} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><Minus /></Button><button className="zoom-value" disabled={!docLoaded} onClick={() => setZoom(1)} title="Ajuster à la largeur">{Math.round(zoom * 100)} %</button><Button variant="ghost" size="icon" aria-label="Agrandir l’aperçu" disabled={!docLoaded || zoom >= 2.5 || exporting} onClick={() => setZoom(z => Math.min(2.5, z + 0.25))}><Plus /></Button></div></div>
          {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Fermer le message" onClick={() => setError("")}><X /></Button></div>}
          {download && <div className="download-banner" role="status"><FileCheck2 size={20} /><div><strong>Votre document modifié est prêt.</strong><span>Sur iPhone, ouvrez le fichier puis utilisez Partager → Enregistrer dans Fichiers.</span></div><a href={download.url} download={download.name}>Télécharger</a><a href={download.url} target="_blank" rel="noopener noreferrer">Ouvrir</a></div>}
          <div ref={stageRef} className={`document-stage ${!docLoaded ? "empty-stage" : ""} ${dragOver ? "is-dragover" : ""}`} onDragEnter={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); dropDepth.current++; setDragOver(true); } }} onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }} onDragLeave={e => { e.preventDefault(); dropDepth.current--; if (dropDepth.current <= 0) { dropDepth.current = 0; setDragOver(false); } }} onDrop={e => { e.preventDefault(); dropDepth.current = 0; setDragOver(false); if (e.dataTransfer.files.length > 1) toast("Un fichier à la fois : le premier a été sélectionné."); chooseFile(e.dataTransfer.files[0]); }}>
            {!docLoaded ? <Empty className="upload-zone"><EmptyHeader><div className="upload-icon"><FileText size={38} strokeWidth={1.4} /><span><Plus size={15} /></span></div><EmptyTitle className="upload-title">Votre correction commence ici.</EmptyTitle><EmptyDescription className="upload-description">Glissez votre PDF dans cet espace<br className="desktop-break" /> ou choisissez-le sur votre appareil.</EmptyDescription></EmptyHeader><EmptyContent><Button className="primary-button upload-button" disabled={loading} onClick={() => fileInput.current?.click()}>{loading ? <LoaderCircle className="spin" /> : <Upload size={18} />}{loading ? "Ouverture du fichier…" : "Importer un PDF"}{!loading && <ArrowRight size={16} />}</Button><span className="upload-meta">PDF · Jusqu’à 30 Mo</span></EmptyContent><div className="upload-footer"><ShieldCheck size={15} /><span>Votre document reste entre vos mains.</span></div></Empty>
              : <><div className={`page-shell ${tool !== "select" ? "is-placing" : ""}`} ref={pageRef} style={{ width: displayWidth, height: displayHeight }} onClick={onStageClick} onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp}>
                <canvas ref={canvasRef} className="pdf-canvas" style={{ visibility: ready ? "visible" : "hidden" }} aria-label={`Aperçu de la page ${page}`} />
                {!ready && <div className="page-loading" role="status">{rendering || loading ? <><LoaderCircle className="spin" />Affichage de la page…</> : <><FileText />Aperçu indisponible</>}</div>}
                {ready && rectDraft && <div className="edit-el edit-el-rect edit-el-draft" style={{ left: `${rectDraft.x * 100}%`, top: `${rectDraft.y * 100}%`, width: `${rectDraft.w * 100}%`, height: `${rectDraft.h * 100}%`, background: tool === "redact" ? DEFAULT_REDACT_COLOR : DEFAULT_HIGHLIGHT_COLOR, opacity: tool === "redact" ? 1 : 0.45 }} />}
                {ready && elements.filter(el => el.page === page).map(el => el.kind === "text"
                  ? <div key={el.id} className={`edit-el edit-el-text ${selected === el.id ? "is-selected" : ""}`} style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, maxWidth: `${(1 - el.x) * 100}%`, fontSize: `${el.fontSize * displayHeight}px`, color: el.color, fontWeight: el.bold ? 700 : 500, fontStyle: el.italic ? "italic" : "normal", textAlign: el.align }} role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setSelected(el.id); setTool("select"); }} onDoubleClick={e => { e.stopPropagation(); if (!el.glyph) openEditDialog(el); }} onPointerDown={e => startMove(e, el)} onPointerMove={moveMove} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove} onKeyDown={e => moveWithKeys(e, el)} aria-label={`Texte : ${el.text}. Double-cliquez pour modifier.`}>{el.text}</div>
                  : <div key={el.id} className={`edit-el edit-el-rect edit-el-${el.mode} ${selected === el.id ? "is-selected" : ""}`} style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, background: el.color, opacity: el.mode === "highlight" ? 0.45 : 1, mixBlendMode: el.mode === "highlight" ? "multiply" : "normal" }} role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setSelected(el.id); setTool("select"); }} onPointerDown={e => startMove(e, el)} onPointerMove={moveMove} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove} onKeyDown={e => moveWithKeys(e, el)} aria-label={el.mode === "redact" ? "Zone masquée" : "Surlignage"}>{selected === el.id && <button type="button" className="rect-handle" aria-label="Redimensionner cette zone" onPointerDown={e => startResize(e, el)} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize} />}</div>)}
              </div>{loading && <div className="loading-overlay" role="status"><LoaderCircle className="spin" /><span>Ouverture du fichier…</span></div>}</>}
            {dragOver && <div className="drop-overlay"><Upload size={30} /><strong>Déposez votre fichier ici</strong></div>}
          </div>
          <div className="document-status">{docLoaded ? <><span className="status-tip"><MousePointer2 size={15} />{toolHint}</span>{totalPages > 1 && <Pagination aria-label="Pages du document" className="page-pagination"><PaginationContent><PaginationItem><Button size="icon" variant="ghost" disabled={page <= 1 || loading || exporting} aria-label="Page précédente" onClick={() => goToPage(page - 1)}><ChevronLeft /></Button></PaginationItem><PaginationItem className="page-input-wrap"><label htmlFor="edit-page-number">Page</label><Input id="edit-page-number" type="number" min={1} max={totalPages} value={pageEntry} onChange={e => setPageEntry(e.target.value)} onBlur={() => goToPage(Number(pageEntry) || page)} onKeyDown={e => { if (e.key === "Enter") goToPage(Number(pageEntry) || page); }} disabled={loading || exporting} /><span>/ {totalPages}</span></PaginationItem><PaginationItem><Button size="icon" variant="ghost" disabled={page >= totalPages || loading || exporting} aria-label="Page suivante" onClick={() => goToPage(page + 1)}><ChevronRight /></Button></PaginationItem></PaginationContent></Pagination>}</> : <><span className="status-tip"><LockKeyhole size={14} />Traitement sur votre appareil</span><span className="status-format">PDF</span></>}</div>
        </section>
      </div>
      <footer className="page-footer"><span>Corrigez, puis signez si besoin.</span><span>Aucune donnée envoyée en ligne</span></footer>
    </main>
    <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Sélectionner un PDF à corriger" />
    <TextElementDialog open={textDialog.open} onOpenChange={open => setTextDialog(d => ({ ...d, open }))} mode={textDialog.mode} initial={textDialog.initial} onConfirm={confirmTextDialog} onDelete={textDialog.mode === "edit" ? deleteTextDialogElement : undefined} />
    <Dialog open={!!pendingFile} onOpenChange={open => { if (!open) setPendingFile(null); }}><DialogContent className="replace-dialog" showCloseButton={false}><DialogTitle>Ouvrir un autre fichier ?</DialogTitle><DialogDescription>Les corrections apportées au document actuel seront retirées. Pensez à télécharger votre document avant de continuer.</DialogDescription><div className="replace-actions"><DialogClose asChild><Button variant="outline">Garder ce document</Button></DialogClose><Button onClick={() => { const file = pendingFile; setPendingFile(null); if (file) void loadFile(file); }}>Ouvrir le nouveau fichier</Button></div></DialogContent></Dialog>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={filename.replace(/\.[^.]+$/i, "") + "-modifie"} saveHint={saveHint} formats={[{ id: "pdf", label: "PDF", extension: "pdf", description: "document corrigé, qualité d’origine" }]} onConfirm={confirmExport} />
    <Toaster position="bottom-center" theme="light" richColors closeButton />
  </div>;
}
