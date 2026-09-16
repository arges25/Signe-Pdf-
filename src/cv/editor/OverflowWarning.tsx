import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OverflowWarning({ pageCount, onReduceSpacing, onReduceSize, onUseCompact }: {
  pageCount: number; onReduceSpacing: () => void; onReduceSize: () => void; onUseCompact: () => void;
}) {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;
  const o = "cv.overflow.";
  return <div className="cv-overflow-warning">
    <AlertTriangle size={16} />
    <span>{t(o + "message")} ({pageCount})</span>
    <div className="cv-overflow-actions">
      <Button type="button" variant="outline" size="sm" onClick={onReduceSpacing}>{t(o + "reduceSpacing")}</Button>
      <Button type="button" variant="outline" size="sm" onClick={onReduceSize}>{t(o + "reduceSize")}</Button>
      <Button type="button" variant="outline" size="sm" onClick={onUseCompact}>{t(o + "useCompact")}</Button>
    </div>
  </div>;
}
