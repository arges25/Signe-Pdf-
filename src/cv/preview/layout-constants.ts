// Shared between the on-screen preview and the PDF exporter, in CSS `pt`
// units — 1 CSS pt is exactly 1/72in, the same unit pdf-lib works in, so
// nothing needs converting between what's on screen and what's printed.
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

// The CV page itself is sized in real CSS `pt`, but any scale factor
// computed against a measurement taken in real screen pixels (a
// ResizeObserver width, a thumbnail's target px size) must go through
// this conversion first — 1 CSS pt renders as 4/3 CSS px at the browser's
// standard 96dpi, so dividing a px measurement by the bare pt number
// (without this factor) would under-scale the page by 25%.
export const PT_TO_PX = 4 / 3;
export const A4_WIDTH_PX = A4_WIDTH_PT * PT_TO_PX;
export const A4_HEIGHT_PX = A4_HEIGHT_PT * PT_TO_PX;
