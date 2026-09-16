import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CvTheme, CvColors, FontId, CvLayoutColumns, CvColumnSplit, SpacingPreset } from "../types/theme";
import { COLOR_PALETTES } from "../types/theme";
import type { DateFormat } from "../types/cv-data";
import { FONT_LIBRARY, ensureFontLoaded } from "../fonts";
import { Field } from "./fields";

const SPACING_PRESETS: Record<SpacingPreset, Partial<CvTheme>> = {
  compact: { paragraphSpacing: 3, sectionSpacing: 10, lineHeight: 1.25 },
  normal: { paragraphSpacing: 6, sectionSpacing: 16, lineHeight: 1.4 },
  airy: { paragraphSpacing: 9, sectionSpacing: 24, lineHeight: 1.55 },
};

function FontSelect({ label, value, onChange }: { label: string; value: FontId; onChange: (v: FontId) => void }) {
  return <Field label={label}>
    <Select value={value} onValueChange={v => { ensureFontLoaded(v as FontId); onChange(v as FontId); }}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{FONT_LIBRARY.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
    </Select>
  </Field>;
}

export default function DesignPanel({ theme, onChange, onResetStyle }: { theme: CvTheme; onChange: (patch: Partial<CvTheme>) => void; onResetStyle: () => void }) {
  const { t } = useTranslation();
  const d = "cv.design.";

  function setColor(key: keyof CvColors, value: string) { onChange({ colors: { ...theme.colors, [key]: value } }); }

  return <div className="cv-form cv-design-panel">
    <section className="cv-design-section">
      <h4>{t(d + "colors")}</h4>
      <div className="cv-palette-grid">
        {COLOR_PALETTES.map(p => <button key={p.id} type="button" className={`cv-palette-swatch ${JSON.stringify(theme.colors) === JSON.stringify(p.colors) ? "is-active" : ""}`} onClick={() => onChange({ colors: p.colors })} title={t(p.labelKey)}>
          <span style={{ background: p.colors.primary }} /><span style={{ background: p.colors.sidebarBackground }} />
        </button>)}
      </div>
      <div className="cv-color-grid">
        {(["primary", "secondary", "accent", "text", "heading", "background", "sidebarBackground", "sidebarText"] as const).map(key => <Field key={key} label={t(d + (key === "sidebarBackground" ? "sidebar" : key === "sidebarText" ? "sidebar" : key))}>
          <input type="color" value={theme.colors[key]} onChange={e => setColor(key, e.target.value)} className="cv-color-input" />
        </Field>)}
      </div>
    </section>

    <section className="cv-design-section">
      <h4>{t(d + "fonts")}</h4>
      <FontSelect label={t(d + "fontName")} value={theme.fontName} onChange={v => onChange({ fontName: v })} />
      <FontSelect label={t(d + "fontHeading")} value={theme.fontHeading} onChange={v => onChange({ fontHeading: v })} />
      <FontSelect label={t(d + "fontBody")} value={theme.fontBody} onChange={v => onChange({ fontBody: v })} />
    </section>

    <section className="cv-design-section">
      <h4>{t(d + "typography")}</h4>
      <Field label={t(d + "sizeName")}><Slider min={16} max={34} step={1} value={[theme.sizeName]} onValueChange={([v]) => onChange({ sizeName: v })} /></Field>
      <Field label={t(d + "sizeJobTitle")}><Slider min={9} max={18} step={0.5} value={[theme.sizeJobTitle]} onValueChange={([v]) => onChange({ sizeJobTitle: v })} /></Field>
      <Field label={t(d + "sizeHeading")}><Slider min={8} max={16} step={0.5} value={[theme.sizeHeading]} onValueChange={([v]) => onChange({ sizeHeading: v })} /></Field>
      <Field label={t(d + "sizeBody")}><Slider min={7.5} max={13} step={0.5} value={[theme.sizeBody]} onValueChange={([v]) => onChange({ sizeBody: v })} /></Field>
      <Field label={t(d + "lineHeight")}><Slider min={1.1} max={1.8} step={0.05} value={[theme.lineHeight]} onValueChange={([v]) => onChange({ lineHeight: v })} /></Field>
      <Field label={t(d + "letterSpacing")}><Slider min={0} max={2} step={0.1} value={[theme.letterSpacing]} onValueChange={([v]) => onChange({ letterSpacing: v })} /></Field>
      <Field label={t(d + "uppercaseHeadings")}><Switch checked={theme.uppercaseHeadings} onCheckedChange={v => onChange({ uppercaseHeadings: v })} /></Field>
      <Field label={t(d + "boldHeadings")}><Switch checked={theme.boldHeadings} onCheckedChange={v => onChange({ boldHeadings: v })} /></Field>
    </section>

    <section className="cv-design-section">
      <h4>{t(d + "layout")}</h4>
      <Field label={t(d + "columns")}>
        <Select value={String(theme.columns)} onValueChange={v => onChange({ columns: Number(v) as CvLayoutColumns })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="1">{t(d + "oneColumn")}</SelectItem><SelectItem value="2">{t(d + "twoColumns")}</SelectItem></SelectContent>
        </Select>
      </Field>
      {theme.columns === 2 && <>
        <Field label={t(d + "columnSplit")}>
          <Select value={theme.columnSplit} onValueChange={v => onChange({ columnSplit: v as CvColumnSplit })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="narrow-left">{t(d + "narrowLeft")}</SelectItem><SelectItem value="wide-left">{t(d + "wideLeft")}</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label={t(d + "sidebarWidth")}><Slider min={25} max={40} step={1} value={[theme.sidebarWidthPercent]} onValueChange={([v]) => onChange({ sidebarWidthPercent: v })} /></Field>
      </>}
    </section>

    <section className="cv-design-section">
      <h4>{t(d + "spacing")}</h4>
      <div className="cv-spacing-row">
        {(Object.keys(SPACING_PRESETS) as SpacingPreset[]).map(preset => <Button key={preset} type="button" variant={theme.spacingPreset === preset ? "default" : "outline"} size="sm" onClick={() => onChange({ spacingPreset: preset, ...SPACING_PRESETS[preset] })}>{t(d + "spacing" + preset[0].toUpperCase() + preset.slice(1))}</Button>)}
      </div>
      <Field label={t(d + "paragraphSpacing")}><Slider min={0} max={16} step={1} value={[theme.paragraphSpacing]} onValueChange={([v]) => onChange({ paragraphSpacing: v })} /></Field>
      <Field label={t(d + "sectionSpacing")}><Slider min={6} max={32} step={1} value={[theme.sectionSpacing]} onValueChange={([v]) => onChange({ sectionSpacing: v })} /></Field>
      <Field label={t(d + "margin")}><Slider min={24} max={64} step={2} value={[theme.margin]} onValueChange={([v]) => onChange({ margin: v })} /></Field>
    </section>

    <section className="cv-design-section">
      <h4>{t(d + "icons")}</h4>
      <Field label={t(d + "iconsEnabled")}><Switch checked={theme.icons} onCheckedChange={v => onChange({ icons: v })} /></Field>
    </section>

    <Button type="button" variant="outline" onClick={onResetStyle}>{t(d + "resetStyle")}</Button>
  </div>;
}

export function DateFormatField({ value, onChange }: { value: DateFormat; onChange: (v: DateFormat) => void }) {
  const { t } = useTranslation();
  const d = "cv.design.";
  return <Field label={t(d + "dateFormat")}>
    <Select value={value} onValueChange={v => onChange(v as DateFormat)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="monthYear">{t(d + "dateFormatMonthYear")}</SelectItem>
        <SelectItem value="numeric">{t(d + "dateFormatNumeric")}</SelectItem>
        <SelectItem value="yearOnly">{t(d + "dateFormatYearOnly")}</SelectItem>
      </SelectContent>
    </Select>
  </Field>;
}
