import { cssColorToRgb01, parsePageBlocks, type Align, type BlockKind, type InlineRun } from "./doc-html-parse";
import type { Stamp } from "./pdf-signing";

export const A4_WIDTH_PT = 595.28; // 210mm
export const A4_HEIGHT_PT = 841.89; // 297mm
export const PAGE_MARGIN_PT = 70; // ~24.7mm, a normal Word-style margin

type Token = { text: string; run: InlineRun; isBreak?: boolean };

function tokenize(runs: InlineRun[]): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    if (run.text === "\n") { tokens.push({ text: "", run, isBreak: true }); continue; }
    for (const word of run.text.split(/(\s+)/).filter(Boolean)) tokens.push({ text: word, run });
  }
  return tokens;
}

type Fonts = { regular: import("pdf-lib").PDFFont; bold: import("pdf-lib").PDFFont; italic: import("pdf-lib").PDFFont; boldItalic: import("pdf-lib").PDFFont };
function fontFor(run: InlineRun, fonts: Fonts) {
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

type Line = { tokens: Token[]; width: number };

function layoutLines(tokens: Token[], maxWidth: number, fonts: Fonts): Line[] {
  const lines: Line[] = [];
  let current: Token[] = [];
  let width = 0;
  function push() { lines.push({ tokens: current, width }); current = []; width = 0; }
  for (const tok of tokens) {
    if (tok.isBreak) { push(); continue; }
    const font = fontFor(tok.run, fonts);
    const w = font.widthOfTextAtSize(tok.text, tok.run.sizePt);
    const isSpace = tok.text.trim() === "";
    if (current.length === 0 && isSpace) continue; // no leading space on a fresh line
    if (width + w > maxWidth && current.length > 0 && !isSpace) push();
    current.push(tok);
    width += w;
  }
  if (current.length) push();
  return lines;
}

const BULLET_INDENT_PT = 18;

function blockIndent(kind: BlockKind): number { return kind === "li-ul" || kind === "li-ol" ? BULLET_INDENT_PT : 0; }
function bulletGlyph(kind: BlockKind, ordinal: number): string { return kind === "li-ol" ? `${ordinal}.` : "•"; }

export async function renderDocumentPdf(pagesHtml: string[], signatures: Stamp[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const contentWidth = A4_WIDTH_PT - PAGE_MARGIN_PT * 2;
  const embeddedSignatures = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();

  for (let pageIndex = 0; pageIndex < pagesHtml.length; pageIndex++) {
    const page = doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    const blocks = parsePageBlocks(pagesHtml[pageIndex]);
    let y = A4_HEIGHT_PT - PAGE_MARGIN_PT;
    let listOrdinal = 0;
    let previousKind: BlockKind | null = null;

    for (const block of blocks) {
      if (block.kind === "li-ol" && previousKind !== "li-ol") listOrdinal = 0;
      if (block.kind === "li-ol") listOrdinal++;
      previousKind = block.kind;

      const indent = blockIndent(block.kind);
      const tokens = tokenize(block.runs);
      const lines = layoutLines(tokens, contentWidth - indent, fonts);
      const hasText = block.runs.some(r => r.text.trim().length > 0);
      const blockSizePt = block.runs[0]?.sizePt ?? 12;
      const lineHeight = blockSizePt * 1.32;

      if (!hasText) { y -= lineHeight; continue; }

      if ((block.kind === "li-ul" || block.kind === "li-ol") && lines.length) {
        const glyph = bulletGlyph(block.kind, listOrdinal);
        page.drawText(glyph, { x: PAGE_MARGIN_PT, y: y - blockSizePt, size: blockSizePt, font: fonts.regular, color: rgb(0.09, 0.15, 0.24) });
      }

      lines.forEach((line, lineIndex) => {
        const isLastLine = lineIndex === lines.length - 1;
        const align: Align = block.align;
        const baseX = PAGE_MARGIN_PT + indent;
        let x = align === "center" ? baseX + (contentWidth - indent - line.width) / 2
          : align === "right" ? baseX + (contentWidth - indent - line.width)
            : baseX;
        const spaceTokens = line.tokens.filter(t => t.text.trim() === "");
        const slack = contentWidth - indent - line.width;
        const extraPerSpace = align === "justify" && !isLastLine && spaceTokens.length ? slack / spaceTokens.length : 0;

        const baseline = y - blockSizePt;
        if (extraPerSpace !== 0) {
          // Justified line: extra slack is distributed between words, so
          // each space needs its own advance and tokens are drawn
          // individually to keep that precise.
          for (const tok of line.tokens) {
            const font = fontFor(tok.run, fonts);
            const w = font.widthOfTextAtSize(tok.text, tok.run.sizePt);
            if (tok.text.trim() !== "") {
              const { r, g, b } = cssColorToRgb01(tok.run.color);
              page.drawText(tok.text, { x, y: baseline, size: tok.run.sizePt, font, color: rgb(r, g, b) });
              if (tok.run.underline) page.drawLine({ start: { x, y: baseline - blockSizePt * 0.08 }, end: { x: x + w, y: baseline - blockSizePt * 0.08 }, thickness: Math.max(0.6, blockSizePt * 0.045), color: rgb(r, g, b) });
            }
            x += w + (tok.text.trim() === "" ? extraPerSpace : 0);
          }
        } else {
          // Otherwise, merge consecutive same-formatting tokens (including
          // the spaces between words) into a single drawText call each —
          // fewer PDF text-show operators, and it sidesteps a rendering
          // quirk where some viewers visually collapse the gap left by a
          // space drawn as its own separate, adjacent Tj operator.
          let i = 0;
          while (i < line.tokens.length) {
            const run = line.tokens[i].run;
            const font = fontFor(run, fonts);
            let text = "", groupWidth = 0;
            while (i < line.tokens.length && line.tokens[i].run === run) {
              text += line.tokens[i].text;
              groupWidth += font.widthOfTextAtSize(line.tokens[i].text, run.sizePt);
              i++;
            }
            if (text.trim() !== "") {
              const { r, g, b } = cssColorToRgb01(run.color);
              page.drawText(text, { x, y: baseline, size: run.sizePt, font, color: rgb(r, g, b) });
              if (run.underline) page.drawLine({ start: { x, y: baseline - blockSizePt * 0.08 }, end: { x: x + groupWidth, y: baseline - blockSizePt * 0.08 }, thickness: Math.max(0.6, blockSizePt * 0.045), color: rgb(r, g, b) });
            }
            x += groupWidth;
          }
        }
        y -= lineHeight;
      });
    }

    for (const stamp of signatures.filter(s => s.page === pageIndex + 1)) {
      let image = embeddedSignatures.get(stamp.dataUrl);
      if (!image) { image = await doc.embedPng(stamp.dataUrl); embeddedSignatures.set(stamp.dataUrl, image); }
      page.drawImage(image, {
        x: stamp.x * A4_WIDTH_PT,
        y: (1 - stamp.y - stamp.h) * A4_HEIGHT_PT,
        width: stamp.w * A4_WIDTH_PT,
        height: stamp.h * A4_HEIGHT_PT,
      });
    }
  }

  return doc.save({ updateFieldAppearances: false });
}
