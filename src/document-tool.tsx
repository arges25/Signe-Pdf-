import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold, CalendarDays, Check, Copy, FileDown, FilePlus, FileText, FolderOpen, Italic, List, ListOrdered, Mail, MapPin, PenLine, Pencil, Phone, Printer, Redo2, ShieldCheck, Trash2, Underline, Undo2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import ExportDialog from "./export-dialog";
import SignatureDialog from "./signature-dialog";
import { clamp, type SignatureAsset, type Stamp } from "@/lib/pdf-signing";
import { loadSavedSignature, saveSignature } from "@/lib/signature-store";
import { requestSaveHandle, saveBlob, saveHint } from "@/lib/save-file";
import { TEMPLATE_DESCRIPTIONS, TEMPLATE_LABELS, templateInitialHtml } from "@/lib/doc-templates";
import type { DocDraft, DocTemplateId } from "@/lib/doc-types";
import { deleteDraft, listDrafts, saveDraft } from "@/lib/doc-drafts-store";
import { getProfileField, setProfileField, type ProfileField } from "@/lib/profile-store";
import { isPageEmpty, reflowPages, restoreSelection, saveSelection } from "@/lib/doc-pagination";
import { renderDocumentPdf } from "@/lib/doc-to-pdf";
import { renderDocumentDocx } from "@/lib/doc-to-docx";
import { renderDocumentHtml, renderDocumentTxt } from "@/lib/doc-to-text";

const TEMPLATE_ORDER: DocTemplateId[] = ["blank", "letter", "attestation", "hebergement"];
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const TEXT_COLORS: [string, string][] = [["#18263c", "Noir"], ["#2457ea", "Bleu"], ["#c0392b", "Rouge"], ["#188160", "Vert"]];
// Hoisted to a stable reference: ExportDialog resets its selected format
// whenever this prop's identity changes (see its own `[open, ...formats]`
// effect), so a fresh array literal here would silently snap the
// selection back to PDF on every unrelated re-render while the dialog is
// open — autosave's tick included.
const DOCUMENT_EXPORT_FORMATS = [
  { id: "pdf", label: "PDF", extension: "pdf", description: "le plus fidèle, texte net" },
  { id: "docx", label: "Word", extension: "docx", description: "modifiable dans Word / LibreOffice" },
  { id: "txt", label: "Texte", extension: "txt", description: "contenu seul, sans mise en forme" },
  { id: "html", label: "HTML", extension: "html", description: "à ouvrir dans un navigateur" },
];
const INSERT_ITEMS: { field: ProfileField | "date"; label: string; icon: typeof CalendarDays }[] = [
  { field: "date", label: "Date du jour", icon: CalendarDays },
  { field: "name", label: "Nom / Prénom", icon: User },
  { field: "address", label: "Adresse", icon: MapPin },
  { field: "phone", label: "Téléphone", icon: Phone },
  { field: "email", label: "E-mail", icon: Mail },
  { field: "place", label: "Lieu", icon: MapPin },
];

function formatTodayFr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function defaultDraftName(templateId: DocTemplateId): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  const base = templateId === "blank" ? "Document" : templateId === "letter" ? "Lettre" : templateId === "attestation" ? "Attestation" : "Attestation-hebergement";
  return `${base}-${dateStr}`;
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

type Screen = "templates" | "editor";
type DraftMeta = { id: string; name: string; templateId: DocTemplateId; createdAt: number };

