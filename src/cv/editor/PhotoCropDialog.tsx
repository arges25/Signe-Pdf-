import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const VIEWPORT = 280; // CSS px, square
const OUTPUT = 640; // px, square master crop

type Crop = { zoom: number; offsetX: number; offsetY: number; rotation: number };

// A minimal but real crop tool: drag to pan, slider to zoom, a button to
// rotate in 90° steps. The output is always a square master image —
// CvPhotoView then applies the chosen display shape (round/square/
// rounded/portrait) purely via CSS, so re-picking a shape later never
// needs to re-crop.
export default function PhotoCropDialog({ open, onOpenChange, originalDataUrl, initialCrop, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; originalDataUrl: string; initialCrop: Crop | null;
  onConfirm: (dataUrl: string, crop: Crop) => void;
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Crop>(initialCrop ?? { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: crop.offsetX, origY: crop.offsetY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / VIEWPORT;
    const dy = (e.clientY - dragRef.current.startY) / VIEWPORT;
    setCrop(c => ({ ...c, offsetX: dragRef.current!.origX + dx, offsetY: dragRef.current!.origY + dy }));
  }
  function onPointerUp() { dragRef.current = null; }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(OUTPUT / 2, OUTPUT / 2);
    ctx.rotate((crop.rotation * Math.PI) / 180);
    const baseScale = Math.max(OUTPUT / img.naturalWidth, OUTPUT / img.naturalHeight) * crop.zoom;
    ctx.scale(baseScale, baseScale);
    ctx.drawImage(img, -img.naturalWidth / 2 + (crop.offsetX * OUTPUT) / baseScale, -img.naturalHeight / 2 + (crop.offsetY * OUTPUT) / baseScale);
    ctx.restore();
    onConfirm(canvas.toDataURL("image/png"), crop);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="cv-crop-dialog">
      <DialogHeader><DialogTitle>{t("cv.photo.crop")}</DialogTitle></DialogHeader>
      <div className="cv-crop-viewport" style={{ width: VIEWPORT, height: VIEWPORT }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <img ref={imgRef} src={originalDataUrl} alt="" draggable={false}
          style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) translate(${crop.offsetX * VIEWPORT}px, ${crop.offsetY * VIEWPORT}px) scale(${crop.zoom}) rotate(${crop.rotation}deg)`, maxWidth: "none", touchAction: "none" }} />
        <div className="cv-crop-mask" />
      </div>
      <div className="cv-crop-controls">
        <span className="cv-field-label">{t("cv.photo.zoom")}</span>
        <Slider min={1} max={3} step={0.05} value={[crop.zoom]} onValueChange={([v]) => setCrop(c => ({ ...c, zoom: v }))} />
        <Button type="button" variant="outline" size="sm" onClick={() => setCrop(c => ({ ...c, rotation: (c.rotation + 90) % 360 }))}><RotateCw size={14} /> {t("cv.photo.rotate")}</Button>
      </div>
      <div className="cv-crop-actions">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cv.photo.cancel")}</Button>
        <Button type="button" className="primary-button" onClick={confirm}>{t("cv.photo.apply")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
