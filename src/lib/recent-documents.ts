import { listCvDrafts } from "@/cv/storage/cv-store";
import { listDrafts } from "./doc-drafts-store";

export type RecentDocument = {
  id: string;
  name: string;
  kind: "cv" | "doc";
  updatedAt: number;
};

// Merges the two real, already-persisted draft stores (CV builder + document
// creator) into one list for the home screen and Docs page. Sign/Edit/Scan
// have no persisted history of their own — they're a load-edit-export flow
// with nothing saved between visits — so they never appear here.
export async function listRecentDocuments(): Promise<RecentDocument[]> {
  const [cvDrafts, docDrafts] = await Promise.all([listCvDrafts(), listDrafts()]);
  const items: RecentDocument[] = [
    ...cvDrafts.map(d => ({ id: d.id, name: d.name, kind: "cv" as const, updatedAt: d.updatedAt })),
    ...docDrafts.map(d => ({ id: d.id, name: d.name, kind: "doc" as const, updatedAt: d.updatedAt })),
  ];
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatRelativeDate(timestamp: number, locale: string): string {
  const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOfDay(timestamp) - startOfDay(Date.now())) / 86_400_000);
  if (days >= -30 && days <= 0) {
    try { return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day"); } catch { /* unsupported locale, fall through */ }
  }
  return new Date(timestamp).toLocaleDateString(locale);
}
