import { ArrowRight, FileEdit, FileText, IdCard, PenLine, ScanLine, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./i18n/LanguageSwitcher";

export default function Home({ onSign, onEdit, onScan, onCreate, onCv }: { onSign: () => void; onEdit: () => void; onScan: () => void; onCreate: () => void; onCv: () => void }) {
  const { t } = useTranslation();
  return <div className="app-shell">
    <header className="site-header">
      <div className="brand" aria-label={t("home.brand")}><span className="brand-icon"><PenLine size={23} strokeWidth={1.9} /></span><span>{t("home.brand")}<span className="brand-period">.</span></span></div>
      <span className="header-divider" /> <span className="header-description">{t("home.tagline")}</span>
      <div className="local-badge"><ShieldCheck size={17} /><span>{t("home.localBadge")}</span></div>
      <LanguageSwitcher />
    </header>
    <main className="main-content home-main">
      <div className="home-intro">
        <p className="eyebrow">{t("home.brand").toUpperCase()}</p>
        <h1>{t("home.heading")}</h1>
        <p className="home-subtitle">{t("home.subtitle")}</p>
      </div>
      <div className="home-cards">
        <button type="button" className="home-card" onClick={onSign}>
          <span className="home-card-icon"><PenLine size={26} /></span>
          <h2>{t("home.cards.sign.title")}</h2>
          <p>{t("home.cards.sign.description")}</p>
          <span className="home-card-cta">{t("home.cards.cta")} <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onEdit}>
          <span className="home-card-icon home-card-icon-alt"><FileEdit size={26} /></span>
          <h2>{t("home.cards.edit.title")}</h2>
          <p>{t("home.cards.edit.description")}</p>
          <span className="home-card-cta">{t("home.cards.cta")} <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onScan}>
          <span className="home-card-icon home-card-icon-scan"><ScanLine size={26} /></span>
          <h2>{t("home.cards.scan.title")}</h2>
          <p>{t("home.cards.scan.description")}</p>
          <span className="home-card-cta">{t("home.cards.cta")} <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onCreate}>
          <span className="home-card-icon home-card-icon-create"><FileText size={26} /></span>
          <h2>{t("home.cards.document.title")}</h2>
          <p>{t("home.cards.document.description")}</p>
          <span className="home-card-cta">{t("home.cards.cta")} <ArrowRight size={16} /></span>
        </button>
        <button type="button" className="home-card" onClick={onCv}>
          <span className="home-card-icon home-card-icon-cv"><IdCard size={26} /></span>
          <h2>{t("home.cards.cv.title")}</h2>
          <p>{t("home.cards.cv.description")}</p>
          <span className="home-card-cta">{t("home.cards.cta")} <ArrowRight size={16} /></span>
        </button>
      </div>
    </main>
    <footer className="page-footer home-footer"><span>{t("home.footer")}</span></footer>
  </div>;
}
