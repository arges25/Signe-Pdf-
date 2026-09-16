import { useEffect, useMemo, useState } from "react";
import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { CvTemplateConfig, ExperienceVariant } from "../types/template";
import { buildFlowBlocks, isTitleBlock, type FlowBlock } from "./flow-blocks";
import { estimateWrappedLineCount, waitForFonts } from "./text-measure";
import { A4_HEIGHT_PT } from "./layout-constants";
import { ensureFontLoaded } from "../fonts";

const TITLE_GAP_AFTER = 6; // pt between a section title and its first content block
const CARD_PADDING = 16; // pt extra box padding the "cards" experience variant adds around each entry

// The gap CvRenderer actually applies via inline margin on each block
// wrapper — kept as the single source of truth so the pagination estimate
// below can never drift from what's really on screen (the bug this fixed:
// a flex `gap` used to add sectionSpacing between *every* block pair,
// while the estimate only budgeted it before titles, so real content ran
// measurably taller than what pagination thought it had room for).
export function blockMargins(kind: FlowBlock["kind"], theme: CvTheme): { top: number; bottom: number } {
  return isTitleBlock(kind) ? { top: theme.sectionSpacing, bottom: TITLE_GAP_AFTER } : { top: 0, bottom: theme.paragraphSpacing };
}

function entryOwnHeight(titleLines: number, description: string, theme: CvTheme, colWidthPt: number, cardPadding: number): number {
  const bodyLines = estimateWrappedLineCount(description, theme.fontBody, theme.sizeBody, colWidthPt - cardPadding);
  return (titleLines + bodyLines) * theme.sizeBody * theme.lineHeight + 4 + cardPadding;
}

function blockOwnHeight(block: FlowBlock, data: CvData, theme: CvTheme, colWidthPt: number, experienceVariant: ExperienceVariant): number {
  const lh = theme.lineHeight;
  const cardPad = experienceVariant === "cards" ? CARD_PADDING : 0;
  switch (block.kind) {
    case "section-title": return theme.sizeHeading * lh + 8;
    case "custom-title": return theme.sizeHeading * lh + 8;
    case "profile-text": return estimateWrappedLineCount(block.text, theme.fontBody, theme.sizeBody, colWidthPt) * theme.sizeBody * lh;
    case "experience-item": return entryOwnHeight(2, block.item.description, theme, colWidthPt, cardPad);
    case "education-item": return entryOwnHeight(2, block.item.description, theme, colWidthPt, 0);
    case "certification-item": return entryOwnHeight(2, "", theme, colWidthPt, 0);
    case "project-item": return entryOwnHeight(2, block.item.description, theme, colWidthPt, cardPad);
    case "custom-item": return entryOwnHeight(2, block.item.description, theme, colWidthPt, 0);
    case "skills-list": return data.skills.length * (theme.sizeBody * lh + 8);
    case "languages-list": return data.spokenLanguages.length * (theme.sizeBody * lh + 6);
    case "interests-block": return Math.ceil(data.interests.length / 3) * (theme.sizeBody * lh + 6);
    case "permits-block": return theme.sizeBody * lh + 6;
    case "references-block": return data.references.length ? data.references.length * (theme.sizeBody * lh * 2 + 6) : theme.sizeBody * lh;
    default: return theme.sizeBody * lh;
  }
}

// Total column height a block claims, margins included — a generous
// safety factor absorbs the residual gap between this flat estimate and
// real DOM layout (variant-specific paddings, canvas-vs-DOM text
// wrapping, sub-pixel rounding), so the estimate stays a same-or-larger
// upper bound rather than an exact-but-occasionally-short one: an extra
// half-empty page is a much smaller problem than silently clipped text.
function blockHeight(block: FlowBlock, data: CvData, theme: CvTheme, colWidthPt: number, experienceVariant: ExperienceVariant): number {
  const margins = blockMargins(block.kind, theme);
  const factor = isTitleBlock(block.kind) ? 1.8 : 1.65;
  return margins.top + blockOwnHeight(block, data, theme, colWidthPt, experienceVariant) * factor + margins.bottom;
}

