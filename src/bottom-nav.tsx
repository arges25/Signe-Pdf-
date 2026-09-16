import { Home as HomeIcon, LayoutGrid, FileStack, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

export type NavTab = "home" | "tools" | "docs" | "settings";

export default function BottomNav({ active, onHome, onTools, onDocs, onSettings }: {
  active: NavTab;
  onHome: () => void;
  onTools: () => void;
  onDocs: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const items: { key: NavTab; label: string; icon: React.ReactNode; onClick: () => void }[] = [
    { key: "home", label: t("nav.home"), icon: <HomeIcon size={22} strokeWidth={2.1} />, onClick: onHome },
    { key: "tools", label: t("nav.tools"), icon: <LayoutGrid size={22} strokeWidth={2.1} />, onClick: onTools },
    { key: "docs", label: t("nav.docs"), icon: <FileStack size={22} strokeWidth={2.1} />, onClick: onDocs },
    { key: "settings", label: t("nav.settings"), icon: <Settings size={22} strokeWidth={2.1} />, onClick: onSettings },
  ];
  return <nav className="ed-bottom-nav" aria-label={t("nav.label")}>
    {items.map(item => <button
      key={item.key} type="button" className="ed-nav-item"
      data-active={item.key === active} aria-current={item.key === active ? "page" : undefined}
      onClick={item.onClick}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.key === active && <span className="ed-nav-dot" aria-hidden="true" />}
    </button>)}
  </nav>;
}
