import { parsePageBlocks, type BlockKind, type InlineRun } from "./doc-html-parse";
import type { Stamp } from "./pdf-signing";
import { unlockDocxImageResize } from "./docx-unlock-images";

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

async function pngDataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

export async function renderDocumentDocx(pagesHtml: string[], signatures: Stamp[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, ImageRun } = await import("docx");

  const ALIGN = {
    left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
  } as const;
  const HEADING = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2 } as const;

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  for (let pageIndex = 0; pageIndex < pagesHtml.length; pageIndex++) {
    const blocks = parsePageBlocks(pagesHtml[pageIndex]);
    let listOrdinal = 0;
    let previousKind: BlockKind | null = null;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.kind === "li-ol" && previousKind !== "li-ol") listOrdinal = 0;
      if (block.kind === "li-ol") listOrdinal++;
      previousKind = block.kind;

      const runs = block.runs.flatMap((run: InlineRun) => run.text === "\n"
        ? [new TextRun({ break: 1 })]
        : run.text.trim() === "" && run.text.length === 0 ? [] : [new TextRun({
          text: run.text,
          bold: run.bold,
          italics: run.italic,
          underline: run.underline ? {} : undefined,
          color: cssColorToHex(run.color),
          size: Math.round(run.sizePt * 2),
        })]);

      const isFirstOfPage = i === 0 && pageIndex > 0;
      const prefix = block.kind === "li-ol" ? `${listOrdinal}. ` : block.kind === "li-ul" ? "•  " : "";
      const finalRuns = prefix ? [new TextRun({ text: prefix, size: Math.round((block.runs[0]?.sizePt ?? 12) * 2) }), ...runs] : runs;

      paragraphs.push(new Paragraph({
        children: finalRuns.length ? finalRuns : [new TextRun({ text: "" })],
        alignment: ALIGN[block.align],
        heading: block.kind === "h1" || block.kind === "h2" ? HEADING[block.kind] : undefined,
        indent: block.kind === "li-ul" || block.kind === "li-ol" ? { left: 360 } : undefined,
        pageBreakBefore: isFirstOfPage,
        spacing: { after: 120 },
      }));
    }

    for (const stamp of signatures.filter(s => s.page === pageIndex + 1)) {
      const bytes = await pngDataUrlToBytes(stamp.dataUrl);
      const widthPx = Math.round(stamp.w * 600);
      const heightPx = Math.round(widthPx * (stamp.height / stamp.width));
      paragraphs.push(new Paragraph({
        children: [new ImageRun({ data: bytes, transformation: { width: widthPx, height: heightPx }, type: "png" })],
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      children: paragraphs,
    }],
  });

  return unlockDocxImageResize(await Packer.toBlob(doc));
}
