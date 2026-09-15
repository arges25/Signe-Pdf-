import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ExportDialog({ open, onOpenChange, defaultName, saveHint, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  saveHint: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(defaultName); setSaving(false); } }, [open, defaultName]);

  async function handleSave() {
    setSaving(true);
    try { await onConfirm(name.trim() || defaultName); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
    <DialogContent className="export-dialog" showCloseButton={!saving}>
      <DialogTitle className="dialog-title">Enregistrer le PDF signé</DialogTitle>
      <DialogDescription>Vérifiez le nom du fichier avant l’enregistrement.</DialogDescription>
      <label htmlFor="export-filename" className="field-label">Nom du fichier</label>
      <div className="filename-field">
        <Input id="export-filename" value={name} onChange={e => setName(e.target.value)} maxLength={150} disabled={saving} autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); }} />
        <span className="filename-suffix">.pdf</span>
      </div>
      <div className="format-field">
        <span className="field-label">Format</span>
        <span className="format-value">PDF <span>· seul format qui ne dégrade pas le document</span></span>
      </div>
      {saveHint && <p className="export-hint">{saveHint}</p>}
      <div className="export-actions">
        <DialogClose asChild><Button variant="outline" disabled={saving}>Annuler</Button></DialogClose>
        <Button className="primary-button" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" /> : <Save />}{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
