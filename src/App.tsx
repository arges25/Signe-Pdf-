import { useState } from "react";
import Home from "./home";
import ToolsPage from "./tools-page";
import DocsPage from "./docs-page";
import SettingsPage from "./settings-page";
import BottomNav, { type NavTab } from "./bottom-nav";
import SignTool from "./sign-tool";
import EditTool from "./edit-tool";
import ScanTool from "./scan-tool";
import DocumentTool from "./document-tool";
import CvTool from "./cv/CvTool";

type Mode = NavTab | "sign" | "edit" | "scan" | "create" | "cv";
const SHELL_TABS: readonly NavTab[] = ["home", "tools", "docs", "settings"];

// SignTool, EditTool, ScanTool, DocumentTool and CvTool are lazily mounted
// on first visit, then kept mounted forever (only their visibility toggles).
// That preserves an in-progress signature, correction, scan, document or CV
// across simple screen changes, without building real persistence: the
// component instance, and its React state, simply never goes away for
// the rest of the visit.
export default function App() {
  const [mode, setMode] = useState<Mode>("home");
  const [visitedSign, setVisitedSign] = useState(false);
  const [visitedEdit, setVisitedEdit] = useState(false);
  const [visitedScan, setVisitedScan] = useState(false);
  const [visitedCreate, setVisitedCreate] = useState(false);
  const [visitedCv, setVisitedCv] = useState(false);
  const [signHandoff, setSignHandoff] = useState<{ file: File; token: number } | null>(null);
  const [editHandoff, setEditHandoff] = useState<{ file: File; token: number } | null>(null);
  const [cvDraftId, setCvDraftId] = useState<string | undefined>(undefined);
  const [docDraftId, setDocDraftId] = useState<string | undefined>(undefined);

  function goHome() { setMode("home"); }
  function goTools() { setMode("tools"); }
  function goDocs() { setMode("docs"); }
  function goSettings() { setMode("settings"); }
  function goSign() { setVisitedSign(true); setMode("sign"); }
  function goEdit() { setVisitedEdit(true); setMode("edit"); }
  function goScan() { setVisitedScan(true); setMode("scan"); }
  function goCreate() { setVisitedCreate(true); setMode("create"); }
  function goCv() { setVisitedCv(true); setMode("cv"); }
  function signThis(file: File) { setSignHandoff({ file, token: Date.now() }); setVisitedSign(true); setMode("sign"); }
  function editThis(file: File) { setEditHandoff({ file, token: Date.now() }); setVisitedEdit(true); setMode("edit"); }
  function openCvDraft(id: string) { setCvDraftId(id); setVisitedCv(true); setMode("cv"); }
  function openDocDraft(id: string) { setDocDraftId(id); setVisitedCreate(true); setMode("create"); }

  const shellTab = (SHELL_TABS as readonly Mode[]).includes(mode) ? (mode as NavTab) : null;

  return <>
    <div style={{ display: mode === "home" ? "block" : "none" }}>
      <Home onSign={goSign} onEdit={goEdit} onScan={goScan} onCreate={goCreate} onCv={goCv} onOpenCvDraft={openCvDraft} onOpenDocDraft={openDocDraft} onSettings={goSettings} onSeeAllDocs={goDocs} />
    </div>
    <div style={{ display: mode === "tools" ? "block" : "none" }}>
      <ToolsPage onSign={goSign} onEdit={goEdit} onScan={goScan} onCreate={goCreate} onCv={goCv} />
    </div>
    <div style={{ display: mode === "docs" ? "block" : "none" }}>
      <DocsPage onOpenCvDraft={openCvDraft} onOpenDocDraft={openDocDraft} />
    </div>
    <div style={{ display: mode === "settings" ? "block" : "none" }}>
      <SettingsPage />
    </div>
    {visitedSign && <div style={{ display: mode === "sign" ? "block" : "none" }}><SignTool onBack={goHome} handoff={signHandoff} /></div>}
    {visitedEdit && <div style={{ display: mode === "edit" ? "block" : "none" }}><EditTool onBack={goHome} onSignThis={signThis} handoff={editHandoff} /></div>}
    {visitedScan && <div style={{ display: mode === "scan" ? "block" : "none" }}><ScanTool onBack={goHome} onEditThis={editThis} onSignThis={signThis} /></div>}
    {visitedCreate && <div style={{ display: mode === "create" ? "block" : "none" }}><DocumentTool onBack={goHome} onSignThis={signThis} initialDraftId={docDraftId} /></div>}
    {visitedCv && <div style={{ display: mode === "cv" ? "block" : "none" }}><CvTool onBack={goHome} onSignThis={signThis} initialDraftId={cvDraftId} /></div>}
    {shellTab && <BottomNav active={shellTab} onHome={goHome} onTools={goTools} onDocs={goDocs} onSettings={goSettings} />}
  </>;
}
