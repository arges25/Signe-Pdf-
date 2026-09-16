import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { CvTemplateConfig } from "../types/template";
import { useCvPagination } from "./pagination";
import { A4_WIDTH_PT } from "./layout-constants";

// Thin wrapper around useCvPagination for callers that only need the page
// count (the overflow warning banner) rather than the full block layout —
// same column-width math CvRenderer uses, so the number always matches
// what's actually on screen.
export function usePaginatedCvPageCount(data: CvData, theme: CvTheme, template: CvTemplateConfig): number {
  const contentWidth = A4_WIDTH_PT - theme.margin * 2;
  const sidebarWidth = theme.columns === 2 ? contentWidth * (theme.sidebarWidthPercent / 100) - 10 : 0;
  const mainWidth = theme.columns === 2 ? contentWidth - contentWidth * (theme.sidebarWidthPercent / 100) - 10 : contentWidth;
  const { pages } = useCvPagination(data, theme, template, mainWidth, sidebarWidth);
  return pages.length;
}
