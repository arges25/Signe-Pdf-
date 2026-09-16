import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type ExportFormat = { id: string; label: string; extension: string; description?: string };

export default function ExportDialog({ open, onOpenChange, defaultName, saveHint, formats, onConfirm, title = "Enregistrer le document signé" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  saveHint: string;
  formats: ExportFormat[];
  onConfirm: (name: string, formatId: string) => Promise<void>;
  title?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [formatId, setFormatId] = useState(formats[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(defaultName); setFormatId(formats[0]?.id ?? ""); setSaving(false); } }, [open, defaultName, formats]);

  const activeFormat = formats.find(f => f.id === formatId) ?? formats[0];

  async function handleSave() {
    if (!activeFormat) return;
    setSaving(true);
    try { await onConfirm(name.trim() || defaultName, activeFormat.id); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
    <DialogContent className="export-dialog" showCloseButton={!saving}>
      <DialogTitle className="dialog-title">{title}</DialogTitle>
      <DialogDescription>Vérifiez le nom du fichier avant l’enregistrement.</DialogDescription>
      <label htmlFor="export-filename" className="field-label">Nom du fichier</label>
      <div className="filename-field">
        <Input id="export-filename" value={name} onChange={e => setName(e.target.value)} maxLength={150} disabled={saving} autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); }} />
        <span className="filename-suffix">.{activeFormat?.extension}</span>
      </div>
      {formats.length > 1
        ? <div className="format-choice">
            <span className="field-label">Format</span>
            <RadioGroup value={formatId} onValueChange={setFormatId} className="format-options" aria-label="Format d’enregistrement">
              {formats.map(f => <label key={f.id} className="format-option">
                <RadioGroupItem value={f.id} />
                <span><strong>{f.label}</strong>{f.description && <span className="format-option-desc">{f.description}</span>}</span>
              </label>)}
            </RadioGroup>
          </div>
        : <div className="format-field">
            <span className="field-label">Format</span>
            <span className="format-value">{activeFormat?.label}{activeFormat?.description && <span> · {activeFormat.description}</span>}</span>
          </div>}
      {saveHint && <p className="export-hint">{saveHint}</p>}
      <div className="export-actions">
        <DialogClose asChild><Button variant="outline" disabled={saving}>Annuler</Button></DialogClose>
        <Button className="primary-button" onClick={handleSave} disabled={saving || !name.trim() || !activeFormat}>{saving ? <LoaderCircle className="spin" /> : <Save />}{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