// Isolated so it can never re-render after its initial mount (comparator
// always returns "equal"). A contentEditable's real content lives in the
// DOM, edited directly by the browser — React never sees those keystrokes.
// If this were an ordinary child, any unrelated state change anywhere in
// DocumentTool (opening the export dialog, selecting a signature…) would
// re-render it and re-apply `dangerouslySetInnerHTML`, silently wiping out
// everything the user just typed back to the page's original seed content.
const PageContentEditable = memo(function PageContentEditable({ id, initialHtml, onInput, registerRef }: {
  id: string;
  initialHtml: string;
  onInput: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  return <div
    className="doc-page-content"
    contentEditable
    suppressContentEditableWarning
    ref={el => registerRef(id, el)}
    onInput={onInput}
    onPaste={e => { e.preventDefault(); const text = e.clipboardData.getData("text/plain"); document.execCommand("insertText", false, text); }}
    dangerouslySetInnerHTML={{ __html: initialHtml }}
  />;
}, () => true);

export default function DocumentTool({ onBack, onSignThis }: { onBack?: () => void; onSignThis: (file: File) => void }) {
  const [screen, setScreen] = useState<Screen>("templates");
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const [pageIds, setPageIds] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(900);
  const initialHtmlRef = useRef<Record<string, string>>({});
  const pageContentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingGrow = useRef(false);
  const reflowTimer = useRef<number | undefined>(undefined);
  const autosaveTimer = useRef<number | undefined>(undefined);

  const [signatures, setSignatures] = useState<Stamp[]>([]);
  const [selectedSig, setSelectedSig] = useState<string | null>(null);
  const [asset, setAsset] = useState<SignatureAsset | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [placingSignature, setPlacingSignature] = useState(false);
  const sigDragRef = useRef<{ id: string; pointerId: number; clientX: number; clientY: number; x: number; y: number; w: number; h: number; rect: DOMRect } | null>(null);

  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [profilePromptField, setProfilePromptField] = useState<ProfileField | null>(null);
  const [profilePromptValue, setProfilePromptValue] = useState("");

  const [drafts, setDrafts] = useState<DocDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [savedTick, setSavedTick] = useState(0);

  const stateRef = useRef({ pageIds, signatures, draftMeta });
  useEffect(() => { stateRef.current = { pageIds, signatures, draftMeta }; });

  useEffect(() => { void loadSavedSignature().then(saved => { if (saved) setAsset(current => current ?? saved); }); }, []);
  useEffect(() => {
    // stageRef only points at a real element once the editor screen is
    // showing (the page stack isn't rendered on the template picker), so
    // this must re-attempt setup whenever `screen` changes — a mount-only
    // effect would find the ref still null the first time and never retry.
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage); return () => observer.disconnect();
  }, [screen]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageContentRefs.current.set(id, el); else pageContentRefs.current.delete(id);
  }, []);

  const getPageEls = useCallback((): HTMLDivElement[] => {
    const ids = stateRef.current.pageIds;
    const els = ids.map(id => pageContentRefs.current.get(id)).filter((e): e is HTMLDivElement => !!e);
    return els.length === ids.length ? els : [];
  }, []);

  const persistDraft = useCallback(async () => {
    const { signatures: sigs, draftMeta: meta } = stateRef.current;
    if (!meta) return;
    const els = getPageEls();
    if (!els.length) return;
    const draft: DocDraft = { id: meta.id, name: meta.name, templateId: meta.templateId, pagesHtml: els.map(e => e.innerHTML), signatures: sigs, createdAt: meta.createdAt, updatedAt: Date.now() };
    await saveDraft(draft);
    setSavedTick(t => t + 1);
  }, [getPageEls]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => void persistDraft(), 1200);
  }, [persistDraft]);

  useEffect(() => {
    function flush() { if (autosaveTimer.current) { window.clearTimeout(autosaveTimer.current); void persistDraft(); } }
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", flush); window.removeEventListener("pagehide", flush); };
  }, [persistDraft]);

  const runReflow = useCallback(() => {
    const els = getPageEls();
    if (!els.length) return;
    const saved = saveSelection();
    const { needsNewPage } = reflowPages(els);
    if (needsNewPage) {
      pendingGrow.current = true;
      setPageIds(ids => [...ids, crypto.randomUUID()]);
      return;
    }
    // Drop every trailing empty page in one pass — a burst of fast edits
    // (or several growth cycles in a row) can leave more than one behind,
    // and only removing one per reflow would take several more debounced
    // passes to fully converge.
    let dropCount = 0;
    while (els.length - dropCount > 1 && isPageEmpty(els[els.length - 1 - dropCount]) && !stateRef.current.signatures.some(s => s.page === els.length - dropCount)) {
      dropCount++;
    }
    if (dropCount > 0) setPageIds(ids => ids.slice(0, ids.length - dropCount));
    restoreSelection(saved, els);
  }, [getPageEls]);

  useEffect(() => {
    if (pendingGrow.current) { pendingGrow.current = false; requestAnimationFrame(runReflow); }
  }, [pageIds.length, runReflow]);

  const scheduleReflow = useCallback((immediate = false) => {
    if (reflowTimer.current) window.clearTimeout(reflowTimer.current);
    if (immediate) { runReflow(); return; }
    reflowTimer.current = window.setTimeout(runReflow, 300);
  }, [runReflow]);

  function handleInput() { scheduleReflow(); scheduleAutosave(); }

  function startDocument(templateId: DocTemplateId) {
    const id = crypto.randomUUID();
    initialHtmlRef.current = { [id]: templateInitialHtml(templateId) };
    pageContentRefs.current.clear();
    setSignatures([]); setSelectedSig(null); setPlacingSignature(false);
    setPageIds([id]);
    setDraftMeta({ id: crypto.randomUUID(), name: defaultDraftName(templateId), templateId, createdAt: Date.now() });
    setScreen("editor");
  }

  function openExistingDraft(d: DocDraft) {
    const ids = d.pagesHtml.map(() => crypto.randomUUID());
    const html: Record<string, string> = {};
    ids.forEach((id, i) => { html[id] = d.pagesHtml[i]; });
    initialHtmlRef.current = html;
    pageContentRefs.current.clear();
    setSignatures(d.signatures ?? []); setSelectedSig(null); setPlacingSignature(false);
    setPageIds(ids);
    setDraftMeta({ id: d.id, name: d.name, templateId: d.templateId, createdAt: d.createdAt });
    setScreen("editor"); setDraftsOpen(false);
    requestAnimationFrame(() => scheduleReflow(true));
  }

  async function openDraftsPanel() {
    setDrafts(await listDrafts());
    setDraftsOpen(true);
  }
  async function duplicateDraft(d: DocDraft) {
    const copy: DocDraft = { ...d, id: crypto.randomUUID(), name: `${d.name} (copie)`, createdAt: Date.now(), updatedAt: Date.now() };
    await saveDraft(copy);
    setDrafts(await listDrafts());
    toast.success("Brouillon dupliqué.");
  }
  async function removeDraft(id: string) {
    await deleteDraft(id);
    setDrafts(await listDrafts());
  }
  async function confirmRename() {
    if (!renamingId) return;
    const target = drafts.find(d => d.id === renamingId);
    if (target) {
      const renamed = { ...target, name: renameValue.trim() || target.name, updatedAt: Date.now() };
      await saveDraft(renamed);
      if (draftMeta?.id === renamingId) setDraftMeta(m => m && { ...m, name: renamed.name });
      setDrafts(await listDrafts());
    }
    setRenamingId(null);
  }

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    scheduleReflow(); scheduleAutosave();
  }

  function applyInlineStyle(styleProp: "fontSize" | "color", cssValue: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { toast("Sélectionnez d’abord du texte."); return; }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style[styleProp] = cssValue;
    try { range.surroundContents(span); }
    catch { const contents = range.extractContents(); span.appendChild(contents); range.insertNode(span); }
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges(); sel.addRange(newRange);
    scheduleReflow(); scheduleAutosave();
  }

  function isWithinAnyPage(node: Node | null): boolean {
    const els = getPageEls();
    return els.some(el => node && el.contains(node));
  }
  function focusLastPageEnd() {
    const els = getPageEls();
    const last = els[els.length - 1];
    if (last) { last.focus(); placeCaretAtEnd(last); }
  }
  function insertTextAtCaret(text: string) {
    if (!isWithinAnyPage(document.activeElement)) focusLastPageEnd();
    document.execCommand("insertText", false, text);
    scheduleReflow(); scheduleAutosave();
  }

  function handleInsertClick(field: ProfileField | "date") {
    if (field === "date") { insertTextAtCaret(formatTodayFr()); setInsertMenuOpen(false); return; }
    const existing = getProfileField(field);
    if (existing) { insertTextAtCaret(existing); setInsertMenuOpen(false); return; }
    setProfilePromptValue(""); setProfilePromptField(field); setInsertMenuOpen(false);
  }
  function confirmProfilePrompt() {
    if (profilePromptField && profilePromptValue.trim()) {
      setProfileField(profilePromptField, profilePromptValue.trim());
      insertTextAtCaret(profilePromptValue.trim());
    }
    setProfilePromptField(null);
  }

  function openSignatureFlow() {
    if (asset) { setPlacingSignature(true); toast("Touchez la page pour placer la signature."); }
    else setSignatureDialogOpen(true);
  }
  function placeSignatureAt(pageNumber: number, x: number, y: number) {
    if (!asset) return;
    const w = Math.min(0.34, 0.24 * (297 / 210) * (asset.width / asset.height));
    const h = w * (210 / 297) * (asset.height / asset.width);
    const stamp: Stamp = { ...asset, id: crypto.randomUUID(), page: pageNumber, x: clamp(x - w / 2, 0, 1 - w), y: clamp(y - h / 2, 0, 1 - h), w, h };
    setSignatures(items => [...items, stamp]); setSelectedSig(stamp.id); setPlacingSignature(false);
    scheduleAutosave();
  }
  function removeSignature(id: string) {
    setSignatures(items => items.filter(s => s.id !== id)); setSelectedSig(null);
    scheduleAutosave();
  }
  function resizeSignature(percent: number) {
    const active = signatures.find(s => s.id === selectedSig);
    if (!active) return;
    const w = percent / 100, h = w * (210 / 297) * (active.height / active.width);
    if (h > 0.95) return;
    setSignatures(items => items.map(s => s.id === active.id ? { ...s, w, h, x: clamp(s.x, 0, 1 - w), y: clamp(s.y, 0, 1 - h) } : s));
    scheduleAutosave();
  }
  function startSigDrag(e: PointerEvent<HTMLButtonElement>, stamp: Stamp, pageEl: HTMLDivElement) {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    setSelectedSig(stamp.id); setPlacingSignature(false);
    const rect = pageEl.getBoundingClientRect();
    sigDragRef.current = { id: stamp.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, x: stamp.x, y: stamp.y, w: stamp.w, h: stamp.h, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveSigDrag(e: PointerEvent<HTMLButtonElement>) {
    const d = sigDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const x = clamp(d.x + (e.clientX - d.clientX) / d.rect.width, 0, 1 - d.w);
    const y = clamp(d.y + (e.clientY - d.clientY) / d.rect.height, 0, 1 - d.h);
    setSignatures(items => items.map(s => s.id === d.id ? { ...s, x, y } : s));
  }
  function stopSigDrag(e: PointerEvent<HTMLButtonElement>) {
    if (sigDragRef.current?.pointerId !== e.pointerId) return;
    sigDragRef.current = null;
    scheduleAutosave();
  }

  function currentPagesHtml(): string[] { return getPageEls().map(e => e.innerHTML); }

  async function confirmExport(name: string, formatId: string) {
    scheduleReflow(true);
    setExporting(true); setError("");
    try {
      const pagesHtml = currentPagesHtml();
      let blob: Blob; let extension: string;
      if (formatId === "docx") { blob = await renderDocumentDocx(pagesHtml, signatures); extension = "docx"; }
      else if (formatId === "txt") { blob = new Blob([renderDocumentTxt(pagesHtml)], { type: "text/plain;charset=utf-8" }); extension = "txt"; }
      else if (formatId === "html") { blob = new Blob([renderDocumentHtml(pagesHtml, name)], { type: "text/html;charset=utf-8" }); extension = "html"; }
      else { const bytes = await renderDocumentPdf(pagesHtml, signatures); blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" }); extension = "pdf"; }

      const finalName = `${name}.${extension}`;
      let handle: FileSystemFileHandle | null = null;
      try { handle = await requestSaveHandle(finalName, blob.type || "application/octet-stream", extension); }
      catch (e) { if ((e as Error).name === "AbortError") return; }
      const outcome = await saveBlob(blob, finalName, handle);
      if ("cancelled" in outcome) return;
      if (outcome.method === "download") setDownload({ url: outcome.url, name: outcome.finalName });
      toast.success("Votre document est prêt.");
      setExportOpen(false);
    } catch (e) {
      console.error("[Signé] Échec de l'export du document", e);
      setError("L’export a échoué. Réessayez.");
    } finally { setExporting(false); }
  }

  async function continueToSign() {
    scheduleReflow(true);
    try {
      const pagesHtml = currentPagesHtml();
      const bytes = await renderDocumentPdf(pagesHtml, signatures);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const outName = `${draftMeta?.name ?? "document"}.pdf`;
      onSignThis(new File([blob], outName, { type: "application/pdf" }));
    } catch (e) {
      console.error("[Signé] Échec de la préparation du document pour signature", e);
      setError("Impossible de préparer ce document pour la signature. Réessayez.");
    }
  }

  function printDocument() {
    scheduleReflow(true);
    setTimeout(() => window.print(), 50);
  }

  const selectedStamp = signatures.find(s => s.id === selectedSig) ?? null;
  const totalPages = pageIds.length;
  const A4_PX_WIDTH = 794, A4_PX_HEIGHT = 1123;
  const pageScale = Math.min(1, (stageWidth - 24) / A4_PX_WIDTH);

  return <div className="app-shell doc-tool-shell">
    <header className="site-header no-print">
      {onBack && <Button variant="ghost" className="back-button" onClick={() => { if (screen === "editor") { void persistDraft(); setScreen("templates"); } else onBack(); }}><ArrowLeft size={16} /> {screen === "editor" ? "Modèles" : "Accueil"}</Button>}
      <div className="brand" aria-label="Signé"><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>Signé<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">La signature, simplement.</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>Tout reste sur votre appareil</span></div>
    </header>

    <main className="main-content doc-tool-main">
      <div className="workspace-heading no-print"><div><p className="eyebrow">VOTRE ESPACE DE RÉDACTION</p><h1>{screen === "templates" ? "Créer un document" : draftMeta?.name || "Document"}</h1></div>
        {screen === "editor" && <Button variant="ghost" className="drafts-button" onClick={openDraftsPanel}><FolderOpen size={16} /> Mes brouillons</Button>}
      </div>

      {error && <div className="error-banner no-print" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Fermer le message" onClick={() => setError("")}><X /></Button></div>}

      {screen === "templates" && <div className="doc-templates-shell no-print">
        <div className="doc-templates-grid">
          {TEMPLATE_ORDER.map(id => <button key={id} type="button" className="doc-template-card" onClick={() => startDocument(id)}>
            <span className="doc-template-icon"><FileText size={26} /></span>
            <h2>{TEMPLATE_LABELS[id]}</h2>
            <p>{TEMPLATE_DESCRIPTIONS[id]}</p>
          </button>)}
        </div>
        <Button variant="outline" className="doc-drafts-entry" onClick={openDraftsPanel}><FolderOpen /> Mes brouillons</Button>
      </div>}

      {screen === "editor" && <div className="doc-editor-shell">
        <div className="doc-toolbar no-print">
          <div className="doc-toolbar-scroll">
            <Button variant="ghost" size="icon" aria-label="Annuler" onMouseDown={e => e.preventDefault()} onClick={() => exec("undo")}><Undo2 /></Button>
            <Button variant="ghost" size="icon" aria-label="Rétablir" onMouseDown={e => e.preventDefault()} onClick={() => exec("redo")}><Redo2 /></Button>
            <span className="doc-toolbar-sep" />
            <select className="doc-select" aria-label="Style" onMouseDown={e => e.stopPropagation()} onChange={e => exec("formatBlock", e.target.value)} defaultValue="<P>">
              <option value="<P>">Normal</option>
              <option value="<H1>">Titre</option>
              <option value="<H2>">Sous-titre</option>
            </select>
            <select className="doc-select doc-select-size" aria-label="Taille du texte" onMouseDown={e => e.stopPropagation()} defaultValue="12" onChange={e => applyInlineStyle("fontSize", `${e.target.value}pt`)}>
              {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="doc-toolbar-sep" />
            <Button variant="ghost" size="icon" aria-label="Gras" onMouseDown={e => e.preventDefault()} onClick={() => exec("bold")}><Bold /></Button>
            <Button variant="ghost" size="icon" aria-label="Italique" onMouseDown={e => e.preventDefault()} onClick={() => exec("italic")}><Italic /></Button>
            <Button variant="ghost" size="icon" aria-label="Souligné" onMouseDown={e => e.preventDefault()} onClick={() => exec("underline")}><Underline /></Button>
            <div className="doc-color-row" onMouseDown={e => e.preventDefault()}>
              {TEXT_COLORS.map(([hex, label]) => <button key={hex} type="button" className="doc-color-swatch" style={{ backgroundColor: hex }} aria-label={`Couleur ${label}`} title={label} onClick={() => applyInlineStyle("color", hex)} />)}
            </div>
            <span className="doc-toolbar-sep" />
            <Button variant="ghost" size="icon" aria-label="Aligner à gauche" onMouseDown={e => e.preventDefault()} onClick={() => exec("justifyLeft")}><AlignLeft /></Button>
            <Button variant="ghost" size="icon" aria-label="Centrer" onMouseDown={e => e.preventDefault()} onClick={() => exec("justifyCenter")}><AlignCenter /></Button>
            <Button variant="ghost" size="icon" aria-label="Aligner à droite" onMouseDown={e => e.preventDefault()} onClick={() => exec("justifyRight")}><AlignRight /></Button>
            <Button variant="ghost" size="icon" aria-label="Justifier" onMouseDown={e => e.preventDefault()} onClick={() => exec("justifyFull")}><AlignJustify /></Button>
            <span className="doc-toolbar-sep" />
            <Button variant="ghost" size="icon" aria-label="Liste à puces" onMouseDown={e => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><List /></Button>
            <Button variant="ghost" size="icon" aria-label="Liste numérotée" onMouseDown={e => e.preventDefault()} onClick={() => exec("insertOrderedList")}><ListOrdered /></Button>
          </div>
          <div className="doc-insert-wrap">
            <Button variant="outline" className="doc-insert-toggle" onClick={() => setInsertMenuOpen(o => !o)}><CalendarDays size={15} /> Insérer</Button>
            {insertMenuOpen && <div className="doc-insert-menu">
              {INSERT_ITEMS.map(item => <button key={item.field} type="button" className="doc-insert-item" onClick={() => handleInsertClick(item.field)}><item.icon size={15} /> {item.label}</button>)}
              <button type="button" className="doc-insert-item" onClick={() => { openSignatureFlow(); setInsertMenuOpen(false); }}><PenLine size={15} /> Signature</button>
            </div>}
          </div>
        </div>

        {selectedStamp && <div className="doc-signature-panel no-print">
          <span className="size-label">Taille de la signature<span>{Math.round(selectedStamp.w * 100)} %</span></span>
          <Slider min={8} max={50} step={1} value={[Math.round(selectedStamp.w * 100)]} onValueChange={([v]) => resizeSignature(v)} aria-label="Taille de la signature" />
          <Button variant="ghost" className="delete-signature" onClick={() => removeSignature(selectedStamp.id)}><Trash2 /> Supprimer la signature</Button>
        </div>}

        {placingSignature && <div className="doc-placing-hint no-print">Touchez la page où placer la signature. <Button variant="ghost" onClick={() => setPlacingSignature(false)}>Annuler</Button></div>}

        <div className="doc-page-stack" id="doc-print-area" ref={stageRef}>
          {pageIds.map((id, index) => <div key={id} className="doc-page-wrapper" style={{ width: A4_PX_WIDTH * pageScale, height: A4_PX_HEIGHT * pageScale }}>
          <div className={`doc-page ${placingSignature ? "is-placing" : ""}`} style={{ transform: `scale(${pageScale})` }} onClick={e => {
            if (!placingSignature) return;
            const rect = e.currentTarget.getBoundingClientRect();
            placeSignatureAt(index + 1, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
          }}>
            <span className="doc-page-number no-print">Page {index + 1} / {totalPages}</span>
            <PageContentEditable id={id} initialHtml={initialHtmlRef.current[id] ?? "<p><br></p>"} onInput={handleInput} registerRef={registerRef} />
            <div className="doc-signature-layer">
              {signatures.filter(s => s.page === index + 1).map(s => <button type="button" key={s.id} className={`placed-signature ${selectedSig === s.id ? "is-selected" : ""}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }}
                onClick={e => { e.stopPropagation(); setSelectedSig(s.id); }}
                onPointerDown={e => startSigDrag(e, s, e.currentTarget.closest(".doc-page") as HTMLDivElement)}
                onPointerMove={moveSigDrag} onPointerUp={stopSigDrag} onPointerCancel={stopSigDrag} onLostPointerCapture={stopSigDrag}
                aria-label="Signature : faites glisser pour la déplacer">
                <img src={s.dataUrl} alt="Signature" draggable={false} />
                {selectedSig === s.id && <><i className="handle top-left" /><i className="handle top-right" /><i className="handle bottom-left" /><i className="handle bottom-right" /></>}
              </button>)}
            </div>
          </div>
          </div>)}
        </div>

        <div className="doc-bottom-actions no-print">
          <span className="doc-autosave-note" key={savedTick}><Check size={13} /> Brouillon enregistré</span>
          <Button variant="ghost" onClick={printDocument}><Printer /> Imprimer</Button>
          <Button variant="outline" onClick={continueToSign}><PenLine /> Continuer vers la signature</Button>
          <Button className="primary-button" onClick={() => setExportOpen(true)}><FileDown /> Exporter</Button>
        </div>
      </div>}
    </main>

    <Dialog open={!!profilePromptField} onOpenChange={o => { if (!o) setProfilePromptField(null); }}>
      <DialogContent className="replace-dialog" showCloseButton={false}>
        <DialogTitle>{profilePromptField && INSERT_ITEMS.find(i => i.field === profilePromptField)?.label}</DialogTitle>
        <DialogDescription>Cette information sera mémorisée sur cet appareil pour les prochaines insertions.</DialogDescription>
        <Input autoFocus value={profilePromptValue} onChange={e => setProfilePromptValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmProfilePrompt(); }} />
        <div className="replace-actions"><DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose><Button onClick={confirmProfilePrompt} disabled={!profilePromptValue.trim()}>Insérer</Button></div>
      </DialogContent>
    </Dialog>

    <Dialog open={draftsOpen} onOpenChange={setDraftsOpen}>
      <DialogContent className="signature-dialog doc-drafts-dialog" showCloseButton>
        <DialogTitle className="dialog-title">Mes brouillons</DialogTitle>
        <DialogDescription>Vos documents sont enregistrés uniquement sur cet appareil.</DialogDescription>
        {!drafts.length && <p className="section-copy">Aucun brouillon pour le moment.</p>}
        <div className="doc-drafts-list">
          {drafts.sort((a, b) => b.updatedAt - a.updatedAt).map(d => <div key={d.id} className="doc-draft-row">
            {renamingId === d.id
              ? <div className="doc-draft-rename"><Input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void confirmRename(); }} /><Button size="icon" variant="ghost" onClick={confirmRename}><Check /></Button></div>
              : <button type="button" className="doc-draft-open" onClick={() => openExistingDraft(d)}><strong>{d.name}</strong><span>{TEMPLATE_LABELS[d.templateId]} · {new Date(d.updatedAt).toLocaleDateString("fr-FR")}</span></button>}
            <div className="doc-draft-actions">
              <Button size="icon" variant="ghost" aria-label="Renommer" onClick={() => { setRenamingId(d.id); setRenameValue(d.name); }}><Pencil size={15} /></Button>
              <Button size="icon" variant="ghost" aria-label="Dupliquer" onClick={() => void duplicateDraft(d)}><Copy size={15} /></Button>
              <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => void removeDraft(d.id)}><Trash2 size={15} /></Button>
            </div>
          </div>)}
        </div>
        {screen === "templates" && <Button variant="outline" className="doc-new-from-drafts" onClick={() => setDraftsOpen(false)}><FilePlus /> Nouveau document</Button>}
      </DialogContent>
    </Dialog>

    <SignatureDialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} onSave={signature => {
      setAsset(signature); void saveSignature(signature);
      setPlacingSignature(true); toast("Signature prête : touchez la page pour la placer.");
    }} />

    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={draftMeta?.name ?? "document"} saveHint={saveHint}
      formats={DOCUMENT_EXPORT_FORMATS} onConfirm={confirmExport} />
    {exporting && <div className="loading-overlay no-print" role="status"><span>Préparation du fichier…</span></div>}
    {download && <div className="download-banner no-print" role="status"><div><strong>Votre document est prêt.</strong><span>Sur iPhone, ouvrez le fichier puis utilisez Partager → Enregistrer dans Fichiers.</span></div><a href={download.url} download={download.name}>Télécharger</a></div>}
    <Toaster position="bottom-center" theme="light" richColors closeButton />
  </div>;
}
