import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileEdit, FilePlus2, IdCard, PenLine, ScanLine, Search } from "lucide-react";

type ToolKey = "sign" | "edit" | "scan" | "create" | "cv";

export default function ToolsPage({ onSign, onEdit, onScan, onCreate, onCv }: {
  onSign: () => void; onEdit: () => void; onScan: () => void; onCreate: () => void; onCv: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const tools: { key: ToolKey; title: string; desc: string; icon: React.ReactNode; iconClass: string; category: string; onClick: () => void }[] = [
    { key: "sign", title: t("home.cards.sign.title"), desc: t("home.cards.sign.description"), icon: <PenLine size={20} />, iconClass: "ed-tool-icon-sign", category: t("tools.categoryPdf"), onClick: onSign },
    { key: "edit", title: t("home.cards.edit.title"), desc: t("home.cards.edit.description"), icon: <FileEdit size={20} />, iconClass: "ed-tool-icon-edit", category: t("tools.categoryPdf"), onClick: onEdit },
    { key: "scan", title: t("home.cards.scan.title"), desc: t("home.cards.scan.description"), icon: <ScanLine size={20} />, iconClass: "ed-tool-icon-scan", category: t("tools.categoryPdf"), onClick: onScan },
    { key: "create", title: t("home.cards.document.title"), desc: t("home.cards.document.description"), icon: <FilePlus2 size={20} />, iconClass: "ed-tool-icon-create", category: t("tools.categoryDocs"), onClick: onCreate },
    { key: "cv", title: t("home.cards.cv.title"), desc: t("home.cards.cv.description"), icon: <IdCard size={20} />, iconClass: "ed-tool-icon-cv", category: t("tools.categoryDocs"), onClick: onCv },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q ? tools.filter(tool => tool.title.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q)) : tools;

  const categories = Array.from(new Set(filtered.map(tool => tool.category)));

  return <div className="ed-shell">
    <div className="ed-container">
      <div className="ed-page-header">
        <h1>{t("nav.tools")}</h1>
      </div>
      <div className="ed-search">
        <Search size={18} />
        <input
          type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t("tools.searchPlaceholder")} aria-label={t("tools.searchPlaceholder")}
        />
      </div>
      {filtered.length === 0 && <p className="ed-empty">{t("tools.noResults")}</p>}
      {categories.map(category => <section className="ed-section" key={category}>
        <p className="ed-category-label">{category}</p>
        <div className="ed-recent-list">
          {filtered.filter(tool => tool.category === category).map(tool => <button key={tool.key} type="button" className="ed-tool-row" onClick={tool.onClick}>
            <span className={`ed-tool-icon ${tool.iconClass}`}>{tool.icon}</span>
            <span className="ed-tool-row-body">
              <h3>{tool.title}</h3>
              <p>{tool.desc}</p>
            </span>
          </button>)}
        </div>
      </section>)}
    </div>
  </div>;
}