function paginateColumn(blocks: FlowBlock[], data: CvData, theme: CvTheme, colWidthPt: number, experienceVariant: ExperienceVariant, firstPageHeightPt: number, laterPageHeightPt: number): FlowBlock[][] {
  const pages: FlowBlock[][] = [[]];
  let used = 0;
  let budget = Math.max(60, firstPageHeightPt);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const h = blockHeight(block, data, theme, colWidthPt, experienceVariant);
    const isOrphanTitle = isTitleBlock(block.kind) && i + 1 < blocks.length;
    const nextH = isOrphanTitle ? blockHeight(blocks[i + 1], data, theme, colWidthPt, experienceVariant) : 0;
    const fits = used + h <= budget && (!isOrphanTitle || used + h + Math.min(nextH, budget) <= budget || used === 0);
    if (!fits && pages[pages.length - 1].length > 0) { pages.push([]); used = 0; budget = Math.max(60, laterPageHeightPt); }
    pages[pages.length - 1].push(block);
    used += h;
  }
  return pages;
}

export type CvPage = { main: FlowBlock[]; sidebar: FlowBlock[] };

// Rough vertical space CvHeader itself occupies on page 1, per variant —
// used only to size the pagination budget, not to render anything.
const HEADER_HEIGHT_ESTIMATE: Record<string, number> = { classic: 96, banner: 150, centered: 110, split: 120, "sidebar-photo": 0 };
const SIDEBAR_HEADER_HEIGHT_ESTIMATE = 165; // photo + name/title + a vertical contact list, stacked in the sidebar

export function useCvPagination(data: CvData, theme: CvTheme, template: CvTemplateConfig, mainWidthPt: number, sidebarWidthPt: number): { pages: CvPage[]; ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let cancelled = false;
    ensureFontLoaded(theme.fontHeading); ensureFontLoaded(theme.fontBody); ensureFontLoaded(theme.fontName);
    void waitForFonts([
      { id: theme.fontHeading, sizePt: theme.sizeHeading, bold: true },
      { id: theme.fontBody, sizePt: theme.sizeBody },
      { id: theme.fontName, sizePt: theme.sizeName, bold: true },
    ]).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [theme.fontHeading, theme.fontBody, theme.fontName, theme.sizeHeading, theme.sizeBody, theme.sizeName]);

  const pages = useMemo((): CvPage[] => {
    const usableHeight = A4_HEIGHT_PT - theme.margin * 2;
    const isSidebarHeader = theme.columns === 2 && template.headerVariant === "sidebar-photo";
    const { main, sidebar } = buildFlowBlocks(data, theme.columns === 2 ? template.sidebarSections : []);

    const mainHeaderHeight = isSidebarHeader ? 0 : (HEADER_HEIGHT_ESTIMATE[template.headerVariant] ?? 96);
    const mainPages = paginateColumn(main, data, theme, mainWidthPt, template.experienceVariant, usableHeight - mainHeaderHeight, usableHeight);

    const sidebarHeaderHeight = isSidebarHeader ? SIDEBAR_HEADER_HEIGHT_ESTIMATE : 0;
    const sidebarPages = theme.columns === 2
      ? paginateColumn(sidebar, data, theme, sidebarWidthPt, template.experienceVariant, usableHeight - sidebarHeaderHeight, usableHeight)
      : [[]];

    const count = Math.max(mainPages.length, theme.columns === 2 ? sidebarPages.length : 1, 1);
    const out: CvPage[] = [];
    for (let i = 0; i < count; i++) out.push({ main: mainPages[i] ?? [], sidebar: sidebarPages[i] ?? [] });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme, template, mainWidthPt, sidebarWidthPt, ready]);

  return { pages, ready };
}
