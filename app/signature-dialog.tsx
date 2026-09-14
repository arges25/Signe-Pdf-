"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, Eraser, PenLine, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { cropSignature, type SignatureAsset } from "@/lib/pdf-signing";

type Point = { x: number; y: number };
const WIDTH = 1000, HEIGHT = 420;

export default function SignatureDialog({ open, onOpenChange, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSave: (asset: SignatureAsset) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const pointer = useRef<number | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [mode, setMode] = useState("draw");
  const [color, setColor] = useState("#172a46");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function renderInk() {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = 4.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const points of strokes.current) {
      if (!points.length) continue;
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, 2.4, 0, Math.PI * 2); ctx.fill();
      } else {
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    }
  }
  useEffect(() => { if (!open) { strokes.current = []; pointer.current = null; setHasInk(false); setName(""); setError(""); } }, [open]);
  useEffect(() => { renderInk(); }, [color, mode, open]);

  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * WIDTH / rect.width, y: (e.clientY - rect.top) * HEIGHT / rect.height };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== null || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId; strokes.current.push([point(e)]);
    setHasInk(true); setError(""); renderInk();
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== e.pointerId) return;
    e.preventDefault(); strokes.current[strokes.current.length - 1]?.push(point(e)); renderInk();
  }
  function end(e: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current === e.pointerId) pointer.current = null;
  }
  async function save() {
    setSaving(true); setError("");
    try {
      let asset: SignatureAsset | null = null;
      if (mode === "draw" && canvasRef.current) asset = cropSignature(canvasRef.current);
      if (mode === "type" && name.trim()) {
        await document.fonts.load('500 90px "Caveat"');
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        ctx.font = '500 90px "Caveat", cursive';
        const text = name.trim();
        canvas.width = Math.ceil(ctx.measureText(text).width) + 80; canvas.height = 180;
        ctx.font = '500 90px "Caveat", cursive'; ctx.fillStyle = color;
        ctx.fillText(text, 40, 116); asset = cropSignature(canvas);
      }
      if (!asset) { setError("Dessinez votre signature ou saisissez votre nom."); return; }
      onSave(asset); onOpenChange(false);
    } catch { setError("La signature n’a pas pu être créée. Réessayez."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="signature-dialog" showCloseButton={false}>
      <DialogClose asChild><Button className="dialog-close" variant="ghost" size="icon" aria-label="Fermer"><X /></Button></DialogClose>
      <DialogHeader>
        <div className="dialog-symbol"><PenLine size={23} /></div>
        <DialogTitle className="dialog-title">Votre signature, votre touche.</DialogTitle>
        <DialogDescription>Dessinez avec votre doigt ou votre souris, ou saisissez votre nom.</DialogDescription>
      </DialogHeader>
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="signature-tabs" aria-label="Méthode de signature">
          <TabsTrigger value="draw"><PenLine /> Dessiner</TabsTrigger>
          <TabsTrigger value="type"><Type /> Saisir mon nom</TabsTrigger>
        </TabsList>
        <TabsContent value="draw" className="signature-tab-content">
          <div className="drawing-area">
            {!hasInk && <div className="drawing-hint"><PenLine size={26} /><span>Signez ici</span></div>}
            <div className="drawing-baseline" aria-hidden="true" />
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} aria-label="Zone de dessin de votre signature" />
          </div>
          <div className="drawing-bottom"><span>Au doigt, au stylet ou à la souris</span><Button variant="ghost" onClick={() => { strokes.current = []; setHasInk(false); renderInk(); }} disabled={!hasInk}><Eraser /> Effacer</Button></div>
        </TabsContent>
        <TabsContent value="type" className="signature-tab-content">
          <label htmlFor="signature-name" className="field-label">Votre nom</label>
          <Input id="signature-name" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="Prénom Nom" maxLength={60} autoComplete="name" className="name-input" />
          <div className="typed-preview" style={{ color }}>{name.trim() || <span>Votre signature</span>}</div>
        </TabsContent>
      </Tabs>
      <div className="ink-options"><span>Couleur de l’encre</span>
        <RadioGroup aria-label="Couleur de la signature" className="ink-colors" value={color} onValueChange={setColor}>
          {[['#172a46', 'Noir'], ['#2457ea', 'Bleu'], ['#096448', 'Vert']].map(([hex, label]) => <RadioGroupItem key={hex} value={hex} aria-label={label} title={label} className="ink-color" style={{ backgroundColor: hex }} />)}
        </RadioGroup>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <Button className="primary-button signature-save" onClick={save} disabled={saving || (mode === "draw" ? !hasInk : !name.trim())}><Check />{saving ? "Création…" : "Utiliser cette signature"}</Button>
      <p className="dialog-note">Votre signature reste sur cet appareil.</p>
    </DialogContent>
  </Dialog>;
}
