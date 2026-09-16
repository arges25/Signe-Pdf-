import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CvCertification, CvPermit, CvProject, CvInterest, CvReference, InterestsStyle } from "../types/cv-data";
import { newCertification, newPermit, newProject, newInterest, newReference } from "../types/cv-data";
import ListEditor from "./ListEditor";
import { TextField, AreaField, FieldRow, Field } from "./fields";

const PERMIT_CATEGORIES = ["A", "A1", "A2", "B", "BE", "C", "CE", "D", "DE"];
const INTEREST_STYLES: InterestsStyle[] = ["text", "list", "tags", "icons"];

export function CertificationsForm({ items, onChange }: { items: CvCertification[]; onChange: (v: CvCertification[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.certifications.";
  return <ListEditor items={items} onChange={onChange} newItem={newCertification} addLabel={t(p + "add")}
    itemLabel={(item, i) => item.name || `#${i + 1}`}
    renderItem={(item, update) => <div className="cv-form">
      <FieldRow>
        <TextField label={t(p + "name")} value={item.name} onChange={v => update({ name: v })} />
        <TextField label={t(p + "issuer")} value={item.issuer} onChange={v => update({ issuer: v })} optional={t("common.optional")} />
      </FieldRow>
      <FieldRow>
        <TextField label={t(p + "date")} value={item.date} onChange={v => update({ date: v })} optional={t("common.optional")} />
        <TextField label={t(p + "expiry")} value={item.expiry} onChange={v => update({ expiry: v })} optional={t("common.optional")} />
      </FieldRow>
      <TextField label={t(p + "url")} value={item.url} onChange={v => update({ url: v })} optional={t("common.optional")} />
    </div>} />;
}

export function PermitsForm({ items, onChange }: { items: CvPermit[]; onChange: (v: CvPermit[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.permits.";
  function update(id: string, category: string) { onChange(items.map(i => i.id === id ? { ...i, category } : i)); }
  return <div className="cv-form">
    <div className="cv-inline-list">
      {items.map(item => <div key={item.id} className="cv-inline-row">
        <Select value={item.category} onValueChange={v => update(item.id, v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PERMIT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}<SelectItem value="custom">…</SelectItem></SelectContent>
        </Select>
        {item.category === "custom" && <Input value="" placeholder={t(p + "category")} onChange={e => update(item.id, e.target.value)} />}
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(items.filter(x => x.id !== item.id))}><Trash2 size={15} /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, newPermit()])}><Plus size={14} /> {t(p + "add")}</Button>
    </div>
  </div>;
}

export function ProjectsForm({ items, onChange }: { items: CvProject[]; onChange: (v: CvProject[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.projects.";
  return <ListEditor items={items} onChange={onChange} newItem={newProject} addLabel={t(p + "add")}
    itemLabel={(item, i) => item.name || `#${i + 1}`}
    renderItem={(item, update) => <div className="cv-form">
      <TextField label={t(p + "name")} value={item.name} onChange={v => update({ name: v })} />
      <AreaField label={t(p + "description")} value={item.description} onChange={v => update({ description: v })} optional={t("common.optional")} rows={3} />
      <FieldRow>
        <TextField label={t(p + "technologies")} value={item.technologies} onChange={v => update({ technologies: v })} optional={t("common.optional")} />
        <TextField label={t(p + "date")} value={item.date} onChange={v => update({ date: v })} optional={t("common.optional")} />
      </FieldRow>
      <TextField label={t(p + "url")} value={item.url} onChange={v => update({ url: v })} optional={t("common.optional")} />
    </div>} />;
}

export function InterestsForm({ items, style, onChangeItems, onChangeStyle }: { items: CvInterest[]; style: InterestsStyle; onChangeItems: (v: CvInterest[]) => void; onChangeStyle: (s: InterestsStyle) => void }) {
  const { t } = useTranslation();
  const p = "cv.interests.";
  return <div className="cv-form">
    <Field label={t(p + "style")}>
      <Select value={style} onValueChange={v => onChangeStyle(v as InterestsStyle)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{INTEREST_STYLES.map(s => <SelectItem key={s} value={s}>{t(p + "style" + s[0].toUpperCase() + s.slice(1))}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <div className="cv-inline-list">
      {items.map(item => <div key={item.id} className="cv-inline-row">
        <Input value={item.label} onChange={e => onChangeItems(items.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))} placeholder={t(p + "label")} />
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChangeItems(items.filter(x => x.id !== item.id))}><Trash2 size={15} /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChangeItems([...items, newInterest()])}><Plus size={14} /> {t(p + "add")}</Button>
    </div>
  </div>;
}

export function ReferencesForm({ items, availableOnRequest, onChangeItems, onChangeAvailable }: { items: CvReference[]; availableOnRequest: boolean; onChangeItems: (v: CvReference[]) => void; onChangeAvailable: (v: boolean) => void }) {
  const { t } = useTranslation();
  const p = "cv.references.";
  return <div className="cv-form">
    {items.length === 0 && <Field label={t(p + "availableOnRequest")}><Switch checked={availableOnRequest} onCheckedChange={onChangeAvailable} /></Field>}
    <ListEditor items={items} onChange={onChangeItems} newItem={newReference} addLabel={t(p + "add")}
      itemLabel={(item, i) => item.name || `#${i + 1}`}
      renderItem={(item, update) => <div className="cv-form">
        <FieldRow>
          <TextField label={t(p + "name")} value={item.name} onChange={v => update({ name: v })} />
          <TextField label={t(p + "jobTitle")} value={item.jobTitle} onChange={v => update({ jobTitle: v })} optional={t("common.optional")} />
        </FieldRow>
        <TextField label={t(p + "company")} value={item.company} onChange={v => update({ company: v })} optional={t("common.optional")} />
        <FieldRow>
          <TextField label={t(p + "phone")} value={item.phone} onChange={v => update({ phone: v })} optional={t("common.optional")} />
          <TextField label={t(p + "email")} value={item.email} onChange={v => update({ email: v })} optional={t("common.optional")} />
        </FieldRow>
      </div>}
    />
  </div>;
}
