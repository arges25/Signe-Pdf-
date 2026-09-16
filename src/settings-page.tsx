import { useTranslation } from "react-i18next";
import { Globe, ShieldCheck } from "lucide-react";
import LanguageSwitcher from "./i18n/LanguageSwitcher";

export default function SettingsPage() {
  const { t } = useTranslation();
  return <div className="ed-shell">
    <div className="ed-container">
      <div className="ed-page-header">
        <h1>{t("nav.settings")}</h1>
      </div>
      <div className="ed-settings-list">
        <div className="ed-settings-row">
          <span className="ed-settings-row-label"><Globe size={18} /> {t("settings.language")}</span>
          <LanguageSwitcher />
        </div>
        <div className="ed-settings-row">
          <span className="ed-settings-row-label"><ShieldCheck size={18} /> {t("settings.privacy")}</span>
        </div>
      </div>
      <p className="ed-settings-note">{t("common.privacyNote")}</p>
    </div>
  </div>;
}
