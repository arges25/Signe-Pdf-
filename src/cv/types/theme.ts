// The CV's visual styling — fully independent of its content (CvData) and
// of its structural template (see template.ts). Switching a template
// resets this to that template's defaultTheme; "Réinitialiser le style"
// does the same for the current template without touching CvData at all.

export type FontId =
  | "inter" | "roboto" | "open-sans" | "lato" | "montserrat" | "poppins" | "raleway" | "nunito" | "work-sans" | "pt-sans"
  | "pt-serif" | "merriweather" | "playfair-display" | "eb-garamond" | "libre-baskerville" | "oswald" | "courier-prime";

export type CvColors = {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  heading: string;
  background: string;
  sidebarBackground: string;
  sidebarText: string;
};

export type CvLayoutColumns = 1 | 2;
export type CvColumnSplit = "narrow-left" | "wide-left";
export type SpacingPreset = "compact" | "normal" | "airy";

export type CvTheme = {
  colors: CvColors;
  fontName: FontId;
  fontHeading: FontId;
  fontBody: FontId;
  sizeName: number; // pt
  sizeJobTitle: number;
  sizeHeading: number;
  sizeBody: number;
  lineHeight: number; // multiplier
  paragraphSpacing: number; // pt
  sectionSpacing: number; // pt
  boldHeadings: boolean;
  uppercaseHeadings: boolean;
  letterSpacing: number; // px, headings only
  columns: CvLayoutColumns;
  columnSplit: CvColumnSplit;
  sidebarWidthPercent: number; // 25-40
  spacingPreset: SpacingPreset;
  icons: boolean;
  margin: number; // pt
};

export const COLOR_PALETTES: { id: string; labelKey: string; colors: CvColors }[] = [
  { id: "blue", labelKey: "cv.design.palettes.blue", colors: { primary: "#2457ea", secondary: "#173a8a", accent: "#2457ea", text: "#22304a", heading: "#122043", background: "#ffffff", sidebarBackground: "#0f2557", sidebarText: "#ffffff" } },
  { id: "navy", labelKey: "cv.design.palettes.navy", colors: { primary: "#1b2a4a", secondary: "#334770", accent: "#4f6fb0", text: "#22304a", heading: "#151f36", background: "#ffffff", sidebarBackground: "#151f36", sidebarText: "#ffffff" } },
  { id: "mono", labelKey: "cv.design.palettes.mono", colors: { primary: "#171717", secondary: "#404040", accent: "#171717", text: "#262626", heading: "#0a0a0a", background: "#ffffff", sidebarBackground: "#171717", sidebarText: "#ffffff" } },
  { id: "gray", labelKey: "cv.design.palettes.gray", colors: { primary: "#52606d", secondary: "#7b8794", accent: "#52606d", text: "#323f4b", heading: "#1f2933", background: "#ffffff", sidebarBackground: "#e4e7eb", sidebarText: "#1f2933" } },
  { id: "green", labelKey: "cv.design.palettes.green", colors: { primary: "#0f7a52", secondary: "#0a5c3d", accent: "#0f7a52", text: "#1f2d27", heading: "#0c2318", background: "#ffffff", sidebarBackground: "#0c2318", sidebarText: "#ffffff" } },
  { id: "burgundy", labelKey: "cv.design.palettes.burgundy", colors: { primary: "#7a1f3d", secondary: "#5c1730", accent: "#7a1f3d", text: "#2b1a20", heading: "#1f1116", background: "#ffffff", sidebarBackground: "#3d1120", sidebarText: "#ffffff" } },
  { id: "beige", labelKey: "cv.design.palettes.beige", colors: { primary: "#8a6d3b", secondary: "#6b5227", accent: "#8a6d3b", text: "#3a3226", heading: "#241f18", background: "#fffdf8", sidebarBackground: "#f1e7d3", sidebarText: "#3a3226" } },
  { id: "violet", labelKey: "cv.design.palettes.violet", colors: { primary: "#6d28d9", secondary: "#4c1d95", accent: "#6d28d9", text: "#291f3d", heading: "#1c1330", background: "#ffffff", sidebarBackground: "#2e1a52", sidebarText: "#ffffff" } },
  { id: "orange", labelKey: "cv.design.palettes.orange", colors: { primary: "#c2410c", secondary: "#9a3412", accent: "#c2410c", text: "#3a2418", heading: "#271808", background: "#ffffff", sidebarBackground: "#271808", sidebarText: "#ffffff" } },
  { id: "turquoise", labelKey: "cv.design.palettes.turquoise", colors: { primary: "#0e7c86", secondary: "#0a5f66", accent: "#0e7c86", text: "#1c2e30", heading: "#0f1f21", background: "#ffffff", sidebarBackground: "#0f1f21", sidebarText: "#ffffff" } },
  { id: "brown", labelKey: "cv.design.palettes.brown", colors: { primary: "#6f4518", secondary: "#523310", accent: "#6f4518", text: "#332417", heading: "#20160e", background: "#ffffff", sidebarBackground: "#3a2716", sidebarText: "#ffffff" } },
  { id: "gold", labelKey: "cv.design.palettes.gold", colors: { primary: "#8a6d1f", secondary: "#171717", accent: "#b9954a", text: "#242119", heading: "#171717", background: "#ffffff", sidebarBackground: "#171717", sidebarText: "#e9d9a8" } },
];

export function defaultTheme(overrides: Partial<CvTheme> = {}): CvTheme {
  return {
    colors: COLOR_PALETTES[0].colors,
    fontName: "inter", fontHeading: "inter", fontBody: "inter",
    sizeName: 24, sizeJobTitle: 13, sizeHeading: 11.5, sizeBody: 10,
    lineHeight: 1.4, paragraphSpacing: 6, sectionSpacing: 16,
    boldHeadings: true, uppercaseHeadings: true, letterSpacing: 0.6,
    columns: 1, columnSplit: "wide-left", sidebarWidthPercent: 32,
    spacingPreset: "normal", icons: true, margin: 42,
    ...overrides,
  };
}
