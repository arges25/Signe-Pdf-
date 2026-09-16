import type { CvLanguage } from "../types/cv-data";
import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { SectionHeaderVariant, ExperienceVariant } from "../types/template";
import type { FlowBlock } from "./flow-blocks";
import { formatCvDateRange } from "../cv-i18n";
import { SectionTitle, SkillsBody, LanguagesBody, InterestsBody, PermitsBody, ReferencesBody, EntryHeader, Description, TimelineWrap } from "./blocks";
import { bodyStyle } from "./style-helpers";

export function renderFlowBlock(block: FlowBlock, data: CvData, theme: CvTheme, sectionHeaderVariant: SectionHeaderVariant, experienceVariant: ExperienceVariant, inSidebar: boolean): React.ReactNode {
  const cvLang: CvLanguage = data.cvLanguage;
  switch (block.kind) {
    case "section-title":
      return <SectionTitle label={block.label} kind={block.section.kind} variant={sectionHeaderVariant} theme={theme} inSidebar={inSidebar} />;
    case "custom-title":
      return <SectionTitle label={block.section.title} kind="custom" variant={sectionHeaderVariant} theme={theme} inSidebar={inSidebar} />;
    case "profile-text":
      return <p style={{ ...bodyStyle(theme), color: inSidebar ? theme.colors.sidebarText : theme.colors.text, margin: 0, whiteSpace: "pre-wrap" }}>{block.text}</p>;
    case "experience-item": {
      const it = block.item;
      const body = <><EntryHeader title={[it.jobTitle, it.company].filter(Boolean).join(" — ")} meta={[it.city, it.country].filter(Boolean).join(", ")} dateLabel={formatCvDateRange(it.startDate, it.endDate, it.current, cvLang, data.dateFormat)} theme={theme} variant={experienceVariant} /><Description text={it.description} theme={theme} /></>;
      return experienceVariant === "timeline" ? <TimelineWrap theme={theme}>{body}</TimelineWrap> : body;
    }
    case "education-item": {
      const it = block.item;
      return <><EntryHeader title={[it.degree, it.institution].filter(Boolean).join(" — ")} meta={[it.city, it.country, it.honors].filter(Boolean).join(", ")} dateLabel={formatCvDateRange(it.startDate, it.endDate, false, cvLang, data.dateFormat)} theme={theme} variant="plain" /><Description text={it.description} theme={theme} /></>;
    }
    case "certification-item": {
      const it = block.item;
      return <EntryHeader title={[it.name, it.issuer].filter(Boolean).join(" — ")} meta={it.url} dateLabel={it.date} theme={theme} variant="plain" />;
    }
    case "project-item": {
      const it = block.item;
      return <><EntryHeader title={it.name} meta={[it.technologies, it.url].filter(Boolean).join(" · ")} dateLabel={it.date} theme={theme} variant={experienceVariant === "cards" ? "cards" : "plain"} /><Description text={it.description} theme={theme} /></>;
    }
    case "custom-item": {
      const it = block.item;
      return <><EntryHeader title={[it.title, it.subtitle].filter(Boolean).join(" — ")} meta="" dateLabel={it.date} theme={theme} variant="plain" /><Description text={it.description} theme={theme} /></>;
    }
    case "skills-list": return <SkillsBody data={data} theme={theme} inSidebar={inSidebar} />;
    case "languages-list": return <LanguagesBody data={data} theme={theme} inSidebar={inSidebar} />;
    case "interests-block": return <InterestsBody data={data} theme={theme} inSidebar={inSidebar} />;
    case "permits-block": return <PermitsBody data={data} theme={theme} inSidebar={inSidebar} />;
    case "references-block": return <ReferencesBody data={data} theme={theme} inSidebar={inSidebar} />;
    default: return null;
  }
}
