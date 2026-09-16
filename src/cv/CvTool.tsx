import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function CvTool({ onBack }: { onBack: () => void; onSignThis: (file: File) => void }) {
  const { t } = useTranslation();
  return <div className="app-shell">
    <header className="site-header">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} /> {t("common.back")}</Button>
    </header>
    <main className="main-content">
      <p>{t("home.cards.cv.title")} — {t("common.loading")}</p>
    </main>
  </div>;
}
