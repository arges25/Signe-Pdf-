import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, Camera, Check, FileDown, FileEdit, Images, LoaderCircle, PenLine, Plus, RefreshCw, RotateCw, ScanLine, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import ExportDialog from "./export-dialog";
import { clamp } from "@/lib/pdf-signing";
import { defaultCorners, type Point, type Quad } from "@/lib/perspective";
import { detectOrDefaultCorners } from "@/lib/scan-corners";
import { decodeToWorkingCanvas, renderThumbnail, rotateCanvas, rotateQuadNormalized } from "@/lib/scan-processing";
import { FILTER_LABELS, type ScanFilter } from "@/lib/scan-filters";
import { QUALITY_DESCRIPTIONS, QUALITY_LABELS, QUALITY_PRESETS, type ScanPage, type ScanQuality } from "@/lib/scan-types";
import { buildPdfFromScans } from "@/lib/scan-to-pdf";
import { requestSaveHandle, saveBlob, saveHint } from "@/lib/save-file";

const FILTER_ORDER: ScanFilter[] = ["original", "auto", "color", "bw", "grayscale", "contrast"];

function todayFilenameFr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Scan-${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

type View = "list" | "editor" | "result";

export default function ScanTool({ onBack, onEditThis, onSignThis }: {
  onBack?: () => void;
  onEditThis: (file: File) => void;
  onSignThis: (file: File) => void;
}) {
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const objectUrls = useRef<Set<string>>(new Set());
  const cornerDragRef = useRef<{ index: number; pointerId: number; rect: DOMRect } | null>(null);

  const [pages, setPages] = useState<ScanPage[]>([]);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState<ScanQuality>("high");
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<HTMLCanvasElement | null>(null);
  const [editingCorners, setEditingCorners] = useState<Quad | null>(null);
  const [editingFilter, setEditingFilter] = useState<ScanFilter>("auto");
  const [editingImageUrl, setEditingImageUrl] = useState("");
  const [editingPreviewUrl, setEditingPreviewUrl] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const editingIsNewPage = useRef(false);

  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; pageCount: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);

  function track(url: string) { objectUrls.current.add(url); return url; }
  function releaseTracked(url: string) { if (url) { URL.revokeObjectURL(url); objectUrls.current.delete(url); } }
  useEffect(() => () => { objectUrls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const buildPage = useCallback(async (file: File): Promise<ScanPage> => {
    const canvas = await decodeToWorkingCanvas(file);
    const corners = detectOrDefaultCorners(canvas, canvas.width, canvas.height);
    const page: ScanPage = { id: crypto.randomUUID(), sourceCanvas: canvas, corners, outputRotation: 0, filter: "auto", thumbnailUrl: "" };
    page.thumbnailUrl = track(await renderThumbnail(page));
    return page;
  }, []);

  const importFiles = useCallback(async (files: FileList | File[], opts: { openEditorForSingle: boolean }) => {
    const list = Array.from(files);
    if (!list.length || busyRef.current) return;
    busyRef.current = true; setLoading(true); setError("");
    const failures: string[] = [];
    const added: ScanPage[] = [];
    for (const file of list) {
      if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) { failures.push(file.name); continue; }
      try { added.push(await buildPage(file)); }
      catch (e) { console.error("[Signé] Échec de l'import d'une image de scan", file.name, e); failures.push(file.name); }
    }
    if (added.length) setPages(items => [...items, ...added]);
    if (failures.length) {
      toast(failures.length === 1
        ? `« ${failures[0]} » n’a pas pu être ouvert (format non pris en charge sur cet appareil).`
        : `${failures.length} image(s) n’ont pas pu être ouvertes (format non pris en charge sur cet appareil).`);
    }
    busyRef.current = false; setLoading(false);
    if (opts.openEditorForSingle && added.length === 1) openEditor(added[0], true);
    else if (added.length) toast.success(`${added.length} page${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPage]);

  const replaceFile = useCallback(async (file: File, targetId: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setLoading(true); setError("");
    try {
      const fresh = await buildPage(file);
      setPages(items => items.map(p => {
        if (p.id !== targetId) return p;
        releaseTracked(p.thumbnailUrl);
        return { ...fresh, id: targetId };
      }));
      toast.success("Page remplacée.");
    } catch { toast("Impossible d’ouvrir cette image."); }
    finally { busyRef.current = false; setLoading(false); }
  }, [buildPage]);

  function openEditor(page: ScanPage, isNew: boolean) {
    editingIsNewPage.current = isNew;
    setEditingPageId(page.id);
    setEditingSource(page.sourceCanvas);
    setEditingCorners(page.corners);
    setEditingFilter(page.filter);
    const blobUrlPromise = new Promise<string>(resolve => page.sourceCanvas.toBlob(blob => resolve(blob ? URL.createObjectURL(blob) : ""), "image/jpeg", 0.85));
    void blobUrlPromise.then(url => setEditingImageUrl(track(url)));
    setEditingPreviewUrl("");
    setView("editor");
    void refreshEditorPreview(page.sourceCanvas, page.corners, page.filter);
  }

  async function refreshEditorPreview(source: HTMLCanvasElement, corners: Quad, filter: ScanFilter) {
    setEditingBusy(true);
    try {
      const previewPage: ScanPage = { id: "preview", sourceCanvas: source, corners, outputRotation: 0, filter, thumbnailUrl: "" };
      const url = await renderThumbnail(previewPage, 420);
      setEditingPreviewUrl(prev => { if (prev) releaseTracked(prev); return track(url); });
    } finally { setEditingBusy(false); }
  }

  // Applies `updated` to the page list immediately (so the UI reflects the
  // change right away), then regenerates just that page's thumbnail from
  // the exact same object — never re-reading back from React state, which
  // would race against the setPages call above still being applied.
  function commitPageUpdate(updated: ScanPage) {
    setPages(items => items.map(p => p.id === updated.id ? updated : p));
    void (async () => {
      const url = await renderThumbnail(updated);
      setPages(items => items.map(p => {
        if (p.id !== updated.id) return p;
        releaseTracked(p.thumbnailUrl);
        return { ...p, thumbnailUrl: track(url) };
      }));
    })();
  }

  function closeEditor(commit: boolean) {
    if (commit && editingPageId && editingCorners) {
      const current = pages.find(p => p.id === editingPageId);
      if (current) commitPageUpdate({ ...current, sourceCanvas: editingSource ?? current.sourceCanvas, corners: editingCorners, filter: editingFilter });
    } else if (!commit && editingIsNewPage.current && editingPageId) {
      setPages(items => { const target = items.find(p => p.id === editingPageId); if (target) releaseTracked(target.thumbnailUrl); return items.filter(p => p.id !== editingPageId); });
    }
    if (editingImageUrl) releaseTracked(editingImageUrl);
    if (editingPreviewUrl) releaseTracked(editingPreviewUrl);
    setEditingImageUrl(""); setEditingPreviewUrl(""); setEditingPageId(null); setEditingSource(null); setEditingCorners(null);
    setView("list");
  }

  function startCornerDrag(e: PointerEvent<HTMLButtonElement>, index: number, stageEl: HTMLDivElement) {
    e.stopPropagation(); e.preventDefault();
    const rect = stageEl.getBoundingClientRect();
    cornerDragRef.current = { index, pointerId: e.pointerId, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
    moveCornerDrag(e);
  }
  function moveCornerDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = cornerDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const x = clamp((e.clientX - drag.rect.left) / drag.rect.width, 0, 1);
    const y = clamp((e.clientY - drag.rect.top) / drag.rect.height, 0, 1);
    setEditingCorners(corners => corners ? corners.map((c, i) => i === drag.index ? { x, y } : c) as Quad : corners);
  }
  function stopCornerDrag(e: PointerEvent<HTMLButtonElement>) {
    if (cornerDragRef.current?.pointerId !== e.pointerId) return;
    cornerDragRef.current = null;
    if (editingSource && editingCorners) void refreshEditorPreview(editingSource, editingCorners, editingFilter);
  }

  function reRunAutoDetect() {
    if (!editingSource) return;
    const detected = detectOrDefaultCorners(editingSource, editingSource.width, editingSource.height);
    setEditingCorners(detected);
    void refreshEditorPreview(editingSource, detected, editingFilter);
  }
  function resetToFullFrame() {
    if (!editingSource) return;
    const corners = defaultCorners(0.01);
    setEditingCorners(corners);
    void refreshEditorPreview(editingSource, corners, editingFilter);
  }
  function rotateEditingSource() {
    if (!editingSource || !editingCorners) return;
    const rotated = rotateCanvas(editingSource, 90);
    const rotatedCorners = rotateQuadNormalized(editingCorners, 90);
    setEditingSource(rotated); setEditingCorners(rotatedCorners);
    if (editingImageUrl) releaseTracked(editingImageUrl);
    rotated.toBlob(blob => { if (blob) setEditingImageUrl(track(URL.createObjectURL(blob))); }, "image/jpeg", 0.85);
    void refreshEditorPreview(rotated, rotatedCorners, editingFilter);
  }
  function chooseFilter(filter: ScanFilter) {
    setEditingFilter(filter);
    if (editingSource && editingCorners) void refreshEditorPreview(editingSource, editingCorners, filter);
  }

  function movePage(id: string, direction: -1 | 1) {
    setPages(items => {
      const index = items.findIndex(p => p.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = items.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function rotatePageOutput(id: string) {
    const target = pages.find(p => p.id === id);
    if (!target) return;
    const outputRotation = ((target.outputRotation + 90) % 360) as ScanPage["outputRotation"];
    commitPageUpdate({ ...target, outputRotation });
  }
  function removePage(id: string) {
    setPages(items => { const target = items.find(p => p.id === id); if (target) releaseTracked(target.thumbnailUrl); return items.filter(p => p.id !== id); });
  }
  function requestReplace(id: string) {
    setReplaceTargetId(id);
    replaceInput.current?.click();
  }

  async function createPdf() {
    if (!pages.length || building) return;
    setBuilding(true); setError("");
    try {
      const bytes = await buildPdfFromScans(pages, QUALITY_PRESETS[quality]);
      setResult({ bytes, pageCount: pages.length });
      setView("result");
    } catch (e) {
      console.error("[Signé] Échec de la création du PDF scanné", e);
      setError("La création du PDF a échoué. Réessayez, ou avec moins de pages à la fois.");
    } finally { setBuilding(false); }
  }

  async function confirmExport(name: string) {
    if (!result || busyRef.current) return;
    busyRef.current = true; setExporting(true);
    try {
      let handle: FileSystemFileHandle | null = null;
      try { handle = await requestSaveHandle(`${name}.pdf`, "application/pdf", "pdf"); }
      catch (e) { if ((e as Error).name === "AbortError") return; }
      const blob = new Blob([new Uint8Array(result.bytes)], { type: "application/pdf" });
      const outcome = await saveBlob(blob, `${name}.pdf`, handle);
      if ("cancelled" in outcome) return;
      if (outcome.method === "download") setDownload({ url: outcome.url, name: outcome.finalName });
      toast.success("Votre PDF scanné est prêt.");
      setExportOpen(false);
    } catch { setError("L’export n’a pas pu être préparé. Réessayez."); }
    finally { busyRef.current = false; setExporting(false); }
  }

  function toFile(name: string): File {
    return new File([new Uint8Array(result!.bytes)], name, { type: "application/pdf" });
  }
  function editThisScan() { if (result) onEditThis(toFile(`${todayFilenameFr()}.pdf`)); }
  function signThisScan() { if (result) onSignThis(toFile(`${todayFilenameFr()}.pdf`)); }
  function newScan() {
    pages.forEach(p => releaseTracked(p.thumbnailUrl));
    setPages([]); setResult(null); setDownload(null); setView("list");
  }

  const active = editingPageId ? pages.find(p => p.id === editingPageId) : null;

  return <div className="app-shell">
    <header className="site-header">
      {onBack && <Button variant="ghost" className="back-button" onClick={() => view === "editor" ? closeEditor(false) : onBack()}><ArrowLeft size={16} /> {view === "editor" ? "Annuler" : "Accueil"}</Button>}
      <div className="brand" aria-label="Signé"><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>Signé<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">La signature, simplement.</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>Tout reste sur votre appareil</span></div>
    </header>

    <main className="main-content">
      <div className="workspace-heading"><div><p className="eyebrow">VOTRE ESPACE DE NUMÉRISATION</p><h1>{view === "editor" ? "Ajuster les 4 coins" : view === "result" ? "Votre PDF est prêt" : "Scanner un document"}</h1></div></div>

      {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Fermer le message" onClick={() => setError("")}><X /></Button></div>}

      {view === "list" && <div className="scan-shell">
        {!pages.length
          ? <div className="scan-empty">
              <div className="upload-icon"><ScanLine size={38} strokeWidth={1.4} /><span><Plus size={15} /></span></div>
              <h2 className="upload-title">Numérisez votre premier document</h2>
              <p className="upload-description">Prenez une photo ou importez une image. Tout reste sur votre appareil.</p>
              <div className="scan-import-actions">
                <Button className="primary-button" disabled={loading} onClick={() => cameraInput.current?.click()}>{loading ? <LoaderCircle className="spin" /> : <Camera size={18} />} Prendre une photo</Button>
                <Button variant="outline" disabled={loading} onClick={() => galleryInput.current?.click()}><Images size={18} /> Importer des images</Button>
              </div>
              <span className="upload-meta">JPG, PNG, WEBP, HEIC · plusieurs images à la fois</span>
            </div>
          : <>
              <div className="scan-pages-grid">
                {pages.map((page, index) => <div key={page.id} className="scan-page-card">
                  <div className="scan-page-thumb"><img src={page.thumbnailUrl} alt={`Page ${index + 1}`} /><span className="scan-page-number">{index + 1}</span></div>
                  <div className="scan-page-actions">
                    <Button variant="ghost" size="icon" aria-label="Ajuster les coins" disabled={loading} onClick={() => openEditor(page, false)}><ScanLine size={16} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Faire pivoter" disabled={loading} onClick={() => rotatePageOutput(page.id)}><RotateCw size={16} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remplacer cette page" disabled={loading} onClick={() => requestReplace(page.id)}><RefreshCw size={16} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={loading || index === 0} onClick={() => movePage(page.id, -1)}><ArrowUp size={16} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={loading || index === pages.length - 1} onClick={() => movePage(page.id, 1)}><ArrowDown size={16} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Supprimer cette page" disabled={loading} onClick={() => removePage(page.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>)}
                <button type="button" className="scan-add-card" disabled={loading} onClick={() => cameraInput.current?.click()}>{loading ? <LoaderCircle className="spin" /> : <Plus size={26} />}<span>Ajouter une page</span></button>
              </div>
              <div className="scan-import-actions scan-import-actions-secondary">
                <Button variant="ghost" disabled={loading} onClick={() => cameraInput.current?.click()}><Camera size={16} /> Prendre une photo</Button>
                <Button variant="ghost" disabled={loading} onClick={() => galleryInput.current?.click()}><Images size={16} /> Importer des images</Button>
              </div>
              <div className="scan-quality-row">
                <span className="field-label">Qualité</span>
                <RadioGroup value={quality} onValueChange={v => setQuality(v as ScanQuality)} className="quality-options" aria-label="Qualité du PDF">
                  {(["standard", "high", "maximum"] as ScanQuality[]).map(q => <label key={q} className="quality-option"><RadioGroupItem value={q} /><span><strong>{QUALITY_LABELS[q]}</strong><span className="format-option-desc">{QUALITY_DESCRIPTIONS[q]}</span></span></label>)}
                </RadioGroup>
              </div>
              <Button className="primary-button create-pdf-button" disabled={building} onClick={createPdf}>{building ? <LoaderCircle className="spin" /> : <FileDown />}{building ? "Création du PDF…" : "Créer mon PDF"}</Button>
            </>}
      </div>}

      {view === "editor" && active && editingCorners && <div className="scan-editor">
        <div className="scan-editor-stage">
          <CornerStage imageUrl={editingImageUrl} corners={editingCorners} onCornerDown={startCornerDrag} onCornerMove={moveCornerDrag} onCornerUp={stopCornerDrag} />
        </div>
        <div className="scan-editor-side">
          <div className="scan-editor-toolbar">
            <Button variant="outline" onClick={reRunAutoDetect}><ScanLine size={16} /> Détection auto</Button>
            <Button variant="outline" onClick={resetToFullFrame}>Image entière</Button>
            <Button variant="outline" onClick={rotateEditingSource}><RotateCw size={16} /> Pivoter</Button>
          </div>
          <div className="scan-preview-box">
            {editingBusy && <div className="scan-preview-loading"><LoaderCircle className="spin" /></div>}
            {editingPreviewUrl && <img src={editingPreviewUrl} alt="Aperçu du rendu" />}
          </div>
          <div className="scan-filter-row">
            {FILTER_ORDER.map(f => <button key={f} type="button" className={`scan-filter-chip ${editingFilter === f ? "is-active" : ""}`} onClick={() => chooseFilter(f)}>{f === "auto" && <Sparkles size={13} />}{FILTER_LABELS[f]}</button>)}
          </div>
          <div className="scan-editor-actions">
            <Button variant="outline" onClick={() => closeEditor(false)}>Annuler</Button>
            <Button className="primary-button" onClick={() => closeEditor(true)}><Check /> Valider</Button>
          </div>
        </div>
      </div>}

      {view === "result" && result && <div className="scan-result">
        <div className="scan-result-summary"><FileDown size={26} /><div><strong>{result.pageCount} page{result.pageCount > 1 ? "s" : ""} numérisée{result.pageCount > 1 ? "s" : ""}</strong><span>{(result.bytes.length / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo</span></div></div>
        {download && <div className="download-banner" role="status"><div><strong>Votre PDF scanné est prêt.</strong><span>Sur iPhone, ouvrez le fichier puis utilisez Partager → Enregistrer dans Fichiers.</span></div><a href={download.url} download={download.name}>Télécharger</a></div>}
        <div className="scan-result-actions">
          <Button className="primary-button" disabled={exporting} onClick={() => setExportOpen(true)}><FileDown /> Télécharger le PDF</Button>
          <Button variant="outline" disabled={exporting} onClick={editThisScan}><FileEdit /> Modifier ce PDF</Button>
          <Button variant="outline" disabled={exporting} onClick={signThisScan}><PenLine /> Signer ce PDF</Button>
        </div>
        <Button variant="ghost" className="scan-new-button" disabled={exporting} onClick={newScan}>Nouveau scan</Button>
      </div>}
    </main>

    <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void importFiles(files, { openEditorForSingle: true }); }} aria-label="Prendre une photo" />
    <input ref={galleryInput} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void importFiles(files, { openEditorForSingle: files.length === 1 }); }} aria-label="Importer des images" />
    <input ref={replaceInput} type="file" accept="image/*,.heic,.heif" className="sr-only" tabIndex={-1} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; const target = replaceTargetId; setReplaceTargetId(null); if (file && target) void replaceFile(file, target); }} aria-label="Remplacer cette page" />

    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={todayFilenameFr()} saveHint={saveHint} formats={[{ id: "pdf", label: "PDF", extension: "pdf", description: `${result?.pageCount ?? 0} page${(result?.pageCount ?? 0) > 1 ? "s" : ""}` }]} onConfirm={confirmExport} />
    <Toaster position="bottom-center" theme="light" richColors closeButton />
  </div>;
}

function CornerStage({ imageUrl, corners, onCornerDown, onCornerMove, onCornerUp }: {
  imageUrl: string;
  corners: Quad;
  onCornerDown: (e: PointerEvent<HTMLButtonElement>, index: number, stageEl: HTMLDivElement) => void;
  onCornerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onCornerUp: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const points = corners.map((c: Point) => `${c.x * 100},${c.y * 100}`).join(" ");
  return <div className="corner-stage" ref={stageRef}>
    {imageUrl && <img src={imageUrl} alt="Photo importée" className="corner-stage-image" draggable={false} />}
    <svg className="corner-stage-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points={points} className="corner-polygon" />
    </svg>
    {corners.map((c: Point, i: number) => <button key={i} type="button" className="corner-handle" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} aria-label={`Coin ${i + 1}, faites glisser pour l’ajuster`}
      onPointerDown={e => { if (stageRef.current) onCornerDown(e, i, stageRef.current); }} onPointerMove={onCornerMove} onPointerUp={onCornerUp} onPointerCancel={onCornerUp} onLostPointerCapture={onCornerUp} />)}
  </div>;
}
