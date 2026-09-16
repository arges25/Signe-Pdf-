import { cssColorToRgb01 } from "@/lib/doc-html-parse";
import type { SignatureAsset } from "@/lib/pdf-signing";
import type { CvData } from "../types/cv-data";
import type { CvTheme, FontId } from "../types/theme";
import type { CvTemplateConfig } from "../types/template";
import { computeCvPages } from "../preview/pagination";
import type { FlowBlock } from "../preview/flow-blocks";
import { cvStrings, formatCvDateRange } from "../cv-i18n";
import { fetchFontBytes, subsetForChar } from "../fonts";
import { A4_WIDTH_PT, A4_HEIGHT_PT } from "../preview/layout-constants";

type PdfLib = typeof import("pdf-lib");
type PDFDocument = import("pdf-lib").PDFDocument;
type PDFPage = import("pdf-lib").PDFPage;
type PDFFont = import("pdf-lib").PDFFont;
type RGB = { r: number; g: number; b: number };

// Google's "latin" and "latin-ext" subset files are disjoint — neither
// contains the other's glyphs (see fonts.ts) — so every embedded family
// carries two independent font objects per weight, and every piece of
// text drawn below is split into same-subset runs first (splitRuns /
// widthOfDualText / drawDualText) rather than assumed to fit in one font.
type FontPair = { regular: PDFFont; bold: PDFFont };
type DualFont = { latin: FontPair; latinExt: FontPair };

async function embedFonts(doc: PDFDocument, fontIds: FontId[]): Promise<Map<FontId, DualFont>> {
  const fontkitModule = await import("@pdf-lib/fontkit");
  doc.registerFontkit(fontkitModule.default ?? fontkitModule);
  const map = new Map<FontId, DualFont>();
  for (const id of new Set(fontIds)) {
    const [latinReg, latinBold, extReg, extBold] = await Promise.all([
      fetchFontBytes(id, "latin", 400), fetchFontBytes(id, "latin", 700),
      fetchFontBytes(id, "latin-ext", 400), fetchFontBytes(id, "latin-ext", 700),
    ]);
    const [latinRegular, latinBoldFont, extRegular, extBoldFont] = await Promise.all([
      doc.embedFont(latinReg), doc.embedFont(latinBold), doc.embedFont(extReg), doc.embedFont(extBold),
    ]);
    map.set(id, { latin: { regular: latinRegular, bold: latinBoldFont }, latinExt: { regular: extRegular, bold: extBoldFont } });
  }
  return map;
}

function fontForChar(dual: DualFont, ch: string, bold: boolean): PDFFont {
  const pair = subsetForChar(ch) === "latin" ? dual.latin : dual.latinExt;
  return bold ? pair.bold : pair.regular;
}

// Splits text into runs that each use a single PDFFont (a run boundary is
// any point where the required subset changes) — the unit both width
// measurement and drawing operate on, so a French/German/Turkish word
// mixing Latin-1 and Latin Extended-A characters still measures and
// draws correctly as one visual run of possibly-multiple font calls.
function splitRuns(text: string, dual: DualFont, bold: boolean): { text: string; font: PDFFont }[] {
  const runs: { text: string; font: PDFFont }[] = [];
  let i = 0;
  while (i < text.length) {
    const font = fontForChar(dual, text[i], bold);
    let j = i + 1;
    while (j < text.length && fontForChar(dual, text[j], bold) === font) j++;
    runs.push({ text: text.slice(i, j), font });
    i = j;
  }
  return runs;
}

function widthOfDualText(text: string, dual: DualFont, bold: boolean, size: number): number {
  return splitRuns(text, dual, bold).reduce((w, run) => w + run.font.widthOfTextAtSize(run.text, size), 0);
}

