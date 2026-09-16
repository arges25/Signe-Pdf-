import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CvCustomSection, CvSectionMeta } from "../types/cv-data";
import { cvStrings } from "../cv-i18n";
import type { CvData } from "../types/cv-data";

export default function OrganizeSections({ sectionOrder, customSections, cvLanguage, onChange }: {
  sectionOrder: CvSectionMeta[]; customSections: CvCustomSection[]; cvLanguage: CvData["cvLanguage"]; onChange: (v: CvSectionMeta[]) => void;
}) {
  const { t } = useTranslation();
  const strings = cvStrings(cvLanguage);
  const customTitleById = new Map(customSections.map(s => [s.id, s.title]));

  function label(meta: CvSectionMeta): string {
    if (meta.kind === "custom") return meta.titleOverride ?? customTitleById.get(meta.id) ?? "";
    return meta.titleOverride ?? strings.sections[meta.kind];
  }
  function move(id: string, dir: -1 | 1) {
    const idx = sectionOrder.findIndex(s => s.id === id);
    const j = idx + dir;
    if (j < 0 || j >= sectionOrder.length) return;
    const copy = [...sectionOrder];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  }
  function toggleVisible(id: string) { onChange(sectionOrder.map(s => s.id === id ? { ...s, visible: !s.visible } : s)); }
  function rename(id: string, value: string) { onChange(sectionOrder.map(s => s.id === id ? { ...s, titleOverride: value || null } : s)); }

  return <div className="cv-organize">
    <p className="cv-organize-subtitle">{t("cv.organize.subtitle")}</p>
    {sectionOrder.map((meta, idx) => <div key={meta.id} className={`cv-organize-row ${meta.visible ? "" : "is-hidden"}`}>
      <div className="cv-organize-move">
        <Button type="button" variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => move(meta.id, -1)}><ChevronUp size={15} /></Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={idx === sectionOrder.length - 1} onClick={() => move(meta.id, 1)}><ChevronDown size={15} /></Button>
      </div>
      <Input value={label(meta)} onChange={e => rename(meta.id, e.target.value)} placeholder={t("cv.organize.renamePlaceholder")} className="cv-organize-input" />
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleVisible(meta.id)} aria-label={meta.visible ? t("cv.organize.hide") : t("cv.organize.show")}>
        {meta.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </Button>
    </div>)}
  </div>;
}
