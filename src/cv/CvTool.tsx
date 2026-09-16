import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import CvRenderer from "./preview/CvRenderer";
import { CV_TEMPLATES, templateConfig, DEFAULT_TEMPLATE_ID } from "./templates/registry";
import type { CvTemplateId } from "./types/template";
import { sampleCvData } from "./sample-data";

// Temporary scaffold for visually verifying the 15 templates against the
// shared renderer while the real multi-step editor (task 4) is still
// being built — replaced by CvTool's full editor UI shortly.
export default function CvTool({ onBack }: { onBack: () => void; onSignThis: (file: File) => void }) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState<CvTemplateId>(DEFAULT_TEMPLATE_ID);
  const template = templateConfig(templateId);
  const data = sampleCvData();
  data.cvLanguage = "fr";

  return <div className="app-shell">
    <header className="site-header">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} /> {t("common.back")}</Button>
    </header>
    <main className="main-content" style={{ display: "flex", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 220 }}>
        {CV_TEMPLATES.map(tpl => <button key={tpl.id} onClick={() => setTemplateId(tpl.id)} style={{ textAlign: "left", padding: 8, border: tpl.id === templateId ? "2px solid #2457ea" : "1px solid #ddd", borderRadius: 6, background: "#fff" }}>{tpl.id}</button>)}
      </div>
      <div style={{ transform: "scale(0.7)", transformOrigin: "top left", boxShadow: "0 0 0 1px #ddd" }}>
        <CvRenderer data={data} theme={template.defaultTheme} template={template} signature={null} />
      </div>
    </main>
  </div>;
}
