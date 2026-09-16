// Parses the editor's own generated HTML (a small, known-fixed shape —
// this is never arbitrary third-party HTML) into a plain block/run model
// shared by every exporter (PDF, DOCX, HTML, TXT), so each one lays out
// or serializes the same structure instead of re-parsing independently.

export type Align = "left" | "center" | "right" | "justify";
export type BlockKind = "p" | "h1" | "h2" | "li-ul" | "li-ol";

export type InlineRun = {
  text: string; // "\n" marks an explicit <br> line break within the block
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string; // CSS color string, default "#18263c"
  sizePt: number;
};

export type ParsedBlock = { kind: BlockKind; align: Align; runs: InlineRun[] };

const DEFAULT_SIZE_PT: Record<BlockKind, number> = { p: 12, h1: 20, h2: 16, "li-ul": 12, "li-ol": 12 };
export const DEFAULT_COLOR = "#18263c";

function readAlign(el: Element): Align {
  const style = el.getAttribute("style") ?? "";
  const m = /text-align:\s*(left|center|right|justify)/i.exec(style);
  const value = m?.[1]?.toLowerCase();
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function parseInline(el: Element, inherited: InlineRun): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ ...inherited, text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();
      if (tag === "br") { runs.push({ ...inherited, text: "\n" }); continue; }
      const next: InlineRun = { ...inherited };
      if (tag === "strong" || tag === "b") next.bold = true;
      if (tag === "em" || tag === "i") next.italic = true;
      if (tag === "u") next.underline = true;
      const style = child.getAttribute("style") ?? "";
      const colorMatch = /color:\s*([^;]+)/i.exec(style);
      if (colorMatch) next.color = colorMatch[1].trim();
      const sizeMatch = /font-size:\s*([\d.]+)pt/i.exec(style);
      if (sizeMatch) next.sizePt = Number(sizeMatch[1]);
      runs.push(...parseInline(child, next));
    }
  }
  return runs;
}

export function parsePageBlocks(html: string): ParsedBlock[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const blocks: ParsedBlock[] = [];
  for (const child of Array.from(container.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const kind: BlockKind = tag === "ol" ? "li-ol" : "li-ul";
      for (const li of Array.from(child.children)) {
        if (li.tagName.toLowerCase() !== "li") continue;
        const base: InlineRun = { text: "", bold: false, italic: false, underline: false, color: DEFAULT_COLOR, sizePt: DEFAULT_SIZE_PT[kind] };
        blocks.push({ kind, align: readAlign(li), runs: parseInline(li, base) });
      }
      continue;
    }
    const kind: BlockKind = tag === "h1" ? "h1" : tag === "h2" ? "h2" : "p";
    const base: InlineRun = { text: "", bold: false, italic: false, underline: false, color: DEFAULT_COLOR, sizePt: DEFAULT_SIZE_PT[kind] };
    blocks.push({ kind, align: readAlign(child), runs: parseInline(child, base) });
  }
  return blocks;
}

export function cssColorToRgb01(css: string): { r: number; g: number; b: number } {
  const el = document.createElement("div");
  el.style.color = css;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
  if (!m) return { r: 0.09, g: 0.15, b: 0.24 };
  return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255 };
}
