import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

// Single shared "Easy Docs" wordmark, used everywhere the app shows its
// name — the home screen and every tool's own header — so the two never
// drift apart again the way the old hardcoded "Signé." header text did.
export function BrandWordmark({ className }: { className?: string }) {
  return <div className={`ed-tool-wordmark${className ? ` ${className}` : ""}`} aria-label="Easy Docs">
    <span className="ed-wordmark-easy">Easy</span> <span className="ed-wordmark-docs">Docs</span>
  </div>;
}

export function PrivacyBadge() {
  const { t } = useTranslation();
  return <div className="local-badge"><ShieldCheck size={17} /><span>{t("header.privacyBadge")}</span></div>;
}
