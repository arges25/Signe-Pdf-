import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, FolderOpen, LoaderCircle, PenLine, Printer, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportDialog, { type ExportFormat } from "@/export-dialog";
import SignatureDialog from "@/signature-dialog";
import { loadSavedSignature } from "@/lib/signature-store";
import type { SignatureAsset } from "@/lib/pdf-signing";
import { requestSaveHandle, saveBlob, saveHint as fsSaveHint } from "@/lib/save-file";

import type { CvData, CvLanguage } from "./types/cv-data";
import { createEmptyCvData } from "./types/cv-data";

const CV_LANGUAGES: CvLanguage[] = ["fr", "en", "de", "tr"];
import type { CvTemplateId } from "./types/template";
import type { CvTheme } from "./types/theme";
import type { CvDraft } from "./types/draft";
import { templateConfig, DEFAULT_TEMPLATE_ID } from "./templates/registry";
import { listCvDrafts, saveCvDraft, deleteCvDraft } from "./storage/cv-store";
import CvRenderer from "./preview/CvRenderer";
import { A4_WIDTH_PX } from "./preview/layout-constants";
import { renderCvPdf } from "./export/cv-to-pdf";
import { renderCvDocx } from "./export/cv-to-docx";

import TemplateGallery from "./editor/TemplateGallery";
import MyCvsDialog from "./editor/MyCvsDialog";
import PersonalInfoForm from "./editor/PersonalInfoForm";
import PhotoForm from "./editor/PhotoForm";
import ProfileForm from "./editor/ProfileForm";
import { ExperienceForm, EducationForm } from "./editor/ExperienceEducationForms";
import { SkillsForm, LanguagesForm } from "./editor/SkillsLanguagesForm";
import { CertificationsForm, PermitsForm, ProjectsForm, InterestsForm, ReferencesForm } from "./editor/MoreSectionsForm";
import CustomSectionsForm from "./editor/CustomSectionsForm";
import OrganizeSections from "./editor/OrganizeSections";
import DesignPanel, { DateFormatField } from "./editor/DesignPanel";
import { QrPanel, SignaturePanel } from "./editor/QrSignaturePanel";
import OverflowWarning from "./editor/OverflowWarning";
import { usePaginatedCvPageCount } from "./preview/use-page-count";

const AUTOSAVE_DELAY = 1000;

