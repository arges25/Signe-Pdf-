import type { CSSProperties } from "react";
import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { SectionHeaderVariant, ExperienceVariant } from "../types/template";
import { cvStrings } from "../cv-i18n";
import { bodyStyle, bodyBoldStyle, headingStyle, metaStyle } from "./style-helpers";
import { SECTION_ICONS } from "./icons";

export function Description({ text, theme }: { text: string; theme: CvTheme }) {
  const lines = text.split("\n").filter(l => l.trim());
  if (!lines.length) return null;
  const bulletish = lines.length > 1;
  return <div style={{ marginTop: "3pt" }}>
    {lines.map((line, i) => <p key={i} style={{ ...bodyStyle(theme), margin: "1.5pt 0", paddingLeft: bulletish ? "10pt" : 0, position: "relative" }}>
      {bulletish && <span style={{ position: "absolute", left: 0, color: theme.colors.primary }}>•</span>}
      {line}
    </p>)}
  </div>;
}

export function SectionTitle({ label, kind, variant, theme, inSidebar }: { label: string; kind: string; variant: SectionHeaderVariant; theme: CvTheme; inSidebar?: boolean }) {
  const color = inSidebar ? theme.colors.sidebarText : theme.colors.heading;
  const accent = inSidebar ? theme.colors.sidebarText : theme.colors.primary;
  const Icon = SECTION_ICONS[kind] ?? SECTION_ICONS.custom;
  const base = headingStyle(theme, color);
  if (variant === "underline") return <h3 style={{ ...base, margin: "0 0 6pt", paddingBottom: "4pt", borderBottom: `1.4pt solid ${accent}` }}>{label}</h3>;
  if (variant === "bar") return <h3 style={{ ...base, margin: "0 0 6pt", padding: "3pt 8pt", background: accent, color: inSidebar ? theme.colors.sidebarBackground : "#fff", display: "inline-block", borderRadius: "2pt" }}>{label}</h3>;
  if (variant === "pill") return <h3 style={{ ...base, margin: "0 0 7pt", padding: "3pt 10pt", background: inSidebar ? "rgba(255,255,255,0.14)" : `${accent}1a`, color, display: "inline-block", borderRadius: "999pt" }}>{label}</h3>;
  if (variant === "icon-circle") return <h3 style={{ ...base, margin: "0 0 7pt", display: "flex", alignItems: "center", gap: "6pt" }}>
    <span style={{ width: "18pt", height: "18pt", borderRadius: "999pt", background: accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={10} color={inSidebar ? theme.colors.sidebarBackground : "#fff"} />
    </span>
    {label}
  </h3>;
  return <h3 style={{ ...base, margin: "0 0 6pt" }}>{label}</h3>;
}

export function EntryHeader({ title, meta, dateLabel, theme, variant }: { title: string; meta: string; dateLabel: string; theme: CvTheme; variant: ExperienceVariant }) {
  const cardStyle: CSSProperties = variant === "cards" ? { background: `${theme.colors.primary}0d`, border: `1pt solid ${theme.colors.primary}33`, borderRadius: "5pt", padding: "7pt 9pt" } : {};
  return <div style={cardStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8pt", flexWrap: "wrap" }}>
      <span style={bodyBoldStyle(theme)}>{title}</span>
      {dateLabel && <span style={metaStyle(theme)}>{dateLabel}</span>}
    </div>
    {meta && <div style={metaStyle(theme)}>{meta}</div>}
  </div>;
}

export function TimelineWrap({ theme, children }: { theme: CvTheme; children: React.ReactNode }) {
  return <div style={{ position: "relative", paddingLeft: "13pt", borderLeft: `1.4pt solid ${theme.colors.primary}55` }}>
    <span style={{ position: "absolute", left: "-4.5pt", top: "3pt", width: "8pt", height: "8pt", borderRadius: "999pt", background: theme.colors.primary }} />
    {children}
  </div>;
}

function SkillLevelBadge({ level, theme }: { level: string; theme: CvTheme }) {
  return <span style={{ ...metaStyle(theme), padding: "1pt 6pt", border: `1pt solid ${theme.colors.primary}66`, borderRadius: "999pt", fontSize: `${theme.sizeBody * 0.82}pt` }}>{level}</span>;
}

export function SkillsBody({ data, theme, inSidebar }: { data: CvData; theme: CvTheme; inSidebar?: boolean }) {
  const strings = cvStrings(data.cvLanguage);
  const levelOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const textColor = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  if (data.skillsStyle === "badges") return <div style={{ display: "flex", flexWrap: "wrap", gap: "5pt" }}>
    {data.skills.map(s => <span key={s.id} style={{ ...bodyStyle(theme), color: textColor, padding: "2.5pt 8pt", background: inSidebar ? "rgba(255,255,255,0.12)" : `${theme.colors.primary}14`, borderRadius: "999pt", fontSize: `${theme.sizeBody * 0.9}pt` }}>{s.name}</span>)}
  </div>;
  return <div style={{ display: "flex", flexDirection: "column", gap: "5pt" }}>
    {data.skills.map(s => {
      const level = s.level;
      const rank = level ? levelOrder[level] : 0;
      return <div key={s.id}>
        <div style={{ display: "flex", justifyContent: "space-between", ...bodyStyle(theme), color: textColor }}>
          <span>{s.name}</span>
          {data.skillsStyle === "list" && level && <SkillLevelBadge level={strings.skillLevels[level]} theme={theme} />}
        </div>
        {(data.skillsStyle === "bars" || data.skillsStyle === "dots" || data.skillsStyle === "stars") && level && <div style={{ display: "flex", gap: "3pt", marginTop: "2pt" }}>
          {data.skillsStyle === "bars"
            ? <div style={{ height: "4pt", flex: 1, background: inSidebar ? "rgba(255,255,255,0.18)" : "#e5e9f0", borderRadius: "999pt", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(rank / 4) * 100}%`, background: inSidebar ? theme.colors.sidebarText : theme.colors.primary }} />
              </div>
            : Array.from({ length: 4 }).map((_, i) => <span key={i} style={{ width: data.skillsStyle === "dots" ? "6pt" : "7pt", height: data.skillsStyle === "dots" ? "6pt" : "7pt", borderRadius: data.skillsStyle === "dots" ? "999pt" : "1pt", background: i < rank ? (inSidebar ? theme.colors.sidebarText : theme.colors.primary) : (inSidebar ? "rgba(255,255,255,0.2)" : "#e5e9f0") }} />)}
        </div>}
      </div>;
    })}
  </div>;
}

export function LanguagesBody({ data, theme, inSidebar }: { data: CvData; theme: CvTheme; inSidebar?: boolean }) {
  const strings = cvStrings(data.cvLanguage);
  const textColor = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  return <div style={{ display: "flex", flexDirection: "column", gap: "4pt" }}>
    {data.spokenLanguages.map(l => <div key={l.id} style={{ display: "flex", justifyContent: "space-between", ...bodyStyle(theme), color: textColor }}>
      <span>{l.name}</span><span style={metaStyle(theme)}>{strings.languageLevels[l.level]}</span>
    </div>)}
  </div>;
}

export function InterestsBody({ data, theme, inSidebar }: { data: CvData; theme: CvTheme; inSidebar?: boolean }) {
  const textColor = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  if (data.interestsStyle === "text") return <p style={{ ...bodyStyle(theme), color: textColor, margin: 0 }}>{data.interests.map(i => i.label).join(", ")}</p>;
  if (data.interestsStyle === "list") return <ul style={{ margin: 0, paddingLeft: "12pt" }}>{data.interests.map(i => <li key={i.id} style={{ ...bodyStyle(theme), color: textColor }}>{i.label}</li>)}</ul>;
  return <div style={{ display: "flex", flexWrap: "wrap", gap: "5pt" }}>
    {data.interests.map(i => <span key={i.id} style={{ ...bodyStyle(theme), color: textColor, padding: "2.5pt 8pt", background: inSidebar ? "rgba(255,255,255,0.12)" : `${theme.colors.primary}14`, borderRadius: "999pt", fontSize: `${theme.sizeBody * 0.9}pt` }}>{i.label}</span>)}
  </div>;
}

export function PermitsBody({ data, theme, inSidebar }: { data: CvData; theme: CvTheme; inSidebar?: boolean }) {
  const textColor = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  return <div style={{ display: "flex", flexWrap: "wrap", gap: "5pt" }}>
    {data.permits.map(p => <span key={p.id} style={{ ...bodyStyle(theme), color: textColor, padding: "2.5pt 8pt", border: `1pt solid ${inSidebar ? "rgba(255,255,255,0.3)" : theme.colors.primary + "55"}`, borderRadius: "4pt", fontSize: `${theme.sizeBody * 0.92}pt` }}>{p.category}</span>)}
  </div>;
}

export function ReferencesBody({ data, theme, inSidebar }: { data: CvData; theme: CvTheme; inSidebar?: boolean }) {
  const strings = cvStrings(data.cvLanguage);
  const textColor = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  if (!data.references.length) return <p style={{ ...bodyStyle(theme), color: textColor, margin: 0, fontStyle: "italic" }}>{strings.referencesOnRequest}</p>;
  return <div style={{ display: "flex", flexDirection: "column", gap: "6pt" }}>
    {data.references.map(r => <div key={r.id}>
      <div style={{ ...bodyBoldStyle(theme), color: inSidebar ? theme.colors.sidebarText : theme.colors.heading }}>{r.name}</div>
      <div style={{ ...metaStyle(theme), color: inSidebar ? "rgba(255,255,255,0.75)" : undefined }}>{[r.jobTitle, r.company].filter(Boolean).join(" — ")}</div>
      <div style={{ ...metaStyle(theme), color: inSidebar ? "rgba(255,255,255,0.75)" : undefined }}>{[r.phone, r.email].filter(Boolean).join(" · ")}</div>
    </div>)}
  </div>;
}

