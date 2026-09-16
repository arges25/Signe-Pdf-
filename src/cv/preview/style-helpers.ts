import type { CSSProperties } from "react";
import { fontDef } from "../fonts";
import type { CvTheme } from "../types/theme";

// Every dimension here is an explicit `pt` string, never a bare number —
// bare numbers become `px` in React inline styles, and this renderer's
// page container, margins and pagination math (pagination.ts) all work in
// the same numeric "pt" space as the PDF exporter. Mixing the two would
// silently throw off the ratio between font size and page width.

export function nameStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontName).cssFamily, fontWeight: 700, fontSize: `${theme.sizeName}pt`, color: theme.colors.heading, lineHeight: 1.1, margin: 0 };
}
export function jobTitleStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontBody).cssFamily, fontWeight: 500, fontSize: `${theme.sizeJobTitle}pt`, color: theme.colors.primary, margin: "4pt 0 0" };
}
export function headingStyle(theme: CvTheme, colorOverride?: string): CSSProperties {
  return {
    fontFamily: fontDef(theme.fontHeading).cssFamily,
    fontWeight: theme.boldHeadings ? 700 : 400,
    textTransform: theme.uppercaseHeadings ? "uppercase" : "none",
    letterSpacing: `${theme.letterSpacing}pt`,
    color: colorOverride ?? theme.colors.heading,
    fontSize: `${theme.sizeHeading}pt`,
  };
}
export function bodyStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontBody).cssFamily, fontSize: `${theme.sizeBody}pt`, color: theme.colors.text, lineHeight: theme.lineHeight };
}
export function bodyBoldStyle(theme: CvTheme): CSSProperties {
  return { ...bodyStyle(theme), fontWeight: 700, color: theme.colors.heading };
}
export function metaStyle(theme: CvTheme): CSSProperties {
  return { ...bodyStyle(theme), fontSize: `${theme.sizeBody * 0.92}pt`, color: theme.colors.secondary };
}
