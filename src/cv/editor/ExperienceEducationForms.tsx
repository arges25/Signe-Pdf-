import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import type { CvExperience, CvEducation } from "../types/cv-data";
import { newExperience, newEducation } from "../types/cv-data";
import ListEditor from "./ListEditor";
import { TextField, AreaField, MonthField, FieldRow, Field } from "./fields";

export function ExperienceForm({ items, onChange }: { items: CvExperience[]; onChange: (items: CvExperience[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.experience.";
  return <ListEditor
    items={items} onChange={onChange} newItem={newExperience} addLabel={t(p + "add")}
    itemLabel={(item, i) => item.jobTitle || item.company || `#${i + 1}`}
    renderItem={(item, update) => <div className="cv-form">
      <FieldRow>
        <TextField label={t(p + "jobTitle")} value={item.jobTitle} onChange={v => update({ jobTitle: v })} />
        <TextField label={t(p + "company")} value={item.company} onChange={v => update({ company: v })} />
      </FieldRow>
      <FieldRow>
        <TextField label={t(p + "city")} value={item.city} onChange={v => update({ city: v })} optional={t("common.optional")} />
        <TextField label={t(p + "country")} value={item.country} onChange={v => update({ country: v })} optional={t("common.optional")} />
      </FieldRow>
      <FieldRow>
        <MonthField label={t(p + "startDate")} value={item.startDate} onChange={v => update({ startDate: v })} optional={t("common.optional")} />
        {!item.current && <MonthField label={t(p + "endDate")} value={item.endDate} onChange={v => update({ endDate: v })} optional={t("common.optional")} />}
      </FieldRow>
      <Field label={t(p + "current")}><Switch checked={item.current} onCheckedChange={v => update({ current: v, endDate: v ? "" : item.endDate })} /></Field>
      <AreaField label={t(p + "description")} value={item.description} onChange={v => update({ description: v })} optional={t(p + "descriptionHint")} rows={4} />
    </div>}
  />;
}

export function EducationForm({ items, onChange }: { items: CvEducation[]; onChange: (items: CvEducation[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.education.";
  return <ListEditor
    items={items} onChange={onChange} newItem={newEducation} addLabel={t(p + "add")}
    itemLabel={(item, i) => item.degree || item.institution || `#${i + 1}`}
    renderItem={(item, update) => <div className="cv-form">
      <FieldRow>
        <TextField label={t(p + "degree")} value={item.degree} onChange={v => update({ degree: v })} />
        <TextField label={t(p + "institution")} value={item.institution} onChange={v => update({ institution: v })} />
      </FieldRow>
      <FieldRow>
        <TextField label={t(p + "city")} value={item.city} onChange={v => update({ city: v })} optional={t("common.optional")} />
        <TextField label={t(p + "country")} value={item.country} onChange={v => update({ country: v })} optional={t("common.optional")} />
      </FieldRow>
      <FieldRow>
        <MonthField label={t(p + "startDate")} value={item.startDate} onChange={v => update({ startDate: v })} optional={t("common.optional")} />
        <MonthField label={t(p + "endDate")} value={item.endDate} onChange={v => update({ endDate: v })} optional={t("common.optional")} />
      </FieldRow>
      <TextField label={t(p + "honors")} value={item.honors} onChange={v => update({ honors: v })} optional={t("common.optional")} />
      <AreaField label={t(p + "description")} value={item.description} onChange={v => update({ description: v })} optional={t("common.optional")} rows={3} />
    </div>}
  />;
}
