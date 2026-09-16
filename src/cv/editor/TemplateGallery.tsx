import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CV_TEMPLATES } from "../templates/registry";
import type { CvTemplateId, TemplateFilterTag } from "../types/template";
import CvRenderer from "../preview/CvRenderer";
import { A4_WIDTH_PX, A4_HEIGHT_PX } from "../preview/layout-constants";
import { sampleCvData } from "../sample-data";

const FILTERS: TemplateFilterTag[] = ["classic", "modern", "creative", "professional", "student", "with-photo", "without-photo", "one-column", "two-columns", "one-page"];
const FILTER_KEYS: Record<TemplateFilterTag, string> = {
  classic: "classic", modern: "modern", creative: "creative", professional: "professional", student: "student",
  "with-photo": "withPhoto", "without-photo": "withoutPhoto", "one-column": "oneColumn", "two-columns": "twoColumns", "one-page": "onePage",
};

const THUMB_SCALE = 220 / A4_WIDTH_PX;
const sample = sampleCvData();

export default function TemplateGallery({ onUseTemplate, myCvsButton }: { onUseTemplate: (id: CvTemplateId) => void; myCvsButton?: React.ReactNode }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TemplateFilterTag | "all">("all");
  const templates = filter === "all" ? CV_TEMPLATES : CV_TEMPLATES.filter(tpl => tpl.tags.includes(filter));

  return <div className="cv-gallery">
    <div className="cv-gallery-header">
      <div>
        <h2>{t("cv.gallery.title")}</h2>
        <p>{t("cv.gallery.subtitle")}</p>
      </div>
      {myCvsButton}
    </div>
    <div className="cv-gallery-filters">
      <button type="button" className={`cv-filter-chip ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>{t("cv.gallery.filters.all")}</button>
      {FILTERS.map(f => <button key={f} type="button" className={`cv-filter-chip ${filter === f ? "is-active" : ""}`} onClick={() => setFilter(f)}>{t(`cv.gallery.filters.${FILTER_KEYS[f]}`)}</button>)}
    </div>
    <div className="cv-gallery-grid">
      {templates.map(tpl => <div key={tpl.id} className="cv-gallery-card">
        <div className="cv-gallery-thumb" style={{ width: `${A4_WIDTH_PX * THUMB_SCALE}px`, height: `${A4_HEIGHT_PX * THUMB_SCALE}px` }}>
          <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: "top left" }}>
            <CvRenderer data={sample} theme={tpl.defaultTheme} template={tpl} signature={null} />
          </div>
        </div>
        <div className="cv-gallery-card-info">
          <strong>{t(tpl.nameKey)}</strong>
          <Button type="button" size="sm" className="primary-button" onClick={() => onUseTemplate(tpl.id)}>{t("cv.gallery.use")}</Button>
        </div>
      </div>)}
    </div>
  </div>;
}
