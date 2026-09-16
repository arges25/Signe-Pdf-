import { useTranslation } from "react-i18next";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CvSkill, CvSpokenLanguage, SkillLevel, SkillsStyle, LanguageLevel } from "../types/cv-data";
import { newSkill, newSpokenLanguage } from "../types/cv-data";
import { Field } from "./fields";

const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];
const SKILL_STYLES: SkillsStyle[] = ["list", "bars", "stars", "dots", "badges"];
const LANGUAGE_LEVELS: LanguageLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "beginner", "intermediate", "fluent", "native"];

export function SkillsForm({ skills, style, onChangeSkills, onChangeStyle }: { skills: CvSkill[]; style: SkillsStyle; onChangeSkills: (s: CvSkill[]) => void; onChangeStyle: (s: SkillsStyle) => void }) {
  const { t } = useTranslation();
  const p = "cv.skills.";
  function update(id: string, patch: Partial<CvSkill>) { onChangeSkills(skills.map(s => s.id === id ? { ...s, ...patch } : s)); }
  return <div className="cv-form">
    <Field label={t(p + "style")}>
      <Select value={style} onValueChange={v => onChangeStyle(v as SkillsStyle)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{SKILL_STYLES.map(s => <SelectItem key={s} value={s}>{t(p + "style" + s[0].toUpperCase() + s.slice(1))}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <div className="cv-inline-list">
      {skills.map(s => <div key={s.id} className="cv-inline-row">
        <Input value={s.name} onChange={e => update(s.id, { name: e.target.value })} placeholder={t(p + "name")} />
        <Select value={s.level ?? "none"} onValueChange={v => update(s.id, { level: v === "none" ? null : v as SkillLevel })}>
          <SelectTrigger className="cv-inline-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{t(p + "levels." + l)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChangeSkills(skills.filter(x => x.id !== s.id))}><Trash2 size={15} /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChangeSkills([...skills, newSkill()])}><Plus size={14} /> {t(p + "add")}</Button>
    </div>
  </div>;
}

export function LanguagesForm({ languages, onChange }: { languages: CvSpokenLanguage[]; onChange: (l: CvSpokenLanguage[]) => void }) {
  const { t } = useTranslation();
  const p = "cv.languages.";
  function update(id: string, patch: Partial<CvSpokenLanguage>) { onChange(languages.map(l => l.id === id ? { ...l, ...patch } : l)); }
  return <div className="cv-form">
    <div className="cv-inline-list">
      {languages.map(l => <div key={l.id} className="cv-inline-row">
        <Input value={l.name} onChange={e => update(l.id, { name: e.target.value })} placeholder={t(p + "name")} />
        <Select value={l.level} onValueChange={v => update(l.id, { level: v as LanguageLevel })}>
          <SelectTrigger className="cv-inline-select"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGE_LEVELS.map(lvl => <SelectItem key={lvl} value={lvl}>{t(p + "levels." + lvl)}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(languages.filter(x => x.id !== l.id))}><Trash2 size={15} /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...languages, newSpokenLanguage()])}><Plus size={14} /> {t(p + "add")}</Button>
    </div>
  </div>;
}