function drawDualText(rgbFn: PdfLib["rgb"], page: PDFPage, text: string, x: number, y: number, dual: DualFont, bold: boolean, size: number, c: RGB): number {
  let cursorX = x;
  for (const run of splitRuns(text, dual, bold)) {
    page.drawText(run.text, { x: cursorX, y, size, font: run.font, color: rgbFn(c.r, c.g, c.b) });
    cursorX += run.font.widthOfTextAtSize(run.text, size);
  }
  return cursorX;
}

function wrapLines(text: string, dual: DualFont, bold: boolean, size: number, maxWidth: number): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && widthOfDualText(test, dual, bold, size) > maxWidth) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

class Cursor {
  y: number;
  constructor(public page: PDFPage, public x: number, public width: number, startY: number) { this.y = startY; }
}

function color(css: string): RGB { return cssColorToRgb01(css); }

function drawParagraph(rgbFn: PdfLib["rgb"], cur: Cursor, text: string, dual: DualFont, size: number, lineHeight: number, c: RGB, indent = 0) {
  const paragraphs = text.split("\n").filter(l => l.trim());
  const bulletish = paragraphs.length > 1;
  for (const para of paragraphs) {
    const lines = wrapLines(para, dual, false, size, cur.width - indent - (bulletish ? 9 : 0));
    lines.forEach((line, i) => {
      if (bulletish && i === 0) cur.page.drawText("•", { x: cur.x + indent, y: cur.y, size, font: dual.latin.regular, color: rgbFn(c.r, c.g, c.b) });
      drawDualText(rgbFn, cur.page, line, cur.x + indent + (bulletish ? 9 : 0), cur.y, dual, false, size, c);
      cur.y -= size * lineHeight;
    });
  }
}

function drawEntryHeader(rgbFn: PdfLib["rgb"], cur: Cursor, title: string, meta: string, dateLabel: string, dual: DualFont, theme: CvTheme) {
  const size = theme.sizeBody;
  const headingColor = color(theme.colors.heading);
  const metaColor = color(theme.colors.secondary);
  const dateWidth = dateLabel ? widthOfDualText(dateLabel, dual, false, size * 0.92) : 0;
  drawDualText(rgbFn, cur.page, title, cur.x, cur.y, dual, true, size, headingColor);
  if (dateLabel) drawDualText(rgbFn, cur.page, dateLabel, cur.x + cur.width - dateWidth, cur.y, dual, false, size * 0.92, metaColor);
  cur.y -= size * theme.lineHeight;
  if (meta) {
    drawDualText(rgbFn, cur.page, meta, cur.x, cur.y, dual, false, size * 0.92, metaColor);
    cur.y -= size * 0.92 * theme.lineHeight;
  }
}

function drawSectionTitle(rgbFn: PdfLib["rgb"], cur: Cursor, label: string, dual: DualFont, theme: CvTheme, sidebar: boolean) {
  const c = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.heading);
  const size = theme.sizeHeading;
  const text = theme.uppercaseHeadings ? label.toLocaleUpperCase() : label;
  const bold = theme.boldHeadings;
  drawDualText(rgbFn, cur.page, text, cur.x, cur.y - size, dual, bold, size, c);
  cur.y -= size * 1.2;
  const accent = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.primary);
  const textWidth = widthOfDualText(text, dual, bold, size);
  cur.page.drawLine({ start: { x: cur.x, y: cur.y }, end: { x: cur.x + Math.min(cur.width, textWidth + 4), y: cur.y }, thickness: 0.8, color: rgbFn(accent.r, accent.g, accent.b), opacity: 0.6 });
  cur.y -= 6;
}

