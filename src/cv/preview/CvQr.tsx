import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Generated entirely client-side (the `qrcode` package draws to a canvas
// locally) — the URL a CV links to never leaves the device to reach a
// third-party QR-generation API.
export default function CvQr({ url, sizePt }: { url: string; sizePt: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url.trim()) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 0, width: 256, color: { dark: "#18263c", light: "#ffffff00" } })
      .then(d => { if (!cancelled) setDataUrl(d); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [url]);
  if (!url.trim() || !dataUrl) return null;
  return <img src={dataUrl} alt="QR" style={{ width: `${sizePt}pt`, height: `${sizePt}pt`, display: "block" }} />;
}
