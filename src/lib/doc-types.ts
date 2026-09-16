import type { Stamp } from "./pdf-signing";

export type DocTemplateId = "blank" | "letter" | "attestation" | "hebergement";

export type DocDraft = {
  id: string;
  name: string;
  templateId: DocTemplateId;
  // innerHTML of each editor page's contentEditable — the source of truth
  // for persistence, export and reload. Pagination is recomputed from
  // this on load (see doc-pagination.ts), it isn't stored separately.
  pagesHtml: string[];
  // Reuses the exact Stamp shape (and drag/resize convention) the signing
  // feature already uses — signatures placed in a document are just
  // stamps on a page that happens to be generated rather than imported.
  signatures: Stamp[];
  createdAt: number;
  updatedAt: number;
};