function slugifyName(data: CvData, cvLang: string, t: (k: string) => string): string {
  const name = [data.personal.firstName, data.personal.lastName].filter(Boolean).join("-") || t("common.untitled");
  const date = new Date().toLocaleDateString(cvLang === "fr" ? "fr-FR" : cvLang === "de" ? "de-DE" : cvLang === "tr" ? "tr-TR" : "en-US").replace(/\//g, "-");
  return `${name}-CV-${date}`;
}

export default function CvTool({ onBack, onSignThis, initialDraftId }: { onBack: () => void; onSignThis: (file: File) => void; initialDraftId?: string }) {
  const { t, i18n } = useTranslation();
  const [screen, setScreen] = useState<"gallery" | "editor">("gallery");
  // True once the user has actually picked a template or opened a saved
  // draft — gates autosave (so merely glancing at the gallery never
  // creates a blank entry in "Mes CV") and tells the gallery's "use this
  // template" callback whether it's starting a brand-new CV or handling
  // an in-place template switch for the CV already being edited (the
  // "Changer de modèle" button routes back through this same gallery).
  const [hasStartedCv, setHasStartedCv] = useState(false);
  const [cvId, setCvId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<CvTemplateId>(DEFAULT_TEMPLATE_ID);
  const [data, setData] = useState<CvData>(() => createEmptyCvData("fr"));
  const [theme, setTheme] = useState<CvTheme>(() => templateConfig(DEFAULT_TEMPLATE_ID).defaultTheme);
  const [drafts, setDrafts] = useState<CvDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [navTab, setNavTab] = useState<"content" | "organize" | "design">("content");
  const [savedTick, setSavedTick] = useState(0);
  const [signatureAsset, setSignatureAsset] = useState<SignatureAsset | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [signing, setSigning] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ cvId, templateId, data, theme, hasStartedCv });
  useEffect(() => { stateRef.current = { cvId, templateId, data, theme, hasStartedCv }; });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = templateConfig(templateId);
  const pageCount = usePaginatedCvPageCount(data, theme, template);

  useEffect(() => { void loadSavedSignature().then(setSignatureAsset); }, []);
  useEffect(() => { void listCvDrafts().then(setDrafts); }, []);
  useEffect(() => {
    if (!initialDraftId) return;
    void listCvDrafts().then(list => {
      const draft = list.find(d => d.id === initialDraftId);
      if (!draft) return;
      setCvId(draft.id); setTemplateId(draft.templateId); setData(draft.data); setTheme(draft.theme);
      setHasStartedCv(true);
      setScreen("editor"); setNavTab("content"); setMobileView("edit");
    });
    // Deliberately runs once per mount for the initial deep link — the CV
    // tool stays mounted after that, so re-running on prop identity churn
    // would fight the user's own in-editor navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [screen, mobileView]);

  function scheduleAutosave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void persistDraft(); }, AUTOSAVE_DELAY);
  }
  async function persistDraft() {
    const s = stateRef.current;
    if (!s.hasStartedCv) return; // nothing real to save yet — never create a blank entry in "Mes CV"
    const id = s.cvId ?? crypto.randomUUID();
    if (!s.cvId) setCvId(id);
    const existing = drafts.find(d => d.id === id);
    const draft: CvDraft = {
      id, name: existing?.name ?? slugifyName(s.data, s.data.cvLanguage, t),
      templateId: s.templateId, data: s.data, theme: s.theme,
      createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now(),
    };
    await saveCvDraft(draft);
    setDrafts(list => { const idx = list.findIndex(d => d.id === id); if (idx === -1) return [...list, draft]; const copy = [...list]; copy[idx] = draft; return copy; });
    setSavedTick(x => x + 1);
  }
  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  function updateData(patch: Partial<CvData> | ((d: CvData) => CvData)) {
    setData(d => (typeof patch === "function" ? patch(d) : { ...d, ...patch }));
    scheduleAutosave();
  }
  function updateTheme(patch: Partial<CvTheme>) {
    setTheme(th => ({ ...th, ...patch }));
    scheduleAutosave();
  }

  // The gallery's "use this template" callback serves two different
  // moments: picking a template for a brand-new CV, and — since
  // "Changer de modèle" routes back through this same gallery — swapping
  // the template of the CV already being edited. hasStartedCv tells them
  // apart: only the fresh-start case resets data/cvId.
  function useTemplate(id: CvTemplateId) {
    if (hasStartedCv) { changeTemplate(id); setScreen("editor"); return; }
    setData(createEmptyCvData(((i18n.language as CvLanguage) && CV_LANGUAGES.includes(i18n.language as CvLanguage)) ? (i18n.language as CvLanguage) : "fr"));
    setTemplateId(id);
    setTheme(templateConfig(id).defaultTheme);
    setCvId(null);
    setHasStartedCv(true);
    setScreen("editor");
    setNavTab("content");
    setMobileView("edit");
  }
  function changeTemplate(id: CvTemplateId) {
    setTemplateId(id);
    setTheme(templateConfig(id).defaultTheme);
    scheduleAutosave();
  }
  function resetStyle() {
    setTheme(templateConfig(templateId).defaultTheme);
    scheduleAutosave();
  }

  function openDraft(id: string) {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    setCvId(draft.id); setTemplateId(draft.templateId); setData(draft.data); setTheme(draft.theme);
    setHasStartedCv(true);
    setScreen("editor"); setDraftsOpen(false); setNavTab("content"); setMobileView("edit");
  }
  async function duplicateDraft(id: string) {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    const copy: CvDraft = { ...draft, id: crypto.randomUUID(), name: `${draft.name} (2)`, createdAt: Date.now(), updatedAt: Date.now() };
    await saveCvDraft(copy);
    setDrafts(list => [...list, copy]);
  }
  async function removeDraft(id: string) {
    await deleteCvDraft(id);
    setDrafts(list => list.filter(d => d.id !== id));
    if (cvId === id) setCvId(null);
  }
  function startRename(id: string, current: string) { setRenamingId(id); setRenameValue(current); }
  async function confirmRename() {
    if (!renamingId) return;
    const draft = drafts.find(d => d.id === renamingId);
    if (draft && renameValue.trim()) {
      const updated = { ...draft, name: renameValue.trim(), updatedAt: Date.now() };
      await saveCvDraft(updated);
      setDrafts(list => list.map(d => d.id === updated.id ? updated : d));
    }
    setRenamingId(null);
  }

  function goBackHome() { void persistDraft(); onBack(); }
  function goToGallery() { void persistDraft(); setScreen("gallery"); }

  async function handleExport(name: string, formatId: string) {
    if (formatId === "pdf") {
      setExporting("pdf");
      try {
        const bytes = await renderCvPdf(data, theme, template, data.signature.enabled ? signatureAsset : null);
        const handle = await requestSaveHandle(`${name}.pdf`, "application/pdf", "pdf").catch(() => null);
        const outcome = await saveBlob(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `${name}.pdf`, handle);
        if (outcome && "method" in outcome && outcome.method !== undefined) toast.success(t("common.saved"));
      } finally { setExporting(null); }
    } else {
      setExporting("docx");
      try {
        const blob = await renderCvDocx(data, theme, template, data.signature.enabled ? signatureAsset : null);
        const handle = await requestSaveHandle(`${name}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx").catch(() => null);
        const outcome = await saveBlob(blob, `${name}.docx`, handle);
        if (outcome && "method" in outcome && outcome.method !== undefined) toast.success(t("common.saved"));
      } finally { setExporting(null); }
    }
    setExportOpen(false);
  }

  async function continueToSign() {
    setSigning(true);
    try {
      const bytes = await renderCvPdf(data, theme, template, data.signature.enabled ? signatureAsset : null);
      const file = new File([new Uint8Array(bytes)], `${slugifyName(data, data.cvLanguage, t)}.pdf`, { type: "application/pdf" });
      onSignThis(file);
    } finally { setSigning(false); }
  }

  function printCv() { setTimeout(() => window.print(), 50); }

  function handleSignatureSaved(asset: SignatureAsset) {
    setSignatureAsset(asset);
    updateData({ signature: { ...data.signature, enabled: true } });
  }

  const EXPORT_FORMATS: ExportFormat[] = [
    { id: "pdf", label: t("cv.export.pdf"), extension: "pdf", description: t("cv.export.pdfDescription") },
    { id: "word", label: t("cv.export.word"), extension: "docx", description: t("cv.export.wordDescription") },
  ];

  const scale = stageWidth > 0 ? Math.min(1, (stageWidth - 24) / A4_WIDTH_PX) : 1;

  if (screen === "gallery") {
    return <div className="app-shell">
      <header className="site-header">
        <Button variant="ghost" size="sm" onClick={goBackHome}><ArrowLeft size={16} /> {t("common.back")}</Button>
        <div className="local-badge"><ShieldCheck size={17} /><span>{t("common.privacyNote")}</span></div>
      </header>
      <main className="main-content">
        <TemplateGallery onUseTemplate={useTemplate} myCvsButton={<Button variant="outline" onClick={() => setDraftsOpen(true)}><FolderOpen size={15} /> {t("cv.gallery.myCvs")}</Button>} />
      </main>
      <MyCvsDialog open={draftsOpen} onOpenChange={setDraftsOpen} drafts={drafts} renamingId={renamingId} renameValue={renameValue}
        onStartRename={startRename} onRenameValueChange={setRenameValue} onConfirmRename={confirmRename}
        onOpen={openDraft} onDuplicate={duplicateDraft} onDelete={removeDraft} />
    </div>;
  }

  return <div className="app-shell cv-editor-shell">
    <header className="site-header no-print">
      <Button variant="ghost" size="sm" onClick={goToGallery}><ArrowLeft size={16} /> {t("cv.nav.content")}</Button>
      <span className="cv-autosave-note">{savedTick > 0 && t("common.saved")}</span>
      <div className="cv-header-actions">
        <div className="cv-mobile-view-toggle">
          <Button variant={mobileView === "edit" ? "default" : "outline"} size="sm" onClick={() => setMobileView("edit")}>{t("cv.nav.edit")}</Button>
          <Button variant={mobileView === "preview" ? "default" : "outline"} size="sm" onClick={() => setMobileView("preview")}>{t("cv.nav.preview")}</Button>
        </div>
        <Button variant="outline" size="sm" onClick={printCv}><Printer size={15} /> {t("cv.export.print")}</Button>
        <Button variant="outline" size="sm" onClick={continueToSign} disabled={signing}>{signing ? <LoaderCircle className="spin" size={15} /> : <PenLine size={15} />} {t("cv.export.continueToSign")}</Button>
        <Button className="primary-button" size="sm" onClick={() => setExportOpen(true)}><Share2 size={15} /> {t("cv.export.button")}</Button>
      </div>
    </header>

    <div className={`cv-editor-body ${mobileView === "preview" ? "is-preview-mobile" : ""}`}>
      <div className="cv-editor-panel no-print">
        <Tabs value={navTab} onValueChange={v => setNavTab(v as typeof navTab)}>
          <TabsList className="cv-nav-tabs">
            <TabsTrigger value="content">{t("cv.nav.content")}</TabsTrigger>
            <TabsTrigger value="organize">{t("cv.nav.organize")}</TabsTrigger>
            <TabsTrigger value="design">{t("cv.nav.design")}</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="cv-template-switch">
              <span>{template && t(template.nameKey)}</span>
              <Button variant="outline" size="sm" onClick={goToGallery}>{t("cv.changeTemplate.button")}</Button>
            </div>
            <div className="cv-field cv-cvlang-field">
              <span className="cv-field-label">{t("cv.cvLanguage.label")}</span>
              <Select value={data.cvLanguage} onValueChange={v => updateData({ cvLanguage: v as CvLanguage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CV_LANGUAGES.map(l => <SelectItem key={l} value={l}>{t(`language.${l}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Accordion type="multiple" defaultValue={["personal"]} className="cv-accordion">
              <AccordionItem value="personal"><AccordionTrigger>{t("cv.sections.personal")}</AccordionTrigger><AccordionContent><PersonalInfoForm personal={data.personal} onChange={patch => updateData(d => ({ ...d, personal: { ...d.personal, ...patch } }))} /></AccordionContent></AccordionItem>
              <AccordionItem value="photo"><AccordionTrigger>{t("cv.sections.photo")}</AccordionTrigger><AccordionContent><PhotoForm photo={data.personal.photo} onChange={photo => updateData(d => ({ ...d, personal: { ...d.personal, photo } }))} /></AccordionContent></AccordionItem>
              <AccordionItem value="profile"><AccordionTrigger>{t("cv.sections.profile")}</AccordionTrigger><AccordionContent><ProfileForm value={data.profileSummary} onChange={v => updateData({ profileSummary: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="experience"><AccordionTrigger>{t("cv.sections.experience")}</AccordionTrigger><AccordionContent><ExperienceForm items={data.experiences} onChange={v => updateData({ experiences: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="education"><AccordionTrigger>{t("cv.sections.education")}</AccordionTrigger><AccordionContent><EducationForm items={data.education} onChange={v => updateData({ education: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="skills"><AccordionTrigger>{t("cv.sections.skills")}</AccordionTrigger><AccordionContent><SkillsForm skills={data.skills} style={data.skillsStyle} onChangeSkills={v => updateData({ skills: v })} onChangeStyle={v => updateData({ skillsStyle: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="languages"><AccordionTrigger>{t("cv.sections.languages")}</AccordionTrigger><AccordionContent><LanguagesForm languages={data.spokenLanguages} onChange={v => updateData({ spokenLanguages: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="certifications"><AccordionTrigger>{t("cv.sections.certifications")}</AccordionTrigger><AccordionContent><CertificationsForm items={data.certifications} onChange={v => updateData({ certifications: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="permits"><AccordionTrigger>{t("cv.sections.permits")}</AccordionTrigger><AccordionContent><PermitsForm items={data.permits} onChange={v => updateData({ permits: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="projects"><AccordionTrigger>{t("cv.sections.projects")}</AccordionTrigger><AccordionContent><ProjectsForm items={data.projects} onChange={v => updateData({ projects: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="interests"><AccordionTrigger>{t("cv.sections.interests")}</AccordionTrigger><AccordionContent><InterestsForm items={data.interests} style={data.interestsStyle} onChangeItems={v => updateData({ interests: v })} onChangeStyle={v => updateData({ interestsStyle: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="references"><AccordionTrigger>{t("cv.sections.references")}</AccordionTrigger><AccordionContent><ReferencesForm items={data.references} availableOnRequest={data.referencesAvailableOnRequest} onChangeItems={v => updateData({ references: v })} onChangeAvailable={v => updateData({ referencesAvailableOnRequest: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="custom"><AccordionTrigger>{t("cv.sections.custom")}</AccordionTrigger><AccordionContent><CustomSectionsForm sections={data.customSections} sectionOrder={data.sectionOrder} onChangeSections={v => updateData({ customSections: v })} onChangeSectionOrder={v => updateData({ sectionOrder: v })} /></AccordionContent></AccordionItem>
              <AccordionItem value="dates"><AccordionTrigger>{t("cv.design.dateFormat")}</AccordionTrigger><AccordionContent>
                <DateFormatField value={data.dateFormat} onChange={v => updateData({ dateFormat: v })} />
              </AccordionContent></AccordionItem>
              <AccordionItem value="qr"><AccordionTrigger>{t("cv.qr.title")}</AccordionTrigger><AccordionContent><QrPanel qr={data.qrCode} onChange={patch => updateData(d => ({ ...d, qrCode: { ...d.qrCode, ...patch } }))} /></AccordionContent></AccordionItem>
              <AccordionItem value="signature"><AccordionTrigger>{t("cv.signature.add")}</AccordionTrigger><AccordionContent>
                <SignaturePanel enabled={data.signature.enabled} sizePercent={data.signature.sizePercent} hasSaved={!!signatureAsset}
                  onToggle={v => updateData(d => ({ ...d, signature: { ...d.signature, enabled: v } }))}
                  onSizeChange={v => updateData(d => ({ ...d, signature: { ...d.signature, sizePercent: v } }))}
                  onRequestSignature={() => setSignatureDialogOpen(true)} />
              </AccordionContent></AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="organize">
            <OrganizeSections sectionOrder={data.sectionOrder} customSections={data.customSections} cvLanguage={data.cvLanguage} onChange={v => updateData({ sectionOrder: v })} />
          </TabsContent>

          <TabsContent value="design">
            <DesignPanel theme={theme} onChange={updateTheme} onResetStyle={resetStyle} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="cv-preview-panel">
        <OverflowWarning pageCount={pageCount}
          onReduceSpacing={() => updateTheme({ spacingPreset: "compact", paragraphSpacing: 3, sectionSpacing: 10, lineHeight: 1.25 })}
          onReduceSize={() => updateTheme({ sizeBody: Math.max(7.5, theme.sizeBody - 1), sizeHeading: Math.max(8, theme.sizeHeading - 1) })}
          onUseCompact={() => changeTemplate("compact")} />
        <div className="cv-preview-stage" ref={stageRef} id="cv-print-area">
          <div className="cv-preview-pages" style={{ transform: `scale(${scale})` }}>
            <CvRenderer data={data} theme={theme} template={template} signature={data.signature.enabled ? signatureAsset : null} />
          </div>
        </div>
      </div>
    </div>

    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultName={slugifyName(data, data.cvLanguage, t)} saveHint={fsSaveHint} formats={EXPORT_FORMATS} onConfirm={handleExport} title={t("cv.export.title")} />
    <SignatureDialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} onSave={handleSignatureSaved} />
    {exporting && <div className="cv-export-overlay"><LoaderCircle className="spin" size={28} /></div>}
  </div>;
}