function drawSkills(rgbFn: PdfLib["rgb"], cur: Cursor, data: CvData, dual: DualFont, theme: CvTheme, sidebar: boolean) {
  const strings = cvStrings(data.cvLanguage);
  const textColor = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text);
  const barBg = sidebar ? { r: 1, g: 1, b: 1 } : { r: 0.9, g: 0.91, b: 0.94 };
  const barFg = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.primary);
  const levelOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const size = theme.sizeBody;
  for (const s of data.skills) {
    if (data.skillsStyle === "badges") {
      const w = widthOfDualText(s.name, dual, false, size * 0.9) + 12;
      if (cur.x + w > cur.x + cur.width) cur.y -= size * theme.lineHeight;
      cur.page.drawRectangle({ x: cur.x, y: cur.y - size, width: w, height: size * theme.lineHeight, color: rgbFn(barFg.r, barFg.g, barFg.b), opacity: sidebar ? 0.15 : 0.1 });
      drawDualText(rgbFn, cur.page, s.name, cur.x + 6, cur.y - size * 0.85, dual, false, size * 0.9, textColor);
      cur.y -= size * theme.lineHeight + 3;
      continue;
    }
    drawDualText(rgbFn, cur.page, s.name, cur.x, cur.y - size, dual, false, size, textColor);
    if (data.skillsStyle === "list" && s.level) {
      const label = strings.skillLevels[s.level];
      const w = widthOfDualText(label, dual, false, size * 0.85);
      drawDualText(rgbFn, cur.page, label, cur.x + cur.width - w, cur.y - size, dual, false, size * 0.85, textColor);
    }
    cur.y -= size * theme.lineHeight;
    if ((data.skillsStyle === "bars" || data.skillsStyle === "dots" || data.skillsStyle === "stars") && s.level) {
      const rank = levelOrder[s.level];
      if (data.skillsStyle === "bars") {
        cur.page.drawRectangle({ x: cur.x, y: cur.y - 3, width: cur.width, height: 3, color: rgbFn(barBg.r, barBg.g, barBg.b) });
        cur.page.drawRectangle({ x: cur.x, y: cur.y - 3, width: cur.width * (rank / 4), height: 3, color: rgbFn(barFg.r, barFg.g, barFg.b) });
      } else {
        for (let i = 0; i < 4; i++) {
          const cx = cur.x + i * 10 + 3;
          cur.page.drawCircle({ x: cx, y: cur.y - 3, size: 2.6, color: i < rank ? rgbFn(barFg.r, barFg.g, barFg.b) : rgbFn(barBg.r, barBg.g, barBg.b) });
        }
      }
      cur.y -= 9;
    }
    cur.y -= 4;
  }
}

function drawLanguages(rgbFn: PdfLib["rgb"], cur: Cursor, data: CvData, dual: DualFont, theme: CvTheme, sidebar: boolean) {
  const strings = cvStrings(data.cvLanguage);
  const textColor = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text);
  const size = theme.sizeBody;
  for (const l of data.spokenLanguages) {
    drawDualText(rgbFn, cur.page, l.name, cur.x, cur.y - size, dual, false, size, textColor);
    const label = strings.languageLevels[l.level];
    const w = widthOfDualText(label, dual, false, size * 0.9);
    drawDualText(rgbFn, cur.page, label, cur.x + cur.width - w, cur.y - size, dual, false, size * 0.9, textColor);
    cur.y -= size * theme.lineHeight + 2;
  }
}

function drawTags(rgbFn: PdfLib["rgb"], cur: Cursor, labels: string[], dual: DualFont, theme: CvTheme, sidebar: boolean) {
  const textColor = sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text);
  const bg = sidebar ? { r: 1, g: 1, b: 1 } : color(theme.colors.primary);
  const size = theme.sizeBody * 0.92;
  let x = cur.x;
  for (const label of labels) {
    const w = widthOfDualText(label, dual, false, size) + 12;
    if (x + w > cur.x + cur.width) { x = cur.x; cur.y -= size * theme.lineHeight + 6; }
    cur.page.drawRectangle({ x, y: cur.y - size, width: w, height: size * theme.lineHeight, color: rgbFn(bg.r, bg.g, bg.b), opacity: sidebar ? 0.15 : 0.12 });
    drawDualText(rgbFn, cur.page, label, x + 6, cur.y - size * 0.85, dual, false, size, textColor);
    x += w + 5;
  }
  cur.y -= size * theme.lineHeight + 6;
}

