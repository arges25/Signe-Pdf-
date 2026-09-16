import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CvCustomSection, CvSectionMeta } from "../types/cv-data";
import { newCustomSection, newCustomItem } from "../types/cv-data";
import ListEditor from "./ListEditor";
import { TextField, AreaField, FieldRow } from "./fields";

export default function CustomSectionsForm({ sections, sectionOrder, onChangeSections, onChangeSectionOrder }: {
  sections: CvCustomSection[]; sectionOrder: CvSectionMeta[];
  onChangeSections: (v: CvCustomSection[]) => void; onChangeSectionOrder: (v: CvSectionMeta[]) => void;
}) {
  const { t } = useTranslation();
  const p = "cv.custom.";

  function addSection() {
    const section = newCustomSection("");
    onChangeSections([...sections, section]);
    onChangeSectionOrder([...sectionOrder, { id: section.id, kind: "custom", titleOverride: null, visible: true }]);
  }
  function removeSection(id: string) {
    onChangeSections(sections.filter(s => s.id !== id));
    onChangeSectionOrder(sectionOrder.filter(s => s.id !== id));
  }
  function updateSection(id: string, patch: Partial<CvCustomSection>) {
    onChangeSections(sections.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  return <div className="cv-form">
    {sections.map(section => <div key={section.id} className="cv-custom-section">
      <div className="cv-list-item-toolbar">
        <TextField label={t(p + "title")} value={section.title} onChange={v => updateSection(section.id, { title: v })} placeholder={t(p + "titlePlaceholder")} />
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSection(section.id)} aria-label={t(p + "deleteSection")}><Trash2 size={15} /></Button>
      </div>
      <ListEditor items={section.items} onChange={items => updateSection(section.id, { items })} newItem={newCustomItem} addLabel={t(p + "addItem")}
        itemLabel={(item, i) => item.title || `#${i + 1}`}
        renderItem={(item, update) => <div className="cv-form">
          <FieldRow>
            <TextField label={t(p + "itemTitle")} value={item.title} onChange={v => update({ title: v })} />
            <TextField label={t(p + "itemSubtitle")} value={item.subtitle} onChange={v => update({ subtitle: v })} optional={t("common.optional")} />
          </FieldRow>
          <TextField label={t(p + "itemDate")} value={item.date} onChange={v => update({ date: v })} optional={t("common.optional")} />
          <AreaField label={t(p + "itemDescription")} value={item.description} onChange={v => update({ description: v })} optional={t("common.optional")} rows={2} />
        </div>}
      />
    </div>)}
    <Button type="button" variant="outline" onClick={addSection}><Plus size={15} /> {t("cv.sections.newSection")}</Button>
  </div>;
}
