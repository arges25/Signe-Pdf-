// Keeps each editor page's contentEditable within its own A4 sheet by
// moving whole block elements (paragraphs, headings, lists) between pages
// — never splitting a block mid-paragraph. Pages are real, separate
// contentEditable elements (not one long flow visually chopped up), which
// is what lets the user see genuine page boundaries; this function is what
// keeps that arrangement correct as they type.
//
// Deliberately block-level, not line-level: an overflowing block is moved
// to the next page whole. A single paragraph long enough to exceed a
// whole page by itself will still overflow that page — a rare edge case
// for the letters/attestations this editor targets, and far safer than
// splitting text mid-line, which risks corrupting inline formatting spans.
export function reflowPages(contentEls: HTMLDivElement[]): { needsNewPage: boolean } {
  for (let i = 0; i < contentEls.length; i++) {
    const el = contentEls[i];
    while (el.scrollHeight > el.clientHeight + 1 && el.children.length > 1) {
      const last = el.lastElementChild;
      const next = contentEls[i + 1];
      if (!last) break;
      if (!next) return { needsNewPage: true };
      next.insertBefore(last, next.firstChild);
    }
  }
  for (let i = 0; i < contentEls.length - 1; i++) {
    const el = contentEls[i];
    const next = contentEls[i + 1];
    while (next.firstElementChild) {
      const first = next.firstElementChild;
      el.appendChild(first);
      if (el.scrollHeight > el.clientHeight + 1) {
        next.insertBefore(first, next.firstChild);
        break;
      }
    }
  }
  return { needsNewPage: false };
}

// True once a page's DOM has been reduced to nothing worth keeping — no
// visible text, regardless of how many stray empty paragraphs it holds.
// A run of several empty <p><br></p> blocks (not just one) can end up on
// a trailing page after a burst of edits, so this only ever checks for
// actual text, never a child count.
export function isPageEmpty(el: HTMLDivElement): boolean {
  return (el.textContent ?? "").trim().length === 0;
}

export function saveSelection(): Range | null {
  const sel = window.getSelection();
  return sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
}

// Restores a Range saved before a reflow. Node identities survive the
// moves in reflowPages (blocks are relocated with insertBefore/append,
// never cloned or recreated), so the saved Range's containers are still
// valid — but the contentEditable that now visually owns the caret may
// not be the one that has native focus, so that's re-established too.
export function restoreSelection(range: Range | null, contentEls: HTMLDivElement[]) {
  if (!range) return;
  const owner = contentEls.find(el => el.contains(range.startContainer));
  if (!owner) return;
  owner.focus();
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  try { sel.addRange(range); } catch { /* range no longer valid — leave focus where it landed */ }
}
