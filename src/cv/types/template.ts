import type { CvSectionKind } from "./cv-data";
import type { CvTheme } from "./theme";

export type CvTemplateId =
  | "classic" | "modern-blue" | "minimalist" | "elegant-premium" | "large-photo"
  | "no-photo" | "student" | "sales" | "technical" | "tech" | "manager"
  | "creative" | "timeline" | "compact" | "european";

export type TemplateFilterTag = "classic" | "modern" | "creative" | "professional" | "student" | "with-photo" | "without-photo" | "one-column" | "two-columns" | "one-page";

export type HeaderVariant = "classic" | "banner" | "sidebar-photo" | "centered" | "split";
export type SectionHeaderVariant = "underline" | "pill" | "bar" | "plain" | "icon-circle";
export type ExperienceVariant = "plain" | "timeline" | "cards";

// Structural definition of a template: everything here is a *default* the
// user can override afterward in the design panel (theme.ts), except the
// slot assignment (which sections default to the sidebar) and the visual
// variants (header/section-header/experience rendering), which are what
// actually makes the 15 templates look structurally different from one
// another rather than just differently colored.
export type CvTemplateConfig = {
  id: CvTemplateId;
  nameKey: string;
  tags: TemplateFilterTag[];
  defaultTheme: CvTheme;
  photoDefault: boolean;
  headerVariant: HeaderVariant;
  sectionHeaderVariant: SectionHeaderVariant;
  experienceVariant: ExperienceVariant;
  sidebarSections: CvSectionKind[]; // only meaningful when columns === 2
};