function drawBlock(rgbFn: PdfLib["rgb"], cur: Cursor, block: FlowBlock, data: CvData, dual: DualFont, headingDual: DualFont, theme: CvTheme, sidebar: boolean) {
  const strings = cvStrings(data.cvLanguage);
  switch (block.kind) {
    case "section-title": drawSectionTitle(rgbFn, cur, block.label, headingDual, theme, sidebar); return;
    case "custom-title": drawSectionTitle(rgbFn, cur, block.section.title, headingDual, theme, sidebar); return;
    case "profile-text": drawParagraph(rgbFn, cur, block.text, dual, theme.sizeBody, theme.lineHeight, sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text)); cur.y -= 6; return;
    case "experience-item": {
      const it = block.item;
      drawEntryHeader(rgbFn, cur, [it.jobTitle, it.company].filter(Boolean).join(" — "), [it.city, it.country].filter(Boolean).join(", "), formatCvDateRange(it.startDate, it.endDate, it.current, data.cvLanguage, data.dateFormat), dual, theme);
      drawParagraph(rgbFn, cur, it.description, dual, theme.sizeBody, theme.lineHeight, color(theme.colors.text));
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "education-item": {
      const it = block.item;
      drawEntryHeader(rgbFn, cur, [it.degree, it.institution].filter(Boolean).join(" — "), [it.city, it.country, it.honors].filter(Boolean).join(", "), formatCvDateRange(it.startDate, it.endDate, false, data.cvLanguage, data.dateFormat), dual, theme);
      drawParagraph(rgbFn, cur, it.description, dual, theme.sizeBody, theme.lineHeight, color(theme.colors.text));
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "certification-item": {
      const it = block.item;
      drawEntryHeader(rgbFn, cur, [it.name, it.issuer].filter(Boolean).join(" — "), it.url, it.date, dual, theme);
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "project-item": {
      const it = block.item;
      drawEntryHeader(rgbFn, cur, it.name, [it.technologies, it.url].filter(Boolean).join(" · "), it.date, dual, theme);
      drawParagraph(rgbFn, cur, it.description, dual, theme.sizeBody, theme.lineHeight, color(theme.colors.text));
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "custom-item": {
      const it = block.item;
      drawEntryHeader(rgbFn, cur, [it.title, it.subtitle].filter(Boolean).join(" — "), "", it.date, dual, theme);
      drawParagraph(rgbFn, cur, it.description, dual, theme.sizeBody, theme.lineHeight, color(theme.colors.text));
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "skills-list": drawSkills(rgbFn, cur, data, dual, theme, sidebar); cur.y -= theme.paragraphSpacing; return;
    case "languages-list": drawLanguages(rgbFn, cur, data, dual, theme, sidebar); cur.y -= theme.paragraphSpacing; return;
    case "interests-block": {
      if (data.interestsStyle === "text") drawParagraph(rgbFn, cur, data.interests.map(i => i.label).join(", "), dual, theme.sizeBody, theme.lineHeight, sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text));
      else drawTags(rgbFn, cur, data.interests.map(i => i.label), dual, theme, sidebar);
      cur.y -= theme.paragraphSpacing;
      return;
    }
    case "permits-block": drawTags(rgbFn, cur, data.permits.map(p => p.category), dual, theme, sidebar); cur.y -= theme.paragraphSpacing; return;
    case "references-block": {
      if (!data.references.length) { drawParagraph(rgbFn, cur, strings.referencesOnRequest, dual, theme.sizeBody, theme.lineHeight, sidebar ? color(theme.colors.sidebarText) : color(theme.colors.text)); cur.y -= theme.paragraphSpacing; return; }
      for (const r of data.references) {
        drawEntryHeader(rgbFn, cur, r.name, [r.jobTitle, r.company].filter(Boolean).join(" — "), "", dual, theme);
        if (r.phone || r.email) { drawParagraph(rgbFn, cur, [r.phone, r.email].filter(Boolean).join(" · "), dual, theme.sizeBody * 0.92, theme.lineHeight, color(theme.colors.secondary)); }
        cur.y -= theme.paragraphSpacing;
      }
      return;
    }
    default: return;
  }
}

function fullName(data: CvData): string { return [data.personal.firstName, data.personal.lastName].filter(Boolean).join(" "); }
function titleLine(data: CvData): string { return data.personal.jobTitle || data.personal.targetRole; }

function contactItems(data: CvData): string[] {
  const p = data.personal;
  const items: string[] = [];
  if (p.phone) items.push(p.phone);
  if (p.email) items.push(p.email);
  const address = [p.address, p.postalCode, p.city, p.country].filter(Boolean).join(", ");
  if (address) items.push(address);
  if (p.website) items.push(p.website);
  if (p.linkedin) items.push(p.linkedin);
  if (p.github) items.push(p.github);
  if (p.portfolio) items.push(p.portfolio);
  for (const link of p.customLinks) if (link.url) items.push(link.label ? `${link.label}: ${link.url}` : link.url);
  return items;
}

async function drawHeader(doc: PDFDocument, page: PDFPage, data: CvData, fonts: Map<FontId, DualFont>, theme: CvTheme, rgbFn: PdfLib["rgb"], x: number, width: number, topY: number, sidebar: boolean): Promise<number> {
  const nameDual = fonts.get(theme.fontName)!;
  const bodyDual = fonts.get(theme.fontBody)!;
  let y = topY;
  const photo = data.personal.photo;
  let textX = x;
  if (photo) {
    try {
      const bytes = await fetch(photo.dataUrl).then(r => r.arrayBuffer());
      const img = await doc.embedPng(bytes);
      const size = sidebar ? 70 : 60;
      page.drawImage(img, { x, y: y - size, width: size, height: size });
      if (sidebar) { y -= size + 10; } else { textX = x + size + 12; }
    } catch { /* unreadable image data — skip embedding, header still renders as text-only */ }
  }
  const headingColor = cssColorToRgb01(theme.colors.heading);
  drawDualText(rgbFn, page, fullName(data), textX, y - theme.sizeName, nameDual, true, theme.sizeName, headingColor);
  y -= theme.sizeName * 1.15;
  if (titleLine(data)) {
    const primary = cssColorToRgb01(theme.colors.primary);
    drawDualText(rgbFn, page, titleLine(data), textX, y - theme.sizeJobTitle, bodyDual, false, theme.sizeJobTitle, primary);
    y -= theme.sizeJobTitle * 1.3;
  }
  if (!sidebar) y = Math.min(y, topY - 60 - 4);
  const contactColor = sidebar ? cssColorToRgb01(theme.colors.sidebarText) : cssColorToRgb01(theme.colors.text);
  const size = theme.sizeBody * 0.94;
  if (sidebar) {
    for (const item of contactItems(data)) { drawDualText(rgbFn, page, item, x, y - size, bodyDual, false, size, contactColor); y -= size * 1.5; }
  } else {
    const line = contactItems(data).join("   ·   ");
    const lines = wrapLines(line, bodyDual, false, size, width);
    for (const l of lines) { drawDualText(rgbFn, page, l, x, y - size, bodyDual, false, size, contactColor); y -= size * 1.5; }
  }
  return y - 10;
}

export async function renderCvPdf(data: CvData, theme: CvTheme, template: CvTemplateConfig, signature: SignatureAsset | null): Promise<Uint8Array> {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, rgb } = pdfLib;
  const doc = await PDFDocument.create();
  const fontIds = [theme.fontName, theme.fontHeading, theme.fontBody];
  const fonts = await embedFonts(doc, fontIds);
  const bodyDual = fonts.get(theme.fontBody)!;
  const headingDual = fonts.get(theme.fontHeading)!;

  const contentWidth = A4_WIDTH_PT - theme.margin * 2;
  const sidebarWidth = theme.columns === 2 ? contentWidth * (theme.sidebarWidthPercent / 100) - 10 : 0;
  const mainWidth = theme.columns === 2 ? contentWidth - contentWidth * (theme.sidebarWidthPercent / 100) - 10 : contentWidth;
  const pages = computeCvPages(data, theme, template, mainWidth, sidebarWidth);
  const isSidebarHeader = theme.columns === 2 && template.headerVariant === "sidebar-photo";

  let embeddedSignature: Awaited<ReturnType<typeof doc.embedPng>> | null = null;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === pages.length - 1;
    const bg = cssColorToRgb01(theme.colors.background);
    page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH_PT, height: A4_HEIGHT_PT, color: rgb(bg.r, bg.g, bg.b) });

    let mainX = theme.margin;
    const mainStartY = A4_HEIGHT_PT - theme.margin;
    if (theme.columns === 2) {
      const sidebarBg = cssColorToRgb01(theme.colors.sidebarBackground);
      const sidebarPxWidth = A4_WIDTH_PT * (theme.sidebarWidthPercent / 100);
      const sidebarOnLeft = theme.columnSplit === "narrow-left" || theme.columnSplit === "wide-left";
      const sidebarX = sidebarOnLeft ? 0 : A4_WIDTH_PT - sidebarPxWidth;
      page.drawRectangle({ x: sidebarX, y: 0, width: sidebarPxWidth, height: A4_HEIGHT_PT, color: rgb(sidebarBg.r, sidebarBg.g, sidebarBg.b) });
      mainX = sidebarOnLeft ? sidebarPxWidth + theme.margin : theme.margin;

      const sidebarCursor = new Cursor(page, sidebarX + 14, sidebarPxWidth - 28, A4_HEIGHT_PT - theme.margin);
      if (isFirst && isSidebarHeader) sidebarCursor.y = await drawHeader(doc, page, data, fonts, theme, rgb, sidebarCursor.x, sidebarCursor.width, sidebarCursor.y, true);
      for (const block of pages[pageIndex].sidebar) drawBlock(rgb, sidebarCursor, block, data, bodyDual, headingDual, theme, true);
    }

    const mainCursor = new Cursor(page, mainX, mainWidth, mainStartY);
    if (isFirst && !isSidebarHeader) mainCursor.y = await drawHeader(doc, page, data, fonts, theme, rgb, mainCursor.x, mainCursor.width, mainCursor.y, false);
    for (const block of pages[pageIndex].main) drawBlock(rgb, mainCursor, block, data, bodyDual, headingDual, theme, false);

    if (isLast && data.qrCode.enabled && data.qrCode.url.trim()) {
      try {
        const QRCode = (await import("qrcode")).default;
        const qrDataUrl = await QRCode.toDataURL(data.qrCode.url, { margin: 0, width: 256 });
        const qrBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
        const qrImg = await doc.embedPng(qrBytes);
        const size = A4_WIDTH_PT * (data.qrCode.sizePercent / 100);
        const pos = data.qrCode.position;
        const qx = pos === "bottom-left" || pos === "sidebar" ? theme.margin : A4_WIDTH_PT - theme.margin - size;
        const qy = pos === "top-right" ? A4_HEIGHT_PT - theme.margin - size : theme.margin;
        page.drawImage(qrImg, { x: qx, y: qy, width: size, height: size });
      } catch { /* QR generation failed — skip silently, rest of the CV still exports */ }
    }
    if (isLast && data.signature.enabled && signature) {
      try {
        if (!embeddedSignature) { const bytes = await fetch(signature.dataUrl).then(r => r.arrayBuffer()); embeddedSignature = await doc.embedPng(bytes); }
        const width = 90 * (data.signature.sizePercent / 100);
        const height = width * (signature.height / signature.width);
        page.drawImage(embeddedSignature, { x: A4_WIDTH_PT - theme.margin - width, y: theme.margin, width, height });
      } catch { /* unreadable signature asset — skip, rest of export still succeeds */ }
    }
  }

  return doc.save({ updateFieldAppearances: false });
}
