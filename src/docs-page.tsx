import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, FilePlus2, IdCard } from "lucide-react";
import { listRecentDocuments, formatRelativeDate, type RecentDocument } from "./lib/recent-documents";

export default function DocsPage({ onOpenCvDraft, onOpenDocDraft }: {
  onOpenCvDraft: (id: string) => void; onOpenDocDraft: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<RecentDocument[] | null>(null);

  useEffect(() => { void listRecentDocuments().then(setDocs); }, []);

  function open(doc: RecentDocument) {
    if (doc.kind === "cv") onOpenCvDraft(doc.id); else onOpenDocDraft(doc.id);
  }

  return <div className="ed-shell">
    <div className="ed-container">
      <div className="ed-page-header">
        <h1>{t("nav.docs")}</h1>
        <p>{t("docs.subtitle")}</p>
      </div>
      {docs === null && <p className="ed-empty">{t("common.loading")}</p>}
      {docs !== null && docs.length === 0 && <p className="ed-empty">{t("docs.empty")}</p>}
      {docs !== null && docs.length > 0 && <div className="ed-recent-list">
        {docs.map(doc => <button key={doc.id} type="button" className="ed-recent-row" onClick={() => open(doc)}>
          <span className={`ed-recent-icon ${doc.kind === "cv" ? "ed-recent-icon-cv" : "ed-recent-icon-doc"}`}>
            {doc.kind === "cv" ? <IdCard size={18} /> : <FilePlus2 size={18} />}
          </span>
          <span className="ed-recent-body">
            <p className="ed-recent-name">{doc.name}</p>
            <p className="ed-recent-meta">{doc.kind === "cv" ? t("home.recent.kindCv") : t("home.recent.kindDoc")} · {formatRelativeDate(doc.updatedAt, i18n.language)}</p>
          </span>
          <ChevronRight size={17} className="ed-recent-chevron" />
        </button>)}
      </div>}
    </div>
  </div>;
}
