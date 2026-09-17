import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, FileEdit, FilePlus2, IdCard, PenLine, ScanLine, Sparkles, User } from "lucide-react";
import { listRecentDocuments, formatRelativeDate, type RecentDocument } from "./lib/recent-documents";

const BASE = import.meta.env.BASE_URL;

function PresentationCarousel() {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const slides = [
    { key: "intro", title: t("home.carousel.intro.title"), desc: t("home.carousel.intro.desc"), icon: <Sparkles size={22} />, iconClass: "ed-tool-icon-sign" },
    { key: "scan", title: t("home.carousel.scan.title"), desc: t("home.carousel.scan.desc"), icon: <ScanLine size={22} />, iconClass: "ed-tool-icon-scan" },
    { key: "edit", title: t("home.carousel.edit.title"), desc: t("home.carousel.edit.desc"), icon: <FileEdit size={22} />, iconClass: "ed-tool-icon-edit" },
    { key: "sign", title: t("home.carousel.sign.title"), desc: t("home.carousel.sign.desc"), icon: <PenLine size={22} />, iconClass: "ed-tool-icon-sign" },
    { key: "create", title: t("home.carousel.create.title"), desc: t("home.carousel.create.desc"), icon: <FilePlus2 size={22} />, iconClass: "ed-tool-icon-create" },
    { key: "cv", title: t("home.carousel.cv.title"), desc: t("home.carousel.cv.desc"), icon: <IdCard size={22} />, iconClass: "ed-tool-icon-cv" },
  ];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function goTo(i: number) {
    trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" });
  }

  return <div className="ed-carousel">
    <div className="ed-carousel-track" ref={trackRef}>
      {slides.map(slide => <div className="ed-carousel-slide" key={slide.key}>
        <span className={`ed-carousel-icon ${slide.iconClass}`}>{slide.icon}</span>
        <h3>{slide.title}</h3>
        <p>{slide.desc}</p>
      </div>)}
    </div>
    <div className="ed-carousel-dots" role="tablist" aria-label={t("home.carousel.intro.title")}>
      {slides.map((slide, i) => <button
        key={slide.key} type="button" className="ed-carousel-dot" data-active={i === active}
        aria-label={slide.title} aria-selected={i === active} role="tab" onClick={() => goTo(i)}
      />)}
    </div>
  </div>;
}

export default function Home({ onSign, onEdit, onScan, onCreate, onCv, onOpenCvDraft, onOpenDocDraft, onSettings, onSeeAllDocs }: {
  onSign: () => void; onEdit: () => void; onScan: () => void; onCreate: () => void; onCv: () => void;
  onOpenCvDraft: (id: string) => void; onOpenDocDraft: (id: string) => void;
  onSettings: () => void; onSeeAllDocs: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [recent, setRecent] = useState<RecentDocument[]>([]);

  useEffect(() => { void listRecentDocuments().then(setRecent); }, []);

  // All five real tools presented at the same level — no single tool is
  // pushed forward as "the" primary action.
  const tools = [
    { key: "sign", title: t("home.cards.sign.title"), desc: t("home.cards.sign.short"), icon: <PenLine size={22} />, iconClass: "ed-tool-icon-sign", onClick: onSign },
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
          <picture className="ed-logo-full">
            <source srcSet={`${BASE}brand/easy-docs-logo.webp`} type="image/webp" />
            <img src={`${BASE}brand/easy-docs-logo.png`} alt="Easy Docs" />
          </picture>
          <p className="ed-tagline">{t("home.tagline")}</p>
        </div>
        <button type="button" className="ed-avatar" aria-label={t("nav.settings")} onClick={onSettings}>
          <User size={19} />
        </button>
      </header>

      <section className="ed-hero ed-hero-presentation">
        <p className="ed-hero-eyebrow">{t("home.hero.eyebrow")}</p>
        <h1>{t("home.hero.heading")}</h1>
        <p>{t("home.hero.subtitle")}</p>
      </section>

      <PresentationCarousel />

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
