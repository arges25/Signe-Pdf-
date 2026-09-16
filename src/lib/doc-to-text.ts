import { parsePageBlocks } from "./doc-html-parse";

// TXT: content and paragraph breaks only, no styling, no images/signature
// (nothing to render them as in a plain text file) — UTF-8, which is what
// every modern text editor and `new Blob([...], {type: "text/plain"})`
// already produces by default.
export function renderDocumentTxt(pagesHtml: string[]): string {
  const lines: string[] = [];
  for (const html of pagesHtml) {
    for (const block of parsePageBlocks(html)) {
      const text = block.runs.map(r => (r.text === "\n" ? "\n" : r.text)).join("");
      lines.push(text);
    }
  }
  return lines.join("\n\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// HTML: keeps formatting (bold/italic/underline/color/size, alignment,
// lists, headings) and the signature as an <img>, in one self-contained
// file any browser can open directly.
export function renderDocumentHtml(pagesHtml: string[], title: string): string {
  const pages = pagesHtml.map(html => `<section class="doc-page">${html}</section>`).join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Manrope Variable", Arial, sans-serif; background: #eef2f7; margin: 0; padding: 24px; }
  .doc-page { background: #fff; max-width: 210mm; margin: 0 auto 24px; padding: 24mm; box-shadow: 0 2px 10px rgba(0,0,0,.12); box-sizing: border-box; line-height: 1.5; color: #18263c; }
  .doc-page p { margin: 0 0 10px; }
  .doc-page h1 { font-size: 20pt; margin: 0 0 12px; }
  .doc-page h2 { font-size: 16pt; margin: 0 0 10px; }
  .doc-page ul, .doc-page ol { margin: 0 0 10px; padding-left: 22px; }
  @media print { body { background: #fff; padding: 0; } .doc-page { box-shadow: none; margin: 0; page-break-after: always; } }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}
