import type { CSSProperties } from "react";
import { fontDef } from "../fonts";
import type { CvTheme } from "../types/theme";

export function nameStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontName).cssFamily, fontWeight: 700, fontSize: theme.sizeName, color: theme.colors.heading, lineHeight: 1.1, margin: 0 };
}
export function jobTitleStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontBody).cssFamily, fontWeight: 500, fontSize: theme.sizeJobTitle, color: theme.colors.primary, margin: "4pt 0 0" };
}
export function headingStyle(theme: CvTheme, colorOverride?: string): CSSProperties {
  return {
    fontFamily: fontDef(theme.fontHeading).cssFamily,
    fontWeight: theme.boldHeadings ? 700 : 400,
    textTransform: theme.uppercaseHeadings ? "uppercase" : "none",
    letterSpacing: theme.letterSpacing,
    color: colorOverride ?? theme.colors.heading,
    fontSize: theme.sizeHeading,
  };
}
export function bodyStyle(theme: CvTheme): CSSProperties {
  return { fontFamily: fontDef(theme.fontBody).cssFamily, fontSize: theme.sizeBody, color: theme.colors.text, lineHeight: theme.lineHeight };
}
export function bodyBoldStyle(theme: CvTheme): CSSProperties {
  return { ...bodyStyle(theme), fontWeight: 700, color: theme.colors.heading };
}
export function metaStyle(theme: CvTheme): CSSProperties {
  return { ...bodyStyle(theme), fontSize: theme.sizeBody * 0.92, color: theme.colors.secondary };
}
