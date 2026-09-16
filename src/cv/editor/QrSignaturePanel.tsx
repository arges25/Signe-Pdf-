import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PenLine } from "lucide-react";
import type { CvQrCode } from "../types/cv-data";
import { TextField, Field } from "./fields";

export function QrPanel({ qr, onChange }: { qr: CvQrCode; onChange: (patch: Partial<CvQrCode>) => void }) {
  const { t } = useTranslation();
  const q = "cv.qr.";
  return <div className="cv-form">
    <Field label={t(q + "enable")}><Switch checked={qr.enabled} onCheckedChange={v => onChange({ enabled: v })} /></Field>
    {qr.enabled && <>
      <TextField label={t(q + "url")} value={qr.url} onChange={v => onChange({ url: v })} />
      <Field label={t(q + "size")}><Slider min={8} max={24} step={1} value={[qr.sizePercent]} onValueChange={([v]) => onChange({ sizePercent: v })} /></Field>
      <Field label={t(q + "position")}>
        <Select value={qr.position} onValueChange={v => onChange({ position: v as CvQrCode["position"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">{t(q + "bottomRight")}</SelectItem>
            <SelectItem value="bottom-left">{t(q + "bottomLeft")}</SelectItem>
            <SelectItem value="top-right">{t(q + "topRight")}</SelectItem>
            <SelectItem value="sidebar">{t(q + "sidebar")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </>}
  </div>;
}

export function SignaturePanel({ enabled, sizePercent, hasSaved, onToggle, onSizeChange, onRequestSignature }: {
  enabled: boolean; sizePercent: number; hasSaved: boolean;
  onToggle: (v: boolean) => void; onSizeChange: (v: number) => void; onRequestSignature: () => void;
}) {
  const { t } = useTranslation();
  const s = "cv.signature.";
  if (!hasSaved) return <div className="cv-form">
    <Button type="button" variant="outline" onClick={onRequestSignature}><PenLine size={15} /> {t(s + "add")}</Button>
  </div>;
  return <div className="cv-form">
    <Field label={t(s + "enable")}><Switch checked={enabled} onCheckedChange={onToggle} /></Field>
    {enabled && <Field label={t(s + "size")}><Slider min={30} max={100} step={5} value={[sizePercent]} onValueChange={([v]) => onSizeChange(v)} /></Field>}
  </div>;
}
