import type { CvSectionKind } from "../types/cv-data";
import { COLOR_PALETTES, defaultTheme, type CvTheme } from "../types/theme";
import type { CvTemplateConfig, CvTemplateId } from "../types/template";

function palette(id: string) { return COLOR_PALETTES.find(p => p.id === id)?.colors ?? COLOR_PALETTES[0].colors; }
function theme(overrides: Partial<CvTheme>): CvTheme { return defaultTheme(overrides); }

const SIDEBAR_STANDARD: CvSectionKind[] = ["skills", "languages", "certifications", "interests", "permits"];
const SIDEBAR_STUDENT: CvSectionKind[] = ["education", "skills", "languages", "interests"];

export const CV_TEMPLATES: CvTemplateConfig[] = [
  {
    id: "classic", nameKey: "cv.templates.names.classic",
    tags: ["classic", "professional", "with-photo", "one-column"],
    defaultTheme: theme({ colors: palette("navy"), fontHeading: "pt-serif", fontBody: "pt-sans", fontName: "pt-serif", columns: 1, sectionSpacing: 18 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "underline", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "modern-blue", nameKey: "cv.templates.names.modernBlue",
    tags: ["modern", "professional", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("blue"), fontHeading: "montserrat", fontBody: "inter", fontName: "montserrat", columns: 2, sidebarWidthPercent: 32 }),
    photoDefault: true, headerVariant: "sidebar-photo", sectionHeaderVariant: "pill", experienceVariant: "plain", sidebarSections: SIDEBAR_STANDARD,
  },
  {
    id: "minimalist", nameKey: "cv.templates.names.minimalist",
    tags: ["modern", "professional", "without-photo", "one-column"],
    defaultTheme: theme({ colors: palette("gray"), fontHeading: "work-sans", fontBody: "work-sans", fontName: "work-sans", columns: 1, spacingPreset: "airy", sectionSpacing: 22, uppercaseHeadings: false, boldHeadings: false }),
    photoDefault: false, headerVariant: "centered", sectionHeaderVariant: "plain", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "elegant-premium", nameKey: "cv.templates.names.elegantPremium",
    tags: ["classic", "professional", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("gold"), fontHeading: "playfair-display", fontBody: "pt-serif", fontName: "playfair-display", columns: 2, columnSplit: "narrow-left", sidebarWidthPercent: 34 }),
    photoDefault: true, headerVariant: "sidebar-photo", sectionHeaderVariant: "icon-circle", experienceVariant: "plain", sidebarSections: SIDEBAR_STANDARD,
  },
  {
    id: "large-photo", nameKey: "cv.templates.names.largePhoto",
    tags: ["modern", "creative", "with-photo", "one-column"],
    defaultTheme: theme({ colors: palette("turquoise"), fontHeading: "poppins", fontBody: "open-sans", fontName: "poppins", columns: 1 }),
    photoDefault: true, headerVariant: "banner", sectionHeaderVariant: "bar", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "no-photo", nameKey: "cv.templates.names.noPhoto",
    tags: ["classic", "professional", "without-photo", "one-column"],
    defaultTheme: theme({ colors: palette("gray"), fontHeading: "open-sans", fontBody: "open-sans", fontName: "open-sans", columns: 1 }),
    photoDefault: false, headerVariant: "classic", sectionHeaderVariant: "bar", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "student", nameKey: "cv.templates.names.student",
    tags: ["student", "modern", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("green"), fontHeading: "nunito", fontBody: "nunito", fontName: "nunito", columns: 2, columnSplit: "narrow-left", sidebarWidthPercent: 34 }),
    photoDefault: true, headerVariant: "sidebar-photo", sectionHeaderVariant: "pill", experienceVariant: "plain", sidebarSections: SIDEBAR_STUDENT,
  },
  {
    id: "sales", nameKey: "cv.templates.names.sales",
    tags: ["professional", "modern", "with-photo", "one-column"],
    defaultTheme: theme({ colors: palette("orange"), fontHeading: "montserrat", fontBody: "lato", fontName: "montserrat", columns: 1 }),
    photoDefault: true, headerVariant: "banner", sectionHeaderVariant: "bar", experienceVariant: "cards", sidebarSections: [],
  },
  {
    id: "technical", nameKey: "cv.templates.names.technical",
    tags: ["professional", "classic", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("brown"), fontHeading: "pt-sans", fontBody: "pt-sans", fontName: "pt-sans", columns: 2, sidebarWidthPercent: 30 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "icon-circle", experienceVariant: "plain", sidebarSections: SIDEBAR_STANDARD,
  },
  {
    id: "tech", nameKey: "cv.templates.names.tech",
    tags: ["modern", "professional", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("mono"), fontHeading: "roboto", fontBody: "roboto", fontName: "roboto", columns: 2, sidebarWidthPercent: 30 }),
    photoDefault: true, headerVariant: "sidebar-photo", sectionHeaderVariant: "pill", experienceVariant: "timeline", sidebarSections: SIDEBAR_STANDARD,
  },
  {
    id: "manager", nameKey: "cv.templates.names.manager",
    tags: ["classic", "professional", "with-photo", "one-column"],
    defaultTheme: theme({ colors: palette("navy"), fontHeading: "pt-serif", fontBody: "inter", fontName: "pt-serif", columns: 1 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "underline", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "creative", nameKey: "cv.templates.names.creative",
    tags: ["creative", "modern", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("violet"), fontHeading: "raleway", fontBody: "raleway", fontName: "raleway", columns: 2, columnSplit: "wide-left", sidebarWidthPercent: 34 }),
    photoDefault: true, headerVariant: "split", sectionHeaderVariant: "icon-circle", experienceVariant: "cards", sidebarSections: SIDEBAR_STANDARD,
  },
  {
    id: "timeline", nameKey: "cv.templates.names.timeline",
    tags: ["modern", "professional", "with-photo", "one-column"],
    defaultTheme: theme({ colors: palette("green"), fontHeading: "lato", fontBody: "lato", fontName: "lato", columns: 1 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "plain", experienceVariant: "timeline", sidebarSections: [],
  },
  {
    id: "compact", nameKey: "cv.templates.names.compact",
    tags: ["professional", "classic", "with-photo", "one-column", "one-page"],
    defaultTheme: theme({ colors: palette("gray"), fontHeading: "inter", fontBody: "inter", fontName: "inter", columns: 1, spacingPreset: "compact", sectionSpacing: 10, paragraphSpacing: 3, sizeBody: 9, sizeHeading: 10, sizeName: 19, margin: 32 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "plain", experienceVariant: "plain", sidebarSections: [],
  },
  {
    id: "european", nameKey: "cv.templates.names.european",
    tags: ["classic", "professional", "with-photo", "two-columns"],
    defaultTheme: theme({ colors: palette("navy"), fontHeading: "eb-garamond", fontBody: "pt-sans", fontName: "eb-garamond", columns: 2, columnSplit: "narrow-left", sidebarWidthPercent: 30 }),
    photoDefault: true, headerVariant: "classic", sectionHeaderVariant: "underline", experienceVariant: "plain", sidebarSections: SIDEBAR_STANDARD,
  },
];

export function templateConfig(id: CvTemplateId): CvTemplateConfig {
  return CV_TEMPLATES.find(t => t.id === id) ?? CV_TEMPLATES[0];
}

export const DEFAULT_TEMPLATE_ID: CvTemplateId = "classic";
