import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TextAlign } from "@/lib/edit-types";

export type TextElementValue = { text: string; fontSize: number; color: string; bold: boolean; italic: boolean; align: TextAlign };

const TEXT_COLORS: [string, string][] = [["#172a46", "Noir"], ["#2457ea", "Bleu"], ["#c0392b", "Rouge"], ["#188160", "Vert"]];

function TextElementForm({ mode, initial, onConfirm, onDelete }: {
  mode: "create" | "edit";
  initial: TextElementValue;
  onConfirm: (value: TextElementValue) => void;
  onDelete?: () => void;
}) {
  // Mounted fresh each time the dialog opens (see the `open &&` below), so
  // this initializes straight from `initial` with no prop-syncing effect.
  const [value, setValue] = useState(initial);

  function confirm() {
    if (!value.text.trim()) return;
    onConfirm(value);
  }

  return <>
    <DialogTitle className="dialog-title">{mode === "create" ? "Ajouter du texte" : "Modifier le texte"}</DialogTitle>
    <DialogDescription>Saisissez le texte, puis ajustez sa présentation si besoin.</DialogDescription>

    <label htmlFor="edit-text-content" className="field-label">Texte</label>
    <Textarea id="edit-text-content" value={value.text} onChange={e => setValue(v => ({ ...v, text: e.target.value }))} rows={3} autoFocus placeholder="Nom, date, correction…" className="text-element-input" />

    <div className="text-style-row">
      <div className="text-style-group">
        <span className="field-label">Taille</span>
        <Slider min={1.5} max={8} step={0.25} value={[value.fontSize * 100]} onValueChange={([v]) => setValue(s => ({ ...s, fontSize: v / 100 }))} aria-label="Taille du texte" />
      </div>
      <div className="text-style-group text-style-toggles">
        <Button type="button" variant={value.bold ? "default" : "outline"} size="icon" aria-pressed={value.bold} aria-label="Gras" onClick={() => setValue(v => ({ ...v, bold: !v.bold }))}><Bold /></Button>
        <Button type="button" variant={value.italic ? "default" : "outline"} size="icon" aria-pressed={value.italic} aria-label="Italique" onClick={() => setValue(v => ({ ...v, italic: !v.italic }))}><Italic /></Button>
        <Button type="button" variant={value.align === "left" ? "default" : "outline"} size="icon" aria-pressed={value.align === "left"} aria-label="Aligner à gauche" onClick={() => setValue(v => ({ ...v, align: "left" }))}><AlignLeft /></Button>
        <Button type="button" variant={value.align === "center" ? "default" : "outline"} size="icon" aria-pressed={value.align === "center"} aria-label="Centrer" onClick={() => setValue(v => ({ ...v, align: "center" }))}><AlignCenter /></Button>
        <Button type="button" variant={value.align === "right" ? "default" : "outline"} size="icon" aria-pressed={value.align === "right"} aria-label="Aligner à droite" onClick={() => setValue(v => ({ ...v, align: "right" }))}><AlignRight /></Button>
      </div>
    </div>

    <div className="ink-options"><span>Couleur du texte</span>
      <RadioGroup aria-label="Couleur du texte" className="ink-colors" value={value.color} onValueChange={color => setValue(v => ({ ...v, color }))}>
        {TEXT_COLORS.map(([hex, label]) => <RadioGroupItem key={hex} value={hex} aria-label={label} title={label} className="ink-color" style={{ backgroundColor: hex }} />)}
      </RadioGroup>
    </div>

    <div className="replace-actions">
      {mode === "edit" && onDelete && <Button variant="ghost" className="delete-signature" onClick={onDelete}><Trash2 /> Supprimer</Button>}
      <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
      <Button className="primary-button" onClick={confirm} disabled={!value.text.trim()}><Check />{mode === "create" ? "Ajouter" : "Enregistrer"}</Button>
    </div>
  </>;
}

export default function TextElementDialog({ open, onOpenChange, mode, initial, onConfirm, onDelete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial: TextElementValue;
  onConfirm: (value: TextElementValue) => void;
  onDelete?: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="signature-dialog text-element-dialog" showCloseButton>
      {open && <TextElementForm mode={mode} initial={initial} onConfirm={onConfirm} onDelete={onDelete} />}
    </DialogContent>
  </Dialog>;
}
