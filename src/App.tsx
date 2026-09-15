import { useState } from "react";
import Home from "./home";
import SignTool from "./sign-tool";
import EditTool from "./edit-tool";
import ScanTool from "./scan-tool";

type Mode = "home" | "sign" | "edit" | "scan";

// SignTool, EditTool and ScanTool are lazily mounted on first visit, then
// kept mounted forever (only their visibility toggles). That preserves an
// in-progress signature, correction or scan across simple screen changes,
// without building real persistence: the component instance, and its
// React state, simply never goes away for the rest of the visit.
export default function App() {
  const [mode, setMode] = useState<Mode>("home");
  const [visitedSign, setVisitedSign] = useState(false);
  const [visitedEdit, setVisitedEdit] = useState(false);
  const [visitedScan, setVisitedScan] = useState(false);
  const [signHandoff, setSignHandoff] = useState<{ file: File; token: number } | null>(null);
  const [editHandoff, setEditHandoff] = useState<{ file: File; token: number } | null>(null);

  function goHome() { setMode("home"); }
  function goSign() { setVisitedSign(true); setMode("sign"); }
  function goEdit() { setVisitedEdit(true); setMode("edit"); }
  function goScan() { setVisitedScan(true); setMode("scan"); }
  function signThis(file: File) { setSignHandoff({ file, token: Date.now() }); setVisitedSign(true); setMode("sign"); }
  function editThis(file: File) { setEditHandoff({ file, token: Date.now() }); setVisitedEdit(true); setMode("edit"); }

  return <>
    <div style={{ display: mode === "home" ? "block" : "none" }}><Home onSign={goSign} onEdit={goEdit} onScan={goScan} /></div>
    {visitedSign && <div style={{ display: mode === "sign" ? "block" : "none" }}><SignTool onBack={goHome} handoff={signHandoff} /></div>}
    {visitedEdit && <div style={{ display: mode === "edit" ? "block" : "none" }}><EditTool onBack={goHome} onSignThis={signThis} handoff={editHandoff} /></div>}
    {visitedScan && <div style={{ display: mode === "scan" ? "block" : "none" }}><ScanTool onBack={goHome} onEditThis={editThis} onSignThis={signThis} /></div>}
  </>;
}
