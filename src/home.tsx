import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronRight, FileEdit, FilePlus2, IdCard, PenLine, ScanLine, User } from "lucide-react";
import HeroIllustration from "./hero-illustration";
import { listRecentDocuments, formatRelativeDate, type RecentDocument } from "./lib/recent-documents";

export default function Home({ onSign, onEdit, onScan, onCreate, onCv, onOpenCvDraft, onOpenDocDraft, onSettings, onSeeAllDocs }: {
  onSign: () => void; onEdit: () => void; onScan: () => void; onCreate: () => void; onCv: () => void;
  onOpenCvDraft: (id: string) => void; onOpenDocDraft: (id: string) => void;
  onSettings: () => void; onSeeAllDocs: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [recent, setRecent] = useState<RecentDocument[]>([]);

  useEffect(() => { void listRecentDocuments().then(setRecent); }, []);

  const tools = [
    { key: "scan", title: t("home.cards.scan.title"), desc: t("home.cards.scan.short"), icon: <ScanLine size={22} />, iconClass: "ed-tool-icon-scan", onClick: onScan },
    { key: "edit", title: t("home.cards.edit.title"), desc: t("home.cards.edit.short"), icon: <FileEdit size={22} />, iconClass: "ed-tool-icon-edit", onClick: onEdit },
    { key: "create", title: t("home.cards.document.title"), desc: t("home.cards.document.short"), icon: <FilePlus2 size={22} />, iconClass: "ed-tool-icon-create", onClick: onCreate },
    { key: "cv", title: t("home.cards.cv.title"), desc: t("home.cards.cv.short"), icon: <IdCard size={22} />, iconClass: "ed-tool-icon-cv", onClick: onCv },
  ];

  function openRecent(doc: RecentDocument) {
    if (doc.kind === "cv") onOpenCvDraft(doc.id); else onOpenDocDraft(doc.id);
  }

  return <div className="ed-shell">
    <div className="ed-container">
      <header className="ed-header">
        <div>
          <p className="ed-wordmark"><span className="ed-wordmark-easy">Easy</span> <span className="ed-wordmark-docs">Docs</span></p>
          <p className="ed-tagline">{t("home.tagline")}</p>
        </div>
        <button type="button" className="ed-avatar" aria-label={t("nav.settings")} onClick={onSettings}>
          <User size={19} />
        </button>
      </header>

      <section className="ed-hero">
        <div className="ed-hero-art"><HeroIllustration /></div>
        <p className="ed-hero-eyebrow">{t("home.hero.eyebrow")}</p>
        <h1>{t("home.hero.heading")}</h1>
        <p>{t("home.hero.subtitle")}</p>
        <button type="button" className="ed-hero-cta" onClick={onSign}>
          <PenLine size={19} />
          <span>{t("home.cards.sign.title")}</span>
          <ArrowRight size={18} />
        </button>
      </section>

      <section className="ed-section">
        <div className="ed-tool-grid">
          {tools.map(tool => <button key={tool.key} type="button" className="ed-tool-card" onClick={tool.onClick}>
            <span className={`ed-tool-icon ${tool.iconClass}`}>{tool.icon}</span>
            <h3>{tool.title}</h3>
            <p>{tool.desc}</p>
          </button>)}
        </div>
      </section>

      {recent.length > 0 && <section className="ed-section">
        <div className="ed-section-head">
          <h2>{t("home.recent.title")}</h2>
          <button type="button" className="ed-section-link" onClick={onSeeAllDocs}>{t("home.recent.seeAll")} <ChevronRight size={15} /></button>
        </div>
        <div className="ed-recent-list">
          {recent.slice(0, 3).map(doc => <button key={doc.id} type="button" className="ed-recent-row" onClick={() => openRecent(doc)}>
            <span className={`ed-recent-icon ${doc.kind === "cv" ? "ed-recent-icon-cv" : "ed-recent-icon-doc"}`}>
              {doc.kind === "cv" ? <IdCard size={18} /> : <FilePlus2 size={18} />}
            </span>
            <span className="ed-recent-body">
              <p className="ed-recent-name">{doc.name}</p>
              <p className="ed-recent-meta">{doc.kind === "cv" ? t("home.recent.kindCv") : t("home.recent.kindDoc")} · {formatRelativeDate(doc.updatedAt, i18n.language)}</p>
            </span>
            <ChevronRight size={17} className="ed-recent-chevron" />
          </button>)}
        </div>
      </section>}
    </div>
  </div>;
}
