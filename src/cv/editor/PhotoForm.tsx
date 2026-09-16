import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { CvPhoto, CvPhotoShape } from "../types/cv-data";
import PhotoCropDialog from "./PhotoCropDialog";
import { Field } from "./fields";

const SHAPES: CvPhotoShape[] = ["round", "square", "rounded", "portrait"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoForm({ photo, onChange }: { photo: CvPhoto | null; onChange: (photo: CvPhoto | null) => void }) {
  const { t } = useTranslation();
  const importRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [pendingOriginal, setPendingOriginal] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingOriginal(dataUrl);
    setCropOpen(true);
  }

  function handleConfirmCrop(dataUrl: string, crop: CvPhoto["crop"]) {
    const original = pendingOriginal ?? photo?.originalDataUrl ?? dataUrl;
    onChange({
      dataUrl, originalDataUrl: original, crop,
      shape: photo?.shape ?? "round", sizePercent: photo?.sizePercent ?? 80,
      borderWidth: photo?.borderWidth ?? 0, borderColor: photo?.borderColor ?? "#ffffff",
    });
    setCropOpen(false);
    setPendingOriginal(null);
  }

  return <div className="cv-form">
    <input ref={importRef} type="file" accept="image/*" hidden onChange={handleFile} />
    <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />

    {photo && <div className="cv-photo-preview">
      <img src={photo.dataUrl} alt="" style={{
        width: 96, height: photo.shape === "portrait" ? 128 : 96,
        borderRadius: photo.shape === "round" ? "999px" : photo.shape === "square" ? 0 : "10px",
        objectFit: "cover", border: photo.borderWidth ? `${photo.borderWidth}px solid ${photo.borderColor}` : "none",
      }} />
    </div>}

    <div className="cv-photo-buttons">
      <Button type="button" variant="outline" onClick={() => captureRef.current?.click()}><Camera size={15} /> {t("cv.photo.take")}</Button>
      <Button type="button" variant="outline" onClick={() => importRef.current?.click()}><ImageIcon size={15} /> {t("cv.photo.import")}</Button>
      {photo && <Button type="button" variant="ghost" onClick={() => onChange(null)}><Trash2 size={15} /> {t("cv.photo.remove")}</Button>}
    </div>

    {photo && <>
      <Field label={t("cv.photo.shape")}>
        <div className="cv-shape-row">
          {SHAPES.map(shape => <button key={shape} type="button" className={`cv-shape-btn ${photo.shape === shape ? "is-active" : ""}`} onClick={() => onChange({ ...photo, shape })}>{t(`cv.photo.shape${shape[0].toUpperCase()}${shape.slice(1)}`)}</button>)}
        </div>
      </Field>
      <Field label={t("cv.photo.size")}>
        <Slider min={40} max={100} step={5} value={[photo.sizePercent]} onValueChange={([v]) => onChange({ ...photo, sizePercent: v })} />
      </Field>
      <Field label={t("cv.photo.border")}>
        <Slider min={0} max={6} step={1} value={[photo.borderWidth]} onValueChange={([v]) => onChange({ ...photo, borderWidth: v })} />
      </Field>
      {photo.borderWidth > 0 && <Field label={t("cv.photo.borderColor")}>
        <input type="color" value={photo.borderColor} onChange={e => onChange({ ...photo, borderColor: e.target.value })} className="cv-color-input" />
      </Field>}
      <Button type="button" variant="outline" size="sm" onClick={() => { setPendingOriginal(photo.originalDataUrl); setCropOpen(true); }}>{t("cv.photo.crop")}</Button>
    </>}

    {pendingOriginal && <PhotoCropDialog open={cropOpen} onOpenChange={setCropOpen} originalDataUrl={pendingOriginal} initialCrop={photo?.crop ?? null} onConfirm={handleConfirmCrop} />}
  </div>;
}
