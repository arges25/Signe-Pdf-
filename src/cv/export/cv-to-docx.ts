import type { SignatureAsset } from "@/lib/pdf-signing";
import { unlockDocxImageResize } from "@/lib/docx-unlock-images";
import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { CvTemplateConfig } from "../types/template";
import { buildFlowBlocks, type FlowBlock } from "../preview/flow-blocks";
import { cvStrings, formatCvDateRange } from "../cv-i18n";

type DocxModule = typeof import("docx");

function cssColorToHex(css: string): string {
  const el = document.createElement("div");
  el.style.color = css;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
  if (!m) return "18263C";
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`.toUpperCase();
}

async function urlToBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

function fullName(data: CvData): string { return [data.personal.firstName, data.personal.lastName].filter(Boolean).join(" "); }
function titleLine(data: CvData): string { return data.personal.jobTitle || data.personal.targetRole; }
function contactLine(data: CvData): string {
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
  return items.join("  ·  ");
}

async function blockToParagraphs(docx: DocxModule, block: FlowBlock, data: CvData, theme: CvTheme): Promise<InstanceType<DocxModule["Paragraph"]>[]> {
  const { Paragraph, TextRun, HeadingLevel } = docx;
  const strings = cvStrings(data.cvLanguage);
  const headingColor = cssColorToHex(theme.colors.heading);
  const textColor = cssColorToHex(theme.colors.text);
  const metaColor = cssColorToHex(theme.colors.secondary);

  function titleParagraph(text: string): InstanceType<DocxModule["Paragraph"]> {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: theme.uppercaseHeadings ? text.toLocaleUpperCase() : text, bold: true, color: headingColor, size: Math.round(theme.sizeHeading * 2) })] });
  }
  function entryParagraphs(title: string, meta: string, dateLabel: string, description: string): InstanceType<DocxModule["Paragraph"]>[] {
    const out = [new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: title, bold: true, size: Math.round(theme.sizeBody * 2), color: headingColor }),
        ...(dateLabel ? [new TextRun({ text: `    ${dateLabel}`, italics: true, size: Math.round(theme.sizeBody * 1.8), color: metaColor })] : []),
      ],
    })];
    if (meta) out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: meta, size: Math.round(theme.sizeBody * 1.8), color: metaColor })] }));
    for (const line of description.split("\n").filter(l => l.trim())) {
      out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: line, size: Math.round(theme.sizeBody * 2), color: textColor })] }));
    }
    out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    return out;
  }
  function bodyText(text: string): InstanceType<DocxModule["Paragraph"]> {
    return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: Math.round(theme.sizeBody * 2), color: textColor })] });
  }

  switch (block.kind) {
    case "section-title": return [titleParagraph(block.label)];
    case "custom-title": return [titleParagraph(block.section.title)];
    case "profile-text": return block.text.split("\n").filter(Boolean).map(bodyText);
    case "experience-item": {
      const it = block.item;
      return entryParagraphs([it.jobTitle, it.company].filter(Boolean).join(" — "), [it.city, it.country].filter(Boolean).join(", "), formatCvDateRange(it.startDate, it.endDate, it.current, data.cvLanguage, data.dateFormat), it.description);
    }
    case "education-item": {
      const it = block.item;
      return entryParagraphs([it.degree, it.institution].filter(Boolean).join(" — "), [it.city, it.country, it.honors].filter(Boolean).join(", "), formatCvDateRange(it.startDate, it.endDate, false, data.cvLanguage, data.dateFormat), it.description);
    }
    case "certification-item": {
      const it = block.item;
      return entryParagraphs([it.name, it.issuer].filter(Boolean).join(" — "), it.url, it.date, "");
    }
    case "project-item": {
      const it = block.item;
      return entryParagraphs(it.name, [it.technologies, it.url].filter(Boolean).join(" · "), it.date, it.description);
    }
    case "custom-item": {
      const it = block.item;
      return entryParagraphs([it.title, it.subtitle].filter(Boolean).join(" — "), "", it.date, it.description);
    }
    case "skills-list": return data.skills.map(s => bodyText(s.level ? `${s.name} — ${strings.skillLevels[s.level]}` : s.name));
    case "languages-list": return data.spokenLanguages.map(l => bodyText(`${l.name} — ${strings.languageLevels[l.level]}`));
    case "interests-block": return [bodyText(data.interests.map(i => i.label).join(", "))];
    case "permits-block": return [bodyText(data.permits.map(p => p.category).join(", "))];
    case "references-block": return data.references.length
      ? data.references.flatMap(r => [
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: r.name, bold: true, size: Math.round(theme.sizeBody * 2), color: headingColor })] }),
        bodyText([r.jobTitle, r.company].filter(Boolean).join(" — ")),
        bodyText([r.phone, r.email].filter(Boolean).join(" · ")),
      ])
      : [bodyText(strings.referencesOnRequest)];
    default: return [];
  }
}

async function columnParagraphs(docx: DocxModule, blocks: FlowBlock[], data: CvData, theme: CvTheme): Promise<InstanceType<DocxModule["Paragraph"]>[]> {
  const out: InstanceType<DocxModule["Paragraph"]>[] = [];
  for (const block of blocks) out.push(...await blockToParagraphs(docx, block, data, theme));
  return out;
}

export async function renderCvDocx(data: CvData, theme: CvTheme, template: CvTemplateConfig, signature: SignatureAsset | null): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

  const { main, sidebar } = buildFlowBlocks(data, theme.columns === 2 ? template.sidebarSections : []);

  const headerChildren: InstanceType<typeof Paragraph>[] = [];
  if (data.personal.photo) {
    try {
      const bytes = await urlToBytes(data.personal.photo.dataUrl);
      headerChildren.push(new Paragraph({ children: [new ImageRun({ data: bytes, transformation: { width: 90, height: 90 }, type: "png" })] }));
    } catch { /* unreadable photo data — export continues without it */ }
  }
  headerChildren.push(new Paragraph({ heading: docx.HeadingLevel.TITLE, children: [new TextRun({ text: fullName(data), bold: true, size: Math.round(theme.sizeName * 2), color: cssColorToHex(theme.colors.heading) })] }));
  if (titleLine(data)) headerChildren.push(new Paragraph({ children: [new TextRun({ text: titleLine(data), size: Math.round(theme.sizeJobTitle * 2), color: cssColorToHex(theme.colors.primary) })] }));
  if (contactLine(data)) headerChildren.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: contactLine(data), size: Math.round(theme.sizeBody * 1.9), color: cssColorToHex(theme.colors.secondary) })] }));

  const mainParagraphs = await columnParagraphs(docx, main, data, theme);

  const bodyChildren: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [...headerChildren];

  if (theme.columns === 2 && sidebar.length) {
    const sidebarParagraphs = await columnParagraphs(docx, sidebar, data, theme);
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: theme.sidebarWidthPercent, type: WidthType.PERCENTAGE }, shading: { fill: cssColorToHex(theme.colors.sidebarBackground) }, children: sidebarParagraphs.length ? sidebarParagraphs : [new Paragraph({ children: [] })], margins: { top: 150, bottom: 150, left: 150, right: 150 } }),
          new TableCell({ width: { size: 100 - theme.sidebarWidthPercent, type: WidthType.PERCENTAGE }, children: mainParagraphs.length ? mainParagraphs : [new Paragraph({ children: [] })], margins: { top: 150, bottom: 150, left: 150, right: 150 } }),
        ],
      })],
    });
    bodyChildren.push(table);
  } else {
    bodyChildren.push(...mainParagraphs);
  }

  if (data.signature.enabled && signature) {
    try {
      const bytes = await urlToBytes(signature.dataUrl);
      const width = 130 * (data.signature.sizePercent / 100);
      const height = width * (signature.height / signature.width);
      bodyChildren.push(new Paragraph({ spacing: { before: 200 }, children: [new ImageRun({ data: bytes, transformation: { width, height }, type: "png" })] }));
    } catch { /* unreadable signature asset — export continues without it */ }
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: bodyChildren }],
  });

  return unlockDocxImageResize(await Packer.toBlob(doc));
}
