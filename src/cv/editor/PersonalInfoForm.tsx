import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CvPersonalInfo } from "../types/cv-data";
import { newLink } from "../types/cv-data";
import { TextField, FieldRow, Field } from "./fields";
import { Input } from "@/components/ui/input";

export default function PersonalInfoForm({ personal, onChange }: { personal: CvPersonalInfo; onChange: (patch: Partial<CvPersonalInfo>) => void }) {
  const { t } = useTranslation();
  const p = "cv.personal.";

  return <div className="cv-form">
    <FieldRow>
      <TextField label={t(p + "firstName")} value={personal.firstName} onChange={v => onChange({ firstName: v })} />
      <TextField label={t(p + "lastName")} value={personal.lastName} onChange={v => onChange({ lastName: v })} />
    </FieldRow>
    <FieldRow>
      <TextField label={t(p + "jobTitle")} value={personal.jobTitle} onChange={v => onChange({ jobTitle: v })} />
      <TextField label={t(p + "targetRole")} value={personal.targetRole} onChange={v => onChange({ targetRole: v })} optional={t("common.optional")} />
    </FieldRow>
    <TextField label={t(p + "address")} value={personal.address} onChange={v => onChange({ address: v })} optional={t("common.optional")} />
    <FieldRow>
      <TextField label={t(p + "postalCode")} value={personal.postalCode} onChange={v => onChange({ postalCode: v })} optional={t("common.optional")} />
      <TextField label={t(p + "city")} value={personal.city} onChange={v => onChange({ city: v })} optional={t("common.optional")} />
      <TextField label={t(p + "country")} value={personal.country} onChange={v => onChange({ country: v })} optional={t("common.optional")} />
    </FieldRow>
    <FieldRow>
      <TextField label={t(p + "phone")} value={personal.phone} onChange={v => onChange({ phone: v })} type="tel" optional={t("common.optional")} />
      <TextField label={t(p + "email")} value={personal.email} onChange={v => onChange({ email: v })} type="email" optional={t("common.optional")} />
    </FieldRow>
    <FieldRow>
      <TextField label={t(p + "birthDate")} value={personal.birthDate} onChange={v => onChange({ birthDate: v })} type="date" optional={t("common.optional")} />
      <TextField label={t(p + "nationality")} value={personal.nationality} onChange={v => onChange({ nationality: v })} optional={t("common.optional")} />
    </FieldRow>
    <FieldRow>
      <TextField label={t(p + "website")} value={personal.website} onChange={v => onChange({ website: v })} optional={t("common.optional")} />
      <TextField label={t(p + "linkedin")} value={personal.linkedin} onChange={v => onChange({ linkedin: v })} optional={t("common.optional")} />
    </FieldRow>
    <FieldRow>
      <TextField label={t(p + "github")} value={personal.github} onChange={v => onChange({ github: v })} optional={t("common.optional")} />
      <TextField label={t(p + "portfolio")} value={personal.portfolio} onChange={v => onChange({ portfolio: v })} optional={t("common.optional")} />
    </FieldRow>

    <Field label={t(p + "customLinks")}>
      <div className="cv-links-list">
        {personal.customLinks.map(link => <div key={link.id} className="cv-link-row">
          <Input value={link.label} onChange={e => onChange({ customLinks: personal.customLinks.map(l => l.id === link.id ? { ...l, label: e.target.value } : l) })} placeholder={t(p + "linkLabel")} />
          <Input value={link.url} onChange={e => onChange({ customLinks: personal.customLinks.map(l => l.id === link.id ? { ...l, url: e.target.value } : l) })} placeholder={t(p + "linkUrl")} />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange({ customLinks: personal.customLinks.filter(l => l.id !== link.id) })}><Trash2 size={15} /></Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ customLinks: [...personal.customLinks, newLink()] })}><Plus size={14} /> {t(p + "addLink")}</Button>
      </div>
    </Field>
  </div>;
}
